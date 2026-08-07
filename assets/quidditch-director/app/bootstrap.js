import { loadGameData } from './DataLoader.js';
import { createServices } from './ServiceRegistry.js';

const VERSION='20260807-gameplay3';
async function boot(){
  const data=await loadGameData({version:VERSION});
  const services=createServices(data);
  const S=services.simulation,C=services.commandBus;
  C.register('NEW_RUN',c=>S.newRun(c.profile,c.manager));
  C.register('START_MATCH',c=>S.startMatch(c.run));
  C.register('PLAY_CARD',c=>S.playCard(c.run,c.index,c.laneId));
  C.register('SPEND_MOMENTUM',c=>S.spendMomentum(c.run,c.laneId));
  C.register('END_POSSESSION',c=>S.endPossession(c.run));
  C.register('MULLIGAN',c=>S.mulligan(c.run));
  C.register('TAKE_REWARD',c=>S.takeReward(c.run,c.choiceId,c.profile));
  C.register('SKIP_REWARD',c=>S.skipReward(c.run));
  C.register('APPLY_EVENT',c=>S.applyEvent(c.run,c.choiceIndex,c.profile));
  C.register('GRANT_META_UNLOCKS',c=>S.grantMetaUnlocks(c.profile,c.run));
  const engine={
    newProfile:()=>S.newProfile(),sanitizeProfile:r=>S.sanitizeProfile(r),
    newRun:(profile,manager)=>C.dispatch({type:'NEW_RUN',profile,manager}),
    startMatch:run=>C.dispatch({type:'START_MATCH',run}),playCard:(run,index,laneId=null)=>C.dispatch({type:'PLAY_CARD',run,index,laneId}),
    previewPlay:(run,index,laneId=null)=>S.previewPlay(run,index,laneId),previewState:run=>S.previewState(run),legalLanes:(run,match,inst)=>S.legalLanes(run,match,inst),spendMomentum:(run,laneId)=>C.dispatch({type:'SPEND_MOMENTUM',run,laneId}),
    endPossession:run=>C.dispatch({type:'END_POSSESSION',run}),mulligan:run=>C.dispatch({type:'MULLIGAN',run}),
    effectiveCost:(run,match,inst)=>S.effectiveCost(run,match,inst),
    takeReward:(run,choiceId,profile)=>C.dispatch({type:'TAKE_REWARD',run,choiceId,profile}),skipReward:run=>C.dispatch({type:'SKIP_REWARD',run}),
    applyEvent:(run,choiceIndex,profile)=>C.dispatch({type:'APPLY_EVENT',run,choiceIndex,profile}),grantMetaUnlocks:(profile,run)=>C.dispatch({type:'GRANT_META_UNLOCKS',profile,run}),
    clubSummary:run=>S.clubSummary(run),cardDef:inst=>S.cardDef(inst),hasRelic:(run,id)=>S.hasRelic(run,id),clone:v=>S.clone(v),exportReplay:()=>S.exportReplay()
  };
  const runtime={version:VERSION,data:data.compatibilityView(),dataStore:data,engine,services,host:globalThis.__QD_HOST__||null,ready:true,debugState:null};
  globalThis.QD_RUNTIME=runtime;
  // Compatibility facade keeps the current presentation layer and old saves working while
  // the core is now modular and data-driven.
  globalThis.QD_DATA=runtime.data;
  globalThis.QD_ENGINE=runtime.engine;
  globalThis.QD_DEV={run:(command,...args)=>services.developerConsole.run(command,...args),help:()=>services.developerConsole.run('help'),runtime};
  globalThis.addEventListener('error',event=>{if(String(event.filename||'').includes('quidditch-director'))services.logger.error('Window',event.message,{filename:event.filename,lineno:event.lineno,colno:event.colno});});
  globalThis.addEventListener('unhandledrejection',event=>services.logger.error('Promise','Unhandled rejection',{reason:String(event.reason)}));
  await import(`../presentation/LegacyGameView.js?v=${VERSION}`);
}
boot().catch(error=>{
  console.error('[QD:BOOT] Failed to start Quidditch Director',error);
  const button=document.getElementById('openQuidditchDirector'),dialog=document.getElementById('quidditchDirectorDialog'),root=document.getElementById('qdRoot');
  if(button&&dialog&&root){
    button.addEventListener('click',event=>{
      event.preventDefault();
      event.stopImmediatePropagation();
      root.innerHTML=`<div class="qd-panel" style="margin:40px;padding:28px"><h2 class="qd-heading">Quidditch Director could not start</h2><p class="qd-sub">${String(error?.message||error).replace(/[&<>]/g,'')}</p><p class="qd-sub">Hard refresh once. If it persists, open the browser console and copy the QD:BOOT error.</p></div>`;
      if(!dialog.open) dialog.showModal();
    },true);
  }
});
