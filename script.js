const SUPABASE_URL = 'https://hvdrwmjieguurxvrgzfu.supabase.co';
const SUPABASE_KEY = 'sb_publishable_bln84LaJ8iYmnkYK9mh0Pg_XxP7O1OZ';
const MAX = 25000;
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
  if (v < 18000) return ['XP SABOTEUR', 'Thousands of efficient ticks have been sacrificed.'];
  if (v < MAX) return ['REPO VETERAN', 'The clan tally is approaching legendary waste.'];
  return ['WASTE MASTER', 'Maximum XP waste has been achieved.'];
}

function xpForLevel(level) {
  let points = 0;
  for (let i = 1; i < level; i++) points += Math.floor(i + 300 * Math.pow(2, i / 7));
  return Math.floor(points / 4);
}

function levelFromXp(xp) {
  for (let level = 2; level <= 99; level++) if (xp < xpForLevel(level)) return level - 1;
  return 99;
}

function render() {
  const progress = Math.min(count, MAX) / MAX;
  const [name, text] = level(count);
  $('count').textContent = count.toLocaleString('en-GB');
  $('status').textContent = text;
  $('percent').textContent = `${(progress * 100).toFixed(2)}%`;
  $('fill').style.width = `${progress * 100}%`;
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
  $('openRunecrafting').disabled = !hasCharacter;
  if (!hasCharacter) {
    $('createCharacter').textContent = 'LOG IN / CREATE ACCOUNT';
    return;
  }

  const total = levelFromXp(character.woodcutting_xp) + levelFromXp(character.mining_xp) + levelFromXp(character.fishing_xp) + levelFromXp(character.agility_xp || 0) + levelFromXp(character.slayer_xp || 0) + levelFromXp(character.attack_xp || 0) + levelFromXp(character.strength_xp || 0) + levelFromXp(character.defence_xp || 0) + levelFromXp(character.sailing_xp || 0) + levelFromXp(character.runecrafting_xp || 0);
  $('characterName').textContent = character.username;
  $('totalLevel').textContent = total;
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

  const unlocked = new Set(character.collection || []);
  $('collectionGrid').innerHTML = COLLECTIBLES.map(([id, label]) => `<div class="collectible ${unlocked.has(id) ? 'found' : ''}"><span>${unlocked.has(id) ? '◆' : '?'}</span>${label}</div>`).join('');
  $('skillsDialog').showModal();
}

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

function selectCombatWeapon(type) {
  if (!COMBAT_WEAPONS[type] || combatRunning) return;
  selectedCombatWeapon = type;
  document.querySelectorAll('.combat-weapon-choice').forEach(button => {
    button.classList.toggle('selected', button.dataset.weapon === type);
    button.setAttribute('aria-pressed', button.dataset.weapon === type ? 'true' : 'false');
  });
  $('combatMessage').textContent = `${COMBAT_WEAPONS[type].name} selected. Survive the minute to bank Combat XP.`;
}

