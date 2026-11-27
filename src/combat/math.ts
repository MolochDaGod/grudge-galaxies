/**
 * Grudge Galaxies combat math (single source of truth).
 *
 * Inputs: the 8 Grudge attributes (class start + race bonus + level growth + gear), item tier and crafting quality,
 * level difference. Outputs: derived stats for the character sheet and tooltips, and resolved hits.
 * Deterministic: all rolls use Math.random, which the fixed tick (src/core/tick.ts) swaps for the seeded sim stream
 * while gameplay runs, so a replayed input log reproduces every hit, crit, dodge and block.
 *
 *  Attribute -> stat (per point)
 *  Strength   melee power +3, physical armour pen +0.2%
 *  Vitality   health +45
 *  Endurance  health +15, armour +6, block +0.2%, resist +2
 *  Dexterity  ranged power +3, melee power +1, crit +0.4%
 *  Agility    dodge +0.35%, attack speed +0.5%, crit damage +1%
 *  Intellect  spell power +3, mana +12
 *  Wisdom     healing power +3, resist +4, spell power +1, mana +8
 *  Tactics    crit +0.3%, accuracy +0.5%, cooldown recovery +0.3%
 *
 *  Damage = weapon(tier, quality) x (1 + power/100) x ability mult x variance(0.9..1.1)
 *           x crit (1.5 + Agi%) x level factor (+/-6% per level, clamped 0.6..1.4)
 *           x (1 - mitigation), mitigation = armour / (armour + 280 + 22 x attacker level)  (magic uses resist)
 *  Hit roll  miss = max(0, 5% + 2% x (defender level - attacker level) - accuracy)
 *           dodge (melee/ranged only, cap 30%), block (front, shield or End, cap 35%: -60% damage), then crit.
 */

export const ATTRS = ['Strength', 'Vitality', 'Endurance', 'Dexterity', 'Agility', 'Intellect', 'Wisdom', 'Tactics'] as const;
export type Attr = (typeof ATTRS)[number];
export type Attrs = Record<Attr, number>;
export type DamageKind = 'melee' | 'ranged' | 'spell' | 'heal';

/** crafting quality 0..1000 -> named grade (SWG-style), multiplier and perk slots */
export const QUALITY_GRADES = [
  { min: 900, name: 'Masterwork', color: '#ffb347', mult: 1.3, perks: 3 },
  { min: 750, name: 'Exceptional', color: '#c08bff', mult: 1.18, perks: 2 },
  { min: 550, name: 'Superior', color: '#6fb8ff', mult: 1.08, perks: 1 },
  { min: 400, name: 'Good', color: '#7fdc7f', mult: 1.0, perks: 1 },
  { min: 200, name: 'Common', color: '#d8d8d8', mult: 0.9, perks: 0 },
  { min: 0, name: 'Crude', color: '#9a9a9a', mult: 0.78, perks: 0 },
] as const;
export function qualityGrade(q = 400) {
  return QUALITY_GRADES.find((g) => q >= g.min) || QUALITY_GRADES[QUALITY_GRADES.length - 1];
}
/** a recipe (schematic) unlocks for standard use once the crafter can reliably produce at least Good */
export const RECIPE_UNLOCK_QUALITY = 400;

/** perks rolled from crafting quality (deterministic from the item id) */
export const PERKS = [
  { id: 'keen', name: 'Keen', text: '+3% critical chance', apply: (s: Derived) => { s.crit += 0.03; } },
  { id: 'brutal', name: 'Brutal', text: '+15% critical damage', apply: (s: Derived) => { s.critDmg += 0.15; } },
  { id: 'swift', name: 'Swift', text: '+6% attack speed', apply: (s: Derived) => { s.haste += 0.06; } },
  { id: 'warded', name: 'Warded', text: '+8% resist', apply: (s: Derived) => { s.resist *= 1.08; } },
  { id: 'stalwart', name: 'Stalwart', text: '+5% block', apply: (s: Derived) => { s.block += 0.05; } },
  { id: 'vital', name: 'Vital', text: '+6% health', apply: (s: Derived) => { s.maxHp *= 1.06; } },
  { id: 'piercing', name: 'Piercing', text: 'Ignore 10% armour', apply: (s: Derived) => { s.armorPen += 0.1; } },
  { id: 'focused', name: 'Focused', text: '+8% spell and healing power', apply: (s: Derived) => { s.spellPower *= 1.08; s.healPower *= 1.08; } },
] as const;
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
export function itemPerks(item: { id?: string; name?: string; q?: number }) {
  const n = qualityGrade(item.q).perks;
  const out: (typeof PERKS)[number][] = [];
  let h = hash((item.id || '') + (item.name || ''));
  for (let i = 0; i < n; i++) {
    const p = PERKS[h % PERKS.length];
    if (!out.includes(p)) out.push(p);
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0;
  }
  return out;
}

