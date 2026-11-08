# amontlabs.com

The website of Amont Labs. One page: the live signature scene, Silo, about, contact.

## Stack

Astro 7 (static), TypeScript, plain CSS with design tokens, Three.js r186, Bun, Biome. No UI libraries, no Tailwind, no tracking. Fonts (Geist, Geist Mono, Newsreader) are self-hosted WOFF2, subset to Latin.

## Commands

```sh
bun install
bun dev            # http://localhost:4321
bun run build      # static output in dist/
bun run preview
bun run lint       # biome check .
bun run format
```

## The signature scene

The hero is a WebGL scene (a point-cloud mountain with a Fonte river). It is generated in the `amontlabs/amont` repo (`scripts/make_signature_from_image.py`, with `scripts/make_signature_data.py`); its runtime and baked data come from `site/signature/` there.

- `src/scripts/signature.js`: the scene module (Three.js), loaded as a separate chunk after the page is idle.
- `public/signature/*.bin`, `meta.json`: the baked geometry.
- `src/assets/signature/poster-{dark,light}.png`: the posters (the LCP), converted to AVIF/WebP by Astro. Regenerate them from the live scene with `bun dev` running, then `node scripts/make-posters.mjs`.
- `public/og.png`: the Open Graph image (1200x630).

## Scroll choreography

The scene is one fixed full-viewport layer (`.scene`, z-index -1) behind the whole page; sections have no backgrounds. The page has no footer: it ends with the About section, and the journey ends there with the river converging on the source. Scrolling is the journey upstream, native scroll, no jacking. `Hero.astro` feeds scroll position to the scene (`setScroll`) and the screen position where the source should land at the end (`setSourceTarget`: beside the About definition like a footnote marker, above it on narrow screens).

In `src/scripts/signature.js` the `J` object holds the tuning: progress `p` (0 top, 1 bottom) and `h` (scrollY / viewport height) are smoothed with a critically damped direct read of scrollY each frame (no spring; `J.smooth` only smooths the scroll velocity that drives river speed). `p` drives a dolly toward a point travelling up the river centreline (`J.dolly`, `J.path`), a pan that lands the source on its target, the river narrowing to a thread and its lower part fading (`uConv`), and a larger, calmer source. `h` drives terrain dimming and thinning while text is on screen (`J.dimText`, `J.keepText`), then nearly gone at the end of the page (`J.dimEnd`, `J.keepEnd`), and the removal of the hero's bottom fade (`uBotFade`). River flow speed follows scroll velocity slightly. Soft page-colour scrims behind text blocks are at the end of `src/styles/global.css`. Reduced motion or no WebGL: the poster stays fixed and is dimmed by a CSS scroll timeline; three.js is not loaded.

## Scroll

Page scroll is native. The scene follows the scroll position through a critically damped spring (`J.follow`, 0.35 s), so the background glides while the content stays under the finger.

## Project data

`src/data/projects.json` holds, for Silo, Sic, Fjord, LCU and lastdrop, the latest app release (tags `vX.Y.Z`; Silo's `engine-` and `guest-` tags are skipped), its date, stars and forks. `scripts/update-projects-data.mjs` refreshes it from the GitHub API (keeping the last known values for a repo it can't reach), and `.github/workflows/update-projects-data.yml` runs it hourly, on manual dispatch and on `repository_dispatch` (`silo-release` or `release`), committing as github-actions[bot] to main. Each exhibit shows the version, release date, stars and forks; a project without a release or stars shows no stats line.

Optional instant refresh: a project's release workflow can send `repository_dispatch` with `event_type: release` (Silo already uses `silo-release`) to `amontlabs/amontlabs.com`, using a fine-grained token with Contents read/write on this repo stored as a secret in the project's repo.

## Deployment

Vercel, static, on push to `main` (no adapter). `vercel.json` sets cache headers.

## Theme

System, Light or Dark from the switch top right; stored in localStorage (`theme`), applied before first paint by an inline script in `src/layouts/Base.astro` (no flash).

## Header

Fixed, three columns: logo left, the theme switch at the true centre, contact icons right (email, GitHub, X: hand-drawn hairline SVG in the switch's pill, label below on hover or focus). A scroll-driven fade of the page colour (tokens) appears behind it after the first 120px; anchors use `scroll-margin-top`.

## Pages

`/` (the site) and `/legal` (legal notice, noindex, linked discreetly from the bottom of the home page).
