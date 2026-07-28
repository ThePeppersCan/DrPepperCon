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
let sailingRunning=false, sailingFrame=null, sailingLast=0, sailingStartedAt=0, sailingState=null;
const sailingKeys=new Set();
const AGILITY_TARGETS = 15;
const JAD_HITS = 12;

const AUTH_DOMAIN = 'conofdrpepper.local';

const SKILLS = {
  woodcutting: { label: 'Woodcutting', image: 'assets/tree.png', xp: 25 },
  mining: { label: 'Mining', image: 'assets/runite-rocks.png', xp: 35 },
  fishing: { label: 'Fishing', image: 'assets/shark.png', xp: 40 }
};

const COLLECTIBLES = [
  ['mini_dr_pepper', 'Mini Dr Pepper'],
  ['chair_fragment', 'Chair Fragment'],
  ['membership_card', 'Membership Card'],
  ['reinforced_chair', 'Reinforced Chair'],
  ['golden_dr_pepper', 'Golden Dr Pepper']
];

const clickSound = new Audio('can-open.mp3');
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
  if (v < 1000) return ['BEGINNER', 'The con has only just begun.'];
  if (v < 5000) return ['COMFORTABLE', 'The chair is starting to notice.'];
  if (v < 10000) return ['THICC', 'Serious Dr Pepper commitment detected.'];
  if (v < 18000) return ['ABSOLUTE UNIT', 'RuneScape gains. Real-world gains.'];
  if (v < MAX) return ['CHAIR DESTROYER', 'Maximum Con is getting dangerously close.'];
  return ['MAXIMUM CON', 'The final form has been achieved.'];
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
  $('level').textContent = `CON LEVEL: ${name}`;
  $('gamer').style.setProperty('--fat', progress.toFixed(5));
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
  if (error) return showError('The can could not be counted. Check Supabase setup.', error);
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
  if (!hasCharacter) {
    $('createCharacter').textContent = 'LOG IN / CREATE ACCOUNT';
    return;
  }

  const total = levelFromXp(character.woodcutting_xp) + levelFromXp(character.mining_xp) + levelFromXp(character.fishing_xp) + levelFromXp(character.agility_xp || 0) + levelFromXp(character.slayer_xp || 0) + levelFromXp(character.attack_xp || 0) + levelFromXp(character.strength_xp || 0) + levelFromXp(character.defence_xp || 0) + levelFromXp(character.sailing_xp || 0);
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

  const unlocked = new Set(character.collection || []);
  $('collectionGrid').innerHTML = COLLECTIBLES.map(([id, label]) => `<div class="collectible ${unlocked.has(id) ? 'found' : ''}"><span>${unlocked.has(id) ? '◆' : '?'}</span>${label}</div>`).join('');
  $('skillsDialog').showModal();
}

function resetAgilityGame(message = 'Catch all 15 Dr Peppers to receive XP.') {
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
  target.setAttribute('aria-label', 'Catch the Dr Pepper');
  target.innerHTML = '<span class="mini-can-top"></span><span class="mini-can-shine"></span><span class="mini-can-label">Dr<br><b>Pepper</b></span>';
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
  $('agilityMessage').textContent = 'Catch the Dr Peppers!';
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
  $('agilityMessage').textContent = `Dr Pepper Dash complete! +${result.xp_gained} Agility XP${newLevel > oldLevel ? ` — Level ${newLevel}!` : ''}${personalBest}`;
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
  $('jadBlocks').textContent = `0 / ${JAD_HITS}`;
  $('jadHealthText').textContent = '100%';
  $('jadHealthFill').style.width = '100%';
  $('jadArena').classList.remove('danger');
  $('jadStart').classList.remove('hidden');
  $('jadStart').textContent = 'START FIGHT';
  $('prayRanged').classList.remove('active');
  $('prayMagic').classList.remove('active');
  $('jadMessage').textContent = message;
}

