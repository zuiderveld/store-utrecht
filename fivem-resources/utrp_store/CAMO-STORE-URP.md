# Wapen camo (URP Store)

Camo producten koop je op de website in categorie **Camo**. Na aankoop krijgt de speler een **ox_inventory item** met metadata.

## 1. Categorie aanmaken (admin)

1. **Categorieën** → naam: `Camo`, sorteer naar wens (slug wordt automatisch `camo`).
2. **Producten** → type **Wapen camo**, categorie **Camo**.

| Veld | Voorbeeld |
|------|-----------|
| Naam | Purple Haze |
| Afbeelding URL | preview texture (jpg/png) |
| Prijs | 500 coins |
| Wapen hash | `WEAPON_COMBATPISTOL` |
| Wapen label | Phantom 17 |
| Groep | `PISTOLEN` of `SMGS` |
| Camo ID | `purple_haze` |
| Tint | `0`–`7` (optioneel, GTA standaard tint) |
| ox unlock item | `weapon_camo` |

Elke camo = **1 product**. Zelfde wapen, andere camo = nieuw product met zelfde `weapon` maar andere `camoId`.

## 2. ox_inventory item toevoegen

In `ox_inventory/data/items.lua`:

```lua
['weapon_camo'] = {
    label = 'Wapen camo unlock',
    weight = 10,
    stack = false,
    close = true,
    description = 'Camo skin voor je wapen — gebruik het item om toe te passen.',
    consume = 1,
    client = {
        export = 'utrp_store.useCamoUnlock',
    },
},
```

## 3. Item gebruiken (client export)

Maak in `utrp_store/client/camo.lua` (of bestaand camo-script):

```lua
exports('useCamoUnlock', function(data, slot)
    local meta = slot and slot.metadata
    if not meta or not meta.weapon or not meta.camoId then
        return false
    end

    local ped = PlayerPedId()
    local weaponHash = joaat(meta.weapon)

    -- Optie A: standaard GTA tint (MK2 wapens)
    if meta.tint and meta.tint > 0 then
        if HasPedGotWeapon(ped, weaponHash, false) then
            SetPedWeaponTintIndex(ped, weaponHash, tonumber(meta.tint) or 0)
        end
    end

    -- Optie B: eigen camo-script (Galaxy, Sakura, etc.)
    -- exports['jouw_camo_resource']:ApplyCamo(meta.weapon, meta.camoId)

    lib.notify({
        title = 'Camo',
        description = ('Camo %s toegepast op %s'):format(meta.camoId, meta.weapon),
        type = 'success',
    })

    return true -- item wordt verbruikt (consume = 1)
end)
```

Voeg `client/camo.lua` toe aan `fxmanifest.lua` als je deze export gebruikt.

## 4. Metadata op het item

Na store-aankoop krijgt de speler:

```json
{
  "camoId": "purple_haze",
  "weapon": "WEAPON_COMBATPISTOL",
  "tint": 5,
  "label": "Purple Haze",
  "description": "Camo purple_haze voor WEAPON_COMBATPISTOL"
}
```

## 5. Wapen in ox_inventory (het echte wapen)

Het **wapen zelf** moet al bestaan als ox item, bijv. in `ox_inventory/data/weapons.lua`:

```lua
['WEAPON_COMBATPISTOL'] = {
    label = 'Combat Pistol',
    weight = 1000,
    durability = 0.03,
    ammoname = 'ammo-9',
},
```

Camo unlock verandert **niet** het wapen-item — het voegt een unlock-item toe. Jouw camo-script past de skin toe op het wapen dat de speler vasthoudt.

## 6. Custom textures (Galaxy, Sakura, …)

Standaard GTA tints zijn alleen 0–7. Voor custom textures heb je een **eigen camo resource** nodig die:

1. Luistert naar `utrp_store:camoUnlocked` (server triggert dit na aankoop), of
2. Het `weapon_camo` item gebruikt via export hierboven.

Koppel `meta.camoId` aan je texture/YTD in dat script.

## 7. Test

1. Admin: categorie Camo + product type wapen camo.
2. Speler: Discord + FiveM gekoppeld, online op server.
3. Koop camo op website → binnen ~5 sec melding in-game.
4. Check inventory: item `weapon_camo` met metadata.
5. Gebruik item → camo toegepast (via jouw export).

## Config

`config.lua`:

```lua
Config.CamoUnlockItem = 'weapon_camo'
```

Per product kun je in admin een ander ox item invullen.
