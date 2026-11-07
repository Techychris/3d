// Tiny event bus. world.events.on(name, fn) returns an unsubscribe function.
export function createEvents() {
  const map = new Map();
  return {
    on(name, fn) {
      if (!map.has(name)) map.set(name, new Set());
      map.get(name).add(fn);
      return () => map.get(name).delete(fn);
    },
    emit(name, payload) {
      const s = map.get(name);
      if (s) for (const fn of [...s]) { try { fn(payload); } catch (e) { console.error(`event ${name}`, e); } }
    },
    clear() { map.clear(); },
  };
}
