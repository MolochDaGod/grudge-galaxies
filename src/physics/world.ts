/**
 * Planet physics (Rapier 0.19, fleet pattern from the casting lab's PhysicsWorld).
 *
 *  - One Rapier world per planet, rebuilt when the ground is built.
 *  - Terrain: a heightfield made from the exact grid the ground mesh is built from (w.hGrid), so feet and the visible
 *    surface agree.
 *  - Buildings and kit pieces: oriented cuboids from each kit instance (instance matrix x part bounding box), streamed in
 *    by map cell around the player so a 16 km planet never holds more than a few thousand colliders.
 *  - Player: kinematic capsule driven by Rapier's character controller (autostep, slope limit, snap to ground, slide).
 *    The legacy movement code still decides where the player wants to go; this module turns that wish into a collision-
 *    corrected move and owns vertical velocity (gravity, jumps, falls).
 *  - World step at a fixed 60 Hz (accumulator), independent of the render rate.
 *
 * Coordinates: Rapier works in three.js world space (x, y, z). The legacy game stores the player as (play.x, play.z) with
 * z pointing north, i.e. three z = -play.z.
 */
import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { bridge, type Bridge } from '../bridge';

export const FIXED_DT = 1 / 60;
const CAPSULE = { radius: 0.38, halfHeight: 0.52 }; // 1.8 m human, feet at y - (halfHeight + radius)
const FOOT = CAPSULE.halfHeight + CAPSULE.radius;
const GRAVITY = -24; // a little heavier than earth: snappier jumps and falls for a third-person action game
const JUMP_V = 8.2;
const STREAM_IN = 520; // metres: kit cells closer than this get colliders
const STREAM_OUT = 760;
const NATURE_R = 140; // metres: trees, boulders and pillars closer than this are solid

/* baked kit colliders: public/prefabs/kit-colliders.json, checked against the game's own prototype hash */
type Bake = { uuid: string; hash: string; boxes: number[][] };
let bakes: Record<string, Bake> | null = null;
const bakeStats = { used: new Set<string>(), fallback: new Set<string>(), stale: new Set<string>() };
(window as any).GG_PREFABS = { get bakes() { return bakes; }, stats: bakeStats };
fetch('prefabs/kit-colliders.json').then((r) => (r.ok ? r.json() : null)).then((j) => { bakes = j?.prefabs || {}; }).catch(() => { bakes = {}; });
const bakeOk = new Map<string, Bake | null>();
function bakedFor(B: Bridge, kit: string): Bake | null {
  if (!bakes) return null;
  if (bakeOk.has(kit)) return bakeOk.get(kit)!;
  const b = bakes[kit];
  let ok: Bake | null = null;
  if (b) {
    const h = (B.fn as any).protoHash?.(kit);
    if (h && h === b.hash) { ok = b; bakeStats.used.add(kit); }
    else { bakeStats.stale.add(kit); console.warn(`[prefabs] ${kit}: geometry changed since its bake (${b.hash} vs ${h}); using bounding boxes until it is re-baked`); }
  }
  bakeOk.set(kit, ok);
  return ok;
}

let ready = false;
export async function initPhysics(): Promise<void> {
  if (ready) return;
  await RAPIER.init();
  ready = true;
}

interface CellColliders {
  mesh: THREE.InstancedMesh;
  colliders: RAPIER.Collider[];
}

export class PlanetPhysics {
  world: RAPIER.World;
  cct: RAPIER.KinematicCharacterController;
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  worldRef: unknown;
  vy = 0;
  grounded = true;
  acc = 0;
  cells = new Map<THREE.InstancedMesh, CellColliders>();
  lastStream = new THREE.Vector2(1e9, 1e9);
  lastNature = new THREE.Vector2(1e9, 1e9);
  natureT = 0;
  stats = { colliders: 0, steps: 0 };

