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
- (lokaal) `http://localhost:3000/store/` enz.

Scopes: `identify`

## Vercel Environment Variables

| Variabele | Verplicht | Beschrijving |
|-----------|-----------|--------------|
| `BLOB_READ_WRITE_TOKEN` | Ja | Opslag catalogus, users, orders |
| `DISCORD_CLIENT_SECRET` | Ja | OAuth code exchange |
| `DISCORD_BOT_TOKEN` | Ja | Guild member + admin rollen |
| `DISCORD_GUILD_ID` | Ja | URP Discord server |
| `DISCORD_STORE_CLIENT_ID` | Nee | Aparte OAuth app; anders staff client id in config |
| `DISCORD_STORE_ADMIN_ROLES` | Ja | Comma-separated role IDs voor `/store/admin.html` |
| `STORE_BRIDGE_API_KEY` | Ja | Zelfde als FiveM `config.lua` |

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
