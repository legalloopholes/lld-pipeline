// Legal Loopholes Daily — 3D world driven by the same scene plan the 2D renderer used.
// render_video.py resolves the plan against the narration and hands this page a timeline:
//   { fps, frames, mouth:[0/1 per frame], poses:[[t,pose],...],
//     scenes:[{ t, end, bg, loop, cast:[{id,x,anim}], items:[{id,t,end,anim,roll_time,hold}], zooms:[{t,amount,hold}] }] }
// The page exposes window.setupTimeline(tl) and window.renderAt(t, frame). Captions, cards, the handle tag,
// sound and the legal line are drawn on top afterwards by render_video.py, exactly as before.
import * as THREE from 'three';
import { makeLarry } from './larry.js';
import { makeChimp, makeGorilla, makeOrangutan } from './cast.js';
import { SETS, buildEnv, useEnv } from './sets.js';
import { PROPS, PROP_ALIASES, textSign, iconSign, doc } from './props.js';

const W = 1080, H = 1920, FEET_FRAC = 0.60;      // ground line sits at 60% of the frame so captions stay below the cast
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('stage').prepend(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 200);
scene.add(new THREE.HemisphereLight(0xffffff, 0xd8d2c4, 1.7));
scene.add(new THREE.AmbientLight(0xffffff, 0.35));
const sun = new THREE.DirectionalLight(0xffffff, 2.0);
sun.position.set(4, 9, 7); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 40 });
sun.shadow.radius = 6; scene.add(sun);

// ---------- build everything once ----------
const sets = {};
for (const k of Object.keys(SETS)) { sets[k] = SETS[k](scene); sets[k].env = buildEnv(k, sets[k].root); sets[k].root.visible = false; }
const larry = makeLarry(scene);
const chimp = makeChimp(scene), gorilla = makeGorilla(scene), orang = makeOrangutan(scene);
const CAST = { chimp, gorilla, orang };
const props = {};
const propKey = it => it.id === 'sign' ? `sign|${it.icon || ''}|${it.text || ''}` : it.id === 'doc' ? `doc|${it.text || ''}|${it.sub || ''}` : (PROP_ALIASES[it.id] || it.id);
const isLectern = it => ['constitution', 'gavel'].includes(propKey(it)) || it.id === 'doc';
function getProp(it) {
  if (typeof it === 'string') it = { id: it };
  const key = propKey(it);
  if (!props[key]) props[key] = it.id === 'sign' ? iconSign(scene, it.icon, it.text) : it.id === 'doc' ? doc(scene, it.text || '', it.sub || '')
    : PROPS[key] ? PROPS[key](scene) : textSign(scene, key.replace(/^(prop|map)[-:]/, '').replace(/[-_]/g, ' '));
  return props[key];
}

const BG = { 'bg-campsite': 'campsite', 'bg-yellowstone': 'yellowstone', 'bg-capitol': 'capitol', 'bg-courtroom': 'courtroom', white: 'studio' };
const setName = bg => BG[bg] || (SETS[(bg || '').replace(/^bg-/, '')] ? bg.replace(/^bg-/, '') : 'studio');
function castKey(id) {
  if (id.startsWith('larry')) return 'larry';
  if (/chimp|friend/.test(id)) return 'chimp';
  if (/judge|gorilla/.test(id)) return 'gorilla';
  if (/politician|senator|congress|mayor|governor|orangutan/.test(id)) return 'orang';
  return 'chimp';
}

