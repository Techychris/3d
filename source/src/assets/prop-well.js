export const meta = {
  id: "prop-well",
  name: "Camp well",
  category: "prop",
  footprint: [1, 1],
  height: 1.5,
  flying: false
};

export function build(THREE) {
  const g = new THREE.Group(); g.name = meta.id;
  const mat = (color, o) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, metalness: 0, ...o });
  const add = (parent, geo, m, x, y, z, name) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.name = name; parent.add(o); return o; };
  const stone = mat(0x5a5862), pale = mat(0x8a8794), wood = mat(0x4e3423), roof = mat(0xa8423a), water = mat(0x3e5c9a, { emissive: 0x3e5c9a, emissiveIntensity: 0.35 }), iron = mat(0x5b636d, { metalness: 0.3 }), rope = mat(0xe8dcc0);
  // Ring wall of 10 blocks, alternating shade.
  for (let i = 0; i < 10; i++) {
    const a = i * Math.PI / 5;
    const b = add(g, new THREE.BoxGeometry(0.26, 0.42, 0.14), i % 2 ? stone : pale, 0.4 * Math.cos(a), 0.21, 0.4 * Math.sin(a), "block" + i);
    b.rotation.y = Math.PI / 2 - a;
  }
  add(g, new THREE.CylinderGeometry(0.36, 0.36, 0.04, 10), water, 0, 0.26, 0, "water");
  for (const s of [-1, 1]) add(g, new THREE.BoxGeometry(0.07, 1.0, 0.07), wood, s * 0.42, 0.9, 0, "upright");
  add(g, new THREE.CylinderGeometry(0.04, 0.04, 0.92, 6), wood, 0, 1.12, 0, "axle").rotation.z = Math.PI / 2;
  add(g, new THREE.BoxGeometry(0.02, 0.2, 0.02), iron, 0.5, 1.08, 0, "crank");
  for (const s of [-1, 1]) {
    const r = add(g, new THREE.BoxGeometry(1.1, 0.04, 0.42), roof, 0, 1.38, s * 0.17, "roof");
    r.rotation.x = s * 0.6;
  }
  // Bucket hangs from the axle and swings a little.
  const bucket = new THREE.Group(); bucket.name = "bucket"; bucket.position.set(0, 1.1, 0);
  add(bucket, new THREE.CylinderGeometry(0.008, 0.008, 0.42, 4), rope, 0, -0.21, 0, "rope");
  add(bucket, new THREE.CylinderGeometry(0.09, 0.07, 0.14, 7), wood, 0, -0.49, 0, "pail");
  add(bucket, new THREE.CylinderGeometry(0.093, 0.093, 0.02, 7), iron, 0, -0.44, 0, "hoop");
  g.add(bucket);
  g.userData.bucket = bucket;
  return g;
}

export function update(group, t) {
  const bucket = group.userData.bucket;
  if (!bucket) return;
  bucket.rotation.x = 0.08 * Math.sin(t * 1.5);
  bucket.rotation.z = 0.05 * Math.sin(t * 1.1 + 2);
}
