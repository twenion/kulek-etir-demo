// The bottle, rasterised. Pass A draws the backdrop (gradient, glow, shadow, giant words) and the juice
// into a multisampled offscreen target; pass B copies it to the screen, draws the metal parts, then the
// glass, which samples pass A through its normal (screen-space refraction with a little dispersion).
import { roundedBox, lathe, TW } from './mesh.js';

const HEAD = `#version 300 es
precision highp float;`;

const VS_QUAD = `${HEAD}
in vec2 aPos;
void main(){ gl_Position = vec4(aPos, 0., 1.); }`;

const COMMON = `
uniform vec2 uRes;
uniform float uTime, uAspect;
uniform vec3 uCam, uU, uV, uW;
uniform float uFocal;
uniform vec2 uOff;
uniform vec3 uBgTop, uBgBot, uGlow, uEnvTop, uEnvBot, uKey, uFlag, uMetal, uWordCol, uAccent;
uniform float uFlagAmt;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float hash3(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float noise3(vec3 p){
  vec3 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  float a = mix(hash3(i), hash3(i + vec3(1, 0, 0)), f.x), b = mix(hash3(i + vec3(0, 1, 0)), hash3(i + vec3(1, 1, 0)), f.x);
  float c = mix(hash3(i + vec3(0, 0, 1)), hash3(i + vec3(1, 0, 1)), f.x), d = mix(hash3(i + vec3(0, 1, 1)), hash3(i + vec3(1, 1, 1)), f.x);
  return mix(mix(a, b, f.y), mix(c, d, f.y), f.z);
}
// studio light, world space: two tall softboxes, a top light, a soft front fill, dark flags behind
vec3 env(vec3 d, float r){
  vec3 c = mix(uEnvBot, uEnvTop, smoothstep(-.6, .9, d.y));
  float az = atan(d.x, d.z);
  float w = .1 + r * 1.2;
  float k1 = smoothstep(w, 0., abs(az - 1.05)) * smoothstep(-.45 - r, .0, d.y) * smoothstep(.98, .55 - r, d.y);
  float k2 = smoothstep(w * 1.4, 0., abs(az + 1.5)) * smoothstep(-.3 - r, .15, d.y) * smoothstep(.92, .5 - r, d.y);
  float top = smoothstep(.62 - r, .98, d.y);
  float fill = smoothstep(1.2, 0., abs(az)) * smoothstep(-.4, .4, d.y) * smoothstep(1., .55, d.y);
  float fl = smoothstep(w * 2.4, 0., abs(abs(az) - 2.3));
  c = mix(c, uFlag, fl * uFlagAmt);
  return c + uKey * (k1 * 1.7 + k2 * 1. + top * .8 + fill * .22);
}
vec3 keys(vec3 n, vec3 v, float sh){
  vec3 l1 = normalize(vec3(-.6, .7, .55)), l2 = normalize(vec3(.85, .25, .2)), l3 = normalize(vec3(0., .2, -1.));
  vec3 h1 = normalize(l1 + v), h2 = normalize(l2 + v), h3 = normalize(l3 + v);
  return uKey * (pow(max(dot(n, h1), 0.), sh) * 2.2 + pow(max(dot(n, h2), 0.), sh) * 1.4 + pow(max(dot(n, h3), 0.), sh * .5) * .9);
}
`;

