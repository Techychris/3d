// Module A: effects. Pooled cube particles, pooled floating damage numbers, emissive hit flashes.
// Everything is allocated once in createFx; update() allocates nothing.
import * as THREE from "three";
import { setEmissiveFlash } from "../engine/assets.js";

const MAX_PARTICLES = 200;
const MAX_NUMBERS = 24;
const GRAVITY = 9;

export function createFx(world) {
  // ---- Particles (one InstancedMesh, ring-buffer slots, so never more than 200 alive) ----
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const mesh = new THREE.InstancedMesh(geo, mat, MAX_PARTICLES);
  mesh.name = "fx-particles";
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const dummy = new THREE.Object3D();
  const tmpColor = new THREE.Color();
  const px = new Float32Array(MAX_PARTICLES), py = new Float32Array(MAX_PARTICLES), pz = new Float32Array(MAX_PARTICLES);
  const vx = new Float32Array(MAX_PARTICLES), vy = new Float32Array(MAX_PARTICLES), vz = new Float32Array(MAX_PARTICLES);
  const life = new Float32Array(MAX_PARTICLES), maxLife = new Float32Array(MAX_PARTICLES), size = new Float32Array(MAX_PARTICLES);
  const spin = new Float32Array(MAX_PARTICLES), rot = new Float32Array(MAX_PARTICLES);
  dummy.scale.set(0, 0, 0); dummy.updateMatrix();
  for (let i = 0; i < MAX_PARTICLES; i++) { mesh.setMatrixAt(i, dummy.matrix); mesh.setColorAt(i, tmpColor.setHex(0xffffff)); }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.instanceColor.needsUpdate = true;
  world.add(mesh);
  let cursor = 0, aliveHint = 0;

  // ---- Floating numbers ----
  const numbers = [];
  for (let i = 0; i < MAX_NUMBERS; i++) {
    const canvas = document.createElement("canvas");
    canvas.width = 128; canvas.height = 64;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false });
    const sprite = new THREE.Sprite(m);
    sprite.visible = false; sprite.renderOrder = 50; sprite.frustumCulled = false;
    world.add(sprite);
    numbers.push({ sprite, canvas, ctx: canvas.getContext("2d"), tex, mat: m, t: 0, life: 0, vy: 0, base: 1 });
  }
  let numCursor = 0;

  // ---- Flashes ----
  const flashes = [];
  const hex = (c) => "#" + c.toString(16).padStart(6, "0");

  const fx = {
    burst(x, y, z, colorHex = 0xffffff, count = 8, speed = 3) {
      for (let n = 0; n < count; n++) {
        const i = cursor; cursor = (cursor + 1) % MAX_PARTICLES;
        const a = Math.random() * Math.PI * 2, s = speed * (0.35 + Math.random() * 0.65);
        px[i] = x; py[i] = y; pz[i] = z;
        vx[i] = Math.cos(a) * s; vz[i] = Math.sin(a) * s; vy[i] = speed * (0.3 + Math.random() * 0.8);
        maxLife[i] = life[i] = 0.35 + Math.random() * 0.3;
        size[i] = 0.05 + Math.random() * 0.06;
        spin[i] = (Math.random() - 0.5) * 12; rot[i] = Math.random() * 6;
        // slight brightness variation per cube
        tmpColor.setHex(colorHex).multiplyScalar(0.8 + Math.random() * 0.4);
        mesh.setColorAt(i, tmpColor);
      }
      mesh.instanceColor.needsUpdate = true;
      aliveHint = MAX_PARTICLES;
    },

    number(x, y, z, text, colorHex = 0xffffff) {
      const n = numbers[numCursor]; numCursor = (numCursor + 1) % MAX_NUMBERS;
      const ctx = n.ctx;
      ctx.clearRect(0, 0, 128, 64);
      ctx.font = "bold 40px system-ui, sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.lineWidth = 7; ctx.lineJoin = "round"; ctx.strokeStyle = "rgba(26,16,48,0.95)";
      ctx.strokeText(text, 64, 34);
      ctx.fillStyle = hex(colorHex);
      ctx.fillText(text, 64, 34);
      n.tex.needsUpdate = true;
      n.sprite.position.set(x, y, z);
      n.t = 0; n.life = 0.8; n.vy = 1.8; n.base = text.length > 3 ? 1.15 : 1;
      n.mat.opacity = 1; n.sprite.visible = true;
      n.sprite.scale.set(0.9 * n.base * 1.5, 0.45 * n.base * 1.5, 1);
    },

    flash(group, seconds = 0.08) {
      if (!group) return;
      for (const f of flashes) if (f.group === group) { f.t = seconds; setEmissiveFlash(group, 1.4, 0xffffff); return; }
      flashes.push({ group, t: seconds });
      setEmissiveFlash(group, 1.4, 0xffffff);
    },

    update(w, dt) {
      // particles
      if (aliveHint > 0) {
        let any = false;
        for (let i = 0; i < MAX_PARTICLES; i++) {
          if (life[i] <= 0) continue;
          life[i] -= dt; any = true;
          if (life[i] <= 0) {
            dummy.scale.set(0, 0, 0); dummy.position.set(0, -10, 0); dummy.updateMatrix();
            mesh.setMatrixAt(i, dummy.matrix); continue;
          }
          vy[i] -= GRAVITY * dt;
          px[i] += vx[i] * dt; py[i] += vy[i] * dt; pz[i] += vz[i] * dt;
          if (py[i] < 0.03) { py[i] = 0.03; vy[i] *= -0.3; vx[i] *= 0.6; vz[i] *= 0.6; }
          rot[i] += spin[i] * dt;
          const k = Math.min(1, life[i] / maxLife[i] * 2) * size[i];
          dummy.position.set(px[i], py[i], pz[i]);
          dummy.rotation.set(rot[i], rot[i] * 0.7, 0);
          dummy.scale.set(k, k, k);
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
        if (!any) aliveHint = 0;
      }
      // numbers
      for (let i = 0; i < MAX_NUMBERS; i++) {
        const n = numbers[i];
        if (!n.sprite.visible) continue;
        n.t += dt;
        if (n.t >= n.life) { n.sprite.visible = false; continue; }
        n.vy *= Math.max(0, 1 - 3 * dt);
        n.sprite.position.y += n.vy * dt;
        const u = n.t / n.life;
        n.mat.opacity = u < 0.6 ? 1 : 1 - (u - 0.6) / 0.4;
        const pop = 1 + Math.max(0, 0.5 - u * 5); // quick pop-in from 1.5x
        n.sprite.scale.set(0.9 * n.base * pop, 0.45 * n.base * pop, 1);
      }
      // flashes
      for (let i = flashes.length - 1; i >= 0; i--) {
        const f = flashes[i];
        f.t -= dt;
        if (f.t <= 0) { setEmissiveFlash(f.group, 0); flashes[i] = flashes[flashes.length - 1]; flashes.pop(); }
      }
    },

    clear() {
      life.fill(0);
      dummy.scale.set(0, 0, 0); dummy.updateMatrix();
      for (let i = 0; i < MAX_PARTICLES; i++) mesh.setMatrixAt(i, dummy.matrix);
      mesh.instanceMatrix.needsUpdate = true;
      aliveHint = 0;
      for (const n of numbers) n.sprite.visible = false;
      for (const f of flashes) setEmissiveFlash(f.group, 0);
      flashes.length = 0;
    },

    dispose() {
      fx.clear();
      world.remove(mesh); geo.dispose(); mat.dispose(); mesh.dispose();
      for (const n of numbers) { world.remove(n.sprite); n.tex.dispose(); n.mat.dispose(); }
    },
  };
  return fx;
}
