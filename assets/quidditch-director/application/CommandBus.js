export class CommandBus {
  constructor({events = null, logger = null} = {}) { this.handlers = new Map(); this.events = events; this.logger = logger; }
  register(type, handler) { if (this.handlers.has(type)) throw new Error(`Command already registered: ${type}`); this.handlers.set(type, handler); return () => this.handlers.delete(type); }
  dispatch(command) {
    if (!command?.type) throw new Error('Command requires type');
    const handler = this.handlers.get(command.type);
    if (!handler) throw new Error(`No command handler: ${command.type}`);
    this.events?.emit('COMMAND_DISPATCHED', {type:command.type});
    try { return handler(command); }
    catch (error) { this.logger?.error('CommandBus', `Command failed: ${command.type}`, {error:String(error)}); throw error; }
  }
}
