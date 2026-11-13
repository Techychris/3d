import { createInput } from "../src/engine/input.js";
import { createAudio, SOUND_NAMES } from "../src/engine/audio.js";
const root = document.getElementById("game");
const input = createInput(root);
const audio = createAudio();
window.__input = input; window.__audio = audio;
window.__log = { dodgeFrames: 0, skillFrames: 0, maxAttack: false, frames: 0 };
for (const n of SOUND_NAMES) {
  const b = document.createElement("button"); b.textContent = n; b.dataset.sound = n;
  b.onclick = () => audio.play(n); document.getElementById("btns").appendChild(b);
}
for (const m of ["hub", "combat", "off"]) {
  const b = document.createElement("button"); b.textContent = "music " + m; b.onclick = () => audio.startMusic(m);
  document.getElementById("btns").appendChild(b);
}
const pre = document.getElementById("log");
function frame() {
  input.update();
  const s = input.state, L = window.__log;
  L.frames++; if (s.dodge) L.dodgeFrames++; if (s.skill) L.skillFrames++; if (s.attack) L.maxAttack = true;
  pre.textContent = JSON.stringify(s) + " pause=" + input.pausePressed() + " any=" + input.anyKey();
  requestAnimationFrame(frame);
}
frame();
