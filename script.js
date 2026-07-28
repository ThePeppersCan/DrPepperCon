const SUPABASE_URL = 'https://hvdrwmjjieguurxvrgzfu.supabase.co';
const SUPABASE_KEY = 'sb_publishable_bln84LaJ8iYmnkYK9mh0Pg_XxP7O1OZ';
const MAX = 25000;
const $ = (id) => document.getElementById(id);

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let count = 0;
let busy = false;

function level(v) {
  if (v < 1000) return ['BEGINNER', 'The con has only just begun.'];
  if (v < 5000) return ['COMFORTABLE', 'The chair is starting to notice.'];
  if (v < 10000) return ['THICC', 'Serious Dr Pepper commitment detected.'];
  if (v < 18000) return ['ABSOLUTE UNIT', 'RuneScape gains. Real-world gains.'];
  if (v < MAX) return ['CHAIR DESTROYER', 'Maximum Con is getting dangerously close.'];
  return ['MAXIMUM CON', 'The final form has been achieved.'];
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

async function loadCount() {
  const { data, error } = await db
    .from('counter')
    .select('count')
    .eq('id', 1)
    .single();

  if (error) {
    showError('Could not connect to the shared counter.', error);
    return;
  }

  count = Number(data.count) || 0;
  render();
}

async function changeCount(amount) {
  if (busy) return;
  busy = true;

  const { data, error } = await db.rpc('change_counter', { amount });
  busy = false;

  if (error) {
    showError('The can could not be counted. Check Supabase setup.', error);
    return;
  }

  count = Number(data) || 0;
  render();
}

async function resetCount() {
  const { data, error } = await db.rpc('reset_counter');

  if (error) {
    showError('The counter could not be reset.', error);
    return;
  }

  count = Number(data) || 0;
  render();
}

$('can').onclick = async () => {
  $('can').classList.remove('pop');
  void $('can').offsetWidth;
  $('can').classList.add('pop');
  await changeCount(1);
};

$('undo').onclick = () => changeCount(-1);
$('reset').onclick = () => $('dialog').showModal();
$('confirm').onclick = () => resetCount();

// Update automatically when either person changes the counter.
db.channel('counter-live')
  .on(
    'postgres_changes',
    { event: 'UPDATE', schema: 'public', table: 'counter', filter: 'id=eq.1' },
    (payload) => {
      count = Number(payload.new.count) || 0;
      render();
    }
  )
  .subscribe();

if (SUPABASE_KEY.includes('PASTE_YOUR')) {
  $('status').textContent = 'Paste your Supabase publishable key into script.js.';
} else {
  loadCount();
}
