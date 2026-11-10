// Sprite diorama: flat pixel sprites standing in a lit 3D miniature set (pixel textures, real shadows,
// golden-hour sun, fog, bloom, tilt-shift band, vignette). Everything is drawn in code.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { HorizontalTiltShiftShader } from 'three/addons/shaders/HorizontalTiltShiftShader.js';
import { VerticalTiltShiftShader } from 'three/addons/shaders/VerticalTiltShiftShader.js';
import { VignetteShader } from 'three/addons/shaders/VignetteShader.js';
import { Pix, hex, ramp, larry, gary, chad, sign } from './px.js';

const W = 1080, H = 1920, M = 1 / 30;            // one sprite pixel = 1/30 m
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
let seed = 9; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

function tex(P, repeat = 1) {
  const t = new THREE.CanvasTexture(P.canvas()); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); return t;
}
function noiseTile(r, n = 32, p = [0.15, 0.85]) { const P = new Pix(n, n); for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const v = rnd(); P.set(x, y, r[v < p[0] ? 0 : v > p[1] ? 2 : 1]); } return P; }

function sprite(scene, P, x, z, castShadow = true) {           // billboard standing on the ground, lit by the scene
  const t = tex(P), w = P.w * M, h = P.h * M;
  const mat = new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, h / 2, z);
  m.castShadow = castShadow; m.receiveShadow = false;
  m.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: t, alphaTest: 0.5 });
  scene.add(m); return m;
}

function pineSprite(h = 60) {
  const P = new Pix(40, h + 6), pine = ramp(['#16351f', '#24502e', '#3a7a44']);
  for (let j = 0; j < h; j++) { const half = Math.floor((j % (h / 3 | 0)) * 0.55 + j * 0.2) + 1; for (let i = -half; i <= half; i++) P.set(20 + i, j, pine[i < -half / 3 ? 2 : i > half / 3 ? 0 : 1]); }
  P.rect(19, h, 3, 6, hex('#4a3020')); P.outline(hex('#0d1c12')); return P;
}
function mountains() {
  const w = 240, h = 90, P = new Pix(w, h), mt = ramp(['#56698a', '#7389ab', '#97abc6']), snow = ramp(['#c9d4e2', '#eef3f8', '#ffffff']);
  for (const [px_, py, s] of [[40, 10, 1], [130, 0, 1.3], [210, 18, 0.9]]) for (let y = py; y < h; y++) { const half = (y - py) * s * 0.9; for (let x = Math.round(px_ - half); x <= px_ + half; x++) P.set(x, y, y - py < 12 + (x * 7) % 4 ? snow[x < px_ ? 2 : 1] : mt[x < px_ - half * 0.3 ? 2 : x > px_ + half * 0.4 ? 0 : 1]); }
  return P;
}
function steamPuff() { const P = new Pix(16, 12); P.ellipse(8, 6, 7, 5, hex('#f4f7f9')); P.ellipse(6, 5, 4, 3, hex('#ffffff')); return P; }

