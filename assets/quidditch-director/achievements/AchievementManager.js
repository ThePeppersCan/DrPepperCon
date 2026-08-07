export class AchievementManager {
  constructor(events, definitions = []) {
    this.definitions = definitions;
    this.unlocked = new Set();
    this.progress = new Map();
    events.on('*', event => this.evaluate(event));
  }
  evaluate(event) {
    for (const achievement of this.definitions) {
      if (this.unlocked.has(achievement.id)) continue;
      const trigger = achievement.trigger;
      if (!trigger || trigger.event !== event.type) continue;
      const value = Number(event.payload?.[trigger.field] ?? 0);
      const ok = trigger.operator === '>=' ? value >= trigger.value : trigger.operator === '==' ? value === trigger.value : false;
      if (ok) this.unlocked.add(achievement.id);
    }
  }
  snapshot() { return [...this.unlocked]; }
}
