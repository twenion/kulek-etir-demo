// Engraving-style line drawings of the notes (SVG, 120×120). Ink colour + a soft wash, baked to canvases.

const cube = (cx, cy, s) => {
  const p = (x, y) => `${(cx + x * s).toFixed(1)} ${(cy + y * s).toFixed(1)}`;
  return {
    top: `M${p(0, -1)} L${p(0.87, -0.5)} L${p(0, 0)} L${p(-0.87, -0.5)} Z`,
    out: `M${p(0, -1)} L${p(0.87, -0.5)} L${p(0.87, 0.5)} L${p(0, 1)} L${p(-0.87, 0.5)} L${p(-0.87, -0.5)} Z M${p(0, 0)} L${p(0, 1)} M${p(0, 0)} L${p(0.87, -0.5)} M${p(0, 0)} L${p(-0.87, -0.5)}`,
  };
};

const SALT = [cube(48, 70, 22), cube(80, 78, 15), cube(66, 44, 13), cube(28, 92, 8), cube(96, 54, 7)];

export const DRAW = {
  bergamot: {
    wash: '#c9d45a',
    fill: '<circle cx="56" cy="68" r="32"/><path d="M64 22 C76 11 96 13 105 24 C93 32 74 32 64 22 Z"/>',
    ink: `<circle cx="56" cy="68" r="32"/>
      <path d="M56 36 C56 30 59 25 64 21"/>
      <path d="M64 22 C76 11 96 13 105 24 C93 32 74 32 64 22 Z"/><path d="M67 22 C80 21 92 22 102 24"/>
      <path d="M33 58 C36 48 43 41 51 38"/>
      <path d="M40 64 h.1 M47 52 h.1 M66 50 h.1 M75 66 h.1 M49 82 h.1 M63 88 h.1 M36 76 h.1 M58 66 h.1 M72 82 h.1 M44 70 h.1 M60 56 h.1" stroke-width="2.6"/>`,
  },
  salt: {
    wash: '#cfe3ea',
    fill: SALT.map((c) => `<path d="${c.top}"/>`).join(''),
    ink: SALT.map((c) => `<path d="${c.out}"/>`).join(''),
  },
  cedar: {
    wash: '#9b6c45',
    fill: '<path d="M62 40 C78 40 84 64 80 82 C76 99 48 99 44 82 C40 64 46 40 62 40 Z"/>',
    ink: `<path d="M62 40 C78 40 84 64 80 82 C76 99 48 99 44 82 C40 64 46 40 62 40 Z"/>
      <path d="M50 52 q6 6 12 0 q6 6 12 0 M46 62 q5 6 10 0 q6 6 12 0 q5 6 10 0 M45 73 q6 6 12 0 q6 6 12 0 q5 6 9 0 M47 84 q6 6 12 0 q6 6 12 0"/>
      <path d="M62 40 C58 30 48 22 34 18"/>
      <path d="M52 30 l-6 -9 M52 30 l-9 -3 M44 25 l-4 -9 M44 25 l-9 -1 M38 21 l-3 -8 M38 21 l-8 1 M58 35 l-2 -10 M58 35 l7 -7"/>`,
  },
  saffron: {
    wash: '#8f7bb8',
    fill: '<path d="M60 92 C46 78 40 56 48 40 C56 52 60 70 60 92 Z"/><path d="M60 92 C74 78 80 56 72 40 C64 52 60 70 60 92 Z"/><path d="M60 92 C56 70 56 48 60 30 C64 48 64 70 60 92 Z"/>',
    ink: `<path d="M60 92 C46 78 40 56 48 40 C56 52 60 70 60 92 Z"/><path d="M60 92 C74 78 80 56 72 40 C64 52 60 70 60 92 Z"/><path d="M60 92 C56 70 56 48 60 30 C64 48 64 70 60 92 Z"/>
      <path d="M60 92 C60 100 58 108 54 114 M60 92 C64 101 70 106 78 110 M62 96 C54 100 46 104 38 104"/>
      <g stroke="#c8321b" stroke-width="2.4"><path d="M60 70 C58 52 48 36 36 26"/><path d="M60 70 C66 50 80 38 92 34"/><path d="M60 70 C62 48 66 30 72 16"/></g>`,
  },
  fig: {
    wash: '#7a4459',
    fill: '<path d="M52 30 C58 30 60 38 62 44 C78 54 84 74 75 88 C66 102 40 102 31 88 C22 74 28 54 44 44 C46 38 48 30 52 30 Z"/>',
    ink: `<path d="M64 20 C70 8 84 4 90 12 C98 6 110 12 106 24 C116 30 112 44 100 44 C100 54 88 58 80 50 C74 44 70 34 64 20 Z"/>
      <path d="M64 20 C76 28 88 36 100 44 M78 28 C84 22 88 16 90 12 M86 34 C94 32 100 28 106 24"/>
      <path d="M52 30 C58 30 60 38 62 44 C78 54 84 74 75 88 C66 102 40 102 31 88 C22 74 28 54 44 44 C46 38 48 30 52 30 Z"/>
      <path d="M52 30 C52 24 56 19 62 18"/>
      <path d="M34 66 C36 58 41 52 47 49"/>
      <path d="M44 96 h.1 M53 98 h.1 M62 96 h.1" stroke-width="2.4"/>`,
  },
  amber: {
    wash: '#e39a2c',
    fill: '<path d="M52 16 C56 34 78 50 78 74 C78 92 66 102 52 102 C38 102 26 92 26 74 C26 50 48 34 52 16 Z"/><path d="M90 52 C92 62 102 70 102 82 C102 92 96 98 88 98 C80 98 74 92 74 82 C74 70 88 62 90 52 Z"/>',
    ink: `<path d="M52 16 C56 34 78 50 78 74 C78 92 66 102 52 102 C38 102 26 92 26 74 C26 50 48 34 52 16 Z"/>
      <path d="M90 52 C92 62 102 70 102 82 C102 92 96 98 88 98 C80 98 74 92 74 82 C74 70 88 62 90 52 Z"/>
      <path d="M38 70 C38 60 42 52 47 46" stroke-width="2.2"/><path d="M80 80 C80 74 82 70 85 67" stroke-width="2"/>
      <path d="M40 88 C46 94 58 95 66 88"/>`,
  },
};

