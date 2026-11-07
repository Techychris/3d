// Unit tests for src/game/fx.js: pooled cube particles, pooled floating numbers, emissive flashes.
import { test, describe, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { makeWorld, installDom } from "./helpers.mjs";
import { createFx } from "../../src/game/fx.js";

const near = (a, b, eps = 1e-5) => Math.abs(a - b) < eps;

// Canvas 2D context stand-in: jsdom has no canvas, so getContext would return null.
function fakeCanvasContext() {
  const draws = [];
  const ctx = {
    draws,
    fillStyle: "", strokeStyle: "", font: "", textAlign: "", textBaseline: "", lineWidth: 0, lineJoin: "",
    clearRect() { draws.push(["clearRect"]); },
    strokeText(text) { draws.push(["strokeText", text]); },
    fillText(text) { draws.push(["fillText", text, ctx.fillStyle]); },
  };
  return ctx;
}

let dom;
let ctx;

beforeEach(async () => {
  mock.method(Math, "random", () => 0.5); // deterministic: life 0.5s, size 0.08, angle pi
  dom = await installDom();
  ctx = fakeCanvasContext();
  dom.window.HTMLCanvasElement.prototype.getContext = () => ctx;
});

afterEach(() => {
  dom.cleanup();
  mock.restoreAll();
});

const meshOf = (w) => w.root.children.find(o => o.name === "fx-particles");
const spritesOf = (w) => w.root.children.filter(o => o.isSprite);

// Reads every particle slot back from the raw instance matrices. Scale is the length of the first
// column and position is the translation column; a parked or unused slot has an all-zero column.
// (Matrix4.decompose is not used: it reports unit scale for a zero-scale matrix.)
function particles(w) {
  const mesh = meshOf(w);
  const out = [];
  for (let i = 0; i < mesh.count; i++) {
    const e = mesh.instanceMatrix.array, o = i * 16;
    const scale = Math.hypot(e[o], e[o + 1], e[o + 2]);
    out.push({ alive: scale > 0, x: e[o + 12], y: e[o + 13], z: e[o + 14], scale });
  }
  return out;
}
const aliveParticles = (w) => particles(w).filter(p => p.alive);

// A group with one emissive mesh (lit by flashes) and one shadow mesh (never lit).
function litGroup() {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x123456, emissive: 0x202020, emissiveIntensity: 0.3 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(), mat);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(1), new THREE.MeshStandardMaterial({ emissive: 0x111111 }));
  shadow.name = "shadow";
  group.add(body, shadow);
  return { group, mat, shadowMat: shadow.material };
}

function setup() {
  const w = makeWorld();
  const fx = createFx(w);
  return { w, fx };
}

describe("burst", () => {
  test("spawns the requested cubes at the point, coloured by the given hex", () => {
    const { w, fx } = setup();
    fx.burst(1, 2, 3, 0xff0000, 5, 3);
    fx.update(w, 0);
    const live = aliveParticles(w);
    assert.equal(live.length, 5);
    for (const p of live) {
      assert.ok(near(p.x, 1));
      assert.ok(near(p.y, 2));
      assert.ok(near(p.z, 3));
    }
    const mesh = meshOf(w);
    const c = new THREE.Color();
    for (let i = 0; i < 5; i++) {
      mesh.getColorAt(i, c);
      assert.equal(c.getHex(), 0xff0000);
    }
  });

  test("defaults to 8 white cubes at speed 3", () => {
    const { w, fx } = setup();
    fx.burst(0, 1, 0);
    fx.update(w, 0);
    assert.equal(aliveParticles(w).length, 8);
    const mesh = meshOf(w);
    const c = new THREE.Color();
    mesh.getColorAt(0, c);
    assert.equal(c.getHex(), 0xffffff);
    // speed 3 at random 0.5: horizontal speed 3 * 0.675, launched at angle pi (towards -x)
    fx.burst(0, 1, 0, 0xffffff, 1, 3);
    fx.update(w, 0);
    const before = particles(w)[8];
    fx.update(w, 0.1);
    const after = particles(w)[8];
    assert.ok(near(after.x - before.x, -3 * 0.675 * 0.1), "moves outward at launch speed");
    assert.ok(near(after.z - before.z, 0), "no sideways drift at angle pi");
  });

  test("cubes fall under gravity from their launch height", () => {
    const { w, fx } = setup();
    fx.burst(0, 1, 0, 0xffffff, 1, 3);
    fx.update(w, 0);
    fx.update(w, 0.1);
    // launch vy = 3 * (0.3 + 0.5 * 0.8) = 2.1; after one 0.1s step vy = 2.1 - 0.9 = 1.2 and y = 1 + 0.12
    assert.ok(near(particles(w)[0].y, 1.12));
  });

  test("cubes bounce off the floor at 0.03 with damping and never sink below it", () => {
    const { w, fx } = setup();
    fx.burst(0, 0.2, 0, 0xffffff, 1, 1.5);
    let minY = Infinity, touched = false;
    for (let i = 0; i < 25; i++) {
      fx.update(w, 1 / 60);
      const p = particles(w)[0];
      if (!p.alive) continue;
      minY = Math.min(minY, p.y);
      if (near(p.y, 0.03, 1e-4)) touched = true;
    }
    assert.ok(touched, "the cube lands on the floor");
    assert.ok(minY >= 0.03 - 1e-4, `never below the floor, min ${minY}`);
  });

  test("cubes are recycled through a ring buffer of 200 slots", () => {
    const { w, fx } = setup();
    fx.burst(0, 1, 0, 0xffffff, 200, 3);
    fx.update(w, 0);
    assert.equal(aliveParticles(w).length, 200);
    fx.burst(5, 1, 5, 0xffffff, 3, 3);
    fx.update(w, 0);
    const p = particles(w);
    assert.equal(p.filter(q => q.alive).length, 200, "the pool never grows past 200");
    for (let i = 0; i < 3; i++) assert.ok(near(p[i].x, 5), `slot ${i} was reused`);
    for (let i = 3; i < 200; i++) assert.ok(near(p[i].x, 0), `slot ${i} is untouched`);
  });

  test("the default count and speed also apply when only the position is given", () => {
    const { w, fx } = setup();
    fx.burst(4, 0.5, -2);
    fx.update(w, 0);
    const live = aliveParticles(w);
    assert.equal(live.length, 8);
    assert.ok(near(live[0].z, -2));
  });
});