export interface Item {
  id?: string;
  name?: string;
  kind?: string;
  slot?: string;
  tier?: number;
  q?: number;
  gun?: string;
  attrs?: Partial<Attrs>;
}

/** weapon base damage by tier and quality; armour by tier and quality */
export const weaponDamage = (tier = 1, q = 400) => (28 + tier * 22) * qualityGrade(q).mult * (0.85 + q / 2000);
export const armorValue = (tier = 1, q = 400) => (10 + tier * 16) * qualityGrade(q).mult * (0.85 + q / 2000);

export interface Derived {
  level: number;
  attrs: Attrs;
  maxHp: number;
  armor: number;
  resist: number;
  meleePower: number;
  rangedPower: number;
  spellPower: number;
  healPower: number;
  crit: number;
  critDmg: number;
  dodge: number;
  block: number;
  haste: number;
  accuracy: number;
  armorPen: number;
  cdr: number;
  weapon: number;
  kind: DamageKind;
  range: number;
  perks: string[];
}

/** class attribute growth per level (weights of the class start line) */
function growth(start: Partial<Attrs>, level: number): Attrs {
  const tot = ATTRS.reduce((a, k) => a + (start[k] || 0), 0) || 1;
  const out = {} as Attrs;
  for (const k of ATTRS) out[k] = ((start[k] || 0) / tot) * 3 * (level - 1);
  return out;
}

export function derive(o: {
  level: number;
  classStart: Partial<Attrs>;
  raceBonus: Partial<Attrs>;
  cls: string;
  gear: Item[];
  setBonus?: { hp?: number; defense?: number; crit?: number; block?: number };
  skillMods?: Record<string, number>;
}): Derived {
  const g = growth(o.classStart, o.level);
  const a = {} as Attrs;
  // the data's race bonuses are fractions of a point per level band; scale them so a race is felt at every level
  for (const k of ATTRS) a[k] = (o.classStart[k] || 0) * 2 + g[k] + (o.raceBonus[k] || 0) * (4 + o.level * 0.5);
  for (const it of o.gear) for (const k of ATTRS) a[k] += (it.attrs?.[k] || 0) * qualityGrade(it.q).mult;
  const m = o.skillMods || {};
  const weapon = o.gear.find((i) => i.kind === 'weapon');
  const caster = /mage|priest|verduror/.test(o.cls);
  const ranged = /ranger/.test(o.cls) || !!weapon?.gun;
  const kind: DamageKind = caster ? 'spell' : ranged ? 'ranged' : 'melee';
  let armor = a.Endurance * 6 + (o.setBonus?.defense || 0);
  for (const it of o.gear) if (it.kind === 'armor' || /chest|legs|head|hands|feet|shoulder|armou?r/i.test(it.slot || '')) armor += armorValue(it.tier, it.q);
  const s: Derived = {
    level: o.level,
    attrs: a,
    maxHp: 500 + a.Vitality * 45 + a.Endurance * 15 + (o.setBonus?.hp || 0),
    armor: armor * (1 + (m.defense || 0) / 200),
    resist: a.Wisdom * 4 + a.Endurance * 2,
    meleePower: a.Strength * 3 + a.Dexterity,
    rangedPower: a.Dexterity * 3 + a.Agility,
    spellPower: a.Intellect * 3 + a.Wisdom,
    healPower: a.Wisdom * 3 + a.Intellect,
    crit: 0.05 + a.Dexterity * 0.004 + a.Tactics * 0.003 + (o.setBonus?.crit || 0) / 100,
    critDmg: 1.5 + a.Agility * 0.01,
    dodge: Math.min(0.3, a.Agility * 0.0035),
    block: Math.min(0.35, a.Endurance * 0.002 + (o.setBonus?.block || 0) / 100),
    haste: a.Agility * 0.005,
    accuracy: a.Tactics * 0.005,
    armorPen: a.Strength * 0.002,
    cdr: Math.min(0.3, a.Tactics * 0.003),
    weapon: weapon ? weaponDamage(weapon.tier, weapon.q) : weaponDamage(1, 250) * 0.6,
    kind,
    range: kind === 'melee' ? 4.5 : kind === 'ranged' ? 30 : 24,
    perks: [],
  };
  s.maxHp *= 1 + (m.survival || 0) / 200;
  s.meleePower *= 1 + (m.damage || 0) / 250;
  s.rangedPower *= 1 + (m.damage || 0) / 250;
  for (const it of o.gear) for (const p of itemPerks(it)) {
    p.apply(s);
    s.perks.push(p.name);
  }
  s.crit = Math.min(0.6, s.crit);
  s.maxHp = Math.round(s.maxHp);
  return s;
}

