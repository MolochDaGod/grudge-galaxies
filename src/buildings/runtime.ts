/**
 * Generated buildings in the game: picks the town buildings to replace, places them on level floors, draws them,
 * hands vendors to the NPC system and terminals to the mission system, and keeps the camera inside walls.
 *
 * Order inside buildGround (wrapped):
 *   before: choose buildings, generate + validate each, set floors (groundH answers the floor inside a footprint),
 *           mark the world placement so the kit draws nothing there, append vendor NPC placements (mapNpcs maps them)
 *   original buildGround
 *   after:  merged meshes per town and material, roofs, terminals
 * Colliders: src/physics/world.ts streams w.genBuildings boxes in and out around the player.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { bridge, type Bridge } from '../bridge';
import { generate, kindOf, STYLES, WORLD_STYLE, type Building, type Kind, type Mat } from './generate';
import { validate } from './validate';

export interface Placed {
  b: Building;
  /** world placement index it replaces */
  pi: number;
  /** legacy coords: x east, z north */
  x: number;
  z: number;
  /** floor top, metres */
  y: number;
  /** rotation of the building's local frame in three.js space (about +y) */
  rot: number;
  cos: number;
  sin: number;
  city: string;
  /** radius for streaming and culling */
  r: number;
}

const MAX_PER_WORLD = 220;
const SERVICE_FIRST: Kind[] = ['cantina', 'hospital', 'armoury', 'temple', 'bank', 'guild', 'market', 'house'];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** building local (lx right, lz to the front door) -> legacy world coords */
export function toWorld(P: Placed, lx: number, lz: number): { x: number; z: number } {
  // three: X = x0 + lx cos + lz sin ; Z3 = -z0 - lx sin + lz cos ; legacy z = -Z3
  const X = P.x + lx * P.cos + lz * P.sin, Z3 = -P.z - lx * P.sin + lz * P.cos;
  return { x: X, z: -Z3 };
}
/** legacy world -> building local */
export function toLocal(P: Placed, x: number, z: number): { lx: number; lz: number } {
  const dx = x - P.x, dZ3 = -z + P.z;
  return { lx: dx * P.cos - dZ3 * P.sin, lz: dx * P.sin + dZ3 * P.cos };
}

function rectsOverlap(a: Placed, b: Placed, pad = 1.5): boolean {
  // separating axis test on the two footprints (in legacy coords)
  const corners = (P: Placed) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => toWorld(P, (sx * P.b.w) / 2 + sx * pad / 2, (sz * P.b.d) / 2 + 1 + sz * pad / 2));
  const A = corners(a), B = corners(b);
  for (const poly of [A, B])
    for (let i = 0; i < 4; i++) {
      const p = poly[i], q = poly[(i + 1) % 4], nx = q.z - p.z, nz = p.x - q.x;
      const pa = A.map((c) => c.x * nx + c.z * nz), pb = B.map((c) => c.x * nx + c.z * nz);
      if (Math.max(...pa) < Math.min(...pb) || Math.max(...pb) < Math.min(...pa)) return false;
    }
  return true;
}

export function planBuildings(B: Bridge, w: any): { placed: Placed[]; rejected: { pi: number; why: string }[] } {
  const style = WORLD_STYLE[w.id] || 'coraxis';
  const cands: { pi: number; kind: Kind; d: number }[] = [];
  w.placements.forEach((p: any, pi: number) => {
    if (p.k === 'npc' || p.genV || !p.t || p.t.startsWith('crc:')) return;
    const q = p.poi != null ? w.pois[p.poi] : null;
    if (!q || q.cat !== 'city') return;
    const kind = kindOf(p.t);
    if (!kind) return;
    cands.push({ pi, kind, d: Math.hypot(p.x - q.x, p.z - q.z) });
  });
  cands.sort((a, b) => SERVICE_FIRST.indexOf(a.kind) - SERVICE_FIRST.indexOf(b.kind) || a.d - b.d);
  const placed: Placed[] = [], rejected: { pi: number; why: string }[] = [];
  // one of each service per town is enough to be useful; houses fill the rest of the budget
  for (const c of cands) {
    if (placed.length >= MAX_PER_WORLD) { rejected.push({ pi: c.pi, why: 'budget' }); continue; }
    const p = w.placements[c.pi], q = w.pois[p.poi];
    const b = generate(c.kind, style, p.w || p.r * 2 || 0, p.d || p.w || p.r * 2 || 0, hash(w.id + p.t + p.x.toFixed(1) + p.z.toFixed(1)));
    const rep = validate(b);
    if (!rep.ok) { rejected.push({ pi: c.pi, why: 'invalid: ' + rep.errors[0] }); continue; }
    const rot = ((p.yaw != null ? -p.yaw : 0) * Math.PI) / 180;
    const P: Placed = { b, pi: c.pi, x: p.x, z: p.z, y: 0, rot, cos: Math.cos(rot), sin: Math.sin(rot), city: q.name, r: Math.hypot(b.w, b.d) / 2 + 1 };
    if (placed.some((o) => Math.hypot(o.x - P.x, o.z - P.z) < o.r + P.r && rectsOverlap(o, P))) { rejected.push({ pi: c.pi, why: 'overlaps a neighbour' }); continue; }
    placed.push(P);
  }
  return { placed, rejected };
}

