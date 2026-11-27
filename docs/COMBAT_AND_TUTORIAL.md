# Combat math, terrain colliders, NPC navigation, openers and tutorial

## Combat math (`src/combat/math.ts`, exposed as `window.GG_COMBAT`)

One module resolves every hit in the game: auto-attacks, abilities (including charged ones), hunting, enemy hits,
heals, tooltips and the character sheet. All rolls use `Math.random`, which the fixed 60 Hz tick swaps for the seeded
simulation stream, so combat is deterministic and replayable.

**Attributes.** class start x 2 + class growth (3 points per level, split by the class's start line)
+ race bonus x (4 + level / 2) + gear attribute lines x quality multiplier.

| Attribute | Gives (per point) |
|---|---|
| Strength | melee power +3, armour penetration +0.2% |
| Vitality | health +45 |
| Endurance | health +15, armour +6, block +0.2%, resist +2 |
| Dexterity | ranged power +3, melee power +1, crit +0.4% |
| Agility | dodge +0.35% (cap 30%), attack speed +0.5%, crit damage +1% |
| Intellect | spell power +3 |
| Wisdom | healing power +3, resist +4, spell power +1 |
| Tactics | crit +0.3%, accuracy +0.5%, cooldown recovery +0.3% (cap 30%) |

**Damage.** `weapon(tier, quality) x (1 + power/100) x ability mult x variance 0.9-1.1 x level factor (6%/level, 0.6-1.4)
x crit (1.5 + Agility%) x (1 - mitigation)`, mitigation = `armour / (armour + 280 + 22 x attacker level)`
(spells use resist). Hit roll: miss `5% + 2%/level below - accuracy`, then dodge (not vs spells), then crit, then block
(front, non-crit, non-spell: -60%). Weapon damage `(28 + 22 x tier) x grade mult x (0.85 + q/2000)`;
armour `(10 + 16 x tier) x grade mult x (0.85 + q/2000)`.

**Quality grades and perks** (crafting quality 0-1000): Crude < 200, Common, **Good >= 400** (1 perk), Superior >= 550,
Exceptional >= 750 (2 perks), Masterwork >= 900 (3 perks). Perks are rolled deterministically from the item id:
Keen, Brutal, Swift, Warded, Stalwart, Vital, Piercing, Focused. `RECIPE_UNLOCK_QUALITY = 400`: a schematic counts as
learned for standard use once the crafter can make it at Good.

**NPCs** are built from Grudge enemy data: level = tier x 5, armour/resist/dodge/block by category (beasts dodge,
humanoids block, elementals and undead resist magic), bosses doubled.

## Terrain colliders and NPC navigation (`src/physics/world.ts`)

- Buildings and kit pieces: oriented boxes, streamed within 520 m.
- Trees: capsules from the planet tree grid, scaled by species size (giant forests are solid), within 140 m.
- Talus boulders: balls; mesa pillars: cylinders.
- NPC corrections: after every AI step, a creature that walked into a collider is put back and given an A* detour on a
  1.5 m grid (64 x 64 cells, no corner cutting) toward its goal; after 3 s stuck it drops the goal.

## Openers and tutorial (`src/tutorial/`)

New characters (no tutorial record, under 60 XP) see three cards: race (homeland, hook, trait, oath), class (role, duty,
signature) and their first day (mentor and starting weapon). 6 races x 8 classes = 48 combinations, all original text.

Steps: walk 20 m, look around, target the training dummy, hit it 3 times, use a class ability (skipped when the
starting profession has none), defeat it (about nine hits for that character), equip the Good-quality class weapon
you are handed, open the survey device, open the mission board. Completion: +1,500 credits, +250 combat XP, the weapon
becomes Superior (quality 600, one perk) and `CH.tutorial = { done, at, race, cls }` is saved. Skip any time; replay
from the Menu window. `?notutorial` in the address disables it.

## Scriptable patterns (`src/script/`)

Modelled on the SWGEmu Core3 design: object templates, the creature state graph and patrol queues.

- `templates.ts`: `registerObjectType(type, TemplateClass)` (Core3 `ObjectManager::registerObjectTypes`), `defineTemplate(id,
  { templateType, extends, ...fields })` (Core3 `ObjectTemplates:addTemplate` + Lua `:new {}` inheritance, nested objects
  merge one level), `getTemplate(id)` runs the class's `readObject` once, `instantiate(id, target)` runs `loadTemplateData`.
- `fsm.ts`: data-driven state machine: states with `onEnter / tick / onExit / on{event}`, machine-wide `any` events,
  `describe()` prints the graph.
- `ai/creature.ts`: the Core3 creature graph (spawn, standing, wandering, patrol, alert, attack, flee, return, death,
  respawn) driven by `creature` templates per category (`object/creature/beasts` ...) and variants
  (`object/creature/variant/sentinel`, `prey`). A placement picks one with `g.ai` or `g.aiTemplate`.
- `ai/patrol.ts`: the Core3 patrol flowchart (queue -> path -> walk by creature speed / cell change -> interpolate).
- `runtime.ts`: every hostile creature gets a brain; the legacy aiTick skips them. `window.GG_SCRIPT` lists templates,
  the graph and live state counts.
