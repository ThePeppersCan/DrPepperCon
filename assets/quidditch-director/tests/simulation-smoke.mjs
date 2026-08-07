import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DataStore} from '../app/DataLoader.js';
import {createServices} from '../app/ServiceRegistry.js';
const dir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../data');
const read=n=>JSON.parse(fs.readFileSync(path.join(dir,`${n}.json`),'utf8'));
const data=new DataStore({cards:read('cards'),relics:read('relics'),opponents:read('opponents'),weathers:read('weathers'),events:read('events'),config:read('config'),achievements:read('achievements')});
const services=createServices(data), E=services.simulation;
let completed=0;
for(let r=0;r<100;r++){
  const profile=E.newProfile(),run=E.newRun(profile,'Test');
  let guard=0;
  while(!run.finished&&guard++<100){
    if(run.phase==='hub')E.startMatch(run);
    else if(run.phase==='match'){
      let m=run.match, cardGuard=0;
      while(m && !m.finished && cardGuard++<100){
        let played=false;
        for(let i=0;i<m.hand.length;i++){
          const cost=E.effectiveCost(run,m,m.hand[i]);
          if(cost<=m.tempo){const res=E.playCard(run,i);if(res.ok){played=true;break;}}
        }
        if(!played||m.tempo<=0){E.endPossession(run);m=run.match;if(run.phase!=='match')break;}
      }
    } else if(run.phase==='result'){
      if(run.pendingReward?.options?.length)E.takeReward(run,run.pendingReward.options[0],profile);else E.skipReward(run);
    } else if(run.phase==='event')E.applyEvent(run,0,profile);
    else if(run.phase==='run_end')break;
  }
  if(!run.finished)throw new Error(`Run ${r} did not finish; phase=${run.phase}`);
  completed++;
}
console.log(`QD architecture smoke test: ${completed}/100 runs completed.`);
console.log('Stats',services.statistics.snapshot());
