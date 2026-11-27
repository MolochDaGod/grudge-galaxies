/**
 * Creature AI as data: templates + the Core3 creature state graph.
 *
 *            Spawn --finished--> Standing <--bored/tired--> Wandering
 *                                   |  \                 /    |
 *                     found something interesting ---> Alert  |
 *                                   |        (still interesting / no longer -> Standing)
 *                 getting attacked / in aggro range         |
 *                                   v                       v
 *                                Attack --low health--> Flee --far away--> Alert / Return
 *                                   |  --lost target / leash--> Return --home--> Standing
 *            any state --zeroHealth--> Death --readyForRespawn--> Spawn
 *
 * Every number (aggro, alert radius, leash, flee threshold, pack call radius, ranged reach, speeds, wander radius,
 * standing/wandering durations, patrol route) comes from a `creature` template, so new creatures are new data.
 */
import { ObjectTemplate, registerObjectType, defineTemplate, getTemplate, hasTemplate, num, bool, type TemplateData } from '../templates';
import type { MachineDef } from '../fsm';
import { Machine } from '../fsm';
import { PatrolQueue, type Pathfinder } from './patrol';

export class CreatureTemplate extends ObjectTemplate {
  aggro = 12; alert = 20; leash = 70; flee = 0; pack = 0; ranged = 0; burst = 1; slow = 1;
  walk = 1.3; run = 2.3; wanderR = 10; standMin = 3; standMax = 9; wanderMin = 4; wanderMax = 10;
  nightAggro = 1.2; respawn = 300; patrol: 'none' | 'ring' | 'points' = 'none'; patrolR = 20; social = false;
  readObject(d: TemplateData) {
    super.readObject(d);
    const ai = (d.ai || {}) as Record<string, unknown>;
    for (const k of ['aggro', 'alert', 'leash', 'flee', 'pack', 'ranged', 'burst', 'slow', 'walk', 'run', 'wanderR', 'standMin', 'standMax', 'wanderMin', 'wanderMax', 'nightAggro', 'respawn', 'patrolR'] as const)
      (this as any)[k] = num(ai, k, (this as any)[k]);
    this.patrol = (['none', 'ring', 'points'].includes(ai.patrol as string) ? ai.patrol : 'none') as any;
    this.social = bool(ai, 'social', false);
    if (this.alert < this.aggro) this.alert = this.aggro * 1.6;
  }
  loadTemplateData(target: Record<string, unknown>) {
    target.aiTemplate = this.id;
  }
}
registerObjectType('creature', CreatureTemplate);

/* base templates: one per creature category, tuned from the game's archetype table */
defineTemplate('object/creature/base', { templateType: 'creature', ai: { aggro: 12, alert: 20, leash: 70, walk: 1.3, run: 2.3 } });
const CAT: Record<string, Record<string, unknown>> = {
  beasts: { aggro: 12, pack: 16, flee: 0.25 },
  reptiles: { aggro: 10, pack: 12 },
  spiders: { aggro: 9, pack: 10, burst: 1.5 },
  orcs: { aggro: 20, pack: 22, ranged: 14, social: true },
  undead: { aggro: 18, pack: 18, ranged: 12, walk: 1.0 },
  trolls: { aggro: 16, pack: 14 },
  minotaurs: { aggro: 16, pack: 12 },
  titans: { aggro: 18, leash: 90 },
  golems: { aggro: 9, slow: 0.7, alert: 12 },
  elementals: { aggro: 11, ranged: 10 },
  dragons: { aggro: 26, ranged: 16, alert: 45, leash: 120, run: 3 },
  egyptians: { aggro: 16, pack: 16, ranged: 12, social: true },
};
for (const [cat, ai] of Object.entries(CAT)) defineTemplate(`object/creature/${cat}`, { templateType: 'creature', extends: 'object/creature/base', ai });
// behaviour variants a placement can opt into (p.g.ai = 'sentinel' etc.)
defineTemplate('object/creature/variant/sentinel', { templateType: 'creature', extends: 'object/creature/base', ai: { patrol: 'ring', patrolR: 22, standMin: 2, standMax: 5 } });
defineTemplate('object/creature/variant/prey', { templateType: 'creature', extends: 'object/creature/base', ai: { aggro: 0, alert: 18, flee: 1 } });

