import { grade, letterFor, type Letter } from "./grades";
import type { OwStats, StatBlock } from "./overwatch";
import { isDemo } from "./steam";

// Blizzard only publishes career totals, not match history. To follow recent
// play, we save a snapshot of the totals whenever they change; the difference
// between two snapshots is one "session" of games. Snapshots live in a free
// Upstash Redis database (Vercel → Storage → Upstash for Redis).

type Totals = [games: number, won: number, seconds: number, elims: number, assists: number, deaths: number, damage: number, healing: number];
type Snapshot = { t: number; g: Totals; h: Record<string, Totals> };

export type SessionHero = { key: string; games: number; won: number; minutes: number; letter: Letter; score: number };
export type Session = {
  start: number; // ms, previous snapshot
  end: number; // ms, this snapshot
  games: number;
  won: number;
  lost: number;
  minutes: number;
  per10: StatBlock["average"];
  letter: Letter;
  score: number;
  heroes: SessionHero[];
};

const KEEP = 60;

function redis() {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return async <T>(...command: (string | number)[]): Promise<T> => {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(command),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Redis ${command[0]} failed: ${res.status}`);
    return ((await res.json()) as { result: T }).result;
  };
}

export const trackingEnabled = () => isDemo() || !!redis();

const totals = (s: StatBlock): Totals => [
  s.games_played,
  s.games_won,
  s.time_played,
  s.total.eliminations,
  s.total.assists,
  s.total.deaths,
  s.total.damage,
  s.total.healing,
];

const toSnapshot = (stats: OwStats): Snapshot => ({
  t: Date.now(),
  g: totals(stats.general!),
  h: Object.fromEntries(Object.entries(stats.heroes ?? {}).map(([k, s]) => [k, totals(s)])),
});

/** Saves the current totals if games were played since the last snapshot. */
export async function recordSnapshot(playerId: string, stats: OwStats) {
  const call = redis();
  if (!call || !stats.general) return;
  const key = `ow:snaps:${playerId}`;
  const last = await call<string | null>("LINDEX", key, -1);
  const prev = last ? (JSON.parse(last) as Snapshot) : null;
  if (prev && prev.g[0] === stats.general.games_played) return;
  await call("RPUSH", key, JSON.stringify(toSnapshot(stats)));
  await call("LTRIM", key, -KEEP, -1);
}

/** Recent sessions, newest first, each graded against your career numbers. */
export async function getSessions(playerId: string, career: OwStats): Promise<Session[]> {
  if (isDemo()) return demoSessions(career);
  const call = redis();
  if (!call) return [];
  const raw = await call<string[]>("LRANGE", `ow:snaps:${playerId}`, 0, -1);
  const snaps = raw.map((s) => JSON.parse(s) as Snapshot);
  const sessions: Session[] = [];
  for (let i = 1; i < snaps.length; i++) {
    const s = diffSession(snaps[i - 1], snaps[i], career);
    if (s) sessions.push(s);
  }
  return sessions.reverse();
}

function block(t: Totals): StatBlock {
  const [games, won, seconds, elims, assists, deaths, damage, healing] = t;
  const per10 = (v: number) => (seconds ? (v / seconds) * 600 : 0);
  return {
    games_played: games,
    games_won: won,
    games_lost: games - won,
    time_played: seconds,
    winrate: games ? (won / games) * 100 : 0,
    kda: deaths ? (elims + assists) / deaths : elims + assists,
    total: { eliminations: elims, assists, deaths, damage, healing },
    average: { eliminations: per10(elims), assists: per10(assists), deaths: per10(deaths), damage: per10(damage), healing: per10(healing) },
  };
}

const minus = (a: Totals, b?: Totals) => a.map((v, i) => v - (b?.[i] ?? 0)) as Totals;

function diffSession(prev: Snapshot, cur: Snapshot, career: OwStats): Session | null {
  const g = block(minus(cur.g, prev.g));
  if (g.games_played <= 0) return null;

  // Grade each hero against your career on that hero, then weight by time.
  const heroes: SessionHero[] = Object.entries(cur.h)
    .map(([key, t]) => ({ key, line: block(minus(t, prev.h[key])) }))
    .filter(({ line }) => line.time_played > 60)
    .map(({ key, line }) => {
      const base = career.heroes?.[key] ?? career.general!;
      // One or two games make win rate swing wildly, so it only counts at 3+.
      const gr = grade(line, base, { withWinrate: line.games_played >= 3 });
      return { key, games: line.games_played, won: line.games_won, minutes: Math.round(line.time_played / 60), letter: gr.letter, score: gr.score };
    })
    .sort((a, b) => b.minutes - a.minutes);

  const weight = heroes.reduce((sum, h) => sum + h.minutes, 0);
  const winBonus = (g.winrate - (career.general?.winrate ?? 50)) / 50;
  const statScore = weight ? heroes.reduce((sum, h) => sum + h.score * h.minutes, 0) / weight : grade(g, career.general!).score;
  // Results matter too: blend in the session's win rate with your usual one.
  const score = Math.round(statScore * 0.75 + 100 * (1 + Math.max(-0.4, Math.min(0.4, winBonus))) * 0.25);

  return {
    start: prev.t,
    end: cur.t,
    games: g.games_played,
    won: g.games_won,
    lost: g.games_lost,
    minutes: Math.round(g.time_played / 60),
    per10: g.average,
    letter: letterFor(score),
    score,
    heroes,
  };
}

function demoSessions(career: OwStats): Session[] {
  const day = 86_400_000;
  const now = Date.now();
  const plan: [daysAgo: number, games: number, won: number, heroes: [string, number, number, number][]][] = [
    [0.2, 5, 4, [["ana", 3, 3, 1.15], ["kiriko", 2, 1, 1.05]]],
    [1.1, 4, 1, [["reinhardt", 3, 1, 0.84], ["junker-queen", 1, 0, 0.95]]],
    [2.3, 6, 3, [["ana", 4, 2, 1.0], ["lucio", 2, 1, 0.97]]],
    [4.0, 3, 2, [["junker-queen", 3, 2, 1.12]]],
    [6.2, 4, 1, [["soldier-76", 2, 0, 0.82], ["tracer", 2, 1, 0.8]]],
  ];
  return plan.map(([ago, games, won, hs]) => {
    const heroes: SessionHero[] = hs.map(([key, g, w, f]) => {
      const score = Math.round(f * 100);
      return { key, games: g, won: w, minutes: g * 11, letter: letterFor(score), score };
    });
    const minutes = heroes.reduce((sum, h) => sum + h.minutes, 0);
    const statScore = heroes.reduce((sum, h) => sum + h.score * h.minutes, 0) / minutes;
    const winBonus = ((won / games) * 100 - (career.general?.winrate ?? 50)) / 50;
    const score = Math.round(statScore * 0.75 + 100 * (1 + Math.max(-0.4, Math.min(0.4, winBonus))) * 0.25);
    const f = statScore / 100;
    const avg = career.general!.average;
    return {
      start: now - ago * day - 3 * 3_600_000,
      end: now - ago * day,
      games,
      won,
      lost: games - won,
      minutes,
      per10: { ...avg, eliminations: avg.eliminations * f, deaths: avg.deaths / f, damage: avg.damage * f },
      letter: letterFor(score),
      score,
      heroes,
    };
  });
}
