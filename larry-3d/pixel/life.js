// Background life for the pixel sets: animals, passers-by, props that move. Everything is drawn in code each frame
// on the 180x320 canvas through the painter D (D.px / D.rect / D.img), and depends only on time t, so any frame
// can be rendered on its own.
import { Pix, hex, ramp } from './kit.js';

// wind: a slow travelling wave plus gusts, -1..1
export const wind = (t, x = 0) => Math.sin(t * 1.5 - x * 0.045) * 0.6 + Math.sin(t * 0.47 + 1.3) * 0.4;
const hash = (a, b = 0) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
const frac = x => x - Math.floor(x);
const pingpong = (t, per) => { const p = frac(t / per) * 2; return p < 1 ? p : 2 - p; };   // 0..1..0

// ---------- nature ----------
export function geyser(x, base, per = 15, off = 0) {         // Old Faithful style: rumble, eruption, then drifting steam
  return (D, t) => {
    D.rect(x - 7, base - 2, 15, 3, '#d9c9a0'); D.rect(x - 5, base - 4, 11, 2, '#e8dcb8'); D.rect(x - 2, base - 5, 5, 1, '#bfae84');
    const p = frac((t + off) / per), erupt = p > 0.55 && p < 0.85, k = erupt ? Math.sin((p - 0.55) / 0.3 * Math.PI) : 0;
    const h = Math.round(6 + k * 70);
    for (let j = 0; j < h; j++) { const w = 1 + Math.round(j / h * 3 * (erupt ? 1 : 0.3)), sway = Math.round(wind(t, x) * j / 40);
      for (let i = -w; i <= w; i++) { if (frac(j * 0.37 + t * 3 + i * 0.21) < 0.18) continue; D.px(x + i + sway, base - 5 - j, (i + j) % 3 ? '#ffffff' : '#dcebf2'); } }
    if (erupt) for (let s = 0; s < 10; s++) { const a = hash(s) * 6.28, r = frac(t * 1.2 + hash(s, 1)) * 10; D.px(x + Math.cos(a) * r, base - 5 - h + 4 + Math.sin(a) * r * 0.6 + r * 0.8, '#eef6fa'); }
    for (let k2 = 0; k2 < 5; k2++) { const q = frac(t * 0.25 + k2 / 5), yy = base - 6 - q * (20 + k * 40) - (erupt ? h * 0.6 : 0), r = 2 + q * 5;
      for (let yy2 = -r * 0.6; yy2 <= r * 0.6; yy2++) for (let xx = -r; xx <= r; xx++) if (xx * xx + yy2 * yy2 * 2.7 <= r * r) D.px(x + xx + wind(t) * q * 10, yy + yy2, `rgba(240,246,250,${(0.55 * (1 - q)).toFixed(2)})`); }
  };
}

