/**
 * Generated buildings: walk-in interiors with real doorways, baked colliders, a walk grid and service slots.
 *
 * Pure data, no three.js, so the generator and its validator run in tests. Every building is built in its own local
 * frame (metres): x across the front, z from front (+z, where the main door is) to back, y up with the floor top at 0.
 * The caller places it with (x, z, yaw, floorY) and draws the boxes; colliders are the same boxes, so what you see is
 * what you bump into.
 *
 * Rules the validator enforces (see validate.ts), so nothing here can quietly regress:
 *  - every door is at least DOOR_MIN_W wide and DOOR_MIN_H tall, with nothing solid in it;
 *  - from the street in front of the main door, the player capsule can walk into every room and up to every slot;
 *  - every vendor can be spoken to from a walkable cell within TALK_R;
 *  - every box is finite and inside the footprint (plus the front steps);
 *  - the collider count stays under MAX_BOXES.
 */

export const CAPSULE_R = 0.38; // must match src/physics/world.ts CAPSULE.radius
export const HEADROOM = 2.0;
export const DOOR_MIN_W = 1.2;
export const DOOR_MIN_H = 2.3;
export const TALK_R = 3.6; // interact.ts answers within 4.5 m; keep a margin
export const MAX_BOXES = 140;
export const NAV_CELL = 0.25;

export type Kind = 'cantina' | 'hospital' | 'armoury' | 'market' | 'temple' | 'guild' | 'bank' | 'house';
export type Mat = 'wall' | 'trim' | 'floor' | 'roof' | 'glow' | 'wood' | 'cloth';
export type RoofType = 'flat' | 'dome' | 'gable' | 'hip' | 'spire';

export interface Style {
  id: string;
  /** colours as 0xRRGGBB */
  wall: number;
  trim: number;
  floor: number;
  roof: number;
  glow: number;
  wood: number;
  cloth: number;
  roofType: RoofType;
  wallT: number;
  storeyH: number;
  /** glowing window strips on the outside */
  windows: boolean;
  /** extra trim band along the top of the walls */
  parapet: boolean;
}

export interface Box {
  /** centre */
  x: number;
  y: number;
  z: number;
  /** half extents */
  hx: number;
  hy: number;
  hz: number;
  mat: Mat;
  /** solid boxes are colliders; decor boxes are drawn only */
  solid: boolean;
}

export interface Door {
  x: number;
  z: number;
  /** wall the door is in: 'x' = door in a wall running along x (crossed by walking along z) */
  axis: 'x' | 'z';
  w: number;
  h: number;
  exterior: boolean;
}

export type SlotKind = 'terminal' | 'vendor' | 'decor' | 'bed' | 'altar' | 'rack' | 'table';
export interface Slot {
  kind: SlotKind;
  x: number;
  z: number;
  /** yaw the slot faces, radians, 0 = facing +z (out of the front door) */
  yaw: number;
  /** vendor role, mapped to the game's NPC roles by placement type */
  npc?: string;
  /** terminal kind: general | artisan | entertainer | scout | faction */
  terminal?: string;
  room: number;
}

