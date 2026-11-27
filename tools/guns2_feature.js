/* ================= Gun library: Quaternius Modular Sci-Fi Guns + Ultimate Gun Pack (CC0) =================
   Energy weapons (blasters, repeaters, pulse and plasma rifles) and kinetic slugthrowers (pistols, revolvers, scatterguns,
   hunting rifles), all sold at markets and craftable at the engineering bench. Same grip, socket and combat rules as the
   first four guns; the models load only when someone equips or previews one. */
const GUNS2={
  ion_pistol:{name:'Ion Pistol',len:.31,hold:'pistol',range:24,cd:1,mult:.9,mag:14,cost:2200,tier:2,dmg:'energy'},
  dl_sidearm:{name:'DL Sidearm',len:.33,hold:'pistol',range:27,cd:1.1,mult:1,mag:12,cost:2800,tier:2,dmg:'energy'},
  holdout:{name:'Holdout Blaster',len:.24,hold:'pistol',range:18,cd:.8,mult:.75,mag:8,cost:1500,tier:1,dmg:'energy'},
  repeater:{name:'Repeater Carbine',len:.55,hold:'rifle',range:24,cd:.55,mult:.55,mag:36,cost:3600,tier:3,dmg:'energy'},
  heavy_repeater:{name:'Heavy Repeater',len:.78,hold:'rifle',range:28,cd:.5,mult:.62,mag:60,cost:5600,tier:4,dmg:'energy'},
  pulse_rifle:{name:'Pulse Rifle',len:.86,hold:'rifle',range:34,cd:1.25,mult:1.15,mag:24,cost:4800,tier:3,dmg:'energy'},
  storm_carbine:{name:'Storm Carbine',len:.7,hold:'rifle',range:30,cd:.9,mult:.9,mag:28,cost:4200,tier:3,dmg:'energy'},
  trooper_rifle:{name:'Trooper Rifle',len:.85,hold:'rifle',range:32,cd:1.1,mult:1.05,mag:30,cost:4400,tier:3,dmg:'energy'},
  plasma_lancer:{name:'Plasma Lancer',len:.92,hold:'rifle',range:30,cd:1.9,mult:1.6,mag:8,cost:7200,tier:5,dmg:'energy'},
  marksman:{name:'Marksman Rifle',len:1.08,hold:'rifle',range:48,cd:2.1,mult:1.6,mag:6,cost:6400,tier:4,dmg:'energy'},
  longshot:{name:'Longshot Rifle',len:1.2,hold:'rifle',range:56,cd:2.6,mult:1.95,mag:4,cost:8200,tier:5,dmg:'energy'},
  slug_pistol:{name:'Slugthrower Pistol',len:.24,hold:'pistol',range:22,cd:.95,mult:.95,mag:10,cost:1800,tier:1,dmg:'kinetic'},
  revolver:{name:'Frontier Revolver',len:.3,hold:'pistol',range:25,cd:1.3,mult:1.3,mag:6,cost:2600,tier:2,dmg:'kinetic'},
  slug_smg:{name:'Slugthrower SMG',len:.48,hold:'rifle',range:20,cd:.45,mult:.5,mag:32,cost:3000,tier:2,dmg:'kinetic'},
  kinetic_rifle:{name:'Kinetic Assault Rifle',len:.9,hold:'rifle',range:32,cd:1,mult:1,mag:30,cost:4000,tier:3,dmg:'kinetic'},
  scattergun:{name:'Scattergun',len:.98,hold:'rifle',range:12,cd:1.6,mult:1.9,mag:6,cost:3800,tier:3,dmg:'kinetic'},
  sawed_off:{name:'Sawed-off Scattergun',len:.58,hold:'rifle',range:8,cd:1.4,mult:1.7,mag:2,cost:2400,tier:2,dmg:'kinetic'},
  hunting_rifle:{name:'Hunting Rifle',len:1.15,hold:'rifle',range:50,cd:2.2,mult:1.7,mag:5,cost:5200,tier:4,dmg:'kinetic'},
  bullpup:{name:'Bullpup Rifle',len:.74,hold:'rifle',range:30,cd:.85,mult:.9,mag:30,cost:4100,tier:3,dmg:'kinetic'}};
Object.assign(GUNS,GUNS2);
let guns2P=null;
{const _lg=loadGun;loadGun=function(id){if(!GUNS2[id]||gunProto[id])return _lg(id);return(guns2P||(guns2P=loadScript('kits/guns2.js'))).then(()=>_lg(id))}}
for(const [id,G] of Object.entries(GUNS2)){const kin=G.dmg==='kinetic';
  SHOP.push({id:'gun_'+id,name:G.name,cost:G.cost,make:()=>({kind:'weapon',slot:'Main hand',name:G.name,gun:id,tier:G.tier,q:420})});
  SCHEMATICS.push({id:'gun_'+id,name:G.name,out:'weapon',slot:'Main hand',gun:id,needs:[['Metal',Math.round(G.len*30+12)],[kin?'Mineral':'Chemical',kin?14:Math.round(6+G.tier*3)],['Mineral',10]],attrs:kin?['quality','malleability','conductivity']:['quality','conductivity','malleability'],box:'crafting_artisan_engineering_02'})}
