// Pixel kit: every character, prop and set tile is drawn pixel by pixel in code (no art files).
// Light comes from the upper left: each ramp goes shadow -> base -> highlight.

export function hex(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255, 255]; }
export const ramp = cs => cs.map(hex);

export class Pix {
  constructor(w, h) { this.w = w; this.h = h; this.d = new Uint8ClampedArray(w * h * 4); }
  set(x, y, c) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= this.w || y >= this.h || !c) return; const i = (y * this.w + x) * 4; this.d.set(c, i); }
  get(x, y) { if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null; const i = (y * this.w + x) * 4; return this.d[i + 3] ? this.d.slice(i, i + 4) : null; }
  rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c); }
  // shaded box: left column highlight, right columns shadow, bottom row shadow
  box(x, y, w, h, r, round = 0) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      if (round && ((i < round && j < round && (round - i) + (round - j) > round + 1) || (i >= w - round && j < round && (i - (w - round - 1)) + (round - j) > round + 1) ||
                    (i < round && j >= h - round && (round - i) + (j - (h - round - 1)) > round + 1) || (i >= w - round && j >= h - round && (i - (w - round - 1)) + (j - (h - round - 1)) > round + 1))) continue;
      let k = 1; if (i === 0 || j === 0) k = 2; if (i >= w - 2 || j === h - 1) k = 0;
      this.set(x + i, y + j, r[Math.min(k, r.length - 1)]);
    }
  }
  ellipse(cx, cy, rx, ry, c) { for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) this.set(cx + x, cy + y, c); }
  outline(ink) {           // 1 px dark outline around everything drawn (sel-out style)
    const add = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (!this.get(x, y) && (this.get(x - 1, y) || this.get(x + 1, y) || this.get(x, y - 1) || this.get(x, y + 1))) add.push([x, y]);
    for (const [x, y] of add) this.set(x, y, ink);
  }
  canvas() { const c = document.createElement('canvas'); c.width = this.w; c.height = this.h; c.getContext('2d').putImageData(new ImageData(this.d, this.w, this.h), 0, 0); return c; }
}

const INK = hex('#1b1420');
const C = {
  lemur: ramp(['#6c6a72', '#9b99a3', '#c4c2cb']), white: ramp(['#c9c6cf', '#ecebf0', '#ffffff']), black: ramp(['#141218', '#25222b', '#3a3642']),
  amber: ramp(['#b8741c', '#f2b632', '#ffe08a']), gold: ramp(['#8a6418', '#d9a93a', '#ffe08a']), tie: ramp(['#8e1416', '#d42a24', '#ff6a52']),
  skinC: ramp(['#b08260', '#dcb18a', '#f3d2ae']), hairC: ramp(['#2e1a12', '#4c2c1c', '#6e4128']), plaid: ramp(['#8f1515', '#d62b2b', '#ff5a4a']),
  jeans: ramp(['#1f3b78', '#2f58ad', '#4f7fd6']), shoe: ramp(['#3a2416', '#5a3a24', '#7a5236']), fur: ramp(['#a8946e', '#cdb990', '#e7d8b4']),
  face: ramp(['#c2443a', '#e8685a', '#ff9585']), track: ramp(['#a01818', '#e02a2a', '#ff6a5a']),
};

