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
  hard: { label:'Hard', hits:16, baseSpeed:1450, speedStep:55, xp:240 }
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

function level(v) {
  if (v < 1000) return ['BEGINNER', 'The XP waste has only just begun.'];
  if (v < 5000) return ['BANKSTANDER', 'Useful clicks are becoming increasingly rare.'];
  if (v < 10000) return ['TIME WASTER', 'Serious XP negligence detected.'];
  if (v < 25000) return ['XP SABOTEUR', 'Thousands of efficient ticks have been sacrificed.'];
  if (v < 50000) return ['REPO VETERAN', 'The clan tally has entered legendary territory.'];
  if (v < 100000) return ['WASTE MASTER', 'Efficiency is now only a distant memory.'];
  return ['ETERNAL BANKSTANDER', 'There is no limit. The XP waste continues forever.'];
}

function nextWasteMilestone(v) {
  const milestones = [1000, 5000, 10000, 25000, 50000, 100000];
  const next = milestones.find((milestone) => v < milestone);
  if (!next) return { start: 100000, next: null, progress: 1 };
  const index = milestones.indexOf(next);
  const start = index === 0 ? 0 : milestones[index - 1];
  return { start, next, progress: Math.max(0, Math.min(1, (v - start) / (next - start))) };
}

const MAX_SKILL_XP = 13034431;

function xpForLevel(level) {
  let points = 0;
  for (let i = 1; i < level; i++) points += Math.floor(i + 300 * Math.pow(2, i / 7));
  return Math.floor(points / 4);
}

function levelFromXp(xp) {
  const cappedXp = Math.max(0, Math.min(MAX_SKILL_XP, Number(xp) || 0));
  for (let level = 2; level <= 99; level++) if (cappedXp < xpForLevel(level)) return level - 1;
  return 99;
}

function render() {
  const [name, text] = level(count);
  const milestone = nextWasteMilestone(count);
  $('count').textContent = count.toLocaleString('en-GB');
  $('status').textContent = text;
  $('percent').textContent = milestone.next ? `${milestone.next.toLocaleString('en-GB')} next` : 'NO LIMIT';
  $('fill').style.width = `${milestone.progress * 100}%`;
  $('level').textContent = `WASTE RANK: ${name}`;
  $('gamer').style.setProperty('--fat', '0');
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
  if (error) return showError('The XP click could not be counted. Check Supabase setup.', error);
  count = Number(data) || 0;
  render();
}

async function resetCount() {
  const { data, error } = await db.rpc('reset_counter');
  if (error) return showError('The counter could not be reset.', error);
  count = Number(data) || 0;
  render();
}

function renderCharacter() {
  const hasCharacter = Boolean(character);
  $('createCharacter').classList.toggle('hidden', hasCharacter);
  $('characterSummary').classList.toggle('hidden', !hasCharacter);
  $('openSkills').disabled = !hasCharacter;
  $('openAgility').disabled = !hasCharacter;
  $('openSlayer').disabled = !hasCharacter;
  $('openCombat').disabled = !hasCharacter;
  $('openSailing').disabled = !hasCharacter;
  $('openMining').disabled = false;
  $('openRunecrafting').disabled = !hasCharacter;
  $('openBank').disabled = false;
  $('openGrandExchange').disabled = false;
  $('openPetWars').disabled = false;
  $('openQuests').disabled = false;
  // Keep the Wise Old Man button clickable so it cannot get stuck greyed out.
  $('openWiseTask').disabled = false;
  if (!hasCharacter) {
    $('createCharacter').textContent = 'LOG IN / CREATE ACCOUNT';
    return;
  }

  const total = levelFromXp(character.woodcutting_xp) + levelFromXp(character.mining_xp) + levelFromXp(character.fishing_xp) + levelFromXp(character.agility_xp || 0) + levelFromXp(character.slayer_xp || 0) + levelFromXp(character.attack_xp || 0) + levelFromXp(character.strength_xp || 0) + levelFromXp(character.defence_xp || 0) + levelFromXp(character.sailing_xp || 0) + levelFromXp(character.runecrafting_xp || 0) + levelFromXp(character.cooking_xp || 0);
  $('characterName').textContent = character.username;
  $('totalLevel').textContent = total;
  queueWiseTaskCheck();
  keepCoreAdventureButtonsEnabled();
}

