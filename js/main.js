import { Bottle } from './bottle.js';
import { themeAt, applyCss, LIQ_COLD, LIQ_WARM } from './theme.js';
import { fontsReady, labelCanvas, wordsCanvas } from './textures.js';
import { scene } from './scenes.js';
import { FX } from './fx.js';
import { initShop } from './shop.js';

const cl = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const root = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

const shop = initShop();

const sections = $$('[data-scene]').map((el) => ({
  el, name: el.dataset.scene, pin: el.classList.contains('pin'),
  steps: $$('.step', el).map((s) => ({ el: s, at: +s.dataset.at })),
}));

const glCanvas = $('#gl');
let bottle = null;
try {
  bottle = new Bottle(glCanvas);
  root.classList.add('gl');
} catch (e) {
  bottle = null;
}

const mobileQ = matchMedia('(max-width: 860px)');
let W = 0, H = 0, mobile = false;
let q = 0; // render scale
const fx = new FX($('#trail'), $('#fx'), { mobile: mobileQ.matches, reduced });

function measure() {
  W = glCanvas.clientWidth || innerWidth;
  H = glCanvas.clientHeight || innerHeight;
  mobile = mobileQ.matches;
  if (!q) q = mobile ? 0.62 : 0.85;
  const base = Math.min(devicePixelRatio || 1, 2);
  if (bottle) bottle.resize(W, H, base * q);
  fx.resize(W, H, Math.min(devicePixelRatio || 1, mobile ? 1.5 : 1.25));
}

// ---------- scene selection ----------
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
let idleYaw = 0.3;
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

// ---------- DOM bits driven by the scene ----------
const tagsLayer = $('#tagLines');
const parts = $$('.parts li');
const partY = {
  cap: (e) => 1.285 + 1.42 * e, act: (e) => 1.17 + 0.94 * e, stem: (e) => 1.08 + 0.8 * e,
  collar: (e) => 0.955 + 0.44 * e, glass: (e) => 0.15 - 0.22 * e,
};
const partSide = { cap: 1, stem: 1, glass: 1, act: -1, collar: -1 };
tagsLayer.innerHTML = parts.map(() => '<line x1="0" y1="0" x2="0" y2="0"/><circle r="3.5" cx="-20" cy="-20"/>').join('');
const tagEls = [...tagsLayer.children];
const ticks = $('.compass__ticks');
ticks.innerHTML = Array.from({ length: 36 }, (_, i) => { const a = (i / 36) * Math.PI * 2; const r0 = i % 9 === 0 ? 78 : 84; return `<line x1="${100 + Math.sin(a) * r0}" y1="${100 - Math.cos(a) * r0}" x2="${100 + Math.sin(a) * 90}" y2="${100 - Math.cos(a) * 90}"/>`; }).join('');
const motto = $('[data-motto]');
const pyrX = $$('#xezri .pyramid li');
const pyrG = $$('#kulek .pyramid li');
const dialText = $('[data-spin-deg]');

function updateUI(sec, p, tg, S) {
  for (const s of sections) {
    if (!s.steps.length) continue;
    let on = null;
    if (s === sec) for (const st of s.steps) if (p >= st.at) on = st;
    for (const st of s.steps) st.el.classList.toggle('is-on', st === on);
  }
  const ui = tg.ui || {};
  root.style.setProperty('--wind-deg', `${((cur.windAng * 180) / Math.PI + 90).toFixed(1)}deg`);
  if (sec.name === 'spin') { dialText.textContent = `${ui.deg}°`; root.style.setProperty('--spin', ui.spin.toFixed(3)); }
  if (sec.name === 'xezri') pyrX.forEach((li) => { const f = ui.layers[+li.dataset.layer]; li.classList.toggle('is-on', f > 0.02); li.style.setProperty('--fill', f.toFixed(3)); });
  if (sec.name === 'wind') {
    root.style.setProperty('--needle', `${ui.needle.toFixed(1)}deg`);
    pyrG.forEach((li) => { const f = ui.layersG[+li.dataset.layer]; li.classList.toggle('is-on', f > 0.5); li.style.setProperty('--fill', f.toFixed(3)); });
  }
  motto.classList.toggle('is-on', sec.name === 'spray' && !!ui.motto);
  // exploded-view tags
  const e = cur.explode;
  const show = sec.name === 'explode' && e > 0.5 && bottle;
  parts.forEach((li, i) => {
    const on = show && ui.tagP > 0.4 + i * 0.055;
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
    const side = mobile ? 1 : partSide[k];
    return { li, k, ax: a[0], ay: a[1], side, h: li.offsetHeight || 60, w: li.offsetWidth || 220 };
  });
  for (const side of [1, -1]) {
    const col = items.filter((it) => it.side === side).sort((a, b) => a.ay - b.ay);
    let y = 80;
    for (const it of col) { it.y = Math.max(it.ay - it.h / 2, y); y = it.y + it.h + 14; }
    const over = y - 14 - (H - 30);
    if (over > 0) col.forEach((it) => (it.y -= over));
  }
  items.forEach((it, i) => {
    const gap = mobile ? 0.5 * unit + 22 : 0.85 * unit + 56;
    let x = it.side > 0 ? c0[0] + gap : c0[0] - gap - it.w;
    if (mobile) x = Math.min(x, W - 12 - it.w);
    it.li.style.transform = `translate(${x.toFixed(1)}px, ${it.y.toFixed(1)}px)`;
    it.li.classList.toggle('to-left', it.side < 0);
    const lx = it.side > 0 ? x - 10 : x + it.w + 10;
    const ly = it.y + 16;
    const line = tagEls[i * 2], dot = tagEls[i * 2 + 1];
    line.setAttribute('x1', it.ax.toFixed(1)); line.setAttribute('y1', it.ay.toFixed(1));
    line.setAttribute('x2', lx.toFixed(1)); line.setAttribute('y2', ly.toFixed(1));
    dot.setAttribute('cx', it.ax.toFixed(1)); dot.setAttribute('cy', it.ay.toFixed(1));
  });
}

