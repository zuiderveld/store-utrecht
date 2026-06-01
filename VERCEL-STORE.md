# Store deploy (apart van main website)

De **store** heeft **geen** `discord-status.js`. Die fout hoort bij het **main website**-project.

## Twee aparte Vercel-projecten

| Project | Map | Domein |
|---------|-----|--------|
| Main website | `utrecht-roleplay-main` | www.utrechtroleplay.eu |
| **Store** | **`utrecht-store`** | **store.utrechtroleplay.eu** |

Deploy je de verkeerde map → krijg je fouten over `discord-status` (main site).

## Store op Vercel

1. **New Project** (of bestaand store-project)
2. Root Directory: **`utrecht-store`** (of alleen deze map uploaden)
3. **Niet** `utrecht-roleplay-main`
4. Geen cron / geen discord-status

## Upload (zonder node_modules)

~35 bestanden, o.a.:

- `index.html`, `admin.html`
- `package.json`, `package-lock.json`
- `vercel.json`
- `api/router.js` (enige API-entry)
- `server/lib/`
- `assets/`, `js/`, `scripts/`

**Niet:** `node_modules`, `fivem-resources`

## Env vars (store-project)

- `DISCORD_CLIENT_SECRET` (zelfde als staff)
- `DISCORD_BOT_TOKEN`
- `DISCORD_GUILD_ID`
- `BLOB_READ_WRITE_TOKEN`
- `STORE_BRIDGE_API_KEY`

## Test

`https://store.utrechtroleplay.eu/api/health` → `{"ok":true,"store":true}`
