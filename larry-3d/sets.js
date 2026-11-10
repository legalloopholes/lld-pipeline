// Sets for Legal Loopholes Daily: blocky dioramas that sit on the white world.
// Each maker returns { root, anim(t) } — anim handles small looping details (fire flicker, steam).
// Stage convention: characters stand around x in [-3, 3], z = 0; sets live behind/around them.
import { box, group, mat } from './cast.js';

const G = { grass: '#7fb069', grassDark: '#5e8f4c', dirt: '#c9a273', rock: '#9a958c', rockDark: '#76716a',
  pine: '#2f6b3f', pineDark: '#234f2f', trunk: '#7a4f2c', water: '#5aa9d6', marble: '#eeeae2', marbleDark: '#d6d0c4',
  wood: '#b9814f', woodDark: '#7a4f2c', navy: '#2b3a67', red: '#b8312f' };

function pine(parent, x, z, s = 1) {
  const g = group(x, 0, z, parent);
  box(0.3 * s, 0.9 * s, 0.3 * s, G.trunk, 0, 0.45 * s, 0, g);
  box(1.6 * s, 1.0 * s, 1.6 * s, G.pine, 0, 1.3 * s, 0, g);
  box(1.2 * s, 0.9 * s, 1.2 * s, G.pineDark, 0, 2.1 * s, 0, g);
  box(0.7 * s, 0.8 * s, 0.7 * s, G.pine, 0, 2.8 * s, 0, g);
  return g;
}
function rock(parent, x, z, s = 1, c = G.rock) { const r = box(0.9 * s, 0.55 * s, 0.7 * s, c, x, 0.27 * s, z, parent); r.rotation.y = x * 0.7; return r; }

// ---------- campsite: grass patch, log bench, campfire, pines ----------
export function campsite(scene) {
  const root = group(0, 0, 0, scene);
  box(9, 0.08, 6, G.grass, 0, 0.04, -0.5, root);
  box(3.8, 0.09, 2.8, G.dirt, 0.2, 0.05, 0.6, root);                         // trampled dirt around the fire
  const log = group(0.95, 0, 0.2, root); log.rotation.y = -0.9;                                       // log the chimp sits on
  box(1.9, 0.276, 0.55, '#8a5a34', 0, 0.138, 0, log);                     // seat top at 0.276 = chimp's sitting height
  box(0.06, 0.22, 0.45, '#d9b48a', -0.97, 0.138, 0, log); box(0.06, 0.22, 0.45, '#d9b48a', 0.97, 0.138, 0, log);
  const fire = group(-0.45, 0, 1.25, root);
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; rock(fire, Math.cos(a) * 0.55, Math.sin(a) * 0.55, 0.4, G.rockDark); }
  box(0.9, 0.15, 0.18, G.woodDark, 0, 0.12, 0, fire).rotation.y = 0.6;
  box(0.9, 0.15, 0.18, G.woodDark, 0, 0.12, 0, fire).rotation.y = -0.6;
  const flames = [box(0.42, 0.6, 0.42, '#f28c28', 0, 0.45, 0, fire), box(0.26, 0.5, 0.26, '#ffd23f', 0, 0.55, 0.04, fire),
                  box(0.18, 0.32, 0.18, '#e63b2e', 0.16, 0.36, -0.1, fire)];
  flames.forEach(f => { f.material = f.material.clone(); f.material.emissive = f.material.color.clone(); f.material.emissiveIntensity = 0.6; f.castShadow = false; });
  for (const [x, z, s] of [[-2.6, -2.6, 1.3], [-1.2, -3.6, 1.6], [2.8, -2.8, 1.4], [1.4, -3.8, 1.2], [-3.0, -0.8, 1.0], [3.2, -1.2, 1.1]]) pine(root, x, z, s);
  return { root, spots: { log: [0.95, 0.276, 0.2, -0.9], fire: [-0.45, 0, 1.25] },
    anim(t) { flames.forEach((f, i) => { const k = 1 + 0.18 * Math.sin(t * (9 + i * 3) + i); f.scale.set(1 / Math.sqrt(k), k, 1 / Math.sqrt(k)); }); } };
}

