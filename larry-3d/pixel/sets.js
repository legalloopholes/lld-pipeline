// Pixel RPG sets, 180 x 320, drawn in code. Feet stand on y = FEET (60% of the frame; captions live below).
// Each set is a stack of layers: static pictures (Pix) and animated layers (functions of time) so the world is
// never frozen: clouds drift, birds cross, pines and grass move in the wind, steam rises, flags wave, clocks tick.
import { Pix, hex, ramp, pixText } from './kit.js';
import * as L from './life.js';
import { wind } from './life.js';
export { wind };

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
    // wildflowers and pebbles on the meadow, a rock pile, a fallen log and a bush in the near foreground
    seed = 17; for (let k = 0; k < 40; k++) { const x = rnd() * PW | 0, y = 134 + rnd() * 186 | 0; if (inBasin(x, y)) { ground.set(x, y, hex('#8a6a40')); continue; } ground.set(x, y, hex(['#f2c230', '#ffffff', '#e866a8', '#a87ae0'][k % 4])); }
    const near = new Pix(PW, PH), rock = ramp(['#5e5a56', '#8a8580', '#b0aba4']), bark = ramp(['#4a3020', '#6e4a30', '#8e6644']), bush = ramp(['#2c5a2a', '#3f7a38', '#5a9c4a']);
    near.ellipse(20, 296, 16, 8, rock[0]); near.ellipse(18, 293, 13, 6, rock[1]); near.ellipse(15, 290, 7, 3, rock[2]); near.ellipse(38, 300, 8, 5, rock[1]); near.ellipse(36, 298, 4, 2, rock[2]);
    near.box(52, 286, 46, 8, bark); for (let x = 56; x < 96; x += 7) near.set(x, 289, bark[0]); near.ellipse(97, 290, 3, 4, hex('#c9a06a')); near.ellipse(97, 290, 1, 2, hex('#8e6644'));
    near.ellipse(160, 292, 20, 13, bush[0]); near.ellipse(156, 288, 16, 10, bush[1]); near.ellipse(152, 284, 8, 5, bush[2]); for (const [x, y] of [[150, 286], [162, 290], [168, 284]]) near.set(x, y, hex('#d8342c'));
    near.outline(hex('#1e2a18'));
    return { layers: [sky, clouds([[10, 22, 1.1, 2.2], [120, 14, 0.9, 1.6], [70, 44, 0.7, 3.0], [170, 34, 0.6, 2.6]]),
      L.eagle(118, 40, 34), birds([[30, 17, 0, 1], [52, 23, 9, -1]]), far, L.deer(119, 28, 4), pines(farPines, 1), ground,
      L.geyser(92, 140, 16, 4), L.bison([[4, 146, 76, 3.0, 0], [100, 139, 74, 2.4, 9]]),
      pines([[8, 150, 28], [23, 154, 33], [150, 150, 38], [168, 154, 28]], 2), L.tent(14, 162),
      sparkles([[146, 168, 7], [150, 167, 5], [143, 169, 9]]), steam(148, 162), grass(tufts), L.campfire(89, 181),
      L.butterflies([[30, 172, '#f2c230'], [160, 196, '#e866a8'], [118, 175, '#ffffff']])],
      front: [near, L.rabbit(270, 12, 3, 1), L.butterflies([[120, 262, '#f2c230']])] };
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
    const rail = new Pix(PW, PH); rail.box(0, 150, 98, 4, wood); for (let x = 3; x < 96; x += 7) rail.box(x, 154, 3, 12, dark); rail.box(0, 165, 98, 3, wood); rail.outline(hex('#2a160a'));
    return { layers: [P, (D, t) => usFlag(D, t, 17, 12), clockHands(52, 84, 6), L.pendantLamps([[40, 12], [142, 8]]),
      L.spectators([[8, 132, 0], [24, 134, 3], [42, 131, 1], [60, 134, 5], [78, 132, 2]]), rail, motes(16, 0, 0, PW, 150)],
      front: [L.counselTable(50, 284), L.stenographer(146, 300)], F, judgeX: 138, judgeY: 166 };
  },
  office() {
    const wall = new Pix(PW, PH);
    for (let y = 0; y < 150; y++) for (let x = 0; x < PW; x++) wall.set(x, y, hex(y % 24 === 0 ? '#7f93ab' : '#94a8bf'));
    wall.rect(24, 20, 132, 82, hex('#e8eef4')); gradient(wall, 24, 98, ['#5fa8e0', '#8cc4ef', '#bfe0f6']); wall.rect(0, 24, 28, 74, hex('#94a8bf')); wall.rect(152, 24, 28, 74, hex('#94a8bf')); wall.rect(24, 20, 132, 4, hex('#e8eef4')); wall.rect(24, 98, 132, 4, hex('#e8eef4')); wall.rect(24, 24, 4, 74, hex('#e8eef4')); wall.rect(152, 24, 4, 74, hex('#e8eef4'));
    for (let y = 150; y < PH; y++) for (let x = 0; x < PW; x++) wall.set(x, y, hex((x * 3 + y * 5) % 7 ? '#5c6f86' : '#536479'));
    const city = new Pix(PW, PH), cr = ramp(['#4c6a8a', '#6a88a8', '#8aa6c4']), lights = [];
    for (const [x, w, h] of [[30, 16, 40], [50, 12, 55], [66, 20, 34], [90, 14, 60], [108, 18, 44], [130, 20, 52]]) { city.box(x, 98 - h, w, h, cr); for (let y = 98 - h + 4; y < 96; y += 6) for (let i = 2; i < w - 2; i += 4) lights.push([x + i, y]); }
    city.rect(89, 24, 2, 74, hex('#e8eef4'));
    wall.ellipse(168, 40, 6, 6, hex('#3a4656')); wall.ellipse(168, 40, 5, 5, hex('#f4f1e8'));
    const potP = new Pix(PW, PH); potP.box(150, 140, 12, 12, ramp(['#8a5a34', '#b07a4a', '#d09a6a']));
    const plant = (D, t) => { const lean = wind(t * 0.6, 0); for (let k = 0; k < 7; k++) { const a = -1.3 + k * 0.43, len = 12 + (k % 3) * 4; for (let i = 0; i < len; i++) { const f = i / len, x = 156 + Math.sin(a) * i * 0.7 + lean * f * f * 2, y = 140 - Math.cos(a) * i * 0.9; D.px(x, y, i > len - 4 ? '#5a9c68' : '#3b7446'); D.px(x + 1, y, '#2c5a36'); } } };
    return { layers: [wall, (D, t) => D.clip(28, 24, 124, 74, () => { clouds([[0, 34, 0.8, 2.0], [90, 50, 0.6, 2.8]])(D, t); birds([[40, 15, 3, 1]])(D, t); }), city,
      (D, t) => lights.forEach(([x, y], i) => { if (hash(i, Math.floor(t * 0.4 + hash(i) * 10)) > 0.3) D.px(x, y, '#f2e8a8'); }),
      (D, t) => { if (t % 1.6 < 0.8) { D.px(97, 37, '#ff4a3a'); D.px(57, 42, '#ff4a3a'); } },
      L.typists([[44, 126, 0], [120, 126, 3]]), L.waterCooler(12, 150), clockHands(168, 40, 5), potP, plant],
      front: [L.officeDesk(130, 280), L.pottedPlant(22, 300)] };
  },
  capitol() {
    const sky = new Pix(PW, PH); gradient(sky, 0, 140, ['#3f8ad4', '#5ea6e4', '#8cc4ef', '#c2e2f6']);
    const P = new Pix(PW, PH), stone = ramp(['#c8c2b4', '#e6e0d2', '#fbf8f0']);
    P.box(40, 98, 100, 44, stone); for (let x = 46; x < 136; x += 9) P.box(x, 104, 5, 36, stone);
    P.box(60, 80, 60, 20, stone); P.box(70, 60, 40, 22, stone); P.ellipse(90, 58, 16, 12, stone[2]); P.ellipse(90, 58, 14, 10, stone[1]); P.rect(89, 30, 1, 18, hex('#5a6a7a'));
    for (let i = 0; i < 4; i++) P.box(34 - i * 4, 140 + i * 3, 112 + i * 8, 4, stone);
    seed = 5; noise(P, 150, PH, ramp(['#4f8a3a', '#68a64a', '#86c062']));
    for (let y = 150; y < PH; y++) { const half = 8 + (y - 150) * 0.35; for (let x = Math.round(90 - half); x <= 90 + half; x++) P.set(x, y, hex((x + y) % 5 ? '#d8cfbd' : '#cbc1ae')); }
    const lamps = new Pix(PW, PH); for (const x of [46, 134]) { lamps.rect(x, 150, 2, 34, hex('#2a2e36')); lamps.rect(x - 2, 146, 6, 5, hex('#2a2e36')); lamps.rect(x - 1, 147, 4, 3, hex('#ffe8a0')); }
    seed = 13; const tufts = tuftList(50, (x, y) => Math.abs(x - 90) > 10 + (y - 150) * 0.35, 154, PH);
    return { layers: [sky, clouds([[0, 20, 1, 2.0], [110, 30, 0.8, 2.6], [60, 70, 0.6, 3.2]]), birds([[44, 19, 4, -1]]), P,
      (D, t) => usFlag(D, t, 90, 30, 12, 8), pines([[14, 150, 34], [166, 150, 30]], 2), lamps,
      L.walkers([[160, 15, 0, 1, 0, 'camera'], [165, 19, 6, -1, 2, 'bag'], [157, 22, 11, 1, 4, 'balloon'], [168, 17, 3, -1, 5, null], [154, 26, 17, 1, 1, null]]),
      grass(tufts, ['#3f6a28', '#6aa64a', '#9ccc70'])],
      front: [L.pigeons([[26, 252], [42, 258], [150, 262], [164, 254]]), L.benchReader(150, 300, 4)] };
  },
  studio() {
    const floor = new Pix(PW, PH);
    for (let y = 150; y < PH; y++) for (let x = 0; x < PW; x++) floor.set(x, y, hex(dith(x, y) < 0.5 ? '#e0b45a' : '#d6a84e'));
    floor.rect(0, 150, PW, 2, hex('#b8862e'));
    const back = (D, t) => { const off = (t * 3) % 44; for (let x = -44; x < PW + 44; x += 44) { D.rect(x + off, 0, 22, 150, '#3d7fd0'); D.rect(x + off + 22, 0, 22, 150, '#4f92de'); } };
    const stars = (D, t) => { for (let i = 0; i < 9; i++) { const ph = (t * 0.5 + hash(i)) % 1; if (ph > 0.6) continue; const x = 10 + hash(i, 1) * 160, y = 14 + hash(i, 2) * 110, r = ph < 0.3 ? 1 : 2; D.px(x, y, '#ffffff'); for (let k = 1; k <= r; k++) { D.px(x - k, y, '#cfe6ff'); D.px(x + k, y, '#cfe6ff'); D.px(x, y - k, '#cfe6ff'); D.px(x, y + k, '#cfe6ff'); } } };
    const shelf = new Pix(PW, PH), sw = ramp(['#4a2c18', '#6e4426', '#8e5a34']);
    shelf.box(4, 70, 40, 80, sw); for (const y of [74, 100, 126]) { shelf.rect(6, y + 22, 36, 2, sw[0]); let x = 7; for (let k = 0; x < 40; k++) { const w = 3 + (k * 7) % 3, h = 16 + (k * 5) % 6, c = ['#8e1e1e', '#1d2f6b', '#2c5a36', '#c9a13a', '#5a2a6a'][k % 5]; shelf.rect(x, y + 22 - h, w, h, hex(c)); shelf.rect(x, y + 24 - h, w, 1, hex('#e6c35a')); x += w + 1; } }
    shelf.box(146, 136, 22, 14, sw); shelf.outline(hex('#22140a'));
    const rugP = L.rug(90, 198, 72, 24), books = L.bookStack(150, 300);
    return { layers: [back, L.spotlights([[30, 9, 0], [150, 11, 1.3]]), stars, shelf, L.globe(157, 125), floor, rugP, L.lightPools([[90, 200, 9, 0], [90, 252, 11, 1.3]])],
      front: [L.pottedPlant(24, 304), books] };
  },
};

