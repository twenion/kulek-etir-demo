// Two weathers. Everything that changes colour between Xəzri (cold, north) and Gilavar (warm, south).

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);

// Xəzri: a Caspian storm at dawn — deep petrol water, silver light
export const COLD = {
  bgTop: hex('#1d3b47'), bgBot: hex('#07141a'), glow: [0.05, 0.12, 0.15],
  envTop: hex('#2c4b58'), envBot: hex('#0a181e'), key: [0.78, 0.9, 0.97], flag: hex('#03080a'), flagAmt: 0.35,
  metal: hex('#cdd6dc'), word: hex('#21404c'), shadow: 0.5, accent: hex('#9fdcee'),
  ink: hex('#e9f3f6'), muted: hex('#9db8c2'), cssAccent: hex('#8fd3e8'), line: hex('#35525d'), panel: hex('#0c1c23'),
};

// Gilavar: the warm south wind at dusk — burnt saffron, brass
export const WARM = {
  bgTop: hex('#2e180b'), bgBot: hex('#0d0603'), glow: [0.42, 0.2, 0.06],
  envTop: hex('#4a2a12'), envBot: hex('#1c0e06'), key: [1.0, 0.72, 0.42], flag: hex('#050302'), flagAmt: 0.2,
  metal: hex('#e3b064'), word: hex('#3d2411'), shadow: 0.55, accent: hex('#ffc46b'),
  ink: hex('#f6e8d2'), muted: hex('#c9a988'), cssAccent: hex('#e8a33c'), line: hex('#6b4a2c'), panel: hex('#1c0f07'),
};

// one juice per fragrance, only a little deeper towards the bottom (real perfume does not layer);
// the three stops let the colour change rise through the bottle when the wind turns
export const LIQ_COLD = [hex('#2b8399'), hex('#3b98ad'), hex('#4ea8bb')];
export const LIQ_WARM = [hex('#b04f0d'), hex('#c46317'), hex('#d27621')];

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
  root.style.setProperty('--accent', css(T.cssAccent));
  root.style.setProperty('--line', css(T.line));
  root.style.setProperty('--panel', css(T.panel));
  root.style.setProperty('--bg-top', css(T.bgTop));
  root.style.setProperty('--bg-bot', css(T.bgBot));
  root.style.setProperty('--warm', q.toFixed(3));
  root.dataset.weather = q > 0.5 ? 'gilavar' : 'xezri';
}
