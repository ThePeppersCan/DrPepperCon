export class WeatherManager {
  constructor(data, relicManager) { this.data = data; this.relicManager = relicManager; }
  definition(id) { return this.data.weathers.find(w => w.id === id) || this.data.weathers[0]; }
  rules(id) { return this.definition(id)?.rules || []; }
  effectiveSignedValue(run, rule, field) {
    const value=Number(rule[field]||0);
    return rule.invertible && this.relicManager.invertWeather(run) ? -value : value;
  }
  modifyImpact(run, match, tags, base, cardOrdinal, strength = 1) {
    for (const rule of this.rules(match.weatherId)) {
      if (rule.type==='tag_impact' && tags.includes(rule.tag)) base += this.effectiveSignedValue(run,rule,'amount') * strength;
      if (rule.type==='nth_card_impact' && cardOrdinal % Number(rule.every||1) === 0) base += this.effectiveSignedValue(run,rule,'amount') * strength;
    }
    return base;
  }
  modifyFlowOnCard(run, match, tags, addFlow) {
    for (const rule of this.rules(match.weatherId)) if (rule.type==='tag_flow' && tags.includes(rule.tag)) addFlow(this.effectiveSignedValue(run,rule,'amount'));
  }
  modifyStat(match, key, amount) {
    for (const rule of this.rules(match.weatherId)) {
      if (rule.type==='stat_multiplier' && rule.stat===key) amount *= Number(rule.factor||1);
      if (rule.type==='stat_multiplier_until_tag' && rule.stat===key && !match.flags[rule.flag]) amount *= Number(rule.factor||1);
    }
    return amount;
  }
  afterTags(match, tags) {
    for (const rule of this.rules(match.weatherId)) if (rule.type==='stat_multiplier_until_tag' && tags.includes(rule.untilTag)) match.flags[rule.flag]=true;
  }
  modifyCost(match, tags, cost, cardOrdinal) {
    for (const rule of this.rules(match.weatherId)) if (rule.type==='nth_card_cost' && cardOrdinal % Number(rule.every||1) === 0 && !tags.includes(rule.excludeTag)) cost += Number(rule.delta||0);
    return Math.max(0,cost);
  }
}
