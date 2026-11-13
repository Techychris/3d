// Shared test helpers for the unit suite (node:test). Import what you need.
import * as THREE from "three";
import { createWorld } from "../../src/game/world.js";
import { computeStats } from "../../src/game/items.js";

// Records every call so tests can assert on side effects.
export function spy(impl = () => {}) {
  const f = (...args) => { f.calls.push(args); return impl(...args); };
  f.calls = [];
  return f;
}

// A world like main.js builds, with recording stubs for fx/audio/shake/hitStop.
export function makeWorld({ items = [], withPlayer = false } = {}) {
  const scene = new THREE.Scene();
  const world = createWorld(scene);
  world.stats = computeStats(items, {});
  world.fx = { burst: spy(), number: spy(), flash: spy(), update: spy(), clear: spy(), dispose: spy() };
  world.audio = { play: spy(), setVolume: spy(), unlock: spy(), startMusic: spy() };
  world.shake = spy(); world.hitStop = spy();
  world.camera = new THREE.OrthographicCamera(-6, 6, 4, -4, 0.1, 200);
  if (withPlayer) {
    world.player = { x: 0, z: 0, yaw: 0, hp: 100, maxHp: 100, radius: 0.3, invuln: 0, shield: 0, dead: false, name: "You", slowMul: 1, dodging: false, group: new THREE.Group(), heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); } };
  }
  return world;
}

// Advance a list of updatable things (enemies, projectiles...) by `seconds` in fixed steps.
export function step(world, seconds, dt = 1 / 60, extra = () => {}) {
  for (let t = 0; t < seconds; t += dt) {
    world.dt = dt; world.time += dt;
    for (const list of [world.enemies, world.projectiles, world.telegraphs, world.hazards, world.pickups]) {
      for (const e of list) if (!e.dead && e.update) e.update(world, dt);
      for (let i = list.length - 1; i >= 0; i--) if (list[i].dead) { if (list[i].dispose) list[i].dispose(world); list.splice(i, 1); }
    }
    extra(world, dt);
  }
}

// jsdom-backed DOM for ui/input/audio tests. Returns the JSDOM instance; call cleanup() after.
export async function installDom(html = "<!doctype html><html><body><div id='ui'></div></body></html>") {
  const { JSDOM } = await import("jsdom");
  const dom = new JSDOM(html, { pretendToBeVisual: true, url: "http://localhost/" });
  const g = globalThis, keys = ["window", "document", "navigator", "HTMLElement", "Element", "Node", "Event", "KeyboardEvent", "MouseEvent", "PointerEvent", "CustomEvent", "localStorage", "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame", "innerWidth", "innerHeight", "location"];
  const saved = {};
  for (const k of keys) {
    saved[k] = Object.getOwnPropertyDescriptor(g, k);
    const v = k === "PointerEvent" ? (dom.window.PointerEvent || dom.window.MouseEvent) : dom.window[k];
    Object.defineProperty(g, k, { value: v, configurable: true, writable: true });
  }
  dom.window.HTMLCanvasElement.prototype.getContext = () => null; // jsdom has no canvas
  dom.cleanup = () => { for (const k of keys) { if (saved[k]) Object.defineProperty(g, k, saved[k]); else delete g[k]; } dom.window.close(); };
  return dom;
}
