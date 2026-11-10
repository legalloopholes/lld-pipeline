// Pixel RPG sets, 180 x 320, drawn in code. Feet stand on y = FEET (60% of the frame; captions live below).
import { Pix, hex, ramp } from './kit.js';

export const PW = 180, PH = 320, FEET = 192;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const dith = (x, y) => (BAYER[(x & 3) + (y & 3) * 4] + 0.5) / 16;
let seed = 1; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

function gradient(P, y0, y1, cols) { const r = ramp(cols); for (let y = y0; y < y1; y++) for (let x = 0; x < PW; x++) { const t = (y - y0) / (y1 - y0) * (r.length - 1); P.set(x, y, r[Math.min(r.length - 1, Math.floor(t + dith(x, y) - 0.25))]); } }
function noise(P, y0, y1, r, test = () => true, p = [0.12, 0.88]) { for (let y = y0; y < y1; y++) for (let x = 0; x < PW; x++) if (test(x, y)) { const n = rnd(); P.set(x, y, r[n < p[0] ? 0 : n > p[1] ? 2 : 1]); } }
function clouds(P, list) { const cl = ramp(['#b9d3e6', '#e7f1f8', '#ffffff']); for (const [cx, cy, s] of list) for (let k = 0; k < 5; k++) { const ex = cx + (k - 2) * 7 * s, ey = cy - (k % 2) * 3 * s; P.ellipse(ex | 0, ey | 0, (7 * s) | 0, (4 * s) | 0, cl[2]); P.ellipse(ex | 0, (ey + 3 * s) | 0, (6 * s) | 0, (1.5 * s) | 0, cl[1]); } }
function pine(P, x, base, h) { const pn = ramp(['#16351f', '#24502e', '#357040']); for (let j = 0; j < h; j++) { const half = Math.floor((j % (h / 3 | 0)) * 0.55 + j * 0.18) + 1; for (let i = -half; i <= half; i++) P.set(x + i, base - h + j, pn[i < 0 ? 2 : i > half / 2 ? 0 : 1]); } P.rect(x - 1, base, 2, 3, hex('#4a3020')); }
function mountains(P, base, list) { const mt = ramp(['#4c6585', '#6b86a8', '#8ea7c4']), snow = ramp(['#c8d6e4', '#eef3f8', '#ffffff']);
  for (const [px_, py, w] of list) for (let y = py; y < base; y++) { const half = (y - py) * w / 120; for (let x = Math.round(px_ - half); x <= px_ + half; x++) P.set(x, y, y - py < 12 + ((x * 7) % 5) ? snow[x < px_ ? 2 : 1] : mt[x < px_ - half * 0.3 ? 2 : x > px_ + half * 0.4 ? 0 : 1]); } }
function steam(P, x, y) { const st = ramp(['#d9e4ea', '#eef4f7', '#ffffff']); for (let k = 0; k < 6; k++) P.ellipse(x + Math.round(Math.sin(k * 1.7) * 4), y - k * 8, 5 + k, 3 + (k >> 1), st[k % 3]); }

