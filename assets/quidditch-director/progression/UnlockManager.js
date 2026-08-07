export class UnlockManager {
  constructor(data) { this.data = data; }
  cardAvailable(profile, id) { return !!this.data.cardById[id] && (profile.unlockedCards || []).includes(id); }
  relicAvailable(profile, id) { return !!this.data.relicById[id] && (profile.unlockedRelics || []).includes(id); }
}
