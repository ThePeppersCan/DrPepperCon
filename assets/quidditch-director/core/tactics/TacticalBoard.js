export const TACTICAL_LANES = Object.freeze([
  {id:'chaser_left',label:'LEFT CHASER',short:'L CHASER',group:'chaser',key:'Q'},
  {id:'chaser_center',label:'CENTRE CHASER',short:'C CHASER',group:'chaser',key:'W'},
  {id:'chaser_right',label:'RIGHT CHASER',short:'R CHASER',group:'chaser',key:'E'},
  {id:'beater_left',label:'LEFT BEATER',short:'L BEATER',group:'beater',key:'A'},
  {id:'beater_right',label:'RIGHT BEATER',short:'R BEATER',group:'beater',key:'S'},
  {id:'seeker',label:'SEEKER LANE',short:'SEEKER',group:'seeker',key:'D'}
]);

const ADJACENCY=Object.freeze({
  chaser_left:['chaser_center','beater_left'],
  chaser_center:['chaser_left','chaser_right','beater_left','beater_right','seeker'],
  chaser_right:['chaser_center','beater_right'],
  beater_left:['chaser_left','chaser_center','beater_right','seeker'],
  beater_right:['chaser_right','chaser_center','beater_left','seeker'],
  seeker:['chaser_center','beater_left','beater_right']
});

function clamp(v,min,max){return Math.max(min,Math.min(max,v));}
function unique(values){return [...new Set(values)];}

