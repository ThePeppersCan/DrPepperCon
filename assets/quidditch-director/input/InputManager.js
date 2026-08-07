export class InputManager {
  constructor() { this.bindings = new Map(); this.listeners = new Map(); this.enabled = true; }
  bind(code, action) { this.bindings.set(code, action); }
  on(action, listener) { if (!this.listeners.has(action)) this.listeners.set(action, new Set()); this.listeners.get(action).add(listener); return () => this.listeners.get(action)?.delete(listener); }
  dispatch(action, payload) { if (!this.enabled) return; for (const fn of this.listeners.get(action) || []) fn(payload); }
  handleKeyboard(event) { const action = this.bindings.get(event.code) || this.bindings.get(event.key); if (action) this.dispatch(action, event); }
}
