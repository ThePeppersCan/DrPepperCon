export class StateMachine {
  constructor(transitions, logger = null) {
    this.transitions = new Map(Object.entries(transitions).map(([k,v]) => [k, new Set(v)]));
    this.logger = logger;
  }
  can(from, to) { return from === to || this.transitions.get(from)?.has(to) || false; }
  transition(holder, key, to, {force = false} = {}) {
    const from = holder[key];
    if (!force && !this.can(from, to)) {
      this.logger?.warn('StateMachine', 'Rejected invalid transition', {from, to});
      return false;
    }
    holder[key] = to;
    return true;
  }
}
export const RUN_TRANSITIONS = {
  hub: ['match','event','run_end'],
  match: ['result','hub','run_end'],
  result: ['hub','event','run_end'],
  event: ['hub','run_end'],
  run_end: []
};