  constructor(private B: Bridge, w: any) {
    this.worldRef = w;
    this.world = new RAPIER.World({ x: 0, y: GRAVITY, z: 0 });
    this.world.timestep = FIXED_DT;
    this.addTerrain(w);
    const p = B.play;
    const y = B.groundH(w, p.x, p.z) + FOOT + 0.05;
    this.body = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(p.x, y, -p.z));
    this.collider = this.world.createCollider(RAPIER.ColliderDesc.capsule(CAPSULE.halfHeight, CAPSULE.radius), this.body);
    this.cct = this.world.createCharacterController(0.02);
    this.cct.enableAutostep(0.65, 0.25, false); // climbs kerbs and landing pads, not walls
    this.cct.enableSnapToGround(0.45);
    this.cct.setMaxSlopeClimbAngle((50 * Math.PI) / 180);
    this.cct.setMinSlopeSlideAngle((60 * Math.PI) / 180);
    this.cct.setSlideEnabled(true);
  }

  addTerrain(w: any) {
    const g = w.hGrid as { H: Float32Array; N: number; cell: number } | undefined;
    const EXT = this.B.EXT;
    if (!g) {
      this.world.createCollider(RAPIER.ColliderDesc.cuboid(EXT / 2, 1, EXT / 2).setTranslation(0, -1, 0));
      return;
    }
    // ground mesh vertex (row r, col c): x = -EXT/2 + c*cell, three z = -EXT/2 + r*cell, height H[r*N + c].
    // Rapier: rows run along z, columns along x, heights column-major -> heights[c*N + r].
    const N = g.N, n = N - 1, heights = new Float32Array(N * N);
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const v = g.H[r * N + c];
      heights[c * N + r] = Number.isFinite(v) ? v : 0;
    }
    this.world.createCollider(RAPIER.ColliderDesc.heightfield(n, n, heights, { x: EXT, y: 1, z: EXT }).setFriction(0.9));
  }

  /** stream building/kit colliders in and out by map cell around the player */
  stream(force = false) {
    const p = this.B.play, here = new THREE.Vector2(p.x, -p.z);
    // trees, boulders and pillars stream on a finer step and on a timer (the tree grid is built a few seconds after
    // the planet, so the first pass may find none)
    const now = performance.now();
    if (!force && (here.distanceTo(this.lastNature) > 16 || now - this.natureT > 2000)) {
      this.natureT = now;
      this.lastNature.copy(here);
      this.streamNature(here);
    }
    if (!force && here.distanceTo(this.lastStream) < 48) return;
    this.natureT = now;
    this.lastNature.copy(here);
    this.lastStream.copy(here);
    const M = new THREE.Matrix4(), pos = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    const box = new THREE.Box3(), c = new THREE.Vector3(), half = new THREE.Vector3();
    for (const im of this.B.kitMeshes as THREE.InstancedMesh[]) {
      const sph = im.userData.cull as THREE.Sphere | undefined;
      const d = sph ? Math.hypot(sph.center.x - here.x, sph.center.z - here.y) - sph.radius : 0;
      const have = this.cells.get(im);
      if (have && d > STREAM_OUT) {
        for (const col of have.colliders) this.world.removeCollider(col, false);
        this.cells.delete(im);
        continue;
      }
      if (have || d > STREAM_IN) continue;
      // baked colliders (tools/prefab_bake.mjs): one set per prototype, carried by each instance; only when the bake
      // still matches the geometry the game loaded. Other parts of a baked prototype add nothing.
      const kit = im.userData.kit as string | undefined, bake = kit ? bakedFor(this.B, kit) : null;
      if (bake) {
        const cols: RAPIER.Collider[] = [];
        if (im.userData.part === 0) {
          const IM = new THREE.Matrix4(), bp = new THREE.Vector3(), bq = new THREE.Quaternion(), bs = new THREE.Vector3(), cc = new THREE.Vector3();
          for (const arr of im.userData.inst as number[][]) {
            IM.fromArray(arr);
            IM.decompose(bp, bq, bs);
            if (Math.abs(bs.x * bs.y * bs.z) < 1e-6) continue;
            bq.normalize();
            for (const [cx, cy, cz, hx0, hy0, hz0] of bake.boxes) {
              const hx = Math.abs(hx0 * bs.x), hy = Math.abs(hy0 * bs.y), hz = Math.abs(hz0 * bs.z);
              if (hy < 0.05 || hx < 0.03 || hz < 0.03) continue;
              cc.set(cx, cy, cz).applyMatrix4(IM);
              if (![hx, hy, hz, cc.x, cc.y, cc.z].every(Number.isFinite) || hx > 2000 || hz > 2000) continue;
              cols.push(this.world.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(cc.x, cc.y, cc.z).setRotation(bq).setFriction(0.6)));
            }
          }
        }
        this.cells.set(im, { mesh: im, colliders: cols });
        continue;
      }
      if (kit) bakeStats.fallback.add(kit);
      if (!im.geometry.boundingBox) im.geometry.computeBoundingBox();
      box.copy(im.geometry.boundingBox!);
      box.getCenter(c);
      box.getSize(half).multiplyScalar(0.5);
      if (half.x * half.y * half.z < 1e-4) continue;
      const cols: RAPIER.Collider[] = [];
      for (let i = 0; i < im.count; i++) {
        im.getMatrixAt(i, M);
        M.decompose(pos, q, s);
        if (Math.abs(s.x * s.y * s.z) < 1e-6) continue; // hidden (zero-scaled) instance
        q.normalize();
        const hx = Math.abs(half.x * s.x), hy = Math.abs(half.y * s.y), hz = Math.abs(half.z * s.z);
        if (hy < 0.12 || hx < 0.05 || hz < 0.05) continue; // decals, flat trims: not worth a collider
        const ctr = c.clone().multiply(s).applyQuaternion(q).add(pos);
        // a NaN reaching Rapier panics inside WASM and poisons the whole world, so reject anything non-finite
        if (![hx, hy, hz, ctr.x, ctr.y, ctr.z, q.x, q.y, q.z, q.w].every(Number.isFinite) || hx > 2000 || hz > 2000) continue;
        const desc = RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(ctr.x, ctr.y, ctr.z).setRotation(q).setFriction(0.6);
        cols.push(this.world.createCollider(desc));
      }
      this.cells.set(im, { mesh: im, colliders: cols });
    }
    this.streamNature(here);
    this.streamBuildings(here);
    let n = this.nature.size;
    for (const v of this.bld.values()) n += v.length;
    for (const v of this.cells.values()) n += v.colliders.length;
    this.stats.colliders = n;
  }

  /**
   * Generated buildings (src/buildings): their solid boxes are the colliders, exactly as drawn, so doorways stay open.
   * Streamed per building within STREAM_IN of the player.
   */
  bld = new Map<any, RAPIER.Collider[]>();
  streamBuildings(here: THREE.Vector2) {
    const list: any[] = (this.worldRef as any).genBuildings || [];
    const px = here.x, pz = -here.y;
    const keep = new Set<any>();
    for (const P of list) {
      const d = Math.hypot(P.x - px, P.z - pz) - P.r;
      const have = this.bld.get(P);
      if (d > (have ? STREAM_OUT : STREAM_IN)) continue;
      keep.add(P);
      if (have) continue;
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), P.rot);
      const cols: RAPIER.Collider[] = [];
      for (const b of P.b.boxes) {
        if (!b.solid) continue;
        // local (three space, floor top at 0) -> world
        const wx = P.x + b.x * P.cos + b.z * P.sin, wz = -P.z - b.x * P.sin + b.z * P.cos, wy = P.y + b.y;
        if (![wx, wy, wz, b.hx, b.hy, b.hz].every(Number.isFinite)) continue;
        cols.push(this.world.createCollider(RAPIER.ColliderDesc.cuboid(b.hx, b.hy, b.hz).setTranslation(wx, wy, wz).setRotation(q).setFriction(0.7)));
      }
      this.bld.set(P, cols);
    }
    for (const [P, cols] of this.bld) if (!keep.has(P)) { for (const c of cols) this.world.removeCollider(c, false); this.bld.delete(P); }
  }

  /**
   * Natural colliders: tree trunks (capsules from the planet's tree grid, sized by species scale so the 100 m giants
   * are solid too), talus boulders (balls) and mesa pillars (cylinders). Streamed per instance within NATURE_R.
   */
  nature = new Map<string, RAPIER.Collider>();
  private natureMeshes: { kind: 'boulder' | 'pillar'; im: THREE.InstancedMesh; pts: Float32Array }[] | null = null;
  streamNature(here: THREE.Vector2) {
    const w: any = this.worldRef, want = new Set<string>(), R2 = NATURE_R * NATURE_R;
    const add = (key: string, make: () => RAPIER.ColliderDesc | null) => {
      want.add(key);
      if (this.nature.has(key)) return;
      const d = make();
      if (d) this.nature.set(key, this.world.createCollider(d));
    };
    // trees
    const grid: Map<string, any[]> | undefined = w._treeGrid;
    if (grid) {
      const px = here.x, pz = -here.y; // legacy coords
      for (let gx = Math.floor((px - NATURE_R) / 200); gx <= Math.floor((px + NATURE_R) / 200); gx++)
        for (let gz = Math.floor((pz - NATURE_R) / 200); gz <= Math.floor((pz + NATURE_R) / 200); gz++) {
          const L = grid.get(gx + ',' + gz);
          if (!L) continue;
          for (const t of L) {
            const dx = t.x - px, dz = t.z - pz;
            if (dx * dx + dz * dz > R2 || !Number.isFinite(t.x) || !Number.isFinite(t.z)) continue;
            const ts = Math.max(0.5, Math.min(40, (t.b && t.b.ts) || 1));
            add('t' + t.x.toFixed(1) + ',' + t.z.toFixed(1), () => {
              const gy = Number.isFinite(t.y) ? t.y : this.B.groundH(w, t.x, t.z);
              const r = 0.32 * ts, hh = 2.6 * ts;
              return RAPIER.ColliderDesc.capsule(hh, r).setTranslation(t.x, gy + hh + r * 0.5, -t.z).setFriction(0.5);
            });
          }
        }
    }
    // boulders and pillars: found once per planet among the ground's instanced meshes
    if (!this.natureMeshes) {
      this.natureMeshes = [];
      this.B.G.ground.traverse((o: any) => {
        if (!o.isInstancedMesh) return;
        const g = o.geometry, p = g.parameters || {};
        const kind = g.type === 'DodecahedronGeometry' ? 'boulder' : g.type === 'CylinderGeometry' && p.radiusTop === 0.55 && p.radiusBottom === 1 ? 'pillar' : null;
        if (!kind) return;
        const a = o.instanceMatrix.array as Float32Array, pts = new Float32Array(o.count * 3);
        for (let i = 0; i < o.count; i++) { pts[i * 3] = a[i * 16 + 12]; pts[i * 3 + 1] = a[i * 16 + 13]; pts[i * 3 + 2] = a[i * 16 + 14]; }
        this.natureMeshes!.push({ kind, im: o, pts });
      });
    }
    const M = new THREE.Matrix4(), pos = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    for (const nm of this.natureMeshes) {
      const P = nm.pts;
      for (let i = 0; i < nm.im.count; i++) {
        const dx = P[i * 3] - here.x, dz = P[i * 3 + 2] - here.y;
        if (dx * dx + dz * dz > R2) continue;
        add(nm.kind[0] + i + ':' + nm.im.id, () => {
          nm.im.getMatrixAt(i, M);
          M.decompose(pos, q, s);
          if (![pos.x, pos.y, pos.z, s.x, s.y, s.z].every(Number.isFinite) || s.y < 0.8) return null;
          if (nm.kind === 'boulder') return RAPIER.ColliderDesc.ball(Math.max(0.4, Math.min(s.x, s.z) * 0.85)).setTranslation(pos.x, pos.y, pos.z);
          return RAPIER.ColliderDesc.cylinder(s.y / 2, Math.max(s.x, s.z) * 0.8).setTranslation(pos.x, pos.y + s.y / 2, pos.z);
        });
      }
    }
    for (const [k, c] of this.nature) if (!want.has(k)) { this.world.removeCollider(c, false); this.nature.delete(k); }
  }

  /* ---- navigation for NPCs: corrections against the same colliders the player collides with ---- */
  private probe: RAPIER.Ball | null = null;
  /** is a 0.45 m ball at legacy (x, z) at chest height inside a building, rock or tree? */
  blocked(x: number, z: number): boolean {
    if (!this.probe) this.probe = new RAPIER.Ball(0.45);
    const y = this.B.groundH(this.worldRef, x, z) + 0.95;
    let hit = false;
    this.world.intersectionsWithShape({ x, y, z: -z }, { x: 0, y: 0, z: 0, w: 1 }, this.probe, (c) => {
      if (c === this.collider || c.shape.type === RAPIER.ShapeType.HeightField) return true;
      hit = true;
      return false;
    });
    return hit;
  }

  /** A* on a 1.5 m grid (64 x 64 around the mover) avoiding blocked cells; returns legacy-coord waypoints or null */
  findPath(fx: number, fz: number, tx: number, tz: number): { x: number; z: number }[] | null {
    const C = 1.5, N = 64, ox = fx - (N / 2) * C, oz = fz - (N / 2) * C;
    const clampIdx = (v: number) => Math.max(0, Math.min(N - 1, Math.round(v)));
    const si = clampIdx((fx - ox) / C), sj = clampIdx((fz - oz) / C), ti = clampIdx((tx - ox) / C), tj = clampIdx((tz - oz) / C);
    const occ = new Int8Array(N * N).fill(-1);
    const isBlocked = (i: number, j: number) => {
      const k = j * N + i;
      if (occ[k] < 0) occ[k] = this.blocked(ox + i * C, oz + j * C) ? 1 : 0;
      return occ[k] === 1;
    };
    const g = new Float32Array(N * N).fill(Infinity), came = new Int32Array(N * N).fill(-1), open: number[] = [];
    const h = (i: number, j: number) => Math.hypot(i - ti, j - tj);
    const s0 = sj * N + si;
    g[s0] = 0;
    open.push(s0);
    const closed = new Uint8Array(N * N);
    let best = s0, bestH = h(si, sj), iter = 0;
    while (open.length && iter++ < 2500) {
      let bi = 0, bf = Infinity;
      for (let k = 0; k < open.length; k++) {
        const n = open[k], f = g[n] + h(n % N, (n / N) | 0);
        if (f < bf) { bf = f; bi = k; }
      }
      const cur = open.splice(bi, 1)[0], ci = cur % N, cj = (cur / N) | 0;
      if (closed[cur]) continue;
      closed[cur] = 1;
      const hc = h(ci, cj);
      if (hc < bestH) { bestH = hc; best = cur; }
      if (ci === ti && cj === tj) { best = cur; break; }
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ni = ci + di, nj = cj + dj;
        if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
        const nk = nj * N + ni;
        if (closed[nk] || isBlocked(ni, nj)) continue;
        if (di && dj && (isBlocked(ci + di, cj) || isBlocked(ci, cj + dj))) continue; // no corner cutting
        const ng = g[cur] + (di && dj ? 1.414 : 1);
        if (ng < g[nk]) { g[nk] = ng; came[nk] = cur; open.push(nk); }
      }
    }
    if (best === s0) return null;
    const out: { x: number; z: number }[] = [];
    for (let n = best; n !== s0 && n >= 0; n = came[n]) out.push({ x: ox + (n % N) * C, z: oz + ((n / N) | 0) * C });
    out.reverse();
    // thin the path: keep every third waypoint plus the last
    return out.filter((_, k) => k % 3 === 2 || k === out.length - 1);
  }

  jump() {
    if (this.grounded) {
      this.vy = JUMP_V;
      this.grounded = false;
    }
  }

  /** collision-corrected move for this frame. dx/dz in legacy coords (z north). Returns the new legacy position + feet y. */
  move(dx: number, dz: number, dt: number, opts: { flying?: boolean; swimDepth?: number } = {}) {
    if (!Number.isFinite(dx)) dx = 0;
    if (!Number.isFinite(dz)) dz = 0;
    if (!(dt > 0)) dt = FIXED_DT;
    const t = this.body.translation();
    if (opts.flying) {
      // flying mounts: no gravity, no building collisions for now (altitude is owned by the ride code)
      this.vy = 0;
      this.body.setNextKinematicTranslation({ x: t.x + dx, y: t.y, z: t.z - dz });
      return { x: t.x + dx, z: -(t.z - dz), y: t.y - FOOT, grounded: false };
    }
    const swim = opts.swimDepth ?? 0;
    if (swim > 1.2) this.vy = Math.max(this.vy, -2); // floating in deep water
    this.vy = this.grounded && this.vy <= 0 ? -1 : this.vy + GRAVITY * dt;
    this.cct.computeColliderMovement(this.collider, { x: dx, y: this.vy * dt, z: -dz });
    const mv = this.cct.computedMovement();
    this.grounded = this.cct.computedGrounded();
    if (this.grounded && this.vy < 0) this.vy = 0;
    const nx = t.x + mv.x, ny = t.y + mv.y, nz = t.z + mv.z;
    this.body.setNextKinematicTranslation({ x: nx, y: ny, z: nz });
    // never let the capsule end up under the terrain (bad step, teleport, tunnelling at very low frame rates)
    const ground = this.B.groundH(this.worldRef, nx, -nz) + FOOT;
    if (ny < ground - 0.25) {
      this.body.setNextKinematicTranslation({ x: nx, y: ground, z: nz });
      this.vy = 0;
      this.grounded = true;
      return { x: nx, z: -nz, y: ground - FOOT, grounded: true };
    }
    return { x: nx, z: -nz, y: ny - FOOT, grounded: this.grounded };
  }

  teleport(x: number, z: number) {
    const y = this.B.groundH(this.worldRef, x, z) + FOOT + 0.05;
    this.body.setTranslation({ x, y, z: -z }, true);
    this.vy = 0;
    this.stream(true);
  }

  /** fixed 60 Hz world step; returns how many steps ran */
  step(realDt: number) {
    this.acc = Math.min(this.acc + realDt, FIXED_DT * 5);
    let n = 0;
    while (this.acc >= FIXED_DT) {
      this.world.step();
      this.acc -= FIXED_DT;
      n++;
    }
    this.stats.steps += n;
    return n;
  }

  dispose() {
    this.world.free();
    this.cells.clear();
    this.nature.clear();
    this.bld.clear();
  }
}

