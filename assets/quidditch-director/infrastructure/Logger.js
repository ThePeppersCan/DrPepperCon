export class Logger {
  constructor({capacity = 300, namespace = 'QD'} = {}) {
    this.capacity = capacity;
    this.namespace = namespace;
    this.entries = [];
  }
  write(level, system, message, context = {}) {
    const entry = { at: Date.now(), level, system, message: String(message), context };
    this.entries.push(entry);
    if (this.entries.length > this.capacity) this.entries.shift();
    const fn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.debug;
    fn?.(`[${this.namespace}:${system}] ${message}`, context);
    return entry;
  }
  debug(system, message, context) { return this.write('DEBUG', system, message, context); }
  warn(system, message, context) { return this.write('WARN', system, message, context); }
  error(system, message, context) { return this.write('ERROR', system, message, context); }
  snapshot() { return this.entries.map(x => ({...x, context: {...x.context}})); }
}
