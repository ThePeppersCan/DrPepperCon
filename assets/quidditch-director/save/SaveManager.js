function keyFor(baseKey, manager) { return `${baseKey}:${String(manager || 'guest').toLowerCase().replace(/[^a-z0-9_-]/g,'_')}`; }
export class SaveManager {
  constructor({baseKey, profileFactory, profileSanitizer, table = 'quidditch_director_profiles', logger = null} = {}) {
    this.baseKey = baseKey;
    this.profileFactory = profileFactory;
    this.profileSanitizer = profileSanitizer;
    this.table = table;
    this.logger = logger;
    this.cloudClient = null;
  }
  setCloudClient(client) { this.cloudClient = client || null; }
  loadLocal(manager) {
    let profile = this.profileFactory(), run = null;
    try {
      const raw = JSON.parse(localStorage.getItem(keyFor(this.baseKey, manager)) || 'null');
      if (raw) profile = this.profileSanitizer(this.migrateProfile(raw));
      run = profile.activeRun || null;
    } catch (error) { this.logger?.warn('SaveManager','Local load failed',{error:String(error)}); }
    return {profile, run};
  }
  saveLocal(manager, profile, run) {
    profile.updatedAt = Date.now();
    profile.activeRun = run;
    try { localStorage.setItem(keyFor(this.baseKey, manager), JSON.stringify(profile)); return true; }
    catch (error) { this.logger?.error('SaveManager','Local save failed',{error:String(error)}); return false; }
  }
  migrateProfile(raw) {
    const profile = {...raw};
    const version = Number(profile.version || profile.schemaVersion || 1);
    if (version < 2) {
      profile.version = 2;
      profile.schemaVersion = 2;
      profile.settings = {audio:true,screenShake:true,reducedMotion:false,uiScale:1,flashReduction:false,particleDensity:1,...(profile.settings||{})};
      profile.stats = profile.stats || {};
      profile.achievements = Array.isArray(profile.achievements) ? profile.achievements : [];
    }
    return profile;
  }
  async loadCloud(profile, run) {
    try {
      const db = this.cloudClient;
      if (!db) return {profile,run,available:false};
      const {data:{user}} = await db.auth.getUser(); if (!user) return {profile,run,available:true};
      const {data,error} = await db.from(this.table).select('profile,updated_at').eq('user_id',user.id).maybeSingle();
      if (error) return {profile,run,available:false,error};
      if (data?.profile && Number(data.profile.updatedAt || 0) > Number(profile.updatedAt || 0)) {
        profile = this.profileSanitizer(this.migrateProfile(data.profile));
        run = profile.activeRun || null;
      }
      return {profile,run,available:true};
    } catch (error) { this.logger?.warn('SaveManager','Cloud load failed',{error:String(error)}); return {profile,run,available:false,error}; }
  }
  async saveCloud(profile, run) {
    try {
      const db = this.cloudClient; if (!db || !globalThis.character) return {available:false};
      const {data:{user}} = await db.auth.getUser(); if (!user) return {available:true};
      profile.activeRun = run; profile.updatedAt = Date.now();
      const {error} = await db.from(this.table).upsert({user_id:user.id,profile,updated_at:new Date().toISOString()},{onConflict:'user_id'});
      return {available:!error,error};
    } catch (error) { this.logger?.warn('SaveManager','Cloud save failed',{error:String(error)}); return {available:false,error}; }
  }
}
