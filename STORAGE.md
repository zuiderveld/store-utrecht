# Store database — zonder Vercel Blob

De store kan op **3 manieren** data bewaren (env `STORE_STORAGE`):

| Modus | Env | Waar | Geschikt voor |
|-------|-----|------|----------------|
| **file** | `STORE_STORAGE=file` | JSON op schijf (`data/store-state.json`) | **VPS / eigen server / lokaal** |
| **memory** | `STORE_STORAGE=memory` | RAM (verdwijnt bij herstart) | **Tijdelijk op Vercel** tot Blob weer werkt |
| **blob** | `STORE_STORAGE=blob` (standaard op Vercel) | Vercel Blob | Vercel + Pro / binnen Hobby-limiet |

---

## Snel fix op Vercel (Blob geblokkeerd tot 11-07-2026)

1. Vercel → **store-utrecht** → **Settings → Environment Variables**
2. Voeg toe: **`STORE_STORAGE`** = **`memory`**
3. **Redeploy**

Admin + store werken weer, maar **coins/orders/producten gaan verloren** bij elke redeploy of cold start. Alleen voor tijdelijk testen/beheer.

Test: `https://store-utrecht.vercel.app/api/health?blob=1` → `"storage": "memory"`, `"readable": true`

---

## Permanent zonder Blob: JSON-bestand (aanbevolen)

Vercel serverless heeft **geen vaste schijf** — `file` werkt daar **niet** permanent.

Host de store-API op bijv.:

- Je **FiveM VPS** (zelfde machine als de server)
- **Railway / Render / Fly.io** met volume
- Een **goedkope VPS** (Hetzner, etc.)

### Stappen

1. Zet project op de server (Node 18+)
2. Env:
   ```env
   STORE_STORAGE=file
   STORE_DATA_PATH=/pad/naar/store-state.json
   DISCORD_CLIENT_SECRET=...
   DISCORD_BOT_TOKEN=...
   DISCORD_GUILD_ID=1416816652644909109
   STORE_BRIDGE_API_KEY=...
   STORE_ADMIN_USERS=naam:wachtwoord
   ```
3. Start API (bijv. met `pm2` + kleine Node server, of nginx → serverless proxy)
4. Pas **FiveM** + website URL aan naar jouw host:
   ```cfg
   set urp_store_api_url "https://jouw-store-api.nl"
   ```

Database = één JSON-bestand met users, coins, orders, producten, sessies.

**Backup:** kopieer `data/store-state.json` (en `.backup.json`) regelmatig.

---

## Lokaal testen (Windows)

```powershell
cd utrecht-store
$env:STORE_STORAGE="file"
node scripts/local-api.js
```

Open `http://localhost:3000` — data in `data/store-state.json`.

---

## Later terug naar Blob

Verwijder `STORE_STORAGE=memory` of zet `STORE_STORAGE=blob` na 11 juli 2026 (of Pro upgrade).
