import { cookies } from "next/headers";
import { redis } from "./redis";

// Favorite friends. Saved in Redis when it's connected so they follow you
// across devices, otherwise in a cookie on this browser.

const COOKIE = "gd_favorites";
const key = (steamid: string) => `favorites:${steamid}`;

export async function getFavorites(steamid: string): Promise<string[]> {
  const call = redis();
  if (call) {
    try {
      return await call<string[]>("SMEMBERS", key(steamid));
    } catch {
      return [];
    }
  }
  return ((await cookies()).get(COOKIE)?.value ?? "").split(",").filter(Boolean);
}

export async function setFavorite(steamid: string, friendId: string, on: boolean) {
  const call = redis();
  if (call) {
    await call(on ? "SADD" : "SREM", key(steamid), friendId);
    return;
  }
  const current = new Set(await getFavorites(steamid));
  if (on) current.add(friendId);
  else current.delete(friendId);
  (await cookies()).set(COOKIE, [...current].join(","), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365 * 5,
  });
}
