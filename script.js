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

function playClickSound() {
  try { clickSound.currentTime = 0; clickSound.play().catch(() => {}); } catch (_) {}
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
  if (!hasCharacter) {
    $('createCharacter').textContent = 'LOG IN / CREATE ACCOUNT';
    return;
  }

  const total = levelFromXp(character.woodcutting_xp) + levelFromXp(character.mining_xp) + levelFromXp(character.fishing_xp);
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

function scheduleSpawn(first = false) {
  clearTimeout(spawnTimer);
  if (!character || currentResource) return;
  // Normally 3–8 minutes. The first event is a little quicker so visitors see the feature.
  const delay = first ? 25000 + Math.random() * 35000 : 180000 + Math.random() * 300000;
  spawnTimer = setTimeout(spawnResource, delay);
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
  if (result.drop_name) message += ` — Rare drop: ${result.drop_name}!`;
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

  const unlocked = new Set(character.collection || []);
  $('collectionGrid').innerHTML = COLLECTIBLES.map(([id, label]) => `<div class="collectible ${unlocked.has(id) ? 'found' : ''}"><span>${unlocked.has(id) ? '◆' : '?'}</span>${label}</div>`).join('');
  $('skillsDialog').showModal();
}

async function openLeaderboard() {
  $('leaderboard').textContent = 'Loading...';
  $('leaderboardDialog').showModal();
  const { data, error } = await db.rpc('get_leaderboard');
  if (error) {
    $('leaderboard').textContent = 'Leaderboard unavailable until the updated SQL setup has been run.';
    return;
  }
  if (!data?.length) {
    $('leaderboard').textContent = 'No characters yet.';
    return;
  }
  $('leaderboard').innerHTML = data.map((row, index) => `<div><b>${index + 1}</b><span>${escapeHtml(row.username)}</span><strong>${row.total_level}</strong></div>`).join('');
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
    scheduleSpawn(true);
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
  button.onclick = () => $(button.dataset.close).close();
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
