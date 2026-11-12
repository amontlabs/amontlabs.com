#!/usr/bin/env bun
// Render the Open Graph image (public/og.png, 1200x630) from the site's own pieces: the scene poster, the logo,
// the hero sentence (the meta description) and the featured projects with their colours. No dev server needed.
// Drawn at 2x in Playwright's bundled Chromium (never the installed Google Chrome), then downsampled.
//   bun scripts/make-og.mjs [--theme dark|light] [--out public/og.png] [--keep-2x]
import { execFileSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "/Users/polarzero/.bun/install/global/node_modules/playwright/index.mjs";
import { items, others } from "../src/data/items.ts";

const a = Object.fromEntries(
  process.argv
    .slice(2)
    .reduce(
      (r, v, i, x) =>
        v.startsWith("--") ? [...r, [v.slice(2), x[i + 1]?.startsWith("--") ? true : (x[i + 1] ?? true)]] : r,
      [],
    ),
);
const theme = a.theme === "light" ? "light" : "dark";
const root = path.resolve(import.meta.dir, "..");
const out = path.resolve(root, a.out && a.out !== true ? a.out : "public/og.png");
const f = (p) => `file://${path.join(root, p)}`;

// the hero sentence is the meta description (Base.astro); read it so the card never drifts from the page
const base = readFileSync(path.join(root, "src/layouts/Base.astro"), "utf8");
const sentence = base.match(/description = "([^"]+)"/)[1];

// the featured projects, in the activity panel's order, with its colours (Journal.astro)
const journal = readFileSync(path.join(root, "src/components/Journal.astro"), "utf8");
const ORDER = JSON.parse(journal.match(/const ORDER = (\[[^\]]+\])/)[1]);
const colors = {
  light: ["#0f9ac3", "#eb6834", "#6250d6", "#eda100", "#e87ba4", "#008300"],
  dark: ["#0f9ac3", "#d95926", "#9085e9", "#c98500", "#d55181", "#008300"],
}[theme];
const projects = ORDER.map((id, i) => ({
  name: items.find((x) => x.id === id)?.name ?? (others[id] ? id[0].toUpperCase() + id.slice(1) : id),
  color: colors[i],
}));

const T = {
  dark: { bg: "#101418", text: "#f7f8f5", secondary: "#a3aab0", line: "#2a3138" },
  light: { bg: "#f7f8f5", text: "#101418", secondary: "#5c636a", line: "#dcdfd9" },
}[theme];
const logo = readFileSync(path.join(root, "src/assets/logo/amont-superscript.svg"), "utf8")
  .replace(/<title>.*?<\/title>/, "")
  .replace(/width="\d+" height="\d+"/, 'height="40"')
  .replaceAll("#101418", T.text);

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: Geist; font-weight: 400; src: url(${f("src/assets/fonts/geist-400.woff2")}); }
@font-face { font-family: Geist; font-weight: 500; src: url(${f("src/assets/fonts/geist-500.woff2")}); }
@font-face { font-family: "Geist Mono"; font-weight: 400; src: url(${f("src/assets/fonts/geist-mono-400.woff2")}); }
* { margin: 0; box-sizing: border-box; }
html, body { width: 1200px; height: 630px; overflow: hidden; background: ${T.bg}; color: ${T.text}; font-family: Geist, sans-serif; }
.scene { position: absolute; left: 330px; top: 4px; width: 1110px; height: 740px; }
.scene img { width: 100%; height: 100%; display: block; }
/* the page colour, feathered over the left of the scene so the sentence reads (no visible box) */
.fade { position: absolute; inset: 0; background:
  linear-gradient(90deg, ${T.bg} 0%, ${T.bg} 30%, ${T.bg}cc 48%, ${T.bg}00 72%),
  linear-gradient(0deg, ${T.bg} 0%, ${T.bg}00 30%); }
.logo { position: absolute; left: 72px; top: 64px; display: block; }
.logo svg { display: block; }
h1 { position: absolute; left: 72px; bottom: 146px; width: 780px; font-weight: 500; font-size: 62px; line-height: 1.06;
  letter-spacing: -0.035em; text-wrap: balance; }
.projects { position: absolute; left: 72px; right: 72px; bottom: 64px; display: flex; align-items: center; gap: 30px;
  padding-top: 26px; border-top: 1px solid ${T.line}; font-size: 21px; font-weight: 500; letter-spacing: -0.01em; }
.projects span { display: inline-flex; align-items: center; gap: 11px; }
.projects i { width: 11px; height: 11px; border-radius: 2px; display: block; }
.url { margin-left: auto; font-family: "Geist Mono", monospace; font-weight: 400; font-size: 17px; color: ${T.secondary}; letter-spacing: 0; }
</style></head><body>
<div class="scene"><img src="${f(`src/assets/signature/poster-${theme}.png`)}"></div>
<div class="fade"></div>
<div class="logo">${logo}</div>
<h1>${sentence}</h1>
<div class="projects">${projects.map((p) => `<span><i style="background:${p.color}"></i>${p.name}</span>`).join("")}<span class="url">amontlabs.com</span></div>
</body></html>`;

const tmp = path.join(root, ".proof/og.html");
writeFileSync(tmp, html);
const browser = await chromium.launch({
  executablePath:
    "/Users/polarzero/Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell",
  args: ["--allow-file-access-from-files"],
});
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 });
await page.goto(`file://${tmp}`, { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);
const big = out.replace(/\.png$/, "@2x.png");
await page.screenshot({ path: big });
await browser.close();
execFileSync("sips", ["-z", "630", "1200", big, "--out", out], { stdio: "ignore" });
if (!a["keep-2x"]) rmSync(big);
console.log(out);