function selectCombatDifficulty(type) {
  if (!['easy','medium','hard'].includes(type) || combatRunning) return;
  selectedCombatDifficulty = type;
  document.querySelectorAll('.combat-difficulty-choice').forEach(button => {
    const active = button.dataset.difficulty === type;
    button.classList.toggle('selected', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  const names={easy:'Easy',medium:'Medium',hard:'Hard'};
  $('combatMessage').textContent = `${names[type]} selected. Choose a weapon and start the run.`;
}

function selectCombatLocation(type) {
  if (!['lumbridge','fight-caves','gauntlet'].includes(type) || combatRunning) return;
  selectedCombatLocation = type;
  document.querySelectorAll('.combat-location-choice').forEach(button => {
    const active = button.dataset.location === type;
    button.classList.toggle('selected', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  const names = {lumbridge:'Lumbridge', 'fight-caves':'Fight Caves', gauntlet:'Corrupted Gauntlet'};
  $('combatMessage').textContent = `${names[type]} selected. Choose a weapon and difficulty.`;
}

function openCombat() {
  if (!character) return;
  resetCombatGame();
  $('combatDialog').showModal();
}

function resetCombatGame(message = 'Complete the minute for the best Attack, Strength and Defence XP reward.') {
  stopCombatMusic(250);
  combatRunning = false;
  combatPaused = false;
  cancelAnimationFrame(combatFrame);
  combatFrame = null;
  combatKeys.clear();
  $('combatIntro').classList.remove('hidden');
  $('combatUpgrade').classList.add('hidden');
  $('combatStart').textContent = 'START RUN';
  $('combatTime').textContent = '60';
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
  combatState = {
    weapon: selectedCombatWeapon,
    difficulty: selectedCombatDifficulty,
    location: selectedCombatLocation,
    player: { x: canvas.width / 2, y: canvas.height / 2, r: 15, hp: 100, maxHp: 100, speed: 185, damage: weapon.damage, range: weapon.range, attackRate: weapon.attackRate, lastAttack: 0, armour: 0 },
    enemies: [], projectiles: [], slashes: [], chains: [], orbs: [], particles: [],
    kills: 0, damage: 0, runXp: 0, runLevel: 1, nextLevel: 8,
    spawnClock: 0, elapsed: 0, ended: false
  };
  const difficulty = { easy:{spawn:.72,hp:.78,speed:.82,damage:.70}, medium:{spawn:1,hp:1,speed:1,damage:1}, hard:{spawn:1.35,hp:1.28,speed:1.18,damage:1.35} }[selectedCombatDifficulty];
  combatState.difficultyConfig = difficulty;
  combatRunning = true;
  combatPaused = false;
  combatStartedAt = performance.now();
  combatLast = combatStartedAt;
  $('combatIntro').classList.add('hidden');
  $('combatUpgrade').classList.add('hidden');
  const locationName={lumbridge:'Lumbridge','fight-caves':'Fight Caves',gauntlet:'Corrupted Gauntlet'}[selectedCombatLocation];
  $('combatMessage').textContent = `${weapon.name} equipped in ${locationName} — move, survive and auto-attack!`;
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
  const remaining = Math.max(0, 60 - s.elapsed);
  if (remaining <= 0) return finishCombat(true);

  let dx = 0, dy = 0;
  if (combatKeys.has('ArrowLeft') || combatKeys.has('a')) dx--;
  if (combatKeys.has('ArrowRight') || combatKeys.has('d')) dx++;
  if (combatKeys.has('ArrowUp') || combatKeys.has('w')) dy--;
  if (combatKeys.has('ArrowDown') || combatKeys.has('s')) dy++;
  if (dx || dy) {
    const len = Math.hypot(dx, dy); p.x += dx / len * p.speed * dt; p.y += dy / len * p.speed * dt;
    p.x = Math.max(20, Math.min(740, p.x)); p.y = Math.max(24, Math.min(406, p.y));
  }

  s.spawnClock -= dt;
  if (s.spawnClock <= 0) {
    spawnCombatEnemy();
    s.spawnClock = Math.max(0.18, (0.75 - s.elapsed * 0.007) / s.difficultyConfig.spawn);
  }

  let nearest = null, nearestD = Infinity;
  for (const e of s.enemies) {
    const ex = p.x - e.x, ey = p.y - e.y, d = Math.hypot(ex, ey) || 1;
    e.x += ex / d * e.speed * dt; e.y += ey / d * e.speed * dt;
    if (d < nearestD) { nearestD = d; nearest = e; }
    e.hitCooldown -= dt;
    if (d < p.r + e.r + 2 && e.hitCooldown <= 0) {
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
    if (d < p.r + 8) { orb.taken = true; s.runXp += orb.value; }
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
  $('combatKills').textContent = s.kills;
  $('combatLevel').textContent = s.runLevel;
  $('combatXpFill').style.width = `${Math.min(100, s.runXp / s.nextLevel * 100)}%`;
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
  const timeScale=1+s.elapsed/95;
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
  s.orbs.push({x:enemy.x,y:enemy.y,value:enemy.xp,taken:false});
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
  $('combatMessage').textContent = survived ? 'Minute survived! Saving combat XP…' : 'You were overwhelmed. Saving partial XP…';
  const {data,error}=await db.rpc('complete_combat_run',{p_survived:survived,p_kills:s.kills,p_damage:Math.floor(s.damage),p_seconds:Math.min(60,Math.floor(s.elapsed)),p_difficulty:s.difficulty});
  if(error){console.error(error);$('combatMessage').textContent='Could not save combat XP. Run update-combat-survival.sql in Supabase.';return}
  const r=data?.[0]; if(!r)return;
  character.attack_xp=Number(r.attack_xp);character.strength_xp=Number(r.strength_xp);character.defence_xp=Number(r.defence_xp);
  renderCharacter();
  $('combatMessage').textContent=`${survived?'Victory!':'Run ended.'} +${r.attack_gained} Attack, +${r.strength_gained} Strength, +${r.defence_gained} Defence XP.`;
  toast('Combat XP saved!',3500);
}

function drawCombatBackdrop(ctx,w,h){
  const location=combatState?.location||selectedCombatLocation;
  const palette={lumbridge:['#152416','#183019','#1c351d','#65513a'],'fight-caves':['#28120d','#38160f','#451d11','#8a4b25'],gauntlet:['#24082c','#32103d','#42114d','#b83378']}[location];
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
 const {data,error}=await db.rpc('complete_sailing_run',{p_survived:survived,p_score:Math.floor(s.score),p_gates:s.gates,p_seconds:Math.min(60,Math.floor(s.elapsed))});
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
  s.orbs.forEach(o=>{ctx.fillStyle='#74d7ff';ctx.beginPath();ctx.arc(o.x,o.y,6,0,7);ctx.fill()});
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
function rcCode(){return Math.random().toString(36).slice(2,8).toUpperCase()}
function startRcMusic(){const a=$('rcMusic');if(!a)return;a.volume=.42;a.currentTime=0;const play=a.play();if(play?.catch)play.catch(()=>{})}
function stopRcMusic(){const a=$('rcMusic');if(!a)return;a.pause();a.currentTime=0}
async function openRunecrafting(){if(!character)return;$('runecraftingDialog').showModal();$('rcLobby').classList.remove('hidden');$('rcGame').classList.add('hidden');$('rcLobbyMessage').textContent='Create a match or join using a six-character room code.'}
async function createRcRoom(){const code=rcCode(), state=defaultRcState(character.username);const {data,error}=await db.from('runecrafting_rooms').insert({code,host_user_id:(await db.auth.getUser()).data.user.id,host_name:character.username,state}).select().single();if(error){console.error(error);$('rcLobbyMessage').textContent='Could not create room. Run the Runecrafting Pool SQL update first.';return}await enterRcRoom(data,1)}
async function joinRcRoom(){const code=$('rcRoomCode').value.trim().toUpperCase();if(code.length<4)return;const {data,error}=await db.from('runecrafting_rooms').select('*').eq('code',code).maybeSingle();if(error||!data){$('rcLobbyMessage').textContent='Room not found.';return}const uid=(await db.auth.getUser()).data.user.id;if(data.host_user_id===uid)return enterRcRoom(data,1);if(data.guest_user_id&&data.guest_user_id!==uid){$('rcLobbyMessage').textContent='That match already has two players.';return}let state=data.state;if(!data.guest_user_id){state.players[2]=character.username;state.status='playing';state.message=`${state.players[1]} breaks first.`;state.revision++;const res=await db.from('runecrafting_rooms').update({guest_user_id:uid,guest_name:character.username,state}).eq('id',data.id).select().single();if(res.error){$('rcLobbyMessage').textContent='Could not join this match.';return}return enterRcRoom(res.data,2)}await enterRcRoom(data,2)}
async function enterRcRoom(room,slot){rcRoom={...room,slot};$('rcLobby').classList.add('hidden');$('rcGame').classList.remove('hidden');$('rcCodeLabel').textContent=room.code;$('rcPlayerLabel').textContent=`P${slot} · ${character.username}`;renderRcState();if(room.state.status==='playing')startRcMusic();clearInterval(rcPollTimer);rcPollTimer=setInterval(pollRcRoom,120)}
async function pollRcRoom(){if(!rcRoom||rcAnimating)return;const oldStatus=rcRoom.state?.status;const {data,error}=await db.from('runecrafting_rooms').select('*').eq('id',rcRoom.id).maybeSingle();if(error||!data)return;rcRoom={...data,slot:rcRoom.slot};if(oldStatus!=='playing'&&data.state.status==='playing')startRcMusic();if(data.state.status==='finished')stopRcMusic();renderRcState()}
function renderRcState(){if(!rcRoom)return;const s=rcRoom.state;$('rcTurnLabel').textContent=s.status==='finished'?`Winner: P${s.winner}`:`P${s.turn} · ${s.players[s.turn]||'Waiting'}`;const g=s.groups[rcRoom.slot];$('rcSetLabel').textContent=g===1?'Red · Fire runes':g===2?'Yellow · Chaos runes':'Unassigned';$('rcMessage').textContent=s.message||'';$('rcRematch').classList.toggle('hidden',s.status!=='finished');renderRcPotted();drawRcTable()}
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
function drawRcTable(){const c=$('rcCanvas'),ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);ctx.fillStyle='#10251c';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='#3d2817';ctx.fillRect(8,8,c.width-16,c.height-16);ctx.fillStyle='#176044';ctx.fillRect(20,20,c.width-40,c.height-40);ctx.strokeStyle='#d3b36a';ctx.lineWidth=3;ctx.strokeRect(28,28,c.width-56,c.height-56);for(const [x,y] of RC_POCKETS){ctx.fillStyle='#050505';ctx.beginPath();ctx.arc(x,y,18,0,Math.PI*2);ctx.fill()}if(!rcRoom)return;for(const b of rcRoom.state.balls){if(!b.potted)drawRcBall(ctx,b)}if(rcAim){const cue=rcRoom.state.balls[0];ctx.strokeStyle='rgba(255,255,255,.85)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(cue.x,cue.y);ctx.lineTo(rcAim.x,rcAim.y);ctx.stroke()}}
function rcPointerPos(e){const r=$('rcCanvas').getBoundingClientRect();return{x:(e.clientX-r.left)*RC_W/r.width,y:(e.clientY-r.top)*RC_H/r.height}}
function rcAimStart(e){if(!rcRoom||rcAnimating)return;const s=rcRoom.state;if(s.status!=='playing'||s.turn!==rcRoom.slot||s.shot_active)return;const cue=s.balls[0];if(cue.potted)return;const p=rcPointerPos(e);if(Math.hypot(p.x-cue.x,p.y-cue.y)<45){rcAim=p;$('rcCanvas').setPointerCapture(e.pointerId);drawRcTable()}}
function rcAimMove(e){if(!rcAim)return;rcAim=rcPointerPos(e);drawRcTable()}
function rcAimEnd(e){if(!rcAim||!rcRoom)return;const cue=rcRoom.state.balls[0],p=rcPointerPos(e),dx=cue.x-p.x,dy=cue.y-p.y,len=Math.hypot(dx,dy);rcAim=null;if(len<8)return drawRcTable();const power=Number($('rcPower').value)/100;cue.vx=dx/len*Math.min(700,len*5)*power;cue.vy=dy/len*Math.min(700,len*5)*power;runRcPhysics()}
let rcLastLiveSync=0,rcLiveSyncBusy=false;
async function syncRcLiveShot(force=false){
  if(!rcRoom||!rcRoom.state?.shot_active||rcLiveSyncBusy)return;
  const now=performance.now();
  if(!force&&now-rcLastLiveSync<90)return;
  rcLastLiveSync=now;rcLiveSyncBusy=true;
  const snapshot={...rcRoom.state,balls:rcRoom.state.balls.map(b=>({...b}))};
  try{await db.from('runecrafting_rooms').update({state:snapshot,updated_at:new Date().toISOString()}).eq('id',rcRoom.id)}finally{rcLiveSyncBusy=false}
}
async function runRcPhysics(){
  rcAnimating=true;
  const s=rcRoom.state;
  s.shot_active=true;s.shot_by=rcRoom.slot;s.revision++;
  await syncRcLiveShot(true);
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
async function finishRcShot(potted,cuePotted){const s=rcRoom.state,me=rcRoom.slot,other=me===1?2:1;s.shot_active=false;s.shot_by=0;if(!s.groups[me]){const first=potted.find(b=>b.group===1||b.group===2);if(first){s.groups[me]=first.group;s.groups[other]=first.group===1?2:1}}const wrath=potted.find(b=>b.group===8);const own=potted.filter(b=>b.group===s.groups[me]);const remainingOwn=s.balls.some(b=>!b.potted&&b.group===s.groups[me]);if(wrath){s.status='finished';s.winner=!remainingOwn&&!cuePotted?me:other;s.message=`${s.players[s.winner]} wins the match!`;stopRcMusic();await awardRcXp(s.winner===me)}else{if(cuePotted){const cue=s.balls[0];cue.potted=false;cue.x=190;cue.y=215;s.turn=other;s.message='Essence ball scratched — turn lost.'}else if(!own.length){s.turn=other;s.message=`Turn passes to ${s.players[other]}.`}else{s.message=`${s.groups[me]===1?'Fire':'Chaos'} rune potted! ${s.players[me]} continues.`}}s.revision++;const {data,error}=await db.from('runecrafting_rooms').update({state:s,updated_at:new Date().toISOString()}).eq('id',rcRoom.id).select().single();rcAnimating=false;if(!error){rcRoom={...data,slot:me};renderRcState()}}
async function awardRcXp(won){const {data}=await db.rpc('complete_runecrafting_match',{p_won:won});const r=data?.[0];if(r){character.runecrafting_xp=Number(r.new_xp);renderCharacter();toast(`+${r.xp_gained} Runecrafting XP`,3500)}}
async function rcRematch(){if(!rcRoom)return;const s=defaultRcState(rcRoom.state.players[1]);s.players=rcRoom.state.players;s.status=s.players[2]?'playing':'waiting';s.message=s.status==='playing'?`${s.players[1]} breaks first.`:'Waiting for player two…';const {data}=await db.from('runecrafting_rooms').update({state:s}).eq('id',rcRoom.id).select().single();if(data){rcRoom={...data,slot:rcRoom.slot};if(s.status==='playing')startRcMusic();renderRcState()}}
function leaveRcRoom(){stopRcMusic();clearInterval(rcPollTimer);rcPollTimer=null;rcRoom=null;rcAnimating=false;rcAim=null;$('rcGame').classList.add('hidden');$('rcLobby').classList.remove('hidden')}

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
    ['Runecrafting', 'assets/runecrafting-icon.png', row.runecrafting_xp]
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
$('openSlayer').onclick = openSlayer;
$('openCombat').onclick = openCombat;
document.querySelectorAll('.combat-weapon-choice').forEach(button => button.addEventListener('click', () => selectCombatWeapon(button.dataset.weapon)));
document.querySelectorAll('.combat-difficulty-choice').forEach(button => button.addEventListener('click', () => selectCombatDifficulty(button.dataset.difficulty)));
document.querySelectorAll('.combat-location-choice').forEach(button => button.addEventListener('click', () => selectCombatLocation(button.dataset.location)));
document.querySelectorAll('.slayer-difficulty-choice').forEach(button => button.addEventListener('click', () => selectSlayerDifficulty(button.dataset.slayerDifficulty)));
$('combatStart').onclick = startCombatGame;
$('openSailing').onclick = openSailingGame;
$('openRunecrafting').onclick = openRunecrafting;
$('rcCreateRoom').onclick = createRcRoom;
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
$('openSkills').onclick = openSkills;
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
    if (button.dataset.close === 'agilityDialog') resetAgilityGame();
    if (button.dataset.close === 'slayerDialog') resetJadSimulator();
    if (button.dataset.close === 'combatDialog') resetCombatGame();
    if (button.dataset.close === 'sailingDialog') resetSailingGame();
    if (button.dataset.close === 'runecraftingDialog') leaveRcRoom();
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

window.addEventListener('keydown',e=>{const k=e.key.length===1?e.key.toLowerCase():e.key;if(sailingRunning&&[' ','ArrowUp','w'].includes(k)){e.preventDefault();if(!e.repeat)sailingJump();if(sailingState)sailingState.held=true;}});window.addEventListener('keyup',e=>{const k=e.key.length===1?e.key.toLowerCase():e.key;if([' ','ArrowUp','w'].includes(k))sailingRelease();});const sailCanvas=$('sailingCanvas');sailCanvas.addEventListener('pointerdown',e=>{if(sailingRunning){e.preventDefault();sailingJump();if(sailingState)sailingState.held=true;}});sailCanvas.addEventListener('pointerup',sailingRelease);sailCanvas.addEventListener('pointercancel',sailingRelease);document.querySelectorAll('[data-sail]').forEach(b=>{b.addEventListener('pointerdown',e=>{e.preventDefault();sailingJump();if(sailingState)sailingState.held=true;});b.addEventListener('pointerup',sailingRelease);b.addEventListener('pointercancel',sailingRelease);b.addEventListener('pointerleave',sailingRelease);});
