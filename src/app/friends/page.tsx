import Link from "next/link";
import FreePicker, { type FreePick } from "@/components/FreePicker";
import GameArt from "@/components/GameArt";
import Shell from "@/components/Shell";
import StratRoulette from "@/components/StratRoulette";
import { FREE_MULTIPLAYER, ago, presence, presenceRank, rankPicks, sharedGames, type SharedGame, type StratGame } from "@/lib/friends";
import { getSession } from "@/lib/session";
import { getFriendGames, getFriends, getHeaderImage, getOwnedGames, getStoreInfo, headerImage, hours, isDemo, type SteamProfile } from "@/lib/steam";

export const dynamic = "force-dynamic";

// Shared games we look up store categories for. Keeps store calls bounded on big libraries.
const CANDIDATES = 40;

const STRAT_GAMES: Record<number, StratGame> = { 2357570: "Overwatch 2", 730: "Counter-Strike 2", 359550: "Rainbow Six Siege" };

export default async function FriendsPage({ searchParams }: { searchParams: Promise<{ friend?: string }> }) {
  const steamid = isDemo() ? "demo" : await getSession();
  if (!steamid) {
    return (
      <Shell active="Friends">
        <p className="card p-4 text-sm">
          <Link href="/" className="text-accent">Sign in</Link> to see your friends here.
        </p>
      </Shell>
    );
  }

  const [friendsRaw, mine] = await Promise.all([getFriends(steamid), getOwnedGames(steamid).catch(() => [])]);
  const friends = [...(friendsRaw ?? [])].sort((a, b) => presenceRank(b) - presenceRank(a));
  const wanted = (await searchParams).friend;
  const friend = friends.find((f) => f.steamid === wanted) ?? friends[0];

  const theirs = friend ? await getFriendGames(friend.steamid).catch(() => null) : null;
  const shared = theirs ? sharedGames(mine, theirs) : [];

  const candidates = [
    ...new Set(
      [...shared.slice(0, CANDIDATES / 2), ...[...shared].sort((a, b) => minHours(b) - minHours(a)).slice(0, CANDIDATES / 2)].map((s) => s.appid),
    ),
  ];
  const freeIds = FREE_MULTIPLAYER.map((g) => g.appid);
  const [storeList, freeArt] = await Promise.all([Promise.all(candidates.map(getStoreInfo)), Promise.all(freeIds.map(getHeaderImage))]);
  const store = new Map(candidates.map((id, i) => [id, storeList[i]]));
  const picks = friend ? rankPicks(shared, store, friend).slice(0, 3) : [];

  const myHours = new Map(mine.map((g) => [g.appid, hours(g.playtime_forever)]));
  const theirHours = theirs ? new Map(theirs.map((g) => [g.appid, hours(g.playtime_forever)])) : null;
  const free: FreePick[] = FREE_MULTIPLAYER.map((g, i) => ({
    ...g,
    art: freeArt[i],
    mine: myHours.get(g.appid) ?? 0,
    theirs: theirHours ? (theirHours.get(g.appid) ?? 0) : null,
  }));
  const stratGame = picks.map((p) => STRAT_GAMES[p.appid]).find(Boolean);
  const art = (s: SharedGame) => store.get(s.appid)?.headerImage ?? headerImage(s.appid);

  return (
    <Shell active="Friends">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Friends</h1>
        <p className="text-sm text-muted">Pick a friend to see what you both own and what to play tonight.</p>
      </div>

      {friendsRaw === null && (
        <p className="card mb-4 p-4 text-sm">
          Steam didn&apos;t return your friends. Set <b>Friends list</b> to Public in your Steam privacy settings, then refresh.
        </p>
      )}
      {friendsRaw?.length === 0 && <p className="card mb-4 p-4 text-sm">No friends on your Steam account yet.</p>}

      {friends.length > 0 && (
        <div className="no-scrollbar -mx-1 mb-4 flex snap-x gap-2 overflow-x-auto px-1 pb-1">
          {friends.map((f) => (
            <Link
              key={f.steamid}
              href={`/friends?friend=${f.steamid}`}
              scroll={false}
              className={`card flex w-52 shrink-0 snap-start items-center gap-3 px-3 py-2.5 ${
                f.steamid === friend?.steamid ? "border-accent bg-accent/10" : "hover:border-accent/60"
              }`}
            >
              <Avatar profile={f} size="h-9 w-9" />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{f.personaname}</div>
                <div className={`truncate text-xs ${f.gameextrainfo ? "text-good" : "text-muted"}`}>{presence(f)}</div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4">
          {friend && (
            <section className="card flex flex-wrap items-center gap-4 p-5">
              <Avatar profile={friend} size="h-14 w-14" />
              <div className="min-w-0 flex-1 basis-40">
                <h2 className="truncate text-xl font-semibold">{friend.personaname}</h2>
                <p className={`text-sm ${friend.gameextrainfo ? "text-good" : "text-muted"}`}>{presence(friend)}</p>
              </div>
              {theirs && (
                <div className="grid grid-cols-2 gap-2 text-center">
                  <Mini label="Their games" value={theirs.length.toLocaleString()} />
                  <Mini label="Shared" value={shared.length.toLocaleString()} />
                </div>
              )}
              <a href={friend.profileurl} target="_blank" rel="noreferrer" className="text-sm text-accent hover:underline">
                Steam profile →
              </a>
            </section>
          )}

          {friend && !theirs && (
            <p className="card p-4 text-sm">
              {friend.personaname}&apos;s game details are private, so there&apos;s nothing to compare. They can set <b>Game details</b> to
              Public in their Steam privacy settings.
            </p>
          )}

          {friend && theirs && (
            <section>
              <h2 className="mb-1 text-lg font-semibold">What should we play</h2>
              <p className="mb-3 text-xs text-muted">Shared multiplayer games, ranked on both your hours and how recently you each played.</p>
              {picks.length ? (
                <div className="grid gap-3 md:grid-cols-3">
                  {picks.map((p, i) => (
                    <div key={p.appid} className="card overflow-hidden">
                      <div className="relative">
                        <GameArt src={art(p)} name={p.name} />
                        {i === 0 && (
                          <span className="absolute left-3 top-3 rounded-full bg-gradient-to-r from-accent to-accent-2 px-2.5 py-1 text-xs font-semibold text-background">
                            Top pick
                          </span>
                        )}
                      </div>
                      <div className="p-3">
                        <div className="truncate font-medium">{p.name}</div>
                        <HoursCompare me={p.mine.playtime_forever} them={p.theirs.playtime_forever} name={friend.personaname} />
                        <ul className="mt-2 space-y-0.5 text-xs text-muted">
                          {p.reasons.map((r) => (
                            <li key={r}>• {r}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="card p-4 text-sm text-muted">No shared multiplayer games yet. Try a random free one instead.</p>
              )}
            </section>
          )}

          {friend && theirs && shared.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-semibold">Games you both own</h2>
              <div className="card divide-y divide-border">
                {shared.map((s) => (
                  <div key={s.appid} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="w-24 shrink-0 overflow-hidden rounded-lg">
                      <GameArt src={art(s)} name={s.name} className="text-[10px]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate font-medium">{s.name}</span>
                        <span className="shrink-0 text-xs text-muted">{s.lastPlayed ? `Played ${ago(s.lastPlayed)}` : "Never played"}</span>
                      </div>
                      <HoursCompare me={s.mine.playtime_forever} them={s.theirs.playtime_forever} name={friend.personaname} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-4">
          <FreePicker games={free} friendName={theirs ? friend?.personaname : undefined} />
          <StratRoulette key={stratGame ?? "any"} initial={stratGame} />
        </aside>
      </div>
    </Shell>
  );
}

const minHours = (s: SharedGame) => Math.min(s.mine.playtime_forever, s.theirs.playtime_forever);

// Two bars: your hours and theirs, scaled to whoever has more.
function HoursCompare({ me, them, name }: { me: number; them: number; name: string }) {
  const max = Math.max(me, them, 1);
  const row = (label: string, minutes: number, bar: string) => (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-16 shrink-0 truncate text-muted">{label}</span>
      <div className="h-1.5 flex-1 rounded-full bg-surface-2">
        <div className={`h-1.5 rounded-full ${bar}`} style={{ width: `${(minutes / max) * 100}%` }} />
      </div>
      <span className="w-14 shrink-0 text-right tabular-nums text-muted">{hours(minutes).toLocaleString()} h</span>
    </div>
  );
  return (
    <div className="mt-1.5 space-y-1">
      {row("You", me, "bg-gradient-to-r from-accent to-accent-2")}
      {row(name, them, "bg-[#8b7bff]")}
    </div>
  );
}

function Avatar({ profile, size }: { profile: SteamProfile; size: string }) {
  const dot = profile.gameextrainfo ? "bg-good" : profile.personastate ? "bg-accent" : "bg-muted/50";
  return (
    <div className={`relative shrink-0 ${size}`}>
      {profile.avatarfull ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={profile.avatarfull} alt="" className="h-full w-full rounded-full" />
      ) : (
        <div className="flex h-full w-full items-center justify-center rounded-full bg-surface-2 font-semibold text-muted">
          {profile.personaname[0]?.toUpperCase()}
        </div>
      )}
      <span className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full ring-2 ring-surface ${dot}`} />
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-2">
      <div className="font-semibold tabular-nums">{value}</div>
      <div className="text-[11px] text-muted">{label}</div>
    </div>
  );
}
