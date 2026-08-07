import { CardRegistry } from '../core/cards/CardRegistry.js';
import { RelicRegistry } from '../core/relics/RelicRegistry.js';

function assert(condition, message) { if (!condition) throw new Error(message); }
function validateUnique(items, label) {
  const seen = new Set();
  for (const item of items) {
    assert(item && typeof item.id === 'string' && item.id.length, `${label}: missing id`);
    assert(!seen.has(item.id), `${label}: duplicate id ${item.id}`);
    seen.add(item.id);
  }
}
export class DataStore {
  constructor({cards, relics, opponents, weathers, events, config, achievements = []}) {
    validateUnique(cards, 'cards'); validateUnique(relics, 'relics'); validateUnique(opponents, 'opponents'); validateUnique(weathers, 'weathers'); validateUnique(events, 'events');
    for (const card of cards) {
      assert(typeof card.cost === 'number' && Number.isFinite(card.cost) && card.cost >= 0, `card ${card.id}: invalid cost`);
      assert(Array.isArray(card.tags), `card ${card.id}: tags must be an array`);
      assert(typeof card.image === 'string', `card ${card.id}: missing image`);
    }
    this.cards = cards;
    this.relics = relics;
    this.opponents = opponents;
    this.weathers = weathers;
    this.events = events;
    this.config = config;
    this.achievements = achievements;
    this.starterDeck = config.starterDeck;
    this.starterUnlocked = config.starterUnlocked;
    this.cardRegistry = new CardRegistry(cards);
    this.relicRegistry = new RelicRegistry(relics);
    this.cardById = Object.fromEntries(cards.map(c => [c.id, c]));
    this.relicById = Object.fromEntries(relics.map(r => [r.id, r]));
    Object.freeze(this);
  }
  compatibilityView() {
    return {
      cards:this.cards, relics:this.relics, opponents:this.opponents, weathers:this.weathers, events:this.events,
      starterDeck:this.starterDeck, starterUnlocked:this.starterUnlocked,
      cardById:this.cardById, relicById:this.relicById
    };
  }
}
export async function loadGameData({version = '20260807-gameplay3'} = {}) {
  const base = new URL('../data/', import.meta.url);
  const read = async name => {
    const response = await fetch(new URL(`${name}.json?v=${version}`, base), {cache:'no-cache'});
    if (!response.ok) throw new Error(`Failed to load Quidditch Director data/${name}.json (${response.status})`);
    return response.json();
  };
  const [cards,relics,opponents,weathers,events,config,achievements] = await Promise.all([
    read('cards'),read('relics'),read('opponents'),read('weathers'),read('events'),read('config'),read('achievements')
  ]);
  return new DataStore({cards,relics,opponents,weathers,events,config,achievements});
}
