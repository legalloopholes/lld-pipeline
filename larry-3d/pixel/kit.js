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
  lemur: ramp(['#6f6d78', '#9d9ba6', '#c9c7d0']), white: ramp(['#cfccd6', '#efeef3', '#ffffff']), black: ramp(['#141218', '#25222b', '#3a3642']),
  amber: ramp(['#c06a10', '#f5a623', '#ffd76a']), gold: ramp(['#8a6418', '#d9a93a', '#ffe08a']), tie: ramp(['#8e1416', '#d42a24', '#ff6a52']),
  mouth: hex('#5a1820'), tongue: hex('#e0707a'), teeth: hex('#f6f3ec'), blush: hex('#f4a3ae'), nostril: hex('#24150f'), eye: hex('#1a120e'),
};

// shaded ellipse, light from the upper left (r = [shadow, base, highlight])
function blob(P, cx, cy, rx, ry, r) {
  for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) {
    const nx = x / (rx || 1), ny = y / (ry || 1); if (nx * nx + ny * ny > 1.0001) continue;
    const l = -0.55 * nx - 0.75 * ny; P.set(cx + x, cy + y, r[l > 0.45 ? 2 : l < -0.5 ? 0 : 1]);
  }
}
function limb(P, x0, y0, x1, y1, w, r) { const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0))); for (let i = 0; i <= n; i++) { const t = i / n; blob(P, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, w, w, r); } }

// mouth: lvl 0 = closed (expression), 1..3 = open, sized by the loudness of the voice on that frame
function mouthShape(P, x, y, kind, lvl, line) {      // x = left edge of a 6-wide mouth, y = the mouth line
  if (lvl > 0) {
    const w = lvl === 1 ? 4 : 6, h = lvl + 1, x0 = x + (6 - w) / 2;
    P.rect(x0, y - 1, w, h, C.mouth); if (w > 2) { P.set(x0, y - 1, null); }
    if (lvl >= 2) P.rect(x0 + 1, y - 1, w - 2, 1, C.teeth);
    if (lvl === 3) P.rect(x0 + 1, y + 1, w - 2, 1, C.tongue);
    return;
  }
  if (kind === 'surprised') { P.rect(x + 2, y - 1, 2, 3, C.mouth); return; }
  if (kind === 'smug') { P.rect(x, y, 5, 1, line); P.set(x + 5, y - 1, line); return; }
  if (kind === 'worried' || kind === 'angry') { P.rect(x + 1, y, 4, 1, line); P.set(x, y + 1, line); P.set(x + 5, y + 1, line); return; }
  P.rect(x + 1, y, 4, 1, line); P.set(x, y - 1, line); P.set(x + 5, y - 1, line);          // gentle smile
}

// primate eye (4 x 5): dark, glossy, with a catch-light; blink = a closed lid line
function eye(P, x, y, kind, blink, sk, big, look = [0, 0]) {
  const wht = hex('#ffffff'); x += look[0]; y += look[1];
  if (big) { blob(P, x + 2, y + 2, 3, 3, C.amber); if (blink) { P.rect(x - 1, y + 2, 7, 1, C.eye); return; } P.rect(x + 1, y + 1, 3, 3, C.eye); P.set(x + 1, y + 1, wht); return; }
  if (blink) { P.rect(x, y + 2, 4, 1, C.eye); P.set(x, y + 1, sk[0]); P.set(x + 3, y + 1, sk[0]); return; }
  if (kind === 'surprised') { P.rect(x, y, 4, 5, wht); P.rect(x + 1, y + 1, 2, 3, C.eye); P.set(x + 1, y + 1, wht); return; }
  P.rect(x + 1, y, 2, 5, C.eye); P.rect(x, y + 1, 4, 3, C.eye); P.set(x + 1, y + 1, wht);
  if (kind === 'smug') P.rect(x, y, 4, 2, sk[0]);                                           // heavy lids
}

