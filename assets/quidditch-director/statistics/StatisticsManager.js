export class StatisticsManager {
  constructor(events) {
    this.stats = {cardsPlayed:0, goals:0, possessions:0, matches:0, wins:0, runs:0, highestFlow:1};
    events.on('CARD_PLAYED', e => { this.stats.cardsPlayed++; this.stats.highestFlow = Math.max(this.stats.highestFlow, Number(e.payload.flow || 1)); });
    events.on('GOAL_SCORED', e => { this.stats.goals += Number(e.payload.count || 1); });
    events.on('POSSESSION_ENDED', e => { this.stats.possessions++; this.stats.highestFlow = Math.max(this.stats.highestFlow, Number(e.payload.flow || 1)); });
    events.on('MATCH_ENDED', e => { this.stats.matches++; if (e.payload.won) this.stats.wins++; });
    events.on('RUN_ENDED', () => { this.stats.runs++; });
  }
  snapshot() { return {...this.stats}; }
}
