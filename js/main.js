import { Bottle, PARTS } from './bottle.js';
import { samplePoints } from './mesh.js';
import { themeAt, applyCss, LIQ_COLD, LIQ_WARM } from './theme.js';
import { fontsReady, labelCanvas, wordsCanvas } from './textures.js';
import { scene } from './scenes.js';
import { FX } from './fx.js';
import { initShop } from './shop.js';
import { Slosh } from './slosh.js';

const cl = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ss = (a, b, x) => { const t = cl((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const root = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const TAU = Math.PI * 2;

const shop = initShop();
const slosh = new Slosh(reduced);

const sections = $$('[data-scene]').map((el) => ({
  el, name: el.dataset.scene, pin: el.classList.contains('pin'),
  caps: $$('.cap', el).map((c) => ({ el: c, at: +c.dataset.at, until: c.dataset.until ? +c.dataset.until : null })),
}));

const glCanvas = $('#gl');
let bottle = null;
try { bottle = new Bottle(glCanvas); root.classList.add('gl'); } catch (e) { console.warn('WebGL2 unavailable', e); bottle = null; }

const mobileQ = matchMedia('(max-width: 860px)');
let W = 0, H = 0, mobile = false;
let q = 1; // render scale relative to devicePixelRatio (capped at 2)
const fx = new FX($('#trail'), $('#fx'), { mobile: mobileQ.matches, reduced });

function measure() {
  W = glCanvas.clientWidth || innerWidth;
  H = glCanvas.clientHeight || innerHeight;
  mobile = mobileQ.matches;
  if (bottle) bottle.resize(W, H, Math.min(devicePixelRatio || 1, 2) * q);
  fx.resize(W, H, Math.min(devicePixelRatio || 1, mobile ? 1.5 : 1.25));
}

function activeSection() {
  let cur = sections[0];
  for (const s of sections) if (s.el.getBoundingClientRect().top <= innerHeight * 0.5) cur = s;
  return cur;
}
function progressOf(s) {
  const r = s.el.getBoundingClientRect();
  if (s.name === 'hero') return cl(-r.top / Math.max(1, r.height));
  if (s.pin) return cl(-r.top / Math.max(1, r.height - innerHeight));
  return cl(1 - r.top / innerHeight);
}

// ---------- eased state ----------
const cur = {};
let idleYaw = 0;
function approach(tgt, a) {
  for (const k in tgt) {
    const v = tgt[k];
    if (typeof v === 'number') cur[k] = cur[k] === undefined ? v : cur[k] + (v - cur[k]) * a;
    else if (Array.isArray(v)) {
      if (!cur[k]) cur[k] = v.slice();
      for (let i = 0; i < v.length; i++) cur[k][i] += (v[i] - cur[k][i]) * a;
    }
  }
}

// ---------- DOM driven by the scene ----------
const tagsLayer = $('#tagLines');
const parts = $$('.parts li');
const partY = { cap: (e) => PARTS.capP(e, 0)[1], act: (e) => PARTS.actY(e), stem: (e) => PARTS.stemY(e), collar: (e) => PARTS.collarY(e), glass: (e) => 0.15 + PARTS.bodyY(e) };
const partSide = { cap: 1, stem: 1, glass: 1, act: -1, collar: -1 };
tagsLayer.innerHTML = parts.map(() => '<line x1="0" y1="0" x2="0" y2="0"/><circle r="3" cx="-20" cy="-20"/>').join('');
const tagEls = [...tagsLayer.children];
$('.ring__ticks').innerHTML = Array.from({ length: 72 }, (_, i) => { const a = (i / 72) * TAU; const r0 = i % 18 === 0 ? 172 : i % 2 ? 184 : 180; return `<line x1="${(200 + Math.sin(a) * r0).toFixed(1)}" y1="${(200 - Math.cos(a) * r0).toFixed(1)}" x2="${(200 + Math.sin(a) * 190).toFixed(1)}" y2="${(200 - Math.cos(a) * 190).toFixed(1)}"/>`; }).join('');
const motto = $('[data-motto]');
const deepLayers = $$('.deep__layer');
const degText = $('[data-spin-deg]');

function updateUI(sec, p, tg, S) {
  for (const s of sections) {
    if (!s.caps.length) continue;
    let latest = null;
    if (s === sec) for (const c of s.caps) if (c.until === null && p >= c.at) latest = c;
    for (const c of s.caps) {
      const on = s === sec && (c.until === null ? c === latest : p >= c.at && p < c.until);
      c.el.classList.toggle('is-on', on);
    }
  }
  const ui = tg.ui || {};
  root.style.setProperty('--deg-o', sec.name === 'spin' ? ui.degO.toFixed(2) : '0');
  if (sec.name === 'spin') degText.textContent = `${ui.deg}°`;
  if (sec.name === 'xezri') {
    const d = ui.depth, c = LIQ_COLD, mid = d < 0.5 ? c[2].map((v, i) => v + (c[1][i] - v) * ss(0.17, 0.5, d)) : c[1].map((v, i) => v + (c[0][i] - v) * ss(0.5, 0.83, d));
    const luma = 0.3 * mid[0] + 0.59 * mid[1] + 0.11 * mid[2];
    root.style.setProperty('--deep-ink', luma > 0.52 ? '#0c1e26' : '#f2fbfc');
  }
  if (sec.name === 'xezri') deepLayers.forEach((el) => { const L = ui.layers[+el.dataset.layer]; el.style.setProperty('--o', L.o.toFixed(3)); el.style.setProperty('--dy', `${L.dy.toFixed(1)}px`); });
  else deepLayers.forEach((el) => el.style.setProperty('--o', '0'));
  root.style.setProperty('--ring-o', sec.name === 'wind' ? ui.ring.toFixed(3) : '0');
  if (sec.name === 'wind') root.style.setProperty('--needle', `${ui.needle.toFixed(1)}deg`);
  motto.classList.toggle('is-on', sec.name === 'spray' && !!ui.motto);
  const e = cur.explode;
  const show = sec.name === 'explode' && e > 0.5 && bottle;
  parts.forEach((li, i) => {
    const on = show && ui.tagP > 0.4 + i * 0.05;
    li.classList.toggle('is-on', !!on);
    tagEls[i * 2].style.opacity = on ? 1 : 0;
    tagEls[i * 2 + 1].style.opacity = on ? 1 : 0;
  });
  if (show) layoutTags(S, e);
}

function layoutTags(S, e) {
  const c0 = bottle.project(S, [0, 0, 0]);
  const c1 = bottle.project(S, [0, 1, 0]);
  const unit = Math.abs(c1[1] - c0[1]);
  const items = parts.map((li) => {
    const k = li.dataset.part;
    const a = bottle.project(S, [0, partY[k](e), 0]);
    return { li, ax: a[0], ay: a[1], side: mobile ? 1 : partSide[k], h: li.offsetHeight || 28, w: li.offsetWidth || 120 };
  });
  for (const side of [1, -1]) {
    const col = items.filter((it) => it.side === side).sort((a, b) => a.ay - b.ay);
    let y = 76;
    for (const it of col) { it.y = Math.max(it.ay - it.h / 2, y); y = it.y + it.h + 12; }
    const over = y - 12 - (H - 30);
    if (over > 0) col.forEach((it) => (it.y -= over));
  }
  items.forEach((it, i) => {
    const gap = mobile ? 0.45 * unit + 20 : 0.7 * unit + 70;
    let x = it.side > 0 ? c0[0] + gap : c0[0] - gap - it.w;
    if (mobile) x = Math.min(x, W - 12 - it.w);
    it.li.style.transform = `translate(${x.toFixed(1)}px, ${it.y.toFixed(1)}px)`;
    const lx = it.side > 0 ? x - 10 : x + it.w + 10;
    const ly = it.y + it.h / 2;
    const line = tagEls[i * 2], dot = tagEls[i * 2 + 1];
    line.setAttribute('x1', it.ax.toFixed(1)); line.setAttribute('y1', it.ay.toFixed(1));
    line.setAttribute('x2', lx.toFixed(1)); line.setAttribute('y2', ly.toFixed(1));
    dot.setAttribute('cx', it.ax.toFixed(1)); dot.setAttribute('cy', it.ay.toFixed(1));
  });
}

// ---------- intro ----------
let introT = reduced ? 1 : 0;
const qs = new URLSearchParams(location.search);
const frozenIntro = qs.has('intro'); // QA: freeze the intro at a moment
if (frozenIntro) introT = +qs.get('intro');
let introPts = null;
function introPoints() {
  if (!bottle) return null;
  const n = mobile ? 520 : 1100;
  const body = samplePoints(bottle.M.body.data, Math.round(n * 0.78), 3);
  const cap = samplePoints(bottle.M.cap.data, Math.round(n * 0.22), 7).map((p) => [p[0], p[1] + PARTS.capP(0, 0)[1], p[2]]);
  return body.concat(cap);
}

// ---------- adaptive resolution (only for very slow devices) ----------
let frames = 0, acc = 0;
function adapt(dt) {
  if (!bottle) return;
  frames++; acc += dt;
  if (frames < 60) return;
  const avg = (acc / frames) * 1000;
  frames = 0; acc = 0;
  window.__kulek = { q, avg: Math.round(avg * 10) / 10, px: [glCanvas.width, glCanvas.height] };
  if (avg > 30 && q > 0.6) { q = Math.max(0.6, q - 0.15); measure(); }
}

// ---------- loop ----------
let last = performance.now(), t = 0;
let keepSec = null, keepTick = 0;
function keepOut(sec) {
  const pad = 14;
  return $$('.cap.is-on, .hero__line, .hero__sub', sec.el).map((el) => el.getBoundingClientRect())
    .filter((b) => b.width && b.height)
    .map((b) => ({ l: b.left - pad, t: b.top - pad, r: b.right + pad, b: b.bottom + pad }));
}

function frame(now) {
  const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
  last = now; t += dt;
  if (introT < 1 && !frozenIntro) {
    introT = Math.min(1, introT + dt / (scrollY > 30 ? 0.8 : 3.4));
    if (introT > 0.78 && !root.classList.contains('intro-done')) root.classList.add('intro-done');
  }
  const sec = activeSection();
  const p = progressOf(sec);
  const tg = scene(sec.name, p, { mobile, aspect: W / H, pick: shop.pick, volScale: shop.volScale });
  if (!reduced) idleYaw += tg.idle * dt;
  let yawT = tg.yaw + (tg.idle > 0 ? idleYaw : 0);
  if (cur.yaw !== undefined) yawT += TAU * Math.round((cur.yaw - yawT) / TAU);
  const a = reduced ? 1 : 1 - Math.exp(-dt * 6);
  approach({ ...tg, yaw: yawT, ui: undefined }, a);
  if (sec.name === 'hero') cur.wordA[0] = Math.min(cur.wordA[0], 0.9 * ss(0.5, 0.95, introT));
  const bob = reduced ? 0 : Math.sin(t * 1.15) * 0.035 * cur.bob;
  const S = {
    target: [0, cur.ty, 0], orbit: 0, pitch: cur.pitch, dist: cur.dist, fov: 30, off: [cur.offX, cur.offY],
    pos: [0, bob, 0], yaw: cur.yaw, tilt: cur.tilt, roll: cur.roll, scale: cur.scale,
    explode: cur.explode, capOff: cur.capOff, press: cur.press, level: cur.level,
    layerWarm: cur.layerWarm, nameWarm: cur.nameWarm, theme: themeAt(cur.warm), liqC: LIQ_COLD, liqW: LIQ_WARM,
    shadow: cur.shadow, bob, wordA: cur.wordA, wordX: cur.wordX, wordY: cur.wordY, wordW: cur.wordW,
    reveal: ss(0.3, 0.86, introT), time: t,
  };
  applyCss(cur.warm);
  if (bottle) {
    const cam = bottle.camera(S);
    const c0 = bottle.project(S, [0, 0.15, 0], cam);
    S.slosh = slosh.update(dt, S, cam, { scrollY, cx: c0[0], cy: c0[1], wind: cur.wind, warm: cur.warm, t });
    bottle.render(S);
  }
  updateUI(sec, p, tg, S);
  // 2D layer
  let geo, nozzle, ipts = null, orbit = null;
  if (bottle) {
    const c = bottle.project(S, [0, 0.15, 0]);
    const top = bottle.project(S, [0, 1.55, 0]);
    const bot = bottle.project(S, [0, -0.95, 0]);
    geo = { cx: c[0], cy: c[1], bh: Math.abs(bot[1] - top[1]) };
    const u0 = bottle.project(S, [0, 0, 0]), u1 = bottle.project(S, [0, 1, 0]);
    const unit = Math.abs(u1[1] - u0[1]);
    const act = bottle.project(S, [0, PARTS.actY(cur.explode, cur.press) + 0.03, 0]);
    nozzle = [act[0] + Math.cos(cur.sprayDir) * unit * 0.08, act[1] + Math.sin(cur.sprayDir) * unit * 0.08];
    if (introT < 1) {
      if (!introPts) introPts = introPoints();
      ipts = introPts.map((lp) => bottle.project(S, lp));
    }
    if (cur.orbitAmt > 0.01) {
      const So = { ...S, yaw: 0, roll: 0, tilt: 0 };
      const kinds = ['saffron', 'fig', 'amber'];
      orbit = [];
      for (let i = 0; i < 9; i++) {
        const ang = t * 0.32 + (i / 9) * TAU;
        const y = 1.0 - (i % 3) * 0.62 + Math.sin(ang * 2 + i) * 0.05;
        const r = mobile ? 0.98 : 1.25;
        const pt = bottle.project(So, [Math.cos(ang) * r, y, Math.sin(ang) * r]);
        const ref = bottle.project(So, [0, y, 0]);
        orbit.push({ x: pt[0], y: pt[1], z: pt[4], front: pt[4] < ref[4], size: geo.bh * 0.17 * (ref[4] / pt[4]), kind: kinds[i % 3], ph: i });
      }
    }
  } else {
    geo = { cx: W / 2, cy: H * 0.45, bh: H * 0.55 };
    nozzle = [geo.cx, geo.cy - geo.bh * 0.4];
  }
  if (sec.name === 'wind') {
    root.style.setProperty('--ring-x', `${geo.cx.toFixed(1)}px`);
    root.style.setProperty('--ring-y', `${(geo.cy - geo.bh * 0.08).toFixed(1)}px`);
    root.style.setProperty('--ring-d', `${(geo.bh * 1.22).toFixed(1)}px`);
  }
  if (sec !== keepSec || ++keepTick > 20) { keepSec = sec; keepTick = 0; fx.setKeepOut(keepOut(sec)); }
  fx.frame(dt, t, {
    warm: cur.warm, accent: S.theme.accent, wind: cur.wind, windAng: cur.windAng, fog: cur.fog, bottle: geo,
    intro: introT, introPts: ipts, orbitAmt: cur.orbitAmt, orbit,
    inside: cur.inside, depth: cur.depth, deep: LIQ_COLD.map((c) => c.map((v) => v * 0.9)),
    spray: cur.spray, form: cur.form, nozzle, sprayDir: cur.sprayDir, mottoEl: motto,
  });
  adapt(dt);
  requestAnimationFrame(frame);
}

async function start() {
  await fontsReady();
  if (bottle) {
    bottle.upload('uLabel', labelCanvas());
    bottle.upload('uWords', wordsCanvas());
  }
  measure();
  let rt = 0;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { measure(); introPts = null; }, 120); });
  mobileQ.addEventListener('change', measure);
  if (reduced) root.classList.add('intro-done');
  requestAnimationFrame((n) => { last = n; requestAnimationFrame(frame); });
}
start();
