export const meta = {
  id: "tile-wall",
  name: "Dungeon wall segment",
  category: "tile",
  footprint: [1, 1],
  height: 1.5,
  flying: false
};

const WALL_DEPTH = 0.4;   // z thickness, centred on the tile
const MORTAR = 0.012;     // gap between blocks
const SPLIT_Y = 0.35;     // base group holds everything below this height
const COURSE_H = 0.23;    // height of each upper course
const COURSES = 5;        // upper courses: 0.35 + 5 * 0.23 = 1.5

// Fixed pattern of block tones so the wall looks varied but identical every build.
const TONE_ORDER = ["stone", "stone", "dark", "stone", "light", "stone", "stone", "dark"];

export function build(THREE) {
  const g = new THREE.Group(); g.name = meta.id;
  const base = new THREE.Group(); base.name = "base";
  const upper = new THREE.Group(); upper.name = "upper";
  g.add(base, upper);

  const mats = {
    stone: new THREE.MeshStandardMaterial({ color: 0x5a5862, flatShading: true, roughness: 0.8, metalness: 0 }),
    dark:  new THREE.MeshStandardMaterial({ color: 0x3b3a40, flatShading: true, roughness: 0.8, metalness: 0 }),
    light: new THREE.MeshStandardMaterial({ color: 0x8a8794, flatShading: true, roughness: 0.8, metalness: 0 })
  };

  // One stone block spanning x0..x1 and y0..y1, centred on zc.
  function block(parent, x0, x1, y0, y1, tone, zc) {
    const geo = new THREE.BoxGeometry(x1 - x0 - MORTAR, y1 - y0 - MORTAR, WALL_DEPTH);
    const m = new THREE.Mesh(geo, mats[tone]);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, zc);
    m.name = "block";
    parent.add(m);
  }

  // Course 0 is the footing (below the split); courses 1..COURSES are upper.
  // Even courses break joints one way, odd courses the other (running bond).
  const totalCourses = COURSES + 1;
  for (let k = 0; k < totalCourses; k++) {
    const isBase = k === 0;
    const y0 = isBase ? 0 : SPLIT_Y + (k - 1) * COURSE_H;
    const y1 = isBase ? SPLIT_Y : y0 + COURSE_H;
    const cuts = (k % 2 === 0)
      ? [-0.5, -0.16, 0.18, 0.5]
      : [-0.5, -0.34, 0.0, 0.34, 0.5];
    const parent = isBase ? base : upper;
    for (let i = 0; i < cuts.length - 1; i++) {
      const tone = TONE_ORDER[(k * 3 + i) % TONE_ORDER.length];
      const zc = (i % 2 === 0) ? -0.01 : 0.01;   // slight offset in depth
      block(parent, cuts[i], cuts[i + 1], y0, y1, tone, zc);
    }
  }

  // Light capstone along the top, slightly wider than the wall.
  const cap = new THREE.Mesh(
    new THREE.BoxGeometry(1.0, 0.04, WALL_DEPTH + 0.04),
    mats.light
  );
  cap.position.set(0, 1.48, 0); cap.name = "cap";
  upper.add(cap);

  return g;
}

export function update(group, t) {}
