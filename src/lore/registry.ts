/**
 * Lore site registry: the canonical list of points of interest, what they mean, and the priors that lead players to them.
 *
 * Three powers shape every site: the Omni (the source of all, now a voice without power), the Omen (the stolen source,
 * turned into collective minds) and the Ancient Machines (the looms the Omni used to divide itself into the Eldi).
 *
 * The game reads this from window.GG_LORE when it builds each world:
 *  - RENAMES fix map names left over from the old setting and the raw names the data files carry.
 *  - DROP and TOWNS clear placeholder entries ("City at x, z", raw CRC ids) and name the real clusters behind them.
 *  - SITES are the lore sites. A site either attaches to a place already on the map (`at`) or stands at its own
 *    coordinates (`x`, `z`). Reaching a site's heart counts toward the hidden ascension (30 sites).
 *  - Priors: every thread (a site, story or raid) has five clues carried by ordinary missions, three on other planets
 *    and two on its own. Hand-written clues override the generated ones.
 */

export type LoreType = 'race' | 'culture' | 'event' | 'gods' | 'power' | 'struggle' | 'machine';
export type Lean = 'omni' | 'omen' | 'machine' | 'none';
export type Build = 'machine' | 'temple' | 'entrance' | 'stone';
/** mission kinds the game generates */
export type MissionKind = 'destroy' | 'survey' | 'explore' | 'hunt' | 'entertain';

export interface LoreSite {
  key: string;
  world: string;
  name: string;
  type: LoreType;
  lean: Lean;
  /** attach to the map place with this name (after renames) */
  at?: string;
  x?: number;
  z?: number;
  /** heart radius in metres: the player must come this close */
  r?: number;
  /** biome or region words used by the clue generator */
  region: string;
  /** one line read on discovery: it asks a question */
  line: string;
  /** codex entry */
  codex: string;
  /** resource or reward that is easier to get here */
  reward: string;
  /** what the near clue says opens the way, if anything */
  way?: string;
  /** an object or symbol tied to the site, for the third far echo */
  symbol?: string;
  build?: Build;
  /** sites that only count after something else (temple entrances, the Foundry) */
  parent?: string;
  hidden?: boolean;
  /** discovered by an event (falling into the Foundry), not by walking up to it */
  trigger?: 'event';
  /** hand-written priors, slots 1–5 */
  clues?: [string, string, string, string, string];
}

export interface Prior {
  thread: string;
  slot: 1 | 2 | 3 | 4 | 5;
  world: string;
  kinds: MissionKind[];
  clue: string;
}

export const PLANET: Record<string, string> = {
  tatooine: 'Sarrak', naboo: 'Veylara', corellia: 'Coraxis', talus: 'Talvern', rori: 'Rhosmire', dantooine: 'Dawnreach',
  lok: 'Scoria', yavin4: 'Verdance IV', endor: 'Eldermoon', dathomir: 'Crimsona', kashyyyk: 'Vashtar', mustafar: 'Pyraxis',
  hoth: 'Rimehold',
};

export const RENAMES: Record<string, Record<string, string>> = {
  tatooine: {
    "Bargo's Palace": "Silk Baron's Palace", 'Sandhauler NE': 'Dune Crawler Hulk', 'Sandhauler Debris': 'Dune Crawler Wreckage',
    'Burning Bone Alter': 'Burning Bone Altar', 'Elegent Tent': 'Elegant Tent', 'Pile O Rocks': 'The Cairn',
    'Single Platform Messed Up Walls': 'The Broken Dais', 'Single Platform With Messed Up Pillars': 'Leaning Pillar Dais',
    'Single Platform': 'Lone Dais', 'Single Platform With Two Arches On Top': 'Twin Arch Dais',
    'Single Platform With One Tall Archway': 'Tall Arch Dais', 'Three Short Archways Lined Up In a Row': 'Three Arch Way',
    'Strange Arches Lined Up': 'The Arch Road', 'Two Grand Archways': 'Grand Archways', 'Single Grand Archway': 'Grand Archway',
    '4 Pillars Connected At Top': 'Four Pillar Gate', 'Bowling Rocks': 'Rolling Stones', 'Hidden Starfighter': 'Hidden Fighter',
    'Single Desert Household With Courtyard': 'Courtyard Homestead', 'Two Desert Housings': 'Twin Homesteads',
    'Large Rock With Camp': 'Rock Camp', 'Destroyed Aircraft Hanger': 'Ruined Hangar', 'Cave Central': 'Central Caves',
    'Cave West': 'West Caves', 'Cave Southwest': 'Southwest Caves', 'Strange Brick': 'The Odd Brick',
  },
  naboo: { "the Queen's Sandy Beach": 'Moonsand Strand', 'Theran Falls Bottom': 'Theran Falls' },
  rori: { Mudlfats: 'Mudflats' },
  lok: { Volcano: 'The Ember Throat' },
  mustafar: { 'Jedi Wall': 'Wall of the First Oath', 'Mockup Factory Machine': 'The Rusted Engine', 'Camp Tent': "Ash Walkers' Camp" },
  hoth: { 'Wampa Troll camp': 'Rime Troll camp', 'Ion Cannon Crater': 'Shattered Lance Crater', 'Echo Ridge': 'Whisper Ridge' },
};

