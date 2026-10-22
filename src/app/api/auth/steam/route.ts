import { NextResponse, type NextRequest } from "next/server";
import { appUrl as getAppUrl } from "@/lib/app-url";

// Starts Steam OpenID 2.0 sign in.
export function GET(req: NextRequest) {
  const appUrl = getAppUrl(req);
  const params = new URLSearchParams({
    "openid.ns": "http://specs.openid.net/auth/2.0",
    "openid.mode": "checkid_setup",
    "openid.return_to": `${appUrl}/api/auth/steam/callback`,
    "openid.realm": appUrl,
    "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
    "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
  });
  return NextResponse.redirect(`https://steamcommunity.com/openid/login?${params}`);
}
