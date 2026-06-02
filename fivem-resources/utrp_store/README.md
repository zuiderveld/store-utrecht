# utrp_store — FiveM ↔ website koppeling

## Snel fixen bij "Geen verbinding met store API"

1. **Vercel** → Project → Settings → Environment Variables  
   Kopieer de waarde van **`STORE_BRIDGE_API_KEY`**.

2. **FiveM `server.cfg`** (boven `ensure utrp_store`):

```cfg
set urp_store_api_url "https://store-utrecht.vercel.app"
set urp_store_api_key "urp-bridge-utrecht-8Kx2mP9vQ7nR4wT6"
ensure utrp_store
```

(Zie ook `server.cfg.example` in deze map.)

3. **Herstart** de resource of server.

4. In **server console**: `storebridge`  
   - `Bridge OK` = verbinding werkt  
   - `API key klopt niet` = key in cfg ≠ Vercel  
   - `kan ... niet bereiken` = firewall/DNS — host moet outbound HTTPS toestaan

## Items (ox_inventory)

Bij product type **item** in admin:

| Veld | Voorbeeld |
|------|-----------|
| **ox item naam** (`meta.item`) | `water` — key uit `data/items.lua`, kleine letters |
| **Aantal** (`meta.count`) | `1` |

Zie **`OX-ITEMS-URP.md`** voor URP-voorbeelden (water, bread, burger, phone, …).

Speler moet **online** zijn — item binnen ~3–5 sec via `exports.ox_inventory:AddItem`.  
Offline → order blijft *pending* tot je inlogt.

## Voertuigen (cloud-garage)

Bij product type **vehicle** in admin:

| Veld | Voorbeeld |
|------|-----------|
| **Spawn model** (`meta.model`) | `adder` |
| **Garage ID** (`meta.garage`) | `2` — index in cloud-garage `Config.Locations` |

Zie **`CLOUD-GARAGE-URP.md`** voor garage-ID's en database-kolommen.

Speler moet **online** zijn (ESX identifier) — anders faalt de garage-insert.

**Veelvoorkomende fouten**

- Admin leeg laten bij ox item → aankoop geblokkeerd of `no_item_configured`
- `Water` i.p.v. `water` → nu automatisch lowercase
- Item bestaat niet in ox → console: `Onbekend ox item`
- Inventory vol → `inventory_full`, speler moet ruimte maken

## Koppelen speler

1. Speler logt in op de website store  
2. Klik **Koppel FiveM** → krijgt code  
3. In-game: `/koppelstore ABC123` (alleen de code)

## Config

| Convar | Default |
|--------|---------|
| `urp_store_api_url` | `https://store-utrecht.vercel.app` |
| `urp_store_api_key` | placeholder (moet overschreven!) |
| `urp_store_web_url` | zelfde als api url |

Of pas `config.lua` direct aan.