export interface Room {
  name: string;
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

export interface Building {
  kind: Kind;
  style: string;
  seed: number;
  w: number;
  d: number;
  h: number;
  roof: { type: RoofType; y: number; w: number; d: number; rise: number };
  boxes: Box[];
  doors: Door[];
  rooms: Room[];
  slots: Slot[];
}

/* ---------- styles: one per planet, from each planet's history (see the lore doc's politics table) ---------- */

const S = (id: string, wall: number, trim: number, floor: number, roof: number, glow: number, roofType: RoofType, o: Partial<Style> = {}): Style => ({
  id, wall, trim, floor, roof, glow, wood: 0x6b4a2f, cloth: 0x8a3b2a, roofType, wallT: 0.35, storeyH: 4.2, windows: true, parapet: false, ...o,
});

export const STYLES: Record<string, Style> = {
  sarrak: S('sarrak', 0xcfb38a, 0xa88a5e, 0x8c7253, 0xd8c29a, 0xffc36a, 'dome', { wallT: 0.5, parapet: true, cloth: 0x9c4a2c }),
  veylara: S('veylara', 0xe8e4da, 0x8fa7c4, 0xbfb6a4, 0x5d7fa8, 0x9fd8ff, 'dome', { cloth: 0x3d6fa8 }),
  coraxis: S('coraxis', 0xb9b2a6, 0x6b6157, 0x7d7368, 0x4e5862, 0xffd58a, 'gable', { cloth: 0x7a2d34 }),
  talvern: S('talvern', 0xd8cdb4, 0x6b4a2f, 0x7a5d3e, 0xb89a55, 0xffcf7a, 'gable', { wallT: 0.3, cloth: 0x6a7a3a }),
  rhosmire: S('rhosmire', 0x7d6a4e, 0x4d3d2a, 0x5c4a35, 0x6e7a45, 0xb6f0a0, 'hip', { cloth: 0x3f5a3a }),
  dawnreach: S('dawnreach', 0xc9b99a, 0x8a6f4a, 0x9a8466, 0x8e5a3a, 0xffe0a0, 'hip', { cloth: 0xb0683a }),
  scoria: S('scoria', 0x4a4442, 0x2f2a28, 0x3a3532, 0x3a3532, 0xff7a2a, 'flat', { wallT: 0.6, parapet: true, cloth: 0x6a2a1a }),
  verdance: S('verdance', 0xe9ecdf, 0x6f9a5a, 0xc6c8b8, 0x7fa86a, 0xe9f7c0, 'spire', { cloth: 0x4f7a3a }),
  eldermoon: S('eldermoon', 0x7a6248, 0x4a3a2a, 0x5e4a36, 0x55703d, 0xffd88a, 'gable', { wallT: 0.32, cloth: 0x6a4a7a }),
  crimsona: S('crimsona', 0x5a2a2c, 0x1e1616, 0x3a2224, 0x2a1a1c, 0xff4a3a, 'spire', { cloth: 0x8a1e22 }),
  vashtar: S('vashtar', 0x6e5436, 0x3f2e1e, 0x5a4430, 0x4f6a35, 0x9fe08a, 'hip', { wallT: 0.4, cloth: 0x3d5a2a }),
  pyraxis: S('pyraxis', 0x2c2a2c, 0x5a2a1a, 0x232122, 0x1a1819, 0xff6a1a, 'flat', { wallT: 0.55, parapet: true, cloth: 0x5a1a10 }),
  rimehold: S('rimehold', 0x8c939a, 0x4a5058, 0x5a6066, 0xdfe7ee, 0x9fd8ff, 'flat', { parapet: true, cloth: 0x2a4a6a }),
};
export const WORLD_STYLE: Record<string, string> = {
  tatooine: 'sarrak', naboo: 'veylara', corellia: 'coraxis', talus: 'talvern', rori: 'rhosmire', dantooine: 'dawnreach', lok: 'scoria',
  yavin4: 'verdance', endor: 'eldermoon', dathomir: 'crimsona', kashyyyk: 'vashtar', mustafar: 'pyraxis', hoth: 'rimehold',
};

/* ---------- what each kind of building holds ---------- */

interface Plan {
  /** min and max footprint (w across, d deep), metres */
  min: [number, number];
  max: [number, number];
  storeys: number;
  /** back rooms behind the main hall, by share of the width */
  back: { name: string; share: number }[];
  /** how deep the back strip is, as a share of the depth (0 = no back rooms) */
  backDepth: number;
  hall: string;
}
const PLANS: Record<Kind, Plan> = {
  cantina: { min: [14, 12], max: [24, 20], storeys: 1.25, back: [{ name: 'Back room', share: 0.6 }, { name: 'Store', share: 0.4 }], backDepth: 0.3, hall: 'Bar' },
  hospital: { min: [14, 12], max: [24, 18], storeys: 1.1, back: [{ name: 'Ward', share: 0.5 }, { name: 'Surgery', share: 0.5 }], backDepth: 0.38, hall: 'Reception' },
  armoury: { min: [11, 10], max: [18, 15], storeys: 1.05, back: [{ name: 'Workshop', share: 1 }], backDepth: 0.35, hall: 'Shop' },
  market: { min: [14, 11], max: [24, 18], storeys: 1.1, back: [], backDepth: 0, hall: 'Market hall' },
  temple: { min: [12, 14], max: [20, 24], storeys: 1.6, back: [{ name: 'Sanctum', share: 1 }], backDepth: 0.28, hall: 'Nave' },
  guild: { min: [12, 11], max: [20, 16], storeys: 1.15, back: [{ name: 'Office', share: 0.5 }, { name: 'Archive', share: 0.5 }], backDepth: 0.32, hall: 'Hall' },
  bank: { min: [11, 10], max: [18, 14], storeys: 1.1, back: [{ name: 'Vault', share: 1 }], backDepth: 0.3, hall: 'Counting room' },
  house: { min: [8, 8], max: [13, 12], storeys: 0.85, back: [{ name: 'Bedroom', share: 0.55 }, { name: 'Pantry', share: 0.45 }], backDepth: 0.42, hall: 'Living room' },
};

/** classify a world placement type into a building kind, or null to leave it to the kit */
export function kindOf(t: string): Kind | null {
  const s = t.toLowerCase();
  if (/cantina|tavern|inn_|hotel/.test(s)) return 'cantina';
  if (/hospital|medical|cloning|medcenter/.test(s)) return 'hospital';
  if (/armou?ry|weapon|smith/.test(s)) return 'armoury';
  if (/temple|church|shrine|chapel/.test(s)) return 'temple';
  if (/bank/.test(s)) return 'bank';
  if (/guild|association|theater/.test(s)) return 'guild';
  if (/market|commerce|merchant|shop|bazaar/.test(s)) return 'market';
  if (/housing|house|dwelling|hut|cabin|home|filler_building|shack|hovel/.test(s)) return 'house';
  return null;
}

/* ---------- seeded random ---------- */
function rng(seed: number) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const r2 = (v: number) => Math.round(v * 100) / 100;

/* ---------- builder ---------- */

/**
 * @param kind building kind
 * @param styleId key of STYLES
 * @param fw,fd footprint the world gives (metres); clamped to the kind's range so buildings stay human-sized
 */
export function generate(kind: Kind, styleId: string, fw: number, fd: number, seed: number): Building {
  const st = STYLES[styleId] || STYLES.coraxis;
  const plan = PLANS[kind];
  const R = rng(seed);
  // footprint: the world's, held to the plan's range, snapped to half metres
  const w = Math.round(clamp(fw || plan.min[0], plan.min[0], plan.max[0]) * 2) / 2;
  const d = Math.round(clamp(fd || plan.min[1], plan.min[1], plan.max[1]) * 2) / 2;
  const T = st.wallT, h = r2(st.storeyH * plan.storeys), hw = w / 2, hd = d / 2;
  const boxes: Box[] = [], doors: Door[] = [], rooms: Room[] = [], slots: Slot[] = [];
  const add = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, mat: Mat, solid = true) => {
    if (x1 - x0 < 1e-3 || y1 - y0 < 1e-3 || z1 - z0 < 1e-3) return;
    boxes.push({ x: r2((x0 + x1) / 2), y: r2((y0 + y1) / 2), z: r2((z0 + z1) / 2), hx: r2((x1 - x0) / 2), hy: r2((y1 - y0) / 2), hz: r2((z1 - z0) / 2), mat, solid });
  };
  const doorH = Math.min(h - 0.6, kind === 'temple' ? 3.6 : kind === 'house' ? 2.5 : 2.9);

