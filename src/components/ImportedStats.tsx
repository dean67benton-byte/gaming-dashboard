"use client";

import { useState } from "react";
import GradeBadge from "@/components/GradeBadge";
import Portrait from "@/components/Portrait";
import RankEmblem from "@/components/RankEmblem";
import type { GradedMatch, ImportedHeroRow, ImportedSeason, Metric } from "@/lib/ow-imported";
import { formatRank, ROLES } from "@/lib/overwatch";

const ROLE_LABEL = { tank: "Tank", damage: "Damage", support: "Support" } as const;

const COLUMNS: { key: Metric | "gamesPlayed"; label: string; fmt?: (v: number) => string }[] = [
  { key: "minutes", label: "Time", fmt: (v) => (v >= 60 ? `${Math.round(v / 60)} h` : `${v} m`) },
  { key: "gamesPlayed", label: "Games", fmt: (v) => `~${v}` },
  { key: "winrate", label: "Win", fmt: (v) => `${v}%` },
  { key: "eliminations10", label: "Elims/10" },
  { key: "deaths10", label: "Deaths/10" },
  { key: "finalBlows10", label: "Final blows/10" },
  { key: "damage10", label: "Damage/10", fmt: (v) => v.toLocaleString() },
  { key: "healing10", label: "Healing/10", fmt: (v) => v.toLocaleString() },
  { key: "objectiveKills10", label: "Obj kills/10" },
  { key: "accuracy", label: "Accuracy", fmt: (v) => `${v}%` },
];

type Props = {
  capturedAt: string;
  hoursByMode: Record<string, number>;
  seasons: (ImportedSeason & { rows: ImportedHeroRow[] })[];
  matches: GradedMatch[];
  portraits: Record<string, string | undefined>;
};

export default function ImportedStats({ capturedAt, hoursByMode, seasons, matches, portraits }: Props) {
  const [seasonId, setSeasonId] = useState(seasons[0]?.id);
  const season = seasons.find((s) => s.id === seasonId) ?? seasons[0];
  const [showAll, setShowAll] = useState(false);
  const won = matches.filter((m) => m.result === "win").length;
  // Heroes that only show up in one stat list are noise until asked for.
  const core = season?.rows.filter((r) => r.minutes !== undefined || r.gamesWon !== undefined || r.winrate !== undefined) ?? [];
  const rows = showAll ? season?.rows ?? [] : core;

  return (
    <section className="mb-4 space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">
          In-game career <span className="ml-1 rounded-md bg-accent-2/15 px-1.5 py-0.5 align-middle text-[11px] font-medium text-accent-2">Imported</span>
        </h2>
        <span className="text-xs text-muted">From your in-game screens, captured {capturedAt}. Fills in what the public profile leaves out.</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {seasons.map((s) => (
          <div key={s.id} className="card p-5">
            <div className="mb-3 flex items-baseline justify-between">
              <h3 className="font-semibold">{s.label}</h3>
              <span className="text-xs text-muted">{ROLES.reduce((sum, r) => sum + s.gamesWon[r], 0) + s.gamesWon.open} wins</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {ROLES.map((role) => (
                <div key={role} className="rounded-xl bg-surface-2 p-2.5">
                  <div className="flex items-center gap-2">
                    <RankEmblem rank={s.ranks[role]} className="hidden h-8 w-8 sm:block" />
                    <div className="min-w-0">
                      <div className="text-[11px] text-muted">{ROLE_LABEL[role]}</div>
                      <div className="truncate text-sm font-semibold">{formatRank(s.ranks[role])}</div>
                    </div>
                  </div>
                  <div className="mt-2 text-[11px] text-muted">
                    High {formatRank(s.seasonHigh[role])} · {s.gamesWon[role]} wins
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="card p-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-semibold">Match reports</h3>
          <span className="text-xs text-muted">
            {won}W {matches.length - won}L · graded against your usual numbers for that role
          </span>
        </div>
        <ul className="divide-y divide-border">
          {matches.map((m, i) => (
            <li key={i} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
              <GradeBadge letter={m.grade?.letter ?? null} score={m.grade?.score} />
              <div className="w-40">
                <div className="text-sm font-medium">{m.map}</div>
                <div className="text-xs text-muted">
                  {when(m.date)} · {m.mode} · {m.length}
                </div>
              </div>
              <div className={`w-16 text-sm font-semibold ${m.result === "win" ? "text-good" : "text-bad"}`}>
                {m.result === "win" ? "W" : "L"} {m.score}
              </div>
              <div className="flex flex-1 flex-wrap gap-2">
                {m.heroes.length ? (
                  m.heroes.map((h) => (
                    <span key={h.name} className="flex items-center gap-1.5 rounded-xl bg-surface-2 py-1 pl-1 pr-2 text-xs">
                      <Portrait src={portraits[h.name]} name={h.name} className="h-6 w-6 rounded-lg text-[9px]" />
                      {h.name}
                      <span className="text-muted">{h.share}%</span>
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-muted">No report</span>
                )}
              </div>
              {m.per10 && (
                <div className="text-right text-xs text-muted">
                  {m.eliminations}/{m.assists}/{m.deaths} E/A/D
                  <br />
                  {m.per10.eliminations.toFixed(1)} elims · {m.per10.deaths.toFixed(1)} deaths per 10
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 p-4">
          <h3 className="mr-auto font-semibold">Heroes by season</h3>
          <div className="flex gap-1 rounded-xl bg-surface-2 p-1">
            {seasons.map((s) => (
              <button
                key={s.id}
                onClick={() => setSeasonId(s.id)}
                className={`rounded-lg px-3 py-1 text-xs font-medium ${s.id === season?.id ? "bg-accent text-background" : "text-muted hover:text-foreground"}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-y border-border text-left text-[11px] uppercase tracking-wide text-muted">
                <th className="px-4 py-2 font-medium">Hero</th>
                {COLUMNS.map((c) => (
                  <th key={c.key} className="px-2 py-2 text-right font-medium">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.name} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-2">
                    <span className="flex items-center gap-2">
                      <Portrait src={portraits[row.name]} name={row.name} className="h-7 w-7 rounded-lg text-[9px]" />
                      {row.name}
                    </span>
                  </td>
                  {COLUMNS.map((c) => {
                    const v = row[c.key];
                    return (
                      <td key={c.key} className="px-2 py-2 text-right tabular-nums">
                        {v === undefined ? <span className="text-muted/50">–</span> : c.fmt ? c.fmt(v) : v.toFixed(2)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {season && season.rows.length > core.length && (
          <button onClick={() => setShowAll(!showAll)} className="mx-4 mt-3 text-xs font-medium text-accent hover:underline">
            {showAll ? "Show heroes with time or wins only" : `Show all ${season.rows.length} heroes`}
          </button>
        )}
        <p className="p-4 text-xs text-muted">
          The game only lists your top 9 heroes for each stat, so a dash means &quot;not in the top 9&quot;. Games are worked out
          from wins and win rate. Hours by mode overall:{" "}
          {Object.entries(hoursByMode)
            .map(([m, h]) => `${MODE_LABEL[m] ?? m} ${h} h`)
            .join(", ")}
          .
        </p>
      </div>
    </section>
  );
}

const MODE_LABEL: Record<string, string> = { competitive: "Competitive", quickplay: "Quick Play", arcade: "Arcade", stadium: "Stadium", gameBrowser: "Game Browser" };

function when(date: string) {
  const d = new Date(date.length > 10 ? date : `${date}T12:00`);
  const day = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return date.length > 10 ? `${day}, ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : day;
}