function bisonAt(D, x, y, dir, headDown, step) {             // ~22 x 13, dir 1 = facing right
  const fur = '#4a3220', dark = '#2e1f14', light = '#6a4a30', horn = '#e8dcc0';
  const X = i => x + (dir > 0 ? i : -i);
  for (let i = -10; i <= 6; i++) { const top = i > 0 ? -9 + (i > 3 ? 1 : 0) : -8 + Math.round((i + 10) * 0.1); for (let j = top; j <= -3; j++) D.px(X(i), y + j, j < top + 2 ? light : i > 1 ? dark : fur); }
  for (let i = 1; i <= 6; i++) for (let j = -10; j <= -7; j++) if (i + j > -8) D.px(X(i), y + j, dark);              // hump
  const hy = headDown ? y - 3 : y - 6;
  for (let i = 6; i <= 10; i++) for (let j = 0; j < 5; j++) D.px(X(i), hy + j, j < 2 ? dark : '#3a2618');
  D.px(X(8), hy - 1, horn); D.px(X(10), hy - 1, horn); D.px(X(9), hy + 1, '#111');
  const legs = [-8, -5, 2, 5];
  legs.forEach((i, n) => { const lift = (n + step) % 2; for (let j = -2; j <= 0 - lift; j++) D.px(X(i), y + j, dark); D.px(X(i), y - lift, '#1a120c'); });
  D.px(X(-11), y - 7, dark); D.px(X(-12), y - 6, dark);                                                              // tail
}
export function bison(list) {                              // [x0, y, range, speed px/s, phase]: slow walk back and forth, grazing
  return (D, t) => list.forEach(([x0, y, range, v, ph]) => {
    const per = 2 * range / v, q = frac((t + ph) / per), x = x0 + range * (q < 0.5 ? q * 2 : 2 - q * 2);
    bisonAt(D, Math.round(x), y, q < 0.5 ? 1 : -1, frac(t / 3.2 + ph) < 0.55, Math.floor(t * 2.5 + ph));
  });
}
export function deer(y, per = 26, off = 0) {               // a small elk crossing the far hill, stopping to look
  return (D, t) => { const p = frac((t + off) / per); if (p > 0.6) return; const x = -6 + p / 0.6 * 192, stop = frac(t / 5) < 0.3, step = stop ? 0 : Math.floor(t * 5) % 2;
    const c = '#8a5a34', d = '#5a3a20'; for (let i = 0; i < 6; i++) D.px(x + i, y - 4, c); for (let i = 0; i < 6; i++) D.px(x + i, y - 3, c);
    D.px(x + 6, y - 5, c); D.px(x + 7, y - 6, c); D.px(x + 7, y - 7, d); D.px(x + 8, y - 8, d); D.px(x + 6, y - 8, d);
    for (const [i, l] of [[0, step], [1, 1 - step], [4, 1 - step], [5, step]]) { D.px(x + i, y - 2, d); if (!l) D.px(x + i, y - 1, d); }
    D.px(x - 1, y - 4, '#e8dcc0'); };
}
export function rabbit(y, per = 11, off = 0, dir = 1) {    // hops across the foreground now and then
  return (D, t) => { const p = frac((t + off) / per); if (p > 0.45) return; const q = p / 0.45, x = dir > 0 ? -8 + q * 196 : 188 - q * 196;
    const hop = Math.abs(Math.sin(q * Math.PI * 9)) * 5, X = i => x + dir * i, Y = y - Math.round(hop), c = '#b8a48a', w = '#efe6d8';
    for (let i = -3; i <= 2; i++) for (let j = -3; j <= -1; j++) D.px(X(i), Y + j, c);
    D.px(X(3), Y - 3, c); D.px(X(3), Y - 4, c); D.px(X(4), Y - 3, c); D.px(X(2), Y - 6, c); D.px(X(2), Y - 5, c); D.px(X(3), Y - 6, c); D.px(X(3), Y - 5, c);
    D.px(X(4), Y - 4, '#111'); D.px(X(-4), Y - 2, w); D.px(X(-3), Y, c); D.px(X(1), Y, c); };
}
export function butterflies(list) {                         // [x, y, color]
  return (D, t) => list.forEach(([x0, y0, c], i) => { const x = x0 + Math.sin(t * 0.7 + i) * 14 + Math.sin(t * 1.9 + i * 2) * 4, y = y0 + Math.sin(t * 1.1 + i * 3) * 8 + Math.sin(t * 3.1) * 2, open = Math.floor(t * 8 + i) % 2;
    D.px(x, y, '#2a2018'); if (open) { D.px(x - 1, y - 1, c); D.px(x + 1, y - 1, c); D.px(x - 1, y, c); D.px(x + 1, y, c); } else { D.px(x - 1, y - 1, c); D.px(x + 1, y - 1, c); } });
}
export function eagle(cx, cy, r = 30) {                    // soars in slow circles high up
  return (D, t) => { const a = t * 0.35, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.3, c = '#3a2a1e', flap = frac(t / 4) < 0.15 && Math.floor(t * 6) % 2;
    for (let i = -5; i <= 5; i++) D.px(x + i, y + (flap ? -Math.abs(i) / 2 : Math.abs(i) > 3 ? 1 : 0), c); D.px(x, y - 1, '#f4f1e8'); D.px(x - 1, y - 1, '#f4f1e8'); D.px(x, y + 1, c); };
}
export function campfire(x, y) {
  return (D, t) => {
    for (let i = -6; i <= 6; i++) D.px(x + i, y + 1 + (Math.abs(i) > 4 ? -1 : 0), '#6a6058');                              // stones
    D.rect(x - 5, y - 1, 10, 2, '#5a3a22'); D.rect(x - 4, y - 2, 3, 1, '#7a4a28'); D.rect(x + 1, y - 2, 4, 1, '#7a4a28');      // logs
    const glow = 0.18 + 0.06 * Math.sin(t * 9);
    for (let j = -3; j <= 3; j++) for (let i = -16; i <= 16; i++) if (i * i / 256 + j * j / 9 < 1) D.px(x + i, y + 2 + j, `rgba(255,170,60,${glow.toFixed(2)})`);
    for (let k = 0; k < 7; k++) { const fl = Math.round(4 + 4 * Math.abs(Math.sin(t * 7 + k * 1.3)) + (k === 3 ? 3 : 0)), fx = x - 3 + k;
      for (let j = 0; j < fl; j++) D.px(fx + (j > fl - 3 ? Math.round(wind(t * 2, k)) : 0), y - 2 - j, j < fl * 0.35 ? '#ffe36a' : j < fl * 0.7 ? '#ff9a2a' : '#e2482a'); }
    for (let s = 0; s < 4; s++) { const q = frac(t * 0.7 + s / 4); D.px(x + Math.sin(q * 9 + s) * 3, y - 10 - q * 18, q < 0.5 ? '#ffd24a' : '#ff8a2a'); }
  };
}
const tentP = (() => { const P = new Pix(30, 20), a = ramp(['#a04a1c', '#d8682a', '#f08a44']);
  for (let j = 0; j < 18; j++) { const half = Math.round(j * 0.8); for (let i = -half; i <= half; i++) P.set(15 + i, j + 1, a[i < 0 ? 2 : 1]); }
  for (let j = 7; j < 19; j++) { const half = Math.round((j - 7) * 0.35); for (let i = -half; i <= half; i++) P.set(15 + i, j, hex('#3a1e10')); }
  P.rect(14, 0, 2, 2, hex('#6a4a30')); P.outline(hex('#2a1a10')); return P; })();
export const tent = (x, y, flapPer = 3) => (D, t) => { D.img(tentP, x - 15, y - 19); const f = Math.round(wind(t, x) * 1.2); D.px(x + 3 + f, y - 6, '#f08a44'); D.px(x + 4 + f, y - 5, '#f08a44'); };

// ---------- people (tiny background primates, ~10 x 17) ----------
const LOOKS = [['#4c2c1c', '#dcb18a', '#2f58ad', '#3e3e46'], ['#b0521c', '#8c6650', '#d62b2b', '#2a2a30'], ['#cdb990', '#e8685a', '#3f7a4e', '#55555c'],
               ['#25222b', '#4a4552', '#c23a84', '#3a1a28'], ['#94805a', '#5a4a44', '#e0b45a', '#2c3554'], ['#46321f', '#f0cfa8', '#7a4ab0', '#2a2a30']];
