# Grudge Galaxies

A sandbox MMO in the browser: 22 planets with their own biomes, towns, NPC routines, missions, crafting, hunting, mounts and live multiplayer. From Grudge Studio.

```
dist/      the game itself, a static site for Cloudflare Pages (no build step)
server/    Node backend for Railway: character saves and the multiplayer lobby
web/       files copied into dist/ by build.sh (config, runtime shim, headers, icon)
```

The game runs without the backend too: leave `dist/config.js` empty and characters are saved in the
player's browser, with no multiplayer.

## 1. Backend on Railway

1. Railway → **New Project → Deploy from GitHub repo** → pick this repo.
2. In the service's **Settings**, set **Root Directory** to `server`. Railway reads `server/railway.json`
   (start command `node server.js`, health check `/health`).
3. **+ New → Database → PostgreSQL**. In the game service's **Variables**, add a reference to `DATABASE_URL`.
4. Add the variable `CORS_ORIGIN` = your site address(es), comma separated, e.g.
   `https://grudge-galaxies.pages.dev,https://galaxies.grudge-studio.com`.
5. **Settings → Networking → Generate Domain**. Open `https://<name>.up.railway.app/health`; you should see
   `{"ok":true,"players":0,"storage":"postgres"}`.

Without `DATABASE_URL` the server keeps saves in `saves.json`, which is wiped on every redeploy (fine for testing only).

## 2. Frontend on Cloudflare Pages

1. Put the Railway address in `dist/config.js`:
   ```js
   window.GRUDGE_BACKEND = 'https://<name>.up.railway.app';
   ```
   and commit it.
2. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git** → pick this repo.
   - Framework preset: **None**
   - Build command: *(leave empty)*
   - Build output directory: `dist`
3. Every push to `main` redeploys. Add a custom domain under the project's **Custom domains** tab and
   add it to `CORS_ORIGIN` on Railway.

**Alternative (GitHub Actions):** add repo secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, and
`.github/workflows/deploy-frontend.yml` runs `wrangler pages deploy dist` on each push. Without the secrets
that step is skipped, so use one method or the other. The workflow also syntax-checks the server.

**Alternative (CLI):** `npx wrangler pages deploy dist --project-name grudge-galaxies`.

## What the backend does

| Endpoint | Purpose |
|---|---|
| `GET /health` | status, players online, storage type |
| `GET /api/me` | the player's anonymous id (SHA-256 of a random browser token) |
| `GET/PUT/DELETE /api/docs?path=data/users/<id>/chars&id=<char>` | character saves; a player can only touch their own folder |
| `WS /ws` | lobby: presence 4×/s (positions only for players on the same planet), chat and emotes |

Limits: 256 KB per save, 64 saves per folder, 20 writes per 10 s per player, 40 socket messages per second,
chat lines up to 240 characters. Dead sockets are dropped after 30 s without a pong.

## Updating the game

`dist/index.html` is the game. Edit it directly, or rebuild from the artifact sources with
`SRC=/path/to/sources bash build.sh` (keeps whatever backend address is already in `dist/config.js`).

Open the site with `?debug` in the address to expose `window.__gg(expr)` for automated checks; it does
nothing otherwise.

## Playtesting

Two ways to put the game in front of testers:

- **claude.ai artifact (multiplayer + cloud saves built in):** share the artifact link. Testers sign in to claude.ai and play;
  chat, emotes, presence and saves work with no server. Bug reports (F8) are stored in the artifact's database.
- **GitHub Pages (static, no account needed):** `.github/workflows/pages.yml` publishes `dist/` to
  `https://molochdagod.github.io/grudge-galaxies/` on every push. One-time setup: repo **Settings → Pages → Source: GitHub Actions**.
  Without a backend address in `dist/config.js` it runs single-player with saves in the browser; add the Railway URL
  (section 1) for multiplayer and accounts.

In the playtest build: **F8** files a report (screenshot, planet, position, animation state, frame rate, GPU stats, last
errors; saved to the feedback store or downloaded as JSON), **F3** toggles the performance overlay, and first-time players get
a "what to test" card (Menu → Playtest to reopen). A crash inside one system is logged and no longer freezes the frame loop.

## Changes in this update

- **Playtest build:** F8 bug reports with screenshot and state, F3 performance overlay, welcome card with controls and test
  goals, crash-proof frame loop, GitHub Pages workflow.
- **PBR pass for the cartoon assets** (Medium and High quality; Low keeps the old flat look): KayKit / Quaternius kit pieces,
  colony and Mars buildings, toon characters and NPCs, mounts, wildlife, xeno creatures and guns now use physically based
  materials with a roughened world-space grunge layer (roughness breakup, grit and scratch micro-bump, large grime and
  colour drift) and a per-planet sky/ground environment map for reflections, dimmed at night. Sci-fi pieces are a bit
  metallic, guns more so; characters only get light wear so skin and cloth stay clean.
- **Local asset library pass** (see `docs/LOCAL_ASSET_LIBRARY.md`): the best CC0 packs from the studio archive are in.
- **38 Universal Animation Library 2 clips** (Quaternius, CC0), baked with a new UE-mannequin map in `tools/bake2.html`.
  Warriors chain sword swings and shield bashes, thieves hook, raiders combo; heavy hits can knock you back.
  Townsfolk fold their arms, take comlink calls, nod, shake heads and lean on rails; guards carry lanterns and torches at
  night; farmers harvest and water; undead NPCs slump and claw. New emotes `/yes /no /foldarms /comlink /lean /eat /getup /chop /harvest`.
