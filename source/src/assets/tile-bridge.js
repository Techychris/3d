export const meta = {
  id: "tile-bridge",
  name: "Rope bridge section",
  category: "tile",
  footprint: [1, 1],
  height: 0.3,
  flying: false
};

export function build(THREE) {
  const g = new THREE.Group(); g.name = meta.id;
  const wood = new THREE.MeshStandardMaterial({ color: 0x7a5236, flatShading: true, roughness: 0.8, metalness: 0 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x4e3423, flatShading: true, roughness: 0.8, metalness: 0 });

  // Planks run across the full width (x), stacked along z with small gaps.
  const plankZ = [-0.375, -0.125, 0.125, 0.375];
  for (let i = 0; i < plankZ.length; i++) {
    if (i === 2) continue; // this plank is replaced by a broken pair below
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.04, 0.21), wood);
    p.position.set(0, 0.1, plankZ[i]); p.name = "plank"; g.add(p);
  }
  // One plank is broken: a left piece, and a right piece that has dropped and tilted.
  const brokenL = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.04, 0.21), wood);
  brokenL.position.set(-0.18, 0.1, 0.125); brokenL.name = "plank"; g.add(brokenL);
  const brokenR = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.04, 0.21), wood);
  brokenR.position.set(0.28, 0.092, 0.125); brokenR.rotation.z = -0.05;
  brokenR.name = "plank"; g.add(brokenR);

  // Dark side beams running along z under the planks.
  for (const s of [-1, 1]) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.98), dark);
    beam.position.set(s * 0.45, 0.07, 0); beam.name = "beam"; g.add(beam);
  }

  // Short corner posts.
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.06), dark);
      post.position.set(sx * 0.45, 0.2, sz * 0.45); post.name = "post"; g.add(post);
    }
  }

  // Thick rope rails along z between the posts (diameter 0.05).
  for (const s of [-1, 1]) {
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.9, 6), dark);
    rope.rotation.x = Math.PI / 2;
    rope.position.set(s * 0.45, 0.25, 0); rope.name = "rope"; g.add(rope);
  }

  return g;
}

export function update(group, t) {}
