#!/usr/bin/env node
// Screenshot a URL with headless Chrome over raw CDP (WebGL needs real time: --wait).
//   node scripts/shoot.mjs --url http://localhost:4321 --w 1440 --h 900 --scheme dark --wait 4000 --out .proof/a.png [--full] [--scroll 900] [--dpr 1]
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const a = Object.fromEntries(
  process.argv
    .slice(2)
    .reduce(
      (r, v, i, x) =>
        v.startsWith("--")
          ? [...r, [v.slice(2), x[i + 1]?.startsWith("--") || x[i + 1] === undefined ? true : x[i + 1]]]
          : r,
      [],
    ),
);
const W = +a.w || 1440,
  H = +a.h || 900,
  port = 9334 + Math.floor(Math.random() * 500);
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const proc = spawn(
  CHROME,
  [
    "--headless=new",
    "--use-angle=metal",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=/tmp/cdp-site-${port}`,
    "--no-first-run",
    "--hide-scrollbars",
    "about:blank",
  ],
  { stdio: "ignore" },
);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let t;
for (let i = 0; i < 50; i++) {
  try {
    t = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json();
    break;
  } catch {
    await sleep(200);
  }
}
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const p = {};
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (p[d.id]) {
    p[d.id](d);
    delete p[d.id];
  }
};
const send = (method, params = {}) =>
  new Promise((r) => {
    const i = ++id;
    p[i] = r;
    ws.send(JSON.stringify({ id: i, method, params }));
  });
const ev = async (e) =>
  (await send("Runtime.evaluate", { expression: e, awaitPromise: true, returnByValue: true })).result.result
    ?.value;
await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", {
  width: W,
  height: H,
  deviceScaleFactor: +a.dpr || 1,
  mobile: W < 700,
});
await send("Emulation.setEmulatedMedia", {
  features: [
    { name: "prefers-color-scheme", value: a.scheme || "light" },
    { name: "prefers-reduced-motion", value: a.reduced ? "reduce" : "no-preference" },
  ],
});
await send("Page.navigate", { url: a.url || "http://localhost:4321/" });
await sleep(+a.wait || 3000);
if (a.scroll) {
  await ev(`scrollTo(0, ${+a.scroll})`);
  await sleep(800);
}
let params = { format: "png" };
if (a.full) {
  const h = await ev("document.documentElement.scrollHeight");
  params = {
    format: "png",
    captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: W, height: h, scale: 1 },
  };
}
const r = await send("Page.captureScreenshot", params);
mkdirSync(path.dirname(a.out), { recursive: true });
writeFileSync(a.out, Buffer.from(r.result.data, "base64"));
if (a.eval) console.log(await ev(a.eval));
proc.kill();
process.exit(0);