  /** a wall along x at depth z (thickness along z), from x0 to x1, with door gaps at the given centres */
  const wallX = (z: number, x0: number, x1: number, gaps: { c: number; w: number }[], mat: Mat = 'wall', exterior = false) => {
    let cur = x0;
    for (const g of [...gaps].sort((a, b) => a.c - b.c)) {
      add(cur, 0, z - T / 2, g.c - g.w / 2, h, z + T / 2, mat);
      add(g.c - g.w / 2, doorH, z - T / 2, g.c + g.w / 2, h, z + T / 2, mat); // lintel
      doors.push({ x: r2(g.c), z: r2(z), axis: 'x', w: g.w, h: doorH, exterior });
      cur = g.c + g.w / 2;
    }
    add(cur, 0, z - T / 2, x1, h, z + T / 2, mat);
  };
  /** a wall along z at x (thickness along x) */
  const wallZ = (x: number, z0: number, z1: number, gaps: { c: number; w: number }[], mat: Mat = 'wall', exterior = false) => {
    let cur = z0;
    for (const g of [...gaps].sort((a, b) => a.c - b.c)) {
      add(x - T / 2, 0, cur, x + T / 2, h, g.c - g.w / 2, mat);
      add(x - T / 2, doorH, g.c - g.w / 2, x + T / 2, h, g.c + g.w / 2, mat);
      doors.push({ x: r2(x), z: r2(g.c), axis: 'z', w: g.w, h: doorH, exterior });
      cur = g.c + g.w / 2;
    }
    add(x - T / 2, 0, cur, x + T / 2, h, z1, mat);
  };