function keepCoreAdventureButtonsEnabled() {
  ['openMining','openQuests'].forEach(id => {
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
  if(character) await loadQuestProfile();
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
  [['Attack','attack','assets/attack-icon.webp'],['Strength','strength','assets/strength-icon.webp'],['Defence','defence','assets/defence-icon.webp']].forEach(([label,key,image]) => {
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
  $('skillsGrid').insertAdjacentHTML('beforeend', `<div class="skill-card cooking"><img src="assets/cooking-icon.svg" alt="Cooking"><div><b>Cooking</b><strong>${cookingLvl}</strong><small>${cookingXp.toLocaleString('en-GB')} XP</small><i><span style="width:${cookingPct}%"></span></i></div></div>`);

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
  jadAttackTimer = null;
  jadResolveTimer = null;
  jadBlocks = 0;
  jadPrayer = null;
  jadAttack = null;
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
  resetJadSimulator('Watch Jad carefully. Switch prayer before the hit lands.');
  jadRunning = true;
  startJadMusic();
  $('jadStart').classList.add('hidden');
  $('jadCue').textContent = 'Jad is preparing...';
  jadAttackTimer = setTimeout(beginJadAttack, 900);
}

function beginJadAttack() {
  if (!jadRunning) return;
  jadAttack = Math.random() < 0.5 ? 'ranged' : 'magic';
  const boss = $('jadBoss');
  boss.className = `jad-boss attacking ${jadAttack}`;
  $('jadProjectile').className = `jad-projectile ${jadAttack}`;
  $('jadCue').textContent = jadAttack === 'ranged' ? 'STOMP — RANGED!' : 'JAD RISES — MAGIC!';
  const cfg = SLAYER_DIFFICULTIES[selectedSlayerDifficulty];
  const speed = Math.max(selectedSlayerDifficulty === 'hard' ? 650 : 900, cfg.baseSpeed - jadBlocks * cfg.speedStep);
  jadResolveTimer = setTimeout(resolveJadAttack, speed);
}

async function resolveJadAttack() {
  if (!jadRunning) return;
  const correct = jadPrayer === jadAttack;
  $('jadProjectile').classList.add('land');
  if (!correct) {
    jadRunning = false;
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
      $('jadMessage').textContent = `Jad defeated! +${result.xp_gained} Slayer XP${newLevel > oldLevel ? ` — Level ${newLevel}!` : ''}`;
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
  sword: { name: 'Rune Sword', icon: '⚔️', description: 'Powerful close-range cleaves', damage: 22, range: 105, attackRate: 0.58, colour: '#fff2a0' },
  bow: { name: 'Maple Bow', icon: '🏹', description: 'Fast attacks from long range', damage: 13, range: 225, attackRate: 0.34, colour: '#d6b16f' },
  staff: { name: 'Air Staff', icon: '🪄', description: 'Slow magic that chains to enemies', damage: 17, range: 170, attackRate: 0.72, colour: '#83d9ff' }
};

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
  $('combatMessage').textContent = `${COMBAT_WEAPONS[type].name} selected. ${cfg.description} to bank Combat XP.`;
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
  $('combatTime').textContent = cfg.duration;
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
  $('combatMessage').textContent = `${names[type]} selected. Choose a weapon and difficulty.`;
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
  $('combatTime').textContent = COMBAT_DIFFICULTIES[selectedCombatDifficulty].duration;
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
    inferno: selectedCombatLocation === 'inferno' ? { wallClock:2.6, walls:[], boss:null } : null
  };
  combatState.difficultyConfig = difficulty;
  if (combatState.inferno) {
    const bossHp={easy:1100,medium:2300,hard:4200,insane:7600}[selectedCombatDifficulty];
    combatState.inferno.boss={type:'inferno-boss',x:620,y:215,hp:bossHp,maxHp:bossHp,speed:0,damage:0,r:46,xp:20,hitCooldown:0};
    combatState.enemies=[combatState.inferno.boss];
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
  const remaining = Math.max(0, s.difficultyConfig.duration - s.elapsed);
  if (remaining <= 0) return finishCombat(s.location !== 'inferno');

  let dx = 0, dy = 0;
  if (combatKeys.has('ArrowLeft') || combatKeys.has('a')) dx--;
  if (combatKeys.has('ArrowRight') || combatKeys.has('d')) dx++;
  if (combatKeys.has('ArrowUp') || combatKeys.has('w')) dy--;
  if (combatKeys.has('ArrowDown') || combatKeys.has('s')) dy++;
  if (dx || dy) {
    const len = Math.hypot(dx, dy); p.x += dx / len * p.speed * dt; p.y += dy / len * p.speed * dt;
    p.x = Math.max(20, Math.min(740, p.x)); p.y = Math.max(24, Math.min(406, p.y));
  }

  if (s.location === 'inferno') updateInfernoWalls(s, p, dt);
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
    } else if (s.weapon === 'bow') {
      damageCombatEnemy(nearest, p.damage);
      s.projectiles.push({x1:p.x,y1:p.y,x2:nearest.x,y2:nearest.y,life:.16,kind:'arrow'});
    } else {
      const chainTargets = [nearest, ...s.enemies.filter(e => e !== nearest).sort((a,b) => Math.hypot(a.x-nearest.x,a.y-nearest.y)-Math.hypot(b.x-nearest.x,b.y-nearest.y)).filter(e => Math.hypot(e.x-nearest.x,e.y-nearest.y)<105).slice(0,2)];
      let from = {x:p.x,y:p.y};
      chainTargets.forEach((target,index) => {
        damageCombatEnemy(target, p.damage * (1-index*0.22));
        s.chains.push({x1:from.x,y1:from.y,x2:target.x,y2:target.y,life:.22});
        from = target;
      });
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
  $('combatTime').textContent = Math.ceil(remaining);
  $('combatHealth').textContent = `${Math.max(0, Math.ceil(p.hp))} / ${p.maxHp}`;
  $('combatKills').textContent = s.location==='inferno' ? `${Math.max(0,Math.ceil(s.inferno.boss?.hp||0))} boss HP` : s.kills;
  $('combatLevel').textContent = s.runLevel;
  $('combatXpFill').style.width = `${Math.min(100, s.runXp / s.nextLevel * 100)}%`;
}

function updateInfernoWalls(s,p,dt){
  const inf=s.inferno;if(!inf)return;
  inf.wallClock-=dt;
  if(inf.wallClock<=0){
    const gapH={easy:150,medium:118,hard:92}[s.difficulty];
    const gapY=70+Math.random()*(430-140);
    const speed={easy:150,medium:190,hard:235}[s.difficulty];
    inf.walls.push({x:790,gapY,gapH,speed,hit:false});
    inf.wallClock={easy:4.8,medium:3.9,hard:3.15}[s.difficulty];
    $('combatMessage').textContent='INFERNO WALL — move into the gap!';
  }
  for(const w of inf.walls){
    w.x-=w.speed*dt;
    if(!w.hit&&Math.abs(w.x-p.x)<18){
      w.hit=true;
      if(Math.abs(p.y-w.gapY)>w.gapH/2-p.r){
        const hit={easy:18,medium:28,hard:40}[s.difficulty];
        p.hp-=Math.max(1,hit-p.armour);s.particles.push({x:p.x,y:p.y,text:`-${hit}`,life:.8});
        $('combatMessage').textContent='The Inferno wall burned you! Find the opening.';
        if(p.hp<=0)return finishCombat(false);
      }else{
        s.runXp+=3;s.particles.push({x:p.x,y:p.y,text:'SAFE!',life:.7});
      }
    }
  }
  inf.walls=inf.walls.filter(w=>w.x>-35);
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
  const {data,error}=await db.rpc('complete_combat_run',{p_survived:survived,p_kills:s.kills,p_damage:Math.floor(s.damage),p_seconds:Math.min(s.difficultyConfig.duration,Math.floor(s.elapsed)),p_difficulty:s.difficulty});
  if(error){console.error(error);$('combatMessage').textContent='Could not save combat XP. Run fix-combat-xp-current.sql in Supabase.';return}
  const r=data?.[0]; if(!r)return;
  character.attack_xp=Number(r.attack_xp);character.strength_xp=Number(r.strength_xp);character.defence_xp=Number(r.defence_xp);
  renderCharacter();
  $('combatMessage').textContent=`${survived?'Victory!':'Run ended.'} +${r.attack_gained} Attack, +${r.strength_gained} Strength, +${r.defence_gained} Defence XP.`;
  toast('Combat XP saved!',3500);
}

function drawCombatBackdrop(ctx,w,h){
  const location=combatState?.location||selectedCombatLocation;
  const palette={lumbridge:['#152416','#183019','#1c351d','#65513a'],'fight-caves':['#28120d','#38160f','#451d11','#8a4b25'],gauntlet:['#24082c','#32103d','#42114d','#b83378'],inferno:['#180705','#2b0b06','#441007','#f05b20']}[location];
  ctx.fillStyle=palette[0];ctx.fillRect(0,0,w,h);
  for(let x=0;x<w;x+=40)for(let y=0;y<h;y+=40){ctx.fillStyle=((x+y)/40)%2?palette[1]:palette[2];ctx.fillRect(x,y,40,40)}
  if(location==='fight-caves'){ctx.fillStyle='#f07b2b55';for(let x=30;x<w;x+=125){ctx.beginPath();ctx.arc(x,h-18,22,0,Math.PI*2);ctx.fill()}}
  if(location==='gauntlet'){ctx.strokeStyle='#f05ab955';ctx.lineWidth=2;for(let x=20;x<w;x+=70){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+30,h);ctx.stroke()}}
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

function openSailingGame(){
  if(!character) return toast('Create or log in to a character first.');
  resetSailingGame('Survive the minute to bank the biggest Sailing XP reward.');
  $('sailingDialog').showModal();
}
function resetSailingGame(message='Ready for another glide.'){
  sailingRunning=false; cancelAnimationFrame(sailingFrame); sailingFrame=null; sailingKeys.clear(); stopSailingMusic(true);
  $('sailingDialog').classList.remove('danger','shake');
  $('sailingIntro').classList.remove('hidden'); $('sailingStart').textContent='START GLIDE';
  $('sailingTime').textContent='60'; $('sailingHull').textContent='1'; $('sailingScore').textContent='0'; $('sailingCombo').textContent='x1'; $('sailingMessage').textContent=message;
  const c=$('sailingCanvas'); sailingState=null; drawSailingBackdrop(c.getContext('2d'),c.width,c.height,0);
}
function startSailingGame(){
  const c=$('sailingCanvas');
  sailingState={boat:{x:150,y:330,vy:0,grounded:true,rotation:0},objects:[],particles:[],score:0,combo:1,gates:0,elapsed:0,distance:0,speed:300,spawnDistance:470,nextMilestone:10,held:false};
  sailingRunning=true;sailingStartedAt=performance.now();sailingLast=sailingStartedAt;
  $('sailingIntro').classList.add('hidden');$('sailingMessage').textContent='SPACE / CLICK to jump. Stay alive!';playSailingMusic();
  sailingFrame=requestAnimationFrame(sailingLoop);
}
function sailingJump(){
  if(!sailingRunning||!sailingState)return;
  const b=sailingState.boat;
  if(b.grounded){b.vy=-585;b.grounded=false;sailingState.held=true;burstWake(b.x-18,b.y+14,9);}
}
function sailingRelease(){if(sailingState)sailingState.held=false;}
function burstWake(x,y,count){const s=sailingState;if(!s)return;for(let i=0;i<count;i++)s.particles.push({x,y,vx:-70-Math.random()*120,vy:-30+Math.random()*75,life:.35+Math.random()*.3,size:2+Math.random()*4});}
function sailingLoop(now){if(!sailingRunning)return;const dt=Math.min(.033,(now-sailingLast)/1000||0);sailingLast=now;updateSailing(dt,now);drawSailing();if(sailingRunning)sailingFrame=requestAnimationFrame(sailingLoop)}
function updateSailing(dt,now){
 const s=sailingState,b=s.boat,c=$('sailingCanvas');s.elapsed=(now-sailingStartedAt)/1000;s.speed=Math.min(570,300+s.elapsed*4.5);s.distance+=s.speed*dt;
 if(s.held&&b.vy<0)b.vy-=360*dt;
 b.vy+=1450*dt;b.y+=b.vy*dt;const waterY=338;
 if(b.y>=waterY){if(!b.grounded&&b.vy>230){s.combo=Math.min(12,s.combo+1);s.score+=35*s.combo;burstWake(b.x,b.y+16,12);}b.y=waterY;b.vy=0;b.grounded=true;b.rotation*=.65;}else{b.grounded=false;b.rotation=Math.max(-.35,Math.min(.55,b.vy/900));}
 s.spawnDistance-=s.speed*dt;if(s.spawnDistance<=0){spawnSailingPattern();s.spawnDistance=(340+Math.random()*190)*Math.max(.68,1-s.elapsed/155);}
 for(const o of s.objects){o.x-=s.speed*dt*(o.speed||1);if(o.type==='bob')o.y=o.baseY+Math.sin(s.elapsed*5+o.phase)*9;}
 for(const o of s.objects){if(o.hit)continue;
   if(o.type==='ring'){const dx=o.x-b.x,dy=o.y-b.y;if(dx*dx+dy*dy<34*34){o.hit=true;s.gates++;s.combo=Math.min(12,s.combo+1);s.score+=120*s.combo;burstWake(o.x,o.y,14);$('sailingMessage').textContent=`Golden ring! Combo x${s.combo}`;}continue;}
   // Forgiving collision boxes: the visible sprites can brush past each other
   // without counting as a crash. This keeps the course hard, but learnable.
   const bw=17,bh=12;
   let ow=o.w*.68, oh=o.h*.68, oy=o.y;
   if(o.type==='spikes'){ow=o.w*.78;oh=o.h*.48;oy=o.y+5;}
   else if(o.type==='wreck'){ow=o.w*.62;oh=o.h*.68;oy=o.y+4;}
   else if(o.type==='barrel'){ow=o.w*.60;oh=o.h*.72;oy=o.y+3;}
   else if(o.type==='rock'){ow=o.w*.68;oh=o.h*.66;oy=o.y+3;}
   if(o.type==='mine'){
     const dx=b.x-o.x,dy=b.y-o.y;
     if(dx*dx+dy*dy<27*27)return crashSailing();
   }else if(b.x+bw>o.x-ow/2&&b.x-bw<o.x+ow/2&&b.y+bh>oy-oh/2&&b.y-bh<oy+oh/2){return crashSailing();}
   if(!o.cleared&&o.x+o.w/2<b.x-28){o.cleared=true;s.combo=Math.min(12,s.combo+1);s.score+=55*s.combo;if(s.combo>=6)$('sailingMessage').textContent=`Clean jump! Combo x${s.combo}`;}
 }
 s.objects=s.objects.filter(o=>o.x>-120&&!o.hit);
 s.particles.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=180*dt;p.life-=dt});s.particles=s.particles.filter(p=>p.life>0);
 s.score+=dt*(12+s.combo*2);
 const remain=Math.max(0,60-s.elapsed);$('sailingTime').textContent=Math.ceil(remain);$('sailingHull').textContent='1';$('sailingScore').textContent=Math.floor(s.score).toLocaleString('en-GB');$('sailingCombo').textContent='x'+s.combo;
 $('sailingDialog').classList.toggle('danger',remain<=10);
 if(remain<=0)endSailing(true);
}
function spawnSailingPattern(){
 const s=sailingState,c=$('sailingCanvas'),x=c.width+70,r=Math.random();
 if(r<.22){s.objects.push({type:'rock',x,y:324,w:48,h:48});s.objects.push({type:'ring',x:x+2,y:245,w:24,h:24});}
 else if(r<.42){s.objects.push({type:'spikes',x,y:329,w:76,h:32});s.objects.push({type:'ring',x:x+10,y:260,w:24,h:24});}
 else if(r<.58){s.objects.push({type:'wreck',x,y:309,w:76,h:74});s.objects.push({type:'ring',x:x+7,y:215,w:24,h:24});}
 else if(r<.72){s.objects.push({type:'barrel',x,y:318,w:42,h:58});s.objects.push({type:'barrel',x:x+92,y:318,w:42,h:58});s.objects.push({type:'ring',x:x+46,y:230,w:24,h:24});}
 else if(r<.86){s.objects.push({type:'mine',x,y:255,w:42,h:42,baseY:255,phase:Math.random()*6});s.objects.push({type:'ring',x:x+75,y:295,w:24,h:24});}
 else{s.objects.push({type:'rock',x,y:324,w:48,h:48});s.objects.push({type:'spikes',x:x+120,y:329,w:70,h:32});s.objects.push({type:'ring',x:x+58,y:215,w:24,h:24});}
}
function crashSailing(){
 if(!sailingRunning)return;sailingState.combo=1;$('sailingDialog').classList.add('shake');burstWake(sailingState.boat.x,sailingState.boat.y,30);endSailing(false);
}
async function endSailing(survived){
 if(!sailingRunning)return;sailingRunning=false;cancelAnimationFrame(sailingFrame);stopSailingMusic(false);const s=sailingState;$('sailingDialog').classList.remove('danger');
 $('sailingIntro').classList.remove('hidden');$('sailingStart').textContent='GLIDE AGAIN';$('sailingMessage').textContent=survived?'Course complete! Saving Sailing XP…':'CRASHED! Saving partial Sailing XP…';
 const {data,error}=await db.rpc('complete_sailing_run',{p_survived:survived,p_score:Math.floor(s.score),p_gates:s.gates,p_seconds:Math.min(s.difficultyConfig.duration,Math.floor(s.elapsed))});
 if(error){console.error(error);$('sailingMessage').textContent='Could not save Sailing XP. Run update-sailing-minigame.sql in Supabase.';return}
 const r=data?.[0];if(!r)return;character.sailing_xp=Number(r.sailing_xp);renderCharacter();$('sailingMessage').textContent=`${survived?'High Seas complete!':'You crashed.'} +${r.sailing_gained} Sailing XP. Score ${Math.floor(s.score).toLocaleString('en-GB')}.`;toast('Sailing XP saved!',3200);
}
function drawSailingBackdrop(ctx,w,h,scroll){
 const shift=scroll%w;ctx.fillStyle='#071821';ctx.fillRect(0,0,w,h);
 ctx.fillStyle='#112c3b';for(let i=-1;i<4;i++){const x=i*280-(shift*.12%280);ctx.beginPath();ctx.moveTo(x,h*.53);ctx.lineTo(x+90,h*.25);ctx.lineTo(x+180,h*.53);ctx.fill();}
 ctx.fillStyle='#0b3b51';ctx.fillRect(0,300,w,h-300);ctx.strokeStyle='#2c7189';ctx.lineWidth=3;for(let y=306;y<h;y+=28){ctx.beginPath();for(let x=-30;x<=w+30;x+=24)ctx.lineTo(x,y+Math.sin((x+scroll)*.035+y)*5);ctx.stroke();}
 ctx.fillStyle='#123a30';ctx.fillRect(0,368,w,62);ctx.fillStyle='#245842';for(let x=-(scroll*.45%58);x<w;x+=58)ctx.fillRect(x,378,32,8);
}
function drawSailing(){
 const c=$('sailingCanvas'),ctx=c.getContext('2d'),s=sailingState;drawSailingBackdrop(ctx,c.width,c.height,s?s.distance:0);if(!s)return;
 ctx.fillStyle='#d6f5ff';s.particles.forEach(p=>{ctx.globalAlpha=Math.max(0,p.life*2);ctx.fillRect(p.x,p.y,p.size,p.size)});ctx.globalAlpha=1;
 s.objects.forEach(o=>drawSailingObject(ctx,o));drawBoat(ctx,s.boat);
 const progress=Math.min(1,s.elapsed/60);ctx.fillStyle='#071015cc';ctx.fillRect(18,16,c.width-36,10);ctx.fillStyle='#7dd7f3';ctx.fillRect(18,16,(c.width-36)*progress,10);ctx.strokeStyle='#c6effc';ctx.strokeRect(18,16,c.width-36,10);
}
function drawSailingObject(ctx,o){
 ctx.save();ctx.translate(o.x,o.y);
 if(o.type==='ring'){ctx.strokeStyle='#ffd65a';ctx.lineWidth=7;ctx.beginPath();ctx.arc(0,0,15,0,Math.PI*2);ctx.stroke();ctx.strokeStyle='#fff1a0';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,9,0,Math.PI*2);ctx.stroke();}
 else if(o.type==='rock'){ctx.fillStyle='#555e62';ctx.beginPath();ctx.moveTo(-24,24);ctx.lineTo(-18,-5);ctx.lineTo(-5,-24);ctx.lineTo(19,-13);ctx.lineTo(24,24);ctx.closePath();ctx.fill();ctx.fillStyle='#818a87';ctx.fillRect(-10,-12,9,7);}
 else if(o.type==='spikes'){ctx.fillStyle='#9bb0b5';for(let x=-o.w/2;x<o.w/2;x+=19){ctx.beginPath();ctx.moveTo(x,16);ctx.lineTo(x+9,-16);ctx.lineTo(x+18,16);ctx.fill();}}
 else if(o.type==='wreck'){ctx.fillStyle='#56371f';ctx.fillRect(-38,-8,76,40);ctx.fillStyle='#81552d';ctx.fillRect(-29,-33,7,50);ctx.fillRect(9,-45,7,63);ctx.strokeStyle='#c1a475';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-26,-29);ctx.lineTo(13,-41);ctx.lineTo(31,-5);ctx.stroke();}
 else if(o.type==='barrel'){ctx.fillStyle='#77502c';ctx.fillRect(-21,-29,42,58);ctx.strokeStyle='#c09658';ctx.lineWidth=4;ctx.strokeRect(-19,-25,38,50);ctx.beginPath();ctx.moveTo(-19,-9);ctx.lineTo(19,-9);ctx.moveTo(-19,10);ctx.lineTo(19,10);ctx.stroke();}
 else if(o.type==='mine'){ctx.fillStyle='#25292d';ctx.beginPath();ctx.arc(0,0,18,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#8e9ca0';ctx.lineWidth=4;for(let a=0;a<Math.PI*2;a+=Math.PI/4){ctx.beginPath();ctx.moveTo(Math.cos(a)*15,Math.sin(a)*15);ctx.lineTo(Math.cos(a)*25,Math.sin(a)*25);ctx.stroke();}ctx.fillStyle='#bd323a';ctx.fillRect(-4,-4,8,8);}
 ctx.restore();
}
function drawBoat(ctx,b){
 ctx.save();ctx.translate(b.x,b.y);ctx.rotate(b.rotation);ctx.fillStyle='#6f421f';ctx.beginPath();ctx.moveTo(-31,4);ctx.lineTo(31,4);ctx.lineTo(20,25);ctx.lineTo(-20,25);ctx.closePath();ctx.fill();ctx.fillStyle='#a46a34';ctx.fillRect(-22,2,44,7);ctx.fillStyle='#d8c28d';ctx.fillRect(-2,-34,5,39);ctx.fillStyle='#ece3c4';ctx.beginPath();ctx.moveTo(3,-31);ctx.lineTo(3,-3);ctx.lineTo(29,-6);ctx.closePath();ctx.fill();ctx.fillStyle='#ba2730';ctx.beginPath();ctx.moveTo(-3,-28);ctx.lineTo(-3,-5);ctx.lineTo(-22,-8);ctx.closePath();ctx.fill();ctx.fillStyle='#ead9b2';ctx.fillRect(-7,-4,14,10);ctx.restore();
}

function drawCombat(){
  const c=$('combatCanvas'),ctx=c.getContext('2d'),s=combatState;
  drawCombatBackdrop(ctx,c.width,c.height);
  if(!s)return;
  if(s.inferno){for(const w of s.inferno.walls){ctx.fillStyle='rgba(255,77,12,.88)';ctx.fillRect(w.x-12,0,24,w.gapY-w.gapH/2);ctx.fillRect(w.x-12,w.gapY+w.gapH/2,24,430-(w.gapY+w.gapH/2));ctx.fillStyle='#ffd052';for(let y=8;y<430;y+=28){if(Math.abs(y-w.gapY)<w.gapH/2)continue;ctx.beginPath();ctx.moveTo(w.x-18,y+12);ctx.lineTo(w.x,y-10);ctx.lineTo(w.x+18,y+12);ctx.fill();}}}
  s.orbs.forEach(o=>{ctx.fillStyle=o.heal?'#72e08d':'#74d7ff';ctx.beginPath();ctx.arc(o.x,o.y,o.heal?8:6,0,7);ctx.fill();if(o.heal){ctx.fillStyle='#fff';ctx.fillRect(o.x-2,o.y-5,4,10);ctx.fillRect(o.x-5,o.y-2,10,4)}});
  s.enemies.forEach(e=>drawCombatEnemy(ctx,e));
  drawCombatPlayer(ctx,s.player,s.weapon);
  s.slashes.forEach(a=>{ctx.strokeStyle='#fff2a0';ctx.lineWidth=6;ctx.beginPath();ctx.arc(a.x,a.y,28,-1.35,.75);ctx.stroke()});
  s.projectiles.forEach(a=>{ctx.strokeStyle='#d6b16f';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(a.x1,a.y1);ctx.lineTo(a.x2,a.y2);ctx.stroke();ctx.fillStyle='#eee4bd';ctx.beginPath();ctx.arc(a.x2,a.y2,3,0,7);ctx.fill()});
  s.chains.forEach(a=>{ctx.strokeStyle='#83d9ff';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(a.x1,a.y1);ctx.lineTo((a.x1+a.x2)/2+5,a.y1+(a.y2-a.y1)*.45);ctx.lineTo(a.x2,a.y2);ctx.stroke()});
  s.particles.forEach(p=>{ctx.fillStyle='#fff0a4';ctx.font='bold 14px Arial';ctx.fillText(p.text,p.x,p.y)})
}
function drawCombatPlayer(ctx,p,weapon){
  ctx.save();ctx.translate(p.x,p.y);
  ctx.fillStyle='#9a6b3d';ctx.fillRect(-9,-18,18,10);
  ctx.fillStyle='#d0a179';ctx.fillRect(-7,-10,14,12);
  ctx.fillStyle='#506f9b';ctx.fillRect(-10,2,20,19);
  if(weapon==='bow'){
    ctx.strokeStyle='#9d713f';ctx.lineWidth=3;ctx.beginPath();ctx.arc(17,3,14,-1.25,1.25);ctx.stroke();ctx.strokeStyle='#ddd2ad';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(21,-10);ctx.lineTo(21,16);ctx.stroke();
  }else if(weapon==='staff'){
    ctx.strokeStyle='#80633c';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(9,15);ctx.lineTo(27,-13);ctx.stroke();ctx.fillStyle='#83d9ff';ctx.beginPath();ctx.arc(28,-15,5,0,7);ctx.fill();
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
  else if(e.type==='inferno-boss'){ctx.fillStyle='#40100a';ctx.beginPath();ctx.arc(0,2,43,0,7);ctx.fill();ctx.strokeStyle='#ff6a20';ctx.lineWidth=8;for(let a=0;a<8;a++){const q=a*Math.PI/4;ctx.beginPath();ctx.moveTo(Math.cos(q)*34,Math.sin(q)*34);ctx.lineTo(Math.cos(q)*56,Math.sin(q)*56);ctx.stroke()}ctx.fillStyle='#ffd33d';ctx.beginPath();ctx.arc(-14,-8,7,0,7);ctx.arc(14,-8,7,0,7);ctx.fill();ctx.fillStyle='#ff310f';ctx.fillRect(-18,13,36,8)}
  else {ctx.fillStyle='#441047';ctx.beginPath();ctx.arc(0,0,27,0,7);ctx.fill();ctx.strokeStyle='#ff5fbf';ctx.lineWidth=5;for(let a=0;a<6;a++){const q=a*Math.PI/3;ctx.beginPath();ctx.moveTo(Math.cos(q)*20,Math.sin(q)*20);ctx.lineTo(Math.cos(q)*34,Math.sin(q)*34);ctx.stroke()}ctx.fillStyle='#f6a1db';ctx.fillRect(-12,-6,8,6);ctx.fillRect(4,-6,8,6)}
  ctx.fillStyle='#360b0b';ctx.fillRect(-14,-e.r-8,28,4);ctx.fillStyle='#b52b35';ctx.fillRect(-14,-e.r-8,28*Math.max(0,e.hp/e.maxHp),4);ctx.restore()
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
  'If Slayer got removed, half this clan would finally see daylight.',
  'Do you think Trump would train Mining or just buy the star?',
  'Someone said ladyboys are a random event. I think they need to log off.',
  'I brought a dragon pickaxe. It is made of cardboard.',
  'Seven minutes is basically tick-perfect AFK.',
  'The star told me to buy more bank space.',
  'I have been mining this for ten minutes and learned nothing.',
  'Pet Wars is fixed. Probably. Do not quote me.',
  'Imagine getting 99 Mining and still being unemployed.',
  'They should remove Slayer and replace it with Quiche-making.'
];
function formatMiningTime(seconds){seconds=Math.max(0,Math.ceil(Number(seconds)||0));if(!seconds)return 'READY';return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`}
function setMiningChats(){clearInterval(miningChatTimer);const bubbles=[...document.querySelectorAll('.fake-bubble')];const rotate=()=>{bubbles.forEach((b,i)=>{b.textContent=MINING_CHAT[(Math.floor(Math.random()*MINING_CHAT.length)+i)%MINING_CHAT.length];b.classList.remove('pop');void b.offsetWidth;b.classList.add('pop')})};rotate();miningChatTimer=setInterval(rotate,8500)}
function renderMiningState(){
  if(!miningAfkState)return;
  const petId=miningAfkState.active_pet,meta=PET_CATALOG[petId];
  $('miningLocked').classList.toggle('hidden',Boolean(petId));$('miningGame').classList.toggle('hidden',!petId);
  if(!petId)return;
  const petName=miningAfkState.pet_name||meta?.name||'Your pet';
  $('miningPet').querySelector('.mining-pet-visual').innerHTML=petMarkup(petId,petName,'star-pet-art');$('miningPet').dataset.petId=petId;$('miningPet').querySelector('.mining-pet-label').textContent=petName;
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
async function refreshLiveStarMiners(){if(!$('liveStarMiners'))return;const{data,error}=await db.rpc('get_active_star_miners');if(error)return;const own=character?.username||'';const miners=(data||[]).filter(m=>m.username!==own);$('liveStarMiners').innerHTML=miners.map((m,i)=>{const meta=PET_CATALOG[m.active_pet]||PET_CATALOG.pet_free_cat;return `<div class="live-star-miner miner-${i%6}" data-pet-id="${escapeHtml(m.active_pet)}"><span>${escapeHtml(m.pet_name||meta.name)}<small>${escapeHtml(m.username)}</small></span>${petMarkup(m.active_pet,m.pet_name||meta.name,'star-pet-art')}<b class="live-pickaxe"><img src="assets/mining-icon.png" alt=""></b></div>`}).join('')}
async function openMining(){if(!character){openAuth('login');return}$('miningDialog').showModal();await refreshMiningState();await refreshLiveStarMiners();setMiningChats();clearInterval(miningAfkPoll);clearInterval(miningLivePoll);miningAfkPoll=setInterval(()=>refreshMiningState(true),5000);miningLivePoll=setInterval(refreshLiveStarMiners,4000)}
async function strikeShootingStar(){if(!character)return;const btn=$('mineStarButton');btn.disabled=true;const{data,error}=await db.rpc('mine_shooting_star');if(error){toast(error.message||'The star cannot be mined yet.');await refreshMiningState(true);return}miningAfkState=data?.[0]||null;if(miningAfkState){character.mining_xp=Number(miningAfkState.mining_xp)||0;character.gp=Number(miningAfkState.gp)||0}$('shootingStar').classList.remove('struck','degraded');void $('shootingStar').offsetWidth;$('shootingStar').classList.add('struck');renderMiningState();renderCharacter();refreshLiveStarMiners();toast('Seven-minute mining cycle started: 1,500 Mining XP and 2,500 GP will be earned gradually.',5000)}
function stopShootingStar(){
  clearInterval(miningAfkPoll); miningAfkPoll=null;
  clearInterval(miningLivePoll); miningLivePoll=null;
  clearInterval(miningChatTimer); miningChatTimer=null;
  const dialog=$('miningDialog');
  if(dialog?.open) dialog.close();
  toast('You left the star. Your pet keeps mining and you can return at any time.');
}

const PET_CATALOG = {"pet_free_cat":{"name":"Repo cat","source":"Free starter pet","price":0,"image":"assets/pets/free_cat.svg"},"pet_abyssal_orphan":{"name":"Abyssal orphan","source":"Abyssal Sire","price":55000,"image":"assets/pets/abyssal_orphan.png"},"pet_baby_mole":{"name":"Baby mole","source":"Giant Mole","price":30000,"image":"assets/pets/baby_mole.png"},"pet_baron":{"name":"Baron","source":"Duke Sucellus","price":90000,"image":"assets/pets/baron.png"},"pet_bran":{"name":"Bran","source":"Royal Titans","price":85000,"image":"assets/pets/bran.png"},"pet_beef":{"name":"Beef","source":"Brutus","price":65000,"image":"assets/pets/beef.png"},"pet_butch":{"name":"Butch","source":"Vardorvis","price":95000,"image":"assets/pets/butch.png"},"pet_callisto_cub":{"name":"Callisto cub","source":"Callisto and Artio","price":70000,"image":"assets/pets/callisto_cub.png"},"pet_dom":{"name":"Dom","source":"Doom of Mokhaiotl","price":90000,"image":"assets/pets/dom.png"},"pet_gull":{"name":"Gull","source":"Shellbane Gryphon","price":60000,"image":"assets/pets/gull.png"},"pet_hellpuppy":{"name":"Hellpuppy","source":"Cerberus","price":70000,"image":"assets/pets/hellpuppy.png"},"pet_huberte":{"name":"Huberte","source":"The Hueycoatl","price":65000,"image":"assets/pets/huberte.png"},"pet_ikkle_hydra":{"name":"Ikkle hydra","source":"Alchemical Hydra","price":85000,"image":"assets/pets/ikkle_hydra.png"},"pet_jal_nib_rek":{"name":"Jal-nib-rek","source":"Inferno","price":250000,"image":"assets/pets/jal_nib_rek.png"},"pet_kalphite_princess":{"name":"Kalphite princess","source":"Kalphite Queen","price":55000,"image":"assets/pets/kalphite_princess.png"},"pet_lil_zik":{"name":"Lil' zik","source":"Theatre of Blood","price":175000,"image":"assets/pets/lil_zik.png"},"pet_lilviathan":{"name":"Lil'viathan","source":"The Leviathan","price":95000,"image":"assets/pets/lilviathan.png"},"pet_little_nightmare":{"name":"Little nightmare","source":"The Nightmare and Phosani's Nightmare","price":100000,"image":"assets/pets/little_nightmare.png"},"pet_maggot_marquess":{"name":"Maggot marquess","source":"Maggot King","price":65000,"image":"assets/pets/maggot_marquess.png"},"pet_moxi":{"name":"Moxi","source":"Amoxliatl","price":60000,"image":"assets/pets/moxi.png"},"pet_muphin":{"name":"Muphin","source":"Phantom Muspah","price":75000,"image":"assets/pets/muphin.png"},"pet_nexling":{"name":"Nexling","source":"Nex","price":160000,"image":"assets/pets/nexling.png"},"pet_nid":{"name":"Nid","source":"Araxxor","price":85000,"image":"assets/pets/nid.png"},"pet_noon":{"name":"Noon","source":"Grotesque Guardians","price":55000,"image":"assets/pets/noon.png"},"pet_olmlet":{"name":"Olmlet","source":"Chambers of Xeric","price":150000,"image":"assets/pets/olmlet.png"},"pet_pet_chaos_elemental":{"name":"Pet chaos elemental","source":"Chaos Elemental and Chaos Fanatic","price":40000,"image":"assets/pets/pet_chaos_elemental.png"},"pet_pet_dagannoth_prime":{"name":"Pet dagannoth prime","source":"Dagannoth Prime","price":45000,"image":"assets/pets/pet_dagannoth_prime.png"},"pet_pet_dagannoth_rex":{"name":"Pet dagannoth rex","source":"Dagannoth Rex","price":45000,"image":"assets/pets/pet_dagannoth_rex.png"},"pet_pet_dagannoth_supreme":{"name":"Pet dagannoth supreme","source":"Dagannoth Supreme","price":45000,"image":"assets/pets/pet_dagannoth_supreme.png"},"pet_pet_dark_core":{"name":"Pet dark core","source":"Corporeal Beast","price":100000,"image":"assets/pets/pet_dark_core.png"},"pet_pet_general_graardor":{"name":"Pet general graardor","source":"General Graardor","price":80000,"image":"assets/pets/pet_general_graardor.png"},"pet_pet_kril_tsutsaroth":{"name":"Pet k'ril tsutsaroth","source":"K'ril Tsutsaroth","price":80000,"image":"assets/pets/pet_kril_tsutsaroth.png"},"pet_pet_kraken":{"name":"Pet kraken","source":"Kraken","price":45000,"image":"assets/pets/pet_kraken.png"},"pet_pet_kreearra":{"name":"Pet kree'arra","source":"Kree'arra","price":80000,"image":"assets/pets/pet_kreearra.png"},"pet_pet_smoke_devil":{"name":"Pet smoke devil","source":"Thermonuclear smoke devil","price":50000,"image":"assets/pets/pet_smoke_devil.png"},"pet_pet_snakeling":{"name":"Pet snakeling","source":"Zulrah","price":65000,"image":"assets/pets/pet_snakeling.png"},"pet_pet_zilyana":{"name":"Pet zilyana","source":"Commander Zilyana","price":80000,"image":"assets/pets/pet_zilyana.png"},"pet_phoenix":{"name":"Phoenix","source":"Wintertodt","price":35000,"image":"assets/pets/phoenix.png"},"pet_prince_black_dragon":{"name":"Prince black dragon","source":"King Black Dragon","price":55000,"image":"assets/pets/prince_black_dragon.png"},"pet_scorpias_offspring":{"name":"Scorpia's offspring","source":"Scorpia","price":40000,"image":"assets/pets/scorpias_offspring.png"},"pet_scurry":{"name":"Scurry","source":"Scurrius","price":30000,"image":"assets/pets/scurry.png"},"pet_skotos":{"name":"Skotos","source":"Skotizo","price":50000,"image":"assets/pets/skotos.png"},"pet_smolcano":{"name":"Smolcano","source":"Zalcano","price":45000,"image":"assets/pets/smolcano.png"},"pet_smol_heredit":{"name":"Smol heredit","source":"Sol Heredit","price":90000,"image":"assets/pets/smol_heredit.png"},"pet_saracha":{"name":"Sraracha","source":"Sarachnis","price":40000,"image":"assets/pets/saracha.png"},"pet_tiny_tempor":{"name":"Tiny tempor","source":"Tempoross","price":35000,"image":"assets/pets/tiny_tempor.png"},"pet_tumekens_guardian":{"name":"Tumeken's guardian","source":"Tombs of Amascut","price":150000,"image":"assets/pets/tumekens_guardian.png"},"pet_tzrek_jad":{"name":"Tzrek-jad","source":"TzHaar Fight Cave","price":120000,"image":"assets/pets/tzrek_jad.png"},"pet_venenatis_spiderling":{"name":"Venenatis spiderling","source":"Venenatis and Spindel","price":70000,"image":"assets/pets/venenatis_spiderling.png"},"pet_vetion_jr":{"name":"Vet'ion jr.","source":"Vet'ion and Calvar'ion","price":70000,"image":"assets/pets/vetion_jr.png"},"pet_vorki":{"name":"Vorki","source":"Vorkath","price":75000,"image":"assets/pets/vorki.png"},"pet_wisp":{"name":"Wisp","source":"The Whisperer","price":95000,"image":"assets/pets/wisp.png"},"pet_yami":{"name":"Yami","source":"Yama","price":100000,"image":"assets/pets/yami.png"},"pet_youngllef":{"name":"Youngllef","source":"The Gauntlet","price":110000,"image":"assets/pets/youngllef.png"}};

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
function petMarkup(id,alt='',extraClass=''){
  const meta=PET_CATALOG[id]||PET_CATALOG.pet_free_cat;
  const view=getPetPresentation(id);
  return `<span class="pet-visual ${extraClass}" data-pet-id="${escapeHtml(id)}" data-pet-ground="${view.ground}" data-pet-personality="${view.personality}" style="--pet-scale:${view.scale}"><img src="${meta.image}" alt="${escapeHtml(alt||meta.name)}"></span>`;
}
let activePetState=null;
let petNamesState={};
let roamingPetTimer=null;

let bankState = null;

function renderBank(){
  const gp=Number(bankState?.gp||0);
  $('bankGp').textContent=`${gp.toLocaleString('en-GB')} GP`;
  const items=bankState?.items&&typeof bankState.items==='object'?bankState.items:{};
  const entries=Object.entries(items).filter(([,qty])=>Number(qty)>0);
  const activeMeta=activePetState&&PET_CATALOG[activePetState];
  const activeDisplayName=activePetState?(petNamesState[activePetState]||activeMeta?.name):null;
  $('bankActivePet').innerHTML=activeMeta?`${petMarkup(activePetState,activeDisplayName,'pet-bank-mini')} ${escapeHtml(activeDisplayName)}`:'No pet out';
  $('bankPutPetAway').disabled=!activePetState;
  if(!entries.length){
    $('bankItems').innerHTML=Array.from({length:20},(_,i)=>`<div class="bank-slot empty"><span>${i===0?'EMPTY BANK':'—'}</span></div>`).join('');
    $('bankMessage').textContent='Your bank is ready. Purchased pets will appear here.';
    return;
  }
  const slots=entries.map(([id,qty])=>{
    const pet=PET_CATALOG[id];
    if(pet){const customName=petNamesState[id]||'';return `<div class="bank-slot pet-bank-slot ${activePetState===id?'active-pet':''}" data-pet-id="${escapeHtml(id)}">${petMarkup(id,customName||pet.name,'pet-bank-art')}<b>${escapeHtml(customName||pet.name)}</b><small>${escapeHtml(pet.source)}</small><div class="pet-name-row"><input class="pet-name-input" data-pet-id="${escapeHtml(id)}" maxlength="20" value="${escapeHtml(customName)}" placeholder="Name your pet"><button type="button" class="pet-name-save" data-pet-id="${escapeHtml(id)}">SAVE</button></div><button type="button" class="bank-pet-toggle" data-pet-id="${escapeHtml(id)}">${activePetState===id?'PUT AWAY':'LET OUT'}</button></div>`;}
    return `<div class="bank-slot"><div class="bank-placeholder">?</div><b>${String(id).replaceAll('_',' ')}</b><strong>${Number(qty).toLocaleString('en-GB')}</strong></div>`;
  });
  while(slots.length<20)slots.push('<div class="bank-slot empty"><span>—</span></div>');
  $('bankItems').innerHTML=slots.join('');
  $('bankItems').querySelectorAll('.bank-pet-toggle').forEach(b=>b.addEventListener('click',()=>setMyActivePet(activePetState===b.dataset.petId?null:b.dataset.petId)));
  $('bankItems').querySelectorAll('.pet-name-save').forEach(b=>b.addEventListener('click',()=>savePetName(b.dataset.petId)));
  $('bankItems').querySelectorAll('.pet-name-input').forEach(input=>input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();savePetName(input.dataset.petId)}}));
  $('bankMessage').textContent=`${entries.length} item type${entries.length===1?'':'s'} stored.`;
}

async function openBank(){
  if(!character){
    toast('Log in or create an account to open your bank.');
    openCharacterDialog('login');
    return;
  }
  bankState=null;
  $('bankGp').textContent='Loading…';
  $('bankItems').innerHTML='';
  $('bankMessage').textContent='Opening your bank…';
  $('bankDialog').showModal();
  const {data,error}=await db.rpc('get_my_bank');
  if(error){
    console.error(error);
    $('bankMessage').textContent='Could not open the bank. Run update-bank.sql in Supabase.';
    return;
  }
  bankState=data?.[0]||{gp:0,items:{}};
  const petResult=await db.rpc('get_my_active_pet');
  activePetState=petResult.error?null:(petResult.data?.[0]?.active_pet||null);
  petNamesState=petResult.error?{}:(petResult.data?.[0]?.pet_names||{});
  renderBank();
}

async function savePetName(petId){
  const input=$('bankItems').querySelector(`.pet-name-input[data-pet-id="${CSS.escape(petId)}"]`);
  const name=(input?.value||'').trim();
  if(!name){$('bankMessage').textContent='Enter a pet name first.';return;}
  $('bankMessage').textContent='Saving pet name…';
  const {data,error}=await db.rpc('set_pet_name',{p_pet_id:petId,p_pet_name:name});
  if(error){console.error(error);$('bankMessage').textContent=error.message||'Could not save the pet name.';return;}
  petNamesState=data?.[0]?.pet_names||petNamesState;renderBank();refreshRoamingPets();
  $('bankMessage').textContent=`${name} is now this pet's name.`;
}
async function setMyActivePet(petId){
  $('bankMessage').textContent=petId?'Calling your pet…':'Putting your pet away…';
  const {data,error}=await db.rpc('set_active_pet',{p_pet_id:petId});
  if(error){console.error(error);$('bankMessage').textContent=error.message||'Could not update your active pet.';return;}
  activePetState=data?.[0]?.active_pet||null;if(data?.[0]?.pet_names)petNamesState=data[0].pet_names;renderBank();refreshRoamingPets();
  $('bankMessage').textContent=activePetState?`${PET_CATALOG[activePetState]?.name||'Your pet'} is now following you.`:'Your pet has been put away.';
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
    if(visual)visual.style.setProperty('--pet-facing',String(target.x>=oldX?1:-1));
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
    if(!el){el=document.createElement('div');el.className='roaming-pet';el.dataset.user=row.username;el.innerHTML=`<div class="pet-label"><b>${escapeHtml(petDisplayName)}</b><small>${escapeHtml(row.username)}</small></div><div class="pet-sprite">${petMarkup(row.active_pet,petDisplayName,'roaming-pet-art')}</div>`;el.dataset.petId=row.active_pet;layer.appendChild(el);ensurePetKart(el);enterCurrentRoom(el,rowIndex*85+Math.random()*260,rowIndex);}
    else{if(el.dataset.petId!==row.active_pet){el.querySelector('.pet-sprite').innerHTML=petMarkup(row.active_pet,petDisplayName,'roaming-pet-art');el.dataset.petId=row.active_pet;}const img=el.querySelector('img');if(img){img.src=meta.image;img.alt=petDisplayName}el.querySelector('.pet-label b').textContent=petDisplayName;el.querySelector('.pet-label small').textContent=row.username;current.delete(row.username);}
  });current.forEach(el=>{stopPetTimers(el);el.remove()});
}
function startRoamingPets(){clearInterval(roamingPetTimer);clearInterval(petRoomSwitchTimer);window.removeEventListener('resize',reflowPetRoom);window.addEventListener('resize',reflowPetRoom);const scene=$('petRoom')?.querySelector('.pet-room-scene');if(scene)scene.dataset.room=currentPetRoom().id;const first=scene?.querySelector('.pet-room-bg-a');if(first)first.style.backgroundImage=`url('${currentPetRoom().image}')`;refreshRoamingPets();roamingPetTimer=setInterval(refreshRoamingPets,12000);petRoomSwitchTimer=setInterval(switchPetRoom,PET_ROOM_ROTATION_MS);}
function reflowPetRoom(){document.querySelectorAll('.roaming-pet').forEach((el,i)=>{const cfg=currentPetRoom();const point=cfg.id==='squid'?(cfg.approach?.[0]||cfg.entrance):cfg.id==='hunger'?cfg.spawnPoints[i%cfg.spawnPoints.length]:(cfg.startGrid?.[i%cfg.startGrid.length]||cfg.entrance);movePetTo(el,point,{immediate:true,noOffset:true});});}
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
  const {data,error}=await db.rpc('skip_wise_old_man_task');
  button.textContent='SKIP TASK — 5,000 GP';
  if(error){console.error(error);toast(error.message?.includes('Not enough')?'You need 5,000 GP to skip this task.':'Could not skip task. Run the updated Wise Old Man SQL.');wiseTaskState=await fetchWiseTask();renderWiseTask();return;}
  wiseTaskState=data?.[0]||await fetchWiseTask();renderWiseTask();
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
    ['Woodcutting', 'assets/tree.png', row.woodcutting_xp],
    ['Mining', 'assets/runite-rocks.png', row.mining_xp],
    ['Fishing', 'assets/shark.png', row.fishing_xp],
    ['Agility', 'assets/agility-icon.webp', row.agility_xp],
    ['Slayer', 'assets/slayer-icon.png', row.slayer_xp],
    ['Attack', 'assets/attack-icon.webp', row.attack_xp],
    ['Strength', 'assets/strength-icon.webp', row.strength_xp],
    ['Defence', 'assets/defence-icon.webp', row.defence_xp],
    ['Sailing', 'assets/sailing-icon.webp', row.sailing_xp],
    ['Runecrafting', 'assets/runecrafting-icon.png', row.runecrafting_xp],
    ['Cooking', 'assets/cooking-icon-new.png', row.cooking_xp]
  ];
  const totalLevel = skills.reduce((sum, skill) => sum + levelFromXp(Number(skill[2]) || 0), 0);
  const skillCards = skills.map(([label, image, rawXp]) => {
    const xp = Number(rawXp) || 0;
    return `<div class="public-skill">${image ? `<img src="${image}" alt="">` : `<span class="public-combat-icon">⚔</span>`}<div><b>${label}</b><strong>Level ${levelFromXp(xp)}</strong><small>${xp.toLocaleString('en-GB')} XP</small></div></div>`;
  }).join('');
  const unlocked = new Set(row.collection || []);
  const collection = COLLECTIBLES.map(([id, label]) => `<div class="collectible ${unlocked.has(id) ? 'found' : ''}"><span>${unlocked.has(id) ? '◆' : '?'}</span>${escapeHtml(label)}</div>`).join('');
  const created = row.created_at ? new Date(row.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Unknown';
  $('playerStatsBody').innerHTML = `
    <div class="public-profile-summary">
      <div><span>Total level</span><strong>${totalLevel}</strong></div>
      <div><span>Best Dash</span><strong>${row.agility_best_ms ? formatDashTime(row.agility_best_ms) : '—'}</strong></div>
      <div><span>Joined</span><strong>${escapeHtml(created)}</strong></div>
    </div>
    <div class="public-skills-grid">${skillCards}</div>
    <h4>COLLECTION LOG <small>${unlocked.size} / ${COLLECTIBLES.length}</small></h4>
    <div class="collection-grid">${collection}</div>`;
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
async function loadQuestProfile(){const{data,error}=await db.rpc('get_cooks_assistant_state');if(error){console.warn('Quest system not installed.',error);character.cooking_xp=0;return null}questState=data?.[0]||null;if(questState){character.cooking_xp=Number(questState.cooking_xp)||0;character.gp=Number(questState.gp)||0;character.quest_points=Number(questState.quest_points)||0}return questState}
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
  const host=$('petWarsHost'),guest=$('petWarsGuest');host.querySelector('.pet-war-visual').innerHTML=petMarkup(w.host_pet,w.host_pet_name||hMeta?.name||'Host pet','pet-war-art');guest.querySelector('.pet-war-visual').innerHTML=petMarkup(w.guest_pet,w.guest_pet_name||gMeta?.name||'Guest pet','pet-war-art');host.querySelector('.pet-war-name').textContent=w.host_pet_name||hMeta?.name||'Host pet';guest.querySelector('.pet-war-name').textContent=w.guest_pet_name||gMeta?.name||'Guest pet';host.querySelector('.pet-war-owner').textContent=w.host_username;guest.querySelector('.pet-war-owner').textContent=w.guest_username||'Waiting for challenger';
  $('petWarsHostBet').textContent=`${w.host_username}: ${Number(w.host_wager||0).toLocaleString('en-GB')} GP · backed ${Number(w.host_pick)===1?'host':'guest'}`;$('petWarsGuestBet').textContent=w.guest_username?`${w.guest_username}: ${Number(w.guest_wager||0).toLocaleString('en-GB')} GP · backed ${Number(w.guest_pick)===1?'host':'guest'}`:'Waiting for player two…';
  $('petWarsCancel').classList.toggle('hidden',w.status!=='waiting'||w.host_username!==character.username);
  if(w.status==='waiting'){$('petWarsTimer').textContent='15.0';$('petWarsCommentary').textContent=`Share code ${w.room_code||w.code} with another player.`;$('petWarsFightMessage').textContent='Your wager is safely held until someone joins, or you cancel.';return}
  if(w.status==='fighting'){arena.classList.add('fighting');const elapsed=Math.max(0,(Date.now()-new Date(w.started_at).getTime())/1000),remaining=Math.max(0,15-elapsed);$('petWarsTimer').textContent=remaining.toFixed(1);$('petWarsFightMessage').textContent='A random winner will be selected when the bell rings.';if(!petWarAnimationTimer){let i=0;$('petWarsCommentary').textContent=PET_WAR_LINES[0];petWarAnimationTimer=setInterval(()=>{$('petWarsCommentary').textContent=PET_WAR_LINES[++i%PET_WAR_LINES.length]},1500)}return}
  clearInterval(petWarAnimationTimer);petWarAnimationTimer=null;arena.classList.add('finished');const winner=Number(w.winner_slot),mine=w.host_username===character.username?1:2,payout=mine===1?Number(w.host_payout||0):Number(w.guest_payout||0);host.classList.toggle('winner',winner===1);host.classList.toggle('loser',winner===2);guest.classList.toggle('winner',winner===2);guest.classList.toggle('loser',winner===1);$('petWarsTimer').textContent='0.0';$('petWarsCommentary').textContent=`${winner===1?(w.host_pet_name||hMeta?.name):(w.guest_pet_name||gMeta?.name)} WINS!`;$('petWarsFightMessage').textContent=payout>0?`Correct pick — you received ${payout.toLocaleString('en-GB')} GP!`:'Wrong pick — better luck in the next ridiculous fight.';clearInterval(petWarPollTimer);petWarPollTimer=null;
}
async function cancelPetWar(){if(!petWarState)return;const {error}=await db.rpc('cancel_pet_war',{p_room_code:petWarState.code});if(error){$('petWarsFightMessage').textContent=error.message;return}leavePetWar();await openPetWars()}
function leavePetWar(){clearInterval(petWarPollTimer);clearInterval(petWarAnimationTimer);petWarPollTimer=petWarAnimationTimer=null;petWarState=null;$('petWarsFight').classList.add('hidden');$('petWarsLobby').classList.remove('hidden');if($('petWarsDialog').open)$('petWarsDialog').close()}
$('can').onclick = async () => {
  $('can').classList.remove('pop');
  void $('can').offsetWidth;
  $('can').classList.add('pop');
  playClickSound();
  await changeCount(1);
};
$('undo').onclick = () => changeCount(-1);
$('reset').onclick = () => $('dialog').showModal();
$('confirm').onclick = () => resetCount();
function setAuthMode(mode) {
  authMode = mode;
  const isLogin = mode === 'login';
  $('showLogin').classList.toggle('active', isLogin);
  $('showRegister').classList.toggle('active', !isLogin);
  $('authSubmit').textContent = isLogin ? 'LOG IN' : 'CREATE ACCOUNT';
  $('password').autocomplete = isLogin ? 'current-password' : 'new-password';
  $('characterError').textContent = '';
}

