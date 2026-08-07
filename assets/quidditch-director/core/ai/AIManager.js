export class AIManager {
  constructor(data, random, events = null) { this.data=data; this.random=random; this.events=events; }
  opponent(id) { return this.data.opponents.find(o=>o.id===id) || this.data.opponents[0]; }
  makeIntent(opponent, possession, run) {
    const list = opponent.intents?.length ? opponent.intents : [{name:'Balanced Formation',text:'No obvious weakness. Build your best chain.',counter:null,bonus:0}];
    const rng=this.random.rng(run.seed,`intent:${run.week}:${possession}`);
    return structuredCloneSafe(list[Math.floor(rng()*list.length)]);
  }
  counterAmount(match,intent) {
    const t=match.turn;
    switch(intent.counter){
      case'control':return t.control*1.7;
      case'style':return t.style*1.5;
      case'snitch':return match.snitchMeter*1.1;
      case'fan':return t.fan*1.1;
      case'roles':return Math.max(0,new Set(t.roles).size-1)*12;
      case'styleOrSnitch':return Math.max(t.style,match.snitchMeter)*1.3;
      case'lowMomentum':return Math.max(0,28-t.momentum)*.7;
      case'pressure':return (t.pressure||0)*1.5;
      case'balance':return Math.min(...[t.momentum,t.control,t.style,t.fan].map(Number))*2.2;
      case'fanStyle':return(t.fan+t.style)*.9;
      default:return 0;
    }
  }
  possessionScore(run, match) {
    const opp=this.opponent(match.opponentId), p=match.possession-1, rng=this.random.rng(run.seed,`ai:${run.week}:${match.possession}`);
    let base=100+run.week*18+(opp.final?30:0); base*=opp.curve[p]||1; base+=match.intent.bonus;
    for(const rule of opp.aiRules || []) {
      if(rule.type==='momentum_copy') base += Math.min(Number(rule.cap||25),match.turn.momentum*Number(rule.factor||0));
      else if(rule.type==='snitch_scale') match.aiSnitch += Number(rule.base||0)+match.possession*Number(rule.perPossession||0);
      else if(rule.type==='weather_bonus' && match.weatherId!==rule.unless) base += Number(rule.amount||0);
      else if(rule.type==='impact_threshold_bonus' && match.turn.impact>Number(rule.threshold||0)) base += Number(rule.amount||0);
      else if(rule.type==='weakest_cumulative_stat_bonus') {
        const totals=[match.metrics.momentum,match.metrics.control,match.metrics.style,match.metrics.fan];
        base += Math.max(0,Number(rule.target||0)-Math.min(...totals)*Number(rule.factor||0));
      }
    }
    const counter=this.counterAmount(match,match.intent); base-=Math.min(base*.35,counter);
    let score=Math.max(45,Math.round(base*(.94+rng()*.12)));
    const goals=Math.max(0,Math.floor((score-75)/95)); match.aiGoals+=goals;
    for(const rule of opp.aiRules || []) if(rule.type==='snitch_scale' && match.possession===5 && match.aiSnitch>=Number(rule.finalThreshold||Infinity)){score+=Number(rule.finalBonus||0);match.aiSnitchCaught=true;}
    this.events?.emit('AI_POSSESSION_RESOLVED',{opponentId:opp.id,score,goals,counter:Math.round(counter)});
    return {score,goals,counter:Math.round(counter)};
  }
}
function structuredCloneSafe(v){try{return structuredClone(v);}catch{return JSON.parse(JSON.stringify(v));}}
