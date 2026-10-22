import { NextResponse } from "next/server";
import { clearSession } from "@/lib/session";

export async function POST() {
  await clearSession();
  return NextResponse.redirect(process.env.APP_URL ?? "http://localhost:3000", 303);
}