describe("update (particles)", () => {
  test("cubes shrink as their life drains and are retired when it runs out", () => {
    const { w, fx } = setup();
    fx.burst(0, 1, 0, 0xffffff, 4, 3);
    fx.update(w, 0.1);
    const early = aliveParticles(w)[0].scale;
    fx.update(w, 0.2);
    const later = aliveParticles(w)[0].scale;
    assert.ok(later < early, `shrinks from ${early} to ${later}`);
    assert.equal(aliveParticles(w).length, 4);

    fx.update(w, 0.4);
    assert.equal(aliveParticles(w).length, 0, "life 0.5s has run out");
    const parked = particles(w)[0];
    assert.equal(parked.scale, 0);
    assert.ok(near(parked.y, -10), "retired cubes are parked out of view");

    fx.update(w, 0.1);
    assert.equal(aliveParticles(w).length, 0, "nothing comes back");
  });

  test("update with nothing alive is a quiet no-op", () => {
    const { w, fx } = setup();
    assert.doesNotThrow(() => fx.update(w, 0.1));
    assert.equal(aliveParticles(w).length, 0);
  });
});

describe("number", () => {
  test("shows text in a pooled sprite at the given point, white by default", () => {
    const { w, fx } = setup();
    fx.number(2, 1.5, -1, "12");
    const s = spritesOf(w)[0];
    assert.equal(s.visible, true);
    assert.deepEqual([s.position.x, s.position.y, s.position.z], [2, 1.5, -1]);
    const fills = ctx.draws.filter(d => d[0] === "fillText");
    assert.deepEqual(fills.at(-1), ["fillText", "12", "#ffffff"]);
  });

  test("uses the given colour and strokes an outline before filling the text", () => {
    const { fx } = setup();
    fx.number(0, 0, 0, "5", 0x00ff00);
    const tail = ctx.draws.slice(-2);
    assert.deepEqual(tail[0], ["strokeText", "5"]);
    assert.deepEqual(tail[1], ["fillText", "5", "#00ff00"]);
  });

  test("short numbers pop to 1.5x and long numbers are a little larger", () => {
    const { w, fx } = setup();
    fx.number(0, 0, 0, "7");
    fx.update(w, 0);
    const short = spritesOf(w)[0];
    assert.ok(near(short.scale.x, 0.9 * 1 * 1.5));
    assert.ok(near(short.scale.y, 0.45 * 1 * 1.5));

    fx.number(0, 0, 0, "1234");
    fx.update(w, 0);
    const long = spritesOf(w)[1];
    assert.ok(near(long.scale.x, 0.9 * 1.15 * 1.5));
  });

  test("numbers rise, stay opaque, fade over the last 40 percent of 0.8 seconds, then hide", () => {
    const { w, fx } = setup();
    fx.number(0, 1, 0, "7");
    const s = spritesOf(w)[0];
    fx.update(w, 0.1);
    assert.equal(s.material.opacity, 1);
    assert.ok(s.position.y > 1, "rises");
    fx.update(w, 0.54);
    assert.ok(near(s.material.opacity, 0.5, 1e-6), "halfway through the fade");
    assert.equal(s.visible, true);
    fx.update(w, 0.2);
    assert.equal(s.visible, false, "hidden once its life ends");
  });

  test("the pool recycles after 24 numbers", () => {
    const { w, fx } = setup();
    for (let i = 0; i < 24; i++) fx.number(i, 0, 0, "1");
    fx.number(99, 0, 0, "2");
    const sprites = spritesOf(w);
    assert.equal(sprites.length, 24);
    assert.equal(sprites[0].position.x, 99, "the 25th number reuses the first sprite");
    assert.equal(sprites[1].position.x, 1);
  });

  test("hidden numbers are skipped during update", () => {
    const { w, fx } = setup();
    fx.update(w, 0.1);
    fx.number(0, 0, 0, "3");
    fx.update(w, 0.1);
    assert.equal(spritesOf(w)[1].visible, false, "a never-used sprite stays hidden");
  });
});

