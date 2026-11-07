// Dusk Isles backdrop: cloud sea, distant floating islands, sun glow/rays, drifting motes, star glitter.
// Camera facts: orthographic, position = target + CAM_DIR*40, so view rays are parallel and a big horizontal
// plane far below fills the screen. Everything here is positioned from the camera's screen basis.
import * as THREE from "three";

const CAM_DIR = new THREE.Vector3(1, 0.85, 1).normalize();
const BACK = CAM_DIR.clone();                                   // camera +z
const RIGHT = new THREE.Vector3(0, 1, 0).cross(BACK).normalize(); // camera +x
const UPV = BACK.clone().cross(RIGHT).normalize();               // camera +y
const FWD = BACK.clone().negate();
const BASIS_Q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(RIGHT, UPV, BACK));
const CLOUD_Y = -16;
const SUN_DEPTH = 16; // distance from the camera target along the view axis (in front of cloud sea, behind play island)
const PIX_RATIO = { low: 0.75, medium: 1, high: 2 };

// ---- themes (sRGB hex) ----
const THEME_DEFS = {
  1: { horizon: 0xf2b9a6, sky: 0x8d84c0, cloudLight: 0xffd8c4, cloudShade: 0xa8789e, deep: 0x6a5a96, sun: 0xffcf9a, glow: 0xffb08a, ambient: 0x9a88c8, moteA: 0xffc480, moteB: 0x5fe0cf, moteC: 0xfff0e0, star: 0, glowStr: 1.0 },
  2: { horizon: 0xe0a074, sky: 0x36326e, cloudLight: 0xf0b88a, cloudShade: 0x6a5694, deep: 0x2f2a64, sun: 0xffb870, glow: 0xff9a5a, ambient: 0x6a62b0, moteA: 0xffb060, moteB: 0x8a8cff, moteC: 0xffe0b8, star: 0.18, glowStr: 1.05 },
  3: { horizon: 0x6c3a94, sky: 0x120b34, cloudLight: 0x9a66c8, cloudShade: 0x3a2070, deep: 0x1a1048, sun: 0xe090ff, glow: 0xb040d0, ambient: 0x6048b0, moteA: 0xff70d8, moteB: 0x8f7bff, moteC: 0xe8d8ff, star: 1, glowStr: 0.8 },
  hub: { horizon: 0xffc884, sky: 0xa890c8, cloudLight: 0xfff0c0, cloudShade: 0xb8809a, deep: 0x7c6498, sun: 0xffe0a0, glow: 0xffc060, ambient: 0xa898c8, moteA: 0xffd080, moteB: 0xffe8a8, moteC: 0xfff6e0, star: 0, glowStr: 1.15 },
};
const COLOR_KEYS = ["horizon", "sky", "cloudLight", "cloudShade", "deep", "sun", "glow", "ambient", "moteA", "moteB", "moteC"];
const THEMES = {};
for (const k of Object.keys(THEME_DEFS)) {
  const d = THEME_DEFS[k], o = { star: d.star, glowStr: d.glowStr };
  for (const c of COLOR_KEYS) o[c] = new THREE.Color(d[c]);
  THEMES[k] = o;
}