export function person(D, x, y, look, step = 0, dir = 1, extra = null) {        // y = feet
  const [fur, skin, shirt, pants] = LOOKS[look % LOOKS.length];
  D.rect(x - 2, y - 16, 5, 5, fur); D.rect(x - 1 + (dir > 0 ? 1 : 0), y - 14, 3, 3, skin); D.px(x + (dir > 0 ? 2 : -1), y - 14, '#1a120e');
  D.rect(x - 2, y - 11, 5, 6, shirt); D.rect(x - 2, y - 5, 2, 4 + (step ? 0 : 1), pants); D.rect(x + 1, y - 5, 2, 4 + (step ? 1 : 0), pants);
  D.px(x - 2, y - (step ? 1 : 0), '#1a1418'); D.px(x + 2, y - (step ? 0 : 1), '#1a1418');
  D.px(dir > 0 ? x + 3 : x - 3, y - 9 + (step ? 1 : 0), skin);
  if (extra === 'camera') { D.rect(x + (dir > 0 ? 2 : -4), y - 11, 3, 2, '#222'); D.px(x + (dir > 0 ? 3 : -3), y - 11, '#9fd3f0'); }
  if (extra === 'bag') D.rect(x + (dir > 0 ? -3 : 2), y - 8, 2, 3, '#8a5a34');
  if (extra === 'balloon') { D.px(x + 3 * dir, y - 12, '#888'); D.px(x + 3 * dir, y - 13, '#888'); D.rect(x + 2 * dir, y - 18, 3, 4, '#e2482a'); }
}
export function walkers(list) {                            // [y, period, offset, dir, look, extra]
  return (D, t) => list.forEach(([y, per, off, dir, look, extra]) => { const p = frac((t + off) / per); if (p > 0.7) return; const q = p / 0.7;
    const x = dir > 0 ? -8 + q * 196 : 188 - q * 196; person(D, Math.round(x), y, look, Math.floor(t * 6 + look) % 2, dir, extra); });
}
export function pigeons(list) {                            // [x, y]: peck, shuffle, now and then flap
  return (D, t) => list.forEach(([x0, y], i) => { const x = Math.round(x0 + Math.sin(t * 0.4 + i * 2) * 6), peck = frac(t * 1.3 + hash(i)) < 0.25, dir = Math.cos(t * 0.4 + i * 2) > 0 ? 1 : -1;
    const g = '#8a90a0', d = '#5a6070', X = k => x + dir * k;
    D.rect(x - 2, y - 3, 5, 2, g); D.px(X(-3), y - 3, d); D.px(X(-3), y - 2, d);
    if (peck) { D.px(X(3), y - 2, '#4a6a7a'); D.px(X(4), y - 1, '#d8a040'); } else { D.px(X(2), y - 4, '#4a6a7a'); D.px(X(3), y - 5, '#4a6a7a'); D.px(X(3), y - 4, '#4a6a7a'); D.px(X(4), y - 4, '#d8a040'); D.px(X(3), y - 5, '#111'); }
    D.px(x - 1, y - 1, '#d87a5a'); D.px(x + 1, y - 1, '#d87a5a'); });
}

// ---------- indoors ----------
export function spectators(list) {                         // heads and shoulders behind a railing: blink, turn, whisper
  return (D, t) => list.forEach(([x, y, look], i) => { const [fur, skin, shirt] = LOOKS[look % LOOKS.length], turn = Math.round(Math.sin(t * 0.5 + i * 2.1) * 1.2), lean = frac(t / 7 + hash(i)) < 0.2 ? (i % 2 ? -1 : 1) : 0;
    const X = x + lean; D.rect(X - 4, y + 5, 9, 6, shirt); D.rect(X - 3, y - 2, 7, 7, fur); D.rect(X - 2 + turn, y, 5, 4, skin);
    if (frac(t / 3.3 + hash(i, 2)) > 0.04) { D.px(X - 1 + turn, y + 1, '#1a120e'); D.px(X + 1 + turn, y + 1, '#1a120e'); }
    D.px(X + turn, y + 3, lean ? '#5a1820' : '#2a1810'); });
}
export function typists(list) {                            // coworkers at desks: typing, sipping, looking at the screen
  return (D, t) => list.forEach(([x, y, look], i) => { const [fur, skin, shirt] = LOOKS[look % LOOKS.length], typing = frac(t / 6 + hash(i)) < 0.75;
    D.rect(x - 4, y, 9, 8, shirt); D.rect(x - 3, y - 7, 7, 7, fur); D.rect(x - 2, y - 5, 5, 4, skin); D.px(x - 1, y - 4, '#1a120e'); D.px(x + 1, y - 4, '#1a120e');
    const hand = typing ? Math.floor(t * 10 + i) % 2 : 0; D.rect(x - 5, y + 7 - hand, 2, 2, skin); D.rect(x + 4, y + 7 - (1 - hand) * (typing ? 1 : 0), 2, 2, skin);
    if (!typing) { D.rect(x + 4, y + 2, 3, 3, '#f4f1e8'); D.px(x + 5, y + 2, '#6a3a1a'); }
    D.rect(x - 6, y + 9, 13, 2, '#8a6a4a');                                                                          // desk edge
    D.rect(x + 7, y - 6, 9, 7, '#2a2e36'); D.rect(x + 8, y - 5, 7, 5, frac(t * 0.3 + i) < 0.5 ? '#7fc4e8' : '#8fd0f0'); D.rect(x + 10, y + 1, 3, 2, '#2a2e36'); });
}
export function waterCooler(x, y) {
  return (D, t) => { D.rect(x - 4, y - 14, 9, 14, '#e8eef4'); D.rect(x - 3, y - 24, 7, 10, '#9fd3f0'); D.rect(x - 2, y - 26, 5, 2, '#9fd3f0'); D.rect(x - 3, y - 21, 7, 1, '#bfe6fa');
    const g = frac(t / 5); if (g < 0.3) for (let b = 0; b < 3; b++) { const q = frac(g / 0.3 + b / 3); D.px(x - 1 + b, y - 15 - q * 8, '#ffffff'); }
    D.rect(x - 1, y - 11, 3, 2, '#5a6a7a'); };
}
export function pendantLamps(list) {
  return (D, t) => list.forEach(([x, len], i) => { const sw = Math.round(Math.sin(t * 0.8 + i) * 1); for (let j = 0; j < len; j++) D.px(x + Math.round(sw * j / len), j, '#3a2a1a');
    D.rect(x + sw - 4, len, 9, 3, '#c9a13a'); D.rect(x + sw - 3, len + 3, 7, 1, '#ffe8a0');
    for (let j = 0; j < 14; j++) for (let k = -j / 2 - 3; k <= j / 2 + 3; k++) if ((j + Math.round(k)) % 2 === 0) D.px(x + sw + k, len + 4 + j, 'rgba(255,232,160,0.10)'); });
}
export function globe(x, y) {                              // spinning desk globe on a stand
  return (D, t) => { D.rect(x - 1, y + 6, 3, 6, '#8a6418'); D.rect(x - 4, y + 12, 9, 2, '#8a6418');
    for (let j = -5; j <= 5; j++) for (let i = -5; i <= 5; i++) { if (i * i + j * j > 27) continue; const lon = frac((Math.asin(i / Math.sqrt(28 - j * j + 0.01)) / 3.14 + 0.5) / 2 + t * 0.08), land = frac(lon * 3 + Math.sin(j * 0.7) * 0.15) < 0.45 && Math.abs(j) < 5;
      D.px(x + i, y + j, land ? (i < 0 ? '#7ac04a' : '#5aa03a') : (i < 0 ? '#5fa8e0' : '#3f88c4')); }
    for (let a = -6; a <= 6; a++) D.px(x + 6, y + a, '#c9a13a'); };
}
export function spotlights(list) {                         // light cones sweeping slowly across the back wall
  return (D, t) => list.forEach(([x, per, off], i) => { const ang = Math.sin(t * 2 * Math.PI / per + off) * 0.35;
    for (let j = 4; j < 150; j += 1) { const cx = x + Math.sin(ang) * j * (i % 2 ? -1 : 1), w = 2 + j * 0.16; for (let k = -w; k <= w; k++) if ((Math.round(cx + k) + j) % 2 === 0) D.px(cx + k, j, 'rgba(255,248,220,0.13)'); }
    D.rect(x - 3, 0, 7, 4, '#2a2e36'); D.rect(x - 2, 3, 5, 1, '#fff6d0'); });
}