export async function diorama(name) {
  seed = 9;
  const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(W, H); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
  const scene = new THREE.Scene();
  const bg = new Pix(1, 64); const sky = ramp(['#f2b880', '#d9a6a0', '#8fb3d9', '#4f86c4']);
  for (let y = 0; y < 64; y++) bg.set(0, y, sky[3 - Math.min(3, Math.floor(y / 64 * 4))]);
  scene.background = new THREE.Color('#8fc0ea');
  scene.fog = new THREE.Fog('#d8d2c4', 26, 60);
  const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 200); camera.position.set(0, 10.5, 17); camera.lookAt(0, 1.6, -1.5);

  // light rig: low golden sun throwing long shadows toward the camera, cool sky fill, warm bounce from the spring
  scene.add(new THREE.HemisphereLight('#9cc4ff', '#5a4630', 0.9));
  const sun = new THREE.DirectionalLight('#ffbf78', 3.2); sun.position.set(-8, 7, 7); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 40 }); sun.shadow.bias = -0.0005;
  scene.add(sun);
  const springLight = new THREE.PointLight('#7fe6ff', 6, 6, 1.5); springLight.position.set(3.2, 0.6, -1.0); scene.add(springLight);

  // ground: meadow with an ochre geyser basin, pixel textures at one texel density
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ map: tex(noiseTile(ramp(['#4f7a32', '#679a3e', '#86b552'])), 40), roughness: 1 }));
  grass.rotation.x = -Math.PI / 2; grass.receiveShadow = true; scene.add(grass);
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 6.8, 0.12, 48), new THREE.MeshStandardMaterial({ map: tex(noiseTile(ramp(['#9a7240', '#c09a62', '#dcbc84'])), 6), roughness: 1 }));
  basin.position.set(0, 0.06, 0.8); basin.scale.z = 0.7; basin.receiveShadow = true; scene.add(basin);
  const disc = (r, c, y, e = 0) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.04, 40), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: e, roughness: 0.25 })); m.position.set(3.2, y, -1.0); m.scale.z = 0.55; m.receiveShadow = true; scene.add(m); };
  disc(1.6, '#e39a3a', 0.13); disc(1.25, '#3fb0b8', 0.15, 0.25); disc(0.65, '#1f6fb0', 0.17, 0.35);
  for (let k = 0; k < 8; k++) { const s = sprite(scene, steamPuff(), 3.2 + Math.sin(k * 1.7) * 0.3, -1.0 - k * 0.05, false); s.position.y = 0.5 + k * 0.45; s.scale.setScalar(1 + k * 0.25); s.material.transparent = true; s.material.opacity = 0.75 - k * 0.07; s.material.alphaTest = 0.1; s.material.depthWrite = false; }

  // pines around the set, a mountain backdrop far behind
  const trees = [[-5.5, -3.5, 70], [-3.6, -5.2, 80], [-1.2, -6.4, 64], [1.6, -6.8, 84], [5.6, -4.2, 76], [7.2, -6.6, 90], [-7.4, -6.6, 88], [-6.6, 1.2, 60], [6.8, 0.6, 66], [4.0, -8.5, 70], [-4.2, -9.0, 74]];
  for (let i = 0; i < 26; i++) trees.push([-13 + i + (i % 3) * 0.4, -11 - (i % 4) * 1.3, 70 + (i * 37) % 40]);   // treeline behind the basin
  for (const [x, z, h] of trees) sprite(scene, pineSprite(h), x, z);
  const mt = new THREE.Mesh(new THREE.PlaneGeometry(64, 24), new THREE.MeshBasicMaterial({ map: tex(mountains()), alphaTest: 0.5, fog: true }));
  mt.position.set(0, 9, -24); scene.add(mt);
  for (const m of scene.children) if (m.isMesh && m.geometry.type === 'PlaneGeometry' && m !== grass) m.lookAt(camera.position.x, m.position.y, camera.position.z);

  // cast
  const tags = [], heads = [];
  if (name === 'opening') { const g = sprite(scene, gary('wave'), -1.5, 1.6), c = sprite(scene, chad(), 1.5, 1.6); heads.push(['GARY', g], ['CHAD', c]); }
  else { sprite(scene, larry('pointing'), -1.6, 1.6); sprite(scene, sign(['ELIGIBLE', 'JURORS: 0'], 'people'), 1.7, 1.2); }
  for (const m of scene.children) if (m.isMesh && m.geometry.type === 'PlaneGeometry' && m !== grass && m !== mt) m.lookAt(camera.position.x, m.position.y, camera.position.z);

  // post: bloom, tilt-shift band through the cast, vignette
  const composer = new EffectComposer(renderer); composer.setPixelRatio(1); composer.setSize(W, H);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), 0.45, 0.6, 0.82));
  const h = new ShaderPass(HorizontalTiltShiftShader), v = new ShaderPass(VerticalTiltShiftShader);
  h.uniforms.h.value = 3.2 / W; v.uniforms.v.value = 3.2 / H; h.uniforms.r.value = v.uniforms.r.value = 0.56;
  composer.addPass(h); composer.addPass(v);
  const vig = new ShaderPass(VignetteShader); vig.uniforms.offset.value = 1.0; vig.uniforms.darkness.value = 0.9; composer.addPass(vig);
  composer.addPass(new OutputPass());
  composer.render();

  for (const [t, m] of heads) { const p = new THREE.Vector3(m.position.x, m.position.y * 2 + 0.35, m.position.z).project(camera); tags.push([t, (p.x + 1) / 2 * W, (1 - p.y) / 2 * H]); }
  return { canvas: renderer.domElement, tags };
}
