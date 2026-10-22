"use client";

import { useState } from "react";
import GradeBadge from "@/components/GradeBadge";
import Portrait from "@/components/Portrait";
import type { Grade } from "@/lib/grades";
import type { HeroRow, Role } from "@/lib/overwatch";

export type HeroCard = HeroRow & { grade: Grade | null; hours: number; share: number };

const ROLE_LABEL: Record<Role, string> = { tank: "Tank", damage: "Damage", support: "Support" };
const FILTERS = ["all", "tank", "damage", "support"] as const;

const fmt = (label: string, v: number) => (label === "Win rate" ? `${v.toFixed(0)}%` : v >= 100 ? Math.round(v).toLocaleString() : v.toFixed(1));

export default function HeroExplorer({ heroes, minGames }: { heroes: HeroCard[]; minGames: number }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [selected, setSelected] = useState(heroes[0]?.key);
  const shown = heroes.filter((h) => filter === "all" || h.role === filter);
  const hero = heroes.find((h) => h.key === selected) ?? shown[0];

  return (
    <div className="card grid overflow-hidden lg:grid-cols-[320px_minmax(0,1fr)]">
      <div className="border-b border-border lg:border-b-0 lg:border-r">
        <div className="flex gap-1 p-3">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-2.5 py-1 text-xs capitalize ${filter === f ? "bg-accent text-background" : "text-muted hover:bg-surface-2"}`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 px-4 pb-1 text-[11px] uppercase tracking-wide text-muted">
          <span>Hero</span>
          <span className="w-10 text-right">Win</span>
          <span className="w-10 text-right">Games</span>
          <span className="w-6 text-center">Grade</span>
        </div>
        <ul className="max-h-[460px] overflow-y-auto pb-2">
          {shown.map((h) => (
            <li key={h.key}>
              <button
                onClick={() => setSelected(h.key)}
                className={`grid w-full grid-cols-[1fr_auto_auto_auto] items-center gap-x-3 px-4 py-2 text-left text-sm transition-colors ${
                  hero?.key === h.key ? "bg-accent/10" : "hover:bg-surface-2/60"
                } ${h.games_played < minGames ? "text-muted" : ""}`}
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <Portrait src={h.portrait} name={h.name} className="h-9 w-9" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{h.name}</span>
                    <span className="block h-1 w-16 rounded-full bg-surface-2">
                      <span className="block h-1 rounded-full bg-accent" style={{ width: `${Math.max(4, h.share * 100)}%` }} />
                    </span>
                  </span>
                </span>
                <span className={`w-10 text-right tabular-nums ${h.games_played >= minGames ? (h.winrate >= 50 ? "text-good" : "text-bad") : ""}`}>
                  {h.winrate.toFixed(0)}%
                </span>
                <span className="w-10 text-right tabular-nums text-muted">{h.games_played}</span>
                <GradeBadge letter={h.grade?.letter ?? null} score={h.grade?.score} size="sm" />
              </button>
            </li>
          ))}
          {shown.length === 0 && <li className="px-4 py-6 text-sm text-muted">No heroes played in this role.</li>}
        </ul>
      </div>

      {hero && (
        <div className="relative p-5 md:p-6">
          <div className="pointer-events-none absolute right-0 top-0 h-56 w-56 rounded-full bg-accent/10 blur-3xl" />
          <div className="relative flex items-center gap-4">
            <Portrait src={hero.portrait} name={hero.name} className="h-20 w-20 rounded-2xl" />
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-wide text-muted">{hero.role ? ROLE_LABEL[hero.role] : "Hero"}</div>
              <h3 className="truncate text-2xl font-bold">{hero.name}</h3>
              <div className="text-sm text-muted">
                {hero.hours} h · {(hero.share * 100).toFixed(0)}% of your time
              </div>
            </div>
            <div className="ml-auto text-center">
              <GradeBadge letter={hero.grade?.letter ?? null} score={hero.grade?.score} size="lg" />
              <div className="mt-1 text-[11px] text-muted">{hero.grade ? `Score ${hero.grade.score}` : `${minGames}+ games`}</div>
            </div>
          </div>

          <div className="relative mt-5 grid grid-cols-3 gap-2 sm:grid-cols-6">
            <Tile label="Games" value={hero.games_played.toString()} />
            <Tile label="Won" value={hero.games_won.toString()} tone="text-good" />
            <Tile label="Lost" value={hero.games_lost.toString()} tone="text-bad" />
            <Tile label="Win rate" value={`${hero.winrate.toFixed(0)}%`} />
            <Tile label="KDA" value={hero.kda.toFixed(2)} />
            <Tile label="Deaths/10" value={hero.average.deaths.toFixed(1)} />
          </div>

          <h4 className="relative mt-6 mb-1 text-sm font-semibold">Compared with your other {hero.role ? ROLE_LABEL[hero.role].toLowerCase() : ""} heroes</h4>
          <p className="relative mb-3 text-xs text-muted">Per 10 minutes. The tick marks your normal; green is better than usual.</p>
          {hero.grade ? (
            <div className="relative space-y-3">
              {hero.grade.parts.map((p) => {
                const better = p.score >= 1;
                return (
                  <div key={p.label} className="grid grid-cols-[5.5rem_1fr_auto] sm:grid-cols-[6.5rem_1fr_9rem] items-center gap-3 text-sm">
                    <span className="text-muted">{p.label}</span>
                    <div className="relative h-2 rounded-full bg-surface-2">
                      <div className={`h-2 rounded-full ${better ? "bg-good" : "bg-bad"}`} style={{ width: `${((p.score - 0.6) / 0.8) * 100}%` }} />
                      <div className="absolute -top-1 left-1/2 h-4 w-0.5 rounded bg-foreground/70" />
                    </div>
                    <span className="whitespace-nowrap text-right tabular-nums">
                      {fmt(p.label, p.value)} <span className="text-muted">vs {fmt(p.label, p.baseline)}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="relative text-sm text-muted">Play {minGames} or more competitive games on {hero.name} to get a grade.</p>
          )}
        </div>
      )}
    </div>
  );
}

function Tile({ label, value, tone = "" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-2">
      <div className={`text-lg font-semibold tabular-nums ${tone}`}>{value}</div>
      <div className="text-[11px] text-muted">{label}</div>
    </div>
  );
}
