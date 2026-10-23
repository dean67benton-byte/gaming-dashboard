import { demoDealPool, demoEpic, demoStoreItems, demoTagNames, demoWishlist } from "./demo-deals";
import { hours, isDemo, type OwnedGame } from "./steam";

// Steam store data for the Deals tab: wishlist prices, a taste profile built
// from the tags of the games you play most, and sales ranked against it.
// Everything here uses Steam's and Epic's free public store endpoints.

const API = "https://api.steampowered.com";
const CDN = "https://shared.cloudflare.steamstatic.com/store_item_assets/";

// Store region for prices. Steam formats prices in that region's currency.
const country = () => process.env.STEAM_COUNTRY || "US";

export type Price = {
  final: string; // formatted, e.g. "$7.49"
  original?: string; // set when discounted
  discount: number; // percent, 0 when not on sale
  endsAt?: number; // unix seconds, when the discount ends
};

export type StoreItem = {
  appid: number;
  name: string;
  art: string;
  reviewPct: number;
  reviewCount: number;
  reviewLabel?: string;
  tagids: number[]; // most voted first
  singleplayer: boolean;
  multiplayer: boolean;
  coop: boolean;
  isFree: boolean;
  comingSoon: boolean;
  price: Price | null; // null when there's nothing to buy yet
};

// Steam's player category ids (supported_player_categoryids).
const PLAYERS = { single: 2, multi: 1, coop: 9, onlineCoop: 38, pvp: 49 } as const;

type RawItem = {
  appid?: number;
  success?: number;
  name?: string;
  is_free?: boolean;
  tagids?: number[];
  categories?: { supported_player_categoryids?: number[] };
  reviews?: { summary_filtered?: { review_count: number; percent_positive: number; review_score_label?: string } };
  assets?: { asset_url_format?: string; header?: string };
  release?: { is_coming_soon?: boolean };
  best_purchase_option?: {
    formatted_final_price?: string;
    formatted_original_price?: string;
    discount_pct?: number;
    active_discounts?: { discount_end_date?: number }[];
  };
};

const DATA_REQUEST = { include_assets: true, include_reviews: true, include_release: true, include_tag_count: 12 };

async function storeApi<T>(path: string, input: object, revalidate: number): Promise<T> {
  const url = new URL(`${API}/${path}`);
  url.searchParams.set("input_json", JSON.stringify(input));
  const res = await fetch(url, { next: { revalidate } });
  if (!res.ok) throw new Error(`Steam store ${path} failed: ${res.status}`);
  return ((await res.json()) as { response: T }).response;
}

function toItem(raw: RawItem): StoreItem | null {
  if (!raw.appid || raw.success !== 1 || !raw.name) return null;
  const players = raw.categories?.supported_player_categoryids ?? [];
  const reviews = raw.reviews?.summary_filtered;
  const buy = raw.best_purchase_option;
  const art = raw.assets?.asset_url_format && raw.assets.header ? CDN + raw.assets.asset_url_format.replace("${FILENAME}", raw.assets.header) : `${CDN}steam/apps/${raw.appid}/header.jpg`;
  const discount = buy?.discount_pct ?? 0;
  return {
    appid: raw.appid,
    name: raw.name,
    art,
    reviewPct: reviews?.percent_positive ?? 0,
    reviewCount: reviews?.review_count ?? 0,
    reviewLabel: reviews?.review_score_label,
    tagids: raw.tagids ?? [],
    singleplayer: players.includes(PLAYERS.single),
    multiplayer: players.some((p) => p !== PLAYERS.single),
    coop: players.includes(PLAYERS.coop) || players.includes(PLAYERS.onlineCoop),
    isFree: !!raw.is_free,
    comingSoon: !!raw.release?.is_coming_soon,
    price: buy?.formatted_final_price
      ? {
          final: buy.formatted_final_price,
          original: discount ? buy.formatted_original_price : undefined,
          discount,
          endsAt: buy.active_discounts?.find((d) => d.discount_end_date)?.discount_end_date,
        }
      : null,
  };
}

/** Store details for many apps, 50 per call. Prices are cached for an hour. */
export async function getStoreItems(appids: number[]): Promise<StoreItem[]> {
  if (isDemo()) return appids.map((id) => demoStoreItems[id]).filter(Boolean);
  const chunks: number[][] = [];
  for (let i = 0; i < appids.length; i += 50) chunks.push(appids.slice(i, i + 50));
  const pages = await Promise.all(
    chunks.map((ids) =>
      storeApi<{ store_items?: RawItem[] }>(
        "IStoreBrowseService/GetItems/v1/",
        { ids: ids.map((appid) => ({ appid })), context: { language: "english", country_code: country() }, data_request: DATA_REQUEST },
        3600,
      ).catch(() => ({ store_items: [] })),
    ),
  );
  return pages.flatMap((p) => (p.store_items ?? []).map(toItem).filter((i): i is StoreItem => !!i));
}

