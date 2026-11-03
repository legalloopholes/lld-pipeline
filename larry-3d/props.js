// Props for Legal Loopholes Daily. Nothing floats: maps sit on a standing sign board, the Constitution on a
// lectern, the gavel on a pedestal, the tumbleweed rolls on the floor. Each maker returns
// { root, pop(k) } where pop(k) (k: 0→1) animates the prop rising/landing into place, plus optional anim(t).
import * as THREE from 'three';
import { box, group, mat } from './cast.js';

// ---------- canvas helpers ----------
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
// draw polygons at low resolution, then blow up with no smoothing → blocky pixel-art map
function pixelLayer(g, W, H, res, paint) {
  const s = document.createElement('canvas'); s.width = res; s.height = Math.round(res * H / W);
  const sg = s.getContext('2d'); paint(sg, s.width, s.height);
  g.imageSmoothingEnabled = false; g.drawImage(s, 0, 0, W, H);
}
function label(g, text, x, y, size, color = '#1d2433', outline = '#ffffff') {
  g.font = `900 ${size}px "Arial Black", Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = size * 0.22; g.strokeStyle = outline; g.lineJoin = 'round'; g.strokeText(text, x, y);
  g.fillStyle = color; g.fillText(text, x, y);
}
function poly(g, pts, toXY, fill) { g.beginPath(); pts.forEach((p, i) => { const [x, y] = toXY(p); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); g.fillStyle = fill; g.fill(); }

// ---------- map faces ----------
// Contiguous U.S. outline, simplified (lon, lat). Stylized — good for a blocky map, not for navigation.
const US = [[-124.7,48.4],[-123,49],[-95.2,49],[-94.8,49.4],[-89.6,48],[-84.8,46.5],[-82.4,45.3],[-82.5,43],[-79,43.3],[-76.5,44.2],
  [-75,45],[-71.5,45],[-70,47.3],[-67.8,47.1],[-67,44.8],[-70.6,43],[-70.6,41.7],[-73.9,40.6],[-74.9,38.9],[-75.9,37],
  [-75.5,35.3],[-77.9,33.8],[-80.9,32],[-81.4,30.4],[-80,26.8],[-80.4,25.2],[-81.8,26.1],[-82.8,27.9],[-84.3,30],
  [-86.5,30.4],[-89.6,30.2],[-89.4,29.1],[-91.2,29.3],[-93.8,29.7],[-95.3,28.9],[-97.4,27.4],[-97.2,25.9],[-99.1,26.4],
  [-100.6,28.9],[-101.4,29.8],[-103,29],[-104.5,29.6],[-106.5,31.8],[-108.2,31.8],[-111,31.3],[-114.8,32.5],[-117.1,32.5],
  [-118.5,34],[-120.6,34.6],[-122.4,37.2],[-123.8,39.5],[-124.2,42],[-124,46.2],[-124.7,48.4]];
function usMapTex() {
  return canvasTex(1024, 640, (g, W, H) => {
    g.fillStyle = '#9fd6f2'; g.fillRect(0, 0, W, H);
    const toXY = ([lo, la]) => [((lo + 126) / 60) * W, ((50.5 - la) / 27) * H];
    pixelLayer(g, W, H, 96, (sg, w, h) => {
      const k = w / W; poly(sg, US, p => toXY(p).map(v => v * k), '#f2e3b3');
      const [yx, yy] = toXY([-110.6, 44.6]).map(v => v * k);
      sg.fillStyle = '#d93a32'; sg.fillRect(Math.round(yx) - 2, Math.round(yy) - 2, 4, 4);   // Yellowstone marker
    });
    const [yx, yy] = toXY([-110.6, 44.6]);
    label(g, 'YELLOWSTONE', yx + 60, yy - 70, 68, '#d93a32');
    label(g, 'UNITED STATES', W * 0.56, H * 0.55, 92);
  });
}
// Zoomed Yellowstone corner (lon −111.7…−109.5, lat 43.9…45.3). Borders simplified:
// WY west edge ≈ −111.05, WY north edge = 45°N, ID/MT line drawn roughly along the divide west of WY.
function yellowstoneTex(highlightIdaho) {
  return canvasTex(1024, 768, (g, W, H) => {
    const toXY = ([lo, la]) => [((lo + 111.75) / 1.95) * W, ((45.3 - la) / 1.3) * H];
    pixelLayer(g, W, H, 80, (sg, w, h) => {
      const k = w / W, P = (pts, c) => poly(sg, pts, p => toXY(p).map(v => v * k), c);
      P([[-112, 46], [-109, 46], [-109, 45], [-111.05, 45], [-111.05, 44.55], [-112, 44.6]], '#c9e3a6');          // Montana
      P([[-112, 44.6], [-111.05, 44.55], [-111.05, 43], [-112, 43]], '#f2c48d');                                 // Idaho
      P([[-111.05, 45], [-109, 45], [-109, 43], [-111.05, 43]], '#f3e7b8');                                       // Wyoming
      P([[-111.15, 45.11], [-110.0, 45.11], [-110.0, 44.13], [-111.15, 44.13]], '#5fae5a');                       // park (approx.)
      if (highlightIdaho) P([[-111.15, 44.55], [-111.05, 44.55], [-111.05, 44.13], [-111.15, 44.13]], '#e0342c'); // Idaho sliver
    });
    g.strokeStyle = '#1d2433'; g.lineWidth = 6; g.setLineDash([18, 12]);
    for (const seg of [[[-111.05, 45.3], [-111.05, 43.9]], [[-111.05, 45], [-109.5, 45]], [[-111.7, 44.6], [-111.05, 44.55]]]) {
      g.beginPath(); g.moveTo(...toXY(seg[0])); g.lineTo(...toXY(seg[1])); g.stroke();
    }
    g.setLineDash([]);
    label(g, 'MONTANA', W * 0.66, H * 0.07, 66); label(g, 'IDAHO', W * 0.14, H * 0.9, 66);
    label(g, 'WYOMING', W * 0.72, H * 0.93, 66); label(g, 'YELLOWSTONE', W * 0.62, H * 0.45, 64, '#ffffff', '#2d6a2a');
    if (highlightIdaho) { const [x, y] = toXY([-111.1, 44.33]); label(g, 'ZONE', x - 110, y - 40, 60, '#e0342c'); label(g, 'OF DEATH →', x - 150, y + 26, 52, '#e0342c'); }
  });
}

// ---------- stand-up sign board: rises out of the ground on two legs ----------
function signBoard(parent, tex, w = 2.6, h = 1.8) {
  const root = group(0, 0, 0, parent), body = group(0, 0, 0, root);
  for (const s of [-1, 1]) { box(0.14, 1.3, 0.14, '#7a4f2c', s * w * 0.36, 0.65, 0, body); box(0.4, 0.08, 0.4, '#5a3a20', s * w * 0.36, 0.04, 0, body); }
  box(w + 0.2, h + 0.2, 0.12, '#2b3a67', 0, 1.3 + h / 2, -0.02, body);                    // navy frame
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  face.position.set(0, 1.3 + h / 2, 0.045); body.add(face);
  return { root, face, pop(k) { const e = easeBack(k); body.scale.set(1, Math.max(0.001, e), 1); } };
}
const easeBack = k => { k = Math.min(1, Math.max(0, k)); const c = 1.7; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };

export function mapUS(parent) { return signBoard(parent, usMapTex(), 2.5, 1.56); }
export function mapYellowstone(parent) { return signBoard(parent, yellowstoneTex(false), 2.4, 1.8); }
export function mapZone(parent) {
  const s = signBoard(parent, yellowstoneTex(true), 2.4, 1.8);
  return s;
}

// ---------- Constitution scroll on a lectern ----------
function fitText(g, text, x, y, maxW, size, weight, family) {
  let s_ = size; do { g.font = `${weight} ${s_}px ${family}`; s_ -= 2; } while (g.measureText(text).width > maxW && s_ > 14);
  g.fillText(text, x, y);
}
function parchmentTex(title = 'CONSTITUTION', heading = 'We the People') {
  return canvasTex(512, 640, (g, W, H) => {
    g.fillStyle = '#f1dfb0'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#e4cc92'; for (let i = 0; i < 40; i++) g.fillRect((i * 97) % W, (i * 53) % H, 18, 18);
    g.fillStyle = '#3a2a1a'; g.font = 'italic 900 64px Georgia, serif'; g.textAlign = 'center'; fitText(g, heading, W / 2, 110, W - 70, 64, 'italic 900', 'Georgia, serif');
    g.fillRect(60, 150, W - 120, 6);
    for (let r = 0; r < 9; r++) g.fillRect(60, 200 + r * 36, (W - 120) * (r % 3 === 2 ? 0.7 : 1), 10);
    g.fillStyle = '#7a1f1a'; fitText(g, title, W / 2, H - 105, W - 70, 44, '900', 'Georgia, serif');
  });
}
export function constitution(parent, title, heading) {
  const root = group(0, 0, 0, parent), body = group(0, 0, 0, root);
  box(0.5, 1.2, 0.5, '#7a4f2c', 0, 0.6, -0.2, body); box(0.9, 0.1, 0.9, '#5a3a20', 0, 0.05, 0, body);   // lectern post + foot
  const top = group(0, 1.55, 0.25, body); top.rotation.x = -0.35;
  box(1.3, 0.1, 0.9, '#8a5a34', 0, 0, 0, top);
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.15), new THREE.MeshBasicMaterial({ map: parchmentTex(title, heading), toneMapped: false }));
  sheet.rotation.x = -Math.PI / 2 + 0.0; sheet.position.set(0, 0.06, 0.02); top.add(sheet);
  for (const z of [-0.6, 0.6]) box(1.05, 0.14, 0.14, '#e4cc92', 0, 0.1, z * 0.95, top);                // rolled ends
  // stand the sheet up so the camera can read it: tilt lectern top toward camera
  top.rotation.x = 1.05; root.scale.setScalar(1.45);
  return { root, pop(k) { body.scale.set(1, Math.max(0.001, easeBack(k)), 1); } };
}

// ---------- gavel resting on a sound block on a pedestal ----------
export function gavel(parent) {
  const root = group(0, 0, 0, parent), body = group(0, 0, 0, root);
  box(0.7, 1.2, 0.7, '#efe6d6', 0, 0.6, 0, body); box(0.9, 0.12, 0.9, '#d9cdb5', 0, 1.26, 0, body);   // pedestal
  box(0.6, 0.14, 0.6, '#5a3a20', 0, 1.39, 0, body);                                                   // sound block
  const g = group(0, 1.46, 0, body);
  const head = box(0.26, 0.26, 0.6, '#7a4f2c', 0, 0.13, 0, g); head.rotation.y = 0.5;
  box(0.28, 0.28, 0.06, '#d9a93b', 0, 0.13, 0.2, head).position.set(0, 0, 0.27);
  box(0.28, 0.28, 0.06, '#d9a93b', 0, 0, -0.27, head);
  const handle = box(0.09, 0.09, 1.0, '#8a5a34', 0.25, 0.07, 0.35, g); handle.rotation.y = -1.0;
  root.scale.setScalar(1.5);
  return { root, gavelHead: g, pop(k) { body.scale.set(1, Math.max(0.001, easeBack(k)), 1); },
    // knock: lift and strike once, k 0→1
    knock(k) { g.position.y = 1.46 + Math.max(0, Math.sin(Math.min(1, k) * Math.PI)) * 0.35; } };
}

// ---------- tumbleweed: rolls along the floor from right to left ----------
export function tumbleweed(parent) {
  const root = group(0, 0, 0, parent), ball = group(0, 0.42, 0, root);
  const C = ['#a8834f', '#8f6c3c', '#c19a62'];
  for (let i = 0; i < 26; i++) {
    const b = box(0.85, 0.06, 0.06, C[i % 3], 0, 0, 0, ball);
    b.rotation.set(i * 1.13, i * 0.71, i * 0.37); b.castShadow = true;
  }
  root.scale.setScalar(1.3);
  return { root, ball,
    // roll(k): k 0→1 crosses from x0 to x1, spinning as it goes, always touching the floor
    roll(k, x0 = 4.5, x1 = -4.5) { const x = x0 + (x1 - x0) * k; root.position.x = x; ball.rotation.z = -(x - x0) / 0.42;
      ball.position.y = 0.42; } };
}

export const PROPS = { 'map:us': mapUS, 'map:yellowstone': mapYellowstone, 'map:zone': mapZone, constitution, gavel, tumbleweed };

// ---------- fallback: any prop we haven't built yet shows as a word sign on the same stand ----------
export function textSign(parent, text) {
  const tex = canvasTex(1024, 640, (g, W, H) => {
    g.fillStyle = '#fff8e7'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#d93a32'; g.fillRect(0, H - 40, W, 40);
    const words = text.toUpperCase().split(/\s+/); let lines = [text.toUpperCase()];
    if (words.length > 2) { const h = Math.ceil(words.length / 2); lines = [words.slice(0, h).join(' '), words.slice(h).join(' ')]; }
    const size = Math.min(150, Math.floor(1700 / Math.max(...lines.map(l => l.length))));
    lines.forEach((l, i) => label(g, l, W / 2, H / 2 - 20 + (i - (lines.length - 1) / 2) * size * 1.1, size, '#1d2433', '#fff8e7'));
  });
  return signBoard(parent, tex, 2.4, 1.5);
}
// plan ids (scenes/<ID>.json) → 3D props
export const PROP_ALIASES = { 'map-us': 'map:us', 'map-yellowstone': 'map:yellowstone', 'map-zone': 'map:zone',
  'prop-constitution': 'constitution', 'prop-gavel': 'gavel', 'prop-tumbleweed': 'tumbleweed' };

// ---------- generic document on the lectern: {"id":"doc","text":"SECTION 120","sub":"German Criminal Code"} ----------
export function doc(parent, text, sub) { return constitution(parent, (sub || '').toUpperCase(), text); }

// ---------- generic picture sign on the stand: {"id":"sign","icon":"🐝","text":"FISH?"} ----------
const EMOJI = '"Apple Color Emoji","Noto Color Emoji","Segoe UI Emoji",sans-serif';
export function iconSign(parent, icon, text) {
  const tex = canvasTex(1024, 640, (g, W, H) => {
    g.fillStyle = '#fff8e7'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#d93a32'; g.fillRect(0, H - 34, W, 34);
    const hasText = !!(text && text.trim());
    if (icon) {
      g.textAlign = 'center'; g.textBaseline = 'middle';
      let sz = hasText ? 300 : 420; g.font = `${sz}px ${EMOJI}`;
      while (g.measureText(icon).width > W - 80 && sz > 80) { sz -= 10; g.font = `${sz}px ${EMOJI}`; }
      g.fillText(icon, W / 2, hasText ? H * 0.38 : H * 0.48);
    }
    if (hasText) {
      const T = text.toUpperCase(); let size = icon ? 104 : 150;
      g.font = `900 ${size}px "Arial Black", Arial, sans-serif`;
      while (g.measureText(T).width > W - 70 && size > 36) { size -= 4; g.font = `900 ${size}px "Arial Black", Arial, sans-serif`; }
      label(g, T, W / 2, icon ? H * 0.8 : H * 0.48, size, '#1d2433', '#fff8e7');
    }
  });
  return signBoard(parent, tex, 2.2, 1.375);
}
