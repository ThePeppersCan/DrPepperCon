export class MatchManager {
  constructor({data, random, events, effectQueue, cardEffects, relics, weather, ai, stateMachine, cardManager, comboEngine, logger = null} = {}) {
    Object.assign(this,{data,random,events,effectQueue,cardEffects,relics,weather,ai,stateMachine,cardManager,comboEngine,logger});
  }
  clone(v){return JSON.parse(JSON.stringify(v));}
  cardDef(inst){return this.data.cardById[inst?.id];}
  hasRelic(run,id){return this.relics.has(run,id);}
  weatherFor(run,week){
    if(run.flags.nextWeather){const w=this.data.weathers.find(x=>x.id===run.flags.nextWeather)||this.data.weathers[0];run.flags.nextWeather=null;return w;}
    const rng=this.random.rng(run.seed,`weather:${week}`), weighted=[this.data.weathers[0],...this.data.weathers];
    return weighted[Math.floor(rng()*weighted.length)];
  }
  startMatch(run){
    const opp=this.ai.opponent(run.schedule[run.week]), weather=this.weatherFor(run,run.week);
    const match={
      id:`${run.seed}:match:${run.week}`,opponentId:opp.id,weatherId:weather.id,possession:1,maxPossessions:5,playerScore:0,aiScore:Math.max(0,run.flags.nextMatchScoreDebt||0),
      playerGoals:0,aiGoals:0,snitchMeter:0,aiSnitch:0,snitchCaught:false,aiSnitchCaught:false,
      metrics:{momentum:0,control:0,style:0,fan:run.flags.nextMatchFan||0,snitch:0,goals:0,critical:0,comboBest:1},
      growth:{},drawPile:[],discard:[],hand:[],returnCard:null,tempo:4+(run.flags.nextMatchTempo||0),maxTempo:4+(run.flags.nextMatchTempo||0),
      mulliganUsed:false,flags:{},chain:[],lastPossession:null,log:[],intent:null,finished:false,won:false,rngCounter:0
    };
    run.flags.nextMatchScoreDebt=0;run.flags.nextMatchTempo=0;run.flags.nextMatchFan=0;
    match.drawPile=this.random.shuffle(run.seed,`matchdeck:${run.week}`,run.deck.map(c=>this.clone(c)));
    run.match=match; this.beginPossession(run,match); this.stateMachine.transition(run,'phase','match',{force:run.phase!=='hub'});
    this.events?.emit('MATCH_STARTED',{matchId:match.id,opponentId:opp.id,weatherId:weather.id,week:run.week});
    return match;
  }
  beginPossession(run,match){
    if(match.possession>1)this.cardManager.moveAll(match,'hand','discard');
    match.maxTempo=4;match.tempo=match.maxTempo;
    if(run.flags.nextMatchControlPenalty&&match.possession===1){match.metrics.control=Math.max(0,match.metrics.control-run.flags.nextMatchControlPenalty);run.flags.nextMatchControlPenalty=0;}
    match.mulliganUsed=false;match.chain=[];
    match.turn={impact:0,momentum:0,control:0,style:0,fan:0,snitchGain:0,goals:0,critical:0,flow:1,finalMultiplier:1,roles:[],played:[],floating:[],rawImpactSinceGoal:0};
    match.flags={resourceEcho:{},supportGrowth:0,returnLastCard:false,nextFree:false,nextFreeSourceUid:null,nextInheritedRole:null,nextInheritedRoleSourceUid:null,pressureDouble:false,snitchFrozen:false,burgerActive:false,firstBeaterSeen:false,firstTagRetrigger:null,nthTagRetriggers:[],nextTagRetriggers:[]};
    match.intent=this.ai.makeIntent(this.ai.opponent(match.opponentId),match.possession,run);
    const handSize=Math.max(3,5+this.relics.openingHandDelta(run)+(run.flags.nextHandBonus||0));
    if(match.possession===1)run.flags.nextHandBonus=0;
    if(match.returnCard){const uid=match.returnCard.uid;let r=null;for(const zone of ['discard','drawPile']){const idx=match[zone].findIndex(c=>c.uid===uid);if(idx>=0){[r]=match[zone].splice(idx,1);break;}}if(!r)r={...match.returnCard,uid:`${run.seed}:card:${run.instanceCounter++}`};r.tempFree=true;match.hand.push(r);match.returnCard=null;this.relics.onReturnedCard(run,match,this.#helpers(run,match));}
    this.drawCards(run,match,handSize-match.hand.length);
    this.events?.emit('POSSESSION_STARTED',{matchId:match.id,possession:match.possession,intent:match.intent});
  }
  ensureDraw(run,match){if(!match.drawPile.length&&match.discard.length){match.rngCounter++;match.drawPile=this.random.shuffle(run.seed,`reshuffle:${run.week}:${match.rngCounter}`,match.discard);match.discard=[];}}
  drawCards(run,match,n,filterFn=null){let safety=80;while(n>0&&safety-->0){this.ensureDraw(run,match);if(!match.drawPile.length)break;let idx=0;if(filterFn){idx=match.drawPile.findIndex(x=>filterFn(this.cardDef(x)));if(idx<0){filterFn=null;idx=0;}}this.cardManager.moveByIndex(match,'drawPile','hand',idx);n--;}}
  currentTags(run,match,def){return this.relics.augmentTags(run,match,[...def.tags]);}
  cardRole(def,tags){const ordered=['beater','flying','support','control','chaser','pass','trick','crowd','staff','equipment'];return ordered.find(t=>tags.includes(t))||String(def.role||def.type).toLowerCase();}
  roleForInstance(run,match,inst){const def=this.cardDef(inst);return def?this.cardRole(def,this.currentTags(run,match,def)):'';}
  effectiveCost(run,match,inst){
    const def=this.cardDef(inst);if(!def)return 99;if(inst.tempFree)return 0;
    const tags=this.currentTags(run,match,def);let cost=def.cost;
    if(match.flags.nextFree)cost=0;
    cost=this.relics.modifyCost(run,match,def,tags,cost);
    cost=this.weather.modifyCost(match,tags,cost,match.chain.length+1);
    return Math.max(0,cost);
  }
  addFlow(match,amount){const before=match.turn.flow;match.turn.flow=Math.max(.5,Math.min(12,match.turn.flow+amount));match.metrics.comboBest=Math.max(match.metrics.comboBest,match.turn.flow);if(match.turn.flow!==before)this.events?.emit('FLOW_CHANGED',{from:before,to:match.turn.flow,delta:match.turn.flow-before});}
  addStat(match,key,amount){
    if(!amount)return;amount=this.weather.modifyStat(match,key,amount);amount=Math.round(amount*100)/100;
    const echo=Number(match.flags.resourceEcho?.[key]||0);if(echo>0){const echoed=amount*echo;match.turn[key]=(match.turn[key]||0)+echoed;if(match.metrics[key]!=null)match.metrics[key]+=echoed;match.turn.floating.push({kind:'echo',text:`ECHO +${Math.round(echoed)} ${String(key).toUpperCase()}`});}
    match.turn[key]=(match.turn[key]||0)+amount;if(match.metrics[key]!=null)match.metrics[key]+=amount;
    if(key==='snitchGain'){match.snitchMeter=Math.max(0,Math.min(60,match.snitchMeter+amount));match.metrics.snitch+=amount;}
  }
  addImpact(match,amount){match.turn.impact+=amount;match.turn.rawImpactSinceGoal+=amount;}
  addGoal(run,match,n,sourceInst,reason='GOAL!'){
    n=Math.max(1,Math.floor(n));match.turn.goals+=n;match.metrics.goals+=n;match.playerGoals+=n;match.turn.floating.push({kind:'goal',text:`${reason} +${n}`});
    this.events?.emit('GOAL_SCORED',{matchId:match.id,count:n,sourceId:sourceInst?.id||null,reason});
    this.relics.onGoal(run,match,sourceInst,this.#helpers(run,match));
  }
  synergyBefore(match,def,tags){return this.comboEngine.evaluate(match,def,tags,this.cardRole(def,tags)).flowDelta;}
  activateCard(run,match,inst,strength=1,opts={}){
    const def=this.cardDef(inst);if(!def)return;
    return this.effectQueue.run(()=>this.#activateCard(run,match,inst,strength,opts),{source:def.id,reason:opts.reason||'card'});
  }
  #activateCard(run,match,inst,strength,opts){
    const def=this.cardDef(inst),tags=this.currentTags(run,match,def),role=this.cardRole(def,tags),prevDef=match.turn.played.length>1?this.cardDef(match.turn.played.at(-2)):null;
    let base=(16+(inst.upgrade||0)*8+(match.growth?.[inst.id]||0))*strength;
    base=this.weather.modifyImpact(run,match,tags,base,match.chain.length+1,strength);this.weather.modifyFlowOnCard(run,match,tags,a=>this.addFlow(match,a*strength));base=Math.max(0,base);this.addImpact(match,base);
    if(!opts.noChain){const bonus=this.synergyBefore(match,def,tags);if(bonus)this.addFlow(match,bonus);match.chain.push({id:def.id,name:def.name,role,tags:[...tags]});match.turn.roles.push(role);}
    match.turn.floating.push({kind:opts.echo?'echo':'card',text:`${opts.echo?'↻ ':''}${def.name}${strength<1?` ${Math.round(strength*100)}%`:''}${opts.reason?` · ${opts.reason}`:''}`});
    const helpers=this.#helpers(run,match);
    this.cardEffects.resolve(def.effects||[],{run,match,inst,def,tags,prevDef,strength,opts,helpers});

    if(tags.includes('support')&&Number(match.flags.supportGrowth||0)>0&&!opts.echo){match.growth[inst.id]=(match.growth[inst.id]||0)+Number(match.flags.supportGrowth);match.turn.floating.push({kind:'upgrade',text:`SUPPORT GROWS · ${def.name.toUpperCase()}`});}
    if(tags.includes('momentum'))this.addStat(match,'momentum',3*strength);
    if(tags.includes('control'))this.addStat(match,'control',3*strength);
    if(tags.includes('style')||tags.includes('trick'))this.addStat(match,'style',3*strength);
    if(tags.includes('crowd'))this.addStat(match,'fan',3*strength);
    this.weather.afterTags(match,tags);

    if(tags.includes('flying')){this.addStat(match,'snitchGain',2*strength);match.metrics.flying=(match.metrics.flying||0)+1;}
    if(tags.includes('beater')){let pressure=5;if(match.flags.pressureDouble){pressure*=2;match.flags.pressureDouble=false;}this.addStat(match,'pressure',pressure*strength);}

    if(!opts.echo){
      for(const rule of match.flags.nthTagRetriggers||[])if(tags.includes(rule.tag)){rule.count=(rule.count||0)+1;if(rule.count%rule.every===0)this.activateCard(run,match,inst,rule.strength,{echo:true,noChain:true,reason:rule.reason});}
      const first=match.flags.firstTagRetrigger;if(first&&!first.consumed&&tags.includes(first.tag)&&inst.uid!==first.sourceUid){first.consumed=true;match.flags.firstBeaterSeen=true;this.activateCard(run,match,inst,first.otherStrength,{echo:true,noChain:true,reason:'FIRST TAG RETRIGGER'});}
      for(const rule of [...(match.flags.nextTagRetriggers||[])])if(tags.includes(rule.tag)&&inst.uid!==rule.sourceUid){match.flags.nextTagRetriggers.splice(match.flags.nextTagRetriggers.indexOf(rule),1);this.activateCard(run,match,inst,rule.strength,{echo:true,noChain:true,reason:rule.reason});}
    }
    if(match.flags.nextInheritedRole&&inst.uid!==match.flags.nextInheritedRoleSourceUid&&!opts.echo){const inherited=match.flags.nextInheritedRole;if(!match.turn.roles.includes(inherited))match.turn.roles.push(inherited);match.turn.floating.push({kind:'patch',text:`PATCHED AS ${inherited.toUpperCase()}`});match.flags.nextInheritedRole=null;match.flags.nextInheritedRoleSourceUid=null;}
    this.relics.afterCardActivated(run,match,inst,helpers,opts);
  }
  #helpers(run,match){return{
    addFlow:a=>this.addFlow(match,a),addStat:(k,a)=>this.addStat(match,k,a),addGoal:(n,src,reason)=>this.addGoal(run,match,n,src,reason),
    draw:(n,tag)=>this.drawCards(run,match,n,tag?d=>d.tags.includes(tag):null),activateCard:(inst,s,o)=>this.activateCard(run,match,inst,s,o),
    cardDef:i=>this.cardDef(i),roleForInstance:i=>this.roleForInstance(run,match,i),effectiveCost:i=>this.effectiveCost(run,match,i),
    upgradeRandom:(n=1)=>{const rng=this.random.rng(run.seed,`practice:${run.week}:${match.possession}:${match.rngCounter++}`);for(let i=0;i<n&&run.deck.length;i++){const target=run.deck[Math.floor(rng()*run.deck.length)];target.upgrade=(target.upgrade||0)+1;match.turn.floating.push({kind:'upgrade',text:`${this.cardDef(target).name} UPGRADED`});}},
    redrawHand:(free)=>{const n=match.hand.length;this.cardManager.moveAll(match,'hand','discard');this.drawCards(run,match,n);if(free&&match.hand.length){const cheapest=[...match.hand].sort((a,b)=>this.effectiveCost(run,match,a)-this.effectiveCost(run,match,b))[0];cheapest.tempFree=true;}}
  };}
  playCard(run,handIndex){
    const match=run.match;if(!match||match.finished)return{ok:false,reason:'Match is over.'};const inst=match.hand[handIndex];if(!inst)return{ok:false,reason:'No card there.'};const def=this.cardDef(inst);let cost=this.effectiveCost(run,match,inst);if(inst.costDown)cost=Math.max(0,cost-inst.costDown);if(cost>match.tempo)return{ok:false,reason:`Need ${cost} Tempo.`};
    const tags=this.currentTags(run,match,def);match.hand.splice(handIndex,1);match.tempo-=cost;if(inst.tempFree)delete inst.tempFree;if(inst.costDown)delete inst.costDown;
    if(match.flags.nextFree&&inst.uid!==match.flags.nextFreeSourceUid){match.flags.nextFree=false;match.flags.nextFreeSourceUid=null;}
    this.relics.afterCostPaid(run,match,tags);match.turn.played.push(inst);this.activateCard(run,match,inst,1,{});this.relics.afterCardPlayed(run,match,inst,this.#helpers(run,match));match.discard.push(inst);this.cardManager.assertUnique(match);
    this.events?.emit('CARD_PLAYED',{matchId:match.id,cardId:def.id,instanceId:inst.uid,cost,flow:match.turn.flow,tempoRemaining:match.tempo});
    return{ok:true,cost,def,events:match.turn.floating.splice(0)};
  }
  endPossession(run){
    const match=run.match;if(!match||match.finished)return null;const t=match.turn;
    if(match.flags.burgerActive&&match.tempo===0){this.addFlow(match,.20);run.flags.burgers=(run.flags.burgers||0)+1;if(run.flags.burgers>=3){run.flags.burgers=0;this.addGoal(run,match,1,t.played.at(-1),'BURGER HAT-TRICK');}}
    this.relics.beforePossessionScore(run,match);
    if(match.playerScore<match.aiScore&&match.aiScore-match.playerScore>=45){this.addFlow(match,.15);t.critical+=1;match.metrics.critical+=1;}
    const raw=Math.max(0,t.impact+t.momentum*4.5+t.control*3+t.style*3.2+t.fan*2.2+match.snitchMeter*1.1+t.goals*65+t.critical*24+(t.pressure||0)*2.2);
    const performance=Math.max(1,Math.round(raw*t.flow*t.finalMultiplier)),ai=this.ai.possessionScore(run,match);match.playerScore+=performance;match.aiScore+=ai.score;match.metrics.comboBest=Math.max(match.metrics.comboBest,t.flow);
    const lastPlayed=t.played.at(-1);if(match.flags.returnLastCard&&lastPlayed){match.returnCard={uid:lastPlayed.uid,id:lastPlayed.id,upgrade:lastPlayed.upgrade||0,tempFree:true};}
    if(!match.flags.snitchFrozen&&match.possession<match.maxPossessions)match.snitchMeter=Math.max(0,match.snitchMeter-2);
    const summary={possession:match.possession,player:performance,ai:ai.score,raw,flow:t.flow,mult:t.finalMultiplier,goals:t.goals,counter:ai.counter,big:performance>=450||t.flow>=3.5||t.goals>=2};match.lastPossession=summary;match.log.push(summary);
    this.events?.emit('POSSESSION_ENDED',{matchId:match.id,...summary});
    if(match.possession>=match.maxPossessions){match.finished=true;match.won=match.playerScore>=match.aiScore;return{...summary,matchEnded:true};}
    match.possession++;this.effectQueue.reset();this.beginPossession(run,match);return summary;
  }
  mulligan(run){const m=run.match;if(!m||m.finished||m.mulliganUsed)return{ok:false,reason:'Tactical Reset already used.'};if(m.tempo<1)return{ok:false,reason:'Need 1 Tempo.'};m.tempo--;m.mulliganUsed=true;const n=m.hand.length;this.cardManager.moveAll(m,'hand','discard');this.drawCards(run,m,n);this.events?.emit('MULLIGAN_USED',{matchId:m.id,possession:m.possession});return{ok:true};}
}
