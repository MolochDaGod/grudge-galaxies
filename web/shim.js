/* Grudge Galaxies standalone runtime: gives the game the same window.claude.use(...) API it has on claude.ai,
   backed by your Railway server (saves + multiplayer) instead. Set the server URL in config.js. */
(function(){
  if(window.claude&&window.claude.use)return;
  // an unset or placeholder address means offline play: saves stay in this browser, no multiplayer
  let API=(window.GRUDGE_BACKEND||'').trim().replace(/\/$/,'');if(!/^https?:\/\//.test(API)||/YOUR-SERVICE/i.test(API))API='';
  // anonymous player identity: a random token kept in this browser; the server only stores its hash
  function token(){let t=null;try{t=localStorage.getItem('gg.token')}catch(e){}if(!t){const a=new Uint8Array(24);crypto.getRandomValues(a);t=Array.from(a,b=>b.toString(16).padStart(2,'0')).join('');try{localStorage.setItem('gg.token',t)}catch(e){}}return t}
  const H=()=>({Authorization:'Bearer '+token(),'Content-Type':'application/json'});
  const req=(method,q,body)=>fetch(API+'/api/docs?'+new URLSearchParams(q),{method,headers:H(),body:body&&JSON.stringify(body)}).then(r=>{if(!r.ok)throw new Error('save server '+r.status);return r.json()});
  let uid=null,meP=null;const me=()=>uid?Promise.resolve(uid):(meP||(meP=fetch(API+'/api/me',{headers:H()}).then(r=>{if(!r.ok)throw new Error('server '+r.status);return r.json()}).then(j=>uid=j.uid).catch(e=>{meP=null;throw e})));
  const dbApi={collection(path){return{
    get:()=>req('GET',{path}).then(j=>({docs:j.docs.map(d=>({id:d.id,data:()=>d.data}))})),
    doc:id=>({set:data=>req('PUT',{path,id},data),delete:()=>req('DELETE',{path,id})})}}};
  const userApi={id:()=>me(),me:()=>me().then(id=>({id,name:''})),isOwner:()=>false,canEdit:()=>false,can:()=>null,profiles:async()=>({})};
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
