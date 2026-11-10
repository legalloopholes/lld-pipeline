// Character kit for Legal Loopholes Daily: one maker builds any primate as "<species>.<outfit>".
// Same blocky style and the same animatable parts as cast.js (torso, neck, head, armR, armL, eyes, mouth, legs),
// so world.js poses them exactly like the chimp. Larry stays the only lemur.
//   makePrimate(scene, 'baboon.cop')
import { box, group } from './cast.js';

// ---------- shared face (eyes with lids + glints, brows, mouth pivot), same build as cast.js ----------
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
  const mouth = group(0, o.mouthY, o.mouthZ, head);
  box(o.mouthW, 0.07, 0.04, '#3a1a1c', 0, 0, 0, mouth);
  return { eyes, mouth };
}

// ---------- species: fur/face colours, body proportions and a head builder ----------
// head(h, S) builds on the head pivot (origin at the neck) and returns face() options.
const SPECIES = {
  baboon: { fur: '#8a7a52', furDark: '#6a5c3c', hand: '#4a4038', scale: 0.95, armLen: 0.9,
    head(h, S) {
      box(1.05, 0.95, 0.9, S.fur, 0, 0.5, 0, h);
      box(1.25, 0.5, 0.7, S.furDark, 0, 0.2, -0.15, h);                // mane
      box(0.78, 0.5, 0.06, '#9b8a83', 0, 0.62, 0.46, h);               // brow plate
      box(0.44, 0.38, 0.52, '#a8938c', 0, 0.28, 0.66, h);              // long dog-like muzzle
      box(0.3, 0.12, 0.04, '#3a2e2c', 0, 0.38, 0.93, h);               // nose tip
      box(0.8, 0.12, 0.08, S.furDark, 0, 0.8, 0.44, h);
      for (const s of [-1, 1]) box(0.1, 0.22, 0.2, '#9b8a83', s * 0.56, 0.6, 0, h);
      return { eyeX: 0.18, eyeY: 0.66, z: 0.5, eyeW: 0.15, socket: '#5a4a40', iris: '#c08a2a',
        lidColor: '#9b8a83', browColor: S.furDark, mouthY: 0.14, mouthW: 0.3, mouthZ: 0.92 };
    } },
  mandrill: { fur: '#5b5a3e', furDark: '#3e3d2a', hand: '#2d2b24', scale: 1.0, armLen: 0.9,
    head(h, S) {
      box(1.05, 1.0, 0.9, S.fur, 0, 0.5, 0, h);
      box(0.8, 0.6, 0.06, '#2c2a2c', 0, 0.55, 0.46, h);
      box(0.2, 0.55, 0.5, '#d4302b', 0, 0.36, 0.7, h);                 // red nose ridge
      for (const s of [-1, 1]) box(0.16, 0.42, 0.42, '#4f7fd0', s * 0.19, 0.32, 0.66, h);   // blue ridged cheeks
      for (const s of [-1, 1]) for (const y of [0.22, 0.34, 0.46]) box(0.17, 0.03, 0.43, '#3a64ad', s * 0.19, y, 0.665, h);
      box(0.6, 0.22, 0.3, '#e0b23a', 0, -0.02, 0.45, h);               // yellow beard
      box(0.7, 0.14, 0.5, S.furDark, 0, 1.03, 0, h);                   // crest
      return { eyeX: 0.22, eyeY: 0.66, z: 0.5, eyeW: 0.15, socket: '#1e1c1e', iris: '#d08a1a',
        lidColor: '#2c2a2c', browColor: S.furDark, mouthY: 0.12, mouthW: 0.3, mouthZ: 0.8 };
    } },
  capuchin: { fur: '#4a3324', furDark: '#2e2018', hand: '#c9a27c', scale: 0.82, armLen: 0.82, chest: '#ecd9b8',
    head(h, S) {
      box(1.0, 0.92, 0.88, '#ecd9b8', 0, 0.48, 0, h);                  // cream head and shoulders
      box(1.02, 0.3, 0.9, S.fur, 0, 0.88, -0.02, h);                   // dark cap
      box(0.5, 0.3, 0.06, S.fur, 0, 0.98, 0.43, h);
      box(0.76, 0.6, 0.06, '#d9a98a', 0, 0.42, 0.45, h);               // pink face
      box(0.4, 0.22, 0.14, '#c99474', 0, 0.22, 0.5, h);
      for (const s of [-1, 1]) box(0.08, 0.2, 0.2, '#d9a98a', s * 0.54, 0.5, 0, h);
      return { eyeX: 0.17, eyeY: 0.52, z: 0.48, eyeW: 0.18, socket: '#6a4a38', iris: '#4a2a14',
        lidColor: '#d9a98a', browColor: S.fur, mouthY: 0.12, mouthW: 0.22, mouthZ: 0.58 };
    } },
  macaque: { fur: '#a89a86', furDark: '#857867', hand: '#c77a6c', scale: 0.88, armLen: 0.84,
    head(h, S) {
      box(1.1, 0.98, 0.92, S.fur, 0, 0.5, 0, h);
      for (const s of [-1, 1]) box(0.3, 0.5, 0.6, S.fur, s * 0.62, 0.36, 0.05, h);   // fluffy cheeks
      box(0.76, 0.66, 0.06, '#d9645a', 0, 0.44, 0.47, h);              // red face
      box(0.36, 0.2, 0.14, '#c4554c', 0, 0.24, 0.52, h);
      box(0.9, 0.16, 0.5, S.furDark, 0, 1.0, 0.05, h);                 // swept fringe
      return { eyeX: 0.17, eyeY: 0.55, z: 0.5, eyeW: 0.15, socket: '#9a4038', iris: '#6a3a1c',
        lidColor: '#d9645a', browColor: S.furDark, mouthY: 0.12, mouthW: 0.22, mouthZ: 0.6 };
    } },
  gibbon: { fur: '#26232a', furDark: '#151317', hand: '#26232a', scale: 0.9, armLen: 1.25,
    head(h, S) {
      box(1.0, 0.92, 0.86, S.fur, 0, 0.48, 0, h);
      box(0.86, 0.74, 0.05, '#f0ece2', 0, 0.44, 0.44, h);              // white face ring
      box(0.66, 0.56, 0.06, '#3a363e', 0, 0.44, 0.46, h);
      box(0.32, 0.18, 0.12, '#2c2930', 0, 0.26, 0.52, h);
      return { eyeX: 0.15, eyeY: 0.52, z: 0.5, eyeW: 0.16, socket: '#1a181c', iris: '#8a5a24',
        lidColor: '#3a363e', browColor: '#f0ece2', mouthY: 0.14, mouthW: 0.2, mouthZ: 0.58 };
    } },
  proboscis: { fur: '#c98a4a', furDark: '#a86c34', hand: '#d8a98a', scale: 0.96, armLen: 0.9,
    head(h, S) {
      box(1.05, 0.95, 0.9, S.fur, 0, 0.5, 0, h);
      box(1.08, 0.24, 0.92, '#8a5530', 0, 0.94, -0.02, h);             // dark cap
      box(0.78, 0.66, 0.06, '#e3b394', 0, 0.42, 0.46, h);
      box(0.3, 0.42, 0.34, '#e8a383', 0, 0.3, 0.62, h);                // the famous nose
      box(0.34, 0.14, 0.36, '#e8a383', 0, 0.1, 0.66, h);
      box(0.62, 0.24, 0.3, '#f0ece2', 0, -0.04, 0.4, h);               // white collar ruff
      return { eyeX: 0.2, eyeY: 0.6, z: 0.5, eyeW: 0.13, socket: '#9a6a50', iris: '#6a3a1c',
        lidColor: '#e3b394', browColor: '#8a5530', mouthY: -0.06, mouthW: 0.2, mouthZ: 0.62 };
    } },
  tarsier: { fur: '#b59a72', furDark: '#8f7652', hand: '#d6b894', scale: 0.78, armLen: 0.8,
    head(h, S) {
      box(1.15, 1.0, 0.9, S.fur, 0, 0.5, 0, h);
      for (const s of [-1, 1]) { box(0.14, 0.55, 0.42, S.fur, s * 0.62, 0.95, -0.05, h); box(0.06, 0.4, 0.3, '#e0b8a0', s * 0.69, 0.95, -0.05, h); }
      box(0.95, 0.66, 0.05, '#cdb290', 0, 0.52, 0.46, h);
      box(0.16, 0.12, 0.1, '#7a5a40', 0, 0.3, 0.5, h);
      return { eyeX: 0.24, eyeY: 0.56, z: 0.5, eyeW: 0.34, socket: '#4a3424', iris: '#c88a14',     // huge eyes
        lidColor: S.fur, browColor: S.furDark, mouthY: 0.16, mouthW: 0.18, mouthZ: 0.5 };
    } },
  bonobo: { fur: '#1e1c20', furDark: '#121014', hand: '#3c3436', scale: 0.92, armLen: 0.9,
    head(h, S) {
      box(1.1, 0.98, 0.94, S.fur, 0, 0.5, 0, h);
      for (const s of [-1, 1]) box(0.5, 0.22, 0.96, S.furDark, s * 0.28, 1.02, 0, h).rotation.z = s * -0.25;   // centre-parted hair
      box(0.84, 0.7, 0.06, '#3c3436', 0, 0.42, 0.48, h);
      box(0.56, 0.3, 0.18, '#4a4044', 0, 0.2, 0.55, h);
      box(0.34, 0.06, 0.04, '#d8848c', 0, 0.08, 0.64, h);              // pink lips
      for (const s of [-1, 1]) box(0.1, 0.3, 0.28, '#3c3436', s * 0.6, 0.52, 0, h);
      return { eyeX: 0.2, eyeY: 0.54, z: 0.52, eyeW: 0.17, socket: '#241f22', iris: '#6a3f1d',
        lidColor: '#3c3436', browColor: S.furDark, mouthY: 0.14, mouthW: 0.26, mouthZ: 0.65 };
    } },
};

