(() => {
  'use strict';
  const R = window.REPOGGLE;
  const $ = id => document.getElementById(id);
  const dialog = $('repoggleDialog');
  const root = $('repoggleRoot');
  const rcDialog = $('runecraftingDialog');
  if (!R || !dialog || !root || !rcDialog) return;

  const PROFILE_KEY = 'repoRepoggleProfileV1';
  const FIXED_STEP = 1 / 240;
  const MAX_PARTICLES = 260;
  const TYPES = {
    stone: { r: 10, fill: '#526675', edge: '#a9c0cc', points: 100 },
    charged: { r: 11, fill: '#d57720', edge: '#ffe16c', points: 500 },
    power: { r: 11, fill: '#4d9a4c', edge: '#b9ff90', points: 300 },
    ancient: { r: 11, fill: '#73449a', edge: '#e1a9ff', points: 5000 },
    armoured: { r: 12, fill: '#66717c', edge: '#d9e0e5', points: 220 },
    chargedArmoured: { r: 13, fill: '#9d5a23', edge: '#ffe589', points: 700 },
    explosive: { r: 11, fill: '#7d3027', edge: '#ff9b5c', points: 800 }
  };
  const POWER_BY_ID = Object.fromEntries(R.powers.map(power => [power.id, power]));
  const iconImages = {};
  [...R.powers.map(x => x.icon), 'assets/runecrafting-icon.png'].forEach(src => {
    const image = new Image(); image.src = src; iconImages[src] = image;
  });

  const AUDIO_PROFILE_VERSION = 2;
  const defaultProfile = () => ({
    selectedPower: 'air', tutorialSeen: false, sound: true, audioVersion: AUDIO_PROFILE_VERSION, lastMapTop: 0,
    progress: {}, achievements: {}, totalCatches: 0, biggestCombo: 0,
    favouritePower: {}, campaignStartedAt: null, grandmaster: false
  });
  let profile = loadProfile();
  let currentScreen = 'title';
  let selectedLevel = 1;
  let canvas = null, ctx = null;
  let raf = 0, lastFrame = 0, accumulator = 0;
  let audio = null, audioMaster = null, audioCompressor = null, audioUnlockPromise = null;
  let activeAudioVoices = 0, lastPegSoundAt = 0, lastWallSoundAt = 0;
  const MAX_AUDIO_VOICES = 20;
  let remoteLoaded = false;
  let leaderboardRows = [];
  let game = null;
  let pointer = { x: R.W / 2, y: 260, active: false };
  let pausedByVisibility = false;

  function loadProfile() {
    try {
      const stored = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null') || {};
      const next = { ...defaultProfile(), ...stored };
      // Earlier Repoggle builds silently defaulted every player to muted. Migrate once
      // to the repaired audio system; it still makes no sound until a user gesture.
      if ((Number(stored.audioVersion) || 0) < AUDIO_PROFILE_VERSION) {
        next.sound = true;
        next.audioVersion = AUDIO_PROFILE_VERSION;
      }
      return next;
    }
    catch (_) { return defaultProfile(); }
  }
  function saveProfile() { try { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); } catch (_) {} }
  function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[c])); }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function formatNumber(value) { return Math.round(Number(value) || 0).toLocaleString('en-GB'); }
  function formatTime(ms) { const s = Math.max(0, Math.floor((Number(ms) || 0) / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
  function progressFor(level) { return profile.progress[level] || null; }
  function completedLevelCount() { return Object.values(profile.progress).filter(p => p.completed).length; }
  function totalStars() { return Object.values(profile.progress).reduce((sum, p) => sum + (Number(p.stars) || 0), 0); }
  function totalBestScore() { return Object.values(profile.progress).reduce((sum, p) => sum + (Number(p.bestScore) || 0), 0); }
  function highestUnlocked() { return Math.min(50, completedLevelCount() ? Math.max(...Object.keys(profile.progress).filter(k => profile.progress[k]?.completed).map(Number)) + 1 : 1); }
  function isUnlocked(level) { return level === 1 || Boolean(profile.progress[level - 1]?.completed); }
  function unlockedPower(power) { return highestUnlocked() >= power.unlock; }
  function regionFor(level) { return R.regions[Math.floor((level - 1) / 10)]; }
  function goldFor(level) { return R.goldForLevel(level); }
  function xpFor(level) { return R.xpForLevel(level); }
  function currentCharacterName() { return typeof character !== 'undefined' && character?.username ? character.username : 'Guest'; }
  function signedIn() { return typeof character !== 'undefined' && Boolean(character); }

  function ensureAudioGraph() {
    if (!profile.sound) return null;
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return null;
    if (!audio) {
      try { audio = new AudioContextCtor({ latencyHint: 'interactive' }); }
      catch (_) { audio = new AudioContextCtor(); }
      audioMaster = audio.createGain();
      audioMaster.gain.value = .46;
      audioCompressor = audio.createDynamicsCompressor();
      audioCompressor.threshold.value = -20;
      audioCompressor.knee.value = 18;
      audioCompressor.ratio.value = 5;
      audioCompressor.attack.value = .004;
      audioCompressor.release.value = .18;
      audioMaster.connect(audioCompressor);
      audioCompressor.connect(audio.destination);
    }
    return audio;
  }
  function setMasterEnabled(enabled) {
    if (!audio || !audioMaster) return;
    const now = audio.currentTime;
    audioMaster.gain.cancelScheduledValues(now);
    audioMaster.gain.setValueAtTime(Math.max(.0001, audioMaster.gain.value), now);
    audioMaster.gain.linearRampToValueAtTime(enabled ? .46 : .0001, now + .035);
  }
  function withAudio(play) {
    if (!profile.sound) return;
    const a = ensureAudioGraph();
    if (!a) return;
    const run = () => {
      if (!profile.sound || a.state !== 'running') return;
      setMasterEnabled(true);
      try { play(a, audioMaster); } catch (_) {}
    };
    if (a.state === 'running') { run(); return; }
    if (!audioUnlockPromise) {
      audioUnlockPromise = a.resume().catch(() => null).finally(() => { audioUnlockPromise = null; });
    }
    audioUnlockPromise.then(run);
  }
  function unlockAudio() { withAudio(() => {}); }
  function setSoundEnabled(enabled, preview = false) {
    profile.sound = Boolean(enabled);
    profile.audioVersion = AUDIO_PROFILE_VERSION;
    saveProfile();
    const button = $('repSound');
    if (button) {
      button.textContent = profile.sound ? 'SOUND ON' : 'SOUND OFF';
      button.setAttribute('aria-pressed', String(profile.sound));
      button.title = profile.sound ? 'Sound enabled — click to mute' : 'Sound muted — click to enable';
    }
    if (!profile.sound) { setMasterEnabled(false); return; }
    unlockAudio();
    if (preview) soundPreview();
  }
  function beginVoice() {
    if (activeAudioVoices >= MAX_AUDIO_VOICES) return false;
    activeAudioVoices += 1;
    return true;
  }
  function finishVoice() { activeAudioVoices = Math.max(0, activeAudioVoices - 1); }
  function tone(freq, duration = .08, type = 'sine', gainValue = .05, when = 0, slideTo = null) {
    withAudio((a, output) => {
      if (!beginVoice()) return;
      const start = a.currentTime + Math.max(0, when), stop = start + Math.max(.025, duration);
      const o = a.createOscillator(), gain = a.createGain();
      o.type = type;
      o.frequency.setValueAtTime(Math.max(35, freq), start);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(35, slideTo), stop);
      gain.gain.setValueAtTime(.0001, start);
      gain.gain.linearRampToValueAtTime(Math.max(.0001, gainValue), start + Math.min(.008, duration * .18));
      gain.gain.exponentialRampToValueAtTime(.0001, stop);
      o.connect(gain); gain.connect(output);
      o.onended = finishVoice;
      o.start(start); o.stop(stop + .01);
    });
  }
  function noise(duration = .18, gainValue = .045, lowpass = 900, when = 0) {
    withAudio((a, output) => {
      if (!beginVoice()) return;
      const len = Math.max(1, Math.floor(a.sampleRate * duration));
      const buffer = a.createBuffer(1, len, a.sampleRate), data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.6);
      const src = a.createBufferSource(), filter = a.createBiquadFilter(), gain = a.createGain();
      const start = a.currentTime + Math.max(0, when), stop = start + duration;
      filter.type = 'lowpass'; filter.frequency.value = lowpass; filter.Q.value = .7;
      gain.gain.setValueAtTime(.0001, start);
      gain.gain.linearRampToValueAtTime(gainValue, start + .006);
      gain.gain.exponentialRampToValueAtTime(.0001, stop);
      src.buffer = buffer; src.connect(filter); filter.connect(gain); gain.connect(output);
      src.onended = finishVoice;
      src.start(start); src.stop(stop + .01);
    });
  }
  function soundPreview() {
    [392, 523.25, 659.25].forEach((f, i) => tone(f, .16, 'triangle', .075, i * .055));
  }
  function launchSound() { tone(155, .13, 'triangle', .075, 0, 330); noise(.07, .025, 1800); }
  function musicalHit(index, pegType = 'stone', fromExplosion = false) {
    const now = performance.now();
    if (now - lastPegSoundAt < (fromExplosion ? 34 : 20)) return;
    lastPegSoundAt = now;
    const scale = [0, 2, 4, 7, 9, 12, 14, 16];
    const step = scale[(Math.max(1, index) - 1) % scale.length] + Math.min(9, Math.floor((index - 1) / scale.length) * 3);
    const freq = 196 * Math.pow(2, step / 12);
    const bright = pegType === 'charged' || pegType === 'chargedArmoured' || pegType === 'ancient';
    const gain = bright ? .082 : fromExplosion ? .052 : .062;
    tone(freq, .105, 'triangle', gain);
    if (bright) tone(freq * 2, .065, 'sine', gain * .28, .006);
  }
  function wallBounceSound() {
    const now = performance.now();
    if (now - lastWallSoundAt < 58) return;
    lastWallSoundAt = now;
    tone(135, .035, 'square', .018);
  }
  function armourCrackSound() { tone(175, .09, 'square', .045, 0, 125); tone(720, .055, 'triangle', .032, .012); noise(.075, .034, 1450); }
  function explosionSound() { tone(95, .28, 'sine', .105, 0, 48); noise(.24, .082, 620); }
  function powerActivationSound() { [330, 495, 660].forEach((f, i) => tone(f, .2, 'triangle', .07 - i * .008, i * .045)); }
  function ancientRuneSound() { [660, 880, 1320].forEach((f, i) => tone(f, .24, i === 0 ? 'triangle' : 'sine', .075 - i * .012, i * .055)); }
  function portalSound() { tone(390, .16, 'sine', .05, 0, 760); tone(920, .09, 'triangle', .032, .045); }
  function freeOrbSound() { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, .18, 'triangle', .07 - i * .008, i * .045)); }
  function reboundSound() { tone(210, .18, 'triangle', .06, 0, 520); tone(780, .11, 'sine', .04, .07); }
  function skillShotSound() { tone(440, .09, 'triangle', .04); tone(660, .12, 'sine', .035, .045); }
  function phaseShiftSound() { tone(210, .22, 'triangle', .055, 0, 420); noise(.12, .028, 1100, .03); }
  function frenzySound() { [196, 293.66, 392, 523.25, 783.99].forEach((f, i) => tone(f, .34, 'triangle', .072 - i * .006, i * .065)); }
  function completionSting() { [392, 523.25, 659.25, 783.99].forEach((f, i) => tone(f, .28, 'triangle', .064 - i * .006, i * .07)); }
  function failureSound() { [246.94, 207.65, 164.81].forEach((f, i) => tone(f, .24, 'triangle', .05 - i * .006, i * .09)); }


  function openModeHub() {
    stopGameLoop();
    if (typeof leaveRcRoom === 'function') leaveRcRoom();
    $('rcModeHub')?.classList.remove('hidden');
    $('rcLobby')?.classList.add('hidden');
    $('rcGame')?.classList.add('hidden');
    if (!rcDialog.open) rcDialog.showModal();
  }
  function openPool() {
    $('rcModeHub')?.classList.add('hidden');
    $('rcLobby')?.classList.remove('hidden');
    $('rcGame')?.classList.add('hidden');
    if ($('rcLobbyMessage')) $('rcLobbyMessage').textContent = 'Single player needs no room code. Online mode requires two logged-in accounts.';
  }
  async function openRepoggle() {
    unlockAudio();
    if (rcDialog.open) rcDialog.close();
    if (!dialog.open) dialog.showModal();
    renderTitle();
    if (!remoteLoaded) loadRemoteProgress();
  }
  function closeRepoggle(returnToModes = false) {
    stopGameLoop();
    if (dialog.open) dialog.close();
    if (returnToModes) openModeHub();
  }

  function shell(body, screenClass = '') {
    currentScreen = screenClass || currentScreen;
    root.innerHTML = `
      <header class="rep-header">
        <button class="rep-header-back" id="repHeaderBack" type="button">← RUNECRAFTING MODES</button>
        <div class="rep-brand"><img src="assets/repoggle/repoggle-logo.svg" alt="Repoggle"><div><small>LEVEL RUNECRAFTING</small><strong>REPOGGLE</strong><span>50-LEVEL RUNE-BOUNCING CAMPAIGN</span></div></div>
        <div class="rep-header-actions"><button id="repSound" type="button" aria-pressed="${profile.sound}" title="${profile.sound ? 'Sound enabled — click to mute' : 'Sound muted — click to enable'}">${profile.sound ? 'SOUND ON' : 'SOUND OFF'}</button><button id="repClose" type="button" aria-label="Close">×</button></div>
      </header>
      <div class="rep-body ${screenClass}">${body}</div>`;
    $('repHeaderBack')?.addEventListener('click', () => closeRepoggle(true));
    $('repClose')?.addEventListener('click', () => closeRepoggle(false));
    $('repSound')?.addEventListener('click', () => setSoundEnabled(!profile.sound, true));
  }

  function renderTitle() {
    stopGameLoop();
    const complete = completedLevelCount(), stars = totalStars(), pct = Math.round((complete / 50) * 100);
    shell(`
      <section class="rep-title-screen">
        <div class="rep-title-art" aria-hidden="true"><div class="rep-orb-demo"></div>${Array.from({length:14},(_,i)=>`<i style="--i:${i}"></i>`).join('')}<b>RUNE FRENZY</b></div>
        <div class="rep-title-copy">
          <img src="assets/repoggle/repoggle-logo.svg" alt="Repoggle" class="rep-title-logo">
          <p>Aim a magical rune orb, bounce through charged pegs and conquer five Runecrafting regions.</p>
          <div class="rep-title-stats"><span>CAMPAIGN<b>${pct}%</b></span><span>LEVELS<b>${complete}/50</b></span><span>STARS<b>${stars}/150</b></span><span>BEST COMBO<b>${profile.biggestCombo || 0}</b></span></div>
          <button id="repContinue" class="rep-primary" type="button">${complete ? `CONTINUE · LEVEL ${highestUnlocked()}` : 'BEGIN CAMPAIGN'}</button>
          <div class="rep-title-links"><button id="repMap" type="button">CAMPAIGN MAP</button><button id="repTutorial" type="button">HOW TO PLAY</button><button id="repRecords" type="button">STATS & RECORDS</button></div>
          <small>${signedIn() ? `Playing as ${escapeHtml(currentCharacterName())}. First-completion rewards save securely.` : 'Guest mode: gameplay and local progress work, but gold and XP require sign-in.'}</small>
        </div>
      </section>`, 'title');
    $('repContinue').onclick = () => openLevelFlow(highestUnlocked());
    $('repMap').onclick = renderMap;
    $('repTutorial').onclick = () => showTutorial(true);
    $('repRecords').onclick = renderRecords;
    if (!profile.tutorialSeen) setTimeout(() => dialog.open && currentScreen === 'title' && showTutorial(false), 250);
  }

  function renderMap() {
    stopGameLoop();
    const levelNodes = R.levels.map(level => {
      const prog = progressFor(level.id), locked = !isUnlocked(level.id), next = level.id === highestUnlocked();
      return `<button class="rep-level-node ${locked?'locked':''} ${prog?.completed?'completed':''} ${next?'next':''} ${level.boss?'boss':''}" data-level="${level.id}" ${locked?'disabled':''} type="button">
        <span>${level.boss ? '◆' : level.id}</span><strong>${escapeHtml(level.name)}</strong><small>${prog?.completed ? `${'★'.repeat(prog.stars || 1)}${'☆'.repeat(3-(prog.stars||1))} · ${formatNumber(prog.bestScore)}` : locked ? 'LOCKED' : 'READY'}</small>
      </button>`;
    }).join('');
    shell(`
      <section class="rep-map-screen">
        <div class="rep-section-heading"><div><small>CAMPAIGN</small><h2>THE RUNECRAFTING JOURNEY</h2><p>One completion star unlocks the next level. Replay completed levels for score and stars—never repeat rewards.</p></div><button id="repMapStats" type="button">STATS & ACHIEVEMENTS</button></div>
        <div class="rep-map-summary"><span>COMPLETED<b>${completedLevelCount()}/50</b></span><span>TOTAL STARS<b>${totalStars()}/150</b></span><span>CAMPAIGN SCORE<b>${formatNumber(totalBestScore())}</b></span><span>NEXT LEVEL<b>${highestUnlocked()}</b></span></div>
        <div id="repMapScroller" class="rep-map-scroller">${R.regions.map((region,ri)=>`<section class="rep-region rep-region-${region.key}"><header><span>REGION ${ri+1}</span><h3>${escapeHtml(region.name)}</h3><small>LEVELS ${ri*10+1}–${ri*10+10}</small></header><div class="rep-region-path">${levelNodes.split('</button>').slice(ri*10,ri*10+10).map(x=>x+'</button>').join('')}</div></section>`).join('')}</div>
      </section>`, 'map');
    const scroller = $('repMapScroller'); if (scroller) { scroller.scrollTop = profile.lastMapTop || 0; scroller.addEventListener('scroll', () => { profile.lastMapTop = scroller.scrollTop; saveProfile(); }, { passive:true }); }
    root.querySelectorAll('[data-level]').forEach(button => button.onclick = () => openLevelFlow(Number(button.dataset.level)));
    $('repMapStats').onclick = renderRecords;
  }

  function openLevelFlow(levelNumber) {
    if (!isUnlocked(levelNumber)) return;
    selectedLevel = levelNumber;
    renderPowerSelect();
  }

  function renderPowerSelect() {
    stopGameLoop();
    const level = R.levels[selectedLevel - 1];
    const powers = R.powers.map(power => {
      const unlocked = unlockedPower(power), active = profile.selectedPower === power.id;
      return `<button class="rep-power-card ${active?'selected':''} ${unlocked?'':'locked'}" data-power="${power.id}" ${unlocked?'':'disabled'} type="button"><img src="${power.icon}" alt=""><span><strong>${power.name}</strong><small>${unlocked ? power.desc : `Unlock after Level ${power.unlock - 1}`}</small></span><b>${active?'SELECTED':unlocked?'CHOOSE':'LOCKED'}</b><i class="rep-power-preview" data-preview="${power.id}"></i></button>`;
    }).join('');
    shell(`
      <section class="rep-select-screen">
        <div class="rep-breadcrumb"><button id="repToMap" type="button">← MAP</button><span>LEVEL ${level.id} · ${escapeHtml(level.name)}</span></div>
        <div class="rep-section-heading"><div><small>CHOOSE ONE RUNE POWER</small><h2>PREPARE YOUR OFFERING</h2><p>Power Pegs activate the selected ability. Every level remains possible with any unlocked power.</p></div></div>
        <div class="rep-power-grid">${powers}</div>
        <button id="repPowerContinue" class="rep-primary" type="button">VIEW LEVEL ${level.id}</button>
      </section>`, 'power-select');
    root.querySelectorAll('[data-power]:not(:disabled)').forEach(button => button.onclick = () => { profile.selectedPower = button.dataset.power; profile.favouritePower[button.dataset.power] = (profile.favouritePower[button.dataset.power] || 0) + 1; saveProfile(); renderPowerSelect(); });
    $('repToMap').onclick = renderMap;
    $('repPowerContinue').onclick = renderLevelPreview;
  }

  function renderLevelPreview() {
    stopGameLoop();
    const level = R.levels[selectedLevel - 1], progress = progressFor(selectedLevel), region = regionFor(selectedLevel), power = POWER_BY_ID[profile.selectedPower];
    const targetCount = level.pegs.filter(q => q.type === 'charged' || q.type === 'chargedArmoured').length;
    shell(`
      <section class="rep-preview-screen rep-theme-${region.key}">
        <div class="rep-breadcrumb"><button id="repChangePower" type="button">← CHANGE POWER</button><span>${escapeHtml(level.regionName)}</span></div>
        <div class="rep-preview-card">
          <div class="rep-preview-board"><canvas id="repPreviewCanvas" width="900" height="600"></canvas><span>LEVEL ${level.id}</span></div>
          <div class="rep-preview-info"><small>${level.boss?'BOSS ALTAR':'ALTAR'}</small><h2>${escapeHtml(level.name)}</h2><p>${escapeHtml(level.hint)}</p>
            <div class="rep-preview-facts"><span>RUNE ORBS<b>${level.orbs}</b></span><span>CHARGED TARGETS<b>${targetCount}</b></span><span>2 STARS<b>${formatNumber(level.starScores[1])}</b></span><span>3 STARS<b>${formatNumber(level.starScores[2])}</b></span></div>
            <div class="rep-preview-power"><img src="${power.icon}" alt=""><span><small>SELECTED POWER</small><strong>${power.name}</strong><em>${power.desc}</em></span></div>
            <div class="rep-preview-rewards"><span>FIRST CLEAR GOLD<b>${formatNumber(goldFor(level.id))}</b></span><span>FIRST CLEAR XP<b>${formatNumber(xpFor(level.id))}</b></span></div>
            ${progress?.completed ? `<b class="rep-claimed-note">REWARDS ALREADY CLAIMED · BEST ${formatNumber(progress.bestScore)}</b>` : ''}
            <button id="repStartLevel" class="rep-primary" type="button">START LEVEL</button>
          </div>
        </div>
      </section>`, 'preview');
    $('repChangePower').onclick = renderPowerSelect;
    $('repStartLevel').onclick = startLevel;
    drawPreview(level);
  }

  function drawPreview(level) {
    const c = $('repPreviewCanvas'); if (!c) return; const x = c.getContext('2d');
    drawBoardBackground(x, level, 0);
    level.obstacles.forEach(o => drawObstacle(x, o, 0, true));
    level.portals.forEach(portal => drawPortal(x, portal, 0));
    level.pegs.forEach(peg => drawPeg(x, { ...peg, r: TYPES[peg.type]?.r || 10, hp: peg.hp || (peg.type.includes('Armoured') ? 2 : 1) }, 0, true));
    drawCollector(x, 450, false);
  }

  async function startLevel() {
    const level = R.levels[selectedLevel - 1];
    game = createGame(level);
    renderGameScreen();
    if (!profile.campaignStartedAt) { profile.campaignStartedAt = Date.now(); saveProfile(); }
    startGameLoop();
    announcement(`LEVEL ${level.id} · ${level.name}`, 'level');
    if (signedIn() && typeof db !== 'undefined' && db?.rpc) {
      try {
        const { data, error } = await db.rpc('start_repoggle_level', { p_level_number: level.id });
        if (!error && game?.level?.id === level.id) game.sessionId = (Array.isArray(data) ? data[0] : data)?.session_id || data;
      } catch (_) {}
    }
  }

  function createGame(level) {
    const pegs = level.pegs.map((q, i) => ({ ...q, id: i + 1, baseX: q.x, baseY: q.y, x: q.x, y: q.y, r: TYPES[q.type]?.r || 10, hp: q.hp || (q.type === 'armoured' || q.type === 'chargedArmoured' ? 2 : 1), maxHp: q.hp || (q.type === 'armoured' || q.type === 'chargedArmoured' ? 2 : 1), cleared: false, hitThisShot: false, lastHit: -10 }));
    const initialTargets = pegs.filter(isTarget).length;
    return {
      state: 'aiming', level, pegs, obstacles: JSON.parse(JSON.stringify(level.obstacles)), portals: JSON.parse(JSON.stringify(level.portals)), balls: [], particles: [], trails: [], floaters: [], announcements: [],
      launcher: { x: R.W / 2, y: 44 }, collectorX: R.W / 2, collectorDir: 1,
      orbs: level.orbs, initialOrbs: level.orbs, score: 0, displayedScore: 0, initialTargets, targetsRemaining: initialTargets,
      shotNumber: 0, shotScore: 0, shotPegs: 0, shotWalls: 0, shotDistance: 0, shotCatches: 0, levelCatches: 0, biggestCombo: 0, skillShots: [], pegsCleared: 0,
      targetHitsThisShot: 0, shotsWithoutTarget: 0, guidanceUses: 0,
      selectedPower: profile.selectedPower, powerActivated: false, airReady: false, waterShots: 0, natureSave: false, lawShots: 0, chaosUses: 0,
      frenzy: false, frenzyStartedAt: 0, frenzyPortalBonus: 0, rewardPortals: [], completed: false, failed: false,
      startTime: performance.now(), elapsedMs: 0, sessionId: null, phaseIndex: 0, shake: 0, flash: 0,
      rngState: level.seed >>> 0, pointerDown: false, lastShotAt: 0, paused: false
    };
  }

  function renderGameScreen() {
    const level = game.level, region = regionFor(level.id), power = POWER_BY_ID[game.selectedPower];
    shell(`
      <section class="rep-game-screen rep-theme-${region.key}">
        <div class="rep-game-hud"><span>LEVEL<b>${level.id}</b></span><span>SCORE<b id="repScore">0</b></span><span>CHARGED PEGS<b id="repTargets">${game.targetsRemaining}</b></span><span>ORBS<b id="repOrbs">${game.orbs}</b></span><span>MULTIPLIER<b id="repMultiplier">×1.0</b></span><span>BEST COMBO<b id="repCombo">0</b></span></div>
        <div class="rep-game-layout">
          <main class="rep-canvas-shell"><canvas id="repCanvas" width="900" height="600" aria-label="Repoggle game board"></canvas><div id="repAnnouncementLayer" class="rep-announcement-layer" aria-live="polite"></div><div id="repPause" class="rep-pause hidden"><strong>PAUSED</strong><span>Return to the tab to continue.</span></div></main>
          <aside class="rep-game-side"><div class="rep-level-title"><small>${escapeHtml(level.regionName)}</small><strong>${level.id}. ${escapeHtml(level.name)}</strong></div>
            <div class="rep-power-status"><img src="${power.icon}" alt=""><span><small>RUNE POWER</small><strong>${power.name}</strong><em id="repPowerState">Hit a green Power Peg</em></span></div>
            <div class="rep-aim-help"><strong>AIM & FIRE</strong><span>Move the mouse or finger to aim.</span><span>Click or tap the board to launch.</span><span>The dotted guide ends at the first collision.</span></div>
            <div class="rep-shot-panel"><span>SHOT SCORE<b id="repShotScore">0</b></span><span>PEGS THIS ORB<b id="repShotPegs">0</b></span><span>WALL BOUNCES<b id="repShotWalls">0</b></span></div>
            <button id="repRestart" type="button">INSTANT RESTART</button><button id="repGameMap" type="button">RETURN TO MAP</button>
          </aside>
        </div>
      </section>`, 'game');
    canvas = $('repCanvas'); ctx = canvas.getContext('2d');
    canvas.addEventListener('pointermove', aimPointer, { passive:false });
    canvas.addEventListener('pointerdown', firePointer, { passive:false });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    $('repRestart').onclick = () => startLevel();
    $('repGameMap').onclick = () => { stopGameLoop(); renderMap(); };
    updateHud(); resizeCanvas();
  }

  function pointerToBoard(event) {
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;

    // clientX/clientY and getBoundingClientRect() use the same viewport coordinate
    // system. Scale from the rendered canvas back into its fixed 900x600 board.
    const style = getComputedStyle(canvas);
    const borderLeft = parseFloat(style.borderLeftWidth) || 0;
    const borderRight = parseFloat(style.borderRightWidth) || 0;
    const borderTop = parseFloat(style.borderTopWidth) || 0;
    const borderBottom = parseFloat(style.borderBottomWidth) || 0;
    const contentWidth = Math.max(1, rect.width - borderLeft - borderRight);
    const contentHeight = Math.max(1, rect.height - borderTop - borderBottom);
    const clientX = Number(event.clientX);
    const clientY = Number(event.clientY);
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return null;

    return {
      x: clamp((clientX - rect.left - borderLeft) * (canvas.width / contentWidth), 0, canvas.width),
      y: clamp((clientY - rect.top - borderTop) * (canvas.height / contentHeight), 0, canvas.height)
    };
  }

  function aimPointer(event) {
    if (!game || game.state !== 'aiming') return;
    event.preventDefault();
    const point = pointerToBoard(event);
    if (!point) return;
    pointer.x = point.x;
    pointer.y = point.y;
    pointer.active = true;
  }

  function getAimVector() {
    const dx = pointer.x - game.launcher.x;
    // Honour the clicked point. Only prevent a fully horizontal/upward launch.
    const dy = Math.max(12, pointer.y - game.launcher.y);
    const mag = Math.hypot(dx, dy) || 1;
    return { dx, dy, mag, vx: dx / mag * 610, vy: dy / mag * 610 };
  }
  function firePointer(event) {
    if (!game || game.state !== 'aiming') return;
    event.preventDefault(); aimPointer(event); launchOrb();
  }
  function keyHandler(event) {
    if (dialog.open && profile.sound) unlockAudio();
    if (!dialog.open || currentScreen !== 'game' || !game) return;
    if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); if (game.state === 'aiming') launchOrb(); }
    if (event.key === 'ArrowLeft') { pointer.x -= 24; pointer.active = true; }
    if (event.key === 'ArrowRight') { pointer.x += 24; pointer.active = true; }
    if (event.key.toLowerCase() === 'r') startLevel();
  }

  function launchOrb() {
    if (!game || game.state !== 'aiming' || game.orbs <= 0) return;
    const aim = getAimVector();
    game.orbs -= 1; game.shotNumber += 1; game.state = 'shooting'; game.shotScore = 0; game.shotPegs = 0; game.shotWalls = 0; game.shotDistance = 0; game.shotCatches = 0; game.targetHitsThisShot = 0;
    game.pegs.forEach(p => p.hitThisShot = false);
    game.balls = [makeBall(game.launcher.x, game.launcher.y + 15, aim.vx, aim.vy)];
    launchSound(); updateHud();
  }
  function makeBall(x, y, vx, vy, small = false) { return { x, y, vx, vy, r: small ? 6 : 8, alive: true, small, portalCooldown: 0, split: false, stuckFor: 0, life: 0, lastX: x, lastY: y, luckyLow: false }; }

  function startGameLoop() { if (raf) cancelAnimationFrame(raf); raf = 0; lastFrame = performance.now(); accumulator = 0; raf = requestAnimationFrame(frame); }
  function stopGameLoop() { if (raf) cancelAnimationFrame(raf); raf = 0; canvas = null; ctx = null; }
  function frame(now) {
    if (!game || currentScreen !== 'game' || !dialog.open) { raf = 0; return; }
    const dt = Math.min(.05, Math.max(0, (now - lastFrame) / 1000)); lastFrame = now;
    if (!game.paused) {
      accumulator += dt * (game.frenzy && now - game.frenzyStartedAt < 1500 ? .42 : 1);
      let steps = 0;
      while (accumulator >= FIXED_STEP && steps < 18) { update(FIXED_STEP); accumulator -= FIXED_STEP; steps++; }
      game.elapsedMs = now - game.startTime;
    }
    draw(now / 1000);
    raf = requestAnimationFrame(frame);
  }

  function update(dt) {
    updateMovingObjects(dt);
    updateParticles(dt);
    if (game.state !== 'shooting' && game.state !== 'frenzy') return;
    for (const ball of game.balls) if (ball.alive) updateBall(ball, dt);
    game.balls = game.balls.filter(ball => ball.alive);
    if (!game.balls.length && (game.state === 'shooting' || game.state === 'frenzy')) endShot();
    game.shake *= .9; game.flash *= .88;
  }

  function updateMovingObjects() {
    const frozen = game.lawShots > 0;
    const t = game.elapsedMs / 1000;
    for (const peg of game.pegs) {
      if (!peg.motion || frozen) continue;
      const m = peg.motion, phase = (m.phase || 0) + t * (m.speed || 1);
      if (m.kind === 'sineX') peg.x = peg.baseX + Math.sin(phase) * (m.amp || 0);
      else if (m.kind === 'sineY') peg.y = peg.baseY + Math.sin(phase) * (m.amp || 0);
      else if (m.kind === 'orbit') { const cx = R.W/2, cy = 320, dx = peg.baseX-cx, dy=peg.baseY-cy, a=(m.speed||.2)*t; peg.x=cx+dx*Math.cos(a)-dy*Math.sin(a); peg.y=cy+dx*Math.sin(a)+dy*Math.cos(a); }
    }
    for (const obstacle of game.obstacles) {
      if (!obstacle.motion || frozen) continue;
      if (obstacle._baseX == null) { obstacle._baseX = obstacle.x; obstacle._baseY = obstacle.y; }
      const m = obstacle.motion, phase = (m.phase || 0) + t * (m.speed || 1);
      if (m.kind === 'sineX') obstacle.x = obstacle._baseX + Math.sin(phase) * (m.amp || 0);
      if (m.kind === 'sineY') obstacle.y = obstacle._baseY + Math.sin(phase) * (m.amp || 0);
    }
    if (!frozen) game.collectorX = 450 + Math.sin(t * .92) * 330;
    else game.collectorX += (450 - game.collectorX) * .06;
  }

  function updateBall(ball, dt) {
    ball.life += dt; ball.portalCooldown = Math.max(0, ball.portalCooldown - dt);
    const oldX = ball.x, oldY = ball.y;
    ball.vy += 520 * dt;
    const speed = Math.hypot(ball.vx, ball.vy); if (speed > 940) { ball.vx *= 940/speed; ball.vy *= 940/speed; }
    ball.x += ball.vx * dt; ball.y += ball.vy * dt;
    game.shotDistance += Math.hypot(ball.x-oldX, ball.y-oldY);
    if (ball.y > 510) ball.luckyLow = true;
    if (ball.x - ball.r < 8) { ball.x = 8 + ball.r; ball.vx = Math.abs(ball.vx) * .88; wallHit(ball); }
    if (ball.x + ball.r > R.W - 8) { ball.x = R.W - 8 - ball.r; ball.vx = -Math.abs(ball.vx) * .88; wallHit(ball); }
    if (ball.y - ball.r < 76) { ball.y = 76 + ball.r; ball.vy = Math.abs(ball.vy) * .86; wallHit(ball); }
    // Resolve collectable pegs before solid geometry. A peg that visually touches a
    // spinner or shelf remains hittable instead of being hidden behind its collider.
    collidePortals(ball);
    collidePegs(ball);
    collideObstacles(ball);
    addTrail(ball);
    const movement = Math.hypot(ball.x - ball.lastX, ball.y - ball.lastY);
    if (movement < .06 && Math.hypot(ball.vx,ball.vy)<25) ball.stuckFor += dt; else ball.stuckFor = 0;
    ball.lastX = ball.x; ball.lastY = ball.y;
    if (ball.stuckFor > 2.5) { ball.vx += (rand()-.5)*220; ball.vy = -300; ball.stuckFor=0; announcement('ORB RECOVERED', 'skill'); }
    if (ball.life > 34) { ball.alive = false; game.orbs += 1; announcement('STUCK ORB RETURNED', 'free'); }
    if (ball.y - ball.r > R.H - 15) handleBallExit(ball);
  }
  function wallHit(ball) { game.shotWalls += 1; wallBounceSound(); spawnParticles(ball.x, ball.y, '#c8e7ff', 3, 80); }

  function collidePegs(ball) {
    const now = game.elapsedMs / 1000;
    for (const peg of game.pegs) {
      if (peg.removed) continue;
      const assistRadius = peg.guided ? 8 : 0;
      const dx = ball.x - peg.x, dy = ball.y - peg.y, min = ball.r + peg.r + assistRadius, d2 = dx*dx + dy*dy;
      if (d2 >= min*min || d2 < .0001) continue;
      const d = Math.sqrt(d2), nx = dx/d, ny = dy/d, overlap = min-d;
      ball.x += nx * overlap; ball.y += ny * overlap;
      const dot = ball.vx*nx + ball.vy*ny;
      if (dot < 0) { ball.vx -= 1.88*dot*nx; ball.vy -= 1.88*dot*ny; ball.vx*=.985; ball.vy*=.985; }
      if (now - peg.lastHit > .11) { peg.lastHit = now; hitPeg(peg, ball); }
    }
  }

  function hitPeg(peg, ball, fromExplosion = false) {
    if (peg.cleared && peg.type !== 'armoured' && peg.type !== 'chargedArmoured') return;
    if (!peg.hitThisShot) { peg.hitThisShot = true; game.shotPegs += 1; game.biggestCombo = Math.max(game.biggestCombo, game.shotPegs); }
    const base = TYPES[peg.type]?.points || 100, mult = scoreMultiplier();
    let points = Math.round(base * mult * (1 + Math.min(2.5, game.shotPegs * .035)));
    if (fromExplosion) points = Math.round(points * 1.18);
    addScore(points, peg.x, peg.y);
    musicalHit(game.shotPegs, peg.type, fromExplosion);
    spawnParticles(peg.x, peg.y, TYPES[peg.type]?.edge || '#fff', peg.type.includes('charged') ? 10 : 5, peg.type === 'explosive' ? 260 : 130);

    if (peg.type === 'armoured' || peg.type === 'chargedArmoured') {
      peg.hp -= 1; armourCrackSound();
      if (peg.hp > 0) { announcement('ARMOURED PEG CRACKED', 'small'); return; }
    }
    peg.cleared = true;
    if (isTarget(peg)) { game.targetsRemaining = Math.max(0, game.targetsRemaining - 1); game.pegsCleared += 1; game.targetHitsThisShot += 1; game.flash = Math.max(game.flash,.2); }
    else game.pegsCleared += 1;
    if (peg.type === 'ancient') { addScore(Math.round(4500*scoreMultiplier()),peg.x,peg.y); announcement('ANCIENT RUNE!', 'ancient'); ancientRuneSound(); }
    if (peg.type === 'explosive') explodePeg(peg);
    if (peg.type === 'power') activatePower(peg, ball);
    if (game.airReady && !ball.split && peg.type !== 'power') splitOrb(ball);
    checkPhase();
    if (game.targetsRemaining === 0 && !game.frenzy) beginFrenzy();
  }
  function isTarget(peg) { return peg.type === 'charged' || peg.type === 'chargedArmoured'; }
  function scoreMultiplier() { return 1 + (1 - game.targetsRemaining / Math.max(1, game.initialTargets)) * 4; }
  function addScore(points, x, y) { game.score += points; game.shotScore += points; game.floaters.push({x,y,text:`+${formatNumber(points)}`,life:1}); if(game.floaters.length>30)game.floaters.shift(); }

  function explodePeg(peg) {
    explosionSound(); game.shake = Math.max(game.shake,8); game.flash=.75;
    const nearby = game.pegs.filter(q => !q.cleared && !q.removed && q.id !== peg.id && Math.hypot(q.x-peg.x,q.y-peg.y)<92).sort((a,b)=>Math.hypot(a.x-peg.x,a.y-peg.y)-Math.hypot(b.x-peg.x,b.y-peg.y));
    nearby.slice(0,8).forEach((q,i)=>{ q.lastHit=-10; hitPeg(q,{split:true},true); spawnParticles(q.x,q.y,'#ffaf5b',6,180); });
    if (nearby.length >= 5) skillShot('CHAOS CHAIN');
  }

  function activatePower(peg, ball) {
    game.powerActivated = true;
    const id = game.selectedPower;
    announcement(`${POWER_BY_ID[id].name.toUpperCase()}!`, 'power');
    powerActivationSound();
    if (id === 'air') game.airReady = true;
    if (id === 'water') game.waterShots = Math.max(game.waterShots, 3);
    if (id === 'earth') {
      game.pegs.filter(q => !q.cleared && !q.removed && q.id !== peg.id && Math.hypot(q.x-peg.x,q.y-peg.y)<125).slice(0,14).forEach(q=>hitPeg(q,{split:true},true));
      game.shake=10;
    }
    if (id === 'nature') game.natureSave = true;
    if (id === 'law') game.lawShots = Math.max(game.lawShots,2);
    if (id === 'chaos') {
      const candidates = game.pegs.filter(q => q.type==='stone' && !q.cleared).sort((a,b)=>Math.hypot(a.x-peg.x,a.y-peg.y)-Math.hypot(b.x-peg.x,b.y-peg.y));
      seededShuffle(candidates); candidates.slice(0,Math.min(6,candidates.length)).forEach(q=>{q.type='explosive';q.r=TYPES.explosive.r;}); game.chaosUses++;
    }
    updatePowerState();
  }
  function splitOrb(ball) {
    game.airReady=false; ball.split=true;
    const speed=Math.hypot(ball.vx,ball.vy), angle=Math.atan2(ball.vy,ball.vx);
    game.balls.push(makeBall(ball.x,ball.y,Math.cos(angle-.38)*speed*.88,Math.sin(angle-.38)*speed*.88,true));
    game.balls.push(makeBall(ball.x,ball.y,Math.cos(angle+.38)*speed*.88,Math.sin(angle+.38)*speed*.88,true));
    announcement('AIR SURGE · TRIPLE ORB', 'power');reboundSound();
  }

  function collideObstacles(ball) {
    const t = game.elapsedMs/1000;
    for (const o of game.obstacles) {
      if (o.kind === 'circle') collideCircleObstacle(ball,o.x,o.y,o.r);
      if (o.kind === 'rect') collideRectObstacle(ball,o.x,o.y,o.w,o.h,o.angle||0);
      if (o.kind === 'spinner') {
        const base=(o.phase||0)+(game.lawShots>0?0:t*(o.speed||0));
        for(let i=0;i<(o.arms||2);i++)collideRectObstacle(ball,o.x,o.y,o.length,o.width,base+i*Math.PI/(o.arms||2));
      }
      if (o.kind === 'shield') collideShield(ball,o,t);
    }
  }
  function collideCircleObstacle(ball,x,y,r) {
    const dx=ball.x-x,dy=ball.y-y,min=ball.r+r,d=Math.hypot(dx,dy); if(d>=min||d<.001)return;
    const nx=dx/d,ny=dy/d;ball.x=x+nx*min;ball.y=y+ny*min;const dot=ball.vx*nx+ball.vy*ny;if(dot<0){ball.vx-=1.9*dot*nx;ball.vy-=1.9*dot*ny;} wallHit(ball);
  }
  function collideRectObstacle(ball,cx,cy,w,h,angle) {
    const ca=Math.cos(-angle),sa=Math.sin(-angle),dx=ball.x-cx,dy=ball.y-cy,lx=dx*ca-dy*sa,ly=dx*sa+dy*ca,hw=w/2,hh=h/2;
    const qx=clamp(lx,-hw,hw),qy=clamp(ly,-hh,hh),ox=lx-qx,oy=ly-qy,d=Math.hypot(ox,oy);if(d>=ball.r)return;
    let nx,ny;if(d>.001){nx=ox/d;ny=oy/d;}else{const px=hw-Math.abs(lx),py=hh-Math.abs(ly);if(px<py){nx=Math.sign(lx)||1;ny=0;}else{nx=0;ny=Math.sign(ly)||1;}}
    const push=ball.r-d;const wx=nx*Math.cos(angle)-ny*Math.sin(angle),wy=nx*Math.sin(angle)+ny*Math.cos(angle);ball.x+=wx*push;ball.y+=wy*push;const dot=ball.vx*wx+ball.vy*wy;if(dot<0){ball.vx-=1.88*dot*wx;ball.vy-=1.88*dot*wy;}wallHit(ball);
  }
  function collideShield(ball,o,t){const dx=ball.x-o.x,dy=ball.y-o.y,d=Math.hypot(dx,dy),thick=8;if(Math.abs(d-o.r)>ball.r+thick||d<.01)return;const a=Math.atan2(dy,dx),gap=(o.gapAngle||0)+(game.lawShots>0?0:t*(o.speed||0));let diff=Math.atan2(Math.sin(a-gap),Math.cos(a-gap));if(Math.abs(diff)<(o.gapSize||.6)/2)return;const nx=dx/d,ny=dy/d,side=d>o.r?1:-1;ball.x=o.x+nx*(o.r+side*(ball.r+thick));ball.y=o.y+ny*(o.r+side*(ball.r+thick));const dot=ball.vx*nx+ball.vy*ny;if(dot*side<0){ball.vx-=1.9*dot*nx;ball.vy-=1.9*dot*ny;}wallHit(ball);}

  function collidePortals(ball) {
    if (ball.portalCooldown>0) return;
    for (const portal of game.portals) {
      if (Math.hypot(ball.x-portal.x,ball.y-portal.y)>20+ball.r)continue;
      const pair=game.portals.find(p=>p.id===portal.pair);if(!pair)continue;
      const speed=Math.hypot(ball.vx,ball.vy),incoming=Math.atan2(ball.vy,ball.vx),rotation=(pair.angle||0)-(portal.angle||0);
      ball.x=pair.x+Math.cos(pair.angle||0)*28;ball.y=pair.y+Math.sin(pair.angle||0)*28;ball.vx=Math.cos(incoming+rotation)*speed;ball.vy=Math.sin(incoming+rotation)*speed;ball.portalCooldown=.28;spawnParticles(portal.x,portal.y,'#c270ff',10,140);spawnParticles(pair.x,pair.y,'#7ee8ff',10,140);portalSound();break;
    }
  }

  function handleBallExit(ball) {
    const caught = Math.abs(ball.x-game.collectorX)<62;
    if (game.frenzy) {
      const portal = game.rewardPortals.find(p => Math.abs(ball.x-p.x)<p.w/2);
      if (portal) { game.frenzyPortalBonus=Math.max(game.frenzyPortalBonus,portal.value);addScore(portal.value,portal.x,545);announcement(`RIFT PORTAL +${formatNumber(portal.value)}`,'frenzy');freeOrbSound(); }
      ball.alive=false;return;
    }
    if (caught) {
      game.orbs += 1; game.levelCatches += 1; game.shotCatches += 1; addScore(Math.round(2500*scoreMultiplier()),game.collectorX,548); announcement('FREE ORB!', 'free'); skillShot('ESSENCE CATCH'); freeOrbSound();
    } else if (game.natureSave) {
      game.natureSave=false;ball.y=520;ball.vy=-Math.max(430,Math.abs(ball.vy)*.78);ball.vx+=(450-ball.x)*.4;announcement('NATURE REBOUND!', 'power');reboundSound();updatePowerState();return;
    }
    ball.alive=false;
  }

  function pegBlockedBySolidGeometry(peg) {
    for (const o of game.obstacles) {
      const radius = peg.r + 8;
      if (o.kind === 'circle' && Math.hypot(peg.x - o.x, peg.y - o.y) < o.r + radius) return true;
      if (o.kind === 'spinner' && Math.hypot(peg.x - o.x, peg.y - o.y) < Math.max(42, (o.width || 10) * 3.2) + peg.r) return true;
      if (o.kind === 'rect') {
        const a = -(o.angle || 0), dx = peg.x - o.x, dy = peg.y - o.y;
        const lx = dx * Math.cos(a) - dy * Math.sin(a), ly = dx * Math.sin(a) + dy * Math.cos(a);
        if (Math.abs(lx) < o.w / 2 + radius && Math.abs(ly) < o.h / 2 + radius) return true;
      }
    }
    return false;
  }

  function guidanceSpotFor(peg, occupied) {
    const spots = [
      [155,165],[745,165],[155,300],[745,300],[205,455],[695,455],
      [325,175],[575,175],[300,445],[600,445],[450,155],[450,465]
    ];
    const valid = spots.filter(([x,y]) => {
      if (occupied.some(q => Math.hypot(q.x-x,q.y-y) < 46)) return false;
      const probe = { x, y, r: peg.r };
      return !pegBlockedBySolidGeometry(probe);
    });
    const pool = valid.length ? valid : spots;
    return pool.sort((a,b) => Math.hypot(a[0]-peg.x,a[1]-peg.y)-Math.hypot(b[0]-peg.x,b[1]-peg.y))[0];
  }

  function exposeTargetAtSafeSpot(peg, occupied) {
    const spot = guidanceSpotFor(peg, occupied);
    if (!spot) return false;
    peg.x = peg.baseX = spot[0]; peg.y = peg.baseY = spot[1];
    peg.motion = null; peg.guided = true; occupied.push(peg);
    return true;
  }

  function repairBlockedTargetsAfterLayoutChange() {
    const remaining = game.pegs.filter(p => isTarget(p) && !p.cleared && !p.removed);
    const blocked = remaining.filter(pegBlockedBySolidGeometry);
    if (!blocked.length) return 0;
    const occupied = game.pegs.filter(p => !p.removed && !p.cleared && !blocked.includes(p));
    let moved = 0;
    blocked.forEach(peg => { if (exposeTargetAtSafeSpot(peg, occupied)) moved++; });
    return moved;
  }

  function applyRuneGuidance() {
    const remaining = game.pegs.filter(p => isTarget(p) && !p.cleared && !p.removed);
    if (!remaining.length) return;
    const blocked = remaining.filter(pegBlockedBySolidGeometry);
    const occupied = game.pegs.filter(p => !p.removed && !p.cleared && !remaining.includes(p));
    let moved = 0;
    const toExpose = blocked.length ? blocked.slice(0, 3) : (remaining.length <= 4 ? remaining.slice(0, 1) : []);
    for (const peg of toExpose) if (exposeTargetAtSafeSpot(peg, occupied)) moved++;
    if (!moved) {
      remaining.slice(0, 2).forEach(peg => { peg.guided = true; });
    }
    game.guidanceUses += 1;
    announcement(moved ? 'RUNE GUIDANCE · BLOCKED TARGETS EXPOSED' : 'RUNE GUIDANCE · TARGET HITBOXES EMPOWERED', 'skill');
    game.flash = Math.max(game.flash, .35);
  }

  function endShot() {
    if (game.frenzy) { finalizeCompletion(); return; }
    game.pegs.forEach(peg=>{if(peg.cleared)peg.removed=true;});
    if (game.targetHitsThisShot > 0) game.shotsWithoutTarget = 0;
    else game.shotsWithoutTarget += 1;
    if (game.shotsWithoutTarget >= 3 && game.targetsRemaining > 0 && game.guidanceUses < 3) {
      applyRuneGuidance();
      game.shotsWithoutTarget = 0;
    }
    checkSkillShots(); moveAncientPeg();
    if (game.shotScore>=30000 && !game.shotCatches) { game.orbs+=1;announcement('MASTERFUL SHOT · FREE ORB','free');freeOrbSound(); }
    if (game.waterShots>0) game.waterShots--;
    if (game.lawShots>0) game.lawShots--;
    updatePowerState();
    if (game.targetsRemaining<=0) { if (!game.frenzy) beginFrenzy(); return; }
    if (game.orbs<=0) { game.failed=true;game.state='failed';failureSound();setTimeout(showFailure,500);return; }
    game.state='aiming'; updateHud();
  }

  function checkSkillShots() {
    if (game.shotPegs>=15) skillShot('RUNE CASCADE');
    if (game.shotWalls>=2) skillShot('DOUBLE RICOCHET');
    if (game.shotDistance>1300) skillShot('LONG SHOT');
    if (game.shotWalls>=1&&game.shotPegs>=8) skillShot('ALTAR BANK SHOT');
    if (game.balls.some(b=>b.luckyLow)&&game.shotPegs>=5) skillShot('LUCKY ESCAPE');
    if (game.shotPegs>=22&&game.shotWalls>=3) skillShot('IMPOSSIBLE ANGLE');
    if (game.shotPegs>=25) profile.biggestCombo=Math.max(profile.biggestCombo,game.shotPegs);
  }
  function skillShot(name){const fresh=!game.skillShots.includes(name);if(fresh){game.skillShots.push(name);skillShotSound();}announcement(name,'skill');addScore(1500+game.shotPegs*150,450,120);}

  function moveAncientPeg() {
    const ancient=game.pegs.find(p=>p.type==='ancient'&&!p.removed);if(ancient)ancient.type='stone';
    const candidates=game.pegs.filter(p=>p.type==='stone'&&!p.removed&&!p.cleared);if(!candidates.length)return;const next=candidates[Math.floor(rand()*candidates.length)];next.type='ancient';next.r=TYPES.ancient.r;
  }
  function checkPhase(){const phase=game.level.phases?.[game.phaseIndex];if(!phase||game.targetsRemaining>phase.targetsRemaining)return;game.phaseIndex++;applyPhaseShift(phase.shift);announcement('ALTAR SHIFTS!','phase');phaseShiftSound();game.shake=8;}
  function applyPhaseShift(name){for(const peg of game.pegs){if(peg.removed)continue;const side=peg.x<450?-1:1;if(name==='rows'){peg.baseX=peg.x=clamp(peg.x+side*35,50,850);peg.baseY=peg.y=clamp(peg.y+(peg.id%2?28:-22),105,510);}if(name==='rows2'){peg.baseX=peg.x=clamp(900-peg.x,50,850);}if(name==='collapse1'){peg.baseY=peg.y=clamp(peg.y+((peg.id%3)-1)*38,105,510);}if(name==='collapse2'){peg.baseX=peg.x=clamp(450+(peg.x-450)*.82,50,850);}if(name==='ruin1'){peg.baseX=peg.x=clamp(peg.x+Math.sin(peg.id)*48,50,850);}if(name==='ruin2'){peg.baseY=peg.y=clamp(560-peg.y*.72,105,510);}if(name==='grand1'){peg.baseX=peg.x=clamp(450+(peg.x-450)*.88,50,850);}if(name==='grand2'){peg.baseY=peg.y=clamp(peg.y+Math.cos(peg.id)*46,105,510);}if(name==='grandFinal'&&isTarget(peg)){peg.r=17;}}const repaired=repairBlockedTargetsAfterLayoutChange();if(repaired)announcement(`RUNE SAFETY · ${repaired} TARGET${repaired===1?'':'S'} REPOSITIONED`,'skill');}

  function beginFrenzy() {
    game.frenzy=true;game.state='frenzy';game.frenzyStartedAt=performance.now();game.flash=1;game.shake=13;skillShot('PERFECT OFFERING');announcement('RUNE FRENZY!','frenzy');
    game.rewardPortals=[{x:130,w:150,value:10000},{x:310,w:150,value:25000},{x:500,w:150,value:50000},{x:720,w:170,value:100000}];
    frenzySound();
    if (!game.balls.length) setTimeout(finalizeCompletion,650);
  }

  async function finalizeCompletion() {
    if (game.completed) return; game.completed=true;game.state='complete';
    const unusedBonus=game.orbs*10000,finalScore=game.score+unusedBonus+game.frenzyPortalBonus;game.score=finalScore;
    const level=game.level, previous=progressFor(level.id), stars=finalScore>=level.starScores[2]?3:finalScore>=level.starScores[1]?2:1;
    const localFirst=!previous?.completed, newRecord=!previous||finalScore>(previous.bestScore||0);
    const record={completed:true,bestScore:Math.max(previous?.bestScore||0,finalScore),stars:Math.max(previous?.stars||0,stars),bestOrbs:Math.max(previous?.bestOrbs||0,game.orbs),completionCount:(previous?.completionCount||0)+1,selectedPower:game.selectedPower,completionMs:Math.min(previous?.completionMs||Infinity,Math.round(game.elapsedMs)),catches:Math.max(previous?.catches||0,game.levelCatches),biggestCombo:Math.max(previous?.biggestCombo||0,game.biggestCombo),rewardsClaimed:Boolean(previous?.rewardsClaimed)};
    profile.progress[level.id]=record;profile.totalCatches+=game.levelCatches;profile.biggestCombo=Math.max(profile.biggestCombo,game.biggestCombo);evaluateAchievements(level.id,stars);saveProfile();
    let server={submitted:false,rewards_awarded:false,gold_awarded:0,xp_awarded:0,new_gp:null,new_runecrafting_xp:null};
    if (signedIn()&&game.sessionId&&typeof db!=='undefined'&&db?.rpc){try{const {data,error}=await db.rpc('complete_repoggle_level',{p_session_id:game.sessionId,p_level_number:level.id,p_score:Math.round(finalScore),p_star_rating:stars,p_orbs_remaining:game.orbs,p_selected_power:game.selectedPower,p_biggest_combo:game.biggestCombo,p_catches:game.levelCatches,p_completion_ms:Math.round(game.elapsedMs),p_power_activated:game.powerActivated});if(!error){server={...server,...(Array.isArray(data)?(data[0]||{}):(data||{})),submitted:true};record.rewardsClaimed=true;if(typeof character!=='undefined'&&character){if(server.new_gp!=null)character.gp=Number(server.new_gp);if(server.new_runecrafting_xp!=null)character.runecrafting_xp=Number(server.new_runecrafting_xp);if(typeof renderCharacter==='function')renderCharacter();}saveProfile();}}catch(_) {}}
    setTimeout(()=>showCompletion({level,previous,stars,newRecord,localFirst,server,unusedBonus,finalScore}),450);
  }

  function evaluateAchievements(level,stars){const unlock=id=>profile.achievements[id]=profile.achievements[id]||Date.now();if(level===1)unlock('first');if(game.levelCatches>=5)unlock('catches');if(game.biggestCombo>=25)unlock('cascade');if(!game.powerActivated)unlock('nopower');if(stars===3)unlock('perfect');if(level>=30)unlock('abyss');if(level>=40)unlock('ancient');if(level>=50)unlock('rift');if(Object.keys(profile.progress).length>=50&&R.levels.every(l=>(profile.progress[l.id]?.stars||0)>=3)){unlock('grandmaster');profile.grandmaster=true;}}

  function showCompletion(result) {
    stopGameLoop();const {level,previous,stars,newRecord,server,unusedBonus,finalScore}=result;
    const awarded=Boolean(server.rewards_awarded);
    let rewardMarkup='';
    if(awarded){rewardMarkup=`<div class="rep-reward-box awarded"><span>GOLD REWARD<b>+${formatNumber(server.gold_awarded)}</b></span><span>RUNECRAFTING XP<b>+${formatNumber(server.xp_awarded)}</b></span></div>`;}
    else if(server.submitted||previous?.rewardsClaimed){rewardMarkup='<div class="rep-reward-box claimed"><strong>LEVEL COMPLETE — REWARDS ALREADY CLAIMED</strong></div>';}
    else if(!signedIn()){rewardMarkup='<div class="rep-reward-box claimed"><strong>GUEST COMPLETION — SIGN IN FOR GOLD AND XP REWARDS</strong></div>';}
    else{rewardMarkup='<div class="rep-reward-box claimed"><strong>REWARDS NOT GRANTED — RUN REPOGGLE-MIGRATION.SQL</strong></div>';}
    shell(`<section class="rep-result-screen victory"><div class="rep-result-runes">${Array.from({length:18},(_,i)=>`<i style="--i:${i}"></i>`).join('')}</div><div class="rep-result-card"><small>LEVEL ${level.id} COMPLETE</small><h2>${escapeHtml(level.name)}</h2><div class="rep-stars">${'★'.repeat(stars)}${'☆'.repeat(3-stars)}</div>${newRecord?'<b class="rep-new-record">NEW PERSONAL BEST</b>':''}<div class="rep-result-grid"><span>FINAL SCORE<b>${formatNumber(finalScore)}</b><em>Previous ${formatNumber(previous?.bestScore||0)}</em></span><span>PEGS CLEARED<b>${game.pegsCleared}</b></span><span>ORBS REMAINING<b>${game.orbs}</b><em>+${formatNumber(unusedBonus)} score</em></span><span>BIGGEST COMBO<b>${game.biggestCombo}</b></span><span>ESSENCE CATCHES<b>${game.levelCatches}</b></span><span>SKILL SHOTS<b>${game.skillShots.length}</b></span></div><div class="rep-skill-list">${game.skillShots.length?game.skillShots.map(s=>`<span>${escapeHtml(s)}</span>`).join(''):'<span>No named skill shots this run</span>'}</div>${rewardMarkup}<div class="rep-result-actions"><button id="repRetry" type="button">RETRY</button><button id="repResultMap" type="button">CAMPAIGN MAP</button>${level.id<50?'<button id="repNext" class="rep-primary" type="button">NEXT LEVEL</button>':'<button id="repGrandmaster" class="rep-primary" type="button">GRANDMASTER CEREMONY</button>'}</div></div></section>`,'result');
    $('repRetry').onclick=startLevel;$('repResultMap').onclick=renderMap;if($('repNext'))$('repNext').onclick=()=>openLevelFlow(level.id+1);if($('repGrandmaster'))$('repGrandmaster').onclick=showGrandmaster;
  }

  function showFailure(){stopGameLoop();const remaining=game.pegs.filter(p=>isTarget(p)&&!p.removed).slice(0,12);shell(`<section class="rep-result-screen failure"><div class="rep-result-card"><small>THE OFFERING FADES</small><h2>${game.targetsRemaining} CHARGED PEG${game.targetsRemaining===1?'':'S'} REMAIN</h2><div class="rep-failure-pegs">${remaining.map(p=>`<i class="${p.type}"></i>`).join('')}</div><p>You ran out of Rune Orbs. Restart instantly, change your power, or return to the map.</p><div class="rep-result-grid"><span>SCORE<b>${formatNumber(game.score)}</b></span><span>PEGS CLEARED<b>${game.pegsCleared}</b></span><span>BIGGEST COMBO<b>${game.biggestCombo}</b></span><span>SKILL SHOTS<b>${game.skillShots.length}</b></span></div><div class="rep-result-actions"><button id="repFailRetry" class="rep-primary" type="button">INSTANT RETRY</button><button id="repFailPower" type="button">CHANGE RUNE POWER</button><button id="repFailMap" type="button">RETURN TO MAP</button></div></div></section>`,'result');$('repFailRetry').onclick=startLevel;$('repFailPower').onclick=renderPowerSelect;$('repFailMap').onclick=renderMap;}

  function showGrandmaster(){shell(`<section class="rep-grandmaster-screen"><div class="rep-grandmaster-rays"></div><img src="assets/repoggle/grandmaster-badge.svg" alt="Repoggle Grandmaster badge"><small>LEVEL 50 CONQUERED</small><h2>REPOGGLE GRANDMASTER</h2><p>You mastered moving formations, ancient shields, portals, armoured targets and the Great Rift.</p><div><span>TOTAL STARS<b>${totalStars()}/150</b></span><span>CAMPAIGN SCORE<b>${formatNumber(totalBestScore())}</b></span></div><button id="repGrandMap" class="rep-primary" type="button">RETURN TO CAMPAIGN</button></section>`,'grandmaster');$('repGrandMap').onclick=renderMap;completionSting();}

  function showTutorial(manual) {
    const existing=$('repTutorialOverlay');if(existing)existing.remove();const overlay=document.createElement('div');overlay.id='repTutorialOverlay';overlay.className='rep-tutorial-overlay';overlay.innerHTML=`<div class="rep-tutorial-card"><button id="repTutorialClose" type="button">×</button><small>FIRST OFFERING</small><h2>HOW TO PLAY REPOGGLE</h2><div class="rep-tutorial-steps"><span><b>1</b><strong>AIM</strong><em>Move your mouse or finger. The dotted guide shows the route to the first collision.</em></span><span><b>2</b><strong>FIRE</strong><em>Click or tap. The Rune Orb bounces from pegs, walls and altar obstacles.</em></span><span><b>3</b><strong>CLEAR GOLD PEGS</strong><em>Remove every glowing Charged Rune Peg before your Rune Orbs run out.</em></span><span><b>4</b><strong>CATCH THE ORB</strong><em>Land inside the moving Essence Collector for a FREE ORB.</em></span><span><b>5</b><strong>ACTIVATE POWERS</strong><em>Green Power Pegs trigger your selected Rune Power.</em></span></div><div class="rep-tutorial-legend"><i class="stone"></i>Stone <i class="charged"></i>Charged target <i class="power"></i>Power <i class="ancient"></i>Ancient <i class="armoured"></i>Armoured <i class="explosive"></i>Explosive</div><button id="repTutorialDone" class="rep-primary" type="button">${manual?'CLOSE TUTORIAL':'BEGIN OFFERING'}</button></div>`;dialog.appendChild(overlay);const close=()=>{overlay.remove();profile.tutorialSeen=true;saveProfile();};$('repTutorialClose').onclick=close;$('repTutorialDone').onclick=close;}

  async function renderRecords(){stopGameLoop();shell(`<section class="rep-records-screen"><div class="rep-breadcrumb"><button id="repRecordsBack" type="button">← CAMPAIGN MAP</button><span>PLAYER RECORDS</span></div><div class="rep-record-columns"><div class="rep-record-panel"><small>YOUR CAMPAIGN</small><h2>${escapeHtml(currentCharacterName())}</h2><div class="rep-map-summary"><span>LEVELS<b>${completedLevelCount()}/50</b></span><span>STARS<b>${totalStars()}/150</b></span><span>SCORE<b>${formatNumber(totalBestScore())}</b></span><span>CATCHES<b>${formatNumber(profile.totalCatches)}</b></span><span>BIGGEST COMBO<b>${profile.biggestCombo||0}</b></span><span>FAVOURITE POWER<b>${escapeHtml(favouritePowerName())}</b></span></div><h3>ACHIEVEMENTS</h3><div class="rep-achievement-grid">${R.achievements.map(a=>`<article class="${profile.achievements[a.id]?'unlocked':'locked'}"><b>${profile.achievements[a.id]?'◆':'◇'}</b><span><strong>${a.name}</strong><small>${a.desc}</small></span></article>`).join('')}</div></div><div class="rep-record-panel"><div class="rep-board-heading"><div><small>FRIENDS & CLAN</small><h2>LEADERBOARDS</h2></div><select id="repLeaderboardMetric"><option value="total_score">Campaign score</option><option value="total_stars">Most stars</option><option value="level_50_score">Level 50 score</option><option value="biggest_combo">Largest combo</option><option value="total_catches">Collector catches</option><option value="campaign_ms">Fastest campaign</option></select></div><div id="repLeaderboard" class="rep-leaderboard"><p>Loading records…</p></div><small>Leaderboard loading never blocks campaign play.</small></div></div></section>`,'records');$('repRecordsBack').onclick=renderMap;$('repLeaderboardMetric').onchange=renderLeaderboard;await loadLeaderboards();renderLeaderboard();}
  function favouritePowerName(){const entries=Object.entries(profile.favouritePower||{}).sort((a,b)=>b[1]-a[1]);return entries.length?POWER_BY_ID[entries[0][0]]?.name||'Air Surge':'Air Surge';}
  async function loadLeaderboards(){leaderboardRows=[];if(typeof db==='undefined'||!db?.rpc)return;try{const {data,error}=await db.rpc('get_repoggle_leaderboards');if(!error)leaderboardRows=data||[];}catch(_) {}}
  function renderLeaderboard(){const box=$('repLeaderboard');if(!box)return;const metric=$('repLeaderboardMetric')?.value||'total_score';if(!leaderboardRows.length){box.innerHTML='<p>No server records yet. Run the Repoggle SQL migration to enable shared rankings.</p>';return;}const sorted=[...leaderboardRows].sort((a,b)=>metric==='campaign_ms'?(Number(a[metric]||Infinity)-Number(b[metric]||Infinity)):(Number(b[metric]||0)-Number(a[metric]||0))).slice(0,20);box.innerHTML=sorted.map((row,i)=>`<span><b>${i+1}</b><strong>${escapeHtml(row.username)}</strong><em>${metric==='campaign_ms'?formatTime(row[metric]):formatNumber(row[metric])}</em></span>`).join('');}

  async function loadRemoteProgress(){remoteLoaded=true;if(typeof db==='undefined'||!db?.from||!signedIn())return;try{const {data,error}=await db.from('repoggle_progress').select('level_number,best_score,best_star_rating,best_orbs_remaining,selected_power,completion_count,reward_claimed,best_combo,best_catches,best_completion_ms');if(error)return;for(const row of data||[]){const level=Number(row.level_number),local=profile.progress[level]||{};profile.progress[level]={...local,completed:true,bestScore:Math.max(local.bestScore||0,Number(row.best_score)||0),stars:Math.max(local.stars||0,Number(row.best_star_rating)||1),bestOrbs:Math.max(local.bestOrbs||0,Number(row.best_orbs_remaining)||0),selectedPower:row.selected_power||local.selectedPower,completionCount:Math.max(local.completionCount||0,Number(row.completion_count)||1),rewardsClaimed:Boolean(row.reward_claimed),biggestCombo:Math.max(local.biggestCombo||0,Number(row.best_combo)||0),catches:Math.max(local.catches||0,Number(row.best_catches)||0),completionMs:Math.min(local.completionMs||Infinity,Number(row.best_completion_ms)||Infinity)};}saveProfile();if(currentScreen==='title')renderTitle();}catch(_) {}}

  function updateHud(){if(!game)return;if($('repScore'))$('repScore').textContent=formatNumber(game.displayedScore);if($('repTargets'))$('repTargets').textContent=game.targetsRemaining;if($('repOrbs'))$('repOrbs').textContent=game.orbs;if($('repMultiplier'))$('repMultiplier').textContent=`×${scoreMultiplier().toFixed(1)}`;if($('repCombo'))$('repCombo').textContent=game.biggestCombo;if($('repShotScore'))$('repShotScore').textContent=formatNumber(game.shotScore);if($('repShotPegs'))$('repShotPegs').textContent=game.shotPegs;if($('repShotWalls'))$('repShotWalls').textContent=game.shotWalls;}
  function updatePowerState(){const el=$('repPowerState');if(!el||!game)return;let text='Hit a green Power Peg';if(game.airReady)text='Split ready on next collision';if(game.waterShots>0)text=`Extended guide · ${game.waterShots} shot${game.waterShots===1?'':'s'}`;if(game.natureSave)text='Vines ready to save one orb';if(game.lawShots>0)text=`Time frozen · ${game.lawShots} shot${game.lawShots===1?'':'s'}`;if(game.selectedPower==='chaos'&&game.powerActivated)text=`Chaos Nova activated ${game.chaosUses}×`;el.textContent=text;}
  function announcement(text,kind='normal'){if(!game)return;game.announcements.push({text,kind,life:2.1});if(game.announcements.length>5)game.announcements.shift();const layer=$('repAnnouncementLayer');if(layer){const node=document.createElement('b');node.className=`rep-announce ${kind}`;node.textContent=text;layer.appendChild(node);setTimeout(()=>node.remove(),2100);}}

  function draw(time) {
    if(!ctx||!game)return;game.displayedScore+=(game.score-game.displayedScore)*.13;updateHud();ctx.save();if(game.shake>0)ctx.translate((Math.random()-.5)*game.shake,(Math.random()-.5)*game.shake);drawBoardBackground(ctx,game.level,time);drawTrajectory();game.obstacles.forEach(o=>drawObstacle(ctx,o,time,false));game.portals.forEach(p=>drawPortal(ctx,p,time));game.pegs.forEach(p=>{if(!p.removed)drawPeg(ctx,p,time,false);});drawTrails();game.balls.forEach(drawBall);drawParticles();drawFloaters();drawCollector(ctx,game.collectorX,game.frenzy);drawLauncher();if(game.frenzy)drawFrenzy(time);if(game.flash>0){ctx.fillStyle=`rgba(255,230,130,${game.flash*.18})`;ctx.fillRect(0,0,R.W,R.H);}ctx.restore();}
  function drawBoardBackground(x,level,time){const region=regionFor(level.id);const palettes={mine:['#120f0b','#2b2114'],elemental:['#07121b','#17364d'],abyss:['#100817','#33124a'],ancient:['#0a120c','#1e3822'],rift:['#150606','#4a1517']};const pal=palettes[region.key];const g=x.createRadialGradient(450,300,60,450,300,530);g.addColorStop(0,pal[1]);g.addColorStop(1,pal[0]);x.fillStyle=g;x.fillRect(0,0,R.W,R.H);x.strokeStyle=region.accent+'24';x.lineWidth=2;for(let r=80;r<520;r+=58){x.beginPath();x.arc(450,320,r+Math.sin(time*.4+r)*3,0,Math.PI*2);x.stroke();}x.fillStyle='#0008';x.fillRect(0,0,R.W,76);x.strokeStyle=region.accent+'66';x.strokeRect(8,76,R.W-16,R.H-94);for(let i=0;i<26;i++){const px=(i*193+level.seed)%900,py=95+((i*89+level.seed)%440);x.fillStyle=region.accent+(i%3?'12':'26');x.fillRect(px,py,2,2);}}
  function drawLauncher(){const aim=getAimVector();const a=Math.atan2(aim.dy,aim.dx);ctx.save();ctx.translate(game.launcher.x,game.launcher.y);ctx.rotate(a-Math.PI/2);ctx.fillStyle='#2d261d';ctx.strokeStyle='#e0b64e';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-18,5);ctx.lineTo(0,34);ctx.lineTo(18,5);ctx.lineTo(10,-12);ctx.lineTo(-10,-12);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();ctx.beginPath();ctx.arc(game.launcher.x,game.launcher.y,12,0,Math.PI*2);ctx.fillStyle='#d9edf5';ctx.shadowColor='#86ddff';ctx.shadowBlur=14;ctx.fill();ctx.shadowBlur=0;}
  function drawTrajectory(){if(game.state!=='aiming')return;const extended=game.waterShots>0;const points=simulateTrajectory(extended?170:85,extended);ctx.save();ctx.fillStyle='#ffe995';for(let i=0;i<points.length;i+=4){ctx.globalAlpha=Math.max(.15,1-i/points.length);ctx.beginPath();ctx.arc(points[i].x,points[i].y,i<30?2.5:1.8,0,Math.PI*2);ctx.fill();}ctx.restore();}
  function simulateTrajectory(maxSteps,extended=false){const aim=getAimVector();let x=game.launcher.x,y=game.launcher.y+15,vx=aim.vx,vy=aim.vy;const points=[];for(let i=0;i<maxSteps;i++){vy+=520*(1/120);x+=vx*(1/120);y+=vy*(1/120);if(x<16||x>884){vx*=-.88;x=clamp(x,16,884);if(!extended&&i>6)break;}if(y<84){vy=Math.abs(vy)*.86;if(!extended&&i>6)break;}let hit=false;for(const peg of game.pegs){if(peg.removed)continue;const dd=Math.hypot(x-peg.x,y-peg.y);if(dd<8+peg.r){const nx=(x-peg.x)/(dd||1),ny=(y-peg.y)/(dd||1),dot=vx*nx+vy*ny;vx-=1.88*dot*nx;vy-=1.88*dot*ny;hit=true;break;}}points.push({x,y});if(hit&&!extended)break;if(y>560)break;}return points;}
  function drawPeg(x,peg,time,preview){const type=TYPES[peg.type]||TYPES.stone,hit=peg.cleared&&!peg.removed;x.save();x.translate(peg.x,peg.y);if(peg.motion&&!preview)x.rotate(time*.4);const pulse=(peg.type==='charged'||peg.type==='chargedArmoured'||peg.type==='power'||peg.type==='ancient')?(1+Math.sin(time*4+peg.id)*.06):1;x.scale(pulse,pulse);x.shadowColor=type.edge;x.shadowBlur=peg.type==='stone'||peg.type==='armoured'?3:14;x.fillStyle=hit?'#fff6':type.fill;x.strokeStyle=type.edge;x.lineWidth=2;x.beginPath();x.arc(0,0,peg.r,0,Math.PI*2);x.fill();x.stroke();x.shadowBlur=0;x.strokeStyle='#111b';x.lineWidth=1;if(peg.type==='charged'||peg.type==='chargedArmoured'){for(let i=0;i<4;i++){const a=i*Math.PI/2;x.beginPath();x.moveTo(Math.cos(a)*3,Math.sin(a)*3);x.lineTo(Math.cos(a)*7,Math.sin(a)*7);x.stroke();}}else if(peg.type==='power'){x.beginPath();x.moveTo(-4,4);x.lineTo(0,-5);x.lineTo(4,4);x.stroke();}else if(peg.type==='ancient'){x.beginPath();x.moveTo(-5,0);x.quadraticCurveTo(0,-7,5,0);x.quadraticCurveTo(0,7,-5,0);x.stroke();}else if(peg.type==='explosive'){x.beginPath();x.moveTo(-5,-5);x.lineTo(5,5);x.moveTo(5,-5);x.lineTo(-5,5);x.stroke();}else{x.beginPath();x.moveTo(-5,0);x.lineTo(5,0);x.stroke();}if((peg.type==='armoured'||peg.type==='chargedArmoured')&&peg.hp<peg.maxHp){x.strokeStyle='#190f0d';x.lineWidth=2;x.beginPath();x.moveTo(-7,-8);x.lineTo(-1,-2);x.lineTo(-6,3);x.lineTo(4,9);x.stroke();}x.restore();}
  function drawBall(ball){ctx.save();const g=ctx.createRadialGradient(ball.x-3,ball.y-4,1,ball.x,ball.y,ball.r+4);g.addColorStop(0,'#fff');g.addColorStop(.45,'#bde8ff');g.addColorStop(1,'#5374a5');ctx.fillStyle=g;ctx.shadowColor='#8fe6ff';ctx.shadowBlur=15;ctx.beginPath();ctx.arc(ball.x,ball.y,ball.r,0,Math.PI*2);ctx.fill();ctx.restore();}
  function drawCollector(x,cx,frenzy){if(frenzy)return;x.save();x.translate(cx,552);x.fillStyle='#16130e';x.strokeStyle='#e4bc56';x.lineWidth=3;x.beginPath();x.moveTo(-58,-5);x.lineTo(-45,17);x.lineTo(45,17);x.lineTo(58,-5);x.lineTo(42,-5);x.lineTo(32,8);x.lineTo(-32,8);x.lineTo(-42,-5);x.closePath();x.fill();x.stroke();x.fillStyle='#ffe079';x.font='bold 11px Georgia';x.textAlign='center';x.fillText('ESSENCE',0,5);x.restore();}
  function drawObstacle(x,o,time,preview){x.save();x.strokeStyle='#9c8968';x.fillStyle='#201b17dd';x.lineWidth=3;if(o.kind==='circle'){x.beginPath();x.arc(o.x,o.y,o.r,0,Math.PI*2);x.fill();x.stroke();}if(o.kind==='rect'){x.translate(o.x,o.y);x.rotate(o.angle||0);x.fillRect(-o.w/2,-o.h/2,o.w,o.h);x.strokeRect(-o.w/2,-o.h/2,o.w,o.h);}if(o.kind==='spinner'){const base=(o.phase||0)+(preview?0:time*(o.speed||0));for(let i=0;i<(o.arms||2);i++){x.save();x.translate(o.x,o.y);x.rotate(base+i*Math.PI/(o.arms||2));x.fillRect(-o.length/2,-o.width/2,o.length,o.width);x.strokeRect(-o.length/2,-o.width/2,o.length,o.width);x.restore();}x.beginPath();x.arc(o.x,o.y,15,0,Math.PI*2);x.fill();x.stroke();}if(o.kind==='shield'){const gap=(o.gapAngle||0)+(preview?0:time*(o.speed||0));x.lineWidth=9;x.strokeStyle='#bda66a';x.beginPath();x.arc(o.x,o.y,o.r,gap+(o.gapSize||.6)/2,gap+Math.PI*2-(o.gapSize||.6)/2);x.stroke();}x.restore();}
  function drawPortal(x,p,time){x.save();x.translate(p.x,p.y);x.rotate(time*1.4+(p.angle||0));x.strokeStyle='#b77cff';x.lineWidth=4;x.shadowColor='#b55cff';x.shadowBlur=14;x.beginPath();x.arc(0,0,17,0,Math.PI*1.45);x.stroke();x.strokeStyle='#7eeaff';x.beginPath();x.arc(0,0,11,Math.PI*.4,Math.PI*1.9);x.stroke();x.restore();}
  function drawFrenzy(time){ctx.save();ctx.globalAlpha=.85;for(const portal of game.rewardPortals){const g=ctx.createLinearGradient(portal.x-portal.w/2,520,portal.x+portal.w/2,575);g.addColorStop(0,'#5a1d85');g.addColorStop(.5,'#f4cb55');g.addColorStop(1,'#5a1d85');ctx.fillStyle=g;ctx.fillRect(portal.x-portal.w/2,535,portal.w,40);ctx.fillStyle='#fff6c7';ctx.font='bold 14px Georgia';ctx.textAlign='center';ctx.fillText(formatNumber(portal.value),portal.x,560);}ctx.font='bold 36px Georgia';ctx.fillStyle='#ffe170';ctx.shadowColor='#ff8d32';ctx.shadowBlur=18;ctx.textAlign='center';ctx.fillText('RUNE FRENZY!',450,110+Math.sin(time*8)*4);ctx.restore();}
  function spawnParticles(x,y,color,count,speed){for(let i=0;i<count&&game.particles.length<MAX_PARTICLES;i++){const a=rand()*Math.PI*2,s=rand()*speed*.7+speed*.3;game.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.45+rand()*.45,color,size:1+rand()*2.5});}}
  function updateParticles(dt){for(const p of game.particles){p.life-=dt;p.vy+=220*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;}game.particles=game.particles.filter(p=>p.life>0);for(const f of game.floaters)f.life-=dt;game.floaters=game.floaters.filter(f=>f.life>0);for(const t of game.trails)t.life-=dt;game.trails=game.trails.filter(t=>t.life>0);}
  function drawParticles(){ctx.save();for(const p of game.particles){ctx.globalAlpha=clamp(p.life*1.8,0,1);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,p.size,p.size);}ctx.restore();}
  function addTrail(ball){if(game.trails.length<120)game.trails.push({x:ball.x,y:ball.y,life:.28,r:ball.r*.55});}
  function drawTrails(){ctx.save();for(const t of game.trails){ctx.globalAlpha=t.life*.8;ctx.fillStyle='#8bdfff';ctx.beginPath();ctx.arc(t.x,t.y,t.r,0,Math.PI*2);ctx.fill();}ctx.restore();}
  function drawFloaters(){ctx.save();ctx.textAlign='center';ctx.font='bold 13px Georgia';for(const f of game.floaters){ctx.globalAlpha=f.life;ctx.fillStyle='#fff0a3';ctx.fillText(f.text,f.x,f.y-(1-f.life)*34);}ctx.restore();}

  function rand(){game.rngState=(game.rngState*1664525+1013904223)>>>0;return game.rngState/4294967296;}
  function seededShuffle(array){for(let i=array.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[array[i],array[j]]=[array[j],array[i]];}return array;}
  function resizeCanvas(){if(!canvas)return;const shell=canvas.parentElement;const ratio=R.W/R.H;const availableW=Math.max(1,shell.clientWidth);const availableH=Math.max(1,shell.clientHeight);const width=Math.min(availableW,availableH*ratio);const height=width/ratio;canvas.style.width=`${Math.round(width)}px`;canvas.style.height=`${Math.round(height)}px`;}

  function bind() {
    const openButton=$('openRunecrafting');if(openButton)openButton.onclick=openModeHub;
    $('openRunePoolMode')?.addEventListener('click',openPool);
    $('openRepoggleMode')?.addEventListener('click',openRepoggle);
    $('rcBackToModes')?.addEventListener('click',()=>{if(typeof leaveRcRoom==='function')leaveRcRoom();openModeHub();});
    dialog.addEventListener('cancel',e=>{e.preventDefault();closeRepoggle(false);});
    dialog.addEventListener('pointerdown',()=>{if(profile.sound)unlockAudio();},{passive:true});
    window.addEventListener('keydown',keyHandler,{passive:false});
    window.addEventListener('resize',resizeCanvas);
    document.addEventListener('visibilitychange',()=>{if(game&&currentScreen==='game'){game.paused=document.hidden;pausedByVisibility=document.hidden;$('repPause')?.classList.toggle('hidden',!document.hidden);}});
  }
  bind();
})();
