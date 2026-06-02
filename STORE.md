# URP Store (apart project)

Eigen project **`utrecht-store`** — niet in `utrecht-roleplay-main`. Zelfde visuele stijl als de main site.

## URLs (eigen domein)

| Pagina | Pad |
|--------|-----|
| Store | `https://store.utrechtroleplay.eu/` |
| Beheer | `https://store.utrechtroleplay.eu/admin.html` |
| API health | `/api/health` |

## Discord Developer Portal

Voeg redirect URIs toe voor je OAuth-app:

- `https://store.utrechtroleplay.eu/`
- `https://store.utrechtroleplay.eu/admin.html`
- (lokaal) `http://localhost:3000/` en `http://localhost:3000/admin.html`

Scopes: `identify guilds guilds.members.read`

## Vercel Environment Variables

| Variabele | Verplicht | Waarde |
|-----------|-----------|--------|
| `BLOB_READ_WRITE_TOKEN` | Ja | Vercel Blob token |
| `DISCORD_CLIENT_SECRET` | Ja | Zelfde Discord-app als staff |
| `DISCORD_BOT_TOKEN` | Ja | Bot moet op URP Discord staan |
| `DISCORD_GUILD_ID` | Ja | **`1416816652644909109`** (URP Discord) |
| `STORE_ADMIN_USER` | Nee | Admin login gebruikersnaam (default `admin`) |
| `STORE_ADMIN_PASSWORD` | Ja | Wachtwoord voor `/admin.html` |
| `STORE_BRIDGE_API_KEY` | Ja | Zelfde als FiveM `config.lua` |

**Admin** gebruikt **wachtwoord** (`STORE_ADMIN_*`), niet Discord rollen.

## Inloggen

- **Discord:** authorization code flow, `accessToken` in `sessionStorage` (zoals `urpStaffAccessToken`)
- **FiveM:** `/koppelstore CODE` in-game — verplicht voor **coins gebruiken** (kopen)
- Catalogus bekijken kan zonder login; kopen vereist **Discord + FiveM gekoppeld**

Optioneel: `GRP_BRIDGE_API_KEY` als alias voor de bridge key.

## Spelerflow

1. **Discord login** op de store-homepage (of direct in-game)
2. **Koppel FiveM** → knop op website → code → in-game: `/koppelstore CODE`
3. **Kopen** met coins:
   - **Website:** store.utrechtroleplay.eu
   - **In-game:** `/store` — zelfde catalogus, winkelwagen, checkout
4. Orders worden `pending` → FiveM resource zet voertuig in `owned_vehicles`

## In-game store (`/store`)

- Opent NUI met dezelfde producten als de website (via bridge API `catalog`)
- Coins-saldo live van de gekoppelde Discord-account (`profile`)
- Winkelwagen + bevestiging (zoals Vertex/Springbank)
- Voertuigen komen direct in garage na checkout

### Bridge endpoints (FiveM)

Header: `X-Bridge-Key: <STORE_BRIDGE_API_KEY>`

| Actie | Methode | Beschrijving |
|-------|---------|--------------|
| `health` | GET | Status + pending count |
| `catalog` | GET | Categorieën + producten |
| `profile` | POST `{ license }` | Coins + gekoppeld? |
| `link` | POST | Koppelcode verwerken |
| `purchase` | POST `{ license, productId }` | Enkel product |
| `purchase-cart` | POST `{ license, productIds }` | Winkelwagen |
| `pending` | GET | Openstaande orders |
| `complete` | POST | Order afhandelen |

Optioneel voertuig-stats in admin meta: `topspeed`, `trunk`, `location`

## FiveM resource

Map: `fivem-resources/utrp_store/`

1. Kopieer naar `resources/[local]/utrp_store`
2. Zet `Config.ApiKey` en `Config.ApiUrl`
3. Vereist: **es_extended**, **oxmysql**
4. Pas `config.lua` aan: `ApiKey`, `ApiUrl`, `TebexUrl`
5. `ensure utrp_store` in `server.cfg`
6. In-game: `/store` — `/koppelstore CODE` voor eerste koppeling

## Admin (`/admin.html`)

**Aparte login** — geen Discord rollen meer nodig.

| Vercel variabele | Beschrijving |
|------------------|--------------|
| `STORE_ADMIN_USER` | Gebruikersnaam (default: `admin`) |
| `STORE_ADMIN_PASSWORD` | Sterk wachtwoord — **verplicht** |

1. Zet beide in Vercel → redeploy  
2. Ga naar `/admin.html`  
3. Log in met gebruikersnaam + wachtwoord  

Sessie duurt 12 uur. Store-spelers login (Discord/e-mail) is **los** hiervan.

- Categorieën / producten / coins beheren  
- Voertuig-product: type `vehicle`, meta `model` + garage ID  

## API (bridge)

Header: `X-Bridge-Key: <STORE_BRIDGE_API_KEY>`

- `GET /api/store-bridge?action=pending`
- `POST /api/store-bridge?action=link` — body: `{ code, license, identifiers }`
- `POST /api/store-bridge?action=complete` — body: `{ orderId, status }`