// ---------- foreground props (bottom of the frame, below the captions) ----------
export function rug(cx, cy, rx, ry) {                      // studio rug with a gold border, light pools drifting over it
  const P = new Pix(180, 320); P.ellipse(cx, cy, rx, ry, hex('#c9a13a')); P.ellipse(cx, cy, rx - 2, ry - 2, hex('#8e1e1e')); P.ellipse(cx, cy, rx - 6, ry - 5, hex('#a8282a'));
  for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; P.set(cx + Math.round(Math.cos(a) * (rx - 4)), cy + Math.round(Math.sin(a) * (ry - 3)), hex('#e6c35a')); }
  return P;
}
export const lightPools = list => (D, t) => list.forEach(([x0, y, per, off], i) => { const x = x0 + Math.sin(t * 2 * Math.PI / per + off) * 30;
  for (let j = -6; j <= 6; j++) for (let k = -22; k <= 22; k++) if (k * k / 484 + j * j / 36 < 1 && (k + j) % 2 === 0) D.px(x + k, y + j, 'rgba(255,248,220,0.16)'); });
export function pottedPlant(x, y) {                        // big leafy plant, leaves move in a breeze from the vent
  return (D, t) => { D.rect(x - 8, y - 12, 17, 12, '#8a5a34'); D.rect(x - 9, y - 14, 19, 3, '#a87444'); D.rect(x - 6, y - 9, 13, 1, '#6e4426');
    for (let k = 0; k < 9; k++) { const a = -1.4 + k * 0.35, len = 16 + (k % 3) * 6, lean = Math.sin(t * 1.3 + k) * 1.2;
      for (let i = 0; i < len; i++) { const f = i / len, px = x + Math.sin(a) * i * 0.9 + lean * f * f * 3, py = y - 14 - Math.cos(a) * i; D.px(px, py, f > 0.7 ? '#6ab04c' : '#3f8a3a'); D.px(px + 1, py, '#2c6a2a'); if (f > 0.5) D.px(px - 1, py + 1, '#57a048'); } } };
}
export function bookStack(x, y) {
  const P = new Pix(180, 320), cols = ['#8e1e1e', '#1d2f6b', '#2c5a36', '#5a2a6a', '#c9a13a'];
  for (let k = 0; k < 5; k++) { const w = 22 - (k % 2) * 4, xx = x - w / 2 + (k % 3) - 1; P.rect(xx, y - (k + 1) * 5, w, 5, hex(cols[k])); P.rect(xx + 1, y - (k + 1) * 5 + 2, w - 2, 1, hex('#e6c35a')); P.rect(xx + w - 2, y - (k + 1) * 5 + 1, 1, 3, hex('#f4f1e8')); }
  P.outline(hex('#1a1418')); return P;
}
export function benchReader(x, y, look = 4) {              // park bench; someone reads the paper and turns the page
  return (D, t) => { const [fur, skin, shirt, pants] = LOOKS[look % LOOKS.length];
    D.rect(x - 22, y - 16, 44, 3, '#7a4a28'); D.rect(x - 22, y - 11, 44, 3, '#8e5a34'); D.rect(x - 20, y - 8, 2, 8, '#2a2e36'); D.rect(x + 18, y - 8, 2, 8, '#2a2e36');
    D.rect(x - 4, y - 25, 9, 10, shirt); D.rect(x - 4, y - 9, 9, 3, pants); D.rect(x - 3, y - 6, 3, 6, pants); D.rect(x + 1, y - 6, 3, 6, pants);
    D.rect(x - 3, y - 33, 8, 8, fur); D.rect(x - 2, y - 31, 6, 5, skin);
    const flip = frac(t / 6) > 0.9, pw = flip ? 9 : 16; D.rect(x - 8, y - 28, pw, 10, '#ecebe4'); for (let r = 0; r < 4; r++) D.rect(x - 7, y - 26 + r * 2, pw - 3, 1, '#9a9aa4'); D.rect(x - 1, y - 28, 1, 10, '#c8c8c0');
    D.rect(x - 9, y - 22, 2, 2, skin); D.rect(x + pw - 8, y - 22, 2, 2, skin); };
}
export function counselTable(x, y) {                       // table with papers, a water jug and a glass; the pages lift in the AC
  return (D, t) => { D.rect(x - 34, y - 8, 68, 5, '#7a4626'); D.rect(x - 34, y - 9, 68, 1, '#9a5e36'); D.rect(x - 32, y - 3, 4, 24, '#5a3218'); D.rect(x + 28, y - 3, 4, 24, '#5a3218');
    D.rect(x - 24, y - 11, 14, 2, '#f4f1e8'); const lift = frac(t / 4) < 0.2 ? 1 : 0; D.rect(x - 22, y - 12 - lift, 12, 1, '#ecebe4');
    D.rect(x + 8, y - 18, 7, 9, 'rgba(190,225,245,0.85)'); D.rect(x + 9, y - 15, 5, 5, 'rgba(120,180,230,0.8)'); D.rect(x + 15, y - 16, 1, 5, 'rgba(190,225,245,0.85)');
    D.rect(x + 19, y - 14, 4, 5, 'rgba(190,225,245,0.85)'); D.rect(x + 19, y - 12, 4, 3, 'rgba(120,180,230,0.8)'); };
}
export function stenographer(x, y, look = 3) {             // types every word, never looks up
  return (D, t) => { const [fur, skin, shirt] = LOOKS[look % LOOKS.length];
    D.rect(x - 6, y - 22, 13, 13, shirt); D.rect(x - 5, y - 33, 11, 11, fur); D.rect(x - 4, y - 30, 9, 7, skin); D.px(x - 2, y - 27, '#1a120e'); D.px(x + 2, y - 27, '#1a120e');
    D.rect(x - 12, y - 10, 25, 4, '#2a2e36'); D.rect(x - 8, y - 13, 17, 3, '#45505e');
    const h = Math.floor(t * 12) % 2; D.rect(x - 8, y - 15 + h, 3, 2, skin); D.rect(x + 5, y - 14 - h, 3, 2, skin); D.rect(x - 2, y - 6, 5, 6, '#2a2e36'); };
}
export function officeDesk(x, y) {                         // desk with a monitor, a steaming mug and a sleeping cat whose tail flicks
  return (D, t) => { D.rect(x - 30, y - 10, 60, 5, '#b48a62'); D.rect(x - 30, y - 11, 60, 1, '#d0a87e'); D.rect(x - 28, y - 5, 4, 22, '#8a6a4a'); D.rect(x + 24, y - 5, 4, 22, '#8a6a4a');
    D.rect(x + 2, y - 30, 22, 16, '#2a2e36'); D.rect(x + 4, y - 28, 18, 12, '#7fc4e8'); for (let r = 0; r < 4; r++) D.rect(x + 6, y - 26 + r * 3, 8 + ((r * 5 + Math.floor(t * 2)) % 7), 1, '#d8f0ff'); D.rect(x + 11, y - 14, 4, 4, '#2a2e36');
    D.rect(x - 24, y - 17, 6, 7, '#f4f1e8'); D.rect(x - 23, y - 17, 4, 1, '#6a3a1a'); for (let s = 0; s < 3; s++) { const q = frac(t * 0.6 + s / 3); D.px(x - 21 + Math.sin(q * 7 + s) * 1.5, y - 19 - q * 10, `rgba(255,255,255,${(0.7 * (1 - q)).toFixed(2)})`); }
    const cx = x - 10, cy = y - 11; D.rect(cx - 6, cy - 5, 12, 5, '#e08a3a'); D.rect(cx + 3, cy - 8, 6, 6, '#e08a3a'); D.px(cx + 4, cy - 9, '#e08a3a'); D.px(cx + 8, cy - 9, '#e08a3a');
    D.rect(cx - 4, cy - 4, 2, 1, '#b86a24'); D.rect(cx, cy - 4, 2, 1, '#b86a24'); D.rect(cx + 5, cy - 5, 2, 1, '#3a2010'); D.rect(cx + 8, cy - 5, 1, 1, '#3a2010');
    const flick = Math.round(Math.sin(t * 2.2) * 2); D.px(cx - 7, cy - 2, '#e08a3a'); D.px(cx - 8, cy - 3 + flick * 0.5, '#e08a3a'); D.px(cx - 9, cy - 4 + flick, '#e08a3a');
    if (frac(t / 4) < 0.5) { const q = frac(t / 2); D.px(cx + 10 + q * 4, cy - 12 - q * 6, '#f4f1e8'); } };
}

