/* Repo Sports Quidditch Ground — isolated survivor mode.
   IMPORTANT: this file does not patch Repo Combat functions. It is only opened by the Repo Sports map launcher. */
(() => {
  'use strict';
  if (window.RepoSportsSurvivor) return;

  const WORLD = { w: 2400, h: 2400, cx: 1200, cy: 1200, rx: 1015, ry: 815 };
  const RUN_END = 15 * 60;
  const MAX_ENEMIES = 360;
  const MAX_PARTICLES = 260;
  const MAX_ORBS = 150;
  const SAVE_PREFIX = 'repo_sports_quidditch_survivor_v1_';
  const arenaImage = new Image();
  arenaImage.src = 'assets/repo-sports-quidditch-ground.png';
  const barryHatImage = new Image();
  barryHatImage.src = 'assets/quidditch-survivor/barry-bramble-hat.png';

  const ENEMY_DATA = {
    chaser: { name:'Pitch Invader', hp:34, speed:75, damage:9, r:16, xp:2, color:'#9d4539', fan:'flag' },
    seeker: { name:'Snitch Superfan', hp:23, speed:118, damage:7, r:12, xp:2, color:'#d0a640', fan:'scarf' },
    beater: { name:'Drumline Bruiser', hp:105, speed:48, damage:16, r:23, xp:5, color:'#56344d', fan:'drummer' },
    ranged: { name:'Cup-Throwing Ultra', hp:46, speed:58, damage:9, r:16, xp:4, color:'#466783', fan:'cup' },
    swarmer: { name:'Screaming Fan', hp:14, speed:88, damage:5, r:9, xp:1, color:'#775f3a', fan:'fan' },
    interceptor: { name:'Shoulder Stack', hp:58, speed:82, damage:11, r:17, xp:4, color:'#4e7653', fan:'stack' },
    shield: { name:'Mascot Guard', hp:92, speed:54, damage:11, r:20, xp:5, color:'#667183', fan:'mascot' }
  };
  const BOSS_DATA = [
    { name:'THE MASCOT KING', color:'#a0763c', hp:2900, speed:54, damage:24, fan:'mascot' },
    { name:'THE THREE-FAN TOWER', color:'#85434b', hp:5200, speed:66, damage:28, fan:'tower' },
    { name:'REPO SPORTS ULTRA CAPTAIN', color:'#b9923f', hp:8800, speed:74, damage:34, fan:'ultra' }
  ];

  const RARITY = {
    standard:{label:'STANDARD',weight:100,className:'standard'},
    full_art:{label:'FULL ART',weight:46,className:'full-art'},
    platinum:{label:'PLATINUM',weight:28,className:'platinum'},
    legendary:{label:'GOLD LEGENDARY',weight:12,className:'legendary'},
    millennium:{label:'MILLENNIUM',weight:5,className:'millennium'},
    signature:{label:'SIGNATURE',weight:11,className:'signature'},
    rival:{label:'RIVAL',weight:14,className:'rival'},
    limited:{label:'LIMITED',weight:3,className:'limited'}
  };

  const els = {};
  let ctx = null;
  let state = null;
  let raf = 0;
  let listenersBound = false;
  let audioCtx = null;
  let crowdNode = null;
  let music = null;
  let soundEnabled = true;
  let lastPickupSfx = -10;
  let bannerTimer = 0;
  let tutorialTimer = 0;
  let collectionPromise = null;
  let ownedCards = [];
  let profile = null;
  let preferredWeapon = 'broomstick';
  let visible = false;
  const keys = new Set();
  const viewport = { w:1280, h:720, dpr:1 };

  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  const lerp = (a,b,t) => a+(b-a)*t;
  const dist = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
  const nowMs = () => performance.now();
  const rand = (a=0,b=1) => a+Math.random()*(b-a);
  const choice = arr => arr[Math.floor(Math.random()*arr.length)];
  const fmtTime = s => `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
  const safeText = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const hostDb = () => { try { if (typeof db !== 'undefined') return db; } catch (_) {} return window.__QD_HOST__?.getDb?.() || null; };
  const hostCharacter = () => { try { if (typeof character !== 'undefined') return character; } catch (_) {} return window.__QD_HOST__?.getCharacter?.() || null; };
  const username = () => String(hostCharacter()?.username || 'guest');

  function cacheEls(){
    els.dialog=document.getElementById('repoSportsSurvivorDialog');
    els.canvas=document.getElementById('qsCanvas');
    els.intro=document.getElementById('qsIntro');
    els.levelup=document.getElementById('qsLevelup');
    els.results=document.getElementById('qsResults');
    els.choiceGrid=document.getElementById('qsChoiceGrid');
    els.banner=document.getElementById('qsBanner');
    els.tutorial=document.getElementById('qsTutorial');
    els.hp=document.getElementById('qsHpFill');
    els.xp=document.getElementById('qsXpFill');
    els.mana=document.getElementById('qsManaFill');
    els.manaBar=document.getElementById('qsManaBar');
    els.time=document.getElementById('qsTime');
    els.kills=document.getElementById('qsKills');
    els.level=document.getElementById('qsLevel');
    els.score=document.getElementById('qsScore');
    els.event=document.getElementById('qsEvent');
    els.eventSub=document.getElementById('qsEventSub');
    els.broomHud=document.getElementById('qsBroomHud');
    els.weaponName=document.getElementById('qsWeaponName');
    els.broomMode=document.getElementById('qsBroomMode');
    els.resourceLabel=document.getElementById('qsResourceLabel');
    els.manaText=document.getElementById('qsManaText');
    els.specialLabel=document.getElementById('qsSpecialLabel');
    els.flightDots=document.getElementById('qsFlightDots');
    els.specialFill=document.getElementById('qsSpecialFill');
    els.specialReady=document.getElementById('qsSpecialReady');
    els.weaponControls=document.getElementById('qsWeaponControls');
    els.cardStrip=document.getElementById('qsCardStrip');
    els.binderStatus=document.getElementById('qsBinderStatus');
    els.saveStatus=document.getElementById('qsSaveStatus');
    els.resultTitle=document.getElementById('qsResultTitle');
    els.resultGrid=document.getElementById('qsResultGrid');
    els.buildSummary=document.getElementById('qsBuildSummary');
    if(els.canvas) ctx=els.canvas.getContext('2d',{alpha:false});
  }

  function ensureAudio(){
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext||window.webkitAudioContext)(); } catch (_) {}
    }
    if (audioCtx?.state === 'suspended') audioCtx.resume().catch(()=>{});
    if (!music) {
      music = new Audio('assets/audio/horde-entertained.mp3');
      music.loop = true; music.volume = .18; music.preload = 'auto';
    }
  }
  function tone(freq=440,d=.08,vol=.035,type='triangle',slide=1){
    try{
      if(!soundEnabled)return;
      ensureAudio(); if(!audioCtx)return;
      const t=audioCtx.currentTime,o=audioCtx.createOscillator(),g=audioCtx.createGain();
      o.type=type;o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(Math.max(30,freq*slide),t+d);
      g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+.008);g.gain.exponentialRampToValueAtTime(.0001,t+d);
      o.connect(g);g.connect(audioCtx.destination);o.start(t);o.stop(t+d+.02);
    }catch(_){ }
  }
  function sfx(kind){
    if(!soundEnabled)return;
    if(kind==='hit')tone(150,.04,.018,'square',.74);
    else if(kind==='pickup'){if(state&&state.elapsed-lastPickupSfx<.05)return;lastPickupSfx=state?.elapsed||0;tone(760,.04,.014,'sine',1.16);}
    else if(kind==='heal'){tone(420,.09,.03,'sine',1.45);setTimeout(()=>tone(660,.08,.02,'sine',1.2),45);}
    else if(kind==='level'){tone(430,.13,.045,'triangle',1.45);setTimeout(()=>tone(720,.15,.04,'triangle',1.32),60);setTimeout(()=>tone(1050,.17,.026,'sine',1.12),125);}
    else if(kind==='upgrade'){tone(350,.09,.034,'triangle',1.5);setTimeout(()=>tone(620,.11,.028,'triangle',1.35),50);}
    else if(kind==='swap'){tone(310,.065,.026,'square',1.3);setTimeout(()=>tone(520,.07,.020,'triangle',.92),40);}
    else if(kind==='ready'){tone(690,.085,.028,'sine',1.22);setTimeout(()=>tone(980,.10,.020,'triangle',1.08),55);}
    else if(kind==='wand')tone(840,.065,.020,'sine',1.32);
    else if(kind==='hat')tone(230,.07,.024,'triangle',.76);
    else if(kind==='broom')tone(185,.055,.022,'sawtooth',1.62);
    else if(kind==='heavy'){tone(125,.10,.038,'square',.70);setTimeout(()=>tone(245,.10,.026,'triangle',1.35),35);}
    else if(kind==='elite'){tone(390,.11,.032,'triangle',1.45);setTimeout(()=>tone(690,.12,.025,'sine',1.2),60);}
    else if(kind==='special'){tone(250,.18,.05,'sawtooth',1.9);setTimeout(()=>tone(760,.2,.035,'triangle',1.32),80);}
    else if(kind==='goal'){tone(210,.17,.045,'sawtooth',1.8);setTimeout(()=>tone(620,.20,.034,'triangle',1.25),75);}
    else if(kind==='flight')tone(220,.25,.050,'sawtooth',2.4);
    else if(kind==='snitch'){tone(980,.22,.038,'sine',1.4);setTimeout(()=>tone(1320,.18,.030,'sine',1.2),85);}
    else if(kind==='rare'){tone(700,.24,.034,'triangle',1.45);setTimeout(()=>tone(1120,.26,.030,'sine',1.18),95);}
    else if(kind==='hurt')tone(110,.10,.038,'square',.55);
  }
  function startMusic(){ ensureAudio(); if(music){music.muted=!soundEnabled;if(soundEnabled)music.play().catch(()=>{});} }
  function stopMusic(){ if(music){ music.pause(); music.currentTime=0; } }
  function updateMusic(){
    if(!music||!state)return;
    music.muted=!soundEnabled;
    const phase=state.elapsed<300?0:state.elapsed<600?1:state.elapsed<780?2:3;
    const crowd=clamp(state.enemies.length/260,0,1);
    const phaseRate=[.97,1.00,1.035,1.07][phase];
    const phaseVol=[.13,.16,.19,.22][phase];
    music.volume=clamp(phaseVol+crowd*.035,.10,.27);
    music.playbackRate=lerp(music.playbackRate||1,phaseRate+crowd*.018,.035);
  }

  function loadProfile(){
    const key=SAVE_PREFIX+username().toLowerCase();
    try{ profile=JSON.parse(localStorage.getItem(key)||'{}')||{}; }catch(_){ profile={}; }
    profile.bestScore=Number(profile.bestScore)||0;
    profile.bestTime=Number(profile.bestTime)||0;
    profile.bestKills=Number(profile.bestKills)||0;
    profile.bestLevel=Number(profile.bestLevel)||0;
    profile.bestSnitches=Number(profile.bestSnitches)||0;
    profile.bestHit=Number(profile.bestHit)||0;
    profile.runs=Number(profile.runs)||0;
    profile.synergies=Array.isArray(profile.synergies)?profile.synergies:[];
    return profile;
  }
  function saveProfile(){
    if(!profile)return;
    try{localStorage.setItem(SAVE_PREFIX+username().toLowerCase(),JSON.stringify(profile));}catch(_){ }
  }


  function nextXpRequirement(level){
    // Fast opening, steady middle, moderate late curve. This avoids exponential-feeling stalls.
    if(level===2)return 24;
    if(level===3)return 32;
    if(level===4)return 41;
    if(level===5)return 50;
    return Math.floor(18+level*5.6+Math.pow(level,1.18)*1.55);
  }
  function addShake(power=2){if(state?.camera)state.camera.shake=Math.max(state.camera.shake||0,power);}
  function impactBurst(x,y,color='#f0d279',count=5,power=70){
    if(!state)return;
    for(let i=0;i<count&&state.particles.length<MAX_PARTICLES;i++){
      const a=Math.random()*Math.PI*2,spd=rand(power*.45,power);
      state.particles.push({x,y,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd,life:rand(.18,.34),color,size:rand(2,4)});
    }
  }
  function damagePopup(target,amount,crit=false,boss=false){
    if(!state||!target)return;
    let pfx=target._damagePopup;
    if(pfx&&pfx.life>.18){
      pfx.total+=amount;pfx.crit=pfx.crit||crit;pfx.text=`${pfx.crit?'✦ ':''}${Math.round(pfx.total)}`;pfx.life=Math.max(pfx.life,.34);pfx.y=target.y-(boss?34:8);
      return;
    }
    pfx={x:target.x,y:target.y-(boss?34:8),text:`${crit?'✦ ':''}${Math.round(amount)}`,total:amount,crit,life:.46,color:crit?'#ffe36c':boss?'#ffe186':'#f1d9a0',size:crit?(boss?20:17):(boss?14:12)};
    target._damagePopup=pfx;
    if(state.particles.length<MAX_PARTICLES)state.particles.push(pfx);
  }
  function angleDelta(a,b){return Math.atan2(Math.sin(b-a),Math.cos(b-a));}
  function potentialSynergy(card){
    if(!state||!card)return '';
    const tag=characterTag(card),chars=state.tcg.characters,n=String(card.name||'').toLowerCase();
    if((tag==='soup'&&chars.has('jud'))||(tag==='jud'&&chars.has('soup')))return 'SYNERGY POSSIBLE';
    if((tag==='debbie'&&chars.has('nimbler'))||(tag==='nimbler'&&chars.has('debbie')))return 'SYNERGY POSSIBLE';
    if(tag==='soup'&&state.weapon==='broomstick')return 'SYNERGY POSSIBLE';
    if(tag==='barry'&&state.flags.packLuck)return 'SYNERGY POSSIBLE';
    if(n.includes('pack luck')&&chars.has('barry'))return 'SYNERGY POSSIBLE';
    if(state.tcg.cards.has(card.id))return 'BUILD SYNERGY';
    return '';
  }
  function weightedPassive(pool){
    if(!pool.length)return null;
    let total=0;const rows=pool.map(def=>{let w=1;if(state.passives.has(def.id))w*=1.55;if(/broom|mana|wind|mount|aero|harness|magic|evolution/.test(def.id)&&state.weapon==='broomstick')w*=1.28;if(/wand/.test(def.id)&&state.weapon==='wand')w*=1.28;if(/hat/.test(def.id)&&state.weapon==='barry-hat')w*=1.28;total+=w;return [def,total];});
    const r=Math.random()*total;return rows.find(([,x])=>r<=x)?.[0]||pool[0];
  }
  function renderLevelControls(){
    if(!els.choiceGrid||!state)return;
    let box=document.getElementById('qsLevelControls');
    if(!box){box=document.createElement('div');box.id='qsLevelControls';box.className='qs-level-controls';els.choiceGrid.insertAdjacentElement('afterend',box);}
    const hint=state.weapon==='broomstick'&&state.broom.level>=6&&!state.broom.evolved?`Evolution hint: Broomstick Lv.${state.broom.level}/8 · own at least one TCG card.`:state.weapon==='wand'&&state.level>=7&&!state.wand.evolved?'Evolution hint: keep developing your Wand and TCG build.':state.weapon==='barry-hat'&&state.level>=7&&!state.hat.evolved?'Evolution hint: keep developing Barry’s Hat and your TCG build.':'';
    box.innerHTML=`<div class="qs-level-actions"><button id="qsReroll" type="button" ${state.rerolls<=0?'disabled':''}>REROLL · ${state.rerolls}</button><button id="qsSkip" type="button" ${state.skips<=0?'disabled':''}>SKIP · ${state.skips}</button></div>${hint?`<small>${safeText(hint)}</small>`:''}`;
    box.querySelector('#qsReroll')?.addEventListener('click',()=>{
      if(!state?.pendingUpgrade||state.rerolls<=0)return;state.rerolls--;state.stats.rerolls++;sfx('swap');renderChoices(generateChoices(state.upgradeForceCard));
    });
    box.querySelector('#qsSkip')?.addEventListener('click',()=>{
      if(!state?.pendingUpgrade||state.skips<=0)return;state.skips--;state.stats.skips++;state.pendingUpgrade=false;state.upgradeForceCard=false;state.paused=false;els.levelup.hidden=true;sfx('swap');showBanner('LEVEL SKIPPED','No upgrade taken');
    });
  }
  function spawnPointAroundPlayer(distance=650,angle=Math.random()*Math.PI*2){
    const p=state.player;const point={x:p.x+Math.cos(angle)*distance,y:p.y+Math.sin(angle)*distance};constrainToArena(point);
    if(Math.hypot(point.x-p.x,point.y-p.y)<360)return spawnAtEdge();
    return point;
  }
  function waveTypes(kind,count){
    if(kind==='fast-flank')return Array.from({length:count},()=>Math.random()<.7?'seeker':'interceptor');
    if(kind==='heavy-wall')return Array.from({length:count},(_,i)=>i%3===0?'shield':'beater');
    if(kind==='swarm')return Array.from({length:count},()=>Math.random()<.75?'swarmer':'chaser');
    if(kind==='elite-escort')return ['beater',...Array.from({length:Math.max(2,count-1)},()=>choice(['chaser','seeker','interceptor']))];
    if(kind==='mixed')return Array.from({length:count},()=>pickEnemyType());
    return Array.from({length:count},()=>state.elapsed>80?choice(['chaser','swarmer','seeker']):choice(['chaser','swarmer']));
  }
  function spawnWave(kind='mixed',opening=false){
    if(!state||state.enemies.length>=MAX_ENEMIES-4)return;
    const t=state.elapsed;
    const count=opening?4:t<180?rand(4,7):t<480?rand(7,11):rand(10,16);
    const n=Math.max(3,Math.floor(count));const baseA=Math.random()*Math.PI*2;const types=opening?Array.from({length:n},()=> 'chaser'):waveTypes(kind,n);
    for(let i=0;i<n&&state.enemies.length<MAX_ENEMIES;i++){
      let a=baseA,d=opening?rand(410,560):rand(560,780);
      if(kind==='ring'||opening)a=baseA+i*Math.PI*2/n;
      else if(kind==='two-sided')a=baseA+(i%2?Math.PI:0)+rand(-.16,.16);
      else if(kind==='columns')a=baseA+rand(-.10,.10)+(i-Math.floor(n/2))*.022;
      else if(kind==='fast-flank')a=baseA+rand(-.24,.24);
      else if(kind==='heavy-wall')a=baseA+(i-Math.floor(n/2))*.07;
      else a=baseA+rand(-.55,.55);
      const pt=spawnPointAroundPlayer(d,a);
      spawnEnemy(types[i],kind==='elite-escort'&&i===0,pt);
    }
  }
  function seedOpeningPressure(){
    spawnWave('ring',true);
    // One nearby runner starts the loop immediately without spawning on top of the player.
    spawnEnemy('chaser',false,spawnPointAroundPlayer(430,Math.random()*Math.PI*2));
  }
  function grantEliteReward(e){
    if(!state||!e?.elite)return;
    dropXp(e.x,e.y,Math.max(8,e.xp*3));
    let reward='LARGE XP';
    const r=Math.random();
    if(r<.12){state.orbs.push({x:e.x+10,y:e.y-8,value:0,heal:18,r:8,taken:false});reward='HEAL DROP';}
    else if(r<.24){if(state.weapon==='broomstick')state.broom.mana=state.broom.maxMana;else if(state.weapon==='wand')state.wand.mana=state.wand.maxMana;reward='RESOURCE REFILL';}
    else if(r<.32&&ownedCards.length){state.forceCard=true;reward='TCG TOKEN';}
    if(state.elapsed-(state.feedback.lastEliteBanner||-99)>9){state.feedback.lastEliteBanner=state.elapsed;showBanner('ELITE DEFEATED',reward);sfx('elite');}
  }
  function grantBossReward(stage,name){
    if(!state)return;
    state.player.hp=Math.min(state.player.maxHp,state.player.hp+35+stage*5);
    if(state.weapon==='broomstick')state.broom.mana=state.broom.maxMana;
    if(state.weapon==='wand')state.wand.mana=state.wand.maxMana;
    state.forceCard=true;
    state.xp+=state.nextXp+stage*10;
    state.stats.bossRewards++;
    showBanner('BOSS DOWN',`${name} · TCG CHOICE + RECOVERY`);sfx('rare');addShake(5);
  }

  async function loadCollection(){
    if(collectionPromise)return collectionPromise;
    collectionPromise=(async()=>{
      let ids=[];
      const dbx=hostDb();
      if(dbx && hostCharacter()){
        try{
          const {data,error}=await dbx.rpc('get_my_quidditch_tcg_collection');
          if(!error){const row=Array.isArray(data)?data[0]:data;ids=Array.isArray(row?.cards)?row.cards:[];}
        }catch(_){ }
      }
      if(!ids.length){ const fallback=window.__repoTcgDisplayedCollection; if(fallback && !fallback.isPublic && Array.isArray(fallback.cards))ids=fallback.cards; }
      const seen=new Set();
      ownedCards=ids.map(id=>window.repoTcgCardById?.(id)).filter(card=>card&&card.id&&!seen.has(card.id)&&seen.add(card.id)).map(card=>({...card,rarity:inferCardRarity(card)}));
      if(els.binderStatus)els.binderStatus.textContent=ownedCards.length?`${ownedCards.length} owned TCG cards available as run upgrades.`:'Binder not loaded or empty — normal upgrades remain fully playable.';
      return ownedCards;
    })();
    return collectionPromise;
  }

  function inferCardRarity(card){
    if(card?.rarity)return card.rarity;
    const id=String(card?.id||''),img=String(card?.image||'');
    if(id==='ltd_week_one_anniversary'||img.includes('/limited/'))return 'limited';
    if(id.includes('millennium')||img.includes('/millennium/'))return 'millennium';
    if(id.includes('signature')||img.includes('/signature/'))return 'signature';
    if(id.includes('rival')||img.includes('/rival/'))return 'rival';
    if(id.includes('platinum')||img.includes('/platinum/'))return 'platinum';
    if(id.includes('legendary')||img.includes('/legendary/'))return 'legendary';
    if(id.includes('full_art')||img.includes('/full-art/'))return 'full_art';
    return 'standard';
  }
  function cardRarity(card){ return RARITY[inferCardRarity(card)] || RARITY.standard; }
  function isSpecialOneShot(card){ return ['millennium','legendary','limited','rival','full_art'].includes(card?.rarity); }
  function characterTag(card){
    const n=(card?.name||'').toLowerCase();
    return ['besquelcher','rocky','debbie','soup','jud','mod ash','nimbler','barry','berry bramble','jenny'].find(x=>n.includes(x))||'';
  }
  const pendingAbilityCardIds=new Set([
    'barrys_tip_jar',
    'broom_shop_myth_standard',
    'barrys_burger_cart_standard',
    'cat_on_the_pitch_standard',
    'keepers_nightmare_standard'
  ]);
  function isLocationCard(card){
    const id=String(card?.id||'').toLowerCase();
    return /(?:_arena_standard|_skycourt_standard|_flightground_standard|_stadium_standard|_canopy_pitch_standard|_quidditch_ground_standard|_storm_grounds_standard|_quidditch_grounds_standard)$/.test(id);
  }
  function isPendingAbilityCard(card){return isLocationCard(card)||pendingAbilityCardIds.has(String(card?.id||''));}
  function genericCardEffect(card){
    const hash=[...String(card?.id||'')].reduce((a,c)=>(a*33+c.charCodeAt(0))>>>0,5381)%5;
    if(hash===0)return '+4% weapon damage.';
    if(hash===1)return 'Attack cooldown -3.5%.';
    if(hash===2)return '+5% attack area.';
    if(hash===3)return '+2.5% critical chance.';
    return '+12 XP pickup radius.';
  }
  function getsGenericCardEffect(card){
    const n=String(card?.name||'').toLowerCase();
    return !characterTag(card) && !/pack luck|binder flex|swiped|var|keeper|snitch|broom|whisper|frostbound|cinder|amethyst|starweave|gravemark|moonlit|arena|grounds|stadium|pitch|skycourt|flightground/.test(n);
  }
  function cardDescription(card,rank=1){
    const n=String(card?.name||'').toLowerCase(),r=rank,rarity=inferCardRarity(card),parts=[];

    // Cards that currently have no meaningful live Survivor behaviour are hidden
    // from the choice pool until the dedicated ability pass. Keep this text as a
    // truthful fallback for old/previewed state rather than inventing an effect.
    if(isPendingAbilityCard(card))return 'Not currently offered in Survivor: this card is waiting for its dedicated gameplay ability.';

    let characterEffect=false;
    if(n.includes('besquelcher')){
      characterEffect=true;
      parts.push(`Besquelcher: +16% weapon damage and -0.25 armour on pickup; every 50 kills triggers a ${90*r} base-damage Goal Explosion.`);
      if(rarity==='millennium')parts.push('Millennium Besquelcher: every 35 kills also triggers a 165 base-damage arena-wide strike.');
    }
    if(n.includes('rocky')){
      characterEffect=true;
      const cap=rarity==='millennium'?14:10;
      const max=Math.round(cap*.018*r*100);
      parts.push(`Rocky: after 8s without taking damage, build up to +${max}% weapon damage; taking damage resets the streak.`);
    }
    if(n.includes('debbie')){
      characterEffect=true;
      const duration=6+(rarity==='millennium'?2:0)+(n.includes('signature')?2:0);
      parts.push(`Debbie: each kill has a ${(3.5*r).toFixed(1).replace('.0','')}% chance to trigger +40% attack speed for ${duration}s.`);
      if(n.includes('signature'))parts.push('Debbie Signature: every 6 kills during Hot Streak extends it by 0.65s (up to 9s, or 12s with Millennium Debbie).');
    }
    if(n.includes('soup')){
      characterEffect=true;
      parts.push(`Soup: per rank, -6% movement speed and +1.2 armour; enemies within ${rarity==='millennium'?260:150} range are slowed by 50%.`);
    }
    if(n.includes('jud')){
      characterEffect=true;
      const cd=Math.max(7,12-r*1.2).toFixed(1).replace('.0','');
      parts.push(`Jud: blocks one contact hit every ${cd}s, then releases a 180-radius shockwave for ${20+8*r} base damage.`);
    }
    if(n.includes('mod ash')||n.includes('mash and grab')){
      characterEffect=true;
      parts.push('Mod Ash: elite kills pull all XP toward you and have a 30% chance to drop bonus XP worth 4× that elite’s normal XP.');
      if(rarity==='millennium')parts.push('Millennium Mod Ash: elite kills also steal a temporary modifier for 12s.');
    }
    if(n.includes('nimbler')||n.includes('boomstick')){
      characterEffect=true;
      parts.push('Nimbler: moving builds Momentum; at 100 Momentum there is a 45%-per-second chance to burst for 24 base damage in a 95-radius area.');
      if(n.includes('signature'))parts.push('Nimbler Signature: Momentum builds 40% faster while moving.');
    }

    if(!characterEffect){
      if(n.includes('off the post')){
        parts.push(`${18*r}% chance for an expired projectile to reverse for 0.75s at 75% damage.`);
      }else if(n.includes('wrong hoop')){
        return 'Not currently offered in Survivor: its reverse-shot flag has no live attack behaviour yet.';
      }else if(n.includes('lost notes')){
        parts.push(`Every ${18-Math.min(5,r)}s, all XP on the pitch is magnetised toward you.`);
      }else if(n.includes('tea break')){
        parts.push(`Stand still for 1.5s to regenerate ${(2.2*r).toFixed(1)} HP/s; Broom Mana regenerates at 1.7× its normal rate while resting.`);
      }else if(n.includes('the stare')){
        parts.push(`After 2s without taking damage, nearby elites within 130 range lose ${(0.7*r).toFixed(1)} armour per second.`);
      }else if(n.includes('pack luck')){
        parts.push(`${15+r*4}% chance for 4 level-up choices; ${(1.5*r).toFixed(1).replace('.0','')}% chance for 5 choices.`);
      }else if(n.includes('binder flex')){
        parts.push(`+${(1.5*r).toFixed(1).replace('.0','')}% weapon damage for every different TCG rarity currently in your run build.`);
      }else if(n.includes('swiped')){
        parts.push('Elite kills grant an 8s random stolen modifier. Live rolls currently boost Speed +22%, Attack Speed +22%, or Damage +25%.');
      }else if(n.includes('changing room champions')||n.includes('team photo')){
        parts.push(`+${(1.8*r).toFixed(1).replace('.0','')}% weapon damage for every different character card in your current run build.`);
      }else if(n==='var'||n.startsWith('var ')||n.includes('match review')){
        parts.push('Once every 150s, a lethal hit is cancelled and you recover to at least 18 HP or 18% of max HP.');
      }else if(n.includes('keepers dream')){
        parts.push(`Every 11s, create a 4s defensive zone. Enemies within 105 range take ${4*r} damage per second plus light knockback.`);
      }else if(n.includes('snitch')){
        parts.push(`Adds ${r} Snitch Sense. Each point increases the future Golden Snitch spawn rate by 12%.`);
      }else if(n.includes('verdant whisper')){
        parts.push('+30 XP pickup radius. Broom flight leaves a damaging wind trail.');
      }else if(n.includes('frostbound arc')){
        parts.push('+8% attack area.');
      }else if(n.includes('cinder spite')){
        parts.push('+7% weapon damage.');
      }else if(n.includes('amethyst reign')){
        parts.push('+15 maximum Broom Mana, refill Mana immediately, and +1 Magic Mode pierce.');
      }else if(n.includes('starweave comet')){
        parts.push('+1 Broom Magic projectile and +12% Broom flight damage.');
      }else if(n.includes('gravemark glider')){
        parts.push('Broom flight recharge time -10% and flight distance +12%.');
      }else if(n.includes('moonlit hush')){
        parts.push('+15% Broom Mana regeneration and attack cooldown -4%.');
      }else if(getsGenericCardEffect(card)){
        parts.push(genericCardEffect(card));
      }
    }

    // These are the rarity modifiers that currently change live gameplay.
    if(rarity==='full_art')parts.push('+6% attack area (Full Art bonus).');
    if(rarity==='rival')parts.push('+12% weapon damage, but enemy wave pressure +10% (Rival bonus).');
    if(rarity==='legendary'&&n.includes('besquelcher'))parts.push('+22% Besquelcher special-strike damage (Legendary bonus).');
    if(rarity==='millennium'&&n.includes('besquelcher'))parts.push('+35% Besquelcher special-strike damage (Millennium bonus).');

    // Some rarity variables exist in the old implementation but are not wired to
    // live gameplay yet; deliberately do not advertise them as working effects.
    if(!parts.length)return 'No active Survivor bonus is currently wired to this card.';
    return parts.join(' ');
  }

  function applyCard(card){
    const cards=state.tcg.cards;
    const existing=cards.get(card.id);
    const max=isSpecialOneShot(card)?1:3;
    const rank=Math.min(max,(existing?.rank||0)+1);
    cards.set(card.id,{card,rank});
    const n=(card.name||'').toLowerCase();
    const rarity=inferCardRarity(card);
    state.stats.cardsPicked++;
    if(!state.tcg.rarities.has(rarity))state.tcg.rarities.add(rarity);
    if(characterTag(card))state.tcg.characters.add(characterTag(card));

    if(n.includes('besquelcher')){state.flags.bsq=rank;state.mods.damage*=1.16;state.mods.armour-=.25;if(card.rarity==='millennium'){state.flags.millenniumBsq=true;state.flags.millenniumScore=0;}}
    if(n.includes('rocky')){state.flags.rocky=rank;if(card.rarity==='millennium')state.flags.millenniumRocky=true;}
    if(n.includes('debbie')){state.flags.debbie=Math.max(state.flags.debbie||0,rank);if(card.rarity==='millennium')state.flags.millenniumDebbie=true;}
    if(n.includes('soup')){state.flags.soup=rank;state.mods.speed*=.94;state.mods.armour+=1.2;if(card.rarity==='millennium')state.flags.millenniumSoup=true;}
    if(n.includes('jud'))state.flags.jud=rank;
    if(n.includes('mod ash')||n.includes('mash and grab')){state.flags.modAsh=rank;if(card.rarity==='millennium')state.flags.millenniumAsh=true;}
    if(n.includes('nimbler')||n.includes('boomstick'))state.flags.nimbler=rank;
    if(n.includes('off the post'))state.flags.offPost=rank;
    if(n.includes('wrong hoop'))state.flags.wrongHoop=rank;
    if(n.includes('lost notes'))state.flags.lostNotes=rank;
    if(n.includes('tea break'))state.flags.teaBreak=rank;
    if(n.includes('the stare'))state.flags.stare=rank;
    if(n.includes('pack luck'))state.flags.packLuck=rank;
    if(n.includes('binder flex'))state.flags.binderFlex=rank;
    if(n.includes('swiped'))state.flags.swiped=rank;
    if(n.includes('changing room champions')||n.includes('team photo'))state.flags.team=rank;
    if(n==='var'||n.startsWith('var ')||n.includes('match review')){state.flags.varReview=true;state.flags.varReadyAt=0;}
    if(n.includes('keepers dream'))state.flags.keepersDream=rank;
    if(n.includes('snitch'))state.flags.snitchSense=(state.flags.snitchSense||0)+rank;
    if(n.includes('signature')&&n.includes('debbie'))state.flags.signatureDebbie=true;
    if(n.includes('signature')&&n.includes('nimbler'))state.flags.signatureNimbler=true;
    if(card.rarity==='rival'){state.mods.damage*=1.12;state.director.pressure*=1.10;state.flags.rival=true;}
    if(card.rarity==='platinum')state.mods.synergy*=1.12;
    if(card.rarity==='legendary')state.mods.specialPower*=1.22;
    if(card.rarity==='millennium')state.mods.specialPower*=1.35;
    if(card.rarity==='signature')state.mods.triggerPower*=1.18;
    if(card.rarity==='full_art')state.mods.area*=1.06;

    if(n.includes('verdant whisper')){state.mods.magnet+=30;state.broom.flightTrail=true;}
    if(n.includes('frostbound arc')){state.flags.frostBroom=true;state.mods.area*=1.08;}
    if(n.includes('cinder spite')){state.flags.cinderBroom=true;state.mods.damage*=1.07;}
    if(n.includes('amethyst reign')){state.broom.maxMana+=15;state.broom.mana=state.broom.maxMana;state.broom.magicPierce++;}
    if(n.includes('starweave comet')){state.broom.magicProjectiles++;state.broom.flightDamage*=1.12;}
    if(n.includes('gravemark glider')){state.broom.flightRecharge*=.9;state.broom.flightDistance*=1.12;}
    if(n.includes('moonlit hush')){state.broom.manaRegen*=1.15;state.mods.cooldown*=.96;}

    const genericHash=[...card.id].reduce((a,c)=>(a*33+c.charCodeAt(0))>>>0,5381)%5;
    if(!characterTag(card) && !/pack luck|binder flex|swiped|var|keeper|snitch|broom|whisper|frostbound|cinder|amethyst|starweave|gravemark|moonlit|arena|grounds|stadium|pitch|skycourt|flightground/.test(n)){
      if(genericHash===0)state.mods.damage*=1.04;
      if(genericHash===1)state.mods.cooldown*=.965;
      if(genericHash===2)state.mods.area*=1.05;
      if(genericHash===3)state.mods.crit+=.025;
      if(genericHash===4)state.mods.magnet+=12;
    }
    updateSynergies();
    renderCardStrip();
    if(['legendary','millennium','signature','rival','platinum'].includes(rarity))sfx('rare');
  }

  function updateSynergies(){
    const chars=state.tcg.characters;
    const add=(id,label,apply)=>{
      if(state.tcg.synergies.has(id))return;
      state.tcg.synergies.add(id); apply();
      if(profile&&!profile.synergies.includes(id)){profile.synergies.push(id);saveProfile();showBanner('SYNERGY DISCOVERED',label);state.stats.synergies++;}
    };
    if(chars.has('soup')&&chars.has('jud'))add('unbreakable_defence','Soup + Jud · UNBREAKABLE DEFENCE',()=>{state.mods.armour+=1.5;state.mods.knockback*=1.2;});
    if(chars.has('debbie')&&chars.has('nimbler'))add('chaos_offence','Debbie + Nimbler · CHAOS OFFENCE',()=>{state.mods.speed*=1.06;state.mods.attackSpeed*=1.08;});
    if((chars.has('barry')||state.tcg.cardsHasName?.('barry'))&&state.flags.packLuck)add('barry_pack_luck','Barry + Pack Luck · LUCKY COMMENTARY',()=>{state.flags.packLuck+=1;});
    if(state.flags.soup&&state.weapon==='broomstick')add('calm_flight','Soup + Broomstick · CALM FLIGHT',()=>{state.broom.flightRecharge*=.92;});
  }

  const passiveUpgrades = [
    {id:'power',name:'Controlled Aggression',icon:'⚡',desc:'+14% weapon damage.',apply:()=>state.mods.damage*=1.14},
    {id:'cadence',name:'Faster Cadence',icon:'⏱',desc:'Attacks recover 10% faster.',apply:()=>state.mods.cooldown*=.90},
    {id:'radius',name:'Wide Formation',icon:'◉',desc:'+14% attack area and Broom spin radius.',apply:()=>state.mods.area*=1.14},
    {id:'armour',name:'Keeper Padding',icon:'🛡',desc:'+2 armour. Contact hits become easier to survive.',apply:()=>state.mods.armour+=2},
    {id:'magnet',name:'Crowd Magnet',icon:'✦',desc:'+45 XP pickup radius.',apply:()=>state.mods.magnet+=45},
    {id:'speed',name:'Pitch Sprint',icon:'➤',desc:'+9% movement speed.',apply:()=>state.mods.speed*=1.09},
    {id:'crit',name:'Perfect Timing',icon:'★',desc:'+6% critical chance.',apply:()=>state.mods.crit+=.06},
    {id:'vitality',name:'Second Wind',icon:'♥',desc:'+20 maximum HP and heal 20.',apply:()=>{state.player.maxHp+=20;state.player.hp=Math.min(state.player.maxHp,state.player.hp+20);}},
    {id:'projectile',name:'Extra Runner',icon:'➹',desc:'+1 projectile/chain target for ranged styles.',apply:()=>state.mods.projectiles++},
    {id:'knockback',name:'Beater Technique',icon:'✹',desc:'+22% knockback strength.',apply:()=>state.mods.knockback*=1.22}
  ];
  const broomUpgrades = [
    {id:'broom-level',name:'Broomstick Training',icon:'🧹',desc:'Raise Broomstick weapon level. Higher levels add spins, range and finishers.',apply:()=>{state.broom.level=Math.min(8,state.broom.level+1);applyBroomLevel();}},
    {id:'mana-core',name:'Runic Mana Core',icon:'✦',desc:'+20 maximum Mana and +12% Mana regeneration.',apply:()=>{state.broom.maxMana+=20;state.broom.mana=state.broom.maxMana;state.broom.manaRegen*=1.12;}},
    {id:'windwake',name:'Windwake',icon:'≋',desc:'Flight leaves a damaging wind trail.',apply:()=>state.broom.flightTrail=true},
    {id:'quick-mount',name:'Quick Mount',icon:'➤',desc:'Flight recharge is 14% faster.',apply:()=>state.broom.flightRecharge*=.86},
    {id:'aero',name:'Aerodynamic Charm',icon:'↝',desc:'+18% flight distance and improved steering.',apply:()=>{state.broom.flightDistance*=1.18;state.broom.flightSteer+=.15;}},
    {id:'double-harness',name:'Double Harness',icon:'●●',desc:'Store a second Flight charge. Rare and unavailable early.',rare:true,condition:()=>state.level>=8&&state.broom.maxCharges<2,apply:()=>{state.broom.maxCharges=2;state.broom.charges=Math.min(2,state.broom.charges+1);}},
    {id:'magic-split',name:'Wind Lance Split',icon:'⋙',desc:'+1 Magic projectile and +1 pierce.',apply:()=>{state.broom.magicProjectiles++;state.broom.magicPierce++;}},
    {id:'evolution',name:'Nimbus Tempest',icon:'✧',desc:'EVOLUTION: Broom spins create vortex afterimages, Magic becomes more efficient, and flight detonates on landing.',rare:true,condition:()=>state.broom.level>=8&&!state.broom.evolved&&state.tcg.cards.size>=1,apply:()=>{state.broom.evolved=true;state.broom.magicCost*=.82;state.broom.flightDamage*=1.35;state.mods.area*=1.18;showBanner('WEAPON EVOLVED','NIMBUS TEMPEST');sfx('goal');}}
  ];


  const wandUpgrades = [
    {id:'wand-power',name:'Focused Core',icon:'✦',desc:'+18% Wand spell damage.',apply:()=>state.wand.damage*=1.18},
    {id:'wand-tempo',name:'Quick Incantation',icon:'⚡',desc:'Wand casts 12% faster.',apply:()=>state.wand.attackInterval*=.88},
    {id:'wand-chain',name:'Forked Charm',icon:'⌁',desc:'ARC mode chains to +1 extra fan.',apply:()=>state.wand.chainTargets++},
    {id:'wand-pierce',name:'Duelist Focus',icon:'➹',desc:'DUEL bolts gain +1 pierce.',apply:()=>state.wand.duelPierce++},
    {id:'wand-mana',name:'Deep Mana Pocket',icon:'◆',desc:'+20 max Mana and +15% regeneration.',apply:()=>{state.wand.maxMana+=20;state.wand.mana=state.wand.maxMana;state.wand.manaRegen*=1.15;}},
    {id:'wand-special',name:'Storm Timing',icon:'✹',desc:'SPELLSTORM recharges 14% faster.',apply:()=>state.wand.specialRecharge*=.86},
    {id:'wand-evolution',name:'Stadium Sorcery',icon:'✧',desc:'EVOLUTION: more Spellstorm bolts, stronger ARC chains and cheaper spells.',rare:true,condition:()=>state.level>=8&&!state.wand.evolved&&state.tcg.cards.size>=1,apply:()=>{state.wand.evolved=true;state.wand.stormBolts+=6;state.wand.chainPower*=1.22;state.wand.manaCost*=.82;showBanner('WEAPON EVOLVED','STADIUM SORCERY');sfx('goal');}}
  ];
  const hatUpgrades = [
    {id:'hat-power',name:'Weighted Brim',icon:'◒',desc:'+18% Hat damage and knockback.',apply:()=>{state.hat.damage*=1.18;state.hat.knockback*=1.16;}},
    {id:'hat-tempo',name:'Fast Talker',icon:'»',desc:'Hat attacks recover 12% faster.',apply:()=>state.hat.attackInterval*=.88},
    {id:'hat-pierce',name:'Crowd Cutter',icon:'↺',desc:'THROW mode pierces +1 fan on each pass.',apply:()=>state.hat.pierce++},
    {id:'hat-commentary',name:'Bigger Broadcast',icon:'◉',desc:'COMMENTARY shockwaves become 16% larger.',apply:()=>state.hat.commentaryRadius*=1.16},
    {id:'hat-special',name:'Cue the Replay',icon:'★',desc:'HAT TRICK! recharges 14% faster.',apply:()=>state.hat.specialRecharge*=.86},
    {id:'hat-evolution',name:'Prime-Time Barry',icon:'✧',desc:'EVOLUTION: HAT TRICK! lasts longer and gains a fourth orbiting hat.',rare:true,condition:()=>state.level>=8&&!state.hat.evolved&&state.tcg.cards.size>=1,apply:()=>{state.hat.evolved=true;state.hat.orbitCount=4;state.hat.specialDuration+=1.5;state.hat.damage*=1.12;showBanner('WEAPON EVOLVED','PRIME-TIME BARRY');sfx('goal');}}
  ];

  function applyBroomLevel(){
    const l=state.broom.level;
    if(l===2)state.broom.spinDamage*=1.2;
    if(l===3)state.broom.rotations=3;
    if(l===4)state.broom.spinRadius*=1.2;
    if(l===5)state.broom.attackInterval*=.88;
    if(l===6)state.broom.finalKnockback*=1.4;
    if(l===7)state.broom.spinMoveBonus=1.08;
    if(l===8){state.broom.rotations=4;state.broom.windShockwave=true;}
  }

  function cardOption(card){
    const current=state.tcg.cards.get(card.id)?.rank||0;
    const rank=current+1;
    return {type:'card',id:'card:'+card.id,name:card.name,rarity:card.rarity||'standard',image:card.image,desc:cardDescription(card,rank),footer:`RUN RANK ${rank}${isSpecialOneShot(card)?' · ONE-TIME':''}`,synergy:potentialSynergy(card),apply:()=>applyCard(card)};
  }
  function passiveOption(def){
    let footer=state.passives.has(def.id)?'IMPROVE EXISTING':'NEW PASSIVE';
    if(def.id==='evolution')footer='EVOLUTION · BROOM LV.8 + TCG CARD';
    if(def.id==='wand-evolution')footer='EVOLUTION · LEVEL 8 + TCG CARD';
    if(def.id==='hat-evolution')footer='EVOLUTION · LEVEL 8 + TCG CARD';
    return {type:'upgrade',id:def.id,name:def.name,icon:def.icon,rarity:def.rare?'rare':'upgrade',desc:def.desc,footer,apply:()=>{def.apply();state.passives.add(def.id);}};
  }
  function weightedCard(){
    const eligible=ownedCards.filter(card=>{
      const n=String(card?.name||'').toLowerCase();
      if(isPendingAbilityCard(card))return false;
      if(state.weapon!=='broomstick' && /verdant whisper|frostbound arc|cinder spite|amethyst reign|starweave comet|gravemark glider|moonlit hush/.test(n))return false;
      const current=state.tcg.cards.get(card.id)?.rank||0;
      if(state.tcg.cards.size>=5 && !state.tcg.cards.has(card.id))return false;
      return current < (isSpecialOneShot(card)?1:3);
    });
    if(!eligible.length)return null;
    let sum=0;
    const weighted=eligible.map(card=>{
      let w=cardRarity(card).weight;
      if(state.tcg.cards.has(card.id))w*=1.55;
      if(potentialSynergy(card))w*=1.35;
      const tag=characterTag(card);
      if(tag&&state.tcg.characters.has(tag))w*=1.18;
      sum+=w;return [card,sum];
    });
    const roll=Math.random()*sum;return weighted.find(([,x])=>roll<=x)?.[0]||eligible[0];
  }
  function generateChoices(forceCard=false){
    let count=3;
    if(state.flags.packLuck){if(Math.random()<.15+state.flags.packLuck*.04)count=4;if(Math.random()<.015*state.flags.packLuck)count=5;}
    count=Math.min(5,count);
    const out=[],used=new Set();
    const weaponPassives=state.weapon==='broomstick'?broomUpgrades:state.weapon==='wand'?wandUpgrades:state.weapon==='barry-hat'?hatUpgrades:[];
    const allPassives=[...passiveUpgrades,...weaponPassives].filter(x=>!x.condition||x.condition());
    const cardChance=state.tcg.cards.size?0.48:0.38;
    const wantCard=forceCard || (state.level>=3 && ownedCards.length && Math.random()<cardChance);
    if(wantCard){const c=weightedCard();if(c){out.push(cardOption(c));used.add('card:'+c.id);}}
    let safety=0;
    while(out.length<count&&safety++<80){
      const tryCard=state.level>=3&&ownedCards.length&&Math.random()<(state.tcg.cards.size?0.39:0.31);
      if(tryCard){const c=weightedCard();if(c&&!used.has('card:'+c.id)){out.push(cardOption(c));used.add('card:'+c.id);continue;}}
      const pool=allPassives.filter(def=>!used.has(def.id)||allPassives.length<=out.length);
      const def=weightedPassive(pool.length?pool:allPassives);if(!def)break;
      if(used.has(def.id)&&allPassives.length>out.length)continue;
      out.push(passiveOption(def));used.add(def.id);
    }
    return out;
  }

  function renderChoices(options){
    state.currentChoices=options;
    els.choiceGrid.innerHTML='';
    els.choiceGrid.classList.toggle('four',options.length>3);
    let rareShown=false;
    options.forEach((opt,index)=>{
      const b=document.createElement('button');b.type='button';b.className=`qs-choice qs-choice-reveal ${safeText(opt.rarity||'')} ${opt.image?'has-card':'has-upgrade'}`;
      const synergy=opt.synergy?`<span class="qs-synergy-chip">${safeText(opt.synergy)}</span>`:'';
      b.innerHTML=`<div class="qs-choice-art">${opt.image?`<img src="${safeText(opt.image)}" alt="${safeText(opt.name)}">`:`<span class="qs-icon">${safeText(opt.icon||'◆')}</span>`}</div><div class="qs-choice-body"><div class="qs-choice-top"><span class="qs-choice-rarity">${safeText((RARITY[opt.rarity]?.label||String(opt.rarity||'UPGRADE').toUpperCase()))}</span>${synergy}</div><h3>${safeText(opt.name)}</h3><p>${safeText(opt.desc)}</p><footer><span>${safeText(opt.footer||'')}</span><span>${index+1}</span></footer></div>`;
      b.style.animationDelay=`${index*45}ms`;
      b.addEventListener('click',()=>chooseUpgrade(opt));els.choiceGrid.appendChild(b);
      if(['platinum','legendary','millennium','signature','limited'].includes(opt.rarity))rareShown=true;
    });
    renderLevelControls();
    if(rareShown&&state.elapsed-(state.feedback.lastRareReveal||-99)>1){state.feedback.lastRareReveal=state.elapsed;sfx('rare');}
  }
  function showLevelUp(forceCard=false){
    if(!state||state.ended)return;
    state.paused=true;state.pendingUpgrade=true;state.upgradeForceCard=!!forceCard;
    renderChoices(generateChoices(forceCard));els.levelup.hidden=false;sfx('level');
  }
  function chooseUpgrade(opt){
    if(!state?.pendingUpgrade)return;
    opt.apply();state.pendingUpgrade=false;state.upgradeForceCard=false;els.levelup.hidden=true;state.paused=false;
    showBanner(opt.type==='card'?'TCG CARD EQUIPPED':'UPGRADE LOCKED IN',opt.name);
    sfx('upgrade');updateHud();
  }

  function showBanner(title,sub=''){
    if(!els.banner)return;
    clearTimeout(bannerTimer);
    els.banner.innerHTML=`${safeText(title)}${sub?`<small>${safeText(sub)}</small>`:''}`;
    els.banner.classList.add('show');
    if(title==='WEAPON EVOLVED')addShake(6);
    const hold=/BOSS|EVOLVED|SNITCH|SYNERGY|MILLENNIUM|GOAL/.test(title)?1750:1250;
    bannerTimer=setTimeout(()=>els.banner.classList.remove('show'),hold);
  }
  function tutorial(text,duration=2600){
    if(profile?.tutorialDone)return;
    clearTimeout(tutorialTimer);els.tutorial.textContent=text;els.tutorial.classList.add('show');tutorialTimer=setTimeout(()=>els.tutorial.classList.remove('show'),duration);
  }

  function resetState(weapon){
    state={
      weapon,running:true,paused:false,ended:false,won:false,pendingUpgrade:false,upgradeForceCard:false,currentChoices:[],
      elapsed:0,lastTs:0,score:0,level:1,xp:0,nextXp:26,kills:0,rerolls:2,skips:1,
      player:{x:WORLD.cx,y:WORLD.cy,r:16,hp:120,maxHp:120,vx:0,vy:0,lastHit:-10,lastContactHit:-10,lastProjectileHit:-10,lastBossHit:-10,stationary:0,idleTime:0},
      camera:{x:WORLD.cx,y:WORLD.cy,zoom:1.20,shake:0,damageFlash:0},
      enemies:[],enemyPool:[],projectiles:[],enemyProjectiles:[],orbs:[],particles:[],trails:[],telegraphs:[],
      passives:new Set(),
      mods:{damage:1,cooldown:1,area:1,armour:0,magnet:95,speed:1,crit:.05,projectiles:0,knockback:1,attackSpeed:1,synergy:1,specialPower:1,triggerPower:1,xp:1},
      broom:{level:1,mode:'melee',mana:100,maxMana:100,manaRegen:12,magicCost:11,magicProjectiles:1,magicPierce:1,spinDamage:22,spinRadius:82,rotations:2,attackInterval:1.42,lastAttack:-10,spin:null,attackId:0,lastSwitch:-10,charges:1,maxCharges:1,recharge:0,flightRecharge:8,flightDistance:1,flightSteer:.25,flight:null,flightDamage:60,flightTrail:false,finalKnockback:1,spinMoveBonus:1,windShockwave:false,evolved:false,readyPulse:0},
      wand:{mode:'duel',mana:100,maxMana:100,manaRegen:13,manaCost:5,damage:30,attackInterval:.58,lastAttack:-10,lastSwitch:-10,duelPierce:1,chainTargets:3,chainPower:1,special:0,specialRecharge:10,specialAnnounced:true,stormBolts:16,evolved:false},
      hat:{mode:'throw',damage:34,attackInterval:.95,commentaryInterval:1.08,lastAttack:-10,lastSwitch:-10,pierce:2,knockback:1,commentaryRadius:108,commentaryKnockback:42,special:0,specialRecharge:12,specialAnnounced:true,specialTime:0,specialDuration:4,orbitCount:3,specialTick:0,evolved:false},
      combat:{lastAttack:-10,attackInterval:weapon==='wand'?.58:weapon==='barry-hat'?.95:1.42,projectileDamage:26},
      director:{spawnClock:.18,waveClock:5.5,eliteClock:38,pressure:1,eventClock:55,snitchClock:72,bossStage:0,finalBossDefeated:false,stationaryWaveClock:3},
      event:null,snitch:null,boss:null,
      flags:{rockyStreak:0,hotStreak:0,hotStreakKills:0,moveMomentum:0,judReadyAt:0,varReadyAt:0,teaActive:false,lostNotesClock:12,keeperClock:8},
      tcg:{cards:new Map(),rarities:new Set(),characters:new Set(),synergies:new Set()},
      stats:{damage:0,damageTaken:0,highestHit:0,xp:0,elites:0,bosses:0,bossRewards:0,snitches:0,cardsPicked:0,synergies:0,flights:0,distance:0,rerolls:0,skips:0},
      feedback:{lastEliteBanner:-99,lastRareReveal:-99},
      forceCard:false
    };
    state.tcg.cardsHasName=(name)=>[...state.tcg.cards.values()].some(x=>(x.card?.name||'').toLowerCase().includes(name));
    if(els.cardStrip)els.cardStrip.innerHTML='';
    els.broomHud.hidden=false;els.manaBar.hidden=weapon==='barry-hat';updateHud();renderCardStrip();
  }

  function constrainToArena(obj){
    const dx=(obj.x-WORLD.cx)/WORLD.rx,dy=(obj.y-WORLD.cy)/WORLD.ry,v=dx*dx+dy*dy;
    if(v<=.94)return;
    const scale=Math.sqrt(.94/v);obj.x=WORLD.cx+dx*WORLD.rx*scale;obj.y=WORLD.cy+dy*WORLD.ry*scale;
  }
  function spawnAtEdge(){
    const a=Math.random()*Math.PI*2,rx=WORLD.rx*.98,ry=WORLD.ry*.98;
    return {x:WORLD.cx+Math.cos(a)*rx,y:WORLD.cy+Math.sin(a)*ry};
  }
  function enemyPressure(){
    const t=state.elapsed;
    const base=1+t/240+Math.pow(t/600,1.35)*.75;
    const idle=state.elapsed>20&&state.player.idleTime>3?1+Math.min(.28,(state.player.idleTime-3)*.022):1;
    return base*idle;
  }
  function pickEnemyType(){
    const t=state.elapsed,r=Math.random();
    if(t>420&&r<.12)return 'shield';
    if(t>300&&r<.25)return 'interceptor';
    if(t>180&&r<.38)return 'ranged';
    if(t>120&&r<.52)return 'beater';
    if(t>60&&r<.68)return 'seeker';
    if(t>20&&r<.84)return 'swarmer';
    return 'chaser';
  }
  function spawnEnemy(type=pickEnemyType(),elite=false,spawnPoint=null){
    if(state.enemies.length>=MAX_ENEMIES)return null;
    const base=ENEMY_DATA[type],p=spawnPoint||spawnAtEdge(),pressure=enemyPressure()*state.director.pressure;
    const e=state.enemyPool.pop()||{};
    Object.assign(e,{type,x:p.x,y:p.y,r:base.r,fan:base.fan||'fan',shirt:choice(['#8d2f32','#284c85','#72519a','#c79c36','#2e7252']),skin:choice(['#d7a173','#b97754','#8c573f','#efc397']),accent:choice(['#f4cd55','#eee5d3','#a6d3ff']),stack:type==='interceptor'?choice([2,3]):1,hp:base.hp*(1+state.elapsed/390)*(elite?3.25:1),maxHp:0,speed:base.speed*(1+Math.min(.58,state.elapsed/1050)),damage:base.damage*(1+state.elapsed/720),xp:base.xp,color:base.color,elite,modifier:null,shoot:rand(.25,1.3),flash:0,slow:0,armour:type==='shield'?3:0,dead:false,broomAttackId:-1,broomRotation:-1,wanderPhase:rand(0,Math.PI*2),wanderRate:rand(.7,1.45),wanderAmp:type==='beater'?10:type==='seeker'?20:rand(18,42),lane:rand(-1,1),_damagePopup:null});
    if(elite){e.r*=1.28;e.modifier=choice(['swift','armoured','regenerating','explosive','magnetic','splitter']);if(e.modifier==='swift')e.speed*=1.32;if(e.modifier==='armoured')e.armour+=5;}
    e.maxHp=e.hp;state.enemies.push(e);return e;
  }
  function spawnBoss(stage){
    const b=BOSS_DATA[stage-1];if(!b)return;
    const p=spawnAtEdge();state.boss={stage,name:b.name,fan:b.fan,x:p.x,y:p.y,r:48,hp:b.hp,maxHp:b.hp,speed:b.speed,damage:b.damage,color:b.color,attackClock:2.6,charge:null,windup:null,summonClock:7,_damagePopup:null};
    showBanner('BOSS ARRIVED',b.name);sfx('goal');addShake(4);
  }

  function damageEnemy(e,amount,knock=0,sourceX=state.player.x,sourceY=state.player.y){
    if(!e||e.dead)return 0;
    if(e.type==='shield'){
      const incoming=Math.atan2(sourceY-e.y,sourceX-e.x),toward=Math.atan2(state.player.y-e.y,state.player.x-e.x);
      const diff=Math.abs(Math.atan2(Math.sin(incoming-toward),Math.cos(incoming-toward)));
      if(diff<1.0)amount*=.35;
    }
    amount=Math.max(1,amount-(e.armour||0));
    const crit=Math.random()<state.mods.crit;if(crit)amount*=1.75;
    e.hp-=amount;e.flash=.075;state.stats.damage+=amount;state.stats.highestHit=Math.max(state.stats.highestHit,amount);
    if(knock){const dx=e.x-sourceX,dy=e.y-sourceY,d=Math.hypot(dx,dy)||1;e.x+=dx/d*knock*state.mods.knockback;e.y+=dy/d*knock*state.mods.knockback;}
    damagePopup(e,amount,crit,false);
    if(crit&&amount>45)addShake(1.3);
    if(Math.random()<.12)sfx('hit');
    if(e.hp<=0)killEnemy(e);
    return amount;
  }
  function damageBoss(amount,sourceX=state.player.x,sourceY=state.player.y){
    const b=state.boss;if(!b)return;
    const crit=Math.random()<state.mods.crit;if(crit)amount*=1.7;
    b.hp-=amount;state.stats.damage+=amount;state.stats.highestHit=Math.max(state.stats.highestHit,amount);damagePopup(b,amount,crit,true);
    if(crit&&amount>55)addShake(1.5);
    if(b.hp<=0){
      const stage=b.stage,name=b.name;state.stats.bosses++;state.score+=2500*stage;sfx('goal');addShake(5);state.boss=null;
      if(state.director.bossStage>=3)state.director.finalBossDefeated=true;
      grantBossReward(stage,name);
    }
  }
  function areaDamage(x,y,r,damage,knock=0){
    for(const e of [...state.enemies])if(Math.hypot(e.x-x,e.y-y)<=r+e.r)damageEnemy(e,damage,knock,x,y);
    if(state.boss&&Math.hypot(state.boss.x-x,state.boss.y-y)<=r+state.boss.r)damageBoss(damage,x,y);
  }
  function killEnemy(e){
    if(e.dead)return;e.dead=true;state.kills++;state.score+=10+(e.elite?150:0);if(e.elite)state.stats.elites++;
    if(state.flags.bsq&&state.kills%50===0){areaDamage(state.player.x,state.player.y,220*state.mods.area,90*state.flags.bsq*state.mods.specialPower,80);showBanner('GOAL EXPLOSION','KING BSQ · 50 KILLS');sfx('goal');addShake(4);}
    if(state.flags.millenniumBsq){state.flags.millenniumScore=(state.flags.millenniumScore||0)+1;if(state.flags.millenniumScore>=35){state.flags.millenniumScore=0;areaDamage(state.player.x,state.player.y,900,165*state.mods.specialPower,120);showBanner('MILLENNIUM SCORE','BESQUELCHER · ARENA-WIDE STRIKE');sfx('goal');addShake(5);}}
    if(state.flags.debbie&&Math.random()<.035*state.flags.debbie){state.flags.hotStreak=6+(state.flags.signatureDebbie?2:0)+(state.flags.millenniumDebbie?2:0);state.flags.hotStreakKills=0;showBanner(state.flags.millenniumDebbie?'MOLE LEAGUE FRENZY':'HOT STREAK','DEBBIE · MOLE LEAGUE MOMENTUM');}
    if(state.flags.signatureDebbie&&state.flags.hotStreak>0){state.flags.hotStreakKills=(state.flags.hotStreakKills||0)+1;if(state.flags.hotStreakKills%6===0)state.flags.hotStreak=Math.min(state.flags.millenniumDebbie?12:9,state.flags.hotStreak+.65);}
    if(state.flags.modAsh&&e.elite){magnetAllXp();if(Math.random()<.3)dropXp(e.x,e.y,e.xp*4);if(state.flags.millenniumAsh){state.flags.stolenBuff={kind:e.modifier==='armoured'?'armour':e.modifier==='swift'?'speed':choice(['attack','damage','armour']),time:12};showBanner('MILLENNIUM MASH',`Stole ${String(e.modifier||'elite').toUpperCase()}`);}}
    if(state.flags.swiped&&e.elite){state.flags.stolenBuff={kind:choice(['speed','attack','damage','armour']),time:8};showBanner('SWIPED!','Elite modifier stolen for 8 seconds');}
    if(e.modifier==='explosive')areaDamage(e.x,e.y,70,18,45);
    if(e.modifier==='splitter'&&state.enemies.length<MAX_ENEMIES-2){spawnEnemy('swarmer',false,spawnPointAroundPlayer(rand(420,560)));spawnEnemy('swarmer',false,spawnPointAroundPlayer(rand(420,560)));}
    dropXp(e.x,e.y,e.xp*(state.event?.type==='double-xp'?2:1));
    if(e.elite)grantEliteReward(e);
    if(e.cardDrop){state.forceCard=true;state.xp=Math.max(state.xp,state.nextXp);showBanner('CARD DROP CLAIMED','TCG choice earned');}
    if(Math.random()<.009)state.orbs.push({x:e.x+8,y:e.y-8,value:0,heal:12,r:7,taken:false});
    impactBurst(e.x,e.y,e.color,e.elite?7:3,e.elite?95:60);
    const i=state.enemies.indexOf(e);if(i>=0)state.enemies.splice(i,1);e._damagePopup=null;e.cardDrop=false;state.enemyPool.push(e);
  }
  function dropXp(x,y,value){
    if(state.orbs.length>=MAX_ORBS){let nearest=null,nd=90;for(const o of state.orbs){if(o.heal)continue;const d=Math.hypot(o.x-x,o.y-y);if(d<nd){nd=d;nearest=o;}}if(nearest){nearest.value+=value;nearest.r=Math.min(12,(nearest.r||5)+.4);return;}let smallest=state.orbs.find(o=>!o.heal);if(smallest){smallest.value+=value;return;}}
    state.orbs.push({x,y,value,r:value>=12?9:value>=5?7:5,taken:false});
  }
  function magnetAllXp(){for(const o of state.orbs)if(!o.heal)o.magnet=true;}

  function hurtPlayer(amount,kind='contact'){
    const p=state.player,now=state.elapsed;
    if(kind==='contact'&&state.broom.flight)return;
    if(kind==='contact'&&now-p.lastContactHit<.34)return;
    if(kind==='projectile'&&now-p.lastProjectileHit<.20)return;
    if(kind==='boss'&&now-p.lastBossHit<.40)return;
    if(state.flags.jud&&now>=state.flags.judReadyAt&&kind==='contact'){
      state.flags.judReadyAt=now+Math.max(7,12-state.flags.jud*1.2);areaDamage(p.x,p.y,180,20+8*state.flags.jud,95);showBanner('THE WALL','JUD BLOCKED THE HIT');return;
    }
    if(p.hp-amount<=0&&state.flags.varReview&&now>=state.flags.varReadyAt){state.flags.varReadyAt=now+150;p.hp=Math.max(18,p.maxHp*.18);showBanner('VAR REVIEW','LETHAL HIT OVERTURNED');sfx('goal');return;}
    const final=Math.max(1,amount-state.mods.armour);p.hp-=final;p.lastHit=now;if(kind==='contact')p.lastContactHit=now;if(kind==='projectile')p.lastProjectileHit=now;if(kind==='boss')p.lastBossHit=now;
    state.stats.damageTaken+=final;state.flags.rockyStreak=0;state.camera.damageFlash=.16;if(kind==='boss')addShake(5);else if(final>=20)addShake(1.5);sfx('hurt');
    if(p.hp<=0)finishRun(false);
  }

  function spawnProjectile(kind,x,y,vx,vy,damage,life=2,pierce=0,meta={}){
    if(state.projectiles.length>=190)return;
    state.projectiles.push({kind,x,y,vx,vy,damage,life,totalLife:life,pierce,hit:new Set(),returning:false,...meta});
  }
  function nearestEnemies(n=1,range=700){return [...state.enemies].sort((a,b)=>dist(state.player,a)-dist(state.player,b)).filter(e=>dist(state.player,e)<range).slice(0,n);}
  function normalAttack(dt){
    const s=state,p=s.player;
    if(s.weapon==='wand'){
      const w=s.wand;w.mana=Math.min(w.maxMana,w.mana+w.manaRegen*dt);
      const interval=w.attackInterval*s.mods.cooldown/s.mods.attackSpeed;if(s.elapsed-w.lastAttack<interval)return;
      const target=s.boss||nearestEnemies(1,820)[0];if(!target)return;
      const cost=w.mode==='arc'?w.manaCost*2.1:w.manaCost;if(w.mana<cost){w.mode='duel';return;}
      w.mana-=cost;w.lastAttack=s.elapsed;sfx('wand');
      if(w.mode==='duel'){
        const a=Math.atan2(target.y-p.y,target.x-p.x);spawnProjectile('wand',p.x,p.y,Math.cos(a)*790,Math.sin(a)*790,w.damage*s.mods.damage,1.35,w.duelPierce);
      }else{
        let current=target,from={x:p.x,y:p.y};const hit=[];
        for(let i=0;i<w.chainTargets&&current;i++){
          const dmg=w.damage*w.chainPower*s.mods.damage*(1-i*.10);if(current===s.boss)damageBoss(dmg,from.x,from.y);else damageEnemy(current,dmg,12,from.x,from.y);
          s.trails.push({type:'arcane',x1:from.x,y1:from.y,x2:current.x,y2:current.y,life:.22});hit.push(current);from=current;
          current=s.enemies.filter(e=>!hit.includes(e)&&Math.hypot(e.x-from.x,e.y-from.y)<220).sort((a,b)=>Math.hypot(a.x-from.x,a.y-from.y)-Math.hypot(b.x-from.x,b.y-from.y))[0];
        }
      }return;
    }
    if(s.weapon==='barry-hat'){
      const h=s.hat;const baseInterval=h.mode==='commentary'?(h.commentaryInterval||1.08):h.attackInterval;
      const interval=baseInterval*s.mods.cooldown/s.mods.attackSpeed;if(s.elapsed-h.lastAttack<interval)return;
      const target=s.boss||nearestEnemies(1,760)[0];if(!target)return;h.lastAttack=s.elapsed;sfx('hat');
      if(h.mode==='throw'){
        const a=Math.atan2(target.y-p.y,target.x-p.x);spawnProjectile('hat',p.x,p.y,Math.cos(a)*610,Math.sin(a)*610,h.damage*s.mods.damage,1.25,h.pierce,{boomerang:true,returnAt:.62,maxPierce:h.pierce});
      }else{
        const crowdFactor=1+Math.max(0,nearestEnemies(18,180).length-5)*.055;
        const pressureRamp=clamp(.86+state.elapsed/450,.86,1.28)*crowdFactor;
        areaDamage(p.x,p.y,h.commentaryRadius*s.mods.area,h.damage*.68*s.mods.damage,(h.commentaryKnockback||42)*h.knockback/pressureRamp);
        s.trails.push({type:'commentary',x:p.x,y:p.y,r:h.commentaryRadius*s.mods.area,life:.30});
      }
    }
  }

  function startBroomSpin(landing=false){
    const b=state.broom;b.attackId++;b.spin={elapsed:0,duration:landing?.36:.54,rotations:landing?2:b.rotations,id:b.attackId,landing,lastRot:-1};b.lastAttack=state.elapsed;
  }
  function broomAttack(dt){
    const b=state.broom,p=state.player;
    if(b.mode==='magic'){
      if(state.elapsed-b.lastAttack>=.82*state.mods.cooldown/state.mods.attackSpeed){
        if(b.mana<b.magicCost){b.mode='melee';showBanner('MANA EMPTY','Melee restores Mana');}
        else{
          b.mana-=b.magicCost;b.lastAttack=state.elapsed;const targets=nearestEnemies(Math.max(1,b.magicProjectiles),900);
          for(let i=0;i<Math.max(1,b.magicProjectiles);i++){const t=targets[i]||state.boss;if(!t)break;const a=Math.atan2(t.y-p.y,t.x-p.x)+rand(-.035,.035);spawnProjectile('wind',p.x,p.y,Math.cos(a)*735,Math.sin(a)*735,23*state.mods.damage,1.55,b.magicPierce,{magic:true});}
        }
      }
    }else{
      b.mana=Math.min(b.maxMana,b.mana+b.manaRegen*dt);
      if(!b.spin&&state.elapsed-b.lastAttack>=b.attackInterval*state.mods.cooldown/state.mods.attackSpeed)startBroomSpin(false);
    }
    if(b.spin){
      b.spin.elapsed+=dt;const progress=clamp(b.spin.elapsed/b.spin.duration,0,1),rot=Math.min(b.spin.rotations-1,Math.floor(progress*b.spin.rotations));
      if(rot!==b.spin.lastRot){
        b.spin.lastRot=rot;const final=rot===b.spin.rotations-1;const rhythm=final?1.38:rot===0?.90:1.02;let damage=b.spinDamage*state.mods.damage*rhythm*(b.spin.landing?1.55:1);if(state.flags.hotStreak>0)damage*=1.18;
        const radius=b.spinRadius*state.mods.area*(b.spin.landing?1.10:1);areaDamage(p.x,p.y,radius,damage,final?52*b.finalKnockback:16);
        sfx(final?'heavy':'broom');state.trails.push({type:'slash',x:p.x,y:p.y,r:radius,life:.18,arc:rot,final});impactBurst(p.x+Math.cos(progress*Math.PI*2)*radius*.5,p.y+Math.sin(progress*Math.PI*2)*radius*.5,final?'#ffe39a':'#e8c676',final?6:3,final?85:55);
        if(final){addShake(b.spin.landing?4:2.6);if(b.windShockwave)areaDamage(p.x,p.y,b.spinRadius*1.7*state.mods.area,damage*.55,55);if(b.evolved)state.trails.push({type:'vortex',x:p.x,y:p.y,r:b.spinRadius*1.6,life:1.7,damage:damage*.20,tick:0});}
      }
      if(b.spin.elapsed>=b.spin.duration)b.spin=null;
    }
  }
  function toggleBroomMode(){
    if(!state||state.weapon!=='broomstick'||state.paused||state.ended)return;const b=state.broom;if(state.elapsed-b.lastSwitch<.4)return;b.lastSwitch=state.elapsed;
    if(b.mode==='melee'&&b.mana>=b.magicCost){b.mode='magic';showBanner('MAGIC MODE','Wind Lances punish ranged threats and elites');}else{b.mode='melee';showBanner('MELEE MODE','Crowd-clearing spins restore Mana');}updateHud();
  }
  function startFlight(){
    if(!state||state.weapon!=='broomstick'||state.paused||state.ended)return;const b=state.broom,p=state.player;if(b.flight||b.charges<=0)return;
    let dx=0,dy=0;if(keys.has('a')||keys.has('ArrowLeft'))dx--;if(keys.has('d')||keys.has('ArrowRight'))dx++;if(keys.has('w')||keys.has('ArrowUp'))dy--;if(keys.has('s')||keys.has('ArrowDown'))dy++;
    if(!dx&&!dy){dx=p.vx;dy=p.vy;}if(!dx&&!dy)dy=-1;let l=Math.hypot(dx,dy)||1;dx/=l;dy/=l;
    b.charges--;b.flight={time:0,duration:.52,dx,dy,hit:new Set(),trailClock:0};b.recharge=b.flightRecharge;state.stats.flights++;p.vx=dx*420;p.vy=dy*420;sfx('flight');addShake(2.5);
  }
  function updateFlight(dt){
    const b=state.broom,p=state.player;
    if(!b.flight){
      if(b.charges<b.maxCharges){b.recharge-=dt;if(b.recharge<=0){const wasEmpty=b.charges===0;b.charges++;b.recharge=b.flightRecharge;if(wasEmpty){b.readyPulse=1.8;sfx('ready');}}}
      return;
    }
    const f=b.flight;f.time+=dt;f.trailClock-=dt;let sx=0,sy=0;if(keys.has('a')||keys.has('ArrowLeft'))sx--;if(keys.has('d')||keys.has('ArrowRight'))sx++;if(keys.has('w')||keys.has('ArrowUp'))sy--;if(keys.has('s')||keys.has('ArrowDown'))sy++;
    if(sx||sy){const l=Math.hypot(sx,sy);f.dx=lerp(f.dx,sx/l,b.flightSteer*.14);f.dy=lerp(f.dy,sy/l,b.flightSteer*.14);const fl=Math.hypot(f.dx,f.dy)||1;f.dx/=fl;f.dy/=fl;}
    const speed=915*b.flightDistance;p.vx=f.dx*speed;p.vy=f.dy*speed;p.x+=p.vx*dt;p.y+=p.vy*dt;constrainToArena(p);
    for(const e of state.enemies){if(!f.hit.has(e)&&Math.hypot(e.x-p.x,e.y-p.y)<p.r+e.r+18){f.hit.add(e);damageEnemy(e,b.flightDamage*state.mods.damage,105,p.x-f.dx*34,p.y-f.dy*34);}}
    if(state.boss&&Math.hypot(state.boss.x-p.x,state.boss.y-p.y)<p.r+state.boss.r+16)damageBoss(b.flightDamage*.68*state.mods.damage);
    if(f.trailClock<=0){f.trailClock=.045;if(state.trails.length<120)state.trails.push({type:'flight',x:p.x-f.dx*18,y:p.y-f.dy*18,r:20,life:.30});}
    if(b.flightTrail&&state.trails.length<120)state.trails.push({type:'wind',x:p.x,y:p.y,r:28,life:.65,damage:9*state.mods.damage,tick:0});
    if(f.time>=f.duration){b.flight=null;p.vx*=.32;p.vy*=.32;startBroomSpin(true);addShake(3.5);if(b.evolved)areaDamage(p.x,p.y,150*state.mods.area,65*state.mods.damage,80);}
  }


  function toggleWeaponMode(){
    if(!state||state.paused||state.ended)return;
    if(state.weapon==='broomstick'){toggleBroomMode();sfx('swap');return;}
    if(state.weapon==='wand'){
      const w=state.wand;if(state.elapsed-w.lastSwitch<.35)return;w.lastSwitch=state.elapsed;w.mode=w.mode==='duel'?'arc':'duel';showBanner(w.mode==='duel'?'DUEL MODE':'ARC MODE',w.mode==='duel'?'Fast precise bolts':'Chain magic through packed fans');sfx('swap');updateHud();return;
    }
    if(state.weapon==='barry-hat'){
      const h=state.hat;if(state.elapsed-h.lastSwitch<.35)return;h.lastSwitch=state.elapsed;h.mode=h.mode==='throw'?'commentary':'throw';showBanner(h.mode==='throw'?'THROW MODE':'COMMENTARY MODE',h.mode==='throw'?'Boomerang through the crowd':'Broadcast shockwaves shove fans back');sfx('swap');updateHud();
    }
  }
  function activateWeaponSpecial(){
    if(!state||state.paused||state.ended)return;
    if(state.weapon==='broomstick'){startFlight();return;}
    if(state.weapon==='wand'){
      const w=state.wand;if(w.special>0)return;w.special=w.specialRecharge;w.specialAnnounced=false;const count=w.stormBolts+state.mods.projectiles*2;for(let i=0;i<count;i++){const a=i*Math.PI*2/count+rand(-.045,.045);spawnProjectile('spellstorm',state.player.x,state.player.y,Math.cos(a)*rand(500,720),Math.sin(a)*rand(500,720),w.damage*.92*state.mods.damage,1.7,1);}showBanner('SPELLSTORM','The whole stand lights up');sfx('special');return;
    }
    if(state.weapon==='barry-hat'){
      const h=state.hat;if(h.special>0||h.specialTime>0)return;h.special=h.specialRecharge;h.specialAnnounced=false;h.specialTime=h.specialDuration;h.specialTick=0;showBanner('HAT TRICK!','Three hats. One Barry. Zero crowd control.');sfx('special');
    }
  }
  function updateWeaponSpecials(dt){
    if(!state)return;
    if(state.broom.readyPulse>0)state.broom.readyPulse-=dt;
    if(state.weapon==='wand'){
      const w=state.wand;if(w.special>0){w.special=Math.max(0,w.special-dt);if(w.special<=0&&!w.specialAnnounced){w.specialAnnounced=true;sfx('ready');}}
    }else if(state.weapon==='barry-hat'){
      const h=state.hat;if(h.special>0){h.special=Math.max(0,h.special-dt);if(h.special<=0&&!h.specialAnnounced){h.specialAnnounced=true;sfx('ready');}}
      if(h.specialTime>0){h.specialTime-=dt;h.specialTick-=dt;magnetAllXp();if(h.specialTick<=0){h.specialTick=.16;for(let i=0;i<h.orbitCount;i++){const a=state.elapsed*4.2+i*Math.PI*2/h.orbitCount;const x=state.player.x+Math.cos(a)*92*state.mods.area,y=state.player.y+Math.sin(a)*92*state.mods.area;areaDamage(x,y,34,h.damage*.48*state.mods.damage,16);}}}
    }
  }

  function updateProjectiles(dt){
    for(const pr of state.projectiles){
      pr.life-=dt;
      if(pr.kind==='hat'&&pr.boomerang){const age=pr.totalLife-pr.life;if(!pr.returning&&age>=pr.returnAt){pr.returning=true;pr.hit.clear();pr.pierce=pr.maxPierce;}if(pr.returning){const dx=state.player.x-pr.x,dy=state.player.y-pr.y,d=Math.hypot(dx,dy)||1;pr.vx=dx/d*720;pr.vy=dy/d*720;if(d<26){pr.life=0;continue;}}}
      pr.x+=pr.vx*dt;pr.y+=pr.vy*dt;
      for(const e of state.enemies){
        if(pr.hit.has(e))continue;
        if(Math.hypot(e.x-pr.x,e.y-pr.y)<e.r+8){
          pr.hit.add(e);let dmg=pr.damage;
          if(pr.kind==='wind'){if(e.type==='ranged')dmg*=1.32;else if(e.elite)dmg*=1.22;}
          damageEnemy(e,dmg,pr.kind==='hat'?34:pr.kind==='wind'?10:7,pr.x-pr.vx*.02,pr.y-pr.vy*.02);
          if(pr.pierce>0)pr.pierce--;else if(pr.kind==='hat'){if(!pr.returning){pr.returning=true;pr.hit.clear();pr.pierce=pr.maxPierce;}else pr.life=0;}else pr.life=0;
        }
      }
      if(state.boss&&Math.hypot(state.boss.x-pr.x,state.boss.y-pr.y)<state.boss.r+9&&!pr.hit.has(state.boss)){pr.hit.add(state.boss);damageBoss(pr.damage*(pr.kind==='wind'?1.14:1),pr.x-pr.vx*.02,pr.y-pr.vy*.02);if(pr.kind!=='hat')pr.life=0;}
      if(pr.life<=0&&state.flags.offPost&&!pr.returning&&pr.kind!=='hat'&&Math.random()<.18*state.flags.offPost){pr.returning=true;pr.life=.75;pr.vx*=-1;pr.vy*=-1;pr.hit.clear();pr.damage*=.75;}
    }
    state.projectiles=state.projectiles.filter(p=>p.life>0);
    for(const pr of state.enemyProjectiles){pr.life-=dt;pr.x+=pr.vx*dt;pr.y+=pr.vy*dt;if(Math.hypot(pr.x-state.player.x,pr.y-state.player.y)<state.player.r+7){hurtPlayer(pr.damage,'projectile');pr.life=0;}}
    state.enemyProjectiles=state.enemyProjectiles.filter(p=>p.life>0);
  }

  function updateEnemies(dt){
    const p=state.player,cell=72,grid=new Map();
    for(const e of state.enemies){const k=`${Math.floor(e.x/cell)},${Math.floor(e.y/cell)}`;if(!grid.has(k))grid.set(k,[]);grid.get(k).push(e);}
    for(const e of [...state.enemies]){
      if(e.flash>0)e.flash-=dt;if(e.slow>0)e.slow-=dt;if(e.modifier==='regenerating')e.hp=Math.min(e.maxHp,e.hp+e.maxHp*.008*dt);
      e.wanderPhase+=dt*e.wanderRate;
      let tx=p.x,ty=p.y;
      if(e.type==='interceptor'){tx+=p.vx*.72;ty+=p.vy*.72;}
      if(e.type==='seeker'){tx+=p.vx*.22;ty+=p.vy*.22;}
      let dx=tx-e.x,dy=ty-e.y,d=Math.hypot(dx,dy)||1;
      const nx=dx/d,ny=dy/d,px=-ny,py=nx;
      if(e.type==='swarmer'||e.type==='chaser'||e.type==='seeker'){const side=Math.sin(e.wanderPhase)*e.wanderAmp*(e.type==='seeker'?.55:1);dx+=px*side;dy+=py*side;}
      if(e.type==='shield'){dx+=px*e.lane*34;dy+=py*e.lane*34;}
      if(e.type==='ranged'){
        if(d<215){dx=-nx*150+px*e.lane*75;dy=-ny*150+py*e.lane*75;}else if(d<330){dx=px*(e.lane||1)*120;dy=py*(e.lane||1)*120;}
        e.shoot-=dt;if(e.shoot<=0&&d<520&&state.enemyProjectiles.length<145){e.shoot=rand(1.65,2.05);const a=Math.atan2(p.y-e.y,p.x-e.x);state.enemyProjectiles.push({kind:'cup',x:e.x,y:e.y,vx:Math.cos(a)*285,vy:Math.sin(a)*285,life:2.25,damage:e.damage});}
      }
      // Local spatial-hash separation prevents stacked blobs without an O(n²) late-game cost.
      let sepX=0,sepY=0,near=0;const gx=Math.floor(e.x/cell),gy=Math.floor(e.y/cell);
      for(let yy=-1;yy<=1;yy++)for(let xx=-1;xx<=1;xx++){for(const o of grid.get(`${gx+xx},${gy+yy}`)||[]){if(o===e||near>7)continue;const ox=e.x-o.x,oy=e.y-o.y,od=Math.hypot(ox,oy)||1,desired=e.r+o.r+8;if(od<desired){const f=(desired-od)/desired;sepX+=ox/od*f;sepY+=oy/od*f;near++;}}}
      dx+=sepX*105;dy+=sepY*105;d=Math.hypot(dx,dy)||1;
      const slow=e.slow>0?.5:1;const heavy=e.type==='beater'||e.type==='shield';e.x+=dx/d*e.speed*slow*dt*(heavy?.96:1);e.y+=dy/d*e.speed*slow*dt*(heavy?.96:1);constrainToArena(e);
      const pdx=p.x-e.x,pdy=p.y-e.y,pd=Math.hypot(pdx,pdy)||1,hitRange=e.r+p.r+2;
      if(pd<hitRange){const overlap=hitRange-pd;e.x-=pdx/pd*overlap*.45;e.y-=pdy/pd*overlap*.45;p.x+=pdx/pd*Math.min(2.8,overlap*.12);p.y+=pdy/pd*Math.min(2.8,overlap*.12);hurtPlayer(e.damage,'contact');}
      if(state.flags.soup&&pd<(state.flags.millenniumSoup?260:150)*state.mods.area)e.slow=Math.max(e.slow,state.flags.millenniumSoup?.55:.25);
      if(state.flags.stare&&e.elite&&pd<130&&state.elapsed-p.lastHit>2)e.armour=Math.max(0,e.armour-dt*.7*state.flags.stare);
    }
    constrainToArena(p);
  }

  function updateBoss(dt){
    const b=state.boss;if(!b)return;const p=state.player;let dx=p.x-b.x,dy=p.y-b.y,d=Math.hypot(dx,dy)||1;
    b.attackClock-=dt;b.summonClock-=dt;
    if(b.windup){
      b.windup.time-=dt;
      if(b.windup.time<=0){b.charge={time:.60,dx:b.windup.dx,dy:b.windup.dy};b.windup=null;addShake(2);for(let i=0;i<8&&state.enemyProjectiles.length<145;i++){const q=i*Math.PI/4;state.enemyProjectiles.push({x:b.x,y:b.y,vx:Math.cos(q)*210,vy:Math.sin(q)*210,life:3.2,damage:b.damage*.55});}}
    }else if(b.charge){
      b.charge.time-=dt;b.x+=b.charge.dx*430*dt;b.y+=b.charge.dy*430*dt;constrainToArena(b);if(Math.hypot(b.x-p.x,b.y-p.y)<b.r+p.r+6)hurtPlayer(b.damage*1.25,'boss');if(b.charge.time<=0)b.charge=null;
    }else{
      b.x+=dx/d*b.speed*dt;b.y+=dy/d*b.speed*dt;if(d<b.r+p.r+5)hurtPlayer(b.damage,'boss');
    }
    if(b.attackClock<=0&&!b.charge&&!b.windup){
      b.attackClock=rand(3.6,4.8);const a=Math.atan2(p.y-b.y,p.x-b.x),vx=Math.cos(a),vy=Math.sin(a);b.windup={time:.68,dx:vx,dy:vy};
      state.telegraphs.push({type:'charge',x1:b.x,y1:b.y,x2:b.x+vx*620,y2:b.y+vy*620,life:.68,total:.68});
    }
    if(b.summonClock<=0){b.summonClock=8.5;for(let i=0;i<4+b.stage;i++)spawnEnemy(choice(['chaser','seeker','beater']),false,spawnPointAroundPlayer(rand(500,680)));}
  }

  function updateOrbs(dt){
    const p=state.player;
    for(const o of state.orbs){let d=Math.hypot(p.x-o.x,p.y-o.y);if(o.magnet||d<state.mods.magnet){const speed=o.magnet?900:285;o.x+=(p.x-o.x)/Math.max(1,d)*speed*dt;o.y+=(p.y-o.y)/Math.max(1,d)*speed*dt;d=Math.hypot(p.x-o.x,p.y-o.y);}if(d<p.r+(o.r||7)+5){o.taken=true;if(o.heal){p.hp=Math.min(p.maxHp,p.hp+o.heal);sfx('heal');}else{const gain=o.value*state.mods.xp;state.xp+=gain;state.stats.xp+=gain;sfx('pickup');}}}
    state.orbs=state.orbs.filter(o=>!o.taken);
    if(state.xp>=state.nextXp&&!state.pendingUpgrade){state.xp-=state.nextXp;state.level++;state.nextXp=nextXpRequirement(state.level);showLevelUp(state.forceCard);state.forceCard=false;if(state.level===2)tutorial('Level up! Choose one upgrade. The run pauses while you decide.');if(state.level===3)tutorial('Your owned Quidditch TCG cards can now appear as run-changing upgrades.');}
  }

  function updateFlags(dt){
    const p=state.player;
    if(state.flags.rocky){if(state.elapsed-p.lastHit>8)state.flags.rockyStreak=Math.min(state.flags.millenniumRocky?14:10,state.flags.rockyStreak+dt*.8);}
    if(state.flags.hotStreak>0){state.flags.hotStreak-=dt;state.mods._hot=1.35+(state.flags.signatureDebbie?.15:0);}else state.mods._hot=1;
    if(state.flags.nimbler){const moving=Math.hypot(p.vx,p.vy)>40;state.flags.moveMomentum=clamp(state.flags.moveMomentum+(moving?dt*(20+(state.flags.signatureNimbler?8:0)):-dt*28),0,100);}
    if(state.flags.teaBreak){if(Math.hypot(p.vx,p.vy)<10){p.stationary+=dt;if(p.stationary>1.5){p.hp=Math.min(p.maxHp,p.hp+2.2*dt*state.flags.teaBreak);state.broom.mana=Math.min(state.broom.maxMana,state.broom.mana+state.broom.manaRegen*1.7*dt);state.flags.teaActive=true;}}else{p.stationary=0;state.flags.teaActive=false;}}
    if(state.flags.lostNotes){state.flags.lostNotesClock-=dt;if(state.flags.lostNotesClock<=0){state.flags.lostNotesClock=18-Math.min(5,state.flags.lostNotes);for(const o of state.orbs)o.magnet=true;showBanner("BARRY'S LOST NOTES",'XP snaps back to the player');}}
    if(state.flags.keepersDream){state.flags.keeperClock-=dt;if(state.flags.keeperClock<=0){state.flags.keeperClock=11;state.flags.keeperActive=4;showBanner("KEEPER'S DREAM",'Defensive formation active');}if(state.flags.keeperActive>0){state.flags.keeperActive-=dt;for(const e of state.enemies)if(Math.hypot(e.x-p.x,e.y-p.y)<105)damageEnemy(e,4*dt*state.flags.keepersDream,2,p.x,p.y);}}
    if(state.flags.stolenBuff){state.flags.stolenBuff.time-=dt;if(state.flags.stolenBuff.time<=0)state.flags.stolenBuff=null;}
    if(state.flags.binderFlex){const n=state.tcg.rarities.size;state.mods.flex=1+n*.015*state.flags.binderFlex;}else state.mods.flex=1;
    if(state.flags.team){state.mods.team=1+state.tcg.characters.size*.018*state.flags.team;}else state.mods.team=1;
  }

  function spawnSnitch(){
    if(state.snitch)return;const p=spawnPointAroundPlayer(rand(470,660),Math.random()*Math.PI*2);const a=Math.atan2(state.player.y-p.y,state.player.x-p.x)+rand(-.7,.7);state.snitch={x:p.x,y:p.y,heading:a,targetHeading:a,speed:255,time:24,turnClock:.45,burstClock:1.5,trailClock:0,orbitDir:Math.random()<.5?-1:1};showBanner('GOLDEN SNITCH','Catch it before it escapes');sfx('snitch');
  }
  function updateSnitch(dt){
    const s=state.snitch;if(!s)return;s.time-=dt;s.turnClock-=dt;s.burstClock-=dt;s.trailClock-=dt;
    const p=state.player,dx=p.x-s.x,dy=p.y-s.y,d=Math.hypot(dx,dy)||1;
    if(s.turnClock<=0){
      s.turnClock=rand(.42,.85);
      const toPlayer=Math.atan2(dy,dx),orbit=toPlayer+s.orbitDir*(Math.PI/2+rand(-.35,.35));
      s.targetHeading=d<210?orbit:lerp(toPlayer,orbit,rand(.28,.62));
      if(Math.random()<.18)s.orbitDir*=-1;
    }
    if(s.burstClock<=0){s.burstClock=rand(1.4,2.4);s.speed=rand(315,360);}else s.speed=lerp(s.speed,255+state.elapsed*.03,dt*2.4);
    s.heading+=clamp(angleDelta(s.heading,s.targetHeading),-dt*3.4,dt*3.4);s.x+=Math.cos(s.heading)*s.speed*dt;s.y+=Math.sin(s.heading)*s.speed*dt;constrainToArena(s);
    if(s.trailClock<=0){s.trailClock=.055;if(state.particles.length<MAX_PARTICLES)state.particles.push({x:s.x-Math.cos(s.heading)*12,y:s.y-Math.sin(s.heading)*12,vx:rand(-10,10),vy:rand(-10,10),life:.28,color:'#ffd84f',size:3});}
    if(Math.hypot(s.x-p.x,s.y-p.y)<p.r+20){state.snitch=null;state.stats.snitches++;state.score+=1800;sfx('snitch');const rewards=['xp','heal','card','reroll'];const reward=choice(rewards);if(reward==='xp'){state.xp+=state.nextXp*.9;showBanner('SNITCH CAUGHT','Huge XP reward');}else if(reward==='heal'){p.hp=p.maxHp;showBanner('SNITCH CAUGHT','Full heal');}else if(reward==='card'){state.forceCard=true;state.xp=Math.max(state.xp,state.nextXp);showBanner('SNITCH CAUGHT','TCG choice earned');}else{state.rerolls++;showBanner('SNITCH CAUGHT','+1 reroll');}state.director.snitchClock=rand(115,165)/(1+(state.flags.snitchSense||0)*.12);return;}
    if(s.time<=0){state.snitch=null;state.director.snitchClock=rand(110,155)/(1+(state.flags.snitchSense||0)*.12);showBanner('SNITCH ESCAPED','Another chance will come');}
  }

  function startEvent(){
    const type=choice(['bludger','crowd','double-xp','card-drop']);state.event={type,time:type==='bludger'?13:18};
    if(type==='bludger')showBanner('BLUDGER STORM','Fast projectiles cross the pitch');
    if(type==='crowd')showBanner('CROWD ROAR','Movement and attack speed increased');
    if(type==='double-xp')showBanner('DOUBLE XP','Experience drops are doubled');
    if(type==='card-drop'){showBanner('CARD DROP','Defeat the marked elite for a TCG choice');const marked=spawnEnemy(choice(['beater','interceptor','shield']),true,spawnPointAroundPlayer(560));if(marked)marked.cardDrop=true;}
  }
  function updateEvent(dt){
    if(!state.event)return;state.event.time-=dt;if(state.event.type==='bludger'&&Math.random()<dt*4&&state.enemyProjectiles.length<145){const side=Math.random()<.5?0:1,y=rand(240,2160);state.enemyProjectiles.push({x:side?2250:150,y,vx:side?-520:520,vy:rand(-40,40),life:4.5,damage:14});}
    if(state.event.time<=0)state.event=null;
  }

  function updateDirector(dt){
    const d=state.director;d.spawnClock-=dt;d.waveClock-=dt;d.eliteClock-=dt;d.stationaryWaveClock-=dt;const pressure=enemyPressure();
    if(d.spawnClock<=0){
      d.spawnClock=Math.max(.11,.64/pressure);
      const type=pickEnemyType();spawnEnemy(type,false,spawnPointAroundPlayer(rand(state.elapsed<45?430:540,state.elapsed<45?650:820)));
      if(state.elapsed>330&&Math.random()<.20)spawnEnemy(pickEnemyType(),false,spawnPointAroundPlayer(rand(560,820)));
    }
    if(d.waveClock<=0){
      const kinds=state.elapsed<120?['ring','two-sided','swarm']:state.elapsed<480?['two-sided','columns','swarm','fast-flank','mixed']:['ring','two-sided','columns','fast-flank','heavy-wall','mixed','elite-escort'];
      spawnWave(choice(kinds));d.waveClock=state.elapsed<180?rand(14,19):state.elapsed<540?rand(11,16):rand(9,13);
    }
    if(d.eliteClock<=0&&state.elapsed>70){spawnEnemy(pickEnemyType(),true,spawnPointAroundPlayer(rand(560,740)));d.eliteClock=rand(32,46);}
    if(state.elapsed>25&&state.player.idleTime>5.5&&d.stationaryWaveClock<=0){spawnWave('fast-flank');d.stationaryWaveClock=12;}
    d.eventClock-=dt;if(d.eventClock<=0){d.eventClock=rand(78,108);startEvent();}
    d.snitchClock-=dt;if(d.snitchClock<=0){spawnSnitch();d.snitchClock=999;}
    const stages=[300,600,900];if(d.bossStage<3&&state.elapsed>=stages[d.bossStage]){d.bossStage++;spawnBoss(d.bossStage);}
  }

  function updateTrails(dt){
    for(const t of state.trails){t.life-=dt;if((t.type==='wind'||t.type==='vortex')&&t.damage){t.tick-=dt;if(t.tick<=0){t.tick=.28;areaDamage(t.x,t.y,t.r,t.damage,4);}}}
    state.trails=state.trails.filter(t=>t.life>0).slice(-120);
    for(const tg of state.telegraphs)tg.life-=dt;state.telegraphs=state.telegraphs.filter(t=>t.life>0).slice(-24);
    for(const p of state.particles){p.life-=dt;p.x+=(p.vx||0)*dt;p.y+=(p.vy||-25)*dt;}state.particles=state.particles.filter(p=>p.life>0).slice(-MAX_PARTICLES);
  }

  function update(dt){
    if(!state?.running||state.paused||state.ended)return;
    state.elapsed+=dt;const p=state.player;let dx=0,dy=0;if(keys.has('a')||keys.has('ArrowLeft'))dx--;if(keys.has('d')||keys.has('ArrowRight'))dx++;if(keys.has('w')||keys.has('ArrowUp'))dy--;if(keys.has('s')||keys.has('ArrowDown'))dy++;
    const targetSpeed=207*state.mods.speed*(state.event?.type==='crowd'?1.18:1)*(state.broom.spin?state.broom.spinMoveBonus:1)*(state.flags.stolenBuff?.kind==='speed'?1.22:1);
    if(!state.broom.flight){
      if(dx||dy){const l=Math.hypot(dx,dy);dx/=l;dy/=l;p.vx=lerp(p.vx,dx*targetSpeed,clamp(dt*19,0,1));p.vy=lerp(p.vy,dy*targetSpeed,clamp(dt*19,0,1));p.idleTime=0;}
      else{p.vx=lerp(p.vx,0,clamp(dt*17,0,1));p.vy=lerp(p.vy,0,clamp(dt*17,0,1));p.idleTime+=dt;}
      p.x+=p.vx*dt;p.y+=p.vy*dt;constrainToArena(p);
    }else updateFlight(dt);
    if(!state.broom.flight&&state.weapon==='broomstick')updateFlight(dt);
    state.stats.distance+=Math.hypot(p.vx,p.vy)*dt;if(state.camera.damageFlash>0)state.camera.damageFlash-=dt;

    updateFlags(dt);updateWeaponSpecials(dt);
    const dynamicAttack=(state.flags.hotStreak>0?1.4:1)*(state.flags.stolenBuff?.kind==='attack'?1.22:1)*(state.event?.type==='crowd'?1.15:1);
    const dynamicDamage=(state.flags.stolenBuff?.kind==='damage'?1.25:1)*(state.mods.flex||1)*(state.mods.team||1)*(1+(state.flags.rockyStreak||0)*.018*(state.flags.rocky||0));
    const oldA=state.mods.attackSpeed,oldD=state.mods.damage;state.mods.attackSpeed*=dynamicAttack;state.mods.damage*=dynamicDamage;
    if(state.weapon==='broomstick')broomAttack(dt);else normalAttack(dt);
    state.mods.attackSpeed=oldA;state.mods.damage=oldD;

    updateProjectiles(dt);updateEnemies(dt);updateBoss(dt);updateOrbs(dt);updateSnitch(dt);updateEvent(dt);updateDirector(dt);updateTrails(dt);
    if(state.flags.nimbler&&state.flags.moveMomentum>=100&&Math.random()<dt*.45){areaDamage(p.x,p.y,95,24*state.mods.damage,35);state.flags.moveMomentum=72;}
    if(state.elapsed>=RUN_END&&state.director.bossStage>=3&&state.director.finalBossDefeated)finishRun(true);
    state.score+=dt*(1+state.level*.03);updateHud();updateMusic();
  }

  function drawArena(){
    const cam=state.camera,p=state.player;const speed=Math.hypot(p.vx,p.vy);
    const lookX=clamp(p.vx*.28,-110,110),lookY=clamp(p.vy*.28,-85,85),targetX=p.x+lookX,targetY=p.y+lookY;
    cam.x=lerp(cam.x,targetX,.09);cam.y=lerp(cam.y,targetY,.09);
    let targetZoom=state.broom.flight?1.02:speed>320?1.12:state.boss?1.15:1.20;cam.zoom=lerp(cam.zoom,targetZoom,.065);
    const shake=cam.shake||0,shakeX=shake?rand(-shake,shake):0,shakeY=shake?rand(-shake,shake):0;cam.shake=lerp(shake,0,.20);

    ctx.setTransform(viewport.dpr,0,0,viewport.dpr,0,0);ctx.imageSmoothingEnabled=false;ctx.fillStyle='#05060a';ctx.fillRect(0,0,viewport.w,viewport.h);
    ctx.save();ctx.translate(viewport.w/2+shakeX,viewport.h/2+shakeY);ctx.scale(cam.zoom,cam.zoom);ctx.translate(-cam.x,-cam.y);
    if(arenaImage.complete&&arenaImage.naturalWidth)ctx.drawImage(arenaImage,0,0,WORLD.w,WORLD.h);else{ctx.fillStyle='#8d693d';ctx.fillRect(0,0,WORLD.w,WORLD.h);}
    ctx.fillStyle='#00000016';ctx.beginPath();ctx.ellipse(WORLD.cx,WORLD.cy,WORLD.rx,WORLD.ry,0,0,Math.PI*2);ctx.fill();
    for(const tg of state.telegraphs){if(tg.type==='charge'){ctx.save();ctx.globalAlpha=clamp(tg.life/tg.total,0,1)*.72;ctx.strokeStyle='#ffbf63';ctx.lineWidth=12;ctx.setLineDash([24,18]);ctx.beginPath();ctx.moveTo(tg.x1,tg.y1);ctx.lineTo(tg.x2,tg.y2);ctx.stroke();ctx.setLineDash([]);ctx.restore();}}
    for(const o of state.orbs){ctx.save();ctx.translate(o.x,o.y);if(o.heal){ctx.fillStyle='#d54f55';ctx.fillRect(-5,-2,10,4);ctx.fillRect(-2,-5,4,10);}else{ctx.fillStyle=o.value>10?'#9be6ff':o.value>4?'#69baf0':'#88d7ff';ctx.shadowBlur=8;ctx.shadowColor='#6ecbff';ctx.rotate(state.elapsed*2);ctx.fillRect(-(o.r||5)/2,-(o.r||5)/2,o.r||5,o.r||5);}ctx.restore();}
    for(const t of state.trails){ctx.save();ctx.globalAlpha=clamp(t.life*2.4,0,1);if(t.type==='slash'){ctx.strokeStyle=t.final?'#fff0b5':'#ffe29b';ctx.lineWidth=t.final?10:7;ctx.beginPath();ctx.arc(t.x,t.y,t.r,-1.15,1.2);ctx.stroke();}else if(t.type==='chain'||t.type==='arcane'){ctx.strokeStyle=t.type==='arcane'?'#c899ff':'#9eeaff';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(t.x1,t.y1);ctx.lineTo((t.x1+t.x2)/2+rand(-8,8),(t.y1+t.y2)/2+rand(-8,8));ctx.lineTo(t.x2,t.y2);ctx.stroke();}else if(t.type==='commentary'){ctx.strokeStyle='#f5d476';ctx.lineWidth=5;ctx.beginPath();ctx.arc(t.x,t.y,t.r*(1.1+(1-t.life)*.6),0,Math.PI*2);ctx.stroke();}else if(t.type==='flight'){ctx.strokeStyle='#d7f3ff';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(t.x-16,t.y);ctx.lineTo(t.x+16,t.y);ctx.stroke();}else if(t.type==='wind'){ctx.strokeStyle='#b5e9ff';ctx.lineWidth=4;ctx.beginPath();ctx.arc(t.x,t.y,t.r,0,Math.PI*2);ctx.stroke();}else if(t.type==='vortex'){ctx.strokeStyle='#b9a8ff';ctx.lineWidth=6;ctx.beginPath();ctx.arc(t.x,t.y,t.r*(1-t.life/1.7*.25),state.elapsed*5,state.elapsed*5+4.5);ctx.stroke();}ctx.restore();}
    for(const pr of state.projectiles){if(pr.kind==='hat'){ctx.save();ctx.translate(pr.x,pr.y);ctx.rotate(state.elapsed*8);if(barryHatImage.complete&&barryHatImage.naturalWidth)ctx.drawImage(barryHatImage,-22,-10,44,20);else{ctx.fillStyle='#dfb83c';ctx.fillRect(-18,-5,36,10);}ctx.restore();continue;}ctx.fillStyle=pr.kind==='wind'?'#c7efff':pr.kind==='wand'?'#c78dff':pr.kind==='spellstorm'?'#ffe58b':pr.kind==='wrong'?'#ff8f69':'#e8d29b';ctx.shadowBlur=pr.kind==='spellstorm'?12:6;ctx.shadowColor=ctx.fillStyle;ctx.beginPath();ctx.arc(pr.x,pr.y,pr.kind==='wind'?6:pr.kind==='spellstorm'?5:4,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;}
    for(const pr of state.enemyProjectiles){if(pr.kind==='cup'){ctx.save();ctx.translate(pr.x,pr.y);ctx.rotate(Math.atan2(pr.vy,pr.vx)+state.elapsed*5);ctx.fillStyle='#eee8d7';ctx.fillRect(-5,-6,10,12);ctx.fillStyle='#b83c39';ctx.fillRect(-5,-6,10,3);ctx.restore();}else{ctx.fillStyle='#bd4c42';ctx.shadowBlur=8;ctx.shadowColor='#ff624e';ctx.beginPath();ctx.arc(pr.x,pr.y,7,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;}}
    for(const e of state.enemies)drawEnemy(e);if(state.boss)drawBoss(state.boss);if(state.snitch)drawSnitch(state.snitch);drawPlayer();
    for(const pfx of state.particles){ctx.globalAlpha=clamp(pfx.life/.32,0,1);if(pfx.text){ctx.font=`900 ${pfx.size||12}px Arial`;ctx.textAlign='center';ctx.fillStyle=pfx.color||'#fff';ctx.fillText(pfx.text,pfx.x,pfx.y);}else{ctx.fillStyle=pfx.color||'#fff';ctx.fillRect(pfx.x,pfx.y,pfx.size||3,pfx.size||3);}ctx.globalAlpha=1;}
    ctx.restore();ctx.setTransform(viewport.dpr,0,0,viewport.dpr,0,0);
    if(cam.damageFlash>0){ctx.fillStyle=`rgba(160,20,28,${clamp(cam.damageFlash*.7,0,.11)})`;ctx.fillRect(0,0,viewport.w,viewport.h);}
  }
  function drawEnemy(e){
    ctx.save();ctx.translate(e.x,e.y);
    if(e.elite){ctx.shadowBlur=18;ctx.shadowColor='#f0c35d';ctx.strokeStyle='#f0c35d';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,e.r+9,0,Math.PI*2);ctx.stroke();ctx.shadowBlur=0;}
    const flash=e.flash>0?'#fff3cf':null;
    const person=(ox,oy,scale=1,shirt=e.shirt)=>{ctx.save();ctx.translate(ox,oy);ctx.scale(scale,scale);ctx.fillStyle=flash||shirt;ctx.fillRect(-10,-2,20,22);ctx.fillStyle=e.skin;ctx.fillRect(-7,-14,14,13);ctx.fillStyle='#171417';ctx.fillRect(-5,-11,3,3);ctx.fillRect(2,-11,3,3);ctx.fillStyle=e.accent;ctx.fillRect(-12,2,24,4);ctx.fillStyle='#241c18';ctx.fillRect(-9,20,6,9);ctx.fillRect(3,20,6,9);ctx.restore();};
    if(e.fan==='mascot'){
      ctx.fillStyle=flash||e.shirt;ctx.beginPath();ctx.arc(0,2,e.r,0,Math.PI*2);ctx.fill();ctx.fillStyle='#e9b84d';ctx.beginPath();ctx.arc(0,-10,e.r*.68,0,Math.PI*2);ctx.fill();ctx.fillStyle='#181517';ctx.fillRect(-9,-14,5,5);ctx.fillRect(4,-14,5,5);ctx.fillStyle='#fff0b0';ctx.fillRect(-5,-3,10,5);ctx.fillStyle=e.accent;ctx.fillRect(-e.r,7,e.r*2,5);
    }else if(e.fan==='stack'){
      const count=e.stack||2;for(let i=0;i<count;i++)person(0,12-i*25,Math.max(.68,1-i*.08),i%2?e.accent:e.shirt);
    }else{
      person(0,0,e.fan==='fan'?.72:e.fan==='drummer'?1.18:1);
      if(e.fan==='flag'){ctx.strokeStyle='#6b431d';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(8,-4);ctx.lineTo(18,-35);ctx.stroke();ctx.fillStyle=e.accent;ctx.beginPath();ctx.moveTo(18,-35);ctx.lineTo(40,-29);ctx.lineTo(18,-21);ctx.closePath();ctx.fill();}
      if(e.fan==='scarf'){ctx.strokeStyle='#f0cf62';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-14,-2);ctx.lineTo(14,-18);ctx.stroke();}
      if(e.fan==='drummer'){ctx.fillStyle='#b88b37';ctx.beginPath();ctx.arc(0,7,12,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#2d2017';ctx.lineWidth=2;ctx.stroke();ctx.strokeStyle='#ddd0a7';ctx.beginPath();ctx.moveTo(-15,-6);ctx.lineTo(8,9);ctx.moveTo(15,-6);ctx.lineTo(-8,9);ctx.stroke();}
      if(e.fan==='cup'){ctx.fillStyle='#ece7d6';ctx.fillRect(12,-5,8,11);ctx.fillStyle='#c64a43';ctx.fillRect(12,-5,8,3);}
    }
    if(e.type==='shield'){ctx.strokeStyle='#f0d27a';ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,0,e.r+7,-1.1,1.1);ctx.stroke();}
    if(e.elite){ctx.fillStyle='#250909';ctx.fillRect(-24,-e.r-18,48,5);ctx.fillStyle='#e6b74a';ctx.fillRect(-24,-e.r-18,48*clamp(e.hp/e.maxHp,0,1),5);}
    ctx.restore();
  }
  function drawBoss(b){
    ctx.save();ctx.translate(b.x,b.y);ctx.shadowBlur=22;ctx.shadowColor=b.color;ctx.strokeStyle='#f5d579';ctx.lineWidth=5;ctx.beginPath();ctx.arc(0,0,b.r+10,0,Math.PI*2);ctx.stroke();ctx.shadowBlur=0;
    if(b.fan==='tower'){
      for(let i=0;i<3;i++){const y=22-i*34;ctx.fillStyle=i%2?b.color:'#6c3f88';ctx.fillRect(-20,y-15,40,30);ctx.fillStyle='#d79b72';ctx.fillRect(-13,y-31,26,17);ctx.fillStyle='#111';ctx.fillRect(-8,y-26,5,4);ctx.fillRect(4,y-26,5,4);}
    }else if(b.fan==='mascot'){
      ctx.fillStyle=b.color;ctx.beginPath();ctx.arc(0,0,b.r,0,Math.PI*2);ctx.fill();ctx.fillStyle='#e3b452';ctx.beginPath();ctx.arc(0,-12,b.r*.72,0,Math.PI*2);ctx.fill();ctx.fillStyle='#111';ctx.fillRect(-18,-20,10,8);ctx.fillRect(8,-20,10,8);ctx.fillStyle='#f7e5a3';ctx.fillRect(-10,-3,20,8);
    }else{
      ctx.fillStyle=b.color;ctx.fillRect(-34,-8,68,56);ctx.fillStyle='#dca377';ctx.fillRect(-22,-38,44,34);ctx.fillStyle='#171417';ctx.fillRect(-13,-28,8,7);ctx.fillRect(6,-28,8,7);ctx.fillStyle='#f0d35b';ctx.fillRect(-42,4,84,8);ctx.strokeStyle='#e5c053';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(26,-8);ctx.lineTo(48,-55);ctx.stroke();
    }
    ctx.restore();
  }
  function drawSnitch(s){ctx.save();ctx.translate(s.x,s.y);ctx.shadowBlur=16;ctx.shadowColor='#ffe355';ctx.fillStyle='#f4c83f';ctx.beginPath();ctx.arc(0,0,9,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#f9edc0';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-7,0);ctx.quadraticCurveTo(-24,-13,-34,-4);ctx.moveTo(7,0);ctx.quadraticCurveTo(24,-13,34,-4);ctx.stroke();ctx.shadowBlur=0;ctx.restore();}
  function drawPlayer(){
    const p=state.player;

    // Ground marker keeps the player readable against the detailed arena floor.
    ctx.save();
    ctx.globalAlpha=.78;
    ctx.fillStyle='#05070bcc';
    ctx.beginPath();ctx.ellipse(p.x,p.y+24,28,10,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#ffd968';ctx.lineWidth=2.5;
    ctx.beginPath();ctx.ellipse(p.x,p.y+24,31,12,0,0,Math.PI*2);ctx.stroke();
    ctx.restore();

    if(state.broom.flight){
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(Math.atan2(state.broom.flight.dy,state.broom.flight.dx));
      ctx.strokeStyle='#d29a44';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(-26,8);ctx.lineTo(28,-5);ctx.stroke();
      ctx.fillStyle='#b18433';ctx.beginPath();ctx.moveTo(-28,8);ctx.lineTo(-43,18);ctx.lineTo(-37,3);ctx.closePath();ctx.fill();ctx.restore();
    }

    // Reuse the saved Repo Combat appearance, but scale it up for this much larger arena.
    ctx.save();
    ctx.translate(p.x,p.y);ctx.scale(1.58,1.58);ctx.translate(-p.x,-p.y);
    // Draw the Repo Combat-style base character without importing any normal Combat weapon art.
    try{fallbackPlayer();}catch(_){fallbackPlayer();}
    ctx.restore();

    if(state.weapon==='broomstick'){
      const b=state.broom;let angle=-.3;if(b.spin)angle=(b.spin.elapsed/b.spin.duration)*Math.PI*2*b.spin.rotations;
      const drawBroom=(a,alpha=1,width=6)=>{ctx.save();ctx.globalAlpha=alpha;ctx.translate(p.x,p.y);ctx.rotate(a);ctx.strokeStyle=b.evolved?'#d9c5ff':'#9f6b2d';ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(-55,0);ctx.lineTo(55,0);ctx.stroke();ctx.fillStyle='#c4933f';ctx.beginPath();ctx.moveTo(-54,-8);ctx.lineTo(-73,-15);ctx.lineTo(-66,11);ctx.closePath();ctx.fill();ctx.restore();};
      if(b.spin){drawBroom(angle-.42,.12,5);drawBroom(angle-.21,.22,5);}drawBroom(angle,1,6);
      if(b.spin){ctx.save();ctx.globalAlpha=.42;ctx.strokeStyle=b.evolved?'#cbb9ff':'#f2d077';ctx.lineWidth=4;ctx.beginPath();ctx.arc(p.x,p.y,b.spinRadius*state.mods.area,angle-.9,angle+.55);ctx.stroke();ctx.restore();}
    }
    if(state.weapon==='wand'){
      const w=state.wand;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(-.72);ctx.strokeStyle=w.evolved?'#ead7ff':'#8e6742';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(-6,10);ctx.lineTo(34,-28);ctx.stroke();ctx.fillStyle=w.mode==='arc'?'#c18aff':'#ffe18a';ctx.shadowBlur=14;ctx.shadowColor=ctx.fillStyle;ctx.beginPath();ctx.arc(36,-30,5,0,Math.PI*2);ctx.fill();ctx.restore();
    }
    if(state.weapon==='barry-hat'){
      ctx.save();ctx.translate(p.x,p.y-30);if(barryHatImage.complete&&barryHatImage.naturalWidth)ctx.drawImage(barryHatImage,-35,-16,70,32);else{ctx.fillStyle='#d8b53d';ctx.fillRect(-30,-8,60,16);}ctx.restore();
      if(state.hat.specialTime>0){for(let i=0;i<state.hat.orbitCount;i++){const a=state.elapsed*4.2+i*Math.PI*2/state.hat.orbitCount;const x=p.x+Math.cos(a)*92*state.mods.area,y=p.y+Math.sin(a)*92*state.mods.area;ctx.save();ctx.translate(x,y);ctx.rotate(a+state.elapsed*4);if(barryHatImage.complete&&barryHatImage.naturalWidth)ctx.drawImage(barryHatImage,-18,-8,36,16);ctx.restore();}}
    }
    if(state.weapon==='broomstick'&&state.broom.charges>0){ctx.save();ctx.globalAlpha=.28+.18*Math.sin(state.elapsed*7);ctx.strokeStyle='#ffe06a';ctx.lineWidth=3+(state.broom.readyPulse>0?2:0);ctx.shadowBlur=state.broom.readyPulse>0?20:10;ctx.shadowColor='#ffd84d';ctx.beginPath();ctx.arc(p.x,p.y,42+(state.broom.readyPulse>0?6*Math.sin(state.elapsed*14):0),0,Math.PI*2);ctx.stroke();ctx.restore();}
    if(state.flags.keeperActive>0){ctx.strokeStyle='#9bd6ffbb';ctx.lineWidth=4;for(let i=0;i<3;i++){const a=state.elapsed*2+i*Math.PI*2/3;ctx.beginPath();ctx.arc(p.x+Math.cos(a)*70,p.y+Math.sin(a)*70,14,0,Math.PI*2);ctx.stroke();}}
    if(state.flags.soup){ctx.strokeStyle='#83b89655';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,150*state.mods.area,0,Math.PI*2);ctx.stroke();}

    ctx.save();ctx.textAlign='center';ctx.font='900 11px Arial';ctx.fillStyle='#ffe29b';ctx.strokeStyle='#090a0c';ctx.lineWidth=4;ctx.strokeText('YOU',p.x,p.y-48);ctx.fillText('YOU',p.x,p.y-48);ctx.restore();
  }
  function fallbackPlayer(){const p=state.player;ctx.fillStyle='#9a6b3d';ctx.fillRect(p.x-10,p.y-22,20,10);ctx.fillStyle='#d0a179';ctx.fillRect(p.x-8,p.y-12,16,14);ctx.fillStyle='#506f9b';ctx.fillRect(p.x-12,p.y+2,24,23);}

  function updateHud(){
    if(!state)return;
    els.time.textContent=fmtTime(state.elapsed);els.kills.textContent=String(state.kills);els.level.textContent=String(state.level);els.score.textContent=Math.floor(state.score).toLocaleString('en-GB');els.hp.style.width=`${clamp(state.player.hp/state.player.maxHp*100,0,100)}%`;els.xp.style.width=`${clamp(state.xp/state.nextXp*100,0,100)}%`;
    let name='BROOMSTICK',mode='MELEE',resource='MANA',resourceText='100 / 100',special='FLIGHT',specialText='READY',specialPct=100,ready=true,controls='WASD MOVE · Q SWAP MODE · SPACE FLY';
    if(state.weapon==='broomstick'){
      const b=state.broom;name=b.evolved?'NIMBUS TEMPEST':'BROOMSTICK';mode=b.mode.toUpperCase();resourceText=`${Math.floor(b.mana)} / ${b.maxMana}`;els.mana.style.width=`${clamp(b.mana/b.maxMana*100,0,100)}%`;els.manaBar.hidden=false;ready=b.charges>0;specialText=ready?`${'●'.repeat(b.charges)}${'○'.repeat(Math.max(0,b.maxCharges-b.charges))} READY`:`${Math.max(0,b.recharge).toFixed(1)}s`;specialPct=ready?100:clamp((1-b.recharge/b.flightRecharge)*100,0,100);
    }else if(state.weapon==='wand'){
      const w=state.wand;name=w.evolved?'STADIUM SORCERY':'WAND';mode=w.mode.toUpperCase();resourceText=`${Math.floor(w.mana)} / ${w.maxMana}`;els.mana.style.width=`${clamp(w.mana/w.maxMana*100,0,100)}%`;els.manaBar.hidden=false;special='SPELLSTORM';ready=w.special<=0;specialText=ready?'READY':`${w.special.toFixed(1)}s`;specialPct=ready?100:clamp((1-w.special/w.specialRecharge)*100,0,100);controls='WASD MOVE · Q DUEL / ARC · SPACE SPELLSTORM';
    }else if(state.weapon==='barry-hat'){
      const h=state.hat;name=h.evolved?'PRIME-TIME BARRY':'BARRY BRAMBLE’S HAT';mode=h.mode.toUpperCase();resource='STYLE';resourceText=h.specialTime>0?'HAT TRICK LIVE':'NO MANA';els.manaBar.hidden=true;special='HAT TRICK!';ready=h.special<=0&&h.specialTime<=0;specialText=h.specialTime>0?`${h.specialTime.toFixed(1)}s LIVE`:ready?'READY':`${h.special.toFixed(1)}s`;specialPct=h.specialTime>0?100:ready?100:clamp((1-h.special/h.specialRecharge)*100,0,100);controls='WASD MOVE · Q THROW / COMMENTARY · SPACE HAT TRICK';
    }
    els.weaponName.textContent=name;els.broomMode.textContent=mode;els.resourceLabel.textContent=resource;els.manaText.textContent=resourceText;els.specialLabel.textContent=special;els.flightDots.textContent=specialText;els.specialFill.style.width=`${specialPct}%`;els.specialReady.textContent=`${special} READY · SPACE`;els.specialReady.hidden=!ready;els.broomHud.classList.toggle('ready',ready);els.weaponControls.textContent=controls;
    let ev='',sub='';if(state.boss){ev=state.boss.name;sub=`${Math.max(0,Math.ceil(state.boss.hp/state.boss.maxHp*100))}% HP`;}else if(state.snitch){ev='GOLDEN SNITCH';sub=`${Math.ceil(state.snitch.time)}s remaining`;}else if(state.event){ev=state.event.type.replace('-', ' ').toUpperCase();sub=`${Math.ceil(state.event.time)}s`;}els.event.textContent=ev||'MATCH LIVE';els.eventSub.textContent=sub||'The stands have invaded · survive the pitch';
  }
  function renderCardStrip(){
    if(!els.cardStrip||!state)return;els.cardStrip.innerHTML=[...state.tcg.cards.values()].slice(-5).map(({card,rank})=>`<div class="qs-mini-card ${['legendary','millennium','signature','platinum'].includes(card.rarity)?'rare':''}" title="${safeText(cardDescription(card,rank))}"><img src="${safeText(card.image)}" alt=""><em>${safeText(card.name)} · ${rank}</em></div>`).join('');
  }

  function frame(ts){
    if(!visible)return;if(!state){raf=requestAnimationFrame(frame);return;}if(!state.lastTs)state.lastTs=ts;const dt=Math.min(.034,(ts-state.lastTs)/1000);state.lastTs=ts;update(dt);drawArena();raf=requestAnimationFrame(frame);
  }

  function startRun(){
    const selected=preferredWeapon||'broomstick';resetState(selected);els.intro.hidden=true;els.results.hidden=true;els.levelup.hidden=true;
    resize();try{els.canvas.focus({preventScroll:true});}catch(_){try{els.canvas.focus();}catch(__){}}
    seedOpeningPressure();startMusic();showBanner('PITCH INVASION','SURVIVE · BUILD · DOMINATE');tutorial('WASD / arrows to move. Attacks are automatic. Keep moving — the crowd reacts if you camp.');
    setTimeout(()=>tutorial(selected==='broomstick'?'Broomstick: Q swaps MELEE / MAGIC. SPACE flies through a horde.':selected==='wand'?'Wand: Q swaps DUEL / ARC. SPACE casts SPELLSTORM.':'Barry’s Hat: Q swaps THROW / COMMENTARY. SPACE activates HAT TRICK!'),2500);
    state.lastTs=0;if(!raf)raf=requestAnimationFrame(frame);
  }

  async function finishRun(won){
    if(!state||state.ended)return;state.ended=true;state.running=false;state.paused=true;state.won=won;stopMusic();if(els.cardStrip)els.cardStrip.innerHTML='';
    const gp=Math.min(25000,Math.floor(state.elapsed*2+state.kills*3+state.stats.elites*45+state.stats.bosses*450+state.stats.snitches*650));
    const newBests=[];
    if(Math.floor(state.score)>profile.bestScore)newBests.push('SCORE');if(Math.floor(state.elapsed)>profile.bestTime)newBests.push('TIME');if(state.kills>profile.bestKills)newBests.push('KILLS');if(state.level>profile.bestLevel)newBests.push('LEVEL');if(state.stats.snitches>profile.bestSnitches)newBests.push('SNITCHES');if(Math.floor(state.stats.highestHit)>profile.bestHit)newBests.push('HIT');
    profile.runs++;profile.bestScore=Math.max(profile.bestScore,Math.floor(state.score));profile.bestTime=Math.max(profile.bestTime,Math.floor(state.elapsed));profile.bestKills=Math.max(profile.bestKills,state.kills);profile.bestLevel=Math.max(profile.bestLevel,state.level);profile.bestSnitches=Math.max(profile.bestSnitches,state.stats.snitches);profile.bestHit=Math.max(profile.bestHit,Math.floor(state.stats.highestHit));saveProfile();
    els.resultTitle.textContent=won?'QUIDDITCH GROUND CLEARED':'RUN OVER';
    const stats=[['TIME',fmtTime(state.elapsed),newBests.includes('TIME')],['KILLS',state.kills,newBests.includes('KILLS')],['ELITES',state.stats.elites,false],['BOSSES',state.stats.bosses,false],['SNITCHES',state.stats.snitches,newBests.includes('SNITCHES')],['LEVEL',state.level,newBests.includes('LEVEL')],['HIGHEST HIT',Math.floor(state.stats.highestHit),newBests.includes('HIT')],['SCORE',Math.floor(state.score).toLocaleString('en-GB'),newBests.includes('SCORE')],['GP',gp.toLocaleString('en-GB'),false],['REROLLS',state.stats.rerolls,false],['FLIGHTS',state.stats.flights,false],['TCG PICKS',state.stats.cardsPicked,false]];
    els.resultGrid.innerHTML=stats.map(([a,b,best])=>`<div class="qs-result-stat${best?' new-best':''}"><small>${a}${best?' · NEW BEST':''}</small><b>${b}</b></div>`).join('');
    const weapon=state.weapon==='broomstick'?(state.broom.evolved?'Nimbus Tempest':'Broomstick'):state.weapon==='wand'?(state.wand.evolved?'Stadium Sorcery':'Wand'):(state.hat.evolved?'Prime-Time Barry':"Barry Bramble’s Hat");
    const cardPills=[...state.tcg.cards.values()].map(({card,rank})=>`<span class="qs-build-card"><img src="${safeText(card.image)}" alt=""><em>${safeText(card.name)} · ${rank}</em></span>`).join('');
    const synergyPills=[...state.tcg.synergies].map(id=>`<span class="qs-build-pill synergy">${safeText(id.replaceAll('_',' ').toUpperCase())}</span>`).join('');
    els.buildSummary.innerHTML=`<span class="qs-build-pill">WEAPON · ${safeText(weapon)}</span><span class="qs-build-pill">DAMAGE · ${Math.floor(state.stats.damage).toLocaleString('en-GB')}</span>${cardPills}${synergyPills}${newBests.length?`<span class="qs-build-pill best">NEW BEST · ${safeText(newBests.join(' / '))}</span>`:''}`;
    els.saveStatus.textContent='Saving isolated Quidditch Ground result…';els.results.hidden=false;
    const dbx=hostDb();
    if(dbx&&hostCharacter()){
      try{const {data,error}=await dbx.rpc('complete_repo_sports_survivor_run',{p_score:Math.floor(state.score),p_seconds:Math.floor(state.elapsed),p_kills:state.kills,p_elites:state.stats.elites,p_bosses:state.stats.bosses,p_snitches:state.stats.snitches});if(error)throw error;const row=Array.isArray(data)?data[0]:data;if(row?.new_gp!=null){const ch=hostCharacter();if(ch)ch.gp=Number(row.new_gp);try{if(typeof renderCharacter==='function')renderCharacter();}catch(_){}els.saveStatus.textContent=`Saved · +${Number(row.awarded_gp||0).toLocaleString('en-GB')} GP`;}else els.saveStatus.textContent='Run saved locally.';}catch(error){console.warn('Quidditch Ground result save unavailable:',error);els.saveStatus.textContent='Run saved locally. Run the included Quidditch Ground SQL once to enable GP/stat saving.';}
    }else els.saveStatus.textContent='Guest run — local records only.';
    if(!profile.tutorialDone){profile.tutorialDone=true;saveProfile();}
  }

  function resize(){
    if(!els.canvas)return;
    const rect=els.canvas.getBoundingClientRect();
    viewport.dpr=Math.min(1.5,window.devicePixelRatio||1);
    viewport.w=Math.max(640,Math.round(rect.width));
    viewport.h=Math.max(360,Math.round(rect.height));
    const w=Math.round(viewport.w*viewport.dpr),h=Math.round(viewport.h*viewport.dpr);
    if(els.canvas.width!==w||els.canvas.height!==h){els.canvas.width=w;els.canvas.height=h;}
    if(ctx){ctx.setTransform(viewport.dpr,0,0,viewport.dpr,0,0);ctx.imageSmoothingEnabled=false;}
  }
  function bind(){
    if(listenersBound)return;listenersBound=true;
    window.addEventListener('resize',resize);window.addEventListener('blur',()=>keys.clear());window.addEventListener('keydown',onKeyDown,{passive:false});window.addEventListener('keyup',e=>keys.delete(e.key.length===1?e.key.toLowerCase():e.key));
    els.canvas?.addEventListener('pointerdown',()=>{try{els.canvas.focus({preventScroll:true});}catch(_){}});els.dialog?.addEventListener('close',cleanup);
    document.getElementById('qsStart')?.addEventListener('click',startRun);
    document.getElementById('qsPlayAgain')?.addEventListener('click',()=>{if(els.cardStrip)els.cardStrip.innerHTML='';els.results.hidden=true;startRun();});
    document.getElementById('qsChangeWeapon')?.addEventListener('click',()=>{if(els.cardStrip)els.cardStrip.innerHTML='';els.results.hidden=true;els.intro.hidden=false;renderIntro();});
    document.getElementById('qsReturnCombat')?.addEventListener('click',returnToCombat);document.getElementById('qsClose')?.addEventListener('click',()=>els.dialog?.close());
    document.getElementById('qsSound')?.addEventListener('click',()=>{ensureAudio();soundEnabled=!soundEnabled;if(music)music.muted=!soundEnabled;document.getElementById('qsSound').textContent=soundEnabled?'SOUND':'SOUND OFF';if(soundEnabled)sfx('swap');});
    els.intro?.addEventListener('click',e=>{const b=e.target.closest('.qs-weapon');if(!b)return;els.intro.querySelectorAll('.qs-weapon').forEach(x=>{const on=x===b;x.classList.toggle('selected',on);x.setAttribute('aria-pressed',on?'true':'false');});preferredWeapon=b.dataset.weapon||'broomstick';sfx('swap');});
  }
  function onKeyDown(e){
    const key=e.key.length===1?e.key.toLowerCase():e.key;keys.add(key);
    if(!visible)return;
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();
    if(key==='q')toggleWeaponMode();if(e.code==='Space')activateWeaponSpecial();
    if(state?.pendingUpgrade&&['1','2','3','4','5'].includes(key)){const b=els.choiceGrid.children[Number(key)-1];if(b)b.click();}
  }
  function renderIntro(){
    loadProfile();
    document.querySelectorAll('.qs-weapon').forEach(b=>{const on=b.dataset.weapon===preferredWeapon;b.classList.toggle('selected',on);b.setAttribute('aria-pressed',on?'true':'false');});
    const best=document.getElementById('qsBestRun');if(best)best.textContent=profile.bestScore?`Best score ${profile.bestScore.toLocaleString('en-GB')} · ${fmtTime(profile.bestTime)}`:'No completed Quidditch Ground run yet.';
  }
  function cleanup(){
    visible=false;cancelAnimationFrame(raf);raf=0;stopMusic();keys.clear();clearTimeout(bannerTimer);clearTimeout(tutorialTimer);if(els.cardStrip)els.cardStrip.innerHTML='';document.getElementById('qsLevelControls')?.remove();if(state){state.running=false;state.enemies.length=0;state.enemyPool.length=0;state.projectiles.length=0;state.enemyProjectiles.length=0;state.orbs.length=0;state.particles.length=0;state.trails.length=0;state.telegraphs.length=0;}state=null;
  }
  function returnToCombat(){
    cleanup();try{els.dialog?.close();}catch(_){ }
    setTimeout(()=>{try{if(typeof openCombat==='function')openCombat();else document.getElementById('openCombat')?.click();setTimeout(()=>document.querySelector('#combatModeSwitcherSafe [data-combat-menu="endless"]')?.click(),80);}catch(_){ }},30);
  }

  function open(opts={}){
    cacheEls();if(!els.dialog||!els.canvas)return false;preferredWeapon=['broomstick','wand','barry-hat'].includes(opts.preferredWeapon)?opts.preferredWeapon:'broomstick';visible=true;loadProfile();collectionPromise=null;ownedCards=[];if(els.cardStrip)els.cardStrip.innerHTML='';loadCollection();renderIntro();els.intro.hidden=false;els.levelup.hidden=true;els.results.hidden=true;els.broomHud.hidden=true;els.manaBar.hidden=true;bind();try{if(!els.dialog.open)els.dialog.showModal();}catch(_){els.dialog.setAttribute('open','');}requestAnimationFrame(()=>{resize();if(!raf)raf=requestAnimationFrame(frame);});return true;
  }

  window.RepoSportsSurvivor={open,close:()=>els.dialog?.close(),finish:()=>state&&finishRun(true),getState:()=>state};
})();
