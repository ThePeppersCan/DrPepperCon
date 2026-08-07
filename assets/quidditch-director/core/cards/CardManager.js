export class CardManager {
  constructor(logger=null){this.logger=logger;}
  zones(match){return ['drawPile','hand','discard'];}
  moveByIndex(match,from,to,index){const src=match[from],dst=match[to];if(!Array.isArray(src)||!Array.isArray(dst))throw new Error(`Invalid card zone ${from} -> ${to}`);if(index<0||index>=src.length)return null;const [card]=src.splice(index,1);dst.push(card);return card;}
  moveCard(match,from,to,card){const idx=match[from]?.indexOf(card)??-1;return this.moveByIndex(match,from,to,idx);}
  moveAll(match,from,to){const moved=[...(match[from]||[])];match[to].push(...moved);match[from].length=0;return moved;}
  assertUnique(match){const seen=new Set();for(const zone of this.zones(match)){for(const card of match[zone]||[]){if(!card?.uid)continue;if(seen.has(card.uid)){this.logger?.error('CardManager','Card exists in multiple live zones',{uid:card.uid,zone});return false;}seen.add(card.uid);}}return true;}
}
