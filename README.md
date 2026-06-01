# Utrecht Store (apart project)

Aparte website voor de URP coin store — **niet** onderdeel van `utrecht-roleplay-main`.

## Structuur

| Onderdeel | Beschrijving |
|-----------|--------------|
| `index.html` | Store voor spelers |
| `admin.html` | Beheer producten, categorieën, coins |
| `api/` | Vercel serverless (auth, aankoop, bridge) |
| `fivem-resources/utrp_store/` | ESX bridge → garage |

## Deploy

1. Nieuw **Vercel project** importeren uit map `utrecht-store` (eigen repo aanbevolen).
2. Domein bijv. `store.utrechtroleplay.eu`.
3. Zie `STORE.md` en `DEPLOY.md` voor env vars en Discord redirects.

## Main website

Link vanaf [utrechtroleplay.eu](https://www.utrechtroleplay.eu) naar deze store-URL. Geen store-bestanden meer in de main site repo.
