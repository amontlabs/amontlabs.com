# amontlabs.com

The website of Amont Labs: an independent software studio in Paris. One page: the live signature scene, Silo, about, contact.

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

## Silo data

`src/data/silo.json` holds Silo's latest release and repo stats. `scripts/update-silo-data.mjs` refreshes it from the GitHub API, and `.github/workflows/update-silo-data.yml` runs it hourly, on manual dispatch and on `repository_dispatch` (`silo-release`), committing as github-actions[bot] to main. The site shows the version and release date; stars appear only from 100 up (`STARS_MIN` in `src/pages/index.astro`). Downloads and forks are stored but never shown.

Optional instant refresh: Silo's release workflow can send `repository_dispatch` with `event_type: silo-release` to `amontlabs/amontlabs.com`, using a fine-grained token with Contents read/write on this repo stored as a secret in `amontlabs/silo`.

## Deployment

Vercel, static, on push to `main` (no adapter). `vercel.json` sets cache headers.