// ---------- Yellowstone: rocky ground, steaming geyser, blue hot spring, pines ----------
export function yellowstone(scene) {
  const root = group(0, 0, 0, scene);
  box(10, 0.08, 6, '#c09a62', 0, 0.04, -0.5, root);                            // ochre geyser basin (no pale/white floors)
  const spring = group(-1.5, 0, -1.6, root);
  box(2.2, 0.06, 1.6, '#e8b04a', 0, 0.08, 0, spring);                          // orange rim
  box(1.7, 0.07, 1.2, G.water, 0, 0.1, 0, spring);
  box(0.9, 0.08, 0.6, '#2f7fb8', 0, 0.12, 0, spring);
  const geyser = group(1.7, 0, -2.6, root);
  box(1.2, 0.4, 1.2, '#a8916c', 0, 0.2, 0, geyser);
  const steam = [];
  for (let i = 0; i < 6; i++) { const s = box(0.5, 0.5, 0.5, '#ffffff', 0, 0.6 + i * 0.55, 0, geyser); s.material = mat('#dfe8ee').clone(); s.material.transparent = true; s.castShadow = false; steam.push(s); }
  for (const [x, z, s] of [[-3.0, -3.2, 1.4], [3.2, -3.4, 1.2], [-1.6, -4.0, 1.1], [0.2, -4.2, 1.0]]) pine(root, x, z, s);
  rock(root, 2.4, -0.6, 0.7); rock(root, -2.6, -0.4, 0.8);
  return { root, spots: {},
    anim(t) { steam.forEach((s, i) => { const k = ((t * 0.6 + i / steam.length) % 1); s.position.y = 0.6 + k * 3.4; s.scale.setScalar(0.6 + k * 1.6); s.material.opacity = 0.85 * (1 - k); s.position.x = Math.sin(k * 3 + i) * 0.25; }); } };
}

// ---------- U.S. Capitol: white steps, columns and a stacked dome behind the cast ----------
export function capitol(scene) {
  const root = group(0, 0, -5.5, scene); root.scale.setScalar(0.82);
  box(10, 0.08, 9, '#e9e6df', 0, 0.04, 2.5, root);                              // plaza
  for (let i = 0; i < 4; i++) box(5.4 - i * 0.3, 0.25, 0.6, G.marbleDark, 0, 0.12 + i * 0.25, 1.2 - i * 0.5, root);   // steps
  box(9, 2.6, 1.6, G.marble, 0, 1.3, -1.0, root);                              // main building
  for (let i = -4; i <= 4; i++) if (i !== 0) box(0.22, 2.2, 0.22, '#ffffff', i * 0.95, 1.1, -0.1, root);       // columns
  box(3.2, 0.5, 1.8, G.marbleDark, 0, 2.85, -1.0, root);
  box(2.4, 1.2, 1.8, G.marble, 0, 3.6, -1.0, root);                             // drum
  for (let i = -3; i <= 3; i++) box(0.12, 1.0, 0.12, '#ffffff', i * 0.33, 3.6, -0.08, root);
  box(1.9, 0.7, 1.5, G.marble, 0, 4.55, -1.0, root);                            // dome steps
  box(1.3, 0.6, 1.1, G.marble, 0, 5.15, -1.0, root);
  box(0.6, 0.5, 0.6, G.marble, 0, 5.7, -1.0, root);
  box(0.16, 0.5, 0.16, '#3b4c63', 0, 6.2, -1.0, root);                          // statue
  return { root, spots: {}, anim() {} };
}

