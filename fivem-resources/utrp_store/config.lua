Config = {}

-- Live store-URL (zelfde als waar spelers inloggen op de website)
-- Overschrijf in server.cfg: set urp_store_api_url "https://jouw-store.vercel.app"
Config.ApiUrl = GetConvar('urp_store_api_url', 'https://store-utrecht.vercel.app')

-- MOET exact gelijk zijn aan STORE_BRIDGE_API_KEY in Vercel
-- Overschrijf in server.cfg: set urp_store_api_key "jouw-geheime-key"
Config.ApiKey = GetConvar('urp_store_api_key', 'grp-bridge-change-me')

Config.StoreWebUrl = GetConvar('urp_store_web_url', Config.ApiUrl)

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
