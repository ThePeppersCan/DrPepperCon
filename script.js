const SUPABASE_URL = 'https://hvdrwmjieguurxvrgzfu.supabase.co';
const SUPABASE_KEY = 'sb_publishable_bln84LaJ8iYmnkYK9mh0Pg_XxP7O1OZ';
const $ = (id) => document.getElementById(id);
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let count = 0;
let busy = false;
let character = null;
let authMode = 'login';
let spawnTimer = null;
let currentResource = null;
let agilityRunning = false;
let agilityTarget = 0;
let agilityStartedAt = 0;
let agilityShownAt = 0;
let agilityReactions = [];
let agilityClock = null;
let agilityMode = 'dash';
let gnomeBallRunning = false, gnomeBallFrame = null, gnomeBallLast = 0, gnomeBallState = null;
let gnomeBallSaving = false;
let jadRunning = false;
let jadAttackTimer = null;
let jadResolveTimer = null;
let jadBlocks = 0;
let jadPrayer = null;
let jadAttack = null;
let jadHealerTimer = null;
let jadHealerPulseTimer = null;
let combatRunning = false;
let combatPaused = false;
let combatFrame = null;
let combatLast = 0;
let combatStartedAt = 0;
let combatState = null;
const combatKeys = new Set();
let selectedCombatWeapon = 'sword';
let selectedCombatDifficulty = 'medium';
let selectedCombatLocation = 'lumbridge';
let miningAfkState=null,miningAfkPoll=null,miningChatTimer=null,miningLivePoll=null;
let selectedRcAiDifficulty = 'medium';
let rcAiTimer = null;
let selectedSlayerDifficulty = 'medium';
let rcRoom = null, rcPollTimer = null, rcAnimating = false, rcAim = null;
const rcRuneImages = {};
['fire','chaos','wrath'].forEach(name => { const img = new Image(); img.src = `assets/${name}-rune.${name === 'fire' ? 'webp' : 'png'}`; img.onload = () => { rcRuneImages[name] = img; if (rcRoom) drawRcTable(); }; });
let sailingRunning=false, sailingFrame=null, sailingLast=0, sailingStartedAt=0, sailingState=null;
const sailingKeys=new Set();
const AGILITY_TARGETS = 15;
const SLAYER_DIFFICULTIES = {
  easy: { label:'Easy', hits:8, baseSpeed:2050, speedStep:30, xp:90 },
  medium: { label:'Medium', hits:12, baseSpeed:1750, speedStep:45, xp:150 },
  hard: { label:'Hard', hits:16, baseSpeed:1450, speedStep:55, xp:240 },
  insane: { label:'INSANE', hits:28, baseSpeed:1450, speedStep:55, xp:500, hiddenCue:true, healers:true }
};

const AUTH_DOMAIN = 'conofdrpepper.local'; // Kept internally so existing accounts continue to work

const SKILLS = {
  woodcutting: { label: 'Woodcutting', image: 'assets/tree.png', xp: 25 },
  mining: { label: 'Mining', image: 'assets/runite-rocks.png', xp: 35 },
  fishing: { label: 'Fishing', image: 'assets/shark.png', xp: 40 }
};

const COLLECTIBLES = [
  ['mini_dr_pepper', 'Tiny XP Lamp'],
  ['chair_fragment', 'Broken Keyboard Key'],
  ['membership_card', 'Repo Company Badge'],
  ['reinforced_chair', 'No-XP-Waste Certificate'],
  ['golden_dr_pepper', 'Golden XP Drop']
];

const clickSound = new Audio();
clickSound.preload = 'auto';

const jadMusic = new Audio('assets/tzhaar-theme.mp3');
jadMusic.preload = 'auto';
jadMusic.loop = true;
jadMusic.volume = 0;
let jadMusicFadeTimer = null;

const combatMusic = new Audio('assets/combat-theme.mp3');
combatMusic.preload = 'auto';
combatMusic.loop = true;
combatMusic.volume = 0;
let combatMusicFadeTimer = null;

function playClickSound() {
  try { clickSound.currentTime = 0; clickSound.play().catch(() => {}); } catch (_) {}
}

function clearJadMusicFade() {
  if (jadMusicFadeTimer) clearInterval(jadMusicFadeTimer);
  jadMusicFadeTimer = null;
}

function startJadMusic() {
  clearJadMusicFade();
  try {
    jadMusic.pause();
    jadMusic.currentTime = 0;
    jadMusic.volume = 0;
    const playPromise = jadMusic.play();
    if (playPromise?.catch) playPromise.catch(error => console.warn('Jad music could not start:', error));
    const targetVolume = 0.55;
    const steps = 10;
    let step = 0;
    jadMusicFadeTimer = setInterval(() => {
      step += 1;
      jadMusic.volume = Math.min(targetVolume, targetVolume * (step / steps));
      if (step >= steps) clearJadMusicFade();
    }, 50);
  } catch (error) {
    console.warn('Jad music could not start:', error);
  }
}

function stopJadMusic(fadeMs = 700) {
  clearJadMusicFade();
  if (jadMusic.paused) {
    try { jadMusic.currentTime = 0; jadMusic.volume = 0; } catch (_) {}
    return;
  }
  const startVolume = jadMusic.volume;
  const steps = Math.max(1, Math.round(fadeMs / 50));
  let step = 0;
  jadMusicFadeTimer = setInterval(() => {
    step += 1;
    jadMusic.volume = Math.max(0, startVolume * (1 - step / steps));
    if (step >= steps) {
      clearJadMusicFade();
      jadMusic.pause();
      try { jadMusic.currentTime = 0; } catch (_) {}
      jadMusic.volume = 0;
    }
  }, 50);
}

function clearCombatMusicFade() {
  if (combatMusicFadeTimer) clearInterval(combatMusicFadeTimer);
  combatMusicFadeTimer = null;
}

function startCombatMusic() {
  clearCombatMusicFade();
  try {
    combatMusic.pause();
    combatMusic.currentTime = 0;
    combatMusic.volume = 0;
    const playPromise = combatMusic.play();
    if (playPromise?.catch) playPromise.catch(error => console.warn('Combat music could not start:', error));
    const targetVolume = 0.58;
    const steps = 10;
    let step = 0;
    combatMusicFadeTimer = setInterval(() => {
      step += 1;
      combatMusic.volume = Math.min(targetVolume, targetVolume * (step / steps));
      if (step >= steps) clearCombatMusicFade();
    }, 50);
  } catch (error) {
    console.warn('Combat music could not start:', error);
  }
}

function stopCombatMusic(fadeMs = 650) {
  clearCombatMusicFade();
  if (combatMusic.paused) {
    try { combatMusic.currentTime = 0; combatMusic.volume = 0; } catch (_) {}
    return;
  }
  const startVolume = combatMusic.volume;
  const steps = Math.max(1, Math.round(fadeMs / 50));
  let step = 0;
  combatMusicFadeTimer = setInterval(() => {
    step += 1;
    combatMusic.volume = Math.max(0, startVolume * (1 - step / steps));
    if (step >= steps) {
      clearCombatMusicFade();
      combatMusic.pause();
      try { combatMusic.currentTime = 0; } catch (_) {}
      combatMusic.volume = 0;
    }
  }, 50);
}

const MAX_SKILL_XP = 13034431;

function xpForLevel(level) {
  let points = 0;
  for (let i = 1; i < level; i++) points += Math.floor(i + 300 * Math.pow(2, i / 7));
  return Math.floor(points / 4);
}

function levelFromXp(xp) {
  const cappedXp = Math.max(0, Math.min(MAX_SKILL_XP, Number(xp) || 0));
  for (let level = 2; level <= 99; level++) {
    if (cappedXp < xpForLevel(level)) return level - 1;
  }
  return 99;
}

function harmonyLevelFromXp(xp) {
  return levelFromXp(xp);
}

function totalLevelForCharacter(data = character) {
  if (!data) return harmonyLevelFromXp(count);
  const skills = ['woodcutting','mining','fishing','agility','slayer','attack','strength','defence','sailing','runecrafting','cooking','magic','ranged','farming'];
  return skills.reduce((sum, skill) => sum + levelFromXp(Number(data[`${skill}_xp`]) || 0), 0) + harmonyLevelFromXp(count);
}

function render() {
  const harmonyLevel = harmonyLevelFromXp(count);
  const currentLevelXp = xpForLevel(harmonyLevel);
  const reached99 = harmonyLevel >= 99;
  const nextLevelXp = reached99 ? MAX_SKILL_XP : xpForLevel(harmonyLevel + 1);
  const progress = reached99 ? 1 : Math.max(0, Math.min(1, (count - currentLevelXp) / Math.max(1, nextLevelXp - currentLevelXp)));

  $('count').textContent = harmonyLevel.toLocaleString('en-GB');
  $('status').textContent = `${count.toLocaleString('en-GB')} total Harmony XP`;
  const harmonyFredoUnlocked = count >= 6517253;
  const harmonyFredoUnlock = $('harmonyFredoUnlock');
  const harmonyFredoState = $('harmonyFredoState');
  if (harmonyFredoUnlock) harmonyFredoUnlock.classList.toggle('locked', !harmonyFredoUnlocked);
  if (harmonyFredoUnlock) harmonyFredoUnlock.classList.toggle('unlocked', harmonyFredoUnlocked);
  if (harmonyFredoState) harmonyFredoState.textContent = harmonyFredoUnlocked ? 'UNLOCKED' : 'LOCKED';
  const harmonyLampUnlocks = [
    ['harmonyLamp50Unlock','harmonyLamp50State',101333],
    ['harmonyLamp60Unlock','harmonyLamp60State',273742],
    ['harmonyLamp70Unlock','harmonyLamp70State',737627],
    ['harmonyLamp80Unlock','harmonyLamp80State',1986068]
  ];
  harmonyLampUnlocks.forEach(([boxId,stateId,xp])=>{const unlocked=count>=xp,box=$(boxId),state=$(stateId);if(box){box.classList.toggle('locked',!unlocked);box.classList.toggle('unlocked',unlocked)}if(state)state.textContent=unlocked?'UNLOCKED':'LOCKED';});
  const harmonyCapeUnlocked = count >= 13034431;
  const harmonyCapeUnlock = $('harmonyCapeUnlock');
  const harmonyCapeState = $('harmonyCapeState');
  if (harmonyCapeUnlock) harmonyCapeUnlock.classList.toggle('locked', !harmonyCapeUnlocked);
  if (harmonyCapeUnlock) harmonyCapeUnlock.classList.toggle('unlocked', harmonyCapeUnlocked);
  if (harmonyCapeState) harmonyCapeState.textContent = harmonyCapeUnlocked ? 'UNLOCKED' : 'LOCKED';
  $('percent').textContent = reached99
    ? `LEVEL 99 ACHIEVED · ${count.toLocaleString('en-GB')} XP`
    : `${Math.max(0, nextLevelXp - count).toLocaleString('en-GB')} XP`;
  $('fill').style.width = `${progress * 100}%`;
  $('level').textContent = `HARMONY LEVEL: ${harmonyLevel}`;
  $('gamer').style.setProperty('--fat', '0');
  if (character && $('totalLevel')) $('totalLevel').textContent = totalLevelForCharacter();
}

function showError(message, error) {
  console.error(message, error);
  $('status').textContent = message;
}

function toast(message, duration = 3000) {
  const el = $('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show'), duration);
}

async function loadCount() {
  const { data, error } = await db.from('counter').select('count').eq('id', 1).single();
  if (error) return showError('Could not connect to the shared counter.', error);
  count = Number(data.count) || 0;
  render();
}

async function changeCount(amount) {
  if (busy) return;
  busy = true;
  const { data, error } = await db.rpc('change_counter', { amount });
  busy = false;
  if (error) return showError('Harmony XP could not be gained. Run add-harmony-group-skill.sql in Supabase.', error);
  count = Number(data) || 0;
  render();
  if (amount > 0 && character) loadDailyXpLeaderboard();
}

async function resetCount() {
  const { data, error } = await db.rpc('reset_counter');
  if (error) return showError('The counter could not be reset.', error);
  count = Number(data) || 0;
  render();
}

const SIGNED_OUT_NATURE_VOLUME = 0.35;
let signedOutNatureAudioUnlocked = false;

function syncSignedOutNatureAudio() {
  const audio = $('signedOutNatureAudio');
  if (!audio) return;
  audio.volume = SIGNED_OUT_NATURE_VOLUME;

  if (character) {
    audio.pause();
    audio.currentTime = 0;
    signedOutNatureAudioUnlocked = false;
    return;
  }

  const playAttempt = audio.play();
  if (playAttempt && typeof playAttempt.catch === 'function') {
    playAttempt
      .then(() => { signedOutNatureAudioUnlocked = true; })
      .catch(() => { signedOutNatureAudioUnlocked = false; });
  }
}

function unlockSignedOutNatureAudio() {
  if (character || signedOutNatureAudioUnlocked) return;
  syncSignedOutNatureAudio();
}

document.addEventListener('pointerdown', unlockSignedOutNatureAudio, { passive: true });
document.addEventListener('keydown', unlockSignedOutNatureAudio);

function renderCharacter() {
  const hasCharacter = Boolean(character);
  document.body.classList.toggle('repo-logged-out', !hasCharacter);
  document.body.classList.toggle('repo-logged-in', hasCharacter);
  $('createCharacter').classList.toggle('hidden', hasCharacter);
  $('signedInControls')?.classList.toggle('hidden', !hasCharacter);
  $('characterSummary').classList.toggle('hidden', !hasCharacter);
  $('openSkills').disabled = !hasCharacter;
  if ($('openPets')) $('openPets').disabled = !hasCharacter;
  $('openAgility').disabled = !hasCharacter;
  $('openSlayer').disabled = !hasCharacter;
  $('openCombat').disabled = !hasCharacter;
  $('openSailing').disabled = !hasCharacter;
  if($('openCooking')) $('openCooking').disabled = !hasCharacter;
  $('openMining').disabled = false;
  $('openRunecrafting').disabled = !hasCharacter;
  $('openBank').disabled = false;
  $('openGrandExchange').disabled = false;
  $('openPetWars').disabled = false;
  $('openQuests').disabled = false;
  $('openRaids').disabled = false;
  if($('openRuneDle')) $('openRuneDle').disabled = false;
  // Keep the Wise Old Man button clickable so it cannot get stuck greyed out.
  $('openWiseTask').disabled = false;
  syncSignedOutNatureAudio();
  if (!hasCharacter) {
    $('createCharacter').textContent = 'LOG IN / CREATE ACCOUNT';
    return;
  }

  const total = totalLevelForCharacter(character);
  $('characterName').textContent = character.username;
  const isCatAsthma=String(character.username||'').toLowerCase()==='catasthma';
  $('adminButton')?.classList.toggle('hidden',!isCatAsthma);
  if(!isCatAsthma&&$('adminButton'))$('adminButton').classList.remove('active');
  $('totalLevel').textContent = total;
  queueWiseTaskCheck();
  keepCoreAdventureButtonsEnabled();
}

function keepCoreAdventureButtonsEnabled() {
  ['openMining','openQuests','openRaids','openRuneDle'].forEach(id => {
    const button = $(id);
    if (!button) return;
    button.disabled = false;
    button.removeAttribute('disabled');
    button.setAttribute('aria-disabled', 'false');
    button.classList.remove('is-disabled');
  });
}

function usernameToEmail(username) {
  return `${username.trim().toLowerCase()}@${AUTH_DOMAIN}`;
}

function validUsername(username) {
  return /^[A-Za-z0-9_-]{3,16}$/.test(username);
}

async function loadCharacter() {
  const { data: { session } } = await db.auth.getSession();
  if (!session) {
    character = null;
    renderCharacter();
    return;
  }

  const { data, error } = await db.rpc('get_my_character');
  if (error) {
    console.error('Could not load character.', error);
    character = null;
    renderCharacter();
    return;
  }
  character = data?.[0] || null;
  if(character){await loadQuestProfile();await loadAchievements();}
  renderCharacter();
  scheduleSpawn();
}

async function registerAccount(username, password) {
  const email = usernameToEmail(username);
  const { data, error } = await db.auth.signUp({
    email,
    password,
    options: { data: { username: username.trim() } }
  });
  if (error) throw error;
  if (!data.session) {
    throw new Error('Account created, but email confirmation is enabled in Supabase. Turn off Confirm email in Authentication settings, then log in.');
  }
  await loadCharacter();
  if (!character) throw new Error('Account was created, but the character profile could not be loaded. Run the new SQL setup.');
}

async function loginAccount(username, password) {
  const { error } = await db.auth.signInWithPassword({
    email: usernameToEmail(username),
    password
  });
  if (error) throw error;
  await loadCharacter();
  if (!character) throw new Error('Logged in, but no character profile was found. Run the new SQL setup.');
}

async function logoutAccount() {
  await db.auth.signOut();
  character = null;
  clearTimeout(spawnTimer);
  if (currentResource) removeResource(false);
  renderCharacter();
}

function scheduleSpawn() {
  clearTimeout(spawnTimer);
  if (!character || currentResource) return;
  // A new skilling event is attempted 30 seconds after login or after the last event ends.
  spawnTimer = setTimeout(spawnResource, 30000);
}

function spawnResource() {
  if (!character || currentResource || document.hidden) return scheduleSpawn();
  const types = Object.keys(SKILLS);
  const type = types[Math.floor(Math.random() * types.length)];
  const info = SKILLS[type];
  const button = document.createElement('button');
  button.className = `resource-node ${type}`;
  button.type = 'button';
  button.setAttribute('aria-label', `Collect ${info.label} XP`);
  button.style.left = `${8 + Math.random() * 72}%`;
  button.style.top = `${15 + Math.random() * 58}%`;
  button.innerHTML = `<img src="${info.image}" alt=""><span>${info.label}</span>`;
  $('resourceLayer').appendChild(button);
  currentResource = { type, button, expires: setTimeout(() => removeResource(false), 25000) };
  button.onclick = collectResource;
  toast(`A ${info.label.toLowerCase()} event has appeared!`, 2500);
}

function removeResource(collected) {
  if (!currentResource) return;
  clearTimeout(currentResource.expires);
  const button = currentResource.button;
  button.classList.add(collected ? 'collected' : 'expired');
  setTimeout(() => button.remove(), 350);
  currentResource = null;
  scheduleSpawn();
}

async function collectResource() {
  if (!character || !currentResource || busy) return;
  busy = true;
  const type = currentResource.type;
  const oldLevel = levelFromXp(character[`${type}_xp`]);
  currentResource.button.disabled = true;
  currentResource.button.classList.add('working');

  const { data, error } = await db.rpc('collect_resource', { p_skill: type });
  busy = false;
  if (error) {
    currentResource.button.disabled = false;
    currentResource.button.classList.remove('working');
    toast('That resource could not be collected.');
    return console.error(error);
  }

  const result = data?.[0];
  if (!result) return;
  character[`${type}_xp`] = Number(result.new_xp);
  const newLevel = levelFromXp(character[`${type}_xp`]);
  removeResource(true);
  renderCharacter();

  let message = `+${result.xp_gained} ${SKILLS[type].label} XP`;
  if (newLevel > oldLevel) message += ` — Level ${newLevel}!`;
  if (result.drop_name) {
    message += ` — Collection log: ${result.drop_name}!`;
    const collectible = COLLECTIBLES.find(([, label]) => label === result.drop_name);
    if (collectible && !character.collection.includes(collectible[0])) {
      character.collection.push(collectible[0]);
    }
  }
  toast(message, 4500);
}

function openSkills() {
  if (!character) return;
  $('skillsTitle').textContent = character.username.toUpperCase();
  $('skillsGrid').innerHTML = Object.entries(SKILLS).map(([key, info]) => {
    const xp = Number(character[`${key}_xp`]) || 0;
    const lvl = levelFromXp(xp);
    const next = lvl === 99 ? xp : xpForLevel(lvl + 1);
    const previous = xpForLevel(lvl);
    const pct = lvl === 99 ? 100 : Math.max(0, Math.min(100, ((xp - previous) / (next - previous)) * 100));
    return `<div class="skill-card"><img src="${info.image}" alt=""><div><b>${info.label}</b><strong>${lvl}</strong><small>${xp.toLocaleString('en-GB')} XP</small><i><span style="width:${pct}%"></span></i></div></div>`;
  }).join('');

  const agilityXp = Number(character.agility_xp) || 0;
  const agilityLevel = levelFromXp(agilityXp);
  const agilityNext = agilityLevel === 99 ? agilityXp : xpForLevel(agilityLevel + 1);
  const agilityPrevious = xpForLevel(agilityLevel);
  const agilityPct = agilityLevel === 99 ? 100 : Math.max(0, Math.min(100, ((agilityXp - agilityPrevious) / (agilityNext - agilityPrevious)) * 100));
  $('skillsGrid').insertAdjacentHTML('beforeend', `<div class="skill-card agility"><img class="agility-skill-icon" src="assets/agility-icon.webp" alt="Agility"><div><b>Agility</b><strong>${agilityLevel}</strong><small>${agilityXp.toLocaleString('en-GB')} XP</small><i><span style="width:${agilityPct}%"></span></i></div></div>`);
  const slayerXp = Number(character.slayer_xp) || 0;
  const slayerLevel = levelFromXp(slayerXp);
  const slayerNext = slayerLevel === 99 ? slayerXp : xpForLevel(slayerLevel + 1);
  const slayerPrevious = xpForLevel(slayerLevel);
  const slayerPct = slayerLevel === 99 ? 100 : Math.max(0, Math.min(100, ((slayerXp - slayerPrevious) / (slayerNext - slayerPrevious)) * 100));
  $('skillsGrid').insertAdjacentHTML('beforeend', `<div class="skill-card slayer"><img class="slayer-skill-icon" src="assets/slayer-icon.png" alt="Slayer"><div><b>Slayer</b><strong>${slayerLevel}</strong><small>${slayerXp.toLocaleString('en-GB')} XP</small><i><span style="width:${slayerPct}%"></span></i></div></div>`);
  [['Attack','attack','assets/attack-icon.webp'],['Strength','strength','assets/strength-icon.webp'],['Defence','defence','assets/defence-icon.webp'],['Magic','magic','assets/magic-icon.png'],['Ranged','ranged','assets/ranged-icon.png']].forEach(([label,key,image]) => {
    const xp = Number(character[`${key}_xp`]) || 0;
    const lvl = levelFromXp(xp);
    const next = lvl === 99 ? xp : xpForLevel(lvl + 1);
    const previous = xpForLevel(lvl);
    const pct = lvl === 99 ? 100 : Math.max(0, Math.min(100, ((xp - previous) / (next - previous)) * 100));
    $('skillsGrid').insertAdjacentHTML('beforeend', `<div class="skill-card combat-skill"><img class="combat-skill-icon" src="${image}" alt="${label}"><div><b>${label}</b><strong>${lvl}</strong><small>${xp.toLocaleString('en-GB')} XP</small><i><span style="width:${pct}%"></span></i></div></div>`);
  });
  const sailingXp = Number(character.sailing_xp) || 0;
  const sailingLevel = levelFromXp(sailingXp);
  const sailingNext = sailingLevel === 99 ? sailingXp : xpForLevel(sailingLevel + 1);
  const sailingPrevious = xpForLevel(sailingLevel);
  const sailingPct = sailingLevel === 99 ? 100 : Math.max(0, Math.min(100, ((sailingXp - sailingPrevious) / (sailingNext - sailingPrevious)) * 100));
  $('skillsGrid').insertAdjacentHTML('beforeend', `<div class="skill-card sailing"><img class="sailing-skill-icon" src="assets/sailing-icon.webp" alt="Sailing"><div><b>Sailing</b><strong>${sailingLevel}</strong><small>${sailingXp.toLocaleString('en-GB')} XP</small><i><span style="width:${sailingPct}%"></span></i></div></div>`);
  const rcXp = Number(character.runecrafting_xp) || 0;
  const rcLvl = levelFromXp(rcXp), rcPrev=xpForLevel(rcLvl), rcNext=rcLvl===99?rcXp:xpForLevel(rcLvl+1);
  const rcPct=rcLvl===99?100:Math.max(0,Math.min(100,((rcXp-rcPrev)/(rcNext-rcPrev))*100));
  $('skillsGrid').insertAdjacentHTML('beforeend', `<div class="skill-card runecrafting"><img class="rc-skill-icon" src="assets/runecrafting-icon.png" alt=""><div><b>Runecrafting</b><strong>${rcLvl}</strong><small>${rcXp.toLocaleString('en-GB')} XP</small><i><span style="width:${rcPct}%"></span></i></div></div>`);
  const cookingXp=Number(character.cooking_xp)||0,cookingLvl=levelFromXp(cookingXp),cookingPrev=xpForLevel(cookingLvl),cookingNext=cookingLvl===99?cookingXp:xpForLevel(cookingLvl+1),cookingPct=cookingLvl===99?100:Math.max(0,Math.min(100,((cookingXp-cookingPrev)/(cookingNext-cookingPrev))*100));
  $('skillsGrid').insertAdjacentHTML('beforeend', `<div class="skill-card cooking"><img src="assets/cooking-icon-new.png" alt="Cooking"><div><b>Cooking</b><strong>${cookingLvl}</strong><small>${cookingXp.toLocaleString('en-GB')} XP</small><i><span style="width:${cookingPct}%"></span></i></div></div>`);
  const farmingXp=Number(character.farming_xp)||0,farmingLvl=levelFromXp(farmingXp),farmingPrev=xpForLevel(farmingLvl),farmingNext=farmingLvl===99?farmingXp:xpForLevel(farmingLvl+1),farmingPct=farmingLvl===99?100:Math.max(0,Math.min(100,((farmingXp-farmingPrev)/(farmingNext-farmingPrev))*100));
  $('skillsGrid').insertAdjacentHTML('beforeend', `<div class="skill-card farming"><img src="assets/watering-can.png" alt="Farming"><div><b>Farming</b><strong>${farmingLvl}</strong><small>${farmingXp.toLocaleString('en-GB')} XP</small><i><span style="width:${farmingPct}%"></span></i></div></div>`);

  const harmonyXp = Number(count) || 0;
  const harmonyLvl = harmonyLevelFromXp(harmonyXp);
  const harmonyPrev = xpForLevel(harmonyLvl);
  const harmonyNext = harmonyLvl === 99 ? harmonyXp : xpForLevel(harmonyLvl + 1);
  const harmonyPct = harmonyLvl === 99 ? 100 : Math.max(0, Math.min(100, ((harmonyXp - harmonyPrev) / Math.max(1, harmonyNext - harmonyPrev)) * 100));
  $('skillsGrid').insertAdjacentHTML('afterbegin', `<div class="skill-card harmony-skill"><img class="harmony-skill-logo" src="assets/harmony-logo.png" alt="Harmony"><div><b>Harmony</b><strong>${harmonyLvl}</strong><small>${harmonyXp.toLocaleString('en-GB')} XP · Shared</small><i><span style="width:${harmonyPct}%"></span></i></div></div>`);

  const unlocked = new Set(character.collection || []);
  $('collectionGrid').innerHTML = COLLECTIBLES.map(([id, label]) => `<div class="collectible ${unlocked.has(id) ? 'found' : ''}"><span>${unlocked.has(id) ? '◆' : '?'}</span>${label}</div>`).join('');
  $('skillsDialog').showModal();
}



function setAgilityMode(mode) {
  agilityMode = mode;
  const dash = mode === 'dash';
  $('dashGamePanel').classList.toggle('hidden', !dash);
  $('gnomeBallPanel').classList.toggle('hidden', dash);
  $('chooseDash').classList.toggle('selected', dash);
  $('chooseGnomeBall').classList.toggle('selected', !dash);
  if (dash) {
    stopGnomeBall(false);
    loadAgilityLeaderboard();
  } else {
    resetAgilityGame();
    resetGnomeBall();
    loadGnomeBallLeaderboard();
  }
}

const gnomeBallMusic = new Audio('assets/gnomeball-theme.mp3');
gnomeBallMusic.loop = true;
gnomeBallMusic.preload = 'auto';
gnomeBallMusic.volume = 0;
let gnomeBallMusicFade = null;
function fadeGnomeBallMusic(target, duration=450, resetAfter=false){
  clearInterval(gnomeBallMusicFade);
  const start=gnomeBallMusic.volume,steps=Math.max(1,Math.round(duration/30));let n=0;
  gnomeBallMusicFade=setInterval(()=>{n++;gnomeBallMusic.volume=start+(target-start)*(n/steps);if(n>=steps){clearInterval(gnomeBallMusicFade);gnomeBallMusic.volume=target;if(resetAfter){gnomeBallMusic.pause();try{gnomeBallMusic.currentTime=0}catch(_){}}}},30);
}
function startGnomeBallMusic(){
  clearInterval(gnomeBallMusicFade);
  try{gnomeBallMusic.pause();gnomeBallMusic.currentTime=0;gnomeBallMusic.volume=0}catch(_){}
  const play=gnomeBallMusic.play();
  if(play?.then)play.then(()=>fadeGnomeBallMusic(.65,600)).catch(()=>{});
}
function stopGnomeBallMusic(immediate=false){
  clearInterval(gnomeBallMusicFade);
  if(immediate){gnomeBallMusic.pause();try{gnomeBallMusic.currentTime=0}catch(_){}gnomeBallMusic.volume=0;return;}
  if(gnomeBallMusic.paused){try{gnomeBallMusic.currentTime=0}catch(_){}gnomeBallMusic.volume=0;return;}
  fadeGnomeBallMusic(0,400,true);
}

function resetGnomeBall(message = 'Drag the Gnome Ball down, then release to throw it upwards through the hoop.') {
  stopGnomeBall(false);
  gnomeBallState = makeGnomeBallState();
  $('gnomeBallStart').classList.remove('hidden');
  $('gnomeBallStart').textContent = 'START GNOME BALL';
  $('gnomeBallMessage').textContent = message;
  updateGnomeBallHud();
  drawGnomeBall();
}

function makeGnomeBallState() {
  return {
    ball:{x:380,y:365,r:20,vx:0,vy:0,held:false,flying:false,scored:false},
    start:{x:380,y:365}, pointer:{x:380,y:365},
    hoop:{x:315,y:110,w:130,vx:0},
    streak:0,best:0,savedBest:0,lives:3,level:1,gravity:560,lastShotAt:0,settle:0
  };
}

function startGnomeBall() {
  if (!character || gnomeBallRunning) return;
  if (!gnomeBallState || gnomeBallState.lives <= 0) gnomeBallState = makeGnomeBallState();
  gnomeBallRunning = true;
  startGnomeBallMusic();
  gnomeBallLast = performance.now();
  $('gnomeBallStart').classList.add('hidden');
  $('gnomeBallMessage').textContent = 'Pull the ball down and release — throw it straight up through the hoop!';
  gnomeBallFrame = requestAnimationFrame(gnomeBallLoop);
}

function stopGnomeBall(showButton = true) {
  stopGnomeBallMusic(true);
  gnomeBallRunning = false;
  cancelAnimationFrame(gnomeBallFrame);
  gnomeBallFrame = null;
  if (showButton && $('gnomeBallStart')) $('gnomeBallStart').classList.remove('hidden');
}

function gnomeBallLoop(now) {
  if (!gnomeBallRunning || !gnomeBallState) return;
  const dt = Math.min(.025, (now - gnomeBallLast) / 1000 || .016);
  gnomeBallLast = now;
  const s = gnomeBallState, b = s.ball, h = s.hoop;
  // Starts stationary and generous. The hoop gradually narrows and moves faster.
  h.w = Math.max(72, 130 - Math.max(0, s.streak - 3) * 3);
  if (s.streak >= 5) {
    const speed = 24 + Math.min(115, (s.streak - 5) * 4.5);
    if (!h.vx) h.vx = speed;
    h.x += h.vx * dt;
    if (h.x < 55 || h.x + h.w > 705) {
      h.vx *= -1;
      h.x = Math.max(55, Math.min(705 - h.w, h.x));
    }
  } else {
    h.vx = 0;
    h.x = (760 - h.w) / 2;
  }
  if (b.flying) {
    const oldY=b.y;
    b.vy += s.gravity * dt; b.x += b.vx*dt; b.y += b.vy*dt;
    b.vx *= Math.pow(.995,dt*60);
    const rimY=h.y, left=h.x, right=h.x+h.w;
    if (!b.scored && b.vy>0 && oldY < rimY && b.y >= rimY && b.x > left+4 && b.x < right-4) {
      b.scored=true; s.streak++; s.best=Math.max(s.best,s.streak); s.level=1+Math.floor(s.streak/5);
      $('gnomeBallMessage').textContent = s.streak % 5 === 0 ? `GNOME-TASTIC! ${s.streak} in a row — the hoop is getting faster!` : `${s.streak} in a row! Keep it going.`;
      updateGnomeBallHud();
    }
    if (b.y > 455 || b.x < -40 || b.x > 800) {
      if (!b.scored) {
        stopGnomeBallMusic(false);
        const endedStreak=s.streak;
        s.lives--; s.streak=0;
        $('gnomeBallMessage').textContent = endedStreak ? `Streak ${endedStreak} ended — saving score and stopping the music…` : (s.lives ? 'Miss! No streak to save — the music has stopped.' : 'Out of gnome balls!');
        if(endedStreak>0) saveGnomeBallStreak(endedStreak,s.lives<=0);
      }
      b.flying=false; s.settle=.55; updateGnomeBallHud();
    }
  } else if (s.settle>0) {
    s.settle-=dt;
    if (s.settle<=0) {
      if (s.lives<=0) finishGnomeBall(); else resetGnomeBallShot();
    }
  }
  drawGnomeBall();
  if (gnomeBallRunning) gnomeBallFrame=requestAnimationFrame(gnomeBallLoop);
}

function resetGnomeBallShot(){ const s=gnomeBallState,b=s.ball;b.x=s.start.x;b.y=s.start.y;b.vx=b.vy=0;b.held=b.flying=b.scored=false; }
function updateGnomeBallHud(){const s=gnomeBallState||makeGnomeBallState();$('gnomeBallStreak').textContent=s.streak;$('gnomeBallBest').textContent=s.best;$('gnomeBallLevel').textContent=s.level;$('gnomeBallLives').textContent='● '.repeat(s.lives).trim()||'—';}

async function saveGnomeBallStreak(streak,finalAttempt=false){
  const s=gnomeBallState;
  if(!s||streak<1||streak<=Number(s.savedBest||0)){
    if(finalAttempt) finishGnomeBall();
    return;
  }
  s.savedBest=streak;
  gnomeBallSaving=true;
  const {data,error}=await db.rpc('complete_gnome_ball',{p_streak:streak});
  gnomeBallSaving=false;
  if(error||!data?.[0]){
    console.error(error);s.savedBest=0;
    $('gnomeBallMessage').textContent='Could not save the Gnome Ball streak. Run update-gnome-ball.sql in Supabase.';
    return;
  }
  const result=data[0],old=levelFromXp(character.agility_xp||0);
  character.agility_xp=Number(result.new_xp);renderCharacter();loadGnomeBallLeaderboard();
  const levelUp=levelFromXp(character.agility_xp)>old?' — Agility level up!':'';
  const personal=result.is_personal_best?' — New leaderboard personal best!':'';
  $('gnomeBallMessage').textContent=`Streak ${streak} saved! +${result.xp_gained} Agility XP${levelUp}${personal}`;
  if(finalAttempt) setTimeout(finishGnomeBall,350);
}

async function finishGnomeBall(){
  stopGnomeBall(false);const s=gnomeBallState,best=s.best;
  $('gnomeBallStart').classList.remove('hidden');$('gnomeBallStart').textContent='PLAY AGAIN';
  if(!best){$('gnomeBallMessage').textContent='No baskets this time — give it another throw!';return;}
  if(best>Number(s.savedBest||0)){await saveGnomeBallStreak(best,false);}
  $('gnomeBallMessage').textContent=`Attempt finished — best streak ${best}. Your leaderboard score is saved.`;
  loadGnomeBallLeaderboard();
}

function gnomeBallPoint(e){const c=$('gnomeBallCanvas'),r=c.getBoundingClientRect();return{x:(e.clientX-r.left)*c.width/r.width,y:(e.clientY-r.top)*c.height/r.height};}
function gnomeBallDown(e){if(!gnomeBallRunning||!gnomeBallState||gnomeBallState.ball.flying)return;const p=gnomeBallPoint(e),b=gnomeBallState.ball;if(Math.hypot(p.x-b.x,p.y-b.y)<=42){e.preventDefault();b.held=true;gnomeBallState.pointer=p;$('gnomeBallCanvas').classList.add('aiming');$('gnomeBallCanvas').setPointerCapture?.(e.pointerId);}}
function gnomeBallMove(e){if(!gnomeBallState?.ball.held)return;e.preventDefault();gnomeBallState.pointer=gnomeBallPoint(e);drawGnomeBall();}
function gnomeBallUp(e){const s=gnomeBallState;if(!s?.ball.held)return;e.preventDefault();const p=gnomeBallPoint(e),b=s.ball;b.held=false;$('gnomeBallCanvas').classList.remove('aiming');const dx=b.x-p.x,dy=b.y-p.y,mag=Math.hypot(dx,dy);if(mag<16)return;const power=Math.min(820,Math.max(500,mag*4.5));const aimX=Math.max(-0.42,Math.min(0.42,dx/mag));b.vx=aimX*power;b.vy=-Math.sqrt(Math.max(0,1-aimX*aimX))*power;b.flying=true;b.scored=false;}

function drawGnomeBall(){
  const c=$('gnomeBallCanvas'); if(!c||!gnomeBallState)return; const x=c.getContext('2d'),s=gnomeBallState,b=s.ball,h=s.hoop;
  x.clearRect(0,0,c.width,c.height);
  const g=x.createLinearGradient(0,0,0,430);g.addColorStop(0,'#142d1b');g.addColorStop(.72,'#284c27');g.addColorStop(.73,'#8b6a35');g.addColorStop(1,'#33220e');x.fillStyle=g;x.fillRect(0,0,760,430);
  x.fillStyle='#17371d';for(let i=0;i<14;i++){x.beginPath();x.arc(i*62+20,302+(i%3)*6,48,Math.PI,0);x.fill();}
  x.fillStyle='#a98345';x.fillRect(0,302,760,7);x.fillStyle='#573d1b';for(let i=0;i<760;i+=38)x.fillRect(i,309,5,121);

  // Backboard and vertically positioned hoop.
  x.fillStyle='#d7cfad';x.fillRect(h.x-25,h.y-72,h.w+50,82);x.strokeStyle='#756a4e';x.lineWidth=4;x.strokeRect(h.x-25,h.y-72,h.w+50,82);
  x.fillStyle='#5f4630';x.fillRect(h.x+h.w/2-7,h.y+50,14,74);
  x.strokeStyle='#d9b34f';x.lineWidth=7;x.beginPath();x.ellipse(h.x+h.w/2,h.y,h.w/2,9,0,0,Math.PI*2);x.stroke();
  x.strokeStyle='#ded7b8';x.lineWidth=2;for(let i=0;i<8;i++){const px=h.x+8+i*(h.w-16)/7;x.beginPath();x.moveTo(px,h.y+5);x.lineTo(h.x+h.w/2+(px-(h.x+h.w/2))*.55,h.y+58);x.stroke();}for(let yy=16;yy<58;yy+=11){x.beginPath();x.moveTo(h.x+12,h.y+yy);x.lineTo(h.x+h.w-12,h.y+yy);x.stroke();}

  // Gnome spectators beside the court.
  const gx=85; x.fillStyle='#bd3e2d';x.beginPath();x.moveTo(gx,278);x.lineTo(gx+40,278);x.lineTo(gx+20,218);x.fill();x.fillStyle='#f0c7a1';x.beginPath();x.arc(gx+20,292,20,0,Math.PI*2);x.fill();x.fillStyle='#35672f';x.fillRect(gx+2,310,37,54);
  const gx2=625; x.fillStyle='#2d5fa7';x.beginPath();x.moveTo(gx2,278);x.lineTo(gx2+40,278);x.lineTo(gx2+20,218);x.fill();x.fillStyle='#efc49b';x.beginPath();x.arc(gx2+20,292,20,0,Math.PI*2);x.fill();x.fillStyle='#6b3c78';x.fillRect(gx2+2,310,37,54);

  if(b.held){const p=s.pointer;x.strokeStyle='#f1d68a99';x.lineWidth=3;x.setLineDash([8,7]);x.beginPath();x.moveTo(b.x,b.y);x.lineTo(b.x+(b.x-p.x)*1.8,b.y+(b.y-p.y)*1.8);x.stroke();x.setLineDash([]);}
  x.fillStyle='#9a5c28';x.beginPath();x.arc(b.x,b.y,b.r,0,Math.PI*2);x.fill();x.strokeStyle='#d0a05a';x.lineWidth=3;x.stroke();x.strokeStyle='#512a13';x.lineWidth=2;x.beginPath();x.arc(b.x,b.y,b.r*.64,-.8,2.3);x.stroke();x.beginPath();x.moveTo(b.x-b.r,b.y);x.lineTo(b.x+b.r,b.y);x.stroke();x.fillStyle='#f0d38d';x.font='bold 10px serif';x.textAlign='center';x.fillText('GNOME',b.x,b.y+4);
  x.fillStyle='#f5e6b3';x.font='bold 16px serif';x.textAlign='left';x.fillText(s.streak>=5?'MOVING GNOME HOOP!':'GNOME BALL',18,28);
  x.font='13px serif';x.fillStyle='#ead79a';x.fillText('Pull down • Release • Swish',18,49);
}

async function loadGnomeBallLeaderboard(){const board=$('gnomeBallLeaderboard');board.textContent='Loading...';const{data,error}=await db.rpc('get_gnome_ball_leaderboard');if(error){console.error(error);board.textContent='Run update-gnome-ball.sql to enable this leaderboard.';return;}if(!data?.length){board.textContent='No Gnome Ball streaks yet.';return;}board.innerHTML=data.map((r,i)=>`<div><b>${i+1}</b><button class="player-link" type="button" data-username="${escapeHtml(r.username)}">${escapeHtml(r.username)}</button><strong>${r.best_streak} streak</strong></div>`).join('');board.querySelectorAll('.player-link').forEach(b=>b.addEventListener('click',()=>openPlayerStats(b.dataset.username)));}

function resetAgilityGame(message = 'Collect all 15 XP drops to receive XP.') {
  agilityRunning = false;
  clearInterval(agilityClock);
  agilityClock = null;
  $('agilityArena').querySelectorAll('.agility-target').forEach(el => el.remove());
  $('agilityStart').classList.remove('hidden');
  $('agilityStart').textContent = 'START DASH';
  const runner = $('agilityRunner');
  runner.style.left = '50%';
  runner.style.top = '55%';
  runner.classList.remove('running');
  $('agilityProgress').textContent = `0 / ${AGILITY_TARGETS}`;
  $('agilityTime').textContent = '0.00s';
  $('agilityBest').textContent = '—';
  $('agilityMessage').textContent = message;
}

function openAgility() {
  if (!character) return;
  resetAgilityGame();
  resetGnomeBall();
  setAgilityMode('dash');
  $('agilityDialog').showModal();
  loadAgilityLeaderboard();
}

function placeAgilityTarget() {
  const arena = $('agilityArena');
  arena.querySelectorAll('.agility-target').forEach(el => el.remove());
  const target = document.createElement('button');
  target.type = 'button';
  target.className = 'agility-target';
  target.setAttribute('aria-label', 'Collect the XP drop');
  target.innerHTML = '<span class="xp-drop-star">✦</span><span class="mini-can-label">XP</span>';
  target.style.left = `${10 + Math.random() * 80}%`;
  target.style.top = `${13 + Math.random() * 74}%`;
  agilityShownAt = performance.now();
  target.onclick = hitAgilityTarget;
  arena.appendChild(target);
}

function startAgilityGame() {
  if (!character || agilityRunning) return;
  agilityRunning = true;
  agilityTarget = 0;
  agilityReactions = [];
  agilityStartedAt = performance.now();
  $('agilityStart').classList.add('hidden');
  $('agilityMessage').textContent = 'Collect the XP drops!';
  $('agilityProgress').textContent = `0 / ${AGILITY_TARGETS}`;
  agilityClock = setInterval(() => {
    $('agilityTime').textContent = `${((performance.now() - agilityStartedAt) / 1000).toFixed(2)}s`;
  }, 50);
  placeAgilityTarget();
}

async function hitAgilityTarget(event) {
  if (!agilityRunning || busy) return;
  const reaction = performance.now() - agilityShownAt;
  agilityReactions.push(reaction);
  agilityTarget += 1;
  const runner = $('agilityRunner');
  runner.style.left = event.currentTarget.style.left;
  runner.style.top = event.currentTarget.style.top;
  runner.classList.remove('running');
  void runner.offsetWidth;
  runner.classList.add('running');
  event.currentTarget.classList.add('hit');
  event.currentTarget.disabled = true;
  $('agilityProgress').textContent = `${agilityTarget} / ${AGILITY_TARGETS}`;
  $('agilityBest').textContent = `${Math.min(...agilityReactions).toFixed(0)}ms`;

  if (agilityTarget < AGILITY_TARGETS) {
    setTimeout(placeAgilityTarget, 120);
    return;
  }

  agilityRunning = false;
  clearInterval(agilityClock);
  const totalMs = performance.now() - agilityStartedAt;
  const averageMs = agilityReactions.reduce((a, b) => a + b, 0) / agilityReactions.length;
  event.currentTarget.remove();
  busy = true;
  $('agilityMessage').textContent = 'Dash complete — saving XP...';
  const { data, error } = await db.rpc('complete_agility_course', {
    p_total_ms: Math.round(totalMs),
    p_average_ms: Math.round(averageMs)
  });
  busy = false;

  if (error || !data?.[0]) {
    console.error(error);
    $('agilityMessage').textContent = 'Could not save Agility XP. Run the agility SQL update.';
    $('agilityStart').classList.remove('hidden');
    $('agilityStart').textContent = 'TRY AGAIN';
    return;
  }

  const result = data[0];
  const oldLevel = levelFromXp(character.agility_xp || 0);
  character.agility_xp = Number(result.new_xp);
  const newLevel = levelFromXp(character.agility_xp);
  renderCharacter();
  $('agilityTime').textContent = `${(totalMs / 1000).toFixed(2)}s`;
  const personalBest = result.is_personal_best ? ' — New personal best!' : '';
  $('agilityMessage').textContent = `Repo XP Rush complete! +${result.xp_gained} Agility XP${newLevel > oldLevel ? ` — Level ${newLevel}!` : ''}${personalBest}`;
  $('agilityStart').classList.remove('hidden');
  $('agilityStart').textContent = 'PLAY AGAIN';
  loadAgilityLeaderboard();
}

function resetJadSimulator(message = 'One wrong prayer ends the attempt.') {
  jadRunning = false;
  stopJadMusic(250);
  clearTimeout(jadAttackTimer);
  clearTimeout(jadResolveTimer);
  clearTimeout(jadHealerTimer);
  clearInterval(jadHealerPulseTimer);
  jadAttackTimer = null;
  jadResolveTimer = null;
  jadHealerTimer = null;
  jadHealerPulseTimer = null;
  jadBlocks = 0;
  jadPrayer = null;
  jadAttack = null;
  document.querySelectorAll('.jad-healer').forEach(el => el.remove());
  $('jadBoss').className = 'jad-boss';
  $('jadProjectile').className = 'jad-projectile';
  $('jadCue').textContent = 'Press START FIGHT';
  const config = SLAYER_DIFFICULTIES[selectedSlayerDifficulty];
  $('jadBlocks').textContent = `0 / ${config.hits}`;
  $('jadHealthText').textContent = '100%';
  $('jadHealthFill').style.width = '100%';
  $('jadArena').classList.remove('danger');
  $('jadStart').classList.remove('hidden');
  $('jadStart').textContent = 'START FIGHT';
  $('prayRanged').classList.remove('active');
  $('prayMagic').classList.remove('active');
  $('jadMessage').textContent = message;
}

function selectSlayerDifficulty(type) {
  if (!SLAYER_DIFFICULTIES[type] || jadRunning) return;
  selectedSlayerDifficulty = type;
  document.querySelectorAll('.slayer-difficulty-choice').forEach(button => {
    const active = button.dataset.slayerDifficulty === type;
    button.classList.toggle('selected', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  resetJadSimulator(`${SLAYER_DIFFICULTIES[type].label} selected. One wrong prayer still ends the attempt.`);
}

function openSlayer() {
  if (!character) return;
  resetJadSimulator();
  selectSlayerDifficulty(selectedSlayerDifficulty);
  $('slayerDialog').showModal();
}

function selectJadPrayer(prayer) {
  if (!jadRunning) return;
  jadPrayer = prayer;
  $('prayRanged').classList.toggle('active', prayer === 'ranged');
  $('prayMagic').classList.toggle('active', prayer === 'magic');
}

function startJadFight() {
  if (!character || jadRunning) return;
  const cfg = SLAYER_DIFFICULTIES[selectedSlayerDifficulty];
  resetJadSimulator(cfg.hiddenCue ? "No prayer hints. Watch Jad's animation and deal with healers." : 'Watch Jad carefully. Switch prayer before the hit lands.');
  jadRunning = true;
  startJadMusic();
  $('jadStart').classList.add('hidden');
  $('jadCue').textContent = 'Jad is preparing...';
  if (cfg.healers) scheduleJadHealer();
  jadAttackTimer = setTimeout(beginJadAttack, 900);
}

function beginJadAttack() {
  if (!jadRunning) return;
  jadAttack = Math.random() < 0.5 ? 'ranged' : 'magic';
  const boss = $('jadBoss');
  boss.className = `jad-boss attacking ${jadAttack}`;
  $('jadProjectile').className = `jad-projectile ${jadAttack}`;
  const cfg = SLAYER_DIFFICULTIES[selectedSlayerDifficulty];
  $('jadCue').textContent = cfg.hiddenCue ? '' : (jadAttack === 'ranged' ? 'STOMP — RANGED!' : 'JAD RISES — MAGIC!');
  const speed = Math.max((selectedSlayerDifficulty === 'hard' || selectedSlayerDifficulty === 'insane') ? 650 : 900, cfg.baseSpeed - jadBlocks * cfg.speedStep);
  jadResolveTimer = setTimeout(resolveJadAttack, speed);
}


function scheduleJadHealer() {
  if (!jadRunning || !SLAYER_DIFFICULTIES[selectedSlayerDifficulty].healers) return;
  clearTimeout(jadHealerTimer);
  jadHealerTimer = setTimeout(() => {
    spawnJadHealer();
    scheduleJadHealer();
  }, 1800 + Math.random() * 2600);
}

function spawnJadHealer() {
  if (!jadRunning || document.querySelectorAll('.jad-healer').length >= 5) return;
  const healer = document.createElement('button');
  healer.type = 'button';
  healer.className = 'jad-healer';
  healer.setAttribute('aria-label','Kill Jad healer');
  const angle = Math.random() * Math.PI * 2;
  const radiusX = 120 + Math.random() * 150;
  const radiusY = 65 + Math.random() * 75;
  healer.style.left = `calc(50% + ${Math.cos(angle) * radiusX}px)`;
  healer.style.top = `calc(53% + ${Math.sin(angle) * radiusY}px)`;
  healer.innerHTML = '<i></i><b>HEALER</b>';
  healer.addEventListener('click', () => {
    healer.classList.add('killed');
    setTimeout(() => healer.remove(), 180);
  }, { once:true });
  $('jadArena').appendChild(healer);
  if (!jadHealerPulseTimer) {
    jadHealerPulseTimer = setInterval(() => {
      if (!jadRunning) return clearInterval(jadHealerPulseTimer);
      const alive = document.querySelectorAll('.jad-healer:not(.killed)').length;
      if (alive && jadBlocks > 0) {
        jadBlocks = Math.max(0, jadBlocks - Math.min(alive, 2));
        const targetHits = SLAYER_DIFFICULTIES[selectedSlayerDifficulty].hits;
        const health = Math.max(0, 100 - (jadBlocks / targetHits) * 100);
        $('jadBlocks').textContent = `${jadBlocks} / ${targetHits}`;
        $('jadHealthText').textContent = `${Math.round(health)}%`;
        $('jadHealthFill').style.width = `${health}%`;
        $('jadMessage').textContent = `${alive} healer${alive === 1 ? '' : 's'} restored Jad. Click them!`;
      }
    }, 3200);
  }
}

async function resolveJadAttack() {
  if (!jadRunning) return;
  const correct = jadPrayer === jadAttack;
  $('jadProjectile').classList.add('land');
  if (!correct) {
    jadRunning = false;
    clearTimeout(jadHealerTimer); clearInterval(jadHealerPulseTimer);
    document.querySelectorAll('.jad-healer').forEach(el => el.remove());
    stopJadMusic(500);
    $('jadBoss').className = 'jad-boss victorious';
    $('jadCue').textContent = 'YOU WERE HIT!';
    $('jadMessage').textContent = `Wrong prayer. Jad used ${jadAttack.toUpperCase()}. No Slayer XP earned.`;
    $('jadStart').classList.remove('hidden');
    $('jadStart').textContent = 'TRY AGAIN';
    return;
  }

  jadBlocks += 1;
  const targetHits = SLAYER_DIFFICULTIES[selectedSlayerDifficulty].hits;
  const health = Math.max(0, 100 - (jadBlocks / targetHits) * 100);
  $('jadBlocks').textContent = `${jadBlocks} / ${targetHits}`;
  $('jadHealthText').textContent = `${Math.round(health)}%`;
  $('jadHealthFill').style.width = `${health}%`;
  $('jadArena').classList.toggle('danger', health > 0 && health <= 20);
  $('jadCue').textContent = 'BLOCKED!';
  $('jadBoss').className = 'jad-boss blocked';

  if (jadBlocks >= targetHits) {
    jadRunning = false;
    clearTimeout(jadHealerTimer); clearInterval(jadHealerPulseTimer);
    document.querySelectorAll('.jad-healer').forEach(el => el.remove());
    stopJadMusic(1000);
    $('jadBoss').className = 'jad-boss defeated';
    $('jadCue').textContent = 'JAD DEFEATED';
    $('jadMessage').textContent = 'Jad defeated — saving Slayer XP...';
    busy = true;
    const { data, error } = await db.rpc('complete_jad_simulator', { p_hits: targetHits, p_difficulty: selectedSlayerDifficulty });
    busy = false;
    if (error || !data?.[0]) {
      console.error(error);
      $('jadMessage').textContent = 'Could not save Slayer XP. Run update-jad-simulator.sql in Supabase.';
    } else {
      const result = data[0];
      const oldLevel = levelFromXp(character.slayer_xp || 0);
      character.slayer_xp = Number(result.new_xp);
      const newLevel = levelFromXp(character.slayer_xp);
      renderCharacter();
      if(result.achievements)achievementState=result.achievements;
      if(result.achievement_unlocked){toast('Achievement complete: Insane Jad — Fire cape added to your Bank!',5000);renderAchievements();}
      $('jadMessage').textContent = `Jad defeated! +${result.xp_gained} Slayer XP${newLevel > oldLevel ? ` — Level ${newLevel}!` : ''}${result.achievement_unlocked?' — Fire cape unlocked!':''}`;
    }
    $('jadStart').classList.remove('hidden');
    $('jadStart').textContent = 'FIGHT AGAIN';
    return;
  }

  jadAttackTimer = setTimeout(() => {
    $('jadBoss').className = 'jad-boss';
    $('jadProjectile').className = 'jad-projectile';
    $('jadCue').textContent = 'Next attack...';
    beginJadAttack();
  }, 520);
}


const COMBAT_WEAPONS = {
  sword: { name: 'Rune Sword', style: 'melee', icon: '⚔️', description: 'Reliable close-range cleaves', damage: 22, range: 105, attackRate: 0.58, colour: '#fff2a0' },
  dharok: { name: "Dharok's Greataxe", style: 'melee', icon: '🪓', description: 'Slow, crushing hits that become stronger as your health falls', damage: 25, range: 112, attackRate: 0.92, colour: '#b9b2a5' },
  bow: { name: 'Maple Bow', style: 'ranged', icon: '🏹', description: 'Quick, dependable long-range arrows', damage: 13, range: 225, attackRate: 0.34, colour: '#d6b16f' },
  blowpipe: { name: 'Toxic Blowpipe', style: 'ranged', icon: '🐍', description: 'Extremely fast darts that build venom damage', damage: 7, range: 205, attackRate: 0.22, colour: '#43d68b' },
  staff: { name: 'Air Staff', style: 'magic', icon: '🪄', description: 'Slower magic that chains between nearby enemies', damage: 17, range: 170, attackRate: 0.72, colour: '#83d9ff' },
  shadow: { name: "Tumeken's Shadow", style: 'magic', icon: '🔱', description: 'Fast, powerful single-target magic with a small blast', damage: 19, range: 220, attackRate: 0.46, colour: '#ad75ff' }
};

function combatWeaponStyle(type) {
  return COMBAT_WEAPONS[type]?.style || 'melee';
}

function combatXpLabel(type) {
  const style = combatWeaponStyle(type);
  return style === 'magic' ? 'Magic' : style === 'ranged' ? 'Ranged' : 'Attack, Strength and Defence';
}

const COMBAT_DIFFICULTIES = {
  easy:   { name: 'Easy', duration: 60,  spawn: .78, hp: .78, speed: .82, damage: .68, reward: .75, startHp: 110, description: 'Survive 1 minute' },
  medium: { name: 'Medium', duration: 120, spawn: 1,   hp: 1,   speed: 1,   damage: 1,   reward: 1.10, startHp: 115, description: 'Survive 2 minutes' },
  hard:   { name: 'Hard', duration: 180, spawn: 1.18,hp: 1.16,speed: 1.10,damage: 1.18,reward: 1.55, startHp: 125, description: 'Survive 3 minutes' },
  insane: { name: 'INSANE', duration: 240, spawn: 1.52,hp: 1.42,speed: 1.25,damage: 1.48,reward: 2.35, startHp: 140, description: 'Survive 4 brutal minutes' }
};

function selectCombatWeapon(type) {
  if (!COMBAT_WEAPONS[type] || combatRunning) return;
  selectedCombatWeapon = type;
  document.querySelectorAll('.combat-weapon-choice').forEach(button => {
    button.classList.toggle('selected', button.dataset.weapon === type);
    button.setAttribute('aria-pressed', button.dataset.weapon === type ? 'true' : 'false');
  });
  const cfg = COMBAT_DIFFICULTIES[selectedCombatDifficulty];
  $('combatMessage').textContent = `${COMBAT_WEAPONS[type].name} selected. Earns ${combatXpLabel(type)} XP.`;
}

function selectCombatDifficulty(type) {
  if (!COMBAT_DIFFICULTIES[type] || combatRunning) return;
  selectedCombatDifficulty = type;
  document.querySelectorAll('.combat-difficulty-choice').forEach(button => {
    const active = button.dataset.difficulty === type;
    button.classList.toggle('selected', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  const cfg = COMBAT_DIFFICULTIES[type];
  $('combatTime').textContent = selectedCombatLocation === 'inferno' ? '∞' : cfg.duration;
  $('combatMessage').textContent = `${cfg.name} selected — ${cfg.description}. Choose a weapon and start the run.`;
}

function selectCombatLocation(type) {
  if (!['lumbridge','fight-caves','gauntlet','inferno'].includes(type) || combatRunning) return;
  selectedCombatLocation = type;
  document.querySelectorAll('.combat-location-choice').forEach(button => {
    const active = button.dataset.location === type;
    button.classList.toggle('selected', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  const names = {lumbridge:'Lumbridge', 'fight-caves':'Fight Caves', gauntlet:'Corrupted Gauntlet', inferno:'Inferno'};
  $('combatTime').textContent = type === 'inferno' ? '∞' : COMBAT_DIFFICULTIES[selectedCombatDifficulty].duration;
  $('combatMessage').textContent = type === 'inferno' ? 'Inferno selected — no time limit. Defeat every wave and the final boss.' : `${names[type]} selected. Choose a weapon and difficulty.`;
}

function openCombat() {
  if (!character) return;
  resetCombatGame();
  $('combatDialog').showModal();
}

function resetCombatGame(message = 'Choose a tier: Easy 1 minute, Medium 2 minutes, Hard 3 minutes, or INSANE 4 minutes.') {
  stopCombatMusic(250);
  combatRunning = false;
  combatPaused = false;
  cancelAnimationFrame(combatFrame);
  combatFrame = null;
  combatKeys.clear();
  $('combatIntro').classList.remove('hidden');
  $('combatUpgrade').classList.add('hidden');
  $('combatStart').textContent = 'START RUN';
  $('combatTime').textContent = selectedCombatLocation === 'inferno' ? '∞' : COMBAT_DIFFICULTIES[selectedCombatDifficulty].duration;
  $('combatHealth').textContent = '100 / 100';
  $('combatKills').textContent = '0';
  $('combatLevel').textContent = '1';
  $('combatXpFill').style.width = '0%';
  $('combatMessage').textContent = message;
  selectCombatWeapon(selectedCombatWeapon);
  selectCombatDifficulty(selectedCombatDifficulty);
  selectCombatLocation(selectedCombatLocation);
  const canvas = $('combatCanvas');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawCombatBackdrop(ctx, canvas.width, canvas.height);
}

function startCombatGame() {
  startCombatMusic();
  const canvas = $('combatCanvas');
  const weapon = COMBAT_WEAPONS[selectedCombatWeapon];
  const difficulty = COMBAT_DIFFICULTIES[selectedCombatDifficulty];
  combatState = {
    weapon: selectedCombatWeapon,
    difficulty: selectedCombatDifficulty,
    location: selectedCombatLocation,
    player: { x: canvas.width / 2, y: canvas.height / 2, r: 15, hp: difficulty.startHp, maxHp: difficulty.startHp, speed: 185, damage: weapon.damage, range: weapon.range, attackRate: weapon.attackRate, lastAttack: 0, armour: 0 },
    enemies: [], projectiles: [], slashes: [], chains: [], orbs: [], particles: [],
    kills: 0, damage: 0, runXp: 0, runLevel: 1, nextLevel: 8,
    spawnClock: 0, elapsed: 0, ended: false,
    inferno: selectedCombatLocation === 'inferno' ? { wallClock:2.4, walls:[], boss:null, wave:1, maxWaves:{easy:3,medium:4,hard:5,insane:6}[selectedCombatDifficulty], waveSpawnClock:0, waveToSpawn:0, transition:0, eruptions:[], bossAttackClock:2.8, banner:'WAVE 1' } : null
  };
  combatState.difficultyConfig = difficulty;
  if (combatState.inferno) {
    beginInfernoWave(combatState, 1);
  }
  combatRunning = true;
  combatPaused = false;
  combatStartedAt = performance.now();
  combatLast = combatStartedAt;
  $('combatIntro').classList.add('hidden');
  $('combatUpgrade').classList.add('hidden');
  const locationName={lumbridge:'Lumbridge','fight-caves':'Fight Caves',gauntlet:'Corrupted Gauntlet',inferno:'Inferno'}[selectedCombatLocation];
  $('combatMessage').textContent = selectedCombatLocation==='inferno' ? `${weapon.name} equipped — defeat the Inferno boss and pass through the fire-wall gaps!` : `${weapon.name} equipped in ${locationName} — move, survive and auto-attack!`;
  combatFrame = requestAnimationFrame(combatLoop);
}

function combatLoop(now) {
  if (!combatRunning) return;
  const dt = Math.min(0.035, (now - combatLast) / 1000 || 0);
  combatLast = now;
  if (!combatPaused) updateCombat(dt, now);
  drawCombat();
  if (combatRunning) combatFrame = requestAnimationFrame(combatLoop);
}

function updateCombat(dt, now) {
  const s = combatState;
  const p = s.player;
  s.elapsed = (now - combatStartedAt) / 1000;
  const isInferno = s.location === 'inferno';
  const remaining = isInferno ? Infinity : Math.max(0, s.difficultyConfig.duration - s.elapsed);
  if (!isInferno && remaining <= 0) return finishCombat(true);

  let dx = 0, dy = 0;
  if (combatKeys.has('ArrowLeft') || combatKeys.has('a')) dx--;
  if (combatKeys.has('ArrowRight') || combatKeys.has('d')) dx++;
  if (combatKeys.has('ArrowUp') || combatKeys.has('w')) dy--;
  if (combatKeys.has('ArrowDown') || combatKeys.has('s')) dy++;
  if (dx || dy) {
    const len = Math.hypot(dx, dy); p.x += dx / len * p.speed * dt; p.y += dy / len * p.speed * dt;
    p.x = Math.max(20, Math.min(740, p.x)); p.y = Math.max(24, Math.min(406, p.y));
  }

  if (s.location === 'inferno') updateInferno(s, p, dt);
  else {
    s.spawnClock -= dt;
    if (s.spawnClock <= 0) {
      spawnCombatEnemy();
      s.spawnClock = Math.max(s.difficulty === 'insane' ? 0.14 : 0.20, (0.78 - Math.min(s.elapsed, 150) * 0.0032) / s.difficultyConfig.spawn);
    }
  }

  let nearest = null, nearestD = Infinity;
  for (const e of s.enemies) {
    const ex = p.x - e.x, ey = p.y - e.y, d = Math.hypot(ex, ey) || 1;
    if(e.type!=='inferno-boss'){e.x += ex / d * e.speed * dt; e.y += ey / d * e.speed * dt;}
    if (d < nearestD) { nearestD = d; nearest = e; }
    e.hitCooldown -= dt;
    if (e.type!=='inferno-boss' && d < p.r + e.r + 2 && e.hitCooldown <= 0) {
      p.hp -= Math.max(1, e.damage - p.armour); e.hitCooldown = 0.75;
      s.particles.push({x:p.x,y:p.y,text:`-${Math.max(1,e.damage-p.armour)}`,life:.7});
      if (p.hp <= 0) return finishCombat(false);
    }
  }

  if (nearest && nearestD <= p.range && now - p.lastAttack >= p.attackRate * 1000) {
    p.lastAttack = now;
    if (s.weapon === 'sword') {
      const targets = s.enemies.filter(e => Math.hypot(e.x - nearest.x, e.y - nearest.y) < 46).slice(0, 3);
      targets.forEach((target, index) => damageCombatEnemy(target, p.damage * (index ? 0.7 : 1)));
      s.slashes.push({x:nearest.x,y:nearest.y,life:.18,kind:'sword'});
    } else if (s.weapon === 'dharok') {
      // Dharok's set effect: missing health dramatically increases the axe hit.
      const missingHealth = Math.max(0, 1 - p.hp / p.maxHp);
      const multiplier = 1 + missingHealth * 1.75;
      damageCombatEnemy(nearest, p.damage * multiplier);
      s.slashes.push({x:nearest.x,y:nearest.y,life:.25,kind:'dharok'});
      if (missingHealth >= .55) s.particles.push({x:p.x,y:p.y-24,text:`DHAROK x${multiplier.toFixed(1)}`,life:.55});
    } else if (s.weapon === 'bow') {
      damageCombatEnemy(nearest, p.damage);
      s.projectiles.push({x1:p.x,y1:p.y,x2:nearest.x,y2:nearest.y,life:.16,kind:'arrow'});
    } else if (s.weapon === 'blowpipe') {
      damageCombatEnemy(nearest, p.damage);
      nearest.venom = Math.min(10, (nearest.venom || 0) + 1);
      nearest.venomClock = Math.min(nearest.venomClock ?? .65, .65);
      s.projectiles.push({x1:p.x,y1:p.y,x2:nearest.x,y2:nearest.y,life:.10,kind:'dart'});
    } else if (s.weapon === 'shadow') {
      damageCombatEnemy(nearest, p.damage);
      const splash = s.enemies.filter(e => e !== nearest && Math.hypot(e.x-nearest.x,e.y-nearest.y)<52).slice(0,2);
      splash.forEach(target => damageCombatEnemy(target, p.damage * .28));
      s.chains.push({x1:p.x,y1:p.y,x2:nearest.x,y2:nearest.y,life:.16,kind:'shadow'});
      s.slashes.push({x:nearest.x,y:nearest.y,life:.16,kind:'shadow'});
    } else {
      const chainTargets = [nearest, ...s.enemies.filter(e => e !== nearest).sort((a,b) => Math.hypot(a.x-nearest.x,a.y-nearest.y)-Math.hypot(b.x-nearest.x,b.y-nearest.y)).filter(e => Math.hypot(e.x-nearest.x,e.y-nearest.y)<105).slice(0,2)];
      let from = {x:p.x,y:p.y};
      chainTargets.forEach((target,index) => {
        damageCombatEnemy(target, p.damage * (1-index*0.22));
        s.chains.push({x1:from.x,y1:from.y,x2:target.x,y2:target.y,life:.22,kind:'air'});
        from = target;
      });
    }
  }

  // Toxic blowpipe venom: repeated hits build a capped damage-over-time effect.
  for (const e of [...s.enemies]) {
    if (!e.venom) continue;
    e.venomClock = (e.venomClock ?? .65) - dt;
    if (e.venomClock <= 0) {
      e.venomClock = 1.05;
      const venomDamage = Math.max(1, Math.ceil(e.venom * .55));
      damageCombatEnemy(e, venomDamage);
      if (s.enemies.includes(e)) s.particles.push({x:e.x,y:e.y-12,text:`${venomDamage} venom`,life:.45});
    }
  }

  for (const orb of s.orbs) {
    const d = Math.hypot(p.x-orb.x,p.y-orb.y);
    if (d < 90) { orb.x += (p.x-orb.x) * dt * 5; orb.y += (p.y-orb.y) * dt * 5; }
    if (d < p.r + 8) { orb.taken = true; if (orb.heal) { p.hp = Math.min(p.maxHp, p.hp + orb.heal); s.particles.push({x:p.x,y:p.y,text:`+${orb.heal} HP`,life:.7}); } else s.runXp += orb.value; }
  }
  s.orbs = s.orbs.filter(o => !o.taken);
  s.slashes.forEach(x=>x.life-=dt); s.slashes=s.slashes.filter(x=>x.life>0);
  s.projectiles.forEach(x=>x.life-=dt); s.projectiles=s.projectiles.filter(x=>x.life>0);
  s.chains.forEach(x=>x.life-=dt); s.chains=s.chains.filter(x=>x.life>0);
  s.particles.forEach(x=>{x.life-=dt;x.y-=25*dt}); s.particles=s.particles.filter(x=>x.life>0);

  if (s.runXp >= s.nextLevel) {
    s.runXp -= s.nextLevel; s.runLevel++; s.nextLevel = Math.floor(s.nextLevel * 1.32 + 3); showCombatUpgrade();
  }
  $('combatTime').textContent = isInferno ? '∞' : Math.ceil(remaining);
  $('combatHealth').textContent = `${Math.max(0, Math.ceil(p.hp))} / ${p.maxHp}`;
  $('combatKills').textContent = s.location==='inferno' ? (s.inferno.boss ? `${Math.max(0,Math.ceil(s.inferno.boss.hp))} boss HP` : `Wave ${Math.min(s.inferno.wave,s.inferno.maxWaves)}/${s.inferno.maxWaves}`) : s.kills;
  $('combatLevel').textContent = s.runLevel;
  $('combatXpFill').style.width = `${Math.min(100, s.runXp / s.nextLevel * 100)}%`;
}

function beginInfernoWave(s, wave){
  const inf=s.inferno;
  inf.wave=wave;
  inf.transition=0;
  inf.waveSpawnClock=.25;
  inf.waveToSpawn=Math.max(3, 2 + wave + ({easy:0,medium:1,hard:2,insane:3}[s.difficulty]||0));
  inf.banner=`WAVE ${wave}`;
  $('combatMessage').textContent=`Inferno wave ${wave}/${inf.maxWaves} — survive the assault!`;
}

function spawnInfernoEnemy(s){
  const inf=s.inferno;
  const edge=Math.floor(Math.random()*4); let x,y;
  if(edge===0){x=40+Math.random()*680;y=-25}else if(edge===1){x=785;y=35+Math.random()*360}else if(edge===2){x=40+Math.random()*680;y=455}else{x=-25;y=35+Math.random()*360}
  const wave=inf.wave, roll=Math.random();
  let type,base;
  if(wave>=4 && roll>.78){type='inferno-mage';base=[105,62,20,19,5]}
  else if(wave>=3 && roll>.55){type='inferno-ranger';base=[72,82,16,16,4]}
  else if(roll>.48){type='inferno-brute';base=[90,58,18,20,4]}
  else {type='inferno-bat';base=[44,112,12,13,2]}
  const scale=(1+(wave-1)*.14)*s.difficultyConfig.hp;
  s.enemies.push({type,x,y,hp:base[0]*scale,maxHp:base[0]*scale,speed:base[1]*(1+(wave-1)*.04)*s.difficultyConfig.speed,damage:base[2]*s.difficultyConfig.damage,r:base[3],xp:base[4],hitCooldown:0});
}

function spawnInfernoBoss(s){
  const inf=s.inferno;
  const bossHp={easy:1250,medium:2600,hard:4700,insane:8800}[s.difficulty];
  inf.boss={type:'inferno-boss',x:620,y:215,hp:bossHp,maxHp:bossHp,speed:0,damage:0,r:46,xp:24,hitCooldown:0};
  s.enemies.push(inf.boss);
  inf.banner='ZUK AWAKENS';
  inf.bossAttackClock=2.2;
  $('combatMessage').textContent='FINAL WAVE — defeat the Inferno boss!';
}

function updateInferno(s,p,dt){
  const inf=s.inferno;if(!inf)return;
  inf.wallClock-=dt;
  if(inf.wallClock<=0){
    const gapH={easy:160,medium:126,hard:102,insane:84}[s.difficulty];
    const gapY=78+Math.random()*274;
    const speed={easy:150,medium:188,hard:225,insane:258}[s.difficulty];
    inf.walls.push({x:790,gapY,gapH,speed,hit:false});
    inf.wallClock={easy:5.0,medium:4.0,hard:3.25,insane:2.65}[s.difficulty];
    $('combatMessage').textContent='FIRE WALL — get through the opening!';
  }
  for(const w of inf.walls){
    w.x-=w.speed*dt;
    if(!w.hit&&Math.abs(w.x-p.x)<18){
      w.hit=true;
      if(Math.abs(p.y-w.gapY)>w.gapH/2-p.r){
        const hit={easy:17,medium:27,hard:39,insane:52}[s.difficulty];
        const dealt=Math.max(1,hit-p.armour);p.hp-=dealt;s.particles.push({x:p.x,y:p.y,text:`-${dealt}`,life:.8});
        $('combatMessage').textContent='The fire wall scorched you!';
        if(p.hp<=0)return finishCombat(false);
      }else{s.runXp+=3;s.particles.push({x:p.x,y:p.y,text:'PERFECT DODGE',life:.7});}
    }
  }
  inf.walls=inf.walls.filter(w=>w.x>-35);

  if(!inf.boss){
    if(inf.waveToSpawn>0){
      inf.waveSpawnClock-=dt;
      if(inf.waveSpawnClock<=0){spawnInfernoEnemy(s);inf.waveToSpawn--;inf.waveSpawnClock=Math.max(.28,.72-inf.wave*.055);}
    }else if(s.enemies.length===0){
      inf.transition+=dt;
      if(inf.transition>1.4){
        if(inf.wave<inf.maxWaves)beginInfernoWave(s,inf.wave+1); else spawnInfernoBoss(s);
      }
    }
  }else{
    inf.bossAttackClock-=dt;
    if(inf.bossAttackClock<=0){
      const count=s.difficulty==='insane'?3:(s.difficulty==='hard'?2:1);
      for(let i=0;i<count;i++){
        const tx=Math.max(40,Math.min(720,p.x+(Math.random()-.5)*180));
        const ty=Math.max(40,Math.min(390,p.y+(Math.random()-.5)*150));
        inf.eruptions.push({x:tx,y:ty,t:1.05,r:38,hit:false});
      }
      inf.bossAttackClock={easy:3.4,medium:2.9,hard:2.45,insane:2.0}[s.difficulty];
      $('combatMessage').textContent='VOLCANIC ERUPTION — keep moving!';
    }
  }
  for(const e of inf.eruptions){
    e.t-=dt;
    if(!e.hit&&e.t<=0){
      e.hit=true;
      if(Math.hypot(p.x-e.x,p.y-e.y)<e.r+p.r){
        const hit={easy:18,medium:27,hard:38,insane:48}[s.difficulty];
        const dealt=Math.max(1,hit-p.armour);p.hp-=dealt;s.particles.push({x:p.x,y:p.y,text:`-${dealt}`,life:.8});
        if(p.hp<=0)return finishCombat(false);
      }
    }
  }
  inf.eruptions=inf.eruptions.filter(e=>e.t>-.35);
}
function spawnCombatEnemy() {
  const s = combatState;
  const edge = Math.floor(Math.random()*4); let x,y;
  if(edge===0){x=Math.random()*760;y=-20}else if(edge===1){x=780;y=Math.random()*430}else if(edge===2){x=Math.random()*760;y=450}else{x=-20;y=Math.random()*430}
  const roll=Math.random();
  const tables={
    lumbridge:[['goblin',.50,[26,68,9,13,1]],['cow',.80,[48,42,12,18,2]],['skeleton',1,[34,88,14,14,2]]],
    'fight-caves':[['tz-kih',.48,[30,92,10,13,1]],['tz-kek',.80,[58,52,15,18,2]],['tok-xil',1,[42,78,17,15,3]]],
    gauntlet:[['corrupted-rat',.38,[34,100,11,12,1]],['corrupted-unicorn',.70,[62,66,16,18,3]],['corrupted-dragon',.94,[82,58,20,20,4]],['hunllef',1,[190,44,27,27,8]]]
  };
  const table=tables[s.location]||tables.lumbridge;
  const picked=table.find(row=>roll<row[1])||table[table.length-1];
  const type=picked[0],stats=picked[2];
  const timeScale=1+Math.min(s.elapsed,180)/180;
  const hpScale=timeScale*s.difficultyConfig.hp;
  s.enemies.push({type,x,y,hp:stats[0]*hpScale,maxHp:stats[0]*hpScale,speed:stats[1]*timeScale*s.difficultyConfig.speed,damage:stats[2]*s.difficultyConfig.damage,r:stats[3],xp:stats[4],hitCooldown:0});
}

function damageCombatEnemy(enemy, amount) {
  const s = combatState;
  if (!enemy || !s.enemies.includes(enemy)) return;
  const dealt = Math.max(1, Math.round(amount));
  enemy.hp -= dealt;
  s.damage += dealt;
  if (enemy.hp <= 0) killCombatEnemy(enemy);
}

function killCombatEnemy(enemy) {
  const s=combatState; s.kills++;
  s.enemies.splice(s.enemies.indexOf(enemy),1);
  if(enemy.type==='inferno-boss'){
    s.damage += 250;
    s.particles.push({x:enemy.x,y:enemy.y,text:'BOSS DEFEATED',life:1.2});
    return finishCombat(true);
  }
  s.orbs.push({x:enemy.x,y:enemy.y,value:enemy.xp,taken:false});
  const foodChance = s.difficulty === 'insane' ? 0.075 : (s.difficulty === 'hard' ? 0.095 : 0.12);
  if (Math.random() < foodChance) s.orbs.push({x:enemy.x+10,y:enemy.y-8,value:0,heal:s.difficulty==='insane'?12:16,taken:false});
  s.particles.push({x:enemy.x,y:enemy.y,text:'+XP',life:.8});
}

function showCombatUpgrade() {
  combatPaused=true;
  const upgrades=[
    ['Sharper sword','+7 damage',()=>combatState.player.damage+=7],
    ['Quick strikes','15% faster attacks',()=>combatState.player.attackRate=Math.max(.18,combatState.player.attackRate*.85)],
    ['Longer reach','+22 attack range',()=>combatState.player.range+=22],
    ['Running boots','+28 movement speed',()=>combatState.player.speed+=28],
    ['Rune armour','-2 contact damage',()=>combatState.player.armour+=2],
    ['Constitution','+20 max health and heal',()=>{combatState.player.maxHp+=20;combatState.player.hp=Math.min(combatState.player.maxHp,combatState.player.hp+30)}],
    ['Emergency kebab','Heal 45 health',()=>combatState.player.hp=Math.min(combatState.player.maxHp,combatState.player.hp+45)]
  ].sort(()=>Math.random()-.5).slice(0,3);
  $('combatUpgradeChoices').innerHTML='';
  upgrades.forEach(([name,desc,apply])=>{const b=document.createElement('button');b.type='button';b.innerHTML=`<b>${name}</b><small>${desc}</small>`;b.onclick=()=>{apply();combatPaused=false;$('combatUpgrade').classList.add('hidden')};$('combatUpgradeChoices').appendChild(b)});
  $('combatUpgrade').classList.remove('hidden');
}

async function finishCombat(survived) {
  if (!combatRunning) return;
  stopCombatMusic(survived ? 900 : 450);
  combatRunning=false; cancelAnimationFrame(combatFrame);
  const s=combatState;
  $('combatUpgrade').classList.add('hidden');
  $('combatIntro').classList.remove('hidden');
  $('combatStart').textContent='PLAY AGAIN';
  $('combatMessage').textContent = survived ? `${Math.round(s.difficultyConfig.duration/60)} minute tier survived! Saving combat XP…` : 'You were overwhelmed. Saving partial XP…';
  const secondsForXp = s.location === 'inferno' ? Math.floor(s.elapsed) : Math.min(s.difficultyConfig.duration,Math.floor(s.elapsed));
  const {data,error}=await db.rpc('complete_combat_run',{p_survived:survived,p_kills:s.kills,p_damage:Math.floor(s.damage),p_seconds:secondsForXp,p_difficulty:s.difficulty,p_weapon:s.weapon,p_location:s.location});
  if(error){console.error(error);$('combatMessage').textContent='Could not save combat XP. Run add-magic-ranged-combat-xp.sql in Supabase.';return}
  const r=data?.[0]; if(!r)return;
  ['attack','strength','defence','magic','ranged'].forEach(skill=>{character[`${skill}_xp`]=Number(r[`${skill}_xp`]||0)});
  if(r.achievements)achievementState=r.achievements;
  if(r.bank_items&&bankState)bankState.items=r.bank_items;
  renderAchievements();
  renderCharacter();
  const gains=[['Attack',r.attack_gained],['Strength',r.strength_gained],['Defence',r.defence_gained],['Magic',r.magic_gained],['Ranged',r.ranged_gained]].filter(([,gain])=>Number(gain)>0).map(([name,gain])=>`+${gain} ${name}`).join(', ');
  $('combatMessage').textContent=`${survived?'Victory!':'Run ended.'} ${gains} XP.`;
  toast(`${combatWeaponStyle(s.weapon)==='magic'?'Magic':combatWeaponStyle(s.weapon)==='ranged'?'Ranged':'Melee'} XP saved!`,3500);
}

function drawCombatBackdrop(ctx,w,h){
  const location=combatState?.location||selectedCombatLocation;
  const palette={lumbridge:['#152416','#183019','#1c351d','#65513a'],'fight-caves':['#28120d','#38160f','#451d11','#8a4b25'],gauntlet:['#24082c','#32103d','#42114d','#b83378'],inferno:['#180705','#2b0b06','#441007','#f05b20']}[location];
  ctx.fillStyle=palette[0];ctx.fillRect(0,0,w,h);
  for(let x=0;x<w;x+=40)for(let y=0;y<h;y+=40){ctx.fillStyle=((x+y)/40)%2?palette[1]:palette[2];ctx.fillRect(x,y,40,40)}
  if(location==='fight-caves'){ctx.fillStyle='#f07b2b55';for(let x=30;x<w;x+=125){ctx.beginPath();ctx.arc(x,h-18,22,0,Math.PI*2);ctx.fill()}}
  if(location==='gauntlet'){ctx.strokeStyle='#f05ab955';ctx.lineWidth=2;for(let x=20;x<w;x+=70){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+30,h);ctx.stroke()}}
  if(location==='inferno'){
    const t=(performance.now()/1000)||0;
    ctx.fillStyle='#090302aa';ctx.fillRect(0,0,w,h);
    ctx.strokeStyle='#ff5a1f55';ctx.lineWidth=3;
    for(let x=-40;x<w+80;x+=82){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+35,h);ctx.stroke()}
    for(let i=0;i<18;i++){const x=(i*97+t*24)%w,y=h-18-(i%3)*9;ctx.fillStyle=i%2?'#ff7b20aa':'#ffcf3faa';ctx.beginPath();ctx.arc(x,y,3+(i%4),0,7);ctx.fill()}
    ctx.fillStyle='#33110c';ctx.fillRect(92,66,24,300);ctx.fillRect(w-116,66,24,300);
    ctx.fillStyle='#6c2414';for(let y=82;y<360;y+=34){ctx.fillRect(86,y,36,8);ctx.fillRect(w-122,y,36,8)}
  }
  ctx.fillStyle=palette[3];ctx.fillRect(0,0,w,12);ctx.fillRect(0,h-12,w,12);ctx.fillRect(0,0,12,h);ctx.fillRect(w-12,0,12,h);
}

const sailingMusic = new Audio('assets/sailing-theme.mp3');
sailingMusic.loop = true;
sailingMusic.preload = 'auto';
sailingMusic.volume = 0;
let sailingMusicFade = null;

function fadeSailingMusic(target, duration=500, resetAfter=false){
  clearInterval(sailingMusicFade);
  const start=sailingMusic.volume, steps=Math.max(1,Math.round(duration/30)); let n=0;
  sailingMusicFade=setInterval(()=>{n++;sailingMusic.volume=start+(target-start)*(n/steps);if(n>=steps){clearInterval(sailingMusicFade);sailingMusic.volume=target;if(resetAfter){sailingMusic.pause();sailingMusic.currentTime=0;}}},30);
}
function playSailingMusic(){
  clearInterval(sailingMusicFade); sailingMusic.currentTime=0; sailingMusic.volume=0;
  sailingMusic.play().then(()=>fadeSailingMusic(.72,650)).catch(()=>{});
}
function stopSailingMusic(immediate=false){
  if(immediate){clearInterval(sailingMusicFade);sailingMusic.pause();sailingMusic.currentTime=0;sailingMusic.volume=0;}
  else fadeSailingMusic(0,550,true);
}

function getSailingCourses(){
  return [
    {id:'easy',name:'Deckhand Bay',unlock:1,duration:42,speed:235,maxSpeed:320,gravity:1220,jump:535,lives:4,xpBase:40,xpCap:85,label:'EASY'},
    {id:'normal',name:'Corsair Crossing',unlock:1,duration:48,speed:270,maxSpeed:390,gravity:1320,jump:565,lives:3,xpBase:68,xpCap:145,label:'NORMAL'},
    {id:'hard',name:'Stormwall Run',unlock:1,duration:54,speed:305,maxSpeed:470,gravity:1400,jump:590,lives:3,xpBase:110,xpCap:230,label:'HARD'},
    {id:'expert',name:'Leviathan Strait',unlock:1,duration:60,speed:340,maxSpeed:535,gravity:1480,jump:615,lives:2,xpBase:175,xpCap:350,label:'EXPERT'},
    {id:'insane',name:'The Maelstrom',unlock:1,duration:66,speed:375,maxSpeed:610,gravity:1570,jump:645,lives:2,xpBase:270,xpCap:540,label:'INSANE'}
  ];
}
function sailingSkillLevel(){return levelFromXp(Number(character?.sailing_xp)||0)}
function selectedSailingCourse(){
  const id=$('sailingCourse')?.value||'easy';
  return getSailingCourses().find(c=>c.id===id)||getSailingCourses()[0];
}
function renderSailingCourses(){
  const select=$('sailingCourse'); if(!select)return;
  const previous=select.value;
  select.innerHTML=getSailingCourses().map(c=>`<option value="${c.id}">${c.label} — ${c.name}</option>`).join('');
  select.value=getSailingCourses().some(c=>c.id===previous)?previous:'easy';
  updateSailingCourseInfo();
}
function updateSailingCourseInfo(){
  const c=selectedSailingCourse(), info=$('sailingCourseInfo');
  if(info)info.textContent=`${c.duration}s course • ${c.lives} hull • up to roughly ${c.xpCap} XP • checkpoints at 25%, 50% and 75%`;
}
function openSailingGame(){
  if(!character) return toast('Create or log in to a character first.');
  renderSailingCourses();
  resetSailingGame('Choose a voyage. Every course is possible, but the final routes demand clean timing.');
  $('sailingDialog').showModal();
}
function resetSailingGame(message='Ready for another voyage.'){
  sailingRunning=false; cancelAnimationFrame(sailingFrame); sailingFrame=null; sailingKeys.clear(); stopSailingMusic(true);
  $('sailingDialog').classList.remove('danger','shake');
  $('sailingIntro').classList.remove('hidden'); $('sailingStart').textContent='SET SAIL';
  const course=selectedSailingCourse();
  $('sailingTime').textContent=course.duration; $('sailingHull').textContent=course.lives; $('sailingScore').textContent='0'; $('sailingCombo').textContent='x1'; $('sailingMessage').textContent=message;
  const c=$('sailingCanvas'); sailingState=null; drawSailingBackdrop(c.getContext('2d'),c.width,c.height,0);
}
function startSailingGame(){
  const c=$('sailingCanvas'),course=selectedSailingCourse();
  sailingState={course,boat:{x:150,y:338,vy:0,grounded:true,rotation:0,jumps:0},objects:[],particles:[],score:0,combo:1,gates:0,elapsed:0,distance:0,speed:course.speed,spawnDistance:520,held:false,lives:course.lives,invulnerable:0,checkpoint:0,crashes:0};
  sailingRunning=true;sailingStartedAt=performance.now();sailingLast=sailingStartedAt;
  $('sailingIntro').classList.add('hidden');$('sailingMessage').textContent='Jump, double-jump and collect rings. Crashes return you to the last checkpoint.';playSailingMusic();
  sailingFrame=requestAnimationFrame(sailingLoop);
}
function sailingJump(){
  if(!sailingRunning||!sailingState)return;
  const s=sailingState,b=s.boat;
  if(b.grounded||b.jumps<2){b.vy=-s.course.jump*(b.grounded?1:.88);b.grounded=false;b.jumps++;s.held=true;burstWake(b.x-18,b.y+14,b.jumps===1?9:14);}
}
function sailingRelease(){if(sailingState)sailingState.held=false;}
function burstWake(x,y,count){const s=sailingState;if(!s)return;for(let i=0;i<count;i++)s.particles.push({x,y,vx:-70-Math.random()*120,vy:-30+Math.random()*75,life:.35+Math.random()*.3,size:2+Math.random()*4});}
function sailingLoop(now){if(!sailingRunning)return;const dt=Math.min(.033,(now-sailingLast)/1000||0);sailingLast=now;updateSailing(dt,now);drawSailing();if(sailingRunning)sailingFrame=requestAnimationFrame(sailingLoop)}
function updateSailing(dt,now){
 const s=sailingState,b=s.boat,c=$('sailingCanvas'),course=s.course;s.elapsed=(now-sailingStartedAt)/1000;
 const progress=Math.min(1,s.elapsed/course.duration), tier=getSailingDifficultyTier(progress,course.id);
 s.speed=Math.min(course.maxSpeed,course.speed+(course.maxSpeed-course.speed)*progress);s.distance+=s.speed*dt;s.invulnerable=Math.max(0,s.invulnerable-dt);
 if(s.held&&b.vy<0)b.vy-=300*dt;b.vy+=course.gravity*dt;b.y+=b.vy*dt;const waterY=338;
 if(b.y>=waterY){if(!b.grounded&&b.vy>220){s.combo=Math.min(15,s.combo+1);s.score+=30*s.combo;burstWake(b.x,b.y+16,10);}b.y=waterY;b.vy=0;b.grounded=true;b.jumps=0;b.rotation*=.62;}else{b.grounded=false;b.rotation=Math.max(-.35,Math.min(.55,b.vy/920));}
 s.spawnDistance-=s.speed*dt;if(s.spawnDistance<=0){spawnSailingPattern(tier);const base=course.id==='easy'?470:course.id==='normal'?425:390;s.spawnDistance=(base+Math.random()*150)*(1-progress*.18);}
 for(const o of s.objects){o.x-=s.speed*dt*(o.speed||1);if(o.type==='bob')o.y=o.baseY+Math.sin(s.elapsed*5+o.phase)*9;}
 for(const o of s.objects){if(o.hit)continue;
   if(o.type==='ring'){const dx=o.x-b.x,dy=o.y-b.y;if(dx*dx+dy*dy<36*36){o.hit=true;s.gates++;s.combo=Math.min(15,s.combo+1);s.score+=105*s.combo;burstWake(o.x,o.y,14);$('sailingMessage').textContent=`Ring collected — combo x${s.combo}`;}continue;}
   if(s.invulnerable>0)continue;
   const bw=15,bh=11;let ow=o.w*.60,oh=o.h*.60,oy=o.y;
   if(o.type==='spikes'){ow=o.w*.70;oh=o.h*.40;oy=o.y+7;}else if(o.type==='wreck'){ow=o.w*.55;oh=o.h*.62;oy=o.y+5;}else if(o.type==='barrel'){ow=o.w*.54;oh=o.h*.65;oy=o.y+4;}else if(o.type==='rock'){ow=o.w*.60;oh=o.h*.60;oy=o.y+4;}
   let collision=false;
   if(o.type==='mine'){const dx=b.x-o.x,dy=b.y-o.y;collision=dx*dx+dy*dy<24*24;}else collision=b.x+bw>o.x-ow/2&&b.x-bw<o.x+ow/2&&b.y+bh>oy-oh/2&&b.y-bh<oy+oh/2;
   if(collision){hitSailingObstacle();break;}
   if(!o.cleared&&o.x+o.w/2<b.x-25){o.cleared=true;s.combo=Math.min(15,s.combo+1);s.score+=48*s.combo;if(s.combo>=6)$('sailingMessage').textContent=`Clean sailing — combo x${s.combo}`;}
 }
 const newCheckpoint=Math.min(3,Math.floor(progress*4));if(newCheckpoint>s.checkpoint){s.checkpoint=newCheckpoint;s.score+=350*newCheckpoint;$('sailingMessage').textContent=`Checkpoint ${newCheckpoint}/3 reached — progress secured!`;burstWake(b.x,b.y,24);}
 s.objects=s.objects.filter(o=>o.x>-130&&!o.hit);s.particles.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=180*dt;p.life-=dt});s.particles=s.particles.filter(p=>p.life>0);
 s.score+=dt*(11+s.combo*2+tier*2);const remain=Math.max(0,course.duration-s.elapsed);$('sailingTime').textContent=Math.ceil(remain);$('sailingHull').textContent=s.lives;$('sailingScore').textContent=Math.floor(s.score).toLocaleString('en-GB');$('sailingCombo').textContent='x'+s.combo;
 $('sailingDialog').classList.toggle('danger',remain<=8||s.lives===1);if(remain<=0)endSailing(true);
}
function getSailingDifficultyTier(progress,id){const bonus={easy:0,normal:1,hard:2,expert:3,insane:4}[id]||0;return Math.min(6,Math.floor(progress*3)+bonus);}
function spawnSailingPattern(tier=0){
 const s=sailingState,c=$('sailingCanvas'),x=c.width+70,r=Math.random(),ring=(rx,ry)=>s.objects.push({type:'ring',x:rx,y:ry,w:24,h:24});
 if(r<.20){s.objects.push({type:'rock',x,y:324,w:48,h:48});ring(x+2,245);}
 else if(r<.38){s.objects.push({type:'spikes',x,y:329,w:72,h:32});ring(x+10,262);}
 else if(r<.54){s.objects.push({type:'wreck',x,y:309,w:72,h:70});ring(x+7,216);}
 else if(r<.68){s.objects.push({type:'barrel',x,y:318,w:40,h:56});if(tier>=2)s.objects.push({type:'barrel',x:x+100,y:318,w:40,h:56});ring(x+50,235);}
 else if(r<.81&&tier>=1){s.objects.push({type:'mine',x,y:250,w:40,h:40,baseY:250,phase:Math.random()*6});ring(x+76,304);}
 else if(r<.92&&tier>=3){s.objects.push({type:'rock',x,y:324,w:46,h:46});s.objects.push({type:'spikes',x:x+130,y:329,w:64,h:30});ring(x+66,205);}
 else{ring(x,280);if(tier>=4){s.objects.push({type:'mine',x:x+115,y:238,w:38,h:38,baseY:238,phase:Math.random()*6});ring(x+170,300);}}
}
function hitSailingObstacle(){
 const s=sailingState;if(!sailingRunning||s.invulnerable>0)return;s.lives--;s.crashes++;s.combo=1;s.invulnerable=1.65;$('sailingDialog').classList.add('shake');setTimeout(()=>$('sailingDialog').classList.remove('shake'),320);burstWake(s.boat.x,s.boat.y,32);
 if(s.lives<=0)return endSailing(false);
 s.objects=[];s.boat.y=338;s.boat.vy=0;s.boat.grounded=true;s.boat.jumps=0;s.spawnDistance=440;$('sailingMessage').textContent=`Hull damaged! ${s.lives} ${s.lives===1?'life':'lives'} left — checkpoint ${s.checkpoint}/3 retained.`;
}
async function endSailing(survived){
 if(!sailingRunning)return;sailingRunning=false;cancelAnimationFrame(sailingFrame);stopSailingMusic(false);const s=sailingState;$('sailingDialog').classList.remove('danger');
 $('sailingIntro').classList.remove('hidden');$('sailingStart').textContent='SAIL AGAIN';$('sailingMessage').textContent=survived?'Voyage complete! Saving Sailing XP…':'Shipwrecked! Saving checkpoint XP…';
 const {data,error}=await db.rpc('complete_sailing_run_v2',{p_course:s.course.id,p_survived:survived,p_score:Math.floor(s.score),p_gates:s.gates,p_seconds:Math.max(1,Math.min(s.course.duration,Math.floor(s.elapsed))),p_checkpoints:s.checkpoint});
 if(error){console.error(error);$('sailingMessage').textContent='Could not save Sailing XP. Run rework-sailing-parkour.sql in Supabase.';return;}
 const r=data?.[0];if(!r)return;character.sailing_xp=Number(r.sailing_xp);renderCharacter();renderSailingCourses();$('sailingMessage').textContent=`${survived?s.course.name+' complete!':'Voyage ended.'} +${r.sailing_gained} Sailing XP. Score ${Math.floor(s.score).toLocaleString('en-GB')}.`;toast(`+${r.sailing_gained} Sailing XP`,3200);
}
function drawSailingBackdrop(ctx,w,h,scroll){
 const shift=scroll%w;ctx.fillStyle='#071821';ctx.fillRect(0,0,w,h);ctx.fillStyle='#112c3b';for(let i=-1;i<4;i++){const x=i*280-(shift*.12%280);ctx.beginPath();ctx.moveTo(x,h*.53);ctx.lineTo(x+90,h*.25);ctx.lineTo(x+180,h*.53);ctx.fill();}
 ctx.fillStyle='#0b3b51';ctx.fillRect(0,300,w,h-300);ctx.strokeStyle='#2c7189';ctx.lineWidth=3;for(let y=306;y<h;y+=28){ctx.beginPath();for(let x=-30;x<=w+30;x+=24)ctx.lineTo(x,y+Math.sin((x+scroll)*.035+y)*5);ctx.stroke();}ctx.fillStyle='#123a30';ctx.fillRect(0,368,w,62);ctx.fillStyle='#245842';for(let x=-(scroll*.45%58);x<w;x+=58)ctx.fillRect(x,378,32,8);
}
function drawSailing(){
 const c=$('sailingCanvas'),ctx=c.getContext('2d'),s=sailingState;drawSailingBackdrop(ctx,c.width,c.height,s?s.distance:0);if(!s)return;ctx.fillStyle='#d6f5ff';s.particles.forEach(p=>{ctx.globalAlpha=Math.max(0,p.life*2);ctx.fillRect(p.x,p.y,p.size,p.size)});ctx.globalAlpha=1;s.objects.forEach(o=>drawSailingObject(ctx,o));
 if(s.invulnerable<=0||Math.floor(s.invulnerable*10)%2===0)drawBoat(ctx,s.boat);const progress=Math.min(1,s.elapsed/s.course.duration);ctx.fillStyle='#071015cc';ctx.fillRect(18,16,c.width-36,10);ctx.fillStyle='#7dd7f3';ctx.fillRect(18,16,(c.width-36)*progress,10);ctx.strokeStyle='#c6effc';ctx.strokeRect(18,16,c.width-36,10);
 for(let i=1;i<=3;i++){const x=18+(c.width-36)*(i/4);ctx.fillStyle=i<=s.checkpoint?'#ffe06a':'#607985';ctx.fillRect(x-2,12,4,18);}ctx.fillStyle='#d7f4ff';ctx.font='bold 13px Arial';ctx.fillText(`${s.course.label} • CHECKPOINT ${s.checkpoint}/3`,20,46);
}
function drawSailingObject(ctx,o){
 ctx.save();ctx.translate(o.x,o.y);if(o.type==='ring'){ctx.strokeStyle='#ffd65a';ctx.lineWidth=7;ctx.beginPath();ctx.arc(0,0,15,0,Math.PI*2);ctx.stroke();ctx.strokeStyle='#fff1a0';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,9,0,Math.PI*2);ctx.stroke();}
 else if(o.type==='rock'){ctx.fillStyle='#555e62';ctx.beginPath();ctx.moveTo(-24,24);ctx.lineTo(-18,-5);ctx.lineTo(-5,-24);ctx.lineTo(19,-13);ctx.lineTo(24,24);ctx.closePath();ctx.fill();ctx.fillStyle='#818a87';ctx.fillRect(-10,-12,9,7);}
 else if(o.type==='spikes'){ctx.fillStyle='#9bb0b5';for(let x=-o.w/2;x<o.w/2;x+=19){ctx.beginPath();ctx.moveTo(x,16);ctx.lineTo(x+9,-16);ctx.lineTo(x+18,16);ctx.fill();}}
 else if(o.type==='wreck'){ctx.fillStyle='#56371f';ctx.fillRect(-38,-8,76,40);ctx.fillStyle='#81552d';ctx.fillRect(-29,-33,7,50);ctx.fillRect(9,-45,7,63);ctx.strokeStyle='#c1a475';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-26,-29);ctx.lineTo(13,-41);ctx.lineTo(31,-5);ctx.stroke();}
 else if(o.type==='barrel'){ctx.fillStyle='#77502c';ctx.fillRect(-21,-29,42,58);ctx.strokeStyle='#c09658';ctx.lineWidth=4;ctx.strokeRect(-19,-25,38,50);ctx.beginPath();ctx.moveTo(-19,-9);ctx.lineTo(19,-9);ctx.moveTo(-19,10);ctx.lineTo(19,10);ctx.stroke();}
 else if(o.type==='mine'){ctx.fillStyle='#25292d';ctx.beginPath();ctx.arc(0,0,18,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#8e9ca0';ctx.lineWidth=4;for(let a=0;a<Math.PI*2;a+=Math.PI/4){ctx.beginPath();ctx.moveTo(Math.cos(a)*15,Math.sin(a)*15);ctx.lineTo(Math.cos(a)*25,Math.sin(a)*25);ctx.stroke();}ctx.fillStyle='#bd323a';ctx.fillRect(-4,-4,8,8);}ctx.restore();
}
function drawBoat(ctx,b){ctx.save();ctx.translate(b.x,b.y);ctx.rotate(b.rotation);ctx.fillStyle='#6f421f';ctx.beginPath();ctx.moveTo(-31,4);ctx.lineTo(31,4);ctx.lineTo(20,25);ctx.lineTo(-20,25);ctx.closePath();ctx.fill();ctx.fillStyle='#a46a34';ctx.fillRect(-22,2,44,7);ctx.fillStyle='#d8c28d';ctx.fillRect(-2,-34,5,39);ctx.fillStyle='#ece3c4';ctx.beginPath();ctx.moveTo(3,-31);ctx.lineTo(3,-3);ctx.lineTo(29,-6);ctx.closePath();ctx.fill();ctx.fillStyle='#ba2730';ctx.beginPath();ctx.moveTo(-3,-28);ctx.lineTo(-3,-5);ctx.lineTo(-22,-8);ctx.closePath();ctx.fill();ctx.fillStyle='#ead9b2';ctx.fillRect(-7,-4,14,10);ctx.restore();}

function drawCombat(){
  const c=$('combatCanvas'),ctx=c.getContext('2d'),s=combatState;
  drawCombatBackdrop(ctx,c.width,c.height);
  if(!s)return;
  if(s.inferno){
    for(const e of s.inferno.eruptions){const pulse=Math.max(0,Math.min(1,e.t));ctx.globalAlpha=e.t>0?.28+.45*(1-pulse):.8;ctx.fillStyle=e.t>0?'#ffb11f':'#ff3b12';ctx.beginPath();ctx.arc(e.x,e.y,e.r*(e.t>0?(1.15-pulse*.15):1),0,7);ctx.fill();ctx.strokeStyle='#ffe168';ctx.lineWidth=3;ctx.stroke();ctx.globalAlpha=1}
    for(const w of s.inferno.walls){ctx.fillStyle='rgba(255,77,12,.90)';ctx.fillRect(w.x-12,0,24,w.gapY-w.gapH/2);ctx.fillRect(w.x-12,w.gapY+w.gapH/2,24,430-(w.gapY+w.gapH/2));ctx.fillStyle='#ffd052';for(let y=8;y<430;y+=28){if(Math.abs(y-w.gapY)<w.gapH/2)continue;ctx.beginPath();ctx.moveTo(w.x-18,y+12);ctx.lineTo(w.x,y-10);ctx.lineTo(w.x+18,y+12);ctx.fill();}}
    ctx.fillStyle='#160604cc';ctx.fillRect(286,18,188,32);ctx.strokeStyle='#ff9c32';ctx.strokeRect(286,18,188,32);ctx.fillStyle='#ffd96b';ctx.font='bold 18px Arial';ctx.textAlign='center';ctx.fillText(s.inferno.boss?'FINAL BOSS':`WAVE ${s.inferno.wave} / ${s.inferno.maxWaves}`,380,40);ctx.textAlign='left';
  }
  s.orbs.forEach(o=>{ctx.fillStyle=o.heal?'#72e08d':'#74d7ff';ctx.beginPath();ctx.arc(o.x,o.y,o.heal?8:6,0,7);ctx.fill();if(o.heal){ctx.fillStyle='#fff';ctx.fillRect(o.x-2,o.y-5,4,10);ctx.fillRect(o.x-5,o.y-2,10,4)}});
  s.enemies.forEach(e=>drawCombatEnemy(ctx,e));
  drawCombatPlayer(ctx,s.player,s.weapon);
  s.slashes.forEach(a=>{ctx.strokeStyle=a.kind==='shadow'?'#b17cff':a.kind==='dharok'?'#d7d2c7':'#fff2a0';ctx.lineWidth=a.kind==='dharok'?9:6;ctx.beginPath();ctx.arc(a.x,a.y,a.kind==='dharok'?34:28,-1.35,.75);ctx.stroke()});
  s.projectiles.forEach(a=>{ctx.strokeStyle=a.kind==='dart'?'#4ee394':'#d6b16f';ctx.lineWidth=a.kind==='dart'?2:3;ctx.beginPath();ctx.moveTo(a.x1,a.y1);ctx.lineTo(a.x2,a.y2);ctx.stroke();ctx.fillStyle=a.kind==='dart'?'#a6ffd0':'#eee4bd';ctx.beginPath();ctx.arc(a.x2,a.y2,a.kind==='dart'?2:3,0,7);ctx.fill()});
  s.chains.forEach(a=>{ctx.strokeStyle=a.kind==='shadow'?'#aa70ff':'#83d9ff';ctx.lineWidth=a.kind==='shadow'?5:4;ctx.beginPath();ctx.moveTo(a.x1,a.y1);ctx.lineTo((a.x1+a.x2)/2+5,a.y1+(a.y2-a.y1)*.45);ctx.lineTo(a.x2,a.y2);ctx.stroke()});
  s.particles.forEach(p=>{ctx.fillStyle='#fff0a4';ctx.font='bold 14px Arial';ctx.fillText(p.text,p.x,p.y)})
}
function drawCombatPlayer(ctx,p,weapon){
  ctx.save();ctx.translate(p.x,p.y);
  ctx.fillStyle='#9a6b3d';ctx.fillRect(-9,-18,18,10);
  ctx.fillStyle='#d0a179';ctx.fillRect(-7,-10,14,12);
  ctx.fillStyle='#506f9b';ctx.fillRect(-10,2,20,19);
  if(weapon==='bow'){
    ctx.strokeStyle='#9d713f';ctx.lineWidth=3;ctx.beginPath();ctx.arc(17,3,14,-1.25,1.25);ctx.stroke();ctx.strokeStyle='#ddd2ad';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(21,-10);ctx.lineTo(21,16);ctx.stroke();
  }else if(weapon==='blowpipe'){
    ctx.strokeStyle='#42d98b';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(8,1);ctx.lineTo(31,-5);ctx.stroke();ctx.fillStyle='#183f31';ctx.fillRect(25,-8,9,6);
  }else if(weapon==='staff'){
    ctx.strokeStyle='#80633c';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(9,15);ctx.lineTo(27,-13);ctx.stroke();ctx.fillStyle='#83d9ff';ctx.beginPath();ctx.arc(28,-15,5,0,7);ctx.fill();
  }else if(weapon==='shadow'){
    ctx.strokeStyle='#39205c';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(8,16);ctx.lineTo(26,-15);ctx.stroke();ctx.strokeStyle='#b17cff';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(20,-12);ctx.lineTo(28,-22);ctx.lineTo(34,-12);ctx.moveTo(28,-22);ctx.lineTo(28,-8);ctx.stroke();
  }else if(weapon==='dharok'){
    ctx.strokeStyle='#5b4937';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(7,13);ctx.lineTo(27,-12);ctx.stroke();ctx.fillStyle='#a9a69e';ctx.beginPath();ctx.moveTo(20,-20);ctx.lineTo(38,-14);ctx.lineTo(29,-3);ctx.lineTo(18,-8);ctx.closePath();ctx.fill();
  }else{
    ctx.fillStyle='#c8c8c8';ctx.fillRect(8,-2,24,5);ctx.fillStyle='#8c633a';ctx.fillRect(5,2,8,4);
  }
  ctx.restore()
}
function drawCombatEnemy(ctx,e){
  ctx.save();ctx.translate(e.x,e.y);
  if(e.type==='goblin'){ctx.fillStyle='#789447';ctx.fillRect(-10,-13,20,22);ctx.fillStyle='#4d632f';ctx.fillRect(-13,-9,5,8);ctx.fillRect(8,-9,5,8)}
  else if(e.type==='cow'){ctx.fillStyle='#eee8da';ctx.fillRect(-18,-10,36,22);ctx.fillStyle='#5e4637';ctx.fillRect(-14,-8,9,8);ctx.fillRect(5,1,10,8);ctx.fillStyle='#eee8da';ctx.fillRect(14,-6,12,12)}
  else if(e.type==='skeleton'){ctx.fillStyle='#d7d1b7';ctx.beginPath();ctx.arc(0,-8,9,0,7);ctx.fill();ctx.fillRect(-4,0,8,20);ctx.strokeStyle='#d7d1b7';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-3,5);ctx.lineTo(-13,14);ctx.moveTo(3,5);ctx.lineTo(13,14);ctx.stroke()}
  else if(e.type==='tz-kih'){ctx.fillStyle='#df7b2d';ctx.beginPath();ctx.moveTo(0,-15);ctx.lineTo(13,10);ctx.lineTo(0,16);ctx.lineTo(-13,10);ctx.closePath();ctx.fill();ctx.fillStyle='#ffcf54';ctx.fillRect(-3,-5,6,6)}
  else if(e.type==='tz-kek'){ctx.fillStyle='#a63c22';ctx.fillRect(-16,-14,32,29);ctx.fillStyle='#e88732';ctx.beginPath();ctx.moveTo(-15,-12);ctx.lineTo(-5,-25);ctx.lineTo(0,-12);ctx.moveTo(15,-12);ctx.lineTo(5,-25);ctx.lineTo(0,-12);ctx.fill()}
  else if(e.type==='tok-xil'){ctx.fillStyle='#6f3025';ctx.beginPath();ctx.arc(0,0,16,0,7);ctx.fill();ctx.strokeStyle='#db7d35';ctx.lineWidth=5;for(let a=0;a<7;a++){const q=a*Math.PI*2/7;ctx.beginPath();ctx.moveTo(Math.cos(q)*12,Math.sin(q)*12);ctx.lineTo(Math.cos(q)*23,Math.sin(q)*23);ctx.stroke()}}
  else if(e.type==='corrupted-rat'){ctx.fillStyle='#d52d86';ctx.beginPath();ctx.ellipse(0,2,15,9,0,0,7);ctx.fill();ctx.fillStyle='#f98bc2';ctx.fillRect(8,-5,8,7)}
  else if(e.type==='corrupted-unicorn'){ctx.fillStyle='#ad3a93';ctx.fillRect(-17,-10,34,23);ctx.fillStyle='#f2a5dc';ctx.beginPath();ctx.moveTo(13,-10);ctx.lineTo(25,-23);ctx.lineTo(19,-7);ctx.fill()}
  else if(e.type==='corrupted-dragon'){ctx.fillStyle='#7f1e72';ctx.beginPath();ctx.moveTo(-21,12);ctx.lineTo(-14,-16);ctx.lineTo(0,-8);ctx.lineTo(15,-20);ctx.lineTo(22,13);ctx.closePath();ctx.fill();ctx.fillStyle='#ff58b8';ctx.fillRect(9,-13,6,4)}
  else if(e.type==='inferno-bat'){ctx.fillStyle='#7d2216';ctx.beginPath();ctx.moveTo(0,-8);ctx.lineTo(18,-15);ctx.lineTo(12,6);ctx.lineTo(0,14);ctx.lineTo(-12,6);ctx.lineTo(-18,-15);ctx.closePath();ctx.fill();ctx.fillStyle='#ffb12e';ctx.fillRect(-3,-4,6,5)}
  else if(e.type==='inferno-brute'){ctx.fillStyle='#8f2f17';ctx.fillRect(-18,-17,36,34);ctx.fillStyle='#d75a20';ctx.fillRect(-24,-10,8,22);ctx.fillRect(16,-10,8,22);ctx.fillStyle='#ffd24a';ctx.fillRect(-10,-8,7,6);ctx.fillRect(3,-8,7,6)}
  else if(e.type==='inferno-ranger'){ctx.fillStyle='#5f2016';ctx.beginPath();ctx.arc(0,0,16,0,7);ctx.fill();ctx.strokeStyle='#ff7a25';ctx.lineWidth=4;ctx.beginPath();ctx.arc(4,0,22,-1.2,1.2);ctx.stroke();ctx.fillStyle='#ffc44a';ctx.fillRect(-7,-6,6,5)}
  else if(e.type==='inferno-mage'){ctx.fillStyle='#3b1010';ctx.beginPath();ctx.arc(0,2,20,0,7);ctx.fill();ctx.strokeStyle='#ff3b18';ctx.lineWidth=5;ctx.beginPath();ctx.arc(0,0,25,0,7);ctx.stroke();ctx.fillStyle='#ffe55d';ctx.beginPath();ctx.arc(0,-4,6,0,7);ctx.fill()}
  else if(e.type==='inferno-boss'){ctx.fillStyle='#40100a';ctx.beginPath();ctx.arc(0,2,43,0,7);ctx.fill();ctx.strokeStyle='#ff6a20';ctx.lineWidth=8;for(let a=0;a<8;a++){const q=a*Math.PI/4;ctx.beginPath();ctx.moveTo(Math.cos(q)*34,Math.sin(q)*34);ctx.lineTo(Math.cos(q)*56,Math.sin(q)*56);ctx.stroke()}ctx.fillStyle='#ffd33d';ctx.beginPath();ctx.arc(-14,-8,7,0,7);ctx.arc(14,-8,7,0,7);ctx.fill();ctx.fillStyle='#ff310f';ctx.fillRect(-18,13,36,8)}
  else {ctx.fillStyle='#441047';ctx.beginPath();ctx.arc(0,0,27,0,7);ctx.fill();ctx.strokeStyle='#ff5fbf';ctx.lineWidth=5;for(let a=0;a<6;a++){const q=a*Math.PI/3;ctx.beginPath();ctx.moveTo(Math.cos(q)*20,Math.sin(q)*20);ctx.lineTo(Math.cos(q)*34,Math.sin(q)*34);ctx.stroke()}ctx.fillStyle='#f6a1db';ctx.fillRect(-12,-6,8,6);ctx.fillRect(4,-6,8,6)}
  ctx.fillStyle='#360b0b';ctx.fillRect(-14,-e.r-8,28,4);ctx.fillStyle='#b52b35';ctx.fillRect(-14,-e.r-8,28*Math.max(0,e.hp/e.maxHp),4);ctx.restore()
}



async function loadDailyXpLeaderboard() {
  const board = $('dailyXpLeaderboard');
  if (!board) return;
  try {
    const { data, error } = await db.rpc('get_daily_xp_leaderboard');
    if (error) throw error;
    if (!data?.length) {
      board.innerHTML = '<div class="daily-xp-empty">No XP earned yet today.</div>';
      return;
    }
    board.innerHTML = data.slice(0, 5).map((row, index) => `
      <div class="daily-xp-entry${index === 0 ? ' first' : ''}">
        <b class="daily-xp-rank">${index + 1}</b>
        <span class="daily-xp-name">${escapeHtml(row.username || 'Adventurer')}</span>
        <strong class="daily-xp-total">${Number(row.xp_earned || 0).toLocaleString('en-GB')} XP</strong>
      </div>`).join('');
  } catch (error) {
    console.warn('Daily XP leaderboard unavailable:', error);
    const message = String(error?.message || 'Leaderboard connection failed');
    board.innerHTML = `<div class="daily-xp-empty"><b>DAILY BOARD UNAVAILABLE</b><br>${escapeHtml(message)}<br><small>Run the corrected <b>add-daily-xp-leaderboard.sql</b> file in Supabase.</small></div>`;
  }
}

async function openLeaderboard() {
  $('leaderboard').textContent = 'Loading...';
  $('leaderboardDialog').showModal();
  const { data, error } = await db.rpc('get_leaderboard');
  if (error) {
    console.error(error);
    $('leaderboard').textContent = 'Leaderboard unavailable until the player stats SQL update has been run.';
    return;
  }
  if (!data?.length) {
    $('leaderboard').textContent = 'No characters yet.';
    return;
  }
  $('leaderboard').innerHTML = data.map((row, index) => `<div><b>${index + 1}</b><button class="player-link" type="button" data-username="${escapeHtml(row.username)}">${escapeHtml(row.username)}</button><strong>${row.total_level}</strong></div>`).join('');
  $('leaderboard').querySelectorAll('.player-link').forEach(button => {
    button.addEventListener('click', () => openPlayerStats(button.dataset.username));
  });
}

async function loadAgilityLeaderboard() {
  const board = $('agilityLeaderboard');
  board.textContent = 'Loading...';
  const { data, error } = await db.rpc('get_agility_leaderboard');
  if (error) {
    console.error(error);
    board.textContent = 'Run the player stats and Dash leaderboard SQL update.';
    return;
  }
  if (!data?.length) {
    board.textContent = 'No completed Dash times yet.';
    return;
  }
  board.innerHTML = data.map((row, index) => `<div><b>${index + 1}</b><button class="player-link" type="button" data-username="${escapeHtml(row.username)}">${escapeHtml(row.username)}</button><strong>${formatDashTime(row.best_ms)}</strong></div>`).join('');
  board.querySelectorAll('.player-link').forEach(button => {
    button.addEventListener('click', () => openPlayerStats(button.dataset.username));
  });
}

// --- Two-player Runecrafting Rune Pool ---
const RC_W=760, RC_H=430, RC_R=12;
const RC_POCKETS=[[25,25],[380,20],[735,25],[25,405],[380,410],[735,405]];
function freshRcBalls(){
  const balls=[{id:'cue',name:'Essence',x:190,y:215,vx:0,vy:0,potted:false,colour:'#f7f4ea',group:0}];
  const fire={name:'Fire',colour:'#c92720',group:1,rune:'fire'};
  const chaos={name:'Chaos',colour:'#f0ba00',group:2,rune:'chaos'};
  const wrath={name:'Wrath',colour:'#111',group:8,rune:'wrath'};
  // Proper 8-ball rack: Wrath rune in the centre, with a Fire and Chaos rune on opposite rear corners.
  const rack=[
    fire,
    chaos,fire,
    fire,wrath,chaos,
    chaos,fire,chaos,fire,
    fire,chaos,fire,chaos,chaos
  ];
  let i=0;
  for(let row=0;row<5;row++) for(let n=0;n<=row;n++){
    const info=rack[i];
    balls.push({id:'r'+i,name:info.name,x:510+row*23,y:215-row*12+n*24,vx:0,vy:0,potted:false,colour:info.colour,group:info.group,rune:info.rune});
    i++;
  }
  return balls;
}
function defaultRcState(host){return{balls:freshRcBalls(),turn:1,groups:{1:0,2:0},status:'waiting',winner:0,players:{1:host,2:null},revision:1,shot_active:false,shot_by:0,message:'Waiting for player two…'}}
function selectRcAiDifficulty(type){if(!['easy','medium','hard'].includes(type))return;selectedRcAiDifficulty=type;document.querySelectorAll('.rc-ai-choice').forEach(b=>b.classList.toggle('selected',b.dataset.ai===type));}
function playRcComputer(){hideRcResult();const state=defaultRcState(character.username);state.players[2]=`Computer (${selectedRcAiDifficulty})`;state.status='playing';state.message=`${character.username} breaks first.`;rcRoom={id:null,code:'SOLO',state,slot:1,isComputer:true,aiDifficulty:selectedRcAiDifficulty};$('rcLobby').classList.add('hidden');$('rcGame').classList.remove('hidden');$('rcCodeLabel').textContent='SINGLE PLAYER';$('rcPlayerLabel').textContent=`P1 · ${character.username}`;startRcMusic();renderRcState();}
function rcCode(){return Math.random().toString(36).slice(2,8).toUpperCase()}
function startRcMusic(){const a=$('rcMusic');if(!a)return;a.volume=.42;a.currentTime=0;const play=a.play();if(play?.catch)play.catch(()=>{})}
function stopRcMusic(){const a=$('rcMusic');if(!a)return;a.pause();a.currentTime=0}
async function openRunecrafting(){if(!character)return;$('runecraftingDialog').showModal();$('rcLobby').classList.remove('hidden');$('rcGame').classList.add('hidden');$('rcLobbyMessage').textContent='Create a match or join using a six-character room code.'}
async function createRcRoom(){const code=rcCode(), state=defaultRcState(character.username);const {data,error}=await db.from('runecrafting_rooms').insert({code,host_user_id:(await db.auth.getUser()).data.user.id,host_name:character.username,state}).select().single();if(error){console.error(error);$('rcLobbyMessage').textContent='Could not create room. Run the Runecrafting Pool SQL update first.';return}await enterRcRoom(data,1)}
async function joinRcRoom(){const code=$('rcRoomCode').value.trim().toUpperCase();if(code.length<4)return;const {data,error}=await db.from('runecrafting_rooms').select('*').eq('code',code).maybeSingle();if(error||!data){$('rcLobbyMessage').textContent='Room not found.';return}const uid=(await db.auth.getUser()).data.user.id;if(data.host_user_id===uid)return enterRcRoom(data,1);if(data.guest_user_id&&data.guest_user_id!==uid){$('rcLobbyMessage').textContent='That match already has two players.';return}let state=data.state;if(!data.guest_user_id){state.players[2]=character.username;state.status='playing';state.message=`${state.players[1]} breaks first.`;state.revision++;const res=await db.from('runecrafting_rooms').update({guest_user_id:uid,guest_name:character.username,state}).eq('id',data.id).select().single();if(res.error){$('rcLobbyMessage').textContent='Could not join this match.';return}return enterRcRoom(res.data,2)}await enterRcRoom(data,2)}
async function enterRcRoom(room,slot){hideRcResult();rcRoom={...room,slot};$('rcLobby').classList.add('hidden');$('rcGame').classList.remove('hidden');$('rcCodeLabel').textContent=room.code;$('rcPlayerLabel').textContent=`P${slot} · ${character.username}`;renderRcState();if(room.state.status==='playing')startRcMusic();clearInterval(rcPollTimer);rcPollTimer=setInterval(pollRcRoom,120)}
async function pollRcRoom(){if(!rcRoom||rcAnimating)return;const oldStatus=rcRoom.state?.status;const {data,error}=await db.from('runecrafting_rooms').select('*').eq('id',rcRoom.id).maybeSingle();if(error||!data)return;rcRoom={...data,slot:rcRoom.slot};if(oldStatus!=='playing'&&data.state.status==='playing')startRcMusic();if(data.state.status==='finished')stopRcMusic();renderRcState()}
function rcCompletionXp(){if(!rcRoom?.isComputer)return null;return {easy:500,medium:1000,hard:1500}[rcRoom.aiDifficulty]||1000}
function hideRcResult(){const panel=$('rcResultScreen');if(panel)panel.classList.add('hidden')}
function showRcResult(){
  if(!rcRoom||rcRoom.state.status!=='finished')return;
  const won=rcRoom.state.winner===rcRoom.slot,panel=$('rcResultScreen');if(!panel)return;
  panel.classList.remove('hidden','victory','defeat');panel.classList.add(won?'victory':'defeat');
  $('rcResultTitle').textContent=won?'VICTORY!':'DEFEAT';
  $('rcResultSubtitle').textContent=won?'You cleared the table and claimed the Wrath rune.':'The other player claimed the Wrath rune first.';
  const xp=rcCompletionXp();$('rcResultXp').textContent=xp?`+${xp.toLocaleString('en-GB')} RUNECRAFTING XP`:'MATCH COMPLETE';
}
function renderRcState(){if(!rcRoom)return;const s=rcRoom.state;$('rcTurnLabel').textContent=s.status==='finished'?`Winner: P${s.winner}`:`P${s.turn} · ${s.players[s.turn]||'Waiting'}`;const g=s.groups[rcRoom.slot];$('rcSetLabel').textContent=g===1?'Red · Fire runes':g===2?'Yellow · Chaos runes':'Unassigned';$('rcMessage').textContent=s.message||'';$('rcRematch').classList.toggle('hidden',s.status!=='finished');renderRcPotted();drawRcTable();if(s.status==='finished')showRcResult();else hideRcResult()}
function renderRcPotted(){if(!rcRoom)return;const balls=rcRoom.state.balls.filter(b=>b.potted&&b.id!=='cue');const groups=[['rcPottedFire',1,'fire','assets/fire-rune.webp'],['rcPottedChaos',2,'chaos','assets/chaos-rune.png'],['rcPottedWrath',8,'wrath','assets/wrath-rune.png']];for(const [id,group,cls,src] of groups){const tray=$(id);if(!tray)continue;const count=balls.filter(b=>b.group===group).length;tray.innerHTML=count?Array.from({length:count},()=>`<span class="rc-potted-ball ${cls}"><img src="${src}" alt=""></span>`).join(''):'<span class="rc-potted-empty">None yet</span>'}}
function drawRcBall(ctx,b){
  ctx.save();
  ctx.fillStyle=b.colour;ctx.beginPath();ctx.arc(b.x,b.y,RC_R,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle=b.group===8?'#d8d8d8':'#151515';ctx.lineWidth=2;ctx.stroke();
  if(b.id==='cue'){
    ctx.fillStyle='rgba(255,255,255,.65)';ctx.beginPath();ctx.arc(b.x-4,b.y-4,3,0,Math.PI*2);ctx.fill();
  }else{
    const img=rcRuneImages[b.rune];
    if(img?.complete){ctx.beginPath();ctx.arc(b.x,b.y,RC_R-2,0,Math.PI*2);ctx.clip();ctx.drawImage(img,b.x-RC_R+2,b.y-RC_R+2,(RC_R-2)*2,(RC_R-2)*2)}
  }
  ctx.restore();
}
function rcRayHit(cue,nx,ny){
  let max=900,hitBall=null;const balls=rcRoom?.state?.balls||[];
  for(const b of balls){if(b===cue||b.potted)continue;const ox=b.x-cue.x,oy=b.y-cue.y,proj=ox*nx+oy*ny;if(proj<=0)continue;const side=Math.abs(ox*ny-oy*nx);if(side<=RC_R*2){const along=proj-Math.sqrt(Math.max(0,(RC_R*2)**2-side**2));if(along<max){max=along;hitBall=b}}}
  const tx=nx>0?(726-cue.x)/nx:nx<0?(34-cue.x)/nx:Infinity,ty=ny>0?(396-cue.y)/ny:ny<0?(34-cue.y)/ny:Infinity;max=Math.min(max,tx>0?tx:Infinity,ty>0?ty:Infinity,900);return{distance:Math.max(0,max),ball:hitBall}
}
function drawRcAimGuide(ctx,cue){
  const dx=cue.x-rcAim.x,dy=cue.y-rcAim.y,len=Math.hypot(dx,dy);if(len<2)return;const nx=dx/len,ny=dy/len,power=Number($('rcPower').value)/100,hit=rcRayHit(cue,nx,ny),guide=Math.min(hit.distance,120+Math.min(330,len*2.4)*power),endX=cue.x+nx*guide,endY=cue.y+ny*guide;
  ctx.save();ctx.lineCap='round';ctx.setLineDash([8,7]);ctx.strokeStyle=`rgba(255,255,255,${.42+.42*power})`;ctx.lineWidth=2+power*1.5;ctx.beginPath();ctx.moveTo(cue.x+nx*15,cue.y+ny*15);ctx.lineTo(endX,endY);ctx.stroke();ctx.setLineDash([]);
  const sideX=-ny,sideY=nx;ctx.fillStyle=`rgba(255,230,88,${.65+.3*power})`;ctx.beginPath();ctx.moveTo(endX+nx*9,endY+ny*9);ctx.lineTo(endX-nx*8+sideX*6,endY-ny*8+sideY*6);ctx.lineTo(endX-nx*8-sideX*6,endY-ny*8-sideY*6);ctx.closePath();ctx.fill();
  if(hit.ball&&guide>=hit.distance-2){ctx.strokeStyle='rgba(255,230,88,.75)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(hit.ball.x,hit.ball.y,RC_R+5,0,Math.PI*2);ctx.stroke()}
  ctx.strokeStyle='rgba(130,205,255,.8)';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(cue.x-nx*(18+power*42),cue.y-ny*(18+power*42));ctx.lineTo(cue.x-nx*15,cue.y-ny*15);ctx.stroke();ctx.restore();
}
function drawRcTable(){const c=$('rcCanvas'),ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);ctx.fillStyle='#10251c';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='#3d2817';ctx.fillRect(8,8,c.width-16,c.height-16);ctx.fillStyle='#176044';ctx.fillRect(20,20,c.width-40,c.height-40);ctx.strokeStyle='#d3b36a';ctx.lineWidth=3;ctx.strokeRect(28,28,c.width-56,c.height-56);for(const [x,y] of RC_POCKETS){ctx.fillStyle='#050505';ctx.beginPath();ctx.arc(x,y,18,0,Math.PI*2);ctx.fill()}if(!rcRoom)return;for(const b of rcRoom.state.balls){if(!b.potted)drawRcBall(ctx,b)}if(rcAim){const cue=rcRoom.state.balls[0];drawRcAimGuide(ctx,cue)}}
function rcPointerPos(e){const r=$('rcCanvas').getBoundingClientRect();return{x:(e.clientX-r.left)*RC_W/r.width,y:(e.clientY-r.top)*RC_H/r.height}}
function rcAimStart(e){if(!rcRoom||rcAnimating)return;const s=rcRoom.state;if(s.status!=='playing'||s.turn!==rcRoom.slot||s.shot_active)return;const cue=s.balls[0];if(cue.potted)return;const p=rcPointerPos(e);if(Math.hypot(p.x-cue.x,p.y-cue.y)<45){rcAim=p;$('rcCanvas').setPointerCapture(e.pointerId);drawRcTable()}}
function rcAimMove(e){if(!rcAim)return;rcAim=rcPointerPos(e);drawRcTable()}
function rcAimEnd(e){if(!rcAim||!rcRoom)return;const cue=rcRoom.state.balls[0],p=rcPointerPos(e),dx=cue.x-p.x,dy=cue.y-p.y,len=Math.hypot(dx,dy);rcAim=null;if(len<8)return drawRcTable();const power=Number($('rcPower').value)/100;cue.vx=dx/len*Math.min(700,len*5)*power;cue.vy=dy/len*Math.min(700,len*5)*power;drawRcTable();runRcPhysics()}
let rcLastLiveSync=0,rcLiveSyncBusy=false;
async function syncRcLiveShot(force=false){
  if(!rcRoom||rcRoom.isComputer||!rcRoom.id||!rcRoom.state?.shot_active||rcLiveSyncBusy)return;
  const now=performance.now();
  if(!force&&now-rcLastLiveSync<90)return;
  rcLastLiveSync=now;rcLiveSyncBusy=true;
  const snapshot={...rcRoom.state,balls:rcRoom.state.balls.map(b=>({...b}))};
  try{await db.from('runecrafting_rooms').update({state:snapshot,updated_at:new Date().toISOString()}).eq('id',rcRoom.id)}finally{rcLiveSyncBusy=false}
}
async function runRcPhysics(){
  rcAnimating=true;
  const s=rcRoom.state;
  s.shot_active=true;s.shot_by=rcRoom.isComputer?(s.shot_by||s.turn):rcRoom.slot;s.revision++;
  // Start the local animation immediately. Network syncing runs in the background,
  // so the player taking the shot never waits for Supabase before seeing the cue ball move.
  drawRcTable();
  syncRcLiveShot(true);
  let potted=[],cuePotted=false,last=performance.now();
  function frame(now){
    const dt=Math.min(.025,(now-last)/1000);last=now;let moving=false;
    for(const b of s.balls){if(b.potted)continue;b.x+=b.vx*dt;b.y+=b.vy*dt;b.vx*=Math.pow(.985,dt*60);b.vy*=Math.pow(.985,dt*60);if(Math.hypot(b.vx,b.vy)<4)b.vx=b.vy=0;else moving=true;if(b.x<34||b.x>726){b.vx*=-.88;b.x=Math.max(34,Math.min(726,b.x))}if(b.y<34||b.y>396){b.vy*=-.88;b.y=Math.max(34,Math.min(396,b.y))}for(const [px,py] of RC_POCKETS)if(Math.hypot(b.x-px,b.y-py)<19){b.potted=true;b.vx=b.vy=0;if(b.id==='cue')cuePotted=true;else potted.push(b)}}
    for(let i=0;i<s.balls.length;i++)for(let j=i+1;j<s.balls.length;j++){const a=s.balls[i],b=s.balls[j];if(a.potted||b.potted)continue;const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);if(d>0&&d<RC_R*2){const nx=dx/d,ny=dy/d,over=RC_R*2-d;a.x-=nx*over/2;a.y-=ny*over/2;b.x+=nx*over/2;b.y+=ny*over/2;const rel=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;if(rel<0){a.vx+=rel*nx;a.vy+=rel*ny;b.vx-=rel*nx;b.vy-=rel*ny}}}
    drawRcTable();syncRcLiveShot();
    if(moving)requestAnimationFrame(frame);else finishRcShot(potted,cuePotted)
  }
  requestAnimationFrame(frame)
}
async function finishRcShot(potted,cuePotted){
  const s=rcRoom.state,me=rcRoom.isComputer?(s.shot_by||s.turn):rcRoom.slot,other=me===1?2:1;
  s.shot_active=false;s.shot_by=0;
  if(!s.groups[me]){const first=potted.find(b=>b.group===1||b.group===2);if(first){s.groups[me]=first.group;s.groups[other]=first.group===1?2:1}}
  const wrath=potted.find(b=>b.group===8);const own=potted.filter(b=>b.group===s.groups[me]);const remainingOwn=s.balls.some(b=>!b.potted&&b.group===s.groups[me]);
  if(wrath){s.status='finished';s.winner=!remainingOwn&&!cuePotted?me:other;s.message=`${s.players[s.winner]} wins the match!`;stopRcMusic();if(rcRoom.isComputer)await awardRcXp(s.winner===1);else await awardRcXp(s.winner===rcRoom.slot)}
  else if(cuePotted){const cue=s.balls[0];cue.potted=false;cue.x=190;cue.y=215;cue.vx=cue.vy=0;s.turn=other;s.message='Essence ball scratched — turn lost.'}
  else if(!own.length){s.turn=other;s.message=`Turn passes to ${s.players[other]}.`}
  else{s.message=`${s.groups[me]===1?'Fire':'Chaos'} rune potted! ${s.players[me]} continues.`}
  s.revision++;rcAnimating=false;
  if(rcRoom.isComputer){renderRcState();if(s.status==='playing'&&s.turn===2)queueRcComputerShot();return;}
  const {data,error}=await db.from('runecrafting_rooms').update({state:s,updated_at:new Date().toISOString()}).eq('id',rcRoom.id).select().single();
  if(!error){rcRoom={...data,slot:rcRoom.slot};renderRcState()}
}
function queueRcComputerShot(){clearTimeout(rcAiTimer);if(!rcRoom?.isComputer||rcRoom.state.status!=='playing'||rcRoom.state.turn!==2)return;$('rcMessage').textContent=`${rcRoom.state.players[2]} is lining up a shot…`;rcAiTimer=setTimeout(takeRcComputerShot,{easy:1250,medium:850,hard:520}[rcRoom.aiDifficulty]);}
function rcSegmentClear(ax,ay,bx,by,ignore=[]){
  const vx=bx-ax,vy=by-ay,l2=vx*vx+vy*vy;if(l2<1)return false;
  for(const b of rcRoom.state.balls){if(b.potted||ignore.includes(b))continue;const t=Math.max(0,Math.min(1,((b.x-ax)*vx+(b.y-ay)*vy)/l2));const x=ax+vx*t,y=ay+vy*t;if(Math.hypot(b.x-x,b.y-y)<RC_R*2.15)return false}
  return true
}
function takeRcComputerShot(){
  if(!rcRoom?.isComputer||rcAnimating||rcRoom.state.turn!==2)return;
  const s=rcRoom.state,cue=s.balls[0],group=s.groups[2],diff=rcRoom.aiDifficulty;
  let targets=s.balls.filter(b=>!b.potted&&b.id!=='cue'&&(group?b.group===group:(b.group===1||b.group===2)));
  if(group&&!targets.length)targets=s.balls.filter(b=>!b.potted&&b.group===8);if(!targets.length)return;
  const candidates=[];
  for(const t of targets)for(const [px,py] of RC_POCKETS){
    const pdx=px-t.x,pdy=py-t.y,pdist=Math.hypot(pdx,pdy)||1,ux=pdx/pdist,uy=pdy/pdist;
    const gx=t.x-ux*RC_R*2.04,gy=t.y-uy*RC_R*2.04,cdist=Math.hypot(gx-cue.x,gy-cue.y);
    if(gx<35||gx>725||gy<35||gy>395)continue;
    const cueClear=rcSegmentClear(cue.x,cue.y,gx,gy,[cue,t]),pocketClear=rcSegmentClear(t.x,t.y,px,py,[t]);
    if(!cueClear||!pocketClear)continue;
    const inx=(t.x-cue.x)/(Math.hypot(t.x-cue.x,t.y-cue.y)||1),iny=(t.y-cue.y)/(Math.hypot(t.x-cue.x,t.y-cue.y)||1),cut=Math.acos(Math.max(-1,Math.min(1,inx*ux+iny*uy)));
    const railPenalty=Math.min(t.x-34,726-t.x,t.y-34,396-t.y)<22?55:0;
    candidates.push({t,px,py,gx,gy,score:cdist+pdist*.72+cut*165+railPenalty});
  }
  candidates.sort((a,b)=>a.score-b.score);let shot=candidates[0];
  if(!shot){const t=targets.sort((a,b)=>Math.hypot(a.x-cue.x,a.y-cue.y)-Math.hypot(b.x-cue.x,b.y-cue.y))[0];shot={t,gx:t.x,gy:t.y,px:t.x,py:t.y,score:999}}
  let dx=shot.gx-cue.x,dy=shot.gy-cue.y,len=Math.hypot(dx,dy)||1,nx=dx/len,ny=dy/len;
  const angularError={easy:.105,medium:.038,hard:.012}[diff],mistakeChance={easy:.20,medium:.07,hard:.015}[diff];
  let angle=(Math.random()-.5)*angularError*2;if(Math.random()<mistakeChance)angle+=(Math.random()<.5?-1:1)*angularError*(1.5+Math.random()*1.7);
  const ca=Math.cos(angle),sa=Math.sin(angle);[nx,ny]=[nx*ca-ny*sa,nx*sa+ny*ca];
  const total=len+Math.hypot(shot.px-shot.t.x,shot.py-shot.t.y),base=Math.min(660,330+total*.58),powerJitter={easy:.16,medium:.07,hard:.025}[diff];
  const speed=base*(1+(Math.random()-.5)*powerJitter*2);cue.vx=nx*speed;cue.vy=ny*speed;s.shot_by=2;drawRcTable();runRcPhysics();
}
async function awardRcXp(won){const args={p_won:won,p_difficulty:rcRoom?.isComputer?(rcRoom.aiDifficulty||'medium'):'online'};const {data,error}=await db.rpc('complete_runecrafting_match_v2',args);if(error){console.error(error);toast('Run the updated Runecrafting SQL to enable the new XP rewards.',4500);return;}const r=data?.[0];if(r){character.runecrafting_xp=Number(r.new_xp);renderCharacter();toast(`+${r.xp_gained} Runecrafting XP`,3500)}}
async function rcRematch(){if(!rcRoom)return;hideRcResult();const s=defaultRcState(rcRoom.state.players[1]);s.players=rcRoom.state.players;s.status=s.players[2]?'playing':'waiting';s.message=s.status==='playing'?`${s.players[1]} breaks first.`:'Waiting for player two…';if(rcRoom.isComputer){rcRoom.state=s;startRcMusic();renderRcState();return}const {data}=await db.from('runecrafting_rooms').update({state:s}).eq('id',rcRoom.id).select().single();if(data){rcRoom={...data,slot:rcRoom.slot};if(s.status==='playing')startRcMusic();renderRcState()}}
function leaveRcRoom(){hideRcResult();stopRcMusic();clearTimeout(rcAiTimer);clearInterval(rcPollTimer);rcPollTimer=null;rcRoom=null;rcAnimating=false;rcAim=null;$('rcGame').classList.add('hidden');$('rcLobby').classList.remove('hidden')}



const MINING_CHAT = [
  'This star has more layers than my bank tabs.',
  'I swear it moved when nobody was looking.',
  'Do pets get Mining gloves or just tiny blisters?',
  'The pickaxe is heavier than I am.',
  'Another seven minutes of highly skilled standing around.',
  'I found a shiny bit. It was just a button.',
  'Can we bank the whole star?',
  'Someone brought a bronze pickaxe to a volcanic crater.',
  'The lava is warm. Too warm, actually.',
  'Mining level: emotionally ninety-nine.',
  'I have struck the same rock seventeen times. Progress.',
  'This would be faster with three more pets.',
  'The star keeps whispering about Grand Exchange prices.',
  'I am definitely helping and not just posing.',
  'Do not stand behind the pickaxe swing.',
  'One more strike, then a very long tea break.',
  'The dust gets everywhere.',
  'I think the Kraken is pretending to mine.',
  'Scurry stole my best ore again.',
  'Youngllef says this is efficient. I have doubts.',
  'That sparkle was mine. I called it.',
  'Imagine explaining this job to a normal cat.',
  'The star is losing. Slowly.',
  'I came for XP and stayed because I forgot the exit.',
  'Is this AFK if I keep talking?',
  'The clan said this was safe content.',
  'My pickaxe has one durability left. Probably.',
  'We should name the crater Steve.',
  'The next ore is definitely the rare one.',
  'Nobody tell the Wise Old Man where we found this.'
];
function formatMiningTime(seconds){seconds=Math.max(0,Math.ceil(Number(seconds)||0));if(!seconds)return 'READY';return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`}
function setMiningChats(){clearInterval(miningChatTimer);const bubbles=[...document.querySelectorAll('.fake-bubble')];let last=-1;const rotate=()=>{bubbles.forEach(b=>b.classList.remove('pop'));const index=Math.floor(Math.random()*bubbles.length);let quote=Math.floor(Math.random()*MINING_CHAT.length);if(quote===last)quote=(quote+1)%MINING_CHAT.length;last=quote;const b=bubbles[index];b.textContent=MINING_CHAT[quote];void b.offsetWidth;b.classList.add('pop')};miningChatTimer=setTimeout(function cycle(){rotate();miningChatTimer=setTimeout(cycle,22000+Math.random()*18000)},12000+Math.random()*10000)}
function renderMiningState(){
  if(!miningAfkState)return;
  const petId=miningAfkState.active_pet,meta=PET_CATALOG[petId];
  $('miningLocked').classList.toggle('hidden',Boolean(petId));$('miningGame').classList.toggle('hidden',!petId);
  if(!petId)return;
  const petName=miningAfkState.pet_name||meta?.name||'Your pet';
  $('miningPet').querySelector('.mining-pet-visual').innerHTML=petMarkup(petId,petName,'star-pet-art',equippedPetCosmeticState);$('miningPet').dataset.petId=petId;$('miningPet').querySelector('.mining-pet-label').textContent=petName;
  $('miningXp').textContent=Number(miningAfkState.mining_xp||0).toLocaleString('en-GB');$('miningGp').textContent=`${Number(miningAfkState.gp||0).toLocaleString('en-GB')} GP`;
  const remaining=Number(miningAfkState.seconds_until_click)||0,active=Boolean(miningAfkState.active),degraded=Boolean(miningAfkState.degraded);
  $('miningCooldown').textContent=active?formatMiningTime(remaining):(degraded?'DEGRADED':'READY');
  $('mineStarButton').disabled=active;
  $('mineStarButton').textContent=active?'PET IS MINING…':(degraded?'STRIKE A NEW STAR':'START 7-MINUTE CYCLE');
  $('stopMiningButton').disabled=false;
  $('miningGame').classList.toggle('is-active',active);
  $('shootingStar').classList.toggle('degraded',degraded&&!active);
  const cycleXp=Math.min(1500,Number(miningAfkState.cycle_xp)||0),cycleGp=Math.min(2500,Number(miningAfkState.cycle_gp)||0),progress=Math.min(100,Math.max(0,Number(miningAfkState.progress_percent)||0));
  $('miningCycleXp').textContent=`${cycleXp.toLocaleString('en-GB')} / 1,500 XP`;
  $('miningCycleGp').textContent=`${cycleGp.toLocaleString('en-GB')} / 2,500 GP`;
  $('miningCycleFill').style.width=`${progress}%`;
  $('miningMessage').textContent=active?'Your pet is mining automatically. XP and GP are being added throughout the seven-minute cycle. You can close this window and return later.':(degraded?'The star has degraded. Strike it once to begin another seven-minute cycle.':'Strike the star once. Your pet will mine for seven minutes without any more clicking.');
}
async function refreshMiningState(silent=false){if(!character)return;const{data,error}=await db.rpc('get_mining_afk_state');if(error){if(!silent)toast(error.message||'Shooting Star could not connect. Run update-shooting-star-7-minute-cycle.sql in Supabase.');console.warn('Mining state error:',error);return}miningAfkState=data?.[0]||null;if(miningAfkState){character.mining_xp=Number(miningAfkState.mining_xp)||0;character.gp=Number(miningAfkState.gp)||0}renderMiningState();renderCharacter()}
async function refreshLiveStarMiners(){
  if(!$('liveStarMiners'))return;
  // The mining RPC on older databases does not include equipped_pet_cosmetic.
  // Merge it with the normal active-pets RPC, which is already used by the pet room.
  const [starResult,petResult]=await Promise.all([db.rpc('get_active_star_miners'),db.rpc('get_active_pets')]);
  if(starResult.error)return;
  const cosmeticByUser=new Map((petResult.data||[]).map(p=>[p.username,p.equipped_pet_cosmetic||null]));
  const own=character?.username||'';
  const miners=(starResult.data||[]).filter(m=>m.username!==own);
  $('liveStarMiners').innerHTML=miners.map((m,i)=>{
    const meta=PET_CATALOG[m.active_pet]||PET_CATALOG.pet_free_cat;
    const cosmetic=m.equipped_pet_cosmetic||cosmeticByUser.get(m.username)||null;
    return `<div class="live-star-miner miner-${i%6}" data-pet-id="${escapeHtml(m.active_pet)}" data-cosmetic="${escapeHtml(cosmetic||'')}"><span>${escapeHtml(m.pet_name||meta.name)}<small>${escapeHtml(m.username)}</small></span>${petMarkup(m.active_pet,m.pet_name||meta.name,'star-pet-art',cosmetic)}<b class="live-pickaxe"><img src="assets/mining-icon.png" alt=""></b></div>`;
  }).join('');
}
async function refreshMyPetCosmetic(){
  const result=await db.rpc('get_my_active_pet');
  if(result.error)return;
  const row=result.data?.[0]||{};
  if('active_pet' in row)activePetState=row.active_pet||null;
  if(row.pet_names)petNamesState=row.pet_names;
  if('equipped_pet_cosmetic' in row)equippedPetCosmeticState=row.equipped_pet_cosmetic||null;
}
async function openMining(){
  if(!character){openAuth('login');return}
  $('miningDialog').showModal();
  // Refresh the equipped item before rendering. Previously this value was only
  // guaranteed to load after opening the bank, so Shooting Stars could show a bare pet.
  await refreshMyPetCosmetic();
  await refreshMiningState();
  await refreshLiveStarMiners();
  setMiningChats();clearInterval(miningAfkPoll);clearInterval(miningLivePoll);
  miningAfkPoll=setInterval(()=>refreshMiningState(true),5000);
  miningLivePoll=setInterval(refreshLiveStarMiners,4000);
}
async function strikeShootingStar(){if(!character)return;const btn=$('mineStarButton');btn.disabled=true;const{data,error}=await db.rpc('mine_shooting_star');if(error){toast(error.message||'The star cannot be mined yet.');await refreshMiningState(true);return}miningAfkState=data?.[0]||null;if(miningAfkState){character.mining_xp=Number(miningAfkState.mining_xp)||0;character.gp=Number(miningAfkState.gp)||0}$('shootingStar').classList.remove('struck','degraded');void $('shootingStar').offsetWidth;$('shootingStar').classList.add('struck');renderMiningState();renderCharacter();refreshLiveStarMiners();toast('Seven-minute mining cycle started: 1,500 Mining XP and 2,500 GP will be earned gradually.',5000)}
function stopShootingStar(){
  clearInterval(miningAfkPoll); miningAfkPoll=null;
  clearInterval(miningLivePoll); miningLivePoll=null;
  clearInterval(miningChatTimer); miningChatTimer=null;
  const dialog=$('miningDialog');
  if(dialog?.open) dialog.close();
  toast('You left the star. Your pet keeps mining and you can return at any time.');
}

const PET_CATALOG = {"pet_free_cat":{"name":"Repo cat","source":"Free starter pet","price":0,"image":"assets/pets/free_cat.svg"},"pet_abyssal_orphan":{"name":"Abyssal orphan","source":"Abyssal Sire","price":55000,"image":"assets/pets/abyssal_orphan.png"},"pet_baby_mole":{"name":"Baby mole","source":"Giant Mole","price":30000,"image":"assets/pets/baby_mole.png"},"pet_baron":{"name":"Baron","source":"Duke Sucellus","price":90000,"image":"assets/pets/baron.png"},"pet_bran":{"name":"Bran","source":"Royal Titans","price":85000,"image":"assets/pets/bran.png"},"pet_beef":{"name":"Beef","source":"Brutus","price":65000,"image":"assets/pets/beef.png"},"pet_butch":{"name":"Butch","source":"Vardorvis","price":95000,"image":"assets/pets/butch.png"},"pet_callisto_cub":{"name":"Callisto cub","source":"Callisto and Artio","price":70000,"image":"assets/pets/callisto_cub.png"},"pet_dom":{"name":"Dom","source":"Doom of Mokhaiotl","price":90000,"image":"assets/pets/dom.png"},"pet_gull":{"name":"Gull","source":"Shellbane Gryphon","price":60000,"image":"assets/pets/gull.png"},"pet_hellpuppy":{"name":"Hellpuppy","source":"Cerberus","price":70000,"image":"assets/pets/hellpuppy.png"},"pet_huberte":{"name":"Huberte","source":"The Hueycoatl","price":65000,"image":"assets/pets/huberte.png"},"pet_ikkle_hydra":{"name":"Ikkle hydra","source":"Alchemical Hydra","price":85000,"image":"assets/pets/ikkle_hydra.png"},"pet_jal_nib_rek":{"name":"Jal-nib-rek","source":"Inferno","price":250000,"image":"assets/pets/jal_nib_rek.png"},"pet_kalphite_princess":{"name":"Kalphite princess","source":"Kalphite Queen","price":55000,"image":"assets/pets/kalphite_princess.png"},"pet_lil_zik":{"name":"Lil' zik","source":"Theatre of Blood","price":175000,"image":"assets/pets/lil_zik.png"},"pet_lilviathan":{"name":"Lil'viathan","source":"The Leviathan","price":95000,"image":"assets/pets/lilviathan.png"},"pet_little_nightmare":{"name":"Little nightmare","source":"The Nightmare and Phosani's Nightmare","price":100000,"image":"assets/pets/little_nightmare.png"},"pet_maggot_marquess":{"name":"Maggot marquess","source":"Maggot King","price":65000,"image":"assets/pets/maggot_marquess.png"},"pet_moxi":{"name":"Moxi","source":"Amoxliatl","price":60000,"image":"assets/pets/moxi.png"},"pet_muphin":{"name":"Muphin","source":"Phantom Muspah","price":75000,"image":"assets/pets/muphin.png"},"pet_nexling":{"name":"Nexling","source":"Nex","price":160000,"image":"assets/pets/nexling.png"},"pet_nid":{"name":"Nid","source":"Araxxor","price":85000,"image":"assets/pets/nid.png"},"pet_noon":{"name":"Noon","source":"Grotesque Guardians","price":55000,"image":"assets/pets/noon.png"},"pet_olmlet":{"name":"Olmlet","source":"Chambers of Xeric","price":150000,"image":"assets/pets/olmlet.png"},"pet_pet_chaos_elemental":{"name":"Pet chaos elemental","source":"Chaos Elemental and Chaos Fanatic","price":40000,"image":"assets/pets/pet_chaos_elemental.png"},"pet_pet_dagannoth_prime":{"name":"Pet dagannoth prime","source":"Dagannoth Prime","price":45000,"image":"assets/pets/pet_dagannoth_prime.png"},"pet_pet_dagannoth_rex":{"name":"Pet dagannoth rex","source":"Dagannoth Rex","price":45000,"image":"assets/pets/pet_dagannoth_rex.png"},"pet_pet_dagannoth_supreme":{"name":"Pet dagannoth supreme","source":"Dagannoth Supreme","price":45000,"image":"assets/pets/pet_dagannoth_supreme.png"},"pet_pet_dark_core":{"name":"Pet dark core","source":"Corporeal Beast","price":100000,"image":"assets/pets/pet_dark_core.png"},"pet_pet_general_graardor":{"name":"Pet general graardor","source":"General Graardor","price":80000,"image":"assets/pets/pet_general_graardor.png"},"pet_pet_kril_tsutsaroth":{"name":"Pet k'ril tsutsaroth","source":"K'ril Tsutsaroth","price":80000,"image":"assets/pets/pet_kril_tsutsaroth.png"},"pet_pet_kraken":{"name":"Pet kraken","source":"Kraken","price":45000,"image":"assets/pets/pet_kraken.png"},"pet_pet_kreearra":{"name":"Pet kree'arra","source":"Kree'arra","price":80000,"image":"assets/pets/pet_kreearra.png"},"pet_pet_smoke_devil":{"name":"Pet smoke devil","source":"Thermonuclear smoke devil","price":50000,"image":"assets/pets/pet_smoke_devil.png"},"pet_pet_snakeling":{"name":"Pet snakeling","source":"Zulrah","price":65000,"image":"assets/pets/pet_snakeling.png"},"pet_pet_zilyana":{"name":"Pet zilyana","source":"Commander Zilyana","price":80000,"image":"assets/pets/pet_zilyana.png"},"pet_phoenix":{"name":"Phoenix","source":"Wintertodt","price":35000,"image":"assets/pets/phoenix.png"},"pet_prince_black_dragon":{"name":"Prince black dragon","source":"King Black Dragon","price":55000,"image":"assets/pets/prince_black_dragon.png"},"pet_scorpias_offspring":{"name":"Scorpia's offspring","source":"Scorpia","price":40000,"image":"assets/pets/scorpias_offspring.png"},"pet_scurry":{"name":"Scurry","source":"Scurrius","price":30000,"image":"assets/pets/scurry.png"},"pet_skotos":{"name":"Skotos","source":"Skotizo","price":50000,"image":"assets/pets/skotos.png"},"pet_smolcano":{"name":"Smolcano","source":"Zalcano","price":45000,"image":"assets/pets/smolcano.png"},"pet_smol_heredit":{"name":"Smol heredit","source":"Sol Heredit","price":90000,"image":"assets/pets/smol_heredit.png"},"pet_saracha":{"name":"Sraracha","source":"Sarachnis","price":40000,"image":"assets/pets/saracha.png"},"pet_tiny_tempor":{"name":"Tiny tempor","source":"Tempoross","price":35000,"image":"assets/pets/tiny_tempor.png"},"pet_tumekens_guardian":{"name":"Tumeken's guardian","source":"Tombs of Amascut","price":150000,"image":"assets/pets/tumekens_guardian.png"},"pet_tzrek_jad":{"name":"Tzrek-jad","source":"TzHaar Fight Cave","price":120000,"image":"assets/pets/tzrek_jad.png"},"pet_venenatis_spiderling":{"name":"Venenatis spiderling","source":"Venenatis and Spindel","price":70000,"image":"assets/pets/venenatis_spiderling.png"},"pet_vetion_jr":{"name":"Vet'ion jr.","source":"Vet'ion and Calvar'ion","price":70000,"image":"assets/pets/vetion_jr.png"},"pet_vorki":{"name":"Vorki","source":"Vorkath","price":75000,"image":"assets/pets/vorki.png"},"pet_wisp":{"name":"Wisp","source":"The Whisperer","price":95000,"image":"assets/pets/wisp.png"},"pet_yami":{"name":"Yami","source":"Yama","price":100000,"image":"assets/pets/yami.png"},"pet_youngllef":{"name":"Youngllef","source":"The Gauntlet","price":110000,"image":"assets/pets/youngllef.png"},"pet_rocky_badger":{"name":"Rocky","source":"Grand Exchange","price":20000,"image":"assets/pets/rocky_badger.png"},"pet_mr_mcgroot":{"name":"Mr McGroot","source":"Grand Exchange","price":40000,"image":"assets/pets/mr_mcgroot.png"},"pet_soup_turtle":{"name":"Soup","source":"Grand Exchange","price":50000,"image":"assets/pets/soup_turtle.png"},"pet_fredo":{"name":"Fredo the Friendly Otter","source":"Harmony level 92","price":0,"image":"assets/pets/fredo_idle.png"}};

const PET_PRESENTATION_OVERRIDES = {
  pet_free_cat:{scale:.86,ground:'walk',personality:'tail'},
  pet_baby_mole:{scale:.92,ground:'walk',personality:'sniff'},
  pet_gull:{scale:.88,ground:'walk',personality:'peck'},
  pet_phoenix:{scale:1.03,ground:'hover',personality:'flap'},
  pet_pet_kreearra:{scale:1.08,ground:'hover',personality:'flap'},
  pet_pet_chaos_elemental:{scale:1.02,ground:'hover',personality:'float'},
  pet_pet_dark_core:{scale:.94,ground:'hover',personality:'float'},
  pet_wisp:{scale:.96,ground:'hover',personality:'float'},
  pet_tiny_tempor:{scale:1.02,ground:'hover',personality:'float'},
  pet_tumekens_guardian:{scale:1.16,ground:'walk',personality:'heavy'},
  pet_tzrek_jad:{scale:1.16,ground:'walk',personality:'heavy'},
  pet_jal_nib_rek:{scale:1.12,ground:'walk',personality:'heavy'},
  pet_prince_black_dragon:{scale:1.1,ground:'walk',personality:'flap'},
  pet_olmlet:{scale:1.08,ground:'walk',personality:'heavy'},
  pet_youngllef:{scale:1.05,ground:'walk',personality:'heavy'},
  pet_smolcano:{scale:1.02,ground:'walk',personality:'pulse'},
  pet_saracha:{scale:1.04,ground:'walk',personality:'skitter'},
  pet_scorpias_offspring:{scale:1.02,ground:'walk',personality:'skitter'},
  pet_venenatis_spiderling:{scale:1.04,ground:'walk',personality:'skitter'},
  pet_nid:{scale:1.04,ground:'walk',personality:'skitter'}
};
function getPetPresentation(id){
  const meta=PET_CATALOG[id]||PET_CATALOG.pet_free_cat;
  const name=(meta?.name||'').toLowerCase();
  const auto={scale:1,ground:'walk',personality:'breathe'};
  if(/phoenix|kree|wisp|chaos elemental|dark core|tempor/.test(name)){auto.ground='hover';auto.personality='float'}
  else if(/spider|scorp|nid|saracha/.test(name)){auto.personality='skitter'}
  else if(/dragon|jad|guardian|olmlet|youngllef|graardor|kril|nexling/.test(name)){auto.scale=1.1;auto.personality='heavy'}
  else if(/cat|hellpuppy|cub|beef|mole|scurry/.test(name)){auto.scale=.9;auto.personality='tail'}
  return {...auto,...(PET_PRESENTATION_OVERRIDES[id]||{})};
}
const CHEF_HAT_FITS={
  default:{x:50,y:20,w:38,r:0},
  pet_free_cat:{x:50,y:20,w:38,r:0},
  pet_abyssal_orphan:{x:52,y:19,w:31,r:2}, pet_baby_mole:{x:31,y:32,w:30,r:-8},
  pet_baron:{x:51,y:31,w:31,r:0}, pet_bran:{x:52,y:10,w:25,r:1}, pet_beef:{x:25,y:29,w:27,r:-7},
  pet_butch:{x:50,y:15,w:25,r:0}, pet_callisto_cub:{x:24,y:36,w:29,r:-10}, pet_dom:{x:50,y:25,w:27,r:0},
  pet_gull:{x:34,y:23,w:27,r:-8}, pet_hellpuppy:{x:29,y:31,w:27,r:-8}, pet_huberte:{x:47,y:23,w:25,r:0},
  pet_ikkle_hydra:{x:50,y:15,w:28,r:0}, pet_jal_nib_rek:{x:50,y:35,w:31,r:0}, pet_kalphite_princess:{x:52,y:28,w:24,r:2},
  pet_lil_zik:{x:51,y:23,w:27,r:0}, pet_lilviathan:{x:30,y:28,w:27,r:-8}, pet_little_nightmare:{x:48,y:18,w:25,r:0},
  pet_maggot_marquess:{x:36,y:30,w:25,r:-8}, pet_moxi:{x:50,y:15,w:23,r:0}, pet_muphin:{x:50,y:39,w:31,r:0},
  pet_nexling:{x:49,y:17,w:25,r:0}, pet_nid:{x:48,y:30,w:25,r:0}, pet_noon:{x:48,y:19,w:24,r:0},
  pet_olmlet:{x:50,y:18,w:26,r:0}, pet_pet_chaos_elemental:{x:51,y:39,w:31,r:0},
  pet_pet_dagannoth_prime:{x:50,y:31,w:35,r:0}, pet_pet_dagannoth_rex:{x:50,y:31,w:35,r:0}, pet_pet_dagannoth_supreme:{x:50,y:31,w:35,r:0},
  pet_pet_dark_core:{x:50,y:30,w:35,r:0}, pet_pet_general_graardor:{x:50,y:30,w:31,r:0}, pet_pet_kril_tsutsaroth:{x:50,y:30,w:31,r:0},
  pet_pet_kraken:{x:50,y:28,w:31,r:0}, pet_pet_kreearra:{x:50,y:28,w:30,r:0}, pet_pet_smoke_devil:{x:50,y:29,w:31,r:0},
  pet_pet_snakeling:{x:50,y:28,w:32,r:0}, pet_pet_zilyana:{x:50,y:28,w:31,r:0}, pet_phoenix:{x:31,y:27,w:25,r:-12},
  pet_prince_black_dragon:{x:26,y:30,w:25,r:-10}, pet_scorpias_offspring:{x:58,y:26,w:24,r:8}, pet_scurry:{x:26,y:31,w:25,r:-10},
  pet_skotos:{x:43,y:20,w:25,r:-3}, pet_smolcano:{x:50,y:15,w:25,r:0}, pet_smol_heredit:{x:52,y:13,w:23,r:0},
  pet_saracha:{x:50,y:22,w:24,r:0}, pet_tiny_tempor:{x:50,y:29,w:29,r:0}, pet_tumekens_guardian:{x:49,y:16,w:24,r:0},
  pet_tzrek_jad:{x:42,y:23,w:25,r:-5}, pet_venenatis_spiderling:{x:50,y:22,w:24,r:0}, pet_vetion_jr:{x:50,y:14,w:25,r:0},
  pet_vorki:{x:33,y:29,w:24,r:-8}, pet_wisp:{x:50,y:13,w:23,r:0}, pet_yami:{x:50,y:23,w:24,r:0}, pet_youngllef:{x:38,y:27,w:25,r:-7}
};
function petMarkup(id,alt='',extraClass='',cosmetic=null){
  const meta=PET_CATALOG[id]||PET_CATALOG.pet_free_cat;
  const view=getPetPresentation(id),fit=CHEF_HAT_FITS[id]||CHEF_HAT_FITS.default;
  // Pet artwork is mirrored inside its own wrapper. Cosmetics remain unmirrored,
  // while their anchor points are mirrored to stay over the same head/body area.
  const cosmeticX=100-Number(fit.x||50),cosmeticRotation=-Number(fit.r||0);
  const calculatedSpecFit=id==='pet_free_cat'
    ?{x:50,y:43,w:49,r:0}
    :{x:cosmeticX,y:Math.min(58,Number(fit.y||20)+14),w:Math.max(38,Math.min(70,Number(fit.w||38)*1.58)),r:cosmeticRotation};
  // A few pets have unusually small/high heads and need a dedicated glasses anchor.
  const spectacleOverrides={
    pet_bran:{x:48,y:27,w:48,r:-1}
  };
  const specFit=spectacleOverrides[id]||calculatedSpecFit;
  const hat=cosmetic==='chefs_hat'?`<img class="pet-cosmetic pet-chefs-hat" src="assets/chef_hat.png" alt="" aria-hidden="true" style="--hat-x:${cosmeticX}%;--hat-y:${fit.y}%;--hat-w:${fit.w}%;--hat-r:${cosmeticRotation}deg">`:'';
  const cape=cosmetic==='fire_cape'?`<img class="pet-cosmetic pet-fire-cape" src="assets/fire_cape.png" alt="" aria-hidden="true">`:'';
  const infernalCape=cosmetic==='infernal_cape'?`<img class="pet-cosmetic pet-fire-cape pet-infernal-cape" src="assets/infernal_cape.png" alt="" aria-hidden="true">`:'';
  const infernalMaxCape=cosmetic==='infernal_max_cape'?`<img class="pet-cosmetic pet-fire-cape pet-infernal-cape" src="assets/infernal_max_cape.png" alt="" aria-hidden="true">`:'';
  const harmonyCape=cosmetic==='harmony_skillcape'?`<img class="pet-cosmetic pet-fire-cape pet-harmony-cape" src="assets/harmony_skillcape.png" alt="" aria-hidden="true">`:'';
  const bucketHelm=cosmetic==='bucket_helm'?`<img class="pet-cosmetic pet-bucket-helm" src="assets/bucket_helm.png" alt="" aria-hidden="true" style="--hat-x:${cosmeticX}%;--hat-y:${fit.y}%;--hat-w:${Math.max(32,Number(fit.w||38)*1.08)}%;--hat-r:${cosmeticRotation}deg">`:'';
  const goldenBucketHelm=cosmetic==='golden_bucket_helm'?`<img class="pet-cosmetic pet-bucket-helm" src="assets/golden_bucket_helm.png" alt="" aria-hidden="true" style="--hat-x:${cosmeticX}%;--hat-y:${fit.y}%;--hat-w:${Math.max(32,Number(fit.w||38)*1.08)}%;--hat-r:${cosmeticRotation}deg">`:'';
  const specs=cosmetic==='odd_spectacles'?`<img class="pet-cosmetic pet-odd-spectacles" src="assets/odd_spectacles.png" alt="" aria-hidden="true" style="--spec-x:${specFit.x}%;--spec-y:${specFit.y}%;--spec-w:${specFit.w}%;--spec-r:${specFit.r}deg">`:'';
  const petBody=id==='pet_fredo'
    ? `<span class="pet-body-facing fredo-body"><img class="pet-body fredo-frame fredo-idle" src="assets/pets/fredo_idle.png" alt="${escapeHtml(alt||meta.name)}"><img class="pet-body fredo-frame fredo-walk-one" src="assets/pets/fredo_walk_1.png" alt="" aria-hidden="true"><img class="pet-body fredo-frame fredo-walk-two" src="assets/pets/fredo_walk_2.png" alt="" aria-hidden="true"><img class="pet-body fredo-frame fredo-stand" src="assets/pets/fredo_stand.png" alt="" aria-hidden="true"></span>`
    : `<span class="pet-body-facing"><img class="pet-body" src="${meta.image}" alt="${escapeHtml(alt||meta.name)}"></span>`;
  return `<span class="pet-visual ${extraClass}${hat||bucketHelm||goldenBucketHelm?' wearing-chefs-hat':''}${cape||infernalCape||infernalMaxCape||harmonyCape?' wearing-fire-cape':''}${specs?' wearing-odd-spectacles':''}" data-pet-id="${escapeHtml(id)}" data-pet-ground="${view.ground}" data-pet-personality="${view.personality}" style="--pet-scale:${view.scale}">${cape}${infernalCape}${infernalMaxCape}${harmonyCape}${petBody}${hat}${bucketHelm}${goldenBucketHelm}${specs}</span>`;
}
let activePetState=null;
let petNamesState={};
let equippedPetCosmeticState=null;
let roamingPetTimer=null;

let bankState = null;

const HARMONY_LAMPS={harmony_lamp_30k:{name:'Harmony XP Lamp',xp:30000,image:'assets/harmony-lamp-30k.png'},harmony_lamp_50k:{name:'Greater Harmony Lamp',xp:50000,image:'assets/harmony-lamp-50k.png'},harmony_lamp_75k:{name:'Grand Harmony Lamp',xp:75000,image:'assets/harmony-lamp-75k.png'},harmony_lamp_100k:{name:'Master Harmony Lamp',xp:100000,image:'assets/harmony-lamp-100k.png'}};
const LAMP_SKILLS=[['agility','Agility'],['slayer','Slayer'],['attack','Attack'],['strength','Strength'],['defence','Defence'],['magic','Magic'],['ranged','Ranged'],['sailing','Sailing'],['runecrafting','Runecrafting'],['cooking','Cooking'],['mining','Mining'],['woodcutting','Woodcutting'],['fishing','Fishing'],['farming','Farming']];
let selectedHarmonyLamp=null;

function bankCosmeticSlot(id,qty){
  const defs={chefs_hat:["Chef's hat",'assets/chef_hat.png','Cooking achievement reward'],odd_spectacles:['Odd Spectacles','assets/odd_spectacles.png','Rune-Dle achievement reward'],fire_cape:['Fire cape','assets/fire_cape.png','Insane Jad achievement reward'],infernal_cape:['Infernal cape','assets/infernal_cape.png','Inferno reward'],infernal_max_cape:['Infernal max cape','assets/infernal_max_cape.png','Inferno Insane reward'],harmony_skillcape:['Harmony skillcape','assets/harmony_skillcape.png','Unlocked together at Harmony level 99'],bucket_helm:['Bucket helm','assets/bucket_helm.png','Lumbridge reward'],golden_bucket_helm:['Golden bucket helm','assets/golden_bucket_helm.png','Lumbridge Insane reward']};
  const d=defs[id];if(!d)return null;const equipped=equippedPetCosmeticState===id;
  return `<div class="bank-slot achievement-bank-slot ${equipped?'equipped-cosmetic':''}"><img src="${d[1]}" alt="${escapeHtml(d[0])}" class="bank-item-art"><b>${escapeHtml(d[0])}</b><small>${equipped?'Equipped to active pet':escapeHtml(d[2])}</small><strong>${Number(qty).toLocaleString('en-GB')}</strong><button type="button" class="bank-cosmetic-toggle" data-cosmetic="${id}">${equipped?'UNEQUIP':'EQUIP'}</button></div>`;
}
function renderBank(){
  const gp=Number(bankState?.gp||0);$('bankGp').textContent=`${gp.toLocaleString('en-GB')} GP`;
  const items=bankState?.items&&typeof bankState.items==='object'?bankState.items:{};
  const entries=Object.entries(items).filter(([id,qty])=>Number(qty)>0&&!PET_CATALOG[id]);
  const slots=entries.map(([id,qty])=>{const lamp=HARMONY_LAMPS[id];if(lamp)return `<div class="bank-slot lamp-bank-slot"><img src="${lamp.image}" alt="${lamp.name}" class="bank-item-art lamp-bank-art"><b>${lamp.name}</b><small>${lamp.xp.toLocaleString('en-GB')} XP in any skill</small><strong>${Number(qty)}</strong><button type="button" class="use-harmony-lamp" data-lamp="${id}">USE</button></div>`;return bankCosmeticSlot(id,qty)||`<div class="bank-slot"><div class="bank-placeholder">?</div><b>${escapeHtml(String(id).replaceAll('_',' '))}</b><strong>${Number(qty).toLocaleString('en-GB')}</strong></div>`;});
  while(slots.length<30)slots.push('<div class="bank-slot empty"><span>—</span></div>');$('bankItems').innerHTML=slots.join('');
  $('bankItems').querySelectorAll('.bank-cosmetic-toggle').forEach(b=>b.addEventListener('click',()=>togglePetCosmetic(b.dataset.cosmetic)));
  $('bankItems').querySelectorAll('.use-harmony-lamp').forEach(b=>b.addEventListener('click',()=>openHarmonyLamp(b.dataset.lamp)));
  $('bankMessage').textContent=entries.length?`${entries.length} item type${entries.length===1?'':'s'} stored.`:'Your expanded bank is ready for cosmetics and rewards.';
}
function renderPets(){
  const items=bankState?.items&&typeof bankState.items==='object'?bankState.items:{};const entries=Object.entries(items).filter(([id,qty])=>Number(qty)>0&&PET_CATALOG[id]);
  const activeMeta=activePetState&&PET_CATALOG[activePetState],activeName=activePetState?(petNamesState[activePetState]||activeMeta?.name):null;
  $('petsActivePet').innerHTML=activeMeta?`${petMarkup(activePetState,activeName,'pet-bank-mini',equippedPetCosmeticState)} ${escapeHtml(activeName)}`:'No pet out';$('petsPutAway').disabled=!activePetState;
  const slots=entries.map(([id])=>{const pet=PET_CATALOG[id],customName=petNamesState[id]||'';return `<div class="bank-slot pet-bank-slot ${activePetState===id?'active-pet':''}" data-pet-id="${escapeHtml(id)}">${petMarkup(id,customName||pet.name,'pet-bank-art',activePetState===id?equippedPetCosmeticState:null)}<b>${escapeHtml(customName||pet.name)}</b><small>${escapeHtml(pet.source)}</small><div class="pet-name-row"><input class="pet-name-input" data-pet-id="${escapeHtml(id)}" maxlength="20" value="${escapeHtml(customName)}" placeholder="Name your pet"><button type="button" class="pet-name-save" data-pet-id="${escapeHtml(id)}">SAVE</button></div><button type="button" class="bank-pet-toggle" data-pet-id="${escapeHtml(id)}">${activePetState===id?'PUT AWAY':'LET OUT'}</button></div>`;});
  while(slots.length<20)slots.push('<div class="bank-slot empty"><span>—</span></div>');$('petsItems').innerHTML=slots.join('');
  $('petsItems').querySelectorAll('.bank-pet-toggle').forEach(b=>b.addEventListener('click',()=>setMyActivePet(activePetState===b.dataset.petId?null:b.dataset.petId)));
  $('petsItems').querySelectorAll('.pet-name-save').forEach(b=>b.addEventListener('click',()=>savePetName(b.dataset.petId,'petsItems','petsMessage')));
  $('petsItems').querySelectorAll('.pet-name-input').forEach(i=>i.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();savePetName(i.dataset.petId,'petsItems','petsMessage')}}));
  $('petsMessage').textContent=entries.length?`${entries.length} unlocked pet${entries.length===1?'':'s'}.`:'No pets unlocked yet.';
}
async function loadBankAndPets(){
  const {data,error}=await db.rpc('get_my_bank');if(error)throw error;bankState=data?.[0]||{gp:0,items:{}};
  const petResult=await db.rpc('get_my_active_pet');activePetState=petResult.error?null:(petResult.data?.[0]?.active_pet||null);petNamesState=petResult.error?{}:(petResult.data?.[0]?.pet_names||{});equippedPetCosmeticState=petResult.error?null:(petResult.data?.[0]?.equipped_pet_cosmetic||null);
}
async function openBank(){if(!character){toast('Log in or create an account to open your bank.');openCharacterDialog('login');return}$('bankDialog').showModal();$('bankItems').innerHTML='';$('bankMessage').textContent='Opening your bank…';try{await loadBankAndPets();renderBank()}catch(error){console.error(error);$('bankMessage').textContent='Could not open the bank. Run add-harmony-pets-and-lamps.sql in Supabase.'}}
async function openPets(){if(!character){toast('Log in or create an account to view pets.');openCharacterDialog('login');return}$('petsDialog').showModal();$('petsItems').innerHTML='';$('petsMessage').textContent='Opening your pets…';try{await loadBankAndPets();renderPets()}catch(error){console.error(error);$('petsMessage').textContent='Could not load pets.'}}
function openHarmonyLamp(id){const lamp=HARMONY_LAMPS[id];if(!lamp)return;selectedHarmonyLamp=id;$('lampDialogImage').src=lamp.image;$('lampDialogCopy').textContent=`Choose one skill to receive ${lamp.xp.toLocaleString('en-GB')} XP. The lamp disappears after use.`;$('lampSkillChoice').innerHTML=LAMP_SKILLS.map(([v,n])=>`<option value="${v}">${n}</option>`).join('');$('lampMessage').textContent='';$('lampDialog').showModal()}
async function useHarmonyLamp(){if(!selectedHarmonyLamp)return;const skill=$('lampSkillChoice').value,button=$('confirmLampUse');button.disabled=true;$('lampMessage').textContent='Using lamp…';const {data,error}=await db.rpc('use_harmony_lamp',{p_lamp:selectedHarmonyLamp,p_skill:skill});button.disabled=false;if(error){console.error(error);$('lampMessage').textContent=error.message||'Could not use lamp.';return}const row=data?.[0];$('lampMessage').textContent=`${Number(row?.xp_awarded||0).toLocaleString('en-GB')} XP added to ${LAMP_SKILLS.find(x=>x[0]===skill)?.[1]||skill}.`;await loadCharacter();await loadBankAndPets();renderBank();setTimeout(()=>$('lampDialog').close(),900)}

async function savePetName(petId,containerId='bankItems',messageId='bankMessage'){
  const input=$(containerId).querySelector(`.pet-name-input[data-pet-id="${CSS.escape(petId)}"]`);
  const name=(input?.value||'').trim();
  if(!name){$(messageId).textContent='Enter a pet name first.';return;}
  $(messageId).textContent='Saving pet name…';
  const {data,error}=await db.rpc('set_pet_name',{p_pet_id:petId,p_pet_name:name});
  if(error){console.error(error);$(messageId).textContent=error.message||'Could not save the pet name.';return;}
  petNamesState=data?.[0]?.pet_names||petNamesState;if($('petsDialog')?.open)renderPets();else renderBank();refreshRoamingPets();
  $(messageId).textContent=`${name} is now this pet's name.`;
}
async function togglePetCosmetic(cosmetic){
  if(!activePetState){$('bankMessage').textContent='Let a pet out before equipping a cosmetic.';return;}
  const next=equippedPetCosmeticState===cosmetic?null:cosmetic;
  const label={fire_cape:'Fire cape',odd_spectacles:'Odd Spectacles',chefs_hat:"Chef's hat",infernal_cape:'Infernal cape',infernal_max_cape:'Infernal max cape',bucket_helm:'Bucket helm',golden_bucket_helm:'Golden bucket helm',harmony_skillcape:'Harmony skillcape'}[cosmetic]||'Pet cosmetic';
  $('bankMessage').textContent=next?`Equipping ${label}…`:`Unequipping ${label}…`;
  const {data,error}=await db.rpc('set_pet_cosmetic',{p_cosmetic:next});
  if(error){console.error(error);$('bankMessage').textContent=error.message||'Could not update the pet cosmetic. Run update-pet-chefs-hat.sql.';return;}
  equippedPetCosmeticState=data?.[0]?.equipped_pet_cosmetic||null;
  if($('petsDialog')?.open)renderPets();else renderBank();refreshRoamingPets();refreshLiveStarMiners();
  $('bankMessage').textContent=equippedPetCosmeticState?'Cosmetic equipped to your active pet everywhere!':'Pet cosmetic unequipped.';
}

async function setMyActivePet(petId){
  const messageId=$('petsDialog')?.open?'petsMessage':'bankMessage';
  $(messageId).textContent=petId?'Calling your pet…':'Putting your pet away…';
  const {data,error}=await db.rpc('set_active_pet',{p_pet_id:petId});
  if(error){console.error(error);$(messageId).textContent=error.message||'Could not update your active pet.';return;}
  activePetState=data?.[0]?.active_pet||null;if(data?.[0]?.pet_names)petNamesState=data[0].pet_names;if('equipped_pet_cosmetic' in (data?.[0]||{}))equippedPetCosmeticState=data[0].equipped_pet_cosmetic||null;
  if($('petsDialog')?.open)renderPets();else renderBank();refreshRoamingPets();
  $(messageId).textContent=activePetState?`${PET_CATALOG[activePetState]?.name||'Your pet'} is now following you.`:'Your pet has been put away.';
}
const PET_ROOM_ROTATION_MS=60000;
const PET_ROOM_TRANSITION_MS=1450;
const PET_ROOM_CONFIGS=[
  {
    id:'mario',image:'assets/mario-kart-pet-room.png',
    entrance:[.115,.365],exit:[.505,.205],
    startGrid:[[.105,.365],[.123,.385],[.105,.405],[.123,.425],[.105,.445],[.123,.465]],
    // Closely traced from the marked red racing line. The points stay near the
    // middle of the tan road through the bridge, right loop, centre and lower loop.
    route:[
      [.125,.37],[.132,.30],[.145,.25],[.18,.23],[.225,.25],
      [.285,.28],[.35,.28],[.405,.27],[.435,.22],[.46,.145],
      [.495,.105],[.535,.105],[.57,.16],[.595,.225],[.64,.27],
      [.70,.285],[.77,.285],[.82,.30],[.855,.35],[.885,.43],
      [.905,.52],[.91,.62],[.895,.70],[.86,.765],[.81,.79],
      [.755,.79],[.70,.765],[.665,.72],[.645,.655],[.64,.59],
      [.62,.535],[.585,.505],[.545,.505],[.515,.55],[.505,.62],
      [.51,.70],[.495,.77],[.46,.82],[.405,.85],[.34,.86],
      [.275,.86],[.21,.86],[.15,.85],[.105,.82],[.075,.77],
      [.075,.71],[.09,.64],[.105,.575],[.115,.52],[.12,.46],
      [.145,.40],[.18,.37],[.22,.36],[.255,.40],[.275,.455],
      [.315,.49],[.365,.505],[.415,.505],[.455,.52],[.49,.555],
      [.52,.57],[.555,.54],[.59,.505],[.62,.48],[.67,.465],
      [.72,.465],[.765,.47],[.80,.50],[.825,.55],[.835,.62],
      [.825,.69],[.79,.735],[.745,.75],[.70,.735],[.67,.69],
      [.665,.63],[.68,.575],[.72,.535],[.765,.515],[.81,.515],
      [.845,.54],[.865,.59],[.865,.65],[.84,.70],[.80,.735],
      [.75,.76],[.69,.76],[.63,.745],[.58,.71],[.545,.66],
      [.515,.60],[.48,.555],[.435,.52],[.385,.505],[.33,.50],
      [.28,.49],[.235,.455],[.215,.405],[.215,.345],[.235,.305],
      [.275,.285],[.325,.285],[.37,.29],[.405,.305],[.425,.34],
      [.42,.385],[.395,.42],[.35,.445],[.30,.45],[.25,.43],
      [.21,.39],[.18,.35],[.15,.34]
    ],
    fallChance:0
  },
  {
    id:'hunger',image:'assets/hunger-games-pet-room.png',
    entrance:[.50,.50],
    spawnPoints:[[.50,.13],[.72,.20],[.84,.48],[.73,.76],[.50,.87],[.27,.76],[.16,.48],[.28,.20]],
    centrePoints:[[.47,.45],[.52,.45],[.55,.50],[.52,.55],[.47,.55],[.44,.50],[.50,.50]],
    retreatPoints:[[.50,.20],[.76,.30],[.80,.55],[.67,.75],[.36,.76],[.20,.57],[.22,.31]],
    exitPoints:[[-.08,.15],[.50,-.12],[1.08,.16],[1.10,.55],[.76,1.10],[.25,1.10],[-.10,.62]],
    fallChance:0
  },
  {
    id:'squid',image:'assets/squid-games-pet-room.png',
    entrance:[.50,.245],exit:[.50,.245],
    approach:[[.50,.32],[.43,.35],[.34,.36],[.25,.37],[.17,.42],[.12,.50]],
    course:[[.22,.65],[.27,.56],[.32,.67],[.37,.54],[.43,.64],[.46,.50],[.51,.61],[.54,.48],[.60,.60],[.64,.49],[.69,.62],[.73,.51],[.78,.65]],
    returnRoute:[[.86,.70],[.91,.61],[.91,.46],[.84,.37],[.72,.35],[.61,.34],[.50,.32],[.39,.34],[.27,.35],[.17,.42],[.12,.50]],
    hopIndexes:[0,1,2,3,4,5,6,7,8,9,10,11,12],fallChance:.035
  }
];
let petRoomIndex=0;
let petRoomSwitchTimer=null;
let petRoomSwitching=false;
let petRoomBackgroundFront='a';

function currentPetRoom(){return PET_ROOM_CONFIGS[petRoomIndex]}
function petRoomPoint(point,el){
  const room=$('petRoom')?.querySelector('.pet-room-scene');
  if(!room)return{x:20,y:20};
  const maxY=Math.max(10,room.clientHeight-el.offsetHeight-8);
  return{x:Math.max(-el.offsetWidth*1.4,Math.min(room.clientWidth+el.offsetWidth*.4,point[0]*room.clientWidth-el.offsetWidth/2)),y:Math.max(-el.offsetHeight,Math.min(maxY,point[1]*room.clientHeight-el.offsetHeight*.72))};
}
function petMotionProfile(el){
  if(!el._petMotionProfile){
    const kartThemes=['air','water','earth','fire','mind','body','cosmic','chaos','nature','law','death','astral','blood','soul','wrath','dust','mud','smoke','steam','lava'];
    el._petMotionProfile={
      speed:.94+Math.random()*.12,offsetX:-3+Math.random()*6,offsetY:-1.5+Math.random()*3,
      pauseChance:.07+Math.random()*.06,fallMultiplier:.65+Math.random()*.7,
      loopDelay:180+Math.random()*720,racePace:.90+Math.random()*.20,
      kartTheme:kartThemes[Math.floor(Math.random()*kartThemes.length)],
      weaponIndex:1+Math.floor(Math.random()*8),fightStyle:Math.random(),escapePoint:Math.floor(Math.random()*7),hp:100,maxHp:100,healing:false
    };
  }
  return el._petMotionProfile;
}
function ensurePetKart(el){
  if(!el.querySelector('.pet-kart')){const kart=document.createElement('div');kart.className='pet-kart';kart.innerHTML='<i></i><b></b>';el.insertBefore(kart,el.querySelector('.pet-sprite'));}
  const profile=petMotionProfile(el);el.dataset.kartTheme=profile.kartTheme;
}
function setPetKart(el,on){
  const wasOn=el.classList.contains('pet-in-kart');
  ensurePetKart(el);
  if(on&&!wasOn){
    const themes=['air','water','earth','fire','mind','body','cosmic','chaos','nature','law','death','astral','blood','soul','wrath','dust','mud','smoke','steam','lava'];
    const profile=petMotionProfile(el);
    profile.kartTheme=themes[Math.floor(Math.random()*themes.length)];
    el.dataset.kartTheme=profile.kartTheme;
  }
  el.classList.toggle('pet-in-kart',on);
}
function ensurePetWeapon(el){
  if(!el.querySelector('.pet-weapon')){const weapon=document.createElement('div');weapon.className='pet-weapon';el.querySelector('.pet-sprite')?.appendChild(weapon);}ensurePetHealthUi(el);
}
function setPetWeapon(el,on,reroll=false){
  ensurePetWeapon(el);const profile=petMotionProfile(el);
  if(on&&(reroll||!profile.weaponIndex))profile.weaponIndex=1+Math.floor(Math.random()*8);
  el.style.setProperty('--pet-weapon',`url('assets/hunger-weapons-new/weapon-${String(profile.weaponIndex).padStart(2,'0')}.png')`);
  el.classList.toggle('pet-armed',on);
}
function ensurePetHealthUi(el){
  if(!el.querySelector('.pet-healthbar')){const bar=document.createElement('div');bar.className='pet-healthbar';bar.innerHTML='<i></i>';el.appendChild(bar);}
  if(!el.querySelector('.pet-heal-item')){const item=document.createElement('div');item.className='pet-heal-item';el.querySelector('.pet-sprite')?.appendChild(item);}
  updatePetHealthUi(el);
}
function updatePetHealthUi(el){
  const profile=petMotionProfile(el),fill=el.querySelector('.pet-healthbar i');
  if(fill)fill.style.width=`${Math.max(0,Math.min(100,(profile.hp/profile.maxHp)*100))}%`;
  el.classList.toggle('pet-health-low',profile.hp<=32);
}
function damagePet(el){
  const profile=petMotionProfile(el);if(profile.healing)return;
  profile.hp=Math.max(8,profile.hp-(5+Math.floor(Math.random()*12)));updatePetHealthUi(el);
}
function showPetHealItem(el,file){
  ensurePetHealthUi(el);const item=el.querySelector('.pet-heal-item');
  item.style.backgroundImage=`url('assets/hunger-healing/${file}')`;
  item.classList.remove('is-visible');void item.offsetWidth;item.classList.add('is-visible');
}
async function healPetIfNeeded(el,cfg){
  const profile=petMotionProfile(el);if(profile.healing||profile.hp>32||petRoomSwitching||!el.isConnected)return;
  profile.healing=true;setPetWeapon(el,false);addPetRoomEffect(el,'LOW HP!');
  await movePetTo(el,[.50,.50],{run:true});if(petRoomSwitching||!el.isConnected){profile.healing=false;return;}
  const choice=Math.floor(Math.random()*3);
  if(choice===0){showPetHealItem(el,'shark.png');addPetRoomEffect(el,'CHOMP!');await petPause(el,520,760);profile.hp=Math.min(profile.maxHp,profile.hp+58);}
  else if(choice===1){showPetHealItem(el,'anglerfish.png');addPetRoomEffect(el,'NOM!');await petPause(el,520,760);profile.hp=Math.min(profile.maxHp,profile.hp+68);}
  else{showPetHealItem(el,'yellow-potion.png');addPetRoomEffect(el,'GLUG!');await petPause(el,420,620);profile.hp=Math.min(profile.maxHp,profile.hp+35);updatePetHealthUi(el);showPetHealItem(el,'pink-potion.png');addPetRoomEffect(el,'FOLLOW-UP!');await petPause(el,420,620);profile.hp=profile.maxHp;}
  el.querySelector('.pet-heal-item')?.classList.remove('is-visible');updatePetHealthUi(el);setPetWeapon(el,true,true);addPetRoomEffect(el,'HEALED!');profile.healing=false;
}
function funnyFightEffect(el){
  const effects=['POW!','BONK!','CLANG!','MISS!','OOF!','⚔'];
  const effect=effects[Math.floor(Math.random()*effects.length)];addPetRoomEffect(el,effect);
  el.classList.remove('pet-attacking');void el.offsetWidth;el.classList.add('pet-attacking');
  clearTimeout(el._attackTimer);el._attackTimer=setTimeout(()=>el.classList.remove('pet-attacking'),520);
  if(effect!=='MISS!')damagePet(el);
}
function flingPetWeapon(el){
  const scene=$('petRoom')?.querySelector('.pet-room-scene');
  const profile=petMotionProfile(el);
  if(!scene||!el.classList.contains('pet-armed')){setPetWeapon(el,false);return;}
  const thrown=document.createElement('div');
  thrown.className='flung-hunger-weapon';
  thrown.style.backgroundImage=`url('assets/hunger-weapons-new/weapon-${String(profile.weaponIndex).padStart(2,'0')}.png')`;
  thrown.style.left=`${Number(el.dataset.x||0)+34}px`;
  thrown.style.top=`${Number(el.dataset.y||0)+28}px`;
  const dx=(-150+Math.random()*300),dy=(-120-Math.random()*160),rot=(-540+Math.random()*1080);
  thrown.style.setProperty('--fling-x',`${dx}px`);thrown.style.setProperty('--fling-y',`${dy}px`);thrown.style.setProperty('--fling-r',`${rot}deg`);
  scene.appendChild(thrown);setPetWeapon(el,false);setTimeout(()=>thrown.remove(),1250);
}
function performPetFlip(el){
  return new Promise(resolve=>{
    const cls=Math.random()<.5?'pet-backflip':'pet-kungfu-flip';
    el.classList.remove('pet-backflip','pet-kungfu-flip');void el.offsetWidth;el.classList.add(cls);
    setTimeout(()=>{el.classList.remove(cls);resolve();},680);
  });
}
function risePetFromPlatform(el){
  return new Promise(resolve=>{
    el.classList.remove('pet-platform-rise');void el.offsetWidth;el.classList.add('pet-platform-rise');
    setTimeout(()=>{el.classList.remove('pet-platform-rise');resolve();},900);
  });
}
async function launchPetFromArena(el,cfg){
  damagePet(el);flingPetWeapon(el);addPetRoomEffect(el,'WHEEEE!');el.classList.add('pet-arena-launched');
  const launch=[Math.random()<.5?-.16:1.16,-.10+Math.random()*1.15];
  await movePetTo(el,launch,{run:true,noOffset:true});el.style.opacity='0';el.classList.remove('pet-arena-launched');
  await petPause(el,420,950);if(petRoomSwitching||!el.isConnected)return;
  const spawn=cfg.spawnPoints[Math.floor(Math.random()*cfg.spawnPoints.length)];await movePetTo(el,spawn,{immediate:true,noOffset:true});
  el.style.opacity='1';await risePetFromPlatform(el);await movePetTo(el,cfg.centrePoints[Math.floor(Math.random()*cfg.centrePoints.length)],{run:true});await healPetIfNeeded(el,cfg);setPetWeapon(el,true,true);addPetRoomEffect(el,'BACK!');
}
function petSpeed(el){
  const view=getPetPresentation(el.dataset.petId||'pet_free_cat');
  const base=view.personality==='heavy'?48:view.personality==='skitter'?82:view.ground==='hover'?68:60;
  return base*petMotionProfile(el).speed;
}
function petPause(el,min=180,max=720){if(petRoomSwitching||!el.isConnected)return Promise.resolve();return new Promise(resolve=>{el._idleTimer=setTimeout(resolve,min+Math.random()*(max-min));});}
function stopPetTimers(el){clearTimeout(el._walkStopTimer);clearTimeout(el._nextWalkTimer);clearTimeout(el._roomLoopTimer);clearTimeout(el._idleTimer);clearTimeout(el._attackTimer)}
function movePetTo(el,point,{immediate=false,run=false,hop=false,race=false,noOffset=false}={}){
  return new Promise(resolve=>{
    stopPetTimers(el);const visual=el.querySelector('.pet-visual');const target=petRoomPoint(point,el);const profile=petMotionProfile(el);
    if(!immediate&&!noOffset){target.x+=profile.offsetX;target.y+=profile.offsetY;}
    const oldX=Number(el.dataset.x||target.x),oldY=Number(el.dataset.y||target.y);const distance=Math.hypot(target.x-oldX,target.y-oldY);
    const raceBoost=race?(2.15*profile.racePace*(.94+Math.random()*.12)):1;
    const duration=immediate?0:Math.max(.16,Math.min(race?1.55:(run?2.1:4.8),distance/(petSpeed(el)*(run?1.75:1)*raceBoost)));
    el.dataset.x=String(target.x);el.dataset.y=String(target.y);el.style.transitionDuration=`${duration}s`;el.style.transform=`translate3d(${target.x}px,${target.y}px,0)`;
    if(visual)visual.style.setProperty('--pet-facing','1');
    el.classList.toggle('pet-is-walking',!immediate);el.classList.toggle('pet-room-running',(run||race)&&!immediate);el.classList.toggle('pet-room-hopping',hop&&!immediate);
    if(immediate){resolve();return}el._walkStopTimer=setTimeout(()=>{el.classList.remove('pet-is-walking','pet-room-running','pet-room-hopping');resolve()},duration*1000+25);
  });
}
async function walkSequence(el,points,opts={}){const profile=petMotionProfile(el);for(let i=0;i<points.length;i++){if(!el.isConnected)return false;await movePetTo(el,points[i],{run:opts.run,hop:opts.hopIndexes?.includes(i),race:opts.race,noOffset:opts.noOffset});if(!opts.noPause&&!petRoomSwitching&&Math.random()<profile.pauseChance)await petPause(el,180,opts.run?520:900);}return true;}
function petFall(el){return new Promise(resolve=>{stopPetTimers(el);el.classList.add('pet-room-falling');addPetRoomEffect(el,'!');setTimeout(()=>{el.classList.remove('pet-room-falling');el.style.opacity='0';resolve()},760);});}

function clearHungerCarryovers(el){
  if(!el)return;setPetWeapon(el,false);el.classList.remove('pet-armed','pet-attacking','pet-healing','pet-health-low','pet-arena-launched','pet-flipping','pet-kungfu-flip');
  el.style.removeProperty('--pet-weapon');el.querySelectorAll('.pet-heal-item,.pet-room-effect').forEach(n=>n.remove());
  const profile=petMotionProfile(el);profile.healing=false;
}
function clearAllHungerSceneItems(){const scene=$('petRoom')?.querySelector('.pet-room-scene');scene?.querySelectorAll('.flung-hunger-weapon,.pet-heal-item').forEach(n=>n.remove());document.querySelectorAll('.roaming-pet').forEach(clearHungerCarryovers)}
async function enterCurrentRoom(el,delay=0,rowIndex=0){
  if(delay)await new Promise(r=>setTimeout(r,delay));const cfg=currentPetRoom();petMotionProfile(el);el.style.opacity='0';
  if(cfg.id==='mario'){
    clearHungerCarryovers(el);setPetKart(el,true);const grid=cfg.startGrid[rowIndex%cfg.startGrid.length];await movePetTo(el,grid,{immediate:true,noOffset:true});
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));el.style.opacity='1';
    // Brief grid hold makes the race read clearly before each kart launches independently.
    await petPause(el,350+rowIndex*80,800+rowIndex*100);
  }else if(cfg.id==='hunger'){
    setPetKart(el,false);setPetWeapon(el,false);ensurePetHealthUi(el);const hungerProfile=petMotionProfile(el);hungerProfile.hp=hungerProfile.maxHp;hungerProfile.healing=false;updatePetHealthUi(el);const spawn=cfg.spawnPoints[rowIndex%cfg.spawnPoints.length];
    await movePetTo(el,spawn,{immediate:true,noOffset:true});await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));el.style.opacity='1';
    await risePetFromPlatform(el);await petPause(el,120+Math.random()*280,330+Math.random()*350);await movePetTo(el,cfg.centrePoints[rowIndex%cfg.centrePoints.length],{run:true});
    setPetWeapon(el,true,true);addPetRoomEffect(el,'GRAB!');
  }else{
    clearHungerCarryovers(el);setPetKart(el,false);setPetWeapon(el,false);await movePetTo(el,cfg.entrance,{immediate:true});await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));el.style.opacity='1';await movePetTo(el,cfg.approach[0],{run:true});
  }
  runPetRoomLoop(el);
}
async function runPetRoomLoop(el){
  if(!el.isConnected||petRoomSwitching)return;const cfg=currentPetRoom();el.dataset.roomId=cfg.id;
  if(cfg.id==='mario'){
    clearHungerCarryovers(el);setPetKart(el,true);setPetWeapon(el,false);await walkSequence(el,cfg.route,{race:true,noPause:true,noOffset:true});
    const p=petMotionProfile(el);p.racePace=Math.max(.86,Math.min(1.16,p.racePace+(-.06+Math.random()*.12)));
  }else if(cfg.id==='hunger'){
    setPetKart(el,false);setPetWeapon(el,true);ensurePetHealthUi(el);const profile=petMotionProfile(el);if(profile.hp<=32){await healPetIfNeeded(el,cfg);if(petRoomSwitching||!el.isConnected)return;}const roll=Math.random();
    if(roll<.035){
      await launchPetFromArena(el,cfg);
    }else if(roll<.115){
      const retreat=cfg.retreatPoints[Math.floor(Math.random()*cfg.retreatPoints.length)];await movePetTo(el,retreat,{run:true});
      if(Math.random()<.45)await performPetFlip(el);await petPause(el,180,760);await movePetTo(el,cfg.centrePoints[Math.floor(Math.random()*cfg.centrePoints.length)],{run:true});
    }else if(roll<.305){
      flingPetWeapon(el);addPetRoomEffect(el,'YEET!');await petPause(el,100,330);await movePetTo(el,[.50,.50],{run:true});setPetWeapon(el,true,true);addPetRoomEffect(el,'NEW!');
    }else if(roll<.455){
      await performPetFlip(el);addPetRoomEffect(el,Math.random()<.5?'HI-YA!':'FLIP!');
    }else{
      const target=cfg.centrePoints[Math.floor(Math.random()*cfg.centrePoints.length)];await movePetTo(el,target,{run:true});funnyFightEffect(el);await healPetIfNeeded(el,cfg);
      if(Math.random()<.16)await performPetFlip(el);await petPause(el,130,500);
      if(Math.random()<.38){const target2=cfg.centrePoints[Math.floor(Math.random()*cfg.centrePoints.length)];await movePetTo(el,target2,{run:true});funnyFightEffect(el);await healPetIfNeeded(el,cfg);}
    }
  }else{
    setPetWeapon(el,false);await walkSequence(el,cfg.approach.slice(1),{run:true});if(petRoomSwitching||!el.isConnected)return;
    const profile=petMotionProfile(el),willFall=Math.random()<(cfg.fallChance*profile.fallMultiplier),fallAt=willFall?2+Math.floor(Math.random()*(cfg.course.length-4)):-1;
    for(let i=0;i<cfg.course.length;i++){await movePetTo(el,cfg.course[i],{run:true,hop:true});if(!petRoomSwitching&&Math.random()<profile.pauseChance*.35)await petPause(el,100,280);if(i===fallAt){await petFall(el);if(petRoomSwitching||!el.isConnected)return;await enterCurrentRoom(el,500+Math.random()*600,Math.floor(Math.random()*6));return;}}
    if(petRoomSwitching||!el.isConnected)return;await walkSequence(el,cfg.returnRoute,{run:true});
  }
  if(!petRoomSwitching&&el.isConnected){const profile=petMotionProfile(el);const delay=cfg.id==='mario'?30+Math.random()*130:cfg.id==='hunger'?120+Math.random()*420:profile.loopDelay+Math.random()*520;el._roomLoopTimer=setTimeout(()=>runPetRoomLoop(el),delay);}
}
async function sendPetOffMap(el,cfg){
  stopPetTimers(el);clearPetRoomAction(el);el.classList.remove('pet-room-falling');
  if(cfg.id==='mario'){
    // Pull into the centre, get out, then walk beneath the stone bridge to leave.
    await movePetTo(el,[.53,.55],{race:true,noOffset:true});await movePetTo(el,[.505,.39],{race:true,noOffset:true});setPetKart(el,false);await petPause(el,90,260);await movePetTo(el,[.505,.28],{run:true,noOffset:true});await movePetTo(el,cfg.exit,{run:true,noOffset:true});
  }else if(cfg.id==='hunger'){
    setPetWeapon(el,false);const profile=petMotionProfile(el);const exit=cfg.exitPoints[profile.escapePoint%cfg.exitPoints.length];await movePetTo(el,exit,{run:true,noOffset:true});
  }else{setPetWeapon(el,false);await movePetTo(el,[.64,.34],{run:true});await movePetTo(el,cfg.exit,{run:true});}
  el.style.opacity='0';
}
function setRoomBackground(cfg){const scene=$('petRoom')?.querySelector('.pet-room-scene');if(!scene)return;const nextClass=petRoomBackgroundFront==='a'?'.pet-room-bg-b':'.pet-room-bg-a',oldClass=petRoomBackgroundFront==='a'?'.pet-room-bg-a':'.pet-room-bg-b';const next=scene.querySelector(nextClass),old=scene.querySelector(oldClass);next.style.backgroundImage=`url('${cfg.image}')`;next.classList.add('is-visible');old.classList.remove('is-visible');petRoomBackgroundFront=petRoomBackgroundFront==='a'?'b':'a';scene.dataset.room=cfg.id;}
async function switchPetRoom(){
  if(petRoomSwitching)return;petRoomSwitching=true;const oldCfg=currentPetRoom(),pets=[...document.querySelectorAll('.roaming-pet')];
  await Promise.race([Promise.all(pets.map((el,i)=>new Promise(r=>setTimeout(r,i*55)).then(()=>sendPetOffMap(el,oldCfg)))),new Promise(r=>setTimeout(r,7500))]);
  clearAllHungerSceneItems();petRoomIndex=(petRoomIndex+1)%PET_ROOM_CONFIGS.length;const cfg=currentPetRoom();setRoomBackground(cfg);await new Promise(r=>setTimeout(r,PET_ROOM_TRANSITION_MS));petRoomSwitching=false;
  pets.filter(el=>el.isConnected).forEach((el,i)=>enterCurrentRoom(el,i*105+Math.random()*220,i));
}
function addPetRoomEffect(el,text){el.querySelectorAll('.pet-room-effect').forEach(n=>n.remove());const fx=document.createElement('span');fx.className='pet-room-effect';fx.textContent=text;el.appendChild(fx);setTimeout(()=>fx.remove(),1700);}
function clearPetRoomAction(el){el.classList.remove('pet-room-splash','pet-room-sitting','pet-room-towel','pet-room-treat');el.dataset.actionPause='0';}
async function refreshRoamingPets(){
  const {data,error}=await db.rpc('get_active_pets');if(error){console.error(error);return;}const layer=$('roamingPets');if(!layer)return;const current=new Map([...layer.children].map(el=>[el.dataset.user,el]));
  (data||[]).slice(0,18).forEach((row,rowIndex)=>{const meta=PET_CATALOG[row.active_pet];if(!meta)return;const petDisplayName=row.pet_name||meta.name;let el=current.get(row.username);
    if(!el){el=document.createElement('div');el.className='roaming-pet';el.dataset.user=row.username;el.innerHTML=`<div class="pet-label"><b>${escapeHtml(petDisplayName)}</b><small>${escapeHtml(row.username)}</small></div><div class="pet-sprite">${petMarkup(row.active_pet,petDisplayName,'roaming-pet-art',row.equipped_pet_cosmetic)}</div>`;el.dataset.petId=row.active_pet;el.dataset.cosmetic=row.equipped_pet_cosmetic||'';layer.appendChild(el);ensurePetKart(el);enterCurrentRoom(el,rowIndex*85+Math.random()*260,rowIndex);}
    else{if(el.dataset.petId!==row.active_pet||el.dataset.cosmetic!==(row.equipped_pet_cosmetic||'')){el.querySelector('.pet-sprite').innerHTML=petMarkup(row.active_pet,petDisplayName,'roaming-pet-art',row.equipped_pet_cosmetic);el.dataset.petId=row.active_pet;el.dataset.cosmetic=row.equipped_pet_cosmetic||'';}const img=el.querySelector('.pet-body');if(img){img.src=meta.image;img.alt=petDisplayName}el.querySelector('.pet-label b').textContent=petDisplayName;el.querySelector('.pet-label small').textContent=row.username;current.delete(row.username);}
  });current.forEach(el=>{stopPetTimers(el);el.remove()});
}
function startRoamingPets(){clearInterval(roamingPetTimer);clearInterval(petRoomSwitchTimer);window.removeEventListener('resize',reflowPetRoom);window.addEventListener('resize',reflowPetRoom);const scene=$('petRoom')?.querySelector('.pet-room-scene');if(scene)scene.dataset.room=currentPetRoom().id;const first=scene?.querySelector('.pet-room-bg-a');if(first)first.style.backgroundImage=`url('${currentPetRoom().image}')`;refreshRoamingPets();roamingPetTimer=setInterval(refreshRoamingPets,12000);petRoomSwitchTimer=setInterval(switchPetRoom,PET_ROOM_ROTATION_MS);}
function reflowPetRoom(){document.querySelectorAll('.roaming-pet').forEach((el,i)=>{const cfg=currentPetRoom();const point=cfg.id==='squid'?(cfg.approach?.[0]||cfg.entrance):cfg.id==='hunger'?cfg.spawnPoints[i%cfg.spawnPoints.length]:(cfg.startGrid?.[i%cfg.startGrid.length]||cfg.entrance);movePetTo(el,point,{immediate:true,noOffset:true});});}

// Shared pet-room chat. Messages are short-lived speech bubbles attached to the sender's active pet.
const petChatSound=new Audio('assets/pet-chat-notification.mp3');
petChatSound.preload='auto';
petChatSound.volume=1;
let petChatLastId=0;
let petChatPollTimer=null;
let petChatBusy=false;
const petChatSeen=new Set();
function playPetChatSound(){try{petChatSound.currentTime=0;petChatSound.play().catch(()=>{});}catch(_){}}
function showPetChatBubble(username,message){
  const pet=[...document.querySelectorAll('.roaming-pet')].find(el=>el.dataset.user===username);
  if(!pet)return false;
  pet.querySelectorAll('.pet-chat-bubble').forEach(n=>n.remove());
  const bubble=document.createElement('div');
  bubble.className='pet-chat-bubble';
  bubble.textContent=message;
  pet.appendChild(bubble);
  clearTimeout(pet._chatBubbleTimer);
  pet._chatBubbleTimer=setTimeout(()=>bubble.remove(),7000);
  return true;
}
function handlePetChatMessage(row,{sound=true}={}){
  const id=Number(row?.id)||0;if(!id||petChatSeen.has(id))return;
  petChatSeen.add(id);petChatLastId=Math.max(petChatLastId,id);
  if(petChatSeen.size>150){const first=petChatSeen.values().next().value;petChatSeen.delete(first)}
  const username=String(row.username||'');const message=String(row.message||'').trim();if(!username||!message)return;
  if(!showPetChatBubble(username,message)){refreshRoamingPets().then(()=>showPetChatBubble(username,message));}
  if(sound)playPetChatSound();
}
async function pollPetRoomChat(initial=false){
  const {data,error}=await db.rpc('get_pet_room_messages',{p_after_id:initial?Math.max(0,petChatLastId):petChatLastId});
  if(error){if(!initial)console.warn('Pet chat polling error:',error.message);return;}
  const rows=data||[];
  if(initial){rows.forEach(row=>handlePetChatMessage(row,{sound:false}));}
  else rows.forEach(row=>handlePetChatMessage(row,{sound:true}));
}
function setPetChatOpen(open){
  const panel=$('petChatPanel'),toggle=$('petChatToggle');if(!panel||!toggle)return;
  panel.classList.toggle('is-open',open);toggle.setAttribute('aria-expanded',String(open));
  if(open)setTimeout(()=>$('petChatInput')?.focus(),30);
}
async function sendPetRoomChat(event){
  event?.preventDefault();
  if(petChatBusy)return;
  if(!character){toast('Log in to chat through your pet.');openCharacterDialog('login');return;}
  // Refresh from Supabase before checking. The cached value can be stale when a pet
  // was selected in an earlier session or before the chat feature loaded.
  await refreshMyPetCosmetic();
  if(!activePetState){toast('Choose an active pet before using pet chat.');return;}
  const input=$('petChatInput');const message=input?.value.trim();if(!message)return;
  petChatBusy=true;$('petChatSend').disabled=true;
  const {data,error}=await db.rpc('send_pet_room_message',{p_message:message});
  petChatBusy=false;$('petChatSend').disabled=false;
  if(error){toast(error.message||'Pet chat could not send. Run add-pet-room-chat.sql in Supabase.');return;}
  input.value='';
  const row=data?.[0];if(row)handlePetChatMessage(row,{sound:true});
}
function startPetRoomChat(){
  clearInterval(petChatPollTimer);
  pollPetRoomChat(true);
  petChatPollTimer=setInterval(()=>pollPetRoomChat(false),1800);
}

let geState={gp:0,items:[]};
let geSearchTimer=null;

function renderGeItems(){
  const results=$('geResults');
  const items=Array.isArray(geState.items)?geState.items:[];
  $('geGp').textContent=`${Number(geState.gp||0).toLocaleString('en-GB')} GP`;
  if(!items.length){
    results.innerHTML='<div class="ge-empty"><b>NO ITEMS LISTED</b><span>The Grand Exchange is ready. Items added later will appear here and become searchable.</span></div>';
    return;
  }
  results.innerHTML=items.map(item=>`<article class="ge-item-row">\n    <div class="ge-item-icon">${item.image_url?`<img src="${escapeHtml(item.image_url)}" alt="">`:'?'}</div>\n    <div class="ge-item-info"><b>${escapeHtml(item.name)}</b><small>${escapeHtml(item.description||'Repo Company market item')}</small></div>\n    <strong class="ge-price"><img src="assets/gold-pieces.png" alt="">${Number(item.price||0).toLocaleString('en-GB')}</strong>\n    <button type="button" class="ge-buy" data-item-id="${escapeHtml(item.item_id)}" ${Number(item.price)>Number(geState.gp)?'disabled':''}>BUY</button>\n  </article>`).join('');
  results.querySelectorAll('.ge-buy').forEach(button=>button.addEventListener('click',()=>buyGeItem(button.dataset.itemId,button)));
}

async function searchGeItems(){
  const query=$('geSearch').value.trim();
  $('geMessage').textContent='Searching the Grand Exchange…';
  const {data,error}=await db.rpc('get_grand_exchange_items',{p_search:query});
  if(error){console.error(error);$('geMessage').textContent='Could not load the Grand Exchange. Run update-grand-exchange.sql in Supabase.';return;}
  geState.items=data||[];renderGeItems();
  $('geMessage').textContent=geState.items.length?`${geState.items.length} item${geState.items.length===1?'':'s'} found.`:'No matching items are currently listed.';
}

async function openGrandExchange(){
  if(!character){toast('Log in or create an account to use the Grand Exchange.');openCharacterDialog('login');return;}
  $('grandExchangeDialog').showModal();$('geSearch').value='';$('geResults').innerHTML='<div class="ge-empty"><b>LOADING MARKET…</b></div>';$('geMessage').textContent='Opening the Grand Exchange…';
  const {data,error}=await db.rpc('get_my_bank');
  if(error){console.error(error);$('geMessage').textContent='Could not read your GP balance. Run update-bank.sql first.';return;}
  geState.gp=Number(data?.[0]?.gp||0);await searchGeItems();
}

async function buyGeItem(itemId,button){
  if(!itemId||busy)return;busy=true;button.disabled=true;$('geMessage').textContent='Submitting Grand Exchange offer…';
  const {data,error}=await db.rpc('buy_grand_exchange_item',{p_item_id:itemId,p_quantity:1});busy=false;
  if(error||!data?.[0]){console.error(error);$('geMessage').textContent=error?.message||'Purchase failed.';button.disabled=false;return;}
  const result=data[0];geState.gp=Number(result.new_gp);renderGeItems();
  $('geMessage').textContent=`Bought ${result.item_name} for ${Number(result.spent_gp).toLocaleString('en-GB')} GP. It is now in your Bank.`;
  bankState={gp:result.new_gp,items:result.bank_items};
}

let wiseTaskState = null;
let wiseTaskCheckTimer = null;
let wiseTaskChecking = false;
const WISE_SKILL_LABELS = {agility:'Agility',slayer:'Slayer',combat:'Combat',sailing:'Sailing',runecrafting:'Runecrafting'};

function queueWiseTaskCheck(delay=450){
  clearTimeout(wiseTaskCheckTimer);
  if(!character)return;
  wiseTaskCheckTimer=setTimeout(()=>checkWiseTaskProgress(true),delay);
}
async function fetchWiseTask(){
  const {data,error}=await db.rpc('get_wise_old_man_task');
  if(error){console.error(error);return null}
  return data?.[0]||null;
}
function renderWiseTask(){
  const t=wiseTaskState;if(!t)return;
  $('wiseGp').textContent=`${Number(t.gp||0).toLocaleString('en-GB')} GP`;
  const active=Boolean(t.task_skill);
  $('wiseNoTask').classList.toggle('hidden',active);
  $('wiseActiveTask').classList.toggle('hidden',!active);
  $('wiseTaskBadge').classList.toggle('hidden',!t.can_claim);
  if(!active)return;
  const label=WISE_SKILL_LABELS[t.task_skill]||t.task_skill;
  const required=Number(t.required_xp)||0,current=Math.max(0,Number(t.current_xp)-Number(t.start_xp)),done=Math.min(required,current);
  const pct=required?Math.min(100,(done/required)*100):0;
  $('wiseTaskTitle').textContent=`Earn ${required.toLocaleString('en-GB')} ${label} XP`;
  $('wiseTaskText').textContent=t.task_skill==='combat'?'Play Level Combat in any location or difficulty. Attack, Strength and Defence XP all count.':`Play Level ${label} and earn the assigned XP.`;
  $('wiseTaskProgress').textContent=`${done.toLocaleString('en-GB')} / ${required.toLocaleString('en-GB')} XP`;
  $('wiseTaskReward').textContent=`${Number(t.reward_gp).toLocaleString('en-GB')} GP`;
  $('wiseTaskFill').style.width=`${pct}%`;
  $('wiseClaimTask').classList.toggle('hidden',!t.can_claim);
  $('wiseSkipTask').disabled=Number(t.gp||0)<5000;
  $('wiseSkipTask').title=Number(t.gp||0)<5000?'You need 5,000 GP to skip this task.':'Pay 5,000 GP and receive a different task.';
  $('wiseActiveTask').classList.toggle('complete',Boolean(t.can_claim));
  $('wiseTaskMessage').textContent=t.can_claim?'Task complete — claim your Gold pieces!':'Earn the XP in the matching Repo Company level.';
}
async function openWiseTask(){
  if(!character){
    toast('Log in or create an account before taking a Wise Old Man task.');
    openCharacterDialog('login');
    return;
  }
  $('wiseTaskDialog').showModal();
  $('wiseTaskMessage').textContent='Checking your assignment…';
  wiseTaskState=await fetchWiseTask();
  if(!wiseTaskState){$('wiseTaskMessage').textContent='Run update-wise-old-man-tasks.sql in Supabase first.';return}
  renderWiseTask();
}
async function requestWiseTask(){
  $('wiseGetTask').disabled=true;
  const {data,error}=await db.rpc('assign_wise_old_man_task');
  $('wiseGetTask').disabled=false;
  if(error){console.error(error);toast('Could not assign task. Run the Wise Old Man SQL.');return}
  wiseTaskState=data?.[0]||await fetchWiseTask();renderWiseTask();
  if(wiseTaskState?.task_skill)toast(`New task: earn ${Number(wiseTaskState.required_xp).toLocaleString('en-GB')} ${WISE_SKILL_LABELS[wiseTaskState.task_skill]} XP`,4200);
}

async function skipWiseTask(){
  if(!wiseTaskState?.task_skill)return;
  if(Number(wiseTaskState.gp||0)<5000){toast('You need 5,000 GP to skip this task.');return;}
  if(!confirm('Skip this Wise Old Man task for 5,000 GP? Your current progress will be lost.'))return;
  const button=$('wiseSkipTask');button.disabled=true;button.textContent='SKIPPING…';
  let {data,error}=await db.rpc('skip_wise_old_man_task_v2');
  // Backwards compatibility for databases that already installed the first skip function.
  if(error&&(/skip_wise_old_man_task_v2|schema cache|could not find/i.test(`${error.message||''} ${error.details||''}`))){
    const fallback=await db.rpc('skip_wise_old_man_task');data=fallback.data;error=fallback.error;
  }
  button.textContent='SKIP TASK — 5,000 GP';
  if(error){
    console.error(error);
    const message=`${error.message||''} ${error.details||''}`;
    if(/not enough/i.test(message))toast('You need 5,000 GP to skip this task.');
    else if(/no active task/i.test(message))toast('You do not currently have a task to skip.');
    else toast('Task skipping is not installed yet. Run fix-wise-old-man-skip.sql in Supabase, then refresh.',6500);
    wiseTaskState=await fetchWiseTask();renderWiseTask();return;
  }
  wiseTaskState=(Array.isArray(data)?data[0]:data)||await fetchWiseTask();renderWiseTask();
  const label=WISE_SKILL_LABELS[wiseTaskState?.task_skill]||wiseTaskState?.task_skill||'task';
  toast(`Task skipped for 5,000 GP. New task: ${label}.`,4600);
}

async function claimWiseTask(auto=false){
  const {data,error}=await db.rpc('claim_wise_old_man_task');
  if(error){console.error(error);if(!auto)toast('Task is not complete yet.');return false}
  const r=data?.[0];if(!r?.claimed)return false;
  toast(`Wise Old Man reward: +${Number(r.reward_gp).toLocaleString('en-GB')} GP!`,5000);
  wiseTaskState=await fetchWiseTask();renderWiseTask();return true;
}
async function checkWiseTaskProgress(autoClaim=false){
  if(wiseTaskChecking||!character)return;wiseTaskChecking=true;
  try{const latest=await fetchWiseTask();if(!latest)return;wiseTaskState=latest;renderWiseTask();if(autoClaim&&latest.can_claim)await claimWiseTask(true)}finally{wiseTaskChecking=false}
}

async function openPlayerStats(username) {
  $('playerStatsTitle').textContent = String(username).toUpperCase();
  $('playerStatsBody').textContent = 'Loading...';
  if (!$('playerStatsDialog').open) $('playerStatsDialog').showModal();
  const { data, error } = await db.rpc('get_public_character', { p_username: username });
  if (error || !data?.[0]) {
    console.error(error);
    $('playerStatsBody').textContent = 'Could not load this player. Run the player stats SQL update.';
    return;
  }
  const row = data[0];
  const skills = [
    ['Harmony', 'assets/harmony-logo.png', count],
    ['Woodcutting', 'assets/tree.png', row.woodcutting_xp],
    ['Mining', 'assets/runite-rocks.png', row.mining_xp],
    ['Fishing', 'assets/shark.png', row.fishing_xp],
    ['Agility', 'assets/agility-icon.webp', row.agility_xp],
    ['Slayer', 'assets/slayer-icon.png', row.slayer_xp],
    ['Attack', 'assets/attack-icon.webp', row.attack_xp],
    ['Strength', 'assets/strength-icon.webp', row.strength_xp],
    ['Defence', 'assets/defence-icon.webp', row.defence_xp],
    ['Magic', 'assets/magic-icon.png', row.magic_xp],
    ['Ranged', 'assets/ranged-icon.png', row.ranged_xp],
    ['Sailing', 'assets/sailing-icon.webp', row.sailing_xp],
    ['Runecrafting', 'assets/runecrafting-icon.png', row.runecrafting_xp],
    ['Cooking', 'assets/cooking-icon-new.png', row.cooking_xp],
    ['Farming', 'assets/watering-can.png', row.farming_xp]
  ];
  const totalLevel = skills.reduce((sum, skill) => {
    const xp = Number(skill[2]) || 0;
    return sum + (skill[0] === 'Harmony' ? harmonyLevelFromXp(xp) : levelFromXp(xp));
  }, 0);
  const skillCards = skills.map(([label, image, rawXp]) => {
    const xp = Number(rawXp) || 0;
    const level = label === 'Harmony' ? harmonyLevelFromXp(xp) : levelFromXp(xp);
    const nextXp = xpForLevel(Math.min(level + 1, 99));
    const currentXp = xpForLevel(level);
    const pct = level >= 99 ? 100 : Math.max(0, Math.min(100, ((xp - currentXp) / Math.max(1, nextXp - currentXp)) * 100));
    return `<div class="public-skill${label === 'Harmony' ? ' harmony-public-skill' : ''}"><img src="${image}" alt="${label}"><div class="public-skill-copy"><b>${label}</b><small>${xp.toLocaleString('en-GB')} XP${label === 'Harmony' ? ' · Shared' : ''}</small><i><span style="width:${pct}%"></span></i></div><strong>${level}</strong></div>`;
  }).join('');
  const created = row.created_at ? new Date(row.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Unknown';
  $('playerStatsBody').innerHTML = `
    <div class="public-profile-summary">
      <div><span>Total level</span><strong>${totalLevel}</strong></div>
      <div><span>Best Dash</span><strong>${row.agility_best_ms ? formatDashTime(row.agility_best_ms) : '—'}</strong></div>
      <div><span>Joined</span><strong>${escapeHtml(created)}</strong></div>
    </div>
    <div class="public-skills-grid">${skillCards}</div>`;
}

function formatDashTime(milliseconds) {
  const ms = Number(milliseconds);
  return Number.isFinite(ms) && ms > 0 ? `${(ms / 1000).toFixed(2)}s` : '—';
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}




// MINI QUESTS — Cook's Assistant playable WASD adventure.
const QUEST_LOCATIONS={
 world:{name:'Lumbridge',description:'Explore Lumbridge. Walk into marked buildings and fields.'},
 kitchen:{name:'Lumbridge Castle Kitchen',description:'The Cook is panicking beside an unfinished birthday cake.'},
 cellar:{name:'Lumbridge Castle Cellar',description:'A cool stone cellar beneath the castle.'},
 store:{name:'Lumbridge General Store',description:'A small shop selling basic supplies.'},
 chicken:{name:"Farmer Fred's Chicken Coop",description:'Chickens peck around their nesting boxes.'},
 cows:{name:'Eastern Lumbridge Cow Field',description:'A dairy cow wearing a bell grazes nearby.'},
 wheat:{name:'Lumbridge Wheat Field',description:'Golden wheat sways beside Mill Lane Mill.'},
 mill:{name:'Mill Lane Mill',description:'A three-storey windmill with a hopper and flour bin.'}
};
let questState=null,questBusy=false,questGame=null,questFrame=null;
const questMusic=new Audio('assets/autumn-voyage.mp3');questMusic.loop=true;questMusic.volume=.48;
const questCookImage=new Image();questCookImage.src='assets/lumbridge-cook.png';
function startQuestMusic(){if(!questMusic.paused)return;questMusic.currentTime=0;questMusic.play().catch(()=>{})}
function stopQuestMusic(reset=true){questMusic.pause();if(reset)questMusic.currentTime=0}
let questDialogueTimer=null,questDialogueQueue=[],questDialogueIndex=0,questDialogueResolve=null;
function questSpeakerName(speaker){return speaker==='You'?(character?.username||'Adventurer'):speaker}
function questSpeakerFace(speaker){if(speaker==='Cook')return '👨‍🍳';if(speaker==='Shop Assistant')return '🧑‍💼';if(speaker==='You')return '🙂';return '💬'}
function renderQuestDialogueLine(){const line=questDialogueQueue[questDialogueIndex];if(!line)return finishQuestDialogue();const [speaker,text]=line;$('questDialogueSpeaker').textContent=questSpeakerName(speaker);$('questDialogueFace').textContent=questSpeakerFace(speaker);$('questDialogueText').textContent=text;$('questDialogue').classList.remove('hidden')}
function showQuestConversation(lines){cancelQuestDialogue(false);questDialogueQueue=lines;questDialogueIndex=0;renderQuestDialogueLine();return new Promise(resolve=>{questDialogueResolve=resolve})}
function advanceQuestDialogue(){if($('questDialogue').classList.contains('hidden'))return false;questDialogueIndex++;if(questDialogueIndex>=questDialogueQueue.length)finishQuestDialogue();else renderQuestDialogueLine();return true}
function finishQuestDialogue(){clearTimeout(questDialogueTimer);$('questDialogue').classList.add('hidden');questDialogueQueue=[];questDialogueIndex=0;const resolve=questDialogueResolve;questDialogueResolve=null;if(resolve)resolve()}
function cancelQuestDialogue(resolve=true){clearTimeout(questDialogueTimer);$('questDialogue').classList.add('hidden');questDialogueQueue=[];questDialogueIndex=0;const done=questDialogueResolve;questDialogueResolve=null;if(resolve&&done)done()}
function showQuestDialogue(text,duration=0,speaker='Narrator'){showQuestConversation([[speaker,text]]);if(duration)questDialogueTimer=setTimeout(finishQuestDialogue,duration)}
function hideQuestDialogue(){cancelQuestDialogue(true)}
const qKeys={};
const QUEST_SCENES={
 world:{spawn:[445,365],walls:[],objects:[
  {x:350,y:300,w:150,h:120,type:'portal',to:'kitchen',label:'Lumbridge Castle'},
  {x:330,y:432,w:100,h:65,type:'portal',to:'cellar',label:'Castle Cellar'},
  {x:570,y:330,w:115,h:88,type:'portal',to:'store',label:'General Store'},
  {x:690,y:125,w:130,h:95,type:'portal',to:'chicken',label:'Chicken Coop'},
  {x:585,y:75,w:150,h:100,type:'portal',to:'cows',label:'Cow Field'},
  {x:210,y:105,w:165,h:115,type:'portal',to:'wheat',label:'Wheat Field'},
  {x:80,y:65,w:115,h:150,type:'portal',to:'mill',label:'Mill Lane Mill'}]},
 kitchen:{spawn:[100,420],objects:[{x:670,y:165,w:70,h:70,type:'action',action:'talk_cook',label:'Cook'},{x:480,y:285,w:45,h:35,type:'action',action:'take_pot',label:'Pot'},{x:50,y:445,w:110,h:55,type:'exit',label:'Exit'}]},
 cellar:{spawn:[100,420],objects:[{x:500,y:290,w:50,h:55,type:'action',action:'take_bucket',label:'Bucket'},{x:50,y:445,w:110,h:55,type:'exit',label:'Stairs up'}]},
 store:{spawn:[100,420],objects:[{x:660,y:180,w:70,h:70,type:'action',action:'buy_supplies',label:'Shopkeeper'},{x:50,y:445,w:110,h:55,type:'exit',label:'Exit'}]},
 chicken:{spawn:[100,420],objects:[{x:610,y:280,w:44,h:35,type:'action',action:'take_egg',label:'Egg'},{x:50,y:445,w:110,h:55,type:'exit',label:'Gate'}]},
 cows:{spawn:[100,420],objects:[{x:610,y:245,w:95,h:65,type:'action',action:'milk_cow',label:'Dairy cow'},{x:50,y:445,w:110,h:55,type:'exit',label:'Gate'}]},
 wheat:{spawn:[100,420],objects:[{x:560,y:180,w:180,h:150,type:'action',action:'pick_grain',label:'Wheat'},{x:50,y:445,w:110,h:55,type:'exit',label:'Path'}]},
 mill:{spawn:[100,420],objects:[{x:620,y:115,w:85,h:55,type:'action',action:'load_hopper',label:'Hopper'},{x:735,y:190,w:35,h:70,type:'action',action:'pull_lever',label:'Lever'},{x:555,y:350,w:90,h:60,type:'action',action:'collect_flour',label:'Flour bin'},{x:50,y:445,w:110,h:55,type:'exit',label:'Exit'}]}
};
async function loadQuestProfile(){const{data,error}=await db.rpc('get_cooks_assistant_state');if(error){console.warn('Quest system not installed.',error);return null}questState=data?.[0]||null;if(questState){character.cooking_xp=Number(questState.cooking_xp)||0;character.gp=Number(questState.gp)||0;character.quest_points=Number(questState.quest_points)||0}return questState}
async function openQuests(){if(!character){toast('Log in before starting a quest.');openCharacterDialog('login');return}$('questsDialog').showModal();await loadQuestProfile();renderQuestJournal()}
function renderQuestJournal(){const q=questState||{},completed=Boolean(q.completed),active=q.status==='active';$('questPointsTotal').textContent=Number(q.quest_points||0).toLocaleString('en-GB');$('selectCooksAssistant').classList.toggle('quest-crossed',completed);$('cooksQuestMark').textContent=completed?'✓':active?'◆':'○';$('cooksQuestMark').className=completed?'complete':active?'active':'';$('questOverview').classList.toggle('hidden',active);$('questAdventure').classList.toggle('hidden',!active);$('startCooksQuest').textContent=active?'CONTINUE QUEST':completed?'REPLAY QUEST':'START QUEST';$('startCooksQuest').disabled=false;if(active){$('questAdventure').classList.remove('hidden');renderQuestAdventure();if(!questGame||!questFrame)startQuestGame()}}
function questHas(key){return Boolean(questState?.[key])}
function renderQuestAdventure(){if(!questState)return;$('questCookingXp').textContent=`${Number(questState.cooking_xp||0).toLocaleString('en-GB')} Cooking XP`;$('questGp').textContent=`${Number(questState.gp||0).toLocaleString('en-GB')} GP`;const items=[['bucket','Bucket',questHas('has_bucket')],['pot','Pot',questHas('has_pot')],['egg','Egg',questHas('has_egg')],['milk','Milk',questHas('has_milk')],['grain','Grain',questHas('has_grain')],['flour','Flour',questHas('has_flour')]];$('questInventory').innerHTML=items.map(([id,label,got])=>`<div class="quest-item ${got?'owned':''}"><span>${{bucket:'🪣',pot:'◉',egg:'🥚',milk:'🥛',grain:'🌾',flour:'⚪'}[id]}</span><b>${label}</b><small>${got?'Obtained':'Empty'}</small>${got?`<button type="button" class="quest-drop-item" data-drop="${id}">DROP</button>`:''}</div>`).join('');const needed=[];if(!questHas('has_egg'))needed.push('egg');if(!questHas('has_milk'))needed.push('milk');if(!questHas('has_flour'))needed.push('flour');$('questStatusText').textContent=questState.completed?'Quest complete!':needed.length?`Still needed: ${needed.join(', ')}.`:'Return to the Cook with all ingredients.'}
async function startCooksAssistant(){if(!character)return;if(questState?.status==='active'){$('questOverview').classList.add('hidden');$('questAdventure').classList.remove('hidden');renderQuestAdventure();startQuestGame();return}const{data,error}=await db.rpc('cooks_assistant_action',{p_action:'start'});if(error){console.error(error);toast('Run update-cooks-assistant.sql in Supabase first.');return}questState=data?.[0];character.cooking_xp=Number(questState.cooking_xp)||0;renderQuestJournal();toast('Quest started — use WASD to explore Lumbridge!')}
function startQuestGame(){cancelAnimationFrame(questFrame);startQuestMusic();const saved=questState?.location||'kitchen';questGame={scene:saved==='kitchen'?'kitchen':saved,p:{x:100,y:420,r:13,dir:1},near:null,last:performance.now()};const sc=QUEST_SCENES[questGame.scene]||QUEST_SCENES.world;questGame.p.x=sc.spawn[0];questGame.p.y=sc.spawn[1];questFrame=requestAnimationFrame(questLoop)}
function questLoop(now){if(!$('questsDialog').open||!questGame){questFrame=null;return;}const dt=Math.min(.035,(now-questGame.last)/1000||0);questGame.last=now;updateQuestGame(dt);drawQuestGame();questFrame=requestAnimationFrame(questLoop)}
function updateQuestGame(dt){const p=questGame.p,speed=185;let dx=(qKeys.KeyD||qKeys.ArrowRight?1:0)-(qKeys.KeyA||qKeys.ArrowLeft?1:0),dy=(qKeys.KeyS||qKeys.ArrowDown?1:0)-(qKeys.KeyW||qKeys.ArrowUp?1:0);if(dx||dy){const l=Math.hypot(dx,dy);dx/=l;dy/=l;p.x=Math.max(18,Math.min(882,p.x+dx*speed*dt));p.y=Math.max(42,Math.min(502,p.y+dy*speed*dt));if(dx)p.dir=Math.sign(dx)}const scene=QUEST_SCENES[questGame.scene];questGame.near=null;for(const o of scene.objects){const cx=Math.max(o.x,Math.min(p.x,o.x+o.w)),cy=Math.max(o.y,Math.min(p.y,o.y+o.h));if(Math.hypot(p.x-cx,p.y-cy)<58){questGame.near=o;break}}$('questPrompt').textContent=questGame.near?`Press E to ${questGame.near.type==='portal'?'enter':questGame.near.type==='exit'?'leave':'interact with'} ${questGame.near.label}`:'Explore with WASD. Walk close to people, items and entrances.'}
async function questInteract(){if(!$('questDialogue').classList.contains('hidden')){advanceQuestDialogue();return;}if(!questGame?.near||questBusy){if(questGame)$('questPrompt').textContent='Move closer to the highlighted person, item or doorway, then press E.';return;}const o=questGame.near;if(o.type==='portal'){await setQuestScene(o.to)}else if(o.type==='exit'){questGame.scene='world';questGame.p.x=445;questGame.p.y=365;updateQuestSceneText()}else if(o.type==='action'){let action=o.action;if(action==='talk_cook'&&questHas('has_egg')&&questHas('has_milk')&&questHas('has_flour'))action='deliver';if(action==='buy_supplies'){await runShopAssistantDialogue();return}await performQuestAction(action)}}

async function runShopAssistantDialogue(){
  if(questBusy)return;
  questBusy=true;
  await showQuestConversation([
    ['Shop Assistant','Welcome to the Lumbridge General Store. Looking for supplies?'],
    ['You','I need a bucket and a pot for the Cook.'],
    ['Shop Assistant','A bucket is 2 coins and a pot is 1 coin. That will be 3 GP altogether.'],
    ['You','...I do not actually have any money.'],
    ['Shop Assistant','You came into my shop with no coins?'],
    ['Shop Assistant','You are completely broke. Go find them yourself.'],
    ['Shop Assistant','Try the castle cellar for a bucket and the castle kitchen for a pot.']
  ]);
  $('questPrompt').textContent='The Shop Assistant refuses to help. Search Lumbridge Castle for the bucket and pot.';
  questBusy=false;
}
async function setQuestScene(scene){questBusy=true;const{data,error}=await db.rpc('cooks_assistant_action',{p_action:`travel_${scene}`});questBusy=false;if(error){toast('Could not enter that location.');return}questState=data?.[0];questGame.scene=scene;const sp=QUEST_SCENES[scene].spawn;questGame.p.x=sp[0];questGame.p.y=sp[1];renderQuestAdventure();updateQuestSceneText()}
function updateQuestSceneText(){const info=QUEST_LOCATIONS[questGame.scene]||QUEST_LOCATIONS.world;$('questLocationName').textContent=info.name;$('questLocationDescription').textContent=info.description}
async function performQuestAction(action){if(questBusy||!action)return;if(action==='talk_cook'){const line="Please help! I need an egg, a bucket of milk and a pot of flour for Duke Horacio's birthday cake.";$('questPrompt').textContent=`Cook: ${line}`;await showQuestConversation([['Cook',line],['You','I will find the ingredients for you.']]);return;}const wasCompleted=Boolean(questState?.completed);questBusy=true;$('questPrompt').textContent='Working…';await new Promise(r=>setTimeout(r,650));const{data,error}=await db.rpc('cooks_assistant_action',{p_action:action});questBusy=false;if(error){toast(error.message||'You cannot do that yet.');return}questState=data?.[0];character.cooking_xp=Number(questState.cooking_xp)||0;character.gp=Number(questState.gp)||0;character.quest_points=Number(questState.quest_points)||0;renderCharacter();renderQuestAdventure();if(action==='deliver'&&questState.completed)showQuestCompletion(!wasCompleted)}
async function dropQuestItem(item){
  if(!questState||questBusy||!item)return;
  const labels={bucket:'bucket',pot:'pot',egg:'egg',milk:'bucket of milk',grain:'grain',flour:'pot of flour'};
  if(!confirm(`Drop your ${labels[item]||item}? You can collect it again.`))return;
  questBusy=true;
  const {data,error}=await db.rpc('cooks_assistant_action',{p_action:`drop_${item}`});
  questBusy=false;
  if(error){toast(error.message||'Could not drop that item. Run the updated quest SQL.');return}
  questState=data?.[0]||questState;
  renderQuestAdventure();
  showQuestDialogue(`You drop the ${labels[item]||item}.`,2200,'Narrator');
}
function showQuestCompletion(firstCompletion){
  $('questCompleteText').textContent=firstCompletion?"You have completed Cook's Assistant!":"You have replayed Cook's Assistant!";
  $('questRewardCooking').textContent=firstCompletion?'1,000':'0';
  $('questRewardGp').textContent=firstCompletion?'5,000':'0';
  $('questRewardPoints').textContent=firstCompletion?'1':'0';
  stopQuestMusic();hideQuestDialogue();$('questCompleteOverlay').classList.remove('hidden');
}
function closeQuestCompletion(){$('questCompleteOverlay').classList.add('hidden');renderQuestJournal()}
async function resetCooksAssistant(){
  if(!character||questBusy)return;
  if(!confirm('Reset Cook\'s Assistant? All temporary quest items and progress will be removed.'))return;
  questBusy=true;
  const {data,error}=await db.rpc('cooks_assistant_action',{p_action:'reset'});
  questBusy=false;
  if(error){toast('Run the updated Cook\'s Assistant SQL, then try again.');return}
  questState=data?.[0]||null;
  cancelAnimationFrame(questFrame);questFrame=null;questGame=null;Object.keys(qKeys).forEach(k=>delete qKeys[k]);questBusy=false;
  stopQuestMusic();cancelQuestDialogue(true);
  renderQuestJournal();
  toast('Cook\'s Assistant has been reset.');
}
function drawQuestGame(){const c=$('questCanvas'),x=c.getContext('2d'),scene=questGame.scene,p=questGame.p;x.clearRect(0,0,c.width,c.height);drawQuestScene(x,scene);for(const o of QUEST_SCENES[scene].objects)drawQuestObject(x,o);x.save();x.translate(p.x,p.y);x.scale(p.dir,1);x.fillStyle='#2f5b9a';x.fillRect(-10,-2,20,24);x.fillStyle='#d5aa82';x.beginPath();x.arc(0,-12,10,0,7);x.fill();x.fillStyle='#70452c';x.fillRect(-9,-22,18,7);x.fillStyle='#24221f';x.fillRect(-10,22,7,10);x.fillRect(3,22,7,10);x.restore();if(questGame.near){x.strokeStyle='#ffe06b';x.lineWidth=3;x.strokeRect(questGame.near.x-3,questGame.near.y-3,questGame.near.w+6,questGame.near.h+6)}}
function drawQuestScene(x,s){
  const t=performance.now()/1000;
  const sky='#8db9d7',grass='#6f9e4c',path='#c5aa70',water='#5b94bb';
  if(s==='world'){
    x.fillStyle=grass;x.fillRect(0,0,900,520);
    x.fillStyle=water;x.fillRect(430,0,72,520);x.strokeStyle='rgba(220,245,255,.35)';x.lineWidth=2;for(let yy=10;yy<520;yy+=24){x.beginPath();x.moveTo(438,yy+Math.sin(t*2+yy)*3);x.lineTo(494,yy+Math.sin(t*2+yy)*3);x.stroke();}
    x.fillStyle=path;x.fillRect(0,350,900,48);x.fillRect(390,0,42,520);
    // trees and hedges
    for(const [tx,ty] of [[40,80],[840,65],[760,440],[95,430],[520,55],[255,455]]){x.fillStyle='#4b7135';x.beginPath();x.arc(tx,ty,24,0,7);x.fill();x.fillStyle='#76502d';x.fillRect(tx-5,ty+18,10,26)}
    // small Lumbridge castle
    x.fillStyle='#c8c3b7';x.fillRect(350,270,150,120);x.fillStyle='#98958c';x.fillRect(365,238,34,45);x.fillRect(450,238,34,45);x.fillStyle='#6d6a65';for(let i=0;i<4;i++){x.fillRect(350+i*42,258,22,18)}x.fillStyle='#49372b';x.fillRect(410,330,34,60);x.fillStyle='#78a7d1';x.fillRect(375,300,18,25);x.fillRect(458,300,18,25);
    // cellar hatch
    x.fillStyle='#4a3424';x.fillRect(330,432,100,65);x.strokeStyle='#b58a52';x.strokeRect(342,444,76,42);
    // general store
    x.fillStyle='#a97849';x.fillRect(570,330,115,88);x.fillStyle='#6d3e2b';x.beginPath();x.moveTo(558,330);x.lineTo(628,285);x.lineTo(698,330);x.fill();x.fillStyle='#3b281d';x.fillRect(615,365,26,53);x.fillStyle='#e2c26f';x.fillRect(580,342,32,22);
    // chicken coop
    x.fillStyle='#9b6e3f';x.fillRect(690,125,130,95);x.strokeStyle='#684727';for(let i=0;i<6;i++)x.strokeRect(700+i*18,135,12,70);x.fillStyle='#73462e';x.fillRect(742,150,26,70);
    // cow field fence
    x.strokeStyle='#8c6638';x.lineWidth=5;x.strokeRect(585,75,150,100);for(let i=0;i<4;i++)x.strokeRect(595+i*36,85,4,80);
    // wheat field
    x.fillStyle='#c6ad3a';x.fillRect(210,105,165,115);x.strokeStyle='#e7cf62';x.lineWidth=2;for(let i=0;i<14;i++){let wx=218+(i*11)%150;x.beginPath();x.moveTo(wx,210);x.lineTo(wx-4,130+(i%3)*10);x.stroke()}
    // mill
    x.fillStyle='#ded3bd';x.fillRect(95,95,85,120);x.fillStyle='#81583d';x.beginPath();x.moveTo(80,95);x.lineTo(138,55);x.lineTo(195,95);x.fill();x.strokeStyle='#6a533d';x.lineWidth=5;x.beginPath();x.moveTo(138,95);x.lineTo(138,25);x.stroke();for(let a=0;a<4;a++){x.save();x.translate(138,70);x.rotate(a*Math.PI/2);x.fillStyle='#e9dfc9';x.fillRect(0,-5,62,10);x.restore()}
  }else{
    const base={kitchen:'#9a744c',cellar:'#55514c',store:'#9a7a54',chicken:'#82a854',cows:'#79a451',wheat:'#b9a13d',mill:'#92734e'}[s];x.fillStyle=base;x.fillRect(0,0,900,520);
    if(s==='kitchen'){x.fillStyle='#7d5a38';for(let i=0;i<8;i++)x.fillRect(i*120,0,4,520);x.fillStyle='#b78b58';x.fillRect(370,245,220,70);x.fillStyle='#5c3d27';x.fillRect(600,90,185,95);x.fillStyle='#d8c5a2';x.fillRect(635,120,80,35);x.fillStyle='#c24c3a';x.beginPath();x.arc(675,112,28,Math.PI,0);x.fill();}
    if(s==='cellar'){x.fillStyle='#3d3a36';for(let y=0;y<520;y+=44)for(let xx=0;xx<900;xx+=90)x.strokeRect(xx+(y/44%2)*45,y,90,44);x.fillStyle='#6f4d2d';x.fillRect(430,250,170,95);x.fillStyle='#2f261f';x.fillRect(50,420,110,80)}
    if(s==='store'){x.fillStyle='#6d4c32';x.fillRect(560,80,250,250);for(let y=105;y<310;y+=65){x.fillStyle='#3b2b20';x.fillRect(580,y,210,10);for(let xx=600;xx<770;xx+=55){x.fillStyle=['#c9a652','#8fb1c8','#c67750'][(xx+y)%3];x.fillRect(xx,y-28,24,28)}}x.fillStyle='#5a3e29';x.fillRect(620,350,170,65)}
    if(s==='chicken'){x.fillStyle='#78502d';x.fillRect(420,170,260,210);x.strokeStyle='#d4b074';x.lineWidth=5;for(let i=0;i<9;i++)x.strokeRect(430+i*28,180,5,180);for(const [cx,cy] of [[520,320],[600,260],[690,350]]){x.fillStyle='#f1efe8';x.beginPath();x.arc(cx,cy,18,0,7);x.fill();x.fillStyle='#d79a2e';x.fillRect(cx+15,cy-4,12,7);x.fillStyle='#d53a2c';x.fillRect(cx-4,cy-25,8,10)}}
    if(s==='cows'){x.fillStyle='#6a9449';x.fillRect(0,0,900,520);x.strokeStyle='#8b6437';x.lineWidth=5;x.strokeRect(70,65,760,390);for(let i=0;i<10;i++)x.strokeRect(90+i*70,75,5,370);drawCow(x,650,275,1)}
    if(s==='wheat'){x.fillStyle='#c2aa40';x.fillRect(0,0,900,520);x.strokeStyle='#ead56b';x.lineWidth=2;for(let i=0;i<120;i++){const wx=(i*71)%900,wy=80+(i*43)%410;x.beginPath();x.moveTo(wx,wy+24);x.lineTo(wx-4,wy);x.stroke();x.beginPath();x.moveTo(wx-4,wy+8);x.lineTo(wx-12,wy+2);x.moveTo(wx-4,wy+12);x.lineTo(wx+5,wy+5);x.stroke()}}
    if(s==='mill'){x.fillStyle='#ded0b5';x.fillRect(80,55,740,420);x.strokeStyle='#7b6247';x.lineWidth=4;for(let y=110;y<470;y+=90)x.strokeRect(80,y,740,4);x.fillStyle='#755238';x.fillRect(575,90,160,80);x.fillStyle='#c7a96b';x.beginPath();x.moveTo(600,90);x.lineTo(655,45);x.lineTo(710,90);x.fill();x.fillStyle='#70502f';x.fillRect(740,160,18,110);x.fillStyle='#84633f';x.fillRect(530,330,150,90)}
  }
  // Ambient motes make each area feel less static.
  x.fillStyle='rgba(255,238,170,.45)';for(let i=0;i<12;i++){const px=(i*83+t*18)%900,py=55+((i*47+t*10)%420);x.fillRect(px,py,2,2)}
  updateQuestSceneText();
}
function drawCow(x,cx,cy,dir=1){x.save();x.translate(cx,cy);x.scale(dir,1);x.fillStyle='#eee8da';x.fillRect(-42,-22,76,45);x.fillStyle='#2f2d2a';x.fillRect(-32,-18,23,19);x.fillRect(5,0,20,18);x.fillStyle='#eee8da';x.fillRect(30,-30,34,31);x.fillStyle='#2f2d2a';x.fillRect(43,-22,10,10);x.fillStyle='#c6b69f';x.fillRect(-32,22,9,27);x.fillRect(15,22,9,27);x.strokeStyle='#6f522e';x.beginPath();x.arc(52,-29,9,0,Math.PI);x.stroke();x.fillStyle='#d5aa3d';x.beginPath();x.arc(51,3,6,0,7);x.fill();x.restore()}
function drawCook(x,cx,cy){
  x.save();x.translate(cx,cy);
  if(questCookImage.complete&&questCookImage.naturalWidth){
    x.imageSmoothingEnabled=false;
    x.drawImage(questCookImage,-42,-58,84,100);
  }else{
    x.fillStyle='#f4f0e6';x.beginPath();x.arc(0,-31,24,Math.PI,0);x.fill();x.fillRect(-23,-31,46,15);x.fillStyle='#d2a17d';x.beginPath();x.arc(0,-13,16,0,7);x.fill();x.fillStyle='#eee9dd';x.fillRect(-18,2,36,43);
  }
  x.restore();
}
function drawQuestObject(x,o){
  if(o.action==='talk_cook'){drawCook(x,o.x+o.w/2,o.y+o.h/2+5);return}
  if(o.action==='milk_cow'){drawCow(x,o.x+o.w/2,o.y+o.h/2,1);return}
  if(o.action==='buy_supplies'){const cx=o.x+o.w/2,cy=o.y+o.h/2;x.save();x.translate(cx,cy);x.fillStyle='#d3a47e';x.beginPath();x.arc(0,-18,15,0,7);x.fill();x.fillStyle='#5a351f';x.fillRect(-14,-34,28,9);x.fillStyle='#58733d';x.fillRect(-20,-2,40,38);x.fillStyle='#d6bb70';x.fillRect(-22,36,44,8);x.restore();return}
  if(o.action==='take_egg'){x.fillStyle='#f5efe0';x.beginPath();x.ellipse(o.x+o.w/2,o.y+o.h/2,13,18,0,0,7);x.fill();return}
  if(o.action==='take_bucket'){x.fillStyle='#b9b7ad';x.fillRect(o.x+8,o.y+10,o.w-16,o.h-14);x.strokeStyle='#4d4d49';x.strokeRect(o.x+8,o.y+10,o.w-16,o.h-14);x.beginPath();x.arc(o.x+o.w/2,o.y+12,o.w/2-8,Math.PI,0);x.stroke();return}
  if(o.action==='take_pot'){x.fillStyle='#b98c5f';x.beginPath();x.ellipse(o.x+o.w/2,o.y+o.h/2,o.w/2-4,o.h/2-5,0,0,7);x.fill();x.fillStyle='#66442a';x.fillRect(o.x+3,o.y+8,o.w-6,6);return}
  if(o.action==='pick_grain'){x.strokeStyle='#f0d86a';for(let i=0;i<12;i++){let xx=o.x+8+i*14;x.beginPath();x.moveTo(xx,o.y+o.h);x.lineTo(xx-4,o.y+20+(i%3)*12);x.stroke()}return}
  const colors={portal:'#6c4d2b',exit:'#3c2d1e',action:'#d7b45b'};x.fillStyle=colors[o.type]||'#fff';x.fillRect(o.x,o.y,o.w,o.h);x.strokeStyle='#2d2114';x.lineWidth=3;x.strokeRect(o.x,o.y,o.w,o.h);x.fillStyle='#17110b';x.font='bold 13px sans-serif';x.textAlign='center';x.fillText(o.label,o.x+o.w/2,o.y+o.h/2+5)
}
// PET WARS — 15-second server-resolved, 50/50 pet wrestling.
let petWarState=null,petWarPollTimer=null,petWarAnimationTimer=null,petWarResolving=false;
const PET_WAR_LOCATIONS={misthalin:'Misthalin · Lumbridge wrestling paddock',asgarnia:'Asgarnia · Falador training ring',kandarin:'Kandarin · Tree Gnome arena',morytania:'Morytania · Canifis night cage'};
const PET_WAR_LINES=['A tiny headbutt lands!','Both pets are pretending this is serious.','A suspiciously powerful paw swipe!','The referee has lost control.','One pet attempts an illegal belly flop.','The crowd chants for absolutely no reason.','A devastatingly cute tackle!','Neither pet understands the rules.'];
function validPetWarWager(value){const n=Math.floor(Number(value));return Number.isFinite(n)&&n>=1&&n<=1000?n:0}
async function openPetWars(){
  if(!character){toast('Log in to enter Pet Wars.');openCharacterDialog('login');return}
  $('petWarsDialog').showModal();$('petWarsLobby').classList.remove('hidden');$('petWarsFight').classList.add('hidden');$('petWarsLobbyMessage').textContent='Loading your pet and GP…';
  const [bank,pet]=await Promise.all([db.rpc('get_my_bank'),db.rpc('get_my_active_pet')]);
  if(bank.error||pet.error){$('petWarsLobbyMessage').textContent='Could not load Pet Wars. Run update-pet-wars.sql in Supabase.';return}
  const gp=Number(bank.data?.[0]?.gp||0),petId=pet.data?.[0]?.active_pet,meta=PET_CATALOG[petId];
  $('petWarsGp').textContent=`${gp.toLocaleString('en-GB')} GP`;$('petWarsMyPet').textContent=meta?(pet.data?.[0]?.pet_names?.[petId]||meta.name):'No pet out';
  $('petWarsCreate').disabled=!meta;$('petWarsJoin').disabled=!meta;$('petWarsLobbyMessage').textContent=meta?'Create a fight or enter a six-character code.':'Put a pet out from your Bank before entering Pet Wars.';
}
async function createPetWar(){
  const wager=validPetWarWager($('petWarsCreateWager').value);if(!wager){$('petWarsLobbyMessage').textContent='Choose a wager between 1 and 1,000 GP.';return}
  $('petWarsCreate').disabled=true;$('petWarsLobbyMessage').textContent='Booking the wrestling arena… Any abandoned waiting fight will be cancelled and refunded.';
  const {data,error}=await db.rpc('create_pet_war',{p_wager:wager,p_pick_mine:$('petWarsCreatePick').value==='mine'});$('petWarsCreate').disabled=false;
  if(error||!data?.[0]){$('petWarsLobbyMessage').textContent=error?.message||'Could not create the fight.';return}await enterPetWar(data[0].room_code);
}
async function joinPetWar(){
  const code=$('petWarsCodeInput').value.trim().toUpperCase(),wager=validPetWarWager($('petWarsJoinWager').value);if(code.length!==6){$('petWarsLobbyMessage').textContent='Enter the six-character fight code.';return}if(!wager){$('petWarsLobbyMessage').textContent='Choose a wager between 1 and 1,000 GP.';return}
  $('petWarsJoin').disabled=true;$('petWarsLobbyMessage').textContent='Entering the arena…';const {data,error}=await db.rpc('join_pet_war',{p_room_code:code,p_wager:wager,p_pick_mine:$('petWarsJoinPick').value==='mine'});$('petWarsJoin').disabled=false;if(error){$('petWarsLobbyMessage').textContent=error.message||'Could not join that fight.';return}await enterPetWar(code);
}
async function enterPetWar(code){petWarState={code};$('petWarsLobby').classList.add('hidden');$('petWarsFight').classList.remove('hidden');$('petWarsCode').textContent=code;clearInterval(petWarPollTimer);await pollPetWar();petWarPollTimer=setInterval(pollPetWar,500)}
async function pollPetWar(){
  if(!petWarState||petWarResolving)return;const {data,error}=await db.rpc('get_pet_war',{p_room_code:petWarState.code});if(error||!data?.[0]){$('petWarsFightMessage').textContent=error?.message||'Fight unavailable.';return}petWarState={...data[0],code:petWarState.code};renderPetWar();
  if(petWarState.status==='fighting'){const elapsed=(Date.now()-new Date(petWarState.started_at).getTime())/1000;if(elapsed>=15&&!petWarResolving){petWarResolving=true;await db.rpc('resolve_pet_war',{p_room_code:petWarState.code});petWarResolving=false}}
}
function renderPetWar(){
  const w=petWarState,arena=$('petWarsArena'),hMeta=PET_CATALOG[w.host_pet],gMeta=PET_CATALOG[w.guest_pet];$('petWarsCode').textContent=w.room_code||w.code;$('petWarsLocation').textContent=PET_WAR_LOCATIONS[w.location]||w.location;arena.className=`pet-wars-arena location-${w.location}`;
  const host=$('petWarsHost'),guest=$('petWarsGuest');host.querySelector('.pet-war-visual').innerHTML=petMarkup(w.host_pet,w.host_pet_name||hMeta?.name||'Host pet','pet-war-art',w.host_pet_cosmetic);guest.querySelector('.pet-war-visual').innerHTML=petMarkup(w.guest_pet,w.guest_pet_name||gMeta?.name||'Guest pet','pet-war-art',w.guest_pet_cosmetic);host.querySelector('.pet-war-name').textContent=w.host_pet_name||hMeta?.name||'Host pet';guest.querySelector('.pet-war-name').textContent=w.guest_pet_name||gMeta?.name||'Guest pet';host.querySelector('.pet-war-owner').textContent=w.host_username;guest.querySelector('.pet-war-owner').textContent=w.guest_username||'Waiting for challenger';
  $('petWarsHostBet').textContent=`${w.host_username}: ${Number(w.host_wager||0).toLocaleString('en-GB')} GP · backed ${Number(w.host_pick)===1?'host':'guest'}`;$('petWarsGuestBet').textContent=w.guest_username?`${w.guest_username}: ${Number(w.guest_wager||0).toLocaleString('en-GB')} GP · backed ${Number(w.guest_pick)===1?'host':'guest'}`:'Waiting for player two…';
  $('petWarsCancel').classList.toggle('hidden',w.status!=='waiting'||w.host_username!==character.username);
  if(w.status==='waiting'){$('petWarsTimer').textContent='15.0';$('petWarsCommentary').textContent=`Share code ${w.room_code||w.code} with another player.`;$('petWarsFightMessage').textContent='Your wager is safely held until someone joins, or you cancel.';return}
  if(w.status==='fighting'){arena.classList.add('fighting');const elapsed=Math.max(0,(Date.now()-new Date(w.started_at).getTime())/1000),remaining=Math.max(0,15-elapsed);$('petWarsTimer').textContent=remaining.toFixed(1);$('petWarsFightMessage').textContent='A random winner will be selected when the bell rings.';if(!petWarAnimationTimer){let i=0;$('petWarsCommentary').textContent=PET_WAR_LINES[0];petWarAnimationTimer=setInterval(()=>{$('petWarsCommentary').textContent=PET_WAR_LINES[++i%PET_WAR_LINES.length]},1500)}return}
  clearInterval(petWarAnimationTimer);petWarAnimationTimer=null;arena.classList.add('finished');const winner=Number(w.winner_slot),mine=w.host_username===character.username?1:2,payout=mine===1?Number(w.host_payout||0):Number(w.guest_payout||0);host.classList.toggle('winner',winner===1);host.classList.toggle('loser',winner===2);guest.classList.toggle('winner',winner===2);guest.classList.toggle('loser',winner===1);$('petWarsTimer').textContent='0.0';$('petWarsCommentary').textContent=`${winner===1?(w.host_pet_name||hMeta?.name):(w.guest_pet_name||gMeta?.name)} WINS!`;$('petWarsFightMessage').textContent=payout>0?`Correct pick — you received ${payout.toLocaleString('en-GB')} GP!`:'Wrong pick — better luck in the next ridiculous fight.';clearInterval(petWarPollTimer);petWarPollTimer=null;
}
async function cancelPetWar(){if(!petWarState)return;const {error}=await db.rpc('cancel_pet_war',{p_room_code:petWarState.code});if(error){$('petWarsFightMessage').textContent=error.message;return}leavePetWar();await openPetWars()}
function leavePetWar(){clearInterval(petWarPollTimer);clearInterval(petWarAnimationTimer);petWarPollTimer=petWarAnimationTimer=null;petWarState=null;$('petWarsFight').classList.add('hidden');$('petWarsLobby').classList.remove('hidden');if($('petWarsDialog').open)$('petWarsDialog').close()}


// ---- Daily Rune-Dle ----
const RUNEDLE_WORDS = new Set(['abbey', 'abyss', 'acorn', 'adept', 'aggie', 'aggro', 'airut', 'altar', 'ankou', 'anvil', 'ardou', 'arrow', 'asgyn', 'ashes', 'bacon', 'bagel', 'baler', 'barbs', 'barge', 'baron', 'basil', 'batta', 'bears', 'beast', 'berry', 'black', 'blade', 'bless', 'blood', 'blunt', 'bolts', 'bones', 'boots', 'bowfa', 'brawl', 'bread', 'briar', 'brine', 'broad', 'burgh', 'burnt', 'cabin', 'cache', 'camel', 'canif', 'canoe', 'capes', 'caves', 'chain', 'chaos', 'chest', 'claws', 'cloak', 'coals', 'coins', 'crate', 'crawl', 'crown', 'crude', 'crypt', 'dagga', 'dairy', 'darts', 'death', 'demon', 'dhide', 'dough', 'drayn', 'dwarf', 'eagle', 'earth', 'elder', 'emote', 'equip', 'fairy', 'falad', 'felix', 'ferox', 'fiend', 'fires', 'flesh', 'flint', 'flite', 'forge', 'fremy', 'games', 'ghost', 'giant', 'gnome', 'golem', 'grace', 'grave', 'green', 'grimy', 'guild', 'hally', 'harpy', 'helms', 'herbs', 'hound', 'house', 'ibans', 'infer', 'irons', 'jagex', 'jatis', 'javel', 'jelly', 'karam', 'kebab', 'kings', 'knife', 'lamps', 'lavae', 'leafs', 'light', 'longs', 'lunar', 'maces', 'magic', 'maple', 'masks', 'melee', 'mossy', 'nails', 'nieve', 'night', 'ninja', 'noose', 'ogres', 'osman', 'paddy', 'panic', 'paper', 'party', 'plank', 'quest', 'relic', 'runes', 'sabre', 'scape', 'seers', 'shade', 'shard', 'shark', 'sheep', 'skull', 'smoke', 'snake', 'snare', 'spear', 'spell', 'staff', 'steel', 'stews', 'stone', 'swamp', 'sword', 'talon', 'taver', 'tears', 'thief', 'toads', 'torag', 'tower', 'traps', 'troll', 'ulric', 'vials', 'vorki', 'water', 'whale', 'white', 'witch', 'xeric', 'zamor', 'zaros', 'armor', 'arena', 'badge', 'basic', 'batch', 'blink', 'block', 'bonus', 'bossy', 'bount', 'build', 'class', 'combo', 'craft', 'crits', 'daily', 'dodge', 'drops', 'elite', 'evade', 'event', 'farms', 'fangs', 'fight', 'gamer', 'grind', 'heals', 'items', 'level', 'lucky', 'raids', 'reset', 'skill', 'spawn', 'stats', 'tanky', 'trade', 'train', 'vault', 'world', 'brand', 'cross', 'curse', 'flail', 'lance', 'mauls', 'pikes', 'saber', 'sling', 'auras', 'charm', 'druid', 'elven', 'faery', 'flame', 'frost', 'glyph', 'hexes', 'power', 'runic', 'storm', 'wards', 'angel', 'boars', 'drake', 'gnoll', 'hydra', 'mimic', 'pixie', 'slime', 'wyrms', 'biome', 'coast', 'delve', 'haven', 'isles', 'marsh', 'mines', 'realm', 'ruins', 'sewer', 'trail', 'woods', 'baggy', 'elixr', 'flask', 'jewel', 'pouch', 'rings', 'robes', 'tonic', 'smith', 'group', 'rival', 'squad', 'patch', 'specs', 'words', 'brave', 'dream', 'glory', 'honor', 'rogue', 'royal', 'acoly', 'actor', 'aegis', 'amber', 'anima', 'atlas', 'blaze', 'brute', 'burst', 'cairn', 'chief', 'coral', 'coven', 'creep', 'ember', 'enemy', 'fetch', 'guard', 'heavy', 'horde', 'karma', 'magma', 'mount', 'ocean', 'titan', 'arise', 'diver', 'acted', 'agent', 'alert', 'blast', 'bleed', 'boost', 'bound', 'break', 'brews', 'campy', 'chant', 'clash', 'climb', 'clone', 'dance', 'drain', 'duels', 'feast', 'focus', 'haste', 'joust', 'lobby', 'merge', 'myths', 'nerfs', 'phase', 'prize', 'procs', 'ranks', 'rifts', 'roles', 'round', 'siege', 'skins', 'slots', 'sneak', 'stage', 'stuns', 'taunt', 'teams', 'token', 'waves']);
const runeDleMusic = new Audio('assets/isle-of-serenity.mp3');
runeDleMusic.loop = true;
runeDleMusic.volume = 0.42;
function startRuneDleMusic(){
  try { if (runeDleMusic.paused) { runeDleMusic.currentTime = 0; runeDleMusic.play().catch(() => {}); } } catch (_) {}
}
function stopRuneDleMusic(){
  try { runeDleMusic.pause(); runeDleMusic.currentTime = 0; } catch (_) {}
}
const RUNEDLE_ROWS = ['QWERTYUIOP','ASDFGHJKL','ZXCVBNM'];
let runeDleState = null;
function buildRuneDleUi(){
  const board=$('runedleBoard'); if(!board||board.children.length)return;
  for(let r=0;r<5;r++){const row=document.createElement('div');row.className='runedle-row';for(let c=0;c<5;c++){const tile=document.createElement('div');tile.className='runedle-tile';row.appendChild(tile)}board.appendChild(row)}
  const keyboard=$('runedleKeyboard'); RUNEDLE_ROWS.forEach(chars=>{const row=document.createElement('div');row.className='runedle-key-row';[...chars].forEach(letter=>{const b=document.createElement('button');b.type='button';b.textContent=letter;b.dataset.key=letter;b.onclick=()=>{const input=$('runedleGuess');if(!input.disabled&&input.value.length<5)input.value+=letter;input.focus()};row.appendChild(b)});keyboard.appendChild(row)});
}
function runeDleMessage(text,isError=false){const el=$('runedleMessage');el.textContent=text;el.classList.toggle('error',isError)}
function renderRuneDle(){
  buildRuneDleUi(); const attempts=runeDleState?.attempts||[]; const rows=[...$('runedleBoard').children];
  rows.forEach((row,r)=>[...row.children].forEach((tile,c)=>{tile.className='runedle-tile';tile.textContent='';const a=attempts[r];if(a){tile.textContent=a.guess[c]||'';tile.classList.add('filled',a.pattern[c]==='g'?'correct':a.pattern[c]==='y'?'present':'absent')}}));
  const priority={absent:1,present:2,correct:3}, keyState={};
  attempts.forEach(a=>{
    const guess=String(a?.guess||'').toLowerCase();
    const pattern=Array.isArray(a?.pattern)?a.pattern.join('').toLowerCase():String(a?.pattern||'').toLowerCase();
    [...guess].forEach((ch,i)=>{
      const mark=pattern[i];
      const state=mark==='g'?'correct':mark==='y'?'present':'absent';
      // Keep the strongest known state for a letter. Keys are always lowercase,
      // matching the keyboard data lookup even though saved guesses display uppercase.
      if((priority[state]||0)>(priority[keyState[ch]]||0))keyState[ch]=state;
    });
  });
  $('runedleKeyboard').querySelectorAll('[data-key]').forEach(b=>{
    const state=keyState[b.dataset.key.toLowerCase()]||'';
    b.classList.remove('correct','present','absent');
    if(state)b.classList.add(state);
    // Letters proven not to be in today's word are removed from play.
    b.disabled=state==='absent';
    b.setAttribute('aria-disabled',state==='absent'?'true':'false');
    b.title=state==='correct'?'Correct letter and position':state==='present'?'Letter is in the word, but in a different position':state==='absent'?'Letter is not in today’s word':'';
  });
  const finished=!!runeDleState?.finished; $('runedleGuess').disabled=!character||finished; $('runedleSubmit').disabled=!character||finished;
  $('runedleLogin').classList.toggle('hidden',!!character); $('runedleFinish').classList.toggle('hidden',!finished);
  if($('runedleStreak')) $('runedleStreak').textContent=Number(runeDleState?.current_streak)||0;if($('runedleBestStreak')) $('runedleBestStreak').textContent=Number(runeDleState?.best_streak)||0;if(finished){const solved=!!runeDleState.solved;$('runedleFinishTitle').textContent=solved?'FARM RUN COMPLETE!':'PATCH MISSED';$('runedleFinishText').textContent=solved?`Solved in ${attempts.length}/5 attempts — 10,000 GP and 20,000 Farming XP awarded.`:`Today's word was ${String(runeDleState.answer||'').toUpperCase()}. Consolation: 1,000 GP and 2,000 Farming XP.`;runeDleMessage('Come back tomorrow for another Daily Farm Run.')}
  else runeDleMessage(character?`${5-attempts.length} attempt${5-attempts.length===1?'':'s'} remaining.`:'Log in to submit a guess.');
}
async function loadRuneDleState(){
  runeDleState={attempts:[],solved:false,finished:false,current_streak:0,best_streak:0};
  if(character){const{data,error}=await db.rpc('get_my_runedle_state');if(error){console.error(error);runeDleMessage('Run add-daily-farm-run.sql in Supabase first.',true)}else runeDleState=data?.[0]||runeDleState}
  renderRuneDle(); await loadRuneDleLeaderboard();
}
async function loadRuneDleLeaderboard(){const box=$('runedleLeaderboard');box.textContent='Loading…';const{data,error}=await db.rpc('get_daily_runedle_results');if(error){box.textContent='Daily results become available after running add-daily-farm-run.sql.';return}if(!data?.length){box.textContent='Nobody has started this Farm Run yet.';return}box.innerHTML=data.map(r=>`<div class="runedle-result-row ${r.status}"><b>${escapeHtml(r.username)}</b><span>${r.attempts} / 5</span><strong>${r.status==='solved'?'SOLVED':r.status==='failed'?'FAILED':'PLAYING'}</strong></div>`).join('')}
let runeDleCountdownTimer=null;
function updateRuneDleCountdown(){
  const el=$('runedleCountdown'); if(!el)return;
  const now=Date.now(),slot=12*60*60*1000,next=(Math.floor(now/slot)+1)*slot,remaining=Math.max(0,next-now);
  const h=String(Math.floor(remaining/3600000)).padStart(2,'0'),m=String(Math.floor((remaining%3600000)/60000)).padStart(2,'0'),s=String(Math.floor((remaining%60000)/1000)).padStart(2,'0');
  el.textContent=`${h}:${m}:${s}`;
}
function startRuneDleCountdown(){updateRuneDleCountdown();clearInterval(runeDleCountdownTimer);runeDleCountdownTimer=setInterval(updateRuneDleCountdown,1000)}
function stopRuneDleCountdown(){clearInterval(runeDleCountdownTimer);runeDleCountdownTimer=null}
async function openRuneDle(){$('runedleDialog').showModal();startRuneDleMusic();startRuneDleCountdown();await loadRuneDleState();setTimeout(()=>$('runedleGuess').focus(),80)}
async function submitRuneDle(event){event.preventDefault();if(!character){setAuthMode('login');$('characterDialog').showModal();return}const input=$('runedleGuess'),guess=input.value.trim().toLowerCase();if(guess.length!==5){runeDleMessage('Enter exactly five letters.',true);return}if(!RUNEDLE_WORDS.has(guess)){runeDleMessage('That word is not in the Rune-Dle list.',true);return}$('runedleSubmit').disabled=true;const{data,error}=await db.rpc('submit_runedle_guess',{p_guess:guess});$('runedleSubmit').disabled=false;if(error){runeDleMessage(error.message,true);return}const result=data?.[0];if(!result)return;if(result.finished){character.gp=Number(result.new_gp)||Number(character.gp)||0;character.farming_xp=Number(result.new_farming_xp)||Number(character.farming_xp)||0;if(result.achievements)achievementState=result.achievements;if(result.achievement_unlocked){toast('Achievement complete: Patch Perfect — Odd Spectacles added to your Bank!',5000);renderAchievements();}renderCharacter();toast(result.solved?'Farm Run complete: +10,000 GP and +20,000 Farming XP!':'Farm Run failed: +1,000 GP and +2,000 Farming XP.',5000)}input.value='';await loadRuneDleState();const row=[...$('runedleBoard').children][Math.max(0,Number(result.attempt_no)-1)];row?.querySelectorAll('.runedle-tile').forEach((tile,i)=>{tile.classList.add('reveal');tile.style.animationDelay=`${i*80}ms`})}

let harmonyAudioContext = null;
let lastHarmonyToneAt = 0;
function playHarmonyEffect() {
  const button = $('can');
  button.classList.remove('pop', 'harmonizing');
  void button.offsetWidth;
  button.classList.add('pop', 'harmonizing');
  clearTimeout(button._harmonyTimer);
  button._harmonyTimer = setTimeout(() => button.classList.remove('harmonizing'), 520);

  // A quiet, short major chord. Throttled so rapid clicks stay pleasant.
  const now = performance.now();
  if (now - lastHarmonyToneAt < 90) return;
  lastHarmonyToneAt = now;
  try {
    harmonyAudioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    const ctx = harmonyAudioContext;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const start = ctx.currentTime;
    [523.25, 659.25, 783.99].forEach((frequency, index) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.026 - index * 0.004, start + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.26);
      oscillator.connect(gain).connect(ctx.destination);
      oscillator.start(start + index * 0.012);
      oscillator.stop(start + 0.28);
    });
  } catch (_) {}
}

const harmonySoundToggle = $('harmonySoundToggle');
let harmonySoundEnabled = localStorage.getItem('repoHarmonySound') !== 'off';
if (harmonySoundToggle) {
  harmonySoundToggle.checked = harmonySoundEnabled;
  harmonySoundToggle.addEventListener('change', () => {
    harmonySoundEnabled = harmonySoundToggle.checked;
    localStorage.setItem('repoHarmonySound', harmonySoundEnabled ? 'on' : 'off');
    if (harmonySoundEnabled) playHarmonyEffect();
  });
}
$('can').onclick = async () => {
  if (harmonySoundEnabled) { playClickSound(); playHarmonyEffect(); }
  else {
    const button=$('can');
    button.classList.remove('harmonizing');
    void button.offsetWidth;
    button.classList.add('harmonizing');
    setTimeout(()=>button.classList.remove('harmonizing'),520);
  }
  await changeCount(1);
};
const confirmResetButton = $('confirm');
if (confirmResetButton) confirmResetButton.onclick = () => resetCount();
function setAuthMode(mode) {
  authMode = mode;
  const isLogin = mode === 'login';
  $('showLogin').classList.toggle('active', isLogin);
  $('showRegister').classList.toggle('active', !isLogin);
  $('authSubmit').textContent = isLogin ? 'LOG IN' : 'CREATE ACCOUNT';
  $('password').autocomplete = isLogin ? 'current-password' : 'new-password';
  $('characterError').textContent = '';
}


const authClickSound=new Audio('denielcz-immersivecontrol-button-click-sound-463065.mp3');
authClickSound.preload='auto';
authClickSound.volume=1;
function playAuthClick(){try{authClickSound.pause();authClickSound.currentTime=0;authClickSound.play().catch(()=>{});}catch(e){}}

// Play the full-volume interface click on every main adventure menu button.
document.querySelectorAll('.game-strip button').forEach(button => {
  button.addEventListener('click', playAuthClick);
});

// Header Bank and Skills controls use the same full-volume interface click.
['openBank','openSkills','openPets'].forEach(id => {
  const button = $(id);
  if (button) button.addEventListener('click', playAuthClick);
});

$('createCharacter').onclick = () => {
  playAuthClick();
  setAuthMode('login');
  $('username').value = '';
  $('password').value = '';
  $('characterDialog').showModal();
};
$('showLogin').onclick = () => { playAuthClick(); setAuthMode('login'); };
$('showRegister').onclick = () => { playAuthClick(); setAuthMode('register'); };
$('characterSummary').onclick = openSkills;


// ---- Achievement log ----
let achievementState={};
const ACHIEVEMENTS={
  cooking_serve_5:{group:'Gnome Kitchen Chaos',title:'Kitchen Table Service',description:'Serve 5 tables within Gnome Kitchen Chaos.',reward:'Chef\'s hat'}
};
function renderAchievements(){
  const done=!!achievementState?.cooking_serve_5;
  const jadDone=!!achievementState?.jad_insane_complete;
  const runeDleDone=!!achievementState?.runedle_success;
  const infernoVeteran=!!achievementState?.combat_inferno_veteran;
  const infernoInsane=!!achievementState?.combat_inferno_insane;
  const lumbridgeVeteran=!!achievementState?.combat_lumbridge_veteran;
  const lumbridgeInsane=!!achievementState?.combat_lumbridge_insane;
  const row=$('achievementCookingServe5');
  if(row){
    row.classList.toggle('completed',done);
    const check=row.querySelector('.achievement-check');
    const status=row.querySelector('.achievement-status');
    if(check)check.textContent=done?'✓':'○';
    if(status)status.textContent=done?'COMPLETED':'NOT COMPLETE';
  }
  const jadRow=$('achievementJadInsane');
  if(jadRow){jadRow.classList.toggle('completed',jadDone);jadRow.querySelector('.achievement-check').textContent=jadDone?'✓':'○';jadRow.querySelector('.achievement-status').textContent=jadDone?'COMPLETE':'NOT COMPLETE';}
  const runeRow=$('achievementRuneDleSuccess');
  if(runeRow){runeRow.classList.toggle('completed',runeDleDone);runeRow.querySelector('.achievement-check').textContent=runeDleDone?'✓':'○';runeRow.querySelector('.achievement-status').textContent=runeDleDone?'COMPLETE':'NOT COMPLETE';}
  [['achievementInfernoVeteran',infernoVeteran],['achievementInfernoInsane',infernoInsane],['achievementLumbridgeVeteran',lumbridgeVeteran],['achievementLumbridgeInsane',lumbridgeInsane]].forEach(([id,isDone])=>{const el=$(id);if(!el)return;el.classList.toggle('completed',isDone);el.querySelector('.achievement-check').textContent=isDone?'✓':'○';el.querySelector('.achievement-status').textContent=isDone?'COMPLETE':'NOT COMPLETE';});
  $('achievementLoginNotice')?.classList.toggle('hidden',!!character);
  if($('achievementMessage'))$('achievementMessage').textContent=(done||jadDone||runeDleDone||infernoVeteran||infernoInsane||lumbridgeVeteran||lumbridgeInsane)?'Unlocked rewards are stored permanently in your Bank.':'Complete an achievement to tick it off permanently.';
}
async function loadAchievements(){
  achievementState={};
  if(!character){renderAchievements();return;}
  const {data,error}=await db.rpc('get_my_achievements');
  if(error){console.error('Could not load achievements.',error);if($('achievementMessage'))$('achievementMessage').textContent='Could not load achievements. Run update-achievements.sql in Supabase.';renderAchievements();return;}
  achievementState=data?.[0]?.achievements||{};
  renderAchievements();
}
async function openAchievements(){
  $('achievementsDialog').showModal();
  if(!character){renderAchievements();return;}
  if($('achievementMessage'))$('achievementMessage').textContent='Loading achievement log…';
  await loadAchievements();
}

// ---- Gnome Kitchen Chaos (RuneScape-themed online cooking minigame) ----
let cookingMode='solo', cookingRunning=false, cookingRAF=null, cookingLast=0, cookingState=null;
let cookingNet={channel:null,role:null,roomCode:'',guest:null,connected:false,lastBroadcast:0,joinTimer:null,remoteKeys:new Set(),targetState:null};
const cookingKeys=new Set();
const COOK_TILE=64, COOK_COLS=15, COOK_ROWS=8;
const COOK_RECIPES=[
 {name:'Crab & Herb',need:['crab','herb'],xp:220,score:320},
 {name:'Golden Crab Feast',need:['golden_crab','potato'],xp:300,score:430},
 {name:'Sea Urchin Pie',need:['urchin','flour'],xp:340,score:500},
 {name:'Karambwan Bowl',need:['karambwan','herb'],xp:280,score:390},
 {name:'Shark Platter',need:['shark','herb'],xp:360,score:540}
];
const COOK_STATIONS={
 crab:{x:1,y:1,type:'crate',item:'crab',label:'Crab'}, potato:{x:1,y:3,type:'crate',item:'potato',label:'Potato'}, herb:{x:1,y:5,type:'crate',item:'herb',label:'Herb'},
 golden_crab:{x:13,y:1,type:'crate',item:'golden_crab',label:'Golden crab'}, urchin:{x:13,y:3,type:'crate',item:'urchin',label:'Sea urchin'}, flour:{x:13,y:5,type:'crate',item:'flour',label:'Flour'},
 karambwan:{x:4,y:1,type:'crate',item:'karambwan',label:'Karambwan'}, shark:{x:10,y:1,type:'crate',item:'shark',label:'Shark'},
 chop1:{x:4,y:3,type:'chop',label:'Chop'}, chop2:{x:10,y:3,type:'chop',label:'Chop'}, stove1:{x:5,y:6,type:'stove',label:'Range'}, stove2:{x:9,y:6,type:'stove',label:'Range'},
 plates:{x:7,y:1,type:'plates',label:'Plates'}, table:{x:7,y:3,type:'table',label:'Prep table'}, table2:{x:6,y:4,type:'table',label:'Prep table'}, table3:{x:8,y:4,type:'table',label:'Prep table'}, serve:{x:7,y:6,type:'serve',label:'Serve'}, bin:{x:2,y:6,type:'bin',label:'Bin'}, bin2:{x:12,y:6,type:'bin',label:'Bin'}
};
const COOK_ART_PATHS={crab:'assets/cooking/crab.png',golden_crab:'assets/cooking/golden_crab.png',urchin:'assets/cooking/sea_urchin.png',pie:'assets/cooking/pie.png',karambwan:'assets/cooking/karambwan.png',range:'assets/cooking/range.png',shark:'assets/cooking/shark.png',potato:'assets/cooking/potato.png',herb:'assets/cooking/herb.png',flour:'assets/cooking/flour.png',plate:'assets/cooking/plate.svg'};
const COOK_ITEM_NAMES={crab:'Crab',golden_crab:'Golden crab',urchin:'Sea urchin',karambwan:'Karambwan',shark:'Shark',potato:'Potato',herb:'Herb',flour:'Flour'};
const cookImageCache={};
function getCookImage(path){if(!path)return null;if(!cookImageCache[path]){const im=new Image();im.src=path;cookImageCache[path]=im;}return cookImageCache[path];}
function currentCookPet(){return activePetState||'pet_free_cat'}
function currentCookName(){return character?.username||'Chef'}
function openCookingGame(){if(!character)return;resetCookingGame();$('cookingDialog').showModal();}
function clearCookingNetwork(){if(cookingNet.joinTimer)clearInterval(cookingNet.joinTimer);cookingNet.joinTimer=null;if(cookingNet.channel){try{db.removeChannel(cookingNet.channel)}catch(e){try{cookingNet.channel.unsubscribe()}catch(_){}}}cookingNet={channel:null,role:null,roomCode:'',guest:null,connected:false,lastBroadcast:0,joinTimer:null,remoteKeys:new Set(),targetState:null};}
const cookingMusic=new Audio('assets/audio/Too_Many_Cooks.mp3');
cookingMusic.loop=true;
cookingMusic.volume=.38;
function startCookingMusic(){try{cookingMusic.currentTime=0;const p=cookingMusic.play();if(p?.catch)p.catch(()=>{});}catch(e){}}
function stopCookingMusic(){try{cookingMusic.pause();cookingMusic.currentTime=0;}catch(e){}}
function resetCookingGame(){stopCookingMusic();cookingRunning=false;cancelAnimationFrame(cookingRAF);cookingRAF=null;cookingKeys.clear();cookingState=null;clearCookingNetwork();$('cookingSetup').classList.remove('hidden');$('cookingLobby').classList.add('hidden');$('cookingHud').classList.add('hidden');$('cookingOrdersBar').classList.add('hidden');$('cookingCanvas').classList.add('hidden');$('cookingResult').classList.add('hidden');$('cookingMessage').textContent='Choose single player or create/join an online kitchen.';$('cookingJoinCode').value='';$('cookingStartOnline').disabled=true;setCookingMode('solo');}
function setCookingMode(mode){cookingMode=mode;const solo=$('cookingSolo');if(solo)solo.classList.toggle('selected',mode==='solo');$('cookingCreate').classList.toggle('selected',mode==='host');$('cookingJoin').classList.toggle('selected',mode==='guest');$('cookingJoinPanel').classList.toggle('hidden',mode!=='guest');$('startCooking').classList.toggle('hidden',mode!=='solo');}
function randomKitchenCode(){const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let out='';for(let i=0;i<6;i++)out+=chars[Math.floor(Math.random()*chars.length)];return out;}
function setupCookingChannel(code,role){clearCookingNetwork();cookingNet.role=role;cookingNet.roomCode=code;const key=`${character?.id||currentCookName()}-${Math.random().toString(36).slice(2,7)}`;const channel=db.channel(`gnome-kitchen-${code}`,{config:{broadcast:{self:false},presence:{key}}});cookingNet.channel=channel;
 channel.on('broadcast',{event:'join-request'},({payload})=>{if(role!=='host'||cookingRunning)return;cookingNet.guest=payload;$('cookingLobbyPlayer2').textContent=`${payload.name} — ${PET_CATALOG[payload.petId]?.name||'Pet'}`;$('cookingStartOnline').disabled=false;channel.send({type:'broadcast',event:'join-accepted',payload:{hostName:currentCookName(),hostPet:currentCookPet(),code}});});
 channel.on('broadcast',{event:'join-accepted'},({payload})=>{if(role!=='guest')return;cookingNet.connected=true;$('cookingLobbyStatus').textContent=`Connected to ${payload.hostName}. Waiting for the host to start…`;$('cookingLobbyPlayer1').textContent=`${payload.hostName} — ${PET_CATALOG[payload.hostPet]?.name||'Pet'}`;});
 channel.on('broadcast',{event:'input'},({payload})=>{if(role!=='host'||!payload)return;cookingNet.remoteKeys=new Set(payload.keys||[]);});
 channel.on('broadcast',{event:'interact'},()=>{if(role==='host'&&cookingRunning)cookingInteract(2);});
 channel.on('broadcast',{event:'game-start'},({payload})=>{if(role!=='guest')return;cookingState=payload.state;cookingRunning=true;cookingLast=performance.now();showCookingArena();$('cookingMessage').textContent='Online shift started!';cookingRAF=requestAnimationFrame(cookingLoop);});
 channel.on('broadcast',{event:'state'},({payload})=>{if(role!=='guest'||!payload?.state)return;const incoming=payload.state;if(!cookingState){cookingState=incoming;}else{const currentPlayers=cookingState.players||[];const targets=new Map((incoming.players||[]).map(p=>[p.id,p]));cookingNet.targetState=incoming;Object.assign(cookingState,incoming,{players:currentPlayers});currentPlayers.forEach(p=>{const t=targets.get(p.id);if(t){p.held=t.held;p.action=t.action;p.facing=t.facing;}});}updateCookingHud();});
 channel.on('broadcast',{event:'game-end'},async({payload})=>{if(role!=='guest')return;cookingRunning=false;cancelAnimationFrame(cookingRAF);cookingState=payload.state;await showCookingResult(payload.xp,true);});
 channel.on('broadcast',{event:'message'},({payload})=>{if(payload?.text)$('cookingMessage').textContent=payload.text;});
 channel.subscribe(status=>{if(status==='SUBSCRIBED'){cookingNet.connected=true;if(role==='host'){$('cookingLobbyStatus').textContent='Kitchen open. Share the code with another player.';}else{const sendJoin=()=>channel.send({type:'broadcast',event:'join-request',payload:{name:currentCookName(),petId:currentCookPet()}});sendJoin();cookingNet.joinTimer=setInterval(sendJoin,1500);}}else if(status==='CHANNEL_ERROR'){$('cookingLobbyStatus').textContent='Could not connect to the online kitchen. Check Supabase Realtime.';}});
}
function createOnlineCooking(){setCookingMode('host');const code=randomKitchenCode();setupCookingChannel(code,'host');$('cookingSetup').classList.add('hidden');$('cookingLobby').classList.remove('hidden');$('cookingLobbyCode').textContent=code;$('cookingLobbyTitle').textContent='YOUR ONLINE KITCHEN';$('cookingLobbyPlayer1').textContent=`${currentCookName()} — ${PET_CATALOG[currentCookPet()]?.name||'Pet'}`;$('cookingLobbyPlayer2').textContent='Waiting for teammate…';$('cookingStartOnline').classList.remove('hidden');$('cookingStartOnline').disabled=true;}
function joinOnlineCooking(){setCookingMode('guest');const code=$('cookingJoinCode').value.trim().toUpperCase();if(!/^[A-Z2-9]{6}$/.test(code)){toast('Enter a valid 6-character kitchen code.');return;}setupCookingChannel(code,'guest');$('cookingSetup').classList.add('hidden');$('cookingLobby').classList.remove('hidden');$('cookingLobbyCode').textContent=code;$('cookingLobbyTitle').textContent='JOINING ONLINE KITCHEN';$('cookingLobbyPlayer1').textContent='Finding host…';$('cookingLobbyPlayer2').textContent=`${currentCookName()} — ${PET_CATALOG[currentCookPet()]?.name||'Pet'}`;$('cookingLobbyStatus').textContent='Connecting…';$('cookingStartOnline').classList.add('hidden');}
function makeCookPlayer(id,x,y,petId,name){return{id,x,y,vx:0,vy:0,held:null,action:0,petId:petId||'pet_free_cat',name:name||`Chef ${id}`,facing:'down',dash:0};}
function buildCookingState(online=false){const players=[makeCookPlayer(1,6,4,currentCookPet(),currentCookName())];if(online){const g=cookingNet.guest||{petId:'pet_free_cat',name:'Teammate'};players.push(makeCookPlayer(2,8,4,g.petId,g.name));}const state={players,orders:[],stations:{},score:0,combo:1,served:0,time:150,elapsed:0,nextOrder:0,particles:[],xp:0,fever:0};Object.entries(COOK_STATIONS).forEach(([k,v])=>state.stations[k]={...v,progress:0,item:v.type==='crate'?v.item:null,cooked:false,burning:false});return state;}
function startCookingGame(){cookingMode='solo';cookingState=buildCookingState(false);beginCookingHost();}
function startOnlineCooking(){if(cookingNet.role!=='host'||!cookingNet.guest)return;cookingMode='host';cookingState=buildCookingState(true);beginCookingHost();cookingNet.channel.send({type:'broadcast',event:'game-start',payload:{state:cloneCookingState()}});}
function beginCookingHost(){startCookingMusic();addCookingOrder();addCookingOrder();cookingRunning=true;cookingLast=performance.now();showCookingArena();$('cookingMessage').textContent='Prepare the orders! Keep the combo alive!';cookingRAF=requestAnimationFrame(cookingLoop);}
function showCookingArena(){$('cookingSetup').classList.add('hidden');$('cookingLobby').classList.add('hidden');$('cookingHud').classList.remove('hidden');$('cookingOrdersBar').classList.remove('hidden');$('cookingCanvas').classList.remove('hidden');$('cookingResult').classList.add('hidden');}
function cloneCookingState(){return JSON.parse(JSON.stringify(cookingState));}
function addCookingOrder(){if(!cookingState)return;const r=COOK_RECIPES[Math.floor(Math.random()*COOK_RECIPES.length)];const golden=Math.random()<.12;cookingState.orders.push({...r,id:crypto.randomUUID?.()||Math.random().toString(36),age:0,limit:golden?45:62,golden});renderCookingOrders();}
function renderCookingOrders(){if(!cookingState)return;$('cookingOrdersBar').innerHTML=cookingState.orders.map(o=>{const pct=Math.max(0,Math.min(100,(1-o.age/o.limit)*100));const ingredients=o.need.map(n=>`<span class="cook-order-item"><img src="${itemArt(n,'raw')||''}" alt=""><i>${COOK_ITEM_NAMES[n]||n}</i></span>`).join('<strong>+</strong>');return `<div class="cook-order ${o.limit-o.age<10?'urgent':''} ${o.golden?'golden':''}"><header><b>${o.golden?'★ ':''}${o.name}</b><em>${Math.max(0,Math.ceil(o.limit-o.age))}s</em></header><div class="cook-order-recipe">${ingredients}</div><small>CHOP → COOK → PLATE → SERVE</small><div class="cook-order-time"><span style="width:${pct}%"></span></div></div>`;}).join('');}
function cookingLoop(now){if(!cookingRunning)return;const dt=Math.min(.033,(now-cookingLast)/1000||0);cookingLast=now;if(cookingNet.role==='guest')updateGuestCookingView(dt);else updateCooking(dt);drawCooking();if(cookingNet.role==='host'&&now-cookingNet.lastBroadcast>50){cookingNet.lastBroadcast=now;cookingNet.channel?.send({type:'broadcast',event:'state',payload:{state:cloneCookingState()}});}if(cookingRunning)cookingRAF=requestAnimationFrame(cookingLoop);}
function updateGuestCookingView(dt){if(!cookingState)return;const me=cookingState.players?.find(p=>p.id===2);if(me){const speed=(cookingState.fever>0?4.8:4.15);let dx=0,dy=0;if(cookingKeys.has('w'))dy--;if(cookingKeys.has('s'))dy++;if(cookingKeys.has('a'))dx--;if(cookingKeys.has('d'))dx++;if(dx||dy){const m=Math.hypot(dx,dy);dx/=m;dy/=m;me.x=Math.max(.5,Math.min(COOK_COLS-.5,me.x+dx*speed*dt));me.y=Math.max(.5,Math.min(COOK_ROWS-.5,me.y+dy*speed*dt));me.facing=Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up');}me.action=Math.max(0,(me.action||0)-dt);}const target=cookingNet.targetState;if(target?.players){for(const p of cookingState.players||[]){const t=target.players.find(q=>q.id===p.id);if(!t)continue;const distance=Math.hypot(t.x-p.x,t.y-p.y);const strength=p.id===2?(distance>1.1?0.34:0.10):0.22;const blend=1-Math.pow(1-strength,dt*60);p.x+=(t.x-p.x)*blend;p.y+=(t.y-p.y)*blend;}}updateCookingHud();}
function updateCooking(dt){const s=cookingState;s.elapsed+=dt;s.time=Math.max(0,150-s.elapsed);s.nextOrder-=dt;s.fever=Math.max(0,s.fever-dt);if(s.nextOrder<=0&&s.orders.length<5){addCookingOrder();s.nextOrder=Math.max(10,16-Math.min(4,s.elapsed/40))+Math.random()*5;}s.orders.forEach(o=>o.age+=dt);for(let i=s.orders.length-1;i>=0;i--){if(s.orders[i].age>=s.orders[i].limit){s.orders.splice(i,1);s.combo=1;s.score=Math.max(0,s.score-125);broadcastCookingMessage('Order missed! Combo reset.');addCookingOrder();}}s.players.forEach(p=>updateCookPlayer(p,dt));Object.values(s.stations).filter(st=>st.type==='stove'&&st.item).forEach(st=>{st.progress+=dt*(s.fever>0?1.35:1);if(st.progress>4.5)st.cooked=true;if(st.progress>9)st.burning=true;});updateCookingHud();if(s.time<=0)endCookingGame();}
function localKeysForPlayer(p){if(cookingNet.role==='host'&&p.id===2)return cookingNet.remoteKeys;if(cookingNet.role==='guest')return new Set();return cookingKeys;}
function updateCookPlayer(p,dt){const keys=localKeysForPlayer(p),speed=(cookingState.fever>0?4.8:4.15);let dx=0,dy=0;if(keys.has('w'))dy--;if(keys.has('s'))dy++;if(keys.has('a'))dx--;if(keys.has('d'))dx++;if(dx||dy){const m=Math.hypot(dx,dy);dx/=m;dy/=m;p.x=Math.max(.5,Math.min(COOK_COLS-.5,p.x+dx*speed*dt));p.y=Math.max(.5,Math.min(COOK_ROWS-.5,p.y+dy*speed*dt));p.facing=Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up');}p.action=Math.max(0,(p.action||0)-dt);}
function nearestCookStation(p){let best=null,bd=1.15;Object.values(cookingState.stations).forEach(st=>{const d=Math.hypot(p.x-(st.x+.5),p.y-(st.y+.5));if(d<bd){best=st;bd=d}});return best;}
function cookingInteract(playerId){if(!cookingRunning||cookingNet.role==='guest')return;const p=cookingState.players.find(q=>q.id===playerId),st=nearestCookStation(p);if(!p||!st)return;if(st.type==='crate'){if(!p.held){p.held={kind:'ingredient',items:[st.item],stage:'raw'};broadcastCookingMessage(`Picked up ${st.label}. Take it to a chopping board.`);}else broadcastCookingMessage('Your paws are full.');}else if(st.type==='bin'){p.held=null;broadcastCookingMessage('Binned it.');}else if(st.type==='table'){if(!st.item&&p.held){st.item=p.held;p.held=null;broadcastCookingMessage('Put it on the prep table.');}else if(st.item&&!p.held){p.held=st.item;st.item=null;broadcastCookingMessage('Picked it back up from the prep table.');}else if(st.item&&p.held){const heldIsPlate=p.held.kind==='plate'&&Array.isArray(p.held.items),tableIsPlate=st.item.kind==='plate'&&Array.isArray(st.item.items),heldIsCooked=p.held.kind==='ingredient'&&p.held.stage==='cooked',tableIsCooked=st.item.kind==='ingredient'&&st.item.stage==='cooked';if(heldIsPlate&&tableIsCooked){p.held.items.push(...(st.item.items||[]));p.held.stage='plated';st.item=null;broadcastCookingMessage('Added the cooked food to your plate.');}else if(tableIsPlate&&heldIsCooked){st.item.items.push(...(p.held.items||[]));st.item.stage='plated';p.held=null;broadcastCookingMessage('Added the cooked food to the plate on the prep table.');}else{const swap=st.item;st.item=p.held;p.held=swap;broadcastCookingMessage('Swapped items on the prep table.');}}else broadcastCookingMessage('The prep table is empty.');}else if(st.type==='plates'){if(!p.held){p.held={kind:'plate',items:[],stage:'plate'};broadcastCookingMessage('Picked up a clean plate.');}else if(p.held.kind==='ingredient'&&p.held.stage==='cooked'){p.held={kind:'plate',items:[...p.held.items],stage:'plated'};broadcastCookingMessage('Plated! Add the other cooked ingredient.');}}else if(st.type==='chop'){if(p.held&&p.held.kind==='ingredient'&&p.held.stage==='raw'){p.action=1.1;p.held.stage='chopped';broadcastCookingMessage('Chopped! Now cook it on a range.');}else if(p.held?.stage==='chopped')broadcastCookingMessage('Already chopped — take it to a range.');}else if(st.type==='stove'){if(p.held&&p.held.kind==='ingredient'&&p.held.stage==='chopped'&&!st.item){st.item=p.held;st.progress=0;st.cooked=false;st.burning=false;p.held=null;broadcastCookingMessage('Cooking… watch the progress bar.');}else if(st.item&&st.cooked){const holdingPlate=!!p.held&&(p.held.kind==='plate'||p.held.stage==='plate'||p.held.stage==='plated')&&Array.isArray(p.held.items);if(!p.held){p.held=st.item;p.held.stage=st.burning?'burnt':'cooked';st.item=null;broadcastCookingMessage(st.burning?'Picked up burnt food. Bin it!':'Picked up cooked food. Take it to the plates.');}else if(holdingPlate&&!st.burning){const cookedItems=Array.isArray(st.item.items)?st.item.items:(st.item.item?[st.item.item]:[]);p.held.kind='plate';p.held.items.push(...cookedItems);p.held.stage='plated';st.item=null;st.progress=0;st.cooked=false;st.burning=false;broadcastCookingMessage('Food added to your plate! Add the remaining ingredient or serve it.');}else if(holdingPlate&&st.burning){broadcastCookingMessage('That food is burnt — empty it into the bin.');}else broadcastCookingMessage('Your paws are full. Hold a clean plate or use empty paws.');}else if(st.item)broadcastCookingMessage('Still cooking…');}else if(st.type==='serve'&&p.held){serveCookingItem(p);}}
function broadcastCookingMessage(text){$('cookingMessage').textContent=text;if(cookingNet.role==='host')cookingNet.channel?.send({type:'broadcast',event:'message',payload:{text}});}
function serveCookingItem(p){const held=p.held;if(!held)return;const items=held.items||[];let idx=cookingState.orders.findIndex(o=>o.need.every(n=>items.includes(n))&&o.need.length===items.length);if(idx<0&&held.stage==='cooked'&&held.items?.length===1){const other=cookingState.players.find(q=>q!==p&&q.held&&q.held.stage==='cooked');if(other){held.items=[...held.items,...other.held.items];other.held=null;idx=cookingState.orders.findIndex(o=>o.need.every(n=>held.items.includes(n))&&o.need.length===held.items.length);}}if(idx>=0&&held.stage!=='burnt'){const o=cookingState.orders.splice(idx,1)[0];const mult=o.golden?2:1;const gain=Math.round(o.score*cookingState.combo*mult);cookingState.score+=gain;cookingState.xp+=o.xp*mult;cookingState.combo=Math.min(10,cookingState.combo+1);cookingState.served++;cookingState.fever=cookingState.combo>=6?8:cookingState.fever;p.held=null;broadcastCookingMessage(`Served ${o.name}! +${gain}${o.golden?' GOLD ORDER!':''}`);addCookingOrder();}else broadcastCookingMessage('That does not match an order.');}
function updateCookingHud(){if(!cookingState)return;const s=cookingState;$('cookingTime').textContent=Math.ceil(s.time);$('cookingScore').textContent=Math.floor(s.score);$('cookingCombo').textContent='x'+s.combo;$('cookingOrders').textContent=s.served;$('cookingFever').textContent=s.fever>0?'ACTIVE':'—';renderCookingOrders();}
function drawCooking(){const c=$('cookingCanvas'),ctx=c.getContext('2d'),s=cookingState;if(!s)return;ctx.clearRect(0,0,c.width,c.height);drawKitchenRoom(ctx,s);Object.values(s.stations).forEach(st=>drawCookStation(ctx,st));s.players.forEach(p=>drawCookPlayer(ctx,p));const me=s.players.find(p=>p.id===(cookingNet.role==='guest'?2:1));const near=me&&nearestCookStation(me);if(near)drawCookingPrompt(ctx,near);if(s.fever>0){ctx.strokeStyle='#ffd44d';ctx.lineWidth=7;ctx.strokeRect(4,4,c.width-8,c.height-8);}}
function drawKitchenRoom(ctx,s){const w=COOK_COLS*COOK_TILE,h=COOK_ROWS*COOK_TILE;ctx.fillStyle=s.fever>0?'#5d421d':'#34261b';ctx.fillRect(0,0,w,h);ctx.fillStyle='#786344';ctx.fillRect(0,70,w,h-70);for(let y=1;y<COOK_ROWS;y++)for(let x=0;x<COOK_COLS;x++){ctx.fillStyle=(x+y)%2?'#766343':'#806b48';ctx.fillRect(x*COOK_TILE,y*COOK_TILE,COOK_TILE,COOK_TILE);ctx.strokeStyle='rgba(45,32,20,.38)';ctx.strokeRect(x*COOK_TILE,y*COOK_TILE,COOK_TILE,COOK_TILE);}ctx.fillStyle='#473427';ctx.fillRect(0,0,w,76);ctx.fillStyle='#231a14';ctx.fillRect(0,65,w,11);ctx.fillStyle='#8b6333';ctx.fillRect(90,17,260,36);ctx.fillRect(610,17,260,36);ctx.strokeStyle='#d5a95f';ctx.lineWidth=2;ctx.strokeRect(90,17,260,36);ctx.strokeRect(610,17,260,36);ctx.fillStyle='#f6d990';ctx.font='bold 18px Georgia';ctx.textAlign='center';ctx.fillText('GNOME KITCHEN — INGREDIENT STORES',220,42);ctx.fillText('ORDERS OUT THIS WAY →',740,42);ctx.fillStyle='rgba(83,45,21,.75)';ctx.fillRect(192,246,576,20);ctx.fillRect(192,394,576,20);ctx.strokeStyle='#b48143';ctx.strokeRect(192,246,576,20);ctx.strokeRect(192,394,576,20);for(let x=210;x<750;x+=72){ctx.fillStyle='#6a4325';ctx.fillRect(x,250,50,12);ctx.fillRect(x,398,50,12);}ctx.fillStyle='rgba(92,35,21,.65)';ctx.fillRect(384,438,192,66);ctx.strokeStyle='#d4a157';ctx.strokeRect(384,438,192,66);ctx.fillStyle='#f5d28a';ctx.font='bold 12px monospace';ctx.fillText('PLATING & SERVICE',480,494);}
function itemArt(i,stage){return COOK_ART_PATHS[i]||null;}
function drawCookStation(ctx,st){const x=st.x*COOK_TILE,y=st.y*COOK_TILE;const isCrate=st.type==='crate';ctx.save();ctx.shadowColor='rgba(0,0,0,.45)';ctx.shadowBlur=6;ctx.shadowOffsetY=3;ctx.fillStyle=st.type==='stove'?'#272321':st.type==='serve'?'#7c251e':st.type==='plates'?'#66563e':st.type==='chop'?'#7b5a31':st.type==='table'?'#8a663d':st.type==='bin'?'#3c3a31':'#5b351b';ctx.fillRect(x+4,y+4,56,56);ctx.shadowBlur=0;ctx.strokeStyle=st.type==='serve'?'#f0bd67':'#d2a85b';ctx.lineWidth=2;ctx.strokeRect(x+4,y+4,56,56);if(isCrate){ctx.fillStyle='#3a2415';ctx.fillRect(x+8,y+14,48,40);ctx.strokeStyle='#9a6a35';ctx.lineWidth=2;ctx.strokeRect(x+8,y+14,48,40);const art=itemArt(st.item,'raw'),im=getCookImage(art);if(im?.complete&&im.naturalWidth){const maxW=46,maxH=36,scale=Math.min(maxW/im.naturalWidth,maxH/im.naturalHeight);const dw=im.naturalWidth*scale,dh=im.naturalHeight*scale;ctx.drawImage(im,x+32-dw/2,y+34-dh/2,dw,dh);}else if(art){ctx.fillStyle='#f4d88d';ctx.font='bold 18px serif';ctx.textAlign='center';ctx.fillText(itemEmoji(st.item),x+32,y+42);}}if(st.type==='plates'){const im=getCookImage(COOK_ART_PATHS.plate);if(im?.complete)ctx.drawImage(im,x+15,y+16,34,28);}if(st.type==='chop'){ctx.fillStyle='#b98b50';ctx.fillRect(x+12,y+18,40,27);ctx.strokeStyle='#4c301b';ctx.strokeRect(x+12,y+18,40,27);ctx.strokeStyle='#d9d4c8';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x+23,y+39);ctx.lineTo(x+44,y+23);ctx.stroke();}if(st.type==='bin'){ctx.fillStyle='#454b3b';ctx.fillRect(x+17,y+17,30,34);ctx.fillStyle='#25291f';ctx.fillRect(x+13,y+13,38,7);}if(st.type==='table'){ctx.fillStyle='#b18451';ctx.fillRect(x+8,y+18,48,28);ctx.fillStyle='#604323';ctx.fillRect(x+12,y+46,8,12);ctx.fillRect(x+44,y+46,8,12);ctx.strokeStyle='#e0b875';ctx.strokeRect(x+8,y+18,48,28);}if(st.type==='serve'){ctx.fillStyle='#f4d88d';ctx.font='bold 12px monospace';ctx.textAlign='center';ctx.fillText('SERVE',x+32,y+37);}if(st.type==='stove'){const im=getCookImage(COOK_ART_PATHS.range);if(im?.complete)ctx.drawImage(im,x+5,y+1,54,60);}ctx.fillStyle='#fff0b2';ctx.font='bold 9px monospace';ctx.textAlign='center';ctx.fillText(st.label.toUpperCase(),x+32,y+12);const heldItem=st.item?.items?.[0]||st.item;const art=itemArt(heldItem,st.cooked?'cooked':'raw');if(heldItem){const im=getCookImage(art);if(im?.complete&&im.naturalWidth)ctx.drawImage(im,x+17,y+19,30,30);else{ctx.font='22px serif';ctx.fillText(itemEmoji(heldItem),x+32,y+47);}if(st.type==='stove'){ctx.fillStyle='#21170f';ctx.fillRect(x+8,y+54,48,6);ctx.fillStyle=st.burning?'#e33':st.cooked?'#65d46e':'#f0b54a';ctx.fillRect(x+9,y+55,46*Math.min(1,st.progress/9),4);}}ctx.restore();}
function itemEmoji(i){return{potato:'🥔',herb:'🌿',flour:'⚪',shark:'🦈',crab:'🦀',golden_crab:'🦀',urchin:'✹',karambwan:'🐙'}[i]||'🍲';}
function drawCookingPrompt(ctx,st){const x=(st.x+.5)*COOK_TILE,y=st.y*COOK_TILE-8;ctx.save();ctx.fillStyle='rgba(17,12,8,.92)';ctx.strokeStyle='#f2c96f';ctx.lineWidth=2;ctx.fillRect(x-64,y-28,128,25);ctx.strokeRect(x-64,y-28,128,25);ctx.fillStyle='#fff0b2';ctx.font='bold 11px monospace';ctx.textAlign='center';ctx.fillText(`E — ${st.type==='crate'?'TAKE '+st.label.toUpperCase():st.type==='chop'?'CHOP':st.type==='stove'?'COOK / COLLECT':st.type==='plates'?'TAKE / USE PLATE':st.type==='table'?'PUT DOWN / PICK UP':st.type==='serve'?'SERVE ORDER':'DISCARD'}`,x,y-11);ctx.restore();}
function drawCookPlayer(ctx,p){const x=p.x*COOK_TILE,y=p.y*COOK_TILE;ctx.save();ctx.translate(x,y);if(p.action>0){ctx.rotate(Math.sin(p.action*18)*.14);}ctx.fillStyle='rgba(0,0,0,.3)';ctx.beginPath();ctx.ellipse(0,18,22,8,0,0,Math.PI*2);ctx.fill();const meta=PET_CATALOG[p.petId]||PET_CATALOG.pet_free_cat,im=getCookImage(meta.image);if(im?.complete&&im.naturalWidth){ctx.save();ctx.scale(-1,1);ctx.drawImage(im,-25,-30,50,50);ctx.restore();}else{ctx.fillStyle=p.id===1?'#3fa6dc':'#d65b87';ctx.beginPath();ctx.arc(0,0,20,0,Math.PI*2);ctx.fill();}ctx.fillStyle='#f3dfad';ctx.fillRect(-17,-31,34,10);ctx.fillStyle='#111';ctx.font='bold 9px monospace';ctx.textAlign='center';ctx.fillText((p.name||`PET ${p.id}`).slice(0,12),0,31);if(p.held){if(p.held.kind==='plate'){const pi=getCookImage(COOK_ART_PATHS.plate);if(pi?.complete)ctx.drawImage(pi,-21,-48,42,28);(p.held.items||[]).slice(0,2).forEach((it,i)=>{const hi=getCookImage(itemArt(it,'cooked'));if(hi?.complete)ctx.drawImage(hi,-14+i*13,-50,26,26);});}else{const art=itemArt(p.held.items?.[0],p.held.stage);const hi=getCookImage(art);if(hi?.complete)ctx.drawImage(hi,-16,-49,32,32);else{ctx.font='24px serif';ctx.fillText(itemEmoji(p.held.items?.[0]),0,-32);}}}ctx.restore();}
async function saveCookingReward(base){try{const reward=Math.max(0,Math.min(2500,Math.floor(Number(base)||0)));const{data,error}=await db.rpc('complete_cooking_shift',{p_score:Math.floor(cookingState.score),p_orders:Math.floor(cookingState.served),p_xp:reward});if(error)throw error;const row=Array.isArray(data)?data[0]:data;if(!row||row.cooking_xp==null)throw new Error('Cooking reward returned no XP total.');character.cooking_xp=Number(row.cooking_xp);if(row.achievements)achievementState=row.achievements;if(row.achievement_unlocked){toast("Achievement complete: Kitchen Table Service — Chef's hat added to your Bank!");renderAchievements();}renderCharacter();return true;}catch(e){console.error('Cooking XP save failed:',e);toast(`Cooking XP could not save: ${e?.message||'run update-achievements.sql'}`);return false;}}
async function showCookingResult(base,isGuest=false){stopCookingMusic();const saved=await saveCookingReward(base);$('cookingResult').classList.remove('hidden');$('cookingResultTitle').textContent=cookingState.served>=10?'KITCHEN LEGENDS!':cookingState.served>=6?'KITCHEN MASTER!':'SHIFT COMPLETE';$('cookingResultText').textContent=`Your team served ${cookingState.served} orders, scored ${Math.floor(cookingState.score)} and earned ${base} Cooking XP${saved?'':' (run update-cooking-minigame.sql to save XP)'}.`;}
async function endCookingGame(){if(!cookingRunning||cookingNet.role==='guest')return;cookingRunning=false;cancelAnimationFrame(cookingRAF);const s=cookingState;const base=Math.max(150,Math.min(2500,Math.round(s.xp+s.score/5)));if(cookingNet.role==='host')cookingNet.channel?.send({type:'broadcast',event:'game-end',payload:{state:cloneCookingState(),xp:base}});await showCookingResult(base,false);}
function sendGuestCookingInput(){if(cookingNet.role!=='guest'||!cookingNet.channel)return;cookingNet.channel.send({type:'broadcast',event:'input',payload:{keys:[...cookingKeys]}});}


$('openAgility').onclick = openAgility;
$('openMining').disabled=false;
$('openQuests').disabled=false;
$('openMining').onclick = openMining;
$('mineStarButton').onclick = strikeShootingStar;
$('stopMiningButton').onclick = stopShootingStar;
$('miningOpenBank').onclick = ()=>{stopShootingStar();openBank()};
$('openSlayer').onclick = openSlayer;
$('openCombat').onclick = openCombat;
document.querySelectorAll('.combat-weapon-choice').forEach(button => button.addEventListener('click', () => selectCombatWeapon(button.dataset.weapon)));
document.querySelectorAll('.combat-difficulty-choice').forEach(button => button.addEventListener('click', () => selectCombatDifficulty(button.dataset.difficulty)));
document.querySelectorAll('.combat-location-choice').forEach(button => button.addEventListener('click', () => selectCombatLocation(button.dataset.location)));
document.querySelectorAll('.slayer-difficulty-choice').forEach(button => button.addEventListener('click', () => selectSlayerDifficulty(button.dataset.slayerDifficulty)));
$('combatStart').onclick = startCombatGame;
$('openSailing').onclick = openSailingGame;
$('openCooking').onclick = openCookingGame;
const cookingSoloButton=$('cookingSolo');if(cookingSoloButton)cookingSoloButton.onclick=()=>setCookingMode('solo');$('cookingCreate').onclick=createOnlineCooking;$('cookingJoin').onclick=()=>setCookingMode('guest');$('cookingJoinNow').onclick=joinOnlineCooking;$('startCooking').onclick=startCookingGame;$('cookingStartOnline').onclick=startOnlineCooking;$('cookingAgain').onclick=resetCookingGame;
$('openRunecrafting').onclick = openRunecrafting;
$('openWiseTask').onclick = openWiseTask;
$('openBank').onclick = openBank;
$('openPets').onclick = openPets;
$('petsPutAway').onclick = ()=>setMyActivePet(null);
$('confirmLampUse').onclick = useHarmonyLamp;
$('openGrandExchange').onclick = openGrandExchange;
$('openPetWars').onclick = openPetWars;
$('petWarsCreate').onclick = createPetWar;
$('petWarsJoin').onclick = joinPetWar;
$('petWarsCancel').onclick = cancelPetWar;
$('petWarsLeave').onclick = leavePetWar;
$('geSearchButton').onclick = searchGeItems;
$('geSearch').addEventListener('input',()=>{clearTimeout(geSearchTimer);geSearchTimer=setTimeout(searchGeItems,260)});
$('geSearch').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();searchGeItems()}});
$('wiseGetTask').onclick = requestWiseTask;
$('wiseClaimTask').onclick = () => claimWiseTask(false);
$('wiseSkipTask').onclick = skipWiseTask;
$('rcCreateRoom').onclick = createRcRoom;
$('rcPlayComputer').onclick = playRcComputer;
document.querySelectorAll('.rc-ai-choice').forEach(b=>b.onclick=()=>selectRcAiDifficulty(b.dataset.ai));
$('rcJoinRoom').onclick = joinRcRoom;
$('rcLeaveRoom').onclick = leaveRcRoom;
$('rcRematch').onclick = rcRematch;
$('rcCanvas').addEventListener('pointerdown', rcAimStart);
$('rcCanvas').addEventListener('pointermove', rcAimMove);
$('rcCanvas').addEventListener('pointerup', rcAimEnd);
$('rcCanvas').addEventListener('pointercancel', ()=>{rcAim=null;drawRcTable()});
$('sailingStart').onclick = startSailingGame;
if($('sailingCourse')) $('sailingCourse').addEventListener('change',()=>{updateSailingCourseInfo();resetSailingGame('Voyage selected. Set sail when ready.');});
$('jadStart').onclick = startJadFight;
$('prayRanged').onclick = () => selectJadPrayer('ranged');
$('prayMagic').onclick = () => selectJadPrayer('magic');
$('agilityStart').onclick = startAgilityGame;
$('chooseDash').onclick = () => setAgilityMode('dash');
$('chooseGnomeBall').onclick = () => setAgilityMode('gnomeball');
$('gnomeBallStart').onclick = startGnomeBall;
const gnomeCanvas = $('gnomeBallCanvas');
gnomeCanvas.addEventListener('pointerdown', gnomeBallDown);
gnomeCanvas.addEventListener('pointermove', gnomeBallMove);
gnomeCanvas.addEventListener('pointerup', gnomeBallUp);
gnomeCanvas.addEventListener('pointercancel', gnomeBallUp);
$('openSkills').onclick = openSkills;
$('openQuests').onclick = openQuests;
$('openAchievements').onclick = openAchievements;

$('openRaids').onclick = () => $('raidsDialog').showModal();
$('adminButton')?.addEventListener('click',toaToggleAdminMode);

const toaState={x:50,y:79,arenaX:50,arenaY:70,active:false,keys:{},raf:0,last:0,mode:'none',code:'',room:'nexus',partyJoined:false,localReady:false,remoteReady:false,prayer:null,remotePrayer:null,sharks:3,channel:null,zebakHp:100,zebakMaxHp:100,playerHp:99,playerMaxHp:99,fightActive:false,fightPaused:false,attackTimer:0,autoAttackTimer:0,pendingAttack:0,chatTyping:false,chatTimer:0,phase:1,acidPools:[],acidTick:0,acidTriggered:false,waveTriggered:false,waveActive:false,waveTimer:0,waveHit:false,bloodOrbs:[],bloodOrbRaf:0,finalAcidTriggered:false,finalSurgeTriggered:false,boulders:[],boulderTimer:0,helperActive:false,crondisComplete:false,scarabasComplete:false,hetComplete:false,apmekenComplete:false,apmekenX:48,apmekenY:73,remoteApmekenX:52,remoteApmekenY:73,remoteApmekenTarget:null,hetX:50,hetY:76,remoteHetX:54,remoteHetY:76,hetWeapon:'melee',remoteHetWeapon:'melee',hetPlayerHp:99,hetPlayerMaxHp:99,remoteHetPlayerHp:99,hetBossHp:500,hetBossMaxHp:500,hetBossX:50,hetBossY:28,hetBossTarget:0,hetBossFrame:0,hetBossFrameTimer:0,hetBossSyncTimer:0,hetBossStyle:'melee',hetBossAttackCount:0,hetBossNextAttack:0,hetBossNextPlayerAttack:0,hetBossAttacking:false,hetFinalStand:false,hetFinalHits:0,hetOrbNextSpawn:0,hetOrbs:[],hetHelperActive:false,hetSymbolActive:false,hetSymbolThresholdsDone:[],hetSymbolSequence:[],hetSymbolStep:0,hetSymbolTimers:[],hetShadowPhase:0,hetShadowActive:false,hetShadowUnlockedQuadrant:null,hetSelectedShadow:'nw',remoteHetSelectedShadow:'ne',hetShadows:{nw:{hp:45,dead:false,charging:false,chargeEnd:0},ne:{hp:45,dead:false,charging:false,chargeEnd:0},sw:{hp:45,dead:false,charging:false,chargeEnd:0},se:{hp:45,dead:false,charging:false,chargeEnd:0}},localDead:false,remoteDead:false,partyVictory:false,isHost:false,netConnected:false,netSyncTimer:0,lastNetMove:0,remoteTarget:null,remoteHetTarget:null,hetLocalNextAttackRequest:0,adminMode:false,remoteAdminMode:false,kephriHp:100,kephriMaxHp:100,kephriActive:false,kephriAttackTimer:0,kephriFireballTimer:0,kephriPlayerHp:99,remoteScarabasX:53,remoteScarabasY:78,kephriPhase:1,kephriDung:[],kephriFleas:[],kephriFleaTimer:0,kephriDungTriggered:false,kephriFleasTriggered:false,kephriDungStrike60:false,kephriDungStrike30:false,kephriDungStrike15:false,kephriDungWalls:[],kephriKnockback:false,kephriAddsTriggered:false,kephriAddsActive:false,kephriAdds:[],kephriBlueTimer:0,kephriAddAttackTimer:0,kephriAddDiveTimer:0,kephriDiveTriggered:false,kephriDiveTimer:0,kephriDiveBombs:[],kephriFinalRush:false,kephriHelperActive:false,roomId:null,hostName:'',guestName:'',joinRetryTimer:0,heartbeatTimer:0,connectionAttempts:0,netClientId:'',raidDefeated:false};
function toaNotice(text,hold=2200){const n=$('toaNotice');if(!n)return;n.textContent=text;n.classList.remove('hidden');clearTimeout(toaNotice.timer);toaNotice.timer=setTimeout(()=>n.classList.add('hidden'),hold)}
function toaHasAdminAccess(){return !!(toaState.adminMode||toaState.remoteAdminMode)}
function toaSetAdminMode(enabled=true,fromParty=false){
  if(!character||String(character.username||'').toLowerCase()!=='catasthma')return;
  toaState.adminMode=!!enabled;
  $('adminButton')?.classList.toggle('active',toaState.adminMode);
  toaUpdateCrondisUnlock();toaUpdateContextAction();
  if(toaState.channel&&!fromParty)toaPartySend({type:'admin-unlock',enabled:toaState.adminMode,sender:character?.id});
  toaNotice(toaState.adminMode?'ADMIN TEST MODE: every available TOA path is unlocked.':'Admin test mode disabled.',3200);
}
function toaToggleAdminMode(){toaSetAdminMode(!toaState.adminMode)}
function toaUpdateCrondisUnlock(){
  const modeReady=toaState.mode==='solo'||(toaState.mode==='party'&&toaState.partyJoined);
  const admin=toaHasAdminAccess();
  const unlocked=!toaState.crondisComplete&&modeReady;
  const label=$('toaCrondisLabel');if(label){const open=admin||unlocked;label.classList.toggle('unlocked',open);label.classList.toggle('complete',toaState.crondisComplete&&!admin);label.querySelector('span').textContent=admin?'ADMIN UNLOCKED · APPROACH TO ENTER':toaState.crondisComplete?'COMPLETE':unlocked?'UNLOCKED · APPROACH TO ENTER':toaState.mode==='party'?'WAITING FOR A TEAMMATE':'SELECT A RAID MODE TO UNLOCK';}
  const scarabasUnlocked=(admin||toaState.crondisComplete)&&!toaState.scarabasComplete&&modeReady;
  const scarabas=$('toaScarabasLabel');if(scarabas){scarabas.classList.toggle('unlocked',scarabasUnlocked);scarabas.classList.toggle('complete',toaState.scarabasComplete&&!admin);scarabas.querySelector('span').textContent=admin?'ADMIN UNLOCKED · APPROACH TO ENTER':toaState.scarabasComplete?'COMPLETE':scarabasUnlocked?'UNLOCKED · APPROACH TO ENTER':'LOCKED · COMPLETE CRONDIS';}
  const het=$('toaHetLabel');if(het){const open=admin||(toaState.scarabasComplete&&!toaState.hetComplete&&modeReady);het.classList.toggle('unlocked',open);het.classList.toggle('complete',toaState.hetComplete&&!admin);het.querySelector('span').textContent=admin?'ADMIN UNLOCKED · APPROACH TO ENTER':toaState.hetComplete?'COMPLETE':open?'UNLOCKED · APPROACH TO ENTER':'LOCKED · COMPLETE SCARABAS';}
  const ap=$('toaApmekenLabel');if(ap){const open=admin||(toaState.hetComplete&&!toaState.apmekenComplete&&modeReady);ap.classList.toggle('unlocked',open);ap.classList.toggle('complete',toaState.apmekenComplete&&!admin);ap.querySelector('span').textContent=admin?'ADMIN UNLOCKED · APPROACH TO ENTER':toaState.apmekenComplete?'COMPLETE':open?'UNLOCKED · APPROACH TO ENTER':'LOCKED · COMPLETE HET';}
  return admin||unlocked;
}

function toaGetNetClientId(){
  if(!toaState.netClientId){
    try{toaState.netClientId=crypto.randomUUID()}catch(_){toaState.netClientId=`toa-${Date.now()}-${Math.random().toString(36).slice(2)}`}
  }
  return toaState.netClientId;
}
function toaHasCombatAuthority(){
  if(toaState.mode!=='party')return true;
  if(toaState.localDead)return false;
  return toaState.isHost?!toaState.localDead:!!toaState.remoteDead;
}
function toaClaimCombatAuthority(){
  if(!toaHasCombatAuthority())return;
  // The surviving guest immediately takes over simulation if the host dies.
  if(toaState.room==='crondis-arena'&&toaState.fightActive&&!toaState.fightPaused){
    clearTimeout(toaState.attackTimer);
    toaState.attackTimer=setTimeout(toaChooseAttack,250);
  }
  toaNotice('Your teammate is down — you now control the encounter. Keep fighting!',2600);
}
function toaPartySend(payload){
  const ch=toaState.channel;if(!ch||!payload)return Promise.resolve('no-channel');
  try{return ch.send({type:'broadcast',event:'toa',payload:{...payload,clientId:toaGetNetClientId(),code:toaState.code,sentAt:Date.now()}})}catch(e){console.warn('TOA party send failed',e);return Promise.resolve('error')}
}
function toaStopJoinRetry(){clearInterval(toaState.joinRetryTimer);toaState.joinRetryTimer=0;}
function toaCloseChannel(){
  toaStopJoinRetry();clearInterval(toaState.netSyncTimer);clearInterval(toaState.heartbeatTimer);toaState.netSyncTimer=0;toaState.heartbeatTimer=0;toaState.netConnected=false;toaState.remoteTarget=null;
  if(toaState.channel){try{db.removeChannel(toaState.channel)}catch(e){try{toaState.channel.unsubscribe()}catch(_){}}toaState.channel=null}
}
function toaRaidSnapshot(){return{room:toaState.room,x:toaState.x,y:toaState.y,crondisComplete:toaState.crondisComplete,scarabasComplete:toaState.scarabasComplete,hetComplete:toaState.hetComplete,apmekenComplete:toaState.apmekenComplete,adminMode:toaState.adminMode,hostName:character?.username||'Host'};}
function toaApplyRaidSnapshot(snapshot){
  if(!snapshot)return;toaState.crondisComplete=!!snapshot.crondisComplete;toaState.scarabasComplete=!!snapshot.scarabasComplete;toaState.hetComplete=!!snapshot.hetComplete;toaState.apmekenComplete=!!snapshot.apmekenComplete;toaState.remoteAdminMode=!!snapshot.adminMode;toaState.hostName=snapshot.hostName||toaState.hostName;
  toaUpdateCrondisUnlock();toaUpdateContextAction();
}
function toaApplyRemoteMove(m){
  const mate=$('toaCrondisTeammate');if(!mate)return;
  toaState.remoteTarget={x:Number(m.x)||53,y:Number(m.y)||70,left:!!m.left,walking:!!m.walking};
  mate.classList.toggle('facing-left',!!m.left);mate.classList.toggle('walking',!!m.walking);
}
function toaConfirmParty(remoteName='Teammate'){
  const wasJoined=toaState.partyJoined;toaState.partyJoined=true;toaState.netConnected=true;toaStopJoinRetry();
  if(toaState.isHost)toaState.guestName=remoteName||'Teammate';else toaState.hostName=remoteName||toaState.hostName||'Host';
  toaUpdateCrondisUnlock();toaUpdateContextAction();
  if(!wasJoined)toaNotice(`${remoteName||'Your teammate'} joined the raid. Two-player co-op is ready.`,3500);
}
function toaHandlePartyMessage(m){
  if(!m||m.clientId===toaGetNetClientId()||m.code!==toaState.code)return;
  if(m.type==='join'&&toaState.isHost){toaConfirmParty(m.name);toaPartySend({type:'ack',sender:character?.id,name:character?.username||'Host',snapshot:toaRaidSnapshot()});if(toaState.adminMode)toaPartySend({type:'admin-unlock',enabled:true,sender:character?.id});}
  if(m.type==='ack'&&!toaState.isHost){toaApplyRaidSnapshot(m.snapshot);toaConfirmParty(m.name);toaPartySend({type:'guest-confirmed',sender:character?.id,name:character?.username||'Guest'});}
  if(m.type==='host-alive'&&!toaState.isHost){toaApplyRaidSnapshot(m.snapshot);toaConfirmParty(m.name);toaPartySend({type:'guest-confirmed',sender:character?.id,name:character?.username||'Guest'});}
  if(m.type==='guest-confirmed'&&toaState.isHost)toaConfirmParty(m.name);
  if(m.type==='snapshot-request'&&toaState.isHost)toaPartySend({type:'snapshot',sender:character?.id,name:character?.username||'Host',snapshot:toaRaidSnapshot()});
  if(m.type==='snapshot'&&!toaState.isHost){toaApplyRaidSnapshot(m.snapshot);toaConfirmParty(m.name);}
  if(m.type==='ready'){toaState.remoteReady=!!m.ready;if(toaState.room==='scarabas-safe'){toaRenderScarabasReady();toaTryStartScarabas()}else{toaRenderReady();toaTryStartCrondis();}}
  if(m.type==='prayer'){toaState.remotePrayer=m.prayer||null;toaRenderPrayer(true);}
  if(m.type==='enter-crondis'&&toaState.room==='nexus')toaEnterCrondisRoom(true);
  if(m.type==='enter-scarabas'&&toaState.room==='nexus')toaEnterScarabasRoom(true);
  if(m.type==='enter-het'&&toaState.room==='nexus')toaEnterHetRoom(true);
  if(m.type==='enter-apmeken'&&toaState.room==='nexus')toaEnterApmekenRoom(true);
  if(m.type==='ready-apmeken'&&toaState.room==='apmeken-ready'){toaState.remoteReady=!!m.ready;toaRenderApmekenReady();toaTryStartApmeken();}
  if(m.type==='start-apmeken'&&toaState.room==='apmeken-ready')toaStartApmekenArena(true);
  if(m.type==='ready-het'&&toaState.room==='het-ready'){toaState.remoteReady=!!m.ready;toaRenderHetReady();toaTryStartHet();}
  if(m.type==='start-het'&&toaState.room==='het-ready')toaStartHetArena(true);
  if(m.type==='weapon-het'){toaState.remoteHetWeapon=m.weapon||'melee';toaRenderHetWeapon(true);}
  if(m.type==='het-boss'&&toaState.room==='het-arena'&&!toaHasCombatAuthority()){toaState.hetBossX=Number(m.x)||50;toaState.hetBossY=Number(m.y)||28;toaState.hetBossTarget=Number(m.target)||0;toaState.hetBossFrame=Number(m.frame)||0;toaState.hetBossStyle=m.style||toaState.hetBossStyle;toaState.hetBossAttacking=!!m.attacking;if(m.shadowState)toaApplyHetShadowState(m.shadowState);toaRenderHetBoss();}
  if(m.type==='het-shadow-select'&&toaState.room==='het-arena'&&toaState.isHost){toaState.remoteHetSelectedShadow=m.quadrant||'ne';}
  if(m.type==='het-shadow-state'&&toaState.room==='het-arena'&&!toaHasCombatAuthority())toaApplyHetShadowState(m.state);
  if(m.type==='het-shadow-wave'&&toaState.room==='het-arena'&&!toaHasCombatAuthority())toaTriggerHetShadowWave(m.quadrant,true);
  if(m.type==='het-attack'&&toaState.room==='het-arena')toaResolveHetAttack(m.style,m.target,true,m.damage);
  if(m.type==='het-style-switch'&&toaState.room==='het-arena')toaShowAkkhaStyleSwitch(m.style,true);
  if(m.type==='het-symbol-start'&&toaState.room==='het-arena'&&!toaHasCombatAuthority())toaBeginHetSymbolPhase(Number(m.threshold),m.sequence,true);
  if(m.type==='het-final-start'&&toaState.room==='het-arena'&&!toaHasCombatAuthority()){toaState.hetBossX=Number(m.x)||50;toaState.hetBossY=Number(m.y)||28;toaState.hetBossHp=Math.max(1,Number(m.hp)||Math.round(toaState.hetBossMaxHp*(toaState.mode==='party'?.12:.20)));toaBeginAkkhaFinalStand(true);toaState.hetBossX=Number(m.x)||toaState.hetBossX;toaState.hetBossY=Number(m.y)||toaState.hetBossY;toaState.hetBossHp=Math.max(1,Number(m.hp)||toaState.hetBossHp);toaRenderHetBoss();toaUpdateHetHud();}
  if(m.type==='het-final-teleport'&&toaState.room==='het-arena'&&!toaHasCombatAuthority()){toaState.hetBossX=Number(m.x)||toaState.hetBossX;toaState.hetBossY=Number(m.y)||toaState.hetBossY;toaState.hetFinalHits=0;toaRenderHetBoss();}
  if(m.type==='het-orb-spawn'&&toaState.room==='het-arena'&&!toaHasCombatAuthority()&&m.orb){const o=m.orb;if(!toaState.hetOrbs.some(x=>x.id===o.id))toaState.hetOrbs.push({id:String(o.id),x:Number(o.x),y:Number(o.y),vx:Number(o.vx),vy:Number(o.vy),hitLocal:false,hitRemote:false});}
  if(m.type==='het-attack-request'&&toaState.room==='het-arena'&&toaHasCombatAuthority())toaResolveGuestHetAttack(m);
  if(m.type==='het-player-attack'&&toaState.room==='het-arena'&&!toaHasCombatAuthority())toaResolvePlayerAttackCycle(true,m);
  if(m.type==='het-hp'&&toaState.room==='het-arena'){toaState.remoteHetPlayerHp=Math.max(0,Number(m.hp)||0);}
  if(m.type==='het-player-dead'&&toaState.room==='het-arena'){toaState.remoteDead=true;$('toaHetTeammate')?.classList.add('toa-dead');if(toaState.localDead)toaShowDefeatedPanel(true);else{toaNotice('Your teammate has been defeated. Keep fighting Akkha!',4200);toaClaimCombatAuthority();}}
  if(m.type==='het-victory'&&toaState.room==='het-arena')toaDefeatAkkha(true);
  if(m.type==='het-helper-used')toaCompleteHetReturn(true);
  if(m.type==='move-het'&&toaState.room==='het-arena'){toaState.remoteHetX=Number(m.x)||54;toaState.remoteHetY=Number(m.y)||76;toaState.remoteHetTarget={x:toaState.remoteHetX,y:toaState.remoteHetY,left:!!m.left,walking:!!m.walking};const mate=$('toaHetTeammate');if(mate){mate.classList.toggle('facing-left',!!m.left);mate.classList.toggle('walking',!!m.walking);}}
  if(m.type==='kephri-helper-used')toaCompleteKephriReturn(true);
  if(m.type==='move-crondis'&&toaState.room==='crondis-arena')toaApplyRemoteMove(m);
  if(m.type==='move-apmeken'&&toaState.room==='apmeken-arena'){toaState.remoteApmekenX=Number(m.x)||52;toaState.remoteApmekenY=Number(m.y)||73;toaState.remoteApmekenTarget={x:toaState.remoteApmekenX,y:toaState.remoteApmekenY,left:!!m.left,walking:!!m.walking};const mate=$('toaApmekenTeammate');mate?.classList.toggle('facing-left',!!m.left);mate?.classList.toggle('walking',!!m.walking);}
  if(m.type==='move-scarabas'&&toaState.room==='scarabas-arena'){const mate=$('toaScarabasTeammate');toaState.remoteTarget={x:Number(m.x)||53,y:Number(m.y)||78,left:!!m.left,walking:!!m.walking,room:'scarabas'};toaState.remoteScarabasX=Number(m.x)||53;toaState.remoteScarabasY=Number(m.y)||78;mate?.classList.toggle('facing-left',!!m.left);mate?.classList.toggle('walking',!!m.walking);}
  if(m.type==='kephri-state'&&!toaHasCombatAuthority()&&toaState.room==='scarabas-arena'){toaState.kephriHp=Math.max(0,Number(m.hp)||0);toaUpdateKephriHud();}
  if(m.type==='kephri-player-attack'&&toaState.room==='scarabas-arena'){const el=$('toaScarabasPlayer');el?.classList.remove('toa-keris-strike');void el?.offsetWidth;el?.classList.add('toa-keris-strike');setTimeout(()=>el?.classList.remove('toa-keris-strike'),340);}
  if(m.type==='kephri-fireball'&&toaState.room==='scarabas-arena')toaSpawnKephriFireball(Number(m.x),Number(m.y),true);
  if(m.type==='kephri-dung'&&toaState.room==='scarabas-arena')toaSpawnKephriDung(true);
  if(m.type==='kephri-fleas'&&toaState.room==='scarabas-arena')toaExplodeKephriDung(true);
  if(m.type==='kephri-dung-strike'&&toaState.room==='scarabas-arena')toaPerformDungStrike(Number(m.x),Number(m.y),Number(m.dx),Number(m.dy),m.target==='host',true);
  if(m.type==='kephri-adds-spawn'&&toaState.room==='scarabas-arena')toaSpawnKephriAdds(true);
  if(m.type==='kephri-add-state'&&toaState.room==='scarabas-arena')toaApplyKephriAddState(m);
  if(m.type==='kephri-blue-blast'&&toaState.room==='scarabas-arena')toaKephriBlueBlast(true);
  if(m.type==='kephri-add-melee'&&toaState.room==='scarabas-arena'&&m.target==='guest')toaResolveKephriAddMelee(false);
  if(m.type==='kephri-dive'&&toaState.room==='scarabas-arena')toaSpawnKephriDiveScarab(Number(m.x),Number(m.y),true);
  if(m.type==='kephri-victory'&&toaState.room==='scarabas-arena')toaDefeatKephri(true);
  if(m.type==='kephri-player-dead'){toaState.remoteDead=true;$('toaScarabasTeammate')?.classList.add('toa-dead');if(toaState.localDead)toaShowDefeatedPanel(true);else{toaNotice('Your teammate has been defeated. Keep fighting Kephri!',4200);toaClaimCombatAuthority();}}
  if(m.type==='nexus-chat'&&toaState.room==='nexus')toaShowNexusChat(m.text,true);
  if(m.type==='player-dead'){toaState.remoteDead=true;$('toaCrondisTeammate')?.classList.add('toa-dead');if(toaState.localDead)toaShowDefeatedPanel(true);else{toaNotice('Your teammate has been defeated. Finish the fight to revive them!',4200);toaClaimCombatAuthority();}}
  if(m.type==='zebak-victory')toaHandlePartyVictory(true);
  if(m.type==='zebak-attack'&&!toaHasCombatAuthority()&&toaState.room==='crondis-arena')toaTelegraphAttack(m.attackType,true);
  if(m.type==='zebak-acid'&&!toaHasCombatAuthority()&&toaState.room==='crondis-arena'){if(m.final)toaSpawnFinalAcid(m.pools,true);else toaSpawnAcid(m.pools,true);}
  if(m.type==='boss-state'&&!toaHasCombatAuthority()&&toaState.room==='crondis-arena'){const previous=toaState.zebakHp;toaState.zebakHp=Math.max(0,Number(m.hp)||0);toaUpdateCombatHud();if(m.phase&&Number(m.phase)!==toaState.phase){toaState.phase=Number(m.phase);const labels={1:'NORMAL ATTACKS · 100% → 70%',2:'ACID PHASE · 70% → 60%',3:'TIDAL WAVES · 60% → 40%',4:'BLOOD ORBS · 40% → 25%',5:'ENRAGED · 25% → 10%',6:'FINAL RAGE · 10% → 0%'};if($('toaZebakPhase'))$('toaZebakPhase').textContent=labels[toaState.phase]||'';}if(previous>0&&toaState.zebakHp<=0)toaHandlePartyVictory(true);}
  if(m.type==='admin-unlock'){toaState.remoteAdminMode=!!m.enabled;toaUpdateCrondisUnlock();toaUpdateContextAction();toaNotice(m.enabled?'Party host enabled TOA admin test access.':'Party admin test access disabled.',2600);}
  if(m.type==='leave'){toaState.partyJoined=false;toaState.remoteReady=false;toaState.netConnected=false;toaUpdateCrondisUnlock();toaRenderReady();toaNotice('Your teammate left the raid party.',2500);}
}
function toaOpenChannel(code,host){
  toaCloseChannel();toaState.isHost=!!host;toaState.connectionAttempts=0;
  const key=toaGetNetClientId();
  const ch=db.channel(`toa-party-${code}`,{config:{broadcast:{self:false,ack:true},presence:{key}}});toaState.channel=ch;
  ch.on('broadcast',{event:'toa'},({payload})=>toaHandlePartyMessage(payload));
  ch.on('presence',{event:'sync'},()=>{const count=Object.values(ch.presenceState()||{}).flat().length;if(count>=2){if(host)toaPartySend({type:'ack',sender:character?.id,name:character?.username||'Host',snapshot:toaRaidSnapshot()});else toaPartySend({type:'join',sender:character?.id,name:character?.username||'Guest'});}});
  ch.subscribe(async status=>{
    if(status==='SUBSCRIBED'){
      toaState.netConnected=true;await ch.track({clientId:toaGetNetClientId(),userId:character?.id||null,name:character?.username||'Raider',role:host?'host':'guest',onlineAt:new Date().toISOString()});
      if(!host){const handshake=()=>{if(toaState.partyJoined)return;toaState.connectionAttempts++;toaPartySend({type:'join',sender:character?.id,name:character?.username||'Guest'});toaPartySend({type:'snapshot-request',sender:character?.id});if(toaState.connectionAttempts===8)toaNotice('Still connecting to the host… checking the live room again.',3000);};handshake();toaState.joinRetryTimer=setInterval(handshake,1000);}
      if(host){toaState.heartbeatTimer=setInterval(()=>db.from('toa_rooms').update({updated_at:new Date().toISOString()}).eq('id',toaState.roomId),30000);clearInterval(toaState.netSyncTimer);let lastLobbyAck=0;toaState.netSyncTimer=setInterval(()=>{const now=Date.now();if(!toaState.partyJoined&&now-lastLobbyAck>1000){lastLobbyAck=now;toaPartySend({type:'host-alive',name:character?.username||'Host',snapshot:toaRaidSnapshot()});}if(toaState.fightActive)toaPartySend({type:'boss-state',sender:character?.id,hp:toaState.zebakHp,phase:toaState.phase});},100);}
    }else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')toaNotice('Raid connection interrupted — Supabase Realtime is reconnecting…',3000);
  });
}
async function toaCreatePartyRoom(){
  if(!character)return toaNotice('Log in before creating a co-op raid.',3000);
  const user=(await db.auth.getUser()).data.user;if(!user)return toaNotice('Your login session has expired. Sign in again.',3500);
  $('toaCreateParty').disabled=true;
  try{
    for(let attempt=0;attempt<8;attempt++){
      const code=toaRandomCode();const {data,error}=await db.from('toa_rooms').insert({code,host_user_id:user.id,host_name:character.username,status:'lobby'}).select().single();
      if(!error&&data){toaState.roomId=data.id;toaState.hostCode=code;toaState.hostName=character.username;toaSetMode('party',code);return;}
      if(error?.code!=='23505'){console.error(error);toaNotice(error?.message?.includes('toa_rooms')?'Install add-toa-two-player-coop.sql in Supabase first.':'Could not create the raid room.',5000);return;}
    }
    toaNotice('Could not generate a unique room code. Try again.',3500);
  }finally{$('toaCreateParty').disabled=false;}
}
async function toaJoinPartyRoom(){
  if(!character)return toaNotice('Log in before joining a co-op raid.',3000);
  const code=$('toaCodeInput').value.trim().toUpperCase();if(!/^[A-HJ-NP-Z2-9]{6}$/.test(code)){toaNotice('Enter the six-character room code.');return;}
  $('toaJoinParty').disabled=true;toaNotice(`Finding raid ${code}…`,2200);
  try{
    const {data,error}=await db.rpc('join_toa_room',{p_code:code,p_guest_name:character.username});const room=data?.[0];
    if(error||!room){const msg=error?.message||'';toaNotice(msg.includes('ROOM_FULL')?'That raid already has two players.':msg.includes('ROOM_NOT_FOUND')?'That room code does not exist or has expired.':msg.includes('join_toa_room')?'Install add-toa-two-player-coop.sql in Supabase first.':'Could not join that raid room.',4500);return;}
    toaState.roomId=room.id;toaState.hostCode='';toaState.hostName=room.host_name||'Host';toaState.guestName=character.username;toaSetMode('party',code);toaNotice(`Room found. Connecting to ${toaState.hostName}…`,3000);
  }finally{$('toaJoinParty').disabled=false;}
}
function toaShowNexusChat(text,remote=false){
  const clean=String(text||'').trim().slice(0,80);if(!clean)return;
  if(remote){
    let bubble=document.getElementById('toaRemoteChatBubble');
    if(!bubble){bubble=document.createElement('span');bubble.id='toaRemoteChatBubble';bubble.className='toa-chat-bubble toa-remote-chat';$('toaPartyPlayers')?.appendChild(bubble)}
    bubble.textContent=clean;bubble.classList.remove('hidden');clearTimeout(bubble.timer);bubble.timer=setTimeout(()=>bubble.classList.add('hidden'),5000);return;
  }
  const bubble=$('toaChatBubble');if(!bubble)return;bubble.textContent=clean;bubble.classList.remove('hidden');clearTimeout(toaState.chatTimer);toaState.chatTimer=setTimeout(()=>bubble.classList.add('hidden'),5000);
}
function toaOpenChat(){
  if(!toaState.active||toaState.room!=='nexus'||toaState.chatTyping)return;
  toaState.chatTyping=true;toaState.keys={};$('toaChatForm')?.classList.remove('hidden');const input=$('toaChatInput');if(input){input.value='';setTimeout(()=>input.focus(),0)}
}
function toaCloseChat(){toaState.chatTyping=false;$('toaChatForm')?.classList.add('hidden');$('toaLobby')?.focus()}
function toaSendChat(){
  const input=$('toaChatInput'),text=input?.value.trim();if(!text){toaCloseChat();return}
  toaShowNexusChat(text,false);if(toaState.channel)toaPartySend({type:'nexus-chat',text,sender:character?.id});toaCloseChat();
}
function toaSetMode(mode,code=''){
  if(toaState.mode!=='none')return;
  toaState.mode=mode;toaState.code=code;toaState.active=true;toaState.partyJoined=mode==='solo';toaState.localReady=false;toaState.remoteReady=false;
  const status=$('toaPartyStatus');status.innerHTML=mode==='solo'?'<b>MODE</b> SINGLE PLAYER':`<b>PARTY CODE</b> ${code}`;
  $('toaPartyBar')?.classList.add('raid-started');
  $('toaGameShell')?.classList.remove('mode-pending');$('toaModeGate')?.classList.add('hidden');
  if(mode==='party')toaOpenChannel(code,code===toaState.hostCode);else toaCloseChannel();
  startToaLobbyMusic();toaUpdateCrondisUnlock();
  toaNotice(mode==='solo'?'Solo raid started. Path of Crondis is now open.':`Party ${code} created. Share this code and wait for a teammate.` ,3800);
  $('toaLobby').focus();
}
function toaRandomCode(){const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';return Array.from({length:6},()=>chars[Math.floor(Math.random()*chars.length)]).join('')}
function toaBlocked(x,y){
  if(x<4||x>96||y<4||y>93)return true;
  if(x<7 && y>34 && y<70)return true;
  if(x>93 && y>34 && y<70)return true;
  if(y<8 && x>10 && x<37)return true;
  if(y<8 && x>63 && x<90)return true;
  if(y<7 && x>=42 && x<=58)return true;
  return false;
}
function toaEntranceMessage(x,y){
  if(x<8&&y>30&&y<74)return 'Path of Het is sealed.';
  if(x>92&&y>30&&y<74)return 'Path of Apmeken is sealed.';
  if(y<12&&x>9&&x<39)return toaUpdateCrondisUnlock()?'Stand on the red entrance and press E.':'Path of Crondis unlocks once your raid party is ready.';
  if(y<12&&x>61&&x<91)return toaNearScarabas()?'Stand on the Scarabas entrance and press E.':(toaHasAdminAccess()||toaState.crondisComplete)?'Path of Scarabas is open — approach the entrance.':'Path of Scarabas is sealed until Crondis is complete.';
  if(y<10&&x>=39&&x<=61)return 'The Wardens : Final Challenge is sealed.';
  return 'You cannot walk beyond the edge of the Nexus.';
}
function startToaLobbyMusic(){const music=$('toaLobbyMusic');if(!music)return;music.volume=.38;music.play().catch(()=>{})}
function stopToaLobbyMusic(){const music=$('toaLobbyMusic');if(!music)return;music.pause();music.currentTime=0}
function startToaCrondisMusic(){const m=$('toaCrondisMusic');if(!m)return;m.volume=.42;m.play().catch(()=>{})}
function stopToaCrondisMusic(){const m=$('toaCrondisMusic');if(!m)return;m.pause();m.currentTime=0}
function startToaScarabasMusic(){const m=$('toaScarabasMusic');if(!m)return;m.volume=.42;m.currentTime=0;m.play().catch(()=>{})}
function stopToaScarabasMusic(){const m=$('toaScarabasMusic');if(!m)return;m.pause();m.currentTime=0}
function startToaHetMusic(){const m=$('toaHetMusic');if(!m)return;m.volume=.46;m.currentTime=0;m.play().catch(()=>{})}
function stopToaHetMusic(){const m=$('toaHetMusic');if(!m)return;m.pause();m.currentTime=0}
function startToaApmekenMusic(){const m=$('toaApmekenMusic');if(!m)return;m.volume=.46;m.currentTime=0;m.play().catch(()=>{})}
function stopToaApmekenMusic(){const m=$('toaApmekenMusic');if(!m)return;m.pause();m.currentTime=0}
function toaNearCrondis(){return toaState.room==='nexus'&&(toaHasAdminAccess()||!toaState.crondisComplete)&&toaState.y>=10&&toaState.y<=27&&toaState.x>=14&&toaState.x<=30&&toaUpdateCrondisUnlock()}
function toaNearHet(){return toaState.room==='nexus'&&(toaHasAdminAccess()||toaState.scarabasComplete)&&!toaState.hetComplete&&toaState.y>=45&&toaState.y<=68&&toaState.x>=3&&toaState.x<=23&&(toaState.mode==='solo'||(toaState.mode==='party'&&toaState.partyJoined))}
function toaNearApmeken(){return toaState.room==='nexus'&&(toaHasAdminAccess()||toaState.hetComplete)&&(toaHasAdminAccess()||!toaState.apmekenComplete)&&toaState.y>=45&&toaState.y<=68&&toaState.x>=77&&toaState.x<=97&&(toaState.mode==='solo'||(toaState.mode==='party'&&toaState.partyJoined))}
function toaNearScarabas(){return toaState.room==='nexus'&&(toaHasAdminAccess()||toaState.crondisComplete)&&(toaHasAdminAccess()||!toaState.scarabasComplete)&&toaState.y>=10&&toaState.y<=27&&toaState.x>=70&&toaState.x<=86&&(toaState.mode==='solo'||(toaState.mode==='party'&&toaState.partyJoined))}
// Scarabas arena collision: keep raiders on the tiled floor and off the central boss plinth.
function toaScarabasBlocked(x,y){
  if(x>=38.5&&x<=62.5&&y>=37.5&&y<=65)return true;
  return toaState.kephriDungWalls.some(w=>Math.hypot(x-w.x,y-w.y)<3.15);
}
function toaUpdateContextAction(){const c=$('toaEnterCrondis'),s=$('toaEnterScarabas'),h=$('toaEnterHet'),a=$('toaEnterApmeken');if(c)c.classList.toggle('hidden',!toaNearCrondis());if(s)s.classList.toggle('hidden',!toaNearScarabas());if(h)h.classList.toggle('hidden',!toaNearHet());if(a)a.classList.toggle('hidden',!toaNearApmeken())}
function toaRenderPrayer(remote=false){
  const prayer=remote?toaState.remotePrayer:toaState.prayer;
  const overhead=$(toaState.room.startsWith('het')?(remote?'toaHetTeammatePrayerOverhead':'toaHetPrayerOverhead'):toaState.room.startsWith('scarabas')?(remote?'toaScarabasTeammatePrayerOverhead':'toaScarabasPrayerOverhead'):(remote?'toaTeammatePrayerOverhead':'toaPrayerOverhead'));
  if(overhead){overhead.classList.toggle('hidden',!prayer);if(prayer){overhead.src='assets/toa-pray-'+prayer+'.png';overhead.alt=prayer==='magic'?'Protect from Magic':prayer==='ranged'?'Protect from Missiles':'Protect from Melee';}}
  if(!remote)document.querySelectorAll('[data-toa-prayer]').forEach(b=>b.classList.toggle('active',b.dataset.toaPrayer===prayer));
}

function toaRenderFood(){
  const containers=[$('toaSharkSlots'),$('toaScarabasSharkSlots'),$('toaHetSharkSlots')].filter(Boolean);if(!containers.length)return;
  containers.forEach(slots=>{slots.innerHTML='';for(let i=0;i<toaState.sharks;i++){const b=document.createElement('button');b.type='button';b.className='toa-food-slot';b.title='Eat shark';b.setAttribute('aria-label','Eat shark');b.innerHTML='<img src="assets/toa-shark.png" alt="Shark">';b.addEventListener('click',()=>toaEatShark(b));slots.appendChild(b);}});
}
function toaEatShark(button){
  const inCrondis=toaState.room==='crondis-arena'&&toaState.fightActive&&!toaState.fightPaused;
  const inScarabas=toaState.room==='scarabas-arena'&&toaState.kephriActive;
  const inHet=toaState.room==='het-arena';
  if((!inCrondis&&!inScarabas&&!inHet)||toaState.sharks<=0){if(toaState.room==='crondis-safe'||toaState.room==='scarabas-safe'||toaState.room==='het-ready')toaNotice('You cannot use supplies before the fight begins.',1300);return;}
  toaState.sharks--;button.classList.add('eaten');
  if(inScarabas){toaState.kephriPlayerHp=Math.min(99,toaState.kephriPlayerHp+20);toaUpdateKephriHud();}
  else if(inHet){toaState.hetPlayerHp=Math.min(toaState.hetPlayerMaxHp,toaState.hetPlayerHp+20);toaUpdateHetHud();toaDamageSplat(toaState.hetX,toaState.hetY-5,'+20','heal');}
  else{toaState.playerHp=Math.min(toaState.playerMaxHp,toaState.playerHp+20);toaUpdateCombatHud();toaDamageSplat(toaState.arenaX,toaState.arenaY-5,'+20','heal');}
  const player=$(inHet?'toaHetPlayer':inScarabas?'toaScarabasPlayer':'toaCrondisPlayer');if(player){player.classList.remove('toa-eating');void player.offsetWidth;player.classList.add('toa-eating');setTimeout(()=>player.classList.remove('toa-eating'),380)}
  setTimeout(toaRenderFood,230);toaNotice('You eat the shark.',900);
}

function toaSetPrayer(prayer){
  if(toaState.room==='nexus')return;
  toaState.prayer=toaState.prayer===prayer?null:prayer;toaRenderPrayer(false);
  if(toaState.channel)toaPartySend({type:'prayer',prayer:toaState.prayer,sender:character?.id});
}

function toaRenderHetWeapon(remote=false){
  const weapon=remote?toaState.remoteHetWeapon:toaState.hetWeapon;
  const player=$(remote?'toaHetTeammate':'toaHetPlayer');
  const image=$(remote?'toaHetTeammateHeldWeapon':'toaHetHeldWeapon');
  if(player)player.dataset.weapon=weapon;
  if(image){image.src='assets/toa-het-'+weapon+'.png';image.alt=weapon.charAt(0).toUpperCase()+weapon.slice(1)+' weapon';}
  if(!remote){
    document.querySelectorAll('[data-het-weapon]').forEach(b=>b.classList.toggle('active',b.dataset.hetWeapon===weapon));
    const label=$('toaHetDamageStyle');if(label)label.textContent=weapon.toUpperCase()+' DAMAGE';
  }
}
function toaSetHetWeapon(weapon){
  if(!['melee','ranged','magic'].includes(weapon))return;
  toaState.hetWeapon=weapon;toaRenderHetWeapon(false);
  const p=$('toaHetPlayer');if(p){p.classList.remove('toa-weapon-swap');void p.offsetWidth;p.classList.add('toa-weapon-swap');setTimeout(()=>p.classList.remove('toa-weapon-swap'),260)}
  if(toaState.channel)toaPartySend({type:'weapon-het',weapon,sender:character?.id});
  toaNotice(weapon.charAt(0).toUpperCase()+weapon.slice(1)+' weapon equipped · '+weapon+' damage',1100);
  document.dispatchEvent(new CustomEvent('toa-het-weapon-change',{detail:{weapon,damageType:weapon}}));
}


function toaUpdateHetHud(){
  const pct=Math.max(0,Math.min(100,toaState.hetPlayerHp/toaState.hetPlayerMaxHp*100));
  const fill=$('toaHetPlayerHpFill'),text=$('toaHetPlayerHpText');if(fill)fill.style.width=pct+'%';if(text)text.textContent=Math.ceil(toaState.hetPlayerHp)+' / '+toaState.hetPlayerMaxHp;
  const bp=Math.max(0,Math.min(100,toaState.hetBossHp/toaState.hetBossMaxHp*100));const bf=$('toaHetBossHpFill'),bt=$('toaHetBossHpText');if(bf)bf.style.width=bp+'%';if(bt)bt.textContent=Math.ceil(bp)+'%';
}
function toaRenderHetBoss(){
  const boss=$('toaHetBoss'),img=$('toaHetBossSprite'),pray=$('toaHetBossPrayer');if(!boss||!img)return;
  if(toaState.hetHelperActive||toaState.hetComplete){boss.classList.add('hidden');boss.style.display='none';return;}
  boss.style.display='';boss.classList.toggle('hidden',!!toaState.hetSymbolActive);if(toaState.hetSymbolActive)return;boss.style.left=toaState.hetBossX+'%';boss.style.top=toaState.hetBossY+'%';
  const targets=toaState.hetBossTarget===1?toaState.remoteHetX:toaState.hetX;boss.classList.toggle('facing-left',targets<toaState.hetBossX);
  img.src=toaState.hetBossAttacking?'assets/toa-het-boss-attack-'+((toaState.hetBossFrame%2)+1)+'.png':'assets/toa-het-boss-walk-'+((toaState.hetBossFrame%2)+1)+'.png';
  boss.classList.toggle('toa-final-stand',!!toaState.hetFinalStand);
  if(pray){pray.src='assets/toa-pray-'+(toaState.hetFinalStand?'magic':toaState.hetBossStyle)+'.png';pray.classList.remove('hidden');pray.alt='Protect from '+toaState.hetBossStyle;}
  boss.dataset.style=toaState.hetBossStyle;
}
function toaHetSplat(x,y,text,kind=''){const fx=$('toaHetEffects');if(!fx)return;const s=document.createElement('b');s.className='toa-damage-splat '+kind;s.textContent=text;s.style.left=x+'%';s.style.top=y+'%';fx.appendChild(s);setTimeout(()=>s.remove(),780)}
const toaAkkhaAttackSounds={
  melee:new Audio('assets/toa-akkha-melee.wav'),
  magic:new Audio('assets/toa-akkha-magic.wav'),
  ranged:new Audio('assets/toa-akkha-ranged.wav')
};
Object.values(toaAkkhaAttackSounds).forEach(a=>{a.preload='auto';a.volume=.32});
function toaPlayAkkhaAttackSound(style){
  const base=toaAkkhaAttackSounds[style];if(!base)return;
  try{const a=base.cloneNode();a.volume=style==='melee'?.34:.3;a.play().catch(()=>{});}catch(e){}
}
const toaAkkhaStyleSwitchSound=new Audio('assets/toa-akkha-style-switch.wav');
toaAkkhaStyleSwitchSound.preload='auto';toaAkkhaStyleSwitchSound.volume=.34;
function toaShowAkkhaStyleSwitch(style,remoteEvent=false){
  const boss=$('toaHetBoss'),fx=$('toaHetEffects');
  try{const a=toaAkkhaStyleSwitchSound.cloneNode();a.volume=.34;a.play().catch(()=>{});}catch(e){}
  if(boss){
    boss.classList.remove('toa-style-switch');void boss.offsetWidth;boss.classList.add('toa-style-switch');
    toaState.hetBossAttacking=true;toaState.hetBossFrame=1;toaRenderHetBoss();
    setTimeout(()=>{boss.classList.remove('toa-style-switch');toaState.hetBossAttacking=false;toaRenderHetBoss()},850);
  }
  if(fx){
    const pulse=document.createElement('i');pulse.className='toa-akkha-style-pulse '+style;
    pulse.style.left=toaState.hetBossX+'%';pulse.style.top=toaState.hetBossY+'%';fx.appendChild(pulse);setTimeout(()=>pulse.remove(),950);
    const label=document.createElement('b');label.className='toa-akkha-style-label '+style;label.textContent=style.toUpperCase();label.style.left=toaState.hetBossX+'%';label.style.top=(toaState.hetBossY-12)+'%';fx.appendChild(label);setTimeout(()=>label.remove(),1000);
  }
  toaNotice('Akkha stomps his spear and switches to '+style+'!',1800);
}
function toaSpawnAkkhaProjectile(style,targetX,targetY,delay=0){
  if(style!=='magic'&&style!=='ranged')return;
  setTimeout(()=>{
    const fx=$('toaHetEffects');if(!fx||toaState.room!=='het-arena')return;
    const r=fx.getBoundingClientRect();
    const sx=toaState.hetBossX/100*r.width,sy=toaState.hetBossY/100*r.height;
    const ex=targetX/100*r.width,ey=targetY/100*r.height;
    const dx=ex-sx,dy=ey-sy,angle=Math.atan2(dy,dx)*180/Math.PI;
    const el=document.createElement('i');el.className='toa-akkha-projectile '+style;
    el.style.left=sx+'px';el.style.top=sy+'px';el.style.setProperty('--dx',dx+'px');el.style.setProperty('--dy',dy+'px');el.style.setProperty('--angle',angle+'deg');
    fx.appendChild(el);setTimeout(()=>el.remove(),760);
  },delay);
}
function toaShowAkkhaProjectiles(style){
  if(style!=='magic'&&style!=='ranged')return;
  toaSpawnAkkhaProjectile(style,toaState.hetX,toaState.hetY-1,0);
  if(toaState.mode==='party')toaSpawnAkkhaProjectile(style,toaState.remoteHetX,toaState.remoteHetY-1,90);
}
function toaResolveHetAttack(style,target,remoteEvent=false,fixedDamage){
  if(toaState.raidDefeated||toaState.localDead&&toaState.remoteDead)return;
  const targetsGuest=target===1;
  const isLocalTarget=toaState.mode==='solo'||(toaState.isHost?!targetsGuest:targetsGuest);
  const damage=Number.isFinite(Number(fixedDamage))?Number(fixedDamage):20+Math.floor(Math.random()*11);
  toaPlayAkkhaAttackSound(style);toaShowAkkhaProjectiles(style);
  toaState.hetBossAttacking=true;toaState.hetBossFrame=0;toaRenderHetBoss();setTimeout(()=>{toaState.hetBossFrame=1;toaRenderHetBoss()},240);setTimeout(()=>{toaState.hetBossAttacking=false;toaRenderHetBoss()},620);

  // Akkha's melee swing only threatens the player he is focusing and only while
  // they are physically beside him. Ranged and magic are room-wide attacks and
  // resolve independently against every living player at any distance.
  if(style==='melee'){
    if(!isLocalTarget)return;
    const meleeDistance=Math.hypot(toaState.hetX-toaState.hetBossX,toaState.hetY-toaState.hetBossY);
    const meleeRange=11;
    if(meleeDistance>meleeRange){
      toaHetSplat(toaState.hetBossX,toaState.hetBossY-7,'MISS','blocked');
      toaNotice('Akkha’s melee attack misses — you are out of range.',1000);
      return;
    }
  }

  const blocked=toaState.prayer===style;toaHetSplat(toaState.hetX,toaState.hetY-6,blocked?'0':damage,blocked?'blocked':'');
  if(blocked){toaNotice('Prayer blocked Akkha’s '+style+' attack!',1000);return;}
  toaState.hetPlayerHp=Math.max(0,toaState.hetPlayerHp-damage);$('toaHetPlayer')?.classList.add('toa-hit');setTimeout(()=>$('toaHetPlayer')?.classList.remove('toa-hit'),320);toaUpdateHetHud();toaNotice('Akkha hits you for '+damage+' '+style+' damage!',1300);
  if(toaState.channel)toaPartySend({type:'het-hp',hp:toaState.hetPlayerHp,sender:character?.id});
  if(toaState.hetPlayerHp<=0&&!toaState.localDead){
    toaState.localDead=true;$('toaHetPlayer')?.classList.add('toa-dead');
    if(toaState.channel)toaPartySend({type:'het-player-dead',sender:character?.id});
    if(toaState.mode==='solo'||toaState.remoteDead)toaShowDefeatedPanel(toaState.mode==='party');
    else toaNotice('You have been defeated. Your teammate is still fighting Akkha!',5000);
  }
}

const TOA_HET_SHADOW_POS={nw:{x:25,y:31},ne:{x:75,y:31},sw:{x:25,y:72},se:{x:75,y:72}};
const TOA_HET_THRESHOLDS=[80,60,40,20];
function toaHetQuadrantAt(x,y){return (y<50?(x<50?'nw':'ne'):(x<50?'sw':'se'));}

const TOA_HET_SYMBOL_THRESHOLDS=[72,57,37,15];
const TOA_HET_SYMBOLS={nw:{name:'lightning',x:36.5,y:36},ne:{name:'ice',x:63.5,y:36},sw:{name:'skull',x:36.5,y:64},se:{name:'fire',x:63.5,y:64}};
const TOA_HET_SYMBOL_NEIGHBORS={nw:['ne','sw'],ne:['nw','se'],sw:['nw','se'],se:['ne','sw']};
const toaAkkhaSymbolSound=new Audio('assets/toa-akkha-symbol-glow.wav');toaAkkhaSymbolSound.preload='auto';toaAkkhaSymbolSound.volume=.38;
const toaAkkhaFireWaveSound=new Audio('assets/toa-akkha-fire-wave.wav');toaAkkhaFireWaveSound.preload='auto';toaAkkhaFireWaveSound.volume=.44;
function toaPlayAkkhaSymbolSound(){try{const a=toaAkkhaSymbolSound.cloneNode();a.volume=.38;a.play().catch(()=>{});}catch(e){}}
function toaPlayAkkhaFireWaveSound(){try{const a=toaAkkhaFireWaveSound.cloneNode();a.volume=.44;a.play().catch(()=>{});}catch(e){}}
function toaClearHetSymbolTimers(){(toaState.hetSymbolTimers||[]).forEach(clearTimeout);toaState.hetSymbolTimers=[];}
function toaCreateHetSymbolSequence(){
  const keys=Object.keys(TOA_HET_SYMBOLS),seq=[keys[Math.floor(Math.random()*keys.length)]];
  while(seq.length<4){const choices=TOA_HET_SYMBOL_NEIGHBORS[seq[seq.length-1]].filter(q=>q!==seq[seq.length-2]);seq.push((choices.length?choices:TOA_HET_SYMBOL_NEIGHBORS[seq[seq.length-1]])[Math.floor(Math.random()*(choices.length||2))]);}
  return seq;
}
function toaRenderHetSymbolFlash(q,step){
  const fx=$('toaHetEffects');if(!fx)return;fx.querySelectorAll('.toa-akkha-symbol-cue').forEach(e=>e.remove());
  const d=TOA_HET_SYMBOLS[q],el=document.createElement('i');el.className='toa-akkha-symbol-cue '+q;el.style.left=d.x+'%';el.style.top=d.y+'%';el.innerHTML='<b>'+d.name.toUpperCase()+'</b><span>'+(step+1)+' / 4</span>';fx.appendChild(el);toaPlayAkkhaSymbolSound();
}
function toaResolveHetSymbolBurst(safeQ){
  toaPlayAkkhaFireWaveSound();
  const fx=$('toaHetEffects');if(fx){fx.querySelectorAll('.toa-akkha-symbol-cue').forEach(e=>e.remove());for(const q of Object.keys(TOA_HET_SYMBOLS)){if(q===safeQ)continue;const wave=document.createElement('i');wave.className='toa-akkha-symbol-blast '+q;fx.appendChild(wave);setTimeout(()=>wave.remove(),900);}}
  const localQ=toaHetQuadrantAt(toaState.hetX,toaState.hetY);if(localQ!==safeQ&&!toaState.localDead)toaDamageLocalHetPlayer(40,'The quadrant blast hits you for 40!');else toaHetSplat(toaState.hetX,toaState.hetY-6,'SAFE','blocked');
}
function toaEndHetSymbolPhase(){
  toaClearHetSymbolTimers();toaState.hetSymbolActive=false;toaState.hetSymbolSequence=[];toaState.hetSymbolStep=0;const fx=$('toaHetEffects');fx?.querySelectorAll('.toa-akkha-symbol-cue').forEach(e=>e.remove());$('toaHetBoss')?.classList.remove('hidden');toaState.hetBossNextAttack=performance.now()+2400;toaState.hetBossNextPlayerAttack=performance.now()+900;toaRenderHetBoss();toaShowShadowNotice('AKKHA RETURNS');
}
function toaBeginHetSymbolPhase(threshold,sequence=null,fromParty=false){
  if(toaState.hetSymbolActive||toaState.raidDefeated)return;
  toaClearHetSymbolTimers();
  toaState.hetSymbolActive=true;
  toaState.hetSymbolThresholdsDone=[...new Set([...(toaState.hetSymbolThresholdsDone||[]),threshold])];
  toaState.hetSymbolSequence=Array.isArray(sequence)&&sequence.length===4?sequence:toaCreateHetSymbolSequence();
  toaState.hetSymbolStep=0;
  toaState.hetBossHp=toaState.hetBossMaxHp*threshold/100;
  toaUpdateHetHud();
  $('toaHetBoss')?.classList.add('hidden');
  toaShowShadowNotice('MEMORISE THE ORDER');
  toaNotice('Watch all four symbols, then repeat the route during the blasts.',3800);
  if(!fromParty&&toaState.mode==='party')toaPartySend({type:'het-symbol-start',threshold,sequence:toaState.hetSymbolSequence,sender:character?.id});

  const flashGap=850, flashVisible=650, recallPause=800, burstGap=1750;
  toaState.hetSymbolSequence.forEach((q,i)=>{
    const at=i*flashGap;
    toaState.hetSymbolTimers.push(setTimeout(()=>{
      if(!toaState.hetSymbolActive)return;
      toaState.hetSymbolStep=i;
      toaRenderHetSymbolFlash(q,i);
    },at));
    toaState.hetSymbolTimers.push(setTimeout(()=>{
      if(!toaState.hetSymbolActive)return;
      $('toaHetEffects')?.querySelectorAll('.toa-akkha-symbol-cue').forEach(e=>e.remove());
    },at+flashVisible));
  });

  const playbackStart=toaState.hetSymbolSequence.length*flashGap+recallPause;
  toaState.hetSymbolTimers.push(setTimeout(()=>{
    if(!toaState.hetSymbolActive)return;
    toaShowShadowNotice('REPEAT THE SEQUENCE');
    toaNotice('Move to each remembered quadrant before its blast.',2500);
  },playbackStart-350));

  toaState.hetSymbolSequence.forEach((q,i)=>{
    const at=playbackStart+i*burstGap;
    toaState.hetSymbolTimers.push(setTimeout(()=>{
      if(!toaState.hetSymbolActive)return;
      toaState.hetSymbolStep=i;
      toaResolveHetSymbolBurst(q);
    },at));
  });
  toaState.hetSymbolTimers.push(setTimeout(toaEndHetSymbolPhase,playbackStart+toaState.hetSymbolSequence.length*burstGap+350));
}
function toaHetShadowState(){const now=performance.now();return{phase:toaState.hetShadowPhase,active:toaState.hetShadowActive,unlocked:toaState.hetShadowUnlockedQuadrant,shadows:Object.fromEntries(Object.entries(toaState.hetShadows).map(([k,v])=>[k,{hp:v.hp,dead:v.dead,charging:!!v.charging,chargeRemaining:v.charging?Math.max(0,v.chargeEnd-now):0}]))};}
function toaApplyHetShadowState(st){
  if(!st)return;const now=performance.now();toaState.hetShadowPhase=Number(st.phase)||0;toaState.hetShadowActive=!!st.active;toaState.hetShadowUnlockedQuadrant=st.unlocked||null;
  if(st.shadows)for(const q of Object.keys(TOA_HET_SHADOW_POS)){const v=st.shadows[q];if(v)toaState.hetShadows[q]={hp:Math.max(0,Number(v.hp)||0),dead:!!v.dead,charging:!!v.charging,chargeEnd:!!v.charging?now+Math.max(0,Number(v.chargeRemaining)||0):0};}
  toaRenderHetShadows();
}
function toaShowShadowNotice(text){const fx=$('toaHetEffects');if(!fx)return;const n=document.createElement('div');n.className='toa-shadow-phase-notice';n.textContent=text;fx.appendChild(n);setTimeout(()=>n.remove(),2450);}
function toaRenderHetShadows(){
  const box=$('toaHetShadows'),fx=$('toaHetEffects');if(!box)return;
  if(!box.dataset.targetHandler){box.dataset.targetHandler='1';box.addEventListener('pointerdown',e=>{const el=e.target.closest('.toa-akkha-shadow');if(!el||!box.contains(el))return;e.preventDefault();e.stopPropagation();const q=el.dataset.quadrant;if(!q||toaState.hetShadows[q]?.dead||!toaState.hetShadowActive)return;toaState.hetSelectedShadow=q;box.querySelectorAll('.toa-akkha-shadow').forEach(n=>n.classList.toggle('selected',n.dataset.quadrant===q));if(toaState.mode==='party'&&!toaState.isHost)toaPartySend({type:'het-shadow-select',quadrant:q,sender:character?.id});},{capture:true});}
  const anyCharging=Object.values(toaState.hetShadows).some(v=>v.charging);box.classList.toggle('hidden',!toaState.hetShadowActive&&!anyCharging&&toaState.hetShadowPhase===0);box.innerHTML='';
  if(fx)fx.querySelectorAll('.toa-het-quadrant-glow').forEach(e=>e.remove());
  const now=performance.now();
  for(const q of Object.keys(TOA_HET_SHADOW_POS)){
    const st=toaState.hetShadows[q],pos=TOA_HET_SHADOW_POS[q];
    if(st.dead||(!toaState.hetShadowActive&&!st.charging))continue;
    const remaining=st.charging?Math.max(0,st.chargeEnd-now):0,chargePct=st.charging?Math.max(0,Math.min(100,remaining/22000*100)):0;
    const el=document.createElement('div');el.className='toa-akkha-shadow'+((toaState.hetSelectedShadow===q)?' selected':'')+(st.charging?' charging':'');el.dataset.quadrant=q;el.style.left=pos.x+'%';el.style.top=pos.y+'%';el.setAttribute('role','button');el.setAttribute('aria-label','Target Akkha shadow '+q.toUpperCase());
    el.innerHTML='<span class="shadow-label">AKKHA SHADOW</span><img src="assets/toa-het-boss-idle.png" alt="" draggable="false"><span class="shadow-charge" aria-label="Shadow attack charge"><i style="width:'+chargePct+'%"></i></span><span class="shadow-hp"><i style="width:'+Math.max(0,st.hp/45*100)+'%"></i></span>';
    box.appendChild(el);
  }
  if(toaState.hetShadowUnlockedQuadrant&&fx){const g=document.createElement('i');g.className='toa-het-quadrant-glow '+toaState.hetShadowUnlockedQuadrant;g.setAttribute('aria-hidden','true');g.innerHTML='<b></b><b></b><b></b><b></b><b></b><b></b>';fx.prepend(g);}
}
function toaBeginHetShadowPhase(threshold){
  const now=performance.now();toaState.hetBossHp=Math.max(toaState.hetBossHp,toaState.hetBossMaxHp*threshold/100);toaState.hetShadowPhase=threshold;toaState.hetShadowActive=true;toaState.hetShadowUnlockedQuadrant=null;
  const alive=Object.keys(toaState.hetShadows).filter(q=>!toaState.hetShadows[q].dead);Object.keys(toaState.hetShadows).forEach(q=>{toaState.hetShadows[q].charging=true;toaState.hetShadows[q].chargeEnd=now+22000;});if(alive.length){toaState.hetSelectedShadow=alive[0];toaState.remoteHetSelectedShadow=alive[Math.min(1,alive.length-1)];}
  toaRenderHetShadows();toaUpdateHetHud();toaShowShadowNotice('SHADOWS CHARGING — DISPEL ONE');toaNotice('Kill a shadow before its bar empties. Surviving shadows will burn their quadrants for 40 damage.',5200);
  if(toaState.mode==='party')toaPartySend({type:'het-shadow-state',state:toaHetShadowState(),sender:character?.id});
}
function toaDamageHetShadow(q,damage){
  const st=toaState.hetShadows[q];if(!st||st.dead||!toaState.hetShadowActive)return false;st.hp=Math.max(0,st.hp-damage);
  const el=document.querySelector('.toa-akkha-shadow[data-quadrant="'+q+'"]');el?.classList.add('toa-akkha-shadow-hit');setTimeout(()=>el?.classList.remove('toa-akkha-shadow-hit'),260);
  const pos=TOA_HET_SHADOW_POS[q];toaHetSplat(pos.x,pos.y-10,String(damage),'');
  if(st.hp<=0){st.dead=true;st.charging=false;st.chargeEnd=0;toaState.hetShadowActive=false;toaState.hetShadowUnlockedQuadrant=q;toaShowShadowNotice('SHADOW DISPELLED — LURE AKKHA '+q.toUpperCase());toaNotice('That quadrant is safe. Other charged shadows may still unleash their fire waves.',4200);}
  toaRenderHetShadows();if(toaState.mode==='party')toaPartySend({type:'het-shadow-state',state:toaHetShadowState(),sender:character?.id});return true;
}
function toaDamageLocalHetPlayer(amount,label){
  if(toaState.localDead||toaState.raidDefeated)return;toaState.hetPlayerHp=Math.max(0,toaState.hetPlayerHp-amount);toaHetSplat(toaState.hetX,toaState.hetY-6,String(amount),'');$('toaHetPlayer')?.classList.add('toa-hit');setTimeout(()=>$('toaHetPlayer')?.classList.remove('toa-hit'),360);toaUpdateHetHud();if(label)toaNotice(label,1800);if(toaState.channel)toaPartySend({type:'het-hp',hp:toaState.hetPlayerHp,sender:character?.id});
  if(toaState.hetPlayerHp<=0&&!toaState.localDead){toaState.localDead=true;$('toaHetPlayer')?.classList.add('toa-dead');if(toaState.channel)toaPartySend({type:'het-player-dead',sender:character?.id});if(toaState.mode==='solo'||toaState.remoteDead)toaShowDefeatedPanel(toaState.mode==='party');else toaNotice('You have been defeated. Your teammate is still fighting Akkha!',5000);}
}
function toaTriggerHetShadowWave(q,fromParty=false){
  toaPlayAkkhaFireWaveSound();
  const st=toaState.hetShadows[q];if(st){st.charging=false;st.chargeEnd=0;}const fx=$('toaHetEffects');if(fx){const wave=document.createElement('i');wave.className='toa-shadow-fire-wave '+q;fx.appendChild(wave);setTimeout(()=>wave.remove(),1050);const pos=TOA_HET_SHADOW_POS[q],shadow=document.querySelector('.toa-akkha-shadow[data-quadrant="'+q+'"]');shadow?.classList.add('slamming');setTimeout(()=>shadow?.classList.remove('slamming'),650);toaHetSplat(pos.x,pos.y-11,'FIRE','blocked');}
  if(toaHetQuadrantAt(toaState.hetX,toaState.hetY)===q&&!toaState.localDead)toaDamageLocalHetPlayer(40,'The shadow’s fire wave hits you for 40!');
  if(!fromParty&&toaState.mode==='party')toaPartySend({type:'het-shadow-wave',quadrant:q,sender:character?.id});toaRenderHetShadows();
}
function toaUpdateHetShadowCharges(t){
  let changed=false;for(const q of Object.keys(TOA_HET_SHADOW_POS)){const st=toaState.hetShadows[q];if(st.charging&&t>=st.chargeEnd){if(toaState.mode!=='party'||toaState.isHost)toaTriggerHetShadowWave(q,false);else{st.charging=false;st.chargeEnd=0;toaRenderHetShadows();}changed=true;}}
  if(!changed&&Object.values(toaState.hetShadows).some(v=>v.charging)&&Math.floor(t/100)%2===0)toaRenderHetShadows();
}
function toaAkkhaVulnerable(){return !toaState.hetSymbolActive&&!toaState.hetShadowActive&&(!toaState.hetShadowUnlockedQuadrant||toaHetQuadrantAt(toaState.hetBossX,toaState.hetBossY)===toaState.hetShadowUnlockedQuadrant);}
function toaPickShadowForAttacker(remote=false){
  const chosen=remote?toaState.remoteHetSelectedShadow:toaState.hetSelectedShadow;if(chosen&&!toaState.hetShadows[chosen]?.dead)return chosen;
  const x=remote?toaState.remoteHetX:toaState.hetX,y=remote?toaState.remoteHetY:toaState.hetY;return Object.keys(TOA_HET_SHADOW_POS).filter(q=>!toaState.hetShadows[q].dead).sort((a,b)=>Math.hypot(x-TOA_HET_SHADOW_POS[a].x,y-TOA_HET_SHADOW_POS[a].y)-Math.hypot(x-TOA_HET_SHADOW_POS[b].x,y-TOA_HET_SHADOW_POS[b].y))[0];
}
function toaSpawnHetPlayerProjectile(weapon,remote=false){
  if(weapon!=='ranged'&&weapon!=='magic')return;
  const fx=$('toaHetEffects');if(!fx||toaState.room!=='het-arena')return;
  const r=fx.getBoundingClientRect();
  const sx=(remote?toaState.remoteHetX:toaState.hetX)/100*r.width;
  const sy=((remote?toaState.remoteHetY:toaState.hetY)-2)/100*r.height;
  const ex=toaState.hetBossX/100*r.width,ey=(toaState.hetBossY-2)/100*r.height;
  const dx=ex-sx,dy=ey-sy,angle=Math.atan2(dy,dx)*180/Math.PI;
  const el=document.createElement('i');el.className='toa-het-player-projectile '+weapon;
  el.style.left=sx+'px';el.style.top=sy+'px';el.style.setProperty('--dx',dx+'px');el.style.setProperty('--dy',dy+'px');el.style.setProperty('--angle',angle+'deg');
  fx.appendChild(el);setTimeout(()=>el.remove(),620);
}
function toaAnimateHetPlayerAttack(remote=false){
  const el=$(remote?'toaHetTeammate':'toaHetPlayer');
  if(!el)return;
  el.classList.remove('toa-het-player-attacking');void el.offsetWidth;el.classList.add('toa-het-player-attacking');
  setTimeout(()=>el.classList.remove('toa-het-player-attacking'),520);
}

function toaClearHetOrbs(){
  toaState.hetOrbs=[];$('toaHetEffects')?.querySelectorAll('.toa-unstable-orb,.toa-final-stand-flash').forEach(e=>e.remove());
}
function toaBeginAkkhaFinalStand(fromParty=false){
  if(toaState.hetFinalStand||toaState.raidDefeated)return;
  toaState.hetFinalStand=true;toaState.hetShadowActive=false;toaState.hetSymbolActive=false;toaClearHetSymbolTimers();
  const finalStandRatio=toaState.mode==='party'?.12:.20;toaState.hetBossHp=Math.round(toaState.hetBossMaxHp*finalStandRatio);toaState.hetFinalHits=0;toaState.hetBossStyle='magic';
  toaState.hetBossNextAttack=Infinity;toaState.hetOrbNextSpawn=performance.now()+750;toaState.hetBossTarget=0;
  const spots=Object.values(TOA_HET_SHADOW_POS),spot=spots[Math.floor(Math.random()*spots.length)];toaState.hetBossX=spot.x;toaState.hetBossY=spot.y;
  toaRenderHetShadows();toaClearHetOrbs();toaUpdateHetHud();toaRenderHetBoss();
  toaShowShadowNotice('AKKHA · FINAL STAND');toaNotice(toaState.mode==='party'?'Akkha restores 12% health. Strike quickly — he teleports after every 3 successful melee hits!':'Akkha restores 20% health. Only melee can harm him — avoid the Unstable Orbs!',5200);
  const fx=$('toaHetEffects');if(fx){const f=document.createElement('i');f.className='toa-final-stand-flash';f.style.setProperty('--fx-x',toaState.hetBossX+'%');f.style.setProperty('--fx-y',toaState.hetBossY+'%');fx.appendChild(f);setTimeout(()=>f.remove(),700);}
  if(!fromParty&&toaState.mode==='party')toaPartySend({type:'het-final-start',x:toaState.hetBossX,y:toaState.hetBossY,hp:toaState.hetBossHp,sender:character?.id});
}
function toaTeleportAkkhaFinal(){
  const spots=Object.entries(TOA_HET_SHADOW_POS).filter(([q,p])=>Math.hypot(p.x-toaState.hetBossX,p.y-toaState.hetBossY)>12);
  const [,spot]=spots[Math.floor(Math.random()*spots.length)];
  const fx=$('toaHetEffects');if(fx){const old=document.createElement('i');old.className='toa-final-stand-flash';old.style.setProperty('--fx-x',toaState.hetBossX+'%');old.style.setProperty('--fx-y',toaState.hetBossY+'%');fx.appendChild(old);setTimeout(()=>old.remove(),650);}
  toaState.hetBossX=spot.x;toaState.hetBossY=spot.y;toaState.hetFinalHits=0;toaRenderHetBoss();
  if(toaState.mode==='party')toaPartySend({type:'het-final-teleport',x:spot.x,y:spot.y,sender:character?.id});
}
function toaSpawnUnstableOrb(){
  const side=Math.floor(Math.random()*4),margin=15;let x,y,vx,vy;
  const speed=.018+Math.random()*.006;
  if(side===0){x=margin;y=24+Math.random()*52;vx=speed;vy=0;}
  else if(side===1){x=100-margin;y=24+Math.random()*52;vx=-speed;vy=0;}
  else if(side===2){x=25+Math.random()*50;y=margin;vx=0;vy=speed;}
  else{x=25+Math.random()*50;y=100-margin;vx=0;vy=-speed;}
  const id='o'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);toaState.hetOrbs.push({id,x,y,vx,vy,hitLocal:false,hitRemote:false});
  if(toaState.mode==='party')toaPartySend({type:'het-orb-spawn',orb:{id,x,y,vx,vy},sender:character?.id});
}
function toaRenderUnstableOrbs(dt){
  const fx=$('toaHetEffects');if(!fx)return;const next=[];
  for(const o of toaState.hetOrbs){o.x+=o.vx*dt;o.y+=o.vy*dt;
    if(o.x<8||o.x>92||o.y<8||o.y>92){fx.querySelector('[data-orb-id="'+o.id+'"]')?.remove();continue;}
    let el=fx.querySelector('[data-orb-id="'+o.id+'"]');if(!el){el=document.createElement('i');el.className='toa-unstable-orb';el.dataset.orbId=o.id;const angle=Math.atan2(o.vy,o.vx)*180/Math.PI;el.style.setProperty('--orb-angle',angle+'deg');fx.appendChild(el);}el.style.left=o.x+'%';el.style.top=o.y+'%';
    if(!toaState.localDead&&!o.hitLocal&&Math.hypot(o.x-toaState.hetX,o.y-toaState.hetY)<3.4){o.hitLocal=true;let dmg=18+Math.floor(Math.random()*8);if(toaState.prayer==='magic')dmg=Math.ceil(dmg*.75);dmg=Math.min(25,dmg);toaDamageLocalHetPlayer(dmg,'An Unstable Orb hits you for '+dmg+'!');el.remove();continue;}
    next.push(o);
  }toaState.hetOrbs=next;
}
function toaResolveGuestHetAttack(m){
  if(!m||toaState.raidDefeated||toaState.room!=='het-arena'||toaState.hetHelperActive||toaState.hetSymbolActive||toaState.remoteDead)return;
  const weapon=['melee','ranged','magic'].includes(m.weapon)?m.weapon:'melee';
  const x=Number.isFinite(Number(m.x))?Number(m.x):toaState.remoteHetX;
  const y=Number.isFinite(Number(m.y))?Number(m.y):toaState.remoteHetY;
  toaState.remoteHetX=x;toaState.remoteHetY=y;toaState.remoteHetWeapon=weapon;
  if(m.quadrant)toaState.remoteHetSelectedShadow=m.quadrant;
  const attacker={id:'guest',weapon};
  let damage=6+Math.floor(Math.random()*3),targetType='boss',quadrant=null;
  if(toaState.hetShadowActive){
    quadrant=toaPickShadowForAttacker(true);if(!quadrant)return;const pos=TOA_HET_SHADOW_POS[quadrant];
    if(weapon==='melee'&&Math.hypot(x-pos.x,y-pos.y)>11)return;
    toaAnimateHetPlayerAttack(true);toaSpawnHetPlayerProjectileTo(weapon,true,pos.x,pos.y);toaDamageHetShadow(quadrant,damage);targetType='shadow';
  }else if(toaState.hetFinalStand){
    if(weapon!=='melee'||Math.hypot(x-toaState.hetBossX,y-toaState.hetBossY)>11)return;
    toaAnimateHetPlayerAttack(true);toaState.hetBossHp=Math.max(0,toaState.hetBossHp-damage);toaState.hetFinalHits++;toaHetSplat(toaState.hetBossX,toaState.hetBossY-10,String(damage),'');toaUpdateHetHud();targetType='final';
    if(toaState.hetBossHp<=0)toaDefeatAkkha(false);else if(toaState.hetFinalHits>=3)toaTeleportAkkhaFinal();
  }else{
    if(weapon===toaState.hetBossStyle)return;
    if(weapon==='melee'&&Math.hypot(x-toaState.hetBossX,y-toaState.hetBossY)>11)return;
    toaAnimateHetPlayerAttack(true);toaSpawnHetPlayerProjectile(weapon,true);
    if(!toaAkkhaVulnerable()){damage=0;toaHetSplat(toaState.hetBossX,toaState.hetBossY-10,'IMMUNE','blocked');}
    else{
      const pct=toaState.hetBossHp/toaState.hetBossMaxHp*100,nextPct=pct-damage/toaState.hetBossMaxHp*100;
      const symbolNext=TOA_HET_SYMBOL_THRESHOLDS.find(t=>!(toaState.hetSymbolThresholdsDone||[]).includes(t)&&pct>t&&nextPct<=t);
      const shadowNext=TOA_HET_THRESHOLDS.find(t=>pct>t&&nextPct<=t);
      const next=[symbolNext,shadowNext].filter(Number.isFinite).sort((a,b)=>b-a)[0];
      if(next){toaState.hetBossHp=toaState.hetBossMaxHp*next/100;damage=0;if(next===symbolNext)toaBeginHetSymbolPhase(next);else toaBeginHetShadowPhase(next);}
      else{toaState.hetBossHp=Math.max(0,toaState.hetBossHp-damage);toaHetSplat(toaState.hetBossX,toaState.hetBossY-10,String(damage),'');toaUpdateHetHud();if(toaState.hetBossHp<=0)toaBeginAkkhaFinalStand();}
    }
  }
  if(toaState.mode==='party')toaPartySend({type:'het-player-attack',targetType,quadrant,attackers:[attacker],damage,hp:toaState.hetBossHp,x:toaState.hetBossX,y:toaState.hetBossY,finalHits:toaState.hetFinalHits,shadowState:toaHetShadowState(),requestId:m.requestId,sender:character?.id});
}
function toaResolvePlayerAttackCycle(remoteEvent=false,payload=null){
  if(toaState.raidDefeated||toaState.room!=='het-arena'||(toaState.hetBossHp<=0&&!toaState.hetFinalStand)||toaState.hetSymbolActive)return;
  if(remoteEvent&&payload){
    const attackers=Array.isArray(payload.attackers)?payload.attackers:[];
    attackers.forEach(a=>{const isLocal=(toaState.isHost&&a.id==='host')||(!toaState.isHost&&a.id==='guest');const remote=!isLocal;toaAnimateHetPlayerAttack(remote);if(payload.targetType==='shadow'){const pos=TOA_HET_SHADOW_POS[payload.quadrant];if(pos)toaSpawnHetPlayerProjectileTo(a.weapon,remote,pos.x,pos.y);}else toaSpawnHetPlayerProjectile(a.weapon,remote);});
    if(payload.shadowState)toaApplyHetShadowState(payload.shadowState);
    if(Number.isFinite(Number(payload.x)))toaState.hetBossX=Number(payload.x);
    if(Number.isFinite(Number(payload.y)))toaState.hetBossY=Number(payload.y);
    if(Number.isFinite(Number(payload.finalHits)))toaState.hetFinalHits=Number(payload.finalHits);
    toaState.hetBossHp=Math.max(0,Number(payload.hp));toaUpdateHetHud();toaRenderHetBoss();
    if(payload.targetType!=='shadow'&&Number(payload.damage)>0)toaHetSplat(toaState.hetBossX,toaState.hetBossY-10,String(payload.damage),'');
    if(payload.targetType==='final'&&toaState.hetBossHp<=0)toaDefeatAkkha(true);return;
  }
  if(toaState.mode==='party'&&!toaHasCombatAuthority())return;
  const valid=[];
  const addAttacker=(id,weapon,x,y,dead)=>{
    if(dead)return;
    if(toaState.hetShadowActive){const q=toaPickShadowForAttacker(id==='guest');if(!q)return;const pos=TOA_HET_SHADOW_POS[q];if(weapon==='melee'&&Math.hypot(x-pos.x,y-pos.y)>11)return;valid.push({id,weapon,q});return;}
    if(toaState.hetFinalStand){if(weapon!=='melee')return;if(Math.hypot(x-toaState.hetBossX,y-toaState.hetBossY)>11){if(id==='host')toaNotice('Only melee works — stand beside Akkha.',900);return;}valid.push({id,weapon});return;}
    if(weapon===toaState.hetBossStyle)return;
    if(weapon==='melee'&&Math.hypot(x-toaState.hetBossX,y-toaState.hetBossY)>11){if(id==='host')toaNotice('Move next to Akkha to attack with the sword.',900);return;}
    valid.push({id,weapon});
  };
  const localRole=toaState.mode==='party'?(toaState.isHost?'host':'guest'):'host';
  addAttacker(localRole,toaState.hetWeapon,toaState.hetX,toaState.hetY,toaState.localDead);
  if(!valid.length)return;
  const damage=6+Math.floor(Math.random()*3);
  if(toaState.hetShadowActive){
    const grouped={};valid.forEach(a=>(grouped[a.q]||(grouped[a.q]=[])).push(a));const q=Object.keys(grouped)[0],attackers=grouped[q];attackers.forEach(a=>{const remote=a.id==='guest';toaAnimateHetPlayerAttack(remote);const pos=TOA_HET_SHADOW_POS[q];toaSpawnHetPlayerProjectileTo(a.weapon,remote,pos.x,pos.y);});toaDamageHetShadow(q,damage);
    if(toaState.mode==='party')toaPartySend({type:'het-player-attack',targetType:'shadow',quadrant:q,attackers,damage,hp:toaState.hetBossHp,shadowState:toaHetShadowState(),sender:character?.id});return;
  }
  valid.forEach(a=>{toaAnimateHetPlayerAttack(a.id==='guest');toaSpawnHetPlayerProjectile(a.weapon,a.id==='guest');});
  if(toaState.hetFinalStand){const finalDamage=6+Math.floor(Math.random()*3);toaState.hetBossHp=Math.max(0,toaState.hetBossHp-finalDamage);toaState.hetFinalHits++;toaHetSplat(toaState.hetBossX,toaState.hetBossY-10,String(finalDamage),'');toaUpdateHetHud();if(toaState.hetBossHp<=0){toaDefeatAkkha(false);}else{const hitsNeeded=3;if(toaState.hetFinalHits>=hitsNeeded)toaTeleportAkkhaFinal();}if(toaState.mode==='party')toaPartySend({type:'het-player-attack',targetType:'final',attackers:valid,damage:finalDamage,hp:toaState.hetBossHp,x:toaState.hetBossX,y:toaState.hetBossY,finalHits:toaState.hetFinalHits,sender:character?.id});return;}
  if(!toaAkkhaVulnerable()){toaHetSplat(toaState.hetBossX,toaState.hetBossY-10,'IMMUNE','blocked');toaNotice('Lure Akkha into the highlighted quadrant!',1100);if(toaState.mode==='party')toaPartySend({type:'het-player-attack',targetType:'boss',attackers:valid,damage:0,hp:toaState.hetBossHp,shadowState:toaHetShadowState(),sender:character?.id});return;}
  const pct=toaState.hetBossHp/toaState.hetBossMaxHp*100,nextPct=pct-damage/toaState.hetBossMaxHp*100;
  const symbolNext=TOA_HET_SYMBOL_THRESHOLDS.find(t=>!(toaState.hetSymbolThresholdsDone||[]).includes(t)&&pct>t&&nextPct<=t);
  const shadowNext=TOA_HET_THRESHOLDS.find(t=>pct>t&&nextPct<=t);
  const next=[symbolNext,shadowNext].filter(Number.isFinite).sort((a,b)=>b-a)[0];
  if(next){toaState.hetBossHp=toaState.hetBossMaxHp*next/100;if(next===symbolNext)toaBeginHetSymbolPhase(next);else toaBeginHetShadowPhase(next);}else{toaState.hetBossHp=Math.max(0,toaState.hetBossHp-damage);toaHetSplat(toaState.hetBossX,toaState.hetBossY-10,String(damage),'');toaUpdateHetHud();if(toaState.hetBossHp<=0)toaBeginAkkhaFinalStand();}
  if(toaState.mode==='party')toaPartySend({type:'het-player-attack',targetType:'boss',attackers:valid,damage:next?0:damage,hp:toaState.hetBossHp,shadowState:toaHetShadowState(),sender:character?.id});
}

function toaSpawnHetHelpfulSpirit(){
  const fx=$('toaHetEffects');if(!fx)return;document.getElementById('toaHetHelpfulSpirit')?.remove();
  const spirit=document.createElement('button');spirit.type='button';spirit.id='toaHetHelpfulSpirit';spirit.className='toa-helpful-spirit toa-het-helper';spirit.style.left='50%';spirit.style.top='72%';spirit.innerHTML='<i></i><b>Helpful spirit</b>';spirit.addEventListener('click',toaUseHetHelpfulSpirit);fx.appendChild(spirit);
}
function toaDefeatAkkha(fromParty=false){
  if(toaState.hetHelperActive)return;toaState.hetBossHp=0;toaState.hetFinalStand=false;toaState.hetHelperActive=true;toaState.partyVictory=true;
  toaClearHetOrbs();toaClearHetSymbolTimers();toaState.hetSymbolActive=false;toaState.hetShadowActive=false;toaState.hetOrbs=[];toaState.hetBossNextAttack=Infinity;toaState.hetBossNextPlayerAttack=Infinity;
  $('toaHetEffects')?.querySelectorAll('.toa-akkha-shadow,.toa-shadow-fire-wave,.toa-akkha-symbol-blast,.toa-akkha-symbol-cue,.toa-unstable-orb,.toa-akkha-projectile,.toa-het-player-projectile').forEach(e=>e.remove());
  $('toaHetShadows')?.replaceChildren();$('toaHetShadows')?.classList.add('hidden');const defeatedBoss=$('toaHetBoss');if(defeatedBoss){defeatedBoss.classList.add('hidden');defeatedBoss.style.display='none';defeatedBoss.setAttribute('aria-hidden','true');}$('toaHetBossHud')?.classList.add('toa-defeated');
  toaUpdateHetHud();toaSpawnHetHelpfulSpirit();toaNotice('Akkha has been defeated. Speak to the Helpful Spirit.',5000);
  if(toaState.localDead){toaState.localDead=false;toaState.hetPlayerHp=99;$('toaHetPlayer')?.classList.remove('toa-dead');toaUpdateHetHud();}
  if(toaState.remoteDead){toaState.remoteDead=false;$('toaHetTeammate')?.classList.remove('toa-dead');}
  if(toaState.mode==='party'&&!fromParty&&toaState.channel)toaPartySend({type:'het-victory',sender:character?.id});
}
function toaNearHetHelpfulSpirit(){return toaState.room==='het-arena'&&toaState.hetHelperActive&&Math.hypot(toaState.hetX-50,(toaState.hetY-72)*1.1)<13;}
function toaCompleteHetReturn(fromParty=false){
  if(!toaState.hetHelperActive&&!toaState.hetComplete)return;
  toaState.hetHelperActive=false;toaState.hetComplete=true;toaState.partyVictory=true;toaState.room='nexus';toaState.x=82;toaState.y=58;toaState.keys={};
  stopToaHetMusic();$('toaHetRoom')?.classList.add('hidden');$('toaNexus')?.classList.remove('hidden');$('toaPlayer')?.classList.remove('hidden');$('toaHetBossHud')?.classList.add('hidden');$('toaHetPlayerHud')?.classList.add('hidden');
  document.getElementById('toaHetHelpfulSpirit')?.remove();toaUpdateCrondisUnlock();toaUpdateNexusPlayer();toaUpdateContextAction();startToaLobbyMusic();toaNotice('Path of Het complete.',4200);
  if(toaState.mode==='party'&&!fromParty&&toaState.channel)toaPartySend({type:'het-helper-used',sender:character?.id});
}
function toaUseHetHelpfulSpirit(){if(!toaState.hetHelperActive)return;if(!toaNearHetHelpfulSpirit()){toaNotice('Move closer to the Helpful Spirit.',1200);return;}toaCompleteHetReturn(false);}

function toaSpawnHetPlayerProjectileTo(weapon,remote,targetX,targetY){
  if(weapon!=='ranged'&&weapon!=='magic')return;const fx=$('toaHetEffects');if(!fx||toaState.room!=='het-arena')return;const r=fx.getBoundingClientRect();const sx=(remote?toaState.remoteHetX:toaState.hetX)/100*r.width,sy=((remote?toaState.remoteHetY:toaState.hetY)-2)/100*r.height;const ex=targetX/100*r.width,ey=(targetY-2)/100*r.height;const dx=ex-sx,dy=ey-sy,angle=Math.atan2(dy,dx)*180/Math.PI;const el=document.createElement('i');el.className='toa-het-player-projectile '+weapon;el.style.left=sx+'px';el.style.top=sy+'px';el.style.setProperty('--dx',dx+'px');el.style.setProperty('--dy',dy+'px');el.style.setProperty('--angle',angle+'deg');fx.appendChild(el);setTimeout(()=>el.remove(),620);
}
function toaChooseLivingAkkhaTarget(style){
  const living=[];
  if(!toaState.localDead&&toaState.hetPlayerHp>0)living.push({id:0,x:toaState.hetX,y:toaState.hetY});
  if(toaState.mode==='party'&&!toaState.remoteDead&&toaState.remoteHetPlayerHp>0)living.push({id:1,x:toaState.remoteHetX,y:toaState.remoteHetY});
  if(!living.length)return 0;
  if(style==='melee')return living.reduce((best,p)=>Math.hypot(p.x-toaState.hetBossX,p.y-toaState.hetBossY)<Math.hypot(best.x-toaState.hetBossX,best.y-toaState.hetBossY)?p:best,living[0]).id;
  return living[Math.floor(Math.random()*living.length)].id;
}
function toaUpdateHetBoss(dt,t){
  if(toaState.raidDefeated||toaState.room!=='het-arena'||toaState.hetHelperActive)return;
  toaUpdateHetShadowCharges(t);if(toaState.hetFinalStand){toaRenderUnstableOrbs(dt);if(toaHasCombatAuthority()){if(t>=toaState.hetOrbNextSpawn){const duo=toaState.mode==='party';toaState.hetOrbNextSpawn=t+(duo?360:430)+Math.random()*(duo?215:260);toaSpawnUnstableOrb();if(Math.random()<(duo?.42:.34))toaSpawnUnstableOrb();}}}
  if(toaState.hetSymbolActive){toaRenderHetBoss();return;}
  if(toaState.mode==='party'&&!toaHasCombatAuthority()){if(!toaState.localDead&&t>=toaState.hetLocalNextAttackRequest){toaState.hetLocalNextAttackRequest=t+2400;toaPartySend({type:'het-attack-request',requestId:toaGetNetClientId()+'-'+Math.round(t),weapon:toaState.hetWeapon,x:toaState.hetX,y:toaState.hetY,quadrant:toaState.hetSelectedShadow,sender:character?.id});}toaRenderHetBoss();return;}
  const targetRemote=toaState.mode==='party'&&toaState.hetBossTarget===1;const tx=targetRemote?toaState.remoteHetX:toaState.hetX,ty=targetRemote?toaState.remoteHetY:toaState.hetY;
  const dx=tx-toaState.hetBossX,dy=ty-toaState.hetBossY,d=Math.hypot(dx,dy)||1;
  if(!toaState.hetFinalStand&&d>8){const speed=.0046*dt;const next=toaClampHetCircle(toaState.hetBossX+dx/d*speed,toaState.hetBossY+dy/d*speed);toaState.hetBossX=next.x;toaState.hetBossY=next.y;}
  if(!toaState.hetBossAttacking&&t-toaState.hetBossFrameTimer>360){toaState.hetBossFrameTimer=t;toaState.hetBossFrame=(toaState.hetBossFrame+1)%2;}
  if(t>=toaState.hetBossNextPlayerAttack){toaState.hetBossNextPlayerAttack=t+2400;toaResolvePlayerAttackCycle(false);}
  if(!toaState.hetFinalStand&&t>=toaState.hetBossNextAttack){const hpRatio=toaState.hetBossHp/toaState.hetBossMaxHp;const attackDelay=hpRatio<=.10?3600/1.55:hpRatio<=.25?3600/1.30:3600;toaState.hetBossNextAttack=t+attackDelay;toaState.hetBossTarget=toaChooseLivingAkkhaTarget(toaState.hetBossStyle);const damage=20+Math.floor(Math.random()*11);toaResolveHetAttack(toaState.hetBossStyle,toaState.hetBossTarget,false,damage);if(toaState.mode==='party')toaPartySend({type:'het-attack',style:toaState.hetBossStyle,target:toaState.hetBossTarget,damage,sender:character?.id});toaState.hetBossAttackCount++;if(toaState.hetBossAttackCount>=6){toaState.hetBossAttackCount=0;const styles=['melee','ranged','magic'];toaState.hetBossStyle=styles[(styles.indexOf(toaState.hetBossStyle)+1)%3];toaState.hetBossTarget=toaChooseLivingAkkhaTarget(toaState.hetBossStyle);toaShowAkkhaStyleSwitch(toaState.hetBossStyle,false);if(toaState.mode==='party')toaPartySend({type:'het-style-switch',style:toaState.hetBossStyle,sender:character?.id});}}
  if(toaState.mode==='party'&&t-toaState.hetBossSyncTimer>120){toaState.hetBossSyncTimer=t;toaPartySend({type:'het-boss',x:toaState.hetBossX,y:toaState.hetBossY,target:toaState.hetBossTarget,frame:toaState.hetBossFrame,style:toaState.hetBossStyle,attacking:toaState.hetBossAttacking,shadowState:toaHetShadowState(),sender:character?.id});}
  toaRenderHetBoss();
}
function toaEnterCrondisRoom(fromParty=false){
  if(toaState.crondisComplete&&!toaHasAdminAccess()){toaNotice('Path of Crondis is already complete. Restart the raid to enter again.',3200);return}
  if(!toaUpdateCrondisUnlock()&&!fromParty){toaNotice('Path of Crondis is not unlocked yet.');return}
  toaState.room='crondis-safe';toaState.keys={};toaState.localReady=false;toaState.remoteReady=false;
  $('toaCrondisRoom').classList.remove('hidden');$('toaEnterCrondis').classList.add('hidden');$('toaPlayer').classList.add('hidden');
  $('toaRoomStatus').innerHTML='<b>ROOM</b> PATH OF CRONDIS · READY CHAMBER';stopToaLobbyMusic();
  const team=$('toaCrondisTeammate'),teamReady=$('toaReadyTeam');const multi=toaState.mode==='party';team.classList.toggle('hidden',!multi);teamReady.classList.toggle('hidden',!multi);
  $('toaCrondisSafePanel').classList.remove('hidden');
  toaRenderReady();toaRenderPrayer(false);toaRenderPrayer(true);toaNotice('Ready up to enter the Path of Crondis arena.',3200);
  if(toaState.channel&&!fromParty)toaPartySend({type:'enter-crondis',sender:character?.id});
}
function toaRenderReady(){
  const you=$('toaReadyYou'),team=$('toaReadyTeam'),btn=$('toaReadyButton');if(!you)return;
  you.textContent='YOU · '+(toaState.localReady?'READY':'NOT READY');you.classList.toggle('ready',toaState.localReady);
  team.textContent='TEAMMATE · '+(toaState.remoteReady?'READY':'NOT READY');team.classList.toggle('ready',toaState.remoteReady);
  btn.textContent=toaState.localReady?'CANCEL READY':'READY UP';
}
function toaTryStartCrondis(){
  const allReady=toaState.localReady&&(toaState.mode==='solo'||toaState.remoteReady);if(!allReady||toaState.room!=='crondis-safe')return;
  toaState.room='crondis-arena';toaState.arenaX=toaState.mode==='party'?47:50;toaState.arenaY=70;$('toaCrondisSafePanel').classList.add('hidden');
  $('toaCrondisPlayer').style.left=toaState.arenaX+'%';$('toaCrondisPlayer').style.top=toaState.arenaY+'%';
  $('toaCrondisPlayer').classList.add('toa-armed');
  $('toaCrondisTeammate').classList.toggle('toa-armed',toaState.mode==='party');
  if(toaState.mode==='party'){$('toaCrondisTeammate').style.left='53%';$('toaCrondisTeammate').style.top='70%';}
  $('toaRoomStatus').innerHTML='<b>ROOM</b> PATH OF CRONDIS · ARENA';startToaCrondisMusic();toaNotice('All raiders are ready. Auto-attacking Zebak!',3500);toaStartZebakFight();
}

function toaEnterScarabasRoom(fromParty=false){
  if(!toaState.crondisComplete&&!toaHasAdminAccess()){toaNotice('Complete Path of Crondis first.',2200);return}
  if(toaState.scarabasComplete&&!toaHasAdminAccess()){toaNotice('Path of Scarabas is already complete.',2200);return}
  if(toaState.mode==='party'&&!toaState.partyJoined&&!fromParty){toaNotice('Wait for your teammate to join the raid.',2200);return}
  toaState.room='scarabas-safe';toaState.keys={};toaState.localReady=false;toaState.remoteReady=false;
  $('toaScarabasRoom')?.classList.remove('hidden');$('toaEnterScarabas')?.classList.add('hidden');$('toaEnterHet')?.classList.add('hidden');$('toaPlayer')?.classList.add('hidden');
  $('toaRoomStatus').innerHTML='<b>ROOM</b> PATH OF SCARABAS · READY CHAMBER';stopToaLobbyMusic();stopToaCrondisMusic();stopToaScarabasMusic();stopToaHetMusic();
  const multi=toaState.mode==='party';$('toaScarabasTeammate')?.classList.toggle('hidden',!multi);$('toaScarabasReadyTeam')?.classList.toggle('hidden',!multi);$('toaScarabasSafePanel')?.classList.remove('hidden');$('toaScarabasArenaBanner')?.classList.add('hidden');
  toaRenderScarabasReady();toaNotice('Ready up to enter the Path of Scarabas arena.',3200);
  if(toaState.channel&&!fromParty)toaPartySend({type:'enter-scarabas',sender:character?.id});
}
function toaRenderScarabasReady(){
  const you=$('toaScarabasReadyYou'),team=$('toaScarabasReadyTeam'),btn=$('toaScarabasReadyButton');if(!you)return;
  you.textContent='YOU · '+(toaState.localReady?'READY':'NOT READY');you.classList.toggle('ready',toaState.localReady);
  team.textContent='TEAMMATE · '+(toaState.remoteReady?'READY':'NOT READY');team.classList.toggle('ready',toaState.remoteReady);
  btn.textContent=toaState.localReady?'CANCEL READY':'READY UP';
}
function toaTryStartScarabas(){
  const allReady=toaState.localReady&&(toaState.mode==='solo'||toaState.remoteReady);if(!allReady||toaState.room!=='scarabas-safe')return;
  toaState.room='scarabas-arena';toaState.arenaX=toaState.mode==='party'?47:50;toaState.arenaY=78;$('toaScarabasSafePanel')?.classList.add('hidden');
  const p=$('toaScarabasPlayer'),mate=$('toaScarabasTeammate');if(p){p.style.left=toaState.arenaX+'%';p.style.top=toaState.arenaY+'%'}
  if(toaState.mode==='party'&&mate){mate.style.left='53%';mate.style.top='78%';mate.classList.remove('hidden')}
  $('toaScarabasArenaBanner')?.classList.remove('hidden');$('toaRoomStatus').innerHTML='<b>ROOM</b> PATH OF SCARABAS · ARENA';startToaScarabasMusic();toaNotice('Move one tile from Kephri and attack with the Keris partisan!',4200);
  p?.classList.add('toa-keris-armed');mate?.classList.toggle('toa-keris-armed',toaState.mode==='party');
  toaStartKephriFight();
  setTimeout(()=>$('toaScarabasArenaBanner')?.classList.add('hidden'),2600);
}


function toaUpdateKephriHud(){const pct=Math.max(0,Math.round(toaState.kephriHp/toaState.kephriMaxHp*100)),hp=Math.max(0,toaState.kephriPlayerHp),hpp=Math.round(hp/99*100);if($('toaKephriHpFill'))$('toaKephriHpFill').style.width=pct+'%';if($('toaKephriHpText'))$('toaKephriHpText').textContent=pct+'%';if($('toaKephriPlayerHpFill'))$('toaKephriPlayerHpFill').style.width=hpp+'%';if($('toaKephriPlayerHpText'))$('toaKephriPlayerHpText').textContent=hp+' / 99';}
function toaKephriInMeleeRange(x,y){
  // One floor tile beyond the central plinth. The player cannot stand on the plinth itself.
  const dx=Math.max(38.5-x,0,x-62.5),dy=Math.max(37.5-y,0,y-65);return Math.hypot(dx,dy)<=8.2&&!(x>=38.5&&x<=62.5&&y>=37.5&&y<=65);
}
function toaStartKephriFight(){
  toaState.raidDefeated=false;toaState.kephriHp=100;toaState.kephriPlayerHp=99;toaState.sharks=3;toaState.kephriActive=true;toaState.kephriAttackTimer=0;toaState.kephriFireballTimer=1100;toaState.kephriPhase=1;toaState.kephriDung=[];toaState.kephriFleas=[];toaState.kephriFleaTimer=0;toaState.kephriDungTriggered=false;toaState.kephriFleasTriggered=false;toaState.kephriDungStrike60=false;toaState.kephriDungStrike30=false;toaState.kephriDungStrike15=false;toaState.kephriDungWalls=[];toaState.kephriKnockback=false;toaState.kephriAddsTriggered=false;toaState.kephriAddsActive=false;toaState.kephriAdds=[];toaState.kephriBlueTimer=0;toaState.kephriAddAttackTimer=0;toaState.kephriAddDiveTimer=0;toaState.kephriDiveTriggered=false;toaState.kephriDiveTimer=0;toaState.kephriDiveBombs=[];toaState.kephriFinalRush=false;toaState.kephriHelperActive=false;toaState.kephriDiveTriggered=false;toaState.kephriDiveTimer=0;toaState.kephriDiveBombs=[];toaState.kephriFinalRush=false;toaState.kephriHelperActive=false;toaState.localDead=false;toaState.remoteDead=false;
  $('toaScarabasPlayer')?.classList.remove('toa-dead');$('toaScarabasTeammate')?.classList.remove('toa-dead');if($('toaDefeatedPanel')){$('toaDefeatedPanel').classList.add('hidden');$('toaDefeatedPanel').style.display='';}$('toaKephriHud')?.classList.remove('hidden');$('toaKephriPlayerHud')?.classList.remove('hidden');$('toaScarabasRoom')?.classList.add('kephri-active');if($('toaKephriPhase'))$('toaKephriPhase').textContent='FIREBALLS · 100% → 80%';toaRenderFood();toaRenderPrayer();toaUpdateKephriHud();
}
function toaKephriDamage(amount,label=''){
  if(!toaState.kephriActive||toaState.localDead)return;toaState.kephriPlayerHp=Math.max(0,toaState.kephriPlayerHp-amount);toaUpdateKephriHud();const fx=$('toaScarabasEffects');if(fx){const splat=document.createElement('b');splat.className='toa-kephri-damage';splat.textContent=String(amount);splat.style.left=toaState.arenaX+'%';splat.style.top=(toaState.arenaY-3)+'%';fx.appendChild(splat);setTimeout(()=>splat.remove(),950)}if(label)toaNotice(label,1800);if(toaState.kephriPlayerHp<=0)toaHandleKephriDeath();
}
function toaHandleKephriDeath(){
  if(toaState.localDead)return;toaState.localDead=true;toaState.kephriPlayerHp=0;toaUpdateKephriHud();$('toaScarabasPlayer')?.classList.add('toa-dead');if(toaState.channel)toaPartySend({type:'kephri-player-dead',sender:character?.id});
  if(toaState.mode==='party'&&!toaState.remoteDead){toaNotice('You have been defeated. Your teammate is still fighting Kephri!',5000);return}
  toaState.kephriActive=false;toaShowDefeatedPanel(toaState.mode==='party');
}
function toaKephriStrike(x,y,remote=false){
  if(!toaState.kephriActive||toaState.localDead||toaState.kephriHp<=0)return;if(remote&&toaState.mode==='party'&&toaState.isHost&&toaState.channel)toaPartySend({type:'kephri-player-attack',sender:character?.id,targetKind:'kephri'});const el=remote?$('toaScarabasTeammate'):$('toaScarabasPlayer');el?.classList.remove('toa-keris-strike');void el?.offsetWidth;el?.classList.add('toa-keris-strike');setTimeout(()=>el?.classList.remove('toa-keris-strike'),340);const fx=$('toaScarabasEffects');if(fx){const h=document.createElement('i');h.className='toa-kephri-hit';h.style.left=(50+(Math.random()*4-2))+'%';h.style.top=(49+(Math.random()*4-2))+'%';fx.appendChild(h);setTimeout(()=>h.remove(),500)}if(toaHasCombatAuthority()){const damage=toaState.mode==='party'?0.38:0.8;toaState.kephriHp=Math.max(0,toaState.kephriHp-damage);toaUpdateKephriHud();if(toaState.channel)toaPartySend({type:'kephri-state',sender:character?.id,hp:toaState.kephriHp});if(toaState.kephriHp<=80&&!toaState.kephriDungTriggered)toaReachKephriEighty();if(toaState.kephriHp<=70&&!toaState.kephriFleasTriggered)toaReachKephriSeventy();if(toaState.kephriHp<=60&&!toaState.kephriDungStrike60)toaReachKephriDungStrike(60);if(toaState.kephriHp<=50&&!toaState.kephriAddsTriggered)toaReachKephriFifty();if(toaState.kephriHp<=30&&!toaState.kephriDungStrike30)toaReachKephriDungStrike(30);if(toaState.kephriHp<=30&&!toaState.kephriDiveTriggered)toaReachKephriThirty();if(toaState.kephriHp<=15&&!toaState.kephriDungStrike15)toaReachKephriDungStrike(15);if(toaState.kephriHp<=10&&!toaState.kephriFinalRush)toaReachKephriTen();if(toaState.kephriHp<=0)toaDefeatKephri(false);}}
function toaReachKephriEighty(){
  toaState.kephriDungTriggered=true;toaState.kephriPhase=2;$('toaScarabasRoom')?.classList.add('kephri-shake');setTimeout(()=>$('toaScarabasRoom')?.classList.remove('kephri-shake'),900);if($('toaKephriPhase'))$('toaKephriPhase').textContent='DUNG BOMBS · 80% → 70%';toaNotice('Kephri roars and hurls dung across the arena!',3300);toaSpawnKephriDung(false);if(toaState.channel)toaPartySend({type:'kephri-dung',sender:character?.id});
}
function toaKephriDungPoints(){
  return [[14,25],[34,21],[65,22],[82,31],[27,37],[47,31],[14,54],[75,55],[28,68],[49,73],[15,76],[81,77],[34,88],[65,88]];
}
function toaSpawnKephriDung(fromParty=false){
  if(toaState.kephriDung.length)return;const fx=$('toaScarabasEffects');if(!fx)return;const points=toaKephriDungPoints();points.forEach(([x,y],i)=>{const ball=document.createElement('i');ball.className='toa-dung-ball flying';ball.style.left='50%';ball.style.top='43%';fx.appendChild(ball);const start=performance.now(),duration=560+(i%5)*65+Math.floor(i/5)*45;function fly(now){const q=Math.min(1,(now-start)/duration),arc=Math.sin(q*Math.PI)*(14+(i%3)*3);ball.style.left=(50+(x-50)*q)+'%';ball.style.top=(43+(y-43)*q-arc)+'%';if(q<1)requestAnimationFrame(fly);else{ball.classList.remove('flying');ball.style.left=x+'%';ball.style.top=y+'%';toaState.kephriDung.push({x,y,el:ball});}}requestAnimationFrame(fly)});
}
function toaReachKephriSeventy(){
  toaState.kephriFleasTriggered=true;toaState.kephriPhase=3;if($('toaKephriPhase'))$('toaKephriPhase').textContent='FIREBALLS + FLEAS · 70% → 0%';toaNotice('The dung erupts into swarming ranged fleas!',3400);toaExplodeKephriDung(false);if(toaState.channel)toaPartySend({type:'kephri-fleas',sender:character?.id});
}
function toaExplodeKephriDung(fromParty=false){
  const fx=$('toaScarabasEffects');if(!fx)return;const sources=toaState.kephriDung.length?toaState.kephriDung.map(d=>[d.x,d.y]):toaKephriDungPoints();sources.forEach(([x,y],i)=>{const dung=toaState.kephriDung[i];const ex=document.createElement('i');ex.className='toa-dung-explosion';ex.style.left=x+'%';ex.style.top=y+'%';fx.appendChild(ex);setTimeout(()=>ex.remove(),700);const d=Math.hypot(toaState.arenaX-x,toaState.arenaY-y);if(d<8.5)toaKephriDamage(18,'The exploding dung hits you for 18!');dung?.el?.remove();for(let j=0;j<2;j++){const side=j?1:-1,fx0=x+side*(1.1+Math.random()),fy0=y+(Math.random()*2.4-1.2);const flea=document.createElement('i');flea.className='toa-kephri-flea';flea.style.left=fx0+'%';flea.style.top=fy0+'%';fx.appendChild(flea);toaState.kephriFleas.push({x:fx0,y:fy0,el:flea,phase:Math.random()*6.28,vx:(Math.random()-.5)*.006,vy:(Math.random()-.5)*.005});}});toaState.kephriDung=[];toaState.kephriFleaTimer=450;
}

function toaClampScarabasPoint(x,y){
  x=Math.max(9,Math.min(91,x));y=Math.max(16,Math.min(87,y));
  if(x>=38.5&&x<=62.5&&y>=37.5&&y<=65){
    const choices=[{x:37.2,y},{x:63.8,y},{x,y:36.2},{x,y:66.3}],best=choices.sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y))[0];x=best.x;y=best.y;
  }
  return{x,y};
}
function toaDungRayPointAtRect(cx,cy,dx,dy,minX,maxX,minY,maxY,entering=false){
  const hits=[];
  if(Math.abs(dx)>.0001){
    for(const x of [minX,maxX]){const t=(x-cx)/dx,y=cy+dy*t;if(t>0&&y>=minY&&y<=maxY)hits.push({t,x,y});}
  }
  if(Math.abs(dy)>.0001){
    for(const y of [minY,maxY]){const t=(y-cy)/dy,x=cx+dx*t;if(t>0&&x>=minX&&x<=maxX)hits.push({t,x,y});}
  }
  if(!hits.length)return{x:cx,y:cy,t:0};
  hits.sort((a,b)=>a.t-b.t);
  return entering?hits[0]:hits[hits.length-1];
}
function toaCreateDungStrikeWall(x,y,dx,dy){
  const fx=$('toaScarabasEffects');if(!fx)return null;
  // Build one continuous barrier from the edge of Kephri's plinth to the outer arena border.
  const start=toaDungRayPointAtRect(50,51.25,dx,dy,38.5,62.5,37.5,65,true);
  const end=toaDungRayPointAtRect(50,51.25,dx,dy,9.5,90.5,16.5,86.5,false);
  const length=Math.hypot(end.x-start.x,end.y-start.y);
  const count=Math.max(8,Math.ceil(length/3.15)+1);
  for(let i=0;i<count;i++){
    const q=i/(count-1),px=start.x+(end.x-start.x)*q,py=start.y+(end.y-start.y)*q;
    const ball=document.createElement('i');ball.className='toa-dung-wall-ball';ball.style.left=px+'%';ball.style.top=py+'%';ball.style.setProperty('--dung-i',String(i));fx.appendChild(ball);
    toaState.kephriDungWalls.push({x:px,y:py,el:ball});
  }
  return{start,end};
}
function toaFindSafeDungKnockPosition(x,y,dx,dy,wall){
  const base=toaClampScarabasPoint(x+dx*13,y+dy*13),px=-dy,py=dx;
  // Always finish beside the wall, never centred inside its collision line.
  const candidates=[
    {x:base.x+px*5.2,y:base.y+py*5.2},
    {x:base.x-px*5.2,y:base.y-py*5.2},
    {x:base.x+px*7,y:base.y+py*7},
    {x:base.x-px*7,y:base.y-py*7},
    {x:x+px*5.2,y:y+py*5.2},
    {x:x-px*5.2,y:y-py*5.2}
  ];
  for(const c of candidates){
    const pt=toaClampScarabasPoint(c.x,c.y);
    if(!toaScarabasBlocked(pt.x,pt.y))return pt;
  }
  // Last-resort nudge away from every nearby dung segment.
  let pt=toaClampScarabasPoint(base.x+px*8,base.y+py*8);
  for(let i=0;i<12&&toaScarabasBlocked(pt.x,pt.y);i++)pt=toaClampScarabasPoint(pt.x+px*1.2,pt.y+py*1.2);
  return pt;
}
function toaDungStrikeFlies(x,y,remote=false){
  const fx=$('toaScarabasEffects');if(!fx)return null;
  const swarm=document.createElement('i');swarm.className='toa-dung-strike-flies';swarm.style.left=x+'%';swarm.style.top=y+'%';fx.appendChild(swarm);
  for(let i=0;i<9;i++){const fly=document.createElement('b');fly.style.setProperty('--fly-i',i);swarm.appendChild(fly)}
  return swarm;
}
function toaPerformDungStrike(x,y,dx,dy,targetRemote=false,fromParty=false){
  if(!toaState.kephriActive)return;
  const swarm=toaDungStrikeFlies(x,y,targetRemote);toaNotice(targetRemote?'Flies swarm around your teammate — Dung Strike incoming!':'Flies swarm around you — move after the knockback!',1500);
  setTimeout(()=>{
    swarm?.remove();
    const wall=toaCreateDungStrikeWall(x,y,dx,dy);
    const end=toaFindSafeDungKnockPosition(x,y,dx,dy,wall);
    const el=targetRemote?$('toaScarabasTeammate'):$('toaScarabasPlayer');el?.classList.add('toa-dung-knock');
    if(targetRemote){toaState.remoteScarabasX=end.x;toaState.remoteScarabasY=end.y;if(el){el.style.left=end.x+'%';el.style.top=end.y+'%'}}
    else{toaState.kephriKnockback=true;toaState.arenaX=end.x;toaState.arenaY=end.y;if(el){el.style.left=end.x+'%';el.style.top=end.y+'%'}setTimeout(()=>toaState.kephriKnockback=false,420)}
    setTimeout(()=>el?.classList.remove('toa-dung-knock'),430);
    $('toaScarabasRoom')?.classList.add('kephri-shake');setTimeout(()=>$('toaScarabasRoom')?.classList.remove('kephri-shake'),420);
  },1450);
}
function toaReachKephriDungStrike(threshold){
  if(threshold===60)toaState.kephriDungStrike60=true;else if(threshold===30)toaState.kephriDungStrike30=true;else toaState.kephriDungStrike15=true;
  toaState.kephriPhase=threshold===60?4:threshold===30?5:7;
  if($('toaKephriPhase'))$('toaKephriPhase').textContent=threshold===60?'DUNG STRIKE · 60% → 30%':threshold===30?'DOUBLE DUNG WALLS · 30% → 15%':'TRIPLE DUNG WALLS · 15% → 0%';
  toaNotice(`Kephri prepares Dung Strike at ${threshold}%!`,2600);
  const targets=[{x:toaState.arenaX,y:toaState.arenaY,remote:false}];
  if(toaState.mode==='party'&&!toaState.remoteDead)targets.push({x:toaState.remoteScarabasX,y:toaState.remoteScarabasY,remote:true});
  targets.forEach(t=>{let dx=t.x-50,dy=t.y-50,d=Math.hypot(dx,dy)||1;dx/=d;dy/=d;toaPerformDungStrike(t.x,t.y,dx,dy,t.remote,false);if(toaState.channel)toaPartySend({type:'kephri-dung-strike',sender:character?.id,x:t.x,y:t.y,dx,dy,target:t.remote?'guest':'host'});});
}


function toaReachKephriFifty(){
  toaState.kephriAddsTriggered=true;toaState.kephriAddsActive=true;toaState.kephriPhase=5;toaState.kephriFireballTimer=999999;toaState.kephriAddDiveTimer=4500+Math.random()*2500;
  if($('toaKephriPhase'))$('toaKephriPhase').textContent='SCARAB REINFORCEMENTS · FIREBALLS PAUSED';
  toaNotice('Kephri summons scarabs! Destroy the blue scarab before it finishes charging!',4200);
  $('toaScarabasRoom')?.classList.add('kephri-shake');setTimeout(()=>$('toaScarabasRoom')?.classList.remove('kephri-shake'),700);
  toaSpawnKephriAdds(false);if(toaState.channel)toaPartySend({type:'kephri-adds-spawn',sender:character?.id});
}
function toaSpawnKephriAdds(fromParty=false){
  if(toaState.kephriAdds.length)return;const fx=$('toaScarabasEffects');if(!fx)return;
  const defs=[{kind:'melee',x:28,y:48,hp:8,maxHp:8},{kind:'blue',x:72,y:48,hp:5,maxHp:5}];
  defs.forEach(a=>{const el=document.createElement('i');el.className='toa-kephri-add '+a.kind;el.style.left=a.x+'%';el.style.top=a.y+'%';const bar=document.createElement('b');bar.className='toa-kephri-add-hp';bar.innerHTML='<span></span>';el.appendChild(bar);if(a.kind==='blue'){const charge=document.createElement('em');charge.className='toa-blue-charge';charge.innerHTML='<span></span>';el.appendChild(charge)}fx.appendChild(el);a.el=el;toaState.kephriAdds.push(a)});
  toaState.kephriAddsActive=true;toaState.kephriBlueTimer=15000;toaState.kephriAddAttackTimer=1800;toaRenderKephriAdds();
}
function toaRenderKephriAdds(){toaState.kephriAdds.forEach(a=>{if(!a.el)return;a.el.style.left=a.x+'%';a.el.style.top=a.y+'%';a.el.classList.toggle('dead',a.hp<=0);const fill=a.el.querySelector('.toa-kephri-add-hp span');if(fill)fill.style.width=Math.max(0,a.hp/a.maxHp*100)+'%';if(a.kind==='blue'){const c=a.el.querySelector('.toa-blue-charge span');if(c)c.style.width=Math.max(0,toaState.kephriBlueTimer/15000*100)+'%'}})}
function toaApplyKephriAddState(m){const incoming=m.adds||[];if(!toaState.kephriAdds.length&&incoming.some(d=>Number(d.hp)>0))toaSpawnKephriAdds(true);for(const d of incoming){const a=toaState.kephriAdds.find(x=>x.kind===d.kind);if(a){a.x=Number(d.x);a.y=Number(d.y);const wasAlive=a.hp>0;a.hp=Math.max(0,Number(d.hp)||0);if(wasAlive&&a.hp<=0&&a.el){a.el.classList.add('burst');const deadEl=a.el;a.el=null;setTimeout(()=>deadEl.remove(),420)}}}toaState.kephriBlueTimer=Number(m.blueTimer)||0;toaState.kephriAddsActive=toaState.kephriAdds.some(a=>a.hp>0);toaRenderKephriAdds();if(!toaState.kephriAddsActive)toaEndKephriAdds();}
function toaSyncKephriAdds(){if(toaState.channel)toaPartySend({type:'kephri-add-state',sender:character?.id,blueTimer:toaState.kephriBlueTimer,adds:toaState.kephriAdds.map(a=>({kind:a.kind,x:a.x,y:a.y,hp:a.hp}))})}
function toaDamageKephriAdd(a,remote=false){if(!a||a.hp<=0)return;a.hp=Math.max(0,a.hp-1);a.el?.classList.add('hit');setTimeout(()=>a.el?.classList.remove('hit'),180);toaRenderKephriAdds();if(a.hp<=0){a.el?.classList.add('burst');setTimeout(()=>a.el?.remove(),420);toaNotice(a.kind==='blue'?'The charging scarab has been destroyed!':'The melee scarab has been defeated!',1800)}toaSyncKephriAdds();if(!toaState.kephriAdds.some(x=>x.hp>0))toaEndKephriAdds();}
function toaEndKephriAdds(){if(!toaState.kephriAddsActive)return;toaState.kephriAddsActive=false;toaState.kephriFireballTimer=900;toaState.kephriAdds.forEach(a=>a.el?.remove());toaState.kephriAdds=[];if($('toaKephriPhase'))$('toaKephriPhase').textContent='FIREBALLS + FLEAS · 50% → 30%';toaNotice('Both scarabs are dead — Kephri resumes her fireballs!',2600)}
function toaKephriBlueBlast(fromParty=false){const blue=toaState.kephriAdds.find(a=>a.kind==='blue'&&a.hp>0);if(!blue)return;const fx=$('toaScarabasEffects');if(fx){const blast=document.createElement('i');blast.className='toa-blue-scarab-blast';blast.style.left=blue.x+'%';blast.style.top=blue.y+'%';fx.appendChild(blast);setTimeout(()=>blast.remove(),900)}toaKephriDamage(50,'The blue scarab finishes charging and blasts you for 50!');}
function toaResolveKephriAddMelee(remoteTarget=false){if(remoteTarget)return;const melee=toaState.kephriAdds.find(a=>a.kind==='melee'&&a.hp>0);if(!melee)return;if(toaState.prayer==='melee'){const fx=$('toaScarabasEffects');if(fx){const z=document.createElement('b');z.className='toa-kephri-damage blocked';z.textContent='0';z.style.left=toaState.arenaX+'%';z.style.top=(toaState.arenaY-3)+'%';fx.appendChild(z);setTimeout(()=>z.remove(),700)}}else if(Math.random()<.30)toaKephriDamage(20,'The scarab claws you for 20!');}
function toaUpdateKephriAdds(dt){
  if(!toaState.kephriAddsActive)return;const authority=toaState.mode==='solo'||toaState.isHost;
  const blue=toaState.kephriAdds.find(a=>a.kind==='blue'&&a.hp>0),melee=toaState.kephriAdds.find(a=>a.kind==='melee'&&a.hp>0);
  if(blue){toaState.kephriBlueTimer-=dt;if(toaState.kephriBlueTimer<=0){toaState.kephriBlueTimer=999999;toaKephriBlueBlast(false);if(toaState.channel)toaPartySend({type:'kephri-blue-blast',sender:character?.id})}}
  if(authority&&melee){const targets=[{x:toaState.arenaX,y:toaState.arenaY,remote:false}];if(toaState.mode==='party'&&!toaState.remoteDead)targets.push({x:toaState.remoteScarabasX,y:toaState.remoteScarabasY,remote:true});targets.sort((a,b)=>Math.hypot(a.x-melee.x,a.y-melee.y)-Math.hypot(b.x-melee.x,b.y-melee.y));const t=targets[0],dx=t.x-melee.x,dy=t.y-melee.y,d=Math.hypot(dx,dy)||1;if(d>5){melee.x+=dx/d*dt*.008;melee.y+=dy/d*dt*.008}toaState.kephriAddAttackTimer-=dt;if(d<7&&toaState.kephriAddAttackTimer<=0){toaState.kephriAddAttackTimer=2300;melee.el?.classList.add('attack');setTimeout(()=>melee.el?.classList.remove('attack'),320);if(t.remote){if(toaState.channel)toaPartySend({type:'kephri-add-melee',sender:character?.id,target:'guest'})}else toaResolveKephriAddMelee(false)}}
  toaRenderKephriAdds();
}
function toaTryAttackKephriAdd(remote=false){const px=remote?toaState.remoteScarabasX:toaState.arenaX,py=remote?toaState.remoteScarabasY:toaState.arenaY;const targets=toaState.kephriAdds.filter(a=>a.hp>0).sort((a,b)=>{if(a.kind!==b.kind)return a.kind==='blue'?-1:1;return Math.hypot(px-a.x,py-a.y)-Math.hypot(px-b.x,py-b.y)});const a=targets.find(a=>Math.hypot(px-a.x,py-a.y)<=10);if(!a)return false;const el=remote?$('toaScarabasTeammate'):$('toaScarabasPlayer');el?.classList.remove('toa-keris-strike');void el?.offsetWidth;el?.classList.add('toa-keris-strike');setTimeout(()=>el?.classList.remove('toa-keris-strike'),340);if(remote&&toaState.mode==='party'&&toaState.isHost&&toaState.channel)toaPartySend({type:'kephri-player-attack',sender:character?.id,targetKind:a.kind});if(toaHasCombatAuthority())toaDamageKephriAdd(a,remote);return true;}


function toaReachKephriThirty(){
  toaState.kephriDiveTriggered=true;toaState.kephriDiveTimer=700;
  if($('toaKephriPhase'))$('toaKephriPhase').textContent='DUNG STRIKE + DIVING SCARABS · 30% → 10%';
  toaNotice('Small scarabs begin diving at your tile — keep moving!',3200);
}
function toaReachKephriTen(){
  toaState.kephriFinalRush=true;toaState.kephriFireballTimer=Math.min(toaState.kephriFireballTimer,650);
  $('toaScarabasRoom')?.classList.add('kephri-final-rush');
  if($('toaKephriPhase'))$('toaKephriPhase').textContent='FINAL ASSAULT · 10% → 0%';
  toaNotice('Kephri enrages — fireballs are coming much faster!',3200);
}
function toaSpawnKephriDiveScarab(x,y,fromParty=false){
  if(!toaState.kephriActive||toaState.kephriHp<=0)return;
  const fx=$('toaScarabasEffects');if(!fx)return;
  x=Math.max(11,Math.min(89,x));y=Math.max(17,Math.min(86,y));
  const mark=document.createElement('i');mark.className='toa-dive-scarab-mark';mark.style.left=x+'%';mark.style.top=y+'%';fx.appendChild(mark);
  const bug=document.createElement('i');bug.className='toa-dive-scarab';bug.style.left=(x+(Math.random()<.5?-18:18))+'%';bug.style.top=(y-22)+'%';fx.appendChild(bug);
  const start=performance.now(),duration=1050;
  function dive(now){
    const q=Math.min(1,(now-start)/duration),e=q*q;
    bug.style.left=(parseFloat(bug.dataset.sx||bug.style.left)+(x-parseFloat(bug.dataset.sx||bug.style.left))*q)+'%';
    if(!bug.dataset.sx)bug.dataset.sx=String(parseFloat(bug.style.left));
    bug.style.top=((y-22)+22*e)+'%';bug.style.scale=String(.65+q*.55);
    if(q<1&&toaState.kephriActive)requestAnimationFrame(dive);else{
      bug.remove();mark.remove();if(!toaState.kephriActive)return;const ex=document.createElement('i');ex.className='toa-dive-scarab-explosion';ex.style.left=x+'%';ex.style.top=y+'%';fx.appendChild(ex);setTimeout(()=>ex.remove(),650);
      if(Math.hypot(toaState.arenaX-x,toaState.arenaY-y)<6.6)toaKephriDamage(24,'A diving scarab explodes beneath you for 24!');
    }
  }
  requestAnimationFrame(dive);
}
function toaCleanupKephriFight(){
  toaState.kephriAddsActive=false;toaState.kephriAttackTimer=0;toaState.kephriFireballTimer=0;toaState.kephriFleaTimer=0;toaState.kephriBlueTimer=0;toaState.kephriAddAttackTimer=0;toaState.kephriAddDiveTimer=0;toaState.kephriDiveTimer=0;
  toaState.kephriAdds.forEach(a=>a.el?.remove());toaState.kephriAdds=[];
  toaState.kephriDung.forEach(d=>d.el?.remove());toaState.kephriDung=[];
  toaState.kephriFleas.forEach(f=>f.el?.remove());toaState.kephriFleas=[];
  toaState.kephriDungWalls.forEach(w=>w.el?.remove());toaState.kephriDungWalls=[];
  toaState.kephriDiveBombs.forEach(b=>b.el?.remove?.());toaState.kephriDiveBombs=[];
  const fx=$('toaScarabasEffects');if(fx)fx.replaceChildren();
  document.querySelectorAll('#toaScarabasRoom .toa-kephri-add,#toaScarabasRoom .toa-kephri-flea,#toaScarabasRoom .toa-dung-ball,#toaScarabasRoom .toa-dung-wall-ball,#toaScarabasRoom .toa-kephri-fireball,#toaScarabasRoom .toa-fireball-shadow,#toaScarabasRoom .toa-fireball-impact,#toaScarabasRoom .toa-dive-scarab,#toaScarabasRoom .toa-dive-scarab-mark,#toaScarabasRoom .toa-dive-scarab-explosion,#toaScarabasRoom .toa-flea-shot,#toaScarabasRoom .toa-dung-explosion,#toaScarabasRoom .toa-dung-strike-flies').forEach(e=>e.remove());
  $('toaScarabasRoom')?.classList.remove('kephri-shake','kephri-final-rush');
}
function toaSpawnKephriHelpfulSpirit(){
  const fx=$('toaScarabasEffects');if(!fx)return;document.getElementById('toaKephriHelpfulSpirit')?.remove();
  const spirit=document.createElement('button');spirit.type='button';spirit.id='toaKephriHelpfulSpirit';spirit.className='toa-helpful-spirit toa-kephri-helper';spirit.style.left='50%';spirit.style.top='78%';spirit.innerHTML='<i></i><b>Helpful spirit</b>';spirit.addEventListener('click',toaUseKephriHelpfulSpirit);fx.appendChild(spirit);
}
function toaDefeatKephri(fromParty=false){
  if(toaState.kephriHelperActive)return;toaState.kephriHp=0;toaState.kephriActive=false;toaState.kephriHelperActive=true;toaState.partyVictory=true;
  toaCleanupKephriFight();toaUpdateKephriHud();if($('toaKephriPhase'))$('toaKephriPhase').textContent='DEFEATED';$('toaKephriHud')?.classList.add('toa-defeated');
  toaState.arenaX=44;toaState.arenaY=84;const player=$('toaScarabasPlayer');if(player){player.style.left='44%';player.style.top='84%';}
  if(toaState.mode==='party'){toaState.remoteScarabasX=56;toaState.remoteScarabasY=84;const mate=$('toaScarabasTeammate');if(mate){mate.style.left='56%';mate.style.top='84%';}}
  toaSpawnKephriHelpfulSpirit();toaNotice('Kephri has been defeated. Speak to the Helpful Spirit.',5000);
  if(toaState.mode==='party'&&!fromParty&&toaState.channel)toaPartySend({type:'kephri-victory',sender:character?.id});
  if(toaState.localDead){toaState.localDead=false;toaState.kephriPlayerHp=99;$('toaScarabasPlayer')?.classList.remove('toa-dead');toaUpdateKephriHud();}
  if(toaState.remoteDead){toaState.remoteDead=false;$('toaScarabasTeammate')?.classList.remove('toa-dead');}
}
function toaNearKephriHelpfulSpirit(){return toaState.room==='scarabas-arena'&&toaState.kephriHelperActive&&Math.hypot(toaState.arenaX-50,(toaState.arenaY-78)*1.1)<12;}
function toaCompleteKephriReturn(fromParty=false){
  toaState.kephriHelperActive=false;toaState.crondisComplete=true;toaState.scarabasComplete=true;toaState.room='nexus';toaState.x=18;toaState.y=58;toaState.keys={};
  stopToaScarabasMusic();$('toaScarabasRoom')?.classList.add('hidden');$('toaNexus')?.classList.remove('hidden');$('toaPlayer')?.classList.remove('hidden');$('toaKephriHud')?.classList.add('hidden');$('toaKephriPlayerHud')?.classList.add('hidden');
  document.getElementById('toaKephriHelpfulSpirit')?.remove();toaUpdateCrondisUnlock();toaUpdateNexusPlayer();toaUpdateContextAction();startToaLobbyMusic();toaNotice('Kephri is complete. Path of Het is now unlocked!',4200);
  if(toaState.mode==='party'&&!fromParty&&toaState.channel)toaPartySend({type:'kephri-helper-used',sender:character?.id});
}
function toaUseKephriHelpfulSpirit(){
  if(!toaNearKephriHelpfulSpirit()){toaNotice('Move closer to the Helpful Spirit.',1200);return;}
  toaCompleteKephriReturn(false);
}


function toaEnterApmekenRoom(fromParty=false){
  if(!(toaHasAdminAccess()||toaState.hetComplete)){toaNotice('Complete Path of Het first.',2200);return}
  if(toaState.apmekenComplete&&!toaHasAdminAccess()){toaNotice('Path of Apmeken is already complete.',2200);return}
  toaState.room='apmeken-ready';toaState.localReady=false;toaState.remoteReady=false;toaState.keys={};
  $('toaCrondisRoom')?.classList.add('hidden');$('toaScarabasRoom')?.classList.add('hidden');$('toaHetRoom')?.classList.add('hidden');$('toaApmekenRoom')?.classList.remove('hidden');$('toaPlayer')?.classList.add('hidden');$('toaEnterApmeken')?.classList.add('hidden');$('toaApmekenSafePanel')?.classList.remove('hidden');$('toaApmekenArenaBanner')?.classList.add('hidden');
  const multi=toaState.mode==='party';$('toaApmekenTeammate')?.classList.toggle('hidden',!multi);$('toaApmekenReadyTeam')?.classList.toggle('hidden',!multi);
  stopToaLobbyMusic();stopToaCrondisMusic();stopToaScarabasMusic();stopToaHetMusic();stopToaApmekenMusic();toaRenderApmekenReady();$('toaRoomStatus').innerHTML='<b>ROOM</b> PATH OF APMEKEN · READY CHAMBER';toaNotice('Ready up to enter the Path of Apmeken arena.',3200);
  if(toaState.channel&&!fromParty)toaPartySend({type:'enter-apmeken',sender:character?.id});
}
function toaRenderApmekenReady(){const you=$('toaApmekenReadyYou'),team=$('toaApmekenReadyTeam'),btn=$('toaApmekenReadyButton');if(you){you.textContent='YOU · '+(toaState.localReady?'READY':'NOT READY');you.classList.toggle('ready',toaState.localReady)}if(team){team.textContent='TEAMMATE · '+(toaState.remoteReady?'READY':'NOT READY');team.classList.toggle('ready',toaState.remoteReady)}if(btn)btn.textContent=toaState.localReady?'CANCEL READY':'READY UP';}
function toaTryStartApmeken(){if(!toaState.localReady)return;if(toaState.mode==='party'&&!toaState.remoteReady)return;if(toaState.mode==='party'&&!toaState.isHost)return;toaStartApmekenArena(false);if(toaState.channel)toaPartySend({type:'start-apmeken',sender:character?.id});}
function toaStartApmekenArena(fromParty=false){
  toaState.room='apmeken-arena';toaState.apmekenX=toaState.mode==='party'?48:50;toaState.apmekenY=73;toaState.remoteApmekenX=52;toaState.remoteApmekenY=73;toaState.remoteApmekenTarget=null;toaState.localDead=false;toaState.remoteDead=false;
  $('toaApmekenSafePanel')?.classList.add('hidden');const p=$('toaApmekenPlayer'),m=$('toaApmekenTeammate');p?.classList.remove('hidden','toa-dead');if(p){p.style.left=toaState.apmekenX+'%';p.style.top=toaState.apmekenY+'%'}if(m){m.style.left='52%';m.style.top='73%'}$('toaApmekenArenaBanner')?.classList.remove('hidden');$('toaRoomStatus').innerHTML='<b>ROOM</b> PATH OF APMEKEN · ARENA';startToaApmekenMusic();toaNotice('All raiders are ready. Stay inside the red and orange tiled arena.',4200);setTimeout(()=>$('toaApmekenArenaBanner')?.classList.add('hidden'),2600);
}
function toaEnterHetRoom(fromParty=false){
  if(!toaHasAdminAccess()&&!toaState.scarabasComplete){toaNotice('Complete Path of Scarabas first.',2200);return;}
  toaState.room='het-ready';toaState.localReady=false;toaState.remoteReady=false;toaState.keys={};
  $('toaCrondisRoom')?.classList.add('hidden');$('toaScarabasRoom')?.classList.add('hidden');$('toaHetRoom')?.classList.remove('hidden');$('toaPlayer')?.classList.add('hidden');$('toaEnterHet')?.classList.add('hidden');$('toaHetSafePanel')?.classList.remove('hidden');$('toaHetArenaBanner')?.classList.add('hidden');$('toaHetBoss')?.classList.add('hidden');$('toaHetBossHud')?.classList.add('hidden');$('toaHetPlayerHud')?.classList.add('hidden');
  const multi=toaState.mode==='party';$('toaHetTeammate')?.classList.toggle('hidden',!multi);$('toaHetReadyTeam')?.classList.toggle('hidden',!multi);stopToaLobbyMusic();stopToaCrondisMusic();stopToaScarabasMusic();stopToaHetMusic();toaRenderHetReady();$('toaRoomStatus').innerHTML='<b>ROOM</b> PATH OF HET · READY CHAMBER';
  if(toaState.mode==='party'&&!fromParty&&toaState.channel)toaPartySend({type:'enter-het',sender:character?.id});
}
function toaRenderHetReady(){const you=$('toaHetReadyYou'),team=$('toaHetReadyTeam'),btn=$('toaHetReadyButton');if(you)you.textContent='YOU · '+(toaState.localReady?'READY':'NOT READY');if(team)team.textContent='TEAMMATE · '+(toaState.remoteReady?'READY':'NOT READY');if(btn)btn.textContent=toaState.localReady?'CANCEL READY':'READY UP';}
function toaTryStartHet(){if(!toaState.localReady)return;if(toaState.mode==='party'&&!toaState.remoteReady)return;if(toaState.mode==='party'&&!toaState.isHost)return;toaStartHetArena(false);if(toaState.channel)toaPartySend({type:'start-het',sender:character?.id});}
function toaStartHetArena(fromParty=false){toaState.raidDefeated=false;toaState.localDead=false;toaState.remoteDead=false;toaState.room='het-arena';toaState.sharks=3;toaState.prayer=null;toaState.hetPlayerHp=99;toaState.remoteHetPlayerHp=99;toaState.hetBossMaxHp=toaState.mode==='party'?900:500;toaState.hetBossHp=toaState.hetBossMaxHp;toaState.hetBossX=50;toaState.hetBossY=28;toaState.hetBossTarget=toaState.mode==='party'&&Math.random()<.5?1:0;toaState.hetBossFrame=0;toaState.hetBossStyle='melee';toaState.hetBossAttackCount=0;toaState.hetBossNextAttack=performance.now()+3600;toaState.hetBossNextPlayerAttack=performance.now()+1300;toaState.hetLocalNextAttackRequest=performance.now()+1300;toaState.hetBossAttacking=false;toaState.hetFinalStand=false;toaState.hetHelperActive=false;document.getElementById('toaHetHelpfulSpirit')?.remove();toaState.hetFinalHits=0;toaState.hetOrbNextSpawn=0;toaClearHetOrbs();toaClearHetSymbolTimers();toaState.hetSymbolActive=false;toaState.hetSymbolThresholdsDone=[];toaState.hetSymbolSequence=[];toaState.hetSymbolStep=0;toaState.hetShadowPhase=0;toaState.hetShadowActive=false;toaState.hetShadowUnlockedQuadrant=null;toaState.hetSelectedShadow='nw';toaState.remoteHetSelectedShadow='ne';toaState.hetShadows={nw:{hp:45,dead:false,charging:false,chargeEnd:0},ne:{hp:45,dead:false,charging:false,chargeEnd:0},sw:{hp:45,dead:false,charging:false,chargeEnd:0},se:{hp:45,dead:false,charging:false,chargeEnd:0}};toaRenderHetShadows();toaRenderFood();toaRenderPrayer(false);toaRenderPrayer(true);toaRenderHetWeapon(false);toaRenderHetWeapon(true);toaState.hetX=toaState.mode==='party'?47:50;toaState.hetY=76;toaState.remoteHetX=53;toaState.remoteHetY=76;$('toaHetSafePanel')?.classList.add('hidden');if($('toaHetBoss')){$('toaHetBoss').style.display='';$('toaHetBoss').removeAttribute('aria-hidden');$('toaHetBoss').classList.remove('hidden');}$('toaHetBossHud')?.classList.remove('hidden');$('toaHetPlayerHud')?.classList.remove('hidden');toaUpdateHetHud();toaRenderHetBoss();const p=$('toaHetPlayer'),m=$('toaHetTeammate');p?.classList.remove('toa-dead','hidden');m?.classList.remove('toa-dead');if(p){p.style.display='';p.style.opacity='';p.style.left=toaState.hetX+'%';p.style.top=toaState.hetY+'%'}if(m){m.style.display='';m.style.opacity='';m.style.left='53%';m.style.top='76%'}$('toaHetArenaBanner')?.classList.remove('hidden');$('toaRoomStatus').innerHTML='<b>ROOM</b> PATH OF HET · LIGHT TRIAL';startToaHetMusic();toaNotice('Stay inside the circular arena. The Path of Het trial begins!',4200);setTimeout(()=>$('toaHetArenaBanner')?.classList.add('hidden'),2600);}
function toaClampHetCircle(x,y){const cx=50,cy=55,rx=35,ry=35;let dx=(x-cx)/rx,dy=(y-cy)/ry,d=Math.hypot(dx,dy);if(d>.92){dx/=d;dy/=d;x=cx+dx*rx*.92;y=cy+dy*ry*.92;}return{x,y};}
function toaSpawnKephriFireball(x,y,fromParty=false){if(!toaState.kephriActive||toaState.room!=='scarabas-arena')return;const fx=$('toaScarabasEffects');if(!fx)return;x=Math.max(11,Math.min(89,x));y=Math.max(17,Math.min(86,y));const shadow=document.createElement('i');shadow.className='toa-fireball-shadow';shadow.style.left=x+'%';shadow.style.top=y+'%';fx.appendChild(shadow);const ball=document.createElement('i');ball.className='toa-kephri-fireball';ball.style.left='50%';ball.style.top='35%';fx.appendChild(ball);const start=performance.now(),duration=1450;function drop(now){const q=Math.min(1,(now-start)/duration),ease=q*q;ball.style.left=(50+(x-50)*q)+'%';ball.style.top=(35+(y-35)*ease)+'%';ball.style.scale=(.55+q*.7);if(q<1&&toaState.kephriActive)requestAnimationFrame(drop);else{ball.remove();shadow.remove();if(!toaState.kephriActive)return;const impact=document.createElement('i');impact.className='toa-fireball-impact';impact.style.left=x+'%';impact.style.top=y+'%';fx.appendChild(impact);setTimeout(()=>impact.remove(),600);const d=Math.hypot(toaState.arenaX-x,toaState.arenaY-y);if(d<6.8)toaKephriDamage(40,'The fireball hits you for 40 — move away from the shadow!')}}requestAnimationFrame(drop);}
function toaUpdateKephriFleas(dt,t){
  if(!toaState.kephriFleas.length||toaState.localDead)return;
  const players=[[toaState.arenaX,toaState.arenaY]];
  if(toaState.mode==='party'&&!toaState.remoteDead)players.push([toaState.remoteScarabasX,toaState.remoteScarabasY]);
  toaState.kephriFleas.forEach((f,i)=>{
    f.phase+=dt*(.0026+(i%4)*.00018);
    f.vx=(f.vx||0)*.985+Math.cos(f.phase+i*.73)*dt*.000012;
    f.vy=(f.vy||0)*.985+Math.sin(f.phase*1.21+i)*dt*.000010;
    players.forEach(([px,py])=>{
      const dx=f.x-px,dy=f.y-py,d=Math.hypot(dx,dy)||.01;
      if(d<11){const force=(11-d)/11;f.vx+=(dx/d)*force*dt*.00010;f.vy+=(dy/d)*force*dt*.00009;}
    });
    const speed=Math.hypot(f.vx,f.vy),cap=.010;
    if(speed>cap){f.vx=f.vx/speed*cap;f.vy=f.vy/speed*cap;}
    f.x+=f.vx*dt;f.y+=f.vy*dt;
    if(f.x<12){f.x=12;f.vx=Math.abs(f.vx)}
    if(f.x>88){f.x=88;f.vx=-Math.abs(f.vx)}
    if(f.y<18){f.y=18;f.vy=Math.abs(f.vy)}
    if(f.y>86){f.y=86;f.vy=-Math.abs(f.vy)}
    f.el.style.left=f.x+'%';f.el.style.top=f.y+'%';
  });
  toaState.kephriFleaTimer-=dt;
  if(toaState.kephriFleaTimer<=0){
    toaState.kephriFleaTimer=850+Math.random()*350;
    const f=toaState.kephriFleas[Math.floor(Math.random()*toaState.kephriFleas.length)],fx=$('toaScarabasEffects');
    if(f&&fx){
      const shot=document.createElement('i');shot.className='toa-flea-shot';shot.style.left=f.x+'%';shot.style.top=f.y+'%';fx.appendChild(shot);
      const sx=f.x,sy=f.y,tx=toaState.arenaX,ty=toaState.arenaY,start=performance.now();
      function fly(now){
        const q=Math.min(1,(now-start)/350);shot.style.left=(sx+(tx-sx)*q)+'%';shot.style.top=(sy+(ty-sy)*q)+'%';
        if(q<1)requestAnimationFrame(fly);
        else{
          shot.remove();
          if(toaState.prayer!=='ranged')toaKephriDamage(2,'The fleas pepper you with tiny ranged hits.');
          else{const zero=document.createElement('b');zero.className='toa-kephri-damage blocked';zero.textContent='0';zero.style.left=toaState.arenaX+'%';zero.style.top=(toaState.arenaY-3)+'%';fx.appendChild(zero);setTimeout(()=>zero.remove(),700)}
        }
      }
      requestAnimationFrame(fly);
    }
  }
}
function toaUpdateKephri(dt){
  if(toaState.raidDefeated||!toaState.kephriActive||toaState.room!=='scarabas-arena')return;
  toaUpdateKephriFleas(dt,performance.now());toaUpdateKephriAdds(dt);
  const authority=toaHasCombatAuthority();
  if(authority){
    toaState.kephriAttackTimer-=dt;
    if(toaState.kephriAttackTimer<=0){
      toaState.kephriAttackTimer=1000;
      if(toaState.kephriAddsActive){toaTryAttackKephriAdd(false);if(toaState.mode==='party'&&!toaState.remoteDead)toaTryAttackKephriAdd(true)}
      else{if(toaKephriInMeleeRange(toaState.arenaX,toaState.arenaY))toaKephriStrike(toaState.arenaX,toaState.arenaY,false);if(toaState.mode==='party'&&!toaState.remoteDead&&toaKephriInMeleeRange(toaState.remoteScarabasX,toaState.remoteScarabasY))toaKephriStrike(toaState.remoteScarabasX,toaState.remoteScarabasY,true)}
    }
    if(toaState.kephriAddsActive){
      toaState.kephriAddDiveTimer-=dt;
      if(toaState.kephriAddDiveTimer<=0){
        toaState.kephriAddDiveTimer=8000+Math.random()*4000;
        if(Math.random()<.30){
          const living=[{x:toaState.arenaX,y:toaState.arenaY,remote:false}];
          if(toaState.mode==='party'&&!toaState.remoteDead)living.push({x:toaState.remoteScarabasX,y:toaState.remoteScarabasY,remote:true});
          const target=living[Math.floor(Math.random()*living.length)];
          toaSpawnKephriDiveScarab(target.x,target.y,false);
          if(target.remote&&toaState.channel)toaPartySend({type:'kephri-dive',sender:character?.id,x:target.x,y:target.y});
        }
      }
    }
    if(!toaState.kephriAddsActive){
      toaState.kephriFireballTimer-=dt;
      if(toaState.kephriFireballTimer<=0){
        toaState.kephriFireballTimer=toaState.kephriFinalRush?(1450+Math.random()*350):(2600+Math.random()*650);
        // The combat authority creates the complete volley and broadcasts every
        // fireball. This keeps both players (including dead spectators) looking
        // at the exact same attacks instead of only receiving their own target.
        const localFireball={x:toaState.arenaX,y:toaState.arenaY,target:'authority'};
        toaSpawnKephriFireball(localFireball.x,localFireball.y,false);
        if(toaState.mode==='party'&&toaState.channel)toaPartySend({type:'kephri-fireball',sender:character?.id,x:localFireball.x,y:localFireball.y,target:localFireball.target});
        if(toaState.mode==='party'&&!toaState.remoteDead){
          const remoteFireball={x:toaState.remoteScarabasX,y:toaState.remoteScarabasY,target:'remote'};
          toaSpawnKephriFireball(remoteFireball.x,remoteFireball.y,false);
          if(toaState.channel)toaPartySend({type:'kephri-fireball',sender:character?.id,x:remoteFireball.x,y:remoteFireball.y,target:remoteFireball.target});
        }
      }
      if(toaState.kephriDiveTriggered){
        toaState.kephriDiveTimer-=dt;
        if(toaState.kephriDiveTimer<=0){
          toaState.kephriDiveTimer=(toaState.kephriFinalRush?1500:2200)+Math.random()*500;
          toaSpawnKephriDiveScarab(toaState.arenaX,toaState.arenaY,false);
          if(toaState.mode==='party'&&!toaState.remoteDead){toaSpawnKephriDiveScarab(toaState.remoteScarabasX,toaState.remoteScarabasY,false);toaPartySend({type:'kephri-dive',sender:character?.id,x:toaState.remoteScarabasX,y:toaState.remoteScarabasY});}
        }
      }
    }
  }
}

function toaUpdateCombatHud(){
  const z=Math.max(0,toaState.zebakHp),p=Math.max(0,toaState.playerHp),zp=Math.round(z/toaState.zebakMaxHp*100),pp=Math.round(p/toaState.playerMaxHp*100);
  if($('toaZebakHpFill'))$('toaZebakHpFill').style.width=zp+'%';if($('toaZebakHpText'))$('toaZebakHpText').textContent=zp+'%';
  if($('toaPlayerHpFill'))$('toaPlayerHpFill').style.width=pp+'%';if($('toaPlayerHpText'))$('toaPlayerHpText').textContent=p+' / '+toaState.playerMaxHp;
}
function toaPoint(el){const room=$('toaCrondisRoom'),r=room.getBoundingClientRect(),e=el.getBoundingClientRect();return{x:(e.left+e.width/2-r.left)/r.width*100,y:(e.top+e.height/2-r.top)/r.height*100}}
function toaProjectile(kind,fromX,fromY,toX,toY,duration=520,onHit){
  const fx=$('toaCombatEffects');if(!fx)return;const el=document.createElement('i');el.className='toa-projectile '+kind;el.style.left=fromX+'%';el.style.top=fromY+'%';fx.appendChild(el);
  const angle=Math.atan2(toY-fromY,toX-fromX)*180/Math.PI;el.style.rotate=angle+'deg';const start=performance.now();
  function step(now){const q=Math.min(1,(now-start)/duration),ease=1-Math.pow(1-q,2);el.style.left=(fromX+(toX-fromX)*ease)+'%';el.style.top=(fromY+(toY-fromY)*ease)+'%';if(q<1)requestAnimationFrame(step);else{el.remove();if(onHit)onHit()}}requestAnimationFrame(step);
}
function toaDamageSplat(x,y,text,kind=''){const fx=$('toaCombatEffects');if(!fx)return;const s=document.createElement('b');s.className='toa-damage-splat '+kind;s.textContent=text;s.style.left=x+'%';s.style.top=y+'%';fx.appendChild(s);setTimeout(()=>s.remove(),780)}
function toaAutoShoot(){
  if(!toaState.fightActive||toaState.fightPaused||toaState.room!=='crondis-arena')return;const p=$('toaCrondisPlayer');p.classList.remove('toa-firing');void p.offsetWidth;p.classList.add('toa-firing');setTimeout(()=>p.classList.remove('toa-firing'),300);
  const sx=toaState.arenaX,sy=toaState.arenaY-2,tx=50+(Math.random()*4-2),ty=15;toaProjectile('player-arrow',sx,sy,tx,ty,470,()=>{if(!toaState.fightActive)return;const damage=1;let floor=toaState.phase===1?70:toaState.phase===2?60:toaState.phase===3?40:toaState.phase===4?25:toaState.phase===5?10:0;toaState.zebakHp=Math.max(floor,toaState.zebakHp-damage);toaDamageSplat(tx,ty+3,damage);toaUpdateCombatHud();if(toaState.phase===1&&toaState.zebakHp<=70)toaReachFirstThreshold();else if(toaState.phase===2&&toaState.zebakHp<=60)toaReachWaveThreshold();else if(toaState.phase===3&&toaState.zebakHp<=40)toaReachFortyThreshold();else if(toaState.phase===4&&toaState.zebakHp<=25)toaReachTwentyFiveThreshold();else if(toaState.phase===5&&toaState.zebakHp<=10)toaReachFinalSurge();else if(toaState.phase===6&&toaState.zebakHp<=0)toaDefeatZebak()});
}
function toaZebakScream(){const z=$('toaZebakVisual'),room=$('toaCrondisRoom');z?.classList.add('screaming');room?.classList.add('toa-scream-cue');setTimeout(()=>{z?.classList.remove('screaming');room?.classList.remove('toa-scream-cue')},1500)}
function toaRenderAcidPools(pools,final=false){
  toaClearAcid();const fx=$('toaCombatEffects');if(!fx)return;toaState.acidPools=(pools||[]).map(p=>({x:Number(p.x),y:Number(p.y),w:Number(p.w),h:Number(p.h)}));toaState.acidPools.forEach((a,i)=>{const shot=document.createElement('i');shot.className='toa-acid-shot'+(final?' final':'');shot.style.left='50%';shot.style.top='17%';fx.appendChild(shot);const pool=document.createElement('i');pool.className='toa-acid-pool'+(final?' final':'');pool.style.left=a.x+'%';pool.style.top=a.y+'%';pool.style.width=a.w+'%';pool.style.height=a.h+'%';pool.style.setProperty('--acid-delay',(i*(final?.1:.12))+'s');fx.appendChild(pool);setTimeout(()=>shot.remove(),850)});
}
function toaSpawnAcid(sharedPools=null,fromParty=false){
  // Acid generation follows combat authority, not the original room host. This lets
  // the surviving guest continue every Zebak phase after the host has died.
  if(toaState.mode==='party'&&!toaHasCombatAuthority()&&!fromParty)return;let pools=Array.isArray(sharedPools)?sharedPools:null;if(!pools){pools=[];for(let i=0;i<6;i++){const w=12+Math.random()*8,h=8+Math.random()*7,x=12+Math.random()*(76-w),y=30+Math.random()*(50-h);pools.push({x,y,w,h})}}toaRenderAcidPools(pools,false);if(toaState.mode==='party'&&toaHasCombatAuthority()&&!fromParty&&toaState.channel)toaPartySend({type:'zebak-acid',sender:character?.id,final:false,pools});toaNotice('Zebak spits acid across the arena — keep moving!',3800);
}
function toaClearAcid(){toaState.acidPools=[];document.querySelectorAll('.toa-acid-pool,.toa-acid-shot').forEach(e=>e.remove())}
function toaReachFirstThreshold(){
  if(toaState.acidTriggered)return;toaState.acidTriggered=true;toaState.fightPaused=true;clearTimeout(toaState.attackTimer);clearTimeout(toaState.pendingAttack);document.getElementById('toaBossCharge')?.remove();$('toaZebakPhase').textContent='ACID PHASE · 70% → 60%';toaZebakScream();toaNotice('Zebak roars and prepares a poisonous spit!',2400);
  setTimeout(()=>toaSpawnAcid(),900);setTimeout(()=>{if(!toaState.fightActive)return;toaState.phase=2;toaState.fightPaused=false;toaScheduleZebakAttack()},2300);
}
function toaReachWaveThreshold(){
  if(toaState.waveTriggered)return;toaState.waveTriggered=true;toaState.phase=3;$('toaZebakPhase').textContent='TIDAL WAVES · 60% → 40%';toaZebakScream();toaNotice('Zebak summons a tidal wave! Find the moving gap!',3500);setTimeout(()=>toaLaunchWave(),900);
}
function toaLaunchWave(){
  if(!toaState.fightActive||toaState.phase!==3||toaState.zebakHp<=40)return;clearTimeout(toaState.waveTimer);toaState.waveActive=true;toaState.waveHit=false;const fx=$('toaCombatEffects');if(!fx)return;
  const wave=document.createElement('div');wave.className='toa-tidal-wave';const top=document.createElement('i'),bottom=document.createElement('i');top.className='toa-wave-water top';bottom.className='toa-wave-water bottom';wave.append(top,bottom);fx.appendChild(wave);
  const startGap=34+Math.random()*34,endGap=34+Math.random()*34,gapSize=18,start=performance.now(),duration=2050;
  function step(now){if(!toaState.fightActive||toaState.phase!==3){wave.remove();toaState.waveActive=false;return}const q=Math.min(1,(now-start)/duration),x=-8+q*116,gap=startGap+(endGap-startGap)*q;wave.style.left=x+'%';top.style.height=Math.max(0,gap-gapSize/2)+'%';bottom.style.top=(gap+gapSize/2)+'%';bottom.style.height=Math.max(0,100-(gap+gapSize/2))+'%';
    if(!toaState.waveHit&&Math.abs(toaState.arenaX-x)<5&&(toaState.arenaY<gap-gapSize/2||toaState.arenaY>gap+gapSize/2)){toaState.waveHit=true;toaState.playerHp=Math.max(0,toaState.playerHp-14);toaState.arenaX=Math.min(91,toaState.arenaX+10);const p=$('toaCrondisPlayer');p.style.left=toaState.arenaX+'%';p.classList.add('toa-hit');setTimeout(()=>p.classList.remove('toa-hit'),300);toaDamageSplat(toaState.arenaX,toaState.arenaY-5,14);toaUpdateCombatHud();toaNotice('The wave slams into you!',1200);if(toaState.playerHp<=0){wave.remove();toaEndZebakFight(false);return}}
    if(q<1)requestAnimationFrame(step);else{wave.remove();toaState.waveActive=false;if(toaState.fightActive&&toaState.phase===3&&toaState.zebakHp>40)toaState.waveTimer=setTimeout(toaLaunchWave,2800)}}requestAnimationFrame(step);
}
function toaReachFortyThreshold(){
  toaState.phase=4;toaState.fightPaused=true;clearTimeout(toaState.waveTimer);document.querySelectorAll('.toa-tidal-wave').forEach(e=>e.remove());toaClearAcid();$('toaZebakPhase').textContent='BLOOD ORBS · 40% → 25%';toaNotice('The waves subside. Zebak calls forth blood orbs!',3200);
  setTimeout(()=>{if(!toaState.fightActive)return;toaSpawnBloodOrbs();toaState.fightPaused=false;toaScheduleZebakAttack()},900)
}
function toaSpawnBloodOrbs(){
  toaClearBloodOrbs();const fx=$('toaCombatEffects');if(!fx)return;
  for(let i=0;i<5;i++){const angle=(Math.PI*2*i/5)+Math.random()*.4,x=50+Math.cos(angle)*(18+Math.random()*10),y=48+Math.sin(angle)*(16+Math.random()*9),el=document.createElement('i');el.className='toa-blood-orb';el.style.left=x+'%';el.style.top=y+'%';fx.appendChild(el);toaState.bloodOrbs.push({x,y,el,nextHit:0})}
}
function toaClearBloodOrbs(){toaState.bloodOrbs.forEach(o=>o.el?.remove());toaState.bloodOrbs=[];document.querySelectorAll('.toa-blood-orb').forEach(e=>e.remove())}
function toaUpdateBloodOrbs(dt,now){
  if(!toaState.fightActive||toaState.localDead||!(toaState.phase===4||toaState.phase===5||toaState.phase===6)||!toaState.bloodOrbs.length)return;
  for(const o of toaState.bloodOrbs){const dx=toaState.arenaX-o.x,dy=toaState.arenaY-o.y,d=Math.hypot(dx,dy)||1,speed=.0076*dt;o.x+=dx/d*Math.min(speed,d);o.y+=dy/d*Math.min(speed,d);o.el.style.left=o.x+'%';o.el.style.top=o.y+'%';if(d<4.2&&now>=o.nextHit){o.nextHit=now+1050;toaState.playerHp=Math.max(0,toaState.playerHp-7);toaDamageSplat(toaState.arenaX,toaState.arenaY-5,7);toaUpdateCombatHud();toaNotice('A blood orb drains your health!',850);if(toaState.playerHp<=0){toaEndZebakFight(false);return}}}
}
function toaSpawnFinalAcid(sharedPools=null,fromParty=false){
  // Final-phase acid also transfers to whichever living player has authority.
  if(toaState.mode==='party'&&!toaHasCombatAuthority()&&!fromParty)return;let pools=Array.isArray(sharedPools)?sharedPools:null;if(!pools){pools=[];for(let i=0;i<5;i++){const w=11+Math.random()*7,h=8+Math.random()*6,x=12+Math.random()*(76-w),y=31+Math.random()*(49-h);pools.push({x,y,w,h})}}toaRenderAcidPools(pools,true);if(toaState.mode==='party'&&toaHasCombatAuthority()&&!fromParty&&toaState.channel)toaPartySend({type:'zebak-acid',sender:character?.id,final:true,pools});
}
function toaReachTwentyFiveThreshold(){
  if(toaState.finalAcidTriggered)return;toaState.finalAcidTriggered=true;toaState.phase=5;toaState.fightPaused=true;toaClearBloodOrbs();clearTimeout(toaState.attackTimer);clearTimeout(toaState.pendingAttack);document.getElementById('toaBossCharge')?.remove();$('toaZebakPhase').textContent='ENRAGED · 25% → 10%';toaZebakScream();toaNotice('Zebak enrages, spits fresh acid and summons more blood orbs!',3200);setTimeout(toaSpawnFinalAcid,700);setTimeout(toaSpawnBloodOrbs,1050);setTimeout(()=>{if(!toaState.fightActive)return;toaState.fightPaused=false;toaScheduleZebakAttack()},1700)
}

function toaReachFinalSurge(){
  if(toaState.finalSurgeTriggered)return;toaState.finalSurgeTriggered=true;toaState.phase=6;toaClearBloodOrbs();clearTimeout(toaState.attackTimer);clearTimeout(toaState.pendingAttack);document.getElementById('toaBossCharge')?.remove();
  $('toaZebakPhase').textContent='FINAL RAGE · 10% → 0%';$('toaCrondisRoom')?.classList.add('toa-final-shake');toaNotice('Zebak enters a final rage — blood orbs and boulders flood the arena!',3500);
  toaSpawnBloodOrbs();toaScheduleBoulder();toaScheduleZebakAttack();
}
function toaScheduleBoulder(){
  clearTimeout(toaState.boulderTimer);if(!toaState.fightActive||toaState.phase!==6)return;
  toaState.boulderTimer=setTimeout(()=>{toaDropBoulder();if(Math.random()<.4)setTimeout(toaDropBoulder,260);toaScheduleBoulder()},600+Math.random()*700);
}
function toaDropBoulder(){
  if(!toaState.fightActive||toaState.phase!==6)return;const fx=$('toaCombatEffects');if(!fx)return;
  const x=13+Math.random()*74,y=31+Math.random()*50,warning=document.createElement('i');warning.className='toa-boulder-warning';warning.style.left=x+'%';warning.style.top=y+'%';fx.appendChild(warning);
  setTimeout(()=>{if(!toaState.fightActive||toaState.phase!==6){warning.remove();return}warning.remove();const rock=document.createElement('i');rock.className='toa-falling-boulder';rock.style.left=x+'%';rock.style.top=y+'%';fx.appendChild(rock);
    setTimeout(()=>{const d=Math.hypot((toaState.arenaX-x)*.85,toaState.arenaY-y);if(d<7.5){const damage=16+Math.floor(Math.random()*8);toaState.playerHp=Math.max(0,toaState.playerHp-damage);toaDamageSplat(toaState.arenaX,toaState.arenaY-5,damage);toaUpdateCombatHud();toaNotice('A boulder crushes into you!',1000);if(toaState.playerHp<=0)toaEndZebakFight(false)}rock.classList.add('landed');setTimeout(()=>rock.remove(),500)},520)
  },850)
}
function toaClearBoulders(){clearTimeout(toaState.boulderTimer);document.querySelectorAll('.toa-boulder-warning,.toa-falling-boulder').forEach(e=>e.remove());$('toaCrondisRoom')?.classList.remove('toa-final-shake')}

function toaDefeatZebak(){
  if(!toaState.fightActive)return;toaEndZebakFight(true);toaState.zebakHp=0;toaState.crondisComplete=true;toaState.helperActive=true;toaState.partyVictory=true;toaUpdateCombatHud();$('toaZebakPhase').textContent='DEFEATED';$('toaZebakHud').classList.add('toa-defeated');toaSpawnHelpfulSpirit();if(toaState.channel)toaPartySend({type:'zebak-victory',sender:character?.id});toaRevivePartyAtVictory();toaNotice('Zebak has been defeated. Speak to the Helpful Spirit.',5000)
}
function toaSpawnHelpfulSpirit(){
  const fx=$('toaCombatEffects');if(!fx)return;document.getElementById('toaHelpfulSpirit')?.remove();const spirit=document.createElement('button');spirit.type='button';spirit.id='toaHelpfulSpirit';spirit.className='toa-helpful-spirit';spirit.style.left='50%';spirit.style.top='23%';spirit.innerHTML='<i></i><b>Helpful spirit</b>';spirit.addEventListener('click',toaUseHelpfulSpirit);fx.appendChild(spirit)
}
function toaNearHelpfulSpirit(){return toaState.room==='crondis-arena'&&toaState.helperActive&&Math.hypot(toaState.arenaX-50,(toaState.arenaY-23)*1.15)<13}
function toaUseHelpfulSpirit(){if(!toaNearHelpfulSpirit()){toaNotice('Move closer to the Helpful Spirit.',1200);return}toaState.helperActive=false;toaState.crondisComplete=true;toaReturnToNexus();toaUpdateCrondisUnlock();toaNotice('Path of Crondis complete.',3500)}
function toaCheckAcid(now){if(!toaState.fightActive||!toaState.acidPools.length||!(toaState.phase===2||toaState.phase===3||toaState.phase===5||toaState.phase===6)||now<toaState.acidTick)return;const inAcid=toaState.acidPools.some(a=>{const cx=a.x+a.w/2,cy=a.y+a.h/2;return Math.pow((toaState.arenaX-cx)/(a.w/2),2)+Math.pow((toaState.arenaY-cy)/(a.h/2),2)<=1});if(inAcid){const damage=toaState.phase>=5?8:6;toaState.acidTick=now+700;toaState.playerHp=Math.max(0,toaState.playerHp-damage);toaDamageSplat(toaState.arenaX,toaState.arenaY-5,damage);toaUpdateCombatHud();if(toaState.playerHp<=0)toaEndZebakFight(false)}else toaState.acidTick=now+180}
function toaChooseAttack(){
  if(!toaState.fightActive||toaState.fightPaused)return;if(toaState.mode==='party'&&!toaHasCombatAuthority())return;const targets=[{x:toaState.arenaX,y:toaState.arenaY}];if(toaState.mode==='party'&&!toaState.remoteDead)targets.push({x:toaState.remoteScarabasX,y:toaState.remoteScarabasY});const adjacent=targets.some(t=>Math.hypot(t.x-50,(t.y-18)*1.25)<11);let type;if(adjacent&&Math.random()<.45)type='melee';else type=Math.random()<.5?'magic':'ranged';if(toaState.mode==='party'&&toaState.channel)toaPartySend({type:'zebak-attack',sender:character?.id,attackType:type});toaTelegraphAttack(type,false);
}
function toaTelegraphAttack(type,fromParty=false){
  const room=$('toaCrondisRoom'),fx=$('toaCombatEffects'),zebak=$('toaZebakVisual');
  room.classList.add('toa-'+type+'-cue');
  if(type==='melee'){
    zebak?.classList.add('melee-charge');
  }else if(fx){
    const charge=document.createElement('i');
    charge.id='toaBossCharge';
    charge.className='toa-boss-charge '+type;
    charge.style.left='50%';charge.style.top='16%';
    fx.appendChild(charge);
  }
  clearTimeout(toaState.pendingAttack);toaState.pendingAttack=setTimeout(()=>{
    room.classList.remove('toa-'+type+'-cue');
    document.getElementById('toaBossCharge')?.remove();
    toaResolveAttack(type);
  },1800);
}
function toaResolveAttack(type){
  if(!toaState.fightActive||toaState.fightPaused)return;const blocked=toaState.prayer===type,damage=blocked?0:30;
  const hit=()=>{toaDamageSplat(toaState.arenaX,toaState.arenaY-5,blocked?'0':damage,blocked?'blocked':'');if(!blocked){toaState.playerHp=Math.max(0,toaState.playerHp-damage);const p=$('toaCrondisPlayer');p.classList.remove('toa-hit');void p.offsetWidth;p.classList.add('toa-hit');toaUpdateCombatHud();if(toaState.playerHp<=0){toaEndZebakFight(false);return}}else toaNotice('Prayer blocked the '+type+' attack!',900);toaScheduleZebakAttack()};
  if(type==='melee'){
    const fx=$('toaCombatEffects'),zebak=$('toaZebakVisual');zebak?.classList.remove('melee-charge');zebak?.classList.add('stomping');setTimeout(()=>zebak?.classList.remove('stomping'),520);
    const stomp=document.createElement('i');stomp.className='toa-stomp-impact';stomp.style.left=toaState.arenaX+'%';stomp.style.top=toaState.arenaY+'%';fx.appendChild(stomp);setTimeout(()=>stomp.remove(),620);setTimeout(hit,260)
  }else toaProjectile(type,50,16,toaState.arenaX,toaState.arenaY-2,620,hit);
}
function toaScheduleZebakAttack(){clearTimeout(toaState.attackTimer);if(toaState.mode==='party'&&!toaHasCombatAuthority())return;if(toaState.fightActive&&!toaState.fightPaused){const delay=toaState.phase===6?575:toaState.phase===5?875:toaState.phase===4?1575:1750;toaState.attackTimer=setTimeout(toaChooseAttack,delay)}}
function toaStartZebakFight(){
  toaState.raidDefeated=false;
  toaState.raidDefeated=false;toaState.zebakHp=100;toaState.playerHp=99;toaState.phase=1;toaState.acidPools=[];toaState.acidTriggered=false;toaState.waveTriggered=false;toaState.waveActive=false;toaState.acidTick=0;toaState.bloodOrbs=[];toaState.finalAcidTriggered=false;toaState.finalSurgeTriggered=false;toaClearBoulders();toaState.helperActive=false;toaState.localDead=false;toaState.remoteDead=false;toaState.partyVictory=false;$('toaCrondisPlayer')?.classList.remove('toa-dead');$('toaCrondisTeammate')?.classList.remove('toa-dead');if($('toaDefeatedPanel')){$('toaDefeatedPanel').classList.add('hidden');$('toaDefeatedPanel').style.display='';}toaState.fightActive=true;toaState.fightPaused=false;$('toaZebakHud').classList.remove('hidden');$('toaPlayerHud').classList.remove('hidden');$('toaZebakPhase').textContent='NORMAL ATTACKS · 100% → 70%';toaUpdateCombatHud();clearInterval(toaState.autoAttackTimer);const autoRate=toaState.mode==='party'?1500:1200;toaState.autoAttackTimer=setInterval(toaAutoShoot,autoRate);setTimeout(toaAutoShoot,250);if(toaHasCombatAuthority())toaState.attackTimer=setTimeout(toaChooseAttack,1400);
}
function toaCleanupZebakCombat(){
  clearInterval(toaState.autoAttackTimer);clearTimeout(toaState.attackTimer);clearTimeout(toaState.pendingAttack);clearTimeout(toaState.waveTimer);toaClearAcid();toaClearBloodOrbs();toaClearBoulders();document.querySelectorAll('.toa-tidal-wave').forEach(e=>e.remove());$('toaAttackWarning')?.classList.add('hidden');document.getElementById('toaBossCharge')?.remove();$('toaZebakVisual')?.classList.remove('melee-charge','stomping');
}
function toaLockRaidAfterWipe(){
  if(toaState.raidDefeated)return;
  toaState.raidDefeated=true;
  toaState.keys={};
  toaState.fightActive=false;toaState.fightPaused=true;toaState.kephriActive=false;toaState.hetBossAttacking=false;
  clearInterval(toaState.autoAttackTimer);clearTimeout(toaState.attackTimer);clearTimeout(toaState.pendingAttack);clearTimeout(toaState.waveTimer);clearTimeout(toaState.boulderTimer);
  toaCleanupZebakCombat();toaClearBloodOrbs();toaClearBoulders();
  toaState.kephriFleas=[];toaState.kephriAdds=[];toaState.kephriDiveBombs=[];
  ['toaCombatEffects','toaScarabasEffects','toaHetEffects'].forEach(id=>{const el=$(id);if(el)el.replaceChildren();});
  ['toaCrondisPlayer','toaCrondisTeammate','toaScarabasPlayer','toaScarabasTeammate','toaHetPlayer','toaHetTeammate'].forEach(id=>{
    const el=$(id);if(!el)return;el.classList.remove('walking','toa-firing','toa-keris-strike','toa-het-player-attacking','toa-hit','toa-eating');el.classList.add('toa-dead');
  });
  const boss=$('toaHetBoss');if(boss)boss.classList.remove('toa-akkha-attacking','toa-akkha-stomp');
  $('toaAttackWarning')?.classList.add('hidden');document.getElementById('toaBossCharge')?.remove();
}
function toaShowDefeatedPanel(partyWipe=false){
  toaLockRaidAfterWipe();
  const panel=$('toaDefeatedPanel'),text=$('toaDefeatedText'),lobby=$('toaLobby');if(!panel)return;
  if(lobby&&panel.parentElement!==lobby)lobby.appendChild(panel);panel.classList.remove('hidden');panel.style.display='block';panel.style.zIndex='120';
  const scarabas=toaState.room==='scarabas-arena',het=toaState.room==='het-arena';if($('toaDefeatedTitle'))$('toaDefeatedTitle').textContent='YOU HAVE BEEN DEFEATED';const path=panel.querySelector('span');if(path)path.textContent=het?'PATH OF HET':scarabas?'PATH OF SCARABAS':'PATH OF CRONDIS';if(text)text.textContent=partyWipe?'Both raiders have fallen. Exit the raid to try again.':(het?'Akkha has defeated you. Exit the raid to try again.':scarabas?'Kephri overwhelmed you. Quit and reopen the raid to try again.':'Zebak overwhelmed you. Quit and reopen the raid to try again.');
}
function toaEnterCoopSpectator(){
  toaState.localDead=true;toaState.fightActive=true;toaState.fightPaused=false;clearInterval(toaState.autoAttackTimer);clearTimeout(toaState.attackTimer);clearTimeout(toaState.pendingAttack);toaState.playerHp=0;toaUpdateCombatHud();$('toaCrondisPlayer')?.classList.add('toa-dead');if(toaState.channel)toaPartySend({type:'player-dead',sender:character?.id});
  if(toaState.remoteDead)toaShowDefeatedPanel(true);else toaNotice('You have been defeated. Your teammate is still fighting!',5000);
}
function toaRevivePartyAtVictory(){
  if(toaState.mode!=='party')return;toaState.localDead=false;toaState.remoteDead=false;toaState.playerHp=99;toaState.arenaX=47;toaState.arenaY=29;toaUpdateCombatHud();const p=$('toaCrondisPlayer'),mate=$('toaCrondisTeammate');p?.classList.remove('toa-dead');mate?.classList.remove('toa-dead');if(p){p.style.left='47%';p.style.top='29%'}if(mate){mate.style.left='53%';mate.style.top='29%'}if($('toaDefeatedPanel')){$('toaDefeatedPanel').classList.add('hidden');$('toaDefeatedPanel').style.display='';}
}
function toaHandlePartyVictory(remote=false){
  if(toaState.mode!=='party'||toaState.partyVictory)return;toaState.partyVictory=true;toaState.fightActive=false;toaState.fightPaused=true;toaCleanupZebakCombat();toaState.zebakHp=0;toaState.crondisComplete=true;toaState.helperActive=true;toaUpdateCombatHud();$('toaZebakPhase').textContent='DEFEATED';$('toaZebakHud')?.classList.add('toa-defeated');toaSpawnHelpfulSpirit();toaRevivePartyAtVictory();toaNotice(remote?'Your teammate defeated Zebak — you have been revived!':'Zebak has been defeated.',5000);
}
function toaEndZebakFight(survived=true){
  if(!survived&&toaState.mode==='party'){toaEnterCoopSpectator();return}
  toaState.fightActive=false;toaState.fightPaused=true;toaCleanupZebakCombat();document.getElementById('toaHelpfulSpirit')?.remove();if(!survived){toaShowDefeatedPanel(false)}
}
function toaResetRaid(){
  toaEndZebakFight(true);toaState.keys={};toaState.last=0;toaState.mode='none';toaState.code='';toaState.hostCode='';toaState.roomId=null;toaState.hostName='';toaState.guestName='';toaState.room='nexus';toaState.partyJoined=false;toaState.localReady=false;toaState.remoteReady=false;toaState.prayer=null;toaState.remotePrayer=null;toaState.sharks=3;toaState.chatTyping=false;toaState.crondisComplete=false;toaState.scarabasComplete=false;toaState.hetComplete=false;toaState.apmekenComplete=false;toaState.apmekenX=48;toaState.apmekenY=73;toaState.remoteApmekenX=52;toaState.remoteApmekenY=73;toaState.remoteApmekenTarget=null;toaState.finalSurgeTriggered=false;toaState.helperActive=false;toaState.localDead=false;toaState.remoteDead=false;toaState.partyVictory=false;toaState.raidDefeated=false;toaState.isHost=false;toaState.netConnected=false;toaState.remoteTarget=null;toaState.remoteAdminMode=false;toaState.x=50;toaState.y=79;toaState.arenaX=50;toaState.arenaY=70;toaState.kephriHp=100;toaState.kephriActive=false;toaState.kephriAttackTimer=0;toaState.kephriFireballTimer=0;toaState.kephriPlayerHp=99;toaState.kephriDungWalls=[];toaState.kephriDungStrike60=false;toaState.kephriDungStrike30=false;toaState.kephriDungStrike15=false;toaState.kephriKnockback=false;toaState.kephriAddsTriggered=false;toaState.kephriAddsActive=false;toaState.kephriAdds=[];toaState.kephriBlueTimer=0;toaState.kephriAddAttackTimer=0;toaState.kephriAddDiveTimer=0;toaState.kephriDiveTriggered=false;toaState.kephriDiveTimer=0;toaState.kephriDiveBombs=[];toaState.kephriFinalRush=false;toaState.kephriHelperActive=false;
  const player=$('toaPlayer'),crondisPlayer=$('toaCrondisPlayer'),mate=$('toaCrondisTeammate');
  if(player){player.classList.remove('hidden','walking','facing-left');player.style.left='50%';player.style.top='79%';}
  if(crondisPlayer){crondisPlayer.classList.remove('toa-armed','walking','facing-left');crondisPlayer.style.left='47%';crondisPlayer.style.top='91%';}
  if(mate){mate.classList.add('hidden');mate.classList.remove('toa-armed','walking','facing-left');mate.style.left='53%';mate.style.top='91%';}
  $('toaZebakHud')?.classList.add('hidden');$('toaZebakHud')?.classList.remove('toa-defeated');$('toaPlayerHud')?.classList.add('hidden');$('toaAttackWarning')?.classList.add('hidden');if($('toaDefeatedPanel')){$('toaDefeatedPanel').classList.add('hidden');$('toaDefeatedPanel').style.display='';}$('toaCombatEffects')?.replaceChildren();
  $('toaCrondisRoom')?.classList.add('hidden');$('toaScarabasRoom')?.classList.add('hidden');$('toaHetRoom')?.classList.add('hidden');$('toaScarabasRoom')?.classList.remove('kephri-active');$('toaKephriHud')?.classList.add('hidden');$('toaKephriPlayerHud')?.classList.add('hidden');if($('toaScarabasEffects'))$('toaScarabasEffects').innerHTML='';$('toaEnterCrondis')?.classList.add('hidden');$('toaEnterScarabas')?.classList.add('hidden');$('toaEnterHet')?.classList.add('hidden');$('toaCrondisSafePanel')?.classList.remove('hidden');$('toaArenaBanner')?.classList.add('hidden');
  const status=$('toaPartyStatus');if(status)status.innerHTML='<b>MODE</b> NOT STARTED';
  const roomStatus=$('toaRoomStatus');if(roomStatus)roomStatus.innerHTML='<b>ROOM</b> THE NEXUS';
  const input=$('toaCodeInput');if(input)input.value='';
  $('toaPartyBar')?.classList.remove('raid-started');
  $('toaGameShell')?.classList.add('mode-pending');$('toaModeGate')?.classList.remove('hidden');
  toaRenderReady();toaRenderPrayer(false);toaRenderPrayer(true);toaRenderFood();toaUpdateCrondisUnlock();
}
function toaReturnToNexus(){
  toaEndZebakFight(true);$('toaZebakHud')?.classList.add('hidden');$('toaPlayerHud')?.classList.add('hidden');$('toaCombatEffects')?.replaceChildren();
  toaState.room='nexus';toaState.chatTyping=false;toaState.x=20;toaState.y=15;toaState.localReady=false;toaState.remoteReady=false;toaState.prayer=null;toaState.remotePrayer=null;toaRenderPrayer(false);toaRenderPrayer(true);stopToaCrondisMusic();stopToaScarabasMusic();stopToaHetMusic();stopToaApmekenMusic();startToaLobbyMusic();
  $('toaCrondisPlayer').classList.remove('toa-armed');$('toaCrondisTeammate').classList.remove('toa-armed');
  $('toaCrondisRoom').classList.add('hidden');$('toaScarabasRoom')?.classList.add('hidden');$('toaHetRoom')?.classList.add('hidden');$('toaApmekenRoom')?.classList.add('hidden');$('toaPlayer').classList.remove('hidden');$('toaPlayer').style.left=toaState.x+'%';$('toaPlayer').style.top=toaState.y+'%';
  $('toaRoomStatus').innerHTML='<b>ROOM</b> THE NEXUS';$('toaLobby').focus();
}
function toaFrame(t){
  if(!$('toaDialog')?.open){toaState.raf=0;return}
  const dt=Math.min(32,t-(toaState.last||t));toaState.last=t;
  if(toaState.active&&!toaState.raidDefeated&&toaState.room==='nexus'&&!toaState.chatTyping){let dx=0,dy=0;const k=toaState.keys;if(k.KeyW||k.ArrowUp)dy--;if(k.KeyS||k.ArrowDown)dy++;if(k.KeyA||k.ArrowLeft)dx--;if(k.KeyD||k.ArrowRight)dx++;
    const p=$('toaPlayer');p.classList.toggle('walking',!!(dx||dy));if(dx)p.classList.toggle('facing-left',dx<0);
    if(dx||dy){const len=Math.hypot(dx,dy)||1;const speed=.018*dt;const nx=toaState.x+dx/len*speed,ny=toaState.y+dy/len*speed;if(!toaBlocked(nx,toaState.y))toaState.x=nx;else toaNotice(toaEntranceMessage(nx,toaState.y));if(!toaBlocked(toaState.x,ny))toaState.y=ny;else toaNotice(toaEntranceMessage(toaState.x,ny));p.style.left=toaState.x+'%';p.style.top=toaState.y+'%';}
    toaUpdateContextAction();
  } else if(toaState.active&&!toaState.raidDefeated&&toaState.room==='crondis-arena'&&!toaState.localDead){let dx=0,dy=0;const k=toaState.keys;if(k.KeyW||k.ArrowUp)dy--;if(k.KeyS||k.ArrowDown)dy++;if(k.KeyA||k.ArrowLeft)dx--;if(k.KeyD||k.ArrowRight)dx++;
    const p=$('toaCrondisPlayer');p.classList.toggle('walking',!!(dx||dy));if(dx)p.classList.toggle('facing-left',dx<0);
    if(dx||dy){const len=Math.hypot(dx,dy)||1;const speed=.018*dt;toaState.arenaX=Math.max(9,Math.min(91,toaState.arenaX+dx/len*speed));toaState.arenaY=Math.max(25,Math.min(84,toaState.arenaY+dy/len*speed));p.style.left=toaState.arenaX+'%';p.style.top=toaState.arenaY+'%';}
    if(toaState.channel&&t-toaState.lastNetMove>50){toaState.lastNetMove=t;toaPartySend({type:'move-crondis',sender:character?.id,x:toaState.arenaX,y:toaState.arenaY,left:p.classList.contains('facing-left'),walking:!!(dx||dy)});}
  } else if(toaState.active&&!toaState.raidDefeated&&toaState.room==='scarabas-arena'&&!toaState.localDead){let dx=0,dy=0;const k=toaState.keys;if(k.KeyW||k.ArrowUp)dy--;if(k.KeyS||k.ArrowDown)dy++;if(k.KeyA||k.ArrowLeft)dx--;if(k.KeyD||k.ArrowRight)dx++;
    const p=$('toaScarabasPlayer');p?.classList.toggle('walking',!!(dx||dy));if(dx)p?.classList.toggle('facing-left',dx<0);
    if((dx||dy)&&!toaState.kephriKnockback){const len=Math.hypot(dx,dy)||1,speed=.018*dt;const nx=Math.max(8,Math.min(92,toaState.arenaX+dx/len*speed)),ny=Math.max(14,Math.min(88,toaState.arenaY+dy/len*speed));if(!toaScarabasBlocked(nx,toaState.arenaY))toaState.arenaX=nx;if(!toaScarabasBlocked(toaState.arenaX,ny))toaState.arenaY=ny;if(p){p.style.left=toaState.arenaX+'%';p.style.top=toaState.arenaY+'%'}}
    if(toaState.channel&&t-toaState.lastNetMove>50){toaState.lastNetMove=t;toaPartySend({type:'move-scarabas',sender:character?.id,x:toaState.arenaX,y:toaState.arenaY,left:p?.classList.contains('facing-left'),walking:!!(dx||dy)});}
  }
  else if(toaState.active&&!toaState.raidDefeated&&toaState.room==='apmeken-arena'&&!toaState.localDead){let dx=0,dy=0;const k=toaState.keys;if(k.KeyW||k.ArrowUp)dy--;if(k.KeyS||k.ArrowDown)dy++;if(k.KeyA||k.ArrowLeft)dx--;if(k.KeyD||k.ArrowRight)dx++;const p=$('toaApmekenPlayer');p?.classList.toggle('walking',!!(dx||dy));if(dx)p?.classList.toggle('facing-left',dx<0);if(dx||dy){const len=Math.hypot(dx,dy)||1,speed=.018*dt;toaState.apmekenX=Math.max(8.5,Math.min(91.5,toaState.apmekenX+dx/len*speed));toaState.apmekenY=Math.max(4,Math.min(91,toaState.apmekenY+dy/len*speed));if(p){p.style.left=toaState.apmekenX+'%';p.style.top=toaState.apmekenY+'%'}}if(toaState.channel&&t-toaState.lastNetMove>45){toaState.lastNetMove=t;toaPartySend({type:'move-apmeken',sender:character?.id,x:toaState.apmekenX,y:toaState.apmekenY,left:p?.classList.contains('facing-left'),walking:!!(dx||dy)});}}
  else if(toaState.active&&!toaState.raidDefeated&&toaState.room==='het-arena'&&!toaState.localDead){let dx=0,dy=0;const k=toaState.keys;if(k.KeyW||k.ArrowUp)dy--;if(k.KeyS||k.ArrowDown)dy++;if(k.KeyA||k.ArrowLeft)dx--;if(k.KeyD||k.ArrowRight)dx++;const p=$('toaHetPlayer');p?.classList.toggle('walking',!!(dx||dy));if(dx)p?.classList.toggle('facing-left',dx<0);if(dx||dy){const len=Math.hypot(dx,dy)||1,speed=.018*dt,next=toaClampHetCircle(toaState.hetX+dx/len*speed,toaState.hetY+dy/len*speed);toaState.hetX=next.x;toaState.hetY=next.y;if(p){p.style.left=next.x+'%';p.style.top=next.y+'%'}}if(toaState.channel&&t-toaState.lastNetMove>40){toaState.lastNetMove=t;toaPartySend({type:'move-het',sender:character?.id,x:toaState.hetX,y:toaState.hetY,left:p?.classList.contains('facing-left'),walking:!!(dx||dy)});}}
  if(toaState.remoteTarget&&toaState.room==='crondis-arena'){const mate=$('toaCrondisTeammate');if(mate){const cx=parseFloat(mate.style.left)||53,cy=parseFloat(mate.style.top)||70,a=Math.min(1,dt/85);mate.style.left=(cx+(toaState.remoteTarget.x-cx)*a)+'%';mate.style.top=(cy+(toaState.remoteTarget.y-cy)*a)+'%';}}
  if(toaState.remoteTarget&&toaState.room==='scarabas-arena'){const mate=$('toaScarabasTeammate');if(mate){const cx=parseFloat(mate.style.left)||53,cy=parseFloat(mate.style.top)||78,a=Math.min(1,dt/85);mate.style.left=(cx+(toaState.remoteTarget.x-cx)*a)+'%';mate.style.top=(cy+(toaState.remoteTarget.y-cy)*a)+'%';}}
  if(toaState.remoteApmekenTarget&&toaState.room==='apmeken-arena'){const mate=$('toaApmekenTeammate');if(mate){const cx=parseFloat(mate.style.left)||52,cy=parseFloat(mate.style.top)||73,a=Math.min(1,dt/75);mate.style.left=(cx+(toaState.remoteApmekenTarget.x-cx)*a)+'%';mate.style.top=(cy+(toaState.remoteApmekenTarget.y-cy)*a)+'%';}}
  if(toaState.remoteHetTarget&&toaState.room==='het-arena'){const mate=$('toaHetTeammate');if(mate){const cx=parseFloat(mate.style.left)||53,cy=parseFloat(mate.style.top)||76,a=Math.min(1,dt/70);mate.style.left=(cx+(toaState.remoteHetTarget.x-cx)*a)+'%';mate.style.top=(cy+(toaState.remoteHetTarget.y-cy)*a)+'%';}}
  if(!toaState.raidDefeated){toaCheckAcid(t);toaUpdateBloodOrbs(dt,t);toaUpdateKephri(dt);toaUpdateHetBoss(dt,t);if(toaState.mode==='party'&&toaHasCombatAuthority()&&toaState.fightActive&&t-(toaState.lastAuthorityBossSync||0)>120){toaState.lastAuthorityBossSync=t;toaPartySend({type:'boss-state',sender:character?.id,hp:toaState.zebakHp,phase:toaState.phase});}}
  toaState.raf=requestAnimationFrame(toaFrame);
}
$('openToaRaid')?.addEventListener('click',()=>{$('raidsDialog').close();toaResetRaid();$('toaDialog').showModal();toaState.active=false;stopToaLobbyMusic();if(!toaState.raf)toaState.raf=requestAnimationFrame(toaFrame);setTimeout(()=>$('toaSolo')?.focus(),50)});
$('toaSolo')?.addEventListener('click',()=>toaSetMode('solo'));
$('toaCreateParty')?.addEventListener('click',toaCreatePartyRoom);
$('toaJoinParty')?.addEventListener('click',toaJoinPartyRoom);
$('toaCodeInput')?.addEventListener('input',e=>e.target.value=e.target.value.replace(/[^a-z0-9]/gi,'').slice(0,6).toUpperCase());
document.querySelectorAll('[data-toa-prayer]').forEach(b=>b.addEventListener('click',()=>toaSetPrayer(b.dataset.toaPrayer)));
document.querySelectorAll('[data-het-weapon]').forEach(b=>b.addEventListener('click',()=>toaSetHetWeapon(b.dataset.hetWeapon)));
toaRenderFood();
$('toaReadyButton')?.addEventListener('click',()=>{toaState.localReady=!toaState.localReady;toaRenderReady();if(toaState.channel)toaPartySend({type:'ready',ready:toaState.localReady,sender:character?.id});toaTryStartCrondis()});
$('toaReturnNexus')?.addEventListener('click',toaReturnToNexus);
$('toaScarabasReadyButton')?.addEventListener('click',()=>{toaState.localReady=!toaState.localReady;toaRenderScarabasReady();if(toaState.channel)toaPartySend({type:'ready',ready:toaState.localReady,sender:character?.id});toaTryStartScarabas()});
$('toaScarabasReturnNexus')?.addEventListener('click',toaReturnToNexus);
$('toaHetReadyButton')?.addEventListener('click',()=>{toaState.localReady=!toaState.localReady;toaRenderHetReady();if(toaState.channel)toaPartySend({type:'ready-het',ready:toaState.localReady,sender:character?.id});toaTryStartHet()});
$('toaHetReturnNexus')?.addEventListener('click',toaReturnToNexus);
$('toaApmekenReadyButton')?.addEventListener('click',()=>{toaState.localReady=!toaState.localReady;toaRenderApmekenReady();if(toaState.channel)toaPartySend({type:'ready-apmeken',ready:toaState.localReady,sender:character?.id});toaTryStartApmeken()});
$('toaApmekenReturnNexus')?.addEventListener('click',toaReturnToNexus);
$('toaDefeatedQuit')?.addEventListener('click',()=>{toaResetRaid();$('toaDialog')?.close();});
$('toaDialog')?.addEventListener('close',()=>{toaState.active=false;toaState.keys={};stopToaLobbyMusic();stopToaCrondisMusic();stopToaScarabasMusic();stopToaHetMusic();stopToaApmekenMusic();if(toaState.channel)toaPartySend({type:'leave',sender:character?.id});toaCloseChannel();toaResetRaid()});
$('toaChatForm')?.addEventListener('submit',e=>{e.preventDefault();toaSendChat()});
window.addEventListener('keydown',e=>{if(!$('toaDialog')?.open)return;
  if(toaState.chatTyping){if(e.code==='Escape'){e.preventDefault();toaCloseChat()}return}
  if(e.code==='KeyT'&&toaState.room==='nexus'){e.preventDefault();toaOpenChat();return}
  if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)){toaState.keys[e.code]=true;e.preventDefault()}if(e.code==='KeyE'&&toaNearHetHelpfulSpirit()){toaUseHetHelpfulSpirit();e.preventDefault()}else if(e.code==='KeyE'&&toaNearKephriHelpfulSpirit()){toaUseKephriHelpfulSpirit();e.preventDefault()}else if(e.code==='KeyE'&&toaNearHelpfulSpirit()){toaUseHelpfulSpirit();e.preventDefault()}else if(e.code==='KeyE'&&toaNearCrondis()){toaEnterCrondisRoom(false);e.preventDefault()}else if(e.code==='KeyE'&&toaNearScarabas()){toaEnterScarabasRoom(false);e.preventDefault()}else if(e.code==='KeyE'&&toaNearHet()){toaEnterHetRoom(false);e.preventDefault()}else if(e.code==='KeyE'&&toaNearApmeken()){toaEnterApmekenRoom(false);e.preventDefault()}});
window.addEventListener('keyup',e=>{if($('toaDialog')?.open)toaState.keys[e.code]=false});

$('openRuneDle').onclick = openRuneDle;
$('runedleDialog')?.addEventListener('close',()=>{stopRuneDleMusic();stopRuneDleCountdown();});
$('runedleForm').onsubmit = submitRuneDle;
$('runedleRefresh').onclick = loadRuneDleLeaderboard;
$('runedleGuess').addEventListener('input',e=>{e.target.value=e.target.value.replace(/[^a-z]/gi,'').slice(0,5).toUpperCase()});
$('startCooksQuest').onclick = startCooksAssistant;
$('questInteractButton').onclick=questInteract;
$('questInventory').addEventListener('click',e=>{const b=e.target.closest('[data-drop]');if(b)dropQuestItem(b.dataset.drop)});
$('resetCooksQuest').onclick=resetCooksAssistant;
$('closeQuestDialogue').onclick=e=>{e.stopPropagation();cancelQuestDialogue(true)};
$('questDialogue').addEventListener('click',e=>{if(!e.target.closest('#closeQuestDialogue'))advanceQuestDialogue()});
$('closeQuestComplete').onclick=closeQuestCompletion;
window.addEventListener('keydown',e=>{if(!$('questsDialog').open)return;if(e.code==='Space'&&!$('questDialogue').classList.contains('hidden')){e.preventDefault();if(!e.repeat)advanceQuestDialogue();return}if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)&&$('questDialogue').classList.contains('hidden')){qKeys[e.code]=true;e.preventDefault()}if((e.code==='KeyE'||e.code==='Space')&&$('questDialogue').classList.contains('hidden')){questInteract();e.preventDefault()}});
window.addEventListener('keyup',e=>{qKeys[e.code]=false});
$('openLeaderboard').onclick = openLeaderboard;
$('changeCharacter').onclick = async () => {
  playAuthClick();
  $('changeCharacter').disabled = true;
  await logoutAccount();
  $('changeCharacter').disabled = false;
  $('skillsDialog').close();
  toast('Logged out.');
};

$('characterForm').onsubmit = async (event) => {
  event.preventDefault();
  const username = $('username').value.trim();
  const password = $('password').value;
  const errorBox = $('characterError');
  errorBox.textContent = '';

  if (!validUsername(username)) {
    errorBox.textContent = 'Use 3–16 letters, numbers, _ or -. No spaces.';
    return;
  }
  if (password.length < 8) {
    errorBox.textContent = 'Password must be at least 8 characters.';
    return;
  }

  const submit = $('authSubmit');
  playAuthClick();
  submit.disabled = true;
  try {
    if (authMode === 'register') await registerAccount(username, password);
    else await loginAccount(username, password);
    $('characterDialog').close();
    toast(`${authMode === 'register' ? 'Account created' : 'Welcome back'}, ${character.username}!`);
    scheduleSpawn();
  } catch (error) {
    console.error(error);
    const message = error.message || 'Could not continue.';
    if (/invalid login credentials/i.test(message)) errorBox.textContent = 'Incorrect username or password.';
    else if (/already registered|already been registered|user already registered/i.test(message)) errorBox.textContent = 'That username is already taken.';
    else errorBox.textContent = message;
  } finally {
    submit.disabled = false;
  }
};

document.querySelectorAll('[data-close]').forEach(button => {
  button.onclick = () => {
    if (button.dataset.close === 'agilityDialog') { resetAgilityGame(); stopGnomeBall(false); }
    if (button.dataset.close === 'slayerDialog') resetJadSimulator();
    if (button.dataset.close === 'combatDialog') resetCombatGame();
    if (button.dataset.close === 'sailingDialog') resetSailingGame();
    if (button.dataset.close === 'cookingDialog') resetCookingGame();
    if (button.dataset.close === 'runecraftingDialog') leaveRcRoom();
    if (button.dataset.close === 'petWarsDialog') leavePetWar();
    if (button.dataset.close === 'runedleDialog') stopRuneDleMusic();
    if (button.dataset.close === 'questsDialog') {cancelAnimationFrame(questFrame);questFrame=null;Object.keys(qKeys).forEach(k=>delete qKeys[k]);questBusy=false;stopQuestMusic();cancelQuestDialogue(true);}
    $(button.dataset.close).close();
  };
});


window.addEventListener('keydown', event => {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (combatRunning && ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','w','a','s','d'].includes(key)) {
    event.preventDefault(); combatKeys.add(key);
  }
});
window.addEventListener('keyup', event => combatKeys.delete(event.key.length === 1 ? event.key.toLowerCase() : event.key));
document.querySelectorAll('[data-move]').forEach(button => {
  const map={up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight'}; const key=map[button.dataset.move];
  const on=event=>{event.preventDefault();combatKeys.add(key)}; const off=()=>combatKeys.delete(key);
  button.addEventListener('pointerdown',on);button.addEventListener('pointerup',off);button.addEventListener('pointercancel',off);button.addEventListener('pointerleave',off);
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && character && !currentResource) scheduleSpawn();
});

db.channel('counter-live')
  .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'counter', filter: 'id=eq.1' }, payload => {
    count = Number(payload.new.count) || 0;
    render();
  })
  .subscribe();

db.auth.onAuthStateChange((_event, session) => {
  if (!session) {
    character = null;
    renderCharacter();
  }
});

loadCount();
loadCharacter();
loadDailyXpLeaderboard();
setInterval(loadDailyXpLeaderboard, 30000);
keepCoreAdventureButtonsEnabled();
window.addEventListener('load', keepCoreAdventureButtonsEnabled);

window.addEventListener('keydown',e=>{const k=e.key.length===1?e.key.toLowerCase():e.key;if(sailingRunning&&[' ','ArrowUp','w'].includes(k)){e.preventDefault();if(!e.repeat)sailingJump();if(sailingState)sailingState.held=true;}});window.addEventListener('keyup',e=>{const k=e.key.length===1?e.key.toLowerCase():e.key;if([' ','ArrowUp','w'].includes(k))sailingRelease();});const sailCanvas=$('sailingCanvas');sailCanvas.addEventListener('pointerdown',e=>{if(sailingRunning){e.preventDefault();sailingJump();if(sailingState)sailingState.held=true;}});sailCanvas.addEventListener('pointerup',sailingRelease);sailCanvas.addEventListener('pointercancel',sailingRelease);document.querySelectorAll('[data-sail]').forEach(b=>{b.addEventListener('pointerdown',e=>{e.preventDefault();sailingJump();if(sailingState)sailingState.held=true;});b.addEventListener('pointerup',sailingRelease);b.addEventListener('pointercancel',sailingRelease);b.addEventListener('pointerleave',sailingRelease);});

// Homepage character shift: six recognisable characters rotate every 1 minute.
(() => {
  const gamer = document.getElementById('gamer');
  const monitor = document.getElementById('characterMonitor');
  if (!gamer) return;
  const variants = [
    { className: 'character-one', monitorClass: 'monitor-toa', monitorLabel: 'Character 1 playing Tombs of Amascut in Old School RuneScape', label: 'Brown-haired character in a brown jumper smoking a hand-rolled joint while playing Tombs of Amascut' },
    { className: 'character-two', monitorClass: 'monitor-stellaris', monitorLabel: 'Character 2 playing Stellaris', label: 'Pale-skinned character in a white outfit with a green cape holding a Dr Pepper while playing Stellaris' },
    { className: 'character-three', monitorClass: 'monitor-isaac', monitorLabel: 'Character 3 playing The Binding of Isaac', label: 'Pale-skinned purple wizard with a blue wizard hat eating quiche while playing The Binding of Isaac' },
    { className: 'character-four', monitorClass: 'monitor-rdr2', monitorLabel: 'Female RuneScape character playing Red Dead Redemption 2', label: 'Female RuneScape adventurer in a silver helm, grey platebody, red trousers and cape holding a Budweiser while playing Red Dead Redemption 2' },
    { className: 'character-five', monitorClass: 'monitor-tlou', monitorLabel: 'Female RuneScape character playing The Last of Us', label: 'Hooded female RuneScape adventurer in cream, green and black armour holding a vape while playing The Last of Us' },
    { className: 'character-six', monitorClass: 'monitor-dti', monitorLabel: 'Female RuneScape character playing Roblox Dress to Impress', label: 'Orange-haired female RuneScape adventurer in a dusty pink blouse and pale green flared trousers holding a pink energy drink while playing Dress to Impress' }
  ];
  const SHIFT_MS = 60000;
  const WALK_MS = 3200;
  let index = 0;
  let timer;
  let changing = false;
  const nextButton = document.getElementById('nextDeskCharacter');

  function applyCharacter(nextIndex) {
    gamer.classList.remove('character-one','character-two','character-three','character-four','character-five','character-six');
    gamer.classList.add(variants[nextIndex].className);
    gamer.setAttribute('aria-label', variants[nextIndex].label);
    if (monitor) {
      monitor.classList.remove('monitor-toa','monitor-stellaris','monitor-isaac','monitor-rdr2','monitor-tlou','monitor-dti');
      monitor.classList.add(variants[nextIndex].monitorClass);
      monitor.setAttribute('aria-label', variants[nextIndex].monitorLabel);
    }
  }

  function scheduleShift() {
    clearTimeout(timer);
    timer = setTimeout(changeShift, SHIFT_MS);
  }

  function changeShift() {
    if (changing) return;
    changing = true;
    if (nextButton) nextButton.disabled = true;
    clearTimeout(timer);
    gamer.classList.remove('typing','entering');
    gamer.classList.add('leaving');
    setTimeout(() => {
      index = (index + 1) % variants.length;
      applyCharacter(index);
      gamer.classList.remove('leaving');
      // Force animation restart after swapping character.
      void gamer.offsetWidth;
      gamer.classList.add('entering');
      setTimeout(() => {
        gamer.classList.remove('entering');
        gamer.classList.add('typing');
        changing = false;
        if (nextButton) nextButton.disabled = false;
        scheduleShift();
      }, WALK_MS);
    }, WALK_MS);
  }

  applyCharacter(index);
  gamer.classList.add('typing');
  scheduleShift();

  if (nextButton) {
    nextButton.addEventListener('click', changeShift);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearTimeout(timer);
    else scheduleShift();
  });
})();

window.addEventListener('load',()=>{startRoamingPets();startPetRoomChat();});
$('petChatToggle')?.addEventListener('click',()=>setPetChatOpen(!$('petChatPanel')?.classList.contains('is-open')));
$('petChatPanel')?.addEventListener('submit',sendPetRoomChat);
document.addEventListener('pointerdown',event=>{if(!$('petChatPanel')?.classList.contains('is-open'))return;if(event.target.closest('#petChatPanel,#petChatToggle'))return;setPetChatOpen(false);});

$('miningDialog').addEventListener('close',()=>{clearInterval(miningAfkPoll);clearInterval(miningLivePoll);clearInterval(miningChatTimer);miningAfkPoll=miningLivePoll=miningChatTimer=null;});

window.addEventListener('keydown',e=>{if(!cookingRunning)return;const k=e.key.length===1?e.key.toLowerCase():e.key;if(['w','a','s','d'].includes(k)){cookingKeys.add(k);if(cookingNet.role==='guest')sendGuestCookingInput();e.preventDefault();}if(k==='e'&&!e.repeat){if(cookingNet.role==='guest')cookingNet.channel?.send({type:'broadcast',event:'interact',payload:{}});else cookingInteract(1);e.preventDefault();}});window.addEventListener('keyup',e=>{const k=e.key.length===1?e.key.toLowerCase():e.key;cookingKeys.delete(k);if(cookingRunning&&cookingNet.role==='guest')sendGuestCookingInput();});