$('createCharacter').onclick = () => {
  setAuthMode('login');
  $('username').value = '';
  $('password').value = '';
  $('characterDialog').showModal();
};
$('showLogin').onclick = () => setAuthMode('login');
$('showRegister').onclick = () => setAuthMode('register');
$('characterSummary').onclick = openSkills;
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
$('openRunecrafting').onclick = openRunecrafting;
$('openWiseTask').onclick = openWiseTask;
$('openBank').onclick = openBank;
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
    if (button.dataset.close === 'runecraftingDialog') leaveRcRoom();
    if (button.dataset.close === 'petWarsDialog') leavePetWar();
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
keepCoreAdventureButtonsEnabled();
window.addEventListener('load', keepCoreAdventureButtonsEnabled);

window.addEventListener('keydown',e=>{const k=e.key.length===1?e.key.toLowerCase():e.key;if(sailingRunning&&[' ','ArrowUp','w'].includes(k)){e.preventDefault();if(!e.repeat)sailingJump();if(sailingState)sailingState.held=true;}});window.addEventListener('keyup',e=>{const k=e.key.length===1?e.key.toLowerCase():e.key;if([' ','ArrowUp','w'].includes(k))sailingRelease();});const sailCanvas=$('sailingCanvas');sailCanvas.addEventListener('pointerdown',e=>{if(sailingRunning){e.preventDefault();sailingJump();if(sailingState)sailingState.held=true;}});sailCanvas.addEventListener('pointerup',sailingRelease);sailCanvas.addEventListener('pointercancel',sailingRelease);document.querySelectorAll('[data-sail]').forEach(b=>{b.addEventListener('pointerdown',e=>{e.preventDefault();sailingJump();if(sailingState)sailingState.held=true;});b.addEventListener('pointerup',sailingRelease);b.addEventListener('pointercancel',sailingRelease);b.addEventListener('pointerleave',sailingRelease);});