const FS_BG = `${HEAD}
out vec4 fragColor;
${COMMON}
uniform vec2 uGlowPos; uniform float uGlowR;
uniform vec2 uShadow; uniform float uShadowR, uShadowA;
uniform sampler2D uWords;
uniform vec3 uWordA, uWordX;
uniform float uWordY, uWordW;
float wordMask(vec2 uv){
  float m = 0.;
  float h = uWordW * .25;
  for (int i = 0; i < 3; i++){
    float a = uWordA[i];
    if (a < .002) continue;
    vec2 t = (uv - vec2(uWordX[i], uWordY)) / vec2(uWordW, h) + .5;
    if (t.x < 0. || t.x > 1. || t.y < 0. || t.y > 1.) continue;
    m = max(m, texture(uWords, vec2(t.x, (float(i) + 1. - t.y) / 3.)).a * a);
  }
  return m;
}
void main(){
  vec2 uv = (gl_FragCoord.xy - .5 * uRes) / uRes.y;
  vec3 c = mix(uBgBot, uBgTop, smoothstep(-.6, .6, uv.y));
  float g = length((uv - uGlowPos) / uGlowR);
  c += uGlow * exp(-g * g);
  vec2 sd = (uv - uShadow) / vec2(uShadowR, uShadowR * .2);
  c *= 1. - uShadowA * exp(-dot(sd, sd) * 2.);
  c = mix(c, uWordCol, wordMask(uv));
  c += (hash(gl_FragCoord.xy + fract(uTime) * 91.7) - .5) * .012;
  fragColor = vec4(c, 1.);
}`;

const FS_COPY = `${HEAD}
out vec4 fragColor;
uniform sampler2D uScene; uniform vec2 uRes;
void main(){ fragColor = texture(uScene, gl_FragCoord.xy / uRes); }`;

const VS_MESH = `${HEAD}
in vec3 aPos; in vec3 aNrm; in vec3 aRef;
uniform mat3 uRot; uniform vec3 uPos; uniform float uScale; uniform vec3 uPart;
uniform vec3 uCam, uU, uV, uW; uniform float uFocal, uAspect; uniform vec2 uOff;
out vec3 vW; out vec3 vN; out vec3 vM; out vec3 vR;
void main(){
  vec3 lp = aPos + uPart;
  vM = lp; vR = aRef;
  vec3 wp = uPos + uRot * (lp * uScale);
  vW = wp; vN = uRot * aNrm;
  vec3 d = wp - uCam;
  float z = dot(d, uW), x = dot(d, uU), y = dot(d, uV);
  const float n = .05, f = 80.;
  gl_Position = vec4((x * uFocal + uOff.x * z) * 2. / uAspect, (y * uFocal + uOff.y * z) * 2., z * (f + n) / (f - n) - 2. * f * n / (f - n), z);
}`;

const MESH_HEAD = `${HEAD}
out vec4 fragColor;
${COMMON}
in vec3 vW; in vec3 vN; in vec3 vM; in vec3 vR;
uniform float uReveal;
// materialise: fragments appear through a noise threshold with a thin glowing edge
float reveal(out float edge){
  edge = 0.;
  if (uReveal >= .999) return -1.;
  float n = (vM.y + 1.) / 2.7 + (noise3(vM * 9.) - .5) * .12;
  float th = uReveal * 1.25 - .12;
  edge = smoothstep(.035, 0., th - n) * step(uReveal, .999);
  return n - th;
}
`;

const FS_LIQUID = `${MESH_HEAD}
uniform float uLevel;
uniform vec3 uLiqC[3]; uniform vec3 uLiqW[3]; uniform vec3 uLayerWarm;
void main(){
  float edge; if (reveal(edge) > 0.) discard;
  float lvl = mix(-.6, .82, uLevel);
  float y = vR.y;
  if (y > lvl || uLevel < .005) discard;
  float b1 = -.6 + 1.42 / 3., b2 = -.6 + 2.84 / 3.;
  vec3 c0 = mix(uLiqC[0], uLiqW[0], uLayerWarm.x);
  vec3 c1 = mix(uLiqC[1], uLiqW[1], uLayerWarm.y);
  vec3 c2 = mix(uLiqC[2], uLiqW[2], uLayerWarm.z);
  vec3 col = mix(c0, c1, smoothstep(b1 - .025, b1 + .025, y));
  col = mix(col, c2, smoothstep(b2 - .025, b2 + .025, y));
  vec3 n = normalize(vN); vec3 v = normalize(uCam - vW);
  float ndv = abs(dot(n, v));
  float ca = noise3(vec3(vR.x * 4.5, vR.y * 3. - uTime * .12, vR.z * 4.5 + uTime * .05));
  float cb = noise3(vec3(vR.x * 11. + uTime * .07, vR.y * 7., vR.z * 11.));
  col *= .84 + .3 * ca * ca + .1 * cb;
  col *= mix(.72, 1.06, smoothstep(-.6, lvl, y));
  float a;
  if (gl_FrontFacing){
    col *= .5 + .5 * pow(ndv, .8);
    col += uGlow * 1.3 * pow(ndv, 2.);
    a = .7 + .25 * (1. - ndv);
  } else {
    col *= .62;
    a = .55;
  }
  col += col * smoothstep(.03, 0., lvl - y) * .35;
  col += uAccent * edge * 1.4;
  fragColor = vec4(col * a, a);
}`;

