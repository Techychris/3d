export const meta = {
  id: "prop-mushroom-patch",
  name: "Glowcap mushroom patch",
  category: "prop",
  footprint: [0.7, 0.7],
  height: 0.55,
  flying: false
};

export function build(THREE) {
  const g = new THREE.Group(); g.name = meta.id;
  const mat = (color, o) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, metalness: 0, ...o });
  const add = (parent, geo, m, x, y, z, name) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.name = name; parent.add(o); return o; };
  const stem = mat(0xe8dcc0), cap = mat(0x5fd38a, { emissive: 0x5fd38a, emissiveIntensity: 0.8 }), moss = mat(0x4f7a3f);
  add(g, new THREE.CylinderGeometry(0.3, 0.34, 0.05, 9), moss, 0, 0.025, 0, "moss");
  const spots = [[0, 0, 0.42, 0.17], [0.2, 0.08, 0.26, 0.11], [-0.17, 0.13, 0.3, 0.12], [-0.06, -0.2, 0.2, 0.09], [0.16, -0.16, 0.16, 0.07]];
  const caps = [];
  spots.forEach(([x, z, h, r], i) => {
    add(g, new THREE.CylinderGeometry(r * 0.28, r * 0.36, h, 6), stem, x, h / 2 + 0.04, z, "stem" + i);
    // Cap pivots at the stem top so it can breathe (scale) without leaving the stem.
    const c = new THREE.Group(); c.name = "cap" + i; c.position.set(x, h + 0.03, z);
    add(c, new THREE.ConeGeometry(r, r * 0.9, 7), cap, 0, r * 0.45, 0, "dome");
    g.add(c); caps.push(c);
  });
  g.userData.caps = caps;
  return g;
}

export function update(group, t) {
  const caps = group.userData.caps;
  if (!caps) return;
  for (let i = 0; i < caps.length; i++) {
    const s = 1 + 0.06 * Math.sin(t * 2.2 + i * 1.3);
    caps[i].scale.set(s, 2 - s, s);
  }
}
