// Primate cast for Legal Loopholes Daily — same blocky style as Loophole Larry.
// Each maker returns { root, parts } where parts holds pivots the timeline can animate
// (arms, head, mouth, eyes) so every character can talk, blink and gesture like Larry.
import * as THREE from 'three';

const matCache = {};
export function mat(color) {
  return (matCache[color] ||= new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0, flatShading: true }));
}
export function box(w, h, d, color, x, y, z, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  parent.add(m); return m;
}
export function group(x, y, z, parent) {
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g;
}

// shared face: eyes with lids + glints, brows, mouth pivot — same construction as Larry's
function face(head, o) {
  const eyes = [];
  for (const s of [-1, 1]) {
    const e = group(s * o.eyeX, o.eyeY, o.z, head);
    box(o.eyeW + 0.06, o.eyeW + 0.04, 0.03, o.socket, 0, 0, 0, e);
    const ball = group(0, 0, 0.025, e);
    box(o.eyeW, o.eyeW, 0.03, o.iris, 0, 0, 0, ball);
    box(o.eyeW * 0.6, o.eyeW * 0.62, 0.03, '#141317', 0, -0.01, 0.015, ball);
    box(o.eyeW * 0.24, o.eyeW * 0.24, 0.02, '#ffffff', 0.035 * s, 0.04, 0.035, ball);
    const lid = group(0, o.eyeW / 2, 0.05, e);
    box(o.eyeW + 0.02, o.eyeW, 0.02, o.lidColor, 0, -o.eyeW / 2, 0, lid);
    lid.scale.y = 0.001;
    const brow = group(0, o.eyeW / 2 + 0.07, 0.02, e);
    box(o.eyeW * 0.8, 0.05, 0.05, o.browColor, 0, 0, 0, brow);
    eyes.push({ side: s, ball, lid, brow });
  }
  const mouth = group(0, o.mouthY, o.mouthZ ?? (o.z + 0.02), head);
  box(o.mouthW, 0.07, 0.04, '#3a1a1c', 0, 0, 0, mouth);
  return { eyes, mouth };
}

function arm(parent, side, x, y, len, w, color, hand, sleeve) {
  const pivot = group(side * x, y, 0, parent);
  box(w, len, w * 1.1, sleeve || color, 0, -len / 2, 0, pivot);
  box(w * 1.12, 0.2, w * 1.2, hand, 0, -len - 0.06, 0, pivot);
  return pivot;
}

