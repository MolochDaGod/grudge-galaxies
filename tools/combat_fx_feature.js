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
{const _gt=gameTick;gameTick=function(dt){_gt(dt);try{tickCharge(dt);tickCombatFx(dt)}catch(e){console.warn('combat fx',e)}}}
{const _bg=buildGround;buildGround=function(w){chargeCancel();for(const f of FXL)fxKill(f);FXL.length=0;return _bg.apply(this,arguments)}}
