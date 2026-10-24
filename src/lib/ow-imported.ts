import raw from "@/data/ow-imported.json";
import type { Tips } from "./coach";
import { grade, type Grade } from "./grades";
import { formatRank, ROLES, type HeroInfo, type OwStats, type RankInfo, type Role, type StatBlock } from "./overwatch";

// Stats read by hand from in-game career screenshots. Blizzard's public
// profile (and so OverFast) only has recent totals, so this fills in older
// seasons and match reports. The in-game hero comparison only lists the top 9
// heroes per stat, so a missing value means "not in the top 9", not zero.

export type Metric =
  | "minutes"
  | "gamesWon"
  | "winrate"
  | "accuracy"
  | "elimsPerLife"
  | "killStreakBest"
  | "multikillBest"
  | "eliminations10"
  | "deaths10"
  | "finalBlows10"
  | "soloKills10"
  | "objectiveKills10"
  | "objectiveTime10"
  | "damage10"
  | "healing10";

type RoleRanks = Record<Role, NonNullable<RankInfo>>;

export type ImportedSeason = {
  id: string;
  label: string;
  ranks: RoleRanks;
  seasonHigh: RoleRanks;
  gamesWon: Record<Role | "open", number>;
  leaderboards: Partial<Record<Metric, Record<string, number>>>;
  heroDetail: Record<string, Record<string, number | Record<string, string>>>;
};

export type ImportedMatch = {
  map: string;
  date: string; // local time as shown in game; date only when the time is unknown
  mode: string;
  length: string;
  result: "win" | "loss";
  score: string;
  heroes: { name: string; share: number; time: string }[];
  eliminations?: number;
  assists?: number;
  deaths?: number;
  per10?: { eliminations: number; assists: number; deaths: number };
};

export type OwImported = {
  source: string;
  capturedAt: string;
  player: string;
  level: number;
  hoursByMode: Record<string, number>;
  seasons: ImportedSeason[];
  matches: ImportedMatch[];
};

export const imported = raw as unknown as OwImported;

const norm = (name: string) => name.toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "");

/** Looks up OverFast hero info (portrait, role) by display name. */
export function heroLookup(heroes: HeroInfo[]) {
  const byName = new Map(heroes.map((h) => [norm(h.name), h]));
  return (name: string) => byName.get(norm(name));
}

export type ImportedHeroRow = { name: string; gamesPlayed?: number } & Partial<Record<Metric, number>>;

/** One row per hero, joining every top-9 list the season has. */
export function seasonHeroRows(season: ImportedSeason): ImportedHeroRow[] {
  const rows = new Map<string, ImportedHeroRow>();
  for (const [metric, list] of Object.entries(season.leaderboards) as [Metric, Record<string, number>][]) {
    for (const [name, value] of Object.entries(list)) {
      const row = rows.get(name) ?? { name };
      row[metric] = value;
      rows.set(name, row);
    }
  }
  for (const row of rows.values()) {
    // Games played isn't listed, but wins ÷ win rate gives it back.
    if (row.gamesWon && row.winrate) row.gamesPlayed = Math.round(row.gamesWon / (row.winrate / 100));
  }
  return [...rows.values()].sort((a, b) => (b.minutes ?? 0) - (a.minutes ?? 0) || (b.gamesWon ?? 0) - (a.gamesWon ?? 0));
}

export type GradedMatch = ImportedMatch & { grade: Grade | null };

/**
 * Grades each match report against your OverFast numbers for the role of the
 * hero you played most that game (or your overall numbers if unknown).
 */
export function gradeMatches(stats: OwStats | null, heroes: HeroInfo[]): GradedMatch[] {
  const find = heroLookup(heroes);
  return imported.matches.map((m) => {
    const general = stats?.general;
    if (!m.per10 || !general) return { ...m, grade: null };
    const role = m.heroes[0] ? find(m.heroes[0].name)?.role : undefined;
    const base: StatBlock = (role && stats.roles?.[role]) || general;
    const line = { winrate: 0, games_played: 1, average: { ...m.per10, damage: NaN, healing: NaN } };
    return { ...m, grade: grade(line, base, { withWinrate: false }) };
  });
}

const tierUp = (now: NonNullable<RankInfo>, before: NonNullable<RankInfo>) => before.tier - now.tier; // tier 1 is best

