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
    skinning:!!(src.skinning||o.skinned),morphTargets:!!src.morphTargets,roughness:o.rough??.86,metalness:o.metal??.03,envMapIntensity:.7});
  if(toon)m.color.setScalar(1);
  m.userData.pbr=true;pbrInject(m,o,src);byKind[kk]=m;PBR.mats.add(m);return m}
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