// ---------- federal courtroom: judge's bench, empty jury box, flags, wood floor ----------
export function courtroom(scene) {
  const root = group(0, 0, 0, scene);
  box(10, 0.08, 7, '#c79a66', 0, 0.04, -1.0, root);                              // wood floor
  for (let i = -4; i <= 4; i++) box(0.04, 0.081, 7, '#b78a58', i * 1.1, 0.045, -1.0, root);
  box(10, 14, 0.2, '#efe6d6', 0, 7, -4.4, root);                             // back wall
  box(10, 1.2, 0.24, G.woodDark, 0, 0.6, -4.3, root);                            // wainscot
  const bench = group(1.5, 0, -2.6, root);                                       // judge stands behind this
  box(3.4, 0.35, 1.4, G.woodDark, 1.5, 0.175, -3.3, root);                          // dais the judge stands on (keeps him grounded)
  box(3.0, 1.55, 1.0, G.wood, 0, 0.78, 0, bench);
  box(3.2, 0.12, 1.2, G.woodDark, 0, 1.6, 0, bench);
  box(0.9, 0.5, 0.06, '#d9a93b', 0, 0.95, 0.51, bench);                          // seal plaque
  const jury = group(-2.3, 0, -2.9, root); jury.rotation.y = 0.35;                                       // empty jury box (for "population: zero")
  box(2.4, 0.9, 0.12, G.wood, 0, 0.45, 0.8, jury);
  box(0.12, 0.9, 1.6, G.wood, -1.2, 0.45, 0, jury); box(0.12, 0.9, 1.6, G.wood, 1.2, 0.45, 0, jury);
  for (const z of [0.2, -0.5]) { box(2.2, 0.12, 0.45, G.woodDark, 0, 0.55, z, jury); box(2.2, 0.45, 0.08, G.woodDark, 0, 0.8, z - 0.2, jury); }
  for (const [x, c] of [[3.0, 'us'], [-0.1, 'state']]) {                          // flags on poles
    const f = group(x, 0, -3.8, root);
    box(0.08, 3.4, 0.08, '#d9a93b', 0, 1.7, 0, f);
    if (c === 'us') { for (let i = 0; i < 5; i++) box(0.9, 0.12, 0.03, i % 2 ? '#ffffff' : G.red, 0.5, 3.1 - i * 0.12, 0, f); box(0.38, 0.3, 0.035, G.navy, 0.24, 3.0, 0.01, f); }
    else box(0.9, 0.6, 0.03, '#2f5fa8', 0.5, 2.85, 0, f);
  }
  return { root, spots: { judge: [1.5, 0.35, -3.3], jury: [-2.3, 0, -2.9] }, anim() {} };
}

// ---------- white studio: nothing but the white world (props pop in above the cast) ----------
export function studio(scene) { const root = group(0, 0, 0, scene); return { root, spots: {}, anim() {} }; }

export const SETS = { campsite, yellowstone, capitol, courtroom, studio, prison, shop, office, street, neighborhood, harbor };

// ---------- environments: every set gets a colored sky/backdrop + ground to the horizon (no white world) ----------
import * as THREE from 'three';
function gradient(top, bottom) {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256;
  const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, top); gr.addColorStop(1, bottom); g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function ground(root, color, z = -20) { const m = box(140, 0.06, 140, color, 0, 0.0, z, root); m.castShadow = false; return m; }
function cloud(root, x, y, z, s = 1) {           // blocky clouds sit far back in the sky; static
  const g = group(x, y, z, root);
  for (const [dx, dy, w, h] of [[0, 0, 3.2, 1.0], [-1.1, 0.5, 1.6, 1.0], [0.6, 0.7, 1.8, 1.2], [1.7, 0.2, 1.4, 0.8]]) {
    const b = box(w * s, h * s, 1.2 * s, '#ffffff', dx * s, dy * s, 0, g); b.castShadow = false; b.receiveShadow = false;
  }
  return g;
}
function hills(root, z, color, spec) { for (const [x, w, h] of spec) { const b = box(w, h, 6, color, x, h / 2, z, root); b.castShadow = false; } }
function mountain(root, x, z, s, color, snow) {
  const g = group(x, 0, z, root);
  [[7, 1.2], [5.8, 1.2], [4.6, 1.2], [3.4, 1.1], [2.2, 1.0], [1.1, 0.8]].forEach(([w, h], i, a) => {
    const y = a.slice(0, i).reduce((acc, v) => acc + v[1], 0);
    const b = box(w * s, h * s, w * s * 0.8, i >= a.length - 2 ? snow : color, 0, (y + h / 2) * s, 0, g); b.castShadow = false;
  });
}

