export class DeveloperConsole {
  constructor({logger, events, statistics, effectQueue, data} = {}) {
    this.logger = logger; this.events = events; this.statistics = statistics; this.effectQueue = effectQueue; this.data = data; this.commands = new Map(); this.stateProvider = null;
    this.register('help', () => [...this.commands.keys()].sort());
    this.register('events', () => events?.recent(50));
    this.register('stats', () => statistics?.snapshot());
    this.register('effects', () => effectQueue?.snapshot());
    this.register('cards', () => data?.cards.map(c => ({id:c.id,name:c.name,cost:c.cost,type:c.type,role:c.role})));
  }
  register(name, handler) { this.commands.set(String(name).toLowerCase(), handler); }
  setStateProvider(provider) { this.stateProvider = provider; this.register('state', () => provider?.()); }
  run(input, ...args) {
    const name = String(input || '').trim().toLowerCase();
    const handler = this.commands.get(name);
    if (!handler) return {error:`Unknown command: ${name}`, available:[...this.commands.keys()]};
    try { return handler(...args); } catch (error) { this.logger?.error('DeveloperConsole','Command failed',{name,error:String(error)}); return {error:String(error)}; }
  }
}