/**
 * Floors and stairs, once the terrain exists: the floor is the highest ground under the footprint (terrain never pokes
 * through), a foundation fills down to the lowest, and when the street in front of the door is lower than one step,
 * solid stairs run out from the door (0.25 m rise, 0.4 m run) so the door is always reachable.
 */
export function settle(B: Bridge, w: any, P: Placed): void {
  const b = P.b;
  let top = -Infinity, low = Infinity;
  for (let sx = -1; sx <= 1; sx += 0.5)
    for (let sz = -1; sz <= 1; sz += 0.5) {
      const g = toWorld(P, (sx * b.w) / 2, (sz * b.d) / 2), h = B.groundH(w, g.x, g.z);
      if (!Number.isFinite(h)) continue;
      top = Math.max(top, h);
      low = Math.min(low, h);
    }
  if (!Number.isFinite(top)) { top = 0; low = 0; }
  P.y = top + 0.05;
  (P as any).low = low;
  b.boxes = b.boxes.filter((x) => !(x as any).stair);
  let z = b.d / 2 + 0.9;
  const fw = (b.doors.find((d) => d.exterior && d.axis === 'x' && d.z > 0)?.w || 2) / 2 + 0.4;
  for (let i = 0; i < 40; i++) {
    const g = toWorld(P, 0, z + 0.2), street = B.groundH(w, g.x, g.z) - P.y; // relative to the floor
    const stepTop = -0.4 - i * 0.25;
    if (street >= stepTop + 0.05) break;
    // a solid step from the street up to its tread
    b.boxes.push(Object.assign({ x: 0, y: (stepTop + street - 0.3) / 2, z: z + 0.2, hx: fw, hy: Math.max(0.05, (stepTop - street + 0.3) / 2), hz: 0.2, mat: 'trim' as Mat, solid: true }, { stair: true }));
    z += 0.4;
  }
}

/* ---------- drawing ---------- */

const matCache = new Map<string, THREE.Material>();
function material(style: string, m: Mat): THREE.Material {
  const key = style + m;
  let mat = matCache.get(key);
  if (mat) return mat;
  const S = STYLES[style];
  const col = { wall: S.wall, trim: S.trim, floor: S.floor, roof: S.roof, glow: S.glow, wood: S.wood, cloth: S.cloth }[m];
  mat = m === 'glow'
    ? new THREE.MeshBasicMaterial({ color: col, toneMapped: false })
    : new THREE.MeshStandardMaterial({ color: col, roughness: m === 'trim' ? 0.55 : 0.85, metalness: style === 'pyraxis' || style === 'rimehold' ? 0.35 : 0.02 });
  matCache.set(key, mat);
  return mat;
}

