# Deploy utrecht-store (apart Vercel-project)

## 1. Vercel

- **Add New Project** → map `utrecht-store` (eigen GitHub-repo: `utrecht-store`)
- Root Directory: leeg
- Install: `npm install`
- Build: `node scripts/vercel-prep.js` (staat in `vercel.json`)
- Output: `.`

**Belangrijk:** upload/deploy altijd met **`package.json`** + **`package-lock.json`** in de root (niet alleen HTML). Anders mist `@vercel/blob` en krijg je `Cannot find module '@vercel/blob'`.

## 2. Domein

Bijv. `store.utrechtroleplay.eu` → koppel aan dit project (niet aan de main site).

## 3. Environment Variables

Zie `.env.example` — kopieer **`DISCORD_CLIENT_SECRET`**, **`DISCORD_BOT_TOKEN`** en **`DISCORD_GUILD_ID`** van het staff-portaal (zelfde Discord-app).

## 4. Discord OAuth redirects

- `https://store.utrechtroleplay.eu/`
- `https://store.utrechtroleplay.eu/admin.html`

## 5. FiveM

`fivem-resources/utrp_store/config.lua`:

```lua
Config.ApiUrl = 'https://store.utrechtroleplay.eu'
Config.ApiKey = '<zelfde als STORE_BRIDGE_API_KEY>'
```

## 6. Test

`https://store.utrechtroleplay.eu/api/health` → `{"ok":true,"store":true}`

## Logo

Kopieer `logo.png` en `favicon.png` naar `assets/images/` en `assets/` (van main site `utrecht-roleplay-main/assets/`).
