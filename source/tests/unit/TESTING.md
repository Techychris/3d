# Unit test rules (Dusk Isles)

Runner: Node 22 built-in `node:test` + `node:assert/strict`. No other test framework. jsdom is installed for DOM modules.

- Put tests in `tests/unit/<module>.test.mjs`. Do NOT edit anything under `src/`. If code looks unreachable or buggy, write it in your report instead of changing it.
- Import helpers from `./helpers.mjs`: `makeWorld({items, withPlayer})`, `spy(impl)`, `step(world, seconds, dt, extra)`, `installDom()` (call `dom.cleanup()` after).
- Every test must assert behaviour: return values, state changes, emitted events (`world.events.on(...)`), stub calls (`world.audio.play.calls`). A test that only executes code without asserting is not acceptable.
- Deterministic: never rely on `Math.random` or wall-clock time. Stub them with `mock.method(Math, "random", () => 0.5)` from `node:test` when the code under test uses them.
- Keep each file fast (under 5 s).
- Target: 100% lines, 100% branches, 100% functions on your assigned files. Check with:

      cd /home/claude/game
      node --test --experimental-test-coverage --test-coverage-include="src/path/a.js" --test-coverage-include="src/path/b.js" tests/unit/a.test.mjs tests/unit/b.test.mjs

  Read the "uncovered lines" column and add tests until it is empty.
- Run `npm test` at the end to make sure the whole suite still passes.
- No git. No scheduling, reminders, send_later, cron or triggers of any kind. No new npm packages.
