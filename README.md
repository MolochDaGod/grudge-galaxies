# Grudge Galaxies — Cloudflare + Railway deploy

```
dist/      static game for Cloudflare Pages (ready to upload)
server/    Node backend for Railway: character saves + live multiplayer
```

## 1. Backend on Railway (do this first, you need its URL)

```bash
cd server
railway login
railway init                 # new project, e.g. "grudge-galaxies"
railway add --database postgres
railway up                   # deploys server.js
railway domain               # prints https://<name>.up.railway.app
```

Railway sets `DATABASE_URL` for the Postgres plugin automatically; link it to the service
(Variables → Add reference → `DATABASE_URL`). Then set:

| Variable | Value |
|---|---|
| `CORS_ORIGIN` | your site, e.g. `https://grudge-galaxies.pages.dev,https://galaxies.grudge-studio.com` |

Check `https://<name>.up.railway.app/health` → `{"ok":true,...,"storage":"postgres"}`.

Without `DATABASE_URL` the server keeps saves in `saves.json` (fine for testing, wiped on redeploy).

## 2. Frontend on Cloudflare Pages

Edit `dist/config.js`:

```js
window.GRUDGE_BACKEND = 'https://<name>.up.railway.app';
```

Then:

```bash
npx wrangler login
npx wrangler pages deploy dist --project-name grudge-galaxies
```

Add a custom domain in the Pages dashboard if you want (e.g. `galaxies.grudge-studio.com`) and include it in `CORS_ORIGIN`.

Optional auto-deploy: push this folder to GitHub, add repo secrets `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID`; `.github/workflows/deploy-frontend.yml` redeploys `dist/` on every push.
Railway can watch the same repo (root directory `server`).

## What runs where

| Feature | On claude.ai | Standalone |
|---|---|---|
| Character saves | artifact database | Railway Postgres (`docs` table), per anonymous player token |
| Multiplayer presence, chat, emotes | artifact room | Railway WebSocket `/ws` |
| Export / import save file | artifact downloads | browser download |
| 3D, assets, CDN libraries | same | same (three.js r128 from cdnjs/jsdelivr) |

Players are anonymous: the browser keeps a random token in localStorage and the server stores only
its SHA-256, so clearing site data means a new player. Hook `server.js` → `uidOf()` to your Grudge
auth (Discord / Puter) later to make saves follow an account.