/* ---- wiring into the legacy runtime ---- */
export async function installPhysics() {
  const B = await bridge();
  await initPhysics();
  let P: PlanetPhysics | null = null;
  // a Rapier panic poisons its world (every later call throws "recursive use of an object"): drop physics for that
  // planet, fall back to the legacy movement, and report it once
  let broken: unknown = null;
  let phase = '';
  const fail = (e: unknown) => {
    console.warn('[physics] disabled for this planet after an error in ' + phase + ':', e);
    broken = B.groundWorld;
    try {
      P?.dispose();
    } catch {}
    P = null;
  };
  const ensure = () => {
    const w = B.groundWorld;
    if (!w || B.level !== 'ground') return null;
    if (P && P.worldRef !== w) {
      P.dispose();
      P = null;
    }
    if (!P && w.hGrid) {
      phase = 'create';
      P = new PlanetPhysics(B, w);
      phase = 'stream-initial';
      P.stream(true);
    }
    return P;
  };
  B.wrap('buildGround', (orig) => function (this: unknown, ...a: unknown[]) {
    if (P) {
      P.dispose();
      P = null;
    }
    return orig.apply(this, a);
  });
  B.wrap('updatePlay', (orig) => function (this: unknown, dt: number) {
    const p = B.play;
    let P2: PlanetPhysics | null = null;
    if (B.groundMode === 'play' && !B.rts?.on && broken !== B.groundWorld) {
      try {
        phase = 'build';
        P2 = ensure();
      } catch (e) {
        fail(e);
      }
    }
    if (!P2) return orig.call(this, dt);
    const x0 = p.x, z0 = p.z;
    // a teleport (travel, respawn, cart summon) shows up as a jump of more than 30 m in one frame
    const t = P2.body.translation();
    if (Math.hypot(t.x - x0, -t.z - z0) > 30) P2.teleport(x0, z0);
    const r = orig.call(this, dt);
    try {
    phase = 'move';
    const dx = p.x - x0, dz = p.z - z0;
    const rm = p.mount, flying = !!(rm && rm.def && rm.def.fly && (p.alt || 0) > 1);
    // the legacy jump plays its wind-up clip, then starts a fake model offset (play.jy). Physics takes over at that
    // moment: a real jump on the capsule, and the fake offset is cleared so the two never stack.
    if ((p.jy || 0) > 0) {
      if (!rm) P2.jump();
      p.jy = 0;
      p.jv = 0;
    }
    const res = P2.move(dx, dz, Math.min(dt, 0.1), { flying, swimDepth: B.waterDepth(B.groundWorld, x0, z0) });
    p.x = res.x;
    p.z = res.z;
    p.physY = res.y;
    p.grounded = res.grounded;
    p.airborne = !res.grounded;
    if (p.model && !rm) {
      // the legacy code placed the model on the terrain; put it where the capsule actually is (on roofs, mid-jump)
      const gy = B.groundH(B.groundWorld, p.x, p.z);
      const swim = B.waterDepth(B.groundWorld, p.x, p.z);
      const y = Math.max(res.y, gy + Math.max(0, swim - 1.3));
      p.model.position.set(p.x, y, -p.z);
    }
    phase = 'stream';
    P2.stream();
    phase = 'step';
    P2.step(dt);
    } catch (e) {
      fail(e);
    }
    return r;
  });
  /* NPC navigation corrections: creatures, townsfolk and enemies are moved by the legacy AI (straight lines to a target).
     After each step, if the new spot is inside a building, rock or tree the step is undone and the NPC gets an A* detour
     around it; one that keeps failing for 3 s gives up on that target (the legacy AI picks a new one). */
  B.wrap('thinkCreature', (orig) => function (this: unknown, c: any, dt: number, w: any) {
    const u = c.userData, x0 = u.pos?.x, z0 = u.pos?.z;
    const r = orig.call(this, c, dt, w);
    const Pn = P;
    if (!Pn || Pn.worldRef !== w || !u.pos || x0 === undefined) return r;
    try {
      phase = 'nav';
      if ((u.pos.x !== x0 || u.pos.z !== z0) && Pn.blocked(u.pos.x, u.pos.z) && !Pn.blocked(x0, z0)) {
        u.pos.x = x0;
        u.pos.z = z0;
        c.position.x = x0;
        c.position.z = -z0;
        u.navStuck = (u.navStuck || 0) + dt;
        const goal = (u.path && u.path.length ? u.path[u.path.length - 1] : u.target) || null;
        if (goal && (!u.navReplan || u.navReplan < performance.now())) {
          u.navReplan = performance.now() + 800;
          const path = Pn.findPath(x0, z0, goal.x, goal.z);
          if (path && path.length) {
            u.target = path.shift();
            u.path = path.concat(Math.hypot(goal.x - (path[path.length - 1]?.x ?? x0), goal.z - (path[path.length - 1]?.z ?? z0)) > 1.5 ? [goal] : []);
          }
        }
        if (u.navStuck > 3) {
          u.target = null;
          u.path = null;
          u.navStuck = 0;
        }
      } else if (u.navStuck) u.navStuck = Math.max(0, u.navStuck - dt);
    } catch (e) {
      fail(e);
    }
    return r;
  });
  (window as any).GG_PHYSICS = { get planet() { return P; }, get broken() { return !!broken; }, get phase() { return phase; } };
}
