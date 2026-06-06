--[[
  URP STORE — Wapen camo catalogus + ox_inventory copy-paste
  Bestand: utrp_store/OX-CAMO-URP.lua

  STAP 1 → Plak het blok "ITEMS" in ox_inventory/data/items.lua
  STAP 2 → Controleer wapens in ox_inventory/data/weapons.lua (lijst hieronder)
  STAP 3 → Plak client/camo.lua in utrp_store (zie einde dit bestand) + fxmanifest
  STAP 4 → Admin: categorie "Camo" + producten (type weapon_camo) — zie admin-tabel
]]

-- =============================================================================
-- STAP 1 — ox_inventory/data/items.lua
-- =============================================================================

--[[
['weapon_camo'] = {
    label = 'Wapen camo unlock',
    weight = 10,
    stack = false,
    close = true,
    consume = 1,
    description = 'Camo skin voor je wapen. Gebruik het item als je het wapen bij je hebt.',
    client = {
        export = 'utrp_store.useCamoUnlock',
    },
},
]]

-- =============================================================================
-- STAP 2 — Wapens (moeten al in ox_inventory/data/weapons.lua staan)
-- Pas hashes aan als jullie server andere namen gebruikt!
-- =============================================================================

local URP_CAMO_WEAPONS = {
    -- PISTOLEN
    { hash = 'WEAPON_PISTOL_MK2',   label = 'Phantom 17',   group = 'PISTOLEN', ammoname = 'ammo-9' },
    { hash = 'WEAPON_M1911',        label = 'M1911',          group = 'PISTOLEN', ammoname = 'ammo-45' },
    { hash = 'WEAPON_MEOS45',       label = 'MEOS-45',        group = 'PISTOLEN', ammoname = 'ammo-45' },
    { hash = 'WEAPON_DE',           label = 'Viper Magnum',   group = 'PISTOLEN', ammoname = 'ammo-50' },
    { hash = 'WEAPON_TP9SF',        label = 'PX9 NL',         group = 'PISTOLEN', ammoname = 'ammo-9' },
    { hash = 'WEAPON_FNX45',        label = 'Ventura',        group = 'PISTOLEN', ammoname = 'ammo-45' },
    { hash = 'WEAPON_GLOCK45',      label = 'Blackline 9',    group = 'PISTOLEN', ammoname = 'ammo-9' },
    { hash = 'WEAPON_G17B',         label = 'Phantom 17T',  group = 'PISTOLEN', ammoname = 'ammo-9' },
    { hash = 'WEAPON_SMITHWESSON',  label = 'Sentinel',       group = 'PISTOLEN', ammoname = 'ammo-9' },
    -- SMGS
    { hash = 'WEAPON_MP9',          label = 'MX5',            group = 'SMGS',     ammoname = 'ammo-9' },
    { hash = 'WEAPON_UMP45',        label = 'UP45',           group = 'SMGS',     ammoname = 'ammo-45' },
    { hash = 'WEAPON_MAC11',        label = 'MC-11',          group = 'SMGS',     ammoname = 'ammo-45' },
}

--[[
Voorbeeld als een wapen nog ontbreekt in weapons.lua:

['WEAPON_M1911'] = {
    label = 'M1911',
    weight = 1200,
    durability = 0.05,
    ammoname = 'ammo-45',
},
]]

-- =============================================================================
-- CAMO SKINS (14 stuks — zoals camo editor)
-- camoId = unieke ID voor je script + store admin
-- tint   = GTA wapentint 0–7 (MK2); custom textures via eigen resource
-- =============================================================================

local URP_CAMO_SKINS = {
    { camoId = 'woodland',      name = 'Woodland',      tint = 5, price = 350 },
    { camoId = 'galaxy',        name = 'Galaxy',        tint = 6, price = 450 },
    { camoId = 'neon_blue',     name = 'Neon Blue',     tint = 6, price = 400 },
    { camoId = 'crimson_fade',  name = 'Crimson Fade',  tint = 1, price = 400 },
    { camoId = 'dragon_scale',  name = 'Dragon Scale',  tint = 2, price = 450 },
    { camoId = 'sakura',        name = 'Sakura',        tint = 3, price = 450 },
    { camoId = 'toxic_green',   name = 'Toxic Green',   tint = 5, price = 400 },
    { camoId = 'gold_rush',     name = 'Gold Rush',     tint = 2, price = 500 },
    { camoId = 'flames',        name = 'Flames',        tint = 1, price = 450 },
    { camoId = 'akatsuki',      name = 'Akatsuki',      tint = 1, price = 450 },
    { camoId = 'blue_mirror',   name = 'Blue Mirror',   tint = 6, price = 400 },
    { camoId = 'red_nova',      name = 'Red Nova',      tint = 1, price = 400 },
    { camoId = 'ice',           name = 'Ice',           tint = 3, price = 400 },
    { camoId = 'purple_haze',   name = 'Purple Haze',   tint = 7, price = 450 },
}