export function powerFor(s: Derived, kind: DamageKind) {
  return kind === 'melee' ? s.meleePower : kind === 'ranged' ? s.rangedPower : kind === 'heal' ? s.healPower : s.spellPower;
}

/** an attacker/defender in combat; NPCs are built by npcCombatant() */
export interface Combatant {
  level: number;
  s: Derived;
}

export interface HitResult {
  outcome: 'miss' | 'dodge' | 'block' | 'hit' | 'crit';
  dmg: number;
  raw: number;
  mitigated: number;
  kind: DamageKind;
}

export function resolveHit(att: Combatant, def: Combatant, o: { mult?: number; kind?: DamageKind; flat?: number; front?: boolean; rng?: () => number } = {}): HitResult {
  const r = o.rng || Math.random;
  const kind = o.kind || att.s.kind;
  const ld = att.level - def.level;
  const miss = Math.max(0, 0.05 - 0.02 * ld - att.s.accuracy);
  if (r() < miss) return { outcome: 'miss', dmg: 0, raw: 0, mitigated: 0, kind };
  if (kind !== 'spell' && r() < def.s.dodge) return { outcome: 'dodge', dmg: 0, raw: 0, mitigated: 0, kind };
  let raw = (o.flat ?? att.s.weapon) * (1 + powerFor(att.s, kind) / 100) * (o.mult ?? 1) * (0.9 + r() * 0.2);
  raw *= Math.max(0.6, Math.min(1.4, 1 + 0.06 * ld));
  let outcome: HitResult['outcome'] = 'hit';
  if (r() < att.s.crit) {
    raw *= att.s.critDmg;
    outcome = 'crit';
  }
  const mitigStat = kind === 'spell' ? def.s.resist : def.s.armor * (1 - Math.min(0.6, att.s.armorPen));
  const mit = mitigStat / (mitigStat + 280 + 22 * att.level);
  let dmg = raw * (1 - mit);
  if (outcome !== 'crit' && o.front !== false && kind !== 'spell' && r() < def.s.block) {
    dmg *= 0.4;
    outcome = 'block';
  }
  return { outcome, dmg: Math.max(1, Math.round(dmg)), raw: Math.round(raw), mitigated: Math.round(raw - dmg), kind };
}

export function healAmount(s: Derived, base: number, rng: () => number = Math.random) {
  let h = base * (1 + s.healPower / 120);
  if (rng() < s.crit) h *= 1.5;
  return Math.round(h);
}

/** NPC side: built from Grudge enemy data (hp, damage, tier, cat) */
export function npcCombatant(g: { tier?: number; kind?: string; cat?: string; enemy?: { hp?: number; damage?: number }; boss?: { hp?: number }; maxHp?: number; dmg?: number }): Combatant {
  const tier = g.tier || 1, level = Math.max(1, tier * 5), boss = g.kind === 'boss';
  const beast = /beasts|reptiles|spiders|dragons/.test(g.cat || '');
  const caster = /elementals|undead/.test(g.cat || '');
  const z = { Strength: 0, Vitality: 0, Endurance: 0, Dexterity: 0, Agility: 0, Intellect: 0, Wisdom: 0, Tactics: 0 };
  const s: Derived = {
    level,
    attrs: z,
    maxHp: g.maxHp || 300,
    armor: (beast ? 18 : 30) * tier * (boss ? 2 : 1),
    resist: (caster ? 40 : 14) * tier * (boss ? 1.8 : 1),
    meleePower: tier * 9,
    rangedPower: tier * 7,
    spellPower: tier * 9,
    healPower: 0,
    crit: boss ? 0.12 : 0.06,
    critDmg: 1.5,
    dodge: beast ? 0.08 : 0.04,
    block: beast || caster ? 0 : 0.08,
    haste: 0,
    accuracy: 0.01 * tier,
    armorPen: 0,
    cdr: 0,
    weapon: g.dmg || (g.enemy?.damage || 12) * 1.2,
    kind: caster ? 'spell' : 'melee',
    range: beast ? 4 : 14,
    perks: [],
  };
  return { level, s };
}

/** player combat level from owned skill boxes (legacy combatLevel) */
export const levelFromBoxes = (n: number) => Math.min(90, 1 + Math.floor(n / 1.5));