// ---------- outfits: shirt/pants colours and the bits that make the role readable at a glance ----------
const OUTFITS = {
  cop: { shirt: '#24345e', pants: '#1b2440', shoes: '#111114',
    extra(P) {
      box(0.18, 0.2, 0.05, '#e2b33a', 0.26, 0.95, 0.37, P.torso);                    // badge
      box(1.02, 0.12, 0.74, '#15151a', 0, 0.12, 0, P.torso);                         // duty belt
      box(0.08, 0.12, 0.04, '#cfd4dc', -0.25, 1.0, 0.37, P.torso);                   // name plate
      box(1.14, 0.22, 1.02, '#1b2440', 0, 1.06, 0, P.head); box(1.24, 0.06, 1.24, '#15151a', 0, 0.96, 0.12, P.head);   // peaked cap
      box(0.2, 0.14, 0.04, '#e2b33a', 0, 1.08, 0.52, P.head);
    } },
  customs: { shirt: '#9cc3e8', pants: '#2b3550', shoes: '#111114',
    extra(P) {
      box(0.16, 0.18, 0.05, '#e2b33a', 0.26, 0.95, 0.37, P.torso);
      for (const s of [-1, 1]) box(0.3, 0.06, 0.74, '#2b3550', s * 0.36, 1.12, 0, P.torso);   // epaulettes
      box(1.14, 0.2, 1.02, '#2b3550', 0, 1.05, 0, P.head); box(1.2, 0.06, 1.2, '#2b3550', 0, 0.96, 0.12, P.head);
    } },
  suit: { shirt: '#3a3f48', pants: '#2c3038', shoes: '#111114',
    extra(P) {
      box(0.4, 0.9, 0.04, '#f4f2ec', 0, 0.75, 0.37, P.torso);
      box(0.15, 0.68, 0.05, '#6b2a3c', 0, 0.72, 0.4, P.torso);
      for (const s of [-1, 1]) box(0.22, 0.58, 0.05, '#2c3038', s * 0.28, 0.9, 0.39, P.torso).rotation.z = s * 0.25;
    } },
  irs: { shirt: '#5a5f66', pants: '#43474d', shoes: '#111114',
    extra(P) {                                                                         // grey suit, visor, glasses, clipboard
      box(0.4, 0.9, 0.04, '#f4f2ec', 0, 0.75, 0.37, P.torso);
      box(0.13, 0.6, 0.05, '#2b2b2f', 0, 0.74, 0.4, P.torso);
      glasses(P);
      box(1.1, 0.06, 0.5, '#2f7a4a', 0, 0.98, 0.42, P.head);                          // green accountant visor
      const cb = group(0, -0.86, 0.22, P.armL); box(0.5, 0.66, 0.05, '#a87a4a', 0, 0, 0, cb); box(0.4, 0.5, 0.02, '#f6f4ef', 0, -0.04, 0.03, cb);
      cb.rotation.x = -0.4;
    } },
  hardhat: { shirt: '#5a6a7a', pants: '#3b5a8a', shoes: '#6b4a2a',
    extra(P) {
      box(1.02, 0.95, 0.76, '#ff7a1a', 0, 0.62, 0, P.torso);                          // hi-vis vest
      for (const y of [0.4, 0.8]) box(1.04, 0.08, 0.78, '#e8eef0', 0, y, 0, P.torso);
      box(1.16, 0.3, 1.06, '#ffc928', 0, 1.06, 0, P.head); box(1.26, 0.06, 1.26, '#ffc928', 0, 0.92, 0.04, P.head);
      box(0.2, 0.32, 1.08, '#e6b520', 0, 1.1, 0, P.head);
    } },
  chef: { shirt: '#f4f2ec', pants: '#2c2c30', shoes: '#111114',
    extra(P) {
      for (const y of [0.5, 0.8]) for (const x of [-0.18, 0.18]) box(0.07, 0.07, 0.04, '#2c2c30', x, y, 0.37, P.torso);
      box(1.0, 0.5, 0.06, '#f4f2ec', 0, 0.2, 0.37, P.torso);                          // apron
      box(1.0, 0.2, 0.9, '#f4f2ec', 0, 1.02, 0, P.head); box(0.9, 0.55, 0.8, '#ffffff', 0, 1.35, 0, P.head);   // toque
      box(0.24, 0.14, 0.05, '#c8332b', 0, 1.05, 0.4, P.torso);                        // neckerchief
    } },
  cardigan: { shirt: '#b56a8a', pants: '#6a5a7a', shoes: '#6a4a3a',
    extra(P) {
      box(0.36, 0.9, 0.04, '#f2e6d8', 0, 0.62, 0.37, P.torso);
      for (const y of [0.35, 0.6, 0.85]) box(0.07, 0.07, 0.05, '#f2e6d8', 0.24, y, 0.38, P.torso);
      for (let i = -3; i <= 3; i++) box(0.06, 0.06, 0.06, '#f6f4ef', i * 0.07, 1.03 - Math.abs(i) * 0.03, 0.38, P.torso);   // pearls
      glasses(P, '#b08a3a');
    } },
  dress: { shirt: '#2f8f7a', pants: '#2f8f7a', shoes: '#8a2a3a', skirt: true,
    extra(P) {
      box(1.2, 0.5, 0.86, '#2f8f7a', 0, 0.02, 0, P.torso);                            // skirt flare
      box(0.5, 0.06, 0.05, '#e2b33a', 0, 1.0, 0.37, P.torso);                         // necklace
      box(0.12, 0.12, 0.06, '#e2b33a', 0, 0.93, 0.38, P.torso);
      box(0.4, 0.14, 0.14, '#d8508a', 0.36, 1.0, 0.36, P.head);                       // flower in the fur
    } },
  hoodie: { shirt: '#6a5acd', pants: '#3b4a6a', shoes: '#f0f0f0',
    extra(P) {
      box(1.04, 0.3, 0.76, '#5a4abd', 0, 1.08, -0.06, P.torso);                        // hood bunched at the neck
      box(0.5, 0.3, 0.05, '#5a4abd', 0, 0.3, 0.37, P.torso);                           // pocket
      for (const s of [-1, 1]) box(0.04, 0.3, 0.04, '#f0f0f0', s * 0.12, 0.85, 0.38, P.torso);
    } },
  tracksuit: { shirt: '#d63a3a', pants: '#d63a3a', shoes: '#f0f0f0',
    extra(P) {
      for (const s of [-1, 1]) box(0.05, 1.1, 0.74, '#f6f4ef', s * 0.5, 0.56, 0, P.torso);
      box(0.06, 1.0, 0.04, '#f6f4ef', 0, 0.55, 0.37, P.torso);                        // zip
      box(1.08, 0.12, 0.98, '#f6f4ef', 0, 0.86, 0, P.head);                           // sweatband
    } },
  tourist: { shirt: '#1fa3b5', pants: '#d9c49a', shoes: '#7a5a3a',
    extra(P) {
      for (const [x, y] of [[-0.3, 0.9], [0.25, 0.7], [-0.15, 0.4], [0.32, 0.25], [0.05, 1.0], [-0.35, 0.2]])
        box(0.16, 0.16, 0.04, '#ffd23f', x, y, 0.37, P.torso), box(0.07, 0.07, 0.05, '#e8508a', x, y, 0.38, P.torso);   // loud flowers
      glasses(P, '#141317', true);                                                      // sunglasses
    } },
  overalls: { shirt: '#c8a24a', pants: '#3b5a8a', shoes: '#6b4a2a',
    extra(P) {
      box(0.66, 0.6, 0.05, '#3b5a8a', 0, 0.4, 0.37, P.torso);
      for (const s of [-1, 1]) box(0.12, 0.6, 0.05, '#3b5a8a', s * 0.24, 0.9, 0.37, P.torso);
      box(1.16, 0.14, 1.0, '#c8332b', 0, 0.98, 0, P.head); box(0.6, 0.06, 0.5, '#c8332b', 0, 0.92, 0.6, P.head);   // trucker cap
    } },
};

