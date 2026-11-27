# Buildings, prefabs and colliders: the rules

Nothing that comes into the game is trusted as it arrives. Every model, kit and building is checked by a script that
fails loudly, and the game itself refuses to use a baked result that no longer matches its geometry.

Run before every commit that touches buildings, kits or physics:

```
npm run check            # typecheck + tests (20,800 generated buildings validated)
npm run build
npm run prefabs:verify   # every kit prototype still matches its bake (needs dist/ served on :8796)
```

## 1. Generated buildings (`src/buildings/`)

Town service buildings and houses are generated, not taken from a kit, so they can be walked into.

| File | Does |
| --- | --- |
| `generate.ts` | Seeded layout per building kind and planet style: walls with door gaps, back rooms, floor, ceiling, counters, beds, racks, pews, and slots for vendors, terminals, beds, altars, racks and tables. Pure data, no three.js. |
| `validate.ts` | Builds a walk grid from the solid boxes (grown by the player capsule radius, 0.38 m), floods it from the street in front of the main door, and fails if any door, room or slot cannot be reached. |
| `runtime.ts` | Picks which world placements become generated buildings, levels their floors, adds stairs on slopes, draws them merged per town and material, hands vendors to the NPC system and terminals to the mission system, and keeps the camera inside walls. |
| `__tests__/buildings.test.ts` | Every kind × every planet style × 25 seeds × 8 footprints, plus tests that sabotage a building to prove the validator catches it. |

Rules the validator enforces (change them only in `generate.ts`, where they are named constants):

- doors at least 1.2 m wide and 2.3 m tall, with nothing solid in the opening;
- every room and every interior door reachable on foot from the street;
- every vendor reachable within 3.6 m of a walkable spot (the interact radius is 4.5 m), every terminal within 1.8 m;
- every box finite and inside the footprint; at most 140 colliders per building.

At runtime, a building that fails validation is never placed: the kit model stays there, and the console lists why
(`[buildings] <planet>: N generated, M left to the kit`). Inside a footprint, `groundH` answers the building's floor, so
NPCs, the camera and the player all agree on where the floor is.

**Colliders are the drawn boxes.** `src/physics/world.ts` streams each building's solid boxes in within 520 m of the
player and out beyond 760 m. What you see is what you bump into, and doorways stay open.

To add a building kind or a planet style: add it to `PLANS` or `STYLES` in `generate.ts`, give it a branch in the
interior `switch`, and run `npm test`. The tests pick up new kinds and styles automatically.

## 2. Kit prefabs (`tools/prefab_bake.mjs`)

Kit buildings and props (castles, fortresses, the medieval town, the colony and space kits) used to get one bounding
box per part, so every kit building was a solid block. The bake replaces that with colliders made from the real
triangles:

1. It runs the built game in headless Chromium and reads every prototype from `kitProtoCache`, so it sees exactly the
   geometry, part transforms and units the game uses.
2. Each prototype gets a **UUID** (RFC 4122 v5 of `grudge-galaxies/prefab/<kit key>`, stable across rebakes), a
   **content hash** (`protoHash` in `game.js`, the same function the game checks against), measured bounds, its
   triangle count, and **collider boxes**: triangles sampled into a voxel shell, merged greedily into boxes (at most 96).
3. It reports whether each prototype is open (outside air reaches inside, so you could enter it) or a sealed shell.

Output: `public/prefabs/kit-colliders.json` (used by the game) and `docs/PREFAB_REPORT.md` (for people).

At runtime, physics uses a prototype's baked boxes only if the bake's hash equals the hash of the geometry the game
just loaded. A changed or unbaked prototype falls back to bounding boxes and is listed in `GG_PREFABS.stats` (`stale`
or `fallback`) with a console warning. Nothing silently uses a wrong bake.

`npm run prefabs:verify` fails if any prototype is new, changed, missing a bake, or baked but gone.

## 3. Asset intake

Every new model goes through these checks before it enters a kit:

1. **Licence from the file itself** (`asset.extras.license` in the glTF) and from its source page. The game's own
   packs often have this metadata stripped, so record the source in the pack's header comment.
2. **CC0 / CC BY**: ship with a credit in the game's Credits panel. **CC BY-ND**: ship unmodified only (no
   decimation, recolouring or splitting); baked colliders are separate data and are fine. **Sketchfab Standard**,
   Asset Store and other paid licences: never in the public repo; they go in `public/kits/store/` (git-ignored) and
   are shipped only in builds.
3. **Units are measured**, not assumed: Sketchfab exports from FBX are often in centimetres (100× too big). Measure the
   world-space bounds with every node transform applied and compare them with what the thing should be.
4. **Budget**: under 50k triangles for a prop or building, 20k for an NPC, textures at most 1024² (2048² for heroes);
   larger sources are decimated and compressed (meshopt + KTX2) before they are packed.
5. **Bake and verify**: add it to a kit, `npm run build`, `npm run prefabs:bake`, commit the JSON, and
   `npm run prefabs:verify` passes.

### Intake, 2026-11-27

| Model | Licence (from file) | Measured | Verdict | Use |
| --- | --- | --- | --- | --- |
| Free Pack – Sci Fi Weapon (PolyOne Studio) | CC BY 4.0 | 7.2k tris; centimetres (row of 6 weapons 2.39 m) | Ship, credit | Armoury rack and counter displays; loot chest |
| Noob Experiment Laser (average c-pen enjoyer) | CC BY 4.0 | 10.7k tris; centimetres (1.82 m long) | Ship, credit | Turret or heavy weapon on armoury displays |
| Theia Prime B (ADITYA 3D) | CC BY 4.0 | 9.3k tris; 4.26 × 2.0 m; 1 animation (arms) | Ship, credit | Animated terminal or machine console |
| Flesh Eating Alien Plant (XanderPriest281) | CC BY 4.0 | 9.8k tris, skinned; 4.9 m; Attack, Idle, Panic, Move | Ship, credit | Omen creature for Rhosmire and Vashtar |
| Hollow Bloom – Alien Plant (Varvara) | CC BY 4.0 | 10.5k tris; centimetres (2.1 m) | Ship, credit | Temple and hospital decor; alien flora |
| Flesh Blob (ChopperManiac) | CC BY 4.0 | 21.7k tris; 6.4 m; morph animation; 17 MB of textures | Ship after texture compression | Omen growths at struggle sites |
| Post-Apocalyptic Tricycle (Jungle Jim) | CC BY 4.0 | 53k tris; 2.2 × 3.3 m; 37 textures, 35 MB | Ship after decimation and texture atlas | Vehicle vendor stock |
| BCRUZ (yasosay) | CC BY 4.0 | 3.08M tris, 196 MB, 1.95 × 2.18 km industrial complex | Not at runtime as is; needs heavy decimation | Reference or source for the Eldi Foundry interior |
| bcruz_1.glb | — | byte-identical to bcruz.glb | Duplicate | — |
| Robot (harrikisan5577) | **Sketchfab Standard** | 32k tris, skinned, walk/run/idle | **Store only** (`public/kits/store/`), never committed | Machine-faction NPC |

### Kit licence audit, 2026-11-27

Read from the glTF metadata inside every pack in `public/kits/`:

- `town.js` (Medieval town by katydid) is **Sketchfab Standard** and is committed to the public repo. It should move
  to `public/kits/store/` and leave the repo; removing it from git history is a separate decision for the owner.
- `fortress.js`, `props.js` and `pond.js` are **CC BY-ND 4.0**: ship them unmodified.
- `castle.js`, `ancient.js` and `rocks.js` are CC BY 4.0: credit them.
- 94 model blobs in 12 packs carry no licence metadata: animals, colony, guns, guns2, mars, nature, nodes, qtrees, spacekit, trees, vehicles and whale.
  `vehicles.js` says Quaternius and Majadroid CC0 in its header; the rest need their source written into their header.
