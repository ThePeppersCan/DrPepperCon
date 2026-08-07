const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));

export function createPolishDirector({dialog,root,shell,fx,getSettings=()=>({}),logger=console}={}){
  let ctx=null,buses=null,crowd=null,music=null,intensity=0,observer=null,lastScreen=null,lastCinematicAt=0,tiltFrame=null,pendingTilt=null;
  const reduced=()=>Boolean(getSettings()?.reducedMotion)||globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  const audioEnabled=()=>getSettings()?.audio!==false;
  const shakeEnabled=()=>getSettings()?.screenShake!==false&&!reduced();

  function ensureAudio(){
    if(!audioEnabled())return null;
    try{
      if(!ctx){
        const C=globalThis.AudioContext||globalThis.webkitAudioContext;if(!C)return null;ctx=new C();
        const master=ctx.createGain(),musicBus=ctx.createGain(),crowdBus=ctx.createGain(),fxBus=ctx.createGain(),uiBus=ctx.createGain();
        master.gain.value=.82;musicBus.gain.value=.0001;crowdBus.gain.value=.0001;fxBus.gain.value=.82;uiBus.gain.value=.55;
        musicBus.connect(master);crowdBus.connect(master);fxBus.connect(master);uiBus.connect(master);master.connect(ctx.destination);
        buses={master,music:musicBus,crowd:crowdBus,fx:fxBus,ui:uiBus};
      }
      if(ctx.state==='suspended')ctx.resume().catch(()=>{});
      return ctx;
    }catch(error){logger?.warn?.('[QD:POLISH] audio unavailable',error);return null;}
  }
  function envelope(gain,when,attack,hold,release,peak){
    gain.cancelScheduledValues(when);gain.setValueAtTime(.0001,when);gain.exponentialRampToValueAtTime(Math.max(.0002,peak),when+attack);gain.setValueAtTime(Math.max(.0002,peak),when+attack+hold);gain.exponentialRampToValueAtTime(.0001,when+attack+hold+release);
  }
  function note(freq,{dur=.09,type='triangle',vol=.035,delay=0,bus='fx',detune=0}={}){
    const c=ensureAudio();if(!c||!buses)return;const when=c.currentTime+delay,o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.value=Math.max(30,freq);o.detune.value=detune;envelope(g.gain,when,.008,Math.max(.005,dur*.18),Math.max(.025,dur*.74),vol);o.connect(g).connect(buses[bus]||buses.fx);o.start(when);o.stop(when+dur+.08);
  }
  function noiseHit({dur=.11,vol=.025,delay=0,highpass=900,lowpass=6000,bus='fx'}={}){
    const c=ensureAudio();if(!c||!buses)return;const frames=Math.max(256,Math.floor(c.sampleRate*dur)),buf=c.createBuffer(1,frames,c.sampleRate),data=buf.getChannelData(0);for(let i=0;i<frames;i++)data[i]=(Math.random()*2-1)*(1-i/frames);const src=c.createBufferSource(),hp=c.createBiquadFilter(),lp=c.createBiquadFilter(),g=c.createGain();hp.type='highpass';hp.frequency.value=highpass;lp.type='lowpass';lp.frequency.value=lowpass;const when=c.currentTime+delay;envelope(g.gain,when,.004,.008,Math.max(.02,dur-.012),vol);src.buffer=buf;src.connect(hp).connect(lp).connect(g).connect(buses[bus]||buses.fx);src.start(when);src.stop(when+dur+.03);
  }
  function sfx(kind='ui',{rarity='Starter',flow=1}={}){
    if(!audioEnabled())return;
    const r=String(rarity||'').toLowerCase();
    if(kind==='ui'){note(300,{dur:.045,type:'square',vol:.012,bus:'ui'});note(455,{dur:.04,vol:.01,delay:.018,bus:'ui'});}
    else if(kind==='card'){
      noiseHit({dur:.075,vol:.015,highpass:1100});note(180,{dur:.07,type:'square',vol:.018});note(315,{dur:.09,type:'triangle',vol:.022,delay:.025});
      if(r==='rare'){note(510,{dur:.14,vol:.022,delay:.055});note(760,{dur:.16,vol:.018,delay:.09});}
    }else if(kind==='combo'){
      const tier=clamp(Math.floor((Number(flow)||1)*2),2,10);note(330+tier*24,{dur:.11,vol:.026});note(495+tier*32,{dur:.14,vol:.023,delay:.035});noiseHit({dur:.09,vol:.012,highpass:1500});
    }else if(kind==='goal'){
      noiseHit({dur:.2,vol:.038,highpass:300,lowpass:5200});[294,392,494,659].forEach((f,i)=>note(f,{dur:.22,type:i%2?'triangle':'sawtooth',vol:.026,delay:i*.045}));crowdBurst(.018,.9);
    }else if(kind==='snitch'){
      [880,1175,1568,2093].forEach((f,i)=>note(f,{dur:.18,type:'sine',vol:.021,delay:i*.035}));noiseHit({dur:.18,vol:.018,highpass:2400});crowdBurst(.024,1.25);
    }else if(kind==='bad'){note(155,{dur:.18,type:'sawtooth',vol:.021});noiseHit({dur:.12,vol:.012,highpass:180});}
    else if(kind==='win'){[262,330,392,523,659,784].forEach((f,i)=>note(f,{dur:.28,type:'triangle',vol:.026,delay:i*.055}));crowdBurst(.03,1.8);}
    else if(kind==='whistle'){note(1760,{dur:.18,type:'sine',vol:.02});note(2090,{dur:.16,type:'sine',vol:.018,delay:.03});noiseHit({dur:.11,vol:.012,highpass:2500});}
    else note(280,{dur:.05,type:'square',vol:.014,bus:'ui'});
  }

  function makeCrowd(){
    const c=ensureAudio();if(!c||crowd)return;
    const seconds=3,buf=c.createBuffer(2,Math.floor(c.sampleRate*seconds),c.sampleRate);
    for(let ch=0;ch<2;ch++){const d=buf.getChannelData(ch);let smooth=0;for(let i=0;i<d.length;i++){smooth=smooth*.985+(Math.random()*2-1)*.015;d[i]=smooth*(.55+.25*Math.sin(i/(1300+ch*270)));}}
    const src=c.createBufferSource(),lp=c.createBiquadFilter(),hp=c.createBiquadFilter();lp.type='lowpass';lp.frequency.value=1250;hp.type='highpass';hp.frequency.value=85;src.buffer=buf;src.loop=true;src.connect(hp).connect(lp).connect(buses.crowd);src.start();crowd={src,lp};
  }
  function makeMusic(){
    const c=ensureAudio();if(!c||music)return;const drone=c.createOscillator(),fifth=c.createOscillator(),g=c.createGain(),filter=c.createBiquadFilter();drone.type='triangle';fifth.type='sine';drone.frequency.value=55;fifth.frequency.value=82.5;g.gain.value=.24;filter.type='lowpass';filter.frequency.value=520;drone.connect(g);fifth.connect(g);g.connect(filter).connect(buses.music);drone.start();fifth.start();music={drone,fifth,filter,g};
  }
  function startMatch(){if(!audioEnabled())return;makeCrowd();makeMusic();setIntensity({flow:1,possession:1,maxPossessions:5,lead:0});}
  function stopMatch(){
    if(ctx&&buses){const t=ctx.currentTime;buses.crowd.gain.setTargetAtTime(.0001,t,.18);buses.music.gain.setTargetAtTime(.0001,t,.2);}try{crowd?.src?.stop(ctx?.currentTime+.6);}catch{}try{music?.drone?.stop(ctx?.currentTime+.7);music?.fifth?.stop(ctx?.currentTime+.7);}catch{}crowd=null;music=null;intensity=0;
  }
  function setIntensity({flow=1,possession=1,maxPossessions=5,lead=0,snitch=0,threshold=85}={}){
    const c=ensureAudio();if(!c||!buses)return;makeCrowd();makeMusic();const phase=(Math.max(1,possession)-1)/Math.max(1,maxPossessions-1),close=1-clamp(Math.abs(Number(lead)||0)/220,0,1),combo=clamp((Number(flow)||1)-1,0,2)/2,snitchHeat=clamp((Number(snitch)||0)/Math.max(1,Number(threshold)||85),0,1);intensity=clamp(.12+phase*.33+close*.22+combo*.24+snitchHeat*.18,0,1);const t=c.currentTime;buses.crowd.gain.setTargetAtTime(.004+intensity*.017,t,.18);buses.music.gain.setTargetAtTime(.0015+intensity*.006,t,.24);if(music){music.filter.frequency.setTargetAtTime(420+intensity*880,t,.2);music.drone.detune.setTargetAtTime(intensity*5,t,.3);music.fifth.detune.setTargetAtTime(-intensity*3,t,.3);}shell?.style?.setProperty('--qd-intensity',String(intensity));if(shell)shell.dataset.qdIntensity=intensity>.72?'high':intensity>.4?'medium':'low';shell?.classList.toggle('qd-final-moments',phase>.82||snitchHeat>.82);
  }
  function crowdBurst(amount=.015,duration=.8){const c=ensureAudio();if(!c||!buses)return;makeCrowd();const t=c.currentTime,current=.004+intensity*.017;buses.crowd.gain.cancelScheduledValues(t);buses.crowd.gain.setValueAtTime(current,t);buses.crowd.gain.linearRampToValueAtTime(current+amount,t+.08);buses.crowd.gain.exponentialRampToValueAtTime(Math.max(.0002,current),t+duration);}

  function addRipple(target,event){if(reduced()||!target)return;const r=target.getBoundingClientRect(),dot=document.createElement('i');dot.className='qd-button-ripple';const x=(event?.clientX??r.left+r.width/2)-r.left,y=(event?.clientY??r.top+r.height/2)-r.top;dot.style.left=`${x}px`;dot.style.top=`${y}px`;target.appendChild(dot);setTimeout(()=>dot.remove(),650);}
  function decorateCards(){
    const cards=[...root.querySelectorAll('.qd-hand .qd-card')],mid=(cards.length-1)/2;
    cards.forEach((card,i)=>{card.style.setProperty('--qd-card-index',i);card.style.setProperty('--qd-deal-delay',`${Math.min(180,i*38)}ms`);card.style.setProperty('--qd-fan-rot',`${(i-mid)*1.4}deg`);card.style.setProperty('--qd-fan-y',`${Math.abs(i-mid)*1.4}px`);card.classList.add('qd-deal-in');});
    root.querySelectorAll('.qd-reward-card,.qd-relic-choice,.qd-library-entry,.qd-fixture,.qd-mini-card').forEach((el,i)=>el.style.setProperty('--qd-stagger',`${Math.min(260,i*28)}ms`));
  }
  function decorate(){requestAnimationFrame(()=>{shell?.classList.toggle('qd-reduced-motion',reduced());decorateCards();const screen=root.firstElementChild;if(screen&&screen!==lastScreen){lastScreen=screen;screen.classList.add('qd-screen-arrive');}});}
  function observe(){if(observer||!root)return;observer=new MutationObserver(decorate);observer.observe(root,{childList:true,subtree:true});decorate();}

  function cardPointerMove(event,card){if(reduced()||event.pointerType==='touch')return;const r=card.getBoundingClientRect(),x=clamp((event.clientX-r.left)/Math.max(1,r.width),0,1),y=clamp((event.clientY-r.top)/Math.max(1,r.height),0,1);card.style.setProperty('--qd-tilt-x',`${(0.5-y)*7}deg`);card.style.setProperty('--qd-tilt-y',`${(x-.5)*9}deg`);card.style.setProperty('--qd-shine-x',`${x*100}%`);card.style.setProperty('--qd-shine-y',`${y*100}%`);}
  function resetCard(card){card?.style?.removeProperty('--qd-tilt-x');card?.style?.removeProperty('--qd-tilt-y');}
  function bindInteractions(){
    root.addEventListener('pointermove',e=>{const card=e.target.closest('.qd-card,.qd-reward-card,.qd-library-entry');if(!card)return;pendingTilt={event:e,card};if(!tiltFrame)tiltFrame=requestAnimationFrame(()=>{tiltFrame=null;const job=pendingTilt;pendingTilt=null;if(job?.card?.isConnected)cardPointerMove(job.event,job.card);});});
    root.addEventListener('pointerout',e=>{const card=e.target.closest('.qd-card,.qd-reward-card,.qd-library-entry');if(card&&!card.contains(e.relatedTarget))resetCard(card);});
    root.addEventListener('pointerdown',e=>{const b=e.target.closest('.qd-btn,.qd-event-option,.qd-lane,.qd-reward-card,.qd-relic-choice');if(b)addRipple(b,e);});
  }

  function shellRect(){return shell?.getBoundingClientRect?.()||{left:0,top:0,width:0,height:0};}
  function cardCommit(cardEl,laneEl,{rarity='Starter',label=''}={}){
    if(!cardEl||!laneEl)return;sfx('card',{rarity});const from=cardEl.getBoundingClientRect(),to=laneEl.getBoundingClientRect(),sr=shellRect();
    if(reduced()){laneImpact(to,'card');return;}
    const ghost=cardEl.cloneNode(true);ghost.removeAttribute('data-select-card');ghost.classList.remove('qd-deal-in','selected','combo-ready','qd-controller-focus');ghost.classList.add('qd-card-ghost');Object.assign(ghost.style,{position:'absolute',left:`${from.left-sr.left}px`,top:`${from.top-sr.top}px`,width:`${from.width}px`,height:`${from.height}px`,margin:'0',zIndex:'95',pointerEvents:'none'});shell.appendChild(ghost);
    const dx=(to.left+to.width/2)-(from.left+from.width/2),dy=(to.top+to.height/2)-(from.top+from.height/2),scale=clamp(Math.min(to.width/from.width,to.height/from.height)*.82,.46,.82);
    if(ghost.animate){ghost.animate([{transform:'translate3d(0,0,0) rotate(0deg) scale(1)',filter:'brightness(1)',opacity:1},{offset:.58,transform:`translate3d(${dx*.62}px,${dy*.62-34}px,0) rotate(-2deg) scale(.9)`,filter:'brightness(1.18)',opacity:1},{transform:`translate3d(${dx}px,${dy}px,0) rotate(0deg) scale(${scale})`,filter:'brightness(1.5)',opacity:.18}],{duration:360,easing:'cubic-bezier(.18,.82,.18,1)',fill:'forwards'}).finished.finally(()=>ghost.remove());}else setTimeout(()=>ghost.remove(),380);
    trail({x1:from.left+from.width/2,y1:from.top+from.height/2,x2:to.left+to.width/2,y2:to.top+to.height/2,kind:String(rarity).toLowerCase()==='rare'?'rare':'card'});setTimeout(()=>laneImpact(to,'card'),230);if(label)setTimeout(()=>floatingAt(to,label,'power'),240);
  }
  function discardHand(){
    if(reduced()||!shell)return;const sr=shellRect(),cards=[...root.querySelectorAll('.qd-hand .qd-card:not(.disabled),.qd-hand .qd-card.disabled')];cards.forEach((card,i)=>{const r=card.getBoundingClientRect(),ghost=card.cloneNode(true);ghost.classList.remove('qd-deal-in','selected','combo-ready','qd-controller-focus');ghost.classList.add('qd-card-ghost','qd-discard-ghost');Object.assign(ghost.style,{position:'absolute',left:`${r.left-sr.left}px`,top:`${r.top-sr.top}px`,width:`${r.width}px`,height:`${r.height}px`,margin:'0',zIndex:String(94-i),pointerEvents:'none'});shell.appendChild(ghost);const dx=(i-(cards.length-1)/2)*20,rot=(i-(cards.length-1)/2)*4;if(ghost.animate){ghost.animate([{transform:'translate3d(0,0,0) rotate(0deg)',opacity:.88},{transform:`translate3d(${dx}px,90px,0) rotate(${rot}deg) scale(.91)`,opacity:0}],{duration:260+i*18,easing:'cubic-bezier(.3,.05,.5,1)',fill:'forwards'}).finished.finally(()=>ghost.remove());}else setTimeout(()=>ghost.remove(),340);});
  }
  function trail({x1,y1,x2,y2,kind='card'}){
    if(reduced()||!shell)return;const sr=shellRect(),dx=x2-x1,dy=y2-y1,len=Math.hypot(dx,dy),angle=Math.atan2(dy,dx)*180/Math.PI,line=document.createElement('i');line.className=`qd-combo-trail ${kind}`;Object.assign(line.style,{left:`${x1-sr.left}px`,top:`${y1-sr.top}px`,width:`${len}px`,transform:`rotate(${angle}deg)`});shell.appendChild(line);setTimeout(()=>line.remove(),520);
  }
  function comboTrail(fromLane,toLane,label='COMBO'){
    if(!fromLane||!toLane)return;const a=fromLane.getBoundingClientRect(),b=toLane.getBoundingClientRect();trail({x1:a.left+a.width/2,y1:a.top+a.height/2,x2:b.left+b.width/2,y2:b.top+b.height/2,kind:'combo'});floatingAt(b,label,'combo');
  }
  function laneImpact(rect,kind='card'){
    if(!shell||reduced())return;const sr=shellRect(),ring=document.createElement('i');ring.className=`qd-impact-ring ${kind}`;ring.style.left=`${rect.left+rect.width/2-sr.left}px`;ring.style.top=`${rect.top+rect.height/2-sr.top}px`;shell.appendChild(ring);setTimeout(()=>ring.remove(),700);
  }
  function floatingAt(rect,text,kind=''){
    if(!shell)return;const sr=shellRect(),el=document.createElement('div');el.className=`qd-polish-float ${kind}`;el.textContent=text;el.style.left=`${rect.left+rect.width/2-sr.left}px`;el.style.top=`${rect.top+rect.height*.38-sr.top}px`;shell.appendChild(el);setTimeout(()=>el.remove(),1050);
  }
  function pulseResource(name){const el=[...root.querySelectorAll('.qd-resource-pips>div')].find(x=>x.querySelector('span')?.textContent?.trim()===name);if(!el)return;el.classList.remove('qd-resource-pulse');void el.offsetWidth;el.classList.add('qd-resource-pulse');setTimeout(()=>el.classList.remove('qd-resource-pulse'),520);}

  function shake(amount='small'){
    if(!shakeEnabled()||!shell)return;const cls=amount==='big'?'qd-camera-big':'qd-camera-small';shell.classList.remove(cls);void shell.offsetWidth;shell.classList.add(cls);setTimeout(()=>shell.classList.remove(cls),amount==='big'?430:220);
  }
  function cinematic(title,subtitle='',kind='big'){
    const now=performance.now();if(now-lastCinematicAt<500&&!['snitch','victory','defeat','mvp'].includes(kind))return;lastCinematicAt=now;if(!shell)return;const el=document.createElement('div');el.className=`qd-cinematic qd-cinematic-${kind}`;el.innerHTML=`<span>${escapeHtml(title)}</span>${subtitle?`<small>${escapeHtml(subtitle)}</small>`:''}`;shell.appendChild(el);if(!reduced())shell.classList.add('qd-time-dilation');setTimeout(()=>shell.classList.remove('qd-time-dilation'),480);setTimeout(()=>el.remove(),kind==='snitch'?1450:1050);if(kind==='snitch')shake('big');else shake('small');
  }
  function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function showKickoff({home='REPO COMPANY',away='OPPONENT',crest='QD',weather='CLEAR',week=1}={}){
    if(!shell)return;sfx('whistle');const el=document.createElement('div');el.className='qd-broadcast-intro';el.innerHTML=`<div class="qd-broadcast-scan"></div><small>REPO SPORTS · LIVE · FIXTURE ${Number(week)||1}</small><div class="qd-broadcast-teams"><strong>${escapeHtml(home)}</strong><i>VS</i><strong>${escapeHtml(away)}</strong></div><span>${escapeHtml(crest)} · ${escapeHtml(weather)}</span>`;shell.appendChild(el);setTimeout(()=>el.classList.add('out'),1450);setTimeout(()=>el.remove(),1850);startMatch();crowdBurst(.01,.8);
  }
  function finalWhistle({won=false,score='',opponent='',mvp=''}={}){
    sfx('whistle');setTimeout(()=>sfx(won?'win':'bad'),170);cinematic('FULL TIME',score,won?'victory':'defeat');if(won){confetti(70);crowdBurst(.035,2);}if(mvp)setTimeout(()=>cinematic('MATCH MVP',mvp,'mvp'),780);
  }
  function confetti(count=60){
    if(reduced()||!shell)return;for(let i=0;i<count;i++){const p=document.createElement('i');p.className='qd-confetti';p.style.left=`${8+Math.random()*84}%`;p.style.setProperty('--qd-confetti-delay',`${Math.random()*.28}s`);p.style.setProperty('--qd-confetti-drift',`${(Math.random()-.5)*180}px`);p.style.setProperty('--qd-confetti-spin',`${(Math.random()>.5?1:-1)*(260+Math.random()*720)}deg`);shell.appendChild(p);setTimeout(()=>p.remove(),2100);}
  }
  function setAudioEnabled(enabled){if(!enabled)stopMatch();else ensureAudio();}
  function vibrate(strength=.25,duration=70){try{const pad=[...(navigator.getGamepads?.()||[])].find(Boolean),act=pad?.vibrationActuator||pad?.hapticActuators?.[0];act?.playEffect?.('dual-rumble',{duration,startDelay:0,strongMagnitude:clamp(strength,0,1),weakMagnitude:clamp(strength*.65,0,1)});}catch{}if(navigator.vibrate&&strength>.45)try{navigator.vibrate(Math.min(90,duration));}catch{}}

  observe();bindInteractions();
  return {ensureAudio,sfx,startMatch,stopMatch,setIntensity,crowdBurst,cardCommit,discardHand,comboTrail,laneImpact,floatingAt,pulseResource,shake,cinematic,showKickoff,finalWhistle,confetti,setAudioEnabled,vibrate,decorate};
}
