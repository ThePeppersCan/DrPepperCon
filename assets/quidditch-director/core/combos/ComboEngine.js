export class ComboEngine {
  evaluate(match,def,tags,role){const prev=match.chain.at(-1);if(!prev)return{flowDelta:0,tags:[]};let flow=prev.role!==role?.toLowerCase()?0.05:0;const hits=[];const prevTags=prev.tags||[];
    const add=(condition,amount,label)=>{if(condition){flow+=amount;hits.push(label);}};
    add(tags.includes('pass')&&prevTags.includes('chaser'),.12,'chaser-pass');
    add(tags.includes('beater')&&prevTags.includes('support'),.10,'support-beater');
    add(tags.includes('flying')&&prevTags.includes('beater'),.10,'beater-flying');
    add(tags.includes('control')&&prevTags.includes('trick'),.12,'trick-control');
    add(tags.includes('crowd')&&new Set(match.turn.roles).size>=3,.12,'variety-crowd');
    return{flowDelta:flow,tags:hits};}
}
