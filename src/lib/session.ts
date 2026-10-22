import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "gd_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not set");
  return s;
}

const sign = (value: string) => createHmac("sha256", secret()).update(value).digest("base64url");

export async function setSession(steamid: string) {
  const store = await cookies();
  store.set(COOKIE, `${steamid}.${sign(steamid)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSession() {
  (await cookies()).delete(COOKIE);
}

/** Returns the signed-in SteamID64, or null. */
export async function getSession(): Promise<string | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const [steamid, sig] = raw.split(".");
  if (!steamid || !sig) return null;
  const expected = Buffer.from(sign(steamid));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return steamid;
}
