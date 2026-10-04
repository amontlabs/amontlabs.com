#!/usr/bin/env node
// Render the posters (src/assets/signature/poster-{dark,light}.png) from the live scene with headless Chrome.
// Needs the dev server running (bun dev) and WebGL; the scene exposes window.__sig in dev only.
//   node scripts/make-posters.mjs [--url http://localhost:4321/] [--size 3840x2560]
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";

const a = Object.fromEntries(
  process.argv.slice(2).reduce((r, v, i, x) => (v.startsWith("--") ? [...r, [v.slice(2), x[i + 1]]] : r), []),
);
const [W, H] = (a.size || "3840x2560").split("x").map(Number);
const port = 9334 + Math.floor(Math.random() * 500);
const proc = spawn(
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  [
    "--headless=new",
    "--use-angle=metal",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=/tmp/cdp-posters-${port}`,
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
const ev = async (e) => {
  const r = (await send("Runtime.evaluate", { expression: e, awaitPromise: true, returnByValue: true }))
    .result;
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
};
await send("Emulation.setDeviceMetricsOverride", {
  width: 1440,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
});
await send("Page.navigate", { url: a.url || "http://localhost:4321/" });
for (let i = 0; i < 60 && !(await ev("!!window.__sig")); i++) await sleep(500);
for (const theme of (a.theme || "dark,light").split(",")) {
  const n = await ev(
    `(async()=>{const b=await window.__sig.exportPNG(${W},${H},'${theme}',{background:true,fit:'cover',anchor:[0.5,0.5]});window.__png=new Uint8Array(await b.arrayBuffer());return window.__png.length})()`,
  );
  const parts = [];
  for (let i = 0; i < n; i += 600000)
    parts.push(
      Buffer.from(
        await ev(
          `(()=>{let s='';const b=window.__png.subarray(${i},${i + 600000});for(let j=0;j<b.length;j+=8192)s+=String.fromCharCode.apply(null,b.subarray(j,j+8192));return btoa(s)})()`,
        ),
        "base64",
      ),
    );
  writeFileSync(`src/assets/signature/poster-${theme}.png`, Buffer.concat(parts));
  console.log(theme, n);
}
proc.kill();
process.exit(0);
