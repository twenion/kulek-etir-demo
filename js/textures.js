// Canvas-drawn textures for the shader: the engraved plaque and the giant words behind the bottle.

export async function fontsReady() {
  try {
    await Promise.all([
      document.fonts.load('400 120px "Libre Bodoni"', 'KÜLƏK XƏZRİ GİLAVAR'),
      document.fonts.load('500 40px "Albert Sans"', 'XƏZRİ GİLAVAR'),
    ]);
  } catch (e) { /* fall back to whatever is loaded */ }
}

// r: brand, g: "XƏZRİ", b: "GİLAVAR" — white ink on black, read as masks
export function labelCanvas() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 612;
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = 'lighter';
  const W = c.width, H = c.height;
  const layer = (color, draw) => { g.fillStyle = color; g.strokeStyle = color; draw(); };
  layer('#f00', () => {
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '400 150px "Libre Bodoni", serif';
    spaced(g, 'KÜLƏK', W / 2, H * 0.4, 0.12);
    g.lineWidth = 4;
    g.beginPath(); g.moveTo(W * 0.3, H * 0.66); g.lineTo(W * 0.7, H * 0.66); g.stroke();
    g.font = '500 44px "Albert Sans", sans-serif';
    spaced(g, 'BAKI', W / 2, H * 0.84, 0.5);
  });
  layer('#0f0', () => { g.font = '500 58px "Albert Sans", sans-serif'; g.textAlign = 'center'; spaced(g, 'XƏZRİ', W / 2, H * 0.12 + 18, 0.45); });
  layer('#00f', () => { g.font = '500 58px "Albert Sans", sans-serif'; g.textAlign = 'center'; spaced(g, 'GİLAVAR', W / 2, H * 0.12 + 18, 0.45); });
  return c;
}

// three rows, 4:1 each: KÜLƏK, XƏZRİ, GİLAVAR (alpha mask)
export function wordsCanvas() {
  const c = document.createElement('canvas');
  const W = 2048, H = 512;
  c.width = W; c.height = H * 3;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  ['KÜLƏK', 'XƏZRİ', 'GİLAVAR'].forEach((w, i) => {
    let size = 470;
    g.font = `400 ${size}px "Libre Bodoni", serif`;
    const m = g.measureText(w).width;
    size = Math.min(size, (size * W * 0.96) / m);
    g.font = `400 ${size}px "Libre Bodoni", serif`;
    g.fillText(w, W / 2, H * i + H * 0.5 + size * 0.36);
  });
  return c;
}

function spaced(g, text, x, y, em) {
  const size = parseFloat(g.font.match(/(\d+)px/)[1]);
  const gap = size * em;
  const widths = [...text].map((ch) => g.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + gap * (text.length - 1);
  let cx = x - total / 2;
  const align = g.textAlign;
  g.textAlign = 'left';
  [...text].forEach((ch, i) => { g.fillText(ch, cx, y); cx += widths[i] + gap; });
  g.textAlign = align;
}
