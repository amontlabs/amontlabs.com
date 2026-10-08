# AGENTS.md

Context for the amontlabs.com site. Brand, decisions and the founder's taste live in the `amontlabs/amont` repo (`AGENTS.md`, `brand/README.md`): read them before changing anything visual or written.

## Content rules

- Every word earns its place. Plain, factual copy. No taglines, no marketing words, no invented stats.
- Products shown: Silo and LCU. Never invent screenshots or UI mockups: Silo shows its real windows from the silo repo; LCU is text only (name and placard).
- No sign-off and no footer: "En amont." was removed from the site at the founder's request. The page ends with the About section.
- Visible labels stay minimal (Products, About). No version numbers hardcoded: they come from `src/data/silo.json`.
- Show stars only from `STARS_MIN` (100). Never show downloads or forks. Never show anything that looks small or empty.
- Hero sentence is the meta description; keep both in sync (`Base.astro`, `Hero.astro`).

## Design decisions

- Light and dark follow `prefers-color-scheme`; no toggle. Tokens in `src/styles/tokens.css` are copied from `amont/brand/colors/colors.css` (semantic names). Fonte is the only accent; `--link` is fonte-text on light.
- Type: Geist 400/500, Geist Mono for metadata, Newsreader only for the definition and sign-off.
- Zero JS except the hero loader (`Hero.astro`): after load and idle it checks WebGL2 and not reduced-motion, then dynamically imports the scene (separate chunk). Poster first (LCP), canvas fades in over it. Rendering pauses off-screen (in the scene).
- Reduced motion: poster only, three.js never loads.
- The scene is fixed behind the whole page and driven by scroll (dolly up the river to the source, terrain dims for text, the source lands beside the About definition at the end of the page). Tuning in the `J` object of `signature.js`; details in README. Keep text legible at every scroll position in both themes (scrims at the end of `global.css`); no horizontal overflow (it zooms out mobile browsers).
- Scene framing: `fit: cover`, anchor from CSS vars `--ax/--ay` on `.scene` (summit headroom; portrait pans toward the source). The poster uses the same vars as `object-position`.
- `signature.js` is the scene from the amont repo with: `three` imported from npm, data from `/signature/`, no orbit/dev camera, an `intro` option (off here), and the source glow fixed on light (smooth halo, no pale ring). Do not change its look.

## Updating the scene

Regenerate data in `amontlabs/amont`, copy `site/signature/data/img-meta.json` to `public/signature/meta.json` and `img-terrain-hi|lo.bin`, `img-river.bin` to `public/signature/{terrain-hi,terrain-lo,river}.bin`; port any `signature.js` change by hand, then run `node scripts/make-posters.mjs` (dev server up) and rebuild `public/og.png`.

## Tooling

`scripts/shoot.mjs` screenshots with headless Chrome (CDP; waits for WebGL). Proof screenshots go in `.proof/` (gitignored). Biome ignores `.astro` files and `signature.js`.

## Silo exhibit and smooth scroll

- Lenis drives scroll; it is advanced by the scene's frame (`setPreFrame`). Keep scroll coupling at zero lag (`scripts/perf-scroll.mjs` measures it). Keyboard and anchors stay native.
- The Silo exhibit is one visual: the transparent product windows from the silo repo (`docs/silo-showcase-screens.webp`; never invented or edited here; it syncs through `scripts/update-silo-data.mjs`, see README). No frame or panel; the transparent margin is cancelled in `sections.css` (`.shot img`). The name "Silo" stands above it.
- Layout: 12-column grid, labels in the left rail, content from column 5, 8px rhythm (`src/styles/sections.css`). Links keep a 44px hit area. The page ends with About (`main` bottom padding); the source glow lands beside the definition (measured from `.def` in `Hero.astro`).

## Theme switch

Top right, System / Light / Dark (`ThemeSwitch.astro`, styles at the end of `global.css`). An inline script in `Base.astro` sets `data-theme` (resolved) and `data-pref` on `<html>` before first paint from localStorage (`theme`, absent = system) and follows `prefers-color-scheme` live. Tokens key on `:root[data-theme]` (media query only as the no-JS fallback). Switching uses the View Transitions API for a 500ms crossfade of page and scene (instant where unsupported or under reduced motion); the scene gets `setTheme` on the `themechange` event, no re-mount. Poster `<source data-theme>` media are rewritten by the same script. Any new colour rule must key on `data-theme`, not `prefers-color-scheme`.

## Header

Fixed grid header: logo | theme switch (true centre) | contact icons (`HeaderLinks.astro`, same `.tsw` pill language; email, GitHub, X; labels on hover/focus; aria-labelled). The page-colour fade behind it is `.top::before`, driven by a CSS scroll timeline. Do not target header children by `:nth-child` (the switch ships an inline script element); use classes.

Header tooltips are real `.tip` spans (centred under their icon, nudged inward by `__fitTip` only at the viewport edge). The email control is a button that copies hello@amontlabs.com (clipboard API, textarea fallback; cmd/ctrl+click opens mailto; tooltip says Copied for 1.6 s; aria-live announces it). GitHub and X tooltips show the handle (@amontlabs). `scripts/tips.mjs` checks alignment and the copy in headless Chrome.

## Legal page

`/legal` (`src/pages/legal.astro`): plain page, noindex, same header, no scene. The sentence "no cookies, no analytics and no third-party services" was verified (every request on `/` and `/legal` is same-origin); re-verify if anything external is ever added (fonts, analytics, embeds) and change the page if so. The home page links to it with one tiny "Legal" at the very bottom, in the padding below About (do not make it more prominent, and keep it out of the header). There is no sitemap or robots.txt.

## Final frame

The page ends with `.finale`: exactly `min-height: 100svh`, nothing after it. The definition is vertically centred on the columns used above; the river's source lands just left of its first word (`Hero.astro` measures `.def`). "Legal" is absolutely positioned inside the frame's bottom edge (adds no height). There is no About label (a visually hidden h2 names the section). Placement b (definition in the lower third) was tried and rejected: a looks calmer.
