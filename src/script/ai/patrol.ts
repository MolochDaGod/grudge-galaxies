/**
 * Patrol queue (the Core3 patrol flowchart):
 *
 *   PatrolPoint queue empty? -- yes --> End
 *        no -> take the next patrol point -> find path from current position to it
 *        found path? -- no --> remove the patrol point from the queue, loop
 *        yes -> walk the path points accumulating travelled distance until
 *               (last point) or (travelled >= creature speed this tick) or (we entered a different cell)
 *             -> if travelled > speed: interpolate the point on the path at exactly `speed`
 *                else: next coordinate = that path point
 *
 * advance() returns the coordinate to move toward this tick (or null when the queue is done). Paths are cached until
 * the creature reaches the patrol point, and recomputed if it drifts more than a cell off them.
 */
export type Pt = { x: number; z: number };
export interface Pathfinder {
  (from: Pt, to: Pt): Pt[] | null;
}
const CELL = 64; // world cell size for "are we in a different cell?" (streaming / collision cells)
const cellOf = (p: Pt) => Math.floor(p.x / CELL) * 100000 + Math.floor(p.z / CELL);

export class PatrolQueue {
  queue: Pt[];
  path: Pt[] | null = null;
  loop: boolean;
  constructor(points: Pt[], loop = true) {
    this.queue = points.slice();
    this.loop = loop;
  }
  static ring(home: Pt, r: number, n: number) {
    const a0 = Math.random() * Math.PI * 2, pts: Pt[] = [];
    for (let i = 0; i < n; i++) {
      const a = a0 + (i / n) * Math.PI * 2;
      pts.push({ x: home.x + Math.cos(a) * r * (0.8 + Math.random() * 0.4), z: home.z + Math.sin(a) * r * (0.8 + Math.random() * 0.4) });
    }
    return new PatrolQueue(pts, true);
  }

  advance(pos: Pt, speed: number, find: Pathfinder): Pt | null {
    for (let guard = 0; guard < this.queue.length + 2; guard++) {
      if (!this.queue.length) return null; // queue empty -> end
      const goal = this.queue[0];
      if (Math.hypot(goal.x - pos.x, goal.z - pos.z) < 1.2) {
        // reached this patrol point: rotate it to the back for looping routes
        const done = this.queue.shift()!;
        if (this.loop) this.queue.push(done);
        this.path = null;
        continue;
      }
      if (!this.path || !this.path.length || Math.hypot(this.path[0].x - pos.x, this.path[0].z - pos.z) > CELL / 4) {
        this.path = find(pos, goal) || null; // find path from current position to target position
        if (!this.path || !this.path.length) {
          this.queue.shift(); // found path? no -> remove patrol point from queue
          this.path = null;
          continue;
        }
      }
      return this.walk(pos, speed);
    }
    return null;
  }

  private walk(pos: Pt, speed: number): Pt {
    const path = this.path!;
    let travelled = 0, prev = pos;
    const startCell = cellOf(pos);
    for (let i = 0; i < path.length; i++) {
      const pt = path[i], seg = Math.hypot(pt.x - prev.x, pt.z - prev.z);
      const last = i === path.length - 1;
      if (last || travelled + seg >= speed || cellOf(pt) !== startCell) {
        // source and target are both in world space here (the game keeps creatures in world x/z)
        if (travelled + seg > speed && seg > 1e-6) {
          const k = (speed - travelled) / seg; // target point on the path at exactly `speed`
          path.splice(0, i); // drop the points we already passed
          return { x: prev.x + (pt.x - prev.x) * k, z: prev.z + (pt.z - prev.z) * k };
        }
        path.splice(0, i); // next coordinate is this path point
        return pt;
      }
      travelled += seg;
      prev = pt;
    }
    return path[path.length - 1];
  }
}
