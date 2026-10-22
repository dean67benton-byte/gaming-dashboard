# Gaming Dashboard

A personal dashboard for everything gaming: your Steam library, hours and recently played games, with per-game stats, AI coaching, friend recommendations and strat roulette on the way.

## Setup

```bash
npm install
cp .env.example .env.local   # then fill it in
npm run dev
```

Open http://localhost:3000 and sign in through Steam.

| Variable | What it is |
| --- | --- |
| `STEAM_API_KEY` | From https://steamcommunity.com/dev/apikey (`localhost` is fine as the domain) |
| `SESSION_SECRET` | Any long random string, e.g. `openssl rand -base64 32` |
| `APP_URL` | Optional. Where the app runs; defaults to the request's own URL |
| `DEMO_MODE` | `1` shows sample data without signing in |
| `OVERWATCH_BATTLETAG` | Your BattleTag, e.g. `Name#1234`. Career profile must be public in game |
| `ANTHROPIC_API_KEY` | Turns on AI coaching. From https://console.anthropic.com |
| `ALLOWED_STEAMIDS` | Optional. Comma-separated SteamID64s allowed to use AI coaching (it costs API credits) |

Without `STEAM_API_KEY` the app runs in demo mode automatically.

Your Steam profile's **Game details** must be Public, or Steam returns no games.

## Roadmap

1. Steam foundation: library, hours, recently played
2. Game deep dives (Overwatch, then CS2, then Siege) with AI coaching
3. Friends: shared games, "what should we play", free co-op picks, strat roulette
4. Recommendations and deals: Steam picks and sales, Epic free-games tracker
