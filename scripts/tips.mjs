#!/usr/bin/env node
// Hover each header control in headless Chrome, check its tooltip is centred under the icon (or inside the viewport), save 4x crops.
//   node scripts/tips.mjs --w 1440 --h 900 --scheme dark --prefix .proof/tip-1440 [--click mail]
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";

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
    `--user-data-dir=/tmp/cdp-tips-${port}`,
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
const wsb = new WebSocket(
  (await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()).webSocketDebuggerUrl,
);
await new Promise((r) => (wsb.onopen = r));
wsb.send(
  JSON.stringify({
    id: 1,
    method: "Browser.grantPermissions",
    params: {
      origin: "http://localhost:4321",
      permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"],
    },
  }),
);
await send("Emulation.setDeviceMetricsOverride", {
  width: W,
  height: H,
  deviceScaleFactor: 1,
  mobile: W < 700,
});
await send("Emulation.setEmulatedMedia", {
  features: [{ name: "prefers-color-scheme", value: a.scheme || "dark" }],
});
await send("Page.navigate", { url: "http://localhost:4321/" });
await sleep(3500);
const items = JSON.parse(
  await ev(
    "JSON.stringify([...document.querySelectorAll('.tsw :is(button,a)')].map((e,i)=>{const r=e.getBoundingClientRect();return {i,label:e.getAttribute('aria-label'),x:r.left+r.width/2,y:r.top+r.height/2}}))",
  ),
);
const out = [];
for (const it of items) {
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: it.x, y: it.y });
  await sleep(450);
  const m = JSON.parse(
    await ev(
      `(()=>{const e=document.querySelectorAll('.tsw :is(button,a)')[${it.i}];const t=e.querySelector('.tip').getBoundingClientRect();const r=e.getBoundingClientRect();return JSON.stringify({text:e.querySelector('.tip').textContent,tipCentre:t.left+t.width/2,iconCentre:r.left+r.width/2,left:t.left,right:t.right,top:t.top})})()`,
    ),
  );
  out.push({
    label: it.label,
    ...m,
    off: +(m.tipCentre - m.iconCentre).toFixed(1),
    inside: m.left >= 0 && m.right <= W,
  });
  const cx = Math.min(Math.max(it.x - 120, 0), W - 240);
  const r = await send("Page.captureScreenshot", {
    format: "png",
    clip: { x: cx, y: 20, width: 240, height: 80, scale: 4 },
  });
  writeFileSync(`${a.prefix}-${it.i}.png`, Buffer.from(r.result.data, "base64"));
}
if (a.click) {
  const it = items.find(
    (x) => x.label.toLowerCase().includes("email") || x.label.toLowerCase().includes("copy"),
  );
  await send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: it.x,
    y: it.y,
    button: "left",
    clickCount: 1,
  });
  await send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: it.x,
    y: it.y,
    button: "left",
    clickCount: 1,
  });
  await sleep(500);
  const r = await send("Page.captureScreenshot", {
    format: "png",
    clip: { x: Math.min(Math.max(it.x - 120, 0), W - 240), y: 20, width: 240, height: 80, scale: 4 },
  });
  writeFileSync(`${a.prefix}-copied.png`, Buffer.from(r.result.data, "base64"));
  console.log(
    "copied tip:",
    await ev("document.querySelector('.tsw-links .tip').textContent"),
    "| live:",
    await ev("document.getElementById('copy-status')?.textContent"),
  );
  console.log("clipboard:", await ev("navigator.clipboard.readText()"));
  await sleep(2000);
  console.log("reverted tip:", await ev("document.querySelector('.tsw-links .tip').textContent"));
}
console.log(JSON.stringify(out.map((o) => [o.text, o.off, o.inside])));
proc.kill();
process.exit(0);
