#!/usr/bin/env node
// Refresh src/data/silo.json from the GitHub API (Node 22+, no dependencies; GITHUB_TOKEN optional).
// Writes the file only when something other than updatedAt changed. Always exits 0.
import { readFileSync, writeFileSync } from "node:fs";

const IMAGE = new URL("../src/assets/silo/silo-showcase.webp", import.meta.url);
const SHOWCASE_PATH = "docs/silo-showcase.webp";

const FILE = new URL("../src/data/silo.json", import.meta.url);
const headers = { Accept: "application/vnd.github+json", "User-Agent": "amontlabs.com" };
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

try {
  const get = async (path) => {
    const r = await fetch(`https://api.github.com/repos/amontlabs/silo${path}`, { headers });
    if (!r.ok) throw new Error(`${path} ${r.status}`);
    return r.json();
  };
  const [repo, releases] = await Promise.all([get(""), get("/releases?per_page=100")]);
  const published = releases.filter((r) => !r.draft && !r.prerelease);
  const latest = published.sort((a, b) => new Date(b.published_at) - new Date(a.published_at))[0];
  if (!latest) throw new Error("no published release");
  const prev = JSON.parse(readFileSync(FILE, "utf8"));

  // The Silo exhibit shows the README showcase image: re-download it when its blob SHA changes.
  let showcaseSha = prev.showcaseSha;
  try {
    const readme = await (
      await fetch("https://api.github.com/repos/amontlabs/silo/readme", {
        headers: { ...headers, Accept: "application/vnd.github.raw+json" },
      })
    ).text();
    if (!readme.includes(SHOWCASE_PATH))
      console.warn(`README no longer references ${SHOWCASE_PATH}; keeping the current image`);
    else {
      const file = await get(`/contents/${SHOWCASE_PATH}`);
      if (file.sha !== prev.showcaseSha) {
        const img = await fetch(file.download_url);
        if (!img.ok) throw new Error(`showcase ${img.status}`);
        writeFileSync(IMAGE, Buffer.from(await img.arrayBuffer()));
        showcaseSha = file.sha;
        console.log("showcase image updated", file.sha);
      }
    }
  } catch (e) {
    console.error("showcase not updated:", e.message);
  }
  const next = {
    version: latest.tag_name,
    releasedAt: new Date(latest.published_at).toISOString().replace(/\.\d+Z$/, "Z"),
    releases: published.length,
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    showcaseSha,
    downloads: releases.reduce((n, r) => n + r.assets.reduce((m, a) => m + a.download_count, 0), 0),
  };
  const same = Object.keys(next).every((k) => prev[k] === next[k]);
  if (same) console.log("silo data unchanged");
  else {
    writeFileSync(FILE, `${JSON.stringify({ ...next, updatedAt: new Date().toISOString() }, null, 2)}\n`);
    console.log("silo data updated", next);
  }
} catch (e) {
  console.error("silo data not updated:", e.message);
}
