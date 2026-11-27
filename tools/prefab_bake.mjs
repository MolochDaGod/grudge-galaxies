/**
 * Prefab bake + verify: every kit prototype the game actually builds gets a stable UUID, a content hash, measured bounds
 * and baked colliders made from its real triangles (not its bounding box), so doorways and arches stay open.
 *
 *   node tools/prefab_bake.mjs            bake: writes public/prefabs/kit-colliders.json + docs/PREFAB_REPORT.md
 *   node tools/prefab_bake.mjs --verify   verify: fails (exit 1) if any prototype is new, changed, or missing a bake
 *
 * It runs the built game (dist/, served on PORT) in headless Chromium and reads the prototypes from kitProtoCache, so
 * the bake sees exactly the geometry, part transforms and units the runtime uses. Nothing is assumed from file names.
 *
 * Colliders: the prototype's triangles are sampled into a voxel shell (cell = longest side / RES, coarser if a part
 * would need more than MAX_BOXES boxes), then merged greedily into axis-aligned boxes in prototype space. At runtime
 * each box is carried by the instance matrix (scale, then rotation, then position), so it stays a box.
 *
 * UUID: RFC 4122 v5 of "grudge-galaxies/prefab/<kit key>" (stable across rebakes); the content hash says whether the
 * geometry behind that UUID changed.
 */
import { createRequire } from 'node:module';
// the machine's Playwright (pre-installed with its browser) is resolved like require() would, not from package.json
const { chromium } = createRequire(import.meta.url)('playwright');
import { createHash } from 'node:crypto';
import fs from 'node:fs';

const PORT = process.env.PORT || 8796;
const VERIFY = process.argv.includes('--verify');
const OUT = 'public/prefabs/kit-colliders.json';
const NS = '6f1c5d0e-6a3b-4c39-9a51-2b8f0f4d7e21'; // Grudge Galaxies prefab namespace

function uuidv5(name) {
  const ns = Buffer.from(NS.replace(/-/g, ''), 'hex');
  const h = createHash('sha1').update(Buffer.concat([ns, Buffer.from(name)])).digest();
  h[6] = (h[6] & 0x0f) | 0x50;
  h[8] = (h[8] & 0x3f) | 0x80;
  const x = h.subarray(0, 16).toString('hex');
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}