/** Tag id → name, for the tags Steam shows on store pages. */
export async function getTagNames(): Promise<Map<number, string>> {
  if (isDemo()) return new Map(Object.entries(demoTagNames).map(([id, name]) => [Number(id), name]));
  try {
    const data = await storeApi<{ tags?: { tagid: number; name: string }[] }>("IStoreService/GetMostPopularTags/v1/", { language: "english" }, 604800);
    return new Map((data.tags ?? []).map((t) => [t.tagid, t.name]));
  } catch {
    return new Map();
  }
}

export type WishlistEntry = { appid: number; priority: number; added: number };

/** Wishlist app ids, or null when the wishlist is private. */
export async function getWishlist(steamid: string): Promise<WishlistEntry[] | null> {
  if (isDemo()) return demoWishlist;
  try {
    const url = new URL(`${API}/IWishlistService/GetWishlist/v1/`);
    url.searchParams.set("steamid", steamid);
    const res = await fetch(url, { next: { revalidate: 600 } });
    if (!res.ok) return null;
    const data = (await res.json()) as { response: { items?: { appid: number; priority: number; date_added: number }[] } };
    // Steam answers an empty response for a private wishlist and for an empty one.
    return (data.response.items ?? []).map((i) => ({ appid: i.appid, priority: i.priority, added: i.date_added }));
  } catch {
    return null;
  }
}

// Tags that say little about what kind of game it is.
const GENERIC = new Set([113, 3859, 4182, 1756, 7481, 4166, 3871, 4085, 21978, 7208]);

/** Your tag scores: the tags of your most played games, weighted by hours and recent play. */
export function tasteProfile(owned: OwnedGame[], items: StoreItem[]): Map<number, number> {
  const byId = new Map(items.map((i) => [i.appid, i]));
  const taste = new Map<number, number>();
  for (const g of owned) {
    const tags = byId.get(g.appid)?.tagids.slice(0, 12) ?? [];
    const weight = Math.log1p(hours(g.playtime_forever)) * (g.playtime_2weeks ? 1.5 : 1);
    tags.forEach((t, i) => taste.set(t, (taste.get(t) ?? 0) + weight * (1 - (i / 12) * 0.7)));
  }
  return taste;
}

/** The games the taste profile is built from: most played, plus anything played lately. */
export const tasteGames = (owned: OwnedGame[]) =>
  [...owned]
    .filter((g) => g.playtime_forever >= 60 || g.playtime_2weeks)
    .sort((a, b) => b.playtime_forever - a.playtime_forever)
    .slice(0, 30);

/** Your strongest genre-like tags, best first. */
export const topTags = (taste: Map<number, number>, n: number) =>
  [...taste].filter(([t]) => !GENERIC.has(t)).sort((a, b) => b[1] - a[1]).slice(0, n).map(([t]) => t);

/**
 * Games in your top tags from Steam's store search: discounted ones when
 * onSale, otherwise the store's top results whatever the price.
 */
export async function getCandidates(tagids: number[], onSale: boolean): Promise<StoreItem[]> {
  if (isDemo()) return demoDealPool.filter((id) => !!demoStoreItems[id].price?.discount === onSale).map((id) => demoStoreItems[id]);
  const pages = await Promise.all(
    tagids.map((tag) =>
      storeApi<{ store_items?: RawItem[] }>(
        "IStoreQueryService/Query/v1/",
        {
          query: {
            start: 0,
            count: 60,
            sort: 10, // top sellers
            filters: {
              released_only: true,
              type_filters: { include_games: true },
              tagids_must_match: [{ tagids: [tag] }],
              ...(onSale && { price_filters: { min_discount_percent: 20 } }),
            },
          },
          context: { language: "english", country_code: country() },
          data_request: DATA_REQUEST,
        },
        onSale ? 3600 : 21600,
      ).catch(() => ({ store_items: [] })),
    ),
  );
  const seen = new Map<number, StoreItem>();
  for (const raw of pages.flatMap((p) => p.store_items ?? [])) {
    const item = toItem(raw);
    if (item && !seen.has(item.appid)) seen.set(item.appid, item);
  }
  return [...seen.values()];
}

export type Pick = StoreItem & { score: number; matched: number[] };

