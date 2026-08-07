export class RelicManager {
  constructor(data, events = null) { this.data = data; this.events = events; }
  definitions(run) { return (run.relics || []).map(id => this.data.relicById[id]).filter(Boolean); }
  has(run, id) { return (run.relics || []).includes(id); }
  rules(run, type) { return this.definitions(run).map(r => ({relic:r, rule:r.rule})).filter(x => x.rule?.type === type); }
  openingHandDelta(run) { return this.rules(run,'first_tag_free').reduce((n,x)=>n+Number(x.rule.openingHandDelta||0),0); }
  invertWeather(run) { return this.rules(run,'invert_weather').length > 0; }
  augmentTags(run, match, tags) {
    const out = [...tags];
    for (const {rule} of this.rules(run,'flow_tags')) for (const threshold of rule.thresholds || []) {
      if (match.turn.flow >= threshold.flow && !out.includes(threshold.tag)) out.push(threshold.tag);
    }
    return out;
  }
  modifyCost(run, match, def, tags, cost) {
    for (const {rule} of this.rules(run,'first_tag_free')) {
      const flag = `relic:firstTagFree:${rule.tag}`;
      if (tags.includes(rule.tag) && !match.flags[flag]) cost = 0;
    }
    for (const {rule} of this.rules(run,'possession_cost_curve')) {
      if (match.possession === 1) cost += Number(rule.firstDelta || 0);
      else {
        const usedKey='relic:possessionCostCurveUses';
        if ((match.flags[usedKey] || 0) < Number(rule.laterUses || 0)) cost = Math.max(0,cost + Number(rule.laterDelta || 0));
      }
    }
    return Math.max(0,cost);
  }
  afterCostPaid(run, match, tags) {
    for (const {rule} of this.rules(run,'first_tag_free')) {
      const flag = `relic:firstTagFree:${rule.tag}`;
      if (tags.includes(rule.tag) && !match.flags[flag]) match.flags[flag] = true;
    }
    for (const {rule} of this.rules(run,'possession_cost_curve')) {
      if (match.possession > 1) {
        const key='relic:possessionCostCurveUses';
        if ((match.flags[key] || 0) < Number(rule.laterUses || 0)) match.flags[key] = (match.flags[key] || 0) + 1;
      }
    }
  }
  onReturnedCard(run, match, helpers) {
    for (const {relic,rule} of this.rules(run,'on_return')) {
      helpers.addFlow(Number(rule.flow || 0)); helpers.addStat('fan', Number(rule.fan || 0));
      this.events?.emit('RELIC_TRIGGERED',{id:relic.id,reason:'card_returned'});
    }
  }
  onGoal(run, match, sourceInst, helpers) {
    for (const {relic,rule} of this.rules(run,'first_goal_echo')) {
      const key=`relic:firstGoalEcho:${relic.id}`;
      if (!match.flags[key] && sourceInst) {
        match.flags[key]=true;
        helpers.activateCard(sourceInst, Number(rule.strength || 0), {echo:true,noChain:true,reason:relic.name.toUpperCase()});
        this.events?.emit('RELIC_TRIGGERED',{id:relic.id,reason:'goal'});
      }
    }
  }
  afterCardActivated(run, match, inst, helpers, opts) {
    for (const {relic,rule} of this.rules(run,'impact_goal_threshold')) {
      const threshold=Number(rule.threshold||220);
      if (match.turn.rawImpactSinceGoal >= threshold) {
        match.turn.rawImpactSinceGoal -= threshold;
        helpers.addGoal(Number(rule.goalCount||1),inst,relic.name.toUpperCase());
        if (rule.resetFlow != null) match.turn.flow = Number(rule.resetFlow);
        this.events?.emit('RELIC_TRIGGERED',{id:relic.id,reason:'impact_threshold'});
      }
    }
    for (const {relic,rule} of this.rules(run,'unique_roles_retrigger')) {
      if (opts.echo) continue;
      const count=Number(rule.count||3);
      if (match.turn.roles.length >= count) {
        const last=match.turn.roles.slice(-count);
        if (new Set(last).size === count) {
          helpers.activateCard(inst,Number(rule.strength||.5),{echo:true,noChain:true,reason:relic.name.toUpperCase()});
          this.events?.emit('RELIC_TRIGGERED',{id:relic.id,reason:'role_sequence'});
        }
      }
    }
  }
  afterCardPlayed(run, match, inst, helpers) {
    // Legacy support for pre-balance saves/data.
    for (const {relic,rule} of this.rules(run,'first_card_echo')) {
      const key=`relic:firstCardEcho:${relic.id}`;
      if (!match.flags[key]) {
        match.flags[key]=true;
        helpers.activateCard(inst,Number(rule.strength||.45),{echo:true,noChain:true,reason:relic.name.toUpperCase()});
        this.events?.emit('RELIC_TRIGGERED',{id:relic.id,reason:'first_card'});
      }
    }
    // Golden Whistle: powerful only when the player chooses to answer pressure.
    for (const {relic,rule} of this.rules(run,'first_threat_echo')) {
      const key=`relic:firstThreatEcho:${relic.id}`;
      if(match.flags[key])continue;
      const laneId=match.chain.at(-1)?.laneId;
      if(laneId&&match.board?.opponent?.[laneId]?.active){
        match.flags[key]=true;
        helpers.activateCard(inst,Number(rule.strength||.40),{echo:true,noChain:true,reason:relic.name.toUpperCase()});
        this.events?.emit('RELIC_TRIGGERED',{id:relic.id,reason:'answered_threat'});
      }
    }
  }
  beforePossessionScore(run, match) {
    for (const {relic,rule} of this.rules(run,'exact_tempo_multiplier')) {
      if (match.tempo === 0) {
        match.turn.finalMultiplier *= Number(rule.factor || 1);
        this.events?.emit('RELIC_TRIGGERED',{id:relic.id,reason:'exact_tempo'});
      }
    }
    // Tip Jar now creates tension with Morale: bank exactly one Energy for Momentum.
    for(const {relic,rule} of this.rules(run,'exact_tempo_bank')){
      const target=Number(rule.target??rule.tempo??1);
      if(match.tempo===target){
        const cap=Number(this.data.config?.tacticalBoard?.maxMomentum||6),amount=Math.max(1,Number(rule.momentum||1));
        const before=Number(match.resources?.momentum||0);match.resources.momentum=Math.min(cap,before+amount);
        if(match.resources.momentum>before){match.turn.floating.push({kind:'good',text:`${relic.name.toUpperCase()} · +${match.resources.momentum-before} MOMENTUM`});this.events?.emit('RELIC_TRIGGERED',{id:relic.id,reason:'exact_tempo_bank'});}
      }
    }
  }
}
