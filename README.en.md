# Qualia2FA documentation

Documentation for Qualia2FA and its six libraries, built with [VitePress](https://vitepress.dev/) and published at <https://qualia2fa.github.io>.

Chinese version: [README.md](README.md).

## Local development

Node.js 20 or newer is required.

```bash
npm install
npm run dev       # http://localhost:5173
```

Build and preview the production output:

```bash
npm run build
npm run preview
```

## Site layout

```text
.
├── .vitepress/
│   ├── config.mts          site config, bilingual navigation, language detection
│   └── theme/              navigation language switcher and styles
├── public/                 static assets (logo, robots.txt, ...)
├── index.md                Chinese home page
├── guide/                  Chinese overview and build guide
├── repos/                  Chinese pages for the seven repositories
├── en/                     the English counterparts
└── .github/workflows/      GitHub Pages deployment
```

Chinese pages live at the root (`/`), English pages under `/en/`. The two trees mirror each other; add a page to both when adding one.

## Languages

- The site is Simplified Chinese by default; `/en/` is English.
- On the first visit, a small script in the page head reads `navigator.languages`, picks Chinese or English and redirects to that locale. The check runs once per session.
- The switcher at the top right (inside the menu on mobile) offers **简体中文**, **English** and **Follow browser language**. A manual choice is stored in `localStorage` and stops automatic redirects.
- The switcher maps paths between locales: `/repos/core/` ↔ `/en/repos/core/`.

When editing content:

- Keep chapters, code, version numbers and links identical between the two languages.
- Use relative links ending in `.md` for internal pages; VitePress checks for dead links during the build.
- Version numbers on the pages must match the tags and manifests in each repository; update them together with a release.
- Never put secret material, tokens or local paths in the documentation.

## Deployment

A push to `main` triggers `.github/workflows/deploy.yml`: it installs dependencies, builds, uploads `.vitepress/dist`, and GitHub Pages publishes it. The repository's Pages source must be set to **GitHub Actions**.

This is the user-site repository (`qualia2fa.github.io`), so the build uses `base: /` and needs no CNAME. The repository currently has the custom domain `qualia2fa.qiushui1012.com`; `qualia2fa.github.io` redirects to it with a 301, and HTTPS is enforced.

## Licence

The documentation follows the project: the application is Apache-2.0, and the Rust libraries are LGPL-3.0-or-later.
