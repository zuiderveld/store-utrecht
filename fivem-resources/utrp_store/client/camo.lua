local function notify(msg, ntype)
    if GetResourceState('ox_lib') == 'started' then
        exports.ox_lib:notify({ title = 'Camo', description = msg, type = ntype or 'success' })
        return
    end
    TriggerEvent('chat:addMessage', { args = { '^2Camo', msg } })
end

local function applyCamoToPed(ped, weaponHash, tint)
    if not ped or not weaponHash then return false end
    tint = tonumber(tint) or 0
    if HasPedGotWeapon(ped, weaponHash, false) then
        SetPedWeaponTintIndex(ped, weaponHash, tint)
        return true
    end
    return false
end

--- Custom textures (Galaxy, Sakura, Akatsuki, …)
--- Koppel hier jullie eigen camo-resource:
local function applyCustomCamo(weaponName, camoId)
    -- if GetResourceState('jouw_camo') == 'started' then
    --     return exports['jouw_camo']:ApplySkin(weaponName, camoId)
    -- end
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
        notify(('Camo %s toegepast (tint %s)'):format(meta.camoId, tostring(meta.tint or 0)))
        return true
    end

    notify(
        'Je hebt ' .. (meta.weapon or 'dit wapen') .. ' niet bij je. Pak het wapen en gebruik het item opnieuw.',
        'error'
    )
    return false
end)

RegisterNetEvent('utrp_store:camoUnlocked', function(meta)
    if type(meta) ~= 'table' then return end
    notify(('Camo unlock: %s voor %s'):format(meta.camoId or '?', meta.weapon or '?'))
end)
