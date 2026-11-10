// Pixel RPG kit: Larry and the primate cast, drawn pixel by pixel in code (no art files), so every pose is
// identical from episode to episode. Light from the upper left: ramps go shadow -> base -> highlight.

export function hex(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255, 255]; }
export const ramp = cs => cs.map(hex);
export const INK = hex('#1b1420');

export class Pix {
  constructor(w, h) { this.w = w; this.h = h; this.d = new Uint8ClampedArray(w * h * 4); }
  set(x, y, c) { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= this.w || y >= this.h || !c) return; this.d.set(c, (y * this.w + x) * 4); }
  get(x, y) { if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null; const i = (y * this.w + x) * 4; return this.d[i + 3] ? this.d.slice(i, i + 4) : null; }
  rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c); }
  box(x, y, w, h, r, round = 0) {                     // shaded box with optional cut corners
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const cx = Math.min(i, w - 1 - i), cy = Math.min(j, h - 1 - j);
      if (round && cx < round && cy < round && cx + cy < round - 1) continue;
      let k = 1; if (i === 0 || j === 0) k = 2; if (i >= w - 2 || j === h - 1) k = 0;
      this.set(x + i, y + j, r[Math.min(k, r.length - 1)]);
    }
  }
  ellipse(cx, cy, rx, ry, c) { for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) if ((x * x) / (rx * rx || 1) + (y * y) / (ry * ry || 1) <= 1) this.set(cx + x, cy + y, c); }
  outline(ink = INK) {
    const add = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (!this.get(x, y) && (this.get(x - 1, y) || this.get(x + 1, y) || this.get(x, y - 1) || this.get(x, y + 1))) add.push([x, y]);
    for (const [x, y] of add) this.set(x, y, ink);
  }
  stamp(S, x, y) { for (let j = 0; j < S.h; j++) for (let i = 0; i < S.w; i++) { const c = S.get(i, j); if (c) this.set(x + i, y + j, c); } }
  canvas() { const c = document.createElement('canvas'); c.width = this.w; c.height = this.h; c.getContext('2d').putImageData(new ImageData(this.d, this.w, this.h), 0, 0); return c; }
}

const C = {
  lemur: ramp(['#6c6a72', '#9b99a3', '#c4c2cb']), white: ramp(['#c9c6cf', '#ecebf0', '#ffffff']), black: ramp(['#141218', '#25222b', '#3a3642']),
  amber: ramp(['#b8741c', '#f2b632', '#ffe08a']), gold: ramp(['#8a6418', '#d9a93a', '#ffe08a']), tie: ramp(['#8e1416', '#d42a24', '#ff6a52']),
  mouth: hex('#5a1820'), tongue: hex('#d9606a'),
};

// ---------- faces (shared by every primate): brows + eyes + mouth for neutral/smug/surprised/worried/angry ----------
function face(P, x, y, kind, fr, open) {            // x,y = top-left of the face panel (18 wide)
  const ink = INK, wht = hex('#ffffff'), b = fr[0];
  const brow = { neutral: [0, 0], smug: [1, -1], surprised: [-2, -2], worried: [-1, 1], angry: [1, 1] }[kind] || [0, 0];
  P.rect(x + 2, y + 3 + brow[0], 2, 1, b); P.rect(x + 4, y + 3 + Math.round((brow[0] + brow[1]) / 2), 2, 1, b);       // left brow, two steps for slant
  P.rect(x + 12, y + 3 + Math.round((brow[0] + brow[1]) / 2), 2, 1, b); P.rect(x + 14, y + 3 + brow[0], 2, 1, b);
  const eh = kind === 'smug' ? 2 : kind === 'surprised' ? 4 : 3;
  P.rect(x + 3, y + 5, 4, eh, wht); P.rect(x + 11, y + 5, 4, eh, wht);
  P.rect(x + 5, y + 5 + (eh > 2 ? 1 : 0), 2, 2, ink); P.rect(x + 13, y + 5 + (eh > 2 ? 1 : 0), 2, 2, ink);
  if (kind === 'smug') { P.rect(x + 3, y + 5, 4, 1, fr[1]); P.rect(x + 11, y + 5, 4, 1, fr[1]); }                         // heavy lids
  const my = y + 13;
  if (open) { P.rect(x + 6, my - 1, 6, 3, C.mouth); P.rect(x + 7, my + 1, 4, 1, C.tongue); }
  else if (kind === 'surprised') { P.rect(x + 8, my - 1, 2, 3, C.mouth); }
  else if (kind === 'smug') { P.rect(x + 6, my, 6, 1, ink); P.set(x + 12, my - 1, ink); }
  else if (kind === 'worried' || kind === 'angry') { P.rect(x + 7, my, 4, 1, ink); P.set(x + 6, my + 1, ink); P.set(x + 11, my + 1, ink); }
  else P.rect(x + 6, my, 6, 1, ink);
}

