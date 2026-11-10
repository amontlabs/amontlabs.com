# AGENTS.md

Context for the amontlabs.com site. Brand, decisions and the founder's taste live in the `amontlabs/amont` repo (`AGENTS.md`, `brand/README.md`): read them before changing anything visual or written.

## Content rules

- Every word earns its place. Plain, factual copy. No taglines, no marketing words, no invented stats.
- Products section (`Products.astro`, styles at the end of `sections.css`): the left rail holds the label and a sticky index (01 Silo, 02 Fjord, 03 Sic; Tools: 04 LCU, 05 lastdrop), each entry with its one-line description, then tags: categories (outlined) from one shared vocabulary (Agents, Security, Dev tools, Computer use, Public goods; reuse before adding) and the integrations it needs (filled: T3 Code, Claude Code). Platforms are icons in the stats row, not tags. Only list a platform the project's README says works today (Silo: macOS only until its Linux daemon ships). Below 1200px the page is one column and the rail is hidden; each exhibit shows its description, tags and stats under its title (a sticky chips bar and then a chips island were tried there and rejected as messy). It lights the last project whose top has passed the reading line, 45% down (gaps between exhibits count for the one above; an IntersectionObserver triggers the check, no scroll handler), and jumps to it. Content from column 5: one exhibit per project (title, film, description, meta, links); the tools use the same exhibit after a Tools divider, with status Released. Previews are muted and only the most visible film plays; clicking a film opens the viewer (`<dialog class="pv">`: `*-full.mp4` with sound, scrubber, fullscreen, prev/next, Esc), grown from the card with a view transition. Fjord has no film: its slot is an open frame onto the river with its sentence. Films are the projects' own (Sic: `sic/promo/out/v6`), re-encoded into `public/media/` (previews: muted H.264, 1280w for products, 854w for tools; posters: WebP 640/1280 made with sharp, since this ffmpeg has no libwebp). Never invent screenshots or UI mockups.
- Performance rules: no animation-frame loops in page scripts. Progress bars are Web Animations synced to the video clock on play/pause/seek. No `backdrop-filter` over video or the scene. The scene stops rendering while the viewer is open (`px:viewer` → `setRunning`), and `Hero.astro` steps its pixel ratio down (2 → 1.5 → 1.25) if real frame times can't hold the display's refresh rate (`setDprCap`); machines that keep up never change.
- No sign-off and no footer: "En amont." was removed from the site at the founder's request. The page ends with the About section.
- Visible labels stay minimal (Products, Tools). Each rail entry (and, on phones, each exhibit) has a stats row: kind icon (app, CLI, website) and platform icons (macOS, Linux, Windows; what it supports), then the latest release and its date, stars and forks from `src/data/projects.json` (synced hourly, see README). Stars and forks show for every project, zeros included; a project with no release leaves that column empty. Links carry icons (globe: website, GitHub mark: repo; `Icon.astro`). No hardcoded versions or counts, no details line in prose. Never show downloads.
- Hero sentence is the meta description; keep both in sync (`Base.astro`, `Hero.astro`).

## Design decisions

- Light and dark follow `prefers-color-scheme`; no toggle. Tokens in `src/styles/tokens.css` are copied from `amont/brand/colors/colors.css` (semantic names). Fonte is the only accent; `--link` is fonte-text on light.
- Type: Geist 400/500, Geist Mono for metadata, Newsreader only for the definition and sign-off.
- JS only for the hero loader (`Hero.astro`) and the products index/monitor (`Products.astro`): after load and idle it checks WebGL2 and not reduced-motion, then dynamically imports the scene (separate chunk). Poster first (LCP), canvas fades in over it. Rendering pauses off-screen (in the scene).
- Reduced motion: poster only, three.js never loads.
- The scene is fixed behind the whole page and driven by scroll (dolly up the river to the source, terrain dims for text, the source lands beside the About definition at the end of the page). Tuning in the `J` object of `signature.js`; details in README. Keep text legible at every scroll position in both themes (scrims at the end of `global.css`); no horizontal overflow (it widens the page on phones and tablets). The scrims reach 56px past their text, so `main` clips horizontally, and the fixed header clips its own hidden tooltips.
- Scene framing: `fit: cover`, anchor from CSS vars `--ax/--ay` on `.scene` (summit headroom; portrait pans toward the source). The poster uses the same vars as `object-position`.
- `signature.js` is the scene from the amont repo with: `three` imported from npm, data from `/signature/`, no orbit/dev camera, an `intro` option (off here), and the source glow fixed on light (smooth halo, no pale ring). Do not change its look.

