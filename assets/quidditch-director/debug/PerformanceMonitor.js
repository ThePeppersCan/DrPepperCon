export class PerformanceMonitor {
  constructor(){this.samples=[];this.last=0;this.enabled=false;}
  frame(now=performance.now()){if(!this.enabled){this.last=now;return;}if(this.last){const ms=now-this.last;this.samples.push(ms);if(this.samples.length>120)this.samples.shift();}this.last=now;}
  snapshot(){const avg=this.samples.length?this.samples.reduce((a,b)=>a+b,0)/this.samples.length:0;return{averageFrameMs:avg,fps:avg?1000/avg:0,samples:this.samples.length,memory:globalThis.performance?.memory?.usedJSHeapSize||null};}
}
