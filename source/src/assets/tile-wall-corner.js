export const meta = {
  id: "tile-wall-corner",
  name: "Dungeon wall corner",
  category: "tile",
  footprint: [1, 1],
  height: 1.5,
  flying: false
};

// Arms run from the centre to the -x and -z edges, 0.4 deep.
// The post sits at the origin, 0.44 wide, and rises slightly above the arms.
const SPLIT = 0.35;     // y where "base" ends and "upper" begins
const WALL_H = 1.5;
const POST_H = 1.55;
const DEPTH = 0.4;      // arm thickness
const POST_W = 0.44;    // post width, a little wider than the arms so their faces stay hidden inside it

export function build(THREE) {
  const g = new THREE.Group(); g.name = meta.id;
  const base = new THREE.Group(); base.name = "base";
  const upper = new THREE.Group(); upper.name = "upper";
  g.add(base, upper);

  const stone = new THREE.MeshStandardMaterial({ color: 0x5a5862, flatShading: true, roughness: 0.8, metalness: 0 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x3b3a40, flatShading: true, roughness: 0.8, metalness: 0 });
  const light = new THREE.MeshStandardMaterial({ color: 0x8a8794, flatShading: true, roughness: 0.8, metalness: 0 });

  const add = (parent, geo, mat, name, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.name = name; m.position.set(x, y, z);
    parent.add(m);
    return m;
  };

  // Arm lengths run from the centre (0) out to the -0.5 edge.
  const ARM = 0.5;
  const baseH = SPLIT;
  const upperH = WALL_H - SPLIT;

  // Base section (y 0 to 0.35): two arms and the lower post.
  add(base, new THREE.BoxGeometry(ARM, baseH, DEPTH), stone, "armXBase", -ARM / 2, baseH / 2, 0);
  add(base, new THREE.BoxGeometry(DEPTH, baseH, ARM), stone, "armZBase", 0, baseH / 2, -ARM / 2);
  add(base, new THREE.BoxGeometry(POST_W, baseH, POST_W), light, "postBase", 0, baseH / 2, 0);

  // Upper section (y 0.35 up): two arms, the upper post, and brick courses on the arm faces.
  add(upper, new THREE.BoxGeometry(ARM, upperH, DEPTH), stone, "armXUpper", -ARM / 2, SPLIT + upperH / 2, 0);
  add(upper, new THREE.BoxGeometry(DEPTH, upperH, ARM), stone, "armZUpper", 0, SPLIT + upperH / 2, -ARM / 2);
  const postUpperH = POST_H - SPLIT;
  add(upper, new THREE.BoxGeometry(POST_W, postUpperH, POST_W), light, "postUpper", 0, SPLIT + postUpperH / 2, 0);

  // Course bands every 0.2, stopping at the post so they do not overlap it.
  const COURSE_T = 0.03;
  const COURSE_LEN = 0.28;
  const COURSE_CENTRE = -0.36;   // centre of a 0.28 band from -0.5 to -0.22
  const courseOff = 0.02;        // protrudes slightly past the arm face
  const courseDepth = DEPTH + 2 * courseOff;
  for (const y of [0.55, 0.75, 0.95, 1.15, 1.35]) {
    add(upper, new THREE.BoxGeometry(COURSE_LEN, COURSE_T, courseDepth), dark, "courseX", COURSE_CENTRE, y, 0);
    add(upper, new THREE.BoxGeometry(courseDepth, COURSE_T, COURSE_LEN), dark, "courseZ", 0, y, COURSE_CENTRE);
  }

  return g;
}

export function update(group, t) {}