// ---------- town ----------
const CARS = [['#d8342c', '#9a1e1a'], ['#2d6fd6', '#1d4a9a'], ['#f2c230', '#b88a1a'], ['#e8eef4', '#9aa4b0'], ['#3f7a4e', '#2c5a36'], ['#2a2e36', '#14161a']];
export function car(D, x, y, col, dir = 1, kind = 'car') {        // ~30 x 14, y = road line under the wheels
  const [c, d] = CARS[col % CARS.length], L = kind === 'bus' ? 46 : kind === 'van' ? 34 : 30, X = i => dir > 0 ? x + i : x + L - i;
  for (let i = 0; i < L; i++) for (let j = 4; j < 10; j++) D.px(X(i), y - j, j < 5 ? d : c);
  const r0 = kind === 'car' ? 7 : 2, r1 = kind === 'car' ? L - 9 : L - 3, top = kind === 'bus' ? 16 : 14;
  for (let i = r0; i < r1; i++) for (let j = 10; j < top; j++) D.px(X(i), y - j, c);
  for (let i = r0 + 2; i < r1 - 1; i++) if ((i - r0) % (kind === 'bus' ? 7 : 9) !== 0) for (let j = 11; j < top - 1; j++) D.px(X(i), y - j, '#9fd3f0');
  D.px(X(L - 1), y - 7, '#ffe8a0'); D.px(X(0), y - 7, '#e2482a');
  for (const wx of [5, L - 7]) { const cx = X(wx); D.rect(cx - 2, y - 4, 4, 4, '#1a1418'); D.px(cx, y - 2, '#8a8a90'); }
}
export function traffic(list) {                            // [y, period, offset, dir, color, kind]
  return (D, t) => list.forEach(([y, per, off, dir, col, kind]) => { const p = frac((t + off) / per); if (p > 0.5) return; const q = p / 0.5, L = 50;
    car(D, Math.round(dir > 0 ? -L + q * (180 + L) : 180 - q * (180 + L)), y, col, dir, kind || 'car'); });
}
export function trafficLight(x, y) {
  return (D, t) => { D.rect(x, y - 40, 2, 40, '#2a2e36'); D.rect(x - 3, y - 52, 8, 14, '#1a1c22'); const ph = frac(t / 12);
    D.rect(x - 1, y - 50, 4, 3, ph < 0.45 ? '#ff4a3a' : '#4a1a1a'); D.rect(x - 1, y - 46, 4, 3, ph >= 0.45 && ph < 0.55 ? '#ffd24a' : '#4a3a1a'); D.rect(x - 1, y - 42, 4, 3, ph >= 0.55 ? '#5aff7a' : '#1a3a1a'); };
}
export function manholeSteam(x, y) {
  return (D, t) => { D.rect(x - 5, y - 1, 11, 2, '#3a3e46'); for (let k = 0; k < 5; k++) { const q = frac(t * 0.4 + k / 5), r = Math.round(1 + q * 4);
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (i * i + j * j <= r * r) D.px(x + i + wind(t) * q * 6, y - 3 - q * 26 + j, `rgba(230,234,240,${(0.5 * (1 - q)).toFixed(2)})`); } };
}
export function windowsLife(list) {                        // lit windows: someone walks past now and then, lights go off and on
  return (D, t) => list.forEach(([x, y, w, h], i) => { const on = frac(t / 9 + hash(i)) < 0.85;
    D.rect(x, y, w, h, on ? '#f2dc8a' : '#3a4a66'); if (!on) return;
    const p = frac(t / (6 + hash(i, 1) * 6) + hash(i, 2)); if (p < 0.5) { const sx = Math.max(x, Math.min(x + w - 3, Math.round(x - 3 + p * 2 * (w + 3)))); D.rect(sx, y + h - 6, 3, 6, '#5a4a3a'); D.rect(sx, y + h - 8, 3, 2, '#5a4a3a'); }
    D.rect(x, y, 1, h, '#c84a3a'); D.rect(x + w - 1, y, 1, h, '#c84a3a'); });
}
export function dog(x, y, look = 0) {                      // sits, wags, barks now and then
  return (D, t) => { const c = ['#b07a3a', '#2a2420', '#e8dcc0'][look % 3], d = ['#7a5222', '#141210', '#b8a888'][look % 3];
    D.rect(x - 5, y - 6, 9, 5, c); D.rect(x + 2, y - 11, 6, 6, c); D.rect(x + 7, y - 9, 2, 2, d); D.px(x + 6, y - 10, '#111'); D.rect(x + 2, y - 12, 2, 3, d);
    D.rect(x - 4, y - 1, 2, 1, d); D.rect(x + 1, y - 1, 2, 1, d); const wag = Math.round(Math.sin(t * 14) * 2); D.px(x - 6, y - 7 + Math.round(wag * 0.5), c); D.px(x - 7, y - 8 + wag, c);
    if (frac(t / 5.5) < 0.12 && Math.floor(t * 8) % 2) { D.px(x + 10, y - 10, '#fff'); D.px(x + 12, y - 11, '#fff'); D.px(x + 11, y - 9, '#fff'); } };
}
export function mower(y, per = 20) {                       // a neighbour mowing back and forth
  return (D, t) => { const p = pingpong(t, per), x = Math.round(20 + p * 140), dir = frac(t / per) < 0.5 ? 1 : -1;
    person(D, x - dir * 7, y, 2, Math.floor(t * 5) % 2, dir); D.rect(x - 4, y - 5, 9, 4, '#d8342c'); D.rect(x - 3, y - 1, 2, 1, '#111'); D.rect(x + 2, y - 1, 2, 1, '#111');
    D.px(x - dir * 4, y - 6, '#2a2e36'); D.px(x - dir * 5, y - 7, '#2a2e36'); if (Math.floor(t * 9) % 2) D.px(x - dir * 6, y - 2, '#8ac05a'); };
}
export function sprinkler(x, y) {
  return (D, t) => { D.rect(x - 1, y - 3, 3, 3, '#5a6a7a'); const a = Math.sin(t * 1.6) * 1.1;
    for (let k = 0; k < 16; k++) { const q = frac(t * 1.5 + k / 16), dx = Math.sin(a + (k % 3 - 1) * 0.15) * q * 26, dy = -Math.sin(q * Math.PI) * 16; D.px(x + dx, y - 4 + dy, q > 0.8 ? '#cfe8ff' : '#7fc4e8'); } };
}
export function cyclist(y, per = 15, off = 0, dir = 1, look = 1) {
  return (D, t) => { const p = frac((t + off) / per); if (p > 0.4) return; const q = p / 0.4, x = Math.round(dir > 0 ? -12 + q * 204 : 192 - q * 204);
    for (const wx of [-5, 5]) { D.rect(x + wx - 2, y - 4, 5, 5, '#2a2e36'); D.px(x + wx, y - 2, '#8a8a90'); }
    D.rect(x - 4, y - 6, 9, 1, '#d8342c'); person(D, x, y - 4, look, Math.floor(t * 6) % 2, dir); };
}

