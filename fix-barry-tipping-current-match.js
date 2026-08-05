/*
 * Repo Company — Barry Bramble tipping compatibility repair
 * Load this AFTER the main script.js.
 *
 * Why it exists:
 * The authoritative Quidditch clock can now run longer than the original
 * fixed 235-second match slot (for sudden death). Older versions of the
 * tip_quidditch_commentator RPC validate against that legacy slot, so a valid
 * displayed match can be rejected as "ended". This override tries both IDs.
 */
(function repoBarryTippingCurrentMatchRepair() {
  'use strict';

  const TIP_COST = 200;
  const LEGACY_MATCH_MS = 235000;
  const TIP_FRAMES = [
    'assets/commentator-tip-1.png',
    'assets/commentator-tip-2.png',
    'assets/commentator-tip-3.png',
    'assets/commentator-tip-4.png',
    'assets/commentator-tip-5.png',
    'assets/commentator-tip-6.png',
    'assets/commentator-tip-7.png',
    'assets/commentator-tip-8.png'
  ];

  let busy = false;
  let acceptedMatchId = null;
  let acceptedDisplayMatchId = null;

  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const getButton = () => document.getElementById('qmThrowCoin');
  const getSprite = () => document.getElementById('qmCommentatorSprite');
  const getStudio = () => document.getElementById('qmCommentatorStudio');

  function notify(message, duration = 4200) {
    try {
      if (typeof toast === 'function') {
        toast(message, duration);
        return;
      }
    } catch (_) {}
    console.info(message);
  }

  function displayedMatchId() {
    try {
      const value = Number(qmState?.liveState?.match_id || qmState?.liveMatchId || 0);
      return Number.isSafeInteger(value) && value > 0 ? value : null;
    } catch (_) {
      return null;
    }
  }

  function legacyCurrentMatchId() {
    return Math.floor(Date.now() / LEGACY_MATCH_MS);
  }

  function candidateMatchIds(extraId = null) {
    const ids = [extraId, displayedMatchId(), legacyCurrentMatchId()]
      .map(Number)
      .filter(value => Number.isSafeInteger(value) && value > 0);
    return [...new Set(ids)];
  }

  function setButtonState({loading = false, used = false} = {}) {
    const button = getButton();
    if (!button) return;
    button.disabled = Boolean(loading || used);
    button.classList.toggle('is-used', used);
    const label = button.querySelector('b');
    if (label) label.textContent = loading ? 'THROWING…' : used ? 'TIP SENT' : 'THROW';
    button.title = used
      ? 'You have already tipped Barry during this match.'
      : 'Throw 200 GP to Barry Bramble';
  }

  function renderLifetimeTotal(value) {
    const total = Math.max(0, Number(value) || 0);
    const valueElement = document.getElementById('qmTotalTipsValue');
    if (valueElement) valueElement.textContent = `${total.toLocaleString()} GP`;

    const target = 250000;
    const progress = Math.min(1, total / target);
    const percent = Math.floor(progress * 100);
    const fill = document.getElementById('qmTipGoalFill');
    const percentage = document.getElementById('qmTipGoalPercent');
    const status = document.getElementById('qmTipGoalStatus');
    const goal = document.getElementById('qmTipGoal');
    if (fill) fill.style.height = `${percent}%`;
    if (percentage) percentage.textContent = progress >= 1 ? 'UNLOCKED' : `${percent}%`;
    if (status) status.textContent = progress >= 1
      ? "Barry's Boater unlocked!"
      : `${total.toLocaleString()} / 250,000 GP`;
    goal?.classList.toggle('is-unlocked', progress >= 1);
  }

  async function playAnimation() {
    const studio = getStudio();
    const sprite = getSprite();
    if (!sprite) return;

    studio?.classList.remove('is-speaking', 'is-goal', 'is-tipped');
    void studio?.offsetWidth;
    studio?.classList.add('is-tipped');

    try {
      const sound = new Audio('assets/commentator-tip-sound.mp3');
      sound.volume = 0.3;
      await sound.play().catch(() => {});
    } catch (_) {}

    const holds = [300, 300, 350, 350, 330, 330, 390, 390];
    for (let index = 0; index < TIP_FRAMES.length; index += 1) {
      if (!sprite.isConnected) break;
      sprite.src = TIP_FRAMES[index];
      await wait(holds[index]);
    }

    if (sprite.isConnected) sprite.src = 'assets/commentator-22.png';
    studio?.classList.remove('is-tipped');
  }

  async function fetchFreshDisplayedMatchId() {
    try {
      if (typeof db === 'undefined' || !db?.rpc) return null;
      let viewerKey = sessionStorage.getItem('repo-qm-viewer');
      if (!viewerKey) {
        viewerKey = `barry-tip-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        sessionStorage.setItem('repo-qm-viewer', viewerKey);
      }
      const result = await db.rpc('get_live_quidditch_state', {p_viewer_key: viewerKey});
      if (result.error) return null;
      const state = Array.isArray(result.data) ? result.data[0] : result.data;
      const id = Number(state?.match_id || 0);
      return Number.isSafeInteger(id) && id > 0 ? id : null;
    } catch (_) {
      return null;
    }
  }

  async function tryTipWithId(matchId) {
    const result = await db.rpc('tip_quidditch_commentator', {p_match_id: matchId});
    if (result.error) throw result.error;
    return Array.isArray(result.data) ? result.data[0] : result.data;
  }

  async function submitTip() {
    if (busy) return;

    const displayId = displayedMatchId();
    if (displayId && acceptedDisplayMatchId === displayId) {
      setButtonState({used: true});
      notify('You have already tipped Barry Bramble during this match.');
      return;
    }

    try {
      if (typeof character === 'undefined' || !character) {
        notify('Sign in before throwing coins to Barry Bramble.');
        return;
      }
      if ((Number(character.gp) || 0) < TIP_COST) {
        notify('You need 200 GP to tip Barry Bramble.');
        return;
      }
      if (typeof db === 'undefined' || !db?.rpc) {
        notify('The tipping service is unavailable. Refresh the page and try again.');
        return;
      }
    } catch (_) {
      notify('The tipping service is unavailable. Refresh the page and try again.');
      return;
    }

    busy = true;
    setButtonState({loading: true});

    let lastError = null;
    let row = null;
    let successfulId = null;

    try {
      const freshId = await fetchFreshDisplayedMatchId();
      const ids = candidateMatchIds(freshId);

      for (const matchId of ids) {
        try {
          row = await tryTipWithId(matchId);
          successfulId = matchId;
          break;
        } catch (error) {
          lastError = error;
          const message = String(error?.message || '');

          if (/already tipped/i.test(message)) {
            acceptedMatchId = matchId;
            acceptedDisplayMatchId = displayedMatchId();
            setButtonState({used: true});
            notify('You have already tipped Barry Bramble during this match.');
            return;
          }

          // Only an ended/stale-match error should fall through to the next ID.
          if (!/match has ended|current match|ended match/i.test(message)) throw error;
        }
      }

      if (!successfulId) throw lastError || new Error('Barry could not receive the tip.');

      acceptedMatchId = successfulId;
      acceptedDisplayMatchId = displayedMatchId();

      if (row && typeof character !== 'undefined' && character) {
        if (row.remaining_gp != null) character.gp = Number(row.remaining_gp) || 0;
        if (row.lifetime_tip_gp != null) renderLifetimeTotal(row.lifetime_tip_gp);
      }

      try {
        if (typeof renderCharacter === 'function') renderCharacter();
      } catch (_) {}

      setButtonState({used: true});
      await playAnimation();
      notify('You tipped Barry Bramble. He seems delighted.', 3500);
    } catch (error) {
      const message = String(error?.message || '');
      console.warn('Barry Bramble tip repair:', error);
      setButtonState({used: false});
      notify(message || 'Barry could not receive the coins.');
    } finally {
      busy = false;
      const currentDisplayId = displayedMatchId();
      setButtonState({used: Boolean(currentDisplayId && currentDisplayId === acceptedDisplayMatchId)});
    }
  }

  // Capture phase prevents the older main-script handler from submitting the
  // stale ID as a second request. No observer or DOM rewrite is used.
  document.addEventListener('click', event => {
    const target = event.target instanceof Element
      ? event.target.closest('#qmThrowCoin')
      : null;
    if (!target) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    submitTip();
  }, true);

  // Release the local once-per-match state as soon as the displayed match changes.
  setInterval(() => {
    const current = displayedMatchId();
    if (acceptedDisplayMatchId && current && current !== acceptedDisplayMatchId) {
      acceptedDisplayMatchId = null;
      acceptedMatchId = null;
      setButtonState({used: false});
    }
  }, 1000);
})();
