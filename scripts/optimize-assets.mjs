#!/usr/bin/env node
// scripts/optimize-assets.mjs — T8 lighthouse plan
// (a) convertOrnamentsToWebp — PNG -> WebP lossless alpha
// (b) convertCoversToVideo  — GIF -> MP4 (H.264) + WebM
// (c) writeAssetDimensions   — { "<path>": [w,h] } JSON
import { readdir, stat, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arsyaDir = path.join(root, "apps/web/public/media/template/arsya");
const photosDir = path.join(root, "apps/web/public/media/photos");
const uploadsDir = path.join(root, "apps/web/public/media/uploads");
const outJson = path.join(root, "apps/web/src/data/asset-dimensions.json");

async function walk(dir, exts) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const e of await readdir(dir)) {
    const p = path.join(dir, e);
    const s = await stat(p);
    if (s.isDirectory()) out.push(...await walk(p, exts));
    else if (!exts || exts.includes(path.extname(e).toLowerCase())) out.push(p);
  }
  return out;
}

export async function convertOrnamentsToWebp() {
  const sharp = (await import("sharp")).default;
  const files = (await walk(arsyaDir, [".png"]));
  let totalIn = 0, totalOut = 0;
  for (const src of files) {
    const dst = src.replace(/\.png$/i, ".webp");
    if (existsSync(dst)) {
      const sIn = await stat(src);
      const sOut = await stat(dst);
      if (sOut.size > sIn.size) {
        console.warn(`webp ${path.basename(src)} larger ${sOut.size} > ${sIn.size} — keeping webp (R1 rapikan, not blocking)`);
      }
      totalIn += sIn.size; totalOut += sOut.size;
      continue;
    }
    const bufIn = await stat(src);
    totalIn += bufIn.size;
    // R1: effort 6 (was 4), quality 75/85 — guard after: if webp > png, delete webp
    await sharp(src).webp({ quality: 75, alphaQuality: 85, effort: 6 }).toFile(dst);
    const sOut = await stat(dst);
    if (sOut.size > bufIn.size) {
      const { unlink } = await import("node:fs/promises");
      await unlink(dst);
      console.log(`webp ${path.basename(src)}: ${bufIn.size} -> ${sOut.size} (larger, removed, keep png)`);
      totalOut += bufIn.size;
    } else {
      totalOut += sOut.size;
      console.log(`webp ${path.basename(src)}: ${bufIn.size} -> ${sOut.size} (${Math.round(sOut.size/bufIn.size*100)}%)`);
    }
  }
  console.log(`[ornaments] total ${totalIn} -> ${totalOut} bytes (saved ${totalIn-totalOut}, ratio ${Math.round(totalOut/totalIn*100)}%)`);
  return { totalIn, totalOut };
}

export async function convertCoversToVideo() {
  const ffmpegPath = (await import("ffmpeg-static")).default;
  const gifs = await walk(uploadsDir, [".gif"]);
  for (const gif of gifs) {
    const base = gif.replace(/\.gif$/i, "");
    const mp4 = base + ".mp4";
    // R4: webm tidak terpakai — hanya mp4 yang dirujuk migration & coverMediaHtml (single <video src>)
    for (const [dst, extraArgs] of [
      [mp4, ["-c:v","libx264","-pix_fmt","yuv420p","-movflags","+faststart","-crf","28","-preset","veryfast","-vf","scale=trunc(iw/2)*2:trunc(ih/2)*2"]],
    ]) {
      if (existsSync(dst)) {
        console.log(`skip exists ${path.basename(dst)}`);
        continue;
      }
      const args = ["-y","-i",gif, ...extraArgs, "-an", dst];
      console.log(`ffmpeg ${path.basename(gif)} -> ${path.basename(dst)}`);
      await new Promise((resolve, reject) => {
        const p = spawn(ffmpegPath, args, { stdio: "inherit" });
        p.on("close", code => code===0 ? resolve() : reject(new Error(`ffmpeg exit ${code} for ${dst}`)));
        p.on("error", reject);
      });
      const s = await stat(dst);
      console.log(`  created ${path.basename(dst)} ${s.size} bytes`);
    }
  }
}

export async function writeAssetDimensions() {
  const sharp = (await import("sharp")).default;
  const files = [
    ...await walk(arsyaDir, [".png",".webp"]),
    ...await walk(photosDir, [".png",".jpg",".jpeg",".webp"]),
    ...await walk(uploadsDir, [".png",".jpg",".jpeg",".webp",".gif"]),
  ];
  // deduplicate by relative public path
  const publicRoot = path.join(root, "apps/web/public");
  const map = {};
  for (const abs of files) {
    const rel = "/" + path.relative(publicRoot, abs).replaceAll(path.sep, "/");
    // skip .webp duplicates if .png exists? keep both but keys distinct — we need wp variant for lookups
    try {
      const meta = await sharp(abs).metadata();
      if (meta.width && meta.height) map[rel] = [meta.width, meta.height];
    } catch (e) {
      console.warn(`skip dimensions ${rel}: ${e.message}`);
    }
  }
  await mkdir(path.dirname(outJson), { recursive: true });
  await writeFile(outJson, JSON.stringify(map, null, 2) + "\n");
  console.log(`[dimensions] wrote ${Object.keys(map).length} entries to ${path.relative(root, outJson)}`);
  return map;
}

async function main() {
  const cmd = process.argv[2] || "all";
  if (cmd === "all" || cmd === "webp") await convertOrnamentsToWebp();
  if (cmd === "all" || cmd === "video") await convertCoversToVideo();
  if (cmd === "all" || cmd === "dimensions") await writeAssetDimensions();
  if (cmd === "all") {
    // summary after
    const pngs = await walk(arsyaDir, [".png"]);
    const webps = await walk(arsyaDir, [".webp"]);
    let sPng=0,sWebp=0;
    for (const f of pngs) sPng+=(await stat(f)).size;
    for (const f of webps) sWebp+=(await stat(f)).size;
    console.log(`\n=== SUMMARY ===\nPNG total: ${(sPng/1024).toFixed(1)} KiB\nWebP total: ${(sWebp/1024).toFixed(1)} KiB`);
  }
}

if (import.meta.url === `file://${process.argv[1].replaceAll("\\","/")}` || process.argv[1].endsWith("optimize-assets.mjs")) {
  main().catch(e=>{ console.error(e); process.exit(1); });
}
