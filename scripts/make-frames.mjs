#!/usr/bin/env node
// Stills for the storyboard prototype: frames cut from the projects' own films (`public/media/*-full.mp4`) at the
// moments listed in `src/data/frames.json`, written as WebP 720w to `public/media/frames/<id>-<seconds>.webp`.
// ffmpeg decodes, sharp encodes (this ffmpeg has no libwebp).   node scripts/make-frames.mjs
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import sharp from "sharp";

const frames = JSON.parse(readFileSync("src/data/frames.json", "utf8"));
mkdirSync("public/media/frames", { recursive: true });
for (const [id, times] of Object.entries(frames)) {
  for (const t of times) {
    const png = execFileSync(
      "ffmpeg",
      [
        "-v",
        "error",
        "-ss",
        String(t),
        "-i",
        `public/media/${id}-full.mp4`,
        "-frames:v",
        "1",
        "-f",
        "image2pipe",
        "-vcodec",
        "png",
        "-",
      ],
      { maxBuffer: 64 << 20 },
    );
    const out = `public/media/frames/${id}-${t}.webp`;
    const info = await sharp(png).resize({ width: 720 }).webp({ quality: 72 }).toFile(out);
    console.log(out, `${info.width}x${info.height}`, `${(info.size / 1024).toFixed(1)} kB`);
  }
}
