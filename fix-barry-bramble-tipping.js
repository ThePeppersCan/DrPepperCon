/* Repo Company — Barry Bramble tipping button repair
   Load this AFTER the main script.js, or append it to the end of script.js. */
(function repoBarryBrambleTipRepair(){
  'use strict';

  const COST = 200;
  const TIP_FRAMES = [
    'assets/commentator-tip-1.png','assets/commentator-tip-2.png',
    'assets/commentator-tip-3.png','assets/commentator-tip-4.png',
    'assets/commentator-tip-5.png','assets/commentator-tip-6.png',
    'assets/commentator-tip-7.png','assets/commentator-tip-8.png'
  ];

  let busy = false;
  let knownMatchId = null;
  let tippedMatchId = null;
  let checkingMatchId = null;
  let restoringButton = false;

  const getButton = () => document.getElementById('qmThrowCoin');
  const getSprite = () => document.getElementById('qmCommentatorSprite');
  const getStudio = () => document.getElementById('qmCommentatorStudio');
  const notify = (message, duration) => {
    if (typeof toast === 'function') toast(message, duration);
    else console.info(message);
  };

  function currentMatchId(){
    const candidates = [
      typeof qmState !== 'undefined' && qmState?.liveState?.match_id,
      typeof qmState !== 'undefined' && qmState?.liveMatchId
    ];
    for (const value of candidates){
      const id = Number(value);
      if (Number.isFinite(id) && id > 0) return id;
    }
    return null;
  }

  function setButtonState(){
    const button = getButton();
    if (!button) return;
    const matchId = currentMatchId();
    const used = Boolean(matchId && tippedMatchId === matchId);
    const shouldDisable = busy || used;

    restoringButton = true;
    button.disabled = shouldDisable;
    button.classList.toggle('is-used', used);
    const label = button.querySelector('b');
    if (label) label.textContent = used ? 'TIP SENT' : (busy ? 'THROWING…' : 'THROW');
    button.title = used
      ? 'You have already tipped Barry Bramble this match.'
      : 'Throw 200 GP to Barry Bramble';
    restoringButton = false;
  }

  function renderLifetimeTips(value){
    const total = Math.max(0, Number(value) || 0);
    const target = 250000;
    const progress = Math.min(1, total / target);
    const percent = Math.floor(progress * 100);

    const totalNode = document.getElementById('qmTotalTipsValue');
    if (totalNode) totalNode.textContent = `${total.toLocaleString()} GP`;
    const fill = document.getElementById('qmTipGoalFill');
    if (fill) fill.style.height = `${percent}%`;
    const pct = document.getElementById('qmTipGoalPercent');
    if (pct) pct.textContent = progress >= 1 ? 'UNLOCKED' : `${percent}%`;
    const status = document.getElementById('qmTipGoalStatus');
    if (status) status.textContent = progress >= 1
      ? "Barry's Boater unlocked!"
      : `${total.toLocaleString()} / 250,000 GP`;
    document.getElementById('qmTipGoal')?.classList.toggle('is-unlocked', progress >= 1);
  }

  async function animateTip(){
    const studio = getStudio();
    const sprite = getSprite();
    if (!studio || !sprite) return;

    studio.classList.remove('is-speaking','is-goal','is-tipped');
    void studio.offsetWidth;
    studio.classList.add('is-tipped');
    const holds = [300,300,350,350,330,330,390,390];
    for (let index = 0; index < TIP_FRAMES.length; index += 1){
      sprite.src = TIP_FRAMES[index];
      await new Promise(resolve => setTimeout(resolve, holds[index]));
    }
    setTimeout(() => {
      sprite.src = 'assets/commentator-22.png';
      studio.classList.remove('is-tipped');
    }, 350);
  }

  function playTipSound(){
    try{
      const sound = new Audio('assets/commentator-tip-sound.mp3');
      sound.volume = .3;
      sound.play().catch(() => {});
    }catch(_){ }
  }

  async function refreshTipStatus(force){
    if (typeof db === 'undefined' || typeof character === 'undefined' || !character) return;
    const matchId = currentMatchId();
    if (!matchId) return;

    if (matchId !== knownMatchId){
      knownMatchId = matchId;
      tippedMatchId = null;
      checkingMatchId = null;
    }
    if (!force && checkingMatchId === matchId) return;
    checkingMatchId = matchId;

    try{
      const result = await db.rpc('has_tipped_quidditch_commentator', {p_match_id: matchId});
      if (!result.error && result.data === true) tippedMatchId = matchId;
    }catch(_){ }
    finally{
      if (checkingMatchId === matchId) checkingMatchId = null;
      setButtonState();
    }
  }

  async function throwTip(event){
    const target = event.target?.closest?.('#qmThrowCoin');
    if (!target) return;

    // This capture listener deliberately owns the action so an old/stale
    // target listener cannot submit a second tip or leave the button disabled.
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    if (busy) return;
    if (typeof character === 'undefined' || !character){
      notify('Sign in before throwing coins to Barry Bramble.');
      return;
    }

    const matchId = currentMatchId();
    if (!matchId){
      notify('The live match is still loading. Try again in a moment.');
      return;
    }
    if (tippedMatchId === matchId){
      notify('You have already tipped Barry Bramble this match.');
      setButtonState();
      return;
    }
    if ((Number(character.gp) || 0) < COST){
      notify(`You need ${COST} GP to throw coins.`);
      return;
    }
    if (typeof db === 'undefined'){
      notify('The database connection is not ready. Try again in a moment.');
      return;
    }

    busy = true;
    setButtonState();
    try{
      const result = await db.rpc('tip_quidditch_commentator', {p_match_id: matchId});
      if (result.error) throw result.error;

      const row = Array.isArray(result.data) ? result.data[0] : result.data;
      if (row?.remaining_gp != null) character.gp = Number(row.remaining_gp) || 0;
      if (row?.lifetime_tip_gp != null) renderLifetimeTips(row.lifetime_tip_gp);
      tippedMatchId = matchId;
      if (typeof renderCharacter === 'function') renderCharacter();
      setButtonState();
      playTipSound();
      animateTip();
      notify('You tipped Barry Bramble. He seems delighted.', 3500);
    }catch(error){
      const message = String(error?.message || '');
      if (/already tipped/i.test(message)){
        tippedMatchId = matchId;
        notify('You have already tipped Barry Bramble this match.');
      }else{
        console.error('Barry Bramble tip failed:', error);
        notify(message || 'Barry missed the coins. Please try again.');
      }
    }finally{
      busy = false;
      setButtonState();
    }
  }

  function initialise(){
    // Capture phase means this continues working even if the button is rebuilt.
    document.addEventListener('click', throwTip, true);

    const watchButton = () => {
      const button = getButton();
      if (!button || button.dataset.barryTipRepairObserved === '1') return;
      button.dataset.barryTipRepairObserved = '1';
      new MutationObserver(() => {
        if (!restoringButton) setButtonState();
      }).observe(button, {attributes:true, attributeFilter:['disabled','class','title']});
    };

    watchButton();
    refreshTipStatus(true);
    setInterval(() => {
      watchButton();
      const matchId = currentMatchId();
      if (matchId !== knownMatchId) refreshTipStatus(true);
      setButtonState();
    }, 400);
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', initialise, {once:true});
  }else{
    initialise();
  }
})();
