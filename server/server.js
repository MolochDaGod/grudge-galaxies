// Grudge Galaxies backend for Railway.
// - Character saves: a tiny document store, one private folder per player (data/users/<uid>/...).
//   Uses Railway Postgres when DATABASE_URL is set, otherwise a JSON file (fine for local testing).
// - Multiplayer: one WebSocket lobby. Presence (position, race, mount...) is broadcast 4x a second;
//   chat and emotes are relayed as events. Players are anonymous: the browser keeps a random token,
//   the server only ever stores its SHA-256.
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { WebSocketServer } from 'ws';

const PORT = +process.env.PORT || 8787;
const ORIGINS = (process.env.CORS_ORIGIN || '*').split(',').map(s => s.trim()).filter(Boolean);
const MAX_DOC = 256 * 1024;

// ---------- storage ----------
let db = null;
const FILE = process.env.SAVE_FILE || './saves.json';
let mem = {};
if (process.env.DATABASE_URL) {
  const { default: pg } = await import('pg');
  db = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.PGSSL === 'off' ? false : { rejectUnauthorized: false } });
  await db.query(`create table if not exists docs (uid text not null, path text not null, id text not null, data jsonb not null, updated timestamptz default now(), primary key (uid, path, id))`);
} else {
  try { mem = JSON.parse(fs.readFileSync(FILE, 'utf8')) } catch { mem = {} }
}
const persist = () => { if (!db) fs.writeFile(FILE, JSON.stringify(mem), () => {}) };
async function list(uid, path) {
  if (db) return (await db.query('select id, data from docs where uid=$1 and path=$2 order by updated', [uid, path])).rows;
  return Object.entries(mem[uid]?.[path] || {}).map(([id, data]) => ({ id, data }));
}
async function put(uid, path, id, data) {
  if (db) return db.query('insert into docs(uid,path,id,data) values($1,$2,$3,$4) on conflict (uid,path,id) do update set data=excluded.data, updated=now()', [uid, path, id, data]);
  ((mem[uid] ||= {})[path] ||= {})[id] = data; persist();
}
async function del(uid, path, id) {
  if (db) return db.query('delete from docs where uid=$1 and path=$2 and id=$3', [uid, path, id]);
  if (mem[uid]?.[path]) { delete mem[uid][path][id]; persist() }
}

// ---------- helpers ----------
const uidOf = token => crypto.createHash('sha256').update(String(token)).digest('hex').slice(0, 24);
const tokenFrom = req => { const h = req.headers.authorization || ''; const m = /^Bearer ([A-Za-z0-9_-]{32,128})$/.exec(h); return m ? m[1] : null };
function cors(req, res) {
  const o = req.headers.origin;
  const allow = ORIGINS.includes('*') ? '*' : (o && ORIGINS.includes(o) ? o : ORIGINS[0]);
  res.setHeader('Access-Control-Allow-Origin', allow);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
}
const send = (res, code, body) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)) };
const readBody = req => new Promise((ok, bad) => { let n = 0, chunks = []; req.on('data', c => { n += c.length; if (n > MAX_DOC) { bad(new Error('too large')); req.destroy() } else chunks.push(c) }); req.on('end', () => ok(Buffer.concat(chunks).toString('utf8'))); req.on('error', bad) });
// a player may only touch documents under data/users/<their uid>/
const ownPath = (uid, path) => typeof path === 'string' && path.length < 200 && path.startsWith(`data/users/${uid}/`) && !path.includes('..');

// ---------- HTTP ----------
const server = http.createServer(async (req, res) => {
  cors(req, res);
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end() }
  const url = new URL(req.url, 'http://x');
  try {
    if (url.pathname === '/health') return send(res, 200, { ok: true, players: peers.size, storage: db ? 'postgres' : 'file' });
    if (!url.pathname.startsWith('/api/')) return send(res, 404, { error: 'not found' });
    const token = tokenFrom(req); if (!token) return send(res, 401, { error: 'missing token' });
    const uid = uidOf(token);
    if (url.pathname === '/api/me') return send(res, 200, { uid });
    if (url.pathname === '/api/docs') {
      const path = url.searchParams.get('path'), id = url.searchParams.get('id');
      if (!ownPath(uid, path)) return send(res, 403, { error: 'forbidden path' });
      if (req.method === 'GET') return send(res, 200, { docs: await list(uid, path) });
      if (!id || id.length > 80) return send(res, 400, { error: 'bad id' });
      if (req.method === 'PUT') { const data = JSON.parse(await readBody(req)); await put(uid, path, id, data); return send(res, 200, { ok: true }) }
      if (req.method === 'DELETE') { await del(uid, path, id); return send(res, 200, { ok: true }) }
    }
    send(res, 404, { error: 'not found' });
  } catch (e) { send(res, 500, { error: String(e.message || e) }) }
});

// ---------- WebSocket lobby ----------
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 8 * 1024 });
const peers = new Map(); // ws -> {peer, presence, last, count}
let seq = 0;
wss.on('connection', (ws, req) => {
  const o = req.headers.origin;
  if (!ORIGINS.includes('*') && o && !ORIGINS.includes(o)) { ws.close(1008, 'origin'); return }
  const me = { peer: 'p' + (++seq).toString(36) + crypto.randomBytes(3).toString('hex'), presence: null, count: 0, window: Date.now() };
  peers.set(ws, me);
  ws.send(JSON.stringify({ t: 'hello', peer: me.peer }));
  ws.on('message', buf => {
    // simple flood guard: 40 messages per second
    const now = Date.now(); if (now - me.window > 1000) { me.window = now; me.count = 0 } if (++me.count > 40) return;
    let m; try { m = JSON.parse(buf) } catch { return }
    if (m.t === 'presence' && m.d && typeof m.d === 'object') me.presence = m.d;
    else if (m.t === 'emit' && typeof m.topic === 'string' && /^(chat|emote)$/.test(m.topic)) {
      const out = JSON.stringify({ t: 'event', topic: m.topic, peer: me.peer, data: m.d });
      for (const [c] of peers) if (c.readyState === 1) c.send(c === ws ? JSON.stringify({ t: 'event', topic: m.topic, peer: me.peer, data: m.d, sameTab: true }) : out);
    }
  });
  ws.on('close', () => { peers.delete(ws); const out = JSON.stringify({ t: 'left', peer: me.peer }); for (const [c] of peers) if (c.readyState === 1) c.send(out) });
});
setInterval(() => {
  if (!peers.size) return;
  const list = [...peers.values()].map(p => ({ peer: p.peer, presence: p.presence }));
  const out = JSON.stringify({ t: 'peers', peers: list });
  for (const [c] of peers) if (c.readyState === 1) c.send(out);
}, 250);

server.listen(PORT, () => console.log(`Grudge Galaxies server on :${PORT} (${db ? 'postgres' : 'file'} saves)`));
