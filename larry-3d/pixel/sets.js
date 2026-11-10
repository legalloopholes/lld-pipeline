// Pixel RPG sets, 180 x 320, drawn in code. Feet stand on y = FEET (60% of the frame; captions live below).
// Each set is a stack of layers: static pictures (Pix) and animated layers (functions of time) so the world is
// never frozen: clouds drift, birds cross, pines and grass move in the wind, steam rises, flags wave, clocks tick.
import { Pix, hex, ramp } from './kit.js';

export const PW = 180, PH = 320, FEET = 192;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const dith = (x, y) => (BAYER[(x & 3) + (y & 3) * 4] + 0.5) / 16;
let seed = 1; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const hash = (a, b = 0) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };

// ---------- drawing on the 180x320 canvas ----------
const cvs = new WeakMap();
export const toCanvas = P => { let c = cvs.get(P); if (!c) { c = P.canvas(); cvs.set(P, c); } return c; };
export function painter(g) {
  return {
    g,
    rect(x, y, w, h, c) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); },
    px(x, y, c) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), 1, 1); },
    img(P, x, y) { g.drawImage(toCanvas(P), Math.round(x), Math.round(y)); },
    clip(x, y, w, h, fn) { g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); fn(); g.restore(); },
  };
}
// wind: a slow travelling wave plus gusts, -1..1
export const wind = (t, x = 0) => Math.sin(t * 1.5 - x * 0.045) * 0.6 + Math.sin(t * 0.47 + 1.3) * 0.4;

// ---------- static helpers ----------
function gradient(P, y0, y1, cols) { const r = ramp(cols); for (let y = y0; y < y1; y++) for (let x = 0; x < PW; x++) { const t = (y - y0) / (y1 - y0) * (r.length - 1); P.set(x, y, r[Math.min(r.length - 1, Math.floor(t + dith(x, y) - 0.25))]); } }
function noise(P, y0, y1, r, test = () => true, p = [0.12, 0.88]) { for (let y = y0; y < y1; y++) for (let x = 0; x < PW; x++) if (test(x, y)) { const n = rnd(); P.set(x, y, r[n < p[0] ? 0 : n > p[1] ? 2 : 1]); } }
function mountains(P, base, list) { const mt = ramp(['#4c6585', '#6b86a8', '#8ea7c4']), snow = ramp(['#c8d6e4', '#eef3f8', '#ffffff']);
  for (const [px_, py, w] of list) for (let y = py; y < base; y++) { const half = (y - py) * w / 120; for (let x = Math.round(px_ - half); x <= px_ + half; x++) P.set(x, y, y - py < 12 + ((x * 7) % 5) ? snow[x < px_ ? 2 : 1] : mt[x < px_ - half * 0.3 ? 2 : x > px_ + half * 0.4 ? 0 : 1]); } }

// ---------- animated pieces ----------
const cloudCache = {};
function cloudSprite(s) {
  return cloudCache[s] ||= (() => { const w = Math.ceil(46 * s), h = Math.ceil(16 * s), P = new Pix(w, h), cl = ramp(['#b9d3e6', '#e7f1f8', '#ffffff']);
    for (let k = 0; k < 5; k++) { const ex = w / 2 + (k - 2) * 7 * s, ey = h / 2 - (k % 2) * 3 * s; P.ellipse(ex | 0, ey | 0, (7 * s) | 0, (4 * s) | 0, cl[2]); }
    for (let k = 0; k < 5; k++) { const ex = w / 2 + (k - 2) * 7 * s; P.ellipse(ex | 0, (h / 2 + 3 * s) | 0, (6 * s) | 0, Math.max(1, (1.5 * s) | 0), cl[1]); }
    return P; })();
}
const clouds = list => (D, t) => { for (const [x0, y, s, v] of list) { const C = cloudSprite(s), span = PW + C.w + 20; const x = ((x0 + t * v) % span + span) % span - C.w - 10; D.img(C, x, y - C.h / 2); } };