const FS_INNER = `${MESH_HEAD}
void main(){
  float edge; if (reveal(edge) > 0.) discard;
  vec3 n = -normalize(vN); vec3 v = normalize(uCam - vW);
  float ndv = abs(dot(n, v));
  vec3 c = env(reflect(-v, n), .1) * .1 * pow(1. - ndv, 2.) + keys(n, v, 120.) * .12;
  fragColor = vec4(c, 1.);
}`;

const FS_GLASS = `${MESH_HEAD}
uniform sampler2D uScene;
uniform float uRefr;
void main(){
  float edge; if (reveal(edge) > 0.) discard;
  vec3 n = normalize(vN); vec3 v = normalize(uCam - vW);
  float ndv = clamp(dot(n, v), 0., 1.);
  float F = .07 + .93 * pow(1. - ndv, 5.);
  vec3 nv = vec3(dot(n, uU), dot(n, uV), dot(n, uW));
  float thick = 1. + 3.2 * pow(1. - ndv, 2.) + smoothstep(-.6, -.92, vR.y) * 1.5;
  vec2 st = gl_FragCoord.xy / uRes;
  vec2 o = -nv.xy * uRefr * thick * vec2(1. / uAspect, 1.);
  vec3 refr = vec3(texture(uScene, st + o).r, texture(uScene, st + o * 1.035).g, texture(uScene, st + o * 1.07).b);
  vec3 tint = mix(vec3(1.), vec3(.86, .95, .93), clamp((thick - 1.) * .3, 0., 1.));
  vec3 refl = env(reflect(-v, n), .015);
  vec3 col = refr * tint * (1. - F * .9) + refl * F + keys(n, v, 260.);
  col += uAccent * edge * 1.4;
  fragColor = vec4(col, 1.);
}`;