function openSlayer() {
  if (!character) return;
  resetJadSimulator();
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
  const speed = Math.max(1050, 1750 - jadBlocks * 45);
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
  const health = Math.max(0, 100 - (jadBlocks / JAD_HITS) * 100);
  $('jadBlocks').textContent = `${jadBlocks} / ${JAD_HITS}`;
  $('jadHealthText').textContent = `${Math.round(health)}%`;
  $('jadHealthFill').style.width = `${health}%`;
  $('jadArena').classList.toggle('danger', health > 0 && health <= 20);
  $('jadCue').textContent = 'BLOCKED!';
  $('jadBoss').className = 'jad-boss blocked';

  if (jadBlocks >= JAD_HITS) {
    jadRunning = false;
    stopJadMusic(1000);
    $('jadBoss').className = 'jad-boss defeated';
    $('jadCue').textContent = 'JAD DEFEATED';
    $('jadMessage').textContent = 'Jad defeated — saving Slayer XP...';
    busy = true;
    const { data, error } = await db.rpc('complete_jad_simulator', { p_hits: JAD_HITS });
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
  const canvas = $('combatCanvas');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawCombatBackdrop(ctx, canvas.width, canvas.height);
}

function startCombatGame() {
  startCombatMusic();
  const canvas = $('combatCanvas');
  combatState = {
    player: { x: canvas.width / 2, y: canvas.height / 2, r: 15, hp: 100, maxHp: 100, speed: 185, damage: 18, range: 92, attackRate: 0.62, lastAttack: 0, armour: 0 },
    enemies: [], projectiles: [], slashes: [], orbs: [], particles: [],
    kills: 0, damage: 0, runXp: 0, runLevel: 1, nextLevel: 8,
    spawnClock: 0, elapsed: 0, ended: false
  };
  combatRunning = true;
  combatPaused = false;
  combatStartedAt = performance.now();
  combatLast = combatStartedAt;
  $('combatIntro').classList.add('hidden');
  $('combatUpgrade').classList.add('hidden');
  $('combatMessage').textContent = 'Move, survive and let your adventurer auto-attack.';
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
    s.spawnClock = Math.max(0.22, 0.75 - s.elapsed * 0.007);
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
    nearest.hp -= p.damage; s.damage += p.damage;
    s.slashes.push({x:nearest.x,y:nearest.y,life:.16});
    if (nearest.hp <= 0) killCombatEnemy(nearest);
  }

  for (const orb of s.orbs) {
    const d = Math.hypot(p.x-orb.x,p.y-orb.y);
    if (d < 90) { orb.x += (p.x-orb.x) * dt * 5; orb.y += (p.y-orb.y) * dt * 5; }
    if (d < p.r + 8) { orb.taken = true; s.runXp += orb.value; }
  }
  s.orbs = s.orbs.filter(o => !o.taken);
  s.slashes.forEach(x=>x.life-=dt); s.slashes=s.slashes.filter(x=>x.life>0);
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
  const type=roll<.52?'goblin':roll<.82?'cow':'skeleton';
  const stats={goblin:[26,68,9,13,1],cow:[48,42,12,18,2],skeleton:[34,88,14,14,2]}[type];
  const scale=1+combatState.elapsed/95;
  s.enemies.push({type,x,y,hp:stats[0]*scale,maxHp:stats[0]*scale,speed:stats[1]*scale,damage:stats[2],r:stats[3],xp:stats[4],hitCooldown:0});
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
  const {data,error}=await db.rpc('complete_combat_run',{p_survived:survived,p_kills:s.kills,p_damage:Math.floor(s.damage),p_seconds:Math.min(60,Math.floor(s.elapsed))});
  if(error){console.error(error);$('combatMessage').textContent='Could not save combat XP. Run update-combat-survival.sql in Supabase.';return}
  const r=data?.[0]; if(!r)return;
  character.attack_xp=Number(r.attack_xp);character.strength_xp=Number(r.strength_xp);character.defence_xp=Number(r.defence_xp);
  renderCharacter();
  $('combatMessage').textContent=`${survived?'Victory!':'Run ended.'} +${r.attack_gained} Attack, +${r.strength_gained} Strength, +${r.defence_gained} Defence XP.`;
  toast('Combat XP saved!',3500);
}

function drawCombatBackdrop(ctx,w,h){ctx.fillStyle='#152416';ctx.fillRect(0,0,w,h);for(let x=0;x<w;x+=40){for(let y=0;y<h;y+=40){ctx.fillStyle=((x+y)/40)%2?'#183019':'#1c351d';ctx.fillRect(x,y,40,40)}}ctx.fillStyle='#65513a';ctx.fillRect(0,0,w,12);ctx.fillRect(0,h-12,w,12);ctx.fillRect(0,0,12,h);ctx.fillRect(w-12,0,12,h)}

