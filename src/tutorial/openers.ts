/**
 * Openers: the first minute of every race x class (6 x 8 = 48 combinations). Race supplies the homeland, faction
 * voice and hook; class supplies the duty, the weapon you are handed and how the tutorial asks you to fight.
 * All text is original to Grudge Galaxies.
 */
export interface RaceOpener {
  home: string;
  hook: string;
  oath: string;
  mentor: string;
}
export interface ClassOpener {
  role: string;
  duty: string;
  weapon: { name: string; type: string; gun?: string };
  attackVerb: string;
  attackHint: string;
  abilityHint: string;
}

export const RACE_OPENERS: Record<string, RaceOpener> = {
  human: {
    home: 'the river forts of the Crusade',
    hook: 'Humans have no great gift but the one that matters: they adapt faster than the galaxy can kill them.',
    oath: 'Hold the line, learn the land, and never stop moving.',
    mentor: 'Sergeant Hale',
  },
  barbarian: {
    home: 'the burning steppe clans who march under the Crusade banner',
    hook: 'Your people settle grudges with iron and settle debts with blood. The Crusade pays well for both.',
    oath: 'Break what stands against you. Carry home what is left.',
    mentor: 'Warchief Brannoc',
  },
  elf: {
    home: 'the moonlit groves of the Fabled',
    hook: 'The Fabled remember the first sky. They sent you to see what has become of it.',
    oath: 'Strike precisely, waste nothing, and leave no trail but the one you choose.',
    mentor: 'Warden Sylaine',
  },
  dwarf: {
    home: 'the deep halls the Fabled carved under the mountains',
    hook: 'Stone does not lie, and neither do dwarves. Every ore vein on these worlds is a promise to keep.',
    oath: 'Dig deep, build true, and stand where others fall.',
    mentor: 'Forgemaster Durra',
  },
  orc: {
    home: 'the war camps of the Legion',
    hook: 'The Legion took you in when the world spat you out. Now it wants to see what you are worth.',
    oath: 'Strength is earned in the open. Prove yours.',
    mentor: 'Overseer Grukash',
  },
  undead: {
    home: 'the silent ossuaries of the Legion',
    hook: 'You died once. It did not take. The Legion has uses for those who refuse to stay buried.',
    oath: 'Endure everything. Forget nothing. Feel nothing you do not choose to.',
    mentor: 'Lady Vesper',
  },
};

export const CLASS_OPENERS: Record<string, ClassOpener> = {
  warrior: {
    role: 'front-line fighter in plate, shield and steel',
    duty: 'Your company needs a shield wall. Today that wall is you.',
    weapon: { name: 'Recruit Longsword', type: 'swords' },
    attackVerb: 'Strike',
    attackHint: 'Close the distance and swing: auto-attack keeps hitting while you stay in reach.',
    abilityHint: 'Heavy blows cost Action. Spend it on Power Strike when the target is open.',
  },
  raider: {
    role: 'two-handed reaver who trades safety for ruin',
    duty: 'Raiders lead the charge and clean up what is left. Show them the charge.',
    weapon: { name: 'Raider Greataxe', type: 'greataxes' },
    attackVerb: 'Cleave',
    attackHint: 'Big swings, slow recovery. Stay close and let every hit land.',
    abilityHint: 'Your signature attack hits hardest when you charge it: hold the key, release at full.',
  },
  mage: {
    role: 'spellcaster who bends fire, frost and lightning',
    duty: 'The academy sends you to the front with one lesson: the enemy cannot hit what it cannot reach.',
    weapon: { name: 'Apprentice Fire Staff', type: 'fireStaves' },
    attackVerb: 'Blast',
    attackHint: 'Stay at range. Your bolts home in on the target you have selected.',
    abilityHint: 'Hold a signature spell to charge it: a full charge launches a bigger volley.',
  },
  priest: {
    role: 'healer and holy caster who keeps the line standing',
    duty: 'Wounded soldiers are a lost battle. Keep them standing, and smite what threatens them.',
    weapon: { name: 'Acolyte Holy Staff', type: 'holyStaves' },
    attackVerb: 'Smite',
    attackHint: 'Holy bolts arc to the target. Keep an eye on your own health between casts.',
    abilityHint: 'Heal Damage scales with your Wisdom. Use it before you need it.',
  },
  ranger: {
    role: 'marksman and tracker at home in the wilds',
    duty: 'Scouts see the enemy first. Rangers make sure the enemy never sees them at all.',
    weapon: { name: 'Hunter Longbow', type: 'bows' },
    attackVerb: 'Shoot',
    attackHint: 'Keep distance. Dexterity drives your damage and your critical hits.',
    abilityHint: 'Aimed shots charge: hold the key, wait for the bar to fill, release.',
  },
  thief: {
    role: 'quick blade who wins fights before they start',
    duty: 'Every army needs someone to do the work no one admits to. That is you.',
    weapon: { name: 'Twin Knives', type: 'daggers' },
    attackVerb: 'Cut',
    attackHint: 'Fast, light hits. Agility makes you harder to hit and your criticals deadlier.',
    abilityHint: 'Strike, step away, strike again. Dodges are your armour.',
  },
  worge: {
    role: 'shapeshifter who fights as beast and as caster',
    duty: 'The pack chose you. Now the war chooses you too. Learn which shape each fight needs.',
    weapon: { name: 'Pack Spear', type: 'spears' },
    attackVerb: 'Maul',
    attackHint: 'You fight well up close or from a few strides off. Read the target and pick.',
    abilityHint: 'Your signature form makes you a brawler. Save it for the hard fights.',
  },
  verduror: {
    role: 'grove keeper who turns roots and thorns into weapons',
    duty: 'The land is wounded wherever this war walks. The grove sends you to mend it, and to punish it.',
    weapon: { name: 'Grove Staff', type: 'natureStaves' },
    attackVerb: 'Lash',
    attackHint: 'Thorn darts arc to your target. Wisdom fuels both your harm and your healing.',
    abilityHint: 'Thorn volleys spread wide; use them when enemies bunch up.',
  },
};

export function openerFor(race: string, cls: string) {
  const r = RACE_OPENERS[race] || RACE_OPENERS.human;
  const c = CLASS_OPENERS[cls] || CLASS_OPENERS.warrior;
  return { r, c };
}
