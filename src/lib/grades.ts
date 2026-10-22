import type { StatBlock } from "./overwatch";

// Grades compare a stat line with your own normal (a hero against your other
// heroes in the same role, or a session against your career on those heroes).
// A score of 100 means "played like you usually do".

export type GradePart = { label: string; value: number; baseline: number; lowerIsBetter?: boolean; score: number };
export type Grade = { letter: Letter; score: number; parts: GradePart[] };
export type Letter = "S" | "A" | "B" | "C" | "D" | "F";

const LETTERS: [number, Letter][] = [
  [118, "S"],
  [108, "A"],
  [98, "B"],
  [90, "C"],
  [82, "D"],
];

export const letterFor = (score: number): Letter => LETTERS.find(([min]) => score >= min)?.[1] ?? "F";

export const GRADE_STYLE: Record<Letter, string> = {
  S: "bg-gradient-to-br from-accent to-accent-2 text-background",
  A: "bg-good/15 text-good",
  B: "bg-sky-400/15 text-sky-300",
  C: "bg-amber-400/15 text-amber-300",
  D: "bg-orange-500/15 text-orange-400",
  F: "bg-bad/15 text-bad",
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

type Line = Pick<StatBlock, "winrate" | "games_played" | "average">;

export function grade(line: Line, base: Line, { withWinrate = true } = {}): Grade {
  const parts: GradePart[] = [];
  const ratio = (label: string, value: number, baseline: number, lowerIsBetter = false) => {
    if (!baseline || !Number.isFinite(value)) return;
    const r = lowerIsBetter ? baseline / Math.max(value, 0.1) : value / baseline;
    parts.push({ label, value, baseline, lowerIsBetter, score: clamp(r, 0.6, 1.4) });
  };

  if (withWinrate && line.games_played > 0 && base.games_played > 0) {
    // Every 5 points of win rate above your normal counts like 10% better stats.
    parts.push({ label: "Win rate", value: line.winrate, baseline: base.winrate, score: clamp(1 + (line.winrate - base.winrate) / 50, 0.6, 1.4) });
  }
  ratio("Eliminations", line.average.eliminations, base.average.eliminations);
  ratio("Deaths", line.average.deaths, base.average.deaths, true);
  ratio("Damage", line.average.damage, base.average.damage);
  if (base.average.healing >= 1500) ratio("Healing", line.average.healing, base.average.healing);
  if (base.average.assists >= 2) ratio("Assists", line.average.assists, base.average.assists);

  const score = parts.length ? Math.round((parts.reduce((sum, p) => sum + p.score, 0) / parts.length) * 100) : 100;
  return { letter: letterFor(score), score, parts };
}
