export const meta = {
  id: "vfx-portal",
  name: "Exit portal",
  category: "vfx",
  footprint: [1.2, 1.2],
  height: 1.8,
  flying: false
};

const CENTER_Y = 1.15;
const SWIRLS = [
  // [radius, tube, tilt about x, spin speed (rad/s)]
  [0.36, 0.022, 1.0, 1.2],
  [0.26, 0.02, 1.9, -0.8],
  [0.16, 0.018, 2.8, 2.0]
];
const SPARK_ANGLES = [0.3, 1.1, 1.9, 2.7, 3.5, 4.3, 5.1, 5.9];

export function build(THREE) {
  const g = new THREE.Group(); g.name = meta.id;
  const stoneDark = new THREE.MeshStandardMaterial({ color: 0x3b3a40, flatShading: true, roughness: 0.8, metalness: 0 });
  const stone = new THREE.MeshStandardMaterial({ color: 0x5a5862, flatShading: true, roughness: 0.8, metalness: 0 });
  const stoneLight = new THREE.MeshStandardMaterial({ color: 0x8a8794, flatShading: true, roughness: 0.8, metalness: 0 });
  const magic = new THREE.MeshStandardMaterial({ color: 0x8c5be0, emissive: 0x8c5be0, emissiveIntensity: 1.0, flatShading: true, roughness: 0.8, metalness: 0 });
  const surfaceMat = new THREE.MeshStandardMaterial({
    color: 0x8c5be0, emissive: 0x8c5be0, emissiveIntensity: 0.9,
    transparent: true, opacity: 0.55, side: THREE.DoubleSide,
    flatShading: true, roughness: 0.8, metalness: 0
  });

  // Short stone-dark base and two pillars holding the ring.
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.2, 0.6), stoneDark);
  base.position.y = 0.1; base.name = "base"; g.add(base);
  for (const s of [-1, 1]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.9, 0.24), stone);
    pillar.position.set(s * 0.42, 0.65, 0); pillar.name = "pillar"; g.add(pillar);
  }

  // Standing ring frame, facing +z (torus lies in the XY plane).
  const frame = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.08, 8, 28), stoneLight);
  frame.position.y = CENTER_Y; frame.name = "frame"; g.add(frame);

  // Swirling violet surface inside the ring.
  const surface = new THREE.Mesh(new THREE.CircleGeometry(0.46, 28), surfaceMat);
  surface.position.y = CENTER_Y; surface.name = "surface"; g.add(surface);

  // Thinner tilted rings that spin about the portal normal at different speeds.
  for (const [r, tube, tilt, speed] of SWIRLS) {
    const swirl = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 6, 24), magic);
    swirl.position.y = CENTER_Y;
    swirl.rotation.order = "ZXY";
    swirl.rotation.x = tilt;
    swirl.userData.speed = speed;
    swirl.name = "swirl"; g.add(swirl);
  }

  // Small violet sparks around the rim.
  const sparkGeo = new THREE.OctahedronGeometry(0.035, 0);
  for (const a of SPARK_ANGLES) {
    const spark = new THREE.Mesh(sparkGeo, magic);
    spark.position.set(Math.cos(a) * 0.6, CENTER_Y + Math.sin(a) * 0.6, 0.04);
    spark.name = "spark"; g.add(spark);
  }

  return g;
}

export function update(group, t) {
  for (let i = 0; i < group.children.length; i++) {
    const c = group.children[i];
    if (c.name === "swirl") c.rotation.z = t * c.userData.speed;
    else if (c.name === "surface") c.material.emissiveIntensity = 0.75 + 0.25 * Math.sin(t * 2.4);
  }
}
