# Deploy utrecht-store (apart Vercel-project)

## 1. Vercel

- **Add New Project** → map `utrecht-store` (eigen GitHub-repo: `utrecht-store`)
- Root Directory: leeg
- Install: `npm install`
- Build: `node scripts/vercel-prep.js` (staat in `vercel.json`)
- Output: `.`

**Belangrijk:** upload/deploy altijd met **`package.json`** + **`package-lock.json`** in de root (niet alleen HTML). Anders mist `@vercel/blob` en krijg je `Cannot find module '@vercel/blob'`.

**Blob private store:** als je store op *Private* staat (aanbevolen), gebruik `@vercel/blob` ≥ 2.3 en laat `BLOB_ACCESS` leeg of `private`. Fout *"Cannot use public access on a private store"* betekent dat je oude code deployde — redeploy na `npm install`.

---

## Handmatige upload (max 100 bestanden)

Vercel weigert grote uploads. **Upload NOOIT `node_modules`** — dat zijn honderden bestanden.

### Optie A — GitHub (aanbevolen)

1. Maak repo `utrecht-store` op GitHub  
2. Alleen map **`utrecht-store`** pushen (zonder `node_modules`)  
3. Vercel → Import Git Repository → deploy automatisch  

### Optie B — Handmatig (alleen deze map)

Upload **alleen** de inhoud van `utrecht-store`, **zonder**:

- `node_modules` ❌  
- `fivem-resources` ❌ (hoort op je FiveM-server, niet op Vercel)  
- `.vercel` ❌  

Wel uploaden (~30 bestanden): `index.html`, `admin.html`, `package.json`, `package-lock.json`, `vercel.json`, `api/router.js`, `assets/`, `js/`, `server/`, `scripts/`

### Optie C — ZIP

```powershell
cd "c:\Users\broed\Desktop\Nieuwe map (4)\utrecht-roleplay-main\utrecht-store"
# ZIP zonder node_modules:
Compress-Archive -Path index.html,admin.html,package.json,package-lock.json,vercel.json,api,assets,js,server,scripts,.vercelignore -DestinationPath ..\utrecht-store-deploy.zip -Force
```

Upload `utrecht-store-deploy.zip` in Vercel (als ZIP wordt ondersteund) of uitpakken en map selecteren **zonder node_modules**.

## 2. Domein

Bijv. `store.utrechtroleplay.eu` → koppel aan dit project (niet aan de main site).

## 3. Environment Variables

Zie `.env.example` — kopieer **`DISCORD_CLIENT_SECRET`**, **`DISCORD_BOT_TOKEN`** en **`DISCORD_GUILD_ID`** van het staff-portaal (zelfde Discord-app).

## 4. Discord OAuth redirects

Voeg **exact** deze URLs toe in [Discord Developer Portal](https://discord.com/developers/applications) → OAuth2 → Redirects:

**Vercel (tijdelijk):**
- `https://store-utrecht.vercel.app/`
- `https://store-utrecht.vercel.app/admin.html`

**Eigen domein (later):**
- `https://store.utrechtroleplay.eu/`
- `https://store.utrechtroleplay.eu/admin.html`

Geen `/index.html` — Discord moet **exact** matchen (inclusief trailing slash bij `/`).

## 5. FiveM

`fivem-resources/utrp_store/` op je game-server. In **`server.cfg`**:

```cfg
set urp_store_api_url "https://store-utrecht.vercel.app"
set urp_store_api_key "urp-bridge-utrecht-8Kx2mP9vQ7nR4wT6"
ensure utrp_store
```

Na start: server console **`storebridge`** → moet `Bridge OK` tonen.  
Zie `fivem-resources/utrp_store/README.md` bij verbindingsfouten.

## 6. Test

`https://store.utrechtroleplay.eu/api/health` → `{"ok":true,"store":true}`

## Logo

Kopieer `logo.png` en `favicon.png` naar `assets/images/` en `assets/` (van main site `utrecht-roleplay-main/assets/`).
