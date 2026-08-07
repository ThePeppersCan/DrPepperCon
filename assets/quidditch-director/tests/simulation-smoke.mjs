import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DataStore} from '../app/DataLoader.js';
import {createServices} from '../app/ServiceRegistry.js';

const dir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../data');
const read=n=>JSON.parse(fs.readFileSync(path.join(dir,`${n}.json`),'utf8'));
const makeData=()=>new DataStore({cards:read('cards'),relics:read('relics'),opponents:read('opponents'),weathers:read('weathers'),events:read('events'),config:read('config'),achievements:read('achievements')});

function legalMoves(E,run){
  const m=run.match,moves=[];
  for(let i=0;i<m.hand.length;i++){
    const inst=m.hand[i];if(E.effectiveCost(run,m,inst)>m.tempo)continue;
    for(const laneId of E.legalLanes(run,m,inst)){
      if(m.board.player[laneId])continue;
      const preview=E.previewPlay(run,i,laneId);if(preview.ok)moves.push({i,laneId,preview});
    }
  }
  return moves;
}
function playPossession(E,run){
  let guard=0;
  while(guard++<12){
    const m=run.match,moves=legalMoves(E,run);if(!moves.length||m.turn.slotsUsed>=m.slotLimit)break;
    // Smoke-test strategy is deliberately simple but lane-aware so it cannot stall on an
    // occupied first choice after the tactical-board redesign.
    moves.sort((a,b)=>b.preview.lanePower-a.preview.lanePower);
    const move=moves[0],result=E.playCard(run,move.i,move.laneId);if(!result.ok)throw new Error(`Playable move rejected: ${result.reason}`);
  }
  return E.endPossession(run);
}

const data=makeData(),services=createServices(data),E=services.simulation;
let completed=0;
for(let r=0;r<100;r++){
  services.random.createRunSeed=()=>`architecture-smoke-${r}`;
  const profile=E.newProfile(),run=E.newRun(profile,'Test');let guard=0;
  while(!run.finished&&guard++<160){
    if(run.phase==='hub')E.startMatch(run);
    else if(run.phase==='match')playPossession(E,run);
    else if(run.phase==='result'){
      if(run.pendingReward?.options?.length)E.takeReward(run,run.pendingReward.options[0],profile);else E.skipReward(run);
    }else if(run.phase==='event')E.applyEvent(run,0,profile);
    else if(run.phase==='run_end')break;
    else throw new Error(`Unexpected phase ${run.phase}`);
  }
  if(!run.finished)throw new Error(`Run ${r} did not finish; phase=${run.phase}`);
  completed++;
}
console.log(`QD architecture smoke test: ${completed}/100 runs completed.`);
console.log('Stats',services.statistics.snapshot());

// Migration guard: a pre-tactical-board mid-match save must reopen into a playable board
// rather than the blank-screen state that the prototype used to hit on refresh.
{
  const migrationServices=createServices(makeData()),ME=migrationServices.simulation;
  migrationServices.random.createRunSeed=()=>`legacy-mid-match`;
  const profile=ME.newProfile(),legacyRun=ME.newRun(profile,'Migration');ME.startMatch(legacyRun);
  delete legacyRun.match.board;delete legacyRun.match.resources;delete legacyRun.match.intent;delete legacyRun.match.learningStage;
  legacyRun.match.turn={impact:legacyRun.match.turn.impact,flow:legacyRun.match.turn.flow};
  const preview=ME.previewState(legacyRun);
  if(!preview?.board?.results?.length)throw new Error('Legacy mid-match save did not rebuild tactical board.');
  if(!Object.values(legacyRun.match.board.opponent||{}).some(x=>Number(x?.power||0)>0))throw new Error('Legacy mid-match save did not restore opponent commitments.');
}
console.log('QD legacy mid-match migration guard passed.');