// ---------- store ----------
export function fluorescent(list) {                        // ceiling tubes, one of them flickers
  return (D, t) => list.forEach(([x, y, w], i) => { const bad = i === 1 && frac(t / 3.7) < 0.08 && Math.floor(t * 30) % 2; D.rect(x, y, w, 2, bad ? '#8a8a80' : '#fbfaf0');
    if (!bad) for (let j = 2; j < 18; j += 2) D.rect(x - j, y + 2 + j, w + j * 2, 1, 'rgba(255,255,240,0.05)'); });
}
export function cashier(x, y, look = 5) {                  // scans items: item slides over, red scanner flash
  return (D, t) => { const [fur, skin, shirt] = LOOKS[look % LOOKS.length];
    D.rect(x - 5, y - 22, 11, 12, shirt); D.rect(x - 4, y - 32, 9, 10, fur); D.rect(x - 3, y - 29, 7, 6, skin); D.px(x - 1, y - 27, '#1a120e'); D.px(x + 1, y - 27, '#1a120e');
    D.rect(x - 4, y - 21, 9, 3, '#d8342c');
    const p = frac(t / 1.6), ix = Math.round(x + 14 - p * 26); D.rect(ix, y - 13, 5, 4, ['#f2c230', '#2d6fd6', '#3f9a4a', '#e866a8'][Math.floor(t / 1.6) % 4]);
    D.rect(ix - 1, y - 12, 2, 2, skin); if (p > 0.45 && p < 0.55) { D.rect(x - 1, y - 11, 4, 1, '#ff4a3a'); D.px(x + 4, y - 16, '#ff4a3a'); } };
}
export function secCam(x, y) {
  return (D, t) => { const a = Math.round(Math.sin(t * 0.5) * 3); D.rect(x - 1, y - 4, 2, 4, '#6a6e78'); D.rect(x - 4 + a, y, 9, 4, '#e8eef4'); D.rect(x - 5 + a + (a > 0 ? 8 : 0), y + 1, 2, 2, '#2a2e36');
    if (frac(t) < 0.5) D.px(x + 3 + a, y + 1, '#ff3a2a'); };
}
export function shoppers(list) {                           // [y, period, offset, dir, look]: walk pushing a cart
  return (D, t) => list.forEach(([y, per, off, dir, look]) => { const p = frac((t + off) / per); if (p > 0.75) return; const q = p / 0.75, x = Math.round(dir > 0 ? -20 + q * 220 : 200 - q * 220);
    person(D, x, y, look, Math.floor(t * 5 + look) % 2, dir); const cx = x + dir * 9; D.rect(cx - 4, y - 9, 9, 6, '#b8c0cc'); for (let i = -3; i <= 3; i += 2) D.px(cx + i, y - 8, '#6a7280');
    D.rect(cx - 3, y - 12, 4, 3, '#f2c230'); D.px(cx - 3, y - 1, '#2a2e36'); D.px(cx + 3, y - 1, '#2a2e36'); });
}

