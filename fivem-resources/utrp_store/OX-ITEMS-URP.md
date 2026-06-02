# ox_inventory itemnamen (URP)

In **admin → product type `item`** vul je **`meta.item`** = exacte key uit `ox_inventory/data/items.lua` (kleine letters).

## Veel gebruikt op URP

| Product (voorbeeld) | meta.item | Aantal |
|---------------------|-----------|--------|
| Water | `water` | 1 |
| Brood | `bread` | 1 |
| Burger | `burger` | 1 |
| Kipburger | `burger_chicken` | 1 |
| Telefoon | `phone` | 1 |
| Bier | `beer` | 1 |
| Cola | `cola` | 1 |
| Medische tas | `medicalbag` | 1 |
| Tas | `bag` | 1 |

## Regels

1. **Productnaam** (Water) ≠ **ox item** (`water`) — beide apart invullen in admin.
2. Speler moet **online** zijn op de server; order blijft *pending* tot je inlogt.
3. Inventory **vol** → order faalt; maak ruimte en laat admin order opnieuw in wachtrij zetten.
4. Onbekende itemnaam → server console: `Onbekend ox item "..."` — pas admin aan.

## Test

1. Admin: product type **item**, ox item `water`, aantal 1.
2. In-game online, `/koppelstore` gedaan, coins kopen.
3. Binnen ~5 sec melding: *Je hebt 1x … ontvangen*.
4. Server console: `[utrp_store] Item … -> license:…`
