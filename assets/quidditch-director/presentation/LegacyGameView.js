(() => {
  'use strict';
  const runtime=window.QD_RUNTIME;const D=runtime?.data,E=runtime?.engine,services=runtime?.services;
  if(!D||!E)return;

  const dialog=document.getElementById('quidditchDirectorDialog');
  const root=document.getElementById('qdRoot');
  const fx=document.getElementById('qdFxLayer');
  const toastEl=document.getElementById('qdToast');
  const shell=dialog?.querySelector('.qd-shell');
  const topStatus=document.getElementById('qdTopStatus');
  const openButton=document.getElementById('openQuidditchDirector');
  if(!dialog||!root||!openButton)return;
  try{services.saveManager.setCloudClient(runtime.host?.getDb?.());}catch{}

  const PROFILE_KEY='repo_quidditch_director_profile_v1';
  let profile=E.newProfile(),run=null,uiMode='menu',betweenPossessions=null,cloudAvailable=true,saveTimer=null,toastTimer=null,controllerIndex=0,gamepadFrame=null,prevPad=[];
  let audioCtx=null,crowdSource=null,crowdGain=null;

  const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const pct=(v,max=60)=>`${Math.min(100,Math.max(0,(Number(v)||0)/max*100))}%`;
  const cardByUid=(uid)=>run?.deck?.find(c=>c.uid===uid)||run?.bench?.find(c=>c.uid===uid);
  function currentManager(){try{return runtime.host?.getCharacter?.()?.username||'Guest Director';}catch{return'Guest Director';}}
  function signedIn(){try{return Boolean(runtime.host?.getCharacter?.());}catch{return false;}}

  function localLoad(){const loaded=services.saveManager.loadLocal(currentManager());profile=loaded.profile;run=loaded.run;}
  function localSave(){services.saveManager.saveLocal(currentManager(),profile,run);}
  async function cloudLoad(){const loaded=await services.saveManager.loadCloud(profile,run);cloudAvailable=loaded.available;if(loaded.profile!==profile||loaded.run!==run){profile=loaded.profile;run=loaded.run;localSave();}}
  async function cloudSaveNow(){const result=await services.saveManager.saveCloud(profile,run);cloudAvailable=result.available;}
  function save(){localSave();clearTimeout(saveTimer);saveTimer=setTimeout(cloudSaveNow,350);}

  function ensureAudio(){if(!profile.settings.audio)return null;try{audioCtx=audioCtx||new (window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume();return audioCtx;}catch{return null;}}
  function tone(freq=440,dur=.07,type='square',vol=.04,delay=0){const c=ensureAudio();if(!c)return;const o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(0.0001,c.currentTime+delay);g.gain.exponentialRampToValueAtTime(vol,c.currentTime+delay+.008);g.gain.exponentialRampToValueAtTime(.0001,c.currentTime+delay+dur);o.connect(g).connect(c.destination);o.start(c.currentTime+delay);o.stop(c.currentTime+delay+dur+.02);}

  function startCrowd(){
    if(!profile.settings.audio||crowdSource)return;const c=ensureAudio();if(!c)return;
    try{const len=Math.floor(c.sampleRate*2),buf=c.createBuffer(1,len,c.sampleRate),d=buf.getChannelData(0);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*(.45+.25*Math.sin(i/1700));const src=c.createBufferSource(),filter=c.createBiquadFilter(),gain=c.createGain();filter.type='lowpass';filter.frequency.value=480;gain.gain.value=.006;src.buffer=buf;src.loop=true;src.connect(filter).connect(gain).connect(c.destination);src.start();crowdSource=src;crowdGain=gain;}catch{}
  }
  function stopCrowd(){try{crowdSource?.stop();}catch{}crowdSource=null;crowdGain=null;}
  function crowdLevel(flow=1){if(crowdGain&&audioCtx){const target=Math.min(.018,.005+Math.max(0,flow-1)*.0025);crowdGain.gain.setTargetAtTime(target,audioCtx.currentTime,.12);}}

  function sfx(kind){if(!profile.settings.audio)return;if(kind==='card'){tone(220,.045,'square',.025);tone(330,.05,'triangle',.018,.025);}else if(kind==='combo'){tone(420,.08,'triangle',.035);tone(630,.09,'triangle',.028,.04);}else if(kind==='goal'){[330,440,660,880].forEach((f,i)=>tone(f,.16,'square',.03,i*.045));}else if(kind==='bad'){tone(140,.13,'sawtooth',.025);}else if(kind==='win'){[330,415,523,660].forEach((f,i)=>tone(f,.22,'triangle',.035,i*.08));}else tone(280,.045,'square',.018);}

  function toast(msg){toastEl.textContent=msg;toastEl.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toastEl.classList.remove('show'),1700);}
  function particles(kind='normal',count=14){if(profile.settings.reducedMotion)return;const rect=shell.getBoundingClientRect();for(let i=0;i<count;i++){const p=document.createElement('i');p.className='qd-particle';const x=rect.width*(.35+Math.random()*.3),y=rect.height*(.32+Math.random()*.2);p.style.left=`${x}px`;p.style.top=`${y}px`;p.style.setProperty('--x',`${(Math.random()-.5)*260}px`);p.style.setProperty('--y',`${(Math.random()-.5)*190}px`);if(kind==='goal')p.style.background='#8cffaa';if(kind==='gold')p.style.background='#ffd86e';fx.appendChild(p);setTimeout(()=>p.remove(),850);}}
  function floatText(text,kind=''){const el=document.createElement('div');el.className=`qd-float-score ${kind}`;el.textContent=text;el.style.left=`${44+Math.random()*12}%`;el.style.top=`${38+Math.random()*12}%`;fx.appendChild(el);setTimeout(()=>el.remove(),1100);}
  function shake(big=false){if(!profile.settings.screenShake)return;shell.classList.remove('shake');void shell.offsetWidth;shell.classList.add('shake');setTimeout(()=>shell.classList.remove('shake'),300);if(big){shell.classList.add('big-combo');setTimeout(()=>shell.classList.remove('big-combo'),600);}}

  function setStatus(text){topStatus.textContent=text;}
  function render(){
    if(!dialog.open)return;if(run?.phase==='match')startCrowd();else stopCrowd();
    if(uiMode==='library')return renderLibrary();
    if(uiMode==='tactics'&&run)return renderTactics();
    if(!run||uiMode==='menu')return renderMenu();
    if(run.phase==='event'&&run.pendingEvent)return renderEvent();
    if(run.phase==='match')return renderMatch();
    if(run.phase==='result')return uiMode==='reward'?renderReward():renderResult();
    if(run.phase==='run_end')return renderRunEnd();
    renderHub();
  }

  function renderMenu(){
    uiMode='menu';setStatus('DECKBUILDING ROGUELITE · CLUB MANAGEMENT');
    const canContinue=run&&!run.finished;
    /*
      IMPORTANT: this screen intentionally uses DIVs plus critical inline layout styles.
      The parent Repo Company site has legacy generic section/panel rules. Those rules can
      resize nested <section> elements, which previously collapsed this menu into a tiny
      vertical strip. Keeping the launch screen self-contained makes the CTA reliable.
    */
    root.innerHTML=`<div class="qd-screen qd-director-menu" style="position:absolute;inset:0;display:grid;grid-template-columns:minmax(0,1fr) 330px;grid-template-rows:minmax(0,1fr);gap:18px;padding:26px;width:auto;height:auto;min-width:0;min-height:0;box-sizing:border-box;overflow:auto;">
      <div class="qd-director-launch qd-panel" style="grid-column:1;grid-row:1;position:relative;width:auto;max-width:none;min-width:0;min-height:560px;display:flex;align-items:center;padding:clamp(34px,5vw,74px);box-sizing:border-box;overflow:hidden;">
        <div class="qd-director-pitch" aria-hidden="true"><i></i><i></i><i></i></div>
        <div class="qd-director-launch-copy" style="position:relative;z-index:4;display:block;width:min(720px,74%);max-width:720px;min-width:520px;box-sizing:border-box;">
          <span class="qd-kicker">BUILD A CLUB · BREAK THE SPORT</span>
          <h1 class="qd-heading" style="white-space:normal;word-break:normal;overflow-wrap:normal;">QUIDDITCH <em>DIRECTOR</em></h1>
          <p class="qd-sub" style="white-space:normal;word-break:normal;overflow-wrap:normal;">Build a tactical deck, read the opponent, then turn each possession into a ridiculous combo chain. Every season drafts differently and every unlock gives you another dangerous idea to try.</p>
          <div class="qd-director-rules">
            <div><b>1</b><span>BUILD</span><small>Draft players, tactics, staff and relics.</small></div>
            <div><b>2</b><span>CHAIN</span><small>Spend Tempo and raise Formation Flow.</small></div>
            <div><b>3</b><span>BREAK IT</span><small>Retrigger, copy and multiply your best interactions.</small></div>
          </div>
          <div class="qd-director-cta" style="display:flex;flex-wrap:wrap;gap:10px;margin-top:24px;position:relative;z-index:10;">
            <button class="qd-btn qd-primary-start" type="button" data-action="new-run" style="display:inline-flex;min-width:210px;min-height:50px;align-items:center;justify-content:center;">${canContinue?'START NEW SEASON':'START FIRST SEASON'}</button>
            ${canContinue?'<button class="qd-btn secondary" type="button" data-action="continue" style="display:inline-flex;min-width:190px;min-height:50px;align-items:center;justify-content:center;">CONTINUE SEASON</button>':''}
            <button class="qd-btn secondary" type="button" data-action="library" style="display:inline-flex;min-width:170px;min-height:50px;align-items:center;justify-content:center;">CARD LIBRARY</button>
          </div>
          <div class="qd-director-tip"><strong>HOW A MATCH WORKS</strong><span>Play cards with 1–5 or the mouse. Build Flow through smart role changes, then press SPACE to finish the possession and bank the chain.</span></div>
        </div>
      </div>
      <div class="qd-director-side" style="grid-column:2;grid-row:1;display:grid;align-content:center;gap:13px;width:330px;max-width:330px;min-width:0;box-sizing:border-box;">
        <div class="qd-panel qd-stat-card"><header><b>${esc(currentManager())}</b><small>${signedIn()?(cloudAvailable?'CLOUD SAVE':'LOCAL SAVE'):'GUEST SAVE'}</small></header><div class="qd-stat-grid"><div><span>RUNS</span><strong>${profile.runs||0}</strong></div><div><span>TITLES</span><strong>${profile.championships||0}</strong></div><div><span>BEST WINS</span><strong>${profile.bestSeasonWins||0}</strong></div><div><span>LEGACY</span><strong>${profile.legacy||0}</strong></div></div></div>
        <div class="qd-news"><b>DIRECTOR’S NOTE</b><br>Every completed run unlocks something permanent — usually stranger, not simply stronger. Your next broken idea may already be waiting in the library.</div>
        <div class="qd-panel qd-stat-card"><header><b>COLLECTION</b><small>DISCOVERY</small></header><div class="qd-stat-grid"><div><span>CARDS</span><strong>${profile.unlockedCards.length}/${D.cards.length}</strong></div><div><span>RELICS</span><strong>${profile.unlockedRelics.length}/${D.relics.length}</strong></div></div></div>
      </div>
    </div>`;
  }

  function renderHub(){
    uiMode='hub';setStatus(`SEASON · WEEK ${Math.min(6,run.week+1)} · ${run.wins}W ${run.losses}L`);run.bench=run.bench||[];
    const opp=D.opponents.find(o=>o.id===run.schedule[run.week])||D.opponents[0];
    const hist=new Map((Array.isArray(run.history)?run.history:[]).map(h=>[h.week,h]));
    const fixtures=run.schedule.map((id,i)=>{const o=D.opponents.find(x=>x.id===id)||D.opponents[0],h=hist.get(i);const cls=h?(h.won?'win':'loss'):(i===run.week?'current':i>run.week?'locked':'');return`<div class="qd-fixture ${cls}"><div class="qd-fixture-node" style="color:${o.colour}">${esc(o.crest)}</div><b>${esc(o.name)}</b><small>${h?(h.won?'WIN':'LOSS'):(i===run.week?'NEXT':i===5?'FINAL':`WEEK ${i+1}`)}</small></div>`;}).join('');
    const relics=(run.relics||[]).length?run.relics.map(id=>{const r=D.relicById[id];if(!r)return'';return`<div class="qd-relic-mini"><i>${esc(r.icon)}</i><div><b>${esc(r.name)}</b><small>${esc(r.text)}</small></div></div>`;}).join(''):'<div class="qd-news">No relics yet. Strange objects tend to appear after important fixtures.</div>';
    const deck=(run.deck||[]).slice(0,9).map(c=>{const d=D.cardById[c.id];if(!d)return'';return`<div class="qd-mini-card"><img src="${esc(d.image)}" alt=""><span>${esc(d.name)}${c.upgrade?` +${c.upgrade}`:''}</span></div>`;}).join('');
    root.innerHTML=`<div class="qd-screen qd-hub">
      <div class="qd-panel qd-sidebar"><div class="qd-manager-card"><div class="qd-manager-avatar">♜</div><strong>${esc(run.manager)}</strong><small>CLUB DIRECTOR</small></div><div class="qd-season-metrics"><div><span>WINS</span><b>${run.wins}</b></div><div><span>LOSSES</span><b>${run.losses}</b></div><div><span>FANS</span><b>${run.fanBase}</b></div><div><span>INSIGHT</span><b>${run.insight}</b></div><div><span>DECK</span><b>${run.deck.length}</b></div><div><span>RELICS</span><b>${run.relics.length}</b></div></div><div class="qd-relic-row">${relics}</div></div>
      <div class="qd-panel qd-season-board"><span class="qd-kicker">THE SEASON</span><h2>One fixture at a time.</h2><p class="qd-sub">Three regular-season wins qualify you for the Repo Cup Final. Losses teach; they do not delete your run.</p><div class="qd-fixtures">${fixtures}</div>
        <div class="qd-next-match"><div class="qd-opponent-title"><div class="qd-crest" style="color:${opp.colour}">${esc(opp.crest)}</div><div><small class="qd-kicker">NEXT OPPONENT · ${esc(opp.personality)}</small><h3>${esc(opp.name)}</h3><p>${esc(opp.blurb)}</p></div></div><button class="qd-btn" type="button" data-action="start-match">KICK OFF</button></div>
        <div class="qd-deck-strip" aria-label="Current deck preview">${deck}</div>
      </div>
      <div class="qd-hub-right"><div class="qd-panel qd-weather-card"><div class="weather-line"><span class="weather-icon">◌</span><div><small class="qd-kicker">MATCH CONDITIONS</small><b>REVEALED AT KICKOFF</b><p>Weather changes opportunities, never silently decides the match.</p></div></div></div><div class="qd-panel qd-scout"><h4>SCOUTING REPORT</h4><div class="qd-intel"><b>${esc(opp.personality)}</b><br>${esc(opp.blurb)}</div><div class="qd-intel">Opponent intent is revealed before every possession. Build around the counter, or ignore it and force your own combo.</div><button class="qd-btn secondary" type="button" data-action="tactics">TACTICS ROOM</button><button class="qd-btn secondary" type="button" data-action="abandon" style="margin-top:8px">END SEASON</button></div></div>
    </div>`;
  }

  function renderTactics(){
    setStatus(`TACTICS ROOM · ${run.insight} INSIGHT`);run.bench=run.bench||[];
    const active=run.deck.map(c=>deckManagerCard(c,'bench')).join('');const bench=run.bench.length?run.bench.map(c=>deckManagerCard(c,'restore')).join(''):'<div class="qd-news">Your bench is empty. Active deck minimum: 10 cards.</div>';
    root.innerHTML=`<section class="qd-screen qd-overlay-screen"><div class="qd-library-top"><div><span class="qd-kicker">CLUB MANAGEMENT</span><h2 class="qd-heading">TACTICS ROOM</h2><p class="qd-sub">Bench cards to tighten the deck. Spend 2 Insight to permanently upgrade a card for this run.</p></div><button class="qd-btn" data-action="hub">BACK TO FIXTURE</button></div><h3 style="color:#ffe0a0">ACTIVE DECK · ${run.deck.length}</h3><div class="qd-library-grid">${active}</div><h3 style="color:#ffe0a0">BENCH · ${run.bench.length}</h3><div class="qd-library-grid" style="max-height:260px">${bench}</div></section>`;
  }
  function deckManagerCard(c,mode){const d=D.cardById[c.id];return`<article class="qd-library-entry"><img src="${esc(d.image)}" alt=""><h4>${esc(d.name)} ${c.upgrade?`+${c.upgrade}`:''}</h4><p>${esc(d.text)}</p><div style="display:flex;gap:6px;margin-top:8px"><button class="qd-btn secondary" data-action="${mode}" data-uid="${esc(c.uid)}">${mode==='bench'?'BENCH':'RESTORE'}</button>${mode==='bench'?`<button class="qd-btn" data-action="upgrade" data-uid="${esc(c.uid)}" ${run.insight<2?'disabled':''}>UPGRADE · 2</button>`:''}</div></article>`;}

  function metric(label,val,max=40){return`<div class="qd-stat-meter"><label>${label}</label><b>${Math.round(val||0)}</b><i style="--w:${pct(val,max)}"></i></div>`;}
  function cardHtml(inst,index){const d=D.cardById[inst.id];let cost=E.effectiveCost(run,run.match,inst);if(inst.costDown)cost=Math.max(0,cost-inst.costDown);const disabled=cost>run.match.tempo;return`<article class="qd-card ${disabled?'disabled':''} ${index===controllerIndex?'qd-controller-focus':''}" data-type="${esc(d.type)}" data-play-index="${index}" title="${esc(d.text)}"><div class="qd-card-art"><img src="${esc(d.image)}" alt="${esc(d.name)}"></div><span class="qd-card-cost">${cost}</span>${inst.upgrade?`<span class="qd-card-upgrade">+${inst.upgrade}</span>`:''}<div class="qd-card-copy"><strong>${esc(d.name)}</strong><div class="qd-card-meta"><span>${esc(d.type)}</span><span>${esc(d.role)}</span></div><p>${esc(d.text)}</p></div><span class="qd-key-hint">${index+1}</span></article>`;}
  function commentaryLines(m){const base=(m.feed||[]).slice(-7);if(!base.length)base.push({text:'The whistle goes. Build a chain, then end the possession when you are happy with it.',kind:''});return base.map(x=>`<div class="qd-commentary-line ${esc(x.kind||'')}">${esc(x.text)}</div>`).join('');}

  function renderMatch(){
    const m=run?.match;
    if(!m){run.phase='hub';uiMode='hub';save();return renderHub();}
    const t=m.turn||{impact:0,momentum:0,control:0,style:0,fan:0,snitchGain:0,goals:0,critical:0,flow:1,finalMultiplier:1,roles:[],played:[],floating:[],rawImpactSinceGoal:0};
    m.turn=t;m.chain=Array.isArray(m.chain)?m.chain:[];m.log=Array.isArray(m.log)?m.log:[];m.hand=Array.isArray(m.hand)?m.hand:[];m.metrics=m.metrics||{momentum:0,control:0,style:0,fan:0,snitch:0,goals:0,critical:0,comboBest:1};
    t.roles=Array.isArray(t.roles)?t.roles:[];t.flow=Number.isFinite(Number(t.flow))?Number(t.flow):1;t.goals=Number(t.goals)||0;
    setStatus(`LIVE · POSSESSION ${m.possession}/${m.maxPossessions}`);startCrowd();crowdLevel(t.flow||1);
    const opp=D.opponents.find(o=>o.id===m.opponentId)||D.opponents[0],weather=D.weathers.find(w=>w.id===m.weatherId)||D.weathers[0];
    m.feed=Array.isArray(m.feed)?m.feed:[];
    // The tactical chain lives on match.chain. The original renderer read turn.chain,
    // which does not exist and caused kickoff + refreshed active matches to crash before rendering.
    const chain=m.chain.map((c,i)=>`${i?'<span class="qd-chain-link">›</span>':''}<div class="qd-chain-chip"><b>${esc(c.name)}</b><small>${esc(c.role)}</small></div>`).join('');
    const logs=m.log.slice(-5).reverse().map(x=>`<div><span>P${x.possession}</span><b>+${x.player}</b><span>THEM +${x.ai}</span></div>`).join('');
    const relics=(run.relics||[]).map(id=>{const r=D.relicById[id];return r?`<span class="qd-relic-badge" title="${esc(`${r.name}: ${r.text}`)}">${esc(r.icon)}</span>`:'';}).join('');
    const overlay=betweenPossessions?`<div class="qd-between-overlay"><div class="qd-panel qd-between-card"><span class="qd-kicker">POSSESSION ${betweenPossessions.possession} COMPLETE</span><h2 class="qd-heading" style="font-size:34px">+${betweenPossessions.player} vs +${betweenPossessions.ai}</h2><p class="qd-sub">Flow x${betweenPossessions.flow.toFixed(2)} · Countered ${betweenPossessions.counter} opponent pressure</p><button class="qd-btn" type="button" style="margin-top:14px" data-action="next-possession">NEXT POSSESSION</button></div></div>`:'';
    root.innerHTML=`<div class="qd-screen qd-match">
      <div class="qd-scorebar"><div class="qd-team"><div class="qd-team-crest" style="color:#75dfff">RC</div><div><b>REPO COMPANY</b><small>${m.playerGoals} GOALS · ${Math.round(m.metrics.fan||0)} FAN PRESSURE</small></div></div><div class="qd-score-center"><div class="qd-score-numbers">${Number(m.playerScore||0).toLocaleString()} <span style="color:#496675">—</span> ${Number(m.aiScore||0).toLocaleString()}</div><small>PERFORMANCE · ${esc(weather.icon)} ${esc(weather.name)}</small></div><div class="qd-team away"><div><b>${esc(opp.name)}</b><small>${m.aiGoals} GOALS · ${esc(opp.personality)}</small></div><div class="qd-team-crest" style="color:${opp.colour}">${esc(opp.crest)}</div></div></div>
      <div class="qd-match-main"><div class="qd-panel qd-match-left"><span class="qd-kicker">THIS POSSESSION</span><div class="qd-stat-stack">${metric('MOMENTUM',t.momentum)}${metric('CONTROL',t.control)}${metric('STYLE',t.style)}${metric('FAN PRESSURE',t.fan)}${metric('BEATER PRESSURE',t.pressure||0)}</div><div class="qd-intent-card"><small>OPPONENT INTENT</small><strong>${esc(m.intent?.name||'Balanced Formation')}</strong><p>${esc(m.intent?.text||'Build your best chain.')}</p></div><div class="qd-relic-badges">${relics}</div></div>
      <div class="qd-match-stage"><div class="qd-hoop l"></div><div class="qd-hoop r"></div><div class="qd-combo-orbit"><div class="qd-flow-display"><small>FORMATION FLOW</small><strong>x${t.flow.toFixed(2)}</strong><em>${t.goals?`${t.goals} GOAL${t.goals===1?'':'S'} THIS CHAIN`:`${new Set(t.roles).size} UNIQUE ROLES`}</em></div></div><div class="qd-chain">${chain||'<div class="qd-chain-chip"><b>BUILD YOUR CHAIN</b><small>PLAY A CARD</small></div>'}</div>${overlay}</div>
      <div class="qd-panel qd-match-right"><span class="qd-kicker">LIVE COMMENTARY</span><div class="qd-commentary">${commentaryLines(m)}</div><div class="qd-possession-log">${logs}</div></div></div>
      <div class="qd-hand-zone"><div class="qd-resource-box"><div class="qd-tempo"><span>TEMPO</span><strong>${m.tempo}/${m.maxTempo}</strong></div><div><span class="qd-kicker">SNITCH PRESSURE · ${Math.round(m.snitchMeter||0)}/30</span><div class="qd-snitch-track" style="--w:${pct(m.snitchMeter,30)}"><i></i></div></div><small class="qd-sub" style="font-size:8px">1–5 play cards · SPACE ends possession</small></div><div class="qd-hand">${m.hand.map(cardHtml).join('')||'<div class="qd-news">No cards in hand. End the possession.</div>'}</div><div class="qd-hand-actions"><button class="qd-btn secondary" type="button" data-action="mulligan" ${m.mulliganUsed||m.tempo<1||betweenPossessions?'disabled':''}>TACTICAL RESET · 1</button><button class="qd-btn qd-end-button" type="button" data-action="end-possession" ${betweenPossessions?'disabled':''}>END POSSESSION<strong>SPACE</strong></button><div class="qd-mulligan-info">Reset redraws your hand once per possession. It costs Tempo so it is never free.</div></div></div>
    </div>`;
  }

  function renderResult(){
    const m=run.match,opp=D.opponents.find(o=>o.id===m.opponentId);setStatus(m.won?'MATCH WON':'MATCH LOST');
    root.innerHTML=`<section class="qd-screen qd-overlay-screen"><div class="qd-panel qd-result-board"><span class="qd-kicker">${m.won?'FULL TIME · VICTORY':'FULL TIME · LESSON LEARNED'}</span><h1 class="qd-heading">${m.won?'THE CHAIN HELD.':'THEY READ YOU.'}</h1><p class="qd-sub">${m.won?'Your club built the stronger tactical performance.':'No run is dead from one loss. Your next draft can change the entire build.'}</p><div class="qd-result-score"><strong>${m.playerScore.toLocaleString()}</strong><span>REPO COMPANY<br>vs<br>${esc(opp.name)}</span><strong>${m.aiScore.toLocaleString()}</strong></div><div class="qd-result-metrics"><div><small>GOALS</small><b>${m.playerGoals}</b></div><div><small>BEST FLOW</small><b>x${m.metrics.comboBest.toFixed(2)}</b></div><div><small>SNITCH</small><b>${Math.round(m.snitchMeter)}</b></div><div><small>CRITICAL PLAYS</small><b>${m.metrics.critical}</b></div></div><button class="qd-btn" data-action="show-reward">${run.pendingReward?.type==='relic'?'OPEN RELIC ROOM':'OPEN CARD DRAFT'}</button></div></section>`;
  }

  function renderReward(){
    const r=run.pendingReward;if(!r){uiMode='hub';return render();}setStatus(r.type==='relic'?'RELIC DISCOVERY':'POST-MATCH DRAFT');
    if(r.type==='card'){
      const choices=r.options.map(id=>{const c=D.cardById[id];return`<article class="qd-reward-card" data-reward="${esc(id)}"><img src="${esc(c.image)}" alt=""><div class="copy"><small>${esc(c.type)} · ${esc(c.role)} · COST ${c.cost}</small><h3>${esc(c.name)}</h3><p>${esc(c.text)}</p></div></article>`;}).join('');
      root.innerHTML=`<section class="qd-screen qd-overlay-screen"><div class="qd-overlay-head"><span class="qd-kicker">ADD ONE CARD</span><h1 class="qd-heading">Change the shape of the run.</h1><p class="qd-sub">Choose for interactions, not raw numbers. The strongest card is the one your current deck can abuse.</p></div><div class="qd-choice-grid">${choices}</div><div style="text-align:center;margin-top:18px"><button class="qd-btn secondary" data-action="skip-reward">SKIP · +1 INSIGHT</button></div></section>`;
    }else{
      const choices=r.options.map(id=>{const x=D.relicById[id];return`<article class="qd-relic-choice" data-reward="${esc(id)}"><div class="icon">${esc(x.icon)}</div><small class="qd-kicker">RUN RELIC</small><h3>${esc(x.name)}</h3><p>${esc(x.text)}</p></article>`;}).join('');
      root.innerHTML=`<section class="qd-screen qd-overlay-screen"><div class="qd-overlay-head"><span class="qd-kicker">CHOOSE ONE</span><h1 class="qd-heading">Something deeply irresponsible.</h1><p class="qd-sub">Relics rewrite rules. Pick the one that makes you rethink the deck you already built.</p></div><div class="qd-choice-grid">${choices}</div><div style="text-align:center;margin-top:18px"><button class="qd-btn secondary" data-action="skip-reward">WALK AWAY · +1 INSIGHT</button></div></section>`;
    }
  }

  function renderEvent(){
    const ev=run.pendingEvent;setStatus('CLUB EVENT · NO OBVIOUS ANSWER');
    root.innerHTML=`<section class="qd-screen qd-overlay-screen"><div class="qd-panel qd-event-card"><span class="qd-kicker">BETWEEN FIXTURES</span><h1 class="qd-heading">${esc(ev.title)}</h1><div class="qd-event-flavour">${esc(ev.flavour)}</div><div class="qd-event-options">${ev.choices.map((c,i)=>`<button class="qd-event-option" data-event-choice="${i}"><b>${esc(c.label)}</b><span>${esc(c.desc)}</span></button>`).join('')}</div></div></section>`;
  }

  function renderRunEnd(){
    if(!run.metaGranted){run.metaUnlocks=E.grantMetaUnlocks(profile,run);run.metaGranted=true;save();}
    setStatus(run.champion?'CHAMPIONS':'SEASON COMPLETE');
    const unlocks=(run.metaUnlocks||[]).map(u=>`<div class="qd-unlock-banner"><span class="qd-kicker">PERMANENT UNLOCK</span><br><b>${esc(u.name)}</b>${u.type==='card'&&D.cardById[u.id]?`<br><small>${esc(D.cardById[u.id].text)}</small>`:''}</div>`).join('');
    root.innerHTML=`<section class="qd-screen qd-overlay-screen"><div class="qd-panel qd-result-board"><span class="qd-kicker">${run.champion?'REPO CUP CHAMPIONS':'THE BOARD MEETS'}</span><h1 class="qd-heading">${run.champion?'YOU BROKE QUIDDITCH.':'ONE MORE SEASON?'}</h1><p class="qd-sub">${run.champion?'The trophy is yours. The dangerous part is that you now have new toys to try.':run.qualified?'The final got away, but the build taught you something useful.':'You missed the final this time. The next unlock changes what is possible.'}</p><div class="qd-result-metrics"><div><small>WINS</small><b>${run.wins}</b></div><div><small>LOSSES</small><b>${run.losses}</b></div><div><small>FANS</small><b>${run.fanBase}</b></div><div><small>DECK SIZE</small><b>${run.deck.length}</b></div></div>${unlocks}<div style="display:flex;justify-content:center;gap:9px;margin-top:18px"><button class="qd-btn" data-action="new-run">NEW SEASON</button><button class="qd-btn secondary" data-action="menu">MAIN MENU</button></div></div></section>`;
  }

  function renderLibrary(){
    setStatus('CARD LIBRARY · DISCOVERIES');const unlocked=new Set(profile.unlockedCards);const entries=D.cards.map(c=>`<article class="qd-library-entry ${unlocked.has(c.id)?'':'locked'}"><img src="${unlocked.has(c.id)?esc(c.image):'assets/quidditch-tcg/card-back.png'}" alt=""><h4>${unlocked.has(c.id)?esc(c.name):'???'}</h4><p>${unlocked.has(c.id)?esc(c.text):'Complete another season to unlock a new tactical possibility.'}</p></article>`).join('');
    root.innerHTML=`<section class="qd-screen qd-library"><div class="qd-library-top"><div><span class="qd-kicker">${profile.unlockedCards.length}/${D.cards.length} UNLOCKED</span><h2 class="qd-heading" style="font-size:34px">DIRECTOR’S CARD LIBRARY</h2></div><button class="qd-btn" data-action="menu">BACK</button></div><div class="qd-library-grid">${entries}</div></section>`;
  }

  function addFeed(text,kind=''){const m=run?.match;if(!m)return;m.feed=m.feed||[];m.feed.push({text,kind});if(m.feed.length>18)m.feed.shift();}
  function onPlay(index){if(betweenPossessions)return;const m=run.match,inst=m.hand[index],def=inst&&D.cardById[inst.id];const beforeFlow=m.turn.flow,beforeGoals=m.turn.goals;const res=E.playCard(run,index);if(!res?.ok){sfx('bad');return toast(res?.reason||'Cannot play that card.');}sfx('card');addFeed(`${def.name} enters the chain. ${def.role} shape established.`);for(const e of res.events||[]){addFeed(e.text,['goal','snitch','critical'].includes(e.kind)?'goal':e.kind==='echo'?'big':'');if(e.kind==='goal'){sfx('goal');floatText(e.text,'goal');particles('goal',22);shake(true);}else if(e.kind==='critical'){sfx('combo');floatText(e.text,'critical');particles('gold',15);}else if(e.kind==='echo'){floatText('RETRIGGER','');}}
    if(m.turn.flow-beforeFlow>=.2){sfx('combo');floatText(`FLOW x${m.turn.flow.toFixed(2)}`);particles('normal',8);}if(m.turn.goals>beforeGoals)shake(true);save();controllerIndex=Math.min(controllerIndex,Math.max(0,m.hand.length-1));renderMatch();
  }
  function onEndPossession(){if(betweenPossessions)return;const m=run.match;const summary=E.endPossession(run);if(!summary)return;addFeed(`Possession ${summary.possession}: Repo +${summary.player}, ${D.opponents.find(o=>o.id===m.opponentId).name} +${summary.ai}.`,summary.big?'big':'');if(summary.big){sfx('goal');particles('gold',30);shake(true);}else sfx('combo');save();if(m.finished){betweenPossessions=null;uiMode='result';sfx(m.won?'win':'bad');renderResult();}else{betweenPossessions=summary;renderMatch();}}

  function actuallyNewSeason(){run=E.newRun(profile,currentManager());profile.activeRun=run;uiMode='hub';save();sfx('ui');renderHub();}
  function ask(title,text,yesLabel,onYes){let h=dialog.querySelector('.qd-confirm');h?.remove();h=document.createElement('div');h.className='qd-help qd-confirm';h.innerHTML=`<div class="qd-panel qd-help-card"><span class="qd-kicker">DIRECTOR DECISION</span><h2 class="qd-heading" style="font-size:30px">${esc(title)}</h2><p class="qd-sub">${esc(text)}</p><div style="display:flex;gap:8px;margin-top:16px"><button class="qd-btn danger" data-confirm-yes>${esc(yesLabel)}</button><button class="qd-btn secondary" data-confirm-no>KEEP PLAYING</button></div></div>`;dialog.querySelector('.qd-shell').appendChild(h);h.querySelector('[data-confirm-no]').onclick=()=>h.remove();h.querySelector('[data-confirm-yes]').onclick=()=>{h.remove();onYes();};}
  function newSeason(){if(run&&!run.finished)return ask('Abandon the current season?','Your current in-run deck and fixture progress will be lost. Permanent collection unlocks remain.','START NEW SEASON',actuallyNewSeason);actuallyNewSeason();}
  function abandon(){ask('End the season now?','The board will close the run immediately. You will still receive the normal end-of-run unlock.','END SEASON',()=>{run.finished=true;run.phase='run_end';run.champion=false;save();renderRunEnd();});}

  root.addEventListener('click',e=>{
    const play=e.target.closest('[data-play-index]');if(play){onPlay(Number(play.dataset.playIndex));return;}
    const reward=e.target.closest('[data-reward]');if(reward){const id=reward.dataset.reward;if(E.takeReward(run,id,profile)){sfx('win');save();uiMode='hub';render();}return;}
    const evt=e.target.closest('[data-event-choice]');if(evt){const c=E.applyEvent(run,Number(evt.dataset.eventChoice),profile);if(c){sfx('combo');toast(c.label);save();render();}return;}
    const a=e.target.closest('[data-action]');if(!a)return;const action=a.dataset.action;sfx('ui');
    if(action==='new-run')newSeason();
    else if(action==='continue'){uiMode='hub';render();}
    else if(action==='menu'){uiMode='menu';renderMenu();}
    else if(action==='library'){uiMode='library';renderLibrary();}
    else if(action==='hub'){uiMode='hub';renderHub();}
    else if(action==='tactics'){uiMode='tactics';renderTactics();}
    else if(action==='start-match'){betweenPossessions=null;E.startMatch(run);controllerIndex=0;save();addFeed('Kickoff. The opponent has shown their intent before you commit a card.');renderMatch();}
    else if(action==='end-possession')onEndPossession();
    else if(action==='next-possession'){betweenPossessions=null;controllerIndex=0;renderMatch();}
    else if(action==='mulligan'){const r=E.mulligan(run);if(r.ok){addFeed('Tactical Reset: fresh hand, one Tempo spent.');save();renderMatch();}else toast(r.reason);}
    else if(action==='show-reward'){uiMode='reward';renderReward();}
    else if(action==='skip-reward'){run.insight++;E.skipReward(run);save();uiMode='hub';render();}
    else if(action==='abandon')abandon();
    else if(action==='bench'){run.bench=run.bench||[];if(run.deck.length<=10)return toast('Active deck needs at least 10 cards.');const idx=run.deck.findIndex(c=>c.uid===a.dataset.uid);if(idx>=0){run.bench.push(run.deck.splice(idx,1)[0]);save();renderTactics();}}
    else if(action==='restore'){run.bench=run.bench||[];const idx=run.bench.findIndex(c=>c.uid===a.dataset.uid);if(idx>=0){run.deck.push(run.bench.splice(idx,1)[0]);save();renderTactics();}}
    else if(action==='upgrade'){const c=cardByUid(a.dataset.uid);if(c&&run.insight>=2){run.insight-=2;c.upgrade=(c.upgrade||0)+1;toast(`${D.cardById[c.id].name} upgraded.`);save();renderTactics();}}
  });

  function keyHandler(e){if(!dialog.open)return;if(e.target&&/input|textarea|select/i.test(e.target.tagName))return;if(run?.phase==='match'&&!betweenPossessions){if(/^[1-5]$/.test(e.key)){e.preventDefault();onPlay(Number(e.key)-1);return;}if(e.code==='Space'){e.preventDefault();onEndPossession();return;}if(e.key==='ArrowLeft'){controllerIndex=Math.max(0,controllerIndex-1);renderMatch();return;}if(e.key==='ArrowRight'){controllerIndex=Math.min((run.match.hand.length||1)-1,controllerIndex+1);renderMatch();return;}}
    if(e.key==='Escape'&&dialog.open){e.preventDefault();closeGame();}}
  document.addEventListener('keydown',keyHandler);

  function pollGamepad(){if(!dialog.open){gamepadFrame=null;return;}const pad=navigator.getGamepads?.()[0];if(pad){const now=pad.buttons.map(b=>b.pressed);const pressed=i=>now[i]&&!prevPad[i];if(run?.phase==='match'&&!betweenPossessions){if(pressed(14)){controllerIndex=Math.max(0,controllerIndex-1);renderMatch();}if(pressed(15)){controllerIndex=Math.min((run.match.hand.length||1)-1,controllerIndex+1);renderMatch();}if(pressed(0))onPlay(controllerIndex);if(pressed(2))onEndPossession();if(pressed(3)){const r=E.mulligan(run);if(r.ok){save();renderMatch();}}}if(pressed(1)&&uiMode==='menu'&&run&&!run.finished){uiMode='hub';render();}prevPad=now;}gamepadFrame=requestAnimationFrame(pollGamepad);}

  function help(open=true){let h=dialog.querySelector('.qd-help');if(!open){h?.remove();return;}if(h)return;h=document.createElement('div');h.className='qd-help';h.innerHTML=`<div class="qd-panel qd-help-card"><span class="qd-kicker">FIVE-MINUTE RULES</span><h2 class="qd-heading" style="font-size:32px">Build a chain. Break expectations.</h2><p class="qd-sub">Each possession gives you Tempo. Cards create Impact and tactical stats, while surprising role transitions increase <b>Flow</b>. End the possession to convert the chain into Match Performance.</p><div class="qd-help-grid"><div><b>FLOW</b><span>Your main multiplier. Diverse, intentional chains create explosive scores.</span></div><div><b>OPPONENT INTENT</b><span>Always visible. Counter it for a fair advantage, or overpower it with your build.</span></div><div><b>SNITCH PRESSURE</b><span>Persists through the match and unlocks huge Legendary Play interactions.</span></div><div><b>1–5 / SPACE</b><span>Keyboard: play hand cards with 1–5, end possession with Space. Controller A plays, X ends.</span></div></div><button class="qd-btn" style="margin-top:14px" data-close-help>CLOSE</button></div>`;dialog.querySelector('.qd-shell').appendChild(h);h.querySelector('[data-close-help]').onclick=()=>h.remove();}

  async function openGame(){localLoad();document.getElementById('qdAudioToggle').textContent=profile.settings.audio?'SOUND':'MUTED';ensureAudio();dialog.showModal();uiMode=run&&!run.finished?'hub':'menu';render();cloudLoad().then(()=>{if(dialog.open)render();});if(!gamepadFrame)gamepadFrame=requestAnimationFrame(pollGamepad);}
  // Stable public launcher used by the parent Repo Company page. Keeping this explicit means
  // the Director button does not depend on timing between classic scripts and ES modules.
  globalThis.QD_OPEN=()=>openGame();
  globalThis.dispatchEvent(new CustomEvent('qd:ready'));
  function closeGame(){save();stopCrowd();dialog.close();help(false);if(gamepadFrame){cancelAnimationFrame(gamepadFrame);gamepadFrame=null;}prevPad=[];}
  // Quidditch Director uses its own launcher ID. The legacy #openPetWars element remains hidden in index.html solely so the parent site can initialise safely.
  openButton.addEventListener('click',event=>{
    event.preventDefault();
    event.stopImmediatePropagation();
    openGame();
  },true);
  document.getElementById('qdClose').onclick=closeGame;
  document.getElementById('qdHelpButton').onclick=()=>help(true);
  document.getElementById('qdAudioToggle').onclick=()=>{profile.settings.audio=!profile.settings.audio;document.getElementById('qdAudioToggle').textContent=profile.settings.audio?'SOUND':'MUTED';if(!profile.settings.audio)stopCrowd();else if(run?.phase==='match')startCrowd();save();if(profile.settings.audio)sfx('ui');};
  dialog.addEventListener('close',()=>{save();if(gamepadFrame){cancelAnimationFrame(gamepadFrame);gamepadFrame=null;}});
  dialog.addEventListener('cancel',e=>{e.preventDefault();closeGame();});

  runtime.debugState=()=>({profile,run,uiMode,betweenPossessions,cloudAvailable,replay:E.exportReplay?.(),stats:services.statistics.snapshot()});
  services.developerConsole.setStateProvider(runtime.debugState);
  services.developerConsole.register('replay',()=>E.exportReplay?.());
  localLoad();
})();
