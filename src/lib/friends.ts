import type { OwnedGame, SteamProfile, StoreInfo } from "./steam";
import { isCoop, isMultiplayer } from "./steam";

export type SharedGame = {
  appid: number;
  name: string;
  mine: OwnedGame;
  theirs: OwnedGame;
  lastPlayed: number; // most recent of either player, unix seconds (0 = never)
};

export type Pick = SharedGame & { score: number; coop: boolean; reasons: string[] };

const HOUR = 60;
const DAY = 86400;

export function sharedGames(mine: OwnedGame[], theirs: OwnedGame[]): SharedGame[] {
  const byId = new Map(theirs.map((g) => [g.appid, g]));
  return mine
    .filter((g) => byId.has(g.appid))
    .map((g) => {
      const t = byId.get(g.appid)!;
      return { appid: g.appid, name: g.name, mine: g, theirs: t, lastPlayed: Math.max(g.rtime_last_played ?? 0, t.rtime_last_played ?? 0) };
    })
    .sort((a, b) => b.lastPlayed - a.lastPlayed || b.mine.playtime_forever + b.theirs.playtime_forever - (a.mine.playtime_forever + a.theirs.playtime_forever));
}

// How warm a game is for one player: 1 if played in the last two weeks, fading over a few months.
function warmth(g: OwnedGame, now: number) {
  if (g.playtime_2weeks) return 1;
  if (!g.rtime_last_played) return 0;
  return Math.exp(-(now - g.rtime_last_played) / DAY / 90);
}

/**
 * "What should we play": shared multiplayer games, scored on how much you've
 * both put in (hours stand in for skill, since Steam has no ratings), how
 * evenly matched you are, and how recently either of you played.
 */
export function rankPicks(shared: SharedGame[], store: Map<number, StoreInfo>, friend: SteamProfile, now = Date.now() / 1000): Pick[] {
  const friendName = friend.personaname;
  return shared
    .filter((s) => {
      const info = store.get(s.appid);
      return info && isMultiplayer(info);
    })
    .map((s) => {
      const coop = isCoop(store.get(s.appid)!);
      const me = s.mine.playtime_forever / HOUR;
      const them = s.theirs.playtime_forever / HOUR;
      const low = Math.min(me, them);
      const high = Math.max(me, them);
      const wMe = warmth(s.mine, now);
      const wThem = warmth(s.theirs, now);

      const inGame = friend.gameid === String(s.appid);

      const score =
        Math.log1p(low) * 2 + Math.log1p(high) * 0.5 + (wMe + wThem) * 3 + (wMe > 0.5 && wThem > 0.5 ? 2 : 0) + (coop ? 1 : 0) + (inGame ? 4 : 0);

      const reasons: string[] = [];
      if (inGame) reasons.push(`${friendName} is in it right now, jump in`);
      if (s.mine.playtime_2weeks && s.theirs.playtime_2weeks) reasons.push("You've both played it in the last two weeks");
      else if (s.theirs.playtime_2weeks) reasons.push(`${friendName} has been playing it lately`);
      else if (s.mine.playtime_2weeks) reasons.push("You've been playing it lately");
      if (low >= 20 && high / Math.max(low, 1) < 3) reasons.push("You're about evenly matched on hours");
      else if (them >= 20 && me < them / 4) reasons.push(`${friendName} has ${Math.round(them)}h, they can show you the ropes`);
      else if (me >= 20 && them < me / 4) reasons.push(`You have ${Math.round(me)}h, you can show ${friendName} the ropes`);
      if (high < 2) reasons.push("Neither of you has really tried it yet");
      if (coop) reasons.push("Co-op");
      return { ...s, score, coop, reasons };
    })
    .sort((a, b) => b.score - a.score);
}

export const presence = (p: SteamProfile) =>
  p.gameextrainfo ? `In ${p.gameextrainfo}` : p.personastate ? "Online" : p.lastlogoff ? `Seen ${ago(p.lastlogoff)}` : "Offline";

