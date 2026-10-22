import { NextResponse, type NextRequest } from "next/server";
import { appUrl } from "@/lib/app-url";
import { clearSession } from "@/lib/session";

export async function POST(req: NextRequest) {
  await clearSession();
  return NextResponse.redirect(appUrl(req), 303);
}
