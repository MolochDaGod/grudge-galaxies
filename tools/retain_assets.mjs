/**
 * Retain what is worth keeping from assets that are leaving the public repo, before they go.
 *
 *   node tools/retain_assets.mjs
 *
 * For each source (licensed, not ours to publish) it writes:
 *  - data/reference/<id>.json (public): facts for rebuilding with owned assets: skeleton (bone names, parents, rest
 *    pose, segment lengths), height and bounds, attachment points (hand containers, weapon slots), the names of every
 *    variant mesh (weapons, armour, heads), material slots, texture sizes, and every animation's name, duration,
 *    channel count and root travel speed. For the town: the layout of every building (centre, size, rotation).
 *  - private/retained/<id>.rig.glb (private, git-ignored): the skeleton and its animations only, with all
 *    meshes, materials and textures removed, for retargeting tests.
 * Nothing here copies a mesh or a texture into the repo.
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune } from '@gltf-transform/functions';
import fs from 'node:fs';
import path from 'node:path';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const UP = process.env.UPLOADS || '/tmp/claude-0/-home-claude/b86569eb-7735-5efb-937a-f7c206876c14/scratchpad/up';

/** base64 glTF blobs inside a window.X = {...} pack, by key */
function packBlobs(file) {
  const s = fs.readFileSync(file, 'utf8'), out = {};
  let i = 0;
  while ((i = s.indexOf('Z2xURg', i)) >= 0) {
    const q = s[i - 1], e = s.indexOf(q, i), pre = s.slice(Math.max(0, i - 80), i - 1);
    const m = [...pre.matchAll(/[.\["']([A-Za-z0-9_\-]+)['"\]]?\s*[=:]\s*$/g)];
    out[m.length ? m[m.length - 1][1] : 'blob' + i] = Buffer.from(s.slice(i, e), 'base64');
    i = e;
  }
  return out;
}

const r3 = (v) => Math.round(v * 1000) / 1000;
const mul = (a, b) => { const o = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; };
const tp = (m, p) => [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];

