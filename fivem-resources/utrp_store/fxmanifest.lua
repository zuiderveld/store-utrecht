fx_version 'cerulean'
game 'gta5'

name 'utrp_store'
description 'Utrecht RP — website + in-game store (coins, garage, NUI)'
author 'Utrecht Roleplay'
version '2.0.0'

lua54 'yes'

dependencies {
    'es_extended',
    'oxmysql',
    'ox_inventory',
}

shared_scripts {
    'config.lua',
}

server_scripts {
    '@oxmysql/lib/MySQL.lua',
    'server/main.lua',
}

client_scripts {
    'client/main.lua',
    'client/camo.lua',
}

ui_page 'html/index.html'

files {
    'html/index.html',
    'html/css/style.css',
    'html/js/app.js',
}
