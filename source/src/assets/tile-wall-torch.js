export const meta = {
  id: "tile-wall-torch",
  name: "Wall torch wall segment",
  category: "tile",
  footprint: [1, 1],
  height: 1.5,
  flying: false
};

export function build(THREE) {
  const g = new THREE.Group(); g.name = meta.id;

  const std = (color, extra) => new THREE.MeshStandardMaterial(
    Object.assign({ color, flatShading: true, roughness: 0.8, metalness: 0 }, extra || {})
  );
  const stone = std(0x5a5862);
  const stoneDark = std(0x3b3a40);
  const stoneLight = std(0x8a8794);
  const metalDark = std(0x5b636d, { metalness: 0.3 });
  const wood = std(0x7a5236);
  const ember = std(0xff7a2e, { emissive: 0xff7a2e, emissiveIntensity: 1.0 });
  const gold = std(0xe0b04a, { emissive: 0xe0b04a, emissiveIntensity: 0.8 });

  const add = (parent, geo, mat, name, x, y, z, rx) => {
    const m = new THREE.Mesh(geo, mat);
    m.name = name; m.position.set(x, y, z);
    if (rx) m.rotation.x = rx;
    parent.add(m);
    return m;
  };

  // Everything below y 0.35.
  const base = new THREE.Group(); base.name = "base";
  add(base, new THREE.BoxGeometry(1.02, 0.08, 0.42), stoneDark, "plinth", 0, 0.04, 0);
  add(base, new THREE.BoxGeometry(1.0, 0.35, 0.4), stone, "courseBase", 0, 0.175, 0);

  // Everything from y 0.35 up, including the torch.
  const upper = new THREE.Group(); upper.name = "upper";

  // Four stone brick courses (0.2 tall) from y 0.35 to 1.15, in running bond.
  for (let i = 0; i < 4; i++) {
    const yc = 0.35 + 0.2 * i + 0.1;
    add(upper, new THREE.BoxGeometry(1.0, 0.2, 0.4), stone, "course" + i, 0, yc, 0);
    const offs = (i % 2 === 0) ? [-0.375, -0.125, 0.125, 0.375] : [-0.25, 0, 0.25];
    for (const x of offs) {
      add(upper, new THREE.BoxGeometry(0.025, 0.19, 0.03), stoneDark, "joint" + i, x, yc, 0.2);
    }
  }
  for (const y of [0.55, 0.75, 0.95]) {
    add(upper, new THREE.BoxGeometry(1.0, 0.025, 0.03), stoneDark, "mortar", 0, y, 0.2);
  }
  add(upper, new THREE.BoxGeometry(1.04, 0.06, 0.44), stoneLight, "cap", 0, 1.18, 0);

  // Wall torch bracket on the front (+z) face.
  add(upper, new THREE.BoxGeometry(0.12, 0.16, 0.02), metalDark, "bracketPlate", 0, 0.95, 0.21);
  add(upper, new THREE.BoxGeometry(0.03, 0.03, 0.13), metalDark, "bracketArm", 0, 0.915, 0.285);
  add(upper, new THREE.CylinderGeometry(0.045, 0.035, 0.09, 8), metalDark, "torchCup", 0, 0.96, 0.315);

  // Wooden torch handle, leaning out from the wall.
  add(upper, new THREE.CylinderGeometry(0.022, 0.028, 0.4, 6), wood, "torchHandle", 0, 1.1, 0.36, 0.35);

  // Flame: ember cones, flickered in update().
  const flame = new THREE.Group(); flame.name = "flame";
  flame.position.set(0, 1.288, 0.429);
  upper.add(flame);
  add(flame, new THREE.ConeGeometry(0.055, 0.16, 7), ember, "emberOuter", 0, 0.08, 0);
  add(flame, new THREE.ConeGeometry(0.03, 0.11, 6), gold, "emberCore", 0, 0.06, 0);

  g.add(base, upper);
  g.userData.flame = flame;
  return g;
}

export function update(group, t) {
  const f = group.userData.flame;
  if (!f) return;
  f.scale.set(
    1 + 0.05 * Math.sin(t * 11),
    1 + 0.12 * Math.sin(t * 9) + 0.06 * Math.sin(t * 15.3),
    1 + 0.05 * Math.sin(t * 11 + 2)
  );
}