// ---------- species and outfits (mirrors the 3D kit's names so auto-casting carries over) ----------
const SPECIES = {
  chimp: { fur: ramp(['#2e1a12', '#4c2c1c', '#6e4128']), skin: ramp(['#b08260', '#dcb18a', '#f3d2ae']), ears: true },
  gorilla: { fur: ramp(['#141218', '#25222b', '#3d3946']), skin: ramp(['#2e2a33', '#4a4552', '#66606e']), crest: true },
  orangutan: { fur: ramp(['#7a3410', '#b0521c', '#d9772e']), skin: ramp(['#6a4a3a', '#8c6650', '#ad8468']), cheeks: true },
  macaque: { fur: ramp(['#a8946e', '#cdb990', '#e7d8b4']), skin: ramp(['#c2443a', '#e8685a', '#ff9585']), ears: true },
  baboon: { fur: ramp(['#6e5a3a', '#94805a', '#b8a47c']), skin: ramp(['#3a2e2a', '#5a4a44', '#7a6860']), snout: true },
  mandrill: { fur: ramp(['#3a3a2e', '#5a5a44', '#7c7c60']), skin: ramp(['#2a5ab0', '#d8342c', '#ff6a5a']), snout: true },
  capuchin: { fur: ramp(['#2a1e16', '#46321f', '#5e452c']), skin: ramp(['#d8b08a', '#f0cfa8', '#fff0d8']), ears: true },
  gibbon: { fur: ramp(['#1c1a1e', '#2e2b32', '#454048']), skin: ramp(['#3a3238', '#55494f', '#6e6066']), ring: true },
  proboscis: { fur: ramp(['#a86a34', '#d08c4c', '#eaae6c']), skin: ramp(['#d88a6a', '#f0a888', '#ffc8a8']), nose: true },
  tarsier: { fur: ramp(['#7a6248', '#a08466', '#c4a886']), skin: ramp(['#a08466', '#c4a886', '#e0c8a8']), bigEyes: true },
  bonobo: { fur: ramp(['#141218', '#25222b', '#3a3642']), skin: ramp(['#2e2626', '#463a3a', '#5e5050']), part: true },
};
const OUTFITS = {
  plaid: { top: ramp(['#8f1515', '#d62b2b', '#ff5a4a']), legs: ramp(['#1f3b78', '#2f58ad', '#4f7fd6']), shoe: ramp(['#3a2416', '#5a3a24', '#7a5236']), pattern: 'plaid', zip: true },
  tracksuit: { top: ramp(['#a01818', '#e02a2a', '#ff6a5a']), legs: ramp(['#a01818', '#e02a2a', '#ff6a5a']), shoe: ramp(['#c8c8c8', '#f2f2f2', '#ffffff']), pattern: 'stripes', zip: true },
  robe: { top: ramp(['#0c0b10', '#1a1820', '#2c2934']), legs: ramp(['#0c0b10', '#1a1820', '#2c2934']), shoe: ramp(['#0c0b10', '#1a1820', '#2c2934']), collar: true },
  suit: { top: ramp(['#1c2236', '#2c3554', '#45507a']), legs: ramp(['#1c2236', '#2c3554', '#45507a']), shoe: ramp(['#141218', '#25222b', '#3a3642']), tie: true },
  cop: { top: ramp(['#141e3e', '#22305e', '#344884']), legs: ramp(['#141e3e', '#22305e', '#344884']), shoe: ramp(['#141218', '#25222b', '#3a3642']), badge: true, cap: ramp(['#141e3e', '#22305e', '#344884']) },
  irs: { top: ramp(['#8a8a8e', '#b8b8bc', '#dcdce0']), legs: ramp(['#3a3a40', '#55555c', '#707078']), shoe: ramp(['#141218', '#25222b', '#3a3642']), tie: true, glasses: true },
  dress: { top: ramp(['#8a1e5a', '#c23a84', '#e866a8']), legs: ramp(['#8a1e5a', '#c23a84', '#e866a8']), shoe: ramp(['#3a1a28', '#5a2a40', '#7a3a58']) },
  hoodie: { top: ramp(['#2e5a3a', '#3f7a4e', '#5a9c68']), legs: ramp(['#2a2a30', '#3e3e46', '#55555e']), shoe: ramp(['#c8c8c8', '#f2f2f2', '#ffffff']), zip: true },
};

