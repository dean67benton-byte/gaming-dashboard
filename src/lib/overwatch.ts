import { demoOwHeroes, demoOwStats, demoOwSummary } from "./demo-overwatch";
import { isDemo } from "./steam";

// OverFast is an unofficial API that reads public Blizzard career profiles.
// https://overfast-api.tekrop.fr
const API = "https://overfast-api.tekrop.fr";

export const ROLES = ["tank", "damage", "support"] as const;
export type Role = (typeof ROLES)[number];

export type RankInfo = {
  division: string; // "bronze" … "champion"
  tier: number; // 1 (best) … 5
  rank_icon?: string;
} | null;

export type OwSummary = {
  username: string;
  avatar?: string | null;
  namecard?: string | null;
  title?: string | null;
  endorsement?: { level: number } | null;
  competitive?: {
    pc?: ({ season?: number } & Partial<Record<Role | "open", RankInfo>>) | null;
  } | null;
  privacy?: "public" | "private";
};

export type StatBlock = {
  games_played: number;
  games_won: number;
  games_lost: number;
  time_played: number; // seconds
  winrate: number; // 0–100
  kda: number;
  total: { eliminations: number; assists: number; deaths: number; damage: number; healing: number };
  average: { eliminations: number; assists: number; deaths: number; damage: number; healing: number }; // per 10 min
};

export type OwStats = {
  general?: StatBlock;
  roles?: Partial<Record<Role, StatBlock>>;
  heroes?: Record<string, StatBlock>;
};

export type HeroInfo = { key: string; name: string; portrait: string; role: Role };

/** "RIOTAtlas#1518" → "RIOTAtlas-1518" */
export const playerId = (battletag: string) => battletag.replace(/\s+/g, "").replace("#", "-");

async function call<T>(path: string, revalidate = 3600): Promise<T | null> {
  const res = await fetch(`${API}${path}`, { next: { revalidate } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`OverFast ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

type SearchResult = { player_id: string; name: string; is_public?: boolean };

/**
 * Finds the OverFast player id for a BattleTag. Most profiles live at
 * "Name-1234", but some (often Steam-linked accounts) use a different id,
 * so fall back to a name search.
 */
export async function resolvePlayerId(battletag: string): Promise<string | null> {
  if (isDemo()) return "demo";
  // A career id copied from the Blizzard profile URL (no "#") is used as is.
  if (!battletag.includes("#")) return decodeURIComponent(battletag.trim());
  const direct = playerId(battletag);
  if (await call<OwSummary>(`/players/${encodeURIComponent(direct)}/summary`)) return direct;

  const [name] = battletag.replace(/\s+/g, "").split("#");
  const search = await call<{ results: SearchResult[] }>(`/players?name=${encodeURIComponent(name)}`);
  const results = search?.results ?? [];
  const wanted = battletag.replace(/\s+/g, "").toLowerCase();
  const match =
    results.find((r) => r.name.toLowerCase() === wanted) ??
    (results.length === 1 ? results[0] : undefined);
  return match?.player_id ?? null;
}

export async function getSummary(id: string) {
  if (isDemo()) return demoOwSummary;
  return call<OwSummary>(`/players/${encodeURIComponent(id)}/summary`);
}

// Blizzard's public profile only tracks Quick Play and Competitive; "all" is both combined.
export const MODES = { competitive: "Competitive", quickplay: "Quick Play", all: "All modes" } as const;
export type Mode = keyof typeof MODES;
export const toMode = (v?: string): Mode => (v && v in MODES ? (v as Mode) : "competitive");

export async function getStats(id: string, mode: Mode) {
  if (isDemo()) return demoOwStats;
  const gamemode = mode === "all" ? "" : `gamemode=${mode}&`;
  return call<OwStats>(`/players/${encodeURIComponent(id)}/stats/summary?${gamemode}platform=pc`);
}

export const getCompetitiveStats = (id: string) => getStats(id, "competitive");

// Hero list, art and maps are public, so they load in demo mode too.
export async function getHeroes(): Promise<HeroInfo[]> {
  try {
    const heroes = await call<HeroInfo[]>("/heroes", 86400);
    if (heroes?.length) return heroes;
  } catch {}
  return isDemo() ? demoOwHeroes : [];
}

type HeroDetail = { backgrounds?: { url: string; sizes: string[] }[] };

/** Large splash art for a hero, or null when there is none. */
export async function getHeroArt(key: string): Promise<string | null> {
  try {
    const hero = await call<HeroDetail>(`/heroes/${encodeURIComponent(key)}`, 86400);
    const bgs = hero?.backgrounds ?? [];
    return (bgs.find((b) => b.sizes.includes("md")) ?? bgs[0])?.url ?? null;
  } catch {
    return null;
  }
}

export type OwMap = { key: string; name: string; screenshot: string; gamemodes: string[]; location?: string };
const COMP_MODES = ["escort", "hybrid", "push", "control", "flashpoint"];

/** A competitive map for the page backdrop, changing once a day. */
export async function getMapOfTheDay(): Promise<OwMap | null> {
  try {
    const maps = ((await call<OwMap[]>("/maps", 86400)) ?? []).filter((m) => m.gamemodes.some((g) => COMP_MODES.includes(g)));
    return maps.length ? maps[Math.floor(Date.now() / 86_400_000) % maps.length] : null;
  } catch {
    return null;
  }
}

// Heroes with fewer games than this are too noisy to call strengths or weaknesses.
export const MIN_GAMES = 5;

export type HeroRow = StatBlock & { key: string; name: string; role: Role | null; portrait?: string };

export function heroRows(stats: OwStats, heroes: HeroInfo[]): HeroRow[] {
  const info = new Map(heroes.map((h) => [h.key, h]));
  return Object.entries(stats.heroes ?? {})
    .map(([key, s]) => ({
      ...s,
      key,
      name: info.get(key)?.name ?? key,
      role: info.get(key)?.role ?? null,
      portrait: info.get(key)?.portrait,
    }))
    .sort((a, b) => b.time_played - a.time_played);
}

/** Best and worst heroes by win rate, among those with enough games. */
export function strengths(rows: HeroRow[]) {
  const qualified = rows.filter((r) => r.games_played >= MIN_GAMES);
  const byWinrate = [...qualified].sort((a, b) => b.winrate - a.winrate);
  return {
    best: byWinrate.slice(0, 3),
    worst: byWinrate.slice(-3).reverse().filter((r) => !byWinrate.slice(0, 3).includes(r)),
  };
}

export const formatRank = (r: RankInfo) =>
  r ? `${r.division[0].toUpperCase()}${r.division.slice(1)} ${r.tier}` : "Unranked";

export const hoursFromSeconds = (s: number) => Math.round((s / 3600) * 10) / 10;
