// Render styles for the 3D world. Picked once per video from the timeline ("style", from brand.json or LLD_STYLE):
//   classic  — the original look (bright, even light)
//   toon     — cel shading: 3-step toon materials + black outlines
//   diorama  — miniature toy set: warm low sun, cool rim light, glossier plastic, tilt-shift blur, vignette
//   cinematic — the realistic look: soft rounded edges, image-based lighting, fine surface grain, ambient occlusion,
//              soft warm sun + cool sky, gentle bloom, shallow depth of field, filmic grade (AO optional)
//   noir     — night: dark sky, cool moonlight, one warm spotlight, graded and vignetted
// Everything is free (Three.js addons) and runs in the same headless renderer.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { HorizontalTiltShiftShader } from 'three/addons/shaders/HorizontalTiltShiftShader.js';
import { VerticalTiltShiftShader } from 'three/addons/shaders/VerticalTiltShiftShader.js';
import { VignetteShader } from 'three/addons/shaders/VignetteShader.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const GRADE = {                                   // desaturate + contrast, applied before the vignette
  uniforms: { tDiffuse: { value: null }, sat: { value: 1.0 }, contrast: { value: 1.0 }, tint: { value: new THREE.Color(1, 1, 1) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float sat, contrast; uniform vec3 tint; varying vec2 vUv;
    void main(){ vec4 c = texture2D(tDiffuse, vUv); float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      vec3 g = mix(vec3(l), c.rgb, sat); g = (g - 0.5) * contrast + 0.5; gl_FragColor = vec4(g * tint, c.a); }`,
};

function gradientTex(top, bottom) {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256;
  const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, top); gr.addColorStop(1, bottom); g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function grainTex() {                            // fine fur/fabric grain for bump + roughness
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'), img = g.createImageData(256, 256);
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 256 * 256; i++) { const v = 150 + rnd() * 90 - ((i >> 8) % 3 === 0 ? 20 : 0); img.data.set([v, v, v, 255], i * 4); }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

export function makeStyler({ renderer, scene, camera, hemi, amb, sun, W, H }) {
  let name = 'classic', composer = null, extra = [], noirBg = null, noirFog = null;
  const toonMats = new Map(), outlineMat = new THREE.MeshBasicMaterial({ color: 0x15141a, side: THREE.BackSide });
  let grad = null, grain = null; const roundCache = {};

  function toonOf(m) {
    const key = m.color.getHex() + (m.map ? m.map.uuid : '');
    if (!toonMats.has(key)) toonMats.set(key, new THREE.MeshToonMaterial({ color: m.color, map: m.map || null, gradientMap: grad }));
    return toonMats.get(key);
  }

  // style every mesh not seen yet (characters and props are built lazily, so this runs before each frame)
  function prepare() {
    if (name === 'classic') return;
    const todo = [];
    scene.traverse(o => { if (o.isMesh && !o.userData.styled && !o.userData.outline) todo.push(o); });
    for (const o of todo) {
      o.userData.styled = true;
      const m = o.material;
      if (!m || !m.isMeshStandardMaterial) continue;
      const special = m.transparent || (m.emissiveIntensity > 0 && m.emissive && m.emissive.getHex() !== 0);
      if (name === 'toon') {
        if (!special) o.material = toonOf(m);
        const p = o.geometry && o.geometry.parameters;
        if (o.castShadow && o.geometry.type === 'BoxGeometry' && p) {           // inverted-hull outline, constant thickness
          const t = 0.028, line = new THREE.Mesh(o.geometry, outlineMat);
          line.scale.set(1 + 2 * t / p.width, 1 + 2 * t / p.height, 1 + 2 * t / p.depth);
          line.userData.outline = true; line.castShadow = false; line.receiveShadow = false; o.add(line);
        }
      } else if (name === 'cinematic') {
        const p = o.geometry && o.geometry.parameters;
        if (o.geometry.type === 'BoxGeometry' && p && !m.map && !Array.isArray(o.material)) {   // soften every edge
          const r = Math.min(0.07, Math.min(p.width, p.height, p.depth) * 0.22);
          const key = `${p.width}|${p.height}|${p.depth}`;
          o.geometry = roundCache[key] ||= new RoundedBoxGeometry(p.width, p.height, p.depth, 2, r);
        }
        if (!special && !m.map && !m.userData.cine) {
          m.userData.cine = true; m.bumpMap = grain; m.bumpScale = 0.9; m.roughnessMap = grain;
          m.roughness = Math.min(1, m.roughness * 0.95); m.needsUpdate = true;
        }
      } else if (name === 'diorama' && !special && !m.userData.dio) {
        m.userData.dio = true; m.roughness = Math.min(m.roughness, 0.55);     // painted-plastic sheen
      }
    }
  }

  function set(n, off = [], on = []) {            // off/on: passes to skip or force, e.g. ['dof'] / ['ao'] (debugging)
    name = ['toon', 'diorama', 'noir', 'cinematic'].includes(n) ? n : 'classic';
    if (name === 'classic') return;
    if (name === 'toon') {
      grad = new THREE.DataTexture(new Uint8Array([90, 170, 255]), 3, 1, THREE.RedFormat);
      grad.minFilter = grad.magFilter = THREE.NearestFilter; grad.needsUpdate = true;
      hemi.intensity = 1.25; amb.intensity = 0.25; sun.intensity = 2.6;
      return;
    }
    // Edge smoothing: 4x MSAA is ~5x slower in software WebGL (the cloud runners), so the default is one SMAA pass at the end.
    // on: ['msaa'] brings MSAA back; on: ['dof'] the depth-of-field blur (it re-renders the whole scene every frame).
    const msaa = on.includes('msaa');
    const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: msaa ? 4 : 0 });
    composer = new EffectComposer(renderer, rt);
    composer.setPixelRatio(1); composer.setSize(W, H);
    composer.addPass(new RenderPass(scene, camera));
    if (name === 'cinematic') {
      grain = grainTex();
      renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.82;
      const pm = new THREE.PMREMGenerator(renderer);
      scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;            // soft image-based light
      scene.environmentIntensity = 0.4;
      hemi.color.set('#cfe0ff'); hemi.groundColor.set('#7a6650'); hemi.intensity = 0.55; amb.intensity = 0.0;
      sun.color.set('#ffe2bd'); sun.intensity = 2.6; sun.position.set(-5, 8, 7);
      sun.shadow.mapSize.set(4096, 4096); sun.shadow.radius = 4; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
      const fill = new THREE.DirectionalLight('#a9c8ff', 0.6); fill.position.set(6, 3, 5); scene.add(fill); extra.push(fill);
      const rim = new THREE.DirectionalLight('#fff1dc', 1.4); rim.position.set(2, 6, -9); scene.add(rim); extra.push(rim);
      if (on.includes('ao')) {                     // off by default: GTAO leaves a dark box artifact in the courtroom
        const ao = new GTAOPass(scene, camera, W, H);
        ao.updateGtaoMaterial({ radius: 0.45, distanceExponent: 1.5, thickness: 1.0, scale: 1.0, samples: 16 });
        ao.blendIntensity = 0.9; composer.addPass(ao);
      }
      if (!off.includes('bloom')) composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), 0.08, 0.4, 1.0));
      if (on.includes('dof') && !off.includes('dof'))   // background softens a little; off by default (render time)
        composer.addPass(new BokehPass(scene, camera, { focus: 15.0, aperture: 0.0009, maxblur: 0.006 }));
      const g = new ShaderPass(GRADE); g.uniforms.sat.value = 1.12; g.uniforms.contrast.value = 1.08; g.uniforms.tint.value.set(1.02, 1.0, 0.97);
      composer.addPass(g);
      const vig = new ShaderPass(VignetteShader); vig.uniforms.offset.value = 1.0; vig.uniforms.darkness.value = 0.55; composer.addPass(vig);
    } else if (name === 'diorama') {
      renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.3;
      hemi.color.set('#bcd4ff'); hemi.groundColor.set('#8a6a4a'); hemi.intensity = 1.0; amb.intensity = 0.15;
      sun.color.set('#ffd09a'); sun.intensity = 3.4; sun.position.set(-7, 5.5, 6);        // low warm sun from the left
      const rim = new THREE.DirectionalLight('#9fd0ff', 1.6); rim.position.set(4, 7, -8); scene.add(rim); extra.push(rim);
      const h = new ShaderPass(HorizontalTiltShiftShader), v = new ShaderPass(VerticalTiltShiftShader);
      h.uniforms.h.value = 7 / W; v.uniforms.v.value = 7 / H; h.uniforms.r.value = v.uniforms.r.value = 0.5;
      composer.addPass(h); composer.addPass(v);
      const vig = new ShaderPass(VignetteShader); vig.uniforms.offset.value = 1.0; vig.uniforms.darkness.value = 0.75;   // darkness must stay <= 1 (above it colours go negative) composer.addPass(vig);
    } else {                                                                              // noir
      renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
      noirBg = gradientTex('#070b16', '#26304a'); noirFog = new THREE.Fog('#0b1020', 26, 70);
      hemi.color.set('#4a5a8a'); hemi.groundColor.set('#0a0a12'); hemi.intensity = 0.7; amb.intensity = 0.1;
      sun.color.set('#8fb0ff'); sun.intensity = 1.3; sun.shadow.bias = -0.0006; sun.position.set(6, 9, -4);         // cool moonlight from behind
      const spot = new THREE.SpotLight('#ffb46a', 260, 40, 0.42, 0.45, 1.6);
      spot.position.set(-5, 9, 8); spot.target.position.set(0, 1.6, 0);
      spot.castShadow = true; spot.shadow.mapSize.set(2048, 2048); spot.shadow.radius = 3; spot.shadow.bias = -0.0006; spot.shadow.normalBias = 0.02;
      scene.add(spot, spot.target); extra.push(spot);
      const g = new ShaderPass(GRADE); g.uniforms.sat.value = 0.55; g.uniforms.contrast.value = 1.18; g.uniforms.tint.value.set(0.96, 0.98, 1.06);
      composer.addPass(g);
      const vig = new ShaderPass(VignetteShader); vig.uniforms.offset.value = 1.25; vig.uniforms.darkness.value = 0.95; composer.addPass(vig);
    }
    composer.addPass(new OutputPass());
    if (!msaa) composer.addPass(new SMAAPass(W, H));
  }

  // after the set's sky/fog is applied each frame: noir swaps in its own night sky
  function afterEnv() { if (name === 'noir') { scene.background = noirBg; scene.fog = noirFog; } }
  function render() { prepare(); if (composer) composer.render(); else renderer.render(scene, camera); }
  return { set, afterEnv, render, get name() { return name; } };
}