// gestures: which arm poses (L = his right / viewer's left, R = his left / viewer's right)
const ARMS = { none: ['down', 'down'], explain: ['down', 'out'], point: ['down', 'up'], wave: ['down', 'up'], shrug: ['out', 'out'],
               arms_up: ['up', 'up'], think: ['down', 'chin'], scratch: ['down', 'head'] };

function arm(P, side, kind, ox, top, sleeve, hand) {   // side -1 = viewer's left, +1 = viewer's right; ox = torso left x, torso 26 wide
  const x = side < 0 ? ox - 5 : ox + 25;
  if (kind === 'down') { P.box(x, top + 2, 6, 14, sleeve); P.box(x, top + 15, 6, 5, hand); }
  else if (kind === 'out') { const ax = side < 0 ? x - 8 : x; P.box(ax, top + 3, 14, 6, sleeve); P.box(side < 0 ? ax - 5 : ax + 13, top + 1, 6, 7, hand); }
  else if (kind === 'up') { P.box(x, top - 16, 6, 19, sleeve); P.box(x, top - 22, 6, 7, hand); }
  else if (kind === 'chin') { P.box(x - 4, top + 2, 6, 10, sleeve); P.box(x - 9, top - 4, 7, 6, hand); }
  else if (kind === 'head') { P.box(x, top - 12, 6, 15, sleeve); P.box(x - 4, top - 20, 7, 6, hand); }
}

// generic primate: 64 x 84 frame, feet on the bottom row
export function primate({ species = 'chimp', outfit = 'plaid', face: fk = 'neutral', gest = 'none', open = false } = {}) {
  const S = SPECIES[species] || SPECIES.chimp, O = OUTFITS[outfit] || OUTFITS.plaid;
  const P = new Pix(64, 84), ox = 19, top = 41;       // torso x, torso top
  // legs + shoes
  P.box(ox + 5, top + 21, 7, 16, O.legs); P.box(ox + 14, top + 21, 7, 16, O.legs);
  if (O.pattern === 'stripes') { P.rect(ox + 5, top + 21, 1, 16, hex('#ffffff')); P.rect(ox + 20, top + 21, 1, 16, hex('#ffffff')); }
  P.box(ox + 3, top + 36, 9, 5, O.shoe); P.box(ox + 14, top + 36, 9, 5, O.shoe);
  if (outfit === 'robe') P.box(ox, top, 26, 38, O.top, 2);           // judge's robe to the ankles
  else P.box(ox, top, 26, 22, O.top, 2);
  if (O.pattern === 'plaid') { for (let y = top + 3; y < top + 21; y += 5) P.rect(ox + 1, y, 24, 1, O.top[0]); for (let x = ox + 5; x < ox + 25; x += 6) P.rect(x, top + 1, 1, 20, O.top[0]); }
  if (O.pattern === 'stripes') { P.rect(ox, top + 1, 1, 20, hex('#ffffff')); P.rect(ox + 25, top + 1, 1, 20, hex('#ffffff')); }
  if (O.zip) P.rect(ox + 12, top + 1, 2, 20, hex('#f2efe8'));
  if (O.collar) { P.rect(ox + 9, top, 8, 3, hex('#f4f4f4')); P.rect(ox + 12, top + 3, 2, 3, hex('#f4f4f4')); }
  if (O.tie) { P.rect(ox + 10, top, 6, 14, hex('#f2efe8')); P.rect(ox + 12, top + 1, 2, 11, C.tie[1]); P.set(ox + 12, top + 1, C.tie[2]); }
  if (O.badge) P.box(ox + 17, top + 4, 4, 4, C.gold);
  const [aL, aR] = ARMS[gest] || ARMS.none;
  arm(P, -1, aL, ox, top, O.top, S.skin); arm(P, 1, aR, ox, top, O.top, S.skin);
  // head (26 x 30) with species details
  const hx = ox, hy = top - 30;
  if (S.ears) { P.box(hx - 3, hy + 11, 5, 8, S.skin); P.box(hx + 24, hy + 11, 5, 8, S.skin); }
  if (S.cheeks) { P.box(hx - 6, hy + 10, 8, 14, S.skin); P.box(hx + 24, hy + 10, 8, 14, S.skin); }
  P.box(hx, hy, 26, 30, S.fur, 4);
  if (S.crest) P.box(hx + 6, hy - 3, 14, 5, S.fur, 2);
  if (S.ring) P.box(hx + 2, hy + 6, 22, 22, ramp(['#d8d8d8', '#f0f0f0', '#ffffff']), 3);
  P.box(hx + 4, hy + 8, 18, 19, S.skin, 3);
  if (S.part) P.rect(hx + 12, hy, 2, 6, S.fur[0]);
  face(P, hx + 4, hy + 8, fk, S.skin, open);
  if (S.snout) P.box(hx + 7, hy + 15, 12, 8, S.skin);
  if (S.nose) P.box(hx + 10, hy + 13, 6, 8, S.skin);
  if (O.glasses) { for (const gx of [hx + 6, hx + 14]) { P.rect(gx, hy + 12, 6, 1, INK); P.rect(gx, hy + 16, 6, 1, INK); P.rect(gx, hy + 12, 1, 5, INK); P.rect(gx + 5, hy + 12, 1, 5, INK); } }
  if (O.cap) { P.box(hx - 1, hy - 2, 28, 7, O.cap, 2); P.rect(hx + 2, hy + 4, 24, 2, O.cap[0]); P.box(hx + 11, hy, 4, 3, C.gold); }
  P.outline(); return P;
}