-- =============================================================================
-- STORE ADMIN — per product invullen (type: weapon_camo, categorie: Camo)
-- =============================================================================
--[[
| Productnaam              | weapon              | weaponLabel  | weaponGroup | camoId        | tint | prijs |
|--------------------------|---------------------|--------------|-------------|---------------|------|-------|
| Woodland — Phantom 17    | WEAPON_PISTOL_MK2   | Phantom 17   | PISTOLEN    | woodland      | 5    | 350   |
| Galaxy — Phantom 17      | WEAPON_PISTOL_MK2   | Phantom 17   | PISTOLEN    | galaxy        | 6    | 450   |
| … (herhaal voor elk wapen × elke camo) …       |              |             |               |      |       |

Snelle formule productnaam:  [Camo naam] — [Wapen label]
Afbeelding URL: upload texture preview (zelfde plaatje per camo mag op alle wapens)
ox unlock item: weapon_camo (standaard)
]]

-- =============================================================================
-- METADATA op unlock-item na aankoop (automatisch door utrp_store)
-- =============================================================================
--[[
{
  "camoId": "purple_haze",
  "weapon": "WEAPON_PISTOL_MK2",
  "tint": 7,
  "label": "Purple Haze — Phantom 17",
  "description": "Camo purple_haze voor WEAPON_PISTOL_MK2"
}
]]

-- =============================================================================
-- STAP 3 — client/camo.lua (in utrp_store) — export voor ox_inventory
-- Voeg toe aan fxmanifest.lua:  client_scripts { 'client/main.lua', 'client/camo.lua' }
-- =============================================================================

--[[
--- client/camo.lua
local function notify(msg, ntype)
    if GetResourceState('ox_lib') == 'started' then
        exports.ox_lib:notify({ title = 'Camo', description = msg, type = ntype or 'success' })
    else
        TriggerEvent('chat:addMessage', { args = { '^2Camo', msg } })
    end
end

--- Pas tint toe op wapen in hand of in inventory slot
local function applyCamoToPed(ped, weaponHash, tint)
    if not ped or not weaponHash then return false end
    tint = tonumber(tint) or 0
    if HasPedGotWeapon(ped, weaponHash, false) then
        SetPedWeaponTintIndex(ped, weaponHash, tint)
        return true
    end
    return false
end

--- Custom textures (Galaxy, Sakura, …) — koppel hier jullie camo-resource:
local function applyCustomCamo(weaponName, camoId)
    -- exports['jouw_camo_resource']:Apply(weaponName, camoId)
    -- return true
    return false
end

exports('useCamoUnlock', function(data, slot)
    local meta = slot and slot.metadata
    if not meta or not meta.weapon or not meta.camoId then
        notify('Ongeldige camo unlock.', 'error')
        return false
    end

    local ped = PlayerPedId()
    local weaponHash = joaat(meta.weapon)

    if applyCustomCamo(meta.weapon, meta.camoId) then
        notify(('Camo %s toegepast op %s'):format(meta.camoId, meta.weapon))
        return true
    end

    if applyCamoToPed(ped, weaponHash, meta.tint) then
        notify(('Tint camo %s toegepast — houd je wapen vast.'):format(meta.camoId))
        return true
    end

    notify('Je hebt dit wapen niet bij je. Pak ' .. (meta.weapon or 'wapen') .. ' en gebruik opnieuw.', 'error')
    return false
end)

RegisterNetEvent('utrp_store:camoUnlocked', function(meta)
    if type(meta) ~= 'table' then return end
    notify(('Camo unlock ontvangen: %s (%s)'):format(meta.camoId or '?', meta.weapon or '?'))
end)
]]

-- =============================================================================
-- TINT REFERENTIE (MK2 pistolen — indicatief)
-- =============================================================================
--[[
  0 = Classic Black
  1 = Classic Gray / Fade
  2 = Classic Two-Tone / Gold
  3 = Classic White / Ice
  4 = Classic Beige
  5 = Classic Green / Woodland
  6 = Classic Blue / Galaxy
  7 = Classic Earth / Purple

  Custom skins (galaxy, sakura, …) werken alleen met een eigen texture-resource.
  tint is dan fallback; camoId koppel je in applyCustomCamo().
]]

-- =============================================================================
-- VOLLEDIGE PRODUCTLIJST (168 producten = 12 wapens × 14 camo's)
-- Gebruik voor bulk invoer in admin of eigen import script
-- =============================================================================

if false then -- alleen documentatie, niet uitvoeren
    for _, w in ipairs(URP_CAMO_WEAPONS) do
        for _, c in ipairs(URP_CAMO_SKINS) do
            print(string.format(
                '%s — %s | weapon=%s | camoId=%s | tint=%d | %d coins',
                c.name, w.label, w.hash, c.camoId, c.tint, c.price
            ))
        end
    end
end

return {
    weapons = URP_CAMO_WEAPONS,
    camos = URP_CAMO_SKINS,
}