export const ENV = {
  campsite(root) {
    ground(root, '#7fb069');
    hills(root, -26, '#5f9a57', [[-16, 14, 5], [-2, 12, 3.5], [12, 16, 6]]);
    hills(root, -34, '#8fbf7f', [[-6, 20, 8], [16, 18, 9.5]]);
    for (let i = -6; i <= 6; i++) pine(root, i * 2.6 + (i % 2) * 0.8, -15 - (i % 3) * 1.5, 1.6);
    cloud(root, -6, 14, -30, 1.4); cloud(root, 7, 17, -32, 1.2);
    return { sky: ['#4fb3ea', '#c9eefc'], fog: '#c9eefc' };
  },
  yellowstone(root) {
    ground(root, '#7f9f55');                                                     // meadow around the basin
    mountain(root, -12, -34, 1.1, '#6f89a8', '#f4f7fa'); mountain(root, 3, -38, 1.4, '#5f7b9c', '#f4f7fa'); mountain(root, 17, -34, 1.0, '#7891ad', '#f4f7fa');
    hills(root, -22, '#2f6b3f', [[-14, 16, 2.5], [4, 22, 3], [20, 14, 2.2]]);
    for (let i = -5; i <= 5; i++) pine(root, i * 3 + (i % 2), -14 - (i % 2) * 2, 1.5);
    cloud(root, -4, 18, -34, 1.3);
    return { sky: ['#3f9fdc', '#9fd3f0'], fog: '#9fd3f0' };
  },
  capitol(root) {
    ground(root, '#86bf6a');
    box(2.4, 0.07, 30, '#d8cfbd', 0, 0.035, 12, root).castShadow = false;           // walkway up to the steps
    for (const x of [-4.2, 4.2]) for (const z of [-2, -6, -10]) pine(root, x * (1 + (-z) * 0.04), z - 2, 1.2);
    cloud(root, -7, 15, -32, 1.3); cloud(root, 8, 18, -36, 1.5);
    return { sky: ['#5fb7ee', '#dff3ff'], fog: '#dff3ff' };
  },
  courtroom(root) {
    ground(root, '#b98c5a', -10);
    for (const s of [-1, 1]) { const w = box(0.3, 14, 40, '#efe6d6', s * 7.5, 7, 10, root); w.castShadow = false; }   // side walls
    box(30, 14, 0.3, '#efe6d6', 0, 7, -4.6, root).castShadow = false;                 // wide back wall
    box(30, 1.2, 0.34, '#7a4f2c', 0, 0.6, -4.5, root).castShadow = false;
    for (const x of [-2.9, 4.6]) {                                                    // tall windows with daylight
      box(1.6, 3.0, 0.08, '#8fd0f2', x, 3.0, -4.24, root); box(1.8, 0.14, 0.12, '#7a4f2c', x, 4.55, -4.2, root);
      box(1.8, 0.14, 0.12, '#7a4f2c', x, 1.45, -4.2, root); box(0.1, 3.0, 0.1, '#7a4f2c', x, 3.0, -4.18, root);
    }
    box(1.6, 1.6, 0.1, '#d9a93b', 1.5, 5.4, -4.25, root);                               // big seal above the bench
    box(1.2, 1.2, 0.12, '#2b3a67', 1.5, 5.4, -4.18, root);
    return { sky: ['#6a4428', '#a8784a'], fog: null };
  },
  studio(root) {
    ground(root, '#ffd166');
    const cyc = box(60, 30, 0.4, '#4fb3e8', 0, 15, -12, root); cyc.castShadow = false;  // colored backdrop wall
    for (let i = -10; i <= 10; i++) { const b = box(1.4, 30, 0.1, '#3d9fd6', i * 2.8, 15, -11.75, root); b.castShadow = false; }   // painted stripes on the wall
    box(60, 0.5, 0.2, '#ffffff', 0, 0.25, -11.7, root).castShadow = false;                                                         // baseboard
    return { sky: ['#3aa6e0', '#7fcbf0'], fog: null };
  },
};
export function buildEnv(name, setRoot) { const e = ENV[name](setRoot); e.bg = gradient(e.sky[0], e.sky[1]); return e; }
export function useEnv(scene, e) { scene.background = e.bg; scene.fog = e.fog ? new THREE.Fog(e.fog, 30, 75) : null; }