// ---------- poses ----------
const EXPR = {
  neutral:   { brow: [0, 0], browY: 0, lid: 0.12, eye: 1.0, mouthW: 1.0, mouthBase: 0.25 },
  surprised: { brow: [0, 0], browY: 0.09, lid: 0.0, eye: 1.18, mouthW: 0.7, mouthBase: 1.0 },
  smug:      { brow: [0.28, -0.12], browY: 0.03, lid: 0.45, eye: 1.0, mouthW: 1.25, mouthBase: 0.18 },
  worried:   { brow: [0.32, -0.32], browY: 0.04, lid: 0.1, eye: 1.05, mouthW: 0.8, mouthBase: 0.3 },
  angry:     { brow: [-0.35, 0.35], browY: -0.03, lid: 0.3, eye: 0.95, mouthW: 1.1, mouthBase: 0.2 },
};
// arm targets: rx/rz = Larry's right arm (screen left), lx/lz = left arm (screen right)
const GEST = {
  none:    { rx: 0, rz: -0.12, lx: 0, lz: 0.12, tilt: 0 },
  explain: { rx: -0.75, rz: -0.25, lx: -0.55, lz: 0.3, tilt: 0.03, wob: 1 },
  point:   { rx: -1.35, rz: -0.35, lx: 0, lz: 0.12, tilt: 0.05 },
  think:   { rx: -2.1, rz: 0.35, lx: -0.5, lz: -0.2, tilt: 0.12 },
  shrug:   { rx: -0.45, rz: -0.85, lx: -0.45, lz: 0.85, tilt: 0.12 },
  arms_up: { rx: -0.3, rz: -1.2, lx: -0.3, lz: 1.2, tilt: 0 },
  wave:    { rx: 0, rz: -2.6, lx: 0, lz: 0.12, tilt: -0.05, wave: 1 },
  sneak:   { rx: -1.2, rz: -0.2, lx: -1.2, lz: 0.2, tilt: 0 },
  scratch: { rx: 0, rz: 0, lx: -0.35, lz: 2.75, tilt: 0.15, scratch: 1 },
};
const LARRY_POSE = {
  neutral: ['neutral', 'none'], explaining: ['neutral', 'explain'], pointing: ['neutral', 'point'], thinking: ['neutral', 'think'],
  surprised: ['surprised', 'arms_up'], smug: ['smug', 'none'], concerned: ['worried', 'none'], confident: ['smug', 'wave'],
  sneaky: ['smug', 'sneak'],
};

let TL = null;
window.setupTimeline = tl => { TL = tl; TL.frames ||= Math.ceil(tl.dur * tl.fps); TL.vdur = TL.frames / TL.fps; return true; };

const lerp = (a, b, k) => a + (b - a) * k;
const ease = k => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));
const sceneAt = t => { let s = TL.scenes[0]; for (const sc of TL.scenes) if (sc.t <= t) s = sc; return s; };
const autoPose = t => { let p = 'neutral'; for (const [a, q] of TL.poses || []) if (a <= t + 0.05) p = q; return p; };
const wx = x => (x - 0.5) * 4.4;

function applyFace(ch, exName, tA, phase = 0) {
  const ex = EXPR[exName] || EXPR.neutral;
  const bp = (tA + 0.7 + phase) % 3.3, blink = bp < 0.14 ? Math.sin((bp / 0.14) * Math.PI) : 0;
  for (const e of ch.parts.eyes) {
    const i = e.side < 0 ? 0 : 1;
    e.brow.rotation.z = ex.brow[i];
    e.brow.userData.y0 ??= e.brow.position.y; e.brow.position.y = e.brow.userData.y0 + ex.browY;
    e.ball.scale.set(ex.eye, ex.eye, 1);
    e.lid.scale.y = Math.max(0.001, Math.max(ex.lid, blink));
  }
  return ex;
}
function applyArms(ch, gName, k, tA, rest = GEST.none) {
  const g = GEST[gName] || GEST.none, P = ch.parts;
  let rx = lerp(rest.rx, g.rx, k), rz = lerp(rest.rz, g.rz, k), lx = lerp(rest.lx, g.lx, k), lz = lerp(rest.lz, g.lz, k);
  if (g.wob) { rx += 0.12 * Math.sin(tA * 3.1) * k; lx += 0.1 * Math.sin(tA * 2.6 + 1) * k; }
  if (g.wave) rz += Math.sin(tA * 12) * 0.25 * k;
  if (g.scratch) { lz += 0.1 * Math.sin(tA * 16) * k; lx += 0.06 * Math.sin(tA * 16 + 1) * k; }
  P.armR.rotation.set(rx, 0, rz); P.armL.rotation.set(lx, 0, lz);
  P.neck.rotation.z = lerp(0, g.tilt, k);
}
function standLegs(ch) {
  if (ch.parts.legs) for (const l of ch.parts.legs) { const hip = l.hip || l; hip.rotation.set(0, 0, 0); if (l.knee) l.knee.rotation.set(0, 0, 0); }
}