/* runs in the page: hash, bounds and voxel boxes for every prototype */
const PAGE = String.raw`(async () => {
  const RES = 48, MAX_BOXES = 96;
  const out = {};
  const V = new THREE.Vector3(), M = new THREE.Matrix4();
  for (const [k, proto] of Object.entries(kitProtoCache)) {
    if (!proto || !proto.parts) continue;
    // all triangles in prototype space
    const tris = [];
    for (const part of proto.parts) {
      const g = part.geo, pos = g.getAttribute('position'), idx = g.index;
      if (!pos) continue;
      const n = idx ? idx.count : pos.count;
      for (let i = 0; i < n; i++) { V.fromBufferAttribute(pos, idx ? idx.getX(i) : i).applyMatrix4(part.m); tris.push(V.x, V.y, V.z); }
    }
    const h = protoHash(k); // the same function the game checks against at runtime
    if (!tris.length) continue;
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    for (let i = 0; i < tris.length; i += 3) {
      const a = tris[i], b = tris[i + 1], c = tris[i + 2];
      if (a < x0) x0 = a; if (a > x1) x1 = a; if (b < y0) y0 = b; if (b > y1) y1 = b; if (c < z0) z0 = c; if (c > z1) z1 = c;
    }
    const L = Math.max(x1 - x0, y1 - y0, z1 - z0) || 1;
    let vox = L / RES, boxes = null, nx, ny, nz, grid;
    for (let attempt = 0; attempt < 6 && !boxes; attempt++, vox *= 1.4) {
      nx = Math.max(1, Math.ceil((x1 - x0) / vox) + 1); ny = Math.max(1, Math.ceil((y1 - y0) / vox) + 1); nz = Math.max(1, Math.ceil((z1 - z0) / vox) + 1);
      grid = new Uint8Array(nx * ny * nz);
      const at = (x, y, z) => { const i = Math.min(nx - 1, Math.max(0, Math.floor((x - x0) / vox))), j = Math.min(ny - 1, Math.max(0, Math.floor((y - y0) / vox))), k2 = Math.min(nz - 1, Math.max(0, Math.floor((z - z0) / vox))); grid[(k2 * ny + j) * nx + i] = 1; };
      for (let t = 0; t < tris.length; t += 9) {
        const ax = tris[t], ay = tris[t + 1], az = tris[t + 2], bx = tris[t + 3], by = tris[t + 4], bz = tris[t + 5], cx = tris[t + 6], cy = tris[t + 7], cz = tris[t + 8];
        const e = Math.max(Math.hypot(bx - ax, by - ay, bz - az), Math.hypot(cx - ax, cy - ay, cz - az), Math.hypot(cx - bx, cy - by, cz - bz));
        const s = Math.max(1, Math.ceil(e / (vox * 0.5)));
        for (let u = 0; u <= s; u++) for (let v = 0; v <= s - u; v++) { const a = u / s, b = v / s, c = 1 - a - b; at(ax * c + bx * a + cx * b, ay * c + by * a + cy * b, az * c + bz * a + cz * b); }
      }
      // greedy merge into boxes
      const used = new Uint8Array(grid.length), list = [];
      const I = (i, j, k2) => (k2 * ny + j) * nx + i;
      for (let k2 = 0; k2 < nz && list.length <= MAX_BOXES; k2++)
        for (let j = 0; j < ny && list.length <= MAX_BOXES; j++)
          for (let i = 0; i < nx && list.length <= MAX_BOXES; i++) {
            if (!grid[I(i, j, k2)] || used[I(i, j, k2)]) continue;
            let i1 = i; while (i1 + 1 < nx && grid[I(i1 + 1, j, k2)] && !used[I(i1 + 1, j, k2)]) i1++;
            let j1 = j; grow: while (j1 + 1 < ny) { for (let a = i; a <= i1; a++) if (!grid[I(a, j1 + 1, k2)] || used[I(a, j1 + 1, k2)]) break grow; j1++; }
            let k1 = k2; growz: while (k1 + 1 < nz) { for (let b = j; b <= j1; b++) for (let a = i; a <= i1; a++) if (!grid[I(a, b, k1 + 1)] || used[I(a, b, k1 + 1)]) break growz; k1++; }
            for (let c = k2; c <= k1; c++) for (let b = j; b <= j1; b++) for (let a = i; a <= i1; a++) used[I(a, b, c)] = 1;
            list.push([x0 + ((i + i1 + 1) / 2) * vox, y0 + ((j + j1 + 1) / 2) * vox, z0 + ((k2 + k1 + 1) / 2) * vox, ((i1 - i + 1) * vox) / 2, ((j1 - j + 1) * vox) / 2, ((k1 - k2 + 1) * vox) / 2]);
          }
      if (list.length <= MAX_BOXES) boxes = list;
    }
    // is there air inside that the outside cannot reach? (a sealed shell: you can see a door but not use it)
    let open = 0, sealed = 0;
    if (grid) {
      const seen = new Uint8Array(grid.length), q = [];
      const I = (i, j, k2) => (k2 * ny + j) * nx + i;
      for (let k2 = 0; k2 < nz; k2++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++)
        if ((i === 0 || j === 0 || k2 === 0 || i === nx - 1 || j === ny - 1 || k2 === nz - 1) && !grid[I(i, j, k2)]) { seen[I(i, j, k2)] = 1; q.push(I(i, j, k2)); }
      while (q.length) { const c = q.pop(), i = c % nx, j = ((c / nx) | 0) % ny, k2 = (c / (nx * ny)) | 0;
        for (const [a, b, d] of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]) { const ii = i + a, jj = j + b, kk = k2 + d; if (ii < 0 || jj < 0 || kk < 0 || ii >= nx || jj >= ny || kk >= nz) continue; const n = I(ii, jj, kk); if (!seen[n] && !grid[n]) { seen[n] = 1; q.push(n); } } }
      for (let c = 0; c < grid.length; c++) if (!grid[c]) { if (seen[c]) open++; else sealed++; }
    }
    const r = (v) => Math.round(v * 1000) / 1000;
    out[k] = { hash: h, tris: tris.length / 9, size: [r(x1 - x0), r(y1 - y0), r(z1 - z0)], min: [r(x0), r(y0), r(z0)], parts: proto.parts.length,
      voxel: r(vox / 1.4), boxes: (boxes || []).map((b) => b.map(r)), sealedAir: sealed, failed: !boxes };
  }
  return out;
})()`;

