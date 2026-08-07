export class AssetManager {
  constructor({logger=null}={}){this.logger=logger;this.cache=new Map();this.groups=new Map();}
  registerGroup(name,urls){this.groups.set(name,[...new Set(urls||[])]);}
  async preload(name){const urls=this.groups.get(name)||[];await Promise.all(urls.map(url=>this.loadImage(url).catch(error=>this.logger?.warn('AssetManager','Asset preload failed',{url,error:String(error)}))));}
  async loadImage(url){if(this.cache.has(url))return this.cache.get(url);const promise=new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src=url;});this.cache.set(url,promise);return promise;}
  release(url){this.cache.delete(url);}
  clear(){this.cache.clear();}
}
