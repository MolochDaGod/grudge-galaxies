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
function whaleSkinMat(src,U,belly){const m=new THREE.MeshStandardMaterial({color:belly?WHALE_COL.belly:WHALE_COL.hide,roughness:.38,metalness:.15,skinning:true,side:THREE.DoubleSide,envMapIntensity:.8});
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