// ---------- Larry: ring-tailed lemur, monocle, white shirt, red tie (64 x 84) ----------
export function larry(pose = 'explaining', open = false) {
  const P = new Pix(72, 84), ox = 18, top = 42;
  const tail = [[46, 74], [49, 71], [51, 67], [52, 63], [53, 59], [53, 55], [52, 51], [51, 47], [51, 43], [52, 39], [54, 35], [56, 32], [58, 29]];
  tail.forEach(([x, y], i) => { const c = (i >> 1) % 2 ? C.white : C.black; P.ellipse(x + 4, y, 3, 2, c[1]); P.set(x + 2, y - 1, c[2]); });
  P.box(ox + 5, top + 21, 6, 16, C.lemur); P.box(ox + 15, top + 21, 6, 16, C.lemur);
  P.box(ox + 3, top + 36, 9, 5, C.black); P.box(ox + 14, top + 36, 9, 5, C.black);
  P.box(ox + 1, top, 24, 23, C.lemur, 2);
  P.box(ox + 7, top, 12, 22, C.white);
  P.rect(ox + 11, top + 1, 4, 2, C.tie[0]); P.rect(ox + 11, top + 3, 4, 12, C.tie[1]); P.rect(ox + 11, top + 3, 1, 12, C.tie[2]); P.rect(ox + 12, top + 15, 2, 2, C.tie[1]);
  const arms = { explaining: ['down', 'out'], pointing: ['down', 'up'], thinking: ['down', 'chin'], concerned: ['down', 'chin'], surprised: ['up', 'up'], smug: ['down', 'down'], sneaky: ['out', 'down'], neutral: ['down', 'down'] }[pose] || ['down', 'out'];
  const hand = C.black;
  arm(P, -1, arms[0], ox, top, C.lemur, hand); arm(P, 1, arms[1], ox, top, C.lemur, hand);
  // head
  const hx = ox, hy = top - 30;
  P.box(hx + 2, hy - 6, 7, 10, C.lemur); P.box(hx + 17, hy - 6, 7, 10, C.lemur); P.rect(hx + 4, hy - 4, 3, 6, C.white[1]); P.rect(hx + 19, hy - 4, 3, 6, C.white[1]);
  P.box(hx, hy, 26, 30, C.lemur, 4);
  P.box(hx + 3, hy + 9, 20, 19, C.white, 3);
  P.rect(hx + 3, hy + 3, 20, 2, C.lemur[2]);
  P.box(hx + 3, hy + 9, 9, 9, C.black, 2); P.box(hx + 14, hy + 9, 9, 9, C.black, 2);
  const lid = pose === 'smug' ? 1 : 0, big = pose === 'surprised' ? 1 : 0;
  P.rect(hx + 5, hy + 11 + lid, 5, 4 - lid + big, C.amber[1]); P.rect(hx + 16, hy + 11 + lid, 5, 4 - lid + big, C.amber[1]);
  P.rect(hx + 7, hy + 12 + lid, 2, 2, INK); P.rect(hx + 18, hy + 12 + lid, 2, 2, INK); P.set(hx + 5, hy + 11 + lid, C.amber[2]); P.set(hx + 16, hy + 11 + lid, C.amber[2]);
  const bL = { concerned: 1, thinking: 0, surprised: -2, smug: 0, sneaky: 1 }[pose] ?? 0;
  P.rect(hx + 4, hy + 7 + bL, 6, 1, C.black[0]); P.rect(hx + 16, hy + 7 + (pose === 'concerned' ? -1 : bL), 6, 1, C.black[0]);
  for (let a = 0; a < 44; a++) { const t = a / 44 * Math.PI * 2; P.set(hx + 18 + Math.round(Math.cos(t) * 5), hy + 13 + Math.round(Math.sin(t) * 5), a < 22 ? C.gold[2] : C.gold[1]); }
  for (let i = 0; i < 10; i++) P.set(hx + 23 - (i >> 2), hy + 18 + i, i % 2 ? C.gold[0] : C.gold[1]);
  P.box(hx + 9, hy + 18, 8, 7, C.white); P.rect(hx + 11, hy + 18, 4, 2, C.black[0]);
  if (open) { P.rect(hx + 10, hy + 23, 6, 3, C.mouth); P.rect(hx + 11, hy + 25, 4, 1, C.tongue); }
  else if (pose === 'surprised') P.rect(hx + 12, hy + 23, 2, 3, C.mouth);
  else if (pose === 'smug') { P.rect(hx + 10, hy + 24, 6, 1, C.black[1]); P.set(hx + 16, hy + 23, C.black[1]); }
  else P.rect(hx + 10, hy + 24, 6, 1, C.black[1]);
  P.outline(); return P;
}

