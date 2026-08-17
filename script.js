(() => {
  const API_URL = "https://poetry-compass-api-793239807679.us-west1.run.app";
  const POINTS_URL = "assets/poetry-compass/reference_points.json";

  const AUTHOR_COLORS = {
    "E. E. Cummings": "#b9706f",
    "Louise Glück": "#69a481",
    "Robert Frost": "#8071a8",
    "Shel Silverstein": "#b9a34f",
    "John Keats": "#57929c",
    "Ocean Vuong": "#ad6688",
    "Richard Siken": "#6c9b62",
    "John Ashbery": "#5863a4"
  };

  const SVG_NS = "http://www.w3.org/2000/svg";
  const CHART = { width: 920, height: 680, left: 62, right: 22, top: 24, bottom: 55 };

  const state = {
    points: [],
    pointById: new Map(),
    circleById: new Map(),
    neighbors: [],
    neighborById: new Map(),
    userPoint: null
  };

  function svgEl(tag, attrs = {}) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
    return el;
  }

  function colorFor(author) {
    return AUTHOR_COLORS[author] || "#7b878b";
  }

  function niceTicks(min, max, count = 6) {
    const span = max - min || 1;
    const raw = span / count;
    const power = 10 ** Math.floor(Math.log10(raw));
    const ratio = raw / power;
    const step = (ratio >= 5 ? 5 : ratio >= 2 ? 2 : 1) * power;
    const start = Math.ceil(min / step) * step;
    const ticks = [];
    for (let value = start; value <= max + step * 0.01; value += step) ticks.push(value);
    return ticks;
  }

  function initCompass() {
    const root = document.getElementById("poetry-compass");
    if (!root) return;

    const svg = document.getElementById("compass-plot");
    const loading = document.getElementById("compass-loading");
    const form = document.getElementById("compass-form");
    const textArea = document.getElementById("compass-text");
    const fileInput = document.getElementById("compass-file");
    const fileName = document.getElementById("compass-file-name");
    const submitButton = document.getElementById("compass-submit");
    const status = document.getElementById("compass-status");
    const results = document.getElementById("compass-results");
    const tooltip = document.getElementById("compass-tooltip");

    fetch(POINTS_URL)
      .then((response) => {
        if (!response.ok) throw new Error(`reference points: HTTP ${response.status}`);
        return response.json();
      })
      .then((data) => {
        state.points = data.points || [];
        if (state.points.length !== 1985) {
          throw new Error(`expected 1,985 reference poems; received ${state.points.length}`);
        }
        state.pointById = new Map(state.points.map((p) => [p.id, p]));
        buildLegend();
        renderPlot();
        loading.hidden = true;
      })
      .catch((error) => {
        loading.textContent = "could not load reference points";
        setStatus(`Could not load the compass: ${error.message}`, "error");
      });

    fileInput.addEventListener("change", async () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      if (file.size > 500000) {
        setStatus("That text file is too large for the browser input.", "error");
        fileInput.value = "";
        return;
      }
      try {
        textArea.value = await file.text();
        fileName.textContent = file.name;
        setStatus(`Loaded ${file.name}.`, "");
      } catch (error) {
        setStatus(`Could not read ${file.name}.`, "error");
      }
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const text = textArea.value.trim();
      if (!text) {
        setStatus("Paste or load a poem first.", "error");
        textArea.focus();
        return;
      }
      if (text.length > 200000) {
        setStatus("This work is over the 200,000-character service limit.", "error");
        return;
      }

      submitButton.disabled = true;
      submitButton.textContent = "plotting…";
      setStatus("Embedding in BGE-M3 and comparing against 1,985 poems. A cold model can take about 20 seconds.", "");

      try {
        const response = await fetch(`${API_URL}/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, neighbors: 10 })
        });

        if (!response.ok) {
          if (response.status === 504) throw new Error("The model timed out. Retry, or try a shorter work.");
          let message = `HTTP ${response.status}`;
          try {
            const body = await response.json();
            if (body && body.error) message = body.error;
          } catch (_) {}
          throw new Error(message);
        }

        const data = await response.json();
        state.userPoint = { pc1: Number(data.pc1), pc2: Number(data.pc2) };
        state.neighbors = Array.isArray(data.neighbors) ? data.neighbors : [];
        state.neighborById = new Map(state.neighbors.map((n) => [n.id, n]));

        renderPlot();
        renderResults(data);
        results.hidden = false;
        setStatus(`Plotted ${Number(data.token_count).toLocaleString()} tokens${data.chunk_count > 1 ? ` across ${data.chunk_count} chunks` : ""}.`, "success");
      } catch (error) {
        setStatus(error.message || "The Poetry Compass request failed.", "error");
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = "plot my poem";
      }
    });

    svg.addEventListener("pointermove", (event) => {
      const target = event.target.closest(".reference-point, .user-point");
      if (!target) {
        hideTooltip();
        return;
      }

      let title = "Your poem";
      let subtitle = "submitted work";
      let extra = "";

      if (target.classList.contains("reference-point")) {
        const id = target.dataset.poemId;
        const point = state.pointById.get(id);
        if (!point) return;
        title = point.title;
        subtitle = point.author;
        const neighbor = state.neighborById.get(id);
        if (neighbor) extra = ` · cosine ${Number(neighbor.cosine_similarity).toFixed(3)}`;
      }

      tooltip.textContent = `${title} — ${subtitle}${extra}`;
      const shellRect = svg.parentElement.getBoundingClientRect();
      tooltip.style.left = `${event.clientX - shellRect.left}px`;
      tooltip.style.top = `${event.clientY - shellRect.top}px`;
      tooltip.classList.add("show");
    });

    svg.addEventListener("pointerleave", hideTooltip);

    function hideTooltip() {
      tooltip.classList.remove("show");
    }

    function setStatus(message, kind) {
      status.textContent = message;
      status.classList.toggle("error", kind === "error");
      status.classList.toggle("success", kind === "success");
    }
  }

  function buildLegend() {
    const legend = document.getElementById("compass-legend");
    if (!legend) return;
    legend.textContent = "";

    const counts = new Map();
    state.points.forEach((point) => counts.set(point.author, (counts.get(point.author) || 0) + 1));
    [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .forEach(([author, count]) => {
        const item = document.createElement("span");
        item.className = "compass-legend-item";

        const swatch = document.createElement("span");
        swatch.className = "compass-legend-swatch";
        swatch.style.background = colorFor(author);

        const label = document.createElement("span");
        label.textContent = `${author} (${count})`;

        item.append(swatch, label);
        legend.appendChild(item);
      });
  }

  function renderPlot() {
    const svg = document.getElementById("compass-plot");
    if (!svg || !state.points.length) return;

    svg.textContent = "";
    state.circleById = new Map();

    const valuesX = state.points.map((p) => Number(p.pc1));
    const valuesY = state.points.map((p) => Number(p.pc2));
    if (state.userPoint) {
      valuesX.push(state.userPoint.pc1);
      valuesY.push(state.userPoint.pc2);
    }

    let xmin = Math.min(...valuesX);
    let xmax = Math.max(...valuesX);
    let ymin = Math.min(...valuesY);
    let ymax = Math.max(...valuesY);
    const xpad = (xmax - xmin || 1) * 0.055;
    const ypad = (ymax - ymin || 1) * 0.065;
    xmin -= xpad; xmax += xpad; ymin -= ypad; ymax += ypad;

    const plotW = CHART.width - CHART.left - CHART.right;
    const plotH = CHART.height - CHART.top - CHART.bottom;
    const sx = (x) => CHART.left + ((x - xmin) / (xmax - xmin)) * plotW;
    const sy = (y) => CHART.top + ((ymax - y) / (ymax - ymin)) * plotH;

    const xTicks = niceTicks(xmin, xmax, 7);
    const yTicks = niceTicks(ymin, ymax, 7);

    xTicks.forEach((value) => {
      const x = sx(value);
      svg.appendChild(svgEl("line", { x1: x, y1: CHART.top, x2: x, y2: CHART.top + plotH, class: value === 0 ? "compass-zero-line" : "compass-grid-line" }));
      const text = svgEl("text", { x, y: CHART.height - 29, "text-anchor": "middle", class: "compass-axis-text" });
      text.textContent = Number(value.toFixed(1));
      svg.appendChild(text);
    });

    yTicks.forEach((value) => {
      const y = sy(value);
      svg.appendChild(svgEl("line", { x1: CHART.left, y1: y, x2: CHART.left + plotW, y2: y, class: value === 0 ? "compass-zero-line" : "compass-grid-line" }));
      const text = svgEl("text", { x: CHART.left - 10, y: y + 4, "text-anchor": "end", class: "compass-axis-text" });
      text.textContent = Number(value.toFixed(1));
      svg.appendChild(text);
    });

    const xLabel = svgEl("text", { x: CHART.left + plotW / 2, y: CHART.height - 7, "text-anchor": "middle", class: "compass-axis-label" });
    xLabel.textContent = "PC1";
    svg.appendChild(xLabel);

    const yLabel = svgEl("text", { x: 15, y: CHART.top + plotH / 2, "text-anchor": "middle", class: "compass-axis-label", transform: `rotate(-90 15 ${CHART.top + plotH / 2})` });
    yLabel.textContent = "PC2";
    svg.appendChild(yLabel);

    const neighborIds = new Set(state.neighbors.map((n) => n.id));

    state.points.forEach((point) => {
      const isNeighbor = neighborIds.has(point.id);
      const circle = svgEl("circle", {
        cx: sx(Number(point.pc1)),
        cy: sy(Number(point.pc2)),
        r: isNeighbor ? 5.2 : 2.55,
        fill: colorFor(point.author),
        class: `reference-point${isNeighbor ? " nearest-point" : ""}`
      });
      circle.dataset.poemId = point.id;
      state.circleById.set(point.id, circle);
      svg.appendChild(circle);
    });

    if (state.userPoint) {
      const circle = svgEl("circle", {
        cx: sx(state.userPoint.pc1),
        cy: sy(state.userPoint.pc2),
        r: 7.2,
        class: "user-point"
      });
      svg.appendChild(circle);
    }
  }

  function renderResults(data) {
    const affinity = document.getElementById("compass-affinity");
    const neighbors = document.getElementById("compass-neighbors");
    if (!affinity || !neighbors) return;

    affinity.textContent = "";
    const affinities = Array.isArray(data.author_affinity) ? data.author_affinity : [];
    affinities.forEach((item) => {
      const li = document.createElement("li");
      li.className = "affinity-row";

      const name = document.createElement("span");
      name.className = "affinity-name";
      name.textContent = item.author;

      const value = document.createElement("span");
      value.className = "affinity-value";
      value.textContent = `${Number(item.affinity_percent).toFixed(1)}%`;

      const track = document.createElement("span");
      track.className = "affinity-track";
      const fill = document.createElement("span");
      fill.className = "affinity-fill";
      fill.style.setProperty("--affinity-width", `${Math.max(0, Math.min(100, Number(item.affinity_percent)))}%`);
      fill.style.setProperty("--affinity-color", colorFor(item.author));
      track.appendChild(fill);

      li.append(name, value, track);
      affinity.appendChild(li);
    });

    neighbors.textContent = "";
    state.neighbors.forEach((item) => {
      const li = document.createElement("li");
      li.className = "neighbor-item";

      const copy = document.createElement("span");
      copy.className = "neighbor-copy";

      const title = document.createElement("span");
      title.className = "neighbor-title";
      title.textContent = item.title;

      const author = document.createElement("span");
      author.className = "neighbor-author";
      author.textContent = item.author;

      const similarity = document.createElement("span");
      similarity.className = "neighbor-similarity";
      similarity.textContent = Number(item.cosine_similarity).toFixed(3);

      copy.append(title, author);
      li.append(copy, similarity);

      li.addEventListener("mouseenter", () => {
        const circle = state.circleById.get(item.id);
        if (circle) circle.classList.add("neighbor-focus");
      });
      li.addEventListener("mouseleave", () => {
        const circle = state.circleById.get(item.id);
        if (circle) circle.classList.remove("neighbor-focus");
      });

      neighbors.appendChild(li);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCompass);
  } else {
    initCompass();
  }
})();