// Homepage character shift: three recognisable characters rotate every 1 minute.
(() => {
  const gamer = document.getElementById('gamer');
  const monitor = document.getElementById('characterMonitor');
  if (!gamer) return;
  const variants = [
    { className: 'character-one', monitorClass: 'monitor-toa', monitorLabel: 'Character 1 playing Tombs of Amascut in Old School RuneScape', label: 'Brown-haired character in a brown jumper smoking a hand-rolled joint while playing Tombs of Amascut' },
    { className: 'character-two', monitorClass: 'monitor-stellaris', monitorLabel: 'Character 2 playing Stellaris', label: 'Pale-skinned character in a white outfit with a green cape holding a Dr Pepper while playing Stellaris' },
    { className: 'character-three', monitorClass: 'monitor-isaac', monitorLabel: 'Character 3 playing The Binding of Isaac', label: 'Pale-skinned purple wizard with a blue wizard hat eating quiche while playing The Binding of Isaac' }
  ];
  const SHIFT_MS = 60000;
  const WALK_MS = 3200;
  let index = 0;
  let timer;

  function applyCharacter(nextIndex) {
    gamer.classList.remove('character-one','character-two','character-three');
    gamer.classList.add(variants[nextIndex].className);
    gamer.setAttribute('aria-label', variants[nextIndex].label);
    if (monitor) {
      monitor.classList.remove('monitor-toa','monitor-stellaris','monitor-isaac');
      monitor.classList.add(variants[nextIndex].monitorClass);
      monitor.setAttribute('aria-label', variants[nextIndex].monitorLabel);
    }
  }

  function scheduleShift() {
    clearTimeout(timer);
    timer = setTimeout(changeShift, SHIFT_MS);
  }

  function changeShift() {
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
        scheduleShift();
      }, WALK_MS);
    }, WALK_MS);
  }

  applyCharacter(index);
  gamer.classList.add('typing');
  scheduleShift();

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearTimeout(timer);
    else scheduleShift();
  });
})();

window.addEventListener('load',startRoamingPets);

$('miningDialog').addEventListener('close',()=>{clearInterval(miningAfkPoll);clearInterval(miningLivePoll);clearInterval(miningChatTimer);miningAfkPoll=miningLivePoll=miningChatTimer=null;});