// face on an 18 x 19 skin panel: brow ridge, eyes, nose with nostrils, mouth
function face(P, fx, fy, kind, S, mouth, blink, look = [0, 0]) {
  const sk = S.skin;
  if (S.snout) { blob(P, fx + 9, fy + 13, 8, 6, [sk[1], sk[2], sk[2]]); if (S.blueSides) { P.rect(fx + 3, fy + 10, 2, 6, sk[0]); P.rect(fx + 13, fy + 10, 2, 6, sk[0]); } }
  else blob(P, fx + 9, fy + 13, 7, 5, [sk[1], sk[2], sk[2]]);                                  // lighter muzzle
  const [o, i] = { neutral: [0, 0], smug: [0, 1], surprised: [-2, -2], worried: [1, -1], angry: [-1, 1] }[kind] || [0, 0];
  const brow = S.brow || sk[0];
  P.rect(fx + 2, fy + 3 + o, 3, 1, brow); P.rect(fx + 5, fy + 3 + i, 2, 1, brow);
  P.rect(fx + 11, fy + 3 + i, 2, 1, brow); P.rect(fx + 13, fy + 3 + o, 3, 1, brow);
  eye(P, fx + 3, fy + 5, kind, blink, sk, S.bigEyes, look); eye(P, fx + 11, fy + 5, kind, blink, sk, S.bigEyes, look);
  if (S.nose) {                                                                           // proboscis: big drooping nose
    blob(P, fx + 9, fy + 12, 3, 4, [sk[1], sk[2], sk[2]]); P.set(fx + 8, fy + 15, C.nostril); P.set(fx + 10, fy + 15, C.nostril);
    mouthShape(P, fx + 6, fy + 18, kind, Math.min(mouth, 2), C.nostril); return;
  }
  const ny = S.snout ? fy + 9 : fy + 9;
  P.rect(fx + 7, ny, 4, 2, sk[0]); P.set(fx + 7, ny + 1, C.nostril); P.set(fx + 10, ny + 1, C.nostril);   // nose + nostrils
  mouthShape(P, fx + 6, fy + 14, kind, mouth, C.nostril);
}