function bird(D, x, y, up, c) {
  D.px(x, y, c); D.px(x - 1, y, c); D.px(x + 1, y, c);
  if (up) { D.px(x - 2, y - 1, c); D.px(x - 3, y - 2, c); D.px(x + 2, y - 1, c); D.px(x + 3, y - 2, c); }
  else { D.px(x - 2, y, c); D.px(x - 3, y + 1, c); D.px(x + 2, y, c); D.px(x + 3, y + 1, c); }
}
const birds = (list, c = '#2a3340') => (D, t) => {        // [y, period s, offset s, dir]
  list.forEach(([y0, per, off, dir], i) => { const p = ((t + off) % per) / per, x = dir > 0 ? -12 + p * (PW + 24) : PW + 12 - p * (PW + 24);
    bird(D, x, y0 + Math.sin(t * 0.9 + i * 2) * 3, Math.floor(t * 5 + i * 1.7) % 2 === 0, c);
    bird(D, x - dir * 7, y0 + 4 + Math.sin(t * 0.9 + i * 2 + 1) * 3, Math.floor(t * 5 + i * 1.7 + 1) % 2 === 0, c); });
};

const pineCache = {};
function pineSprite(h, k) {                                   // k = sideways shift of the tip in pixels (wind)
  return pineCache[h + '|' + k] ||= (() => {
    const halfMax = Math.floor((h / 3) * 0.55 + h * 0.18) + 2, w = 2 * (halfMax + 4) + 1, cx = halfMax + 4, P = new Pix(w, h + 3), pn = ramp(['#16351f', '#24502e', '#357040']);
    for (let j = 0; j < h; j++) { const half = Math.floor((j % (h / 3 | 0)) * 0.55 + j * 0.18) + 1, sh = Math.round(k * ((h - j) / h) ** 2);
      for (let i = -half; i <= half; i++) P.set(cx + i + sh, j, pn[i < 0 ? 2 : i > half / 2 ? 0 : 1]); }
    P.rect(cx - 1, h, 2, 3, hex('#4a3020')); P.cx = cx; return P; })();
}
const pines = (list, amp = 2) => (D, t) => { for (const [x, base, h] of list) { const k = Math.round(wind(t, x) * amp); const S = pineSprite(h, k); D.img(S, x - S.cx, base - h); } };

function tuftList(n, test, y0, y1) { const out = []; let guard = 0; while (out.length < n && guard++ < 5000) { const x = 2 + rnd() * (PW - 4), y = y0 + rnd() * (y1 - y0); if (test(x | 0, y | 0)) out.push([x | 0, y | 0, 2 + (rnd() * 3 | 0)]); } return out; }
const grass = (list, cols = ['#3f6a28', '#86b552', '#a8d070']) => (D, t) => {
  for (const [x, y, h] of list) { const lean = Math.round(wind(t, x) * 1.3);
    for (const [dx, hh, c] of [[-1, h - 1, cols[0]], [0, h, cols[1]], [1, h - 1, cols[0]]]) for (let j = 0; j < hh; j++) D.px(x + dx + (j >= hh - 2 ? lean * (j - hh + 3) / 2 : 0) + (dx && j === hh - 1 ? dx : 0), y - j, j === hh - 1 ? cols[2] : c); }
};

const steam = (cx, base, n = 6) => (D, t) => {
  for (let k = 0; k < n; k++) { const p = ((t * 0.3 + k / n) % 1), y = base - p * 46, x = cx + Math.sin(p * 6 + k) * 3 + wind(t) * p * 8, r = 2 + p * 6;
    for (let yy = -r * 0.6; yy <= r * 0.6; yy++) for (let xx = -r; xx <= r; xx++) {
      if ((xx * xx) / (r * r) + (yy * yy) / (r * r * 0.36) > 1) continue;
      const a = Math.min(0.9, 1.6 * (1 - p)).toFixed(2);                                              // fades as it rises
      D.px(x + xx, y + yy, yy < 0 ? `rgba(255,255,255,${a})` : `rgba(222,232,238,${a})`); } }
};
const sparkles = (pts, c = '#e8fbff') => (D, t) => pts.forEach(([x, y, rx], i) => { const ph = (t * 1.3 + i * 0.37) % 1; if (ph < 0.5) { D.px(x + Math.round(Math.sin(t * 0.7 + i) * rx), y, c); if (ph < 0.18) D.px(x + Math.round(Math.sin(t * 0.7 + i) * rx) + 1, y, c); } });

