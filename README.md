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
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Optional. Free Upstash Redis (Vercel → Storage → Upstash for Redis) for tracking and grading recent sessions. Added automatically when you connect it in Vercel |
| `CRON_SECRET` | Optional. Protects the daily snapshot cron |
| `STEAM_COUNTRY` | Optional. Two-letter store region for Deals prices, e.g. `GB`. Defaults to `US` |

Without `STEAM_API_KEY` the app runs in demo mode automatically.

Your Steam profile's **Game details** must be Public, or Steam returns no games. The Friends tab also needs your **Friends list** to be Public, and only compares libraries with friends whose game details are Public. Star a friend to pin them as a favorite; favorites are saved in Redis when it's connected (so they sync across devices), otherwise in a browser cookie.

## Deals

The Deals tab shows your Steam wishlist with current discounts (it follows your **Game details** privacy setting), sales and top sellers ranked against your taste, and Epic's weekly free games. Your taste is the Steam tags of your most played games, weighted by hours and recent play. Picks are ranked on how well their tags match it and on their reviews, with small review counts pulled toward average so a game needs a few hundred reviews to rank high. All of it uses Steam's and Epic's free public store endpoints; no extra keys.

## Patch watch

The Coaching tab calls out recent patch changes to your most played picks, and shows nothing when none of them were touched. It covers games you've played in the last 30 days and patches from the same window. Overwatch changes come from Blizzard's official patch notes page, matched against your top 5 heroes by time played. CS2 changes come from Valve's update posts on the Steam news feed, matched against your top weapons by kills and maps by rounds played (from Steam's CS2 stats, so **Game details** must be Public). Each line is tagged as a buff or nerf from its wording (for example a longer cooldown or a bigger hitbox is a nerf). Siege isn't covered yet. Everything is free and needs no extra keys.

## Grades

Heroes, roles and sessions get a letter (S, A, B, C, D, F) from comparing them with your own normal: a hero against your other heroes in the same role, a role against your overall stats, and a session against your career numbers on the heroes you played. B means you played like you usually do.

Blizzard doesn't publish match history, so sessions come from snapshots of your career totals, saved when you open the Overwatch page and once a day by a Vercel cron.

## Roadmap

1. Steam foundation: library, hours, recently played
2. Game deep dives (Overwatch, then CS2, then Siege) with AI coaching
3. Friends: shared games, "what should we play", free co-op picks, strat roulette
4. Recommendations and deals: Steam picks and sales, Epic free-games tracker
