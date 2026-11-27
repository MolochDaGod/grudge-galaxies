/* ================= Playtest build: resilience, bug reports, performance overlay, welcome card =================
   - A thrown error inside one system no longer freezes the game: the frame loop keeps going, the error is logged once.
   - F8 (or Menu > Report a bug) files a report with a screenshot, where you are, what the game was doing, the last errors
     and the frame rate. It saves to the playtest feedback store when the game has one (artifact or Railway backend) and can
     always be downloaded as a file.
   - F3 shows frame time, draw calls, triangles and memory.
   - First visit shows what to test and how; reopen it from the menu. */
const GG_BUILD='playtest-2026.11.27';
const PT={log:[],fps:[],shown:false};
function ptLog(kind,msg){const s=String(msg||'').slice(0,400);const last=PT.log[PT.log.length-1];if(last&&last.m===s){last.n++;return}PT.log.push({t:new Date().toISOString(),k:kind,m:s,n:1});if(PT.log.length>60)PT.log.shift()}
addEventListener('error',e=>ptLog('error',(e.message||'')+' @'+(e.filename||'').split('/').pop()+':'+(e.lineno||'')));
addEventListener('unhandledrejection',e=>ptLog('promise',e.reason&&(e.reason.stack||e.reason.message)||e.reason));
{const ce=console.error.bind(console),cw=console.warn.bind(console);console.error=(...a)=>{ptLog('console',a.map(x=>x&&x.message||String(x)).join(' '));ce(...a)};console.warn=(...a)=>{ptLog('warn',a.map(x=>x&&x.message||String(x)).join(' '));cw(...a)}}
// keep the loop alive: each wrapped system fails on its own
function ptGuard(name,fn){let errs=0;return function(){try{return fn.apply(this,arguments)}catch(e){errs++;if(errs<4||errs%600===0)ptLog('tick',name+': '+(e&&e.stack||e).toString().split('\n').slice(0,2).join(' '));if(errs===1)console.warn('[playtest] '+name+' failed, the game keeps running',e)}}}
gameTick=ptGuard('gameTick',gameTick);updatePlay=ptGuard('updatePlay',updatePlay);
// frame timing for the overlay and reports
{let lastT=performance.now();(function fpsTick(now){const d=now-lastT;lastT=now;if(d>0&&d<1000){PT.fps.push(d);if(PT.fps.length>120)PT.fps.shift()}requestAnimationFrame(fpsTick)})(lastT)}
const ptFps=()=>{if(!PT.fps.length)return{fps:0,ms:0,worst:0};const a=PT.fps,avg=a.reduce((s,x)=>s+x,0)/a.length;return{fps:Math.round(1000/avg),ms:+avg.toFixed(1),worst:+Math.max(...a).toFixed(0)}};
{const s=document.createElement('style');s.textContent=`#ptHud{position:fixed;right:8px;top:64px;z-index:40;font:11px/1.35 ui-monospace,Menlo,monospace;color:#cfe;background:rgba(6,10,16,.78);border:1px solid rgba(120,200,255,.3);border-radius:6px;padding:6px 8px;pointer-events:none;white-space:pre}
#ptModal{position:fixed;inset:0;z-index:70;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55)}#ptModal[hidden]{display:none}
#ptModal .box{width:min(560px,94vw);max-height:90vh;overflow:auto;background:#141820;color:#e9e4d6;border:1px solid rgba(240,200,120,.4);border-radius:10px;padding:16px 18px;font:14px/1.45 system-ui,sans-serif;box-shadow:0 20px 60px rgba(0,0,0,.6)}
#ptModal h2{margin:0 0 8px;font-size:18px;color:#f0c878}#ptModal textarea{width:100%;min-height:96px;box-sizing:border-box;background:#0c0f14;color:#eee;border:1px solid #3a4250;border-radius:6px;padding:8px;font:inherit}
#ptModal select{background:#0c0f14;color:#eee;border:1px solid #3a4250;border-radius:6px;padding:4px 6px}#ptModal .row{display:flex;gap:8px;align-items:center;margin:8px 0;flex-wrap:wrap}
#ptModal button{background:#2a3242;color:#f2ead8;border:1px solid #556;border-radius:6px;padding:7px 12px;font:600 13px system-ui;cursor:pointer}#ptModal button.pri{background:#b8862e;border-color:#e0b060;color:#1a1408}
#ptModal img{max-width:100%;border-radius:6px;border:1px solid #333;margin-top:6px}#ptModal ul{margin:6px 0 8px 18px;padding:0}#ptModal kbd{background:#222a36;border:1px solid #445;border-radius:4px;padding:0 5px;font-size:12px}
#ptModal small{color:#9aa}`;document.head.append(s);
  const h=document.createElement('div');h.id='ptHud';h.hidden=true;document.body.append(h);const m=document.createElement('div');m.id='ptModal';m.hidden=true;m.innerHTML='<div class="box"></div>';document.body.append(m);
  m.addEventListener('click',e=>{if(e.target===m)ptClose()})}