// ---------- water ----------
export function sea(y0, y1) {                               // rolling waves with glints
  return (D, t) => { for (let y = y0; y < y1; y++) { const k = (y - y0) / (y1 - y0); D.rect(0, y, 180, 1, k < 0.3 ? '#3a8ac8' : k < 0.7 ? '#2a72b0' : '#1f5e98'); }
    for (let r = 0; r < (y1 - y0) / 6; r++) { const y = y0 + 3 + r * 6, sp = 4 + r * 2; for (let x = 0; x < 196; x += 14) { const xx = ((x + t * sp * (r % 2 ? 1 : -1)) % 196 + 196) % 196; D.rect(xx - 8, y + Math.round(Math.sin(t * 2 + x) * 0.6), 5, 1, '#7fc4e8'); } }
    for (let g = 0; g < 8; g++) if (frac(t * 0.9 + hash(g)) < 0.3) D.px(hash(g, 1) * 180, y0 + hash(g, 2) * (y1 - y0), '#ffffff'); };
}
export function boat(x0, y, kind = 0, drift = 0) {          // sailboat / tugboat rocking on the swell, drifting slowly
  return (D, t) => { const x = Math.round(x0 + Math.sin(t * 0.15) * drift), rock = Math.round(Math.sin(t * 1.4 + x0));
    if (kind === 0) { for (let i = 0; i < 22; i++) D.rect(x + i, Math.round(y - 4 + rock * (i - 11) / 11), 1, 4, '#f4f1e8'); D.rect(x + 2, y - 1, 18, 1, '#c23030');
      D.rect(x + 10, y - 26, 1, 22, '#5a3a20'); for (let j = 0; j < 18; j++) { D.rect(x + 11, y - 25 + j, Math.round(j * 0.55), 1, '#ffffff'); D.rect(x + 10 - Math.round(j * 0.3), y - 22 + j, Math.round(j * 0.3), 1, '#f2e8d0'); } }
    else { D.rect(x, y - 6 + rock, 30, 6, '#c23030'); D.rect(x, y - 2 + rock, 30, 2, '#2a2e36'); D.rect(x + 8, y - 13 + rock, 12, 7, '#f4f1e8'); D.rect(x + 10, y - 11 + rock, 3, 2, '#5fa8e0'); D.rect(x + 15, y - 11 + rock, 3, 2, '#5fa8e0');
      D.rect(x + 13, y - 19 + rock, 3, 6, '#2a2e36'); for (let k = 0; k < 4; k++) { const q = frac(t * 0.5 + k / 4); D.px(x + 14 + q * 8, y - 21 + rock - q * 12, `rgba(90,90,96,${(0.7 * (1 - q)).toFixed(2)})`); } } };
}
function birdAt(D, x, y, up, c) { D.px(x, y, c); D.px(x - 1, y, c); D.px(x + 1, y, c);
  if (up) { D.px(x - 2, y - 1, c); D.px(x - 3, y - 2, c); D.px(x + 2, y - 1, c); D.px(x + 3, y - 2, c); } else { D.px(x - 2, y, c); D.px(x - 3, y + 1, c); D.px(x + 2, y, c); D.px(x + 3, y + 1, c); } }
