export class LocalisationManager {
  constructor(){this.locale='en';this.catalogues=new Map([['en',{}]]);}
  register(locale,catalogue){this.catalogues.set(locale,{...(catalogue||{})});}
  setLocale(locale){if(this.catalogues.has(locale))this.locale=locale;}
  t(key,vars={}){let text=this.catalogues.get(this.locale)?.[key]??this.catalogues.get('en')?.[key]??key;for(const[k,v]of Object.entries(vars))text=text.replaceAll(`{${k}}`,String(v));return text;}
}
