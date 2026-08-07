export class SceneManager {
  constructor(logger = null) { this.current = null; this.overlays = []; this.logger = logger; }
  async change(scene, context = {}) { if (this.current) await this.current.exit?.(); this.current = scene; await scene.enter?.(context); }
  async pushOverlay(scene, context = {}) { this.current?.suspend?.(); this.overlays.push(scene); await scene.enter?.(context); }
  async popOverlay() { const scene = this.overlays.pop(); await scene?.exit?.(); if (!this.overlays.length) this.current?.resume?.(); }
}
