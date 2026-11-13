// Shared rig for two-legged characters: jointed limbs built from tapered parts, and one pose function that
// animates any of them from (time, pose). A character faces +z; its right hand is at -x.
//
// pose = { move: 0..1 (how fast it is walking), act: "idle" | "windup" | "attack" | "recover" | ..., k: 0..1 through the act }
// The pose is a pure function of its inputs: the same time and pose always give the same joint angles.

export const REST_POSE = { move: 0, act: "idle", k: 0 };

// One material for every body part, to spread and override: { ...fill(bone), foot: iron }.
export const fill = (m) => ({ hips: m, torso: m, thigh: m, shin: m, foot: m, shoulder: m, arm: m, fore: m, hand: m });

// Builds the skeleton and its plain body parts. S: { leg, torso, arm, shoulders, hips, limb, depth, shadow, mats }.
// Returns { group, rig, mesh(parent, geo, mat, name, x, y, z), seg(len, r0, r1, sides) } so the caller can add a head and gear.
export function biped(THREE, id, S) {
  const g = new THREE.Group(); g.name = id;
  const M = S.mats;
  const mesh = (parent, geo, mat, name, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat); m.name = name; m.position.set(x, y, z); parent.add(m); return m;
  };
  const pivot = (parent, name, x, y, z) => { const p = new THREE.Group(); p.name = name; p.position.set(x, y, z); parent.add(p); return p; };
  const seg = (len, r0, r1, sides = 6) => new THREE.CylinderGeometry(r0, r1, len, sides).translate(0, -len / 2, 0); // hangs from its pivot

  const shadow = mesh(g, new THREE.CircleGeometry(S.shadow, 16), new THREE.MeshStandardMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }), "shadow", 0, 0.01, 0);
  shadow.rotation.x = -Math.PI / 2;

  const hips = pivot(g, "hips", 0, S.leg, 0);
  mesh(hips, new THREE.CylinderGeometry(S.hips + S.limb * 1.5, S.hips + S.limb * 1.1, 0.09, 8).scale(1, 1, S.depth), M.hips, "pelvis", 0, 0.03, 0);
  const chest = pivot(hips, "chest", 0, 0.06, 0);
  mesh(chest, new THREE.CylinderGeometry(S.shoulders * 0.98, S.hips + S.limb * 1.2, S.torso, 8).scale(1, 1, S.depth).translate(0, S.torso / 2, 0), M.torso, "torso");
  const head = pivot(chest, "head", 0, S.torso, 0);
  const rig = { hips, chest, head, baseY: S.leg };
  for (const [s, n] of [[-1, "R"], [1, "L"]]) {
    const leg = pivot(hips, "leg" + n, s * S.hips, 0, 0);
    mesh(leg, seg(S.leg * 0.5, S.limb * 1.3, S.limb), M.thigh, "thigh");
    const shin = pivot(leg, "shin" + n, 0, -S.leg * 0.5, 0);
    mesh(shin, seg(S.leg * 0.5, S.limb, S.limb * 0.8), M.shin, "shin");
    mesh(shin, new THREE.BoxGeometry(S.limb * 2.4, 0.06, S.limb * 4.2), M.foot, "foot", 0, -S.leg * 0.5 + 0.03, S.limb);
    const arm = pivot(chest, "arm" + n, s * S.shoulders, S.torso - 0.035, 0);
    mesh(arm, new THREE.IcosahedronGeometry(S.limb * 1.6, 0), M.shoulder, "shoulder");
    mesh(arm, seg(S.arm * 0.5, S.limb * 1.05, S.limb * 0.9), M.arm, "upperArm");
    const fore = pivot(arm, "fore" + n, 0, -S.arm * 0.5, 0);
    mesh(fore, seg(S.arm * 0.5, S.limb * 0.9, S.limb * 0.75), M.fore, "forearm");
    const hand = pivot(fore, "hand" + n, 0, -S.arm * 0.5, 0);
    mesh(hand, new THREE.IcosahedronGeometry(S.limb * 1.15, 0), M.hand, "fist");
    rig["leg" + n] = leg; rig["shin" + n] = shin; rig["arm" + n] = arm; rig["fore" + n] = fore; rig["hand" + n] = hand;
  }
  g.userData.rig = rig;
  return { group: g, rig, mesh, seg };
}

// A key pose: joint angles in radians. aR/aL: upper arms (x: negative is forward and up; z: out from the body),
// fR/fL: elbows, wR/wL: wrists (positive tips a held weapon forward and down), cX: lean forward, cY: twist, hX: nod, lg: both thighs, sh: both knees, hY: hips height (fraction of leg).
const ZERO = { aRx: 0, aRz: 0.12, aLx: 0, aLz: 0.12, fRx: -0.25, fLx: -0.25, wR: 0, wL: 0, cX: 0, cY: 0, hX: 0, lg: 0, sh: 0, hY: 0 };
const key = (o) => ({ ...ZERO, ...o });

// A style is a stride rate, how much each arm swings with the walk, and key poses per act as [from, to].
function style(stride, swingR, swingL, rest, raised, struck, extra = {}) {
  const A = key(rest), B = key(raised), C = key(struck);
  const keys = { idle: [A, A], windup: [A, B], attack: [B, C], recover: [C, A] };
  for (const [act, to] of Object.entries(extra)) keys[act] = [A, key(to)];
  return { stride, swingR, swingL, keys };
}
const TUCK = { cX: 0.75, hX: 0.3, aRx: 0.5, aLx: 0.5, fRx: -1.6, fLx: -1.6, lg: -0.9, sh: 1.7, hY: -0.22 };