// ---------- Larry: ring-tailed lemur, monocle, white shirt, red tie ----------
export function larry(pose = 'explaining') {
  const P = new Pix(64, 76), ox = 14;
  // tail: black/white rings curving up behind his right side
  const tail = [[44, 66], [47, 63], [49, 59], [50, 55], [51, 51], [51, 47], [50, 43], [49, 39], [49, 35], [50, 31], [52, 27], [54, 24], [56, 21]];
  tail.forEach(([x, y], i) => { const c = (i >> 1) % 2 ? C.white : C.black; P.ellipse(x, y, 3, 2, c[1]); P.set(x - 2, y - 1, c[2]); });
  // legs + feet
  P.box(ox + 5, 56, 6, 13, C.lemur); P.box(ox + 15, 56, 6, 13, C.lemur);
  P.box(ox + 3, 68, 9, 4, C.black); P.box(ox + 14, 68, 9, 4, C.black);
  // torso: grey with white shirt front and red tie
  P.box(ox + 2, 34, 22, 23, C.lemur, 2);
  P.box(ox + 8, 34, 10, 22, C.white);
  P.rect(ox + 12, 35, 3, 2, C.tie[0]); P.rect(ox + 11, 37, 5, 12, C.tie[1]); P.rect(ox + 11, 37, 1, 12, C.tie[2]); P.rect(ox + 12, 49, 3, 2, C.tie[1]); P.set(ox + 13, 51, C.tie[0]);
  // arms
  P.box(ox - 3, 36, 6, 15, C.lemur); P.box(ox - 4, 50, 7, 5, C.black);                                  // his right arm (viewer's left), down
  if (pose === 'pointing') { P.box(ox + 23, 18, 6, 18, C.lemur); P.box(ox + 23, 13, 6, 6, C.black); P.rect(ox + 25, 8, 2, 5, C.black[1]); }
  else { P.box(ox + 23, 36, 13, 6, C.lemur); P.box(ox + 35, 34, 6, 7, C.black); }                        // explaining: palm out
  // head
  P.box(ox, 10, 26, 24, C.lemur, 4);
  P.box(ox + 4, 18, 18, 14, C.white, 3);                                                             // white mask
  P.box(ox + 3, 4, 7, 9, C.lemur); P.box(ox + 16, 4, 7, 9, C.lemur); P.rect(ox + 5, 6, 3, 5, C.white[1]); P.rect(ox + 18, 6, 3, 5, C.white[1]);   // ears
  P.rect(ox + 4, 13, 18, 2, C.lemur[2]);
  // black eye patches + amber eyes
  P.box(ox + 4, 17, 8, 8, C.black, 2); P.box(ox + 14, 17, 8, 8, C.black, 2);
  P.rect(ox + 6, 19, 4, 4, C.amber[1]); P.rect(ox + 16, 19, 4, 4, C.amber[1]); P.rect(ox + 7, 20, 2, 2, INK); P.rect(ox + 17, 20, 2, 2, INK);
  P.set(ox + 6, 19, C.amber[2]); P.set(ox + 16, 19, C.amber[2]);
  // monocle on his left eye (viewer's right) + chain
  for (let a = 0; a < 40; a++) { const t = a / 40 * Math.PI * 2; P.set(ox + 18 + Math.round(Math.cos(t) * 4.5), 21 + Math.round(Math.sin(t) * 4.5), a < 20 ? C.gold[2] : C.gold[1]); }
  for (let i = 0; i < 9; i++) P.set(ox + 22 - (i >> 2), 26 + i, i % 2 ? C.gold[0] : C.gold[1]);
  // snout + mouth
  P.box(ox + 10, 25, 6, 5, C.white); P.rect(ox + 11, 25, 4, 2, C.black[0]); P.rect(ox + 11, 30, 4, 1, C.black[1]);
  P.outline(INK); return P;
}

// ---------- Gary: chimp everyman, red plaid shirt, jeans ----------
export function gary(pose = 'wave') {
  const P = new Pix(56, 76), ox = 12;
  P.box(ox + 5, 54, 7, 15, C.jeans); P.box(ox + 15, 54, 7, 15, C.jeans); P.rect(ox + 13, 54, 1, 10, C.jeans[0]);
  P.box(ox + 3, 68, 9, 4, C.shoe); P.box(ox + 15, 68, 9, 4, C.shoe);
  P.box(ox + 1, 33, 26, 22, C.plaid, 2);
  for (let y = 36; y < 54; y += 5) P.rect(ox + 2, y, 24, 1, C.plaid[0]); for (let x = ox + 6; x < ox + 26; x += 6) P.rect(x, 34, 1, 20, C.plaid[0]);
  P.rect(ox + 13, 34, 2, 20, hex('#f2efe8'));                                                           // zip / placket
  P.box(ox - 4, 35, 6, 14, C.plaid); P.box(ox - 4, 48, 6, 5, C.skinC);
  if (pose === 'wave') { P.box(ox + 27, 16, 6, 19, C.plaid); P.box(ox + 27, 10, 7, 7, C.skinC); }
  else { P.box(ox + 26, 35, 6, 14, C.plaid); P.box(ox + 26, 48, 6, 5, C.skinC); }
  P.box(ox - 2, 18, 5, 8, C.skinC); P.box(ox + 25, 18, 5, 8, C.skinC);                                  // ears
  P.box(ox + 1, 6, 26, 28, C.hairC, 4);
  P.box(ox + 4, 14, 20, 18, C.skinC, 3);
  P.rect(ox + 6, 17, 6, 2, C.hairC[0]); P.rect(ox + 16, 17, 6, 2, C.hairC[0]);                         // brows (smug)
  P.rect(ox + 7, 19, 4, 3, hex('#ffffff')); P.rect(ox + 17, 19, 4, 3, hex('#ffffff')); P.rect(ox + 9, 20, 2, 2, INK); P.rect(ox + 19, 20, 2, 2, INK);
  P.box(ox + 9, 24, 10, 6, C.skinC); P.rect(ox + 11, 25, 2, 1, C.skinC[0]); P.rect(ox + 15, 25, 2, 1, C.skinC[0]);
  P.rect(ox + 10, 28, 8, 1, C.hairC[0]); P.set(ox + 17, 27, C.hairC[0]);                                // smug half smile
  P.outline(INK); return P;
}

