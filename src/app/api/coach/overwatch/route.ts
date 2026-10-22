import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { coachingEnabled, coachOverwatch } from "@/lib/coach";
import { getCompetitiveStats, getHeroes, getSummary, heroRows } from "@/lib/overwatch";
import { getSession } from "@/lib/session";
import { isDemo } from "@/lib/steam";

export const maxDuration = 60;

// Coaching costs Claude credits, so only signed-in owners may call it.
function allowed(steamid: string | null) {
  if (isDemo()) return true;
  if (!steamid) return false;
  const list = process.env.ALLOWED_STEAMIDS?.split(",").map((s) => s.trim()).filter(Boolean);
  return !list?.length || list.includes(steamid);
}

export async function POST() {
  if (!allowed(await getSession())) {
    return NextResponse.json({ error: "Sign in with the owner's Steam account to use coaching." }, { status: 403 });
  }
  if (!coachingEnabled()) {
    return NextResponse.json({ error: "Add ANTHROPIC_API_KEY to turn on coaching." }, { status: 503 });
  }
  const tag = process.env.OVERWATCH_BATTLETAG ?? "";
  try {
    const [summary, stats, heroes] = await Promise.all([getSummary(tag), getCompetitiveStats(tag), getHeroes()]);
    if (!stats) return NextResponse.json({ error: "No Overwatch stats found." }, { status: 404 });
    return NextResponse.json(await coachOverwatch(summary, stats, heroRows(stats, heroes)));
  } catch (err) {
    const message =
      err instanceof Anthropic.RateLimitError ? "Claude is busy right now. Try again in a minute."
      : err instanceof Anthropic.AuthenticationError ? "ANTHROPIC_API_KEY is not valid."
      : err instanceof Error ? err.message
      : "Coaching failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
