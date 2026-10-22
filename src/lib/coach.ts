import type { HeroRow, OwStats, OwSummary, Role, StatBlock } from "./overwatch";
import { formatRank, hoursFromSeconds, MIN_GAMES, ROLES } from "./overwatch";

// Free coaching: rule-based tips computed from the stats, plus a ready-made
// prompt the player can paste into their own Claude chat for a deeper review.

export type Tips = { focus: string[]; avoid: string[]; practice: string[] };

const ROLE_NAME: Record<Role, string> = { tank: "Tank", damage: "Damage", support: "Support" };
const MIN_ROLE_GAMES = 10;
const pct = (n: number) => `${n.toFixed(0)}%`;
const games = (n: number) => `${n} game${n === 1 ? "" : "s"}`;

export function buildTips(summary: OwSummary | null, stats: OwStats, heroes: HeroRow[]): Tips {
  const focus: string[] = [];
  const avoid: string[] = [];
  const practice: string[] = [];
  const pc = summary?.competitive?.pc;

  // Roles
  const roles = ROLES.map((role) => ({ role, s: stats.roles?.[role] }))
    .filter((r): r is { role: Role; s: StatBlock } => !!r.s && r.s.games_played >= MIN_ROLE_GAMES)
    .sort((a, b) => b.s.winrate - a.s.winrate);
  const bestRole = roles[0];
  const worstRole = roles.length > 1 ? roles[roles.length - 1] : undefined;
  if (bestRole && bestRole.s.winrate >= 50) {
    focus.push(`${ROLE_NAME[bestRole.role]} is your best role: ${pct(bestRole.s.winrate)} over ${games(bestRole.s.games_played)}. Queue it when you want to climb.`);
  }
  if (worstRole && worstRole.s.winrate < 48) {
    avoid.push(`${ROLE_NAME[worstRole.role]} is pulling you down: ${pct(worstRole.s.winrate)} over ${games(worstRole.s.games_played)}.`);
  }

  // Heroes
  const qualified = heroes.filter((h) => h.games_played >= MIN_GAMES);
  const byWin = [...qualified].sort((a, b) => b.winrate - a.winrate);
  for (const h of byWin.slice(0, 3).filter((h) => h.winrate >= 50)) {
    focus.push(`${h.name}: ${pct(h.winrate)} win over ${games(h.games_played)}.`);
  }
  for (const h of byWin.slice(-3).reverse().filter((h) => h.winrate < 45)) {
    avoid.push(`${h.name}: ${pct(h.winrate)} win over ${games(h.games_played)}. Keep it for quick play until it improves.`);
  }
  heroes.slice(0, 4).forEach((h, i) => {
    if (h.games_played >= MIN_GAMES && h.winrate >= 45 && h.winrate < 50) {
      avoid.push(`${h.name} is your #${i + 1} most played hero but wins only ${pct(h.winrate)}.`);
    }
  });

  // Deaths compared with the same role
  for (const h of qualified) {
    const roleDeaths = h.role ? stats.roles?.[h.role]?.average.deaths : undefined;
    if (roleDeaths && h.average.deaths > roleDeaths * 1.2) {
      practice.push(
        `You die ${h.average.deaths.toFixed(1)} times per 10 min on ${h.name}, vs ${roleDeaths.toFixed(1)} across your ${ROLE_NAME[h.role!].toLowerCase()} heroes. Play closer to cover and track enemy cooldowns before committing.`,
      );
    }
  }

  // Hero pool size
  const played = heroes.filter((h) => h.games_played > 0);
  const total = played.reduce((sum, h) => sum + h.time_played, 0);
  if (played.length >= 8 && total && played[0].time_played / total < 0.25) {
    practice.push(`Your time is spread across ${played.length} heroes. Narrowing to 2–3 per role usually climbs faster.`);
  }

  // Winning roles that should climb
  for (const { role, s } of roles) {
    const rank = pc?.[role];
    if (rank && s.winrate >= 55) {
      practice.push(`You win ${pct(s.winrate)} on ${ROLE_NAME[role]} at ${formatRank(rank)}, so you should climb there. Keep queuing it.`);
    }
  }

  return { focus: focus.slice(0, 4), avoid: avoid.slice(0, 4), practice: practice.slice(0, 4) };
}

const line = (name: string, s: StatBlock) =>
  `${name}: ${s.games_played} games, ${s.winrate}% win, ${hoursFromSeconds(s.time_played)}h, KDA ${s.kda}, per 10 min: ${s.average.eliminations} elims, ${s.average.deaths} deaths, ${s.average.damage} dmg, ${s.average.healing} heal`;

/** A self-contained prompt to paste into Claude chat. */
export function coachingPrompt(summary: OwSummary | null, stats: OwStats, heroes: HeroRow[]) {
  const pc = summary?.competitive?.pc;
  const ranks = ROLES.map((r) => `${r}: ${formatRank(pc?.[r] ?? null)}`).join(", ");
  return [
    "You are an Overwatch 2 coach. Review my competitive stats below.",
    "Base every point on the numbers and cite them. Treat heroes with fewer than 5 games as too small a sample.",
    "Tell me: (1) a short read on my playstyle, (2) heroes and roles to lean into, (3) what to cut back on, (4) specific things to practice next.",
    "",
    `Current ranks (season ${pc?.season ?? "?"}): ${ranks}`,
    stats.general ? line("Overall", stats.general) : "",
    "Roles:",
    ...Object.entries(stats.roles ?? {}).map(([role, s]) => "- " + line(role, s)),
    "Heroes (most played first):",
    ...heroes.filter((h) => h.games_played > 0).slice(0, 15).map((h) => "- " + line(`${h.name} (${h.role ?? "?"})`, h)),
  ]
    .filter((l) => l !== undefined)
    .join("\n");
}
