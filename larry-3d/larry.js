// Loophole Larry as a reusable maker (same model as the approved one; legs now pivot at the hip).
import * as THREE from 'three';
import { box, group } from './cast.js';
export function makeLarry(parent0) {
  const C = {
    fur: '#8f8d95', furDark: '#55535b', cream: '#e6e1d6', white: '#f6f4ef', black: '#1d1c21',
    amber: '#f2a515', red: '#d62828', redDark: '#9e1b1b', mouth: '#5a1616',
    gold: '#d9a93b', wood: '#b9814f', woodDark: '#7a4f2c',
  };
  
  // ---------- Loophole Larry ----------
  const larry = group(0, 0, 0, parent0);
  
  // legs + feet
  const legs = [];
  for (const s of [-1, 1]) {                       // hip pivot at y=1.0 so legs can step without lifting the body
    const hip = group(s * 0.25, 1.0, 0, larry);
    box(0.34, 0.9, 0.38, C.fur, 0, -0.45, 0, hip);
    box(0.38, 0.16, 0.52, C.black, 0, -0.92, 0.06, hip);
    legs.push(hip);
  }
  
  const torso = group(0, 1.0, 0, larry);
  box(1.0, 1.22, 0.72, C.fur, 0, 0.6, 0, torso);
  box(0.6, 0.92, 0.05, C.cream, 0, 0.52, 0.37, torso);       // belly
  box(0.22, 0.13, 0.07, C.white, -0.12, 1.13, 0.37, torso).rotation.z = 0.5;   // collar
  box(0.22, 0.13, 0.07, C.white, 0.12, 1.13, 0.37, torso).rotation.z = -0.5;
  box(0.17, 0.14, 0.08, C.redDark, 0, 1.08, 0.4, torso);     // tie knot
  const tie = box(0.2, 0.74, 0.06, C.red, 0, 0.66, 0.4, torso);
  box(0.14, 0.12, 0.06, C.red, 0, 0.26, 0.4, torso).rotation.z = Math.PI / 4; // tie tip
  
  // arms: pivot at the shoulder, arm hangs down
  function makeArm(side) {
    const pivot = group(side * 0.63, 1.08, 0, torso);
    box(0.26, 0.78, 0.3, C.fur, 0, -0.36, 0, pivot);
    box(0.29, 0.2, 0.32, C.black, 0, -0.82, 0, pivot);
    return pivot;
  }
  const armR = makeArm(-1); // Larry's right (screen left)
  const armL = makeArm(1);
  
  // head
  const neck = group(0, 1.22, 0, torso);
  const head = group(0, 0, 0, neck);
  box(1.26, 1.0, 1.0, C.fur, 0, 0.5, 0, head);
  box(1.06, 0.78, 0.06, C.white, 0, 0.44, 0.51, head);       // white face mask
  
  // ears with white edges
  for (const s of [-1, 1]) {
    const ear = group(s * 0.55, 0.95, 0, head);
    ear.rotation.z = -s * 0.55;
    box(0.36, 0.42, 0.16, C.fur, 0, 0.12, 0, ear);
    box(0.24, 0.28, 0.03, C.white, 0, 0.12, 0.09, ear);
    box(0.4, 0.07, 0.17, C.white, 0, 0.34, 0, ear);
  }
  
  // eyes (cute version): soft droopy patch, big shiny pupil with two glints, eyelid, thin brow
  const EYE_Y = 0.45;
  const eyes = [];
  for (const s of [-1, 1]) {
    const e = group(s * 0.25, EYE_Y, 0.54, head);
    box(0.4, 0.38, 0.04, C.black, 0, -0.03, 0, e).rotation.z = -s * 0.18; // inner corner up = gentle
    const ball = group(0, 0, 0.03, e);
    box(0.29, 0.29, 0.03, C.amber, 0, 0, 0, ball);            // amber iris
    box(0.18, 0.19, 0.03, C.black, 0, -0.01, 0.015, ball);    // big pupil
    box(0.07, 0.07, 0.02, C.white, 0.04 * s, 0.045, 0.035, ball);   // main glint
    box(0.035, 0.035, 0.02, C.white, -0.04 * s, -0.055, 0.035, ball);  // small glint
    const lid = group(0, 0.145, 0.06, e);             // scale.y 0..1 closes from the top
    box(0.3, 0.29, 0.02, C.black, 0, -0.145, 0, lid);
    lid.scale.y = 0.001;
    const brow = group(0, 0.27, 0.0, e);
    box(0.2, 0.045, 0.05, '#4a4950', 0, 0, 0, brow);
    eyes.push({ side: s, ball, lid, brow });
  }
  
  // blush
  for (const s of [-1, 1]) box(0.17, 0.08, 0.02, '#f3a3a3', s * 0.4, 0.22, 0.545, head);
  
  // small snout + small mouth
  box(0.26, 0.16, 0.16, C.black, 0, 0.25, 0.6, head);
  box(0.08, 0.04, 0.02, '#4a4950', 0, 0.3, 0.685, head);   // nose shine
  const mouth = group(0, 0.12, 0.55, head);
  const mouthMesh = box(0.16, 0.07, 0.04, '#3a1a1c', 0, 0, 0, mouth);
  
  // monocle on Larry's right eye, chain down to the collar
  const monocle = group(-0.25, EYE_Y, 0.62, head);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.035, 6, 16),
    new THREE.MeshStandardMaterial({ color: C.gold, metalness: 0.6, roughness: 0.35, flatShading: true }));
  ring.castShadow = true;
  monocle.add(ring);
  const glass = new THREE.Mesh(new THREE.CircleGeometry(0.15, 16),
    new THREE.MeshStandardMaterial({ color: '#cfe8ff', transparent: true, opacity: 0.22, roughness: 0.1 }));
  monocle.add(glass);
  for (let i = 1; i <= 6; i++) {
    box(0.04, 0.06, 0.04, C.gold, -0.4 - Math.sin(i * 0.4) * 0.08, 0.4 - i * 0.075, 0.6 - i * 0.02, head);
  }
  
  // tail: alternating black/white rings, curling up behind him
  const tailSegs = [];
  let parent = group(0.25, 0.2, -0.38, torso);
  parent.rotation.order = 'ZXY';
  parent.rotation.x = -1.35;
  parent.userData.baseZ = -0.4;   // swing out to Larry's left so it reads beside him
  const tailRoot = parent;
  for (let i = 0; i < 13; i++) {
    const seg = group(0, i === 0 ? 0 : 0.28, 0, parent);
    box(0.24 - i * 0.004, 0.28, 0.24 - i * 0.004, i % 2 ? C.white : C.black, 0, 0.14, 0, seg);
    seg.userData.baseX = i === 0 ? 0 : i < 4 ? 0.28 : i < 10 ? 0.06 : 0.42; // up, straight, hooked tip
    tailSegs.push(seg);
    parent = seg;
  }
  return { root: larry, height: 3.3, legLen: 1.0,
    parts: { torso, neck, head, armR, armL, eyes, mouth, legs, tailRoot, tailSegs } };
}
