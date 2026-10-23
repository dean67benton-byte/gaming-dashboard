import Link from "next/link";
import DealGrid, { DiscountBadge, PriceTag, type DealCard } from "@/components/DealGrid";
import GameArt from "@/components/GameArt";
import Shell from "@/components/Shell";
import {
  getCandidates,
  getEpicFree,
  getStoreItems,
  getTagNames,
  getWishlist,
  rankPicks,
  tasteGames,
  tasteProfile,
  topTags,
  type EpicGame,
  type Pick,
  type StoreItem,
} from "@/lib/deals";
import { getSession } from "@/lib/session";
import { getOwnedGames, isDemo } from "@/lib/steam";

export const dynamic = "force-dynamic";

// How many of your top tags we search the store with.
const SEARCH_TAGS = 6;

export default async function DealsPage() {
  const steamid = isDemo() ? "demo" : await getSession();
  if (!steamid) {
    return (
      <Shell active="Deals">
        <p className="card p-4 text-sm">
          <Link href="/" className="text-accent">Sign in</Link> to see deals picked for you.
        </p>
      </Shell>
    );
  }

  const [owned, wishlist, tagNames, epic] = await Promise.all([
    getOwnedGames(steamid).catch(() => []),
    getWishlist(steamid),
    getTagNames(),
    getEpicFree(),
  ]);

  const basis = tasteGames(owned);
  const [basisItems, wishItems] = await Promise.all([getStoreItems(basis.map((g) => g.appid)), getStoreItems((wishlist ?? []).map((w) => w.appid))]);
  const taste = tasteProfile(basis, basisItems);
  const tags = topTags(taste, SEARCH_TAGS);
  const [onSale, fullPrice] = await Promise.all([getCandidates(tags, true), getCandidates(tags, false)]);

  // Skip what you own or already wishlisted; full-price picks also skip free games.
  const exclude = new Set([...owned.map((g) => g.appid), ...(wishlist ?? []).map((w) => w.appid)]);
  const name = (t: number) => tagNames.get(t) ?? `Tag ${t}`;
  const deals = rankPicks(onSale, taste, exclude).slice(0, 45).map((p) => card(p, name));
  const liked = rankPicks(fullPrice.filter((i) => !i.isFree), taste, exclude)
    .slice(0, 18)
    .map((p) => card(p, name));

  const priority = new Map((wishlist ?? []).map((w) => [w.appid, w.priority]));
  const wish = [...wishItems].sort((a, b) => (b.price?.discount ?? 0) - (a.price?.discount ?? 0) || priority.get(a.appid)! - priority.get(b.appid)!);
  const wishOnSale = wish.filter((w) => w.price?.discount);

  const tasteTop = topTags(taste, 8);
  const maxTaste = taste.get(tasteTop[0]) ?? 1;

  return (
    <Shell active="Deals">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Deals</h1>
        <p className="text-sm text-muted">Your wishlist prices, sales picked from the genres you play, and Epic&apos;s free games.</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <section>
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold">Wishlist</h2>
              {wish.length > 0 && (
                <span className="text-xs text-muted">
                  {wishOnSale.length} of {wish.length} on sale
                </span>
              )}
            </div>
            {wishlist === null || wish.length === 0 ? (
              <p className="card p-4 text-sm text-muted">
                {wishlist === null ? "Steam didn't return your wishlist." : "Your wishlist looks empty."} If you have one, set <b>Game details</b> to
                Public in your Steam privacy settings (the wishlist follows it), then refresh.
              </p>
            ) : (
              <div className="card divide-y divide-border">
                {wish.map((w) => (
                  <a
                    key={w.appid}
                    href={`https://store.steampowered.com/app/${w.appid}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2/60"
                  >
                    <div className="w-24 shrink-0 overflow-hidden rounded-lg">
                      <GameArt src={w.art} name={w.name} className="text-[10px]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate font-medium">{w.name}</span>
                        {w.price ? (
                          <PriceTag price={w.price} />
                        ) : (
                          <span className="shrink-0 text-xs text-muted">{w.comingSoon ? "Not out yet" : w.isFree ? "Free" : "No price"}</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2 text-xs text-muted">
                        <span className="truncate">{reviews(w)}</span>
                        {!!w.price?.discount && (
                          <span className="flex shrink-0 items-center gap-2">
                            {w.price.endsAt && <span>{ends(w.price.endsAt * 1000)}</span>}
                            <DiscountBadge pct={w.price.discount} className="px-2 py-0.5 text-[11px]" />
                          </span>
                        )}
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-1 text-lg font-semibold">On sale for you</h2>
            <p className="mb-3 text-xs text-muted">Discounted games in the genres you play most, ranked on how well they match and how well they review.</p>
            <DealGrid items={deals} empty="Nothing on sale in your genres right now. Check back when the next sale starts." />
          </section>

          <section>
            <h2 className="mb-1 text-lg font-semibold">You&apos;d like</h2>
            <p className="mb-3 text-xs text-muted">Top sellers in your genres you don&apos;t own yet, worth wishlisting for the next sale.</p>
            <DealGrid items={liked} empty="No picks yet. Play a few more games and they'll show up." />
          </section>
        </div>

        <aside className="space-y-4">
          <section className="card p-5">
            <h2 className="font-semibold">Your taste</h2>
            <p className="mb-3 text-xs text-muted">From the Steam tags of your {basis.length} most played games, weighted by hours.</p>
            {tasteTop.length ? (
              <div className="space-y-2">
                {tasteTop.map((t) => (
                  <div key={t} className="flex items-center gap-2 text-xs">
                    <span className="w-28 shrink-0 truncate">{name(t)}</span>
                    <div className="h-1.5 flex-1 rounded-full bg-surface-2">
                      <div className="h-1.5 rounded-full bg-gradient-to-r from-accent to-accent-2" style={{ width: `${(taste.get(t)! / maxTaste) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">No played games to learn from yet.</p>
            )}
          </section>

          <EpicCard epic={epic} />
        </aside>
      </div>
    </Shell>
  );
}

function card(p: Pick, name: (t: number) => string): DealCard {
  const reasons = [`You play ${p.matched.slice(0, 3).map(name).join(", ")}`];
  if (p.price?.discount && p.price.endsAt) reasons.push(`Sale ${ends(p.price.endsAt * 1000).toLowerCase()}`);
  const modes = [p.singleplayer && "Single player", p.coop ? "Co-op" : p.multiplayer && "Multiplayer"].filter(Boolean);
  if (modes.length) reasons.push(modes.join(" · "));
  return {
    appid: p.appid,
    name: p.name,
    art: p.art,
    price: p.price,
    reviews: reviews(p),
    reasons,
    singleplayer: p.singleplayer,
    multiplayer: p.multiplayer,
    coop: p.coop,
  };
}

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const reviews = (i: StoreItem) =>
  i.reviewCount ? `${i.reviewLabel ? `${i.reviewLabel} · ` : ""}${i.reviewPct}% of ${compact.format(i.reviewCount)} reviews` : "No reviews yet";

function ends(ms: number) {
  const days = Math.floor((ms - Date.now()) / 86400000);
  if (days < 1) return "Ends today";
  if (days === 1) return "Ends tomorrow";
  return `Ends in ${days} days`;
}

const day = (ms: number) => new Date(ms).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

function EpicCard({ epic }: { epic: { now: EpicGame[]; next: EpicGame[] } | null }) {
  const tile = (g: EpicGame, label: string) => (
    <a key={g.title + g.start} href={g.url} target="_blank" rel="noreferrer" className="group block overflow-hidden rounded-xl bg-surface-2 hover:ring-1 hover:ring-accent">
      <GameArt src={g.art} name={g.title} />
      <div className="p-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate font-medium">{g.title}</span>
          {g.originalPrice && <span className="shrink-0 text-xs text-muted line-through">{g.originalPrice}</span>}
        </div>
        <p className="text-xs text-muted">{label}</p>
      </div>
    </a>
  );
  return (
    <section className="card p-5">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="font-semibold">Free on Epic</h2>
        <a href="https://store.epicgames.com/en-US/free-games" target="_blank" rel="noreferrer" className="text-xs text-accent hover:underline">
          Epic store →
        </a>
      </div>
      {!epic ? (
        <p className="rounded-xl bg-surface-2 px-3 py-6 text-center text-sm text-muted">Epic&apos;s store didn&apos;t answer. Try again later.</p>
      ) : (
        <div className="space-y-3">
          {epic.now.length ? (
            epic.now.map((g) => tile(g, `Free until ${day(g.end)} · ${ends(g.end).toLowerCase()}`))
          ) : (
            <p className="rounded-xl bg-surface-2 px-3 py-4 text-center text-sm text-muted">No free game this week.</p>
          )}
          {epic.next.length > 0 && (
            <>
              <h3 className="pt-1 text-xs font-medium uppercase tracking-wide text-muted">Up next</h3>
              {epic.next.map((g) => tile(g, `Free ${day(g.start)} to ${day(g.end)}`))}
            </>
          )}
        </div>
      )}
    </section>
  );
}
