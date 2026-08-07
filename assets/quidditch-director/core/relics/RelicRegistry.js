export class RelicRegistry {
  constructor(relics) {
    this.all = Object.freeze(relics.map(r => Object.freeze({...r})));
    this.byId = new Map(this.all.map(r => [r.id, r]));
  }
  get(id) { return this.byId.get(id); }
  has(id) { return this.byId.has(id); }
}
