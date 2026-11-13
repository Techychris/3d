// Needs: node --test --experimental-test-module-mocks (mock.module). Swaps WebGL and the post-processing
// addons for recording fakes so the real render.js logic runs in node.
import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "./helpers.mjs";

const dom = await installDom();
const real = await import("three");
const THREE = real;
const created = { renderers: [], composers: [], passes: [] };

class FakeRenderer {
  constructor(opts) {
    this.opts = opts;
    this.domElement = document.createElement("canvas");
    this.shadowMap = { enabled: false, type: null };
    this.toneMapping = null;
    this.toneMappingExposure = 1;
    this.pixelRatio = 1;
    this.setSizeCalls = [];
    this.renders = [];
    created.renderers.push(this);
  }
  setPixelRatio(r) { this.pixelRatio = r; }
  getPixelRatio() { return this.pixelRatio; }
  setSize(w, h, updateStyle) { this.setSizeCalls.push([w, h, updateStyle]); }
  render(scene, camera) { this.renders.push([scene, camera]); }
  setAnimationLoop() {}
}
class FakeComposer {
  constructor(renderer) { this.renderer = renderer; this.passes = []; this.renders = 0; this.sizes = []; this.pr = null; created.composers.push(this); }
  addPass(p) { this.passes.push(p); }
  render() { this.renders++; }
  setSize(w, h) { this.sizes.push([w, h]); }
  setPixelRatio(p) { this.pr = p; }
}
class FakeRenderPass { constructor(scene, camera) { this.scene = scene; this.camera = camera; this.enabled = true; } }
class FakeShaderPass {
  constructor(shader) { this.shader = shader; this.enabled = true; this.uniforms = { h: { value: 0 }, v: { value: 0 }, r: { value: 0.5 } }; created.passes.push(this); }
}
class FakeBloomPass { constructor(res, strength, radius, threshold) { this.enabled = true; this.args = [res, strength, radius, threshold]; } }
class FakeOutputPass { constructor() { this.enabled = true; } }

// Mocks must be registered before render.js is imported.
mock.module("three", { namedExports: { ...real, WebGLRenderer: FakeRenderer } });
mock.module("three/addons/postprocessing/EffectComposer.js", { namedExports: { EffectComposer: FakeComposer } });
mock.module("three/addons/postprocessing/RenderPass.js", { namedExports: { RenderPass: FakeRenderPass } });
mock.module("three/addons/postprocessing/ShaderPass.js", { namedExports: { ShaderPass: FakeShaderPass } });
mock.module("three/addons/postprocessing/UnrealBloomPass.js", { namedExports: { UnrealBloomPass: FakeBloomPass } });
mock.module("three/addons/postprocessing/OutputPass.js", { namedExports: { OutputPass: FakeOutputPass } });
mock.module("three/addons/shaders/HorizontalTiltShiftShader.js", { namedExports: { HorizontalTiltShiftShader: { name: "H", uniforms: {} } } });
mock.module("three/addons/shaders/VerticalTiltShiftShader.js", { namedExports: { VerticalTiltShiftShader: { name: "V", uniforms: {} } } });

const { createRenderer } = await import("../../src/engine/render.js");

