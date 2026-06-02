Config = {}

-- MOET hetzelfde zijn als je live store-URL (waar je op de website inlogt)
Config.ApiUrl = 'https://store-utrecht.vercel.app'
-- Config.ApiUrl = 'https://store.utrechtroleplay.eu'  -- later eigen domein

-- MOET exact gelijk zijn aan STORE_BRIDGE_API_KEY in Vercel (niet de placeholder!)
Config.ApiKey = 'grp-bridge-change-me'

Config.StoreWebUrl = 'https://store-utrecht.vercel.app'

Config.OpenCommand = 'store'
Config.SyncIntervalSeconds = 15
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