// rectangles the floating notes must stay out of: the scene's text and the compass
let keepSec = null, keepTick = 0;
function keepOut(sec) {
  const pad = 18;
  return $$('.step, .notes, .turn, .motto, .hero__copy, .shop__panel', sec.el).map((el) => el.getBoundingClientRect())
    .filter((b) => b.width && b.height)
    .map((b) => ({ l: b.left - pad, t: b.top - pad, r: b.right + pad, b: b.bottom + pad }));
}

// ---------- adaptive resolution ----------
let frames = 0, acc = 0, goodWindows = 0;
function adapt(dt) {
  if (!bottle) return;
  frames++; acc += dt;
  if (frames < 45) return;
  const avg = (acc / frames) * 1000;
  window.__kulek = { q, lite: bottle.lite, avg: Math.round(avg * 10) / 10 };
  frames = 0; acc = 0;
  const qMax = mobile ? 0.8 : 1;
  if (avg > 25 && q <= 0.42 && !bottle.lite) { bottle.lite = 1; goodWindows = 0; }
  else if (avg > 25 && q > 0.42) { q = Math.max(0.42, q - 0.1); goodWindows = 0; measure(); }
  else if (avg < 18) { if (++goodWindows >= 4 && q < qMax) { q = Math.min(qMax, q + 0.05); goodWindows = 0; measure(); } }
  else goodWindows = 0;
}

// ---------- loop ----------
let last = performance.now(), t = 0;
function frame(now) {
  const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
  last = now; t += dt;
  const sec = activeSection();
  const p = progressOf(sec);
  const tg = scene(sec.name, p, { mobile, aspect: W / H, pick: shop.pick, volScale: shop.volScale });
  if (!reduced) idleYaw += tg.spin * dt;
  const a = reduced ? 1 : 1 - Math.exp(-dt * 6.5);
  approach({ ...tg, yaw: idleYaw + tg.yawAdd, ingr: undefined, ui: undefined }, a);
  const bob = reduced ? 0 : Math.sin(t * 1.15) * 0.035 * cur.bob;
  const S = {
    target: [0, cur.ty, 0], orbit: 0, pitch: cur.pitch, dist: cur.dist, fov: 30, off: [cur.offX, cur.offY],
    pos: [0, bob, 0], yaw: cur.yaw, tilt: cur.tilt, roll: cur.roll, scale: cur.scale,
    explode: cur.explode, capOff: cur.capOff, press: cur.press, level: cur.level,
    layerWarm: cur.layerWarm, nameWarm: cur.nameWarm, theme: themeAt(cur.warm), liqC: LIQ_COLD, liqW: LIQ_WARM,
    shadow: cur.shadow, bob, wordA: cur.wordA, wordX: cur.wordX, wordY: cur.wordY, wordW: cur.wordW,
  };
  applyCss(cur.warm);
  if (bottle) bottle.render(S, t);
  updateUI(sec, p, tg, S);
  // 2D layer
  let geo = null, nozzle = null;
  if (bottle) {
    const c = bottle.project(S, [0, 0.15, 0]);
    const top = bottle.project(S, [0, 1.55, 0]);
    const bot = bottle.project(S, [0, -0.95, 0]);
    geo = { cx: c[0], cy: c[1], bh: Math.abs(bot[1] - top[1]) };
    const u0 = bottle.project(S, [0, 0, 0]), u1 = bottle.project(S, [0, 1, 0]);
    const unit = Math.abs(u1[1] - u0[1]);
    const act = bottle.project(S, [0, 1.17 + 0.94 * cur.explode - 0.05 * cur.press + 0.02, 0]);
    nozzle = [act[0] + Math.cos(cur.sprayDir) * unit * 0.1, act[1] + Math.sin(cur.sprayDir) * unit * 0.1];
  } else {
    geo = { cx: W * (mobile ? 0.5 : 0.7), cy: H * (mobile ? 0.3 : 0.5), bh: H * 0.5 };
    nozzle = [geo.cx, geo.cy - geo.bh * 0.4];
  }
  if (sec !== keepSec || ++keepTick > 20) { keepSec = sec; keepTick = 0; fx.setKeepOut(keepOut(sec)); }
  fx.frame(dt, t, {
    warm: cur.warm, wind: cur.wind, windAng: cur.windAng, fog: cur.fog, ingr: tg.ingr, bottle: geo,
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
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(measure, 120); });
  mobileQ.addEventListener('change', measure);
  requestAnimationFrame((n) => { last = n; requestAnimationFrame(frame); });
  root.classList.add('ready');
}
start();
