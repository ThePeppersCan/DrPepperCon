import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {DataStore} from '../app/DataLoader.js';import {createServices} from '../app/ServiceRegistry.js';
const dir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../data'),read=n=>JSON.parse(fs.readFileSync(path.join(dir,`${n}.json`),'utf8'));
const data=new DataStore({cards:read('cards'),relics:read('relics'),opponents:read('opponents'),weathers:read('weathers'),events:read('events'),config:read('config'),achievements:read('achievements')});
const make=(seed='regression')=>{const s=createServices(data);s.random.createRunSeed=()=>seed;const p=s.simulation.newProfile();p.unlockedCards=data.cards.map(c=>c.id);p.tutorialVersion=3;const r=s.simulation.newRun(p,'Test');s.simulation.startMatch(r);r.match.maxTempo=99;r.match.tempo=99;return{s,E:s.simulation,p,r};};
const manual=(r,ids)=>{const used=new Set();r.match.hand=ids.map((id,i)=>{const source=r.deck.find(c=>c.id===id&&!used.has(c.uid));if(source){used.add(source.uid);return {...source};}return{uid:`manual:${id}:${i}`,id,upgrade:0};});r.match.drawPile=[];r.match.discard=[];};
const play=(E,r,id,lane)=>{const i=r.match.hand.findIndex(x=>x.id===id);if(i<0)throw new Error(`Missing ${id}`);const out=E.playCard(r,i,lane);if(!out.ok)throw new Error(`${id}: ${out.reason}`);return out;};
// Practice must upgrade the chosen next card, not a random deck card.
{const {E,r}=make('practice-target');manual(r,['practice','rocky']);const before=r.deck.find(c=>c.id==='rocky').upgrade||0;play(E,r,'practice','beater_left');play(E,r,'rocky','chaser_left');const after=r.deck.find(c=>c.id==='rocky').upgrade||0;if(after!==before+1)throw new Error('Practice did not upgrade the deliberately chosen next card.');}
// Mod Ash should reward matching the inherited role with a draw instead of silently doing nothing.
{const {E,r}=make('mod-ash-role');r.match.slotLimit=4;manual(r,['give_go','mod_ash','give_go','rocky']);play(E,r,'give_go','chaser_left');play(E,r,'mod_ash','beater_left');const before=r.match.hand.length;play(E,r,'give_go','chaser_center');if(r.match.hand.length<before)throw new Error('Mod Ash role match failed to replace/draw a card.');}
// Rival requires both follow-up tags before awarding its payoff Goal.
{const {E,r}=make('rival-pair');r.match.slotLimit=4;manual(r,['rival','nimbler','besquelcher']);play(E,r,'rival','beater_left');const before=r.match.turn.goals;play(E,r,'nimbler','seeker');if(r.match.turn.goals!==before)throw new Error('Rival paid out before both halves were completed.');play(E,r,'besquelcher','beater_right');if(r.match.turn.goals!==before+1)throw new Error('Rival pair did not create its Goal.');}
// Debbie cannot turn an expensive Legendary into a free/discounted loop.
{const {E,r}=make('debbie-legendary');manual(r,['debbie','golden_snitch']);play(E,r,'debbie','chaser_left');play(E,r,'golden_snitch','seeker');E.endPossession(r);if(r.match.hand.some(x=>x.id==='golden_snitch'&&Number(x.costDown||0)>0))throw new Error('Debbie returned the Legendary payoff card.');if(!r.match.hand.some(x=>x.id==='debbie'))throw new Error('Debbie failed to preserve a legal non-Legendary return target.');}
// Relic rewards may never leak locked relics.
{const s=createServices(data),E=s.simulation,p=E.newProfile();s.random.createRunSeed=()=>`relic-lock`;const r=E.newRun(p,'Lock');const allowed=new Set(p.unlockedRelics);const offer=s.runManager.relicOptions(r).options;if(offer.some(id=>!allowed.has(id)))throw new Error(`Locked relic leaked into reward: ${offer}`);s.eventEffects.apply(r,p,[{op:'add_random_relic'}],'locked-event');if(r.relics.some(id=>!allowed.has(id)))throw new Error('Event leaked a locked relic.');}
// Skipping a reward grants exactly one Insight.
{const s=createServices(data),E=s.simulation,p=E.newProfile();s.random.createRunSeed=()=>`skip-one`;const r=E.newRun(p,'Skip');r.pendingReward={type:'card',options:['rocky']};const before=r.insight;E.skipReward(r);if(r.insight!==before+1)throw new Error(`Skip reward granted ${r.insight-before} Insight instead of 1.`);}

// Draft offers remain deterministic for the same seed despite their controlled variety.
{const makeDraft=()=>{const s=createServices(data),E=s.simulation,p=E.newProfile();p.unlockedCards=data.cards.map(c=>c.id);p.unlockedRelics=data.relics.map(r=>r.id);s.random.createRunSeed=()=>`same-draft-seed`;const r=E.newRun(p,'Draft');return s.runManager.draftOptions(r).options.join(',');};if(makeDraft()!==makeDraft())throw new Error('Draft generation is not deterministic.');}

console.log('QD balance regression suite passed.');
