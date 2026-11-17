// The juice inside the bottle. Its surface stays level in the world (so when the bottle rolls, the
// juice does not), and a damped spring makes it slosh when anything pushes it: scroll speeding up or
// slowing down, the bottle starting or stopping a spin, the camera swinging it across the screen,
// storm gusts, a press on the pump, the parts separating, a new size or fragrance being picked.
import { rotMat } from './bottle.js';

const K = 46;          // stiffness: ~1.1 sloshes per second
const C = 2.4;         // damping: a few swings, then settles
const MAX = 0.48;      // never tip far enough to spill out of the cavity

export class Slosh {
  constructor(reduced) {
    this.reduced = reduced;
    this.x = 0; this.z = 0; this.vx = 0; this.vz = 0;
    this.sv = 0; this.yv = 0; this.mx = 0; this.my = 0;
    this.amp = 0; this.kick = 0; this.prev = null;
  }

  // S: render state, cam: camera basis, ext: { scrollY, cx, cy, wind, warm, t }
  update(dt, S, cam, ext) {
    const cur = { scroll: ext.scrollY, yaw: S.yaw, ex: S.explode, press: S.press, scale: S.scale, cx: ext.cx, cy: ext.cy, warm: ext.warm };
    const p = this.prev;
    this.prev = cur;
    let fu = 0, fw = 0;
    if (p && !this.reduced) {
      const lerp = Math.min(1, dt * 10);
      const sv = (cur.scroll - p.scroll) / dt;
      const sv2 = this.sv + (sv - this.sv) * lerp;
      const sa = (sv2 - this.sv) / dt; this.sv = sv2;
      const yv = (cur.yaw - p.yaw) / dt;
      const yv2 = this.yv + (yv - this.yv) * lerp;
      const ya = (yv2 - this.yv) / dt; this.yv = yv2;
      const mx = (cur.cx - p.cx) / dt, my = (cur.cy - p.cy) / dt;
      const mx2 = this.mx + (mx - this.mx) * lerp, my2 = this.my + (my - this.my) * lerp;
      const ax = (mx2 - this.mx) / dt, ay = (my2 - this.my) / dt;
      this.mx = mx2; this.my = my2;
      // the juice lags behind whatever moves the bottle
      fu += -sa * 0.0016 - ya * 0.7 - ax * 0.0024;
      fw += sa * 0.0005 + ay * 0.0006;
      if (ext.wind > 0.3) {
        const g = ext.wind - 0.3;
        fu += (Math.sin(ext.t * 1.7) + 0.6 * Math.sin(ext.t * 2.9 + 1)) * g * 9;
        fw += Math.sin(ext.t * 2.3 + 2) * g * 6;
      }
      this.kick += Math.abs(cur.ex - p.ex) / dt * 0.5 + Math.abs(cur.press - p.press) / dt * 0.25
        + Math.abs(cur.scale - p.scale) / dt * 1.2 + Math.abs(cur.warm - p.warm) / dt * 0.25 + Math.abs(ay) * 0.00002;
      fw += (cur.ex - p.ex) / dt * 2;
      fu += (cur.scale - p.scale) / dt * 6;
      this.swirl = Math.min(yv2 * yv2, 30) * 0.0016;
    } else {
      this.swirl = 0;
    }
    // push in the world along the camera's right and depth axes
    const fx = cam.u[0] * fu + cam.w[0] * fw;
    const fz = cam.u[2] * fu + cam.w[2] * fw;
    this.vx += (-K * this.x - C * this.vx + fx) * dt;
    this.vz += (-K * this.z - C * this.vz + fz) * dt;
    this.x = Math.max(-MAX, Math.min(MAX, this.x + this.vx * dt));
    this.z = Math.max(-MAX, Math.min(MAX, this.z + this.vz * dt));
    this.kick *= Math.exp(-dt * 2.2);
    const target = this.reduced ? 0 : Math.min(1, 0.14 * Math.hypot(this.vx, this.vz) + Math.abs(this.yv) * 0.05 + ext.wind * 0.3 + Math.abs(this.sv) * 0.00022 + this.kick);
    this.amp += (target - this.amp) * Math.min(1, dt * (target > this.amp ? 6 : 1.1));
    // world normal of the surface, seen from inside the bottle
    let nx = this.x, ny = 1, nz = this.z;
    const l = Math.hypot(nx, ny, nz);
    nx /= l; ny /= l; nz /= l;
    const R = rotMat(S.yaw, S.tilt, S.roll);
    const n = [0, 1, 2].map((i) => R[0][i] * nx + R[1][i] * ny + R[2][i] * nz);
    window.__slosh = { x: +this.x.toFixed(3), z: +this.z.toFixed(3), amp: +this.amp.toFixed(3), sv: Math.round(this.sv) };
    return { n, ripple: this.amp, swirl: this.swirl };
  }
}
