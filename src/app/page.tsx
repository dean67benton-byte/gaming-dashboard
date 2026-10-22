import LibraryTable, { type LibraryRow } from "@/components/LibraryTable";
import { getSession } from "@/lib/session";
import { getOwnedGames, getProfile, getRecentGames, headerImage, hours, isDemo } from "@/lib/steam";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const demo = isDemo();
  const steamid = demo ? "demo" : await getSession();
  if (!steamid) return <SignIn failed={(await searchParams).error === "signin"} />;

  const [profile, owned, recent] = await Promise.all([
    getProfile(steamid),
    getOwnedGames(steamid),
    getRecentGames(steamid),
  ]);

  const rows: LibraryRow[] = owned.map((g) => ({
    appid: g.appid,
    name: g.name,
    hours: hours(g.playtime_forever),
    hours2w: hours(g.playtime_2weeks ?? 0),
    lastPlayed: g.rtime_last_played || null,
  }));
  const totalHours = rows.reduce((sum, r) => sum + r.hours, 0);
  const recentHours = recent.reduce((sum, g) => sum + hours(g.playtime_2weeks), 0);
  const top = [...rows].sort((a, b) => b.hours - a.hours).slice(0, 8);
  const maxHours = top[0]?.hours || 1;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-8 flex items-center gap-4">
        {profile?.avatarfull ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.avatarfull} alt="" className="h-14 w-14 rounded-lg" />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-surface text-xl font-semibold text-muted">
            {profile?.personaname?.[0] ?? "?"}
          </div>
        )}
        <div>
          <h1 className="text-2xl font-semibold">{profile?.personaname ?? "Your games"}</h1>
          <p className="text-sm text-muted">{demo ? "Demo data. Add a Steam API key to see your own." : "Steam"}</p>
        </div>
        {!demo && (
          <form action="/api/auth/logout" method="post" className="ml-auto">
            <button className="text-sm text-muted hover:text-foreground">Sign out</button>
          </form>
        )}
      </header>

      {owned.length === 0 && (
        <p className="mb-8 rounded-lg border border-border bg-surface p-4 text-sm">
          No games came back from Steam. Set <b>Game details</b> to Public in your Steam privacy settings, then refresh.
        </p>
      )}

      <section className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Games owned" value={rows.length.toLocaleString()} />
        <Stat label="Games played" value={rows.filter((r) => r.hours > 0).length.toLocaleString()} />
        <Stat label="Total hours" value={Math.round(totalHours).toLocaleString()} />
        <Stat label="Hours, last 2 weeks" value={recentHours.toFixed(1)} />
      </section>

      {recent.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold">Recently played</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((g) => (
              <div key={g.appid} className="overflow-hidden rounded-lg border border-border bg-surface">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={headerImage(g.appid)} alt="" className="aspect-[460/215] w-full object-cover" />
                <div className="p-3">
                  <div className="font-medium">{g.name}</div>
                  <div className="text-sm text-muted">
                    {hours(g.playtime_2weeks)} h last 2 weeks · {hours(g.playtime_forever).toLocaleString()} h total
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {top.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold">Most played</h2>
          <div className="space-y-2 rounded-lg border border-border bg-surface p-4">
            {top.map((g) => (
              <div key={g.appid} className="grid grid-cols-[minmax(0,12rem)_1fr_4.5rem] items-center gap-3 text-sm">
                <span className="truncate">{g.name}</span>
                <div className="h-2 rounded bg-background">
                  <div className="h-2 rounded bg-accent" style={{ width: `${(g.hours / maxHours) * 100}%` }} />
                </div>
                <span className="text-right tabular-nums text-muted">{g.hours.toLocaleString()} h</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">Library</h2>
        <LibraryTable rows={rows} />
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="text-sm text-muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function SignIn({ failed }: { failed: boolean }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-3xl font-semibold">Gaming Dashboard</h1>
      <p className="max-w-md text-muted">Sign in with Steam to see your library, hours and recently played games.</p>
      {failed && <p className="text-sm text-red-400">Steam sign in failed. Try again.</p>}
      <a href="/api/auth/steam" className="rounded-md bg-accent px-5 py-2.5 font-medium text-background hover:opacity-90">
        Sign in through Steam
      </a>
    </main>
  );
}