function glasses(P, color = '#2b2b2f', shades = false) {
  const g = group(0, P.faceOpts.eyeY, P.faceOpts.z + 0.06, P.head);
  for (const s of [-1, 1]) {
    const w = P.faceOpts.eyeW + 0.12;
    if (shades) box(w, w * 0.8, 0.03, '#141317', s * P.faceOpts.eyeX, 0, 0.02, g);
    else { box(w, 0.04, 0.03, color, s * P.faceOpts.eyeX, w / 2, 0, g); box(w, 0.04, 0.03, color, s * P.faceOpts.eyeX, -w / 2, 0, g);
           box(0.04, w, 0.03, color, s * (P.faceOpts.eyeX + w / 2), 0, 0, g); box(0.04, w, 0.03, color, s * (P.faceOpts.eyeX - w / 2), 0, 0, g); }
  }
  box(P.faceOpts.eyeX * 2 - P.faceOpts.eyeW - 0.1, 0.04, 0.03, color, 0, 0.02, 0, g);
}

export const LOOKS = { species: Object.keys(SPECIES), outfits: Object.keys(OUTFITS) };

export function makePrimate(parent, look) {
  const [sp, of] = String(look).split('.');
  const S = SPECIES[sp] || SPECIES.baboon, O = OUTFITS[of] || OUTFITS.suit;
  const root = group(0, 0, 0, parent);
  const legs = [];
  for (const s of [-1, 1]) {                                     // hip + knee pivots, same as the chimp
    const hip = group(s * 0.23, 0.9, 0, root);
    box(0.32, 0.42, 0.36, O.pants, 0, -0.21, 0, hip);
    const knee = group(0, -0.42, 0, hip);
    box(0.32, 0.34, 0.36, O.skirt ? S.fur : O.pants, 0, -0.17, 0, knee);
    box(0.36, 0.14, 0.5, O.shoes, 0, -0.41, 0.06, knee);
    legs.push({ hip, knee });
  }
  const torso = group(0, 0.9, 0, root);
  box(0.98, 1.12, 0.7, O.shirt, 0, 0.56, 0, torso);
  const len = S.armLen;
  const arm = side => {
    const pivot = group(side * 0.62, 1.02, 0, torso);
    box(0.26, len, 0.29, O.shirt, 0, -len / 2, 0, pivot);
    box(0.29, 0.2, 0.31, S.hand, 0, -len - 0.06, 0, pivot);
    return pivot;
  };
  const armR = arm(-1), armL = arm(1);
  const neck = group(0, 1.12, 0, torso);
  const head = group(0, 0, 0, neck);
  const faceOpts = S.head(head, S);
  const f = face(head, faceOpts);
  const P = { torso, neck, head, armR, armL, legs, faceOpts, ...f };
  O.extra(P);
  root.scale.setScalar(S.scale);
  return { root, parts: P, height: 2.6 * S.scale + (of === 'chef' ? 0.5 : 0), look: `${sp}.${of}` };
}

