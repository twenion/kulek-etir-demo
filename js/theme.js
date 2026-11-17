// Two weathers. Everything that changes colour between Xəzri (cold, north) and Gilavar (warm, south).

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);

export const COLD = {
  bgTop: hex('#e9eff1'), bgBot: hex('#c3d0d6'), glow: [0.05, 0.06, 0.065],
  envTop: hex('#eef3f5'), envBot: hex('#b3c2c9'), key: [0.2, 0.215, 0.225], flag: hex('#14232b'), flagAmt: 0.75, fill: 0.5, glowIn: 0.5,
  metal: hex('#c9ced3'), word: hex('#d3dde1'), shadow: 0.22,
  // CSS
  ink: hex('#10202a'), muted: hex('#4c6370'), accent: hex('#1d5873'), line: hex('#9db0b9'), panel: hex('#f3f6f7'),
};

export const WARM = {
  bgTop: hex('#2b170b'), bgBot: hex('#0d0603'), glow: [0.42, 0.2, 0.06],
  envTop: hex('#3d210e'), envBot: hex('#1c0e06'), key: [1.0, 0.7, 0.4], flag: hex('#050302'), flagAmt: 0.0, fill: 0.35, glowIn: 2.2,
  metal: hex('#e3b064'), word: hex('#3a2210'), shadow: 0.55,
  ink: hex('#f4e6cf'), muted: hex('#c4a585'), accent: hex('#e8a33c'), line: hex('#6b4a2c'), panel: hex('#1c0f07'),
};

// juice layers: base, heart, top
export const LIQ_COLD = [hex('#7fb2c4'), hex('#a9d2dc'), hex('#d4e8d8')];
export const LIQ_WARM = [hex('#b5480c'), hex('#d3711c'), hex('#f2b13a')];

const mix = (a, b, t) => (Array.isArray(a) ? a.map((v, i) => v + (b[i] - v) * t) : a + (b - a) * t);

export function themeAt(t) {
  const o = {};
  for (const k in COLD) o[k] = mix(COLD[k], WARM[k], t);
  return o;
}

const css = (c) => `rgb(${c.map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255)).join(' ')})`;

let last = -1;
export function applyCss(t, root = document.documentElement) {
  const q = Math.round(t * 200) / 200;
  if (q === last) return;
  last = q;
  const T = themeAt(q);
  root.style.setProperty('--ink', css(T.ink));
  root.style.setProperty('--muted', css(T.muted));
  root.style.setProperty('--accent', css(T.accent));
  root.style.setProperty('--line', css(T.line));
  root.style.setProperty('--panel', css(T.panel));
  root.style.setProperty('--bg-top', css(T.bgTop));
  root.style.setProperty('--bg-bot', css(T.bgBot));
  root.style.setProperty('--warm', q.toFixed(3));
  root.dataset.weather = q > 0.5 ? 'gilavar' : 'xezri';
}
