// Component gate. Usage: node gate.js <url-or-html-path> [--widths 1440,390]
// Checks every element marked data-component="<type>" in a real browser.
// Exit code 1 if any component fails. Requires Playwright (require('playwright')).
const { chromium } = require('playwright');
const path = require('path');
const args = process.argv.slice(2);
const target = args[0];
const widths = (args.includes('--widths') ? args[args.indexOf('--widths') + 1] : '1440,390').split(',').map(Number);
const url = /^https?:|^file:/.test(target) ? target : 'file://' + path.resolve(target);

const INTERACTIVE = ['button', 'link', 'input', 'checkbox', 'select', 'tabs', 'control'];
const RADII = [0, 4, 6, 8, 10, 12, 14, 16, 20];
const EASES = ['cubic-bezier(0.22, 1, 0.36, 1)', 'cubic-bezier(0.23, 1, 0.32, 1)', 'cubic-bezier(0.77, 0, 0.175, 1)', 'cubic-bezier(0.32, 0.72, 0, 1)']; // ease-out (this skill, web-motion), ease-in-out, drawer
const MOTION_PROPS = ['color', 'background-color', 'border-color', 'opacity', 'transform', 'box-shadow', 'outline-color', 'text-decoration-color'];

function lum(c) {
  const m = c && c.match(/rgba?\(([^)]+)\)/); if (!m) return null;
  const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return { L: 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b), a };
}
const ratio = (a, b) => { const x = lum(a), y = lum(b); if (!x || !y) return 99; const [h, l] = x.L > y.L ? [x.L, y.L] : [y.L, x.L]; return (h + 0.05) / (l + 0.05); };

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const rows = []; let failed = 0;
  for (const w of widths) {
    const page = await browser.newPage({ viewport: { width: w, height: 900 }, hasTouch: w < 600 });
    await page.goto(url); await page.waitForTimeout(600);
    const count = await page.$$eval('[data-component]', (e) => e.length);
    for (let i = 0; i < count; i++) {
      const el = (await page.$$('[data-component]'))[i];
      if (!(await el.isVisible()) || await el.evaluate((e) => !!e.closest('[data-stage]'))) continue; // components inside a demo stage are illustration
      const info = await el.evaluate((e, { RADII, EASES, MOTION_PROPS }) => {
        const type = e.dataset.component, cs = getComputedStyle(e), r = e.getBoundingClientRect();
        const id = e.dataset.name || e.id || (e.getAttribute('aria-label') || e.textContent || type).trim().replace(/\s+/g, ' ').slice(0, 32);
        const all = [e, ...e.querySelectorAll('*')].filter((n) => !n.closest('svg, [data-stage]') || n === e); // a demo stage is an illustration, not UI
        const bgOf = (n) => { for (; n; n = n.parentElement) { const b = getComputedStyle(n).backgroundColor; if (!/rgba\(0, 0, 0, 0\)|transparent/.test(b)) return b; } return 'rgb(255, 255, 255)'; };
        const name = (e.getAttribute('aria-label') || (e.getAttribute('aria-labelledby') || '').split(' ').map((x) => document.getElementById(x)?.textContent || '').join(' ') ||
          (e.labels && [...e.labels].map((l) => l.textContent).join(' ')) || e.getAttribute('alt') || e.getAttribute('title') || e.textContent || '').trim();
        const texts = all.filter((n) => [...n.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim()) && getComputedStyle(n).visibility !== 'hidden')
          .map((n) => { const s = getComputedStyle(n); let op = 1; for (let p = n; p; p = p.parentElement) op *= +getComputedStyle(p).opacity; return { fg: s.color, bg: bgOf(n), fs: parseFloat(s.fontSize), fw: +s.fontWeight, op, t: n.textContent.trim().slice(0, 20) }; });
        const offGrid = [];
        all.forEach((n) => { const s = getComputedStyle(n); for (const p of ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'rowGap', 'columnGap', 'marginTop', 'marginBottom']) { const v = parseFloat(s[p]); if (v > 2 && v % 4) offGrid.push(`${p}=${s[p]}`); } });
        const badRadius = [], concentric = [];
        all.forEach((n) => { const s = getComputedStyle(n); const rad = parseFloat(s.borderTopLeftRadius); if (rad > 0 && !RADII.includes(Math.round(rad)) && rad < Math.min(n.offsetWidth, n.offsetHeight) / 2 - 1) badRadius.push(Math.round(rad));
          const p = n.parentElement; if (n !== e && p && e.contains(p) && rad > 0) { const ps = getComputedStyle(p), pr = parseFloat(ps.borderTopLeftRadius), pad = Math.min(parseFloat(ps.paddingTop), parseFloat(ps.paddingLeft)); const circle = rad >= Math.min(n.offsetWidth, n.offsetHeight) / 2 - 1; if (!circle && pr > 0 && pad > 0 && pad < pr && rad > Math.max(4, pr - pad) + 2) concentric.push(`${Math.round(rad)}>${pr}-${pad}`); } });
        const motion = [];
        all.forEach((n) => { const s = getComputedStyle(n); if (parseFloat(s.transitionDuration) > 0) { s.transitionProperty.split(',').map((x) => x.trim()).forEach((p) => { if (!MOTION_PROPS.includes(p)) motion.push('prop ' + p); });
          s.transitionTimingFunction.split(/,(?![^(]*\))/).map((x) => x.trim()).forEach((f) => { if (!EASES.includes(f) && f !== 'linear') motion.push('ease ' + f); });
          s.transitionDuration.split(',').map(parseFloat).forEach((d) => { if (d * 1000 < 100 || d * 1000 > 500) motion.push('dur ' + d + 's'); }); } });
        const literals = [];
        for (const sheet of document.styleSheets) { let rules; try { rules = sheet.cssRules; } catch { continue; }
          for (const rule of rules) { if (!rule.selectorText) continue; let hit = false; try { hit = all.some((n) => n.matches(rule.selectorText.replace(/:(hover|active|focus-visible|focus|checked|disabled)/g, ''))); } catch {} if (!hit) continue;
            for (const prop of ['color', 'background-color', 'background', 'border-color', 'border', 'box-shadow', 'outline-color']) { const v = rule.style.getPropertyValue(prop); if (v && /#[0-9a-f]{3,8}\b|rgba?\(/i.test(v) && !/var\(/.test(v)) literals.push(`${rule.selectorText} ${prop}`); } } }
        const tag = e.tagName.toLowerCase();
        const focusable = e.tabIndex >= 0 || ['a', 'button', 'input', 'select', 'textarea'].includes(tag);
        const labelBox = (e.labels && e.labels[0]) ? e.labels[0].getBoundingClientRect() : r;
        const inlineInText = tag === 'a' && cs.display === 'inline' && e.parentElement && e.parentElement.textContent.trim().length > e.textContent.trim().length + 10;
        const numericNodes = all.filter((n) => n.children.length === 0 && /\d/.test(n.textContent) && /^[\d\s$%.,:–\-ampmMonTueWedThuFriSatSunNovOctDecJanfbt]+$/.test(n.textContent.trim())).map((n) => getComputedStyle(n).fontVariantNumeric);
        return { type, id, name, w: Math.round(Math.max(r.width, labelBox.width)), h: Math.round(Math.max(r.height, labelBox.height)), texts, offGrid, badRadius, concentric, motion, literals: [...new Set(literals)],
          focusable, inlineInText, tag, role: e.getAttribute('role'), hasLive: !!(e.getAttribute('aria-live') || e.querySelector('[aria-live],[role=status]') || e.closest('[aria-live]')),
          scope: tag === 'table' ? [...e.querySelectorAll('th')].every((t) => t.getAttribute('scope')) : true, numeric: numericNodes,
          states: (e.dataset.states || '').split(/\s+/).filter(Boolean).map((s) => ({ s, ok: !!document.querySelector(`[data-state="${s}"][data-state-for="${e.id}"]`) })),
          dynamic: e.hasAttribute('data-dynamic'),
          imgAlt: tag === 'img' ? e.hasAttribute('alt') && e.hasAttribute('width') && e.hasAttribute('height') : true,
          right: r.right, left: r.left, scrollOver: e.scrollWidth > e.clientWidth + 1 && !['table'].includes(tag) && cs.overflowX === 'visible' };
      }, { RADII, EASES, MOTION_PROPS });

      const checks = [];
      const add = (k, ok, d = '') => checks.push({ k, ok, d });
      const isInter = INTERACTIVE.includes(info.type);
      // universal
      const lowC = info.texts.filter((t) => t.op > 0.99 && ratio(t.fg, t.bg) < ((t.fs >= 24 || (t.fs >= 18.66 && t.fw >= 700)) ? 3 : 4.5));
      add('contrast', !lowC.length, lowC.map((t) => `${t.t} ${ratio(t.fg, t.bg).toFixed(2)}`).join('; '));
      add('4px grid', !info.offGrid.length, info.offGrid.slice(0, 3).join(' '));
      add('radius scale', !info.badRadius.length, info.badRadius.join(','));
      add('concentric radius', !info.concentric.length, info.concentric.join(' '));
      add('motion rules', !info.motion.length, [...new Set(info.motion)].slice(0, 3).join(' '));
      add('tokens only', !info.literals.length, info.literals.slice(0, 2).join(' | '));
      add('fits viewport', info.left >= -1 && info.right <= w + 1 && !info.scrollOver);
      if (info.numeric.length) add('tabular figures', info.numeric.every((v) => /tabular-nums/.test(v)));
      // interactive
      if (isInter) {
        add('accessible name', !!info.name);
        add('keyboard focusable', info.focusable);
        add('target ≥24px', info.inlineInText || (info.w >= 24 && info.h >= 24), `${info.w}×${info.h}`);
        if (w < 600 && !info.inlineInText) add('touch target ≥44px', info.w >= 44 && info.h >= 44, `${info.w}×${info.h}`);
        const style = () => el.evaluate((e) => [e, ...(e.labels || [])].map((n) => { const s = getComputedStyle(n); return [s.outlineStyle, s.outlineWidth, s.boxShadow, s.backgroundColor, s.color, s.borderColor, s.textDecorationLine, s.textDecorationLine === 'none' ? '' : s.textDecorationThickness].join('|'); }).join('||'));
        await page.mouse.move(0, 0); await page.keyboard.press('Escape'); const base = await style();
        await page.keyboard.press('Shift'); await el.focus(); await page.waitForTimeout(250); const foc = await style(); await el.evaluate((e) => e.blur()); await page.waitForTimeout(250);
        add('focus visible', foc !== base);
        if (!(w < 600)) { await el.hover().catch(() => {}); await page.waitForTimeout(250); const hov = await style(); await page.mouse.move(0, 0); add('hover state', hov !== base); }
        if (['button', 'control'].includes(info.type)) {
          await el.focus();
          await el.evaluate(() => { window.__gateMut = false; const o = new MutationObserver(() => { window.__gateMut = true; o.disconnect(); }); o.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true }); });
          await page.keyboard.press('Enter'); await page.waitForTimeout(150);
          add('works by keyboard', info.tag === 'a' || await page.evaluate(() => window.__gateMut));
          if (info.tag === 'a') await page.goBack().catch(() => {});
          await page.goto(url); await page.waitForTimeout(300);
        }
      }
      // type-specific
      if (info.type === 'input') add('label, not just placeholder', !!info.name);
      if (info.type === 'button') add('height ≥32', info.h >= 32, `${info.h}`);
      if (info.type === 'table') add('header scope', info.scope);
      if (['table', 'list', 'chart'].includes(info.type) && info.dynamic) add('empty state exists', info.states.some((s) => s.s === 'empty' && s.ok), info.states.map((s) => s.s + (s.ok ? '' : ' missing')).join(','));
      if (info.type === 'status') add('announced (live region)', info.hasLive);
      if (info.type === 'image') add('alt + fixed size', info.imgAlt);
      if (info.type === 'nav') add('landmark', info.tag === 'nav' || info.role === 'navigation');

      const pass = checks.every((c) => c.ok); if (!pass) failed++;
      rows.push({ w, type: info.type, id: info.id, pass, fails: checks.filter((c) => !c.ok).map((c) => c.k + (c.d ? ` (${c.d})` : '')), n: checks.length });
    }
    await page.close();
  }
  await browser.close();
  const seen = new Set();
  for (const r of rows) { const key = r.w + r.type + r.id; if (seen.has(key)) continue; seen.add(key);
    console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${String(r.w).padEnd(5)} ${r.type.padEnd(8)} ${r.id.padEnd(32)} ${r.n - r.fails.length}/${r.n}${r.fails.length ? '  ✗ ' + r.fails.join('; ') : ''}`); }
  console.log(`\n${rows.length - failed}/${rows.length} component checks passed`);
  process.exit(failed ? 1 : 0);
})();