## Updating the scene

Regenerate data in `amontlabs/amont`, copy `site/signature/data/img-meta.json` to `public/signature/meta.json` and `img-terrain-hi|lo.bin`, `img-river.bin` to `public/signature/{terrain-hi,terrain-lo,river}.bin`; port any `signature.js` change by hand, then run `node scripts/make-posters.mjs` (dev server up) and rebuild `public/og.png`.

## Tooling

`scripts/shoot.mjs` screenshots with headless Chrome (CDP; waits for WebGL). Proof screenshots go in `.proof/` (gitignored). Biome ignores `.astro` files and `signature.js`.

## Silo exhibit and scroll

- Scroll is native (no Lenis or scroll hijacking). Only the scene is smoothed: it follows `scrollY` through a critically damped spring (`J.follow` in `signature.js`, snapped under reduced motion), so text moves crisply and the background glides after it.
- Layout: 12-column grid, labels in the left rail, content from column 5, 8px rhythm (`src/styles/sections.css`). Links keep a 44px hit area. The page ends with About (`main` bottom padding); the source glow lands beside the definition (measured from `.def` in `Hero.astro`).

## Theme switch

Top right, System / Light / Dark (`ThemeSwitch.astro`, styles at the end of `global.css`). An inline script in `Base.astro` sets `data-theme` (resolved) and `data-pref` on `<html>` before first paint from localStorage (`theme`, absent = system) and follows `prefers-color-scheme` live. Tokens key on `:root[data-theme]` (media query only as the no-JS fallback). Switching uses the View Transitions API for a 500ms crossfade of page and scene (instant where unsupported or under reduced motion); the scene gets `setTheme` on the `themechange` event, no re-mount. Poster `<source data-theme>` media are rewritten by the same script. Any new colour rule must key on `data-theme`, not `prefers-color-scheme`.

## Header

One fixed pill, top right (`.ctl` in `Header.astro`): theme switch | contact links (`HeaderLinks.astro`: email, GitHub, X; labels on hover/focus; aria-labelled), with a hairline separator between them. Only the outer pill has an outline. It is solid page colour, since content scrolls under it. There is no band behind it, and the bar around it lets clicks through. The logo is not fixed: it sits at the top of the page (`.top-logo`, same padding as the header, above it for clicks) and scrolls away. A full-width fade band, a logo tile, a centred capsule holding everything, a full-width pill and two separate islands were all tried and rejected. Do not target header children by `:nth-child` (the switch ships an inline script element); use classes.

Header tooltips are real `.tip` spans (centred under their icon, nudged inward by `__fitTip` only at the viewport edge). The fixed header clips horizontally so hidden tooltips never widen the page on phones. The email control is a button that copies hello@amontlabs.com (clipboard API, textarea fallback; cmd/ctrl+click opens mailto; tooltip says Copied for 1.6 s; aria-live announces it). GitHub and X tooltips show the handle (@amontlabs). `scripts/tips.mjs` checks alignment and the copy in headless Chrome.

## Legal page

`/legal` (`src/pages/legal.astro`): plain page, noindex, same header, no scene. The sentence "no cookies, no analytics and no third-party services" was verified (every request on `/` and `/legal` is same-origin); re-verify if anything external is ever added (fonts, analytics, embeds) and change the page if so. The page remains accessible at `/legal` directly (no visible UI button needed by law). There is no sitemap or robots.txt.

## Final frame

The page ends with `.finale` as a natural ending section after the products (margin-top: var(--section), padding-bottom: 120px; not vertically centered in a 100svh viewport). The definition sits on the columns used above (column 5 onward); the river's source lands just left of its first word (`Hero.astro` measures `.def`). There is no About label (a visually hidden h2 names the section).