export function gulls(list) {                              // white birds gliding in loops
  return (D, t) => list.forEach(([cx, cy, r, sp], i) => { const a = t * sp + i * 2; birdAt(D, Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a * 0.7) * r * 0.25), Math.floor(t * 4 + i) % 3 === 0, '#f4f6f8'); });
}
export function crane(x, y) {                              // dock crane swinging a container back and forth
  return (D, t) => { D.rect(x, y - 70, 4, 70, '#d8a030'); for (let j = 0; j < 70; j += 6) D.rect(x - 1, y - 70 + j, 6, 1, '#a87a20');
    const p = pingpong(t, 14), arm = 40, hx = x + 2 + Math.round(-arm + p * arm * 1.6); D.rect(x - arm, y - 72, arm * 2, 3, '#d8a030'); D.rect(x - 8, y - 78, 20, 6, '#c23030');
    const drop = 20 + Math.round(Math.sin(p * Math.PI) * 6); D.rect(hx, y - 69, 1, drop, '#2a2e36'); D.rect(hx - 9, y - 69 + drop, 19, 9, ['#2d6fd6', '#d8342c', '#3f9a4a'][Math.floor(t / 28) % 3]);
    for (let i = -8; i < 10; i += 3) D.rect(hx + i, y - 68 + drop, 1, 7, 'rgba(0,0,0,0.25)'); };
}
export function lighthouse(x, y) {
  return (D, t) => { for (let j = 0; j < 46; j++) { const w = 6 - Math.floor(j / 12); D.rect(x - w, y - j, w * 2, 1, Math.floor(j / 8) % 2 ? '#c23030' : '#f4f1e8'); }
    D.rect(x - 5, y - 52, 10, 6, '#2a2e36'); D.rect(x - 3, y - 51, 6, 4, '#fff6a0'); D.rect(x - 4, y - 55, 8, 3, '#c23030');
    const s = Math.cos(t * 1.2); if (Math.abs(s) > 0.2) for (let i = 4; i < 60; i++) for (let k = -Math.floor(i / 10); k <= Math.floor(i / 10); k++) if ((i + k) % 2 === 0) D.px(x + Math.sign(s) * i, y - 49 + k, `rgba(255,246,160,${(0.35 * Math.abs(s) * (1 - i / 60)).toFixed(2)})`); };
}
export function fishJump(x, y, per = 7) {
  return (D, t) => { const p = frac(t / per); if (p > 0.15) { if (p < 0.25) { const r = Math.round((p - 0.15) * 60); for (let i = -r; i <= r; i++) D.px(x + 6 + i, y, '#cfe8ff'); } return; }
    const q = p / 0.15, fx = Math.round(x + q * 12), fy = Math.round(y - Math.sin(q * Math.PI) * 9); D.rect(fx - 2, fy - 1, 5, 2, '#b8c4cc'); D.px(fx - 3, fy - 2, '#8a9aa4'); D.px(fx - 3, fy + 1, '#8a9aa4'); };
}

// ---------- outside the prison walls (neutral, no jokes) ----------
export function searchlight(x, y, per = 10) {
  return (D, t) => { const a = -Math.PI / 2 + Math.sin(t * 2 * Math.PI / per) * 0.9;
    for (let i = 4; i < 110; i++) { const w = Math.floor(i * 0.12); for (let k = -w; k <= w; k++) { const px = Math.round(x + Math.cos(a) * i - Math.sin(a) * k), py = Math.round(y + Math.sin(a) * i + Math.cos(a) * k); if ((px + py) % 2 === 0) D.px(px, py, 'rgba(255,250,210,0.12)'); } }
    D.rect(x - 3, y - 2, 6, 4, '#e8eef4'); };
}
export function patrol(y, per = 24, look = 1) {           // a guard walking along the wall
  return (D, t) => { const p = pingpong(t, per), x = Math.round(16 + p * 148), dir = frac(t / per) < 0.5 ? 1 : -1; person(D, x, y, look, Math.floor(t * 4) % 2, dir); D.rect(x - 2, y - 17, 5, 2, '#1d2f6b'); };
}
export function flagpole(x, y, cols = ['#141218', '#d8342c', '#f2c230']) {     // flag on a pole (black-red-gold for Germany by default)
  return (D, t) => { D.rect(x, y - 44, 1, 44, '#8a8a90'); for (let c = 0; c < 14; c++) { const off = Math.round(Math.sin(t * 5 - c * 0.5) * (c / 14) * 1.6); for (let r = 0; r < 9; r++) D.px(x + 1 + c, y - 44 + r + off, cols[Math.floor(r / 3)]); } };
}
