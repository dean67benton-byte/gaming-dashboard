// Steam app id → deep-dive page. Add CS2 and Siege here as they're built.
export const DEEP_DIVES: Record<number, string> = {
  2357570: "/games/overwatch",
};

// Games with (or getting) stats and coaching.
export const COACHING_GAMES = [
  { appid: 2357570, name: "Overwatch 2", blurb: "Hero and role grades, recent sessions, tips" },
  { appid: 730, name: "Counter-Strike 2", blurb: "Maps, weapons and aim stats" },
  { appid: 359550, name: "Rainbow Six Siege", blurb: "Operators, maps and win rates" },
];