function openSailingGame(){
  if(!character) return toast('Create or log in to a character first.');
  resetSailingGame('Finish the course to bank Sailing XP. Clean gates and near misses build your combo.');
  $('sailingDialog').showModal();
}
function resetSailingGame(message='Ready for another glide.'){
  sailingRunning=false; cancelAnimationFrame(sailingFrame); sailingFrame=null; sailingKeys.clear();
  $('sailingIntro').classList.remove('hidden'); $('sailingStart').textContent='START GLIDE';
  $('sailingTime').textContent='60'; $('sailingHull').textContent='3'; $('sailingScore').textContent='0'; $('sailingCombo').textContent='x1'; $('sailingMessage').textContent=message;
  const c=$('sailingCanvas'); drawSailingBackdrop(c.getContext('2d'),c.width,c.height,0);
}
function startSailingGame(){
  const c=$('sailingCanvas');
  sailingState={boat:{x:c.width/2,y:c.height-82,vx:0,hull:3,inv:0},objects:[],wake:[],score:0,combo:1,gates:0,distance:0,spawn:0,elapsed:0,speed:260};
  sailingRunning=true;sailingStartedAt=performance.now();sailingLast=sailingStartedAt;$('sailingIntro').classList.add('hidden');$('sailingMessage').textContent='Glide fast. Thread every gate. Do not hit the rocks.'; sailingFrame=requestAnimationFrame(sailingLoop);
}
function sailingLoop(now){if(!sailingRunning)return;const dt=Math.min(.035,(now-sailingLast)/1000||0);sailingLast=now;updateSailing(dt,now);drawSailing();if(sailingRunning)sailingFrame=requestAnimationFrame(sailingLoop)}
function updateSailing(dt,now){
 const s=sailingState,b=s.boat,c=$('sailingCanvas');s.elapsed=(now-sailingStartedAt)/1000;s.distance+=s.speed*dt;s.speed=Math.min(430,260+s.elapsed*2.2+s.combo*3);
 let steer=0;if(sailingKeys.has('ArrowLeft')||sailingKeys.has('a'))steer--;if(sailingKeys.has('ArrowRight')||sailingKeys.has('d'))steer++;
 b.vx+=(steer*760-b.vx*4.8)*dt;b.x=Math.max(30,Math.min(c.width-30,b.x+b.vx*dt));b.inv=Math.max(0,b.inv-dt);
 s.spawn-=dt;if(s.spawn<=0){spawnSailingObject();s.spawn=Math.max(.18,.52-s.elapsed*.004)}
 for(const o of s.objects){o.y+=s.speed*dt*(o.speed||1);if(o.type==='whirl')o.x+=Math.sin((s.elapsed+o.phase)*4)*22*dt;}
 for(const o of s.objects){if(o.hit)continue;const dx=Math.abs(o.x-b.x),dy=Math.abs(o.y-b.y);
   if(o.type==='gate'&&!o.scored&&o.y>b.y){o.scored=true;const clean=dx<o.gap/2-12;if(clean){s.gates++;s.combo=Math.min(10,s.combo+1);s.score+=100*s.combo;$('sailingMessage').textContent=`Perfect gate! Combo x${s.combo}`;}else{s.combo=1;}}
   if(['rock','crate','whirl'].includes(o.type)&&dx<(o.r||20)+17&&dy<(o.r||20)+21&&b.inv<=0){o.hit=true;b.hull--;b.inv=1.2;s.combo=1;s.score=Math.max(0,s.score-120);$('sailingDialog').classList.add('shake');setTimeout(()=>$('sailingDialog').classList.remove('shake'),260);if(b.hull<=0)return endSailing(false);}
   if(o.type==='boost'&&dx<27&&dy<30){o.hit=true;s.combo=Math.min(10,s.combo+1);s.score+=180*s.combo;s.speed+=55;$('sailingMessage').textContent='Wind boost!';}
   if(['rock','crate'].includes(o.type)&&!o.near&&o.y>b.y+20&&dx<(o.r||20)+42){o.near=true;s.score+=40*s.combo;}
 }
 s.objects=s.objects.filter(o=>o.y<c.height+70&&!o.hit);
 s.wake.push({x:b.x+(Math.random()-.5)*12,y:b.y+22,life:.5});s.wake.forEach(w=>{w.y+=45*dt;w.life-=dt});s.wake=s.wake.filter(w=>w.life>0);
 const remain=Math.max(0,60-s.elapsed);$('sailingTime').textContent=Math.ceil(remain);$('sailingHull').textContent=b.hull;$('sailingScore').textContent=Math.floor(s.score).toLocaleString('en-GB');$('sailingCombo').textContent='x'+s.combo;
 if(remain<=0)endSailing(true);
}
function spawnSailingObject(){const s=sailingState,c=$('sailingCanvas'),r=Math.random();if(r<.17){const gap=120+Math.random()*55;s.objects.push({type:'gate',x:95+Math.random()*(c.width-190),y:-45,gap,speed:1});}else if(r<.25)s.objects.push({type:'boost',x:40+Math.random()*(c.width-80),y:-30,speed:1.05});else{s.objects.push({type:r<.57?'rock':r<.82?'crate':'whirl',x:35+Math.random()*(c.width-70),y:-35,r:r<.57?19:r<.82?17:25,phase:Math.random()*6,speed:.92+Math.random()*.22});}}
async function endSailing(survived){if(!sailingRunning)return;sailingRunning=false;cancelAnimationFrame(sailingFrame);const s=sailingState;$('sailingIntro').classList.remove('hidden');$('sailingStart').textContent='GLIDE AGAIN';$('sailingMessage').textContent=survived?'Course complete! Saving Sailing XP…':'Your boat sank. Saving partial Sailing XP…';
 const {data,error}=await db.rpc('complete_sailing_run',{p_survived:survived,p_score:Math.floor(s.score),p_gates:s.gates,p_seconds:Math.min(60,Math.floor(s.elapsed))});if(error){console.error(error);$('sailingMessage').textContent='Could not save Sailing XP. Run update-sailing-minigame.sql in Supabase.';return}const r=data?.[0];if(!r)return;character.sailing_xp=Number(r.sailing_xp);renderCharacter();$('sailingMessage').textContent=`${survived?'Gwenith Glide complete!':'Run ended.'} +${r.sailing_gained} Sailing XP. Score ${Math.floor(s.score).toLocaleString('en-GB')}.`;}
