// Repo Company Quidditch: smooth sudden-death animation timeline.
// This file may be appended to the end of the existing script.js.
// It prevents the repeating server-side 5 -> 0 sudden-death countdown from
// rewinding the pets' animation timeline every five seconds.
(function repoQuidditchSmoothSuddenDeath(){
  if(typeof qmSyncElapsed !== 'function' || typeof qmState === 'undefined')return;

  const previousElapsed=qmSyncElapsed;
  let matchId='';
  let suddenDeath=false;
  let suddenElapsed=180;
  let lastFrame=performance.now();

  function regulationExpired(state){
    const started=Date.parse(state?.match_started_at||'');
    if(Number.isFinite(started))return Date.now()-started>=179500;
    return Number(state?.phase_seconds)<=5;
  }

  qmSyncElapsed=function(){
    const now=performance.now();
    const state=qmState?.liveState;
    const incomingMatch=String(state?.match_id||'');

    if(incomingMatch!==matchId){
      matchId=incomingMatch;
      suddenDeath=false;
      suddenElapsed=180;
      lastFrame=now;
    }

    const isSuddenDeath=Boolean(
      state &&
      state.phase==='live' &&
      Number(state.left_score||0)===Number(state.right_score||0) &&
      regulationExpired(state)
    );

    if(isSuddenDeath){
      const dt=Math.min(.05,Math.max(0,(now-lastFrame)/1000));
      if(!suddenDeath){
        // Enter once at the end of regulation, then advance locally and
        // monotonically. Network polls can no longer push the action backwards.
        suddenElapsed=Math.max(180,Number(previousElapsed())||180);
        suddenDeath=true;
      }else{
        suddenElapsed+=dt;
      }
      lastFrame=now;
      return suddenElapsed;
    }

    suddenDeath=false;
    lastFrame=now;
    return previousElapsed();
  };
})();
