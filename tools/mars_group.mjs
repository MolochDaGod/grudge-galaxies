const G='/home/claude/.npm-global/lib/node_modules/@gltf-transform/cli/node_modules/';
const {NodeIO}=await import(G+'@gltf-transform/core/dist/index.js');const {ALL_EXTENSIONS}=await import(G+'@gltf-transform/extensions/dist/index.js');const F=await import(G+'@gltf-transform/functions/dist/index.js');
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);const doc=await io.read('mars_split_raw.glb');const R=doc.getRoot(),sc=R.listScenes()[0];const groups={};
for(const n of sc.listChildren()){const m=/^m(\d+)_/.exec(n.getName());if(!m)continue;const k='mars_'+m[1];if(!groups[k]){groups[k]=doc.createNode(k);sc.addChild(groups[k])}sc.removeChild(n);groups[k].addChild(n)}
// flat colours from the Sketchfab materials; no textures in this kit
for(const mt of R.listMaterials()){mt.setMetallicFactor(0);mt.setRoughnessFactor(1)}
await doc.transform(F.dedup(),F.prune(),F.weld(),F.quantize());await io.write('mars_pack.glb',doc);console.log(Object.keys(groups).length,'groups')
