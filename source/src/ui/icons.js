// Dusk Isles icon set: 24px grid, 2px round strokes, drawn in currentColor so each icon takes its
// colour's meaning from where it sits (danger, heal, amber...). Shared with the Dusk Isles UI design system.
export const ICONS = {
  pause: { label: "Pause", body: "<rect x=\"6.5\" y=\"5\" width=\"3.5\" height=\"14\" rx=\"1.2\"/><rect x=\"14\" y=\"5\" width=\"3.5\" height=\"14\" rx=\"1.2\"/>" },
  play: { label: "Start / resume", body: "<path d=\"M8 5.6v12.8a1 1 0 0 0 1.5.86l10.3-6.4a1 1 0 0 0 0-1.72L9.5 4.74A1 1 0 0 0 8 5.6z\"/>" },
  settings: { label: "Settings", body: "<path d=\"M18.03 9.32 L18.75 10.57 L21.09 10.56 L21.09 13.44 L18.75 13.43 L18.03 14.68 L18.16 14.37 L17.79 15.76 L19.44 17.41 L17.41 19.44 L15.76 17.79 L14.37 18.16 L14.68 18.03 L13.43 18.75 L13.44 21.09 L10.56 21.09 L10.57 18.75 L9.32 18.03 L9.63 18.16 L8.24 17.79 L6.59 19.44 L4.56 17.41 L6.21 15.76 L5.84 14.37 L5.97 14.68 L5.25 13.43 L2.91 13.44 L2.91 10.56 L5.25 10.57 L5.97 9.32 L5.84 9.63 L6.21 8.24 L4.56 6.59 L6.59 4.56 L8.24 6.21 L9.63 5.84 L9.32 5.97 L10.57 5.25 L10.56 2.91 L13.44 2.91 L13.43 5.25 L14.68 5.97 L14.37 5.84 L15.76 6.21 L17.41 4.56 L19.44 6.59 L17.79 8.24 L18.16 9.63Z\"/><circle cx=\"12\" cy=\"12\" r=\"2.8\"/>" },
  codex: { label: "Codex", body: "<path d=\"M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5z\"/><path d=\"M12 6.5v13\"/>" },
  close: { label: "Close", body: "<path d=\"M6.5 6.5l11 11M17.5 6.5l-11 11\"/>" },
  back: { label: "Back", body: "<path d=\"M14.5 5.5L8 12l6.5 6.5\"/>" },
  reroll: { label: "Reroll", body: "<path d=\"M19 10.5A7.5 7.5 0 0 0 5.6 7.6\"/><path d=\"M5 3.8v4.1h4.1\"/><path d=\"M5 13.5a7.5 7.5 0 0 0 13.4 2.9\"/><path d=\"M19 20.2v-4.1h-4.1\"/>" },
  skip: { label: "Skip", body: "<path d=\"M5.5 6.2v11.6L14.5 12z\"/><path d=\"M18.5 6v12\"/>" },
  daily: { label: "Daily seed", body: "<path d=\"M3 17.5h18\"/><path d=\"M7 17.5a5 5 0 0 1 10 0\"/><path d=\"M12 6.5v3M6.3 9.3l2 2M17.7 9.3l-2 2M3.5 13.5h2M18.5 13.5h2\"/><path d=\"M8 20.5h8\"/>" },
  music: { label: "Music", body: "<path d=\"M9 17.5V6.2l10-2v11.3\"/><circle cx=\"6.5\" cy=\"17.5\" r=\"2.5\"/><circle cx=\"16.5\" cy=\"15.5\" r=\"2.5\"/>" },
  sound: { label: "Sound effects", body: "<path d=\"M4 9.5h3.4L12 5.6v12.8l-4.6-3.9H4z\"/><path d=\"M15.5 9.2a4 4 0 0 1 0 5.6\"/><path d=\"M18 6.6a7.6 7.6 0 0 1 0 10.8\"/>" },
  rotate: { label: "Rotate device", body: "<rect x=\"3.5\" y=\"8\" width=\"9\" height=\"13\" rx=\"2\"/><path d=\"M7 18h2\"/><path d=\"M14.5 3.5a6 6 0 0 1 6 6\"/><path d=\"M22 8l-1.5 2-2-1.4\"/>" },
  saved: { label: "Saved", body: "<circle cx=\"12\" cy=\"12\" r=\"8.5\"/><path d=\"M8.3 12.4l2.5 2.5 4.9-5.2\"/>" },
  health: { label: "Health", body: "<path d=\"M12 20C12 20 4.5 15.4 4.5 10A4.25 4.25 0 0 1 12 7.3A4.25 4.25 0 0 1 19.5 10C19.5 15.4 12 20 12 20Z\"/>" },
  vigor: { label: "Vigor (max health)", body: "<path d=\"M12 20C12 20 4.5 15.4 4.5 10A4.25 4.25 0 0 1 12 7.3A4.25 4.25 0 0 1 19.5 10C19.5 15.4 12 20 12 20Z\"/><path d=\"M12 10.5v5M9.5 13h5\"/>" },
  shield: { label: "Shield", body: "<path d=\"M12 3.2l7 2.6v5.9c0 4.4-2.9 7.6-7 9.1-4.1-1.5-7-4.7-7-9.1V5.8z\"/>" },
  ember: { label: "Embers (currency)", body: "<path d=\"M12 3l5.8 9L12 21l-5.8-9z\"/><path d=\"M12 8.6L14.2 12 12 15.4 9.8 12z\"/>" },
  foes: { label: "Foes", body: "<path d=\"M8 19.5v-2.6C5.6 15.6 4.5 13.4 4.5 11a7.5 7.5 0 0 1 15 0c0 2.4-1.1 4.6-3.5 5.9v2.6z\"/><circle cx=\"9.3\" cy=\"11.3\" r=\"1.6\"/><circle cx=\"14.7\" cy=\"11.3\" r=\"1.6\"/><path d=\"M11 19.5v-2M13 19.5v-2\"/>" },
  endings: { label: "Endings", body: "<path d=\"M12 3.6 L14.29 9.44 L20.56 9.82 L15.71 13.81 L17.29 19.88 L12 16.5 L6.71 19.88 L8.29 13.81 L3.44 9.82 L9.71 9.44Z\"/>" },
  attack: { label: "Attack", body: "<path d=\"M19.5 4.5V8l-9 9-3.5-3.5 9-9z\"/><path d=\"M5.5 12.5l6 6\"/><path d=\"M8.2 15.8L4.5 19.5\"/>" },
  dodge: { label: "Dodge", body: "<path d=\"M12.5 6l6 6-6 6\"/><path d=\"M4 8h5M3 12h8M4 16h5\"/>" },
  bash: { label: "Bash", body: "<path d=\"M12 2.8 L13.76 7.75 L18.51 5.49 L16.25 10.24 L21.2 12 L16.25 13.76 L18.51 18.51 L13.76 16.25 L12 21.2 L10.24 16.25 L5.49 18.51 L7.75 13.76 L2.8 12 L7.75 10.24 L5.49 5.49 L10.24 7.75Z\"/>" },
  battle: { label: "Battle room", body: "<path d=\"M3.5 3.5L12.83 12.83M10.71 14.96L14.96 10.71M12.83 12.83L15.1 15.1\"/><circle cx=\"16.09\" cy=\"16.09\" r=\"0.9\"/><path d=\"M20.5 3.5L11.17 12.83M9.04 10.71L13.29 14.96M11.17 12.83L8.9 15.1\"/><circle cx=\"7.91\" cy=\"16.09\" r=\"0.9\"/>" },
  elite: { label: "Elite room", body: "<path d=\"M8 19.5v-2.6C5.6 15.6 4.5 13.4 4.5 11a7.5 7.5 0 0 1 15 0c0 2.4-1.1 4.6-3.5 5.9v2.6z\"/><circle cx=\"9.3\" cy=\"11.3\" r=\"1.6\"/><circle cx=\"14.7\" cy=\"11.3\" r=\"1.6\"/><path d=\"M11 19.5v-2M13 19.5v-2\"/><path d=\"M6.4 6.6C3.6 6.2 2.2 4.4 2.4 1.9\"/><path d=\"M17.6 6.6c2.8-.4 4.2-2.2 4-4.7\"/>" },
  treasure: { label: "Treasure room", body: "<rect x=\"3.5\" y=\"10\" width=\"17\" height=\"9.5\" rx=\"1.5\"/><path d=\"M3.5 10V8.5A3.5 3.5 0 0 1 7 5h10a3.5 3.5 0 0 1 3.5 3.5V10\"/><path d=\"M3.5 13h17\"/><rect x=\"10.5\" y=\"11.5\" width=\"3\" height=\"4\" rx=\"1\"/>" },
  rest: { label: "Rest room", body: "<path d=\"M4 20.5l16-4M4 16.5l16 4\"/><path d=\"M12 15c-2.3 0-3.8-1.6-3.8-3.6 0-2.4 2.2-3.6 2.6-6.4 1.4 1 2 2.2 2.1 3.4.6-.5 1-1.2 1.1-2 1.2 1.2 1.8 2.8 1.8 4.3 0 2.4-1.5 4.3-3.8 4.3z\"/>" },
  boss: { label: "Boss", body: "<path d=\"M4.5 17.5L3.5 8l4.8 3.6L12 5.5l3.7 6.1L20.5 8l-1 9.5z\"/><path d=\"M5 20.5h14\"/>" },
  stairs: { label: "Stairs down", body: "<path d=\"M3.5 7h5v5h5v5h7\"/><path d=\"M18 3.5v7.5\"/><path d=\"M15 8.2l3 3 3-3\"/>" },
  fire: { label: "Fire", body: "<path d=\"M12 21a6 6 0 0 0 6-6c0-4.1-2.9-6.2-4.1-10.4-1.6 1.9-2.1 3.5-2.1 5.5-1.1-.9-2-2-2.5-3.5C7.6 9.1 6 11.6 6 15a6 6 0 0 0 6 6z\"/><path d=\"M12 21a2.5 2.5 0 0 1-2.5-2.5c0-1.6 1.2-2.5 2.5-4.1 1.3 1.6 2.5 2.5 2.5 4.1A2.5 2.5 0 0 1 12 21z\"/>" },
  frost: { label: "Frost", body: "<path d=\"M12 3L12 21 M19.79 7.5L4.21 16.5 M19.79 16.5L4.21 7.5 M10.33 4.01L12 6 M13.67 4.01L12 6 M18.09 6.56L17.2 9 M19.76 9.45L17.2 9 M19.76 14.55L17.2 15 M18.09 17.44L17.2 15 M13.67 19.99L12 18 M10.33 19.99L12 18 M5.91 17.44L6.8 15 M4.24 14.55L6.8 15 M4.24 9.45L6.8 9 M5.91 6.56L6.8 9\"/>" },
  bleed: { label: "Bleed", body: "<path d=\"M12 3.5c3 4 6 7 6 10.5a6 6 0 0 1-12 0c0-3.5 3-6.5 6-10.5z\"/><path d=\"M9.3 14.5A2.7 2.7 0 0 0 12 17.2\"/>" },
  crit: { label: "Crit", body: "<circle cx=\"12\" cy=\"12\" r=\"6.8\"/><circle cx=\"12\" cy=\"12\" r=\"2\"/><path d=\"M12 2.5v4.2M12 17.3v4.2M2.5 12h4.2M17.3 12h4.2\"/>" },
  speed: { label: "Speed", body: "<path d=\"M13.5 2.8L5 13.6h6.2L10.3 21.2 19 10.2h-6.2z\"/>" },
  summon: { label: "Summon", body: "<path d=\"M6 20.2V11a6 6 0 0 1 12 0v9.2l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4z\"/><circle cx=\"9.8\" cy=\"11.2\" r=\"1.1\"/><circle cx=\"14.2\" cy=\"11.2\" r=\"1.1\"/>" },
};

// SVG markup for an icon. Unknown names give an empty string, so a typo never breaks a screen.
export function iconSvg(name, title) {
  const ic = ICONS[name];
  if (!ic) return "";
  const t = title ? `<title>${title}</title>` : "";
  const a = title ? `role="img" aria-label="${title}"` : `aria-hidden="true"`;
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" focusable="false" ${a}>${t}${ic.body}</svg>`;
}

// A <span class="ico"> holding the icon, for DOM builders (doc defaults to the global document).
export function iconEl(name, doc = document) {
  const s = doc.createElement("span");
  s.className = "ico ico-" + name;
  s.setAttribute("aria-hidden", "true");
  s.innerHTML = iconSvg(name);
  return s;
}
