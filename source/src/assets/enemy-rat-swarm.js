import { accents } from "../engine/rig.js";

export const meta = {
  id: "enemy-rat-swarm",
  name: "Rat swarm",
  category: "enemy",
  footprint: [1, 1],
  height: 0.3,
  flying: false
};

// Base position (x, z), facing (radians about y) and phase for each of the three rats.
const RATS = [
  { x: -0.1, z: -0.08, heading: 0.6, phase: 0.0 },
  { x: 0.11, z: -0.1, heading: -2.2, phase: 2.1 },
  { x: 0.02, z: 0.14, heading: 2.9, phase: 4.2 }
];
const SCURRY_RADIUS = 0.025;

export function build(THREE) {
  const g = new THREE.Group(); g.name = meta.id;
  const mat = (color, extra) => new THREE.MeshStandardMaterial(
    Object.assign({ color, flatShading: true, roughness: 0.8, metalness: 0 }, extra || {}));
  const stone = mat(0x5a5862);
  const stoneDark = mat(0x3b3a40);
  const skin = mat(0xd9a27e);
  const eye = mat(0xff4d3d, { emissive: 0xff4d3d, emissiveIntensity: 0.9 });

  const add = (parent, geo, material, name, x, y, z) => {
    const m = new THREE.Mesh(geo, material);
    m.name = name; m.position.set(x, y, z); parent.add(m);
    return m;
  };

  // Rats are children 0..2 so update() can reach them by index.
  for (let i = 0; i < RATS.length; i++) {
    const r = RATS[i];
    const rat = new THREE.Group(); rat.name = "rat" + i;
    rat.position.set(r.x, 0, r.z); rat.rotation.y = r.heading;   // local +z is the front
    rat.scale.y = 1.6;                                           // stand the rats up to the 0.3 height

    const body = add(rat, new THREE.SphereGeometry(0.09, 8, 6), stone, "body", 0, 0.1, 0);
    body.scale.set(1, 0.85, 1.5);
    add(rat, new THREE.SphereGeometry(0.06, 8, 6), stone, "head", 0, 0.11, 0.19);
    add(rat, new THREE.ConeGeometry(0.03, 0.09, 6), stoneDark, "snout", 0, 0.1, 0.24).rotation.x = Math.PI / 2;

    for (const s of [-1, 1]) {
      const ear = add(rat, new THREE.SphereGeometry(0.028, 6, 4), skin, "ear", s * 0.038, 0.16, 0.18);
      ear.scale.set(1, 1, 0.5);
      add(rat, new THREE.SphereGeometry(0.012, 5, 4), eye, "eye", s * 0.026, 0.13, 0.24);
    }

    add(rat, new THREE.CylinderGeometry(0.025, 0.018, 0.2, 6), skin, "tail", 0, 0.035, -0.22).rotation.x = Math.PI / 2;

    g.add(rat);
  }

  // One shared blob shadow under the whole swarm.
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.45, 16),
    mat(0x000000, { transparent: true, opacity: 0.35, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.01; shadow.name = "shadow";
  g.add(shadow);

  return g;
}

// pose: the pack bunches up before a bite and scatters wide on it; it runs in bigger loops while moving
export function update(group, t, pose) {
  const { wind, hit, move } = accents(pose), spread = 1 + 0.5 * move - 0.6 * wind + 0.8 * hit;
  for (let i = 0; i < RATS.length; i++) {
    const r = RATS[i];
    const rat = group.children[i];
    const a = t * 3.1 + r.phase;
    rat.position.x = r.x * (1 - 0.5 * wind) + Math.cos(a) * SCURRY_RADIUS * spread;
    rat.position.z = r.z * (1 - 0.5 * wind) + Math.sin(a) * SCURRY_RADIUS * spread;
    rat.position.y = Math.abs(Math.sin(t * 11 + r.phase)) * 0.05 * (move + hit);
    rat.rotation.y = r.heading + Math.sin(t * 6 + r.phase) * 0.25;
  }
}
