export class CardRegistry {
  constructor(cards) {
    this.all = Object.freeze(cards.map(c => Object.freeze({...c, tags:Object.freeze([...(c.tags||[])])})));
    this.byId = new Map(this.all.map(c => [c.id, c]));
    this.byType = this.#index('type');
    this.byRole = this.#index('role');
    this.byTag = new Map();
    for (const card of this.all) for (const tag of card.tags) {
      if (!this.byTag.has(tag)) this.byTag.set(tag, []);
      this.byTag.get(tag).push(card);
    }
  }
  #index(key) {
    const out = new Map();
    for (const item of this.all) {
      const value = item[key]; if (!out.has(value)) out.set(value, []); out.get(value).push(item);
    }
    return out;
  }
  get(id) { return this.byId.get(id); }
  has(id) { return this.byId.has(id); }
  withTag(tag) { return this.byTag.get(tag) || []; }
}