// ======================= more sets (Nov 2026 batch) =======================
function wall(root, color, z = -4.4, h = 14) { const w = box(40, h, 0.3, color, 0, h / 2, z, root); w.castShadow = false; return w; }
function sideWalls(root, color) { for (const s of [-1, 1]) { const w = box(0.3, 14, 40, color, s * 7.5, 7, 10, root); w.castShadow = false; } }
export function car(parent, x, z, color = '#d64545', ry = 0) {
  const g = group(x, 0, z, parent); g.rotation.y = ry;
  box(2.6, 0.55, 1.2, color, 0, 0.55, 0, g); box(1.5, 0.5, 1.1, color, -0.1, 1.07, 0, g);
  box(1.3, 0.38, 1.12, '#bfe3f5', -0.1, 1.08, 0, g);                                   // windows
  for (const [wx_, wz] of [[-0.85, 0.6], [0.85, 0.6], [-0.85, -0.6], [0.85, -0.6]]) box(0.5, 0.5, 0.2, '#1d1c21', wx_, 0.25, wz, g);
  box(0.1, 0.16, 0.3, '#fff3b0', 1.31, 0.62, 0.35, g); box(0.1, 0.16, 0.3, '#fff3b0', 1.31, 0.62, -0.35, g);
  return g;
}
function house(parent, x, z, wallC, roofC, s = 1) {
  const g = group(x, 0, z, parent); g.scale.setScalar(s);
  box(3, 2.2, 2.4, wallC, 0, 1.1, 0, g);
  [[3.4, 0.4], [2.6, 0.4], [1.8, 0.4], [1.0, 0.4]].forEach(([w, h], i) => box(w, h, 2.7, roofC, 0, 2.4 + i * 0.4, 0, g));
  box(0.6, 1.1, 0.06, '#7a4f2c', 0.6, 0.55, 1.21, g); box(0.7, 0.6, 0.06, '#bfe3f5', -0.7, 1.3, 1.21, g);
  return g;
}

