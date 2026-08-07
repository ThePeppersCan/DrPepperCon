export class MemoryManager {
  constructor(){this.disposables=new Set();this.pools=new Map();}
  own(disposable){if(disposable)this.disposables.add(disposable);return disposable;}
  release(disposable){if(!this.disposables.delete(disposable))return;try{disposable.destroy?.();disposable.dispose?.();}catch{}}
  pool(name,factory){if(!this.pools.has(name))this.pools.set(name,{free:[],active:new Set(),factory});return this.pools.get(name);}
  acquire(name,factory){const p=this.pool(name,factory);const item=p.free.pop()||p.factory();p.active.add(item);return item;}
  recycle(name,item){const p=this.pools.get(name);if(!p||!p.active.delete(item))return;p.free.push(item);}
  destroyAll(){for(const d of [...this.disposables])this.release(d);this.pools.clear();}
}
