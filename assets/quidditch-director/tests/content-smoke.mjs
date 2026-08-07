import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {DataStore} from '../app/DataLoader.js';import {createServices} from '../app/ServiceRegistry.js';
const dir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../data'),read=n=>JSON.parse(fs.readFileSync(path.join(dir,`${n}.json`),'utf8'));
const data=new DataStore({cards:read('cards'),relics:read('relics'),opponents:read('opponents'),weathers:read('weathers'),events:read('events'),config:read('config'),achievements:read('achievements')});
function firstMove(E,run){const m=run.match;for(let i=0;i<m.hand.length;i++){const inst=m.hand[i];if(E.effectiveCost(run,m,inst)>m.tempo)continue;for(const laneId of E.legalLanes(run,m,inst)){if(m.board.player[laneId])continue;const pv=E.previewPlay(run,i,laneId);if(pv.ok)return{i,laneId};}}return null;}
for(const card of data.cards){
  const s=createServices(data),E=s.simulation,p=E.newProfile();s.random.createRunSeed=()=>`card-${card.id}`;p.unlockedCards=data.cards.map(c=>c.id);p.unlockedRelics=data.relics.map(r=>r.id);const run=E.newRun(p,'CardTest');
  E.startMatch(run);run.match.hand=[{uid:`${run.seed}:manual:${card.id}`,id:card.id,upgrade:0}];run.match.tempo=99;
  const inst=run.match.hand[0],lane=E.legalLanes(run,run.match,inst).find(id=>!run.match.board.player[id]);const res=E.playCard(run,0,lane);if(!res.ok)throw new Error(`${card.id} failed: ${res.reason}`);
}
for(const relic of data.relics){
  const s=createServices(data),E=s.simulation,p=E.newProfile();s.random.createRunSeed=()=>`relic-${relic.id}`;const run=E.newRun(p,'RelicTest');run.relics=[relic.id];E.startMatch(run);let guard=0;
  while(run.phase==='match'&&guard++<40){const move=firstMove(E,run);if(move&&run.match.turn.slotsUsed<run.match.slotLimit){const r=E.playCard(run,move.i,move.laneId);if(!r.ok)throw new Error(`Relic ${relic.id} move failed: ${r.reason}`);}else E.endPossession(run);}
  if(guard>=40)throw new Error(`Relic ${relic.id} stalled`);
}
for(const event of data.events){for(let i=0;i<event.choices.length;i++){const s=createServices(data),E=s.simulation,p=E.newProfile();s.random.createRunSeed=()=>`event-${event.id}-${i}`;const run=E.newRun(p,'EventTest');run.pendingEvent=JSON.parse(JSON.stringify(event));run.phase='event';const result=E.applyEvent(run,i,p);if(!result)throw new Error(`Event ${event.id} choice ${i} failed`);}}
console.log(`QD content smoke: ${data.cards.length} cards, ${data.relics.length} relics, ${data.events.reduce((n,e)=>n+e.choices.length,0)} event choices passed.`);