function svg(kind, ink) {
  const d = DRAW[kind];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="240" height="240">
    <g fill="${d.wash}" fill-opacity=".38" stroke="none">${d.fill}</g>
    <g fill="none" stroke="${ink}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${d.ink}</g></svg>`;
}

// photographed notes (transparent WebP, two takes each), baked once with a soft shadow;
// until they load, or if they fail, the line drawings below stand in
export function loadPhotos(kinds, base = 'img/notes/') {
  const out = {};
  for (const k of kinds) {
    out[k] = [];
    for (const v of ['a', 'b']) {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        const s = 384, pad = 96;
        const c = document.createElement('canvas');
        c.width = c.height = s + pad * 2;
        const g = c.getContext('2d');
        g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = 30; g.shadowOffsetY = 14;
        const r = Math.min(s / img.naturalWidth, s / img.naturalHeight);
        const w = img.naturalWidth * r, h = img.naturalHeight * r;
        g.drawImage(img, pad + (s - w) / 2, pad + (s - h) / 2, w, h);
        out[k].push(c);
      };
      img.src = `${base}${k}-${v}.webp`;
    }
  }
  return out;
}

// returns { kind: { cold: canvas, warm: canvas } }, filled once images load
export function bakeBotanica(inkCold, inkWarm) {
  const out = {};
  for (const kind in DRAW) {
    out[kind] = {};
    for (const [k, ink] of [['cold', inkCold], ['warm', inkWarm]]) {
      const c = document.createElement('canvas');
      c.width = c.height = 240;
      const img = new Image();
      img.onload = () => c.getContext('2d').drawImage(img, 0, 0, 240, 240);
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg(kind, ink));
      out[kind][k] = c;
    }
  }
  return out;
}
