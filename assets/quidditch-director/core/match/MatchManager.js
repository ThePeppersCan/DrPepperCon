export class MatchManager {
  constructor({data, random, events, effectQueue, cardEffects, relics, weather, ai, stateMachine, cardManager, comboEngine, tacticalBoard, logger = null} = {}) {
    Object.assign(this,{data,random,events,effectQueue,cardEffects,relics,weather,ai,stateMachine,cardManager,comboEngine,tacticalBoard,logger});
  }
  clone(v){return JSON.parse(JSON.stringify(v));}
  cardDef(inst){return this.data.cardById[inst?.id];}
  hasRelic(run,id){return this.relics.has(run,id);}
  weatherFor(run,week){
    // First-time onboarding reveals weather only after the player understands the board.
    if(run.flags?.tutorialRun&&week<3)return this.data.weathers.find(x=>x.id==='clear')||this.data.weathers[0];
    if(run.flags.nextWeather){const w=this.data.weathers.find(x=>x.id===run.flags.nextWeather)||this.data.weathers[0];run.flags.nextWeather=null;return w;}
    const rng=this.random.rng(run.seed,`weather:${week}`),weighted=[this.data.weathers[0],...this.data.weathers];
    return weighted[Math.floor(rng()*weighted.length)];
  }
  ensureMatchShape(run,match){
    if(!match)return null;
    const number=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
    match.possession=Math.max(1,Math.min(5,Math.floor(number(match.possession,1))));
    match.maxPossessions=Math.max(match.possession,Math.floor(number(match.maxPossessions,5)));
    match.playerScore=Math.max(0,number(match.playerScore,0));match.aiScore=Math.max(0,number(match.aiScore,0));
    match.playerGoals=Math.max(0,number(match.playerGoals,0));match.aiGoals=Math.max(0,number(match.aiGoals,0));
    match.maxTempo=Math.max(1,number(match.maxTempo,4));match.tempo=Math.max(0,Math.min(match.maxTempo,number(match.tempo,match.maxTempo)));
    match.resources=match.resources||{momentum:0,morale:3};
    match.resources.momentum=Math.max(0,Math.min(6,number(match.resources.momentum,0)));
    match.resources.morale=Math.max(0,Math.min(6,number(match.resources.morale,3)));
    match.metrics=match.metrics||{};for(const k of ['momentum','control','style','fan','snitch','goals','critical','flying'])match.metrics[k]=number(match.metrics[k],0);match.metrics.comboBest=Math.max(.6,number(match.metrics.comboBest,1));
    match.growth=match.growth||{};match.flags=match.flags||{};
    match.chain=Array.isArray(match.chain)?match.chain:[];match.hand=Array.isArray(match.hand)?match.hand:[];match.drawPile=Array.isArray(match.drawPile)?match.drawPile:[];match.discard=Array.isArray(match.discard)?match.discard:[];match.log=Array.isArray(match.log)?match.log:[];match.lastPlayedUids=Array.isArray(match.lastPlayedUids)?match.lastPlayedUids:[];
    match.snitchMeter=Math.max(0,Math.min(120,number(match.snitchMeter,0)));match.aiSnitch=Math.max(0,Math.min(120,number(match.aiSnitch,0)));
    match.snitchCaught=Boolean(match.snitchCaught);match.aiSnitchCaught=Boolean(match.aiSnitchCaught);match.snitchBonusClaimed=Boolean(match.snitchBonusClaimed);
    match.learningStage=Math.max(1,Math.min(5,number(match.learningStage,run.week+1)));
    match.fatigueEnabled=match.fatigueEnabled??(run.week>=2);
    this.tacticalBoard.normalizeBoard(match);
    // Older pre-board saves have no revealed opponent commitments. Rebuild only when every
    // lane is empty so a legitimate in-progress board is never overwritten on refresh.
    if(!match.intent)match.intent=this.ai.makeIntent(this.ai.opponent(match.opponentId),match.possession,run);
    const hasOpponentCommitment=Object.values(match.board.opponent||{}).some(x=>x&&Number(x.power||0)>0);
    if(!hasOpponentCommitment)match.board.opponent=this.ai.makeBoard(this.ai.opponent(match.opponentId),match.possession,run,match);
    if(!match.turn)this.#resetTurn(run,match);
    const turnDefaults={impact:0,momentum:0,control:0,style:0,fan:0,snitchGain:0,goals:0,critical:0,pressure:0,flow:1,finalMultiplier:1,rawImpactSinceGoal:0,slotsUsed:0};
    for(const [key,fallback] of Object.entries(turnDefaults))match.turn[key]=number(match.turn[key],fallback);
    match.turn.flow=Math.max(.6,Math.min(5,match.turn.flow));match.turn.finalMultiplier=Math.max(.1,match.turn.finalMultiplier);
    match.turn.slotsUsed=Math.max(0,Math.floor(match.turn.slotsUsed));match.turn.surgeUsed=Boolean(match.turn.surgeUsed);
    match.turn.roles=Array.isArray(match.turn.roles)?match.turn.roles:[];match.turn.played=Array.isArray(match.turn.played)?match.turn.played:[];match.turn.floating=Array.isArray(match.turn.floating)?match.turn.floating:[];match.turn.comboHits=Array.isArray(match.turn.comboHits)?match.turn.comboHits:[];
    // Trust the board if an older save did not record slotsUsed.
    const occupied=Object.values(match.board.player||{}).filter(Boolean).length;match.turn.slotsUsed=Math.max(match.turn.slotsUsed,occupied);
    match.slotLimit=Math.max(1,number(match.slotLimit,match.possession===1?2:3));
    return match;
  }
  startMatch(run){
    const opp=this.ai.opponent(run.schedule[run.week]),weather=this.weatherFor(run,run.week);
    const match={
      id:`${run.seed}:match:${run.week}`,opponentId:opp.id,weatherId:weather.id,possession:1,maxPossessions:5,playerScore:0,aiScore:Math.max(0,run.flags.nextMatchScoreDebt||0),
      playerGoals:0,aiGoals:0,snitchMeter:0,aiSnitch:0,snitchCaught:false,aiSnitchCaught:false,snitchBonusClaimed:false,
      metrics:{momentum:0,control:0,style:0,fan:run.flags.nextMatchFan||0,snitch:0,goals:0,critical:0,comboBest:1},
      resources:{momentum:0,morale:3},growth:{},drawPile:[],discard:[],hand:[],returnCard:null,tempo:4,maxTempo:4,
      mulliganUsed:false,flags:{},chain:[],lastPossession:null,lastPlayedUids:[],log:[],intent:null,finished:false,won:false,rngCounter:0,
      learningStage:Math.max(1,Math.min(5,run.week+1)),fatigueEnabled:run.week>=2,slotLimit:2,board:{player:this.tacticalBoard.createEmptyPlayer(),opponent:{}},feed:[]
    };
    run.flags.nextMatchScoreDebt=0;run.flags.nextMatchTempo=0;run.flags.nextMatchFan=0;
    match.drawPile=this.random.shuffle(run.seed,`matchdeck:${run.week}`,run.deck.map(c=>this.clone(c)));
    run.match=match;this.beginPossession(run,match);this.stateMachine.transition(run,'phase','match',{force:run.phase!=='hub'});
    this.events?.emit('MATCH_STARTED',{matchId:match.id,opponentId:opp.id,weatherId:weather.id,week:run.week});
    return match;
  }
  #resetTurn(run,match){
    match.turn={impact:0,momentum:0,control:0,style:0,fan:0,snitchGain:0,goals:0,critical:0,pressure:0,flow:1,finalMultiplier:1,roles:[],played:[],floating:[],rawImpactSinceGoal:0,comboHits:[],surgeUsed:false,slotsUsed:0};
  }
  #decayFatigue(match){
    if(!match.fatigueEnabled)return;
    const last=new Set(match.lastPlayedUids||[]),seen=new Set();
    for(const zone of ['drawPile','discard','hand'])for(const inst of match[zone]||[]){if(!inst||seen.has(inst.uid))continue;seen.add(inst.uid);if(!last.has(inst.uid)&&Number(inst.fatigue||0)>0)inst.fatigue=Math.max(0,Number(inst.fatigue)-1);}
  }
  beginPossession(run,match){
    this.ensureMatchShape(run,match);
    if(match.possession>1)this.cardManager.moveAll(match,'hand','discard');
    this.#decayFatigue(match);
    match.maxTempo=4;match.tempo=match.maxTempo;match.slotLimit=match.possession===1?2:3;
    if(run.flags.nextMatchControlPenalty&&match.possession===1){match.metrics.control=Math.max(0,match.metrics.control-run.flags.nextMatchControlPenalty);run.flags.nextMatchControlPenalty=0;}
    match.mulliganUsed=false;match.chain=[];match.board.player=this.tacticalBoard.createEmptyPlayer();
    this.#resetTurn(run,match);
    match.flags={resourceEcho:{},supportGrowth:0,returnLastCard:false,nextFree:false,nextFreeSourceUid:null,nextInheritedRole:null,nextInheritedRoleSourceUid:null,pressureDouble:false,snitchFrozen:false,burgerActive:false,firstBeaterSeen:false,firstTagRetrigger:null,nthTagRetriggers:[],nextTagRetriggers:[]};
    match.intent=this.ai.makeIntent(this.ai.opponent(match.opponentId),match.possession,run);
    match.board.opponent=this.ai.makeBoard(this.ai.opponent(match.opponentId),match.possession,run,match);
    const moraleHand=match.resources.morale>=5?1:0,baseHand=run.flags?.tutorialRun&&run.week===0?4:5,handSize=Math.max(3,baseHand+moraleHand+this.relics.openingHandDelta(run)+(run.flags.nextHandBonus||0));
    if(match.possession===1)run.flags.nextHandBonus=0;
    if(match.returnCard){const uid=match.returnCard.uid;let r=null;for(const zone of ['discard','drawPile']){const idx=match[zone].findIndex(c=>c.uid===uid);if(idx>=0){[r]=match[zone].splice(idx,1);break;}}if(!r)r={...match.returnCard,uid:`${run.seed}:card:${run.instanceCounter++}`};r.tempFree=true;match.hand.push(r);match.returnCard=null;this.relics.onReturnedCard(run,match,this.#helpers(run,match));}
    this.drawCards(run,match,handSize-match.hand.length);
    this.events?.emit('POSSESSION_STARTED',{matchId:match.id,possession:match.possession,intent:match.intent,slotLimit:match.slotLimit,opponentBoard:match.board.opponent});
  }
  ensureDraw(run,match){if(!match.drawPile.length&&match.discard.length){match.rngCounter++;match.drawPile=this.random.shuffle(run.seed,`reshuffle:${run.week}:${match.rngCounter}`,match.discard);match.discard=[];}}
  drawCards(run,match,n,filterFn=null){let safety=80;while(n>0&&safety-->0){this.ensureDraw(run,match);if(!match.drawPile.length)break;let idx=0;if(filterFn){idx=match.drawPile.findIndex(x=>filterFn(this.cardDef(x)));if(idx<0){filterFn=null;idx=0;}}this.cardManager.moveByIndex(match,'drawPile','hand',idx);n--;}}
  currentTags(run,match,def){return this.relics.augmentTags(run,match,[...def.tags]);}
  cardRole(def,tags){const ordered=['beater','flying','support','control','chaser','pass','trick','crowd','staff','equipment'];return ordered.find(t=>tags.includes(t))||String(def.role||def.type).toLowerCase();}
  roleForInstance(run,match,inst){const def=this.cardDef(inst);return def?this.cardRole(def,this.currentTags(run,match,def)):'';}
  legalLanes(run,match,inst){const def=this.cardDef(inst);if(!def)return[];return this.tacticalBoard.legalLanes(def,this.currentTags(run,match,def));}
  effectiveCost(run,match,inst){
    const def=this.cardDef(inst);if(!def)return 99;if(inst.tempFree)return 0;
    const tags=this.currentTags(run,match,def);let cost=def.cost;if(match.flags.nextFree)cost=0;cost=this.relics.modifyCost(run,match,def,tags,cost);cost=this.weather.modifyCost(match,tags,cost,match.chain.length+1);return Math.max(0,cost);
  }
  addFlow(match,amount){const before=match.turn.flow;match.turn.flow=Math.max(.6,Math.min(5,match.turn.flow+amount));match.metrics.comboBest=Math.max(match.metrics.comboBest,match.turn.flow);if(match.turn.flow!==before)this.events?.emit('FLOW_CHANGED',{from:before,to:match.turn.flow,delta:match.turn.flow-before});}
  addStat(match,key,amount){
    if(!amount)return;amount=this.weather.modifyStat(match,key,amount);amount=Math.round(amount*100)/100;
    const echo=Number(match.flags.resourceEcho?.[key]||0);if(echo>0){const echoed=amount*echo;match.turn[key]=(match.turn[key]||0)+echoed;if(match.metrics[key]!=null)match.metrics[key]+=echoed;match.turn.floating.push({kind:'echo',text:`ECHO +${Math.round(echoed)} ${String(key).toUpperCase()}`});}
    match.turn[key]=(match.turn[key]||0)+amount;if(match.metrics[key]!=null)match.metrics[key]+=amount;
    if(key==='snitchGain'){match.snitchMeter=Math.max(0,Math.min(120,match.snitchMeter+amount));match.metrics.snitch+=amount;}
  }
  addImpact(match,amount){match.turn.impact+=amount;match.turn.rawImpactSinceGoal+=amount;}
  addGoal(run,match,n,sourceInst,reason='GOAL!'){
    n=Math.max(1,Math.floor(n));match.turn.goals+=n;match.metrics.goals+=n;match.playerGoals+=n;match.turn.floating.push({kind:'goal',text:`${reason} +${n}`});
    this.events?.emit('GOAL_SCORED',{matchId:match.id,count:n,sourceId:sourceInst?.id||null,reason});this.relics.onGoal(run,match,sourceInst,this.#helpers(run,match));
  }
  synergyBefore(match,def,tags,laneId){return this.comboEngine.evaluate(match,def,tags,this.cardRole(def,tags),laneId);}
  activateCard(run,match,inst,strength=1,opts={}){
    const def=this.cardDef(inst);if(!def)return;return this.effectQueue.run(()=>this.#activateCard(run,match,inst,strength,opts),{source:def.id,reason:opts.reason||'card'});
  }
  #activateCard(run,match,inst,strength,opts){
    const def=this.cardDef(inst),tags=this.currentTags(run,match,def),role=this.cardRole(def,tags),prevDef=match.turn.played.length>1?this.cardDef(match.turn.played.at(-2)):null;
    let base=(6+(inst.upgrade||0)*5+(match.growth?.[inst.id]||0))*strength;base=this.weather.modifyImpact(run,match,tags,base,match.chain.length+1,strength);this.weather.modifyFlowOnCard(run,match,tags,a=>this.addFlow(match,a*strength));base=Math.max(0,base);this.addImpact(match,base);
    if(!opts.noChain){
      const combo=this.synergyBefore(match,def,tags,opts.laneId||null);if(combo.flowDelta)this.addFlow(match,combo.flowDelta);
      match.chain.push({id:def.id,name:def.name,role,tags:[...tags],laneId:opts.laneId||null,comboFromPrev:combo.reasons||[],flowDelta:combo.flowDelta||0});match.turn.roles.push(role);match.turn.comboHits.push(...(combo.reasons||[]));
    }
    match.turn.floating.push({kind:opts.echo?'echo':'card',text:`${opts.echo?'↻ ':''}${def.name}${strength<1?` ${Math.round(strength*100)}%`:''}${opts.reason?` · ${opts.reason}`:''}`});
    const helpers=this.#helpers(run,match);this.cardEffects.resolve(def.effects||[],{run,match,inst,def,tags,prevDef,strength,opts,helpers});
    if(tags.includes('support')&&Number(match.flags.supportGrowth||0)>0&&!opts.echo){match.growth[inst.id]=(match.growth[inst.id]||0)+Number(match.flags.supportGrowth);match.turn.floating.push({kind:'upgrade',text:`SUPPORT GROWS · ${def.name.toUpperCase()}`});}
    if(tags.includes('momentum'))this.addStat(match,'momentum',3*strength);if(tags.includes('control'))this.addStat(match,'control',3*strength);if(tags.includes('style')||tags.includes('trick'))this.addStat(match,'style',3*strength);if(tags.includes('crowd'))this.addStat(match,'fan',3*strength);this.weather.afterTags(match,tags);
    if(tags.includes('flying')){this.addStat(match,'snitchGain',2*strength);match.metrics.flying=(match.metrics.flying||0)+1;}if(tags.includes('beater')){let pressure=5;if(match.flags.pressureDouble){pressure*=2;match.flags.pressureDouble=false;}this.addStat(match,'pressure',pressure*strength);}
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
    draw:(n,tag)=>this.drawCards(run,match,n,tag?d=>d.tags.includes(tag):null),activateCard:(inst,s,o)=>this.activateCard(run,match,inst,s,o),cardDef:i=>this.cardDef(i),roleForInstance:i=>this.roleForInstance(run,match,i),effectiveCost:i=>this.effectiveCost(run,match,i),
    upgradeRandom:(n=1)=>{const rng=this.random.rng(run.seed,`practice:${run.week}:${match.possession}:${match.rngCounter++}`);for(let i=0;i<n&&run.deck.length;i++){const target=run.deck[Math.floor(rng()*run.deck.length)];target.upgrade=(target.upgrade||0)+1;match.turn.floating.push({kind:'upgrade',text:`${this.cardDef(target).name} UPGRADED`});}},
    redrawHand:(free)=>{const n=match.hand.length;this.cardManager.moveAll(match,'hand','discard');this.drawCards(run,match,n);if(free&&match.hand.length){const cheapest=[...match.hand].sort((a,b)=>this.effectiveCost(run,match,a)-this.effectiveCost(run,match,b))[0];cheapest.tempFree=true;}}
  };}
  #laneValidation(run,match,inst,laneId){
    const def=this.cardDef(inst);if(!def)return{ok:false,reason:'Unknown card.'};
    const tags=this.currentTags(run,match,def),legal=this.tacticalBoard.legalLanes(def,tags),open=legal.filter(id=>!match.board.player[id]);
    if(!laneId)laneId=this.tacticalBoard.recommendedLane(def,tags,match.board);
    if(!laneId||!legal.includes(laneId))return{ok:false,reason:'That card cannot operate in this lane.',legal};
    if(match.board.player[laneId])return{ok:false,reason:'That lane already has a committed card.',legal};
    if(match.turn.slotsUsed>=match.slotLimit)return{ok:false,reason:`Only ${match.slotLimit} tactical slots are available this possession.`,legal};
    return{ok:true,laneId,legal,tags,def,open};
  }
  playCard(run,handIndex,laneId=null){
    const match=this.ensureMatchShape(run,run.match);if(!match||match.finished)return{ok:false,reason:'Match is over.'};const inst=match.hand[handIndex];if(!inst)return{ok:false,reason:'No card there.'};
    const lane=this.#laneValidation(run,match,inst,laneId);if(!lane.ok)return lane;
    const def=lane.def,tags=lane.tags;let cost=this.effectiveCost(run,match,inst);if(inst.costDown)cost=Math.max(0,cost-inst.costDown);if(cost>match.tempo)return{ok:false,reason:`Need ${cost} Energy.`};
    const before={impact:match.turn.impact,momentum:match.turn.momentum,control:match.turn.control,style:match.turn.style,fan:match.turn.fan,pressure:match.turn.pressure};
    match.hand.splice(handIndex,1);match.tempo-=cost;if(inst.tempFree)delete inst.tempFree;if(inst.costDown)delete inst.costDown;if(match.flags.nextFree&&inst.uid!==match.flags.nextFreeSourceUid){match.flags.nextFree=false;match.flags.nextFreeSourceUid=null;}
    this.relics.afterCostPaid(run,match,tags);match.turn.played.push(inst);this.activateCard(run,match,inst,1,{laneId:lane.laneId});this.relics.afterCardPlayed(run,match,inst,this.#helpers(run,match));
    const delta={impact:match.turn.impact-before.impact,momentum:match.turn.momentum-before.momentum,control:match.turn.control-before.control,style:match.turn.style-before.style,fan:match.turn.fan-before.fan,pressure:match.turn.pressure-before.pressure};
    const resolvedCombo=match.chain.at(-1)?.comboFromPrev||[],comboDelta=Number(match.chain.at(-1)?.flowDelta||0);
    const power=this.tacticalBoard.cardPower(def,inst,tags,lane.laneId,{fatigueEnabled:match.fatigueEnabled,delta,comboDelta});
    match.board.player[lane.laneId]={uid:inst.uid,id:inst.id,name:def.name,role:this.cardRole(def,tags),tags:[...tags],power,surge:0,fatigue:Number(inst.fatigue||0)};
    match.turn.slotsUsed++;
    if(match.fatigueEnabled&&tags.includes('player'))inst.fatigue=Number(inst.fatigue||0)+1;
    match.discard.push(inst);this.cardManager.assertUnique(match);
    const combo=resolvedCombo;
    this.events?.emit('CARD_PLAYED',{matchId:match.id,cardId:def.id,instanceId:inst.uid,cost,laneId:lane.laneId,lanePower:power,flow:match.turn.flow,tempoRemaining:match.tempo,combo});
    return{ok:true,cost,def,laneId:lane.laneId,lanePower:power,combo,events:match.turn.floating.splice(0)};
  }
  previewPlay(run,handIndex,laneId=null){
    const match=this.ensureMatchShape(run,run.match),inst=match?.hand?.[handIndex];if(!match||!inst)return{ok:false,reason:'Select a card.'};const lane=this.#laneValidation(run,match,inst,laneId);if(!lane.ok)return lane;
    let cost=this.effectiveCost(run,match,inst);if(inst.costDown)cost=Math.max(0,cost-inst.costDown);if(cost>match.tempo)return{ok:false,reason:`Need ${cost} Energy.`,legal:lane.legal};
    const combo=this.comboEngine.evaluate(match,lane.def,lane.tags,this.cardRole(lane.def,lane.tags),lane.laneId),power=this.tacticalBoard.cardPower(lane.def,inst,lane.tags,lane.laneId,{fatigueEnabled:match.fatigueEnabled,delta:{impact:6+Number(inst.upgrade||0)*5},comboDelta:combo.flowDelta});
    return{ok:true,laneId:lane.laneId,legal:lane.legal,cost,lanePower:power,affinity:this.tacticalBoard.affinity(lane.def,lane.tags,lane.laneId),flowAfter:Math.max(.6,Math.min(5,match.turn.flow+combo.flowDelta)),combo};
  }
  spendMomentum(run,laneId){
    const match=this.ensureMatchShape(run,run.match);if(!match||match.finished)return{ok:false,reason:'Match is over.'};if(match.turn.surgeUsed)return{ok:false,reason:'Tactical Surge already used this possession.'};
    if(match.resources.momentum<2)return{ok:false,reason:'Need 2 Momentum.'};const placement=match.board.player[laneId];if(!placement)return{ok:false,reason:'Select one of your occupied lanes.'};
    match.resources.momentum-=2;placement.surge=Number(placement.surge||0)+10;match.turn.surgeUsed=true;this.addFlow(match,.08);match.turn.floating.push({kind:'critical',text:`TACTICAL SURGE · ${this.tacticalBoard.lane(laneId)?.short||laneId}`});this.events?.emit('MOMENTUM_SPENT',{matchId:match.id,laneId,amount:2});return{ok:true,laneId,power:placement.power+placement.surge};
  }
  #projectedSnitchBonus(match,projectedSnitch){
    if(match.snitchBonusClaimed)return 0;if(match.snitchCaught)return 90;if(match.possession>=4&&projectedSnitch>=100)return 125;return 0;
  }
  #rawPerformance(match,board,{includeBoardProjection=true}={}){
    // Preview includes unresolved lane rewards. Final scoring calls this after lane rewards have
    // been applied, so counting them again would double-score formations and Seeker progress.
    const t=match.turn,goals=t.goals+(includeBoardProjection?Number(board.playerChaserGoals||0):0),snitch=match.snitchMeter+(includeBoardProjection?Number(board.playerSeekerGain||0):0),discipline=Math.min(2,Math.max(0,match.tempo))*6,snitchBonus=this.#projectedSnitchBonus(match,snitch);
    const raw=Math.max(0,t.impact+t.momentum*2.2+t.control*2.1+t.style*2+t.fan*1.55+(t.pressure||0)*1.45+goals*70+t.critical*18+Number(board.tacticalEdge||0)+discipline+snitch*.28+snitchBonus);
    return{raw,goals,snitch,discipline,snitchBonus,performance:Math.max(1,Math.round(raw*t.flow*t.finalMultiplier))};
  }
  previewState(run){
    const match=this.ensureMatchShape(run,run.match);if(!match)return null;const board=this.tacticalBoard.evaluate(match),player=this.#rawPerformance(match,board),ai=this.ai.previewScore(run,match,board);
    return{board,player,ai,projectedLead:player.performance-ai.score,slotsRemaining:Math.max(0,match.slotLimit-match.turn.slotsUsed)};
  }
  endPossession(run){
    const match=this.ensureMatchShape(run,run.match);if(!match||match.finished)return null;const t=match.turn;
    if(match.flags.burgerActive&&match.tempo===0){this.addFlow(match,.20);run.flags.burgers=(run.flags.burgers||0)+1;if(run.flags.burgers>=3){run.flags.burgers=0;this.addGoal(run,match,1,t.played.at(-1),'BURGER HAT-TRICK');}}
    this.relics.beforePossessionScore(run,match);if(match.playerScore<match.aiScore&&match.aiScore-match.playerScore>=45){this.addFlow(match,.12);t.critical+=1;match.metrics.critical+=1;}
    const board=this.tacticalBoard.evaluate(match);
    if(board.playerChaserGoals>0)this.addGoal(run,match,board.playerChaserGoals,t.played.at(-1),'FORMATION BREAK');
    if(board.playerSeekerGain>0)this.addStat(match,'snitchGain',board.playerSeekerGain);
    const projectedSnitch=match.snitchMeter,snitchBonus=this.#projectedSnitchBonus(match,projectedSnitch);
    if(snitchBonus>0){if(!match.snitchCaught)match.snitchCaught=true;match.snitchBonusClaimed=true;t.impact+=snitchBonus;t.critical+=1;match.metrics.critical+=1;t.floating.push({kind:'snitch',text:snitchBonus>=120?'SNITCH STEAL · HERO MOMENT':'SNITCH CAUGHT · TACTICAL WINDOW'});}
    const rawPack=this.#rawPerformance(match,board,{includeBoardProjection:false}),raw=rawPack.raw,performance=rawPack.performance,ai=this.ai.possessionScore(run,match,board);
    match.playerScore+=performance;match.aiScore+=ai.score;match.metrics.comboBest=Math.max(match.metrics.comboBest,t.flow);
    const lastPlayed=t.played.at(-1);if(match.flags.returnLastCard&&lastPlayed){match.returnCard={uid:lastPlayed.uid,id:lastPlayed.id,upgrade:lastPlayed.upgrade||0,tempFree:true,fatigue:lastPlayed.fatigue||0};}
    const moraleBefore=match.resources.morale,momentumBefore=match.resources.momentum;
    const moraleEarned=Math.min(2,Math.max(0,match.tempo));match.resources.morale=Math.min(6,match.resources.morale+moraleEarned);
    const momentumEarned=Math.min(2,Math.floor((Math.max(0,t.momentum)+board.playerBeaterWins*4)/8));match.resources.momentum=Math.min(6,match.resources.momentum+momentumEarned);
    match.lastPlayedUids=t.played.map(x=>x.uid);
    if(!match.flags.snitchFrozen&&match.possession<match.maxPossessions)match.snitchMeter=Math.max(0,match.snitchMeter-1);
    const laneSummary={won:board.playerWins,lost:board.aiWins,chaserGoals:board.playerChaserGoals,beaterWins:board.playerBeaterWins,seekerGain:board.playerSeekerGain};
    const reasons=[];
    if(board.playerWins)reasons.push(`Won ${board.playerWins} tactical lane${board.playerWins===1?'':'s'}`);if(board.aiWins)reasons.push(`Conceded ${board.aiWins} lane${board.aiWins===1?'':'s'}`);
    if(board.playerChaserGoals)reasons.push(`${board.playerChaserGoals} goal${board.playerChaserGoals===1?'':'s'} from Chaser control`);if(board.playerBeaterWins)reasons.push(`${board.playerBeaterWins} Beater lane${board.playerBeaterWins===1?'':'s'} disrupted them`);
    if(moraleEarned)reasons.push(`Held ${moraleEarned} Energy → +${match.resources.morale-moraleBefore} Morale`);if(momentumEarned)reasons.push(`Built +${match.resources.momentum-momentumBefore} banked Momentum`);if(ai.counter)reasons.push(`Read their intent for -${ai.counter} pressure`);if(snitchBonus)reasons.push(`Snitch moment +${snitchBonus}`);
    const summary={possession:match.possession,player:performance,ai:ai.score,raw,flow:t.flow,mult:t.finalMultiplier,goals:t.goals,counter:ai.counter,big:performance>=300||t.flow>=2.3||t.goals>=2||snitchBonus>0,board,laneSummary,reasons,moraleEarned,momentumEarned,snitchBonus,aiSnitchCatch:ai.snitchCatch};
    match.lastPossession=summary;match.log.push(summary);this.events?.emit('POSSESSION_ENDED',{matchId:match.id,...summary});
    if(match.possession>=match.maxPossessions){
      match.finished=true;if(match.playerScore===match.aiScore){if(match.playerGoals!==match.aiGoals)match.won=match.playerGoals>match.aiGoals;else if(match.snitchMeter!==match.aiSnitch)match.won=match.snitchMeter>match.aiSnitch;else match.won=match.metrics.control>=Number(match.aiControl||0);}else match.won=match.playerScore>match.aiScore;
      return{...summary,matchEnded:true};
    }
    match.possession++;this.effectQueue.reset();this.beginPossession(run,match);return summary;
  }
  mulligan(run){
    const m=this.ensureMatchShape(run,run.match);if(!m||m.finished||m.mulliganUsed)return{ok:false,reason:'Tactical Reset already used.'};if(m.resources.morale<1)return{ok:false,reason:'Need 1 Morale.'};
    m.resources.morale--;m.mulliganUsed=true;const n=m.hand.length;this.cardManager.moveAll(m,'hand','discard');this.drawCards(run,m,n);this.events?.emit('MULLIGAN_USED',{matchId:m.id,possession:m.possession,cost:'morale'});return{ok:true};
  }
}
