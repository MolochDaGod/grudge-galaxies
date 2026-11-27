const G='/home/claude/.npm-global/lib/node_modules/@gltf-transform/cli/node_modules/';
const {NodeIO,Document}=await import(G+'@gltf-transform/core/dist/index.js');const {ALL_EXTENSIONS}=await import(G+'@gltf-transform/extensions/dist/index.js');const F=await import(G+'@gltf-transform/functions/dist/index.js');
import fs from 'fs';
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);const SK=process.argv[2],TU=process.argv[3],OUT=process.argv[4];
const slug=s=>s.replace(/\.glb$/,'').replace(/-[A-Za-z0-9]{10}$/,m=>'_'+m.slice(1,3).toLowerCase()).replace(/[^A-Za-z0-9]+/g,'_').toLowerCase();
// 1) static pack
const pack=new Document();pack.createBuffer();const PS=pack.createScene('pack');
const STATIC=fs.readdirSync(SK).filter(f=>/^(Base|Building|Connector|Geodesic|House|Metal|Roof|Round Rover|Rover|Solar|Spaceship|Stairs|Ramp|Pickup Crate)/.test(f)).map(f=>[SK+'/'+f,'sk_'+slug(f)])
  .concat(fs.readdirSync(TU).filter(f=>f.endsWith('.glb')).map(f=>[TU+'/'+f,'skt_'+slug(f).replace(/_turret$/,'')]));
const names=[];
for(const [file,name] of STATIC){const d=await io.read(file);
  const sc=d.getRoot().listScenes()[0];const wrap=d.createNode(name);for(const c of sc.listChildren()){sc.removeChild(c);wrap.addChild(c)}sc.addChild(wrap);
  for(const a of d.getRoot().listAnimations())a.dispose();for(const s of d.getRoot().listSkins())s.dispose();
  const map=F.mergeDocuments(pack,d);const ns=map.get(sc);for(const c of ns.listChildren()){ns.removeChild(c);PS.addChild(c)}ns.dispose();names.push(name)}
for(const b of pack.getRoot().listBuffers().slice(1)){for(const a of pack.getRoot().listAccessors())if(a.getBuffer()===b)a.setBuffer(pack.getRoot().listBuffers()[0]);b.dispose()}
for(const mt of pack.getRoot().listMaterials()){mt.setMetallicFactor(0);mt.setRoughnessFactor(Math.max(.6,mt.getRoughnessFactor()))}
await pack.transform(F.dedup(),F.prune(),F.weld(),F.quantize());await io.write(OUT+'/spacekit.glb',pack);fs.writeFileSync(OUT+'/spacekit_names.json',JSON.stringify(names));console.log('pack',names.length);
// 2) alien trees, one file each
const TREES={'Tree Light':'glowcap','Tree Swirl':'swirlwood','Tree Floating':'floatbloom','Tree Lava':'emberpine','Tree Spikes':'spinethorn','Tree Spiral':'coilstalk','Tree Blob':'blobpalm',
  'Tree Light-om4BJAL82T':'glowcap2','Tree Floating-sdtjU7iczl':'floatbloom2','Tree Blob-QHYRrAnKzW':'blobpalm2','Tree Spiral-gI3kqnqg80':'coilstalk2'};
for(const [f,id] of Object.entries(TREES)){const d=await io.read(SK+'/'+f+'.glb');for(const mt of d.getRoot().listMaterials()){mt.setMetallicFactor(0);mt.setRoughnessFactor(1)}
  await d.transform(F.dedup(),F.prune(),F.weld());await io.write(OUT+'/tree_'+id+'.glb',d)}
// 3) creatures: clip names the herd code understands
const CRE={'Enemy Large':['xeno_brute',{Idle:'Idle',Walk:'Walk',Run:'Gallop',Punch:'Attack',Death:'Death',Wave:'Idle_2',HitReact:'Hit'}],
  'Enemy Flying':['xeno_wasp',{Flying_Idle:'Idle',Fast_Flying:'Gallop',Headbutt:'Attack',Death:'Death',Yes:'Idle_2',HitReact:'Hit'}],
  'Enemy Small':['xeno_mite',{Flying_Idle:'Idle',Fast_Flying:'Gallop',Punch:'Attack',Death:'Death',No:'Idle_2',HitReact:'Hit'}],
  'Mech':['war_droid',{Idle:'Idle',Walk:'Walk',Run:'Gallop',Shoot_Small:'Attack',Death:'Death',Hello:'Idle_2',HitRecieve_1:'Hit',Yes:'Eating'}]};
for(const [f,[id,M]] of Object.entries(CRE)){const d=await io.read(SK+'/'+f+'.glb');
  for(const a of d.getRoot().listAnimations()){const n=a.getName().split('|').pop();if(M[n])a.setName(M[n]);else a.dispose()}
  const have=d.getRoot().listAnimations().map(a=>a.getName());if(!have.includes('Walk')){const g=d.getRoot().listAnimations().find(a=>a.getName()==='Gallop');if(g){/* flyers glide: walk = slow fly */}}
  for(const mt of d.getRoot().listMaterials()){mt.setMetallicFactor(0);mt.setRoughnessFactor(1)}
  await d.transform(F.dedup(),F.prune());await io.write(OUT+'/an_'+id+'.glb',d);console.log(id,have.join(','))}
