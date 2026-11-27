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
    if (!force && here.distanceTo(this.lastStream) < 48) return;
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
    let n = 0;
    for (const v of this.cells.values()) n += v.colliders.length;
    this.stats.colliders = n;
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
  (window as any).GG_PHYSICS = { get planet() { return P; }, get broken() { return !!broken; }, get phase() { return phase; } };
}