function roofGeometry(b: Building): THREE.BufferGeometry | null {
  const r = b.roof, ow = b.w + 0.8, od = b.d + 0.8;
  if (r.type === 'flat') return null;
  if (r.type === 'dome') {
    const g = new THREE.SphereGeometry(1, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    g.scale(b.w * 0.42, r.rise, b.d * 0.42);
    g.translate(0, r.y, 0);
    return g;
  }
  if (r.type === 'hip' || r.type === 'spire') {
    const g = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1);
    g.rotateY(Math.PI / 4);
    g.scale(ow, r.rise, od);
    g.translate(0, r.y + r.rise / 2, 0);
    return g;
  }
  // gable: a prism, ridge along x
  const hw = ow / 2, hd = od / 2, y0 = r.y, y1 = r.y + r.rise;
  const v = [
    -hw, y0, hd, hw, y0, hd, hw, y1, 0, -hw, y0, hd, hw, y1, 0, -hw, y1, 0, // front slope
    hw, y0, -hd, -hw, y0, -hd, -hw, y1, 0, hw, y0, -hd, -hw, y1, 0, hw, y1, 0, // back slope
    -hw, y0, -hd, -hw, y0, hd, -hw, y1, 0, // west gable
    hw, y0, hd, hw, y0, -hd, hw, y1, 0, // east gable
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
}

export function drawBuildings(B: Bridge, placed: Placed[]): THREE.Group {
  const group = new THREE.Group();
  group.name = 'generated-buildings';
  const byTown = new Map<string, Placed[]>();
  for (const P of placed) (byTown.get(P.city) || byTown.set(P.city, []).get(P.city)!).push(P);
  const M = new THREE.Matrix4(), Mb = new THREE.Matrix4();
  for (const [town, list] of byTown) {
    const parts = new Map<string, THREE.BufferGeometry[]>();
    const push = (k: string, g: THREE.BufferGeometry) => (parts.get(k) || parts.set(k, []).get(k)!).push(g);
    const sph = new THREE.Sphere();
    const pts: THREE.Vector3[] = [];
    for (const P of list) {
      M.makeRotationY(P.rot).setPosition(P.x, P.y, -P.z);
      for (const bx of P.b.boxes) {
        const g = new THREE.BoxGeometry(bx.hx * 2, bx.hy * 2, bx.hz * 2);
        Mb.makeTranslation(bx.x, bx.y, bx.z).premultiply(M);
        g.applyMatrix4(Mb);
        push(P.b.style + '|' + bx.mat, g.toNonIndexed());
        g.dispose();
      }
      // foundation down to the lowest ground under the footprint
      const low = (P as any).low as number;
      if (P.y - low > 0.45) {
        const g = new THREE.BoxGeometry(P.b.w + 0.3, P.y - 0.4 - low + 0.3, P.b.d + 0.3);
        g.translate(0, (P.y - 0.4 + low - 0.3) / 2 - P.y, 0);
        g.applyMatrix4(M);
        push(P.b.style + '|trim', g.toNonIndexed());
        g.dispose();
      }
      const roof = roofGeometry(P.b);
      if (roof) {
        roof.applyMatrix4(M);
        push(P.b.style + '|roof', roof.index ? roof.toNonIndexed() : roof);
      }
      pts.push(new THREE.Vector3(P.x, P.y, -P.z));
    }
    sph.setFromPoints(pts);
    sph.radius += 40;
    for (const [k, gs] of parts) {
      const [style, mat] = k.split('|') as [string, Mat];
      // the same attribute set on every piece (roof prisms have no uv)
      for (const g of gs) { if (!g.getAttribute('uv')) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((g.getAttribute('position').count) * 2), 2)); if (!g.getAttribute('normal')) g.computeVertexNormals(); }
      const merged = mergeGeometries(gs, false);
      gs.forEach((g) => g.dispose());
      if (!merged) continue;
      merged.boundingSphere = sph.clone();
      const mesh = new THREE.Mesh(merged, material(style, mat));
      mesh.name = `bld:${town}:${mat}`;
      mesh.castShadow = mat !== 'glow';
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      group.add(mesh);
    }
  }
  return group;
}

/* ---------- camera: never behind a wall or above a ceiling when near a building ---------- */
const _o = new THREE.Vector3(), _d = new THREE.Vector3();
function rayBoxes(P: Placed, from: THREE.Vector3, to: THREE.Vector3): number {
  // into the building's local frame (three space: local = R^-1 (p - origin))
  const inv = (v: THREE.Vector3, out: THREE.Vector3) => {
    const x = v.x - P.x, y = v.y - P.y, z = v.z + P.z;
    return out.set(x * P.cos - z * P.sin, y, x * P.sin + z * P.cos);
  };
  inv(from, _o);
  const e = inv(to, new THREE.Vector3());
  _d.copy(e).sub(_o);
  let tMin = 1;
  for (const bx of P.b.boxes) {
    if (!bx.solid) continue;
    let t0 = 0, t1 = tMin;
    let miss = false;
    for (const ax of ['x', 'y', 'z'] as const) {
      const c = bx[ax], h = (ax === 'x' ? bx.hx : ax === 'y' ? bx.hy : bx.hz) + 0.12, o = _o[ax], dd = _d[ax];
      if (Math.abs(dd) < 1e-9) { if (o < c - h || o > c + h) { miss = true; break; } continue; }
      let a = (c - h - o) / dd, b = (c + h - o) / dd;
      if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a);
      t1 = Math.min(t1, b);
      if (t0 > t1) { miss = true; break; }
    }
    if (!miss && t0 < tMin) tMin = t0;
  }
  return tMin;
}