/** map entries that are not places at all */
export const DROP: RegExp[] = [/^Crc:/i, /^Item Container/i, /^Mockup Factory Machine \d+$/i];

/** placeholder "City at x, z" clusters: the largest ones get these names, the rest are dropped (merge: fold all into the first) */
export const TOWNS: Record<string, { names: string[]; merge?: boolean }> = {
  kashyyyk: { names: ['Rootfall Hollow'], merge: true },
  mustafar: { names: ['Cinderhold', 'Slagwatch'] },
};

const MACHINE_CODEX =
  'The Ancient Machines are not weapons, tombs or hills. They are the looms the Omni used to part itself: each one took a piece of the All and forced it to merge with a machine core, and what came out walked away as the first Eldi.';

export const SITES: LoreSite[] = [
  /* ---------- the five Ancient Machines (their Hearts count) ---------- */
  {
    key: 'machine-drowned-hand', world: 'kashyyyk', name: 'The Drowned Hand', type: 'machine', lean: 'machine', x: -5200, z: 4300, r: 40,
    region: 'the sea cove off the Kachiro Coast', build: 'machine', reward: 'Shellsteel',
    line: 'Five knuckles rise with the tide. What was the hand reaching for?',
    codex: MACHINE_CODEX + ' The Drowned Hand wove the forest peoples. At low tide its palm opens for six minutes.',
    way: 'go in through the palm at low tide, before the cove floods again', symbol: 'a shell-grey knuckle bone that rings like metal',
    clues: [
      'A deckhand swears a cove on Vashtar has fingers, and the fingers move.',
      'Smugglers who anchored off the Kachiro Coast came back with metal growing in their hull barnacles.',
      'This shellsteel ingot was not smelted. It was grown, and it is warm.',
      'Wait for low tide in the cove west of the Kachiro Coast; five white knuckles will show.',
      'The palm opens when the water leaves it. You have six minutes before the sea comes back.',
    ],
  },
  {
    key: 'machine-sleeper', world: 'mustafar', name: 'The Sleeper Under Glass', type: 'machine', lean: 'machine', x: 4300, z: -4700, r: 40,
    region: 'the Obsidian Shelf', build: 'machine', reward: 'Glassheart ore',
    line: 'Something under the glass is breathing. Is it asleep, or waiting?',
    codex: MACHINE_CODEX + ' The Sleeper lies under the Obsidian Shelf; its ribs glow through the black glass and the heat vents are its breath.',
    way: 'take the lava tube that cools for one hour at dusk', symbol: 'a shard of obsidian with an orange rib inside it',
    clues: [
      "Madra's priests forbid walking on the Shelf. They say it bruises.",
      'A bounty target hid on Pyraxis under black glass and came back speaking a language no one has heard.',
      'Glassheart ore: a jeweller says it beats once a minute if you hold it long enough.',
      'On the Obsidian Shelf, follow the vents that rise and fall together. They are one set of lungs.',
      'At dusk a lava tube on the Shelf goes dark and cool for an hour. That is the way down.',
    ],
  },
  {
    key: 'machine-frozen-choir', world: 'hoth', name: 'The Frozen Choir', type: 'machine', lean: 'machine', x: -4100, z: -3900, r: 40,
    region: 'the Frost Caves', build: 'machine', reward: 'Singing ice',
    line: 'The ice hums one chord. Who taught a glacier to sing?',
    codex: MACHINE_CODEX + ' The Frozen Choir is a face 110 m tall inside a glacier. The caves around it hum the chord it was singing when the ice took it.',
    way: 'follow the hum through the deepest Frost Cave', symbol: 'a sliver of ice that keeps ringing after it is struck',
    clues: [
      'Musicians pay well for ice from Rimehold. It stays in tune.',
      'A hunter lost in the Frost Caves says a face watched him through the wall for three days.',
      'This singing ice was cut from a glacier, and it still holds a single note.',
      'The Frost Caves hum. Go where the hum is loudest and the ice turns clear.',
      'At the bottom of the deepest cave, sing the chord back. The ice will open its throat.',
    ],
  },
  {
    key: 'machine-kneeling-giant', world: 'lok', name: 'The Kneeling Giant', type: 'machine', lean: 'machine', x: 3600, z: 2800, r: 40,
    region: 'the Canyonlands', build: 'machine', reward: 'Kinetic quartz',
    line: 'A cliff with a shoulder and a bent knee. What is it kneeling to?',
    codex: MACHINE_CODEX + ' The Kneeling Giant is a canyon wall on Scoria with one hand flat on the canyon floor. The first lava-born were carved inside its shoulder.',
    way: 'climb the forearm to the seam behind the elbow', symbol: 'a quartz crystal that pushes back when you squeeze it',
    clues: [
      'Canyon guides on Scoria will not camp under one cliff. They say it shifts its weight at night.',
      'A corsair crew used a canyon wall for cover and found the rock had a pulse.',
      'Kinetic quartz: it stores every blow you give it and returns one, later.',
      'In the Canyonlands, look for a cliff with a knee. Its hand lies flat on the floor.',
      'Climb the arm. Behind the elbow there is a seam that is not a crack.',
    ],
  },
  {
    key: 'machine-barrow-hills', world: 'talus', name: 'The Barrow Hills', type: 'machine', lean: 'machine', x: -2600, z: 3400, r: 40,
    region: 'the Talvern Grasslands', build: 'machine', reward: 'Loamcore',
    line: 'Hills in a perfect line, and the fences on them hum. What is under the field?',
    codex: MACHINE_CODEX + ' The Barrow Hills are the back of a Machine 200 m long. Farmers have ploughed it for generations.',
    way: 'go down the sinkhole that opened in the farmer’s field', symbol: 'a lump of soil with a metal vein that hums at night',
    clues: [
      'Talvern grain grows twice as fast on one ridge. The farmers will not say why.',
      'A fence-mender on Talvern was paid to stop the fences humming. He could not.',
      'Loamcore: soil that heals cuts in leather and wood. It came from a ridge on Talvern.',
      'In the Talvern Grasslands, find the hills that run in a straight line, like vertebrae.',
      "A sinkhole opened in a farmer's field on the ridge. He has roped it off. Go in anyway.",
    ],
  },

  /* ---------- the two temples: tip, three entrances, Foundry (raids 11 and 12) ---------- */
  {
    key: 'gods-temple', world: 'rori', name: 'The Gods Temple', type: 'gods', lean: 'machine', x: 5200, z: -3600, r: 30,
    region: 'the Rhosmire rainforest', build: 'temple', reward: 'Living resin',
    line: 'Only the capstone shows. How deep does a living pyramid go?',
    codex: 'The Gods Temple is the mytho-organic nexus where the Omni began its Parting. It is guarded by a machine core, because each temple is guarded by the other’s nature.',
    way: 'look for three ways in on the visible faces', symbol: 'a pyramid seed that grows roots when it is wet',
    clues: [
      'Every Machine Heart points the same way, toward the world furthest from Crimsona.',
      'A botanist found vines on Rhosmire that grow in right angles.',
      'This pyramid seed sprouts roots shaped like a temple.',
      'Deep in the Rhosmire rainforest a stone point rises out of the canopy floor. It is warm.',
      'The tip has three hidden doors: one opens at dawn, one to a master’s tool, one to a Heart relic.',
    ],
  },
  { key: 'gods-temple-dawn', world: 'rori', name: 'Dawn Seam (Gods Temple)', type: 'gods', lean: 'machine', parent: 'gods-temple', hidden: true, x: 5214, z: -3600, r: 5, region: 'the Gods Temple', build: 'entrance', reward: 'Living resin', line: 'The seam opens at first light. Who set the hour?', codex: 'One of the three hidden doors of the Gods Temple.' },
  { key: 'gods-temple-maker', world: 'rori', name: "Maker's Panel (Gods Temple)", type: 'gods', lean: 'machine', parent: 'gods-temple', hidden: true, x: 5193, z: -3588, r: 5, region: 'the Gods Temple', build: 'entrance', reward: 'Living resin', line: 'The panel waits for a master’s tool. Whose hands made it?', codex: 'One of the three hidden doors of the Gods Temple.' },
  { key: 'gods-temple-heart', world: 'rori', name: 'Heart Slot (Gods Temple)', type: 'gods', lean: 'machine', parent: 'gods-temple', hidden: true, x: 5193, z: -3612, r: 5, region: 'the Gods Temple', build: 'entrance', reward: 'Living resin', line: 'A slot shaped like a Heart relic. Which Machine did it come from?', codex: 'One of the three hidden doors of the Gods Temple.' },
  { key: 'gods-foundry', world: 'rori', name: 'Eldi Foundry (Gods Temple)', type: 'machine', lean: 'machine', parent: 'gods-temple', hidden: true, trigger: 'event', x: 5200, z: -3600, r: 30, region: 'beneath the Gods Temple', reward: 'Eldi alloy', line: 'This is where the I became a we.', codex: 'Under the Gods Temple: vats and lines that merged pieces of the Omni with machine cores. The Omni’s voice tells the Parting here.' },
  {
    key: 'powers-temple', world: 'dathomir', name: 'The Powers Temple', type: 'power', lean: 'machine', x: -4800, z: 3900, r: 30,
    region: 'the Singing Mountains', build: 'temple', reward: 'Core glass',
    line: 'The mountains sing through vents in a metal capstone. What are they singing to?',
    codex: 'The Powers Temple is the machine-core nexus at the far end of the Parting. It is guarded by an organic monster grown into the core.',
    way: 'look for three ways in on the visible faces', symbol: 'a red-black metal chip that hums in a minor key',
    clues: [
      'Every Machine Heart points the same way, toward the world furthest from Rhosmire.',
      'The Duskwitches say the Singing Mountains were silent until something under them woke.',
      'This red-black metal hums in a minor key, the same as the Singing Mountains.',
      'In the Singing Mountains, a metal point stands among the peaks. The singing comes from its vents.',
      'The capstone has three hidden doors: one opens at dawn, one to a master’s tool, one to a Heart relic.',
    ],
  },
  { key: 'powers-temple-dawn', world: 'dathomir', name: 'Dawn Seam (Powers Temple)', type: 'power', lean: 'machine', parent: 'powers-temple', hidden: true, x: -4786, z: 3900, r: 5, region: 'the Powers Temple', build: 'entrance', reward: 'Core glass', line: 'The seam opens at first light. Who set the hour?', codex: 'One of the three hidden doors of the Powers Temple.' },
  { key: 'powers-temple-maker', world: 'dathomir', name: "Maker's Panel (Powers Temple)", type: 'power', lean: 'machine', parent: 'powers-temple', hidden: true, x: -4807, z: 3912, r: 5, region: 'the Powers Temple', build: 'entrance', reward: 'Core glass', line: 'The panel waits for a master’s tool. Whose hands made it?', codex: 'One of the three hidden doors of the Powers Temple.' },
  { key: 'powers-temple-heart', world: 'dathomir', name: 'Heart Slot (Powers Temple)', type: 'power', lean: 'machine', parent: 'powers-temple', hidden: true, x: -4807, z: 3888, r: 5, region: 'the Powers Temple', build: 'entrance', reward: 'Core glass', line: 'A slot shaped like a Heart relic. Which Machine did it come from?', codex: 'One of the three hidden doors of the Powers Temple.' },
  { key: 'powers-foundry', world: 'dathomir', name: 'Eldi Foundry (Powers Temple)', type: 'machine', lean: 'machine', parent: 'powers-temple', hidden: true, trigger: 'event', x: -4800, z: 3900, r: 30, region: 'beneath the Powers Temple', reward: 'Eldi alloy', line: 'This is where the I became a we.', codex: 'Under the Powers Temple: the second Foundry, where the last pieces of the Omni were parted.' },

  /* ---------- Vashtar (no real places before this pass) ---------- */
  { key: 'vashtar-root', world: 'kashyyyk', name: 'The Root', type: 'race', lean: 'omen', x: 3200, z: -2600, r: 35, region: 'the Wroshyr Forest', build: 'stone', reward: 'Heartwood', line: 'The first tree is older than the elves. Did it plant them?', codex: 'Where the elves woke. The raid beneath it, The Root, opens after The Silent Canopy.', symbol: 'a heartwood ring with more rings than years' },
  { key: 'vashtar-swallowed-city', world: 'kashyyyk', name: 'The Swallowed City', type: 'event', lean: 'omen', x: 1800, z: 2400, r: 35, region: 'the Wroshyr Forest', build: 'stone', reward: 'Old-city salvage', line: 'A forest grew over a city in one season. Why is the city still lit?', codex: 'The start of The Silent Canopy. The city is still inside the trees.', symbol: 'a street lamp grown through with bark' },
  { key: 'vashtar-tidelight', world: 'kashyyyk', name: 'Tidelight Shrine', type: 'gods', lean: 'omni', x: -3900, z: 1600, r: 30, region: 'the Kachiro Coast', build: 'stone', reward: 'Tidepearl', line: 'Pilgrims leave lamps for the Omni at the waterline. Who lights them again?', codex: 'An Omni shrine whose lamps relight themselves at high tide.' },
  { key: 'vashtar-hollow-bough', world: 'kashyyyk', name: 'The Hollow Bough', type: 'culture', lean: 'none', x: -1500, z: -3300, r: 30, region: 'the Wroshyr Forest', build: 'stone', reward: 'Carved bough schematic', line: 'The wood-carvers never cut a living tree. How do they build?', codex: 'A carvers’ village that grows its houses. They teach a furniture schematic found nowhere else.' },
  { key: 'vashtar-shadow-pit', world: 'kashyyyk', name: 'The Shadowlands Pit', type: 'struggle', lean: 'omen', x: 4800, z: 4100, r: 35, region: 'the Shadowlands', build: 'stone', reward: 'Webbed salvage', line: 'Trappers go down for pelts and come up older. What lives in the dark?', codex: 'A hunting ground the Omen of Fear has claimed.' },
  { key: 'vashtar-spore-glade', world: 'kashyyyk', name: 'Spore Choir Glade', type: 'power', lean: 'omni', x: -600, z: 5600, r: 30, region: 'the Shadowlands', build: 'stone', reward: 'Choir spores', line: 'The spores rise in time with your heartbeat. Whose heartbeat were they keeping before?', codex: 'A place where the world is thin. Crafting with spores gathered here gains quality.' },

  /* ---------- Pyraxis ---------- */
  { key: 'pyraxis-caldera', world: 'mustafar', name: 'Caldera of Madra', type: 'gods', lean: 'omen', x: 600, z: 5200, r: 40, region: 'the Ash Mountains', build: 'stone', reward: 'Forge ash', line: 'Madra’s forge is still burning. What is she making?', codex: 'Madra’s seat at the heart of Pyraxis, and the way into the raid of the same name.' },
  { key: 'pyraxis-tithe-stones', world: 'mustafar', name: 'The Tithe Stones', type: 'culture', lean: 'omen', x: -3400, z: 3600, r: 30, region: 'the Lava Plains', build: 'stone', reward: 'Memory glass', line: 'The priests pay memories into the lava. Who collects them?', codex: 'The start of The Ashen Tithe.' },
  { key: 'pyraxis-slag-choir', world: 'mustafar', name: 'The Slag Choir', type: 'power', lean: 'machine', x: 5600, z: 600, r: 30, region: 'the Lava Plains', build: 'stone', reward: 'Choir slag', line: 'Cooling slag rings in chords. Is it the Sleeper dreaming?', codex: 'Slag here cools into tuned bars. The Sleeper Under Glass is not far.' },
  { key: 'pyraxis-ashborn', world: 'mustafar', name: 'Cradle of the Ashborn', type: 'race', lean: 'none', x: -5600, z: -2400, r: 35, region: 'the Ash Mountains', build: 'stone', reward: 'Ashborn sigil', line: 'A people born from cooling rock. Who poured them?', codex: 'Where the Ashborn say they first stood up out of the lava.' },
  { key: 'pyraxis-glass-graves', world: 'mustafar', name: 'The Glass Graves', type: 'event', lean: 'omen', x: -1200, z: -5400, r: 30, region: 'the Obsidian Shelf', build: 'stone', reward: 'Grave glass', line: 'An army stands in the glass, mid-stride. Who were they marching on?', codex: 'A battle the lava ended in a single afternoon.' },
  { key: 'pyraxis-oath-wall', world: 'mustafar', name: 'Wall of the First Oath', type: 'event', lean: 'omni', at: 'Wall of the First Oath', r: 30, region: 'the Ash Mountains', reward: 'Oath fragment', line: 'Half an oath is carved here. Where is the other half?', codex: 'One of the two places the oath of the First Grudge was carved.' },
  { key: 'pyraxis-rusted-engine', world: 'mustafar', name: 'The Rusted Engine', type: 'machine', lean: 'machine', at: 'The Rusted Engine', region: 'the Lava Plains', reward: 'Machine scrap', line: 'Someone tried to copy a Machine. Did it work?', codex: 'A factory engine built by people who had seen the Machines and tried to make their own.' },

  /* ---------- existing places: story starts, raid sites and the strongest lore places ---------- */
  { key: 'sarrak-wyrm-graveyard', world: 'tatooine', name: 'Wyrm Graveyard', type: 'event', lean: 'none', at: 'Wyrm Graveyard', region: 'the Dune Sea', reward: 'Wyrm bone', line: 'The writing is carved from the inside out. Who was inside?', codex: 'The start of The Archivist of Bone, and the way into the Wyrm Graveyard Depths.' },
  { key: 'sarrak-great-maw-pit', world: 'tatooine', name: 'Great Maw Pit', type: 'power', lean: 'omen', at: 'Great Maw Pit', region: 'the Jundland Wastes', reward: 'Maw salts', line: 'A smaller Maw, on the wrong planet. Are the two connected?', codex: 'A pit like Crimsona’s Great Maw. Things thrown in here have come out there.' },
  { key: 'sarrak-druid-circle', world: 'tatooine', name: 'Stone Druid Circle', type: 'gods', lean: 'omni', at: 'Stone Druid Circle', region: 'the Jundland Wastes', reward: 'Circle stone', line: 'The stones face the two furthest worlds. Who measured the sky?', codex: 'A circle aligned with Rhosmire and Crimsona, built long before anyone could have known where they were.' },
  { key: 'sarrak-bone-altar', world: 'tatooine', name: 'Burning Bone Altar', type: 'gods', lean: 'omen', at: 'Burning Bone Altar', region: 'the Dune Sea', reward: 'Altar ash', line: 'The bones never burn down. What feeds the fire?', codex: 'An Omen of Death altar. The fire burns on what people are afraid to lose.' },
  { key: 'sarrak-arch-road', world: 'tatooine', name: 'The Arch Road', type: 'culture', lean: 'none', at: 'The Arch Road', region: 'the Jundland Wastes', reward: 'Arch keystone', line: 'Arches in a line across the desert. Where did the road go?', codex: 'One of the arch and dais ruins that cross Sarrak: the Arch Road, the Grand Archways and the daises all belonged to one road.' },
  { key: 'sarrak-arch-mesa', world: 'tatooine', name: 'Arch Mesa', type: 'power', lean: 'none', at: 'Arch Mesa', region: 'the Jundland Wastes', reward: 'Mesa crystal', line: 'Wind through the arch makes a word. Which word?', codex: 'A place of power. Crafting here gains quality.' },
  { key: 'sarrak-sand-wyrm', world: 'tatooine', name: 'Ancient Sand Wyrm Skeleton', type: 'event', lean: 'none', at: 'Ancient Sand Wyrm Skeleton', region: 'the Dune Sea', reward: 'Wyrm bone', line: 'This wyrm died facing the Graveyard. Was it going home?', codex: 'A lone wyrm, far from the others.' },
  { key: 'veylara-theran-falls', world: 'naboo', name: 'Theran Falls', type: 'power', lean: 'omni', at: 'Theran Falls', region: 'the Lake Country', reward: 'Upfall water', line: 'The spray falls upward. Toward what?', codex: 'The start of The Upward Falls.' },
  { key: 'veylara-gorran-temple', world: 'naboo', name: 'Gorran Temple', type: 'gods', lean: 'omni', at: 'Gorran Temple', region: 'the Gorran Swamps', reward: 'Choir reed', line: 'Something under the swamp is singing the Omni’s names. Who taught it?', codex: 'The way into the Gorran Sunken Temple.' },
  { key: 'coraxis-crownhaven', world: 'corellia', name: 'Crownhaven', type: 'struggle', lean: 'none', at: 'Crownhaven', region: 'the Coastal Hills', reward: 'Old crown silver', line: 'The city’s first war is sealed beneath it. Who sealed it?', codex: 'The way into the Crownhaven Undervault.' },
  { key: 'coraxis-brightvale', world: 'corellia', name: 'Brightvale', type: 'culture', lean: 'omni', at: 'Brightvale', region: 'the Farmlands', reward: 'Psalm crystal', line: 'One crystal field sings a warning. Of what?', codex: 'The start of Glass Psalm.' },
  { key: 'talvern-durvin', world: 'talus', name: 'Lost Village of Durvin', type: 'event', lean: 'omen', at: 'Lost Village of Durvin', region: 'the Talvern Hills', reward: 'Durvin keepsake', line: 'A whole village walked into the hills in one night. What called them?', codex: 'The start of The Hollow Crown. The Barrow Hills are the same direction.' },
  { key: 'talvern-aquari', world: 'talus', name: 'Aquari Cave', type: 'power', lean: 'omen', at: 'Aquari Cave', region: 'the Talvern Hills', reward: 'Tide salt', line: 'The sea once came this far inland. Why did it leave?', codex: 'The way into the Aquari Drowned Halls.' },
  { key: 'rhosmire-kobra', world: 'rori', name: 'Kobra Ore Mine', type: 'struggle', lean: 'omen', at: 'Kobra Ore Mine', region: 'the Rhosmire Swamplands', reward: 'Whisper ore', line: 'The ore whispers names. Whose?', codex: 'The start of Whisper Ore.' },
  { key: 'dawnreach-warden', world: 'dantooine', name: 'Warden Temple', type: 'gods', lean: 'omni', at: 'Warden Temple', region: 'the Warden Enclave Valley', reward: 'Seam shard', line: 'The temple sits on a seam where two shards of the world touch. Which side is ours?', codex: 'The start of The Mended Shard.' },
  { key: 'dawnreach-dunari', world: 'dantooine', name: 'Dunari Village', type: 'culture', lean: 'none', at: 'Dunari Village', region: 'the Dawnreach Steppe', reward: 'Dunari weave', line: 'The Dunari weave a pattern no one alive can read. Who can?', codex: 'A village that keeps an Eldi pattern in its cloth.' },
  { key: 'scoria-kragmaw', world: 'lok', name: 'Kragmaw Skeleton', type: 'race', lean: 'omen', at: 'Kragmaw Skeleton', region: 'the Canyonlands', reward: 'Kragmaw bone', line: 'Miners who sleep here share one dream. Whose dream is it?', codex: 'Where the orcs say they began, and the start of Bones That Dream.' },
  { key: 'verdance-elder-temple', world: 'yavin4', name: 'Great Elder Temple', type: 'gods', lean: 'omni', at: 'Great Elder Temple', region: 'the Temple Highlands', reward: 'Elder light', line: 'The light has burned for an age without fuel. What is it burning?', codex: 'The start of The Last Light of Verdance, and the way into the raid.' },
  { key: 'verdance-fallen-lord', world: 'yavin4', name: 'Temple of the Fallen Lord', type: 'gods', lean: 'omen', at: 'Temple of the Fallen Lord', region: 'the Elder Jungle', reward: 'Refusal crown shard', line: 'A lord who refused every patron is still refusing. Refusing what?', codex: 'The start of The Fallen Lord.' },
  { key: 'eldermoon-furrow-tree', world: 'endor', name: 'Furrow Village Tree', type: 'culture', lean: 'omni', at: 'Furrow Village Tree', region: 'the Great Forest', reward: 'Lantern sap', line: 'One of the Omni’s names has gone silent. Who stopped singing it?', codex: 'The start of The Lantern Choir.' },
  { key: 'eldermoon-yawen', world: 'endor', name: 'Yawen Cliffs', type: 'struggle', lean: 'none', at: 'Yawen Cliffs', region: 'the Lake Highlands', reward: 'Cliff eggs', line: 'Every clan claims the cliffs. Why does no one hold them?', codex: 'A contested cliff line.' },
  { key: 'crimsona-great-maw', world: 'dathomir', name: 'Great Maw', type: 'power', lean: 'omen', at: 'Great Maw', region: 'the Red Forest', reward: 'Maw salts', line: 'The Maw swallows, and answers. What did you give it?', codex: 'The start of The Red Witness, and the way into the raid.' },
  { key: 'crimsona-prison', world: 'dathomir', name: 'Legion Prison', type: 'struggle', lean: 'none', at: 'Legion Prison', region: 'the Singing Mountains', reward: 'Prison keys', line: 'The prisoners sing the mountains’ song back. Who taught them?', codex: 'A Legion prison under the Singing Mountains.' },
  { key: 'rimehold-frosthold', world: 'hoth', name: 'Frosthold Base', type: 'culture', lean: 'omni', at: 'Frosthold Base', region: 'the Ice Plains', reward: 'Quench steel', line: 'The forge recorded the First Grudge in its steam. Who is letting it cool?', codex: 'The start of The Forge That Remembers.' },
  { key: 'rimehold-whisper-ridge', world: 'hoth', name: 'Whisper Ridge', type: 'power', lean: 'machine', at: 'Whisper Ridge', region: 'the Glacier Peaks', reward: 'Singing ice', line: 'The ridge whispers the same chord as the caves. Are they one voice?', codex: 'You can hear the Frozen Choir from here.' },
];

