# URP Camo — snelstart

Alle camo-data staat in deze bestanden:

| Bestand | Wat |
|---------|-----|
| **`OX-CAMO-URP.lua`** | Copy-paste voor ox_inventory + wapen/camo lijst + admin uitleg |
| **`data/camo-catalog.json`** | JSON catalogus (12 wapens × 14 camo's) |
| **`client/camo.lua`** | Export `utrp_store.useCamoUnlock` (al in fxmanifest) |

---

## 1. ox_inventory — items.lua

Plak dit in `ox_inventory/data/items.lua`:

```lua
['weapon_camo'] = {
    label = 'Wapen camo unlock',
    weight = 10,
    stack = false,
    close = true,
    consume = 1,
    description = 'Camo skin voor je wapen. Gebruik als je het wapen bij je hebt.',
    client = {
        export = 'utrp_store.useCamoUnlock',
    },
},
```

---

## 2. ox_inventory — weapons.lua

Zorg dat deze wapens bestaan (hashes uit jullie gangshop):

**PISTOLEN:** `WEAPON_PISTOL_MK2`, `WEAPON_M1911`, `WEAPON_MEOS45`, `WEAPON_DE`, `WEAPON_TP9SF`, `WEAPON_FNX45`, `WEAPON_GLOCK45`, `WEAPON_G17B`, `WEAPON_SMITHWESSON`

**SMGS:** `WEAPON_MP9`, `WEAPON_UMP45`, `WEAPON_MAC11`

> Labels in store (Phantom 17, PX9 NL, …) zijn display-namen — de **hash** moet exact kloppen met ox.

---

## 3. 14 camo skins

| camoId | Naam | Tint | Prijs (coins) |
|--------|------|------|---------------|
| woodland | Woodland | 5 | 350 |
| galaxy | Galaxy | 6 | 450 |
| neon_blue | Neon Blue | 6 | 400 |
| crimson_fade | Crimson Fade | 1 | 400 |
| dragon_scale | Dragon Scale | 2 | 450 |
| sakura | Sakura | 3 | 450 |
| toxic_green | Toxic Green | 5 | 400 |
| gold_rush | Gold Rush | 2 | 500 |
| flames | Flames | 1 | 450 |
| akatsuki | Akatsuki | 1 | 450 |
| blue_mirror | Blue Mirror | 6 | 400 |
| red_nova | Red Nova | 1 | 400 |
| ice | Ice | 3 | 400 |
| purple_haze | Purple Haze | 7 | 450 |

**Tint 0–7** = GTA standaard kleur. Custom textures (Galaxy, Sakura, …) → koppel in `client/camo.lua` → `applyCustomCamo()`.

---

## 4. Store admin — categorie + producten

1. Categorie: **Camo** (slug `camo`)
2. Type: **Wapen camo**
3. Voorbeeld product **Purple Haze — Phantom 17**:

| Veld | Waarde |
|------|--------|
| Naam | Purple Haze — Phantom 17 |
| Wapen hash | WEAPON_PISTOL_MK2 |
| Wapen label | Phantom 17 |
| Groep | PISTOLEN |
| Camo ID | purple_haze |
| Tint | 7 |
| Prijs | 450 |
| Afbeelding | URL naar texture preview |
| ox item | weapon_camo |

Totaal mogelijk: **168 producten** (12 wapens × 14 camo's). Begin met 1 wapen + alle 14 camo's = 14 producten.

---

## 5. FiveM

- Upload `utrp_store` (inclusief `client/camo.lua`)
- `ensure utrp_store`
- Speler online + `/koppelstore` → koop camo → item `weapon_camo` in inventory → gebruik item

Zie ook **`CAMO-STORE-URP.md`** voor troubleshooting.
