// src/ui/style.js
var style_default = '/* Dusk Isles UI \u2014 generated from tokens.json */\n:root, [data-theme="dusk"] {\n  --ground: #2a2140;\n  --scrim: rgba(14,8,28,.55);\n  --scrim-solid: rgba(14,8,28,.94);\n  --panel: rgba(42,33,64,.88);\n  --panel-2: rgba(58,46,88,.9);\n  --plate: rgba(20,12,38,.78);\n  --well: rgba(0,0,0,.25);\n  --track: rgba(0,0,0,.55);\n  --field: #1b1230;\n  --control: rgba(70,56,104,.9);\n  --control-hover: rgba(92,74,132,.95);\n  --line: rgba(190,170,240,.35);\n  --text: #e6dcff;\n  --muted: #b7a9d9;\n  --title: #ffe6b0;\n  --amber: #f0b860;\n  --amber-hover: #ffc874;\n  --amber-edge: #ffd994;\n  --on-amber: #2a1a05;\n  --ember: #ffb060;\n  --danger: #ff3d5a;\n  --danger-soft: #ff8da0;\n  --hp-top: #ff5d75;\n  --hp-bottom: #e02a48;\n  --boss-bottom: #c02040;\n  --heal: #6fe0c0;\n  --on-heal: #06261d;\n  --magic: #a070ff;\n  --gold: #f0b860;\n  --focus-ring: #ffffff;\n  --focus-halo: #7a5cd0;\n  --touch-fill: rgba(92,58,160,.42);\n  --touch-fill-down: rgba(160,112,255,.65);\n  --touch-edge: #c8b6ff;\n  --meter-text: #ffffff;\n  --meter-edge: rgba(255,255,255,.25);\n  --cooling: rgba(240,184,96,.28);\n  --ready-wash: rgba(111,224,192,.22);\n  --key-fill: #2b2338;\n  --key-edge: #6a5f80;\n  --ring-track: rgba(255,255,255,.12);\n  --touch-fill-soft: rgba(92,58,160,.25);\n  --touch-knob: rgba(160,112,255,.5);\n  --shadow-panel: 0 8px 28px rgba(0,0,0,.4);\n  --shadow-card-selected: 0 0 0 3px rgba(240,184,96,.35), 0 8px 24px rgba(0,0,0,.4);\n  --shadow-focus: 0 0 0 5px #7a5cd0;\n  --shadow-hurt: inset 0 0 90px 10px #ff3d5a;\n}\n:root {\n  --space-4: 4px;\n  --space-8: 8px;\n  --space-12: 12px;\n  --space-16: 16px;\n  --space-20: 20px;\n  --space-24: 24px;\n  --space-32: 32px;\n  --radius-xs: 4px;\n  --radius-sm: 6px;\n  --radius-md: 8px;\n  --radius-lg: 10px;\n  --radius-xl: 12px;\n  --radius-pill: 999px;\n  --touch-min: 44px;\n  --button-lg-height: 56px;\n  --touch-attack: 76px;\n  --touch-small: 56px;\n  --meter-hp: 24px;\n  --meter-boss: 16px;\n  --slot-height: 28px;\n  --pip: 9px;\n  --icon: 1em;\n  --icon-touch: 24px;\n  --disabled: 0.55;\n  --font-display: Georgia, "Palatino Linotype", Palatino, serif;\n  --font-ui: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;\n}\n.title-xl { font-family: var(--font-display); font-size: 2.4rem; line-height: 1.15; font-weight: 700; letter-spacing: 0.01em; }\n.title-lg { font-family: var(--font-display); font-size: 1.6rem; line-height: 1.2; font-weight: 700; letter-spacing: 0.01em; }\n.title-md { font-family: var(--font-display); font-size: 1.2rem; line-height: 1.25; font-weight: 700; }\n.boss-name { font-family: var(--font-display); font-size: 0.875rem; line-height: 1.3; font-weight: 400; letter-spacing: 0.04em; }\n.body { font-family: var(--font-ui); font-size: 16px; line-height: 1.4; font-weight: 400; }\n.button-lg { font-family: var(--font-ui); font-size: 1.3rem; line-height: 1.2; font-weight: 600; }\n.label-strong { font-family: var(--font-ui); font-size: 0.875rem; line-height: 1.3; font-weight: 600; }\n.small { font-family: var(--font-ui); font-size: 0.875rem; line-height: 1.35; font-weight: 400; }\n.chip { font-family: var(--font-ui); font-size: 0.875rem; line-height: 1.2; font-weight: 600; }\n.tag { font-family: var(--font-ui); font-size: 0.8125rem; line-height: 1.2; font-weight: 400; }\n.caption { font-family: var(--font-ui); font-size: 0.75rem; line-height: 1.2; font-weight: 600; letter-spacing: 0; }\n.micro { font-family: var(--font-ui); font-size: 0.75rem; line-height: 1.2; font-weight: 400; }\n\n/* Dusk Isles UI components. Values come from tokens.css; this sheet only composes them.\n   Shared file: the game ships this exact sheet, and the Dusk Isles UI design system publishes it as components/bundle.css.\n   In game every rule is scoped under .dusk-ui, the overlay root above the canvas.\n   Spacing on a 4px grid; type 12 / 13 / 14 / 16 / 20 / 26 / 38px; motion uses only the two curves below. */\n.dusk-ui{--ease-out:cubic-bezier(0.22,1,0.36,1);--ease-in-out:cubic-bezier(0.77,0,0.175,1);\n  color:var(--text);font:16px/1.4 var(--font-ui);font-variant-numeric:tabular-nums;-webkit-font-smoothing:antialiased;-webkit-user-select:none;user-select:none}\n.dusk-ui *{box-sizing:border-box}\n.dusk-ui p{margin:0;text-wrap:pretty}\n.dusk-ui h1,.dusk-ui h2,.dusk-ui h3{font-family:var(--font-display);margin:0;font-weight:700;letter-spacing:.01em;text-wrap:balance}\n.dusk-ui h1{font-size:2.4rem;color:var(--title)}\n.dusk-ui h2{font-size:1.6rem;color:var(--title)}\n.dusk-ui h3{font-size:1.25rem}\n.dusk-ui .muted{color:var(--muted)}\n.dusk-ui .accent{color:var(--amber);font-weight:600}\n.dusk-ui .coin{display:inline-flex;align-items:center;gap:var(--space-4);color:var(--amber);font-weight:600}\n.dusk-ui .coin .ico{color:var(--ember)}\n.dusk-ui .warn{color:var(--danger-soft);font-weight:600}\n.dusk-ui .stack{display:flex;flex-direction:column;gap:var(--space-12);align-items:stretch}\n.dusk-ui .row{display:flex;gap:var(--space-12);flex-wrap:wrap;align-items:center;justify-content:center}\n.dusk-ui .center{text-align:center;align-items:center}\n\n/* Icon: inline SVG from the icon set (24px grid, 2px round strokes, currentColor), sized by its text */\n.dusk-ui .ico,.dusk-tbtn .ico{display:inline-flex;width:var(--icon);height:var(--icon);flex:none}\n.dusk-ui .ico svg,.dusk-tbtn .ico svg{width:100%;height:100%;display:block}\n\n/* Button */\n.dusk-ui button{display:inline-flex;align-items:center;justify-content:center;gap:var(--space-8);font:inherit;color:inherit;cursor:pointer;min-height:var(--touch-min);min-width:var(--touch-min);border-radius:var(--radius-xl);border:2px solid var(--line);background:var(--control);padding:var(--space-8) var(--space-16);touch-action:manipulation;\n  transition:background-color .12s var(--ease-out),transform .12s var(--ease-out)}\n.dusk-ui button .ico{width:1.125em;height:1.125em}\n.dusk-ui button:hover{background:var(--control-hover)}\n.dusk-ui button:active{transform:scale(.97)}\n.dusk-ui button:focus-visible,.dusk-ui input:focus-visible,.dusk-ui select:focus-visible,.dusk-ui [tabindex]:focus-visible{outline:3px solid var(--focus-ring);outline-offset:2px;box-shadow:var(--shadow-focus)}\n.dusk-ui button[disabled]{opacity:var(--disabled);cursor:not-allowed;transform:none}\n.dusk-ui .primary{background:var(--amber);color:var(--on-amber);border-color:var(--amber-edge);font-weight:600}\n.dusk-ui .primary:hover{background:var(--amber-hover)}\n.dusk-ui .big{min-height:var(--button-lg-height);font-size:1.25rem;padding:var(--space-12) var(--space-32)}\n.dusk-ui .pausebtn{background:var(--plate)}\n.dusk-ui button.icon-only{padding:var(--space-8)}\n.dusk-ui button.icon-only .ico{width:1.25em;height:1.25em}\n\n/* Screen + Panel + Plate */\n.dusk-ui .screen{display:flex;align-items:center;justify-content:center;padding:var(--space-16);background:var(--scrim)}\n.dusk-ui .panel{background:var(--panel);border:1px solid var(--line);border-radius:var(--radius-xl);padding:var(--space-24);box-shadow:var(--shadow-panel);max-width:100%}\n.dusk-ui .plate{background:var(--plate);border:1px solid var(--line);border-radius:var(--radius-xl);padding:var(--space-8) var(--space-12)}\n\n/* Hub stat */\n.dusk-ui .stats{display:flex;gap:var(--space-8);flex-wrap:wrap;justify-content:center}\n.dusk-ui .stat{display:flex;gap:var(--space-12);justify-content:space-between;padding:var(--space-8) var(--space-12);background:var(--well);border-radius:var(--radius-md)}\n\n/* Meters: health (+shield), boss */\n.dusk-ui .bar{position:relative;height:16px;border-radius:var(--radius-md);background:var(--track);overflow:hidden;border:1px solid var(--meter-edge)}\n.dusk-ui .bar>i{position:absolute;left:0;top:0;bottom:0;display:block}\n.dusk-ui .bar b{position:absolute;inset:0;text-align:center;color:var(--meter-text);text-shadow:0 1px 2px var(--ground);white-space:pre}\n.dusk-ui .bar.hp{height:var(--meter-hp);border-radius:var(--radius-xl)}\n.dusk-ui .bar.hp>i{background:linear-gradient(var(--hp-top),var(--hp-bottom))}\n.dusk-ui .bar.hp>i.sh{top:auto;height:4px;background:var(--heal)}\n.dusk-ui .bar.hp b{font-size:.875rem;line-height:22px;font-weight:600}\n.dusk-ui .bar.hp.low{animation:dusk-low 1s var(--ease-in-out) infinite}\n.dusk-ui .bar.hp.low>i:not(.sh){background:var(--danger)}\n@keyframes dusk-low{50%{box-shadow:0 0 0 2px var(--danger)}}\n.dusk-ui .bossbar{text-align:center;width:420px;max-width:100%}\n.dusk-ui .bossbar .nm{font-family:var(--font-display);font-size:.875rem;margin-bottom:var(--space-4);color:var(--title);letter-spacing:.02em}\n.dusk-ui .bar.boss{height:var(--meter-boss)}\n.dusk-ui .bar.boss>i{background:linear-gradient(var(--hp-top),var(--boss-bottom))}\n.dusk-ui .bar.boss u{position:absolute;top:0;bottom:0;width:2px;background:var(--plate);text-decoration:none}\n\n/* Ability slot (desktop) */\n.dusk-ui .slots{display:flex;gap:var(--space-8)}\n.dusk-ui .slot{flex:1;position:relative;height:var(--slot-height);border-radius:var(--radius-sm);background:var(--track);overflow:hidden;border:1px solid var(--meter-edge);display:flex;align-items:center;gap:var(--space-8);padding:0 var(--space-8);font-size:.875rem;font-weight:600;color:var(--muted)}\n.dusk-ui .slot>i{position:absolute;left:0;top:0;bottom:0;background:var(--cooling)}\n.dusk-ui .slot>*{position:relative}\n.dusk-ui .slot kbd{font:inherit;font-size:.75rem;font-weight:400;padding:1px var(--space-4);border-radius:var(--radius-xs);border:1px solid var(--key-edge);background:var(--key-fill);color:var(--text)}\n.dusk-ui .slot.ready{border-color:var(--heal);color:var(--text)}\n.dusk-ui .slot.ready>i{background:var(--ready-wash)}\n.dusk-ui .slot.ready .ico{color:var(--heal)}\n\n/* Progress plate: floor, route pips, foes, embers, saved */\n.dusk-ui .prog{display:flex;flex-direction:column;align-items:flex-end;gap:var(--space-4);padding:var(--space-4) var(--space-12);font-weight:600;white-space:nowrap}\n.dusk-ui .prog .row1,.dusk-ui .prog .row2{display:flex;gap:var(--space-12);align-items:center}\n.dusk-ui .prog .row2{font-size:.8125rem}\n.dusk-ui .prog .fl{font-size:.875rem}\n.dusk-ui .pips{display:flex;gap:var(--space-4)}\n.dusk-ui .pips i{width:var(--pip);height:var(--pip);border-radius:50%;border:2px solid var(--muted);display:block}\n.dusk-ui .pips i.done{background:var(--muted)}\n.dusk-ui .pips i.now{background:var(--amber);border-color:var(--amber);outline:2px solid var(--amber);outline-offset:1px}\n.dusk-ui .pips i.elite{border-color:var(--danger)}.dusk-ui .pips i.elite.done,.dusk-ui .pips i.elite.now{background:var(--danger)}\n.dusk-ui .pips i.elite.now{outline-color:var(--danger)}\n.dusk-ui .pips i.treasure{border-color:var(--gold)}.dusk-ui .pips i.treasure.done{background:var(--gold)}\n.dusk-ui .pips i.rest{border-color:var(--heal)}.dusk-ui .pips i.rest.done,.dusk-ui .pips i.rest.now{background:var(--heal)}\n.dusk-ui .pips i.rest.now{outline-color:var(--heal)}\n.dusk-ui .pips i.boss{border-radius:0;transform:rotate(45deg);border-color:var(--danger)}\n.dusk-ui .pips i.boss.now{background:var(--danger);outline-color:var(--danger)}\n.dusk-ui .foes{color:var(--muted)}\n.dusk-ui .foes.clear{color:var(--heal)}\n.dusk-ui .saved{color:var(--heal);font-size:.75rem}\n\n/* Build tag chip */\n.dusk-ui .tagchips{display:flex;gap:var(--space-8);flex-wrap:wrap}\n.dusk-ui .tagchip{display:flex;align-items:center;gap:var(--space-8);background:var(--plate);border:1px solid var(--line);border-radius:var(--radius-md);padding:var(--space-4) var(--space-8);font-size:.875rem;font-weight:600;color:var(--muted)}\n.dusk-ui .tagchip .dots{display:flex;gap:var(--space-4)}\n.dusk-ui .tagchip .dots i{width:6px;height:6px;border-radius:50%;border:1px solid currentColor;display:block}\n.dusk-ui .tagchip .dots i.f{background:currentColor}\n.dusk-ui .tagchip.on{color:var(--title);border-color:var(--amber)}\n.dusk-ui .tagchip.max{color:var(--on-amber);background:var(--amber);border-color:var(--amber-edge)}\n\n/* Shrine card */\n.dusk-ui .cards{display:grid;grid-template-columns:repeat(3,1fr);gap:var(--space-16)}\n.dusk-ui .card{position:relative;display:flex;flex-direction:column;gap:var(--space-12);text-align:left;padding:var(--space-16);background:var(--panel-2);border:2px solid var(--line);border-radius:var(--radius-xl)}\n.dusk-ui .card.sel{border-color:var(--amber);box-shadow:var(--shadow-card-selected)}\n.dusk-ui .card .key{position:absolute;top:var(--space-8);right:var(--space-12);font-size:.8125rem;color:var(--muted)}\n.dusk-ui .card h3{padding-right:var(--space-24)}\n.dusk-ui .card .tags{display:flex;gap:var(--space-8);flex-wrap:wrap}\n.dusk-ui .card .tag{display:inline-flex;align-items:center;gap:var(--space-4);border:1px solid var(--line);border-radius:var(--radius-pill);padding:2px var(--space-8);font-size:.8125rem;background:var(--well)}\n.dusk-ui .card .tag.owned{border:2px solid var(--amber);color:var(--title);font-weight:600;border-radius:var(--radius-sm)}\n.dusk-ui .card .effect{color:var(--title);font-weight:600}\n.dusk-ui .card .flavor{color:var(--muted);font-style:italic}\n.dusk-ui .card .pairs{font-size:.875rem;color:var(--title)}\n.dusk-ui .card .bonus{font-size:.875rem;color:var(--heal)}\n.dusk-ui .card .combo{align-self:flex-start;background:var(--heal);color:var(--on-heal);font-weight:600;font-size:.75rem;padding:2px var(--space-8);border-radius:var(--radius-sm)}\n.dusk-ui .card .grow{flex:1}\n.dusk-ui .card .take{width:100%}\n\n/* Recap tip */\n.dusk-ui .tipbox{background:var(--well);border-left:4px solid var(--amber);padding:var(--space-12);border-radius:var(--radius-sm)}\n.dusk-ui .lost{color:var(--danger-soft)}\n\n/* Settings field */\n.dusk-ui .field{display:flex;align-items:center;justify-content:space-between;gap:var(--space-12);min-height:var(--touch-min);padding:0 var(--space-8);margin:0 calc(-1 * var(--space-8));border-radius:var(--radius-md);transition:background-color .12s var(--ease-out)}\n.dusk-ui label.field:hover{background:var(--well)}\n.dusk-ui .field select:hover{border-color:var(--amber)}\n.dusk-ui .field>span:first-child{display:inline-flex;align-items:center;gap:var(--space-8)}\n.dusk-ui .field input[type=range]{flex:1;max-width:220px;min-height:var(--touch-min);accent-color:var(--amber)}\n.dusk-ui .field input[type=checkbox]{width:28px;height:28px;margin:0;accent-color:var(--amber)}\n.dusk-ui .field select{min-height:var(--touch-min);background:var(--field);color:var(--text);border:2px solid var(--line);border-radius:var(--radius-md);padding:var(--space-8) var(--space-12);font:inherit}\n\n/* Codex entry */\n.dusk-ui .codex-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:var(--space-12)}\n.dusk-ui .entry{background:var(--well);border:1px solid var(--line);border-radius:var(--radius-lg);padding:var(--space-12)}\n.dusk-ui .entry.unseen{border-style:dashed;color:var(--muted)}\n.dusk-ui .entry .tags{display:flex;gap:var(--space-4);flex-wrap:wrap;margin:var(--space-4) 0}\n.dusk-ui .entry .tag{display:inline-flex;align-items:center;gap:var(--space-4);font-size:.75rem;border:1px solid var(--line);border-radius:var(--radius-pill);padding:1px var(--space-8)}\n\n/* Toast, loading, rotate prompt */\n.dusk-ui .toast{display:inline-block;max-width:90vw;background:var(--scrim-solid);border:1px solid var(--amber);border-radius:var(--radius-xl);padding:var(--space-12) var(--space-20);text-align:center}\n.dusk-ui .loading,.dusk-ui .rotate{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:var(--space-16);background:var(--scrim-solid);text-align:center}\n.dusk-ui .loading{font-family:var(--font-display);font-size:1.25rem}\n.dusk-ui .spin{width:36px;height:36px;border-radius:50%;border:4px solid var(--line);border-top-color:var(--amber);animation:dusk-spin 1s linear infinite}\n@keyframes dusk-spin{to{transform:rotate(360deg)}}\n.dusk-ui .phone{width:44px;height:72px;border:4px solid var(--amber);border-radius:var(--radius-lg);animation:dusk-rot 2.2s var(--ease-in-out) 2 forwards}\n@keyframes dusk-rot{0%,20%{transform:rotate(0)}60%,100%{transform:rotate(-90deg)}}\n\n/* Hurt vignette */\n.dusk-ui .hurt{position:absolute;inset:0;pointer-events:none;box-shadow:var(--shadow-hurt)}\n\n/* Touch controls: looks only; the input module positions them (absolute, bottom right), outside .dusk-ui */\n.dusk-tbtn{border-radius:50%;box-sizing:border-box;border:2px solid var(--touch-edge);background:var(--touch-fill);color:var(--text);align-items:center;justify-content:center;flex-direction:column;gap:2px;font:600 12px var(--font-ui);text-shadow:0 1px 2px var(--ground);user-select:none}\n.dusk-tbtn.down{background:var(--touch-fill-down);transform:scale(.94)}\n.dusk-tbtn.attack{width:var(--touch-attack);height:var(--touch-attack)}\n.dusk-tbtn.dodge,.dusk-tbtn.skill{width:var(--touch-small);height:var(--touch-small)}\n.dusk-tbtn .ico{width:var(--icon-touch);height:var(--icon-touch)}\n.dusk-tbtn.attack .ico{width:30px;height:30px}\n.dusk-tbtn .lbl{font-size:10px;line-height:1}\n.dusk-tbtn.dodge::before,.dusk-tbtn.skill::before{content:"";position:absolute;inset:-5px;border-radius:50%;pointer-events:none;background:conic-gradient(var(--heal) calc(var(--p,1) * 360deg),var(--ring-track) 0);-webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 4px),#000 calc(100% - 3px));mask:radial-gradient(farthest-side,transparent calc(100% - 4px),#000 calc(100% - 3px))}\n.dusk-tbtn.cooling{opacity:.6}\n.dusk-tbtn.cooling::before{background:conic-gradient(var(--amber) calc(var(--p,0) * 360deg),var(--ring-track) 0)}\n.dusk-stick{width:120px;height:120px;border-radius:50%;border:2px solid var(--touch-edge);background:var(--touch-fill-soft)}\n.dusk-knob{width:52px;height:52px;border-radius:50%;background:var(--touch-knob);border:2px solid var(--touch-edge)}\n\n/* Narrow screens: shrine cards stack */\n@media (max-width:760px){.dusk-ui .cards{grid-template-columns:1fr}}\n/* Short landscape phones (height 480px or less): compact type and controls */\n@media (max-height:480px){\n .dusk-ui{font-size:14px}\n .dusk-ui h1{font-size:1.8rem}.dusk-ui h2{font-size:1.25rem}\n .dusk-ui .panel{padding:var(--space-12) var(--space-16)}\n .dusk-ui .big{min-height:48px;font-size:1.125rem}\n .dusk-ui .cards{grid-template-columns:repeat(3,1fr);gap:var(--space-8)}\n .dusk-ui .card{padding:var(--space-12);gap:var(--space-8);min-height:0}\n .dusk-ui .card .key{display:none}\n .dusk-ui .card h3{font-size:1rem;padding-right:0}\n .dusk-ui .card p,.dusk-ui .card .pairs,.dusk-ui .card .bonus{font-size:.8125rem}\n .dusk-ui .card .tag{font-size:.75rem;padding:1px var(--space-8)}\n .dusk-ui .bar.hp{height:20px}.dusk-ui .bar.hp b{line-height:18px;font-size:.8125rem}\n .dusk-ui .tagchip{padding:2px var(--space-8);font-size:.75rem}\n}\n@media (prefers-reduced-motion:reduce){.dusk-ui *{animation:none!important;transition:none!important}.dusk-ui .bar.hp.low{box-shadow:0 0 0 2px var(--danger)}}\n\n/* Game layout: where the shared components sit over the canvas, and their runtime states.\n   Looks come from design-system/tokens.css + components.css (shared with the design system). */\n.dusk-ui{position:absolute;inset:0;pointer-events:none;z-index:10;overflow:hidden}\n.dusk-ui button{pointer-events:auto}\n\n/* overlay screens */\n.dusk-ui .screen{position:absolute;inset:0;align-items:safe center;pointer-events:auto;overflow:auto}\n.dusk-ui .screen[hidden]{display:none}\n.dusk-ui .panel{max-height:100%;overflow:auto}\n.dusk-ui .hub{width:min(600px,100%)}\n.dusk-ui .shrine{width:min(1040px,100%);display:flex;flex-direction:column;gap:var(--space-16);align-items:center}\n.dusk-ui .card{min-height:248px;pointer-events:auto}\n.dusk-ui .cards{width:100%}\n.dusk-ui .recap{width:min(560px,100%)}\n.dusk-ui .recap ul{margin:0;padding-left:var(--space-20)}\n.dusk-ui .settings{width:min(520px,100%)}\n.dusk-ui .settings input[type=text],.dusk-ui .settings textarea{min-height:var(--touch-min);background:var(--field);color:var(--text);border:2px solid var(--line);border-radius:var(--radius-md);padding:var(--space-8) var(--space-12);font:inherit}\n.dusk-ui .settings textarea{width:100%;min-height:64px;pointer-events:auto;-webkit-user-select:text;user-select:text}\n.dusk-ui .msg{min-height:1.4em;font-size:.875rem}\n.dusk-ui .codex{width:min(820px,100%)}\n.dusk-ui .codex-grid{overflow:auto}\n.dusk-ui .rotate{z-index:5}\n.dusk-ui .screen.rotate{align-items:center;justify-content:center}\n.dusk-ui .loading{z-index:6}\n\n/* HUD: corners inside the safe areas */\n.dusk-ui .hud{position:absolute;inset:0;pointer-events:none;padding:max(12px,env(safe-area-inset-top)) max(12px,env(safe-area-inset-right)) max(12px,env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left))}\n.dusk-ui .hud[hidden]{display:none}\n.dusk-ui .hud-tl{position:absolute;top:max(12px,env(safe-area-inset-top));left:max(12px,env(safe-area-inset-left));width:min(260px,44vw)}\n.dusk-ui .hud-tl .slots{margin-top:var(--space-8)}\n.dusk-ui .hud.touch .slots{display:none}\n.dusk-ui .hud-tr{position:absolute;top:max(12px,env(safe-area-inset-top));right:max(12px,env(safe-area-inset-right));display:flex;gap:var(--space-8);align-items:center}\n.dusk-ui .hud-tr .plate{color:var(--text);min-height:44px}\n.dusk-ui .hud-bl{position:absolute;bottom:max(12px,env(safe-area-inset-bottom));left:max(12px,env(safe-area-inset-left));max-width:46vw}\n.dusk-ui .hud-top{position:absolute;top:max(12px,env(safe-area-inset-top));left:50%;transform:translateX(-50%);width:min(420px,calc(100vw - 640px));min-width:200px}\n@media (max-width:1000px){.dusk-ui .hud-top{top:calc(max(12px,env(safe-area-inset-top)) + 64px);width:min(360px,56vw)}}\n.dusk-ui .saved{opacity:0;transition:opacity .3s var(--ease-out)}\n.dusk-ui .saved.show{opacity:1}\n.dusk-ui .hurt{opacity:0}\n.dusk-ui .hurt.on{animation:dusk-hurt .45s var(--ease-out)}\n@keyframes dusk-hurt{0%{opacity:var(--a,.6)}100%{opacity:0}}\n.dusk-ui .toast{position:absolute;left:50%;bottom:calc(16px + env(safe-area-inset-bottom));transform:translateX(-50%);opacity:0;transition:opacity .2s var(--ease-out);pointer-events:none;z-index:20}\n.dusk-ui .toast.show{opacity:1}\n\n@media (max-width:760px){.dusk-ui .card{min-height:0}.dusk-ui .screen{align-items:flex-start}}\n@media (max-height:480px){\n .dusk-ui .screen{padding:var(--space-8)}\n .dusk-ui .hud-tl{width:200px}\n .dusk-ui .hub .sub,.dusk-ui .shrine .sub{display:none}\n .dusk-ui .shrine{gap:var(--space-8)}\n .dusk-ui .card .take{min-height:44px}\n .dusk-ui .hub{width:min(640px,100%)}\n .dusk-ui .shrine .head{padding:var(--space-8) var(--space-20)!important}\n .dusk-ui .card{min-height:0}\n}\n';

