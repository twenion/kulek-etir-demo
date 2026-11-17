// Scroll position -> where the camera, the bottle and the weather should be. Each scene gets its own
// progress p (0..1). Values are targets; main.js eases toward them. The bottle always stays centred:
// the page is a stage, not a column of text next to a picture.

const cl = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ss = (a, b, x) => { const t = cl((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const TAU = Math.PI * 2;

// wind headings on screen (canvas y points down): Xəzri comes from the north, Gilavar from the south
export const WIND_X = 1.05;
export const WIND_G = 1.05 + Math.PI;

export function scene(name, p, c) {
  const M = c.mobile;
  const far = M ? 9.2 : 7.0;
  const s = {
    dist: far, ty: 0.32, pitch: 0.06, offX: 0, offY: M ? 0.1 : 0.06,
    yaw: 0.35, idle: 0, tilt: 0, roll: 0, bob: 1,
    explode: 0, capOff: 0, press: 0, level: 0.86, layerWarm: [0, 0, 0], warm: 0, nameWarm: 0,
    shadow: 1, wordA: [0, 0, 0], wordX: [0, 0, 0], wordY: 0, wordW: c.aspect * (M ? 1.02 : 0.96), scale: 1,
    fog: 0.35, wind: 0, windAng: WIND_X, orbitAmt: 0, inside: 0, depth: 0, spray: 0, form: 0, sprayDir: -1.4,
    ui: {},
  };
  s.wordY = s.offY - 0.02;

  switch (name) {
    case 'hero': {
      s.idle = 0.24;
      s.dist = far * 1.06; s.offY += 0.03; s.wordY = s.offY - 0.02;
      s.wordA = [0.9 * (1 - ss(0.25, 0.9, p)), 0, 0];
      s.fog = 0.9; s.wind = 0.3 * (1 - p);
      break;
    }
    case 'spin': {
      // A: push in to the fluted cap · B: glide down to the plaque · C: pull back with a full turn
      const a = ss(0.02, 0.3, p), b = ss(0.34, 0.58, p), k = ss(0.64, 0.96, p);
      const near = M ? 2.9 : 2.05;
      s.dist = lerp(lerp(lerp(far, near, a), near * 0.92, b), far, k);
      s.ty = lerp(lerp(lerp(0.32, 1.22, a), -0.12, b), 0.32, k);
      s.pitch = lerp(lerp(lerp(0.06, 0.2, a), 0.03, b), 0.06, k);
      s.offY = lerp(lerp(s.offY, 0, a), s.offY, k);
      s.yaw = lerp(lerp(0.9 - p * 0.8, 0.02, b), 0, k) + TAU * ss(0.64, 1, p);
      s.fog = 0.25 * (1 - a) + 0.25 * k;
      s.ui = { deg: Math.round(ss(0.64, 1, p) * 360), degO: ss(0.62, 0.68, p) };
      break;
    }
    case 'explode': {
      const e = ss(0.06, 0.42, p) * (1 - ss(0.9, 1, p));
      s.explode = e;
      s.yaw = -0.5 * e + p * 0.4;
      s.dist = lerp(far, M ? 14 : 9.6, e);
      s.ty = lerp(0.32, 0.85, e);
      s.pitch = 0.1;
      s.offX = M ? lerp(0, -0.07, e) : 0;
      s.offY = lerp(s.offY, M ? 0.02 : 0, e);
      s.shadow = 1 - e;
      s.fog = 0.2;
      s.ui = { tags: e, tagP: p };
      break;
    }
    case 'xezri': {
      // outside, then a dive into the juice, three layers down, and back out
      const dive = ss(0.16, 0.32, p);
      const out = ss(0.9, 0.97, p);
      s.yaw = 0.3 + p * 0.6;
      s.dist = lerp(lerp(far * 1.1, 0.5, dive * dive), far, out);
      s.ty = lerp(lerp(0.32, 0.62, dive), 0.32, out);
      s.pitch = lerp(0.06, 0, dive);
      s.offY = lerp(s.offY + 0.07, 0, dive);
      s.inside = ss(0.25, 0.31, p) * (1 - out);
      s.depth = cl((p - 0.31) / 0.57);
      s.wordA = [0, 0.85 * ss(0, 0.1, p) * (1 - dive), 0];
      s.fog = 0.3 * (1 - dive);
      const centres = [0.83, 0.5, 0.17];
      s.ui = { depth: s.depth, layers: centres.map((cc) => ({ o: s.inside * cl(1 - Math.abs(s.depth - cc) / 0.17), dy: (cc - s.depth) * 360 })) };
      break;
    }
    case 'wind': {
      const w = ss(0.2, 0.6, p);
      s.warm = w; s.nameWarm = w;
      s.layerWarm = [ss(0.26, 0.42, p), ss(0.34, 0.5, p), ss(0.42, 0.58, p)];
      const storm = ss(0.06, 0.22, p) * (1 - ss(0.66, 0.82, p));
      s.yaw = 0.2 + TAU * 2 * ss(0.1, 0.7, p);
      s.roll = 0.08 * Math.sin(p * 9) * storm;
      s.tilt = 0.05 * storm;
      s.wind = 0.25 + 1.35 * storm;
      s.windAng = lerp(WIND_X, WIND_G, w);
      s.fog = 0.3 + 0.9 * storm;
      s.wordA = [0, 0.85 * (1 - ss(0.18, 0.4, p)), 0.85 * ss(0.48, 0.66, p)];
      s.wordX = [0, -ss(0.18, 0.4, p) * 0.9, (1 - ss(0.48, 0.66, p)) * 0.9];
      s.orbitAmt = ss(0.6, 0.76, p);
      const lift = ss(0.56, 0.68, p);
      s.offY = lerp(s.offY + 0.05, s.offY + 0.08, lift);
      s.dist = lerp(far * 1.08, far * 1.14, lift);
      s.wordY = s.offY - 0.02;
      s.ui = { needle: w * 180, ring: ss(0.04, 0.14, p) * (1 - ss(0.5, 0.6, p)) };
      break;
    }
    case 'spray': {
      const k = ss(0, 0.28, p);
      s.warm = 1; s.nameWarm = 1; s.layerWarm = [1, 1, 1];
      s.capOff = ss(0.05, 0.24, p);
      s.yaw = 0.25;
      s.dist = lerp(far, M ? 7.4 : 5.2, k);
      s.ty = lerp(0.32, 0.8, k);
      s.offY = lerp(s.offY, M ? -0.2 : -0.17, k);
      s.press = ss(0.29, 0.31, p) * (1 - ss(0.34, 0.4, p));
      s.spray = cl((p - 0.3) / 0.32);
      s.form = ss(0.56, 0.8, p);
      s.sprayDir = M ? -1.62 : -1.5;
      s.shadow = 0; s.bob = 0.3; s.fog = 0.15;
      s.ui = { motto: p > 0.8 };
      break;
    }
    case 'shop': {
      const pick = c.pick;
      s.warm = pick; s.nameWarm = pick; s.layerWarm = [pick, pick, pick];
      s.idle = 0.18;
      s.dist = M ? 10.4 : 7.2;
      s.offY = M ? 0.15 : 0.1;
      s.scale = c.volScale;
      s.wordA = [0, 0.8 * (1 - pick), 0.8 * pick];
      s.wordY = s.offY;
      s.fog = 0.25;
      break;
    }
  }
  return s;
}