  // floor slab (top at 0) and ceiling slab
  add(-hw, -0.4, -hd, hw, 0, hd, 'floor');
  add(-hw, h, -hd, hw, h + 0.3, hd, 'roof');

  // exterior walls: main door centred in the front (+z); big buildings get a side door too
  const frontDoorW = kind === 'house' ? 1.4 : kind === 'temple' ? 2.6 : 2.0;
  wallX(hd - T / 2, -hw, hw, [{ c: 0, w: frontDoorW }], 'wall', true);
  wallX(-hd + T / 2, -hw, hw, [], 'wall', true);
  const side = w * d > 260 && kind !== 'temple' && kind !== 'bank';
  const backZ = plan.backDepth ? -hd + d * plan.backDepth : -hd; // front edge of the back strip
  const hallMidZ = (backZ + hd) / 2;
  wallZ(-hw + T / 2, -hd + T, hd - T, side ? [{ c: hallMidZ, w: 1.6 }] : [], 'wall', true);
  wallZ(hw - T / 2, -hd + T, hd - T, [], 'wall', true);

  // the hall
  rooms.push({ name: plan.hall, x0: -hw + T, z0: plan.back.length ? backZ + T / 2 : -hd + T, x1: hw - T, z1: hd - T });

  const backGaps: { c: number; w: number }[] = [];
  // back rooms: a wall across at backZ with a door into each room, split by walls along z
  if (plan.back.length) {
    const inner = w - 2 * T;
    let x = -hw + T;
    const gaps = backGaps;
    plan.back.forEach((b, i) => {
      const bw = i === plan.back.length - 1 ? hw - T - x : inner * b.share;
      const x1 = x + bw;
      rooms.push({ name: b.name, x0: x, z0: -hd + T, x1, z1: backZ - T / 2 });
      gaps.push({ c: r2(x + bw / 2), w: 1.4 });
      if (i < plan.back.length - 1) wallZ(x1, -hd + T, backZ - T / 2, [], 'wall');
      x = x1;
    });
    wallX(backZ, -hw + T, hw - T, gaps, 'wall');
  }

