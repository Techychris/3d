import { describe, it, before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { installDom, spy } from "./helpers.mjs";
import { createBackdrop } from "../../src/engine/backdrop.js";

// Fake 2D context: every drawing call is a no-op, gradients accept colour stops.
function fakeContext() {
  const grad = { addColorStop() {} };
  return {
    fillStyle: "", createRadialGradient: () => grad,
    fillRect() {}, arc() {}, fill() {}, beginPath() {}, clearRect() {},
  };
}

let dom, origCreate, canvasCount;
before(async () => {
  dom = await installDom();
});
after(() => { dom.cleanup(); });
beforeEach(() => {
  canvasCount = 0;
  origCreate = document.createElement.bind(document);
  // Only the canvas call is faked; everything else goes to jsdom.
  document.createElement = (tag, ...rest) => {
    if (tag === "canvas") {
      canvasCount++;
      return { width: 0, height: 0, getContext: () => fakeContext() };
    }
    return origCreate(tag, ...rest);
  };
});
afterEach(() => { document.createElement = origCreate; });

// Real scene and camera, sized like the game's default view (12 x 8 world units).
function setup() {
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-6, 6, 4, -4, 0.1, 200);
  const bd = createBackdrop(scene, camera);
  const root = scene.getObjectByName("backdrop");
  // Children are added in this order: cloud sea, islands, sun glow, motes, bokeh.
  const [cloud, isles, sun, motes, bokeh] = root.children;
  return { scene, camera, bd, root, cloud, isles, sun, motes, bokeh };
}