describe("flash", () => {
  test("lights a group's emissive for the duration, then restores the base look", () => {
    const { w, fx } = setup();
    const { group, mat } = litGroup();
    fx.flash(group, 0.1);
    assert.equal(mat.emissive.getHex(), 0xffffff);
    assert.equal(mat.emissiveIntensity, 1.4);
    fx.update(w, 0.05);
    assert.equal(mat.emissive.getHex(), 0xffffff, "still lit half way");
    fx.update(w, 0.06);
    assert.equal(mat.emissive.getHex(), 0x202020, "base emissive restored");
    assert.equal(mat.emissiveIntensity, 0.3, "base intensity restored");
  });

  test("the default duration is 0.08 seconds", () => {
    const { w, fx } = setup();
    const { group, mat } = litGroup();
    fx.flash(group);
    fx.update(w, 0.07);
    assert.equal(mat.emissiveIntensity, 1.4);
    fx.update(w, 0.02);
    assert.equal(mat.emissiveIntensity, 0.3);
  });

  test("re-flashing a group that is already lit extends its time instead of stacking", () => {
    const { w, fx } = setup();
    const { group, mat } = litGroup();
    fx.flash(group, 0.1);
    fx.update(w, 0.05);
    fx.flash(group, 0.1);
    fx.update(w, 0.07);
    assert.equal(mat.emissiveIntensity, 1.4, "the second flash keeps it lit");
    fx.update(w, 0.04);
    assert.equal(mat.emissiveIntensity, 0.3);
  });

  test("a missing group is ignored", () => {
    const { w, fx } = setup();
    assert.doesNotThrow(() => fx.flash(null, 0.1));
    assert.doesNotThrow(() => fx.update(w, 0.2));
  });

  test("several flashes expire independently, including ones not at the end of the list", () => {
    const { w, fx } = setup();
    const a = litGroup(), b = litGroup(), c = litGroup();
    fx.flash(a.group, 0.05);
    fx.flash(b.group, 0.2);
    fx.flash(c.group, 0.05);
    fx.update(w, 0.1);
    assert.equal(a.mat.emissiveIntensity, 0.3, "first expired");
    assert.equal(b.mat.emissiveIntensity, 1.4, "middle still lit");
    assert.equal(c.mat.emissiveIntensity, 0.3, "last expired");
    fx.update(w, 0.15);
    assert.equal(b.mat.emissiveIntensity, 0.3, "middle expires later");
  });

  test("the shadow mesh is never lit", () => {
    const { fx } = setup();
    const { group, shadowMat } = litGroup();
    fx.flash(group, 0.1);
    assert.equal(shadowMat.emissive.getHex(), 0x111111);
  });
});

describe("clear", () => {
  test("hides numbers, removes cubes, restores flashing groups and stops further work", () => {
    const { w, fx } = setup();
    const { group, mat } = litGroup();
    fx.burst(0, 1, 0, 0xffffff, 5, 3);
    fx.update(w, 0);
    fx.number(0, 1, 0, "9");
    fx.flash(group, 1);
    assert.equal(aliveParticles(w).length, 5);
    assert.equal(spritesOf(w)[0].visible, true);
    assert.equal(mat.emissiveIntensity, 1.4);

    fx.clear();
    assert.equal(aliveParticles(w).length, 0);
    assert.equal(spritesOf(w)[0].visible, false);
    assert.equal(mat.emissive.getHex(), 0x202020);
    assert.equal(mat.emissiveIntensity, 0.3);

    fx.update(w, 0.1);
    assert.equal(aliveParticles(w).length, 0, "nothing returns after clear");
    assert.equal(mat.emissiveIntensity, 0.3);
  });
});

describe("dispose", () => {
  test("clears effects and removes the cube mesh and number sprites from the world", () => {
    const { w, fx } = setup();
    const { group, mat } = litGroup();
    fx.burst(0, 1, 0, 0xffffff, 3, 3);
    fx.number(0, 1, 0, "4");
    fx.flash(group, 1);
    const before = w.root.children.length;
    fx.dispose();
    assert.equal(meshOf(w), undefined, "particle mesh removed");
    assert.equal(spritesOf(w).length, 0, "number sprites removed");
    assert.equal(w.root.children.length, before - 1 - 24);
    assert.equal(mat.emissiveIntensity, 0.3, "active flash restored");
  });
});