// ---------- per-scene layout (fixed for the whole scene, like the 2D renderer) ----------
function layoutScene(sc) {
  if (sc._L) return sc._L;
  const set = setName(sc.bg), spots = sets[set].spots || {};
  const src = sc.loop ? TL.scenes[0] : sc;
  const cast = (sc.loop ? (TL.scenes[0].cast || []).filter(c => !['tiptoe', 'walk_in', 'enter'].includes(c.anim)) : (sc.cast || []));
  const board = (sc.items || []).filter(it => it.id && it.anim !== 'roll');
  const hasBoard = board.length > 0 && !sc.loop;
  const L = { set, cast: [], board: hasBoard ? board : [], rolls: (sc.items || []).filter(it => it.anim === 'roll') };
  for (const c of cast) {
    const key = castKey(c.id), e = { c, key, x: 0, z: 0.6, y: 0, yaw: 0, sit: false };
    if (key === 'chimp' && spots.log) { e.sit = true; [e.x, , e.z, e.yaw] = spots.log; }
    else if (key === 'gorilla' && spots.judge) { [e.x, e.y, e.z] = spots.judge; }
    else if (key === 'larry') {
      e.x = c.x != null ? wx(c.x) : 0;
      if (hasBoard && (c.x == null || c.x < 0.5)) e.x = isLectern(board[0]) ? -1.0 : -1.45;
      if (c.anim === 'tiptoe') e.z = spots.log ? -0.7 : 0.4;
    } else { e.x = c.x != null ? wx(c.x) : 0.9; }
    L.cast.push(e);
  }
  // camera: wide when the set or a second character matters, medium for Larry alone in the studio
  const others = L.cast.filter(e => e.key !== 'larry').length, lar = L.cast.find(e => e.key === 'larry');
  L.shot = hasBoard ? 'two' : set === 'studio' ? 'medium' : (others || !lar ? 'wide' : 'solo');
  L.anchorX = L.shot === 'two' ? 0 : (lar && L.shot !== 'wide' ? lar.x * 0.6 : 0);
  L.anchorZ = lar ? lar.z : 0.6;
  if (sc.loop && TL.scenes[0] !== sc) {                 // loop ending reuses the opening frame's camera exactly
    const L0 = layoutScene(TL.scenes[0]); L.shot = L0.shot; L.anchorX = L0.anchorX; L.anchorZ = L0.anchorZ;
  }
  return (sc._L = L);
}
const CAMS = {
  wide:   { pos: [0, 3.6, 15.5], tgt: [0, 2.0, -0.8] },
  solo:   { pos: [0, 3.5, 15.0], tgt: [0, 2.0, -0.6] },
  two:    { pos: [0, 3.6, 17.5], tgt: [0, 2.0, -0.6] },
  medium: { pos: [0, 3.3, 14.0], tgt: [0, 2.0, 0] },
};

function zoomAmount(sc, t) {
  let best = 1;
  for (const z of sc.zooms || []) {
    const age = t - z.t, hold = z.hold ?? 0.9, amt = z.amount ?? 1.18;
    if (age >= 0 && age < hold + 0.25) best = Math.max(best, 1 + (amt - 1) * (age < hold ? Math.min(1, age / 0.08) : Math.max(0, 1 - (age - hold) / 0.25)));
  }
  return best;
}

