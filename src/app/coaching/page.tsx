import Link from "next/link";
import { Suspense } from "react";
import GameArt from "@/components/GameArt";
import PatchWatch from "@/components/PatchWatch";
import Shell from "@/components/Shell";
import { COACHING_GAMES, DEEP_DIVES } from "@/lib/deep-dives";
import { getSession } from "@/lib/session";
import { getHeaderImage, getOwnedGames, hours, isDemo } from "@/lib/steam";

export const dynamic = "force-dynamic";

const formatDate = (ts?: number) =>
  ts ? new Date(ts * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "Never";

export default async function CoachingPage() {
  const steamid = isDemo() ? "demo" : await getSession();
  const owned = steamid ? await getOwnedGames(steamid).catch(() => []) : [];
  const byId = new Map(owned.map((g) => [g.appid, g]));

  const games = COACHING_GAMES.map((g) => ({ ...g, steam: byId.get(g.appid), href: DEEP_DIVES[g.appid] }))
    // Most recently played first, like the dashboard.
    .sort((a, b) => (b.steam?.rtime_last_played ?? 0) - (a.steam?.rtime_last_played ?? 0));
  const art = await Promise.all(games.map((g) => getHeaderImage(g.appid)));

  return (
    <Shell active="Coaching">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Coaching</h1>
        <p className="text-sm text-muted">Pick a game for stats, grades against your normal, and tips on what to change.</p>
      </div>
      {!steamid && (
        <p className="card mb-4 p-4 text-sm">
          <Link href="/" className="text-accent">Sign in</Link> to see your hours here.
        </p>
      )}
      {steamid && (
        <Suspense fallback={null}>
          <PatchWatch steamid={steamid} owned={owned} />
        </Suspense>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {games.map((g, i) => {
          const body = (
            <>
              <div className="relative overflow-hidden">
                <GameArt src={art[i]} name={g.name} className={`transition-transform duration-300 ${g.href ? "group-hover:scale-105" : "opacity-60 grayscale-[40%]"}`} />
                <span
                  className={`absolute right-3 top-3 rounded-full px-2.5 py-1 text-xs font-semibold ${
                    g.href ? "bg-gradient-to-r from-accent to-accent-2 text-background" : "bg-background/80 text-muted"
                  }`}
                >
                  {g.href ? "Coaching ready" : "Coming soon"}
                </span>
              </div>
              <div className="p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="truncate text-lg font-semibold">{g.name}</h2>
                  {g.href && <span className="text-sm text-accent">Open →</span>}
                </div>
                <p className="mt-0.5 text-sm text-muted">{g.blurb}</p>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <Mini label="Total" value={g.steam ? `${hours(g.steam.playtime_forever).toLocaleString()}h` : "–"} />
                  <Mini label="2 weeks" value={g.steam?.playtime_2weeks ? `${hours(g.steam.playtime_2weeks)}h` : "–"} />
                  <Mini label="Last played" value={formatDate(g.steam?.rtime_last_played)} />
                </div>
              </div>
            </>
          );
          return g.href ? (
            <Link key={g.appid} href={g.href} className="card group block overflow-hidden hover:border-accent">
              {body}
            </Link>
          ) : (
            <div key={g.appid} className="card overflow-hidden">
              {body}
            </div>
          );
        })}
      </div>
    </Shell>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-2 py-2">
      <div className="truncate text-sm font-semibold tabular-nums">{value}</div>
      <div className="text-[11px] text-muted">{label}</div>
    </div>
  );
}
