// Pixel RPG renderer: same contract as world.js (window.setupTimeline(tl), window.renderAt(t, frame)), so render3d.mjs
// and render_video.py drive it unchanged. Internal picture 180x320, shown 6x with hard pixels; camera moves
// (slow push, punch-ins, whip pans, tilts; no shakes) happen on the scaled image. Idle life everywhere: characters
// breathe (upper body one pixel, feet planted), blink and fidget, Larry's tail sways, the sets move (see sets.js).
import { larry, primate, sign, iconFor, LARRY_W, LARRY_H } from './kit.js';
import { getSet, painter, toCanvas, PW, PH, FEET } from './sets.js';

const W = 1080, H = 1920, S = W / PW;
const out = document.getElementById('c'), g = out.getContext('2d');
const work = document.createElement('canvas'); work.width = PW; work.height = PH; const wg = work.getContext('2d');
let TL = null; const cache = new Map();
const spr = (key, make) => { if (!cache.has(key)) cache.set(key, make().canvas()); return cache.get(key); };
const D = painter(wg);
// idle state for one character (k = a per-character offset so they don't move in sync)
const idle = (t, k) => ({ breath: Math.sin(t * 2 * Math.PI / 3.2 + k * 1.9) > 0.15 ? 1 : 0, blink: ((t + k * 1.37) % 4.1) < 0.13,
                          sway: Math.sin(t * 1.1 + k * 2.3) > 0.55 ? 1 : 0 });
const mouthLevel = frame => TL.mouthlvl ? (TL.mouthlvl[frame] || 0) : (TL.mouth && TL.mouth[frame] ? 2 : 0);

const ROLES = [[/OFFICER|POLICE|COP|SHERIFF|DETECTIVE|TROOPER|RANGER|GUARD/, 'baboon.cop'], [/CUSTOMS/, 'macaque.cop'], [/IRS|TAX/, 'macaque.irs'],
  [/WIFE|LINDA|MOM|GRANDMA/, 'bonobo.dress'], [/STUDENT|AGE 1/, 'capuchin.hoodie'], [/BANK|COMPANY|DAIRY|CORP|INC|MARVEL|PEPSI|FORD/, 'mandrill.suit'],
  [/INFORMANT|STEVE|FRANK|CHAD/, 'macaque.tracksuit']];
const OUTFIT = { cop: 'cop', customs: 'cop', suit: 'suit', irs: 'irs', dress: 'dress', cardigan: 'dress', hoodie: 'hoodie', tracksuit: 'tracksuit',
  chef: 'suit', hardhat: 'hoodie', tourist: 'plaid', overalls: 'plaid' };
function lookOf(c) {
  if (c.id.startsWith('char-judge')) return ['gorilla', 'robe'];
  if (c.look) { const [sp, of] = c.look.split('.'); return [sp, OUTFIT[of] || 'suit']; }
  if (c.id === 'char-friend-chimp') return ['chimp', 'plaid'];
  const name = (c.name || '').toUpperCase();
  for (const [re, l] of ROLES) if (re.test(name)) { const [sp, of] = l.split('.'); return [sp, of]; }
  return ['orangutan', 'suit'];
}
const autoPose = t => { let p = 'explaining'; for (const [a, q] of TL.poses || []) if (a <= t + 0.05) p = q; return p; };
const sceneAt = t => { let s = TL.scenes[0]; for (const x of TL.scenes) if (x.t <= t + 1e-6) s = x; return s; };

function zoomAmount(sc, t) {
  let best = 1;
  for (const z of sc.zooms || []) { const age = t - z.t, hold = z.hold ?? 0.9, amt = z.amount ?? 1.18;
    if (age >= 0 && age < hold + 0.25) best = Math.max(best, 1 + (amt - 1) * (age < hold ? Math.min(1, age / 0.08) : Math.max(0, 1 - (age - hold) / 0.25))); }
  return best;
}

function tag(text, x, y) {
  g.font = '800 40px "Arial Rounded MT Bold", "Arial Black", sans-serif'; const w = g.measureText(text).width + 44;
  g.fillStyle = '#fff'; g.strokeStyle = '#141018'; g.lineWidth = 5; g.beginPath(); g.roundRect(x - w / 2, y - 36, w, 62, 20); g.fill(); g.stroke();
  g.fillStyle = '#141018'; g.textAlign = 'center'; g.fillText(text, x, y + 9);
}

window.setupTimeline = tl => { TL = tl; TL.frames ||= Math.ceil(tl.dur * tl.fps); return true; };