  // exterior trim and windows (drawn only)
  const ext = 0.04;
  add(-hw - ext, 0, hd - 0.02, hw + ext, 0.35, hd + ext, 'trim', false);
  if (st.parapet) {
    add(-hw - ext, h + 0.3, -hd - ext, hw + ext, h + 0.85, -hd + 0.3, 'trim');
    add(-hw - ext, h + 0.3, hd - 0.3, hw + ext, h + 0.85, hd + ext, 'trim');
    add(-hw - ext, h + 0.3, -hd + 0.3, -hw + 0.3, h + 0.85, hd - 0.3, 'trim');
    add(hw - 0.3, h + 0.3, -hd + 0.3, hw + ext, h + 0.85, hd - 0.3, 'trim');
  }
  if (st.windows) {
    const wy0 = Math.min(1.5, h * 0.4), wy1 = Math.min(wy0 + 0.9, h - 0.5);
    const n = Math.max(1, Math.floor((w - frontDoorW - 2) / 3.2 / 2));
    for (let i = 0; i < n; i++) {
      const off = frontDoorW / 2 + 1 + (i + 0.5) * ((hw - frontDoorW / 2 - 1.2) / n);
      for (const sx of [-1, 1]) add(sx * off - 0.5, wy0, hd, sx * off + 0.5, wy1, hd + 0.05, 'glow', false);
    }
    const ns = Math.max(1, Math.floor(d / 4.5));
    for (let i = 0; i < ns; i++) {
      const z = -hd + (i + 0.5) * (d / ns);
      if (side && Math.abs(z - hallMidZ) < 1.4) continue;
      add(-hw - 0.05, wy0, z - 0.5, -hw, wy1, z + 0.5, 'glow', false);
      add(hw, wy0, z - 0.5, hw + 0.05, wy1, z + 0.5, 'glow', false);
    }
  }
  // door frames (drawn only) and a sign glow over the main door
  add(-frontDoorW / 2 - 0.18, 0, hd - 0.02, -frontDoorW / 2, doorH + 0.18, hd + 0.08, 'trim', false);
  add(frontDoorW / 2, 0, hd - 0.02, frontDoorW / 2 + 0.18, doorH + 0.18, hd + 0.08, 'trim', false);
  add(-frontDoorW / 2 - 0.18, doorH, hd - 0.02, frontDoorW / 2 + 0.18, doorH + 0.18, hd + 0.08, 'trim', false);
  if (kind !== 'house') add(-1.2, doorH + 0.35, hd, 1.2, doorH + 0.75, hd + 0.08, 'glow', false);
  // front steps (solid, so feet ride up onto the floor even on a slope)
  add(-frontDoorW / 2 - 0.4, -0.4, hd, frontDoorW / 2 + 0.4, -0.2, hd + 0.9, 'trim');
  add(-frontDoorW / 2 - 0.4, -0.2, hd, frontDoorW / 2 + 0.4, 0, hd + 0.45, 'trim');

