export class EffectQueue {
  constructor({maxDepth = 64, maxOperations = 500, maxIdenticalTriggers = 48, logger = null} = {}) {
    this.maxDepth = maxDepth;
    this.maxOperations = maxOperations;
    this.maxIdenticalTriggers = maxIdenticalTriggers;
    this.logger = logger;
    this.reset();
  }
  reset() { this.depth = 0; this.operations = 0; this.triggerCounts = new Map(); this.trace = []; }
  run(fn, meta = {}) {
    const key = `${meta.source || 'unknown'}:${meta.reason || 'activate'}`;
    const count = (this.triggerCounts.get(key) || 0) + 1;
    if (this.depth >= this.maxDepth || this.operations >= this.maxOperations || count > this.maxIdenticalTriggers) {
      const context = {depth:this.depth, operations:this.operations, key, trace:this.trace.slice(-20)};
      this.logger?.error('EffectQueue', 'Effect safety limit reached', context);
      throw new Error(`Quidditch Director effect safety limit reached: ${key}`);
    }
    this.triggerCounts.set(key, count);
    this.operations++;
    this.depth++;
    this.trace.push({depth:this.depth, ...meta});
    try { return fn(); }
    finally { this.depth--; }
  }
  snapshot() { return {depth:this.depth, operations:this.operations, trace:[...this.trace]}; }
}
