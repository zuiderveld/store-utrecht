local ESX = exports['es_extended']:getSharedObject()
local isOpen = false

local function notify(msg, ntype)
    if GetResourceState('ox_lib') == 'started' then
        exports.ox_lib:notify({ title = 'URP Store', description = msg, type = ntype or 'inform' })
        return
    end
    TriggerEvent('chat:addMessage', { args = { '^3Store', msg } })
end

RegisterNetEvent('utrp_store:openUI', function(payload)
    if isOpen then return end
    isOpen = true
    SetNuiFocus(true, true)
    SendNUIMessage({
        action = 'open',
        data = payload,
    })
end)

RegisterNetEvent('utrp_store:closeUI', function()
    if not isOpen then return end
    isOpen = false
    SetNuiFocus(false, false)
    SendNUIMessage({ action = 'close' })
end)

RegisterNUICallback('close', function(_, cb)
    isOpen = false
    SetNuiFocus(false, false)
    SendNUIMessage({ action = 'close' })
    cb({ ok = true })
end)

RegisterNUICallback('notify', function(data, cb)
    notify(data.message or '', data.type)
    cb({ ok = true })
end)

RegisterNUICallback('checkout', function(data, cb)
    ESX.TriggerServerCallback('utrp_store:checkout', function(result)
        cb(result or { ok = false, error = 'Server niet bereikbaar' })
    end, data.productIds or {})
end)

RegisterNUICallback('refreshProfile', function(_, cb)
    ESX.TriggerServerCallback('utrp_store:getProfile', function(result)
        cb(result or { ok = false })
    end)
end)

RegisterNUICallback('openExternalLink', function(data, cb)
    local url = type(data) == 'table' and data.url or nil
    if type(url) ~= 'string' or not url:match('^https?://') then
        cb({ ok = false, error = 'Ongeldige link' })
        return
    end

    if GetResourceState('ox_lib') == 'started' then
        exports.ox_lib:openUrl(url)
    else
        notify('Open in browser: ' .. url, 'inform')
    end
    cb({ ok = true })
end)

RegisterCommand(Config.OpenCommand or 'store', function()
    if isOpen then
        TriggerEvent('utrp_store:closeUI')
        return
    end
    TriggerServerEvent('utrp_store:requestOpen')
end, false)

RegisterKeyMapping(Config.OpenCommand or 'store', 'Open URP Store', 'keyboard', '')

CreateThread(function()
    Wait(1000)
    TriggerEvent('chat:addSuggestion', '/' .. (Config.OpenCommand or 'store'), 'Open de URP coin store')
    TriggerEvent('chat:addSuggestion', '/koppelstore', 'Koppel je FiveM account aan de website store', {
        { name = 'code', help = 'Code van store.utrechtroleplay.eu' },
    })
end)
