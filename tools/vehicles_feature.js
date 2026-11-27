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
