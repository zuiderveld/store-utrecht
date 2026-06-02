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
Config.DefaultGarage = 'pillboxgarage'
Config.StoredInGarage = 1

-- ESX: owned_vehicles — pas kolommen aan als jouw server afwijkt
Config.VehicleTable = 'owned_vehicles'
Config.OwnerColumn = 'owner'
Config.PlateColumn = 'plate'
Config.VehicleColumn = 'vehicle'
Config.TypeColumn = 'type'
Config.StoredColumn = 'stored'
Config.ParkingColumn = 'parking'
