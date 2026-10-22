import Anthropic from "@anthropic-ai/sdk";
import type { HeroRow, OwStats, OwSummary, StatBlock } from "./overwatch";
import { formatRank, hoursFromSeconds, MIN_GAMES } from "./overwatch";

export type Coaching = {
  summary: string;
  focus: string[];
  avoid: string[];
  tips: string[];
};

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "focus", "avoid", "tips"],
  properties: {
    summary: { type: "string", description: "Two or three sentences on the player's overall playstyle and results." },
    focus: { type: "array", items: { type: "string" }, description: "Heroes or roles to lean into, each with the stat that backs it." },
    avoid: { type: "array", items: { type: "string" }, description: "Heroes or habits to cut back on, each with the stat that backs it." },
    tips: { type: "array", items: { type: "string" }, description: "Concrete, specific things to practice next." },
  },
};

const SYSTEM = `You are an Overwatch 2 coach reviewing one player's competitive stats.
Base every point on the numbers given, and cite them (win rate, games, deaths per 10 minutes, and so on).
Treat heroes with fewer than ${MIN_GAMES} games as too small a sample to judge.
Be direct and practical. Keep each list to at most four short items.`;

export const coachingEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);

/** Compact text view of the stats so the prompt stays small and readable. */
function statsForPrompt(summary: OwSummary | null, stats: OwStats, heroes: HeroRow[]) {
  const pc = summary?.competitive?.pc;
  const ranks = (["tank", "damage", "support"] as const).map((r) => `${r}: ${formatRank(pc?.[r] ?? null)}`).join(", ");
  const line = (name: string, s: StatBlock) =>
    `${name}: ${s.games_played} games, ${s.winrate}% win, ${hoursFromSeconds(s.time_played)}h, KDA ${s.kda}, per 10 min: ${s.average.eliminations} elims, ${s.average.deaths} deaths, ${s.average.damage} dmg, ${s.average.healing} heal`;

  return [
    `Current ranks (season ${pc?.season ?? "?"}): ${ranks}`,
    stats.general ? line("Overall", stats.general) : "",
    "Roles:",
    ...Object.entries(stats.roles ?? {}).map(([role, s]) => "- " + line(role, s)),
    "Heroes (most played first):",
    ...heroes.slice(0, 15).map((h) => "- " + line(`${h.name} (${h.role ?? "?"})`, h)),
  ].filter(Boolean).join("\n");
}

export async function coachOverwatch(summary: OwSummary | null, stats: OwStats, heroes: HeroRow[]): Promise<Coaching> {
  const client = new Anthropic();
  const response = await client.beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    // On a safety decline, retry on a fallback model chosen by the API.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
    system: SYSTEM,
    messages: [{ role: "user", content: statsForPrompt(summary, stats, heroes) }],
  });

  if (response.stop_reason === "refusal") throw new Error("Claude declined to review these stats.");
  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new Error("Claude returned no coaching.");
  return JSON.parse(text.text) as Coaching;
}