// ---------- chimp friend: dark fur, big round ears, red flannel, jeans ----------
export function makeChimp(parent) {
  const F = { fur: '#3f2c22', skin: '#d8b08a', skinDark: '#b88d68', shirt: '#c8332b', plaid: '#7d1b17', jeans: '#3b5a8a' };
  const root = group(0, 0, 0, parent);
  const legs = [];
  for (const s of [-1, 1]) {                                   // legs with hip + knee pivots so he can sit
    const hip = group(s * 0.23, 0.9, 0, root);
    box(0.32, 0.42, 0.36, F.jeans, 0, -0.21, 0, hip);
    const knee = group(0, -0.42, 0, hip);
    box(0.32, 0.34, 0.36, F.jeans, 0, -0.17, 0, knee);
    box(0.36, 0.14, 0.5, F.skinDark, 0, -0.41, 0.06, knee);
    legs.push({ hip, knee });
  }
  const torso = group(0, 0.9, 0, root);
  box(0.98, 1.12, 0.7, F.shirt, 0, 0.56, 0, torso);
  for (const y of [0.25, 0.6, 0.95]) box(1.0, 0.07, 0.72, F.plaid, 0, y, 0, torso);       // flannel bands
  for (const x of [-0.3, 0.3]) box(0.07, 1.12, 0.72, F.plaid, x, 0.56, 0, torso);
  box(0.08, 0.9, 0.04, '#e8d9c4', 0, 0.55, 0.36, torso);                                   // button placket
  const armR = arm(torso, -1, 0.62, 1.02, 0.86, 0.26, F.shirt, F.skinDark);
  const armL = arm(torso, 1, 0.62, 1.02, 0.86, 0.26, F.shirt, F.skinDark);
  const neck = group(0, 1.12, 0, torso);
  const head = group(0, 0, 0, neck);
  box(1.12, 0.98, 0.95, F.fur, 0, 0.5, 0, head);
  box(0.9, 0.72, 0.06, F.skin, 0, 0.42, 0.48, head);           // face
  box(0.62, 0.3, 0.2, F.skin, 0, 0.2, 0.55, head);             // muzzle
  box(0.18, 0.05, 0.03, F.skinDark, 0, 0.3, 0.66, head);       // nostrils line
  for (const s of [-1, 1]) {                                    // big round ears
    box(0.12, 0.38, 0.34, F.skin, s * 0.62, 0.52, 0, head);
    box(0.06, 0.24, 0.2, F.skinDark, s * 0.69, 0.52, 0, head);
  }
  box(1.0, 0.1, 0.06, F.fur, 0, 0.74, 0.5, head);              // brow ridge
  const f = face(head, { eyeX: 0.21, eyeY: 0.55, z: 0.52, eyeW: 0.2, socket: '#5a4030', iris: '#7a4a22',
    lidColor: F.skin, browColor: F.fur, mouthY: 0.12, mouthW: 0.26, mouthZ: 0.66 });
  // roasting stick with a marshmallow, held in his right hand (hidden unless the pose asks for it)
  const stick = group(0, -0.92, 0.1, armR); stick.visible = false;
  box(0.05, 0.05, 1.5, '#7a4f2c', 0, 0, 0.7, stick);
  const mallow = box(0.16, 0.2, 0.16, '#fbf6ea', 0, 0, 1.48, stick);
  root.scale.setScalar(0.92);
  // sitting geometry (world units): hip height that puts the feet flat on the floor, and the seat top under the thighs
  const S = 0.92, sit = { hipY: 0.48 * S, seatTop: (0.48 - 0.18) * S, rootY: 0.48 * S - 0.9 * S };
  return { root, parts: { torso, neck, head, armR, armL, legs, stick, mallow, ...f }, height: 2.55, sit };
}

// ---------- judge: big silverback gorilla in a black robe with white collar tabs ----------
export function makeGorilla(parent) {
  const F = { fur: '#2c2a30', face: '#55505a', faceDark: '#3c3842', robe: '#16161b', robeEdge: '#2a2a33', tab: '#f2f0ea', silver: '#8b8892' };
  const root = group(0, 0, 0, parent);
  for (const s of [-1, 1]) {
    box(0.46, 0.85, 0.5, F.robe, s * 0.33, 0.52, 0, root);
    box(0.5, 0.16, 0.66, F.fur, s * 0.33, 0.08, 0.08, root);
  }
  const torso = group(0, 0.95, 0, root);
  box(1.55, 1.5, 0.95, F.robe, 0, 0.75, 0, torso);                // broad robe
  box(0.12, 1.4, 0.04, F.robeEdge, -0.2, 0.72, 0.48, torso);       // robe opening edges
  box(0.12, 1.4, 0.04, F.robeEdge, 0.2, 0.72, 0.48, torso);
  box(0.13, 0.32, 0.05, F.tab, -0.08, 1.24, 0.5, torso).rotation.z = 0.15;   // white collar tabs
  box(0.13, 0.32, 0.05, F.tab, 0.08, 1.24, 0.5, torso).rotation.z = -0.15;
  const armR = arm(torso, -1, 0.95, 1.36, 1.15, 0.42, F.fur, F.faceDark, F.robe);   // long gorilla arms
  const armL = arm(torso, 1, 0.95, 1.36, 1.15, 0.42, F.fur, F.faceDark, F.robe);
  const neck = group(0, 1.5, 0.05, torso);
  const head = group(0, 0, 0, neck);
  box(1.2, 1.05, 1.0, F.fur, 0, 0.5, 0, head);
  box(1.0, 0.28, 0.6, F.fur, 0, 1.08, -0.08, head);              // sagittal crest
  box(0.92, 0.72, 0.06, F.face, 0, 0.42, 0.51, head);
  box(1.0, 0.16, 0.16, F.faceDark, 0, 0.7, 0.56, head);          // heavy brow ridge
  box(0.5, 0.22, 0.16, F.faceDark, 0, 0.3, 0.6, head);           // broad nose
  box(0.08, 0.06, 0.02, '#1b1a1f', -0.1, 0.32, 0.69, head);
  box(0.08, 0.06, 0.02, '#1b1a1f', 0.1, 0.32, 0.69, head);
  for (const s of [-1, 1]) box(0.1, 0.2, 0.2, F.face, s * 0.62, 0.5, 0, head);       // small ears
  box(1.22, 0.3, 0.9, F.silver, 0, -0.2, -0.15, torso).position.set(0, 1.35, -0.25); // silver back
  const f = face(head, { eyeX: 0.22, eyeY: 0.52, z: 0.55, eyeW: 0.17, socket: '#2a272e', iris: '#6b3f1d',
    lidColor: F.face, browColor: F.faceDark, mouthY: 0.12, mouthW: 0.32 });
  root.scale.setScalar(1.12);
  return { root, parts: { torso, neck, head, armR, armL, ...f }, height: 3.6 };
}

