"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toggleFavorite } from "@/app/friends/actions";

export type FriendChip = { steamid: string; name: string; avatar: string; status: string; inGame: boolean; online: boolean };

// Favorites row on top, then everyone else, with search for long friend lists.
export default function FriendPicker({ friends, favorites, selected }: { friends: FriendChip[]; favorites: string[]; selected?: string }) {
  const [favs, setFavs] = useState(() => new Set(favorites));
  const [query, setQuery] = useState("");
  const [, startTransition] = useTransition();

  const toggle = (id: string) => {
    const on = !favs.has(id);
    setFavs((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
    startTransition(() => toggleFavorite(id, on));
  };

  const q = query.trim().toLowerCase();
  const shown = friends.filter((f) => !q || f.name.toLowerCase().includes(q));
  const favorite = shown.filter((f) => favs.has(f.steamid));
  const rest = shown.filter((f) => !favs.has(f.steamid));

  const row = (list: FriendChip[]) => (
    <div className="no-scrollbar -mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1">
      {list.map((f) => {
        const fav = favs.has(f.steamid);
        return (
          <div key={f.steamid} className="relative w-52 shrink-0 snap-start">
            <Link
              href={`/friends?friend=${f.steamid}`}
              scroll={false}
              className={`card flex items-center gap-3 py-2.5 pl-3 pr-9 ${f.steamid === selected ? "border-accent bg-accent/10" : "hover:border-accent/60"}`}
            >
              <Avatar friend={f} size="h-9 w-9" />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{f.name}</div>
                <div className={`truncate text-xs ${f.inGame ? "text-good" : "text-muted"}`}>{f.status}</div>
              </div>
            </Link>
            <button
              onClick={() => toggle(f.steamid)}
              title={fav ? "Remove from favorites" : "Add to favorites"}
              aria-pressed={fav}
              className={`absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg hover:bg-surface-2 ${
                fav ? "text-[#fbbf24]" : "text-muted/50 hover:text-foreground"
              }`}
            >
              <svg viewBox="0 0 24 24" fill={fav ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" className="h-4 w-4">
                <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9z" />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="mb-4 space-y-3">
      {friends.length > 8 && (
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${friends.length} friends`}
          className="w-full max-w-xs rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
        />
      )}
      {favorite.length > 0 && (
        <div>
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Favorites</h2>
          {row(favorite)}
        </div>
      )}
      {rest.length > 0 && (
        <div>
          {favorite.length > 0 && <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">All friends</h2>}
          {row(rest)}
        </div>
      )}
      {q && !shown.length && <p className="text-sm text-muted">No friends match &ldquo;{query}&rdquo;.</p>}
      {!favorite.length && !q && <p className="text-xs text-muted">Tap the star on a friend to pin them here as a favorite.</p>}
    </div>
  );
}

export function Avatar({ friend, size }: { friend: Pick<FriendChip, "name" | "avatar" | "inGame" | "online">; size: string }) {
  const dot = friend.inGame ? "bg-good" : friend.online ? "bg-accent" : "bg-muted/50";
  return (
    <div className={`relative shrink-0 ${size}`}>
      {friend.avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={friend.avatar} alt="" className="h-full w-full rounded-full" />
      ) : (
        <div className="flex h-full w-full items-center justify-center rounded-full bg-surface-2 font-semibold text-muted">
          {friend.name[0]?.toUpperCase()}
        </div>
      )}
      <span className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full ring-2 ring-surface ${dot}`} />
    </div>
  );
}
