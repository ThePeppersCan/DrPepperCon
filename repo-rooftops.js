(() => {
  'use strict';

  const byId = id => document.getElementById(id);
  const dialog = byId('repoRooftopsDialog');
  if (!dialog) return;

  const W = 960;
  const H = 640;
  const PX_PER_METRE = 5;
  const RUN_CAP_GP = 6250;
  const PB_CAP_GP = 2500;
  const MIN_HEIGHT_GP = 50;
  const MIN_LEVELS_GP = 5;
  const DISTRICT_STEP = 250;
  const CHECKPOINT_STEP = 250;
  const MODES = ['endless', 'daily', 'hardcore', 'timetrial', 'practice'];
  const LONDON_TZ = 'Europe/London';

  const DISTRICTS = [
    {id:'old-town', name:'Old Town Rooftops', sky:['#17314b','#7b5a45','#17151a'], far:'#25384a', near:'#101923', accent:'#e7b860', weather:'clear'},
    {id:'clockwork', name:'Clockwork Industrial District', sky:['#232b35','#755a3f','#18181a'], far:'#3b3d40', near:'#181b1d', accent:'#e59a48', weather:'steam'},
    {id:'stormside', name:'Stormside Heights', sky:['#121c31','#32475f','#10131c'], far:'#253245', near:'#0b111b', accent:'#8bd7ff', weather:'rain'},
    {id:'frozen', name:'Frozen Skyline', sky:['#557a96','#a8c7d6','#263748'], far:'#6d8797', near:'#233542', accent:'#d9f6ff', weather:'snow'},
    {id:'furnace', name:'Furnace Quarter', sky:['#321410','#9a3b1d','#170c0b'], far:'#43201a', near:'#1b0e0c', accent:'#ff9d43', weather:'embers'},
    {id:'arcane', name:'Arcane Rooftops', sky:['#20153c','#4b2f6d','#0d0a18'], far:'#35234f', near:'#151025', accent:'#c59bff', weather:'runes'},
    {id:'void', name:'The Void Skyline', sky:['#05050e','#1e1431','#020206'], far:'#171125', near:'#09070f', accent:'#ac7cff', weather:'void'}
  ];

  const DIFFICULTY_TIERS = [
    [0,'Beginner'],[100,'Tricky'],[300,'Dangerous'],[600,'Severe'],[1000,'Brutal'],[1500,'Nightmare'],[2100,'Endless Corruption I'],[2800,'Endless Corruption II'],[3600,'Endless Corruption III'],[4600,'Endless Corruption IV']
  ];

  const DEFAULT_CHARACTER = {
    name:'Rooftop Runner', body:'standard', skin:'#d39a6b', face:'determined', hair:'messy', hairColor:'#3a251b',
    top:'jacket', bottom:'trousers', headwear:'none', accessory:'scarf', primary:'#24516c', secondary:'#c68b3c', trim:'#e6d39b', archetype:'City Adventurer'
  };

  const DEFAULT_SETTINGS = {
    masterVolume:.65, musicVolume:.35, sfxVolume:.75, ambienceVolume:.4,
    screenShake:true, reducedParticles:false, reducedFlashing:false, highContrast:false,
    simplifiedBackground:false, mobileControls:'auto', performanceMode:false, hudScale:1,
    keys:{left:'KeyA',right:'KeyD',jump:'Space',dash:'ShiftLeft',down:'KeyS',interact:'KeyE',pause:'Escape',restart:'KeyR'}
  };

  const ACHIEVEMENTS = [
    ['height_100','Street Above Street','Reach 100 metres.'],
    ['height_500','Cloudline Runner','Reach 500 metres.'],
    ['height_1000','Skyline Sovereign','Reach 1,000 metres.'],
    ['height_2000','Above the Weather','Reach 2,000 metres.'],
    ['levels_100','Rooftop Regular','Complete 100 rooftop levels in one run.'],
    ['first_mark','Grace Found','Collect your first Mark of Grace.'],
    ['multi_mark','Graceful Run','Collect multiple Marks in one run.'],
    ['nightmare','No Sleep Tonight','Reach Nightmare difficulty.'],
    ['daily','Same Sky, New Record','Complete a Daily Rooftops run.'],
    ['districts','City Tour','Discover every major district.']
  ];

  const state = {
    profile:null,
    settings:structuredClone(DEFAULT_SETTINGS),
    character:structuredClone(DEFAULT_CHARACTER),
    view:'menu',
    panel:'',
    lastMode:'endless',
    run:null,
    raf:0,
    lastFrame:0,
    accumulator:0,
    menuRaf:0,
    menuTime:0,
    profileLoaded:false,
    pendingReward:null,
    audio:null,
    keyCapture:null,
    leaderboardMode:'endless',
    leaderboardPeriod:'all',
    mobilePointers:new Map(),
    confirmResolver:null
  };

  const canvas = byId('rrCanvas');
  const ctx = canvas.getContext('2d', {alpha:false});
  ctx.imageSmoothingEnabled = false;
  const previewCanvas = byId('rrMenuCharacter');
  const previewCtx = previewCanvas.getContext('2d');
  previewCtx.imageSmoothingEnabled = false;

  function clamp(v,min,max){return Math.max(min,Math.min(max,v));}
  function lerp(a,b,t){return a+(b-a)*t;}
  function easeOut(t){return 1-Math.pow(1-t,3);}
  function format(n){return Math.max(0,Math.floor(Number(n)||0)).toLocaleString('en-GB');}
  function escapeHtml(value){return String(value??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
  function londonDate(){return new Intl.DateTimeFormat('en-CA',{timeZone:LONDON_TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
  function seedHash(text){let h=2166136261>>>0;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
  function mulberry32(a){return function(){let t=a+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
  function makeId(prefix='rr'){return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,10)}`;}
  function show(el){el?.classList.remove('hidden');}
  function hide(el){el?.classList.add('hidden');}
  function isLoggedIn(){return typeof character !== 'undefined' && !!character;}
  function toastSafe(message,duration=2600){if(typeof toast==='function')toast(message,duration);else console.log(message);}
  function databaseErrorText(error){
    const raw=error?.message||error?.details||error?.hint||String(error||'Unknown database error');
    return String(raw).replace(/\s+/g,' ').trim().slice(0,240);
  }
  function wait(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
  async function rpcWithRetry(name,payload,attempts=3){
    let lastError=null;
    for(let attempt=0;attempt<attempts;attempt++){
      try{
        const {data,error}=await db.rpc(name,payload);
        if(error)throw error;
        return data;
      }catch(error){
        lastError=error;
        if(attempt<attempts-1)await wait(300*(attempt+1));
      }
    }
    throw lastError||new Error(`${name} failed`);
  }

  function setStatus(message, kind=''){
    const el=byId('rrMenuStatus');
    if(!el)return;
    el.className=`rr-status ${kind?`rr-run-${kind}`:''}`;
    el.textContent=message||'';
  }

  function settleRooftopsConfirm(value){
    const overlay=byId('rrConfirmOverlay');
    if(overlay)hide(overlay);
    const resolve=state.confirmResolver;
    state.confirmResolver=null;
    if(resolve)resolve(!!value);
  }

  function askRooftops({eyebrow='REPO ROOFTOPS',title='CONFIRM ACTION',message='',acceptLabel='CONFIRM',cancelLabel='CANCEL',danger=false}={}){
    if(state.confirmResolver)settleRooftopsConfirm(false);
    const overlay=byId('rrConfirmOverlay');
    if(!overlay)return Promise.resolve(false);
    byId('rrConfirmEyebrow').textContent=eyebrow;
    byId('rrConfirmTitle').textContent=title;
    byId('rrConfirmMessage').textContent=message;
    const accept=byId('rrConfirmAccept'),cancel=byId('rrConfirmCancel');
    accept.textContent=acceptLabel;cancel.textContent=cancelLabel;
    accept.classList.toggle('danger',!!danger);
    show(overlay);
    return new Promise(resolve=>{
      state.confirmResolver=resolve;
      accept.onclick=()=>settleRooftopsConfirm(true);
      cancel.onclick=()=>settleRooftopsConfirm(false);
      requestAnimationFrame(()=>accept.focus());
    });
  }

  function applyView(name){
    state.view=name;
    ['rrMenuView','rrPanelView','rrGameView','rrSummaryView'].forEach(id=>hide(byId(id)));
    const map={menu:'rrMenuView',panel:'rrPanelView',game:'rrGameView',summary:'rrSummaryView'};
    show(byId(map[name]));
    if(name==='menu')startMenuAnimation();else stopMenuAnimation();
  }

  async function ensureAudio(){
    if(state.audio)return state.audio;
    try{state.audio=new (window.AudioContext||window.webkitAudioContext)();}catch(_){return null;}
    return state.audio;
  }

  async function tone(type='jump', intensity=1){
    const ac=await ensureAudio();
    if(!ac||state.settings.masterVolume<=0||state.settings.sfxVolume<=0)return;
    if(ac.state==='suspended')await ac.resume().catch(()=>{});
    const now=ac.currentTime;
    const osc=ac.createOscillator(),gain=ac.createGain();
    const volume=.055*state.settings.masterVolume*state.settings.sfxVolume*intensity;
    const configs={jump:[260,460,.12,'square'],land:[130,80,.11,'triangle'],dash:[520,170,.09,'sawtooth'],coin:[620,920,.1,'square'],mark:[700,1320,.42,'sine'],death:[210,55,.55,'sawtooth'],checkpoint:[420,840,.38,'triangle'],click:[330,420,.05,'square'],shield:[240,980,.2,'sine']};
    const [f1,f2,dur,wave]=configs[type]||configs.click;
    osc.type=wave;osc.frequency.setValueAtTime(f1,now);osc.frequency.exponentialRampToValueAtTime(Math.max(20,f2),now+dur);
    gain.gain.setValueAtTime(volume,now);gain.gain.exponentialRampToValueAtTime(.0001,now+dur);
    osc.connect(gain);gain.connect(ac.destination);osc.start(now);osc.stop(now+dur+.02);
  }

  function profileDefaults(){
    return {best_height:0,best_level:0,mark_balance:0,total_runs:0,total_gp_earned:0,total_metres:0,total_playtime_ms:0,stats:{districts:[],deaths:0,best_momentum:0,marks_collected:0,daily_completed:0},achievements:{},character_config:structuredClone(DEFAULT_CHARACTER),settings:structuredClone(DEFAULT_SETTINGS)};
  }

  async function loadProfile(force=false){
    if(!isLoggedIn()){state.profile=profileDefaults();state.profileLoaded=true;return state.profile;}
    if(state.profileLoaded&&!force)return state.profile;
    setStatus('Loading rooftop profile…');
    try{
      const {data,error}=await db.rpc('repo_rooftops_get_profile');
      if(error)throw error;
      const row=Array.isArray(data)?data[0]:data;
      const base=profileDefaults();
      state.profile={...base,...(row||{}),stats:{...base.stats,...(row?.stats||{})},achievements:{...(row?.achievements||{})}};
      state.character={...DEFAULT_CHARACTER,...(row?.character_config||{})};
      state.settings={...DEFAULT_SETTINGS,...(row?.settings||{}),keys:{...DEFAULT_SETTINGS.keys,...(row?.settings?.keys||{})}};
      state.profileLoaded=true;
      setStatus('');
      return state.profile;
    }catch(error){
      console.warn('Repo Rooftops profile unavailable:',error);
      state.profile=profileDefaults();state.profileLoaded=true;
      try{
        const cached=JSON.parse(localStorage.getItem('repoRooftopsProfileCache')||'null');
        if(cached){state.character={...DEFAULT_CHARACTER,...cached.character};state.settings={...DEFAULT_SETTINGS,...cached.settings,keys:{...DEFAULT_SETTINGS.keys,...cached.settings?.keys}};}
      }catch(_){ }
      setStatus(`Repo Rooftops secure services are unavailable: ${databaseErrorText(error)}`, 'pending');
      return state.profile;
    }
  }

  function cacheProfile(){
    localStorage.setItem('repoRooftopsProfileCache',JSON.stringify({character:state.character,settings:state.settings}));
  }

  async function saveProfile(){
    cacheProfile();
    if(!isLoggedIn())return {ok:false};
    const {data,error}=await db.rpc('repo_rooftops_save_profile',{p_character:state.character,p_settings:state.settings});
    if(error){console.warn(error);return {ok:false,error};}
    return {ok:true,data};
  }

  function open(){
    if(!isLoggedIn()){toastSafe('Log in before opening Repo Rooftops.');return;}
    byId('agilityDialog')?.close();
    if(!dialog.open)dialog.showModal();
    applyView('menu');
    loadProfile(true).then(()=>renderMenu());
    retryPendingReward();
  }

  async function close(){
    if(state.run&&state.run.active){
      const leave=await askRooftops({
        eyebrow:'ACTIVE ROOFTOP RUN',
        title:'LEAVE THE ROOFTOPS?',
        message:'Your current run will end and unsaved provisional GP will be lost.',
        acceptLabel:'END RUN & CLOSE',
        cancelLabel:'KEEP PLAYING',
        danger:true
      });
      if(!leave)return;
      await finishRun('quit',false);
    }
    stopRunLoop();
    stopMenuAnimation();
    if(dialog.open)dialog.close();
  }

  function renderMenu(){
    const p=state.profile||profileDefaults();
    byId('rrMenuGp').textContent=format(character?.gp||0);
    byId('rrMenuMarks').textContent=format(p.mark_balance||0);
    byId('rrCharacterName').textContent=state.character.name||character?.username||'Adventurer';
    byId('rrCharacterArchetype').textContent=state.character.archetype||'City Adventurer';
    byId('rrBestHeight').textContent=format(p.best_height);
    byId('rrBestLevel').textContent=format(p.best_level);
    byId('rrTotalRuns').textContent=format(p.total_runs);
    byId('rrDistrictsFound').textContent=format((p.stats?.districts||[]).length);
    byId('rrTotalGp').textContent=format(p.total_gp_earned);
    drawMenuCharacter(performance.now()/1000);
  }

  function startMenuAnimation(){
    if(state.menuRaf)return;
    const loop=t=>{state.menuRaf=requestAnimationFrame(loop);state.menuTime=t/1000;drawMenuCharacter(state.menuTime);};
    state.menuRaf=requestAnimationFrame(loop);
  }
  function stopMenuAnimation(){cancelAnimationFrame(state.menuRaf);state.menuRaf=0;}

  function drawMenuCharacter(time){
    const c=previewCtx,w=previewCanvas.width,h=previewCanvas.height;
    c.clearRect(0,0,w,h);
    const grad=c.createLinearGradient(0,0,0,h);grad.addColorStop(0,'#294d65');grad.addColorStop(.55,'#0e2231');grad.addColorStop(1,'#061018');c.fillStyle=grad;c.fillRect(0,0,w,h);
    for(let i=0;i<22;i++){const x=(i*47+17)%w,y=(i*83+31)%190;c.fillStyle=`rgba(157,220,248,${.08+(i%3)*.03})`;c.fillRect(x,y,2,2);}
    c.fillStyle='#0c1720';c.fillRect(0,250,w,60);c.fillStyle='#1b2a32';for(let x=0;x<w;x+=42)c.fillRect(x,238+(x%84?8:0),38,20);
    c.save();c.translate(w/2,219+Math.sin(time*2)*2);drawRunner(c,state.character,0,0,3.2,1,'idle',time);c.restore();
  }

  function drawRunner(c,config,x,y,scale=1,dir=1,anim='idle',time=0,alpha=1){
    c.save();c.globalAlpha=alpha;c.translate(Math.round(x),Math.round(y));c.scale(dir*scale,scale);
    const bob=anim==='run'?Math.sin(time*18)*1.4:anim==='idle'?Math.sin(time*3)*.7:0;
    c.translate(0,bob);
    const bodyWidth=config.body==='broad'?9:config.body==='slim'?6:8;
    const outline='#071016',skin=config.skin||DEFAULT_CHARACTER.skin,primary=config.primary||'#24516c',secondary=config.secondary||'#c68b3c',trim=config.trim||'#e6d39b',hair=config.hairColor||'#3a251b';
    c.fillStyle=outline;c.fillRect(-5,-31,10,11);c.fillRect(-bodyWidth/2-1,-20,bodyWidth+2,13);c.fillRect(-bodyWidth/2-2,-10,bodyWidth+4,8);
    const legSwing=anim==='run'?Math.sin(time*18)*3:anim==='jump'?-2:anim==='fall'?2:0;
    c.fillStyle=outline;c.fillRect(-5,-3,4,10+Math.max(0,legSwing));c.fillRect(1,-3,4,10+Math.max(0,-legSwing));
    c.fillStyle=secondary;c.fillRect(-4,-3,3,8+Math.max(0,legSwing));c.fillRect(1,-3,3,8+Math.max(0,-legSwing));
    c.fillStyle=outline;c.fillRect(-6,5+Math.max(0,legSwing),5,3);c.fillRect(1,5+Math.max(0,-legSwing),5,3);c.fillStyle='#2a241e';c.fillRect(-5,5+Math.max(0,legSwing),4,2);c.fillRect(1,5+Math.max(0,-legSwing),4,2);
    c.fillStyle=primary;c.fillRect(-bodyWidth/2,-19,bodyWidth,-9+19);c.fillRect(-bodyWidth/2-1,-11,bodyWidth+2,7);
    c.fillStyle=trim;c.fillRect(-bodyWidth/2,-11,bodyWidth,1);c.fillRect(-1,-19,2,8);
    const armSwing=anim==='run'?Math.sin(time*18+Math.PI)*4:anim==='jump'?-4:0;
    c.fillStyle=outline;c.fillRect(-bodyWidth/2-4,-18+armSwing/3,4,11);c.fillRect(bodyWidth/2,-18-armSwing/3,4,11);c.fillStyle=primary;c.fillRect(-bodyWidth/2-3,-17+armSwing/3,2,8);c.fillRect(bodyWidth/2+1,-17-armSwing/3,2,8);c.fillStyle=skin;c.fillRect(-bodyWidth/2-3,-9+armSwing/3,2,3);c.fillRect(bodyWidth/2+1,-9-armSwing/3,2,3);
    c.fillStyle=skin;c.fillRect(-4,-29,8,8);c.fillStyle=outline;c.fillRect(2,-26,2,1);c.fillStyle='#f7f4de';c.fillRect(2,-27,1,1);
    if(config.face==='friendly'){c.fillStyle='#5b2d28';c.fillRect(1,-23,2,1);}else if(config.face==='mysterious'){c.fillStyle=outline;c.fillRect(-4,-28,8,3);}else if(config.face==='scarred'){c.fillStyle='#8c5548';c.fillRect(-2,-27,1,4);}
    c.fillStyle=hair;
    if(config.hair==='messy'){c.fillRect(-5,-33,10,4);c.fillRect(-6,-31,3,5);c.fillRect(1,-34,3,3);}else if(config.hair==='ponytail'){c.fillRect(-5,-33,10,4);c.fillRect(-6,-31,3,7);c.fillRect(-8,-28,3,8);}else if(config.hair==='curly'){c.fillRect(-6,-33,12,5);c.fillRect(-7,-31,3,6);c.fillRect(4,-31,3,5);}else if(config.hair==='spiked'){for(let i=0;i<5;i++)c.fillRect(-5+i*2,-34-(i%2),2,5);}else if(config.hair==='bald'){}else if(config.hair==='braids'){c.fillRect(-5,-33,10,4);c.fillRect(-7,-30,2,10);c.fillRect(5,-30,2,10);}
    if(config.headwear==='hood'){c.fillStyle=secondary;c.fillRect(-6,-34,12,5);c.fillRect(-7,-31,3,8);c.fillRect(4,-31,3,8);}else if(config.headwear==='bandana'){c.fillStyle=secondary;c.fillRect(-5,-31,10,2);c.fillRect(-8,-30,4,1);}else if(config.headwear==='goggles'){c.fillStyle='#9ee7ff';c.fillRect(-4,-28,3,2);c.fillRect(1,-28,3,2);c.fillStyle=outline;c.fillRect(-1,-28,2,1);}
    if(config.accessory==='scarf'){c.fillStyle=secondary;c.fillRect(-4,-21,8,2);c.fillRect(-7,-20,3,7);}else if(config.accessory==='cape'){c.fillStyle=secondary;c.fillRect(-bodyWidth/2-2,-19,3,15);}else if(config.accessory==='satchel'){c.strokeStyle=trim;c.lineWidth=1;c.beginPath();c.moveTo(-3,-19);c.lineTo(4,-7);c.stroke();c.fillStyle=secondary;c.fillRect(3,-10,4,5);}
    c.restore();
  }

  function openPanel(title,kind){
    state.panel=kind;byId('rrPanelTitle').textContent=title;applyView('panel');renderPanel();
  }

  function renderPanel(){
    const body=byId('rrPanelBody');
    if(state.panel==='modes')renderModes(body);
    else if(state.panel==='character')renderCharacterEditor(body);
    else if(state.panel==='leaderboards')renderLeaderboards(body);
    else if(state.panel==='stats')renderStats(body);
    else if(state.panel==='settings')renderSettings(body);
    else if(state.panel==='howto')renderHowTo(body);
  }

  function renderModes(body){
    const modes=[
      ['hardcore','HARDCORE MODE','Faster danger, fewer recovery rooftops and limited protection.','SEPARATE LEADERBOARD'],
      ['timetrial','TIME TRIAL','Climb as high as possible in three minutes.','3 MINUTES'],
      ['practice','PRACTICE MODE','Test movement and your character with no rewards or records.','NO REWARDS'],
      ['endless','ENDLESS MODE','The primary climb from the streets with full rewards.','FULL REWARDS']
    ];
    body.innerHTML=`<div class="rr-mode-grid">${modes.map(([id,name,desc,badge])=>`<article class="rr-mode-card"><b>${badge}</b><h4>${name}</h4><p>${desc}</p><button type="button" data-rr-mode="${id}">PLAY ${name.replace(' MODE','')}</button></article>`).join('')}</div>`;
    body.querySelectorAll('[data-rr-mode]').forEach(btn=>btn.addEventListener('click',()=>startRun(btn.dataset.rrMode)));
  }

  const SKINS=['#f3c9a4','#dca77a','#bd7f52','#8b5839','#5f392b','#3b241e'];
  const HAIR_COLORS=['#171513','#3a251b','#6f4226','#b66a2d','#e2bd70','#d66b3d','#9b283f','#d9d8d2','#5f4a9a'];
  const CLOTH_COLORS=['#24516c','#306a47','#6c2d36','#5a3f83','#7a5428','#1f232b','#c27b2d','#d5d5cf','#194663'];
  function options(list,current){return list.map(v=>`<option value="${v}" ${v===current?'selected':''}>${v.replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</option>`).join('');}
  function swatches(name,list,current){return `<div class="rr-swatches" data-rr-swatches="${name}">${list.map(v=>`<button type="button" class="rr-swatch ${v===current?'selected':''}" data-value="${v}" style="--swatch:${v}" aria-label="${v}"></button>`).join('')}</div>`;}

  function renderCharacterEditor(body){
    const c=state.character;
    body.innerHTML=`<div class="rr-character-editor">
      <section class="rr-character-preview-card"><canvas id="rrEditorCanvas" width="320" height="390"></canvas><button id="rrTestMovement" type="button">TEST MOVEMENT ROOM</button></section>
      <section class="rr-character-controls">
        <div class="rr-field rr-field-wide"><label>CHARACTER DISPLAY NAME</label><input id="rrEditName" maxlength="20" value="${escapeHtml(c.name)}"></div>
        <div class="rr-field"><label>BODY FRAME</label><select data-rr-char="body">${options(['slim','standard','broad'],c.body)}</select></div>
        <div class="rr-field"><label>FACE</label><select data-rr-char="face">${options(['friendly','determined','serious','mysterious','scarred'],c.face)}</select></div>
        <div class="rr-field"><label>HAIR</label><select data-rr-char="hair">${options(['messy','spiked','curly','ponytail','braids','bald'],c.hair)}</select></div>
        <div class="rr-field"><label>HEADWEAR</label><select data-rr-char="headwear">${options(['none','hood','bandana','goggles'],c.headwear)}</select></div>
        <div class="rr-field"><label>TOP</label><select data-rr-char="top">${options(['jacket','tunic','hoodie','robe','armour'],c.top)}</select></div>
        <div class="rr-field"><label>ACCESSORY</label><select data-rr-char="accessory">${options(['none','scarf','cape','satchel'],c.accessory)}</select></div>
        <div class="rr-field rr-field-wide"><label>SKIN TONE</label>${swatches('skin',SKINS,c.skin)}</div>
        <div class="rr-field rr-field-wide"><label>HAIR COLOUR</label>${swatches('hairColor',HAIR_COLORS,c.hairColor)}</div>
        <div class="rr-field rr-field-wide"><label>PRIMARY CLOTHING</label>${swatches('primary',CLOTH_COLORS,c.primary)}</div>
        <div class="rr-field rr-field-wide"><label>SECONDARY CLOTHING</label>${swatches('secondary',CLOTH_COLORS,c.secondary)}</div>
        <div class="rr-editor-actions"><button id="rrRandomiseCharacter" type="button">RANDOMISE</button><button id="rrResetCharacter" type="button">RESET</button><button id="rrSaveCharacter" type="button">SAVE CHARACTER</button></div>
      </section>
    </div>`;
    const editor=byId('rrEditorCanvas'),ec=editor.getContext('2d');ec.imageSmoothingEnabled=false;
    const draw=()=>{ec.clearRect(0,0,editor.width,editor.height);const g=ec.createLinearGradient(0,0,0,editor.height);g.addColorStop(0,'#284c64');g.addColorStop(1,'#061018');ec.fillStyle=g;ec.fillRect(0,0,editor.width,editor.height);ec.fillStyle='#0c1821';ec.fillRect(0,320,editor.width,70);ec.save();ec.translate(160,294);drawRunner(ec,state.character,0,0,4.2,1,'run',performance.now()/1000);ec.restore();};
    let editorRaf=0;const loop=()=>{if(state.panel!=='character')return;draw();editorRaf=requestAnimationFrame(loop)};loop();
    body.querySelectorAll('[data-rr-char]').forEach(sel=>sel.addEventListener('change',()=>{state.character[sel.dataset.rrChar]=sel.value;}));
    body.querySelectorAll('[data-rr-swatches]').forEach(group=>group.addEventListener('click',e=>{const b=e.target.closest('[data-value]');if(!b)return;state.character[group.dataset.rrSwatches]=b.dataset.value;group.querySelectorAll('.rr-swatch').forEach(x=>x.classList.toggle('selected',x===b));}));
    byId('rrEditName').addEventListener('input',e=>state.character.name=e.target.value.replace(/[^A-Za-z0-9 _-]/g,'').slice(0,20));
    byId('rrRandomiseCharacter').onclick=()=>{const pick=a=>a[Math.floor(Math.random()*a.length)];state.character={...state.character,body:pick(['slim','standard','broad']),face:pick(['friendly','determined','serious','mysterious','scarred']),hair:pick(['messy','spiked','curly','ponytail','braids','bald']),headwear:pick(['none','hood','bandana','goggles']),accessory:pick(['none','scarf','cape','satchel']),skin:pick(SKINS),hairColor:pick(HAIR_COLORS),primary:pick(CLOTH_COLORS),secondary:pick(CLOTH_COLORS)};renderCharacterEditor(body);};
    byId('rrResetCharacter').onclick=()=>{state.character=structuredClone(DEFAULT_CHARACTER);renderCharacterEditor(body);};
    byId('rrSaveCharacter').onclick=async()=>{const name=state.character.name.trim();if(!name){toastSafe('Give your rooftop character a name.');return;}state.character.name=name;const result=await saveProfile();toastSafe(result.ok?'Repo Rooftops character saved.':'Saved locally. Run repo-rooftops.sql for account syncing.');renderMenu();};
    byId('rrTestMovement').onclick=()=>startRun('practice');
  }

  async function renderLeaderboards(body){
    body.innerHTML=`<div class="rr-leaderboard-tabs">${['endless','daily','hardcore','timetrial'].map(m=>`<button type="button" data-rr-lb-mode="${m}" class="${state.leaderboardMode===m?'selected':''}">${m.toUpperCase()}</button>`).join('')}</div><div class="rr-leaderboard-tabs"><button data-rr-lb-period="day" type="button">TODAY</button><button data-rr-lb-period="week" type="button">WEEK</button><button data-rr-lb-period="all" type="button" class="${state.leaderboardPeriod==='all'?'selected':''}">ALL-TIME</button><button id="rrLbRefresh" type="button">REFRESH</button></div><div id="rrLeaderboardList" class="rr-leaderboard-list">Loading rooftop records…</div>`;
    body.querySelectorAll('[data-rr-lb-mode]').forEach(b=>b.onclick=()=>{state.leaderboardMode=b.dataset.rrLbMode;renderLeaderboards(body)});
    body.querySelectorAll('[data-rr-lb-period]').forEach(b=>b.onclick=()=>{state.leaderboardPeriod=b.dataset.rrLbPeriod;renderLeaderboards(body)});
    byId('rrLbRefresh').onclick=()=>loadLeaderboard();
    await loadLeaderboard();
  }

  async function loadLeaderboard(){
    const list=byId('rrLeaderboardList');if(!list)return;list.textContent='Loading rooftop records…';
    try{
      const {data,error}=await db.rpc('repo_rooftops_get_leaderboard',{p_mode:state.leaderboardMode,p_period:state.leaderboardPeriod});
      if(error)throw error;
      if(!data?.length){list.innerHTML='<div class="rr-leaderboard-row"><b>—</b><span>No completed runs yet.</span></div>';return;}
      list.innerHTML=data.map((r,i)=>`<div class="rr-leaderboard-row"><b>${i+1}</b><span>${escapeHtml(r.username||'Adventurer')}</span><span>${format(r.height)}m</span><span>Roof ${format(r.rooftop_level)}</span><span>${format(r.score)} pts</span><span>${escapeHtml(r.district||'Old Town')}</span></div>`).join('');
    }catch(error){console.warn(error);list.innerHTML='<div class="rr-leaderboard-row"><b>!</b><span>Run repo-rooftops.sql in Supabase to enable rooftop leaderboards.</span></div>';}
  }

  function renderStats(body){
    const p=state.profile||profileDefaults(),s=p.stats||{},districtCount=(s.districts||[]).length;
    const stats=[['Highest height',`${format(p.best_height)}m`],['Best rooftop',format(p.best_level)],['Total runs',format(p.total_runs)],['Total metres',format(p.total_metres)],['Total playtime',`${Math.floor((p.total_playtime_ms||0)/60000)}m`],['Marks collected',format(s.marks_collected)],['GP earned',format(p.total_gp_earned)],['Best momentum',`${format(s.best_momentum)}%`],['Deaths',format(s.deaths)],['Districts',`${districtCount}/${DISTRICTS.length}`],['Daily runs',format(s.daily_completed)],['Mark balance',format(p.mark_balance)]];
    body.innerHTML=`<div class="rr-stats-grid">${stats.map(([a,b])=>`<div class="rr-stat"><small>${a.toUpperCase()}</small><b>${b}</b></div>`).join('')}</div><h3>ACHIEVEMENTS</h3><div class="rr-achievement-grid">${ACHIEVEMENTS.map(([id,name,desc])=>`<article class="rr-achievement ${p.achievements?.[id]?'unlocked':''}"><h4>${name}</h4><p>${desc}</p></article>`).join('')}</div>`;
  }

  function renderSettings(body){
    const s=state.settings;
    const toggle=(key,label)=>`<label class="rr-setting-row"><span>${label}</span><input type="checkbox" data-rr-setting="${key}" ${s[key]?'checked':''}></label>`;
    const slider=(key,label,min=0,max=1,step=.05)=>`<label class="rr-setting-row"><span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${s[key]}" data-rr-setting="${key}"></label>`;
    body.innerHTML=`<div class="rr-settings-grid"><section class="rr-settings-card"><h4>AUDIO</h4>${slider('masterVolume','Master volume')}${slider('musicVolume','Music volume')}${slider('sfxVolume','Sound effects')}${slider('ambienceVolume','Ambience')}</section><section class="rr-settings-card"><h4>ACCESSIBILITY</h4>${toggle('screenShake','Screen shake')}${toggle('reducedParticles','Reduced particles')}${toggle('reducedFlashing','Reduced flashing')}${toggle('highContrast','High-contrast hazards')}${toggle('simplifiedBackground','Simplified backgrounds')}${toggle('performanceMode','Performance mode')}</section><section class="rr-settings-card rr-field-wide"><h4>KEY BINDINGS</h4><div class="rr-key-grid">${Object.entries(s.keys).map(([action,code])=>`<div class="rr-key-bind"><span>${action.toUpperCase()}</span><button type="button" data-rr-key="${action}">${prettyKey(code)}</button></div>`).join('')}</div></section><section class="rr-settings-card rr-field-wide"><button id="rrSaveSettings" type="button">SAVE SETTINGS</button></section></div>`;
    body.querySelectorAll('[data-rr-setting]').forEach(input=>input.addEventListener('input',()=>{state.settings[input.dataset.rrSetting]=input.type==='checkbox'?input.checked:Number(input.value);}));
    body.querySelectorAll('[data-rr-key]').forEach(btn=>btn.onclick=()=>{state.keyCapture=btn.dataset.rrKey;btn.textContent='PRESS A KEY';btn.focus();});
    byId('rrSaveSettings').onclick=async()=>{const r=await saveProfile();toastSafe(r.ok?'Repo Rooftops settings saved.':'Settings cached locally.');};
  }

  function prettyKey(code){return String(code).replace('Key','').replace('Arrow','').replace('Left',' L').replace('Right',' R').toUpperCase();}

  function renderHowTo(body){
    body.innerHTML=`<div class="rr-howto"><article><h4>CLIMB</h4><p>Use <b>A / D</b> or the arrow keys to move. Use <b>Space</b> to jump. Hold jump for extra height. Coyote time and jump buffering keep movement responsive.</p></article><article><h4>ADVANCED MOVEMENT</h4><p>Jump against walls to wall-slide, then jump again to launch away. Press <b>Shift</b> to dash. Land to recharge it.</p></article><article><h4>KEEP MOVING</h4><p>The danger below rises faster at greater heights. Maintain upward momentum, use recovery rooftops wisely and watch hazard telegraphs.</p></article><article><h4>REWARDS</h4><p>Runs qualify for a deliberately modest GP reward after 50 metres or five rooftops. Marks of Grace have an independent server-backed 1-in-50 roll on eligible levels and save immediately when collected.</p></article><article><h4>ROUTES</h4><p>Wide routes are safer. Smaller optional routes contain more coins, momentum and risk bonuses. Every generated section retains a validated safe route upward.</p></article><article><h4>MODES</h4><p>Endless awards full rewards. Daily uses the same seed for everybody. Hardcore has faster danger. Time Trial lasts three minutes. Practice awards nothing.</p></article></div>`;
  }

  function freshRun(mode,server={}){
    const dailySeed=`daily-${londonDate()}`;
    const seed=server.seed||((mode==='daily')?dailySeed:`${mode}-${Date.now()}-${Math.random()}`);
    const rng=mulberry32(seedHash(seed));
    const player={x:480,y:20,w:24,h:40,vx:0,vy:0,onGround:true,coyote:.11,jumpBuffer:0,dashReady:true,dashing:0,wallDir:0,facing:1,dropTimer:0,shield:0,extraDash:0,trail:[]};
    return {active:true,mode,runId:server.run_id||server.runId||makeId('practice'),seed,rng,startedAt:performance.now(),serverStartedAt:server.server_started_at||null,player,platforms:[],hazards:[],collectables:[],particles:[],chunks:[],level:0,completedLevel:0,nextChunkY:0,nextChunkX:480,cameraBottom:-80,highestY:50,height:10,score:0,provisionalGp:0,coinGp:0,riskGp:0,marks:0,markPending:0,momentum:0,maxMomentum:0,dangerY:-360,districtIndex:-1,difficulty:'Beginner',lastLevelAt:performance.now(),lastProgressAt:performance.now(),lastHudAt:0,keys:{left:false,right:false,jump:false,dash:false,down:false},pressed:{jump:false,dash:false},gamepad:{},paused:false,ended:false,finishReason:'',timeLimit:mode==='timetrial'?180000:0,checkpointNext:CHECKPOINT_STEP,checkpointSeen:new Set(),powerups:{},dailySeed,dbEnabled:mode!=='practice',previewPromises:new Map(),levelCompletionQueue:Promise.resolve(),completedLevelRecords:[],weatherParticles:[],shake:0,flash:0,tutorial:{move:false,jump:false,wall:false},stats:{obstacles:0,riskRoutes:0,coins:0,districts:new Set(),bestCombo:0},lastPlatform:null};
  }

  async function startRun(mode='endless'){
    if(!MODES.includes(mode))mode='endless';
    if(!isLoggedIn()){toastSafe('Log in before starting Repo Rooftops.');return;}
    stopRunLoop();
    state.lastMode=mode;
    let server={};
    if(mode!=='practice'){
      setStatus('Opening a secure rooftop run…');
      try{
        const seed=mode==='daily'?`daily-${londonDate()}`:`${mode}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const data=await rpcWithRetry('repo_rooftops_start_run',{p_mode:mode,p_seed:seed},3);
        server=Array.isArray(data)?data[0]:data;
      }catch(error){
        console.warn(error);
        const practice=await askRooftops({
          eyebrow:'SECURE RUN UNAVAILABLE',
          title:'PLAY PRACTICE MODE?',
          message:`The secure run could not start: ${databaseErrorText(error)}. Run the included repair SQL in Supabase, then retry. Practice Mode remains reward-free.`,
          acceptLabel:'START PRACTICE',
          cancelLabel:'BACK TO MENU'
        });
        if(!practice){setStatus(`Secure run failed: ${databaseErrorText(error)}`,'failed');return;}mode='practice';server={};
      }
    }
    state.run=freshRun(mode,server||{});
    initialiseWorld(state.run);
    applyView('game');
    hide(byId('rrPauseOverlay'));hide(byId('rrCheckpointOverlay'));
    byId('rrGameMessage').classList.remove('show');
    updateHud(true);
    showDistrict(0,true);
    canvas.focus();
    state.lastFrame=performance.now();state.accumulator=0;
    state.raf=requestAnimationFrame(frame);
    tone('click');
  }

  function initialiseWorld(run){
    run.platforms.push({id:'start',x:300,y:0,w:360,h:20,type:'solid',safe:true});
    run.platforms.push({id:'left-wall',x:0,y:-80,w:20,h:260,type:'wall',safe:true});
    run.platforms.push({id:'right-wall',x:940,y:-80,w:20,h:260,type:'wall',safe:true});
    run.nextChunkY=40;run.nextChunkX=480;
    while(run.nextChunkY<900)generateChunk(run);
  }

  const TEMPLATE_NAMES=['stairs','zigzag','moving','crumble','bounce','wallshaft','conveyor','ice','laser','vent','risk','recovery'];

  function generateChunk(run){
    const level=run.chunks.length+1;
    const metres=Math.floor(run.nextChunkY/PX_PER_METRE);
    const difficulty=clamp(level/95,0,1);
    const unlocked=['stairs','zigzag','recovery'];
    if(metres>80)unlocked.push('moving','crumble','bounce','risk');
    if(metres>250)unlocked.push('wallshaft','conveyor','vent');
    if(metres>550)unlocked.push('ice','laser');
    let template=unlocked[Math.floor(run.rng()*unlocked.length)];
    if(level===1)template='stairs';
    else if(level===2)template='zigzag';
    else if(level===3)template='recovery';
    const checkpoint=Math.floor(metres/CHECKPOINT_STEP)>Math.floor((metres-30)/CHECKPOINT_STEP);
    if(checkpoint)template='recovery';
    const district=resolveDistrict(metres);
    if(district.id==='frozen'&&run.rng()<.45)template='ice';
    if(district.id==='furnace'&&run.rng()<.45)template='vent';
    if(district.id==='clockwork'&&run.rng()<.4)template=run.rng()<.5?'moving':'conveyor';
    if(district.id==='stormside'&&run.rng()<.3)template='risk';
    if(district.id==='arcane'&&run.rng()<.35)template='bounce';
    const chunk={level,id:`${run.seed.slice(0,20)}-${level}-${Math.floor(run.rng()*1e8).toString(36)}`,template,startY:run.nextChunkY,platforms:[],hazards:[],collectables:[],completed:false,previewed:false,mark:null,district:district.id,checkpoint};
    const addP=(x,y,w,type='solid',extra={})=>{const p={id:`p-${level}-${chunk.platforms.length}`,x:clamp(x,28,W-28-w),y,w,h:14,type,baseX:x,time:run.rng()*10,active:true,...extra};chunk.platforms.push(p);run.platforms.push(p);return p;};
    const addCoin=(x,y,value=100,kind='coin')=>{const c={id:`c-${level}-${chunk.collectables.length}`,x,y,r:8,value:Math.max(1,Math.floor(value*.05)),scoreValue:value,kind,collected:false};chunk.collectables.push(c);run.collectables.push(c);return c;};
    const addHaz=(h)=>{h.id=`h-${level}-${chunk.hazards.length}`;chunk.hazards.push(h);run.hazards.push(h);return h;};
    let x=run.nextChunkX,y=run.nextChunkY;
    const step=level<=3?52+Math.floor(run.rng()*12):64+Math.floor(run.rng()*22+difficulty*8);
    const widths={wide:(level<=3?220:190)-difficulty*55,mid:(level<=3?158:130)-difficulty*35,small:(level<=3?110:92)-difficulty*25};
    let exit;
    if(template==='stairs'){
      const dir=run.rng()<.5?-1:1;for(let i=0;i<3;i++){x=clamp(x+dir*(105+run.rng()*45),90,870);y+=step;exit=addP(x-widths.mid/2,y,widths.mid,'solid',{safe:true});if(i===1&&run.rng()<.5)addCoin(x,y+35,100);} 
    }else if(template==='zigzag'){
      for(let i=0;i<3;i++){const dir=i%2?1:-1;x=clamp(480+dir*(140+run.rng()*180),90,870);y+=step-5;exit=addP(x-widths.mid/2,y,widths.mid,'solid',{safe:true});if(run.rng()<.45)addCoin(x,y+34,100);} 
    }else if(template==='moving'){
      y+=step;x=clamp(x+(run.rng()-.5)*210,150,810);addP(x-75,y,150,'moving',{range:75+difficulty*45,speed:.9+difficulty*.8,safe:true});y+=step+10;x=clamp(480+(run.rng()-.5)*360,130,830);exit=addP(x-widths.mid/2,y,widths.mid,'solid',{safe:true});addCoin(x,y+34,250);
    }else if(template==='crumble'){
      const dir=run.rng()<.5?-1:1;for(let i=0;i<4;i++){x=clamp(x+dir*(82+run.rng()*32),80,880);y+=56+run.rng()*12;exit=addP(x-widths.small/2,y,widths.small,'crumble',{safe:true,crumble:0,respawn:0});if(i===2)addCoin(x,y+34,250);} 
    }else if(template==='bounce'){
      y+=48;x=clamp(x+(run.rng()-.5)*140,140,820);addP(x-65,y,130,'bounce',{safe:true});y+=150;x=clamp(x+(run.rng()-.5)*120,140,820);exit=addP(x-widths.wide/2,y,widths.wide,'solid',{safe:true});addCoin(x,y+38,250);
    }else if(template==='wallshaft'){
      const center=clamp(x+(run.rng()-.5)*160,260,700);addP(center-100,y+20,20,'wall',{h:210,safe:true});addP(center+80,y+20,20,'wall',{h:210,safe:true});for(let i=0;i<3;i++){y+=62;const side=i%2?center+40:center-40;addP(side-35,y,70,'solid',{safe:true});}y+=42;exit=addP(center-90,y,180,'solid',{safe:true});addCoin(center,y+38,500,'risk');
    }else if(template==='conveyor'){
      y+=step;x=clamp(x+(run.rng()-.5)*180,160,800);addP(x-100,y,200,'conveyor',{speed:(run.rng()<.5?-1:1)*(40+difficulty*55),safe:true});y+=step;x=clamp(x+(run.rng()-.5)*160,150,810);exit=addP(x-widths.mid/2,y,widths.mid,'solid',{safe:true});
    }else if(template==='ice'){
      const dir=run.rng()<.5?-1:1;for(let i=0;i<3;i++){x=clamp(x+dir*(110+run.rng()*60),100,860);y+=step;exit=addP(x-widths.wide/2,y,widths.wide,'ice',{safe:true});if(i===1)addCoin(x,y+34,250);} 
    }else if(template==='laser'){
      y+=step;x=clamp(x+(run.rng()-.5)*160,160,800);const base=addP(x-110,y,220,'solid',{safe:true});addHaz({type:'laser',x:base.x+base.w*.5,y:y+14,w:6,h:120,period:2.5,phase:run.rng()*2.5});y+=145;exit=addP(x-widths.wide/2,y,widths.wide,'solid',{safe:true});addCoin(x+70,y+36,500,'risk');
    }else if(template==='vent'){
      y+=step;x=clamp(x+(run.rng()-.5)*160,160,800);const base=addP(x-100,y,200,'solid',{safe:true});addHaz({type:'vent',x:base.x+base.w*.5-20,y:y+14,w:40,h:100,period:2.2,phase:run.rng()*2.2});y+=125;x=clamp(x+(run.rng()-.5)*120,140,820);exit=addP(x-widths.mid/2,y,widths.mid,'solid',{safe:true});
    }else if(template==='risk'){
      y+=step;x=clamp(x+(run.rng()-.5)*120,180,780);const safe=addP(x-widths.wide/2,y,widths.wide,'solid',{safe:true});const riskDir=run.rng()<.5?-1:1;const rx=clamp(x+riskDir*190,70,890);addP(rx-42,y+48,84,'crumble',{optional:true,crumble:0,respawn:0});addCoin(rx,y+86,750,'risk');y+=step+30;exit=addP(clamp(x+(run.rng()-.5)*160,140,820)-widths.mid/2,y,widths.mid,'solid',{safe:true});
    }else{
      y+=72;x=480;const wide=addP(120,y,720,'solid',{safe:true,checkpoint:true});exit=wide;for(let i=0;i<3;i++)addCoin(390+i*60,y+36,100);y+=70;exit=addP(480-widths.wide/2,y,widths.wide,'solid',{safe:true});
    }
    if(!exit)exit=addP(x-widths.wide/2,y,widths.wide,'solid',{safe:true});
    chunk.exitY=exit.y+exit.h;chunk.exitX=exit.x+exit.w/2;chunk.markPoint={x:exit.x+exit.w*.72,y:exit.y+44};
    run.chunks.push(chunk);run.nextChunkY=chunk.exitY+18;run.nextChunkX=chunk.exitX;
    previewLevel(chunk);
  }

  function resolveDistrict(metres){
    if(metres<0)return DISTRICTS[0];
    let idx=Math.floor(metres/DISTRICT_STEP);
    if(idx<DISTRICTS.length)return DISTRICTS[idx];
    idx=idx%DISTRICTS.length;return {...DISTRICTS[idx],name:`Corrupted ${DISTRICTS[idx].name}`};
  }

  function difficultyFor(height){let name='Beginner';for(const [h,n] of DIFFICULTY_TIERS)if(height>=h)name=n;return name;}

  async function previewLevel(chunk){
    const run=state.run;if(!run||run.mode==='practice'||chunk.level<=3)return;
    try{
      const {data,error}=await db.rpc('repo_rooftops_preview_level',{p_run_id:run.runId,p_level_number:chunk.level,p_level_id:chunk.id});
      if(error)throw error;
      const row=Array.isArray(data)?data[0]:data;
      if(row?.has_mark&&row?.mark_id){chunk.mark={id:row.mark_id,x:chunk.markPoint.x,y:chunk.markPoint.y,collected:false,pending:false};showGameMessage('A rare shimmer flickers somewhere above…');}
      chunk.previewed=true;
    }catch(error){console.warn('Rooftop level preview failed',error);}
  }

  function frame(now){
    const run=state.run;if(!run||!run.active)return;
    state.raf=requestAnimationFrame(frame);
    let dt=Math.min(.05,(now-state.lastFrame)/1000||.016);state.lastFrame=now;
    pollGamepad(run);
    if(run.paused){draw(run,now/1000);return;}
    state.accumulator+=dt;
    const step=1/120;let loops=0;
    while(state.accumulator>=step&&loops<8){update(run,step,now);state.accumulator-=step;loops++;}
    draw(run,now/1000);updateHud(false,now);
  }

  function update(run,dt,now){
    const p=run.player;
    const input=run.keys;
    const move=(input.left?-1:0)+(input.right?1:0);
    const accel=p.onGround?1850:1120,maxSpeed=250+(run.powerups.speed?35:0);
    if(move){p.vx+=move*accel*dt;p.facing=move;p.vx=clamp(p.vx,-maxSpeed,maxSpeed);run.tutorial.move=true;}else{const friction=p.onGround?(run.lastPlatform?.type==='ice'?180:1650):120;p.vx=Math.abs(p.vx)<=friction*dt?0:p.vx-Math.sign(p.vx)*friction*dt;}
    if(run.pressed.jump){p.jumpBuffer=.15;run.pressed.jump=false;}
    p.jumpBuffer=Math.max(0,p.jumpBuffer-dt);p.coyote=Math.max(0,p.coyote-dt);
    if(input.down&&p.onGround&&run.lastPlatform&&run.lastPlatform.type!=='wall'){p.dropTimer=.2;p.y-=7;p.onGround=false;}
    detectWall(run);
    if((p.onGround||p.coyote>0)&&p.jumpBuffer>0){p.vy=565;p.onGround=false;p.coyote=0;p.jumpBuffer=0;run.tutorial.jump=true;tone('jump');spawnBurst(run,p.x,p.y,8,'#bcecff');}
    else if(p.wallDir&&p.jumpBuffer>0&&!p.onGround){p.vy=530;p.vx=-p.wallDir*335;p.facing=-p.wallDir;p.jumpBuffer=0;p.dashReady=true;run.tutorial.wall=true;tone('jump',1.15);spawnBurst(run,p.x,p.y+18,10,'#e6c975');}
    if(!input.jump&&p.vy>140)p.vy*=.55;
    if(run.pressed.dash&&p.dashReady){p.dashing=.13;p.dashReady=p.extraDash>0?(p.extraDash--,true):false;const vertical=input.down?-1:input.jump?1:0;let dx=move||p.facing;p.vx=dx*520;p.vy=vertical*360+(vertical===0?45:0);run.pressed.dash=false;tone('dash');run.shake=Math.max(run.shake,4);spawnBurst(run,p.x,p.y+18,16,'#70d7ff');}
    run.pressed.dash=false;
    if(p.dashing>0){p.dashing-=dt;}else{p.vy-=1220*dt;if(p.wallDir&&!p.onGround&&p.vy<0)p.vy=Math.max(p.vy,-115);}
    if(run.mode==='hardcore')p.vy-=55*dt;
    const oldX=p.x,oldY=p.y;
    p.x+=p.vx*dt;resolveHorizontal(run,p,oldX);
    p.y+=p.vy*dt;p.onGround=false;resolveVertical(run,p,oldY);
    p.dropTimer=Math.max(0,p.dropTimer-dt);
    if(p.onGround){p.coyote=.11;p.dashReady=true;}
    if(p.wallDir&&p.vy<0&&Math.random()<dt*10)spawnBurst(run,p.x+p.wallDir*12,p.y+18,1,'#93b6c7');
    if(p.dashing>0){p.trail.unshift({x:p.x-p.facing*10,y:p.y+20,a:1,dir:p.facing});if(p.trail.length>8)p.trail.pop();}
    p.trail.forEach(t=>t.a-=dt*6);p.trail=p.trail.filter(t=>t.a>0);
    updatePlatforms(run,dt,now/1000);
    updateCollectables(run);
    updateHazards(run,now/1000);
    updateProgress(run,now);
    updateDanger(run,dt);
    updateParticles(run,dt);
    if(run.timeLimit&&now-run.startedAt>=run.timeLimit)finishRun('time');
    if(p.y<run.dangerY+8)hitPlayer(run,'danger');
    if(p.y<-220)hitPlayer(run,'fall');
  }

  function platformRect(p){return {x:p.x,y:p.y,w:p.w,h:p.h||14};}
  function activePlatforms(run){return run.platforms.filter(p=>p.active!==false&&p.y>run.cameraBottom-220&&p.y<run.cameraBottom+H+420);}

  function resolveHorizontal(run,p,oldX){
    p.x=clamp(p.x,p.w/2,W-p.w/2);
    for(const plat of activePlatforms(run)){
      if(plat.type!=='wall'&&plat.h<=18)continue;
      const r=platformRect(plat),left=p.x-p.w/2,right=p.x+p.w/2,bottom=p.y,top=p.y+p.h;
      if(top<=r.y||bottom>=r.y+r.h||right<=r.x||left>=r.x+r.w)continue;
      if(p.vx>0&&oldX+p.w/2<=r.x+4){p.x=r.x-p.w/2;p.vx=0;}else if(p.vx<0&&oldX-p.w/2>=r.x+r.w-4){p.x=r.x+r.w+p.w/2;p.vx=0;}
    }
  }

  function resolveVertical(run,p,oldY){
    const left=p.x-p.w/2+3,right=p.x+p.w/2-3;
    for(const plat of activePlatforms(run)){
      if(plat.type==='wall'&&plat.h>18){
        const r=platformRect(plat);
        if(p.vy>0&&p.y+p.h>=r.y&&oldY+p.h<=r.y&&right>r.x&&left<r.x+r.w){p.y=r.y-p.h;p.vy=0;}
        continue;
      }
      const top=plat.y+(plat.h||14);
      // Rooftop ledges are one-way: pass upward through them, then land cleanly from above.
      if(p.vy<=0&&oldY>=top-1&&p.y<=top&&right>plat.x&&left<plat.x+plat.w&&p.dropTimer<=0){
        p.y=top;p.vy=0;p.onGround=true;run.lastPlatform=plat;
        if(plat.type==='bounce'){p.vy=665;p.onGround=false;tone('jump',1.2);spawnBurst(run,p.x,p.y,14,'#b77dff');}
        if(plat.type==='conveyor')p.x+=Number(plat.speed||0)/120;
        if(plat.type==='crumble'&&!plat.crumble)plat.crumble=.72;
      }
    }
  }

  function inputDown(){return !!state.run?.keys.down;}

  function detectWall(run){
    const p=run.player;p.wallDir=0;
    const bottom=p.y+4,top=p.y+p.h-4;
    for(const plat of activePlatforms(run)){
      if(plat.type!=='wall'&&plat.h<=18)continue;
      const r=platformRect(plat);if(top<=r.y||bottom>=r.y+r.h)continue;
      if(Math.abs((p.x+p.w/2)-r.x)<5)p.wallDir=1;
      if(Math.abs((p.x-p.w/2)-(r.x+r.w))<5)p.wallDir=-1;
    }
  }

  function updatePlatforms(run,dt,time){
    for(const p of run.platforms){
      if(p.type==='moving'){p.x=p.baseX+Math.sin(time*p.speed+p.time)*p.range;}
      if(p.type==='crumble'){
        if(p.crumble>0){p.crumble-=dt;if(p.crumble<=0){p.active=false;p.respawn=3.2;spawnBurst(run,p.x+p.w/2,p.y+10,10,'#a58a6a');}}
        else if(p.active===false){p.respawn-=dt;if(p.respawn<=0){p.active=true;p.crumble=0;}}
      }
    }
  }

  function updateCollectables(run){
    const p=run.player;
    for(const c of run.collectables){
      if(c.collected)continue;
      const dx=p.x-c.x,dy=(p.y+p.h*.5)-c.y;if(dx*dx+dy*dy<30*30){c.collected=true;if(c.kind==='risk'){run.riskGp+=c.value;run.stats.riskRoutes++;run.momentum=clamp(run.momentum+10,0,100);}else{run.coinGp+=c.value;}run.stats.coins++;run.score+=(c.scoreValue??c.value)*3;tone('coin');spawnBurst(run,c.x,c.y,12,c.kind==='risk'?'#ffdc67':'#7ddcff');}
    }
    for(const chunk of run.chunks){
      const m=chunk.mark;if(!m||m.collected||m.pending)continue;
      const dx=p.x-m.x,dy=(p.y+p.h*.5)-m.y;if(dx*dx+dy*dy<34*34)collectMark(chunk,m);
    }
  }

  async function collectMark(chunk,mark){
    const run=state.run;if(!run||mark.pending||mark.collected)return;mark.pending=true;showGameMessage('Saving Mark of Grace…');
    try{
      const {data,error}=await db.rpc('repo_rooftops_collect_mark',{p_run_id:run.runId,p_mark_id:mark.id});
      if(error)throw error;
      const row=Array.isArray(data)?data[0]:data;mark.collected=true;mark.pending=false;run.marks++;run.score+=5000;state.profile.mark_balance=Number(row?.mark_balance??state.profile.mark_balance+1);byId('rrMenuMarks').textContent=format(state.profile.mark_balance);tone('mark');spawnBurst(run,mark.x,mark.y,32,'#ffe89b');run.shake=7;run.flash=.3;showGameMessage('Mark of Grace collected!');
    }catch(error){mark.pending=false;console.warn(error);queuePendingMark(run,mark,chunk);showGameMessage('Mark save pending — it will retry safely.');}
  }

  function queuePendingMark(run,mark,chunk){
    const key='repoRooftopsPendingMarks';let list=[];try{list=JSON.parse(localStorage.getItem(key)||'[]')}catch(_){ }
    if(!list.some(x=>x.markId===mark.id))list.push({runId:run.runId,markId:mark.id,level:chunk.level,at:Date.now()});localStorage.setItem(key,JSON.stringify(list));
  }

  async function retryPendingMarks(){
    const key='repoRooftopsPendingMarks';let list=[];try{list=JSON.parse(localStorage.getItem(key)||'[]')}catch(_){return;}
    const keep=[];for(const item of list){try{const {error}=await db.rpc('repo_rooftops_collect_mark',{p_run_id:item.runId,p_mark_id:item.markId});if(error)throw error;}catch(_){keep.push(item);}}localStorage.setItem(key,JSON.stringify(keep));
  }

  function updateHazards(run,time){
    const p=run.player;
    for(const h of run.hazards){
      if(h.y<run.cameraBottom-100||h.y>run.cameraBottom+H+200)continue;
      const phase=((time+h.phase)%h.period)/h.period;h.active=phase>.55;
      if(h.type==='laser'&&h.active&&rectHit(p.x-p.w/2,p.y,p.w,p.h,h.x-4,h.y,8,h.h))hitPlayer(run,'laser');
      if(h.type==='vent'&&h.active&&rectHit(p.x-p.w/2,p.y,p.w,p.h,h.x,h.y,h.w,h.h))hitPlayer(run,'fire');
    }
  }

  function rectHit(ax,ay,aw,ah,bx,by,bw,bh){return ax<bx+bw&&ax+aw>bx&&ay<by+bh&&ay+ah>by;}

  function hitPlayer(run,reason){
    if(!run.active||run.ended)return;
    const p=run.player;
    if(p.shield>0){p.shield--;p.vy=410;p.y=Math.max(p.y,run.dangerY+100);p.vx*=-.5;tone('shield');run.flash=.35;showGameMessage('Rooftop shield saved the run!');return;}
    finishRun(reason);
  }

  function updateProgress(run,now){
    const p=run.player;run.highestY=Math.max(run.highestY,p.y);run.height=Math.max(0,Math.floor(run.highestY/PX_PER_METRE));
    const targetBottom=p.y-H*.53;if(targetBottom>run.cameraBottom)run.cameraBottom=lerp(run.cameraBottom,targetBottom,.08);
    while(run.nextChunkY<run.cameraBottom+H+480)generateChunk(run);
    const oldDistrict=run.districtIndex;run.districtIndex=Math.floor(run.height/DISTRICT_STEP);if(run.districtIndex!==oldDistrict){showDistrict(run.districtIndex);run.stats.districts.add(resolveDistrict(run.height).id);}
    run.difficulty=difficultyFor(run.height);
    for(const chunk of run.chunks){
      if(chunk.completed||p.y<chunk.exitY)continue;
      if(chunk.level!==run.completedLevel+1)continue;
      chunk.completed=true;run.completedLevel=chunk.level;run.level=chunk.level;run.stats.obstacles++;run.score+=500+Math.floor(run.momentum*8);run.completedLevelRecords.push({level:chunk.level,id:chunk.id,height:run.height});const elapsed=(now-run.lastLevelAt)/1000;run.lastLevelAt=now;run.lastProgressAt=now;
      if(elapsed<4)run.momentum=clamp(run.momentum+12,0,100);else if(elapsed<7)run.momentum=clamp(run.momentum+6,0,100);else run.momentum=clamp(run.momentum-4,0,100);run.maxMomentum=Math.max(run.maxMomentum,run.momentum);run.stats.bestCombo=Math.max(run.stats.bestCombo,Math.floor(run.momentum/10));
      run.levelCompletionQueue=run.levelCompletionQueue.then(()=>completeLevelServer(run,chunk)).catch(error=>console.warn('Level validation queued for final retry',error));
      if(run.height>=run.checkpointNext){showCheckpoint(run,run.checkpointNext);run.checkpointNext+=CHECKPOINT_STEP;}
    }
    const idle=(now-run.lastProgressAt)/1000;if(idle>4)run.momentum=Math.max(0,run.momentum-(idle>8?.16:.06));
    run.provisionalGp=estimateGp(run);
    run.platforms=run.platforms.filter(x=>x.y>run.cameraBottom-420||x.id==='start');run.hazards=run.hazards.filter(x=>x.y>run.cameraBottom-420);run.collectables=run.collectables.filter(x=>x.y>run.cameraBottom-420&&!x.collected);run.chunks=run.chunks.filter(x=>x.exitY>run.cameraBottom-500||!x.completed);
  }

  async function completeLevelServer(run,chunk,attempts=3){
    if(!run||run.mode==='practice')return;
    let lastError=null;
    for(let attempt=0;attempt<attempts;attempt++){
      try{
        const record=run.completedLevelRecords.find(item=>item.level===chunk.level)||{height:run.height};
        const {error}=await db.rpc('repo_rooftops_complete_level',{
          p_run_id:run.runId,
          p_level_number:chunk.level,
          p_level_id:chunk.id,
          p_height:Math.max(0,Math.floor(record.height||run.height))
        });
        if(error)throw error;
        return;
      }catch(error){
        lastError=error;
        if(attempt<attempts-1)await wait(250*(attempt+1));
      }
    }
    throw lastError||new Error('Rooftop level validation failed');
  }

  async function syncCompletedLevels(run){
    if(!run||run.mode==='practice')return;
    await run.levelCompletionQueue.catch(()=>{});
    const records=[...run.completedLevelRecords].sort((a,b)=>a.level-b.level);
    for(const record of records){
      await completeLevelServer(run,{level:record.level,id:record.id},4);
    }
  }

  function estimateGp(run){
    if(run.height<MIN_HEIGHT_GP&&run.completedLevel<MIN_LEVELS_GP)return 0;
    const heightGp=heightReward(run.height),levelGp=Math.floor(run.completedLevel*3.75),diff=difficultyReward(run.height),base=heightGp+levelGp+diff+run.coinGp+run.riskGp;const pct=momentumPercent(run.maxMomentum);return Math.min(RUN_CAP_GP,Math.floor(base*(1+pct)));
  }

  function heightReward(height){let h=Math.max(0,height),gp=0;const a=Math.min(h,500);gp+=a*.5;h-=a;if(h>0){const b=Math.min(h,500);gp+=b*.375;h-=b;}if(h>0){const c=Math.min(h,1000);gp+=c*.25;h-=c;}if(h>0)gp+=h*.15;return Math.floor(gp);}
  function difficultyReward(height){if(height>=1500)return 375+Math.floor((height-1500)/700)*100;if(height>=1000)return 225;if(height>=600)return 125;if(height>=300)return 63;if(height>=100)return 25;return 0;}
  function momentumPercent(m){return m>=85?.12:m>=65?.09:m>=45?.06:m>=25?.03:0;}

  function updateDanger(run,dt){
    const base=run.mode==='hardcore'?46:29;const scale=Math.min(75,run.height*.035);const targetGap=run.mode==='hardcore'?330:430;const desired=run.highestY-targetGap;
    if(run.dangerY<desired)run.dangerY+=Math.max(base+scale,(desired-run.dangerY)*.12)*dt;else run.dangerY+=(base+scale)*.35*dt;
  }

  function showCheckpoint(run,height){
    if(run.mode==='practice'||run.checkpointSeen.has(height))return;run.checkpointSeen.add(height);run.paused=true;show(byId('rrCheckpointOverlay'));tone('checkpoint');
    const choices=[
      ['WINDSTEP','Recharge your dash and gain one extra mid-air dash.','dash'],
      ['ROOFTOP AEGIS','Block the next hazard or danger hit.','shield'],
      ['TREASURE CACHE','Add 75 provisional GP to this run.','treasure']
    ];
    const box=byId('rrCheckpointChoices');box.innerHTML=choices.map(([name,desc,id])=>`<button type="button" data-choice="${id}"><b>${name}</b><small>${desc}</small></button>`).join('');
    box.querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>{if(b.dataset.choice==='dash'){run.player.extraDash++;run.player.dashReady=true;}else if(b.dataset.choice==='shield')run.player.shield++;else{run.riskGp+=75;run.score+=1500;}hide(byId('rrCheckpointOverlay'));run.paused=false;state.lastFrame=performance.now();showGameMessage(`${b.querySelector('b').textContent} acquired`);});
  }

  function spawnBurst(run,x,y,count,color){
    if(state.settings.reducedParticles)return;const max=state.settings.performanceMode?Math.ceil(count*.45):count;
    for(let i=0;i<max;i++){const a=run.rng()*Math.PI*2,s=40+run.rng()*130;run.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.35+run.rng()*.45,max:.8,color,size:2+run.rng()*3});}
  }
  function updateParticles(run,dt){for(const p of run.particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy-=260*dt;p.life-=dt;}run.particles=run.particles.filter(p=>p.life>0);run.shake=Math.max(0,run.shake-dt*18);run.flash=Math.max(0,run.flash-dt);}

  function draw(run,time){
    const district=resolveDistrict(run.height),shake=state.settings.screenShake?run.shake:0;const sx=(run.rng()-.5)*shake,sy=(run.rng()-.5)*shake;
    ctx.save();ctx.translate(sx,sy);drawBackground(run,district,time);drawDanger(run,district,time);drawWorld(run,district,time);drawPlayer(run,time);drawParticles(run);ctx.restore();
    if(run.flash>0&&!state.settings.reducedFlashing){ctx.fillStyle=`rgba(255,240,190,${run.flash*.45})`;ctx.fillRect(0,0,W,H);}
  }

  function worldToScreenY(run,y){return H-(y-run.cameraBottom);}

  function drawBackground(run,d,time){
    const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,d.sky[0]);g.addColorStop(.56,d.sky[1]);g.addColorStop(1,d.sky[2]);ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    if(!state.settings.simplifiedBackground){
      const moonX=760-(run.cameraBottom*.015)%220,moonY=95;ctx.fillStyle=d.id==='furnace'?'#ff8e45':'#dcecff';ctx.beginPath();ctx.arc(moonX,moonY,34,0,Math.PI*2);ctx.fill();ctx.fillStyle=d.sky[0];ctx.beginPath();ctx.arc(moonX+13,moonY-8,31,0,Math.PI*2);ctx.fill();
      drawSkyline(d.far,run.cameraBottom*.08,390,85,.28);drawSkyline(d.near,run.cameraBottom*.16,475,120,.55);
      drawWeather(run,d,time);
    }
  }

  function drawSkyline(color,offset,base,height,alpha){ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle=color;for(let i=-2;i<18;i++){const x=i*74-(offset%74),h=height+((i*37)%90);ctx.fillRect(x,base-h,68,h);ctx.fillStyle='rgba(255,225,140,.16)';for(let wy=base-h+18;wy<base-15;wy+=24)for(let wx=x+12;wx<x+58;wx+=22)if(((wx+wy+i*3)&3)===0)ctx.fillRect(wx,wy,5,8);ctx.fillStyle=color;}ctx.restore();}

  function drawWeather(run,d,time){
    const count=state.settings.performanceMode?18:state.settings.reducedParticles?28:55;ctx.save();
    for(let i=0;i<count;i++){
      const seed=i*91.73;let x=(seed*17+time*(d.weather==='rain'?260:20))%W,y=(seed*31+time*(d.weather==='snow'?45:d.weather==='embers'?-35:18))%H;
      if(d.weather==='rain'){ctx.strokeStyle='rgba(160,210,245,.3)';ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-12,y+28);ctx.stroke();}
      else if(d.weather==='snow'){ctx.fillStyle='rgba(240,252,255,.65)';ctx.fillRect(x,y,3,3);}
      else if(d.weather==='embers'){ctx.fillStyle='rgba(255,145,54,.55)';ctx.fillRect(x,H-y,3,5);}
      else if(d.weather==='runes'||d.weather==='void'){ctx.fillStyle=d.weather==='void'?'rgba(171,110,255,.28)':'rgba(188,144,255,.33)';ctx.fillRect(x,y,2+(i%3),2+(i%3));}
      else if(d.weather==='steam'){ctx.fillStyle='rgba(210,220,220,.08)';ctx.beginPath();ctx.arc(x,y,10+(i%5)*3,0,Math.PI*2);ctx.fill();}
    }ctx.restore();
  }

  function drawDanger(run,d,time){
    const sy=worldToScreenY(run,run.dangerY);const g=ctx.createLinearGradient(0,sy-35,0,H);const color=d.id==='furnace'?'255,70,20':d.id==='void'?'115,36,180':d.id==='stormside'?'42,75,120':'30,12,36';g.addColorStop(0,`rgba(${color},0)`);g.addColorStop(.25,`rgba(${color},.7)`);g.addColorStop(1,`rgba(${color},.96)`);ctx.fillStyle=g;ctx.fillRect(0,sy-35,W,H-sy+35);ctx.fillStyle=`rgba(${color},.8)`;for(let x=0;x<W;x+=20){const y=sy+Math.sin(time*4+x*.04)*8;ctx.fillRect(x,y,18,8);}
  }

  function drawWorld(run,d,time){
    for(const p of activePlatforms(run))drawPlatform(run,p,d,time);
    for(const h of run.hazards)drawHazard(run,h,d,time);
    for(const c of run.collectables)if(!c.collected)drawCollectable(run,c,time);
    for(const chunk of run.chunks)if(chunk.mark&&!chunk.mark.collected)drawMark(run,chunk.mark,time);
  }

  function drawPlatform(run,p,d,time){
    const sy=worldToScreenY(run,p.y+(p.h||14));if(sy<-80||sy>H+80||p.active===false)return;const h=p.h||14;
    ctx.save();if(p.type==='crumble'&&p.crumble>0)ctx.translate((run.rng()-.5)*3,0);
    let top=d.accent,body='#17242c';if(p.type==='ice'){top='#d8f5ff';body='#497084';}else if(p.type==='bounce'){top='#c592ff';body='#40275d';}else if(p.type==='conveyor'){top='#f3a84b';body='#3b322a';}else if(p.type==='moving'){top='#8bd8ff';body='#243d4b';}else if(p.checkpoint){top='#ffe59a';body='#43535c';}
    ctx.fillStyle='#04080b';ctx.fillRect(Math.round(p.x)-2,Math.round(sy)-2,Math.round(p.w)+4,h+8);ctx.fillStyle=body;ctx.fillRect(Math.round(p.x),Math.round(sy),Math.round(p.w),h+4);ctx.fillStyle=top;ctx.fillRect(Math.round(p.x),Math.round(sy),Math.round(p.w),4);
    if(p.type==='conveyor'){ctx.fillStyle='#10171b';for(let x=p.x+8;x<p.x+p.w;x+=24){const off=((time*(p.speed||40))%24);ctx.fillRect(Math.round(x+off%24),Math.round(sy+7),10,3);}}
    if(p.type==='bounce'){ctx.fillStyle='#f5deff';for(let x=p.x+8;x<p.x+p.w;x+=18)ctx.fillRect(Math.round(x),Math.round(sy-4),10,4);}
    if(p.type==='crumble'){ctx.strokeStyle='#8e745c';for(let x=p.x+18;x<p.x+p.w;x+=30){ctx.beginPath();ctx.moveTo(x,sy+4);ctx.lineTo(x-8,sy+12);ctx.lineTo(x+3,sy+17);ctx.stroke();}}
    if(p.type==='wall'){ctx.fillStyle=body;ctx.fillRect(p.x,sy,p.w,h);ctx.fillStyle=top;for(let y=sy;y<sy+h;y+=18)ctx.fillRect(p.x,y,p.w,2);}
    ctx.restore();
  }

  function drawHazard(run,h,d,time){
    const sy=worldToScreenY(run,h.y+h.h);if(sy<-140||sy>H+100)return;const phase=((time+h.phase)%h.period)/h.period,active=phase>.55,warn=phase>.38;
    if(h.type==='laser'){ctx.fillStyle='#1d2e36';ctx.fillRect(h.x-10,sy+h.h-16,20,16);ctx.fillStyle=active?'#ff4e67':warn?'#ffc768':'#3e5967';ctx.globalAlpha=active?1:warn?.65:.22;ctx.fillRect(h.x-2,sy,4,h.h);ctx.globalAlpha=1;if(active&&!state.settings.reducedFlashing){ctx.fillStyle='rgba(255,70,105,.14)';ctx.fillRect(h.x-12,sy,24,h.h);}}
    else{ctx.fillStyle='#2a211c';ctx.fillRect(h.x,sy+h.h-14,h.w,14);const flameH=active?h.h:warn?h.h*.45:8;const fg=ctx.createLinearGradient(0,sy+h.h-flameH,0,sy+h.h);fg.addColorStop(0,'rgba(255,225,94,.1)');fg.addColorStop(.45,'#ffb13b');fg.addColorStop(1,'#d72d17');ctx.fillStyle=fg;ctx.beginPath();ctx.moveTo(h.x,sy+h.h);for(let x=h.x;x<=h.x+h.w;x+=8)ctx.lineTo(x,sy+h.h-flameH*(.65+.35*Math.sin(time*8+x)));ctx.lineTo(h.x+h.w,sy+h.h);ctx.fill();}
  }

  function drawCollectable(run,c,time){const sy=worldToScreenY(run,c.y);if(sy<-40||sy>H+40)return;const bob=Math.sin(time*5+c.x)*4;ctx.save();ctx.translate(c.x,sy+bob);ctx.rotate(time*2);ctx.fillStyle=c.kind==='risk'?'#ffd65b':'#72dbff';ctx.fillRect(-7,-7,14,14);ctx.fillStyle='#fff6c3';ctx.fillRect(-2,-6,4,12);ctx.restore();}
  function drawMark(run,m,time){const sy=worldToScreenY(run,m.y);if(sy<-50||sy>H+50)return;ctx.save();ctx.translate(m.x,sy+Math.sin(time*3)*7);ctx.rotate(time*1.2);ctx.shadowBlur=18;ctx.shadowColor='#ffe69a';ctx.fillStyle='#fff3b5';ctx.beginPath();for(let i=0;i<8;i++){const a=i*Math.PI/4,r=i%2?7:15;ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);}ctx.closePath();ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#7ad7ff';ctx.fillRect(-3,-3,6,6);ctx.restore();}

  function drawPlayer(run,time){
    const p=run.player,sy=worldToScreenY(run,p.y);
    for(let i=p.trail.length-1;i>=0;i--){
      const t=p.trail[i];if(t.a<=0)continue;
      const tsy=worldToScreenY(run,t.y);ctx.save();ctx.globalAlpha=Math.max(0,t.a*.32);ctx.fillStyle='#7bdcff';ctx.fillRect(Math.round(t.x-t.dir*18),Math.round(tsy-25),Math.round(20+t.a*16),3);ctx.fillStyle='#f3dc8a';ctx.fillRect(Math.round(t.x-t.dir*10),Math.round(tsy-17),Math.round(10+t.a*10),2);ctx.restore();
    }
    const anim=p.dashing>0?'dash':!p.onGround?(p.vy>0?'jump':'fall'):Math.abs(p.vx)>30?'run':'idle';ctx.save();ctx.translate(p.x,sy);drawRunner(ctx,state.character,0,0,1.55,p.facing,anim,time);if(p.shield>0){ctx.strokeStyle='#9de9ff';ctx.lineWidth=2;ctx.globalAlpha=.65+.2*Math.sin(time*6);ctx.beginPath();ctx.arc(0,-24,28,0,Math.PI*2);ctx.stroke();}ctx.restore();
  }
  function drawParticles(run){for(const p of run.particles){const sy=worldToScreenY(run,p.y);ctx.globalAlpha=clamp(p.life/p.max,0,1);ctx.fillStyle=p.color;ctx.fillRect(p.x,sy,p.size,p.size);}ctx.globalAlpha=1;}

  function updateHud(force=false,now=performance.now()){
    const run=state.run;if(!run)return;if(!force&&now-run.lastHudAt<90)return;run.lastHudAt=now;
    byId('rrHudHeight').textContent=format(run.height);byId('rrHudLevel').textContent=format(run.completedLevel);byId('rrHudScore').textContent=format(run.score);byId('rrHudGp').textContent=format(run.provisionalGp);byId('rrHudMarks').textContent=format(run.marks);byId('rrHudMomentum').textContent=`${Math.floor(run.momentum)}%`;
    if(run.timeLimit){const left=Math.max(0,run.timeLimit-(now-run.startedAt));byId('rrHudScore').textContent=`${Math.ceil(left/1000)}s`;}
  }

  function showDistrict(index,initial=false){
    const d=resolveDistrict(Math.max(0,index)*DISTRICT_STEP),el=byId('rrDistrictBanner');el.querySelector('strong').textContent=d.name.toUpperCase();el.classList.remove('show');void el.offsetWidth;el.classList.add('show');if(!initial)tone('checkpoint',.55);
  }
  function showGameMessage(message){const el=byId('rrGameMessage');el.textContent=message;el.classList.remove('show');void el.offsetWidth;el.classList.add('show');}

  function pauseToggle(force){const run=state.run;if(!run||!run.active)return;run.paused=typeof force==='boolean'?force:!run.paused;byId('rrPauseOverlay').classList.toggle('hidden',!run.paused);state.lastFrame=performance.now();}

  function stopRunLoop(){cancelAnimationFrame(state.raf);state.raf=0;state.lastFrame=0;state.accumulator=0;}

  async function finishRun(reason='death',claim=true){
    const run=state.run;if(!run||run.ended)return;run.ended=true;run.active=false;run.finishReason=reason;stopRunLoop();tone('death');
    let reward=null,error=null,pending=false;
    if(run.mode!=='practice'&&claim){
      byId('rrSummaryStatus').textContent='Validating and saving your run…';
      try{reward=await claimRun(run);}catch(err){error=err;pending=true;queuePendingReward(run);}
    }
    renderSummary(run,reward,error,pending);applyView('summary');
    if(reward)await loadProfile(true).then(renderMenu);
  }

  async function claimRun(run){
    await syncCompletedLevels(run);
    const payload={p_run_id:run.runId,p_height:run.height,p_rooftop_level:run.completedLevel,p_score:Math.floor(run.score),p_client_duration_ms:Math.floor(performance.now()-run.startedAt),p_district:resolveDistrict(run.height).name,p_momentum:Math.floor(run.maxMomentum),p_collectable_gp:Math.floor(run.coinGp),p_risk_gp:Math.floor(run.riskGp),p_marks_collected:run.marks};
    const data=await rpcWithRetry('repo_rooftops_claim_run',payload,3);const row=Array.isArray(data)?data[0]:data;if(!row)throw new Error('No reward result returned.');
    if(Number.isFinite(Number(row.new_gp)))character.gp=Number(row.new_gp);if(Number.isFinite(Number(row.new_agility_xp)))character.agility_xp=Number(row.new_agility_xp);if(typeof renderCharacter==='function')renderCharacter();if(typeof loadDailyXpLeaderboard==='function')loadDailyXpLeaderboard();if(typeof loadGlobalXpLeaderboard==='function')loadGlobalXpLeaderboard();
    localStorage.removeItem('repoRooftopsPendingReward');return row;
  }

  function queuePendingReward(run){const payload={runId:run.runId,height:run.height,rooftopLevel:run.completedLevel,score:Math.floor(run.score),durationMs:Math.floor(performance.now()-run.startedAt),district:resolveDistrict(run.height).name,momentum:Math.floor(run.maxMomentum),collectableGp:Math.floor(run.coinGp),riskGp:Math.floor(run.riskGp),marksCollected:run.marks,mode:run.mode,levelRecords:run.completedLevelRecords};localStorage.setItem('repoRooftopsPendingReward',JSON.stringify(payload));state.pendingReward=payload;}

  async function retryPendingReward(){
    let p;try{p=JSON.parse(localStorage.getItem('repoRooftopsPendingReward')||'null')}catch(_){return;}
    if(!p||!isLoggedIn())return;state.pendingReward=p;
    try{
      if(Array.isArray(p.levelRecords)){
        for(const record of [...p.levelRecords].sort((a,b)=>a.level-b.level)){
          const {error:levelError}=await db.rpc('repo_rooftops_complete_level',{p_run_id:p.runId,p_level_number:record.level,p_level_id:record.id,p_height:record.height});
          if(levelError)throw levelError;
        }
      }
      const {data,error}=await db.rpc('repo_rooftops_claim_run',{p_run_id:p.runId,p_height:p.height,p_rooftop_level:p.rooftopLevel,p_score:p.score,p_client_duration_ms:p.durationMs,p_district:p.district,p_momentum:p.momentum,p_collectable_gp:p.collectableGp,p_risk_gp:p.riskGp,p_marks_collected:p.marksCollected});
      if(error)throw error;
      localStorage.removeItem('repoRooftopsPendingReward');state.pendingReward=null;
      const row=Array.isArray(data)?data[0]:data;
      if(row){character.gp=Number(row.new_gp)||character.gp;character.agility_xp=Number(row.new_agility_xp)||character.agility_xp;renderCharacter();}
      toastSafe('Pending Repo Rooftops reward confirmed.');await loadProfile(true);renderMenu();
    }catch(error){console.warn('Pending rooftop reward still waiting',error);setStatus(`Pending rooftop reward: ${databaseErrorText(error)}`,'pending');}
    retryPendingMarks();
  }

  function renderSummary(run,reward,error,pending){
    byId('rrSummaryEyebrow').textContent=run.mode==='practice'?'PRACTICE COMPLETE':reward?.is_personal_best?'NEW PERSONAL BEST':'RUN COMPLETE';
    byId('rrSummaryTitle').textContent=run.finishReason==='time'?'TIME IS UP':run.finishReason==='quit'?'RUN ENDED':run.finishReason==='danger'?'THE CITY CAUGHT YOU':'THE ROOFTOPS WIN THIS ROUND';
    byId('rrSummaryHeight').textContent=format(run.height);
    const stats=[['Rooftops',run.completedLevel],['Score',run.score],['Momentum',`${Math.floor(run.maxMomentum)}%`],['Marks',run.marks],['Time',`${Math.floor((performance.now()-run.startedAt)/1000)}s`]];
    byId('rrSummaryStats').innerHTML=stats.map(([a,b])=>`<div><small>${a.toUpperCase()}</small><b>${typeof b==='number'?format(b):b}</b></div>`).join('');
    const box=byId('rrRewardBreakdown');
    if(run.mode==='practice'){box.innerHTML='<div class="rr-reward-row total"><span>Practice Mode</span><b>No rewards or records</b></div>';byId('rrSummaryStatus').textContent='Movement test complete. Your account was not changed.';byId('rrSummaryStatus').className='rr-status';}
    else if(reward){
      const rows=[['Height GP',reward.height_gp],['Rooftop GP',reward.level_gp],['Difficulty GP',reward.difficulty_gp],['Collectables',reward.collectable_gp],['Risk routes',reward.risk_gp],['Momentum bonus',reward.momentum_gp],['Personal-best bonus',reward.personal_best_gp],['Milestone bonuses',reward.milestone_gp],['Agility XP',`${format(reward.agility_xp_gained)} XP`],['Total GP',reward.total_gp]];
      box.innerHTML=rows.map(([a,b],i)=>`<div class="rr-reward-row ${i===rows.length-1?'total':''}"><span>${a}</span><b>${typeof b==='number'?format(b):b}</b></div>`).join('');byId('rrSummaryStatus').textContent=reward.already_claimed?'Reward already claimed safely — no duplicate payout.':'Reward confirmed and saved to your account.';byId('rrSummaryStatus').className='rr-status rr-run-confirmed';
    }else{box.innerHTML=`<div class="rr-reward-row total"><span>Reward status</span><b>${pending?'PENDING SAVE':'FAILED'}</b></div>`;byId('rrSummaryStatus').textContent=pending?'Your result is stored locally and will retry the same idempotent claim. No duplicate payout can occur.':(error?.message||'Reward could not be saved.');byId('rrSummaryStatus').className=`rr-status ${pending?'rr-run-pending':'rr-run-failed'}`;}
  }

  function pollGamepad(run){
    const pad=navigator.getGamepads?.()[0];if(!pad)return;const x=pad.axes?.[0]||0;run.keys.left=x<-.35;run.keys.right=x>.35;const jump=!!pad.buttons?.[0]?.pressed,dash=!!pad.buttons?.[1]?.pressed;if(jump&&!run.gamepad.jump)run.pressed.jump=true;if(dash&&!run.gamepad.dash)run.pressed.dash=true;run.keys.jump=jump;run.gamepad.jump=jump;run.gamepad.dash=dash;
  }

  function actionForCode(code){const entries=Object.entries(state.settings.keys);const hit=entries.find(([,v])=>v===code);if(hit)return hit[0];if(code==='ArrowLeft')return'left';if(code==='ArrowRight')return'right';if(code==='ArrowUp'||code==='KeyW')return'jump';if(code==='ArrowDown')return'down';return null;}

  function onKeyDown(e){
    if(state.keyCapture){e.preventDefault();state.settings.keys[state.keyCapture]=e.code;state.keyCapture=null;renderSettings(byId('rrPanelBody'));return;}
    if(!dialog.open)return;
    const run=state.run;if(!run||state.view!=='game'){if(e.code==='Escape'){e.preventDefault();close();}return;}
    const action=actionForCode(e.code);if(!action)return;e.preventDefault();if(action==='pause'){pauseToggle();return;}if(action==='restart'){startRun(run.mode);return;}if(action==='jump'&&!run.keys.jump)run.pressed.jump=true;if(action==='dash'&&!run.keys.dash)run.pressed.dash=true;run.keys[action]=true;
  }
  function onKeyUp(e){const run=state.run;if(!run)return;const action=actionForCode(e.code);if(action)run.keys[action]=false;}

  function bindMobile(){
    byId('rrMobileControls').querySelectorAll('[data-rr-control]').forEach(btn=>{
      const action=btn.dataset.rrControl;const down=e=>{e.preventDefault();const run=state.run;if(!run)return;state.mobilePointers.set(e.pointerId,action);if(action==='jump'&&!run.keys.jump)run.pressed.jump=true;if(action==='dash'&&!run.keys.dash)run.pressed.dash=true;run.keys[action]=true;btn.setPointerCapture?.(e.pointerId);};
      const up=e=>{e.preventDefault();const run=state.run;if(!run)return;const a=state.mobilePointers.get(e.pointerId)||action;run.keys[a]=false;state.mobilePointers.delete(e.pointerId);};btn.addEventListener('pointerdown',down);btn.addEventListener('pointerup',up);btn.addEventListener('pointercancel',up);btn.addEventListener('pointerleave',e=>{if(e.buttons===0)up(e)});
    });
  }

  function bind(){
    byId('chooseRepoRooftops')?.addEventListener('click',open);
    byId('rrClose').onclick=close;
    dialog.addEventListener('cancel',e=>{e.preventDefault();if(state.confirmResolver){settleRooftopsConfirm(false);return;}if(state.view==='game'&&state.run?.active)pauseToggle();else close();});
    byId('rrPlayEndless').onclick=()=>startRun('endless');
    byId('rrPlayDaily').onclick=()=>startRun('daily');
    byId('rrOpenModes').onclick=()=>openPanel('GAME MODES','modes');
    byId('rrCustomise').onclick=()=>openPanel('CREATE YOUR CHARACTER','character');
    byId('rrOpenLeaderboards').onclick=()=>openPanel('LEADERBOARDS','leaderboards');
    byId('rrOpenStats').onclick=()=>openPanel('STATISTICS & ACHIEVEMENTS','stats');
    byId('rrOpenSettings').onclick=()=>openPanel('SETTINGS','settings');
    byId('rrHowToPlay').onclick=()=>openPanel('HOW TO PLAY','howto');
    byId('rrPanelBack').onclick=()=>{applyView('menu');renderMenu();};
    byId('rrPauseButton').onclick=()=>pauseToggle();byId('rrResume').onclick=()=>pauseToggle(false);byId('rrRestart').onclick=()=>startRun(state.run?.mode||'endless');byId('rrEndRun').onclick=()=>finishRun('quit');byId('rrQuitRun').onclick=async()=>{await finishRun('quit');applyView('menu');renderMenu();};
    byId('rrSummaryAgain').onclick=()=>startRun(state.lastMode);byId('rrSummaryLeaderboard').onclick=()=>openPanel('LEADERBOARDS','leaderboards');byId('rrSummaryMenu').onclick=()=>{applyView('menu');renderMenu();};
    window.addEventListener('keydown',onKeyDown,{capture:true});window.addEventListener('keyup',onKeyUp,{capture:true});
    bindMobile();
  }

  bind();
  window.RepoRooftops={open,start:(mode='endless')=>startRun(mode),retryPendingReward};
})();