function usFlag(D, t, x, y, w = 20, h = 13) {                 // waves from the pole outward
  for (let c = 0; c < w; c++) { const off = Math.round(Math.sin(t * 5 - c * 0.45) * (c / w) * 1.8);
    for (let r = 0; r < h; r++) { const canton = c < 8 && r < 7, col = canton ? ((c + r) % 2 && c > 0 && r > 0 && c < 7 && r < 6 && (c % 2) && (r % 2) ? '#f4f1e8' : '#1d2f6b') : (Math.floor(r / 2) % 2 ? '#f4f1e8' : '#c23030');
      D.px(x + c, y + r + off, Math.sin(t * 5 - c * 0.45 + 0.9) > 0.55 && !canton ? shade(col) : col); } }
}
const shade = c => ({ '#f4f1e8': '#d8d2c4', '#c23030': '#9a2222' }[c] || c);
const motes = (n, x0, y0, w, h) => (D, t) => { for (let i = 0; i < n; i++) { const x = x0 + ((hash(i) * w + t * (1.5 + hash(i, 2) * 2)) % w), y = y0 + ((hash(i, 1) * h - t * (1 + hash(i, 3) * 1.5)) % h + h) % h; if ((t * 0.8 + hash(i, 4)) % 1 < 0.75) D.px(x, y, 'rgba(255,236,190,0.75)'); } };
const clockHands = (cx, cy, r) => (D, t) => {
  const sec = (t % 60) / 60 * Math.PI * 2, min = (t / 3600 + 0.35) * Math.PI * 2;
  for (let i = 1; i <= r - 1; i++) D.px(cx + Math.sin(sec) * i, cy - Math.cos(sec) * i, '#c23030');
  for (let i = 1; i <= r - 3; i++) D.px(cx + Math.sin(min) * i, cy - Math.cos(min) * i, '#15151c');
};