// ---------- Chad: macaque in a red tracksuit ----------
export function chad() {
  const P = new Pix(56, 76), ox = 12;
  P.box(ox + 5, 54, 7, 15, C.track); P.box(ox + 15, 54, 7, 15, C.track); P.rect(ox + 5, 54, 1, 15, hex('#ffffff')); P.rect(ox + 21, 54, 1, 15, hex('#ffffff'));
  P.box(ox + 3, 68, 9, 4, ramp(['#c8c8c8', '#f2f2f2', '#ffffff'])); P.box(ox + 15, 68, 9, 4, ramp(['#c8c8c8', '#f2f2f2', '#ffffff']));
  P.box(ox + 1, 33, 26, 22, C.track, 2); P.rect(ox + 13, 34, 2, 20, hex('#ffffff')); P.rect(ox + 1, 34, 1, 20, hex('#ffffff')); P.rect(ox + 26, 34, 1, 20, hex('#ffffff'));
  P.box(ox - 4, 35, 6, 14, C.track); P.box(ox - 4, 48, 6, 5, C.fur); P.box(ox + 26, 35, 6, 14, C.track); P.box(ox + 26, 48, 6, 5, C.fur);
  P.box(ox - 2, 17, 5, 8, C.fur); P.box(ox + 25, 17, 5, 8, C.fur);
  P.box(ox + 1, 6, 26, 28, C.fur, 4);
  P.box(ox + 5, 13, 18, 17, C.face, 3);
  P.rect(ox + 7, 17, 4, 3, hex('#ffffff')); P.rect(ox + 17, 17, 4, 3, hex('#ffffff')); P.rect(ox + 8, 18, 2, 2, INK); P.rect(ox + 18, 18, 2, 2, INK);
  P.rect(ox + 6, 15, 6, 1, C.face[0]); P.rect(ox + 16, 15, 6, 1, C.face[0]);
  P.box(ox + 10, 22, 8, 6, C.face); P.rect(ox + 12, 23, 1, 1, C.face[0]); P.rect(ox + 15, 23, 1, 1, C.face[0]); P.rect(ox + 11, 26, 6, 1, C.face[0]);
  P.rect(ox + 3, 6, 22, 2, C.fur[2]);
  P.outline(INK); return P;
}

// ---------- tiny 5x7 pixel font for signs ----------
const G = {
  A: '01110100011000111111100011000110001', B: '11110100011000111110100011000111110', C: '01110100011000010000100001000101110', D: '11110100011000110001100011000111110',
  E: '11111100001000011110100001000011111', F: '11111100001000011110100001000010000', G: '01110100011000010111100011000101111', H: '10001100011000111111100011000110001',
  I: '01110001000010000100001000010001110', J: '00111000100001000010000101001001100', K: '10001100101010011000101001001010001', L: '10000100001000010000100001000011111',
  M: '10001110111010110101100011000110001', N: '10001110011010110011100011000110001', O: '01110100011000110001100011000101110', P: '11110100011000111110100001000010000',
  Q: '01110100011000110001101011001001101', R: '11110100011000111110101001001010001', S: '01111100001000001110000010000111110', T: '11111001000010000100001000010000100',
  U: '10001100011000110001100011000101110', V: '10001100011000110001100010101000100', W: '10001100011000110101101011101110001', X: '10001100010101000100010101000110001',
  Y: '10001100010101000100001000010000100', Z: '11111000010001000100010001000011111', 0: '01110100011001110101110011000101110', 1: '00100011000010000100001000010001110',
  2: '01110100010000100010001000100011111', 3: '11110000010000101110000010000111110', ':': '00000001000010000000001000010000000', '=': '00000000001111100000111110000000000',
  ' ': '00000000000000000000000000000000000', '.': '00000000000000000000000000011000110', '!': '00100001000010000100001000000000100', '?': '01110100010000100010001000000000100',
};
export function pixText(P, x, y, s, c, scale = 1) {
  for (const ch of s.toUpperCase()) { const g = G[ch] || G[' ']; for (let j = 0; j < 7; j++) for (let i = 0; i < 5; i++) if (g[j * 5 + i] === '1') P.rect(x + i * scale, y + j * scale, scale, scale, c); x += 6 * scale; }
  return x;
}
export const textWidth = (s, scale = 1) => s.length * 6 * scale - scale;

// ---------- sign board ----------
export function sign(text, icon) {
  const lines = Array.isArray(text) ? text : [text], tw = Math.max(...lines.map(l => textWidth(l)));
  const w = Math.max(48, tw + 12), P = new Pix(w, 46 + (lines.length - 1) * 9); const top = (lines.length - 1) * 9;
  P.box(6, 26 + top, 3, 20, ramp(['#4a2c18', '#7a4a28', '#a06a3c'])); P.box(w - 9, 26 + top, 3, 20, ramp(['#4a2c18', '#7a4a28', '#a06a3c']));
  P.rect(0, 0, w, 30 + top, hex('#1d2f6b')); P.rect(2, 2, w - 4, 26 + top, hex('#f4f1e8')); P.rect(2, 25 + top, w - 4, 3, hex('#d4342c'));
  if (icon === 'people') { const k = hex('#2d6fd6'); for (const cx of [w / 2 - 5, w / 2 + 3]) { P.ellipse(cx | 0, 7, 2, 2, k); P.rect((cx | 0) - 3, 10, 7, 4, k); } }
  lines.forEach((l, i) => pixText(P, ((w - textWidth(l)) / 2) | 0, 15 + i * 9, l, hex('#15151c')));
  P.outline(INK); return P;
}