// ---------- automatic casting from the name tag (the role the plan already gives each character) ----------
// First match wins. Episodes can override with an explicit look in the markup (C:smug.point=mandrill.chef).
const ROLES = [
  [/OFFICER|POLICE|COP|SHERIFF|DETECTIVE|TROOPER|RANGER|GUARD/, 'baboon.cop'],
  [/CUSTOMS|BORDER/, 'macaque.customs'],
  [/\bIRS\b|TAX/, 'macaque.irs'],
  [/CONTRACTOR|CREW|BUILDER|TOW|MECHANIC|PLUMBER/, 'bonobo.hardhat'],
  [/GRANDMA|GRANNY|AUNT/, 'capuchin.cardigan'],
  [/WIFE|LINDA|MOM|MOTHER|BRIDE|GIRLFRIEND/, 'bonobo.dress'],
  [/GYM|TRAINER|COACH/, 'gibbon.tracksuit'],
  [/STUDENT|AGE 1\d|TEEN|KID/, 'capuchin.hoodie'],
  [/DEALER|SELLER|SALES/, 'baboon.tourist'],
  [/PHOTOGRAPHER|TOURIST|GUEST/, 'tarsier.tourist'],
  [/NEIGHBOR|FARMER|RANCH/, 'proboscis.overalls'],
  [/CUSTOMER|BUYER|SHOPPER/, 'tarsier.hoodie'],
  [/CHEF|COOK|RESTAURANT|MCDONALD/, 'proboscis.chef'],
  [/SCAMMER|CON MAN|HACKER/, 'gibbon.hoodie'],
  [/BANK|CREDITOR|FINANCE|COMPANY|\bCO\.|CORP|PEPSI|MARVEL|WILEY|INC|LLC|LANDLORD|DIPLOMAT|SUBWAY OWNER|BUSINESSMAN|BOSS/, 'mandrill.suit'],
  [/INFORMANT|STEVE|FRANK|CHAD/, 'macaque.tracksuit', 'P'],     // the everyman's buddy; Gary/Chad as the lead stay chimps
];
// who: 'C' (the everyman, chimp by default) or 'P' (the other party, orangutan by default). null = keep the default model.
export function roleLook(name, who) {
  const n = String(name || '').toUpperCase();
  for (const [re, look, only] of ROLES) if ((!only || only === who) && re.test(n)) return look;
  return null;
}
