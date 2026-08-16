# Johnathan Lo — GitHub Pages personal site

A complete static academic website built from the supplied CV. It uses plain HTML/CSS/JavaScript, so there is no build step and no dependency manager.

## Files

- `index.html` — main personal/research site
- `cv.html` — full web CV with print / Save as PDF support
- `styles.css` — responsive design + print styles + dark mode
- `script.js` — theme toggle and footer year
- `assets/favicon.svg` — JL monogram favicon
- `404.html` — custom not-found page
- `.nojekyll` — tells GitHub Pages to serve the static files directly

## Publish as your GitHub personal site

1. Create a GitHub repository named exactly `<YOUR_GITHUB_USERNAME>.github.io`.
2. Put all files in this folder at the root of that repository.
3. Commit and push to the repository's default branch (normally `main`).
4. In the repository, open **Settings → Pages**.
5. Under **Build and deployment**, choose **Deploy from a branch**, select your publishing branch, and choose `/(root)`.
6. Save. GitHub Pages will publish the site at `https://<YOUR_GITHUB_USERNAME>.github.io/`.

## Local preview

From this directory:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Recommended edits before publishing

- Add GitHub, Google Scholar, ORCID, lab, and/or LinkedIn links if you want them displayed.
- Update publications or research text as your CV changes.
- Add a professional photo only if you want one; the current design does not require a headshot.
- The public site intentionally omits the street address and phone number that were present in the source CV.

## Optional custom domain

If you own a domain, configure it under **Settings → Pages → Custom domain**. GitHub can manage the repository `CNAME` entry when publishing from a branch.
