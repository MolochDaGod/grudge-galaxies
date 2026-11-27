/**
 * Building validator: proves a generated building can be walked into and used, from its colliders alone.
 *
 * The walk grid is built the same way the physics sees the world: every solid box that reaches into the body's height
 * band (just above the floor up to HEADROOM) blocks, grown by the capsule radius. The grid covers the footprint plus a
 * street apron, and a flood fill from the street in front of the main door must reach every room, every slot's access
 * point and every interior door.
 */
import { CAPSULE_R, DOOR_MIN_H, DOOR_MIN_W, HEADROOM, MAX_BOXES, NAV_CELL, TALK_R, type Building } from './generate';

export interface NavGrid {
  x0: number;
  z0: number;
  nx: number;
  nz: number;
  cell: number;
  /** 0 blocked, 1 walkable, 2 walkable and reached from the street */
  g: Uint8Array;
}

const APRON = 3;
const STEP = 0.45; // boxes whose top is below this are stepped onto (steps, rugs), not blocking

export function navGrid(b: Building): NavGrid {
  const cell = NAV_CELL, x0 = -b.w / 2 - APRON, z0 = -b.d / 2 - APRON;
  const nx = Math.ceil((b.w + 2 * APRON) / cell), nz = Math.ceil((b.d + 2 * APRON) / cell);
  const g = new Uint8Array(nx * nz).fill(1);
  for (const bx of b.boxes) {
    if (!bx.solid) continue;
    const top = bx.y + bx.hy, bot = bx.y - bx.hy;
    if (top <= STEP || bot >= HEADROOM) continue; // floor, steps, ceiling
    const ax0 = bx.x - bx.hx - CAPSULE_R, ax1 = bx.x + bx.hx + CAPSULE_R, az0 = bx.z - bx.hz - CAPSULE_R, az1 = bx.z + bx.hz + CAPSULE_R;
    const i0 = Math.max(0, Math.floor((ax0 - x0) / cell)), i1 = Math.min(nx - 1, Math.floor((ax1 - x0) / cell));
    const k0 = Math.max(0, Math.floor((az0 - z0) / cell)), k1 = Math.min(nz - 1, Math.floor((az1 - z0) / cell));
    for (let k = k0; k <= k1; k++)
      for (let i = i0; i <= i1; i++) {
        const cx = x0 + (i + 0.5) * cell, cz = z0 + (k + 0.5) * cell;
        // rounded corners: a capsule touches a box corner at distance R, not R*sqrt(2)
        const dx = Math.max(0, Math.abs(cx - bx.x) - bx.hx), dz = Math.max(0, Math.abs(cz - bx.z) - bx.hz);
        if (dx * dx + dz * dz < CAPSULE_R * CAPSULE_R) g[k * nx + i] = 0;
      }
  }
  // flood from the street, straight out from the main door
  const front = b.doors.find((d) => d.exterior && d.axis === 'x' && d.z > 0);
  const si = Math.floor(((front ? front.x : 0) - x0) / cell), sk = nz - 2;
  const q: number[] = [];
  if (g[sk * nx + si] === 1) { g[sk * nx + si] = 2; q.push(sk * nx + si); }
  while (q.length) {
    const c = q.pop()!, i = c % nx, k = (c / nx) | 0;
    for (const [di, dk] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ii = i + di, kk = k + dk;
      if (ii < 0 || kk < 0 || ii >= nx || kk >= nz) continue;
      const n = kk * nx + ii;
      if (g[n] === 1) { g[n] = 2; q.push(n); }
    }
  }
  return { x0, z0, nx, nz, cell, g };
}

export function reached(n: NavGrid, x: number, z: number): boolean {
  const i = Math.floor((x - n.x0) / n.cell), k = Math.floor((z - n.z0) / n.cell);
  return i >= 0 && k >= 0 && i < n.nx && k < n.nz && n.g[k * n.nx + i] === 2;
}
/** nearest reached cell to (x, z), within r */
export function reachNear(n: NavGrid, x: number, z: number, r: number): number {
  let best = Infinity;
  const ri = Math.ceil(r / n.cell), ci = Math.floor((x - n.x0) / n.cell), ck = Math.floor((z - n.z0) / n.cell);
  for (let k = ck - ri; k <= ck + ri; k++)
    for (let i = ci - ri; i <= ci + ri; i++) {
      if (i < 0 || k < 0 || i >= n.nx || k >= n.nz || n.g[k * n.nx + i] !== 2) continue;
      const d = Math.hypot(n.x0 + (i + 0.5) * n.cell - x, n.z0 + (k + 0.5) * n.cell - z);
      if (d < best) best = d;
    }
  return best;
}