// ---------- politician: orangutan with cheek pads, navy suit, white shirt, blue tie, flag pin ----------
export function makeOrangutan(parent) {
  const F = { fur: '#b5532a', furDark: '#86391a', face: '#8d6248', pad: '#6f4a35', suit: '#1f2b4d', shirt: '#f4f2ec', tie: '#2f6fc0' };
  const root = group(0, 0, 0, parent);
  for (const s of [-1, 1]) {
    box(0.36, 0.78, 0.42, F.suit, s * 0.26, 0.48, 0, root);
    box(0.4, 0.14, 0.56, '#121214', s * 0.26, 0.07, 0.07, root);    // dress shoes
  }
  const torso = group(0, 0.86, 0, root);
  box(1.2, 1.25, 0.8, F.suit, 0, 0.62, 0, torso);
  box(0.44, 0.9, 0.04, F.shirt, 0, 0.78, 0.41, torso);              // shirt front
  box(0.16, 0.13, 0.07, '#24548f', 0, 1.15, 0.44, torso);           // tie knot
  box(0.16, 0.7, 0.05, F.tie, 0, 0.75, 0.44, torso);
  box(0.06, 0.04, 0.03, '#ffffff', 0.38, 1.0, 0.42, torso);        // flag pin
  box(0.06, 0.03, 0.03, '#c0262d', 0.38, 0.975, 0.425, torso);
  for (const s of [-1, 1]) box(0.24, 0.6, 0.05, '#18223d', s * 0.3, 0.95, 0.42, torso).rotation.z = s * 0.25;   // lapels
  const armR = arm(torso, -1, 0.74, 1.15, 1.1, 0.3, F.fur, F.furDark, F.suit);
  const armL = arm(torso, 1, 0.74, 1.15, 1.1, 0.3, F.fur, F.furDark, F.suit);
  const neck = group(0, 1.25, 0, torso);
  const head = group(0, 0, 0, neck);
  box(1.0, 1.0, 0.9, F.fur, 0, 0.55, 0, head);
  box(0.7, 0.12, 0.5, F.fur, 0, 1.08, 0, head);                     // tuft
  for (const s of [-1, 1]) box(0.34, 0.8, 0.22, F.pad, s * 0.66, 0.45, 0.25, head);   // flanged cheek pads
  box(0.78, 0.78, 0.06, F.face, 0, 0.45, 0.46, head);
  box(0.5, 0.26, 0.16, F.pad, 0, 0.2, 0.52, head);                  // muzzle
  const f = face(head, { eyeX: 0.17, eyeY: 0.6, z: 0.5, eyeW: 0.16, socket: '#5c3c2a', iris: '#5a3517',
    lidColor: F.face, browColor: F.furDark, mouthY: 0.12, mouthW: 0.28, mouthZ: 0.61 });
  return { root, parts: { torso, neck, head, armR, armL, ...f }, height: 3.1 };
}
