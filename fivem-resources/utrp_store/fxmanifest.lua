fx_version 'cerulean'
game 'gta5'

name 'utrp_store'
description 'Utrecht RP — website store bridge (coins, garage)'
author 'Utrecht Roleplay'
version '1.0.0'

lua54 'yes'

shared_scripts {
    'config.lua',
}

server_scripts {
    '@oxmysql/lib/MySQL.lua',
    'server/main.lua',
}