function drawSailingBackdrop(ctx,w,h,scroll){ctx.fillStyle='#082838';ctx.fillRect(0,0,w,h);ctx.strokeStyle='#15506a';ctx.lineWidth=2;for(let y=-40+(scroll%50);y<h;y+=50){ctx.beginPath();for(let x=0;x<=w;x+=20)ctx.lineTo(x,y+Math.sin((x+scroll)*.025)*6);ctx.stroke()}ctx.fillStyle='#173b35';ctx.fillRect(0,0,18,h);ctx.fillRect(w-18,0,18,h)}
function drawSailing(){const c=$('sailingCanvas'),ctx=c.getContext('2d'),s=sailingState;drawSailingBackdrop(ctx,c.width,c.height,s.distance);if(!s)return;s.wake.forEach(w=>{ctx.globalAlpha=Math.max(0,w.life*1.5);ctx.fillStyle='#b9efff';ctx.beginPath();ctx.arc(w.x,w.y,4,0,7);ctx.fill()});ctx.globalAlpha=1;s.objects.forEach(o=>drawSailingObject(ctx,o));drawBoat(ctx,s.boat)}
function drawSailingObject(ctx,o){if(o.type==='gate'){ctx.fillStyle='#d8ec65';ctx.fillRect(o.x-o.gap/2-7,o.y-16,14,45);ctx.fillRect(o.x+o.gap/2-7,o.y-16,14,45);ctx.fillStyle='#fff4a3';ctx.fillRect(o.x-o.gap/2-10,o.y-20,20,8);ctx.fillRect(o.x+o.gap/2-10,o.y-20,20,8);return}if(o.type==='boost'){ctx.fillStyle='#d8fbff';ctx.beginPath();ctx.moveTo(o.x,o.y-18);ctx.lineTo(o.x+16,o.y+12);ctx.lineTo(o.x,o.y+5);ctx.lineTo(o.x-16,o.y+12);ctx.closePath();ctx.fill();return}if(o.type==='rock'){ctx.fillStyle='#4d5354';ctx.beginPath();ctx.arc(o.x,o.y,o.r,0,7);ctx.fill();ctx.fillStyle='#747b78';ctx.fillRect(o.x-8,o.y-11,8,6);return}if(o.type==='crate'){ctx.fillStyle='#704b28';ctx.fillRect(o.x-17,o.y-17,34,34);ctx.strokeStyle='#b58a51';ctx.strokeRect(o.x-14,o.y-14,28,28);ctx.beginPath();ctx.moveTo(o.x-14,o.y-14);ctx.lineTo(o.x+14,o.y+14);ctx.moveTo(o.x+14,o.y-14);ctx.lineTo(o.x-14,o.y+14);ctx.stroke();return}ctx.strokeStyle='#713f90';ctx.lineWidth=6;for(let r=5;r<o.r;r+=7){ctx.beginPath();ctx.arc(o.x,o.y,r,0,Math.PI*1.55);ctx.stroke()}}
function drawBoat(ctx,b){ctx.save();ctx.translate(b.x,b.y);ctx.rotate(Math.max(-.35,Math.min(.35,b.vx/900)));if(b.inv>0&&Math.floor(b.inv*12)%2===0)ctx.globalAlpha=.35;ctx.fillStyle='#72441f';ctx.beginPath();ctx.moveTo(0,-28);ctx.lineTo(20,18);ctx.lineTo(0,28);ctx.lineTo(-20,18);ctx.closePath();ctx.fill();ctx.fillStyle='#d9c49a';ctx.fillRect(-2,-24,4,34);ctx.fillStyle='#e9e2c5';ctx.beginPath();ctx.moveTo(2,-20);ctx.lineTo(2,5);ctx.lineTo(22,1);ctx.closePath();ctx.fill();ctx.fillStyle='#b62026';ctx.fillRect(-12,10,24,7);ctx.restore()}

