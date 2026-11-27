const G='/home/claude/.npm-global/lib/node_modules/@gltf-transform/cli/node_modules/';
const {NodeIO,Document}=await import(G+'@gltf-transform/core/dist/index.js');const {ALL_EXTENSIONS}=await import(G+'@gltf-transform/extensions/dist/index.js');const F=await import(G+'@gltf-transform/functions/dist/index.js');
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);const SK=process.argv[2];
const SRC=[['rk/namaqualand_boulder_02_2k.r.glb','nd_boulder_a'],['rk/namaqualand_boulder_04_2k.r.glb','nd_boulder_b'],['rk/namaqualand_boulder_06_2k.r.glb','nd_boulder_c'],
  ['rk/lichen_rock_2k.r.glb','nd_lichen'],['rk/rock_moss_set_02_2k.r.glb','nd_mossy'],[SK+'/Plant.glb','nd_plant_a'],[SK+'/Plant-VwXvoIpCHP.glb','nd_plant_b'],[SK+'/Bush-RfUP3gXj69.glb','nd_bush'],[SK+'/Rock Large-li0YBlBEMz.glb','nd_crystal']];
const pack=new Document();pack.createBuffer();const PS=pack.createScene('nodes');
for(const [file,name] of SRC){const d=await io.read(file);const sc=d.getRoot().listScenes()[0];const wrap=d.createNode(name);for(const c of sc.listChildren()){sc.removeChild(c);wrap.addChild(c)}sc.addChild(wrap);
  const map=F.mergeDocuments(pack,d);const ns=map.get(sc);for(const c of ns.listChildren()){ns.removeChild(c);PS.addChild(c)}ns.dispose()}
for(const b of pack.getRoot().listBuffers().slice(1)){for(const a of pack.getRoot().listAccessors())if(a.getBuffer()===b)a.setBuffer(pack.getRoot().listBuffers()[0]);b.dispose()}
await pack.transform(F.dedup(),F.prune());await io.write('nodes.glb',pack);console.log('ok')
