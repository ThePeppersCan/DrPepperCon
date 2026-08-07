export class RunManager {
  constructor({data,random,events,eventEffects,stateMachine,settingsManager,logger=null}={}){Object.assign(this,{data,random,events,eventEffects,stateMachine,settingsManager,logger});}
  clone(v){return JSON.parse(JSON.stringify(v));}
  newProfile(){return{version:2,schemaVersion:2,runs:0,championships:0,bestSeasonWins:0,legacy:0,updatedAt:Date.now(),unlockedCards:[...this.data.starterUnlocked],unlockedRelics:[...(this.data.config.starterRelics||[])],discoveredCards:[...this.data.starterUnlocked],discoveredRelics:[],discoveredCombos:[],tutorialVersion:0,settings:this.settingsManager.sanitize(),stats:{},achievements:[],lastRun:null,cardMastery:{},relicMastery:{},buildHistory:{},hallOfFame:{bestFlow:1,biggestWin:0,bestSeasonWins:0,championBuilds:[]}};}
  sanitizeProfile(raw){
    const base=this.newProfile(),p={...base,...(raw||{})};p.version=2;p.schemaVersion=2;
    p.unlockedCards=[...new Set([...(base.unlockedCards||[]),...(Array.isArray(p.unlockedCards)?p.unlockedCards:[])])].filter(id=>this.data.cardById[id]);
    p.unlockedRelics=[...new Set([...(base.unlockedRelics||[]),...(Array.isArray(p.unlockedRelics)?p.unlockedRelics:[])])].filter(id=>this.data.relicById[id]);
    p.discoveredCards=[...new Set(Array.isArray(p.discoveredCards)?p.discoveredCards:p.unlockedCards)].filter(id=>this.data.cardById[id]);
    p.discoveredRelics=[...new Set(Array.isArray(p.discoveredRelics)?p.discoveredRelics:[])].filter(id=>this.data.relicById[id]);
    p.discoveredCombos=[...new Set(Array.isArray(p.discoveredCombos)?p.discoveredCombos:[])];p.tutorialVersion=Number(p.tutorialVersion||0);
    p.settings=this.settingsManager.sanitize(p.settings);p.stats=p.stats||{};p.achievements=Array.isArray(p.achievements)?p.achievements:[];
    p.cardMastery=p.cardMastery&&typeof p.cardMastery==='object'?p.cardMastery:{};p.relicMastery=p.relicMastery&&typeof p.relicMastery==='object'?p.relicMastery:{};p.buildHistory=p.buildHistory&&typeof p.buildHistory==='object'?p.buildHistory:{};
    p.hallOfFame={bestFlow:1,biggestWin:0,bestSeasonWins:0,championBuilds:[],...(p.hallOfFame||{})};p.hallOfFame.championBuilds=Array.isArray(p.hallOfFame.championBuilds)?p.hallOfFame.championBuilds:[];
    if(p.activeRun)this.sanitizeRun(p.activeRun);return p;
  }
  sanitizeRun(run){
    run.version=2;run.schemaVersion=2;run.instanceCounter=Number(run.instanceCounter||1000);run.bench=Array.isArray(run.bench)?run.bench:[];run.flags=run.flags||{};
    run.flags.tutorialRun=Boolean(run.flags.tutorialRun);run.history=Array.isArray(run.history)?run.history:[];run.unlockedCards=Array.isArray(run.unlockedCards)?run.unlockedCards:[...this.data.starterUnlocked];run.unlockedRelics=Array.isArray(run.unlockedRelics)?run.unlockedRelics:[];return run;
  }
  makeCard(run,id,upgrade=0){return{uid:`${run.seed}:card:${run.instanceCounter++}`,id,upgrade:Number(upgrade)||0};}
  newRun(profile,manager='Manager'){
    const seed=this.random.createRunSeed(),rng=this.random.rng(seed,'schedule'),pool=this.data.opponents.filter(o=>!o.final),tutorial=Number(profile.tutorialVersion||0)<3;
    const regular=[...pool];for(let i=regular.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[regular[i],regular[j]]=[regular[j],regular[i]];}
    let ordered=regular;if(tutorial){const intro=regular.find(o=>o.id==='fitchburg')||regular[0];ordered=[intro,...regular.filter(o=>o.id!==intro.id)];}
    const run={version:2,schemaVersion:2,seed,manager,week:0,phase:'hub',regularComplete:false,qualified:false,finished:false,champion:false,wins:0,losses:0,fanBase:0,insight:0,deck:[],bench:[],relics:[],schedule:[...ordered.slice(0,5).map(o=>o.id),this.data.opponents.find(o=>o.final)?.id||pool[0]?.id],match:null,pendingReward:null,pendingEvent:null,flags:{nextMatchScoreDebt:0,nextMatchTempo:0,nextMatchControlPenalty:0,nextMatchFan:0,nextWeather:null,rewardOfferPenalty:0,nextHandBonus:0,tutorialRun:tutorial},history:[],unlockedCards:[...(profile.unlockedCards||this.data.starterUnlocked)],unlockedRelics:[...(profile.unlockedRelics||[])],createdAt:Date.now(),instanceCounter:1};
    run.deck=this.data.starterDeck.map(id=>this.makeCard(run,id));this.events?.emit('RUN_STARTED',{seed,manager,tutorial});return run;
  }
  finishMatch(run){
    const m=run.match;if(!m||!m.finished)return false;if(m.won)run.wins++;else run.losses++;
    run.fanBase+=Math.max(2,Math.round((m.metrics.style+m.metrics.fan)/18)+(m.won?4:1));run.insight+=m.won?2:1;
    run.history.push({week:run.week,opponentId:m.opponentId,won:m.won,player:m.playerScore,ai:m.aiScore,margin:m.playerScore-m.aiScore,combo:m.metrics.comboBest,laneWins:(m.log||[]).reduce((n,x)=>n+Number(x.laneSummary?.won||0),0),snitch:Math.round(m.snitchMeter||0),cardsPlayed:{...(m.metrics.cardPlays||{})}});
    const draft=this.draftOptions(run);run.pendingReward={type:'card',...draft};
    if(run.week===2||run.week===4){const relic=this.relicOptions(run);run.pendingReward={type:'relic',...relic};}
    this.stateMachine.transition(run,'phase','result',{force:true});this.events?.emit('MATCH_ENDED',{week:run.week,opponentId:m.opponentId,won:m.won,player:m.playerScore,ai:m.aiScore});return true;
  }
  #buildCounts(run){const counts={};for(const inst of run.deck||[]){const c=this.data.cardById[inst.id];for(const build of c?.builds||[])counts[build]=(counts[build]||0)+1;}return counts;}
  #copies(run,id){return (run.deck||[]).filter(c=>c.id===id).length;}
  buildIdentity(run){
    const counts=this.#buildCounts(run),sorted=Object.entries(counts).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])),key=sorted[0]?.[0]||'adaptation';
    const names={passing:'Passing Engine',momentum:'Momentum Engine',crowd:'Crowd Manipulation',defence:'Defensive Fortress',weather:'Weather Control',captain:'Captain Leadership',growth:'Development Engine',counter:'Counter Attack',fatigue:'Fatigue Management',snitch:'Snitch Race',beater:'Beater Press',flying:'Flying Specialists',return:'Return Loop',trick:'Improvisation',control:'Control Room',combo:'Combo Workshop',adaptation:'Adaptive Club'};
    return{key,name:names[key]||key.replace(/(^|_)\w/g,m=>m.replace('_',' ').toUpperCase()),counts,sorted};
  }
  draftOptions(run){
    const rng=this.random.rng(run.seed,`draft:${run.week}`),offerPenalty=Number(run.flags.rewardOfferPenalty||0);run.flags.rewardOfferPenalty=0;run.flags.draftSeen=run.flags.draftSeen||{};
    const allowed=new Set(run.unlockedCards||this.data.starterUnlocked),pool=this.data.cards.filter(c=>allowed.has(c.id)),counts=this.#buildCounts(run),dominant=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0]?.[0]||null;
    const buildUniverse=[...new Set(pool.flatMap(c=>c.builds||[]))],least=[...buildUniverse].sort((a,b)=>Number(counts[a]||0)-Number(counts[b]||0)||a.localeCompare(b))[0]||null;
    const score=(c,mode)=>{const builds=c.builds||[],copies=this.#copies(run,c.id),unseen=copies===0?7:0,duplicatePenalty=copies*6,seenPenalty=Number(run.flags.draftSeen[c.id]||0)*6,role=c.draftRole||'UTILITY';let value=unseen-duplicatePenalty-seenPenalty+(rng()-.5)*2;
      if(mode==='DEEPEN')value+=dominant&&builds.includes(dominant)?12:-5;
      if(mode==='PIVOT')value+=least&&builds.includes(least)?10:builds.some(b=>!counts[b])?6:0;
      if(mode==='DISCOVERY')value+=unseen?9:0;value+=c.rarity==='Rare'?3:0;
      if(role==='PAYOFF'){const support=builds.reduce((n,b)=>n+Number(counts[b]||0),0);value+=support>=3?5:-2;}else if(role==='ENGINE')value+=copies===0?3:0;
      return value;};
    const pickCandidate=(mode,used)=>{const ranked=pool.filter(c=>!used.has(c.id)).map(c=>({c,value:score(c,mode)})).sort((a,b)=>b.value-a.value||a.c.id.localeCompare(b.c.id)).slice(0,Math.min(7,pool.length));if(!ranked.length)return null;const floor=Math.min(...ranked.map(x=>x.value)),weights=ranked.map(x=>Math.max(.25,x.value-floor+1)),total=weights.reduce((a,b)=>a+b,0);let roll=rng()*total;for(let i=0;i<ranked.length;i++){roll-=weights[i];if(roll<=0)return ranked[i].c;}return ranked.at(-1).c;};
    const used=new Set(),options=[],reasons={};for(const mode of ['DEEPEN','PIVOT','DISCOVERY']){const c=pickCandidate(mode,used);if(c){used.add(c.id);options.push(c.id);reasons[c.id]=mode;}}
    const target=Math.max(2,3-offerPenalty);while(options.length>target)options.pop();while(options.length<target){const remaining=pool.filter(x=>!used.has(x.id));if(!remaining.length)break;const c=remaining[Math.floor(rng()*remaining.length)];used.add(c.id);options.push(c.id);reasons[c.id]='UTILITY';}
    for(const id of options)run.flags.draftSeen[id]=Number(run.flags.draftSeen[id]||0)+1;
    return{options,reasons,identity:this.buildIdentity(run)};
  }
  relicOptions(run){
    const rng=this.random.rng(run.seed,`relic:${run.week}`),allowed=new Set(run.unlockedRelics||[]),identity=this.buildIdentity(run);run.flags.relicSeen=run.flags.relicSeen||{};
    const pool=this.data.relics.filter(r=>allowed.has(r.id)&&!run.relics.includes(r.id)),reasons={},scored=pool.map(r=>{const match=(r.builds||[]).includes(identity.key),newAngle=(r.builds||[]).some(b=>!identity.counts[b]),seen=Number(run.flags.relicSeen[r.id]||0);return{r,score:(match?8:0)+(newAngle?3:0)-seen*5+(rng()-.5)*2,reason:match?'CORE':newAngle?'PIVOT':'WILDCARD'};});
    const options=[],used=new Set();while(options.length<3&&used.size<scored.length){const ranked=scored.filter(x=>!used.has(x.r.id)).sort((a,b)=>b.score-a.score||a.r.id.localeCompare(b.r.id)).slice(0,5);if(!ranked.length)break;const floor=Math.min(...ranked.map(x=>x.score)),weights=ranked.map(x=>Math.max(.25,x.score-floor+1)),total=weights.reduce((a,b)=>a+b,0);let roll=rng()*total,pick=ranked.at(-1);for(let i=0;i<ranked.length;i++){roll-=weights[i];if(roll<=0){pick=ranked[i];break;}}used.add(pick.r.id);options.push(pick.r.id);reasons[pick.r.id]=pick.reason;}
    for(const id of options)run.flags.relicSeen[id]=Number(run.flags.relicSeen[id]||0)+1;
    return{options,reasons,identity};
  }
  takeReward(run,choiceId,profile){
    if(!run.pendingReward||!run.pendingReward.options?.includes(choiceId))return false;const rewardType=run.pendingReward.type;
    if(rewardType==='card'){if(!this.data.cardById[choiceId])return false;run.deck.push(this.makeCard(run,choiceId));profile.discoveredCards=[...new Set([...(profile.discoveredCards||[]),choiceId])];}
    else{if(!this.data.relicById[choiceId])return false;run.relics.push(choiceId);profile.discoveredRelics=[...new Set([...(profile.discoveredRelics||[]),choiceId])];}
    run.pendingReward=null;profile.updatedAt=Date.now();this.advanceAfterReward(run);this.events?.emit('REWARD_TAKEN',{type:rewardType,id:choiceId});return true;
  }
  skipReward(run){run.pendingReward=null;run.insight++;this.advanceAfterReward(run);}
  advanceAfterReward(run){
    if(run.week>=5){this.finishRun(run);return;}const completedWeek=run.week;run.week++;
    if(completedWeek>=4){run.regularComplete=true;run.qualified=run.wins>=3;if(!run.qualified){this.finishRun(run);return;}this.stateMachine.transition(run,'phase','hub',{force:true});return;}
    const eventWeeks=run.flags?.tutorialRun?[2]:[0,2,4];if(eventWeeks.includes(completedWeek)){const rng=this.random.rng(run.seed,`event:${completedWeek}`);run.pendingEvent=this.clone(this.data.events[Math.floor(rng()*this.data.events.length)]);this.stateMachine.transition(run,'phase','event',{force:true});}else this.stateMachine.transition(run,'phase','hub',{force:true});
  }
  applyEvent(run,choiceIndex,profile){const ev=run.pendingEvent;if(!ev)return null;const choice=ev.choices?.[choiceIndex];if(!choice)return null;this.eventEffects.apply(run,profile,choice.effects,`eventapply:${run.week}:${ev.id}:${choiceIndex}`);run.pendingEvent=null;this.stateMachine.transition(run,'phase','hub',{force:true});this.events?.emit('EVENT_CHOICE',{eventId:ev.id,choiceIndex,label:choice.label});return choice;}
  finishRun(run){run.finished=true;run.champion=!!(run.week>=5&&run.match?.won);this.stateMachine.transition(run,'phase','run_end',{force:true});this.events?.emit('RUN_ENDED',{seed:run.seed,wins:run.wins,losses:run.losses,champion:run.champion});}
  #recordMastery(profile,run){
    profile.cardMastery=profile.cardMastery||{};profile.relicMastery=profile.relicMastery||{};profile.buildHistory=profile.buildHistory||{};profile.hallOfFame={bestFlow:1,biggestWin:0,bestSeasonWins:0,championBuilds:[],...(profile.hallOfFame||{})};
    for(const h of run.history||[])for(const [id,count] of Object.entries(h.cardsPlayed||{})){const rec=profile.cardMastery[id]||(profile.cardMastery[id]={plays:0,matchWins:0,titles:0});rec.plays+=Number(count||0);if(h.won&&count)rec.matchWins++;}
    for(const id of run.relics||[]){const rec=profile.relicMastery[id]||(profile.relicMastery[id]={runs:0,titles:0});rec.runs++;if(run.champion)rec.titles++;}
    if(run.champion)for(const id of new Set((run.history||[]).flatMap(h=>Object.keys(h.cardsPlayed||{})))){const rec=profile.cardMastery[id]||(profile.cardMastery[id]={plays:0,matchWins:0,titles:0});rec.titles++;}
    const identity=this.buildIdentity(run),hist=profile.buildHistory[identity.key]||(profile.buildHistory[identity.key]={runs:0,titles:0,bestWins:0});hist.runs++;hist.bestWins=Math.max(hist.bestWins,run.wins||0);if(run.champion)hist.titles++;
    const hof=profile.hallOfFame;hof.bestFlow=Math.max(Number(hof.bestFlow||1),1,...(run.history||[]).map(h=>Number(h.combo||1)));hof.biggestWin=Math.max(Number(hof.biggestWin||0),0,...(run.history||[]).map(h=>Number(h.margin||0)));hof.bestSeasonWins=Math.max(Number(hof.bestSeasonWins||0),run.wins||0);
    if(run.champion){hof.championBuilds=[{build:identity.name,seed:run.seed,wins:run.wins,at:Date.now()},...(hof.championBuilds||[])].slice(0,10);}return identity;
  }
  #leastExploredBuild(profile,defs){const builds=[...new Set(defs.flatMap(d=>d.builds||[]))];return builds.sort((a,b)=>Number(profile.buildHistory?.[a]?.runs||0)-Number(profile.buildHistory?.[b]?.runs||0)||a.localeCompare(b))[0]||null;}
  grantMetaUnlocks(profile,run){
    profile.runs=(profile.runs||0)+1;if(run.champion)profile.championships=(profile.championships||0)+1;profile.bestSeasonWins=Math.max(profile.bestSeasonWins||0,run.wins||0);profile.tutorialVersion=Math.max(Number(profile.tutorialVersion||0),3);const identity=this.#recordMastery(profile,run);
    const lockedCards=this.data.cards.filter(c=>!profile.unlockedCards.includes(c.id)),lockedRelics=this.data.relics.filter(r=>!profile.unlockedRelics.includes(r.id)),unlocked=[];
    if(lockedCards.length){const least=this.#leastExploredBuild(profile,lockedCards),c=[...lockedCards].sort((a,b)=>Number(!(a.builds||[]).includes(least))-Number(!(b.builds||[]).includes(least))||Number(profile.cardMastery?.[a.id]?.plays||0)-Number(profile.cardMastery?.[b.id]?.plays||0)||a.id.localeCompare(b.id))[0];profile.unlockedCards.push(c.id);profile.discoveredCards.push(c.id);unlocked.push({type:'card',id:c.id,name:c.name});}
    else if(lockedRelics.length){const least=this.#leastExploredBuild(profile,lockedRelics),r=[...lockedRelics].sort((a,b)=>Number(!(a.builds||[]).includes(least))-Number(!(b.builds||[]).includes(least))||a.id.localeCompare(b.id))[0];profile.unlockedRelics.push(r.id);profile.discoveredRelics.push(r.id);unlocked.push({type:'relic',id:r.id,name:r.name});}
    else{profile.legacy=(profile.legacy||0)+1;unlocked.push({type:'legacy',name:`Director Legacy ${profile.legacy}`});}
    if(run.champion){const remaining=this.data.relics.filter(r=>!profile.unlockedRelics.includes(r.id));if(remaining.length){const least=this.#leastExploredBuild(profile,remaining),r=[...remaining].sort((a,b)=>Number(!(a.builds||[]).includes(least))-Number(!(b.builds||[]).includes(least))||a.id.localeCompare(b.id))[0];profile.unlockedRelics.push(r.id);profile.discoveredRelics.push(r.id);unlocked.push({type:'relic',id:r.id,name:r.name});}}
    profile.updatedAt=Date.now();profile.lastRun={seed:run.seed,wins:run.wins,losses:run.losses,champion:run.champion,build:identity.name,at:Date.now()};return unlocked;
  }
  clubSummary(run){return{deck:run.deck.length,relics:run.relics.length,wins:run.wins,losses:run.losses,fanBase:run.fanBase,week:run.week+1,build:this.buildIdentity(run)};}
}
