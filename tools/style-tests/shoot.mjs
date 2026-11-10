// Render the pixel test stills: node shoot.mjs <outdir>
import http from 'http'; import fs from 'fs'; import path from 'path';
import { chromium } from '/Users/alejogiraldo/.n8n-files/lld-pipeline/larry-3d/node_modules/playwright/index.mjs';
const HERE = path.dirname(new URL(import.meta.url).pathname), THREE_DIR = '/Users/alejogiraldo/.n8n-files/lld-pipeline/larry-3d/node_modules/three';
const out = process.argv[2] || HERE;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const f = u.startsWith('/three/') ? path.join(THREE_DIR, u.slice(7)) : path.join(HERE, u === '/' ? 'page.html' : u);
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); res.end(d); });
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
page.on('pageerror', e => console.error('page error:', e.message)); page.on('console', m => m.type() === 'error' && console.error(m.text()));
await page.goto(`http://127.0.0.1:${server.address().port}/page.html`); await page.waitForFunction(() => window.ready);
for (const style of ['rpg', 'diorama']) for (const name of ['opening', 'larry']) {
  await page.evaluate(([s, n]) => window.renderShot(s, n), [style, name]);
  await (await page.$('#out')).screenshot({ path: path.join(out, `${style}_${name}.png`) });
  console.log('ok', style, name);
}
await browser.close(); server.close();
