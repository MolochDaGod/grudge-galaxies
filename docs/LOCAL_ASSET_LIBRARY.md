# Local asset library: what's usable, what's in the game, what to skip

A survey of `F:\Models-Archives-from-D` (1,384 archives), `F:\GitHub`, `F:\Tools` and `F:\Archives`, done for Grudge Galaxies.
Rule of thumb: **ship only CC0 / CC BY / packs you bought with a commercial licence. Credit CC BY in the game's Credits panel.**

## Now in the game (all CC0 unless noted)

| Pack | Used for |
|---|---|
| Quaternius **Universal Animation Library 2** (Standard) | 38 new clips: sword chains A/B/C + combo, block, dash, shield idle/bash/break/dash, hook, knockback, climb-up, consume, farm harvest / plant / water, tree chop, carry walk, chest open, fold arms, lantern idle, comlink call, rail lean / call, yes / no, lay-to-idle (get up), ninja jump start/air/land, overhand throw, slide start/loop/exit, zombie idle / scratch / walk |
| Quaternius **Ultimate Space Kit** | 11 alien tree species (glowcap, floatbloom, swirlwood, emberpine, spinethorn, coilstalk, blobpalm + variants); xeno brute / wasp / mite and war droid creatures (huntable); habitats, domes, solar, antennae, rovers, parked ships (pack `kits/spacekit.js`) |
| **Sci-fi Turrets** (Quaternius) | SWG installation turrets now rotate between gun cannon, rail gun, plasma, missile and gatling turrets; shield and rail turrets guard starports |
| **Kenney Space Skyboxes** | nebula / galaxy backdrops in the galaxy, system and planet views |
| (earlier) KayKit Character Animations, UAL 1, 100STYLE (CC BY), SOLDMARS Mars kit (CC BY), Sci-fi colony kit | see README |

Previously baked but unused clips are now wired too: kneeling repair while crafting, pick up when skinning, use item / consume
from the action bar, swim / swim idle in deep water, drive for the horse cart.

## Good next picks already on disk (CC0)

- **Sci-Fi Essentials Kit [Standard]** — EyeDrone, QuadShell, Trilobite enemies; pistol/revolver/rifle/sniper guns with PBR textures; crates, lockers, desks, barrels, satellite dish (interior props for cantinas / bunkers).
- **Modular Sci Fi Guns (Nov 2021)** and **Ultimate Gun Pack** — more blaster variety; grenades for the new overhand-throw clip.
- **Ultimate Spaceships (May 2021)**, **LowPoly-Spaceships-By-Majadroid**, **spaceships01/02 (_pbr)**, **spacestations** — space flight / docked ships at starports. Check each licence file before shipping the non-Quaternius ones.
- **Ultimate Modular Sci-Fi (Feb 2021)**, **Modular SciFi MegaKit [Standard]**, **KayKit Space Base Bits** — building interiors and Imperial/Rebel bases.
- **Ultimate Animated Animals**, **Animated Animal Pack**, **Dinosaur Animated Pack**, **Easy Animated Enemy Pack**, **Creature Pack** — more wildlife (rename clips to Idle / Walk / Gallop / Attack / Death, see `tools/spacekit_build.mjs`).
- **Cyberpunk Game Kit**, **Modular Street Pack** — Coronet / Theed / Mos Eisley street dressing.
- **kenney_particle-pack**, **kenney_smoke-particles**, **MuzzleFlashVFX**, **MagicProjectilesVFX**, **PortalVFX** — sprite sheets for the effect pool.
- **complete-sky-system-for-three-js** — day/night sky with sun, moon, clouds, lens flare (check its LICENSE.txt; MIT-style would be fine).
- **Human Soldier / Melee / Crafting / Throwing Animations FREE**, **Fighting Animations**, **Pistol_Handgun Locomotion Pack** — check licences; most are Mixamo-rig FBX (bake with `tools/bake2.html` after adding a `mixamorig` map).

## Tools worth using

- **mesh2motion-app** (F:\GitHub) — browser auto-rigger + animation library; rig a static Meshy/Tripo model, then bake clips with `tools/bake2.html`.
- **UniRig** (F:\Tools) — ML auto-rigging for arbitrary meshes (creatures, mechs).
- **gltf-transform** (already used) — `dedup`, `prune`, `weld`, `quantize`, rename animations; see `tools/spacekit_build.mjs`.
- **three-scatter** (F:\GitHub) — GPU scatter for grass / rocks / flora on terrain.
- **threejs-game-skills** — agent skills/checklists for Three.js games.
- **mixamo_anims_downloader** — bulk-download your own Mixamo account's clips (Mixamo output is fine in your games, not for redistribution as a raw pack).

## Do not ship

Ripped game models (Pokémon, Sonic, Mario, Black Myth: Wukong, Marvel Rivals, Armored Core, Chicken Gun, Persona, Tony Hawk, Spectrobes, Looney Tunes,
Summoners War, Katamari and similar "Platform - Game - Category - Item" archives), anime character rips, and anything without a licence file.
"[Standard]" Quaternius packs are the free CC0 tier; Pro/Source tiers are paid but still CC0.