// ---------- more helpers for the town sets ----------
function brickWall(P, x0, y0, w, h, base, mortar) { const b = ramp(base); for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) { const row = Math.floor((y - y0) / 4), off = row % 2 ? 4 : 0; const edge = (y - y0) % 4 === 3 || (x - x0 + off) % 8 === 7; P.set(x, y, edge ? hex(mortar) : b[(x * 7 + y * 3) % 11 < 2 ? 0 : (x * 5 + y) % 13 < 2 ? 2 : 1]); } }
function awning(P, x, y, w, cols) { for (let i = 0; i < w; i++) for (let j = 0; j < 7; j++) P.set(x + i, y + j + (j === 6 && i % 6 > 2 ? 1 : 0), hex(cols[Math.floor(i / 6) % 2])); }
const leafy = (list) => (D, t) => list.forEach(([x, base, r], i) => { D.rect(x - 2, base - r - 4, 4, r + 4, '#6e4a30'); const sw = wind(t, x) * 1.6;
  const greens = ['#2c6a2a', '#3f8a3a', '#57a048', '#6ab04c'];
  for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2, rr = r * 0.55, cx = x + Math.cos(a) * rr + sw * (0.6 + k % 3 * 0.2), cy = base - r * 1.5 + Math.sin(a) * rr * 0.7;
    for (let j = -r * 0.6; j <= r * 0.6; j++) for (let q = -r * 0.6; q <= r * 0.6; q++) if (q * q + j * j <= r * r * 0.36) D.px(cx + q, cy + j, greens[(j < -2 ? 3 : j > 2 ? 0 : 1 + ((q + k) & 1))]); }
  if (frac(t / 6 + i * 0.3) < 0.25) { const q = frac(t / 6 + i * 0.3) * 4; D.px(x + sw * 3 + q * 10, base - r + q * 20, '#8ac05a'); } });
