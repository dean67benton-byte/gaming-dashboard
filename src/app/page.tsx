import Link from "next/link";
import GameArt from "@/components/GameArt";
import LibraryTable, { type LibraryRow } from "@/components/LibraryTable";
import Ring from "@/components/Ring";
import Shell from "@/components/Shell";
import { DEEP_DIVES } from "@/lib/deep-dives";
import { getSession } from "@/lib/session";
import { getHeaderImage, getOwnedGames, getRecentGames, hours, isDemo } from "@/lib/steam";

export const dynamic = "force-dynamic";

const COLORS = ["var(--accent)", "var(--accent-2)", "#8b7bff", "#2dd4bf", "#fbbf24"];
const OTHER = "#3a3f55";

// Competitive games that get (or will get) their own stats page.
const DIVES = [
  { appid: 2357570, name: "Overwatch 2" },
  { appid: 730, name: "Counter-Strike 2" },
  { appid: 359550, name: "Rainbow Six Siege" },
];

export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const demo = isDemo();
  const steamid = demo ? "demo" : await getSession();
  if (!steamid) return <SignIn failed={(await searchParams).error === "signin"} />;

  const [owned, recent] = await Promise.all([getOwnedGames(steamid), getRecentGames(steamid)]);

  const rows: LibraryRow[] = owned.map((g) => ({
    appid: g.appid,
    name: g.name,
    hours: hours(g.playtime_forever),
    hours2w: hours(g.playtime_2weeks ?? 0),
    lastPlayed: g.rtime_last_played || null,
    href: DEEP_DIVES[g.appid],
  }));
  const totalHours = rows.reduce((sum, r) => sum + r.hours, 0);
  const recentHours = recent.reduce((sum, g) => sum + hours(g.playtime_2weeks), 0);
  const top = [...rows].sort((a, b) => b.hours - a.hours).slice(0, 8);
  const featured = [...recent].sort((a, b) => b.playtime_2weeks - a.playtime_2weeks)[0];
  const others = recent.filter((g) => g !== featured);

  const artIds = [...new Set([featured?.appid, ...others.map((g) => g.appid), ...top.map((g) => g.appid)].filter((id): id is number => !!id))];
  const artList = await Promise.all(artIds.map(getHeaderImage));
  const art = new Map(artIds.map((id, i) => [id, artList[i]]));

  const ringTop = top.slice(0, 5);
  const otherHours = totalHours - ringTop.reduce((sum, g) => sum + g.hours, 0);
  const segments = [
    ...ringTop.map((g, i) => ({ value: g.hours, color: COLORS[i], label: g.name })),
    { value: otherHours, color: OTHER, label: "Everything else" },
  ];
  const hoursById = new Map(rows.map((r) => [r.appid, r.hours]));

  return (
    <Shell active="Home">
      {owned.length === 0 && (
        <p className="card mb-4 p-4 text-sm">
          No games came back from Steam. Set <b>Game details</b> to Public in your Steam privacy settings, then refresh.
        </p>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4">
          {featured && <Featured game={featured} art={art.get(featured.appid)!} />}

          {others.length > 0 && (
            <section>
              <SectionTitle>Recently played</SectionTitle>
              <div className="no-scrollbar -mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-1">
                {others.map((g) => {
                  const href = DEEP_DIVES[g.appid];
                  const inner = (
                    <>
                      <GameArt src={art.get(g.appid)!} name={g.name} className="transition-transform duration-300 group-hover:scale-105" />
                      <div className="p-3">
                        <div className="truncate font-medium">{g.name}</div>
                        <div className="text-xs text-muted">
                          {hours(g.playtime_2weeks)} h last 2 weeks · {hours(g.playtime_forever).toLocaleString()} h total
                        </div>
                      </div>
                    </>
                  );
                  const box = "card group block w-64 shrink-0 snap-start overflow-hidden";
                  return href ? (
                    <Link key={g.appid} href={href} className={`${box} hover:border-accent`}>
                      {inner}
                    </Link>
                  ) : (
                    <div key={g.appid} className={box}>
                      {inner}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {top.length > 0 && (
            <section>
              <SectionTitle>Most played</SectionTitle>
              <div className="card divide-y divide-border">
                {top.map((g, i) => (
                  <div key={g.appid} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="w-5 text-right text-sm tabular-nums text-muted">{i + 1}</span>
                    <div className="w-24 shrink-0 overflow-hidden rounded-lg">
                      <GameArt src={art.get(g.appid)!} name={g.name} className="text-[10px]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        {g.href ? (
                          <Link href={g.href} className="truncate font-medium hover:text-accent">
                            {g.name}
                          </Link>
                        ) : (
                          <span className="truncate font-medium">{g.name}</span>
                        )}
                        <span className="shrink-0 text-sm tabular-nums text-muted">{g.hours.toLocaleString()} h</span>
                      </div>
                      <div className="mt-1.5 h-1.5 rounded-full bg-surface-2">
                        <div
                          className="h-1.5 rounded-full bg-gradient-to-r from-accent to-accent-2"
                          style={{ width: `${(g.hours / (top[0].hours || 1)) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-4">
          <section className="card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold">Your hours</h2>
              <span className="text-xs text-muted">All time</span>
            </div>
            <div className="flex justify-center">
              <Ring segments={segments} size={190} thickness={18}>
                <span className="text-xs text-muted">Total hours</span>
                <span className="text-3xl font-bold tabular-nums">{Math.round(totalHours).toLocaleString()}</span>
              </Ring>
            </div>
            <ul className="mt-5 space-y-2 text-sm">
              {segments.map((s) => (
                <li key={s.label} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                  <span className="truncate">{s.label}</span>
                  <span className="ml-auto shrink-0 tabular-nums text-muted">{Math.round(s.value).toLocaleString()} h</span>
                </li>
              ))}
            </ul>
            <div className="mt-5 grid grid-cols-3 gap-2 text-center">
              <Mini label="Owned" value={rows.length.toLocaleString()} />
              <Mini label="Played" value={rows.filter((r) => r.hours > 0).length.toLocaleString()} />
              <Mini label="2 weeks" value={`${recentHours.toFixed(1)}h`} />
            </div>
          </section>

          <section className="card p-5">
            <h2 className="mb-3 font-semibold">Stats and coaching</h2>
            <div className="space-y-2">
              {DIVES.map((d) => {
                const href = DEEP_DIVES[d.appid];
                const h = hoursById.get(d.appid);
                const body = (
                  <>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{d.name}</div>
                      <div className="text-xs text-muted">{h ? `${h.toLocaleString()} h` : "Not in library"}</div>
                    </div>
                    <span className={`ml-auto shrink-0 rounded-full px-2.5 py-0.5 text-xs ${href ? "bg-accent/15 text-accent" : "bg-surface-2 text-muted"}`}>
                      {href ? "Open →" : "Soon"}
                    </span>
                  </>
                );
                return href ? (
                  <Link key={d.appid} href={href} className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2.5 hover:ring-1 hover:ring-accent">
                    {body}
                  </Link>
                ) : (
                  <div key={d.appid} className="flex items-center gap-3 rounded-xl bg-surface-2/60 px-3 py-2.5">
                    {body}
                  </div>
                );
              })}
            </div>
          </section>
        </aside>
      </div>

      <section className="mt-6">
        <SectionTitle>Library</SectionTitle>
        <LibraryTable rows={rows} />
      </section>
    </Shell>
  );
}

function Featured({ game, art }: { game: { appid: number; name: string; playtime_2weeks: number; playtime_forever: number }; art: string }) {
  const href = DEEP_DIVES[game.appid];
  return (
    <section className="card relative overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={art} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-2xl" />
      <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-background/20" />
      <div className="relative flex flex-col gap-5 p-6 sm:flex-row sm:items-center md:p-8">
        <div className="min-w-0 flex-1">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-accent to-accent-2 px-3 py-1 text-xs font-semibold text-background">
            ▲ Most played lately
          </span>
          <h2 className="mt-3 text-3xl font-bold leading-tight md:text-4xl">{game.name}</h2>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <span>
              <b className="text-lg tabular-nums">{hours(game.playtime_2weeks)}</b> <span className="text-muted">h last 2 weeks</span>
            </span>
            <span>
              <b className="text-lg tabular-nums">{hours(game.playtime_forever).toLocaleString()}</b> <span className="text-muted">h total</span>
            </span>
          </div>
          {href && (
            <Link href={href} className="mt-5 inline-block rounded-xl bg-foreground px-4 py-2 text-sm font-semibold text-background hover:bg-accent">
              Stats and coaching →
            </Link>
          )}
        </div>
        <div className="w-full overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/10 sm:w-72">
          <GameArt src={art} name={game.name} />
        </div>
      </div>
    </section>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 text-lg font-semibold">{children}</h2>;
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-2 py-2">
      <div className="font-semibold tabular-nums">{value}</div>
      <div className="text-[11px] text-muted">{label}</div>
    </div>
  );
}

function SignIn({ failed }: { failed: boolean }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-5 px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-accent-2 text-2xl font-black text-background">
        G
      </div>
      <h1 className="text-3xl font-bold">Gaming Dashboard</h1>
      <p className="max-w-md text-muted">Sign in with Steam to see your library, hours, stats and coaching.</p>
      {failed && <p className="text-sm text-bad">Steam sign in failed. Try again.</p>}
      <a href="/api/auth/steam" className="rounded-xl bg-gradient-to-r from-accent to-accent-2 px-5 py-2.5 font-semibold text-background hover:opacity-90">
        Sign in through Steam
      </a>
    </main>
  );
}
