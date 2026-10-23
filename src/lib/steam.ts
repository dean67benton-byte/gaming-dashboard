import { demoOwnedGames, demoProfile, demoRecentGames } from "./demo-data";
import { demoFriendGames, demoFriends, demoStoreInfo } from "./demo-friends";

const API = "https://api.steampowered.com";

export type SteamProfile = {
  steamid: string;
  personaname: string;
  avatarfull: string;
  profileurl: string;
  communityvisibilitystate: number;
  personastate?: number; // 0 offline, 1+ online/away/busy
  gameextrainfo?: string; // name of the game they're in right now
  gameid?: string;
  lastlogoff?: number; // unix seconds
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

export type StoreInfo = {
  headerImage: string;
  isFree: boolean;
  categories: number[]; // Steam store category ids, see MULTIPLAYER below
};

// Steam store category ids.
export const CATEGORY = { multiplayer: 1, coop: 9, onlineCoop: 38, splitCoop: 39, pvp: 49, onlinePvp: 36, splitPvp: 37, mmo: 20 } as const;
const MULTIPLAYER: number[] = Object.values(CATEGORY);
export const isMultiplayer = (info: StoreInfo) => info.categories.some((c) => MULTIPLAYER.includes(c));
export const isCoop = (info: StoreInfo) =>
  info.categories.some((c) => c === CATEGORY.coop || c === CATEGORY.onlineCoop || c === CATEGORY.splitCoop);

/**
 * Store details: header art, free-to-play and multiplayer/co-op categories.
 * Newer games keep their art under a hashed path, so this is also where the
 * real art URL comes from. Falls back to the classic path if the store fails.
 */
export async function getStoreInfo(appid: number): Promise<StoreInfo> {
  const fallback = { headerImage: headerImage(appid), isFree: false, categories: [] };
  if (isDemo()) return demoStoreInfo[appid] ?? fallback;
  try {
    const res = await fetch(`https://store.steampowered.com/api/appdetails?appids=${appid}&filters=basic,categories`, {
      next: { revalidate: 86400 },
    });
    const data = (await res.json()) as Record<
      string,
      { success: boolean; data?: { header_image?: string; is_free?: boolean; categories?: { id: number }[] } }
    >;
    const d = data[appid]?.data;
    if (!d) return fallback;
    return {
      headerImage: d.header_image ?? fallback.headerImage,
      isFree: !!d.is_free,
      categories: (d.categories ?? []).map((c) => c.id),
    };
  } catch {
    return fallback;
  }
}

export const getHeaderImage = async (appid: number) => (await getStoreInfo(appid)).headerImage;

/** Profiles for up to any number of SteamIDs (Steam takes 100 per call). */
export async function getProfiles(steamids: string[]): Promise<SteamProfile[]> {
  const chunks: string[][] = [];
  for (let i = 0; i < steamids.length; i += 100) chunks.push(steamids.slice(i, i + 100));
  const pages = await Promise.all(
    chunks.map((ids) =>
      call<{ response: { players: SteamProfile[] } }>("ISteamUser/GetPlayerSummaries/v2/", { steamids: ids.join(",") }),
    ),
  );
  return pages.flatMap((p) => p.response.players);
}

/** Friends with their profiles, or null when the friends list is private. */
export async function getFriends(steamid: string): Promise<SteamProfile[] | null> {
  if (isDemo()) return demoFriends;
  try {
    const data = await call<{ friendslist?: { friends: { steamid: string }[] } }>("ISteamUser/GetFriendList/v1/", {
      steamid,
      relationship: "friend",
    });
    const ids = data.friendslist?.friends.map((f) => f.steamid) ?? [];
    return ids.length ? await getProfiles(ids) : [];
  } catch {
    // Steam answers 401 for a private friends list.
    return null;
  }
}

/** A friend's library, or null when their game details are private. */
export async function getFriendGames(steamid: string): Promise<OwnedGame[] | null> {
  if (isDemo()) return demoFriendGames[steamid] ?? null;
  const data = await call<{ response: { games?: OwnedGame[] } }>("IPlayerService/GetOwnedGames/v1/", {
    steamid,
    include_appinfo: "1",
    include_played_free_games: "1",
  });
  return data.response.games ?? null;
}

export const hours = (minutes: number) => Math.round((minutes / 60) * 10) / 10;
