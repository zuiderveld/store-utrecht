local ESX = exports['es_extended']:getSharedObject()

local function getLicense(source)
    for _, id in ipairs(GetPlayerIdentifiers(source)) do
        if string.sub(id, 1, 8) == 'license:' then
            return id
        end
    end
    return nil
end

local function getIdentifiers(source)
    local list = {}
    for _, id in ipairs(GetPlayerIdentifiers(source)) do
        list[#list + 1] = id
    end
    return list
end

local function randomPlate()
    local chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789'
    local plate = 'URP'
    for i = 1, 5 do
        local n = math.random(1, #chars)
        plate = plate .. string.sub(chars, n, n)
    end
    return plate
end

local function bridgeRequest(method, path, body)
    local base = Config.ApiUrl:gsub('/+$', '')
    local url = base .. path
    local payload = body and json.encode(body) or ''
    local p = promise.new()

    PerformHttpRequest(url, function(status, response)
        local raw = response or ''
        local ok, data = pcall(json.decode, raw ~= '' and raw or '{}')

        if status == 0 or status == nil then
            print(('[utrp_store] Geen HTTP-verbinding naar %s'):format(url))
            p:resolve({
                ok = false,
                error = 'Geen verbinding met store API — server kan ' .. base .. ' niet bereiken (firewall/DNS/verkeerde URL)',
            })
            return
        end

        if status ~= 200 then
            local err = (ok and type(data) == 'table' and data.error) or ('HTTP ' .. tostring(status))
            if status == 401 then
                err = 'API key klopt niet — zet Config.ApiKey gelijk aan STORE_BRIDGE_API_KEY in Vercel'
            elseif status == 404 then
                err = 'Store API route niet gevonden — check Config.ApiUrl (' .. base .. ')'
            end
            print(('[utrp_store] HTTP %s %s — %s'):format(status, path, raw))
            p:resolve({ ok = false, error = err, maintenance = ok and type(data) == 'table' and data.maintenance or nil })
            return
        end

        if not ok or type(data) ~= 'table' then
            print(('[utrp_store] Ongeldig JSON antwoord op %s — %s'):format(path, raw))
            p:resolve({ ok = false, error = 'Ongeldig antwoord van store API' })
            return
        end

        p:resolve(data)
    end, method, payload, {
        ['Content-Type'] = 'application/json',
        ['X-Bridge-Key'] = Config.ApiKey,
        ['User-Agent'] = 'utrp_store/1.0',
    })

    return Citizen.Await(p)
end

local function asArray(t)
    local out = {}
    if type(t) ~= 'table' then return out end
    for i = 1, #t do
        out[#out + 1] = t[i]
    end
    if #out == 0 then
        for _, v in pairs(t) do
            if type(v) == 'string' or type(v) == 'number' then
                out[#out + 1] = v
            end
        end
    end
    return out
end

local function notifyPlayer(src, msg, ntype)
    if GetResourceState('ox_lib') == 'started' then
        TriggerClientEvent('ox_lib:notify', src, {
            title = 'URP Store',
            description = msg,
            type = ntype or 'success',
        })
        return
    end
    TriggerClientEvent('chat:addMessage', src, { args = { '^2Store', msg } })
end

local function getSourceByLicense(license)
    if not license then return nil end
    for _, playerId in ipairs(GetPlayers()) do
        local src = tonumber(playerId)
        if src and getLicense(src) == license then
            return src
        end
    end
    return nil
end

local function resolveModelHash(model)
    if type(model) == 'number' then return model end
    local name = tostring(model or ''):lower():gsub('%s+', '')
    if name == '' then return nil end
    if Config.VehicleUseHash == false then return name end
    return joaat(name)
end

local function resolveOwner(license)
    if not license then return nil end

    local src = getSourceByLicense(license)
    if (Config.OwnerFormat == 'esx' or Config.OwnerFormat == 'auto') and src then
        local xPlayer = ESX.GetPlayerFromId(src)
        if xPlayer and xPlayer.identifier then
            return xPlayer.identifier
        end
    end

    if Config.OwnerFormat == 'plain' then
        return license:gsub('^license:', '')
    end

    return license
end

local function resolveGarageId(garage)
    if garage ~= nil and garage ~= '' then
        local n = tonumber(garage)
        if n and n > 0 then
            return math.floor(n)
        end
    end

    local defaultId = tonumber(Config.DefaultGarageId)
    if defaultId and defaultId > 0 then
        return math.floor(defaultId)
    end

    return 1
end

local function giveVehicle(license, model, garage)
    local modelHash = resolveModelHash(model)
    if not modelHash then
        error('invalid_vehicle_model: ' .. tostring(model))
    end

    local owner = resolveOwner(license)
    if not owner then
        error('invalid_owner')
    end

    local plate = randomPlate()
    local vehicleProps = {
        model = modelHash,
        plate = plate,
        bodyHealth = 1000.0,
        engineHealth = 1000.0,
        tankHealth = 1000.0,
        fuelLevel = 100.0,
        dirtLevel = 0.0,
    }
    local vehicleJson = json.encode(vehicleProps)
    local garageSystem = Config.GarageSystem or 'minimal'

    if garageSystem == 'cloud-garage' then
        local garageId = resolveGarageId(garage)
        MySQL.insert.await(([[
            INSERT INTO %s (%s, %s, %s, %s, %s, %s, %s)
            VALUES (?, ?, ?, 'car', ?, ?, 0)
        ]]):format(
            Config.VehicleTable,
            Config.OwnerColumn,
            Config.PlateColumn,
            Config.VehicleColumn,
            Config.TypeColumn,
            Config.StoredColumn,
            Config.GarageIdColumn or 'garageid',
            Config.PoundColumn or 'pound'
        ), {
            owner,
            plate,
            vehicleJson,
            Config.StoredInGarage,
            garageId,
        })
    elseif Config.UseParkingColumn then
        local parking = garage or Config.DefaultGarage
        MySQL.insert.await(([[
            INSERT INTO %s (%s, %s, %s, %s, %s, %s)
            VALUES (?, ?, ?, 'car', ?, ?)
        ]]):format(
            Config.VehicleTable,
            Config.OwnerColumn,
            Config.PlateColumn,
            Config.VehicleColumn,
            Config.TypeColumn,
            Config.StoredColumn,
            Config.ParkingColumn
        ), {
            owner,
            plate,
            vehicleJson,
            Config.StoredInGarage,
            parking,
        })
    else
        MySQL.insert.await(([[
            INSERT INTO %s (%s, %s, %s, %s, %s)
            VALUES (?, ?, ?, 'car', ?)
        ]]):format(
            Config.VehicleTable,
            Config.OwnerColumn,
            Config.PlateColumn,
            Config.VehicleColumn,
            Config.TypeColumn,
            Config.StoredColumn
        ), {
            owner,
            plate,
            vehicleJson,
            Config.StoredInGarage,
        })
    end

    local src = getSourceByLicense(license)
    if src then
        local garageHint = ''
        if garageSystem == 'cloud-garage' then
            garageHint = (' (garage #%s)'):format(resolveGarageId(garage))
        end
        notifyPlayer(src, ('Voertuig ontvangen! Kenteken %s — check je garage%s.'):format(plate, garageHint))
    end

    return plate
end

local function normalizeOxItemName(name)
    if not name or name == '' then return nil end
    name = tostring(name):gsub('^%s+', ''):gsub('%s+$', '')
    if name == '' then return nil end
    if name:lower():sub(1, 7) == 'weapon_' then
        return name:upper()
    end
    return name:lower()
end

local function oxItemExists(itemName)
    local ok, item = pcall(function()
        return exports.ox_inventory:Items(itemName)
    end)
    return ok and item ~= nil
end

local function giveStoreItem(order)
    local meta = order.meta or {}
    local itemName = normalizeOxItemName(meta.item or meta.oxItem or meta.itemName)
    local count = math.floor(tonumber(meta.count) or 1)
    if count < 1 then count = 1 end

    if not itemName then
        return false, 'no_item_configured'
    end

    local src = getSourceByLicense(order.license)
    if not src then
        return false, 'player_offline'
    end

    if Config.UseOxInventory == false then
        return false, 'ox_disabled'
    end

    if GetResourceState('ox_inventory') ~= 'started' then
        print('[utrp_store] ox_inventory niet gestart — kan item niet geven: ' .. itemName)
        return false, 'ox_missing'
    end

    if not oxItemExists(itemName) then
        print(('[utrp_store] Onbekend ox item "%s" (order %s) — zet in admin meta.item exact zoals in ox_inventory/data/items.lua'):format(
            itemName,
            order.id or '?'
        ))
        return false, 'unknown_item:' .. itemName
    end

    local itemMeta = meta.metadata or meta.extra
    if itemMeta and type(itemMeta) ~= 'table' then
        itemMeta = nil
    end

    local canCarry = exports.ox_inventory:CanCarryItem(src, itemName, count, itemMeta)
    if not canCarry then
        notifyPlayer(src, 'Inventory vol — maak ruimte voor je store item.', 'error')
        return false, 'inventory_full'
    end

    local added, err = exports.ox_inventory:AddItem(src, itemName, count, itemMeta)

    if added then
        notifyPlayer(src, ('Je hebt %sx %s ontvangen uit de store.'):format(count, order.productName or itemName))
        return true, ('item:%s x%d'):format(itemName, count)
    end

    print(('[utrp_store] AddItem mislukt (%s) item=%s x%s speler=%s'):format(tostring(err), itemName, count, order.license))
    return false, err or 'add_failed'
end

local function giveWeaponCamo(order)
    local meta = order.meta or {}
    local src = getSourceByLicense(order.license)
    if not src then
        return false, 'player_offline'
    end

    if Config.UseOxInventory == false then
        return false, 'ox_disabled'
    end

    if GetResourceState('ox_inventory') ~= 'started' then
        print('[utrp_store] ox_inventory niet gestart — kan camo niet geven')
        return false, 'ox_missing'
    end

    local itemName = normalizeOxItemName(meta.oxItem or meta.item or Config.CamoUnlockItem or 'weapon_camo')
    if not itemName then
        return false, 'no_camo_item'
    end

    if not oxItemExists(itemName) then
        print(('[utrp_store] Camo item "%s" ontbreekt in ox_inventory — zie CAMO-STORE-URP.md'):format(itemName))
        return false, 'unknown_item:' .. itemName
    end

    local itemMeta = {
        camoId = meta.camoId,
        weapon = meta.weapon,
        tint = tonumber(meta.tint) or 0,
        label = order.productName,
        description = ('Camo %s voor %s'):format(meta.camoId or '?', meta.weapon or '?'),
    }

    local canCarry = exports.ox_inventory:CanCarryItem(src, itemName, 1, itemMeta)
    if not canCarry then
        notifyPlayer(src, 'Inventory vol — maak ruimte voor je camo unlock.', 'error')
        return false, 'inventory_full'
    end

    local added, err = exports.ox_inventory:AddItem(src, itemName, 1, itemMeta)
    if added then
        TriggerClientEvent('utrp_store:camoUnlocked', src, itemMeta)
        notifyPlayer(src, ('Camo "%s" ontvangen — gebruik het item of je camo-menu in-game.'):format(order.productName or meta.camoId))
        return true, ('camo:' .. tostring(meta.camoId))
    end

    print(('[utrp_store] Camo AddItem mislukt (%s) item=%s speler=%s'):format(tostring(err), itemName, order.license))
    return false, err or 'add_failed'
end

RegisterCommand('koppelstore', function(source, args)
    if source == 0 then return end
    local raw = table.concat(args, ' ')
    if not raw or #raw < 4 then
        TriggerClientEvent('chat:addMessage', source, { args = { '^1Store', 'Gebruik: /koppelstore CODE (alleen de code van de website)' } })
        return
    end

    local code = string.upper(raw:gsub('/koppelstore%s*', ''):gsub('%s+', ''):sub(1, 6))

    local license = getLicense(source)
    if not license then
        TriggerClientEvent('chat:addMessage', source, { args = { '^1Store', 'Geen license gevonden.' } })
        return
    end

    local data = bridgeRequest('POST', '/api/store-bridge?action=link', {
        code = code,
        license = license,
        identifiers = getIdentifiers(source),
    })

    if data and data.ok then
        TriggerClientEvent('chat:addMessage', source, { args = { '^2Store', 'FiveM account gekoppeld aan de URP Store!' } })
    else
        local msg = (data and data.error) or 'Onbekende store API fout'
        TriggerClientEvent('chat:addMessage', source, { args = { '^1Store', 'Koppelen mislukt: ' .. msg } })
    end
end, false)

RegisterNetEvent('utrp_store:requestOpen', function()
    local src = source
    local license = getLicense(src)
    if not license then
        TriggerClientEvent('chat:addMessage', src, { args = { '^1Store', 'Geen license gevonden.' } })
        return
    end

    local catalog = bridgeRequest('GET', '/api/store-bridge?action=catalog', nil)

    if not catalog or catalog.ok == false or catalog.maintenance then
        local msg = (catalog and catalog.error) or 'Store niet bereikbaar — controleer ApiUrl/ApiKey.'
        notifyPlayer(src, msg, 'error')
        return
    end

    if not catalog.categories then
        notifyPlayer(src, 'Store niet bereikbaar — controleer ApiUrl/ApiKey.', 'error')
        return
    end

    local profile = bridgeRequest('POST', '/api/store-bridge?action=profile', { license = license })

    TriggerClientEvent('utrp_store:openUI', src, {
        categories = catalog.categories,
        products = catalog.products,
        profile = profile or { linked = false, coins = 0 },
        storeWebUrl = Config.StoreWebUrl,
    })
end)

ESX.RegisterServerCallback('utrp_store:getProfile', function(source, cb)
    local license = getLicense(source)
    if not license then
        cb({ ok = false, error = 'Geen license' })
        return
    end
    local profile = bridgeRequest('POST', '/api/store-bridge?action=profile', { license = license })
    cb(profile or { ok = false })
end)

ESX.RegisterServerCallback('utrp_store:checkout', function(source, cb, productIds)
    local license = getLicense(source)
    if not license then
        cb({ ok = false, error = 'Geen license gevonden' })
        return
    end

    local ids = asArray(productIds)
    if #ids == 0 then
        cb({ ok = false, error = 'Winkelwagen is leeg' })
        return
    end

    local result = bridgeRequest('POST', '/api/store-bridge?action=purchase-cart', {
        license = license,
        productIds = ids,
    })

    if result and result.ok then
        cb(result)
        CreateThread(function()
            Wait(500)
            pcall(processOrders)
        end)
    else
        local err = (result and result.error) or 'Aankoop mislukt'
        notifyPlayer(source, err, 'error')
        cb({ ok = false, error = err })
    end
end)

local function processOrders()
    local data = bridgeRequest('GET', '/api/store-bridge?action=pending', nil)
    if not data or not data.orders then return 0 end

    local count = #data.orders
    if count == 0 then return 0 end

    for _, order in ipairs(data.orders) do
        local done = false
        local note = ''

        if order.productType == 'vehicle' and order.meta and order.meta.model then
            local garage = order.meta.garage
            if garage == nil or garage == '' then
                garage = (Config.GarageSystem == 'cloud-garage') and Config.DefaultGarageId or Config.DefaultGarage
            end
            local ok, result = pcall(giveVehicle, order.license, order.meta.model, garage)
            if ok and result then
                done = true
                note = 'plate:' .. result
                print(('[utrp_store] Voertuig %s -> %s (%s)'):format(order.meta.model, order.license, result))
            else
                done = false
                note = 'db_error'
                print(('[utrp_store] Garage insert mislukt order %s — %s'):format(order.id, tostring(result)))
            end
        elseif order.productType == 'weapon_camo' then
            local ok, resultNote = giveWeaponCamo(order)
            if ok then
                done = true
                note = resultNote
                print(('[utrp_store] Camo %s -> %s'):format(order.productName or '?', order.license))
            elseif resultNote == 'player_offline' then
                done = false
                note = 'waiting_online'
            else
                done = false
                note = resultNote
                print(('[utrp_store] Camo mislukt (%s) order %s'):format(resultNote, order.id))
            end
        elseif order.productType == 'item' or (order.meta and (order.meta.item or order.meta.oxItem)) then
            local ok, resultNote = giveStoreItem(order)
            if ok then
                done = true
                note = resultNote
                print(('[utrp_store] Item %s -> %s'):format(order.productName or '?', order.license))
            elseif resultNote == 'player_offline' then
                done = false
                note = 'waiting_online'
                -- order blijft pending tot speler online is
            else
                done = false
                note = resultNote
                print(('[utrp_store] Item mislukt (%s) order %s'):format(resultNote, order.id))
            end
        else
            done = true
            note = 'non_fulfillment_ack'
        end

        if done or note == 'waiting_online' then
            if note == 'waiting_online' then
                -- niet completen — opnieuw proberen bij volgende sync
            else
                bridgeRequest('POST', '/api/store-bridge?action=complete', {
                    orderId = order.id,
                    status = done and 'done' or 'failed',
                    note = note,
                })
            end
        else
            bridgeRequest('POST', '/api/store-bridge?action=complete', {
                orderId = order.id,
                status = 'failed',
                note = note,
            })
        end
    end

    return count
end

CreateThread(function()
    Wait(8000)
    pcall(processOrders)
    while true do
        local pending = 0
        local ok, err = pcall(function()
            pending = processOrders() or 0
        end)
        if not ok then
            print('[utrp_store] processOrders error: ' .. tostring(err))
        end
        local delay = pending > 0 and (Config.FastSyncSeconds or 3) or (Config.SyncIntervalSeconds or 5)
        Wait(delay * 1000)
    end
end)

CreateThread(function()
    Wait(3000)
    if Config.ApiKey == '' then
        print('^1[utrp_store] WAARSCHUWING: ApiKey is leeg — zet urp_store_api_key in server.cfg^0')
    end
    local key = Config.ApiKey or ''
    local preview = #key >= 8 and (key:sub(1, 4) .. '...' .. key:sub(-4)) or '(leeg)'
    print(('[utrp_store] Bridge URL: %s'):format(Config.ApiUrl:gsub('/+$', '')))
    print(('[utrp_store] ApiKey in gebruik: %s (%d tekens)'):format(preview, #key))
    local health = bridgeRequest('GET', '/api/store-bridge?action=health', nil)
    if health and health.ok then
        print(('[utrp_store] Bridge OK — pending orders: %s'):format(tostring(health.pending or 0)))
    else
        local err = health and health.error or 'geen antwoord'
        print(('[utrp_store] ^1Bridge FOUT — %s^0'):format(err))
        print('[utrp_store] ^1Fix: server.cfg → set urp_store_api_url + set urp_store_api_key (zelfde als Vercel)^0')
    end
end)

RegisterCommand('storebridge', function(source)
    if source ~= 0 then return end
    local health = bridgeRequest('GET', '/api/store-bridge?action=health', nil)
    if health and health.ok then
        print(('[utrp_store] OK — pending: %s'):format(tostring(health.pending or 0)))
    else
        print(('[utrp_store] FOUT — %s'):format(health and health.error or 'geen antwoord'))
    end
end, true)