const v3 = new THREE.Vector3();
window.renderAt = (t, frame) => {
  const sc = sceneAt(t), L = layoutScene(sc);
  const tA = sc.loop ? t - TL.vdur : t;        // loop scene runs on the clock that wraps to frame 0
  const age = t - sc.t, sdur = Math.max(0.001, sc.end - sc.t);

  // set + sky
  for (const k in sets) sets[k].root.visible = k === L.set;
  useEnv(scene, sets[L.set].env); sets[L.set].anim(Math.max(0, tA + 100));   // +100 keeps flame/steam phase continuous

  // hide everyone, then place this scene's cast
  larry.root.visible = false; for (const k in CAST) CAST[k].root.visible = false;
  let larryHead = null;
  for (const e of L.cast) {
    const ch = e.key === 'larry' ? larry : CAST[e.key];
    ch.root.visible = true; ch.root.position.set(e.x, e.y, e.z); ch.root.rotation.set(0, e.yaw, 0);
    standLegs(ch); ch.parts.torso.rotation.set(0, 0, 0);
    if (e.key === 'larry') {
      let pose = e.c.id.split(':')[1] || 'auto'; if (pose === 'auto') pose = autoPose(t);
      const [exName, gName] = LARRY_POSE[pose] || LARRY_POSE.neutral;
      const ex = applyFace(larry, exName, tA);
      const k = (sc.t === 0 || sc.loop) ? 1 : ease(age / 0.3);
      applyArms(larry, gName, k, tA);
      // mouth follows the voice track (closed in every pause)
      const open = TL.mouth ? (TL.mouth[frame] ? 0.55 + 0.45 * Math.abs(Math.sin(t * 19)) : 0) : 0;
      larry.parts.mouth.scale.set(ex.mouthW * (1 - open * 0.15), Math.max(0.15, ex.mouthBase + open * 1.5), 1);
      // idle: small head drift + tail sway; body stays planted
      larry.parts.head.rotation.set(-0.03 + 0.03 * Math.sin(tA * 1.3) - open * 0.04, 0.06 * Math.sin(tA * 0.9), 0);
      larry.parts.tailRoot.rotation.z = larry.parts.tailRoot.userData.baseZ + 0.1 * Math.sin(tA * 1.6);
      larry.parts.tailSegs.forEach((s, i) => { s.rotation.x = s.userData.baseX + 0.03 * Math.sin(tA * 2 - i * 0.4); s.rotation.z = 0.04 * Math.sin(tA * 1.6 - i * 0.35); });
      if (L.cast.length > 1) larry.root.rotation.y = 0.25;             // angle toward the other character
      // tiptoe entrance: walks in from off-screen left, legs stepping, feet always on the floor
      if (e.c.anim === 'tiptoe' && !sc.loop) {
        const walk = Math.max(0.6, sdur * 0.7), p = Math.min(1, age / walk);
        const x0 = -4.2; larry.root.position.x = lerp(x0, e.x, p);
        if (p < 1) {
          const ph = (age / 0.29) * Math.PI, a = 0.45 * Math.sin(ph);
          larry.parts.legs[0].rotation.x = a; larry.parts.legs[1].rotation.x = -a;
          larry.root.position.y = -(1 - Math.cos(Math.abs(a))) * 1.0;   // drop the hips so the planted foot stays on the floor
          larry.parts.torso.rotation.x = 0.18;                          // sneaky lean
          applyArms(larry, 'sneak', 1, tA);
        }
      }
      larry.root.updateMatrixWorld(true);
      larryHead = larry.parts.head.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.5, 0));
    } else if (e.c.face || e.c.gest) {                         // story mode: plan sets this character's face and gesture
      const ch = CAST[e.key];
      applyFace(ch, e.c.face || 'neutral', tA, 1.1);
      if (ch.parts.stick) ch.parts.stick.visible = false;
      if (!e.sit) standLegs(ch);
      applyArms(ch, e.c.gest || 'none', (sc.t === 0 || sc.loop) ? 1 : ease(age / 0.3), tA, { rx: 0, rz: 0, lx: 0, lz: 0, tilt: 0 });
      ch.root.rotation.y = e.x > 0 ? -0.3 : 0.3;
    } else if (e.key === 'chimp') {
      applyFace(chimp, 'neutral', tA, 1.1);
      const P = chimp.parts;
      if (e.sit) {                                              // sitting on the log, roasting a marshmallow over the fire
        chimp.root.position.y = chimp.sit.rootY;
        for (const l of P.legs) { l.hip.rotation.x = -Math.PI / 2; l.knee.rotation.x = Math.PI / 2; }
        P.stick.visible = true;
        const bob = 0.06 * Math.sin(tA * 2.2);
        P.armR.rotation.set(-1.15 + bob, 0, 0.1); P.armL.rotation.set(-0.9 + bob, 0, -0.35);
        P.stick.rotation.set(0.55, 0, 0);
        P.head.rotation.set(0.12, 0, 0);
      } else { P.stick.visible = false; applyArms(chimp, 'none', 1, tA, { rx: 0, rz: 0, lx: 0, lz: 0, tilt: 0 }); }
    } else if (e.key === 'gorilla') {
      const confused = /confused/.test(e.c.id);
      applyFace(gorilla, confused ? 'worried' : 'neutral', tA, 2.0);
      applyArms(gorilla, confused ? 'scratch' : 'none', confused ? ease(age / 0.4) : 0, tA, { rx: 0, rz: 0, lx: 0, lz: 0, tilt: 0 });
      gorilla.parts.head.rotation.set(0, confused ? 0.1 * Math.sin(tA * 1.1) : 0, 0);
    } else if (e.key === 'orang') {
      applyFace(orang, 'smug', tA, 0.4);
      const sh = 0.5 + 0.5 * Math.sin(tA * 1.6);                  // slow, evasive shrug
      applyArms(orang, 'shrug', ease(Math.min(1, age / 0.5)) * sh, tA, { rx: 0, rz: 0, lx: 0, lz: 0, tilt: 0 });
      orang.root.rotation.y = -0.25;
    }
  }

  // props: one board at a time (pops up out of the floor, the next replaces it), rolling props cross the floor
  for (const k in props) props[k].root.visible = false;
  L.board.forEach((it, j) => {
    const end = it.end ?? sc.end, a = t - it.t;
    if (a < 0 || t >= end) return;
    const p = getProp(it), isMap = !isLectern(it);
    p.root.visible = true;
    if (L.set === 'courtroom') p.root.position.set(0.6, 0, 1.0); else p.root.position.set(isMap ? 1.32 : 1.0, 0, isMap ? -0.8 : 0.2);
    let k = Math.min(1, a / 0.35); if (end - t < 0.18) k = Math.min(k, (end - t) / 0.18);
    p.pop(k);
    if (p.knock) p.knock((a - 0.45) / 0.35);
  });
  for (const it of L.rolls) {
    const p = getProp(it); const a = t - it.t; if (a < 0 || !p.roll) continue;
    p.root.visible = true; p.root.position.z = 1.3;
    const q = Math.min(1, a / (it.roll_time || 2.0)); p.roll(1 - (1 - q) * (1 - q), 4.2, 0.4);
  }

  // camera: per-scene framing, slow push-in (none on the loop ending), punch-ins on zooms
  const C = CAMS[L.shot];
  const pos = new THREE.Vector3(C.pos[0] + L.anchorX * 0.6, C.pos[1], C.pos[2]), tgt = new THREE.Vector3(C.tgt[0] + L.anchorX * 0.8, C.tgt[1], C.tgt[2]);
  const push = sc.loop ? 0 : 0.045 * Math.min(1, age / sdur);
  pos.lerp(tgt, push);
  if (TL.share && !sc.loop && t >= TL.share[0] && t < TL.share[1]) {   // share card: ease the camera back, more sky on top
    const q = Math.min(1, (t - TL.share[0]) / 0.35), e = q * q * (3 - 2 * q);
    pos.sub(tgt).multiplyScalar(1 + 0.32 * e).add(tgt);
  }
  // whip pan into every new scene (not the opening, not the loop ending)
  const si = TL.scenes.indexOf(sc);
  if (si > 0 && !sc.loop && age < 0.24) {
    const q = 1 - age / 0.24, ang = (si % 2 ? 1 : -1) * 0.42 * q * q;
    const d = pos.clone().sub(tgt); d.applyAxisAngle(new THREE.Vector3(0, 1, 0), ang); pos.copy(tgt).add(d);
  }
  const basePos = pos.clone(), baseTgt = tgt.clone();
  const z = zoomAmount(sc, t);
  if (z > 1.001 && larryHead) {                               // move toward Larry's face, keep the same angle
    const aim = larryHead.clone().add(new THREE.Vector3(0, -0.35, 0));
    const f = 1 - 1 / z; pos.lerp(aim, f * 0.9); tgt.lerp(aim, f);
  }
  // keep the ground line at FEET_FRAC of the frame (captions live below it); fades out smoothly during punch-ins
  camera.clearViewOffset(); camera.position.copy(basePos); camera.lookAt(baseTgt); camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  v3.set(L.anchorX, 0, L.anchorZ).project(camera);
  const off = ((1 - (v3.y + 1) / 2) * H - FEET_FRAC * H) / z;
  camera.position.copy(pos); camera.lookAt(tgt); camera.setViewOffset(W, H, 0, off, W, H);
  // shakes on the big sound hits, quick dutch tilts on exclamations
  let roll = 0;
  for (const s0 of TL.shakes || []) {
    const a = t - s0; if (a < 0 || a > 0.38) continue;
    const k = (1 - a / 0.38) ** 2;
    camera.position.x += 0.22 * k * Math.sin(a * 83); camera.position.y += 0.16 * k * Math.sin(a * 61 + 1.3);
    roll += 0.035 * k * Math.sin(a * 71);
  }
  for (const tl of TL.tilts || []) {
    const a = t - tl.t; if (a < 0 || a > 1.1) continue;
    const k = a < 0.12 ? a / 0.12 : (a < 0.85 ? 1 : Math.max(0, 1 - (a - 0.85) / 0.25));
    roll += (tl.dir || 1) * 0.065 * k;
  }
  if (roll) camera.rotateZ(roll);
  camera.updateMatrixWorld(true);
  renderer.render(scene, camera);
  // name tags: a label over each named character so viewers know who is who
  let used = 0;
  for (const e of L.cast) {
    if (!e.c.name || e.key === 'larry') continue;
    const ch = CAST[e.key]; if (!ch || !ch.root.visible) continue;
    ch.root.updateMatrixWorld(true);
    const p = ch.parts.head.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 1.05, 0)).project(camera);
    const tag = nameTag(used++);
    tag.textContent = e.c.name;
    tag.style.display = 'block';
    tag.style.left = ((p.x + 1) / 2 * W) + 'px';
    tag.style.top = Math.max(300, (1 - p.y) / 2 * H) + 'px';
  }
  for (let i = used; i < TAGS.length; i++) TAGS[i].style.display = 'none';
  return true;
};
const TAGS = [];
function nameTag(i) {
  while (TAGS.length <= i) {
    const d = document.createElement('div');
    Object.assign(d.style, { position: 'absolute', transform: 'translate(-50%, -100%)', padding: '10px 26px', borderRadius: '22px',
      background: '#ffffff', color: '#1d1d22', border: '5px solid #1d1d22', font: '900 46px "Archivo Black", "Inter", sans-serif',
      letterSpacing: '1px', whiteSpace: 'nowrap', boxShadow: '0 8px 0 rgba(0,0,0,0.18)', display: 'none', pointerEvents: 'none' });
    document.getElementById('stage').appendChild(d); TAGS.push(d);
  }
  return TAGS[i];
}
window.worldReady = true;
