Config = {}

-- Live store-URL (zelfde als waar spelers inloggen op de website)
Config.ApiUrl = GetConvar('urp_store_api_url', 'https://store-utrecht.vercel.app')

-- Zelfde waarde als STORE_BRIDGE_API_KEY in Vercel (zie server.cfg.example)
Config.ApiKey = GetConvar('urp_store_api_key', 'urp-bridge-utrecht-8Kx2mP9vQ7nR4wT6')

Config.StoreWebUrl = GetConvar('urp_store_web_url', Config.ApiUrl)

Config.OpenCommand = 'store'
Config.SyncIntervalSeconds = 5
Config.FastSyncSeconds = 3

-- Items (ox_inventory): meta.item + meta.count op product in admin
Config.UseOxInventory = true
Config.StoredInGarage = 1

-- Garage: cloud-garage (garageid) | parking (ESX parking string) | minimal (alleen stored)
-- Utrecht gebruikt cloud-garage — zie CLOUD-GARAGE-URP.md voor garage-ID's
Config.GarageSystem = 'cloud-garage'
-- Index in cloud-garage/config.lua → Config.Locations (1 = Blokkenpark, 2 = Rodegarage, …)
Config.DefaultGarageId = 2

-- Alleen bij GarageSystem = 'parking'
Config.DefaultGarage = 'pillboxgarage'
Config.UseParkingColumn = false

-- owner: 'esx' = identifier van online speler, 'license' = license:xxx, 'plain' = zonder prefix
Config.OwnerFormat = 'esx'
Config.VehicleUseHash = true

-- ESX: owned_vehicles — pas kolommen aan als jouw server afwijkt
Config.VehicleTable = 'owned_vehicles'
Config.OwnerColumn = 'owner'
Config.PlateColumn = 'plate'
Config.VehicleColumn = 'vehicle'
Config.TypeColumn = 'type'
Config.StoredColumn = 'stored'
Config.GarageIdColumn = 'garageid'
Config.PoundColumn = 'pound'
Config.ParkingColumn = 'parking'
