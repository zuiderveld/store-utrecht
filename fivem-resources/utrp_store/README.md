# utrp_store — FiveM ↔ website koppeling

## Snel fixen bij "Geen verbinding met store API"

1. **Vercel** → Project → Settings → Environment Variables  
   Kopieer de waarde van **`STORE_BRIDGE_API_KEY`**.

2. **FiveM `server.cfg`** (boven `ensure utrp_store`):

```cfg
set urp_store_api_url "https://store-utrecht.vercel.app"
set urp_store_api_key "PLAK_HIER_JOUW_STORE_BRIDGE_API_KEY"
ensure utrp_store
```

3. **Herstart** de resource of server.

4. In **server console**: `storebridge`  
   - `Bridge OK` = verbinding werkt  
   - `API key klopt niet` = key in cfg ≠ Vercel  
   - `kan ... niet bereiken` = firewall/DNS — host moet outbound HTTPS toestaan

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