export function templateFor(cat: string, variant?: string) {
  const v = variant && `object/creature/variant/${variant}`;
  if (v && hasTemplate(v)) return getTemplate<CreatureTemplate>(v);
  return getTemplate<CreatureTemplate>(hasTemplate(`object/creature/${cat}`) ? `object/creature/${cat}` : 'object/creature/base');
}

/** what the brain needs from the world (implemented by the runtime glue) */
export interface CreatureWorld {
  playerPos(): { x: number; z: number } | null; // null when no player is in play
  playerAlive(): boolean;
  night(): boolean;
  /** standing check: true when this creature's faction tolerates the player */
  allied(): boolean;
  /** level gap: positive = creature outclasses the player */
  con(): number;
  engagedByPlayer(): boolean;
  strike(ranged: boolean): void; // one attack on the player
  callPack(radius: number): void;
  log(m: string): void;
  anim(kind: string): void;
  path: Pathfinder;
}

export interface CreatureCtx {
  T: CreatureTemplate;
  W: CreatureWorld;
  u: { pos: { x: number; z: number }; home: { x: number; z: number }; target: { x: number; z: number } | null; run: number; combat: boolean; yaw: number; path?: any };
  g: { hp: number; maxHp: number; name: string; dead?: boolean };
  timer: number;
  cd: number;
  patrol: PatrolQueue | null;
}

