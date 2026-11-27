/* Grudge Galaxies standalone runtime: gives the game the same window.claude.use(...) API it has on claude.ai,
   backed by your Railway server (saves + multiplayer) instead. Set the server URL in config.js. */
(function(){
  if(window.claude&&window.claude.use)return;
  // an unset or placeholder address means offline play: saves stay in this browser, no multiplayer
  let API=(window.GRUDGE_BACKEND||'').trim().replace(/\/$/,'');if(!/^https?:\/\//.test(API)||/YOUR-SERVICE/i.test(API))API='';
  // anonymous player identity: a random token kept in this browser; the server only stores its hash
  function token(){let t=null;try{t=localStorage.getItem('gg.token')}catch(e){}if(!t){const a=new Uint8Array(24);crypto.getRandomValues(a);t=Array.from(a,b=>b.toString(16).padStart(2,'0')).join('');try{localStorage.setItem('gg.token',t)}catch(e){}}return t}
  // Grudge ID: coming back from id.grudge-studio.com puts ?token=... in the address; keep it and clean the URL.
  // Signed in, saves follow the Grudge account on any device; signed out, they follow this browser's anonymous token.
  const ID='https://id.grudge-studio.com',ls=(k,v)=>{try{if(v===undefined)return localStorage.getItem(k);if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,v)}catch(e){return null}};
  try{const u=new URL(location.href),t=u.searchParams.get('token')||u.searchParams.get('sso_token');
    if(t){ls('grudge_auth_token',t);const n=u.searchParams.get('grudge_username')||u.searchParams.get('username');if(n)ls('grudge_username',n);
      ['token','sso_token','grudge_username','grudge_user_id','grudge_id','provider','username'].forEach(k=>u.searchParams.delete(k));history.replaceState({},'',u.toString())}}catch(e){}
  const gTok=()=>ls('grudge_auth_token');
  const H=(anon)=>({Authorization:'Bearer '+((!anon&&gTok())||token()),'Content-Type':'application/json'});
  const req=(method,q,body)=>fetch(API+'/api/docs?'+new URLSearchParams(q),{method,headers:H(),body:body&&JSON.stringify(body)}).then(r=>{if(!r.ok)throw new Error('save server '+r.status);return r.json()});
  let uid=null,meP=null,who=null;
  const me=()=>uid?Promise.resolve(uid):(meP||(meP=fetch(API+'/api/me',{headers:H()}).then(r=>{
      // an expired Grudge sign-in falls back to the anonymous token instead of locking the player out
      if(r.status===401&&gTok()){ls('grudge_auth_token',null);meP=null;return fetch(API+'/api/me',{headers:H()}).then(r2=>{if(!r2.ok)throw new Error('server '+r2.status);return r2.json()})}
      if(!r.ok)throw new Error('server '+r.status);return r.json()}).then(j=>{who=j;uid=j.uid;if(j.grudge)migrate(j.uid);return uid}).catch(e=>{meP=null;throw e})));
  // first sign-in on this browser: copy the anonymous characters into the account (only if the account has none yet)
  async function migrate(gid){if(ls('gg.migrated.'+gid))return;try{
    const anon=await fetch(API+'/api/me',{headers:H(true)}).then(r=>r.json()),from='data/users/'+anon.uid+'/chars',to='data/users/'+gid+'/chars';
    const have=await req('GET',{path:to});if(have.docs.length){ls('gg.migrated.'+gid,'1');return}
    const old=await fetch(API+'/api/docs?'+new URLSearchParams({path:from}),{headers:H(true)}).then(r=>r.json());
    for(const d of old.docs||[])await req('PUT',{path:to,id:d.id},d.data);ls('gg.migrated.'+gid,'1');if((old.docs||[]).length)console.info('Grudge ID: moved '+old.docs.length+' character(s) into your account')}catch(e){console.warn('migration',e)}}
  // the game reads this to show a Grudge ID row in its menu
  window.grudgeAuth={enabled:()=>!!API,signedIn:()=>!!gTok(),name:()=>(who&&who.name)||ls('grudge_username')||'',
    signIn(){location.href=ID+'/auth/sso-check?return='+encodeURIComponent(location.origin+location.pathname)},
    signOut(){const t=gTok();if(t)fetch(ID+'/api/auth/logout',{method:'POST',headers:{Authorization:'Bearer '+t}}).catch(()=>{});['grudge_auth_token','grudge_username'].forEach(k=>ls(k,null));location.reload()}};
  const dbApi={collection(path){return{
    get:()=>req('GET',{path}).then(j=>({docs:j.docs.map(d=>({id:d.id,data:()=>d.data}))})),
    doc:id=>({set:data=>req('PUT',{path,id},data),delete:()=>req('DELETE',{path,id})})}}};
  const userApi={id:()=>me(),me:()=>me().then(id=>({id,name:(who&&who.name)||''})),isOwner:()=>false,canEdit:()=>false,can:()=>null,profiles:async()=>({})};
  // multiplayer lobby over WebSocket, same shape as the artifact room capability
  function makeRoom(){const subs={},peersCbs=[];let ws=null,peers=[],myPeer=null,pres=null,open=false,wait=2000;
    const connect=()=>{try{ws=new WebSocket(API.replace(/^http/,'ws')+'/ws')}catch(e){setTimeout(connect,wait=Math.min(wait*2,60000));return}
      ws.onopen=()=>{open=true;wait=2000;if(pres)ws.send(JSON.stringify({t:'presence',d:pres}))};
      // reconnect with backoff (2s, 4s ... 60s) so a sleeping server is not hammered
      ws.onclose=()=>{open=false;if(peers.length){const left=peers.map(p=>p.peer);peers=[];peersCbs.forEach(f=>f({peers,left}))}setTimeout(connect,wait);wait=Math.min(wait*2,60000)};
      ws.onmessage=e=>{let m;try{m=JSON.parse(e.data)}catch(_){return}
        if(m.t==='hello')myPeer=m.peer;
        else if(m.t==='peers'){const before=new Set(peers.map(p=>p.peer));peers=m.peers.filter(p=>p.peer!==myPeer);const now=new Set(peers.map(p=>p.peer));
          const left=[...before].filter(p=>!now.has(p));peersCbs.forEach(f=>f({peers,left}))}
        else if(m.t==='left'){peers=peers.filter(p=>p.peer!==m.peer);peersCbs.forEach(f=>f({peers,left:[m.peer]}))}
        else if(m.t==='event')(subs[m.topic]||[]).forEach(f=>f({data:m.data,peer:m.peer,sameTab:!!m.sameTab}))}};
    connect();
    return{peers:()=>peers,presence:d=>{pres=d;if(open&&ws.readyState===1)ws.send(JSON.stringify({t:'presence',d}));return Promise.resolve()},
      emit:(topic,d)=>{if(open&&ws.readyState===1)ws.send(JSON.stringify({t:'emit',topic,d}));return Promise.resolve()},
      on:(topic,f)=>{(subs[topic]||(subs[topic]=[])).push(f)},onPeers:f=>{peersCbs.push(f)}}}
  let room=null;
  // file downloads work directly on your own site
  const downloads={save:({filename,data})=>{const blob=data instanceof Blob?data:new Blob([typeof data==='string'?data:JSON.stringify(data)],{type:'application/json'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=filename||'download';document.body.append(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500);return Promise.resolve()}};
  window.claude={use:async name=>{
    if(name==='downloads')return downloads;
    if(!API)return null;
    if(name==='db')return me().then(()=>dbApi).catch(()=>null);
    if(name==='user')return me().then(()=>userApi).catch(()=>null);
    if(name==='room')return room||(room=makeRoom());
    return null}};
})();
