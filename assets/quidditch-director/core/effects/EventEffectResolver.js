export class EventEffectResolver {
  constructor({data, random, logger = null} = {}) {this.data=data;this.random=random;this.logger=logger;}
  apply(run, profile, effects, stream){const rng=this.random.rng(run.seed,stream);for(const effect of effects||[])this.#applyOne(run,profile,effect,rng);}
  #matches(def,filter){if(!filter)return true;if(filter.type&&def.type!==filter.type)return false;if(filter.rarity&&def.rarity!==filter.rarity)return false;if(filter.tag&&!def.tags?.includes(filter.tag))return false;return true;}
  #pool(run,filter){return run.deck.filter(c=>this.#matches(this.data.cardById[c.id],filter));}
  #pick(rng,arr){return arr.length?arr[Math.floor(rng()*arr.length)]:null;}
  #newCard(run,id,upgrade=0){return {uid:`${run.seed}:card:${run.instanceCounter++}`,id,upgrade:Number(upgrade)||0};}
  #applyOne(run,profile,e,rng){
    switch(e.op){
      case'add_card':if(this.data.cardById[e.id])run.deck.push(this.#newCard(run,e.id));break;
      case'add_flag':run.flags[e.flag]=(Number(run.flags[e.flag])||0)+Number(e.value||0);break;
      case'set_flag':run.flags[e.flag]=e.value;break;
      case'upgrade_random':{const pool=this.#pool(run,e.filter);for(let i=0;i<Number(e.count||1)&&pool.length;i++){const c=this.#pick(rng,pool);c.upgrade=(c.upgrade||0)+1;}break;}
      case'upgrade_all':for(const c of this.#pool(run,e.filter))c.upgrade=(c.upgrade||0)+Number(e.amount||1);break;
      case'remove_random':{if(run.deck.length<=Number(e.minimumDeck||0))break;const pool=this.#pool(run,e.filter);for(let i=0;i<Number(e.count||1)&&pool.length;i++){const c=this.#pick(rng,pool),idx=run.deck.indexOf(c);if(idx>=0)run.deck.splice(idx,1);}break;}
      case'add_relic':if(this.data.relicById[e.id]&&!run.relics.includes(e.id))run.relics.push(e.id);break;
      case'duplicate_random':{const target=this.#pick(rng,run.deck);if(target)run.deck.push(this.#newCard(run,target.id,target.upgrade));break;}
      case'add_random_relic':{const allowed=new Set(run.unlockedRelics||[]),pool=this.data.relics.filter(r=>allowed.has(r.id)&&!run.relics.includes(r.id)),r=this.#pick(rng,pool);if(r)run.relics.push(r.id);break;}
      case'duplicate_best':{const copies={};for(const c of run.deck)copies[c.id]=(copies[c.id]||0)+1;const ranked=[...run.deck].sort((a,b)=>Number(b.upgrade||0)-Number(a.upgrade||0)||(copies[a.id]||0)-(copies[b.id]||0)||String(a.id).localeCompare(String(b.id)));const target=ranked[0];if(target)run.deck.push(this.#newCard(run,target.id,target.upgrade));break;}
      case'transform_random':for(let i=0;i<Number(e.count||1)&&run.deck.length;i++){const idx=Math.floor(rng()*run.deck.length),pool=(profile.unlockedCards||[]).filter(id=>this.data.cardById[id]);const id=this.#pick(rng,pool.length?pool:this.data.starterUnlocked);run.deck[idx]=this.#newCard(run,id,run.deck[idx].upgrade||0);}break;
      default:this.logger?.warn('EventEffectResolver','Unknown event operation',{op:e.op});
    }
  }
}