const ptClose=()=>{$('#ptModal').hidden=true};
function ptState(){const r=renderer.info,f=ptFps(),U=play.model&&play.model.userData;return{build:GG_BUILD,at:new Date().toISOString(),ua:navigator.userAgent,screen:innerWidth+'x'+innerHeight+'@'+devicePixelRatio,
  quality,level,mode:groundMode,planet:groundWorld&&groundWorld.id,pos:CH?{x:Math.round(play.x),z:Math.round(play.z)}:null,char:CH?{name:CH.name,race:CH.race,cls:CH.cls,cl:CH.level||null}:null,
  anim:U&&U.state,mount:play.mount&&play.mount.id,busy,cine:typeof CINE!=='undefined'&&CINE.on,net:Store.mode,fps:f,gpu:{calls:r.render.calls,tris:r.render.triangles,geo:r.memory.geometries,tex:r.memory.textures},errors:PT.log.slice(-25)}}
function ptShot(){try{renderer.render(scene,cam);const c=document.createElement('canvas'),src=renderer.domElement,w=Math.min(960,src.width),h=Math.round(src.height*w/src.width);c.width=w;c.height=h;c.getContext('2d').drawImage(src,0,0,w,h);return c.toDataURL('image/jpeg',.72)}catch(e){return null}}
async function ptSave(rep){try{const db=window.claude&&window.claude.use?await window.claude.use('db'):null,user=db&&await window.claude.use('user');const id=user&&await user.id();
    if(db&&id){await db.collection('data/users/'+id+'/feedback').doc('r'+Date.now().toString(36)).set(rep);return true}}catch(e){ptLog('warn','report save: '+e.message)}return false}
async function ptDownload(rep){const name='grudge-playtest-'+(rep.state.planet||'galaxy')+'-'+Date.now()+'.json';try{const d=window.claude&&window.claude.use&&await window.claude.use('downloads');if(d){await d.save({filename:name,data:JSON.stringify(rep,null,1)});return}}catch(e){}
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(rep,null,1)],{type:'application/json'}));a.download=name;document.body.append(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)}
function ptReport(){const shot=ptShot(),state=ptState(),M=$('#ptModal'),B=M.querySelector('.box');keys&&keys.clear&&keys.clear();
  B.innerHTML=`<h2>Report a bug or idea</h2><div class="row"><select id="ptKind"><option value="bug">Bug</option><option value="perf">Slow / laggy</option><option value="visual">Looks wrong</option><option value="balance">Too hard / too easy</option><option value="idea">Idea</option></select>
   <select id="ptSev"><option value="minor">Minor</option><option value="major">Major</option><option value="blocker">Blocks play</option></select></div>
   <textarea id="ptText" placeholder="What happened, and what did you expect? Steps to repeat it help most."></textarea>
   <small>Sent with it: a screenshot, your planet and position, what your character was doing, frame rate, graphics stats and the last ${state.errors.length} logged errors. No passwords or personal data.</small>
   ${shot?`<img src="${shot}" alt="Screenshot that will be attached">`:''}
   <div class="row"><button class="pri" id="ptSend">Send report</button><button id="ptDl">Download as file</button><button id="ptX">Cancel</button><small id="ptMsg"></small></div>`;
  M.hidden=false;setTimeout(()=>$('#ptText').focus(),30);
  const rep=()=>({kind:$('#ptKind').value,severity:$('#ptSev').value,text:$('#ptText').value.slice(0,4000),state,shot});
  $('#ptX').onclick=ptClose;$('#ptDl').onclick=()=>ptDownload(rep());
  $('#ptSend').onclick=async()=>{const r=rep();if(!r.text.trim()){$('#ptMsg').textContent='Add a line about what happened first.';return}$('#ptSend').disabled=true;$('#ptMsg').textContent='Sending…';
    const ok=await ptSave(r);if(ok){ptClose();toast('Thanks! Report sent.')}else{$('#ptMsg').textContent='No feedback store here, so it was saved as a file instead.';ptDownload(r)}$('#ptSend').disabled=false}}
