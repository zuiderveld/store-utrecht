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

Scopes: `identify guilds` (zelfde als staff-portaal)

## Vercel Environment Variables

**Gebruik dezelfde waarden als het staff-portaal** (`DISCORD_CLIENT_SECRET`, `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID`).

| Variabele | Verplicht | Beschrijving |
|-----------|-----------|--------------|
| `BLOB_READ_WRITE_TOKEN` | Ja | Opslag catalogus, users, orders |
| `DISCORD_CLIENT_SECRET` | Ja | Zelfde als staff |
| `DISCORD_BOT_TOKEN` | Ja | Zelfde als staff |
| `DISCORD_GUILD_ID` | Ja | Zelfde als staff |
| `DISCORD_STORE_ADMIN_ROLES` | Nee | Store-beheer; leeg = Founder/Co-Founder rollen |
| `STORE_BRIDGE_API_KEY` | Ja | Zelfde als FiveM `config.lua` |

## Inloggen

- **Discord:** authorization code flow, `accessToken` in `sessionStorage` (zoals `urpStaffAccessToken`)
- **FiveM:** `/koppelstore CODE` in-game — verplicht voor **coins gebruiken** (kopen)
- Catalogus bekijken kan zonder login; kopen vereist **Discord + FiveM gekoppeld**

Optioneel: `GRP_BRIDGE_API_KEY` als alias voor de bridge key.

## Spelerflow

1. **Discord login** op de store-homepage
2. **Koppel FiveM** → knop op website → code → in-game: `/koppelstore CODE`
3. **Kopen** met coins → order `pending` → FiveM resource zet voertuig in `owned_vehicles`

## FiveM resource

Map: `fivem-resources/utrp_store/`

1. Kopieer naar `resources/[local]/utrp_store`
2. Zet `Config.ApiKey` en `Config.ApiUrl`
3. Vereist: **es_extended**, **oxmysql**
4. Pas `config.lua` aan als je andere garage-kolomnamen gebruikt
5. `ensure utrp_store` in `server.cfg`

## Admin

- Inloggen met Discord-account dat **DISCORD_STORE_ADMIN_ROLES** heeft
- Categorieën / producten / coins beheren
- Voertuig-product: type `vehicle`, meta `model` + `garage`

## API (bridge)

Header: `X-Bridge-Key: <STORE_BRIDGE_API_KEY>`

- `GET /api/store-bridge?action=pending`
- `POST /api/store-bridge?action=link` — body: `{ code, license, identifiers }`
- `POST /api/store-bridge?action=complete` — body: `{ orderId, status }`
