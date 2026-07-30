/* Tombs of Amascut multiplayer v2 — 1–4 player Supabase Realtime party layer. */
(() => {
  'use strict';
  if (typeof toaState === 'undefined' || typeof db === 'undefined') return;

  const legacyHandle = toaHandlePartyMessage;
  const legacyClose = toaCloseChannel;
  const sessionId = `${character?.id || 'guest'}-${Math.random().toString(36).slice(2, 9)}`;
  const displayName = () => character?.username || 'Raider';
  const MAX_PLAYERS = 4;
  const hpScale = [0, 1, 2.2, 3.6, 5.2];

  Object.assign(toaState, {
    sessionId,
    partyMembers: new Map(),
    readyMembers: new Map(),
    remotePlayers: new Map(),
    partySize: 1,
    partyFull: false,
    presenceRetry: 0,
    nexusSyncTimer: 0,
    remoteAnimRaf: 0
  });

  function memberId(payload) { return String(payload?.playerId || payload?.sessionId || payload?.sender || ''); }
  function livingPartySize() { return Math.max(1, Math.min(MAX_PLAYERS, toaState.partySize || 1)); }
  function scaledHit(base) { return base / hpScale[livingPartySize()]; }

  function peerEntries() {
    return [...toaState.partyMembers.entries()].filter(([id]) => id !== sessionId).slice(0, MAX_PLAYERS - 1);
  }

  function cloneSprite(room, id, index) {
    const map = toaState.remotePlayers;
    const key = `${room}:${id}`;
    if (map.has(key)) return map.get(key).el;
    const source = room === 'nexus' ? $('toaPlayer') : room === 'crondis' ? $('toaCrondisPlayer') : $('toaScarabasPlayer');
    const parent = room === 'nexus' ? $('toaPartyPlayers') : room === 'crondis' ? $('toaCrondisRoom') : $('toaScarabasRoom');
    if (!source || !parent) return null;
    const el = source.cloneNode(true);
    el.removeAttribute('id');
    el.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
    el.classList.add('toa-remote-raider');
    el.classList.remove('hidden', 'toa-dead');
    el.dataset.playerId = id;
    el.setAttribute('aria-label', `Party member ${index + 2}`);
    const bubble = el.querySelector('.toa-chat-bubble');
    if (bubble) bubble.classList.add('hidden');
    parent.appendChild(el);
    map.set(key, {el, room, id, x: 50, y: room === 'nexus' ? 79 : room === 'crondis' ? 70 : 78, tx: 50, ty: room === 'nexus' ? 79 : room === 'crondis' ? 70 : 78, left:false, walking:false});
    return el;
  }

  function rebuildRemoteSprites() {
    const peers = peerEntries();
    const activeIds = new Set();
    ['nexus','crondis','scarabas'].forEach(room => peers.forEach(([id], i) => {
      activeIds.add(`${room}:${id}`);
      const el = cloneSprite(room, id, i);
      if (!el) return;
      const visible = (room === 'nexus' && toaState.room === 'nexus') ||
        (room === 'crondis' && toaState.room.startsWith('crondis')) ||
        (room === 'scarabas' && toaState.room.startsWith('scarabas'));
      el.classList.toggle('hidden', !visible);
    }));
    for (const [key, p] of toaState.remotePlayers) {
      if (!activeIds.has(key)) { p.el.remove(); toaState.remotePlayers.delete(key); }
    }
    // Hide obsolete single-teammate placeholders; v2 creates one sprite per remote player.
    $('toaCrondisTeammate')?.classList.add('hidden');
    $('toaScarabasTeammate')?.classList.add('hidden');
  }

  function refreshPartyUi() {
    const count = livingPartySize();
    toaState.partyJoined = toaState.mode === 'solo' || count >= 2;
    toaState.remoteReady = peerEntries().length > 0 && peerEntries().every(([id]) => toaState.readyMembers.get(id) === true);
    const status = $('toaPartyStatus');
    if (status && toaState.mode === 'party') status.innerHTML = `<b>PARTY ${count}/${MAX_PLAYERS}</b> ${toaState.code}`;
    toaUpdateCrondisUnlock();
    rebuildRemoteSprites();
    toaRenderReady();
    toaRenderScarabasReady();
  }

  function syncPresence() {
    const state = toaState.channel?.presenceState?.() || {};
    const members = new Map();
    Object.values(state).flat().forEach(p => {
      const id = String(p.sessionId || p.playerId || '');
      if (id) members.set(id, p);
    });
    if (!members.has(sessionId)) members.set(sessionId, {sessionId, name:displayName(), host:toaState.isHost});
    const sorted = [...members.entries()].sort((a,b) => Number(b[1].host)-Number(a[1].host) || String(a[0]).localeCompare(String(b[0])));
    toaState.partyMembers = new Map(sorted.slice(0, MAX_PLAYERS));
    toaState.partySize = toaState.partyMembers.size;
    toaState.partyFull = members.size > MAX_PLAYERS || (!toaState.partyMembers.has(sessionId));
    if (toaState.partyFull && !toaState.partyMembers.has(sessionId)) {
      toaNotice('That raid party is full (maximum 4 players).', 4200);
      legacyClose();
      return;
    }
    refreshPartyUi();
  }

  function renderReadyList(containerId, localId) {
    const box = $(containerId)?.parentElement;
    if (!box) return;
    box.innerHTML = '';
    const mine = document.createElement('b');
    mine.id = localId;
    mine.textContent = `YOU · ${toaState.localReady ? 'READY' : 'NOT READY'}`;
    mine.classList.toggle('ready', toaState.localReady);
    box.appendChild(mine);
    peerEntries().forEach(([id, p], i) => {
      const b = document.createElement('b');
      const ready = toaState.readyMembers.get(id) === true;
      b.textContent = `${String(p.name || `RAIDER ${i+2}`).toUpperCase()} · ${ready ? 'READY' : 'NOT READY'}`;
      b.classList.toggle('ready', ready);
      box.appendChild(b);
    });
  }

  toaRenderReady = function() {
    renderReadyList('toaReadyYou', 'toaReadyYou');
    const btn = $('toaReadyButton'); if (btn) btn.textContent = toaState.localReady ? 'CANCEL READY' : 'READY UP';
  };
  toaRenderScarabasReady = function() {
    renderReadyList('toaScarabasReadyYou', 'toaScarabasReadyYou');
    const btn = $('toaScarabasReadyButton'); if (btn) btn.textContent = toaState.localReady ? 'CANCEL READY' : 'READY UP';
  };

  function everyoneReady() {
    if (!toaState.localReady) return false;
    if (toaState.mode === 'solo') return true;
    const peers = peerEntries();
    return peers.length >= 1 && peers.every(([id]) => toaState.readyMembers.get(id) === true);
  }
  toaTryStartCrondis = function() {
    if (!everyoneReady() || toaState.room !== 'crondis-safe') return;
    toaState.room='crondis-arena';
    const slots=[[50,72],[44,74],[56,74],[50,79]], idx=[...toaState.partyMembers.keys()].indexOf(sessionId);
    [toaState.arenaX,toaState.arenaY]=slots[Math.max(0,idx)] || slots[0];
    $('toaCrondisSafePanel')?.classList.add('hidden');
    const p=$('toaCrondisPlayer'); if(p){p.style.left=toaState.arenaX+'%';p.style.top=toaState.arenaY+'%';p.classList.add('toa-armed');}
    rebuildRemoteSprites();
    $('toaRoomStatus').innerHTML='<b>ROOM</b> PATH OF CRONDIS · ARENA'; startToaCrondisMusic();
    toaNotice(`${livingPartySize()} raiders entered. Zebak has scaled health.`,3500); toaStartZebakFight();
  };
  toaTryStartScarabas = function() {
    if (!everyoneReady() || toaState.room !== 'scarabas-safe') return;
    toaState.room='scarabas-arena';
    const slots=[[50,80],[44,80],[56,80],[50,85]], idx=[...toaState.partyMembers.keys()].indexOf(sessionId);
    [toaState.arenaX,toaState.arenaY]=slots[Math.max(0,idx)] || slots[0];
    $('toaScarabasSafePanel')?.classList.add('hidden');
    const p=$('toaScarabasPlayer'); if(p){p.style.left=toaState.arenaX+'%';p.style.top=toaState.arenaY+'%';p.classList.add('toa-keris-armed');}
    rebuildRemoteSprites(); $('toaScarabasArenaBanner')?.classList.remove('hidden');
    $('toaRoomStatus').innerHTML='<b>ROOM</b> PATH OF SCARABAS · ARENA'; startToaScarabasMusic();
    toaNotice(`${livingPartySize()} raiders entered. Kephri has scaled health.`,3500); toaStartKephriFight();
    setTimeout(()=>$('toaScarabasArenaBanner')?.classList.add('hidden'),2600);
  };

  function applyZebakHit(amount, x=50, y=18) {
    if (!toaState.fightActive || toaState.fightPaused || !toaState.isHost && toaState.mode==='party') return;
    const floor=toaState.phase===1?70:toaState.phase===2?60:toaState.phase===3?40:toaState.phase===4?25:toaState.phase===5?10:0;
    toaState.zebakHp=Math.max(floor,toaState.zebakHp-amount); toaDamageSplat(x,y,Math.max(.1,amount).toFixed(amount<1?1:0)); toaUpdateCombatHud();
    if(toaState.phase===1&&toaState.zebakHp<=70)toaReachFirstThreshold(); else if(toaState.phase===2&&toaState.zebakHp<=60)toaReachWaveThreshold();
    else if(toaState.phase===3&&toaState.zebakHp<=40)toaReachFortyThreshold(); else if(toaState.phase===4&&toaState.zebakHp<=25)toaReachTwentyFiveThreshold();
    else if(toaState.phase===5&&toaState.zebakHp<=10)toaReachFinalSurge(); else if(toaState.phase===6&&toaState.zebakHp<=0)toaDefeatZebak();
  }

  toaAutoShoot = function() {
    if(!toaState.fightActive||toaState.fightPaused||toaState.room!=='crondis-arena'||toaState.localDead)return;
    const p=$('toaCrondisPlayer');p?.classList.remove('toa-firing');void p?.offsetWidth;p?.classList.add('toa-firing');setTimeout(()=>p?.classList.remove('toa-firing'),300);
    const sx=toaState.arenaX,sy=toaState.arenaY-2,tx=50+(Math.random()*4-2),ty=15;
    toaProjectile('player-arrow',sx,sy,tx,ty,470,()=>{
      if(!toaState.fightActive)return;
      const damage=scaledHit(1);
      if(toaState.mode==='solo'||toaState.isHost) applyZebakHit(damage,tx,ty+3);
      else toaPartySend({type:'zebak-hit',amount:damage,x:tx,y:ty+3});
    });
  };

  const originalKephriHit = toaKephriHit;
  toaKephriHit = function(remote=false) {
    if(remote) return originalKephriHit(true);
    if(!toaState.kephriActive||toaState.localDead||toaState.kephriHp<=0)return;
    const el=$('toaScarabasPlayer');el?.classList.remove('toa-keris-strike');void el?.offsetWidth;el?.classList.add('toa-keris-strike');setTimeout(()=>el?.classList.remove('toa-keris-strike'),340);
    const amount=scaledHit(.8);
    if(toaState.mode==='solo'||toaState.isHost) applyKephriHit(amount); else toaPartySend({type:'kephri-hit',amount});
  };
  function applyKephriHit(amount){
    if(!toaState.kephriActive)return;
    toaState.kephriHp=Math.max(0,toaState.kephriHp-amount);toaUpdateKephriHud();
    if(toaState.channel)toaPartySend({type:'kephri-state',hp:toaState.kephriHp});
    if(toaState.kephriHp<=80&&!toaState.kephriDungTriggered)toaReachKephriEighty();if(toaState.kephriHp<=70&&!toaState.kephriFleasTriggered)toaReachKephriSeventy();
    if(toaState.kephriHp<=60&&!toaState.kephriDungStrike60)toaReachKephriDungStrike(60);if(toaState.kephriHp<=50&&!toaState.kephriAddsTriggered)toaReachKephriFifty();
    if(toaState.kephriHp<=30&&!toaState.kephriDungStrike30)toaReachKephriDungStrike(30);if(toaState.kephriHp<=30&&!toaState.kephriDiveTriggered)toaReachKephriThirty();
    if(toaState.kephriHp<=15&&!toaState.kephriDungStrike15)toaReachKephriDungStrike(15);if(toaState.kephriHp<=10&&!toaState.kephriFinalRush)toaReachKephriTen();
    if(toaState.kephriHp<=0)toaDefeatKephri(false);
  }

  toaPartySend = function(payload) {
    const ch=toaState.channel;if(!ch||!payload)return;
    const enriched={...payload,sender:character?.id,playerId:sessionId,name:displayName(),sentAt:Date.now()};
    try{ch.send({type:'broadcast',event:'toa',payload:enriched});}catch(e){console.warn('TOA party send failed',e);}
  };

  toaHandlePartyMessage = function(m) {
    if(!m)return; const id=memberId(m); if(id===sessionId)return;
    if(m.type==='ready'){
      toaState.readyMembers.set(id,!!m.ready);refreshPartyUi();
      if(toaState.room==='scarabas-safe')toaTryStartScarabas();else if(toaState.room==='crondis-safe')toaTryStartCrondis();return;
    }
    if(m.type==='move-nexus'||m.type==='move-crondis'||m.type==='move-scarabas'){
      const room=m.type.split('-')[1]; const key=`${room}:${id}`; let rp=toaState.remotePlayers.get(key); if(!rp){cloneSprite(room,id,peerEntries().findIndex(([pid])=>pid===id));rp=toaState.remotePlayers.get(key);} if(rp){rp.tx=Number(m.x)||rp.tx;rp.ty=Number(m.y)||rp.ty;rp.left=!!m.left;rp.walking=!!m.walking;} return;
    }
    if(m.type==='prayer'){
      const room=toaState.room.startsWith('scarabas')?'scarabas':'crondis', rp=toaState.remotePlayers.get(`${room}:${id}`); const img=rp?.el.querySelector('.toa-prayer-overhead');
      if(img){img.classList.toggle('hidden',!m.prayer);if(m.prayer)img.src=`assets/toa-pray-${m.prayer}.png`;} return;
    }
    if(m.type==='zebak-hit'&&toaState.isHost){applyZebakHit(Math.max(0,Number(m.amount)||0),Number(m.x)||50,Number(m.y)||18);return;}
    if(m.type==='kephri-hit'&&toaState.isHost){applyKephriHit(Math.max(0,Number(m.amount)||0));return;}
    if(m.type==='nexus-chat'){
      const rp=toaState.remotePlayers.get(`nexus:${id}`);let b=rp?.el.querySelector('.toa-chat-bubble');if(b){b.textContent=String(m.text||'').slice(0,80);b.classList.remove('hidden');clearTimeout(b._timer);b._timer=setTimeout(()=>b.classList.add('hidden'),5000);}return;
    }
    if(m.type==='player-dead'||m.type==='kephri-player-dead'){
      ['crondis','scarabas'].forEach(room=>toaState.remotePlayers.get(`${room}:${id}`)?.el.classList.add('toa-dead'));
      const allRemoteDead=peerEntries().every(([pid])=>toaState.remotePlayers.get(`${toaState.room.startsWith('scarabas')?'scarabas':'crondis'}:${pid}`)?.el.classList.contains('toa-dead'));
      if(toaState.localDead&&allRemoteDead)toaShowDefeatedPanel(true);return;
    }
    // Reuse the existing mechanic synchronisation for fireballs, dung, phases, victory, etc.
    legacyHandle(m);
  };

  toaCloseChannel = function(){
    clearInterval(toaState.nexusSyncTimer);toaState.nexusSyncTimer=0;cancelAnimationFrame(toaState.remoteAnimRaf);
    toaState.partyMembers?.clear();toaState.readyMembers?.clear();toaState.remotePlayers?.forEach(p=>p.el.remove());toaState.remotePlayers?.clear();
    legacyClose();
  };

  toaOpenChannel = function(code,host){
    toaCloseChannel();toaState.isHost=!!host;
    const ch=db.channel(`toa-party-${code}`,{config:{broadcast:{self:false},presence:{key:sessionId}}});toaState.channel=ch;
    ch.on('broadcast',{event:'toa'},({payload})=>toaHandlePartyMessage(payload));
    ch.on('presence',{event:'sync'},syncPresence); ch.on('presence',{event:'join'},syncPresence); ch.on('presence',{event:'leave'},syncPresence);
    ch.subscribe(async status=>{
      if(status==='SUBSCRIBED'){
        toaState.netConnected=true;
        await ch.track({sessionId,playerId:sessionId,name:displayName(),host:!!host,joinedAt:Date.now()});
        syncPresence();toaPartySend({type:'hello'});
        clearInterval(toaState.nexusSyncTimer);toaState.nexusSyncTimer=setInterval(()=>{
          if(toaState.channel&&toaState.room==='nexus')toaPartySend({type:'move-nexus',x:toaState.x,y:toaState.y,left:$('toaPlayer')?.classList.contains('facing-left'),walking:Object.values(toaState.keys||{}).some(Boolean)});
        },65);
        clearInterval(toaState.netSyncTimer);toaState.netSyncTimer=setInterval(()=>{
          if(toaState.isHost&&toaState.fightActive)toaPartySend({type:'boss-state',hp:toaState.zebakHp,phase:toaState.phase});
          if(toaState.isHost&&toaState.kephriActive)toaPartySend({type:'kephri-state',hp:toaState.kephriHp});
        },120);
      } else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT') {
        toaNotice('Raid connection interrupted — Supabase Realtime is reconnecting…',3500);
      }
    });
  };

  // Animate all remote players with interpolation.
  function animateRemote(){
    toaState.remotePlayers.forEach(p=>{const a=.22;p.x+=(p.tx-p.x)*a;p.y+=(p.ty-p.y)*a;p.el.style.left=p.x+'%';p.el.style.top=p.y+'%';p.el.classList.toggle('facing-left',p.left);p.el.classList.toggle('walking',p.walking);});
    toaState.remoteAnimRaf=requestAnimationFrame(animateRemote);
  }
  animateRemote();

  // Ready clicks already update localReady in the base game; keep the map and broadcast authoritative identity.
  $('toaReadyButton')?.addEventListener('click',()=>setTimeout(()=>{toaState.readyMembers.set(sessionId,toaState.localReady);toaPartySend({type:'ready',ready:toaState.localReady});refreshPartyUi();toaTryStartCrondis();},0));
  $('toaScarabasReadyButton')?.addEventListener('click',()=>setTimeout(()=>{toaState.readyMembers.set(sessionId,toaState.localReady);toaPartySend({type:'ready',ready:toaState.localReady});refreshPartyUi();toaTryStartScarabas();},0));

  const baseEnterCrondis=toaEnterCrondisRoom,baseEnterScarabas=toaEnterScarabasRoom;
  toaEnterCrondisRoom=function(fromParty=false){baseEnterCrondis(fromParty);toaState.readyMembers.clear();rebuildRemoteSprites();refreshPartyUi();};
  toaEnterScarabasRoom=function(fromParty=false){baseEnterScarabas(fromParty);toaState.readyMembers.clear();rebuildRemoteSprites();refreshPartyUi();};
})();