// src/ui/icons.js
var ICONS = {
  pause: { label: "Pause", body: '<rect x="6.5" y="5" width="3.5" height="14" rx="1.2"/><rect x="14" y="5" width="3.5" height="14" rx="1.2"/>' },
  play: { label: "Start / resume", body: '<path d="M8 5.6v12.8a1 1 0 0 0 1.5.86l10.3-6.4a1 1 0 0 0 0-1.72L9.5 4.74A1 1 0 0 0 8 5.6z"/>' },
  settings: { label: "Settings", body: '<path d="M18.03 9.32 L18.75 10.57 L21.09 10.56 L21.09 13.44 L18.75 13.43 L18.03 14.68 L18.16 14.37 L17.79 15.76 L19.44 17.41 L17.41 19.44 L15.76 17.79 L14.37 18.16 L14.68 18.03 L13.43 18.75 L13.44 21.09 L10.56 21.09 L10.57 18.75 L9.32 18.03 L9.63 18.16 L8.24 17.79 L6.59 19.44 L4.56 17.41 L6.21 15.76 L5.84 14.37 L5.97 14.68 L5.25 13.43 L2.91 13.44 L2.91 10.56 L5.25 10.57 L5.97 9.32 L5.84 9.63 L6.21 8.24 L4.56 6.59 L6.59 4.56 L8.24 6.21 L9.63 5.84 L9.32 5.97 L10.57 5.25 L10.56 2.91 L13.44 2.91 L13.43 5.25 L14.68 5.97 L14.37 5.84 L15.76 6.21 L17.41 4.56 L19.44 6.59 L17.79 8.24 L18.16 9.63Z"/><circle cx="12" cy="12" r="2.8"/>' },
  codex: { label: "Codex", body: '<path d="M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5z"/><path d="M12 6.5v13"/>' },
  close: { label: "Close", body: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>' },
  back: { label: "Back", body: '<path d="M14.5 5.5L8 12l6.5 6.5"/>' },
  reroll: { label: "Reroll", body: '<path d="M19 10.5A7.5 7.5 0 0 0 5.6 7.6"/><path d="M5 3.8v4.1h4.1"/><path d="M5 13.5a7.5 7.5 0 0 0 13.4 2.9"/><path d="M19 20.2v-4.1h-4.1"/>' },
  skip: { label: "Skip", body: '<path d="M5.5 6.2v11.6L14.5 12z"/><path d="M18.5 6v12"/>' },
  daily: { label: "Daily seed", body: '<path d="M3 17.5h18"/><path d="M7 17.5a5 5 0 0 1 10 0"/><path d="M12 6.5v3M6.3 9.3l2 2M17.7 9.3l-2 2M3.5 13.5h2M18.5 13.5h2"/><path d="M8 20.5h8"/>' },
  music: { label: "Music", body: '<path d="M9 17.5V6.2l10-2v11.3"/><circle cx="6.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="15.5" r="2.5"/>' },
  sound: { label: "Sound effects", body: '<path d="M4 9.5h3.4L12 5.6v12.8l-4.6-3.9H4z"/><path d="M15.5 9.2a4 4 0 0 1 0 5.6"/><path d="M18 6.6a7.6 7.6 0 0 1 0 10.8"/>' },
  rotate: { label: "Rotate device", body: '<rect x="3.5" y="8" width="9" height="13" rx="2"/><path d="M7 18h2"/><path d="M14.5 3.5a6 6 0 0 1 6 6"/><path d="M22 8l-1.5 2-2-1.4"/>' },
  saved: { label: "Saved", body: '<circle cx="12" cy="12" r="8.5"/><path d="M8.3 12.4l2.5 2.5 4.9-5.2"/>' },
  health: { label: "Health", body: '<path d="M12 20C12 20 4.5 15.4 4.5 10A4.25 4.25 0 0 1 12 7.3A4.25 4.25 0 0 1 19.5 10C19.5 15.4 12 20 12 20Z"/>' },
  vigor: { label: "Vigor (max health)", body: '<path d="M12 20C12 20 4.5 15.4 4.5 10A4.25 4.25 0 0 1 12 7.3A4.25 4.25 0 0 1 19.5 10C19.5 15.4 12 20 12 20Z"/><path d="M12 10.5v5M9.5 13h5"/>' },
  shield: { label: "Shield", body: '<path d="M12 3.2l7 2.6v5.9c0 4.4-2.9 7.6-7 9.1-4.1-1.5-7-4.7-7-9.1V5.8z"/>' },
  ember: { label: "Embers (currency)", body: '<path d="M12 3l5.8 9L12 21l-5.8-9z"/><path d="M12 8.6L14.2 12 12 15.4 9.8 12z"/>' },
  foes: { label: "Foes", body: '<path d="M8 19.5v-2.6C5.6 15.6 4.5 13.4 4.5 11a7.5 7.5 0 0 1 15 0c0 2.4-1.1 4.6-3.5 5.9v2.6z"/><circle cx="9.3" cy="11.3" r="1.6"/><circle cx="14.7" cy="11.3" r="1.6"/><path d="M11 19.5v-2M13 19.5v-2"/>' },
  endings: { label: "Endings", body: '<path d="M12 3.6 L14.29 9.44 L20.56 9.82 L15.71 13.81 L17.29 19.88 L12 16.5 L6.71 19.88 L8.29 13.81 L3.44 9.82 L9.71 9.44Z"/>' },
  attack: { label: "Attack", body: '<path d="M19.5 4.5V8l-9 9-3.5-3.5 9-9z"/><path d="M5.5 12.5l6 6"/><path d="M8.2 15.8L4.5 19.5"/>' },
  dodge: { label: "Dodge", body: '<path d="M12.5 6l6 6-6 6"/><path d="M4 8h5M3 12h8M4 16h5"/>' },
  bash: { label: "Bash", body: '<path d="M12 2.8 L13.76 7.75 L18.51 5.49 L16.25 10.24 L21.2 12 L16.25 13.76 L18.51 18.51 L13.76 16.25 L12 21.2 L10.24 16.25 L5.49 18.51 L7.75 13.76 L2.8 12 L7.75 10.24 L5.49 5.49 L10.24 7.75Z"/>' },
  battle: { label: "Battle room", body: '<path d="M3.5 3.5L12.83 12.83M10.71 14.96L14.96 10.71M12.83 12.83L15.1 15.1"/><circle cx="16.09" cy="16.09" r="0.9"/><path d="M20.5 3.5L11.17 12.83M9.04 10.71L13.29 14.96M11.17 12.83L8.9 15.1"/><circle cx="7.91" cy="16.09" r="0.9"/>' },
  elite: { label: "Elite room", body: '<path d="M8 19.5v-2.6C5.6 15.6 4.5 13.4 4.5 11a7.5 7.5 0 0 1 15 0c0 2.4-1.1 4.6-3.5 5.9v2.6z"/><circle cx="9.3" cy="11.3" r="1.6"/><circle cx="14.7" cy="11.3" r="1.6"/><path d="M11 19.5v-2M13 19.5v-2"/><path d="M6.4 6.6C3.6 6.2 2.2 4.4 2.4 1.9"/><path d="M17.6 6.6c2.8-.4 4.2-2.2 4-4.7"/>' },
  treasure: { label: "Treasure room", body: '<rect x="3.5" y="10" width="17" height="9.5" rx="1.5"/><path d="M3.5 10V8.5A3.5 3.5 0 0 1 7 5h10a3.5 3.5 0 0 1 3.5 3.5V10"/><path d="M3.5 13h17"/><rect x="10.5" y="11.5" width="3" height="4" rx="1"/>' },
  rest: { label: "Rest room", body: '<path d="M4 20.5l16-4M4 16.5l16 4"/><path d="M12 15c-2.3 0-3.8-1.6-3.8-3.6 0-2.4 2.2-3.6 2.6-6.4 1.4 1 2 2.2 2.1 3.4.6-.5 1-1.2 1.1-2 1.2 1.2 1.8 2.8 1.8 4.3 0 2.4-1.5 4.3-3.8 4.3z"/>' },
  boss: { label: "Boss", body: '<path d="M4.5 17.5L3.5 8l4.8 3.6L12 5.5l3.7 6.1L20.5 8l-1 9.5z"/><path d="M5 20.5h14"/>' },
  stairs: { label: "Stairs down", body: '<path d="M3.5 7h5v5h5v5h7"/><path d="M18 3.5v7.5"/><path d="M15 8.2l3 3 3-3"/>' },
  fire: { label: "Fire", body: '<path d="M12 21a6 6 0 0 0 6-6c0-4.1-2.9-6.2-4.1-10.4-1.6 1.9-2.1 3.5-2.1 5.5-1.1-.9-2-2-2.5-3.5C7.6 9.1 6 11.6 6 15a6 6 0 0 0 6 6z"/><path d="M12 21a2.5 2.5 0 0 1-2.5-2.5c0-1.6 1.2-2.5 2.5-4.1 1.3 1.6 2.5 2.5 2.5 4.1A2.5 2.5 0 0 1 12 21z"/>' },
  frost: { label: "Frost", body: '<path d="M12 3L12 21 M19.79 7.5L4.21 16.5 M19.79 16.5L4.21 7.5 M10.33 4.01L12 6 M13.67 4.01L12 6 M18.09 6.56L17.2 9 M19.76 9.45L17.2 9 M19.76 14.55L17.2 15 M18.09 17.44L17.2 15 M13.67 19.99L12 18 M10.33 19.99L12 18 M5.91 17.44L6.8 15 M4.24 14.55L6.8 15 M4.24 9.45L6.8 9 M5.91 6.56L6.8 9"/>' },
  bleed: { label: "Bleed", body: '<path d="M12 3.5c3 4 6 7 6 10.5a6 6 0 0 1-12 0c0-3.5 3-6.5 6-10.5z"/><path d="M9.3 14.5A2.7 2.7 0 0 0 12 17.2"/>' },
  crit: { label: "Crit", body: '<circle cx="12" cy="12" r="6.8"/><circle cx="12" cy="12" r="2"/><path d="M12 2.5v4.2M12 17.3v4.2M2.5 12h4.2M17.3 12h4.2"/>' },
  speed: { label: "Speed", body: '<path d="M13.5 2.8L5 13.6h6.2L10.3 21.2 19 10.2h-6.2z"/>' },
  summon: { label: "Summon", body: '<path d="M6 20.2V11a6 6 0 0 1 12 0v9.2l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4z"/><circle cx="9.8" cy="11.2" r="1.1"/><circle cx="14.2" cy="11.2" r="1.1"/>' }
};
function iconSvg(name, title) {
  const ic = ICONS[name];
  if (!ic) return "";
  const t = title ? `<title>${title}</title>` : "";
  const a = title ? `role="img" aria-label="${title}"` : `aria-hidden="true"`;
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" focusable="false" ${a}>${t}${ic.body}</svg>`;
}
function iconEl(name, doc = document) {
  const s2 = doc.createElement("span");
  s2.className = "ico ico-" + name;
  s2.setAttribute("aria-hidden", "true");
  s2.innerHTML = iconSvg(name);
  return s2;
}

// src/ui/ui.js
var TAG_NAMES = { fire: "Fire", frost: "Frost", bleed: "Bleed", crit: "Crit", shield: "Shield", speed: "Speed", summon: "Summon" };
var tagId = (t) => t && typeof t === "object" ? t.id : t;
var tagName = (t) => t && typeof t === "object" ? t.name || TAG_NAMES[t.id] || t.id : TAG_NAMES[t] || String(t);
function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props) {
    for (const k in props) {
      const v = props[k];
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else if (k in el && k !== "list") el[k] = v;
      else el.setAttribute(k, v);
    }
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(c));
  return el;
}
var btn = (text, onclick, cls = "", extra = {}) => {
  const { icon, ...rest } = extra;
  return h("button", { type: "button", class: cls, onclick, "data-component": "button", ...rest }, icon ? iconEl(icon) : null, text);
};
var coin = (n) => h("span", { class: "coin" }, iconEl("ember"), h("span", { text: String(n | 0) }));
var pct = (v, m) => Math.max(0, Math.min(100, m > 0 ? v / m * 100 : 0));
var safe = (fn, ...a) => {
  try {
    return fn && fn(...a);
  } catch (e) {
    console.error(e);
  }
};
function createUI(rootEl) {
  if (!document.getElementById("dusk-ui-style")) {
    const st = document.createElement("style");
    st.id = "dusk-ui-style";
    st.textContent = style_default;
    document.head.append(st);
  }
  const root = h("div", { class: "dusk-ui" });
  rootEl.append(root);
  const hpFill = h("i"), shFill = h("i", { class: "sh" }), hpText = h("b");
  const hpBar = h("div", { class: "bar hp", role: "meter", "aria-label": "Health", "aria-valuemin": 0 }, hpFill, shFill, hpText);
  const mkSlot = (label, key, icon) => {
    const f = h("i"), t = h("span", { class: "lbl", text: label }), k = h("kbd", { text: key });
    return { el: h("div", { class: "slot", "aria-label": label + " (" + key + ")" }, f, iconEl(icon), k, t), f, t, label };
  };
  const dodgeSlot = mkSlot("Dodge", "Space", "dodge"), skillSlot = mkSlot("Bash", "L", "bash");
  const hudTL = h("div", { class: "hud-tl plate", "data-component": "block", "data-name": "Health and abilities" }, hpBar, h("div", { class: "slots" }, dodgeSlot.el, skillSlot.el));
  const floorText = h("span", { class: "fl" });
  const pips = h("span", { class: "pips", "aria-hidden": "true" });
  const foesText = h("span", { class: "foes" });
  const curNum = h("span"), curText = h("span", { class: "coin", "aria-label": "Embers" }, iconEl("ember"), curNum);
  const savedChip = h("span", { class: "saved", text: "Saved" });
  const pauseBtn = h("button", { type: "button", class: "pausebtn icon-only", "aria-label": "Pause", "data-component": "button" }, iconEl("pause"));
  let pauseHandler = null;
  pauseBtn.addEventListener("click", () => {
    if (pauseHandler) pauseHandler();
    else root.dispatchEvent(new CustomEvent("dusk:pause", { bubbles: true }));
  });
  const hudTR = h(
    "div",
    { class: "hud-tr" },
    h("div", { class: "plate prog", "data-component": "block", "data-name": "Floor progress" }, h("div", { class: "row1" }, floorText, pips), h("div", { class: "row2" }, foesText, curText, savedChip)),
    pauseBtn
  );
  const hudBL = h("div", { class: "hud-bl tagchips", "aria-label": "Build" });
  const bossName = h("div", { class: "nm" }), bossFill = h("i");
  const bossBar = h("div", { class: "bar boss", role: "meter", "aria-label": "Boss health" }, bossFill, h("u", { style: "left:33.3%" }), h("u", { style: "left:66.6%" }));
  const hudTop = h("div", { class: "hud-top plate bossbar", hidden: true }, bossName, bossBar);
  const hurt = h("div", { class: "hurt", "aria-hidden": "true" });
  const hud = h("div", { class: "hud", hidden: true }, hurt, hudTL, hudTR, hudBL, hudTop);
  root.append(hud);
  const last = {};
  const setTxt = (el, key, v) => {
    if (last[key] !== v) {
      last[key] = v;
      el.textContent = v;
    }
  };
  const touchBtn = {};
  function setCd(slot, key, cd, max, touchSel) {
    const ready = !(cd > 0.05);
    const frac = ready ? 1 : Math.max(0, Math.min(1, (max - cd) / max));
    const k = ready ? "r" : Math.round(cd * 10);
    if (last[key] === k) return;
    last[key] = k;
    slot.el.classList.toggle("ready", ready);
    slot.f.style.width = Math.round(frac * 100) + "%";
    slot.t.textContent = ready ? "" : cd.toFixed(1) + "s";
    const tb = touchBtn[touchSel] || (touchBtn[touchSel] = document.querySelector(".dusk-tbtn." + touchSel));
    if (tb) {
      tb.style.setProperty("--p", frac.toFixed(3));
      tb.classList.toggle("cooling", !ready);
    }
  }
  const hudApi = {
    show(v) {
      hud.hidden = !v;
    },
    onPause(fn) {
      pauseHandler = fn;
    },
    hurt(strength = 1) {
      hurt.style.setProperty("--a", String(Math.min(1, 0.35 + 0.65 * strength)));
      hurt.classList.remove("on");
      void hurt.offsetWidth;
      hurt.classList.add("on");
    },
    update(s2 = {}) {
      hud.classList.toggle("touch", !!s2.touch);
      const maxHp = s2.maxHp || 1, hp = Math.max(0, s2.hp || 0), sh = s2.shield || 0;
      hpFill.style.width = pct(hp, maxHp) + "%";
      shFill.style.width = pct(Math.min(sh, maxHp), maxHp) + "%";
      shFill.style.display = sh > 0 ? "" : "none";
      hpBar.classList.toggle("low", hp / maxHp < 0.3);
      setTxt(hpText, "hp", Math.ceil(hp) + " / " + Math.ceil(maxHp) + (sh > 0 ? "  +" + Math.ceil(sh) : ""));
      hpBar.setAttribute("aria-valuemax", Math.ceil(maxHp));
      hpBar.setAttribute("aria-valuenow", Math.ceil(hp));
      setTxt(curNum, "cur", String(s2.currency | 0));
      const rooms = s2.rooms || 0, room = s2.room || 0, isBoss = rooms && room >= rooms - 1;
      const path = s2.path || [];
      const RT = { elite: "Elite", treasure: "Treasure", rest: "Rest" }, cur = path[room];
      setTxt(floorText, "fl", s2.floor != null ? "Floor " + s2.floor + (isBoss ? " \xB7 Boss" : rooms ? " \xB7 " + (RT[cur] || "Room") + " " + (room + 1) + " of " + (rooms - 1) : "") : "");
      const pk = rooms + ":" + room + ":" + path.join(",");
      if (last.pips !== pk) {
        last.pips = pk;
        const out = [];
        for (let i = 0; i < rooms; i++) {
          const t = i === rooms - 1 ? "boss" : path[i] || "";
          out.push(h("i", { class: [t, i < room ? "done" : i === room ? "now" : ""].join(" "), title: t }));
        }
        pips.replaceChildren(...out);
      }
      setTxt(foesText, "foes", s2.foes == null ? "" : s2.foes > 0 ? s2.foes + (s2.foes === 1 ? " foe left" : " foes left") : s2.exitCount > 1 ? "Choose a portal" : "Portal open");
      foesText.classList.toggle("clear", s2.foes === 0);
      savedChip.classList.toggle("show", !!s2.saved);
      setCd(dodgeSlot, "dodge", s2.dodgeCd || 0, s2.dodgeMax || 1, "dodge");
      setCd(skillSlot, "skill", s2.skillCd || 0, s2.skillMax || 1, "skill");
      const tags = s2.tags || {};
      const tk = Object.keys(tags).filter((k) => tags[k] > 0).map((k) => k + tags[k]).join(",");
      if (last.tags !== tk) {
        last.tags = tk;
        hudBL.replaceChildren(...Object.keys(tags).filter((k) => tags[k] > 0).sort((x, y) => tags[y] - tags[x]).map((k) => {
          const n = tags[k], dots = [1, 2, 3].map((i) => h("i", { class: i <= n ? "f" : "" }));
          return h(
            "span",
            { class: "tagchip" + (n >= 3 ? " max" : n >= 2 ? " on" : ""), "aria-label": tagName(k) + " " + n + " of 3" + (n >= 2 ? ", bonus active" : "") },
            iconEl(k),
            h("span", { text: tagName(k) }),
            h("span", { class: "dots" }, ...dots)
          );
        }));
      }
      const b = s2.boss;
      hudTop.hidden = !b;
      if (b) {
        setTxt(bossName, "bn", b.name);
        bossFill.style.width = pct(b.hp, b.maxHp) + "%";
        bossBar.setAttribute("aria-valuenow", Math.ceil(b.hp));
        bossBar.setAttribute("aria-valuemax", Math.ceil(b.maxHp));
      }
    }
  };
  const screen = h("div", { class: "screen", hidden: true, role: "dialog", "aria-modal": "true" });
  const rotate = h(
    "div",
    { class: "screen rotate", hidden: true, role: "alert" },
    h("div", { class: "phone", "aria-hidden": "true" }),
    h("h2", { text: "Rotate your device" }),
    h("p", { class: "muted", text: "Turn your phone sideways to play" })
  );
  const loadText = h("div");
  const loading = h("div", { class: "screen loading", hidden: true, role: "status" }, h("div", { class: "spin", "aria-hidden": "true" }), loadText);
  const toastEl = h("div", { class: "toast", role: "status", "aria-live": "polite", "aria-atomic": "true", "data-component": "status" });
  root.append(screen, rotate, loading, toastEl);
  let keyHandler = null;
  let escHandler = null;
  function open(panel2, focusEl) {
    screen.replaceChildren(panel2);
    screen.hidden = false;
    screen.setAttribute("aria-label", panel2.getAttribute("aria-label"));
    screen.scrollTop = 0;
    const f = focusEl || panel2.querySelector(".primary") || panel2.querySelector("button");
    if (f) setTimeout(() => f.focus({ preventScroll: true }), 0);
  }
  function close() {
    screen.hidden = true;
    screen.replaceChildren();
    keyHandler = escHandler = null;
  }
  document.addEventListener("keydown", (e) => {
    if (screen.hidden || e.ctrlKey || e.metaKey || e.altKey) return;
    const inField = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
    if (e.key === "Escape" && escHandler) {
      e.preventDefault();
      e.stopPropagation();
      escHandler();
      return;
    }
    if (inField) return;
    if (keyHandler && keyHandler(e)) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);
  const panel = (cls, label, ...kids) => h("div", { class: "panel stack " + cls, "aria-label": label }, ...kids);
  function showHub(meta = {}, o = {}) {
    keyHandler = escHandler = null;
    const endings = (meta.endings || []).length;
    const cost = o.upgradeCost == null ? null : o.upgradeCost;
    const lvl = meta.upgrades && meta.upgrades.vigor || 0;
    const canBuy = cost != null && (meta.currency || 0) >= cost;
    const up = btn(cost == null ? "Vigor maxed" : "Raise vigor (" + cost + " embers)", () => safe(o.onUpgrade, "vigor"), "", { icon: "vigor", disabled: cost == null || !canBuy, "aria-label": cost == null ? "Vigor upgrade, maxed out" : "Buy Vigor upgrade for " + cost + " embers" + (canBuy ? "" : ", not enough embers") });
    open(panel(
      "hub center",
      "Camp",
      h("h1", { text: "Dusk Camp" }),
      h("p", { class: "muted sub", text: "Gather by the fire, then step through the portal." }),
      h("div", { class: "row" }, btn("Start run", () => safe(o.onStart), "primary big", { icon: "play" }), btn("Daily seed run", () => safe(o.onDaily), "", { icon: "daily" })),
      h(
        "div",
        { class: "stats" },
        h("div", { class: "stat", "data-component": "stat" }, h("span", { text: "Embers" }), coin(meta.currency)),
        h("div", { class: "stat", "data-component": "stat" }, h("span", { text: "Endings found" }), h("span", { text: endings + " of 3" })),
        h("div", { class: "stat", "data-component": "stat" }, h("span", { text: "Vigor" }), h("span", { text: lvl + " of 2" }))
      ),
      h("div", { class: "row" }, up, btn("Codex", () => safe(o.onCodex), "", { icon: "codex" }), btn("Settings", () => safe(o.onSettings), "", { icon: "settings" }))
    ));
  }
  function showShrine(cards2 = [], o = {}) {
    let sel = 0;
    const els = cards2.map((c, i) => {
      const tags = (c.tags || []).map((t) => {
        const owned = t && t.owned;
        return h("span", { class: "tag" + (owned ? " owned" : "") }, iconEl(tagId(t)), tagName(t), owned ? " (owned)" : "");
      });
      const combo = !!(c.combo || c.bonusNote);
      const el = h(
        "div",
        { class: "card", "data-component": "card", role: "group", "aria-label": c.name + (combo ? ", completes a combo" : "") },
        h("span", { class: "key", "aria-hidden": "true", text: "[" + (i + 1) + "]" }),
        h("h3", { text: c.name }),
        h("div", { class: "tags" }, tags),
        combo ? h("span", { class: "combo", text: "Combo" }) : null,
        c.effect ? h("p", { class: "effect", text: c.effect }) : null,
        h("p", { class: "flavor", text: c.desc }),
        c.pairsWith ? h("p", { class: "pairs", text: "Pairs with your " + c.pairsWith }) : null,
        c.bonusNote ? h("p", { class: "bonus", text: c.bonusNote }) : null,
        h("div", { class: "grow" }),
        btn("Take", () => take(i), "primary take", { "aria-label": "Take " + c.name })
      );
      el.addEventListener("pointerenter", () => select(i));
      el.querySelector(".take").addEventListener("focus", () => select(i));
      return el;
    });
    function select(i) {
      sel = i;
      els.forEach((e, j) => e.classList.toggle("sel", j === i));
    }
    function take(i) {
      if (cards2[i]) safe(o.onTake, cards2[i].id);
    }
    const cost = o.rerollCost;
    const reroll = btn("Reroll" + (cost != null ? " (" + cost + " embers)" : ""), () => safe(o.onReroll), "", { icon: "reroll", disabled: o.canReroll === false, "aria-label": "Reroll offers" + (cost != null ? " for " + cost + " embers" : "") });
    open(h(
      "div",
      { class: "shrine", "aria-label": "Shrine" },
      h("div", { class: "panel center head", style: "padding:12px 28px" }, h("h2", { text: "Shrine of Dusk" }), h("p", { class: "muted sub", text: "Choose one blessing. Keys 1-3 select, Enter takes." })),
      h("div", { class: "cards" }, els),
      h("div", { class: "row" }, reroll, btn("Skip", () => safe(o.onSkip), "", { icon: "skip" }))
    ), els[0] && els[0].querySelector(".take"));
    select(0);
    keyHandler = (e) => {
      if (e.key >= "1" && e.key <= "3" && cards2[+e.key - 1]) {
        select(+e.key - 1);
        els[sel].querySelector(".take").focus({ preventScroll: true });
        return true;
      }
      if (e.key === "Enter" && e.target.tagName !== "BUTTON") {
        take(sel);
        return true;
      }
      return false;
    };
  }
  function showRecap(r = {}, o = {}) {
    keyHandler = escHandler = null;
    const lost = r.itemsLost || [], ends = r.endingsNew || [];
    open(panel(
      "recap",
      r.won ? "Run won" : "Run over",
      h("h1", { text: r.won ? "Victory" : "You fell" }),
      !r.won && r.killer ? h("p", { text: "Defeated by " + r.killer + " on floor " + r.floor + ", room " + (r.room + 1) + "." }) : h("p", { text: "Reached floor " + r.floor + ", room " + (r.room + 1) + "." }),
      !r.won && r.tip ? h("p", { class: "tipbox" }, h("b", { text: "Tip: " }), r.tip) : null,
      h("p", {}, "Embers kept: ", coin(r.currencyKept)),
      lost.length ? h("div", {}, h("p", { class: "lost", text: "Items lost:" }), h("ul", {}, lost.map((n) => h("li", { text: n })))) : null,
      ends.length ? h("div", {}, h("p", { class: "accent" }, iconEl("endings"), " New endings:"), h("ul", {}, ends.map((n) => h("li", { text: n })))) : null,
      h("div", { class: "row" }, btn("Again", () => safe(o.onAgain), "primary big", { icon: "play" }), btn("Back to camp", () => safe(o.onHub), "", { icon: "back" }))
    ));
  }
  function showPause(o = {}) {
    keyHandler = escHandler = null;
    open(panel(
      "center",
      "Paused",
      h("h2", { text: "Paused" }),
      btn("Resume", () => safe(o.onResume), "primary big", { icon: "play" }),
      btn("Settings", () => safe(o.onSettings), "", { icon: "settings" }),
      btn("Quit to camp", () => safe(o.onQuit), "", { icon: "back" })
    ));
  }
  function showSettings(s2 = {}, o = {}) {
    keyHandler = null;
    escHandler = () => safe(o.onClose);
    const msg = h("p", { class: "msg", role: "status", "aria-live": "polite" });
    const slider = (key, label, icon) => {
      const val = h("span", { class: "muted", text: Math.round((s2[key] ?? 0) * 100) + "%" });
      const inp = h("input", { type: "range", "data-component": "input", min: 0, max: 100, value: Math.round((s2[key] ?? 0) * 100), "aria-label": label, oninput: () => {
        val.textContent = inp.value + "%";
        safe(o.onChange, key, inp.value / 100);
      } });
      return h("label", { class: "field" }, h("span", {}, iconEl(icon), " " + label), inp, val);
    };
    const check = (key, label) => {
      const inp = h("input", { type: "checkbox", "data-component": "checkbox", checked: !!s2[key], onchange: () => safe(o.onChange, key, inp.checked) });
      return h("label", { class: "field" }, h("span", { text: label }), inp);
    };
    const quality = h(
      "select",
      { "data-component": "select", "aria-label": "Graphics quality", onchange: () => safe(o.onChange, "quality", quality.value) },
      ["auto", "high", "medium", "low"].map((q) => h("option", { value: q, selected: s2.quality === q, text: q[0].toUpperCase() + q.slice(1) }))
    );
    const code = h("textarea", { "aria-label": "Save code", placeholder: "Paste a save code here", rows: 3, spellcheck: false });
    const say = (text, bad) => {
      msg.textContent = text;
      msg.className = "msg" + (bad ? " warn" : " coin");
    };
    open(panel(
      "settings",
      "Settings",
      h("h2", { text: "Settings" }),
      h("label", { class: "field" }, h("span", { text: "Graphics quality" }), quality),
      slider("music", "Music", "music"),
      slider("sfx", "Sound effects", "sound"),
      check("shake", "Screen shake"),
      check("flashes", "Flashing effects"),
      check("blur", "Blur effects"),
      check("screenRelative", "Screen-relative movement"),
      h(
        "div",
        { class: "stack" },
        h("h3", { text: "Save code" }),
        code,
        h(
          "div",
          { class: "row" },
          btn("Copy code", () => {
            try {
              const c = o.onCopyCode ? o.onCopyCode() : "";
              code.value = c;
              if (navigator.clipboard) navigator.clipboard.writeText(c).then(() => say("Code copied."), () => say("Copy it from the box above."));
              else say("Copy it from the box above.");
            } catch (e) {
              say("Could not make a code.", true);
            }
          }),
          btn("Load code", () => {
            try {
              const r = o.onLoadCode ? o.onLoadCode(code.value.trim()) : null;
              say(r ? r.message : "", r && !r.ok);
            } catch (e) {
              say(e.message || "Could not load.", true);
            }
          })
        ),
        msg
      ),
      btn("Close", () => safe(o.onClose), "primary")
    ));
  }
  function showCodex(entries2 = [], o = {}) {
    keyHandler = null;
    escHandler = () => safe(o.onClose);
    const seen = entries2.filter((e) => e.seen).length;
    const tagEls = (tags) => h("div", { class: "tags" }, (tags || []).map((t) => h("span", { class: "tag" }, iconEl(tagId(t)), tagName(t))));
    open(panel(
      "codex",
      "Codex",
      h("h2", { text: "Codex" }),
      h("p", { class: "muted", text: seen + " of " + entries2.length + " items discovered" }),
      h("div", { class: "codex-grid" }, entries2.map((e) => e.seen ? h("div", { class: "entry", "data-component": "card" }, h("h3", { text: e.name }), tagEls(e.tags), h("p", { class: "muted", text: e.desc })) : h("div", { class: "entry unseen", "aria-label": "Undiscovered item" }, h("h3", { text: "Unknown item" }), h("p", { class: "muted", text: "Not yet discovered" })))),
      btn("Close", () => safe(o.onClose), "primary")
    ));
  }
  let toastT = 0;
  return {
    hud: hudApi,
    showHub,
    showShrine,
    showRecap,
    showPause,
    showSettings,
    showCodex,
    showRotate(v) {
      rotate.hidden = !v;
    },
    showLoading(t) {
      loading.hidden = t == null || t === false;
      if (t) loadText.textContent = t;
    },
    toast(text) {
      toastEl.textContent = text;
      toastEl.classList.add("show");
      clearTimeout(toastT);
      toastT = setTimeout(() => toastEl.classList.remove("show"), 2400);
    },
    hideAll() {
      close();
      loading.hidden = true;
    },
    // additions
    close,
    el: root
  };
}

// tests/ui-demo.entry.js
var ui = createUI(document.getElementById("app"));
var s = new URLSearchParams(location.search).get("s") || "hub";
var live = (o = {}) => new Proxy(o, { get: (t, k) => k in t ? t[k] : typeof k === "string" && k.startsWith("on") ? () => ui.toast(k) : void 0, has: () => true });
var cards = [
  { id: "a", name: "Ember Blade", tags: [{ id: "fire", name: "Fire", owned: true }, { id: "crit", name: "Crit", owned: false }], desc: "+3 damage. Your hits leave a lingering burn.", pairsWith: "Cinder Ring", bonusNote: "Fire x2: hits burn", combo: true },
  { id: "b", name: "Frostbound Greaves", tags: [{ id: "frost", name: "Frost", owned: false }, { id: "speed", name: "Speed", owned: false }], desc: "+8% move speed. Chilled enemies move slower for a short while.", pairsWith: null, bonusNote: null },
  { id: "c", name: "Bulwark of Long Nights", tags: [{ id: "shield", name: "Shield", owned: true }], desc: "Start each room with a small shield. Dodging at the last moment refills it.", pairsWith: "Warden's Charm", bonusNote: "Shield x2: room shield 15%" }
];
var hudData = { hp: 62, maxHp: 110, shield: 20, tags: { fire: 2, crit: 1, shield: 3 }, currency: 134, floor: 2, room: 3, rooms: 6, saved: true, boss: s === "hud" ? { name: "Stone Golem", hp: 310, maxHp: 450 } : null, skillCd: 3.2, skillMax: 7, dodgeCd: 0, dodgeMax: 0.8 };
var entries = Array.from({ length: 9 }, (_, i) => ({ name: "Relic " + (i + 1), tags: ["fire", "crit"].slice(0, 1 + i % 2), desc: "A short description of what this relic does.", seen: i % 3 !== 2 }));
var settings = { quality: "auto", shake: true, flashes: true, blur: false, music: 0.6, sfx: 0.8, screenRelative: true };
({
  hub: () => ui.showHub({ currency: 134, endings: ["spire"], upgrades: { vigor: 1 } }, live({ upgradeCost: 100 })),
  hud: () => {
    document.body.style.background = "linear-gradient(#1a1030,#3a2455 60%,#0c0818)";
    ui.hud.show(true);
    ui.hud.onPause(() => ui.toast("Paused"));
    ui.hud.update(hudData);
    ui.toast("Run saved");
  },
  shrine: () => ui.showShrine(cards, live({ rerollCost: 25, canReroll: true })),
  recap: () => ui.showRecap({ won: false, killer: "Skeleton grunt", tip: "Skeletons swing in an arc: step out of the red arc, then strike.", floor: 2, room: 3, itemsLost: ["Ember Blade", "Cinder Ring"], currencyKept: 42, endingsNew: [] }, live({})),
  settings: () => ui.showSettings(settings, live({ onCopyCode: () => "abc", onLoadCode: () => ({ ok: true, message: "Loaded." }) })),
  codex: () => ui.showCodex(entries, live({})),
  pause: () => ui.showPause(live({})),
  rotate: () => ui.showRotate(true)
})[s]();
