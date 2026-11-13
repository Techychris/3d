// Explicit state machines. A table names every state and the events it accepts: { state: { EVENT: "next" } }.
// A move that is not in the table is not legal, so the table is the whole machine and can be read in one place.

// Throws if a table sends an event to a state it does not define.
export function checkTable(table) {
  for (const [from, events] of Object.entries(table)) {
    for (const [ev, to] of Object.entries(events)) if (!table[to]) throw new Error(`fsm: ${from} --${ev}--> unknown state "${to}"`);
  }
  return table;
}

// A machine that owns its state. send(event) moves if the current state accepts the event and returns whether it did,
// so callers can use it as a guard. `time` is seconds spent in the current state (advanced by tick).
export function createMachine(table, initial, onChange) {
  checkTable(table);
  if (!table[initial]) throw new Error(`fsm: unknown initial state "${initial}"`);
  let state = initial, time = 0;
  return {
    get state() { return state; },
    get time() { return time; },
    is(...names) { return names.includes(state); },
    send(ev, payload) {
      const next = table[state][ev];
      if (next === undefined) return false;
      const prev = state;
      state = next; time = 0;
      if (onChange) onChange(next, prev, ev, payload);
      return true;
    },
    tick(dt) { time += dt; },
  };
}

// For plain objects that keep their state in obj.state (enemies, bosses, telegraphs): take the move or throw.
export function transition(table, obj, ev) {
  const next = table[obj.state][ev];
  if (next === undefined) throw new Error(`fsm: "${ev}" is not legal in state "${obj.state}"`);
  obj.state = next;
  return next;
}