// ---------- species and outfits (mirrors the 3D kit's names so auto-casting carries over) ----------
const SPECIES = {
  chimp: { fur: ramp(['#2e1a12', '#4c2c1c', '#6e4128']), skin: ramp(['#b08260', '#dcb18a', '#f3d2ae']), ears: true },
  gorilla: { fur: ramp(['#141218', '#25222b', '#3d3946']), skin: ramp(['#2e2a33', '#4a4552', '#66606e']), crest: true, brow: hex('#141218') },
  orangutan: { fur: ramp(['#7a3410', '#b0521c', '#d9772e']), skin: ramp(['#6a4a3a', '#8c6650', '#ad8468']), cheeks: true },
  macaque: { fur: ramp(['#a8946e', '#cdb990', '#e7d8b4']), skin: ramp(['#c2443a', '#e8685a', '#ff9585']), ears: true },
  baboon: { fur: ramp(['#6e5a3a', '#94805a', '#b8a47c']), skin: ramp(['#3a2e2a', '#5a4a44', '#7a6860']), snout: true },
  mandrill: { fur: ramp(['#3a3a2e', '#5a5a44', '#7c7c60']), skin: ramp(['#2a5ab0', '#d8342c', '#ff6a5a']), snout: true, blueSides: true, brow: hex('#2a2a20') },
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

function arm(P, side, kind, ox, top, sleeve, hand, sway = 0) {   // side -1 = viewer's left, +1 = viewer's right; torso 26 wide
  const x = side < 0 ? ox - 5 : ox + 25;
  if (kind === 'down') { P.box(x, top + 2, 6, 14, sleeve); P.box(x + side * sway, top + 15, 6, 5, hand); }
  else if (kind === 'out') { const ax = side < 0 ? x - 8 : x; P.box(ax, top + 3, 14, 6, sleeve); P.box(side < 0 ? ax - 5 : ax + 13, top + 1 - sway, 6, 7, hand); }
  else if (kind === 'up') { P.box(x, top - 16, 6, 19, sleeve); P.box(x + side * sway, top - 22, 6, 7, hand); }
  else if (kind === 'chin') { P.box(x - 4, top + 2, 6, 10, sleeve); P.box(x - 9, top - 4, 7, 6, hand); }
  else if (kind === 'head') { P.box(x, top - 12, 6, 15, sleeve); P.box(x - 4 + sway, top - 20, 7, 6, hand); }
  else if (kind === 'chest') { if (side > 0) { P.box(x - 1, top + 2, 6, 9, sleeve); P.box(x - 5, top + 8, 6, 5, hand); } else { P.box(x, top + 2, 6, 9, sleeve); P.box(x + 4, top + 8, 6, 5, hand); } }
  else if (kind === 'mouth') { P.box(x - 4, top + 1, 6, 10, sleeve); P.box(x - 9, top - 9, 7, 6, hand); }
  else if (kind === 'phone') { P.box(x - 4, top + 4, 6, 8, sleeve); P.box(x - 10, top + 2, 7, 5, hand); }
}

// generic primate: 64 x 84 frame, feet on the bottom row.
// Idle: breath (0/1) lifts the upper body one pixel with the feet planted; blink closes the eyes; sway moves the hands a pixel.
// Idle actions (act): smoke_drag smoke_hold phone coffee sip gavel_up gavel_down papers notepad stretch watch scratch glare.
// P.emit = where smoke leaves the cigarette, P.impact = where the gavel hits (sprite coordinates).
export function primate({ species = 'chimp', outfit = 'plaid', face: fk = 'neutral', gest = 'none', mouth = 0, blink = false, breath = 0, sway = 0, act = '', look = [0, 0] } = {}) {
  const S = SPECIES[species] || SPECIES.chimp, O = OUTFITS[outfit] || OUTFITS.plaid;
  const P = new Pix(64, 84), U = new Pix(64, 84), ox = 19, top = 41;
  P.box(ox + 5, top + 21, 7, 16, O.legs); P.box(ox + 14, top + 21, 7, 16, O.legs);
  if (O.pattern === 'stripes') { P.rect(ox + 5, top + 21, 1, 16, hex('#ffffff')); P.rect(ox + 20, top + 21, 1, 16, hex('#ffffff')); }
  P.box(ox + 3, top + 36, 9, 5, O.shoe); P.box(ox + 14, top + 36, 9, 5, O.shoe);
  if (outfit === 'robe') U.box(ox, top, 26, 38 + breath, O.top, 2);
  else U.box(ox, top, 26, 22 + breath, O.top, 2);
  if (O.pattern === 'plaid') { for (let y = top + 3; y < top + 21; y += 5) U.rect(ox + 1, y, 24, 1, O.top[0]); for (let x = ox + 5; x < ox + 25; x += 6) U.rect(x, top + 1, 1, 20, O.top[0]); }
  if (O.pattern === 'stripes') { U.rect(ox, top + 1, 1, 20, hex('#ffffff')); U.rect(ox + 25, top + 1, 1, 20, hex('#ffffff')); }
  if (O.zip) U.rect(ox + 12, top + 1, 2, 20, hex('#f2efe8'));
  if (O.collar) { U.rect(ox + 9, top, 8, 3, hex('#f4f4f4')); U.rect(ox + 12, top + 3, 2, 3, hex('#f4f4f4')); }
  if (O.tie) { U.rect(ox + 10, top, 6, 14, hex('#f2efe8')); U.rect(ox + 12, top + 1, 2, 11, C.tie[1]); U.set(ox + 12, top + 1, C.tie[2]); }
  if (O.badge) U.box(ox + 17, top + 4, 4, 4, C.gold);
  let [aL, aR] = ARMS[gest] || ARMS.none, lk = look, emit = null, impact = null;
  const it = [];
  switch (act) {
    case 'smoke_drag': aR = 'mouth'; it.push('cig_mouth'); break;
    case 'smoke_hold': aR = 'down'; it.push('cig_hand'); break;
    case 'phone': aR = 'phone'; lk = [0, 1]; it.push('phone'); break;
    case 'coffee': aR = 'chest'; it.push('mug'); break;
    case 'sip': aR = 'mouth'; it.push('mug_mouth'); blink = true; break;
    case 'gavel_up': aR = 'up'; it.push('gavel_up'); fk = 'angry'; lk = [-1, 0]; break;
    case 'gavel_down': aR = 'down'; it.push('gavel_down'); fk = 'angry'; lk = [-1, 0]; break;
    case 'papers': aL = 'chest'; aR = 'chest'; lk = [0, 1]; break;
    case 'notepad': aL = 'chest'; aR = 'chest'; lk = [0, 1]; break;
    case 'stretch': aL = 'up'; aR = 'up'; mouth = Math.max(mouth, 3); blink = true; break;
    case 'watch': aL = 'chest'; lk = [-1, 1]; it.push('watch'); break;
    case 'scratch': aR = 'head'; break;
    case 'glare': fk = 'angry'; break;
  }
  const W_ = hex('#f4f1e8'), ORANGE = hex('#ff8a2a'), BROWN = ramp(['#4a2c18', '#7a4a28', '#9a6a3c']);
  if (act === 'papers') { U.rect(ox + 3, top + 2, 20, 13, W_); for (let y = top + 4; y < top + 14; y += 2) U.rect(ox + 5, y, 14 - (y % 3), 1, hex('#9a9aa4')); }
  if (act === 'notepad') { U.rect(ox + 7, top + 3, 11, 12, hex('#f2e8a8')); for (let y = top + 6; y < top + 14; y += 2) U.rect(ox + 8, y, 9, 1, hex('#8ab0d8')); U.rect(ox + 7, top + 3, 11, 2, hex('#c23030')); }
  const FRONT = new Set(['mouth', 'chin', 'phone']);           // hands at the face go over the head
  const arms = front => { if (FRONT.has(aL) === front) arm(U, -1, aL, ox, top, O.top, S.skin, sway); if (FRONT.has(aR) === front) arm(U, 1, aR, ox, top, O.top, S.skin, act === 'notepad' ? Math.round(sway * 2) : sway); };
  arms(false);
  const x = ox + 25;
  const items = () => { for (const k of it) {
    if (k === 'cig_mouth') { U.rect(x - 2, top - 7, 4, 1, W_); U.set(x + 2, top - 7, ORANGE); emit = [x + 2, top - 8]; }
    if (k === 'cig_hand') { U.rect(x + 6 + sway, top + 17, 4, 1, W_); U.set(x + 10 + sway, top + 17, ORANGE); emit = [x + 10 + sway, top + 16]; }
    if (k === 'phone') { U.rect(x - 9, top - 5, 5, 8, hex('#22252c')); U.rect(x - 8, top - 4, 3, 6, hex('#7fd0ff')); }
    if (k === 'mug') { U.rect(x - 6, top + 3, 5, 6, W_); U.rect(x - 5, top + 3, 3, 1, BROWN[0]); U.set(x - 1, top + 5, W_); U.set(x - 1, top + 6, W_); }
    if (k === 'mug_mouth') { U.rect(x - 9, top - 13, 5, 6, W_); U.rect(x - 8, top - 13, 3, 1, BROWN[0]); }
    if (k === 'gavel_up') { U.box(x + 6, top - 20, 8, 2, BROWN); U.box(x + 13, top - 23, 5, 8, BROWN); }
    if (k === 'gavel_down') { U.box(x + 6, top + 17, 6, 2, BROWN); U.box(x + 11, top + 17, 5, 8, BROWN); impact = [x + 13, top + 25]; }
    if (k === 'watch') U.rect(ox - 1 + 4, top + 7, 4, 2, C.gold[1]);
  } };
  const hx = ox, hy = top - 30;
  if (S.ears) { U.box(hx - 3, hy + 11, 5, 8, S.skin); U.set(hx - 1, hy + 14, S.skin[0]); U.box(hx + 24, hy + 11, 5, 8, S.skin); U.set(hx + 26, hy + 14, S.skin[0]); }
  if (S.cheeks) { U.box(hx - 6, hy + 10, 8, 14, S.skin); U.box(hx + 24, hy + 10, 8, 14, S.skin); }
  U.box(hx, hy, 26, 30, S.fur, 4);
  if (S.crest) U.box(hx + 6, hy - 3, 14, 5, S.fur, 2);
  if (S.ring) U.box(hx + 2, hy + 6, 22, 22, ramp(['#d8d8d8', '#f0f0f0', '#ffffff']), 3);
  U.box(hx + 4, hy + 8, 18, 19, S.skin, 3);
  if (S.part) U.rect(hx + 12, hy, 2, 6, S.fur[0]);
  face(U, hx + 4, hy + 8, fk, S, mouth, blink, lk);
  if (O.glasses) for (const gx of [hx + 6, hx + 14]) { U.rect(gx, hy + 12, 6, 1, INK); U.rect(gx, hy + 18, 6, 1, INK); U.rect(gx, hy + 12, 1, 7, INK); U.rect(gx + 5, hy + 12, 1, 7, INK); }
  if (O.cap) { U.box(hx - 1, hy - 2, 28, 7, O.cap, 2); U.rect(hx + 2, hy + 4, 24, 2, O.cap[0]); U.box(hx + 11, hy, 4, 3, C.gold); }
  arms(true); items();
  P.stamp(U, 0, -breath);
  P.outline(); P.emit = emit && [emit[0], emit[1] - breath]; P.impact = impact; return P;
}

// ---------- Larry: a small, big-headed ring-tailed lemur with a monocle, white shirt and red tie (84 x 92) ----------
// Cute style: round head, big glossy dark eyes set low with two catch-lights, soft grey eye rings (lemur markings,
// not a mask), tiny nose, pink cheeks, "w" mouth. The tail grows out of his hip behind the body and sways (tail -4..4).
export const LARRY_W = 84, LARRY_H = 92;
const LC = { ring: ramp(['#3b3742', '#4d4855', '#615b6a']), hand: ramp(['#2f2c36', '#45414d', '#5a5564']), dark: hex('#1d1a22'),
             tailDark: ramp(['#26232b', '#38343f', '#4c4755']), shine: hex('#ffffff'), iris: hex('#7a4a1c'), glass: hex('#d8f0ff') };
function cuteEye(U, ex, ey, pose, blink, look) {
  if (blink || pose === 'happy') {                                          // closed: a soft downward arc
    U.rect(ex - 3, ey + 1, 7, 1, LC.dark); U.set(ex - 4, ey, LC.dark); U.set(ex + 4, ey, LC.dark); return;
  }
  const [lx, ly] = look;
  const big = pose === 'surprised' ? 1 : 0;
  blob(U, ex, ey, 4 + big, 5 + big, [LC.dark, LC.dark, LC.dark]);            // big glossy eye (wider when surprised)
  U.rect(ex - 2, ey + 3, 5, 1, LC.iris); U.rect(ex - 1, ey + 4, 3, 1, LC.iris);   // warm amber glow at the bottom
  U.rect(ex - 2 + lx, ey - 3 + ly, 2, 2, LC.shine); U.set(ex - 3 + lx, ey - 2 + ly, LC.shine);   // big catch-light
  U.set(ex + 2 + lx, ey + 1 + ly, LC.shine);                                 // small catch-light
  if (pose === 'smug' || pose === 'sneaky') { U.rect(ex - 4, ey - 5, 9, 4, C.lemur[1]); U.rect(ex - 4, ey - 1, 9, 1, LC.dark); }   // half-lidded
  if (pose === 'concerned') { U.set(ex - 4, ey - 4, C.lemur[1]); U.rect(ex - 4, ey - 5, 9, 1, C.lemur[1]); }
}
export function larry(pose = 'explaining', { mouth = 0, blink = false, breath = 0, tail = 0, ear = 0 } = {}) {
  const P = new Pix(LARRY_W, LARRY_H), U = new Pix(LARRY_W, LARRY_H), cx = 40, by = LARRY_H - 1;
  // tail: ringed, tapering curve from the hip, out to the right and up behind him
  const p0 = [cx + 5, by - 14], p1 = [cx + 28, by - 12], p2 = [cx + 33 + tail * 0.8, by - 44], p3 = [cx + 24 + tail * 1.6, by - 76];
  const pts = []; for (let i = 0; i <= 140; i++) { const t = i / 140, u = 1 - t;
    pts.push([u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]); }
  let len = 0;
  pts.forEach(([x, y], i) => { if (i) len += Math.hypot(x - pts[i - 1][0], y - pts[i - 1][1]); const t = i / 140, r = 4.2 - t * 1.4;
    const col = t > 0.92 ? LC.tailDark : Math.floor(len / 6.5) % 2 ? C.white : LC.tailDark; blob(P, x, y, r, r, col); });
  // little legs and feet (planted)
  blob(P, cx - 6, by - 8, 4, 5, C.lemur); blob(P, cx + 6, by - 8, 4, 5, C.lemur);
  blob(P, cx - 7, by - 2, 5, 2, LC.hand); blob(P, cx + 7, by - 2, 5, 2, LC.hand);
  // body: small round belly, white shirt front, red tie
  blob(U, cx, by - 21, 12, 12, C.lemur);
  for (let y = -10; y <= 10; y++) { const w = Math.round(5 * Math.sqrt(Math.max(0, 1 - (y / 12) ** 2))); U.rect(cx - w, by - 21 + y, w * 2 + 1, 1, C.white[y < -6 ? 2 : 1]); }
  U.rect(cx - 5, by - 32, 11, 2, C.white[2]);
  U.rect(cx - 1, by - 31, 3, 2, C.tie[0]); U.rect(cx - 1, by - 29, 3, 9, C.tie[1]); U.rect(cx - 1, by - 29, 1, 8, C.tie[2]); U.set(cx, by - 20, C.tie[1]);
  // stubby arms, soft dark hands: raised arms go behind the head, a hand on the chin in front of it
  const sh = [[cx - 10, by - 29], [cx + 10, by - 29]];
  const HANDS = { down: s => [s * 14, by - 15], out: s => [s * 22, by - 30], up: s => [s * 27, by - 54], chin: s => [s * 4, by - 37], head: s => [s * 22, by - 64], hip: s => [s * 12, by - 21] };
  const arms = { explaining: ['down', 'out'], pointing: ['up', 'down'], thinking: ['down', 'chin'], concerned: ['chin', 'down'], surprised: ['up', 'up'],
                 smug: ['hip', 'hip'], sneaky: ['chin', 'down'], neutral: ['down', 'down'] }[pose] || ['down', 'out'];
  const drawArms = front => [-1, 1].forEach((s, k) => { if ((arms[k] === 'chin') !== front) return; const [hx_, hy_] = HANDS[arms[k]](s); const x1 = cx + hx_;
    limb(U, sh[k][0], sh[k][1], x1, hy_, 3, C.lemur); blob(U, x1, hy_, 3, 3, LC.hand);
    if (arms[k] === 'up' && pose === 'pointing') U.rect(x1 - 1, hy_ - 6, 2, 4, LC.hand[1]); });
  drawArms(false);
  // head
  const hx = cx, hy = by - 50;
  for (const s of [-1, 1]) { const ex = hx + s * 15, ey = hy - 15 - (s > 0 ? ear : 0); blob(U, ex, ey, 6, 7, C.lemur); blob(U, ex + s, ey + 1, 3, 4, C.white); }
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) blob(U, hx + s * (20 + (k === 1 ? 2 : 0)), hy + 3 + k * 4, 3, 2, C.white);   // cheek fluff
  blob(U, hx, hy, 21, 18, C.lemur);
  blob(U, hx, hy + 6, 17, 11, C.white);                                      // soft white face
  U.rect(hx - 1, hy - 14, 3, 6, C.white[2]);                                  // short blaze
  const look = pose === 'thinking' ? [1, -1] : pose === 'sneaky' ? [-1, 0] : [0, 0];
  for (const s of [-1, 1]) {
    const ex = hx + s * 9, ey = hy + 3;
    blob(U, ex + s, ey, 6, 6, LC.ring);                                       // lemur eye ring, soft grey
    cuteEye(U, ex, ey, pose, blink, look);
  }
  // monocle on his left eye (viewer's right): thin gold ring, glass glint, chain to the shirt
  const mx = hx + 9, my_ = hy + 3;
  for (let a = 0; a < 64; a++) { const t = a / 64 * Math.PI * 2; U.set(mx + Math.round(Math.cos(t) * 7), my_ + Math.round(Math.sin(t) * 7), a < 32 ? C.gold[1] : C.gold[2]); }
  U.set(mx + 3, my_ - 5, LC.glass); U.set(mx + 4, my_ - 4, LC.glass); U.set(mx + 5, my_ - 3, LC.glass);
  for (let i = 0; i < 14; i++) U.set(mx + 6 - (i >> 2), my_ + 7 + i, i % 2 ? C.gold[0] : C.gold[1]);
  // tiny nose, pink cheeks, mouth
  U.rect(hx - 2, hy + 9, 5, 1, LC.dark); U.rect(hx - 1, hy + 10, 3, 1, LC.dark); U.set(hx - 1, hy + 9, hex('#5a5564'));
  blob(U, hx - 14, hy + 10, 2, 1, [C.blush, C.blush, C.blush]); blob(U, hx + 14, hy + 10, 2, 1, [C.blush, C.blush, C.blush]);
  const my = hy + 13;
  if (mouth > 0) { const w = [0, 3, 5, 5][mouth], h = mouth + (mouth > 1 ? 1 : 0); U.rect(hx - (w >> 1), my - 1, w, h, C.mouth); if (mouth === 3) U.rect(hx - 1, my + 1, 3, 1, C.tongue); U.set(hx - (w >> 1), my - 1, C.white[1]); U.set(hx + (w >> 1), my - 1, C.white[1]); U.set(hx, my - 2, LC.dark); }
  else if (pose === 'surprised') { U.rect(hx - 1, my - 1, 3, 3, C.mouth); U.set(hx - 1, my - 1, C.white[1]); U.set(hx + 1, my - 1, C.white[1]); }
  else if (pose === 'smug' || pose === 'sneaky') { U.set(hx, my - 1, LC.dark); U.rect(hx - 2, my, 2, 1, LC.dark); U.rect(hx + 1, my, 3, 1, LC.dark); U.set(hx + 4, my - 1, LC.dark); }
  else if (pose === 'concerned') { U.set(hx, my - 1, LC.dark); U.rect(hx - 2, my, 5, 1, LC.dark); U.set(hx - 3, my + 1, LC.dark); U.set(hx + 3, my + 1, LC.dark); }
  else { U.set(hx, my - 1, LC.dark); U.set(hx - 1, my, LC.dark); U.set(hx - 2, my, LC.dark); U.set(hx + 1, my, LC.dark); U.set(hx + 2, my, LC.dark); U.set(hx - 3, my - 1, LC.dark); U.set(hx + 3, my - 1, LC.dark); }   // "w" smile
  drawArms(true);
  P.stamp(U, 0, -breath);
  P.outline(hex('#2a2530')); return P;
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
