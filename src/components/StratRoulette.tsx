"use client";

import { useEffect, useRef, useState } from "react";
import { STRATS, type StratGame } from "@/lib/friends";

const GAMES = Object.keys(STRATS) as StratGame[];

// Spin for a silly rule to play a round by.
export default function StratRoulette({ initial }: { initial?: StratGame }) {
  const [game, setGame] = useState<StratGame>(initial ?? GAMES[0]);
  const [index, setIndex] = useState<number | null>(null);
  const [spinning, setSpinning] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => () => clearInterval(timer.current), []);

  const strats = STRATS[game];
  const strat = index === null ? null : strats[index % strats.length];

  const spin = () => {
    clearInterval(timer.current);
    setSpinning(true);
    let ticks = 0;
    timer.current = setInterval(() => {
      ticks++;
      setIndex(Math.floor(Math.random() * strats.length));
      if (ticks >= 12) {
        clearInterval(timer.current);
        setSpinning(false);
      }
    }, 70);
  };

  return (
    <section className="card p-5">
      <h2 className="mb-3 font-semibold">Strat roulette</h2>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {GAMES.map((g) => (
          <button
            key={g}
            onClick={() => {
              setGame(g);
              setIndex(null);
            }}
            className={`rounded-full px-3 py-1 text-xs ${game === g ? "bg-accent text-background" : "bg-surface-2 text-muted hover:text-foreground"}`}
          >
            {g}
          </button>
        ))}
      </div>
      <div className={`mb-4 min-h-28 rounded-xl bg-surface-2 p-4 ${spinning ? "opacity-70" : ""}`}>
        {strat ? (
          <>
            <div className="text-lg font-bold">{strat.title}</div>
            <p className="mt-1 text-sm text-muted">{strat.rule}</p>
          </>
        ) : (
          <p className="py-6 text-center text-sm text-muted">Spin for a rule to play the next round by.</p>
        )}
      </div>
      <button
        onClick={spin}
        disabled={spinning}
        className="w-full rounded-xl bg-foreground px-4 py-2 text-sm font-semibold text-background hover:bg-accent disabled:opacity-60"
      >
        {strat ? "Spin again" : "Spin"}
      </button>
    </section>
  );
}
