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
            p:resolve({ ok = false, error = err })
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
    if Config.ApiKey == 'grp-bridge-change-me' or Config.ApiKey == '' then
        print('^1[utrp_store] WAARSCHUWING: ApiKey is nog de placeholder — koppel niet met Vercel STORE_BRIDGE_API_KEY^0')
    end
    print(('[utrp_store] Bridge URL: %s'):format(Config.ApiUrl:gsub('/+$', '')))
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