export const STYLES = {
  // one-handed weapon in the right hand: raise it over the shoulder, cut down across the body
  melee: style(9, 0.2, 0.6,
    { aRx: -0.3, fRx: -0.95, wR: -0.5, fLx: -0.5 },
    { aRx: -2.5, aRz: 0.35, fRx: -0.7, wR: -0.5, cY: -0.55, cX: -0.14, hX: -0.1 },
    { aRx: -0.75, aRz: 0.05, fRx: -0.15, wR: 1.1, cY: 0.6, cX: 0.3, hX: 0.1, lg: -0.12 }),
  // the hero: the same cut, plus a shield arm that punches out and a tucked roll
  hero: style(11, 0.2, 0.3,
    { aRx: -0.3, fRx: -0.95, wR: -0.5, aLx: -0.35, fLx: -1.25, aLz: 0.2 },
    { aRx: -2.5, aRz: 0.35, fRx: -0.7, wR: -0.5, aLx: -0.35, fLx: -1.25, cY: -0.55, cX: -0.14 },
    { aRx: -0.75, aRz: 0.05, fRx: -0.15, wR: 1.1, aLx: 0.1, fLx: -1.0, cY: 0.6, cX: 0.3, lg: -0.12 },
    { bash: { aLx: -1.45, fLx: -0.25, aLz: 0.0, aRx: 0.35, cY: -0.6, cX: 0.22, lg: -0.15 }, dodge: TUCK }),
  // bow in the left hand: hold it out, draw the string back to the cheek, let go
  bow: style(10, 0.3, 0.3,
    { aLx: -0.5, fLx: -0.7, aRx: -0.2, fRx: -0.6 },
    { aLx: -1.5, fLx: -0.05, aLz: 0.05, aRx: -1.35, fRx: -1.9, aRz: 0.5, cY: 0.75, hX: -0.05 },
    { aLx: -1.5, fLx: -0.05, aLz: 0.05, aRx: -1.1, fRx: -0.5, aRz: 0.35, cY: 0.6 }),
  // spellcaster: both hands up, then thrown forward
  cast: style(7, 0.35, 0.35,
    { aRx: -0.35, fRx: -1.0, aLx: -0.35, fLx: -1.0 },
    { aRx: -2.7, aLx: -2.7, aRz: 0.45, aLz: 0.45, fRx: -0.35, fLx: -0.35, cX: -0.2, hX: -0.3 },
    { aRx: -1.45, aLx: -1.45, aRz: 0.1, aLz: 0.1, fRx: -0.1, fLx: -0.1, cX: 0.28, hX: 0.1 }),
  // heavy two-handed slam: everything overhead, then into the ground
  slam: style(6, 0.5, 0.5,
    { aRx: -0.15, fRx: -0.5, aLx: -0.15, fLx: -0.5, aRz: 0.3, aLz: 0.3, cX: 0.1 },
    { aRx: -2.9, aLx: -2.9, aRz: 0.2, aLz: 0.2, fRx: -0.3, fLx: -0.3, wR: -0.4, cX: -0.3, hX: -0.25 },
    { aRx: -0.7, aLx: -0.7, aRz: 0.1, aLz: 0.1, fRx: -0.1, fLx: -0.1, wR: 0.7, cX: 0.6, hX: 0.2, lg: -0.35, sh: 0.7, hY: -0.06 }),
};

// Sets every joint of a biped built above from the time, the pose and a style. Does nothing to a group without a rig.
export function poseBiped(group, t, pose, S) {
  const r = group.userData.rig;
  if (!r) return;
  const P = pose || REST_POSE;
  const [from, to] = S.keys[P.act] || S.keys.idle;
  const k = Math.min(1, Math.max(0, P.k));
  const u = P.act === "attack" ? Math.min(1, k * 2.2) : k * k * (3 - 2 * k); // strikes land early and hold; the rest ease
  const v = (f) => from[f] + (to[f] - from[f]) * u;
  const m = P.move, ph = t * S.stride, sw = Math.sin(ph) * 0.75 * m, breath = Math.sin(t * 2.4);
  r.legL.rotation.x = sw + v("lg"); r.legR.rotation.x = -sw + v("lg");
  r.shinL.rotation.x = Math.max(0, Math.cos(ph)) * 0.95 * m + v("sh");
  r.shinR.rotation.x = Math.max(0, -Math.cos(ph)) * 0.95 * m + v("sh");
  r.armL.rotation.x = v("aLx") - sw * S.swingL; r.armR.rotation.x = v("aRx") + sw * S.swingR;
  r.armL.rotation.z = v("aLz"); r.armR.rotation.z = -v("aRz");
  r.foreL.rotation.x = v("fLx"); r.foreR.rotation.x = v("fRx");
  r.handL.rotation.x = v("wL"); r.handR.rotation.x = v("wR");
  r.chest.rotation.x = v("cX") + 0.1 * m + breath * 0.015;
  r.chest.rotation.y = v("cY") + Math.sin(ph) * 0.12 * m;
  r.head.rotation.x = v("hX") - 0.06 * m;
  r.head.rotation.y = -v("cY") * 0.5 + Math.sin(t * 0.7) * 0.1 * (1 - m);
  r.hips.position.y = r.baseY * (1 + v("hY")) + Math.abs(Math.sin(ph)) * 0.035 * m + breath * 0.006;
}

// For creatures that are not bipeds: how far into a windup they are (0..1), how fresh the strike is (1 fading to 0),
// and how fast they are moving. All zero for a missing pose.
export function accents(pose) {
  const P = pose || REST_POSE;
  return { wind: P.act === "windup" ? P.k : 0, hit: P.act === "attack" ? 1 - P.k : 0, move: P.move };
}