window.renderAt = (t, frame) => {
  const sc = sceneAt(t), set = getSet(sc.bg), si = TL.scenes.indexOf(sc), age = t - sc.t, sdur = Math.max(0.5, (sc.end ?? t + 1) - sc.t);
  wg.clearRect(0, 0, PW, PH);
  for (const layer of set.layers) typeof layer === 'function' ? layer(D, t) : D.img(layer, 0, 0);
  const cast = sc.cast || [], signs = (sc.items || []).filter(it => it.id === 'sign' && t >= it.t - 0.01 && t < (it.end ?? 1e9));
  const tags = []; let focus = [PW / 2, FEET - 60];
  const others = cast.filter(c => !c.id.startsWith('larry') && !c.id.startsWith('char-judge')), judge = cast.find(c => c.id.startsWith('char-judge'));
  const L = cast.find(c => c.id.startsWith('larry'));
  // judge behind the bench (courtroom), then the bench in front
  if (judge) {
    const [sp, of] = lookOf(judge), id = idle(t, 7), key = `p|${sp}|${of}|${judge.face}|${judge.gest}|${id.breath}|${id.blink}|${id.sway}`,
      im = spr(key, () => primate({ species: sp, outfit: of, face: judge.face, gest: judge.gest, ...id }));
    const jx = set.judgeX ?? 130, jy = (set.judgeY ?? FEET) - 82; wg.drawImage(im, jx - 32, jy); tags.push([judge.name || 'JUDGE', jx, jy + 6]);
  }
  if (set.F) D.img(set.F, 0, 0);
  // the rest of the cast, left to right by their x
  const slots = others.length === 1 ? [judge ? 46 : 70] : others.length === 2 ? [judge ? 34 : 50, judge ? 74 : 128] : [32, 90, 148];
  others.forEach((c, i) => {
    const [sp, of] = lookOf(c), id = idle(t, i + 1), im = spr(`p|${sp}|${of}|${c.face}|${c.gest}|${id.breath}|${id.blink}|${id.sway}`, () => primate({ species: sp, outfit: of, face: c.face, gest: c.gest, ...id }));
    const x = judge ? slots[i] : (c.x != null && others.length > 1 ? Math.round(c.x * PW) : slots[i]);
    wg.drawImage(im, x - 32, FEET - 82); if (c.name) tags.push([c.name, x, FEET - 82 + 4]);
  });
  if (L) {
    const pose = L.id === 'larry:auto' || L.id === 'larry' ? autoPose(t) : L.id.slice(6);
    const id = idle(t, 0), mouth = mouthLevel(frame), tail = Math.round(Math.sin(t * 1.25) * 4), ear = ((t + 1.3) % 5.3) < 0.18 ? 2 : 0;
    const im = spr(`L|${pose}|${mouth}|${id.blink}|${id.breath}|${tail}|${ear}`, () => larry(pose, { mouth, blink: id.blink, breath: id.breath, tail, ear }));
    const lx = signs.length ? 46 : 90; wg.drawImage(im, lx - 40, FEET - LARRY_H + 2); focus = [lx, FEET - 70];
  }
  for (const it of signs) { const im = spr(`s|${it.icon}|${it.text}`, () => sign(it.text || '', iconFor(it.icon))); wg.drawImage(im, Math.round(Math.min(PW - im.width - 14, 124 - im.width / 2)), FEET - im.height + 3); }

  // camera on the scaled picture
  const z = zoomAmount(sc, t) * (sc.loop ? 1 : 1 + 0.045 * Math.min(1, age / sdur));
  let dx = 0, dy = 0, roll = 0;
  if (si > 0 && !sc.loop && age < 0.24) { const q = 1 - age / 0.24; dx = (si % 2 ? 1 : -1) * 420 * q * q; }      // whip pan in
  for (const tl of TL.tilts || []) { const a = t - tl.t; if (a < 0 || a > 1.1) continue; roll += (tl.dir || 1) * 0.05 * (a < 0.12 ? a / 0.12 : a < 0.85 ? 1 : Math.max(0, 1 - (a - 0.85) / 0.25)); }
  const zz = zoomAmount(sc, t), fx = (zz > 1.001 ? focus[0] : PW / 2) * S, fy = (zz > 1.001 ? focus[1] : FEET) * S;
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  g.translate(fx + dx, fy + dy); g.rotate(roll); g.scale(z, z); g.translate(-fx, -fy);
  g.imageSmoothingEnabled = false; g.drawImage(work, 0, 0, W, H);
  for (const [text, x, y] of tags) tag(text, x * S, y * S - 8);
  g.setTransform(1, 0, 0, 1, 0, 0);
};

document.fonts.ready.then(() => { window.worldReady = true; });