// ---------- pixel font + signs ----------
const G = {
  A: '01110100011000111111100011000110001', B: '11110100011000111110100011000111110', C: '01110100011000010000100001000101110', D: '11110100011000110001100011000111110',
  E: '11111100001000011110100001000011111', F: '11111100001000011110100001000010000', G: '01110100011000010111100011000101111', H: '10001100011000111111100011000110001',
  I: '01110001000010000100001000010001110', J: '00111000100001000010000101001001100', K: '10001100101010011000101001001010001', L: '10000100001000010000100001000011111',
  M: '10001110111010110101100011000110001', N: '10001110011010110011100011000110001', O: '01110100011000110001100011000101110', P: '11110100011000111110100001000010000',
  Q: '01110100011000110001101011001001101', R: '11110100011000111110101001001010001', S: '01111100001000001110000010000111110', T: '11111001000010000100001000010000100',
  U: '10001100011000110001100011000101110', V: '10001100011000110001100010101000100', W: '10001100011000110101101011101110001', X: '10001100010101000100010101000110001',
  Y: '10001100010101000100001000010000100', Z: '11111000010001000100010001000011111', 0: '01110100011001110101110011000101110', 1: '00100011000010000100001000010001110',
  2: '01110100010000100010001000100011111', 3: '11110000010000101110000010000111110', 4: '00010001100101010010111110001000010', 5: '11111100001111000001000011000101110',
  6: '00110010001000011110100011000101110', 7: '11111000010001000100010000100001000', 8: '01110100011000101110100011000101110', 9: '01110100011000101111000010001001100',
  ':': '00000001000010000000001000010000000', '=': '00000000001111100000111110000000000', ' ': '00000000000000000000000000000000000', '.': '00000000000000000000000000011000110',
  '!': '00100001000010000100001000000000100', '?': '01110100010000100010001000000000100', '%': '11001110010001000100010001001110011', '$': '00100011111010001110001011111000100',
  '-': '00000000000000011111000000000000000', "'": '00100001000100000000000000000000000', ',': '00000000000000000000000110001000100', '&': '01100100101010001000101011001001101',
  '/': '00001000010001000100010001000010000', '+': '00000001000010011111001000010000000',
};
export function pixText(P, x, y, s, c) { for (const ch of s.toUpperCase()) { const g = G[ch] || G[' ']; for (let j = 0; j < 7; j++) for (let i = 0; i < 5; i++) if (g[j * 5 + i] === '1') P.set(x + i, y + j, c); x += 6; } return x; }
export const textWidth = s => s.length * 6 - 1;
function wrap(text, max = 14) { const out = []; let line = ''; for (const w of text.split(/\s+/)) { if (line && (line + ' ' + w).length > max) { out.push(line); line = w; } else line = line ? line + ' ' + w : w; } if (line) out.push(line); return out; }

