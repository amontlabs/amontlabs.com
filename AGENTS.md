# AGENTS.md

Context for the amontlabs.com site. Brand, decisions and the founder's taste live in the `amontlabs/amont` repo (`AGENTS.md`, `brand/README.md`): read them before changing anything visual or written.

## Content rules

- Every word earns its place. Plain, factual copy. No taglines, no marketing words, no invented stats.
- Only Silo is shown. Never invent screenshots or UI mockups: Silo's visual is typography and space.
- The only sign-off is "En amont."; it is the last text on the page.
- Visible labels stay minimal (Products, About). No version numbers hardcoded: they come from `src/data/silo.json`.
- Show stars only from `STARS_MIN` (100). Never show downloads or forks. Never show anything that looks small or empty.
- Hero sentence is the meta description; keep both in sync (`Base.astro`, `Hero.astro`).

## Design decisions

- Light and dark follow `prefers-color-scheme`; no toggle. Tokens in `src/styles/tokens.css` are copied from `amont/brand/colors/colors.css` (semantic names). Fonte is the only accent; `--link` is fonte-text on light.
- Type: Geist 400/500, Geist Mono for metadata, Newsreader only for the definition and sign-off.
- Zero JS except the hero loader (`Hero.astro`): after load and idle it checks WebGL2 and not reduced-motion, then dynamically imports the scene (separate chunk). Poster first (LCP), canvas fades in over it. Rendering pauses off-screen (in the scene).
- Reduced motion: poster only, three.js never loads.
- The scene is fixed behind the whole page and driven by scroll (dolly up the river to the source, terrain dims for text, the source lands above "En amont."). Tuning in the `J` object of `signature.js`; details in README. Keep text legible at every scroll position in both themes (scrims at the end of `global.css`); no horizontal overflow (it zooms out mobile browsers).
- Scene framing: `fit: cover`, anchor from CSS vars `--ax/--ay` on `.scene` (summit headroom; portrait pans toward the source). The poster uses the same vars as `object-position`.
- `signature.js` is the scene from the amont repo with: `three` imported from npm, data from `/signature/`, no orbit/dev camera, an `intro` option (off here), and the source glow fixed on light (smooth halo, no pale ring). Do not change its look.

## Updating the scene

Regenerate data in `amontlabs/amont`, copy `site/signature/data/img-meta.json` to `public/signature/meta.json` and `img-terrain-hi|lo.bin`, `img-river.bin` to `public/signature/{terrain-hi,terrain-lo,river}.bin`; port any `signature.js` change by hand, then run `node scripts/make-posters.mjs` (dev server up) and rebuild `public/og.png`.

## Tooling

`scripts/shoot.mjs` screenshots with headless Chrome (CDP; waits for WebGL). Proof screenshots go in `.proof/` (gitignored). Biome ignores `.astro` files and `signature.js`.

## Silo exhibit and smooth scroll

- Lenis drives scroll; it is advanced by the scene's frame (`setPreFrame`). Keep scroll coupling at zero lag (`scripts/perf-scroll.mjs` measures it). Keyboard and anchors stay native.
- The Silo exhibit is one visual: the transparent product windows from the silo repo (`docs/silo-showcase-screens.webp`; never invented or edited here; it syncs through `scripts/update-silo-data.mjs`, see README). No frame or panel; the transparent margin is cancelled in `sections.css` (`.shot img`). The name "Silo" stands above it.
- Layout: 12-column grid, labels in the left rail, content from column 5, 8px rhythm (`src/styles/sections.css`). Links keep a 44px hit area. The footer is the final frame: the source glow lands above "En amont.".

## Theme switch

Top right, System / Light / Dark (`ThemeSwitch.astro`, styles at the end of `global.css`). An inline script in `Base.astro` sets `data-theme` (resolved) and `data-pref` on `<html>` before first paint from localStorage (`theme`, absent = system) and follows `prefers-color-scheme` live. Tokens key on `:root[data-theme]` (media query only as the no-JS fallback). Switching uses the View Transitions API for a 500ms crossfade of page and scene (instant where unsupported or under reduced motion); the scene gets `setTheme` on the `themechange` event, no re-mount. Poster `<source data-theme>` media are rewritten by the same script. Any new colour rule must key on `data-theme`, not `prefers-color-scheme`.