const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export const CREATURE_AI: MachineDef<CreatureCtx> = {
  initial: 'spawn',
  any: {
    zeroHealth: 'death',
    attacked: (c) => (c.g.hp > 0 ? 'attack' : 'death'),
  },
  states: {
    spawn: {
      onEnter: (c) => { c.u.target = null; c.u.combat = false; },
      tick: () => 'standing', // finished spawning
    },
    standing: {
      onEnter: (c) => { c.u.target = null; c.u.run = 1; c.timer = rnd(c.T.standMin, c.T.standMax); },
      tick(c, dt) {
        const seen = sense(c);
        if (seen) return seen;
        c.timer -= dt;
        if (c.timer <= 0) return c.T.patrol !== 'none' ? 'patrol' : 'wandering'; // bored with standing
      },
    },
    wandering: {
      onEnter(c) {
        const a = Math.random() * Math.PI * 2, r = 3 + Math.random() * c.T.wanderR;
        c.u.target = { x: c.u.home.x + Math.cos(a) * r, z: c.u.home.z + Math.sin(a) * r };
        c.u.run = c.T.walk / 1.3;
        c.timer = rnd(c.T.wanderMin, c.T.wanderMax);
      },
      tick(c, dt) {
        const seen = sense(c);
        if (seen) return seen;
        c.timer -= dt;
        if (!c.u.target || c.timer <= 0) return 'standing'; // tired of walking / arrived
      },
    },
    patrol: {
      onEnter(c) {
        if (!c.patrol) c.patrol = PatrolQueue.ring(c.u.home, c.T.patrolR, 6);
        c.u.run = c.T.walk / 1.3;
      },
      tick(c, dt) {
        const seen = sense(c);
        if (seen) return seen;
        const p = c.patrol!;
        const step = p.advance(c.u.pos, c.T.walk * dt * 8, c.W.path); // look-ahead target along the path
        if (!step) { c.patrol = null; return 'standing'; } // queue empty: end
        c.u.target = step;
      },
    },
    alert: {
      onEnter: (c) => { c.u.target = null; c.timer = 0; c.W.anim('look'); },
      tick(c, dt) {
        const pp = c.W.playerPos();
        if (!pp || !c.W.playerAlive()) return 'standing'; // no longer interesting
        const d = dist(pp, c.u.pos);
        if (d < aggroRange(c) || c.W.engagedByPlayer()) return 'attack'; // getting attacked / too close
        if (d > c.T.alert * 1.25) return 'standing'; // no longer interesting
        c.u.yaw = Math.atan2(pp.x - c.u.pos.x, -(pp.z - c.u.pos.z)); // still interesting: watch
        c.timer += dt;
        if (c.timer > 12) return 'wandering';
      },
    },
    attack: {
      onEnter(c) {
        c.u.combat = true;
        c.cd = 0.6;
        if (c.T.pack) c.W.callPack(c.T.pack);
        c.W.log(`The ${c.g.name} attacks!`);
      },
      onExit: (c) => { c.u.combat = false; },
      tick(c, dt) {
        const pp = c.W.playerPos();
        if (!pp || !c.W.playerAlive()) return 'return'; // lost target
        if (dist(c.u.pos, c.u.home) > c.T.leash) { c.W.log(`The ${c.g.name} breaks off and returns home.`); return 'return'; }
        if (c.T.flee && c.g.hp < c.g.maxHp * c.T.flee) { c.W.log(`The ${c.g.name} flees!`); return 'flee'; } // low health
        const d = dist(pp, c.u.pos), reach = c.T.ranged || 2.4;
        c.u.run = c.T.slow * 2.3 * (c.T.burst > 1 && (c as any).fsmT < 3 ? c.T.burst : 1);
        c.u.target = d > reach ? { x: pp.x - ((pp.x - c.u.pos.x) / d) * (reach - 0.5), z: pp.z - ((pp.z - c.u.pos.z) / d) * (reach - 0.5) } : null;
        if (!c.u.target) c.u.yaw = Math.atan2(pp.x - c.u.pos.x, -(pp.z - c.u.pos.z));
        c.cd -= dt;
        // the player's own auto-attack loop already trades blows with the creature it has targeted
        if (!c.W.engagedByPlayer() && d <= reach + 0.6 && c.cd <= 0) {
          c.cd = c.T.ranged ? 2.6 : 2.1;
          c.W.strike(!!c.T.ranged); // melee attack / ranged attack
        }
      },
    },
    flee: {
      onEnter: (c) => { c.timer = 0; c.u.run = 2.6; },
      tick(c, dt) {
        c.timer += dt;
        const pp = c.W.playerPos();
        if (!pp || dist(pp, c.u.pos) > 30 || c.timer > 8) return 'return'; // far away
        const dx = c.u.pos.x - pp.x, dz = c.u.pos.z - pp.z, L = Math.hypot(dx, dz) || 1;
        c.u.target = { x: c.u.pos.x + (dx / L) * 8, z: c.u.pos.z + (dz / L) * 8 };
      },
    },
    return: {
      onEnter: (c) => { c.u.run = 2.2; c.u.combat = false; },
      tick(c) {
        c.u.target = { x: c.u.home.x, z: c.u.home.z };
        if (dist(c.u.pos, c.u.home) < 2) { c.g.hp = c.g.maxHp; return 'standing'; } // reset at home
      },
    },
    death: {
      onEnter: (c) => { c.u.target = null; c.u.combat = false; c.timer = c.T.respawn; },
      tick(c, dt) {
        c.timer -= dt;
        if (!c.g.dead && c.g.hp > 0) return 'spawn'; // ready for respawn
      },
    },
  },
};

function aggroRange(c: CreatureCtx) {
  if (c.W.allied() || c.W.con() < -2) return 0;
  return c.T.aggro * (c.W.night() ? c.T.nightAggro : 1);
}
/** standing/wandering/patrol perception: attacked -> attack, in aggro -> attack, in alert radius -> alert */
function sense(c: CreatureCtx): string | undefined {
  if (c.g.hp < c.g.maxHp && c.W.engagedByPlayer()) return 'attack';
  const pp = c.W.playerPos();
  if (!pp || !c.W.playerAlive()) return;
  const d = dist(pp, c.u.pos), ag = aggroRange(c);
  if (ag > 0 && d < ag) return 'attack';
  if (d < c.T.alert && (ag > 0 || c.T.flee >= 1)) return c.T.flee >= 1 && d < c.T.alert * 0.6 ? 'flee' : 'alert';
}

export function createBrain(T: CreatureTemplate, W: CreatureWorld, u: CreatureCtx['u'], g: CreatureCtx['g']) {
  const ctx: CreatureCtx = { T, W, u, g, timer: 0, cd: 0, patrol: null };
  const m = new Machine(CREATURE_AI, ctx);
  Object.defineProperty(ctx, 'fsmT', { get: () => m.t });
  return m;
}
