// 2D layers above the bottle: wind trails, fog, the particles that become the bottle, the inside of the
// juice, the notes orbiting Gilavar, and the spray that settles into words.
import { bakeBotanica, loadPhotos } from './botanica.js';

const TAU = Math.PI * 2;
const cl = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ss = (a, b, x) => { const t = cl((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const mix = (a, b, t) => a + (b - a) * t;

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function softSprite(stops) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  stops.forEach(([o, col]) => gr.addColorStop(o, col));
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  return c;
}
const rgb = (c, a) => `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${a})`;
const mixc = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

export class FX {
  constructor(trail, fx, opts) {
    this.trail = trail; this.fx = fx;
    this.tg = trail.getContext('2d');
    this.g = fx.getContext('2d');
    this.mobile = opts.mobile;
    this.reduced = opts.reduced;
    this.art = bakeBotanica('#0d1d24', '#f4ece0');
    this.photos = loadPhotos(['bergamot', 'salt', 'cedar', 'saffron', 'fig', 'amber']);
    this.fogSprite = softSprite([[0, 'rgba(255,255,255,.9)'], [0.5, 'rgba(255,255,255,.35)'], [1, 'rgba(255,255,255,0)']]);
    this.mistSprite = softSprite([[0, 'rgba(255,214,160,.8)'], [0.55, 'rgba(240,170,100,.25)'], [1, 'rgba(240,170,100,0)']]);
    const r = rng(11);
    this.puffs = Array.from({ length: this.mobile ? 9 : 16 }, () => ({ x: r(), y: r(), s: 0.35 + r() * 0.5, v: 0.4 + r() * 0.6, ph: r() * TAU }));
    this.nWind = this.mobile ? 260 : 620;
    this.particles = Array.from({ length: this.nWind }, () => ({ x: r(), y: r(), age: r() * 3, life: 1.5 + r() * 2.5 }));
    // intro: each grain flies from the storm onto a point of the bottle
    const ir = rng(21);
    this.nIntro = this.mobile ? 520 : 1100;
    this.grains = Array.from({ length: this.nIntro }, () => ({ a: ir() * TAU, r: 0.55 + ir() * 0.6, d: ir() * 0.35, sw: (ir() - 0.5) * 2.4, w: 0.8 + ir() * 1.4 }));
    // inside the juice
    const br = rng(31);
    this.bubbles = Array.from({ length: this.mobile ? 40 : 80 }, () => ({ x: br(), y: br(), r: 1.5 + br() * 6, v: 0.25 + br() * 0.8, ph: br() * TAU }));
    // three takes per layer, placed above and below the layer's name so they never cover it
    const spots = [[0.12, -0.075], [0.86, -0.06], [0.7, 0.085]];
    this.deepArt = ['cedar', 'salt', 'bergamot'].flatMap((kind, li) => spots.map(([x, dc], j) => ({
      kind, c: [0.83, 0.5, 0.17][li] + dc * (li % 2 ? -1 : 1), x: li % 2 ? 1 - x : x,
      s: 0.13 + br() * 0.05, rot: (br() - 0.5) * 0.6, ph: br() * TAU,
    })));
    // spray droplets
    const sr = rng(5);
    this.drops = Array.from({ length: this.mobile ? 900 : 1800 }, () => ({
      a: (sr() - 0.5) * 0.9, v: 0.35 + Math.pow(sr(), 0.7) * 1.1, k: 2.2 + sr() * 2.4, d: sr() * 0.18, ph: sr() * TAU,
      w: 0.6 + sr() * 1.6, f: sr() * 0.45, tx: 0, ty: 0,
    }));
    this.mists = Array.from({ length: this.mobile ? 18 : 34 }, () => ({ a: (sr() - 0.5) * 1.1, v: 0.2 + sr() * 0.8, k: 1.5 + sr() * 2, d: sr() * 0.25, s: 0.6 + sr() * 0.8 }));
    this.textPts = null;
    this.windAng = 1;
    this.keep = [];
  }

  resize(w, h, dpr) {
    this.w = w; this.h = h; this.dpr = dpr;
    for (const c of [this.trail, this.fx]) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    this.tg.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.textPts = null;
  }
  setKeepOut(rects) { this.keep = rects; }

  // a note at the origin of g, its subject about sz wide: the photo if it has loaded, else the drawing
  drawNote(g, kind, i, sz) {
    const p = this.photos[kind];
    if (p && p.length) { const c = p[i % p.length]; const k = sz * 1.5; g.drawImage(c, -k / 2, -k / 2, k, k); }
    else g.drawImage(this.art[kind].warm, -sz / 2, -sz / 2, sz, sz);
  }

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
          const txt = n.textContent.trim();
          if (!txt) continue;
          for (const r of range.getClientRects()) g.fillText(txt, r.left, r.top + fs * 0.82);
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

  frame(dt, t, S) {
    const { w, h } = this;
    const g = this.g, tg = this.tg;
    g.clearRect(0, 0, w, h);
    const warm = S.warm;
    const minWH = Math.min(w, h);
    const B = S.bottle;

    // ---- wind trails (persistent canvas, faded each frame) ----
    if (S.wind > 0.01 && !this.reduced && S.inside < 0.99) {
      this.windAng = S.windAng;
      tg.globalCompositeOperation = 'destination-out';
      tg.fillStyle = `rgba(0,0,0,${cl(dt * 3.2, 0.03, 0.4)})`;
      tg.fillRect(0, 0, w, h);
      tg.globalCompositeOperation = 'source-over';
      const amt = cl(S.wind, 0, 1.6);
      const col = mixc(S.accent, [1, 0.82, 0.6], warm);
      tg.strokeStyle = rgb(col, 0.16 + 0.18 * Math.min(1, amt));
      tg.lineWidth = this.mobile ? 1 : 1.2;
      tg.lineCap = 'round';
      tg.beginPath();
      const sp = (220 + 420 * amt) * dt;
      const n = Math.round(this.nWind * cl(amt / 1.6));
      const rx = B ? B.bh * 0.34 : 0, ry = B ? B.bh * 0.6 : 0;
      for (let i = 0; i < n; i++) {
        const p = this.particles[i];
        p.age += dt;
        const x = p.x * w, y = p.y * h;
        const a = S.windAng + 0.55 * Math.sin(x * 0.0042 + t * 0.35) * Math.cos(y * 0.0051 - t * 0.27) + 0.25 * Math.sin((x + y) * 0.011 + t);
        const nx = x + Math.cos(a) * sp, ny = y + Math.sin(a) * sp;
        if (p.age < p.life && nx > -20 && nx < w + 20 && ny > -20 && ny < h + 20) {
          const ex = B ? (nx - B.cx) / rx : 9, ey = B ? (ny - B.cy) / ry : 9;
          if (ex * ex + ey * ey > 1 && !this.keep.some((k) => nx > k.l && nx < k.r && ny > k.t && ny < k.b)) { tg.moveTo(x, y); tg.lineTo(nx, ny); }
          p.x = nx / w; p.y = ny / h;
        } else {
          const rr = Math.random();
          const ca = Math.cos(S.windAng), sa = Math.sin(S.windAng);
          if (Math.abs(ca) > Math.abs(sa) ? rr < 0.6 : rr < 0.4) { p.x = ca > 0 ? -0.02 : 1.02; p.y = Math.random(); }
          else { p.y = sa > 0 ? -0.02 : 1.02; p.x = Math.random(); }
          p.age = 0; p.life = 1.5 + Math.random() * 2.5;
        }
      }
      tg.stroke();
      this.trailDirty = true;
      this.fadeOut = 0;
    } else if (this.trailDirty) {
      tg.globalCompositeOperation = 'destination-out';
      tg.fillStyle = `rgba(0,0,0,${cl(dt * 4, 0.05, 0.5)})`;
      tg.fillRect(0, 0, w, h);
      tg.globalCompositeOperation = 'source-over';
      this.fadeOut = (this.fadeOut || 0) + dt;
      if (this.fadeOut > 1.5 || S.inside > 0.99) { tg.clearRect(0, 0, w, h); this.trailDirty = false; this.fadeOut = 0; }
    }

    // ---- fog ----
    if (S.fog > 0.01 && S.inside < 0.99) {
      const fogCol = warm > 0.5 ? 0.07 : 0.09;
      for (const p of this.puffs) {
        const drift = this.reduced ? 0 : t * 0.014 * p.v * (1 + S.wind);
        const x = ((p.x + drift * Math.cos(this.windAng)) % 1.2 + 1.2) % 1.2 - 0.1;
        const y = ((p.y + drift * 0.5 * Math.sin(this.windAng)) % 1.2 + 1.2) % 1.2 - 0.1;
        const s = p.s * minWH * 1.15;
        g.globalAlpha = cl(S.fog * fogCol * (0.6 + 0.4 * Math.sin(t * 0.3 + p.ph)));
        g.drawImage(this.fogSprite, x * w - s / 2, y * h - s * 0.3, s, s * 0.6);
      }
      g.globalAlpha = 1;
    }

    // ---- intro: grains from the storm settle on the bottle ----
    if (S.intro < 1 && S.introPts && S.introPts.length) {
      const k = S.intro;
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = rgb(S.accent, 1);
      const fade = 1 - ss(0.55, 0.85, k);
      const cx = w / 2, cy = h / 2, R = Math.hypot(w, h) * 0.55;
      for (let i = 0; i < this.nIntro; i++) {
        const gr = this.grains[i];
        const tp = S.introPts[i % S.introPts.length];
        const q = easeInOut(cl((k - gr.d * 0.6) / 0.55));
        const a0 = gr.a + gr.sw * (1 - q) + t * 0.3 * (1 - q);
        const sx = cx + Math.cos(a0) * R * gr.r, sy = cy + Math.sin(a0) * R * gr.r * 0.7;
        const x = mix(sx, tp[0], q), y = mix(sy, tp[1], q);
        const al = ss(0, 0.12, k) * fade * (0.35 + 0.65 * q);
        if (al < 0.01) continue;
        g.globalAlpha = al;
        const sz = gr.w * (this.mobile ? 1 : 1.2);
        g.fillRect(x - sz / 2, y - sz / 2, sz, sz);
      }
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
    }

    // ---- Gilavar's notes orbiting the bottle (back ones dim, drawn first) ----
    if (S.orbitAmt > 0.01 && S.orbit) {
      const items = S.orbit.slice().sort((a, b) => b.z - a.z);
      for (const it of items) {
        const sz = it.size;
        g.save();
        // behind the bottle: dim, and gone where the glass would hide it
        const hide = it.front || !B ? 1 : ss(B.bh * 0.2, B.bh * 0.34, Math.abs(it.x - B.cx));
        g.globalAlpha = S.orbitAmt * (it.front ? 1 : 0.45) * hide;
        if (g.globalAlpha < 0.01) { g.restore(); continue; }
        g.translate(it.x, it.y);
        g.rotate(Math.sin(t * 0.5 + it.ph) * 0.15);
        this.drawNote(g, it.kind, it.ph, sz);
        g.restore();
      }
      g.globalAlpha = 1;
    }

    // ---- inside the juice ----
    if (S.inside > 0.001 && S.deep) {
      const d = S.depth;
      const [c0, c1, c2] = S.deep;            // trace, heart, opening
      const at = (y) => (y < 0.5 ? mixc(c2, c1, ss(0.17, 0.5, y)) : mixc(c1, c0, ss(0.5, 0.83, y)));
      const top = at(cl(d - 0.12)), mid = at(d), bot = at(cl(d + 0.12));
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, rgb(top.map((v) => v * 1.12), 1));
      gr.addColorStop(0.5, rgb(mid, 1));
      gr.addColorStop(1, rgb(bot.map((v) => v * 0.7), 1));
      g.globalAlpha = S.inside;
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
      // light from above, through the surface
      const lg = g.createRadialGradient(w * 0.5, -h * 0.2, 0, w * 0.5, -h * 0.2, h * 1.1);
      lg.addColorStop(0, `rgba(255,255,255,${0.22 * (1 - d)})`); lg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = lg; g.fillRect(0, 0, w, h);
      // notes drift past as we sink
      for (const a of this.deepArt) {
        const y = h * (0.5 + (a.c - d) * 2.4);
        if (y < -h * 0.3 || y > h * 1.3) continue;
        const sz = a.s * minWH * (this.mobile ? 1.5 : 1.3);
        const x = w * a.x + Math.sin(t * 0.4 + a.ph) * w * 0.01;
        g.save();
        g.globalAlpha = S.inside * 0.9;
        g.translate(x, y + Math.sin(t * 0.6 + a.ph) * 8);
        g.rotate(a.rot + Math.sin(t * 0.3 + a.ph) * 0.1);
        this.drawNote(g, a.kind, this.deepArt.indexOf(a), sz);
        g.restore();
      }
      // bubbles rising
      g.globalAlpha = S.inside;
      g.strokeStyle = 'rgba(255,255,255,.42)';
      g.lineWidth = 1;
      for (const b of this.bubbles) {
        const y = (((b.y - (this.reduced ? 0 : t * 0.05 * b.v) + d * 2.2) % 1) + 1) % 1;
        const x = b.x * w + Math.sin(t * 1.3 + b.ph + y * 6) * 6;
        g.beginPath(); g.arc(x, y * h, b.r, 0, TAU); g.stroke();
      }
      g.globalAlpha = 1;
    }

    // ---- spray -> words ----
    if (S.spray > 0 && S.nozzle) {
      if (!this.textPts && S.mottoEl) this.sampleText(S.mottoEl);
      const [nx, ny] = S.nozzle;
      const base = S.sprayDir;
      const reach = Math.max(w, h) * 0.75;
      const form = S.form;
      g.globalCompositeOperation = 'source-over';
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
      g.fillStyle = warm > 0.5 ? 'rgb(255,218,165)' : rgb(S.accent, 1);
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
          const fi = easeOut(cl(form * 1.4 - d.f));
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