// ---------- sets ----------
const SETS = {
  yellowstone() {
    const sky = new Pix(PW, PH); gradient(sky, 0, 110, ['#2f7cc8', '#4a98dc', '#73b6ea', '#a6d4f3', '#cfe9f8']);
    const far = new Pix(PW, PH); mountains(far, 110, [[22, 52, 70], [98, 40, 90], [162, 58, 60]]);
    const hill = ramp(['#2c5a36', '#3b7446', '#4f8f57']);
    for (let x = 0; x < PW; x++) { const top = 100 + Math.round(Math.sin(x * 0.05) * 4 + Math.sin(x * 0.13) * 2); for (let y = top; y < 130; y++) far.set(x, y, hill[y - top < 2 ? 2 : 1]); }
    const ground = new Pix(PW, PH); seed = 7;
    noise(ground, 128, PH, ramp(['#4f7a32', '#679a3e', '#86b552']));
    const inBasin = (x, y) => ((x - 90) / 125) ** 2 + ((y - 215) / 62) ** 2 < 1;
    noise(ground, 150, PH, ramp(['#9a7240', '#c09a62', '#dcbc84']), inBasin, [0.15, 0.85]);
    ground.ellipse(148, 168, 20, 7, hex('#e39a3a')); ground.ellipse(148, 168, 16, 5, hex('#3fb0b8')); ground.ellipse(149, 168, 9, 3, hex('#1f6fb0'));
    seed = 11; const tufts = tuftList(70, (x, y) => !inBasin(x, y) && !(((x - 148) / 24) ** 2 + ((y - 168) / 9) ** 2 < 1), 134, PH);
    const farPines = []; for (let i = 0; i < 16; i++) farPines.push([4 + i * 11 + (i % 2) * 3, 126 + (i % 3) * 3, 20 + (i % 4) * 4]);
    return { layers: [sky, clouds([[10, 22, 1.1, 2.2], [120, 14, 0.9, 1.6], [70, 44, 0.7, 3.0], [170, 34, 0.6, 2.6]]),
      birds([[30, 17, 0, 1], [52, 23, 9, -1]]), far, pines(farPines, 1), ground,
      pines([[8, 150, 28], [23, 154, 33], [150, 150, 38], [168, 154, 28]], 2),
      sparkles([[146, 168, 7], [150, 167, 5], [143, 169, 9]]), steam(148, 162), grass(tufts)] };
  },
  courtroom() {
    const P = new Pix(PW, PH), wood = ramp(['#5a3218', '#7a4626', '#9a5e36']), dark = ramp(['#3a2010', '#4e2c16', '#64391e']);
    for (let y = 0; y < 150; y++) for (let x = 0; x < PW; x++) P.set(x, y, x % 12 === 0 ? dark[0] : wood[(x % 12 < 2) ? 2 : 1]);
    P.rect(0, 60, PW, 3, dark[2]); P.rect(0, 146, PW, 4, dark[0]);
    P.ellipse(90, 34, 18, 18, hex('#c9a13a')); P.ellipse(90, 34, 15, 15, hex('#e6c35a')); P.ellipse(90, 34, 10, 10, hex('#1d2f6b'));
    for (let i = 0; i < 5; i++) P.set(86 + i * 2, 32 + (i % 2), hex('#f4f1e8'));
    P.rect(14, 10, 3, 80, hex('#c9a13a'));
    P.ellipse(52, 84, 8, 8, hex('#c9a13a')); P.ellipse(52, 84, 7, 7, hex('#f4f1e8')); for (let k = 0; k < 12; k++) P.set(52 + Math.round(Math.sin(k / 12 * 6.283) * 6), 84 - Math.round(Math.cos(k / 12 * 6.283) * 6), hex('#5a3218'));
    for (let y = 150; y < PH; y++) for (let x = 0; x < PW; x++) { const k = ((x >> 4) + (y >> 3)) % 2; P.set(x, y, hex(k ? '#c8a47a' : '#b38e64')); }
    const F = new Pix(PW, PH);
    F.box(96, 150, 84, 46, wood, 0); F.rect(96, 150, 84, 4, dark[2]); F.box(120, 166, 34, 10, ramp(['#a07a22', '#d9a93a', '#ffe08a']));
    return { layers: [P, (D, t) => usFlag(D, t, 17, 12), clockHands(52, 84, 6), motes(16, 0, 0, PW, 150)], F, judgeX: 138, judgeY: 166 };
  },
  office() {
    const wall = new Pix(PW, PH);
    for (let y = 0; y < 150; y++) for (let x = 0; x < PW; x++) wall.set(x, y, hex(y % 24 === 0 ? '#7f93ab' : '#94a8bf'));
    wall.rect(24, 20, 132, 82, hex('#e8eef4')); gradient(wall, 24, 98, ['#5fa8e0', '#8cc4ef', '#bfe0f6']); wall.rect(0, 24, 28, 74, hex('#94a8bf')); wall.rect(152, 24, 28, 74, hex('#94a8bf')); wall.rect(24, 20, 132, 4, hex('#e8eef4')); wall.rect(24, 98, 132, 4, hex('#e8eef4')); wall.rect(24, 24, 4, 74, hex('#e8eef4')); wall.rect(152, 24, 4, 74, hex('#e8eef4'));
    for (let y = 150; y < PH; y++) for (let x = 0; x < PW; x++) wall.set(x, y, hex((x * 3 + y * 5) % 7 ? '#5c6f86' : '#536479'));
    const city = new Pix(PW, PH), cr = ramp(['#4c6a8a', '#6a88a8', '#8aa6c4']), lights = [];
    for (const [x, w, h] of [[30, 16, 40], [50, 12, 55], [66, 20, 34], [90, 14, 60], [108, 18, 44], [130, 20, 52]]) { city.box(x, 98 - h, w, h, cr); for (let y = 98 - h + 4; y < 96; y += 6) for (let i = 2; i < w - 2; i += 4) lights.push([x + i, y]); }
    city.rect(89, 24, 2, 74, hex('#e8eef4'));
    const potP = new Pix(PW, PH); potP.box(150, 140, 12, 12, ramp(['#8a5a34', '#b07a4a', '#d09a6a']));
    const plant = (D, t) => { const lean = wind(t * 0.6, 0); for (let k = 0; k < 7; k++) { const a = -1.3 + k * 0.43, len = 12 + (k % 3) * 4; for (let i = 0; i < len; i++) { const f = i / len, x = 156 + Math.sin(a) * i * 0.7 + lean * f * f * 2, y = 140 - Math.cos(a) * i * 0.9; D.px(x, y, i > len - 4 ? '#5a9c68' : '#3b7446'); D.px(x + 1, y, '#2c5a36'); } } };
    return { layers: [wall, (D, t) => D.clip(28, 24, 124, 74, () => { clouds([[0, 34, 0.8, 2.0], [90, 50, 0.6, 2.8]])(D, t); birds([[40, 15, 3, 1]])(D, t); }), city,
      (D, t) => lights.forEach(([x, y], i) => { if (hash(i, Math.floor(t * 0.4 + hash(i) * 10)) > 0.3) D.px(x, y, '#f2e8a8'); }),
      (D, t) => { if (t % 1.6 < 0.8) { D.px(97, 37, '#ff4a3a'); D.px(57, 42, '#ff4a3a'); } }, potP, plant] };
  },
  capitol() {
    const sky = new Pix(PW, PH); gradient(sky, 0, 140, ['#3f8ad4', '#5ea6e4', '#8cc4ef', '#c2e2f6']);
    const P = new Pix(PW, PH), stone = ramp(['#c8c2b4', '#e6e0d2', '#fbf8f0']);
    P.box(40, 98, 100, 44, stone); for (let x = 46; x < 136; x += 9) P.box(x, 104, 5, 36, stone);
    P.box(60, 80, 60, 20, stone); P.box(70, 60, 40, 22, stone); P.ellipse(90, 58, 16, 12, stone[2]); P.ellipse(90, 58, 14, 10, stone[1]); P.rect(89, 30, 1, 18, hex('#5a6a7a'));
    for (let i = 0; i < 4; i++) P.box(34 - i * 4, 140 + i * 3, 112 + i * 8, 4, stone);
    seed = 5; noise(P, 150, PH, ramp(['#4f8a3a', '#68a64a', '#86c062']));
    for (let y = 150; y < PH; y++) { const half = 8 + (y - 150) * 0.35; for (let x = Math.round(90 - half); x <= 90 + half; x++) P.set(x, y, hex((x + y) % 5 ? '#d8cfbd' : '#cbc1ae')); }
    seed = 13; const tufts = tuftList(50, (x, y) => Math.abs(x - 90) > 10 + (y - 150) * 0.35, 154, PH);
    return { layers: [sky, clouds([[0, 20, 1, 2.0], [110, 30, 0.8, 2.6], [60, 70, 0.6, 3.2]]), birds([[44, 19, 4, -1]]), P,
      (D, t) => usFlag(D, t, 90, 30, 12, 8), pines([[14, 150, 34], [166, 150, 30]], 2), grass(tufts, ['#3f6a28', '#6aa64a', '#9ccc70'])] };
  },
  studio() {
    const floor = new Pix(PW, PH);
    for (let y = 150; y < PH; y++) for (let x = 0; x < PW; x++) floor.set(x, y, hex(dith(x, y) < 0.5 ? '#e0b45a' : '#d6a84e'));
    floor.rect(0, 150, PW, 2, hex('#b8862e'));
    const back = (D, t) => { const off = (t * 3) % 44; for (let x = -44; x < PW + 44; x += 44) { D.rect(x + off, 0, 22, 150, '#3d7fd0'); D.rect(x + off + 22, 0, 22, 150, '#4f92de'); } };
    const stars = (D, t) => { for (let i = 0; i < 9; i++) { const ph = (t * 0.5 + hash(i)) % 1; if (ph > 0.6) continue; const x = 10 + hash(i, 1) * 160, y = 14 + hash(i, 2) * 110, r = ph < 0.3 ? 1 : 2; D.px(x, y, '#ffffff'); for (let k = 1; k <= r; k++) { D.px(x - k, y, '#cfe6ff'); D.px(x + k, y, '#cfe6ff'); D.px(x, y - k, '#cfe6ff'); D.px(x, y + k, '#cfe6ff'); } } };
    return { layers: [back, stars, floor] };
  },
};
const ALIAS = { 'bg-yellowstone': 'yellowstone', 'bg-courtroom': 'courtroom', 'bg-office': 'office', 'bg-capitol': 'capitol', white: 'studio', 'bg-studio': 'studio' };
const cache = {};
export function getSet(bg) { const k = ALIAS[bg] || (SETS[(bg || '').replace(/^bg-/, '')] ? bg.replace(/^bg-/, '') : 'studio'); seed = 1; return cache[k] ||= SETS[k](); }
