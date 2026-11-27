/**
 * Script runtime: attaches a scripted brain (src/script/ai/creature.ts) to every hostile creature the game streams in.
 * The legacy aiTick skips creatures that have a brain; movement still runs through the legacy mover (which the physics
 * module corrects around buildings), so the brain only decides where to go, how fast, and when to strike.
 *
 * A placement can choose its behaviour with data: p.g.ai = 'sentinel' | 'prey' | <any template id under
 * object/creature/variant/>, or a full template id in p.g.aiTemplate.
 */
import { bridge } from '../bridge';
import { createBrain, templateFor, type CreatureWorld } from './ai/creature';
import { getTemplate, hasTemplate, listTemplates } from './templates';
import { CREATURE_AI } from './ai/creature';

export async function installScripts() {
  const B = await bridge();
  let brains = 0;
  const world = (c: any, p: any): CreatureWorld => ({
    playerPos: () => (B.CH && B.groundMode === 'play' && B.level === 'ground' && !B.rts?.on ? { x: B.play.x, z: B.play.z } : null),
    playerAlive: () => !!B.CH && B.CH.hp > 0,
    night: () => B.fn.isNight(),
    allied: () => { const f = B.fn.creatureFaction(p.g.cat); return !!f && B.fn.standing(f) >= 750; },
    con: () => (p.g.tier || 1) - Math.ceil(B.fn.combatLevel() / 11),
    engagedByPlayer: () => B.combat.p === p,
    strike: () => { B.fn.npcStrike(p, c.userData); },
    callPack: (r) => B.fn.npcCallPack(c, p, r),
    log: (m) => B.fn.mmLog(m, 'combat'),
    anim: (k) => { const o = c.userData.toonObj; if (o) B.fn.toonOneShot(o, k === 'look' ? 'lookAround' : k); },
    path: (from, to) => {
      const P = (window as any).GG_PHYSICS?.planet;
      if (P && P.worldRef === B.groundWorld) return P.findPath(from.x, from.z, to.x, to.z) || [to];
      return [to];
    },
  });

  B.wrap('thinkCreature', (orig) => function (this: unknown, c: any, dt: number, w: any) {
    const u = c.userData, p = u.p;
    if (p && p.g && p.g.kind !== 'friendly' && !p.g.dummy && !u.brain && u.pos && u.home) {
      try {
        const T = p.g.aiTemplate && hasTemplate(p.g.aiTemplate) ? getTemplate(p.g.aiTemplate) as any : templateFor(p.g.cat, p.g.ai);
        if (!p.g.maxHp) { p.g.maxHp = p.g.hp = 300; }
        u.brain = createBrain(T, world(c, p), u, p.g);
        u.brainHp = p.g.hp;
        brains++;
      } catch (e) {
        console.warn('[script] brain', e);
      }
    }
    const br = u.brain;
    if (br) {
      try {
        if (p.dead || p.g.hp <= 0) br.send('zeroHealth');
        else if (p.g.hp < u.brainHp) br.send('attacked');
        u.brainHp = p.g.hp;
        br.tick(dt);
        u.aiHold = true; // the legacy idle-wander must not pick targets for scripted creatures
      } catch (e) {
        console.warn('[script] brain tick', e);
        u.brain = null;
      }
    }
    return orig.call(this, c, dt, w);
  });

  (window as any).GG_SCRIPT = {
    get brains() { return brains; },
    templates: (prefix = '') => listTemplates(prefix),
    template: (id: string) => getTemplate(id),
    graph: () => Object.entries(CREATURE_AI.states).map(([k, s]) => k + ': ' + Object.keys(s.on || {}).join(', ')).concat(Object.keys(CREATURE_AI.any || {}).map((e) => '* ' + e)),
    states() {
      const out: Record<string, number> = {};
      for (const o of (B.npcToons as Map<number, any>).values()) { const b = o.userData.brain; if (b) out[b.state] = (out[b.state] || 0) + 1; }
      return out;
    },
  };
}
