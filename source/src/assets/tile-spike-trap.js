export const meta = {
  id: "tile-spike-trap",
  name: "Spike trap tile",
  category: "tile",
  footprint: [1, 1],
  height: 0.35,
  flying: false
};

const CYCLE = 2.4;        // seconds per spike cycle
const SPIKE_LOW = 0.02;   // spike base height when retracted (hidden under the slab top)
const SPIKE_HIGH = 0.2;   // spike base height when raised (tips reach 0.35)
const SLAB_TOP = 0.2;

export function build(THREE) {
  const g = new THREE.Group(); g.name = meta.id;

  const stoneDark = new THREE.MeshStandardMaterial({ color: 0x3b3a40, flatShading: true, roughness: 0.8, metalness: 0 });
  const holeMat = new THREE.MeshStandardMaterial({ color: 0x000000, flatShading: true, roughness: 0.8, metalness: 0 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x9aa3ad, flatShading: true, roughness: 0.8, metalness: 0.3 });
  const danger = new THREE.MeshStandardMaterial({
    color: 0xff4d3d, emissive: 0xff4d3d, emissiveIntensity: 0.6, flatShading: true, roughness: 0.8, metalness: 0
  });

  // Floor slab
  const slab = new THREE.Mesh(new THREE.BoxGeometry(1, SLAB_TOP, 1), stoneDark);
  slab.position.y = SLAB_TOP / 2; slab.name = "slab"; g.add(slab);

  const grid = [-0.28, 0, 0.28];

  // 3x3 holes, flat discs just above the slab top
  for (const x of grid) {
    for (const z of grid) {
      const hole = new THREE.Mesh(new THREE.CircleGeometry(0.085, 10), holeMat);
      hole.rotation.x = -Math.PI / 2;
      hole.position.set(x, SLAB_TOP + 0.001, z);
      hole.name = "hole"; g.add(hole);
    }
  }

  // Spikes: child group that rises out of the holes
  const spikes = new THREE.Group();
  spikes.name = "spikes";
  spikes.position.y = SPIKE_LOW;
  const coneGeo = new THREE.ConeGeometry(0.05, 0.15, 8);
  coneGeo.translate(0, 0.075, 0); // base at local y = 0, tip at 0.15
  for (const x of grid) {
    for (const z of grid) {
      const spike = new THREE.Mesh(coneGeo, metal);
      spike.position.set(x, 0, z);
      spike.name = "spike"; spikes.add(spike);
    }
  }
  g.add(spikes);

  // Warning: thin danger-red square outline around the trap area
  const warning = new THREE.Group();
  warning.name = "warning";
  const barT = 0.035, outer = 0.92, barH = 0.012;
  const sideOff = outer / 2 - barT / 2;
  const bars = [
    [barT, outer, sideOff, 0],   // +x side
    [barT, outer, -sideOff, 0],  // -x side
    [outer - 2 * barT, barT, 0, sideOff],  // +z (front) side
    [outer - 2 * barT, barT, 0, -sideOff]  // -z (back) side
  ];
  for (const [w, d, x, z] of bars) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w, barH, d), danger);
    bar.position.set(x, SLAB_TOP + barH / 2 + 0.001, z);
    bar.name = "warnBar"; warning.add(bar);
  }
  g.add(warning);

  // Cache references so update() does not search the graph
  g.userData.spikes = spikes;
  g.userData.warnMat = danger;

  return g;
}

export function update(group, t) {
  const spikes = group.userData.spikes;
  const warnMat = group.userData.warnMat;
  if (!spikes || !warnMat) return;

  const p = (t % CYCLE) / CYCLE; // 0..1 through one cycle

  // Rise 0.5 -> 0.6, hold to 0.8, retract 0.8 -> 0.9
  let up;
  if (p < 0.5) up = 0;
  else if (p < 0.6) up = (p - 0.5) / 0.1;
  else if (p < 0.8) up = 1;
  else if (p < 0.9) up = 1 - (p - 0.8) / 0.1;
  else up = 0;
  spikes.position.y = SPIKE_LOW + (SPIKE_HIGH - SPIKE_LOW) * up;

  // Warning brightens just before the rise (0.3 -> 0.5), stays bright while raised
  let glow;
  if (p < 0.3) glow = 0.6;
  else if (p < 0.5) glow = 0.6 + 0.9 * (p - 0.3) / 0.2;
  else if (p < 0.8) glow = 1.5;
  else glow = 0.6;
  warnMat.emissiveIntensity = glow;
}
