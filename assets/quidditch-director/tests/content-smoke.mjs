import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {DataStore} from '../app/DataLoader.js';import {createServices} from '../app/ServiceRegistry.js';
const dir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../data'),read=n=>JSON.parse(fs.readFileSync(path.join(dir,`${n}.json`),'utf8'));
const data=new DataStore({cards:read('cards'),relics:read('relics'),opponents:read('opponents'),weathers:read('weathers'),events:read('events'),config:read('config'),achievements:read('achievements')});
for(const card of data.cards){
  const s=createServices(data),E=s.simulation,p=E.newProfile();p.unlockedCards=data.cards.map(c=>c.id);p.unlockedRelics=data.relics.map(r=>r.id);const run=E.newRun(p,'CardTest');
  E.startMatch(run);run.match.hand=[{uid:`${run.seed}:manual:${card.id}`,id:card.id,upgrade:0}];run.match.drawPile=run.match.drawPile.filter(c=>c.uid!==run.match.hand[0].uid);run.match.tempo=99;
  const res=E.playCard(run,0);if(!res.ok)throw new Error(`${card.id} failed: ${res.reason}`);
}
for(const relic of data.relics){
  const s=createServices(data),E=s.simulation,p=E.newProfile(),run=E.newRun(p,'RelicTest');run.relics=[relic.id];E.startMatch(run);let guard=0;while(run.phase==='match'&&guard++<30){const m=run.match;if(m.hand.length&&E.effectiveCost(run,m,m.hand[0])<=m.tempo)E.playCard(run,0);else E.endPossession(run);}if(guard>=30)throw new Error(`Relic ${relic.id} stalled`);
}
for(const event of data.events){for(let i=0;i<event.choices.length;i++){const s=createServices(data),E=s.simulation,p=E.newProfile(),run=E.newRun(p,'EventTest');run.pendingEvent=JSON.parse(JSON.stringify(event));run.phase='event';const result=E.applyEvent(run,i,p);if(!result)throw new Error(`Event ${event.id} choice ${i} failed`);}}
console.log(`QD content smoke: ${data.cards.length} cards, ${data.relics.length} relics, ${data.events.reduce((n,e)=>n+e.choices.length,0)} event choices passed.`);
