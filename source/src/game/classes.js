// Character classes. Pure data: the model, stat changes on top of BASE_STATS, how the basic attack works and which skill it has.
// attack: "melee" (a cone in front) or "shot" (a projectile: { kind, speed, range, radius }).
export const CLASSES = {
  warrior: {
    id: "warrior", name: "Warrior", hero: "hero-warrior", icon: "shield",
    blurb: "Sword and shield. Sturdy. Bash stuns foes in front and knocks shots away.",
    mods: {}, attack: "melee", skill: "bash", skillName: "Bash",
  },
  rogue: {
    id: "rogue", name: "Rogue", hero: "hero-rogue", icon: "crit",
    blurb: "Twin daggers. Fast and fragile, with frequent crits. Flurry cuts everything around you.",
    mods: { maxHp: -20, moveSpeed: 0.5, attackRate: 0.9, damage: -2, critChance: 0.12, dodgeCooldown: -0.2 }, attack: "melee", skill: "flurry", skillName: "Flurry",
  },
  ranger: {
    id: "ranger", name: "Ranger", hero: "hero-ranger", icon: "speed",
    blurb: "Bow. Fights from range. Volley looses five arrows in a fan.",
    mods: { maxHp: -15, damage: -1, attackRate: -0.2, moveSpeed: 0.2 }, attack: "shot", shot: { kind: "arrow", speed: 13, range: 8, radius: 0.16 }, skill: "volley", skillName: "Volley",
  },
  mage: {
    id: "mage", name: "Mage", hero: "hero-mage", icon: "frost",
    blurb: "Staff. Slow, heavy bolts. Nova freezes everything close to you.",
    mods: { maxHp: -25, damage: 5, attackRate: -1.0 }, attack: "shot", shot: { kind: "orb", speed: 9, range: 7, radius: 0.22 }, skill: "nova", skillName: "Nova",
  },
};
export const CLASS_IDS = Object.keys(CLASSES);
export const classOf = (id) => CLASSES[id] || CLASSES.warrior;
