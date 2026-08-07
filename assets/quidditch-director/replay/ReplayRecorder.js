export class ReplayRecorder {
  constructor() { this.reset(); }
  reset(seed = null, rulesVersion = null) { this.seed = seed; this.rulesVersion = rulesVersion; this.commands = []; this.startedAt = Date.now(); }
  record(type, payload = {}) { this.commands.push({sequence:this.commands.length + 1, type, payload:structuredCloneSafe(payload)}); }
  export() { return {schemaVersion:1, seed:this.seed, rulesVersion:this.rulesVersion, commands:structuredCloneSafe(this.commands)}; }
}
function structuredCloneSafe(value) { try { return structuredClone(value); } catch { return JSON.parse(JSON.stringify(value)); } }
