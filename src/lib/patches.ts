import { getHeroes, getStats, heroRows, resolvePlayerId } from "./overwatch";
import { getCs2Stats } from "./cs2";
import type { OwnedGame } from "./steam";

// Patch watch: recent official patch notes, narrowed to the heroes, weapons
// and maps you actually play. All sources are free and keyless:
// - Overwatch: Blizzard's patch notes page (structured hero by hero)
// - CS2: Valve's update posts on the Steam news feed

export const PATCH_DAYS = 30; // how far back to look for patches, and for recent play
const DAY = 86_400_000;

export type Effect = "buff" | "nerf" | "change";
export type PatchLine = { label?: string; text: string; effect: Effect };
export type PatchRef = { title: string; date: string; url: string; lines: PatchLine[] };
export type PatchHit = {
  name: string; // hero, weapon or map
  image?: string | null;
  verdict: "Buffed" | "Nerfed" | "Mixed" | "Changed" | "Reworked";
  patches: PatchRef[]; // newest first
  dev?: string;
  why: string; // why it's one of your picks, e.g. "#1 hero by time played"
};

// ---------- Buff or nerf, from the wording of one line ----------

// Stats where a smaller number is better for the player who has them.
const LOWER_IS_BETTER =
  /cooldown|cast time|recovery|spread|delay|wind-?up|reload|startup|charge time|time to|lockout|recoil|cost|points required|hit volume|hitbox|self[- ]damage|damage taken|penalty|movement inaccuracy|price/i;
const UP = /\b(increased|raised|extended|improved|lengthened)\b/i;
const DOWN = /\b(reduced|decreased|lowered|shortened)\b/i;

export function effectOf(text: string): Effect {
  const up = UP.test(text);
  const down = DOWN.test(text);
  if (up === down) return "change";
  const lowerBetter = LOWER_IS_BETTER.test(text);
  return up !== lowerBetter ? "buff" : "nerf";
}

function verdictOf(lines: PatchLine[], rework = false): PatchHit["verdict"] {
  if (rework) return "Reworked";
  const buffs = lines.filter((l) => l.effect === "buff").length;
  const nerfs = lines.filter((l) => l.effect === "nerf").length;
  if (buffs && nerfs) return "Mixed";
  if (buffs) return "Buffed";
  if (nerfs) return "Nerfed";
  return "Changed";
}

// ---------- Overwatch ----------

const OW_NOTES = "https://overwatch.blizzard.com/en-us/news/patch-notes";

type OwHeroChange = { name: string; icon?: string; lines: PatchLine[]; dev?: string; rework: boolean };
export type OwPatch = { title: string; date: Date; url: string; heroes: OwHeroChange[] };

const decode = (s: string) =>
  s
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&rsquo;|&lsquo;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const listItems = (html: string) => [...html.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => decode(m[1])).filter(Boolean);
const between = (html: string, cls: string) => html.match(new RegExp(`class="${cls}"[^>]*>([\\s\\S]*?)</(?:h\\d|div)>`))?.[1];

// Section titles that just say which role the hero is.
const PLAIN_SECTIONS = /^(tank|damage|support|hero updates|hero reworks)$/i;
const SECTION_LABEL: Record<string, string> = { "Hero Hit Volumes": "Hitbox" };