/* ---------- priors ---------- */

const ALL_WORLDS = Object.keys(PLANET);
const SLOT_KINDS: Record<1 | 2 | 3 | 4 | 5, MissionKind[]> = {
  1: ['entertain', 'explore'],
  2: ['destroy', 'hunt'],
  3: ['survey'],
  4: ['survey', 'explore', 'hunt'],
  5: ['destroy', 'explore'],
};

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** three different far planets for a thread, never its own */
export function farWorlds(site: LoreSite): string[] {
  const others = ALL_WORLDS.filter((w) => w !== site.world);
  const out: string[] = [];
  let h = hash(site.key);
  while (out.length < 3) {
    const w = others[h % others.length];
    if (!out.includes(w)) out.push(w);
    h = hash(String(h));
  }
  return out;
}

const TYPE_WORD: Record<LoreType, string> = {
  race: 'the place a people first woke', culture: 'a people who keep an old custom', event: 'something the galaxy still argues about',
  gods: 'a seat of the gods', power: 'a place where the world is thin', struggle: 'a place that is still being fought over',
  machine: 'one of the Ancient Machines',
};

function generatedClues(s: LoreSite): [string, string, string, string, string] {
  const p = PLANET[s.world];
  return [
    `A traveller from ${p} keeps saying one name: ${s.name}.`,
    `They say ${s.name} on ${p} is ${TYPE_WORD[s.type]}.`,
    `This came from ${s.name}: ${s.symbol || s.reward.toLowerCase() + ', and it is not like any other'}.`,
    `${s.name} is in ${s.region}. Look for it there.`,
    s.way ? `To reach the heart of ${s.name}, ${s.way}.` : `The heart of ${s.name} is marked. Walk right up to it, not just to its edge.`,
  ];
}

/** every thread's five priors: slots 1–3 on three other planets, 4–5 on its own */
export function priorsFor(site: LoreSite): Prior[] {
  const far = farWorlds(site);
  const c = site.clues || generatedClues(site);
  return ([1, 2, 3, 4, 5] as const).map((slot) => ({
    thread: site.key,
    slot,
    world: slot <= 3 ? far[slot - 1] : site.world,
    kinds: SLOT_KINDS[slot],
    clue: c[slot - 1],
  }));
}

/** threads are the sites that count, not the entrances or the Foundry (they are found inside their temple) */
export const THREADS = SITES.filter((s) => !s.parent);
export const PRIORS: Prior[] = THREADS.flatMap(priorsFor);

const LORE = { PLANET, RENAMES, DROP, TOWNS, SITES, THREADS, PRIORS, priorsFor, farWorlds };
(window as unknown as { GG_LORE: typeof LORE }).GG_LORE = LORE;
export default LORE;