function drawCombat(){const c=$('combatCanvas'),ctx=c.getContext('2d'),s=combatState;drawCombatBackdrop(ctx,c.width,c.height);if(!s)return;s.orbs.forEach(o=>{ctx.fillStyle='#74d7ff';ctx.beginPath();ctx.arc(o.x,o.y,6,0,7);ctx.fill()});s.enemies.forEach(e=>drawCombatEnemy(ctx,e));drawCombatPlayer(ctx,s.player);s.slashes.forEach(a=>{ctx.strokeStyle='#fff2a0';ctx.lineWidth=5;ctx.beginPath();ctx.arc(a.x,a.y,25,-1.2,.7);ctx.stroke()});s.particles.forEach(p=>{ctx.fillStyle='#fff0a4';ctx.font='bold 14px Arial';ctx.fillText(p.text,p.x,p.y)})}
function drawCombatPlayer(ctx,p){ctx.save();ctx.translate(p.x,p.y);ctx.fillStyle='#9a6b3d';ctx.fillRect(-9,-18,18,10);ctx.fillStyle='#d0a179';ctx.fillRect(-7,-10,14,12);ctx.fillStyle='#506f9b';ctx.fillRect(-10,2,20,19);ctx.fillStyle='#c8c8c8';ctx.fillRect(8,-2,24,5);ctx.fillStyle='#8c633a';ctx.fillRect(5,2,8,4);ctx.restore()}
function drawCombatEnemy(ctx,e){ctx.save();ctx.translate(e.x,e.y);if(e.type==='goblin'){ctx.fillStyle='#789447';ctx.fillRect(-10,-13,20,22);ctx.fillStyle='#4d632f';ctx.fillRect(-13,-9,5,8);ctx.fillRect(8,-9,5,8)}else if(e.type==='cow'){ctx.fillStyle='#eee8da';ctx.fillRect(-18,-10,36,22);ctx.fillStyle='#5e4637';ctx.fillRect(-14,-8,9,8);ctx.fillRect(5,1,10,8);ctx.fillStyle='#eee8da';ctx.fillRect(14,-6,12,12)}else{ctx.fillStyle='#d7d1b7';ctx.beginPath();ctx.arc(0,-8,9,0,7);ctx.fill();ctx.fillRect(-4,0,8,20);ctx.strokeStyle='#d7d1b7';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-3,5);ctx.lineTo(-13,14);ctx.moveTo(3,5);ctx.lineTo(13,14);ctx.stroke()}ctx.fillStyle='#360b0b';ctx.fillRect(-14,-e.r-8,28,4);ctx.fillStyle='#b52b35';ctx.fillRect(-14,-e.r-8,28*Math.max(0,e.hp/e.maxHp),4);ctx.restore()}

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
    ['Sailing', 'assets/sailing-icon.webp', row.sailing_xp]
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
$('combatStart').onclick = startCombatGame;
$('openSailing').onclick = openSailingGame;
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

window.addEventListener('keydown',e=>{const k=e.key.length===1?e.key.toLowerCase():e.key;if(sailingRunning&&['ArrowLeft','ArrowRight','a','d'].includes(k)){e.preventDefault();sailingKeys.add(k)}});window.addEventListener('keyup',e=>sailingKeys.delete(e.key.length===1?e.key.toLowerCase():e.key));document.querySelectorAll('[data-sail]').forEach(b=>{const k=b.dataset.sail==='left'?'ArrowLeft':'ArrowRight';const on=e=>{e.preventDefault();sailingKeys.add(k)},off=()=>sailingKeys.delete(k);b.addEventListener('pointerdown',on);b.addEventListener('pointerup',off);b.addEventListener('pointercancel',off);b.addEventListener('pointerleave',off)});
