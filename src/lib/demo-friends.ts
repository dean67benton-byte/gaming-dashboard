import type { OwnedGame, SteamProfile, StoreInfo } from "./steam";

// Sample friends, libraries and store categories for demo mode.

const now = Math.floor(Date.now() / 1000);
const daysAgo = (d: number) => now - d * 86400;
const art = (appid: number) => `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${appid}/header.jpg`;

const friend = (steamid: string, personaname: string, extra: Partial<SteamProfile> = {}): SteamProfile => ({
  steamid,
  personaname,
  avatarfull: "",
  profileurl: `https://steamcommunity.com/profiles/${steamid}`,
  communityvisibilitystate: 3,
  personastate: 0,
  ...extra,
});

export const demoFriends: SteamProfile[] = [
  friend("demo-1", "Vortex", { personastate: 1, gameextrainfo: "Overwatch 2", gameid: "2357570" }),
  friend("demo-2", "milkshake", { personastate: 1 }),
  friend("demo-3", "Kestrel", { personastate: 3, lastlogoff: daysAgo(0) }),
  friend("demo-4", "dumpling", { lastlogoff: daysAgo(2) }),
  friend("demo-5", "R4ZE", { lastlogoff: daysAgo(9) }),
  friend("demo-7", "Jerry", { lastlogoff: daysAgo(5) }),
  friend("demo-6", "private_pat", { lastlogoff: daysAgo(30), communityvisibilitystate: 1 }),
];

const g = (appid: number, name: string, h: number, lastDays?: number, h2w = 0): OwnedGame => ({
  appid,
  name,
  playtime_forever: Math.round(h * 60),
  playtime_2weeks: h2w ? Math.round(h2w * 60) : undefined,
  rtime_last_played: lastDays === undefined ? undefined : daysAgo(lastDays),
});

export const demoFriendGames: Record<string, OwnedGame[] | null> = {
  "demo-1": [
    g(2357570, "Overwatch 2", 640, 0, 22),
    g(730, "Counter-Strike 2", 1210, 3, 6),
    g(553850, "HELLDIVERS 2", 88, 20),
    g(1172470, "Apex Legends", 310, 90),
    g(570, "Dota 2", 45, 400),
    g(548430, "Deep Rock Galactic", 0),
  ],
  "demo-2": [
    g(413150, "Stardew Valley", 180, 5, 9),
    g(105600, "Terraria", 240, 40),
    g(1966720, "Lethal Company", 35, 12, 3),
    g(892970, "Valheim", 60, 200),
    g(1426210, "It Takes Two", 14, 300),
    g(739630, "Phasmophobia", 22, 60),
    g(553850, "HELLDIVERS 2", 3, 100),
  ],
  "demo-3": [
    g(359550, "Tom Clancy's Rainbow Six Siege", 2100, 6, 12),
    g(730, "Counter-Strike 2", 400, 30),
    g(2357570, "Overwatch 2", 12, 150),
    g(1245620, "ELDEN RING", 160, 45),
    g(252490, "Rust", 520, 1, 15),
  ],
  "demo-4": [
    g(1086940, "Baldur's Gate 3", 210, 8, 4),
    g(553850, "HELLDIVERS 2", 140, 2, 10),
    g(548430, "Deep Rock Galactic", 95, 70),
    g(892970, "Valheim", 0),
    g(367520, "Hollow Knight", 60, 500),
  ],
  "demo-5": [g(730, "Counter-Strike 2", 3200, 1, 30), g(440, "Team Fortress 2", 800, 900)],
  "demo-6": null,
  "demo-7": [
    g(2357570, "Overwatch 2", 420, 5, 8),
    g(359550, "Tom Clancy's Rainbow Six Siege", 900, 80),
    g(1966720, "Lethal Company", 50, 30),
    g(548430, "Deep Rock Galactic", 130, 15),
  ],
};

const info = (appid: number, categories: number[], isFree = false): StoreInfo => ({ headerImage: art(appid), isFree, categories });

// Category ids: 1 multi-player, 9 co-op, 38 online co-op, 39 split-screen co-op, 49 PvP, 36 online PvP.
export const demoStoreInfo: Record<number, StoreInfo> = {
  2357570: info(2357570, [1, 49, 36], true),
  730: info(730, [1, 49, 36], true),
  359550: info(359550, [1, 49, 36, 9, 38]),
  1086940: info(1086940, [2, 1, 9, 38]),
  1245620: info(1245620, [2, 1, 49, 36, 9, 38]),
  553850: info(553850, [1, 9, 38]),
  1172470: info(1172470, [1, 49, 36, 9, 38], true),
  413150: info(413150, [2, 1, 9, 38, 39]),
  105600: info(105600, [2, 1, 49, 36, 9, 38]),
  1966720: info(1966720, [1, 9, 38]),
  892970: info(892970, [1, 9, 38]),
  1426210: info(1426210, [1, 9, 38, 39]),
  739630: info(739630, [2, 1, 9, 38]),
  548430: info(548430, [2, 1, 9, 38]),
  252490: info(252490, [1, 49, 36, 9, 38]),
  570: info(570, [1, 49, 36, 9], true),
  440: info(440, [1, 49, 36], true),
  367520: info(367520, [2]),
};
