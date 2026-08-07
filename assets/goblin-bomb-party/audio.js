(()=>{
  'use strict';
  class GoblinBombAudio {
    constructor(){
      this.ctx=null;this.master=null;this.music=null;this.sfx=null;this.voices=null;this.ambience=null;
      this.settings={master:.7,music:.36,sfx:.72,voices:.55,ambience:.28,mute:false};
      this.musicTimer=null;this.ambienceTimer=null;this.musicStep=0;this.intensity=0;this.active=false;this.voiceCooldown=0;
    }
    configure(s={}){this.settings={...this.settings,...s};this.apply();}
    ensure(){
      if(this.ctx)return true;
      try{
        const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return false;
        this.ctx=new AC();
        this.master=this.ctx.createGain();this.music=this.ctx.createGain();this.sfx=this.ctx.createGain();this.voices=this.ctx.createGain();this.ambience=this.ctx.createGain();
        this.music.connect(this.master);this.sfx.connect(this.master);this.voices.connect(this.master);this.ambience.connect(this.master);this.master.connect(this.ctx.destination);this.apply();return true;
      }catch(_){return false;}
    }
    resume(){if(this.ensure()&&this.ctx.state==='suspended')this.ctx.resume().catch(()=>{});}
    apply(){if(!this.ctx)return;const s=this.settings;this.master.gain.value=s.mute?0:Math.max(0,Math.min(1,s.master));this.music.gain.value=Math.max(0,Math.min(1,s.music));this.sfx.gain.value=Math.max(0,Math.min(1,s.sfx));this.voices.gain.value=Math.max(0,Math.min(1,s.voices));this.ambience.gain.value=Math.max(0,Math.min(1,s.ambience));}
    tone(freq=440,dur=.08,{type='square',gain=.13,dest='sfx',slide=0,delay=0}={}){
      if(!this.ensure())return;const t=this.ctx.currentTime+delay,o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type=type;o.frequency.setValueAtTime(Math.max(30,freq),t);if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(30,freq+slide),t+dur);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.0002,gain),t+.006);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(g);g.connect(this[dest]||this.sfx);o.start(t);o.stop(t+dur+.02);
    }
    noise(dur=.12,{gain=.08,dest='sfx',lowpass=1200,delay=0}={}){
      if(!this.ensure())return;const sr=this.ctx.sampleRate,n=Math.max(1,Math.floor(sr*dur)),buf=this.ctx.createBuffer(1,n,sr),arr=buf.getChannelData(0);for(let i=0;i<n;i++)arr[i]=(Math.random()*2-1)*(1-i/n);const src=this.ctx.createBufferSource(),f=this.ctx.createBiquadFilter(),g=this.ctx.createGain();f.type='lowpass';f.frequency.value=lowpass;g.gain.value=gain;src.buffer=buf;src.connect(f);f.connect(g);g.connect(this[dest]||this.sfx);const t=this.ctx.currentTime+delay;src.start(t);
    }
    ui(){this.resume();this.tone(410,.035,{gain:.04});this.tone(590,.025,{gain:.025,delay:.025});}
    hover(){this.tone(520,.022,{gain:.018});}
    dash(){this.resume();this.noise(.12,{gain:.075,lowpass:1800});this.tone(210,.1,{gain:.055,slide:260,type:'sawtooth'});}
    impact(){this.noise(.09,{gain:.08,lowpass:700});this.tone(92,.09,{gain:.08,type:'triangle',slide:-30});}
    pass(last=false){this.resume();this.tone(last?780:540,.09,{gain:.09,type:'square',slide:last?240:90});this.tone(last?1120:760,.065,{gain:.045,delay:.035});}
    throw(){this.noise(.11,{gain:.05,lowpass:2200});this.tone(240,.11,{gain:.045,slide:260,type:'sawtooth'});}
    pickup(){this.tone(620,.08,{gain:.055,slide:240});this.tone(980,.08,{gain:.035,delay:.05});}
    tick(seconds){const urgent=seconds<1?1:seconds<3?.75:seconds<5?.45:.25;this.tone(seconds<1?980:seconds<3?760:520,.035+urgent*.025,{gain:.035+urgent*.035,type:'square'});}
    warning(){this.tone(880,.12,{gain:.09,type:'square'});this.tone(1180,.12,{gain:.07,delay:.12,type:'square'});}
    explosion(){this.resume();this.noise(.42,{gain:.22,lowpass:1250});this.noise(.22,{gain:.13,lowpass:3600,delay:.02});this.tone(72,.45,{gain:.2,type:'sine',slide:-25});this.tone(145,.24,{gain:.11,type:'sawtooth',slide:-60,delay:.025});}
    hazard(kind='spike'){if(kind==='lava'){this.noise(.18,{gain:.08,lowpass:900});this.tone(115,.16,{gain:.05,type:'sawtooth'});}else if(kind==='cannon'){this.noise(.16,{gain:.12,lowpass:700});this.tone(90,.15,{gain:.1});}else{this.tone(350,.06,{gain:.07,type:'square',slide:-90});}}
    power(kind){const map={protect:700,energy:860,ice:1020,teleport:620,vengeance:250,spear:180,morph:430,shield:760};this.tone(map[kind]||700,.16,{gain:.085,type:'triangle',slide:220});this.tone((map[kind]||700)*1.45,.12,{gain:.04,delay:.07});}
    finalDuel(){this.tone(180,.22,{gain:.12,type:'sawtooth',slide:150});this.tone(360,.22,{gain:.09,delay:.18,type:'square',slide:220});this.tone(740,.26,{gain:.08,delay:.34});}
    victory(){[392,523,659,784].forEach((f,i)=>this.tone(f,.22,{gain:.07,delay:i*.11,type:'square'}));}
    defeat(){this.tone(330,.18,{gain:.07,type:'triangle',slide:-170});this.tone(145,.24,{gain:.06,delay:.15,type:'sawtooth',slide:-60});}
    voice(kind='panic'){
      const now=performance.now();if(now<this.voiceCooldown)return;this.voiceCooldown=now+380+Math.random()*380;
      const base=kind==='win'?420:kind==='hit'?170:kind==='panic'?520:300;const up=kind==='panic'?260:kind==='win'?180:-30;
      this.tone(base+Math.random()*80,.085,{gain:.035,dest:'voices',type:'square',slide:up});
      if(Math.random()<.45)this.tone(base*.8,.06,{gain:.025,dest:'voices',delay:.07,type:'triangle',slide:up*.5});
    }
    startMusic(){this.stopMusic();this.active=true;this.musicStep=0;const loop=()=>{if(!this.active||!this.ctx)return;const int=this.intensity;const notes=int>1?[196,247,294,392,330,294,247,220]:int>0?[165,196,247,294,247,220,196,185]:[147,165,196,220,196,165,147,131];const f=notes[this.musicStep%notes.length];this.tone(f,.13,{gain:.028+int*.008,dest:'music',type:'square'});if(this.musicStep%2===0)this.tone(f/2,.09,{gain:.018,dest:'music',type:'triangle'});this.musicStep++;const ms=int>1?150:int>0?190:235;this.musicTimer=setTimeout(loop,ms);};loop();this.startAmbience();}
    setIntensity(v){this.intensity=Math.max(0,Math.min(2,Number(v)||0));}
    startAmbience(){clearTimeout(this.ambienceTimer);const loop=()=>{if(!this.active)return;if(Math.random()<.55)this.noise(.35,{gain:.012,dest:'ambience',lowpass:500+Math.random()*500});if(Math.random()<.16)this.tone(80+Math.random()*60,.22,{gain:.015,dest:'ambience',type:'triangle'});this.ambienceTimer=setTimeout(loop,900+Math.random()*1500);};loop();}
    duck(ms=280){if(!this.ctx||!this.music)return;const t=this.ctx.currentTime,g=this.music.gain,base=Math.max(.001,this.settings.music);g.cancelScheduledValues(t);g.setValueAtTime(g.value,t);g.exponentialRampToValueAtTime(Math.max(.002,base*.24),t+.025);g.exponentialRampToValueAtTime(base,t+ms/1000);}
    stopMusic(){this.active=false;clearTimeout(this.musicTimer);clearTimeout(this.ambienceTimer);this.musicTimer=this.ambienceTimer=null;}
    stopAll(){this.stopMusic();}
  }
  window.GoblinBombAudio=GoblinBombAudio;
})();
