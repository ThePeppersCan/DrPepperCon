export class ThemeManager {
  constructor(root = globalThis.document?.documentElement || null) { this.root = root; this.current = 'default'; }
  apply(name, tokens = {}) { this.current = name; if(!this.root)return; for (const [key,value] of Object.entries(tokens)) this.root.style.setProperty(`--qd-${key}`, String(value)); }
}