export class TacticalBoard {
  constructor(config={}){
    this.config=config?.tacticalBoard||{};
    this.lanes=TACTICAL_LANES;
    this.byId=Object.fromEntries(TACTICAL_LANES.map(l=>[l.id,l]));
  }
  lane(id){return this.byId[id]||null;}
  isAdjacent(a,b){return Boolean(a&&b&&ADJACENCY[a]?.includes(b));}
  createEmptyPlayer(){return Object.fromEntries(this.lanes.map(l=>[l.id,null]));}
  normalizeBoard(match){
    match.board=match.board||{};
    match.board.player=match.board.player||this.createEmptyPlayer();
    for(const lane of this.lanes)if(!(lane.id in match.board.player))match.board.player[lane.id]=null;
    match.board.opponent=match.board.opponent||Object.fromEntries(this.lanes.map(l=>[l.id,{power:0,active:false,label:''}]));
    return match.board;
  }
  legalLanes(def,tags=[]){
    const has=t=>tags.includes(t), all=this.lanes.map(l=>l.id), chasers=this.lanes.filter(l=>l.group==='chaser').map(l=>l.id), beaters=this.lanes.filter(l=>l.group==='beater').map(l=>l.id);
    if(has('wildcard'))return all;
    if(has('flying')&&has('beater'))return [...beaters,'seeker'];
    if(has('flying')||has('seeker')||has('snitch'))return [...chasers,'seeker'];
    if(has('beater')&&(has('player')||has('equipment')))return beaters;
    if(has('chaser')&&has('player'))return chasers;
    if(has('support')||has('pass')||has('control')||has('trick')||has('staff')||has('training')||has('crowd')||has('sponsor'))return [...chasers,...beaters];
    return chasers;
  }
  affinity(def,tags,laneId){
    const lane=this.lane(laneId);if(!lane)return 0;
    const has=t=>tags.includes(t);
    if(has('wildcard'))return 1.05;
    if(lane.group==='seeker')return has('flying')||has('seeker')||has('snitch')?1.30:0.55;
    if(lane.group==='beater'){
      if(has('beater'))return 1.24;
      if(has('control')||has('support')||has('staff')||has('equipment'))return 1.02;
      if(has('crowd')||has('trick')||has('pass'))return .88;
      return .72;
    }
    if(lane.group==='chaser'){
      if(has('chaser'))return 1.22;
      if(has('pass'))return 1.13;
      if(has('control')||has('support')||has('trick')||has('crowd')||has('staff'))return 1.00;
      if(has('flying'))return .88;
      return .78;
    }
    return 1;
  }
  cardPower(def,inst,tags,laneId,{fatigueEnabled=false,delta={},comboDelta=0}={}){
    const affinity=this.affinity(def,tags,laneId);
    let raw=8+Number(def.cost||0)*3+Number(inst?.upgrade||0)*2+(tags.includes('player')?2:0)+(tags.includes('legendary')?3:0);
    raw+=Math.max(0,Number(delta.impact||0))*.18;
    raw+=Math.max(0,Number(delta.control||0))*.42;
    raw+=Math.max(0,Number(delta.momentum||0))*.36;
    raw+=Math.max(0,Number(delta.pressure||0))*.34;
    raw+=Math.max(0,Number(delta.style||0))*.28;
    raw+=Math.max(0,Number(delta.fan||0))*.22;
    // Deliberate links make the actual board placement stronger; loose sequencing makes it
    // weaker. This turns combo knowledge into positional advantage rather than math homework.
    raw*=1+clamp(Number(comboDelta||0),-.25,.40)*.75;
    if(fatigueEnabled&&tags.includes('player')){
      const fatigue=Math.max(0,Number(inst?.fatigue||0));
      if(fatigue>=2)raw*=Math.max(.62,1-(fatigue-1)*.12);
    }
    return Math.round(clamp(raw*affinity,4,48)*10)/10;
  }
  weatherLaneDelta(match,placement,laneId){
    const tags=placement?.tags||[],weather=match.weatherId;
    if(weather==='crosswind')return laneId==='seeker'?2:laneId.startsWith('beater_')?-1:0;
    if(weather==='rain')return tags.includes('support')?2:tags.includes('trick')?-1:0;
    if(weather==='fog')return laneId==='seeker'&&!tags.includes('control')?-1:0;
    if(weather==='storm')return laneId.startsWith('beater_')?1.5:0;
    return 0;
  }
  evaluate(match){
    this.normalizeBoard(match);
    const player={};
    for(const lane of this.lanes){
      const p=match.board.player[lane.id];
      player[lane.id]=p?{...p,power:Number(p.power||0)+Number(p.surge||0)+this.weatherLaneDelta(match,p,lane.id),supportBonus:0}:null;
    }
    // Support / staff / crowd cards create local shape instead of another global +number.
    for(const lane of this.lanes){
      const p=player[lane.id];if(!p)continue;
      const assists=(p.tags||[]).some(t=>['support','staff','crowd','training'].includes(t));if(!assists)continue;
      for(const otherId of ADJACENCY[lane.id]||[]){const other=player[otherId];if(other){other.power+=3;other.supportBonus=(other.supportBonus||0)+3;}}
    }
    const results=[];
    let playerWins=0,aiWins=0,playerOpen=0,aiOpen=0,playerMargin=0,aiMargin=0;
    let playerChaserWins=0,aiChaserWins=0,playerChaserOpen=0,aiChaserOpen=0,playerBeaterWins=0,aiBeaterWins=0;
    let seekerResult='empty',seekerMargin=0,seekerPlayer=false,seekerOpponent=false;
    for(const lane of this.lanes){
      const pp=Number(player[lane.id]?.power||0),opEntry=match.board.opponent?.[lane.id]||null,op=Number(opEntry?.power||0),pActive=Boolean(player[lane.id]),oActive=Boolean(opEntry?.active||op>0),margin=Math.round((pp-op)*10)/10;
      let result='tie';
      if(pActive&&oActive){
        if(margin>=1)result='win';else if(margin<=-1)result='loss';
        if(result==='win'){playerWins++;playerMargin+=Math.min(16,margin);if(lane.group==='chaser')playerChaserWins++;if(lane.group==='beater')playerBeaterWins++;}
        else if(result==='loss'){aiWins++;aiMargin+=Math.min(16,Math.abs(margin));if(lane.group==='chaser')aiChaserWins++;if(lane.group==='beater')aiBeaterWins++;}
      }else if(pActive){
        result='opportunity';playerOpen++;
        if(lane.group==='chaser')playerChaserOpen++;
      }else if(oActive){
        result='threat';aiOpen++;
        if(lane.group==='chaser')aiChaserOpen++;
      }else result='empty';
      if(lane.group==='seeker'){seekerResult=result;seekerMargin=margin;seekerPlayer=pActive;seekerOpponent=oActive;}
      results.push({laneId:lane.id,group:lane.group,playerPower:Math.round(pp),opponentPower:Math.round(op),margin,result,player:player[lane.id]||null,opponent:opEntry});
    }
    // Chaser scoring requires a real shape, not simply dumping two cards into empty lanes.
    // A contested win counts twice; an uncontested lane counts once. Three points creates
    // a goal, five points plus a strong contested margin creates a second goal.
    const playerChaserControl=playerChaserWins*2+playerChaserOpen;
    const aiChaserControl=aiChaserWins*2+aiChaserOpen;
    const playerChaserGoals=(playerChaserControl>=3?1:0)+(playerChaserControl>=5&&playerMargin>=10?1:0);
    const aiChaserGoals=(aiChaserControl>=3?1:0)+(aiChaserControl>=5&&aiMargin>=10?1:0);
    let playerSeekerGain=0,aiSeekerGain=0;
    if(seekerPlayer&&seekerOpponent){
      if(seekerResult==='win')playerSeekerGain=12+Math.min(10,Math.max(0,Math.floor(seekerMargin)));
      else if(seekerResult==='loss')aiSeekerGain=12+Math.min(10,Math.max(0,Math.floor(-seekerMargin)));
      else {playerSeekerGain=4;aiSeekerGain=4;}
    }else if(seekerPlayer){playerSeekerGain=8+Math.min(5,Math.floor(Number(player.seeker?.power||0)/5));}
    else if(seekerOpponent){aiSeekerGain=8+Math.min(5,Math.floor(Number(match.board.opponent?.seeker?.power||0)/5));}
    const openPlayerEdge=results.filter(r=>r.result==='opportunity').reduce((n,r)=>n+2+Math.min(3,r.playerPower*.12),0);
    const openAiEdge=results.filter(r=>r.result==='threat').reduce((n,r)=>n+9+Math.min(7,r.opponentPower*.38)+(String(r.opponent?.label||'').match(/PRIMARY|SIGNATURE/)?5:0),0);
    const tacticalEdge=Math.round(playerWins*10+playerMargin*.9+openPlayerEdge+playerBeaterWins*5);
    const aiTacticalEdge=Math.round(aiWins*10+aiMargin*.9+openAiEdge+aiBeaterWins*5);
    const aiSuppression=Math.round(playerBeaterWins*5+Math.max(0,results.filter(r=>r.group==='beater'&&r.result==='win').reduce((n,r)=>n+Math.min(10,r.margin),0))*.45);
    return {results,playerWins,aiWins,playerOpen,aiOpen,playerChaserWins,aiChaserWins,playerChaserOpen,aiChaserOpen,playerBeaterWins,aiBeaterWins,playerChaserGoals,aiChaserGoals,playerSeekerGain,aiSeekerGain,tacticalEdge,aiTacticalEdge,aiSuppression};
  }
  recommendedLane(def,tags,board){
    const legal=this.legalLanes(def,tags).filter(id=>!board?.player?.[id]);
    return legal.sort((a,b)=>this.affinity(def,tags,b)-this.affinity(def,tags,a))[0]||null;
  }
}
