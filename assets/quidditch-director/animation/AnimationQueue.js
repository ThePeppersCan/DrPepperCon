export class AnimationQueue {
  constructor() { this.channels = new Map(); this.speed = 1; }
  setSpeed(speed) { this.speed = Math.max(0.01, Number(speed) || 1); }
  enqueue(channel, task) {
    const previous = this.channels.get(channel) || Promise.resolve();
    const next = previous.catch(()=>{}).then(() => task(this.speed));
    this.channels.set(channel, next);
    return next.finally(() => { if (this.channels.get(channel) === next) this.channels.delete(channel); });
  }
  clear() { this.channels.clear(); }
}
