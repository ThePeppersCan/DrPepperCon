export class EventDispatcher {
  constructor({historyLimit = 1000, logger = null} = {}) {
    this.listeners = new Map();
    this.history = [];
    this.sequence = 0;
    this.historyLimit = historyLimit;
    this.logger = logger;
  }
  on(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
    return () => this.off(type, listener);
  }
  off(type, listener) { this.listeners.get(type)?.delete(listener); }
  emit(type, payload = {}, meta = {}) {
    const event = Object.freeze({ sequence: ++this.sequence, at: Date.now(), type, payload, meta });
    this.history.push(event);
    if (this.history.length > this.historyLimit) this.history.shift();
    const targets = [...(this.listeners.get(type) || []), ...(this.listeners.get('*') || [])];
    for (const listener of targets) {
      try { listener(event); }
      catch (error) { this.logger?.error('EventDispatcher', `Listener failed for ${type}`, {error: String(error)}); }
    }
    return event;
  }
  recent(limit = 100) { return this.history.slice(-limit); }
  clearHistory() { this.history.length = 0; }
}
