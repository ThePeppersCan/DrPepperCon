(() => {
'use strict';
const D=window.RepoDiverData,$=id=>document.getElementById(id);
let profile=null,run=null,engine=null,practice=false,inventory=[],dishLog=[],selectedMenu=[],service=null,treasureGp=0;
const defaultProfile=()=>({day_number:1,unlocked_biomes:['karamja'],equipment:{tank:1,cargo:1,harpoon:1,suit:1,boost:1},restaurant:{rank:1,tables:3,kitchen:1},fish_journal:{},recipes:['shrimp_skewer','grilled_trout'],stats:{deepest:0,total_fish:0,total_revenue:0,perfect_dishes:0},achievements:{}});
function snd(type){try{const C=window.AudioContext||window.webkitAudioContext;if(!C)return;const a=window.__rdac||(window.__rdac=new C()),o=a.createOscillator(),g=a.createGain();o.connect(g);g.connect(a.destination);const f={harpoon:260,catch:640,treasure:880,hit:95,perfect:1040,serve:520,order:420,cook:720,miss:150}[type]||350;o.frequency.value=f;g.gain.setValueAtTime(.045,a.currentTime);g.gain.exponentialRampToValueAtTime(.001,a.currentTime+.11);o.start();o.stop(a.currentTime+.12)}catch(_){} }
function show(view){document.querySelectorAll('#repoDiverDialog .rd-view').forEach(x=>x.classList.add('hidden'));$(view)?.classList.remove('hidden')}
function status(t,bad=false){const el=$('rdStatus');if(el){el.textContent=t||'';el.classList.toggle('bad',bad)}}
async function rpc(name,args={}){if(typeof db==='undefined')throw new Error('Database unavailable');const {data,error}=await db.rpc(name,args);if(error)throw error;return data}
async function loadProfile(){profile=defaultProfile();practice=false;try{const d=await rpc('repo_diver_get_profile');if(d)profile={...profile,...d,equipment:{...profile.equipment,...(d.equipment||{})},restaurant:{...profile.restaurant,...(d.restaurant||{})}}}catch(e){practice=true;status(`Reward service unavailable — Practice mode. ${e.message}`,true)}renderHome()}
function open(){const dlg=$('repoDiverDialog');if(!dlg)return;dlg.showModal();show('rdHomeView');loadProfile()}
function close(){engine?.stop();stopService();$('repoDiverDialog')?.close()}
function renderHome(){if(!profile)return;$('rdDay').textContent=profile.day_number||1;$('rdRank').textContent=['','BRONZE','SILVER','GOLD','PLATINUM','RUNE','GRANDMASTER'][Math.min(6,profile.restaurant?.rank||1)];$('rdDeepest').textContent=Math.round(profile.stats?.deepest||0)+'m';$('rdModeBadge').textContent=practice?'PRACTICE — NO REWARDS':'REWARDED';const bi=$('rdBiomes');bi.innerHTML='';for(const [id,b] of Object.entries(D.biomes)){const unlocked=(profile.unlocked_biomes||[]).includes(id);const bt=document.createElement('button');bt.className='rd-biome';bt.disabled=!unlocked;bt.innerHTML=`<strong>${b.name}</strong><small>${b.desc}</small><em>${unlocked?'DIVE':'LOCKED'}</em>`;bt.onclick=()=>startDive(id);bi.appendChild(bt)}renderUpgrades();renderJournal()}
async function startDive(biome){status('Preparing dive…');practice=false;run=null;try{const d=await rpc('repo_diver_start_day',{p_biome:biome});const row=Array.isArray(d)?d[0]:d;if(!row?.run_id)throw new Error('No run ID returned');run={id:row.run_id,biome}}catch(e){practice=true;run={id:null,biome};status(`Practice dive — ${e.message}`,true)}inventory=[];dishLog=[];selectedMenu=[];treasureGp=0;show('rdDiveView');const c=$('rdDiveCanvas');engine=new RepoDiverEngine(c,{hud:updateHud,inventory:toggleInv,message:t=>flash(t),catch:onCatch,treasure:gp=>treasureGp+=gp,surface:onSurface,rescue:onSurface,sound:snd});engine.start({biome,equipment:profile.equipment});$('rdDiveCanvas').focus()}
function updateHud(s){$('rdO2Fill').style.width=s.oxygen+'%';$('rdHpFill').style.width=s.hp+'%';$('rdDepth').textContent=Math.round(s.depth)+'m';$('rdCargo').textContent=`${s.weight.toFixed(1)} / ${s.cap.toFixed(0)}kg`;$('rdCatchCount').textContent=s.catches}
function onCatch(f,q,size,variant){inventory.push({id:f.id,q,size,variant});flash(`${variant?variant.toUpperCase()+' ':''}${f.name} ★${q}`)}
function flash(t){const e=$('rdFlash');if(!e)return;e.textContent=t;e.classList.add('show');clearTimeout(flash.t);flash.t=setTimeout(()=>e.classList.remove('show'),1500)}
function serviceToast(t,tone=''){const e=$('rdServiceToast');if(!e)return;e.textContent=t;e.className='rd-service-toast show '+tone;clearTimeout(serviceToast.t);serviceToast.t=setTimeout(()=>e.className='rd-service-toast',1700)}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function shuffled(a){const out=[...(a||[])];for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[out[i],out[j]]=[out[j],out[i]]}return out}
function petCatalog(){try{return typeof PET_CATALOG!=='undefined'&&PET_CATALOG?PET_CATALOG:{}}catch(_){return {}}}
async function loadRestaurantPetGuests(){
  const catalog=petCatalog();let rows=[];
  try{if(typeof db!=='undefined'){const {data,error}=await db.rpc('get_active_pets');if(error)throw error;rows=Array.isArray(data)?data:[]}}catch(e){console.warn('Repo Diver diner pets:',e)}
  const seen=new Set(),guests=[];
  for(const row of rows){const id=String(row?.active_pet||'').trim(),meta=catalog[id];if(!id||!meta?.image)continue;const owner=String(row?.username||'').trim(),key=(owner+'|'+id).toLowerCase();if(seen.has(key))continue;seen.add(key);guests.push({id,image:meta.image,name:String(row?.pet_name||meta.name||'Pet').trim()||'Pet',owner})}
  if(guests.length)return shuffled(guests);
  return shuffled(Object.entries(catalog).slice(0,18).map(([id,meta])=>({id,image:meta?.image||'',name:meta?.name||'Pet',owner:''})).filter(x=>x.image));
}
function nextRestaurantPet(){if(!service)return null;if(!service.petQueue?.length)service.petQueue=shuffled(service.petGuests||[]);return service.petQueue.shift()||null}
function toggleInv(){const p=$('rdInventory');p.classList.toggle('hidden');p.innerHTML=`<h4>CARGO</h4>${inventory.map(x=>`<div>${D.byId[x.id]?.name||x.id}<b>★${x.q}</b></div>`).join('')||'<small>Empty</small>'}`}
function onSurface(result){inventory=result.catches||inventory;show('rdSurfaceView');const list=$('rdCatchList');list.innerHTML=inventory.map(x=>`<div><b>${D.byId[x.id]?.name}</b><span>★${x.q} · ${x.size}cm ${x.variant?' · '+x.variant:''}</span></div>`).join('')||'<p>No fish recovered.</p>';$('rdSurfaceDepth').textContent=Math.round(result.maxDepth||0)+'m';$('rdSurfaceNotice').textContent=result.rescued?'Emergency rescue recovered part of your cargo.':'Dive complete. Choose tonight\'s menu.';buildMenu()}
function buildMenu(){const counts={};inventory.forEach(x=>counts[x.id]=(counts[x.id]||0)+1);const avail=D.recipes.filter(r=>r.fish.every(f=>counts[f]>0));const wrap=$('rdRecipeChoices');wrap.innerHTML='';avail.forEach(r=>{const b=document.createElement('button');b.className='rd-recipe-choice';b.innerHTML=`<b>${r.name}</b><small>${r.price} GP · ${r.xp} Cooking XP base</small>`;b.onclick=()=>{if(selectedMenu.includes(r.id))selectedMenu=selectedMenu.filter(x=>x!==r.id);else if(selectedMenu.length<4)selectedMenu.push(r.id);b.classList.toggle('selected',selectedMenu.includes(r.id));$('rdOpenRestaurant').disabled=!selectedMenu.length};wrap.appendChild(b)});if(!avail.length)wrap.innerHTML='<p>You did not bring back ingredients for a known recipe. Dive again and catch shrimp or trout to begin.</p>';$('rdOpenRestaurant').disabled=!selectedMenu.length}

/* ---------------- REPO COMPANY FISH HOUSE ---------------- */
const tablePositions=[[20,55],[50,55],[80,55],[27,78],[58,78],[84,78]];
function recipeStock(r){if(!service)return 0;return Math.min(...r.fish.map(f=>service.counts[f]||0))}
function unreservedCounts(){const left={...(service?.counts||{})},waiting={};for(const o of service?.orders||[])if(o.state==='waiting')waiting[o.id]=(waiting[o.id]||0)+1;for(const [id,total] of Object.entries(waiting)){const r=D.recipeById[id],spares=(service?.ready||[]).filter(x=>!x.cid&&x.id===id).length,rawReservations=Math.max(0,total-spares);for(let n=0;n<rawReservations;n++)r?.fish?.forEach(f=>left[f]=(left[f]||0)-1)}return left}
function canAcceptOrder(id){if(!service)return false;const waiting=service.orders.filter(o=>o.state==='waiting'&&o.id===id).length,spares=service.ready.filter(x=>!x.cid&&x.id===id).length;if(spares>waiting)return true;const r=D.recipeById[id],left=unreservedCounts();return !!r&&r.fish.every(f=>(left[f]||0)>0)}
function kitchenHasFutureFood(){if(!service)return false;if(service.ready.some(x=>!x.cid))return true;return selectedMenu.some(id=>recipeStock(D.recipeById[id])>0)}
function serviceWorkFinished(){return !!service&&!service.cooking&&service.orders.length===0}
async function startRestaurant(){
  if(!selectedMenu.length)return;
  show('rdRestaurantView');
  const counts={};inventory.forEach(x=>counts[x.id]=(counts[x.id]||0)+1);
  service={time:70,revenue:0,served:0,perfect:0,missed:0,orders:[],ready:[],counts,active:true,accepting:true,last:performance.now(),spawn:.15,cooking:null,nextCustomer:1,uiTick:0,soldOutFor:0,soldOutAnnounced:false,petGuests:[],petQueue:[]};
  dishLog=[];
  renderKitchenMenu();renderReadyCounter();renderOrders();renderCustomerScene();
  $('rdServiceTime').textContent='70';$('rdServed').textContent='0';$('rdServiceRevenue').textContent='0 GP';
  $('rdCookPanel').classList.add('hidden');
  serviceToast("CALLING TONIGHT'S PET DINERS…",'info');
  const guests=await loadRestaurantPetGuests();if(!service?.active)return;service.petGuests=guests;service.petQueue=shuffled(guests);service.last=performance.now();service.spawn=.08;
  serviceToast('FIRST CUSTOMER INCOMING — CLICK THEIR ORDER','info');
  service.raf=requestAnimationFrame(serviceLoop);
}
function renderKitchenMenu(){
  if(!service)return;
  const w=$('rdRestaurantMenu');
  w.innerHTML=selectedMenu.map(id=>{const r=D.recipeById[id],stock=recipeStock(r),busy=service.cooking?.id===id;return `<button data-cook="${id}" ${stock<1?'disabled':''}><span><b>${r.name}</b><small>${r.fish.map(f=>D.byId[f]?.name||f).join(' + ')}</small></span><em>${busy?'COOKING…':stock>0?`PREP SPARE · ${stock} LEFT`:'OUT OF STOCK'}</em></button>`}).join('');
  w.querySelectorAll('button[data-cook]').forEach(b=>b.onclick=()=>beginCook(b.dataset.cook,null));
}
function renderReadyCounter(){
  if(!service)return;const e=$('rdReadyCounter');
  if(!service.ready.length){e.innerHTML='<span class="empty">No dishes ready.</span>';return}
  e.innerHTML=service.ready.map((d,i)=>`<button data-ready="${i}" title="Ready dish"><b>${D.recipeById[d.id].name}</b><small>★${d.quality} ${d.cid?'RESERVED':'SPARE'}</small></button>`).join('');
}
function findFreeTable(){const used=new Set(service.orders.map(o=>o.table));for(let i=0;i<tablePositions.length;i++)if(!used.has(i))return i;return -1}
function spawnCustomer(){
  if(!service?.active||!service.accepting||service.orders.length>=6)return;
  const table=findFreeTable();if(table<0)return;
  const viable=selectedMenu.filter(canAcceptOrder);
  if(!viable.length)return;
  const id=viable[Math.floor(Math.random()*viable.length)],cid=service.nextCustomer++,max=18+Math.random()*8,guest=nextRestaurantPet();
  service.orders.push({cid,id,table,patience:max,maxPatience:max,state:'waiting',guest});snd('order');serviceToast(`${guest?.name?guest.name.toUpperCase()+' WANTS ':''}${D.recipeById[id].name.toUpperCase()} — CLICK TO COOK`,'info');renderRestaurantUI();
}
function cookStepNames(id){if(id.includes('skewer'))return ['PREP THE SKEWER','GRILL TO ORDER'];if(id.includes('curry')||id.includes('bowl'))return ['PREP INGREDIENTS','SIMMER & SEASON'];if(id.includes('steak')||id.includes('trout')||id.includes('snapper'))return ['SEASON THE FISH','GRILL TO ORDER'];if(id.includes('ray')||id.includes('plate')||id.includes('feast'))return ['PRECISION CUT','PLATE THE DISH'];return ['PREP INGREDIENTS','COOK TO ORDER']}
function setupCookStage(){
  const c=service?.cooking;if(!c)return;const r=D.recipeById[c.id],names=cookStepNames(c.id),stage=c.stage;
  c.t=0;c.duration=(stage===0?1.55:1.8)+(r.diff*.45);c.target=.25+Math.random()*.5;c.width=Math.max(.075,.19-r.diff*.075-(stage*.018));
  $('rdCookStage').textContent=`${names[stage]} · STAGE ${stage+1}/2`;$('rdCookDish').textContent=r.name;$('rdCookInstruction').textContent=stage===0?'Stop the marker in the green prep zone.':'One more timing hit — finish the dish in the green zone.';$('rdCookHit').textContent=stage===0?'PREP — SPACE / CLICK':'FINISH — SPACE / CLICK';
  $('rdCookPanel').classList.remove('hidden');snd('cook');
}
function beginCook(id,cid=null){
  if(!service?.active)return;if(service.cooking){serviceToast('FINISH THE DISH ALREADY ON THE STOVE','warn');return}
  const r=D.recipeById[id];if(!r){return}
  if(!r.fish.every(f=>(service.counts[f]||0)>0)){serviceToast('OUT OF THAT INGREDIENT','bad');snd('miss');return}
  if(cid&&service.orders.some(o=>o.cid===cid&&o.state==='cooking'))return;
  r.fish.forEach(f=>service.counts[f]--);
  const order=cid?service.orders.find(o=>o.cid===cid):null;if(order)order.state='cooking';
  service.cooking={id,cid,stage:0,marks:[],t:0,duration:1,target:.5,width:.12};setupCookStage();renderRestaurantUI();
}
function timingQuality(c){const pos=(c.t/c.duration)%1,delta=Math.abs(pos-c.target);return delta<c.width*.28?4:delta<c.width?3:delta<c.width*1.75?2:1}
function hitCook(){
  const c=service?.cooking;if(!c)return;const q=timingQuality(c);c.marks.push(q);
  if(c.stage===0){serviceToast(q===4?'PERFECT PREP!':'PREP DONE — NOW COOK IT',q===4?'good':'info');c.stage=1;setupCookStage();return}
  const quality=Math.max(1,Math.min(4,Math.round((c.marks[0]+c.marks[1])/2)));const r=D.recipeById[c.id];const order=c.cid?service.orders.find(o=>o.cid===c.cid):null;service.ready.push({id:c.id,quality,cid:order?c.cid:null});
  if(order)order.state='ready';
  if(quality===4){snd('perfect');serviceToast('PERFECT! DISH IS READY TO SERVE','good')}else serviceToast(`${['','POOR','GOOD','GREAT'][quality]} — DISH READY`,'info');
  service.cooking=null;$('rdCookPanel').classList.add('hidden');renderRestaurantUI();
}
function handleOrder(i){
  const o=service?.orders[i];if(!o)return;
  const exact=service.ready.findIndex(x=>x.cid===o.cid),spare=service.ready.findIndex(x=>!x.cid&&x.id===o.id);
  if(exact>=0||spare>=0){serveOrder(i);return}
  if(o.state==='cooking'){serviceToast('THAT ORDER IS ON THE STOVE','info');return}
  beginCook(o.id,o.cid);
}
function serveOrder(i){
  const o=service?.orders[i];if(!o)return;
  let ri=service.ready.findIndex(x=>x.cid===o.cid);if(ri<0)ri=service.ready.findIndex(x=>!x.cid&&x.id===o.id);
  if(ri<0){beginCook(o.id,o.cid);return}
  const dish=service.ready.splice(ri,1)[0],r=D.recipeById[o.id],mult=[0,.72,.9,1.05,1.18][dish.quality];
  service.revenue+=Math.round(r.price*mult);service.served++;if(dish.quality===4)service.perfect++;dishLog.push({id:dish.id,quality:dish.quality});service.orders.splice(i,1);snd('serve');serviceToast(`SERVED! +${Math.round(r.price*mult)} GP`,dish.quality===4?'good':'info');renderRestaurantUI();
}
function renderOrders(){
  if(!service)return;const w=$('rdOrders');
  w.innerHTML=service.orders.map((o,i)=>{const r=D.recipeById[o.id],exact=service.ready.some(x=>x.cid===o.cid),spare=service.ready.some(x=>!x.cid&&x.id===o.id),ready=exact||spare,pct=Math.max(0,Math.min(100,o.patience/o.maxPatience*100)),state=ready?'DISH READY — CLICK TO SERVE':o.state==='cooking'?'COOKING NOW…':'CLICK TO COOK ORDER',pet=o.guest?.name||'Pet diner',owner=o.guest?.owner?` · ${esc(o.guest.owner)}`:'';return `<button data-order="${i}" class="${ready?'ready':o.state==='cooking'?'cooking':''}"><span class="rd-order-head"><b>TABLE ${o.table+1} · ${esc(pet)}</b><em>${Math.ceil(o.patience)}s</em></span><span class="rd-order-dish">${esc(r.name)}${owner}</span><span class="rd-patience"><i style="width:${pct}%"></i></span><small>${state}</small></button>`}).join('')||(service.accepting?'<div class="rd-no-orders"><b>WAITING FOR CUSTOMERS…</b><small>New pet diners arrive automatically.</small></div>':'<div class="rd-no-orders"><b>LAST ORDERS COMPLETE</b><small>Closing the Fish House…</small></div>');
  w.querySelectorAll('button[data-order]').forEach(b=>b.onclick=()=>handleOrder(+b.dataset.order));
}
function renderCustomerScene(){
  if(!service)return;const w=$('rdCustomerScene');
  w.innerHTML=service.orders.map((o,i)=>{const r=D.recipeById[o.id],p=tablePositions[o.table],ready=service.ready.some(x=>x.cid===o.cid)||service.ready.some(x=>!x.cid&&x.id===o.id),pct=Math.max(0,Math.min(100,o.patience/o.maxPatience*100)),variant=o.cid%5,pet=o.guest,sprite=pet?.image?`<img src="${esc(pet.image)}" alt="${esc(pet.name||'Pet')}">`:'<i class="head"></i><i class="body"></i>',petName=esc(pet?.name||'Pet diner'),title=esc(`${pet?.name||'Pet diner'}${pet?.owner?' — '+pet.owner:''}`);return `<button class="rd-diner ${pet?.image?'pet-diner':''} diner-${variant} ${ready?'ready':o.state==='cooking'?'cooking':''}" data-customer="${i}" style="left:${p[0]}%;top:${p[1]}%" title="${title}"><span class="rd-diner-sprite ${pet?.image?'has-pet':''}">${sprite}</span><span class="rd-diner-name">${petName}</span><span class="rd-order-bubble"><b>${ready?'READY!':o.state==='cooking'?'COOKING…':esc(r.name)}</b><small>${ready?'CLICK TO SERVE':Math.ceil(o.patience)+'s'}</small><i><u style="width:${pct}%"></u></i></span></button>`}).join('');
  w.querySelectorAll('[data-customer]').forEach(b=>b.onclick=()=>handleOrder(+b.dataset.customer));
}
function renderRestaurantUI(){renderKitchenMenu();renderReadyCounter();renderOrders();renderCustomerScene()}
function serviceLoop(t){
  if(!service?.active)return;const dt=Math.min(.05,(t-service.last)/1000);service.last=t;service.uiTick-=dt;
  if(service.accepting){service.time=Math.max(0,service.time-dt);service.spawn-=dt;if(service.spawn<=0){service.spawn=2.8+Math.random()*2.5;spawnCustomer()}if(service.time<=0){service.accepting=false;serviceToast('SERVICE CLOSED — FINISH THE LAST TABLES','warn')}}
  const expired=[];service.orders.forEach((o,i)=>{o.patience-=dt;if(o.patience<=0)expired.push(i)});
  for(let n=expired.length-1;n>=0;n--){const i=expired[n],o=service.orders[i];service.ready.forEach(d=>{if(d.cid===o.cid)d.cid=null});service.orders.splice(i,1);service.missed++;snd('miss');serviceToast('A CUSTOMER LEFT HUNGRY','bad')}
  if(service.cooking){service.cooking.t+=dt;const c=service.cooking,pos=(c.t/c.duration)%1;$('rdCookNeedle').style.left=(pos*100)+'%';$('rdCookSweet').style.left=((c.target-c.width)*100)+'%';$('rdCookSweet').style.width=(c.width*2*100)+'%'}
  $('rdServiceTime').textContent=Math.max(0,Math.ceil(service.time));$('rdServiceRevenue').textContent=service.revenue+' GP';$('rdServed').textContent=service.served;
  if(service.uiTick<=0){service.uiTick=.18;renderOrders();renderCustomerScene();renderReadyCounter()}
  if(service.accepting&&serviceWorkFinished()&&!kitchenHasFutureFood()){
    service.soldOutFor+=dt;if(!service.soldOutAnnounced){service.soldOutAnnounced=true;serviceToast('SOLD OUT — GREAT SERVICE! CLOSING EARLY…','good')}
    if(service.soldOutFor>=.7){endRestaurant('sold_out');return}
  }else{service.soldOutFor=0;if(kitchenHasFutureFood())service.soldOutAnnounced=false}
  if(!service.accepting&&serviceWorkFinished()){endRestaurant('time');return}
  service.raf=requestAnimationFrame(serviceLoop)
}
function stopService(){if(service){service.active=false;cancelAnimationFrame(service.raf)}service=null;$('rdCookPanel')?.classList.add('hidden')}
async function endRestaurant(reason='time'){
  if(!service)return;const summary={revenue:service.revenue,served:service.served,perfect:service.perfect,reason};stopService();show('rdResultsView');$('rdResultRevenue').textContent=summary.revenue+' GP';$('rdResultFish').textContent=inventory.length;$('rdResultDishes').textContent=dishLog.length;$('rdResultPerfect').textContent=summary.perfect;$('rdResultReward').textContent=reason==='sold_out'?'Sold out — every available serving was completed. Saving rewards…':'Service complete — saving rewards…';
  if(practice||!run?.id){$('rdResultReward').textContent='Practice day — no XP or GP awarded.';return}
  try{const d=await rpc('repo_diver_complete_day',{p_run_id:run.id,p_catches:inventory,p_dishes:dishLog,p_max_depth:Math.round(engine?.maxDepth||0),p_customers:summary.served});const r=typeof d==='object'&&!Array.isArray(d)?d:(Array.isArray(d)?d[0]:{});$('rdResultReward').textContent=`+${r.fishing_xp_awarded||0} Fishing XP · +${r.cooking_xp_awarded||0} Cooking XP · +${r.gp_awarded||0} GP`;if(typeof character!=='undefined'&&character){if(r.fishing_xp!=null)character.fishing_xp=Number(r.fishing_xp);if(r.cooking_xp!=null)character.cooking_xp=Number(r.cooking_xp);if(r.gp!=null)character.gp=Number(r.gp);if(typeof renderCharacter==='function')renderCharacter()}await loadProfile()}catch(e){$('rdResultReward').textContent='Reward save failed: '+e.message}
}

function renderUpgrades(){const w=$('rdUpgrades');if(!w)return;w.innerHTML='';for(const [id,u] of Object.entries(D.upgradeDefs)){const lv=profile.equipment?.[id]||1,cost=Math.round(u.base*Math.pow(1.65,lv-1));const b=document.createElement('button');b.disabled=lv>=u.max||practice;b.innerHTML=`<strong>${u.name} <i>Lv ${lv}/${u.max}</i></strong><small>${u.desc}</small><em>${lv>=u.max?'MAX':cost.toLocaleString()+' GP'}</em>`;b.onclick=()=>buyUpgrade(id);w.appendChild(b)}}
async function buyUpgrade(id){try{const r=await rpc('repo_diver_buy_upgrade',{p_upgrade:id});profile.equipment={...profile.equipment,...r.equipment};if(typeof character!=='undefined'&&character&&r.gp!=null){character.gp=Number(r.gp);renderCharacter?.()}renderUpgrades();flash(`${D.upgradeDefs[id].name} upgraded`)}catch(e){flash(e.message)}}
function renderJournal(){const w=$('rdJournal');if(!w||!profile)return;const j=profile.fish_journal||{};w.innerHTML=D.fish.map(f=>{const x=j[f.id],known=!!x;return `<div class="${known?'known':''}"><span style="--fish:${D.rarity[f.rarity].c}">${known?'◆':'?'}</span><b>${known?f.name:'Unknown species'}</b><small>${known?`${f.rarity.toUpperCase()} · caught ${x.count||0} · best ★${x.best_q||1}`:f.biome.toUpperCase()}</small></div>`}).join('')}
function restart(){show('rdHomeView');renderHome()}
function restaurantKey(e){if($('rdRestaurantView')?.classList.contains('hidden'))return;if(e.code==='Space'&&service?.cooking){e.preventDefault();hitCook()}}
function bind(){
  $('rdClose').onclick=close;$('rdExitDive').onclick=()=>engine?.surface();$('rdOpenRestaurant').onclick=startRestaurant;$('rdCookHit').onclick=hitCook;$('rdResultsContinue').onclick=restart;$('rdTabJournal').onclick=()=>{$('rdHomeMain').classList.add('hidden');$('rdJournalPanel').classList.remove('hidden')};$('rdTabUpgrades').onclick=()=>{$('rdHomeMain').classList.add('hidden');$('rdUpgradePanel').classList.remove('hidden')};document.querySelectorAll('[data-rd-back]').forEach(b=>b.onclick=()=>{$('rdJournalPanel').classList.add('hidden');$('rdUpgradePanel').classList.add('hidden');$('rdHomeMain').classList.remove('hidden')});document.addEventListener('keydown',restaurantKey)
}
window.openRepoDiver=open;window.closeRepoDiver=close;document.addEventListener('DOMContentLoaded',bind);
})();
