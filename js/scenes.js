// Scroll position -> where the bottle, the camera, the weather and the 2D layers should be.
// Each scene gets its own progress p (0..1). Values here are targets; main.js eases toward them.

const cl = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ss = (a, b, x) => { const t = cl((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const TAU = Math.PI * 2;

// wind headings on screen (canvas y points down): Xəzri blows from the north toward the south-east,
// Gilavar from the south toward the north-west
export const WIND_X = 1.05;
export const WIND_G = 1.05 + Math.PI;

export function fill(level) { // juice level 0..1 -> how full each of the three layers is
  return [cl(level / 0.333), cl((level - 0.333) / 0.333), cl((level - 0.666) / 0.194)];
}

export function scene(name, p, c) {
  const M = c.mobile;
  const X = (fr) => (fr * c.aspect) / 2; // fraction of half-width -> uv units
  const s = {
    dist: M ? 9 : 6.6, ty: 0.3, pitch: 0.06, offX: M ? 0 : X(0.42), offY: M ? 0.17 : 0,
    yawAdd: 0, spin: 0, tilt: 0, roll: 0, bob: 1,
    explode: 0, capOff: 0, press: 0, level: 0.86, layerWarm: [0, 0, 0], warm: 0, nameWarm: 0,
    shadow: 1, wordA: [0, 0, 0], wordX: [0, 0, 0], wordY: 0, wordW: c.aspect * 0.94, scale: 1,
    fog: 0, wind: 0, windAng: WIND_X, ingr: null, spray: 0, form: 0, sprayDir: -0.35,
  };
  s.wordY = s.offY;

  switch (name) {
    case 'hero': {
      s.spin = 0.22;
      s.wordA = [0.9 * (1 - ss(0.2, 0.9, p)), 0, 0];
      s.fog = 1; s.wind = 0.35 * (1 - p);
      if (!M) s.offX = lerp(X(0.42), X(0.38), p);
      break;
    }
    case 'spin': {
      const e = ss(0, 1, p);
      s.yawAdd = p * TAU;
      s.dist = M ? lerp(8.6, 7, e) : lerp(5.8, 4.5, e);
      s.ty = lerp(0.3, 0.45, e);
      s.pitch = 0.06 + 0.2 * Math.sin(Math.PI * p);
      s.offX = M ? 0 : X(0.38);
      s.offY = M ? 0.15 : 0;
      s.fog = 0.5;
      s.ui = { deg: Math.round(p * 360) % 361, spin: p };
      break;
    }
    case 'explode': {
      const e = ss(0.06, 0.42, p) * (1 - ss(0.9, 1, p));
      s.explode = e;
      s.yawAdd = TAU - 0.55 * e + p * 0.35;
      s.dist = M ? lerp(7, 12.5, e) : lerp(4.6, 8.8, e);
      s.ty = lerp(0.3, 0.85, e);
      s.pitch = 0.1;
      s.offX = M ? lerp(0, -0.065, e) : X(lerp(0.38, 0.1, e));
      s.offY = M ? lerp(0.15, 0.06, e) : 0;
      s.shadow = 1 - e;
      s.fog = 0.25;
      s.ui = { tags: e, tagP: p };
      break;
    }
    case 'xezri': {
      const drain = ss(0, 0.1, p);
      const lv = 0.333 * ss(0.14, 0.36, p) + 0.333 * ss(0.38, 0.6, p) + 0.194 * ss(0.62, 0.82, p);
      s.level = p < 0.12 ? lerp(0.86, 0, drain) : lv;
      s.yawAdd = TAU + 0.25 + p * 0.8;
      s.spin = 0.04;
      s.dist = M ? 10 : 5.6;
      s.ty = 0.25;
      s.offX = M ? 0 : X(-0.28);
      s.offY = M ? 0.2 : 0;
      s.wordA = [0, 0.85 * ss(0, 0.18, p), 0];
      s.wordX = [0, lerp(0.35, 0, ss(0, 0.35, p)), 0];
      s.wordY = s.offY;
      s.fog = 0.45;
      s.ingr = { xezri: { in: [ss(0.13, 0.32, p), ss(0.37, 0.56, p), ss(0.61, 0.8, p)], out: 0 } };
      s.ui = { layers: p < 0.12 ? [0, 0, 0] : fill(lv) };
      break;
    }
    case 'wind': {
      const w = ss(0.18, 0.6, p);
      s.warm = w; s.nameWarm = w;
      s.layerWarm = [ss(0.25, 0.42, p), ss(0.33, 0.5, p), ss(0.41, 0.58, p)];
      s.yawAdd = TAU + 1.05 + p * 1.8;
      s.spin = 0.04;
      s.roll = 0.07 * Math.sin(Math.PI * ss(0.08, 0.7, p));
      s.dist = M ? 10 : 5.8;
      s.ty = 0.25;
      s.offX = M ? 0 : lerp(X(-0.28), X(0.02), ss(0, 0.25, p));
      s.offY = M ? 0.2 : 0;
      const outX = ss(0.2, 0.42, p), inG = ss(0.42, 0.64, p);
      s.wordA = [0, 0.85 * (1 - outX), 0.85 * inG];
      s.wordX = [0, -outX * 0.8, (1 - inG) * 0.8];
      s.wordY = s.offY;
      s.wind = ss(0.05, 0.18, p) * (1 - ss(0.86, 1, p));
      s.windAng = lerp(WIND_X, WIND_G, w);
      s.fog = 0.3;
      s.ingr = {
        xezri: { in: [1, 1, 1], out: ss(0.12, 0.4, p) },
        gilavar: { in: [ss(0.5, 0.66, p), ss(0.58, 0.74, p), ss(0.66, 0.82, p)], out: 0 },
      };
      s.ui = { needle: w * 180, layersG: s.layerWarm };
      break;
    }
    case 'spray': {
      const k = ss(0, 0.3, p);
      s.warm = 1; s.nameWarm = 1; s.layerWarm = [1, 1, 1];
      s.capOff = ss(0.04, 0.24, p);
      s.yawAdd = TAU * 2 + 0.35;
      s.dist = M ? lerp(10, 6.6, k) : lerp(5.8, 3.7, k);
      s.ty = lerp(0.25, 1.0, k);
      s.offX = M ? lerp(0, -0.05, k) : X(lerp(0.02, -0.52, k));
      s.offY = M ? lerp(0.2, -0.16, k) : lerp(0, -0.08, k);
      s.press = ss(0.29, 0.31, p) * (1 - ss(0.34, 0.4, p));
      s.spray = cl((p - 0.3) / 0.32);
      s.form = ss(0.56, 0.8, p);
      s.sprayDir = M ? -1.05 : -0.32;
      s.shadow = 0; s.bob = 0.3;
      s.ui = { motto: p > 0.8 };
      break;
    }
    case 'shop': {
      const pick = c.pick;
      s.warm = pick; s.nameWarm = pick; s.layerWarm = [pick, pick, pick];
      s.spin = 0.16;
      s.dist = M ? 10.5 : 6.2;
      s.offX = M ? 0 : X(0.42);
      s.offY = M ? 0.27 : 0.02;
      s.scale = c.volScale;
      s.wordA = [0, 0.8 * (1 - pick), 0.8 * pick];
      s.wordY = s.offY;
      if (!M) { s.wordW = c.aspect * 0.46; s.wordX = [s.offX, s.offX, s.offX]; }
      s.fog = 0.25;
      break;
    }
  }
  return s;
}
