# cloud-garage — store voertuigen

De URP server gebruikt **cloud-garage** (`owned_vehicles` met `garageid`, geen `parking`).

## utrp_store config

In `config.lua`:

| Instelling | Waarde |
|------------|--------|
| `GarageSystem` | `'cloud-garage'` |
| `DefaultGarageId` | `2` (Garage Rodegarage) |
| `OwnerFormat` | `'esx'` |
| `UseParkingColumn` | niet nodig bij cloud-garage |

## Admin — voertuig product

| Veld | Voorbeeld |
|------|-----------|
| **Spawn model** (`meta.model`) | `adder`, `sultan`, … |
| **Garage ID** (`meta.garage`) | `2` — numerieke index uit cloud-garage |

Leeg laten → default garage **#2** (Rodegarage).

## Garage ID's (begin van `cloud-garage/config.lua`)

| ID | Label |
|----|-------|
| 1 | Blokkenpark Garage |
| 2 | Garage Rodegarage |
| 3 | Garage Ghost Maffia |
| 4 | Garage Scarface |

Tel verder in `Config.Locations` — de **positie in de lijst** is het ID (1-based).

## Database insert

Store schrijft:

- `owner` — ESX identifier (speler moet **online** zijn bij `OwnerFormat = 'esx'`)
- `plate`, `vehicle` (JSON met model hash), `type` = `car`
- `stored` = `1`, `pound` = `0`, `garageid` = gekozen ID

## Na deploy

1. Upload bijgewerkte `utrp_store` naar je server
2. `ensure utrp_store` of server restart
3. Test aankoop — voertuig verschijnt in cloud-garage op de gekozen locatie
