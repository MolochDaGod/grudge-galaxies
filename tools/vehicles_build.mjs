// Quaternius Ultimate Spaceships (CC0) -> one small GLB per ship: 512px JPEG texture, welded, quantized.
const G='/home/claude/.npm-global/lib/node_modules/@gltf-transform/cli/node_modules/';
const {NodeIO}=await import(G+'@gltf-transform/core/dist/index.js');const {ALL_EXTENSIONS}=await import(G+'@gltf-transform/extensions/dist/index.js');const F=await import(G+'@gltf-transform/functions/dist/index.js');
import fs from 'fs';import {execFileSync} from 'child_process';
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);const [SRC,OUT]=process.argv.slice(2);
for(const f of fs.readdirSync(SRC)){const gl=`${SRC}/${f}/glTF/${f}.gltf`;if(!fs.existsSync(gl))continue;const d=await io.read(gl);
  for(const t of d.getRoot().listTextures()){fs.writeFileSync('/tmp/vt.png',Buffer.from(t.getImage()));execFileSync('python3',['-c',"from PIL import Image;Image.open('/tmp/vt.png').convert('RGB').resize((512,512),Image.LANCZOS).save('/tmp/vt.jpg',quality=85)"]);t.setImage(fs.readFileSync('/tmp/vt.jpg')).setMimeType('image/jpeg')}
  for(const mt of d.getRoot().listMaterials()){mt.setMetallicFactor(Math.min(.35,mt.getMetallicFactor()));mt.setRoughnessFactor(Math.max(.45,mt.getRoughnessFactor()))}
  for(const a of d.getRoot().listAnimations())a.dispose();
  await d.transform(F.dedup(),F.prune(),F.weld(),F.quantize());const b=await io.writeBinary(d);
  fs.writeFileSync(`${OUT}/${f.toLowerCase()}.glb`,b);console.log(f,(b.length/1024|0)+'KB')}
