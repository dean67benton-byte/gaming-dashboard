import { NextResponse, type NextRequest } from "next/server";
import { appUrl as getAppUrl } from "@/lib/app-url";
import { setSession } from "@/lib/session";

const CLAIMED_ID = /^https:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/;

// Steam redirects here after sign in. We ask Steam to confirm the response
// is genuine before trusting the SteamID in it.
export async function GET(req: NextRequest) {
  const appUrl = getAppUrl(req);
  const params = new URLSearchParams(req.nextUrl.searchParams);
  const steamid = params.get("openid.claimed_id")?.match(CLAIMED_ID)?.[1];
  const returnTo = params.get("openid.return_to") ?? "";

  if (!steamid || !returnTo.startsWith(`${appUrl}/api/auth/steam/callback`)) {
    return NextResponse.redirect(`${appUrl}/?error=signin`);
  }

  params.set("openid.mode", "check_authentication");
  const res = await fetch("https://steamcommunity.com/openid/login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  const body = await res.text();
  if (!/is_valid\s*:\s*true/.test(body)) {
    return NextResponse.redirect(`${appUrl}/?error=signin`);
  }

  await setSession(steamid);
  return NextResponse.redirect(appUrl);
}
