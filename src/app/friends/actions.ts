"use server";

import { revalidatePath } from "next/cache";
import { setFavorite } from "@/lib/favorites";
import { getSession } from "@/lib/session";
import { isDemo } from "@/lib/steam";

export async function toggleFavorite(friendId: string, on: boolean) {
  const steamid = isDemo() ? "demo" : await getSession();
  if (!steamid || !/^[\w-]{1,32}$/.test(friendId)) return;
  await setFavorite(steamid, friendId, on);
  revalidatePath("/friends");
}
