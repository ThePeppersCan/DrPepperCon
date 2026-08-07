export class ComboEngine {
  constructor(tacticalBoard=null){this.tacticalBoard=tacticalBoard;}
  evaluate(match,def,tags,role,laneId=null){
    const prev=match.chain.at(-1);if(!prev)return{flowDelta:0,tags:[],reasons:[]};
    const reasons=[];let flow=0;const prevTags=prev.tags||[],r=String(role||'').toLowerCase();
    const add=(condition,amount,id,label)=>{if(condition){flow+=amount;reasons.push({id,label,delta:amount});}};
    const adjacent=this.tacticalBoard?.isAdjacent(prev.laneId,laneId)||false;
    add(prev.role===r,-.16,'shape-repeat','CROWDED SHAPE');
    add(adjacent,.04,'lane-link','LANE LINK');
    add(tags.includes('pass')&&prevTags.includes('chaser'),.30,'give-and-go','GIVE & GO');
    add(tags.includes('beater')&&prevTags.includes('support'),.25,'screen-and-strike','SCREEN & STRIKE');
    add(tags.includes('flying')&&prevTags.includes('beater'),.29,'launch-window','LAUNCH WINDOW');
    add(tags.includes('control')&&prevTags.includes('trick'),.27,'bait-and-read','BAIT & READ');
    add(tags.includes('crowd')&&new Set(match.turn.roles).size>=2,.18,'crowd-swell','CROWD SWELL');
    add(adjacent&&tags.includes('support')&&prevTags.some(t=>['chaser','beater','flying'].includes(t)),.12,'support-overlap','SUPPORT OVERLAP');
    add(prevTags.includes('pass')&&tags.includes('chaser'),.18,'return-pass','RETURN PASS');
    const uniqueBefore=new Set(match.turn.roles).size;
    const laneGroups=new Set([...match.chain.map(x=>this.tacticalBoard?.lane(x.laneId)?.group).filter(Boolean),this.tacticalBoard?.lane(laneId)?.group].filter(Boolean));
    add(match.chain.length>=2&&!match.turn.roles.includes(r)&&uniqueBefore>=2&&laneGroups.size>=3,.20,'three-shape','THREE-ZONE SHAPE');
    // A tiny adjacency tick is positional feedback, not a real combo. If the sequence has
    // no deliberate tactical link, Flow should drift down instead of rewarding card volume.
    const meaningful=reasons.some(x=>x.delta>0&&!['lane-link'].includes(x.id));
    if(!meaningful&&prev.role!==r){flow-=.07;reasons.push({id:'loose-shape',label:'LOOSE SHAPE',delta:-.07});}
    return{flowDelta:Math.round(flow*100)/100,tags:reasons.filter(x=>x.delta>0).map(x=>x.id),reasons};
  }
}
