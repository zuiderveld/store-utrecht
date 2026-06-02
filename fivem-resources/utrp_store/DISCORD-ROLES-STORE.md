# Discord rol producten (store)

Koop een product → speler krijgt automatisch een **Discord rol** via de store-bot.

## Admin: product aanmaken

1. `/admin.html` → **Producten**
2. Type: **Discord rol**
3. Vul in:

| Veld | Voorbeeld |
|------|-----------|
| Naam | `67dance` |
| Prijs | `500` coins |
| **Discord rol-ID** | `1234567890123456789` |
| Rol naam (optioneel) | `67dance` (alleen label) |

**Rol-ID vinden:** Discord → Instellingen → Geavanceerd → Ontwikkelaarsmodus → rechtsklik op de rol → ID kopiëren.

## Voorbeeld: 67dance

```
Naam:     67dance Pack
Type:     discord_role
Prijs:    250
Rol-ID:   <ID van jullie 67dance rol op Discord>
```

## Wat de speler nodig heeft

- Ingelogd op de store met **Discord**
- FiveM gekoppeld (zelfde als andere producten)
- Lid van URP Discord (`1416816652644909109`)

Na aankoop: rol direct op Discord (geen in-game actie).

## Bot vereisten (Vercel)

- `DISCORD_BOT_TOKEN` — zelfde bot als staff/store
- `DISCORD_GUILD_ID=1416816652644909109`
- Bot-rol **boven** de rol die je wilt geven
- Bot permissie: **Manage Roles**

## Fouten

| Probleem | Oplossing |
|----------|-----------|
| Rol niet ontvangen | Speler op Discord server? |
| HTTP 403 | Bot-rol hoger zetten in Discord |
| Order failed + coins terug | Discord niet gekoppeld of niet op server |

## Technisch

- Type: `discord_role`
- Meta: `discordRoleId` (verplicht)
- Afhandeling: **Vercel API** (niet FiveM)
- Bij mislukking (niet op server): coins worden teruggegeven
