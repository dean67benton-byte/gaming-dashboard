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
  heroDetail: Record<string, HeroSheet>;
};

/** A hero's full in-game stat sheet (Statistics tab). Per-10 values are per 10 minutes. */
export type HeroSheet = Partial<Record<Metric, number>> & {
  gamesPlayed: number;
  gamesLost: number;
  assists10?: number;
  heroSpecific?: Record<string, string>;
  [stat: string]: number | Record<string, string> | undefined;
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

export type ImportedHeroRow = { name: string; gamesPlayed?: number; sheet?: HeroSheet; grade?: Grade | null } & Partial<Record<Metric, number>>;

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
  // A full stat sheet beats the top-9 lists, so its numbers win.
  for (const [name, sheet] of Object.entries(season.heroDetail)) {
    const row = rows.get(name) ?? { name };
    for (const [k, v] of Object.entries(sheet)) if (typeof v === "number") (row as Record<string, unknown>)[k] = v;
    row.sheet = sheet;
    rows.set(name, row);
  }
  return [...rows.values()].sort((a, b) => (b.minutes ?? 0) - (a.minutes ?? 0) || (b.gamesWon ?? 0) - (a.gamesWon ?? 0));
}

/**
 * Grades each full hero sheet against your OverFast numbers for that hero's
 * role, the same way the live hero grades work.
 */
export function gradeSheets(rows: ImportedHeroRow[], stats: OwStats | null, heroes: HeroInfo[]): ImportedHeroRow[] {
  const find = heroLookup(heroes);
  return rows.map((row) => {
    const s = row.sheet;
    const general = stats?.general;
    if (!s || !general) return row;
    const role = find(row.name)?.role;
    const base: StatBlock = (role && stats.roles?.[role]) || general;
    const line = {
      winrate: s.winrate ?? 0,
      games_played: s.gamesPlayed,
      average: {
        eliminations: s.eliminations10 ?? NaN,
        assists: s.assists10 ?? NaN,
        deaths: s.deaths10 ?? NaN,
        damage: s.damage10 ?? NaN,
        healing: s.healing10 ?? NaN,
      },
    };
    return { ...row, grade: grade(line, base) };
  });
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

  // Same hero, both seasons, with full sheets: call out big swings.
  if (current && previous) {
    for (const [name, now] of Object.entries(current.heroDetail)) {
      const before = previous.heroDetail[name];
      if (!before || now.winrate === undefined || before.winrate === undefined || now.gamesPlayed < 4 || before.gamesPlayed < 4) continue;
      const drop = before.winrate - now.winrate;
      if (drop >= 20) {
        avoid.push(
          `${name} fell from ${before.winrate}% (${before.gamesPlayed} games) last season to ${now.winrate}% (${now.gamesPlayed} games) now, with deaths up from ${before.deaths10} to ${now.deaths10} per 10 min.`,
        );
      }
    }
    for (const [name, s] of Object.entries(previous.heroDetail)) {
      if (s.gamesPlayed >= 5 && (s.winrate ?? 100) < 50) {
        avoid.push(`${name} won ${s.winrate}% over ${s.gamesPlayed} games last season. Keep it for quick play until it improves.`);
      }
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
    row.gamesPlayed !== undefined && `${row.sheet ? "" : "~"}${row.gamesPlayed} games`,
    row.winrate !== undefined && `${row.winrate}% win`,
    row.eliminations10 !== undefined && `${row.eliminations10} elims/10`,
    row.deaths10 !== undefined && `${row.deaths10} deaths/10`,
    row.damage10 !== undefined && `${row.damage10} dmg/10`,
    row.healing10 !== undefined && `${row.healing10} heal/10`,
    row.accuracy !== undefined && `${row.accuracy}% accuracy`,
    ...Object.entries(row.sheet?.heroSpecific ?? {}).map(([k, v]) => `${k} ${v}`),
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