/** Parses one month of Blizzard's patch notes page. Only "hero update" sections count, not bug fixes. */
export function parseOwPatches(html: string, pageUrl: string): OwPatch[] {
  return html
    .split('class="PatchNotes-patch ')
    .slice(1)
    .map((block) => {
      const title = decode(between(block, "PatchNotes-patchTitle") ?? "Patch notes");
      const date = new Date(decode(between(block, "PatchNotes-date") ?? ""));
      const anchor = block.match(/class="anchor" id="([^"]+)"/)?.[1];
      const heroes = new Map<string, OwHeroChange>();

      for (const section of block.split('class="PatchNotes-section ').slice(1)) {
        if (!section.startsWith("PatchNotes-section-hero_update")) continue;
        const sectionTitle = decode(between(section, "PatchNotes-sectionTitle") ?? "");
        const rework = /rework/i.test(sectionTitle);
        for (const hero of section.split('class="PatchNotesHeroUpdate"').slice(1)) {
          const name = decode(between(hero, "PatchNotesHeroUpdate-name") ?? "");
          if (!name) continue;
          const entry = heroes.get(name) ?? { name, lines: [], rework: false };
          entry.icon ??= hero.match(/class="PatchNotesHeroUpdate-icon" src="([^"]+)"/)?.[1];
          entry.rework ||= rework;
          const dev = hero.match(/PatchNotesHeroUpdate-dev">([\s\S]*?)<\/div>/)?.[1];
          if (dev) entry.dev ??= decode(dev).replace(/^Developer Comments:\s*/i, "");

          // General changes, optionally grouped under <p> headings such as a perk name.
          const general = hero.match(/PatchNotesHeroUpdate-generalUpdates">([\s\S]*?)<\/div>/)?.[1] ?? "";
          let label = PLAIN_SECTIONS.test(sectionTitle) ? undefined : SECTION_LABEL[sectionTitle] ?? sectionTitle;
          for (const [, heading, item] of general.matchAll(/<p>([\s\S]*?)<\/p>|<li>([\s\S]*?)<\/li>/g)) {
            if (heading !== undefined) label = decode(heading);
            else if (decode(item)) entry.lines.push({ label, text: decode(item), effect: effectOf(`${label ?? ""} ${decode(item)}`) });
          }

          for (const ability of hero.split('class="PatchNotesAbilityUpdate-name">').slice(1)) {
            const abilityName = decode(ability.slice(0, ability.indexOf("<")));
            const list = ability.match(/detailList">([\s\S]*?)<\/div>/)?.[1] ?? "";
            for (const text of listItems(list)) entry.lines.push({ label: abilityName, text, effect: effectOf(`${abilityName} ${text}`) });
          }
          heroes.set(name, entry);
        }
      }
      return { title, date, url: anchor ? `${pageUrl}#${anchor}` : pageUrl, heroes: [...heroes.values()] };
    })
    .filter((p) => !Number.isNaN(p.date.getTime()));
}

async function fetchText(url: string) {
  const res = await fetch(url, { next: { revalidate: 6 * 3600 } });
  if (!res.ok) throw new Error(`${url} failed: ${res.status}`);
  return res.text();
}

/** Patches from the last PATCH_DAYS days (this month's page, plus last month's when the window reaches back into it). */
export async function getOwPatches(now = new Date()): Promise<OwPatch[]> {
  const since = now.getTime() - PATCH_DAYS * DAY;
  const start = new Date(since);
  const pages = [`${OW_NOTES}/`];
  if (start.getUTCMonth() !== now.getUTCMonth()) {
    pages.push(`${OW_NOTES}/live/${start.getUTCFullYear()}/${String(start.getUTCMonth() + 1).padStart(2, "0")}/`);
  }
  const results = await Promise.all(pages.map((url) => fetchText(url).then((html) => parseOwPatches(html, url)).catch(() => [])));
  const seen = new Set<string>();
  return results
    .flat()
    .filter((p) => p.date.getTime() >= since && !seen.has(p.title) && seen.add(p.title))
    .sort((a, b) => b.date.getTime() - a.date.getTime());
}

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const TOP_HEROES = 5;

async function overwatchHits(): Promise<PatchHit[]> {
  const tag = process.env.OVERWATCH_BATTLETAG ?? "";
  const id = await resolvePlayerId(tag);
  if (!id) return [];
  const [stats, heroes, patches] = await Promise.all([getStats(id, "all"), getHeroes(), getOwPatches()]);
  if (!stats) return [];
  const top = heroRows(stats, heroes).slice(0, TOP_HEROES);

  const hits: PatchHit[] = [];
  top.forEach((hero, i) => {
    const keys = new Set([norm(hero.name), norm(hero.key)]);
    const changes = patches
      .map((patch) => ({ patch, change: patch.heroes.find((h) => keys.has(norm(h.name)) && h.lines.length) }))
      .filter((c) => c.change);
    if (!changes.length) return;
    hits.push({
      name: hero.name,
      image: hero.portrait ?? changes[0].change!.icon,
      verdict: verdictOf(
        changes.flatMap((c) => c.change!.lines),
        changes.some((c) => c.change!.rework),
      ),
      patches: changes.map(({ patch, change }) => ({
        title: patch.title,
        date: patch.date.toISOString(),
        url: patch.url,
        lines: change!.lines,
      })),
      dev: changes.find((c) => c.change!.dev)?.change!.dev,
      why: `#${i + 1} hero by time played`,
    });
  });
  return hits;
}

// ---------- Counter-Strike 2 ----------

type NewsItem = { title: string; url: string; date: number; contents: string; feedname: string };

/** Valve's own update posts for an app, newest first. */
async function getSteamUpdates(appid: number): Promise<NewsItem[]> {
  const res = await fetch(
    `https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=${appid}&count=15&maxlength=0&feeds=steam_community_announcements`,
    { next: { revalidate: 6 * 3600 } },
  );
  if (!res.ok) return [];
  const data = (await res.json()) as { appnews?: { newsitems?: NewsItem[] } };
  return data.appnews?.newsitems ?? [];
}

/** Steam BBCode → one plain line per bullet or paragraph. */
export const bbLines = (bb: string) =>
  bb
    .split(/\[\*\]|\[\/?p\]|\[\/?list\]|\n/)
    .map((l) => decode(l.replace(/\[\/?[a-z0-9*]+[^\]]*\]/gi, "").replace(/\\\[/g, "[")))
    .filter((l) => l.length > 3 && !/^\[.*\]$/.test(l));

// Cosmetic and bug fix lines that don't change how a weapon or map plays.
const NOISE = /^fixed|animation|inspect|sound|skin|sticker|charm|keychain|graffiti|localization|stability|texture|lighting|clipping/i;

const TOP_WEAPONS = 5;
const TOP_MAPS = 3;

async function cs2Hits(steamid: string): Promise<PatchHit[]> {
  const [picks, updates] = await Promise.all([getCs2Stats(steamid), getSteamUpdates(730)]);
  if (!picks) return [];
  const since = Date.now() / 1000 - PATCH_DAYS * 86400;
  const recent = updates.filter((u) => u.date >= since && /update/i.test(u.title));
  const targets = [
    ...picks.weapons.slice(0, TOP_WEAPONS).map((w, i) => ({ ...w, why: `#${i + 1} weapon by kills` })),
    ...picks.maps.slice(0, TOP_MAPS).map((m, i) => ({ ...m, why: `#${i + 1} map by rounds played` })),
  ];

  const hits: PatchHit[] = [];
  for (const t of targets) {
    const pattern = new RegExp(`(^|[^a-z0-9-])(${t.aliases.map((a) => a.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&")).join("|")})([^a-z0-9-]|$)`, "i");
    const patches: PatchRef[] = recent
      .map((u) => ({
        title: u.title,
        date: new Date(u.date * 1000).toISOString(),
        url: u.url,
        lines: bbLines(u.contents)
          .filter((l) => pattern.test(l) && !NOISE.test(l))
          .map((text) => ({ text, effect: effectOf(text) })),
      }))
      .filter((p) => p.lines.length);
    if (!patches.length) continue;
    hits.push({ name: t.name, verdict: verdictOf(patches.flatMap((p) => p.lines)), patches, why: t.why });
  }
  return hits;
}

// ---------- All games ----------

export type GameWatch = { appid: number; name: string; hits: PatchHit[] };

const WATCHERS: Record<number, (steamid: string) => Promise<PatchHit[]>> = {
  2357570: () => overwatchHits(),
  730: cs2Hits,
  // Siege: add once there's a source for your top operators.
};

export const recentlyPlayed = (g?: OwnedGame) => !!g?.rtime_last_played && g.rtime_last_played * 1000 >= Date.now() - PATCH_DAYS * DAY;

/** Patch changes to your top picks, for the coaching games you've played in the last PATCH_DAYS days. */
export async function getPatchWatch(steamid: string, owned: OwnedGame[]): Promise<GameWatch[]> {
  const byId = new Map(owned.map((g) => [g.appid, g]));
  const games = Object.keys(WATCHERS)
    .map(Number)
    .filter((appid) => recentlyPlayed(byId.get(appid)))
    .sort((a, b) => byId.get(b)!.rtime_last_played! - byId.get(a)!.rtime_last_played!);
  const results = await Promise.all(
    games.map(async (appid) => ({
      appid,
      name: byId.get(appid)!.name,
      hits: await WATCHERS[appid](steamid).catch(() => []),
    })),
  );
  return results.filter((r) => r.hits.length);
}
