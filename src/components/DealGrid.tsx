"use client";

import { useState } from "react";
import GameArt from "./GameArt";
import type { Price } from "@/lib/deals";

export type DealCard = {
  appid: number;
  name: string;
  art: string;
  price: Price | null;
  reviews: string; // e.g. "94% of 377K"
  reasons: string[];
  singleplayer: boolean;
  multiplayer: boolean;
  coop: boolean;
};

const MODES = ["All", "Single player", "Multiplayer", "Co-op"] as const;
const PAGE = 9;

// Ranked store picks with a player-mode filter, a few at a time.
export default function DealGrid({ items, empty }: { items: DealCard[]; empty: string }) {
  const [mode, setMode] = useState<(typeof MODES)[number]>("All");
  const [shown, setShown] = useState(PAGE);

  const pool = items.filter(
    (i) => mode === "All" || (mode === "Single player" ? i.singleplayer : mode === "Multiplayer" ? i.multiplayer : i.coop),
  );

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {MODES.map((m) => (
          <button
            key={m}
            onClick={() => {
              setMode(m);
              setShown(PAGE);
            }}
            className={`rounded-full px-3 py-1 text-xs ${mode === m ? "bg-accent text-background" : "bg-surface-2 text-muted hover:text-foreground"}`}
          >
            {m}
          </button>
        ))}
      </div>
      {pool.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pool.slice(0, shown).map((d) => (
            <a
              key={d.appid}
              href={`https://store.steampowered.com/app/${d.appid}`}
              target="_blank"
              rel="noreferrer"
              className="card group overflow-hidden hover:ring-1 hover:ring-accent"
            >
              <div className="relative overflow-hidden">
                <GameArt src={d.art} name={d.name} className="transition-transform duration-300 group-hover:scale-105" />
                {!!d.price?.discount && <DiscountBadge pct={d.price.discount} className="absolute left-3 top-3" />}
              </div>
              <div className="p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-medium">{d.name}</span>
                  {d.price && <PriceTag price={d.price} />}
                </div>
                <p className="text-xs text-muted">{d.reviews}</p>
                <ul className="mt-2 space-y-0.5 text-xs text-muted">
                  {d.reasons.map((r) => (
                    <li key={r}>• {r}</li>
                  ))}
                </ul>
              </div>
            </a>
          ))}
        </div>
      ) : (
        <p className="card p-4 text-sm text-muted">{empty}</p>
      )}
      {pool.length > shown && (
        <button onClick={() => setShown(shown + PAGE)} className="mt-3 w-full rounded-xl bg-surface-2 px-4 py-2 text-sm text-muted hover:text-foreground">
          Show more ({pool.length - shown} left)
        </button>
      )}
    </div>
  );
}

export function DiscountBadge({ pct, className = "" }: { pct: number; className?: string }) {
  return (
    <span className={`rounded-full bg-gradient-to-r from-accent to-accent-2 px-2.5 py-1 text-xs font-semibold text-background ${className}`}>
      -{pct}%
    </span>
  );
}

export function PriceTag({ price }: { price: Price }) {
  return (
    <span className="shrink-0 text-right text-sm tabular-nums">
      {price.original && <span className="mr-1.5 text-xs text-muted line-through">{price.original}</span>}
      <span className={price.discount ? "font-semibold text-good" : ""}>{price.final}</span>
    </span>
  );
}
