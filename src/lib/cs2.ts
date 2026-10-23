import { isDemo } from "./steam";

// CS2 lifetime stats from Steam's free user stats endpoint. Needs the
// profile's Game details to be public. Only weapons and maps for now; the
// full CS2 deep dive can build on this.

export type Cs2Pick = { key: string; name: string; aliases: string[]; count: number };
export type Cs2Stats = { weapons: Cs2Pick[]; maps: Cs2Pick[] };

// Steam stat key → name as Valve writes it in patch notes, plus other spellings.
const WEAPONS: Record<string, string[]> = {
  ak47: ["AK-47", "AK47", "AK"],
  m4a1: ["M4A4", "M4A1-S", "M4"],
  awp: ["AWP"],
  deagle: ["Desert Eagle", "Deagle"],
  glock: ["Glock-18", "Glock"],
  hkp2000: ["P2000", "USP-S", "USP"],
  p250: ["P250"],
  fiveseven: ["Five-SeveN", "Five-Seven"],
  tec9: ["Tec-9", "Tec9"],
  elite: ["Dual Berettas"],
  aug: ["AUG"],
  sg556: ["SG 553", "SG553"],
  famas: ["FAMAS"],
  galilar: ["Galil AR", "Galil"],
  ssg08: ["SSG 08", "SSG08", "Scout"],
  scar20: ["SCAR-20"],
  g3sg1: ["G3SG1"],
  mp7: ["MP7"],
  mp9: ["MP9"],
  mac10: ["MAC-10", "MAC10"],
  ump45: ["UMP-45", "UMP"],
  p90: ["P90"],
  bizon: ["PP-Bizon", "Bizon"],
  nova: ["Nova"],
  xm1014: ["XM1014"],
  mag7: ["MAG-7"],
  sawedoff: ["Sawed-Off"],
  negev: ["Negev"],
  m249: ["M249"],
  taser: ["Zeus x27", "Zeus"],
  knife: ["Knife", "Knives"],
};

const MAPS: Record<string, string[]> = {
  de_dust2: ["Dust II", "Dust 2", "Dust2"],
  de_mirage: ["Mirage"],
  de_inferno: ["Inferno"],
  de_nuke: ["Nuke"],
  de_ancient: ["Ancient"],
  de_anubis: ["Anubis"],
  de_vertigo: ["Vertigo"],
  de_overpass: ["Overpass"],
  de_train: ["Train"],
  de_cache: ["Cache"],
  de_cbble: ["Cobblestone"],
  cs_office: ["Office"],
  cs_italy: ["Italy"],
};

const pick = (table: Record<string, string[]>, counts: Record<string, number>): Cs2Pick[] =>
  Object.entries(counts)
    .filter(([key, count]) => table[key] && count > 0)
    .map(([key, count]) => ({ key, name: table[key][0], aliases: table[key], count }))
    .sort((a, b) => b.count - a.count);

export function toCs2Stats(stats: { name: string; value: number }[]): Cs2Stats {
  const kills: Record<string, number> = {};
  const rounds: Record<string, number> = {};
  for (const { name, value } of stats) {
    if (name.startsWith("total_kills_")) kills[name.slice(12)] = value;
    else if (name.startsWith("total_rounds_map_")) rounds[name.slice(17)] = value;
  }
  return { weapons: pick(WEAPONS, kills), maps: pick(MAPS, rounds) };
}

const demoStats: Cs2Stats = toCs2Stats([
  { name: "total_kills_ak47", value: 18420 },
  { name: "total_kills_m4a1", value: 11230 },
  { name: "total_kills_awp", value: 6110 },
  { name: "total_kills_aug", value: 2740 },
  { name: "total_kills_deagle", value: 2510 },
  { name: "total_kills_glock", value: 1900 },
  { name: "total_rounds_map_de_mirage", value: 9100 },
  { name: "total_rounds_map_de_inferno", value: 7400 },
  { name: "total_rounds_map_de_dust2", value: 6900 },
  { name: "total_rounds_map_de_nuke", value: 2100 },
]);

/** Your CS2 weapons by kills and maps by rounds, or null when stats are private or unavailable. */
export async function getCs2Stats(steamid: string): Promise<Cs2Stats | null> {
  if (isDemo()) return demoStats;
  try {
    const url = new URL("https://api.steampowered.com/ISteamUserStats/GetUserStatsForGame/v2/");
    url.searchParams.set("key", process.env.STEAM_API_KEY ?? "");
    url.searchParams.set("steamid", steamid);
    url.searchParams.set("appid", "730");
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const data = (await res.json()) as { playerstats?: { stats?: { name: string; value: number }[] } };
    const stats = data.playerstats?.stats;
    return stats?.length ? toCs2Stats(stats) : null;
  } catch {
    return null;
  }
}
