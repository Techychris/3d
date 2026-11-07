export const meta = {
  id: "tile-stairs-down",
  name: "Stairs down",
  category: "tile",
  footprint: [1, 1],
  height: 0.5,
  flying: false
};

const RIM = 0.38;                       // rim top height
const TREADS = [0.28, 0.193, 0.107, 0.02]; // step tops, from back (high) to front (low)

export function build(THREE) {
  const g = new THREE.Group(); g.name = meta.id;
  const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({
    color, flatShading: true, roughness: 0.8, metalness: 0, ...extra
  });
  const rimMat = mat(0x8a8794);      // stone light
  const riserMat = mat(0x3b3a40);    // stone dark: the dark opening
  const treadMat = mat(0x5a5862);    // stone
  const metalDark = mat(0x5b636d, { metalness: 0.3 });

  const add = (geo, m, name, x, y, z) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z); mesh.name = name; g.add(mesh); return mesh;
  };

  // Raised rim around a 0.6 x 0.6 opening; the front edge is a low lip so the stairs show.
  add(new THREE.BoxGeometry(1.0, RIM, 0.2), rimMat, "rimBack", 0, RIM / 2, -0.4);
  add(new THREE.BoxGeometry(0.2, RIM, 0.8), rimMat, "rimLeft", -0.4, RIM / 2, 0.1);
  add(new THREE.BoxGeometry(0.2, RIM, 0.8), rimMat, "rimRight", 0.4, RIM / 2, 0.1);
  add(new THREE.BoxGeometry(0.6, 0.06, 0.2), rimMat, "rimLip", 0, 0.03, 0.4);

  // Four steps descending toward +z. Each has a dark riser under a stone tread.
  for (let i = 0; i < TREADS.length; i++) {
    const top = TREADS[i];
    const zc = -0.225 + 0.15 * i;
    const t = Math.min(0.03, top);
    const riserH = top - t;
    if (riserH > 0.001) {
      add(new THREE.BoxGeometry(0.6, riserH, 0.15), riserMat, `riser${i}`, 0, riserH / 2, zc);
    }
    add(new THREE.BoxGeometry(0.6, t, 0.15), treadMat, `tread${i}`, 0, top - t / 2, zc);
  }

  // Two braziers on the front rim corners, so the exit is easy to spot. Total height stays at 0.5.
  const embers = [];
  const brazier = (x, z, name) => {
    const emberMat = mat(0xff7a2e, { emissive: 0xff7a2e, emissiveIntensity: 1.0 });
    embers.push(emberMat);
    add(new THREE.CylinderGeometry(0.08, 0.05, 0.06, 8), metalDark, `${name}Bowl`, x, RIM + 0.03, z);
    add(new THREE.SphereGeometry(0.045, 6, 4), emberMat, `${name}Ember`, x, RIM + 0.075, z);
  };
  brazier(-0.4, 0.4, "brazierL");
  brazier(0.4, 0.4, "brazierR");
  g.userData.embers = embers;

  return g;
}

export function update(group, t) {
  const embers = group.userData.embers;
  if (!embers) return;
  embers[0].emissiveIntensity = 1.0 + 0.25 * Math.sin(t * 7.0);
  embers[1].emissiveIntensity = 1.0 + 0.25 * Math.sin(t * 5.3 + 1.7);
}
