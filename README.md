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

## Changes in this update

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