const closeTo = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} is not close to ${b}`);
const CAM_DIR = new THREE.Vector3(1, 0.85, 1).normalize();

function container(w = 0, h = 0) {
  const div = document.createElement("div");
  Object.defineProperty(div, "clientWidth", { value: w, configurable: true });
  Object.defineProperty(div, "clientHeight", { value: h, configurable: true });
  document.body.appendChild(div);
  return div;
}
// Builds a renderer and returns its fakes alongside it.
function make(w = 1600, h = 900) {
  const el = container(w, h);
  const r = createRenderer(el);
  const renderer = created.renderers.at(-1);
  const composer = created.composers.at(-1);
  const hT = created.passes.find((p) => p.shader.name === "H");
  const vT = created.passes.find((p) => p.shader.name === "V");
  const bloom = composer.passes.find((p) => p instanceof FakeBloomPass);
  return { r, el, renderer, composer, hT, vT, bloom };
}
const lights = (scene, Type) => scene.children.filter((o) => o instanceof Type);

beforeEach(() => {
  dom.window.innerWidth = 1024; dom.window.innerHeight = 768; dom.window.devicePixelRatio = 1;
  created.renderers.length = 0; created.composers.length = 0; created.passes.length = 0;
});
afterEach(() => { dom.window.devicePixelRatio = 1; });

describe("createRenderer setup", () => {
  it("creates the WebGL renderer with antialiasing, ACES tone mapping and PCF shadows", () => {
    const { el, renderer } = make();
    assert.equal(renderer.opts.antialias, true);
    assert.equal(renderer.opts.powerPreference, "high-performance");
    assert.equal(renderer.toneMapping, THREE.ACESFilmicToneMapping);
    assert.equal(renderer.toneMappingExposure, 1.05);
    assert.equal(renderer.shadowMap.type, THREE.PCFShadowMap);
    assert.equal(renderer.domElement.style.touchAction, "none");
    assert.ok(el.contains(renderer.domElement));
  });

  it("builds the scene with a background, lights and a shadow-casting sun", () => {
    const { r } = make();
    assert.equal(r.scene.background.getHex(), 0xc7a9c4);
    assert.equal(lights(r.scene, THREE.HemisphereLight).length, 1);
    assert.equal(r.sun instanceof THREE.DirectionalLight, true);
    assert.ok(r.scene.children.includes(r.sun));
    assert.equal(r.sun.castShadow, true); // high preset
    assert.equal(r.sun.shadow.mapSize.x, 1024);
  });

  it("chains the post-processing passes in order: scene, bloom, horizontal and vertical tilt shift, output", () => {
    const { composer, bloom, hT, vT } = make();
    assert.equal(composer.passes.length, 5);
    assert.ok(composer.passes[0] instanceof FakeRenderPass);
    assert.equal(composer.passes[1], bloom);
    assert.equal(composer.passes[2], hT);
    assert.equal(composer.passes[3], vT);
    assert.ok(composer.passes[4] instanceof FakeOutputPass);
    assert.deepEqual(bloom.args.slice(1), [0.45, 0.6, 0.85]);
  });

  it("exposes the preset table with three quality levels", () => {
    const { r } = make();
    assert.deepEqual(Object.keys(r.PRESETS), ["low", "medium", "high"]);
    assert.equal(r.PRESETS.high.lamps, 4);
    assert.equal(r.PRESETS.low.maxFps, 30);
  });
});

describe("presets", () => {
  it("low turns off shadows, fog, bloom and blur and caps at 30 fps with no lamps", () => {
    const { r, renderer, bloom } = make();
    r.setPreset("low");
    assert.equal(r.preset, "low");
    assert.equal(r.maxFps, 30);
    assert.equal(renderer.pixelRatio, 0.75);
    assert.equal(renderer.shadowMap.enabled, false);
    assert.equal(r.sun.castShadow, false);
    assert.equal(r.scene.fog, null);
    assert.equal(bloom.enabled, false);
  });

  it("medium keeps shadows, fog and bloom but leaves out blur", () => {
    const { r, renderer, bloom } = make();
    r.setPreset("medium");
    assert.equal(r.maxFps, 60);
    assert.equal(renderer.pixelRatio, 1);
    assert.equal(renderer.shadowMap.enabled, true);
    assert.ok(r.scene.fog instanceof THREE.Fog);
    assert.equal(bloom.enabled, true);
  });

  it("high turns on everything at up to two times the device pixel ratio", () => {
    const { r, renderer, bloom } = make();
    r.setPreset("high");
    assert.equal(renderer.pixelRatio, 1); // device ratio 1 here
    assert.equal(bloom.enabled, true);
    assert.ok(r.scene.fog instanceof THREE.Fog);
  });

  it("caps the pixel ratio per preset when the device ratio is high", () => {
    dom.window.devicePixelRatio = 3;
    const { r, renderer } = make();
    r.setPreset("high");
    assert.equal(renderer.pixelRatio, 2);
    r.setPreset("medium");
    assert.equal(renderer.pixelRatio, 1);
    r.setPreset("low");
    assert.equal(renderer.pixelRatio, 0.75);
  });

  it("treats a missing device pixel ratio as 1", () => {
    dom.window.devicePixelRatio = undefined;
    const { r, renderer } = make();
    r.setPreset("high");
    assert.equal(renderer.pixelRatio, 1);
  });

  it("marks every material for recompilation, including arrays of materials", () => {
    const { r } = make();
    const single = new THREE.MeshBasicMaterial();
    const a = new THREE.MeshBasicMaterial(), b = new THREE.MeshBasicMaterial();
    const m1 = new THREE.Mesh(new THREE.BoxGeometry(), single);
    const m2 = new THREE.Mesh(new THREE.BoxGeometry(), [a, b]);
    r.scene.add(m1, m2);
    const versions = [single.version, a.version, b.version];
    r.setPreset("medium");
    assert.ok(single.version > versions[0]);
    assert.ok(a.version > versions[1]);
    assert.ok(b.version > versions[2]);
  });
});

describe("resize", () => {
  it("sizes the renderer and composer to the container and sets the canvas style", () => {
    const { renderer, composer, r } = make(1600, 900);
    r.resize();
    const [w, h, style] = renderer.setSizeCalls.at(-1);
    assert.deepEqual([w, h, style], [1600, 900, false]);
    assert.equal(renderer.domElement.style.width, "1600px");
    assert.equal(renderer.domElement.style.height, "900px");
    assert.deepEqual(composer.sizes.at(-1), [1600, 900]);
    assert.equal(composer.pr, renderer.getPixelRatio());
  });

  it("on a short screen (a phone in landscape) pulls back 10% and slides the room left of centre", () => {
    const desk = make(1600, 900), phone = make(844, 390);
    desk.r.resize(); phone.r.resize();
    const d = desk.r.camera, p = phone.r.camera;
    closeTo(d.left, -d.right);                                   // desktop: centred
    assert.ok(p.right > -p.left, "the view is shifted right, so the room appears left");
    closeTo((p.right + p.left) / (p.right - p.left), 0.08);      // by 8% of the half width
    closeTo(p.top, d.top * 1.1);                                 // and 10% further back
    closeTo(p.top, -p.bottom);
  });

  it("falls back to the window size when the container has no size", () => {
    const { renderer, r } = make(0, 0);
    r.resize();
    assert.deepEqual(renderer.setSizeCalls.at(-1).slice(0, 2), [1024, 768]);
  });

  it("fits the view at landscape, square, portrait and ultra-wide aspects", () => {
    const cases = [
      { w: 1600, h: 900, top: 5.2 },            // 16:9, room fits the default height
      { w: 800, h: 800, top: 7.4 },             // square, needs 7.4 to fit the 12 x 10 tile area
      { w: 400, h: 800, top: 14.8 },            // portrait, 7.4 / 0.5
      { w: 2100, h: 900, top: 5.2 },            // 21:9
    ];
    for (const c of cases) {
      const { r, renderer } = make(c.w, c.h);
      r.resize();
      const cam = r.camera;
      const a = c.w / c.h;
      closeTo(cam.top, c.top);
      closeTo(cam.bottom, -c.top);
      closeTo((cam.right - cam.left) / (cam.top - cam.bottom), a);
      assert.ok(renderer.setSizeCalls.length > 0);
    }
  });

  it("updates tilt-shift blur strength from the viewport size", () => {
    const { r, hT, vT } = make(1600, 900);
    r.resize();
    closeTo(hT.uniforms.h.value, 1.6 / 1600);
    closeTo(vT.uniforms.v.value, 1.6 / 900);
  });

  it("resizes again when the window is resized", () => {
    const { renderer, r } = make(1600, 900);
    r.resize();
    const before = renderer.setSizeCalls.length;
    dom.window.dispatchEvent(new dom.window.Event("resize"));
    assert.ok(renderer.setSizeCalls.length > before);
  });

  it("zoom divides the view extents and resizes", () => {
    const { r } = make(1600, 900);
    r.resize();
    const base = r.camera.top;
    r.setZoom(2);
    closeTo(r.camera.top, base / 2);
    closeTo(r.camera.right, (base * (1600 / 900)) / 2);
  });
});

describe("room frame and camera follow", () => {
  const room = { minX: 0, maxX: 10, minZ: 0, maxZ: 8 }; // centre (5, 4), half sizes 5 x 4

  it("snaps to the room centre on the first frame of a room", () => {
    const { r } = make();
    r.setRoomFrame(room);
    r.render(0.016);
    assert.deepEqual(r.target.toArray(), [5, 0, 4]);
  });

  it("clamps the focus offset so the camera stays inside the room", () => {
    const { r } = make();
    r.setRoomFrame(room);
    r.render(0.016, { x: 100, z: 100 });
    // Offset limits: half width 5 - 3.5 = 1.5, half depth 4 - 3 = 1.
    closeTo(r.target.x, 6.5);
    closeTo(r.target.z, 5);
  });

  it("moves the camera by a fraction of the focus offset when the focus is near the centre", () => {
    const { r } = make();
    r.setRoomFrame(room);
    r.render(0.016, { x: 6, z: 4.5 });
    closeTo(r.target.x, 5 + 0.55);
    closeTo(r.target.z, 4 + 0.275);
  });

  it("keeps a tiny room centred whatever the focus", () => {
    const { r } = make();
    r.setRoomFrame({ minX: 0, maxX: 4, minZ: 0, maxZ: 4 }); // half sizes 2 x 2, less than the 3.5 / 3 margin
    r.render(0.016, { x: 100, z: -100 });
    assert.deepEqual(r.target.toArray(), [2, 0, 2]);
  });

  it("eases toward the goal after the snap, and reaches it after a few seconds", () => {
    const { r } = make();
    r.setRoomFrame(room);
    r.render(0.016); // consumes the snap
    r.render(0.1, { x: 100, z: 100 });
    const a = 1 - Math.exp(-0.1 * 4);
    closeTo(r.target.x, 5 + 1.5 * a);
    assert.ok(r.target.x > 5 && r.target.x < 6.5);
    for (let i = 0; i < 300; i++) r.render(1 / 60, { x: 100, z: 100 });
    closeTo(r.target.x, 6.5, 1e-4);
    closeTo(r.target.z, 5, 1e-4);
  });

  it("snaps again when a new room frame is set", () => {
    const { r } = make();
    r.setRoomFrame(room);
    r.render(0.016);
    r.render(0.05, { x: 100, z: 100 });
    r.setRoomFrame({ minX: 20, maxX: 30, minZ: -10, maxZ: -2 });
    r.render(0.016);
    assert.deepEqual(r.target.toArray(), [25, 0, -6]);
  });

  it("lookAt moves the target directly", () => {
    const { r } = make();
    r.lookAt(3, -2);
    assert.deepEqual(r.target.toArray(), [3, 0, -2]);
  });

  it("zooms the view out for larger rooms, capped at 6, and never below 5.2", () => {
    const { r } = make(1600, 900);
    r.setRoomFrame({ minX: 0, maxX: 4, minZ: 0, maxZ: 4 }); // size max(4, 4 * 1.25) = 5 -> 3.95, floor 5.2
    closeTo(r.camera.top, 5.2);
    r.setRoomFrame({ minX: 0, maxX: 12, minZ: 0, maxZ: 8 }); // size 12 -> 5.7
    closeTo(r.camera.top, 5.7);
    r.setRoomFrame({ minX: 0, maxX: 8, minZ: 0, maxZ: 9 }); // depth 9 * 1.25 = 11.25 -> 5.5125
    closeTo(r.camera.top, 5.5125);
    r.setRoomFrame({ minX: 0, maxX: 40, minZ: 0, maxZ: 8 }); // size 40 -> capped at 6
    closeTo(r.camera.top, 6);
  });
});

describe("shake", () => {
  it("offsets the camera while shaking and returns to the rig when it has decayed", (t) => {
    t.mock.method(Math, "random", () => 1); // every random component is +0.5 after the mapping
    const { r } = make();
    r.render(0.016); // no shake
    const rigOffset = () => r.camera.position.clone().sub(r.target);
    closeTo(rigOffset().length(), 40);

    r.shake(1);
    r.render(0.001);
    const off = rigOffset().sub(CAM_DIR.clone().multiplyScalar(40));
    assert.ok(off.x > 0.9, `x offset ${off.x}`);
    closeTo(off.y, off.x / 2, 1e-9); // Math.random gives x and z = 1, y = 0.5

    // A decayed shake drops back to the plain rig.
    r.render(10);
    closeTo(rigOffset().length(), 40, 1e-6);
  });

  it("keeps the largest of several shakes and decays it over time", (t) => {
    t.mock.method(Math, "random", () => 1);
    const { r } = make();
    r.render(0.016);
    r.shake(1);
    r.shake(0.1); // smaller shake does not reduce the current one
    r.render(0.001);
    const off = r.camera.position.clone().sub(r.target).sub(CAM_DIR.clone().multiplyScalar(40));
    closeTo(off.x, Math.exp(-0.012), 1e-6);
  });

  it("ignores a shake that is below the visible threshold", (t) => {
    t.mock.method(Math, "random", () => 1);
    const { r } = make();
    r.render(0.016);
    r.shake(0.001);
    r.render(0.001);
    closeTo(r.camera.position.clone().sub(r.target).length(), 40, 1e-9);
  });
});

describe("addLampsFrom", () => {
  function torches(n) {
    const g = new THREE.Group();
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
      m.name = "flame";
      m.position.set(i, 2, 3);
      g.add(m);
    }
    const other = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
    other.name = "torch";
    g.add(other);
    return g;
  }

  it("adds one point light per flame up to four, placed just above each flame", () => {
    const { r } = make();
    r.addLampsFrom(torches(6));
    const ls = lights(r.scene, THREE.PointLight);
    assert.equal(ls.length, 4);
    assert.deepEqual(ls[0].position.toArray(), [0, 2.3, 3]);
    assert.deepEqual(ls[3].position.toArray(), [3, 2.3, 3]);
    assert.ok(ls.every((l) => l.visible));
  });

  it("shows only as many lamps as the current preset allows", () => {
    const { r } = make();
    r.addLampsFrom(torches(4));
    const visible = () => lights(r.scene, THREE.PointLight).filter((l) => l.visible).length;
    assert.equal(visible(), 4); // high
    r.setPreset("medium");
    assert.equal(visible(), 2);
    r.setPreset("low");
    assert.equal(visible(), 0);
  });

  it("replaces the previous lamps rather than adding to them", () => {
    const { r } = make();
    r.addLampsFrom(torches(4));
    r.setPreset("low");
    r.addLampsFrom(torches(4));
    const ls = lights(r.scene, THREE.PointLight);
    assert.equal(ls.length, 4);
    assert.equal(ls.filter((l) => l.visible).length, 0);
    r.setPreset("high");
    assert.equal(ls.filter((l) => l.visible).length, 4);
  });

  it("adds no lamps for a group without flames", () => {
    const { r } = make();
    r.addLampsFrom(new THREE.Group());
    assert.equal(lights(r.scene, THREE.PointLight).length, 0);
  });

  it("copes with a lamp that was already removed from the scene", () => {
    const { r } = make();
    r.addLampsFrom(torches(2));
    const first = lights(r.scene, THREE.PointLight)[0];
    r.scene.remove(first);
    r.addLampsFrom(torches(2));
    assert.equal(lights(r.scene, THREE.PointLight).length, 2);
  });
});

describe("setBlurAllowed and render", () => {
  it("renders through the composer with blur and bloom on, and sets the tilt-shift band to the focus row", () => {
    const { r, renderer, composer, hT, vT } = make();
    const focus = { x: 2, z: 1 };
    r.render(0.016, focus);
    assert.equal(composer.renders, 1);
    assert.equal(renderer.renders.length, 0);
    assert.equal(hT.enabled, true);
    assert.equal(vT.enabled, true);
    const v = new THREE.Vector3(focus.x, 0.5, focus.z).project(r.camera);
    const expected = Math.min(0.85, Math.max(0.15, v.y * 0.5 + 0.5));
    closeTo(hT.uniforms.r.value, expected);
    closeTo(vT.uniforms.r.value, expected);
  });

  it("keeps the blur band centred when there is no focus", () => {
    const { r, hT, vT } = make();
    r.render(0.016);
    assert.equal(hT.uniforms.r.value, 0.5);
    assert.equal(vT.uniforms.r.value, 0.5);
  });

  it("keeps the blur band inside the readable range for a far-off focus", () => {
    const { r, hT } = make();
    r.render(0.016, { x: 500, z: -500 });
    assert.ok(hT.uniforms.r.value >= 0.15 && hT.uniforms.r.value <= 0.85);
  });

  it("disables blur but still uses the composer for bloom when blur is not allowed", () => {
    const { r, renderer, composer, hT, vT } = make();
    r.setBlurAllowed(false);
    r.render(0.016, { x: 1, z: 1 });
    assert.equal(composer.renders, 1);
    assert.equal(renderer.renders.length, 0);
    assert.equal(hT.enabled, false);
    assert.equal(vT.enabled, false);
    assert.equal(hT.uniforms.r.value, 0.5);
  });

  it("medium uses the composer for bloom but no blur", () => {
    const { r, composer, hT } = make();
    r.setPreset("medium");
    r.render(0.016, { x: 1, z: 1 });
    assert.equal(composer.renders, 1);
    assert.equal(hT.enabled, false);
    assert.equal(hT.uniforms.r.value, 0.5);
  });

  it("low renders straight to the renderer with no post-processing", () => {
    const { r, renderer, composer, hT } = make();
    r.setPreset("low");
    r.render(0.016, { x: 1, z: 1 });
    assert.equal(renderer.renders.length, 1);
    assert.equal(composer.renders, 0);
    assert.equal(renderer.renders[0][0], r.scene);
    assert.equal(renderer.renders[0][1], r.camera);
    assert.equal(hT.enabled, false);
  });

  it("uses the renderer when blur is allowed but the preset has no bloom or blur", () => {
    const { r, renderer, composer } = make();
    r.setPreset("low");
    r.setBlurAllowed(true);
    r.render(0.016);
    assert.equal(renderer.renders.length, 1);
    assert.equal(composer.renders, 0);
  });
});
