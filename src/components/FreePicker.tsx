"use client";

import { useState } from "react";
import GameArt from "./GameArt";
import type { FreeGame } from "@/lib/friends";

export type FreePick = FreeGame & { art: string; mine: number; theirs: number | null }; // hours

const MODES = ["Any", "Co-op", "PvP", "Party"] as const;

// Random free-to-play multiplayer game, for when nothing you share sounds fun.
export default function FreePicker({ games, friendName }: { games: FreePick[]; friendName?: string }) {
  const [mode, setMode] = useState<(typeof MODES)[number]>("Any");
  const [fresh, setFresh] = useState(false);
  const [pick, setPick] = useState<FreePick | null>(null);

  const pool = games.filter((g) => (mode === "Any" || g.mode === mode) && (!fresh || (g.mine < 1 && (g.theirs ?? 0) < 1)));

  const roll = () => {
    const options = pool.length > 1 ? pool.filter((g) => g.appid !== pick?.appid) : pool;
    setPick(options[Math.floor(Math.random() * options.length)] ?? null);
  };

  return (
    <section className="card p-5">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="font-semibold">Random free game</h2>
        <span className="text-xs text-muted">{pool.length} games</span>
      </div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {MODES.map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`rounded-full px-3 py-1 text-xs ${mode === m ? "bg-accent text-background" : "bg-surface-2 text-muted hover:text-foreground"}`}
          >
            {m}
          </button>
        ))}
      </div>
      <label className="mb-4 flex items-center gap-2 text-sm text-muted">
        <input type="checkbox" className="accent-[var(--accent)]" checked={fresh} onChange={(e) => setFresh(e.target.checked)} />
        {friendName ? `New to you and ${friendName}` : "New to me"}
      </label>

      {pick ? (
        <a
          href={`https://store.steampowered.com/app/${pick.appid}`}
          target="_blank"
          rel="noreferrer"
          className="group mb-4 block overflow-hidden rounded-xl bg-surface-2 hover:ring-1 hover:ring-accent"
        >
          <GameArt key={pick.appid} src={pick.art} name={pick.name} />
          <div className="p-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate font-medium">{pick.name}</span>
              <span className="shrink-0 rounded-full bg-background/60 px-2 py-0.5 text-[11px] text-muted">{pick.mode}</span>
            </div>
            <p className="text-xs text-muted">{pick.blurb}</p>
            <p className="mt-1 text-xs text-muted">
              You: {pick.mine ? `${pick.mine.toLocaleString()} h` : "new"}
              {friendName && ` · ${friendName}: ${pick.theirs === null ? "unknown" : pick.theirs ? `${pick.theirs.toLocaleString()} h` : "new"}`}
            </p>
          </div>
        </a>
      ) : (
        <p className="mb-4 rounded-xl bg-surface-2 px-3 py-6 text-center text-sm text-muted">
          {pool.length ? "Roll for something free to play together." : "Nothing left with these filters."}
        </p>
      )}
      <button
        onClick={roll}
        disabled={!pool.length}
        className="w-full rounded-xl bg-gradient-to-r from-accent to-accent-2 px-4 py-2 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-40"
      >
        {pick ? "Roll again" : "Roll"}
      </button>
    </section>
  );
}
