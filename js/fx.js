// 2D layers above the bottle: wind trails, fog, the notes' ingredients and the spray that becomes words.

const TAU = Math.PI * 2;
const cl = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ss = (a, b, x) => { const t = cl((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeIn = (t) => t * t * t;
const mix = (a, b, t) => a + (b - a) * t;

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

import { bakeBotanica } from './botanica.js';

// group = one layer of notes; three sprite kinds per fragrance
const GROUPS = {
  xezri: [['cedar', 0.3], ['salt', 0.02], ['bergamot', -0.3]],
  gilavar: [['amber', 0.3], ['fig', 0.02], ['saffron', -0.3]],
};
// candidate spots around the bottle, in bottle heights (x) and extra lift (y)
const SPOTS = [[0.5, 0], [-0.5, 0], [0.82, 0.06], [-0.82, 0.06], [1.12, -0.04], [-1.12, -0.04], [0.66, 0.2], [-0.66, 0.2]];

export class FX {
  constructor(trail, fx, opts) {
    this.trail = trail; this.fx = fx;
    this.tg = trail.getContext('2d');
    this.g = fx.getContext('2d');
    this.mobile = opts.mobile;
    this.reduced = opts.reduced;
    this.art = bakeBotanica('#10202a', '#f4e6cf');
    const fog = document.createElement('canvas');
    fog.width = fog.height = 256;
    const fg = fog.getContext('2d');
    const gr = fg.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(0.5, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    fg.fillStyle = gr; fg.fillRect(0, 0, 256, 256);
    this.fogSprite = fog;
    const mist = document.createElement('canvas');
    mist.width = mist.height = 256;
    const mg = mist.getContext('2d');
    const gm = mg.createRadialGradient(128, 128, 0, 128, 128, 128);
    gm.addColorStop(0, 'rgba(255,214,160,.8)'); gm.addColorStop(0.55, 'rgba(240,170,100,.25)'); gm.addColorStop(1, 'rgba(240,170,100,0)');
    mg.fillStyle = gm; mg.fillRect(0, 0, 256, 256);
    this.mistSprite = mist;
    const r = rng(11);
    this.puffs = Array.from({ length: this.mobile ? 9 : 16 }, () => ({ x: r(), y: r(), s: 0.35 + r() * 0.5, v: 0.4 + r() * 0.6, ph: r() * TAU }));
    this.particles = [];
    this.nWind = this.mobile ? 170 : 360;
    for (let i = 0; i < this.nWind; i++) this.particles.push({ x: r(), y: r(), age: r() * 3, life: 1.5 + r() * 2.5 });
    // ingredient instances: 3 per group; their spot is chosen each frame away from text
    this.inst = {};
    for (const f of ['xezri', 'gilavar']) {
      this.inst[f] = GROUPS[f].map(([kind, hy], gi) => {
        const rr = rng(gi * 31 + (f === 'xezri' ? 1 : 2));
        return Array.from({ length: 3 }, (_, i) => ({
          kind, hy, pref: (i + gi) % 2,
          size: 0.17 + rr() * 0.06,
          rot: (rr() - 0.5) * 0.7, sway: 0.08 + rr() * 0.08, ph: rr() * TAU, delay: rr() * 0.35,
        }));
      });
    }
    this.keep = [];
    // spray droplets
    const sr = rng(5);
    this.nDrops = this.mobile ? 900 : 1800;
    this.drops = Array.from({ length: this.nDrops }, () => ({
      a: (sr() - 0.5) * 0.75, v: 0.35 + Math.pow(sr(), 0.7) * 1.1, k: 2.2 + sr() * 2.4, d: sr() * 0.18, ph: sr() * TAU,
      w: 0.6 + sr() * 1.6, f: sr() * 0.45, tx: 0, ty: 0,
    }));
    this.mists = Array.from({ length: this.mobile ? 18 : 34 }, () => ({ a: (sr() - 0.5) * 0.9, v: 0.2 + sr() * 0.8, k: 1.5 + sr() * 2, d: sr() * 0.25, s: 0.6 + sr() * 0.8 }));
    this.textPts = null;
    this.windAng = 0.9;
  }

  resize(w, h, dpr) {
    this.w = w; this.h = h; this.dpr = dpr;
    for (const c of [this.trail, this.fx]) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    this.tg.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.textPts = null;
  }

  // text targets from the real motto element, so the dots land exactly where the words are
  sampleText(el) {
    const rect = el.getBoundingClientRect();
    if (!rect.width) return;
    const c = document.createElement('canvas');
    c.width = Math.ceil(this.w); c.height = Math.ceil(this.h);
    const g = c.getContext('2d');
    g.fillStyle = '#fff';
    const walk = (node, italic) => {
      for (const n of node.childNodes) {
        if (n.nodeType === 3) {
          const range = document.createRange();
          range.selectNodeContents(n);
          const cs = getComputedStyle(n.parentElement);
          g.font = `${italic ? 'italic ' : ''}${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
          g.textBaseline = 'alphabetic';
          const fs = parseFloat(cs.fontSize);
          for (const r of range.getClientRects()) {
            const txt = n.textContent.trim();
            if (!txt) continue;
            g.fillText(txt, r.left, r.top + fs * 0.82);
          }
        } else if (n.nodeType === 1) walk(n, italic || n.tagName === 'EM');
      }
    };
    walk(el, false);
    const img = g.getImageData(0, 0, c.width, c.height).data;
    const pts = [];
    const step = this.mobile ? 3 : 4;
    for (let y = 0; y < c.height; y += step) for (let x = 0; x < c.width; x += step) if (img[(y * c.width + x) * 4 + 3] > 128) pts.push([x, y]);
    if (!pts.length) return;
    const r = rng(9);
    for (let i = pts.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pts[i], pts[j]] = [pts[j], pts[i]]; }
    this.drops.forEach((d, i) => { const p = pts[i % pts.length]; d.tx = p[0] + (r() - 0.5) * step * 0.6; d.ty = p[1] + (r() - 0.5) * step * 0.6; });
    this.textPts = pts.length;
  }

  setKeepOut(rects) { this.keep = rects; }

  frame(dt, t, S) {
    const { w, h } = this;
    const g = this.g, tg = this.tg;
    g.clearRect(0, 0, w, h);
    const warm = S.warm;
    const minWH = Math.min(w, h);

    // ---- wind trails (persistent canvas, faded each frame) ----
    if (S.wind > 0.01 && !this.reduced) {
      this.windAng = S.windAng;
      tg.globalCompositeOperation = 'destination-out';
      tg.fillStyle = `rgba(0,0,0,${cl(dt * 3.2, 0.03, 0.4)})`;
      tg.fillRect(0, 0, w, h);
      tg.globalCompositeOperation = 'source-over';
      const col = warm > 0.5 ? `rgba(255,${Math.round(190 + 30 * (1 - warm))},130,${0.3 * S.wind})` : `rgba(22,52,66,${0.26 * S.wind})`;
      const B = S.bottle;
      const rx = B ? B.bh * 0.34 : 0, ry = B ? B.bh * 0.6 : 0;
      tg.strokeStyle = col;
      tg.lineWidth = this.mobile ? 1 : 1.2;
      tg.lineCap = 'round';
      tg.beginPath();
      const sp = (220 + 520 * S.wind) * dt;
      const n = Math.round(this.nWind * cl(S.wind * 1.4));
      for (let i = 0; i < n; i++) {
        const p = this.particles[i];
        p.age += dt;
        let x = p.x * w, y = p.y * h;
        const a = S.windAng + 0.55 * Math.sin(x * 0.0042 + t * 0.35) * Math.cos(y * 0.0051 - t * 0.27) + 0.25 * Math.sin((x + y) * 0.011 + t);
        const nx = x + Math.cos(a) * sp, ny = y + Math.sin(a) * sp;
        if (p.age < p.life && nx > -20 && nx < w + 20 && ny > -20 && ny < h + 20) {
          const ex = B ? (nx - B.cx) / rx : 9, ey = B ? (ny - B.cy) / ry : 9;
          if (ex * ex + ey * ey > 1) { tg.moveTo(x, y); tg.lineTo(nx, ny); }
          p.x = nx / w; p.y = ny / h;
        } else {
          // respawn upwind, on the edge the wind comes from
          const r = Math.random();
          const ca = Math.cos(S.windAng), sa = Math.sin(S.windAng);
          if (Math.abs(ca) > Math.abs(sa) ? r < 0.6 : r < 0.4) { p.x = ca > 0 ? -0.02 : 1.02; p.y = Math.random(); }
          else { p.y = sa > 0 ? -0.02 : 1.02; p.x = Math.random(); }
          p.age = 0; p.life = 1.5 + Math.random() * 2.5;
        }
      }
      tg.stroke();
      this.trailDirty = true;
    } else if (this.trailDirty) {
      tg.globalCompositeOperation = 'destination-out';
      tg.fillStyle = `rgba(0,0,0,${cl(dt * 4, 0.05, 0.5)})`;
      tg.fillRect(0, 0, w, h);
      tg.globalCompositeOperation = 'source-over';
      if (S.wind <= 0.01) { this.fadeOut = (this.fadeOut || 0) + dt; if (this.fadeOut > 1.5) { tg.clearRect(0, 0, w, h); this.trailDirty = false; this.fadeOut = 0; } }
    }

    // ---- fog ----
    if (S.fog > 0.01) {
      g.globalAlpha = 1;
      for (const p of this.puffs) {
        const drift = this.reduced ? 0 : t * 0.012 * p.v;
        const x = ((p.x + drift * Math.cos(this.windAng)) % 1.2 + 1.2) % 1.2 - 0.1;
        const y = ((p.y + drift * 0.5 * Math.sin(this.windAng)) % 1.2 + 1.2) % 1.2 - 0.1;
        const s = p.s * minWH * 1.1;
        g.globalAlpha = S.fog * (warm > 0.5 ? 0.06 : 0.16) * (0.6 + 0.4 * Math.sin(t * 0.3 + p.ph));
        g.drawImage(this.fogSprite, x * w - s / 2, y * h - s / 2, s, s * 0.6);
      }
      g.globalAlpha = 1;
    }

    // ---- ingredients ----
    if (S.ingr && S.bottle) {
      const { cx, cy, bh } = S.bottle;
      const wx = Math.cos(S.windAng), wy = Math.sin(S.windAng);
      const travel = Math.max(w, h) * 0.75;
      const ink = warm > 0.5 ? 'warm' : 'cold';
      const taken = [];
      for (const f of ['xezri', 'gilavar']) {
        const st = S.ingr[f];
        if (!st) continue;
        this.inst[f].forEach((group, gi) => {
          const v = st.in[gi], e = st.out;
          if (v <= 0.001 || e >= 0.999) return;
          for (const it of group) {
            const vi = cl((v - it.delay) / (1 - it.delay));
            if (vi <= 0) continue;
            const ei = cl((e - it.delay * 0.5) / (1 - it.delay * 0.5));
            const sz = it.size * bh * (this.mobile ? 0.9 : 1);
            // first free spot: on screen, clear of text and of other notes
            let home = null;
            const order = it.pref ? SPOTS.map((s) => [-s[0], s[1]]) : SPOTS;
            for (const [sx, sy] of order) {
              const x = cx + sx * bh, y = cy + (it.hy + sy) * bh;
              const r = { l: x - sz * 0.5, t: y - sz * 0.5, r: x + sz * 0.5, b: y + sz * 0.5 };
              if (r.l < 6 || r.r > w - 6 || r.t < 70 || r.b > h - 6) continue;
              if (this.keep.some((k) => r.l < k.r && r.r > k.l && r.t < k.b && r.b > k.t)) continue;
              if (taken.some((k) => r.l < k.r && r.r > k.l && r.t < k.b && r.b > k.t)) continue;
              home = [x, y]; taken.push(r); break;
            }
            if (!home) continue;
            let [x, y] = home;
            y += Math.sin(t * 0.7 + it.ph) * bh * 0.01;
            x -= wx * travel * (1 - easeOut(vi)); y -= wy * travel * (1 - easeOut(vi));
            x += wx * travel * 1.3 * easeIn(ei); y += wy * travel * 1.3 * easeIn(ei);
            g.save();
            g.globalAlpha = cl(vi * 2.5) * (1 - ei);
            g.translate(x, y);
            g.rotate(it.rot + (this.reduced ? 0 : Math.sin(t * 0.5 + it.ph) * it.sway) + (1 - vi) * 1.5 + ei * 2);
            g.drawImage(this.art[it.kind][ink], -sz / 2, -sz / 2, sz, sz);
            g.restore();
          }
        });
      }
    }

    // ---- spray -> words ----
    if (S.spray > 0 && S.nozzle) {
      if (!this.textPts && S.mottoEl) this.sampleText(S.mottoEl);
      const [nx, ny] = S.nozzle;
      const base = S.sprayDir;
      const reach = Math.max(w, h) * 0.75;
      const form = S.form;
      g.globalCompositeOperation = 'source-over';
      // mist clouds
      for (const m of this.mists) {
        const tau = Math.max(0, S.spray * 1.8 - m.d);
        if (tau <= 0) continue;
        const s1 = 1 - Math.exp(-m.k * tau);
        const a = base + m.a;
        const x = nx + Math.cos(a) * m.v * reach * 0.5 * s1;
        const y = ny + Math.sin(a) * m.v * reach * 0.5 * s1 - tau * h * 0.02;
        const r = (0.03 + 0.22 * s1) * minWH * m.s;
        g.globalAlpha = cl(tau * 8) * (1 - ss(0.6, 1.7, tau)) * 0.07 * (1 - form);
        g.drawImage(this.mistSprite, x - r, y - r, r * 2, r * 2);
      }
      g.globalCompositeOperation = warm > 0.5 ? 'lighter' : 'source-over';
      const colA = warm > 0.5 ? [255, 218, 165] : [30, 70, 90];
      g.fillStyle = `rgb(${colA[0]},${colA[1]},${colA[2]})`;
      const fade = 1 - ss(0.86, 1, form);
      for (let i = 0; i < this.drops.length; i++) {
        const d = this.drops[i];
        const tau = Math.max(0, S.spray * 1.8 - d.d);
        if (tau <= 0) continue;
        const s1 = (1 - Math.exp(-d.k * tau)) / d.k;
        const a = base + d.a;
        let x = nx + Math.cos(a) * d.v * reach * s1 + Math.sin(tau * 2.4 + d.ph) * reach * 0.03 * tau;
        let y = ny + Math.sin(a) * d.v * reach * s1 + Math.cos(tau * 2.1 + d.ph) * reach * 0.025 * tau - tau * h * 0.015;
        let sz = d.w * (1.2 - 0.4 * cl(tau));
        let al = cl(tau * 10) * (1 - 0.55 * ss(0.5, 1.6, tau));
        if (form > 0 && this.textPts) {
          const fi = easeOut(cl((form * 1.4 - d.f)));
          x = mix(x, d.tx, fi); y = mix(y, d.ty, fi);
          sz = mix(sz, this.mobile ? 2 : 2.4, fi);
          al = mix(al, 0.95, fi);
        }
        al *= fade;
        if (al <= 0.01) continue;
        g.globalAlpha = al;
        g.fillRect(x - sz / 2, y - sz / 2, sz, sz);
      }
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
    }
  }
}