export interface Report {
  ok: boolean;
  errors: string[];
  stats: { boxes: number; solid: number; reachedShare: number };
}

export function validate(b: Building): Report {
  const errors: string[] = [];
  const solid = b.boxes.filter((x) => x.solid);
  // 1. sane numbers, inside the footprint (+ steps in front)
  for (const [i, x] of b.boxes.entries()) {
    const v = [x.x, x.y, x.z, x.hx, x.hy, x.hz];
    if (!v.every(Number.isFinite) || x.hx <= 0 || x.hy <= 0 || x.hz <= 0) errors.push(`box ${i} is not a finite positive box`);
    if (Math.abs(x.x) - x.hx < -b.w / 2 - 0.2 || Math.abs(x.x) + x.hx > b.w / 2 + 0.2 || x.z - x.hz < -b.d / 2 - 0.2 || x.z + x.hz > b.d / 2 + 1.2)
      errors.push(`box ${i} (${x.mat}) sticks out of the footprint`);
  }
  if (solid.length > MAX_BOXES) errors.push(`${solid.length} colliders, more than ${MAX_BOXES}`);
  // 2. doors: big enough, and nothing solid in the opening
  if (!b.doors.some((d) => d.exterior && d.axis === 'x' && d.z > 0)) errors.push('no main door in the front wall');
  for (const d of b.doors) {
    if (d.w < DOOR_MIN_W) errors.push(`door at ${d.x},${d.z} is ${d.w} m wide (min ${DOOR_MIN_W})`);
    if (d.h < DOOR_MIN_H) errors.push(`door at ${d.x},${d.z} is ${d.h} m tall (min ${DOOR_MIN_H})`);
    for (const x of solid) {
      const inX = d.axis === 'x' ? Math.abs(x.x - d.x) < x.hx + d.w / 2 - 0.05 && Math.abs(x.z - d.z) < x.hz + 0.05 : Math.abs(x.z - d.z) < x.hz + d.w / 2 - 0.05 && Math.abs(x.x - d.x) < x.hx + 0.05;
      const inY = x.y - x.hy < d.h - 0.05 && x.y + x.hy > 0.05;
      if (inX && inY) errors.push(`a ${x.mat} box blocks the door at ${d.x},${d.z}`);
    }
  }
  // 3. walkability: every door, room and slot reached from the street
  const n = navGrid(b);
  for (const d of b.doors) if (!reached(n, d.x, d.z)) errors.push(`door at ${d.x},${d.z} cannot be walked through`);
  for (const r of b.rooms) {
    let any = false;
    for (let z = r.z0 + 0.3; z < r.z1 && !any; z += NAV_CELL) for (let x = r.x0 + 0.3; x < r.x1 && !any; x += NAV_CELL) if (reached(n, x, z)) any = true;
    if (!any) errors.push(`room "${r.name}" cannot be reached`);
  }
  for (const s of b.slots) {
    const need = s.kind === 'vendor' ? TALK_R : s.kind === 'terminal' ? 1.8 : s.kind === 'decor' ? 99 : 2.4;
    const dist = reachNear(n, s.x, s.z, Math.min(need, 6));
    if (!(dist <= need)) errors.push(`${s.kind}${s.npc ? ' ' + s.npc : ''}${s.terminal ? ' ' + s.terminal : ''} at ${s.x},${s.z} is out of reach (${Number.isFinite(dist) ? dist.toFixed(1) + ' m' : 'no path'})`);
  }
  let inside = 0, insideR = 0;
  for (let k = 0; k < n.nz; k++)
    for (let i = 0; i < n.nx; i++) {
      const x = n.x0 + (i + 0.5) * n.cell, z = n.z0 + (k + 0.5) * n.cell;
      if (Math.abs(x) < b.w / 2 && Math.abs(z) < b.d / 2 && n.g[k * n.nx + i]) { inside++; if (n.g[k * n.nx + i] === 2) insideR++; }
    }
  return { ok: errors.length === 0, errors, stats: { boxes: b.boxes.length, solid: solid.length, reachedShare: inside ? insideR / inside : 0 } };
}
