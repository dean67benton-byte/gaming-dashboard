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

async function call<T>(path: string): Promise<T | null> {
  const res = await fetch(`${API}${path}`, { next: { revalidate: 3600 } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`OverFast ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export async function getSummary(battletag: string) {
  if (isDemo()) return demoOwSummary;
  return call<OwSummary>(`/players/${encodeURIComponent(playerId(battletag))}/summary`);
}

export async function getCompetitiveStats(battletag: string) {
  if (isDemo()) return demoOwStats;
  return call<OwStats>(
    `/players/${encodeURIComponent(playerId(battletag))}/stats/summary?gamemode=competitive&platform=pc`,
  );
}

export async function getHeroes(): Promise<HeroInfo[]> {
  if (isDemo()) return demoOwHeroes;
  return (await call<HeroInfo[]>("/heroes")) ?? [];
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
