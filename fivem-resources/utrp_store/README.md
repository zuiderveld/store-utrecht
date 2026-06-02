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
- **ox item naam** = exacte naam in ox_inventory (bijv. `bread`)
- **Aantal** = hoeveel stuks

Speler moet **online** zijn op de server — item komt binnen ~3–5 sec in inventory.  
Offline? Order blijft pending tot je inlogt.

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
