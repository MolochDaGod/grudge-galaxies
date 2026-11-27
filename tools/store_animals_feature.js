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
      g.scene.updateMatrixWorld(true);const box=new THREE.Box3(),v=new THREE.Vector3();g.scene.traverse(o=>{if(!o.isSkinnedMesh)return;o.skeleton.update();const n=o.geometry.attributes.position.count;for(let i=0;i<n;i+=37){o.boneTransform(i,v);v.applyMatrix4(o.matrixWorld);box.expandByPoint(v)}});
      if(box.isEmpty())box.setFromObject(g.scene);animalG[id]={scene:g.scene,clips:g.animations,h:box.max.y-box.min.y,minY:box.min.y};res()},e=>{console.warn('animal '+id,e);res()})})).catch(e=>{console.warn('store animal '+id+' unavailable',e)});
  return animalLoading[id]}}
{const _ma=makeAnimal;makeAnimal=function(id){const a=_ma(id);if(a&&STORE_ANIMALS[id]&&animalG[id].minY!=null){const inner=a.obj.children[0];if(inner)inner.position.y=-animalG[id].minY}return a}}
