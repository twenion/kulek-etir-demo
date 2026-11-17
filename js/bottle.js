// Raymarched perfume bottle. One WebGL2 fragment shader draws the background, the giant words
// behind the bottle and the bottle itself (twisted thick glass, layered liquid, fluted metal cap).
// Refracted rays sample the same background, so the words bend through the glass.

const VS = `#version 300 es
in vec2 a;
void main(){ gl_Position = vec4(a, 0., 1.); }`;

const FS = `#version 300 es
precision highp float;
out vec4 fragColor;

uniform vec2 uRes;
uniform float uTime;
uniform vec3 uCam, uU, uV, uW;      // camera position + basis (world)
uniform float uFocal;
uniform vec2 uOff;                  // screen offset of the optical centre (uv units)
uniform mat3 uRot;                  // bottle local -> world
uniform vec3 uPos;                  // bottle position (world)
uniform float uScale;
uniform float uExplode, uCapOff, uPress, uLevel;
uniform vec3 uLayerWarm;            // per liquid layer: 0 = Xəzri, 1 = Gilavar
uniform float uNameWarm;            // which name is engraved on the plaque
uniform vec3 uBgTop, uBgBot, uGlow;
uniform vec2 uGlowPos; uniform float uGlowR;
uniform vec3 uEnvTop, uEnvBot, uKey, uFlag;
uniform float uFlagAmt, uFill, uGlowIn;
uniform vec3 uMetal;
uniform vec3 uLiqC[3];
uniform vec3 uLiqW[3];
uniform vec2 uShadow; uniform float uShadowR, uShadowA;
uniform sampler2D uLabel;           // r: brand, g: Xəzri, b: Gilavar
uniform sampler2D uWords;           // three rows: KÜLƏK, XƏZRİ, GİLAVAR (alpha)
uniform vec3 uWordA;                // alpha per word
uniform vec3 uWordX;                // horizontal shift per word (uv units)
uniform float uWordY, uWordW;       // vertical centre + width of the word band (uv units)
uniform vec3 uWordCol;
uniform float uAspect;

const float TW = 0.3;               // twist of the glass body, radians per unit height

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float sdRoundBox(vec3 p, vec3 b, float r){
  vec3 q = abs(p) - b + r;
  return length(max(q, 0.)) + min(max(q.x, max(q.y, q.z)), 0.) - r;
}
float sdRCyl(vec3 p, float R, float h, float r){
  vec2 d = vec2(length(p.xz) - R + r, abs(p.y) - h + r);
  return min(max(d.x, d.y), 0.) + length(max(d, 0.)) - r;
}

float bodyY(){ return -0.22 * uExplode; }
vec3 bodySpace(vec3 p){
  p.y -= bodyY();
  float a = TW * p.y; float c = cos(a), s = sin(a);
  return vec3(c * p.x - s * p.z, p.y, s * p.x + c * p.z);
}
float sdOuter(vec3 q){ return sdRoundBox(q, vec3(.6, .92, .4), .16) * .94; }
float sdCav(vec3 q){ return sdRoundBox(q - vec3(0., .12, 0.), vec3(.47, .72, .27), .1) * .94; }
float sdPlaque(vec3 q){ return sdRoundBox(q - vec3(0., -.14, .4), vec3(.25, .15, .014), .012); }

float collarY(){ return .955 + .44 * uExplode; }
float stemY(){ return 1.08 + .8 * uExplode; }
float actY(){ return 1.17 + .94 * uExplode - .05 * uPress; }
vec3 capP(){ return vec3(1.2 * uCapOff * uCapOff, 1.285 + 1.42 * uExplode + 2.8 * uCapOff, 0.); }

float sdCap(vec3 p){
  vec3 cp = p - capP();
  float a = atan(cp.z, cp.x);
  return sdRCyl(cp, .27 + .0065 * cos(24. * a), .28, .05) * .9;
}

vec2 mapAll(vec3 p){
  vec3 q = bodySpace(p);
  vec2 res = vec2(sdOuter(q), 1.);
  float pl = sdPlaque(q); if (pl < res.x) res = vec2(pl, 3.);
  float co = sdRCyl(p - vec3(0., collarY(), 0.), .2, .045, .012); if (co < res.x) res = vec2(co, 2.);
  float st = sdRCyl(p - vec3(0., stemY(), 0.), .034, .07, .01); if (st < res.x) res = vec2(st, 4.);
  float ac = sdRCyl(p - vec3(0., actY(), 0.), .095, .045, .02); if (ac < res.x) res = vec2(ac, 2.);
  float cap = sdCap(p); if (cap < res.x) res = vec2(cap, 5.);
  return res;
}

vec3 nAll(vec3 p){
  const vec2 k = vec2(1., -1.); const float e = .0015;
  return normalize(k.xyy * mapAll(p + k.xyy * e).x + k.yyx * mapAll(p + k.yyx * e).x +
                   k.yxy * mapAll(p + k.yxy * e).x + k.xxx * mapAll(p + k.xxx * e).x);
}
float fOuter(vec3 p){ return sdOuter(bodySpace(p)); }
float fCav(vec3 p){ return sdCav(bodySpace(p)); }
vec3 nOuter(vec3 p){
  const vec2 k = vec2(1., -1.); const float e = .0015;
  return normalize(k.xyy * fOuter(p + k.xyy * e) + k.yyx * fOuter(p + k.yyx * e) +
                   k.yxy * fOuter(p + k.yxy * e) + k.xxx * fOuter(p + k.xxx * e));
}
vec3 nCav(vec3 p){
  const vec2 k = vec2(1., -1.); const float e = .0015;
  return normalize(k.xyy * fCav(p + k.xyy * e) + k.yyx * fCav(p + k.yyx * e) +
                   k.yxy * fCav(p + k.yxy * e) + k.xxx * fCav(p + k.xxx * e));
}

// ---------- background: gradient, glow, shadow and the giant words ----------
float wordMask(vec2 uv){
  float m = 0.;
  float h = uWordW * .25;                   // each row is 4:1
  for (int i = 0; i < 3; i++){
    float a = uWordA[i];
    if (a < .002) continue;
    vec2 c = vec2(uWordX[i], uWordY);
    vec2 t = (uv - c) / vec2(uWordW, h) + .5;
    if (t.x < 0. || t.x > 1. || t.y < 0. || t.y > 1.) continue;
    float v = texture(uWords, vec2(t.x, (float(i) + 1. - t.y) / 3.)).a;
    m = max(m, v * a);
  }
  return m;
}
vec3 background(vec2 uv, float wa){
  vec3 c = mix(uBgBot, uBgTop, smoothstep(-.55, .55, uv.y));
  float g = length((uv - uGlowPos) / uGlowR);
  c += uGlow * exp(-g * g);
  vec2 sd = (uv - uShadow) / vec2(uShadowR, uShadowR * .2);
  c *= 1. - uShadowA * exp(-dot(sd, sd) * 2.);
  c = mix(c, uWordCol, wordMask(uv) * wa);
  return c;
}
vec2 projectUV(vec3 w){
  vec3 d = w - uCam;
  float z = max(dot(d, uW), .001);
  return vec2(dot(d, uU), dot(d, uV)) * uFocal / z + uOff;
}

// studio light around the bottle, in world space
vec3 env(vec3 d, float r, float ka){
  vec3 c = mix(uEnvBot, uEnvTop, smoothstep(-.6, .9, d.y));
  float az = atan(d.x, d.z);
  float w = .13 + r * 1.3;
  float k1 = smoothstep(w, 0., abs(az - 1.1)) * smoothstep(-.4 - r, .05, d.y) * smoothstep(.95, .5 - r, d.y);
  float k2 = smoothstep(w * 1.5, 0., abs(az + 1.5)) * smoothstep(-.25 - r, .2, d.y) * smoothstep(.9, .45 - r, d.y);
  float top = smoothstep(.6 - r, .98, d.y);
  float fl = smoothstep(w * 2.2, 0., abs(abs(az) - 2.35)) * smoothstep(-.8, .2, d.y);
  float fill = smoothstep(1.1, 0., abs(az)) * smoothstep(-.5, .4, d.y) * smoothstep(1., .6, d.y);
  c = mix(c, uFlag, fl * uFlagAmt);
  c += uKey * ka * (k1 * 1.5 + k2 * .85 + top * .7 + fill * uFill);
  return c;
}
// what a refracted ray sees: the backdrop behind the bottle (with the words) blended with the studio
vec3 seen(vec3 pl, vec3 dl){
  vec3 dw = uRot * dl;
  vec3 pw = uPos + uRot * (pl * uScale);
  float t = (-2.2 - pw.z) / min(dw.z, -.05);
  vec3 bg = background(projectUV(pw + dw * max(t, .0)), .22);
  float back = smoothstep(.15, -.55, dw.z);
  return mix(env(dw, .3, .4), bg, clamp(.4 + back * .6, 0., 1.));
}

float bandLen(float ya, float yb, float lo, float hi){
  if (hi <= lo) return 0.;
  if (abs(yb - ya) < 1e-4) return (ya >= lo && ya <= hi) ? 1. : 0.;
  float s0 = (lo - ya) / (yb - ya), s1 = (hi - ya) / (yb - ya);
  float a = min(s0, s1), b = max(s0, s1);
  return max(0., min(b, 1.) - max(a, 0.));
}

vec3 shadeGlass(vec3 p, vec3 rd){
  vec3 n = nOuter(p);
  float cosi = clamp(dot(-rd, n), 0., 1.);
  float F = .04 + .96 * pow(1. - cosi, 5.);
  vec3 refl = env(uRot * reflect(rd, n), .02, 1.);
  vec3 r1 = refract(rd, n, 1. / 1.5);
  vec3 p1 = p - n * .004;
  float t = 0.;
  for (int i = 0; i < 44; i++){
    vec3 q = bodySpace(p1 + r1 * t);
    float d = max(sdOuter(q), -sdCav(q));
    if (-d < .0015) break;
    t += max(-d, .005);
  }
  vec3 p2 = p1 + r1 * t;
  vec3 glassAbs = vec3(.22, .07, .12);
  vec3 trans = exp(-t * glassAbs);
  vec3 col; vec3 add = vec3(0.);
  vec3 qb = bodySpace(p2);
  float lvl = mix(-.6, .82, uLevel);
  if (abs(sdCav(qb)) < abs(sdOuter(qb))){
    vec3 nc = nCav(p2);
    bool inLiq = qb.y < lvl;
    vec3 r2 = refract(r1, nc, inLiq ? 1.5 / 1.33 : 1.5);
    if (dot(r2, r2) < .5) r2 = reflect(r1, nc);
    vec3 p3 = p2 - nc * .004;
    float t2 = 0.;
    for (int i = 0; i < 40; i++){
      float d = -fCav(p3 + r2 * t2);
      if (d < .0015) break;
      t2 += max(d, .006);
    }
    vec3 p4 = p3 + r2 * t2;
    float ya = p3.y - bodyY(), yb = p4.y - bodyY();
    float L = t2;
    // three stacked layers of the juice
    float b1 = -.6 + 1.42 / 3., b2 = -.6 + 2.84 / 3.;
    float l0 = bandLen(ya, yb, -.7, min(b1, lvl)) * L;
    float l1 = bandLen(ya, yb, b1, min(b2, lvl)) * L;
    float l2 = bandLen(ya, yb, b2, lvl) * L;
    vec3 c0 = mix(uLiqC[0], uLiqW[0], uLayerWarm.x);
    vec3 c1 = mix(uLiqC[1], uLiqW[1], uLayerWarm.y);
    vec3 c2 = mix(uLiqC[2], uLiqW[2], uLayerWarm.z);
    const float dens = 2.6;
    vec3 liq = exp(-l0 * dens * (1. - c0)) * exp(-l1 * dens * (1. - c1)) * exp(-l2 * dens * (1. - c2));
    // a little light caught inside the juice
    add += (c0 * (1. - exp(-l0 * 1.6)) + c1 * (1. - exp(-l1 * 1.6)) + c2 * (1. - exp(-l2 * 1.6))) * (uKey * .16 + uGlow * uGlowIn);
    // surface of the juice
    if ((ya - lvl) * (yb - lvl) < 0. && uLevel > .01 && uLevel < .995){
      add += env(uRot * reflect(r2, vec3(0., 1., 0.)), .05, 1.) * .22 * trans;
    }
    bool endLiq = yb < lvl;
    vec3 nc2 = nCav(p4);
    vec3 r3 = refract(r2, -nc2, (endLiq ? 1.33 : 1.) / 1.5);
    if (dot(r3, r3) < .5) r3 = reflect(r2, -nc2);
    vec3 p5 = p4 + nc2 * .004;
    float t3 = 0.;
    for (int i = 0; i < 28; i++){
      float d = -fOuter(p5 + r3 * t3);
      if (d < .0015) break;
      t3 += max(d, .006);
    }
    vec3 p6 = p5 + r3 * t3;
    vec3 no = nOuter(p6);
    vec3 r4 = refract(r3, -no, 1.5);
    if (dot(r4, r4) < .5) r4 = reflect(r3, -no);
    trans *= exp(-t3 * glassAbs);
    col = seen(p6, r4) * trans * liq + add;
  } else {
    vec3 no = nOuter(p2);
    vec3 r4 = refract(r1, -no, 1.5);
    if (dot(r4, r4) < .5) r4 = reflect(r1, -no);
    col = seen(p2, r4) * trans;
  }
  return mix(col, refl, F) + uKey * pow(F, 1.5) * .25;
}

vec3 shadeMetal(vec3 n, vec3 rd, float rough, vec3 base){
  vec3 e = env(uRot * reflect(rd, n), rough, 1.);
  float cosi = clamp(dot(-rd, n), 0., 1.);
  vec3 F = base + (1. - base) * pow(1. - cosi, 5.);
  return e * F;
}

vec3 shade(vec3 p, vec3 rd, float m){
  if (m < 1.5) return shadeGlass(p, rd);
  vec3 n = nAll(p);
  if (m < 2.5) return shadeMetal(n, rd, .08, uMetal);
  if (m < 3.5){
    vec3 q = bodySpace(p);
    vec2 uv = vec2(q.x / .25, (q.y + .14) / .15) * .5 + .5;
    vec3 lab = texture(uLabel, vec2(uv.x, 1. - uv.y)).rgb;
    float ink = clamp(lab.r + mix(lab.g, lab.b, uNameWarm), 0., 1.);
    vec3 c = shadeMetal(n, rd, .22, uMetal * .92);
    return mix(c, c * .28, ink);
  }
  if (m < 4.5) return shadeMetal(n, rd, .35, vec3(.06));
  return shadeMetal(n, rd, .16, uMetal);
}

void main(){
  vec2 uv = (gl_FragCoord.xy - .5 * uRes) / uRes.y;
  vec3 bg = background(uv, 1.);
  vec2 c = uv - uOff;
  vec3 rdw = normalize(c.x * uU + c.y * uV + uFocal * uW);
  // into bottle space
  mat3 inv = transpose(uRot);
  vec3 ro = inv * (uCam - uPos) / uScale;
  vec3 rd = inv * rdw;
  vec3 bmin = vec3(-.85, -1.25 - .25 * uExplode, -.85);
  vec3 bmax = vec3(.85 + 1.5 * uCapOff, 1.64 + 1.45 * uExplode + 2.9 * uCapOff, .85);
  vec3 ird = 1. / rd;
  vec3 t0 = (bmin - ro) * ird, t1 = (bmax - ro) * ird;
  vec3 tn = min(t0, t1), tf = max(t0, t1);
  float tmin = max(max(tn.x, tn.y), tn.z), tmax = min(min(tf.x, tf.y), tf.z);
  vec3 col = bg;
  if (tmax > max(tmin, 0.)){
    float t = max(tmin, 0.);
    float px = 1.4 / (uRes.y * uFocal * uScale);
    float best = 1e9, bestT = t; float bestM = 0.;
    bool hit = false; float m = 0.;
    for (int i = 0; i < 96; i++){
      vec3 p = ro + rd * t;
      vec2 h = mapAll(p);
      float ratio = h.x / (t * px);
      if (ratio < best){ best = ratio; bestT = t; bestM = h.y; }
      if (h.x < .0006 * t){ hit = true; m = h.y; break; }
      t += h.x;
      if (t > tmax) break;
    }
    if (hit){
      col = shade(ro + rd * t, rd, m);
    } else if (best < 1.){
      vec3 s = shade(ro + rd * bestT, rd, bestM);
      col = mix(s, bg, clamp(best, 0., 1.));
    }
  }
  col += (hash(gl_FragCoord.xy + fract(uTime) * 91.7) - .5) * .014;
  fragColor = vec4(col, 1.);
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}

export function rotMat(yaw, tilt, roll) {
  // R = Ry(yaw) * Rx(tilt) * Rz(roll); returned column-major (for GL) and as rows (for JS)
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cx = Math.cos(tilt), sx = Math.sin(tilt), cz = Math.cos(roll), sz = Math.sin(roll);
  const Ry = [[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]];
  const Rx = [[1, 0, 0], [0, cx, -sx], [0, sx, cx]];
  const Rz = [[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]];
  const mul = (A, B) => A.map((r) => [0, 1, 2].map((j) => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
  return mul(mul(Ry, Rx), Rz);
}

export class Bottle {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    if (!gl) throw new Error('webgl2');
    this.gl = gl;
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VS));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, FS));
    gl.bindAttribLocation(p, 0, 'a');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    this.prog = p;
    gl.useProgram(p);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i);
      const name = info.name.replace(/\[0\]$/, '');
      this.u[name] = gl.getUniformLocation(p, info.name);
    }
    this.tex = {};
    this.makeTex('uLabel', 0);
    this.makeTex('uWords', 1);
    this.scale = 1;
  }

  makeTex(name, unit) {
    const gl = this.gl;
    const t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(this.u[name], unit);
    this.tex[name] = { t, unit };
  }

  upload(name, source) {
    const gl = this.gl;
    const { t, unit } = this.tex[name];
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  }

  resize(cssW, cssH, pixelScale) {
    const w = Math.max(2, Math.round(cssW * pixelScale)), h = Math.max(2, Math.round(cssH * pixelScale));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.cssW = cssW; this.cssH = cssH;
  }

  // camera basis from state; also used by project()
  camera(s) {
    const cam = [s.target[0] + Math.sin(s.orbit) * Math.cos(s.pitch) * s.dist, s.target[1] + Math.sin(s.pitch) * s.dist, s.target[2] + Math.cos(s.orbit) * Math.cos(s.pitch) * s.dist];
    const w = norm(sub(s.target, cam));
    const u = norm(cross(w, [0, 1, 0]));
    const v = cross(u, w);
    const focal = 1 / (2 * Math.tan((s.fov * Math.PI) / 360));
    return { cam, u, v, w, focal };
  }

  // local bottle point -> CSS pixels
  project(s, lp, C = this.camera(s), R = rotMat(s.yaw, s.tilt, s.roll)) {
    const wp = [0, 1, 2].map((i) => s.pos[i] + s.scale * (R[i][0] * lp[0] + R[i][1] * lp[1] + R[i][2] * lp[2]));
    const d = sub(wp, C.cam);
    const z = Math.max(dot(d, C.w), 0.001);
    const ux = (dot(d, C.u) * C.focal) / z + s.off[0];
    const uy = (dot(d, C.v) * C.focal) / z + s.off[1];
    return [ux * this.cssH + this.cssW / 2, this.cssH / 2 - uy * this.cssH, ux, uy];
  }

  render(s, time) {
    const gl = this.gl, u = this.u;
    const C = this.camera(s);
    const R = rotMat(s.yaw, s.tilt, s.roll);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.uniform2f(u.uRes, this.canvas.width, this.canvas.height);
    gl.uniform1f(u.uTime, time);
    gl.uniform3fv(u.uCam, C.cam); gl.uniform3fv(u.uU, C.u); gl.uniform3fv(u.uV, C.v); gl.uniform3fv(u.uW, C.w);
    gl.uniform1f(u.uFocal, C.focal);
    gl.uniform2fv(u.uOff, s.off);
    gl.uniformMatrix3fv(u.uRot, false, [R[0][0], R[1][0], R[2][0], R[0][1], R[1][1], R[2][1], R[0][2], R[1][2], R[2][2]]);
    gl.uniform3fv(u.uPos, s.pos);
    gl.uniform1f(u.uScale, s.scale);
    gl.uniform1f(u.uExplode, s.explode);
    gl.uniform1f(u.uCapOff, s.capOff);
    gl.uniform1f(u.uPress, s.press);
    gl.uniform1f(u.uLevel, s.level);
    gl.uniform3fv(u.uLayerWarm, s.layerWarm);
    gl.uniform1f(u.uNameWarm, s.nameWarm);
    const T = s.theme;
    gl.uniform3fv(u.uBgTop, T.bgTop); gl.uniform3fv(u.uBgBot, T.bgBot); gl.uniform3fv(u.uGlow, T.glow);
    gl.uniform3fv(u.uEnvTop, T.envTop); gl.uniform3fv(u.uEnvBot, T.envBot); gl.uniform3fv(u.uKey, T.key); gl.uniform3fv(u.uFlag, T.flag);
    gl.uniform1f(u.uFlagAmt, T.flagAmt);
    gl.uniform1f(u.uFill, T.fill);
    gl.uniform1f(u.uGlowIn, T.glowIn);
    gl.uniform3fv(u.uMetal, T.metal);
    gl.uniform3fv(u.uWordCol, T.word);
    gl.uniform3fv(u.uLiqC, s.liqC.flat());
    gl.uniform3fv(u.uLiqW, s.liqW.flat());
    // glow + shadow follow the bottle on screen
    const c = this.project(s, [0, 0.1, 0], C, R);
    const top = this.project(s, [0, 1.5, 0], C, R);
    const base = this.project(s, [0, -0.95 + -0.22 * s.explode, 0], C, R);
    const hgt = Math.abs(top[3] - base[3]);
    gl.uniform2f(u.uGlowPos, c[2], c[3]);
    gl.uniform1f(u.uGlowR, hgt * 0.75 + 0.05);
    gl.uniform2f(u.uShadow, base[2], base[3] - hgt * 0.06 - s.bob * 0.6);
    gl.uniform1f(u.uShadowR, hgt * 0.3 * (1 - s.bob * 2));
    gl.uniform1f(u.uShadowA, s.shadow * T.shadow);
    gl.uniform3fv(u.uWordA, s.wordA);
    gl.uniform3fv(u.uWordX, s.wordX);
    gl.uniform1f(u.uWordY, s.wordY);
    gl.uniform1f(u.uWordW, s.wordW);
    gl.uniform1f(u.uAspect, this.cssW / this.cssH);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    return { C, R };
  }
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
