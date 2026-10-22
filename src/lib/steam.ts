import { demoOwnedGames, demoProfile, demoRecentGames } from "./demo-data";

const API = "https://api.steampowered.com";

export type SteamProfile = {
  steamid: string;
  personaname: string;
  avatarfull: string;
  profileurl: string;
  communityvisibilitystate: number;
};

export type OwnedGame = {
  appid: number;
  name: string;
  playtime_forever: number; // minutes
  playtime_2weeks?: number; // minutes
  img_icon_url?: string;
  rtime_last_played?: number; // unix seconds
};

export type RecentGame = {
  appid: number;
  name: string;
  playtime_2weeks: number;
  playtime_forever: number;
};

export const isDemo = () => process.env.DEMO_MODE === "1" || !process.env.STEAM_API_KEY;

async function call<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${API}/${path}`);
  url.searchParams.set("key", process.env.STEAM_API_KEY ?? "");
  url.searchParams.set("format", "json");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  // Steam data changes slowly; cache for 10 minutes.
  const res = await fetch(url, { next: { revalidate: 600 } });
  if (!res.ok) throw new Error(`Steam API ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export async function getProfile(steamid: string): Promise<SteamProfile | null> {
  if (isDemo()) return demoProfile;
  const data = await call<{ response: { players: SteamProfile[] } }>(
    "ISteamUser/GetPlayerSummaries/v2/",
    { steamids: steamid },
  );
  return data.response.players[0] ?? null;
}

export async function getOwnedGames(steamid: string): Promise<OwnedGame[]> {
  if (isDemo()) return demoOwnedGames;
  const data = await call<{ response: { games?: OwnedGame[] } }>(
    "IPlayerService/GetOwnedGames/v1/",
    { steamid, include_appinfo: "1", include_played_free_games: "1" },
  );
  return data.response.games ?? [];
}

export async function getRecentGames(steamid: string): Promise<RecentGame[]> {
  if (isDemo()) return demoRecentGames;
  const data = await call<{ response: { games?: RecentGame[] } }>(
    "IPlayerService/GetRecentlyPlayedGames/v1/",
    { steamid },
  );
  return data.response.games ?? [];
}

export const headerImage = (appid: number) =>
  `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${appid}/header.jpg`;

/**
 * Newer games keep their art under a hashed path, so ask the store for the
 * real URL and fall back to the classic path if that fails.
 */
export async function getHeaderImage(appid: number): Promise<string> {
  if (isDemo()) return headerImage(appid);
  try {
    const res = await fetch(`https://store.steampowered.com/api/appdetails?appids=${appid}&filters=basic`, {
      next: { revalidate: 86400 },
    });
    const data = (await res.json()) as Record<string, { success: boolean; data?: { header_image?: string } }>;
    return data[appid]?.data?.header_image ?? headerImage(appid);
  } catch {
    return headerImage(appid);
  }
}

export const hours = (minutes: number) => Math.round((minutes / 60) * 10) / 10;
