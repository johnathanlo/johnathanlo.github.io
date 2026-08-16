(() => {
  const root = document.documentElement;
  const key = 'jl-theme';
  const stored = localStorage.getItem(key);
  if (stored === 'dark' || stored === 'light') root.dataset.theme = stored;

  const button = document.querySelector('.theme-toggle');
  if (button) {
    button.addEventListener('click', () => {
      const current = root.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      const next = current === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next;
      localStorage.setItem(key, next);
    });
  }

  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
})();