function rng(seed) {
  return function () {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- shaders
const NOISE_GLSL = /* glsl */`
float hash21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
float vnoise(vec2 p){
  vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  float a=hash21(i), b=hash21(i+vec2(1,0)), c=hash21(i+vec2(0,1)), d=hash21(i+vec2(1,1));
  return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);
}
float fbm(vec2 p){
  float s=0.0, a=0.5;
  for(int i=0;i<NOCT;i++){ s+=a*vnoise(p); p=mat2(1.6,1.2,-1.2,1.6)*p; a*=0.5; }
  return s;
}`;

const CLOUD_VERT = /* glsl */`
varying vec3 vWorld; varying vec2 vNdc;
void main(){
  vec4 wp = modelMatrix*vec4(position,1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix*viewMatrix*wp;
  vNdc = gl_Position.xy/gl_Position.w;
}`;

const CLOUD_FRAG = /* glsl */`
precision highp float;
varying vec3 vWorld; varying vec2 vNdc;
uniform float uTime, uAspect, uStar, uGlowStr;
uniform vec2 uSunNdc;
uniform vec3 uHorizon, uSky, uCloudLight, uCloudShade, uDeep, uSun, uGlow;
${NOISE_GLSL}
void main(){
  float t = vNdc.y*0.5+0.5;
  // screen-right (b) and away (a) axes in world xz
  vec2 b = vec2(0.7071,-0.7071), a = vec2(-0.7071,-0.7071);
  float u = dot(vWorld.xz,b), v = dot(vWorld.xz,a);
  // stretch clouds sideways, compress a little toward the horizon for perspective feel
  float squash = 1.0 + 1.6*smoothstep(0.2,0.9,t);
  vec2 p = vec2(u*0.55, v*squash)*0.16 + vec2(uTime*0.010, uTime*0.004);
  vec2 q = vec2(fbm(p+vec2(0.0,uTime*0.008)), fbm(p+vec2(5.2,1.3)));
  vec2 pw = p + 1.1*q;
  float n = fbm(pw);
  #if LIGHT
    float n2 = fbm(pw + vec2(0.10,0.07));   // sample toward the sun (upper-left on screen)
    float lit = clamp(0.5 + (n2-n)*7.0, 0.0, 1.0);
  #else
    float lit = smoothstep(0.30,0.80,n);
  #endif
  float body = smoothstep(0.36,0.60,n);
  vec3 cloud = mix(uCloudShade, uCloudLight, lit*0.85+0.1);
  vec3 col = mix(uDeep, cloud, body);
  float rim = smoothstep(0.42,0.52,n)*(1.0-smoothstep(0.52,0.7,n))*lit;
  col += uSun*rim*0.22;

  // horizon haze + layered cloud bands
  float hz = smoothstep(0.25,0.88,t);
  float bands = fbm(vec2(u*0.05, t*26.0)+vec2(uTime*0.01,0.0));
  vec3 bandCol = mix(uHorizon, uCloudLight, smoothstep(0.35,0.75,bands)*0.55);
  float bandMask = smoothstep(0.45,0.70,t)*(1.0-smoothstep(0.80,0.92,t));
  col = mix(col, uHorizon, hz*0.8);
  col = mix(col, bandCol, bandMask*0.5);

  // sky above the horizon line
  float sk = smoothstep(0.80,1.02,t);
  vec3 sky = mix(uHorizon, uSky, pow(sk,0.8));
  col = mix(col, sky, smoothstep(0.76,0.90,t));
  float cir = smoothstep(0.50,0.85, fbm(vec2(vNdc.x*uAspect*1.6+uTime*0.01, t*16.0)+3.0));
  col = mix(col, uCloudLight, cir*smoothstep(0.84,0.98,t)*0.22);

  // sun glow tint
  vec2 sd = (vNdc-uSunNdc)*vec2(uAspect,1.0);
  float sg = exp(-dot(sd,sd)*1.6);
  col += uGlow*sg*0.14*uGlowStr;

  // stars + glitter (night theme)
  if(uStar>0.01){
    float skyMask = smoothstep(0.66,0.95,t);
    float st = 0.0;
    for(int L=0;L<2;L++){
      float dens = L==0 ? 70.0 : 26.0;
      vec2 sp = vec2(vNdc.x*uAspect, vNdc.y)*dens;
      vec2 cell = floor(sp);
      float h = hash21(cell+float(L)*17.0);
      vec2 off = (vec2(hash21(cell+7.1),hash21(cell+13.7))-0.5)*0.6;
      float d = length(fract(sp)-0.5-off);
      float rad = L==0 ? 0.16 : 0.22;
      float tw = 0.55+0.45*sin(uTime*(1.2+h*3.0)+h*40.0);
      st += step(L==0?0.90:0.93, h)*smoothstep(rad,0.0,d)*tw;
    }
    col += vec3(1.0,0.92,1.0)*st*skyMask*uStar*1.3;
    // sparkles riding the lit cloud tops
    vec2 gp = vWorld.xz*6.0; vec2 gc = floor(gp);
    float gh = hash21(gc);
    float gs = step(0.965,gh)*smoothstep(0.30,0.0,length(fract(gp)-0.5))*pow(0.5+0.5*sin(uTime*(1.5+gh*2.5)+gh*60.0),3.0);
    col += uSun*gs*body*lit*uStar*0.9*(1.0-hz);
  }
  col += (hash21(gl_FragCoord.xy)-0.5)/200.0; // dither against banding
  gl_FragColor = vec4(col,1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const ISLE_VERT = /* glsl */`
attribute vec3 aCol; attribute float aEmit; attribute vec4 aMeta; // phase, amp, haze, parallax
varying vec3 vW; varying vec3 vCol; varying float vEmit; varying float vHaze;
uniform float uTime; uniform vec3 uTarget;
void main(){
  vec3 pos = position;
  pos.y += sin(uTime*0.35 + aMeta.x)*aMeta.y;
  pos.xz += uTarget.xz*aMeta.w;
  vec4 wp = modelMatrix*vec4(pos,1.0);
  vW = wp.xyz; vCol = aCol; vEmit = aEmit; vHaze = aMeta.z;
  gl_Position = projectionMatrix*viewMatrix*wp;
}`;

const ISLE_FRAG = /* glsl */`
precision highp float;
varying vec3 vW; varying vec3 vCol; varying float vEmit; varying float vHaze;
uniform vec3 uHorizon, uAmbient, uSun, uGlow, uCloudLight;
void main(){
  vec3 N = normalize(cross(dFdx(vW), dFdy(vW)));
  vec3 L = normalize(vec3(-6.0,10.0,4.0));
  float ndl = max(dot(N,L),0.0);
  vec3 lit = uAmbient*(0.5+0.3*N.y) + uSun*ndl*0.9;
  vec3 c = vCol*lit*1.2;
  c += uGlow*pow(max(1.0-abs(N.y),0.0),2.0)*max(dot(N,normalize(vec3(-1.0,0.2,0.3))),0.0)*0.12; // warm sun-side rim
  c = mix(c, vCol*1.15, vEmit);
  c = mix(c, uHorizon, vHaze*0.62);
  float mist = smoothstep(-8.0,-15.5,vW.y);
  c = mix(c, mix(uCloudLight,uHorizon,0.5), mist*0.7);
  gl_FragColor = vec4(c,1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const SUN_VERT = /* glsl */`
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;

const SUN_FRAG = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform float uTime, uAspect, uGlowStr, uRays;
uniform vec2 uSunNdc;
uniform vec3 uGlow, uSun;
#define NOCT 2
${NOISE_GLSL}
void main(){
  vec2 ndc = vUv*2.0-1.0;
  vec2 d = (ndc-uSunNdc)*vec2(uAspect,1.0);
  float r2 = dot(d,d), r = sqrt(r2);
  float g = exp(-r2*1.6)*0.07 + exp(-r2*10.0)*0.06 + exp(-r2*90.0)*0.10;
  vec3 col = mix(uGlow,uSun,0.5)*g;
  if(uRays>0.5){
    vec2 dir = d/max(r,1e-4);
    float ra = vnoise(dir*3.2+vec2(uTime*0.05,0.0)) * vnoise(dir*6.5+vec2(5.0,-uTime*0.035));
    float rays = pow(ra*1.8,2.0)*exp(-r*0.85)*smoothstep(0.05,0.35,r);
    col += uSun*rays*0.12;
  }
  col *= uGlowStr;
  gl_FragColor = vec4(col,1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const PART_VERT = /* glsl */`
attribute vec4 aSeed; // speed, phase, size, kind
varying vec3 vColor; varying float vAlpha;
uniform float uTime, uPx, uSizeMul, uAlpha, uTwinkle, uRise;
uniform vec3 uTarget, uBox, uCenter, uMoteA, uMoteB, uMoteC;
void main(){
  float sp = aSeed.x, ph = aSeed.y;
  float ember = step(0.88, aSeed.w);
  vec3 vel = vec3(0.30, 0.06 + uRise*ember, 0.20)*(0.4+sp);
  vec3 p = position*uBox + vel*uTime
         + vec3(sin(uTime*0.4*sp+ph)*0.6, sin(uTime*0.55+ph*1.7)*0.4, cos(uTime*0.37*sp+ph)*0.6);
  vec3 tx = vec3(uTarget.x,0.0,uTarget.z);
  vec3 w = mod(p - tx, uBox);
  vec3 e = w/uBox;
  float edge = smoothstep(0.0,0.12,e.x)*smoothstep(1.0,0.88,e.x)*smoothstep(0.0,0.15,e.y)*smoothstep(1.0,0.85,e.y)*smoothstep(0.0,0.12,e.z)*smoothstep(1.0,0.88,e.z);
  float tw = mix(1.0, 0.5+0.5*sin(uTime*(1.2+sp*2.2)+ph*6.2832), uTwinkle);
  vec3 world = w - uBox*0.5 + uCenter + tx;
  vColor = aSeed.w<0.5 ? uMoteA : (aSeed.w<0.85 ? uMoteB : uMoteC);
  vAlpha = edge*tw*uAlpha;
  gl_PointSize = max(aSeed.z*uSizeMul*uPx*(0.75+0.25*tw), 1.0);
  gl_Position = projectionMatrix*viewMatrix*vec4(world,1.0);
}`;

const PART_FRAG = /* glsl */`
precision highp float;
uniform sampler2D uMap;
varying vec3 vColor; varying float vAlpha;
void main(){
  float a = texture2D(uMap, gl_PointCoord).r;
  gl_FragColor = vec4(vColor*1.2, a*vAlpha*0.8);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// ---------------------------------------------------------------- island geometry builder
class Builder {
  constructor() { this.pos = []; this.col = []; this.emit = []; this.meta = []; this._c = new THREE.Color(); this.rnd = rng(1337); }
  tri(a, b, c, hex, emit = 0, jit = 0.12) {
    const k = 1 - jit + this.rnd() * jit * 2;
    this._c.setHex(hex);
    const r = Math.min(this._c.r * k, 1), g = Math.min(this._c.g * k, 1), bl = Math.min(this._c.b * k, 1);
    for (const p of [a, b, c]) { this.pos.push(p[0], p[1], p[2]); this.col.push(r, g, bl); this.emit.push(emit); }
  }
  quad(a, b, c, d, hex, emit, jit) { this.tri(a, b, c, hex, emit, jit); this.tri(a, c, d, hex, emit, jit); }
  box(cx, cy, cz, sx, sy, sz, rotY, hex, emit = 0) {
    const cs = Math.cos(rotY), sn = Math.sin(rotY);
    const P = (x, y, z) => [cx + x * cs + z * sn, cy + y, cz - x * sn + z * cs];
    const hx = sx / 2, hz = sz / 2;
    const v = [P(-hx, 0, -hz), P(hx, 0, -hz), P(hx, 0, hz), P(-hx, 0, hz), P(-hx, sy, -hz), P(hx, sy, -hz), P(hx, sy, hz), P(-hx, sy, hz)];
    const f = [[0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7], [4, 5, 6, 7]];
    for (const q of f) this.quad(v[q[0]], v[q[1]], v[q[2]], v[q[3]], hex, emit, 0.08);
  }
  cone(cx, cy, cz, r, h, segs, hex) {
    const ring = [];
    for (let i = 0; i < segs; i++) { const a = (i / segs) * Math.PI * 2; ring.push([cx + Math.cos(a) * r, cy, cz + Math.sin(a) * r]); }
    const apex = [cx, cy + h, cz];
    for (let i = 0; i < segs; i++) this.tri(ring[i], ring[(i + 1) % segs], apex, hex, 0, 0.14);
  }
  get count() { return this.pos.length / 3; }
}

function addIsland(B, o) {
  const { cx, cy, cz, r, h, seed, trees, ruins, waterfall, lantern } = o;
  const R = rng(seed), N = 8;
  const r0 = [], r1 = [], r2 = [];
  const a0 = R() * 6;
  for (let i = 0; i < N; i++) {
    const a = a0 + (i / N) * Math.PI * 2 + (R() - 0.5) * 0.3, rr = r * (0.82 + R() * 0.3);
    const ca = Math.cos(a), sa = Math.sin(a);
    r0.push([cx + ca * rr, cy + (R() - 0.5) * 0.06 * r, cz + sa * rr]);
    r1.push([cx + ca * rr * (0.84 + R() * 0.16), cy - 0.2 * h, cz + sa * rr * (0.84 + R() * 0.16)]);
    r2.push([cx + ca * rr * (0.40 + R() * 0.2), cy - 0.58 * h, cz + sa * rr * (0.40 + R() * 0.2)]);
  }
  const tip = [cx + (R() - 0.5) * r * 0.3, cy - h, cz + (R() - 0.5) * r * 0.3];
  const top = [cx, cy + 0.1 * r, cz];
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    B.tri(top, r0[i], r0[j], R() < 0.5 ? 0x7fb070 : 0x6e9e68, 0, 0.1); // moss top
    B.quad(r0[i], r0[j], r1[j], r1[i], 0x8a6a78, 0, 0.12);            // soil lip
    B.quad(r1[i], r1[j], r2[j], r2[i], 0x8a7ca0, 0, 0.16);            // rock
    B.tri(r2[i], r2[j], tip, 0x6d5f8c, 0, 0.18);                       // rock tip
  }
  // trees
  for (let i = 0; i < (trees || 0); i++) {
    const a = R() * 6.28, d = r * (0.15 + R() * 0.5), s = r * (0.16 + R() * 0.1);
    const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d, y = cy + 0.1 * r * (1 - d / r);
    B.box(x, y, z, s * 0.18, s * 0.5, s * 0.18, 0, 0x5a4658);
    B.cone(x, y + s * 0.35, z, s * 0.55, s * 1.0, 5, R() < 0.5 ? 0x4f8a6a : 0x5f9a5a);
    B.cone(x, y + s * 0.85, z, s * 0.4, s * 0.8, 5, 0x6aa86a);
  }
  // ruins: an arch plus a broken wall
  if (ruins) {
    const s = r * 0.32, rx = cx + r * 0.08, rz = cz - r * 0.05, ry = cy + 0.1 * r * 0.85, rot = R() * 3;
    const cs = Math.cos(rot), sn = Math.sin(rot);
    B.box(rx - s * 0.5 * cs, ry, rz + s * 0.5 * sn, s * 0.22, s * 1.2, s * 0.22, rot, 0xc4b4cc);
    B.box(rx + s * 0.5 * cs, ry, rz - s * 0.5 * sn, s * 0.22, s * 0.9, s * 0.22, rot, 0xb4a4c0);
    B.box(rx, ry + s * 1.2, rz, s * 1.3, s * 0.2, s * 0.26, rot, 0xd0c0d4);
    B.box(rx + s * 0.9 * sn, ry, rz + s * 0.9 * cs, s * 0.9, s * 0.4, s * 0.2, rot + 0.5, 0xb0a0bc);
    if (lantern) B.box(rx, ry + s * 0.55, rz, s * 0.12, s * 0.16, s * 0.12, 0, 0xffc060, 1);
  }
  // waterfall ribbon off the rim
  if (waterfall) {
    const i = waterfall.edge % N, j = (i + 1) % N;
    const m = [(r0[i][0] + r0[j][0]) / 2, r0[i][1], (r0[i][2] + r0[j][2]) / 2];
    const ox = m[0] - cx, oz = m[2] - cz, ol = Math.hypot(ox, oz), nx = ox / ol, nz = oz / ol;
    const tx = -nz, tz = nx, L = h * 2.4, w0 = r * 0.14, segs = 5;
    for (let k = 0; k < segs; k++) {
      const f0 = k / segs, f1 = (k + 1) / segs;
      const y0 = m[1] - L * f0, y1 = m[1] - L * f1, w_0 = w0 * (1 - 0.5 * f0), w_1 = w0 * (1 - 0.5 * f1);
      const x0 = m[0] + nx * 0.06 * r * (1 + f0), z0 = m[2] + nz * 0.06 * r * (1 + f0);
      const x1 = m[0] + nx * 0.06 * r * (1 + f1), z1 = m[2] + nz * 0.06 * r * (1 + f1);
      B.quad([x0 - tx * w_0, y0, z0 - tz * w_0], [x0 + tx * w_0, y0, z0 + tz * w_0], [x1 + tx * w_1, y1, z1 + tz * w_1], [x1 - tx * w_1, y1, z1 - tz * w_1],
        k % 2 ? 0xa8d4f0 : 0xc4e4f8, 0.7, 0.04);
    }
  }
}

// screen-space placement: (sx, sy) in world screen units at camera target (0,0), y = world height of island top
function placeFromScreen(sx, sy, y, out) {
  const d = (UPV.y * sy - y) / -FWD.y;
  out.x = RIGHT.x * sx + UPV.x * sy + FWD.x * d;
  out.z = RIGHT.z * sx + UPV.z * sy + FWD.z * d;
  return out;
}

// layer: near/mid/far -> haze, parallax, y
const LAYERS = { near: { haze: 0.22, par: 0.55, y: -5.5 }, mid: { haze: 0.48, par: 0.70, y: -8.5 }, far: { haze: 0.74, par: 0.85, y: -11 } };
const ISLES = [ // priority order: first N used on low quality
  { sx: -6.8, sy: 5.8, layer: "mid", r: 1.9, ruins: 1, trees: 2, lantern: 1 },
  { sx: 8.2, sy: 5.6, layer: "mid", r: 1.6, trees: 4, waterfall: { edge: 3 } },
  { sx: 0.6, sy: 6.6, layer: "far", r: 1.5, trees: 2 },
  { sx: -10.8, sy: 1.8, layer: "near", r: 2.5, ruins: 1, trees: 3, waterfall: { edge: 5 }, lantern: 1 },
  { sx: 11.4, sy: -1.8, layer: "near", r: 2.1, trees: 4, ruins: 1 },
  { sx: -3.4, sy: 7.6, layer: "far", r: 1.1, trees: 1 },
  { sx: 13.2, sy: 4.0, layer: "far", r: 1.3, waterfall: { edge: 1 }, trees: 2 },
  { sx: -13.2, sy: 5.2, layer: "far", r: 1.2, ruins: 1 },
  { sx: -12.6, sy: -3.6, layer: "mid", r: 1.7, trees: 3 },
  { sx: 12.4, sy: -5.2, layer: "mid", r: 1.5, ruins: 1, lantern: 1 },
];
const ISLE_COUNT = { low: 6, medium: 8, high: 10 };
const PART_COUNT = { low: 40, medium: 120, high: 220 };
const BOKEH_COUNT = { low: 0, medium: 6, high: 12 };

// ---------------------------------------------------------------- main
export function createBackdrop(scene, camera) {
  const root = new THREE.Group(); root.name = "backdrop"; scene.add(root);
  const disposables = [];
  const track = (o) => { disposables.push(o); return o; };

  // shared uniforms
  const cur = {};
  for (const c of COLOR_KEYS) cur[c] = new THREE.Color().copy(THEMES[1][c]);
  const U = {
    uTime: { value: 0 }, uTarget: { value: new THREE.Vector3() }, uAspect: { value: 1.6 },
    uStar: { value: 0 }, uGlowStr: { value: 1 }, uSunNdc: { value: new THREE.Vector2(-0.5, 0.6) },
    uHorizon: { value: cur.horizon }, uSky: { value: cur.sky }, uCloudLight: { value: cur.cloudLight }, uCloudShade: { value: cur.cloudShade },
    uDeep: { value: cur.deep }, uSun: { value: cur.sun }, uGlow: { value: cur.glow }, uAmbient: { value: cur.ambient },
    uMoteA: { value: cur.moteA }, uMoteB: { value: cur.moteB }, uMoteC: { value: cur.moteC },
  };
  const pick = (...names) => { const o = {}; for (const n of names) o[n] = U[n]; return o; };

  // --- cloud sea
  const cloudGeo = track(new THREE.PlaneGeometry(360, 360)); cloudGeo.rotateX(-Math.PI / 2);
  const cloudMat = track(new THREE.ShaderMaterial({
    vertexShader: CLOUD_VERT, fragmentShader: CLOUD_FRAG, fog: false, depthWrite: true, depthTest: true,
    defines: { NOCT: 5, LIGHT: 1 },
    uniforms: pick("uTime", "uAspect", "uStar", "uGlowStr", "uSunNdc", "uHorizon", "uSky", "uCloudLight", "uCloudShade", "uDeep", "uSun", "uGlow"),
  }));
  const cloud = new THREE.Mesh(cloudGeo, cloudMat);
  cloud.position.y = CLOUD_Y; cloud.frustumCulled = false; cloud.renderOrder = -100; root.add(cloud);

  // --- distant islands (single merged mesh, all layers)
  const B = new Builder();
  const ranges = [];
  const tmp = { x: 0, z: 0 };
  ISLES.forEach((s, i) => {
    const L = LAYERS[s.layer], start = B.count;
    placeFromScreen(s.sx, s.sy, L.y, tmp);
    addIsland(B, { cx: tmp.x, cy: L.y, cz: tmp.z, r: s.r, h: s.r * (1.1 + (i % 3) * 0.2), seed: 100 + i * 31, trees: s.trees, ruins: s.ruins, waterfall: s.waterfall, lantern: s.lantern });
    const ph = i * 1.7, amp = 0.12 + (i % 3) * 0.06;
    for (let k = start; k < B.count; k++) B.meta.push(ph, amp, L.haze, L.par);
    ranges.push(B.count);
  });
  const isleGeo = track(new THREE.BufferGeometry());
  isleGeo.setAttribute("position", new THREE.Float32BufferAttribute(B.pos, 3));
  isleGeo.setAttribute("aCol", new THREE.Float32BufferAttribute(B.col, 3));
  isleGeo.setAttribute("aEmit", new THREE.Float32BufferAttribute(B.emit, 1));
  isleGeo.setAttribute("aMeta", new THREE.Float32BufferAttribute(B.meta, 4));
  const isleMat = track(new THREE.ShaderMaterial({
    vertexShader: ISLE_VERT, fragmentShader: ISLE_FRAG, fog: false, side: THREE.DoubleSide,
    uniforms: pick("uTime", "uTarget", "uHorizon", "uAmbient", "uSun", "uGlow", "uCloudLight"),
  }));
  const isles = new THREE.Mesh(isleGeo, isleMat);
  isles.frustumCulled = false; isles.renderOrder = -90; root.add(isles);

  // --- sun glow + rays (screen-sized quad between the island and the cloud sea)
  const sunGeo = track(new THREE.PlaneGeometry(1, 1));
  const sunMat = track(new THREE.ShaderMaterial({
    vertexShader: SUN_VERT, fragmentShader: SUN_FRAG, fog: false, transparent: true, depthWrite: false, depthTest: true,
    blending: THREE.AdditiveBlending,
    uniforms: Object.assign(pick("uTime", "uAspect", "uGlowStr", "uSunNdc", "uGlow", "uSun"), { uRays: { value: 1 } }),
  }));
  const sun = new THREE.Mesh(sunGeo, sunMat);
  sun.quaternion.copy(BASIS_Q); sun.frustumCulled = false; sun.renderOrder = -50; root.add(sun);

  // --- particles
  const c64 = document.createElement("canvas"); c64.width = c64.height = 64;
  const g2 = c64.getContext("2d"), grd = g2.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, "rgba(255,255,255,1)"); grd.addColorStop(0.25, "rgba(255,255,255,0.75)");
  grd.addColorStop(0.6, "rgba(255,255,255,0.18)"); grd.addColorStop(1, "rgba(255,255,255,0)");
  g2.fillStyle = grd; g2.fillRect(0, 0, 64, 64);
  const sprite = track(new THREE.CanvasTexture(c64));
  const px = { value: 77 };

  function makeParticles(maxN, seed, box, center, size, alpha, twinkle, rise, sizeMul) {
    const R = rng(seed), pos = new Float32Array(maxN * 3), sd = new Float32Array(maxN * 4);
    for (let i = 0; i < maxN; i++) {
      pos[i * 3] = R(); pos[i * 3 + 1] = R(); pos[i * 3 + 2] = R();
      sd[i * 4] = R(); sd[i * 4 + 1] = R() * 6.28; sd[i * 4 + 2] = size[0] + R() * R() * (size[1] - size[0]); sd[i * 4 + 3] = R();
    }
    const geo = track(new THREE.BufferGeometry());
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aSeed", new THREE.BufferAttribute(sd, 4));
    const mat = track(new THREE.ShaderMaterial({
      vertexShader: PART_VERT, fragmentShader: PART_FRAG, fog: false, transparent: true, depthWrite: false, depthTest: true,
      blending: THREE.AdditiveBlending,
      uniforms: Object.assign(pick("uTime", "uTarget", "uMoteA", "uMoteB", "uMoteC"), {
        uPx: px, uMap: { value: sprite }, uBox: { value: new THREE.Vector3(...box) }, uCenter: { value: new THREE.Vector3(...center) },
        uSizeMul: { value: sizeMul }, uAlpha: { value: alpha }, uTwinkle: { value: twinkle }, uRise: { value: rise },
      }),
    }));
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false; root.add(pts);
    return pts;
  }
  const motes = makeParticles(220, 7, [28, 18, 28], [0, 1, 0], [0.07, 0.3], 0.95, 0.85, 0.35, 1);
  motes.renderOrder = 10;
  // big soft bokeh motes near the camera, in front of the island
  const bokeh = makeParticles(16, 21, [18, 8, 18], [BACK.x * 16, BACK.y * 16 + 2, BACK.z * 16], [0.6, 1.4], 0.05, 0.5, 0.1, 1);
  bokeh.renderOrder = 11;

  // --- quality / viewport
  let quality = "high", lastH = -1, lastSpan = -1;
  function applyQuality(q) {
    quality = PIX_RATIO[q] ? q : "high";
    const hi = quality === "high", lo = quality === "low";
    cloudMat.defines.NOCT = lo ? 3 : hi ? 5 : 4;
    cloudMat.defines.LIGHT = lo ? 0 : 1;
    cloudMat.needsUpdate = true;
    sunMat.uniforms.uRays.value = lo ? 0 : 1;
    isleGeo.setDrawRange(0, ranges[Math.min(ISLE_COUNT[quality], ranges.length) - 1]);
    motes.geometry.setDrawRange(0, PART_COUNT[quality]);
    bokeh.visible = BOKEH_COUNT[quality] > 0;
    bokeh.geometry.setDrawRange(0, BOKEH_COUNT[quality]);
    lastH = -1;
  }
  applyQuality("high");

  // --- themes
  let tgt = THEMES[1];
  function snapTheme() {
    for (const c of COLOR_KEYS) cur[c].copy(tgt[c]);
    U.uStar.value = tgt.star; U.uGlowStr.value = tgt.glowStr;
  }
  snapTheme();
  function setTheme(key, snap) {
    const t = THEMES[key]; if (!t) return;
    tgt = t; if (snap) snapTheme();
  }

  function update(dt, t, tx, tz) {
    U.uTime.value = t;
    U.uTarget.value.set(tx, 0, tz);
    const k = 1 - Math.exp(-dt * 3.2);
    for (let i = 0; i < COLOR_KEYS.length; i++) cur[COLOR_KEYS[i]].lerp(tgt[COLOR_KEYS[i]], k);
    U.uStar.value += (tgt.star - U.uStar.value) * k;
    U.uGlowStr.value += (tgt.glowStr - U.uGlowStr.value) * k;

    const w = camera.right - camera.left, h = camera.top - camera.bottom;
    if (h !== lastSpan || window.innerHeight !== lastH) {
      lastSpan = h; lastH = window.innerHeight;
      px.value = (lastH * Math.min(window.devicePixelRatio || 1, PIX_RATIO[quality])) / h;
    }
    U.uAspect.value = w / h;
    cloud.position.x = tx; cloud.position.z = tz;
    sun.position.set(tx + FWD.x * SUN_DEPTH, FWD.y * SUN_DEPTH, tz + FWD.z * SUN_DEPTH);
    sun.scale.set(w * 1.02, h * 1.02, 1);
  }

  function dispose() {
    scene.remove(root);
    for (const d of disposables) d.dispose();
    disposables.length = 0;
  }

  return { setTheme, setQuality: applyQuality, update, dispose };
}