const closeTo = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} is not close to ${b}`);

describe("createBackdrop structure", () => {
  it("adds one backdrop group with cloud sea, islands, sun, motes and bokeh", () => {
    const { scene, root, cloud, isles, sun, motes, bokeh } = setup();
    assert.equal(scene.children.length, 1);
    assert.equal(root.children.length, 5);
    assert.equal(cloud.isMesh, true);
    assert.equal(isles.isMesh, true);
    assert.equal(sun.isMesh, true);
    assert.equal(motes.isPoints, true);
    assert.equal(bokeh.isPoints, true);
    assert.equal(cloud.renderOrder, -100);
    assert.equal(isles.renderOrder, -90);
  });

  it("draws the particle sprite on a canvas it creates", () => {
    setup();
    assert.equal(canvasCount, 1);
  });
});

describe("setQuality", () => {
  it("sets the island, particle and bokeh counts for each quality level", () => {
    const ctx = setup();
    const total = ctx.isles.geometry.attributes.position.count;
    ctx.bd.setQuality("low");
    assert.ok(ctx.isles.geometry.drawRange.count < total);
    assert.equal(ctx.motes.geometry.drawRange.count, 40);
    assert.equal(ctx.bokeh.visible, false);
    assert.equal(ctx.bokeh.geometry.drawRange.count, 0);
    assert.equal(ctx.cloud.material.defines.NOCT, 3);
    assert.equal(ctx.cloud.material.defines.LIGHT, 0);
    assert.equal(ctx.sun.material.uniforms.uRays.value, 0);

    ctx.bd.setQuality("medium");
    assert.ok(ctx.isles.geometry.drawRange.count > 0 && ctx.isles.geometry.drawRange.count < total);
    assert.equal(ctx.motes.geometry.drawRange.count, 120);
    assert.equal(ctx.bokeh.visible, true);
    assert.equal(ctx.bokeh.geometry.drawRange.count, 6);
    assert.equal(ctx.cloud.material.defines.NOCT, 4);
    assert.equal(ctx.cloud.material.defines.LIGHT, 1);
    assert.equal(ctx.sun.material.uniforms.uRays.value, 1);

    const version = ctx.cloud.material.version;
    ctx.bd.setQuality("high");
    assert.equal(ctx.isles.geometry.drawRange.count, total);
    assert.equal(ctx.motes.geometry.drawRange.count, 220);
    assert.equal(ctx.bokeh.geometry.drawRange.count, 12);
    assert.equal(ctx.cloud.material.defines.NOCT, 5);
    // Changing the cloud shader's defines flags the material for recompilation (bumps its version).
    assert.ok(ctx.cloud.material.version > version);
  });

  it("island counts grow from low to medium to high", () => {
    const { bd, isles } = setup();
    bd.setQuality("low"); const low = isles.geometry.drawRange.count;
    bd.setQuality("medium"); const med = isles.geometry.drawRange.count;
    bd.setQuality("high"); const high = isles.geometry.drawRange.count;
    assert.ok(low < med && med < high, `${low} < ${med} < ${high}`);
  });

  it("falls back to high for an unknown quality name", () => {
    const { bd, isles, motes, cloud } = setup();
    bd.setQuality("ultra");
    assert.equal(motes.geometry.drawRange.count, 220);
    assert.equal(cloud.material.defines.NOCT, 5);
    assert.equal(isles.geometry.drawRange.count, isles.geometry.attributes.position.count);
  });
});

describe("update", () => {
  it("passes time and the target to the shaders and moves the cloud sea and sun with the target", () => {
    const { bd, cloud, sun, isles, motes } = setup();
    bd.update(1 / 60, 3.5, 2, -1);
    assert.equal(cloud.material.uniforms.uTime.value, 3.5);
    assert.equal(isles.material.uniforms.uTime.value, 3.5);
    assert.equal(motes.material.uniforms.uTime.value, 3.5);
    assert.deepEqual(isles.material.uniforms.uTarget.value.toArray(), [2, 0, -1]);
    assert.equal(cloud.position.x, 2);
    assert.equal(cloud.position.z, -1);
    // The sun sits in front of the target along the view axis, so it is up-left and below the camera line.
    assert.ok(sun.position.x < 2 && sun.position.z < -1);
    assert.ok(sun.position.y < 0);
  });

  it("sizes the sun quad to the view and derives aspect from the camera", () => {
    const { bd, camera, cloud, sun } = setup();
    bd.update(0.016, 0, 0, 0);
    const w = camera.right - camera.left, h = camera.top - camera.bottom;
    closeTo(sun.scale.x, w * 1.02);
    closeTo(sun.scale.y, h * 1.02);
    closeTo(cloud.material.uniforms.uAspect.value, w / h);
  });

  it("sets particle pixel size from the window height and device pixel ratio, and refreshes on change", () => {
    const { bd, camera, motes } = setup();
    const dom2 = dom.window;
    const h = camera.top - camera.bottom; // 8
    dom2.innerHeight = 800; dom2.devicePixelRatio = 1;
    bd.setQuality("high");
    bd.update(0.016, 0, 0, 0);
    closeTo(motes.material.uniforms.uPx.value, (800 * 1) / h);

    // Device pixel ratio above the high cap of 2 is clamped.
    dom2.devicePixelRatio = 3;
    bd.setQuality("high");
    bd.update(0.016, 0, 0, 0);
    closeTo(motes.material.uniforms.uPx.value, (800 * 2) / h);

    // Low quality caps the ratio at 0.75.
    dom2.devicePixelRatio = 2;
    bd.setQuality("low");
    bd.update(0.016, 0, 0, 0);
    closeTo(motes.material.uniforms.uPx.value, (800 * 0.75) / h);

    // A new window height recomputes the size.
    dom2.innerHeight = 400;
    bd.update(0.016, 0, 0, 0);
    closeTo(motes.material.uniforms.uPx.value, (400 * 0.75) / h);

    // Missing device pixel ratio counts as 1.
    dom2.devicePixelRatio = undefined;
    bd.setQuality("high");
    bd.update(0.016, 0, 0, 0);
    closeTo(motes.material.uniforms.uPx.value, (400 * 1) / h);
    dom2.devicePixelRatio = 1;
  });

  it("eases the colours toward a new theme over several frames", () => {
    const { bd, cloud } = setup();
    const sunU = cloud.material.uniforms.uSun.value;
    const start = sunU.getHex();
    bd.setTheme(3);
    bd.update(1 / 60, 0, 0, 0);
    const first = sunU.getHex();
    assert.notEqual(first, start);
    assert.notEqual(first, 0xe090ff);
    for (let i = 0; i < 300; i++) bd.update(1 / 60, 0, 0, 0);
    assert.equal(sunU.getHex(), 0xe090ff);
  });

  it("eases star and glow strength toward the theme targets", () => {
    const { bd, cloud, sun } = setup();
    bd.setTheme(3);
    assert.equal(cloud.material.uniforms.uStar.value, 0);
    for (let i = 0; i < 300; i++) bd.update(1 / 60, 0, 0, 0);
    closeTo(cloud.material.uniforms.uStar.value, 1);
    closeTo(cloud.material.uniforms.uGlowStr.value, 0.8);
    closeTo(sun.material.uniforms.uGlowStr.value, 0.8);
  });
});

describe("setTheme", () => {
  it("snaps every colour immediately when asked to", () => {
    const { bd, cloud } = setup();
    bd.setTheme(3, true);
    assert.equal(cloud.material.uniforms.uSun.value.getHex(), 0xe090ff);
    assert.equal(cloud.material.uniforms.uStar.value, 1);
    assert.equal(cloud.material.uniforms.uGlowStr.value, 0.8);
  });

  it("does not snap when the flag is missing, so the change starts only on update", () => {
    const { bd, cloud } = setup();
    const before = cloud.material.uniforms.uSun.value.getHex();
    bd.setTheme(2);
    assert.equal(cloud.material.uniforms.uSun.value.getHex(), before);
    bd.update(1 / 60, 0, 0, 0);
    assert.notEqual(cloud.material.uniforms.uSun.value.getHex(), before);
  });

  it("accepts the hub theme and snaps it when asked", () => {
    const { bd, cloud, sun } = setup();
    bd.setTheme("hub", true);
    assert.equal(cloud.material.uniforms.uSun.value.getHex(), 0xffe0a0);
    assert.equal(cloud.material.uniforms.uGlowStr.value, 1.15);
    assert.equal(sun.material.uniforms.uGlowStr.value, 1.15);
    assert.equal(cloud.material.uniforms.uStar.value, 0);
  });

  it("ignores an unknown theme and keeps the current colours", () => {
    const { bd, cloud } = setup();
    bd.setTheme(1, true);
    const before = cloud.material.uniforms.uSun.value.getHex();
    bd.setTheme("nope", true);
    assert.equal(cloud.material.uniforms.uSun.value.getHex(), before);
  });

  it("applies the sun colour and star density for themes 1 and 2", () => {
    const { bd, cloud } = setup();
    bd.setTheme(1, true);
    assert.equal(cloud.material.uniforms.uSun.value.getHex(), 0xffcf9a);
    bd.setTheme(2, true);
    assert.equal(cloud.material.uniforms.uSun.value.getHex(), 0xffb870);
    assert.equal(cloud.material.uniforms.uStar.value, 0.18);
  });
});

describe("dispose", () => {
  it("disposes every geometry, material and texture it created and removes its group", (t) => {
    const geoDispose = t.mock.method(THREE.BufferGeometry.prototype, "dispose", () => {});
    const matDispose = t.mock.method(THREE.Material.prototype, "dispose", () => {});
    const texDispose = t.mock.method(THREE.Texture.prototype, "dispose", () => {});
    const { bd, scene } = setup();
    assert.equal(scene.children.length, 1);

    bd.dispose();

    assert.equal(geoDispose.mock.calls.length, 5);  // cloud, islands, sun, motes, bokeh
    assert.equal(matDispose.mock.calls.length, 5);  // cloud, islands, sun, motes, bokeh
    assert.equal(texDispose.mock.calls.length, 1);  // particle sprite
    assert.equal(scene.children.length, 0);
  });

  it("does not dispose anything twice if called again", (t) => {
    const geoDispose = t.mock.method(THREE.BufferGeometry.prototype, "dispose", () => {});
    const { bd } = setup();
    bd.dispose();
    const after = geoDispose.mock.calls.length;
    bd.dispose();
    assert.equal(geoDispose.mock.calls.length, after);
  });
});
