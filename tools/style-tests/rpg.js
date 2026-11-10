// Pixel RPG: a flat 16-bit scene at 180x320, scaled 6x with hard pixels to 1080x1920.
import { Pix, hex, ramp, larry, gary, chad, sign } from './px.js';

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const dith = (x, y) => (BAYER[(x & 3) + (y & 3) * 4] + 0.5) / 16;
let seed = 3; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

export function yellowstoneBG(W = 180, H = 320) {
  const P = new Pix(W, H); seed = 3;
  const sky = ramp(['#2f7cc8', '#4a98dc', '#73b6ea', '#a6d4f3', '#cfe9f8']);
  for (let y = 0; y < 150; y++) for (let x = 0; x < W; x++) { const t = y / 150 * (sky.length - 1); P.set(x, y, sky[Math.min(sky.length - 1, Math.floor(t + dith(x, y) - 0.25))]); }
  const cl = ramp(['#b9d3e6', '#e7f1f8', '#ffffff']);
  for (const [cx, cy, s] of [[30, 34, 1.2], [128, 22, 1], [150, 60, 0.8]]) for (let k = 0; k < 5; k++) { const ex = cx + (k - 2) * 7 * s, ey = cy - (k % 2) * 3 * s; P.ellipse(ex | 0, ey | 0, (7 * s) | 0, (4 * s) | 0, cl[2]); P.ellipse(ex | 0, (ey + 3 * s) | 0, (6 * s) | 0, (1.5 * s) | 0, cl[1]); }
  // mountains with snow caps
  const mt = ramp(['#4c6585', '#6b86a8', '#8ea7c4']), snow = ramp(['#c8d6e4', '#eef3f8', '#ffffff']);
  for (const [px_, py, w] of [[20, 92, 70], [95, 78, 90], [160, 98, 60]]) for (let y = py; y < 150; y++) { const half = (y - py) * w / 120; for (let x = Math.round(px_ - half); x <= px_ + half; x++) { const s = y - py < 14 + ((x * 7) % 5); P.set(x, y, s ? snow[x < px_ ? 2 : 1] : mt[x < px_ - half * 0.3 ? 2 : x > px_ + half * 0.4 ? 0 : 1]); } }
  // far hills + pine rows
  const hill = ramp(['#2c5a36', '#3b7446', '#4f8f57']);
  for (let x = 0; x < W; x++) { const top = 140 + Math.round(Math.sin(x * 0.05) * 5 + Math.sin(x * 0.13) * 2); for (let y = top; y < 175; y++) P.set(x, y, hill[y - top < 2 ? 2 : 1]); }
  const pine = ramp(['#16351f', '#24502e', '#357040']);
  const tree = (x, base, h) => { for (let j = 0; j < h; j++) { const half = Math.floor((j % (h / 3 | 0)) * 0.55 + j * 0.18) + 1; for (let i = -half; i <= half; i++) P.set(x + i, base - h + j, pine[i < 0 ? 2 : i > half / 2 ? 0 : 1]); } P.rect(x - 1, base, 2, 3, hex('#4a3020')); };
  for (let i = 0; i < 16; i++) tree(4 + i * 11 + (i % 2) * 3, 168 + (i % 3) * 3, 22 + (i % 4) * 4);
  for (let i = 0; i < 6; i++) tree(i < 3 ? 6 + i * 16 : 120 + (i - 3) * 22, 196 + (i % 2) * 4, 30 + (i % 3) * 5);
  // meadow + ochre basin where the cast stands
  const grass = ramp(['#4f7a32', '#679a3e', '#86b552']), ochre = ramp(['#9a7240', '#c09a62', '#dcbc84']);
  for (let y = 175; y < H; y++) for (let x = 0; x < W; x++) { if (P.get(x, y) && y < 200) continue; const n = rnd(); P.set(x, y, grass[n < 0.12 ? 0 : n > 0.9 ? 2 : 1]); }
  for (let y = 214; y < H; y++) for (let x = 0; x < W; x++) { const e = ((x - 90) / 120) ** 2 + ((y - 290) / 80) ** 2; if (e < 1) { const n = rnd(); P.set(x, y, ochre[n < 0.15 ? 0 : n > 0.85 ? 2 : 1]); } }
  // hot spring: orange rim, turquoise water, deep blue centre, steam
  P.ellipse(140, 236, 26, 9, hex('#e39a3a')); P.ellipse(140, 236, 21, 7, hex('#3fb0b8')); P.ellipse(141, 236, 12, 4, hex('#1f6fb0')); P.rect(128, 233, 8, 1, hex('#8fe0e6'));
  const st = ramp(['#d9e4ea', '#eef4f7', '#ffffff']);
  for (let k = 0; k < 7; k++) P.ellipse(140 + Math.round(Math.sin(k * 1.7) * 5), 222 - k * 9, 6 + k, 4 + (k >> 1), st[k % 3]);
  return P;
}

function shadow(P, cx, cy, rx) { for (let y = -3; y <= 3; y++) for (let x = -rx; x <= rx; x++) if ((x * x) / (rx * rx) + (y * y) / 9 <= 1 && dith(cx + x, cy + y) < 0.6) { const c = P.get(cx + x, cy + y); if (c) P.set(cx + x, cy + y, [c[0] * 0.6, c[1] * 0.6, c[2] * 0.6, 255]); } }
function stamp(P, S, x, y) { for (let j = 0; j < S.h; j++) for (let i = 0; i < S.w; i++) { const c = S.get(i, j); if (c) P.set(x + i, y + j, c); } }

export function shot(name) {
  const P = yellowstoneBG(), tags = [];
  if (name === 'opening') {
    const g = gary('wave'), c = chad();
    shadow(P, 52, 284, 15); shadow(P, 122, 284, 15);
    stamp(P, g, 24, 210); stamp(P, c, 94, 210);
    tags.push(['GARY', 50, 200], ['CHAD', 120, 200]);
  } else {
    const L = larry('pointing'), s = sign(['ELIGIBLE', 'JURORS: 0'], 'people');
    shadow(P, 46, 284, 16); stamp(P, L, 10, 210);
    shadow(P, 136, 284, 14); stamp(P, s, 180 - s.w - 12, 230);
  }
  return { P, tags };
}
