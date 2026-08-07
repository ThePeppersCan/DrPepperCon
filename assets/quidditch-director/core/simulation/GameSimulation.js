export class GameSimulation {
  constructor({data,runManager,matchManager,replay,events,effectQueue}={}){Object.assign(this,{data,runManager,matchManager,replay,events,effectQueue});}
  newProfile(){return this.runManager.newProfile();}
  sanitizeProfile(raw){return this.runManager.sanitizeProfile(raw);}
  newRun(profile,manager){const run=this.runManager.newRun(profile,manager);this.replay.reset(run.seed,this.data.config.balanceVersion);return run;}
  startMatch(run){this.effectQueue.reset();this.replay.record('START_MATCH',{week:run.week});return this.matchManager.startMatch(run);}
  playCard(run,index){const result=this.matchManager.playCard(run,index);if(result?.ok)this.replay.record('PLAY_CARD',{index,cardId:result.def.id});return result;}
  endPossession(run){this.replay.record('END_POSSESSION',{possession:run.match?.possession});const summary=this.matchManager.endPossession(run);if(summary?.matchEnded)this.runManager.finishMatch(run);return summary;}
  mulligan(run){const r=this.matchManager.mulligan(run);if(r?.ok)this.replay.record('MULLIGAN',{});return r;}
  effectiveCost(run,match,inst){return this.matchManager.effectiveCost(run,match,inst);}
  takeReward(run,choiceId,profile){this.replay.record('TAKE_REWARD',{choiceId});return this.runManager.takeReward(run,choiceId,profile);}
  skipReward(run){this.replay.record('SKIP_REWARD',{});return this.runManager.skipReward(run);}
  applyEvent(run,choiceIndex,profile){this.replay.record('EVENT_CHOICE',{choiceIndex});return this.runManager.applyEvent(run,choiceIndex,profile);}
  grantMetaUnlocks(profile,run){return this.runManager.grantMetaUnlocks(profile,run);}
  clubSummary(run){return this.runManager.clubSummary(run);}
  cardDef(inst){return this.matchManager.cardDef(inst);}
  hasRelic(run,id){return this.matchManager.hasRelic(run,id);}
  clone(v){return this.matchManager.clone(v);}
  exportReplay(){return this.replay.export();}
}