/**
 * Rank games by how well their tags match your taste, weighted by reviews.
 * Reviews are pulled toward 70% until a game has a few hundred of them, so a
 * 100% game with 12 reviews doesn't beat a 95% game with 50,000.
 */
export function rankPicks(items: StoreItem[], taste: Map<number, number>, exclude: Set<number>): Pick[] {
  const best = topTags(taste, 10).reduce((s, t) => s + taste.get(t)!, 0) || 1;
  return items
    .filter((i) => !exclude.has(i.appid) && i.reviewCount >= 200)
    .map((i) => {
      const tags = i.tagids.slice(0, 10).filter((t) => !GENERIC.has(t));
      const match = tags.reduce((s, t) => s + (taste.get(t) ?? 0), 0) / best;
      const quality = (i.reviewPct * i.reviewCount + 70 * 500) / (i.reviewCount + 500) / 100;
      const score = match * quality ** 3 * (1 + (i.price?.discount ?? 0) / 200);
      const matched = tags.filter((t) => taste.has(t)).sort((a, b) => taste.get(b)! - taste.get(a)!);
      return { ...i, score, matched, quality };
    })
    .filter((p) => p.quality >= 0.75 && p.matched.length > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ quality: _quality, ...p }) => p); // eslint-disable-line @typescript-eslint/no-unused-vars
}

export type EpicGame = {
  title: string;
  art: string;
  url: string;
  start: number; // unix ms
  end: number; // unix ms
  originalPrice?: string;
};

type EpicElement = {
  title: string;
  productSlug?: string | null;
  urlSlug?: string;
  keyImages?: { type: string; url: string }[];
  catalogNs?: { mappings?: { pageSlug: string; pageType: string }[] | null };
  offerMappings?: { pageSlug: string; pageType: string }[] | null;
  price?: { totalPrice?: { discountPrice: number; originalPrice: number; fmtPrice?: { originalPrice?: string } } };
  promotions?: {
    promotionalOffers?: { promotionalOffers: EpicOffer[] }[];
    upcomingPromotionalOffers?: { promotionalOffers: EpicOffer[] }[];
  } | null;
};
type EpicOffer = { startDate: string; endDate: string; discountSetting?: { discountPercentage: number } };

/** Epic's weekly free games: free now and coming next. Null when Epic doesn't answer. */
export async function getEpicFree(): Promise<{ now: EpicGame[]; next: EpicGame[] } | null> {
  if (isDemo()) return demoEpic();
  try {
    const res = await fetch("https://store-site-backend-static-ak.epicgames.com/freeGamesPromotions?locale=en-US&country=US&allowCountries=US", {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { data?: { Catalog?: { searchStore?: { elements?: EpicElement[] } } } };
    const elements = data.data?.Catalog?.searchStore?.elements ?? [];
    // A free promo is a 100% discount (discountPercentage 0 means free in Epic's terms).
    const free = (offers?: { promotionalOffers: EpicOffer[] }[]) =>
      offers?.flatMap((o) => o.promotionalOffers).find((o) => o.discountSetting?.discountPercentage === 0);
    const toGame = (e: EpicElement, offer: EpicOffer): EpicGame => {
      const slug =
        e.catalogNs?.mappings?.find((m) => m.pageType === "productHome")?.pageSlug ??
        e.offerMappings?.find((m) => m.pageType === "productHome")?.pageSlug ??
        e.productSlug?.replace(/\/home$/, "") ??
        e.urlSlug;
      const img = e.keyImages?.find((k) => k.type === "OfferImageWide") ?? e.keyImages?.find((k) => k.type === "DieselStoreFrontWide") ?? e.keyImages?.[0];
      const original = e.price?.totalPrice;
      return {
        title: e.title,
        art: img?.url ?? "",
        url: slug ? `https://store.epicgames.com/en-US/p/${slug}` : "https://store.epicgames.com/en-US/free-games",
        start: Date.parse(offer.startDate),
        end: Date.parse(offer.endDate),
        originalPrice: original?.originalPrice ? original.fmtPrice?.originalPrice : undefined,
      };
    };
    const now: EpicGame[] = [];
    const next: EpicGame[] = [];
    for (const e of elements) {
      const current = free(e.promotions?.promotionalOffers);
      if (current && e.price?.totalPrice?.discountPrice === 0) now.push(toGame(e, current));
      const upcoming = free(e.promotions?.upcomingPromotionalOffers);
      if (upcoming) next.push(toGame(e, upcoming));
    }
    return { now, next: next.sort((a, b) => a.start - b.start) };
  } catch {
    return null;
  }
}
