const LANE_IDS=['chaser_left','chaser_center','chaser_right','beater_left','beater_right','seeker'];
function clone(v){try{return structuredClone(v);}catch{return JSON.parse(JSON.stringify(v));}}
function clamp(v,min,max){return Math.max(min,Math.min(max,v));}

export class AIManager {
  constructor(data, random, events = null) { this.data=data; this.random=random; this.events=events; }
  opponent(id) { return this.data.opponents.find(o=>o.id===id) || this.data.opponents[0]; }
  makeIntent(opponent, possession, run) {
    const list = opponent.intents?.length ? opponent.intents : [{name:'Balanced Formation',text:'No obvious weakness. Build your best shape.',counter:null,bonus:0}];
    const rng=this.random.rng(run.seed,`intent:${run.week}:${possession}`);
    const intent=clone(list[Math.floor(rng()*list.length)]);
    intent.focusLanes=this.#focusForCounter(intent.counter);
    return intent;
  }
  #focusForCounter(counter){
    switch(counter){
      case'control':return['chaser_center','chaser_left'];
      case'style':return['beater_left','beater_right'];
      case'snitch':return['seeker'];
      case'fan':return['chaser_left','chaser_right'];
      case'roles':return['chaser_center','beater_left','seeker'];
      case'styleOrSnitch':return['beater_right','seeker'];
      case'lowMomentum':return['beater_left','chaser_center'];
      case'pressure':return['beater_left','beater_right'];
      case'balance':return['chaser_left','chaser_center','beater_right'];
      case'fanStyle':return['chaser_right','beater_left'];
      default:return['chaser_center'];
    }
  }
  makeBoard(opponent,possession,run,match=null){
    const profile=opponent.tacticalProfile||{},bias=profile.laneBias||{};
    // During the redesigned first-time match the opponent reveals one idea at a time.
    if(run.flags?.tutorialRun&&run.week===0){
      const tutorialPlans=[
        ['chaser_left','chaser_center'],
        ['chaser_right','beater_left'],
        ['chaser_center','beater_right','chaser_left'],
        ['seeker','beater_left','chaser_right'],
        ['seeker','chaser_center','beater_right']
      ];
      const active=tutorialPlans[Math.min(tutorialPlans.length-1,possession-1)];
      const out={};for(const id of LANE_IDS)out[id]={power:0,active:false,label:''};
      active.forEach((id,i)=>{out[id]={power:8+possession+i+(id==='seeker'?2:0),active:true,label:i===0?'PRIMARY':'SUPPORT'};});
      return out;
    }
    const slotLimit=possession===1?2:3,curve=Number(opponent.curve?.[possession-1]||1),base=7+run.week*1.7+(opponent.final?2.5:0);
    const intentFocus=new Set(match?.intent?.focusLanes||[]),rng=this.random.rng(run.seed,`aiboard:${run.week}:${possession}`);
    const previous=match?.lastPossession?.board?.results||[];
    const previousBest=[...previous].filter(x=>x.result==='win').sort((a,b)=>b.margin-a.margin)[0]?.laneId;
    const scored=LANE_IDS.map(id=>{
      let score=Number(bias[id]||0)+(intentFocus.has(id)?3:0)+(rng()-.5)*1.4;
      if(id==='seeker')score+=Number(profile.seekerScale||0)*Math.max(0,possession-2);
      if(profile.openingPressure)score+=Number(profile.openingPressure)*(6-possession)/5;
      if(profile.latePressure)score+=Number(profile.latePressure)*(possession-1)/4;
      if(profile.adaptive&&previousBest===id)score+=Number(profile.adaptive||0);
      if(profile.weatherLane&&match?.weatherId&&match.weatherId!=='clear'&&id===profile.weatherLane)score+=3;
      return{id,score};
    }).sort((a,b)=>b.score-a.score);
    const active=scored.slice(0,slotLimit),out={};for(const id of LANE_IDS)out[id]={power:0,active:false,label:''};
    active.forEach((entry,i)=>{
      const power=Math.round(clamp((base+5+entry.score)*curve,6,26));
      out[entry.id]={power,active:true,label:i===0?'SIGNATURE':i===1?'SECONDARY':'FLEX'};
    });
    return out;
  }
  counterAmount(match,intent) {
    const t=match.turn;
    switch(intent.counter){
      case'control':return t.control*1.55;
      case'style':return t.style*1.35;
      case'snitch':return match.snitchMeter*.55;
      case'fan':return t.fan*.95;
      case'roles':return Math.max(0,new Set(t.roles).size-1)*10;
      case'styleOrSnitch':return Math.max(t.style,match.snitchMeter*.5)*1.1;
      case'lowMomentum':return Math.max(0,22-t.momentum)*.55;
      case'pressure':return (t.pressure||0)*1.25;
      case'balance':return Math.min(...[t.momentum,t.control,t.style,t.fan].map(Number))*1.8;
      case'fanStyle':return(t.fan+t.style)*.72;
      default:return 0;
    }
  }
  #score(run,match,board,{mutate=false}={}){
    const opp=this.opponent(match.opponentId),p=match.possession-1,curve=Number(opp.curve?.[p]||1);
    const onboarding=Boolean(run.flags?.tutorialRun&&run.week===0);
    const profile=opp.tacticalProfile||{},difficulty=Number(profile.difficulty||1);let base=(onboarding?85:64+Math.min(run.week,4)*14+(opp.final?8:0))*curve*difficulty+Number(match.intent?.bonus||0)*.60;
    base+=Number(board?.aiTacticalEdge||0);
    const unanswered=(board?.results||[]).filter(x=>x.result==='threat');
    base+=unanswered.length*8+unanswered.filter(x=>String(x.opponent?.label||'').match(/PRIMARY|SIGNATURE/)).length*7;
    base-=Number(board?.aiSuppression||0);
    for(const rule of opp.aiRules || []) {
      if(rule.type==='momentum_copy') base += Math.min(Number(rule.cap||25),Number(match.resources?.momentum||0)*5*Number(rule.factor||0));
      else if(rule.type==='weather_bonus' && match.weatherId!==rule.unless) base += Number(rule.amount||0);
      else if(rule.type==='impact_threshold_bonus' && match.turn.impact>Number(rule.threshold||0)) base += Number(rule.amount||0);
      else if(rule.type==='full_board_counter' && Number(match.turn.slotsUsed||0)>=Number(match.slotLimit||3)) base += Number(rule.amount||0);
      else if(rule.type==='weakest_cumulative_stat_bonus') {
        const totals=[match.metrics.momentum,match.metrics.control,match.metrics.style,match.metrics.fan];
        base += Math.max(0,Number(rule.target||0)-Math.min(...totals)*Number(rule.factor||0));
      }
    }
    const counter=this.counterAmount(match,match.intent);base-=Math.min(base*.30,counter);
    const goals=Number(board?.aiChaserGoals||0),snitchGain=Number(board?.aiSeekerGain||0);
    base+=goals*68;
    let projectedSnitch=Number(match.aiSnitch||0)+snitchGain;
    for(const rule of opp.aiRules||[])if(rule.type==='snitch_scale')projectedSnitch+=Number(rule.base||0)+match.possession*Number(rule.perPossession||0);
    const catchThreshold=Number(this.data.config?.tacticalBoard?.snitchCatchThreshold||85),catchBonus=Number(this.data.config?.tacticalBoard?.snitchCatchBonus||110);let snitchCatch=false;if(match.possession>=4&&!match.aiSnitchCaught&&projectedSnitch>=catchThreshold){snitchCatch=true;base+=catchBonus;}
    const score=Math.max(30,Math.round(base));
    if(mutate){
      match.aiGoals+=goals;match.aiSnitch=Math.min(120,projectedSnitch);if(snitchCatch)match.aiSnitchCaught=true;
      this.events?.emit('AI_POSSESSION_RESOLVED',{opponentId:opp.id,score,goals,counter:Math.round(counter),laneWins:Number(board?.aiWins||0),snitchGain,snitchCatch});
    }
    return{score,goals,counter:Math.round(counter),snitchGain,snitchCatch,projectedSnitch:Math.min(120,projectedSnitch)};
  }
  possessionScore(run,match,board){return this.#score(run,match,board,{mutate:true});}
  previewScore(run,match,board){return this.#score(run,match,board,{mutate:false});}
}