const SETS = {
  yellowstone() {
    const P = new Pix(PW, PH);
    gradient(P, 0, 110, ['#2f7cc8', '#4a98dc', '#73b6ea', '#a6d4f3', '#cfe9f8']); clouds(P, [[30, 22, 1.1], [130, 14, 0.9], [156, 44, 0.7]]);
    mountains(P, 110, [[22, 52, 70], [98, 40, 90], [162, 58, 60]]);
    const hill = ramp(['#2c5a36', '#3b7446', '#4f8f57']);
    for (let x = 0; x < PW; x++) { const top = 100 + Math.round(Math.sin(x * 0.05) * 4 + Math.sin(x * 0.13) * 2); for (let y = top; y < 130; y++) P.set(x, y, hill[y - top < 2 ? 2 : 1]); }
    for (let i = 0; i < 16; i++) pine(P, 4 + i * 11 + (i % 2) * 3, 126 + (i % 3) * 3, 20 + (i % 4) * 4);
    noise(P, 130, PH, ramp(['#4f7a32', '#679a3e', '#86b552']));
    for (let i = 0; i < 4; i++) pine(P, i < 2 ? 8 + i * 15 : 150 + (i - 2) * 18, 150 + (i % 2) * 4, 28 + (i % 3) * 5);
    noise(P, 150, PH, ramp(['#9a7240', '#c09a62', '#dcbc84']), (x, y) => ((x - 90) / 125) ** 2 + ((y - 215) / 62) ** 2 < 1, [0.15, 0.85]);
    P.ellipse(148, 168, 20, 7, hex('#e39a3a')); P.ellipse(148, 168, 16, 5, hex('#3fb0b8')); P.ellipse(149, 168, 9, 3, hex('#1f6fb0')); steam(P, 148, 158);
    return { P };
  },
  courtroom() {
    const P = new Pix(PW, PH), wood = ramp(['#5a3218', '#7a4626', '#9a5e36']), dark = ramp(['#3a2010', '#4e2c16', '#64391e']);
    for (let y = 0; y < 150; y++) for (let x = 0; x < PW; x++) P.set(x, y, x % 12 === 0 ? dark[0] : wood[(x % 12 < 2) ? 2 : 1]);         // panelled wall
    P.rect(0, 60, PW, 3, dark[2]); P.rect(0, 146, PW, 4, dark[0]);
    P.ellipse(90, 34, 18, 18, hex('#c9a13a')); P.ellipse(90, 34, 15, 15, hex('#e6c35a')); P.ellipse(90, 34, 10, 10, hex('#1d2f6b'));         // seal
    for (let i = 0; i < 5; i++) P.set(86 + i * 2, 32 + (i % 2), hex('#f4f1e8'));
    P.rect(14, 10, 3, 80, hex('#c9a13a')); P.rect(17, 12, 20, 13, hex('#c23030')); for (let y = 14; y < 25; y += 3) P.rect(17, y, 20, 1, hex('#f4f1e8')); P.rect(17, 12, 8, 7, hex('#1d2f6b'));   // flag
    for (let y = 150; y < PH; y++) for (let x = 0; x < PW; x++) { const k = ((x >> 4) + (y >> 3)) % 2; P.set(x, y, hex(k ? '#c8a47a' : '#b38e64')); }                  // floor tiles
    const F = new Pix(PW, PH);                                                                                                          // bench in front of the judge
    F.box(96, 150, 84, 46, wood, 0); F.rect(96, 150, 84, 4, dark[2]); F.box(120, 166, 34, 10, ramp(['#a07a22', '#d9a93a', '#ffe08a']));
    return { P, F, judgeX: 138, judgeY: 166 };
  },
  office() {
    const P = new Pix(PW, PH);
    for (let y = 0; y < 150; y++) for (let x = 0; x < PW; x++) P.set(x, y, hex(y % 24 === 0 ? '#7f93ab' : '#94a8bf'));
    P.rect(24, 20, 132, 82, hex('#e8eef4')); P.rect(28, 24, 124, 74, hex('#9fd0f0'));
    const city = ramp(['#4c6a8a', '#6a88a8', '#8aa6c4']); for (const [x, w, h] of [[30, 16, 40], [50, 12, 55], [66, 20, 34], [90, 14, 60], [108, 18, 44], [130, 20, 52]]) { P.box(x, 98 - h, w, h, city); for (let y = 98 - h + 4; y < 96; y += 6) for (let i = 2; i < w - 2; i += 4) P.set(x + i, y, hex('#f2e8a8')); }
    P.rect(89, 24, 2, 74, hex('#e8eef4'));
    for (let y = 150; y < PH; y++) for (let x = 0; x < PW; x++) P.set(x, y, hex((x * 3 + y * 5) % 7 ? '#5c6f86' : '#536479'));
    P.box(150, 116, 14, 34, ramp(['#2c5a36', '#3b7446', '#4f8f57']), 3); P.box(152, 140, 10, 12, ramp(['#8a5a34', '#b07a4a', '#d09a6a']));
    return { P };
  },
  capitol() {
    const P = new Pix(PW, PH);
    gradient(P, 0, 140, ['#3f8ad4', '#5ea6e4', '#8cc4ef', '#c2e2f6']); clouds(P, [[26, 20, 1], [150, 30, 0.8]]);
    const stone = ramp(['#c8c2b4', '#e6e0d2', '#fbf8f0']);
    P.box(40, 98, 100, 44, stone); for (let x = 46; x < 136; x += 9) P.box(x, 104, 5, 36, stone);
    P.box(60, 80, 60, 20, stone); P.box(70, 60, 40, 22, stone); P.ellipse(90, 58, 16, 12, stone[2]); P.ellipse(90, 58, 14, 10, stone[1]); P.rect(89, 38, 2, 10, hex('#5a6a7a'));
    for (let i = 0; i < 4; i++) P.box(34 - i * 4, 140 + i * 3, 112 + i * 8, 4, stone);
    noise(P, 150, PH, ramp(['#4f8a3a', '#68a64a', '#86c062']));
    for (let y = 150; y < PH; y++) { const half = 8 + (y - 150) * 0.35; for (let x = Math.round(90 - half); x <= 90 + half; x++) P.set(x, y, hex((x + y) % 5 ? '#d8cfbd' : '#cbc1ae')); }
    pine(P, 14, 150, 34); pine(P, 166, 150, 30);
    return { P };
  },
  studio() {
    const P = new Pix(PW, PH);
    for (let y = 0; y < 150; y++) for (let x = 0; x < PW; x++) P.set(x, y, hex(((x + 400) / 22 | 0) % 2 ? '#3d7fd0' : '#4f92de'));
    gradient(P, 0, 40, ['#2c63a8', '#3d7fd0']);
    for (let y = 150; y < PH; y++) for (let x = 0; x < PW; x++) P.set(x, y, hex(dith(x, y) < 0.5 ? '#e0b45a' : '#d6a84e'));
    P.rect(0, 150, PW, 2, hex('#b8862e'));
    return { P };
  },
};
const ALIAS = { 'bg-yellowstone': 'yellowstone', 'bg-courtroom': 'courtroom', 'bg-office': 'office', 'bg-capitol': 'capitol', white: 'studio', 'bg-studio': 'studio' };
const cache = {};
export function getSet(bg) { const k = ALIAS[bg] || (SETS[(bg || '').replace(/^bg-/, '')] ? bg.replace(/^bg-/, '') : 'studio'); seed = 1; return cache[k] ||= SETS[k](); }
