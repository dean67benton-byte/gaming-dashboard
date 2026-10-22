import Link from "next/link";
import CoachPanel from "@/components/CoachPanel";
import { buildTips, coachingPrompt } from "@/lib/coach";
import {
  formatRank,
  getCompetitiveStats,
  getHeroes,
  getSummary,
  heroRows,
  hoursFromSeconds,
  MIN_GAMES,
  resolvePlayerId,
  ROLES,
  strengths,
  type HeroRow,
  type StatBlock,
} from "@/lib/overwatch";
import { getSession } from "@/lib/session";
import { isDemo } from "@/lib/steam";

export const dynamic = "force-dynamic";

const ROLE_LABEL = { tank: "Tank", damage: "Damage", support: "Support" } as const;

export default async function OverwatchPage() {
  const demo = isDemo();
  if (!demo && !(await getSession())) return <Notice>Sign in on the <Link href="/" className="text-accent">dashboard</Link> first.</Notice>;

  const tag = process.env.OVERWATCH_BATTLETAG ?? "";
  if (!demo && !tag) return <Notice>Set <code>OVERWATCH_BATTLETAG</code> (for example <code>Name#1234</code>) in your environment variables.</Notice>;

  let data;
  try {
    const id = await resolvePlayerId(tag);
    if (!id) {
      return (
        <Notice>
          No Overwatch profile found for <b>{tag}</b>. Check the BattleTag, including capitals, and make sure your career
          profile is set to Public in game (Options → Social → Career Profile Visibility).
        </Notice>
      );
    }
    data = await Promise.all([getSummary(id), getCompetitiveStats(id), getHeroes()]);
  } catch {
    return <Notice>The Overwatch stats service isn&apos;t responding right now. Try again in a few minutes.</Notice>;
  }
  const [summary, stats, heroInfo] = data;
  if (!summary) return <Notice>No Overwatch profile found for <b>{tag}</b>. Check the BattleTag, including capitals.</Notice>;
  if (summary.privacy === "private" || !stats?.general) {
    return (
      <Notice>
        Your career profile is private, so there are no stats to show. In Overwatch, go to Options → Social → Career
        Profile Visibility and set it to Public. Stats update a few minutes after your next match.
      </Notice>
    );
  }

  const rows = heroRows(stats, heroInfo);
  const { best, worst } = strengths(rows);
  const pc = summary.competitive?.pc;
  const g = stats.general;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Link href="/" className="text-sm text-muted hover:text-foreground">← Dashboard</Link>
      <header className="mb-6 mt-2 flex flex-wrap items-end gap-3">
        <h1 className="text-2xl font-semibold">Overwatch 2</h1>
        <span className="text-muted">
          {demo ? "Demo data" : summary.username} · Competitive{pc?.season ? `, season ${pc.season}` : ""}
        </span>
      </header>

      <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Win rate" value={`${g.winrate.toFixed(1)}%`} sub={`${g.games_won}–${g.games_lost} in ${g.games_played} games`} />
        <Stat label="Hours played" value={hoursFromSeconds(g.time_played).toString()} />
        <Stat label="KDA" value={g.kda.toFixed(2)} />
        <Stat label="Deaths per 10 min" value={g.average.deaths.toFixed(1)} />
      </section>

      <section className="mb-6">
        <h2 className="mb-3 text-lg font-semibold">Roles</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {ROLES.map((role) => (
            <RoleCard key={role} label={ROLE_LABEL[role]} rank={formatRank(pc?.[role] ?? null)} stats={stats.roles?.[role]} />
          ))}
        </div>
      </section>

      <section className="mb-6 grid gap-3 md:grid-cols-2">
        <PickList title="Your best heroes" rows={best} tone="text-emerald-400" empty={`Play ${MIN_GAMES}+ games on a hero to rank it.`} />
        <PickList title="Struggling on" rows={worst} tone="text-red-400" empty="Not enough games yet." />
      </section>

      <section className="mb-6">
        <CoachPanel tips={buildTips(summary, stats, rows)} prompt={coachingPrompt(summary, stats, rows)} />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Heroes</h2>
        <HeroTable rows={rows} />
        <p className="mt-2 text-xs text-muted">Per-10-minute averages. Stats from public career profiles via OverFast, refreshed hourly.</p>
      </section>
    </main>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="text-sm text-muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

function RoleCard({ label, rank, stats }: { label: string; rank: string; stats?: StatBlock }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-baseline justify-between">
        <span className="font-medium">{label}</span>
        <span className="text-sm text-muted">{rank}</span>
      </div>
      {stats ? (
        <>
          <WinBar winrate={stats.winrate} />
          <div className="mt-2 text-sm text-muted">
            {stats.winrate.toFixed(1)}% win · {stats.games_played} games · {hoursFromSeconds(stats.time_played)} h
          </div>
        </>
      ) : (
        <div className="mt-3 text-sm text-muted">No games</div>
      )}
    </div>
  );
}

function WinBar({ winrate }: { winrate: number }) {
  return (
    <div className="relative mt-3 h-2 rounded bg-background">
      <div
        className={`h-2 rounded ${winrate >= 50 ? "bg-emerald-500" : "bg-red-500"}`}
        style={{ width: `${Math.min(100, winrate)}%` }}
      />
      <div className="absolute top-[-2px] h-3 w-px bg-muted" style={{ left: "50%" }} title="50%" />
    </div>
  );
}

function PickList({ title, rows, tone, empty }: { title: string; rows: HeroRow[]; tone: string; empty: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className={`mb-2 font-medium ${tone}`}>{title}</div>
      {rows.length === 0 ? (
        <div className="text-sm text-muted">{empty}</div>
      ) : (
        <ul className="space-y-1 text-sm">
          {rows.map((r) => (
            <li key={r.key} className="flex justify-between">
              <span>{r.name}</span>
              <span className="tabular-nums text-muted">
                {r.winrate.toFixed(0)}% · {r.games_played} games
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function HeroTable({ rows }: { rows: HeroRow[] }) {
  const th = "px-3 py-2 text-right font-medium text-muted";
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="px-3 py-2 text-left font-medium text-muted">Hero</th>
            <th className={th}>Hours</th>
            <th className={th}>Games</th>
            <th className={th}>Win %</th>
            <th className={th}>KDA</th>
            <th className={th}>Elims</th>
            <th className={th}>Deaths</th>
            <th className={th}>Damage</th>
            <th className={th}>Healing</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className={`border-t border-border ${r.games_played < MIN_GAMES ? "text-muted" : ""}`}>
              <td className="px-3 py-2">
                {r.name}
                {r.role && <span className="ml-2 text-xs text-muted">{ROLE_LABEL[r.role]}</span>}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{hoursFromSeconds(r.time_played)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{r.games_played}</td>
              <td className={`px-3 py-2 text-right tabular-nums ${r.games_played >= MIN_GAMES ? (r.winrate >= 50 ? "text-emerald-400" : "text-red-400") : ""}`}>
                {r.winrate.toFixed(0)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{r.kda.toFixed(2)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{r.average.eliminations.toFixed(1)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{r.average.deaths.toFixed(1)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{Math.round(r.average.damage).toLocaleString()}</td>
              <td className="px-3 py-2 text-right tabular-nums">{Math.round(r.average.healing).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <Link href="/" className="text-sm text-muted hover:text-foreground">← Dashboard</Link>
      <h1 className="mb-3 mt-2 text-2xl font-semibold">Overwatch 2</h1>
      <p className="text-muted">{children}</p>
    </main>
  );
}