async function retain(id, glb, kind, licence) {
  const doc = await io.readBinary(new Uint8Array(glb));
  const root = doc.getRoot();
  const nodes = root.listNodes();
  const parent = new Map();
  for (const n of nodes) for (const c of n.listChildren()) parent.set(c, n);
  const joints = new Set();
  for (const s of root.listSkins()) for (const j of s.listJoints()) joints.add(j);
  // world bounds of all meshes
  let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  const meshNodes = [];
  for (const n of nodes) {
    const mesh = n.getMesh();
    if (!mesh) continue;
    const W = n.getWorldMatrix();
    let nlo = [Infinity, Infinity, Infinity], nhi = [-Infinity, -Infinity, -Infinity], tris = 0;
    for (const p of mesh.listPrimitives()) {
      const pos = p.getAttribute('POSITION');
      if (!pos) continue;
      tris += (p.getIndices()?.getCount() ?? pos.getCount()) / 3;
      // measured from the vertices (accessor min/max are raw integers when the mesh is quantized)
      const n = pos.getCount(), step = Math.max(1, Math.floor(n / 20000)), el = [];
      for (let i = 0; i < n; i += step) {
        pos.getElement(i, el);
        const c = tp(W, el);
        for (let d = 0; d < 3; d++) { nlo[d] = Math.min(nlo[d], c[d]); nhi[d] = Math.max(nhi[d], c[d]); }
      }
    }
    for (let d = 0; d < 3; d++) { lo[d] = Math.min(lo[d], nlo[d]); hi[d] = Math.max(hi[d], nhi[d]); }
    meshNodes.push({ name: n.getName(), mesh: mesh.getName(), tris, skinned: !!n.getSkin(), centre: nlo.map((v, d) => r3((v + nhi[d]) / 2)), size: nlo.map((v, d) => r3(nhi[d] - v)), materials: [...new Set(mesh.listPrimitives().map((p) => p.getMaterial()?.getName() || ''))] });
  }
  const skeleton = [...joints].map((j) => {
    const p = parent.get(j), wp = j.getWorldTranslation(), pp = p ? p.getWorldTranslation() : null;
    return { name: j.getName(), parent: p && joints.has(p) ? p.getName() : null, t: j.getTranslation().map(r3), r: j.getRotation().map((v) => Math.round(v * 1e5) / 1e5), s: j.getScale().map(r3),
      world: wp.map(r3), length: pp && joints.has(p) ? r3(Math.hypot(wp[0] - pp[0], wp[1] - pp[1], wp[2] - pp[2])) : 0 };
  });
  // attachment points: non-joint, non-mesh nodes that hang off a joint (hand containers, weapon slots)
  const attach = nodes.filter((n) => !joints.has(n) && parent.has(n) && joints.has(parent.get(n)) && /contain|slot|socket|attach|weapon|hand|mount|seat/i.test(n.getName())).map((n) => ({ name: n.getName(), on: parent.get(n).getName(), t: n.getTranslation().map(r3) }));
  const clips = root.listAnimations().map((a) => {
    let dur = 0, rootTravel = 0;
    for (const c of a.listChannels()) {
      const s = c.getSampler(), inp = s.getInput(), out = s.getOutput();
      if (!inp) continue;
      dur = Math.max(dur, inp.getMax([])[0]);
      const tn = c.getTargetNode();
      if (c.getTargetPath() === 'translation' && out && tn && (!parent.get(tn) || !joints.has(parent.get(tn)))) {
        const n = out.getCount(), a0 = out.getElement(0, []), a1 = out.getElement(n - 1, []);
        rootTravel = Math.max(rootTravel, Math.hypot(a1[0] - a0[0], a1[2] - a0[2]));
      }
    }
    return { name: a.getName(), duration: r3(dur), channels: a.listChannels().length, rootTravel: r3(rootTravel), rootSpeed: dur ? r3(rootTravel / dur) : 0 };
  });
  const textures = root.listTextures().map((t) => ({ name: t.getName() || t.getURI() || '', size: t.getSize() || null, mime: t.getMimeType() }));
  const facts = {
    id, kind, licence, retained: new Date().toISOString().slice(0, 10),
    note: 'Facts kept for rebuilding with owned assets. The source meshes and textures are not in the repo.',
    bounds: { min: lo.map(r3), max: hi.map(r3), size: lo.map((v, d) => r3(hi[d] - v)) },
    skeleton, attach, clips,
    variants: meshNodes.map((m) => ({ name: m.name, tris: m.tris, skinned: m.skinned, size: m.size, centre: m.centre, materials: m.materials })),
    materials: root.listMaterials().map((m) => m.getName()), textures,
  };
  fs.mkdirSync('data/reference', { recursive: true });
  fs.writeFileSync(`data/reference/${id}.json`, JSON.stringify(facts, null, 1));
  // private rig file: skeleton + animations, nothing else
  if (joints.size || clips.length) {
    for (const n of nodes) if (n.getMesh()) { n.setMesh(null); n.setSkin(null); }
    for (const m of root.listMeshes()) m.dispose();
    for (const t of root.listTextures()) t.dispose();
    for (const m of root.listMaterials()) m.dispose();
    await doc.transform(prune({ keepLeaves: true, keepAttributes: false }));
    fs.mkdirSync('private/retained', { recursive: true });
    fs.writeFileSync(`private/retained/${id}.rig.glb`, await io.writeBinary(doc));
  }
  return { id, joints: joints.size, clips: clips.length, variants: meshNodes.length, attach: attach.length, height: r3(hi[1] - lo[1]) };
}

const TOON = 'Toon RTS Units (Polygon Blacksmith, Unity Asset Store licence): in builds only, not in the public repo';
const report = [];
const toon = packBlobs('public/kits/store/toon.js');
for (const [k, g] of Object.entries(toon)) report.push(await retain('toon_' + k, g, 'character', TOON));
const units = packBlobs('public/kits/store/units.js');
for (const [k, g] of Object.entries(units)) report.push(await retain(k, g, /mount/.test(k) ? 'mount' : 'siege', TOON));
const robot = fs.readdirSync(UP).find((f) => /robot\.glb$/.test(f));
if (robot) report.push(await retain('robot_harrikisan', fs.readFileSync(path.join(UP, robot)), 'character', 'Sketchfab Standard (harrikisan5577): store only'));
const town = packBlobs('public/kits/store/town.js');
for (const g of Object.values(town)) report.push(await retain('town_katydid', g, 'town layout', 'Sketchfab Standard (Medieval town by katydid): store only'));
console.table(report);
