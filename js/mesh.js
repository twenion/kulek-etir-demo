// Procedural geometry for the bottle: twisted rounded boxes (glass body, juice, plaque) and lathed parts
// (collar, pump stem, actuator, fluted cap). Every mesh carries position, normal and its untwisted position.

export const TW = 0.3; // twist of the glass, radians per unit of height

function axisCoords(e, R, nb, nm) {
  const out = [];
  for (let i = 0; i <= nb; i++) { const f = -Math.PI / 4 + (Math.PI / 4) * (i / nb); out.push(-(e - R) + R * Math.tan(f)); }
  for (let i = 1; i < nm; i++) out.push(-(e - R) + (2 * (e - R) * i) / nm);
  for (let i = 0; i <= nb; i++) { const f = (Math.PI / 4) * (i / nb); out.push(e - R + R * Math.tan(f)); }
  return out;
}

// rounded box (Minkowski sum of a box and a sphere), optionally twisted around y
export function roundedBox(ext, R, { twist = 0, center = [0, 0, 0], nb = 7, seg = [10, 26, 8] } = {}) {
  const pos = [], nrm = [], ref = [], idx = [];
  const coords = [0, 1, 2].map((a) => axisCoords(ext[a], R, nb, seg[a]));
  for (let k = 0; k < 3; k++) {
    for (const s of [-1, 1]) {
      const a = (k + 1) % 3, b = (k + 2) % 3;
      const A = coords[a], B = coords[b];
      const base = pos.length / 3;
      for (let j = 0; j < B.length; j++) {
        for (let i = 0; i < A.length; i++) {
          const p = [0, 0, 0];
          p[k] = s * ext[k]; p[a] = A[i]; p[b] = B[j];
          const inner = p.map((v, ax) => Math.max(-(ext[ax] - R), Math.min(ext[ax] - R, v)));
          let n = p.map((v, ax) => v - inner[ax]);
          const l = Math.hypot(n[0], n[1], n[2]) || 1;
          n = n.map((v) => v / l);
          const q = inner.map((v, ax) => v + n[ax] * R + center[ax]);
          ref.push(q[0], q[1], q[2]);
          if (twist) {
            const y = q[1] - center[1] + center[1];
            const th = twist * y, c = Math.cos(th), sn = Math.sin(th);
            const x = q[0], z = q[2];
            pos.push(c * x - sn * z, q[1], sn * x + c * z);
            // normal through the inverse-transpose of the twist
            const nx = c * n[0] - sn * n[2];
            const ny = twist * z * n[0] + n[1] - twist * x * n[2];
            const nz = sn * n[0] + c * n[2];
            const nl = Math.hypot(nx, ny, nz);
            nrm.push(nx / nl, ny / nl, nz / nl);
          } else {
            pos.push(q[0], q[1], q[2]);
            nrm.push(n[0], n[1], n[2]);
          }
        }
      }
      // winding: outward
      const W = A.length;
      for (let j = 0; j < B.length - 1; j++) {
        for (let i = 0; i < W - 1; i++) {
          const v0 = base + j * W + i, v1 = v0 + 1, v2 = v0 + W, v3 = v2 + 1;
          if (s > 0) idx.push(v0, v1, v3, v0, v3, v2); else idx.push(v0, v3, v1, v0, v2, v3);
        }
      }
    }
  }
  return pack(pos, nrm, ref, idx);
}

// profile of a cylinder with rounded edges: [{r, y, nr, ny}]
function roundCylProfile(R, h, rr, arc = 6) {
  const P = [{ r: 0, y: -h, nr: 0, ny: -1 }];
  for (let i = 0; i <= arc; i++) { const a = -Math.PI / 2 + (Math.PI / 2) * (i / arc); P.push({ r: R - rr + Math.cos(a) * rr, y: -h + rr + Math.sin(a) * rr, nr: Math.cos(a), ny: Math.sin(a) }); }
  const mid = 10;
  for (let i = 1; i < mid; i++) P.push({ r: R, y: -h + rr + ((2 * (h - rr)) * i) / mid, nr: 1, ny: 0 });
  for (let i = 0; i <= arc; i++) { const a = (Math.PI / 2) * (i / arc); P.push({ r: R - rr + Math.cos(a) * rr, y: h - rr + Math.sin(a) * rr, nr: Math.cos(a), ny: Math.sin(a) }); }
  P.push({ r: 0, y: h, nr: 0, ny: 1 });
  return P;
}

export function lathe(R, h, rr, { seg = 72, flutes = 0, amp = 0, center = [0, 0, 0] } = {}) {
  const prof = roundCylProfile(R, h, rr);
  const pos = [], nrm = [], ref = [], idx = [];
  for (let j = 0; j < prof.length; j++) {
    const p = prof[j];
    const side = Math.pow(Math.max(0, p.nr), 6) * (p.r > R * 0.5 ? 1 : 0);
    for (let i = 0; i <= seg; i++) {
      const th = (i / seg) * Math.PI * 2;
      const c = Math.cos(th), s = Math.sin(th);
      const f = flutes ? amp * side * Math.cos(flutes * th) : 0;
      const r = p.r + f;
      const x = c * r, z = s * r;
      pos.push(x + center[0], p.y + center[1], z + center[2]);
      ref.push(x + center[0], p.y + center[1], z + center[2]);
      let nx = p.nr * c, ny = p.ny, nz = p.nr * s;
      if (flutes && side > 0) {
        const dr = -amp * side * flutes * Math.sin(flutes * th);
        const k = dr / Math.max(r, 1e-3);
        nx -= k * -s; nz -= k * c;
      }
      const l = Math.hypot(nx, ny, nz) || 1;
      nrm.push(nx / l, ny / l, nz / l);
    }
  }
  const W = seg + 1;
  for (let j = 0; j < prof.length - 1; j++) for (let i = 0; i < seg; i++) {
    const a = j * W + i, b = a + 1, c2 = a + W, d = c2 + 1;
    idx.push(a, c2, b, b, c2, d);
  }
  return pack(pos, nrm, ref, idx);
}

function pack(pos, nrm, ref, idx) {
  return { pos: new Float32Array(pos), nrm: new Float32Array(nrm), ref: new Float32Array(ref), idx: new Uint32Array(idx), count: idx.length };
}

// points on the bottle surface (local, untwisted for the body is fine for particles)
export function samplePoints(mesh, n, seed = 1) {
  let s = seed;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const out = [];
  const vcount = mesh.pos.length / 3;
  for (let i = 0; i < n; i++) { const v = Math.floor(r() * vcount); out.push([mesh.pos[v * 3], mesh.pos[v * 3 + 1], mesh.pos[v * 3 + 2]]); }
  return out;
}