export async function installBuildings() {
  const B = await bridge();
  let current: Placed[] = [];
  let drawn: THREE.Group | null = null;
  (window as any).GG_BUILDINGS = { get placed() { return current; }, generate, validate };

  B.wrap('buildGround', (orig) => function (this: unknown, w: any, ...rest: any[]) {
    // undo the last planet's additions
    if (Array.isArray(w.placements)) while (w.placements.length && w.placements[w.placements.length - 1].genV) w.placements.pop();
    w.floorAt = null;
    for (const p of w.placements) if (p.genB) delete p.genB;
    let plan: ReturnType<typeof planBuildings> = { placed: [], rejected: [] };
    try { plan = planBuildings(B, w); } catch (e) { console.warn('building plan failed', e); }
    current = plan.placed;
    w.genBuildings = current;
    w.genRejected = plan.rejected;
    // vendors become ordinary friendly placements, so mapNpcs, interact.ts and the NPC AI treat them like townsfolk
    for (const P of current) {
      w.placements[P.pi].genB = true;
      for (const s of P.b.slots) {
        if (s.kind !== 'vendor' || !s.npc) continue;
        const g = toWorld(P, s.x, s.z);
        w.placements.push({ k: 'npc', t: s.npc, x: g.x, z: g.z, yaw: ((-(P.rot + s.yaw)) * 180) / Math.PI, poi: w.placements[P.pi].poi, genV: true, home: true });
      }
    }
    const out = orig.call(this, w, ...rest);
    try {
      for (const P of current) settle(B, w, P);
    // floors: inside a footprint the ground is the floor
      const bins = new Map<string, Placed[]>();
      for (const P of current) {
        const r = P.r;
        for (let gx = Math.floor((P.x - r) / 64); gx <= Math.floor((P.x + r) / 64); gx++)
          for (let gz = Math.floor((P.z - r) / 64); gz <= Math.floor((P.z + r) / 64); gz++) (bins.get(gx + ',' + gz) || bins.set(gx + ',' + gz, []).get(gx + ',' + gz)!).push(P);
      }
      w.floorAt = (x: number, z: number): number | null => {
        const L = bins.get(Math.floor(x / 64) + ',' + Math.floor(z / 64));
        if (!L) return null;
        for (const P of L) {
          const l = toLocal(P, x, z);
          if (Math.abs(l.lx) <= P.b.w / 2 && l.lz >= -P.b.d / 2 && l.lz <= P.b.d / 2 + 0.9) return P.y;
        }
        return null;
      };

      if (drawn) { drawn.parent?.remove(drawn); drawn.traverse((o: any) => o.geometry?.dispose?.()); }
      drawn = drawBuildings(B, current);
      B.G.ground.add(drawn);
      for (const P of current)
        for (const s of P.b.slots) {
          if (s.kind !== 'terminal' || !s.terminal) continue;
          const g = toWorld(P, s.x, s.z);
          (B.fn as any).addTerminal(s.terminal, g.x, g.z, P.rot + s.yaw, P.y, P.city);
        }
      console.info(`[buildings] ${w.id}: ${current.length} generated, ${plan.rejected.length} left to the kit`, plan.rejected.slice(0, 6));
    } catch (e) { console.warn('building draw failed', e); }
    return out;
  });

  // keep the camera out of walls and under ceilings near buildings
  B.wrap('updatePlay', (orig) => function (this: unknown, ...a: any[]) {
    const r = orig.apply(this, a);
    const w = B.groundWorld, p = B.play;
    if (!w || !current.length || B.groundMode !== 'play' || !p) return r;
    const cam = B.cam as THREE.PerspectiveCamera;
    const head = new THREE.Vector3(p.x, B.groundH(w, p.x, p.z) + 1.6, -p.z);
    let t = 1;
    for (const P of current) {
      if (Math.hypot(P.x - p.x, P.z - p.z) > P.r + 14) continue;
      t = Math.min(t, rayBoxes(P, head, cam.position));
    }
    if (t < 1) cam.position.lerpVectors(head, cam.position, Math.max(0.06, t - 0.04));
    return r;
  });
}