// In game first, then online, then by when they were last on.
export const presenceRank = (p: SteamProfile) => (p.gameextrainfo ? 2e10 : p.personastate ? 1e10 : 0) + (p.lastlogoff ?? 0);

export function ago(ts: number, now = Date.now() / 1000) {
  const days = Math.floor((now - ts) / DAY);
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.floor(days / 30)} mo ago`;
  return `${Math.floor(days / 365)} yr ago`;
}

export type FreeGame = { appid: number; name: string; mode: "Co-op" | "PvP" | "Party"; blurb: string };

// Free-to-play multiplayer games on Steam for the random picker.
export const FREE_MULTIPLAYER: FreeGame[] = [
  { appid: 570, name: "Dota 2", mode: "PvP", blurb: "5v5 MOBA, queue as a party" },
  { appid: 440, name: "Team Fortress 2", mode: "PvP", blurb: "Classic class shooter, casual servers" },
  { appid: 730, name: "Counter-Strike 2", mode: "PvP", blurb: "Wingman 2v2 is perfect for a duo" },
  { appid: 2357570, name: "Overwatch 2", mode: "PvP", blurb: "Group up for Quick Play or Stadium" },
  { appid: 1172470, name: "Apex Legends", mode: "PvP", blurb: "Squad battle royale" },
  { appid: 2767030, name: "Marvel Rivals", mode: "PvP", blurb: "6v6 hero shooter with team-up abilities" },
  { appid: 2073850, name: "THE FINALS", mode: "PvP", blurb: "Destructible arena shooter, teams of three" },
  { appid: 1203220, name: "NARAKA: BLADEPOINT", mode: "PvP", blurb: "Melee battle royale in trios" },
  { appid: 2507950, name: "Delta Force", mode: "PvP", blurb: "Extraction and large-scale warfare" },
  { appid: 1240440, name: "Halo Infinite", mode: "PvP", blurb: "Arena multiplayer and Big Team Battle" },
  { appid: 291550, name: "Brawlhalla", mode: "PvP", blurb: "Platform fighter, 2v2 is chaos" },
  { appid: 236390, name: "War Thunder", mode: "PvP", blurb: "Tanks and planes in squads" },
  { appid: 552990, name: "World of Warships", mode: "PvP", blurb: "Naval battles in divisions" },
  { appid: 444090, name: "Paladins", mode: "PvP", blurb: "Hero shooter with loadout cards" },
  { appid: 386360, name: "SMITE", mode: "PvP", blurb: "Third-person MOBA" },
  { appid: 1046930, name: "Dota Underlords", mode: "PvP", blurb: "Auto battler, plays a lot like TFT" },
  { appid: 1449850, name: "Yu-Gi-Oh! Master Duel", mode: "PvP", blurb: "Duel each other 1v1" },
  { appid: 230410, name: "Warframe", mode: "Co-op", blurb: "Space ninja co-op missions" },
  { appid: 1085660, name: "Destiny 2", mode: "Co-op", blurb: "Strikes, raids and Crucible" },
  { appid: 238960, name: "Path of Exile", mode: "Co-op", blurb: "Action RPG, party up for maps" },
  { appid: 1599340, name: "Lost Ark", mode: "Co-op", blurb: "Action MMO dungeons and raids" },
  { appid: 761890, name: "Albion Online", mode: "Co-op", blurb: "Sandbox MMO, gather and fight together" },
  { appid: 1286830, name: "STAR WARS: The Old Republic", mode: "Co-op", blurb: "Story MMO with co-op flashpoints" },
  { appid: 304930, name: "Unturned", mode: "Co-op", blurb: "Zombie survival on a shared server" },
  { appid: 700330, name: "SCP: Secret Laboratory", mode: "Party", blurb: "Asymmetric horror chaos" },
  { appid: 1097150, name: "Fall Guys", mode: "Party", blurb: "Obstacle course knockout in squads" },
  { appid: 1782210, name: "Crab Game", mode: "Party", blurb: "Lobby minigames, best with a crowd" },
  { appid: 1568590, name: "Goose Goose Duck", mode: "Party", blurb: "Social deduction, like Among Us" },
  { appid: 471710, name: "Rec Room", mode: "Party", blurb: "Paintball, quests and silly rooms" },
];

export type StratGame = "Overwatch 2" | "Counter-Strike 2" | "Rainbow Six Siege" | "Any game";

export const STRATS: Record<StratGame, { title: string; rule: string }[]> = {
  "Overwatch 2": [
    { title: "Mirror match", rule: "Everyone on your team picks the same hero as the enemy player across from them." },
    { title: "No healing allowed", rule: "Supports may only use damage abilities. Health packs only." },
    { title: "Melee only", rule: "No primary fire. Abilities and melee are fine." },
    { title: "Hero roulette", rule: "Swap to a random hero every time you die." },
    { title: "Stay grouped", rule: "Nobody moves more than a few steps from the tank. Ever." },
    { title: "Flank squad", rule: "The whole team takes the longest route to every fight." },
    { title: "Ult hoarder", rule: "Nobody uses an ultimate until all five are ready, then you dive together." },
    { title: "One-tricks", rule: "Play your least-played hero in your role all game." },
    { title: "High ground only", rule: "If you're standing on the floor, you're doing it wrong." },
    { title: "Silent game", rule: "No voice comms, pings only." },
  ],
  "Counter-Strike 2": [
    { title: "Rush B, no stop", rule: "Everyone rushes B. No utility, no stopping, no regrets." },
    { title: "Pistols only", rule: "No primaries all half, even on full buy rounds." },
    { title: "Shotgun squad", rule: "Only shotguns and SMGs. Hold close angles." },
    { title: "Utility dump", rule: "Throw every grenade you own in the first 15 seconds." },
    { title: "Scout party", rule: "SSG 08 only. Jump-scouting encouraged." },
    { title: "Fake everything", rule: "Make noise at one site, quietly take the other with the whole team." },
    { title: "Leader picks", rule: "One player calls every buy and every route, no arguing." },
    { title: "Knife rush", rule: "First 20 seconds, knives out, run the shortest path to a site." },
    { title: "Eco warriors", rule: "Nobody buys more than $2,000 worth of gear this half." },
    { title: "Default and wait", rule: "Spread out, take map control, nobody commits until 30 seconds left." },
  ],
  "Rainbow Six Siege": [
    { title: "Shields only", rule: "Every attacker picks a shield operator. Push as a wall." },
    { title: "No drones", rule: "Attackers can't drone. Go in blind." },
    { title: "Roamers everywhere", rule: "Every defender leaves the site and roams." },
    { title: "Secondary only", rule: "Pistols and machine pistols only." },
    { title: "Vertical play", rule: "Attack from the floor above. Make holes, don't enter." },
    { title: "Spawn peek squad", rule: "Every defender takes a spawn peek. Bold." },
    { title: "Recruit rush", rule: "Everyone plays Recruit with a shotgun." },
    { title: "One entry", rule: "Breach only one wall or hatch the whole round, everyone through it." },
    { title: "Gadget roulette", rule: "Throw your gadget the moment the round starts, wherever you're standing." },
    { title: "Silent defense", rule: "No reinforcing. Hold it as it comes." },
  ],
  "Any game": [
    { title: "Follow the leader", rule: "One player leads, everyone else copies their route and loadout." },
    { title: "Swap mains", rule: "Play each other's favorite character or class." },
    { title: "Inverted roles", rule: "Whoever usually supports carries, whoever usually carries supports." },
    { title: "No minimap", rule: "Turn off or ignore the minimap and play on sound and callouts only." },
    { title: "Narrator mode", rule: "One player must narrate everything they do like a sports commentator." },
    { title: "Hardest setting", rule: "Bump the difficulty up one level from your usual." },
  ],
};
