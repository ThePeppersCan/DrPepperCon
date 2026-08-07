/* Repo Sports Quidditch Ground — isolated survivor mode.
   IMPORTANT: this file does not patch Repo Combat functions. It is only opened by the Repo Sports map launcher. */
(() => {
  'use strict';
  if (window.RepoSportsSurvivor) return;

  const WORLD = { w: 2400, h: 2400, cx: 1200, cy: 1200, rx: 1030, ry: 980 };
  const RUN_END = 15 * 60;
  const MAX_ENEMIES = 360;
  const MAX_PARTICLES = 260;
  const MAX_ORBS = 150;
  const SAVE_PREFIX = 'repo_sports_quidditch_survivor_v1_';
  const arenaImage = new Image();
  arenaImage.src = 'assets/repo-sports-quidditch-ground.png';

  const ENEMY_DATA = {
    chaser: { name:'Chaser', hp:34, speed:75, damage:9, r:16, xp:2, color:'#9d4539' },
    seeker: { name:'Seeker', hp:23, speed:118, damage:7, r:12, xp:2, color:'#d0a640' },
    beater: { name:'Beater', hp:105, speed:48, damage:16, r:23, xp:5, color:'#56344d' },
    ranged: { name:'Ranged Chaser', hp:46, speed:58, damage:9, r:16, xp:4, color:'#466783' },
    swarmer: { name:'Swarmer', hp:14, speed:88, damage:5, r:9, xp:1, color:'#775f3a' },
    interceptor: { name:'Interceptor', hp:58, speed:82, damage:11, r:17, xp:4, color:'#4e7653' },
    shield: { name:'Keeper Guard', hp:92, speed:54, damage:11, r:20, xp:5, color:'#667183' }
  };
  const BOSS_DATA = [
    { name:'IRON KEEPER', color:'#a0763c', hp:2900, speed:54, damage:24 },
    { name:'BLUDGER CAPTAIN', color:'#85434b', hp:5200, speed:66, damage:28 },
    { name:'REPO ALL-STAR', color:'#b9923f', hp:8800, speed:74, damage:34 }
  ];

  const RARITY = {
    standard:{label:'STANDARD',weight:100,className:'standard'},
    full_art:{label:'FULL ART',weight:45,className:'full-art'},
    platinum:{label:'PLATINUM',weight:25,className:'platinum'},
    legendary:{label:'GOLD LEGENDARY',weight:9,className:'legendary'},
    millennium:{label:'MILLENNIUM',weight:3,className:'millennium'},
    signature:{label:'SIGNATURE',weight:8,className:'signature'},
    rival:{label:'RIVAL',weight:12,className:'rival'},
    limited:{label:'LIMITED',weight:2,className:'limited'}
  };

  const els = {};
  let ctx = null;
  let state = null;
  let raf = 0;
  let listenersBound = false;
  let audioCtx = null;
  let crowdNode = null;
  let music = null;
  let bannerTimer = 0;
  let tutorialTimer = 0;
  let collectionPromise = null;
  let ownedCards = [];
  let profile = null;
  let preferredWeapon = 'broomstick';
  let visible = false;
  const keys = new Set();

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
    els.broomMode=document.getElementById('qsBroomMode');
    els.manaText=document.getElementById('qsManaText');
    els.flightDots=document.getElementById('qsFlightDots');
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
      ensureAudio(); if(!audioCtx)return;
      const t=audioCtx.currentTime,o=audioCtx.createOscillator(),g=audioCtx.createGain();
      o.type=type;o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(Math.max(30,freq*slide),t+d);
      g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+.008);g.gain.exponentialRampToValueAtTime(.0001,t+d);
      o.connect(g);g.connect(audioCtx.destination);o.start(t);o.stop(t+d+.02);
    }catch(_){ }
  }
  function sfx(kind){
    if(kind==='hit')tone(150,.045,.022,'square',.72);
    else if(kind==='level'){tone(520,.16,.045,'triangle',1.35);setTimeout(()=>tone(780,.18,.035,'triangle',1.22),70);}
    else if(kind==='goal'){tone(210,.18,.05,'sawtooth',1.8);setTimeout(()=>tone(620,.22,.04,'triangle',1.25),80);}
    else if(kind==='flight')tone(240,.28,.055,'sawtooth',2.2);
    else if(kind==='snitch'){tone(980,.25,.045,'sine',1.4);setTimeout(()=>tone(1320,.2,.035,'sine',1.2),90);}
    else if(kind==='rare'){tone(700,.28,.04,'triangle',1.45);setTimeout(()=>tone(1120,.3,.035,'sine',1.18),100);}
    else if(kind==='hurt')tone(110,.12,.045,'square',.55);
  }
  function startMusic(){ ensureAudio(); music?.play().catch(()=>{}); }
  function stopMusic(){ if(music){ music.pause(); music.currentTime=0; } }
  function updateMusic(){ if(!music||!state)return; const intensity=clamp(state.elapsed/RUN_END + state.enemies.length/300,0,1); music.volume=.12+intensity*.14; music.playbackRate=.96+intensity*.08; }

  function loadProfile(){
    const key=SAVE_PREFIX+username().toLowerCase();
    try{ profile=JSON.parse(localStorage.getItem(key)||'{}')||{}; }catch(_){ profile={}; }
    profile.bestScore=Number(profile.bestScore)||0; profile.bestTime=Number(profile.bestTime)||0; profile.runs=Number(profile.runs)||0; profile.synergies=Array.isArray(profile.synergies)?profile.synergies:[];
    return profile;
  }
  function saveProfile(){
    if(!profile)return;
    try{localStorage.setItem(SAVE_PREFIX+username().toLowerCase(),JSON.stringify(profile));}catch(_){ }
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
      ownedCards=ids.map(id=>window.repoTcgCardById?.(id)).filter(card=>card&&card.id&&!seen.has(card.id)&&seen.add(card.id));
      if(els.binderStatus)els.binderStatus.textContent=ownedCards.length?`${ownedCards.length} owned TCG cards available as run upgrades.`:'Binder not loaded or empty — normal upgrades remain fully playable.';
      return ownedCards;
    })();
    return collectionPromise;
  }

  function cardRarity(card){ return RARITY[card?.rarity] || RARITY.standard; }
  function isSpecialOneShot(card){ return ['millennium','legendary','limited','rival','full_art'].includes(card?.rarity); }
  function characterTag(card){
    const n=(card?.name||'').toLowerCase();
    return ['besquelcher','rocky','debbie','soup','jud','mod ash','nimbler','barry','berry bramble'].find(x=>n.includes(x))||'';
  }
  function cardDescription(card,rank=1){
    const n=(card?.name||'').toLowerCase(), r=rank;
    if(n.includes('besquelcher')&&card.rarity==='millennium')return 'Kills build SCORE. At 50 SCORE, unleash an arena-wide scoring strike.';
    if(n.includes('rocky')&&card.rarity==='millennium')return 'Avoiding damage builds offence and defence. Taking damage only partially resets it.';
    if(n.includes('debbie')&&card.rarity==='millennium')return 'Hot Streak can become MOLE LEAGUE FRENZY. Rapid kills extend it, with a hard cap.';
    if(n.includes('mod ash')&&card.rarity==='millennium')return 'Elite kills steal their modifier as a temporary player buff.';
    if(n.includes('soup')&&card.rarity==='millennium')return 'Create a huge Calm Zone that heavily slows enemies and stabilises your defence.';
    if(n.includes('signature')&&n.includes('debbie'))return 'Debbie Hot Streak becomes stronger and extends slightly from rapid kills.';
    if(n.includes('signature')&&n.includes('nimbler'))return 'Momentum builds faster. Maximum Momentum empowers movement and Broom flight attacks.';
    if(n.includes('besquelcher'))return `KING BSQ: +${25+5*(r-1)}% damage, slightly lower defence. Every 50 kills triggers GOAL EXPLOSION.`;
    if(n.includes('rocky'))return 'ROCK SOLID: avoid damage to build damage, knockback and armour. Taking damage resets the streak.';
    if(n.includes('debbie'))return `MOLE LEAGUE MOMENTUM: kills can trigger a ${5+r}s Hot Streak with much faster attacks.`;
    if(n.includes('soup'))return 'TURTLE TIME: slightly slower movement, more armour, and a periodic slowing aura.';
    if(n.includes('jud'))return 'THE WALL: periodically block one contact hit and release a huge knockback shockwave.';
    if(n.includes('mod ash')||n.includes('mash and grab'))return 'MASH AND GRAB: elite kills vacuum nearby XP and can create extra XP.';
    if(n.includes('nimbler')||n.includes('boomstick'))return 'Continuous movement builds MOMENTUM. At maximum, attacks can explode.';
    if(n.includes('off the post'))return 'Projectiles can ricochet back after reaching maximum range and damage enemies again.';
    if(n.includes('wrong hoop'))return 'Occasionally launches a dangerous reverse attack. If it connects, it deals massive bonus damage.';
    if(n.includes('lost notes'))return 'Periodically scatter nearby XP, then snap it all back with a temporary XP bonus.';
    if(n.includes('tea break'))return 'Stand still briefly to regenerate health and Broom Mana rapidly. Moving cancels it.';
    if(n.includes('the stare'))return 'Staying near an elite without taking damage gradually strips its armour.';
    if(n.includes('pack luck'))return 'Level-ups can offer a fourth choice, and extremely rarely a fifth.';
    if(n.includes('binder flex'))return 'Gain a small flexible bonus for every different TCG rarity in your current build.';
    if(n.includes('swiped'))return 'Elite kills steal a temporary stat buff: speed, attack speed, damage or armour.';
    if(n.includes('changing room champions')||n.includes('team photo'))return 'Each different character card in your build strengthens the whole team bonus.';
    if(n==='var'||n.startsWith('var ')||n.includes('match review'))return 'VAR REVIEW: cancel lethal damage once, restore a little HP, then enter a very long cooldown.';
    if(n.includes('keepers dream'))return 'Periodically summon a defensive rotating formation that blocks and damages nearby threats.';
    if(n.includes('snitch'))return 'Golden Snitches appear more often and their reward is improved.';
    if(n.includes('broom')||n.includes('whisper')||n.includes('frostbound')||n.includes('cinder')||n.includes('amethyst')||n.includes('starweave')||n.includes('gravemark')||n.includes('moonlit'))return 'Broomcraft: improves a different part of Broomstick spin, Magic Mode or flight based on this card.';
    if(n.includes('arena')||n.includes('grounds')||n.includes('stadium')||n.includes('flightground')||n.includes('skycourt')||n.includes('pitch'))return 'Arena card: subtly alters wave pressure and boosts a matching run reward without cluttering the pitch.';
    if(card.rarity==='rival')return 'RIVAL: gain a large situational bonus while enemy pressure also rises. High risk, high reward.';
    if(card.rarity==='platinum')return 'PLATINUM: build-defining team effect that improves synergy strength instead of only raw damage.';
    if(card.rarity==='legendary')return 'GOLD LEGENDARY: transform one existing run strength into a much stronger special effect.';
    if(card.rarity==='signature')return 'SIGNATURE: enhance the matching character identity and its triggered effect.';
    if(card.rarity==='full_art')return 'FULL ART: specialised effect derived from the scene on the card; stronger when its theme is already in the build.';
    return 'Flexible TCG effect: adapts to this card’s theme and rarity, shaping the current build without becoming a flat stat dump.';
  }

  function applyCard(card){
    const cards=state.tcg.cards;
    const existing=cards.get(card.id);
    const max=isSpecialOneShot(card)?1:3;
    const rank=Math.min(max,(existing?.rank||0)+1);
    cards.set(card.id,{card,rank});
    const n=(card.name||'').toLowerCase();
    const rarity=card.rarity||'standard';
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
    return {type:'card',id:'card:'+card.id,name:card.name,rarity:card.rarity||'standard',image:card.image,desc:cardDescription(card,rank),footer:`RUN RANK ${rank}${isSpecialOneShot(card)?' · ONE-TIME':''}`,apply:()=>applyCard(card)};
  }
  function passiveOption(def){ return {type:'upgrade',id:def.id,name:def.name,icon:def.icon,rarity:def.rare?'rare':'upgrade',desc:def.desc,footer:state.passives.has(def.id)?'IMPROVE EXISTING':'NEW PASSIVE',apply:()=>{def.apply();state.passives.add(def.id);}}; }
  function weightedCard(){
    const eligible=ownedCards.filter(card=>{
      const current=state.tcg.cards.get(card.id)?.rank||0;
      if(state.tcg.cards.size>=5 && !state.tcg.cards.has(card.id)) return false;
      return current < (isSpecialOneShot(card)?1:3);
    });
    if(!eligible.length)return null;
    let sum=0;const weighted=eligible.map(card=>{let w=cardRarity(card).weight; if(state.tcg.cards.has(card.id))w*=1.18; sum+=w; return [card,sum];});
    const roll=Math.random()*sum;return weighted.find(([,x])=>roll<=x)?.[0]||eligible[0];
  }
  function generateChoices(forceCard=false){
    let count=3;
    if(state.flags.packLuck){if(Math.random()<.15+state.flags.packLuck*.04)count=4;if(Math.random()<.015*state.flags.packLuck)count=5;}
    count=Math.min(5,count);
    const out=[],used=new Set();
    const allPassives=[...passiveUpgrades,...(state.weapon==='broomstick'?broomUpgrades:[])].filter(x=>!x.condition||x.condition());
    const wantCard=forceCard || (state.level>=3 && ownedCards.length && Math.random()<.44);
    if(wantCard){const c=weightedCard();if(c){out.push(cardOption(c));used.add('card:'+c.id);}}
    while(out.length<count){
      const tryCard=state.level>=3&&ownedCards.length&&Math.random()<.32&&state.tcg.cards.size<5;
      if(tryCard){const c=weightedCard();if(c&&!used.has('card:'+c.id)){out.push(cardOption(c));used.add('card:'+c.id);continue;}}
      const def=choice(allPassives);if(!def)break;
      if(used.has(def.id)&&allPassives.length>out.length)continue;
      out.push(passiveOption(def));used.add(def.id);
    }
    return out;
  }

  function renderChoices(options){
    els.choiceGrid.innerHTML='';
    els.choiceGrid.classList.toggle('four',options.length>3);
    options.forEach((opt,index)=>{
      const b=document.createElement('button');b.type='button';b.className=`qs-choice ${safeText(opt.rarity||'')}`;
      b.innerHTML=`<div class="qs-choice-art">${opt.image?`<img src="${safeText(opt.image)}" alt="">`:`<span class="qs-icon">${safeText(opt.icon||'◆')}</span>`}</div><div class="qs-choice-body"><span class="qs-choice-rarity">${safeText((RARITY[opt.rarity]?.label||String(opt.rarity||'UPGRADE').toUpperCase()))}</span><h3>${safeText(opt.name)}</h3><p>${safeText(opt.desc)}</p><footer><span>${safeText(opt.footer||'')}</span><span>${index+1}</span></footer></div>`;
      b.addEventListener('click',()=>chooseUpgrade(opt));els.choiceGrid.appendChild(b);
    });
  }
  function showLevelUp(forceCard=false){
    if(!state||state.ended)return;
    state.paused=true;state.pendingUpgrade=true;renderChoices(generateChoices(forceCard));els.levelup.hidden=false;sfx('level');
  }
  function chooseUpgrade(opt){
    if(!state?.pendingUpgrade)return;
    opt.apply();state.pendingUpgrade=false;els.levelup.hidden=true;state.paused=false;
    showBanner(opt.type==='card'?'TCG CARD EQUIPPED':'UPGRADE LOCKED IN',opt.name);
    updateHud();
  }

  function showBanner(title,sub=''){
    clearTimeout(bannerTimer);els.banner.innerHTML=`${safeText(title)}${sub?`<small>${safeText(sub)}</small>`:''}`;els.banner.classList.add('show');bannerTimer=setTimeout(()=>els.banner.classList.remove('show'),1900);
  }
  function tutorial(text,duration=2600){
    if(profile?.tutorialDone)return;
    clearTimeout(tutorialTimer);els.tutorial.textContent=text;els.tutorial.classList.add('show');tutorialTimer=setTimeout(()=>els.tutorial.classList.remove('show'),duration);
  }

  function resetState(weapon){
    const canvas=els.canvas;
    state={
      weapon, running:true, paused:false, ended:false, won:false, pendingUpgrade:false,
      elapsed:0,lastTs:0,score:0,level:1,xp:0,nextXp:12,kills:0,
      player:{x:WORLD.cx,y:WORLD.cy,r:16,hp:120,maxHp:120,vx:0,vy:0,lastHit:-10,stationary:0},
      camera:{x:WORLD.cx,y:WORLD.cy,zoom:1},
      enemies:[],enemyPool:[],projectiles:[],enemyProjectiles:[],orbs:[],particles:[],trails:[],telegraphs:[],
      passives:new Set(),
      mods:{damage:1,cooldown:1,area:1,armour:0,magnet:95,speed:1,crit:.05,projectiles:0,knockback:1,attackSpeed:1,synergy:1,specialPower:1,triggerPower:1,xp:1},
      broom:{level:1,mode:'melee',mana:100,maxMana:100,manaRegen:10,magicCost:10,magicProjectiles:1,magicPierce:1,spinDamage:22,spinRadius:82,rotations:2,attackInterval:1.5,lastAttack:-10,spin:null,attackId:0,lastSwitch:-10,charges:1,maxCharges:1,recharge:0,flightRecharge:8,flightDistance:1,flightSteer:.25,flight:null,flightDamage:60,flightTrail:false,finalKnockback:1,spinMoveBonus:1,windShockwave:false,evolved:false},
      combat:{lastAttack:-10,attackInterval:weapon==='sword'?1.1:weapon==='bow'?.72:weapon==='staff'?1.05:1.5,projectileDamage:weapon==='bow'?24:weapon==='staff'?28:22},
      director:{spawnClock:.4,pressure:1,eventClock:42,snitchClock:75,bossStage:0,finalBossDefeated:false},
      event:null,snitch:null,boss:null,
      flags:{rockyStreak:0,hotStreak:0,hotStreakKills:0,moveMomentum:0,judReadyAt:0,varReadyAt:0,teaActive:false,lostNotesClock:12,keeperClock:8},
      tcg:{cards:new Map(),rarities:new Set(),characters:new Set(),synergies:new Set()},
      stats:{damage:0,damageTaken:0,highestHit:0,xp:0,elites:0,bosses:0,snitches:0,cardsPicked:0,synergies:0,flights:0,distance:0},
      forceCard:false
    };
    state.tcg.cardsHasName=(name)=>[...state.tcg.cards.values()].some(x=>(x.card?.name||'').toLowerCase().includes(name));
    if(weapon==='broomstick'){els.broomHud.hidden=false;els.manaBar.hidden=false;}else{els.broomHud.hidden=true;els.manaBar.hidden=true;}
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
  function enemyPressure(){return 1+state.elapsed/150+Math.pow(state.elapsed/420,1.4)*.7;}
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
  function spawnEnemy(type=pickEnemyType(),elite=false){
    if(state.enemies.length>=MAX_ENEMIES)return;
    const base=ENEMY_DATA[type],p=spawnAtEdge(),pressure=enemyPressure()*state.director.pressure;
    const e=state.enemyPool.pop()||{};
    Object.assign(e,{type,x:p.x,y:p.y,r:base.r,hp:base.hp*(1+state.elapsed/360)* (elite?3.4:1),maxHp:0,speed:base.speed*(1+Math.min(.65,state.elapsed/1000)),damage:base.damage*(1+state.elapsed/650),xp:base.xp,color:base.color,elite,modifier:null,shoot:rand(.2,1.2),flash:0,slow:0,armour:type==='shield'?3:0,dead:false,broomAttackId:-1,broomRotation:-1});
    if(elite){e.r*=1.28;e.modifier=choice(['swift','armoured','regenerating','explosive','magnetic','splitter']);if(e.modifier==='swift')e.speed*=1.35;if(e.modifier==='armoured')e.armour+=5;}
    e.maxHp=e.hp;state.enemies.push(e);
  }
  function spawnBoss(stage){
    const b=BOSS_DATA[stage-1];if(!b)return;
    const p=spawnAtEdge();state.boss={stage,name:b.name,x:p.x,y:p.y,r:48,hp:b.hp,maxHp:b.hp,speed:b.speed,damage:b.damage,color:b.color,attackClock:2.8,charge:null,telegraph:0,summonClock:7};
    showBanner('BOSS ENTERING',b.name);sfx('goal');
  }

  function damageEnemy(e,amount,knock=0,sourceX=state.player.x,sourceY=state.player.y){
    if(!e||e.dead)return 0;
    if(e.type==='shield'){
      const incoming=Math.atan2(sourceY-e.y,sourceX-e.x),toward=Math.atan2(state.player.y-e.y,state.player.x-e.x);
      let diff=Math.abs(Math.atan2(Math.sin(incoming-toward),Math.cos(incoming-toward)));
      if(diff<1.0)amount*=.35;
    }
    amount=Math.max(1,amount-(e.armour||0));
    const crit=Math.random()<state.mods.crit; if(crit)amount*=1.75;
    e.hp-=amount;e.flash=.08;state.stats.damage+=amount;state.stats.highestHit=Math.max(state.stats.highestHit,amount);
    if(knock){const dx=e.x-sourceX,dy=e.y-sourceY,d=Math.hypot(dx,dy)||1;e.x+=dx/d*knock*state.mods.knockback;e.y+=dy/d*knock*state.mods.knockback;}
    if(state.particles.length<MAX_PARTICLES)state.particles.push({x:e.x,y:e.y,text:`${crit?'✦ ':''}${Math.round(amount)}`,life:.55,color:crit?'#ffe36c':'#f1d9a0',size:crit?17:12});
    if(Math.random()<.16)sfx('hit');
    if(e.hp<=0)killEnemy(e);
    return amount;
  }
  function damageBoss(amount,sourceX=state.player.x,sourceY=state.player.y){
    const b=state.boss;if(!b)return;
    const crit=Math.random()<state.mods.crit;if(crit)amount*=1.7;b.hp-=amount;state.stats.damage+=amount;state.stats.highestHit=Math.max(state.stats.highestHit,amount);
    if(state.particles.length<MAX_PARTICLES)state.particles.push({x:b.x,y:b.y-30,text:`${crit?'CRIT ':''}${Math.round(amount)}`,life:.5,color:'#ffe186',size:crit?19:14});
    if(b.hp<=0){state.stats.bosses++;state.score+=2500*b.stage;showBanner('BOSS DOWN',b.name);state.boss=null;sfx('goal');if(state.director.bossStage>=3)state.director.finalBossDefeated=true;}
  }
  function areaDamage(x,y,r,damage,knock=0){
    for(const e of [...state.enemies])if(Math.hypot(e.x-x,e.y-y)<=r+e.r)damageEnemy(e,damage,knock,x,y);
    if(state.boss&&Math.hypot(state.boss.x-x,state.boss.y-y)<=r+state.boss.r)damageBoss(damage,x,y);
  }
  function killEnemy(e){
    if(e.dead)return;e.dead=true;state.kills++;state.score+=10+(e.elite?150:0);if(e.elite)state.stats.elites++;
    if(state.flags.bsq&&state.kills%50===0){areaDamage(state.player.x,state.player.y,220*state.mods.area,90*state.flags.bsq*state.mods.specialPower,80);showBanner('GOAL EXPLOSION','KING BSQ · 50 KILLS');sfx('goal');}
    if(state.flags.millenniumBsq){state.flags.millenniumScore=(state.flags.millenniumScore||0)+1;if(state.flags.millenniumScore>=35){state.flags.millenniumScore=0;areaDamage(state.player.x,state.player.y,900,165*state.mods.specialPower,120);showBanner('MILLENNIUM SCORE','BESQUELCHER · ARENA-WIDE STRIKE');sfx('goal');}}
    if(state.flags.debbie&&Math.random()<.035*state.flags.debbie){state.flags.hotStreak=6+(state.flags.signatureDebbie?2:0)+(state.flags.millenniumDebbie?2:0);state.flags.hotStreakKills=0;showBanner(state.flags.millenniumDebbie?'MOLE LEAGUE FRENZY':'HOT STREAK','DEBBIE · MOLE LEAGUE MOMENTUM');}
    if(state.flags.signatureDebbie&&state.flags.hotStreak>0){state.flags.hotStreakKills=(state.flags.hotStreakKills||0)+1;if(state.flags.hotStreakKills%6===0)state.flags.hotStreak=Math.min(state.flags.millenniumDebbie?12:9,state.flags.hotStreak+.65);}
    if(state.flags.modAsh&&e.elite){magnetAllXp();if(Math.random()<.3)dropXp(e.x,e.y,e.xp*4);if(state.flags.millenniumAsh){state.flags.stolenBuff={kind:e.modifier==='armoured'?'armour':e.modifier==='swift'?'speed':choice(['attack','damage','armour']),time:12};showBanner('MILLENNIUM MASH',`Stole ${String(e.modifier||'elite').toUpperCase()}`);}}
    if(state.flags.swiped&&e.elite){state.flags.stolenBuff={kind:choice(['speed','attack','damage','armour']),time:8};showBanner('SWIPED!','Elite modifier stolen for 8 seconds');}
    if(e.modifier==='explosive')areaDamage(e.x,e.y,70,18,45);
    if(e.modifier==='splitter'&&state.enemies.length<MAX_ENEMIES-2){spawnEnemy('swarmer');spawnEnemy('swarmer');}
    dropXp(e.x,e.y,e.xp*(state.event?.type==='double-xp'?2:1));
    if(Math.random()<.012)state.orbs.push({x:e.x+8,y:e.y-8,value:0,heal:12,r:7,taken:false});
    if(state.particles.length<MAX_PARTICLES)for(let i=0;i<4;i++)state.particles.push({x:e.x,y:e.y,vx:rand(-70,70),vy:rand(-70,70),life:.35,color:e.color,size:4});
    const i=state.enemies.indexOf(e);if(i>=0)state.enemies.splice(i,1);state.enemyPool.push(e);
  }
  function dropXp(x,y,value){
    if(state.orbs.length>=MAX_ORBS){let nearest=null,nd=90;for(const o of state.orbs){if(o.heal)continue;const d=Math.hypot(o.x-x,o.y-y);if(d<nd){nd=d;nearest=o;}}if(nearest){nearest.value+=value;nearest.r=Math.min(12,(nearest.r||5)+.4);return;}let smallest=state.orbs.find(o=>!o.heal);if(smallest){smallest.value+=value;return;}}
    state.orbs.push({x,y,value,r:value>=12?9:value>=5?7:5,taken:false});
  }
  function magnetAllXp(){for(const o of state.orbs)if(!o.heal)o.magnet=true;}

  function hurtPlayer(amount,kind='contact'){
    const p=state.player,now=state.elapsed;
    if(kind==='contact'&&state.broom.flight)return;
    if(kind==='contact'&&now-p.lastHit<.28)return;
    if(state.flags.jud&&now>=state.flags.judReadyAt&&kind==='contact'){
      state.flags.judReadyAt=now+Math.max(7,12-state.flags.jud*1.2);areaDamage(p.x,p.y,180,20+8*state.flags.jud,95);showBanner('THE WALL','JUD BLOCKED THE HIT');return;
    }
    if(p.hp-amount<=0&&state.flags.varReview&&now>=state.flags.varReadyAt){state.flags.varReadyAt=now+150;p.hp=Math.max(18,p.maxHp*.18);showBanner('VAR REVIEW','LETHAL HIT OVERTURNED');sfx('goal');return;}
    const final=Math.max(1,amount-state.mods.armour);p.hp-=final;p.lastHit=now;state.stats.damageTaken+=final;state.flags.rockyStreak=0;sfx('hurt');
    if(p.hp<=0)finishRun(false);
  }

  function spawnProjectile(kind,x,y,vx,vy,damage,life=2,pierce=0){state.projectiles.push({kind,x,y,vx,vy,damage,life,pierce,hit:new Set(),returning:false});}
  function nearestEnemies(n=1,range=700){return [...state.enemies].sort((a,b)=>dist(state.player,a)-dist(state.player,b)).filter(e=>dist(state.player,e)<range).slice(0,n);}
  function normalAttack(dt){
    const s=state,p=s.player,interval=s.combat.attackInterval*s.mods.cooldown/s.mods.attackSpeed;
    if(s.elapsed-s.combat.lastAttack<interval)return;
    const targets=nearestEnemies(1,720);if(!targets.length&&!s.boss)return;s.combat.lastAttack=s.elapsed;
    if(s.weapon==='sword'){
      areaDamage(p.x,p.y,100*s.mods.area,36*s.mods.damage,48);s.trails.push({type:'slash',x:p.x,y:p.y,r:100*s.mods.area,life:.18});
    }else if(s.weapon==='bow'){
      const all=nearestEnemies(1+s.mods.projectiles,760);for(const e of all){const a=Math.atan2(e.y-p.y,e.x-p.x);spawnProjectile('arrow',p.x,p.y,Math.cos(a)*620,Math.sin(a)*620,25*s.mods.damage,1.5,0);}
    }else if(s.weapon==='staff'){
      let current=s.boss||targets[0],from={x:p.x,y:p.y};const hit=[];for(let i=0;i<3+s.mods.projectiles&&current;i++){if(current===s.boss)damageBoss(27*s.mods.damage*(1-i*.13));else damageEnemy(current,27*s.mods.damage*(1-i*.13),10,from.x,from.y);s.trails.push({type:'chain',x1:from.x,y1:from.y,x2:current.x,y2:current.y,life:.18});hit.push(current);from=current;current=s.enemies.filter(e=>!hit.includes(e)&&Math.hypot(e.x-from.x,e.y-from.y)<180).sort((a,b)=>Math.hypot(a.x-from.x,a.y-from.y)-Math.hypot(b.x-from.x,b.y-from.y))[0];}
    }
    if(s.flags.wrongHoop&&Math.random()<.10){const a=Math.atan2(p.vy,p.vx)+Math.PI;spawnProjectile('wrong',p.x,p.y,Math.cos(a)*540,Math.sin(a)*540,75*s.mods.damage,1.1,2);}
  }

  function startBroomSpin(landing=false){
    const b=state.broom;b.attackId++;b.spin={elapsed:0,duration:landing?.42:.62,rotations:landing?2:b.rotations,id:b.attackId,landing,lastRot:-1};b.lastAttack=state.elapsed;
  }
  function broomAttack(dt){
    const b=state.broom,p=state.player;
    if(b.mode==='magic'){
      if(state.elapsed-b.lastAttack>=.85*state.mods.cooldown/state.mods.attackSpeed){
        if(b.mana<b.magicCost){b.mode='melee';showBanner('MANA EMPTY','Returning to MELEE');}
        else{
          b.mana-=b.magicCost;b.lastAttack=state.elapsed;const targets=nearestEnemies(b.magicProjectiles,850);for(let i=0;i<Math.max(1,b.magicProjectiles);i++){const t=targets[i]||state.boss;if(!t)break;const a=Math.atan2(t.y-p.y,t.x-p.x)+rand(-.04,.04);spawnProjectile('wind',p.x,p.y,Math.cos(a)*700,Math.sin(a)*700,24*state.mods.damage,1.5,b.magicPierce);}
        }
      }
    }else{
      b.mana=Math.min(b.maxMana,b.mana+b.manaRegen*dt);
      if(!b.spin&&state.elapsed-b.lastAttack>=b.attackInterval*state.mods.cooldown/state.mods.attackSpeed)startBroomSpin(false);
    }
    if(b.spin){
      b.spin.elapsed+=dt;const progress=clamp(b.spin.elapsed/b.spin.duration,0,1),rot=Math.min(b.spin.rotations-1,Math.floor(progress*b.spin.rotations));
      if(rot!==b.spin.lastRot){b.spin.lastRot=rot;const final=rot===b.spin.rotations-1;let damage=b.spinDamage*state.mods.damage*(b.spin.landing?1.7:1);if(state.flags.hotStreak>0)damage*=1.18;areaDamage(p.x,p.y,b.spinRadius*state.mods.area*(b.spin.landing?1.12:1),damage,final?45*b.finalKnockback:14);if(final&&b.windShockwave)areaDamage(p.x,p.y,b.spinRadius*1.7*state.mods.area,damage*.55,55);if(b.evolved&&final){state.trails.push({type:'vortex',x:p.x,y:p.y,r:b.spinRadius*1.6,life:1.7,damage:damage*.20,tick:0});}}
      if(b.spin.elapsed>=b.spin.duration)b.spin=null;
    }
  }
  function toggleBroomMode(){
    if(!state||state.weapon!=='broomstick'||state.paused||state.ended)return;const b=state.broom;if(state.elapsed-b.lastSwitch<.4)return;b.lastSwitch=state.elapsed;
    if(b.mode==='melee'&&b.mana>=b.magicCost){b.mode='magic';showBanner('MAGIC MODE','Wind Lances consume Mana');}else{b.mode='melee';showBanner('MELEE MODE','Rapid 360° broom spins');}updateHud();
  }
  function startFlight(){
    if(!state||state.weapon!=='broomstick'||state.paused||state.ended)return;const b=state.broom,p=state.player;if(b.flight||b.charges<=0)return;
    let dx=0,dy=0;if(keys.has('a')||keys.has('ArrowLeft'))dx--;if(keys.has('d')||keys.has('ArrowRight'))dx++;if(keys.has('w')||keys.has('ArrowUp'))dy--;if(keys.has('s')||keys.has('ArrowDown'))dy++;
    if(!dx&&!dy){dx=p.vx;dy=p.vy;}let l=Math.hypot(dx,dy)||1;dx/=l;dy/=l;
    b.charges--;b.flight={time:0,duration:.58,dx,dy,hit:new Set()};b.recharge=b.flightRecharge;state.stats.flights++;sfx('flight');
  }
  function updateFlight(dt){
    const b=state.broom,p=state.player;
    if(!b.flight){if(b.charges<b.maxCharges){b.recharge-=dt;if(b.recharge<=0){b.charges++;b.recharge=b.flightRecharge;}}return;}
    const f=b.flight;f.time+=dt;let sx=0,sy=0;if(keys.has('a')||keys.has('ArrowLeft'))sx--;if(keys.has('d')||keys.has('ArrowRight'))sx++;if(keys.has('w')||keys.has('ArrowUp'))sy--;if(keys.has('s')||keys.has('ArrowDown'))sy++;if(sx||sy){const l=Math.hypot(sx,sy);f.dx=lerp(f.dx,sx/l,b.flightSteer*.12);f.dy=lerp(f.dy,sy/l,b.flightSteer*.12);const fl=Math.hypot(f.dx,f.dy)||1;f.dx/=fl;f.dy/=fl;}
    const speed=840*b.flightDistance;p.x+=f.dx*speed*dt;p.y+=f.dy*speed*dt;constrainToArena(p);
    for(const e of state.enemies){if(!f.hit.has(e)&&Math.hypot(e.x-p.x,e.y-p.y)<p.r+e.r+16){f.hit.add(e);damageEnemy(e,b.flightDamage*state.mods.damage,85,p.x-f.dx*30,p.y-f.dy*30);}}
    if(state.boss&&Math.hypot(state.boss.x-p.x,state.boss.y-p.y)<p.r+state.boss.r+14)damageBoss(b.flightDamage*.65*state.mods.damage);
    if(b.flightTrail&&state.trails.length<100)state.trails.push({type:'wind',x:p.x,y:p.y,r:28,life:.65,damage:9*state.mods.damage,tick:0});
    if(f.time>=f.duration){b.flight=null;startBroomSpin(true);if(b.evolved)areaDamage(p.x,p.y,150*state.mods.area,65*state.mods.damage,80);}
  }

  function updateProjectiles(dt){
    for(const pr of state.projectiles){pr.life-=dt;pr.x+=pr.vx*dt;pr.y+=pr.vy*dt;
      for(const e of state.enemies){if(pr.hit.has(e))continue;if(Math.hypot(e.x-pr.x,e.y-pr.y)<e.r+7){pr.hit.add(e);damageEnemy(e,pr.damage,pr.kind==='wind'?14:6,pr.x-pr.vx*.02,pr.y-pr.vy*.02);if(pr.pierce>0)pr.pierce--;else pr.life=0;}}
      if(state.boss&&Math.hypot(state.boss.x-pr.x,state.boss.y-pr.y)<state.boss.r+8){damageBoss(pr.damage,pr.x-pr.vx*.02,pr.y-pr.vy*.02);pr.life=0;}
      if(pr.life<=0&&state.flags.offPost&&!pr.returning&&Math.random()<.18*state.flags.offPost){pr.returning=true;pr.life=.75;pr.vx*=-1;pr.vy*=-1;pr.hit.clear();pr.damage*=.75;}
    }
    state.projectiles=state.projectiles.filter(p=>p.life>0);
    for(const pr of state.enemyProjectiles){pr.life-=dt;pr.x+=pr.vx*dt;pr.y+=pr.vy*dt;if(Math.hypot(pr.x-state.player.x,pr.y-state.player.y)<state.player.r+7){hurtPlayer(pr.damage,'projectile');pr.life=0;}}
    state.enemyProjectiles=state.enemyProjectiles.filter(p=>p.life>0);
  }

  function updateEnemies(dt){
    const p=state.player;
    for(const e of [...state.enemies]){
      if(e.flash>0)e.flash-=dt;if(e.slow>0)e.slow-=dt;if(e.modifier==='regenerating')e.hp=Math.min(e.maxHp,e.hp+e.maxHp*.008*dt);
      let tx=p.x,ty=p.y;
      if(e.type==='interceptor'){tx+=p.vx*.55;ty+=p.vy*.55;}
      let dx=tx-e.x,dy=ty-e.y,d=Math.hypot(dx,dy)||1;
      if(e.type==='ranged'){
        if(d<210){dx*=-1;dy*=-1;}else if(d<310){dx=0;dy=0;}
        e.shoot-=dt;if(e.shoot<=0&&d<500){e.shoot=1.8;const a=Math.atan2(p.y-e.y,p.x-e.x);state.enemyProjectiles.push({x:e.x,y:e.y,vx:Math.cos(a)*280,vy:Math.sin(a)*280,life:2.2,damage:e.damage});}
      }
      const slow=e.slow>0?.5:1;e.x+=dx/d*e.speed*slow*dt;e.y+=dy/d*e.speed*slow*dt;constrainToArena(e);
      if(Math.hypot(e.x-p.x,e.y-p.y)<e.r+p.r+2)hurtPlayer(e.damage,'contact');
      if(state.flags.soup&&Math.hypot(e.x-p.x,e.y-p.y)<(state.flags.millenniumSoup?260:150)*state.mods.area)e.slow=Math.max(e.slow,state.flags.millenniumSoup?.55:.25);
      if(state.flags.stare&&e.elite&&Math.hypot(e.x-p.x,e.y-p.y)<130&&state.elapsed-p.lastHit>2)e.armour=Math.max(0,e.armour-dt*.7*state.flags.stare);
    }
  }

  function updateBoss(dt){
    const b=state.boss;if(!b)return;const p=state.player;let dx=p.x-b.x,dy=p.y-b.y,d=Math.hypot(dx,dy)||1;
    b.attackClock-=dt;b.summonClock-=dt;
    if(b.charge){b.charge.time-=dt;b.x+=b.charge.dx*420*dt;b.y+=b.charge.dy*420*dt;constrainToArena(b);if(Math.hypot(b.x-p.x,b.y-p.y)<b.r+p.r+6)hurtPlayer(b.damage*1.25,'boss');if(b.charge.time<=0)b.charge=null;}
    else{b.x+=dx/d*b.speed*dt;b.y+=dy/d*b.speed*dt;if(d<b.r+p.r+5)hurtPlayer(b.damage,'boss');}
    if(b.attackClock<=0&&!b.charge){b.attackClock=rand(3.3,4.6);const a=Math.atan2(p.y-b.y,p.x-b.x);b.charge={time:.62,dx:Math.cos(a),dy:Math.sin(a)};showBanner('DODGE','Boss charge incoming');for(let i=0;i<8;i++){const q=i*Math.PI/4;state.enemyProjectiles.push({x:b.x,y:b.y,vx:Math.cos(q)*210,vy:Math.sin(q)*210,life:3.2,damage:b.damage*.55});}}
    if(b.summonClock<=0){b.summonClock=8.5;for(let i=0;i<4+b.stage;i++)spawnEnemy(choice(['chaser','seeker','beater']),false);}
  }

  function updateOrbs(dt){
    const p=state.player;
    for(const o of state.orbs){let d=Math.hypot(p.x-o.x,p.y-o.y);if(o.magnet||d<state.mods.magnet){const speed=o.magnet?850:260;o.x+=(p.x-o.x)/Math.max(1,d)*speed*dt;o.y+=(p.y-o.y)/Math.max(1,d)*speed*dt;d=Math.hypot(p.x-o.x,p.y-o.y);}if(d<p.r+(o.r||7)+5){o.taken=true;if(o.heal)p.hp=Math.min(p.maxHp,p.hp+o.heal);else{const gain=o.value*state.mods.xp;state.xp+=gain;state.stats.xp+=gain;}}}
    state.orbs=state.orbs.filter(o=>!o.taken);
    if(state.xp>=state.nextXp&&!state.pendingUpgrade){state.xp-=state.nextXp;state.level++;state.nextXp=Math.floor(state.nextXp*1.18+5);showLevelUp(state.forceCard);state.forceCard=false;if(state.level===2)tutorial('Level up! Choose one upgrade. The run pauses while you decide.');if(state.level===3)tutorial('Your owned Quidditch TCG cards can now appear as run-changing upgrades.');}
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
    if(state.snitch)return;const p=spawnAtEdge();state.snitch={x:p.x,y:p.y,vx:rand(-140,140),vy:rand(-140,140),time:24,turn:.2};showBanner('GOLDEN SNITCH','Catch it before it escapes');sfx('snitch');
  }
  function updateSnitch(dt){
    const s=state.snitch;if(!s)return;s.time-=dt;s.turn-=dt;if(s.turn<=0){s.turn=rand(.18,.48);const a=Math.random()*Math.PI*2,spd=240+state.elapsed*.05;s.vx=lerp(s.vx,Math.cos(a)*spd,.65);s.vy=lerp(s.vy,Math.sin(a)*spd,.65);}s.x+=s.vx*dt;s.y+=s.vy*dt;constrainToArena(s);
    if(Math.hypot(s.x-state.player.x,s.y-state.player.y)<state.player.r+18){state.snitch=null;state.stats.snitches++;state.score+=1800;sfx('snitch');const rewards=['xp','heal','card','reroll'];const reward=choice(rewards);if(reward==='xp'){state.xp+=state.nextXp*.85;showBanner('SNITCH CAUGHT','Huge XP reward');}else if(reward==='heal'){state.player.hp=state.player.maxHp;showBanner('SNITCH CAUGHT','Full heal');}else if(reward==='card'){state.forceCard=true;state.xp=state.nextXp;showBanner('SNITCH CAUGHT','Free TCG choice');}else{state.flags.packLuck=(state.flags.packLuck||0)+1;showBanner('SNITCH CAUGHT','Pack Luck increased');}state.director.snitchClock=rand(110,165)/(1+(state.flags.snitchSense||0)*.12);return;}
    if(s.time<=0){state.snitch=null;state.director.snitchClock=rand(95,150)/(1+(state.flags.snitchSense||0)*.12);showBanner('SNITCH ESCAPED','Keep moving — another can appear later');}
  }

  function startEvent(){
    const type=choice(['bludger','crowd','double-xp','card-drop']);
    state.event={type,time:type==='bludger'?14:20};
    if(type==='bludger'){showBanner('BLUDGER STORM','Fast projectiles cross the pitch');}
    if(type==='crowd'){showBanner('CROWD ROAR','Movement and attack speed increased');}
    if(type==='double-xp'){showBanner('DOUBLE XP','Experience drops are doubled');}
    if(type==='card-drop'){showBanner('CARD DROP','Defeat the marked elite for a TCG choice');spawnEnemy(choice(['beater','interceptor','shield']),true);state.forceCard=true;}
  }
  function updateEvent(dt){
    if(!state.event)return;state.event.time-=dt;if(state.event.type==='bludger'&&Math.random()<dt*4){const side=Math.random()<.5?0:1,y=rand(240,2160);state.enemyProjectiles.push({x:side?2250:150,y,vx:side?-520:520,vy:rand(-40,40),life:4.5,damage:14});}
    if(state.event.time<=0)state.event=null;
  }

  function updateDirector(dt){
    const d=state.director;d.spawnClock-=dt;const pressure=enemyPressure();
    if(d.spawnClock<=0){d.spawnClock=Math.max(.08,.46/pressure);let count=1;if(state.elapsed>240&&Math.random()<.30)count++;if(state.elapsed>540&&Math.random()<.25)count++;for(let i=0;i<count;i++)spawnEnemy();if(state.elapsed>80&&Math.random()<.018)spawnEnemy(pickEnemyType(),true);}
    d.eventClock-=dt;if(d.eventClock<=0){d.eventClock=rand(65,95);startEvent();}
    d.snitchClock-=dt;if(d.snitchClock<=0){spawnSnitch();d.snitchClock=999;}
    const stages=[300,600,900];if(d.bossStage<3&&state.elapsed>=stages[d.bossStage]){d.bossStage++;spawnBoss(d.bossStage);}
  }

  function updateTrails(dt){
    for(const t of state.trails){t.life-=dt;if((t.type==='wind'||t.type==='vortex')&&t.damage){t.tick-=dt;if(t.tick<=0){t.tick=.28;areaDamage(t.x,t.y,t.r,t.damage,4);}}}
    state.trails=state.trails.filter(t=>t.life>0);for(const p of state.particles){p.life-=dt;p.x+=(p.vx||0)*dt;p.y+=(p.vy||-25)*dt;}state.particles=state.particles.filter(p=>p.life>0);
  }

  function update(dt){
    if(!state?.running||state.paused||state.ended)return;
    state.elapsed+=dt;
    const p=state.player;let dx=0,dy=0;if(keys.has('a')||keys.has('ArrowLeft'))dx--;if(keys.has('d')||keys.has('ArrowRight'))dx++;if(keys.has('w')||keys.has('ArrowUp'))dy--;if(keys.has('s')||keys.has('ArrowDown'))dy++;
    const targetSpeed=190*state.mods.speed*(state.event?.type==='crowd'?1.18:1)*(state.broom.spin?state.broom.spinMoveBonus:1)*(state.flags.stolenBuff?.kind==='speed'?1.22:1);
    if(!state.broom.flight){if(dx||dy){const l=Math.hypot(dx,dy);dx/=l;dy/=l;p.vx=lerp(p.vx,dx*targetSpeed,clamp(dt*14,0,1));p.vy=lerp(p.vy,dy*targetSpeed,clamp(dt*14,0,1));}else{p.vx=lerp(p.vx,0,clamp(dt*12,0,1));p.vy=lerp(p.vy,0,clamp(dt*12,0,1));}p.x+=p.vx*dt;p.y+=p.vy*dt;constrainToArena(p);}else updateFlight(dt);
    if(!state.broom.flight&&state.weapon==='broomstick')updateFlight(dt);
    state.stats.distance+=Math.hypot(p.vx,p.vy)*dt;

    updateFlags(dt);
    const dynamicAttack=(state.flags.hotStreak>0?1.4:1)*(state.flags.stolenBuff?.kind==='attack'?1.22:1)*(state.event?.type==='crowd'?1.15:1);
    const dynamicDamage=(state.flags.stolenBuff?.kind==='damage'?1.25:1)*(state.mods.flex||1)*(state.mods.team||1)*(1+(state.flags.rockyStreak||0)*.018*(state.flags.rocky||0));
    const oldA=state.mods.attackSpeed,oldD=state.mods.damage;state.mods.attackSpeed*=dynamicAttack;state.mods.damage*=dynamicDamage;
    if(state.weapon==='broomstick')broomAttack(dt);else normalAttack(dt);
    state.mods.attackSpeed=oldA;state.mods.damage=oldD;

    updateProjectiles(dt);updateEnemies(dt);updateBoss(dt);updateOrbs(dt);updateSnitch(dt);updateEvent(dt);updateDirector(dt);updateTrails(dt);
    if(state.flags.nimbler&&state.flags.moveMomentum>=100&&Math.random()<dt*.45){areaDamage(p.x,p.y,95,24*state.mods.damage,35);state.flags.moveMomentum=72;}
    if(state.elapsed>=RUN_END&&state.director.bossStage>=3&&state.director.finalBossDefeated)finishRun(true);
    state.score+=dt*(1+state.level*.03);
    updateHud();updateMusic();
  }

  function drawArena(){
    const c=els.canvas,cam=state.camera,p=state.player;
    const lookX=clamp(p.vx*.32,-90,90),lookY=clamp(p.vy*.32,-70,70),targetX=p.x+lookX,targetY=p.y+lookY;
    cam.x=lerp(cam.x,targetX,.075);cam.y=lerp(cam.y,targetY,.075);const targetZoom=state.broom.flight?.88:1;cam.zoom=lerp(cam.zoom,targetZoom,.07);
    ctx.fillStyle='#05060a';ctx.fillRect(0,0,c.width,c.height);ctx.save();ctx.translate(c.width/2,c.height/2);ctx.scale(cam.zoom,cam.zoom);ctx.translate(-cam.x,-cam.y);
    if(arenaImage.complete&&arenaImage.naturalWidth)ctx.drawImage(arenaImage,0,0,WORLD.w,WORLD.h);else{ctx.fillStyle='#8d693d';ctx.fillRect(0,0,WORLD.w,WORLD.h);}
    ctx.fillStyle='#00000016';ctx.beginPath();ctx.ellipse(WORLD.cx,WORLD.cy,WORLD.rx,WORLD.ry,0,0,Math.PI*2);ctx.fill();
    for(const o of state.orbs){ctx.save();ctx.translate(o.x,o.y);if(o.heal){ctx.fillStyle='#d54f55';ctx.fillRect(-5,-2,10,4);ctx.fillRect(-2,-5,4,10);}else{ctx.fillStyle=o.value>10?'#9be6ff':o.value>4?'#69baf0':'#88d7ff';ctx.shadowBlur=8;ctx.shadowColor='#6ecbff';ctx.rotate(state.elapsed*2);ctx.fillRect(-(o.r||5)/2,-(o.r||5)/2,o.r||5,o.r||5);}ctx.restore();}
    for(const t of state.trails){ctx.save();ctx.globalAlpha=clamp(t.life,0,1);if(t.type==='slash'){ctx.strokeStyle='#ffe29b';ctx.lineWidth=8;ctx.beginPath();ctx.arc(t.x,t.y,t.r,-1.3,1.3);ctx.stroke();}else if(t.type==='chain'){ctx.strokeStyle='#9eeaff';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(t.x1,t.y1);ctx.lineTo((t.x1+t.x2)/2+rand(-8,8),(t.y1+t.y2)/2+rand(-8,8));ctx.lineTo(t.x2,t.y2);ctx.stroke();}else if(t.type==='wind'){ctx.strokeStyle='#b5e9ff';ctx.lineWidth=4;ctx.beginPath();ctx.arc(t.x,t.y,t.r,0,Math.PI*2);ctx.stroke();}else if(t.type==='vortex'){ctx.strokeStyle='#b9a8ff';ctx.lineWidth=6;ctx.beginPath();ctx.arc(t.x,t.y,t.r*(1-t.life/1.7*.25),state.elapsed*5,state.elapsed*5+4.5);ctx.stroke();}ctx.restore();}
    for(const pr of state.projectiles){ctx.fillStyle=pr.kind==='wind'?'#c7efff':pr.kind==='wrong'?'#ff8f69':'#e8d29b';ctx.beginPath();ctx.arc(pr.x,pr.y,pr.kind==='wind'?6:4,0,Math.PI*2);ctx.fill();}
    for(const pr of state.enemyProjectiles){ctx.fillStyle='#bd4c42';ctx.shadowBlur=8;ctx.shadowColor='#ff624e';ctx.beginPath();ctx.arc(pr.x,pr.y,7,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;}
    for(const e of state.enemies)drawEnemy(e);
    if(state.boss)drawBoss(state.boss);
    if(state.snitch)drawSnitch(state.snitch);
    drawPlayer();
    for(const pfx of state.particles){ctx.globalAlpha=clamp(pfx.life/.35,0,1);if(pfx.text){ctx.font=`900 ${pfx.size||12}px Arial`;ctx.textAlign='center';ctx.fillStyle=pfx.color||'#fff';ctx.fillText(pfx.text,pfx.x,pfx.y);}else{ctx.fillStyle=pfx.color||'#fff';ctx.fillRect(pfx.x,pfx.y,pfx.size||3,pfx.size||3);}ctx.globalAlpha=1;}
    ctx.restore();
  }
  function drawEnemy(e){
    ctx.save();ctx.translate(e.x,e.y);if(e.elite){ctx.shadowBlur=18;ctx.shadowColor='#f0c35d';ctx.strokeStyle='#f0c35d';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,e.r+7,0,Math.PI*2);ctx.stroke();ctx.shadowBlur=0;}
    ctx.fillStyle=e.flash>0?'#fff3cf':e.color;ctx.beginPath();ctx.arc(0,0,e.r,0,Math.PI*2);ctx.fill();ctx.fillStyle='#111';ctx.fillRect(-e.r*.45,-e.r*.18,4,4);ctx.fillRect(e.r*.22,-e.r*.18,4,4);
    if(e.type==='seeker'){ctx.fillStyle='#ead469';ctx.beginPath();ctx.moveTo(-e.r,0);ctx.lineTo(-e.r-12,-7);ctx.lineTo(-e.r-8,6);ctx.fill();ctx.beginPath();ctx.moveTo(e.r,0);ctx.lineTo(e.r+12,-7);ctx.lineTo(e.r+8,6);ctx.fill();}
    if(e.type==='beater'){ctx.strokeStyle='#291f1c';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(e.r+13,-e.r);ctx.stroke();}
    if(e.type==='shield'){ctx.strokeStyle='#c2cad8';ctx.lineWidth=5;ctx.beginPath();ctx.arc(0,0,e.r+6,-1.15,1.15);ctx.stroke();}
    if(e.elite){ctx.fillStyle='#250909';ctx.fillRect(-22,-e.r-13,44,5);ctx.fillStyle='#e6b74a';ctx.fillRect(-22,-e.r-13,44*clamp(e.hp/e.maxHp,0,1),5);}
    ctx.restore();
  }
  function drawBoss(b){ctx.save();ctx.translate(b.x,b.y);ctx.shadowBlur=22;ctx.shadowColor=b.color;ctx.fillStyle=b.color;ctx.beginPath();ctx.arc(0,0,b.r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle='#f5d579';ctx.lineWidth=5;ctx.beginPath();ctx.arc(0,0,b.r+8,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#111';ctx.fillRect(-18,-10,10,8);ctx.fillRect(8,-10,10,8);ctx.restore();}
  function drawSnitch(s){ctx.save();ctx.translate(s.x,s.y);ctx.shadowBlur=16;ctx.shadowColor='#ffe355';ctx.fillStyle='#f4c83f';ctx.beginPath();ctx.arc(0,0,9,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#f9edc0';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-7,0);ctx.quadraticCurveTo(-24,-13,-34,-4);ctx.moveTo(7,0);ctx.quadraticCurveTo(24,-13,34,-4);ctx.stroke();ctx.shadowBlur=0;ctx.restore();}
  function drawPlayer(){
    const p=state.player;ctx.save();if(state.broom.flight){ctx.translate(p.x,p.y);ctx.rotate(Math.atan2(state.broom.flight.dy,state.broom.flight.dx));ctx.strokeStyle='#d29a44';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(-26,8);ctx.lineTo(28,-5);ctx.stroke();ctx.fillStyle='#b18433';ctx.beginPath();ctx.moveTo(-28,8);ctx.lineTo(-43,18);ctx.lineTo(-37,3);ctx.closePath();ctx.fill();ctx.restore();}
    try{if(typeof drawCombatPlayer==='function')drawCombatPlayer(ctx,{x:p.x,y:p.y,r:p.r},state.weapon==='broomstick'?'sword':state.weapon);else fallbackPlayer();}catch(_){fallbackPlayer();}
    if(state.weapon==='broomstick'){const b=state.broom;ctx.save();ctx.translate(p.x,p.y);let angle=-.3;if(b.spin)angle=(b.spin.elapsed/b.spin.duration)*Math.PI*2*b.spin.rotations;ctx.rotate(angle);ctx.strokeStyle=b.evolved?'#d9c5ff':'#9f6b2d';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(-48,0);ctx.lineTo(48,0);ctx.stroke();ctx.fillStyle='#c4933f';ctx.beginPath();ctx.moveTo(-47,-7);ctx.lineTo(-64,-13);ctx.lineTo(-58,9);ctx.closePath();ctx.fill();ctx.restore();if(b.spin){ctx.strokeStyle=b.evolved?'#cbb9ff88':'#f2d07777';ctx.lineWidth=5;ctx.beginPath();ctx.arc(p.x,p.y,b.spinRadius*state.mods.area,0,Math.PI*2);ctx.stroke();}}
    if(state.flags.keeperActive>0){ctx.strokeStyle='#9bd6ffbb';ctx.lineWidth=4;for(let i=0;i<3;i++){const a=state.elapsed*2+i*Math.PI*2/3;ctx.beginPath();ctx.arc(p.x+Math.cos(a)*70,p.y+Math.sin(a)*70,14,0,Math.PI*2);ctx.stroke();}}
    if(state.flags.soup){ctx.strokeStyle='#83b89655';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,150*state.mods.area,0,Math.PI*2);ctx.stroke();}
  }
  function fallbackPlayer(){const p=state.player;ctx.fillStyle='#c79a74';ctx.fillRect(p.x-7,p.y-12,14,12);ctx.fillStyle='#44678f';ctx.fillRect(p.x-10,p.y,20,20);}

  function updateHud(){
    if(!state)return;els.time.textContent=fmtTime(state.elapsed);els.kills.textContent=String(state.kills);els.level.textContent=String(state.level);els.score.textContent=Math.floor(state.score).toLocaleString('en-GB');els.hp.style.width=`${clamp(state.player.hp/state.player.maxHp*100,0,100)}%`;els.xp.style.width=`${clamp(state.xp/state.nextXp*100,0,100)}%`;
    if(state.weapon==='broomstick'){els.mana.style.width=`${clamp(state.broom.mana/state.broom.maxMana*100,0,100)}%`;els.broomMode.textContent=state.broom.mode.toUpperCase();els.manaText.textContent=`${Math.floor(state.broom.mana)} / ${state.broom.maxMana}`;els.flightDots.textContent='●'.repeat(state.broom.charges)+'○'.repeat(Math.max(0,state.broom.maxCharges-state.broom.charges));}
    let ev='';let sub='';if(state.boss){ev=state.boss.name;sub=`${Math.max(0,Math.ceil(state.boss.hp/state.boss.maxHp*100))}% HP`;}else if(state.snitch){ev='GOLDEN SNITCH';sub=`${Math.ceil(state.snitch.time)}s remaining`;}else if(state.event){ev=state.event.type.replace('-', ' ').toUpperCase();sub=`${Math.ceil(state.event.time)}s`;}els.event.textContent=ev||'MATCH LIVE';els.eventSub.textContent=sub||'Build your run · survive the pitch';
  }
  function renderCardStrip(){
    if(!els.cardStrip||!state)return;els.cardStrip.innerHTML=[...state.tcg.cards.values()].slice(-5).map(({card,rank})=>`<div class="qs-mini-card ${['legendary','millennium','signature','platinum'].includes(card.rarity)?'rare':''}" title="${safeText(cardDescription(card,rank))}"><img src="${safeText(card.image)}" alt=""><em>${safeText(card.name)} · ${rank}</em></div>`).join('');
  }

  function frame(ts){
    if(!visible)return;if(!state){raf=requestAnimationFrame(frame);return;}if(!state.lastTs)state.lastTs=ts;const dt=Math.min(.034,(ts-state.lastTs)/1000);state.lastTs=ts;update(dt);drawArena();raf=requestAnimationFrame(frame);
  }

  function startRun(){
    const selected=document.querySelector('.qs-weapon.selected')?.dataset.weapon||preferredWeapon||'broomstick';preferredWeapon=selected;resetState(selected);els.intro.hidden=true;els.results.hidden=true;els.levelup.hidden=true;startMusic();showBanner('MATCH START','SURVIVE · BUILD · DOMINATE');tutorial('Move with WASD or the arrow keys. Attacks happen automatically.');if(selected==='broomstick')setTimeout(()=>tutorial('Broomstick: Q swaps Melee/Magic. SPACE uses a rechargeable flight burst.'),2800);state.lastTs=0;if(!raf)raf=requestAnimationFrame(frame);
  }

  async function finishRun(won){
    if(!state||state.ended)return;state.ended=true;state.running=false;state.paused=true;state.won=won;stopMusic();
    const gp=Math.min(25000,Math.floor(state.elapsed*2+state.kills*3+state.stats.elites*45+state.stats.bosses*450+state.stats.snitches*650));
    profile.runs++;profile.bestScore=Math.max(profile.bestScore,Math.floor(state.score));profile.bestTime=Math.max(profile.bestTime,Math.floor(state.elapsed));saveProfile();
    els.resultTitle.textContent=won?'QUIDDITCH GROUND CLEARED':'RUN OVER';
    els.resultGrid.innerHTML=[['TIME',fmtTime(state.elapsed)],['KILLS',state.kills],['ELITES',state.stats.elites],['BOSSES',state.stats.bosses],['SNITCHES',state.stats.snitches],['LEVEL',state.level],['SCORE',Math.floor(state.score).toLocaleString('en-GB')],['GP',gp.toLocaleString('en-GB')]].map(([a,b])=>`<div class="qs-result-stat"><small>${a}</small><b>${b}</b></div>`).join('');
    els.buildSummary.innerHTML=[`Weapon: ${state.weapon==='broomstick'?(state.broom.evolved?'Nimbus Tempest':'Broomstick'):state.weapon}`,`TCG: ${state.tcg.cards.size}/5`,`Synergies: ${state.tcg.synergies.size}`,`Highest hit: ${Math.floor(state.stats.highestHit)}`].map(x=>`<span class="qs-build-pill">${safeText(x)}</span>`).join('');
    els.saveStatus.textContent='Saving isolated Quidditch Ground result…';els.results.hidden=false;
    const dbx=hostDb();
    if(dbx&&hostCharacter()){
      try{
        const {data,error}=await dbx.rpc('complete_repo_sports_survivor_run',{p_score:Math.floor(state.score),p_seconds:Math.floor(state.elapsed),p_kills:state.kills,p_elites:state.stats.elites,p_bosses:state.stats.bosses,p_snitches:state.stats.snitches});
        if(error)throw error;const row=Array.isArray(data)?data[0]:data;if(row?.new_gp!=null){const ch=hostCharacter();if(ch)ch.gp=Number(row.new_gp);try{if(typeof renderCharacter==='function')renderCharacter();}catch(_){ }els.saveStatus.textContent=`Saved · +${Number(row.awarded_gp||0).toLocaleString('en-GB')} GP`;}
        else els.saveStatus.textContent='Run saved locally.';
      }catch(error){console.warn('Quidditch Ground result save unavailable:',error);els.saveStatus.textContent='Run saved locally. Run the included Quidditch Ground SQL once to enable GP/stat saving.';}
    }else els.saveStatus.textContent='Guest run — local records only.';
    if(!profile.tutorialDone){profile.tutorialDone=true;saveProfile();}
  }

  function resize(){
    if(!els.canvas)return;const rect=els.canvas.getBoundingClientRect(),dpr=Math.min(1.5,window.devicePixelRatio||1);const w=Math.max(640,Math.floor(rect.width*dpr)),h=Math.max(360,Math.floor(rect.height*dpr));if(els.canvas.width!==w||els.canvas.height!==h){els.canvas.width=w;els.canvas.height=h;}
  }
  function bind(){
    if(listenersBound)return;listenersBound=true;
    window.addEventListener('resize',resize);
    window.addEventListener('keydown',onKeyDown,{passive:false});window.addEventListener('keyup',e=>keys.delete(e.key.length===1?e.key.toLowerCase():e.key));
    els.dialog?.addEventListener('close',cleanup);
    document.getElementById('qsStart')?.addEventListener('click',startRun);
    document.getElementById('qsPlayAgain')?.addEventListener('click',()=>{els.results.hidden=true;els.intro.hidden=false;renderIntro();});
    document.getElementById('qsChangeWeapon')?.addEventListener('click',()=>{els.results.hidden=true;els.intro.hidden=false;renderIntro();});
    document.getElementById('qsReturnCombat')?.addEventListener('click',returnToCombat);
    document.getElementById('qsClose')?.addEventListener('click',()=>els.dialog?.close());
    document.getElementById('qsSound')?.addEventListener('click',()=>{ensureAudio();if(music){music.muted=!music.muted;document.getElementById('qsSound').textContent=music.muted?'SOUND OFF':'SOUND';}});
    els.intro?.addEventListener('click',e=>{const b=e.target.closest('.qs-weapon');if(!b)return;els.intro.querySelectorAll('.qs-weapon').forEach(x=>x.classList.toggle('selected',x===b));preferredWeapon=b.dataset.weapon;});
  }
  function onKeyDown(e){
    const key=e.key.length===1?e.key.toLowerCase():e.key;keys.add(key);
    if(!visible)return;
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();
    if(key==='q')toggleBroomMode();if(e.code==='Space')startFlight();
    if(state?.pendingUpgrade&&['1','2','3','4','5'].includes(key)){const b=els.choiceGrid.children[Number(key)-1];if(b)b.click();}
  }
  function renderIntro(){
    loadProfile();
    document.querySelectorAll('.qs-weapon').forEach(b=>b.classList.toggle('selected',b.dataset.weapon===preferredWeapon));
    const best=document.getElementById('qsBestRun');if(best)best.textContent=profile.bestScore?`Best score ${profile.bestScore.toLocaleString('en-GB')} · ${fmtTime(profile.bestTime)}`:'No completed Quidditch Ground run yet.';
  }
  function cleanup(){
    visible=false;cancelAnimationFrame(raf);raf=0;stopMusic();keys.clear();clearTimeout(bannerTimer);clearTimeout(tutorialTimer);if(state){state.running=false;state.enemies.length=0;state.projectiles.length=0;state.enemyProjectiles.length=0;state.orbs.length=0;state.particles.length=0;}state=null;
  }
  function returnToCombat(){
    cleanup();try{els.dialog?.close();}catch(_){ }
    setTimeout(()=>{try{if(typeof openCombat==='function')openCombat();else document.getElementById('openCombat')?.click();setTimeout(()=>document.querySelector('#combatModeSwitcherSafe [data-combat-menu="endless"]')?.click(),80);}catch(_){ }},30);
  }

  function open(opts={}){
    cacheEls();if(!els.dialog||!els.canvas)return false;preferredWeapon=opts.preferredWeapon||preferredWeapon||'broomstick';visible=true;loadProfile();collectionPromise=null;ownedCards=[];loadCollection();renderIntro();els.intro.hidden=false;els.levelup.hidden=true;els.results.hidden=true;els.broomHud.hidden=true;els.manaBar.hidden=true;bind();try{if(!els.dialog.open)els.dialog.showModal();}catch(_){els.dialog.setAttribute('open','');}requestAnimationFrame(()=>{resize();if(!raf)raf=requestAnimationFrame(frame);});return true;
  }

  window.RepoSportsSurvivor={open,close:()=>els.dialog?.close(),finish:()=>state&&finishRun(true),getState:()=>state};
})();
