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
    local url = Config.ApiUrl .. path
    local payload = body and json.encode(body) or ''
    local p = promise.new()

    PerformHttpRequest(url, function(status, response)
        local ok, data = pcall(json.decode, response or '{}')
        if status ~= 200 then
            print(('[utrp_store] HTTP %s %s — %s'):format(status, path, response or ''))
            p:resolve(ok and data or { ok = false, error = 'HTTP ' .. tostring(status) })
            return
        end
        p:resolve(ok and data or nil)
    end, method, payload, {
        ['Content-Type'] = 'application/json',
        ['X-Bridge-Key'] = Config.ApiKey,
    })

    return Citizen.Await(p)
end

local function giveVehicle(license, model, garage)
    local plate = randomPlate()
    local vehicleProps = {
        model = model,
        plate = plate,
    }
    local vehicleJson = json.encode(vehicleProps)
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
        license,
        plate,
        vehicleJson,
        Config.StoredInGarage,
        parking,
    })

    return plate
end

RegisterCommand('koppelstore', function(source, args)
    if source == 0 then return end
    local code = args[1]
    if not code or #code < 4 then
        TriggerClientEvent('chat:addMessage', source, { args = { '^1Store', 'Gebruik: /koppelstore CODE (van de website)' } })
        return
    end

    local license = getLicense(source)
    if not license then
        TriggerClientEvent('chat:addMessage', source, { args = { '^1Store', 'Geen license gevonden.' } })
        return
    end

    local data = bridgeRequest('POST', '/api/store-bridge?action=link', {
        code = string.upper(code),
        license = license,
        identifiers = getIdentifiers(source),
    })

    if data and data.ok then
        TriggerClientEvent('chat:addMessage', source, { args = { '^2Store', 'FiveM account gekoppeld aan de URP Store!' } })
    else
        TriggerClientEvent('chat:addMessage', source, { args = { '^1Store', 'Koppelen mislukt — code verlopen of ongeldig.' } })
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
    local profile = bridgeRequest('POST', '/api/store-bridge?action=profile', { license = license })

    if not catalog or not catalog.categories then
        TriggerClientEvent('chat:addMessage', src, { args = { '^1Store', 'Store niet bereikbaar — controleer ApiUrl/ApiKey.' } })
        return
    end

    TriggerClientEvent('utrp_store:openUI', src, {
        categories = catalog.categories,
        products = catalog.products,
        profile = profile or { linked = false, coins = 0 },
        storeWebUrl = Config.StoreWebUrl,
        tebexUrl = Config.TebexUrl,
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

    if type(productIds) ~= 'table' or #productIds == 0 then
        cb({ ok = false, error = 'Winkelwagen is leeg' })
        return
    end

    local result = bridgeRequest('POST', '/api/store-bridge?action=purchase-cart', {
        license = license,
        productIds = productIds,
    })

    if result and result.ok then
        cb(result)
        -- Direct verwerken zodat voertuigen meteen in garage komen
        CreateThread(function()
            Wait(500)
            pcall(processOrders)
        end)
    else
        cb({ ok = false, error = (result and result.error) or 'Aankoop mislukt' })
    end
end)

local function processOrders()
    local data = bridgeRequest('GET', '/api/store-bridge?action=pending', nil)
    if not data or not data.orders then return end

    for _, order in ipairs(data.orders) do
        local done = false
        local note = ''

        if order.productType == 'vehicle' and order.meta and order.meta.model then
            local garage = order.meta.garage or Config.DefaultGarage
            local ok, plate = pcall(giveVehicle, order.license, order.meta.model, garage)
            if ok and plate then
                done = true
                note = 'plate:' .. plate
                print(('[utrp_store] Voertuig %s -> %s (%s)'):format(order.meta.model, order.license, plate))
            else
                note = 'db_error'
                print('[utrp_store] Garage insert mislukt voor order ' .. order.id)
            end
        else
            done = true
            note = 'non_vehicle_ack'
        end

        bridgeRequest('POST', '/api/store-bridge?action=complete', {
            orderId = order.id,
            status = done and 'done' or 'failed',
            note = note,
        })
    end
end

CreateThread(function()
    while true do
        Wait((Config.SyncIntervalSeconds or 15) * 1000)
        local ok, err = pcall(processOrders)
        if not ok then
            print('[utrp_store] processOrders error: ' .. tostring(err))
        end
    end
end)

CreateThread(function()
    Wait(3000)
    local health = bridgeRequest('GET', '/api/store-bridge?action=health', nil)
    if health and health.ok then
        print('[utrp_store] Bridge verbonden — pending orders: ' .. tostring(health.pending or 0))
    else
        print('[utrp_store] ^1Bridge niet bereikbaar — controleer ApiUrl en ApiKey^0')
    end
end)
