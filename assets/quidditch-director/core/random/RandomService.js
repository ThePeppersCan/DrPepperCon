function hashSeed(value) {
  let h = 2166136261 >>> 0;
  const text = String(value);
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export class RandomService {
  rng(seed, stream = 'default') { return mulberry32(hashSeed(`${seed}:${stream}`)); }
  pick(seed, stream, items) {
    if (!items?.length) return undefined;
    const rng = this.rng(seed, stream);
    return items[Math.floor(rng() * items.length)];
  }
  shuffle(seed, stream, items) {
    const rng = this.rng(seed, stream), out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }
  createRunSeed() {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    // Seed creation is outside deterministic simulation; timestamp is acceptable here.
    return `qd-${Date.now().toString(36)}-${Math.floor(globalThis.performance?.now?.() || 0).toString(36)}`;
  }
}
