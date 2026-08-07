export class SettingsManager {
  constructor(events) { this.events = events; this.defaults = {audio:true,screenShake:true,reducedMotion:false,uiScale:1,flashReduction:false,particleDensity:1}; }
  sanitize(settings) { return {...this.defaults, ...(settings || {})}; }
  set(target, key, value) { target[key] = value; this.events?.emit('SETTING_CHANGED', {key,value}); }
}