const frac = x => x - Math.floor(x);

Object.assign(SETS, {
  street() {
    const sky = new Pix(PW, PH); gradient(sky, 0, 150, ['#4a98dc', '#73b6ea', '#a6d4f3', '#cfe9f8']);
    const B = new Pix(PW, PH), wins = [];
    const blds = [[0, 34, 26, ['#8e3a2a', '#a8483a', '#c25a48'], '#6a2a20'], [46, 40, 10, ['#3f7a8a', '#4f8f9f', '#6aa8b8'], '#2c5a66'], [86, 50, 34, ['#c8b48a', '#e0cca0', '#f0e0b8'], '#a8946a'], [136, 44, 18, ['#6a4a8a', '#7e5aa0', '#9a74ba'], '#4a3266']];
    for (const [x, w, top, col, dark] of blds) { brickWall(B, x, top, w, 150 - top, col, dark); B.rect(x, top, w, 3, hex(dark)); B.rect(x - 1, top - 2, w + 2, 2, hex('#e8e0d0'));
      for (let y = top + 10; y < 108; y += 16) for (let wx = x + 5; wx < x + w - 8; wx += 12) { B.rect(wx - 1, y - 1, 9, 12, hex('#e8e0d0')); wins.push([wx, y, 7, 10]); } }
    awning(B, 2, 112, 30, ['#d8342c', '#f4f1e8']); awning(B, 88, 112, 32, ['#2d6fd6', '#f4f1e8']); awning(B, 138, 114, 38, ['#3f9a4a', '#f4f1e8']);
    for (const [x, w] of [[4, 26], [90, 28], [140, 34]]) { B.rect(x, 122, w, 26, hex('#9fd3f0')); B.rect(x, 122, w, 1, hex('#e8eef4')); B.rect(x + w / 2 | 0, 122, 1, 26, hex('#e8eef4')); }
    B.rect(52, 118, 12, 32, hex('#5a3218')); B.rect(54, 120, 8, 12, hex('#9fd3f0'));
    const ground = new Pix(PW, PH);
    for (let y = 150; y < 204; y++) for (let x = 0; x < PW; x++) ground.set(x, y, hex((x % 16 === 0 || (y - 150) % 12 === 0) ? '#a8a8b0' : '#c4c4cc'));
    ground.rect(0, 202, PW, 4, hex('#8a8a92'));
    for (let y = 206; y < 292; y++) for (let x = 0; x < PW; x++) ground.set(x, y, hex((x * 7 + y * 13) % 17 < 2 ? '#3a3e46' : '#4a4e56'));
    for (let x = 4; x < PW; x += 22) ground.rect(x, 248, 12, 2, hex('#f2e8a8'));
    for (let y = 292; y < PH; y++) for (let x = 0; x < PW; x++) ground.set(x, y, hex((x % 16 === 0 || (y - 292) % 12 === 0) ? '#a8a8b0' : '#c4c4cc'));
    ground.rect(0, 290, PW, 3, hex('#8a8a92'));
    const hyd = new Pix(PW, PH); hyd.box(8, 186, 7, 14, ramp(['#9a1e1a', '#d8342c', '#ff6a52'])); hyd.box(6, 190, 11, 3, ramp(['#9a1e1a', '#d8342c', '#ff6a52'])); hyd.outline(hex('#3a1010'));
    return { layers: [sky, clouds([[0, 16, 0.9, 2.2], [100, 40, 0.7, 3.0]]), birds([[24, 18, 2, 1]]), B, L.windowsLife(wins), ground,
      L.walkers([[160, 14, 0, 1, 0, 'bag'], [158, 17, 5, -1, 3, null], [162, 21, 11, 1, 5, 'camera'], [157, 19, 15, -1, 1, null]]), hyd],
      front: [L.traffic([[246, 9, 0, 1, 0, 'car'], [246, 13, 6, 1, 2, 'bus'], [282, 8, 3, -1, 1, 'car'], [282, 11, 8, -1, 4, 'van']]),
        L.manholeSteam(150, 268), L.trafficLight(172, 204)] };
  },
  neighborhood() {
    const sky = new Pix(PW, PH); gradient(sky, 0, 120, ['#3f8ad4', '#5ea6e4', '#8cc4ef', '#c2e2f6']);
    const H = new Pix(PW, PH), wins = [];
    for (const [x, w, wall, roof] of [[6, 70, '#e8d8b8', '#8e3a2a'], [100, 74, '#a8c8e0', '#3a4a66']]) {
      H.rect(x, 96, w, 54, hex(wall)); for (let y = 98; y < 150; y += 4) H.rect(x, y, w, 1, hex('#d0c0a0'));
      for (let j = 0; j < 26; j++) H.rect(x - 4 + j, 96 - j, w + 8 - j * 2, 1, hex(j % 4 === 0 ? '#5a2018' : roof));
      H.rect(x + w / 2 - 6 | 0, 122, 12, 28, hex('#7a4a28')); H.set(x + w / 2 + 3 | 0, 136, hex('#f2c230'));
      wins.push([x + 6, 104, 14, 12], [x + w - 20, 104, 14, 12]); H.rect(x + w - 16, 66, 6, 14, hex('#8e5a3a')); }
    const yard = new Pix(PW, PH); seed = 23; noise(yard, 150, 238, ramp(['#4f8a3a', '#68a64a', '#86c062']));
    for (let x = 0; x < PW; x += 6) { yard.rect(x, 150, 4, 14, hex('#f4f1e8')); yard.set(x + 1, 149, hex('#f4f1e8')); yard.set(x + 2, 149, hex('#f4f1e8')); } yard.rect(0, 154, PW, 2, hex('#e0dcd0')); yard.rect(0, 160, PW, 2, hex('#e0dcd0'));
    yard.rect(0, 238, PW, 8, hex('#c4c4cc')); for (let y = 246; y < 292; y++) for (let x = 0; x < PW; x++) yard.set(x, y, hex((x * 7 + y * 13) % 17 < 2 ? '#3a3e46' : '#4a4e56'));
    seed = 29; noise(yard, 292, PH, ramp(['#4f8a3a', '#68a64a', '#86c062']));
    yard.rect(148, 180, 2, 20, hex('#5a3a20')); yard.box(143, 172, 12, 9, ramp(['#1d3a7a', '#2d5ab0', '#4f7fd6']));
    seed = 31; const tufts = tuftList(30, (x, y) => true, 168, 236);
    return { layers: [sky, clouds([[20, 24, 1, 2.0], [130, 44, 0.8, 2.6]]), birds([[30, 16, 1, 1], [56, 22, 8, -1]]), H, L.windowsLife(wins), leafy([[88, 150, 14], [176, 150, 12]]), yard,
      L.mower(176, 22), grass(tufts, ['#3f6a28', '#6aa64a', '#9ccc70'])],
      front: [L.cyclist(286, 16, 2, 1, 1), L.traffic([[286, 21, 9, -1, 3, 'car']]), L.sprinkler(22, 228), L.dog(166, 214, 0)] };
  },
  shop() {
    const P = new Pix(PW, PH);
    for (let y = 0; y < 150; y++) for (let x = 0; x < PW; x++) P.set(x, y, hex(y < 20 ? '#d8dce4' : '#ece6d8'));
    P.rect(0, 20, PW, 2, hex('#b8bcc4'));
    const prod = ['#d8342c', '#f2c230', '#2d6fd6', '#3f9a4a', '#e866a8', '#f08a44', '#7a4ab0', '#f4f1e8'];
    for (const x0 of [4, 64, 124]) { P.rect(x0, 40, 52, 110, hex('#8a9aa8')); P.rect(x0 + 2, 42, 48, 106, hex('#b8c4cc'));
      for (let sh = 0; sh < 4; sh++) { const y = 48 + sh * 26; P.rect(x0 + 2, y + 18, 48, 3, hex('#6a7a88')); for (let x = x0 + 4; x < x0 + 48;) { const w = 4 + ((x * 3 + sh) % 4), h = 10 + ((x + sh * 5) % 7); P.rect(x, y + 18 - h, w, h, hex(prod[(x + sh * 3) % prod.length])); P.rect(x, y + 18 - h + 2, w, 1, hex('#ffffff')); x += w + 1; } } }
    for (const [x, t] of [[30, 'SALE'], [150, '50%']]) { P.rect(x - 14, 24, 28, 12, hex('#d8342c')); pixText(P, x - 11, 27, t, hex('#ffffff')); }
    for (let y = 150; y < PH; y++) for (let x = 0; x < PW; x++) P.set(x, y, hex(((x >> 3) + (y >> 3)) % 2 ? '#e4e0d8' : '#cfcac0'));
    const counter = new Pix(PW, PH); counter.box(104, 270, 76, 30, ramp(['#5a6a7a', '#7a8a9a', '#9aaaba'])); counter.rect(104, 268, 76, 3, hex('#2a2e36')); counter.rect(112, 262, 14, 8, hex('#2a2e36')); counter.rect(114, 264, 10, 4, hex('#5aff7a'));
    return { layers: [P, L.fluorescent([[16, 8, 30], [76, 10, 30], [136, 8, 30]]), L.secCam(166, 22), L.shoppers([[158, 16, 0, 1, 0], [160, 19, 7, -1, 2], [156, 23, 12, 1, 4]])],
      front: [L.cashier(150, 270, 5), counter, L.pottedPlant(20, 306)] };
  },
  harbor() {
    const sky = new Pix(PW, PH); gradient(sky, 0, 92, ['#3a7ac0', '#5e9ad8', '#8cbce8', '#c8e0f2']);
    const far = new Pix(PW, PH); for (let x = 0; x < PW; x++) { const top = 84 + Math.round(Math.sin(x * 0.07) * 3 + Math.sin(x * 0.19) * 2); for (let y = top; y < 92; y++) far.set(x, y, hex('#5a7a8a')); }
    const dock = new Pix(PW, PH), wood = ramp(['#6e4a30', '#8e6644', '#a8805a']);
    for (let y = 150; y < PH; y++) for (let x = 0; x < PW; x++) dock.set(x, y, (y - 150) % 9 === 0 ? wood[0] : wood[(x * 3 + Math.floor((y - 150) / 9) * 7) % 23 < 2 ? 0 : 1]);
    for (let x = 0; x < PW; x += 30) dock.rect(x + 2, 151, 5, 4, hex('#2a2e36'));
    dock.rect(0, 148, PW, 3, hex('#5a3a20'));
    const props = new Pix(PW, PH); for (const [x, y, c] of [[150, 300, '#2d6fd6'], [164, 300, '#d8342c'], [157, 288, '#3f9a4a']]) { props.box(x - 7, y - 12, 14, 12, ramp(['#3a3a3a', c, c])); }
    props.ellipse(24, 296, 9, 4, hex('#c8a46a')); props.ellipse(24, 295, 6, 2, hex('#a8844a')); props.rect(44, 280, 6, 14, hex('#2a2e36')); props.rect(42, 278, 10, 3, hex('#2a2e36')); props.outline(hex('#1a1418'));
    return { layers: [sky, clouds([[10, 20, 1, 2.0], [120, 40, 0.8, 2.8]]), L.gulls([[60, 40, 30, 0.4], [130, 30, 20, 0.6], [100, 60, 26, -0.5]]), far, L.lighthouse(16, 98), L.sea(92, 150),
      L.boat(96, 122, 0, 24), L.fishJump(60, 136, 8), L.boat(20, 144, 1, 8), dock, L.crane(160, 150)],
      front: [props, L.gulls([[40, 250, 6, 0.3]])] };
  },
  prison() {
    const sky = new Pix(PW, PH); gradient(sky, 0, 80, ['#2a3a66', '#4a5a8a', '#8a8aa8', '#d0a888']);
    const W = new Pix(PW, PH), stone = ramp(['#6a6e78', '#82868f', '#9a9ea6']);
    for (let y = 70; y < 150; y++) for (let x = 0; x < PW; x++) W.set(x, y, (y - 70) % 10 === 9 || (x + ((y - 70) / 10 | 0) * 9) % 18 === 0 ? stone[0] : stone[(x * 5 + y * 3) % 17 < 2 ? 2 : 1]);
    for (let x = 0; x < PW; x += 4) { W.set(x, 66, hex('#b8bcc4')); W.set(x + 1, 65, hex('#b8bcc4')); W.set(x + 2, 66, hex('#b8bcc4')); W.set(x + 3, 67, hex('#b8bcc4')); } W.rect(0, 68, PW, 2, hex('#5a5e66'));
    W.box(140, 20, 26, 50, stone); W.rect(136, 14, 34, 8, hex('#4a4e56')); W.rect(144, 26, 18, 10, hex('#2a2e36')); W.rect(146, 28, 14, 6, hex('#f2dc8a'));
    W.rect(60, 104, 40, 46, hex('#3a3e46')); for (let x = 62; x < 100; x += 4) W.rect(x, 104, 1, 46, hex('#6a6e78'));
    const ground = new Pix(PW, PH); seed = 41; noise(ground, 150, PH, ramp(['#8a8478', '#a09a8c', '#b8b2a2']));
    const yard = new Pix(PW, PH); seed = 43;
    for (let k = 0; k < 26; k++) { const x = rnd() * PW | 0, y = 160 + rnd() * 150 | 0; yard.set(x, y, hex('#5a7a3a')); yard.set(x + 1, y - 1, hex('#6a8a4a')); yard.set(x - 1, y - 1, hex('#5a7a3a')); }
    yard.ellipse(130, 262, 16, 4, hex('#6a7a8a')); yard.ellipse(128, 261, 10, 2, hex('#8a9aaa'));
    yard.rect(20, 208, 3, 60, hex('#2a2e36')); yard.rect(14, 204, 15, 5, hex('#2a2e36')); yard.rect(16, 205, 11, 3, hex('#fff6d0'));
    return { layers: [sky, clouds([[20, 22, 0.8, 1.6], [120, 40, 0.6, 2.2]]), birds([[30, 20, 4, 1]]), L.searchlight(153, 22, 12), W, L.patrol(70, 26, 1), ground, (D, t) => D.rect(0, 150, PW, 2, '#6a6e78')],
      front: [yard, L.pigeons([[90, 288], [104, 294]]), (D, t) => { if (frac(t / 3) < 0.6) for (let r = 1; r < 3; r++) D.px(130 + Math.round(Math.sin(t * 3 + r) * 8), 262, '#cfe0ee'); }] };
  },
  campsite() {
    const sky = new Pix(PW, PH); gradient(sky, 0, 100, ['#3f8ad4', '#5ea6e4', '#8cc4ef', '#c2e2f6']);
    const far = new Pix(PW, PH); mountains(far, 104, [[30, 50, 70], [120, 38, 90]]);
    const lake = (D, t) => { for (let y = 104; y < 136; y++) D.rect(0, y, PW, 1, y < 112 ? '#5ea6e4' : y < 124 ? '#3f8ac4' : '#2f74b0'); for (let r = 0; r < 5; r++) for (let x = 0; x < 196; x += 18) { const xx = ((x + t * (3 + r) * (r % 2 ? 1 : -1)) % 196 + 196) % 196; D.rect(xx - 8, 108 + r * 6, 4, 1, '#9fd3f0'); } };
    const ground = new Pix(PW, PH); seed = 51; noise(ground, 136, PH, ramp(['#4f7a32', '#679a3e', '#86b552']));
    for (let y = 176; y < 236; y++) for (let x = 0; x < PW; x++) if (((x - 92) / 70) ** 2 + ((y - 206) / 26) ** 2 < 1) ground.set(x, y, hex((x * 3 + y * 7) % 11 < 2 ? '#8a6a40' : '#a8845a'));
    const near = new Pix(PW, PH), bark = ramp(['#4a3020', '#6e4a30', '#8e6644']); near.box(56, 290, 50, 8, bark); near.box(120, 296, 34, 8, bark); near.outline(hex('#1e1a10'));
    seed = 53; const tufts = tuftList(50, (x, y) => ((x - 92) / 70) ** 2 + ((y - 206) / 26) ** 2 > 1, 140, PH);
    return { layers: [sky, clouds([[10, 20, 1, 2.0], [110, 34, 0.8, 2.6]]), L.eagle(90, 30, 30), far, lake, L.boat(110, 126, 0, 12), L.fishJump(40, 122, 9),
      pines([[6, 140, 30], [22, 144, 36], [160, 140, 34], [174, 146, 28]], 2), ground, L.deer(146, 30, 6), L.tent(150, 176), grass(tufts), L.campfire(92, 214),
      L.butterflies([[40, 170, '#f2c230'], [140, 190, '#e866a8']])],
      front: [near, L.rabbit(272, 13, 5, -1)] };
  },
});
const ALIAS = { 'bg-street': 'street', 'bg-neighborhood': 'neighborhood', 'bg-shop': 'shop', 'bg-harbor': 'harbor', 'bg-prison': 'prison', 'bg-campsite': 'campsite', 'bg-yellowstone': 'yellowstone', 'bg-courtroom': 'courtroom', 'bg-office': 'office', 'bg-capitol': 'capitol', white: 'studio', 'bg-studio': 'studio' };
const cache = {};
export function getSet(bg) { const k = ALIAS[bg] || (SETS[(bg || '').replace(/^bg-/, '')] ? bg.replace(/^bg-/, '') : 'studio'); seed = 1; return cache[k] ||= SETS[k](); }