// small pixel icons for the emoji the episode markup uses on signs (unknown emoji: no icon)
const ICONS = {
  people: P => { const k = hex('#2d6fd6'); for (const cx of [-4, 4]) { P.ellipse(cx, 0, 2, 2, k); P.rect(cx - 3, 3, 7, 4, k); } },
  scroll: P => { P.rect(-6, -1, 12, 8, hex('#e8cf96')); P.rect(-7, -2, 2, 10, hex('#b88a4a')); P.rect(5, -2, 2, 10, hex('#b88a4a')); for (let y = 1; y < 6; y += 2) P.rect(-4, y, 8, 1, hex('#8a6a3a')); },
  map: P => { P.rect(-7, -2, 14, 9, hex('#7fc4e8')); P.rect(-5, 0, 5, 4, hex('#5aa04a')); P.rect(1, 2, 4, 3, hex('#5aa04a')); },
  warning: P => { for (let j = 0; j < 9; j++) P.rect(-j / 2 | 0, j - 2, j + 1, 1, hex('#f2c230')); P.rect(0, 0, 1, 4, INK); P.set(0, 5, INK); },
  money: P => { P.rect(-7, 0, 14, 7, hex('#3f9a4a')); P.rect(-5, 1, 10, 5, hex('#5ec26a')); P.ellipse(0, 3, 2, 2, hex('#2a6a32')); },
  book: P => { P.rect(-6, -2, 12, 10, hex('#c23a3a')); P.rect(-5, -1, 10, 8, hex('#e04a4a')); P.rect(-1, -2, 1, 10, hex('#8a1e1e')); },
  search: P => { P.ellipse(-1, 1, 3, 3, hex('#2d6fd6')); P.ellipse(-1, 1, 2, 2, hex('#cfe8ff')); P.rect(2, 4, 2, 2, INK); P.rect(4, 6, 2, 2, INK); },
};
const EMOJI = { '👥': 'people', '📜': 'scroll', '🗺': 'map', '⚠': 'warning', '💵': 'money', '💰': 'money', '🧾': 'money', '📕': 'book', '📖': 'book', '🔍': 'search' };
export function iconFor(e) { for (const k in EMOJI) if ((e || '').includes(k)) return EMOJI[k]; return null; }

export function sign(text, icon) {
  const lines = wrap(text), tw = Math.max(...lines.map(textWidth)), ic = icon && ICONS[icon] ? 12 : 0;
  const w = Math.max(44, tw + 12), bh = 10 + ic + lines.length * 9, P = new Pix(w, bh + 20);
  const post = ramp(['#4a2c18', '#7a4a28', '#a06a3c']);
  P.box(6, bh - 2, 3, 22, post); P.box(w - 9, bh - 2, 3, 22, post);
  P.rect(0, 0, w, bh, hex('#1d2f6b')); P.rect(2, 2, w - 4, bh - 4, hex('#f4f1e8')); P.rect(2, bh - 5, w - 4, 3, hex('#d4342c'));
  if (ic) { const I = new Pix(w, 14); const off = { set: (x, y, c) => I.set(w / 2 + x, 4 + y, c), rect: (x, y, ww, hh, c) => I.rect(w / 2 + x, 4 + y, ww, hh, c), ellipse: (x, y, rx, ry, c) => I.ellipse(w / 2 + x, 4 + y, rx, ry, c) }; ICONS[icon](off); P.stamp(I, 0, 2); }
  lines.forEach((l, i) => pixText(P, ((w - textWidth(l)) / 2) | 0, 5 + ic + i * 9, l, hex('#15151c')));
  P.outline(); return P;
}