/** Rule-based tips from the imported seasons and match reports. */
export function importedTips(): Tips {
  const focus: string[] = [];
  const avoid: string[] = [];
  const practice: string[] = [];
  const [current, previous] = imported.seasons;

  if (current && previous) {
    for (const role of ROLES) {
      const diff = tierUp(current.ranks[role], previous.ranks[role]);
      if (diff > 0) focus.push(`${cap(role)} is climbing: ${formatRank(previous.ranks[role])} last season, ${formatRank(current.ranks[role])} now.`);
      if (diff < 0) avoid.push(`${cap(role)} slipped from ${formatRank(previous.ranks[role])} to ${formatRank(current.ranks[role])}.`);
    }
    const winners = seasonHeroRows(previous)
      .filter((h) => (h.gamesPlayed ?? 0) >= 5 && (h.winrate ?? 0) >= 60)
      .sort((a, b) => b.winrate! - a.winrate!)
      .slice(0, 3);
    if (winners.length) {
      focus.push(`Last season's winners: ${winners.map((h) => `${h.name} ${h.winrate}% (~${h.gamesPlayed} games)`).join(", ")}. Worth bringing back.`);
    }
  }

  const vendetta = current?.heroDetail.Vendetta;
  if (vendetta && typeof vendetta.deaths10 === "number" && typeof vendetta.elimsPerLife === "number") {
    practice.push(
      `Vendetta carries your season (${vendetta.winrate}% over ${vendetta.gamesPlayed} games), but you die ${vendetta.deaths10.toFixed(1)} times per 10 min for ${vendetta.elimsPerLife} elims per life. Pick your dives after enemy cooldowns are used.`,
    );
  }

  const reports = imported.matches.filter((m) => m.per10);
  const wins = reports.filter((m) => m.result === "win");
  const losses = reports.filter((m) => m.result === "loss");
  if (wins.length && losses.length) {
    const avg = (ms: ImportedMatch[]) => ms.reduce((s, m) => s + m.per10!.deaths, 0) / ms.length;
    const [dw, dl] = [avg(wins), avg(losses)];
    if (dl > dw * 1.2) {
      practice.push(`In your last ${reports.length} match reports you die ${dl.toFixed(1)} per 10 min in losses vs ${dw.toFixed(1)} in wins. Staying alive is the biggest swing.`);
    }
  }
  return { focus, avoid, practice };
}

/** Combines OverFast tips with imported ones, keeping up to five of each. */
export const mergeTips = (a: Tips, b: Tips): Tips => ({
  focus: [...a.focus, ...b.focus].slice(0, 5),
  avoid: [...a.avoid, ...b.avoid].slice(0, 5),
  practice: [...a.practice, ...b.practice].slice(0, 5),
});

const fmt = (row: ImportedHeroRow) =>
  [
    row.minutes !== undefined && `${row.minutes} min`,
    row.gamesPlayed !== undefined && `~${row.gamesPlayed} games`,
    row.winrate !== undefined && `${row.winrate}% win`,
    row.eliminations10 !== undefined && `${row.eliminations10} elims/10`,
    row.deaths10 !== undefined && `${row.deaths10} deaths/10`,
    row.damage10 !== undefined && `${row.damage10} dmg/10`,
    row.healing10 !== undefined && `${row.healing10} heal/10`,
  ]
    .filter(Boolean)
    .join(", ");

/** Extra lines for the "Copy for Claude" prompt. */
export function importedPromptLines(): string[] {
  const lines = ["", `Imported from my in-game career screens (captured ${imported.capturedAt}; per-hero lists only show the top 9 for each stat):`];
  for (const s of imported.seasons) {
    const ranks = ROLES.map((r) => `${r} ${formatRank(s.ranks[r])} (high ${formatRank(s.seasonHigh[r])}, ${s.gamesWon[r]} wins)`).join(", ");
    lines.push(`${s.label}: ${ranks}`);
    for (const row of seasonHeroRows(s).filter((r) => r.minutes !== undefined || r.gamesPlayed !== undefined).slice(0, 10)) {
      lines.push(`- ${row.name}: ${fmt(row)}`);
    }
  }
  lines.push("Recent competitive match reports (per 10 min):");
  for (const m of imported.matches) {
    const heroes = m.heroes.map((h) => `${h.name} ${h.share}%`).join(", ") || "no report";
    const per10 = m.per10 ? `, ${m.per10.eliminations} elims, ${m.per10.assists} assists, ${m.per10.deaths} deaths` : "";
    lines.push(`- ${m.date.replace("T", " ")} ${m.map} (${m.mode}) ${m.result.toUpperCase()} ${m.score}: ${heroes}${per10}`);
  }
  return lines;
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
