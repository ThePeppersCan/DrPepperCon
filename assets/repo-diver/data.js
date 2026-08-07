(() => {
'use strict';
const R={
  biomes:{
    karamja:{name:'Karamja Coast',unlock:0,maxDepth:70,sky:'#79d7e7',water:'#0f7e9b',deep:'#063448',accent:'#ffe083',desc:'Warm reefs, colourful schools and forgiving currents.'},
    fremennik:{name:'Fremennik Waters',unlock:3,maxDepth:110,sky:'#9fd9ee',water:'#397ea5',deep:'#102f4d',accent:'#bde8ff',desc:'Cold shelves, ice caves and aggressive cod.'},
    morytania:{name:'Morytania Trench',unlock:7,maxDepth:150,sky:'#83968b',water:'#315f59',deep:'#102c31',accent:'#b1e3bd',desc:'Ghostly kelp, murky ruins and spectral predators.'},
    abyssal:{name:'Abyssal Rift',unlock:12,maxDepth:190,sky:'#765488',water:'#4b356b',deep:'#1c1236',accent:'#d5a8ff',desc:'Magical currents, rune vents and strange deep life.'},
    crystal:{name:'Crystal Deep',unlock:18,maxDepth:230,sky:'#8bcfe8',water:'#24667d',deep:'#071d31',accent:'#83f5ff',desc:'Glowing crystal caverns and legendary specimens.'}
  },
  fish:[
    ['shrimp','Coastal Shrimp','common','karamja',8,.35,14],['sardine','Bluefin Sardine','common','karamja',12,.5,18],['trout','Lumbridge Trout','common','karamja',18,1.2,24],['mudskipper','Mudskipper','uncommon','karamja',28,1.0,32],['rockcrab','Rock Crab','uncommon','karamja',34,2.2,36],['snapper','Karamjan Snapper','rare','karamja',52,2.5,48],['goblinfish','Goblinfish','rare','karamja',60,1.4,58],
    ['fremcod','Fremennik Cod','common','fremennik',22,1.8,28],['swordfin','Swordfin','uncommon','fremennik',38,2.5,38],['moonjel','Moon Jelly','rare','fremennik',58,1.0,54],['dragonlob','Dragon Lobster','epic','fremennik',95,4.2,78],['ghostshark','Ghost Shark','epic','fremennik',115,5.8,90],
    ['monkfish','Monkfish','uncommon','morytania',44,2.5,44],['bloodeel','Blood Eel','rare','morytania',72,2.0,64],['phantom','Phantom Marlin','epic','morytania',120,5.4,95],['soulangler','Soul Angler','legendary','morytania',190,3.2,135],
    ['abyssaleel','Abyssal Eel','rare','abyssal',80,2.7,70],['runeray','Rune Ray','epic','abyssal',128,5.6,102],['voidshark','Void Shark','legendary','abyssal',210,7.5,150],['levifry','Leviathan Fry','ancient','abyssal',280,6.0,185],
    ['crystaltuna','Crystal Tuna','rare','crystal',95,3.0,82],['crystalmanta','Crystal Manta','epic','crystal',150,6.3,115],['ancientmanta','Ancient Manta','legendary','crystal',235,7.2,165],['deepkraken','Deep Kraken','ancient','crystal',320,9.0,220]
  ].map(x=>({id:x[0],name:x[1],rarity:x[2],biome:x[3],xp:x[4],weight:x[5],value:x[6]})),
  recipes:[
    {id:'shrimp_skewer',name:'Shrimp Skewer',fish:['shrimp'],price:42,xp:14,diff:.18},
    {id:'grilled_trout',name:'Grilled Trout',fish:['trout'],price:68,xp:20,diff:.24},
    {id:'snapper_plate',name:'Karamjan Snapper Plate',fish:['snapper'],price:135,xp:34,diff:.34},
    {id:'lobster_platter',name:'Dragon Lobster Platter',fish:['dragonlob'],price:245,xp:58,diff:.48},
    {id:'monk_curry',name:'Monkfish Curry',fish:['monkfish'],price:128,xp:40,diff:.38},
    {id:'ghost_steak',name:'Ghost Shark Steak',fish:['ghostshark'],price:285,xp:66,diff:.56},
    {id:'abyssal_bowl',name:'Abyssal Eel Bowl',fish:['abyssaleel'],price:210,xp:54,diff:.52},
    {id:'rune_ray',name:'Rune Ray Sashimi',fish:['runeray'],price:340,xp:82,diff:.64},
    {id:'crystal_plate',name:'Crystal Manta Plate',fish:['crystalmanta'],price:480,xp:110,diff:.74},
    {id:'ancient_feast',name:'Ancient Manta Feast',fish:['ancientmanta'],price:720,xp:160,diff:.84}
  ],
  rarity:{common:{c:'#d9edf4',s:1},uncommon:{c:'#70df8a',s:1.15},rare:{c:'#61aaff',s:1.35},epic:{c:'#c57cff',s:1.65},legendary:{c:'#ffcb55',s:2.05},ancient:{c:'#ff7d8f',s:2.5}},
  upgradeDefs:{tank:{name:'Oxygen Tank',max:6,base:1800,desc:'+25 sec oxygen per level'},cargo:{name:'Cargo Box',max:6,base:1600,desc:'+4 kg capacity per level'},harpoon:{name:'Harpoon Power',max:6,base:2200,desc:'Catch stronger fish more reliably'},suit:{name:'Diving Suit',max:5,base:2800,desc:'Unlock deeper biomes'},boost:{name:'Swim Boost',max:5,base:1900,desc:'Faster, cheaper boost'}}
};
R.byId=Object.fromEntries(R.fish.map(f=>[f.id,f]));
R.recipeById=Object.fromEntries(R.recipes.map(f=>[f.id,f]));
window.RepoDiverData=R;
})();