const FS_METAL = `${MESH_HEAD}
uniform float uRough;
uniform float uPlaque;
uniform sampler2D uLabel;
uniform float uNameWarm;
void main(){
  float edge; if (reveal(edge) > 0.) discard;
  vec3 n = normalize(vN); vec3 v = normalize(uCam - vW);
  float ndv = clamp(dot(n, v), 0., 1.);
  vec3 base = uMetal;
  vec3 e = env(reflect(-v, n), uRough);
  vec3 F = base + (1. - base) * pow(1. - ndv, 5.);
  vec3 col = e * F + keys(n, v, mix(400., 60., uRough)) * base * 1.2 + base * (uEnvTop * .9 + uKey * .1) * (.35 + .4 * n.y);
  if (uPlaque > .5 && vR.z > .405){
    vec2 uv = vec2(vR.x / .25, (vR.y + .14) / .15) * .5 + .5;
    vec3 lab = texture(uLabel, vec2(uv.x, 1. - uv.y)).rgb;
    float ink = clamp(lab.r + mix(lab.g, lab.b, uNameWarm), 0., 1.);
    col = mix(col, col * .18, ink);
  }
  col += uAccent * edge * 1.4;
  fragColor = vec4(col, 1.);
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}
function program(gl, vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.bindAttribLocation(p, 0, 'aPos');
  gl.bindAttribLocation(p, 1, 'aNrm');
  gl.bindAttribLocation(p, 2, 'aRef');
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, info.name); }
  return { p, u };
}

export function rotMat(yaw, tilt, roll) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cx = Math.cos(tilt), sx = Math.sin(tilt), cz = Math.cos(roll), sz = Math.sin(roll);
  const Ry = [[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]];
  const Rx = [[1, 0, 0], [0, cx, -sx], [0, sx, cx]];
  const Rz = [[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]];
  const mul = (A, B) => A.map((r) => [0, 1, 2].map((j) => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
  return mul(mul(Ry, Rx), Rz);
}

// part offsets (local); the DOM labels use the same numbers
export const PARTS = {
  bodyY: (e) => -0.22 * e,
  collarY: (e) => 0.955 + 0.44 * e,
  stemY: (e) => 1.08 + 0.8 * e,
  actY: (e, press = 0) => 1.17 + 0.94 * e - 0.05 * press,
  capP: (e, off) => [1.6 * off * off, 1.285 + 1.42 * e + 4.6 * off, 0],
};

export class Bottle {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { antialias: true, alpha: false, depth: true, stencil: false, powerPreference: 'high-performance' });
    if (!gl) throw new Error('webgl2');
    this.gl = gl;
    this.samples = Math.min(4, gl.getParameter(gl.MAX_SAMPLES) || 0);
    this.P = {
      bg: program(gl, VS_QUAD, FS_BG),
      copy: program(gl, VS_QUAD, FS_COPY),
      liquid: program(gl, VS_MESH, FS_LIQUID),
      inner: program(gl, VS_MESH, FS_INNER),
      glass: program(gl, VS_MESH, FS_GLASS),
      metal: program(gl, VS_MESH, FS_METAL),
    };
    this.quad = gl.createVertexArray();
    gl.bindVertexArray(this.quad);
    const qb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, qb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    this.M = {
      body: this.mesh(roundedBox([0.6, 0.92, 0.4], 0.16, { twist: TW })),
      liquid: this.mesh(roundedBox([0.465, 0.715, 0.265], 0.095, { twist: TW, center: [0, 0.12, 0] })),
      plaque: this.mesh(roundedBox([0.25, 0.15, 0.014], 0.012, { twist: TW, center: [0, -0.14, 0.4], seg: [8, 6, 2], nb: 3 })),
      collar: this.mesh(lathe(0.2, 0.045, 0.012, { seg: 64 })),
      stem: this.mesh(lathe(0.034, 0.07, 0.01, { seg: 24 })),
      act: this.mesh(lathe(0.095, 0.045, 0.02, { seg: 48 })),
      cap: this.mesh(lathe(0.27, 0.28, 0.05, { seg: 240, flutes: 24, amp: 0.0075 })),
    };
    this.tex = { uLabel: this.makeTex(), uWords: this.makeTex() };
    this.fbo = null;
  }

  mesh(m) {
    const gl = this.gl;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const put = (arr, loc) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0); };
    put(m.pos, 0); put(m.nrm, 1); put(m.ref, 2);
    const ib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, m.idx, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    return { vao, count: m.count, data: m };
  }

  makeTex() {
    const gl = this.gl;
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  upload(name, source) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.tex[name]);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  }

  resize(cssW, cssH, pixelScale) {
    const gl = this.gl;
    const w = Math.max(2, Math.round(cssW * pixelScale)), h = Math.max(2, Math.round(cssH * pixelScale));
    this.cssW = cssW; this.cssH = cssH;
    if (this.canvas.width === w && this.canvas.height === h && this.fbo) return;
    this.canvas.width = w; this.canvas.height = h;
    if (this.fbo) { const o = this.fbo; gl.deleteFramebuffer(o.ms); gl.deleteFramebuffer(o.rt); gl.deleteRenderbuffer(o.c); gl.deleteRenderbuffer(o.d); gl.deleteTexture(o.tex); }
    const store = (fmt) => { const r = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, r); if (this.samples) gl.renderbufferStorageMultisample(gl.RENDERBUFFER, this.samples, fmt, w, h); else gl.renderbufferStorage(gl.RENDERBUFFER, fmt, w, h); return r; };
    const ms = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, ms);
    const c = store(gl.RGBA8), d = store(gl.DEPTH_COMPONENT24);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, c);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, d);
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const rt = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, rt);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.fbo = { ms, rt, c, d, tex };
  }

  camera(s) {
    const cam = [s.target[0] + Math.sin(s.orbit) * Math.cos(s.pitch) * s.dist, s.target[1] + Math.sin(s.pitch) * s.dist, s.target[2] + Math.cos(s.orbit) * Math.cos(s.pitch) * s.dist];
    const w = norm(sub(s.target, cam));
    const u = norm(cross(w, [0, 1, 0]));
    const v = cross(u, w);
    const focal = 1 / (2 * Math.tan((s.fov * Math.PI) / 360));
    return { cam, u, v, w, focal };
  }

  // local bottle point -> [cssX, cssY, uvX, uvY, depth]
  project(s, lp, C = this.camera(s), R = rotMat(s.yaw, s.tilt, s.roll)) {
    const wp = [0, 1, 2].map((i) => s.pos[i] + s.scale * (R[i][0] * lp[0] + R[i][1] * lp[1] + R[i][2] * lp[2]));
    const d = sub(wp, C.cam);
    const z = Math.max(dot(d, C.w), 0.001);
    const ux = (dot(d, C.u) * C.focal) / z + s.off[0];
    const uy = (dot(d, C.v) * C.focal) / z + s.off[1];
    return [ux * this.cssH + this.cssW / 2, this.cssH / 2 - uy * this.cssH, ux, uy, z];
  }

  use(pr, s, C, R) {
    const gl = this.gl, u = pr.u, T = s.theme;
    gl.useProgram(pr.p);
    const v3 = (k, v) => u[k] && gl.uniform3fv(u[k], v);
    const v1 = (k, v) => u[k] && gl.uniform1f(u[k], v);
    u.uRes && gl.uniform2f(u.uRes, this.canvas.width, this.canvas.height);
    v1('uTime', s.time); v1('uAspect', this.cssW / this.cssH);
    v3('uCam', C.cam); v3('uU', C.u); v3('uV', C.v); v3('uW', C.w);
    v1('uFocal', C.focal);
    u.uOff && gl.uniform2fv(u.uOff, s.off);
    v3('uBgTop', T.bgTop); v3('uBgBot', T.bgBot); v3('uGlow', T.glow); v3('uEnvTop', T.envTop); v3('uEnvBot', T.envBot);
    v3('uKey', T.key); v3('uFlag', T.flag); v3('uMetal', T.metal); v3('uWordCol', T.word); v3('uAccent', T.accent);
    v1('uFlagAmt', T.flagAmt);
    if (u.uRot) gl.uniformMatrix3fv(u.uRot, false, [R[0][0], R[1][0], R[2][0], R[0][1], R[1][1], R[2][1], R[0][2], R[1][2], R[2][2]]);
    v3('uPos', s.pos); v1('uScale', s.scale); v1('uReveal', s.reveal);
    return u;
  }

  draw(pr, m, part) {
    const gl = this.gl;
    gl.uniform3fv(pr.u.uPart, part);
    gl.bindVertexArray(m.vao);
    gl.drawElements(gl.TRIANGLES, m.count, gl.UNSIGNED_INT, 0);
  }

  render(s) {
    const gl = this.gl, P = this.P, M = this.M, f = this.fbo;
    const C = this.camera(s);
    const R = rotMat(s.yaw, s.tilt, s.roll);
    const W = this.canvas.width, H = this.canvas.height;
    const e = s.explode, by = PARTS.bodyY(e);
    // ---------- pass A: backdrop + juice, multisampled ----------
    gl.bindFramebuffer(gl.FRAMEBUFFER, f.ms);
    gl.viewport(0, 0, W, H);
    gl.disable(gl.DEPTH_TEST); gl.depthMask(false); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND);
    let u = this.use(P.bg, s, C, R);
    const c = this.project(s, [0, 0.1, 0], C, R), top = this.project(s, [0, 1.5, 0], C, R), base = this.project(s, [0, -0.95 + by, 0], C, R);
    const hgt = Math.abs(top[3] - base[3]);
    gl.uniform2f(u.uGlowPos, c[2], c[3]);
    gl.uniform1f(u.uGlowR, hgt * 0.8 + 0.05);
    gl.uniform2f(u.uShadow, base[2], base[3] - hgt * 0.06 - s.bob * 0.6);
    gl.uniform1f(u.uShadowR, hgt * 0.3 * (1 - s.bob * 2));
    gl.uniform1f(u.uShadowA, s.shadow * s.theme.shadow * s.reveal);
    gl.uniform3fv(u.uWordA, s.wordA); gl.uniform3fv(u.uWordX, s.wordX);
    gl.uniform1f(u.uWordY, s.wordY); gl.uniform1f(u.uWordW, s.wordW);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tex.uWords); gl.uniform1i(u.uWords, 0);
    gl.bindVertexArray(this.quad); gl.drawArrays(gl.TRIANGLES, 0, 3);
    const visible = s.reveal > 0.001;
    if (visible) {
      gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.clear(gl.DEPTH_BUFFER_BIT);
      u = this.use(P.liquid, s, C, R);
      gl.uniform1f(u.uLevel, s.level);
      gl.uniform3fv(u.uLiqC, s.liqC.flat());
      gl.uniform3fv(u.uLiqW, s.liqW.flat());
      gl.uniform3fv(u.uLayerWarm, s.layerWarm);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
      gl.enable(gl.CULL_FACE);
      gl.cullFace(gl.FRONT); this.draw(P.liquid, M.liquid, [0, by, 0]);
      gl.cullFace(gl.BACK); this.draw(P.liquid, M.liquid, [0, by, 0]);
      gl.cullFace(gl.FRONT);
      gl.blendFunc(gl.ONE, gl.ONE);
      this.use(P.inner, s, C, R);
      this.draw(P.inner, M.body, [0, by, 0]);
      gl.disable(gl.BLEND); gl.depthMask(true); gl.disable(gl.CULL_FACE);
    }
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, f.ms);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, f.rt);
    gl.blitFramebuffer(0, 0, W, H, 0, 0, W, H, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    // ---------- pass B: screen ----------
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    gl.disable(gl.DEPTH_TEST); gl.depthMask(false);
    gl.useProgram(P.copy.p);
    gl.uniform2f(P.copy.u.uRes, W, H);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, f.tex); gl.uniform1i(P.copy.u.uScene, 0);
    gl.bindVertexArray(this.quad); gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (!visible) return { C, R };
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
    u = this.use(P.metal, s, C, R);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.tex.uLabel); gl.uniform1i(u.uLabel, 1);
    gl.uniform1f(u.uNameWarm, s.nameWarm);
    gl.uniform1f(u.uPlaque, 0);
    gl.uniform1f(u.uRough, 0.06);
    this.draw(P.metal, M.collar, [0, PARTS.collarY(e), 0]);
    this.draw(P.metal, M.act, [0, PARTS.actY(e, s.press), 0]);
    gl.uniform1f(u.uRough, 0.14);
    this.draw(P.metal, M.cap, PARTS.capP(e, s.capOff));
    gl.uniform3fv(u.uMetal, [0.05, 0.05, 0.055]);
    gl.uniform1f(u.uRough, 0.3);
    this.draw(P.metal, M.stem, [0, PARTS.stemY(e), 0]);
    u = this.use(P.glass, s, C, R);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, f.tex); gl.uniform1i(u.uScene, 0);
    gl.uniform1f(u.uRefr, 0.05);
    this.draw(P.glass, M.body, [0, by, 0]);
    u = this.use(P.metal, s, C, R);
    gl.uniform1f(u.uPlaque, 1);
    gl.uniform1f(u.uRough, 0.2);
    gl.uniform1f(u.uNameWarm, s.nameWarm);
    this.draw(P.metal, M.plaque, [0, by, 0]);
    gl.disable(gl.CULL_FACE);
    return { C, R };
  }
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
