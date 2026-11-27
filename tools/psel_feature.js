/* ================= Planet picker: scrolling + live planet renders =================
   The framed-window skin set #psel .ps-card to overflow:visible, so the list could not scroll with the wheel or keys.
   The card is now a fixed-height column and the grid scrolls inside it (wheel, touch, arrow keys, Page Up/Down, Home/End).
   Thumbnails are rendered from the same terrain texture the planet view uses, lit, with an atmosphere rim, so they show
   how each world looks now; renders are cached and drawn one per frame so the window opens instantly. */
{const st=document.createElement('style');st.textContent=`
#psel .ps-card{display:flex;flex-direction:column;max-height:calc(100vh - 32px);max-height:calc(100dvh - 32px);min-height:0}
#psel .ps-grid{overflow-y:auto;overscroll-behavior:contain;min-height:0;flex:1 1 auto;padding:2px 6px 6px 2px;scroll-behavior:smooth;outline:none;
  scrollbar-width:thin;scrollbar-color:rgba(255,210,140,.55) transparent}
#psel .ps-grid:focus-visible{box-shadow:inset 0 0 0 2px rgba(255,210,140,.5);border-radius:8px}
#psel .ps-grid::-webkit-scrollbar{width:8px}#psel .ps-grid::-webkit-scrollbar-thumb{background:rgba(255,210,140,.5);border-radius:4px}
#psel .ps-thumb{width:132px;height:132px;display:grid;place-items:center}#psel .ps-thumb canvas{width:132px;height:132px}
#psel .ps-planet small.ps-biome{color:var(--muted);font-size:11px;opacity:.85;margin-top:-4px}`;document.head.appendChild(st)}
const PS_ATMO={desert:'#ffd29a',badlands:'#ffb27a',volcanic:'#ff7a3a',ice:'#cfeaff',tundra:'#d8ecff',swamp:'#9fe0a0',jungle:'#8fe6b0',forest:'#a6e0ff',ocean:'#7fc4ff'};
const psCache=new Map();let psRT=null,psScene=null,psCam=null,psSphere=null,psAtmo=null;
function psSetup(){if(psRT)return;const N=264;psRT=new THREE.WebGLRenderTarget(N,N,{depthBuffer:true});
  psScene=new THREE.Scene();psCam=new THREE.PerspectiveCamera(30,1,.1,50);psCam.position.set(0,0,4.1);
  psScene.add(new THREE.AmbientLight(0x5a6a88,.16));const sun=new THREE.DirectionalLight(0xfff2e0,1.25);sun.position.set(-3,1.6,2.4);psScene.add(sun);
  psSphere=new THREE.Mesh(new THREE.SphereGeometry(1,64,48),new THREE.MeshLambertMaterial({color:0xffffff}));psSphere.rotation.set(.32,0,.12);psScene.add(psSphere);
  psAtmo=new THREE.Mesh(new THREE.SphereGeometry(1.08,48,32),new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.BackSide,uniforms:{c:{value:new THREE.Color()}},
    vertexShader:`varying vec3 vN;varying vec3 vV;void main(){vN=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`uniform vec3 c;varying vec3 vN;varying vec3 vV;void main(){float f=pow(1.-abs(dot(vN,vV)),2.2);float lit=clamp(dot(vN,normalize(vec3(-3.,1.6,2.4)))*.6+.55,0.,1.);gl_FragColor=vec4(c*f*1.5*lit,1.);}`}));psScene.add(psAtmo)}
function psAtmoColor(w){const b=(w.biome&&w.biome.name||w.biome&&w.biome.key||'').toLowerCase(),S=w.surf||{};for(const k in PS_ATMO)if(b.includes(k))return PS_ATMO[k];
  if(S.lava)return PS_ATMO.volcanic;if((S.aridity||0)>.55)return PS_ATMO.desert;if(S.snow&&!S.grass)return PS_ATMO.ice;return '#8fc8ff'}
function psRender(w,size=132){if(psCache.has(w.id))return psCache.get(w.id);psSetup();
  const tex=planetTexture(w);psSphere.material.map=tex;psSphere.material.needsUpdate=true;psSphere.rotation.y=(w.seed%628)/100;psAtmo.material.uniforms.c.value.set(psAtmoColor(w));
  const prevRT=renderer.getRenderTarget(),prevClear=renderer.getClearColor(new THREE.Color()),prevA=renderer.getClearAlpha();
  renderer.setRenderTarget(psRT);renderer.setClearColor(0x000000,0);renderer.clear();renderer.render(psScene,psCam);
  const N=psRT.width,buf=new Uint8Array(N*N*4);renderer.readRenderTargetPixels(psRT,0,0,N,N,buf);renderer.setRenderTarget(prevRT);renderer.setClearColor(prevClear,prevA);
  const src=document.createElement('canvas');src.width=src.height=N;const sx=src.getContext('2d'),img=sx.createImageData(N,N);
  for(let y=0;y<N;y++)img.data.set(buf.subarray((N-1-y)*N*4,(N-y)*N*4),y*N*4);sx.putImageData(img,0,0);
  const cv=document.createElement('canvas');cv.width=cv.height=size*2;const x=cv.getContext('2d');x.drawImage(src,0,0,cv.width,cv.height);psCache.set(w.id,cv);return cv}
function psClone(cv){const c=document.createElement('canvas');c.width=cv.width;c.height=cv.height;c.getContext('2d').drawImage(cv,0,0);return c}
{const _o=openPlanetSelect;openPlanetSelect=function(c){_o.apply(this,arguments);const grid=psel.querySelector('.ps-grid');if(!grid)return;grid.tabIndex=0;
  // biome line under each name, then swap the flat placeholders for real renders, one per frame
  const els=[...psel.querySelectorAll('.ps-planet')];
  for(const el of els){const w=WORLDS.find(x=>x.id===el.dataset.w);const bn=w&&w.biome&&(w.biome.label||w.biome.name);if(bn){const s=document.createElement('small');s.className='ps-biome';s.textContent=titleCase(String(bn).replace(/_/g,' '));el.querySelector('b').after(s)}
    if(w&&psCache.has(w.id)){const t=el.querySelector('.ps-thumb');t.innerHTML='';t.append(psClone(psCache.get(w.id)))}}
  let i=0;const step=()=>{if(psel.hidden)return;while(i<els.length&&psCache.has(els[i].dataset.w))i++;if(i>=els.length)return;const el=els[i++],w=WORLDS.find(x=>x.id===el.dataset.w);
    try{const cv=psRender(w);const t=el.querySelector('.ps-thumb');t.innerHTML='';t.append(psClone(cv))}catch(e){console.warn('planet thumb',e)}requestAnimationFrame(step)};
  requestAnimationFrame(step);
  // the current planet first in view, focus the list so the keys scroll it straight away
  setTimeout(()=>{try{grid.focus({preventScroll:true})}catch(e){}const cur=els.find(el=>el.dataset.w===c.planet);if(cur)cur.scrollIntoView({block:'nearest'})},30)}}
// keys while the picker is open scroll the list and never reach the game (no walking or camera moves behind it)
addEventListener('keydown',e=>{if(psel.hidden)return;const grid=psel.querySelector('.ps-grid');if(!grid)return;const tag=e.target&&e.target.tagName;
  if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();const x=$('#psX');if(x)x.click();return}
  if(tag==='SELECT'&&/Arrow(Up|Down)/.test(e.key))return;// let the arrival dropdown use its own arrows
  const page=grid.clientHeight*.85,row=(grid.querySelector('.ps-planet')||{offsetHeight:220}).offsetHeight+10;
  const d={ArrowDown:row,ArrowUp:-row,PageDown:page,PageUp:-page,' ':page,Home:-1e9,End:1e9,s:row,w:-row,S:row,W:-row}[e.key];
  if(d!=null&&!(tag==='BUTTON'&&e.key===' ')){e.preventDefault();e.stopImmediatePropagation();grid.scrollBy({top:d,behavior:Math.abs(d)>1e8?'auto':'smooth'});return}
  e.stopImmediatePropagation()},true);
// the wheel scrolls the list, never zooms the world behind the dialog
psel.addEventListener('wheel',e=>{e.stopPropagation();const grid=psel.querySelector('.ps-grid');if(grid&&!grid.contains(e.target)){e.preventDefault();grid.scrollBy({top:e.deltaY})}},{passive:false});