  /* ---------- interiors ---------- */
  const hall = rooms[0];
  const hallW = hall.x1 - hall.x0, hallD = hall.z1 - hall.z0;
  /** a counter across part of the back of a room, the NPC behind it facing the door */
  const counter = (room: Room, room_i: number, npc: string, len: number, zFromBack = 1.6) => {
    const cz = room.z0 + zFromBack;
    // free spans along the back of the room: never in front of a door into the back rooms (door width + 1 m each side)
    let spans: [number, number][] = [[room.x0 + 1.3, room.x1 - 1.3]];
    if (room_i === 0) for (const g of backGaps) {
      const a0 = g.c - g.w / 2 - 1.0, a1 = g.c + g.w / 2 + 1.0;
      spans = spans.flatMap(([u, v]): [number, number][] => (a1 <= u || a0 >= v ? [[u, v]] : ([[u, a0], [a1, v]] as [number, number][]).filter(([p, q]) => q - p > 0.01)));
    }
    const span = spans.sort((a, b) => b[1] - b[0] - (a[1] - a[0]))[0] || [room.x0 + 1.3, room.x1 - 1.3];
    const room_w = span[1] - span[0], half = Math.max(0.6, Math.min(len, room_w) / 2);
    const cx = r2((span[0] + span[1]) / 2 + (R() - 0.5) * Math.max(0, room_w - 2 * half));
    add(cx - half, 0, cz - 0.35, cx + half, 1.05, cz + 0.35, 'wood');
    add(cx - half - 0.05, 1.05, cz - 0.42, cx + half + 0.05, 1.12, cz + 0.42, 'trim');
    slots.push({ kind: 'vendor', x: cx, z: r2(cz - 0.95), yaw: 0, npc, room: room_i });
    return cx;
  };
  const terminal = (x: number, z: number, yaw: number, kindT: string, room_i: number) => slots.push({ kind: 'terminal', x: r2(x), z: r2(z), yaw, terminal: kindT, room: room_i });
  const tables = (room: Room, room_i: number, n: number, zMin: number) => {
    for (let i = 0; i < n; i++) {
      const tx = r2(room.x0 + 1.8 + R() * Math.max(0.1, room.x1 - room.x0 - 3.6)), tz = r2(Math.max(zMin, room.z0 + 1.8) + R() * Math.max(0.1, room.z1 - Math.max(zMin, room.z0 + 1.8) - 2.6));
      if (Math.abs(tx) < frontDoorW / 2 + 1.2 && tz > hd - 3.2) continue; // keep the doorway clear
      add(tx - 0.55, 0, tz - 0.55, tx + 0.55, 0.78, tz + 0.55, 'wood');
      slots.push({ kind: 'table', x: tx, z: tz, yaw: 0, room: room_i });
    }
  };
  const back = (i: number) => rooms[1 + i];
  switch (kind) {
    case 'cantina': {
      counter(hall, 0, 'bartender', hallW * 0.55, 1.4);
      terminal(hall.x0 + 0.6, hall.z1 - 2.2, Math.PI / 2, 'entertainer', 0);
      tables(hall, 0, 3 + Math.floor(R() * 3), hall.z0 + 4);
      if (back(0)) slots.push({ kind: 'decor', x: r2((back(0).x0 + back(0).x1) / 2), z: r2((back(0).z0 + back(0).z1) / 2), yaw: 0, room: 1 });
      break;
    }
    case 'hospital': {
      counter(hall, 0, 'medic', Math.min(5, hallW * 0.4), 1.4);
      terminal(hall.x1 - 0.6, hall.z1 - 2.2, -Math.PI / 2, 'general', 0);
      for (const [i, b] of rooms.slice(1).entries()) {
        const n = Math.max(1, Math.floor((b.x1 - b.x0 - 1) / 2.2));
        for (let k = 0; k < n; k++) {
          const bx = b.x0 + 1.1 + k * 2.2;
          if (bx + 0.6 > b.x1 - 0.4) break;
          add(bx - 0.45, 0, b.z0 + 0.1, bx + 0.45, 0.6, b.z0 + 2.1, 'cloth');
          slots.push({ kind: 'bed', x: r2(bx), z: r2(b.z0 + 1.1), yaw: 0, room: i + 1 });
        }
      }
      if (back(1)) slots.push({ kind: 'vendor', x: r2(back(1).x1 - 1.0), z: r2((back(1).z0 + 2.4 + back(1).z1) / 2), yaw: -Math.PI / 2, npc: 'surgeon', room: 2 });
      break;
    }
    case 'armoury': {
      counter(hall, 0, 'vendor_weapons', Math.min(6, hallW * 0.6), 1.4);
      for (const sx of [-1, 1]) {
        const x = sx > 0 ? hall.x1 - 0.35 : hall.x0 + 0.35;
        // racks along the side walls, broken around the side door (west wall) when there is one
        const za = hall.z0 + 2.6, zb = hall.z1 - 2.6, cut = side && sx < 0 ? [hallMidZ - 1.9, hallMidZ + 1.9] : null;
        if (cut) { add(x - 0.25, 0, za, x + 0.25, 2.2, Math.min(zb, cut[0]), 'wood'); add(x - 0.25, 0, Math.max(za, cut[1]), x + 0.25, 2.2, zb, 'wood'); }
        else add(x - 0.25, 0, za, x + 0.25, 2.2, zb, 'wood');
        slots.push({ kind: 'rack', x: r2(x), z: r2((hall.z0 + hall.z1) / 2), yaw: sx > 0 ? -Math.PI / 2 : Math.PI / 2, room: 0 });
      }
      terminal(hall.x0 + 0.6, hall.z1 - 1.4, Math.PI / 2, 'artisan', 0);
      if (back(0)) slots.push({ kind: 'vendor', x: r2((back(0).x0 + back(0).x1) / 2), z: r2((back(0).z0 + back(0).z1) / 2), yaw: 0, npc: 'artisan_armorsmith', room: 1 });
      break;
    }
    case 'market': {
      const n = Math.max(2, Math.min(6, Math.floor(hallW / 4)));
      for (let i = 0; i < n; i++) {
        const sx = hall.x0 + (i + 0.5) * (hallW / n), z = hall.z0 + 1.2;
        add(sx - 1.1, 0, z - 0.35, sx + 1.1, 0.95, z + 0.35, 'wood');
        add(sx - 1.3, 2.4, z - 0.9, sx + 1.3, 2.5, z + 0.9, 'cloth', false); // awning
        slots.push({ kind: 'vendor', x: r2(sx), z: r2(z - 0.9 > hall.z0 + 0.2 ? z - 0.75 : z), yaw: 0, npc: i % 2 ? 'trader' : 'merchant', room: 0 });
      }
      terminal(hall.x1 - 0.6, hall.z1 - 2.2, -Math.PI / 2, 'general', 0);
      break;
    }
    case 'temple': {
      const s = back(0)!;
      add(-1.2, 0, s.z0 + 0.6, 1.2, 1.1, s.z0 + 1.6, 'trim');
      slots.push({ kind: 'altar', x: 0, z: r2(s.z0 + 1.1), yaw: 0, room: 1 });
      slots.push({ kind: 'vendor', x: 1.8, z: r2(s.z0 + 2.6), yaw: 0, npc: 'priest', room: 1 });
      const rows = Math.max(2, Math.floor((hallD - 4) / 1.8));
      for (let i = 0; i < rows; i++) {
        const z = hall.z0 + 1.6 + i * 1.8;
        if (z > hall.z1 - 3) break;
        for (const sx of [-1, 1]) { const e = Math.min(hallW / 2 - 0.8, 4.6); if (e > 1.9) add(sx > 0 ? 1.6 : -e, 0, z - 0.25, sx > 0 ? e : -1.6, 0.5, z + 0.25, 'wood'); }
      }
      terminal(hall.x0 + 0.6, hall.z1 - 1.6, Math.PI / 2, 'faction', 0);
      break;
    }
    case 'guild': {
      counter(hall, 0, 'recruiter', Math.min(5, hallW * 0.4), 1.4);
      terminal(hall.x0 + 0.6, hall.z1 - 2.2, Math.PI / 2, 'scout', 0);
      terminal(hall.x1 - 0.6, hall.z1 - 2.2, -Math.PI / 2, 'general', 0);
      tables(hall, 0, 2, hall.z0 + 4);
      break;
    }
    case 'bank': {
      counter(hall, 0, 'banker', Math.min(6, hallW * 0.6), 1.4);
      terminal(hall.x1 - 0.6, hall.z1 - 2.2, -Math.PI / 2, 'general', 0);
      const v = back(0)!;
      add(v.x0 + 0.4, 0, v.z0 + 0.3, v.x0 + 1.4, 1.6, v.z0 + 1.0, 'trim');
      break;
    }
    case 'house': {
      tables(hall, 0, 1, hall.z0 + 1);
      const b = back(0);
      if (b) {
        add(b.x0 + 0.2, 0, b.z0 + 0.15, b.x0 + 1.2, 0.55, b.z0 + 2.15, 'cloth');
        slots.push({ kind: 'bed', x: r2(b.x0 + 0.7), z: r2(b.z0 + 1.15), yaw: 0, room: 1 });
      }
      break;
    }
  }

  const rise = st.roofType === 'flat' ? 0 : st.roofType === 'dome' ? Math.min(w, d) * 0.32 : st.roofType === 'spire' ? Math.min(w, d) * 0.9 : Math.min(w, d) * 0.38;
  return { kind, style: st.id, seed, w, d, h, roof: { type: st.roofType, y: r2(h + 0.3), w, d, rise: r2(rise) }, boxes, doors, rooms, slots };
}