const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const pg = await b.newPage({ viewport: { width: 640, height: 400 } });
await pg.goto(`http://localhost:${PORT}/index.html?debug&notutorial`);
await pg.waitForFunction(() => window.__gg, null, { timeout: 180000 });
const G = (s) => pg.evaluate((s) => window.__gg(s), s);
await G('intro.hidden=true');
// enter a planet so every kit loads (kitReady) the way it does in play
await G(`(async()=>{const w=WORLDS.find(w=>w.id==='tatooine');curWorld=w;const q=w.pois.find(q=>q.cat==='city');await goGround(q,'overhead')})()`);
for (let i = 0; i < 120; i++) { await pg.waitForTimeout(1500); if (await G('kitReady&&Object.keys(kitProtoCache).length>0')) break; }
await pg.waitForTimeout(3000);
const baked = await G(PAGE);
await b.close();

const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : { prefabs: {} };
const prefabs = {};
for (const [k, v] of Object.entries(baked).sort(([a], [c]) => a.localeCompare(c))) prefabs[k] = { uuid: uuidv5('grudge-galaxies/prefab/' + k), ...v };

const problems = [];
for (const [k, v] of Object.entries(prefabs)) {
  if (v.failed) problems.push(`${k}: could not bake under the box limit`);
  if (!v.size.every((s) => Number.isFinite(s))) problems.push(`${k}: non-finite bounds`);
}
if (VERIFY) {
  for (const [k, v] of Object.entries(prefabs)) {
    const p = prev.prefabs[k];
    if (!p) problems.push(`${k}: new prototype with no bake (run the bake)`);
    else if (p.hash !== v.hash) problems.push(`${k}: geometry changed since the bake (hash ${p.hash} -> ${v.hash})`);
    else if (p.uuid !== v.uuid) problems.push(`${k}: UUID changed`);
  }
  for (const k of Object.keys(prev.prefabs)) if (!prefabs[k]) problems.push(`${k}: baked but no longer in the game`);
  console.log(`verified ${Object.keys(prefabs).length} prototypes: ${problems.length ? problems.length + ' problems' : 'all match their bake'}`);
  problems.forEach((p) => console.log('  - ' + p));
  process.exit(problems.length ? 1 : 0);
}

fs.mkdirSync('public/prefabs', { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ version: 1, baked: new Date().toISOString(), namespace: NS, prefabs }));
const rows = Object.entries(prefabs).map(([k, v]) => `| ${k} | \`${v.uuid}\` | ${v.tris} | ${v.size.join(' × ')} | ${v.boxes.length} | ${v.sealedAir ? 'sealed shell' : 'open'} |`);
fs.writeFileSync('docs/PREFAB_REPORT.md', `# Prefab bake report\n\nBaked ${new Date().toISOString().slice(0, 10)} by \`node tools/prefab_bake.mjs\`; check with \`--verify\`.\nSizes are in prototype units (before the per-instance fit).\n\n| Prototype | UUID | Triangles | Size | Collider boxes | Inside |\n| --- | --- | --- | --- | --- | --- |\n${rows.join('\n')}\n\n${problems.length ? '## Problems\n\n' + problems.map((p) => '- ' + p).join('\n') + '\n' : ''}`);
console.log(`baked ${Object.keys(prefabs).length} prototypes, ${Object.values(prefabs).reduce((n, v) => n + v.boxes.length, 0)} boxes; ${problems.length} problems`);
problems.forEach((p) => console.log('  - ' + p));
