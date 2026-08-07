export class AudioManager {
  constructor(settingsManager = null) { this.settingsManager = settingsManager; this.buses = new Map([['MASTER',1],['MUSIC',.5],['UI',.8],['GAMEPLAY',.8],['CROWD',.65],['AMBIENT',.6],['VOICE',.8]]); }
  setBus(name, value) { this.buses.set(name, Math.max(0, Math.min(1, Number(value) || 0))); }
  getBus(name) { return this.buses.get(name) ?? 1; }
}
