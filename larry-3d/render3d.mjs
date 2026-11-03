#!/usr/bin/env node
// Render the 3D world for one episode (video only, no captions/audio — render_video.py adds those).
//   node render3d.mjs <timeline.json> <out.mp4>
//   PREVIEW_FRAMES=0,120,300 node render3d.mjs <timeline.json> <out.png>   → stills only
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');

const here = path.dirname(fileURLToPath(import.meta.url));
const [tlPath, outPath] = process.argv.slice(2);
if (!tlPath || !outPath) { console.error('usage: node render3d.mjs <timeline.json> <out.mp4>'); process.exit(1); }
const tl = JSON.parse(fs.readFileSync(tlPath, 'utf8'));
const fps = tl.fps || 30, W = 1080, H = 1920;
const frames = tl.frames || Math.ceil(tl.dur * fps);
const FFMPEG = process.env.FFMPEG || ['/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg', '/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg'].find(p => fs.existsSync(p)) || 'ffmpeg';

const types = { '.html': 'text/html', '.js': 'text/javascript' };
const server = http.createServer((req, res) => {
  let p = req.url.split('?')[0];
  if (p === '/three.module.js') p = '/node_modules/three/build/three.module.js';
  const f = path.join(here, path.normalize(p).replace(/^(\.\.[/\\])+/, ''));
  if (!f.startsWith(here) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));

// Linux (cloud/test) needs software WebGL; on the Mac the GPU is used.
const args = process.platform === 'darwin' ? [] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const browser = await chromium.launch({ args });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
let pageErr = null;
page.on('pageerror', e => { pageErr = e; console.error('page error:', e.message); });
await page.goto(`http://127.0.0.1:${server.address().port}/world.html`);
await page.waitForFunction(() => window.worldReady === true || window.__err, null, { timeout: 60000 });
if (pageErr) process.exit(2);
await page.evaluate(t => window.setupTimeline(t), tl);

if (process.env.PREVIEW_FRAMES) {
  for (const f of process.env.PREVIEW_FRAMES.split(',').map(Number)) {
    await page.evaluate(([t, fr]) => window.renderAt(t, fr), [f / fps, f]);
    await page.screenshot({ path: outPath.replace(/\.\w+$/, '') + `_f${f}.png` });
  }
  await browser.close(); server.close(); process.exit(0);
}

const ff = spawn(FFMPEG, ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
  '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', String(fps), outPath], { stdio: ['pipe', 'inherit', 'inherit'] });
const done = new Promise((res, rej) => ff.on('close', c => (c === 0 ? res() : rej(new Error('ffmpeg exited ' + c)))));
const t0 = Date.now();
for (let f = 0; f < frames; f++) {
  await page.evaluate(([t, fr]) => window.renderAt(t, fr), [f / fps, f]);
  const jpg = await page.screenshot({ type: 'jpeg', quality: 93 });
  if (!ff.stdin.write(jpg)) await new Promise(r => ff.stdin.once('drain', r));
  if (f % 150 === 0) process.stderr.write(`3d frame ${f}/${frames}\n`);
}
ff.stdin.end(); await done; await browser.close(); server.close();
if (pageErr) process.exit(2);
console.error(`3d rendered ${frames} frames in ${((Date.now() - t0) / 1000).toFixed(0)}s → ${outPath}`);