export function prison(scene) {
  const root = group(0, 0, 0, scene);
  wall(root, '#c3c8cf'); sideWalls(root, '#c3c8cf');
  box(40, 1.0, 0.34, '#8d949c', 0, 0.5, -4.25, root).castShadow = false;                 // dark band along the base
  const cell = group(-1.9, 0, -2.0, root);                                                 // cell front with bars
  box(3.6, 0.25, 0.3, '#5b636b', 0, 3.6, 0, cell); box(3.6, 0.2, 0.3, '#5b636b', 0, 0.1, 0, cell);
  for (let i = 0; i < 10; i++) box(0.09, 3.5, 0.09, '#4a5159', -1.65 + i * 0.367, 1.8, 0, cell);
  box(1.8, 0.35, 0.9, '#7c8a99', -0.5, 0.75, -1.4, cell); box(1.8, 0.12, 0.9, '#e9eef2', -0.5, 0.98, -1.4, cell);   // bunk
  for (const x of [-1.3, 0.3]) box(0.12, 0.6, 0.12, '#5b636b', x, 0.3, -1.4, cell);
  const win = group(2.4, 4.0, -4.2, root);                                                  // small high window, barred
  box(1.4, 1.0, 0.1, '#9fd6f2', 0, 0, 0, win);
  for (let i = 0; i < 4; i++) box(0.07, 1.0, 0.12, '#4a5159', -0.45 + i * 0.3, 0, 0.03, win);
  box(0.9, 2.4, 0.12, '#6c7a89', 4.2, 1.2, -4.2, root);                                     // steel door
  box(30, 0.02, 0.2, '#e8c547', 0, 0.045, -0.9, root).castShadow = false;                  // yellow floor line
  return { root, spots: {}, anim() {} };
}
export function shop(scene) {                                                               // bakery / snack shop (VAT episodes)
  const root = group(0, 0, 0, scene);
  wall(root, '#f6dcc0'); sideWalls(root, '#f6dcc0');
  for (let r = 0; r < 3; r++) {                                                             // shelves of colorful packs
    box(6.5, 0.12, 0.6, '#b9814f', 0, 1.6 + r * 1.1, -4.0, root);
    for (let i = 0; i < 12; i++) box(0.38, 0.6, 0.35, ['#e63946', '#f4a261', '#2a9d8f', '#e9c46a', '#457b9d', '#8d5a97'][(i + r) % 6], -3 + i * 0.54, 1.96 + r * 1.1, -3.95, root);
  }
  const counter = group(0, 0, -2.1, root);
  box(6.4, 1.2, 1.0, '#c98a5a', 0, 0.6, 0, counter); box(6.6, 0.1, 1.15, '#7a4f2c', 0, 1.25, 0, counter);
  const glass = box(6.0, 0.7, 0.9, '#cfeefc', 0, 1.65, 0, counter); glass.material = glass.material.clone(); glass.material.transparent = true; glass.material.opacity = 0.35; glass.castShadow = false;
  for (let i = 0; i < 8; i++) box(0.45, 0.22, 0.4, ['#d9a35c', '#8b5a2b', '#f2d0a4', '#c0392b'][i % 4], -2.6 + i * 0.75, 1.42, 0, counter);   // pastries
  for (let i = 0; i < 9; i++) box(0.75, 0.5, 0.9, i % 2 ? '#ffffff' : '#e63946', -3.0 + i * 0.75, 5.6, -3.6, root);          // awning stripes
  return { root, spots: {}, anim() {} };
}
export function office(scene) {                                                             // tax / money / paperwork
  const root = group(0, 0, 0, scene);
  wall(root, '#e4ecf1'); sideWalls(root, '#e4ecf1');
  const win = group(1.6, 3.0, -4.22, root);                                                 // big window with skyline
  box(4.2, 3.0, 0.08, '#a9dcf5', 0, 0, 0, win);
  for (const [x, h, c] of [[-1.5, 1.6, '#7f95ad'], [-0.8, 2.4, '#91a7bd'], [0.1, 1.9, '#6f86a0'], [0.9, 2.7, '#8aa0b8'], [1.6, 1.3, '#7b92aa']]) box(0.6, h, 0.05, c, x, -1.5 + h / 2, 0.05, win);
  box(4.4, 0.15, 0.15, '#ffffff', 0, 1.55, 0.1, win); box(4.4, 0.15, 0.15, '#ffffff', 0, -1.55, 0.1, win); box(0.12, 3.1, 0.15, '#ffffff', 0, 0, 0.1, win);
  const desk = group(-2.2, 0, -2.4, root);
  box(2.4, 0.12, 1.1, '#9c6b45', 0, 1.15, 0, desk); for (const x of [-1.05, 1.05]) box(0.15, 1.1, 1.0, '#7a4f2c', x, 0.55, 0, desk);
  box(0.9, 0.6, 0.06, '#1d2433', 0, 1.62, -0.2, desk); box(0.8, 0.5, 0.02, '#4fb3e8', 0, 1.62, -0.16, desk); box(0.1, 0.3, 0.1, '#1d2433', 0, 1.3, -0.2, desk);
  for (let i = 0; i < 4; i++) box(0.5, 0.06, 0.65, '#ffffff', 0.7, 1.24 + i * 0.06, 0.1, desk);   // paper stack
  for (const x of [-4.0, -3.3]) { box(0.65, 1.9, 0.7, '#9aa6b2', x, 0.95, -3.8, root); for (let d = 0; d < 3; d++) box(0.4, 0.06, 0.05, '#5b636b', x, 0.5 + d * 0.6, -3.44, root); }
  box(0.5, 0.6, 0.5, '#c98a5a', 4.3, 0.3, -3.5, root); box(0.9, 1.0, 0.9, '#3d8b4f', 4.3, 1.1, -3.5, root);   // plant
  return { root, spots: {}, anim() {} };
}
export function street(scene) {                                                             // traffic / towing / cars
  const root = group(0, 0, 0, scene);
  box(40, 0.07, 3.2, '#c9c4bb', 0, 0.035, 0.9, root).castShadow = false;                    // sidewalk the cast stands on
  box(40, 0.05, 5.0, '#4a4d55', 0, 0.025, -3.2, root).castShadow = false;                   // road
  for (let i = -8; i <= 8; i++) box(1.2, 0.06, 0.15, '#f2f2f2', i * 2.4, 0.03, -3.2, root).castShadow = false;
  box(40, 0.12, 0.25, '#e0dbd2', 0, 0.06, -0.72, root);                                      // curb
  car(root, -2.2, -2.2, '#d64545'); car(root, 3.6, -4.2, '#3f7fd6', Math.PI);
  const C = ['#f2b880', '#9fc8a6', '#e8a0a0', '#a7b8e0', '#f0d67a'];
  for (let i = -4; i <= 4; i++) { const h = 4 + (i * 7 % 3 + 3) % 3 * 1.4; const b = box(3.0, h, 2.5, C[(i + 9) % 5], i * 3.2, h / 2, -8.5, root);
    for (let r = 0; r < Math.floor(h / 1.3); r++) for (const dx of [-0.7, 0.7]) box(0.6, 0.6, 0.05, '#cfeefc', i * 3.2 + dx, 1.0 + r * 1.3, -7.23, root); }
  const lamp = group(4.3, 0, 0.0, root); box(0.14, 4.2, 0.14, '#3a3f47', 0, 2.1, 0, lamp); box(0.9, 0.14, 0.2, '#3a3f47', -0.4, 4.2, 0, lamp); box(0.4, 0.2, 0.3, '#fff3b0', -0.75, 4.08, 0, lamp);
  return { root, spots: {}, anim() {} };
}
export function neighborhood(scene) {                                                       // houses, fences, land
  const root = group(0, 0, 0, scene);
  house(root, -2.6, -5.0, '#f4e1c1', '#c0503a'); house(root, 3.0, -5.6, '#cfe3f0', '#3d5a80', 1.05);
  for (let i = -12; i <= 12; i++) { box(0.14, 0.9, 0.08, '#ffffff', i * 0.5, 0.45, -2.6, root); }
  box(12.5, 0.1, 0.06, '#ffffff', 0, 0.7, -2.6, root); box(12.5, 0.1, 0.06, '#ffffff', 0, 0.3, -2.6, root);
  const mb = group(-4.2, 0, -1.9, root); box(0.1, 1.1, 0.1, '#7a4f2c', 0, 0.55, 0, mb); box(0.4, 0.3, 0.6, '#2b3a67', 0, 1.2, 0, mb);
  const tr = group(4.6, 0, -2.0, root); box(0.35, 1.6, 0.35, '#7a4f2c', 0, 0.8, 0, tr); box(1.8, 1.4, 1.8, '#4f9a4f', 0, 2.2, 0, tr); box(1.2, 0.9, 1.2, '#5fae5a', 0, 3.2, 0, tr);
  return { root, spots: {}, anim() {} };
}
export function harbor(scene) {                                                             // dock, water, boats
  const root = group(0, 0, 0, scene);
  box(40, 0.25, 4.2, '#b98c5a', 0, 0.125 - 0.13, 0.6, root);                                  // dock planks (top at floor level)
  for (let i = -14; i <= 14; i++) box(0.04, 0.02, 4.2, '#8a6440', i * 0.7, 0.0, 0.6, root);
  for (const x of [-4, -1.2, 1.6, 4.4]) box(0.3, 1.0, 0.3, '#7a4f2c', x, 0.35, -1.45, root);   // posts
  const boat = group(1.8, 0, -5.2, root);
  box(3.6, 0.8, 1.4, '#ffffff', 0, 0.2, 0, boat); box(3.7, 0.15, 1.45, '#d64545', 0, -0.15, 0, boat); box(1.4, 0.8, 1.0, '#e9eef2', -0.4, 1.0, 0, boat); box(1.2, 0.3, 0.9, '#9fd6f2', -0.4, 1.05, 0.06, boat);
  const lh = group(-7, 0, -18, root); [['#ffffff', 0], ['#d64545', 1], ['#ffffff', 2], ['#d64545', 3]].forEach(([c, i]) => box(1.4 - i * 0.1, 1.5, 1.4 - i * 0.1, c, 0, 0.75 + i * 1.5, 0, lh)); box(1.0, 0.8, 1.0, '#fff3b0', 0, 6.4, 0, lh);
  return { root, spots: {}, anim(t) { boat.position.y = 0; boat.rotation.z = 0.02 * Math.sin(t * 1.2); } };
}
Object.assign(ENV, {
  prison(root) { ground(root, '#9ea3a8', -10); return { sky: ['#6d7680', '#9aa3ad'], fog: null }; },
  shop(root) { ground(root, '#c9a27a', -10); for (let i = -10; i <= 10; i++) for (let j = -2; j <= 8; j++) if ((i + j) % 2 === 0) box(1, 0.01, 1, '#b48a62', i, 0.035, j - 1.5, root).castShadow = false; return { sky: ['#e9b98f', '#f6dcc0'], fog: null }; },
  office(root) { ground(root, '#8e9eb0', -10); return { sky: ['#c9d6df', '#e4ecf1'], fog: null }; },
  street(root) { ground(root, '#c9c4bb'); return { sky: ['#4fb3ea', '#c9eefc'], fog: '#c9eefc' }; },
  neighborhood(root) { ground(root, '#86bf6a'); cloud(root, -6, 15, -32, 1.3); return { sky: ['#5ab8ec', '#d6f1fb'], fog: '#d6f1fb' }; },
  harbor(root) { const w = box(140, 0.04, 140, '#3f9fd1', 0, -0.3, -20, root); w.castShadow = false; return { sky: ['#4fb3ea', '#d6f1fb'], fog: '#d6f1fb' }; },
});
