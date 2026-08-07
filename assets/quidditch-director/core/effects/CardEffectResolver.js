export class CardEffectResolver {
  constructor({random, effectQueue, logger = null} = {}) {
    this.random=random; this.effectQueue=effectQueue; this.logger=logger;
  }
  resolve(program, ctx) {
    if(!Array.isArray(program)) return;
    ctx.programState={snitchCaughtBefore:!!ctx.match.snitchCaught,snitchCaughtThisProgram:false};
    for(const effect of program) this.#runEffect(effect,ctx);
  }
  #runEffect(effect,ctx){
    if(!this.#condition(effect.when,ctx)) return;
    const strength=ctx.strength;
    const scaled=(value)=>this.#value(value,ctx)*strength;
    switch(effect.op){
      case 'set_resource_echo':{
        const echoes=ctx.match.flags.resourceEcho||(ctx.match.flags.resourceEcho={});
        const current=Number(echoes[effect.resource]||0);
        if(effect.mode==='max')echoes[effect.resource]=Math.max(current,Number(effect.value||0));
        else if(effect.mode==='echo_upgrade')echoes[effect.resource]=current?Number(effect.repeatValue??effect.value):Number(effect.value||0);
        else echoes[effect.resource]=Number(effect.value||0);
        break;
      }
      case 'arm_nth_tag_retrigger':{
        const rules=ctx.match.flags.nthTagRetriggers||(ctx.match.flags.nthTagRetriggers=[]);
        let rule=rules.find(r=>r.tag===effect.tag&&r.reason===effect.reason);
        if(!rule){rule={tag:effect.tag,every:Number(effect.every||3),strength:Number(effect.strength||.7),reason:effect.reason||'RETRIGGER',count:0};rules.push(rule);}
        break;
      }
      case 'set_flag':{
        const current=ctx.match.flags[effect.flag];
        if(effect.mode==='max') ctx.match.flags[effect.flag]=Math.max(Number(current||0),Number(effect.value||0));
        else if(effect.mode==='echo_upgrade') ctx.match.flags[effect.flag]=current?Number(effect.repeatValue??effect.value):Number(effect.value||0);
        else ctx.match.flags[effect.flag]=effect.value;
        if(effect.flag==='nextFree'&&effect.value)ctx.match.flags.nextFreeSourceUid=ctx.inst.uid;
        break;
      }
      case 'add_stat': ctx.helpers.addStat(effect.stat,scaled(effect.value)); break;
      case 'add_flow': ctx.helpers.addFlow(scaled(effect.value)); break;
      case 'draw': if(!ctx.opts.echo || !effect.when?.notEcho) ctx.helpers.draw(Number(effect.count||1),effect.tag||null); break;
      case 'floating': ctx.match.turn.floating.push({kind:effect.kind||'card',text:String(effect.text||'')}); break;
      case 'add_goal': ctx.helpers.addGoal(Number(effect.count||1),ctx.inst,effect.reason||'GOAL!'); break;
      case 'add_critical':{
        const count=Number(effect.count||1);ctx.match.turn.critical+=count;ctx.match.metrics.critical+=count;
        if(effect.text)ctx.match.turn.floating.push({kind:'critical',text:effect.text});break;
      }
      case 'arm_first_tag_retrigger':{
        ctx.match.flags.firstTagRetrigger={tag:effect.tag,selfStrength:Number(effect.selfStrength||1),otherStrength:Number(effect.otherStrength||.75),sourceUid:ctx.inst.uid,consumed:!!ctx.match.flags.firstBeaterSeen};
        if(!ctx.opts.echo && ctx.tags.includes(effect.tag) && !ctx.match.flags.firstBeaterSeen){ctx.match.flags.firstBeaterSeen=true;ctx.match.flags.firstTagRetrigger.consumed=true;ctx.helpers.activateCard(ctx.inst,Number(effect.selfStrength||1),{echo:true,noChain:true,reason:'DOUBLE TAP'});}break;
      }
      case 'retrigger': this.#retrigger(effect,ctx); break;
      case 'inherit_previous_role': ctx.match.flags.nextInheritedRole=ctx.match.chain.at(-2)?.role||null;ctx.match.flags.nextInheritedRoleSourceUid=ctx.inst.uid; break;
      case 'random_choice':{
        const rng=this.random.rng(ctx.run.seed,`${effect.stream||'effect'}:${ctx.run.week}:${ctx.match.possession}:${ctx.match.rngCounter++}`);
        const choice=effect.choices[Math.floor(rng()*effect.choices.length)]||[];for(const nested of choice)this.#runEffect(nested,ctx);break;
      }
      case 'discount_last_drawn': if(ctx.match.hand.length)ctx.match.hand.at(-1).costDown=Number(effect.amount||1); break;
      case 'upgrade_random': if(!ctx.opts.echo || !effect.when?.notEcho)ctx.helpers.upgradeRandom(Number(effect.count||1)); break;
      case 'equalize_lowest':{
        const keys=['momentum','control','style','fan'];const vals=keys.map(k=>[k,ctx.match.turn[k]||0]).sort((a,b)=>a[1]-b[1]);
        const low=vals[0][0],high=vals.at(-1)[1],delta=Math.max(0,high-(ctx.match.turn[low]||0));ctx.helpers.addStat(low,delta*strength);break;
      }
      case 'redraw_hand': if(!ctx.opts.echo || !effect.when?.notEcho)ctx.helpers.redrawHand(!!effect.makeCheapestFree); break;
      case 'multiply_final': ctx.match.turn.finalMultiplier*=Number(effect.factor||1); break;
      case 'set_snitch_caught': ctx.match.snitchCaught=!!effect.value;ctx.programState.snitchCaughtThisProgram=true; break;
      case 'arm_next_tag_retrigger':{
        const list=ctx.match.flags.nextTagRetriggers||(ctx.match.flags.nextTagRetriggers=[]);
        list.push({tag:effect.tag,strength:Number(effect.strength||.6),reason:effect.reason||'RETRIGGER',sourceUid:ctx.inst.uid});break;
      }
      default:this.logger?.warn('CardEffectResolver','Unknown card operation',{op:effect.op,card:ctx.def.id});
    }
  }
  #retrigger(effect,ctx){
    if(ctx.opts.echo && effect.when?.notEcho) return;
    const strength=Number(effect.strength||1),reason=effect.reason||'RETRIGGER';
    if(effect.target==='self')ctx.helpers.activateCard(ctx.inst,strength,{echo:true,noChain:true,reason});
    else if(effect.target==='first'){const target=ctx.match.turn.played[0];if(target)ctx.helpers.activateCard(target,strength,{echo:true,noChain:true,reason});}
    else if(effect.target==='previous'){const target=ctx.match.turn.played.at(-2);if(target)ctx.helpers.activateCard(target,strength,{echo:true,noChain:true,reason});}
    else if(effect.target==='lastTag'){
      const target=[...ctx.match.turn.played].reverse().find(x=>x.uid!==ctx.inst.uid&&ctx.helpers.cardDef(x)?.tags?.includes(effect.tag));
      if(target)ctx.helpers.activateCard(target,strength,{echo:true,noChain:true,reason});
    } else if(effect.target==='uniquePreviousRoles'){
      const roles=[...new Set(ctx.match.turn.roles.slice(0,-1))];
      for(const role of roles.slice(0,Number(effect.max||5))){
        const target=[...ctx.match.turn.played].reverse().find(x=>x.uid!==ctx.inst.uid&&ctx.helpers.roleForInstance(x)===role);
        if(target)ctx.helpers.activateCard(target,strength*ctx.strength,{echo:true,noChain:true,reason:`${reason} · ${role.toUpperCase()}`});
      }
    }
  }
  #value(spec,ctx){
    if(typeof spec==='number') return spec;
    if(spec==null) return 0;
    let value=0;
    if(spec.ref){
      const parts=String(spec.ref).split('.');let obj=ctx.match;
      for(const p of parts)obj=obj?.[p]; value=Number(obj||0);
    } else if(spec.uniqueRoles)value=new Set(ctx.match.turn.roles).size;
    else if(spec.uniquePreviousRoles)value=new Set(ctx.match.turn.roles.slice(0,-1)).size;
    else if(spec.intentBonus)value=Number(ctx.match.intent?.bonus||0);
    if(spec.div)value/=Number(spec.div);
    if(spec.floor)value=Math.floor(value);
    if(spec.mul!=null)value*=Number(spec.mul);
    if(spec.add!=null)value+=Number(spec.add);
    return value;
  }
  #condition(when,ctx){
    if(!when)return true;
    for(const [key,value] of Object.entries(when)){
      if(key==='notEcho' && value && ctx.opts.echo)return false;
      if(key==='flowGte' && ctx.match.turn.flow<Number(value))return false;
      if(key==='prevType' && ctx.prevDef?.type!==value)return false;
      if(key==='prevTag' && !ctx.prevDef?.tags?.includes(value))return false;
      if(key==='intentCounterIn' && !value.includes(ctx.match.intent?.counter))return false;
      if(key==='uniqueRolesGte' && new Set(ctx.match.turn.roles).size<Number(value))return false;
      if(key==='behind' && !(ctx.match.playerScore<ctx.match.aiScore))return false;
      if(key==='chainHasTag' && !ctx.match.chain.some(x=>x.tags?.includes(value)))return false;
      if(key==='chainLacksTag' && ctx.match.chain.some(x=>x.tags?.includes(value)))return false;
      if(key==='snitchGte' && ctx.match.snitchMeter<Number(value))return false;
      if(key==='snitchNotCaught' && value && ctx.match.snitchCaught)return false;
      if(key==='snitchNotCaughtBeforeProgram' && value && ctx.programState.snitchCaughtBefore)return false;
      if(key==='snitchCaughtThisProgram' && ctx.programState.snitchCaughtThisProgram!==value)return false;
      if(key==='projectedAhead'){
        const ahead=(ctx.match.playerScore+ctx.match.turn.impact)>ctx.match.aiScore;if(ahead!==value)return false;
      }
    }
    return true;
  }
}
