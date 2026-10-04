#!/usr/bin/env node
// Frame times and scene lag during fast scrolling (needs `bun dev`, which exposes window.__sig).
//   node scripts/perf-scroll.mjs [--url http://localhost:4321/] [--w 1440] [--h 900]
import { spawn } from "node:child_process";

const a = Object.fromEntries(
  process.argv.slice(2).reduce((r, v, i, x) => (v.startsWith("--") ? [...r, [v.slice(2), x[i + 1]]] : r), []),
);
const W = +a.w || 1440,
  H = +a.h || 900,
  port = 9334 + Math.floor(Math.random() * 500);
const proc = spawn(
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  [
    "--headless=new",
    "--use-angle=metal",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=/tmp/cdp-perf-${port}`,
    "--no-first-run",
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
await send("Emulation.setDeviceMetricsOverride", {
  width: W,
  height: H,
  deviceScaleFactor: 1,
  mobile: false,
});
await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "dark" }] });
await send("Page.navigate", { url: a.url || "http://localhost:4321/" });
for (let i = 0; i < 60 && !(await ev("!!window.__sig")); i++) await sleep(500);
await sleep(2500);
await ev(
  `window.__log = []; (function f(t){ const s = window.__sig.state; window.__log.push([t, scrollY, s.jp * s.max]); requestAnimationFrame(f) })(performance.now()); 0`,
);
const wheel = (dy) =>
  send("Input.dispatchMouseEvent", { type: "mouseWheel", x: 400, y: 400, deltaX: 0, deltaY: dy });
for (let i = 0; i < 60; i++) {
  await wheel(80);
  await sleep(16);
} // down fast
for (let i = 0; i < 60; i++) {
  await wheel(-80);
  await sleep(16);
} // and back
await sleep(500);
const log = await ev("JSON.stringify(window.__log)");
const L = JSON.parse(log);
const dts = L.slice(1)
  .map((r, i) => r[0] - L[i][0])
  .sort((x, y) => x - y);
const q = (f) => dts[Math.floor(f * (dts.length - 1))].toFixed(1);
const lag = L.map((r) => Math.abs(r[1] - r[2]));
const moving = L.filter((r, i) => i && Math.abs(r[1] - L[i - 1][1]) > 1).map((r) => Math.abs(r[1] - r[2]));
console.log(
  JSON.stringify({
    frames: L.length,
    dt_ms: { p50: q(0.5), p95: q(0.95), p99: q(0.99), max: dts.at(-1).toFixed(1) },
    dropped_gt25ms: dts.filter((d) => d > 25).length,
    lag_px_moving: {
      mean: Math.round(moving.reduce((s, v) => s + v, 0) / (moving.length || 1)),
      max: Math.round(Math.max(0, ...moving)),
    },
  }),
);
proc.kill();
process.exit(0);