- **Actions finally animated:** kneel and dig while sampling, tinker while crafting, pick up when skinning, eat or inject from
  the action bar, get up after cloning, swim in deep water, drive the horse cart.
- **Ultimate Space Kit + Sci-fi Turrets** (Quaternius, CC0): alien trees on Dathomir, Lok, Mustafar and the jungles and swamps;
  xeno brutes, wasps and mites and stray war droids as huntable wildlife; SWG turrets now vary between five turret models;
  starports get parked ships, a rover and two defence turrets.
- **Space backdrops:** Kenney space skyboxes (CC0) behind the galaxy, system and planet views.

## Earlier changes

- **100STYLE locomotion** (Mason, Starke & Komura 2022, CC BY 4.0, credited in the in-game menu): 71 clips.
  Neutral walk and run in 8 directions (diagonals blended from straight loops, phase-matched on foot contact) when
  the camera is locked; 27 walk + idle styles. Townsfolk pick styles by role (guards march, priests walk like monks,
  nobles keep hands behind their backs, merchants in pockets, undead shamble like zombies). Players: `/walk <style>`.
  Converter: `tools/bake_bvh.html` (finds straight stretches, cuts seamless loops, removes heading).
- **Mars environment kit** (SOLDMARS, CC BY 4.0): the Sketchfab diorama was merged by material, so it is split back
  into 48 pieces (rocket and launch pad, habitats, dish, hangar, turrets, shuttle pads, rovers, tanks, crystal trees,
  rock formations). Starports and shuttleports use them; SWG turrets, dishes, tank farms and speeders map to them.

- **Guns:** Blaster Pistol, Blaster Carbine, Assault Blaster and Long Rifle (sci-fi models from the Grudge ObjectStore)
  are main-hand weapons sold at markets and craftable at the engineering bench. They attach to the right hand
  socket and switch combat to ranged: aim stance in a fight, shoot / full-auto, magazines and reloads, rifle run,
  run-strafe, muzzle flash and tracers. Works on NPC targets and when hunting.
- **45 new animation clips** baked from KayKit Rig_Medium (ranged combat, advanced movement, general) and the
  Quaternius Universal Animation Library (pistol, roll, swim, drive, punches, interact, repair...).
  See `docs/ANIMATION_PIPELINE.md`, including which free mocap / text-to-motion tools are safe to ship.
- **Ability effects:** one GPU particle pool using the effect-definition presets (auras, impacts, lightning, fire
  sheet, ice, buffs, projectiles) plus flat rune and ring decals: casts, bolts, impacts, heals, buff auras, debuffs, kills.
- **Starports:** the sci-fi colony kit (runway strip, terminal, reactor, solar field, gateway, drone carrier, tower)
  and a berthed cruiser overhead replace the medieval stand-ins; SWG factories, generators, farms and harvesters
  use colony buildings too. The kit's textures were missing in R2, so it uses a procedural plated-hull material.
- **Grudge ID sign-in** (deployed site with a backend): menu → Account → Sign in with Grudge ID. The server checks
  the token at id.grudge-studio.com and keeps saves per account; guest characters move into the account once.
  Optional `GRUDGE_ID_URL` variable on Railway (defaults to https://id.grudge-studio.com).

- **Sectors, not realms:** the nine realm worlds are gone from the galaxy map. The 3x3 layout is now an invisible
  sector split of every planet (about 5.5 km a side) that the server uses for interest: players get full positions
  only from their own and bordering sectors on the same planet. Characters saved on a realm move to Tatooine.
- **Waypoints and planet map:** Shift+M (or the map button) opens the planet map with towns, roads, travel points,
  a coordinate grid and your position. Click to drop a waypoint, click a town or port to mark it, right-click to delete,
  wheel to zoom, drag to pan. Each character keeps up to 40 named, coloured waypoints across planets. Active ones show
  a light beam in the world, a framed marker with distance on screen (pinned to the screen edge with an arrow when
  off-screen), a compass tick and a minimap diamond. Routes and "find trainer" drop an orange navigation waypoint
  that clears when you arrive.
- **Performance:** building kits are split into 640 m map cells and only cells near and in front of the camera
  are drawn (Tatooine went from about 5.5 million to 1.3 million triangles per frame). Draw distance follows the
  Low / Medium / High quality setting.
- **Hunting:** wild animals (not farm stock or town dogs) can be hunted with auto-attack or any damage ability.
  Prey bolt when hit, predators and their pack fight back, and kills give meat, hide and bone from the planet's
  SWG creature resources plus combat and scouting XP.
- **Characters:** switching characters while playing now saves the old character in place; before, the new
  character inherited the old one's planet and position.
- **Saves:** a character saved in the browser while the server was unreachable is merged back (newest copy wins)
  and uploaded once the server is back.
- **Animation:** new emotes `/point /flex /strut /look /cheer /spin`, `/wave` uses a real clip, and heavy hits
  stagger the player.
- **Offline / reconnect:** an empty or placeholder backend address means offline play instead of a broken load;
  the multiplayer socket reconnects with backoff (2 s up to 60 s).
- **Server:** planet-scoped presence, write limits, heartbeat, graceful shutdown.
- **Site:** title, description, favicon, cache headers that let updates show up immediately.
