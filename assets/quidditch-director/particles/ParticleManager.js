export class ParticleManager {
  constructor() { this.active = new Set(); this.pool = []; }
  acquire(factory) { const particle = this.pool.pop() || factory(); this.active.add(particle); return particle; }
  release(particle) { if (!this.active.delete(particle)) return; this.pool.push(particle); }
  clear() { for (const p of this.active) this.pool.push(p); this.active.clear(); }
}
