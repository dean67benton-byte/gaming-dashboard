import Link from "next/link";
import CoachPanel from "@/components/CoachPanel";
import GradeBadge from "@/components/GradeBadge";
import HeroExplorer, { type HeroCard } from "@/components/HeroExplorer";
import Portrait from "@/components/Portrait";
import Ring from "@/components/Ring";
import Shell from "@/components/Shell";
import { buildTips, coachingPrompt } from "@/lib/coach";
import { grade } from "@/lib/grades";
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
  type HeroRow,
  type RankInfo,
  type StatBlock,
} from "@/lib/overwatch";
import { getSessions, recordSnapshot, trackingEnabled, type Session } from "@/lib/sessions";
import { getSession } from "@/lib/session";
import { isDemo } from "@/lib/steam";

export const dynamic = "force-dynamic";

const ROLE_LABEL = { tank: "Tank", damage: "Damage", support: "Support" } as const;

export default async function OverwatchPage() {
  const demo = isDemo();
  if (!demo && !(await getSession())) return <Notice>Sign in on the <Link href="/" className="text-accent">dashboard</Link> first.</Notice>;

  const tag = process.env.OVERWATCH_BATTLETAG ?? "";
  if (!demo && !tag) return <Notice>Set <code>OVERWATCH_BATTLETAG</code> (for example <code>Name#1234</code>) in your environment variables.</Notice>;

  let id: string | null;
  let data;
  try {
    id = await resolvePlayerId(tag);
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

  // Session tracking is best effort; the page still works if storage is down.
  let sessions: Session[] = [];
  try {
    await recordSnapshot(id, stats);
    sessions = await getSessions(id, stats);
  } catch {}

  const g = stats.general;
  const rows = heroRows(stats, heroInfo);
  const totalTime = rows.reduce((sum, r) => sum + r.time_played, 0) || 1;
  const heroCards: HeroCard[] = rows
    .filter((r) => r.games_played > 0)
    .map((r) => {
      const base = (r.role && stats.roles?.[r.role]) || g;
      return {
        ...r,
        hours: hoursFromSeconds(r.time_played),
        share: r.time_played / totalTime,
        grade: r.games_played >= MIN_GAMES ? grade(r, base) : null,
      };
    });
  const topHero = heroCards.find((h) => h.grade) ?? heroCards[0];
  const portraits = Object.fromEntries(rows.map((r) => [r.key, r]));
  const pc = summary.competitive?.pc;

  return (
    <Shell active="Overwatch">
      <section className="card relative mb-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-accent/25 via-accent-2/10 to-transparent" />
        <div className="relative flex flex-wrap items-center gap-4 p-5 md:p-6">
          <Portrait src={summary.avatar} name={summary.username} className="h-16 w-16 rounded-2xl ring-2 ring-accent" />
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wide text-muted">Overwatch 2 · Competitive{pc?.season ? ` · Season ${pc.season}` : ""}</div>
            <h1 className="truncate text-2xl font-bold md:text-3xl">{demo ? "Demo player" : summary.username}</h1>
            {summary.endorsement?.level ? <div className="text-sm text-muted">Endorsement level {summary.endorsement.level}</div> : null}
          </div>
          <div className="flex w-full gap-2 sm:ml-auto sm:w-auto">
            {ROLES.map((role) => (
              <RankChip key={role} role={ROLE_LABEL[role]} rank={pc?.[role] ?? null} />
            ))}
          </div>
        </div>
      </section>

      <div className="mb-4 grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Overview g={g} />
        {topHero && <TopHero hero={topHero} />}
      </div>

      <Sessions sessions={sessions} enabled={trackingEnabled()} heroes={portraits} />

      <section className="mb-4 grid gap-4 md:grid-cols-3">
        {ROLES.map((role) => {
          const s = stats.roles?.[role];
          const gr = s && s.games_played >= MIN_GAMES ? grade(s, g) : null;
          return <RoleCard key={role} label={ROLE_LABEL[role]} rank={pc?.[role] ?? null} stats={s} letter={gr?.letter ?? null} score={gr?.score} />;
        })}
      </section>

      <section className="mb-4">
        <CoachPanel tips={buildTips(summary, stats, rows)} prompt={coachingPrompt(summary, stats, rows)} />
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold">Heroes</h2>
          <span className="text-xs text-muted">Grades: S A B C D F, where B is your normal</span>
        </div>
        <HeroExplorer heroes={heroCards} minGames={MIN_GAMES} />
        <p className="mt-2 text-xs text-muted">Stats from your public career profile via OverFast, refreshed hourly.</p>
      </section>
    </Shell>
  );
}

function RankChip({ role, rank }: { role: string; rank: RankInfo }) {
  return (
    <div className="flex flex-1 items-center gap-2 rounded-xl bg-background/60 px-3 py-2 backdrop-blur sm:flex-none">
      {rank?.rank_icon ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={rank.rank_icon} alt="" className="h-8 w-8" />
      ) : (
        <div className="h-8 w-8 rounded-full bg-surface-2" />
      )}
      <div>
        <div className="text-[11px] text-muted">{role}</div>
        <div className="text-sm font-semibold">{formatRank(rank)}</div>
      </div>
    </div>
  );
}

function Overview({ g }: { g: StatBlock }) {
  return (
    <section className="card p-5">
      <h2 className="mb-4 font-semibold">Competitive overview</h2>
      <div className="flex flex-wrap items-center gap-6">
        <Ring
          size={150}
          thickness={14}
          segments={[
            { value: g.games_won, color: "var(--good)", label: `${g.games_won} wins` },
            { value: g.games_lost, color: "var(--bad)", label: `${g.games_lost} losses` },
          ]}
        >
          <span className="text-2xl font-bold tabular-nums">{g.winrate.toFixed(1)}%</span>
          <span className="text-xs text-muted">Win rate</span>
        </Ring>
        <div className="grid flex-1 grid-cols-2 gap-2">
          <Tile label="Wins" value={g.games_won.toString()} tone="text-good" />
          <Tile label="Losses" value={g.games_lost.toString()} tone="text-bad" />
          <Tile label="KDA" value={g.kda.toFixed(2)} />
          <Tile label="Hours" value={hoursFromSeconds(g.time_played).toString()} />
          <Tile label="Elims / 10 min" value={g.average.eliminations.toFixed(1)} />
          <Tile label="Deaths / 10 min" value={g.average.deaths.toFixed(1)} />
        </div>
      </div>
    </section>
  );
}

function TopHero({ hero }: { hero: HeroCard }) {
  return (
    <section className="card relative overflow-hidden p-5">
      <div className="pointer-events-none absolute -right-10 -top-10 h-64 w-64 rounded-full bg-accent-2/15 blur-3xl" />
      <div className="relative flex h-full flex-col gap-4 sm:flex-row">
        <Portrait src={hero.portrait} name={hero.name} className="h-40 w-full rounded-2xl sm:h-auto sm:w-40" />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start gap-3">
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-wide text-accent">Top hero</div>
              <h2 className="truncate text-3xl font-black uppercase tracking-tight">{hero.name}</h2>
              <div className="text-sm text-muted">
                {hero.hours} h · {hero.games_played} games · {(hero.share * 100).toFixed(0)}% of your time
              </div>
            </div>
            <div className="ml-auto">
              <GradeBadge letter={hero.grade?.letter ?? null} score={hero.grade?.score} size="lg" />
            </div>
          </div>
          <div className="mt-auto grid grid-cols-3 gap-2 pt-4">
            <Tile label="Win rate" value={`${hero.winrate.toFixed(1)}%`} tone={hero.winrate >= 50 ? "text-good" : "text-bad"} />
            <Tile label="KDA" value={hero.kda.toFixed(2)} />
            <Tile label="Damage / 10" value={Math.round(hero.average.damage).toLocaleString()} />
          </div>
        </div>
      </div>
    </section>
  );
}

function Sessions({ sessions, enabled, heroes }: { sessions: Session[]; enabled: boolean; heroes: Record<string, HeroRow> }) {
  return (
    <section className="card mb-4 p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">Recent sessions</h2>
        <span className="text-xs text-muted">Graded against your usual numbers on the same heroes</span>
      </div>
      {!enabled ? (
        <p className="text-sm text-muted">
          Blizzard doesn&apos;t publish match history, so the dashboard saves a snapshot of your stats after you play and
          grades the difference. Turn it on by adding the free <b>Upstash for Redis</b> database in Vercel (Storage tab →
          Create → Upstash for Redis), then redeploy.
        </p>
      ) : sessions.length === 0 ? (
        <p className="text-sm text-muted">Tracking is on. Play some competitive games, and your first graded session shows up here after the next update.</p>
      ) : (
        <ul className="divide-y divide-border">
          {sessions.slice(0, 10).map((s) => (
            <li key={s.end} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
              <GradeBadge letter={s.letter} score={s.score} />
              <div className="w-32">
                <div className="text-sm font-medium">{when(s.end)}</div>
                <div className="text-xs text-muted">{s.minutes} min</div>
              </div>
              <div className="w-20 text-sm">
                <span className="font-semibold text-good">{s.won}W</span> <span className="font-semibold text-bad">{s.lost}L</span>
              </div>
              <div className="flex flex-1 flex-wrap gap-2">
                {s.heroes.map((h) => {
                  const info = heroes[h.key];
                  return (
                    <span key={h.key} className="flex items-center gap-1.5 rounded-xl bg-surface-2 py-1 pl-1 pr-2 text-xs">
                      <Portrait src={info?.portrait} name={info?.name ?? h.key} className="h-6 w-6 rounded-lg text-[9px]" />
                      {info?.name ?? h.key}
                      <span className="text-muted">
                        {h.won}–{h.games - h.won}
                      </span>
                      <GradeBadge letter={h.letter} score={h.score} size="sm" />
                    </span>
                  );
                })}
              </div>
              <div className="hidden text-right text-xs text-muted sm:block">
                {s.per10.eliminations.toFixed(1)} elims · {s.per10.deaths.toFixed(1)} deaths
                <br />
                per 10 min
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function when(ms: number) {
  const days = Math.floor((Date.now() - ms) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return new Date(ms).toLocaleDateString(undefined, { weekday: "long" });
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function Tile({ label, value, tone = "" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-2">
      <div className={`text-lg font-semibold tabular-nums ${tone}`}>{value}</div>
      <div className="text-[11px] text-muted">{label}</div>
    </div>
  );
}

function RoleCard({ label, rank, stats, letter, score }: { label: string; rank: RankInfo; stats?: StatBlock; letter: ReturnType<typeof grade>["letter"] | null; score?: number }) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-3">
        {rank?.rank_icon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={rank.rank_icon} alt="" className="h-10 w-10" />
        ) : (
          <div className="h-10 w-10 rounded-full bg-surface-2" />
        )}
        <div>
          <div className="font-semibold">{label}</div>
          <div className="text-sm text-muted">{formatRank(rank)}</div>
        </div>
        <div className="ml-auto">
          <GradeBadge letter={letter} score={score} />
        </div>
      </div>
      {stats ? (
        <>
          <div className="relative mt-4 h-2 rounded-full bg-surface-2">
            <div className={`h-2 rounded-full ${stats.winrate >= 50 ? "bg-good" : "bg-bad"}`} style={{ width: `${Math.min(100, stats.winrate)}%` }} />
            <div className="absolute -top-1 left-1/2 h-4 w-0.5 rounded bg-foreground/60" title="50%" />
          </div>
          <div className="mt-2 flex justify-between text-sm text-muted">
            <span>{stats.winrate.toFixed(1)}% win</span>
            <span>
              {stats.games_played} games · {hoursFromSeconds(stats.time_played)} h
            </span>
          </div>
        </>
      ) : (
        <div className="mt-4 text-sm text-muted">No games</div>
      )}
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <Shell active="Overwatch">
      <section className="card max-w-2xl p-6">
        <h1 className="mb-3 text-2xl font-semibold">Overwatch 2</h1>
        <p className="text-muted">{children}</p>
      </section>
    </Shell>
  );
}
