import { NextResponse, type NextRequest } from "next/server";
import { getCompetitiveStats, resolvePlayerId } from "@/lib/overwatch";
import { recordSnapshot, trackingEnabled } from "@/lib/sessions";
import { isDemo } from "@/lib/steam";

// Daily Vercel cron (see vercel.json) so sessions are tracked even on days
// the Overwatch page isn't opened.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const tag = process.env.OVERWATCH_BATTLETAG;
  if (isDemo() || !tag || !trackingEnabled()) return NextResponse.json({ skipped: true });

  const id = await resolvePlayerId(tag);
  const stats = id ? await getCompetitiveStats(id) : null;
  if (!id || !stats?.general) return NextResponse.json({ skipped: true, reason: "no public stats" });
  await recordSnapshot(id, stats);
  return NextResponse.json({ ok: true });
}
