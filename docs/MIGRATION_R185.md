# Engine migration: three r128 single file → Vite + TypeScript, three r185, Rapier

Source of truth for skills/combat: **CastingAbilitiesThreeJS** (`grudaskill/casting`, casting.grudge.studio).
Fleet stack: `three` 0.185.1 · `@dimforge/rapier3d-compat` 0.19.2 · vanilla three (no R3F) · Vite.

## Layout

| Path | What |
|---|---|
| `index.html` | Markup, CSS and the inline JSON data blocks (skills, professions, resources, races, buildouts, Core3 worlds) |
| `src/main.ts` | Entry: installs the three compat layer, then starts the game runtime |
| `src/three-compat.ts` | three r185 exposed as `window.THREE` with r128 behaviour (see below) |
| `public/legacy/game.js` | The game runtime, still one classic script. Systems move out of it into `src/` phase by phase |
| `public/` | Runtime-loaded assets: `anim.js`, `kit.js`, `toon.js`, `cart.js`, `kits/**`, `ui/**`, `config.js`, `shim.js` |
| `public/kits/store/` | Licensed Unity Asset Store content: git-ignored, copied into builds when present |

Commands: `npm run dev` (http://localhost:5173) · `npm run build` (→ `dist/`) · `npm run typecheck`.
GitHub Pages builds in CI (`.github/workflows/pages.yml`); `dist/` is no longer committed.

## Phase 1 (done): r185 with no gameplay change

`src/three-compat.ts` restores what the r128 code relied on. Verified against the r128 build on the same frame
(Sarrak ground, pinned lights): direct light identical, environment light within 3%.

- **Colour**: `ColorManagement.enabled = false`, renderer `outputColorSpace = LinearSRGBColorSpace` (r128 default LinearEncoding).
- **texture.encoding**: accessor on `Texture.prototype` mapping `sRGBEncoding`/`LinearEncoding` to `colorSpace`.
- **Lights**: r155 removed legacy lighting. Ambient/hemisphere/directional/spot/point keep the legacy number in `_legacyI`
  and hand three `× PI`; point lights default to decay 1. `Light.copy` carries `_legacyI` so clones don't compound.
  Legacy code that does `light.intensity += x` must use `_legacyI` (one place: the storm lightning flash).
- **IBL**: r185 environment lighting is much stronger; `scene.environmentIntensity` and `MeshStandardMaterial.envMapIntensity`
  are scaled by `ENV_LEGACY_SCALE = 0.14`. Lambert/Phong get `reflectivity = 0` because r128 never lit them with `scene.environment`.
- **Addons**: `THREE.GLTFLoader`, `THREE.SkeletonUtils` (a mutable copy, the game wraps `clone`).
- **Code fixes in game.js**: `boneTransform` → `applyBoneTransform`; removed `skinning` / `morphTargets` material flags.

New code must import from `'three'` and must not depend on any of these shims. When a system moves to `src/`, it drops the
legacy units (lights in physical units, colour management on) behind a per-system switch.

## Phase 2 (in testing): physics (Rapier) and the deterministic tick

Shipped in `src/physics/world.ts` and `src/core/tick.ts`, loaded lazily from `src/main.ts` (`?nophysics` turns both off).

- Heightfield from `w.hGrid` (heights transposed to Rapier's column-major rows=z, cols=x), friction 0.9.
- Kit pieces: one oriented cuboid per instance part, streamed in within 520 m and out beyond 760 m of the player
  (about 3,000 colliders around a big city). Zero-scale (hidden) instances and anything non-finite are skipped: a NaN
  reaching Rapier panics inside WASM and poisons the world, after which every call throws "recursive use of an object".
- If that ever happens anyway, physics switches itself off for that planet and the legacy movement takes over.
- Capsule r 0.38 / half-height 0.52, autostep 0.65 m (landing pads), snap 0.45 m, climb 50 deg, slide from 60 deg,
  gravity -24 m/s2, jump 8.2 m/s (about 1.2 m apex) started by the legacy jump clip's wind-up.
- Flying mounts skip building collisions for now. A >30 m jump in one frame is treated as a teleport.
- gameTick runs at a fixed 60 Hz from a real-time accumulator (max 5 steps per frame, stalls drop time) with a seeded
  mulberry32 `Math.random` inside the step. `window.GG_SIM` exposes step, seed, alpha.

Verified: collides with a 9 m building (stops at wall + capsule radius, no overlap), real jump arc, fixed tick advancing.

### Original plan

- `@dimforge/rapier3d-compat` 0.19.2. One world per planet: terrain heightfield from `hGrid`, static cuboids/capsules for
  building pieces, rocks and trees from the instanced kit placements, kinematic capsule character controller (step-up, slopes,
  snap to ground), mounts and vehicles as kinematic bodies.
- Fixed 60 Hz simulation step with an accumulator; render interpolates between the last two states. Max 5 steps per frame;
  a long stall drops time instead of slowing the game (fixes the "slow motion under 20 fps" problem).
- Everything gameplay-relevant (movement, AI, combat timers, cooldowns, projectiles, status ticks) runs in the fixed step
  with a seeded RNG, so a tick is reproducible and can be replayed or sent over the network.

## Terrain port: super-terrain (Mesh Terrain Lab) core on WebGL2 (in progress)

Source: github.com/vibe-stack/super-terrain @ b82e823 (MIT, `src/terrain/LICENSE-super-terrain`), vendored into `src/terrain/`.

- Kept: WorldTerrain, compiler (heightField, TerrainField, compileSection, AdaptiveHeightMesh, material fields, climate),
  workers (pool + protocol), streaming, LOD selector, partition, modifiers (sculpt, CSG, tunnels), mesh, persistence,
  rocks core, water store, section geometry + skirts, far-field mesh. It type-checks against our three r185 with 0 errors.
- Dropped (WebGPU/TSL or app UI): rendering/full, environment, water rendering, post, textures, ThreeTerrainRenderBackend,
  Hi-Z occlusion, scatter rock materials, react/, export/, the 90 MB granite bakes.
- Not loaded by the game yet (tree-shaken out of the build).

Remaining steps:
1. `grudge` world profile in `compiler/heightField.ts`: the planet's macro height (the legacy `rawH` grid, sent to each
   worker once per planet) plus super-terrain's natural detail at reduced amplitude, flattened under building pads.
2. `WebGLTerrainRenderBackend` implementing `TerrainRenderBackend` with the game's PBR/triplanar terrain shader.
3. Planet documents: one IndexedDB document per planet id; game-scale config (16,384 m world, 128 m sections).
4. Legacy `groundH` routed to `WorldTerrain.sampleHeight` so feet, props, NPCs and physics agree with the new surface;
   Rapier heightfields per resident section instead of one coarse planet grid.
5. Forest spline fields and CSG tunnels/caves on top (interiors for temples and castles).

## Phase 3: animation

- Locomotion blend by speed (idle/walk/run) and direction (strafe/back), clip time scaled to ground speed.
- Upper-body layer from the spine up for aim, cast, shoot, harvest while moving.
- Attacks and casts driven by clip events (wind-up, release, impact, recovery) instead of hold timers.
- One clock for every mixer (the fixed step), animation LOD by distance, off-screen pause.

## Phase 4: Gruda skills (from the casting lab)

Skills attach to weapons, not classes: weapon → skill slots → skill definition (cast time, charge, release, projectile or
barrel origin, impact, status/buff payload, VFX, body-effect shader, motion effect, animation phases). Projectiles,
weapon charge, harvesting tools, damage, status and buffs all run inside the deterministic tick. The in-game `COMBAT_FX`
table (`data/combat_fx.json`) becomes the VFX column of that schema.
