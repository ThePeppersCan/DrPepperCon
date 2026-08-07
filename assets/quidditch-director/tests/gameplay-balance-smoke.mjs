import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DataStore} from '../app/DataLoader.js';
import {createServices} from '../app/ServiceRegistry.js';

const dir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../data');
const read=n=>JSON.parse(fs.readFileSync(path.join(dir,`${n}.json`),'utf8'));
const buildData=()=>new DataStore({cards:read('cards'),relics:read('relics'),opponents:read('opponents'),weathers:read('weathers'),events:read('events'),config:read('config'),achievements:read('achievements')});
function build(seed){const data=buildData(),s=createServices(data);s.random.createRunSeed=()=>seed;return{s,E:s.simulation};}

function moves(E,run){
  const m=run.match,out=[];
  for(let i=0;i<m.hand.length;i++){
    const inst=m.hand[i];if(E.effectiveCost(run,m,inst)>m.tempo)continue;
    for(const laneId of E.legalLanes(run,m,inst)){
      if(m.board.player[laneId])continue;
      const p=E.previewPlay(run,i,laneId);if(p.ok)out.push({i,laneId,p});
    }
  }
  return out;
}
function blindSpam(E,run){
  let step=0;
  while(step++<10){
    const m=run.match,all=moves(E,run);if(!all.length||m.turn.slotsUsed>=m.slotLimit)break;
    // Deterministic but intentionally ignorant of opponent intent, lane strength, Flow and resources.
    const move=all[(step*13+m.possession*7+run.week*5+String(run.seed).length)%all.length];
    const result=E.playCard(run,move.i,move.laneId);if(!result.ok)break;
  }
  return E.endPossession(run);
}
function tacticalPlay(E,run){
  let step=0;
  while(step++<10){
    const m=run.match,all=moves(E,run),state=E.previewState(run);if(!all.length||m.turn.slotsUsed>=m.slotLimit)break;
    for(const move of all){
      const opp=m.board.opponent[move.laneId],meaningful=(move.p.combo?.reasons||[]).filter(r=>r.delta>0&&r.id!=='lane-link').reduce((n,r)=>n+r.delta*70,0);
      const answer=opp?.active?18+(String(opp.label||'').match(/PRIMARY|SIGNATURE/)?8:0):0;
      const flips=opp?.active&&move.p.lanePower>=Number(opp.power||0)?12:0;
      const efficiency=move.p.lanePower/(move.p.cost+1)*1.2;
      const seeker=move.laneId==='seeker'&&m.possession>=4?10:0;
      move.value=move.p.lanePower+answer+flips+meaningful+efficiency+seeker;
    }
    all.sort((a,b)=>b.value-a.value);
    // Once a possession is already comfortably ahead, preserve Energy for Morale instead of spamming.
    if(m.turn.slotsUsed>=1&&state.projectedLead>28&&m.tempo>0)break;
    const best=all[0],result=E.playCard(run,best.i,best.laneId);if(!result.ok)break;
    const after=E.previewState(run);
    if(m.resources.momentum>=2&&!m.turn.surgeUsed){
      const flip=after.board.results.filter(r=>r.player&&r.opponent?.active&&r.result==='loss'&&r.margin>-11).sort((a,b)=>b.margin-a.margin)[0];
      if(flip)E.spendMomentum(run,flip.laneId);
    }
  }
  return E.endPossession(run);
}
function finishMatch(E,run,strategy){E.startMatch(run);while(run.phase==='match')strategy(E,run);return run.match.won;}
function advance(E,run,profile){if(run.phase!=='result')return;if(run.pendingReward?.options?.length)E.takeReward(run,run.pendingReward.options[0],profile);else E.skipReward(run);if(run.phase==='event')E.applyEvent(run,0,profile);}

const N=120;let blindFirst=0,blindSecond=0,smartFirst=0,smartSecond=0;
for(let i=0;i<N;i++){
  for(const [kind,strategy] of [['blind',blindSpam],['smart',tacticalPlay]]){
    const {E}=build(`gameplay-balance-${i}-${kind}`),profile=E.newProfile(),run=E.newRun(profile,'Balance');
    const first=finishMatch(E,run,strategy);if(kind==='blind')blindFirst+=first?1:0;else smartFirst+=first?1:0;
    advance(E,run,profile);
    if(run.phase==='hub'){
      const second=finishMatch(E,run,strategy);if(kind==='blind')blindSecond+=second?1:0;else smartSecond+=second?1:0;
    }
  }
}
const rate=n=>n/N;
const report={blindFirst:rate(blindFirst),smartFirst:rate(smartFirst),blindSecond:rate(blindSecond),smartSecond:rate(smartSecond)};
console.log('QD gameplay balance smoke',report);
if(report.smartFirst<0.90)throw new Error(`Tutorial became too punishing for deliberate play (${report.smartFirst})`);
if(report.blindSecond>0.55)throw new Error(`Blind card spam still wins match two too often (${report.blindSecond})`);
if(report.smartSecond<report.blindSecond+0.25)throw new Error(`Tactical play does not outperform blind spam enough (${report.smartSecond} vs ${report.blindSecond})`);
