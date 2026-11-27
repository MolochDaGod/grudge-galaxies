/* Grudge Galaxies game runtime (legacy single-file build, being split into src/ modules phase by phase).
   Runs as a classic script after src/three-compat.ts has put three r185 on window.THREE. */
(()=>{
"use strict";
const $=s=>document.querySelector(s);
const V3=THREE.Vector3, TAU=Math.PI*2, HALF=8192, EXT=16384;
const fmt=n=>Math.round(n).toLocaleString('en-US').replace('-','−');

/* ---------------- RNG + noise ---------------- */
function mulberry(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function strHash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function h3(x,y,z,s){let h=Math.imul(x,374761393)^Math.imul(y,668265263)^Math.imul(z,1274126177)^Math.imul(s,951274213);h=Math.imul(h^(h>>>13),1274126177);h^=h>>>16;return(h>>>0)/4294967296}
function noise3(x,y,z,s){
  const xi=Math.floor(x),yi=Math.floor(y),zi=Math.floor(z),xf=x-xi,yf=y-yi,zf=z-zi;
  const u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf),w=zf*zf*(3-2*zf);
  const L=(a,b,t)=>a+(b-a)*t;
  const c=(i,j,k)=>h3(xi+i,yi+j,zi+k,s);
  return L(L(L(c(0,0,0),c(1,0,0),u),L(c(0,1,0),c(1,1,0),u),v),L(L(c(0,0,1),c(1,0,1),u),L(c(0,1,1),c(1,1,1),u),v),w);
}
function fbm(x,y,z,s,o=5){let a=.5,f=1,t=0,n=0;for(let i=0;i<o;i++){t+=a*noise3(x*f,y*f,z*f,s+i*17);n+=a;a*=.5;f*=2.03}return t/n}
const smooth=(e0,e1,x)=>{const t=Math.min(1,Math.max(0,(x-e0)/(e1-e0)));return t*t*(3-2*t)};

/* ---------------- biomes ---------------- */
const BIOMES={
  desert:{sea:null,land:['#6e4f2e','#b88d55','#e6cf9c'],sky:'#b9a080',glow:'#f0c070'},
  temperate:{sea:['#173c5e',.44],land:['#3c6634','#6f8f46','#b9b08b'],sky:'#7f9fbf',glow:'#7fc0ff'},
  forest:{sea:['#1c3a52',.36],land:['#1d4529','#2f6a36','#5d7d4b'],sky:'#7d9a90',glow:'#8fe0a0'},
  jungle:{sea:['#1a4448',.4],land:['#1c562b','#3b7c30','#7a994b'],sky:'#88a88a',glow:'#a6f07a'},
  swamp:{sea:['#2a4234',.47],land:['#34452a','#56613a','#7f7a53'],sky:'#8a9682',glow:'#c0d080'},
  grass:{sea:['#244f6e',.3],land:['#66762f','#9aa255','#cbc28c'],sky:'#9fb2c4',glow:'#e0e080'},
  badlands:{sea:null,land:['#583626','#8d5a3c','#c2936b'],sky:'#b08870',glow:'#ff9a6a'},
  red:{sea:['#3e2222',.36],land:['#552620','#87392b','#b8745b'],sky:'#9a6a62',glow:'#ff6a5a'},
  ice:{sea:['#33597a',.3],land:['#8ea6b8','#cddbe5','#f7fbff'],sky:'#c4d4e2',glow:'#cfeaff'},
  volcanic:{sea:['#9a3514',.3],land:['#221e1c','#463730','#7a6152'],sky:'#4a3632',glow:'#ff7040'}
};
/* Surface layers per biome. Coverage is decided from the landform (slope, curvature, valley depth,
   talus below steep ground, snow line, aridity), after super-terrain's TerrainMaterialFields. */
const SURF={
  desert:{rock:'#8a6a4a',scree:'#a88660',soil:'#c49a68',grass:'#9c8a52',meadow:'#a89a60',sand:'#e2c48e',aridity:.95,relief:150,tree:null},
  temperate:{water:'#3d6f8a',wet:.8,rock:'#6f6a62',scree:'#8c8578',soil:'#6b5a40',grass:'#4f7a34',meadow:'#7c9a4a',sand:'#cbbf94',snow:'#eef3f7',snowAlt:300,aridity:.15,relief:190,tree:{kind:'broad',color:'#36602a',density:.5}},
  forest:{water:'#3e5f6a',wet:.82,rock:'#5f5d55',scree:'#76705f',soil:'#4a3d2a',grass:'#2c5a2c',meadow:'#4c7038',sand:'#a99d76',aridity:.05,relief:160,tree:{kind:'conifer',color:'#1f3d22',density:1}},
  jungle:{water:'#3c6a6a',wet:.76,rock:'#5d5c4f',scree:'#787560',soil:'#4c4028',grass:'#2e6a2c',meadow:'#5b8a34',sand:'#a8a070',aridity:.02,relief:130,tree:{kind:'broad',color:'#2b5e25',density:1}},
  swamp:{water:'#4a6a5a',wet:.62,rock:'#5c5a4c',scree:'#77735c',soil:'#4a4430',grass:'#47592f',meadow:'#68703f',sand:'#8c8460',aridity:.1,relief:60,tree:{kind:'broad',color:'#4a5a2c',density:.45}},
  grass:{water:'#4a7a8a',wet:.86,rock:'#6c665a',scree:'#8a8370',soil:'#7a6644',grass:'#7c8a3c',meadow:'#a3a35a',sand:'#c8bb8a',aridity:.35,relief:120,tree:{kind:'broad',color:'#4d6a2c',density:.18}},
  badlands:{rock:'#6e4a36',scree:'#8d6248',soil:'#9a6b4a',grass:'#7d6b45',meadow:'#8f7a50',sand:'#c09068',aridity:.8,relief:230,tree:null},
  red:{rock:'#5a2c26',scree:'#7a3e32',soil:'#7e4a38',grass:'#6a5a34',meadow:'#7f6a40',sand:'#b07a5e',aridity:.5,relief:210,tree:{kind:'conifer',color:'#4a3326',density:.25}},
  ice:{water:'#8fb0c6',wet:.8,rock:'#6e7c88',scree:'#9aa8b4',soil:'#b8c6d0',grass:'#c8d6e0',meadow:'#dfe9f0',sand:'#e8f0f6',snow:'#f7fbff',snowAlt:-9999,aridity:.3,relief:240,tree:null},
  volcanic:{rock:'#241f1c',scree:'#3a2e28',soil:'#4a3a30',grass:'#3a302a',meadow:'#55402f',sand:'#5e4636',lava:'#d2541a',aridity:.9,relief:260,tree:null}
};
const STYLE={tatooine:{wall:'#d8c39c',roof:'dome',roofc:'#e6d6b4'},naboo:{wall:'#ebe5d6',roof:'pyramid',roofc:'#4f7f74'},corellia:{wall:'#d0ccc3',roof:'flat'},
  talus:{wall:'#c9c2b4',roof:'flat'},rori:{wall:'#c6bfa8',roof:'pyramid',roofc:'#5d7a64'},dantooine:{wall:'#bcae92',roof:'dome',roofc:'#ab9d80'},lok:{wall:'#a88a70',roof:'flat'},
  yavin4:{wall:'#a09e8c',roof:'flat'},endor:{wall:'#8a6a48',roof:'pyramid',roofc:'#6a4a30'},dathomir:{wall:'#8f7060',roof:'flat'},kashyyyk:{wall:'#7a5a3a',roof:'pyramid',roofc:'#5a4028'},mustafar:{wall:'#5f5a55',roof:'flat'}};
const PLANET_BIOME={tatooine:'desert',naboo:'temperate',corellia:'temperate',talus:'grass',rori:'swamp',dantooine:'grass',lok:'badlands',yavin4:'jungle',endor:'forest',dathomir:'red',kashyyyk:'forest',kashyyyk_main:'forest',mustafar:'volcanic',hoth:'ice'};
const BIOME_KEYS=Object.keys(BIOMES);
const biomeKey=id=>PLANET_BIOME[id]||BIOME_KEYS[strHash(id)%BIOME_KEYS.length];
const biomeOf=id=>BIOMES[biomeKey(id)];
const col=h=>new THREE.Color(h);
function ramp(land,t){const c=land.map(col);if(t<.5)return c[0].clone().lerp(c[1],t*2);return c[1].clone().lerp(c[2],(t-.5)*2)}

/* ---------------- categories ---------------- */
const CATS={city:'City',military:'Military',ruin:'Ruin',crash:'Crash site',camp:'Camp',landmark:'Landmark'};
const css=getComputedStyle(document.documentElement);
const CAT_COLOR={};for(const k in CATS)CAT_COLOR[k]=css.getPropertyValue('--c-'+k).trim()||'#ffffff';
const classOf=t=>/object\/building\//.test(t)?'building':/object\/installation\//.test(t)?'installation':/object\/static\//.test(t)?'static':'other';
const CLASS_COLOR={building:'#f4c27a',installation:'#9cc96b',static:'#8fa3b8',other:'#5fc4e8',npc:'#7fd6e8',travel:'#ffffff',object:'#c9b6f0'};
const clsOf=p=>p.k==='npc'?'npc':p.k==='travel'?'travel':p.k==='object'?'object':classOf(p.t);
const CLS_NAME={npc:'NPC spawn',travel:'Travel point',object:'Scene object',building:'Building',installation:'Installation',static:'Static',other:'Object'};

function categorize(temps,n){
  const s=temps.join(' ');
  if(n>=30||(/cantina|starport|cloning|hospital|bank|guild|capitol|shuttleport|city/.test(s)&&n>=10))return'city';
  if(/crash|wreck|escape_pod|downed/.test(s))return'crash';
  if(/military|bunker|imperial|rebel|barricade|outpost|fort|guard_house|turret/.test(s))return'military';
  if(/ruin|temple|column|broken|ancient/.test(s))return'ruin';
  if(/camp|tent|campfire|bedroll/.test(s))return'camp';
  return'landmark';
}
const STOP=new Set(['shared','poi','lg','sm','md','med','iff','obj','tato','nboo','corl','tal','rori','dant','lok','yavn','endr','dath','kash','must','tatooine','naboo','corellia','talus','dantooine','yavin4','endor','dathomir','kashyyyk','mustafar','hoth','general','imperial','rebel']);
function prettify(t){
  const base=(t.split('/').pop()||t).replace(/\.iff$/,'').replace(/^shared_/,'');
  const toks=base.split('_').filter(w=>w&&!STOP.has(w)&&!/^s?\d+m?$/.test(w)&&w.length>1).slice(0,3);
  return toks.length?toks.map(w=>w[0].toUpperCase()+w.slice(1)).join(' '):base;
}

/* ---------------- world model ---------------- */
let WORLDS=[], DEMO=true;
function finalizeWorld(id,placements,demo,explicit){
  const w={id,name:id.replace(/_/g,' '),biome:biomeOf(id),surf:SURF[biomeKey(id)],seed:strHash(id),placements,demo,pois:[]};
  if(explicit)assignPois(w,explicit);else derivePois(w);
  heightSamples(w);return w;
}
function assignPois(w,list){
  w.pois=list.map((p,i)=>({...p,id:i,members:[],n:0,top:[]}));
  w.placements.forEach((p,i)=>{
    if(p.r==null)p.r=p.k==='travel'?12:p.k==='npc'?1:3;
    let best=null,bs=Infinity;
    for(const q of w.pois){const d=Math.hypot(p.x-q.x,p.z-q.z);if(d<q.r+60){const sc=d/(q.r+60);if(sc<bs){bs=sc;best=q}}}
    if(best){best.members.push(i);p.poi=best.id}
  });
  w.pois.forEach(q=>{q.n=q.members.length;const c=new Map();for(const i of q.members){const t=w.placements[i].t;c.set(t,(c.get(t)||0)+1)}const all=[...c].sort((a,b)=>b[1]-a[1]),bl=all.filter(([t])=>t.startsWith('object/building/'));q.top=(bl.length?bl:all).slice(0,4)});
}
function heightSamples(w){
  const P=w.placements,hs=[];
  if(!P.some(p=>Math.abs(p.y||0)>1)){w.hs=null;return}
  const med=a=>{a=a.slice().sort((x,y)=>x-y);return a[a.length>>1]};
  w.pois.forEach(q=>{const ys=q.members.map(i=>P[i]).filter(p=>p.k!=='npc'||true).map(p=>p.y).filter(y=>isFinite(y));if(ys.length){q.known=med(ys);hs.push({x:q.x,z:q.z,y:q.known})}});
  P.forEach(p=>{if(p.k==='travel'||(p.poi==null&&isFinite(p.y)&&Math.abs(p.y)>1))hs.push({x:p.x,z:p.z,y:p.y})});
  const B=600,grid=new Map();
  for(const h of hs){const k=Math.floor(h.x/B)+','+Math.floor(h.z/B);const g=grid.get(k);if(g){g.x+=h.x;g.z+=h.z;g.ys.push(h.y);g.n++}else grid.set(k,{x:h.x,z:h.z,ys:[h.y],n:1})}
  let cells=[...grid.values()].map(g=>({x:g.x/g.n,z:g.z/g.n,y:med(g.ys),n:g.n}));
  // drop outliers (caves, rooftops, bad rows): compare each cell with the median of its neighbourhood
  const poiCells=w.pois.filter(q=>q.known!=null).map(q=>({x:q.x,z:q.z,y:q.known,n:99,poi:1}));
  cells=cells.filter(c=>!w.pois.some(q=>q.known!=null&&Math.hypot(c.x-q.x,c.z-q.z)<q.r+150)).concat(poiCells);
  const keep=cells.filter(c=>{if(c.poi)return true;const ys=cells.filter(o=>o!==c&&Math.hypot(o.x-c.x,o.z-c.z)<2600).map(o=>o.y);
    if(ys.length<2)return true;const m=med(ys);return Math.abs(c.y-m)<Math.max(60,Math.abs(m)*.25)});
  w.hs=keep;
  w.pois.forEach(q=>{if(q.known!=null)return;const ys=keep.filter(o=>Math.hypot(o.x-q.x,o.z-q.z)<1500).map(o=>o.y);if(ys.length)q.known=med(ys)});
  w.hmean=w.hs.reduce((a,h)=>a+h.y,0)/w.hs.length;
}
function derivePois(w){
  const B=400,R2=350*350,bins=new Map(),cl=[];
  const P=w.placements;
  for(let i=0;i<P.length;i++){
    const p=P[i],bx=Math.floor(p.x/B),bz=Math.floor(p.z/B);let best=-1,bd=R2;
    for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++){const a=bins.get((bx+dx)+','+(bz+dz));if(!a)continue;for(const ci of a){const c=cl[ci],d=(c.x-p.x)**2+(c.z-p.z)**2;if(d<bd){bd=d;best=ci}}}
    if(best<0){best=cl.length;cl.push({x:p.x,z:p.z,m:[]});const k=bx+','+bz;(bins.get(k)||bins.set(k,[]).get(k)).push(best)}
    const c=cl[best];c.m.push(i);const n=c.m.length;c.x+=(p.x-c.x)/n;c.z+=(p.z-c.z)/n;
  }
  const names=new Map();
  w.pois=cl.filter(c=>c.m.length>=3).map(c=>{
    const counts=new Map();let r=0,big=null;
    for(const i of c.m){const p=P[i];counts.set(p.t,(counts.get(p.t)||0)+1);const d=Math.hypot(p.x-c.x,p.z-c.z)+p.r;if(d>r)r=d;if(!big||p.r>big.r)big=p}
    const top=[...counts].sort((a,b)=>b[1]-a[1]);
    const cat=categorize([...counts.keys()],c.m.length);
    let name=cat==='city'?`City at ${fmt(c.x)}, ${fmt(c.z)}`:prettify(big.t);
    const k=name.toLowerCase();const seen=names.get(k)||0;names.set(k,seen+1);if(seen)name+=` ${seen+1}`;
    return{name,cat,x:c.x,z:c.z,r:Math.max(30,Math.min(r,1200)),n:c.m.length,top:top.slice(0,4),members:c.m};
  }).sort((a,b)=>b.n-a.n);
  w.pois.forEach((poi,pi)=>{poi.id=pi;for(const i of poi.members)P[i].poi=pi});
}

/* ---------------- demo worlds ---------------- */
const DEMO_IDS=['tatooine','naboo','corellia','talus','rori','dantooine','lok','yavin4','endor','dathomir'];
function demoWorld(id){
  const R=mulberry(strHash(id)),P=[],add=(t,x,z,r,y=0)=>P.push({t,x,z,y,r});
  const centers=[],n=9+Math.floor(R()*6);
  const types=['city','city','city','military','military','ruin','ruin','crash','camp','camp','landmark'];
  let guard=0;
  while(centers.length<n&&guard++<500){const x=(R()*2-1)*7200,z=(R()*2-1)*7200;if(centers.every(c=>Math.hypot(c.x-x,c.z-z)>1500))centers.push({x,z,type:types[Math.floor(R()*types.length)]})}
  const kinds=[['cantina',22],['starport',38],['cloning_facility',20],['hospital',18],['bank',12],['guild_hall',18],['shuttleport',16],['garage',14]];
  for(const c of centers){
    const J=s=>(R()*2-1)*s;
    if(c.type==='city'){
      const rad=280+R()*260;
      kinds.forEach(([k,r])=>add(`object/building/${id}/shared_${k}_${id}.iff`,c.x+J(rad*.6),c.z+J(rad*.6),r));
      for(let gx=-rad;gx<=rad;gx+=64)for(let gz=-rad;gz<=rad;gz+=64){
        if(Math.hypot(gx,gz)>rad||R()<.45)continue;
        const big=R()<.3;add(`object/building/player/shared_player_house_${id}_${big?'large':'small'}_style_01.iff`,c.x+gx+J(8),c.z+gz+J(8),big?16:9);
        if(R()<.4)add('object/static/structure/general/shared_streetlamp_large_style_01.iff',c.x+gx+20,c.z+gz+J(10),1);
      }
      add('object/static/structure/general/shared_fountain_generic_style_1.iff',c.x,c.z,6);
    }else if(c.type==='military'){
      add('object/building/military/shared_military_outpost_guard_house_imperial.iff',c.x,c.z,14);
      add('object/building/military/shared_bunker_imperial_weapons_research_facility_01.iff',c.x+J(40),c.z+J(40),24);
      for(let a=0;a<TAU;a+=TAU/14)add('object/static/structure/military/shared_military_wall_strong_imperial_32m.iff',c.x+Math.cos(a)*110,c.z+Math.sin(a)*110,16);
      for(let i=0;i<4;i++)add('object/installation/turret/shared_turret_block_large.iff',c.x+J(90),c.z+J(90),4);
    }else if(c.type==='ruin'){
      add('object/building/poi/shared_ruin_temple_small.iff',c.x,c.z,26);
      for(let i=0;i<14;i++)add(`object/static/structure/ruins/shared_ruin_column_broken_s0${1+i%4}.iff`,c.x+J(120),c.z+J(120),3);
      for(let i=0;i<6;i++)add('object/static/structure/ruins/shared_ruin_wall_s02.iff',c.x+J(100),c.z+J(100),8);
    }else if(c.type==='crash'){
      add('object/building/poi/shared_crashed_ship_lg.iff',c.x,c.z,34);
      for(let i=0;i<16;i++)add(`object/static/structure/general/shared_debris_wreck_metal_s0${1+i%3}.iff`,c.x+J(160),c.z+J(160),2.5);
    }else if(c.type==='camp'){
      for(let i=0;i<5;i++)add('object/static/structure/general/shared_camp_tent_s01.iff',c.x+J(30),c.z+J(30),4);
      add('object/static/structure/general/shared_campfire_logs_smoldering.iff',c.x,c.z,1.5);
      for(let i=0;i<4;i++)add('object/static/structure/general/shared_crate_stack_s01.iff',c.x+J(35),c.z+J(35),2);
    }else{
      add('object/static/structure/general/shared_monolith_ancient_s01.iff',c.x,c.z,12);
      for(let i=0;i<5;i++)add('object/static/structure/general/shared_rock_formation_lg_s0'+(1+i%3)+'.iff',c.x+J(90),c.z+J(90),10);
    }
  }
  for(let i=0;i<160;i++)add('object/static/flora/shared_rock_s0'+(1+i%5)+'.iff',(R()*2-1)*8000,(R()*2-1)*8000,2);
  return finalizeWorld(id,P,true);
}

/* ---------------- file parsing ---------------- */
const pickT=o=>o.template||o.template_name||o.templateName||o.object_template||o.objectTemplate||o.tpl||o.name||'';
const isInterior=o=>{const c=o.cell??o.cell_id??o.cellId??o.cell_index??o.cellIndex;return o.interior===true||(c!=null&&c!==''&&+c>0)};
function posOf(o){
  const p=o.position||o.pos||o.location||(o.transform&&o.transform.position);
  if(Array.isArray(p)&&p.length>=3)return[+p[0],+p[1],+p[2]];
  if(p&&typeof p==='object'&&'x' in p)return[+p.x,+(p.y||0),+(p.z??p.y)];
  if('x' in o&&('z' in o||'y' in o))return[+o.x,+(o.y||0),+(o.z??o.y)];
  return null;
}
function parseWorldFile(fname,text){
  const data=JSON.parse(text);
  const id=String((data&&!Array.isArray(data)&&(data.planet||data.world))||fname.replace(/\.(geo)?json$/i,'').replace(/^.*[\\/]/,'')).toLowerCase();
  const out=[];let skipped=0;
  if(data&&data.type==='FeatureCollection'){
    for(const f of data.features||[]){
      const g=f.geometry,pr=f.properties||{};if(!g||g.type!=='Point')continue;
      if(isInterior(pr)){skipped++;continue}
      const c=g.coordinates;out.push({t:pickT(pr),x:+c[0],z:+c[1],y:+(c[2]??pr.y??0),r:+(pr.radius??pr.r??1)||1});
    }
  }else{
    const roots=Array.isArray(data)?data:(data.placements||data.objects||data.nodes||data.items||data.children||[]);
    const walk=o=>{if(!o||typeof o!=='object')return;
      if(isInterior(o)){skipped++;return}
      const p=posOf(o);if(p&&isFinite(p[0])&&isFinite(p[2]))out.push({t:pickT(o),x:p[0],y:p[1],z:p[2],r:+(o.radius??o.r??1)||1});
      for(const k of ['children','nodes'])if(Array.isArray(o[k]))o[k].forEach(walk);};
    roots.forEach(walk);
  }
  return{id,placements:out.filter(p=>Math.abs(p.x)<=HALF*1.05&&Math.abs(p.z)<=HALF*1.05),skipped};
}

/* ---------------- three setup ---------------- */
const canvas=$('#gl');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
const scene=new THREE.Scene();
const cam=new THREE.PerspectiveCamera(55,1,.1,8000);
const G={galaxy:new THREE.Group(),system:new THREE.Group(),planet:new THREE.Group(),ground:new THREE.Group()};
for(const k in G)scene.add(G[k]);

function dotTexture(soft){
  const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');
  const g=x.createRadialGradient(32,32,0,32,32,32);
  g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(soft?.15:.4,'rgba(255,255,255,'+(soft?.55:.9)+')');g.addColorStop(1,'rgba(255,255,255,0)');
  x.fillStyle=g;x.fillRect(0,0,64,64);return new THREE.CanvasTexture(c);
}
const DOT=dotTexture(false),GLOW=dotTexture(true);
const glowSprite=(color,scale,op=1)=>{const s=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color,transparent:true,opacity:op,blending:THREE.AdditiveBlending,depthWrite:false}));s.scale.setScalar(scale);return s};

// background stars (space levels)
const bgStars=(()=>{const n=2600,pos=new Float32Array(n*3),R=mulberry(7);
  for(let i=0;i<n;i++){const u=R()*2-1,a=R()*TAU,s=Math.sqrt(1-u*u);pos.set([Math.cos(a)*s*3000,u*3000,Math.sin(a)*s*3000],i*3)}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));
  return new THREE.Points(g,new THREE.PointsMaterial({size:2.2,sizeAttenuation:false,color:0x9fb0c8,transparent:true,opacity:.75,depthWrite:false}));})();
scene.add(bgStars);

function clearGroup(g){g.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{if(m.map&&m.map!==DOT&&m.map!==GLOW&&!m.map._keep)m.map.dispose();m.dispose()})}});g.clear()}

/* ---------------- galaxy ---------------- */
let sysPick=[];
const REALM_C={x:-250,z:190};
function realmLabel(){const c=document.createElement('canvas');c.width=512;c.height=96;const x=c.getContext('2d');x.font='600 44px Cinzel, Georgia, serif';x.textAlign='center';x.fillStyle='#f2d79a';x.shadowColor='#000';x.shadowBlur=8;x.fillText('THE NINE REALMS',256,60);
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthWrite:false}));s.scale.set(120,22,1);s.position.set(REALM_C.x,34,REALM_C.z-62);return s}
function buildGalaxy(){
  clearGroup(G.galaxy);sysPick=[];
  const n=16000,pos=new Float32Array(n*3),cols=new Float32Array(n*3),R=mulberry(42),warm=col('#ffd9a0'),cool=col('#8fb4ff');
  const gauss=()=>{let s=0;for(let i=0;i<4;i++)s+=R();return s/2-1};
  for(let i=0;i<n;i++){
    const arm=i%3,r=Math.pow(R(),.55)*360+6,ang=arm*TAU/3+r*.017+gauss()*.42*(1-r/460);
    pos.set([Math.cos(ang)*r+gauss()*6,gauss()*7*(1-r/400),Math.sin(ang)*r+gauss()*6],i*3);
    const c=warm.clone().lerp(cool,Math.min(1,r/300)).multiplyScalar(.55+R()*.45);cols.set([c.r,c.g,c.b],i*3);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('color',new THREE.BufferAttribute(cols,3));
  G.galaxy.add(new THREE.Points(g,new THREE.PointsMaterial({size:2.4,map:DOT,vertexColors:true,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false})));
  G.galaxy.add(glowSprite(0xffd9a0,180,.55));ambientWhales.length=0;
  const pickMat=new THREE.MeshBasicMaterial({visible:false});
  WORLDS.forEach((w,i)=>{
    const arm=i%3,r=70+((i*53)%260),ang=arm*TAU/3+r*.017+((i*0.37)%0.3);
    w.gpos=new V3(Math.cos(ang)*r,((i*7)%9)-4,Math.sin(ang)*r);if(w.realm&&w.realm.grid)w.gpos=new V3(REALM_C.x+(w.realm.grid[0]-1)*40,4+(w.realm.grid[1]-1)*2,REALM_C.z+(w.realm.grid[1]-1)*40);
    const s=glowSprite(w.biome.glow,22);s.position.copy(w.gpos);G.galaxy.add(s);
    const core=glowSprite(0xffffff,6);core.position.copy(w.gpos);G.galaxy.add(core);
    const p=new THREE.Mesh(new THREE.SphereGeometry(10,8,8),pickMat);p.position.copy(w.gpos);p.userData={world:w};G.galaxy.add(p);sysPick.push(p);
  });
}

/* ---------------- planet texture ---------------- */
const texCache=new Map();
function planetTexture(w){
  if(texCache.has(w.id))return texCache.get(w.id);
  if(w.surf&&w.hs&&w.hs.length)return terrainTexture(w);
  const W=512,H=256,c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d'),img=x.createImageData(W,H),d=img.data;
  const b=w.biome,sea=b.sea&&col(b.sea[0]),lvl=b.sea?b.sea[1]:-1,s=w.seed%100000;
  for(let j=0;j<H;j++){const th=(j+.5)/H*Math.PI;for(let i=0;i<W;i++){
    const ph=(i+.5)/W*TAU,px=-Math.cos(ph)*Math.sin(th),py=Math.cos(th),pz=Math.sin(ph)*Math.sin(th);
    let n=fbm(px*2.2+3,py*2.2,pz*2.2,s,6);n=Math.min(1,Math.max(0,(n-.25)*1.9));
    let c3;
    if(n<lvl){c3=sea.clone().multiplyScalar(.7+n/lvl*.4)}else{c3=ramp(b.land,lvl>0?(n-lvl)/(1-lvl):n)}
    const pole=smooth(.82,.95,Math.abs(py));if(pole>0&&b!==BIOMES.desert&&b!==BIOMES.volcanic&&b!==BIOMES.badlands)c3.lerp(col('#eef3f7'),pole);
    const k=(j*W+i)*4;d[k]=c3.r*255;d[k+1]=c3.g*255;d[k+2]=c3.b*255;d[k+3]=255;}}
  x.putImageData(img,0,0);const t=new THREE.CanvasTexture(c);t._keep=true;texCache.set(w.id,t);return t;
}

function terrainTexture(w){
  const W=384,Hh=192,S=w.surf,c=document.createElement('canvas');c.width=W;c.height=Hh;const x2=c.getContext('2d'),img=x2.createImageData(W,Hh),d=img.data;
  const hs=new Float32Array(W*Hh),inBand=new Uint8Array(W*Hh);
  for(let j=0;j<Hh;j++){const th=(j+.5)/Hh*Math.PI,z=(.5-(th-.1*Math.PI)/(.8*Math.PI))*EXT;
    for(let i=0;i<W;i++){const x=((i+.5)/W-.5)*EXT,k=j*W+i;if(Math.abs(z)<=HALF){hs[k]=rawH(w,x,z);inBand[k]=1}}}
  for(let j=0;j<Hh;j++)for(let i=0;i<W;i++){const k=j*W+i;if(!inBand[k])hs[k]=hs[(j<Hh/2?Math.ceil(Hh*.1):Math.floor(Hh*.9)-1)*W+i]||0}
  const bl=blur(hs,W,4),L={};for(const n of ['rock','scree','soil','grass','meadow','sand','snow','water','lava'])if(S[n])L[n]=col(S[n]);
  const dx=EXT/W,dz=EXT/(Hh*.8),mean=w.hmean||0,ar=S.aridity,cc=new THREE.Color(),polar=col(S.snow||S.rock);
  for(let j=0;j<Hh;j++){const th=(j+.5)/Hh*Math.PI;for(let i=0;i<W;i++){const k=j*W+i,h=hs[k];
    const gx=(hs[j*W+(i+1)%W]-hs[j*W+(i+W-1)%W])/(2*dx),gz=(hs[Math.min(Hh-1,j+1)*W+i]-hs[Math.max(0,j-1)*W+i])/(2*dz),g=Math.hypot(gx,gz)*3;
    const wx=((i+.5)/W-.5)*EXT,wz=j;const valley=Math.max(0,Math.min(1,(bl[k]-h)/25+.5)),fray=(fbm(i*.05,1,j*.05,7,3)-.5)*.15;
    const rock=smooth(.2,.42,g+fray),moist=Math.max(0,Math.min(1,valley*.7+(1-ar)*.35-.15)),flat=1-smooth(.05,.2,g);
    const sand=ar*flat*(1-moist*.6)*smooth(.25,.6,fbm(i*.03,4,j*.03,11,3)+ar*.2),veg=(1-ar)*(1-rock);
    const grass=veg*smooth(.15,.55,moist+fray),meadow=veg*(1-smooth(.15,.55,moist+fray))*flat,soil=Math.max(0,1-rock-sand-grass-meadow);
    cc.setRGB(0,0,0);let tot=0;const add=(n,v)=>{if(v<=0||!L[n])return;cc.r+=L[n].r*v;cc.g+=L[n].g*v;cc.b+=L[n].b*v;tot+=v};
    add('rock',rock);add('sand',sand);add('grass',grass);add('meadow',meadow);add('soil',soil);cc.multiplyScalar(1/Math.max(tot,1e-4));
    if(L.snow)cc.lerp(L.snow,smooth(S.snowAlt,S.snowAlt+90,h-mean+fray*200)*(1-rock*.7));
    if(L.water)cc.lerp(L.water,smooth(S.wet,S.wet+.1,valley+fray*.4)*flat*.9);
    if(L.lava)cc.lerp(L.lava,smooth(.62,.8,valley)*flat*.8);
    cc.multiplyScalar(.85+h/Math.max(400,(S.relief||150)*4)*.4+fbm(i*.12,5,j*.12,9,2)*.2);
    const lat=Math.abs(Math.cos(th));if(lat>.85)cc.lerp(polar,smooth(.85,.97,lat)*.85);
    d[k*4]=Math.min(255,cc.r*255);d[k*4+1]=Math.min(255,cc.g*255);d[k*4+2]=Math.min(255,cc.b*255);d[k*4+3]=255}}
  x2.putImageData(img,0,0);const t=new THREE.CanvasTexture(c);t._keep=true;texCache.set(w.id,t);return t;
}

/* ---------------- system ---------------- */
let sysWorldMesh=null;
function buildSystem(w){
  clearGroup(G.system);
  const R=mulberry(w.seed);
  G.system.add(new THREE.AmbientLight(0x404a5a,.6));
  const light=new THREE.PointLight(0xfff0d8,1.6,0,0);G.system.add(light);
  const star=new THREE.Mesh(new THREE.SphereGeometry(5,32,16),new THREE.MeshBasicMaterial({color:0xffe2a8}));G.system.add(star);
  G.system.add(glowSprite(0xffc070,46,.9));
  const orbit=r=>{const pts=[];for(let a=0;a<=96;a++)pts.push(new V3(Math.cos(a/96*TAU)*r,0,Math.sin(a/96*TAU)*r));
    return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0x2a3648,transparent:true,opacity:.9}))};
  const radii=[15,34,52,70];
  radii.forEach((r,i)=>{
    G.system.add(orbit(r));
    const a=R()*TAU,isW=i===1;
    const m=new THREE.Mesh(new THREE.SphereGeometry(isW?2.6:.8+R()*2.2,32,16),
      new THREE.MeshStandardMaterial(isW?{map:planetTexture(w),roughness:1}:{color:new THREE.Color().setHSL(R(),.18,.42),roughness:1}));
    m.position.set(Math.cos(a)*r,0,Math.sin(a)*r);G.system.add(m);
    if(isW){sysWorldMesh=m;m.userData={world:w};}
  });
}

/* ---------------- planet ---------------- */
let planetMesh=null,pinMeshes=[],pinSelRing=null;
const PR=10;
function swgToSphere(x,z,r=PR){const ph=(x/EXT+.5)*TAU,th=(.5-z/EXT)*.8*Math.PI+.1*Math.PI;return new V3(-Math.cos(ph)*Math.sin(th)*r,Math.cos(th)*r,Math.sin(ph)*Math.sin(th)*r)}
function buildPlanet(w){
  clearGroup(G.planet);pinMeshes=[];
  G.planet.add(new THREE.AmbientLight(0x3a4658,.75));
  const sun=new THREE.DirectionalLight(0xfff4e0,1.15);sun.position.set(30,14,22);G.planet.add(sun);
  planetMesh=new THREE.Mesh(new THREE.SphereGeometry(PR,96,48),new THREE.MeshStandardMaterial({map:planetTexture(w),roughness:1}));G.planet.add(planetMesh);
  const atm=new THREE.Mesh(new THREE.SphereGeometry(PR*1.035,64,32),new THREE.MeshBasicMaterial({color:w.biome.glow,transparent:true,opacity:.13,side:THREE.BackSide,blending:THREE.AdditiveBlending,depthWrite:false}));G.planet.add(atm);
  const pick=new THREE.MeshBasicMaterial({visible:false});
  w.pois.forEach(poi=>{
    const p=swgToSphere(poi.x,poi.z,PR*1.004),s=poi.cat==='city'?.2:.12;
    const m=new THREE.Mesh(new THREE.SphereGeometry(s,12,8),new THREE.MeshBasicMaterial({color:CAT_COLOR[poi.cat]}));m.position.copy(p);G.planet.add(m);
    const h=new THREE.Mesh(new THREE.SphereGeometry(.45,8,6),pick);h.position.copy(p);h.userData={poi};G.planet.add(h);pinMeshes.push(h);
    poi.spos=p;
  });
  pinSelRing=new THREE.Mesh(new THREE.RingGeometry(.32,.4,32),new THREE.MeshBasicMaterial({color:0xffffff,side:THREE.DoubleSide,transparent:true,opacity:.9}));pinSelRing.visible=false;G.planet.add(pinSelRing);
}

/* ---------------- ground ---------------- */
let groundWorld=null,markers=null,selMarker=null,poiBins=null;
/* ================= Three-layer terrain: base heights (real SWG samples + noise), biome regions, detail ================= */
// Each planet is split into named biome regions by low-frequency noise. A region has a surface palette (SURF key) and a landform.
const PLANET_BIOMES={
  tatooine:[['desert','Dune Sea','dunes'],['badlands','Jundland Wastes','mesas'],['desert','Salt Flats','flats']],
  naboo:[['temperate','Lake Country','hills'],['grass','Veylara Plains','flats'],['forest','Highland Forest','mountains'],['swamp','Gorran Swamps','lowland']],
  corellia:[['temperate','Coastal Hills','hills'],['grass','Farmlands','flats'],['forest','Coraxi Forest','hills'],['badlands','Rocky Highlands','mountains']],
  talus:[['grass','Talvern Grasslands','flats'],['temperate','Talvern Hills','hills'],['badlands','Scarred Highlands','mesas']],
  rori:[['swamp','Rhosmire Swamplands','lowland'],['jungle','Rainforest','hills'],['grass','Meadows','flats']],
  dantooine:[['grass','Dawnreach Steppe','flats'],['temperate','Rolling Hills','hills'],['badlands','Mesa Country','mesas']],
  lok:[['badlands','Canyonlands','mesas'],['volcanic','Lava Fields','mountains'],['desert','Dust Plains','dunes']],
  yavin4:[['jungle','Elder Jungle','hills'],['swamp','River Lowlands','lowland'],['forest','Highland Forest','mountains']],
  endor:[['forest','Great Forest','hills'],['grass','Forest Meadows','flats'],['temperate','Lake Highlands','mountains']],
  dathomir:[['red','Red Forest','hills'],['badlands','Singing Mountains','mountains'],['swamp','Tar Pits','lowland']],
  mustafar:[['volcanic','Lava Plains','flats'],['volcanic','Ash Mountains','mountains']],kashyyyk:[['forest','Wroshyr Forest','hills'],['jungle','Shadowlands','lowland']]};
function planetBiomes(w){if(w._biomes)return w._biomes;const list=(PLANET_BIOMES[w.id]||[[biomeKey(w.id),'Wilds','hills']]).map(([k,name,land],i)=>({key:k,name,land,surf:SURF[k]||SURF.temperate,i}));
  list.forEach(b=>{b.L={};for(const k of ['rock','scree','soil','grass','meadow','sand','snow','lava','water'])if(b.surf[k])b.L[k]=col(b.surf[k])});return w._biomes=list}
const _bw=[0,0,0,0,0,0];
function biomeWeights(w,x,z){const B=planetBiomes(w),s=w.seed%10000;if(B.length===1){_bw[0]=1;return _bw}let m=-1e9;
  for(let k=0;k<B.length;k++){const v=fbm(x*.00016+k*3.7,k*1.3+.5,z*.00016-k*2.1,s+k*31,3)+(k===0?.06:0);_bw[k]=v;if(v>m)m=v}
  let t=0;for(let k=0;k<B.length;k++){_bw[k]=Math.exp((_bw[k]-m)*16);t+=_bw[k]}for(let k=0;k<B.length;k++)_bw[k]/=t;return _bw}
function biomeAt(w,x,z){const W=biomeWeights(w,x,z),B=planetBiomes(w);let bi=0;for(let k=1;k<B.length;k++)if(W[k]>W[bi])bi=k;return B[bi]}
// layer 2 landforms (metres added to the base height)
function landDelta(land,w,x,z,h){const s=w.seed%10000;
  if(land==='dunes'){const a=.6,u=x*Math.cos(a)+z*Math.sin(a),n=fbm(x*.0008,2,z*.0008,s+11,2);const d=Math.abs(Math.sin(u*.021+n*5));return(1-d)*(1-d)*16-6+(fbm(x*.003,4,z*.003,s+12,2)-.5)*6}
  if(land==='mesas'){const plat=smooth(.5,.62,fbm(x*.0007,3,z*.0007,s+13,3))*95,hh=h+plat,step=26,t=hh/step,f=t-Math.floor(t);return(Math.floor(t)+smooth(.72,1,f))*step-h}
  if(land==='mountains')return ridge(w,x,z)*.9+(fbm(x*.0006,5,z*.0006,s+14,4)-.45)*160;
  if(land==='hills')return(fbm(x*.0014,6,z*.0014,s+15,3)-.5)*55;
  if(land==='lowland')return -14-(fbm(x*.002,7,z*.002,s+16,2)-.5)*8;
  if(land==='flats')return -(fbm(x*.002,8,z*.002,s+17,2)-.5)*16;return 0}
function biomeDelta(w,x,z,h,md){const fade=w.hs&&w.hs.length?smooth(500,2600,Math.sqrt(md)):1;if(fade<=0)return 0;const B=planetBiomes(w),W=biomeWeights(w,x,z);let d=0;
  for(let k=0;k<B.length;k++)if(W[k]>.01)d+=W[k]*landDelta(B[k].land,w,x,z,h);return d*fade}
// layer 3 blending: one surface record per vertex, blended across biome regions
const _bc={};for(const k of ['rock','scree','soil','grass','meadow','sand','snow','lava','water'])_bc[k]=new THREE.Color();
function blendSurf(w,x,z){const B=planetBiomes(w),W=biomeWeights(w,x,z),out={L:{},aridity:0,wet:0,wetW:0,snowAlt:0,snowW:0,lavaW:0};
  for(const k in _bc){_bc[k].setRGB(0,0,0);let t=0;for(let i=0;i<B.length;i++)if(B[i].L[k]){_bc[k].r+=B[i].L[k].r*W[i];_bc[k].g+=B[i].L[k].g*W[i];_bc[k].b+=B[i].L[k].b*W[i];t+=W[i]}
    if(t>0){_bc[k].multiplyScalar(1/t);out.L[k]=_bc[k]}}
  for(let i=0;i<B.length;i++){const S=B[i].surf;out.aridity+=S.aridity*W[i];if(S.water){out.wet+=S.wet*W[i];out.wetW+=W[i]}if(S.snow){out.snowAlt+=S.snowAlt*W[i];out.snowW+=W[i]}if(S.lava)out.lavaW+=W[i]}
  out.wet=out.wetW?out.wet/out.wetW:.9;out.snowAlt=out.snowW?out.snowAlt/out.snowW:9999;return out}
// biome effects on gameplay
const BIOME_RES={3:/forest|jungle|grass|temperate/,6:/badlands|volcanic|red/,7:/swamp|temperate|jungle/,4:/swamp|volcanic/,2:/swamp|volcanic|badlands/,1:/desert|grass/,8:/badlands|grass|desert/,5:/volcanic/};
const BIOME_MOBS={desert:[['reptiles',5],['beasts',2],['orcs',2],['dragons',.5]],badlands:[['orcs',3],['golems',2],['reptiles',2],['dragons',1]],temperate:[['beasts',5],['reptiles',1],['elementals',1],['dragons',.4]],
  grass:[['beasts',6],['orcs',1],['dragons',.3]],forest:[['beasts',4],['spiders',3],['trolls',1],['dragons',.5]],jungle:[['spiders',4],['beasts',3],['reptiles',2],['dragons',.5]],
  swamp:[['reptiles',4],['undead',3],['spiders',2],['dragons',.4]],red:[['spiders',3],['trolls',2],['undead',2],['dragons',1.2]],volcanic:[['elementals',4],['golems',3],['dragons',1.5]],ice:[['beasts',3],['trolls',2],['dragons',.8]]};

function noiseH(w,x,z){return(fbm(x*.00022,0,z*.00022,w.seed%100000,5)-.5)*260+(fbm(x*.002,7,z*.002,w.seed%100000+5,3)-.5)*24}
function rawH(w,x,z){
  const n=noiseH(w,x,z);if(!w.hs||!w.hs.length)return n+biomeDelta(w,x,z,n,1e12);
  let num=0,den=0,md=Infinity;for(const h of w.hs){const d2=(x-h.x)**2+(z-h.z)**2+640000,wt=1/(d2*Math.sqrt(d2));num+=wt*h.y;den+=wt;if(d2<md)md=d2}
  const field=num/den;
  const base=field+n*.35+ridge(w,x,z)*smooth(1600,4200,Math.sqrt(md));return base+biomeDelta(w,x,z,base,md);
}
function ridge(w,x,z){const s=w.seed%100000+31;
  let r=1-Math.abs(fbm(x*.00032,3,z*.00032,s,4)*2-1);r=r*r*r;
  const mass=smooth(.38,.7,fbm(x*.00011,9,z*.00011,s+7,3));
  return r*mass*(w.surf?w.surf.relief:150);}
function indexPois(w){
  poiBins=new Map();const B=1024;
  w.pois.forEach(p=>{p.base=p.known??rawH(w,p.x,p.z);const R=p.r+1250;
    for(let bx=Math.floor((p.x-R)/B);bx<=Math.floor((p.x+R)/B);bx++)for(let bz=Math.floor((p.z-R)/B);bz<=Math.floor((p.z+R)/B);bz++){const k=bx+','+bz;(poiBins.get(k)||poiBins.set(k,[]).get(k)).push(p)}});
}
function groundH(w,x,z){
  let h=rawH(w,x,z),best=0,bh=h;const a=poiBins.get(Math.floor(x/1024)+','+Math.floor(z/1024));
  if(a)for(const p of a){const d=Math.hypot(x-p.x,z-p.z),k=1-smooth(p.r+30,p.r+Math.min(1200,250+Math.abs(p.base-h)*6),d);if(k>best){best=k;bh=p.base}}
  return h+(bh-h)*best;
}
let skyMesh=null;
function blur(src,N,r){const tmp=new Float32Array(src.length),out=new Float32Array(src.length);
  for(let y=0;y<N;y++){let acc=0,c=0;for(let x=-r;x<N+r;x++){if(x+r<N){acc+=src[y*N+Math.min(N-1,x+r)];c++}if(x-r-1>=0){acc-=src[y*N+x-r-1];c--}if(x>=0)tmp[y*N+x]=acc/c}}
  for(let x=0;x<N;x++){let acc=0,c=0;for(let y=-r;y<N+r;y++){if(y+r<N){acc+=tmp[Math.min(N-1,y+r)*N+x];c++}if(y-r-1>=0){acc-=tmp[(y-r-1)*N+x];c--}if(y>=0)out[y*N+x]=acc/c}}
  return out}
function surfaceLayers(w,H,N,cell,pa){
  const Hs=blur(H,N,6),Hb=blur(H,N,14),cols=new Float32Array(H.length*3),wt=new Float32Array(H.length*2),wa=new Float32Array(H.length),wetv=new Float32Array(H.length),bio=new Uint8Array(H.length);let waterCol=null;
  const at=(x,y)=>H[Math.max(0,Math.min(N-1,y))*N+Math.max(0,Math.min(N-1,x))];
  const slopeAt=(x,y)=>{const gx=(at(x+1,y)-at(x-1,y))/(2*cell),gz=(at(x,y+1)-at(x,y-1))/(2*cell);return Math.hypot(gx,gz)};
  const mean=w.hmean||0,c=new THREE.Color(),BL=planetBiomes(w);
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){
    const i=y*N+x,h=H[i],wx=pa.getX(i),wz=-pa.getZ(i),S=blendSurf(w,wx,wz),L=S.L,ar=S.aridity;
    {const W=biomeWeights(w,wx,wz);let bi=0;for(let k=1;k<BL.length;k++)if(W[k]>W[bi])bi=k;bio[i]=bi}if(L.water&&!waterCol)waterCol=L.water.clone();
    const g=slopeAt(x,y);
    const fray=(fbm(wx*.004,1,wz*.004,7,3)-.5)*.12;
    const curv=(at(x+1,y)+at(x-1,y)+at(x,y+1)+at(x,y-1)-4*h)/(cell*cell)*400; // >0 concave hollow
    const valley=Math.max(0,Math.min(1,(Hs[i]-h)/25+.5));                       // below its surroundings
    let up=0;for(const [dx,dy] of [[2,0],[-2,0],[0,2],[0,-2],[2,2],[-2,-2],[2,-2],[-2,2]]){const n=slopeAt(x+dx,y+dy);if(at(x+dx,y+dy)>h+4)up=Math.max(up,n)}
    const rock=smooth(.2,.42,g+fray);
    const talus=smooth(.18,.36,up)*(1-smooth(.16,.32,g))*(1-rock);
    const moist=Math.max(0,Math.min(1,valley*.7+Math.max(0,curv)*.6+(1-ar)*.35-.15));
    const flat=1-smooth(.05,.2,g);
    const sand=ar*flat*(1-moist*.6)*smooth(.25,.6,fbm(wx*.0011,4,wz*.0011,11,3)+ar*.2);
    const veg=(1-ar)*(1-rock)*(1-talus);
    const grass=veg*smooth(.15,.55,moist+fray);
    const meadow=veg*(1-smooth(.15,.55,moist+fray))*flat;
    const snow=L.snow?smooth(S.snowAlt,S.snowAlt+90,h-mean+fray*200)*(1-rock*.7)*S.snowW:0;
    let pad=0;for(const p of w.pois){const d=Math.hypot(wx-p.x,wz-p.z);if(d<p.r+1300){pad=Math.max(pad,1-smooth(p.r+500,p.r+1300,d))}}
    const dep=Hb[i]-h+(fbm(wx*.0016,8,wz*.0016,13,2)-.5)*10,thr=(S.wet-.5)*25,water=L.water?smooth(thr-1.5,thr+3,dep)*(1-pad)*S.wetW:0;wetv[i]=S.wet;
    const lava=L.lava?smooth(.62,.8,valley)*flat*smooth(.55,.7,fbm(wx*.0015,2,wz*.0015,5,2))*S.lavaW:0;
    const soil=Math.max(0,1-rock-talus-sand-grass-meadow);
    c.setRGB(0,0,0);let tot=0;
    const add=(k,v)=>{if(v<=0||!L[k])return;c.r+=L[k].r*v;c.g+=L[k].g*v;c.b+=L[k].b*v;tot+=v};
    add('rock',rock);add('scree',talus);add('sand',sand);add('grass',grass);add('meadow',meadow);add('soil',soil);
    c.multiplyScalar(1/Math.max(tot,1e-4));
    if(snow>0)c.lerp(L.snow,snow);if(lava>0)c.lerp(L.lava,lava);
    const m=.9+fbm(wx*.02,5,wz*.02,9,2)*.2;c.multiplyScalar(m);if(water>0)c.lerp(L.water,water*.92);
    cols.set([c.r,c.g,c.b],i*3);wt[i*2]=(grass+meadow*.5)*(1-snow)*(1-lava)*(1-water);wt[i*2+1]=talus;wa[i]=water;
  }
  return{cols,wt,wa,Hs:Hb,wetv,bio,waterCol};
}
function scatterFlora(w){
  const S=w.surf||{},G2=w.surfGrid,R=mulberry(w.seed^0x51f1),near=[];
  const blocked=(x,z)=>{for(const p of w.pois)if(Math.hypot(x-p.x,z-p.z)<p.r+40)return true;return false};
  const sample=(x,z,k)=>{const gx=Math.round((x+HALF)/G2.cell),gy=Math.round((z*-1+HALF)/G2.cell);const i=Math.max(0,Math.min(G2.N-1,gy))*G2.N+Math.max(0,Math.min(G2.N-1,gx));return G2.wt[i*2+k]};
  const M=new THREE.Matrix4(),q=new THREE.Quaternion(),sc=new V3(),ps=new V3(),c=new THREE.Color();
  // trees by biome region: each region plants its own species at its own density
  {const BL=planetBiomes(w),groups=new Map();let total=0;w._trees=[];w._treeGrid=null;planRoads(w);
    for(let tries=0;tries<240000&&total<60000;tries++){const x=(R()*2-1)*HALF*.98,z=(R()*2-1)*HALF*.98,b=biomeAt(w,x,z),T=b.surf.tree||SPARSE_TREE[b.key];if(!T)continue;
      const grove=smooth(.42,.62,fbm(x*.0009,6,z*.0009,w.seed%1000+3,3));if(R()>(T.sparse?.6:sample(x,z,0))*grove*1.6*T.density||blocked(x,z)||onRoad(w,x,z))continue;
      const key=T.kind+T.color;(groups.get(key)||groups.set(key,{T,pts:[]}).get(key)).pts.push([x,z,b]);total++}
    for(const {T,pts} of groups.values()){
    const geo=T.kind==='conifer'?new THREE.ConeGeometry(.42,1,7):T.kind==='crystal'?new THREE.OctahedronGeometry(.5,0).scale(.55,1.2,.55):new THREE.IcosahedronGeometry(.55,0);
    geo.translate(0,.5,0);
    const crowns=new THREE.InstancedMesh(geo,new THREE.MeshLambertMaterial(),pts.length);
    const trunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.06,.09,1,5).translate(0,.5,0),new THREE.MeshLambertMaterial({color:0x4a3a2a}),pts.length);
    const base=col(T.color);
    pts.forEach(([x,z,bk],i)=>{const y=groundH(w,x,z),hgt=(T.kind==='conifer'?16+R()*22:10+R()*14)*((bk&&bk.ts)||1),wd=T.kind==='conifer'?hgt*.38:hgt*.75;
      const rot=R()*TAU;q.setFromAxisAngle(new V3(0,1,0),rot);w._trees.push({x,z,y,rot,b:bk,cr:crowns,tr:trunks,i});
      ps.set(x,y+(T.kind==='conifer'?hgt*.18:hgt*.45),-z);sc.set(wd,T.kind==='conifer'?hgt*.85:hgt*.62,wd);M.compose(ps,q,sc);crowns.setMatrixAt(i,M);
      c.copy(base).offsetHSL((R()-.5)*.03,(R()-.5)*.1,(R()-.5)*.08);crowns.setColorAt(i,c);
      ps.set(x,y,-z);sc.set(hgt*.5,hgt*.5,hgt*.5);M.compose(ps,q,sc);trunks.setMatrixAt(i,M)});
    crowns.instanceMatrix.needsUpdate=true;if(crowns.instanceColor)crowns.instanceColor.needsUpdate=true;trunks.instanceMatrix.needsUpdate=true;
    G.ground.add(trunks,crowns)}w.treeCount=total;
    // detail props: rock pillars on mesas and mountains, reeds in lowland wetland
    const pil=[],reeds=[];for(let tries=0;tries<90000;tries++){const x=(R()*2-1)*HALF*.98,z=(R()*2-1)*HALF*.98,b=biomeAt(w,x,z);if(blocked(x,z))continue;
      if((b.land==='mesas'||b.land==='mountains')&&pil.length<900&&R()<.06)pil.push([x,z,b]);else if(b.land==='lowland'&&reeds.length<6000&&R()<.4&&waterDepth(w,x,z)<1.5)reeds.push([x,z])}
    if(pil.length){const pm=new THREE.InstancedMesh(new THREE.CylinderGeometry(.55,1,1,6).translate(0,.5,0),new THREE.MeshLambertMaterial(),pil.length);
      pil.forEach(([x,z,b],i)=>{const hgt=12+R()*R()*55,wd=3+R()*6;q.setFromAxisAngle(new V3(0,1,0),R()*TAU);ps.set(x,groundH(w,x,z)-1,-z);sc.set(wd,hgt,wd*(.7+R()*.5));M.compose(ps,q,sc);pm.setMatrixAt(i,M);c.copy(b.L.rock||b.L.scree).multiplyScalar(.8+R()*.35);pm.setColorAt(i,c)});
      pm.instanceMatrix.needsUpdate=true;if(pm.instanceColor)pm.instanceColor.needsUpdate=true;G.ground.add(pm)}
    if(reeds.length){const rm=new THREE.InstancedMesh(new THREE.ConeGeometry(.08,1,4).translate(0,.5,0),new THREE.MeshLambertMaterial({color:0x5a7a3a}),reeds.length);
      reeds.forEach(([x,z],i)=>{const hgt=1.2+R()*2.2;q.setFromEuler(new THREE.Euler((R()-.5)*.3,R()*3,(R()-.5)*.3));ps.set(x,groundH(w,x,z),-z);sc.set(1+R(),hgt,1+R());M.compose(ps,q,sc);rm.setMatrixAt(i,M)});rm.instanceMatrix.needsUpdate=true;G.ground.add(rm)}
  }
  // boulders on talus fans
  const bpts=[];for(let tries=0;tries<60000&&bpts.length<5000;tries++){const x=(R()*2-1)*HALF,z=(R()*2-1)*HALF;if(R()>sample(x,z,1)*1.4||blocked(x,z))continue;bpts.push([x,z])}
  if(bpts.length){const bm=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1,0),new THREE.MeshLambertMaterial(),bpts.length);
    bpts.forEach(([x,z],i)=>{const s=1.5+R()*R()*7;q.setFromEuler(new THREE.Euler(R()*3,R()*3,R()*3));ps.set(x,groundH(w,x,z)+s*.3,-z);sc.set(s,s*.7,s*1.1);M.compose(ps,q,sc);bm.setMatrixAt(i,M);const bb=biomeAt(w,x,z);c.copy(bb.L.scree||bb.L.rock||col('#888')).multiplyScalar(.75+R()*.35);bm.setColorAt(i,c)});
    bm.instanceMatrix.needsUpdate=true;if(bm.instanceColor)bm.instanceColor.needsUpdate=true;G.ground.add(bm)}
}
function skyDome(hex){
  const g=new THREE.SphereGeometry(30000,32,16),pos=g.attributes.position,cs=new Float32Array(pos.count*3);
  const base=col(hex),zen=base.clone().lerp(col('#1b3352'),.55),hor=base.clone().lerp(col('#ffffff'),.25),c=new THREE.Color();
  for(let i=0;i<pos.count;i++){const t=Math.max(0,pos.getY(i)/30000);c.copy(hor).lerp(zen,Math.pow(t,.6));cs.set([c.r,c.g,c.b],i*3)}
  g.setAttribute('color',new THREE.BufferAttribute(cs,3));
  return new THREE.Mesh(g,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.BackSide,fog:false,depthWrite:false}));
}
const mini=document.getElementById('mini'),mctx=mini.getContext('2d');
function drawMini(){
  if(level!=='ground'||!groundWorld||!groundWorld.miniImg){mini.hidden=true;return}mini.hidden=false;
  const W=mini.width,k=W/EXT,toPx=(x,z)=>[(x+HALF)*k,(HALF-z)*k];
  mctx.imageSmoothingEnabled=true;mctx.drawImage(groundWorld.miniImg,0,0,W,W);
  for(const p of groundWorld.pois){const [px,py]=toPx(p.x,p.z);mctx.fillStyle=CAT_COLOR[p.cat];mctx.beginPath();mctx.arc(px,py,p===curPoi?6:p.cat==='city'?4.5:3,0,TAU);mctx.fill();
    if(p===curPoi){mctx.strokeStyle='#fff';mctx.lineWidth=2;mctx.stroke()}}
  const pos=groundMode==='play'?{x:play.x,z:-play.z}:groundMode==='roam'?roam.pos:ctl.target,yaw=groundMode==='play'?play.yaw:groundMode==='roam'?roam.yaw:ctl.theta,[cx,cy]=toPx(pos.x,-pos.z);
  mctx.save();mctx.translate(cx,cy);mctx.rotate(-yaw);mctx.fillStyle='#fff';mctx.strokeStyle='#000';mctx.lineWidth=2;
  mctx.beginPath();mctx.moveTo(0,-11);mctx.lineTo(7,8);mctx.lineTo(0,4);mctx.lineTo(-7,8);mctx.closePath();mctx.stroke();mctx.fill();mctx.restore();
}
mini.addEventListener('click',e=>{if(busy||level!=='ground')return;const r=mini.getBoundingClientRect(),x=((e.clientX-r.left)/r.width-.5)*EXT,z=(.5-(e.clientY-r.top)/r.height)*EXT;
  const gy=groundH(groundWorld,x,z);
  if(groundMode==='play'){play.x=x;play.z=z;return}
  if(groundMode==='roam'){roam.pos.set(x,gy+28,-z);return}
  busy=true;tweenOrbit({target:new V3(x,gy,-z)},900).then(()=>busy=false);});
function buildGround(w){
  if(groundWorld===w)return;
  w.kitsApplied=false;kitMeshes.length=0;roofMeshes.length=0;
  clearNpcToons();G.ground.remove(toonGroup);if(play.model){G.ground.remove(play.model);play.model=null}
  clearGroup(G.ground);groundWorld=w;indexPois(w);
  const hemi=new THREE.HemisphereLight(0xdfe8f0,0x3a3328,.5);G.ground.add(hemi);
  const sun=new THREE.DirectionalLight(0xfff2dc,.62);sun.position.set(.5,1,.35);G.ground.add(sun);G.ground.userData.sun=sun;G.ground.userData.hemi=hemi;
  const S=(typeof TERRAIN_RES!=='undefined'&&TERRAIN_RES[quality])||288,N=S+1,cell=EXT/S,geo=new THREE.PlaneGeometry(EXT,EXT,S,S);geo.rotateX(-Math.PI/2);
  const pa=geo.attributes.position,H=new Float32Array(pa.count);
  for(let i=0;i<pa.count;i++){H[i]=groundH(w,pa.getX(i),-pa.getZ(i));pa.setY(i,H[i])}
  const surf=surfaceLayers(w,H,N,cell,pa);w.surfGrid={N,cell,wt:surf.wt,water:surf.wa,bio:surf.bio,cols:surf.cols};w.hGrid={H,N,cell};
  geo.setAttribute('color',new THREE.BufferAttribute(surf.cols,3));geo.computeVertexNormals();
  G.ground.add(new THREE.Mesh(geo,groundMaterial(w,geo,pa)));
  buildWater(w,H,N,cell,pa,surf);
  scatterFlora(w);buildRoads(w);clearTravellers();route=null;routeLine=null;autoNav=false;
  {const N2=N,img=document.createElement('canvas');img.width=img.height=N2;const ix=img.getContext('2d'),id=ix.createImageData(N2,N2);
   for(let i=0;i<N2*N2;i++){id.data[i*4]=surf.cols[i*3]*255;id.data[i*4+1]=surf.cols[i*3+1]*255;id.data[i*4+2]=surf.cols[i*3+2]*255;id.data[i*4+3]=255}
   ix.putImageData(id,0,0);w.miniImg=img;}
  const dome=skyDome(w.biome.sky);G.ground.add(dome);skyMesh=dome;
  // POI rings
  w.pois.forEach(p=>{const pts=[];for(let a=0;a<=64;a++){const ax=p.x+Math.cos(a/64*TAU)*p.r,az=p.z+Math.sin(a/64*TAU)*p.r;pts.push(new V3(ax,groundH(w,ax,az)+1.5,-az))}
    G.ground.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:CAT_COLOR[p.cat],transparent:true,opacity:.85})));
    const disc=new THREE.Mesh(new THREE.CircleGeometry(p.r,48),new THREE.MeshBasicMaterial({color:CAT_COLOR[p.cat],transparent:true,opacity:.13,depthWrite:false}));
    disc.rotation.x=-Math.PI/2;disc.position.set(p.x,p.base+1,-p.z);G.ground.add(disc)});
  // placements
  mapNpcs(w);
  const P=w.placements,m=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshLambertMaterial(),P.length);
  const heads=[];
  const M=new THREE.Matrix4(),q=new THREE.Quaternion(),sc=new V3(),ps=new V3(),c=new THREE.Color(),st=STYLE[w.id]||{wall:'#bcae96',roof:'flat'},roofs=[],R=mulberry(w.seed^77);
  P.forEach((p,i)=>{const cls=clsOf(p);let s=Math.max(1.6,Math.min(p.r*1.15,70)),hgt=cls==='building'?Math.max(4,s*.55):Math.max(1.2,s*.35);
    let sd=null;if(cls==='npc'){const sh=npcShape(p);s=sh.w;sd=sh.d;hgt=sh.h;p.npcC=sh.c}else if(cls==='travel'){s=10;hgt=36}else if(cls==='object'){s=3;hgt=3}else if(p.w){s=p.w;sd=p.d;hgt=p.h}
    p.gy=groundH(w,p.x,p.z);ps.set(p.x,p.gy+hgt/2,-p.z);q.setFromAxisAngle(new V3(0,1,0),(p.yaw!=null?-p.yaw:strHash(p.t+i)%360)*Math.PI/180);sc.set(s,hgt,sd??s);
    M.compose(ps,q,sc);m.setMatrixAt(i,M);
    const military=/military|imperial|rebel|bunker|outpost/.test(p.t);
    if(cls==='building'){c.set(military?'#9ba1a7':st.wall).offsetHSL(0,0,(R()-.5)*.06);
      const shape=military?'flat':/tatooine/.test(p.t)?'dome':st.roof;
      if(shape!=='flat')roofs.push({i,shape,x:p.x,y:p.gy+hgt,z:p.z,w:s,d:sd??s,h:hgt,q:q.clone()})}
    else if(cls==='static'&&p.w)c.set(st.wall).multiplyScalar(.82);
    else if(cls==='npc')c.set(p.npcC);
    else c.set(CLASS_COLOR[cls]);
    m.setColorAt(i,c);
    if(cls==='npc'&&p.g&&p.g.kind!=='boss'&&!(p.g.kind==='hostile'&&QUAD.has(p.g.cat)))heads.push({i,x:p.x,y:p.gy+hgt+s*.35,z:p.z,r:s*.42,c:p.g.kind==='friendly'?(RACE_BODY[p.g.race]||{}).skin:p.npcC})});
  m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true;
  G.ground.add(m);markers=m;m.userData.orig=Float32Array.from(m.instanceMatrix.array);
  if(heads.length){const hm=new THREE.InstancedMesh(new THREE.SphereGeometry(1,8,6),new THREE.MeshLambertMaterial(),heads.length);
    heads.forEach((h,i)=>{ps.set(h.x,h.y,-h.z);sc.setScalar(h.r);q.identity();M.compose(ps,q,sc);hm.setMatrixAt(i,M);c.set(h.c||'#ccc');hm.setColorAt(i,c)});
    hm.instanceMatrix.needsUpdate=true;if(hm.instanceColor)hm.instanceColor.needsUpdate=true;G.ground.add(hm);
    hm.userData.orig=Float32Array.from(hm.instanceMatrix.array);hm.userData.byPlacement=new Map(heads.map((h,k)=>[h.i,k]));m.userData.heads=hm}
  for(const shape of ['dome','pyramid']){const list=roofs.filter(r=>r.shape===shape);if(!list.length)continue;
    const geo=shape==='dome'?new THREE.SphereGeometry(.5,14,7,0,TAU,0,Math.PI/2):new THREE.ConeGeometry(.72,1,4).rotateY(Math.PI/4).translate(0,.5,0);
    const rm=new THREE.InstancedMesh(geo,new THREE.MeshLambertMaterial({color:st.roofc||st.wall}),list.length);
    list.forEach((r,i)=>{ps.set(r.x,r.y,-r.z);shape==='dome'?sc.set(Math.min(r.w,r.d)*.92,Math.min(r.w,r.d)*.55,Math.min(r.w,r.d)*.92):sc.set(r.w*1.02,Math.min(r.w,r.d)*.35,r.d*1.02);M.compose(ps,r.q,sc);rm.setMatrixAt(i,M)});
    rm.instanceMatrix.needsUpdate=true;rm.userData.pidx=list.map(r=>r.i);roofMeshes.push(rm);G.ground.add(rm)}
  applyKits(w);waypoint=null;placeStarportWhales(w);if(kitReady)drawHarvesters();else kitWaiters.push(()=>{if(groundWorld===w)drawHarvesters()});
  selMarker=new THREE.Mesh(new THREE.RingGeometry(1,1.25,40),new THREE.MeshBasicMaterial({color:0xffffff,side:THREE.DoubleSide}));selMarker.rotation.x=-Math.PI/2;selMarker.visible=false;G.ground.add(selMarker);
}

/* ---------------- camera control ---------------- */
const ctl={target:new V3(),dist:600,theta:.4,phi:1.0,min:5,max:2000,pmin:.05,pmax:Math.PI-.05};
const roam={pos:new V3(),yaw:0,pitch:0};
let level='galaxy',groundMode='overhead',busy=false,tween=null;
function applyOrbit(){const s=Math.sin(ctl.phi);cam.position.set(ctl.target.x+ctl.dist*s*Math.sin(ctl.theta),ctl.target.y+ctl.dist*Math.cos(ctl.phi),ctl.target.z+ctl.dist*s*Math.cos(ctl.theta));cam.lookAt(ctl.target)}
function roamDir(){return new V3(-Math.sin(roam.yaw)*Math.cos(roam.pitch),Math.sin(roam.pitch),-Math.cos(roam.yaw)*Math.cos(roam.pitch))}
function applyRoam(){cam.position.copy(roam.pos);cam.lookAt(roam.pos.clone().add(roamDir()))}
const ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
function tweenOrbit(to,ms){return new Promise(res=>{
  const from={target:ctl.target.clone(),dist:ctl.dist,theta:ctl.theta,phi:ctl.phi};
  let dt=((to.theta??from.theta)-from.theta)%TAU;if(dt>Math.PI)dt-=TAU;if(dt<-Math.PI)dt+=TAU;
  tween={t0:performance.now(),ms:reduce?1:ms,step:k=>{const e=ease(k);
    if(to.target)ctl.target.lerpVectors(from.target,to.target,e);
    if(to.dist!=null)ctl.dist=Math.exp(Math.log(from.dist)+(Math.log(to.dist)-Math.log(from.dist))*e);
    ctl.theta=from.theta+dt*e;if(to.phi!=null)ctl.phi=from.phi+(to.phi-from.phi)*e;applyOrbit()},done:res};});}
function tweenPose(toPos,toLook,ms){return new Promise(res=>{
  const fp=cam.position.clone(),fl=cam.position.clone().add(cam.getWorldDirection(new V3()).multiplyScalar(100));
  tween={t0:performance.now(),ms:reduce?1:ms,step:k=>{const e=ease(k);cam.position.lerpVectors(fp,toPos,e);cam.lookAt(fl.clone().lerp(toLook,e))},done:res};});}
const sleep=ms=>new Promise(r=>setTimeout(r,reduce?0:ms));
async function fade(on){$('#fade').style.opacity=on?1:0;await sleep(270)}

function setLevel(l){
  level=l;for(const k in G)G[k].visible=(k===l);
  const space=l!=='ground';bgStars.visible=space;
  if(space){scene.background=col('#06080c');scene.fog=null;cam.near=.05;cam.far=8000}
  else{const sky=col(groundWorld.biome.sky).lerp(col('#ffffff'),.25);scene.background=sky;scene.fog=new THREE.Fog(sky,4000,17000);cam.near=1;cam.far=60000}
  cam.updateProjectionMatrix();
  Object.assign(ctl,{galaxy:{min:40,max:1400,pmin:.15,pmax:1.45},system:{min:10,max:260,pmin:.12,pmax:1.5},planet:{min:12.5,max:80,pmin:.05,pmax:Math.PI-.05},ground:{min:40,max:12000,pmin:.02,pmax:1.25}}[l]);
  $('#groundSeg').hidden=l!=='ground';
  renderUI();
}

/* ---------------- navigation ---------------- */
let curWorld=null,curPoi=null,selPlacement=null;
async function goGalaxy(){
  if(busy)return;busy=true;
  if(level!=='galaxy'){await tweenOrbit({dist:ctl.dist*2.2},380);await fade(1)}
  curPoi=null;selPlacement=null;groundMode='overhead';
  setLevel('galaxy');
  const from=curWorld&&curWorld.gpos;ctl.target.copy(from||new V3());ctl.dist=from?60:300;ctl.phi=.9;applyOrbit();
  await fade(0);await tweenOrbit({target:new V3(),dist:620,phi:.95},1100);busy=false;
}
async function goSystem(w){
  if(busy)return;busy=true;
  if(level==='galaxy'){await tweenOrbit({target:w.gpos.clone(),dist:28},650);await fade(1)}
  else if(level!=='system'){await tweenOrbit({dist:ctl.dist*2.2},380);await fade(1)}
  curWorld=w;curPoi=null;buildSystem(w);setLevel('system');
  const back=level==='system'&&false;
  ctl.target.set(0,0,0);ctl.dist=240;ctl.phi=.75;applyOrbit();
  await fade(0);await tweenOrbit({dist:120,phi:1.0,theta:Math.atan2(sysWorldMesh.position.x,sysWorldMesh.position.z)+.5},1000);busy=false;
}
async function goPlanet(w,focusPoi){
  if(busy)return;busy=true;
  const from=level;
  if(from==='system'){await tweenOrbit({target:sysWorldMesh.position.clone(),dist:7},650);await fade(1)}
  else if(from==='galaxy'){await tweenOrbit({target:w.gpos.clone(),dist:20},600);await fade(1)}
  else if(from==='ground'){await tweenOrbit({dist:Math.min(ctl.dist*3,12000),phi:.3},420);await fade(1)}
  if(curWorld!==w||!planetMesh||planetMesh.material.map!==planetTexture(w))buildPlanet(w);
  curWorld=w;groundMode='overhead';
  setLevel('planet');
  const f=focusPoi||curPoi;
  const d=f?f.spos.clone().normalize():new V3(.4,.35,.85).normalize();
  ctl.target.set(0,0,0);ctl.theta=Math.atan2(d.x,d.z);ctl.phi=Math.acos(d.y);
  ctl.dist=from==='ground'?13:80;applyOrbit();
  await fade(0);await tweenOrbit({dist:f?22:34},1000);
  if(focusPoi)selectPoi(focusPoi);
  busy=false;
}
async function focusPinOnPlanet(poi){
  const d=poi.spos.clone().normalize();
  selectPoi(poi);
  await tweenOrbit({theta:Math.atan2(d.x,d.z),phi:Math.acos(d.y),dist:Math.min(ctl.dist,22)},800);
}
async function goGround(poi,mode='overhead'){
  if(busy)return;busy=true;
  const w=curWorld;
  if(level==='planet'){await tweenOrbit({dist:12.6},600);await fade(1)}
  else if(level!=='ground'){await fade(1)}
  if(level!=='ground'){
    buildGround(w);curPoi=poi;setLevel('ground');
    ctl.target.set(poi.x,poi.base??groundH(w,poi.x,poi.z),-poi.z);ctl.dist=9000;ctl.phi=.12;ctl.theta=0;applyOrbit();
    await fade(0);
  }else{curPoi=poi;}
  selectPoi(poi);
  if(groundMode==='play')exitPlay();
  if(groundMode==='roam'){groundMode='overhead';renderUI()}
  await tweenOrbit({target:new V3(poi.x,poi.base,-poi.z),dist:Math.max(220,poi.r*2.6),phi:.62},1100);
  busy=false;
  if(pendingPlay){pendingPlay=false;enterPlay()}else if(mode==='roam')enterRoam();
}
async function enterRoam(){
  if(level!=='ground'||busy)return;busy=true;groundMode='roam';renderUI();
  const t=ctl.target,w=groundWorld;
  roam.yaw=ctl.theta;roam.pitch=-.12;
  const back=new V3(Math.sin(ctl.theta),0,Math.cos(ctl.theta)).multiplyScalar(Math.max(120,(curPoi?curPoi.r:100)*1.3));
  roam.pos.set(t.x+back.x,0,t.z+back.z);roam.pos.y=groundH(w,roam.pos.x,-roam.pos.z)+28;
  await tweenPose(roam.pos.clone(),roam.pos.clone().add(roamDir().multiplyScalar(100)),1000);
  busy=false;
}
async function exitRoam(){
  if(level!=='ground'||busy)return;busy=true;groundMode='overhead';renderUI();
  const f=roamDir();ctl.target.set(roam.pos.x+f.x*150,0,roam.pos.z+f.z*150);ctl.target.y=groundH(groundWorld,ctl.target.x,-ctl.target.z);
  ctl.theta=roam.yaw;ctl.phi=.62;ctl.dist=Math.max(220,ctl.dist);
  const s=Math.sin(ctl.phi),to=new V3(ctl.target.x+ctl.dist*s*Math.sin(ctl.theta),ctl.target.y+ctl.dist*Math.cos(ctl.phi),ctl.target.z+ctl.dist*s*Math.cos(ctl.theta));
  await tweenPose(to,ctl.target.clone(),900);applyOrbit();busy=false;
}
function goUp(){
  if(busy)return;
  if(level==='ground'){if(!cr.hidden){closeCreator();return}if(groundMode==='play')exitPlay();else if(groundMode==='roam')exitRoam();else goPlanet(curWorld)}
  else if(level==='planet')goSystem(curWorld);
  else if(level==='system')goGalaxy();
}

/* ---------------- selection ---------------- */
function selectPoi(poi){
  curPoi=poi;selPlacement=null;
  if(level==='planet'&&pinSelRing){pinSelRing.visible=!!poi;if(poi){pinSelRing.position.copy(poi.spos.clone().multiplyScalar(1.002));pinSelRing.lookAt(poi.spos.clone().multiplyScalar(2))}}
  if(level==='ground'&&selMarker)selMarker.visible=false;
  renderUI();
}
function selectPlacement(i){
  const p=groundWorld.placements[i];selPlacement=p;
  if(p.poi!=null)curPoi=groundWorld.pois[p.poi];
  const s=(p.k==='travel'?10:p.k==='npc'?1.4:p.w?Math.max(p.w,p.d)*.75:Math.max(4,Math.min(p.r*1.15,70)))*.8+3;selMarker.scale.setScalar(s);selMarker.position.set(p.x,p.gy+1,-p.z);selMarker.visible=true;
  renderUI();
}

/* ---------------- UI ---------------- */
const chipState=new Set(Object.keys(CATS));
let query='';
function crumbs(){
  const c=[['Galaxy',()=>goGalaxy(),level==='galaxy']];
  if(curWorld&&level!=='galaxy'){
    c.push([curWorld.name+' system',()=>level!=='system'&&goSystem(curWorld),level==='system']);
    if(level==='planet'||level==='ground')c.push([curWorld.name,()=>level!=='planet'&&goPlanet(curWorld),level==='planet']);
    if(level==='ground'&&curPoi)c.push([curPoi.name,()=>groundMode==='roam'?exitRoam():goGround(curPoi),true]);
  }
  const nav=$('#crumbs');nav.innerHTML='';
  c.forEach(([t,fn,cur],i)=>{if(i){const s=document.createElement('span');s.className='sep';s.textContent='/';nav.append(s)}
    const b=document.createElement('button');b.textContent=t;if(cur&&i===c.length-1)b.setAttribute('aria-current','page');b.onclick=fn;nav.append(b)});
}
function renderList(){
  const list=$('#list'),chips=$('#chips');list.innerHTML='';chips.innerHTML='';
  const q=query.trim().toLowerCase();
  if(level==='galaxy'){
    $('#pEyebrow').textContent='Galaxy · '+WORLDS.length+' worlds';$('#pTitle').textContent='Worlds';
    WORLDS.filter(w=>!q||w.name.includes(q)).forEach(w=>{
      const li=document.createElement('li'),b=document.createElement('button');
      b.style.setProperty('--c',w.biome.glow);
      b.innerHTML=`<span class="dot"></span><span class="nm"></span><span class="ct">${w.pois.length} POI</span>`;
      b.querySelector('.nm').textContent=w.name;const sub=document.createElement('span');sub.className='sub';sub.textContent=`${w.placements.length.toLocaleString()} exterior placements`;b.querySelector('.nm').append(sub);
      b.onclick=()=>goSystem(w);li.append(b);list.append(li)});
    if(!list.children.length)list.innerHTML='<li class="empty">No worlds match that filter.</li>';
    return;
  }
  const w=curWorld;
  $('#pEyebrow').textContent=(level==='system'?'System':level==='planet'?'Planet':groundMode==='roam'?'Free roam':groundMode==='play'?'Playing':'Overhead')+' · '+w.pois.length+' POIs';
  $('#pTitle').textContent=w.name;
  const counts={};w.pois.forEach(p=>counts[p.cat]=(counts[p.cat]||0)+1);
  for(const k in CATS){if(!counts[k])continue;const b=document.createElement('button');b.className='chip';b.style.setProperty('--c',CAT_COLOR[k]);
    b.setAttribute('aria-pressed',chipState.has(k));b.innerHTML=`<i></i>${CATS[k]} ${counts[k]}`;b.onclick=()=>{chipState.has(k)?chipState.delete(k):chipState.add(k);renderList()};chips.append(b)}
  const items=w.pois.filter(p=>chipState.has(p.cat)&&(!q||p.name.toLowerCase().includes(q)||p.top.some(([t])=>t.includes(q))));
  items.forEach(p=>{
    const li=document.createElement('li'),b=document.createElement('button');b.style.setProperty('--c',CAT_COLOR[p.cat]);
    if(p===curPoi)b.setAttribute('aria-current','true');
    b.innerHTML=`<span class="dot"></span><span class="nm"></span><span class="ct">${p.n||''}</span>`;
    b.querySelector('.nm').textContent=p.name;const sub=document.createElement('span');sub.className='sub';sub.textContent=`${CATS[p.cat]} · ${fmt(p.x)}, ${fmt(p.z)}`;b.querySelector('.nm').append(sub);
    b.onclick=()=>poiClick(p);li.append(b);list.append(li)});
  if(!items.length)list.innerHTML='<li class="empty">No POIs match. Clear the filter or turn categories back on.</li>';
}
function poiClick(p){
  if(busy)return;
  if(level==='ground')goGround(p);
  else if(level==='planet')focusPinOnPlanet(p);
  else goPlanet(curWorld,p);
}
function renderInfo(){
  const box=$('#info');
  if(level==='galaxy'||level==='system'||(!curPoi&&!selPlacement)){box.hidden=true;return}
  box.hidden=false;
  if(selPlacement){
    const p=selPlacement,cl=clsOf(p);box.style.setProperty('--c',CLASS_COLOR[cl]);
    if(p.k==='npc'&&p.g){const n=npcInfoHTML(p);box.style.setProperty('--c',n.c);box.innerHTML=`<button class="x" aria-label="Close">×</button><div class="eyebrow">${n.eye}</div><h3>${n.title}</h3><dl>${n.dl}</dl><div class="acts"></div>`;
      box.querySelector('.x').onclick=()=>{selPlacement=null;if(selMarker)selMarker.visible=false;box.hidden=true};npcActions(box,p);return}
    box.innerHTML=`<button class="x" aria-label="Close">×</button><div class="eyebrow">${CLS_NAME[cl]}</div><h3></h3>
    <dl><dt>${p.k==='npc'?'Mobile':'Template'}</dt><dd class="t"></dd><dt>Position</dt><dd>X ${fmt(p.x)} · Y ${fmt(p.y||0)} · Z ${fmt(p.z)}</dd>${p.w?`<dt>Footprint</dt><dd>~${p.w} × ${p.d} m · facing ${p.yaw}°</dd>`:''}<dt>POI</dt><dd class="pn">${p.poi!=null?'':'none'}</dd></dl>
    <div class="acts"></div>`;
    box.querySelector('h3').textContent=p.k==='travel'?p.t:p.t.startsWith('crc:')?'Unnamed object':prettify(p.t);box.querySelector('.t').textContent=p.t||'(no template)';
    if(p.poi!=null)box.querySelector('.pn').textContent=groundWorld.pois[p.poi].name;
  }else{
    const p=curPoi;box.style.setProperty('--c',CAT_COLOR[p.cat]);
    box.innerHTML=`<button class="x" aria-label="Close">×</button><div class="eyebrow">${CATS[p.cat]}</div><h3></h3>
    <dl><dt>Center</dt><dd>X ${fmt(p.x)} · Z ${fmt(p.z)}${p.known!=null?' · Y '+fmt(p.known):''}</dd><dt>Radius</dt><dd>${fmt(p.r)} m</dd><dt>Objects</dt><dd>${p.n}</dd>${p.src?'<dt>Source</dt><dd class="sr"></dd>':''}<dt>${p.n?'Most common':''}</dt><dd class="tt"></dd></dl>
    <div class="acts"></div>`;
    box.querySelector('h3').textContent=p.name;
    box.querySelector('.tt').textContent=p.top.slice(0,3).map(([t,c])=>`${c}× ${prettify(t)}`).join(', ');
    const SRC={region:'Core3 region',screenplay:'Core3 screenplay',badge:'Exploration badge'};
    if(p.src)box.querySelector('.sr').textContent=[p.src,...(p.also||[])].map(k=>SRC[k]||k).join(' + ');
    const acts=box.querySelector('.acts');
    const mk=(t,fn,pri)=>{const b=document.createElement('button');b.className='btn'+(pri?' primary':'');b.textContent=t;b.onclick=fn;acts.append(b)};
    if(level==='planet'){mk('Overhead',()=>goGround(p),true);mk('Free roam here',()=>goGround(p,'roam'))}
    else if(level==='ground'){if(groundMode==='roam')mk('Back to overhead',exitRoam,true);else mk('Free roam here',()=>goGround(p,'roam'),true)}
  }
  box.querySelector('.x').onclick=()=>{selPlacement=null;if(selMarker)selMarker.visible=false;if(!selPlacement)curPoi=level==='ground'?curPoi:null;if(level!=='ground'&&pinSelRing)pinSelRing.visible=false;box.hidden=true;if(level!=='ground')renderList()};
}
const HINTS={galaxy:'Drag to orbit · scroll to zoom · click a system',system:'Click the bright world to enter orbit · Esc back',planet:'Click a pin or a POI in the list · Esc back',
  play:'W A S D move · Q E turn · right-drag to look · scroll to zoom · Shift run · Space jump · Shift+M map · Esc menu · P leave play',overhead:'Drag to pan · right-drag or Shift-drag to rotate and tilt · F free roam · Esc planet',roam:'W A S D move · drag to look · Q / E down, up · Shift fast · Esc overhead'};
function renderUI(){
  crumbs();renderList();renderInfo();
  $('#hint').textContent=HINTS[level==='ground'?groundMode:level];
  document.querySelectorAll('#groundSeg button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.gm===groundMode));
  const n=WORLDS.reduce((a,w)=>a+w.placements.length,0);
  $('#srcNote').innerHTML=DEMO?`<span class="tag">Live data</span><b>${n.toLocaleString()}</b> exterior placements: buildings, statics, points of interest, cities, travel points and spawns from open-source world data. Terrain heights are interpolated from object heights; footprints are estimated from template names.`
    :`<b>${WORLDS.length}</b> worlds · <b>${n.toLocaleString()}</b> exterior placements (Core3 spawns plus your snapshot files). Terrain heights are interpolated from known heights until .trn heightfields are decoded.`;
}
let toastT;function toast(t){const e=$('#toast');e.textContent=t;e.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>e.hidden=true,4200)}

$('#search').addEventListener('input',e=>{query=e.target.value;renderList()});
$('#pToggle').onclick=()=>{const p=$('#panel'),c=p.classList.toggle('collapsed');$('#pToggle').textContent=c?'Show':'Hide';$('#pToggle').setAttribute('aria-expanded',!c)};
document.querySelectorAll('#groundSeg button').forEach(b=>b.onclick=()=>{const m=b.dataset.gm;if(m===groundMode)return;if(groundMode==='play')exitPlay();if(m==='roam')enterRoam();else if(m==='overhead'&&groundMode==='roam')exitRoam();else if(m==='play'){if(groundMode==='roam'){groundMode='overhead'}enterPlay()}});

/* ---------------- loading ---------------- */
$('#loadBtn').onclick=()=>$('#file').click();
$('#file').onchange=e=>loadFiles([...e.target.files]);
let dragDepth=0;
addEventListener('dragenter',e=>{e.preventDefault();dragDepth++;$('#drop').hidden=false});
addEventListener('dragleave',()=>{if(--dragDepth<=0){dragDepth=0;$('#drop').hidden=true}});
addEventListener('dragover',e=>e.preventDefault());
addEventListener('drop',e=>{e.preventDefault();dragDepth=0;$('#drop').hidden=true;loadFiles([...e.dataTransfer.files])});
async function loadFiles(files){
  files=files.filter(f=>/\.(geo)?json$/i.test(f.name));
  if(!files.length){toast('Choose .json or .geojson files from out/worlds/.');return}
  const got=new Map(),errs=[];let skipped=0;
  for(const f of files){try{const r=parseWorldFile(f.name,await f.text());skipped+=r.skipped;
      if(!r.placements.length){errs.push(f.name+' had no exterior placements');continue}
      const prev=got.get(r.id);if(prev&&prev.length>=r.placements.length)continue;got.set(r.id,r.placements);}
    catch(err){errs.push(f.name+': '+err.message)}}
  if(!got.size){toast('Nothing loaded. '+errs.join('; '));return}
  DEMO=false;
  for(const [id,pl] of got){const i=WORLDS.findIndex(w=>w.id===id);const c3=CORE3.worlds.find(w=>w.id===id);
    const base=buildoutPlacements(id).concat(c3?c3.placements.map(p=>({...p})):[]);const w=finalizeWorld(id,base.concat(pl),false,c3?c3.pois:null);addTrainers(w);
    if(i>=0)WORLDS[i]=w;else WORLDS.push(w)}
  groundWorld=null;curWorld=null;curPoi=null;buildGalaxy();spawnGalaxyWhales();
  busy=false;level='planet';await goGalaxy();
  const n=[...got.values()].reduce((a,p)=>a+p.length,0);
  toast(`Loaded ${got.size} world${got.size>1?'s':''}: ${n.toLocaleString()} exterior placements`+(skipped?`, ${skipped.toLocaleString()} interior skipped`:'')+(errs.length?`. Problems: ${errs.join('; ')}`:''));
}

/* ---------------- input ---------------- */
const ptrs=new Map();let downPos=null,moved=0,pinch0=0,btn=0,shift=false;
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(ptrs.size===1){downPos={x:e.clientX,y:e.clientY};moved=0;btn=e.button;shift=e.shiftKey}
  if(ptrs.size===2){const [a,b]=[...ptrs.values()];pinch0=Math.hypot(a.x-b.x,a.y-b.y)}
  canvas.classList.add('dragging')});
canvas.addEventListener('pointermove',e=>{
  const p=ptrs.get(e.pointerId);if(!p)return;const dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;moved+=Math.abs(dx)+Math.abs(dy);
  if(busy)return;
  if(ptrs.size===2){const [a,b]=[...ptrs.values()],d=Math.hypot(a.x-b.x,a.y-b.y);if(pinch0){zoomBy(pinch0/d)}pinch0=d;return}
  if(level==='ground'&&groundMode==='play'){if(rts.on)return;play.camYaw-=dx*.005;play.camPitch=Math.max(-.45,Math.min(1.25,play.camPitch+dy*.004));return}
  if(level==='ground'&&groundMode==='roam'){roam.yaw-=dx*.004;roam.pitch=Math.max(-1.45,Math.min(1.45,roam.pitch-dy*.004));return}
  if(level==='ground'&&!(btn===2||shift)){
    const k=ctl.dist*.0016,r=new V3(Math.cos(ctl.theta),0,-Math.sin(ctl.theta)),f=new V3(-Math.sin(ctl.theta),0,-Math.cos(ctl.theta));
    ctl.target.addScaledVector(r,-dx*k).addScaledVector(f,dy*k);
    ctl.target.x=Math.max(-HALF,Math.min(HALF,ctl.target.x));ctl.target.z=Math.max(-HALF,Math.min(HALF,ctl.target.z));
    ctl.target.y=groundH(groundWorld,ctl.target.x,-ctl.target.z);applyOrbit();return}
  ctl.theta-=dx*.005;ctl.phi=Math.max(ctl.pmin,Math.min(ctl.pmax,ctl.phi-dy*.005));applyOrbit();
});
const endPtr=e=>{const had=ptrs.delete(e.pointerId);if(ptrs.size<2)pinch0=0;if(!ptrs.size)canvas.classList.remove('dragging');
  if(had&&!ptrs.size&&moved<6&&e.type==='pointerup'&&!busy)click(e.clientX,e.clientY)};
canvas.addEventListener('pointerup',endPtr);canvas.addEventListener('pointercancel',endPtr);
function zoomBy(f){if(busy)return;
  if(level==='ground'&&groundMode==='play'){if(rts.on){rts.dist=Math.max(25,Math.min(420,rts.dist*f));return}play.dist=Math.max(1.6,Math.min(22,play.dist*f));return}
  if(level==='ground'&&groundMode==='roam'){roam.pos.addScaledVector(roamDir(),(1-f)*120);return}
  ctl.dist=Math.max(ctl.min,Math.min(ctl.max,ctl.dist*f));applyOrbit()}
canvas.addEventListener('wheel',e=>{e.preventDefault();zoomBy(Math.exp(e.deltaY*.0012))},{passive:false});
$('#zin').onclick=()=>zoomBy(.75);$('#zout').onclick=()=>zoomBy(1.33);

const ray=new THREE.Raycaster(),ndc=new THREE.Vector2();
function click(x,y){if(rts.on&&level==='ground'&&groundMode==='play'){rtsClick(x,y,keys.has('shift'));return}
  ndc.set(x/innerWidth*2-1,-(y/innerHeight)*2+1);ray.setFromCamera(ndc,cam);
  if(level==='galaxy'){const h=ray.intersectObjects(sysPick)[0];if(h)goSystem(h.object.userData.world)}
  else if(level==='system'){if(ray.intersectObject(sysWorldMesh)[0])goPlanet(curWorld)}
  else if(level==='planet'){
    const hits=ray.intersectObjects([planetMesh,...pinMeshes]);const front=hits[0];
    const pin=hits.find(h=>h.object!==planetMesh&&(!front||front.object!==planetMesh||h.distance<front.distance+.6));
    if(pin){const p=pin.object.userData.poi;if(curPoi===p)goGround(p);else focusPinOnPlanet(p)}
  }else if(level==='ground'&&markers){const kh=ray.intersectObjects(kitMeshes,false)[0];const tb=ray.intersectObjects(toonGroup.children,true).find(h=>h.object.visible&&h.object.userData.placement!=null);
    if(kh&&(!tb||kh.distance<tb.distance)){const pi=kh.object.userData.pidx&&kh.object.userData.pidx[kh.instanceId];if(pi!=null&&pi>=0){selectPlacement(pi);return}}
    const t=ray.intersectObjects(toonGroup.children,true).find(h=>h.object.visible&&h.object.userData.placement!=null);if(t){selectPlacement(t.object.userData.placement);return}
    const h=ray.intersectObject(markers)[0];if(h&&h.instanceId!=null)selectPlacement(h.instanceId)}
}
const keys=new Set();
addEventListener('keydown',e=>{if(e.target.tagName==='INPUT')return;const k=e.key.toLowerCase();keys.add(k);
  // in play, Esc with nothing open brings up the game menu instead of dropping you out of your character
  if(k==='escape'){if(!cr.hidden){closeCreator();return}if(level==='ground'&&groundMode==='play'&&CH){openWin('menu');return}goUp()}
  else if(k==='f'&&level==='ground'&&groundMode!=='play')groundMode==='roam'?exitRoam():enterRoam();
  else if(k==='p'&&level==='ground'){groundMode==='play'?exitPlay():(groundMode==='roam'&&(groundMode='overhead'),enterPlay())}});
addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
addEventListener('blur',()=>keys.clear());

/* ---------------- labels ---------------- */
const lblLayer=$('#labels'),pool=[],tmp=new V3();
function labels(items){
  let i=0;const W=innerWidth,H=innerHeight;
  for(const it of items){tmp.copy(it.pos).project(cam);if(tmp.z>1||tmp.z<-1)continue;
    const x=(tmp.x*.5+.5)*W,y=(-tmp.y*.5+.5)*H;if(x<-40||x>W+40||y<-20||y>H+20)continue;
    let el=pool[i];if(!el){el=document.createElement('div');el.className='lbl';lblLayer.append(el);pool.push(el)}
    if(el._k!==it.key){el._k=it.key;el.innerHTML='';el.append(it.text);if(it.sub){const s=document.createElement('small');s.textContent=it.sub;el.append(s)}}
    el.className='lbl'+(it.cls?' '+it.cls:'');el.style.transform=`translate(${x}px,${y}px) translate(-50%,-135%)`;el.style.display='';
    if(++i>=48)break;}
  for(;i<pool.length;i++)pool[i].style.display='none';
}
function labelItems(){
  if(level==='galaxy')return WORLDS.map(w=>({key:'g'+w.id,pos:w.gpos,text:w.name,sub:w.pois.length+' POIs',cls:w===curWorld?'sel':''}));
  if(level==='system')return[{key:'s'+curWorld.id,pos:sysWorldMesh.position.clone().add(new V3(0,2.6,0)),text:curWorld.name,sub:'click to orbit'}];
  if(level==='planet'){const cd=cam.position.clone().normalize();
    return curWorld.pois.filter(p=>p===curPoi||(p.spos.clone().normalize().dot(cd)>.35&&(p.cat==='city'||ctl.dist<26))).sort((a,b)=>(b===curPoi)-(a===curPoi)||b.n-a.n).slice(0,24)
      .map(p=>({key:'p'+p.id,pos:p.spos.clone().multiplyScalar(1.01),text:p.name,cls:p===curPoi?'sel':'dim'}));}
  if(level==='ground'){const out=[];for(const p of groundWorld.pois){const pos=new V3(p.x,p.base+Math.max(14,p.r*.12),-p.z);const d=pos.distanceTo(cam.position);
      if(d<(groundMode==='play'?(p.cat==='city'?2500:900):p.cat==='city'?9000:4500)||p===curPoi)out.push({key:'q'+p.id,pos,text:p.name,sub:p===curPoi?`${CATS[p.cat]} · ${p.n} objects`:'',cls:p===curPoi?'sel':'',d})}
    if(groundMode!=='overhead'){const cp=groundMode==='play'?new V3(play.x,0,-play.z):cam.position,npcs=[];
      for(const p of groundWorld.placements){if(p.k!=='npc'||!p.g||p.dead)continue;const d=Math.hypot(p.x-cp.x,-p.z-cp.z);if(d<140&&!(groundMode==='play'&&d<46))npcs.push({p,d})}
      npcs.sort((a,b)=>a.d-b.d).slice(0,12).forEach(({p,d})=>{const sh=npcShape(p);out.push({key:'n'+p.x+p.z,pos:new V3(p.x,p.gy+sh.h+1.2,-p.z),text:p.g.kind==='friendly'?`${p.g.name}`:p.g.name,
        sub:p.g.kind==='friendly'?`${RACE[p.g.race].name} ${p.g.role}`:`T${p.g.tier} ${p.g.kind==='boss'?'Boss':GD.enemyCats[p.g.cat]||''}`,cls:p.g.kind==='friendly'?'friendly':p.g.kind,d:d-1e6})})}
    return out.sort((a,b)=>(b.cls==='sel')-(a.cls==='sel')||a.d-b.d).slice(0,36);}
  return[];
}

/* ---------------- loop ---------------- */
function resize(){const w=innerWidth,h=innerHeight;renderer.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix()}
addEventListener('resize',resize);
let last=performance.now();
function frame(now){
  const dt=Math.min(.05,(now-last)/1000);last=now;
  if(tween){const k=Math.min(1,(now-tween.t0)/tween.ms);tween.step(k);if(k>=1){const d=tween.done;tween=null;d()}}
  else if(level==='ground'&&groundMode==='play'){updatePlay(dt)}
  else if(level==='ground'&&groundMode==='roam'){
    const f=roamDir(),r=new V3(Math.cos(roam.yaw),0,-Math.sin(roam.yaw)),sp=(keys.has('shift')?320:70)*dt;
    if(keys.has('w')||keys.has('arrowup'))roam.pos.addScaledVector(f,sp);
    if(keys.has('s')||keys.has('arrowdown'))roam.pos.addScaledVector(f,-sp);
    if(keys.has('d')||keys.has('arrowright'))roam.pos.addScaledVector(r,sp);
    if(keys.has('a')||keys.has('arrowleft'))roam.pos.addScaledVector(r,-sp);
    if(keys.has('e')||keys.has(' '))roam.pos.y+=sp;if(keys.has('q')||keys.has('c'))roam.pos.y-=sp;
    roam.pos.x=Math.max(-HALF,Math.min(HALF,roam.pos.x));roam.pos.z=Math.max(-HALF,Math.min(HALF,roam.pos.z));
    roam.pos.y=Math.max(groundH(groundWorld,roam.pos.x,-roam.pos.z)+1.8,Math.min(3000,roam.pos.y));applyRoam();
  }
  if(level==='galaxy')G.galaxy.rotation.y+=dt*.006;
  if(level==='system'&&sysWorldMesh)sysWorldMesh.rotation.y+=dt*.15;
  if(level==='ground'){const p=groundMode==='play'?{x:play.x,z:-play.z}:groundMode==='roam'?roam.pos:ctl.target,alt=cam.position.y-groundH(groundWorld,cam.position.x,-cam.position.z);
    $('#coords').textContent=`X ${fmt(p.x)} · Z ${fmt(-p.z)} · alt ${fmt(alt)} m · world ±8,192 m`;}
  else $('#coords').textContent=level==='galaxy'?`${WORLDS.length} worlds`:curWorld?`${curWorld.name} · ${curWorld.pois.length} POIs · ${curWorld.placements.length.toLocaleString()} placements`:'';
  if(level==='ground'&&skyMesh)skyMesh.position.copy(cam.position);
  if(level==='ground')updateNpcToons(dt);
  gameTick(dt);
  tickKitCull();renderer.render(scene,cam);labels(labelItems());drawMini();
  requestAnimationFrame(frame);
}

/* ================= GRUDGE WARLORDS: races, classes, gear sets, NPCs ================= */
const GD=JSON.parse(document.getElementById('grudge').textContent);
const RACE=Object.fromEntries(GD.races.map(r=>[r.id,r])),CLASS=Object.fromEntries(GD.classes.map(c=>[c.id,c])),FACTION=Object.fromEntries(GD.factions.map(f=>[f.id,f]));
const CORE_CLASSES=['warrior','mage','ranger','worge'];
const ATTRS=['Strength','Vitality','Endurance','Dexterity','Agility','Intellect','Wisdom','Tactics'];
const RACE_BODY={human:{h:1.8,w:1,skin:'#d9a77f',hair:'#4a3020'},orc:{h:2.02,w:1.32,skin:'#6f9a3a',tusks:1,hair:'#1d1d1d'},elf:{h:1.94,w:.86,skin:'#ecd3b4',ears:1,hair:'#e8dcae'},
  undead:{h:1.84,w:.82,skin:'#a3a3b5',glow:'#8fc8ff'},barbarian:{h:2.0,w:1.24,skin:'#c98f6a',hair:'#7a3a1a',mane:1},dwarf:{h:1.36,w:1.28,skin:'#d49a74',beard:'#8a4a22'}};
const SET_COLOR={Bloodfeud:'#8a1f1f',Wraithfang:'#3b4060',Oathbreaker:'#c9b27a',Kinrend:'#2f5a3a',Dusksinger:'#4a2d6a',Emberclad:'#b8521f'};
const PLANET_FACTION={tatooine:'legion',naboo:'fabled',corellia:'crusade',talus:'crusade',rori:'fabled',dantooine:'fabled',lok:'legion',yavin4:'fabled',endor:'fabled',dathomir:'legion',kashyyyk:'fabled',mustafar:'legion'};
const tierColor=t=>(GD.tiers[String(t)]||{}).color||'#9ca3af',tierName=t=>(GD.tiers[String(t)]||{}).name||('T'+t);
function materialFor(cls){const a=(CLASS[cls]||{}).armorTypes||['leather'];return a[0]==='plate'||a[0]==='mail'?'metal':a[0]==='cloth'?'cloth':'leather'}
const KIT_CAT={SWORD:'swords',WAND:'fireStaves',STAFF:'holyStaves',BOW:'bows',HAMMER:'hammers1h',GREATAXE:'greataxes',DAGGER:'daggers',SHIELD:'shields'};
function weaponFor(cls,set){const c=CLASS[cls],main=(c.kit||[]).find(k=>k.slot==='main_hand'),pref=main&&KIT_CAT[main.type];
  const cats=[pref,...(c.weaponTypes||[])].filter(Boolean);for(const cat of cats){const w=GD.weapons[cat]&&GD.weapons[cat][set];if(w)return{...w,cat}}return null}
function offhandFor(cls,set){const c=CLASS[cls];if(!(c.kit||[]).some(k=>k.slot==='off_hand'&&k.type==='SHIELD'))return null;const w=GD.weapons.shields&&GD.weapons.shields[set];return w?{...w,cat:'shields'}:null}
const atT=(st,key,t)=>(st[key+'Base']||0)+(st[key+'PerTier']||0)*(t-1);
function warlordStats(o){
  const c=CLASS[o.cls],r=RACE[o.race],mat=materialFor(o.cls),pieces=((GD.gear[o.set]||{})[mat]||[]).concat((GD.gear[o.set]||{}).gem||[]);
  const attrs={};ATTRS.forEach(a=>attrs[a]=((c.start||{})[a]||0)+((r.bonuses||{})[a]||0));
  const tot={hp:0,mana:0,defense:0,block:0,crit:0};pieces.forEach(p=>{for(const k in tot)tot[k]+=atT(p.stats,k,o.tier)});
  const wpn=weaponFor(o.cls,o.set),off=offhandFor(o.cls,o.set);
  const dmg=wpn?atT(wpn.stats,'damage',o.tier):0;if(off){tot.block+=atT(off.stats,'block',o.tier);tot.defense+=atT(off.stats,'defense',o.tier)}
  return{attrs,tot,dmg,mat,pieces,wpn,off,setBonus:(pieces.find(p=>p.setBonus)||{}).setBonus,passives:[...new Set(pieces.map(p=>p.passive).filter(Boolean))].slice(0,3)};
}

/* ---- procedural warlord model ---- */
function buildWarlord(o,{lit='standard'}={}){
  const B=RACE_BODY[o.race]||RACE_BODY.human,hy=B.h/1.8,wx=B.w,mat=materialFor(o.cls),setc=col(SET_COLOR[o.set]||'#777'),trim=col(tierColor(o.tier));
  const M=(hex,extra={})=>lit==='standard'?new THREE.MeshStandardMaterial({color:hex,roughness:.75,...extra}):new THREE.MeshLambertMaterial({color:hex,emissive:extra.emissive||0x000000});
  const gearCol=mat==='metal'?setc.clone().lerp(col('#9aa2ab'),.35):mat==='leather'?setc.clone().lerp(col('#6b4a2a'),.45):setc.clone();
  const gearM=mat==='metal'?M(gearCol,{metalness:.7,roughness:.35}):M(gearCol,{roughness:.9});
  const dark=M(gearCol.clone().multiplyScalar(.55),{roughness:.9}),skin=M(B.skin),trimM=M(trim,o.tier>=5?{emissive:trim.clone().multiplyScalar(.45),metalness:.6,roughness:.3}:{metalness:.5,roughness:.4});
  const g=new THREE.Group(),add=(geo,m,x,y,z,parent=g)=>{const me=new THREE.Mesh(geo,m);me.position.set(x,y,z);parent.add(me);return me};
  const box=(w,h,d)=>new THREE.BoxGeometry(w,h,d);
  const legs=[],arms=[];
  for(const s of [-1,1]){const leg=new THREE.Group();leg.position.set(s*.11*wx,.86*hy,0);g.add(leg);legs.push(leg);
    add(box(.17*wx,.78*hy,.2),mat==='cloth'?dark:dark,0,-.39*hy,0,leg);add(box(.2*wx,.16*hy,.3),gearM,0,-.78*hy,.03,leg)}
  add(box(.5*wx,.6*hy,.28),gearM,0,1.16*hy,0);add(box(.52*wx,.07*hy,.3),trimM,0,.88*hy,0);
  if(mat==='cloth'){const robe=add(new THREE.CylinderGeometry(.27*wx,.42*wx,.82*hy,10,1,true),M(setc,{roughness:.95,side:THREE.DoubleSide}),0,.47*hy,0);robe.material.side=THREE.DoubleSide}
  for(const s of [-1,1]){const arm=new THREE.Group();arm.position.set(s*(.25*wx+.08),1.42*hy,0);g.add(arm);arms.push(arm);
    add(box(.14*wx,.56*hy,.14),mat==='metal'?gearM:skin,0,-.28*hy,0,arm);add(box(.16*wx,.14*hy,.17),dark,0,-.6*hy,0,arm);
    if(mat==='metal')add(box(.2*wx,.11*hy,.26),gearM,s*.03,.02,0,arm);else if(mat==='leather')add(box(.18*wx,.09*hy,.24),dark,s*.02,0,0,arm)}
  const headY=1.62*hy,hr=.14*Math.pow(wx,.35);add(new THREE.SphereGeometry(hr,14,10),skin,0,headY,0);
  if(B.ears)for(const s of [-1,1]){const e=add(new THREE.ConeGeometry(.035,.2,5),skin,s*hr*.95,headY+.02,0);e.rotation.z=-s*1.25}
  if(B.tusks)for(const s of [-1,1])add(new THREE.ConeGeometry(.02,.07,5),M('#f2ead8'),s*.05,headY-.07,hr*.85);
  if(B.beard){const b=add(new THREE.ConeGeometry(hr*.9,.28,8),M(B.beard),0,headY-.16,hr*.45);b.rotation.x=Math.PI}
  if(B.glow)for(const s of [-1,1])add(new THREE.SphereGeometry(.022,6,4),new THREE.MeshBasicMaterial({color:B.glow}),s*.05,headY+.02,hr*.92);
  if(B.mane)add(box(hr*1.7,.3,.1),M(B.hair),0,headY-.05,-hr*.8);
  if(mat==='metal'){add(new THREE.SphereGeometry(hr*1.12,14,8,0,TAU,0,Math.PI*.55),gearM,0,headY+.01,0);add(box(.03,.08,hr*2.1),trimM,0,headY+hr*1.08,0)}
  else if(mat==='leather'){add(new THREE.SphereGeometry(hr*1.1,12,8,0,TAU,0,Math.PI*.62),dark,0,headY+.01,-.01)}
  else{const hat=add(new THREE.ConeGeometry(hr*1.25,.42,10),M(setc),0,headY+.24,-.02);hat.rotation.x=-.12;add(new THREE.TorusGeometry(hr*1.15,.02,5,16),trimM,0,headY+.07,0).rotation.x=Math.PI/2}
  // weapon in right hand, off-hand on left
  const hand=new THREE.Group();hand.position.set(0,-.62*hy,.05);arms[1].add(hand);
  const wpn=weaponFor(o.cls,o.set),cat=wpn?wpn.cat:'swords',metalM=M('#c9ced6',{metalness:.85,roughness:.25});
  if(/Staves|staves|Tomes|wand/.test(cat)){add(new THREE.CylinderGeometry(.02,.025,1.6*hy,6),M('#5a3d24'),0,.25,0,hand);
    add(new THREE.SphereGeometry(.07,10,8),new THREE.MeshBasicMaterial({color:trim}),0,.25+.82*hy,0,hand)}
  else if(/bows|crossbows/.test(cat)){const bow=add(new THREE.TorusGeometry(.48*hy,.02,6,18,Math.PI),M('#6a4a2a'),0,0,0,hand);bow.rotation.set(0,Math.PI/2,Math.PI/2)}
  else if(/hammers/.test(cat)){add(new THREE.CylinderGeometry(.02,.02,.75,6),M('#5a3d24'),0,.2,0,hand);add(box(.14,.12,.24),metalM,0,.58,0,hand)}
  else if(/greataxes|greatswords|hammers2h/.test(cat)){add(new THREE.CylinderGeometry(.025,.025,1.25,6),M('#5a3d24'),0,.35,0,hand);add(box(.04,.34,.32),metalM,0,.85,.12,hand)}
  else if(/daggers|claws/.test(cat)){add(box(.03,.3,.012),metalM,0,.2,0,hand)}
  else{add(box(.05,.82*hy,.014),metalM,0,.48*hy,0,hand);add(box(.2,.03,.05),trimM,0,.07,0,hand)}
  if(offhandFor(o.cls,o.set)){const sh=add(box(.06,.55*hy,.42),M(setc,{metalness:.4,roughness:.5}),-.06,-.5*hy,.1,arms[0]);add(new THREE.SphereGeometry(.06,8,6),trimM,-.1,-.5*hy,.1,arms[0])}
  g.userData={legs,arms};return g;
}
function animateWalk(g,t,amt){const {legs,arms}=g.userData;if(!legs)return;const s=Math.sin(t)*.6*amt;legs[0].rotation.x=s;legs[1].rotation.x=-s;arms[0].rotation.x=-s*.8;arms[1].rotation.x=s*.5}

/* ---- warlord selection state ---- */
let warlord={race:'human',cls:'warrior',set:'Bloodfeud',tier:1};
try{const sv=JSON.parse(localStorage.getItem('swgatlas.warlord')||'null');if(sv&&RACE[sv.race]&&CLASS[sv.cls])warlord={...warlord,...sv}}catch(e){}
const saveWarlord=()=>{try{localStorage.setItem('swgatlas.warlord',JSON.stringify(warlord))}catch(e){}};

/* ---- creator UI ---- */
const cr=$('#creator');let crR=null,crScene,crCam,crModel=null,crYaw=.6,crRun=false;
function crInit(){if(crR)return;const cv=$('#crCanvas');crR=new THREE.WebGLRenderer({canvas:cv,antialias:true,alpha:true});crR.setPixelRatio(Math.min(devicePixelRatio,2));
  crScene=new THREE.Scene();crCam=new THREE.PerspectiveCamera(30,1,.1,50);
  crScene.add(new THREE.HemisphereLight(0xdfe6f0,0x2a2620,.9));const k=new THREE.DirectionalLight(0xfff0dc,1.1);k.position.set(2,4,3);crScene.add(k);const r2=new THREE.DirectionalLight(0x88aaff,.5);r2.position.set(-3,2,-2);crScene.add(r2);
  const disc=new THREE.Mesh(new THREE.CircleGeometry(1.1,40),new THREE.MeshStandardMaterial({color:0x1a2130,roughness:1}));disc.rotation.x=-Math.PI/2;crScene.add(disc);
  let drag=null;cv.addEventListener('pointerdown',e=>{drag=e.clientX;cv.setPointerCapture(e.pointerId)});cv.addEventListener('pointermove',e=>{if(drag!=null){crYaw+=(e.clientX-drag)*.01;drag=e.clientX}});cv.addEventListener('pointerup',()=>drag=null)}
function crRebuild(){if(crModel){crScene.remove(crModel);if(!crModel.userData.toon)crModel.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)o.material.dispose()})}crModel=warlordModel(warlord);crScene.add(crModel);if(crModel.userData.mixer)setTimeout(()=>toonOneShot(crModel,'taunt'),350)}
function crLoop(){if(!crRun)return;const cv=$('#crCanvas'),w=cv.clientWidth,h=cv.clientHeight;if(cv.width!==Math.round(w*crR.getPixelRatio())){crR.setSize(w,h,false);crCam.aspect=w/h;crCam.updateProjectionMatrix()}
  const H=(RACE_BODY[warlord.race]||{h:1.8}).h;crCam.position.set(Math.sin(crYaw)*6.4,H*.7+.6,Math.cos(crYaw)*6.4);crCam.lookAt(0,H*.5,0);if(!reduce)crYaw+=.004;
  if(crModel)animateAny(crModel,performance.now()/700,crModel.userData.toon?0:.12);crR.render(crScene,crCam);requestAnimationFrame(crLoop)}
const chip=(label,color,on,fn,sub)=>{const b=document.createElement('button');b.className='crchip';b.style.setProperty('--c',color);b.setAttribute('aria-pressed',on);b.innerHTML='<i></i><span></span>';b.querySelector('span').textContent=label;if(sub){const s=document.createElement('small');s.textContent=sub;b.append(s)}b.onclick=fn;return b};
function crRender(){
  const st=warlordStats(warlord),r=RACE[warlord.race],c=CLASS[warlord.cls],f=FACTION[r.faction]||{};
  const rr=$('#crRace');rr.innerHTML='';GD.races.forEach(x=>rr.append(chip(x.name,x.color,x.id===warlord.race,()=>{warlord.race=x.id;crUpdate()},(FACTION[x.faction]||{}).name)));
  const cc=$('#crClass');cc.innerHTML='';[...GD.classes].sort((a,b)=>(CORE_CLASSES.includes(b.id)-CORE_CLASSES.includes(a.id))).forEach(x=>cc.append(chip(x.name,x.color,x.id===warlord.cls,()=>{warlord.cls=x.id;crUpdate()},CORE_CLASSES.includes(x.id)?'Core':'')));
  const ss=$('#crSet');ss.innerHTML='';GD.armorSets.forEach(x=>ss.append(chip(x,SET_COLOR[x]||'#888',x===warlord.set,()=>{warlord.set=x;crUpdate()})));
  $('#crTier').value=warlord.tier;$('#crTierLbl').textContent=`T${warlord.tier} · ${tierName(warlord.tier)}`;$('#crTierLbl').style.color=tierColor(warlord.tier);
  $('#crTitle').innerHTML='';const t=document.createElement('b');t.textContent=`${r.name} ${c.name}`;const sm=document.createElement('small');sm.textContent=`${f.name||''} · patron ${f.patron||'—'} · ${warlord.set} ${st.mat} T${warlord.tier}`;$('#crTitle').append(t,sm);
  $('#crRaceInfo').textContent=`${r.trait}: ${r.passive}. ${r.description}`;
  $('#crClassInfo').textContent=`${c.description}${c.signature?` Signature: ${c.signature}.`:''} Wears ${(c.armorTypes||[]).join(', ')}.`;
  const at=ATTRS.map(a=>`<div><span>${a.slice(0,3).toUpperCase()}</span><b>${(+st.attrs[a].toFixed(1))}</b></div>`).join('');
  const T=st.tot,row=(k,v)=>`<div><span>${k}</span><b>${Math.round(v).toLocaleString()}</b></div>`;
  $('#crStats').innerHTML=`<div class="crgrid">${at}</div><div class="crgrid">${row('HP',T.hp)}${row('Mana',T.mana)}${row('Defense',T.defense)}${row('Block',T.block)}${row('Crit',T.crit)}${row('Weapon dmg',st.dmg)}</div>
    <ul class="crgear"></ul><p class="crbonus"></p>`;
  const ul=$('#crStats .crgear');st.pieces.forEach(p=>{const li=document.createElement('li');li.textContent=`${p.slot}: ${p.name}`;ul.append(li)});
  if(st.wpn){const li=document.createElement('li');li.textContent=`Main hand: ${st.wpn.name}${st.wpn.estimated?' (stats estimated)':''}`;li.className='w';ul.prepend(li)}
  if(st.off){const li=document.createElement('li');li.textContent=`Off hand: ${st.off.name}`;li.className='w';ul.prepend(li)}
  $('#crStats .crbonus').textContent=[st.setBonus,...st.passives].filter(Boolean).join(' · ');
  const tb=toonReady[warlord.race],tm=document.createElement('p');tm.className='cr-src';
  if(tb){const eq=toonEquip(warlord,toonCatalog(tb));tm.textContent='Toon RTS model · '+Object.entries(eq).map(([k,v])=>`${k.replace('weapon_','').replace('xtra_','').replace('shoulderpads','shoulders')} ${v==='-'?'':v.toUpperCase()}`.trim()).join(' · ')}
  else tm.textContent=toonFailed?'Toon RTS models could not load; showing the stand-in model.':'Loading Toon RTS model…';
  $('#crStats').append(tm);
}
function crUpdate(){saveWarlord();crRender();crRebuild()}
let newProf='artisan';
function openCreator(){cr.hidden=false;crInit();crRender();crRebuild();if(!crRun){crRun=true;crLoop()}
  $('#crNew').hidden=!creating;$('#crTierRow').hidden=creating;$('#crHead').textContent=creating?'Create a character':'Preview a Warlord';$('#crPlay').textContent=creating?'Create and play':'Enter world';
  if(creating){warlord.tier=1;renderProfChips();const sel=$('#crCity');if(!sel.options.length){WORLDS.forEach(w=>travelPoints(w).filter(t=>t.star).forEach(t=>{const o=document.createElement('option');o.value=w.id+'|'+t.x+'|'+t.z;o.textContent=`${t.name} · ${w.name}`;sel.append(o)}))}$('#crName').focus()}else $('#crPlay').focus()}
function renderProfChips(){const r=$('#crProf');r.innerHTML='';Object.entries(PROF).filter(([,P])=>P.start).forEach(([id,P])=>r.append(chip(P.name,P.color,id===newProf,()=>{newProf=id;renderProfChips()})));$('#crProfInfo').textContent=PROF[newProf].blurb}
function closeCreator(){cr.hidden=true;crRun=false;creating=false}
$('#warlordBtn').onclick=()=>openWin('chars');$('#crCancel').onclick=closeCreator;
$('#crTier').addEventListener('input',e=>{warlord.tier=+e.target.value;crUpdate()});
$('#crPlay').onclick=async()=>{
  if(creating){const name=$('#crName').value.trim();if(name.length<2){toast('Give your character a name of at least 2 letters.');$('#crName').focus();return}
    const [pl,x,z]=$('#crCity').value.split('|');const c=newCharacter({name,race:warlord.race,cls:warlord.cls,set:warlord.set,prof:newProf,planet:pl,pos:{x:+x+8,z:+z+8}});
    closeCreator();await storeReady;await Store.save(c);toast(`Welcome, ${name}.`);playCharacter(c);return}
  closeCreator();if(level==='ground'){if(groundMode==='roam')groundMode='overhead';enterPlay();return}
  const w=curWorld||WORLDS[0],p=curPoi&&w.pois.includes(curPoi)?curPoi:(w.pois.find(q=>q.cat==='city')||w.pois[0]);
  if(level!=='planet'){while(busy)await sleep(100);await goPlanet(w,p)}while(busy)await sleep(100);pendingPlay=true;goGround(p)};
$('#crSrc').textContent=`Races, classes, gear sets, weapons and enemies from the Grudge ObjectStore API (${GD.source}), snapshot ${GD.fetched}.`;
$('#crRefresh').onclick=async()=>{const urls=['https://objectstore.grudge-studio.com/api/v1/races.json','https://molochdagod.github.io/ObjectStore/api/v1/races.json'];
  for(const u of urls){try{const r=await fetch(u);if(r.ok){const j=await r.json();Object.values(j.races||{}).forEach(x=>{const o=RACE[x.id];if(o)Object.assign(o,{name:x.name,color:x.color,faction:x.faction,trait:x.trait,description:x.description,passive:x.passive,bonuses:x.bonuses})});crRender();toast('Updated races from the live API.');return}}catch(e){}}
  toast(`This page can't reach the API from inside the artifact sandbox, so it uses the ${GD.fetched} snapshot. Ask Claude to refresh it.`)};
let pendingPlay=false;

/* ---- third-person play mode ---- */
const play={x:0,z:0,yaw:0,camYaw:0,camPitch:.32,dist:9,model:null,t:0};
function enterPlay(){
  if(level!=='ground'||busy)return;const from=groundMode==='roam'?{x:roam.pos.x,z:-roam.pos.z,yaw:roam.yaw}:{x:ctl.target.x,z:-ctl.target.z,yaw:ctl.theta};
  if(play.model){G.ground.remove(play.model)}play.model=warlordModel(warlord,{lit:'lambert'});G.ground.add(play.model);
  if(pendingSpawn){from.x=pendingSpawn.x;from.z=pendingSpawn.z;pendingSpawn=null}
  Object.assign(play,{x:from.x,z:from.z,yaw:from.yaw,camYaw:from.yaw,camPitch:.22,dist:6.2});groundMode='play';renderUI();updatePlay(0);if(CH){if(CH.hp==null)CH.hp=charStats().maxHp;renderHud();mmEnterPlay()}
}
function exitPlay(){if(groundMode!=='play')return;mmExitPlay();if(CH)saveNow();groundMode='overhead';hud.hidden=true;combat.p=null;if(play.model){G.ground.remove(play.model);play.model=null}
  ctl.target.set(play.x,groundH(groundWorld,play.x,play.z),-play.z);ctl.theta=play.camYaw;ctl.phi=.62;ctl.dist=Math.max(220,ctl.dist);applyOrbit();renderUI()}
function updatePlay(dt){
  const w=groundWorld,swim=waterDepth(w,play.x,play.z),gy0=groundH(w,play.x,play.z),H=(RACE_BODY[warlord.race]||{h:1.8}).h;
  if(rts.on){rtsCamera(dt);play.moving=0;if(play.model){play.model.position.set(play.x,gy0+Math.max(0,swim-1.3),-play.z);animateAny(play.model,play.t,0)}return}
  const rm=play.mount,flying=rm?rideUpdate(dt):0,run=keys.has('shift')&&(swim<1.2||!!rm),sp=(rm?5.5*rm.def.speed*(run?1.35:1)*(flying?1.3:1):(run?14:5.5)*(swim>1.2?.45:swim>.5?.7:1))*mmSpeedMul()*dt;
  // over-the-shoulder controls: W/S along the camera, A/D strafe, Q/E turn the camera
  if(keys.has('q'))play.camYaw+=dt*2.2;if(keys.has('e'))play.camYaw-=dt*2.2;
  let fx=0,fz=0;if(keys.has('w')||keys.has('arrowup'))fz+=1;if(keys.has('s')||keys.has('arrowdown'))fz-=1;if(keys.has('a')||keys.has('arrowleft'))fx-=1;if(keys.has('d')||keys.has('arrowright'))fx+=1;
  const c=play.camYaw,fwd={x:-Math.sin(c),z:Math.cos(c)},rt={x:Math.cos(c),z:Math.sin(c)},len=Math.hypot(fx,fz);let mv=0;
  if(len){const nx=(fx*rt.x+fz*fwd.x)/len,nz=(fx*rt.z+fz*fwd.z)/len,back=fz<0&&!fx?.65:1;play.x+=nx*sp*back;play.z+=nz*sp*back;mv=1;
    const want=mouselook||combat.p?c:Math.atan2(-nx,nz);let dy=((want-play.yaw+Math.PI)%TAU+TAU)%TAU-Math.PI;play.yaw+=dy*Math.min(1,dt*10)}
  else if(mouselook||combat.p){let dy=((c-play.yaw+Math.PI)%TAU+TAU)%TAU-Math.PI;play.yaw+=dy*Math.min(1,dt*6)}
  play.x=Math.max(-HALF,Math.min(HALF,play.x));play.z=Math.max(-HALF,Math.min(HALF,play.z));
  const gy=groundH(w,play.x,play.z);play.t+=dt*(run?11:7)*(mv?1:0);play.moving=mv?(run?2:1):0;
  const baseY=gy+(rm?Math.max(play.alt||0,swim>0?Math.max(0,swim-.6):0):Math.max(0,swim-1.3)),seat=rm?(rm.obj.userData.seat||1.2):0;
  if(rm){rm.obj.position.set(play.x,baseY,-play.z);rm.obj.rotation.y=play.yaw+Math.PI;animateMount(rm.obj,dt,play.moving,flying)}
  if(play.model){if(rm){const sz=rm.obj.userData.seatZ||0;play.model.position.set(play.x-Math.sin(play.yaw)*sz,baseY+seat-.45,-(play.z+Math.cos(play.yaw)*sz));play.model.rotation.y=play.yaw+Math.PI;animateAny(play.model,play.t,0)}
    else{play.model.position.set(play.x,baseY,-play.z);play.model.rotation.y=play.yaw+Math.PI;animateAny(play.model,play.t,play.moving)}}
  // camera rides behind the right shoulder
  const pitch=play.camPitch,dist=play.dist,piv=new V3(play.x+rt.x*.85,rm?baseY+seat+H*.55:gy+H*1.05,-(play.z+rt.z*.85));
  cam.position.set(piv.x+Math.sin(c)*Math.cos(pitch)*dist,piv.y+Math.sin(pitch)*dist,piv.z+Math.cos(c)*Math.cos(pitch)*dist);
  const camG=groundH(w,cam.position.x,-cam.position.z)+.8;if(cam.position.y<camG)cam.position.y=camG;
  cam.lookAt(piv.x-Math.sin(c)*6,piv.y-.9-Math.sin(pitch)*2,piv.z-Math.cos(c)*6);
}

/* ---- NPC mapping: Core3 spawns -> Grudge townsfolk, enemies and bosses ---- */
const FRIENDLY=/commoner|vendor|trainer|guard|officer|merchant|citizen|noble|entertainer|dancer|musician|scientist|mayor|doctor|medic|pilot|banker|clerk|teacher|farmer|worker|villager|elder|chief|priest|monk|shop|bartender|recruiter|informant|agent|businessman|gambler|trooper|imperial|rebel|corsec|militia|soldier|captain|commander|security|technician|surgeon|chef|artisan|architect|droid|trader|traveler|tourist|smuggler_contact|quest|dealer|contractor|slave|^r[2-5]$|^r[2-5]_|protocol|courier|hermit|scout_trooper/;
const OUTLAW=/thug|bandit|pirate|raider|cultist|rogue|renegade|deserter|traitor|mercenary|criminal|assassin|gang|marauder|bounty|swoop|kook|loon|fanatic|insurgent|commando_rogue/;
const ROLES=[[/trainer/,'Trainer'],[/vendor|merchant|shop|trader|junk/,'Merchant'],[/guard|security|militia|corsec|trooper|soldier|imperial|rebel/,'Guard'],[/officer|captain|commander/,'Captain'],[/priest|monk|elder/,'Priest'],
  [/doctor|medic|surgeon/,'Healer'],[/entertainer|dancer|musician/,'Bard'],[/scientist|technician|architect|artisan/,'Artisan'],[/bartender|chef/,'Innkeeper'],[/noble|mayor|banker|businessman/,'Noble'],[/pilot|traveler|tourist/,'Traveler'],[/farmer|worker/,'Laborer']];
const HOSTILE=[['dragons',/krayt_dragon|dragon|wyrm/],['spiders',/spider|arachne|gaping_spider|webweaver/],['reptiles',/lizard|krayt|dune|serpent|snake|varactyl|slice_hound|kimogila|reptile|sarlacc/],
  ['trolls',/rancor|gundark|graul|troll|bolle_bol|mamien/],['undead',/nightsister|sith|dark_|spirit|ghost|zombie|undead|wraith|shade|nyax|zealot|disciple|minion|visionary|fiend|acolyte/],['golems',/droid|golem|construct|probot|battle_droid|at_st|at_at|seeker|walker|turret/],
  ['minotaurs',/bull|horned|ronto|kaadu_bull|bolma/],['titans',/giant|colossus|titan|ancient_/],['elementals',/energy|elemental|fire_|plasma/],
  ['orcs',/tusken|jawa|raider|thug|pirate|bandit|gang|marauder|punk|kook|corsair|outlaw|dulok|ewok|cultist|smuggler|mercenary|poacher|warrior|scavenger|ragtag|hooligan|brigand|deserter|fanatic|insurgent|rogue|renegade|traitor|swoop|criminal|assassin|bounty|loon|trooper|soldier|commando|guard|tribesman|battlelord|shaman|hunter|clan|villager|chieftain|scout|elder|dantari|mokk|kunga|gondula|panshee|donkuwah|korga|pubam|drall|gungan|ewok/],
  ['beasts',/./]];
const SYL=['ka','dro','mir','gar','eth','vel','tor','an','ul','rin','sha','bor','gwen','ith','zar','mok','dun','ley','fen','os','tha','ruk','ael','gri'];
const npcName=h=>{const n=2+h%2;let s='';for(let i=0;i<n;i++)s+=SYL[(h>>>(i*5))%SYL.length];return s[0].toUpperCase()+s.slice(1)};
function nearestCityDist(w,x,z){let d=Infinity;for(const p of w.pois)if(p.cat==='city')d=Math.min(d,Math.hypot(x-p.x,z-p.z)-p.r);return Math.max(0,d)}
function mapNpcs(w){
  const fac=FACTION[PLANET_FACTION[w.id]]||GD.factions[0],facRaces=GD.races.filter(r=>r.faction===fac.id).map(r=>r.id);
  const byCat={};GD.enemies.forEach(e=>(byCat[e.cat]=byCat[e.cat]||[]).push(e));
  const bossPois=new Set(w.pois.filter(p=>(p.cat==='military'||p.cat==='ruin')&&p.n>=20).map(p=>p.id)),bossDone=new Set();for(const p of w.placements)if(p.rboss&&p.poi!=null)bossDone.add(p.poi);
  for(const p of w.placements){if(p.k!=='npc')continue;const t=p.t.toLowerCase(),h=strHash(p.t+p.x.toFixed(0)+p.z.toFixed(0));
    if(p.rboss&&GD.bosses.length){const b=GD.bosses.reduce((a,c)=>Math.abs((c.tier||1)-p.rboss.tier)<Math.abs((a.tier||1)-p.rboss.tier)?c:a,GD.bosses[0]);p.g={kind:'boss',boss:{...b,name:p.rboss.name,hp:Math.round((b.hp||5000)*(.5+p.rboss.tier*.12))},name:p.rboss.name,tier:p.rboss.tier};continue}
    if(FRIENDLY.test(t)&&!OUTLAW.test(t)){
      const race=p.race&&RACE[p.race]?(h%10<8?p.race:(facRaces[h%facRaces.length]||p.race)):(h%10<7&&facRaces.length)?facRaces[h%facRaces.length]:GD.races[h%GD.races.length].id;
      const role=(ROLES.find(([re])=>re.test(t))||[0,'Villager'])[1];const cls=role==='Guard'||role==='Captain'?'warrior':role==='Priest'||role==='Healer'?'priest':GD.classes[(h>>>4)%GD.classes.length].id;
      p.g={kind:'friendly',race,role,cls,faction:p.faction||fac.id,name:p.trainer?`${npcName(h)}, ${PROF[p.trainer].name} trainer`:npcName(h),tier:1+(h>>>7)%3};if(p.trainer)p.g.role='Trainer';continue}
    const cat=(HOSTILE.find(([c,re])=>re.test(t))||['beasts'])[0],list=byCat[cat]||byCat.beasts||GD.enemies;
    const want=Math.min(10,realmTier(w,1+Math.floor(nearestCityDist(w,p.x,p.z)/1100)));
    let e=list.reduce((a,b)=>Math.abs(b.tier-want)<Math.abs(a.tier-want)?b:a,list[0]);
    if(p.poi!=null&&bossPois.has(p.poi)&&!bossDone.has(p.poi)&&GD.bosses.length){bossDone.add(p.poi);const b=GD.bosses.reduce((a,c)=>Math.abs((c.tier||1)-want-1)<Math.abs((a.tier||1)-want-1)?c:a,GD.bosses[0]);
      p.g={kind:'boss',boss:b,name:b.name,tier:b.tier||want};continue}
    p.g={kind:'hostile',enemy:e,cat,name:e.name,tier:e.tier};
  }
}
const QUAD=new Set(['beasts','spiders','reptiles','dragons']);
function npcShape(p){const g=p.g;if(!g)return{w:.7,d:.5,h:1.7,c:'#7fd6e8'};
  if(g.kind==='friendly'){const b=RACE_BODY[g.race]||RACE_BODY.human;return{w:.55*b.w,d:.4,h:b.h,c:(RACE[g.race]||{}).color||'#9cc'}}
  if(g.kind==='boss')return{w:2.2,d:2.2,h:5.5,c:'#ff3b3b'};
  const sz=g.cat==='dragons'?4:g.cat==='titans'?2.4:g.cat==='trolls'||g.cat==='minotaurs'||g.cat==='golems'?1.7:1;
  return QUAD.has(g.cat)?{w:.8*sz,d:1.8*sz,h:1*sz,c:'#d65a4a'}:{w:.7*sz,d:.55*sz,h:1.8*sz,c:'#e0625a'}}
function npcInfoHTML(p){const g=p.g,esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  if(g.kind==='friendly'){const r=RACE[g.race],f=FACTION[g.faction];return{c:r.color,eye:`${esc(g.role)} · ${esc(f.name)}`,title:`${esc(g.name)} the ${esc(r.name)}`,
    dl:`<dt>Race</dt><dd>${esc(r.name)} (${esc(r.trait)})</dd><dt>Class</dt><dd>${esc(CLASS[g.cls].name)}</dd><dt>Faction</dt><dd>${esc(f.name)}, patron ${esc(f.patron)}</dd><dt>Core3 spawn</dt><dd>${esc(p.t)}</dd>`}}
  if(g.kind==='boss'){const b=g.boss;return{c:'#ff3b3b',eye:`Boss · T${b.tier||'?'} ${esc(tierName(b.tier||1))}`,title:esc(b.name),
    dl:`<dt>HP</dt><dd>${(b.hp||0).toLocaleString()}</dd><dt>Damage</dt><dd>${esc(b.damage)}</dd><dt>Abilities</dt><dd>${esc((b.abilities||[]).map(a=>a.name||a).join(', '))}</dd><dt>Core3 spawn</dt><dd>${esc(p.t)}</dd>`}}
  const e=g.enemy;return{c:tierColor(e.tier),eye:`${esc(GD.enemyCats[g.cat]||g.cat)} · T${e.tier} ${esc(tierName(e.tier))}`,title:esc(e.name),
    dl:`<dt>HP</dt><dd>${(e.hp||0).toLocaleString()}</dd><dt>Damage</dt><dd>${esc(e.damage)}</dd><dt>Abilities</dt><dd>${esc(e.abilities.join(', '))}</dd><dt>Drops</dt><dd>${esc(e.drops.join(', '))}</dd><dt>Core3 spawn</dt><dd>${esc(p.t)}</dd>`}}

/* ================= Toon RTS race models (grudge6 rigs from the Grudge asset library) ================= */
const TOON_URL=r=>`models/${r}.glb`;
const toonCache={},toonReady={};
function loadToon(race){
  if(!toonCache[race])toonCache[race]=new Promise((res,rej)=>{if(!THREE.GLTFLoader)return rej(new Error('GLTFLoader missing'));
    const b64=(window.GRUDGE_TOON||{})[race];if(!b64)return rej(new Error('no model '+race));
    const bin=atob(b64),buf=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)buf[i]=bin.charCodeAt(i);
    new THREE.GLTFLoader().parse(buf.buffer,'',g=>{const flipped=new Set();g.scene.traverse(o=>{if(o.isMesh){o.frustumCulled=false;
      /* these meshes came from FBX (texture V counted from the bottom) without the glTF flip: flip V once per geometry */
      const uv=o.geometry.attributes.uv;if(uv&&!flipped.has(uv)){flipped.add(uv);for(let k=0;k<uv.count;k++)uv.setY(k,1-uv.getY(k));uv.needsUpdate=true}const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach(m=>{if(m.map){m.map.encoding=THREE.LinearEncoding;m.map.anisotropy=renderer.capabilities.getMaxAnisotropy();m.map.needsUpdate=true;m.needsUpdate=true}})}});
      toonReady[race]=g.scene;res(g.scene)},e=>{toonCache[race]=null;rej(e)})});
  return toonCache[race];
}
// normalise mesh names across races: WK_Units_Body_A / BRB_Body_A / ORC_Units_Head_C / DWF_weapon_axe_B
function toonSlot(name){let n=name.toLowerCase().replace(/^[a-z]+_/,'').replace(/^units_/,'');
  let m=n.match(/^(body|arms|legs|head|shoulderpads)_([a-z0-9])$/);if(m)return{slot:m[1],v:m[2]};
  m=n.match(/^(weapon_[a-z]+|shield)(?:_([a-z0-9]))?$/);if(m)return{slot:m[1],v:m[2]||'-'};
  m=n.match(/^xtra_([a-z]+)$/);if(m)return{slot:'xtra_'+m[1],v:'-'};return null}
function toonCatalog(scene){if(scene.userData.catalog)return scene.userData.catalog;const cat={};
  scene.traverse(o=>{if(!o.isMesh)return;const s=toonSlot(o.name);if(!s)return;(cat[s.slot]=cat[s.slot]||[]).push(s.v)});
  for(const k in cat)cat[k]=[...new Set(cat[k])].sort();scene.userData.catalog=cat;return cat}
const KIT_TOON={SWORD:['weapon_sword'],WAND:['weapon_staff'],STAFF:['weapon_staff'],BOW:['weapon_bow'],HAMMER:['weapon_hammer','weapon_mace'],GREATAXE:['weapon_axe'],DAGGER:['weapon_dagger','weapon_sword'],SPEAR:['weapon_spear'],SHIELD:['shield']};
// SWG professions, Grudge weapons: rifles become staves, pistols become a one-hand weapon plus a tome, Bounty Hunters swing special maces,
// medics carry holy tomes and scouts nature staves. The tome is built here and bound to the rig's left hand bone.
const PROF_WEAPON={marksman:{w:['weapon_staff']},rifleman:{w:['weapon_staff']},carbine:{w:['weapon_staff']},pistol:{w:['weapon_sword','weapon_dagger'],tome:'arcane'},
  bountyhunter:{w:['weapon_hammer','weapon_mace']},medic:{w:['weapon_hammer','weapon_mace'],tome:'holy'},doctor:{w:['weapon_hammer'],tome:'holy'},combatmedic:{w:['weapon_hammer'],tome:'holy'},
  scout:{w:['weapon_staff'],tome:null,staff:'nature'},ranger:{w:['weapon_staff','weapon_bow']},creaturehandler:{w:['weapon_staff']},brawler:{w:['weapon_sword']},'1hsword':{w:['weapon_sword']},
  '2hsword':{w:['weapon_axe','weapon_sword']},polearm:{w:['weapon_spear']},unarmed:{w:[]},commando:{w:['weapon_axe','weapon_hammer']},smuggler:{w:['weapon_dagger','weapon_sword']},
  squadleader:{w:['weapon_sword']},entertainer:{w:['weapon_dagger']},dancer:{w:['weapon_dagger']},musician:{w:['weapon_dagger']},imagedesigner:{w:['weapon_dagger']},
  artisan:{w:['weapon_hammer']},weaponsmith:{w:['weapon_hammer']},armorsmith:{w:['weapon_hammer']},architect:{w:['weapon_hammer']},chef:{w:['weapon_dagger']},tailor:{w:['weapon_dagger']},
  droidengineer:{w:['weapon_hammer']},shipwright:{w:['weapon_hammer']},merchant:{w:['weapon_dagger']},bioengineer:{w:['weapon_staff']},politician:{w:['weapon_sword'],tome:'holy'}};
const TOME_COL={holy:['#f2e2a8','#ffd75a'],arcane:['#5a3a8a','#c58bff'],nature:['#3a6a34','#8fe07a']};
function weaponProf(ch){if(!ch)return null;const elites=Object.keys(PROF).filter(p=>!PROF[p].start&&ch.skills.includes(PROF[p].novice));return elites.length?elites[elites.length-1]:ch.prof}
function addTome(inst,kind){const hand=inst.getObjectByName('L_hand_container');if(!hand||!TOME_COL[kind])return;const [c1,c2]=TOME_COL[kind],g=new THREE.Group();
  const cover=new THREE.Mesh(new THREE.BoxGeometry(.2,.27,.06),new THREE.MeshLambertMaterial({color:col(c1).multiplyScalar(.8)}));g.add(cover);
  const pages=new THREE.Mesh(new THREE.BoxGeometry(.18,.25,.045),new THREE.MeshLambertMaterial({color:0xefe4c8}));pages.position.x=.012;g.add(pages);
  const rune=new THREE.Mesh(new THREE.CircleGeometry(.05,12),new THREE.MeshBasicMaterial({color:col(c2)}));rune.position.z=.031;g.add(rune);const r2=rune.clone();r2.position.z=-.031;r2.rotation.y=Math.PI;g.add(r2);
  inst.updateMatrixWorld(true);const ws=new THREE.Vector3();hand.getWorldScale(ws);g.scale.setScalar(1/Math.max(1e-4,ws.x));g.position.set(0,0,0);g.rotation.set(0,Math.PI/2,0);hand.add(g);inst.userData.tome=g}
function toonEquip(o,cat){
  const si=Math.max(0,GD.armorSets.indexOf(o.set)),mat=materialFor(o.cls),off={metal:0,leather:2,cloth:4}[mat],pick=(slot,k)=>{const v=cat[slot];return v&&v.length?v[((k%v.length)+v.length)%v.length]:null};
  const eq={body:pick('body',si+off),arms:pick('arms',si+off),legs:pick('legs',si+off),head:pick('head',si*2+off+(o.tier>=5?1:0))};
  if(mat!=='cloth')eq.shoulderpads=pick('shoulderpads',si+(mat==='metal'?0:1));
  const main=(CLASS[o.cls].kit||[]).find(k=>k.slot==='main_hand'),wantW=(o.wprof&&PROF_WEAPON[o.wprof]&&PROF_WEAPON[o.wprof].w)||(main&&KIT_TOON[main.type])||['weapon_sword'];
  const ws=wantW.find(s=>cat[s])||Object.keys(cat).find(s=>s.startsWith('weapon_'));if(ws){const v=cat[ws];eq[ws]=o.tier>=5?v[v.length-1]:v[0]}
  if(offhandFor(o.cls,o.set)&&cat.shield)eq.shield=pick('shield',si);
  if(/ranger/.test(o.cls)&&cat.xtra_quiver)eq.xtra_quiver='-';
  // townsfolk and mobs: mix every armour slot independently and vary the weapon, shield and bow (all bound to the rig's hand bones)
  if(o.vary!=null){const V=o.vary>>>0,pv=(slot,k)=>{const v=cat[slot];return v&&v.length?v[(V>>>k)%v.length]:undefined};
    eq.body=pv('body',0);eq.arms=pv('arms',3);eq.legs=pv('legs',6);eq.head=pv('head',9);eq.shoulderpads=(V>>>12)%3?pv('shoulderpads',14):undefined;
    for(const k of Object.keys(eq))if(k.startsWith('weapon_')||k==='shield'||k==='xtra_quiver')delete eq[k];
    const wslots=Object.keys(cat).filter(k=>k.startsWith('weapon_')),pref=wantW.find(k=>cat[k]),w=(V>>>17)%3===0&&!o.wprof&&wslots.length?wslots[(V>>>19)%wslots.length]:pref||wslots[0];
    if(w){eq[w]=cat[w][(V>>>22)%cat[w].length];if(w==='weapon_bow'&&cat.xtra_quiver)eq.xtra_quiver='-';else if(!/staff|bow|spear/.test(w)&&cat.shield&&(V>>>25)%2)eq.shield=pv('shield',27)}}
  if(o.wprof&&PROF_WEAPON[o.wprof]&&PROF_WEAPON[o.wprof].tome)delete eq.shield;
  return eq}
// Toon RTS textures are hand-painted with their lighting baked in: show the paint at full strength (emissive from the same map)
// and let scene light add only gentle shape, instead of a dim PBR material multiplied by a set tint.
const toonMatCache=new Map();
function toonMaterial(m,glow){const src=m.material,map=src.map,key=(map?map.uuid:'none')+(m.isSkinnedMesh?'s':'')+(glow?glow.getHexString():'');
  if(toonMatCache.has(key))return toonMatCache.get(key);
  if(map){map.encoding=THREE.LinearEncoding;map.anisotropy=renderer.capabilities.getMaxAnisotropy();map.needsUpdate=true}
  const mat=new THREE.MeshLambertMaterial({map,color:new THREE.Color(.62,.62,.62),emissive:glow?glow.clone().lerp(new THREE.Color(1,1,1),.4).multiplyScalar(.62):new THREE.Color(.5,.5,.5),emissiveMap:map,side:THREE.FrontSide});
  toonMatCache.set(key,mat);return mat}
function toonInstance(race,o,{lit='standard'}={}){
  const base=toonReady[race];if(!base||!THREE.SkeletonUtils)return null;
  const inst=THREE.SkeletonUtils.clone(base),eq=toonEquip(o,toonCatalog(base)),setc=col(SET_COLOR[o.set]||'#ffffff'),tierc=col(tierColor(o.tier));
  inst.traverse(m=>{if(!m.isMesh)return;const s=toonSlot(m.name);m.visible=!!(s&&eq[s.slot]===s.v);
    if(m.visible){m.material=toonMaterial(m,s.slot.startsWith('weapon_')&&o.tier>=5?tierc:null)}});
  const B=n=>inst.getObjectByName('Bip001_'+n)||inst.getObjectByName('Bip001 '+n.replace('_',' '));
  const bones={lt:B('L_Thigh'),rt:B('R_Thigh'),lc:B('L_Calf'),rc:B('R_Calf'),lua:B('L_UpperArm'),rua:B('R_UpperArm'),lfa:B('L_Forearm'),rfa:B('R_Forearm'),spine:B('Spine')};
  const rest={};for(const k in bones)if(bones[k])rest[k]=bones[k].rotation.clone();
  inst.userData={toon:true,bones,rest,race,equip:eq};{const pw=o.wprof&&PROF_WEAPON[o.wprof];if(pw&&pw.tome&&!eq.shield)addTome(inst,pw.tome)}if(!toonSetupAnim(inst,race,o.cls))toonWalk(inst,0,0);return inst}
// Guard stance on the bip001 rig: upper arms lowered (local Y), elbows bent forward (local Z) so hand-bound
// weapons point up and forward and shields sit across the chest. Legs swing on local Z.
const ARM_DOWN=1.25,ELBOW=.95;
function toonWalk(inst,t,amt){const {bones:b,rest:r}=inst.userData;if(!b.lt)return;
  const sw=Math.sin(t)*.5*amt,lift=Math.max(0,Math.cos(t))*.75*amt,lift2=Math.max(0,-Math.cos(t))*.75*amt,breathe=amt?0:Math.sin(performance.now()/900)*.025;
  b.lt.rotation.z=r.lt.z+sw;b.rt.rotation.z=r.rt.z-sw;if(b.lc)b.lc.rotation.z=r.lc.z-lift2;if(b.rc)b.rc.rotation.z=r.rc.z-lift;
  if(b.lua){b.lua.rotation.y=r.lua.y+ARM_DOWN;b.lua.rotation.z=r.lua.z-sw*.35-breathe}if(b.rua){b.rua.rotation.y=r.rua.y-ARM_DOWN;b.rua.rotation.z=r.rua.z+sw*.35-breathe}
  if(b.lfa)b.lfa.rotation.z=r.lfa.z-ELBOW;if(b.rfa)b.rfa.rotation.z=r.rfa.z-ELBOW;
  if(b.spine)b.spine.rotation.z=r.spine.z+breathe*.6}
const animateAny=(g,t,amt)=>g&&(g.userData.toon?(g.userData.mixer?toonAnimate(g,amt):toonWalk(g,t,Math.min(1,amt))):animateWalk(g,t,Math.min(1,amt)));
function warlordModel(o,opts){const t=toonInstance(o.race,o,opts);return t||buildWarlord(o,opts)}

// preload every race in the background; refresh views when each arrives
const TOON_RACES=['human','barbarian','elf','dwarf','orc','undead'];
let toonFailed=false;

function swapPlayerModel(){if(!play.model)return;const pos=play.model.position.clone(),rot=play.model.rotation.y;G.ground.remove(play.model);play.model=warlordModel(warlord,{lit:'lambert'});play.model.position.copy(pos);play.model.rotation.y=rot;G.ground.add(play.model)}

/* ---- Toon NPCs near the player (LOD swap from markers) ---- */
const npcToons=new Map();let npcToonT=0;const toonGroup=new THREE.Group();
function npcLook(p){const g=p.g;if(!g)return null;
  if(g.kind==='friendly')return{race:g.race,o:{race:g.race,cls:g.cls,set:GD.armorSets[strHash(g.name)%GD.armorSets.length],tier:g.tier}};
  if(g.kind==='hostile'&&(g.cat==='orcs'||g.cat==='undead')){const race=g.cat==='orcs'?'orc':'undead';return{race,o:{race,cls:['warrior','raider','thief','ranger'][strHash(p.t)%4],set:GD.armorSets[strHash(p.t+'s')%GD.armorSets.length],tier:Math.min(8,g.tier)}}}
  return null}
function hideMarker(i,hide){if(!markers||!markers.userData.orig)return;const M=new THREE.Matrix4();if(hide)M.makeScale(0,0,0);else M.fromArray(markers.userData.orig,i*16);markers.setMatrixAt(i,M);markers.instanceMatrix.needsUpdate=true;
  const hm=markers.userData.heads,k=hm&&hm.userData.byPlacement.get(i);if(k==null)return;const H=new THREE.Matrix4();if(hide)H.makeScale(0,0,0);else H.fromArray(hm.userData.orig,k*16);hm.setMatrixAt(k,H);hm.instanceMatrix.needsUpdate=true}
function updateNpcToons(dt){
  if(level!=='ground'||!groundWorld||!markers)return;if(!toonGroup.parent)G.ground.add(toonGroup);
  for(const c of npcToons.values())thinkCreature(c,dt,groundWorld);
  npcToonT-=dt;if(npcToonT>0)return;npcToonT=.35;
  const far=groundMode==='overhead'&&ctl.dist>480;
  const fx=groundMode==='play'?play.x:groundMode==='roam'?roam.pos.x:ctl.target.x,fz=groundMode==='play'?play.z:groundMode==='roam'?-roam.pos.z:-ctl.target.z,list=[];
  if(!far)groundWorld.placements.forEach((p,i)=>{if(p.k!=='npc'||!p.g||p.dead)return;const d=Math.hypot(p.x-fx,p.z-fz);if(d<190)list.push({i,p,d})});
  const near=list.sort((a,b)=>a.d-b.d).slice(0,MAX_CREATURES),want=new Set(near.map(n=>n.i));let spawned=0;
  for(const [i,obj] of npcToons)if(!want.has(i)){toonGroup.remove(obj);npcToons.delete(i);hideMarker(i,false)}
  for(const n of near){if(npcToons.has(n.i))continue;if(spawned>=3)break;spawned++;const spec=creatureFor(n.p);if(!spec)continue;const obj=spawnCreature(n.p,spec);if(!obj)continue;
    obj.traverse(m=>{m.userData.placement=n.i});toonGroup.add(obj);npcToons.set(n.i,obj);thinkCreature(obj,0,groundWorld);hideMarker(n.i,true)}
}
/* skinned clones (NPCs, animals, peers, mounts) each own a bone texture; free it once the clone has left the scene.
   three.js rebuilds it on demand if the same clone is shown again. */
const SKINNED=new Set();
{const _clone=THREE.SkeletonUtils.clone;THREE.SkeletonUtils.clone=function(src){const c=_clone.call(this,src);c.traverse(o=>{if(o.isSkinnedMesh)SKINNED.add(o)});return c}}
function inScene(o){while(o){if(o===scene)return true;o=o.parent}return false}
setInterval(()=>{for(const o of SKINNED){if(inScene(o)){o.userData._shown=1;continue}if(!o.userData._shown&&!(o.skeleton&&o.skeleton.boneTexture))continue;
  if(o.skeleton&&o.skeleton.boneTexture){o.skeleton.boneTexture.dispose();o.skeleton.boneTexture=null}SKINNED.delete(o)}},5000);
function clearNpcToons(){for(const [i,obj] of npcToons){toonGroup.remove(obj);hideMarker(i,false)}npcToons.clear()}

/* ================= Grudge asset library: buildings, castles, space terminals, NPCs and monsters ================= */
function loadScript(src){return new Promise((res,rej)=>{const s=document.createElement('script');s.src=src;s.async=true;s.onload=res;s.onerror=()=>rej(new Error('Could not load '+src));document.head.appendChild(s)})}
const KIT={},kitProtoCache={};let kitReady=false;const kitWaiters=[];
function kitScene(name){
  if(!KIT[name])KIT[name]=new Promise((res,rej)=>{const b64=(window.GRUDGE_KIT||{})[name];if(!b64)return rej(new Error('missing kit '+name));
    const bin=atob(b64),buf=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)buf[i]=bin.charCodeAt(i);
    new THREE.GLTFLoader().parse(buf.buffer,'',g=>{g.scene.traverse(o=>{if(o.isMesh){o.frustumCulled=false;(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{if(m.map){m.map.encoding=THREE.LinearEncoding;m.needsUpdate=true}})}});res(g)},rej)});
  return KIT[name]}
// static prototype: meshes baked relative to the model's bottom-centre, plus its size
function kitProto(name,g){if(kitProtoCache[name])return kitProtoCache[name];const sc=g.scene;sc.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(sc),size=box.getSize(new V3()),c=box.getCenter(new V3()),off=new THREE.Matrix4().makeTranslation(-c.x,-box.min.y,-c.z),parts=[];
  sc.traverse(o=>{if(o.isMesh&&o.visible)parts.push({geo:o.geometry,mat:o.material,m:off.clone().multiply(o.matrixWorld)})});
  return kitProtoCache[name]={parts,size}}
// simple sized props for small set dressing the kit doesn't cover
(function procProtos(){const L=(c,e)=>new THREE.MeshLambertMaterial({color:c,emissive:e||0x000000});const P=(name,parts,size)=>kitProtoCache[name]={parts:parts.map(([geo,mat,m])=>({geo,mat,m:m||new THREE.Matrix4()})),size:new V3(...size)};
  P('pillar',[[new THREE.CylinderGeometry(.42,.5,1,10).translate(0,.5,0),L(0xb9ad96)],[new THREE.BoxGeometry(1.15,.08,1.15).translate(0,1,0),L(0xa89c86)]],[1.15,1,1.15]);
  P('barrel',[[new THREE.CylinderGeometry(.48,.5,1,12).translate(0,.5,0),L(0x7a5a3a)],[new THREE.CylinderGeometry(.51,.51,.08,12).translate(0,.75,0),L(0x4a4a4e)]],[1,1,1]);
  P('lamp',[[new THREE.CylinderGeometry(.012,.018,1,6).translate(0,.5,0),L(0x3a3a40)],[new THREE.SphereGeometry(.035,8,6).translate(0,1,0),L(0xffe0a0,0xd09040)]],[.07,1.04,.07]);
  P('crate',[[new THREE.BoxGeometry(1,1,1).translate(0,.5,0),L(0x8a6a44)],[new THREE.BoxGeometry(1.02,.1,1.02).translate(0,.5,0),L(0x5e4630)]],[1,1,1]);
  P('bench',[[new THREE.BoxGeometry(1,.12,.35).translate(0,.45,0),L(0x7a5a3a)],[new THREE.BoxGeometry(.1,.45,.3).translate(-.4,.22,0),L(0x5e4630)],[new THREE.BoxGeometry(.1,.45,.3).translate(.4,.22,0),L(0x5e4630)]],[1,.51,.35]);
})();
const STATIC_KITS=['kk_castle','kk_barracks','kk_watchtower','kk_wall_straight','kk_wall_gate','kk_wall_corner','kk_market','kk_house','kk_mill','kk_watermill','kk_lumbermill','kk_mine','kk_well','kk_farm_plot','kk_archeryrange','kk_detail_treeA','kk_detail_treeB','kk_detail_rocks','houseparts','catapult_human','catapult_orc','boltthrower'];
const CREATURE_KITS=['anim_general','anim_move','mount_wolf','mount_horse','mount_undead','mount_dwarf','slime','catapult_orc','boltthrower'];
loadScript('toon.js').then(()=>Promise.allSettled(TOON_RACES.map(r=>loadToon(r).then(()=>{if(!cr.hidden&&warlord.race===r)crRebuild();if(groundMode==='play'&&warlord.race===r)swapPlayerModel()})))).then(rs=>{toonFailed=!rs||rs.some(x=>x.status==='rejected')}).catch(e=>{toonFailed=true;console.warn(e)});

/* ================= Character animation: Mixamo clips retargeted onto the Toon RTS Bip001 rigs =================
   anim.js carries Mixamo/Meshy clips baked as world-space rotation deltas from a canonical T-pose (left=+X, up=+Y, forward=+Z).
   Each race's Bip001 skeleton is swung into the same T-pose here, and the deltas are rebuilt as local Bip001 tracks for that rig,
   so dwarves, elves and orcs keep their own proportions. */
// Shared retarget core: used by the offline bake (source side) and embedded in the page (target side).
const RT_KEYS=['Hips','Spine2','Neck','Head','LeftShoulder','LeftArm','LeftForeArm','LeftHand','RightShoulder','RightArm','RightForeArm','RightHand','LeftUpLeg','LeftLeg','LeftFoot','LeftToeBase','RightUpLeg','RightLeg','RightFoot','RightToeBase'];
const RT_CHILD={Hips:'Spine2',Spine2:'Neck',Neck:'Head',LeftShoulder:'LeftArm',LeftArm:'LeftForeArm',LeftForeArm:'LeftHand',RightShoulder:'RightArm',RightArm:'RightForeArm',RightForeArm:'RightHand',LeftUpLeg:'LeftLeg',LeftLeg:'LeftFoot',LeftFoot:'LeftToeBase',RightUpLeg:'RightLeg',RightLeg:'RightFoot',RightFoot:'RightToeBase'};
const RT_DIR={Hips:[0,1,0],Spine2:[0,1,0],Neck:[0,1,0],LeftShoulder:[1,0,0],LeftArm:[1,0,0],LeftForeArm:[1,0,0],RightShoulder:[-1,0,0],RightArm:[-1,0,0],RightForeArm:[-1,0,0],LeftUpLeg:[0,-1,0],LeftLeg:[0,-1,0],LeftFoot:[0,0,1],RightUpLeg:[0,-1,0],RightLeg:[0,-1,0],RightFoot:[0,0,1]};
const RT_BIP={Hips:'Pelvis',Spine2:'Spine',Neck:'Neck',Head:'Head',LeftShoulder:'L_Clavicle',LeftArm:'L_UpperArm',LeftForeArm:'L_Forearm',LeftHand:'L_Hand',RightShoulder:'R_Clavicle',RightArm:'R_UpperArm',RightForeArm:'R_Forearm',RightHand:'R_Hand',
  LeftUpLeg:'L_Thigh',LeftLeg:'L_Calf',LeftFoot:'L_Foot',LeftToeBase:'L_Toe0',RightUpLeg:'R_Thigh',RightLeg:'R_Calf',RightFoot:'R_Foot',RightToeBase:'R_Toe0'};
function rtWorldQ(o){const q=new THREE.Quaternion();o.getWorldQuaternion(q);return q}
function rtWorldP(o){const p=new THREE.Vector3();o.getWorldPosition(p);return p}
// Facing frame: canonical +X = character's left, +Y = up, +Z = forward.
function rtFrame(map){const l=rtWorldP(map.LeftUpLeg).sub(rtWorldP(map.RightUpLeg));l.y=0;l.normalize();const up=new THREE.Vector3(0,1,0),f=new THREE.Vector3().crossVectors(l,up).normalize();
  const m=new THREE.Matrix4().makeBasis(l,up,f);return new THREE.Quaternion().setFromRotationMatrix(m)}
// Swing every mapped bone so the rig stands in the canonical T-pose; returns those world rotations.
function rtTPose(root,map,F){root.updateMatrixWorld(true);
  for(const k of RT_KEYS){const b=map[k],c=map[RT_CHILD[k]];if(!b||!c||!RT_DIR[k])continue;
    const d=rtWorldP(c).sub(rtWorldP(b)).normalize(),want=new THREE.Vector3(...RT_DIR[k]).applyQuaternion(F);
    const W=rtWorldQ(b),R=new THREE.Quaternion().setFromUnitVectors(d,want),nw=R.multiply(W),pw=b.parent?rtWorldQ(b.parent):new THREE.Quaternion();
    b.quaternion.copy(pw.invert().multiply(nw));b.updateMatrixWorld(true)}
  const T={};for(const k of RT_KEYS)if(map[k])T[k]=rtWorldQ(map[k]);return T}

let ANIMLIB=null;const rigClips={};
function decQ(b64){const s=atob(b64),u=new Uint8Array(s.length);for(let i=0;i<s.length;i++)u[i]=s.charCodeAt(i);const a=new Int16Array(u.buffer),f=new Float32Array(a.length);for(let i=0;i<a.length;i++)f[i]=a[i]/32767;return f}
function bipMap(root){const m={};for(const k of RT_KEYS){const n='Bip001_'+RT_BIP[k];m[k]=root.getObjectByName(n)||root.getObjectByName(n.replace(/_/g,' '))}return m}
function clipsForRace(race){if(rigClips[race])return rigClips[race];const base=toonReady[race];if(!base||!ANIMLIB||!THREE.SkeletonUtils)return null;
  const rig=THREE.SkeletonUtils.clone(base);rig.updateMatrixWorld(true);const map=bipMap(rig);if(RT_KEYS.some(k=>!map[k]))return rigClips[race]={};
  const F=rtFrame(map),Fi=F.clone().invert(),hipsY0=rtWorldP(map.Hips).y,legLen=hipsY0-rtWorldP(map.LeftFoot).y,T=rtTPose(rig,map,F);
  const root=map.Hips.parent,rootPos0=root.position.clone(),pm3=new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().copy(root.parent.matrixWorld).invert());
  const par={},staticPW={};for(const k of RT_KEYS){const pk=RT_KEYS.find(j=>map[j]===map[k].parent);if(pk)par[k]=pk;else staticPW[k]=rtWorldQ(map[k].parent)}
  const out={},K=RT_KEYS.length,q=new THREE.Quaternion();
  for(const [id,c] of Object.entries(ANIMLIB.clips)){const Q=decQ(c.q),H=decQ(c.h),n=c.n,times=new Float32Array(n),vals={},pos=new Float32Array(n*3),W={};
    for(const k of RT_KEYS)vals[k]=new Float32Array(n*4);
    for(let f=0;f<n;f++){times[f]=f/ANIMLIB.fps;
      RT_KEYS.forEach((k,ki)=>{const o=(f*K+ki)*4;q.set(Q[o],Q[o+1],Q[o+2],Q[o+3]).normalize();W[k]=F.clone().multiply(q).multiply(Fi).multiply(T[k])});
      for(const k of RT_KEYS){const pw=par[k]?W[par[k]]:staticPW[k],l=pw.clone().invert().multiply(W[k]),v=vals[k],o=f*4;
        if(f&&l.x*v[o-4]+l.y*v[o-3]+l.z*v[o-2]+l.w*v[o-1]<0){l.x=-l.x;l.y=-l.y;l.z=-l.z;l.w=-l.w}v[o]=l.x;v[o+1]=l.y;v[o+2]=l.z;v[o+3]=l.w}
      const dv=new THREE.Vector3(0,H[f]*2*legLen,0).applyMatrix3(pm3);pos[f*3]=rootPos0.x+dv.x;pos[f*3+1]=rootPos0.y+dv.y;pos[f*3+2]=rootPos0.z+dv.z}
    const tracks=RT_KEYS.map(k=>new THREE.QuaternionKeyframeTrack(map[k].name+'.quaternion',times,vals[k]));tracks.push(new THREE.VectorKeyframeTrack(root.name+'.position',times,pos));
    out[id]=new THREE.AnimationClip(id,Math.max(.05,(n-1)/ANIMLIB.fps),tracks)}
  return rigClips[race]=out}
// which clips each class uses: attacks, idle stance and hit reaction
const CLASS_ANIM={warrior:{atk:['attackShield','attack1h'],idle:'idle'},raider:{atk:['attack2h','club'],idle:'idle'},thief:{atk:['slash','attack1h'],idle:'idle'},worge:{atk:['club','chop'],idle:'idle'},
  ranger:{atk:['chop','slash'],idle:'idle'},mage:{atk:['cast','cast2'],idle:'idle'},priest:{atk:['cast2','channel'],idle:'idle'},verduror:{atk:['channel','cast'],idle:'idle'}};
function toonSetupAnim(inst,race,cls){const clips=clipsForRace(race);if(!clips||!clips.idle)return false;const mixer=new THREE.AnimationMixer(inst);
  Object.assign(inst.userData,{mixer,clips,acts:{},cur:null,state:null,cls,once:0,last:performance.now()});toonPlay(inst,'idle',0);mixer.update(Math.random()*3);return true}
function toonAct(inst,name){const u=inst.userData;if(!u.clips[name])return null;return u.acts[name]||(u.acts[name]=u.mixer.clipAction(u.clips[name]))}
function toonPlay(inst,name,fade=.25,{once=false,hold=0,speed=1}={}){const u=inst.userData,a=toonAct(inst,name);if(!a)return;if(u.cur===a&&!once)return;
  a.reset();a.setEffectiveTimeScale(speed);a.setEffectiveWeight(1);a.setLoop(once?THREE.LoopOnce:THREE.LoopRepeat);a.clampWhenFinished=!!once;
  if(u.cur&&u.cur!==a)a.crossFadeFrom(u.cur,fade,false);else a.fadeIn(fade);a.play();u.cur=a;u.state=name;u.once=once?(hold||u.clips[name].duration):0}
// one-shot actions (attack, cast, hit, taunt, dance) on any toon; loops resume after
function toonOneShot(inst,kind){if(!inst||!inst.userData.mixer)return;const u=inst.userData,A=CLASS_ANIM[u.cls]||CLASS_ANIM.warrior;
  if(kind==='attack'){u.atkN=(u.atkN||0)+1;return toonPlay(inst,A.atk[u.atkN%A.atk.length],.12,{once:true,hold:1.45,speed:1.15})}
  if(kind==='hit'){if(u.once>0&&u.state!=='hit')return;return toonPlay(inst,'hit',.1,{once:true,hold:.9,speed:1.3})}
  if(kind==='dance')return toonPlay(inst,Math.random()<.5?'dance':'dance2',.3,{once:true,hold:10});
  if(kind==='sit')return toonPlay(inst,'sit',.4,{once:true,hold:1e9});
  if(kind==='stagger')return toonPlay(inst,u.clips.stagger?'stagger':'hit',.08,{once:true,hold:1.1});
  const em={wave:'pointing',point:'pointing',flex:'powerUp',strut:'swagger',look:'lookAround',cheer:'bboy',spin:'soulSpin'}[kind];
  return toonPlay(inst,em&&u.clips[em]?em:kind,.2,{once:true})}
function toonAnimate(inst,amt){const u=inst.userData,now=performance.now(),dt=Math.min(.1,(now-u.last)/1000);u.last=now;
  if(u.once>0){u.once-=dt;if(amt>0&&!/^hit/.test(u.state||'')&&!ATTACK_STATES.test(u.state||''))u.once=0}
  if(u.once<=0)toonPlay(inst,locoClip(u,amt),.25,{speed:amt>1.5?1:amt>0?1.05:1});u.mixer.update(dt)}
loadScript('anim.js').then(()=>{ANIMLIB=window.GRUDGE_ANIM;for(const r of Object.keys(toonReady))clipsForRace(r);if(typeof crRebuild==='function'&&!cr.hidden)crRebuild();if(groundMode==='play')swapPlayerModel();clearNpcToons()}).catch(e=>console.warn('Animation library unavailable; using procedural walk.',e));

loadScript('kit.js').then(()=>Promise.all([...new Set([...STATIC_KITS,...CREATURE_KITS])].map(k=>kitScene(k).then(g=>[k,g])))).then(list=>{
  list.forEach(([k,g])=>{if(STATIC_KITS.includes(k))kitProto(k,g)});loadPacks().then(()=>{kitReady=true;kitWaiters.splice(0).forEach(f=>f())})}).catch(e=>console.warn('Grudge kit failed',e));

/* ---- which Grudge kit replaces which SWG template ---- */
const KIT_RULES=[
  [/starport/,{composite:'starport'}],[/shuttleport/,{composite:'shuttle'}],
  [/palace|capitol|lucky_despot|castle|fortress|citadel/,{k:'kk_castle',fit:'uni',len:1.15}],
  [/cantina|hotel|theater|guild_theater|tavern|inn_/,{k:'houseparts',fit:'fp'}],
  [/cloning|hospital|medical/,{k:'houseparts',fit:'fp',hmul:.8}],
  [/university/,{k:'kk_castle',fit:'uni',len:.9}],
  [/guild/,{k:'kk_barracks',fit:'fp'}],[/bank|commerce|market|merchant|shop|vendor/,{k:'kk_market',fit:'fp'}],
  [/garage|hangar|factory|lumber/,{k:'kk_lumbermill',fit:'fp'}],
  [/guard_tower|watchtower|tower/,{k:'kk_watchtower',fit:'h',h:15}],
  [/military|bunker|outpost|guard_house|guardhouse|research_facility|barracks|detachment|garrison|prison/,{k:'kk_barracks',fit:'fp'}],
  [/housing|house|filler|slave_quarters|hut|dwelling|home|cabin|shack/,{k:'kk_house',fit:'fp'}],
  [/gate/,{k:'kk_wall_gate',fit:'wall'}],[/wall|fence|barricade|palisade/,{k:'kk_wall_straight',fit:'wall'}],
  [/fountain|well/,{k:'kk_well',fit:'uni',len:5}],[/windmill|vaporator|wind_/,{k:'kk_mill',fit:'h',h:9}],
  [/watermill|water_pump/,{k:'kk_watermill',fit:'h',h:8}],[/mine|mining|drill|ore_/,{k:'kk_mine',fit:'uni',len:9}],
  [/farm|crop|garden|field/,{k:'kk_farm_plot',fit:'uni',len:9}],
  [/crash|wreck|fighter|starship|xwing|tie_|y_wing|escape_pod|sandcrawler|crawler|vehicle|speeder|landspeeder|swoop/,{k:'kk_detail_rocks',fit:'uni',len:9,tilt:1}],
  [/tent|canopy|awning|stall|kiosk/,{k:'kk_market',fit:'fp',hmul:.7}],[/crate|barrel|container|cargo|box_/,{k:'kk_detail_rocks',fit:'uni',len:3}],
  [/catapult|turret|cannon/,{k:'catapult_human',fit:'uni',len:6}],
  [/flora.*tree|tree_|_tree/,{k:'kk_detail_treeA',fit:'h',h:11}],[/rock_|boulder|formation/,{k:'kk_detail_rocks',fit:'uni',len:6}],
  [/skeleton_human|bones|skull/,{skip:1}],[/elevated_walkway|walkway_cap/,{skip:1}],
  [/pillar_(ruined|damaged)|column_.*ruin/,{k:'pillar',fit:'col',h:3.2,w:1.3}],[/pillar|column|obelisk|jedi_temple_pillar/,{k:'pillar',fit:'col',h:6.5,w:1.2}],
  [/streetlamp|lamp|lantern|antenna|banner|power_arial|boundary_post|rack_spears|flag/,{k:'lamp',fit:'h',h:6}],
  [/drum|barrel|tank|pipe|debris|junk|trash|prp_|engine|transformer|bubble_node|generator/,{k:'barrel',fit:'h',h:1.4}],
  [/bench|seat|chair/,{k:'bench',fit:'uni',len:2.2}],[/palette|pallet|basket|crate/,{k:'crate',fit:'h',h:1}],
  [/potted|plant|bush|shrub|flower/,{k:'kk_detail_treeB',fit:'h',h:1.8}],[/orchard/,{k:'kk_detail_treeA',fit:'h',h:5.5}],
  [/stalagmite|stalactite/,{k:'kk_detail_rocks',fit:'uni',len:4}],[/hovel|stone_hut/,{k:'kk_house',fit:'uni',len:9}],
  [/arch/,{k:'kk_wall_gate',fit:'uni',len:7}],[/campfire|fire_pit/,{k:'kk_detail_rocks',fit:'uni',len:1.6}],
];
function kitRule(p){if(p.t&&p.t.startsWith('crc:'))return{skip:1};if(p.k==='travel')return{composite:p.t.startsWith('Starport')?'starport':'shuttle'};if(p.k==='npc')return null;const t=p.t.toLowerCase();{const pr=packRule(t);if(pr)return pr}
  const cls=clsOf(p);if(cls==='object'){if(/station|terminal|console/.test(t))return{k:'crate',fit:'h',h:1.3};}else if(cls!=='building'&&cls!=='static'&&cls!=='installation')return null;
  for(const [re,r] of KIT_RULES)if(re.test(t))return r;
  if(cls==='building')return{k:'kk_house',fit:'fp'};if(cls==='installation')return{k:'kk_mill',fit:'h',h:9};return{k:'crate',fit:'h',h:1.2}}
function fitMatrix(p,proto,rule,out){const s0=proto.size,w=p.w||Math.max(4,p.r*2),d=p.d||w;let sx,sy,sz;
  if(rule.fit==='fp'){sx=w/s0.x;sz=d/s0.z;const s=Math.sqrt(sx*sz);sx=Math.min(s*1.5,Math.max(s/1.5,sx));sz=Math.min(s*1.5,Math.max(s/1.5,sz));sy=s*(rule.hmul||1)}
  else if(rule.fit==='wall'){sx=Math.max(2,w)/s0.x;sy=Math.max(3.5,Math.min(7,(p.h||5)))/s0.y;sz=sy}
  else if(rule.fit==='h'){sy=rule.h/s0.y;sx=sz=sy}
  else if(rule.fit==='hp'){sy=(p.h||rule.h)/s0.y;sx=sz=sy}
  else if(rule.fit==='wallh'){sy=(p.h||8)/s0.y;sx=Math.max(2,w)/s0.x;sz=sy}
  else if(rule.fit==='col'){sy=rule.h/s0.y;sx=sz=rule.w/s0.x}
  else{const s=(rule.len*(rule.len<3?Math.max(w,d):1))/Math.max(s0.x,s0.z);sx=sy=sz=s}
  const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(rule.tilt?.35:0,(p.yaw!=null?-p.yaw:0)*Math.PI/180+(rule.tilt?.6:0),rule.tilt?.25:0,'YXZ'));
  return out.compose(new V3(p.x,(p.gy??0)-(rule.tilt?1.5:0),-p.z),q,new V3(sx,sy,sz))}

/* ---- landing pads for space terminals ---- */
function padTexture(){const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');
  x.fillStyle='#8c8f94';x.beginPath();x.arc(128,128,126,0,TAU);x.fill();x.strokeStyle='#e8c548';x.lineWidth=8;x.beginPath();x.arc(128,128,108,0,TAU);x.stroke();
  x.lineWidth=3;x.setLineDash([12,10]);x.beginPath();x.arc(128,128,86,0,TAU);x.stroke();x.setLineDash([]);x.fillStyle='#e8c548';x.font='bold 96px sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText('H',128,132);
  const t=new THREE.CanvasTexture(c);t._keep=true;return t}
let PAD_TEX=null;
const COMPOSITES={
  // starport: landing pad, control strip, terminal (research centre), power plant, solar field, gateway and a berthed cruiser overhead
  starport:[{pad:30},{k:'col_runway',dx:0,dz:-54,len:44},{k:'col_research',dx:-48,dz:4,len:24,yaw:Math.PI/2},{k:'col_reactor',dx:48,dz:-6,len:24,yaw:-Math.PI/2},
    {k:'col_gate',dx:0,dz:38,len:10},{k:'col_solar',dx:38,dz:30,len:6},{k:'col_solar',dx:45,dz:30,len:6},{k:'col_solar',dx:52,dz:30,len:6},
    {k:'col_drone',dx:-34,dz:-32,len:6},{k:'col_barrel',dx:-26,dz:-36,len:1.6},{k:'col_barrel',dx:-24,dz:-37,len:1.6},
    {k:'col_tower',dx:36,dz:-36,h:14},{k:'col_cruiser',dx:-20,dz:140,len:64,lift:60,yaw:.35},{k:'sk_spaceship',dx:-10,dz:-60,len:13,yaw:.2},{k:'sk_spaceship_u1',dx:12,dz:-48,len:15,yaw:-.3},{k:'sk_rover',dx:-40,dz:22,len:5,yaw:1.2},{k:'skt_shield',dx:58,dz:-40,len:5},{k:'skt_rail_gun',dx:-58,dz:-40,len:5},
    {k:'mk_rocket',dx:-78,dz:-58,len:34},{k:'mk_hab',dx:62,dz:44,len:20,yaw:-Math.PI/2},{k:'mk_habL',dx:-64,dz:46,len:24},{k:'mk_dish',dx:70,dz:-44,len:12},
    {k:'mk_tanks',dx:-42,dz:-50,len:6},{k:'mk_tanks',dx:-36,dz:-52,len:6},{k:'mk_rovers',dx:22,dz:-34,len:8,yaw:.6},{k:'mk_sensor',dx:-28,dz:30,len:4},
    {k:'kk_watchtower',dx:30,dz:22,h:20,fallback:1},{k:'kk_market',dx:-30,dz:-22,len:16,fallback:1}],
  shuttle:[{pad:16},{k:'mk_shuttlepad',dx:-22,dz:-16,len:14},{k:'mk_tanks',dx:20,dz:-14,len:4},{k:'col_gate',dx:0,dz:20,len:8},{k:'col_drone',dx:15,dz:10,len:5},{k:'col_tower',dx:-15,dz:10,h:10},{k:'kk_watchtower',dx:15,dz:10,h:12,fallback:1}]};

/* ---- fortified military POIs ("castles"): wall ring, gate toward the nearest city, corner towers ---- */
function castleRing(w,poi,emit){
  const R=Math.max(45,Math.min(poi.r*.85,260)),seg=10,n=Math.max(10,Math.round(TAU*R/seg));let city=null,cd=Infinity;
  for(const q of w.pois)if(q.cat==='city'){const d=Math.hypot(q.x-poi.x,q.z-poi.z);if(d<cd){cd=d;city=q}}
  const gateA=city?Math.atan2(city.z-poi.z,city.x-poi.x):0,towers=Math.max(4,Math.round(n/6));
  for(let i=0;i<n;i++){const a=i/n*TAU,x=poi.x+Math.cos(a)*R,z=poi.z+Math.sin(a)*R;let da=Math.abs(((a-gateA+Math.PI)%TAU+TAU)%TAU-Math.PI);
    const gy=groundH(w,x,z),yaw=-(a*180/Math.PI)+90;
    if(i%Math.round(n/towers)===0)emit('kk_watchtower',{x,z,gy,yaw},{fit:'h',h:16});
    else emit(da<TAU/n*.6?'kk_wall_gate':'kk_wall_straight',{x,z,gy,yaw,w:seg*1.08,h:6},{fit:'wall'})}
  emit('kk_castle',{x:poi.x+R*.35,z:poi.z-R*.25,gy:poi.base,yaw:(strHash(poi.name)%360)},{fit:'uni',len:Math.min(42,R*.45)});
  if(R>70)emit('catapult_orc',{x:poi.x-R*.4,z:poi.z+R*.3,gy:poi.base,yaw:(gateA*180/Math.PI)},{fit:'uni',len:7});
}

const kitMeshes=[],KIT_CELL=640;
const _kf=new THREE.Frustum(),_km=new THREE.Matrix4();
function tickKitCull(){if(level!=='ground'||!kitMeshes.length)return;const far0=quality==='low'?1300:quality==='medium'?1900:2600;
  const far=groundMode==='overhead'?Math.max(far0,ctl.dist*2.2):far0,cp=cam.position;cam.updateMatrixWorld();_km.multiplyMatrices(cam.projectionMatrix,cam.matrixWorldInverse);_kf.setFromProjectionMatrix(_km);
  for(const im of kitMeshes){const c=im.userData.cull;if(!c)continue;im.visible=c.center.distanceTo(cp)-c.radius<far&&_kf.intersectsSphere(c)}}
function applyKits(w){
  if(!kitReady){kitWaiters.push(()=>{if(groundWorld===w)applyKits(w)});return}
  if(w.kitsApplied)return;w.kitsApplied=true;
  const groups=new Map(),M=new THREE.Matrix4(),hide=[];
  const emit=(k,p,rule,pidx=-1)=>{const proto=kitProtoCache[k];if(!proto)return;let g=groups.get(k);if(!g)groups.set(k,g={proto,ms:[],pidx:[]});g.ms.push(fitMatrix(p,proto,rule,new THREE.Matrix4()).toArray());g.pidx.push(pidx)};
  const pads=[],ports=w.placements.filter(q=>q.k!=='travel'&&/starport|shuttleport/.test(q.t));
  w.placements.forEach((p,i)=>{let r=kitRule(p);if(!r)return;if(p.k==='travel'&&ports.some(q=>Math.hypot(q.x-p.x,q.z-p.z)<160)){hide.push(i);return}if(r.skip){hide.push(i);return}if(r.k&&!kitProtoCache[r.k]){if(!r.alt)return;r=r.alt;if(r.skip){hide.push(i);return}if(r.k&&!kitProtoCache[r.k])return}
    if(r.composite){const base=COMPOSITES[r.composite],yaw=(p.yaw!=null?p.yaw:strHash(p.t)%360)*Math.PI/180,cy=Math.cos(yaw),sy=Math.sin(yaw);const gy=p.gy??groundH(w,p.x,p.z);
      const colony=!!kitProtoCache.col_gate;base.forEach(c=>{if(c.pad){pads.push({x:p.x,z:p.z,gy,r:c.pad,i});return}if(c.fallback&&colony)return;const x=p.x+c.dx*cy-c.dz*sy,z=p.z+c.dx*sy+c.dz*cy;
        emit(c.k,{x,z,gy:groundH(w,x,z)+(c.lift||(c.k==='xwing'?.4:0)),yaw:p.yaw!=null?p.yaw+(c.yaw||0)*57.3:(c.yaw||0)*57.3},{fit:c.h?'h':'uni',h:c.h,len:c.len},i)});hide.push(i);return}
    emit(r.k,p,r,i);hide.push(i)});
  w.pois.forEach(poi=>{if(poi.cat==='military')castleRing(w,poi,(k,p,rule)=>emit(k,p,rule,-1))});
  // split each kit into map cells so far-away and off-screen buildings are skipped (see tickKitCull)
  for(const [k,g] of groups){const cells=new Map();
    g.ms.forEach((m,j)=>{const key=Math.floor(m[12]/KIT_CELL)+','+Math.floor(m[14]/KIT_CELL);(cells.get(key)||cells.set(key,[]).get(key)).push(j)});
    for(const idx of cells.values()){const n=idx.length;let cx=0,cy=0,cz=0;for(const j of idx){cx+=g.ms[j][12];cy+=g.ms[j][13];cz+=g.ms[j][14]}cx/=n;cy/=n;cz/=n;
      let r=0;for(const j of idx){const m=g.ms[j],sc=Math.hypot(m[0],m[1],m[2]);r=Math.max(r,Math.hypot(m[12]-cx,m[13]-cy,m[14]-cz)+sc*(g.proto.size&&g.proto.size.isVector3?g.proto.size.length()*.5:40))}
      const sphere=new THREE.Sphere(new V3(cx,cy,cz),r+20);
      for(const part of g.proto.parts){const im=new THREE.InstancedMesh(part.geo,part.mat,n);idx.forEach((j,q)=>{M.fromArray(g.ms[j]).multiply(part.m);im.setMatrixAt(q,M)});
        im.instanceMatrix.needsUpdate=true;im.frustumCulled=false;im.userData.pidx=idx.map(j=>g.pidx[j]);im.userData.cull=sphere;G.ground.add(im);kitMeshes.push(im)}}}
  if(pads.length){PAD_TEX=PAD_TEX||padTexture();const pm=new THREE.InstancedMesh(new THREE.CylinderGeometry(1,1,.6,40),[new THREE.MeshLambertMaterial({color:0x7d8086}),new THREE.MeshLambertMaterial({map:PAD_TEX}),new THREE.MeshLambertMaterial({color:0x7d8086})],pads.length);
    pads.forEach((pd,j)=>{M.compose(new V3(pd.x,pd.gy+.3,-pd.z),new THREE.Quaternion(),new V3(pd.r,1,pd.r));pm.setMatrixAt(j,M)});pm.instanceMatrix.needsUpdate=true;pm.userData.pidx=pads.map(p=>p.i);G.ground.add(pm);kitMeshes.push(pm)}
  // hide the stand-in boxes (and any roofs) for everything a kit now represents
  if(markers){const Z=new THREE.Matrix4().makeScale(0,0,0);for(const i of hide)markers.setMatrixAt(i,Z);markers.instanceMatrix.needsUpdate=true;
    if(markers.userData.orig)for(const i of hide)markers.userData.orig.set(Z.elements,i*16)}
  roofMeshes.forEach(rm=>{const Z=new THREE.Matrix4().makeScale(0,0,0);(rm.userData.pidx||[]).forEach((pi,j)=>{if(hide.includes(pi))rm.setMatrixAt(j,Z)});rm.instanceMatrix.needsUpdate=true});
  w.kitHidden=new Set(hide);
}
const roofMeshes=[];

/* ---- creatures: KayKit townsfolk with real animations, Grudge monsters ---- */
const ROLE_KIT={Merchant:'kk_rogue',Traveler:'kk_rogue_hooded',Laborer:'kk_ranger',Bard:'kk_rogue',Innkeeper:'kk_ranger',Artisan:'kk_ranger',Noble:'kk_knight',Healer:'kk_mage',Priest:'kk_mage',Villager:'kk_rogue',Trainer:'kk_knight'};
let ANIMS=null;
function animClips(){if(ANIMS)return ANIMS;const a={};['anim_general','anim_move'].forEach(n=>{const g=kitG[n];if(g)g.animations.forEach(c=>a[c.name]=c)});return(a.Idle_A&&a.Walking_A)?(ANIMS=a):null}
const kitG={};function kitSync(k){return kitG[k]||null}
kitWaiters.push(()=>{for(const k of CREATURE_KITS)KIT[k].then(g=>{kitG[k]=g})});
function creatureFor(p){const g=p.g;if(!g)return null;
  if(g.kind==='friendly'){const hv=strHash(g.name+p.t+Math.round(p.x));return{type:'toon',race:g.race,o:{race:g.race,cls:g.cls,set:GD.armorSets[hv%GD.armorSets.length],tier:g.role==='Guard'||g.role==='Captain'?Math.max(3,g.tier):g.tier,vary:hv,wprof:p.trainer||undefined}}}
  if(g.kind==='boss')return{type:'toon',race:'orc',o:{race:'orc',cls:'raider',set:'Emberclad',tier:Math.min(8,g.tier+2)},scale:2.4};
  const c=g.cat,h=strHash(p.t);
  if(c==='orcs')return{type:'toon',race:'orc',o:{race:'orc',cls:['warrior','raider','thief','ranger'][h%4],set:GD.armorSets[h%6],tier:Math.min(8,g.tier),vary:h^0x9e37}};
  if(c==='undead')return h%3===0?{type:'mount',k:'mount_undead',scale:1.2}:{type:'toon',race:'undead',o:{race:'undead',cls:['warrior','mage','thief'][h%3],set:GD.armorSets[(h>>>3)%6],tier:Math.min(8,g.tier),vary:h^0x9e37}};
  if(c==='trolls'||c==='titans'||c==='minotaurs')return{type:'toon',race:c==='minotaurs'?'barbarian':'orc',o:{race:c==='minotaurs'?'barbarian':'orc',cls:'raider',set:GD.armorSets[h%6],tier:Math.min(8,g.tier),vary:h^0x9e37},scale:c==='titans'?3:2};
  if(c==='golems')return{type:'mount',k:h%2?'catapult_orc':'boltthrower',scale:2.2};
  if(c==='spiders')return{type:'slime',tint:'#3a2f3f',scale:1.4};if(c==='elementals')return{type:'slime',tint:'#ff8a3a',glow:1,scale:1.6};
  if(c==='reptiles')return{type:'mount',k:'mount_dwarf',scale:1.4};
  if(c==='dragons')return{type:'dragon',color:Object.values(DRAGON_COLORS)[h%5],scale:1};
  return{type:'mount',k:/bantha|eopie|kaadu|dewback|ronto|falumpaset|horse|mount/.test(p.t)?'mount_horse':'mount_wolf',scale:1.15};
}
function spawnCreature(p,spec){
  let obj=null,mixer=null,acts=null;
  if(spec.type==='toon'){obj=toonInstance(spec.race,spec.o,{lit:'lambert'});if(!obj)return null}
  else if(spec.type==='kaykit'){const g=kitSync(spec.k),clips=animClips();if(!g)return null;obj=THREE.SkeletonUtils.clone(g.scene);
    if(clips){mixer=new THREE.AnimationMixer(obj);acts={idle:mixer.clipAction(clips.Idle_A||clips.Idle_B),walk:mixer.clipAction(clips.Walking_A),act:clips.Interact&&mixer.clipAction(clips.Interact)};acts.idle.play();mixer.update(Math.random()*2)}}
  else if(spec.type==='dragon'){obj=makeDragon(spec.color)}
  else if(spec.type==='slime'){const g=kitSync('slime');if(!g)return null;obj=g.scene.clone(true);obj.traverse(m=>{if(m.isMesh){m.material=m.material.clone();m.material.color=col(spec.tint);if(spec.glow)m.material.emissive=col(spec.tint).multiplyScalar(.4)}});
    obj.scale.setScalar(.6);const w=new THREE.Group();w.add(obj);obj=w}
  else{const g=kitSync(spec.k);if(!g)return null;obj=THREE.SkeletonUtils.clone(g.scene);if(spec.type==='mount'){obj.userData._gait=gaitRig(obj)}if(spec.tint)obj.traverse(m=>{if(m.isMesh){m.material=m.material.clone();m.material.color=col(spec.tint)}})}
  const holder=new THREE.Group();holder.add(obj);holder.scale.setScalar(spec.scale||1);
  holder.userData={p,spec,mixer,acts,home:{x:p.x,z:p.z},pos:{x:p.x,z:p.z},target:null,wait:Math.random()*4,yaw:(strHash(p.t)%628)/100,t:Math.random()*6,gait:obj.userData&&obj.userData._gait||null,toonObj:spec.type==='toon'?obj:null,slime:spec.type==='slime'?obj:null,dragonObj:spec.type==='dragon'?obj:null};
  return holder}
function thinkCreature(c,dt,w){const u=c.userData;u.t+=dt;aiTick(c,dt,w);const speed=(u.spec.type==='mount'?2.4:1.3)*(u.run||1);
  if(u.spec.type!=='mount'||!/catapult|bolt/.test(u.spec.k||'')){
    if(!u.target){u.wait-=dt;if(u.wait<=0&&!u.aiHold){const a=Math.random()*TAU,r=3+Math.random()*9;u.target={x:u.home.x+Math.cos(a)*r,z:u.home.z+Math.sin(a)*r}}}
    else{const dx=u.target.x-u.pos.x,dz=u.target.z-u.pos.z,d=Math.hypot(dx,dz);if(d<.4){u.target=null;u.wait=2+Math.random()*6;if(u.path&&u.path.length){u.target=u.path.shift();u.wait=0}}else{const st=Math.min(d,speed*dt);u.pos.x+=dx/d*st;u.pos.z+=dz/d*st;
      const want=Math.atan2(dx,-dz);let dy=((want-u.yaw+Math.PI)%TAU+TAU)%TAU-Math.PI;u.yaw+=dy*Math.min(1,dt*5)}}}
  const moving=!!u.target;c.position.set(u.pos.x,groundH(w,u.pos.x,u.pos.z)+(u.slime?Math.abs(Math.sin(u.t*3))*.5*(moving?1:.3):0),-u.pos.z);c.rotation.y=u.yaw;
  if(u.mixer&&u.acts){const want=moving?u.acts.walk:u.acts.idle;if(u.cur!==want){if(u.cur)u.cur.fadeOut(.25);want.reset().fadeIn(.25).play();u.cur=want}u.mixer.update(dt)}
  if(u.gait)gaitTick(u.gait,dt,moving?(u.combat||(u.run||1)>1.5?2:1):0);if(u.toonObj)animateAny(u.toonObj,u.t*7,moving?(u.combat?2:1):0);if(u.dragonObj)dragonTick(u.dragonObj,dt,moving?1:0,false)}

/* ================= SWG-style game systems: data ================= */
const SWGRES=JSON.parse(document.getElementById('swgres').textContent);
const TOOL_NAME=SWGRES.tools,SURVEY_TOOLS=[6,2,3,4,7,1,8,5];
// Professions come from SWGEmu Core3's trainer tables (real skill box ids, branches and elite professions).
const PROF=JSON.parse(document.getElementById('swgprof').textContent);
const ROMAN=['I','II','III','IV'];
const XP_NAME={crafting:'Crafting',surveying:'Surveying',combat:'Combat',unarmed:'Unarmed',onehanded:'One-Handed',twohanded:'Two-Handed',polearm:'Polearm',rifle:'Rifle',pistol:'Pistol',carbine:'Carbine',
  medical:'Medical',scouting:'Scouting',trapping:'Trapping',wilderness:'Wilderness Survival',dance:'Dance',music:'Music',imagedesigner:'Image Design',entertainer:'Entertainer Healing'};
const BOXES={};
for(const [pid,P] of Object.entries(PROF)){const el=!P.start;
  BOXES[P.novice]={id:P.novice,prof:pid,name:'Novice '+P.name,tier:0,branch:-1,xp:el?3000:0,xpType:P.branches[0].xp,pts:el?8:4,cr:el?3000:0,req:P.req.slice()};
  P.branches.forEach((b,bi)=>b.boxes.forEach((id,t)=>{BOXES[id]={id,prof:pid,name:`${b.label} ${ROMAN[t]}`,tier:t+1,branch:bi,fx:b.fx,xpType:b.xp,
    xp:el?[4000,6000,9000,13000][t]:[600,1500,3000,5000][t],pts:el?[8,9,10,11][t]:[4,5,6,7][t],cr:el?2000*(t+1):500*(t+1),req:[t?b.boxes[t-1]:P.novice]}}));
  BOXES[P.master]={id:P.master,prof:pid,name:'Master '+P.name,tier:5,branch:-1,xp:el?18000:8000,xpType:P.branches[0].xp,pts:el?12:8,cr:el?15000:5000,req:P.branches.map(b=>b.boxes[3])}}
const SKILL_POINTS=250;
// Real pre-CU skill data from the SWG client's datatables/skill/skills.iff: credits, skill points, XP type and cost, prerequisites,
// granted commands and skill mods. XP costs run at a 10x server rate (SWG cost / 10); credits and skill points are exact.
const SWGSK=JSON.parse(document.getElementById('swgskills').textContent),XP_RATE=10;
const SWG_XP={combat_general:'combat',combat_meleespecialize_onehand:'onehanded',combat_meleespecialize_twohand:'twohanded',combat_meleespecialize_polearm:'polearm',combat_meleespecialize_unarmed:'unarmed',
  combat_rangedspecialize_carbine:'carbine',combat_rangedspecialize_heavy:'heavy',combat_rangedspecialize_pistol:'pistol',combat_rangedspecialize_rifle:'rifle',crafting_medicine_general:'medical',
  resource_harvesting_inorganic:'surveying',scout:'scouting',camp:'wilderness',trapping:'trapping',creaturehandler:'creaturehandler',bio_engineer_dna_harvesting:'trapping',medical:'medical',
  dance:'dance',music:'music',entertainer_healing:'entertainer',imagedesigner:'imagedesigner',merchant:'merchant',political:'political',squadleader:'squadleader',bountyhunter:'bountyhunter',slicing:'combat'};
Object.assign(XP_NAME,{heavy:'Heavy Weapons',creaturehandler:'Creature Handling',merchant:'Merchant',political:'Political',squadleader:'Squad Leadership',bountyhunter:'Bounty Hunting'});
for(const b of Object.values(BOXES)){const r=SWGSK[b.id];if(!r)continue;const [cr,pts,xt,xc,req,cmds,mods,certs]=r;b.cr=cr;b.pts=pts;
  const t=SWG_XP[xt]||(xt.startsWith('crafting_')||xt==='shipwright'||xt==='reverse_engineering'?'crafting':null);b.xpType=t||b.xpType;b.xp=t?Math.round(xc/XP_RATE):0;
  if(req)b.req=req.split(',').filter(Boolean);b.cmds=cmds?cmds.split(','):[];b.mods=mods?mods.split(',').map(m=>m.split('=')).filter(m=>m[0]&&!m[0].startsWith('private_')):[];b.certs=certs?certs.split(','):[]}
for(const P of Object.values(PROF))P.req=BOXES[P.novice].req.slice();

function skillMods(ch){const m={};for(const id of ch.skills||[]){const b=BOXES[id];if(!b)continue;if(b.fx)m[b.fx]=(m[b.fx]||0)+b.tier*5;
    if(b.tier===5)PROF[b.prof].branches.forEach(br=>m[br.fx]=(m[br.fx]||0)+10)}return m}
// SWG survey tool range steps with Surveying skill: 64 m novice up to 320 m at Surveying IV
function surveyRange(ch){const s=(ch.skills||[]).filter(id=>/artisan_survey_0\d$/.test(id)).length;return 64+64*s}
function surveyGrid(ch){return 3+Math.min(2,Math.floor((ch.skills||[]).filter(id=>/artisan_survey_0\d$/.test(id)).length/2))}

/* Harvesters (SWG installations): kind follows the resource's survey tool, size sets BER, hopper, upkeep and power. */
const HARV_KINDS={6:'Mineral Extractor',2:'Chemical Extractor',3:'Flora Harvester',4:'Natural Gas Processor',7:'Moisture Vaporator',1:'Solar Power Generator',8:'Wind Power Generator',5:'Geothermal Generator'};
const HARV_SIZES={personal:{label:'Personal',ber:6,hopper:3000,upkeep:15,power:0,box:'crafting_artisan_novice'},
  medium:{label:'Medium',ber:14,hopper:8000,upkeep:30,power:0,box:'crafting_artisan_business_02'},
  heavy:{label:'Heavy',ber:30,hopper:20000,upkeep:60,power:25,box:'crafting_artisan_business_04'}};
const HARV_KIT={6:'kk_mine',2:'kk_lumbermill',3:'kk_farm_plot',4:'kk_watermill',7:'kk_watermill',1:'kk_mill',8:'kk_mill',5:'kk_mine'};

/* Crafting: schematics take resource classes and turn resource stats into quality and a Grudge gear tier. */
const SCHEMATICS=[
  {id:'survey_tool',name:'Survey Device',out:'tool',needs:[['Metal',8],['Chemical',4]],attrs:['quality','conductivity'],box:'crafting_artisan_novice'},
  {id:'harv_personal',name:'Personal Harvester Deed',out:'deed',size:'personal',needs:[['Metal',30],['Mineral',15]],attrs:['quality','toughness'],box:'crafting_artisan_novice'},
  {id:'harv_medium',name:'Medium Harvester Deed',out:'deed',size:'medium',needs:[['Metal',80],['Mineral',40],['Chemical',20]],attrs:['quality','toughness'],box:'crafting_artisan_business_02'},
  {id:'harv_heavy',name:'Heavy Harvester Deed',out:'deed',size:'heavy',needs:[['Metal',200],['Mineral',100],['Chemical',60]],attrs:['quality','toughness','conductivity'],box:'crafting_artisan_business_04'},
  {id:'stimpack',name:'Stimpack',out:'medicine',needs:[['Flora Resources',6],['Chemical',4]],attrs:['quality','potential_energy'],box:'science_medic_novice'},
  {id:'ration',name:'Field Ration',out:'food',needs:[['Flora Resources',8],['Creature Resources',4]],attrs:['quality','flavor','nutritional_value'],box:'crafting_artisan_domestic_01'},
  {id:'armor_helm',name:'Helm',out:'armor',slot:'Helm',needs:[['Metal',18],['Creature Resources',6]],attrs:['toughness','shock_resistance','quality'],box:'crafting_artisan_engineering_01'},
  {id:'armor_hands',name:'Hands',out:'armor',slot:'Hands',needs:[['Metal',10],['Creature Resources',6]],attrs:['toughness','malleability','quality'],box:'crafting_artisan_engineering_01'},
  {id:'armor_feet',name:'Feet',out:'armor',slot:'Feet',needs:[['Metal',10],['Creature Resources',6]],attrs:['toughness','malleability','quality'],box:'crafting_artisan_engineering_01'},
  {id:'armor_chest',name:'Chest',out:'armor',slot:'Chest',needs:[['Metal',30],['Creature Resources',10]],attrs:['toughness','shock_resistance','quality'],box:'crafting_artisan_engineering_02'},
  {id:'armor_legs',name:'Legs',out:'armor',slot:'Legs',needs:[['Metal',24],['Creature Resources',8]],attrs:['toughness','shock_resistance','quality'],box:'crafting_artisan_engineering_02'},
  {id:'weapon',name:'Weapon',out:'weapon',slot:'Main hand',needs:[['Metal',26],['Mineral',10]],attrs:['quality','malleability','conductivity'],box:'crafting_artisan_engineering_02'},
  {id:'armor_shoulder',name:'Shoulder',out:'armor',slot:'Shoulder',needs:[['Metal',14],['Creature Resources',6]],attrs:['toughness','shock_resistance','quality'],box:'crafting_artisan_engineering_03'},
  {id:'ring',name:'Ring',out:'armor',slot:'Ring',needs:[['Gemstone',6],['Metal',4]],attrs:['quality','decay_resist'],box:'crafting_artisan_engineering_03'},
  {id:'relic',name:'Relic',out:'armor',slot:'Relic',needs:[['Gemstone',12],['Chemical',8]],attrs:['quality','potential_energy','decay_resist'],box:'crafting_artisan_engineering_04'},
];
const RES_ATTR_LABEL={quality:'OQ',conductivity:'CD',decay_resist:'DR',heat_resist:'HR',cold_resist:'CR',malleability:'MA',shock_resistance:'SR',toughness:'UT',flavor:'FL',potential_energy:'PE',nutritional_value:'NV',entangle_resistance:'ER'};
const CLASS_WEAPON_XP={warrior:'onehanded',raider:'twohanded',thief:'onehanded',worge:'onehanded',ranger:'rifle',mage:'polearm',priest:'polearm',verduror:'polearm'};
const PROF_BLURB={artisan:'Surveys, harvests and crafts. The economy runs on Artisans.',brawler:'Close-quarters fighter with fists, blades and polearms.',marksman:'Ranged specialist with rifles, pistols and carbines.',
  medic:'Heals wounds and brews stimpacks.',scout:'Explores, hunts and harvests creature resources.',entertainer:'Dances, plays music and heals battle fatigue.'};
for(const [k,P] of Object.entries(PROF))P.blurb=PROF_BLURB[k]||`Elite profession. Novice needs ${P.req.map(r=>BOXES[r]?BOXES[r].name:r).join(' and ')}.`;

/* ================= SWG-style game layer: characters, professions, harvesting, crafting, combat, whale travel ================= */
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
/* ---- saves: the viewer's private db space when available, browser storage otherwise ---- */
const Store={mode:'local',col:null,
  async init(){try{const use=window.claude&&window.claude.use;if(!use)return;const to=new Promise(r=>setTimeout(()=>r(null),8000));
      const [db,user]=await Promise.race([Promise.all([use('db'),use('user')]),to.then(()=>[null,null])]);if(!db||!user)return;const id=await user.id();if(!id)return;
      this.col=db.collection('data/users/'+id+'/chars');this.mode='cloud'}catch(e){console.warn('db unavailable',e)}},
  local(){try{return JSON.parse(localStorage.getItem('swgatlas.chars')||'[]')}catch(e){return[]}},
  // cloud saves win, but a character saved in this browser while the server was unreachable is kept (newest copy wins) and uploaded
  async list(){const loc=this.local();if(this.mode==='cloud'){try{const s=await this.col.get(),cloud=s.docs.map(d=>d.data()).filter(Boolean),by=new Map(cloud.map(c=>[c.id,c]));
        for(const c of loc){const k=by.get(c.id);if(!k||(c.played||0)>(k.played||0)){by.set(c.id,c);this.col.doc(c.id).set(c).catch(()=>{})}}return[...by.values()].slice(0,8)}catch(e){console.warn(e)}}
    return loc},
  async save(ch){const data=JSON.parse(JSON.stringify(ch));if(this.mode==='cloud'){try{await this.col.doc(ch.id).set(data);return true}catch(e){console.warn(e)}}
    try{const all=JSON.parse(localStorage.getItem('swgatlas.chars')||'[]').filter(c=>c.id!==ch.id);all.push(data);localStorage.setItem('swgatlas.chars',JSON.stringify(all));return true}catch(e){return false}},
  async del(id){if(this.mode==='cloud'){try{await this.col.doc(id).delete()}catch(e){console.warn(e)}}
    try{localStorage.setItem('swgatlas.chars',JSON.stringify(JSON.parse(localStorage.getItem('swgatlas.chars')||'[]').filter(c=>c.id!==id)))}catch(e){}}};
const storeReady=Store.init();

/* ---- the active character ---- */
let CH=null,dirty=false;const markDirty=()=>{dirty=true};
function newCharacter(o){return{id:'c'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),name:o.name,race:o.race,cls:o.cls,set:o.set,tier:1,
  prof:o.prof,skills:[PROF[o.prof].novice],xp:{},credits:2500,hp:null,inv:{res:{},items:[{id:'i1',kind:'tool',name:'Survey Device',q:300},{id:'i2',kind:'deed',name:'Personal Harvester Deed',size:'personal',q:250}]},gear:{},
  planet:o.planet,pos:o.pos,harvesters:[],discovered:[],created:Date.now(),played:0}}
// Older saves used placeholder skill ids; keep what maps onto the real SWG boxes and make sure the starting novice box is there.
function migrate(c){if(c&&c.planet&&typeof WORLDS!=='undefined'&&WORLDS.length&&!WORLDS.some(w=>w.id===c.planet)){const w=WORLDS[0],q=w.pois.find(p=>p.cat==='city')||w.pois[0];c.planet=w.id;c.pos={x:q.x+6,z:q.z+6}}
  c.skills=(c.skills||[]).map(id=>BOXES[id]?id:(PROF[id.replace(/_novice$/,'')]?PROF[id.replace(/_novice$/,'')].novice:null)).filter(Boolean);
  if(!PROF[c.prof])c.prof='artisan';if(!c.skills.includes(PROF[c.prof].novice))c.skills.unshift(PROF[c.prof].novice);c.skills=[...new Set(c.skills)];
  c.inv=c.inv||{res:{},items:[]};c.inv.items.forEach(i=>{if(i.kind==='deed'&&!i.size)i.size=/heavy/i.test(i.name)?'heavy':/medium/i.test(i.name)?'medium':'personal'});
  (c.harvesters||[]).forEach(h=>{if(!h.size){h.size='personal';h.hopper=0;h.maint=150;h.power=0;h.on=true;h.updated=Date.now()}});c.harvesters=c.harvesters||[];c.xp=c.xp||{};return c}
function syncLook(){if(!CH)return;Object.assign(warlord,{race:CH.race,cls:CH.cls,set:CH.set,tier:gearTier(),wprof:weaponProf(CH)});saveWarlord()}
function gearTier(){const its=Object.values(CH.gear||{}).map(id=>CH.inv.items.find(i=>i.id===id)).filter(Boolean);return its.length?Math.max(1,Math.round(its.reduce((a,i)=>a+i.tier,0)/its.length)):1}
function charStats(){if(window.GG_COMBAT&&CH)return ggCharStats();return charStatsLegacy()}
function ggCharStats(){const C=window.GG_COMBAT,lv=combatLevel(),base=warlordStats({...warlord,tier:Math.max(1,Math.min(8,Math.ceil(lv/12)))}),m=skillMods(CH),its=Object.values(CH.gear||{}).map(id=>CH.inv.items.find(i=>i.id===id)).filter(Boolean);
  const gear=its.map(i=>({id:i.id,name:i.name,kind:i.kind,slot:i.slot,tier:i.tier||1,q:i.q||300,gun:i.gun,attrs:i.attrs}));
  if(!gear.some(i=>i.kind==='weapon')&&base.wpn)gear.push({id:'set:'+base.wpn.name,name:base.wpn.name,kind:'weapon',tier:base.wpn.tier||1,q:400});
  const cs=C.derive({level:lv,classStart:(CLASS[CH.cls]||{}).start||{},raceBonus:(RACE[CH.race]||{}).bonuses||{},cls:CH.cls,gear,setBonus:{hp:base.tot.hp*.25,defense:base.tot.defense*.3,crit:base.tot.crit,block:base.tot.block},skillMods:m});
  const pw=C.powerFor(cs,cs.kind);return{maxHp:cs.maxHp,def:Math.round(cs.armor),dmg:Math.round(cs.weapon*(1+pw/100)),range:cs.range,m,cs,level:lv}}
function charStatsLegacy(){const base=warlordStats({...warlord,tier:1}),m=skillMods(CH),its=Object.values(CH.gear||{}).map(id=>CH.inv.items.find(i=>i.id===id)).filter(Boolean);
  let hp=600+base.tot.hp*.25,def=base.tot.defense*.3,dmg=40+base.dmg*.5;for(const i of its){hp+=i.tier*70*(i.q/600);def+=i.tier*14*(i.q/600);if(i.kind==='weapon')dmg+=i.tier*22*(i.q/600)}
  const melee=!/ranger|mage|priest/.test(CH.cls),dm=m.damage||0;def*=1+(m.defense||0)/200;
  return{maxHp:Math.round(hp*(1+(m.survival||0)/200)),def:Math.round(def),dmg:Math.round(dmg*(1+dm/250)),range:melee?4.5:22,m}}
function gainXP(type,n,why){if(!CH)return;n=Math.round(n*mmXpMul());if(/dance|music|entertainer|imagedesigner/.test(type))n=Math.round(n*(1+(skillMods(CH).performance||0)/200));CH.xp[type]=(CH.xp[type]||0)+n;markDirty();floatMsg(`+${n} ${xpName(type)} XP${why?' · '+why:''}`);renderHud()}
const xpName=t=>XP_NAME[t]||t;
function pointsUsed(ch){return(ch.skills||[]).reduce((a,id)=>a+(BOXES[id]?BOXES[id].pts:0),0)}

/* ---- HUD ---- */
const hud=document.createElement('div');hud.id='ghud';hud.hidden=true;hud.innerHTML=`
  <div class="gh-frame"><b id="ghName"></b><small id="ghProf"></small><div class="gh-bar"><i id="ghHp"></i><span id="ghHpT"></span></div><small id="ghCr"></small></div>
  <div class="gh-target" id="ghTarget" hidden><b id="ghTName"></b><div class="gh-bar"><i id="ghTHp"></i></div></div>
  <div class="gh-prompt" id="ghPrompt" hidden></div>
  <div class="gh-bar-actions" id="ghActions"></div>
  <div class="gh-log" id="ghLog" aria-live="polite"></div>`;
document.body.append(hud);
const ACTIONS=[['survey','Survey','U'],['sample','Sample','J'],['harvester','Harvesters','H'],['inventory','Inventory','I'],['skills','Skills','K'],['craft','Craft','C'],['travel','Travel','T'],['codex','Codex','L'],['menu','Menu','M']];
$('#ghActions').innerHTML=ACTIONS.map(([id,l,k])=>`<button data-act="${id}"><kbd>${k}</kbd>${l}</button>`).join('');
$('#ghActions').addEventListener('click',e=>{const b=e.target.closest('button');if(b)doAction(b.dataset.act)});
function renderHud(){const show=!!CH&&level==='ground'&&groundMode==='play';hud.hidden=!show;if(!show)return;const st=charStats();if(CH.hp==null)CH.hp=st.maxHp;CH.hp=Math.min(CH.hp,st.maxHp);
  $('#ghName').textContent=CH.name;$('#ghProf').textContent=`${RACE[CH.race].name} ${CLASS[CH.cls].name} · ${CH.skills.filter(s=>BOXES[s]).map(s=>BOXES[s]).filter(b=>b.tier===0||b.tier===5).map(b=>b.name).join(', ')}`;
  $('#ghHp').style.width=(100*CH.hp/st.maxHp)+'%';$('#ghHpT').textContent=`${Math.round(CH.hp)} / ${st.maxHp}`;$('#ghCr').textContent=`${CH.credits.toLocaleString()} credits · ${Store.mode==='cloud'?'saved to your account':'saved in this browser'}`;
  const t=combat.p;$('#ghTarget').hidden=!t;if(t){$('#ghTName').textContent=`${t.g.name} · T${t.g.tier}`;$('#ghTHp').style.width=(100*Math.max(0,t.g.hp)/t.g.maxHp)+'%'}mmHud()}
function floatMsg(t){mmLog(t,/ hits | hit |defeat|fallen|incapacitat|damage|attack|Looted/i.test(t)?'combat':'sys')}

/* ---- game window (skills, inventory, crafting, survey, travel, menu, characters) ---- */
const gw=document.createElement('section');gw.id='gwin';gw.hidden=true;gw.setAttribute('role','dialog');gw.innerHTML='<div class="gw-card"><header><h2 id="gwTitle"></h2><button class="x" id="gwClose" aria-label="Close">×</button></header><div id="gwBody"></div></div>';
document.body.append(gw);$('#gwClose').onclick=()=>closeWin();let winKind=null;
function openWin(kind){winKind=kind;gw.hidden=false;renderWin()}
function closeWin(){gw.hidden=true;winKind=null}
function renderWin(){if(gw.hidden)return;const B=$('#gwBody');const R={skills:winSkills,inventory:winInventory,craft:winCraft,survey:winSurvey,travel:winTravel,menu:winMenu,codex:winCodex,navigate:winNavigate,chars:winChars,harvesters:winHarvesters,missions:winMissions,mounts:winMounts,cart:winCart,vendor:winVendor}[winKind];if(R)R(B);if(winKind==='menu'){mmMenuExtras(B);menuExtras()}}
function doAction(a){if(a==='menu')return openWin('menu');if(!CH)return openWin('chars');
  if(a==='sample')return sampling?stopSample():startSample();if(a==='harvester')return openWin('harvesters');if(a==='travel'){const tp=nearTravel();if(!tp){toast('Walk to a shuttleport or starport landing pad to travel.');return}return openWin('travel')}
  openWin(a)}

let skillProf=null,SKILL_SEL=null;
function nearTrainer(pid){if(!groundWorld||groundMode!=='play')return null;return groundWorld.placements.find(p=>p.trainer===pid&&Math.hypot(p.x-play.x,p.z-play.z)<14)||null}
function findTrainer(pid){if(!groundWorld)return null;let best=null,bd=Infinity;for(const p of groundWorld.placements)if(p.trainer===pid){const d=Math.hypot(p.x-play.x,p.z-play.z);if(d<bd){bd=d;best=p}}return best}
function boxState(b){const own=CH.skills.includes(b.id),reqOk=b.req.every(r=>CH.skills.includes(r)),xpOk=(CH.xp[b.xpType]||0)>=b.xp,ptsOk=pointsUsed(CH)+b.pts<=SKILL_POINTS,crOk=CH.credits>=b.cr;
  const dependents=CH.skills.filter(id=>BOXES[id]&&BOXES[id].req.includes(b.id)),novices=CH.skills.filter(id=>BOXES[id]&&BOXES[id].tier===0).length;
  return{own,reqOk,xpOk,ptsOk,crOk,can:!own&&reqOk&&xpOk&&ptsOk&&crOk,canSurrender:own&&!dependents.length&&(b.tier!==0||novices>1)}}
const FX_TEXT={assembly:'crafting quality',food:'food and drink',harvesters:'harvester count and upkeep',survey:'survey range and sample yield',damage:'damage',defense:'defense',heal:'healing',hunting:'creature harvesting',survival:'health and regeneration',performance:'performance XP'};
function winSkillTree(B){$('#gwTitle').textContent='Skills';const used=pointsUsed(CH);skillProf=skillProf||CH.prof;const P=PROF[skillProf];
  const owned=Object.keys(PROF).filter(pid=>CH.skills.some(id=>BOXES[id]&&BOXES[id].prof===pid));
  const xpTypes=Object.keys(CH.xp).filter(t=>CH.xp[t]);
  const cell=b=>{const st=boxState(b),cls=st.own?'own':st.can?'can':st.reqOk?'next':'';return`<button class="sk ${cls}${SKILL_SEL===b.id?' sel':''}" data-box="${b.id}" data-tip-k="box:${b.id}">${esc(b.tier===0?'Novice':b.tier===5?'Master':ROMAN[b.tier-1])}</button>`};
  const sel=SKILL_SEL&&BOXES[SKILL_SEL]&&BOXES[SKILL_SEL].prof===skillProf?BOXES[SKILL_SEL]:null,st=sel&&boxState(sel),tr=sel&&nearTrainer(sel.prof);
  const CAT={crafting:'Crafting',combat:'Combat',science:'Medical',outdoors:'Outdoors',social:'Social'};
  B.innerHTML=`<div class="gw-sk-head"><span>Skill points <b>${used}</b> / ${SKILL_POINTS}</span><span><b>${CH.credits.toLocaleString()}</b> credits</span>${xpTypes.map(t=>`<span>${esc(xpName(t))} <b>${CH.xp[t].toLocaleString()}</b></span>`).join('')}</div>
   <div class="gw-sk"><nav class="gw-sk-list">${Object.keys(CAT).map(cat=>`<small>${CAT[cat]}</small>${Object.entries(PROF).filter(([,p])=>p.cat===cat).sort((a,b)=>b[1].start-a[1].start||a[1].name.localeCompare(b[1].name)).map(([pid,p])=>`<button data-prof="${pid}" aria-pressed="${pid===skillProf}" style="--c:${p.color}">${esc(p.name)}${p.start?'':'<em>Elite</em>'}${owned.includes(pid)?'<i>●</i>':''}</button>`).join('')}`).join('')}</nav>
   <div class="gw-sk-tree" style="--c:${P.color}"><h3>${esc(P.name)}${P.start?' <em>Starting profession</em>':' <em>Elite profession</em>'}</h3>
     ${P.req.length?`<p class="gw-note">Novice requires ${P.req.map(r=>`<b class="${CH.skills.includes(r)?'ok':'no'}">${esc(BOXES[r]?BOXES[r].name+' ('+PROF[BOXES[r].prof].name+')':r)}</b>`).join(' and ')}.</p>`:''}
     ${cell(BOXES[P.novice])}<div class="gw-branches">${P.branches.map(b=>`<div><small>${esc(b.label)}</small>${b.boxes.map(id=>cell(BOXES[id])).join('')}</div>`).join('')}</div>${cell(BOXES[P.master])}
     <div class="gw-sk-info">${sel?`<b>${esc(sel.name)}</b><ul>
       <li class="${st.reqOk?'ok':'no'}">Requires ${sel.req.length?sel.req.map(r=>esc(BOXES[r]?BOXES[r].name:r)).join(', '):'nothing'}</li>
       <li class="${st.xpOk?'ok':'no'}">${sel.xp.toLocaleString()} ${esc(xpName(sel.xpType))} XP (you have ${(CH.xp[sel.xpType]||0).toLocaleString()})</li>
       <li class="${st.ptsOk?'ok':'no'}">${sel.pts} skill points</li><li class="${st.crOk?'ok':'no'}">${sel.cr.toLocaleString()} credits to the trainer</li>
       <li class="${tr?'ok':'no'}">${tr?'A '+esc(P.name)+' trainer is here':'Stand next to a '+esc(P.name)+' trainer'}</li>${sel.fx?`<li>Improves ${esc(FX_TEXT[sel.fx]||sel.fx)}</li>`:sel.tier===5?'<li>Master: +10% to every branch effect</li>':''}</ul>
       <div class="acts">${st.own?(st.canSurrender?`<button class="btn" data-surrender="${sel.id}">Surrender</button>`:'<small>Learned</small>'):st.can&&tr?`<button class="btn primary" data-learn="${sel.id}">Learn</button>`:''}${!st.own?`<button class="btn" data-find="${sel.prof}">Find trainer</button>`:''}</div>`
       :'<p class="gw-note">Select a box to see what it needs. Earn the XP by doing the work, then learn the box from that profession\'s trainer in a city. Surrender boxes to free skill points.</p>'}</div></div></div>`;
  B.querySelectorAll('[data-prof]').forEach(b=>b.onclick=()=>{skillProf=b.dataset.prof;SKILL_SEL=null;renderWin()});
  B.querySelectorAll('[data-box]').forEach(b=>b.onclick=()=>{SKILL_SEL=b.dataset.box;renderWin()});
  B.querySelectorAll('[data-learn]').forEach(b=>b.onclick=()=>{const x=BOXES[b.dataset.learn];CH.credits-=x.cr;CH.skills.push(x.id);markDirty();toast(`Learned ${x.name}.`);renderWin();renderHud()});
  B.querySelectorAll('[data-surrender]').forEach(b=>b.onclick=()=>{CH.skills=CH.skills.filter(id=>id!==b.dataset.surrender);markDirty();toast(`Surrendered ${BOXES[b.dataset.surrender].name}. Its skill points are free again.`);renderWin();renderHud()});
  B.querySelectorAll('[data-find]').forEach(b=>b.onclick=()=>{if(groundMode!=='play')return toast('Enter Play to walk to a trainer.');const t=findTrainer(b.dataset.find);if(!t)return toast(`No ${PROF[b.dataset.find].name} trainer on this planet. Elite trainers work in each planet's largest cities.`);setWaypoint(t.x,t.z,PROF[b.dataset.find].name+' trainer');closeWin();toast(`Waypoint set to the ${PROF[b.dataset.find].name} trainer, ${fmt(Math.hypot(t.x-play.x,t.z-play.z))} m away.`)})}

function resQuality(r,attrs){const v=attrs.map(a=>r.a[a]).filter(x=>x!=null);return v.length?v.reduce((a,b)=>a+b,0)/v.length:(r.a.quality||300)}

function canCraft(s){return CH.skills.includes(s.box)}
function pickResources(s){const used=[];for(const [cls,n] of s.needs){const opts=Object.entries(CH.inv.res).filter(([,r])=>r.cl.includes(cls)&&r.units>=n).sort((a,b)=>resQuality(b[1],s.attrs)-resQuality(a[1],s.attrs));if(!opts.length)return null;used.push([opts[0][0],n,opts[0][1]])}return used}

/* ---- surveying, sampling and harvesters (SWG-style) ---- */
const planetRes=()=>SWGRES.planets[curWorld.id]||[];
// Each resource spawns as a few hotspots across the planet, like SWG concentration maps.
const hotCache={};
function hotspots(r,wid){const k=wid+':'+r.n;if(hotCache[k])return hotCache[k];const R=mulberry(strHash(k)),n=3+Math.floor(R()*4),out=[];
  for(let i=0;i<n;i++)out.push({x:(R()*2-1)*7400,z:(R()*2-1)*7400,peak:45+R()*55,s:700+R()*1600});return hotCache[k]=out}
function surfAt(x,z,k){const G2=groundWorld&&groundWorld.surfGrid;if(!G2)return 0;const gx=Math.round((x+HALF)/G2.cell),gy=Math.round((HALF-z)/G2.cell);if(gx<0||gy<0||gx>=G2.N||gy>=G2.N)return 0;const i=gy*G2.N+gx;return k==='water'?(G2.water?G2.water[i]:0):G2.wt[i*2+(k==='veg'?0:1)]}
function concentration(r,x,z){let c=0;for(const h of hotspots(r,curWorld.id)){const d2=(x-h.x)**2+(z-h.z)**2;c=Math.max(c,h.peak*Math.exp(-d2/(2*h.s*h.s)))}
  const hh=strHash(r.n);c+=(fbm(x*.002+(hh%97),3,z*.002,hh%1000,3)-.5)*14;if(BIOME_RES[r.t]&&BIOME_RES[r.t].test(biomeAt(groundWorld,x,z).key))c+=14;if(r.t===7)c+=surfAt(x,z,'water')*30;if(r.t===3)c+=surfAt(x,z,'veg')*18;if(r.t===8)c+=Math.max(0,(groundH(groundWorld,x,z)-(groundWorld.hmean||0))/12);
  return Math.max(0,Math.min(100,Math.round(c)))}
let surveyTool=6,waypoint=null,surveyRes=null;
function winSurvey(B){$('#gwTitle').textContent='Survey';const range=surveyRange(CH),grid=surveyGrid(CH),px=play.x,pz=play.z;
  if(!CH.inv.items.some(i=>i.kind==='tool')){B.innerHTML='<p class="gw-note">You need a Survey Device. Craft one from Metal and Chemical (Novice Artisan).</p>';return}
  const list=planetRes().filter(r=>r.t===surveyTool);if(!surveyRes||!list.includes(surveyRes))surveyRes=list.find(r=>r.n===CH.lastSurvey)||list[0];
  B.innerHTML=`<div class="gw-tools">${SURVEY_TOOLS.map(t=>`<button class="crchip" style="--c:#5fc4e8" aria-pressed="${t===surveyTool}" data-tool="${t}"><i></i>${TOOL_NAME[t]}</button>`).join('')}</div>
   <p class="gw-note">Survey range ${range} m with a ${grid}×${grid} reading (Surveying boxes raise both, up to 320 m). Pick a resource to read its concentration map around you, then walk to the richest point and Sample (J) or place a harvester.</p>
   <div class="gw-survey"><ul class="gw-list">${list.map(r=>{const c=concentration(r,px,pz);return`<li class="${r===surveyRes?'sel':''}"><span><b>${esc(r.n)}</b> <small>${esc(r.c)}</small></span><small>${Object.entries(r.a).slice(0,5).map(([k,v])=>`${RES_ATTR_LABEL[k]||k} ${v}`).join(' ')}</small><span class="conc"><i style="width:${c}%"></i>${c}%</span><button class="btn mini" data-res="${esc(r.n)}">Map</button></li>`}).join('')||'<li>No resources of this type are in spawn here.</li>'}</ul>
   ${surveyRes?`<div class="gw-map"><canvas id="svMap" width="220" height="220" aria-label="Concentration map"></canvas><small id="svBest"></small><button class="btn primary" id="svWp">Set waypoint to best</button></div>`:''}</div>`;
  B.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>{surveyTool=+b.dataset.tool;surveyRes=null;renderWin()});
  B.querySelectorAll('[data-res]').forEach(b=>b.onclick=()=>{surveyRes=list.find(x=>x.n===b.dataset.res);CH.lastSurvey=surveyRes.n;gainXP('surveying',20,'surveying');renderWin()});
  if(!surveyRes)return;CH.lastSurvey=surveyRes.n;const cv=$('#svMap'),x=cv.getContext('2d'),cs=220/grid;let best={c:-1};
  for(let i=0;i<grid;i++)for(let j=0;j<grid;j++){const wx=px+((i+.5)/grid-.5)*2*range,wz=pz-((j+.5)/grid-.5)*2*range,c=concentration(surveyRes,wx,wz);if(c>best.c)best={x:wx,z:wz,c};
    x.fillStyle=`hsl(${190-c*1.4},70%,${18+c*.42}%)`;x.fillRect(i*cs+1,j*cs+1,cs-2,cs-2);x.fillStyle='#e8eef5';x.font='12px IBM Plex Mono, monospace';x.textAlign='center';x.fillText(c+'%',i*cs+cs/2,j*cs+cs/2+4)}
  x.strokeStyle='#f2b04a';x.lineWidth=2;x.strokeRect(110-cs/2,110-cs/2,cs,cs);
  $('#svBest').textContent=`Best in range: ${best.c}% · ${fmt(Math.hypot(best.x-px,best.z-pz))} m away. You are in the centre square.`;
  $('#svWp').onclick=()=>{setWaypoint(best.x,best.z,`${surveyRes.n} ${best.c}%`);closeWin();toast(`Waypoint set: ${surveyRes.n} at ${best.c}%.`)}}
function setWaypoint(x,z,label){if(waypoint)G.ground.remove(waypoint);const g=new THREE.Group();const beam=new THREE.Mesh(new THREE.CylinderGeometry(.6,.6,60,10,1,true),new THREE.MeshBasicMaterial({color:0x6ff0ff,transparent:true,opacity:.35,side:THREE.DoubleSide,depthWrite:false}));beam.position.y=30;g.add(beam);
  g.position.set(x,groundH(groundWorld,x,z),-z);g.userData={x,z,label};G.ground.add(g);waypoint=g}
// SWG sampling: repeats every few seconds until you move, stop it, or the spot is too thin; occasional critical finds
let sampling=null;
function startSample(){if(!CH.inv.items.some(i=>i.kind==='tool'))return toast('You need a Survey Device to sample.');
  const r=planetRes().find(x=>x.n===CH.lastSurvey);if(!r)return toast('Survey first (U) and pick a resource to sample.');if(r.t===-1)return;
  const c=concentration(r,play.x,play.z);if(c<8)return toast(`${r.n} is too thin here (${c}%). Follow your survey waypoint to a richer spot.`);
  sampling={r,t:0,x:play.x,z:play.z,n:0};floatMsg(`Sampling ${r.n} at ${c}%… (J to stop)`)}
function stopSample(){if(sampling)floatMsg(`Stopped sampling after ${sampling.n} samples`);sampling=null}
function tickSample(dt){if(!sampling)return;if(Math.hypot(play.x-sampling.x,play.z-sampling.z)>2){floatMsg('You moved, so sampling stopped');sampling=null;return}
  sampling.t+=dt;if(sampling.t<4)return;sampling.t=0;const {r}=sampling,c=concentration(r,play.x,play.z),m=skillMods(CH);
  if(Math.random()<.12){floatMsg('This sample came up empty');return}let units=Math.max(1,Math.round(c/10*(1+(m.survey||0)/40)*(1.5+Math.random())*(cartNear(play.x,play.z,30)?1.3:1)));
  if(Math.random()<.08+(m.survey||0)/1000){units*=3;floatMsg('Critical success! You found a rich vein')}
  addRes(r,units);sampling.n++;gainXP('surveying',Math.round(6+c/6),'');floatMsg(`Sampled ${units} units of ${r.n}`)}
function addRes(r,units){mmOnRes(r,units);const cur=CH.inv.res[r.n]||(CH.inv.res[r.n]={units:0,c:r.c,cl:r.cl,a:r.a,t:r.t});cur.units+=units;markDirty()}
// Harvesters: BER × concentration per minute, into a hopper; they need maintenance credits, and heavy ones need power
function maxHarvesters(){return 2+Math.floor((skillMods(CH).harvesters||0)/10)}
function placeHarvester(deedId){const deed=CH.inv.items.find(i=>i.id===deedId);if(!deed)return;if(CH.harvesters.length>=maxHarvesters())return toast(`You can run ${maxHarvesters()} harvesters. Business boxes raise the limit.`);
  const r=planetRes().find(x=>x.n===CH.lastSurvey);if(!r||r.t===-1)return toast('Survey a resource first (U), then place the harvester on a rich spot.');
  if(!CH.skills.includes(HARV_SIZES[deed.size].box))return toast(`${HARV_SIZES[deed.size].label} harvesters need ${BOXES[HARV_SIZES[deed.size].box].name}.`);
  const c=concentration(r,play.x,play.z);if(c<12)return toast(`Concentration here is only ${c}%. Find a richer spot.`);
  const S=HARV_SIZES[deed.size];const h={id:'h'+Date.now().toString(36),planet:curWorld.id,x:play.x+5,z:play.z,res:r.n,t:r.t,c,size:deed.size,ber:Math.round(S.ber*(.8+deed.q/2500)),hopper:0,maint:Math.min(CH.credits,S.upkeep*10),power:0,on:true,updated:Date.now()};
  CH.credits-=h.maint;CH.harvesters.push(h);CH.inv.items=CH.inv.items.filter(i=>i!==deed);markDirty();drawHarvesters();
  toast(`${S.label} ${HARV_KINDS[r.t]} placed on ${r.n} (${c}%), with ${h.maint} credits of maintenance.${S.power?' Add power to start it.':''}`);renderWin()}
function simHarvester(h,now){const S=HARV_SIZES[h.size]||HARV_SIZES.personal,m=skillMods(CH),upkeep=S.upkeep*(1-Math.min(.5,(m.harvesters||0)/200));
  let mins=(now-h.updated)/60000;h.updated=now;if(!h.on||mins<=0)return;
  mins=Math.min(mins,h.maint/(upkeep/60));if(S.power)mins=Math.min(mins,h.power/(S.power/60));if(mins<=0){h.on=false;return}
  h.maint=Math.max(0,h.maint-upkeep/60*mins);if(S.power)h.power=Math.max(0,h.power-S.power/60*mins);
  h.hopper=Math.min(S.hopper,h.hopper+h.ber*h.c/100*mins);if(h.maint<=0||(S.power&&h.power<=0)||h.hopper>=S.hopper)h.on=false}
let harvT=0;function tickAllHarvesters(){harvT-=1;if(harvT>0)return;harvT=5;const now=Date.now();(CH.harvesters||[]).forEach(h=>simHarvester(h,now))}
function winHarvesters(B){$('#gwTitle').textContent='Harvesters';const now=Date.now();CH.harvesters.forEach(h=>simHarvester(h,now));
  const deeds=CH.inv.items.filter(i=>i.kind==='deed'),r=planetRes().find(x=>x.n===CH.lastSurvey),c=r&&groundMode==='play'?concentration(r,play.x,play.z):null;
  const energy=Object.entries(CH.inv.res).filter(([,v])=>[1,8,5].includes(v.t)||v.cl.some(x=>/energy/i.test(x)));
  B.innerHTML=`<p class="gw-note">${CH.harvesters.length} of ${maxHarvesters()} harvesters. They extract while you're away, BER × concentration per minute, until the hopper fills or maintenance runs out. Heavy harvesters also burn power from energy resources (solar, wind, geothermal).</p>
   <h3>Place a harvester here</h3>${deeds.length?`<p class="gw-note">${r?`Current survey: <b>${esc(r.n)}</b> (${esc(TOOL_NAME[r.t])}) at ${c}% where you stand.`:'Survey a resource first (U).'}</p><ul class="gw-list">${deeds.map(d=>`<li><span><b>${esc(d.name)}</b></span><small>BER ${HARV_SIZES[d.size].ber} · hopper ${HARV_SIZES[d.size].hopper.toLocaleString()} · ${HARV_SIZES[d.size].upkeep} cr/hr${HARV_SIZES[d.size].power?` · ${HARV_SIZES[d.size].power} power/hr`:''}</small><span></span><button class="btn mini primary" data-place="${d.id}">Place</button></li>`).join('')}</ul>`:'<p class="gw-note">No deeds. Craft harvester deeds (C).</p>'}
   <h3>Your harvesters</h3><ul class="gw-list">${CH.harvesters.map(h=>{const S=HARV_SIZES[h.size],near=groundWorld&&h.planet===groundWorld.id&&groundMode==='play'&&(Math.hypot(h.x-play.x,h.z-play.z)<20||cartNear(h.x,h.z,60)),upk=S.upkeep;
     return`<li><span><b>${esc(S.label)} ${esc(HARV_KINDS[h.t]||'Harvester')}</b> <small>${esc(h.res)} ${h.c}% · ${esc((WORLDS.find(w=>w.id===h.planet)||{name:h.planet}).name)}</small></span>
      <small>${h.on?'Running':'Stopped'} · BER ${h.ber} · hopper ${Math.floor(h.hopper).toLocaleString()} / ${S.hopper.toLocaleString()} · upkeep ${(h.maint/upk).toFixed(1)} h${S.power?` · power ${(h.power/S.power).toFixed(1)} h`:''}</small>
      <span class="conc"><i style="width:${100*h.hopper/S.hopper}%"></i>${Math.round(100*h.hopper/S.hopper)}%</span>
      <span class="gw-hb">${near?`<button class="btn mini primary" data-collect="${h.id}">Collect</button>`:''}<button class="btn mini" data-maint="${h.id}">+${upk*10} cr upkeep</button>${S.power&&energy.length?`<button class="btn mini" data-power="${h.id}">Add power</button>`:''}<button class="btn mini" data-toggle="${h.id}">${h.on?'Stop':'Start'}</button>${near?`<button class="btn mini" data-redeed="${h.id}">Redeed</button>`:''}</span></li>`}).join('')||'<li>None yet.</li>'}</ul>`;
  const H=id=>CH.harvesters.find(h=>h.id===id);
  B.querySelectorAll('[data-place]').forEach(b=>b.onclick=()=>placeHarvester(b.dataset.place));
  B.querySelectorAll('[data-collect]').forEach(b=>b.onclick=()=>{const h=H(b.dataset.collect),u=Math.floor(h.hopper),r=SWGRES.planets[h.planet].find(x=>x.n===h.res);if(u<1)return toast('The hopper is empty.');h.hopper-=u;let got=u,where='';if(cartNear(h.x,h.z,60)){const bonus=Math.round(u*1.15),put=stashAdd(r,bonus);if(put){where=' into your cart (+15%)';got=bonus;if(put<bonus)addRes(r,bonus-put)}else addRes(r,u)}else addRes(r,u);gainXP('surveying',Math.round(u/20),'harvesting');toast(`Collected ${got} units of ${h.res}${where}.`);markDirty();renderWin()});
  B.querySelectorAll('[data-maint]').forEach(b=>b.onclick=()=>{const h=H(b.dataset.maint),add=HARV_SIZES[h.size].upkeep*10;if(CH.credits<add)return toast('Not enough credits.');CH.credits-=add;h.maint+=add;h.on=true;h.updated=Date.now();markDirty();renderWin();renderHud()});
  B.querySelectorAll('[data-power]').forEach(b=>b.onclick=()=>{const h=H(b.dataset.power);const [n,v]=energy.sort((a,b)=>b[1].units-a[1].units)[0];const amt=Math.min(v.units,500);v.units-=amt;if(v.units<=0)delete CH.inv.res[n];h.power+=amt;h.on=true;h.updated=Date.now();toast(`Added ${amt} power from ${n}.`);markDirty();renderWin()});
  B.querySelectorAll('[data-toggle]').forEach(b=>b.onclick=()=>{const h=H(b.dataset.toggle);h.on=!h.on;h.updated=Date.now();markDirty();renderWin()});
  B.querySelectorAll('[data-redeed]').forEach(b=>b.onclick=()=>{const h=H(b.dataset.redeed);if(h.hopper>=1)return toast('Empty the hopper first.');CH.harvesters=CH.harvesters.filter(x=>x!==h);CH.inv.items.push({id:'i'+Date.now().toString(36),kind:'deed',name:HARV_SIZES[h.size].label+' Harvester Deed',size:h.size,q:250});CH.credits+=Math.floor(h.maint);toast('Harvester redeeded; leftover maintenance refunded.');drawHarvesters();markDirty();renderWin()})}
const harvGroup=new THREE.Group();
function drawHarvesters(){harvGroup.clear();if(!CH||!groundWorld)return;if(!harvGroup.parent)G.ground.add(harvGroup);
  for(const h of CH.harvesters.filter(h=>h.planet===groundWorld.id)){const k=HARV_KIT[h.t]||'kk_mine',proto=kitProtoCache[k];if(!proto)continue;
    const g=new THREE.Group();for(const p of proto.parts){const m=new THREE.Mesh(p.geo,p.mat);m.applyMatrix4(p.m);g.add(m)}const s=(h.size==='heavy'?14:h.size==='medium'?11:8)/Math.max(proto.size.x,proto.size.z);g.scale.setScalar(s);g.position.set(h.x,groundH(groundWorld,h.x,h.z),-h.z);harvGroup.add(g)}}

/* ---- combat and creature harvesting ---- */
const combat={p:null,cd:0,ecd:0};
function npcStats(p){const g=p.g;if(g.maxHp)return;const base=g.kind==='boss'?(g.boss.hp||5000):g.kind==='hostile'?(g.enemy.hp||200):300;g.maxHp=Math.round(base*(.6+g.tier*.25));g.hp=g.maxHp;g.dmg=g.kind==='boss'?60+g.tier*15:g.kind==='hostile'?((g.enemy.damage||12)*1.2):8}

/* ---- combat math bridge (src/combat/math.ts): every hit, crit, dodge, block and miss resolves there ---- */
const OUT_TXT={miss:'misses',dodge:'is dodged by',block:'is blocked by'};
function ggMe(){const st=charStats();return{st,c:{level:st.level||combatLevel(),s:st.cs}}}
function ggHit(g,mult=1,kind){const C=window.GG_COMBAT,{st,c}=ggMe();if(!C||!st.cs){const d=Math.round(st.dmg*mult*(.8+Math.random()*.4));return{dmg:d,outcome:'hit'}}
  const R=C.resolveHit(c,C.npcCombatant(g),{mult,kind:kind||st.cs.kind,flat:st.gun?st.cs.weapon*(GUNS[st.gun]?GUNS[st.gun].mult:1):undefined});ggLastHit=R;window.dispatchEvent(new CustomEvent('gg:hit',{detail:R}));return R}
function ggHitText(who,name,R){if(R.outcome==='miss')return`${who} miss ${name}`;if(R.outcome==='dodge')return`${name} dodges ${who==='You'?'your':who+"'s"} attack`;
  return`${who==='You'?'You':who} ${R.outcome==='crit'?'CRITICALLY hit':'hit'} ${name} for ${R.dmg}${R.outcome==='block'?' (blocked)':''}`}
function ggEnemyHit(g,mult=1){const C=window.GG_COMBAT,{st,c}=ggMe();if(!C||!st.cs){const d=Math.round((g.dmg||10)*mult*(.7+Math.random()*.6)*(600/(600+st.def)));return{dmg:d,outcome:'hit'}}
  const R=C.resolveHit(C.npcCombatant(g),c,{mult});return R}
function ggTakenText(name,R){if(R.outcome==='miss')return`${name} misses you`;if(R.outcome==='dodge')return`You dodge ${name}`;return`${name} ${R.outcome==='crit'?'CRITICALLY hits':'hits'} you for ${R.dmg}${R.outcome==='block'?' (blocked)':''}`}
let ggLastHit=null;
const pct=v=>(v*100).toFixed(1)+'%';
function ggCombatRows(cs){const P={melee:'Melee power',ranged:'Ranged power',spell:'Spell power'}[cs.kind];
  return statRow(P,Math.round(window.GG_COMBAT.powerFor(cs,cs.kind)))+statRow('Healing power',Math.round(cs.healPower))+statRow('Resist',Math.round(cs.resist))+statRow('Critical',pct(cs.crit))+statRow('Crit damage',pct(cs.critDmg))+statRow('Dodge',pct(cs.dodge))+statRow('Block',pct(cs.block))+statRow('Attack speed','+'+pct(cs.haste))+statRow('Cooldowns','-'+pct(cs.cdr))
    +`<details class="cp-attrs"><summary>Attributes</summary>${Object.entries(cs.attrs).map(([k,v])=>statRow(k,v.toFixed(1),'#9fe4ff')).join('')}</details>`+(cs.perks.length?`<small>Perks: ${esc(cs.perks.join(', '))}</small>`:'')}
function startAttack(p){if(play.mount)dismount(true);if(groundMode!=='play')return toast('Switch to Play to fight.');npcStats(p);if(p.dead)return;combat.p=p;combat.cd=0;renderHud()}
function tickCombat(dt){const p=combat.p;if(!p){if(hunt.t>0){hunt.t-=dt;return}if(CH&&CH.hp!=null){const st=charStats();CH.hp=Math.min(st.maxHp,CH.hp+st.maxHp*.02*dt)}return}
  const st=charStats(),d=Math.hypot(p.x-play.x,p.z-play.z);const cre=[...npcToons.entries()].find(([i])=>groundWorld.placements[i]===p);if(cre){const u=cre[1].userData;u.target={x:play.x+(p.x-play.x)/Math.max(d,1)*2,z:play.z+(p.z-play.z)/Math.max(d,1)*2};u.combat=true}
  combat.cd-=dt;combat.ecd-=dt;if(d>60){combat.p=null;floatMsg('Target out of range');return renderHud()}
  if(d<=st.range+2&&combat.cd<=0){combat.cd=gunCd()/(1+((charStats().cs||{}).haste||0));const R=ggHit(p.g,mmDmgMul()),dmg=R.dmg;p.g.hp-=dmg;floatMsg(ggHitText('You',p.g.name,R));if(play.model){play.model.userData.swing=.4;toonOneShot(play.model,'attack')}if(cre&&cre[1].userData.toonObj)toonOneShot(cre[1].userData.toonObj,'hit')}
  if(d<=(p.g.kind==='hostile'&&/beasts|reptiles|spiders|dragons/.test(p.g.cat)?4:14)&&combat.ecd<=0&&p.g.kind!=='friendly'&&!p.g.dummy){combat.ecd=2;const ER=ggEnemyHit(p.g,enemyMul(p)/mmDefMul()),dm=ER.dmg;CH.hp-=dm;floatMsg(ggTakenText(p.g.name,ER));if(cre&&cre[1].userData.toonObj)toonOneShot(cre[1].userData.toonObj,'attack');if(play.model){const heavy=dm>charStats().maxHp*.12;if(heavy||Math.random()<.5)setTimeout(()=>play.model&&toonOneShot(play.model,heavy?'stagger':'hit'),250)}}
  if(p.g.hp<=0)killNpc(p);if(CH.hp<=0)incapacitate();renderHud()}
function killNpc(p){mmOnKill(p);p.dead=true;combat.p=null;const g=p.g,xp=Math.round(40*g.tier*(g.kind==='boss'?5:1));gainXP('combat',xp,'defeated '+g.name);gainXP(CLASS_WEAPON_XP[CH.cls]||'unarmed',Math.round(xp*.8),'');const cr=Math.round((20+g.tier*25)*(g.kind==='boss'?8:1)*(.6+Math.random()*.8));CH.credits+=cr;floatMsg(`Looted ${cr} credits`);
  const i=groundWorld.placements.indexOf(p),obj=npcToons.get(i);if(obj){toonGroup.remove(obj);npcToons.delete(i)}
  setTimeout(()=>{p.dead=false;g.hp=g.maxHp},300000);p.corpse={t:Date.now()};if(selPlacement===p)renderInfo();markDirty()}
// SWG creature harvesting: choose meat, hide or bone; each pulls a matching creature resource from this planet.
const CORPSE={meat:/meat/i,hide:/hide|leather|skin/i,bone:/bone|horn/i};
function harvestCorpse(p,kind='meat'){const all=planetRes().filter(r=>r.t===-1);if(!all.length||!p.corpse)return;const pool=all.filter(r=>CORPSE[kind].test(r.c)||r.cl.some(c=>CORPSE[kind].test(c)));const list=pool.length?pool:all;
  const m=skillMods(CH),r=list[strHash(p.t+kind)%list.length],u=Math.round((8+p.g.tier*6)*(1+(m.hunting||0)/40)*(.8+Math.random()*.4));addRes(r,u);
  p.corpse=null;gainXP(kind==='hide'?'trapping':'scouting',30+p.g.tier*10,'creature harvesting');toast(`Harvested ${u} units of ${r.n} (${r.c}).`);renderInfo()}
function incapacitate(){combat.p=null;let best=null,bd=Infinity;for(const q of groundWorld.pois)if(q.cat==='city'){const d=Math.hypot(q.x-play.x,q.z-play.z);if(d<bd){bd=d;best=q}}
  CH.hp=charStats().maxHp*.6;const home=structsHere().find(s=>s.type==='house');if(home){play.x=home.x+9;play.z=home.z;best={name:'your house'}}else if(best){play.x=best.x+5;play.z=best.z}toast(`You were incapacitated and cloned at ${best?best.name:'the nearest cloning facility'}.`);markDirty()}
function npcActions(box,p){const acts=box.querySelector('.acts');if(!acts||groundMode!=='play'||!CH)return;const mk=(t,fn,pri)=>{const b=document.createElement('button');b.className='btn'+(pri?' primary':'');b.textContent=t;b.onclick=fn;acts.append(b)};
  if(p.trainer){mk(`Train ${PROF[p.trainer].name}`,()=>{skillProf=p.trainer;SKILL_SEL=null;openWin('skills')},true);return}if(!p.g)return;
  if(p.dead&&p.corpse&&p.g.kind!=='friendly'){mk('Harvest meat',()=>harvestCorpse(p,'meat'),true);mk('Hide',()=>harvestCorpse(p,'hide'));mk('Bone',()=>harvestCorpse(p,'bone'))}
  else if(!p.dead&&p.g.kind!=='friendly'){mk(combat.p===p?'Fighting…':'Attack',()=>startAttack(p),true);if(HUNT.test(p.g.cat||'')&&(hasBox('outdoors_creaturehandler_novice')||hasBox('outdoors_scout_tools_01')))mk('Tame',()=>tameCreature(p))}
  else if(p.g.kind==='friendly')mk('Perform',()=>perform(),false);if(p.dead)acts.insertAdjacentHTML('afterbegin','<small style="color:var(--muted)">Defeated</small>')}
let performT=0,performN=0;const PERF=['dance','music','entertainer'];function perform(){performT=10;if(play.model)toonOneShot(play.model,'dance');toast(['Dancing','Playing music','Performing a healing routine'][performN%3]+' for the crowd…')}
function tickPerform(dt){if(performT<=0)return;performT-=dt;if(play.model&&!play.model.userData.mixer)play.model.rotation.y+=dt*3;if(performT<=0){const near=[...npcToons.keys()].filter(i=>{const p=groundWorld.placements[i];return p.g&&p.g.kind==='friendly'&&Math.hypot(p.x-play.x,p.z-play.z)<25}).length;gainXP(PERF[performN++%3],(40+near*25)*(structsHere().some(s=>s.type==='cantina'&&Math.hypot(s.x-play.x,s.z-play.z)<30)?2:1),`${near} watched`);mmOnPerform()}}

/* ---- exploration ---- */
function tickExplore(){for(const q of groundWorld.pois){const key=groundWorld.id+':'+q.id;if(CH.discovered.includes(key))continue;if(Math.hypot(q.x-play.x,q.z-play.z)<q.r){CH.discovered.push(key);gainXP(q.cat==='city'?'scouting':'wilderness',q.cat==='city'?50:120,'discovered '+q.name);markDirty()}}}

/* ---- galactic glow whales ---- */
const whaleMat=()=>new THREE.ShaderMaterial({uniforms:{t:{value:0},base:{value:col('#10264a')},glow:{value:col('#7ff6ff')},spot:{value:col('#c58bff')}},
  vertexShader:`uniform float t;varying vec3 vN;varying vec3 vV;varying vec2 vUv;varying float vZ;void main(){vUv=uv;vec3 p=position;vZ=p.z;p.x+=sin(p.z*5.0-t*2.2)*0.035*(0.6-p.z);
    vec4 mv=modelViewMatrix*vec4(p,1.0);vN=normalize(normalMatrix*normal);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}`,
  fragmentShader:`uniform float t;uniform vec3 base,glow,spot;varying vec3 vN;varying vec3 vV;varying vec2 vUv;varying float vZ;void main(){float fr=pow(1.0-max(dot(vN,vV),0.0),2.2);
    float bands=smoothstep(0.82,1.0,sin(vZ*42.0-t*3.0))*smoothstep(0.1,0.45,abs(vUv.x-0.5)+0.2);float dots=step(0.93,fract(sin(dot(floor(vUv*vec2(26.0,60.0)),vec2(12.9898,78.233)))*43758.5453));
    vec3 c=base*0.7+glow*(fr*1.4+bands*0.55)+spot*dots*(0.6+0.4*sin(t*2.0+vZ*20.0));gl_FragColor=vec4(c,1.0);}`});
function makeWhale(){const g=new THREE.Group(),mat=whaleMat();
  const prof=[[0,-.5],[.06,-.47],[.13,-.38],[.18,-.22],[.2,-.05],[.19,.12],[.15,.28],[.1,.4],[.05,.47],[0,.5]].map(([r,y])=>new THREE.Vector2(r,y));
  const body=new THREE.Mesh(new THREE.LatheGeometry(prof,28),mat);body.rotation.x=Math.PI/2;body.scale.set(1,1,.75);g.add(body);
  const fl=new THREE.SphereGeometry(1,16,8);for(const s of [-1,1]){const f=new THREE.Mesh(fl,mat);f.scale.set(.2,.012,.07);f.position.set(s*.13,-.02,-.5);f.rotation.y=s*.5;g.add(f);
    const p=new THREE.Mesh(fl,mat);p.scale.set(.17,.012,.06);p.position.set(s*.2,-.06,.12);p.rotation.set(0,-s*.6,s*.35);g.add(p)}
  const halo=glowSprite(0x6ff0ff,2.4,.35);g.add(halo);
  const n=60,tp=new Float32Array(n*3),tg=new THREE.BufferGeometry();tg.setAttribute('position',new THREE.BufferAttribute(tp,3));const trail=new THREE.Points(tg,new THREE.PointsMaterial({size:.08,color:0x9ffcff,transparent:true,opacity:.7,blending:THREE.AdditiveBlending,depthWrite:false}));
  trail.frustumCulled=false;g.userData={mat,trail,hist:[],n};return g}
function whaleTick(w,dt,worldParent){w.userData.mat.uniforms.t.value+=dt;const u=w.userData;if(!u.trail.parent&&worldParent)worldParent.add(u.trail);
  const p=w.getWorldPosition(new V3());u.hist.unshift(p);if(u.hist.length>u.n)u.hist.pop();const a=u.trail.geometry.attributes.position;
  for(let i=0;i<u.n;i++){const q=u.hist[Math.min(i,u.hist.length-1)];a.setXYZ(i,q.x+(Math.random()-.5)*w.scale.x*.05,q.y+(Math.random()-.5)*w.scale.x*.05,q.z+(Math.random()-.5)*w.scale.x*.05)}a.needsUpdate=true}
const ambientWhales=[];
function spawnGalaxyWhales(){if(ambientWhales.length)return;for(let i=0;i<4;i++){const w=makeWhale();w.scale.setScalar(26+i*6);G.galaxy.add(w);ambientWhales.push({w,ph:i*1.7,r:120+i*55,h:(i-1.5)*18,sp:.05+i*.012})}}
let rideWhale=null,systemWhale=null,starportWhales=[];
function tickWhales(dt){const t=performance.now()/1000;
  if(level==='galaxy'&&!rideWhale){for(const a of ambientWhales){const ang=t*a.sp+a.ph,pos=new V3(Math.cos(ang)*a.r,a.h+Math.sin(ang*2)*10,Math.sin(ang)*a.r*.8);const nx=new V3(Math.cos(ang+.05)*a.r,a.h+Math.sin((ang+.05)*2)*10,Math.sin(ang+.05)*a.r*.8);
    a.w.position.copy(G.galaxy.worldToLocal(pos.clone()));a.w.lookAt(G.galaxy.localToWorld(G.galaxy.worldToLocal(nx.clone())));whaleTick(a.w,dt,G.galaxy)}}
  if(level==='system'){if(!systemWhale||systemWhale.parent!==G.system){systemWhale=makeWhale();systemWhale.scale.setScalar(5);G.system.add(systemWhale)}const ang=t*.12;systemWhale.position.set(Math.cos(ang)*44,6+Math.sin(ang*3)*2,Math.sin(ang)*44);
    systemWhale.lookAt(Math.cos(ang+.05)*44,6+Math.sin((ang+.05)*3)*2,Math.sin(ang+.05)*44);whaleTick(systemWhale,dt,G.system)}
  if(level==='ground'){for(const s of starportWhales){const ang=t*.08+s.ph;s.w.position.set(s.x+Math.cos(ang)*60,s.y+90+Math.sin(ang*2)*6,-s.z+Math.sin(ang)*60);s.w.lookAt(s.x+Math.cos(ang+.05)*60,s.y+90,-s.z+Math.sin(ang+.05)*60);whaleTick(s.w,dt,G.ground)}}
  if(rideWhale)whaleTick(rideWhale,dt,rideWhale.parent)}
function placeStarportWhales(w){buildPadFx(w);buildTerminals(w);starportWhales=[];w.placements.forEach((p,i)=>{if(p.k==='travel'&&p.t.startsWith('Starport')){const wh=makeWhale();wh.scale.setScalar(38);G.ground.add(wh);starportWhales.push({w:wh,x:p.x,z:p.z,y:groundH(w,p.x,p.z),ph:i})}})}

/* ---- travel: shuttles within a planet, glow whales between planets ---- */
const travelPoints=w=>w.placements.filter(p=>p.k==='travel').map(p=>({name:p.t.replace(/^(Starport|Shuttleport): /,''),star:p.t.startsWith('Starport'),x:p.x,z:p.z,world:w}));
function nearTravel(){if(!groundWorld)return null;return travelPoints(groundWorld).find(t=>Math.hypot(t.x-play.x,t.z-play.z)<(t.star?60:35))||null}
function winTravel(B){$('#gwTitle').textContent='Travel';const here=nearTravel();if(!here){B.innerHTML='<p class="gw-note">Walk onto a shuttleport or starport pad first.</p>';return}
  const local=travelPoints(groundWorld).filter(t=>t!==here&&t.name!==here.name);
  const far=here.star?WORLDS.filter(w=>w!==groundWorld).map(w=>{const sp=travelPoints(w).filter(t=>t.star);return sp.length?sp:[{name:(w.pois.find(q=>q.cat==='city')||w.pois[0]||{name:'Landing zone'}).name+' landing',star:true,x:(w.pois[0]||{x:0}).x,z:(w.pois[0]||{z:0}).z,world:w}]}).flat():[];
  B.innerHTML=`<p class="gw-note">You're at ${esc(here.name)}. Shuttles hop across ${esc(groundWorld.name)}; from a starport, a galactic glow whale carries you to another world.</p>
   <h3>Shuttles · 100 credits</h3><ul class="gw-list">${local.map((t,i)=>`<li><span><b>${esc(t.name)}</b> <small>${t.star?'Starport':'Shuttleport'} · ${fmt(Math.hypot(t.x-play.x,t.z-play.z))} m</small></span><button class="btn mini" data-lt="${i}">Fly</button></li>`).join('')||'<li>No other terminals on this planet.</li>'}</ul>
   ${here.star?`<h3>Glow whale passage · 600 credits</h3><ul class="gw-list">${far.map((t,i)=>`<li><span><b>${esc(t.world.name)}</b> <small>${esc(t.name)}</small></span><button class="btn mini primary" data-ft="${i}">Ride</button></li>`).join('')}</ul>`:'<p class="gw-note">Interplanetary passage leaves from starports.</p>'}`;
  B.querySelectorAll('[data-lt]').forEach(b=>b.onclick=()=>{if(CH.credits<100)return toast('Not enough credits.');CH.credits-=100;closeWin();shuttleTo(local[+b.dataset.lt])});
  B.querySelectorAll('[data-ft]').forEach(b=>b.onclick=()=>{if(CH.credits<600)return toast('Not enough credits.');CH.credits-=600;closeWin();whaleTo(far[+b.dataset.ft])})}
async function shuttleTo(t){busy=true;await fade(1);play.x=t.x+6;play.z=t.z+6;CH.pos={x:play.x,z:play.z};updatePlay(0);markDirty();saveNow();await fade(0);busy=false;toast(`Arrived at ${t.name}.`)}
let pendingSpawn=null;
async function whaleTo(t){saveNow();const from=curWorld,to=t.world;busy=true;combat.p=null;await fade(1);if(groundMode==='play')exitPlay();
  setLevel('galaxy');rideWhale=makeWhale();rideWhale.scale.setScalar(22);G.galaxy.add(rideWhale);
  const a=from.gpos.clone(),b=to.gpos.clone(),mid=a.clone().lerp(b,.5).add(new V3(0,70,0)),curve=new THREE.QuadraticBezierCurve3(a,mid,b);
  await fade(0);const T=reduce?.1:6.5,t0=performance.now();await new Promise(res=>{const step=()=>{const k=Math.min(1,(performance.now()-t0)/1000/T),e=ease(k),p=curve.getPoint(e),q=curve.getPoint(Math.min(1,e+.01));
      rideWhale.position.copy(G.galaxy.worldToLocal(p.clone()));rideWhale.lookAt(q);const back=p.clone().sub(q).normalize().multiplyScalar(70).add(new V3(0,22,0));cam.position.copy(p.clone().add(back));cam.lookAt(q);
      if(k<1)requestAnimationFrame(step);else res()};step()});
  await fade(1);G.galaxy.remove(rideWhale);if(rideWhale.userData.trail.parent)rideWhale.userData.trail.parent.remove(rideWhale.userData.trail);rideWhale=null;busy=false;
  curWorld=to;CH.planet=to.id;CH.pos={x:t.x+8,z:t.z+8};pendingSpawn={x:t.x+8,z:t.z+8};markDirty();
  const poi=nearestPoi(to,t.x,t.z);ctl.target.copy(to.gpos);ctl.dist=40;applyOrbit();await fade(0);pendingPlay=true;await goPlanet(to,poi);while(busy)await sleep(60);goGround(poi)}
const nearestPoi=(w,x,z)=>w.pois.reduce((a,q)=>!a||Math.hypot(q.x-x,q.z-z)<Math.hypot(a.x-x,a.z-z)?q:a,null);

/* ---- menu, settings, characters ---- */
const QUALITY={low:{pr:1,npc:8},medium:{pr:1.5,npc:14},high:{pr:2,npc:18}};let quality='high';try{quality=localStorage.getItem('swgatlas.quality')||(devicePixelRatio>1.5?'medium':'high')}catch(e){}
function applyQuality(){const q=QUALITY[quality]||QUALITY.high;renderer.setPixelRatio(Math.min(devicePixelRatio,q.pr));MAX_CREATURES=q.npc;resize()}
var MAX_CREATURES=18;
function winMenu(B){$('#gwTitle').textContent='Menu';B.innerHTML=`<div class="gw-menu">
  ${CH?`<button class="btn" id="mSave">Save now</button>`:''}<button class="btn" id="mChars">Characters</button>${CH&&level==='ground'?'<button class="btn" id="mGal">Return to galaxy map</button>':''}
  <label class="gw-set" for="mQual">Graphics quality <select id="mQual">${Object.keys(QUALITY).map(k=>`<option ${k===quality?'selected':''}>${k}</option>`).join('')}</select></label>
  <h3>Controls</h3><ul class="gw-keys"><li><kbd>W</kbd><kbd>S</kbd> walk · <kbd>A</kbd><kbd>D</kbd> turn · <kbd>Shift</kbd> run · drag to look</li><li><kbd>U</kbd> survey · <kbd>J</kbd> sample · <kbd>H</kbd> place harvester</li>
   <li><kbd>I</kbd> inventory · <kbd>K</kbd> skills · <kbd>C</kbd> craft · <kbd>T</kbd> travel at a pad</li><li>Click a creature, then Attack · <kbd>Tab</kbd> nearest enemy · <kbd>Esc</kbd> close / back</li></ul>
  <p class="gw-note">Saves ${Store.mode==='cloud'?'go to your private space on this artifact and follow you to other devices':'stay in this browser'}. The game autosaves every 30 seconds and when you travel.</p></div>`;
  $('#mSave')&&($('#mSave').onclick=async()=>{await saveNow();toast('Saved.')});$('#mChars').onclick=()=>openWin('chars');$('#mGal')&&($('#mGal').onclick=()=>{closeWin();saveNow();exitPlay();goGalaxy()});
  $('#mQual').onchange=e=>{quality=e.target.value;try{localStorage.setItem('swgatlas.quality',quality)}catch(err){}applyQuality()}}
let charList=[],confirmDel=null;
async function winChars(B){$('#gwTitle').textContent='Characters';B.innerHTML='<p class="gw-note">Loading characters…</p>';await storeReady;charList=await Store.list();if(winKind!=='chars')return;
  B.innerHTML=`<p class="gw-note">${Store.mode==='cloud'?'Characters are saved to your account on this artifact.':'Characters are saved in this browser.'} Up to 8 slots.</p>
   <div class="gw-chars">${charList.sort((a,b)=>(b.played||0)-(a.played||0)).map(c=>`<div class="gw-char" style="--c:${RACE[c.race]?RACE[c.race].color:'#888'}"><b>${esc(c.name)}</b><small>${esc((RACE[c.race]||{}).name)} ${esc((CLASS[c.cls]||{}).name)} · ${esc(PROF[c.prof]?PROF[c.prof].name:'')}</small>
     <small>${esc((WORLDS.find(w=>w.id===c.planet)||{name:c.planet}).name)} · ${(c.credits||0).toLocaleString()} cr · ${(c.skills||[]).length} skills</small>
     <div class="acts"><button class="btn primary" data-play="${c.id}">Play</button>${confirmDel===c.id?`<button class="btn danger" data-delok="${c.id}">Delete forever</button><button class="btn" data-delno>Keep</button>`:`<button class="btn" data-del="${c.id}">Delete</button>`}</div></div>`).join('')}
   ${charList.length<8?'<button class="gw-char new" id="mNew"><b>+ Create character</b><small>Pick race, class, starting profession and city</small></button>':''}</div>`;
  B.querySelectorAll('[data-play]').forEach(b=>b.onclick=()=>openPlanetSelect(migrate(charList.find(c=>c.id===b.dataset.play))));
  B.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{confirmDel=b.dataset.del;renderWin()});B.querySelectorAll('[data-delno]').forEach(b=>b.onclick=()=>{confirmDel=null;renderWin()});
  B.querySelectorAll('[data-delok]').forEach(b=>b.onclick=async()=>{await Store.del(b.dataset.delok);confirmDel=null;if(CH&&CH.id===b.dataset.delok)CH=null;renderWin()});
  $('#mNew')&&($('#mNew').onclick=()=>{closeWin();creating=true;openCreator()})}
let creating=false;
async function playCharacter(c){
  // leave play first so the character being switched away from is saved with its own position, not the new one's
  if(level==='ground'&&groundMode==='play')exitPlay();
  if(CH&&c&&c.id===CH.id)c=CH;  // same character: keep the position exitPlay just saved, not an older list copy
  CH=migrate(c);CH.played=Date.now();syncLook();closeWin();const w=WORLDS.find(x=>x.id===c.planet)||WORLDS[0];const poi=nearestPoi(w,c.pos.x,c.pos.z);
  pendingSpawn={x:c.pos.x,z:c.pos.z};if(level==='ground'&&groundWorld===w){pendingPlay=false;enterPlay();return}
  pendingPlay=true;if(level!=='planet'||curWorld!==w){while(busy)await sleep(60);await goPlanet(w,poi)}while(busy)await sleep(60);goGround(poi)}
async function saveNow(){if(!CH)return;if(groundMode==='play'&&groundWorld){CH.pos={x:play.x,z:play.z};CH.planet=groundWorld.id}dirty=false;await Store.save(CH)}
setInterval(()=>{if(dirty)saveNow()},30000);addEventListener('pagehide',()=>{if(dirty)saveNow()});

/* ---- per-frame game tick and keys ---- */
let gtT=0;function gameTick(dt){mmFrame(dt);tickWhales(dt);if(waterMat)waterMat.uniforms.t.value+=dt;if(!CH||level!=='ground'||groundMode!=='play'||!groundWorld)return;tickCombat(dt);tickSample(dt);tickPerform(dt);gtT-=dt;
  if(gtT<=0){gtT=1;tickAllHarvesters();tickExplore();const tp=nearTravel();$('#ghPrompt').hidden=!tp;if(tp)$('#ghPrompt').textContent=`${tp.star?'Starport':'Shuttleport'}: ${tp.name} · press T to travel`;renderHud()}}
addEventListener('keydown',e=>{if(e.target.tagName==='INPUT'||e.target.tagName==='SELECT')return;const k=e.key.toLowerCase();
  if(k==='escape'&&!gw.hidden){closeWin();e.stopImmediatePropagation();return}
  if(level!=='ground'||groundMode!=='play'||!CH){if(k==='m')openWin('menu');return}
  const map={u:'survey',j:'sample',h:'harvester',i:'inventory',k:'skills',c:'craft',t:'travel',m:'menu',l:'codex',g:'navigate'};if(map[k]&&!(k==='m'&&e.shiftKey)){if(!gw.hidden&&winKind===(map[k]==='harvester'?'harvesters':map[k]))closeWin();else doAction(map[k]);e.preventDefault()}
  if(k==='tab'){e.preventDefault();let best=null,bd=40;for(const [i] of npcToons){const p=groundWorld.placements[i];if(!p.g||p.g.kind==='friendly'||p.dead)continue;const d=Math.hypot(p.x-play.x,p.z-play.z);if(d<bd){bd=d;best=i}}if(best!=null){selectPlacement(best);startAttack(groundWorld.placements[best])}}},true);



/* ================= Vehicles and creatures: dragons, mounts, docked whale ships, travel portals, wilderness mobs ================= */
/* ---- procedural dragon (no dragon model exists in the asset library, so it is built here, like the glow whales) ---- */
const DRAGON_COLORS={ember:'#c8452c',frost:'#4f9fe0',jade:'#3a9e62',void:'#7448c8',gold:'#d4a032'};
function makeDragon(hex='#c8452c'){const g=new THREE.Group(),base=col(hex),dark=base.clone().multiplyScalar(.55),belly=base.clone().lerp(col('#f2dfb0'),.55),horn=col('#efe6d2');
  const M=(c,o={})=>new THREE.MeshLambertMaterial({color:c,...o}),mb=M(base),md=M(dark),mbl=M(belly),mh=M(horn),eye=new THREE.MeshBasicMaterial({color:0xffd04a});
  const sph=(r,m,sx,sy,sz)=>{const s=new THREE.Mesh(new THREE.SphereGeometry(r,14,10),m);s.scale.set(sx,sy,sz);return s};
  const body=sph(1,mb,1.15,.95,2.1);body.position.set(0,2.3,0);g.add(body);const bel=sph(1,mbl,1,.75,1.85);bel.position.set(0,2.0,.1);g.add(bel);
  // spine ridges
  for(let i=0;i<7;i++){const r=new THREE.Mesh(new THREE.ConeGeometry(.16,.5,5),md);r.position.set(0,3.2-Math.abs(i-2)*.06,1.4-i*.55);r.rotation.x=-.4;g.add(r)}
  // neck chain and head
  const neck=new THREE.Group();neck.position.set(0,2.8,1.7);g.add(neck);let prev=neck;const necks=[];
  for(let i=0;i<4;i++){const seg=new THREE.Group();seg.position.set(0,i?.5:0,i?.42:0);seg.rotation.x=-.28;prev.add(seg);const s=sph(.5-i*.05,mb,1,1,1.3);seg.add(s);prev=seg;necks.push(seg)}
  const head=new THREE.Group();head.position.set(0,.45,.45);head.rotation.x=.75;prev.add(head);
  const skull=sph(.55,mb,1,.8,1.2);head.add(skull);const snout=new THREE.Mesh(new THREE.ConeGeometry(.42,1.3,8),mb);snout.rotation.x=Math.PI/2;snout.position.set(0,-.08,.95);head.add(snout);
  const jaw=new THREE.Mesh(new THREE.ConeGeometry(.3,1.0,7),mbl);jaw.rotation.x=Math.PI/2;jaw.position.set(0,-.32,.8);head.add(jaw);
  for(const sx of [-1,1]){const h=new THREE.Mesh(new THREE.ConeGeometry(.12,.9,6),mh);h.position.set(.28*sx,.35,-.35);h.rotation.set(-1.1,0,-.35*sx);head.add(h);
    const e=new THREE.Mesh(new THREE.SphereGeometry(.08,8,6),eye);e.position.set(.3*sx,.12,.35);head.add(e)}
  // tail chain
  const tail=[];prev=g;let tz=-2.0,ty=2.1;for(let i=0;i<7;i++){const seg=new THREE.Group();if(i===0)seg.position.set(0,ty,tz);else seg.position.set(0,-.06,-.72);prev.add(seg);const s=sph(.48*(1-i*.11),mb,1,.9,1.5);seg.add(s);prev=seg;tail.push(seg)}
  const fin=new THREE.Mesh(new THREE.ConeGeometry(.35,.9,4),md);fin.rotation.x=-Math.PI/2;fin.position.z=-.6;prev.add(fin);
  // legs
  for(const [x,z] of [[.75,1.1],[-.75,1.1],[.8,-1.1],[-.8,-1.1]]){const l=new THREE.Mesh(new THREE.CylinderGeometry(.24,.18,1.5,7),mb);l.position.set(x,1.0,z);g.add(l);const f=sph(.28,md,1,.5,1.4);f.position.set(x,.22,z+.15);g.add(f)}
  // wings: an arm bone and a membrane fan, pivoting at the shoulder
  const wings=[];const memGeo=new THREE.BufferGeometry();const P=[0,0,0, 4.8,.4,.3, 4.3,0,-1.6, 0,0,0, 4.3,0,-1.6, 3.0,0,-3.0, 0,0,0, 3.0,0,-3.0, 1.4,0,-3.2, 0,0,0, 1.4,0,-3.2, .2,0,-2.0];
  memGeo.setAttribute('position',new THREE.Float32BufferAttribute(P,3));memGeo.computeVertexNormals();const memMat=new THREE.MeshLambertMaterial({color:dark,side:THREE.DoubleSide,emissive:dark.clone().multiplyScalar(.25)});
  for(const sx of [1,-1]){const w=new THREE.Group();w.position.set(.85*sx,2.95,.6);w.scale.x=sx;g.add(w);const mem=new THREE.Mesh(memGeo,memMat);w.add(mem);
    const arm=new THREE.Mesh(new THREE.CylinderGeometry(.09,.13,4.9,6),mb);arm.rotation.z=Math.PI/2-.08;arm.position.set(2.4,.2,.15);w.add(arm);
    for(const [x,z] of [[4.3,-1.6],[3.0,-3.0],[1.4,-3.2]]){const f=new THREE.Mesh(new THREE.CylinderGeometry(.04,.07,Math.hypot(4.8-x,.3-z),5),md);f.position.set((4.8+x)/2,.1,(.3+z)/2);f.rotation.set(0,Math.atan2(4.8-x,.3-z),Math.PI/2);f.rotation.order='YXZ';w.add(f)}
    wings.push({w,sx})}
  g.userData.dragon={wings,tail,necks,head,t:Math.random()*10,seat:3.35,seatZ:.35};return g}
function dragonTick(g,dt,moving,flying){const d=g.userData.dragon;if(!d)return;d.t+=dt*(flying?2.6:moving?1.6:1);const t=d.t;
  const flap=flying?Math.sin(t*3.2)*.75+.15:moving?Math.sin(t*2)*.18-.55:Math.sin(t*.9)*.06-.8;
  for(const {w} of d.wings){w.rotation.z=flap;w.rotation.y=flying?0:-.35}
  d.tail.forEach((s,i)=>{s.rotation.y=Math.sin(t*1.6-i*.6)*.18*(flying?.5:1);s.rotation.x=flying?.04:-.02});d.necks.forEach((s,i)=>{s.rotation.y=Math.sin(t*.7-i*.4)*.06});d.head.rotation.x=.75+Math.sin(t*.9)*.05}

/* ---- docked whale ships and travel portals on every landing pad ---- */
let padFx=[];
const portalMat=()=>new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,uniforms:{t:{value:0},c1:{value:col('#6ff0ff')},c2:{value:col('#c58bff')}},
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:`uniform float t;uniform vec3 c1,c2;varying vec2 vUv;void main(){vec2 p=vUv-.5;float r=length(p)*2.,a=atan(p.y,p.x);
    float sw=sin(a*5.+r*14.-t*3.)*.5+.5,core=smoothstep(1.,.0,r);vec3 c=mix(c2,c1,sw)*core*(.55+.45*sin(t*2.+r*8.));gl_FragColor=vec4(c,core*.85*smoothstep(1.,.85,r));}`});
function makePortal(R){const g=new THREE.Group(),mat=portalMat();const ring=new THREE.Mesh(new THREE.TorusGeometry(R,.32,10,48),new THREE.MeshBasicMaterial({color:0x8ff6ff}));g.add(ring);
  const disc=new THREE.Mesh(new THREE.CircleGeometry(R,48),mat);g.add(disc);for(let i=0;i<3;i++){const s=new THREE.Mesh(new THREE.BoxGeometry(.5,1.6,.5),new THREE.MeshLambertMaterial({color:0x2a3a4c,emissive:0x1a6a80}));const a=i/3*TAU+Math.PI/2;s.position.set(Math.cos(a)*(R+.6),Math.sin(a)*(R+.6),0);s.rotation.z=a;g.add(s)}
  const col_=new THREE.Mesh(new THREE.CylinderGeometry(R*.9,R*.9,40,24,1,true),new THREE.MeshBasicMaterial({color:0x6ff0ff,transparent:true,opacity:.07,side:THREE.DoubleSide,depthWrite:false}));col_.rotation.x=Math.PI/2;col_.position.z=0;
  g.userData={mat,ring,R};return g}
function buildPadFx(w){for(const f of padFx){G.ground.remove(f.whale);G.ground.remove(f.portal)}padFx=[];
  w.placements.forEach((p,i)=>{if(p.k!=='travel')return;const star=p.t.startsWith('Starport'),gy=groundH(w,p.x,p.z),R=star?5.5:3.8;
    const portal=makePortal(R);portal.position.set(p.x,gy+R+.4,-p.z);portal.rotation.y=(strHash(p.t)%628)/100;G.ground.add(portal);
    const whale=makeWhale();whale.scale.setScalar(star?16:10);G.ground.add(whale);padFx.push({p,portal,whale,gy,star,R,ph:i,x:p.x,z:p.z,off:star?18:12})})}
let portalCd=0;
function tickPadFx(dt){if(level!=='ground'||!padFx.length)return;const t=now();for(const f of padFx){f.portal.userData.mat.uniforms.t.value=t;f.portal.userData.ring.rotation.z=t*.4;
    const a=f.portal.rotation.y,dx=Math.cos(a)*f.off,dz=Math.sin(a)*f.off,hy=f.gy+(f.star?14:10)+Math.sin(t*.6+f.ph)*1.2;f.whale.position.set(f.x+dx,hy,-(f.z+dz));
    f.whale.lookAt(f.x+dx+Math.cos(a+Math.PI/2)*10,hy+Math.sin(t*.6+f.ph)*.4,-(f.z+dz+Math.sin(a+Math.PI/2)*10));whaleTick(f.whale,dt,G.ground)}
  portalCd-=dt;if(groundMode!=='play'||!CH||portalCd>0||!gw.hidden)return;const f=padFx.find(f=>Math.hypot(f.x-play.x,f.z-play.z)<f.R+1.2&&(play.alt||0)<3);
  if(f){portalCd=6;mmLog(`You step into the ${f.star?'starport':'shuttleport'} portal.`,'sys');openWin('travel')}}

/* ---- mounts and vehicles ---- */
const MOUNTS={horse:{name:'Warhorse',k:'mount_horse',speed:2.1,cost:0,scale:1.15},cart:{name:'Horse Cart',cart:true,speed:1.6,cost:1800},wolf:{name:'Dire Wolf',k:'mount_wolf',speed:2.35,cost:2500,scale:1.35},ram:{name:'Dwarven War Ram',k:'mount_dwarf',speed:2.0,cost:2500,scale:1.25},
  bone:{name:'Bone Steed',k:'mount_undead',speed:2.35,cost:4000,scale:1.15},
  ember:{name:'Ember Dragon',dragon:'ember',speed:3.2,fly:true,cost:25000},frost:{name:'Frost Dragon',dragon:'frost',speed:3.2,fly:true,cost:25000},jade:{name:'Jade Dragon',dragon:'jade',speed:3.2,fly:true,cost:25000},
  void:{name:'Void Dragon',dragon:'void',speed:3.4,fly:true,cost:40000},gold:{name:'Gold Dragon',dragon:'gold',speed:3.6,fly:true,cost:60000}};
function makeMountObj(id){const M=MOUNTS[id];if(!M)return null;let obj;if(M.cart)return makeCart();if(M.dragon){obj=makeDragon(DRAGON_COLORS[M.dragon]);obj.userData.seat=obj.userData.dragon.seat;obj.userData.seatZ=obj.userData.dragon.seatZ;return obj}
  const g=kitSync(M.k);if(!g)return null;const m=THREE.SkeletonUtils.clone(g.scene);m.scale.setScalar(M.scale);const box=new THREE.Box3().setFromObject(m);obj=new THREE.Group();obj.add(m);obj.userData.seat=Math.max(.9,box.max.y*.72);obj.userData.seatZ=0;
  if(g.animations&&g.animations.length){const mixer=new THREE.AnimationMixer(m),find=re=>g.animations.find(c=>re.test(c.name));const run=find(/run|gallop|move|walk/i),idle=find(/idle/i)||g.animations[0];
    obj.userData.mx={mixer,run:run&&mixer.clipAction(run),idle:mixer.clipAction(idle),cur:null};obj.userData.mx.idle.play();obj.userData.mx.cur=obj.userData.mx.idle}obj.userData.gait=gaitRig(m);obj.userData.gaitM=m;obj.userData.gaitH=box.max.y;return obj}
function animateMount(obj,dt,moving,flying){if(!obj)return;if(obj.userData.cart)return animateCart(obj,dt,moving);if(obj.userData.dragon)return dragonTick(obj,dt,moving,flying);if(obj.userData.gait){const bob=gaitTick(obj.userData.gait,dt,moving);obj.userData.gaitM.position.y=bob*obj.userData.gaitH}const mx=obj.userData.mx;if(!mx)return;const want=moving&&mx.run?mx.run:mx.idle;
  if(mx.cur!==want){want.reset().fadeIn(.2).play();if(mx.cur)mx.cur.fadeOut(.2);mx.cur=want}if(want===mx.run)want.setEffectiveTimeScale(moving>1.5?1.3:1);mx.mixer.update(dt)}
function ownedMounts(){if(!CH)return[];CH.mounts=CH.mounts||['horse'];return CH.mounts}
function mount(id){if(!CH||groundMode!=='play')return;if(!ownedMounts().includes(id))return;if(play.mount)dismount(true);if(combat.p)return toast('You cannot mount while in combat.');let obj=null;if(id==='cart'&&parkedCart){obj=parkedCart;parkedCart=null;if(Math.hypot(CH.cartPark.x-play.x,CH.cartPark.z-play.z)>15)mmLog('Your cart rolls up to meet you.','sys')}else obj=makeMountObj(id);if(!obj)return toast('That mount is still loading. Try again in a moment.');
  G.ground.add(obj);play.mount={id,obj,def:MOUNTS[id]};play.alt=0;CH.lastMount=id;if(play.model&&play.model.userData.mixer)toonOneShot(play.model,'sit');play.dist=Math.max(play.dist,MOUNTS[id].dragon?11:7.5);
  mmLog(`You mount your ${MOUNTS[id].name}.${MOUNTS[id].fly?' Hold Space to fly up and X to descend.':''}`,'sys');markDirty();mmHud()}
function dismount(quiet){if(!play.mount)return;if(play.mount.def.cart)return parkCart();if((play.alt||0)>2&&!quiet){return toast('Land first: hold X to descend.')}G.ground.remove(play.mount.obj);play.mount=null;play.alt=0;play.dist=Math.min(play.dist,6.2);
  if(play.model&&play.model.userData.mixer)play.model.userData.once=0;if(!quiet)mmLog('You dismount.','sys');mmHud()}
function toggleMount(){if(play.mount)return dismount();const id=CH.lastMount&&ownedMounts().includes(CH.lastMount)?CH.lastMount:ownedMounts()[0];mount(id)}
function nearStable(){const tp=nearTravel();return !!tp}
function winMounts(B){$('#gwTitle').textContent='Mounts and vehicles';const own=ownedMounts(),here=nearStable();
  B.innerHTML=`<p class="gw-note">Press V to summon or dismiss your mount. Dragons fly: hold Space to climb, X to descend, and land before you dismount. ${here?'A stable master works this landing pad.':'Stable masters work at every starport and shuttleport.'} You can also tame a weakened wild dragon with Scout Trapping or Creature Handler.</p>
   <ul class="gw-list">${Object.entries(MOUNTS).map(([id,M])=>{const has=own.includes(id);return`<li class="${has||here?'':'locked'}"><span><b>${M.name}</b> <small>${M.fly?'Flying · ':''}${Math.round(M.speed*100)}% speed</small></span><small>${has?'Owned':M.cost.toLocaleString()+' credits'}</small><span></span>
     ${has?`<button class="btn mini primary" data-ride="${id}">${play.mount&&play.mount.id===id?'Riding':'Ride'}</button>`:here?`<button class="btn mini" data-buy="${id}">Buy</button>`:''}</li>`}).join('')}</ul>`;
  B.querySelectorAll('[data-ride]').forEach(b=>b.onclick=()=>{closeWin();mount(b.dataset.ride)});
  B.querySelectorAll('[data-buy]').forEach(b=>b.onclick=()=>{const M=MOUNTS[b.dataset.buy];if(CH.credits<M.cost)return toast(`${M.name} costs ${M.cost.toLocaleString()} credits.`);CH.credits-=M.cost;own.push(b.dataset.buy);markDirty();toast(`${M.name} added to your stable.`);renderWin();mmHud()})}
/* the player's movement and camera while riding (called from updatePlay) */
function rideUpdate(dt,mvAmt){const m=play.mount;if(!m)return 0;const fly=m.def.fly;if(fly){const up=keys.has(' '),dn=keys.has('x');play.alt=Math.max(0,Math.min(260,(play.alt||0)+((up?14:0)-(dn?14:0))*dt));if(!up&&!dn&&play.alt>0&&play.alt<1.2)play.alt=0}
  return fly&&play.alt>1?1:0}

/* ---- wilderness mobs: keep the open country populated around the player ---- */
const WILD_TABLE={default:[['beasts',6],['orcs',2],['undead',1],['reptiles',2],['spiders',1],['dragons',.6]],tatooine:[['reptiles',5],['beasts',3],['orcs',2],['dragons',.6]],naboo:[['beasts',5],['reptiles',2],['elementals',1],['dragons',.5]],
  dathomir:[['beasts',3],['spiders',3],['trolls',2],['undead',2],['dragons',1.2]],endor:[['beasts',4],['spiders',2],['trolls',1],['dragons',.6]],lok:[['reptiles',3],['beasts',2],['golems',1],['dragons',1.5]],yavin4:[['beasts',4],['spiders',3],['elementals',1],['dragons',.6]]};
let wildT=0;
function tickWild(dt){wildT-=dt;if(wildT>0||!groundWorld)return;wildT=2.5;const w=groundWorld;if(inCity())return;
  const near=w.placements.filter(p=>p.wild&&!p.dead&&Math.hypot(p.x-play.x,p.z-play.z)<380);
  for(const p of w.placements)if(p.wild&&!p.dead&&Math.hypot(p.x-play.x,p.z-play.z)>700){p.dead=true;p.gone=true}
  if(near.length>=7)return;const a=Math.random()*TAU,d=110+Math.random()*130,x=play.x+Math.cos(a)*d,z=play.z+Math.sin(a)*d;
  const _bz=biomeAt(w,x,z),tbl=_bz.mobs||BIOME_MOBS[_bz.key]||WILD_TABLE[w.id]||WILD_TABLE.default,tot=tbl.reduce((a,b)=>a+b[1],0);let r=Math.random()*tot,cat=tbl[0][0];for(const [c,wt] of tbl){if((r-=wt)<=0){cat=c;break}}if(Math.abs(x)>HALF*.98||Math.abs(z)>HALF*.98)return;
  if(w.pois.some(q=>q.cat==='city'&&Math.hypot(q.x-x,q.z-z)<q.r*1.1))return;if(waterDepth(w,x,z)>1)return;
  const list=GD.enemies.filter(e=>e.cat===cat);if(!list.length)return;const want=Math.min(10,realmTier(w,1+Math.floor(nearestCityDist(w,x,z)/1100))+(cat==='dragons'?3:0));const e=list.reduce((a,b)=>Math.abs(b.tier-want)<Math.abs(a.tier-want)?b:a,list[0]);
  const pack=cat==='dragons'?1:cat==='beasts'||cat==='reptiles'?1+Math.floor(Math.random()*3):1;
  for(let k=0;k<pack;k++)w.placements.push({t:e.name.toLowerCase().replace(/\s+/g,'_')+'_wild',k:'npc',x:x+(k?(Math.random()-.5)*10:0),z:z+(k?(Math.random()-.5)*10:0),wild:true,g:{kind:'hostile',enemy:e,cat,name:e.name,tier:e.tier}});
  if(cat==='dragons')mmLog(`A ${e.name} has been sighted nearby.`,'combat')}

/* ================= MMO layer: intro, planet select, shoulder camera, MMO HUD, abilities, missions, Command (RTS) mode, multiplayer, save files ================= */
const now=()=>performance.now()/1000;
const titleCase=s=>String(s||'').replace(/(^|[\s_])([a-z])/g,(m,a,b)=>(a?' ':'')+b.toUpperCase());
const PLANET_NAMES={tatooine:'Sarrak',naboo:'Veylara',corellia:'Coraxis',talus:'Talvern',rori:'Rhosmire',dantooine:'Dawnreach',lok:'Scoria',yavin4:'Verdance IV',endor:'Eldermoon',dathomir:'Crimsona',kashyyyk:'Vashtar',mustafar:'Pyraxis',hoth:'Rimehold'};
const planetName=w=>{if(!w)return'';const id=typeof w==='string'?w:w.id;return PLANET_NAMES[id]||titleCase((typeof w==='object'&&w.name)||id)};
const bx=(pid,b,t)=>!PROF[pid]?null:b<0?(t===5?PROF[pid].master:PROF[pid].novice):PROF[pid].branches[b]&&PROF[pid].branches[b].boxes[t-1];
const hasBox=id=>!!(id&&CH&&CH.skills.includes(id));
const hasProf=pid=>CH&&CH.skills.some(id=>BOXES[id]&&BOXES[id].prof===pid);
const boxesIn=pid=>CH?CH.skills.filter(id=>BOXES[id]&&BOXES[id].prof===pid).length:0;

/* ---------------- buffs and the Health / Action / Mind pools ---------------- */
let buffs=[];
function addBuff(id,name,secs,mods,icon){buffs=buffs.filter(b=>b.id!==id);buffs.push({id,name,until:now()+secs,mods,icon});mmHud()}
const buffMul=k=>buffs.reduce((a,b)=>a*(b.until>now()&&b.mods[k]?b.mods[k]:1),1);
const mmDmgMul=()=>buffMul('dmg'),mmSpeedMul=()=>buffMul('speed'),mmXpMul=()=>buffMul('xp'),mmDefMul=()=>buffMul('def');
const enemyMul=p=>p&&p.g&&p.g.weakUntil>now()?.65:1;
function hamMax(){const st=charStats(),m=st.m||{},combatN=['brawler','marksman'].filter(hasProf).length;
  return{h:st.maxHp,a:Math.round(320+(m.damage||0)*3+combatN*80+boxesIn('scout')*15),m:Math.round(320+((m.heal||0)+(m.performance||0)+(m.assembly||0))*2+boxesIn('medic')*20)}}
function tickHam(dt){if(!CH)return;const M=hamMax();if(CH.act==null)CH.act=M.a;if(CH.mind==null)CH.mind=M.m;const inC=!!combat.p,r=(inC?.012:.045)*buffMul('regen');
  CH.act=Math.min(M.a,CH.act+M.a*r*dt);CH.mind=Math.min(M.m,CH.mind+M.m*r*dt);if(!inC&&CH.hp!=null)CH.hp=Math.min(M.h,CH.hp+M.h*.02*(buffMul('regen')-1)*dt)}
const combatLevel=()=>CH?Math.min(90,1+Math.floor(CH.skills.reduce((a,id)=>a+(BOXES[id]?BOXES[id].tier+1:0),0)/1.5)):1;

/* ---------------- abilities on the hotbar (granted by the SWG skill boxes you own) ---------------- */
const ABILITIES=[
  {id:'attack',name:'Attack',icon:'⚔',desc:'Toggle auto-attack on your target (Tab picks the nearest enemy).',always:true},
  {id:'power',name:'Power Strike',icon:'✊',req:['brawler',-1],cost:{a:60},cd:6,hit:{mult:2.2,melee:true},desc:'A heavy melee blow for 220% damage.'},
  {id:'intimidate',name:'Intimidate',icon:'☠',req:['brawler',0,1],cost:{a:40},cd:20,debuff:12,desc:'Your target deals 35% less damage for 12 s.'},
  {id:'berserk',name:'Berserk',icon:'♨',req:['brawler',2,2],cost:{a:80},cd:45,buff:['berserk','Berserk',10,{dmg:1.5}],desc:'+50% damage for 10 s.'},
  {id:'aimed',name:'Aimed Shot',icon:'◎',req:['marksman',-1],cost:{a:60},cd:6,hit:{mult:2.4,range:34},desc:'A careful ranged shot for 240% damage.'},
  {id:'headshot',name:'Headshot',icon:'✛',req:['marksman',0,2],cost:{a:90},cd:14,hit:{mult:3.2,range:34},desc:'320% damage from range.'},
  {id:'suppress',name:'Suppressing Fire',icon:'≋',req:['marksman',1,1],cost:{a:45},cd:25,debuff:10,desc:'Your target deals 35% less damage for 10 s.'},
  {id:'heal',name:'Heal Damage',icon:'✚',req:['medic',-1],cost:{m:80},cd:10,heal:.3,desc:'Restore 30% of your health.'},
  {id:'stim',name:'Stim Burst',icon:'⚕',req:['medic',0,1],cost:{m:50},cd:20,heal:.15,buff:['stim','Stimulated',15,{regen:3}],desc:'Heal 15% and triple regeneration for 15 s. Uses a Stimpack if you carry one for double healing.'},
  {id:'dash',name:'Burst Run',icon:'➤',req:['scout',-1],cost:{a:50},cd:30,buff:['dash','Burst Run',12,{speed:1.6}],desc:'Run 60% faster for 12 s.'},
  {id:'camp',name:'Field Camp',icon:'⛺',req:['scout',3,1],cost:{a:30},cd:90,buff:['camp','Camp',25,{regen:4}],desc:'Out of combat, regenerate four times faster for 25 s.'},
  {id:'inspire',name:'Inspire',icon:'♪',req:['entertainer',-1],cost:{m:60},cd:60,buff:['inspire','Inspired',300,{xp:1.1}],anim:'dance',desc:'+10% XP for 5 minutes.'},
  {id:'perform',name:'Perform',icon:'♫',req:['entertainer',-1],cd:12,run:()=>perform(),desc:'Perform for nearby townsfolk to earn Dance, Music and Healing XP.'},
  {id:'survey',name:'Survey',icon:'⌖',req:['artisan',-1],run:()=>openWin('survey'),desc:'Open the survey device.'},
  {id:'sample',name:'Sample',icon:'⛏',req:['artisan',-1],run:()=>sampling?stopSample():startSample(),desc:'Sample the resource you surveyed (toggle).'},
  {id:'rally',name:'Rally',icon:'⚑',req:['squadleader',-1],cost:{a:60},cd:40,run:()=>{addBuff('rally','Rallied',15,{dmg:1.2});units.forEach(u=>u.rally=now()+15);floatMsg('Your squad rallies: +30% unit damage for 15 s.')},desc:'+20% damage for you and +30% for your units for 15 s.'},
];
function eliteAbilities(){if(!CH)return[];return Object.keys(PROF).filter(pid=>!PROF[pid].start&&hasBox(PROF[pid].novice)).map(pid=>({id:'elite_'+pid,name:PROF[pid].name+' Signature',icon:'★',cost:{a:100},cd:18,
  hit:{mult:3,range:/rifle|carbine|pistol|commando|bounty|smuggler|squad/.test(pid)?34:null,melee:/sword|polearm|unarmed|brawl/.test(pid)},desc:`The ${PROF[pid].name}'s signature attack for 300% damage.`}))}
function knownAbilities(){if(!CH)return[];return ABILITIES.filter(a=>a.always||hasBox(bx(...a.req))).concat(eliteAbilities()).slice(0,10)}
const cds={};
function currentTarget(){if(combat.p&&!combat.p.dead)return combat.p;return selPlacement&&selPlacement.g&&!selPlacement.dead?selPlacement:null}
function targetPos(p){const e=[...npcToons.entries()].find(([i])=>groundWorld.placements[i]===p);return e?e[1].userData.pos:{x:p.x,z:p.z}}
function useAbility(a){if(!CH||groundMode!=='play')return;if(rts.on)return;const t=now();if(cds[a.id]>t)return floatMsg(`${a.name} is cooling down (${Math.ceil(cds[a.id]-t)} s).`);
  if(a.id==='attack'){const p=currentTarget();if(combat.p){combat.p=null;floatMsg('Auto-attack off');return mmHud()}if(hunt.auto){hunt.auto=null;floatMsg('Auto-attack off');return mmHud()}if(!p||p.g.kind==='friendly'){const an=nearestAnimal(play.x,play.z,Math.max(14,charStats().range+3));if(an){hunt.auto=an;hunt.swing=0;hunt.cur=an;huntBar();floatMsg(`Hunting the ${HUNT_NAME(an.h.id).toLowerCase()}`);return}return floatMsg('Select an enemy first (Tab or click), or walk up to a wild animal to hunt it.')}return startAttack(p)}
  const c=a.cost||{};if(c.a&&CH.act<c.a)return floatMsg(`Not enough Action for ${a.name}.`);if(c.m&&CH.mind<c.m)return floatMsg(`Not enough Mind for ${a.name}.`);
  if(a.hit||a.debuff){const p=currentTarget();if((!p||p.g.kind==='friendly')&&a.hit){const an=nearestAnimal(play.x,play.z,a.hit.range||14);if(an){if(c.a)CH.act-=c.a;if(c.m)CH.mind-=c.m;cds[a.id]=t+(a.cd||0);return huntStrike(an,a.hit.mult,abilAnim(a)||'attack')}}if(!p||p.g.kind==='friendly')return floatMsg(`${a.name} needs an enemy target.`);npcStats(p);const tp=targetPos(p),d=Math.hypot(tp.x-play.x,tp.z-play.z),st=charStats(),range=a.hit&&a.hit.range||st.range+2;
    if(d>range)return floatMsg(`Out of range (${Math.round(d)} m, need ${Math.round(range)} m).`);
    if(a.hit){const R=ggHit(p.g,a.hit.mult*mmDmgMul(),a.hit.melee?'melee':undefined),dmg=R.dmg;p.g.hp-=dmg;floatMsg(R.dmg?`${a.name} ${R.outcome==='crit'?'CRITS':'hits'} ${p.g.name} for ${dmg}`:ggHitText('You',p.g.name,R));if(!combat.p)startAttack(p);
      const xpT=CLASS_WEAPON_XP[CH.cls]||'combat';if(Math.random()<.3)gainXP(xpT,8,'');if(p.g.hp<=0)killNpc(p)}
    if(a.debuff){p.g.weakUntil=now()+a.debuff;floatMsg(`${p.g.name} is weakened for ${a.debuff} s`);if(!combat.p)startAttack(p)}
    if(play.model)toonOneShot(play.model,abilAnim(a)||'attack')}
  if(a.heal){const M=hamMax(),stim=a.id==='stim'&&CH.inv.items.find(i=>i.kind==='medicine');let h=M.h*a.heal*(stim?2:1);{const cs=charStats().cs;if(cs)h=h*(1+cs.healPower/300)*(Math.random()<cs.crit?1.5:1)}if(stim){CH.inv.items=CH.inv.items.filter(i=>i!==stim);markDirty()}
    CH.hp=Math.min(M.h,(CH.hp||0)+h);floatMsg(`You heal ${Math.round(h)}${stim?' using a Stimpack':''}`);gainXP('medical',20,'healing');if(play.model)toonOneShot(play.model,abilAnim(a)||'cast')}
  if(a.buff){addBuff(...a.buff,a.icon);floatMsg(`${a.buff[1]} for ${a.buff[2]} s`);if((a.anim||abilAnim(a))&&play.model)toonOneShot(play.model,a.anim||abilAnim(a))}
  if(a.run)a.run();
  if(c.a)CH.act-=c.a;if(c.m)CH.mind-=c.m;if(a.cd)cds[a.id]=t+a.cd*(1-((charStats().cs||{}).cdr||0));mmHud()}

/* ---------------- shoulder camera: free look with the mouse, right-click toggles mouselook ---------------- */
let mouselook=false;
function setMouselook(on){mouselook=on;if(on){try{const r=canvas.requestPointerLock();if(r&&r.catch)r.catch(()=>{mouselook=false;mmHud()})}catch(e){mouselook=false}}else if(document.pointerLockElement===canvas)document.exitPointerLock();mmHud()}
document.addEventListener('pointerlockchange',()=>{if(document.pointerLockElement!==canvas&&mouselook){mouselook=false;mmHud()}});
document.addEventListener('mousemove',e=>{if(document.pointerLockElement!==canvas||groundMode!=='play'||rts.on)return;play.camYaw-=e.movementX*.0026;play.camPitch=Math.max(-.45,Math.min(1.25,play.camPitch+e.movementY*.0022))});
canvas.addEventListener('contextmenu',e=>{if(level!=='ground'||groundMode!=='play')return;e.preventDefault();if(rts.on)return rtsOrder(e.clientX,e.clientY);setMouselook(!mouselook)});

/* ---------------- MMO HUD ---------------- */
hud.innerHTML=`
 <div class="mm-unit mm-player"><canvas id="mmPortrait" width="64" height="64" aria-hidden="true"></canvas><div class="mm-uinfo"><div class="mm-uname"><b id="ghName"></b><span id="mmLvl"></span></div><small id="ghProf"></small>
   <div class="mm-ham"><div class="mm-pool h" data-l="H"><i id="ghHp"></i><span id="ghHpT"></span></div><div class="mm-pool a" data-l="A"><i id="mmAct"></i><span id="mmActT"></span></div><div class="mm-pool m" data-l="M"><i id="mmMind"></i><span id="mmMindT"></span></div></div>
   <small id="ghCr"></small><small id="mmWhere"></small><div class="mm-buffs" id="mmBuffs"></div></div></div>
 <div class="mm-unit mm-target" id="ghTarget" hidden><div class="mm-uname"><b id="ghTName"></b><span id="mmTCon"></span></div><div class="mm-pool h"><i id="ghTHp"></i><span id="mmTHpT"></span></div><small id="mmTInfo"></small><div class="acts" id="mmTActs"></div></div>
 <div class="mm-compass" aria-hidden="true"><canvas id="mmCompass" width="360" height="26"></canvas></div>
 <div class="mm-track" id="mmTrack"></div>
 <div class="gh-prompt" id="ghPrompt" hidden></div>
 <div class="mm-cross" id="mmCross" hidden></div>
 <div class="mm-bottom"><div class="mm-bar mm-bar2" id="mmBar2"></div><div class="mm-bar" id="mmBar"></div><div class="mm-xp" title="Progress to your next skill box"><i id="mmXp"></i><span id="mmXpT"></span></div></div>
 <div class="mm-menu" id="ghActions"></div>
 <div class="mm-chat"><div class="mm-tabs"><button data-ct="all" aria-pressed="true">All</button><button data-ct="combat">Combat</button><button data-ct="chat">Chat</button><span id="mmOnline"></span></div>
   <div class="mm-log" id="ghLog" aria-live="polite"></div><input id="mmChatIn" maxlength="200" autocomplete="off" placeholder="Enter to chat · /help"></div>
 <div class="mm-cmd" id="mmCmd" hidden></div>
 <div class="mm-plates" id="mmPlates" aria-hidden="true"></div>`;
const MICRO=[['inventory','Inventory','I'],['skills','Skills','K'],['craft','Craft','C'],['survey','Survey','U'],['harvester','Harvesters','H'],['missions','Missions','O'],['command','Command','B'],['mounts','Mounts','V'],['travel','Travel','T'],['navigate','Navigate','G'],['codex','Codex','L'],['menu','Menu','M']];
$('#ghActions').innerHTML=MICRO.map(([id,l,k])=>`<button data-act="${id}" title="${l} (${k})"><kbd>${k}</kbd>${l}</button>`).join('');
$('#ghActions').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const a=b.dataset.act;if(a==='missions')return openWin('missions');if(a==='mounts')return openWin('mounts');if(a==='command')return rtsToggle();doAction(a)});
let chatTab='all';
hud.querySelector('.mm-tabs').addEventListener('click',e=>{const b=e.target.closest('[data-ct]');if(!b)return;chatTab=b.dataset.ct;hud.querySelectorAll('[data-ct]').forEach(x=>x.setAttribute('aria-pressed',x===b));
  $('#ghLog').querySelectorAll('div').forEach(d=>d.hidden=!(chatTab==='all'||d.dataset.k===chatTab))});
function mmLog(t,k='sys',who){const el=document.createElement('div');el.dataset.k=k;el.className='k-'+k;if(who){const b=document.createElement('b');b.textContent=who+': ';el.append(b)}el.append(document.createTextNode(t));
  el.hidden=!(chatTab==='all'||chatTab===k);const L=$('#ghLog');L.append(el);while(L.children.length>80)L.firstChild.remove();L.scrollTop=L.scrollHeight}
const portraitCache={};
function drawPortrait(){const cv=$('#mmPortrait'),x=cv.getContext('2d'),key=CH?CH.race+CH.cls:'';if(portraitCache.k===key)return;portraitCache.k=key;
  const rc=CH&&RACE[CH.race]?RACE[CH.race].color:'#888',cc=CH&&CLASS[CH.cls]?CLASS[CH.cls].color||'#ccc':'#ccc';const g=x.createRadialGradient(32,26,4,32,32,34);g.addColorStop(0,rc);g.addColorStop(1,'#0b0e13');x.fillStyle=g;x.fillRect(0,0,64,64);
  x.fillStyle='rgba(0,0,0,.35)';x.beginPath();x.arc(32,28,13,0,TAU);x.fill();x.fillRect(16,40,32,24);x.strokeStyle=cc;x.lineWidth=3;x.strokeRect(1.5,1.5,61,61);
  x.fillStyle='#fff';x.font='600 18px Oswald, sans-serif';x.textAlign='center';x.fillText((CH?CH.name:'?').slice(0,1).toUpperCase(),32,34)}
function nextBox(){if(!CH)return null;const pids=[CH.prof,...Object.keys(PROF).filter(hasProf)];for(const pid of pids){const P=PROF[pid];const ids=[P.novice,...P.branches.flatMap(b=>b.boxes),P.master];
    for(const id of ids){const b=BOXES[id];if(!CH.skills.includes(id)&&b.req.every(r=>CH.skills.includes(r)))return b}}return null}
function conColor(t){const d=t-Math.ceil(combatLevel()/11);return d>=2?'#ff5b4d':d>=1?'#ff9a3d':d>=0?'#f2d14a':d>=-1?'#7fd36a':'#9aa7b4'}
let lastTActs=null;
function mmHud(){if(hud.hidden||!CH)return;const M=hamMax();if(CH.act==null)CH.act=M.a;if(CH.mind==null)CH.mind=M.m;drawPortrait();
  $('#mmLvl').textContent='CL '+combatLevel();$('#mmAct').style.width=(100*CH.act/M.a)+'%';$('#mmActT').textContent=`${Math.round(CH.act)} / ${M.a}`;$('#mmMind').style.width=(100*CH.mind/M.m)+'%';$('#mmMindT').textContent=`${Math.round(CH.mind)} / ${M.m}`;
  const t=now();buffs=buffs.filter(b=>b.until>t);$('#mmBuffs').innerHTML=buffs.map(b=>`<span title="${esc(b.name)}">${b.icon||'✦'}<i>${Math.ceil(b.until-t)}</i></span>`).join('');
  // target frame: combat target, or the NPC you clicked
  const p=currentTarget();$('#ghTarget').hidden=!p;if(p){npcStats(p);const tp=targetPos(p),d=Math.hypot(tp.x-play.x,tp.z-play.z);$('#ghTName').textContent=p.g.name;$('#mmTCon').textContent=p.g.kind==='friendly'?(p.g.role||'Citizen'):'T'+p.g.tier;
    $('#mmTCon').style.color=p.g.kind==='friendly'?'#8fd0ff':conColor(p.g.tier);$('#ghTHp').style.width=(100*Math.max(0,p.g.hp)/p.g.maxHp)+'%';$('#mmTHpT').textContent=`${Math.max(0,Math.round(p.g.hp))} / ${p.g.maxHp}`;
    $('#mmTInfo').textContent=`${Math.round(d)} m${p.g.weakUntil>t?' · Weakened':''}${combat.p===p?' · In combat':''}`;
    const key=p.t+p.x+(p.dead?'d':'')+(p.corpse?'c':'')+(combat.p===p?'f':'');if(lastTActs!==key){lastTActs=key;const box=$('#ghTarget');$('#mmTActs').innerHTML='';npcActions(box,p)}}else lastTActs=null;
  renderBars();
  const nb=nextBox();if(nb){const have=CH.xp[nb.xpType]||0;$('#mmXp').style.width=Math.min(100,nb.xp?100*have/nb.xp:100)+'%';$('#mmXpT').textContent=`${nb.name} · ${have.toLocaleString()} / ${nb.xp.toLocaleString()} ${xpName(nb.xpType)} XP${have>=nb.xp?' · ready at a trainer':''}`}
  $('#mmCross').hidden=!mouselook||rts.on;renderTracker();mmFrameExtras()}
function drawCompass(){const cv=$('#mmCompass');if(!cv||hud.hidden)return;const x=cv.getContext('2d'),W=cv.width,head=((-play.camYaw*180/Math.PI)%360+360)%360;x.clearRect(0,0,W,26);
  x.fillStyle='rgba(8,11,16,.7)';x.fillRect(0,0,W,26);x.textAlign='center';
  for(let d=-90;d<=90;d+=15){const a=Math.round(head+d+360)%360,px=W/2+d*2;const lbl={0:'N',90:'E',180:'S',270:'W'}[Math.round((head+d+360)%360/15)*15%360];
    x.strokeStyle='rgba(220,230,240,.45)';x.beginPath();x.moveTo(px,lbl?14:18);x.lineTo(px,24);x.stroke();if(lbl){x.fillStyle=lbl==='N'?'#f2b04a':'#e8eef5';x.font='600 12px Oswald, sans-serif';x.fillText(lbl,px,12)}}
  for(const u of (typeof wpHere==='function'?wpHere():[])){const brg=(Math.atan2(u.x-play.x,u.z-play.z)*180/Math.PI+360)%360;let d=((brg-head+540)%360)-180;d=Math.max(-90,Math.min(90,d));x.fillStyle=WP_COLORS[u.color]||'#6ff0ff';x.beginPath();x.moveTo(W/2+d*2,16);x.lineTo(W/2+d*2-5,25);x.lineTo(W/2+d*2+5,25);x.fill()}
  x.fillStyle='#f2b04a';x.fillRect(W/2-1,0,2,8)}

/* ---------------- chat, emotes and multiplayer presence (the room capability) ---------------- */
let room=null,peerModels=new Map(),presT=0;
(window.claude&&window.claude.use?window.claude.use('room'):Promise.resolve(null)).then(r=>{room=r;if(!r)return;
  r.onPeers(ch=>{const n=ch.peers.filter(p=>p.presence&&p.presence.pl).length;$('#mmOnline').textContent=n?`${n} in the galaxy`:'';for(const p of ch.left)dropPeer(p.peer)});
  r.on('chat',m=>{const d=m.data||{};if(typeof d.m!=='string')return;if(m.sameTab)return;mmLog(d.m.slice(0,200),'chat',String(d.n||'Someone').slice(0,24))});
  r.on('emote',m=>{const d=m.data||{};const pm=peerModels.get(m.peer);if(pm&&pm.obj&&EMOTES[d.e])toonOneShot(pm.obj,d.e)})}).catch(()=>{});
function dropPeer(id){const pm=peerModels.get(id);if(!pm)return;if(pm.obj)G.ground.remove(pm.obj);if(pm.mount)G.ground.remove(pm.mount);if(pm.el)pm.el.remove();peerModels.delete(id)}
function tickPeers(dt){if(!room)return;presT-=dt;const playing=CH&&level==='ground'&&groundMode==='play'&&groundWorld;
  if(presT<=0){presT=.25;room.presence(playing?{v:1,pl:groundWorld.id,x:Math.round(play.x*10)/10,z:Math.round(play.z*10)/10,y:Math.round(play.yaw*100)/100,n:CH.name.slice(0,24),r:CH.race,c:CH.cls,s:CH.set,pr:PROF[CH.prof].name,m:play.moving||0,mt:play.mount?play.mount.id:null,a:Math.round(play.alt||0)}:{v:1,pl:null}).catch(()=>{})}
  const peers=room.peers(),seen=new Set();
  for(const p of peers){const s=p.presence||{};if(p.sameTab||!playing||s.pl!==groundWorld.id||!isFinite(s.x)||!isFinite(s.z))continue;seen.add(p.peer);let pm=peerModels.get(p.peer);
    if(!pm){const race=RACE[s.r]?s.r:'human',cls=CLASS[s.c]?s.c:'warrior';const obj=toonInstance(race,{race,cls,set:GD.armorSets.includes(s.s)?s.s:GD.armorSets[0],tier:1},{lit:'lambert'});if(!obj)continue;
      G.ground.add(obj);const el=document.createElement('div');el.className='mm-plate';$('#mmPlates').append(el);pm={obj,el,x:s.x,z:s.z,y:s.y||0};peerModels.set(p.peer,pm)}
    pm.el.textContent=`${String(s.n||'Traveler').slice(0,24)}${s.pr?' · '+String(s.pr).slice(0,24):''}`;const k=Math.min(1,dt*8);pm.x+=(s.x-pm.x)*k;pm.z+=(s.z-pm.z)*k;pm.y=s.y||0;
    const mt=MOUNTS[s.mt]?s.mt:null;if(pm.mtId!==mt){if(pm.mount)G.ground.remove(pm.mount);pm.mount=mt?makeMountObj(mt):null;if(pm.mount)G.ground.add(pm.mount);pm.mtId=pm.mount?mt:null;if(pm.mount&&pm.obj.userData.mixer)toonOneShot(pm.obj,'sit');else if(pm.obj.userData.mixer)pm.obj.userData.once=0}
    const by=groundH(groundWorld,pm.x,pm.z)+(pm.mount?Math.max(0,+s.a||0):0);if(pm.mount){pm.mount.position.set(pm.x,by,-pm.z);pm.mount.rotation.y=pm.y+Math.PI;animateMount(pm.mount,dt,s.m||0,(+s.a||0)>1);const st=pm.mount.userData.seat||1.2,sz=pm.mount.userData.seatZ||0;pm.obj.position.set(pm.x-Math.sin(pm.y)*sz,by+st-.45,-(pm.z+Math.cos(pm.y)*sz));pm.obj.rotation.y=pm.y+Math.PI;animateAny(pm.obj,now()*7,0)}
    else{pm.obj.position.set(pm.x,by,-pm.z);pm.obj.rotation.y=pm.y+Math.PI;animateAny(pm.obj,now()*7,s.m||0)}}
  for(const id of [...peerModels.keys()])if(!seen.has(id))dropPeer(id);
  const v=new V3();for(const [,pm] of peerModels){v.set(pm.x,groundH(groundWorld,pm.x,pm.z)+2.4,-pm.z).project(cam);const on=v.z<1&&Math.abs(v.x)<1.1&&Math.abs(v.y)<1.1;pm.el.hidden=!on;if(on){pm.el.style.transform=`translate(${(v.x*.5+.5)*innerWidth}px,${(-v.y*.5+.5)*innerHeight}px) translate(-50%,-100%)`}}}
const EMOTES={dance:'dances',sit:'sits down',taunt:'lets out a battle cry',wave:'waves',point:'points',flex:'flexes',strut:'struts',look:'looks around',cheer:'cheers',spin:'spins'};
function chatSend(text){text=text.trim();if(!text)return;if(text[0]==='/'){const [cmd,...rest]=text.slice(1).split(/\s+/);const c=cmd.toLowerCase();
    if(c==='help')return mmLog('Emotes: /'+Object.keys(EMOTES).join(' /')+' /stand · /walk <style> · Space jump · Shift+M planet map and waypoints · L codex · 1-0 abilities · Tab target · B command mode · right-click mouselook · O missions','sys');
    if(EMOTES[c]){if(play.model)toonOneShot(play.model,c);mmLog(`${CH.name} ${EMOTES[c]}.`,'chat');room&&room.emit('emote',{e:c}).catch(()=>{});return}
    if(c==='stand'){if(play.model&&play.model.userData.mixer){play.model.userData.once=0}return}
    return mmLog(`Unknown command /${c}. Try /help.`,'sys')}
  mmLog(text,'chat',CH?CH.name:'You');if(room)room.emit('chat',{n:CH?CH.name:'Traveler',m:text.slice(0,200)}).catch(e=>{if(e&&e.code==='not_permitted')mmLog('Only people with edit access can chat in this galaxy.','sys')})}
$('#mmChatIn').addEventListener('keydown',e=>{if(e.key==='Enter'){chatSend(e.target.value);e.target.value='';e.target.blur();e.preventDefault()}else if(e.key==='Escape'){e.target.blur()}e.stopPropagation()});

/* ---------------- missions (SWG mission terminals, simplified) ---------------- */
let boardSalt=0;
const HUNT=/beasts|reptiles|spiders|insects|dragons/;
function missionBoard(tk='general'){if(!groundWorld)return[];const w=groundWorld,TT=TERMINALS[tk]||TERMINALS.general,R=mulberry(strHash(w.id+':'+tk+':'+(missionTerminal?missionTerminal.city:'')+':'+Math.floor(Date.now()/36e5)+':'+boardSalt)),out=[];
  const hostilePois=w.pois.filter(q=>/military|camp|ruin|crash/.test(q.cat)),cities=w.pois.filter(q=>q.cat==='city'),sights=w.pois.filter(q=>q.cat!=='city');
  const classes=[...new Set(planetRes().filter(r=>r.t!==-1).flatMap(r=>r.cl).filter(c=>/^(Metal|Mineral|Chemical|Flora Resources|Gas|Water|Gemstone)$/.test(c)))];
  const pick=a=>a[Math.floor(R()*a.length)],dist=q=>Math.hypot(q.x-play.x,q.z-play.z);
  for(let i=0;i<7;i++){const kind=pick(TT.kinds);
    if(kind==='destroy'&&hostilePois.length){const q=pick(hostilePois),n=3+Math.floor(R()*4),d=dist(q);out.push({kind,title:`Destroy: clear ${n} hostiles at ${q.name}`,need:n,target:{x:q.x,z:q.z,r:q.r*1.6+80,name:q.name},reward:{cr:Math.round(400+d*.12+n*80),xp:120+n*40,xpType:'combat'}})}
    else if(kind==='survey'&&classes.length){const c=pick(classes),n=[150,250,400][Math.floor(R()*3)];out.push({kind,title:`Survey: deliver ${n} units of ${c}`,need:n,cls:c,reward:{cr:Math.round(n*2.2),xp:Math.round(n*.6),xpType:'surveying'},req:'crafting_artisan_novice'})}
    else if(kind==='explore'&&sights.length){const q=pick(sights),d=dist(q);out.push({kind,title:`Scout: report on ${q.name}`,need:1,target:{x:q.x,z:q.z,r:Math.max(60,q.r),name:q.name},reward:{cr:Math.round(250+d*.15),xp:150,xpType:'scouting'}})}
    else if(kind==='hunt'){const n=4+Math.floor(R()*4);out.push({kind,title:`Hunt: thin out ${n} wild creatures`,need:n,reward:{cr:300+n*90,xp:100+n*30,xpType:'trapping'},req:'outdoors_scout_novice'})}
    else if(kind==='entertain'&&cities.length){const q=pick(cities);out.push({kind,title:`Entertain: perform 3 times in ${q.name}`,need:3,target:{x:q.x,z:q.z,r:q.r,name:q.name},reward:{cr:600,xp:300,xpType:'dance'},req:'social_entertainer_novice'})}}
  const fac=tk==='faction'?PLANET_FACTION[w.id]:null;return out.filter((m,i)=>out.findIndex(o=>o.title===m.title)===i).map(m=>({...m,...(fac?{faction:fac,standing:150,title:`${(FACTION[fac]||{}).name}: ${m.title}`,reward:{...m.reward,cr:Math.round(m.reward.cr*1.4)}}:{}),id:'m'+strHash(w.id+tk+m.title).toString(36),planet:w.id,have:0,terminal:tk}))}
function inCity(){return groundWorld&&groundWorld.pois.some(q=>q.cat==='city'&&Math.hypot(q.x-play.x,q.z-play.z)<q.r*1.15)}
function winMissions(B){$('#gwTitle').textContent='Missions';CH.missions=CH.missions||[];const act=CH.missions,board=atTerminal()?missionBoard(missionTerminal.kind).filter(m=>!act.some(a=>a.id===m.id)):[];
  B.innerHTML=`<p class="gw-note">Take up to three missions. Rewards pay out the moment a mission completes. ${atTerminal()?`${esc(missionTerminal.city)} · ${TERMINALS[missionTerminal.kind].name} mission terminal.`:'Find a mission terminal in any city (look for the light beacons) and press F to browse work.'}</p>
   <h3>Active (${act.length}/3)</h3><ul class="gw-list">${act.map(m=>`<li><span><b>${esc(m.title)}</b> <small>${esc(titleCase(m.planet))}</small></span><small>${m.have}/${m.need} · ${m.reward.cr} cr · ${m.reward.xp} ${esc(xpName(m.reward.xpType))} XP</small>
     <span class="conc"><i style="width:${100*m.have/m.need}%"></i>${Math.round(100*m.have/m.need)}%</span><span class="gw-hb">${m.target?`<button class="btn mini" data-wp="${m.id}">Waypoint</button>`:''}<button class="btn mini" data-ab="${m.id}">Abandon</button></span></li>`).join('')||'<li>None.</li>'}</ul>
   ${board.length?`<h3>Terminal</h3><ul class="gw-list">${board.map(m=>{const lock=m.req&&!hasBox(m.req);return`<li class="${lock?'locked':''}"><span><b>${esc(m.title)}</b></span><small>${m.reward.cr} cr · ${m.reward.xp} ${esc(xpName(m.reward.xpType))} XP${lock?` · needs ${esc(BOXES[m.req].name)}`:''}</small><span></span>${lock||act.length>=3?'':`<button class="btn mini primary" data-take="${m.id}">Accept</button>`}</li>`}).join('')}</ul><button class="btn" id="msNew">Refresh terminal</button>`:''}`;
  B.querySelectorAll('[data-take]').forEach(b=>b.onclick=()=>{const m=board.find(x=>x.id===b.dataset.take);act.push(m);if(m.target)setWaypoint(m.target.x,m.target.z,m.title);markDirty();mmLog(`Mission accepted: ${m.title}`,'sys');renderWin();mmHud()});
  B.querySelectorAll('[data-ab]').forEach(b=>b.onclick=()=>{CH.missions=act.filter(m=>m.id!==b.dataset.ab);markDirty();renderWin();mmHud()});
  B.querySelectorAll('[data-wp]').forEach(b=>b.onclick=()=>{const m=act.find(x=>x.id===b.dataset.wp);if(m.planet!==groundWorld.id)return toast(`That mission is on ${titleCase(m.planet)}.`);setWaypoint(m.target.x,m.target.z,m.title);closeWin()});
  $('#msNew')&&($('#msNew').onclick=()=>{boardSalt++;renderWin()})}
function missionProgress(fn){if(!CH||!CH.missions)return;let changed=false;for(const m of CH.missions){if(m.planet&&groundWorld&&m.planet!==groundWorld.id&&m.kind!=='survey')continue;const add=fn(m);if(add){m.have=Math.min(m.need,m.have+add);changed=true}}
  if(!changed)return;const done=CH.missions.filter(m=>m.have>=m.need);for(const m of done){if(m.faction)addStanding(m.faction,m.standing||150,'faction mission');CH.credits+=m.reward.cr;gainXP(m.reward.xpType,m.reward.xp,'mission');mmLog(`Mission complete: ${m.title}. +${m.reward.cr} credits`,'sys');toast(`Mission complete! +${m.reward.cr} credits`)}
  CH.missions=CH.missions.filter(m=>m.have<m.need);markDirty();mmHud()}
function mmOnKill(p){const pos=targetPos(p);{const cf=CREATURE_FACTION[p.g&&p.g.cat];if(cf){addStanding(cf,-10);if(RIVAL[cf]&&RIVAL[cf]!==cf)addStanding(RIVAL[cf],6,'defeated a '+(FACTION[cf]||{}).name+' ally')}
    const city=groundWorld.pois.find(q=>q.cat==='city'&&Math.hypot(q.x-pos.x,q.z-pos.z)<q.r*1.8);if(city)addStanding(PLANET_FACTION[groundWorld.id],4)}if(p.g&&(p.g.kind==='boss'||/orcs|undead|trolls|titans|minotaurs/.test(p.g.cat||'')))gainXP('bountyhunter',Math.round(12*(p.g.tier||1)*(p.g.kind==='boss'?5:1)),'');missionProgress(m=>m.kind==='destroy'&&p.g.kind!=='friendly'&&Math.hypot(pos.x-m.target.x,pos.z-m.target.z)<m.target.r?1:m.kind==='hunt'&&HUNT.test(p.g.cat||'')?1:0)}
function mmOnRes(r,units){missionProgress(m=>m.kind==='survey'&&r.cl&&r.cl.includes(m.cls)?units:0)}
function mmOnPerform(){missionProgress(m=>m.kind==='entertain'&&Math.hypot(play.x-m.target.x,play.z-m.target.z)<m.target.r?1:0)}
function mmOnMove(){missionProgress(m=>m.kind==='explore'&&Math.hypot(play.x-m.target.x,play.z-m.target.z)<m.target.r?1:0)}
function renderTracker(){const el=$('#mmTrack');const ms=(CH&&CH.missions)||[];el.hidden=!ms.length;el.innerHTML=ms.length?`<b>Missions</b>`+ms.map(m=>`<div><span>${esc(m.title)}</span><small>${m.have}/${m.need}${m.target&&groundWorld&&m.planet===groundWorld.id?' · '+Math.round(Math.hypot(m.target.x-play.x,m.target.z-play.z))+' m':''}</small></div>`).join(''):''}

/* ---------------- Command mode (RTS): squads, pets and player structures ---------------- */
const UNIT_TYPES={
  militia:{name:'Militia Trooper',cost:150,hp:520,dmg:16,range:3.5,cls:'warrior',req:()=>hasProf('brawler')||hasProf('marksman'),reqText:'any Brawler or Marksman box'},
  rifleman:{name:'Rifle Trooper',cost:350,hp:430,dmg:20,range:22,cls:'ranger',req:()=>hasBox('combat_marksman_novice'),reqText:'Novice Marksman'},
  medic:{name:'Field Medic',cost:300,hp:380,dmg:6,range:16,heal:45,cls:'priest',req:()=>hasBox('science_medic_novice'),reqText:'Novice Medic'},
  veteran:{name:'Squad Veteran',cost:900,hp:900,dmg:30,range:4,cls:'raider',req:()=>hasBox('outdoors_squadleader_novice'),reqText:'Novice Squad Leader'}};
const STRUCT_TYPES={
  house:{name:'Player House',k:'kk_house',size:12,cost:2000,res:[['Metal',80],['Mineral',40]],req:'crafting_artisan_novice',fx:'Your home: incapacitation clones you here.'},
  barracks:{name:'Barracks',k:'kk_barracks',size:16,cost:3000,res:[['Metal',150]],req:'combat_brawler_novice|combat_marksman_novice',fx:'+2 squad size and a place to recruit.'},
  turret:{name:'Defense Turret',k:'kk_watchtower',size:6,cost:1500,res:[['Metal',120],['Chemical',40]],req:'crafting_artisan_engineering_01',fx:'Shoots hostiles within 40 m.'},
  factory:{name:'Factory',k:'kk_lumbermill',size:15,cost:4000,res:[['Metal',200],['Mineral',100]],req:'crafting_artisan_business_01',fx:'Produces 90 credits of goods an hour. Collect in Command mode.'},
  cantina:{name:'Cantina',k:'kk_market',size:15,cost:3500,res:[['Metal',120],['Flora Resources',80]],req:'social_entertainer_novice',fx:'Heals you and your squad nearby; performing here earns double XP.'},
  commandpost:{name:'Command Post',k:'kk_castle',size:28,cost:20000,res:[['Metal',600],['Mineral',300]],req:'crafting_architect_novice',fx:'Founds a player city: +4 squad size.'}};
const reqOk=r=>!r||r.split('|').some(hasBox),reqName=r=>r.split('|').map(id=>BOXES[id]?BOXES[id].name:id).join(' or ');
const rts={on:false,x:0,z:0,dist:110,yaw:0,sel:new Set(),selStruct:null,placing:null,box:null,ghost:null};
let units=[];const structGroup=new THREE.Group();
function structsHere(){return(CH&&CH.structures||[]).filter(s=>groundWorld&&s.planet===groundWorld.id)}
function unitCap(){const all=(CH&&CH.structures)||[];return 2+2*all.filter(s=>s.type==='barracks').length+4*all.filter(s=>s.type==='commandpost').length+boxesIn('squadleader')+boxesIn('creaturehandler')}
function spawnUnitModel(d){if(d.spec){const h=spawnCreature({t:d.name,x:play.x,z:play.z},d.spec);return h}return toonInstance(d.race||CH.race,{race:d.race||CH.race,cls:UNIT_TYPES[d.type]?UNIT_TYPES[d.type].cls:'warrior',set:CH.set,tier:Math.max(1,Math.min(8,gearTier()))},{lit:'lambert'})}
function spawnUnits(){despawnUnits();if(!CH)return;CH.units=CH.units||[];CH.units.forEach((d,i)=>{const obj=spawnUnitModel(d);if(!obj)return;const a=i/Math.max(1,CH.units.length)*TAU;const u={d,obj,x:play.x+Math.cos(a)*3,z:play.z+Math.sin(a)*3,yaw:0,order:{kind:'follow'},cd:0,moving:0};G.ground.add(obj);units.push(u)})}
function despawnUnits(){units.forEach(u=>G.ground.remove(u.obj));units=[];rts.sel.clear()}
function hostilesNear(x,z,r){const out=[];for(const [i,h] of npcToons){const p=groundWorld.placements[i];if(!p.g||p.g.kind==='friendly'||p.dead)continue;const pos=h.userData.pos;const d=Math.hypot(pos.x-x,pos.z-z);if(d<r)out.push({p,pos,d,h})}return out.sort((a,b)=>a.d-b.d)}
function unitAttack(u,p,dt,pos){const T=UNIT_TYPES[u.d.type]||{dmg:u.d.dmg||18,range:3.5};const d=Math.hypot(pos.x-u.x,pos.z-u.z),range=T.range||3.5;
  if(d>range){moveUnit(u,pos.x,pos.z,dt,range*.8);return}u.yaw=Math.atan2(-(pos.x-u.x),pos.z-u.z);u.moving=0;u.cd-=dt;
  if(u.cd<=0){u.cd=1.8;npcStats(p);const dmg=Math.round((T.dmg||u.d.dmg||18)*(1+(u.d.tier||0)*.1)*(u.rally>now()?1.3:1)*(.8+Math.random()*.4));p.g.hp-=dmg;if(u.obj.userData.mixer)toonOneShot(u.obj,'attack');
    const h=[...npcToons.entries()].find(([i])=>groundWorld.placements[i]===p);if(h){const cu=h[1].userData;cu.target={x:u.x,z:u.z};cu.combat=true}
    if(p.g.hp<=0){mmLog(`${u.d.name} defeated ${p.g.name}`,'combat');killNpc(p);gainXP(u.d.type==='pet'?'creaturehandler':'squadleader',30,'')}}
  // the creature hits back
  u.ecd=(u.ecd||0)-dt;if(d<6&&u.ecd<=0){u.ecd=2.2;const dm=Math.round(p.g.dmg*enemyMul(p)*(.7+Math.random()*.6));u.d.hp-=dm;if(u.obj.userData.mixer&&Math.random()<.4)toonOneShot(u.obj,'hit');
    if(u.d.hp<=0){mmLog(`${u.d.name} has fallen.`,'combat');toast(`${u.d.name} has fallen.`);G.ground.remove(u.obj);CH.units=CH.units.filter(x=>x!==u.d);units=units.filter(x=>x!==u);rts.sel.delete(u);markDirty()}}}
function moveUnit(u,tx,tz,dt,stop=.6){const dx=tx-u.x,dz=tz-u.z,d=Math.hypot(dx,dz);if(d<stop){u.moving=0;return true}const sp=(d>12?6.5:4.2)*dt,s=Math.min(d,sp);u.x+=dx/d*s;u.z+=dz/d*s;u.yaw=Math.atan2(-dx,dz);u.moving=d>12?2:1;return false}
function tickUnits(dt){if(!units.length)return;const st=structsHere();units.forEach((u,i)=>{const T=UNIT_TYPES[u.d.type]||{};const o=u.order;
    if(T.heal){u.hcd=(u.hcd||0)-dt;if(u.hcd<=0){u.hcd=4;const M=hamMax();if(CH.hp<M.h&&Math.hypot(play.x-u.x,play.z-u.z)<T.range){CH.hp=Math.min(M.h,CH.hp+T.heal);if(u.obj.userData.mixer)toonOneShot(u.obj,'cast')}
      units.forEach(v=>{const mx=(UNIT_TYPES[v.d.type]||{}).hp||v.d.maxHp||500;if(v.d.hp<mx&&Math.hypot(v.x-u.x,v.z-u.z)<T.range)v.d.hp=Math.min(mx,v.d.hp+T.heal)})}}
    if(o.kind==='attack'&&o.p&&!o.p.dead){unitAttack(u,o.p,dt,targetPos(o.p))}
    else{if(o.kind==='attack')u.order=o.prev||{kind:'follow'};
      const foe=o.kind!=='move'&&(combat.p&&!combat.p.dead&&combat.p.g.kind!=='friendly'?{p:combat.p,pos:targetPos(combat.p)}:o.kind!=='hold'?hostilesNear(u.x,u.z,18)[0]:null);
      if(foe&&(o.kind!=='hold'||Math.hypot(foe.pos.x-u.x,foe.pos.z-u.z)<((T.range||4)+1)))unitAttack(u,foe.p,dt,foe.pos);
      else if(o.kind==='move'){if(moveUnit(u,o.x,o.z,dt))u.order={kind:'hold',x:o.x,z:o.z}}
      else if(o.kind==='follow'){const a=play.yaw+(i-(units.length-1)/2)*.6,r=3+Math.floor(i/5)*2;moveUnit(u,play.x+Math.sin(a)*r,play.z-Math.cos(a)*r,dt,1.2)}
      else u.moving=0}
    // cantina heals units
    if(st.some(s=>s.type==='cantina'&&Math.hypot(s.x-u.x,s.z-u.z)<30)){const mx=(T.hp||u.d.maxHp||500);u.d.hp=Math.min(mx,u.d.hp+mx*.02*dt)}
    const gy=groundH(groundWorld,u.x,u.z);u.obj.position.set(u.x,gy,-u.z);u.obj.rotation.y=u.yaw+(u.d.spec?0:Math.PI);
    if(u.obj.userData.toon)animateAny(u.obj,now()*7,u.moving);else if(u.obj.userData.mixer&&u.obj.userData.acts){const A=u.obj.userData.acts,want=u.moving?A.walk:A.idle;if(u.cur!==want){if(u.cur)u.cur.fadeOut(.2);want.reset().fadeIn(.2).play();u.cur=want}u.obj.userData.mixer.update(dt)}
    else if(u.obj.userData.toonObj)animateAny(u.obj.userData.toonObj,now()*7,u.moving)})}
// structures
function drawStructures(){structGroup.clear();if(!CH||!groundWorld)return;if(!structGroup.parent)G.ground.add(structGroup);
  for(const s of structsHere()){const T=STRUCT_TYPES[s.type],proto=kitProtoCache[T.k];let g;if(proto){g=new THREE.Group();for(const p of proto.parts){const m=new THREE.Mesh(p.geo,p.mat);m.applyMatrix4(p.m);g.add(m)}g.scale.setScalar(T.size/Math.max(proto.size.x,proto.size.z))}
    else{g=new THREE.Mesh(new THREE.BoxGeometry(T.size,T.size*.6,T.size),new THREE.MeshLambertMaterial({color:0xb9a98c}));g.position.y=T.size*.3;const w=new THREE.Group();w.add(g);g=w}
    g.position.set(s.x,groundH(groundWorld,s.x,s.z),-s.z);g.rotation.y=s.yaw||0;g.userData.struct=s;structGroup.add(g)}}
const tracers=[];
function tickStructures(dt){const st=structsHere();if(!st.length)return;for(const s of st){if(s.type==='turret'){s._cd=(s._cd||0)-dt;if(s._cd<=0){const f=hostilesNear(s.x,s.z,40)[0];if(f){s._cd=1.5;npcStats(f.p);const dmg=60+Math.round(Math.random()*30);f.p.g.hp-=dmg;
        const gy=groundH(groundWorld,s.x,s.z),fy=groundH(groundWorld,f.pos.x,f.pos.z);const ln=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new V3(s.x,gy+9,-s.z),new V3(f.pos.x,fy+1.2,-f.pos.z)]),new THREE.LineBasicMaterial({color:0xff6b4a,transparent:true}));G.ground.add(ln);tracers.push({ln,t:.25});
        if(f.p.g.hp<=0){mmLog(`Your turret destroyed ${f.p.g.name}`,'combat');killNpc(f.p)}}else s._cd=.8}}
    if(s.type==='cantina'&&Math.hypot(s.x-play.x,s.z-play.z)<30){const M=hamMax();CH.hp=Math.min(M.h,CH.hp+M.h*.03*dt)}}
  for(let i=tracers.length-1;i>=0;i--){tracers[i].t-=dt;tracers[i].ln.material.opacity=Math.max(0,tracers[i].t*4);if(tracers[i].t<=0){G.ground.remove(tracers[i].ln);tracers.splice(i,1)}}}
function factoryGoods(s){return Math.min(2000,Math.floor((Date.now()-(s.collected||s.built))/36e5*90))}
// command-mode camera, selection and orders
function rtsToggle(on=!rts.on){if(on&&(level!=='ground'||groundMode!=='play'||!CH))return;rts.on=on;if(on){setMouselook(false);rts.x=play.x;rts.z=play.z;rts.yaw=play.camYaw;rts.dist=110;mmLog('Command mode: drag to select units, right-click to move or attack, W A S D to pan, B to return.','sys')}
  else{rts.placing=null;if(rts.ghost){G.ground.remove(rts.ghost);rts.ghost=null}rts.selStruct=null}$('#mmCmd').hidden=!on;document.body.classList.toggle('mm-rts',on);renderCmd();mmHud()}
function rtsCamera(dt){const sp=rts.dist*.9*dt,f={x:-Math.sin(rts.yaw),z:Math.cos(rts.yaw)},r={x:Math.cos(rts.yaw),z:Math.sin(rts.yaw)};
  if(keys.has('w')||keys.has('arrowup')){rts.x+=f.x*sp;rts.z+=f.z*sp}if(keys.has('s')||keys.has('arrowdown')){rts.x-=f.x*sp;rts.z-=f.z*sp}
  if(keys.has('d')||keys.has('arrowright')){rts.x+=r.x*sp;rts.z+=r.z*sp}if(keys.has('a')||keys.has('arrowleft')){rts.x-=r.x*sp;rts.z-=r.z*sp}if(keys.has('q'))rts.yaw+=dt*1.5;if(keys.has('e'))rts.yaw-=dt*1.5;
  rts.x=Math.max(-HALF,Math.min(HALF,rts.x));rts.z=Math.max(-HALF,Math.min(HALF,rts.z));const gy=groundH(groundWorld,rts.x,rts.z),pitch=1.0;
  cam.position.set(rts.x+Math.sin(rts.yaw)*Math.cos(pitch)*rts.dist,gy+Math.sin(pitch)*rts.dist,-rts.z+Math.cos(rts.yaw)*Math.cos(pitch)*rts.dist);cam.lookAt(rts.x,gy,-rts.z)}
function groundPick(cx,cy){ndc.set(cx/innerWidth*2-1,-(cy/innerHeight)*2+1);ray.setFromCamera(ndc,cam);const o=ray.ray.origin,d=ray.ray.direction;let t=0;
  for(let i=0;i<1600;i++){t+=i<200?1:4;const x=o.x+d.x*t,y=o.y+d.y*t,z=-(o.z+d.z*t);if(y<groundH(groundWorld,x,z))return{x,z}}return null}
function screenOf(x,y,z){const v=new V3(x,y,-z).project(cam);return{x:(v.x*.5+.5)*innerWidth,y:(-v.y*.5+.5)*innerHeight,ok:v.z<1}}
const boxEl=document.createElement('div');boxEl.className='mm-selbox';boxEl.hidden=true;document.body.append(boxEl);
canvas.addEventListener('pointerdown',e=>{if(!rts.on||e.button!==0)return;rts.box={x:e.clientX,y:e.clientY,x2:e.clientX,y2:e.clientY}});
addEventListener('pointermove',e=>{if(!rts.on)return;if(rts.box){rts.box.x2=e.clientX;rts.box.y2=e.clientY;const b=rts.box;Object.assign(boxEl.style,{left:Math.min(b.x,b.x2)+'px',top:Math.min(b.y,b.y2)+'px',width:Math.abs(b.x2-b.x)+'px',height:Math.abs(b.y2-b.y)+'px'});boxEl.hidden=Math.abs(b.x2-b.x)+Math.abs(b.y2-b.y)<8}
  if(rts.placing&&e.target===canvas){const g=groundPick(e.clientX,e.clientY);if(g&&rts.ghost){rts.ghost.position.set(g.x,groundH(groundWorld,g.x,g.z),-g.z);rts.ghost.userData.at=g}}});
addEventListener('pointerup',e=>{if(!rts.on||!rts.box)return;const b=rts.box;rts.box=null;boxEl.hidden=true;if(Math.abs(b.x2-b.x)+Math.abs(b.y2-b.y)<8)return;
  const x0=Math.min(b.x,b.x2),x1=Math.max(b.x,b.x2),y0=Math.min(b.y,b.y2),y1=Math.max(b.y,b.y2);if(!e.shiftKey)rts.sel.clear();rts.selStruct=null;
  for(const u of units){const s=screenOf(u.x,groundH(groundWorld,u.x,u.z)+1,u.z);if(s.ok&&s.x>=x0&&s.x<=x1&&s.y>=y0&&s.y<=y1)rts.sel.add(u)}renderCmd()});
function rtsClick(cx,cy,shift){if(rts.placing){const at=rts.ghost&&rts.ghost.userData.at;if(at)placeStructure(rts.placing,at);return}
  let best=null,bd=28;for(const u of units){const s=screenOf(u.x,groundH(groundWorld,u.x,u.z)+1,u.z);const d=Math.hypot(s.x-cx,s.y-cy);if(s.ok&&d<bd){bd=d;best=u}}
  if(!shift)rts.sel.clear();rts.selStruct=null;if(best){rts.sel.has(best)&&shift?rts.sel.delete(best):rts.sel.add(best)}
  else{const g=groundPick(cx,cy);if(g){const s=structsHere().find(s=>Math.hypot(s.x-g.x,s.z-g.z)<STRUCT_TYPES[s.type].size*.7);if(s)rts.selStruct=s}}renderCmd()}
function rtsOrder(cx,cy){if(rts.placing){rts.placing=null;if(rts.ghost){G.ground.remove(rts.ghost);rts.ghost=null}renderCmd();return}const g=groundPick(cx,cy);if(!g||!rts.sel.size)return;
  const foe=hostilesNear(g.x,g.z,7)[0],sel=[...rts.sel];if(foe){sel.forEach(u=>u.order={kind:'attack',p:foe.p,prev:u.order.kind==='attack'?{kind:'follow'}:u.order});mmLog(`Squad: attack ${foe.p.g.name}`,'combat');return}
  sel.forEach((u,i)=>{const a=i/sel.length*TAU,r=sel.length>1?2.2+Math.floor(i/6)*2:0;u.order={kind:'move',x:g.x+Math.cos(a)*r,z:g.z+Math.sin(a)*r}});const m=new THREE.Mesh(new THREE.RingGeometry(1.2,1.8,24),new THREE.MeshBasicMaterial({color:0x6ff0ff,transparent:true,side:THREE.DoubleSide}));
  m.rotation.x=-Math.PI/2;m.position.set(g.x,groundH(groundWorld,g.x,g.z)+.3,-g.z);G.ground.add(m);tracers.push({ln:m,t:.5})}
function placeStructure(type,at){const T=STRUCT_TYPES[type];if(!reqOk(T.req))return toast(`${T.name} needs ${reqName(T.req)}.`);if(CH.credits<T.cost)return toast(`${T.name} costs ${T.cost.toLocaleString()} credits.`);
  const miss=T.res.filter(([c,n])=>Object.values(CH.inv.res).filter(r=>r.cl.includes(c)).reduce((a,r)=>a+r.units,0)<n);if(miss.length)return toast(`Missing resources: ${miss.map(([c,n])=>n+' '+c).join(', ')}.`);
  if(groundWorld.pois.some(q=>q.cat==='city'&&Math.hypot(q.x-at.x,q.z-at.z)<q.r*.6))return toast('You cannot build inside an NPC city. Build just outside it.');
  if(structsHere().some(s=>Math.hypot(s.x-at.x,s.z-at.z)<(STRUCT_TYPES[s.type].size+T.size)*.55))return toast('Too close to another of your structures.');
  for(const [c,n] of T.res){let left=n;for(const [k,r] of Object.entries(CH.inv.res).filter(([,r])=>r.cl.includes(c)).sort((a,b)=>b[1].units-a[1].units)){const take=Math.min(left,r.units);r.units-=take;left-=take;if(r.units<=0)delete CH.inv.res[k];if(!left)break}}
  CH.credits-=T.cost;CH.structures=CH.structures||[];CH.structures.push({id:'s'+Date.now().toString(36),type,planet:groundWorld.id,x:at.x,z:at.z,yaw:rts.yaw,built:Date.now()});gainXP('crafting',120,'construction');gainXP('political',type==='commandpost'?1500:150,'city building');
  markDirty();drawStructures();rts.placing=null;if(rts.ghost){G.ground.remove(rts.ghost);rts.ghost=null}mmLog(`${T.name} built.`,'sys');renderCmd();mmHud()}
function canRecruitHere(){return inCity()||structsHere().some(s=>(s.type==='barracks'||s.type==='commandpost')&&Math.hypot(s.x-play.x,s.z-play.z)<60)}
function recruit(type){const T=UNIT_TYPES[type];if(!T.req())return toast(`${T.name} needs ${T.reqText}.`);if(!canRecruitHere())return toast('Recruit in a city or near your own Barracks.');if((CH.units||[]).length>=unitCap())return toast(`Your squad is full (${unitCap()}). Barracks and Squad Leader boxes raise the limit.`);
  if(CH.credits<T.cost)return toast(`${T.name} costs ${T.cost} credits.`);CH.credits-=T.cost;const names=['Kessa','Doran','Vix','Talo','Mira','Brask','Jerec','Lysa','Okun','Rhee','Sabe','Tyr'];
  const d={id:'u'+Date.now().toString(36),type,name:`${names[Math.floor(Math.random()*names.length)]} (${T.name})`,hp:T.hp,race:CH.race};CH.units=CH.units||[];CH.units.push(d);markDirty();
  const obj=spawnUnitModel(d);if(obj){G.ground.add(obj);units.push({d,obj,x:play.x+2,z:play.z+2,yaw:0,order:{kind:'follow'},cd:0,moving:0})}mmLog(`${d.name} joins your squad.`,'sys');renderCmd();mmHud()}
function tameCreature(p){if(!(hasBox('outdoors_creaturehandler_novice')||hasBox('outdoors_scout_tools_01')))return;npcStats(p);if(p.g.hp>p.g.maxHp*.35)return toast('Weaken the creature below 35% health first.');if((CH.units||[]).length>=unitCap())return toast('Your squad is full.');
  const spec=creatureFor(p);if(!spec||spec.type==='toon')return toast('That cannot be tamed.');
  if(spec.type==='dragon'){const id=Object.keys(DRAGON_COLORS).find(k=>DRAGON_COLORS[k]===spec.color)||'ember';const own=ownedMounts();combat.p=null;p.dead=true;p.corpse=null;const i0=groundWorld.placements.indexOf(p),o0=npcToons.get(i0);if(o0){toonGroup.remove(o0);npcToons.delete(i0)}
    if(!own.includes(id))own.push(id);gainXP('trapping',400,'dragon taming');toast(`You tamed the ${p.g.name}! It joins your stable as the ${MOUNTS[id].name}. Press V to ride.`);CH.lastMount=id;markDirty();return}const d={id:'u'+Date.now().toString(36),type:'pet',name:p.g.name+' (pet)',hp:Math.round(p.g.maxHp*.8),maxHp:Math.round(p.g.maxHp*.8),dmg:Math.round(p.g.dmg*.9),tier:p.g.tier,spec};
  combat.p=null;p.dead=true;p.corpse=null;const i=groundWorld.placements.indexOf(p),obj=npcToons.get(i);if(obj){toonGroup.remove(obj);npcToons.delete(i)}setTimeout(()=>{p.dead=false;p.g.hp=p.g.maxHp},300000);
  CH.units=CH.units||[];CH.units.push(d);const m=spawnUnitModel(d);if(m){G.ground.add(m);units.push({d,obj:m,x:p.x,z:p.z,yaw:0,order:{kind:'follow'},cd:0,moving:0})}gainXP('trapping',80,'taming');toast(`You tamed ${p.g.name}.`);markDirty();mmHud()}
function renderCmd(){const el=$('#mmCmd');if(!rts.on){el.hidden=true;return}el.hidden=false;const sel=[...rts.sel],s=rts.selStruct;
  const tab=renderCmd.tab||'squad';
  el.innerHTML=`<nav><button data-tab="squad" aria-pressed="${tab==='squad'}">Squad ${units.length}/${unitCap()}</button><button data-tab="build" aria-pressed="${tab==='build'}">Build</button><button data-tab="recruit" aria-pressed="${tab==='recruit'}">Recruit</button><button data-x>Exit (B)</button></nav>
   ${tab==='squad'?`<div class="mm-units">${units.map((u,i)=>{const mx=(UNIT_TYPES[u.d.type]||{}).hp||u.d.maxHp||500;return`<button data-u="${i}" class="${rts.sel.has(u)?'sel':''}"><b>${esc(u.d.name)}</b><span class="mm-mini"><i style="width:${100*u.d.hp/mx}%"></i></span><small>${u.order.kind}</small></button>`}).join('')||'<p class="gw-note">No units yet. Recruit troopers in a city or at your Barracks, or tame a weakened creature with Scout Trapping or Creature Handler.</p>'}</div>
     <div class="acts">${sel.length?`<button class="btn" data-o="follow">Follow me</button><button class="btn" data-o="hold">Hold</button><button class="btn" data-o="attack">Attack my target</button><button class="btn danger" data-o="dismiss">Dismiss</button>`:'<small>Select units: click, drag a box, or pick from the list. Right-click ground to move, an enemy to attack.</small>'}<button class="btn" data-o="all">Select all</button></div>`:''}
   ${tab==='build'?`<ul class="gw-list">${Object.entries(STRUCT_TYPES).map(([k,T])=>{const ok=reqOk(T.req);return`<li class="${ok?'':'locked'}"><span><b>${T.name}</b> <small>${T.fx}</small></span><small>${T.cost.toLocaleString()} cr · ${T.res.map(([c,n])=>n+' '+c).join(', ')}${ok?'':' · needs '+esc(reqName(T.req))}</small><span></span>${ok?`<button class="btn mini primary" data-b="${k}">Place</button>`:''}</li>`}).join('')}</ul>${rts.placing?'<p class="gw-note">Click the ground to place it. Right-click to cancel.</p>':''}`:''}
   ${tab==='recruit'?`<p class="gw-note">${canRecruitHere()?'Recruiters are available here.':'Walk into a city or next to your Barracks to recruit.'}</p><ul class="gw-list">${Object.entries(UNIT_TYPES).map(([k,T])=>{const ok=T.req();return`<li class="${ok?'':'locked'}"><span><b>${T.name}</b> <small>${T.hp} health · ${T.heal?'heals '+T.heal:T.dmg+' damage'} · ${T.range>6?'ranged':'melee'}</small></span><small>${T.cost} cr${ok?'':' · needs '+T.reqText}</small><span></span>${ok?`<button class="btn mini primary" data-r="${k}">Recruit</button>`:''}</li>`}).join('')}</ul>`:''}
   ${s?`<div class="mm-struct"><b>${STRUCT_TYPES[s.type].name}</b><small>${STRUCT_TYPES[s.type].fx}</small><div class="acts">${s.type==='factory'?`<button class="btn primary" data-sc>Collect ${factoryGoods(s)} cr</button>`:''}<button class="btn danger" data-sd>Demolish</button></div></div>`:''}`;
  el.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{renderCmd.tab=b.dataset.tab;renderCmd()});el.querySelector('[data-x]').onclick=()=>rtsToggle(false);
  el.querySelectorAll('[data-u]').forEach(b=>b.onclick=e=>{const u=units[+b.dataset.u];if(!e.shiftKey)rts.sel.clear();rts.sel.add(u);rts.x=u.x;rts.z=u.z;renderCmd()});
  el.querySelectorAll('[data-o]').forEach(b=>b.onclick=()=>{const o=b.dataset.o;if(o==='all'){units.forEach(u=>rts.sel.add(u));return renderCmd()}
    for(const u of sel){if(o==='follow')u.order={kind:'follow'};else if(o==='hold')u.order={kind:'hold'};else if(o==='attack'){const p=currentTarget();if(p&&p.g.kind!=='friendly')u.order={kind:'attack',p,prev:{kind:'follow'}}}
      else if(o==='dismiss'){G.ground.remove(u.obj);units=units.filter(x=>x!==u);CH.units=CH.units.filter(x=>x!==u.d);rts.sel.delete(u);markDirty()}}renderCmd()});
  el.querySelectorAll('[data-b]').forEach(b=>b.onclick=()=>{const T=STRUCT_TYPES[b.dataset.b];rts.placing=b.dataset.b;if(rts.ghost)G.ground.remove(rts.ghost);rts.ghost=new THREE.Mesh(new THREE.BoxGeometry(T.size,T.size*.5,T.size),new THREE.MeshBasicMaterial({color:0x6ff0ff,transparent:true,opacity:.35,depthWrite:false}));G.ground.add(rts.ghost);renderCmd()});
  el.querySelectorAll('[data-r]').forEach(b=>b.onclick=()=>recruit(b.dataset.r));
  el.querySelector('[data-sc]')&&(el.querySelector('[data-sc]').onclick=()=>{const g=factoryGoods(s);if(g<1)return toast('Nothing produced yet.');CH.credits+=g;s.collected=Date.now();gainXP('crafting',Math.round(g/4),'factory');markDirty();renderCmd();mmHud()});
  el.querySelector('[data-sd]')&&(el.querySelector('[data-sd]').onclick=b=>{if(!s._confirm){s._confirm=true;b.target.textContent='Click again to demolish';return}CH.structures=CH.structures.filter(x=>x!==s);rts.selStruct=null;markDirty();drawStructures();renderCmd()})}
// selection rings over selected units
const selRings=new THREE.Group();
function drawSelRings(){if(!selRings.parent)G.ground.add(selRings);selRings.clear();if(!rts.on)return;for(const u of rts.sel){const m=new THREE.Mesh(new THREE.RingGeometry(.9,1.15,20),new THREE.MeshBasicMaterial({color:0x7fe08a,side:THREE.DoubleSide}));m.rotation.x=-Math.PI/2;m.position.set(u.x,groundH(groundWorld,u.x,u.z)+.15,-u.z);selRings.add(m)}
  if(rts.selStruct){const s=rts.selStruct,T=STRUCT_TYPES[s.type],m=new THREE.Mesh(new THREE.RingGeometry(T.size*.62,T.size*.68,40),new THREE.MeshBasicMaterial({color:0xf2b04a,side:THREE.DoubleSide}));m.rotation.x=-Math.PI/2;m.position.set(s.x,groundH(groundWorld,s.x,s.z)+.2,-s.z);selRings.add(m)}}

/* ---------------- intro and planet select ---------------- */
const intro=document.createElement('section');intro.id='intro';intro.setAttribute('aria-label','Game intro');
intro.innerHTML=`<div class="in-inner"><p class="in-eyebrow">Grudge Studio presents</p><h1>Grudge <span>Galaxies</span></h1><p class="in-sub">A sandbox MMO across a living galaxy of worlds: survey, build, craft and fight your way across thirteen planets.</p>
  <div class="in-prologue" id="inPro" aria-live="polite"></div>
  <div class="in-acts"><button class="btn primary" id="inPlay">Play</button><button class="btn" id="inNew">New character</button><button class="btn" id="inLoad">Load game file</button><button class="btn" id="inAtlas">Explore the atlas</button></div>
  <small class="in-foot">Right-click: mouselook · WASD move · 1–0 abilities · B command mode · Enter chat</small><input type="file" id="inFile" accept=".json,application/json" hidden></div>`;
document.body.append(intro);
const PROLOGUE=['Ten worlds. Thirty-four professions. One economy that runs on what players gather, build and trade.','Survey the land, raise harvesters, craft the gear that warlords carry into battle.','Lead squads, found cities, ride the great glow whales between the stars.','Your story starts at a starport.'];
let proI=0,proT=null;function cyclePro(){const el=$('#inPro');if(!el)return;el.classList.remove('show');setTimeout(()=>{el.textContent=PROLOGUE[proI++%PROLOGUE.length];el.classList.add('show')},400)}
cyclePro();proT=setInterval(cyclePro,4800);
function closeIntro(){intro.hidden=true;clearInterval(proT)}
$('#inPlay').onclick=()=>{closeIntro();openWin('chars')};$('#inNew').onclick=()=>{closeIntro();creating=true;openCreator()};$('#inAtlas').onclick=()=>closeIntro();$('#inLoad').onclick=()=>$('#inFile').click();
$('#inFile').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;const n=await importSave(f);if(n){closeIntro();openWin('chars')}};
const psel=document.createElement('section');psel.id='psel';psel.hidden=true;psel.setAttribute('role','dialog');psel.setAttribute('aria-label','Choose a planet');document.body.append(psel);
function planetThumb(w,size=120){const cv=document.createElement('canvas');cv.width=cv.height=size;const x=cv.getContext('2d'),S=w.surf||{},R=mulberry(w.seed||1),r=size/2-4;
  const base=col((S.aridity||0)>.5?S.sand||'#c8b080':S.grass||S.soil||'#5a7a40');x.save();x.beginPath();x.arc(size/2,size/2,r,0,TAU);x.clip();x.fillStyle='#'+base.getHexString();x.fillRect(0,0,size,size);
  const blot=(c,n,s)=>{if(!c)return;x.fillStyle=c;for(let i=0;i<n;i++){x.globalAlpha=.35+R()*.4;x.beginPath();x.ellipse(R()*size,R()*size,s*(.4+R()),s*(.2+R()*.5),R()*3,0,TAU);x.fill()}x.globalAlpha=1};
  blot(S.rock,6,size*.12);blot(S.meadow,5,size*.14);blot(S.water,(S.aridity||0)>.5?1:6,size*.16);blot(S.snow,2,size*.1);blot(S.lava,3,size*.08);
  const g=x.createRadialGradient(size*.35,size*.3,size*.05,size/2,size/2,r*1.05);g.addColorStop(0,'rgba(255,255,255,.28)');g.addColorStop(.55,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,.7)');x.fillStyle=g;x.fillRect(0,0,size,size);x.restore();
  x.strokeStyle='rgba(160,210,255,.35)';x.lineWidth=2;x.beginPath();x.arc(size/2,size/2,r+1,0,TAU);x.stroke();return cv}
function openPlanetSelect(c){closeWin();psel.hidden=false;const here=WORLDS.find(w=>w.id===c.planet);
  psel.innerHTML=`<div class="ps-card"><header><div><p class="in-eyebrow">${esc(c.name)} · ${esc((RACE[c.race]||{}).name||'')} ${esc((CLASS[c.cls]||{}).name||'')}</p><h2>Choose a planet</h2></div><button class="x" id="psX" aria-label="Close">×</button></header>
   ${here?`<button class="ps-continue" id="psGo"><b>Continue on ${esc(planetName(here))}</b><small>Where you logged out</small></button>`:''}
   <div class="ps-grid">${WORLDS.map(w=>{const tps=travelPoints(w);return`<div class="ps-planet" data-w="${w.id}"><div class="ps-thumb"></div><b>${esc(planetName(w))}</b><small>${w.pois.filter(q=>q.cat==='city').length} cities · ${tps.length} ports</small>
     <select aria-label="Arrive at">${tps.length?tps.map((t,i)=>`<option value="${i}">${t.star?'Starport':'Shuttleport'}: ${esc(t.name)}</option>`).join(''):w.pois.filter(q=>q.cat==='city').slice(0,8).map(q=>`<option value="c${w.pois.indexOf(q)}">${esc(q.name)}</option>`).join('')||'<option value="p0">Landing zone</option>'}</select>
     <button class="btn primary">Travel</button></div>`}).join('')}</div></div>`;
  psel.querySelectorAll('.ps-planet').forEach(el=>{const w=WORLDS.find(x=>x.id===el.dataset.w);el.querySelector('.ps-thumb').append(planetThumb(w));
    el.querySelector('button').onclick=()=>{const v=el.querySelector('select').value;let at;if(/^c/.test(v)){const q=w.pois[+v.slice(1)];at={x:q.x+8,z:q.z+8}}else if(/^p/.test(v)){const q=w.pois[0]||{x:0,z:0};at={x:q.x,z:q.z}}else{const t=travelPoints(w)[+v];at={x:t.x+10,z:t.z+6}}
      c.planet=w.id;c.pos=at;psel.hidden=true;playCharacter(c)}});
  $('#psGo')&&($('#psGo').onclick=()=>{psel.hidden=true;playCharacter(c)});$('#psX').onclick=()=>{psel.hidden=true;openWin('chars')}}

/* ---------------- game files: export and import saves ---------------- */
async function exportSave(){await storeReady;const chars=await Store.list();const data=JSON.stringify({format:'grudge-galaxies-save',version:1,saved:new Date().toISOString(),characters:chars},null,1);
  const dl=window.claude&&window.claude.use?await window.claude.use('downloads').catch(()=>null):null;if(!dl)return toast('Saving files is not available in this view.');
  try{await dl.save({filename:'grudge-galaxies-save.json',data});toast(`Saved ${chars.length} character${chars.length===1?'':'s'} to a game file.`)}catch(e){if(e&&e.code!=='declined')toast('The game file could not be saved here.')}}
async function importSave(file){try{const j=JSON.parse(await file.text());const list=Array.isArray(j)?j:j.characters;if(!Array.isArray(list)||!list.length)throw new Error('no characters');await storeReady;let n=0;
    for(const c of list){if(!c||typeof c!=='object'||typeof c.name!=='string'||!RACE[c.race])continue;c.id=c.id||('c'+Date.now().toString(36)+n);c.inv=c.inv||{res:{},items:[]};c.pos=c.pos||{x:0,z:0};c.planet=c.planet||WORLDS[0].id;migrate(c);await Store.save(c);n++}
    toast(n?`Loaded ${n} character${n===1?'':'s'} from the game file.`:'That file had no characters this game can read.');return n}catch(e){toast('That is not a Grudge Galaxies game file.');return 0}}
function mmMenuExtras(B){const d=document.createElement('div');d.className='gw-menu';d.innerHTML=`<h3>Game files</h3><p class="gw-note">Save every character to a file you keep, or load one back in on any device.</p><div class="gw-set"><button class="btn" id="mxExp">Export game file</button><button class="btn" id="mxImp">Import game file</button><button class="btn" id="mxIntro">Title screen</button></div><input type="file" id="mxFile" accept=".json,application/json" hidden>`;B.append(d);
  $('#mxExp').onclick=exportSave;$('#mxImp').onclick=()=>$('#mxFile').click();$('#mxFile').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(f&&await importSave(f))openWin('chars')};
  $('#mxIntro').onclick=()=>{closeWin();if(groundMode==='play')exitPlay();intro.hidden=false;cyclePro();clearInterval(proT);proT=setInterval(cyclePro,4800)}}

/* ================= Animation library: 61 baked Mixamo clips on every Grudge race (class combat, emotes, NPC idles, jumps, strafes) ================= */
Object.assign(CLASS_ANIM,{warrior:{atk:['attackShield','attack1h','snsAtk','combo1'],idle:'idle'},raider:{atk:['attack2h','club','sword2h','spin'],idle:'idle'},
  thief:{atk:['slash','dual','backhand','attack1h'],idle:'idle'},worge:{atk:['club','chop','club1h','kick'],idle:'idle'},ranger:{atk:['chop','slash','kick2','throw'],idle:'idle'},
  mage:{atk:['cast','cast3','cast2','castArea'],idle:'idle'},priest:{atk:['cast2','channel','cast2h','snsCast'],idle:'idle'},verduror:{atk:['channel','cast4','cast','castArea2'],idle:'idle'}});
const ATTACK_STATES=/attack|slash|chop|club|cast|channel|combo|spin|kick|dual|sns|backhand|throw|leap|sword2h|power|stagger|chest|taunt|Shoot|Fire|Reload|punch|dodge|vault|Flip/;
const ABIL_ANIM={power:'leapAtk',intimidate:'chest',berserk:'powerUp',aimed:'cast',headshot:'cast4',suppress:'castArea',heal:'cast2h',stim:'channel',dash:'taunt',camp:'crouch',rally:'chest',inspire:'bboy'};
function abilAnim(a){if(!a)return null;if(ABIL_ANIM[a.id])return ABIL_ANIM[a.id];if(/^elite_/.test(a.id))return a.hit&&a.hit.range?'castArea2':'combo2';return null}
// emotes: chat command -> clip
Object.assign(EMOTES,{point:'points',pat:'pats a friend on the shoulder',look:'looks around warily',crouch:'crouches low',flex:'powers up',chest:'thumps their chest',
  throw:'skips a stone',kick:'kicks the dirt',jump:'jumps',bboy:'breaks out some moves',runningman:'does the running man',spin:'busts a spin',cheer:'cheers',salute:'salutes'});
const EMOTE_CLIP={wave:'pointing',point:'pointing',pat:'patting',look:'lookAround',crouch:'crouch',flex:'powerUp',chest:'chest',throw:'throw',kick:'kick',jump:'jump',bboy:'bboy',runningman:'runningMan',spin:'soulSpin',cheer:'taunt',salute:'look1'};
const DANCES=['dance','dance2','bboy','runningMan','soulSpin'];
{const _tos=toonOneShot;toonOneShot=function(inst,kind){if(!inst||!inst.userData.mixer)return;const u=inst.userData;kind=EMOTE_CLIP[kind]||kind;
  if(kind==='dance')return toonPlay(inst,DANCES[Math.random()*DANCES.length|0],.3,{once:true,hold:10});
  if(kind==='crouch')return toonPlay(inst,'crouch',.3,{once:true,hold:1e9});
  if(kind==='hit'){if(u.once>0&&!/^hit/.test(u.state||''))return;return toonPlay(inst,u.blocking?'blockHit':['hit','hitL','hitR'][Math.random()*3|0],.1,{once:true,hold:.9,speed:1.3})}
  if(kind==='attack'||kind==='sit'||!u.clips[kind])return _tos(inst,kind);
  return toonPlay(inst,kind,.15,{once:true,speed:ATTACK_STATES.test(kind)?1.15:1})}}
// locomotion picks back-pedal and strafe clips while aiming
function locoClip(u,amt){if(amt<=0)return'idle';const d=u.dir;if(d==='back'&&u.clips.walkBack)return amt>1.5?'runBack':'walkBack';if(d==='left'&&u.clips.strafeL)return'strafeL';if(d==='right'&&u.clips.strafeR)return'strafeR';return amt>1.5?'run':'walk'}
// NPC idle flavour: guards look around and thump their chests, townsfolk chat, point and sit, bards dance, everyone dances at night
function npcIdleAnim(u,ai,dt,kind,role){const o=u.toonObj;if(!o||!o.userData.mixer)return;ai.idleT=(ai.idleT??(2+Math.random()*8))-dt;if(ai.idleT>0||o.userData.once>0)return;ai.idleT=7+Math.random()*12;
  const night=isNight();let L;
  if(role==='Bard')L=DANCES;else if(kind==='guard')L=['look2','lookAround','chest','look1','look2'];
  else if(kind==='gather')L=night&&Math.random()<.4?DANCES:['patting','pointing','lookAround','taunt','look1'];
  else if(kind==='rest')L=night?['sit','crouch','look1']:['lookAround','look1','crouch'];else L=['look1','lookAround','look2'];
  const k=L[Math.random()*L.length|0];if(k==='sit'||k==='crouch'){toonPlay(o,k,.4,{once:true,hold:6+Math.random()*8});return}
  toonPlay(o,k,.3,{once:true,hold:DANCES.includes(k)?8+Math.random()*6:0})}
// jumping on foot (Space)
addEventListener('keydown',e=>{if(e.key!==' '||e.repeat||/INPUT|TEXTAREA/.test(e.target.tagName))return;if(level!=='ground'||groundMode!=='play'||!CH||play.mount||rts.on)return;
  if((play.jy||0)>0||play.jq)return;const runJ=play.moving>1;if(play.model)toonOneShot(play.model,runJ?'jumpRun':'jump');play.jq=runJ?.08:.42;e.preventDefault()});
{const _up=updatePlay;updatePlay=function(dt){_up(dt);if(!play.model||rts.on)return;const u=play.model.userData;
  // direction for strafe/back clips
  const ml=typeof mouselook!=='undefined'&&mouselook||combat.p,fz=(keys.has('w')||keys.has('arrowup')?1:0)-(keys.has('s')||keys.has('arrowdown')?1:0),fx=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0);
  u.dir=ml&&!play.mount?(fz<0&&!fx?'back':!fz&&fx<0?'left':!fz&&fx>0?'right':''):'';
  if(play.jq){play.jq-=dt;if(play.jq<=0){play.jq=0;play.jv=7.2;play.jy=.01}}
  if(play.jy>0){play.jv-=22*dt;play.jy=Math.max(0,play.jy+play.jv*dt);play.model.position.y+=play.jy}}}

/* ================= Codex: factions, ranks, the nine realms, bestiary and the chronicle of the First Grudge ================= */
const FACTION_LORE={crusade:{emblem:'⚔',lore:'United under the banner of Odin, the Crusade marches with righteous fury. Humans bring adaptability and cunning, while Barbarians unleash primal rage upon their enemies.',
    ranks:['Squire','Crusader','Templar','Paladin','Champion of Odin'],seat:'Haven Shore, Stormbreak Reef, Ashen Wastes'},
  legion:{emblem:'☠',lore:"Madra's Legion thrives on destruction. Orcs crush their foes with brute strength while the Undead overwhelm with dark sorcery and sheer persistence beyond death.",
    ranks:['Grunt','Reaver','Warbringer','Blood Lord','Hand of Madra'],seat:'Ember Depths, Abyssal Trench'},
  fabled:{emblem:'✦',lore:'The eldest alliance, guided by the mysterious Omni. Elves wield arcane mastery while Dwarves provide unbreakable fortitude and legendary forge-craft.',
    ranks:['Seeker','Warden','Loremaster','Archon','Voice of the Omni'],seat:'Frostbite Expanse, Thornwood Wilds, Ethereal Falls'}};
function factionRank(fid,v){const R=(FACTION_LORE[fid]||{}).ranks;if(!R)return'';if(v<100)return v<=-1000?'Enemy':'Outsider';return R[v>=4000?4:v>=2500?3:v>=1200?2:v>=500?1:0]}
const CHRONICLE=[
 ['The First Grudge','Before the realms had names, three powers shared one world: Odin of the storm-fields, Madra of the deep fire, and the Omni, who was everywhere and nowhere. A single broken oath between them split the world into nine shards. The scholars call it the First Grudge; the warlords just call it the reason.'],
 ['The Three Banners','Odin gathered humans and barbarians into the Crusade. Madra raised orcs from the calderas and called the dead back from the trench to form the Legion. The Omni spoke to elves and dwarves in dreams, and the Fabled answered. Every war since has been the same war.'],
 ['The Nine Realms','The shards settled into a ring around the Convergence Nexus. Haven Shore drifted south, warm and lawful, and became where every warlord starts. The Fabled hold the frozen and forested north, the Legion the fire and the deep, and the Crusade the storm coast and the glass desert.'],
 ["Racalvin's Vault","At the heart of the Nexus lies a vault no faction built. Its keeper, the Herald of First Grudge, is said to remember the oath that was broken. Whoever opens the vault may learn which of the three patrons lied, and the war would end, or begin again in earnest."],
 ['The Galaxy Beyond','Glow whales carry warlords between the old star worlds and the nine realms. Starports on every capital dock them, and portal rings open where the whales have sung long enough. The sandbox is wide: harvest, craft, build, and choose who to hold a grudge against.']];
let codexTab='factions',codexRealm='haven_shore',codexWorld=null;
function winCodex(B){if(groundWorld&&groundWorld!==codexWorld){codexWorld=groundWorld;if(REALM[groundWorld.id])codexRealm=groundWorld.id}$('#gwTitle').textContent='Codex';
  B.innerHTML=`<div class="bk-head"><nav>${[['factions','Factions'],['bestiary','Bestiary'],['lore','Chronicle']].map(([k,l])=>`<button data-cx="${k}" aria-pressed="${codexTab===k}">${l}</button>`).join('')}</nav></div><div id="cxPage" class="cx-page"></div>`;
  B.querySelectorAll('[data-cx]').forEach(b=>b.onclick=()=>{codexTab=b.dataset.cx;renderWin()});const P=$('#cxPage'),mine=typeof playerFaction==='function'?playerFaction():null;
  if(codexTab==='factions'){P.innerHTML=`<div class="cx-facs">${GD.factions.map(f=>{const L=FACTION_LORE[f.id]||{},v=CH?standing(f.id):0,pct=(v+5000)/100,races=GD.races.filter(r=>r.faction===f.id).map(r=>r.name).join(' · ');
      return`<article class="cx-fac${f.id===mine?' mine':''}" style="--fc:${f.color}"><header><span class="cx-em">${L.emblem||'◆'}</span><div><h3>${esc(f.name)}${f.id===mine?' <small>your banner</small>':''}</h3><small>Patron ${esc(f.patron||'')} · ${esc(races)}</small></div></header>
        <p>${esc(L.lore||f.description||'')}</p><dl><dt>Holds</dt><dd>${esc(L.seat||'')}</dd><dt>Sworn rival</dt><dd>${esc((FACTION[RIVAL[f.id]]||{name:'none'}).name)}</dd></dl>
        ${CH?`<div class="cx-stand" data-tip-h="Standing" data-tip="${v} of 5000. Kill the faction's enemies, finish its missions and defend its cities to rise."><i style="width:${pct}%"></i><b style="left:50%"></b></div><div class="cx-rank"><b>${esc(factionRank(f.id,v))}</b><small>${esc(standingWord(v))} · ${v>0?'+':''}${v}</small></div>
        <ol class="cx-ranks">${(L.ranks||[]).map((r,i)=>`<li class="${v>=[100,500,1200,2500,4000][i]?'got':''}">${esc(r)}<small>${[100,500,1200,2500,4000][i]}</small></li>`).join('')}</ol>`:'<p class="gw-note">Create a warlord to earn standing.</p>'}</article>`}).join('')}</div>`;return}
  if(codexTab==='realms'){const R=REALM[codexRealm]||REALMS[0],grid=[...REALMS].sort((a,b)=>a.grid[1]-b.grid[1]||a.grid[0]-b.grid[0]),w=WORLDS.find(x=>x.id===R.id),ev=w?realmEvent(w):null,here=groundMode==='play'&&nearTravel();
    const fc=R.faction?FACTION[R.faction]:null,caps=w?w.pois.filter(q=>q.cat==='city'):[],dg=w?w.pois.filter(q=>q.dungeon):[];
    P.innerHTML=`<div class="cx-realms"><div class="cx-map" aria-label="Realm map">${grid.map(r=>{const f=r.faction?FACTION[r.faction]:null;return`<button data-rl="${r.id}" aria-pressed="${r.id===R.id}" style="--rg:${(BIOMES[r.globe]||{}).glow||'#888'};--fc:${f?f.color:'#bbb'}"><b>${esc(r.name)}</b><small>${r.safe?'Safe · ':r.contested?'Contested · ':''}Lv ${r.diff[0]}–${r.diff[1]}</small></button>`}).join('')}</div>
      <section class="cx-detail"><h3>${esc(R.name)} <small>${fc?esc(fc.name):'Contested by all three'} · tier ${R.diff[0]}–${R.diff[1]}${groundWorld===w?' · you are here':''}</small></h3>
        <p class="cx-quote">${esc(R.lore)}</p>
        <dl><dt>Regions</dt><dd>${R.regions.map(x=>esc(x[1])).join(' · ')}</dd><dt>Settlements</dt><dd>${caps.map(q=>`${esc(q.name)}${q.sub?` <small>${esc(q.sub)}</small>`:''}`).join('<br>')||'—'}</dd>
        <dt>Dungeons</dt><dd>${dg.map(q=>`${esc(q.name)} <small>boss: ${esc(q.boss)} · tier ${q.minTier}${CH&&(CH.bossKills||[]).includes(q.boss)?' · defeated':''}</small>`).join('<br>')||'None charted'}</dd>
        <dt>Resources</dt><dd>${R.res.map(esc).join(' · ')}</dd><dt>Events</dt><dd>${R.events.map(e=>`${esc(e.name)} <small>${esc(e.sched.replace('_',' '))}${ev===e?' · active now':''}</small>`).join('<br>')||'—'}</dd></dl>
        ${here&&here.star&&w&&w!==groundWorld?`<button class="btn primary" id="cxGo">Ride a glow whale here · 600 credits</button>`:`<p class="gw-note">${w===groundWorld?'You are in this realm.':'Board a glow whale at any starport to travel here.'}</p>`}</section></div>`;
    P.querySelectorAll('[data-rl]').forEach(b=>b.onclick=()=>{codexRealm=b.dataset.rl;renderWin()});
    $('#cxGo')&&($('#cxGo').onclick=()=>{if(CH.credits<600)return toast('Not enough credits.');const sp=travelPoints(w).find(t=>t.star);if(!sp)return;CH.credits-=600;closeWin();whaleTo(sp)});return}
  if(codexTab==='bestiary'){const bosses=REALMS.flatMap(r=>(r.dungeons||[]).map(d=>({...d,realm:r.name}))).sort((a,b)=>a.tier-b.tier),kills=CH&&CH.bossKills||[];
    const cats=[...new Set(GD.enemies.map(e=>e.cat))],catName=c=>{const v=GD.enemyCats&&GD.enemyCats[c];return typeof v==='string'?v:v&&v.name||titleCase(c)};
    P.innerHTML=`<h3>Realm bosses <small>${kills.length} of ${bosses.length} defeated</small></h3><ul class="cx-boss">${bosses.map(b=>`<li class="${kills.includes(b.boss)?'got':''}"><b>${esc(b.boss)}</b><small>${esc(b.name)} · ${esc(b.realm)} · tier ${b.tier}</small><span>${kills.includes(b.boss)?'Defeated':'Undefeated'}</span></li>`).join('')}</ul>
      <h3>Creature families <small>where they roam</small></h3><ul class="cx-cats">${cats.map(c=>{const where=REALMS.filter(r=>r.regions.some(x=>(BIOME_MOBS[x[0]]||[]).some(m=>m[0]===c))).map(r=>r.name);const n=GD.enemies.filter(e=>e.cat===c).length;
        return`<li><b>${esc(catName(c))}</b><small>${n} kinds · ${where.length?esc(where.slice(0,4).join(', '))+(where.length>4?'…':''):'star worlds'}</small></li>`}).join('')}</ul>`;return}
  P.innerHTML=`<div class="cx-lore">${CHRONICLE.map(([h,t])=>`<section><h3>${esc(h)}</h3><p>${esc(t)}</p></section>`).join('')}</div>`}

/* ================= Fun HUD: floating combat text, nameplates with health, kill feed and streaks, zone banners, compass markers, low-health vignette ================= */
const fx3=document.createElement('div');fx3.id='fx3';fx3.setAttribute('aria-hidden','true');
fx3.innerHTML='<div id="fctL"></div><div id="npL"></div><div id="kfeed"></div><div id="zban"><b></b><small></small></div><div id="evchip" hidden></div><div id="vign"></div><div id="flash"></div>';
document.body.append(fx3);
const fctItems=[],_pv=new V3();
function fct(x,z,text,cls,h=2.6){if(!groundWorld||fctItems.length>40)return;const el=document.createElement('span');el.className='fct '+cls;el.textContent=text;$('#fctL').append(el);
  fctItems.push({el,x:x+(Math.random()-.5)*1.2,z:z+(Math.random()-.5)*1.2,y:groundH(groundWorld,x,z)+h,t:0,life:cls==='crit'||cls==='big'?1.6:1.15})}
function tickFct(dt){for(let i=fctItems.length-1;i>=0;i--){const f=fctItems[i];f.t+=dt;if(f.t>f.life){f.el.remove();fctItems.splice(i,1);continue}
  _pv.set(f.x,f.y+f.t*1.6,-f.z).project(cam);const on=_pv.z<1&&Math.abs(_pv.x)<1.2&&Math.abs(_pv.y)<1.2;f.el.hidden=!on;if(!on)continue;
  const k=f.t/f.life,sc=f.t<.12?.6+f.t/.12*.7:1.3-Math.min(.3,f.t*.6);f.el.style.transform=`translate(${(_pv.x*.5+.5)*innerWidth}px,${(-_pv.y*.5+.5)*innerHeight}px) translate(-50%,-50%) scale(${sc})`;f.el.style.opacity=k>.7?(1-k)/.3:1}}
// every combat line already goes through floatMsg: turn the numbers into floating text
{const _fm=floatMsg;floatMsg=function(t){_fm(t);if(!CH||!groundWorld||groundMode!=='play')return;let m;const tp=combat.p?targetPos(combat.p):null;
  if((m=/^(?:You hit|.+? hits) (.+?) for (\d+)/.exec(t))&&!/hits you|strikes you/.test(t)){const crit=+m[2]>charStats().dmg*1.9;const p=currentTarget(),pos=p?targetPos(p):tp;if(pos)fct(pos.x,pos.z,(crit?'✸ ':'')+m[2],crit?'crit':'out')}
  else if((m=/(?:hits|strikes) you for (\d+)/.exec(t))){fct(play.x,play.z,'-'+m[1],'in',2.2);hitPulse()}
  else if((m=/^You heal (\d+)/.exec(t)))fct(play.x,play.z,'+'+m[1],'heal',2.4);
  else if((m=/^\+(\d+) (.+?) XP/.exec(t))&&+m[1]>=5)fct(play.x,play.z,`+${m[1]} xp`,'xp',3);
  else if((m=/^Looted (\d+) credits/.exec(t)))fct(play.x,play.z,`+${m[1]} cr`,'gold',3.2);
  else if(/weakened/.test(t)&&tp)fct(tp.x,tp.z,'Weakened','status');
  else if(/out of range|cooling down|Not enough/i.test(t))fct(play.x,play.z,t.replace(/\.$/,''),'warn',2.9)}}
let pulseT=0;function hitPulse(){pulseT=.35}
// kill feed and streaks
const feed=[];let streak=0,streakT=0;
function killFeed(text,cls='kill'){const el=document.createElement('div');el.className='kf '+cls;el.textContent=text;$('#kfeed').prepend(el);feed.push({el,t:0});while($('#kfeed').children.length>5)$('#kfeed').lastChild.remove()}
{const _kn=killNpc;killNpc=function(p){const g=p.g,boss=g&&g.kind==='boss',pos=targetPos(p);_kn(p);if(!g)return;
  streak=streakT>0?streak+1:1;streakT=12;const xp=Math.round(40*g.tier*(boss?5:1));killFeed(`☠ ${g.name} · +${xp} XP`,boss?'boss':'kill');
  if(streak>=2){const word=['','','Double kill','Triple kill','Rampage','Unstoppable','Legendary'][Math.min(6,streak)];fct(play.x,play.z,word+'!','big',3.6);killFeed(`🔥 ${word} (${streak})`,'streak')}
  if(boss){zoneBanner(g.name+' falls','Boss defeated','boss');CH.bossKills=CH.bossKills||[];if(!CH.bossKills.includes(g.name)){CH.bossKills.push(g.name);markDirty()}
    const R=REALM[groundWorld.id];if(R&&R.faction)addStanding(R.faction,250,'defeated '+g.name);else if(R&&R.contested&&playerFaction())addStanding(playerFaction(),400,'defeated '+g.name)}}}
// zone banner: planet, region, settlement, dungeon
let zbT=0,zoneKey='',zoneTick=0;
function zoneBanner(title,sub,kind=''){const z=$('#zban');z.className=kind;z.querySelector('b').textContent=title;z.querySelector('small').textContent=sub;z.classList.remove('show');void z.offsetWidth;z.classList.add('show');zbT=4.2}
function tickZone(dt){zoneTick-=dt;if(zoneTick>0)return;zoneTick=1;const w=groundWorld;if(!w)return;
  const poi=w.pois.find(q=>Math.hypot(q.x-play.x,q.z-play.z)<q.r+20),b=biomeAt(w,play.x,play.z),key=w.id+'|'+(poi?'p'+poi.id:'b'+b.name);if(key===zoneKey)return;const first=!zoneKey.startsWith(w.id+'|');zoneKey=key;
  const R=REALM[w.id],fname=R?(R.faction?FACTION[R.faction].name+' territory':'Contested territory'):(FACTION[PLANET_FACTION[w.id]]||{name:''}).name+' world';
  if(first)return zoneBanner(planetName(w),(R?`Tier ${R.diff[0]}–${R.diff[1]} · `:'')+fname+(R&&R.safe?' · Safe zone':''),R&&R.contested?'pvp':'');
  if(poi){if(poi.cat==='camp')return;zoneBanner(poi.name,poi.dungeon?`Dungeon · boss ${poi.boss}`:poi.sub||CATS[poi.cat]||'',poi.dungeon?'boss':poi.cat==='military'?'pvp':'')}
  else zoneBanner(b.name,planetName(w)+' · '+fname,'region')}
// nameplates with health bars for nearby creatures and townsfolk
const npPool=[];
function tickPlates(){const L=$('#npL');let used=0;if(groundMode==='play'&&groundWorld&&!rts.on){const list=[];
  for(const [i,h] of npcToons){const p=groundWorld.placements[i];if(!p||!p.g||p.dead)continue;const pos=h.userData.pos||p,d=Math.hypot(pos.x-play.x,pos.z-play.z);if(d<42)list.push([d,p,pos])}
  list.sort((a,b)=>a[0]-b[0]);const tgt=currentTarget();
  for(const [d,p,pos] of list.slice(0,14)){const g=p.g,boss=g.kind==='boss',hy=groundH(groundWorld,pos.x,pos.z)+(boss?4.2:/dragons|trolls|titans|golems/.test(g.cat||'')?3.6:2.45);
    _pv.set(pos.x,hy,-pos.z).project(cam);if(_pv.z>=1||Math.abs(_pv.x)>1.05||Math.abs(_pv.y)>1.05)continue;
    let el=npPool[used];if(!el){el=document.createElement('div');el.className='np';el.innerHTML='<b></b><small></small><i><u></u></i>';L.append(el);npPool.push(el)}used++;
    const kind=g.kind==='friendly'?'fr':boss?'bo':'ho',hp=g.maxHp?Math.max(0,g.hp/g.maxHp):1;el.className='np '+kind+(p===tgt?' tg':'');el.hidden=false;
    el.querySelector('b').textContent=g.name;el.querySelector('small').textContent=g.kind==='friendly'?`<${g.role||'Citizen'}>`:`Tier ${g.tier}${boss?' · Boss':''}`;
    el.querySelector('i').hidden=g.kind==='friendly'&&!g.maxHp;el.querySelector('u').style.width=(hp*100)+'%';
    el.style.transform=`translate(${(_pv.x*.5+.5)*innerWidth}px,${(-_pv.y*.5+.5)*innerHeight}px) translate(-50%,-100%) scale(${Math.max(.72,1.1-d/60)})`;el.style.opacity=d>32?(42-d)/10:1}}
  for(let k=used;k<npPool.length;k++)npPool[k].hidden=true}
// compass markers for settlements, dungeons, ports and your target
{const _dc=drawCompass;drawCompass=function(){_dc();const cv=$('#mmCompass');if(!cv||hud.hidden||!groundWorld)return;const x=cv.getContext('2d'),W=cv.width,head=((-play.camYaw*180/Math.PI)%360+360)%360;
  const mark=(tx,tz,c,shape)=>{const brg=(Math.atan2(tx-play.x,tz-play.z)*180/Math.PI+360)%360,d=((brg-head+540)%360)-180;if(Math.abs(d)>88)return;const px=W/2+d*2;x.fillStyle=c;x.beginPath();
    if(shape==='d'){x.moveTo(px,15);x.lineTo(px+4,19);x.lineTo(px,23);x.lineTo(px-4,19)}else if(shape==='s'){x.rect(px-3,16,6,6)}else{x.arc(px,19,3,0,TAU)}x.fill()};
  for(const q of groundWorld.pois){const d=Math.hypot(q.x-play.x,q.z-play.z);if(d>4500||d<q.r)continue;if(q.cat==='city')mark(q.x,q.z,'#f2c060','s');else if(q.dungeon)mark(q.x,q.z,'#c78aff','d');else if(q.cat==='military')mark(q.x,q.z,'#ff8a6a','d')}
  const t=currentTarget();if(t&&t.g&&t.g.kind!=='friendly'){const p=targetPos(t);mark(p.x,p.z,'#ff4a3a','c')}if(route&&route.pts[0])mark(route.pts[0].x,route.pts[0].z,'#6ff0ff','d')}}
// per-frame
let hudFxT=0,vigBase=0;
function tickHud3(dt){const playing=CH&&level==='ground'&&groundMode==='play'&&groundWorld;fx3.classList.toggle('on',!!playing);if(!playing){for(const f of fctItems)f.el.remove();fctItems.length=0;if(zbT>0){zbT=0;$('#zban').classList.remove('show')}return}
  tickFct(dt);tickPlates();tickZone(dt);if(zbT>0){zbT-=dt;if(zbT<=0)$('#zban').classList.remove('show')}
  if(streakT>0){streakT-=dt;if(streakT<=0)streak=0}
  for(let i=feed.length-1;i>=0;i--){feed[i].t+=dt;if(feed[i].t>9){feed[i].el.classList.add('out');if(feed[i].t>10){feed[i].el.remove();feed.splice(i,1)}}}
  hudFxT-=dt;if(hudFxT<=0){hudFxT=.5;const M=hamMax(),low=CH.hp/M.h;vigBase=low<.35?Math.min(.85,(.35-low)*3):0;
    const e=realmEvent(groundWorld),ch=$('#evchip');ch.hidden=!e;if(e)ch.textContent=`⚡ ${e.name}`;tickRealmEvents()}
  if(pulseT>0)pulseT-=dt;$('#vign').style.opacity=Math.max(vigBase,pulseT*2)}

/* ================= Living scene: day/night cycle, sky and fog by biome and weather, drifting clouds, night stars, biome particles, rain and lightning ================= */
const FXG=new THREE.Group();FXG.visible=false;scene.add(FXG);
// soft cloud texture
const CLOUD_TEX=(()=>{const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d'),R=mulberry(11);
  for(let i=0;i<22;i++){const px=24+R()*80,py=40+R()*48,r=14+R()*26,g=x.createRadialGradient(px,py,0,px,py,r);g.addColorStop(0,'rgba(255,255,255,.55)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,128,128)}
  const t=new THREE.CanvasTexture(c);t._keep=true;return t})();
const clouds=[];{const R=mulberry(5);for(let i=0;i<34;i++){const m=new THREE.SpriteMaterial({map:CLOUD_TEX,transparent:true,depthWrite:false,fog:false,opacity:.6});const s=new THREE.Sprite(m);
  const sc=900+R()*1600;s.scale.set(sc,sc*.45,1);s.userData={ox:(R()*2-1)*9000,oz:(R()*2-1)*9000,h:1100+R()*700,sp:6+R()*8};FXG.add(s);clouds.push(s)}}
// night sky stars on a dome that follows the camera
const nightStars=(()=>{const n=1800,pos=new Float32Array(n*3),R=mulberry(23);for(let i=0;i<n;i++){const u=R()*2-1,a=R()*TAU,y=Math.abs(u)*.95+.05,r=Math.sqrt(1-y*y);pos.set([Math.cos(a)*r*24000,y*24000,Math.sin(a)*r*24000],i*3)}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));const p=new THREE.Points(g,new THREE.PointsMaterial({size:2,sizeAttenuation:false,color:0xffffff,transparent:true,opacity:0,fog:false,depthWrite:false}));p.frustumCulled=false;FXG.add(p);return p})();
const moon=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color:0xdfe8ff,transparent:true,fog:false,depthWrite:false,opacity:0}));moon.scale.set(1800,1800,1);FXG.add(moon);
const sunDisc=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color:0xfff0c8,transparent:true,fog:false,depthWrite:false,blending:THREE.AdditiveBlending,opacity:.9}));sunDisc.scale.set(2600,2600,1);FXG.add(sunDisc);
// particles in a box around the camera
const PN=900,PBOX=70,ppos=new Float32Array(PN*3),pvel=new Float32Array(PN*3),pseed=new Float32Array(PN);
{const R=mulberry(3);for(let i=0;i<PN;i++){ppos.set([(R()*2-1)*PBOX,(R()*2-1)*PBOX*.5,(R()*2-1)*PBOX],i*3);pseed[i]=R()}}
const pgeo=new THREE.BufferGeometry();pgeo.setAttribute('position',new THREE.BufferAttribute(ppos,3));
const pmat=new THREE.PointsMaterial({map:DOT,size:.5,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,color:0xffffff,opacity:.9});
const parts=new THREE.Points(pgeo,pmat);parts.frustumCulled=false;FXG.add(parts);
// rain as falling streaks
const RN=700,rpos=new Float32Array(RN*6);{const R=mulberry(9);for(let i=0;i<RN;i++){const x=(R()*2-1)*60,y=R()*60,z=(R()*2-1)*60;rpos.set([x,y,z,x+.15,y-1.6,z],i*6)}}
const rgeo=new THREE.BufferGeometry();rgeo.setAttribute('position',new THREE.BufferAttribute(rpos,3));const rain=new THREE.LineSegments(rgeo,new THREE.LineBasicMaterial({color:0xaac4dc,transparent:true,opacity:.45,depthWrite:false}));rain.frustumCulled=false;FXG.add(rain);
// particle styles: [color, size, fall speed (neg rises), drift, additive]
const PSTYLE={snow:['#ffffff',.55,-2.6,1.2,false],ash:['#9a8e86',.4,-1.2,.8,false],ember:['#ff8a3a',.45,1.6,.9,true],dust:['#d8c8a0',.35,-.3,9,false],
  firefly:['#d8ff7a',.5,0,.7,true],motes:['#c9a4ff',.45,.6,.5,true],spores:['#5af0d0',.4,.5,.4,true],pollen:['#fff6d8',.25,-.2,1,true],none:null};
let pStyle='none',flashT=0,boltT=8;
function sceneStyle(w,key,night,ev,b){const fx=ev&&ev.fx;if(!fx&&b&&b.fx)return night?b.fx[1]:b.fx[0];
  if(fx==='blizzard')return'snow';if(fx==='sandstorm')return'dust';if(fx==='eruption')return'ember';if(fx==='tide')return'spores';
  if(key==='ice')return'snow';if(key==='volcanic')return Math.random()<.5?'ember':'ash';if(key==='glass'||key==='desert')return night?'none':'dust';if(key==='abyss')return'spores';
  if(key==='ethereal')return night?'firefly':'motes';if(/forest|jungle|swamp|tropical|grass|temperate/.test(key))return night?'firefly':'pollen';return'none'}
const _c1=new THREE.Color(),_c2=new THREE.Color(),SKY_NIGHT=col('#0a1222'),SKY_DUSK=col('#e8875a'),SKY_STORM=col('#4a5560');
let styleT=0,fogN=4000,fogF=17000,skyW=null;const skyCur=new THREE.Color();
function tickScene(dt){const on=level==='ground'&&groundWorld;FXG.visible=!!on;if(!on)return;const w=groundWorld,G0=G.ground.userData,h=gameHour();
  const el=Math.sin((h-6)/12*Math.PI),day=smooth(-.12,.28,el),dusk=Math.max(0,1-Math.abs(el)/.28)*(h>4&&h<20?1:0),az=(h/24)*TAU;
  const ev=realmEvent(w),fx=ev&&ev.fx,b=biomeAt(w,cam.position.x,-cam.position.z),key=b.key,stormy=fx==='storm'||key==='storm';
  // lights
  if(G0.sun){const sun=G0.sun;sun.position.set(Math.cos(az+Math.PI/2)*.8,Math.max(.08,el),.35+Math.sin(az)*.3);sun.intensity=(.3+.4*day)*(stormy?.7:1);
    sun.color.copy(_c1.set('#fff2dc').lerp(_c2.set('#ff9a5a'),dusk*.7).lerp(_c2.set('#9fb4ff'),1-day))}
  if(G0.hemi){G0.hemi.intensity=.4+.15*day;G0.hemi.color.copy(_c1.set('#dfe8f0').lerp(_c2.set('#7a8ac0'),1-day))}
  // sky and fog colour
  if(skyW!==w){skyW=w;skyCur.set(b.sky||w.biome.sky)}skyCur.lerp(_c2.set(b.sky||w.biome.sky),Math.min(1,dt*.35));const base=_c1.copy(skyCur).lerp(_c2.set('#ffffff'),.25);if(stormy)base.lerp(SKY_STORM,.55);if(fx==='sandstorm')base.lerp(_c2.set('#c8a878'),.7);if(fx==='blizzard')base.lerp(_c2.set('#dfe6ee'),.7);if(fx==='eruption')base.lerp(_c2.set('#8a3a24'),.5);
  base.lerp(SKY_DUSK,dusk*.45).lerp(SKY_NIGHT,(1-day)*.85);if(flashT>0)base.lerp(_c2.set('#e8f0ff'),Math.min(1,flashT*5));
  if(scene.background&&scene.background.isColor)scene.background.copy(base);
  const thick=fx==='blizzard'||fx==='sandstorm'?1:fx==='tide'||fx==='eruption'?.6:stormy||/abyss|swamp|ethereal/.test(key)?.35:0;
  const wantN=4000-3600*thick,wantF=17000-12000*thick;fogN+=(wantN-fogN)*Math.min(1,dt*.6);fogF+=(wantF-fogF)*Math.min(1,dt*.6);
  if(scene.fog){scene.fog.color.copy(base);scene.fog.near=fogN;scene.fog.far=fogF}
  if(skyMesh){skyMesh.material.color.copy(_c2.set('#ffffff').lerp(SKY_DUSK,dusk*.35).lerp(SKY_NIGHT,(1-day)*.92));if(flashT>0)skyMesh.material.color.lerp(_c1.set('#ffffff'),Math.min(1,flashT*5))}
  // celestial
  const cp=cam.position;nightStars.position.copy(cp);nightStars.material.opacity=(1-day)*(thick>.5?.2:.9);
  const sd=new V3(Math.cos(az+Math.PI/2)*.8,el,.35+Math.sin(az)*.3).normalize();sunDisc.position.copy(cp).addScaledVector(sd,20000);sunDisc.material.opacity=day*(1-thick)*.9;sunDisc.material.color.set(dusk>.3?'#ffb070':'#fff0c8');
  moon.position.copy(cp).addScaledVector(sd,-20000);moon.position.y=cp.y+Math.abs(moon.position.y-cp.y);moon.material.opacity=(1-day)*.85*(1-thick);
  // clouds drift with the wind and wrap around the camera
  const t=performance.now()/1000,cc=stormy?_c1.set('#5a626c'):_c1.set('#ffffff');cc.lerp(SKY_DUSK,dusk*.5).lerp(_c2.set('#1a2236'),(1-day)*.85);
  for(const s of clouds){const u=s.userData;let x=u.ox+t*u.sp,z=u.oz;x=((x-cp.x+9000)%18000+18000)%18000-9000+cp.x;z=((z+cp.z+9000)%18000+18000)%18000-9000-cp.z;
    s.position.set(x,groundH(w,cp.x,-cp.z)+u.h,-z);s.material.color.copy(cc);s.material.opacity=(stormy?.85:.55)*(fx==='sandstorm'?.2:1)}
  // particles
  styleT-=dt;if(styleT<=0){styleT=3;pStyle=sceneStyle(w,key,day<.4,ev,b)}
  const S=PSTYLE[pStyle];parts.visible=!!S;if(S){pmat.color.set(S[0]);pmat.size=S[1]*(fx==='blizzard'?1.4:1);pmat.blending=S[4]?THREE.AdditiveBlending:THREE.NormalBlending;pmat.opacity=pStyle==='firefly'?.6+Math.sin(t*3)*.3:.85;
    parts.position.set(cp.x,cp.y,cp.z);const P=pgeo.attributes.position.array,wind=fx==='sandstorm'||fx==='blizzard'?S[3]*2:S[3];
    for(let i=0;i<PN;i++){const o=i*3,sd2=pseed[i];P[o]+=(Math.sin(t*.7+sd2*20)*.6+wind*(pStyle==='dust'?1:.3))*dt;P[o+1]+=(S[2]+(pStyle==='firefly'?Math.sin(t*1.3+sd2*30)*.8:0))*dt*(.6+sd2*.8);P[o+2]+=Math.cos(t*.5+sd2*17)*.5*dt;
      for(let k=0;k<3;k++){const lim=k===1?PBOX*.5:PBOX;if(P[o+k]>lim)P[o+k]-=lim*2;else if(P[o+k]<-lim)P[o+k]+=lim*2}}
    pgeo.attributes.position.needsUpdate=true}
  // rain and lightning in storms
  rain.visible=stormy&&fx!=='blizzard';if(rain.visible){rain.position.set(cp.x,cp.y-30,cp.z);const A=rgeo.attributes.position.array;for(let i=0;i<RN;i++){const o=i*6;let y=A[o+1]-34*dt;if(y<0)y+=60;A[o+1]=y;A[o+4]=y-1.6}rgeo.attributes.position.needsUpdate=true}
  if(stormy||fx==='eruption'){boltT-=dt;if(boltT<=0){boltT=6+Math.random()*14;flashT=.22;if(G0.hemi)G0.hemi.intensity=(G0.hemi._legacyI!=null?G0.hemi._legacyI:G0.hemi.intensity)+1.2;if(groundMode==='play'&&Math.random()<.3)mmLog(fx==='eruption'?'The caldera rumbles.':'Thunder rolls across the sky.','sys')}}
  if(flashT>0){flashT-=dt;$('#flash').style.opacity=Math.max(0,flashT*2.4)}}

/* ================= Ground cover: super-terrain's foliage species (MolochDaGod/super-terrain src/foliage) ported to WebGL =================
   Twelve growth habits share the ground: fine blades, arching tussocks, broadleaf mats, straw, ferns, reeds. Each biome mixes them by
   its own recipe; each species forms colonies at its own patch scale; blades sway in the wind by their stiffness; clumps are tinted by the
   terrain colour underneath so the cover fades into the ground. Repopulated in a ring around the player. */
const FSP={ // height, width, arch, clumpRadius, taper, bulge, yawSpread, tiltSpread, base, tip, flower, flowerChance, dryChance, density, blades, clumping, patch, stiffness
  'meadow-fescue':[.34,.0075,.62,.075,1.35,.1,2.6,.42,[.055,.085,.028],[.155,.215,.062],[.19,.2,.11],.05,.13,1,6,.18,9,.34],
  tussock:[.82,.0115,1.25,.13,1.7,.06,3.1,.72,[.062,.078,.03],[.19,.216,.09],[.24,.21,.12],.22,.3,.42,7,.55,6,.55],
  'dry-steppe':[.48,.006,1.05,.1,1.9,.04,3,.6,[.105,.098,.042],[.34,.29,.128],[.42,.36,.19],.4,.82,.72,6,.42,14,.28],
  'clover-mat':[.115,.031,.34,.055,.22,.85,3.14,.95,[.03,.055,.018],[.075,.135,.038],[.5,.48,.4],.11,.04,1.5,5,.12,5,.6],
  'broadleaf-weed':[.23,.045,.5,.03,.45,.62,3.14,1.15,[.034,.052,.02],[.098,.146,.046],[.2,.19,.1],.18,.08,.4,5,.5,4,.72],
  'woodland-fern':[.55,.03,.95,.07,1.4,.28,3.14,.9,[.022,.045,.02],[.062,.115,.045],[.08,.12,.05],0,.06,.3,6,.72,7,.66],
  wildflower:[.42,.008,.55,.11,1.4,.12,3,.55,[.05,.08,.028],[.16,.215,.07],[.62,.52,.2],.34,.12,.8,6,.46,8,.4],
  'sedge-reed':[1.15,.014,.42,.09,1.15,.08,2.2,.3,[.04,.072,.038],[.12,.192,.098],[.13,.1,.07],.16,.1,.32,7,.66,11,.86],
  'forest-moss':[.045,.005,.45,.055,.95,.34,3.14,1.25,[.016,.038,.014],[.055,.105,.03],[.07,.1,.04],0,.02,2.4,8,.22,3.5,.96],
  'wood-rush':[.26,.005,.88,.062,1.5,.06,2.7,.72,[.038,.062,.026],[.125,.175,.062],[.16,.14,.08],.1,.16,.95,7,.4,5,.42],
  bramble:[.52,.058,1.28,.17,.5,.62,3.14,1.05,[.014,.03,.014],[.055,.088,.032],[.1,.06,.07],.06,.1,.34,6,.78,6,.48],
  bracken:[1.02,.045,1.02,.1,1.5,.3,3.14,.88,[.02,.042,.018],[.075,.13,.042],[.1,.09,.04],0,.2,.24,5,.8,16,.52]};
// what grows where: open-ground grassland rule from terrainGrassland.ts, forest floor recipes for wooded biomes, realm variants
const GRASSLAND={'meadow-fescue':.62,'clover-mat':.3,tussock:.12,'dry-steppe':.05,wildflower:.16,'sedge-reed':.06,'broadleaf-weed':.14};
const FLORA_RECIPE={temperate:GRASSLAND,grass:{...GRASSLAND,'dry-steppe':.25,tussock:.2},
  forest:{'woodland-fern':.5,'forest-moss':.5,'wood-rush':.4,bramble:.25,bracken:.3,'meadow-fescue':.15},jungle:{'woodland-fern':.6,bracken:.45,'broadleaf-weed':.4,'forest-moss':.3,bramble:.3},
  red:{bramble:.5,bracken:.35,'dry-steppe':.3,'woodland-fern':.2},swamp:{'sedge-reed':.7,'forest-moss':.5,'broadleaf-weed':.3,'woodland-fern':.2},
  tropical:{'meadow-fescue':.5,'broadleaf-weed':.45,wildflower:.3,'woodland-fern':.25,'sedge-reed':.15},ethereal:{wildflower:.8,'woodland-fern':.35,'clover-mat':.4,'meadow-fescue':.3},
  storm:{tussock:.5,'sedge-reed':.35,'dry-steppe':.3},abyss:{'forest-moss':.7,'sedge-reed':.4,'woodland-fern':.3},ice:{tussock:.25,'dry-steppe':.2},
  desert:{'dry-steppe':.3,tussock:.08},badlands:{'dry-steppe':.4,tussock:.15},glass:{'dry-steppe':.08},volcanic:{'dry-steppe':.04}};
const FLORA_TINT={ethereal:[.75,.6,1.15],abyss:[.6,.95,.95],ice:[.95,1,1.08],red:[1.15,.8,.7],storm:[.85,.95,.95]};
const lin2s=v=>Math.pow(Math.max(0,v),1/2.2);
const floraWind={value:0},floraMats={},floraMeshes={};let floraAt=null,floraWorld=null;
function clumpGeo(id){const [h,wd,arch,cr,taper,bulge,yawS,tiltS,base,tip,flw,fc,dc,,blades]=FSP[id],R=mulberry(strHash(id)),SEG=4,pos=[],colA=[],sway=[],idx=[];
  const W=Math.max(wd*2.4,.012);// stylised: blades read at third-person distances
  for(let b=0;b<blades;b++){const yaw=(R()-.5)*yawS*2,tilt=(R()*.6+.4)*tiltS*.5,hh=h*(1+(R()-.5)*.6),ox=(R()-.5)*cr*2,oz=(R()-.5)*cr*2,flower=R()<fc,dry=R()<dc,v0=pos.length/3;
    const fx=Math.sin(yaw),fz=Math.cos(yaw),sx=Math.cos(yaw),sz=-Math.sin(yaw);let px=ox,py=0,pz=oz,ang=tilt;
    for(let k=0;k<=SEG;k++){const t=k/SEG,wdt=W*Math.pow(1-t,taper*.6)*(1+bulge*Math.sin(Math.PI*t))*(k===SEG?.15:1);
      for(const sgn of [-1,1]){pos.push(px+sx*wdt*sgn*.5,py,pz+sz*wdt*sgn*.5);
        let c=[0,1,2].map(j=>base[j]+(tip[j]-base[j])*t);if(dry)c=c.map((v,j)=>v+([.42,.36,.19][j]-v)*.7*t);if(flower&&k===SEG)c=flw.slice();colA.push(...c.map(v=>Math.min(1,lin2s(v)*1.35)));sway.push(t*t)}
      const seg=hh/SEG;ang+=arch/SEG;px+=fx*Math.sin(ang)*seg;pz+=fz*Math.sin(ang)*seg;py+=Math.cos(ang)*seg}
    for(let k=0;k<SEG;k++){const a=v0+k*2;idx.push(a,a+1,a+2,a+1,a+3,a+2)}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colA,3));g.setAttribute('aSway',new THREE.Float32BufferAttribute(sway,1));
  g.setAttribute('normal',new THREE.Float32BufferAttribute(new Array(pos.length).fill(0).map((_,i)=>i%3===1?1:0),3));g.setIndex(idx);return g}
function floraMat(id){if(floraMats[id])return floraMats[id];const stiff=FSP[id][17],m=new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide});
  m.onBeforeCompile=sh=>{sh.uniforms.uWind=floraWind;sh.uniforms.uStiff={value:stiff};
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute float aSway;uniform float uWind;uniform float uStiff;')
      .replace('#include <begin_vertex>',`#include <begin_vertex>
      vec2 ip=vec2(0.);
      #ifdef USE_INSTANCING
      ip=instanceMatrix[3].xz;
      #endif
      float ph=uWind*1.6+ip.x*.21+ip.y*.17,gust=sin(uWind*.37+ip.x*.013)*.5+.5;
      float bend=aSway*(1.-uStiff)*(.18+.22*gust);transformed.x+=(sin(ph)*.7+sin(ph*2.3+1.)*.3)*bend;transformed.z+=cos(ph*.8)*bend*.5;transformed.y-=bend*bend*.3;`);
    sh.fragmentShader=sh.fragmentShader.replace(/gl_FrontFacing/g,'true')};
  return floraMats[id]=m}
const FLORA_CAP={low:1400,medium:2600,high:4200};
function floraRadius(){return quality==='low'?26:quality==='medium'?34:42}
function hGridAt(w,x,z){const G2=w.hGrid;if(!G2)return groundH(w,x,z);const fx=(x+HALF)/G2.cell,fy=(HALF-z)/G2.cell,ix=Math.max(0,Math.min(G2.N-2,Math.floor(fx))),iy=Math.max(0,Math.min(G2.N-2,Math.floor(fy))),tx=fx-ix,ty=fy-iy,H=G2.H,N=G2.N;
  const a=H[iy*N+ix],b=H[iy*N+ix+1],c=H[(iy+1)*N+ix],d=H[(iy+1)*N+ix+1];return tx+ty<1?a+(b-a)*tx+(c-a)*ty:d+(c-d)*(1-tx)+(b-d)*(1-ty)}
function populateFlora(w,cx,cz){const G2=w.surfGrid;if(!G2||!w.hGrid)return;const R=floraRadius(),cell=.95,cap=FLORA_CAP[quality]||3000,M=new THREE.Matrix4(),q=new THREE.Quaternion(),sc=new V3(),ps=new V3(),c=new THREE.Color(),buckets={};
  const rnd=mulberry((Math.floor(cx)*73856093)^(Math.floor(cz)*19349663)),cities=w.pois.filter(p=>p.cat==='city'||p.cat==='military');
  for(let gx=-R;gx<=R;gx+=cell)for(let gz=-R;gz<=R;gz+=cell){const x=Math.round((cx+gx)/cell)*cell+(rnd()-.5)*cell,z=Math.round((cz+gz)/cell)*cell+(rnd()-.5)*cell;if((x-cx)**2+(z-cz)**2>R*R)continue;
    const ix=Math.max(0,Math.min(G2.N-1,Math.round((x+HALF)/G2.cell))),iy=Math.max(0,Math.min(G2.N-1,Math.round((HALF-z)/G2.cell))),i=iy*G2.N+ix,veg=G2.wt[i*2],wat=G2.water[i];
    if(wat>.5||onRoad(w,x,z))continue;let cityK=1;for(const p of cities){const d=Math.hypot(x-p.x,z-p.z);if(d<p.r*.85){cityK=d<p.r*.45?0:.35;break}}if(!cityK)continue;
    const b=planetBiomes(w)[G2.bio[i]]||biomeAt(w,x,z),rec=b.flora||FLORA_RECIPE[b.key]||GRASSLAND;let tot=0;
    const wants=[];for(const id in rec){const sp=FSP[id],patch=noise3(x/sp[16],3.1,z/sp[16],strHash(id)%997),col=sp[15]>0?smooth(.5-sp[15]*.35,.5+sp[15]*.15,patch):1;let wgt=rec[id]*col*(id==='sedge-reed'?.3+wat*3:1);tot+=wgt;wants.push([id,wgt])}
    const dens=Math.min(1,(veg*.9+.12*(1-b.surf.aridity))*cityK*Math.min(1.3,tot));if(rnd()>dens)continue;
    let r=rnd()*tot,pick=wants[0][0];for(const [id,wg] of wants){if((r-=wg)<=0){pick=id;break}}
    const sp=FSP[pick];if(rnd()>Math.min(1,sp[13]*.8+.2))continue;(buckets[pick]||(buckets[pick]=[])).push([x,z,b.tint||FLORA_TINT[b.key]||null])}
  const totalN=Object.values(buckets).reduce((a,l)=>a+l.length,0),keep=Math.min(1,cap/Math.max(1,totalN)),groundCols=w.surfGrid.cols;
  for(const id in floraMeshes){floraMeshes[id].count=0}
  for(const id in buckets){let list=buckets[id];if(keep<1)list=list.filter(()=>rnd()<keep);let m=floraMeshes[id];
    if(!m||m.instanceMatrix.count<list.length){if(m){FXG.remove(m);m.dispose&&m.dispose()}m=new THREE.InstancedMesh(m?m.geometry:clumpGeo(id),floraMat(id),Math.max(list.length,400));m.frustumCulled=false;m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);FXG.add(m);floraMeshes[id]=m}
    list.forEach(([x,z,bk],k)=>{const s=.75+rnd()*.6;ps.set(x,hGridAt(w,x,z)-.02,-z);q.setFromAxisAngle(new V3(0,1,0),rnd()*TAU);sc.set(s,s*(.8+rnd()*.5),s);M.compose(ps,q,sc);m.setMatrixAt(k,M);
      const ix=Math.max(0,Math.min(G2.N-1,Math.round((x+HALF)/G2.cell))),iy=Math.max(0,Math.min(G2.N-1,Math.round((HALF-z)/G2.cell))),gi=(iy*G2.N+ix)*3,T=bk||[1,1,1];
      if(groundCols){const gl=(groundCols[gi]+groundCols[gi+1]+groundCols[gi+2])/3+.05;c.setRGB(.7+.3*groundCols[gi]/gl,.7+.3*groundCols[gi+1]/gl,.7+.3*groundCols[gi+2]/gl)}else c.setRGB(1,1,1);
      c.r*=T[0]*(.9+rnd()*.2);c.g*=T[1]*(.9+rnd()*.2);c.b*=T[2];m.setColorAt(k,c)});
    m.count=list.length;m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true}
  floraAt={x:cx,z:cz};floraWorld=w}
function tickFlora(dt){floraWind.value+=dt;const w=groundWorld,on=level==='ground'&&w&&(groundMode==='play'||groundMode==='roam');
  for(const id in floraMeshes)floraMeshes[id].visible=!!on;if(!on)return;const px=groundMode==='play'?play.x:roam.pos.x,pz=groundMode==='play'?play.z:-roam.pos.z;
  if(floraWorld!==w||!floraAt||Math.hypot(px-floraAt.x,pz-floraAt.z)>floraRadius()*.3)populateFlora(w,px,pz)}

/* ================= Trees from super-terrain's procedural tree editor (vibe-stack.github.io/super-terrain/?editor=tree) =================
   21 species were grown with the editor's own generator (compileProceduralTree) and exported at its LOD 2 with baked bark and leaf-card
   textures. Near the player the cheap far-field trees are swapped for these real trees; species follow the biome, and leaves sway. */
const TREE_SPECIES={temperate:['field-oak','european-beech','silver-birch','hazel-thicket'],grass:['field-oak','umbrella-acacia','elder-bush'],forest:['norway-spruce','windswept-pine','cedar-of-lebanon','silver-birch'],
  jungle:['kapok-ceiba','banyan','tree-fern'],swamp:['mangrove','tree-fern','elder-bush'],red:['dragon-blood','quiver-tree','windswept-pine'],tropical:['coconut-palm','date-palm','tree-fern'],
  ethereal:['rainbow-eucalyptus','silver-birch','tree-fern'],ice:['bristlecone-pine','common-juniper'],storm:['windswept-pine','common-juniper'],abyss:['mangrove','tree-fern'],
  desert:['joshua-tree','date-palm'],glass:['quiver-tree','joshua-tree'],badlands:['umbrella-acacia','joshua-tree'],volcanic:['quiver-tree']};
const SPARSE_TREE={desert:{kind:'broad',color:'#6a7a3a',density:.05,sparse:1},glass:{kind:'broad',color:'#7a8a6a',density:.03,sparse:1},badlands:{kind:'broad',color:'#6a6a3a',density:.06,sparse:1},volcanic:{kind:'broad',color:'#4a4a3a',density:.015,sparse:1}};
const treeProto={},treeLoading={},treeWind={value:0};
function treeMat(m,leaf){const n=new THREE.MeshLambertMaterial({map:m.map||null,vertexColors:!!m.vertexColors,alphaTest:leaf?Math.max(.3,m.alphaTest||.36):0,side:leaf?THREE.DoubleSide:THREE.FrontSide,color:m.color?m.color.clone():0xffffff});
  if(n.map)n.map.encoding=THREE.LinearEncoding;
  if(leaf)n.onBeforeCompile=sh=>{sh.uniforms.uWind=treeWind;sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nuniform float uWind;').replace('#include <begin_vertex>',`#include <begin_vertex>
    vec2 ip=vec2(0.);
    #ifdef USE_INSTANCING
    ip=instanceMatrix[3].xz;
    #endif
    float sw=max(0.,position.y)*.012;transformed.x+=sin(uWind*1.3+ip.x*.07+position.y*.2)*sw;transformed.z+=cos(uWind*1.1+ip.y*.07)*sw*.6;`);sh.fragmentShader=sh.fragmentShader.replace(/gl_FrontFacing/g,'true')};
  return n}
function loadTreeSpecies(id){if(treeProto[id]||treeLoading[id])return treeLoading[id];
  treeLoading[id]=loadScript('kits/trees/'+id+'.js').then(()=>new Promise(res=>{const b64=(window.GRUDGE_TREE||{})[id];if(!b64)return res();const bin=atob(b64),buf=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)buf[i]=bin.charCodeAt(i);delete window.GRUDGE_TREE[id];
    new THREE.GLTFLoader().parse(buf.buffer,'',g=>{const sc=g.scene;sc.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(sc),c=box.getCenter(new V3()),off=new THREE.Matrix4().makeTranslation(-c.x,-box.min.y,-c.z),parts=[];
      sc.traverse(o=>{if(o.isMesh){const leaf=/leaf|frond|fan|rosette|needle/i.test(o.name+' '+(o.material.name||''))||o.material.alphaTest>0;parts.push({geo:o.geometry,mat:treeMat(o.material,leaf),m:off.clone().multiply(o.matrixWorld)})}});
      treeProto[id]={parts,h:box.max.y-box.min.y,meshes:null};res()},e=>{console.warn('tree '+id,e);res()})})).catch(e=>console.warn('tree '+id,e));return treeLoading[id]}
// index the far-field trees on a coarse grid so the swap only looks at nearby cells
function indexTrees(w){const g=new Map();for(const t of w._trees||[]){const k=Math.floor(t.x/200)+','+Math.floor(t.z/200);(g.get(k)||g.set(k,[]).get(k)).push(t)}w._treeGrid=g;
  const want=new Set();for(const b of planetBiomes(w))for(const id of b.trees||TREE_SPECIES[b.key]||[])want.add(id);for(const id of want)loadTreeSpecies(id)}
const NEAR_TREES={low:[110,140],medium:[150,260],high:[190,420]};let treeT=0,nearSet=new Set(),treeWorld=null;const _zero=new THREE.Matrix4().makeScale(0,0,0),_tm=new THREE.Matrix4(),_tq=new THREE.Quaternion(),_ts=new V3(),_tp=new V3();
function speciesFor(t){const L=(t.b&&t.b.trees)||TREE_SPECIES[t.b&&t.b.key]||TREE_SPECIES.temperate,h=strHash(Math.round(t.x)+'|'+Math.round(t.z));return L[h%L.length]}
function tickTrees(dt){treeWind.value+=dt;const w=groundWorld,on=level==='ground'&&w&&groundMode!=='overhead';
  if(!on||treeWorld!==w){for(const id in treeProto)if(treeProto[id].meshes)for(const m of treeProto[id].meshes){m.count=0}if(treeWorld!==w){nearSet=new Set();treeWorld=w}if(!on)return}
  treeT-=dt;if(treeT>0)return;treeT=.8;if(!w._treeGrid){indexTrees(w);nearSet=new Set()}
  const px=groundMode==='play'?play.x:roam.pos.x,pz=groundMode==='play'?play.z:-roam.pos.z,[R,cap]=NEAR_TREES[quality]||NEAR_TREES.medium;
  const cand=[];for(let gx=Math.floor((px-R)/200);gx<=Math.floor((px+R)/200);gx++)for(let gz=Math.floor((pz-R)/200);gz<=Math.floor((pz+R)/200);gz++){const L=w._treeGrid.get(gx+','+gz);if(!L)continue;for(const t of L){const d=(t.x-px)**2+(t.z-pz)**2;if(d<R*R)cand.push([d,t])}}
  cand.sort((a,b)=>a[0]-b[0]);const now=new Set(),bySp={};
  for(const [,t] of cand){if(now.size>=cap)break;const sp=t.sp||(t.sp=speciesFor(t));if(!treeProto[sp])continue;now.add(t);(bySp[sp]||(bySp[sp]=[])).push(t)}
  // swap: hide the cheap stand-ins for trees that are now real, restore the ones that left
  const dirty=new Set();for(const t of nearSet)if(!now.has(t)){t.cr.setMatrixAt(t.i,t.cm);t.tr.setMatrixAt(t.i,t.tm);dirty.add(t.cr);dirty.add(t.tr)}
  for(const t of now)if(!nearSet.has(t)){if(!t.cm){t.cm=new THREE.Matrix4();t.tm=new THREE.Matrix4();t.cr.getMatrixAt(t.i,t.cm);t.tr.getMatrixAt(t.i,t.tm)}t.cr.setMatrixAt(t.i,_zero);t.tr.setMatrixAt(t.i,_zero);dirty.add(t.cr);dirty.add(t.tr)}
  for(const m of dirty)m.instanceMatrix.needsUpdate=true;nearSet=now;
  for(const id in treeProto){const P=treeProto[id],list=bySp[id]||[];if(!P.meshes||P.cap<list.length){if(P.meshes)P.meshes.forEach(m=>FXG.remove(m));P.cap=Math.max(64,list.length*1.5|0);
      P.meshes=P.parts.map(pt=>{const m=new THREE.InstancedMesh(pt.geo,pt.mat,P.cap);m.frustumCulled=false;m.userData.pm=pt.m;FXG.add(m);return m})}
    list.forEach((t,k)=>{const s=(.85+((strHash(id+t.i)%100)/100)*.4)*(t.b&&t.b.ts||1);_tq.setFromAxisAngle(new V3(0,1,0),t.rot);_tp.set(t.x,t.y-.15,-t.z);_ts.setScalar(s);_tm.compose(_tp,_tq,_ts);
      P.meshes.forEach(m=>{const M2=_tm.clone().multiply(m.userData.pm);m.setMatrixAt(k,M2)})});
    P.meshes.forEach(m=>{m.count=list.length;m.instanceMatrix.needsUpdate=true})}}

/* ================= Quaternius wildlife and nature props (from the Grudge R2 store: models/creatures/animals/*, models/nature/*) =================
   Herds of animated animals roam each biome (graze, wander, bolt from you), farm stock stands by the fields outside towns, dogs trot the streets.
   Rocks, bushes, ferns, flowers, mushrooms, big leafy plants, dead and twisted trees and stepping stones on trails are scattered around you. */
const ANIMALS={temperate:['deer','horse','cow','fox'],grass:['horse','cow','bull','donkey','deer'],forest:['deer','stag','fox','wolf'],jungle:['deer','fox'],swamp:['fox','deer'],red:['wolf','stag'],
  tropical:['deer','shibainu'],ethereal:['stag','horse-white'],ice:['husky','wolf','horse-white','stag'],storm:['wolf','fox'],abyss:['wolf'],desert:['alpaca','donkey'],badlands:['alpaca','donkey','wolf'],glass:['alpaca'],volcanic:[]};
const ANIMAL_SPEC={alpaca:{h:1.9,herd:[3,5],prey:1},bull:{h:1.6,herd:[1,2],prey:0},cow:{h:1.5,herd:[3,6],prey:1},deer:{h:1.5,herd:[2,4],prey:1},donkey:{h:1.4,herd:[1,3],prey:1},fox:{h:.55,herd:[1,1],prey:1},
  horse:{h:1.75,herd:[2,4],prey:1},'horse-white':{h:1.75,herd:[2,3],prey:1},husky:{h:.7,herd:[2,3],prey:0},shibainu:{h:.55,herd:[1,1],prey:0},stag:{h:1.8,herd:[1,2],prey:1},wolf:{h:.85,herd:[2,4],prey:0}};
const animalG={},animalLoading={};
function loadAnimal(id){if(animalG[id]||animalLoading[id])return animalLoading[id];
  animalLoading[id]=loadScript('kits/animals/'+id+'.js').then(()=>new Promise(res=>{const b64=(window.GRUDGE_ANIMAL||{})[id];if(!b64)return res();const bin=atob(b64),buf=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)buf[i]=bin.charCodeAt(i);delete window.GRUDGE_ANIMAL[id];
    new THREE.GLTFLoader().parse(buf.buffer,'',g=>{g.scene.traverse(o=>{if(o.isMesh){o.frustumCulled=false;(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{if('metalness' in m){m.metalness=0;m.roughness=1}})}});
      const box=new THREE.Box3().setFromObject(g.scene);animalG[id]={scene:g.scene,clips:g.animations,h:box.max.y-box.min.y};res()},e=>{console.warn('animal '+id,e);res()})})).catch(e=>console.warn('animal '+id,e));return animalLoading[id]}
function makeAnimal(id){const G0=animalG[id];if(!G0||!THREE.SkeletonUtils)return null;const obj=THREE.SkeletonUtils.clone(G0.scene),holder=new THREE.Group();holder.add(obj);holder.scale.setScalar(ANIMAL_SPEC[id].h/G0.h*(.9+Math.random()*.2));
  const mixer=new THREE.AnimationMixer(obj),acts={};for(const c of G0.clips)acts[c.name]=mixer.clipAction(c);return{obj:holder,mixer,acts,cur:null}}
function animPlay(a,name,fade=.3,once=false){const act=a.acts[name]||a.acts[name.replace('Headlow','HeadLow')]||a.acts.Idle;if(!act||a.cur===act)return;act.reset();act.setLoop(once?THREE.LoopOnce:THREE.LoopRepeat);act.clampWhenFinished=once;if(a.cur)act.crossFadeFrom(a.cur,fade,false);else act.fadeIn(fade);act.play();a.cur=act}
let herds=[],herdT=0;const WG=new THREE.Group();scene.add(WG);
function herdCap(){return quality==='low'?8:quality==='medium'?14:22}
function spawnHerd(w,x,z,id,opts={}){const S=ANIMAL_SPEC[id];if(!S||!animalG[id])return null;const n=opts.n||S.herd[0]+Math.floor(Math.random()*(S.herd[1]-S.herd[0]+1)),h={id,home:{x,z},R:opts.R||28,tame:!!opts.tame,members:[],w};
  for(let k=0;k<n;k++){const a=makeAnimal(id);if(!a)continue;a.pos={x:x+(Math.random()-.5)*10,z:z+(Math.random()-.5)*10};a.yaw=Math.random()*TAU;a.state='idle';a.t=Math.random()*4;WG.add(a.obj);animPlay(a,'Idle',0);a.mixer.update(Math.random()*3);h.members.push(a)}
  herds.push(h);return h}
function clearHerds(){herds.forEach(h=>{h.members.forEach(a=>WG.remove(a.obj));if(h.farm)h.farm.stock=null;if(h.town)h.town.dogs=false});herds=[]}
function tickAnimals(dt){const w=groundWorld,on=level==='ground'&&w&&(groundMode==='play'||groundMode==='roam');WG.visible=!!on;if(!on)return;if(herds.length&&herds[0].w!==w)clearHerds();
  const px=groundMode==='play'?play.x:roam.pos.x,pz=groundMode==='play'?play.z:-roam.pos.z;herdT-=dt;
  if(herdT<=0){herdT=2.5;
    // ask for the species this world's biomes use
    for(const b of planetBiomes(w))for(const id of b.animals||ANIMALS[b.key]||[])loadAnimal(id);
    for(let i=herds.length-1;i>=0;i--){const h=herds[i];if(Math.hypot(h.home.x-px,h.home.z-pz)>480){h.members.forEach(a=>WG.remove(a.obj));if(h.farm)h.farm.stock=null;if(h.town)h.town.dogs=false;herds.splice(i,1)}}
    const total=herds.reduce((s,h)=>s+h.members.length,0);
    // farm stock by the fields outside towns
    for(const f of w.placements){if(!/grudge\/farm_field/.test(f.t||'')||f.stock||Math.hypot(f.x-px,f.z-pz)>320)continue;const b=biomeAt(w,f.x,f.z),id=/desert|badlands|glass/.test(b.key)?'alpaca':/ice/.test(b.key)?'horse-white':['cow','cow','horse','donkey','bull'][strHash(f.x+'')%5];
      if(!animalG[id]){loadAnimal(id);continue}const h=spawnHerd(w,f.x+18,f.z+8,id,{tame:1,R:14,n:2+strHash(f.z+'')%3});if(h){h.farm=f;f.stock=h}}
    // dogs in towns
    for(const q of w.pois){if(q.cat!=='city'||q.dogs||Math.hypot(q.x-px,q.z-pz)>q.r+150)continue;const id=/ice/.test(biomeAt(w,q.x,q.z).key)?'husky':'shibainu';if(!animalG[id]){loadAnimal(id);continue}
      q.dogs=true;for(let k=0;k<2;k++){const a=Math.random()*TAU;const h=spawnHerd(w,q.x+Math.cos(a)*q.r*.3,q.z+Math.sin(a)*q.r*.3,id,{tame:1,R:q.r*.35,n:1});if(h)h.town=q}}
    // wild herds out in the country
    if(total<herdCap()){for(let tries=0;tries<6;tries++){const a=Math.random()*TAU,d=110+Math.random()*150,x=px+Math.cos(a)*d,z=pz+Math.sin(a)*d;if(Math.abs(x)>HALF*.97||Math.abs(z)>HALF*.97)continue;
      if(w.pois.some(q=>Math.hypot(q.x-x,q.z-z)<q.r+60)||waterDepth(w,x,z)>.5)continue;const b=biomeAt(w,x,z),L=(b.animals||ANIMALS[b.key]||[]).filter(id=>animalG[id]);if(!L.length)continue;
      spawnHerd(w,x,z,L[Math.random()*L.length|0]);break}}}
  for(const h of herds){if(h.farm&&Math.hypot(h.home.x-px,h.home.z-pz)>480)continue;const S=ANIMAL_SPEC[h.id];
    for(const a of h.members){a.t-=dt;const dP=Math.hypot(a.pos.x-px,a.pos.z-pz);
      if(a.dead){a.mixer.update(dt);continue}
      if(a.state==='fight'&&huntFight(a,h,dt,dP,px,pz)){a.obj.position.set(a.pos.x,groundH(w,a.pos.x,a.pos.z),-a.pos.z);a.obj.rotation.y=a.yaw;a.mixer.update(dt);continue}
      if(!h.tame&&S.prey&&dP<16&&a.state!=='flee'){a.state='flee';a.t=4+Math.random()*2;const dx=a.pos.x-px,dz=a.pos.z-pz,dd=Math.hypot(dx,dz)||1;a.target={x:a.pos.x+dx/dd*45,z:a.pos.z+dz/dd*45};animPlay(a,'Gallop',.15);h.home={x:a.target.x,z:a.target.z}}
      else if(!S.prey&&!h.tame&&dP<9&&a.state!=='warn'){a.state='warn';a.t=2;a.target=null;a.yaw=Math.atan2(px-a.pos.x,-(pz-a.pos.z));animPlay(a,'Attack',.15,true)}
      else if(a.t<=0){const r=Math.random();if(r<.4){a.state='graze';a.t=4+Math.random()*7;a.target=null;animPlay(a,'Eating')}else if(r<.65){a.state='idle';a.t=3+Math.random()*5;a.target=null;animPlay(a,Math.random()<.5?'Idle':'Idle_2')}
        else{a.state='walk';a.t=8;const an=Math.random()*TAU,rr=Math.random()*h.R;a.target={x:h.home.x+Math.cos(an)*rr,z:h.home.z+Math.sin(an)*rr};animPlay(a,'Walk')}}
      if(a.target){const dx=a.target.x-a.pos.x,dz=a.target.z-a.pos.z,d=Math.hypot(dx,dz),sp=(a.state==='flee'?7.5:1.3)*dt;if(d<.6){a.target=null;a.t=0}else{const st=Math.min(d,sp);a.pos.x+=dx/d*st;a.pos.z+=dz/d*st;const want=Math.atan2(dx,-dz);let dy=((want-a.yaw+Math.PI)%TAU+TAU)%TAU-Math.PI;a.yaw+=dy*Math.min(1,dt*5)}}
      a.obj.position.set(a.pos.x,groundH(w,a.pos.x,a.pos.z),-a.pos.z);a.obj.rotation.y=a.yaw;if(dP<260)a.mixer.update(dt)}}}

/* ---- hunting: wild animals (not farm stock or town dogs) can be hunted for SWG creature resources ---- */
const CREATURE_NAMES={bantha:'Grazhorn',bolma:'Hornbrute',dewback:'Sandback',kusak:'Prowler',falumpaset:'Mirehog',eopie:'Dunestrider',gurreck:'Grizzlemaw','war-droid':'War Bot'};
const HUNT_NAME=id=>CREATURE_NAMES[id]||id.replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase()).replace('Shibainu','Shiba Inu');
function nearestAnimal(x,z,r){let best=null,bd=r;for(const h of herds){if(h.tame)continue;for(const a of h.members){if(a.dead)continue;const d=Math.hypot(a.pos.x-x,a.pos.z-z);if(d<bd){bd=d;best={a,h,d}}}}return best}
function huntStats(a,h){if(a.hp==null){const S=ANIMAL_SPEC[h.id];a.tier=Math.max(1,Math.round(S.h*1.5+(S.prey?0:2)));a.maxHp=a.hp=Math.round(70+a.tier*55);a.dmg=Math.round(8+a.tier*6)}return a}
// one strike on an animal: mult is the ability multiplier (1 for auto-attack)
function huntStrike(t,mult=1,anim='attack'){const {a,h}=t;huntStats(a,h);const st=charStats();const reach=(st.range||3)+3;
  if(t.d>reach)return floatMsg(`Too far to strike the ${HUNT_NAME(h.id).toLowerCase()} (${Math.round(t.d)} m).`);
  const R=ggHit({tier:a.tier,cat:'beasts',dmg:a.dmg,maxHp:a.maxHp},mult*mmDmgMul()),dmg=R.dmg;a.hp-=dmg;floatMsg(ggHitText('You','the '+HUNT_NAME(h.id).toLowerCase(),R));
  if(play.model){play.model.userData.swing=.4;toonOneShot(play.model,anim)}
  if(a.hp<=0)return huntKill(a,h);
  animPlay(a,Math.random()<.5?'Idle_HitReact1':'Idle_HitReact2',.08,true);
  const S=ANIMAL_SPEC[h.id];if(S.prey){a.state='flee';a.t=5;const dx=a.pos.x-play.x,dz=a.pos.z-play.z,dd=Math.hypot(dx,dz)||1;a.target={x:a.pos.x+dx/dd*55,z:a.pos.z+dz/dd*55};setTimeout(()=>a.state==='flee'&&!a.dead&&animPlay(a,'Gallop',.15),350)}
  else{for(const m of h.members)if(!m.dead&&m.state!=='fight'){huntStats(m,h);m.state='fight';m.cd=.6+Math.random()}}  // the pack joins in
  hunt.cur=t;hunt.t=6;huntBar()}
// predators chase and bite; returns true while the animal is fighting
function huntFight(a,h,dt,dP,px,pz){if(groundMode!=='play'||!CH||dP>60){a.state='idle';a.t=0;return false}
  const dx=px-a.pos.x,dz=pz-a.pos.z;a.yaw=Math.atan2(dx,-dz);a.cd=(a.cd||0)-dt;
  if(dP>2.2){const st=Math.min(dP-2,6.5*dt);a.pos.x+=dx/dP*st;a.pos.z+=dz/dP*st;animPlay(a,'Gallop',.15)}
  else if(a.cd<=0){a.cd=1.8+Math.random()*.6;animPlay(a,'Attack',.1,true);const ER=ggEnemyHit({tier:a.tier,cat:'beasts',dmg:a.dmg},1/mmDefMul()),dm=ER.dmg;CH.hp-=dm;hunt.t=6;
    floatMsg(ggTakenText('The '+HUNT_NAME(h.id).toLowerCase(),ER));if(play.model&&Math.random()<.5)setTimeout(()=>play.model&&toonOneShot(play.model,'hit'),200);renderHud();if(CH.hp<=0){for(const m of h.members)if(m.state==='fight')m.state='idle';incapacitate()}}
  else if(a.cur!==a.acts.Attack||!a.cur.isRunning())animPlay(a,'Idle',.2);
  return true}
function huntKill(a,h){a.dead=true;a.state='dead';a.target=null;animPlay(a,'Death',.1,true);hunt.cur=null;huntBar();
  const xp=25+a.tier*15;gainXP('combat',xp,'hunted a '+HUNT_NAME(h.id).toLowerCase());
  // loot: meat, hide and bone from this planet's creature resources (realms borrow a core planet's pool)
  const pools=SWGRES.planets,key=pools[groundWorld.id]?groundWorld.id:Object.keys(pools)[strHash(groundWorld.id)%Object.keys(pools).length],all=(pools[key]||[]).filter(r=>r.t===-1);
  const got=[];if(all.length)for(const kind of ['meat','hide','bone']){const by=all.filter(r=>CORPSE[kind].test(r.c)),pool=by.length?by:all.filter(r=>r.cl.some(c=>CORPSE[kind].test(c)));if(!pool.length)continue;
    const r=pool[strHash(h.id+kind+key)%pool.length],m=skillMods(CH),u=Math.round((6+a.tier*5)*(1+(m.hunting||0)/40)*(.8+Math.random()*.4)*(kind==='meat'?1.2:kind==='bone'?.6:1));addRes(r,u);got.push(`${u} ${r.c}`)}
  if(got.length){toast('Harvested '+got.join(', ')+'.');gainXP('scouting',10+a.tier*6,'')}
  if(h.members.every(m=>m.dead||m.state!=='fight'))for(const m of h.members)if(m.state==='fight')m.state='idle';
  setTimeout(()=>{const i=h.members.indexOf(a);if(i>=0){h.members.splice(i,1);WG.remove(a.obj)}},45000);markDirty()}
// small health bar over the animal you are hunting
const hunt={cur:null,el:null,t:0,auto:null,swing:0};  // t: seconds of 'in combat' left (no health regen)
function huntBar(){if(!hunt.el){hunt.el=document.createElement('div');hunt.el.id='huntBar';hunt.el.innerHTML='<b></b><i><s></s></i>';document.body.append(hunt.el)}
  const t=hunt.cur;hunt.el.hidden=!t||t.a.dead;if(!t||t.a.dead)return;hunt.el.querySelector('b').textContent=HUNT_NAME(t.h.id)+(ANIMAL_SPEC[t.h.id].prey?'':' · hostile');hunt.el.querySelector('s').style.width=Math.max(0,t.a.hp/t.a.maxHp*100)+'%'}
function tickHuntAuto(dt){const t=hunt.auto;if(!t)return;const d=Math.hypot(t.a.pos.x-play.x,t.a.pos.z-play.z);
  if(t.a.dead||groundMode!=='play'||!CH||d>40||combat.p){hunt.auto=null;return}hunt.swing-=dt;
  const reach=(charStats().range||3)+3;if(hunt.swing<=0&&d<=reach){hunt.swing=gunCd();t.d=d;huntStrike(t)}}
function tickHuntBar(){const t=hunt.cur;if(!t||!hunt.el||hunt.el.hidden)return;if(t.a.dead||groundMode!=='play'||Math.hypot(t.a.pos.x-play.x,t.a.pos.z-play.z)>70){hunt.cur=null;hunt.el.hidden=true;return}
  const v=new V3(t.a.pos.x,groundH(groundWorld,t.a.pos.x,t.a.pos.z)+ANIMAL_SPEC[t.h.id].h+.6,-t.a.pos.z).project(cam);const on=v.z<1&&Math.abs(v.x)<1.05&&Math.abs(v.y)<1.05;hunt.el.style.opacity=on?1:0;
  hunt.el.style.transform=`translate(${(v.x*.5+.5)*innerWidth}px,${(-v.y*.5+.5)*innerHeight}px) translate(-50%,-100%)`}
{const _ta=tickAnimals;tickAnimals=function(dt){_ta(dt);tickHuntAuto(dt);tickHuntBar()}}

/* ---- nature props ---- */
const PROP_SIZE={Rock_Medium_1:2.2,Rock_Medium_2:2,Rock_Medium_3:1.8,Pebble_Round_1:.45,Pebble_Round_2:.4,Pebble_Square_1:.4,Bush_Common:1.3,Bush_Common_Flowers:1.3,Fern_1:.9,Flower_3_Group:.5,Flower_4_Group:.5,
  Mushroom_Common:.45,Mushroom_Laetiporus:.5,Plant_1:.8,Plant_1_Big:1.8,Plant_7:.9,Plant_7_Big:2,Clover_1:.25,RockPath_Round_Wide:.25,RockPath_Square_Wide:.25,Grass_Wispy_Tall:.9,DeadTree_1:8,DeadTree_2:7.5,DeadTree_3:8.5,TwistedTree_1:7,TwistedTree_2:7};
const PROP_RECIPE={temperate:{Bush_Common_Flowers:3,Flower_3_Group:3,Flower_4_Group:3,Clover_1:4,Rock_Medium_1:1,Pebble_Round_1:2,Bush_Common:2},grass:{Flower_3_Group:3,Flower_4_Group:2,Clover_1:3,Grass_Wispy_Tall:4,Pebble_Round_2:2,Rock_Medium_2:.6},
  forest:{Fern_1:6,Mushroom_Common:3,Mushroom_Laetiporus:2,Bush_Common:3,Rock_Medium_3:1,Plant_7:2,Pebble_Round_1:1},jungle:{Plant_1_Big:4,Plant_7_Big:4,Fern_1:5,Plant_1:4,Mushroom_Laetiporus:1},
  swamp:{Fern_1:3,Plant_7:3,Mushroom_Common:3,Grass_Wispy_Tall:3,DeadTree_2:.3},tropical:{Plant_1_Big:3,Plant_7_Big:2,Plant_1:3,Bush_Common_Flowers:2,Pebble_Round_2:1},
  desert:{Rock_Medium_1:2,Rock_Medium_2:2,Pebble_Round_1:3,Pebble_Square_1:2,DeadTree_3:.15},badlands:{Rock_Medium_1:3,Rock_Medium_3:3,Pebble_Square_1:3,DeadTree_1:.25},glass:{Rock_Medium_2:2,Pebble_Round_2:3},
  ice:{Rock_Medium_1:2,Rock_Medium_2:2,Pebble_Round_1:2},volcanic:{Rock_Medium_3:3,Pebble_Square_1:3,DeadTree_1:.4,DeadTree_3:.3},abyss:{Mushroom_Common:3,Mushroom_Laetiporus:3,TwistedTree_2:.4,DeadTree_2:.4,Fern_1:2},
  ethereal:{Flower_3_Group:3,Flower_4_Group:3,Mushroom_Common:2,TwistedTree_1:.4,Bush_Common_Flowers:2},red:{TwistedTree_1:.5,TwistedTree_2:.5,DeadTree_1:.3,Bush_Common:3,Rock_Medium_3:2},storm:{Rock_Medium_1:2,Pebble_Round_1:2,Grass_Wispy_Tall:4}};
const PROP_TINT={red:[1.25,.75,.65],volcanic:[.55,.5,.5],abyss:[.7,.9,.9],ice:[.95,1,1.1],ethereal:[.9,.8,1.2],glass:[1.1,1.08,1]};
const propProto={};let propsP=null,propAt=null,propWorld=null;const propMeshes={};
function loadProps(){if(propsP)return propsP;const L=new THREE.GLTFLoader(),one=f=>loadScript('kits/'+f+'.js').then(()=>new Promise(res=>{const b64=(window.GRUDGE_PACK||{})[f];if(!b64)return res();const bin=atob(b64),buf=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)buf[i]=bin.charCodeAt(i);delete window.GRUDGE_PACK[f];
    L.parse(buf.buffer,'',g=>{g.scene.updateMatrixWorld(true);for(const root of g.scene.children){const box=new THREE.Box3().setFromObject(root),c=box.getCenter(new V3()),off=new THREE.Matrix4().makeTranslation(-c.x,-box.min.y,-c.z),parts=[];
      root.traverse(o=>{if(o.isMesh){const m=o.material,leaf=/leaf|leaves|flower|grass|fern|plant|clover|petal/i.test(m.name||'');parts.push({geo:o.geometry,mat:treeMat(m,leaf),m:off.clone().multiply(o.matrixWorld)})}});
      propProto[root.name]={parts,h:Math.max(.05,box.max.y-box.min.y),w:Math.max(box.max.x-box.min.x,box.max.z-box.min.z)}}res()},()=>res())})).catch(()=>{});
  return propsP=Promise.all([one('nature'),one('qtrees')])}
function populateProps(w,cx,cz){const R=quality==='low'?60:quality==='medium'?85:110,cell=4,rnd=mulberry((Math.floor(cx/8)*92821)^(Math.floor(cz/8)*68917)),G2=w.surfGrid,buckets={};if(!G2)return;
  for(let gx=-R;gx<=R;gx+=cell)for(let gz=-R;gz<=R;gz+=cell){const x=Math.round((cx+gx)/cell)*cell,z=Math.round((cz+gz)/cell)*cell;if((x-cx)**2+(z-cz)**2>R*R)continue;
    const h=strHash(x+'|'+z),r1=(h%1000)/1000;if(r1>.22)continue;if(onRoad(w,x,z)||waterDepth(w,x,z)>.3)continue;if(w.pois.some(q=>Math.hypot(q.x-x,q.z-z)<q.r*.95))continue;
    const b=biomeAt(w,x,z),rec=b.props||PROP_RECIPE[b.key]||PROP_RECIPE.temperate;let tot=0;for(const k in rec)tot+=rec[k];let pick=null,r=((h>>>10)%1000)/1000*tot;for(const k in rec){if((r-=rec[k])<=0){pick=k;break}}
    if(!pick||!propProto[pick])continue;const big=/Tree/.test(pick);if(big&&r1>.012)continue;(buckets[pick]||(buckets[pick]=[])).push([x+((h>>>4)%100/100-.5)*cell,z+((h>>>12)%100/100-.5)*cell,h,b.tint||PROP_TINT[b.key]])}
  // stepping stones along trails near you
  const RR=w._roads;if(RR&&propProto.RockPath_Round_Wide)for(const r of RR.roads){if(r.kind!=='trail')continue;for(let i=1;i<r.pts.length;i++){const p0=r.pts[i-1],p1=r.pts[i],L=Math.hypot(p1.x-p0.x,p1.z-p0.z);if(Math.hypot(p0.x-cx,p0.z-cz)>R+30)continue;
    for(let s=0;s<L;s+=2.6){const x=p0.x+(p1.x-p0.x)*s/L,z=p0.z+(p1.z-p0.z)*s/L;if((x-cx)**2+(z-cz)**2>R*R)continue;const h=strHash(Math.round(x*3)+'/'+Math.round(z*3));(buckets[h%2?'RockPath_Round_Wide':'RockPath_Square_Wide']||(buckets[h%2?'RockPath_Round_Wide':'RockPath_Square_Wide']=[])).push([x+((h%7)-3)*.15,z,h,null,1])}}}
  const M=new THREE.Matrix4(),q=new THREE.Quaternion(),s=new V3(),p=new V3(),c=new THREE.Color();for(const k in propMeshes)propMeshes[k].forEach(m=>m.count=0);
  for(const k in buckets){const P=propProto[k],list=buckets[k];let ms=propMeshes[k];if(!ms||ms[0].instanceMatrix.count<list.length){if(ms)ms.forEach(m=>FXG.remove(m));const cap=Math.max(64,list.length*1.5|0);ms=propMeshes[k]=P.parts.map(pt=>{const m=new THREE.InstancedMesh(pt.geo,pt.mat,cap);m.frustumCulled=false;m.userData.pm=pt.m;FXG.add(m);return m})}
    list.forEach(([x,z,h,tint,flat],i)=>{const sc=flat?(1.4+((h>>>6)%50)/100)/P.w:PROP_SIZE[k]*(.75+((h>>>6)%100)/100*.6)/P.h;q.setFromAxisAngle(new V3(0,1,0),((h>>>3)%628)/100);p.set(x,hGridAt(w,x,z)+(flat?.05:-.04),-z);s.setScalar(sc);M.compose(p,q,s);
      ms.forEach(m=>{m.setMatrixAt(i,M.clone().multiply(m.userData.pm));c.setRGB(1,1,1);if(tint)c.setRGB(tint[0],tint[1],tint[2]);m.setColorAt(i,c)})});
    ms.forEach(m=>{m.count=list.length;m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true})}
  propAt={x:cx,z:cz};propWorld=w}
function tickProps(dt){const w=groundWorld,on=level==='ground'&&w&&(groundMode==='play'||groundMode==='roam');for(const k in propMeshes)propMeshes[k].forEach(m=>m.visible=!!on);if(!on)return;if(!propsP){loadProps().then(()=>{propAt=null});return}
  const px=groundMode==='play'?play.x:roam.pos.x,pz=groundMode==='play'?play.z:-roam.pos.z;if(propWorld!==w||!propAt||Math.hypot(px-propAt.x,pz-propAt.z)>25)populateProps(w,px,pz)}

/* ================= Grudge model packs (castle kit, ancient fortress, palisade fortress, volcanic rocks, pond, wooden props) ================= */
// Each pack is a GLB published beside the page. Single pieces become instanced kit prototypes, re-oriented so walls run along +X.
const PACK_FILES={castle:'castle',ancient:'ancient',palisade:'fortress',rocks:'rocks',pond:'pond',props:'props',town:'town',colony:'colony',mars:'mars',spacekit:'spacekit'};
const PACK_PIECES={
  // Quaternius Ultimate Space Kit + Sci-fi Turrets (CC0): habitats, domes, solar, rovers, parked ships, turrets
  sk_base_large:['spacekit','sk_base_large'],sk_building_l:['spacekit','sk_building_l'],sk_connector:['spacekit','sk_connector'],sk_geodesic_dome:['spacekit','sk_geodesic_dome'],sk_house_cylinder:['spacekit','sk_house_cylinder'],sk_house_long:['spacekit','sk_house_long'],sk_house_open:['spacekit','sk_house_open'],sk_house_pod:['spacekit','sk_house_pod'],sk_house_single_support:['spacekit','sk_house_single_support'],sk_house_single:['spacekit','sk_house_single'],sk_metal_support:['spacekit','sk_metal_support'],sk_pickup_crate:['spacekit','sk_pickup_crate'],sk_ramp:['spacekit','sk_ramp'],sk_roof_antenna:['spacekit','sk_roof_antenna'],sk_roof_radar:['spacekit','sk_roof_radar'],sk_round_rover:['spacekit','sk_round_rover'],sk_rover_wr:['spacekit','sk_rover_wr'],sk_rover:['spacekit','sk_rover'],sk_solar_panel_ground:['spacekit','sk_solar_panel_ground'],sk_solar_panel_structure:['spacekit','sk_solar_panel_structure'],sk_solar_panel:['spacekit','sk_solar_panel'],sk_spaceship_jq:['spacekit','sk_spaceship_jq'],sk_spaceship_vs:['spacekit','sk_spaceship_vs'],sk_spaceship_u1:['spacekit','sk_spaceship_u1'],sk_spaceship:['spacekit','sk_spaceship'],sk_stairs:['spacekit','sk_stairs'],skt_emp:['spacekit','skt_emp'],skt_flamethrower:['spacekit','skt_flamethrower'],skt_gatelng_gun:['spacekit','skt_gatelng_gun'],skt_gun_cannon:['spacekit','skt_gun_cannon'],skt_hive:['spacekit','skt_hive'],skt_lighting:['spacekit','skt_lighting'],skt_missile:['spacekit','skt_missile'],skt_plasma:['spacekit','skt_plasma'],skt_rail_gun:['spacekit','skt_rail_gun'],skt_shield:['spacekit','skt_shield'],
  // Mars environment kit (SOLDMARS, CC BY 4.0), split into pieces from the Sketchfab diorama
  mk_rocket:['mars','mars_0'],mk_hab:['mars','mars_3'],mk_habL:['mars','mars_1'],mk_dish:['mars','mars_4'],mk_hangar:['mars','mars_14'],mk_turret:['mars','mars_10'],
  mk_turret2:['mars','mars_18'],mk_sensor:['mars','mars_11'],mk_shuttlepad:['mars','mars_32'],mk_shuttlepad2:['mars','mars_33'],mk_probepad:['mars','mars_17'],
  mk_rover:['mars','mars_26'],mk_rovers:['mars','mars_29'],mk_tanks:['mars','mars_41'],mk_drill:['mars','mars_7'],mk_monorail:['mars','mars_2'],mk_shuttle:['mars','mars_34'],
  mk_wreck:['mars','mars_35'],mk_crystaltrees:['mars','mars_66'],mk_bluetrees:['mars','mars_38'],mk_rock1:['mars','mars_63'],mk_rock2:['mars','mars_52'],mk_pillar:['mars','mars_50'],
  // sci-fi colony kit (Grudge ObjectStore, starway/armada): starports, shuttleports, installations
  col_runway:['colony','runway_strip'],col_gate:['colony','connecting_gateway'],col_research:['colony','research_center'],col_reactor:['colony','reactor'],
  col_solar:['colony','solar_panel'],col_drone:['colony','drone_carrier'],col_warehouse:['colony','resource_warehouse'],col_geo:['colony','geothermal_generator'],
  col_home:['colony','home_colonists'],col_house:['colony','main_house'],col_house2:['colony','main_house_2lv'],col_farm:['colony','farm'],
  col_cruiser:['colony','light_cruiser_01'],col_destroyer:['colony','destroyer_02'],col_tower:['colony','watchtower'],col_barrel:['colony','barrel'],
  ck_wall:['castle','Wall_Single',{alongX:1}],ck_wall2:['castle','Wall_Double',{alongX:1}],ck_gate:['castle','Gate_1_Open',{alongX:1}],ck_tower:['castle','Tower_1'],ck_tower2:['castle','Tower_2'],
  ak_wall:['ancient','Wall-Type02',{alongX:1}],ak_gate:['ancient','Gateway-Main',{alongX:1}],ak_gate2:['ancient','Gateway-Medium',{alongX:1}],ak_tower:['ancient','WatchTowerBastion01-Large'],ak_tower2:['ancient','WatchTowerBastion02-Large'],
  ak_wall2:['ancient','Wall-Type02WithWoodenWalkway',{alongX:1}],ak_bastion:['ancient','WatchTowerBastion-Small'],ak_ruin:['ancient','Wall-Type01CornerPiece'],ak_stairs:['ancient','Wall-Type02WithStairs',{alongX:1}],
  pal_ring:['palisade','PallisadeWall_Planks_Right_Cube043'],pal_wall:['palisade','PallisadeWall_Planks_Right_Cube004',{alongX:1}],pal_gate:['palisade','PallisadeWall_Planks_Right_Cube015',{alongX:1}],
  pal_tower:['palisade','PallisadeWall_Planks_Right_Cube035'],pal_tower2:['palisade','PallisadeWall_Planks_Right_Cube035'],pal_stand:['palisade','PallisadeWall_Planks_Right_Cube036'],
  rk_cliff1:['rocks','Cliff_06'],rk_cliff2:['rocks','Cliff_07'],rk_cliff3:['rocks','Cliff_03'],rk_spire1:['rocks','Cliff_Rock_02'],rk_spire2:['rocks','Cliff_Rock_06'],rk_rock1:['rocks','Rock_03'],rk_rock2:['rocks','Rock_04'],rk_lava:['rocks','Plane003_Plane005'],
  rk_ore_copper:['rocks','Rock_Copper'],rk_ore_gold:['rocks','Rock_Gold'],rk_ore_iron:['rocks','Rock_Iron'],rk_ore_tin:['rocks','Rock_Tin'],rk_ore_red:['rocks','Rock_Red'],
  pd_falls:['pond','Waterfall_Foam_Icosphere087'],pd_pond1:['pond','Waterfall_Foam_Icosphere456'],pd_pond2:['pond','Waterfall_Foam_Icosphere457'],
  pr_wood1:['props','Firewood_pile_05005'],pr_wood2:['props','Firewood_pile_05002'],pr_logs:['props','Firewood_pile_05012'],r2_town:['town','*']};
const packG={};let packsP=null;
function loadPacks(){if(packsP)return packsP;const L=new THREE.GLTFLoader();
  packsP=Promise.all(Object.entries(PACK_FILES).map(([k,f])=>loadScript('kits/'+f+'.js').then(()=>new Promise(res=>{const b64=(window.GRUDGE_PACK||{})[f];if(!b64)return res();const bin=atob(b64),buf=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)buf[i]=bin.charCodeAt(i);delete window.GRUDGE_PACK[f];
    L.parse(buf.buffer,'',g=>{packG[k]=g;res()},e=>{console.warn('pack '+k+' unavailable',e);res()})})).catch(e=>console.warn('pack '+k+' unavailable',e)))).then(()=>{
    for(const [key,[pack,node,opt]] of Object.entries(PACK_PIECES)){const g=packG[pack];if(!g)continue;let src=node==='*'?g.scene:null;g.scene.traverse(o=>{if(!src&&o.name.replace(/[._\s/]/g,'')===node.replace(/[._\s/]/g,''))src=o});if(!src)continue;
      src.updateMatrixWorld(true);const piece=src.clone(true),wrap=new THREE.Group(),inner=new THREE.Group();inner.add(piece);piece.matrix.copy(src.matrixWorld);piece.matrix.decompose(piece.position,piece.quaternion,piece.scale);wrap.add(inner);
      wrap.updateMatrixWorld(true);const sz=new THREE.Box3().setFromObject(wrap).getSize(new V3());if(opt&&opt.alongX&&sz.z>sz.x){inner.rotation.y=Math.PI/2;wrap.updateMatrixWorld(true)}
      wrap.traverse(o=>{if(o.isMesh){o.frustumCulled=false;(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{if('metalness' in m){m.metalness=0;m.roughness=1}if(m.map){m.map.encoding=THREE.LinearEncoding}m.needsUpdate=true})}});
      kitProto(key,{scene:wrap})}});
  return packsP}
// kit rules for pack pieces (checked before the KayKit rules); each has a KayKit fallback
const SK_TURRETS=['skt_gun_cannon','skt_rail_gun','skt_plasma','skt_missile','skt_gatelng_gun','mk_turret'];let skTurretN=0;
const PACK_RULES=[
  [/installation\/turret|turret_base/,()=>({k:SK_TURRETS[(skTurretN++)%SK_TURRETS.length],fit:'uni',len:6,alt:{k:'mk_turret',fit:'uni',len:6}})],[/radar_dish|antenna_tatt/,()=>({k:'mk_dish',fit:'uni',len:7})],
  [/tankfarm|item_tank_gas|item_tank_bubble/,()=>({k:'mk_tanks',fit:'uni',len:4})],[/static_speeder_bike/,()=>({k:'mk_rover',fit:'uni',len:3})],
  [/installation\/shared_mockup_factory/,()=>({k:'col_warehouse',fit:'fp',alt:{k:'kk_market',fit:'fp'}})],
  [/power_generator_solar/,()=>({k:'col_solar',fit:'uni',len:8})],[/power_generator_(fusion|photo_bio)/,()=>({k:'col_reactor',fit:'fp'})],
  [/power_generator_wind|corl_power_transformer/,()=>({k:'col_geo',fit:'uni',len:5})],[/mockup_farm_flora/,()=>({k:'col_farm',fit:'fp'})],
  [/mockup_mining_(liquid|gas)_harvester/,()=>({k:'col_drone',fit:'uni',len:5})],[/grudge\/(ck|ak|pal)_(wall2?|stairs)\b/,m=>({k:m[1]+'_'+m[2],fit:'wallh',alt:{k:'kk_wall_straight',fit:'wall'}})],
  [/grudge\/(ck|ak|pal)_gate2?\b/,m=>({k:m[0].split('/')[1],fit:'wallh',alt:{k:'kk_wall_gate',fit:'wall'}})],
  [/grudge\/(ck|ak|pal)_tower2?\b/,m=>({k:m[0].split('/')[1],fit:'hp',h:m[1]==='pal'?9:16,alt:{k:'kk_watchtower',fit:'h',h:15}})],
  [/grudge\/(ak_bastion|ak_ruin|pal_stand)\b/,m=>({k:m[1],fit:'uni',len:m[1]==='pal_stand'?6:16,alt:{k:'pillar',fit:'col',h:4,w:2}})],
  [/grudge\/pal_ring\b/,()=>({k:'pal_ring',fit:'uni',len:46,alt:{skip:1}})],
  [/grudge\/(rk_[a-z0-9_]+|pd_[a-z0-9]+|pr_[a-z0-9]+|r2_[a-z0-9]+)\b/,m=>({k:m[1],fit:'uni',len:1,alt:{k:'kk_detail_rocks',fit:'uni',len:6}})]];
function packRule(t){for(const [re,f] of PACK_RULES){const m=re.exec(t);if(m)return f(m)}return null}

/* ================= Quadruped gait: the mount models ship a Bip001 rig but no clips, so legs, spine, head and tail are driven here ================= */
// Swing axes are found in world space (the mount's own left-right axis), so the rig's local bone frames never matter.
function gaitRig(root){root.updateMatrixWorld(true);const norm=s=>s.replace(/[\s_]/g,'').toLowerCase(),by={};root.traverse(o=>{if(o.isBone||/bip001/i.test(o.name))by[norm(o.name)]=o});
  const get=n=>[by[norm('Bip001 '+n)],by[norm('Bip001 '+n+'001')]].filter(Boolean);if(!get('Pelvis').length)return null;
  const rootQ=new THREE.Quaternion();root.getWorldQuaternion(rootQ);const lat=new V3(1,0,0).applyQuaternion(rootQ),fwdAx=new V3(0,1,0).applyQuaternion(rootQ);
  const bones=[];const add=(names,role,side,front)=>names.forEach(n=>get(n).forEach(b=>{const wq=new THREE.Quaternion();b.getWorldQuaternion(wq);
    bones.push({b,rest:b.quaternion.clone(),axis:lat.clone().applyQuaternion(wq.clone().invert()).normalize(),yaw:fwdAx.clone().applyQuaternion(wq.clone().invert()).normalize(),role,side,front})}));
  add(['L Thigh'],'thigh',0,0);add(['R Thigh'],'thigh',1,0);add(['L Calf'],'calf',0,0);add(['R Calf'],'calf',1,0);add(['L Foot'],'foot',0,0);add(['R Foot'],'foot',1,0);
  add(['L UpperArm'],'thigh',0,1);add(['R UpperArm'],'thigh',1,1);add(['L Forearm'],'calf',0,1);add(['R Forearm'],'calf',1,1);add(['L Hand'],'foot',0,1);add(['R Hand'],'foot',1,1);
  add(['Spine'],'spine');add(['Neck'],'neck');add(['Head'],'head');add(['Tail'],'tail');add(['Tail1'],'tail2');
  const pel=get('Pelvis');return{bones,pel:pel.map(b=>({b,rest:b.position.clone()})),ph:Math.random()*TAU,amt:0,t:Math.random()*10,q:new THREE.Quaternion(),q2:new THREE.Quaternion()}}
// diagonal trot when walking, rotary gallop when running
const GAIT_PHASE={walk:[[0,.5],[.5,0]],gallop:[[.55,.65],[0,.1]]};
function gaitTick(R,dt,moving){if(!R)return;R.amt+=((moving?Math.min(2,moving):0)-R.amt)*Math.min(1,dt*4);R.t+=dt;const a=R.amt,run=a>1.3,freq=run?2.7:1.7;R.ph+=dt*TAU*freq*Math.max(.15,a>0.05?1:0);
  const P=run?GAIT_PHASE.gallop:GAIT_PHASE.walk,amp=run?.62:.36,still=1-Math.min(1,a);
  for(const B of R.bones){let ang=0;const ph=B.front!=null?P[B.front][B.side]*TAU:0,s=Math.sin(R.ph+ph);
    if(B.role==='thigh')ang=s*amp*Math.min(1,a)*(B.front?1:-1);
    else if(B.role==='calf')ang=Math.max(0,Math.sin(R.ph+ph+Math.PI/2))*amp*1.1*Math.min(1,a)*(B.front?-1:1);
    else if(B.role==='foot')ang=Math.max(0,-s)*amp*.6*Math.min(1,a);
    else if(B.role==='spine')ang=Math.sin(R.ph*2)*.04*a+Math.sin(R.t*1.3)*.015*still;
    else if(B.role==='neck')ang=Math.sin(R.ph*2+.6)*.07*a+Math.sin(R.t*.7)*.05*still;
    else if(B.role==='head')ang=-Math.sin(R.ph*2+.6)*.05*a;
    R.q.setFromAxisAngle(B.axis,ang);
    if(B.role==='tail'||B.role==='tail2'){R.q2.setFromAxisAngle(B.yaw,Math.sin(R.t*(a>0.1?6:2.2))*(.18+.12*a));R.q.multiply(R.q2)}
    if(B.role==='head'&&still>.5){R.q2.setFromAxisAngle(B.yaw,Math.sin(R.t*.31)*.25*still);R.q.multiply(R.q2)}
    B.b.quaternion.copy(B.rest).multiply(R.q)}
  for(const P2 of R.pel){P2.b.position.copy(P2.rest)}
  return Math.abs(Math.sin(R.ph*(run?1:2)))*(run?.09:.04)*a}

/* ================= Roads, navigation and daily routes ================= */
// 1) Road network per world: worn dirt roads between settlements, trails to camps and landmarks, cobbled streets inside towns.
//    Texture is generated from the world seed, so every planet wears its roads differently.
// 2) City navigation: a top-down height render of the town (every kit building, wall and prop) becomes a walkable grid; A* + string pulling.
// 3) Daily routes: townsfolk follow a schedule (home, work, market at noon, tavern at dusk) along those paths; travellers walk the roads.
// 4) Player navigation: pick a destination, the route is drawn on the ground and N auto-travels along it.
// one texture per planet and road kind, kept for return visits (they are marked _keep so the ground clear leaves them)
const ROAD_TEX={};
function roadTexture(w,kind){const key=w.id+':'+kind;return ROAD_TEX[key]||(ROAD_TEX[key]=roadTexture0(w,kind))}
function roadTexture0(w,kind){const c=document.createElement('canvas');c.width=128;c.height=256;const x=c.getContext('2d'),R=mulberry(w.seed^(kind==='cobble'?0xc0b:0xd1f)),S=w.surf||SURF.temperate;
  const soil=col(S.soil||'#7a6644'),rock=col(S.rock||'#6f6a62'),sand=col(S.sand||'#cbbf94'),hex=c3=>'#'+c3.getHexString();
  if(kind==='cobble'){x.fillStyle=hex(rock.clone().multiplyScalar(.72));x.fillRect(0,0,128,256);
    for(let row=0;row<16;row++)for(let k=0;k<6;k++){const w2=18+R()*8,h2=13+R()*4,px=k*22+(row%2)*11+R()*3-4,py=row*16+R()*2;const t=rock.clone().lerp(sand,.2+R()*.45).multiplyScalar(1.05+R()*.35);
      x.fillStyle=hex(t);x.beginPath();x.roundRect?x.roundRect(px,py,w2,h2,4):x.rect(px,py,w2,h2);x.fill();x.fillStyle='rgba(255,255,255,.08)';x.fillRect(px+2,py+1,w2-4,3)}}
  else{x.fillStyle=hex(soil.clone().lerp(sand,.25));x.fillRect(0,0,128,256);
    for(let i=0;i<900;i++){const t=soil.clone().lerp(i%3?sand:rock,R()*.6).multiplyScalar(.75+R()*.5);x.fillStyle=hex(t);const s=1+R()*3;x.fillRect(R()*128,R()*256,s,s)}
    x.fillStyle='rgba(30,22,14,.28)';for(const rx of [34,94]){for(let y=0;y<256;y+=2)x.fillRect(rx+Math.sin(y*.05)*2-4,y,8,2)}
    for(let i=0;i<40;i++){x.fillStyle='rgba(20,15,10,.25)';x.beginPath();x.ellipse(R()*128,R()*256,3+R()*6,2+R()*4,0,0,TAU);x.fill()}}
  // soft worn edges: grass creeps in from both sides
  const g=x.getImageData(0,0,128,256),d=g.data;for(let y=0;y<256;y++)for(let i=0;i<128;i++){const e=Math.min(i,127-i)/128,fray=noise3(i*.15,y*.08,1,w.seed%997);const a=Math.max(0,Math.min(1,(e-.04-fray*.12)/.14));d[(y*128+i)*4+3]=Math.round(a*255)}
  x.putImageData(g,0,0);const t=new THREE.CanvasTexture(c);t.wrapS=THREE.ClampToEdgeWrapping;t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;t._keep=true;return t}
function roadPoly(w,a,b,rnd,wig=1){const pts=[],L=Math.hypot(b.x-a.x,b.z-a.z),n=Math.max(2,Math.ceil(L/22)),nx=-(b.z-a.z)/L,nz=(b.x-a.x)/L,amp=Math.min(70,L*.07)*wig,ph=rnd()*100;
  for(let i=0;i<=n;i++){const t=i/n,off=(noise3(t*L/260+ph,2,ph,w.seed%991)-.5)*2*amp*Math.sin(Math.PI*t);pts.push({x:a.x+(b.x-a.x)*t+nx*off,z:a.z+(b.z-a.z)*t+nz*off})}return pts}
// gates of a generated realm city sit at 0, 90, 180 and 270 degrees on the wall ring
function edgePoint(q,tx,tz){const an=Math.atan2(tz-q.z,tx-q.x);if(q.realmCity){const g=Math.round(an/(Math.PI/2))*(Math.PI/2);return{x:q.x+Math.cos(g)*q.r*1.02,z:q.z+Math.sin(g)*q.r*1.02,gate:g}}return{x:q.x+Math.cos(an)*q.r*.9,z:q.z+Math.sin(an)*q.r*.9}}
function planRoads(w){if(w._roads)return w._roads;const rnd=mulberry(w.seed^0x7a11),roads=[],P=w.pois,hubs=P.filter(q=>q.cat==='city'||q.cat==='military'),minor=P.filter(q=>q.cat==='ruin'||q.cat==='camp'||q.cat==='landmark'||q.cat==='crash');
  // minimum spanning tree over the settlements, plus one extra link per hub for loops
  const inT=new Set(),edges=[];if(hubs.length){inT.add(hubs[0]);while(inT.size<hubs.length){let best=null;for(const a of inT)for(const b of hubs){if(inT.has(b))continue;const d=Math.hypot(a.x-b.x,a.z-b.z);if(!best||d<best[2])best=[a,b,d]}if(!best)break;inT.add(best[1]);edges.push([best[0],best[1],'road'])}
    for(const a of hubs){const near=hubs.filter(b=>b!==a&&!edges.some(e=>(e[0]===a&&e[1]===b)||(e[0]===b&&e[1]===a))).sort((p,q)=>Math.hypot(p.x-a.x,p.z-a.z)-Math.hypot(q.x-a.x,q.z-a.z))[0];if(near&&Math.hypot(near.x-a.x,near.z-a.z)<6000&&rnd()<.5)edges.push([a,near,'road'])}}
  for(const m of minor){const near=hubs.slice().sort((p,q)=>Math.hypot(p.x-m.x,p.z-m.z)-Math.hypot(q.x-m.x,q.z-m.z))[0];if(near&&Math.hypot(near.x-m.x,near.z-m.z)<5200)edges.push([near,m,m.cat==='ruin'?'road':'trail'])}
  for(const [a,b,kind] of edges){const s=edgePoint(a,b.x,b.z),e=edgePoint(b,a.x,a.z);const pts=roadPoly(w,s,e,rnd,kind==='trail'?1.4:1);roads.push({a,b,kind,pts,w:kind==='road'?(a.cat==='city'&&b.cat==='city'?7:5.5):3.2})}
  // starports and shuttleports join the nearest road
  for(const t of w.placements.filter(p=>p.k==='travel')){const q=hubs.find(h=>Math.hypot(h.x-t.x,h.z-t.z)<h.r*1.6);if(!q)continue;const s=edgePoint(q,t.x,t.z);roads.push({a:q,b:null,kind:'road',pts:roadPoly(w,s,{x:t.x,z:t.z},rnd,.2),w:6})}
  // streets: radial avenues from the plaza to each gate, plus two ring streets
  for(const q of P.filter(q=>q.cat==='city')){const gates=q.realmCity?[0,1,2,3].map(k=>k*Math.PI/2):[...new Set(roads.filter(r=>r.a===q||r.b===q).map(r=>Math.round(Math.atan2(r.pts[r.a===q?0:r.pts.length-1].z-q.z,r.pts[r.a===q?0:r.pts.length-1].x-q.x)*4/Math.PI)*Math.PI/4))];
    for(const g of gates){const pts=[];for(let k=0;k<=8;k++){const r=q.r*(.08+.95*k/8);pts.push({x:q.x+Math.cos(g)*r,z:q.z+Math.sin(g)*r})}roads.push({a:q,kind:'street',pts,w:q.realmCity?6:5})}
    if(q.realmCity)for(const rf of [.45,.8]){const pts=[];for(let k=0;k<=48;k++){const an=k/48*TAU;pts.push({x:q.x+Math.cos(an)*q.r*rf,z:q.z+Math.sin(an)*q.r*rf})}roads.push({a:q,kind:'street',pts,w:4.5})}}
  // a coarse mask so ground cover does not grow on roads
  const mask=new Set();for(const r of roads)for(let i=1;i<r.pts.length;i++){const p0=r.pts[i-1],p1=r.pts[i],L=Math.hypot(p1.x-p0.x,p1.z-p0.z),n=Math.ceil(L/2);for(let k=0;k<=n;k++){const x=p0.x+(p1.x-p0.x)*k/n,z=p0.z+(p1.z-p0.z)*k/n;
    for(let o=-r.w/2;o<=r.w/2;o+=2){const nx=-(p1.z-p0.z)/L,nz=(p1.x-p0.x)/L;mask.add(Math.round((x+nx*o)/2.5)*16384+Math.round((z+nz*o)/2.5))}}}
  // a graph over all road points for routing
  const nodes=[],adj=[],key=new Map(),id=p=>{const k=Math.round(p.x/6)+','+Math.round(p.z/6);if(key.has(k))return key.get(k);const n=nodes.length;nodes.push({x:p.x,z:p.z});adj.push([]);key.set(k,n);return n};
  for(const r of roads){let prev=null;for(const p of r.pts){const n=id(p);if(prev!=null&&prev!==n){const d=Math.hypot(nodes[n].x-nodes[prev].x,nodes[n].z-nodes[prev].z);adj[n].push([prev,d]);adj[prev].push([n,d])}prev=n}}
  // stitch nearby ends (gates to streets, trails to roads)
  for(let i=0;i<nodes.length;i++)if(adj[i].length<=1)for(let j=0;j<nodes.length;j++){if(i===j)continue;const d=Math.hypot(nodes[i].x-nodes[j].x,nodes[i].z-nodes[j].z);if(d<40&&!adj[i].some(e=>e[0]===j)){adj[i].push([j,d]);adj[j].push([i,d])}}
  return w._roads={roads,mask,nodes,adj}}
const onRoad=(w,x,z)=>!!(w._roads&&w._roads.mask.has(Math.round(x/2.5)*16384+Math.round(z/2.5)));
function buildRoads(w){const R=planRoads(w);if(!w.hGrid)return;const mats={road:null,street:null};
  const mk=kind=>new THREE.MeshLambertMaterial({map:roadTexture(w,kind==='street'?'cobble':'dirt'),side:THREE.DoubleSide,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-4});
  const groups={};for(const r of R.roads){const kind=r.kind==='street'?'street':'road';(groups[kind]||(groups[kind]={pos:[],uv:[],idx:[]}));const G2=groups[kind];
    const pts=[];for(let i=0;i<r.pts.length;i++){if(i){const a=r.pts[i-1],b=r.pts[i],L=Math.hypot(b.x-a.x,b.z-a.z),n=Math.ceil(L/9);for(let k=1;k<n;k++)pts.push({x:a.x+(b.x-a.x)*k/n,z:a.z+(b.z-a.z)*k/n})}pts.push(r.pts[i])}
    let v=0;const base=G2.pos.length/3;
    pts.forEach((p,i)=>{const a=pts[Math.max(0,i-1)],b=pts[Math.min(pts.length-1,i+1)],L=Math.hypot(b.x-a.x,b.z-a.z)||1,nx=-(b.z-a.z)/L,nz=(b.x-a.x)/L;if(i)v+=Math.hypot(p.x-pts[i-1].x,p.z-pts[i-1].z)/(r.w*2);
      for(const s of [-1,1]){const x=p.x+nx*s*r.w/2,z=p.z+nz*s*r.w/2;G2.pos.push(x,hGridAt(w,x,z)+.22,-z);G2.uv.push(s<0?0:1,v)}
      if(i){const k=base+i*2;G2.idx.push(k-2,k-1,k,k-1,k+1,k)}})}
  for(const kind in groups){const G2=groups[kind],g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(G2.pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(G2.uv,2));g.setIndex(G2.idx);
    g.setAttribute('normal',new THREE.Float32BufferAttribute(new Array(G2.pos.length).fill(0).map((_,i)=>i%3===1?1:0),3));const m=new THREE.Mesh(g,mk(kind));m.renderOrder=1;m.frustumCulled=false;G.ground.add(m)}}

/* ---- city navigation grid from a top-down height render ---- */
const NAV_HMAT=new THREE.ShaderMaterial({uniforms:{base:{value:0}},vertexShader:`uniform float base;varying float vH;
  #include <common>
  #include <skinning_pars_vertex>
  void main(){
  #include <skinbase_vertex>
  #include <begin_vertex>
  #include <skinning_vertex>
  vec4 wp=vec4(transformed,1.);
  #ifdef USE_INSTANCING
  wp=instanceMatrix*wp;
  #endif
  wp=modelMatrix*wp;vH=wp.y-base;gl_Position=projectionMatrix*viewMatrix*wp;}`,fragmentShader:`varying float vH;void main(){float h=clamp((vH+16.)/64.,0.,1.);gl_FragColor=vec4(h,fract(h*255.),0.,1.);}`,side:THREE.DoubleSide});
function cityNav(w,q){if(q._nav!==undefined&&q._navW===w)return q._nav;if(!kitReady||!w.kitsApplied||groundWorld!==w)return null;
  const half=q.r*1.12,cell=Math.max(2.5,half*2/320),N=Math.ceil(half*2/cell),rt=new THREE.WebGLRenderTarget(N,N),cam2=new THREE.OrthographicCamera(-half,half,half,-half,1,1200);
  cam2.position.set(q.x,(q.base||0)+600,-q.z);cam2.up.set(0,0,-1);cam2.lookAt(q.x,0,-q.z);NAV_HMAT.uniforms.base.value=q.base||0;
  const kv=kitMeshes.filter(m=>!m.visible);kv.forEach(m=>m.visible=true);
  const hid=[];G.ground.traverse(o=>{if(o!==G.ground&&o.visible&&(o===toonGroup||o===skyMesh||(o.material&&o.material.transparent&&!o.isInstancedMesh)||o.isLine||o.isSprite)){o.visible=false;hid.push(o)}});
  const prevT=renderer.getRenderTarget(),prevC=renderer.getClearColor(new THREE.Color()),prevA=renderer.getClearAlpha(),bg=scene.background,fog=scene.fog,fx=FXG.visible;scene.background=null;scene.fog=null;FXG.visible=false;scene.overrideMaterial=NAV_HMAT;
  renderer.setRenderTarget(rt);renderer.setClearColor(0x000000,0);renderer.clear();renderer.render(scene,cam2);const px=new Uint8Array(N*N*4);renderer.readRenderTargetPixels(rt,0,0,N,N,px);
  scene.overrideMaterial=null;renderer.setRenderTarget(prevT);renderer.setClearColor(prevC,prevA);scene.background=bg;scene.fog=fog;FXG.visible=fx;hid.forEach(o=>o.visible=true);kv.forEach(m=>m.visible=false);rt.dispose();
  const block=new Uint8Array(N*N);for(let j=0;j<N;j++)for(let i=0;i<N;i++){const k=(j*N+i)*4,h=px[k]/255*64-16,x=q.x-half+(i+.5)*cell,z=q.z-half+(j+.5)*cell,gnd=groundH(w,x,z)-(q.base||0);
    block[j*N+i]=px[k+3]===0?0:(h-gnd>1.6||waterDepth(w,x,z)>.8)?1:0}
  // keep one cell of clearance from walls and buildings
  const out=Uint8Array.from(block);for(let j=1;j<N-1;j++)for(let i=1;i<N-1;i++)if(!block[j*N+i]&&(block[j*N+i-1]||block[j*N+i+1]||block[(j-1)*N+i]||block[(j+1)*N+i]))out[j*N+i]=2;
  q._navW=w;return q._nav={N,cell,ox:q.x-half,oz:q.z-half,block:out}}
function navCell(nav,x,z){return[Math.floor((x-nav.ox)/nav.cell),Math.floor((z-nav.oz)/nav.cell)]}
function navFree(nav,i,j,soft){if(i<0||j<0||i>=nav.N||j>=nav.N)return false;const b=nav.block[j*nav.N+i];return b===0||(soft&&b===2)}
function navSnap(nav,x,z){let [i,j]=navCell(nav,x,z);if(navFree(nav,i,j))return[i,j];for(let r=1;r<40;r++)for(let a=-r;a<=r;a++)for(const [di,dj] of [[a,-r],[a,r],[-r,a],[r,a]])if(navFree(nav,i+di,j+dj))return[i+di,j+dj];return null}
function navLOS(nav,a,b){const n=Math.max(Math.abs(b[0]-a[0]),Math.abs(b[1]-a[1]));for(let k=1;k<n;k++){const i=Math.round(a[0]+(b[0]-a[0])*k/n),j=Math.round(a[1]+(b[1]-a[1])*k/n);if(!navFree(nav,i,j,true))return false}return true}
function navPath(nav,x0,z0,x1,z1){const s=navSnap(nav,x0,z0),g=navSnap(nav,x1,z1);if(!s||!g)return null;const N=nav.N,S=s[1]*N+s[0],Gk=g[1]*N+g[0];if(S===Gk)return[];
  const gs=new Float32Array(N*N).fill(1e9),from=new Int32Array(N*N).fill(-1),open=[[0,S]],closed=new Uint8Array(N*N);gs[S]=0;let it=0;
  const push=(f,k)=>{open.push([f,k]);let c=open.length-1;while(c>0){const p=(c-1)>>1;if(open[p][0]<=open[c][0])break;[open[p],open[c]]=[open[c],open[p]];c=p}};
  const pop=()=>{const top=open[0],last=open.pop();if(open.length){open[0]=last;let c=0;for(;;){const l=c*2+1,r=l+1;let m=c;if(l<open.length&&open[l][0]<open[m][0])m=l;if(r<open.length&&open[r][0]<open[m][0])m=r;if(m===c)break;[open[m],open[c]]=[open[c],open[m]];c=m}}return top};
  while(open.length&&it++<60000){const [,k]=pop();if(closed[k])continue;closed[k]=1;if(k===Gk)break;const i=k%N,j=(k/N)|0;
    for(let di=-1;di<=1;di++)for(let dj=-1;dj<=1;dj++){if(!di&&!dj)continue;const ni=i+di,nj=j+dj;if(!navFree(nav,ni,nj,true))continue;if(di&&dj&&(!navFree(nav,i+di,j,true)||!navFree(nav,i,j+dj,true)))continue;
      const nk=nj*N+ni,c=gs[k]+(di&&dj?1.414:1)*(nav.block[nk]===2?2.5:1);if(c<gs[nk]){gs[nk]=c;from[nk]=k;const hx=Math.abs(ni-g[0]),hz=Math.abs(nj-g[1]);push(c+Math.max(hx,hz)+.414*Math.min(hx,hz),nk)}}}
  if(from[Gk]<0)return null;const cells=[];for(let k=Gk;k!==S&&k>=0;k=from[k])cells.push([k%N,(k/N)|0]);cells.push(s);cells.reverse();
  const out=[];let anchor=cells[0];for(let k=2;k<cells.length;k++)if(!navLOS(nav,anchor,cells[k])){anchor=cells[k-1];out.push(anchor)}out.push(cells[cells.length-1]);
  return out.map(([i,j])=>({x:nav.ox+(i+.5)*nav.cell,z:nav.oz+(j+.5)*nav.cell}))}
// once a town's grid exists, move anyone standing inside a wall or house out onto the street
function settleCity(w,q,nav){if(q._settled)return;q._settled=true;for(const p of w.placements){if(p.k!=='npc'&&p.k!=='travel')continue;if(Math.hypot(p.x-q.x,p.z-q.z)>q.r*1.1)continue;const [i,j]=navCell(nav,p.x,p.z);if(navFree(nav,i,j))continue;const s=navSnap(nav,p.x,p.z);if(s){p.x=nav.ox+(s[0]+.5)*nav.cell;p.z=nav.oz+(s[1]+.5)*nav.cell}}}

/* ---- daily routes ---- */
const ROUTE_SPOTS={work:{Merchant:/market|stall|bank|vendor|shop/,Artisan:/lumber|forge|garage|hangar|factory|guild|mill/,Laborer:/farm|field|mill|lumber|mine/,Innkeeper:/cantina|tavern|inn|hotel/,Bard:/cantina|tavern|theater/,
  Priest:/cloning|temple|cathedral|chapel/,Healer:/cloning|hospital|medical/,Noble:/keep|castle|palace|capitol|bank/,Captain:/keep|barracks|guard_tower|castle/,Traveler:/cantina|market|starport/},
  market:/market|stall|fountain|plaza/,tavern:/cantina|tavern|inn|theater/};
function citySpot(w,q,re,seed){const list=w.placements.filter(p=>p.k!=='npc'&&p.t&&re.test(p.t)&&Math.hypot(p.x-q.x,p.z-q.z)<q.r);if(!list.length)return null;const b=list[seed%list.length],dx=q.x-b.x,dz=q.z-b.z,d=Math.hypot(dx,dz)||1,off=Math.max(b.w||6,b.d||6)/2+3;
  return{x:b.x+dx/d*off,z:b.z+dz/d*off}}
function dailyRoute(u,ai,g,w){const q=w.pois.find(p=>p.cat==='city'&&Math.hypot(p.x-u.home.x,p.z-u.home.z)<p.r*1.05);if(!q)return false;const nav=cityNav(w,q);if(!nav)return false;settleCity(w,q,nav);
  const h=gameHour(),seed=strHash(g.name||'x'),role=g.role||'Villager';let dest=null,goal='stroll';
  if(h>=22||h<6){dest=u.home;goal='rest'}
  else if(h>=12&&h<14){dest=citySpot(w,q,ROUTE_SPOTS.market,seed)||{x:q.x+q.r*.17,z:q.z};goal='gather'}
  else if(h>=18){dest=citySpot(w,q,ROUTE_SPOTS.tavern,seed);goal=role==='Bard'?'gather':Math.random()<.6?'gather':'stroll'}
  else{const re=ROUTE_SPOTS.work[role];dest=re?citySpot(w,q,re,seed):null;goal='work';if(!dest&&Math.random()<.5)dest=citySpot(w,q,/house|home|dwelling/,seed+Math.floor(h))}
  if(!dest){const a=Math.random()*TAU,r=q.r*(.2+Math.random()*.5);dest={x:q.x+Math.cos(a)*r,z:q.z+Math.sin(a)*r}}
  if(Math.hypot(dest.x-u.pos.x,dest.z-u.pos.z)<4)return false;const path=navPath(nav,u.pos.x,u.pos.z,dest.x,dest.z);if(!path||!path.length)return false;
  u.path=path;u.target=u.path.shift();ai.goal=goal;return true}

/* ---- road travellers: pilgrims, couriers and merchants walk between settlements ---- */
let travellers=[],travT=0;
let navProbeT=0;
function tickTravellers(dt){if(!groundWorld||groundMode!=='play'){return}const w=groundWorld,R=w._roads;if(!R)return;travT-=dt;
  navProbeT-=dt;if(navProbeT<=0){navProbeT=2;const q=w.pois.find(p=>p.cat==='city'&&Math.hypot(p.x-play.x,p.z-play.z)<p.r*1.4);if(q){const nav=cityNav(w,q);if(nav)settleCity(w,q,nav)}}
  if(travT<=0&&travellers.length<6){travT=6;const roads=R.roads.filter(r=>r.kind!=='street'&&r.pts.length>3);const near=roads.filter(r=>r.pts.some(p=>Math.hypot(p.x-play.x,p.z-play.z)<260));
    if(near.length){const r=near[Math.random()*near.length|0],dir=Math.random()<.5,pts=dir?r.pts.slice():r.pts.slice().reverse();let k=pts.findIndex(p=>Math.hypot(p.x-play.x,p.z-play.z)<260);k=Math.max(0,k-2);
      const race=GD.races[Math.random()*GD.races.length|0].id,cls=GD.classes[Math.random()*GD.classes.length|0].id,obj=toonInstance(race,{race,cls,set:GD.armorSets[Math.random()*GD.armorSets.length|0],tier:1+(Math.random()*3|0)},{lit:'lambert'});
      if(obj){G.ground.add(obj);travellers.push({obj,pts,k,pos:{x:pts[k].x,z:pts[k].z},yaw:0,name:npcName(strHash(race+Date.now()))+' the '+['Pilgrim','Courier','Peddler','Wanderer','Drover'][Math.random()*5|0]})}}}
  for(let i=travellers.length-1;i>=0;i--){const T=travellers[i],tgt=T.pts[T.k+1];if(!tgt||Math.hypot(T.pos.x-play.x,T.pos.z-play.z)>400){G.ground.remove(T.obj);travellers.splice(i,1);continue}
    const dx=tgt.x-T.pos.x,dz=tgt.z-T.pos.z,d=Math.hypot(dx,dz),st=1.35*dt;if(d<1)T.k++;else{T.pos.x+=dx/d*st;T.pos.z+=dz/d*st;T.yaw=Math.atan2(dx,-dz)}
    T.obj.position.set(T.pos.x,groundH(w,T.pos.x,T.pos.z),-T.pos.z);T.obj.rotation.y=T.yaw;animateAny(T.obj,now()*7,1)}}
function clearTravellers(){travellers.forEach(T=>T.obj.parent&&T.obj.parent.remove(T.obj));travellers=[]}

/* ---- player navigation: route along the roads, drawn on the ground; N auto-travels ---- */
let route=null,routeLine=null,autoNav=false;
function roadRoute(w,x0,z0,x1,z1){const R=planRoads(w),N=R.nodes,near=(x,z)=>{let b=-1,bd=1e18;for(let i=0;i<N.length;i++){const d=(N[i].x-x)**2+(N[i].z-z)**2;if(d<bd){bd=d;b=i}}return[b,Math.sqrt(bd)]};
  const [s,ds]=near(x0,z0),[g,dg]=near(x1,z1);if(s<0||g<0||ds+dg>Math.hypot(x1-x0,z1-z0)*1.2)return[{x:x1,z:z1}];
  const dist=new Float64Array(N.length).fill(1e18),from=new Int32Array(N.length).fill(-1),done=new Uint8Array(N.length);dist[s]=0;const open=[s];
  while(open.length){let bi=0;for(let i=1;i<open.length;i++)if(dist[open[i]]+Math.hypot(N[open[i]].x-x1,N[open[i]].z-z1)<dist[open[bi]]+Math.hypot(N[open[bi]].x-x1,N[open[bi]].z-z1))bi=i;const k=open.splice(bi,1)[0];if(done[k])continue;done[k]=1;if(k===g)break;
    for(const [n,d] of R.adj[k])if(dist[k]+d<dist[n]){dist[n]=dist[k]+d;from[n]=k;open.push(n)}}
  if(from[g]<0&&s!==g)return[{x:x1,z:z1}];const out=[];for(let k=g;k>=0;k=from[k]){out.push({x:N[k].x,z:N[k].z});if(k===s)break}out.reverse();out.push({x:x1,z:z1});return out}
function setRoute(dest,label){if(!groundWorld)return;route={pts:roadRoute(groundWorld,play.x,play.z,dest.x,dest.z),label:label||'Destination',dest};drawRoute();mmLog(`Route set to ${route.label} · ${fmt(routeLen())} m. Press N to auto-travel.`,'sys');if(typeof setWaypoint==='function')try{setWaypoint(dest.x,dest.z,route.label)}catch(e){}}
function routeLen(){if(!route)return 0;let L=Math.hypot(route.pts[0].x-play.x,route.pts[0].z-play.z);for(let i=1;i<route.pts.length;i++)L+=Math.hypot(route.pts[i].x-route.pts[i-1].x,route.pts[i].z-route.pts[i-1].z);return L}
function drawRoute(){if(routeLine){G.ground.remove(routeLine);routeLine.geometry.dispose();routeLine=null}if(!route||!groundWorld)return;const pts=[];let prev={x:play.x,z:play.z};
  for(const p of route.pts){const L=Math.hypot(p.x-prev.x,p.z-prev.z),n=Math.max(1,Math.ceil(L/6));for(let k=1;k<=n;k++){const x=prev.x+(p.x-prev.x)*k/n,z=prev.z+(p.z-prev.z)*k/n;pts.push(new V3(x,hGridAt(groundWorld,x,z)+.6,-z))}prev=p}
  if(pts.length<2)return;routeLine=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineDashedMaterial({color:0x6ff0ff,dashSize:2.2,gapSize:1.6,transparent:true,opacity:.9,depthTest:false}));routeLine.computeLineDistances();routeLine.renderOrder=5;G.ground.add(routeLine)}
function clearRoute(msg){route=null;autoNav=false;keys.delete('w');drawRoute();if(msg)mmLog(msg,'sys')}
let routeT=0;
function tickRoute(dt){if(!route||groundMode!=='play')return;while(route.pts.length>1&&Math.hypot(route.pts[0].x-play.x,route.pts[0].z-play.z)<(play.mount?9:5))route.pts.shift();
  const last=route.pts[route.pts.length-1];if(Math.hypot(last.x-play.x,last.z-play.z)<(play.mount?12:6)){clearRoute(`You arrive at ${route.label}.`);return}
  routeT-=dt;if(routeT<=0){routeT=1.5;drawRoute()}
  if(autoNav){const p=route.pts[0],want=Math.atan2(-(p.x-play.x),p.z-play.z);let d=((want-play.camYaw+Math.PI)%TAU+TAU)%TAU-Math.PI;play.camYaw+=d*Math.min(1,dt*3);keys.add('w')}}
addEventListener('keydown',e=>{if(/INPUT|TEXTAREA/.test(e.target.tagName)||groundMode!=='play'||!CH)return;const k=e.key.toLowerCase();
  if(k==='n'){if(!route)return toast('Set a route first: open the map (Codex › Realms or the Navigate window).');autoNav=!autoNav;if(!autoNav)keys.delete('w');mmLog(autoNav?`Auto-travel to ${route.label}. Press N or move to stop.`:'Auto-travel off.','sys')}
  else if(autoNav&&['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(k)){autoNav=false}});
// the Navigate window: every settlement, dungeon, camp and landmark on this world
function winNavigate(B){$('#gwTitle').textContent='Navigate';if(!groundWorld){B.innerHTML='<p class="gw-note">Land on a world first.</p>';return}
  const w=groundWorld,list=w.pois.map(q=>({q,d:Math.hypot(q.x-play.x,q.z-play.z)})).sort((a,b)=>a.d-b.d),cat=q=>q.dungeon?'Dungeon':q.cat==='city'?(q.capital?'Capital':'Town'):CATS[q.cat]||q.cat;
  const tps=travelPoints(w).map(t=>({q:{name:t.name,x:t.x,z:t.z,cat:t.star?'Starport':'Shuttleport'},d:Math.hypot(t.x-play.x,t.z-play.z)}));
  B.innerHTML=`<p class="gw-note">Pick a destination. The route follows the roads, is drawn on the ground and shows on your compass. Press <kbd>N</kbd> to auto-travel, any movement key to take over.</p>
   ${route?`<p><b>Current route:</b> ${esc(route.label)} · ${fmt(routeLen())} m <button class="btn mini" id="navClear">Clear</button></p>`:''}
   <ul class="gw-list nav-list">${list.concat(tps).sort((a,b)=>a.d-b.d).slice(0,60).map((o,i)=>`<li><span><b>${esc(o.q.name)}</b> <small>${esc(o.q.cat==='Starport'||o.q.cat==='Shuttleport'?o.q.cat:cat(o.q))} · ${fmt(o.d)} m</small></span><button class="btn mini" data-nv="${i}">Route</button></li>`).join('')}</ul>`;
  const all=list.concat(tps).sort((a,b)=>a.d-b.d).slice(0,60);B.querySelectorAll('[data-nv]').forEach(b=>b.onclick=()=>{const o=all[+b.dataset.nv];setRoute({x:o.q.x,z:o.q.z},o.q.name);closeWin()});
  $('#navClear')&&($('#navClear').onclick=()=>{clearRoute('Route cleared.');renderWin()})}

/* ================= UI system: layers, movable centred windows, icon buttons, movable HUD panels, UI scale ================= */
// Icon set (24px line icons, drawn in the HUD's gold): every HUD button is an icon with its hotkey; the name lives in the tooltip.
const UI_ICON={
  inventory:'<path d="M7 8V6a5 5 0 0 1 10 0v2"/><path d="M4 8h16l-1.5 12.5a1.5 1.5 0 0 1-1.5 1.5H7a1.5 1.5 0 0 1-1.5-1.5Z"/><path d="M9 12h6"/>',
  skills:'<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H19v16H5.5A1.5 1.5 0 0 0 4 20.5Z"/><path d="M4 20.5A1.5 1.5 0 0 0 5.5 22H19v-3"/><path d="m11.5 7 1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.4-1.3-2.3 1.3.4-2.6-1.9-1.8 2.6-.4Z"/>',
  craft:'<path d="m14 4 6 6-3 3-6-6Z"/><path d="m11 7-8 8 3 3 8-8"/><path d="M3 21h8"/>',
  survey:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M12 12 18 6"/><circle cx="12" cy="12" r="1"/>',
  harvester:'<path d="M6 21V10l6-5 6 5v11"/><path d="M12 5V2"/><path d="M9 21v-6h6v6"/><path d="M3 21h18"/>',
  missions:'<path d="M6 3h11a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5"/><path d="M5 5a2 2 0 1 1 0 4h2"/><path d="M9 9h6M9 13h6M9 17h4"/>',
  command:'<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>',
  mounts:'<path d="M5 20c0-4 2-6 2-9 0-3 2-6 6-7l1-2 1 3c2 1 4 3 4 6l-2 1-2-2-3 2v8"/><path d="M14 7h.01"/>',
  travel:'<path d="M3 13c3 0 4-3 9-3s6 3 9 3"/><path d="M5 17c2.5 0 3.5-2 7-2s4.5 2 7 2"/><path d="M12 10V3l5 3-5 2"/>',
  navigate:'<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5Z"/>',
  codex:'<path d="M12 6c-2-1.5-5-2-8-1.5v14c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5v-14c-3-.5-6 0-8 1.5Z"/><path d="M12 6v14"/>',
  menu:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  overhead:'<path d="M3 7l9-4 9 4-9 4Z"/><path d="M3 12l9 4 9-4"/><path d="M3 17l9 4 9-4"/>',roam:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  play:'<path d="M7 4v16l13-8Z"/>',chars:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/>',load:'<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M4 21h16"/>',
  layout:'<rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="5" rx="1"/><rect x="13" y="10" width="8" height="11" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/>'};
const uiIcon=(k,c='')=>`<svg class="ui-ico ${c}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${UI_ICON[k]||UI_ICON.menu}</svg>`;
function uiStore(k,v){try{if(v===undefined)return JSON.parse(localStorage.getItem('gg.ui.'+k)||'null');localStorage.setItem('gg.ui.'+k,JSON.stringify(v))}catch(e){return null}}
// HUD micro menu: icon buttons, hotkey badge, tooltip carries the name
$('#ghActions').innerHTML=MICRO.map(([id,l,k])=>`<button data-act="${id}" aria-label="${l} (${k})" data-tip-h="${l}" data-tip="Hotkey ${k}">${uiIcon(id)}<kbd>${k}</kbd></button>`).join('');
const winOf=a=>a==='harvester'?'harvesters':a;
const GHOST_SLOT={Helm:'helm_01',Shoulder:'chest_03',Chest:'chest_01','Main hand':'bloodfeud-blade',Hands:'gloves_01',Legs:'boots_03',Ring:'loot_03',Feet:'boots_01',Relic:'alchemy_1'};
$('#ghActions').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(!gw.hidden&&winKind===winOf(b.dataset.act)){closeWin();e.stopImmediatePropagation()}},true);
// top bar: icons with labels that collapse while playing
[['overhead','[data-gm=overhead]'],['roam','[data-gm=roam]'],['play','[data-gm=play]'],['chars','#warlordBtn'],['load','#loadBtn']].forEach(([k,sel])=>{const b=$(sel);if(!b)return;const t=b.textContent;b.innerHTML=`${uiIcon(k)}<span>${t}</span>`;b.setAttribute('aria-label',t);b.dataset.tipH=t;b.dataset.tip='';});
// interaction prompt: key cap plus text, centred under the crosshair
{const _ti=tickInteract;tickInteract=function(){_ti();if(!promptEl.hidden&&interact){const m=/^([A-Z]) · (.*)$/.exec(interact.label);const html=m?`<kbd>${m[1]}</kbd><span>${esc(m[2])}</span>`:esc(interact.label);if(promptEl._h!==html){promptEl.innerHTML=html;promptEl._h=html}}}}

/* ---- windows: centred, non-blocking, draggable by the title bar, remembered per window ---- */
const WIN_W={inventory:900,skills:920,craft:900,cart:640,vendor:680,travel:560,navigate:560,menu:480,codex:980,missions:700,mounts:600,harvesters:680,survey:600,chars:760};
const winPos=uiStore('win')||{};const card=gw.querySelector('.gw-card'),gwHead=card.querySelector('header');
function clampWin(){const r=card.getBoundingClientRect(),W=innerWidth,H=innerHeight;let l=parseFloat(card.style.left)||0,t=parseFloat(card.style.top)||0;
  l=r.width<W-16?Math.max(8,Math.min(W-r.width-8,l)):Math.max(W-r.width-8,Math.min(8,l));t=Math.max(48,Math.min(Math.max(48,H-Math.min(r.height,H*.5)),t));card.style.left=l+'px';card.style.top=t+'px'}
function placeWin(kind){if(innerWidth<=720){card.style.left=card.style.top=card.style.width='';return}const w=Math.min(WIN_W[kind]||720,innerWidth-32);card.style.width=w+'px';
  const p=winPos[kind];if(p){card.style.left=p.l+'px';card.style.top=p.t+'px';clampWin();return}
  card.style.left=Math.round((innerWidth-w)/2)+'px';card.style.top='0px';requestAnimationFrame(()=>{const h=card.offsetHeight;card.style.top=Math.round(Math.max(56,(innerHeight-h)/2-10))+'px'})}
{const _ow=openWin;openWin=function(kind){const was=!gw.hidden&&winKind;_ow(kind);if(was!==kind)placeWin(kind);if(kind==='menu')menuExtras();card.classList.remove('pop');void card.offsetWidth;card.classList.add('pop')}}
let drag=null;
gwHead.addEventListener('pointerdown',e=>{if(innerWidth<=720||e.target.closest('button'))return;const r=card.getBoundingClientRect();drag={dx:e.clientX-r.left,dy:e.clientY-r.top};gwHead.setPointerCapture(e.pointerId);card.classList.add('dragging');e.preventDefault()});
gwHead.addEventListener('pointermove',e=>{if(!drag)return;card.style.left=(e.clientX-drag.dx)+'px';card.style.top=(e.clientY-drag.dy)+'px';clampWin()});
gwHead.addEventListener('pointerup',()=>{if(!drag)return;drag=null;card.classList.remove('dragging');if(winKind){winPos[winKind]={l:parseFloat(card.style.left),t:parseFloat(card.style.top)};uiStore('win',winPos)}});
gwHead.addEventListener('dblclick',e=>{if(e.target.closest('button')||!winKind)return;delete winPos[winKind];uiStore('win',winPos);placeWin(winKind)});
gwHead.title='Drag to move · double-click to re-centre';
addEventListener('resize',()=>{if(!gw.hidden)clampWin();applyHudLayout()});
// wheel and clicks inside a window never reach the world
card.addEventListener('wheel',e=>e.stopPropagation(),{passive:true});card.addEventListener('pointerdown',e=>e.stopPropagation());

/* ---- movable HUD panels and UI scale ---- */
const HUD_PANELS=[['player','.mm-player','Character'],['target','.mm-target','Target'],['compass','.mm-compass','Compass'],['bars','.mm-bottom','Action bars'],['micro','.mm-menu','Menu buttons'],['chat','.mm-chat','Chat'],['track','.mm-track','Tracker'],['mini','#mini','Minimap']];
let hudLayout=uiStore('hud')||{},hudEdit=false;
function applyHudLayout(){for(const [k,sel] of HUD_PANELS){const el=$(sel);if(!el)continue;const p=hudLayout[k];if(!p||innerWidth<=720){el.style.left=el.style.top=el.style.right=el.style.bottom=el.style.transform='';el.classList.remove('moved');continue}
  const l=Math.max(0,Math.min(innerWidth-40,p.l*innerWidth)),t=Math.max(0,Math.min(innerHeight-30,p.t*innerHeight));Object.assign(el.style,{left:l+'px',top:t+'px',right:'auto',bottom:'auto',transform:'none'});el.classList.add('moved')}
  document.documentElement.style.setProperty('--ui-scale',uiStore('scale')||1)}
function setHudEdit(on){hudEdit=on;document.body.classList.toggle('hud-edit',on);$('#hudDone').hidden=!on;if(on){closeWin();toast('Drag any HUD panel to move it. Press Done or Esc when finished.')}}
const hudDone=document.createElement('div');hudDone.id='hudDone';hudDone.hidden=true;hudDone.innerHTML=`${uiIcon('layout')}<span>Editing HUD layout</span><button class="btn" id="hudReset">Reset</button><button class="btn primary" id="hudOk">Done</button>`;document.body.append(hudDone);
$('#hudOk').onclick=()=>setHudEdit(false);$('#hudReset').onclick=()=>{hudLayout={};uiStore('hud',hudLayout);applyHudLayout()};
for(const [k,sel,label] of HUD_PANELS){const el=$(sel);if(!el)continue;el.dataset.panel=label;let d=null;
  el.addEventListener('pointerdown',e=>{if(!hudEdit)return;const r=el.getBoundingClientRect();d={dx:e.clientX-r.left,dy:e.clientY-r.top};el.setPointerCapture(e.pointerId);e.preventDefault();e.stopPropagation()},true);
  el.addEventListener('pointermove',e=>{if(!d)return;hudLayout[k]={l:(e.clientX-d.dx)/innerWidth,t:(e.clientY-d.dy)/innerHeight};applyHudLayout()});
  el.addEventListener('pointerup',()=>{if(!d)return;d=null;uiStore('hud',hudLayout)});
  el.addEventListener('click',e=>{if(hudEdit){e.stopPropagation();e.preventDefault()}},true)}
addEventListener('keydown',e=>{if(e.key==='Escape'&&hudEdit){setHudEdit(false);e.stopImmediatePropagation()}},true);
function menuExtras(){const B=$('#gwBody');if(!B||B.querySelector('.ui-opts'))return;const s=uiStore('scale')||1,box=document.createElement('section');box.className='ui-opts';
  box.innerHTML=`<h3>Interface</h3><div class="ui-row"><button class="btn" id="uiEdit">${uiIcon('layout')} Edit HUD layout</button><button class="btn" id="uiResetWin">Re-centre windows</button>
    <label class="gw-set">UI scale <select id="uiScale">${[.85,1,1.15,1.3].map(v=>`<option value="${v}" ${v==s?'selected':''}>${Math.round(v*100)}%</option>`).join('')}</select></label></div>
    <p class="gw-note">Windows open in the middle of the screen and never pause the world: drag a title bar to move it, double-click it to re-centre. Press a window's hotkey again to close it.</p>`;
  B.prepend(box);$('#uiEdit').onclick=()=>setHudEdit(true);$('#uiResetWin').onclick=()=>{for(const k in winPos)delete winPos[k];uiStore('win',winPos);placeWin(winKind);toast('Windows re-centred.')};
  $('#uiScale').onchange=e=>{uiStore('scale',+e.target.value);applyHudLayout()}}
applyHudLayout();

{const _mf=mmFrame;mmFrame=function(dt){_mf(dt);tickHud3(dt);tickScene(dt);tickFlora(dt);tickTrees(dt);tickAnimals(dt);tickProps(dt);if(CH&&level==='ground'&&groundMode==='play'){tickTravellers(dt);tickRoute(dt)}}}
/* ---------------- per-frame tick for the MMO layer ---------------- */
let mmT=0,moveT=0;
function mmFrame(dt){if(!intro.hidden&&level==='galaxy'&&!busy){ctl.theta+=dt*.035;applyOrbit()}tickPadFx(dt);tickCaravans(dt);tickTerminals(dt);
  tickPeers(dt);const playing=CH&&level==='ground'&&groundMode==='play'&&groundWorld;document.body.classList.toggle('mmo',!!playing);if(!playing){if(rts.on)rtsToggle(false);return}
  tickHam(dt);tickUnits(dt);tickStructures(dt);tickWild(dt);tickInteract();drawSelRings();drawCompass();mmT-=dt;if(mmT<=0){mmT=.25;mmHud();if(rts.on&&rts.selStruct)renderCmd.tick=(renderCmd.tick||0)+1}
  moveT-=dt;if(moveT<=0){moveT=1;mmOnMove()}}
function mmEnterPlay(){spawnUnits();drawStructures();spawnParkedCart();mmLog(`Welcome to ${planetName(groundWorld)}, ${CH?CH.name:'traveler'}. Right-click for mouselook, Enter to chat, /help for commands.`,'sys')}
function mmExitPlay(){dismount(true);if(parkedCart){G.ground.remove(parkedCart);parkedCart=null}despawnUnits();structGroup.clear();setMouselook(false);if(rts.on)rtsToggle(false);for(const id of [...peerModels.keys()])dropPeer(id)}
addEventListener('keydown',e=>{if(e.target.tagName==='INPUT'||e.target.tagName==='SELECT'||e.target.tagName==='TEXTAREA')return;if(level!=='ground'||groundMode!=='play'||!CH)return;const k=e.key.toLowerCase();
  if(k==='escape'&&rts.on){rtsToggle(false);e.stopImmediatePropagation();e.preventDefault();return}if(k==='enter'){$('#mmChatIn').focus();e.preventDefault();return}if(k==='b'){rtsToggle();e.preventDefault();return}if(k==='v'){toggleMount();e.preventDefault();return}if(k==='f'&&interact&&!e.shiftKey&&!document.getElementById('ggDlg')){interact.run();e.preventDefault();return}if((k===' '||k==='x')&&play.mount){e.preventDefault()}if(k==='o'){openWin('missions');e.preventDefault();return}
},true);


/* ================= CraftPix RPG UI skin: icons, rich tooltips, inventory and crafting station ================= */
const ICONS='ui/icons/';
const icon=(f,alt='')=>`<img class="ic" src="${ICONS}${f}.png" alt="${esc(alt)}" width="40" height="40" draggable="false">`;
const SLOT_ICON={Helm:'helm',Shoulder:'shoulder',Chest:'chest',Hands:'gloves',Legs:'pants',Feet:'boots',Ring:'ring'};
const SET_WEAPON={bloodfeud:'bloodfeud-blade',wraithfang:'wraithfang',oathbreaker:'oathbreaker',kinrend:'kinrend',dusksinger:'dusksinger',emberclad:'emberclad'};
function setIndex(set){const i=GD.armorSets.indexOf(set);return i<0?0:i%6}
function itemIcon(it){const set=(it.set||CH&&CH.set||'').toLowerCase();
  if(it.kind==='weapon')return SET_WEAPON[set]||'bloodfeud-blade';if(it.slot==='Relic')return'necklace_01';if(SLOT_ICON[it.slot])return`${SLOT_ICON[it.slot]}_0${setIndex(it.set||CH.set)+1}`;
  return{tool:'cog',deed:'blacksmith_icon',medicine:'alchemy_1',food:'alchemy_10'}[it.kind]||'loot_01'}
const RES_ICON=[[/bone|horn/,'craft-resources_03'],[/hide|leather|skin/,'craft-resources_33'],[/meat/,'craft-resources_32'],[/milk|egg|creature food/,'craft-resources_35'],[/creature/,'craft-resources_33'],
  [/wood/,'craft-resources_25'],[/seed/,'craft-resources_30'],[/fruit|vegetable|fung|flora food|cereal|corn|rice|oats|wheat|bean|tuber/,'craft-resources_45'],[/flora|plant/,'craft-resources_37'],
  [/water/,'craft-resources_50'],[/gas/,'craft-resources_14'],[/radioactive/,'craft-resources_09'],[/gem|crystal|armophous/,'craft-resources_08'],[/energy|solar|wind|geothermal/,'craft-resources_21'],
  [/chemical|fuel|petro|polymer|lubric|fiberplast|acid/,'craft-resources_36'],[/copper|conductive|non-ferrous/,'craft-resources_19'],[/steel|iron|ferrous|aluminum/,'craft-resources_17'],[/metal/,'craft-resources_18'],
  [/ore|igneous|sedimentary|extrusive|intrusive|carbonate|siliclastic/,'craft-resources_12'],[/mineral/,'craft-resources_11'],[/inorganic/,'craft-resources_07']];
function resIcon(r){const s=((r.c||'')+' '+(r.cl||[]).join(' ')).toLowerCase();return(RES_ICON.find(([re])=>re.test(s))||[0,'craft-resources_13'])[1]}
const RES_ATTR_FULL={quality:'Overall Quality',conductivity:'Conductivity',decay_resist:'Decay Resistance',heat_resist:'Heat Resistance',cold_resist:'Cold Resistance',malleability:'Malleability',shock_resistance:'Shock Resistance',
  toughness:'Unit Toughness',flavor:'Flavor',potential_energy:'Potential Energy',nutritional_value:'Nutritional Value',entangle_resistance:'Entangle Resistance'};
const KIND_NAME={tool:'Tool',deed:'Structure deed',medicine:'Medicine',food:'Food',armor:'Armor',weapon:'Weapon'};

/* ---- rich tooltips: any element with data-tip / data-tip-k, and every title attribute, gets a styled tooltip ---- */
const tip=document.createElement('div');tip.id='tip';tip.hidden=true;tip.setAttribute('role','tooltip');document.body.append(tip);
const statRow=(k,v,c)=>`<div class="tp-row"><span>${k}</span><b${c?` style="color:${c}"`:''}>${v}</b></div>`;
const TIPS={
  ab(id){const a=knownAbilities().find(x=>x.id===id)||ABILITIES.find(x=>x.id===id);if(!a)return'';const c=a.cost||{},i=knownAbilities().indexOf(a),left=Math.max(0,(cds[a.id]||0)-now());
    return`<h4>${a.icon} ${esc(a.name)}</h4>${i>=0?`<small>Hotbar key ${(i+1)%10}</small>`:''}<p>${esc(a.desc)}</p>${c.a?statRow('Action',c.a,'#f2c14a'):''}${c.m?statRow('Mind',c.m,'#5aa6f2'):''}${a.cd?statRow('Cooldown',a.cd+' s'):''}${a.hit&&a.hit.range?statRow('Range',a.hit.range+' m'):''}
      ${left?`<p class="tp-warn">Ready in ${Math.ceil(left)} s</p>`:''}${a.req?`<small>Granted by ${esc((BOXES[bx(...a.req)]||{}).name||'')}</small>`:''}`},
  item(id){const it=CH&&CH.inv.items.find(i=>i.id===id);if(!it)return'';const eq=Object.values(CH.gear||{}).includes(it.id),t=it.tier;
    const C=window.GG_COMBAT,gr=C?C.qualityGrade(it.q):null;
    let rows=statRow('Quality',`${Math.round(it.q)}${gr?' · '+gr.name:''}`,gr?gr.color:undefined);if(t)rows+=statRow('Tier',`T${t} ${tierName(t)}`,tierColor(t));
    if(C&&it.kind==='armor')rows+=statRow('Armour',`+${Math.round(C.armorValue(t||1,it.q))}`);
    if(C&&it.kind==='weapon'){const wd=C.weaponDamage(t||1,it.q)*(it.gun&&GUNS[it.gun]?GUNS[it.gun].mult:1);rows+=statRow('Weapon damage',`${Math.round(wd*.9)}–${Math.round(wd*1.1)}`)+(it.gun&&GUNS[it.gun]?statRow('Range',GUNS[it.gun].range+' m')+statRow('Rate',`${(1/GUNS[it.gun].cd).toFixed(1)}/s`):'')}
    if(C&&it.attrs)rows+=Object.entries(it.attrs).filter(([,v])=>v).map(([k,v])=>statRow(k,`+${(v*gr.mult).toFixed(1)}`,'#9fe4ff')).join('');
    if(C&&(it.kind==='weapon'||it.kind==='armor')){const P=C.itemPerks(it);if(P.length)rows+=`<div class="tp-perks">${P.map(p=>`<p style="color:${gr.color}">◆ ${esc(p.name)}: ${esc(p.text)}</p>`).join('')}</div>`;
      else if(gr&&gr.perks===0)rows+=`<small>Good quality or better rolls a perk.</small>`}
    if(it.kind==='medicine'||it.kind==='food')rows+=statRow('Restores',`${Math.round(150+it.q*.6*(1+(skillMods(CH).heal||0)/100))} health`);
    if(it.kind==='deed')rows+=statRow('Harvester',(HARV_SIZES[it.size]||HARV_SIZES.personal).label);
    return`<h4 style="color:${t?tierColor(t):'var(--cpx-ink)'}">${esc(it.name)}</h4><small>${esc(it.slot?it.slot+' · ':'')}${KIND_NAME[it.kind]||it.kind}${it.set?' · '+esc(it.set)+' set':''}</small>${rows}
      <p class="tp-hint">${it.slot?(eq?'Equipped. Click to unequip.':'Click to equip.'):it.kind==='medicine'||it.kind==='food'?'Click to use.':it.kind==='deed'?'Place it from the Harvesters window (H).':it.kind==='tool'?'Used by Survey (U) and Sample (J).':''}</p>`},
  res(n){const r=CH&&CH.inv.res[n];if(!r)return'';const at=Object.entries(r.a).sort((a,b)=>b[1]-a[1]);
    return`<h4>${esc(n)}</h4><small>${esc(r.c)}</small>${statRow('Units',r.units.toLocaleString())}<div class="tp-attrs">${at.map(([k,v])=>`<div><span>${esc(RES_ATTR_FULL[k]||k)}</span><i style="--w:${v/10}%"></i><b>${v}</b></div>`).join('')}</div>
      <small>Classes: ${esc((r.cl||[]).slice(-3).join(' › '))}</small>`},
  box(id){const b=BOXES[id];if(!b||!CH)return'';const st=boxState(b);
    return`<h4>${esc(b.name)}</h4><small>${esc(PROF[b.prof].name)}${PROF[b.prof].start?'':' · Elite'}</small>${statRow('XP',`${b.xp.toLocaleString()} ${xpName(b.xpType)}`,st.xpOk?'':'#e08a7a')}${statRow('Skill points',b.pts,st.ptsOk?'':'#e08a7a')}${statRow('Trainer fee',b.cr.toLocaleString()+' cr',st.crOk?'':'#e08a7a')}
      ${b.fx?`<p>Improves ${esc(FX_TEXT[b.fx]||b.fx)}.</p>`:''}${b.mods&&b.mods.length?`<small>Skill mods: ${b.mods.slice(0,5).map(([k,v])=>esc(k.replace(/_/g,' '))+' +'+v).join(', ')}</small>`:''}${b.cmds&&b.cmds.length?`<small>Abilities: ${b.cmds.slice(0,6).map(c=>esc(c.replace(/([a-z])([A-Z0-9])/g,'$1 $2').replace(/\+/g,' '))).join(', ')}</small>`:''}<p class="tp-hint">${st.own?'Learned.':st.can?'Ready to learn at a trainer.':st.reqOk?'Earn the XP, then visit a trainer.':'Learn the previous box first.'}</p>`},
  sch(id){const s=SCHEMATICS.find(x=>x.id===id);if(!s)return'';return`<h4>${esc(s.name)}</h4><small>${KIND_NAME[s.out]||s.out}${s.slot?' · '+s.slot:''}</small>${s.needs.map(([c,n])=>statRow(c,n+' units')).join('')}
      <small>Quality draws on ${s.attrs.map(a=>RES_ATTR_FULL[a]||a).join(', ')}. Requires ${esc(BOXES[s.box].name)}.</small>`}};
let tipEl=null;
function tipContent(el){if(el.dataset.tipK){const [k,...v]=el.dataset.tipK.split(':');return TIPS[k]?TIPS[k](v.join(':')):''}
  const h=el.dataset.tipH,t=el.dataset.tip;return(h?`<h4>${esc(h)}</h4>`:'')+(t?t.split('\n').map(l=>`<p>${esc(l)}</p>`).join(''):'')}
function placeTip(x,y){const r=tip.getBoundingClientRect(),W=innerWidth,H=innerHeight;let tx=x+16,ty=y+18;if(tx+r.width>W-8)tx=x-r.width-12;if(ty+r.height>H-8)ty=y-r.height-12;tip.style.transform=`translate(${Math.max(8,tx)}px,${Math.max(8,ty)}px)`}
addEventListener('pointerover',e=>{if(e.pointerType==='touch')return;const el=e.target.closest&&e.target.closest('[data-tip],[data-tip-k],[data-tip-h],[title]');
  if(!el){tipEl=null;tip.hidden=true;return}if(el.hasAttribute('title')){const t=el.getAttribute('title');el.removeAttribute('title');if(t&&!el.dataset.tip&&!el.dataset.tipK)el.dataset.tip=t}
  const html=tipContent(el);if(!html){tip.hidden=true;return}tipEl=el;tip.innerHTML=html;tip.hidden=false;placeTip(e.clientX,e.clientY)},true);
addEventListener('pointermove',e=>{if(!tip.hidden)placeTip(e.clientX,e.clientY)},{passive:true});
addEventListener('pointerdown',()=>{tip.hidden=true},true);addEventListener('wheel',()=>{tip.hidden=true},{passive:true});
addEventListener('pointerout',e=>{if(tipEl&&(!e.relatedTarget||!tipEl.contains(e.relatedTarget))&&e.target.closest&&e.target.closest('[data-tip],[data-tip-k],[data-tip-h]')===tipEl){tip.hidden=true;tipEl=null}},true);

/* ---- inventory: paper doll, bag grid and resource list, all with icons ---- */
let invSel=null;
function winInventory(B){$('#gwTitle').textContent='Inventory';const res=Object.entries(CH.inv.res).sort((a,b)=>b[1].units-a[1].units),gearSlots=['Helm','Shoulder','Chest','Main hand','Hands','Legs','Ring','Feet','Relic'];
  const bag=CH.inv.items.filter(i=>!Object.values(CH.gear||{}).includes(i.id)),st=charStats();
  const slot=(it,lbl)=>`<button class="cp-slot${it&&it.tier?' t'+Math.min(8,it.tier):''}${it&&invSel===it.id?' sel':''}" ${it?`data-it="${it.id}" data-tip-k="item:${it.id}"${it.kind==='medicine'||it.kind==='food'?` draggable="true" data-drag="it:${esc(it.name)}"`:''}`:`data-tip-h="${esc(lbl||'Empty')}" data-tip="${lbl?'Nothing equipped.':'Empty bag slot.'}"`}>${it?icon(itemIcon(it),it.name):lbl?`<span class="cp-ghost">${GHOST_SLOT[lbl]?icon(GHOST_SLOT[lbl],''):esc(lbl)}</span>`:''}${it&&it.tier?`<em>T${it.tier}</em>`:''}</button>`;
  B.innerHTML=`<div class="cp-inv"><section><h3>Equipped</h3><div class="cp-doll">${gearSlots.map(s=>`<div class="cp-dslot"><small>${s}</small>${slot(CH.inv.items.find(i=>i.id===CH.gear[s]),s)}</div>`).join('')}</div>
     <div class="cp-stats">${statRow('Level',st.level||combatLevel())}${statRow('Health',st.maxHp)}${statRow('Armour',st.def)}${statRow('Damage',st.dmg)}${st.cs?ggCombatRows(st.cs):''}${statRow('Gear tier',`T${gearTier()} ${tierName(gearTier())}`,tierColor(gearTier()))}${statRow('Credits',CH.credits.toLocaleString(),'var(--cpx-gold)')}</div></section>
   <section><h3>Bag <small>${bag.length} items</small></h3><div class="cp-bag">${bag.map(i=>slot(i)).join('')}${Array.from({length:Math.max(0,24-bag.length)},()=>slot(null)).join('')}</div>
     <div class="cp-actbar" id="invAct"></div></section>
   <section><h3>Resources <small>${res.length} types</small></h3><ul class="cp-res">${res.map(([n,r])=>`<li data-tip-k="res:${esc(n)}">${icon(resIcon(r),r.c)}<span><b>${esc(n)}</b><small>${esc(r.c)}</small></span><em>${r.units.toLocaleString()}</em></li>`).join('')||'<li class="cp-empty">Survey (U) and sample (J) to gather resources.</li>'}</ul></section></div>`;
  const act=$('#invAct'),sel=CH.inv.items.find(i=>i.id===invSel);
  if(sel){const eq=CH.gear[sel.slot]===sel.id;act.innerHTML=`<span>${icon(itemIcon(sel),sel.name)}<b style="color:${sel.tier?tierColor(sel.tier):'inherit'}">${esc(sel.name)}</b></span>${sel.slot?`<button class="btn primary" data-eq="${sel.id}">${eq?'Unequip':'Equip'}</button>`:sel.kind==='medicine'||sel.kind==='food'?`<button class="btn primary" data-use="${sel.id}">${sel.kind==='food'?'Eat':'Use'}</button>`:''}`}
  else act.innerHTML='<small>Select an item to equip or use it. Hover anything for details.</small>';
  B.querySelectorAll('[data-it]').forEach(b=>b.onclick=()=>{const it=CH.inv.items.find(i=>i.id===b.dataset.it);if(invSel===it.id&&it.slot){toggleEquip(it);return}invSel=it.id;renderWin()});
  B.querySelectorAll('[data-eq]').forEach(b=>b.onclick=()=>toggleEquip(CH.inv.items.find(i=>i.id===b.dataset.eq)));
  B.querySelectorAll('[data-use]').forEach(b=>b.onclick=()=>{const it=CH.inv.items.find(i=>i.id===b.dataset.use);const st=charStats();const heal=Math.round(150+it.q*.6*(1+(skillMods(CH).heal||0)/100));
    CH.hp=Math.min(st.maxHp,CH.hp+heal);CH.inv.items=CH.inv.items.filter(i=>i!==it);invSel=null;if(it.kind==='medicine')gainXP('medical',60,'healing');toast(`Restored ${heal} health.`);markDirty();renderWin();renderHud()})}
function toggleEquip(it){if(!it||!it.slot)return;if(CH.gear[it.slot]===it.id)delete CH.gear[it.slot];else CH.gear[it.slot]=it.id;markDirty();syncLook();if(play.model)swapPlayerModel();renderWin();renderHud()}

/* ---- crafting station: schematic list, ingredient slots, quality forecast, assemble sequence ---- */
let craftSel=null,crafting=null;
const CRAFT_GROUPS=[['tool','Tools'],['deed','Structures'],['medicine','Medicine'],['food','Food'],['weapon','Weapons'],['armor','Armor']];
function craftForecast(s,use){const m=skillMods(CH);let q=use.reduce((a,u)=>a+resQuality(u[2],s.attrs)*u[1],0)/use.reduce((a,u)=>a+u[1],0);q=Math.min(1000,q*(1+(m.assembly||0)/100));return{lo:Math.round(q*.92),hi:Math.round(Math.min(1000,q*1.08)),mid:q}}
function winCraft(B){$('#gwTitle').textContent='Crafting station';if(!craftSel||!SCHEMATICS.some(s=>s.id===craftSel))craftSel=(SCHEMATICS.find(canCraft)||SCHEMATICS[0]).id;
  const s=SCHEMATICS.find(x=>x.id===craftSel),ok=canCraft(s),use=ok&&pickResources(s),fc=use&&craftForecast(s,use),m=skillMods(CH),name=it=>it.out==='armor'||it.out==='weapon'?CH.set+' '+it.name:it.name;
  const outIt={kind:s.out,slot:s.slot,set:CH.set,size:s.size};
  B.innerHTML=`<div class="cp-craft"><nav class="cp-schem">${CRAFT_GROUPS.map(([k,l])=>{const list=SCHEMATICS.filter(x=>x.out===k);return list.length?`<small>${l}</small>${list.map(x=>`<button class="${x.id===craftSel?'sel':''}${canCraft(x)?'':' locked'}" data-s="${x.id}" data-tip-k="sch:${x.id}">${icon(itemIcon({kind:x.out,slot:x.slot,set:CH.set}),x.name)}<span>${esc(name(x))}</span>${canCraft(x)?'':'<i>🔒</i>'}</button>`).join('')}`:''}).join('')}</nav>
   <section class="cp-bench"><header>${`<div class="cp-slot big">${icon(itemIcon(outIt),s.name)}</div>`}<div><h3>${esc(name(s))}</h3><small>${KIND_NAME[s.out]}${s.slot?' · '+s.slot:''}${s.size?' · '+HARV_SIZES[s.size].label+' harvester':''} · Assembly skill +${m.assembly||0}%</small></div></header>
     <h4>Ingredients</h4><div class="cp-ingr">${s.needs.map(([c,n],k)=>{const u=use&&use[k],r=u&&u[2],have=Object.values(CH.inv.res).filter(x=>x.cl.includes(c)).reduce((a,x)=>a+x.units,0);
       return`<div class="cp-need${u?'':' missing'}">${`<div class="cp-slot"${u?` data-tip-k="res:${esc(u[0])}"`:` data-tip-h="${esc(c)}" data-tip="Needs ${n} units of any ${c} resource. Survey (U) to find one."`}>${icon(r?resIcon(r):resIcon({c,cl:[c]}),c)}<em>${n}</em></div>`}
         <span><b>${u?esc(u[0]):esc(c)}</b><small>${u?`${esc(r.c)} · ${s.attrs.map(a=>`${RES_ATTR_LABEL[a]||a} ${r.a[a]??'—'}`).join(' ')}`:`You have ${have} of ${n} units`}</small></span></div>`}).join('')}</div>
     <h4>Expected result</h4>${fc?`<div class="cp-forecast"><div class="cp-qbar"><i style="left:${fc.lo/10}%;width:${(fc.hi-fc.lo)/10}%"></i><b style="left:${fc.mid/10}%"></b></div><span>Quality ${fc.lo}–${fc.hi}${s.out==='armor'||s.out==='weapon'?` · T${Math.max(1,Math.min(8,1+Math.floor(fc.lo/1000*8)))}–${Math.max(1,Math.min(8,1+Math.floor(fc.hi/1000*8)))}`:''}</span></div>`:`<p class="gw-note">${ok?'Gather the missing resources to see the quality forecast.':`Learn ${esc(BOXES[s.box].name)} from an Artisan trainer to use this schematic.`}</p>`}
     <div class="cp-progress" id="cpProg" hidden><div class="cp-pbar"><i id="cpProgI"></i></div><small id="cpProgT"></small></div>
     <div class="cp-actbar">${ok&&use?`<button class="btn primary" id="cpGo">Assemble</button>`:''}<small>${ok&&use?'Uses the best-quality matching resources in your inventory.':''}</small></div></section></div>`;
  B.querySelectorAll('[data-s]').forEach(b=>b.onclick=()=>{if(crafting)return;craftSel=b.dataset.s;renderWin()});
  const go=$('#cpGo');if(go)go.onclick=()=>{if(crafting)return;crafting={t:0};go.disabled=true;$('#cpProg').hidden=false;const steps=['Assembling components…','Experimenting…','Finishing…'];const t0=performance.now();
    const step=()=>{const k=Math.min(1,(performance.now()-t0)/1800);$('#cpProgI').style.width=(k*100)+'%';$('#cpProgT').textContent=steps[Math.min(2,Math.floor(k*3))];if(k<1&&winKind==='craft'&&$('#cpProg'))return requestAnimationFrame(step);crafting=null;finishCraft(s)};requestAnimationFrame(step)}}
function finishCraft(s){const use=pickResources(s);if(!use)return renderWin();const m=skillMods(CH);let q=use.reduce((a,u)=>a+resQuality(u[2],s.attrs)*u[1],0)/use.reduce((a,u)=>a+u[1],0);q=Math.min(1000,q*(1+(m.assembly||0)/100)*(.92+Math.random()*.16));
  use.forEach(([n,k])=>{CH.inv.res[n].units-=k;if(CH.inv.res[n].units<=0)delete CH.inv.res[n]});const tier=Math.max(1,Math.min(8,1+Math.floor(q/1000*8))),id='i'+Date.now().toString(36);
  const item=s.out==='armor'||s.out==='weapon'?{id,kind:s.out,name:s.gun?s.name:`${CH.set} ${s.name}`,slot:s.slot,tier,q,set:CH.set,...(s.gun?{gun:s.gun}:{})}:{id,kind:s.out,name:s.name,q,...(s.size?{size:s.size}:{})};
  CH.inv.items.push(item);gainXP(s.out==='medicine'?'medical':'crafting',Math.round(80+q/8),s.out==='medicine'?'medicine crafting':'crafting');toast(`Crafted ${item.name}${item.tier?` · T${tier} ${tierName(tier)}`:''} (quality ${Math.round(q)}).`);markDirty();if(winKind==='craft')renderWin()}

// wrap the HUD portrait in its ring
{const c=$('#mmPortrait');if(c&&!c.parentNode.classList.contains('mm-port')){const w=document.createElement('span');w.className='mm-port';c.parentNode.insertBefore(w,c);w.append(c)}}


/* ================= Horse carts: hauling transport with a cargo stash, NPC merchant caravans and the town market ================= */
let cartGltf=null;const CART_SCALE=1.15,STASH_CAP=15000;
loadScript('cart.js').then(()=>new Promise((res,rej)=>{const bin=atob(window.GRUDGE_CART),buf=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)buf[i]=bin.charCodeAt(i);
  new THREE.GLTFLoader().parse(buf.buffer,'',g=>{g.scene.traverse(o=>{if(o.isMesh){o.frustumCulled=false;const m=o.material;if(m&&m.map){m.map.encoding=THREE.LinearEncoding;m.map.anisotropy=renderer.capabilities.getMaxAnisotropy()}}});cartGltf=g;res(g)},rej)}))
  .then(()=>{if(groundMode==='play'&&CH)spawnParkedCart()}).catch(e=>console.warn('Cart model unavailable',e));
function makeCart(){if(!cartGltf)return null;const m=cartGltf.scene.clone(true);m.scale.setScalar(CART_SCALE);const obj=new THREE.Group();obj.add(m);const mixer=new THREE.AnimationMixer(m);
  const acts=cartGltf.animations.map(c=>{const a=mixer.clipAction(c);a.play();return a});mixer.update(Math.random()*5);obj.userData={cart:true,mx:{mixer,acts},seat:1.3*CART_SCALE,seatZ:-.45*CART_SCALE};return obj}
function animateCart(obj,dt,moving){const u=obj.userData.mx;const k=moving>1.5?1.7:moving?1.1:.12;u.acts.forEach(a=>a.setEffectiveTimeScale(k));u.mixer.update(dt)}

/* ---- the player's cart: drive it, park it, haul with it ---- */
let parkedCart=null;
const stash=()=>{CH.cartStash=CH.cartStash||{};return CH.cartStash};
const stashUnits=()=>Object.values(stash()).reduce((a,r)=>a+r.units,0);
function stashAdd(r,units){const free=STASH_CAP-stashUnits();if(free<=0)return 0;const u=Math.min(free,units),s=stash(),cur=s[r.n]||(s[r.n]={units:0,c:r.c,cl:r.cl,a:r.a,t:r.t});cur.units+=u;markDirty();return u}
function cartPos(){if(play.mount&&play.mount.def.cart)return{x:play.x,z:play.z};if(parkedCart&&CH.cartPark&&groundWorld&&CH.cartPark.planet===groundWorld.id)return CH.cartPark;return null}
function cartNear(x,z,r){const c=cartPos();return !!c&&Math.hypot(c.x-x,c.z-z)<r}
function spawnParkedCart(){if(parkedCart){G.ground.remove(parkedCart);parkedCart=null}if(!CH||!CH.cartPark||!groundWorld||CH.cartPark.planet!==groundWorld.id||!ownedMounts().includes('cart'))return;
  const o=makeCart();if(!o)return;const p=CH.cartPark;o.position.set(p.x,groundH(groundWorld,p.x,p.z),-p.z);o.rotation.y=p.yaw;G.ground.add(o);parkedCart=o}
function parkCart(){const m=play.mount;CH.cartPark={planet:groundWorld.id,x:play.x,z:play.z,yaw:play.yaw+Math.PI};markDirty();if(parkedCart)G.ground.remove(parkedCart);parkedCart=m.obj;play.mount=null;
  play.alt=0;play.dist=Math.min(play.dist,6.2);play.x+=Math.cos(play.yaw)*2.2;play.z+=Math.sin(play.yaw)*2.2;if(play.model&&play.model.userData.mixer)play.model.userData.once=0;mmLog('You park your cart. Press F next to it to open the cargo stash, or V to drive it again.','sys');mmHud()}
function winCart(B){$('#gwTitle').textContent='Cart cargo';const used=stashUnits(),inv=Object.entries(CH.inv.res).sort((a,b)=>b[1].units-a[1].units),st=Object.entries(stash()).sort((a,b)=>b[1].units-a[1].units);
  const row=(n,r,act,lbl)=>`<li data-tip-k="${act==='load'?'res:'+esc(n):''}">${icon(resIcon(r),r.c)}<span><b>${esc(n)}</b><small>${esc(r.c)}</small></span><em>${r.units.toLocaleString()}</em><button class="btn mini" data-${act}="${esc(n)}">${lbl}</button></li>`;
  B.innerHTML=`<p class="gw-note">A cart hauls far more than you can carry. While your cart is within 60 m, harvesters can be emptied straight into it from range with a 15% bonus, and sampling near it yields 30% more.</p>
   <div class="cp-forecast"><div class="cp-qbar"><i style="left:0;width:${100*used/STASH_CAP}%"></i></div><span>${used.toLocaleString()} / ${STASH_CAP.toLocaleString()} units in the cart</span></div>
   <div class="gw-cols"><section><h3>Your pack <small>${inv.length} types</small></h3><ul class="cp-res cp-res-act">${inv.map(([n,r])=>row(n,r,'load','Load')).join('')||'<li class="cp-empty">Nothing to load.</li>'}</ul>${inv.length?'<button class="btn" id="cgAllIn">Load everything</button>':''}</section>
   <section><h3>Cart <small>${st.length} types</small></h3><ul class="cp-res cp-res-act">${st.map(([n,r])=>row(n,r,'unload','Unload')).join('')||'<li class="cp-empty">The cart is empty.</li>'}</ul>${st.length?'<button class="btn" id="cgAllOut">Unload everything</button>':''}</section></div>`;
  const load=n=>{const r=CH.inv.res[n];if(!r)return;const u=stashAdd({n,...r},r.units);r.units-=u;if(r.units<=0)delete CH.inv.res[n];if(!u)toast('The cart is full.')};
  const unload=n=>{const r=stash()[n];if(!r)return;addRes({n,c:r.c,cl:r.cl,a:r.a,t:r.t},r.units);delete stash()[n];markDirty()};
  B.querySelectorAll('[data-load]').forEach(b=>b.onclick=()=>{load(b.dataset.load);renderWin()});B.querySelectorAll('[data-unload]').forEach(b=>b.onclick=()=>{unload(b.dataset.unload);renderWin()});
  $('#cgAllIn')&&($('#cgAllIn').onclick=()=>{Object.keys(CH.inv.res).forEach(load);renderWin()});$('#cgAllOut')&&($('#cgAllOut').onclick=()=>{Object.keys(stash()).forEach(unload);renderWin()})}

/* ---- merchant caravans: NPC carts that drive loops around the city you're in ---- */
let caravans=[],caravanCity=null;
function clearCaravans(){caravans.forEach(c=>{G.ground.remove(c.obj);if(c.driver)G.ground.remove(c.driver)});caravans=[];caravanCity=null}
function tickCaravans(dt){if(!cartGltf||!groundWorld||level!=='ground'){if(caravans.length)clearCaravans();return}
  const px=groundMode==='play'?play.x:ctl.target.x,pz=groundMode==='play'?play.z:-ctl.target.z;
  const city=groundWorld.pois.filter(q=>q.cat==='city').find(q=>Math.hypot(q.x-px,q.z-pz)<q.r*1.6+150);
  if(city!==caravanCity){clearCaravans();caravanCity=city;if(!city)return;const R=mulberry(strHash(city.name)),n=Math.min(4,2+Math.floor(city.r/400));
    for(let k=0;k<n;k++){const wp=[];for(let i=0;i<6;i++){const a=R()*TAU,r=city.r*(.15+R()*.75);wp.push({x:city.x+Math.cos(a)*r,z:city.z+Math.sin(a)*r})}
      const obj=makeCart();if(!obj)continue;const race=GD.races[Math.floor(R()*GD.races.length)].id,h=Math.floor(R()*1e9);
      const driver=toonInstance(race,{race,cls:'thief',set:GD.armorSets[h%GD.armorSets.length],tier:2,vary:h,wprof:'merchant'},{lit:'lambert'});
      G.ground.add(obj);if(driver){G.ground.add(driver);toonOneShot(driver,'sit')}
      const names=['Oro','Tessa','Bram','Kael','Nim','Dov','Sela','Yorr'];caravans.push({obj,driver,wp,i:k%6,x:wp[k%6].x,z:wp[k%6].z,yaw:0,wait:R()*4,name:names[k%names.length]+' the Trader'})}}
  for(const c of caravans){if(c.wait>0){c.wait-=dt;c.moving=0}else{const t=c.wp[c.i],dx=t.x-c.x,dz=t.z-c.z,d=Math.hypot(dx,dz);
      if(d<1.5){c.i=(c.i+1)%c.wp.length;c.wait=4+Math.random()*8}else{const s=Math.min(d,3.4*dt);c.x+=dx/d*s;c.z+=dz/d*s;const want=Math.atan2(-dx,dz);let dy=((want-c.yaw+Math.PI)%TAU+TAU)%TAU-Math.PI;c.yaw+=dy*Math.min(1,dt*2.5);c.moving=1}}
    const gy=groundH(groundWorld,c.x,c.z);c.obj.position.set(c.x,gy,-c.z);c.obj.rotation.y=c.yaw+Math.PI;animateCart(c.obj,dt,c.moving);
    if(c.driver){const u=c.obj.userData;c.driver.position.set(c.x-Math.sin(c.yaw)*u.seatZ,gy+u.seat-.45,-(c.z+Math.cos(c.yaw)*u.seatZ));c.driver.rotation.y=c.yaw+Math.PI;animateAny(c.driver,0,0)}}}
const nearCaravan=()=>caravans.find(c=>Math.hypot(c.x-play.x,c.z-play.z)<7);

/* ---- the town market: sell what you gather and craft, buy supplies ---- */
const resPrice=r=>Math.max(.2,.25+((r.a&&r.a.quality)||400)/1000*1.25);
const itemPrice=it=>Math.round((it.tier||1)*(it.q||300)*.35);
const SHOP=[{id:'stim',name:'Stimpack',cost:140,make:()=>({kind:'medicine',name:'Stimpack',q:420})},{id:'ration',name:'Field Ration',cost:90,make:()=>({kind:'food',name:'Field Ration',q:380})},
  {id:'tool',name:'Survey Device',cost:450,make:()=>({kind:'tool',name:'Survey Device',q:320})},{id:'deed',name:'Personal Harvester Deed',cost:1600,make:()=>({kind:'deed',name:'Personal Harvester Deed',size:'personal',q:260})},
  {id:'cart',name:'Horse Cart',cost:1800,mount:'cart'}];
let vendorName='Market';
function winVendor(B){$('#gwTitle').textContent=vendorName;const res=Object.entries(CH.inv.res).sort((a,b)=>b[1].units-a[1].units),sellable=CH.inv.items.filter(i=>!Object.values(CH.gear||{}).includes(i.id)&&i.kind!=='tool');
  B.innerHTML=`<p class="gw-note">You have <b style="color:var(--cpx-gold)">${CH.credits.toLocaleString()} credits</b>. Prices follow resource quality (OQ) and item tier.</p>
   <div class="gw-cols"><section><h3>Buy</h3><ul class="cp-res cp-res-act">${SHOP.map(s=>{const it=s.make?s.make():{kind:'tool'},owned=s.mount&&ownedMounts().includes(s.mount);return`<li>${icon(s.mount?'loot_03':itemIcon(it),s.name)}<span><b>${s.name}</b><small>${s.mount?'Transport with a 15,000-unit cargo stash':KIND_NAME[it.kind]}</small></span><em>${s.cost.toLocaleString()}</em>${owned?'<small>Owned</small>':`<button class="btn mini primary" data-buy="${s.id}">Buy</button>`}</li>`}).join('')}</ul>
     <h3>Sell items</h3><ul class="cp-res cp-res-act">${sellable.map(i=>`<li data-tip-k="item:${i.id}">${icon(itemIcon(i),i.name)}<span><b>${esc(i.name)}</b><small>${i.tier?'T'+i.tier+' · ':''}q${Math.round(i.q)}</small></span><em>${itemPrice(i).toLocaleString()}</em><button class="btn mini" data-sitem="${i.id}">Sell</button></li>`).join('')||'<li class="cp-empty">Nothing to sell. Equipped gear and tools are kept.</li>'}</ul></section>
   <section><h3>Sell resources</h3><ul class="cp-res cp-res-act">${res.map(([n,r])=>`<li data-tip-k="res:${esc(n)}">${icon(resIcon(r),r.c)}<span><b>${esc(n)}</b><small>${r.units.toLocaleString()} u · ${resPrice(r).toFixed(2)} cr each</small></span><em>${Math.floor(r.units*resPrice(r)).toLocaleString()}</em><button class="btn mini" data-sres="${esc(n)}">Sell all</button></li>`).join('')||'<li class="cp-empty">No resources. Survey and harvest, then sell here, or haul more with a cart.</li>'}</ul></section></div>`;
  B.querySelectorAll('[data-buy]').forEach(b=>b.onclick=()=>{const s=SHOP.find(x=>x.id===b.dataset.buy);if(CH.credits<s.cost)return toast(`${s.name} costs ${s.cost.toLocaleString()} credits.`);CH.credits-=s.cost;
    if(s.mount){ownedMounts().push(s.mount);toast(`${s.name} added to your stable. Press V near it, or summon it from Mounts.`)}else{CH.inv.items.push({id:'i'+Date.now().toString(36),...s.make()});toast(`Bought ${s.name}.`)}markDirty();renderWin();mmHud()});
  B.querySelectorAll('[data-sres]').forEach(b=>b.onclick=()=>{const r=CH.inv.res[b.dataset.sres];if(!r)return;const cr=Math.floor(r.units*resPrice(r));CH.credits+=cr;delete CH.inv.res[b.dataset.sres];gainXP('merchant',Math.round(cr/20),'trade');toast(`Sold for ${cr.toLocaleString()} credits.`);markDirty();renderWin();mmHud()});
  B.querySelectorAll('[data-sitem]').forEach(b=>b.onclick=()=>{const it=CH.inv.items.find(i=>i.id===b.dataset.sitem);if(!it)return;const cr=itemPrice(it);CH.credits+=cr;CH.inv.items=CH.inv.items.filter(i=>i!==it);toast(`Sold ${it.name} for ${cr.toLocaleString()} credits.`);markDirty();renderWin();mmHud()})}

/* ---- F to interact: caravans, your parked cart ---- */
const promptEl=document.createElement('div');promptEl.className='gh-prompt mm-prompt';promptEl.hidden=true;hud.append(promptEl);
let interact=null;
function tickInteract(){interact=null;if(rts.on||!gw.hidden){promptEl.hidden=true;return}const cv=nearCaravan(),tm=nearTerminal();
  if(tm)interact={label:`F · Use the ${TERMINALS[tm.kind].name} mission terminal`,run:()=>{missionTerminal=tm;boardSalt=0;openWin('missions')}};
  else if(cv)interact={label:`F · Trade with ${cv.name}`,run:()=>{vendorName=cv.name;openWin('vendor')}};
  else if(play.mount&&play.mount.def.cart)interact={label:'F · Open the cart stash · V to park',run:()=>openWin('cart')};
  else if(parkedCart&&CH.cartPark&&Math.hypot(CH.cartPark.x-play.x,CH.cartPark.z-play.z)<9)interact={label:'F · Open the cart stash · V to drive',run:()=>openWin('cart')};
  promptEl.hidden=!interact;if(interact)promptEl.textContent=interact.label}


/* ================= HUD v2: 3D portrait, player frame, two action bars with drag and drop, skill book ================= */
const AB_ICON={attack:'ab_double_strike',power:'ab_concussive_blow',intimidate:'ab_demoralizing_shout',berserk:'ab_bloodlust',aimed:'ab_precision',headshot:'ab_headshot',suppress:'ab_multishot',
  heal:'ab_heal',stim:'ab_rejuvenate',dash:'ab_wind_walk',camp:'ab_bark_skin',inspire:'ab_blessing',perform:'ab_soothing_rain',survey:'cog',sample:'craft-resources_12',rally:'ab_war_cry',mount:'ab_feral_instinct'};
ABILITIES.push({id:'mount',name:'Mount',icon:'♞',always:true,run:()=>toggleMount(),desc:'Summon or dismiss your last mount (V).'});
const abIcon=a=>icon(AB_ICON[a.id]||(a.id.startsWith('elite_')?'ab_weapon_mastery':'ab_arcane_focus'),a.name);
function allAbilities(){return ABILITIES.concat(eliteAbilities())}
const abById=id=>allAbilities().find(a=>a.id===id);
const abKnown=a=>a&&(a.always||(a.req?hasBox(bx(...a.req)):true));

/* ---- bars: CH.bars = [[10 slot ids], [10 slot ids]]; a slot is 'ab:<id>' or 'it:<item name>' ---- */
function bars(){if(!CH)return[[],[]];if(!CH.bars){const k=knownAbilities().map(a=>'ab:'+a.id);CH.bars=[Array.from({length:10},(_,i)=>k[i]||null),Array.from({length:10},()=>null)];CH.bars[1][0]='ab:mount'}return CH.bars}
function slotInfo(v){if(!v)return null;const [t,...r]=v.split(':'),id=r.join(':');if(t==='ab'){const a=abById(id);return a?{kind:'ab',a,known:abKnown(a)}:null}
  if(t==='it'){const n=CH.inv.items.filter(i=>i.name===id).length;return{kind:'it',name:id,n,proto:CH.inv.items.find(i=>i.name===id)||{kind:/stim/i.test(id)?'medicine':'food',name:id}}}return null}
function useSlot(b,i){const v=bars()[b][i],s=slotInfo(v);if(!s)return;if(s.kind==='ab'){if(!s.known)return floatMsg(`You haven't learned ${s.a.name} yet.`);return useAbility(s.a)}
  const it=CH.inv.items.find(x=>x.name===s.name);if(!it)return floatMsg(`You have no ${s.name} left.`);const st=charStats(),heal=Math.round(150+it.q*.6*(1+(skillMods(CH).heal||0)/100));
  CH.hp=Math.min(st.maxHp,CH.hp+heal);CH.inv.items=CH.inv.items.filter(x=>x!==it);if(it.kind==='medicine')gainXP('medical',60,'healing');floatMsg(`${it.name}: restored ${heal} health`);markDirty();renderHud()}
function slotHtml(b,i){const v=bars()[b][i],s=slotInfo(v),key=(b?'⇧':'')+((i+1)%10);
  if(!s)return`<button class="empty" data-slot="${b}:${i}" data-tip-h="Empty slot" data-tip="Drag an ability from the skill book (K) or a consumable from your inventory (I) here."><kbd>${key}</kbd></button>`;
  if(s.kind==='ab')return`<button data-slot="${b}:${i}" draggable="true" class="${s.known?'':'locked'}" data-tip-k="ab:${s.a.id}"><kbd>${key}</kbd>${abIcon(s.a)}<i class="cd"></i></button>`;
  return`<button data-slot="${b}:${i}" draggable="true" data-tip-h="${esc(s.name)}" data-tip="${s.n} in your pack. Restores health."><kbd>${key}</kbd>${icon(itemIcon(s.proto),s.name)}<em>${s.n}</em></button>`}
let barSig='';
function renderBars(){if(!CH)return;const B=bars(),sig=JSON.stringify(B)+CH.inv.items.length+CH.skills.length;
  if(sig!==barSig){barSig=sig;$('#mmBar').innerHTML=B[0].map((_,i)=>slotHtml(0,i)).join('');$('#mmBar2').innerHTML=B[1].map((_,i)=>slotHtml(1,i)).join('')}
  const t=now();hud.querySelectorAll('[data-slot]').forEach(el=>{const [b,i]=el.dataset.slot.split(':').map(Number),s=slotInfo(B[b][i]);if(!s||s.kind!=='ab')return;const a=s.a,c=a.cost||{},left=Math.max(0,(cds[a.id]||0)-t);
    const cd=el.querySelector('.cd');if(cd)cd.style.setProperty('--p',a.cd?left/a.cd:0);el.classList.toggle('on',a.id==='attack'&&!!(combat.p||hunt.auto));el.classList.toggle('poor',!!((c.a&&CH.act<c.a)||(c.m&&CH.mind<c.m)))})}
hud.addEventListener('click',e=>{const el=e.target.closest('[data-slot]');if(!el)return;const [b,i]=el.dataset.slot.split(':').map(Number);useSlot(b,i)});
hud.addEventListener('contextmenu',e=>{const el=e.target.closest('[data-slot]');if(!el)return;e.preventDefault();const [b,i]=el.dataset.slot.split(':').map(Number);bars()[b][i]=null;markDirty();renderBars()});
// drag and drop between slots, from the skill book and from the inventory
let dragSrc=null;
addEventListener('dragstart',e=>{const el=e.target.closest&&e.target.closest('[data-slot],[data-drag]');if(!el)return;tip.hidden=true;
  dragSrc=el.dataset.slot?{slot:el.dataset.slot.split(':').map(Number)}:{val:el.dataset.drag};e.dataTransfer.setData('text/plain',el.dataset.slot||el.dataset.drag);e.dataTransfer.effectAllowed='move';document.body.classList.add('mm-dragging')});
addEventListener('dragover',e=>{if(dragSrc&&e.target.closest&&e.target.closest('[data-slot]'))e.preventDefault()});
addEventListener('drop',e=>{const el=e.target.closest&&e.target.closest('[data-slot]');if(!el||!dragSrc)return;e.preventDefault();const [b,i]=el.dataset.slot.split(':').map(Number),B=bars();
  if(dragSrc.slot){const [sb,si]=dragSrc.slot;[B[b][i],B[sb][si]]=[B[sb][si],B[b][i]]}else B[b][i]=dragSrc.val;dragSrc.done=true;markDirty();barSig='';renderBars()});
addEventListener('dragend',()=>{if(dragSrc&&dragSrc.slot&&!dragSrc.done){const [sb,si]=dragSrc.slot;bars()[sb][si]=null;markDirty();barSig='';renderBars()}dragSrc=null;document.body.classList.remove('mm-dragging')});
addEventListener('keydown',e=>{if(e.target.tagName==='INPUT'||e.target.tagName==='SELECT'||level!=='ground'||groundMode!=='play'||!CH||rts.on)return;const m=e.code&&e.code.match(/^Digit(\d)$/);if(!m||document.getElementById('ggDlg'))return;
  e.preventDefault();e.stopImmediatePropagation();useSlot(e.shiftKey?1:0,(+m[1]+9)%10)},true);

/* ---- 3D portrait of the actual character ---- */
let portraitR=null,portraitKey='';
function renderPortrait(){if(!CH||!toonReady[CH.race])return false;const key=[CH.race,CH.cls,CH.set,gearTier(),weaponProf(CH)].join('|');if(key===portraitKey)return true;
  try{if(!portraitR){portraitR=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});portraitR.setSize(128,128);portraitR.setPixelRatio(1)}}catch(e){return false}
  const S=new THREE.Scene();S.add(new THREE.HemisphereLight(0xfff4e0,0x3a2a20,1.1));const dl=new THREE.DirectionalLight(0xffffff,.6);dl.position.set(.6,1,1);S.add(dl);
  const m=toonInstance(CH.race,{race:CH.race,cls:CH.cls,set:CH.set,tier:gearTier(),wprof:weaponProf(CH)},{});if(!m)return false;if(m.userData.mixer)m.userData.mixer.update(.4);S.add(m);m.updateMatrixWorld(true);
  const head=m.getObjectByName('Bip001_Head')||m.getObjectByName('Bip001 Head'),box=new THREE.Box3().setFromObject(m),h=box.max.y-box.min.y,hp=new THREE.Vector3();
  if(head)head.getWorldPosition(hp);else hp.set(0,box.max.y-h*.12,0);const cam=new THREE.PerspectiveCamera(30,1,.01,50);cam.position.set(hp.x+h*.05,hp.y+h*.04,hp.z+h*.42);cam.lookAt(hp.x,hp.y+h*.02,hp.z);
  portraitR.render(S,cam);const cv=$('#mmPortrait'),x=cv.getContext('2d');x.clearRect(0,0,64,64);const g=x.createRadialGradient(32,30,4,32,32,36);g.addColorStop(0,'#3a2a1c');g.addColorStop(1,'#0b0806');
  x.save();x.beginPath();x.arc(32,32,31,0,TAU);x.clip();x.fillStyle=g;x.fillRect(0,0,64,64);x.drawImage(portraitR.domElement,0,0,64,64);x.restore();portraitKey=key;return true}
drawPortrait=(()=>{const orig=drawPortrait;return()=>{if(!renderPortrait())orig()}})();

/* ---- player frame details: faction, planet, biome, credits ---- */
function factionOf(race){const r=GD.races.find(x=>x.id===race);const f=r&&GD.factions.find(x=>x.id===r.faction);return f||{name:'Unaligned',color:'#9aa'}}
function mmFrameExtras(){if(!CH||hud.hidden)return;const f=factionOf(CH.race),bio=groundWorld&&typeof biomeAt==='function'?biomeAt(groundWorld,play.x,play.z):null;
  const pf=groundWorld&&PLANET_FACTION[groundWorld.id],hr=gameHour(),clock=`${String(Math.floor(hr)).padStart(2,'0')}:${String(Math.floor(hr%1*60)).padStart(2,'0')}`;
  const el=$('#mmWhere');if(el)el.innerHTML=`<span style="color:${f.color||'#ccc'}">◆ ${esc(f.name)}</span> · ${esc(planetName(groundWorld||curWorld||{id:''}))}${bio?' · '+esc(bio.name):''} · ${clock}${pf?`<br><span data-tip-h="${esc((FACTION[pf]||{}).name)} standing" data-tip="${standing(pf)} points. Guards turn hostile at -1,000. Raise it with faction missions and by clearing threats near their cities.">${esc((FACTION[pf]||{}).name)}: ${standingWord(standing(pf))}</span>`:''}`;
  const cr=$('#ghCr');if(cr)cr.innerHTML=`<img src="ui/craftpix/resources/tgb_coin.png" alt="" width="12" height="12"> ${CH.credits.toLocaleString()} <span>${Store.mode==='cloud'?'· saved to your account':'· saved in this browser'}</span>`}

/* ---- skill book: professions, abilities, experience ---- */
let bookTab='prof';
function winSkills(B){$('#gwTitle').textContent='Skill book';const used=pointsUsed(CH),byProf=Object.keys(PROF).map(pid=>[pid,CH.skills.filter(id=>BOXES[id]&&BOXES[id].prof===pid).reduce((a,id)=>a+BOXES[id].pts,0)]).filter(([,n])=>n);
  B.innerHTML=`<div class="bk-head"><nav>${[['prof','Professions'],['abil','Abilities'],['xp','Experience']].map(([k,l])=>`<button data-bk="${k}" aria-pressed="${bookTab===k}">${l}</button>`).join('')}</nav>
     <div class="bk-points" data-tip-h="Skill points" data-tip="${used} of ${SKILL_POINTS} spent. Surrender boxes to free points."><div>${byProf.map(([pid,n])=>`<i style="width:${100*n/SKILL_POINTS}%;background:${PROF[pid].color}" title="${esc(PROF[pid].name)}: ${n}"></i>`).join('')}</div><span>${used} / ${SKILL_POINTS} skill points</span></div></div><div id="bookPage"></div>`;
  B.querySelectorAll('[data-bk]').forEach(b=>b.onclick=()=>{bookTab=b.dataset.bk;renderWin()});const P=$('#bookPage');
  if(bookTab==='prof'){winSkillTree(P);$('#gwTitle').textContent='Skill book';return}
  if(bookTab==='abil'){const list=allAbilities();P.innerHTML=`<p class="gw-note">Drag an ability onto an action bar, or use Add to bar. Right-click a bar slot to clear it. Locked abilities show which box teaches them.</p>
    <div class="bk-abil">${list.map(a=>{const k=abKnown(a),c=a.cost||{};return`<div class="bk-card${k?'':' locked'}" ${k?`draggable="true" data-drag="ab:${a.id}"`:''} data-tip-k="ab:${a.id}">${abIcon(a)}<span><b>${esc(a.name)}</b><small>${c.a?c.a+' Action · ':''}${c.m?c.m+' Mind · ':''}${a.cd?a.cd+' s':'instant'}</small><small>${k?esc(a.desc):'Learn '+esc((BOXES[bx(...(a.req||[]))]||{}).name||'')}</small></span>${k?`<button class="btn mini" data-addbar="${a.id}">Add to bar</button>`:''}</div>`}).join('')}</div>`;
    P.querySelectorAll('[data-addbar]').forEach(b=>b.onclick=()=>{const B2=bars();for(const row of B2){const i=row.indexOf(null);if(i>=0){row[i]='ab:'+b.dataset.addbar;markDirty();barSig='';renderBars();return toast('Added to your action bar.')}}toast('Both bars are full. Right-click a slot to clear it.')});return}
  const types=[...new Set(Object.keys(CH.xp).concat(CH.skills.flatMap(id=>Object.values(BOXES).filter(b=>b.req.includes(id)).map(b=>b.xpType))))].filter(t=>t&&XP_NAME[t]);
  P.innerHTML=`<p class="gw-note">XP runs at a 10× server rate. Costs, credits and skill points are the classic skill-table values.</p><ul class="cp-res">${types.map(t=>{const have=CH.xp[t]||0,next=Object.values(BOXES).filter(b=>b.xpType===t&&b.xp>0&&!CH.skills.includes(b.id)&&b.req.every(r=>CH.skills.includes(r))).sort((a,b)=>a.xp-b.xp)[0];
    return`<li>${icon('ab_arcane_focus','')}<span><b>${esc(xpName(t))}</b><small>${next?`Next: ${esc(next.name)} (${PROF[next.prof].name}) needs ${next.xp.toLocaleString()}`:'No box waiting on this XP'}</small><span class="bk-xpbar"><i style="width:${next?Math.min(100,100*have/next.xp):100}%"></i></span></span><em>${have.toLocaleString()}</em></li>`}).join('')||'<li class="cp-empty">No experience yet. Fight, craft, survey, heal or perform to earn it.</li>'}</ul>`}


/* ================= NPC AI: archetypes, aggro and packs, leashing, guards, townsfolk goals, faction standing ================= */
const DAY_SECONDS=40*60;
const gameHour=()=>((Date.now()/1000/DAY_SECONDS)%1)*24;
const isNight=()=>{const h=gameHour();return h>=21||h<5};
const RIVAL={crusade:'legion',legion:'crusade',fabled:'legion'};
const CREATURE_FACTION={orcs:'legion',undead:'legion',trolls:'legion',minotaurs:'crusade',titans:'crusade',elementals:'fabled',golems:'fabled'};
function playerFaction(){return CH?((GD.races.find(r=>r.id===CH.race)||{}).faction):null}
function standing(fid){if(!CH||!fid)return 0;CH.faction=CH.faction||{};if(CH.faction[fid]==null){const pf=playerFaction();CH.faction[fid]=pf===fid?750:RIVAL[pf]===fid?-600:0}return CH.faction[fid]}
function addStanding(fid,n,why){if(!CH||!fid||!n)return;const before=standing(fid);CH.faction[fid]=Math.max(-5000,Math.min(5000,before+n));markDirty();
  if(Math.abs(n)>=25)mmLog(`${n>0?'+':''}${n} standing with ${(FACTION[fid]||{name:fid}).name}${why?' · '+why:''}`,'sys')}
const standingWord=v=>v>=2000?'Revered':v>=750?'Honored':v>=100?'Friendly':v>-100?'Neutral':v>-1000?'Unfriendly':'Hostile';
// archetypes for hostile creature categories
const ARCH={beasts:{aggro:12,pack:16,flee:.25,ranged:0},reptiles:{aggro:10,pack:12,flee:0,ranged:0},spiders:{aggro:9,pack:10,flee:0,ranged:0,burst:1.5},
  orcs:{aggro:20,pack:22,flee:0,ranged:14},undead:{aggro:18,pack:18,flee:0,ranged:12},trolls:{aggro:16,pack:14,flee:0,ranged:0},minotaurs:{aggro:16,pack:12,flee:0,ranged:0},titans:{aggro:18,pack:0,flee:0,ranged:0},
  golems:{aggro:9,pack:0,flee:0,ranged:0,slow:.7},elementals:{aggro:11,pack:0,flee:0,ranged:10},dragons:{aggro:26,pack:0,flee:0,ranged:16},egyptians:{aggro:16,pack:16,flee:0,ranged:12}};
const GREET={friendly:['Well met, friend of the {f}.','Safe travels, {n}.','The {f} remembers your deeds.','Good to see you again.'],neutral:['Hm. Traveler.','Keep your weapons sheathed in town.','Looking for work? Try the mission terminal.','Fresh water and supplies at the market.'],
  wary:['We don\'t see your kind welcome here.','Watch yourself, outsider.','The guards have their eye on you.'],night:['Late to be out walking.','The cantina\'s still open, if you\'re thirsty.','Mind the dark beyond the walls.']};
let greetT=0;
function aiTick(c,dt,w){const u=c.userData,p=u.p;if(!p||!p.g||p.dead||u.brain)return;// scripted brains (src/script/ai) own these creatures
const g=p.g,playing=CH&&groundMode==='play'&&level==='ground',px=play.x,pz=play.z;
  const dP=playing?Math.hypot(px-u.pos.x,pz-u.pos.z):1e9;u.ai=u.ai||{state:'idle',t:0,goalT:Math.random()*10};const ai=u.ai;ai.t+=dt;u.run=1;
  if(g.kind==='friendly'){
    // trainers stand their post and face you
    if(p.trainer){u.aiHold=true;u.target=null;if(dP<10){const want=Math.atan2(px-u.pos.x,-(pz-u.pos.z));let dy=((want-u.yaw+Math.PI)%TAU+TAU)%TAU-Math.PI;u.yaw+=dy*Math.min(1,dt*4)}return}
    const f=g.faction,st=standing(f);
    if(g.role==='Guard'||g.role==='Captain'){u.aiHold=true;
      // engage hostile creatures near the guard, or the player if the guard's faction is hostile to them
      let foe=null,fd=26;for(const [i,h] of npcToons){const q=w.placements[i];if(!q.g||q.g.kind==='friendly'||q.dead)continue;const d=Math.hypot(h.userData.pos.x-u.pos.x,h.userData.pos.z-u.pos.z);if(d<fd){fd=d;foe={q,pos:h.userData.pos,h}}}
      const hostileToPlayer=playing&&st<=-1000&&dP<22;
      if(hostileToPlayer&&(!foe||dP<fd)){if(ai.state!=='arrest'){ai.state='arrest';mmLog(`${g.name}: "Halt! Enemy of ${(FACTION[f]||{name:'the city'}).name}!"`,'combat')}
        u.target=dP>2.5?{x:px-(px-u.pos.x)/dP*2,z:pz-(pz-u.pos.z)/dP*2}:null;u.run=2.4;u.combat=true;ai.cd=(ai.cd||0)-dt;
        if(dP<3&&ai.cd<=0){ai.cd=2;const dm=Math.round((14+g.tier*8)*(600/(600+charStats().def))/mmDefMul());CH.hp-=dm;floatMsg(`${g.name} strikes you for ${dm}`);if(u.toonObj)toonOneShot(u.toonObj,'attack');if(CH.hp<=0)incapacitate()}return}
      if(foe){ai.state='fight';u.combat=true;u.run=2.2;const d=fd;u.target=d>2.5?{x:foe.pos.x,z:foe.pos.z}:null;ai.cd=(ai.cd||0)-dt;
        if(d<3.2&&ai.cd<=0){ai.cd=1.8;npcStats(foe.q);foe.q.g.hp-=Math.round(25+g.tier*12);if(u.toonObj)toonOneShot(u.toonObj,'attack');
          if(foe.q.g.hp<=0){foe.q.dead=true;foe.q.corpse={t:Date.now()};toonGroup.remove(foe.h);npcToons.delete(w.placements.indexOf(foe.q));setTimeout(()=>{foe.q.dead=false;foe.q.g.hp=foe.q.g.maxHp},300000);if(dP<60)mmLog(`${g.name} cuts down the ${foe.q.g.name}.`,'combat')}}return}
      u.combat=false;ai.state='patrol';ai.goalT-=dt;if(!u.target)npcIdleAnim(u,ai,dt,'guard',g.role);if(!u.target&&ai.goalT<=0){ai.goalT=6+Math.random()*8;const a=(ai.pa=(ai.pa||Math.random()*TAU)+1.1),r=18+Math.random()*10;u.target={x:u.home.x+Math.cos(a)*r,z:u.home.z+Math.sin(a)*r}}return}
    // townsfolk goals
    u.aiHold=true;ai.goalT-=dt;
    if(ai.goalT<=0&&!u.target&&dailyRoute(u,ai,g,w))ai.goalT=25+Math.random()*30;
    if(ai.goalT<=0&&!u.target){const night=isNight(),R=Math.random();ai.goalT=night?25+R*20:12+R*25;
      if(night&&R<.7){ai.goal='home';u.target={x:u.home.x,z:u.home.z}}
      else if(R<.35){ai.goal='stroll';const a=Math.random()*TAU,r=6+Math.random()*24;u.target={x:u.home.x+Math.cos(a)*r,z:u.home.z+Math.sin(a)*r}}
      else if(R<.6){ai.goal='visit';let best=null,bd=70;for(const q of w.placements){if(q.k==='npc'||q.k==='travel'||!q.w)continue;const d=Math.hypot(q.x-u.home.x,q.z-u.home.z);if(d<bd&&Math.random()<.3){bd=d;best=q}}
        if(best){const a=Math.random()*TAU,r=(best.r||5)+2;u.target={x:best.x+Math.cos(a)*r,z:best.z+Math.sin(a)*r}}}
      else if(R<.8){ai.goal='gather';let best=null,bd=30;for(const [i,h] of npcToons){if(h===c)continue;const q=w.placements[i];if(!q.g||q.g.kind!=='friendly')continue;const d=Math.hypot(h.userData.pos.x-u.pos.x,h.userData.pos.z-u.pos.z);if(d<bd){bd=d;best=h}}
        if(best){const bp=best.userData.pos,dx=u.pos.x-bp.x,dz=u.pos.z-bp.z,dd=Math.hypot(dx,dz)||1;u.target={x:bp.x+dx/dd*1.6,z:bp.z+dz/dd*1.6}}}
      else ai.goal='rest'}
    if(!u.target)npcIdleAnim(u,ai,dt,ai.goal,g.role);
    // greet the player, with faction-aware lines
    if(playing&&dP<5&&(ai.greeted||0)<Date.now()-60000&&greetT<=0){ai.greeted=Date.now();greetT=8;const pool=isNight()?GREET.night:st>=100?GREET.friendly:st>-100?GREET.neutral:GREET.wary;
      mmLog(pool[Math.floor(Math.random()*pool.length)].replace('{f}',(FACTION[f]||{name:'city'}).name).replace('{n}',CH.name),'chat',g.name);u.target=null;const want=Math.atan2(px-u.pos.x,-(pz-u.pos.z));u.yaw=want;if(u.toonObj&&u.toonObj.userData.mixer)toonPlay(u.toonObj,Math.random()<.5?'pointing':'patting',.3,{once:true})}
    return}
  // ---- hostile creatures ----
  const A=ARCH[g.cat]||ARCH.beasts;npcStats(p);u.aiHold=true;const home=u.home,fromHome=Math.hypot(u.pos.x-home.x,u.pos.z-home.z);
  const allied=CREATURE_FACTION[g.cat]&&standing(CREATURE_FACTION[g.cat])>=750;const con=g.tier-Math.ceil(combatLevel()/11);
  if(ai.state==='return'){u.run=2.2;u.target={x:home.x,z:home.z};if(fromHome<2){ai.state='idle';g.hp=g.maxHp;u.target=null;u.combat=false}return}
  if(ai.state==='flee'){u.run=2.6;if(dP>30||ai.t>8){ai.state='return';ai.t=0}else{const dx=u.pos.x-px,dz=u.pos.z-pz,dd=Math.hypot(dx,dz)||1;u.target={x:u.pos.x+dx/dd*8,z:u.pos.z+dz/dd*8}}return}
  const engaged=ai.state==='chase'||combat.p===p;
  if(!engaged){ai.goalT-=dt;if(ai.goalT<=0&&!u.target){ai.goalT=3+Math.random()*7;const a=Math.random()*TAU,r=3+Math.random()*10;u.target={x:home.x+Math.cos(a)*r,z:home.z+Math.sin(a)*r}}
    const aggroR=A.aggro*(allied?.4:1)*(con<-2?0:1)*(isNight()?1.2:1);
    if(playing&&!rts.on&&dP<aggroR&&CH.hp>0){ai.state='chase';ai.t=0;mmLog(`The ${g.name} attacks!`,'combat');
      if(A.pack)for(const [i,h] of npcToons){const q=w.placements[i];if(q===p||!q.g||q.g.cat!==g.cat||q.dead)continue;const hu=h.userData;if(Math.hypot(hu.pos.x-u.pos.x,hu.pos.z-u.pos.z)<A.pack&&hu.ai&&hu.ai.state!=='chase'){hu.ai.state='chase';hu.ai.t=0}}}
    return}
  // chasing / fighting
  if(fromHome>70||!playing||CH.hp<=0){ai.state='return';ai.t=0;if(combat.p===p){combat.p=null;floatMsg(`The ${g.name} breaks off and returns home.`)}return}
  if(A.flee&&g.hp<g.maxHp*A.flee&&g.tier<=3){ai.state='flee';ai.t=0;if(combat.p===p)combat.p=null;floatMsg(`The ${g.name} flees!`);return}
  u.combat=true;u.run=(A.slow||1)*2.3*(A.burst&&ai.t<3?A.burst:1);const reach=A.ranged||2.4;u.target=dP>reach?{x:px-(px-u.pos.x)/dP*(reach-.5),z:pz-(pz-u.pos.z)/dP*(reach-.5)}:null;
  if(!u.target){const want=Math.atan2(px-u.pos.x,-(pz-u.pos.z));let dy=((want-u.yaw+Math.PI)%TAU+TAU)%TAU-Math.PI;u.yaw+=dy*Math.min(1,dt*6)}
  ai.cd=(ai.cd||1)-dt;if(combat.p!==p&&dP<=reach+.6&&ai.cd<=0){ai.cd=A.ranged?2.6:2.1;const st=charStats(),dm=Math.round(g.dmg*enemyMul(p)/mmDefMul()*(.7+Math.random()*.6)*(600/(600+st.def)));CH.hp-=dm;
    floatMsg(`The ${g.name} hits you for ${dm}`);if(u.toonObj)toonOneShot(u.toonObj,'attack');if(CH.hp<=0){incapacitate();ai.state='return'}}}


function npcStrike(p,u){const g=p.g;npcStats(p);const ER=ggEnemyHit(g,enemyMul(p)/mmDefMul()),dm=ER.dmg;CH.hp-=dm;floatMsg(ggTakenText('The '+g.name,ER));if(u.toonObj)toonOneShot(u.toonObj,'attack');
  if(play.model&&dm>0&&Math.random()<.5)setTimeout(()=>play.model&&toonOneShot(play.model,dm>charStats().maxHp*.12?'stagger':'hit'),220);renderHud();if(CH.hp<=0)incapacitate();return ER}
function npcCallPack(c,p,radius){const u=c.userData;for(const [i,h] of npcToons){const q=groundWorld.placements[i];if(q===p||!q.g||q.g.cat!==p.g.cat||q.dead)continue;const hu=h.userData;if(Math.hypot(hu.pos.x-u.pos.x,hu.pos.z-u.pos.z)<radius&&hu.brain)hu.brain.send('attacked')}}
/* ================= Mission terminals: physical kiosks in every city, missions by terminal type ================= */
const TERMINALS={general:{name:'General',color:'#6ff0ff',kinds:['destroy','destroy','explore']},artisan:{name:'Artisan',color:'#f2a24a',kinds:['survey','survey']},
  entertainer:{name:'Entertainer',color:'#c58bff',kinds:['entertain']},scout:{name:'Scout',color:'#8fe07a',kinds:['hunt','explore']},faction:{name:'Faction',color:'#ffd75a',kinds:['destroy','destroy']}};
let terminals=[],missionTerminal=null;
function buildTerminals(w){terminals.forEach(t=>G.ground.remove(t.obj));terminals=[];const cities=w.pois.filter(q=>q.cat==='city').sort((a,b)=>b.r-a.r);
  cities.forEach((q,ci)=>{const kinds=['general','artisan','entertainer','scout'].concat(ci<2?['faction']:[]),R=Math.min(70,Math.max(24,q.r*.18))+16,off=(strHash(q.name+'t')%628)/100;
    kinds.forEach((k,j)=>{const a=off+j/kinds.length*TAU,x=q.x+Math.cos(a)*R,z=q.z+Math.sin(a)*R,T=TERMINALS[k],fac=k==='faction'?PLANET_FACTION[w.id]:null,c=col(fac&&FACTION[fac]?FACTION[fac].color:T.color);
      const g=new THREE.Group(),dark=new THREE.MeshLambertMaterial({color:0x2c3440});
      const base=new THREE.Mesh(new THREE.CylinderGeometry(.9,1.1,.4,8),dark);base.position.y=.2;g.add(base);
      const post=new THREE.Mesh(new THREE.BoxGeometry(.5,1.6,.5),dark);post.position.y=1.2;g.add(post);
      const head=new THREE.Mesh(new THREE.BoxGeometry(1.3,.9,.18),dark);head.position.set(0,2.15,.1);head.rotation.x=-.35;g.add(head);
      const scr=new THREE.Mesh(new THREE.PlaneGeometry(1.1,.7),new THREE.MeshBasicMaterial({color:c}));scr.position.set(0,2.16,.2);scr.rotation.x=-.35;g.add(scr);
      const holo=new THREE.Mesh(new THREE.OctahedronGeometry(.28),new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:.85}));holo.position.y=3.1;g.add(holo);
      const beam=new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,36,6,1,true),new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:.18,depthWrite:false}));beam.position.y=21;g.add(beam);
      g.position.set(x,groundH(w,x,z),-z);g.rotation.y=Math.atan2(q.x-x,-(q.z-z))+Math.PI;G.ground.add(g);terminals.push({obj:g,holo,kind:k,x,z,city:q.name,faction:fac})})})}
function tickTerminals(dt){const t=now();for(const k of terminals){k.holo.rotation.y=t*1.5;k.holo.position.y=3.1+Math.sin(t*2+k.x)*.12}}
const nearTerminal=()=>terminals.find(k=>Math.hypot(k.x-play.x,k.z-play.z)<4.5);
function atTerminal(){return missionTerminal&&Math.hypot(missionTerminal.x-play.x,missionTerminal.z-play.z)<7}


// Ground detail: a tiling grain/grass texture multiplied over the biome vertex colours, so the terrain reads at walking height.
let groundDetailTex=null;
function groundDetail(){if(groundDetailTex)return groundDetailTex;const N=256,cv=document.createElement('canvas');cv.width=cv.height=N;const x=cv.getContext('2d'),id=x.createImageData(N,N),R=mulberry(99);
  const v=new Float32Array(N*N);for(let o=0;o<4;o++){const s=4<<o,amp=1/(o+1),g=[];for(let i=0;i<(N/s+1)*(N/s+1);i++)g.push(R());const W=N/s+1;
    for(let j=0;j<N;j++)for(let i=0;i<N;i++){const gx=i/s,gy=j/s,ix=Math.floor(gx),iy=Math.floor(gy),fx=gx-ix,fy=gy-iy,a=g[iy*W+ix],b=g[iy*W+(ix+1)%W],c=g[((iy+1)%W)*W+ix],d=g[((iy+1)%W)*W+(ix+1)%W];
      v[j*N+i]+=amp*((a*(1-fx)+b*fx)*(1-fy)+(c*(1-fx)+d*fx)*fy)}}
  for(let i=0;i<N*N;i++){let t=.72+v[i]/2.1*.2+(R()<.06?(R()-.5)*.22:0)+(R()-.5)*.06;t=Math.max(.55,Math.min(1,t));const k=i*4;id.data[k]=t*255;id.data[k+1]=t*250;id.data[k+2]=t*240;id.data[k+3]=255}
  x.putImageData(id,0,0);const tex=new THREE.CanvasTexture(cv);tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(EXT/12,EXT/12);tex.anisotropy=renderer.capabilities.getMaxAnisotropy();return groundDetailTex=tex}
/* ---------------- water: a real animated surface over the lakes and rivers the surface layer finds ---------------- */
let waterMat=null;
function buildWater(w,H,N,cell,pa,surf){const wa=surf.wa,Hs=surf.Hs,S={water:surf.waterCol&&'#'+surf.waterCol.getHexString()};w.waterLv=null;if(!S.water)return;
  const lv=new Float32Array(H.length);for(let i=0;i<H.length;i++)lv[i]=Math.max(H[i]+.4,Hs[i]-(surf.wetv[i]-.5)*25+1);
  const idx=new Int32Array(H.length).fill(-1),pos=[],al=[],ind=[];const vert=i=>{if(idx[i]<0){idx[i]=pos.length/3;pos.push(pa.getX(i),lv[i],pa.getZ(i));al.push(Math.min(1,wa[i]*1.6))}return idx[i]};
  for(let y=0;y<N-1;y++)for(let x=0;x<N-1;x++){const a=y*N+x,b=a+1,c=a+N,d=c+1;if(Math.max(wa[a],wa[b],wa[c],wa[d])<.15)continue;ind.push(vert(a),vert(c),vert(b),vert(b),vert(c),vert(d))}
  if(!ind.length)return;w.waterLv=lv;
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('alpha',new THREE.Float32BufferAttribute(al,1));g.setIndex(ind);
  const sky=col(w.biome.sky),base=col(S.water);
  waterMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{t:{value:0},base:{value:base},deep:{value:base.clone().multiplyScalar(.45)},sky:{value:sky.lerp(col('#ffffff'),.35)},sun:{value:new V3(.5,1,.35).normalize()}},
    vertexShader:`attribute float alpha;varying float vA;varying vec3 vW;void main(){vA=alpha;vec4 wp=modelMatrix*vec4(position,1.);vW=wp.xyz;gl_Position=projectionMatrix*viewMatrix*wp;}`,
    fragmentShader:`uniform float t;uniform vec3 base,deep,sky,sun;varying float vA;varying vec3 vW;
      void main(){vec2 p=vW.xz;
        float a=cos(p.x*.045+t*1.3)*.5+cos(p.y*.06-t*1.1)*.4+cos((p.x+p.y)*.11+t*2.1)*.22+cos((p.x-p.y)*.19-t*2.7)*.12;
        float bx=-sin(p.x*.045+t*1.3)*.0225-sin((p.x+p.y)*.11+t*2.1)*.0242-sin((p.x-p.y)*.19-t*2.7)*.0228;
        float bz=-sin(p.y*.06-t*1.1)*.024-sin((p.x+p.y)*.11+t*2.1)*.0242+sin((p.x-p.y)*.19-t*2.7)*.0228;
        vec3 n=normalize(vec3(-bx*6.,1.,-bz*6.));vec3 v=normalize(cameraPosition-vW);
        float fr=pow(1.-max(dot(n,v),0.),3.)*.85+.08;float sp=pow(max(dot(reflect(-sun,n),v),0.),90.);
        vec3 c=mix(mix(base,deep,smoothstep(.3,1.,vA)),sky,fr)+sp*.9+a*.025;
        float edge=smoothstep(.0,.35,vA);gl_FragColor=vec4(c,edge*(.62+fr*.3));}`});
  const m=new THREE.Mesh(g,waterMat);m.renderOrder=2;G.ground.add(m)}
// water depth under a point (0 on dry land), sampled from the grid
function waterDepth(w,x,z){const G2=w&&w.surfGrid;if(!G2||!w.waterLv||!G2.water)return 0;const fx=(x+HALF)/G2.cell,fy=(HALF-z)/G2.cell,ix=Math.round(fx),iy=Math.round(fy);if(ix<0||iy<0||ix>=G2.N||iy>=G2.N)return 0;
  const i=iy*G2.N+ix;if(G2.water[i]<.35)return 0;return Math.max(0,w.waterLv[i]-groundH(w,x,z))}
/* ---------------- trainers: the six starting trainers in every city, elite trainers in each planet's two largest ---------------- */
function addTrainers(w){if(w.trainersAdded)return;w.trainersAdded=true;const cities=w.pois.filter(q=>q.cat==='city').sort((a,b)=>b.r-a.r);const starts=Object.keys(PROF).filter(k=>PROF[k].start),elites=Object.keys(PROF).filter(k=>!PROF[k].start);
  cities.forEach((q,ci)=>{const list=ci<2?starts.concat(elites.filter((_,i)=>i%2===ci)):starts,R=Math.min(70,Math.max(24,q.r*.18)),off=(strHash(q.name)%628)/100;
    list.forEach((pid,k)=>{const a=off+k/list.length*TAU,rr=R+(k%2)*10;w.placements.push({t:'trainer_'+pid,k:'npc',x:q.x+Math.cos(a)*rr,z:q.z+Math.sin(a)*rr,trainer:pid})})})}

/* ================= Grudge Realms: the nine Warlords zones as planets (objectstore api/v1 warlords-zones.json) ================= */
// new surface palettes for the realm biomes
Object.assign(SURF,{
  tropical:{water:'#2a9fa6',wet:.7,rock:'#7a6f5e',scree:'#9c8f76',soil:'#8a7350',grass:'#4f9a3c',meadow:'#86b450',sand:'#f0dca6',aridity:.25,relief:110,tree:{kind:'broad',color:'#3f8a35',density:.5}},
  ethereal:{water:'#6f9ee0',wet:.78,rock:'#5d5878',scree:'#7a7298',soil:'#4c4466',grass:'#5f6fc0',meadow:'#9a7ad8',sand:'#c8bce6',snow:'#f2eeff',snowAlt:260,aridity:.1,relief:220,tree:{kind:'crystal',color:'#9b7ae6',density:.45}},
  storm:{water:'#3b5f70',wet:.72,rock:'#4c5560',scree:'#66707a',soil:'#5a5a50',grass:'#4a6a58',meadow:'#6a7f68',sand:'#c9a99a',aridity:.2,relief:150,tree:{kind:'conifer',color:'#2f4a40',density:.2}},
  abyss:{water:'#1d3a46',wet:.55,rock:'#2a2f38',scree:'#3a404a',soil:'#30342e',grass:'#2f4a44',meadow:'#3f5a50',sand:'#5a6660',aridity:.1,relief:140,tree:{kind:'broad',color:'#24403a',density:.25}},
  glass:{rock:'#5a4a44',scree:'#7a665a',soil:'#8a7462',grass:'#8a7a5a',meadow:'#9a8a66',sand:'#dcd8c8',aridity:.95,relief:170,tree:{kind:'crystal',color:'#bfe6ea',density:.06}}});
Object.assign(BIOMES,{
  tropical:{sea:['#1f7f8a',.5],land:['#d8c48e','#5c9a46','#2f6a32'],sky:'#9cd4e6',glow:'#6ff0e0'},
  ethereal:{sea:['#3a4a9a',.35],land:['#3c3070','#6c5ab8','#c8b8f0'],sky:'#a898d8',glow:'#c08aff'},
  storm:{sea:['#1c3442',.5],land:['#3a4a48','#5a6a60','#a99a8a'],sky:'#6a7682',glow:'#7fb0ff'},
  abyss:{sea:['#0c1c26',.55],land:['#1a2228','#2c3a3a','#4a5a54'],sky:'#3a4e58',glow:'#3ae0c0'},
  glass:{sea:null,land:['#6a5248','#b8a890','#e8e4d8'],sky:'#c8b49a',glow:'#ffd890'}});
Object.assign(BIOME_MOBS,{tropical:[['beasts',4],['reptiles',3],['orcs',2],['dragons',.2]],ethereal:[['elementals',4],['spiders',2],['beasts',2],['dragons',.8]],
  storm:[['reptiles',3],['elementals',3],['orcs',2],['dragons',.6]],abyss:[['undead',5],['reptiles',2],['trolls',2],['dragons',.5]],glass:[['elementals',3],['golems',2],['reptiles',2],['undead',2],['dragons',.8]]});
for(const k in BIOME_RES){const add={3:'|tropical|ethereal',6:'|glass|storm',7:'|abyss|tropical',4:'|abyss',2:'|storm|glass',1:'|tropical|glass',8:'|storm',5:'|glass|ethereal'}[k];if(add)BIOME_RES[k]=new RegExp(BIOME_RES[k].source+add)}

const REALMS=[
 {id:'ethereal_falls',kit:'castle',name:'Ethereal Falls',grid:[0,0],diff:[3,6],faction:'fabled',globe:'ethereal',
  regions:[['ethereal','Ethereal Falls','mountains'],['ethereal','Prism Meadows','flats'],['forest','Whisperwood','hills']],
  town:{name:'Falls Sanctum',race:'elf',sub:'Fabled Satellite · Arcane Wilds'},res:['Arcane dust','Herbs','Crystals'],
  desc:'Remote magical falls — satellite Fabled wilds.',lore:'Water falls upward here. The Omni is said to have wept the first spell into these cliffs, and elven seers still read the spray for omens. Arcane dust gathers in the meadows each dawn.',
  camps:['spirit_wisp','fire_elemental','webweaver_spider'],landmarks:['Weeping Spire','Upfall Basin','Prism Stair'],events:[]},
 {id:'frostbite_expanse',kit:'castle',name:'Frostbite Expanse',grid:[1,0],diff:[4,7],faction:'fabled',globe:'ice',
  regions:[['ice','Forge Islands','hills'],['ice','Glacier Shelf','flats'],['ice','Runecrag Peaks','mountains']],
  capital:{name:'Runeforge Hold',race:'dwarf',sub:'Dwarf Capital · Fabled Core'},res:['Iron ore','Frost crystals','Furs'],
  desc:'Fabled sector core: a multi-island forge village. Cave doorways lead into the dwarf main city.',lore:'The dwarves of Runeforge Hold keep the Fabled forges lit beneath the ice. Every blade the alliance carries was quenched in glacier melt here, and every forge-master swears to the Omni never to let the fires die.',
  dungeons:[{name:'Glacial Depths',theme:['frost_troll','ice_golem','frost_troll'],boss:'Frost Warden',tier:5}],camps:['frost_troll','ice_golem','raider_band'],landmarks:['Hammerfall Cairn','Frozen Anvil'],
  events:[{name:'Howling Blizzard',type:'weather',sched:'hourly_chance',fx:'blizzard'},{name:'Forge Surge',type:'island',sched:'weekend',fx:'forge'}]},
 {id:'thornwood_wilds',kit:'palisade',name:'Thornwood Wilds',grid:[2,0],diff:[3,7],faction:'fabled',globe:'forest',
  regions:[['forest','Thornwood Canopy','hills'],['jungle','Elderroot Hollows','lowland'],['grass','Moonlit Glades','flats']],
  capital:{name:'Starweave Canopy',race:'elf',sub:'Elf Capital · Ancient Forest'},res:['Hardwood','Herbs','Berries','Rare mushrooms','Beast hides'],
  desc:'Ancient forest canopy — the elf capital Starweave Canopy.',lore:'Starweave Canopy is woven, not built: living boughs braided into halls by elven songcraft over a thousand winters. Worge packs hunt the hollows below, and the elves hunt them back.',
  dungeons:[{name:'Thornwood Labyrinth',theme:['thorn_worge','webweaver_spider','thorn_worge'],boss:'Thorn Worge Alpha',tier:4}],camps:['thorn_worge','webweaver_spider','bandit_poacher'],landmarks:['Elder Root','Moonwell'],
  events:[{name:'Worge Hunt',type:'island',sched:'daily',fx:'hunt'}]},
 {id:'stormbreak_reef',kit:'palisade',name:'Stormbreak Reef',grid:[0,1],diff:[3,6],faction:'crusade',globe:'storm',
  regions:[['storm','Razor Reefs','lowland'],['storm','Thunder Cliffs','mesas'],['tropical','Wreck Shoals','flats']],
  town:{name:'Stormwatch Docks',race:'barbarian',sub:'Crusade Outpost · Reef Harbor'},res:['Shells','Coral','Rare ore','Storm crystals'],
  desc:'Perpetual storms over razor coral reefs.',lore:'Barbarian reavers of the Crusade raised Stormwatch on the one rock the sea could not take. They claim Odin rides the lightning here; the wrecks on the shoals suggest he is not a careful pilot.',
  camps:['pirate_corsair','storm_elemental','reef_serpent'],landmarks:['Lightning Rod of Odin','Broken Keel'],events:[{name:'Thunderhead',type:'weather',sched:'always',fx:'storm'}]},
 {id:'convergence_nexus',kit:'ancient',name:'Convergence Nexus',grid:[1,1],diff:[5,9],faction:null,contested:true,globe:'badlands',
  regions:[['badlands','Shattered Plains','mesas'],['grass','Embassy Fields','flats'],['volcanic','Rift Scar','mountains']],
  embassies:true,res:['Scrap','Ore','Relics'],
  desc:'Central clash zone — faction embassies and world events.',lore:'Where the nine realms meet, the ground remembers the First Grudge. The Crusade, the Legion and the Fabled each keep an embassy here under truce, and break it every weekend. Racalvin\'s Vault lies sealed in the Rift Scar.',
  dungeons:[{name:"Racalvin's Vault",theme:['grudge_shade','colossus_sentinel','grudge_shade'],boss:'Herald of First Grudge',tier:8}],camps:['marauder_warband','grudge_shade','colossus_sentinel'],landmarks:['Truce Stone','Rift Scar'],
  events:[{name:'Faction Clash',type:'pvp',sched:'weekend',fx:'clash'}]},
 {id:'ashen_wastes',kit:'ancient',name:'Ashen Wastes',grid:[2,1],diff:[5,8],faction:'crusade',globe:'glass',
  regions:[['glass','Glass Desert','dunes'],['badlands','Cinder Mesas','mesas'],['desert','Bone Flats','flats']],
  capital:{name:'Ashen Throne',race:'human',sub:'Demon Capital · Glass Desert'},res:['Glass sand','Ore','Herbs','Bones'],
  desc:'Glass desert — the demon capital Ashen Throne.',lore:'A fallen star turned this desert to glass. The demons who rose from the crater bent the knee to Odin rather than to Madra, and the Ashen Throne has been the Crusade\'s strangest ally ever since.',
  dungeons:[{name:'Sunken Tomb',theme:['tomb_wraith','sand_serpent','tomb_wraith'],boss:'Ashen Aspect',tier:6}],camps:['sand_serpent','fire_elemental','raider_band'],landmarks:['Star Crater','Glass Colossus'],
  events:[{name:'Glass Storm',type:'weather',sched:'daily',fx:'sandstorm'}]},
 {id:'abyssal_trench',kit:'ancient',name:'Abyssal Trench',grid:[0,2],diff:[6,10],faction:'legion',globe:'abyss',
  regions:[['abyss','Abyssal Trench','lowland'],['abyss','Drowned Ruins','hills'],['swamp','Black Marsh','lowland']],
  capital:{name:'Drowned Sepulcher',race:'undead',sub:'Undead Capital · Flooded Ruins'},res:['Salvage','Fish','Ore','Abyss pearls'],
  desc:'Deep trench — the undead capital Drowned Sepulcher.',lore:'The undead of the Legion do not need to breathe, so they built their capital where no one else could follow. Madra\'s priests drown their initiates in the Black Tide and keep the ones that come back.',
  dungeons:[{name:'Drowned Cathedral',theme:['drowned_zombie','wraith_choir','drowned_zombie'],boss:'Drowned Priest',tier:7}],camps:['drowned_zombie','marsh_troll','wraith_choir'],landmarks:['Bell of the Deep','Wreck of the Sovereign'],
  events:[{name:'Black Tide',type:'hazard',sched:'tide_cycle',fx:'tide'}]},
 {id:'haven_shore',kit:'castle',name:'Haven Shore',grid:[1,2],diff:[1,3],faction:'crusade',safe:true,globe:'tropical',start:true,
  regions:[['tropical','Fruzer Isles','lowland'],['tropical','Coconut Coast','flats'],['jungle','Palm Hills','hills']],
  capital:{name:'Haven Port',race:'human',sub:'Human Capital · PVE Trade Village',town:'r2_town'},res:['Coconut','Fish','Driftwood','Pearls'],
  desc:'Safe tropical starter — Fruzer islands and the Haven Port vendors.',lore:'Every warlord\'s story starts on these beaches. Haven Port trades with all three factions and fights none of them; its harbor law is older than the Grudge. Pirates hide treasure in the crypt below the lighthouse.',
  dungeons:[{name:"Pirate's Crypt",theme:['pirate_cutthroat','pirate_cutthroat','reef_crab'],boss:'Pirate Captain',tier:2}],camps:['pirate_cutthroat','reef_crab'],landmarks:['Lighthouse Point','Turtle Rock'],
  events:[{name:'Trade Day',type:'island',sched:'daily',fx:'trade'}]},
 {id:'ember_depths',kit:'ancient',name:'Ember Depths',grid:[2,2],diff:[5,9],faction:'legion',globe:'volcanic',
  regions:[['volcanic','Ember Caldera','mountains'],['volcanic','Ash Fields','flats'],['badlands','Foundry Crags','mesas']],
  capital:{name:'The Pit Foundry',race:'orc',sub:'Orc Capital · Volcanic Creations'},res:['Obsidian','Sulfur','Fire crystals','Rare ore','Gems'],
  desc:'Volcanic Legion caldera — the orc capital Pit Foundry.',lore:'The orcs smelt war in the Pit Foundry, pouring siege engines straight from the caldera. Ghar\'Thok the Unbroken guards the Magma Core and has never lost a duel, mostly because nobody survives long enough to finish one.',
  dungeons:[{name:'Magma Core',theme:['fire_elemental','magma_golem','fire_elemental'],boss:"Ghar'Thok the Unbroken",tier:6}],camps:['magma_golem','fire_elemental','orc_marauder'],landmarks:['Caldera Rim','Slag Falls'],
  events:[{name:'Caldera Eruption',type:'hazard',sched:'hourly_chance',fx:'eruption'}]}];
const REALM=Object.fromEntries(REALMS.map(r=>[r.id,r]));
REALMS.forEach(r=>{PLANET_BIOMES[r.id]=r.regions;PLANET_BIOME[r.id]=r.globe;if(r.faction)PLANET_FACTION[r.id]=r.faction;else PLANET_FACTION[r.id]='crusade'});
Object.assign(STYLE,{haven_shore:{wall:'#e8dcc0',roof:'pyramid',roofc:'#a8643c'},frostbite_expanse:{wall:'#9aa4ae',roof:'pyramid',roofc:'#4a5a6a'},thornwood_wilds:{wall:'#8a7a5a',roof:'dome',roofc:'#4f7a3c'},
  ethereal_falls:{wall:'#c8c0e8',roof:'dome',roofc:'#8a6ad8'},stormbreak_reef:{wall:'#8a8478',roof:'pyramid',roofc:'#3a4a58'},convergence_nexus:{wall:'#a89a88',roof:'flat'},
  ashen_wastes:{wall:'#3a2e2a',roof:'dome',roofc:'#a8382a'},abyssal_trench:{wall:'#4a5a5c',roof:'pyramid',roofc:'#2a3a3c'},ember_depths:{wall:'#3a302c',roof:'flat'}});
// realm difficulty band remaps the usual distance-from-city tier
function realmTier(w,t){const R=w&&REALM[w.id];if(!R)return t;return Math.round(Math.min(R.diff[1],R.diff[0]+(t-1)*.7))}

const KITSPEC={castle:{p:'ck',wallH:9,wallA:1.55,gateA:1.95,gateHm:1.45,towerH:15},ancient:{p:'ak',wallH:8,wallA:1.9,gateA:1.46,gateHm:2.9,towerH:13},palisade:{p:'pal',wallH:5.5,wallA:.81,gateA:.81,gateHm:1,towerH:8}};
function buildRealmWorld(R){
  const rnd=mulberry(strHash(R.id)),P=[],pois=[],used=[];const w={id:R.id,name:R.name,biome:BIOMES[R.globe]||biomeOf(R.id),surf:SURF[R.regions[0][0]],seed:strHash(R.id),placements:P,demo:true,pois:[],realm:R};
  const spot=(minD,lim=6200)=>{for(let k=0;k<400;k++){const x=(rnd()*2-1)*lim,z=(rnd()*2-1)*lim;if(used.every(u=>Math.hypot(u[0]-x,u[1]-z)>minD+u[2])){used.push([x,z,minD*.5]);return[x,z]}}const x=(rnd()*2-1)*lim,z=(rnd()*2-1)*lim;used.push([x,z,0]);return[x,z]};
  const B=(t,x,z,w,d,h,yaw,extra)=>P.push({t:'object/building/grudge/'+t+'.iff',x,z,w,d,h,yaw,r:Math.max(w,d)/2,...extra});
  const S=(t,x,z,w,d,h,yaw)=>P.push({t:'object/static/structure/grudge/'+t+'.iff',x,z,w,d,h,yaw,r:Math.max(w,d)/2});
  const O=(t,x,z)=>P.push({t:'object/tangible/'+t+'.iff',x,z,k:'object'});
  const N=(t,x,z,extra)=>P.push({t,x,z,k:'npc',...extra});
  const deg=a=>a*180/Math.PI;
  // a wall ring tiled from kit pieces at their natural proportions; gates at the given angles, towers spaced between
  function ring(cx,cz,wr,K,h,gateAngles,big){const wl=h*K.wallA,n=Math.max(10,Math.ceil(TAU*wr/wl)),tEvery=Math.max(3,Math.round(n/10)),near=an=>gateAngles.some(g=>Math.abs(((an-g+Math.PI)%TAU+TAU)%TAU-Math.PI)<Math.PI/n);
    for(let k=0;k<n;k++){const an=k/n*TAU,x=cx+Math.cos(an)*wr,z=cz+Math.sin(an)*wr,yaw=-(deg(an)+90),seg=TAU*wr/n*1.04;
      if(near(an)){const gh=h*K.gateHm;S(K.p+'_gate',x,z,Math.max(seg,gh*K.gateA*.9),3,gh,yaw)}else S(K.p+(big&&K.p!=='pal'&&k%2?'_wall2':'_wall'),x,z,seg,3,h,yaw);
      if(k%tEvery===Math.floor(tEvery/2)&&!near(an))B(K.p+'_tower'+(k%2?'2':''),x,z,8,8,h*K.towerH/K.wallH,yaw)}}
  const offAve=an=>{const m=((an%(Math.PI/2))+Math.PI/2)%(Math.PI/2);return m<.13||m>Math.PI/2-.13};
  function city(name,cx,cz,rad,{capital,race,sub,faction,kit,town}){const K=KITSPEC[kit||R.kit||'castle'],fx={race,faction};
    pois.push({name,cat:'city',x:cx,z:cz,r:rad,sub,realmCity:!town,town:!!town,capital:!!capital});
    if(town){S(town,cx,cz,900,900,40,0);// a whole walled town from the R2 asset store
      for(let i=0;i<4;i++)O('crafting/station/public_station',cx+(i%2?1:-1)*60,cz+(i<2?1:-1)*40);
      P.push({t:'Starport: '+name+' Docks',k:'travel',x:cx+rad*1.12,z:cz+rad*.1});
      for(let i=0;i<22;i++){const an=rnd()*TAU,r=rad*(.1+rnd()*.55);N(['commoner','citizen','merchant','villager','farmer','artisan','entertainer','priest','city_guard','militia','captain'][i%11],cx+Math.cos(an)*r,cz+Math.sin(an)*r,fx)}
      if(capital)N('mayor',cx,cz-30,fx);return}
    // keep, with an inner curtain wall around it in capitals
    B(capital?'castle_keep':'guild_hall_great',cx,cz,capital?48:30,capital?48:30,capital?30:16,0);
    if(capital&&K.p!=='pal')ring(cx,cz,58,K,K.wallH*.7,[Math.PI/2*3],false);
    const civic=['cantina_tavern','market_hall','cloning_temple','guild_hall','bank_vault','theater_hall','university_library','garage_hangar','forge_smithy'];
    civic.slice(0,capital?9:5).forEach((t,i,a)=>{let an=i/a.length*TAU+.35;if(offAve(an))an+=.2;const r=rad*.33;B(t,cx+Math.cos(an)*r,cz+Math.sin(an)*r,24,20,12,-deg(an)+90)});
    // market row along the main avenue
    for(let i=0;i<(capital?6:3);i++){const r=rad*(.16+i*.035);for(const sd of [-1,1])B('market_stall',cx+r,cz+sd*9,8,6,4,90)}
    S('drum_stack',cx+rad*.2,cz+14,2,2,2,0);S('basket_pile',cx+rad*.24,cz-14,2,2,1.5,0);S('drum_stack',cx+rad*.28,cz+15,2,2,2,40);
    const nh=capital?28:14;for(let i=0;i<nh;i++){let an=i/nh*TAU+rnd()*.12;if(offAve(an))an+=.18;const r=rad*(.55+rnd()*.17),s2=10+rnd()*6;B('house_'+(i%3),cx+Math.cos(an)*r,cz+Math.sin(an)*r,s2,s2*.85,7,-deg(an)+90)}
    ring(cx,cz,rad*.93,K,K.wallH,[0,Math.PI/2,Math.PI,Math.PI*1.5],capital);
    S('fountain_plaza',cx+rad*.17,cz+rad*.05,8,8,4,0);
    for(const g of [0,Math.PI/2,Math.PI,Math.PI*1.5])for(let k=1;k<=4;k++){const r=rad*(.12+k*.18);for(const sd of [-1,1])S('streetlamp',cx+Math.cos(g)*r-Math.sin(g)*sd*5,cz+Math.sin(g)*r+Math.cos(g)*sd*5,1,1,6,0)}
    O('crafting/station/public_station',cx-rad*.12,cz+rad*.18);O('crafting/station/public_station',cx+rad*.1,cz-rad*.2);
    // outside the walls: farms, mills, a lumber yard, stables and a few cottages
    const outs=capital?['farm_field','farm_field','farm_field','farm_field','windmill','windmill','lumbermill','watermill','stable_barracks','well','house_out','house_out','house_out','house_out']:['farm_field','farm_field','windmill','lumbermill','well','house_out','house_out'];
    outs.forEach((t,i)=>{let an=i/outs.length*TAU+.4+rnd()*.15;if(offAve(an))an+=.25;const r=rad*(1.18+rnd()*.3),x=cx+Math.cos(an)*r,z=cz+Math.sin(an)*r;
      if(t==='farm_field'){for(let k=0;k<3;k++)B('farm_field',x+(k-1)*13*Math.sin(an),z-(k-1)*13*Math.cos(an),12,22,1,-deg(an))}
      else if(t==='windmill')B('windmill',x,z,9,9,12,0);else if(t==='watermill')B('watermill',x,z,10,10,9,0);else if(t==='well')S('well_village',x,z,4,4,3,0);
      else if(t==='lumbermill'){B('lumbermill',x,z,18,14,9,-deg(an));S('pr_logs',x+10,z+6,6,4,2,rnd()*360);S('pr_wood1',x-9,z+8,4,3,2,rnd()*360)}
      else if(t==='stable_barracks')B('stable_barracks',x,z,22,14,7,-deg(an));else B('house_out',x,z,11,10,7,-deg(an)+90)});
    P.push({t:'Starport: '+name+(capital?' Docks':' Landing'),k:'travel',x:cx+rad*1.18,z:cz+rad*.1});
    for(let k=0;k<4;k++){const an=k/4*TAU,r=rad*.93+6;N('city_guard',cx+Math.cos(an)*r+3,cz+Math.sin(an)*r,fx);N('city_guard',cx+Math.cos(an)*r-3,cz+Math.sin(an)*r+2,fx)}
    for(let i=0;i<(capital?16:8);i++){const an=rnd()*TAU,r=rad*(.15+rnd()*.5);N(['commoner','citizen','merchant','villager','farmer','artisan','laborer_worker'][i%7],cx+Math.cos(an)*r,cz+Math.sin(an)*r,fx)}
    N('entertainer',cx+rad*.3,cz+rad*.05,fx);N('musician',cx+rad*.31,cz+rad*.09,fx);N('priest',cx-rad*.2,cz+rad*.24,fx);N('captain',cx+12,cz-30,fx);if(capital)N('mayor',cx,cz-70,fx);N('militia',cx-rad*.4,cz,fx);N('militia',cx+rad*.4,cz,fx);
    for(let i=0;i<(capital?4:2);i++){const an=(i+.5)/4*TAU+.4;N('farmer',cx+Math.cos(an)*rad*1.3,cz+Math.sin(an)*rad*1.3,fx)}
  }
  // capital and towns
  const c0=spot(2600,3000);
  if(R.capital)city(R.capital.name,c0[0],c0[1],R.capital.town?560:330,{capital:true,race:R.capital.race,sub:R.capital.sub,faction:R.faction,kit:R.kit,town:R.capital.town});
  if(R.town)city(R.town.name,c0[0],c0[1],230,{race:R.town.race,sub:R.town.sub,faction:R.faction});
  if(R.capital&&!R.safe){const t=spot(2400);city(R.capital.name.replace(/^The /,'')+' Outpost',t[0],t[1],170,{race:R.capital.race,sub:'Frontier outpost',faction:R.faction,kit:'palisade'})}
  if(R.safe){const t=spot(2200);city('Fruzer Village',t[0],t[1],180,{race:'human',sub:'Fishing village',faction:R.faction,kit:'palisade'})}
  if(R.embassies){[['crusade','Crusade Embassy','human'],['legion','Legion Embassy','orc'],['fabled','Fabled Embassy','elf']].forEach(([fid,name,race],i)=>{const an=i/3*TAU+.4,x=Math.cos(an)*2600,z=Math.sin(an)*2600;used.push([x,z,900]);
      pois.push({name,cat:'military',x,z,r:150,faction:fid,sub:'Embassy under truce'});B('embassy_fortress',x,z,36,36,22,-deg(an));for(let k=0;k<4;k++){const a2=k/4*TAU+.785;B('ak_tower'+(k%2?'2':''),x+Math.cos(a2)*62,z+Math.sin(a2)*62,10,10,14,0)}S('ak_gate',x+Math.cos(an+Math.PI)*70,z+Math.sin(an+Math.PI)*70,24,4,16,-deg(an+Math.PI)-90);B('barracks',x+50,z,22,16,9,0);B('barracks',x-50,z,22,16,9,0);
      for(let k=0;k<8;k++){const a=k/8*TAU;N(k%3?'embassy_guard':'officer',x+Math.cos(a)*70,z+Math.sin(a)*70,{race,faction:fid})}
      P.push({t:'Shuttleport: '+name,k:'travel',x:x+120,z:z+40})})}
  // dungeons with their named bosses
  (R.dungeons||[]).forEach(d=>{const [x,z]=spot(1800,6600);pois.push({name:d.name,cat:'ruin',x,z,r:150,dungeon:true,boss:d.boss,minTier:d.tier});
    for(let k=0;k<12;k++){const an=k/12*TAU;if(k%4===1)S('ak_ruin',x+Math.cos(an)*95,z+Math.sin(an)*95,16,16,8,-deg(an));else if(k%4===3)S('ak_bastion',x+Math.cos(an)*95,z+Math.sin(an)*95,14,14,12,-deg(an));else S(k%3?'pillar_ruined':'column_ancient',x+Math.cos(an)*95,z+Math.sin(an)*95,2,2,6,0)}
    S('ak_gate2',x+120,z,26,4,18,-90);S('obelisk',x,z,3,3,12,0);
    for(let k=0;k<10;k++){const an=k/10*TAU+.3,r=40+rnd()*60;N(d.theme[k%d.theme.length],x+Math.cos(an)*r,z+Math.sin(an)*r)}
    N(d.theme[0]+'_lord',x+8,z+8,{rboss:{name:d.boss,tier:d.tier}})});
  // hostile camps
  const nc=R.safe?4:7;for(let i=0;i<nc;i++){const [x,z]=spot(1100);const th=R.camps[i%R.camps.length];
    pois.push({name:titleCase(th.replace(/_/g,' '))+' camp',cat:'camp',x,z,r:60});S('pal_ring',x,z,46,46,6,rnd()*360);S('tent_camp',x+10,z,10,8,4,rnd()*360);S('tent_camp',x-9,z+7,10,8,4,rnd()*360);S('campfire',x,z,2,2,1,0);S('pr_wood'+(1+i%2),x+6,z-8,4,3,2,rnd()*360);S('pal_stand',x-12,z-12,6,6,6,0);O('container/crate',x+4,z-10);
    const n=R.safe?3:5;for(let k=0;k<n;k++){const an=k/n*TAU;N(th,x+Math.cos(an)*18,z+Math.sin(an)*18)}}
  // landmarks
  const lmk=R.globe==='ethereal'||R.globe==='tropical'||R.globe==='forest'?'pd_falls':/volcanic|glass|badlands/.test(R.globe)?'rk_cliff2':null;
  (R.landmarks||[]).forEach((name,li)=>{const [x,z]=spot(1000);pois.push({name,cat:'landmark',x,z,r:50,shrine:true});if(lmk&&li===0)S(lmk,x,z+20,lmk==='pd_falls'?70:60,60,30,rnd()*360);S('obelisk',x,z,4,4,16,0);
    for(let k=0;k<6;k++){const an=k/6*TAU;S('pillar_standing',x+Math.cos(an)*24,z+Math.sin(an)*24,2,2,5,0)}});
  {const ROCKY=/volcanic|glass|badlands|ice|storm|desert|abyss/,kinds=['rk_cliff1','rk_cliff3','rk_spire1','rk_spire2','rk_rock1','rk_rock2'],ores=['rk_ore_iron','rk_ore_copper','rk_ore_tin','rk_ore_gold','rk_ore_red'];
    for(let i=0,n=0;i<900&&n<160;i++){const x=(rnd()*2-1)*7600,z=(rnd()*2-1)*7600,b=biomeAt(w,x,z);if(!ROCKY.test(b.key)||used.some(u=>Math.hypot(u[0]-x,u[1]-z)<u[2]+200))continue;n++;const s=8+rnd()*22;S(kinds[n%kinds.length],x,z,s,s,s,rnd()*360);if(b.key==='volcanic'&&n%5===0)S('rk_lava',x+s,z,s*1.5,s,2,rnd()*360)}
    for(let i=0,n=0;i<600&&n<28;i++){const x=(rnd()*2-1)*7400,z=(rnd()*2-1)*7400;if(used.some(u=>Math.hypot(u[0]-x,u[1]-z)<u[2]+150))continue;n++;S(ores[n%ores.length],x,z,4.5,4.5,3,rnd()*360);P[P.length-1].ore=ores[n%ores.length].slice(7)}}
  assignPois(w,pois);heightSamples(w);addTrainers(w);return w;
}

// realm events driven by the game clock
function realmEvent(w){const R=w&&REALM[w.id];if(!R||!R.events.length)return null;const h=gameHour(),hr=Math.floor(Date.now()/1000/(DAY_SECONDS/24)),day=new Date().getDay();
  for(const e of R.events){let on=false;
    if(e.sched==='always')on=true;else if(e.sched==='daily')on=h>=12&&h<16;else if(e.sched==='weekend')on=day===0||day===6;else if(e.sched==='tide_cycle')on=(h>=0&&h<3)||(h>=12&&h<15);
    else if(e.sched==='hourly_chance')on=(strHash(R.id+hr)%100)<35;if(on)return e}return null}
let lastEventKey='';
function tickRealmEvents(){if(!groundWorld)return;const e=realmEvent(groundWorld),k=e?groundWorld.id+e.name:'';if(k===lastEventKey)return;lastEventKey=k;
  if(e){mmLog(`Event · ${e.name} has begun in ${groundWorld.name}.`,'sys');if(typeof zoneBanner==='function')zoneBanner(e.name,'Realm event · '+groundWorld.name,'event')}}

/* ================= Unique biomes: every region of every planet has its own palette, ground texture, trees, ground cover, weather and wildlife =================
   Region entry: [base biome, name, landform, {s: surface colour overrides, d: ground texture (R2 textures/pbr/ground/Ground_N, 0 = procedural),
   t: tree species, ts: tree scale, f: ground-cover recipe, tint: ground-cover tint, fx: particles [day, night], m: wildlife table, sky: sky colour}] */
const FL={flowers:{wildflower:.7,'meadow-fescue':.5,'clover-mat':.4},steppe:{'dry-steppe':.6,tussock:.35,'meadow-fescue':.1},marsh:{'sedge-reed':.8,'forest-moss':.5,'broadleaf-weed':.25},
  floor:{'woodland-fern':.6,'forest-moss':.6,bracken:.35,'wood-rush':.3},jungle:{'woodland-fern':.7,bracken:.5,'broadleaf-weed':.45,'forest-moss':.3},sparse:{'dry-steppe':.15},frost:{tussock:.12,'dry-steppe':.08}};
const UNIQUE_BIOMES={
 tatooine:[['desert','Dune Sea','dunes',{s:{sand:'#e9c891',soil:'#d4a66e',rock:'#a47a50'},d:0,t:['date-palm'],fx:['dust','none'],m:[['reptiles',5],['beasts',1],['dragons',.7]],sky:'#c9ad84'}],
   ['badlands','Jundland Wastes','mesas',{s:{rock:'#8e5c3c',scree:'#ab744c',soil:'#bb8656',sand:'#d6aa76'},d:1,t:['joshua-tree'],m:[['orcs',5],['reptiles',2]]}],
   ['desert','Salt Flats','flats',{s:{sand:'#f0e8d8',soil:'#e2d6be',rock:'#bba98f',grass:'#cbbf9f',meadow:'#d8cdb0'},d:10,f:FL.sparse,fx:['dust','none'],m:[['reptiles',3],['beasts',2]],sky:'#d8c8ac'}],
   ['desert','Espa Hollow Oasis','lowland',{s:{water:'#3a8a9a',wet:.72,grass:'#7a9a48',meadow:'#a4ae60',sand:'#e0c48c'},t:['date-palm','coconut-palm'],f:FL.steppe}]],
 naboo:[['temperate','Lake Country','hills',{s:{grass:'#4e8b3b',meadow:'#8cba5c',water:'#3a7cab',wet:.74},t:['european-beech','silver-birch','field-oak'],f:FL.flowers,fx:['pollen','firefly'],sky:'#88b4dc'}],
   ['grass','Veylara Plains','flats',{s:{grass:'#7aa24b',meadow:'#b6ca72'},t:['field-oak','hazel-thicket'],f:{...GRASSLAND,wildflower:.45},fx:['pollen','firefly']}],
   ['forest','Highland Forest','mountains',{s:{grass:'#2e5b35',rock:'#5b5f63'},d:7,t:['norway-spruce','cedar-of-lebanon'],f:FL.floor}],
   ['swamp','Gorran Swamps','lowland',{s:{grass:'#47643b',water:'#4a7c6c'},d:3,t:['mangrove','tree-fern'],f:FL.marsh,fx:['spores','firefly'],m:[['reptiles',4],['beasts',2]]}]],
 corellia:[['temperate','Coastal Hills','hills',{s:{grass:'#5b8b41',sand:'#d8cca2'},d:5,t:['field-oak','european-beech']}],
   ['grass','Farmlands','flats',{s:{grass:'#8b9b49',meadow:'#c1b96b',soil:'#8b6b45'},d:2,t:['elder-bush','hazel-thicket'],f:{...GRASSLAND,'dry-steppe':.3}}],
   ['forest','Coraxi Forest','hills',{s:{grass:'#3d6b35'},d:7,t:['european-beech','silver-birch','norway-spruce'],f:FL.floor}],
   ['badlands','Rocky Highlands','mountains',{s:{rock:'#6b6561',scree:'#8b857b',soil:'#7b6b5a'},d:6,t:['windswept-pine'],f:FL.steppe}]],
 talus:[['grass','Talvern Grasslands','flats',{s:{grass:'#8b8b3b',meadow:'#b1a959'},d:2,t:['umbrella-acacia','elder-bush'],f:FL.steppe}],
   ['temperate','Talvern Hills','hills',{s:{grass:'#6b7b3b'},d:5,t:['field-oak','windswept-pine']}],
   ['badlands','Scarred Highlands','mesas',{s:{rock:'#7b5141',scree:'#9b6b53',soil:'#8a5a44'},d:8,t:['quiver-tree'],fx:['ash','none'],m:[['golems',3],['orcs',2]]}]],
 rori:[['swamp','Rhosmire Swamplands','lowland',{s:{grass:'#4b5b2f',water:'#536b51'},d:3,t:['mangrove','tree-fern'],f:FL.marsh,fx:['spores','firefly'],m:[['reptiles',4],['spiders',2]]}],
   ['jungle','Rainforest','hills',{s:{grass:'#2f6b2d'},d:7,t:['kapok-ceiba','banyan','tree-fern'],f:FL.jungle,fx:['spores','firefly']}],
   ['grass','Meadows','flats',{s:{grass:'#6b8b3b',meadow:'#9bab5b'},t:['elder-bush'],f:FL.flowers}]],
 dantooine:[['grass','Dawnreach Steppe','flats',{s:{grass:'#8b914b',meadow:'#b9b171'},d:2,t:['umbrella-acacia'],f:FL.steppe,sky:'#b4bcc4'}],
   ['temperate','Rolling Hills','hills',{s:{grass:'#6f8941'},d:5,t:['field-oak','hazel-thicket']}],
   ['badlands','Mesa Country','mesas',{s:{rock:'#8b6b4d',scree:'#a8865e'},d:4,t:['joshua-tree','umbrella-acacia'],f:FL.steppe}],
   ['grass','Warden Enclave Valley','lowland',{s:{grass:'#5f8a4a',meadow:'#9ab874',water:'#4a7f9a',wet:.78},t:['silver-birch','field-oak'],f:FL.flowers,fx:['pollen','firefly']}]],
 lok:[['badlands','Canyonlands','mesas',{s:{rock:'#7b4b35',scree:'#9b6549',sand:'#c18b5f'},d:4,t:['quiver-tree','joshua-tree'],f:FL.sparse}],
   ['volcanic','Lava Fields','mountains',{s:{rock:'#2b2521',lava:'#e2621b'},d:5,fx:['ember','ember'],m:[['elementals',4],['golems',2]]}],
   ['desert','Dust Plains','dunes',{s:{sand:'#c9a779',soil:'#b18b61'},d:10,fx:['dust','none']}]],
 yavin4:[['jungle','Elder Jungle','hills',{s:{grass:'#2b6b31',meadow:'#4b8b39'},d:7,t:['kapok-ceiba','banyan','tree-fern'],ts:1.3,f:FL.jungle,fx:['spores','firefly'],sky:'#8aa890'}],
   ['swamp','River Lowlands','lowland',{s:{water:'#3b6b5f',grass:'#3b6b3b'},d:3,t:['mangrove','tree-fern'],f:FL.marsh,fx:['spores','firefly']}],
   ['forest','Temple Highlands','mountains',{s:{grass:'#2b5131',rock:'#6a6a58'},d:6,t:['kapok-ceiba','norway-spruce'],f:FL.floor}]],
 endor:[['forest','Great Forest','hills',{s:{grass:'#2b4b27'},d:7,t:['norway-spruce','cedar-of-lebanon','european-beech'],ts:1.9,f:FL.floor,fx:['spores','firefly'],sky:'#7c9a8c'}],
   ['grass','Forest Meadows','flats',{s:{grass:'#5b7b3b',meadow:'#8ba159'},t:['silver-birch','elder-bush'],f:FL.flowers,fx:['pollen','firefly']}],
   ['temperate','Lake Highlands','mountains',{s:{grass:'#3b5b3b',water:'#3b6b7b',rock:'#616b69'},d:6,t:['norway-spruce'],f:FL.floor}]],
 dathomir:[['red','Red Forest','hills',{s:{grass:'#6b3b2b',meadow:'#8b4b31',soil:'#5b2b21'},d:3,t:['dragon-blood','windswept-pine'],tint:[1.35,.7,.6],fx:['ash','spores'],sky:'#a07068'}],
   ['badlands','Singing Mountains','mountains',{s:{rock:'#6b3b31',scree:'#8b5141'},d:1,t:['quiver-tree'],f:FL.steppe,tint:[1.2,.8,.7]}],
   ['swamp','Tar Pits','lowland',{s:{water:'#1b1511',grass:'#3b3121',meadow:'#4a3a28'},d:5,t:['mangrove'],f:FL.marsh,tint:[.7,.7,.6],fx:['spores','spores']}]],
 mustafar:[['volcanic','Lava Plains','flats',{d:5,fx:['ember','ember'],sky:'#5a3428'}],['volcanic','Ash Mountains','mountains',{s:{rock:'#2f2b29',scree:'#4b4541',sand:'#6b6561'},d:8,fx:['ash','ash']}],
   ['volcanic','Obsidian Shelf','flats',{s:{sand:'#151519',rock:'#232329',soil:'#1d1d22'},d:4,fx:['ember','ember']}]],
 kashyyyk:[['forest','Wroshyr Forest','hills',{s:{grass:'#2b5b29'},d:7,t:['banyan','kapok-ceiba'],ts:2.3,f:FL.floor,fx:['spores','firefly'],sky:'#7a9a7c'}],
   ['jungle','Shadowlands','lowland',{s:{grass:'#1f3b21',meadow:'#2e4a2c'},d:3,t:['banyan','tree-fern'],ts:1.6,f:FL.jungle,tint:[.7,.85,.75],fx:['spores','spores'],m:[['spiders',4],['beasts',2],['trolls',1]]}],
   ['tropical','Kachirho Coast','flats',{s:{sand:'#d9c99b'},t:['coconut-palm','tree-fern'],f:FL.jungle}]],
 hoth:[['ice','Ice Plains','flats',{d:4,f:FL.frost,fx:['snow','snow'],m:[['beasts',3],['trolls',2]],sky:'#cfdce8'}],['ice','Glacier Peaks','mountains',{d:1,fx:['snow','snow'],m:[['trolls',3],['golems',1]]}],
   ['ice','Frost Caves','hills',{s:{rock:'#7a8a98',snow:'#e8f2fa'},d:5,f:FL.frost,fx:['snow','snow']}]],
 ethereal_falls:[['ethereal','Ethereal Falls','mountains',{d:6,t:['rainbow-eucalyptus','silver-birch'],fx:['motes','firefly'],sky:'#b0a0e0'}],['ethereal','Prism Meadows','flats',{t:['rainbow-eucalyptus'],f:{...FL.flowers,wildflower:1},tint:[.85,.65,1.2],fx:['motes','firefly']}],
   ['forest','Whisperwood','hills',{s:{grass:'#2b4b5b',meadow:'#4b6b7b'},d:7,t:['silver-birch','tree-fern'],tint:[.8,.9,1.25],f:FL.floor,fx:['motes','firefly']}]],
 frostbite_expanse:[['ice','Forge Islands','hills',{d:5,t:['common-juniper'],f:FL.frost,fx:['snow','snow']}],['ice','Glacier Shelf','flats',{d:4,fx:['snow','snow']}],
   ['ice','Runecrag Peaks','mountains',{s:{rock:'#5a6470'},d:1,t:['bristlecone-pine','common-juniper'],fx:['snow','snow']}]],
 thornwood_wilds:[['forest','Thornwood Canopy','hills',{t:['field-oak','european-beech','silver-birch'],ts:1.4,d:7,f:FL.floor}],['jungle','Elderroot Hollows','lowland',{t:['banyan','tree-fern'],ts:1.3,d:3,f:FL.jungle,fx:['spores','firefly']}],
   ['grass','Moonlit Glades','flats',{s:{grass:'#4f7a50',meadow:'#7aa088'},t:['silver-birch','elder-bush'],f:FL.flowers,fx:['pollen','firefly']}]],
 stormbreak_reef:[['storm','Razor Reefs','lowland',{d:6,t:['windswept-pine'],f:FL.steppe}],['storm','Thunder Cliffs','mesas',{d:1,t:['common-juniper'],f:FL.steppe}],['tropical','Wreck Shoals','flats',{s:{sand:'#d6c4a0'},t:['coconut-palm'],f:FL.marsh}]],
 convergence_nexus:[['badlands','Shattered Plains','mesas',{d:8,t:['umbrella-acacia'],f:FL.steppe}],['grass','Embassy Fields','flats',{t:['field-oak','silver-birch'],f:GRASSLAND}],['volcanic','Rift Scar','mountains',{s:{lava:'#9a5aff'},d:5,fx:['motes','motes'],sky:'#7a6a90'}]],
 ashen_wastes:[['glass','Glass Desert','dunes',{d:10,t:['quiver-tree'],fx:['dust','none']}],['badlands','Cinder Mesas','mesas',{s:{rock:'#4a3430',scree:'#6a4a40'},d:9,t:['joshua-tree'],fx:['ash','none']}],
   ['desert','Bone Flats','flats',{s:{sand:'#e6dcc6',soil:'#d0c2a4'},d:9,t:['joshua-tree'],f:FL.sparse}]],
 abyssal_trench:[['abyss','Abyssal Trench','lowland',{d:3,t:['mangrove'],f:FL.marsh,fx:['spores','spores']}],['abyss','Drowned Ruins','hills',{d:6,t:['tree-fern'],f:FL.floor}],['swamp','Black Marsh','lowland',{s:{water:'#1a2a24',grass:'#26382a'},d:3,t:['mangrove'],f:FL.marsh,tint:[.6,.8,.7]}]],
 haven_shore:[['tropical','Fruzer Isles','lowland',{t:['coconut-palm','tree-fern'],f:FL.jungle}],['tropical','Coconut Coast','flats',{t:['coconut-palm','date-palm'],f:{'meadow-fescue':.5,'broadleaf-weed':.4}}],
   ['jungle','Palm Hills','hills',{t:['tree-fern','coconut-palm','kapok-ceiba'],f:FL.jungle,fx:['pollen','firefly']}]],
 ember_depths:[['volcanic','Ember Caldera','mountains',{d:5,fx:['ember','ember']}],['volcanic','Ash Fields','flats',{s:{sand:'#5a5450'},d:8,fx:['ash','ash']}],['badlands','Foundry Crags','mesas',{s:{rock:'#3a2a24'},d:4,t:['quiver-tree'],fx:['ember','none']}]]};
Object.assign(PLANET_BIOMES,UNIQUE_BIOMES);PLANET_BIOME.hoth='ice';PLANET_FACTION.hoth='crusade';
// planetBiomes now carries each region's own overrides
planetBiomes=function(w){if(w._biomes)return w._biomes;const list=(PLANET_BIOMES[w.id]||[[biomeKey(w.id),'Wilds','hills']]).map(([k,name,land,o],i)=>{o=o||{};
  const surf={...(SURF[k]||SURF.temperate),...(o.s||{})};return{key:k,name,land,surf,i,uid:w.id+':'+i,d:o.d||0,trees:o.t||null,ts:o.ts||1,flora:o.f||null,tint:o.tint||null,fx:o.fx||null,mobs:o.m||null,sky:o.sky||null}});
  list.forEach(b=>{b.L={};for(const k of ['rock','scree','soil','grass','meadow','sand','snow','lava','water'])if(b.surf[k])b.L[k]=col(b.surf[k])});return w._biomes=list};
// ground textures from the R2 store (Ground_1..10), shrunk to 512 px; each region blends its own over the terrain
const GROUND_TEX={};function groundTex(i){if(!i)return groundDetail();if(GROUND_TEX[i])return GROUND_TEX[i];const t=new THREE.TextureLoader().load('kits/ground/g'+i+'.jpg');t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return GROUND_TEX[i]=t}
const GROUND_MEAN={1:.16,2:.115,3:.155,4:.31,5:.2,6:.255,7:.152,8:.27,9:.29,10:.41};
function groundMaterial(w,geo,pa){const B=planetBiomes(w).slice(0,4),n=pa.count,bw=new Float32Array(n*4);
  for(let i=0;i<n;i++){const W=biomeWeights(w,pa.getX(i),-pa.getZ(i));for(let k=0;k<B.length;k++)bw[i*4+k]=W[k]}geo.setAttribute('aBw',new THREE.BufferAttribute(bw,4));
  const m=new THREE.MeshLambertMaterial({vertexColors:true,map:groundDetail(),color:new THREE.Color(1.16,1.16,1.16)}),U={};
  for(let k=0;k<4;k++){const b=B[k]||B[0];U['gd'+k]={value:groundTex(b.d)};U['gm'+k]={value:b.d?1/(GROUND_MEAN[b.d]||.4):0}}
  m.onBeforeCompile=sh=>{Object.assign(sh.uniforms,U);
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute vec4 aBw;varying vec4 vBw;varying vec2 vGX;varying float vGD;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvBw=aBw;vGX=position.xz;').replace('#include <project_vertex>','#include <project_vertex>\nvGD=-mvPosition.z;');
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform sampler2D gd0,gd1,gd2,gd3;uniform float gm0,gm1,gm2,gm3;varying vec4 vBw;varying vec2 vGX;varying float vGD;\nfloat gl(sampler2D t,float m,vec2 uv){return m>0.?dot(texture2D(t,uv).rgb,vec3(.299,.587,.114))*m:1.;}')
      .replace('#include <map_fragment>',`#include <map_fragment>
      {vec2 uv=vGX/7.5;float f=1.-smoothstep(90.,420.,vGD);
       float d=vBw.x*gl(gd0,gm0,uv)+vBw.y*gl(gd1,gm1,uv*1.07)+vBw.z*gl(gd2,gm2,uv*.93)+vBw.w*gl(gd3,gm3,uv*1.13);float s=vBw.x+vBw.y+vBw.z+vBw.w;d=s>0.?d/s:1.;
       diffuseColor.rgb*=mix(1.,clamp(.45+.55*d,.55,1.4),f*.75);}`)};
  return m}
// hoth: the ice world SWG players remember, generated like the realms
const HOTH={id:'hoth',name:'Rimehold',kit:'castle',globe:'ice',diff:[4,8],faction:'crusade',regions:UNIQUE_BIOMES.hoth,capital:{name:'Frosthold Base',race:'human',sub:'Insurgent Outpost · Ice Fields'},res:['Ice crystals','Snowstrider hide','Frozen ore'],
  desc:'Frozen world on the rim; the rebels dug Frosthold Base into its glaciers.',lore:'Nothing lives easily on Rimehold. Frost apes hunt the ice caves, snowstriders run the plains, and the shield generator at Frosthold Base hums day and night against the storms.',
  dungeons:[{name:'Frost Ape Caves',theme:['wampa_troll','ice_golem','wampa_troll'],boss:'Frost Ape Matriarch',tier:6}],camps:['wampa_troll','ice_golem','raider_band'],landmarks:['Ion Cannon Crater','Echo Ridge'],
  events:[{name:'Howling Blizzard',type:'weather',sched:'hourly_chance',fx:'blizzard'}]};
REALM.hoth=HOTH;

/* ---------------- boot ---------------- */
const CORE3=JSON.parse(document.getElementById('core3').textContent);
const BO=JSON.parse(document.getElementById('buildouts').textContent);
function buildoutPlacements(id){return(BO.worlds[id]||[]).map(([ti,x,y,z,yaw])=>{let [w,d,h]=BO.sizes[ti];const tn=BO.templates[ti];
  if(/platform|deck|floor|walkway|bridge/.test(tn)&&!/building\//.test(tn)){w=Math.max(w,10);d=Math.max(d,10);h=1.2}else if(/rail/.test(tn)){d=.4;h=1.2}return{t:BO.templates[ti],x,y,z,yaw,w,d,h,r:Math.max(w,d)/2,k:'buildout'}})}
const ORDER=['tatooine','naboo','corellia','talus','rori','dantooine','lok','yavin4','endor','dathomir','kashyyyk','mustafar'];
WORLDS=ORDER.filter(id=>BO.worlds[id]||CORE3.worlds.some(w=>w.id===id)).map(id=>{const c3=CORE3.worlds.find(w=>w.id===id);
  const pl=buildoutPlacements(id).concat(c3?c3.placements:[]);const w=finalizeWorld(id,pl,true,c3?c3.pois:null);addTrainers(w);return w});
// the nine realms are the 3x3 sector layout (LOD and server interest), not worlds on the galaxy map
WORLDS.push(buildRealmWorld(HOTH));
WORLDS.forEach(w=>{if(PLANET_NAMES[w.id])w.name=PLANET_NAMES[w.id]}); // display names; ids stay as data keys
buildGalaxy();spawnGalaxyWhales();applyQuality();resize();setLevel('galaxy');ctl.target.set(0,0,0);ctl.dist=620;ctl.phi=.95;ctl.theta=.4;applyOrbit();
requestAnimationFrame(frame);/* ================= Guns: sci-fi pistols and rifles from the Grudge ObjectStore, KayKit + UAL ranged animations =================
   A gun is a main-hand weapon item with a `gun` field. Equipping one hides the melee weapon, binds the gun to the rig's
   R_hand_container socket (barrel along the forearm, top of the gun up) and switches combat to ranged:
   aim idle in combat, shoot/fire clips, magazine + reload, rifle run and run-strafe, muzzle flash and tracer. */
const GUNS={
  pistol:{name:'Blaster Pistol',len:.32,hold:'pistol',range:26,cd:1.05,mult:.95,mag:12,cost:2400,tier:2},
  smg:{name:'Blaster Carbine',len:.62,hold:'rifle',range:24,cd:.62,mult:.58,mag:30,cost:3400,tier:3},
  rifle:{name:'Assault Blaster',len:.9,hold:'rifle',range:34,cd:1.35,mult:1.15,mag:20,cost:4600,tier:3},
  sniper:{name:'Long Rifle',len:1.15,hold:'rifle',range:50,cd:2.4,mult:1.75,mag:5,cost:6200,tier:4}};
const gunProto={},gunLoad={};
function loadGun(id){if(gunProto[id])return Promise.resolve(gunProto[id]);if(gunLoad[id])return gunLoad[id];
  return gunLoad[id]=loadScript('kits/guns.js').then(()=>new Promise((res,rej)=>{const b64=(window.GRUDGE_GUN||{})[id];if(!b64)return rej(new Error('no gun '+id));
    const bin=atob(b64),buf=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)buf[i]=bin.charCodeAt(i);
    new THREE.GLTFLoader().parse(buf.buffer,'',g=>{const sc=g.scene;sc.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(sc),L=box.max.x-box.min.x,H=box.max.y-box.min.y;
      const s=GUNS[id].len/L,grip=new THREE.Vector3(box.min.x+L*(id==='pistol'?.2:.38),box.min.y+H*.42,(box.min.z+box.max.z)/2);
      sc.traverse(o=>{if(o.isMesh){const m=o.material;o.material=new THREE.MeshLambertMaterial({color:m.color?m.color.clone():0x888888,emissive:new THREE.Color(.08,.08,.1)});o.castShadow=false}});
      const proto=new THREE.Group();sc.position.copy(grip).multiplyScalar(-1);const inner=new THREE.Group();inner.scale.setScalar(s);inner.add(sc);proto.add(inner);
      const muzzle=new THREE.Object3D();muzzle.position.set((box.max.x-grip.x)*s,(box.max.y*.55+box.min.y*.45-grip.y)*s,0);muzzle.name='muzzle';proto.add(muzzle);
      gunProto[id]=proto;res(proto)},rej)}));}
// bind a gun to a toon: find the right-hand socket, line the barrel up with the forearm in the rest pose
function attachGun(inst,id){const hand=inst.getObjectByName('R_hand_container');if(!hand)return false;
  for(const c of [...hand.children])if(c.userData.isGun)hand.remove(c);
  const p=gunProto[id];if(!p)return false;const g=p.clone(true);g.userData.isGun=true;g.userData.gun=id;
  inst.updateMatrixWorld(true);const hb=hand.parent||hand,fa=hb.parent||hb,a=new THREE.Vector3(),b=new THREE.Vector3();fa.getWorldPosition(a);hb.getWorldPosition(b);
  const along=b.sub(a).normalize();if(!isFinite(along.x)||along.lengthSq()<.5)along.set(-1,0,0);
  const up=new THREE.Vector3(0,1,0).addScaledVector(along,-along.y).normalize(),side=new THREE.Vector3().crossVectors(along,up);
  const qw=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(along,up,side)),hq=new THREE.Quaternion();hand.getWorldQuaternion(hq);
  g.quaternion.copy(hq.invert().multiply(qw));const ws=new THREE.Vector3();hand.getWorldScale(ws);g.scale.setScalar(1/Math.max(1e-4,ws.x));g.position.set(0,0,0);
  hand.add(g);inst.userData.gun=id;inst.userData.gunHold=GUNS[id].hold;inst.userData.gunObj=g;return true}
function equipGunLook(inst,id){if(!inst)return;
  inst.traverse(o=>{if(!o.isMesh||o.userData.isGunPart)return;const s=toonSlot(o.name);if(s&&(s.slot.startsWith('weapon_')||s.slot==='shield'))o.visible=false});
  if(inst.userData.tome)inst.userData.tome.visible=false;
  const go=()=>{if(attachGun(inst,id))inst.traverse(o=>{if(o.isMesh&&o.parent&&isGunChild(o))o.userData.isGunPart=true})};
  if(gunProto[id])go();else loadGun(id).then(go).catch(e=>console.warn('gun',e))}
function isGunChild(o){while(o){if(o.userData&&o.userData.isGun)return true;o=o.parent}return false}
const gunOf=ch=>{if(!ch||!ch.gear)return null;const id=ch.gear['Main hand'],it=id&&ch.inv.items.find(i=>i.id===id);return it&&it.gun&&GUNS[it.gun]?it.gun:null};
const gunCd=()=>{const g=CH&&gunOf(CH);return g?GUNS[g].cd:1.6};

// models: every character built with a gun in warlord/opts shows it
{const _wm=warlordModel;warlordModel=function(o,opts){const m=_wm(o,opts);if(m&&o&&o.gun)equipGunLook(m,o.gun);return m}}
{const _sl=syncLook;syncLook=function(){_sl();if(CH){warlord.gun=gunOf(CH);saveWarlord()}}}
// stats: range, damage per shot
{const _cs=charStats;charStats=function(){const s=_cs(),g=CH&&gunOf(CH);if(g){s.range=GUNS[g].range;s.dmg=Math.round(s.dmg*GUNS[g].mult);s.gun=g}return s}}

// animation: aim when fighting, rifle run, run-strafe; shooting and reloading as one-shots
{const _lc=locoClip;locoClip=function(u,amt){if(!u.gun)return _lc(u,amt);const pistol=u.gunHold==='pistol';
  if(amt<=0)return u.combat?(pistol?'pistolAim':'rifleAim'):(pistol&&u.clips.pistolIdle?'pistolIdle':'idle');
  if(amt>1.5&&u.dir==='left'&&u.clips.runStrafeL)return'runStrafeL';if(amt>1.5&&u.dir==='right'&&u.clips.runStrafeR)return'runStrafeR';
  if(amt>1.5&&!pistol&&u.clips.rifleRun)return'rifleRun';return _lc(u,amt)}}
const gunAmmo={};
{const _os=toonOneShot;toonOneShot=function(inst,kind){if(!inst||!inst.userData.mixer||!inst.userData.gun||kind!=='attack')return _os(inst,kind);
  const u=inst.userData,G=GUNS[u.gun],pistol=u.gunHold==='pistol',key=inst===play.model?'me':inst.uuid;
  if(gunAmmo[key]==null)gunAmmo[key]=G.mag;
  if(gunAmmo[key]<=0){gunAmmo[key]=G.mag;toonPlay(inst,pistol?'pistolReload':'rifleReload',.12,{once:true,hold:1.3});if(inst===play.model){combat.cd=Math.max(combat.cd,1.3+G.cd);hunt.swing=Math.max(hunt.swing,1.3+G.cd);floatMsg('Reloading…')}return}
  gunAmmo[key]--;toonPlay(inst,u.gunHold==='pistol'?'pistolShoot':(u.gun==='smg'?'rifleFire':'rifleShoot'),.06,{once:true,hold:Math.min(.9,G.cd*.9)});gunFx(inst)}}

/* ---- muzzle flash and tracer ---- */
const gunFxList=[];
function gunTarget(){if(combat.p)return targetPos(combat.p);if(hunt.auto)return{x:hunt.auto.a.pos.x,z:hunt.auto.a.pos.z,h:ANIMAL_SPEC[hunt.auto.h.id].h*.6};return null}
function gunFx(inst){const g=inst.userData.gunObj;if(!g)return;const mz=g.getObjectByName('muzzle');if(!mz)return;
  setTimeout(()=>{if(!g.parent)return;inst.updateMatrixWorld(true);const from=new THREE.Vector3();mz.getWorldPosition(from);
    const fl=glowSprite(0xffc86a,1.1);fl.position.copy(from);G.ground.add(fl);gunFxList.push({o:fl,t:.07});
    const tp=inst===play.model?gunTarget():null;if(tp){const to=new THREE.Vector3(tp.x,groundH(groundWorld,tp.x,tp.z)+(tp.h||1.2),-tp.z);
      const geo=new THREE.BufferGeometry().setFromPoints([from,to]),ln=new THREE.Line(geo,new THREE.LineBasicMaterial({color:0xff6a4a,transparent:true,opacity:.95,blending:THREE.AdditiveBlending,depthWrite:false}));
      G.ground.add(ln);gunFxList.push({o:ln,t:.09})}},90)}
function tickGunFx(dt){for(let i=gunFxList.length-1;i>=0;i--){const f=gunFxList[i];f.t-=dt;if(f.o.material)f.o.material.opacity=Math.max(0,f.t*10);if(f.t<=0){if(f.o.parent)f.o.parent.remove(f.o);if(f.o.geometry)f.o.geometry.dispose();if(f.o.material&&f.o.material.dispose)f.o.material.dispose();gunFxList.splice(i,1)}}}
{const _gt=gameTick;gameTick=function(dt){_gt(dt);tickGunFx(dt);if(play.model)play.model.userData.combat=!!(combat.p||hunt.auto)}}

/* ---- buy at markets, craft at the engineering bench ---- */
for(const [id,G] of Object.entries(GUNS)){SHOP.push({id:'gun_'+id,name:G.name,cost:G.cost,make:()=>({kind:'weapon',slot:'Main hand',name:G.name,gun:id,tier:G.tier,q:420})});
  SCHEMATICS.push({id:'gun_'+id,name:G.name,out:'weapon',slot:'Main hand',gun:id,needs:[['Metal',id==='pistol'?18:id==='sniper'?40:30],['Chemical',id==='sniper'?14:8],['Mineral',10]],attrs:['quality','conductivity','malleability'],box:'crafting_artisan_engineering_02'})}

/* ================= Ability effects: one GPU particle pool driven by the Grudge effect-definition presets =================
   Emitter shapes, lifetimes, powers, sizes and gravity follow ObjectStore effect-definitions.json per category
   (auras, impacts, lightning, spells, fire, buffs...). Textures: the arpg-effects fire sheet (16x4) from R2 plus
   glow / ring / spark / rune sprites drawn here. Everything renders in a single additive Points draw call. */
const VFX_DEF={ // from effect-definitions.json categories (babylon units carried over)
  auras:{emit:'cylinder',r:.8,life:[.5,1.5],pow:[.2,.8],size:[.1,.6],g:[0,.5,0]},
  impacts:{emit:'sphere',r:.3,life:[.2,.8],pow:[2,5],size:[.1,.8],g:[0,-5,0]},
  lightning:{emit:'point',r:0,life:[.05,.2],pow:[5,10],size:[.05,.4],g:[0,0,0]},
  fire:{emit:'cone',r:.3,life:[.3,1],pow:[1,3],size:[.1,.6],g:[0,2,0]},
  ice:{emit:'sphere',r:.5,life:[1,3],pow:[.2,.8],size:[.1,.5],g:[0,-.3,0]},
  buffs:{emit:'point',r:0,life:[1.5,3],pow:[.5,1],size:[.3,.8],g:[0,.5,0]},
  projectiles:{emit:'point',r:0,life:[.1,.5],pow:[8,15],size:[.05,.2],g:[0,-1,0]}};
// sprite atlas: 4 hand-drawn cells in a 2x2 canvas (glow, spark, ring, rune) + the fire sheet as a second texture
const vfxTex=(()=>{const N=128,c=document.createElement('canvas');c.width=c.height=N*2;const x=c.getContext('2d');
  let g=x.createRadialGradient(N/2,N/2,0,N/2,N/2,N/2);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.25,'rgba(255,255,255,.6)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,N,N);
  x.save();x.translate(N*1.5,N/2);for(const [w,a] of [[N*.48,.35],[N*.3,.7],[N*.12,1]]){x.fillStyle=`rgba(255,255,255,${a})`;x.beginPath();x.ellipse(0,0,w,N*.05,0,0,TAU);x.fill();x.beginPath();x.ellipse(0,0,N*.05,w,0,0,TAU);x.fill()}x.restore();
  x.save();x.translate(N/2,N*1.5);x.strokeStyle='#fff';x.shadowColor='#fff';x.shadowBlur=10;x.lineWidth=7;x.beginPath();x.arc(0,0,N*.4,0,TAU);x.stroke();x.restore();
  x.save();x.translate(N*1.5,N*1.5);x.strokeStyle='#fff';x.shadowColor='#fff';x.shadowBlur=6;x.lineWidth=3;x.beginPath();x.arc(0,0,N*.45,0,TAU);x.stroke();x.beginPath();x.arc(0,0,N*.33,0,TAU);x.stroke();
  for(let i=0;i<6;i++){const a=i/6*TAU;x.beginPath();x.moveTo(Math.cos(a)*N*.33,Math.sin(a)*N*.33);x.lineTo(Math.cos(a+TAU/3)*N*.33,Math.sin(a+TAU/3)*N*.33);x.stroke()}
  x.font=`bold ${N*.09}px serif`;x.fillStyle='#fff';x.textAlign='center';x.textBaseline='middle';const R='ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃ';for(let i=0;i<12;i++){const a=i/12*TAU;x.fillText(R[i],Math.cos(a)*N*.39,Math.sin(a)*N*.39)}x.restore();
  const t=new THREE.CanvasTexture(c);t._keep=true;return t})();
const vfxFire=(()=>{const t=new THREE.TextureLoader().load('kits/fx/fire_16x4.png');t._keep=true;return t})();
const VFX_MAX=2400,vfxP={pos:new Float32Array(VFX_MAX*3),vel:new Float32Array(VFX_MAX*3),col:new Float32Array(VFX_MAX*3),size:new Float32Array(VFX_MAX),life:new Float32Array(VFX_MAX),max:new Float32Array(VFX_MAX),cell:new Float32Array(VFX_MAX),grav:new Float32Array(VFX_MAX*3),spin:new Float32Array(VFX_MAX),n:0,next:0};
const vfxGeo=new THREE.BufferGeometry();
vfxGeo.setAttribute('position',new THREE.BufferAttribute(vfxP.pos,3).setUsage(THREE.DynamicDrawUsage));vfxGeo.setAttribute('color',new THREE.BufferAttribute(vfxP.col,3).setUsage(THREE.DynamicDrawUsage));
const vfxA=new Float32Array(VFX_MAX*4);vfxGeo.setAttribute('aInfo',new THREE.BufferAttribute(vfxA,4).setUsage(THREE.DynamicDrawUsage));// size, alpha, cell, fireFrame
vfxGeo.setDrawRange(0,VFX_MAX);vfxGeo.boundingSphere=new THREE.Sphere(new V3(),1e7);
const vfxMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,vertexColors:true,
  uniforms:{map:{value:vfxTex},fire:{value:vfxFire},scale:{value:600}},
  vertexShader:`attribute vec4 aInfo;varying vec3 vC;varying vec4 vI;void main(){vC=color;vI=aInfo;vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=aInfo.y>0.?aInfo.x*600./max(.5,-mv.z):0.;}`,
  fragmentShader:`uniform sampler2D map;uniform sampler2D fire;varying vec3 vC;varying vec4 vI;void main(){vec2 uv=vec2(gl_PointCoord.x,1.-gl_PointCoord.y);vec4 t;
    if(vI.z>3.5){float f=floor(vI.w);vec2 cell=vec2(mod(f,16.),3.-floor(f/16.));t=texture2D(fire,(cell+uv)/vec2(16.,4.));}
    else{vec2 o=vec2(mod(vI.z,2.),1.-floor(vI.z/2.));t=texture2D(map,(o+uv)*.5);}
    gl_FragColor=vec4(vC*t.rgb*vI.y,t.a*vI.y);if(gl_FragColor.a<.01)discard;}`});
const vfxPts=new THREE.Points(vfxGeo,vfxMat);vfxPts.frustumCulled=false;vfxPts.renderOrder=6;
const CELL={glow:0,spark:1,ring:2,rune:3,fire:4};
const rnd=(a,b)=>a+Math.random()*(b-a);
// emit n particles of a category preset at world (x,y,z) in game coords (z north); opts override colour, cell, scale
function vfxEmit(cat,x,y,z,n,o={}){const D=VFX_DEF[cat]||VFX_DEF.auras,P=vfxP,c=new THREE.Color(o.color||'#ffffff'),sc=o.scale||1,dir=o.dir;
  for(let k=0;k<n;k++){const i=P.next;P.next=(P.next+1)%VFX_MAX;let ox=0,oy=0,oz=0,vx=0,vy=0,vz=0;const pw=rnd(...D.pow)*(o.pow||1);
    if(D.emit==='cylinder'){const a=Math.random()*TAU,r=(o.r||D.r)*Math.sqrt(Math.random());ox=Math.cos(a)*r;oz=Math.sin(a)*r;oy=rnd(0,.3);vy=pw}
    else if(D.emit==='sphere'){const u=new V3(rnd(-1,1),rnd(-1,1),rnd(-1,1)).normalize();ox=u.x*(o.r||D.r);oy=u.y*(o.r||D.r);oz=u.z*(o.r||D.r);vx=u.x*pw;vy=u.y*pw+(o.lift||0);vz=u.z*pw}
    else if(D.emit==='cone'){const a=Math.random()*TAU,s=rnd(0,.35);vx=Math.cos(a)*s*pw;vz=Math.sin(a)*s*pw;vy=pw;ox=vx*.1;oz=vz*.1}
    else{const u=dir?new V3(dir.x+rnd(-.3,.3),dir.y+rnd(-.3,.3),dir.z+rnd(-.3,.3)).normalize():new V3(rnd(-1,1),rnd(-1,1),rnd(-1,1)).normalize();vx=u.x*pw;vy=u.y*pw;vz=u.z*pw}
    P.pos[i*3]=x+ox;P.pos[i*3+1]=y+oy;P.pos[i*3+2]=-(z+oz);P.vel[i*3]=vx;P.vel[i*3+1]=vy;P.vel[i*3+2]=-vz;
    const g=o.g||D.g;P.grav[i*3]=g[0];P.grav[i*3+1]=g[1];P.grav[i*3+2]=-g[2];
    const cc=o.jitter?c.clone().offsetHSL(rnd(-.04,.04),0,rnd(-.08,.08)):c;P.col[i*3]=cc.r;P.col[i*3+1]=cc.g;P.col[i*3+2]=cc.b;
    P.size[i]=rnd(...D.size)*sc;P.max[i]=P.life[i]=rnd(...D.life)*(o.life||1);P.cell[i]=o.cell!=null?o.cell:cat==='fire'?CELL.fire:cat==='lightning'||cat==='impacts'?CELL.spark:CELL.glow;P.spin[i]=Math.random()*64}}
// flat ground decals (rings, rune circles): a small pool of quads lying on the terrain, spinning, growing and fading
const vfxDecals=[],decalTex={};
function decalMat(cell){if(!decalTex[cell]){const t=vfxTex.clone();t.needsUpdate=true;t._keep=true;t.repeat.set(.5,.5);t.offset.set((cell%2)*.5,cell<2?.5:0);decalTex[cell]=t}
  return new THREE.MeshBasicMaterial({map:decalTex[cell],transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,polygonOffset:true,polygonOffsetFactor:-4,side:THREE.DoubleSide})}
const decalGeo=new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2);
function vfxRing(x,z,o={}){if(!groundWorld)return;let d=vfxDecals.find(q=>q.t<=0);if(!d){if(vfxDecals.length>=24)d=vfxDecals[0];else{d={m:new THREE.Mesh(decalGeo,decalMat(CELL.ring)),t:0,cell:CELL.ring};vfxDecals.push(d)}}
  const cell=o.cell!=null?o.cell:CELL.ring;if(d.cell!==cell){d.m.material.dispose();d.m.material=decalMat(cell);d.cell=cell}
  d.m.material.color.set(o.color||'#ffffff');d.m.position.set(x,groundH(groundWorld,x,z)+.12,-z);d.size=o.size||3;d.t=d.max=o.life||1.2;d.spin=(Math.random()<.5?-1:1)*(cell===CELL.rune?.9:.3);
  if(d.m.parent!==G.ground)G.ground.add(d.m);d.m.visible=true}
function tickDecals(dt){for(const d of vfxDecals){if(d.t<=0){d.m.visible=false;continue}d.t-=dt;const k=1-d.t/d.max;d.m.rotation.y+=d.spin*dt;
  const s=d.size*(.55+.45*Math.min(1,k*3));d.m.scale.set(s,1,s);d.m.material.opacity=Math.min(1,k*5)*(1-k*k)}}
function tickVfx(dt){const P=vfxP;let live=0;
  for(let i=0;i<VFX_MAX;i++){if(P.life[i]<=0){vfxA[i*4+1]=0;continue}live++;P.life[i]-=dt;const t=1-P.life[i]/P.max[i];
    P.vel[i*3]+=P.grav[i*3]*dt;P.vel[i*3+1]+=P.grav[i*3+1]*dt;P.vel[i*3+2]+=P.grav[i*3+2]*dt;
    P.pos[i*3]+=P.vel[i*3]*dt;P.pos[i*3+1]+=P.vel[i*3+1]*dt;P.pos[i*3+2]+=P.vel[i*3+2]*dt;
    const cell=P.cell[i],grow=cell===CELL.ring||cell===CELL.rune?(.4+t*.9):cell===CELL.fire?(.6+t*.7):1;
    vfxA[i*4]=P.size[i]*grow;vfxA[i*4+1]=P.life[i]<=0?0:Math.min(1,t*6)*(1-t)*(cell===CELL.rune?1.2:1.6);vfxA[i*4+2]=cell;vfxA[i*4+3]=Math.min(63,Math.floor(t*64+P.spin[i]*0))}
  vfxPts.visible=live>0&&level==='ground';if(!live)return;
  vfxGeo.attributes.position.needsUpdate=vfxGeo.attributes.color.needsUpdate=vfxGeo.attributes.aInfo.needsUpdate=true;
  vfxMat.uniforms.scale.value=renderer.domElement.height}

/* ---- presets for gameplay events ---- */
const VFX_COL={melee:'#ffd27a',ranged:'#ff7a4a',magic:'#a98bff',holy:'#ffe9a0',nature:'#8fe07a',frost:'#9fe4ff',heal:'#9dffb0',debuff:'#b04aff',blood:'#ff4a3a',buff:{berserk:'#ff5a3a',dash:'#6ff0ff',camp:'#ffb35a',inspire:'#d08bff',rally:'#ffd75a',stim:'#9dffb0'}};
const casterKind=()=>{const c=CH&&CH.cls;return/mage/.test(c)?'magic':/priest/.test(c)?'holy':/verduror|ranger/.test(c)?'nature':'melee'};
function vfxCast(x,z,col){const y=groundH(groundWorld,x,z);vfxRing(x,z,{color:col,cell:CELL.rune,size:3.2,life:1.1});vfxEmit('auras',x,y,z,26,{color:col,jitter:1,scale:1.4})}
function vfxImpact(x,z,h,col,big){const y=groundH(groundWorld,x,z)+(h||1.1);vfxEmit('impacts',x,y,z,big?40:18,{color:col,jitter:1,scale:big?1.6:1.1});vfxEmit('lightning',x,y,z,big?10:4,{color:'#ffffff',scale:.9})}
function vfxBolt(from,to,col,dur=.28){const steps=14;for(let s=0;s<=steps;s++){const k=s/steps;setTimeout(()=>{if(level!=='ground')return;const x=from.x+(to.x-from.x)*k,z=from.z+(to.z-from.z)*k,y=from.y+(to.y-from.y)*k+Math.sin(k*Math.PI)*.8;
  vfxEmit('projectiles',x,y-groundH(groundWorld,x,z)+groundH(groundWorld,x,z),z,3,{color:col,scale:2.2,pow:.05,life:.6})},k*dur*1000)}
  setTimeout(()=>vfxImpact(to.x,to.z,to.y-groundH(groundWorld,to.x,to.z),col),dur*1000)}
function vfxFireBurst(x,z,h){const y=groundH(groundWorld,x,z)+(h||0);vfxEmit('fire',x,y,z,30,{color:'#ffffff',scale:3.2,life:1.2})}
const vfxLoops=[];// buff auras that keep emitting while the buff lasts
function vfxAura(col,secs){vfxLoops.push({col,t:secs,acc:0})}
function tickVfxLoops(dt){if(!play.model||groundMode!=='play')return;for(let i=vfxLoops.length-1;i>=0;i--){const L=vfxLoops[i];L.t-=dt;L.acc+=dt;if(L.t<=0){vfxLoops.splice(i,1);continue}
  if(L.acc>.12){L.acc=0;vfxEmit('auras',play.x,groundH(groundWorld,play.x,play.z),play.z,3,{color:L.col,jitter:1,scale:1.2})}}}

// hooks: abilities, melee and enemy hits, kills, level-ups
{const _ua=useAbility;useAbility=function(a){const before={act:CH&&CH.act,mind:CH&&CH.mind,hp:CH&&CH.hp},cdB=cds[a.id];_ua(a);if(!CH||groundMode!=='play'||!a)return;
  const fired=cds[a.id]!==cdB||(CH.act!==before.act)||(CH.mind!==before.mind);if(!fired&&!a.run)return;
  const me={x:play.x,y:groundH(groundWorld,play.x,play.z)+1.3,z:play.z},kind=casterKind(),col=VFX_COL[kind];
  if(a.hit){const p=currentTarget(),tp=p?targetPos(p):hunt.cur?{x:hunt.cur.a.pos.x,z:hunt.cur.a.pos.z}:null;
    if(tp){const to={x:tp.x,y:groundH(groundWorld,tp.x,tp.z)+1.1,z:tp.z};if(a.hit.melee||(!a.hit.range&&kind==='melee'))vfxImpact(tp.x,tp.z,1.1,VFX_COL.melee,true);
      else{vfxCast(play.x,play.z,col);if(kind==='magic'&&/power|elite/.test(a.id))vfxFireBurst(tp.x,tp.z,.2);vfxBolt(me,to,charStats().gun?VFX_COL.ranged:col)}}}
  if(a.heal){vfxRing(play.x,play.z,{color:VFX_COL.heal,size:3,life:1});vfxEmit('auras',play.x,me.y-1.3,play.z,40,{color:VFX_COL.heal,jitter:1,scale:1.5,life:1.3})}
  if(a.buff){const c=VFX_COL.buff[a.buff[0]]||VFX_COL.holy;vfxRing(play.x,play.z,{color:c,size:3.4,life:1.2});vfxAura(c,Math.min(30,a.buff[2]||10))}
  if(a.debuff){const p=currentTarget();if(p){const tp=targetPos(p);vfxRing(tp.x,tp.z,{color:VFX_COL.debuff,cell:CELL.rune,size:2.6,life:1.4});vfxEmit('ice',tp.x,groundH(groundWorld,tp.x,tp.z)+1,tp.z,24,{color:VFX_COL.debuff,jitter:1,scale:1.3})}}}}
{const _kn=killNpc;killNpc=function(p){let tp=null;try{tp=targetPos(p)}catch(e){}_kn(p);if(tp&&groundWorld){vfxImpact(tp.x,tp.z,.8,VFX_COL.blood,true);vfxRing(tp.x,tp.z,{color:'#ffcf7a',size:2.4,life:.9})}}}
{const _hk=huntKill;huntKill=function(a,h){_hk(a,h);vfxImpact(a.pos.x,a.pos.z,.6,VFX_COL.blood,false)}}
// small sparks on every landed auto-attack (player model swing flag is set by tickCombat)
let vfxLastCd=0;
{const _gt=gameTick;gameTick=function(dt){_gt(dt);tickVfxLoops(dt);tickVfx(dt);tickDecals(dt);
  const swung=combat.cd>vfxLastCd+.3;vfxLastCd=combat.cd;
  if(play.model&&groundMode==='play'&&combat.p&&swung){const tp=targetPos(combat.p);if(!charStats().gun){if(casterKind()==='melee')vfxImpact(tp.x,tp.z,1.1,VFX_COL.melee,false);else vfxBolt({x:play.x,y:groundH(groundWorld,play.x,play.z)+1.3,z:play.z},{x:tp.x,y:groundH(groundWorld,tp.x,tp.z)+1.1,z:tp.z},VFX_COL[casterKind()],.22)}}}}
// the pool lives in the ground scene; re-add after a planet change clears it
{const _bg=buildGround;buildGround=function(w){_bg(w);G.ground.add(vfxPts);vfxP.life.fill(0);for(const d of vfxDecals){d.t=0;d.m.visible=false}}}
if(G.ground)G.ground.add(vfxPts);


/* ---- colony kit: the ObjectStore copies lost their texture atlas (1x1 placeholder), so they get a procedural hull:
   world-space plating, panel seams, lit window strips on walls, tint per building type ---- */
const HULL_TINT={col_research:'#d9dde3',col_reactor:'#8e949c',col_runway:'#a9b0b8',col_gate:'#c6ccd4',col_solar:'#4a6a9a',col_drone:'#b8b2a6',col_warehouse:'#9fa6ad',
  col_geo:'#9a8f84',col_home:'#cfd4d9',col_house:'#d6d0c6',col_house2:'#cdd2d6',col_farm:'#a7b59a',col_cruiser:'#8f9aa8',col_destroyer:'#7c8794',col_tower:'#a4a9ae',col_barrel:'#b07a48'};
// CraftPix Space Colony palette atlases (licensed store asset, kits/store/colony): four trim/body schemes; parts keep their
// authored colour bands, the procedural plating, seams and window bands still run on top
const COLONY_ATLAS={};
function colonyAtlas(v){if(COLONY_ATLAS[v]!==undefined)return COLONY_ATLAS[v];COLONY_ATLAS[v]=null;
  new THREE.TextureLoader().load('kits/store/colony/'+v+'.png',t=>{t.flipY=false;t.magFilter=THREE.NearestFilter;t.minFilter=THREE.LinearFilter;t.generateMipmaps=false;t._keep=true;COLONY_ATLAS[v]=t;
    for(const m of hullMats)if(m.userData.atlas===v){m.map=t;m.color.lerp(new THREE.Color(1,1,1),.75);m.needsUpdate=true}},undefined,()=>{});return null}
const hullMats=[];
function hullVariant(name){const w=typeof groundWorld!=='undefined'&&groundWorld,fac=w&&PLANET_FACTION[w.id];const blue=fac!=='legion',white=/research|home|house|farm|solar/.test(name);return'T_Spase'+(blue?'_blue':'')+(white?'_white':'').replace('T_Spase_white','T_Spase_white')}
function hullMat(hex,glow,name=''){const m=new THREE.MeshLambertMaterial({color:new THREE.Color(hex)});m.extensions={derivatives:true};
  const v=hullVariant(name);m.userData.atlas=v;hullMats.push(m);const at=colonyAtlas(v);if(at){m.map=at;m.color.lerp(new THREE.Color(1,1,1),.75)}
  m.onBeforeCompile=sh=>{sh.uniforms.glowC={value:new THREE.Color(glow||'#7fe8ff')};
    sh.vertexShader='varying vec3 vHW;\n'+sh.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nvec4 hw=vec4(transformed,1.);\n#ifdef USE_INSTANCING\nhw=instanceMatrix*hw;\n#endif\nvHW=(modelMatrix*hw).xyz;');
    sh.fragmentShader='varying vec3 vHW;uniform vec3 glowC;\nfloat hh(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}\nfloat seam(vec2 p){vec2 g=abs(fract(p)-.5);return smoothstep(.47,.5,max(g.x,g.y));}\n'+sh.fragmentShader
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );',`vec4 diffuseColor = vec4( diffuse, opacity );
        vec3 nn=normalize(cross(dFdx(vHW),dFdy(vHW)));vec3 aw=abs(nn);vec2 uvp=aw.y>.6?vHW.xz:aw.x>.6?vHW.zy:vHW.xy;vec2 pp=uvp/vec2(2.4,1.6);
        float plate=.86+.14*hh(floor(pp));float s1=seam(pp);diffuseColor.rgb*=plate*(1.-.35*s1);
        float wall=1.-aw.y;float band=smoothstep(.06,.0,abs(fract(vHW.y/3.2)-.55)-.05)*wall*step(.45,hh(floor(uvp/vec2(1.6,3.2))+7.));`)
      .replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance+=glowC*band*.9;')}
  m.customProgramCacheKey=()=>'hull'+(glow||'')+(m.map?'m':'');return m}
{const _kp=kitProto;kitProto=function(name,g){const p=_kp(name,g);if(p&&/^col_/.test(name)&&!p._hull){p._hull=true;const glow=/reactor|geo/.test(name)?'#ffb45a':/solar/.test(name)?'#7fb8ff':'#7fe8ff';
  const mat=hullMat(HULL_TINT[name]||'#b4bac2',glow,name);for(const part of p.parts)part.mat=mat}return p}}

/* ---- Grudge ID account row in the menu (standalone site with a backend only) ---- */
{const _me=menuExtras;menuExtras=function(){_me();const A=window.grudgeAuth,B=$('#gwBody');if(!A||!A.enabled()||!B||B.querySelector('.gid-row'))return;
  const box=document.createElement('section');box.className='gid-row';const on=A.signedIn();
  box.innerHTML=`<h3>Account</h3><p class="gw-note">${on?`Signed in with Grudge ID${A.name()?' as <b>'+esc(A.name())+'</b>':''}. Your characters follow your account on every device.`:'Playing as a guest: characters are tied to this browser. Sign in with Grudge ID to keep them on every device (your guest characters move over).'}</p>
    <button class="btn ${on?'':'primary'}" id="gidBtn">${on?'Sign out':'Sign in with Grudge ID'}</button>`;
  B.append(box);box.querySelector('#gidBtn').onclick=()=>{if(CH)saveNow();setTimeout(()=>on?A.signOut():A.signIn(),150)}}}

/* ================= 100STYLE locomotion (Mason, Starke & Komura 2022, CC BY 4.0) =================
   Neutral style: walk and run in 8 directions (diagonals blended from forward/back and side loops on foot contact)
   used when the camera is locked (mouselook or combat). 27 character styles (walk + idle) for townsfolk by role,
   undead and droids, and for players with /walk <style>. */
const WALK_STYLES={march:'March',swat:'Swat',old:'Old',proud:'Proud',elated:'Elated',depressed:'Depressed',strutting:'Strutting',heavyset:'Heavyset',
  handsInPockets:'Hands in pockets',armsBehindBack:'Arms behind back',walkingStickLeft:'Walking stick',limpLeft:'Limp',drunk:'Drunk',monk:'Monk',akimbo:'Akimbo',
  zombie:'Zombie',robot:'Robot',tiptoe:'Tiptoe',crouched:'Crouched',penguin:'Penguin',chicken:'Chicken',dinosaur:'Dinosaur',superman:'Superman',skip:'Skip',aeroplane:'Aeroplane',cat:'Cat',teapot:'Teapot'};
const ROLE_STYLES={Guard:['march','swat'],Captain:['march','proud'],Priest:['monk'],Noble:['armsBehindBack','proud','strutting'],Merchant:['handsInPockets','heavyset','akimbo'],
  Healer:['armsBehindBack','monk'],Bard:['strutting','elated','skip'],Artisan:['handsInPockets','heavyset'],Innkeeper:['heavyset','akimbo'],Traveler:['handsInPockets','elated'],
  Laborer:['heavyset','depressed','old'],Trainer:['proud','akimbo']};
const TOWN_STYLES=['old','depressed','handsInPockets','proud','elated','heavyset','walkingStickLeft','limpLeft','armsBehindBack'];
function npcWalkStyle(p,spec){const g=p.g||{},h=strHash((g.name||'')+Math.round(p.x)+Math.round(p.z)),race=spec&&spec.o&&spec.o.race;
  if(race==='undead'&&h%3)return'zombie';if(/droid|construct|golem/i.test(g.name||''))return'robot';
  if(g.kind&&g.kind!=='friendly')return null;
  const L=ROLE_STYLES[g.role];if(L&&h%4)return L[(h>>>2)%L.length];
  if(/cantina|tavern/i.test(p.t||''))return h%2?'drunk':null;return h%3===0?TOWN_STYLES[(h>>>3)%TOWN_STYLES.length]:null}
{const _sc=spawnCreature;spawnCreature=function(p,spec){const o=_sc(p,spec);if(o&&spec&&spec.type==='toon')o.userData.walkStyle=npcWalkStyle(p,spec);return o}}
const DIR8={f:'F',b:'B',l:'L',r:'R',fl:'FL',fr:'FR',bl:'BL',br:'BR'};
{const _lc=locoClip;locoClip=function(u,amt){
  if(amt>0&&u.dir8&&DIR8[u.dir8]){const c=(amt>1.5?'sr':'sw')+DIR8[u.dir8];if(u.clips[c])return c}
  const ws=u.walkStyle;if(ws&&!u.combat&&!u.gun){if(amt>0&&amt<=1.5&&u.clips['sty_'+ws])return'sty_'+ws;if(amt<=0&&u.clips['styi_'+ws])return'styi_'+ws}
  return _lc(u,amt)}}
// player: 8-way direction in locked-camera mode, chosen walk style
{const _up=updatePlay;updatePlay=function(dt){_up(dt);if(!play.model)return;const u=play.model.userData;
  const ml=(typeof mouselook!=='undefined'&&mouselook)||combat.p||hunt.auto,fz=(keys.has('w')||keys.has('arrowup')?1:0)-(keys.has('s')||keys.has('arrowdown')?1:0),fx=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0);
  u.dir8=ml&&!play.mount&&!rts.on?((fz>0?'f':fz<0?'b':'')+(fx<0?'l':fx>0?'r':'')):'';u.walkStyle=CH&&CH.walkStyle||null}}
// /walk command
{const _cs=chatSend;chatSend=function(text){const t=String(text||'').trim();const m=/^\/walk(?:\s+(.+))?$/i.exec(t);if(!m)return _cs(text);
  if(!CH)return;const want=(m[1]||'').toLowerCase().replace(/\s+/g,'');
  if(!want)return mmLog('Walk styles: '+Object.values(WALK_STYLES).join(', ')+'. Use /walk <style> or /walk normal.','sys');
  if(want==='normal'||want==='off'){CH.walkStyle=null;markDirty();return mmLog('You walk normally again.','sys')}
  const id=Object.keys(WALK_STYLES).find(k=>k.toLowerCase()===want||WALK_STYLES[k].toLowerCase().replace(/\s+/g,'')===want);
  if(!id)return mmLog(`No walk style "${m[1]}". Type /walk to list them.`,'sys');CH.walkStyle=id;markDirty();mmLog(`You now walk: ${WALK_STYLES[id]}.`,'sys')}}

// credits (100STYLE is CC BY 4.0 and must be credited)
{const _me2=menuExtras;menuExtras=function(){_me2();const B=$('#gwBody');if(!B||B.querySelector('.credits-row'))return;const c=document.createElement('section');c.className='credits-row';
  c.innerHTML='<h3>Credits</h3><p class="gw-note">Locomotion styles: <a href="https://www.ianxmason.com/100style/" target="_blank" rel="noopener">100STYLE</a> dataset by I. Mason, S. Starke and T. Komura (2022), CC BY 4.0. Ranged and movement clips: KayKit Character Animations (Kay Lousberg) and the Universal Animation Library 1 and 2 (Quaternius), CC0. Alien flora, xeno creatures, war droids, habitats, rovers, ships and turrets: Ultimate Space Kit and Sci-fi Turrets (Quaternius), CC0. Space backdrops: Kenney Space Skyboxes, CC0. Wildlife: ANIMALS FULL PACK (Unity Asset Store, licensed). Guns: Quaternius Modular Sci-Fi Guns and Ultimate Gun Pack, CC0. Parkour motion capture: hhtools Parkour Mocap by YaojieShen (Apache-2.0), packaged as codepawl/parkour-mocap-glb on Hugging Face. Glow whale model: Quaternius Animated Fish Pack, CC0. Surface and ground materials and scanned rocks: Poly Haven, CC0. Mars environment kit by <a href="https://sketchfab.com/SOLDMARS" target="_blank" rel="noopener">SOLDMARS</a>, CC BY 4.0. World layout: open-source emulator data (credited in the project README).</p>';B.append(c)}}

/* ================= Waypoints and the planet map (Shift+M), SWG datapad style =================
   Every character keeps a datapad of waypoints (name, colour, planet, on/off). Active waypoints on the current planet
   get a light beam in the world, a framed marker on screen (clamped to the screen edge with an arrow when off-screen),
   a tick on the compass and a diamond on the minimap. Shift+M opens the planet map: click to drop a waypoint,
   click a town to mark it, right-click a waypoint to delete it, wheel to zoom, drag to pan. */
const WP_COLORS={blue:'#5fc4ff',green:'#7fe08a',orange:'#ffa14a',yellow:'#ffe066',purple:'#c792ff',white:'#f2f2f2'},WP_ORDER=Object.keys(WP_COLORS),WP_MAX=40;
const wpObjs=new Map();let wpSeq=0;
const wpList=()=>CH?(CH.waypoints||(CH.waypoints=[])):[];
const wpHere=()=>groundWorld?wpList().filter(p=>p.planet===groundWorld.id&&p.active):[];
function wpAdd(x,z,name,o={}){if(!CH||!groundWorld)return null;const L=wpList();
  if(o.nav){const i=L.findIndex(q=>q.nav);if(i>=0)L.splice(i,1)}
  else if(L.filter(q=>!q.nav).length>=WP_MAX){toast(`Your datapad holds ${WP_MAX} waypoints. Delete one on the map (Shift+M) first.`);return null}
  const p={id:'w'+Date.now().toString(36)+(wpSeq++),name:String(name||`Waypoint ${L.length+1}`).slice(0,40),x:Math.round(x),z:Math.round(z),planet:groundWorld.id,color:o.color||'blue',active:true,nav:!!o.nav};
  L.push(p);markDirty();wpSync();return p}
function wpRemove(id){const L=wpList(),i=L.findIndex(q=>q.id===id);if(i>=0){L.splice(i,1);markDirty()}wpSync()}
function wpDispose(g){g.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)o.material.dispose()})}
function wpSync(){const here=new Map(wpHere().map(p=>[p.id,p]));
  for(const [id,g] of wpObjs){const p=here.get(id);if(!p||g.parent!==G.ground||g.userData.color!==p.color){if(g.parent)g.parent.remove(g);wpDispose(g);wpObjs.delete(id)}}
  if(level!=='ground'||!groundWorld)return;
  for(const p of here.values()){if(wpObjs.has(p.id))continue;const c=new THREE.Color(WP_COLORS[p.color]||WP_COLORS.blue),g=new THREE.Group();
    const beam=new THREE.Mesh(new THREE.CylinderGeometry(.45,.45,90,10,1,true),new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:.3,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}));beam.position.y=45;g.add(beam);
    const ring=new THREE.Mesh(new THREE.RingGeometry(1.5,2.1,36),new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:.75,side:THREE.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.y=.35;g.add(ring);
    g.position.set(p.x,groundH(groundWorld,p.x,p.z),-p.z);g.userData.color=p.color;g.userData.ring=ring;G.ground.add(g);wpObjs.set(p.id,g)}}
// the older single-waypoint calls (survey hotspots, trainers, routes) now drop an orange navigation waypoint
setWaypoint=function(x,z,label){if(!CH){return}wpAdd(x,z,label||'Destination',{nav:true,color:'orange'})};

/* ---- on-screen frames and edge arrows ---- */
const wpLayer=document.createElement('div');wpLayer.id='wpLayer';document.body.append(wpLayer);const wpEls=new Map();
const _wv=new V3();
function tickWaypoints(dt){const on=CH&&level==='ground'&&groundMode==='play'&&groundWorld&&!rts.on;wpLayer.hidden=!on;if(!on)return;
  if([...wpObjs.values()].some(g=>g.parent!==G.ground)||wpHere().some(p=>!wpObjs.has(p.id)))wpSync();
  const t=performance.now()/1000,here=wpHere(),seen=new Set(),W=innerWidth,H=innerHeight;
  for(const p of here){seen.add(p.id);let el=wpEls.get(p.id);
    if(!el){el=document.createElement('div');el.className='wp-mark';el.innerHTML='<i class="wp-arrow"></i><b class="wp-gem"></b><span><em></em><small></small></span>';wpLayer.append(el);wpEls.set(p.id,el)}
    const d=Math.hypot(p.x-play.x,p.z-play.z);
    if(p.nav&&d<(play.mount?12:7)&&!route){mmLog(`You have arrived at ${p.name}.`,'sys');wpRemove(p.id);continue}
    el.style.setProperty('--c',WP_COLORS[p.color]||WP_COLORS.blue);el.querySelector('em').textContent=p.name;el.querySelector('small').textContent=d<1000?Math.round(d)+' m':(d/1000).toFixed(1)+' km';
    const g=wpObjs.get(p.id);if(g&&g.userData.ring){const s=1+.12*Math.sin(t*3);g.userData.ring.scale.set(s,s,s)}
    _wv.set(p.x,groundH(groundWorld,p.x,p.z)+Math.min(8,2.5+d*.01),-p.z).applyMatrix4(cam.matrixWorldInverse);const behind=_wv.z>0;_wv.applyMatrix4(cam.projectionMatrix);
    let nx=_wv.x,ny=_wv.y;if(behind){nx=-nx;ny=-ny;if(Math.abs(nx)<.01&&Math.abs(ny)<.01)ny=-1}
    const inside=!behind&&Math.abs(nx)<.94&&ny<.82&&ny>-.6;
    // edge clamp: keep clear of the compass at the top and the action bar at the bottom
    if(!inside){const k=Math.max(Math.abs(nx)/.9,ny>0?ny/.76:-ny/.5,1e-6);nx/=k;ny/=k}
    el.classList.toggle('edge',!inside);el.classList.toggle('near',d<25);
    el.style.transform=`translate(${(nx*.5+.5)*W}px,${(-ny*.5+.5)*H}px)`;
    if(!inside)el.querySelector('.wp-arrow').style.transform=`rotate(${Math.atan2(-ny,nx)}rad)`}
  for(const [id,el] of wpEls)if(!seen.has(id)){el.remove();wpEls.delete(id)}}
{const _gt=gameTick;gameTick=function(dt){_gt(dt);tickWaypoints(dt)}}

/* ---- compass ticks and minimap diamonds for every active waypoint ---- */
{const _dm=drawMini;drawMini=function(){_dm();if(mini.hidden||!groundWorld)return;const W=mini.width,k=W/EXT;
  for(const p of wpHere()){const px=(p.x+HALF)*k,py=(HALF-p.z)*k;mctx.save();mctx.translate(px,py);mctx.rotate(Math.PI/4);mctx.fillStyle=WP_COLORS[p.color];mctx.strokeStyle='#000';mctx.lineWidth=1.5;mctx.fillRect(-3.5,-3.5,7,7);mctx.strokeRect(-3.5,-3.5,7,7);mctx.restore()}}}

/* ---- the planet map ---- */
const wmap=document.createElement('div');wmap.id='wmap';wmap.hidden=true;wmap.innerHTML=`<div class="wm-card" role="dialog" aria-label="Planet map">
  <header><h2 id="wmTitle">Planet map</h2><small id="wmCoord"></small><button class="x" id="wmClose" aria-label="Close map">×</button></header>
  <div class="wm-body"><div class="wm-view"><canvas id="wmCanvas"></canvas><div class="wm-help">Click: drop waypoint · click a town: mark it · right-click a waypoint: delete · wheel: zoom · drag: pan</div>
    <div class="wm-zoom"><button class="btn mini" id="wmIn" aria-label="Zoom in">+</button><button class="btn mini" id="wmOut" aria-label="Zoom out">−</button><button class="btn mini" id="wmMe">Me</button></div></div>
  <aside class="wm-side"><h3>Waypoints <small id="wmCount"></small></h3><ul id="wmList"></ul>
    <h3>Show</h3><div class="wm-filters" id="wmFilters"></div></aside></div></div>`;
document.body.append(wmap);
const wmC=$('#wmCanvas'),wmX=wmC.getContext('2d');
const wm={cx:0,cz:0,s:1,drag:null,sel:null,hover:null,show:{city:1,military:1,ruin:1,crash:1,camp:1,landmark:1,travel:1,roads:1,grid:1,names:1}};
const WM_SHOW={city:'Cities',military:'Military',ruin:'Ruins',crash:'Crash sites',camp:'Camps',landmark:'Landmarks',travel:'Travel',roads:'Roads',grid:'Grid',names:'Names'};
function wmFit(){const r=wmC.getBoundingClientRect();wm.s=Math.min(r.width,r.height)/EXT;wm.cx=0;wm.cz=0}
function wmOpen(){if(level!=='ground'||!groundWorld)return toast('Land on a world to open its map.');wmap.hidden=false;
  $('#wmTitle').textContent=planetName(groundWorld)+' · planet map';wmResize();wmFit();if(groundMode==='play'){wm.cx=play.x;wm.cz=play.z;wm.s*=2}wmFilters();wmRenderList();wmDraw()}
function wmClose(){wmap.hidden=true;wm.drag=null}
const wmOpenNow=()=>!wmap.hidden;
function wmResize(){const r=wmC.getBoundingClientRect(),d=Math.min(2,devicePixelRatio||1);wmC.width=Math.max(10,r.width*d|0);wmC.height=Math.max(10,r.height*d|0);wmX.setTransform(d,0,0,d,0,0)}
const wmTo=(x,z)=>{const r=wmC.getBoundingClientRect();return[r.width/2+(x-wm.cx)*wm.s,r.height/2-(z-wm.cz)*wm.s]};
const wmFrom=(px,py)=>{const r=wmC.getBoundingClientRect();return{x:wm.cx+(px-r.width/2)/wm.s,z:wm.cz-(py-r.height/2)/wm.s}};
function wmClamp(){const r=wmC.getBoundingClientRect(),min=Math.min(r.width,r.height)/EXT*.9;wm.s=Math.max(min,Math.min(wm.s,2.5));wm.cx=Math.max(-HALF,Math.min(HALF,wm.cx));wm.cz=Math.max(-HALF,Math.min(HALF,wm.cz))}
function wmDraw(){if(wmap.hidden||!groundWorld)return;const w=groundWorld,r=wmC.getBoundingClientRect(),X=wmX;X.clearRect(0,0,r.width,r.height);X.fillStyle='#07090d';X.fillRect(0,0,r.width,r.height);
  const [x0,y0]=wmTo(-HALF,HALF),size=EXT*wm.s;X.imageSmoothingEnabled=true;if(w.miniImg)X.drawImage(w.miniImg,x0,y0,size,size);
  X.fillStyle='rgba(6,8,12,.18)';X.fillRect(x0,y0,size,size);X.strokeStyle='#5a4630';X.lineWidth=2;X.strokeRect(x0,y0,size,size);
  // coordinate grid every 1024 m (or 256 m when zoomed in)
  if(wm.show.grid){const step=wm.s>.25?256:1024;X.strokeStyle='rgba(232,196,106,.13)';X.lineWidth=1;X.fillStyle='rgba(232,196,106,.55)';X.font='10px "IBM Plex Mono",monospace';
    for(let v=-HALF;v<=HALF;v+=step){const [gx]=wmTo(v,0),[,gy]=wmTo(0,v);X.beginPath();X.moveTo(gx,y0);X.lineTo(gx,y0+size);X.moveTo(x0,gy);X.lineTo(x0+size,gy);X.stroke();
      if(v%2048===0||step===256){X.fillText(v,gx+2,Math.max(12,y0+12));X.fillText(v,Math.max(2,x0+2),gy-2)}}}
  if(wm.show.roads&&w._roads){X.lineCap='round';for(const rd of w._roads.roads){X.strokeStyle=rd.kind==='street'?'rgba(230,214,180,.75)':'rgba(196,164,112,.7)';X.lineWidth=rd.kind==='street'?2:1.6;X.beginPath();rd.pts.forEach((p,i)=>{const [a,b]=wmTo(p.x,p.z);i?X.lineTo(a,b):X.moveTo(a,b)});X.stroke()}}
  if(route&&route.pts.length){X.strokeStyle='#6ff0ff';X.lineWidth=2.5;X.setLineDash([7,5]);X.beginPath();const [a,b]=wmTo(play.x,play.z);X.moveTo(a,b);for(const p of route.pts){const [c,d]=wmTo(p.x,p.z);X.lineTo(c,d)}X.stroke();X.setLineDash([])}
  // places
  X.textAlign='center';for(const q of w.pois){if(!wm.show[q.cat])continue;const [px,py]=wmTo(q.x,q.z);if(px<-40||py<-40||px>r.width+40||py>r.height+40)continue;
    const rr=Math.max(q.cat==='city'?4.5:3,q.r*wm.s);X.fillStyle=(CAT_COLOR[q.cat]||'#ccc')+'33';X.beginPath();X.arc(px,py,rr,0,TAU);X.fill();X.fillStyle=CAT_COLOR[q.cat]||'#ccc';X.beginPath();X.arc(px,py,q.cat==='city'?4.5:3.2,0,TAU);X.fill();
    if(q===wm.hover){X.strokeStyle='#fff';X.lineWidth=2;X.stroke()}
    if(wm.show.names&&(q.cat==='city'||q.dungeon||wm.s>.12||q===wm.hover)){X.font=(q.capital?'700 13px ':'600 11.5px ')+'"Saira Condensed",sans-serif';X.lineWidth=3;X.strokeStyle='rgba(0,0,0,.85)';X.strokeText(q.name,px,py-8);X.fillStyle=q.capital?'#ffe2a0':'#f4e6c8';X.fillText(q.name,px,py-8)}}
  if(wm.show.travel)for(const tp of travelPoints(w)){const [px,py]=wmTo(tp.x,tp.z);X.fillStyle=tp.star?'#ffd36a':'#9fe0ff';X.strokeStyle='#000';X.lineWidth=1.5;X.beginPath();X.moveTo(px,py-7);X.lineTo(px+6,py+5);X.lineTo(px-6,py+5);X.closePath();X.fill();X.stroke();
    if(wm.s>.09||tp===wm.hover){X.font='600 11px "Saira Condensed",sans-serif';X.lineWidth=3;X.strokeStyle='rgba(0,0,0,.85)';const lb=(tp.star?'Starport ':'Shuttle ')+tp.name;X.strokeText(lb,px,py+17);X.fillStyle='#e8f4ff';X.fillText(lb,px,py+17)}}
  // waypoints
  for(const p of wpList()){if(p.planet!==w.id)continue;const [px,py]=wmTo(p.x,p.z);X.save();X.translate(px,py);X.globalAlpha=p.active?1:.45;X.rotate(Math.PI/4);X.fillStyle=WP_COLORS[p.color];X.strokeStyle=p.id===wm.sel?'#fff':'#000';X.lineWidth=p.id===wm.sel?2.5:1.5;X.fillRect(-6,-6,12,12);X.strokeRect(-6,-6,12,12);X.restore();
    X.globalAlpha=p.active?1:.55;X.font='600 12px "Saira Condensed",sans-serif';X.lineWidth=3;X.strokeStyle='rgba(0,0,0,.9)';X.strokeText(p.name,px,py-11);X.fillStyle=WP_COLORS[p.color];X.fillText(p.name,px,py-11);X.globalAlpha=1}
  // you
  if(CH&&groundMode==='play'){const [px,py]=wmTo(play.x,play.z);X.save();X.translate(px,py);X.rotate(-play.yaw);X.fillStyle='#fff';X.strokeStyle='#000';X.lineWidth=2;X.beginPath();X.moveTo(0,-12);X.lineTo(8,9);X.lineTo(0,4);X.lineTo(-8,9);X.closePath();X.stroke();X.fill();X.restore()}
  X.textAlign='start'}
function wmHit(px,py){const R=10;for(const p of wpList()){if(p.planet!==groundWorld.id)continue;const [a,b]=wmTo(p.x,p.z);if(Math.hypot(a-px,b-py)<R)return{wp:p}}
  if(wm.show.travel)for(const tp of travelPoints(groundWorld)){const [a,b]=wmTo(tp.x,tp.z);if(Math.hypot(a-px,b-py)<R)return{tp}}
  let best=null,bd=12;for(const q of groundWorld.pois){if(!wm.show[q.cat])continue;const [a,b]=wmTo(q.x,q.z),d=Math.hypot(a-px,b-py)-Math.max(0,q.r*wm.s-6);if(d<bd){bd=d;best=q}}return best?{poi:best}:null}
const wmPos=e=>{const r=wmC.getBoundingClientRect();return[e.clientX-r.left,e.clientY-r.top]};
wmC.addEventListener('pointerdown',e=>{if(e.button!==0)return;wmC.setPointerCapture(e.pointerId);wm.drag={x:e.clientX,y:e.clientY,cx:wm.cx,cz:wm.cz,moved:false}});
wmC.addEventListener('pointermove',e=>{const [px,py]=wmPos(e),g=wmFrom(px,py);$('#wmCoord').textContent=`X ${fmt(g.x)} · Z ${fmt(g.z)}`+(CH&&groundMode==='play'?` · ${fmt(Math.hypot(g.x-play.x,g.z-play.z))} m away`:'');
  if(wm.drag){const dx=e.clientX-wm.drag.x,dy=e.clientY-wm.drag.y;if(Math.hypot(dx,dy)>4)wm.drag.moved=true;wm.cx=wm.drag.cx-dx/wm.s;wm.cz=wm.drag.cz+dy/wm.s;wmClamp();wmDraw();return}
  const h=wmHit(px,py),hv=h&&(h.poi||h.tp||h.wp)||null;if(hv!==wm.hover){wm.hover=hv;wmC.style.cursor=hv?'pointer':'crosshair';wmDraw()}});
wmC.addEventListener('pointerup',e=>{const d=wm.drag;wm.drag=null;if(!d||d.moved)return;const [px,py]=wmPos(e),h=wmHit(px,py);
  if(!CH)return toast('Play a character to set waypoints.');
  if(h&&h.wp){wm.sel=h.wp.id;wmRenderList();return wmDraw()}
  let p;if(h&&h.poi)p=wpAdd(h.poi.x,h.poi.z,h.poi.name,{color:h.poi.cat==='city'?'green':h.poi.cat==='military'?'orange':'blue'});
  else if(h&&h.tp)p=wpAdd(h.tp.x,h.tp.z,(h.tp.star?'Starport ':'Shuttleport ')+h.tp.name,{color:'yellow'});
  else{const g=wmFrom(px,py);if(Math.abs(g.x)>HALF||Math.abs(g.z)>HALF)return;p=wpAdd(g.x,g.z,null)}
  if(p){wm.sel=p.id;mmLog(`Waypoint added: ${p.name}.`,'sys');wmRenderList();wmDraw();const inp=$(`#wmList [data-name="${p.id}"]`);if(inp&&!(h&&(h.poi||h.tp))){inp.focus();inp.select()}}});
wmC.addEventListener('contextmenu',e=>{e.preventDefault();const [px,py]=wmPos(e),h=wmHit(px,py);if(h&&h.wp){wpRemove(h.wp.id);if(wm.sel===h.wp.id)wm.sel=null;wmRenderList();wmDraw()}});
wmC.addEventListener('wheel',e=>{e.preventDefault();const [px,py]=wmPos(e),before=wmFrom(px,py);wm.s*=Math.exp(-e.deltaY*.0015);wmClamp();const after=wmFrom(px,py);wm.cx+=before.x-after.x;wm.cz+=before.z-after.z;wmClamp();wmDraw()},{passive:false});
$('#wmIn').onclick=()=>{wm.s*=1.5;wmClamp();wmDraw()};$('#wmOut').onclick=()=>{wm.s/=1.5;wmClamp();wmDraw()};
$('#wmMe').onclick=()=>{if(CH&&groundMode==='play'){wm.cx=play.x;wm.cz=play.z;wmDraw()}};$('#wmClose').onclick=wmClose;
wmap.addEventListener('pointerdown',e=>{if(e.target===wmap)wmClose()});
addEventListener('resize',()=>{if(!wmap.hidden){wmResize();wmClamp();wmDraw()}});
function wmFilters(){$('#wmFilters').innerHTML=Object.entries(WM_SHOW).map(([k,l])=>`<label><input type="checkbox" data-f="${k}" ${wm.show[k]?'checked':''}> ${l}</label>`).join('');
  $('#wmFilters').querySelectorAll('[data-f]').forEach(c=>c.onchange=()=>{wm.show[c.dataset.f]=c.checked?1:0;wmDraw()})}
function wmRenderList(){const L=wpList(),here=L.filter(p=>groundWorld&&p.planet===groundWorld.id),else_=L.filter(p=>!groundWorld||p.planet!==groundWorld.id);
  $('#wmCount').textContent=CH?`${L.filter(p=>!p.nav).length} / ${WP_MAX}`:'';
  const row=p=>{const d=CH&&groundMode==='play'&&groundWorld&&p.planet===groundWorld.id?fmt(Math.hypot(p.x-play.x,p.z-play.z))+' m':esc((WORLDS.find(w=>w.id===p.planet)||{name:p.planet}).name);
    return `<li class="${p.id===wm.sel?'sel':''}" style="--c:${WP_COLORS[p.color]}"><button class="wm-col" data-col="${p.id}" aria-label="Change colour" title="Colour"></button>
      <span><input data-name="${p.id}" value="${esc(p.name)}" maxlength="40" aria-label="Waypoint name"><small>${p.nav?'Navigation · ':''}${d} · ${fmt(p.x)}, ${fmt(p.z)}</small></span>
      <span class="wm-acts"><button class="btn mini" data-on="${p.id}" title="${p.active?'Hide':'Show'} on screen" aria-label="${p.active?'Hide':'Show'} on screen" aria-pressed="${p.active}">${p.active?'◉':'○'}</button>${groundWorld&&p.planet===groundWorld.id&&CH&&groundMode==='play'?`<button class="btn mini" data-rt="${p.id}" title="Route along the roads" aria-label="Route along the roads">➜</button>`:''}<button class="btn mini danger" data-del="${p.id}" aria-label="Delete waypoint">✕</button></span></li>`};
  $('#wmList').innerHTML=!CH?'<li class="wm-empty">Play a character to keep waypoints.</li>':(here.length?here.map(row).join(''):'<li class="wm-empty">No waypoints on this planet yet. Click the map to drop one.</li>')+(else_.length?`<li class="wm-sub">Other planets</li>`+else_.map(row).join(''):'');
  const B=$('#wmList'),find=id=>wpList().find(q=>q.id===id);
  B.querySelectorAll('[data-col]').forEach(b=>b.onclick=()=>{const p=find(b.dataset.col);p.color=WP_ORDER[(WP_ORDER.indexOf(p.color)+1)%WP_ORDER.length];markDirty();wpSync();wmRenderList();wmDraw()});
  B.querySelectorAll('[data-name]').forEach(i=>{i.onchange=()=>{const p=find(i.dataset.name);p.name=i.value.trim().slice(0,40)||p.name;markDirty();wmDraw()};i.onkeydown=e=>{e.stopPropagation();if(e.key==='Enter')i.blur()}});
  B.querySelectorAll('[data-on]').forEach(b=>b.onclick=()=>{const p=find(b.dataset.on);p.active=!p.active;markDirty();wpSync();wmRenderList();wmDraw()});
  B.querySelectorAll('[data-rt]').forEach(b=>b.onclick=()=>{const p=find(b.dataset.rt);wmClose();setRoute({x:p.x,z:p.z},p.name);const n=wpList().findIndex(q=>q.nav&&q.id!==p.id&&Math.hypot(q.x-p.x,q.z-p.z)<2);if(n>=0)wpList().splice(n,1);wpSync()});
  B.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{wpRemove(b.dataset.del);wmRenderList();wmDraw()});
  B.querySelectorAll('li[style]').forEach(li=>li.onclick=e=>{if(e.target.closest('button,input'))return;const id=li.querySelector('[data-name]').dataset.name,p=find(id);if(!p||!groundWorld||p.planet!==groundWorld.id)return;wm.sel=id;wm.cx=p.x;wm.cz=p.z;wmRenderList();wmDraw()})}
// keep the map live while it is open (your arrow moves)
setInterval(()=>{if(!wmap.hidden&&!wm.drag)wmDraw()},500);
// Shift+M toggles the map; Esc closes it; other game keys wait while it is open
addEventListener('keydown',e=>{if(/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;const k=e.key.toLowerCase();
  if(k==='m'&&e.shiftKey){e.preventDefault();e.stopImmediatePropagation();wmOpenNow()?wmClose():wmOpen();return}
  if(!wmOpenNow())return;if(k==='escape'){wmClose();e.stopImmediatePropagation();e.preventDefault();return}
  if(k==='+'||k==='='){wm.s*=1.3;wmClamp();wmDraw()}else if(k==='-'){wm.s/=1.3;wmClamp();wmDraw()}
  e.stopImmediatePropagation()},true);
// HUD micro menu gets a map button
UI_ICON.map='<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2Z"/><path d="M9 4v14M15 6v14"/>';
MICRO.splice(MICRO.length-1,0,['map','Planet map','⇧M']);
$('#ghActions').innerHTML=MICRO.map(([id,l,k])=>`<button data-act="${id}" aria-label="${l} (${k})" data-tip-h="${l}" data-tip="Hotkey ${k}">${uiIcon(id)}<kbd>${k}</kbd></button>`).join('');
$('#ghActions').addEventListener('click',e=>{const b=e.target.closest('button[data-act="map"]');if(!b)return;e.stopImmediatePropagation();wmOpen()},true);
// waypoints follow the character: rebuild beams when you land, switch characters or change planets
{const _ep=enterPlay;enterPlay=function(){_ep.apply(this,arguments);wpSync()}}
{const _xp=exitPlay;exitPlay=function(){_xp.apply(this,arguments);for(const [id,g] of wpObjs){if(g.parent)g.parent.remove(g);wpDispose(g)}wpObjs.clear();wmClose()}}

/* ================= Action animations: UAL2 (Quaternius, CC0) + the general KayKit/UAL clips put to work =================
   Sampling and harvesting kneel and dig, crafting tinkers, looting picks up, food and stims are consumed, clone revival
   gets up off the floor, swimming swims, carts are driven, melee classes get sword chains, shield bash and hook,
   heavy hits knock back, townsfolk fold arms / take comlink calls / nod and shake heads, guards carry torches at night,
   undead NPCs slump and claw. New emotes: /yes /no /foldarms /comlink /lean /eat /getup /chop /harvest. */
const ACT_HOLD=1e9;
const actPlay=(name,opts)=>{const m=play.model;if(!m||!m.userData.mixer||!m.userData.clips[name])return false;toonPlay(m,name,.25,opts||{once:true});return true};
// a looping clip held for a while (moving cancels it, like any one-shot)
function toonLoopFor(inst,name,hold,fade=.3){const u=inst.userData;if(!u.clips[name])return false;toonPlay(inst,name,fade);u.once=hold;return true}
const actLoop=name=>!!(play.model&&play.model.userData.mixer&&toonLoopFor(play.model,name,ACT_HOLD));
const actStop=()=>{const m=play.model;if(m&&m.userData.mixer&&m.userData.once>1e6){m.userData.once=0;toonPlay(m,'idle',.3)}};

// sampling: kneel and dig until it stops (moving also stops it, and locomotion takes over)
{const _s=startSample;startSample=function(){const r=_s.apply(this,arguments);if(sampling)actLoop('harvest')||actLoop('fixing');return r}}
{const _s=stopSample;stopSample=function(){const was=!!sampling;_s();if(was)actStop()}}
{const _t=tickSample;tickSample=function(dt){const was=!!sampling;_t(dt);if(was&&!sampling)actStop()}}
// skinning a kill, crafting at a bench, using an item from the bar
{const _h=harvestCorpse;harvestCorpse=function(){const r=_h.apply(this,arguments);actPlay('pickUp')||actPlay('interact');return r}}
{const _f=finishCraft;finishCraft=function(s){actPlay('fixing',{once:true,hold:1.6});return _f.apply(this,arguments)}}
{const _u=useSlot;useSlot=function(b,i){const v=bars()[b][i],s=slotInfo(v);const r=_u.apply(this,arguments);
  if(s&&s.kind==='it'&&s.n>0)actPlay(s.proto&&s.proto.kind==='food'?'consume':'useItem');return r}}
// cloned / revived: get up off the floor
{const _i=incapacitate;incapacitate=function(){const r=_i.apply(this,arguments);setTimeout(()=>actPlay('getUp',{once:true,hold:1.5}),120);return r}}
// a cart is driven, everything else is ridden
{const _m=mount;mount=function(id){const r=_m.apply(this,arguments);if(play.mount&&play.mount.def.cart)setTimeout(()=>actLoop('drive'),50);return r}}

// locomotion: swim in deep water
{const _lc=locoClip;locoClip=function(u,amt){if(u.swim&&u.clips.swim)return amt>0?'swim':(u.clips.swimIdle?'swimIdle':'swim');return _lc(u,amt)}}
{const _up=updatePlay;updatePlay=function(dt){_up(dt);if(!play.model||!groundWorld)return;const u=play.model.userData,d=play.mount?0:waterDepth(groundWorld,play.x,play.z);
  const was=u.swim;u.swim=d>1.2;if(u.swim&&!was&&u.once>0){u.once=0}}}

// melee variety: sword chains, shield bash, hook; heavy hits knock back
Object.assign(CLASS_ANIM.warrior,{atk:['attackShield','swordA','attack1h','swordB','shieldBash','swordC']});
Object.assign(CLASS_ANIM.thief,{atk:['slash','swordA','hook','attack1h']});
Object.assign(CLASS_ANIM.raider,{atk:['attack2h','club','swordCombo']});
Object.assign(CLASS_ANIM.worge,{atk:['club','chop','hook']});
{const _os=toonOneShot;toonOneShot=function(inst,kind){if(inst&&inst.userData&&inst.userData.mixer){const u=inst.userData;
    if(kind==='stagger'&&u.clips.knockback&&Math.random()<.5)return toonPlay(inst,'knockback',.08,{once:true,hold:.85});
    // undead NPCs claw instead of swinging (players keep their weapon skills)
    if(kind==='attack'&&u.race==='undead'&&inst!==play.model&&!u.gun&&u.clips.zScratch&&Math.random()<.6)return toonPlay(inst,'zScratch',.12,{once:true,hold:1.4})}
  return _os(inst,kind)}}

// emotes
Object.assign(EMOTES,{yes:'nods',no:'shakes their head',foldarms:'folds their arms',comlink:'takes a comlink call',lean:'leans on the rail',eat:'has a bite to eat',
  getup:'gets up',chop:'chops wood',harvest:'digs for something'});
Object.assign(EMOTE_CLIP,{yes:'nodYes',no:'shakeNo',foldarms:'foldArms',comlink:'comlink',lean:'railLean',eat:'consume',getup:'getUp',chop:'treeChop',harvest:'harvest'});
const EMOTE_LOOP={foldArms:8,comlink:9,railLean:10,treeChop:6,harvest:5,shakeNo:2.5,nodYes:2.5};
{const _os=toonOneShot;toonOneShot=function(inst,kind){const c=EMOTE_CLIP[kind]||kind;
  if(inst&&inst.userData&&inst.userData.mixer&&EMOTE_LOOP[c]&&inst.userData.clips[c])return toonLoopFor(inst,c,EMOTE_LOOP[c],.25);return _os(inst,kind)}}

// NPC idle flavour from the new clips
{const _ni=npcIdleAnim;npcIdleAnim=function(u,ai,dt,kind,role){const o=u.toonObj;if(!o||!o.userData.mixer)return _ni(u,ai,dt,kind,role);
  const due=(ai.idleT??1)-dt<=0&&!(o.userData.once>0),C=o.userData.clips;
  if(!due||Math.random()>.45)return _ni(u,ai,dt,kind,role);
  const night=isNight(),R=String(role||'');let L;
  if(o.userData.race==='undead')L=['zIdle','zIdle','lookAround'];
  else if(kind==='guard')L=night?['torchIdle','lanternIdle','foldArms','shieldIdle']:['foldArms','shieldIdle','foldArms'];
  else if(/merchant|vendor|trader|shop|banker|broker/i.test(R))L=['foldArms','talk','nodYes','comlink'];
  else if(kind==='gather')L=['talk','nodYes','shakeNo','talk','comlink'];
  else if(kind==='rest')L=night?['lanternIdle','railLean']:['railLean','foldArms','comlink'];
  else if(/farm|harvest|miner|worker|labor/i.test(R))L=['harvest','watering','plantSeed','treeChop'];
  else L=['foldArms','comlink','lookAround'];
  L=L.filter(k=>C[k]);if(!L.length)return _ni(u,ai,dt,kind,role);
  ai.idleT=7+Math.random()*12;const k=L[Math.random()*L.length|0];toonLoopFor(o,k,EMOTE_LOOP[k]||4+Math.random()*5,.35)}}

/* ================= Ultimate Space Kit (Quaternius, CC0) + Kenney space skyboxes (CC0) =================
   Alien flora for the strange biomes, xeno creatures and war droids as wild life, nebula backdrops for space views. */
// alien trees: sized here (the kit models come at toy scale)
const ALIEN_TREE_H={glowcap:7,glowcap2:8,swirlwood:9,floatbloom:10,floatbloom2:11,emberpine:7,spinethorn:8,coilstalk:9,coilstalk2:10,blobpalm:6,blobpalm2:7};
// SWG planets that use these biomes: Crimsona (red), Scoria and Pyraxis (volcanic), Verdance/Vashtar (jungle), Veylara/Rhosmire/Verdance/Crimsona (swamp)
TREE_SPECIES.red=TREE_SPECIES.red.concat(['coilstalk','spinethorn']);TREE_SPECIES.jungle=TREE_SPECIES.jungle.concat(['glowcap','floatbloom']);TREE_SPECIES.swamp=TREE_SPECIES.swamp.concat(['blobpalm']);
Object.assign(TREE_SPECIES,{ethereal:['rainbow-eucalyptus','glowcap','floatbloom','swirlwood','glowcap2','floatbloom2'],volcanic:['quiver-tree','emberpine','emberpine'],
  glass:['spinethorn','coilstalk','quiver-tree','coilstalk2'],abyss:['mangrove','blobpalm','blobpalm2','tree-fern'],storm:['windswept-pine','common-juniper','spinethorn']});
{const _lt=loadTreeSpecies;loadTreeSpecies=function(id){const p=_lt(id);if(!ALIEN_TREE_H[id]||!p)return p;
  return p.then(()=>{const T=treeProto[id];if(!T||T._sized||!T.h)return;const k=ALIEN_TREE_H[id]/T.h,S=new THREE.Matrix4().makeScale(k,k,k);for(const q of T.parts)q.m.premultiply(S);T.h=ALIEN_TREE_H[id];T._sized=true})}}
// xeno life and stray war droids
Object.assign(ANIMAL_SPEC,{'xeno-brute':{h:2.6,herd:[1,2],prey:0},'xeno-wasp':{h:1.5,herd:[2,4],prey:0,fly:1.4},'xeno-mite':{h:.8,herd:[3,6],prey:1,fly:.4},'war-droid':{h:2.3,herd:[1,2],prey:0}});
ANIMALS.red=ANIMALS.red.concat(['xeno-brute','xeno-mite']);ANIMALS.swamp=ANIMALS.swamp.concat(['xeno-wasp']);
Object.assign(ANIMALS,{volcanic:['xeno-brute','xeno-mite'],glass:['alpaca','xeno-wasp','xeno-mite'],abyss:['wolf','xeno-brute','xeno-mite'],ethereal:['stag','horse-white','xeno-wasp'],
  storm:['wolf','fox','war-droid'],badlands:['alpaca','donkey','wolf','war-droid']});
// flyers hover a little above the ground (their clips already bob)
{const _ta=tickAnimals;tickAnimals=function(dt){_ta(dt);for(const h of herds){const S=ANIMAL_SPEC[h.id];if(!S||!S.fly)continue;for(const a of h.members)if(!a.dead)a.obj.position.y+=S.fly}}}

// nebula backdrops in the galaxy / system / planet views
const SPACE_SKY={galaxy:'kits/sky/space_galaxy.jpg',system:'kits/sky/space_nebula.jpg',planet:'kits/sky/space_nebula.jpg'},spaceSkyTex={};
function spaceSky(l){const url=SPACE_SKY[l];if(!url)return null;if(spaceSkyTex[url])return spaceSkyTex[url].ok?spaceSkyTex[url].t:null;
  const t=new THREE.TextureLoader().load(url,()=>{spaceSkyTex[url].ok=true;if(level===l)scene.background=t},undefined,()=>{});t.mapping=THREE.EquirectangularReflectionMapping;t.encoding=THREE.sRGBEncoding;spaceSkyTex[url]={t,ok:false};return null}
{const _sl=setLevel;setLevel=function(l){const r=_sl.apply(this,arguments);if(l!=='ground'){const t=spaceSky(l);if(t)scene.background=t}return r}}
/* ================= PBR pass: cartoon kits get physically based, roughened materials =================
   KayKit / Quaternius / toon-character / colony materials become MeshStandardMaterial with a world-space triplanar grunge
   layer: roughness breakup, fine grit and scratches as micro-bump, large-scale grime and colour drift so flat palette
   colours stop reading as plastic. A sky/ground environment map that follows the planet gives the reflections. Low quality
   keeps the old flat-lit look. */
const PBR={cache:new WeakMap(),mats:new Set(),envKey:'',envRT:null,on:()=>quality!=='low'};
// tileable detail texture: R = fine grit + scratches, G = large grime blotches, B = mid-frequency wear
const pbrNoiseTex=(()=>{const N=256,c=document.createElement('canvas');c.width=c.height=N;const x=c.getContext('2d'),img=x.createImageData(N,N),D=img.data;
  const rnd=(i,j,s)=>{let h=(i*374761393+j*668265263+s*982451653)|0;h=(h^(h>>>13))*1274126177|0;return((h^(h>>>16))>>>0)/4294967295};
  const vn=(u,v,P,s)=>{const x0=Math.floor(u),y0=Math.floor(v),fx=u-x0,fy=v-y0,sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy),w=a=>((a%P)+P)%P;
    const a=rnd(w(x0),w(y0),s),b=rnd(w(x0+1),w(y0),s),c2=rnd(w(x0),w(y0+1),s),d=rnd(w(x0+1),w(y0+1),s);return a+(b-a)*sx+(c2-a)*sy+(a-b-c2+d)*sx*sy};
  const fbm=(i,j,periods,s)=>{let t=0,a=.5,n=0;for(const P of periods){t+=vn(i/N*P,j/N*P,P,s)*a;n+=a;a*=.55}return t/n};
  const R=new Float32Array(N*N);
  for(let j=0;j<N;j++)for(let i=0;i<N;i++)R[j*N+i]=fbm(i,j,[8,16,32],1);
  // scratches: short random strokes, wrapped
  for(let k=0;k<60;k++){let px=rnd(k,1,7)*N,py=rnd(k,2,7)*N;const a=rnd(k,3,7)*Math.PI*2,L=10+rnd(k,4,7)*50,dep=.08+rnd(k,5,7)*.14;
    for(let s=0;s<L;s++){const ix=((Math.round(px+Math.cos(a)*s)%N)+N)%N,iy=((Math.round(py+Math.sin(a)*s)%N)+N)%N;R[iy*N+ix]=Math.max(0,R[iy*N+ix]-dep)}}
  for(let j=0;j<N;j++)for(let i=0;i<N;i++){const o=(j*N+i)*4;D[o]=R[j*N+i]*255;D[o+1]=Math.pow(fbm(i,j,[4,8,16],2),1.4)*255*1.25;D[o+2]=fbm(i,j,[16,32],3)*255;D[o+3]=255}
  x.putImageData(img,0,0);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;return t})();
const PBR_U={uPbrNoise:{value:pbrNoiseTex},uSurfND:{value:null},uSurfR:{value:null}};
// Poly Haven CC0 surface atlas (3x2 tiles): plaster, clay roof, concrete/stone, metal plate, rusty metal, wood planks.
// RGB = normal x, normal y, albedo detail; the second image is roughness. Sampled with box mapping in world space and
// explicit gradients so tile edges don't seam. WebGL2 only; WebGL1 keeps the procedural layer.
const PBR_REAL=renderer.capabilities.isWebGL2;
function pbrAtlas(url){const t=new THREE.TextureLoader().load(url);t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return t}
if(PBR_REAL){PBR_U.uSurfND.value=pbrAtlas('kits/pbr/surface_nd.jpg');PBR_U.uSurfR.value=pbrAtlas('kits/pbr/surface_r.jpg')}
const PBR_CLASS_GLSL={kit: `vec3 bc=diffuseColor.rgb;float lum=dot(bc,vec3(.299,.587,.114)),mxc=max(bc.r,max(bc.g,bc.b)),sat=(mxc-min(bc.r,min(bc.g,bc.b)))/max(mxc,1e-3);\n        bool slope=an.y>.3&&an.y<.97;bool reddish=bc.r>bc.g*1.25&&bc.r>bc.b*1.5&&sat>.35;bool brown=bc.r>=bc.g&&bc.g>=bc.b*.9&&sat>.2&&lum<.42;\n        int stI=(slope||(reddish&&an.y>.2))?1:brown?5:(lum>.48&&sat<.32)?0:2;float ts=stI==1?.7:stI==5?.5:stI==0?.45:.5;`, metal: `int stI=pbrGrime<.32?4:3;float ts=.6;`, gun: `int stI=3;float ts=4.;`};
const PBR_SURF_GLSL=`uniform sampler2D uSurfND,uSurfR;
  vec4 pbrSurf(int t,vec2 p,out vec4 nd){vec2 off=vec2(float(t%3)/3.,float(t/3)/2.),sz=vec2(1./3.,.5)*.96;vec2 uv=off+vec2(1./3.,.5)*.02+fract(p)*sz;
    vec2 gx=dFdx(p)*sz,gy=dFdy(p)*sz;nd=textureGrad(uSurfND,uv,gx,gy);return textureGrad(uSurfR,uv,gx,gy);}`;
function pbrInject(m,o,src){const prev=src&&src.onBeforeCompile!==THREE.Material.prototype.onBeforeCompile?src.onBeforeCompile:null,prevKey=prev&&src.customProgramCacheKey?src.customProgramCacheKey():'';
  m.extensions=Object.assign(m.extensions||{},{derivatives:true});
  const sc=o.scale||1.6,bump=o.bump??1,rough=o.roughVar??.42,grime=o.grime??.24,surf=PBR_REAL&&o.surf?o.surf:'';
  m.onBeforeCompile=sh=>{if(prev)prev(sh);sh.uniforms.uPbrNoise=PBR_U.uPbrNoise;if(surf){sh.uniforms.uSurfND=PBR_U.uSurfND;sh.uniforms.uSurfR=PBR_U.uSurfR}
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vPbrP;varying vec3 vPbrN;').replace('#include <project_vertex>',`#include <project_vertex>
      vec4 pbrW=vec4(transformed,1.);vec3 pbrN=objectNormal;
      #ifdef USE_INSTANCING
      pbrW=instanceMatrix*pbrW;pbrN=mat3(instanceMatrix)*pbrN;
      #endif
      pbrW=modelMatrix*pbrW;vPbrP=pbrW.xyz;vPbrN=normalize(mat3(modelMatrix)*pbrN);`);
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>',`#include <common>
      varying vec3 vPbrP;varying vec3 vPbrN;uniform sampler2D uPbrNoise;
      vec3 pbrTri(vec3 p,vec3 n){vec3 w=pow(abs(n),vec3(4.));w/=max(1e-4,w.x+w.y+w.z);return texture2D(uPbrNoise,p.zy).rgb*w.x+texture2D(uPbrNoise,p.xz).rgb*w.y+texture2D(uPbrNoise,p.xy).rgb*w.z;}
      ${surf?PBR_SURF_GLSL:''}`)
      .replace('#include <map_fragment>',`#include <map_fragment>
      vec3 pbrA=pbrTri(vPbrP*${(sc/4).toFixed(3)},vPbrN),pbrB=pbrTri(vPbrP*${(sc/40).toFixed(4)},vPbrN);float pbrGrime=clamp(pbrB.g,0.,1.);
      ${surf?`vec3 an=abs(vPbrN);vec2 sp;vec3 sT,sB;if(an.y>an.x&&an.y>an.z){sp=vPbrP.xz;sT=vec3(1.,0.,0.);sB=vec3(0.,0.,1.);}else if(an.x>an.z){sp=vPbrP.zy;sT=vec3(0.,0.,1.);sB=vec3(0.,1.,0.);}else{sp=vPbrP.xy;sT=vec3(1.,0.,0.);sB=vec3(0.,1.,0.);}
        ${PBR_CLASS_GLSL[surf]}vec4 sND;vec4 sR=pbrSurf(stI,sp*ts,sND);diffuseColor.rgb*=mix(1.,.5+sND.b,.55);float sRough=sR.r;
        vec3 sn=vec3(sND.rg*2.-1.,0.);sn.z=sqrt(max(0.,1.-dot(sn.xy,sn.xy)));vec3 sNw=normalize(sT*sn.x*1.2+sB*sn.y*1.2+vPbrN*sn.z);`:''}
      diffuseColor.rgb*=mix(1.-${grime.toFixed(2)},1.05,pbrGrime)*mix(.9,1.05,pbrA.r)*mix(.96,1.03,pbrB.b);`)
      .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
      ${surf?'roughnessFactor=mix(roughnessFactor,sRough,.75);':''}
      roughnessFactor=clamp(roughnessFactor+(pbrA.b-.5)*${rough.toFixed(2)}+(.5-pbrGrime)*.18+(1.-pbrA.r)*.12,.3,1.);`)
      .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
      ${surf?'{vec3 sNv=normalize((viewMatrix*vec4(sNw,0.)).xyz);if(dot(sNv,normal)>.2)normal=normalize(mix(normal,sNv,.85));}':''}
      {float pbrH=pbrA.r*.75+pbrA.b*.25;vec2 dH=vec2(dFdx(pbrH),dFdy(pbrH));dH*=${(bump*.35).toFixed(3)}/(1.+length(dH)*40.);
       vec3 sX=dFdx(-vViewPosition),sY=dFdy(-vViewPosition),R1=cross(sY,normal),R2=cross(normal,sX);float fD=dot(sX,R1);
       if(abs(fD)>1e-12){vec3 gr=sign(fD)*(dH.x*R1+dH.y*R2);vec3 nb=abs(fD)*normal-gr;float L2=dot(nb,nb);if(L2>1e-20){nb*=inversesqrt(L2);if(dot(nb,normal)>.5)normal=nb;}}}`)};
  m.customProgramCacheKey=()=>prevKey+'pbr'+sc+'|'+bump+'|'+rough+'|'+grime+'|'+surf;return m}
// one PBR copy per source material and look
function pbrMat(src,o={}){if(!src||Array.isArray(src))return src;if(src.isShaderMaterial||src.isMeshBasicMaterial||src.isPointsMaterial||src.isLineBasicMaterial||src.isSpriteMaterial||src.userData.pbr)return src;
  const kk=o.kind||'kit';let byKind=PBR.cache.get(src);if(!byKind)PBR.cache.set(src,byKind={});if(byKind[kk])return byKind[kk];
  const em=src.emissive?src.emissive.clone():new THREE.Color(0,0,0),toon=kk==='toon';
  // toon characters were lit by a 50% emissive copy of their texture; keep a little of that so faces don't go muddy
  if(toon)em.multiplyScalar(.32);
  const m=new THREE.MeshStandardMaterial({map:src.map||null,color:src.color?src.color.clone():new THREE.Color(1,1,1),vertexColors:!!src.vertexColors,
    emissive:em,emissiveMap:src.emissiveMap||null,normalMap:src.normalMap||null,aoMap:src.aoMap||null,transparent:!!src.transparent,opacity:src.opacity??1,alphaTest:src.alphaTest||0,side:src.side,
    roughness:o.rough??.86,metalness:o.metal??.03,envMapIntensity:.7});
  if(toon)m.color.setScalar(1);
  m.userData.pbr=true;if(src.userData&&src.userData.atlas){m.userData.atlas=src.userData.atlas;hullMats.push(m);if(!m.map&&COLONY_ATLAS[src.userData.atlas]){m.map=COLONY_ATLAS[src.userData.atlas];m.color.lerp(new THREE.Color(1,1,1),.75)}}pbrInject(m,o,src);byKind[kk]=m;PBR.mats.add(m);return m}
const PBR_LOOK={kit:{rough:.88,metal:.02,scale:1.2,surf:'kit'},scifi:{rough:.6,metal:.32,scale:1.6,surf:'metal',roughVar:.5,grime:.3},toon:{rough:.78,metal:.04,scale:3,bump:.35,grime:.05,roughVar:.3},
  creature:{rough:.7,metal:.05,scale:2.5,bump:.8,grime:.18},droid:{rough:.5,metal:.45,scale:2.5,grime:.22},gun:{rough:.42,metal:.55,scale:5,surf:'gun',bump:.6,grime:.2}};
const pbrKindFor=name=>/^(col_|sk_|skt_|mk_)/.test(name)?'scifi':'kit';
function pbrTree(obj,kind){if(!PBR.on()||!obj)return obj;const o=Object.assign({kind},PBR_LOOK[kind]);
  obj.traverse(n=>{if(!n.isMesh||n.userData.noPbr)return;o.skinned=!!n.isSkinnedMesh;n.material=Array.isArray(n.material)?n.material.map(x=>pbrMat(x,o)):pbrMat(n.material,o)});return obj}
// kit and pack pieces (KayKit, Quaternius, colony, Mars)
function pbrProto(name,P){if(!PBR.on()||!P||!P.parts||P._pbr)return P;const kind=pbrKindFor(name),o=Object.assign({kind},PBR_LOOK[kind]);
  for(const p of P.parts)p.mat=Array.isArray(p.mat)?p.mat.map(x=>pbrMat(x,o)):pbrMat(p.mat,o);P._pbr=true;return P}
{const _kp=kitProto;kitProto=function(name,g){return pbrProto(name,_kp(name,g))}}
for(const k of Object.keys(kitProtoCache))pbrProto(k,kitProtoCache[k]);
// characters and NPCs, mounts and carts, wildlife, guns
{const _wm=warlordModel;warlordModel=function(o,opts){return pbrTree(_wm(o,opts),'toon')}}
{const _mm=makeMountObj;makeMountObj=function(id){return pbrTree(_mm(id),'creature')}}
{const _ma=makeAnimal;makeAnimal=function(id){const a=_ma(id);if(a)pbrTree(a.obj,id==='war-droid'?'droid':'creature');return a}}
{const _lg=loadGun;loadGun=function(id){return _lg(id).then(p=>{if(!p._pbr){pbrTree(p,'gun');p._pbr=true}return p})}}

// environment: sky above, the planet's ground below, rebuilt per planet; reflections dim at night
const pbrEnvScene=new THREE.Scene(),pbrEnvMat=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{top:{value:new THREE.Color()},hor:{value:new THREE.Color()},bot:{value:new THREE.Color()}},
  vertexShader:'varying vec3 vD;void main(){vD=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:'uniform vec3 top,hor,bot;varying vec3 vD;void main(){float y=vD.y;vec3 c=y>0.?mix(hor,top,pow(y,.6)):mix(hor,bot,pow(-y,.4));gl_FragColor=linearToOutputTexel(vec4(c,1.));}'});
pbrEnvScene.add(new THREE.Mesh(new THREE.SphereGeometry(10,32,16),pbrEnvMat));
{const sun=new THREE.Mesh(new THREE.SphereGeometry(.9,12,8),new THREE.MeshBasicMaterial({color:0xfff2d0}));sun.position.set(5,6,3);pbrEnvScene.add(sun)}
let pbrPMREM=null;
function pbrEnv(){const w=groundWorld;if(!w||!PBR.on())return;const key=w.id+'|'+(w.biome&&w.biome.sky);if(PBR.envKey===key&&PBR.envRT){scene.environment=PBR.envRT.texture;return}
  PBR.envKey=key;const sky=col((w.biome&&w.biome.sky)||'#8fb4d8'),g=col((w.biome&&(w.biome.ground||w.biome.soil))||'#6b5a44');
  pbrEnvMat.uniforms.top.value.copy(sky).multiplyScalar(.9);pbrEnvMat.uniforms.hor.value.copy(sky).lerp(new THREE.Color(1,1,1),.45);pbrEnvMat.uniforms.bot.value.copy(g).multiplyScalar(.55);
  try{pbrPMREM=pbrPMREM||new THREE.PMREMGenerator(renderer);if(PBR.envRT)PBR.envRT.dispose();PBR.envRT=pbrPMREM.fromScene(pbrEnvScene,.02);scene.environment=PBR.envRT.texture}catch(e){console.warn('pbr env',e)}}
{const _sl=setLevel;setLevel=function(l){const r=_sl.apply(this,arguments);if(l==='ground')pbrEnv();else scene.environment=null;return r}}
let pbrT=0,pbrNight=null;
{const _gt=gameTick;gameTick=function(dt){_gt(dt);if((pbrT-=dt)>0)return;pbrT=1;if(level==='ground'&&groundWorld&&PBR.envKey.split('|')[0]!==groundWorld.id)pbrEnv();
  const n=isNight();if(n===pbrNight)return;pbrNight=n;const k=n?.22:.7;for(const m of PBR.mats)m.envMapIntensity=k*(m.userData.envK||1)}}

// terrain: Poly Haven CC0 ground normals + roughness (sand, rocky ground, forest floor, snow, mud, mountainside, rock face)
// on the planet's dominant biome, rock face on steep slopes. Lambert terrain becomes physically based on Medium/High.
const GROUND_TILE={desert:0,tropical:0,glass:6,badlands:1,red:1,storm:1,grass:2,temperate:2,forest:2,ethereal:2,jungle:4,swamp:4,abyss:4,ice:3,volcanic:6};
const PBR_GROUND=PBR_REAL?pbrAtlas('kits/pbr/ground_nr.jpg'):null;
{const _gm=groundMaterial;groundMaterial=function(w,geo,pa){const m0=_gm(w,geo,pa);if(!PBR.on()||!PBR_GROUND)return m0;
  const B=planetBiomes(w).slice(0,4),tiles=[0,1,2,3].map(k=>GROUND_TILE[(B[k]||B[0]).key]??1);
  const m=new THREE.MeshStandardMaterial({vertexColors:true,map:m0.map,color:m0.color.clone().multiplyScalar(.92),roughness:.95,metalness:0,envMapIntensity:.12});m.userData.envK=.17;m.extensions={derivatives:true};
  const prev=m0.onBeforeCompile;m.userData.pbr=true;PBR.mats.add(m);
  m.onBeforeCompile=sh=>{prev(sh);sh.uniforms.uGround={value:PBR_GROUND};sh.uniforms.uGT={value:new THREE.Vector4(...tiles)};
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>',`#include <common>
      uniform sampler2D uGround;uniform vec4 uGT;
      vec3 gTile(float t,vec2 p){vec2 off=vec2(mod(t,4.)/4.,floor(t/4.)/2.),sz=vec2(.25,.5)*.96;vec2 uv=off+vec2(.25,.5)*.02+fract(p)*sz;return textureGrad(uGround,uv,dFdx(p)*sz,dFdy(p)*sz).rgb;}`)
      .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
      vec3 gWN=inverseTransformDirection(normal,viewMatrix);float gFar=1.-smoothstep(60.,260.,vGD);
      float gb=vBw.x;float gt=uGT.x;if(vBw.y>gb){gb=vBw.y;gt=uGT.y;}if(vBw.z>gb){gb=vBw.z;gt=uGT.z;}if(vBw.w>gb){gb=vBw.w;gt=uGT.w;}
      float steep=smoothstep(.86,.7,gWN.y);vec2 gp=vGX/3.2;vec3 gA=gTile(gt,gp);vec3 gC=gTile(5.,gp*.6);vec3 gS=mix(gA,gC,steep);
      roughnessFactor=mix(.95,mix(.75,1.,gS.b),gFar);
      {vec3 gn=vec3(gS.rg*2.-1.,0.);gn.xy*=gFar*1.3;gn.z=sqrt(max(.05,1.-dot(gn.xy,gn.xy)));vec3 T=normalize(vec3(1.,0.,0.)-gWN*gWN.x),Bt=normalize(cross(T,gWN));
       vec3 nw=normalize(T*gn.x-Bt*gn.y+gWN*gn.z);normal=normalize((viewMatrix*vec4(nw,0.)).xyz);}`)};
  m.customProgramCacheKey=()=>'pbrground';m0.dispose();return m}}
/* ================= Resource nodes: SWG planet resources you can see and gather by hand =================
   Nodes are placed deterministically from the planet seed and the resource concentration maps, so every player sees
   the same nodes without a server. Each node belongs to one of the planet's current resources, sits where that resource
   is rich (40%+), and holds a limited amount; gathering depletes it and it regrows after a while. Depletion is shared over
   the multiplayer room when there is one. Models: Poly Haven scanned boulders (CC0) for minerals, lichen rock for
   chemicals, mossy rocks for water and gas vents, Quaternius plants (CC0) for flora; all sized to real-world heights. */
const NODE_CELL=96,NODE_R=360,NODE_MIN_C=40,NODE_REGROW=15*60e3;
// resource type -> look: models, target height (m), gather clip, tint/glow, ambient effect
const NODE_KIND={
  6:{name:'Mineral deposit',m:['nd_boulder_a','nd_boulder_b','nd_boulder_c'],h:[1.3,2.1],clip:'treeChop',verb:'Mining'},
  2:{name:'Chemical seep',m:['nd_crystal','nd_crystal','nd_boulder_b'],h:[1.1,1.7],clip:'fixing',verb:'Extracting',glow:'#6dffb0'},
  3:{name:'Flora patch',m:['nd_plant_a','nd_plant_b','nd_bush'],h:[.9,1.4],clip:'harvest',verb:'Harvesting'},
  4:{name:'Gas vent',m:['nd_mossy'],h:[.7,1],clip:'fixing',verb:'Siphoning',fx:'#cfd6dc'},
  5:{name:'Geothermal vent',m:['nd_mossy'],h:[.7,1],clip:'fixing',verb:'Tapping',fx:'#ffb070',glow:'#ff7a30'},
  7:{name:'Spring',m:['nd_mossy'],h:[.6,.9],clip:'fixing',verb:'Collecting',water:true}};
const NODE_PROTO={};let nodeLoad=null;
function loadNodes(){if(nodeLoad)return nodeLoad;
  return nodeLoad=loadScript('kits/nodes/nodes.js').then(()=>new Promise(res=>{const b64=window.GRUDGE_NODES;if(!b64)return res();const bin=atob(b64),buf=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)buf[i]=bin.charCodeAt(i);delete window.GRUDGE_NODES;
    new THREE.GLTFLoader().parse(buf.buffer,'',g=>{g.scene.updateMatrixWorld(true);for(const n of g.scene.children){if(!/^nd_/.test(n.name))continue;
      // normalise: base on the ground, centred, unit height; real size is applied per node
      const box=new THREE.Box3().setFromObject(n),c=box.getCenter(new THREE.Vector3()),h=Math.max(1e-3,box.max.y-box.min.y),wrap=new THREE.Group(),inner=n.clone(true);
      inner.position.sub(new THREE.Vector3(c.x,box.min.y,c.z));inner.position.divideScalar(h);inner.scale.multiplyScalar(1/h);wrap.add(inner);
      wrap.traverse(o=>{if(o.isMesh){o.castShadow=false;const m=o.material;if(m&&m.isMeshStandardMaterial){m.envMapIntensity=.6;if(m.map)m.map.encoding=THREE.LinearEncoding;PBR.mats&&PBR.mats.add(m)}}});
      if(/plant|bush/.test(n.name))pbrTree(wrap,'creature');NODE_PROTO[n.name]=wrap}res()},e=>{console.warn('nodes',e);res()})})).catch(e=>console.warn('nodes',e))}
const nodeG=new THREE.Group();G.ground.add(nodeG);
const nodeLive=new Map(),nodeState=new Map();let nodeT=0,nodeWorld=null,gather=null,nodeNear=null,nodeHooked=false;
// deterministic candidates for one map cell
function nodeCell(w,cx,cz){const R=mulberry(strHash(w.id+':node:'+cx+','+cz)),out=[],res=planetRes().filter(r=>NODE_KIND[r.t]);if(!res.length)return out;
  const n=R()<.55?1:R()<.5?2:0;
  for(let i=0;i<n;i++){const x=(cx+R())*NODE_CELL,z=(cz+R())*NODE_CELL;if(Math.abs(x)>HALF*.97||Math.abs(z)>HALF*.97)continue;
    if(w.pois.some(q=>Math.hypot(q.x-x,q.z-z)<q.r+40))continue;const wd=waterDepth(w,x,z);
    // pick a resource type first (so minerals, flora, vents and springs all show up), then the richest resource of it
    const byT={};for(const r of res){if(wd>.4||(r.t===7&&!(surfAt(x,z,'water')>.08)))continue;const c=concentration(r,x,z);if(c<NODE_MIN_C)continue;const q=byT[r.t];if(!q||c>q.c)byT[r.t]={r,c}}
    const ts=Object.keys(byT);if(!ts.length)continue;const pick=byT[ts[Math.floor(R()*ts.length)]],best=pick.r,bc=pick.c;const K=NODE_KIND[best.t],mi=Math.floor(R()*K.m.length),h=K.h[0]+R()*(K.h[1]-K.h[0]);
    out.push({id:w.id+':'+cx+','+cz+':'+i,r:best,c:bc,x,z,kind:best.t,model:K.m[mi],h,yaw:R()*TAU,cap:Math.round(30+bc*.9)})}
  return out}
function nodeLeft(n){const s=nodeState.get(n.id);if(!s)return n.cap;if(s.left<=0&&Date.now()>s.until){nodeState.delete(n.id);return n.cap}return s.left}
function nodeMesh(n){const P=NODE_PROTO[n.model];if(!P)return null;const o=P.clone(true),K=NODE_KIND[n.kind];o.scale.setScalar(n.h);o.rotation.y=n.yaw;
  o.position.set(n.x,groundH(groundWorld,n.x,n.z)-.08*n.h,-n.z);o.userData.node=n;
  if(K.glow)o.traverse(m=>{if(m.isMesh){m.material=m.material.clone();m.material.userData.own=true;m.material.emissive=new THREE.Color(K.glow).multiplyScalar(.35)}});
  if(K.water){const d=new THREE.Mesh(new THREE.CircleGeometry(n.h*1.6,20),new THREE.MeshStandardMaterial({color:0x2a5a78,roughness:.05,metalness:.1,transparent:true,opacity:.78}));
    d.userData.own=true;d.material.userData.own=true;d.rotation.x=-Math.PI/2;d.position.y=.06;d.scale.setScalar(1/n.h);o.add(d)}
  return o}
function nodeDispose(o){o.traverse(m=>{if(!m.isMesh)return;if(m.userData.own)m.geometry.dispose();if(m.material&&m.material.userData.own)m.material.dispose()})}
function nodesClear(){for(const o of nodeLive.values()){nodeG.remove(o);nodeDispose(o)}nodeLive.clear()}
function tickNodes(dt){const w=groundWorld,on=level==='ground'&&w&&groundMode==='play'&&CH;nodeG.visible=!!on;if(!on)return;
  if(nodeWorld!==w){nodesClear();nodeWorld=w;gather=null}
  if(!nodeHooked&&typeof room!=='undefined'&&room){nodeHooked=true;room.on('node',m=>{const d=m.data||{};if(typeof d.id!=='string'||typeof d.left!=='number')return;nodeState.set(d.id,{left:d.left,until:d.until||Date.now()+NODE_REGROW})})}
  if((nodeT-=dt)<=0){nodeT=1.5;loadNodes();if(Object.keys(NODE_PROTO).length){
    const want=new Set(),c0x=Math.floor((play.x-NODE_R)/NODE_CELL),c1x=Math.floor((play.x+NODE_R)/NODE_CELL),c0z=Math.floor((play.z-NODE_R)/NODE_CELL),c1z=Math.floor((play.z+NODE_R)/NODE_CELL);
    w._nodeCells=w._nodeCells||new Map();
    for(let cx=c0x;cx<=c1x;cx++)for(let cz=c0z;cz<=c1z;cz++){const k=cx+','+cz;let L=w._nodeCells.get(k);if(!L){L=nodeCell(w,cx,cz);w._nodeCells.set(k,L)}
      for(const n of L){if(Math.hypot(n.x-play.x,n.z-play.z)>NODE_R||nodeLeft(n)<=0)continue;want.add(n.id);if(!nodeLive.has(n.id)){const o=nodeMesh(n);if(o){nodeG.add(o);nodeLive.set(n.id,o)}}}}
    for(const [id,o] of nodeLive)if(!want.has(id)){nodeG.remove(o);nodeDispose(o);nodeLive.delete(id)}}}
  // ambient effects and the nearest node
  nodeNear=null;let nd=4.2;for(const o of nodeLive.values()){const n=o.userData.node,d=Math.hypot(n.x-play.x,n.z-play.z);if(d<nd){nd=d;nodeNear=n}
    const K=NODE_KIND[n.kind];if(K.fx&&d<120&&Math.random()<dt*3)vfxEmit('auras',n.x,groundH(groundWorld,n.x,n.z)+n.h*.6,n.z,2,{color:K.fx,scale:1.6,r:.3})}
  const tip=$('#nodeTip');if(tip){const show=nodeNear&&!gather;tip.hidden=!show;if(show){const K=NODE_KIND[nodeNear.kind];tip.textContent=`R · ${K.name}: ${nodeNear.r.n} (${nodeNear.r.c||''}) · ${nodeNear.c}% · ${nodeLeft(nodeNear)} left`}}
  if(gather)tickGather(dt)}
function startGather(){if(gather||!nodeNear)return;const n=nodeNear,K=NODE_KIND[n.kind];if(nodeLeft(n)<=0)return floatMsg('This node is spent. It will regrow.');
  if(combat.p)return toast('You cannot gather while fighting.');
  if((n.kind===6||n.kind===2)&&!CH.inv.items.some(i=>i.kind==='tool'))return toast('You need a Survey Device to work this deposit (buy one at a market).');
  gather={n,t:0,x:play.x,z:play.z};floatMsg(`${K.verb} ${n.r.n}… (move to stop)`);
  if(play.model&&play.model.userData.mixer&&typeof toonLoopFor==='function')toonLoopFor(play.model,K.clip,1e9);}
function stopGather(msg){if(!gather)return;gather=null;if(msg)floatMsg(msg);if(typeof actStop==='function')actStop()}
function tickGather(dt){const g=gather;if(Math.hypot(play.x-g.x,play.z-g.z)>1.5)return stopGather('You moved, so gathering stopped');
  g.t+=dt;if(g.t<3)return;g.t=0;const n=g.n,m=skillMods(CH);let left=nodeLeft(n);if(left<=0)return stopGather('The node is spent.');
  let units=Math.max(1,Math.round(n.c/12*(1+(m.survey||0)/40)*(1+Math.random()*.8)));if(Math.random()<.06){units*=2;floatMsg('A rich pocket!')}
  units=Math.min(units,left);left-=units;addRes(n.r,units);gainXP('surveying',Math.round(4+n.c/8),'');floatMsg(`+${units} ${n.r.n}`);
  vfxEmit('impacts',n.x,groundH(groundWorld,n.x,n.z)+n.h*.5,n.z,6,{color:NODE_KIND[n.kind].glow||'#d8c8a8',scale:.6});
  const st={left,until:left<=0?Date.now()+NODE_REGROW:0};nodeState.set(n.id,st);if(typeof room!=='undefined'&&room)room.emit('node',{id:n.id,left,until:st.until}).catch(()=>{});
  if(left<=0){const o=nodeLive.get(n.id);if(o){nodeG.remove(o);nodeDispose(o);nodeLive.delete(n.id)}stopGather(`You exhausted the ${NODE_KIND[n.kind].name.toLowerCase()}.`)}}
// R gathers; the prompt sits above the action bar
{const t=document.createElement('div');t.id='nodeTip';t.hidden=true;t.style.cssText='position:fixed;left:50%;bottom:150px;transform:translateX(-50%);padding:6px 12px;border-radius:6px;background:rgba(12,14,18,.82);color:#f1e6c8;font:600 13px system-ui,sans-serif;border:1px solid rgba(240,200,120,.45);pointer-events:none;z-index:30';document.body.append(t)}
addEventListener('keydown',e=>{if(/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||e.repeat)return;if(e.key.toLowerCase()!=='r'||level!=='ground'||groundMode!=='play'||!CH)return;if(gather)stopGather('Stopped gathering.');else startGather()});
{const _gt=gameTick;gameTick=function(dt){_gt(dt);tickNodes(dt)}}
{const _xp=exitPlay;exitPlay=function(){gather=null;nodesClear();const t=$('#nodeTip');if(t)t.hidden=true;return _xp.apply(this,arguments)}}

/* ================= Glow whales v2 and the light-speed jump =================
   The whale is Quaternius's animated humpback (Animated Fish Pack, CC0) wearing the galactic glow-whale look: deep-space
   hide, fresnel glow, travelling light bands and star freckles. A hinge in the vertex shader opens its jaw (no jaw bone
   needed), and the inside of the mouth glows with the charge.
   Every starport keeps a whale docked overhead with a boarding beam under its open mouth: stand in the beam and press R.
   The departure is a cutscene (you rise into the mouth, the jaw closes, the whale charges, a rippling see-through portal
   opens and the whale blasts through). A hyperspace screen covers the load (CSS animation, so it keeps moving while the
   next planet builds), then the arrival plays in reverse at the destination port. */
const WHALE_COL={hide:col('#0e2347'),belly:col('#4fa9c9'),glow:col('#7ff6ff'),spot:col('#c58bff'),maw:col('#b05cff')};
let whaleProto=null,whaleLoadP=null;
function loadWhale(){if(whaleLoadP)return whaleLoadP;
  return whaleLoadP=loadScript('kits/whale.js').then(()=>new Promise(res=>{const b64=window.GRUDGE_WHALE;if(!b64)return res();const bin=atob(b64),buf=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)buf[i]=bin.charCodeAt(i);delete window.GRUDGE_WHALE;
    new THREE.GLTFLoader().parse(buf.buffer,'',g=>{const sc=g.scene;sc.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(sc),len=box.max.z-box.min.z,c=box.getCenter(new V3());
      // jaw: vertices in the front 22% of the body and below the mouth line swing down around a hinge at the corner of the mouth
      const hingeZ=box.max.z-len*.2,mouthY=box.min.y+(box.max.y-box.min.y)*.66,inv=new THREE.Matrix4();
      sc.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position,n=p.count,a=new Float32Array(n),v=new V3();
        for(let i=0;i<n;i++){v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);const fz=(v.z-hingeZ)/(box.max.z-hingeZ),fy=(mouthY-v.y)/(mouthY-box.min.y);a[i]=fz>0&&fy>0?Math.min(1,fz*4)*Math.min(1,fy*6):0}
        o.geometry.setAttribute('aJaw',new THREE.BufferAttribute(a,1));inv.copy(o.matrixWorld).invert();
        o.userData.hp=new V3(c.x,mouthY,hingeZ).applyMatrix4(inv);o.userData.ha=new V3(1,0,0).transformDirection(inv).normalize();o.userData.belly=/bottom/i.test([].concat(o.material)[0].name||'')});
      whaleProto={scene:sc,clips:g.animations,len,c,minY:box.min.y,maxY:box.max.y,maxZ:box.max.z};res();upgradeWhales()},e=>{console.warn('whale',e);res()})})).catch(e=>console.warn('whale',e))}
function whaleSkinMat(src,U,belly){const m=new THREE.MeshStandardMaterial({color:belly?WHALE_COL.belly:WHALE_COL.hide,roughness:.38,metalness:.15,side:THREE.DoubleSide,envMapIntensity:.8});
  m.onBeforeCompile=sh=>{Object.assign(sh.uniforms,{wT:U.t,wJaw:U.jaw,wCharge:U.charge,wHP:{value:src.userData.hp},wHA:{value:src.userData.ha},wGlow:{value:WHALE_COL.glow},wSpot:{value:WHALE_COL.spot},wMaw:{value:WHALE_COL.maw}});
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute float aJaw;uniform float wJaw;uniform vec3 wHP,wHA;varying vec3 vWO;varying float vJaw;')
      .replace('#include <begin_vertex>',`#include <begin_vertex>
        vWO=position;vJaw=aJaw;if(aJaw>0.){float a=wJaw*aJaw;vec3 d=transformed-wHP;vec3 k=wHA;transformed=wHP+d*cos(a)+cross(k,d)*sin(a)+k*dot(k,d)*(1.-cos(a));}`);
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform float wT,wCharge;uniform vec3 wGlow,wSpot,wMaw;varying vec3 vWO;varying float vJaw;')
      .replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
        {vec3 nv=normalize(vNormal);float fr=pow(1.-abs(dot(nv,normalize(vViewPosition))),2.2);float L=vWO.z*.004;
         float bands=smoothstep(.82,1.,sin(L*42.-wT*3.));float dots=step(.94,fract(sin(dot(floor(vWO.xz*.06),vec2(12.9898,78.233)))*43758.5453));
         totalEmissiveRadiance+=wGlow*(fr*(1.1+wCharge*2.2)+bands*.45*(1.+wCharge*3.))+wSpot*dots*(.5+.5*sin(wT*2.+L*20.));
         if(!gl_FrontFacing)totalEmissiveRadiance+=wMaw*(.6+wCharge*2.5)*(.6+.4*sin(wT*5.));}`)};
  m.customProgramCacheKey=()=>'whale2'+(belly?'b':'t');return m}
// same interface as the old procedural whale (userData.mat.uniforms.t, trail, hist), plus a jaw and a charge
{const _mw=makeWhale;makeWhale=function(){const g=_mw();if(!whaleProto||!THREE.SkeletonUtils)return g;
  for(const ch of [...g.children])if(ch.isMesh)g.remove(ch);
  const U={t:g.userData.mat.uniforms.t,jaw:{value:0},charge:{value:0}},P=whaleProto,inner=THREE.SkeletonUtils.clone(P.scene),wrap=new THREE.Group();
  inner.position.set(-P.c.x,-P.c.y,-P.c.z);wrap.add(inner);wrap.scale.setScalar(1/P.len);g.add(wrap);
  inner.traverse(o=>{if(o.isMesh){o.material=whaleSkinMat(o,U,o.userData.belly);o.frustumCulled=false}});
  const mixer=new THREE.AnimationMixer(inner);if(P.clips[0]){const a=mixer.clipAction(P.clips[0]);a.play();a.time=Math.random()*2}
  Object.assign(g.userData,{U,mixer,v2:true,mouth:new V3(0,((P.minY+(P.maxY-P.minY)*.62)-P.c.y)/P.len,(P.maxZ-P.c.z)/P.len*.95)});return g}}
{const _wt=whaleTick;whaleTick=function(w,dt,parent){_wt(w,dt,parent);const u=w.userData;if(u.mixer)u.mixer.update(dt*(1+u.U.charge.value*1.5))}}
// swap the whales already in the sky once the model is in
function upgradeWhales(){for(const a of ambientWhales){const s=a.w.scale.x,p=a.w.parent;if(p)p.remove(a.w);if(a.w.userData.trail.parent)a.w.userData.trail.parent.remove(a.w.userData.trail);a.w=makeWhale();a.w.scale.setScalar(s);if(p)p.add(a.w)}
  if(systemWhale&&systemWhale.parent){systemWhale.parent.remove(systemWhale);if(systemWhale.userData.trail.parent)systemWhale.userData.trail.parent.remove(systemWhale.userData.trail)}systemWhale=null;
  for(const s of starportWhales){const sc=s.w.scale.x;if(s.w.parent)s.w.parent.remove(s.w);if(s.w.userData.trail.parent)s.w.userData.trail.parent.remove(s.w.userData.trail);s.w=makeWhale();s.w.scale.setScalar(sc);G.ground.add(s.w)}
  if(groundWorld&&level==='ground')buildDocks(groundWorld)}
loadWhale();

/* ---- docked whales: one per starport, mouth open over a boarding beam ---- */
const DOCK_L=46,DOCK_OFF=70,DOCK_ALT=20;let docks=[],docksWorld=null;
const beamMat=()=>new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,uniforms:{t:{value:0},k:{value:1}},
  vertexShader:'varying vec2 vU;void main(){vU=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:'uniform float t,k;varying vec2 vU;void main(){float s=sin(vU.y*40.-t*6.)*.5+.5;float e=pow(1.-abs(vU.x*2.-1.),.6);gl_FragColor=vec4(vec3(.45,.95,1.)*(.12+.32*s)*e*k,1.);}'});
function dockPose(d,t){const w=d.w;w.position.copy(d.P);w.position.y+=Math.sin(t*.6+d.ph)*.8;w.lookAt(d.look.x,w.position.y,d.look.z)}
function clearDocks(){for(const d of docks){for(const o of [d.w,d.beam,d.w.userData.trail])if(o&&o.parent)o.parent.remove(o);d.beam.geometry.dispose();d.beam.material.dispose()}docks=[]}
function buildDocks(w){clearDocks();docksWorld=w;if(!whaleProto)return;
  w.placements.forEach((p,i)=>{if(p.k!=='travel'||!p.t.startsWith('Starport'))return;const gy=groundH(w,p.x,p.z),a=(strHash(p.t)%628)/100;
    const bx=p.x+Math.cos(a)*DOCK_OFF,bz=p.z+Math.sin(a)*DOCK_OFF,P=new V3(bx,groundH(w,bx,bz)+DOCK_ALT,-bz),look=new V3(p.x,P.y,-p.z);
    const wh=makeWhale();wh.scale.setScalar(DOCK_L);G.ground.add(wh);const d={w:wh,P,look,ph:i,port:p,jaw:.55};dockPose(d,0);wh.updateMatrixWorld(true);
    const m=wh.userData.mouth.clone().applyMatrix4(wh.matrixWorld),g2=groundH(w,m.x,-m.z),H=Math.max(2,m.y-g2);
    const beam=new THREE.Mesh(new THREE.CylinderGeometry(1.7,2.4,H,24,1,true),beamMat());beam.position.set(m.x,g2+H/2,m.z);G.ground.add(beam);
    Object.assign(d,{beam,mouth:m,ground:{x:m.x,z:-m.z,y:g2}});docks.push(d)})}
{const _ps=placeStarportWhales;placeStarportWhales=function(w){_ps(w);buildDocks(w)}}
let dockNear=null;
function tickDocks(dt){const t=performance.now()/1000;dockNear=null;if(level!=='ground')return;if(whaleProto&&groundWorld&&docksWorld!==groundWorld)buildDocks(groundWorld);
  for(const d of docks){if(d.busy)continue;dockPose(d,t);const U=d.w.userData.U;whaleTick(d.w,dt,G.ground);const dd=CH&&groundMode==='play'?Math.hypot(d.ground.x-play.x,d.ground.z-play.z):1e9;
    const want=dd<120?d.jaw:.08;U.jaw.value+=(want-U.jaw.value)*Math.min(1,dt*1.5);d.beam.material.uniforms.t.value=t;d.beam.material.uniforms.k.value=Math.min(1,U.jaw.value/.4);
    if(dd<6)dockNear=d}
  const tip=$('#nodeTip');if(tip&&dockNear&&!CINE.on){tip.hidden=false;tip.textContent='R · Board the glow whale (light-speed passage, 600 credits)'}}
addEventListener('keydown',e=>{if(/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||e.repeat||e.key.toLowerCase()!=='r'||!dockNear||CINE.on)return;e.stopImmediatePropagation();doAction('travel')},true);

/* ---- cutscene runner: owns the camera and the player model while active ---- */
const CINE={on:false,fn:null,cam:new V3(),look:new V3()};
{const s=document.createElement('style');s.textContent=`body.cine>*:not(canvas):not(#hyper):not(#fade):not(#cineBars):not(script):not(style){opacity:0!important;pointer-events:none!important;transition:opacity .4s}
#cineBars{position:fixed;inset:0;pointer-events:none;z-index:55}#cineBars:before,#cineBars:after{content:'';position:absolute;left:0;right:0;height:0;background:#000;transition:height .5s ease}
#cineBars:before{top:0}#cineBars:after{bottom:0}body.cine #cineBars:before,body.cine #cineBars:after{height:11vh}`;document.head.append(s);const b=document.createElement('div');b.id='cineBars';document.body.append(b)}
let cineWas=false;function cineUI(){if(CINE.on!==cineWas){cineWas=CINE.on;document.body.classList.toggle('cine',CINE.on)}}
function cine(dur,fn){return new Promise(res=>{const t0=performance.now();CINE.on=true;CINE.fn=dt=>{const k=Math.min(1,(performance.now()-t0)/1000/(reduce?Math.min(dur,.3):dur));fn(k,dt);if(k>=1){CINE.fn=null;res()}}})}
{const _up=updatePlay;updatePlay=function(dt){if(CINE.on){if(play.model&&play.model.userData.mixer)play.model.userData.mixer.update(dt);return}return _up(dt)}}
{const _gt=gameTick;gameTick=function(dt){_gt(dt);tickDocks(dt);cineUI();if(CINE.on){if(CINE.fn)CINE.fn(dt);cam.position.copy(CINE.cam);cam.lookAt(CINE.look)}tickPortals(dt)}}
const sm=k=>k*k*(3-2*k),lerp3=(a,b,k)=>a.clone().lerp(b,k);

/* ---- the portal: a rippling, see-through ring of light ---- */
const portals=[];
function whalePortal(pos,dir,R){const m=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,uniforms:{t:{value:0},open:{value:0}},
    vertexShader:`uniform float t,open;varying vec2 vU;void main(){vU=uv;vec3 p=position;float r=length(p.xy);p.z+=sin(r*9.-t*7.)*.035*open+sin(atan(p.y,p.x)*6.+t*3.)*.02*r;p.xy*=1.+sin(t*5.+r*12.)*.012;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
    fragmentShader:`uniform float t,open;varying vec2 vU;void main(){vec2 q=vU*2.-1.;float r=length(q),a=atan(q.y,q.x);if(r>1.)discard;
      float rim=smoothstep(.78,.97,r)*smoothstep(1.,.96,r);float sw=sin(a*7.+r*14.-t*6.)*.5+.5;float rip=sin(r*34.-t*10.)*.5+.5;float core=smoothstep(.9,0.,r);
      vec3 c=mix(vec3(.45,.95,1.),vec3(.75,.45,1.),sw)*(rim*2.2+rip*.22*core+sw*.18*core*core)+vec3(1.)*pow(core,6.)*.35;gl_FragColor=vec4(c*open,1.);}`});
  const o=new THREE.Mesh(new THREE.CircleGeometry(1,96,0,TAU),m);const g=new THREE.Group();g.add(o);g.position.copy(pos);g.lookAt(pos.clone().add(dir));g.scale.setScalar(R);G.ground.add(g);const P={g,m,open:0};portals.push(P);return P}
function tickPortals(dt){for(const p of portals)p.m.uniforms.t.value+=dt}
function dropPortal(P){G.ground.remove(P.g);P.g.children[0].geometry.dispose();P.m.dispose();portals.splice(portals.indexOf(P),1)}

/* ---- departure: rise into the mouth, jaw closes, charge, portal, blast through ---- */
async function cineDepart(d){const w=d.w,U=w.userData.U;d.busy=true;keys.clear();const pm=play.model;const L=DOCK_L,P0=w.position.clone();
  const fwd=new V3(0,0,1).applyQuaternion(w.quaternion).normalize(),side=new V3().crossVectors(fwd,new V3(0,1,0)).normalize(),gp=new V3(d.ground.x,d.ground.y,-d.ground.z);
  // shot A: low and to the side of the beam, looking up into the mouth
  CINE.cam.copy(gp).addScaledVector(side,14).addScaledVector(fwd,10).add(new V3(0,3,0));CINE.look.copy(d.mouth);
  await cine(1,k=>{U.jaw.value+=(.75-U.jaw.value)*.1;whaleTick(w,1/60,G.ground)});
  await cine(2.2,(k,dt)=>{if(pm){pm.position.copy(lerp3(gp,d.mouth,sm(k)));pm.rotation.y+=dt*3;pm.scale.setScalar(1-k*.35)}whaleTick(w,dt,G.ground);CINE.look.copy(lerp3(gp,d.mouth,sm(k)).lerp(d.mouth,.5))});
  if(pm)pm.visible=false;
  await cine(.7,(k,dt)=>{U.jaw.value=.75*(1-sm(k));whaleTick(w,dt,G.ground)});
  // shot B: wide, behind and beside; the whale turns skyward, charges, the portal opens ahead of it
  const dir=fwd.clone().negate().add(new V3(0,.55,0)).normalize(),portalPos=P0.clone().addScaledVector(dir,L*2.6),Pt=whalePortal(portalPos,dir,L*.75),q0=w.quaternion.clone(),q1=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(new V3(),dir.clone().negate(),new V3(0,1,0)));
  CINE.cam.copy(P0).addScaledVector(side,L*1.9).addScaledVector(dir,-L*.9).add(new V3(0,L*.2,0));
  await cine(2.6,(k,dt)=>{w.quaternion.copy(q0).slerp(q1,sm(Math.min(1,k*1.6)));U.charge.value=sm(k);Pt.m.uniforms.open.value=sm(Math.max(0,k*1.4-.4));Pt.g.scale.setScalar(L*.75*(.3+.7*sm(Math.max(0,k*1.4-.4))));
    CINE.look.copy(lerp3(P0,portalPos,.45));whaleTick(w,dt,G.ground);if(Math.random()<.5)vfxEmit('auras',w.position.x,w.position.y-L*.1,-w.position.z,3,{color:'#9ffcff',scale:4,r:L*.25})});
  // blast through: accelerate, stretch, vanish; the portal flares and folds shut
  const end=portalPos.clone().addScaledVector(dir,L*1.5);
  await cine(.9,(k,dt)=>{const e=k*k*k;w.position.copy(lerp3(P0,end,e));w.scale.set(L*(1-.35*e),L*(1-.35*e),L*(1+2.5*e));Pt.m.uniforms.open.value=1+e*1.5;whaleTick(w,dt,G.ground);if(k>.85)w.visible=false});
  await cine(.5,k=>{Pt.m.uniforms.open.value=2.5*(1-k);Pt.g.scale.setScalar(L*.75*(1-sm(k)))});dropPortal(Pt)}

/* ---- arrival: the portal opens, the whale bursts out, settles over the port and lets you down the beam ---- */
async function cineArrive(d){const w=d.w,U=w.userData.U,L=DOCK_L;d.busy=true;keys.clear();const pm=play.model;const t=performance.now()/1000;dockPose(d,t);const P1=w.position.clone(),q1=w.quaternion.clone();
  const fwd=new V3(0,0,1).applyQuaternion(q1),side=new V3().crossVectors(fwd,new V3(0,1,0)).normalize(),dir=fwd.clone().negate().add(new V3(0,.45,0)).normalize();
  const portalPos=P1.clone().addScaledVector(dir,L*2.4),Pt=whalePortal(portalPos,dir,L*.75),gp=new V3(d.ground.x,d.ground.y,-d.ground.z);
  CINE.cam.copy(P1).addScaledVector(side,-L*1.7).addScaledVector(fwd,L*.6).add(new V3(0,L*.15,0));CINE.look.copy(lerp3(P1,portalPos,.5));w.visible=false;if(pm)pm.visible=false;
  await cine(1,k=>{Pt.m.uniforms.open.value=sm(k)*1.6;Pt.g.scale.setScalar(L*.75*(.2+.8*sm(k)))});
  w.visible=true;U.charge.value=1;
  await cine(1.6,(k,dt)=>{const e=1-Math.pow(1-k,3);w.position.copy(lerp3(portalPos,P1,e));w.scale.set(L*(.7+.3*e),L*(.7+.3*e),L*(3.5-2.5*e));w.quaternion.copy(q1);U.charge.value=1-e*.7;Pt.m.uniforms.open.value=1.6*(1-sm(k));whaleTick(w,dt,G.ground);CINE.look.copy(w.position)});
  dropPortal(Pt);w.scale.setScalar(L);
  CINE.cam.copy(gp).addScaledVector(side,13).addScaledVector(fwd,-9).add(new V3(0,3.5,0));
  await cine(.8,(k,dt)=>{U.jaw.value=.75*sm(k);U.charge.value=.3*(1-k);whaleTick(w,dt,G.ground);CINE.look.copy(d.mouth)});
  if(pm){pm.visible=true;pm.scale.setScalar(.65)}
  await cine(1.8,(k,dt)=>{if(pm){pm.position.copy(lerp3(d.mouth,gp,sm(k)));pm.scale.setScalar(.65+.35*k)}whaleTick(w,dt,G.ground);CINE.look.copy(lerp3(d.mouth,gp,sm(k)))});
  if(pm)pm.scale.setScalar(1);U.charge.value=0;d.busy=false;
  const toPort=new V3(d.port.x-d.ground.x,0,d.port.z-d.ground.z).normalize();play.x=d.ground.x+toPort.x*7;play.z=d.ground.z+toPort.z*7}

/* ---- hyperspace screen while the next planet loads (CSS animation keeps moving during the heavy build) ---- */
{const s=document.createElement('style');s.textContent=`#hyper{position:fixed;inset:0;z-index:60;background:#02040a;overflow:hidden;opacity:0;transition:opacity .35s ease;pointer-events:none}
#hyper.on{opacity:1;pointer-events:auto}#hyper .hs{position:absolute;left:50%;top:50%;width:260vmax;height:260vmax;margin:-130vmax 0 0 -130vmax;border-radius:50%;
background:repeating-conic-gradient(from 0deg,rgba(127,246,255,.0) 0deg 2.2deg,rgba(127,246,255,.55) 2.4deg 2.6deg,rgba(197,139,255,0) 2.8deg 5.1deg,rgba(197,139,255,.45) 5.3deg 5.45deg);
-webkit-mask:radial-gradient(circle,transparent 0 6%,#000 30%,transparent 70%);mask:radial-gradient(circle,transparent 0 6%,#000 30%,transparent 70%);animation:hsz 1.1s linear infinite}
#hyper .hs.b{animation-duration:1.7s;animation-delay:-.6s;opacity:.7;filter:hue-rotate(40deg)}
@keyframes hsz{from{transform:scale(.35) rotate(0deg);opacity:0}25%{opacity:1}to{transform:scale(1.5) rotate(8deg);opacity:0}}
#hyper .wh{position:absolute;left:50%;top:50%;width:min(46vw,520px);aspect-ratio:3/1;transform:translate(-50%,-50%);border-radius:50% 60% 45% 55%/60% 55% 45% 40%;
background:radial-gradient(ellipse at 70% 45%,rgba(160,250,255,.9),rgba(40,90,160,.5) 45%,transparent 70%);filter:blur(6px);animation:whb 2.4s ease-in-out infinite}
@keyframes whb{0%,100%{transform:translate(-50%,-50%) scale(1)}50%{transform:translate(-50%,-52%) scale(1.04)}}
#hyper .ht{position:absolute;left:0;right:0;bottom:12vh;text-align:center;color:#dff;font:600 15px system-ui,sans-serif;letter-spacing:.2em;text-transform:uppercase;text-shadow:0 0 12px #7ff6ff}
#hyper .ht small{display:block;margin-top:6px;letter-spacing:.08em;text-transform:none;font-weight:400;opacity:.75}
@media (prefers-reduced-motion:reduce){#hyper .hs,#hyper .wh{animation:none}}`;document.head.append(s);
  const h=document.createElement('div');h.id='hyper';h.innerHTML='<div class="hs"></div><div class="hs b"></div><div class="wh"></div><div class="ht"><span id="hyperTo"></span><small>Light-speed jump · the whale knows the way</small></div>';document.body.append(h)}
const hyper=(on,to)=>{const h=$('#hyper');if(to)$('#hyperTo').textContent='Jumping to '+to;h.classList.toggle('on',on);return sleep(380)};
const nearestDock=(x,z,r=140)=>docks.reduce((a,d)=>{const dd=Math.hypot(d.ground.x-x,d.ground.z-z);return dd<r&&(!a||dd<a.dd)?{d,dd}:a},null);

// passage between worlds: cutscene out, hyperspace while loading, cutscene in
whaleTo=async function(t){saveNow();const from=curWorld,to=t.world;combat.p=null;
  const dep=level==='ground'&&groundMode==='play'&&play.model?nearestDock(play.x,play.z):null;busy=true;
  try{if(dep)await cineDepart(dep.d)}catch(e){console.warn('depart',e)}
  await hyper(true,to.name);CINE.on=false;CINE.fn=null;if(play.model){play.model.visible=true;play.model.scale.setScalar(1)}
  if(groundMode==='play')exitPlay();setLevel('galaxy');busy=false;
  curWorld=to;CH.planet=to.id;CH.pos={x:t.x+8,z:t.z+8};pendingSpawn={x:t.x+8,z:t.z+8};markDirty();
  const poi=nearestPoi(to,t.x,t.z);ctl.target.copy(to.gpos);ctl.dist=40;applyOrbit();pendingPlay=true;await goPlanet(to,poi);while(busy)await sleep(60);goGround(poi);
  for(let i=0;i<600&&!(groundMode==='play'&&play.model&&!busy);i++)await sleep(100);
  const arr=groundMode==='play'?nearestDock(play.x,play.z,200):null;
  if(arr){play.x=arr.d.ground.x;play.z=arr.d.ground.z;busy=true;CINE.on=true;CINE.cam.copy(cam.position);CINE.look.set(play.x,groundH(groundWorld,play.x,play.z),-play.z)}
  await hyper(false);
  try{if(arr)await cineArrive(arr.d)}catch(e){console.warn('arrive',e)}
  CINE.on=false;CINE.fn=null;busy=false;if(play.model){play.model.visible=true;play.model.scale.setScalar(1)}CH.pos={x:play.x,z:play.z};markDirty();toast(`Arrived on ${to.name}.`)};
/* ================= Parkour (codepawl/parkour-mocap-glb on Hugging Face, Apache-2.0; hhtools Parkour Mocap by YaojieShen) =================
   Real optical mocap of vaults and flips, cut around the apex and turned to face forward. A running jump becomes a speed
   or kong vault now and then; /flip /backflip /sideflip /wallflip /vault play them on demand. */
const PK_RUN=['vaultSpeed','vaultKong','jumpRun','jumpRun'];
{const _os=toonOneShot;toonOneShot=function(inst,kind){const u=inst&&inst.userData;if(u&&u.mixer){
    if(kind==='jumpRun'&&!u.gun){const k=PK_RUN[Math.random()*PK_RUN.length|0];if(k!=='jumpRun'&&u.clips[k])return toonPlay(inst,k,.1,{once:true,hold:u.clips[k].duration*.95})}
    const pk={flip:'frontFlip',backflip:'backFlip',sideflip:'sideFlip',wallflip:'wallFlip',vault:'vaultHigh'}[kind];if(pk&&u.clips[pk])return toonPlay(inst,pk,.12,{once:true,hold:u.clips[pk].duration})}
  return _os(inst,kind)}}
Object.assign(EMOTES,{flip:'does a front flip',backflip:'does a back flip',sideflip:'does a side flip',wallflip:'flips off the wall',vault:'vaults'});

/* ================= Terrain protection: building pads, mesh-true heights, finer ground =================
   The planet mesh is a grid (57 m cells at 288², finer on Medium/High). Two rules keep buildings and props out of the ground:
   1. Before the mesh is sampled, every building / static footprint pulls the terrain to its base (a flat pad that reaches the
      nearest grid vertices, then eases back out), like the town plateaus already do.
   2. Once the mesh exists, every height query (player, NPCs, kit pieces, nodes, wildlife) reads the mesh itself (exact
      triangle interpolation), so nothing is placed on a height the player can't see. */
const TERRAIN_RES={low:288,medium:336,high:384};
function buildPads(w){const cell=EXT/(TERRAIN_RES[quality]||288),bins=new Map();let n=0;
  for(const p of w.placements){const c=clsOf(p);if(c==='npc'||c==='travel')continue;const r=p.w?Math.max(p.w,p.d||p.w)/2:Math.min((p.r||0)*1.15,70)/1;if(!(r>=2.5)||r>90)continue;
    const base=w._padRaw?w._padRaw(p.x,p.z):0;const pad={x:p.x,z:p.z,r,base,inner:r+cell*.55,outer:r+cell*1.7};n++;
    const b0x=Math.floor((p.x-pad.outer)/512),b1x=Math.floor((p.x+pad.outer)/512),b0z=Math.floor((p.z-pad.outer)/512),b1z=Math.floor((p.z+pad.outer)/512);
    for(let bx=b0x;bx<=b1x;bx++)for(let bz=b0z;bz<=b1z;bz++){const k=bx+','+bz;(bins.get(k)||bins.set(k,[]).get(k)).push(pad)}}
  w._pads=bins;return n}
{const _gh=groundH;groundH=function(w,x,z){
  if(w&&w.hGrid)return hGridAt(w,x,z);
  const h=_gh(w,x,z);const B=w&&w._pads;if(!B)return h;const a=B.get(Math.floor(x/512)+','+Math.floor(z/512));if(!a)return h;
  let best=0,bh=h;for(const p of a){const d=Math.hypot(x-p.x,z-p.z);if(d>=p.outer)continue;const k=d<=p.inner?1:1-smooth(p.inner,p.outer,d);if(k>best){best=k;bh=p.base}}
  return h+(bh-h)*best}}
{const _hg=hGridAt;hGridAt=function(w,x,z){if(!w.hGrid)return groundH(w,x,z);return _hg(w,x,z)}}
{const _bg=buildGround;buildGround=function(w){if(groundWorld===w)return _bg(w);
  w.hGrid=null;w._pads=null;indexPois(w);w._padRaw=(x,z)=>groundH(w,x,z);buildPads(w);
  const r=_bg(w);w._meshH=true;return r}}

/* ---- tree scale per planet: wroshyr-scale forests on Vashtar, redwood giants on Eldermoon, Elder canopy on Verdance IV ---- */
const WORLD_TREE_SCALE={kashyyyk:5,endor:3.5,yavin4:2.6,dathomir:1.6,rori:1.4};
{const _pb=planetBiomes;planetBiomes=function(w){const had=!!w._biomes,L=_pb(w);if(!had&&WORLD_TREE_SCALE[w.id])for(const b of L)b.ts=Math.max(b.ts||1,WORLD_TREE_SCALE[w.id]*(.85+((b.i*37)%30)/100));return L}}

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
/* ================= Wildlife from PRIM's ANIMALS FULL PACK (Unity Asset Store, purchased) =================
   Realistic animated creatures standing in for SWG fauna: bantha (elephant), bolma (rhino), dewback (crocodile),
   kusak (lion), falumpaset (hippo), eopie (zebra), gurreck (bear). Store assets ship inside the game build but stay out of
   the public repo (kits/store/ is git-ignored). */
const STORE_ANIMALS={bantha:{h:3.1,herd:[3,6],prey:1},bolma:{h:1.8,herd:[1,3],prey:0},dewback:{h:1.3,herd:[1,3],prey:0},kusak:{h:1.25,herd:[1,2],prey:0},
  falumpaset:{h:1.6,herd:[2,4],prey:1},eopie:{h:1.5,herd:[3,6],prey:1},gurreck:{h:1.7,herd:[1,1],prey:0}};
Object.assign(ANIMAL_SPEC,STORE_ANIMALS);
{const add=(k,ids)=>{ANIMALS[k]=(ANIMALS[k]||[]).concat(ids)};add('desert',['bantha','dewback','eopie']);add('badlands',['bolma','kusak','eopie']);add('grass',['falumpaset','eopie']);
  add('swamp',['falumpaset','dewback']);add('forest',['gurreck']);add('temperate',['eopie']);add('jungle',['kusak']);add('ice',['gurreck']);add('red',['bolma'])}
{const _la=loadAnimal;loadAnimal=function(id){if(!STORE_ANIMALS[id])return _la(id);if(animalG[id]||animalLoading[id])return animalLoading[id];
  animalLoading[id]=loadScript('kits/store/animals/'+id+'.js').then(()=>new Promise(res=>{const b64=(window.GRUDGE_ANIMAL||{})[id];if(!b64)return res();const bin=atob(b64),buf=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)buf[i]=bin.charCodeAt(i);delete window.GRUDGE_ANIMAL[id];
    new THREE.GLTFLoader().parse(buf.buffer,'',g=>{g.scene.traverse(o=>{if(o.isMesh){o.frustumCulled=false;const m=o.material;if(m&&'metalness' in m){m.metalness=0;m.roughness=.85;if(m.map)m.map.encoding=THREE.LinearEncoding}}});
      // Unity FBX rigs carry their scale on the bones, so measure the skinned pose, not the raw geometry
      g.scene.updateMatrixWorld(true);const box=new THREE.Box3(),v=new THREE.Vector3();g.scene.traverse(o=>{if(!o.isSkinnedMesh)return;o.skeleton.update();const n=o.geometry.attributes.position.count;for(let i=0;i<n;i+=37){o.applyBoneTransform(i,v);v.applyMatrix4(o.matrixWorld);box.expandByPoint(v)}});
      if(box.isEmpty())box.setFromObject(g.scene);animalG[id]={scene:g.scene,clips:g.animations,h:box.max.y-box.min.y,minY:box.min.y};res()},e=>{console.warn('animal '+id,e);res()})})).catch(e=>{console.warn('store animal '+id+' unavailable',e)});
  return animalLoading[id]}}
{const _ma=makeAnimal;makeAnimal=function(id){const a=_ma(id);if(a&&STORE_ANIMALS[id]&&animalG[id].minY!=null){const inner=a.obj.children[0];if(inner)inner.position.y=-animalG[id].minY}return a}}
/* ================= Vehicles: 12 airships and 8 ground speeders as mounts =================
   Airships: Quaternius Ultimate Spaceships (CC0) + one Space Kit shuttle. Speeders: Majadroid LowPoly skiffs (CC0) hovering
   a metre off the ground, and three Space Kit rovers on the ground. Models live in kits/vehicles.js (window.GRUDGE_VEH),
   loaded the first time the stable window opens or the player owns a vehicle. Each is scaled to a real length, its nose turned
   to the mount's forward axis, and given a seat on top; speeders bank into turns and bob, airships fly like dragons. */
const VEHICLES={
  // airships (fly: Space climbs, X descends)
  spitfire:{name:'Spitfire',kind:'air',src:'veh',len:11,speed:3.6,cost:30000},
  striker:{name:'Striker',kind:'air',src:'veh',len:12,speed:3.7,cost:32000},
  omen:{name:'Omen Interceptor',kind:'air',src:'veh',len:12,speed:3.9,cost:38000},
  insurgent:{name:'Insurgent Raider',kind:'air',src:'veh',len:13,speed:3.5,cost:34000},
  imperial:{name:'Legion Lancer',kind:'air',src:'veh',len:13,speed:3.8,cost:40000},
  zenith:{name:'Zenith Cruiser',kind:'air',src:'veh',len:14,speed:3.4,cost:42000},
  challenger:{name:'Challenger Gunship',kind:'air',src:'veh',len:14,speed:3.5,cost:45000},
  executioner:{name:'Executioner Heavy',kind:'air',src:'veh',len:16,speed:3.3,cost:52000},
  dispatcher:{name:'Dispatcher Hauler',kind:'air',src:'veh',len:13,speed:3.0,cost:28000},
  pancake:{name:'Disc Runner',kind:'air',src:'veh',len:11,speed:3.2,cost:26000},
  bob:{name:'Wren Courier',kind:'air',src:'veh',len:9,speed:3.1,cost:22000},
  shuttle:{name:'Vanguard Shuttle',kind:'air',src:'kit',key:'sk_spaceship_vs',len:12,speed:3.2,cost:30000},
  // ground speeders (hover)
  razor:{name:'Razor Skiff',kind:'speeder',src:'veh',file:'skiff_a',len:5.2,speed:3.3,cost:9000,lift:.9},
  glide:{name:'Glide Skiff',kind:'speeder',src:'veh',file:'skiff_b',len:5,speed:3.1,cost:8000,lift:.9},
  mantis:{name:'Mantis Speeder',kind:'speeder',src:'veh',file:'skiff_c',len:5.4,speed:3.4,cost:11000,lift:.9},
  hornet:{name:'Hornet Speeder',kind:'speeder',src:'veh',file:'skiff_d',len:4.6,speed:3.5,cost:12000,lift:.9},
  viper:{name:'Viper Speeder',kind:'speeder',src:'veh',file:'skiff_e',len:4.8,speed:3.6,cost:14000,lift:.9},
  dunerover:{name:'Dune Rover',kind:'rover',src:'kit',key:'sk_rover',len:4.6,speed:2.6,cost:5000,lift:0},
  ridgecrawler:{name:'Ridge Crawler',kind:'rover',src:'kit',key:'sk_rover_wr',len:5,speed:2.5,cost:6000,lift:0},
  bubblerover:{name:'Bubble Rover',kind:'rover',src:'kit',key:'sk_round_rover',len:4,speed:2.4,cost:4500,lift:0}};
// nose direction per model (radians about y so the nose points along the mount's forward); measured in the vehicle viewer
const VEH_YAW={};for(const id in VEHICLES)if(VEHICLES[id].kind==='air')VEH_YAW[id]=Math.PI; // Quaternius ships point their nose down -z
for(const [id,V] of Object.entries(VEHICLES))MOUNTS[id]={name:V.name,veh:id,speed:V.speed,cost:V.cost,fly:V.kind==='air'};
const vehProto={};let vehP=null;
function loadVehicles(){if(vehP)return vehP;
  vehP=loadScript('kits/vehicles.js').then(()=>Promise.all(Object.entries(VEHICLES).filter(([,V])=>V.src==='veh').map(([id,V])=>new Promise(res=>{
    const b64=(window.GRUDGE_VEH||{})[V.file||id];if(!b64)return res();const bin=atob(b64),buf=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)buf[i]=bin.charCodeAt(i);
    new THREE.GLTFLoader().parse(buf.buffer,'',g=>{vehProto[id]=g.scene;res()},e=>{console.warn('vehicle '+id,e);res()})})))).then(()=>{window.GRUDGE_VEH=null}).catch(e=>console.warn('vehicles unavailable',e));
  return vehP}
function vehSource(id){const V=VEHICLES[id];if(V.src==='kit'){if(vehProto[id])return vehProto[id];const P=kitProtoCache[V.key];if(!P)return null;
  const g=new THREE.Group();for(const p of P.parts){const m=new THREE.Mesh(p.geo,p.mat);p.m.decompose(m.position,m.quaternion,m.scale);g.add(m)}return vehProto[id]=g}return vehProto[id]||null}
function makeVehicle(id){const V=VEHICLES[id],src=vehSource(id);if(!src){loadVehicles();if(V.src==='kit')loadPacks();return null}
  const m=src.clone(true);m.updateMatrixWorld(true);let b=new THREE.Box3().setFromObject(m),s=b.getSize(new V3());
  const turn=new THREE.Group();turn.add(m);if(VEH_YAW[id]!=null)turn.rotation.y=VEH_YAW[id];else if(V.kind==='rover'&&s.x>s.z)turn.rotation.y=Math.PI/2;
  const scl=new THREE.Group();scl.add(turn);scl.updateMatrixWorld(true);b=new THREE.Box3().setFromObject(scl);s=b.getSize(new V3());
  const k=V.len/Math.max(s.x,s.z);scl.scale.setScalar(k);const c=b.getCenter(new V3());m.position.sub(new V3(0,0,0));
  const lift=new THREE.Group();lift.add(scl);scl.position.set(-c.x*k,-b.min.y*k,-c.z*k);
  scl.traverse(o=>{if(o.isMesh){o.castShadow=true;o.frustumCulled=false;[].concat(o.material).forEach(x=>{if(x.map)x.map.encoding=THREE.sRGBEncoding;if('metalness' in x){x.metalness=Math.min(.35,x.metalness);x.roughness=Math.max(.45,x.roughness)}x.needsUpdate=true})}});
  const obj=new THREE.Group();obj.add(lift);const H=s.y*k,hover=V.lift!=null?V.lift:(V.kind==='air'?1.4:0);
  // engine glow behind the hull: additive sprite that brightens with speed
  const glow=new THREE.Mesh(new THREE.SphereGeometry(V.len*.06,10,8),new THREE.MeshBasicMaterial({color:V.kind==='rover'?0xffb060:0x6fd8ff,transparent:true,opacity:.0,blending:THREE.AdditiveBlending,depthWrite:false}));
  glow.position.set(0,H*.45,-V.len*.5);glow.scale.set(1,1,2.2);lift.add(glow);
  obj.userData={veh:id,lift,glow,hover,H,seat:hover+H*(V.kind==='air'?.92:.78),seatZ:V.kind==='air'?V.len*.05:-V.len*.08,t:Math.random()*10,bank:0,yaw:0,spd:0};
  lift.position.y=hover;return obj}
function animateVehicle(obj,dt,moving,flying){const u=obj.userData,V=VEHICLES[u.veh];u.t+=dt;const yaw=obj.rotation.y,dy=Math.atan2(Math.sin(yaw-u.yaw),Math.cos(yaw-u.yaw));u.yaw=yaw;
  const turn=dt>0?THREE.MathUtils.clamp(dy/dt,-2.5,2.5):0;u.spd+=((moving?1:0)-u.spd)*Math.min(1,dt*3);
  const bankMax=V.kind==='rover'?.06:V.kind==='air'?.45:.32;u.bank+=(-turn*.18*u.spd*bankMax/.3-u.bank)*Math.min(1,dt*4);u.bank=THREE.MathUtils.clamp(u.bank,-bankMax,bankMax);
  const bob=V.kind==='rover'?Math.abs(Math.sin(u.t*9))*.04*u.spd:Math.sin(u.t*(V.kind==='air'?1.3:2.4))*(V.kind==='air'?.25:.07);
  u.lift.position.y=u.hover+bob;u.lift.rotation.z=u.bank;u.lift.rotation.x=(V.kind==='rover'?0:-.06*u.spd)+(flying?Math.sin(u.t*.7)*.02:0);
  u.glow.material.opacity=.25+.55*u.spd+Math.sin(u.t*30)*.05;u.glow.scale.z=1.4+2*u.spd}
{const _f=makeMountObj;makeMountObj=function(id){const M=MOUNTS[id];if(M&&M.veh)return makeVehicle(M.veh);return _f.apply(this,arguments)}}
{const _f=animateMount;animateMount=function(obj,dt,moving,flying){if(obj&&obj.userData&&obj.userData.veh)return animateVehicle(obj,dt,moving,flying);return _f.apply(this,arguments)}}
{const _f=winMounts;winMounts=function(B){loadVehicles();loadPacks();_f.apply(this,arguments);
  // tag each row with its class and keep the list readable: animals, then speeders, then airships
  B.querySelectorAll('[data-ride],[data-buy]').forEach(b=>{const id=b.dataset.ride||b.dataset.buy,V=VEHICLES[id];if(!V)return;const sm=b.closest('li')&&b.closest('li').querySelector('small');if(sm)sm.textContent=(V.kind==='air'?'Airship · flies · ':V.kind==='rover'?'Rover · ':'Speeder · hovers · ')+Math.round(V.speed*100)+'% speed'})}}
{const _f=mount;mount=function(id){if(MOUNTS[id]&&MOUNTS[id].veh&&!vehSource(MOUNTS[id].veh)){loadVehicles();if(VEHICLES[MOUNTS[id].veh].src==='kit')loadPacks();toast('Your vehicle is being brought round. Try again in a moment.');vehP&&vehP.then(()=>{if(!play.mount&&vehSource(MOUNTS[id].veh))_f(id)});return}
  const r=_f.apply(this,arguments);if(play.mount&&play.mount.def.veh&&VEHICLES[id].kind==='air')play.dist=Math.max(play.dist,15);return r}}
// preload when a character who owns a vehicle starts playing, so V summons it at once
{const _f=playCharacter;playCharacter=async function(){const r=await _f.apply(this,arguments);try{if(ownedMounts().some(m=>VEHICLES[m]))loadVehicles()}catch(e){}return r}}

/* ================= Combat effects: projectile database, spline volleys, charged attacks, beams, chains, slashes =================
   COMBAT_FX is the data table: every visual attack is a row (motion path, speed, head sprite, ribbon trail, impact, charge rules).
   Abilities and auto-attacks pick a row by id (ABILITY_FX / AUTO_FX); designers add rows, not code.
   Rendering: one 1024x1024 greyscale atlas (Kenney Particle Pack, CC0) shared by every effect; heads are camera-facing quads,
   trails are camera-facing ribbons rebuilt from a short position history, beams and chains are ribbons too. All additive,
   depthWrite off, pooled and capped. The shader gradient-maps the greyscale mask: bright core to white, edge to the row colour. */
const FX_CELL={flare:0,light:1,rune:2,burst:3,lightning:4,bolt:5,star:6,trace:7,twirl:8,slash:9,ring:10,starIcon:11,smoke:12,fire:13,flame:14,blast:15};
const COMBAT_FX={
  // guns
  blaster_bolt:{kind:'projectile',path:'straight',speed:95,head:{cell:'light',size:.55,stretch:4,color:'#ff5a3a'},trail:{len:7,width:.16,color:'#ff3a2a'},impact:{cell:'blast',size:1.4,color:'#ffb070',sparks:8}},
  plasma_lance:{kind:'projectile',path:'straight',speed:70,head:{cell:'light',size:1.1,stretch:3,color:'#5ad0ff'},trail:{len:14,width:.38,color:'#3a9cff'},impact:{cell:'blast',size:2.6,color:'#8fe6ff',ring:3.2,sparks:18}},
  rail_shot:{kind:'beam',width:.32,life:.45,color:'#d8f4ff',core:'#ffffff',impact:{cell:'blast',size:3.2,color:'#bfefff',ring:4,sparks:26,shake:.35},
    charge:{max:1.4,minMult:.7,maxMult:1.6,color:'#9fe4ff'}},
  suppress_volley:{kind:'spline',path:'swerve',count:6,spread:4.5,speed:48,stagger:.06,head:{cell:'flare',size:.7,color:'#ffae4a'},trail:{len:10,width:.14,color:'#ff7a2a'},impact:{cell:'blast',size:1.2,color:'#ffcf8a',sparks:6}},
  seeker_missile:{kind:'projectile',path:'homing',speed:34,head:{cell:'flame',size:.8,color:'#ffd27a'},trail:{len:22,width:.5,color:'#8a8a8a',tex:'smoke'},impact:{cell:'blast',size:4,color:'#ff9a4a',ring:5,sparks:30,fire:1,shake:.5}},
  // casters
  arcane_orb:{kind:'projectile',path:'homing',speed:26,head:{cell:'twirl',size:1.1,spin:6,color:'#b48bff'},trail:{len:16,width:.42,color:'#7a4aff'},impact:{cell:'burst',size:2.2,color:'#cdb6ff',ring:2.4,sparks:14}},
  fireball:{kind:'projectile',path:'arc',arc:.22,speed:30,head:{cell:'fire',size:1.6,spin:3,color:'#ff9a3a'},trail:{len:18,width:.7,color:'#ff5a1a',tex:'smoke'},impact:{cell:'blast',size:4.4,color:'#ffb04a',ring:4.5,sparks:24,fire:1,shake:.4}},
  frost_lance:{kind:'projectile',path:'straight',speed:44,head:{cell:'star',size:1.2,stretch:2.4,color:'#9fe4ff'},trail:{len:14,width:.3,color:'#6fc8ff'},impact:{cell:'burst',size:2.6,color:'#dff6ff',ring:2.8,sparks:16}},
  void_missiles:{kind:'spline',path:'spiral',count:7,spread:3,speed:30,stagger:.09,head:{cell:'twirl',size:.9,spin:8,color:'#c04aff'},trail:{len:14,width:.26,color:'#6a1aff'},impact:{cell:'burst',size:2,color:'#e0a0ff',sparks:8},
    charge:{max:1.8,minMult:.6,maxMult:1.8,color:'#b04aff',countMin:3}},
  chain_lightning:{kind:'chain',jumps:4,radius:14,width:.5,life:.5,color:'#a8d8ff',core:'#ffffff',impact:{cell:'lightning',size:2,color:'#d0ecff',sparks:10}},
  // holy and nature
  holy_bolt:{kind:'projectile',path:'arc',arc:.12,speed:34,head:{cell:'star',size:1,spin:2,color:'#ffe08a'},trail:{len:12,width:.3,color:'#ffd05a'},impact:{cell:'burst',size:2,color:'#fff3c0',ring:2.2,sparks:12}},
  holy_smite:{kind:'nova',fromSky:true,width:.9,life:.6,color:'#ffe9a0',core:'#ffffff',impact:{cell:'blast',size:3.6,color:'#fff0b0',ring:5,sparks:30,shake:.3}},
  thorn_dart:{kind:'projectile',path:'arc',arc:.1,speed:40,head:{cell:'bolt',size:.7,stretch:2,color:'#9fe07a'},trail:{len:10,width:.18,color:'#5ab04a'},impact:{cell:'burst',size:1.4,color:'#c8ffa0',sparks:8}},
  thorn_volley:{kind:'spline',path:'swerve',count:5,spread:5,speed:36,stagger:.07,head:{cell:'bolt',size:.8,stretch:2,color:'#8fe07a'},trail:{len:12,width:.2,color:'#4a9a3a'},impact:{cell:'burst',size:1.6,color:'#d0ffb0',ring:2,sparks:8}},
  // melee
  sword_slash:{kind:'slash',size:3.2,life:.22,color:'#ffe2a8',impact:{cell:'blast',size:1.2,color:'#ffd27a',sparks:10}},
  ground_slam:{kind:'slash',size:4.2,life:.3,color:'#ffcf7a',slam:true,impact:{cell:'blast',size:3.6,color:'#ffbf6a',ring:5,sparks:30,shake:.6},
    charge:{max:1.2,minMult:.8,maxMult:1.7,color:'#ffcf5a'}},
  war_cry:{kind:'nova',width:.6,life:.5,color:'#ff6a3a',impact:{cell:'ring',size:5,color:'#ff8a5a',ring:6,sparks:16}}};
const ABILITY_FX={power:'ground_slam',aimed:'plasma_lance',headshot:'rail_shot',suppress:'suppress_volley',intimidate:'war_cry'};
const ELITE_FX={magic:'void_missiles',holy:'holy_smite',nature:'thorn_volley',melee:'ground_slam',gun:'rail_shot'};
const AUTO_FX={magic:'arcane_orb',holy:'holy_bolt',nature:'thorn_dart',gun:'blaster_bolt',melee:'sword_slash'};
const fxKindNow=()=>charStats().gun?'gun':casterKind();
function fxFor(a){if(!a)return COMBAT_FX[AUTO_FX[fxKindNow()]];if(ABILITY_FX[a.id])return COMBAT_FX[ABILITY_FX[a.id]];
  if(/^elite_/.test(a.id)){const k=fxKindNow();return COMBAT_FX[k==='magic'&&/power/.test(a.id)?'fireball':ELITE_FX[k]]}
  if(a.hit&&casterKind()==='magic')return COMBAT_FX.fireball;return null}

/* ---- shared atlas and shaders ---- */
const fxAtlas=(()=>{const t=new THREE.TextureLoader().load('kits/fx/combat_atlas.png');t._keep=true;t.generateMipmaps=true;t.minFilter=THREE.LinearMipmapLinearFilter;return t})();
const FX_GRAD=`vec3 fxGrad(float i,vec3 c){return mix(c*i*1.6,vec3(1.),smoothstep(.55,1.,i));}`;
// billboard head: camera-facing quad, optional stretch along the screen-space velocity, spin, gradient map
const fxHeadMat=(cell,color)=>new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
  uniforms:{map:{value:fxAtlas},cell:{value:FX_CELL[cell]||0},color:{value:new THREE.Color(color)},alpha:{value:1},size:{value:1},stretch:{value:1},spin:{value:0},vdir:{value:new THREE.Vector3(1,0,0)}},
  vertexShader:`uniform float size,stretch,spin;uniform vec3 vdir;varying vec2 vUv;void main(){vUv=uv;vec4 mv=modelViewMatrix*vec4(0.,0.,0.,1.);
    vec2 p=position.xy;float c=cos(spin),s=sin(spin);p=mat2(c,s,-s,c)*p;vec3 d=normalize((viewMatrix*vec4(vdir,0.)).xyz+vec3(1e-4));vec2 ax=normalize(d.xy+vec2(1e-4,0.));vec2 ay=vec2(-ax.y,ax.x);
    vec2 q=stretch>1.01?ax*p.x*stretch+ay*p.y:p;mv.xy+=q*size;gl_Position=projectionMatrix*mv;}`,
  fragmentShader:`uniform sampler2D map;uniform float cell,alpha;uniform vec3 color;varying vec2 vUv;${FX_GRAD}
    void main(){vec2 o=vec2(mod(cell,4.),3.-floor(cell/4.));float i=max(0.,texture2D(map,(o+.02+vUv*.96)/4.).r-.05)/.95;gl_FragColor=vec4(fxGrad(i,color)*alpha,1.);if(i*alpha<.004)discard;}`});
// ribbon: uv.x 0 at the head -> 1 at the tail, uv.y across. Soft edges, tail fade, scrolling noise breaks it up
const fxRibbonMat=(color,tex)=>new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
  uniforms:{map:{value:fxAtlas},color:{value:new THREE.Color(color)},alpha:{value:1},time:{value:0},smoke:{value:tex==='smoke'?1:0}},
  vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`uniform sampler2D map;uniform vec3 color;uniform float alpha,time,smoke;varying vec2 vUv;${FX_GRAD}
    float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
    void main(){float across=1.-abs(vUv.y*2.-1.);float body=pow(across,1.6)*pow(1.-vUv.x,1.3);
      float nz=n(vec2(vUv.x*9.-time*5.,vUv.y*3.))*.6+n(vec2(vUv.x*23.-time*9.,vUv.y*7.))*.4;
      float i=smoke>.5?body*smoothstep(.25,.75,nz+.25*(1.-vUv.x))*.8:body*(.65+.55*nz);
      vec3 c=smoke>.5?mix(color*.9,vec3(1.,.75,.4)*1.6,smoothstep(.25,0.,vUv.x)):fxGrad(i,color);gl_FragColor=vec4(c*i*alpha,1.);if(i*alpha<.004)discard;}`});
const fxQuad=new THREE.PlaneGeometry(1,1);
/* ---- ribbon helper: positions history -> camera-facing strip ---- */
function fxRibbon(n,mat){const g=new THREE.BufferGeometry(),pos=new Float32Array(n*2*3),uv=new Float32Array(n*2*2),idx=[];
  for(let i=0;i<n;i++){uv[i*4]=i/(n-1);uv[i*4+1]=0;uv[i*4+2]=i/(n-1);uv[i*4+3]=1;if(i<n-1){const a=i*2;idx.push(a,a+1,a+2,a+1,a+3,a+2)}}
  g.setAttribute('position',new THREE.BufferAttribute(pos,3).setUsage(THREE.DynamicDrawUsage));g.setAttribute('uv',new THREE.BufferAttribute(uv,2));g.setIndex(idx);
  const m=new THREE.Mesh(g,mat);m.frustumCulled=false;m.renderOrder=7;m.userData.n=n;return m}
const _t=new V3(),_s=new V3(),_c=new V3();
function fxRibbonSet(m,pts,width,taper=true){const P=m.geometry.attributes.position.array,n=m.userData.n,camP=cam.position;
  for(let i=0;i<n;i++){const p=pts[Math.min(i,pts.length-1)],q=pts[Math.min(i+1,pts.length-1)],r=pts[Math.max(0,Math.min(i-1,pts.length-1))];_t.subVectors(r,q);if(_t.lengthSq()<1e-8)_t.set(0,0,1);_t.normalize();
    _c.subVectors(camP,p).normalize();_s.crossVectors(_t,_c).normalize();const w=width*(taper?(1-i/(n-1)*.85):1)*.5;
    P[i*6]=p.x+_s.x*w;P[i*6+1]=p.y+_s.y*w;P[i*6+2]=p.z+_s.z*w;P[i*6+3]=p.x-_s.x*w;P[i*6+4]=p.y-_s.y*w;P[i*6+5]=p.z-_s.z*w}
  m.geometry.attributes.position.needsUpdate=true}

/* ---- live effects ---- */
const FXL=[];const FX_MAX=80;let fxShake=0;
const g2t=(p,yOff=0)=>new V3(p.x,(p.y!=null?p.y:groundH(groundWorld,p.x,p.z)+1.1)+yOff,-p.z);
function fxAdd(o){if(FXL.length>=FX_MAX){const old=FXL.shift();fxKill(old)}FXL.push(o);return o}
function fxKill(f){for(const m of f.meshes||[]){if(m.parent)m.parent.remove(m);if(m.geometry&&m.geometry!==fxQuad)m.geometry.dispose();if(m.material)m.material.dispose()}}
function fxHead(H){const m=new THREE.Mesh(fxQuad,fxHeadMat(H.cell,H.color));m.material.uniforms.size.value=H.size;m.material.uniforms.stretch.value=H.stretch||1;m.frustumCulled=false;m.renderOrder=8;return m}
// impact: sprite flash + particle sparks + optional ground ring, fire and camera shake
function fxImpact(I,p,scale=1){if(!I||!groundWorld)return;const g={x:p.x,z:-p.z};
  const m=fxHead({cell:I.cell,size:I.size*scale,color:I.color});m.position.copy(p);G.ground.add(m);fxAdd({type:'flash',t:0,life:.35,meshes:[m],grow:1.6});
  if(I.sparks)vfxEmit('impacts',g.x,p.y,g.z,Math.round(I.sparks*scale),{color:I.color,jitter:1,scale:1.1*scale});
  if(I.ring)vfxRing(g.x,g.z,{color:I.color,size:I.ring*scale,life:.7});if(I.fire)vfxFireBurst(g.x,g.z,.2);if(I.shake)fxShake=Math.max(fxShake,I.shake*scale)}
// a projectile or one missile of a volley. tgt(): live target position in three space (follows a moving enemy)
function fxShoot(F,from,tgt,o={}){const H=F.head,T=F.trail||{len:8,width:.2,color:H.color},sc=o.scale||1;
  const head=fxHead({...H,size:H.size*sc});const rib=fxRibbon(Math.max(4,T.len),fxRibbonMat(T.color,T.tex));G.ground.add(head);G.ground.add(rib);
  const p0=from.clone(),to=tgt().clone(),d=p0.distanceTo(to),dir=new V3().subVectors(to,p0).normalize(),side=new V3(-dir.z,0,dir.x).normalize();
  const f={type:'shot',F,t:0,dur:Math.max(.12,d/F.speed),p0,tgt,pos:p0.clone(),hist:[p0.clone()],meshes:[head,rib],head,rib,sc,lane:o.lane||0,seed:Math.random()*10,
    vel:dir.clone().multiplyScalar(F.speed*.5).add(new V3(0,F.speed*.25,0)).addScaledVector(side,(Math.random()-.5)*F.speed*.6),onHit:o.onHit,delay:o.delay||0};
  if(F.path==='swerve'||F.path==='spiral'){const L=f.lane,spr=F.spread||3;f.c1=new V3().lerpVectors(p0,to,.3).addScaledVector(side,L*spr).add(new V3(0,1.5+Math.abs(L)*spr*.4,0));
    f.c2=new V3().lerpVectors(p0,to,.7).addScaledVector(side,-L*spr*.5).add(new V3(0,.8,0))}
  head.visible=rib.visible=!f.delay;return fxAdd(f)}
const bez=(a,b,c,d,t)=>{const u=1-t;return new V3().addScaledVector(a,u*u*u).addScaledVector(b,3*u*u*t).addScaledVector(c,3*u*t*t).addScaledVector(d,t*t*t)};
function fxStepShot(f,dt){if(f.delay>0){f.delay-=dt;if(f.delay<=0){f.head.visible=f.rib.visible=true;f.p0.copy(f.pos)}return true}
  const F=f.F,to=f.tgt();f.t+=dt;const k=Math.min(1,f.t/f.dur);let p;
  if(F.path==='homing'){const want=new V3().subVectors(to,f.pos);const dist=want.length();const turn=Math.min(1,dt*(2+f.t*6));f.vel.lerp(want.normalize().multiplyScalar(F.speed),turn);
    f.pos.addScaledVector(f.vel,dt);p=f.pos;if(dist<.7||f.t>4)return fxLand(f,to)}
  else{if(F.path==='arc'){p=new V3().lerpVectors(f.p0,to,k);p.y+=Math.sin(k*Math.PI)*f.p0.distanceTo(to)*(F.arc||.2)}
    else if(F.path==='swerve')p=bez(f.p0,f.c1,f.c2,to,k);
    else if(F.path==='spiral'){p=bez(f.p0,f.c1,f.c2,to,k);const dir=new V3().subVectors(to,f.p0).normalize(),s1=new V3(-dir.z,0,dir.x),a=f.seed+k*14,r=Math.sin(k*Math.PI)*.9;p.addScaledVector(s1,Math.cos(a)*r);p.y+=Math.sin(a)*r}
    else p=new V3().lerpVectors(f.p0,to,k);
    if(k>=1)return fxLand(f,to)}
  const prev=f.hist[0];f.head.material.uniforms.vdir.value.subVectors(p,prev);f.pos.copy(p);f.head.position.copy(p);
  if(F.head.spin)f.head.material.uniforms.spin.value+=dt*F.head.spin;
  f.hist.unshift(p.clone());if(f.hist.length>f.rib.userData.n)f.hist.pop();fxRibbonSet(f.rib,f.hist,F.trail.width*f.sc);f.rib.material.uniforms.time.value+=dt;
  if(Math.random()<.35)vfxEmit('projectiles',p.x,p.y,-p.z,1,{color:F.head.color,scale:1.2*f.sc,pow:.04,life:.5});return true}
function fxLand(f,to){fxImpact(f.F.impact,to,f.sc);if(f.onHit)f.onHit();
  // the ribbon lingers a moment after the head is gone
  f.type='fade';f.t=0;f.life=.22;f.head.visible=false;return true}
// beam: instant ribbon from muzzle to target, thick, flickers and thins out
function fxBeam(F,from,to,sc=1){const r=fxRibbon(12,fxRibbonMat(F.color)),c=fxRibbon(12,fxRibbonMat(F.core||'#ffffff'));G.ground.add(r);G.ground.add(c);
  const pts=[];for(let i=0;i<12;i++)pts.push(new V3().lerpVectors(to,from,i/11));
  const f=fxAdd({type:'beam',t:0,life:F.life,meshes:[r,c],r,c,pts,w:F.width*sc});fxImpact(F.impact,to,sc);
  const m=fxHead({cell:'flare',size:2.2*sc,color:F.color});m.position.copy(from);G.ground.add(m);fxAdd({type:'flash',t:0,life:.18,meshes:[m],grow:1.4});return f}
// chain lightning: jagged ribbons hopping between nearby hostiles, re-jittered every frame
function fxChain(F,from,to,sc=1){const hops=[from,to];const p=currentTarget();
  if(p&&groundWorld){const near=groundWorld.placements.filter(q=>q!==p&&q.g&&q.g.kind==='hostile'&&!q.dead).map(q=>({q,tp:targetPos(q)})).filter(o=>Math.hypot(o.tp.x-to.x,-o.tp.z-to.z)<F.radius).slice(0,F.jumps-1);
    for(const o of near)hops.push(g2t({x:o.tp.x,z:o.tp.z}))}
  for(let h=0;h<hops.length-1;h++){const r=fxRibbon(14,fxRibbonMat(F.color)),c=fxRibbon(14,fxRibbonMat(F.core));G.ground.add(r);G.ground.add(c);
    fxAdd({type:'chain',t:-h*.06,life:F.life,meshes:[r,c],r,c,a:hops[h],b:hops[h+1],w:F.width*sc});setTimeout(()=>fxImpact(F.impact,hops[h+1],sc),h*60)}}
// nova: a pillar from the sky (holy smite) or a shock ring at the caster (war cry)
function fxNova(F,at,sc=1){if(F.fromSky){const top=at.clone().add(new V3(0,26,0));fxBeam({...F,impact:F.impact},top,at,sc)}else fxImpact(F.impact,at,sc)}
// slash: a crescent quad swept in front of the attacker, facing up, rotating through the swing
function fxSlash(F,at,yaw,sc=1){const m=new THREE.Mesh(fxQuad,new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,uniforms:{map:{value:fxAtlas},cell:{value:FX_CELL.slash},color:{value:new THREE.Color(F.color)},alpha:{value:1}},
    vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`uniform sampler2D map;uniform float cell,alpha;uniform vec3 color;varying vec2 vUv;${FX_GRAD}void main(){vec2 o=vec2(mod(cell,4.),3.-floor(cell/4.));float i=max(0.,texture2D(map,(o+.02+vUv*.96)/4.).r-.05)/.95;gl_FragColor=vec4(fxGrad(i,color)*alpha,1.);if(i*alpha<.004)discard;}`}));m.frustumCulled=false;m.renderOrder=8;
  m.scale.setScalar(F.size*sc);m.position.copy(at);m.rotation.order='YXZ';m.rotation.y=yaw;m.rotation.x=F.slam?-Math.PI/2:-.35;m.rotation.z=Math.random()<.5?.5:-.5;G.ground.add(m);
  fxAdd({type:'slash',t:0,life:F.life,meshes:[m],m,z0:m.rotation.z,slam:F.slam});if(F.slam)fxImpact(F.impact,at.clone().setY(groundH(groundWorld,at.x,-at.z)+.3),sc);else setTimeout(()=>fxImpact(F.impact,at,sc*.8),F.life*500)}
function tickCombatFx(dt){for(let i=FXL.length-1;i>=0;i--){const f=FXL[i];let alive=true;
    if(f.type==='shot')alive=fxStepShot(f,dt);
    else{f.t+=dt;const k=Math.max(0,f.t)/f.life;if(k>=1)alive=false;else if(f.type==='fade'){f.rib.material.uniforms.alpha.value=1-k;f.rib.material.uniforms.time.value+=dt}
      else if(f.type==='flash'){const m=f.meshes[0];m.material.uniforms.alpha.value=(1-k)*(1-k);m.material.uniforms.size.value*=1+dt*(f.grow||1.5)}
      else if(f.type==='beam'){const w=f.w*(1-k*k)*(0.8+Math.random()*.4);fxRibbonSet(f.r,f.pts,w,false);fxRibbonSet(f.c,f.pts,w*.35,false);f.r.material.uniforms.time.value+=dt;f.r.material.uniforms.alpha.value=1-k}
      else if(f.type==='chain'){if(f.t<0){f.r.visible=f.c.visible=false}else{f.r.visible=f.c.visible=true;const pts=[];for(let j=0;j<14;j++){const q=new V3().lerpVectors(f.a,f.b,j/13);if(j&&j<13)q.add(new V3((Math.random()-.5)*.9,(Math.random()-.5)*.9,(Math.random()-.5)*.9));pts.push(q)}
        fxRibbonSet(f.r,pts,f.w,false);fxRibbonSet(f.c,pts,f.w*.3,false);f.r.material.uniforms.alpha.value=f.c.material.uniforms.alpha.value=1-k}}
      else if(f.type==='slash'){f.m.material.uniforms.alpha.value=Math.sin(Math.min(1,k*1.2)*Math.PI);f.m.rotation.z=f.z0*(1-2*k);f.m.scale.multiplyScalar(1+dt*(f.slam?3:1))}}
    if(!alive){fxKill(f);FXL.splice(i,1)}}}

/* ---- firing: the effect matching the ability or the auto-attack ---- */
let FXCTX=null;// {a, charge 0..1} while an ability resolves
function fxFire(F,from,to,o={}){if(!F||!groundWorld)return;const sc=(o.scale||1),p=currentTarget(),tgt=()=>{if(p&&!p.dead){const tp=targetPos(p);return g2t({x:tp.x,z:tp.z})}return to};
  if(F.kind==='projectile')return fxShoot(F,from,tgt,{scale:sc});
  if(F.kind==='spline'){let n=F.count;if(F.charge&&F.charge.countMin)n=Math.round(F.charge.countMin+(F.count-F.charge.countMin)*(o.charge||0));
    for(let i=0;i<n;i++)fxShoot(F,from,tgt,{lane:n>1?(i/(n-1)-.5)*2:0,delay:i*(F.stagger||.05),scale:sc});return}
  if(F.kind==='beam')return fxBeam(F,from,to,sc);if(F.kind==='chain')return fxChain(F,from,to,sc);if(F.kind==='nova')return fxNova(F,to,sc)}
// ranged visuals: replace the old particle bolt with a real projectile from the database
{const _vb=vfxBolt;vfxBolt=function(from,to,col,dur){if(!groundWorld)return _vb.apply(this,arguments);const F=FXCTX?fxFor(FXCTX.a):fxFor(null);
  if(!F||F.kind==='slash')return _vb.apply(this,arguments);const sc=FXCTX?1+(FXCTX.charge||0)*.6:1;
  const fromT=new V3(from.x,from.y,-from.z),toT=new V3(to.x,to.y,-to.z);fxFire(F,fromT,toT,{scale:sc,charge:FXCTX&&FXCTX.charge})}}
// melee: crescent slash in front of the player for swings and melee abilities
function fxMelee(F,sc=1){if(!play.model)return;const fw=new V3(-Math.sin(play.yaw),0,-Math.cos(play.yaw));const at=new V3(play.x,groundH(groundWorld,play.x,play.z)+1.2,-play.z).addScaledVector(fw,F.slam?2.2:1.4);
  fxSlash(F,at,play.yaw+Math.PI,sc)}
{const _ts=toonOneShot;toonOneShot=function(inst,kind){const r=_ts.apply(this,arguments);try{if(inst===play.model&&kind==='attack'&&!FXCTX&&groundMode==='play'&&(combat.p||hunt.auto)&&!charStats().gun&&casterKind()==='melee')fxMelee(COMBAT_FX.sword_slash)}catch(e){}return r}}
// guns: muzzle flash stays, the line tracer becomes a blaster bolt with a ribbon
{const _gf=gunFx;gunFx=function(inst){const g=inst.userData.gunObj;if(!g||inst!==play.model)return _gf.apply(this,arguments);const mz=g.getObjectByName('muzzle');if(!mz)return;
  setTimeout(()=>{if(!g.parent||!groundWorld)return;inst.updateMatrixWorld(true);const from=new V3();mz.getWorldPosition(from);const fl=glowSprite(0xffc86a,1.1);fl.position.copy(from);G.ground.add(fl);gunFxList.push({o:fl,t:.07});
    const tp=gunTarget();if(tp){const to=new V3(tp.x,groundH(groundWorld,tp.x,tp.z)+(tp.h||1.2),-tp.z);const F=FXCTX&&fxFor(FXCTX.a)||COMBAT_FX.blaster_bolt;if(F.kind!=='slash')fxFire(F,from,to)}},90)}}

/* ---- charged attacks: hold the hotbar key, release to fire. Damage scales between minMult and maxMult ---- */
const CHG={a:null,t:0,max:1,F:null,orb:null,ringT:0,stage:0};
const chargeBar=(()=>{const d=document.createElement('div');d.id='chargeBar';d.hidden=true;d.innerHTML='<i></i><span></span>';document.body.appendChild(d);
  const st=document.createElement('style');st.textContent=`#chargeBar{position:fixed;left:50%;top:62%;transform:translateX(-50%);width:220px;height:10px;border-radius:6px;background:rgba(10,12,20,.65);border:1px solid rgba(255,255,255,.25);z-index:40;pointer-events:none;overflow:visible}
  #chargeBar i{display:block;height:100%;border-radius:6px;background:linear-gradient(90deg,#6fd8ff,#fff);box-shadow:0 0 12px #6fd8ff;width:0}#chargeBar.full i{background:linear-gradient(90deg,#ffd05a,#fff);box-shadow:0 0 16px #ffd05a}
  #chargeBar span{position:absolute;top:14px;left:0;right:0;text-align:center;font:600 11px system-ui;color:#e8f2ff;text-shadow:0 1px 2px #000;letter-spacing:.06em;text-transform:uppercase}`;document.head.appendChild(st);return d})();
function chargeStart(a,F){CHG.a=a;CHG.F=F;CHG.t=0;CHG.max=F.charge.max;CHG.stage=0;CHG.ringT=0;
  CHG.orb=fxHead({cell:'twirl',size:.4,color:F.charge.color});G.ground.add(CHG.orb);chargeBar.hidden=false;chargeBar.classList.remove('full');chargeBar.querySelector('span').textContent=`Charging ${a.name} · release to fire`;
  if(play.model&&play.model.userData.mixer)toonPlay(play.model,play.model.userData.clips&&play.model.userData.clips.channel?'channel':'cast',.2,{once:true,hold:F.charge.max+1})}
function chargeCancel(){if(CHG.orb){G.ground.remove(CHG.orb);CHG.orb.material.dispose()}CHG.a=null;CHG.orb=null;chargeBar.hidden=true}
function chargeRelease(){if(!CHG.a)return;const a=CHG.a,F=CHG.F,k=Math.min(1,CHG.t/CHG.max),mult=F.charge.minMult+(F.charge.maxMult-F.charge.minMult)*k;chargeCancel();
  const h=a.hit,old=h&&h.mult;if(h)h.mult=old*mult;FXCTX={a,charge:k};try{_useAbilityRaw(a)}finally{if(h)h.mult=old;FXCTX=null}
  if(k>=.99){floatMsg(`Full charge! ${a.name} ×${mult.toFixed(1)}`);fxShake=Math.max(fxShake,.25)}}
function tickCharge(dt){if(!CHG.a)return;if(!play.model||groundMode!=='play'||level!=='ground'){chargeCancel();return}CHG.t+=dt;const k=Math.min(1,CHG.t/CHG.max),F=CHG.F;
  const hand=play.model.getObjectByName('R_hand_container'),p=new V3();if(hand)hand.getWorldPosition(p);else p.set(play.x,groundH(groundWorld,play.x,play.z)+1.4,-play.z);
  CHG.orb.position.copy(p);const u=CHG.orb.material.uniforms;u.size.value=.35+k*1.3+Math.sin(CHG.t*18)*.06*k;u.spin.value+=dt*(3+k*9);
  // energy pulled in from a ring around the caster
  if(Math.random()<.6+k){const a=Math.random()*TAU,r=1.4+Math.random()*1.2,s=new V3(Math.cos(a)*r,(Math.random()-.3)*1.4,Math.sin(a)*r);const q=p.clone().add(s);
    vfxEmit('projectiles',q.x,q.y,-q.z,1,{dir:{x:-s.x,y:-s.y,z:s.z},pow:.22,life:1.6,color:F.charge.color,scale:1.4})}
  CHG.ringT-=dt;if(CHG.ringT<=0){CHG.ringT=.45-k*.25;vfxRing(play.x,play.z,{color:F.charge.color,cell:CELL.rune,size:2+k*2.5,life:.6})}
  const st=k>=1?2:k>=.5?1:0;if(st>CHG.stage){CHG.stage=st;vfxRing(play.x,play.z,{color:st===2?'#fff1a0':F.charge.color,size:4+st*1.5,life:.5});vfxEmit('auras',play.x,groundH(groundWorld,play.x,play.z),play.z,18*st,{color:F.charge.color,jitter:1,scale:1.3})}
  chargeBar.querySelector('i').style.width=(k*100)+'%';if(k>=1)chargeBar.classList.add('full');
  if(CHG.t>CHG.max+1.2)chargeRelease()}// held too long: it fires by itself
let _useAbilityRaw=useAbility;
{const _ua=useAbility;_useAbilityRaw=_ua;useAbility=function(a){if(!a||!CH)return _ua.apply(this,arguments);if(CHG.a){if(CHG.a.id===a.id)return;chargeCancel()}
  const F=fxFor(a),t=now();
  if(F&&F.charge&&groundMode==='play'&&!(cds[a.id]>t)){const c=a.cost||{};if((c.a&&CH.act<c.a)||(c.m&&CH.mind<c.m))return _ua.apply(this,arguments);
    const p=currentTarget();if(!p||p.g.kind==='friendly')return _ua.apply(this,arguments);return chargeStart(a,F)}
  FXCTX={a,charge:0};try{const r=_ua.apply(this,arguments);if(F&&F.kind==='slash'&&cds[a.id]>t)fxMelee(F);if(F&&F.kind==='nova'&&!F.fromSky&&cds[a.id]>t)fxImpact(F.impact,new V3(play.x,groundH(groundWorld,play.x,play.z)+.4,-play.z));return r}finally{FXCTX=null}}}
// melee charge (ground slam) releases into the slash; ranged charges release through vfxBolt / gunFx
{const _cr=chargeRelease;chargeRelease=function(){const a=CHG.a,F=CHG.F,k=Math.min(1,CHG.t/CHG.max);const before=a&&cds[a.id];_cr();if(a&&F&&F.kind==='slash'&&cds[a.id]!==before)fxMelee(F,1+k*.6)}}
addEventListener('keyup',e=>{if(!CHG.a)return;const m=e.code&&e.code.match(/^Digit(\d)$/);if(m)chargeRelease()},true);
addEventListener('mouseup',()=>{if(CHG.a&&CHG.t>.15)chargeRelease()});
/* ---- camera shake on heavy impacts (decays fast, never over 0.6 m) ---- */
{const _up=updatePlay;updatePlay=function(dt){const r=_up.apply(this,arguments);if(fxShake>0&&level==='ground'){const s=Math.min(.6,fxShake)*.35;cam.position.x+=(Math.random()-.5)*s;cam.position.y+=(Math.random()-.5)*s;fxShake=Math.max(0,fxShake-dt*2.2)}return r}}
{const _gt=gameTick;gameTick=function(dt){_gt(dt);try{tickCharge(dt);tickCombatFx(dt)}catch(e){console.warn('combat fx',e.stack)}}}
{const _bg=buildGround;buildGround=function(w){chargeCancel();for(const f of FXL)fxKill(f);FXL.length=0;return _bg.apply(this,arguments)}}

/* ================= Planet picker: scrolling + live planet renders =================
   The framed-window skin set #psel .ps-card to overflow:visible, so the list could not scroll with the wheel or keys.
   The card is now a fixed-height column and the grid scrolls inside it (wheel, touch, arrow keys, Page Up/Down, Home/End).
   Thumbnails are rendered from the same terrain texture the planet view uses, lit, with an atmosphere rim, so they show
   how each world looks now; renders are cached and drawn one per frame so the window opens instantly. */
{const st=document.createElement('style');st.textContent=`
#psel .ps-card{display:flex;flex-direction:column;max-height:calc(100vh - 32px);max-height:calc(100dvh - 32px);min-height:0}
#psel .ps-grid{overflow-y:auto;overscroll-behavior:contain;min-height:0;flex:1 1 auto;padding:2px 6px 6px 2px;scroll-behavior:smooth;outline:none;
  scrollbar-width:thin;scrollbar-color:rgba(255,210,140,.55) transparent}
#psel .ps-grid:focus-visible{box-shadow:inset 0 0 0 2px rgba(255,210,140,.5);border-radius:8px}
#psel .ps-grid::-webkit-scrollbar{width:8px}#psel .ps-grid::-webkit-scrollbar-thumb{background:rgba(255,210,140,.5);border-radius:4px}
#psel .ps-thumb{width:132px;height:132px;display:grid;place-items:center}#psel .ps-thumb canvas{width:132px;height:132px}
#psel .ps-planet small.ps-biome{color:var(--muted);font-size:11px;opacity:.85;margin-top:-4px}`;document.head.appendChild(st)}
const PS_ATMO={desert:'#ffd29a',badlands:'#ffb27a',volcanic:'#ff7a3a',ice:'#cfeaff',tundra:'#d8ecff',swamp:'#9fe0a0',jungle:'#8fe6b0',forest:'#a6e0ff',ocean:'#7fc4ff'};
const psCache=new Map();let psRT=null,psScene=null,psCam=null,psSphere=null,psAtmo=null;
function psSetup(){if(psRT)return;const N=264;psRT=new THREE.WebGLRenderTarget(N,N,{depthBuffer:true});
  psScene=new THREE.Scene();psCam=new THREE.PerspectiveCamera(30,1,.1,50);psCam.position.set(0,0,4.1);
  psScene.add(new THREE.AmbientLight(0x5a6a88,.16));const sun=new THREE.DirectionalLight(0xfff2e0,1.25);sun.position.set(-3,1.6,2.4);psScene.add(sun);
  psSphere=new THREE.Mesh(new THREE.SphereGeometry(1,64,48),new THREE.MeshLambertMaterial({color:0xffffff}));psSphere.rotation.set(.32,0,.12);psScene.add(psSphere);
  psAtmo=new THREE.Mesh(new THREE.SphereGeometry(1.08,48,32),new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.BackSide,uniforms:{c:{value:new THREE.Color()}},
    vertexShader:`varying vec3 vN;varying vec3 vV;void main(){vN=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`uniform vec3 c;varying vec3 vN;varying vec3 vV;void main(){float f=pow(1.-abs(dot(vN,vV)),2.2);float lit=clamp(dot(vN,normalize(vec3(-3.,1.6,2.4)))*.6+.55,0.,1.);gl_FragColor=vec4(c*f*1.5*lit,1.);}`}));psScene.add(psAtmo)}
function psAtmoColor(w){const b=(w.biome&&w.biome.name||w.biome&&w.biome.key||'').toLowerCase(),S=w.surf||{};for(const k in PS_ATMO)if(b.includes(k))return PS_ATMO[k];
  if(S.lava)return PS_ATMO.volcanic;if((S.aridity||0)>.55)return PS_ATMO.desert;if(S.snow&&!S.grass)return PS_ATMO.ice;return '#8fc8ff'}
function psRender(w,size=132){if(psCache.has(w.id))return psCache.get(w.id);psSetup();
  const tex=planetTexture(w);psSphere.material.map=tex;psSphere.material.needsUpdate=true;psSphere.rotation.y=(w.seed%628)/100;psAtmo.material.uniforms.c.value.set(psAtmoColor(w));
  const prevRT=renderer.getRenderTarget(),prevClear=renderer.getClearColor(new THREE.Color()),prevA=renderer.getClearAlpha();
  renderer.setRenderTarget(psRT);renderer.setClearColor(0x000000,0);renderer.clear();renderer.render(psScene,psCam);
  const N=psRT.width,buf=new Uint8Array(N*N*4);renderer.readRenderTargetPixels(psRT,0,0,N,N,buf);renderer.setRenderTarget(prevRT);renderer.setClearColor(prevClear,prevA);
  const src=document.createElement('canvas');src.width=src.height=N;const sx=src.getContext('2d'),img=sx.createImageData(N,N);
  for(let y=0;y<N;y++)img.data.set(buf.subarray((N-1-y)*N*4,(N-y)*N*4),y*N*4);sx.putImageData(img,0,0);
  const cv=document.createElement('canvas');cv.width=cv.height=size*2;const x=cv.getContext('2d');x.drawImage(src,0,0,cv.width,cv.height);psCache.set(w.id,cv);return cv}
function psClone(cv){const c=document.createElement('canvas');c.width=cv.width;c.height=cv.height;c.getContext('2d').drawImage(cv,0,0);return c}
{const _o=openPlanetSelect;openPlanetSelect=function(c){_o.apply(this,arguments);const grid=psel.querySelector('.ps-grid');if(!grid)return;grid.tabIndex=0;
  // biome line under each name, then swap the flat placeholders for real renders, one per frame
  const els=[...psel.querySelectorAll('.ps-planet')];
  for(const el of els){const w=WORLDS.find(x=>x.id===el.dataset.w);const bn=w&&w.biome&&(w.biome.label||w.biome.name);if(bn){const s=document.createElement('small');s.className='ps-biome';s.textContent=titleCase(String(bn).replace(/_/g,' '));el.querySelector('b').after(s)}
    if(w&&psCache.has(w.id)){const t=el.querySelector('.ps-thumb');t.innerHTML='';t.append(psClone(psCache.get(w.id)))}}
  let i=0;const step=()=>{if(psel.hidden)return;while(i<els.length&&psCache.has(els[i].dataset.w))i++;if(i>=els.length)return;const el=els[i++],w=WORLDS.find(x=>x.id===el.dataset.w);
    try{const cv=psRender(w);const t=el.querySelector('.ps-thumb');t.innerHTML='';t.append(psClone(cv))}catch(e){console.warn('planet thumb',e)}requestAnimationFrame(step)};
  requestAnimationFrame(step);
  // the current planet first in view, focus the list so the keys scroll it straight away
  setTimeout(()=>{try{grid.focus({preventScroll:true})}catch(e){}const cur=els.find(el=>el.dataset.w===c.planet);if(cur)cur.scrollIntoView({block:'nearest'})},30)}}
// keys while the picker is open scroll the list and never reach the game (no walking or camera moves behind it)
addEventListener('keydown',e=>{if(psel.hidden)return;const grid=psel.querySelector('.ps-grid');if(!grid)return;const tag=e.target&&e.target.tagName;
  if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();const x=$('#psX');if(x)x.click();return}
  if(tag==='SELECT'&&/Arrow(Up|Down)/.test(e.key))return;// let the arrival dropdown use its own arrows
  const page=grid.clientHeight*.85,row=(grid.querySelector('.ps-planet')||{offsetHeight:220}).offsetHeight+10;
  const d={ArrowDown:row,ArrowUp:-row,PageDown:page,PageUp:-page,' ':page,Home:-1e9,End:1e9,s:row,w:-row,S:row,W:-row}[e.key];
  if(d!=null&&!(tag==='BUTTON'&&e.key===' ')){e.preventDefault();e.stopImmediatePropagation();grid.scrollBy({top:d,behavior:Math.abs(d)>1e8?'auto':'smooth'});return}
  e.stopImmediatePropagation()},true);
// the wheel scrolls the list, never zooms the world behind the dialog
psel.addEventListener('wheel',e=>{e.stopPropagation();const grid=psel.querySelector('.ps-grid');if(grid&&!grid.contains(e.target)){e.preventDefault();grid.scrollBy({top:e.deltaY})}},{passive:false});

/* ================= Playtest build: resilience, bug reports, performance overlay, welcome card =================
   - A thrown error inside one system no longer freezes the game: the frame loop keeps going, the error is logged once.
   - F8 (or Menu > Report a bug) files a report with a screenshot, where you are, what the game was doing, the last errors
     and the frame rate. It saves to the playtest feedback store when the game has one (artifact or Railway backend) and can
     always be downloaded as a file.
   - F3 shows frame time, draw calls, triangles and memory.
   - First visit shows what to test and how; reopen it from the menu. */
const GG_BUILD='playtest-2026.11.27';
const PT={log:[],fps:[],shown:false};
function ptLog(kind,msg){const s=String(msg||'').slice(0,400);const last=PT.log[PT.log.length-1];if(last&&last.m===s){last.n++;return}PT.log.push({t:new Date().toISOString(),k:kind,m:s,n:1});if(PT.log.length>60)PT.log.shift()}
addEventListener('error',e=>ptLog('error',(e.message||'')+' @'+(e.filename||'').split('/').pop()+':'+(e.lineno||'')));
addEventListener('unhandledrejection',e=>ptLog('promise',e.reason&&(e.reason.stack||e.reason.message)||e.reason));
{const ce=console.error.bind(console),cw=console.warn.bind(console);console.error=(...a)=>{ptLog('console',a.map(x=>x&&x.message||String(x)).join(' '));ce(...a)};console.warn=(...a)=>{ptLog('warn',a.map(x=>x&&x.message||String(x)).join(' '));cw(...a)}}
// keep the loop alive: each wrapped system fails on its own
function ptGuard(name,fn){let errs=0;return function(){try{return fn.apply(this,arguments)}catch(e){errs++;if(errs<4||errs%600===0)ptLog('tick',name+': '+(e&&e.stack||e).toString().split('\n').slice(0,2).join(' '));if(errs===1)console.warn('[playtest] '+name+' failed, the game keeps running',e)}}}
gameTick=ptGuard('gameTick',gameTick);updatePlay=ptGuard('updatePlay',updatePlay);
// frame timing for the overlay and reports
{let lastT=performance.now();(function fpsTick(now){const d=now-lastT;lastT=now;if(d>0&&d<1000){PT.fps.push(d);if(PT.fps.length>120)PT.fps.shift()}requestAnimationFrame(fpsTick)})(lastT)}
const ptFps=()=>{if(!PT.fps.length)return{fps:0,ms:0,worst:0};const a=PT.fps,avg=a.reduce((s,x)=>s+x,0)/a.length;return{fps:Math.round(1000/avg),ms:+avg.toFixed(1),worst:+Math.max(...a).toFixed(0)}};
{const s=document.createElement('style');s.textContent=`#ptHud{position:fixed;right:8px;top:64px;z-index:40;font:11px/1.35 ui-monospace,Menlo,monospace;color:#cfe;background:rgba(6,10,16,.78);border:1px solid rgba(120,200,255,.3);border-radius:6px;padding:6px 8px;pointer-events:none;white-space:pre}
#ptModal{position:fixed;inset:0;z-index:70;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55)}#ptModal[hidden]{display:none}
#ptModal .box{width:min(560px,94vw);max-height:90vh;overflow:auto;background:#141820;color:#e9e4d6;border:1px solid rgba(240,200,120,.4);border-radius:10px;padding:16px 18px;font:14px/1.45 system-ui,sans-serif;box-shadow:0 20px 60px rgba(0,0,0,.6)}
#ptModal h2{margin:0 0 8px;font-size:18px;color:#f0c878}#ptModal textarea{width:100%;min-height:96px;box-sizing:border-box;background:#0c0f14;color:#eee;border:1px solid #3a4250;border-radius:6px;padding:8px;font:inherit}
#ptModal select{background:#0c0f14;color:#eee;border:1px solid #3a4250;border-radius:6px;padding:4px 6px}#ptModal .row{display:flex;gap:8px;align-items:center;margin:8px 0;flex-wrap:wrap}
#ptModal button{background:#2a3242;color:#f2ead8;border:1px solid #556;border-radius:6px;padding:7px 12px;font:600 13px system-ui;cursor:pointer}#ptModal button.pri{background:#b8862e;border-color:#e0b060;color:#1a1408}
#ptModal img{max-width:100%;border-radius:6px;border:1px solid #333;margin-top:6px}#ptModal ul{margin:6px 0 8px 18px;padding:0}#ptModal kbd{background:#222a36;border:1px solid #445;border-radius:4px;padding:0 5px;font-size:12px}
#ptModal small{color:#9aa}`;document.head.append(s);
  const h=document.createElement('div');h.id='ptHud';h.hidden=true;document.body.append(h);const m=document.createElement('div');m.id='ptModal';m.hidden=true;m.innerHTML='<div class="box"></div>';document.body.append(m);
  m.addEventListener('click',e=>{if(e.target===m)ptClose()})}
const ptClose=()=>{$('#ptModal').hidden=true};
function ptState(){const r=renderer.info,f=ptFps(),U=play.model&&play.model.userData;return{build:GG_BUILD,at:new Date().toISOString(),ua:navigator.userAgent,screen:innerWidth+'x'+innerHeight+'@'+devicePixelRatio,
  quality,level,mode:groundMode,planet:groundWorld&&groundWorld.id,pos:CH?{x:Math.round(play.x),z:Math.round(play.z)}:null,char:CH?{name:CH.name,race:CH.race,cls:CH.cls,cl:CH.level||null}:null,
  anim:U&&U.state,mount:play.mount&&play.mount.id,busy,cine:typeof CINE!=='undefined'&&CINE.on,net:Store.mode,fps:f,gpu:{calls:r.render.calls,tris:r.render.triangles,geo:r.memory.geometries,tex:r.memory.textures},errors:PT.log.slice(-25)}}
function ptShot(){try{renderer.render(scene,cam);const c=document.createElement('canvas'),src=renderer.domElement,w=Math.min(960,src.width),h=Math.round(src.height*w/src.width);c.width=w;c.height=h;c.getContext('2d').drawImage(src,0,0,w,h);return c.toDataURL('image/jpeg',.72)}catch(e){return null}}
async function ptSave(rep){try{const db=window.claude&&window.claude.use?await window.claude.use('db'):null,user=db&&await window.claude.use('user');const id=user&&await user.id();
    if(db&&id){await db.collection('data/users/'+id+'/feedback').doc('r'+Date.now().toString(36)).set(rep);return true}}catch(e){ptLog('warn','report save: '+e.message)}return false}
async function ptDownload(rep){const name='grudge-playtest-'+(rep.state.planet||'galaxy')+'-'+Date.now()+'.json';try{const d=window.claude&&window.claude.use&&await window.claude.use('downloads');if(d){await d.save({filename:name,data:JSON.stringify(rep,null,1)});return}}catch(e){}
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(rep,null,1)],{type:'application/json'}));a.download=name;document.body.append(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)}
function ptReport(){const shot=ptShot(),state=ptState(),M=$('#ptModal'),B=M.querySelector('.box');keys&&keys.clear&&keys.clear();
  B.innerHTML=`<h2>Report a bug or idea</h2><div class="row"><select id="ptKind"><option value="bug">Bug</option><option value="perf">Slow / laggy</option><option value="visual">Looks wrong</option><option value="balance">Too hard / too easy</option><option value="idea">Idea</option></select>
   <select id="ptSev"><option value="minor">Minor</option><option value="major">Major</option><option value="blocker">Blocks play</option></select></div>
   <textarea id="ptText" placeholder="What happened, and what did you expect? Steps to repeat it help most."></textarea>
   <small>Sent with it: a screenshot, your planet and position, what your character was doing, frame rate, graphics stats and the last ${state.errors.length} logged errors. No passwords or personal data.</small>
   ${shot?`<img src="${shot}" alt="Screenshot that will be attached">`:''}
   <div class="row"><button class="pri" id="ptSend">Send report</button><button id="ptDl">Download as file</button><button id="ptX">Cancel</button><small id="ptMsg"></small></div>`;
  M.hidden=false;setTimeout(()=>$('#ptText').focus(),30);
  const rep=()=>({kind:$('#ptKind').value,severity:$('#ptSev').value,text:$('#ptText').value.slice(0,4000),state,shot});
  $('#ptX').onclick=ptClose;$('#ptDl').onclick=()=>ptDownload(rep());
  $('#ptSend').onclick=async()=>{const r=rep();if(!r.text.trim()){$('#ptMsg').textContent='Add a line about what happened first.';return}$('#ptSend').disabled=true;$('#ptMsg').textContent='Sending…';
    const ok=await ptSave(r);if(ok){ptClose();toast('Thanks! Report sent.')}else{$('#ptMsg').textContent='No feedback store here, so it was saved as a file instead.';ptDownload(r)}$('#ptSend').disabled=false}}
function ptWelcome(){const M=$('#ptModal'),B=M.querySelector('.box');
  B.innerHTML=`<h2>Grudge Galaxies playtest</h2><p>Thanks for testing. Build <b>${GG_BUILD}</b>. Play normally, and press <kbd>F8</kbd> any time something breaks, looks wrong or feels off.</p>
   <p><b>Controls</b></p><ul><li><kbd>W A S D</kbd> move · <kbd>Shift</kbd> run · <kbd>Space</kbd> jump (running jumps can vault) · right-drag to look</li>
   <li><kbd>R</kbd> gather a resource node, or board the glow whale from its beam at a starport</li><li><kbd>Tab</kbd> target · <kbd>1</kbd>–<kbd>0</kbd> abilities · <kbd>U</kbd> survey · <kbd>J</kbd> sample · <kbd>C</kbd> craft · <kbd>I</kbd> inventory</li>
   <li><kbd>Shift</kbd>+<kbd>M</kbd> planet map and waypoints · <kbd>Esc</kbd> menu · <kbd>Enter</kbd> chat (<code>/help</code> lists emotes)</li><li><kbd>F3</kbd> performance overlay · <kbd>F8</kbd> report</li></ul>
   <p><b>Please try</b></p><ul><li>Make a character and walk out of town; gather from a few resource nodes</li><li>Hunt something and skin it; craft an item at a bench</li>
   <li>Ride the glow whale from a starport to another planet and back</li><li>Visit Vashtar's giant forest and Sarrak's Ashport</li><li>Play with a friend: chat, emotes, and see each other move</li></ul>
   <p><small>Saves follow your account when the game has a backend; otherwise they stay in this browser. If it runs slowly, set Graphics quality to Low in the menu.</small></p>
   <div class="row"><button class="pri" id="ptGo">Start playing</button></div>`;
  M.hidden=false;$('#ptGo').onclick=()=>{ptClose();try{localStorage.setItem('gg.pt.seen',GG_BUILD)}catch(e){}}}
addEventListener('keydown',e=>{if(e.key==='F8'){e.preventDefault();if($('#ptModal').hidden)ptReport();else ptClose()}
  else if(e.key==='F3'){e.preventDefault();const h=$('#ptHud');h.hidden=!h.hidden}
  else if(e.key==='Escape'&&!$('#ptModal').hidden){ptClose();e.stopImmediatePropagation()}},true);
// typing in the report box must not move the character or trigger hotkeys
addEventListener('keydown',e=>{if(!$('#ptModal').hidden&&!/F8|F3|Escape/.test(e.key))e.stopImmediatePropagation()},true);
{let hudT=0;const _gt=gameTick;gameTick=function(dt){_gt(dt);const h=$('#ptHud');if(h.hidden||(hudT-=dt)>0)return;hudT=.5;const f=ptFps(),r=renderer.info;
  h.textContent=`${GG_BUILD}\nfps ${f.fps}  ${f.ms} ms  worst ${f.worst} ms\ncalls ${r.render.calls}  tris ${(r.render.triangles/1e3).toFixed(0)}k\ngeo ${r.memory.geometries}  tex ${r.memory.textures}\n${quality} · ${groundWorld?groundWorld.id:level}${CH?` · ${Math.round(play.x)}, ${Math.round(play.z)}`:''}\nerrors ${PT.log.filter(x=>x.k!=='warn').length}`}}
// menu: report + welcome + build label
{const _me=menuExtras;menuExtras=function(){_me();const B=$('#gwBody');if(!B||B.querySelector('.pt-row'))return;const s=document.createElement('section');s.className='pt-row';
  s.innerHTML=`<h3>Playtest</h3><p class="gw-note">Build ${GG_BUILD}</p><div class="gw-menu"><button class="btn" id="ptRep">Report a bug (F8)</button><button class="btn" id="ptWel">What to test</button><button class="btn" id="ptPerf">Performance overlay (F3)</button></div>`;
  B.prepend(s);$('#ptRep').onclick=()=>{closeWin();ptReport()};$('#ptWel').onclick=()=>{closeWin();ptWelcome()};$('#ptPerf').onclick=()=>{const h=$('#ptHud');h.hidden=!h.hidden}}}
setTimeout(()=>{let seen=null;try{seen=localStorage.getItem('gg.pt.seen')}catch(e){}if(seen!==GG_BUILD&&!/[?&]debug\b/.test(location.search))ptWelcome()},1800);
// the frame loop itself: if anything in a frame throws before it reschedules, schedule the next frame anyway
{const _fr=frame;frame=function(now){try{_fr(now)}catch(e){ptLog('frame',(e&&e.stack||e).toString().split('\n').slice(0,2).join(' '));requestAnimationFrame(frame)}}}

// bridge for the typed modules in src/ (physics, animation, skills): read live state and wrap runtime functions
window.GG_BRIDGE={
  get play(){return play},get keys(){return keys},get groundWorld(){return groundWorld},get level(){return level},get groundMode(){return groundMode},
  get kitMeshes(){return kitMeshes},get G(){return G},get cam(){return cam},get scene(){return scene},get renderer(){return renderer},get quality(){return quality},
  get CH(){return CH},get rts(){return rts},get combat(){return combat},get hunt(){return hunt},get selPlacement(){return selPlacement},set selPlacement(v){selPlacement=v},get mouselook(){return mouselook},HALF,EXT,
  markDirty:()=>markDirty(),renderHud:()=>renderHud(),gainXP:(t,n,w)=>gainXP(t,n,w),openWin:k=>openWin(k),toonOneShot:(m,k)=>toonOneShot(m,k),charStats:()=>charStats(),knownAbilities:()=>knownAbilities(),
  get interact(){return interact},set interact(v){interact=v},get promptEl(){return promptEl},get nodeNear(){return typeof nodeNear!=='undefined'?nodeNear:null},get npcToons(){return npcToons},
  get terminals(){return terminals},get TERMINALS(){return TERMINALS},get gwHidden(){return gw.hidden},get buffs(){return buffs},get waypoint(){return waypoint},get parkedCart(){return parkedCart},
  fn:{startGather:()=>typeof startGather==='function'&&startGather(),harvestCorpse:(p,k)=>harvestCorpse(p,k),addBuff:(...a)=>addBuff(...a),setWaypoint:(x,z,l)=>setWaypoint(x,z,l),
    nearTravel:()=>nearTravel(),travelPoints:w=>travelPoints(w),setVendor:n=>{vendorName=n},combatLevel:()=>combatLevel(),hamMax:()=>hamMax(),selectPlacement:i=>selectPlacement(i),mmHud:()=>mmHud(),
    setMissionTerminal:t=>{missionTerminal=t;boardSalt=0},npcStrike:(p,u)=>npcStrike(p,u),npcCallPack:(c,p,r)=>npcCallPack(c,p,r),isNight:()=>isNight(),
    standing:f=>standing(f),creatureFaction:cat=>CREATURE_FACTION[cat],mmLog:(m,k)=>mmLog(m,k||'combat'),toonOneShot:(o,k)=>toonOneShot(o,k),incapacitated:()=>!CH||CH.hp<=0},
  get GD(){return GD},get RACE(){return RACE},get CLASS(){return CLASS},get FACTION(){return FACTION},get WORLDS(){return WORLDS},get PLANET_FACTION(){return PLANET_FACTION},planetName:w=>planetName(w),nearestPoi:(w,x,z)=>nearestPoi(w,x,z),
  groundH:(w,x,z)=>groundH(w,x,z),waterDepth:(w,x,z)=>waterDepth(w,x,z),toast:m=>toast(m),floatMsg:m=>floatMsg(m),
  wrap(name,make){const W={updatePlay:()=>{updatePlay=make(updatePlay)},gameTick:()=>{gameTick=make(gameTick)},buildGround:()=>{buildGround=make(buildGround)},
      applyKits:()=>{applyKits=make(applyKits)},rideUpdate:()=>{rideUpdate=make(rideUpdate)},playCharacter:()=>{playCharacter=make(playCharacter)},thinkCreature:()=>{thinkCreature=make(thinkCreature)},useAbility:()=>{useAbility=make(useAbility)},killNpc:()=>{killNpc=make(killNpc)},huntKill:()=>{huntKill=make(huntKill)},openWin:()=>{openWin=make(openWin)},tickInteract:()=>{tickInteract=make(tickInteract)},toggleEquip:()=>{toggleEquip=make(toggleEquip)},startSample:()=>{startSample=make(startSample)}};
    if(!W[name])throw new Error('GG_BRIDGE.wrap: unknown '+name);W[name]()}};
window.dispatchEvent(new Event('gg:bridge'));

// test hook: only with ?debug in the address, lets automated checks read game state
try{if(/[?&]debug\b/.test(location.search))window.__gg=src=>eval(src)}catch(e){}
})();