function ptWelcome(){const M=$('#ptModal'),B=M.querySelector('.box');
  B.innerHTML=`<h2>Grudge Galaxies playtest</h2><p>Thanks for testing. Build <b>${GG_BUILD}</b>. Play normally, and press <kbd>F8</kbd> any time something breaks, looks wrong or feels off.</p>
   <p><b>Controls</b></p><ul><li><kbd>W A S D</kbd> move · <kbd>Shift</kbd> run · <kbd>Space</kbd> jump (running jumps can vault) · right-drag to look</li>
   <li><kbd>R</kbd> gather a resource node, or board the glow whale from its beam at a starport</li><li><kbd>Tab</kbd> target · <kbd>1</kbd>–<kbd>0</kbd> abilities · <kbd>U</kbd> survey · <kbd>J</kbd> sample · <kbd>C</kbd> craft · <kbd>I</kbd> inventory</li>
   <li><kbd>Shift</kbd>+<kbd>M</kbd> planet map and waypoints · <kbd>Esc</kbd> menu · <kbd>Enter</kbd> chat (<code>/help</code> lists emotes)</li><li><kbd>F3</kbd> performance overlay · <kbd>F8</kbd> report</li></ul>
   <p><b>Please try</b></p><ul><li>Make a character and walk out of town; gather from a few resource nodes</li><li>Hunt something and skin it; craft an item at a bench</li>
   <li>Ride the glow whale from a starport to another planet and back</li><li>Visit Kashyyyk's giant forest and Tatooine's Mos Eisley</li><li>Play with a friend: chat, emotes, and see each other move</li></ul>
   <p><small>Saves follow your account when the game has a backend; otherwise they stay in this browser. If it runs slowly, set Graphics quality to Low in the menu.</small></p>
   <div class="row"><button class="pri" id="ptGo">Start playing</button></div>`;
  M.hidden=false;$('#ptGo').onclick=()=>{ptClose();try{localStorage.setItem('gg.pt.seen',GG_BUILD)}catch(e){}}}
addEventListener('keydown',e=>{if(e.key==='F8'){e.preventDefault();if($('#ptModal').hidden)ptReport();else ptClose()}
  else if(e.key==='F3'){e.preventDefault();const h=$('#ptHud');h.hidden=!h.hidden}
  else if(e.key==='Escape'&&!$('#ptModal').hidden){ptClose();e.stopImmediatePropagation()}},true);
// typing in the report box must not move the character or trigger hotkeys
addEventListener('keydown',e=>{if(!$('#ptModal').hidden&&!/F8|F3|Escape/.test(e.key))e.stopImmediatePropagation()},true);
{let hudT=0;const _gt=gameTick;gameTick=function(dt){_gt(dt);const h=$('#ptHud');if(h.hidden||(hudT-=dt)>0)return;hudT=.5;const f=ptFps(),r=renderer.info;
  h.textContent=`${GG_BUILD}\nfps ${f.fps}  ${f.ms} ms  worst ${f.worst} ms\ncalls ${r.render.calls}  tris ${(r.render.triangles/1e3).toFixed(0)}k\ngeo ${r.memory.geometries}  tex ${r.memory.textures}\n${quality} · ${groundWorld?groundWorld.id:level}${CH?` · ${Math.round(play.x)}, ${Math.round(play.z)}`:''}\nerrors ${PT.log.filter(x=>x.k!=='warn').length}`}}
// menu: report + welcome + build label
{const _me=menuExtras;menuExtras=function(){_me();const B=$('#gwBody');if(!B||B.querySelector('.pt-row'))return;const s=document.createElement('section');s.className='pt-row';
  s.innerHTML=`<h3>Playtest</h3><p class="gw-note">Build ${GG_BUILD}</p><div class="gw-menu"><button class="btn" id="ptRep">Report a bug (F8)</button><button class="btn" id="ptWel">What to test</button><button class="btn" id="ptPerf">Performance overlay (F3)</button></div>`;
  B.prepend(s);$('#ptRep').onclick=()=>{closeWin();ptReport()};$('#ptWel').onclick=()=>{closeWin();ptWelcome()};$('#ptPerf').onclick=()=>{const h=$('#ptHud');h.hidden=!h.hidden}}}
setTimeout(()=>{let seen=null;try{seen=localStorage.getItem('gg.pt.seen')}catch(e){}if(seen!==GG_BUILD&&!/[?&]debug\b/.test(location.search))ptWelcome()},1800);
// the frame loop itself: if anything in a frame throws before it reschedules, schedule the next frame anyway
{const _fr=frame;frame=function(now){try{_fr(now)}catch(e){ptLog('frame',(e&&e.stack||e).toString().split('\n').slice(0,2).join(' '));requestAnimationFrame(frame)}}}
