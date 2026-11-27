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
