import type { OwnedGame, RecentGame, SteamProfile } from "./steam";

// Sample data so the dashboard renders before a Steam API key is set.
// Hours for the competitive games match Dean's real totals.

export const demoProfile: SteamProfile = {
  steamid: "demo",
  personaname: "Demo Player",
  avatarfull: "",
  profileurl: "https://steamcommunity.com",
  communityvisibilitystate: 3,
};

const daysAgo = (d: number) => Math.floor(Date.now() / 1000) - d * 86400;

export const demoOwnedGames: OwnedGame[] = [
  { appid: 2357570, name: "Overwatch 2", playtime_forever: 12468, playtime_2weeks: 840, rtime_last_played: daysAgo(1) },
  { appid: 730, name: "Counter-Strike 2", playtime_forever: 54576, playtime_2weeks: 180, rtime_last_played: daysAgo(4) },
  { appid: 359550, name: "Tom Clancy's Rainbow Six Siege", playtime_forever: 95586, rtime_last_played: Math.floor(new Date("2026-08-11").getTime() / 1000) },
  { appid: 1086940, name: "Baldur's Gate 3", playtime_forever: 7320, rtime_last_played: daysAgo(60) },
  { appid: 1245620, name: "ELDEN RING", playtime_forever: 5400, rtime_last_played: daysAgo(120) },
  { appid: 553850, name: "HELLDIVERS 2", playtime_forever: 3120, rtime_last_played: daysAgo(30) },
  { appid: 1172470, name: "Apex Legends", playtime_forever: 2280, rtime_last_played: daysAgo(200) },
  { appid: 413150, name: "Stardew Valley", playtime_forever: 1500, rtime_last_played: daysAgo(300) },
  { appid: 105600, name: "Terraria", playtime_forever: 960, rtime_last_played: daysAgo(400) },
  { appid: 1966720, name: "Lethal Company", playtime_forever: 600, rtime_last_played: daysAgo(150) },
  { appid: 892970, name: "Valheim", playtime_forever: 0 },
];

export const demoRecentGames: RecentGame[] = demoOwnedGames
  .filter((g) => g.playtime_2weeks)
  .map((g) => ({
    appid: g.appid,
    name: g.name,
    playtime_2weeks: g.playtime_2weeks!,
    playtime_forever: g.playtime_forever,
  }));
