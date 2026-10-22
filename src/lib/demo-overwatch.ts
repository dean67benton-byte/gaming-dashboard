import type { HeroInfo, OwStats, OwSummary, StatBlock } from "./overwatch";

// Sample Overwatch data for demo mode. Shapes match OverFast responses.

export const demoOwSummary: OwSummary = {
  username: "DemoPlayer",
  avatar: null,
  title: null,
  endorsement: { level: 3 },
  competitive: {
    pc: {
      season: 19,
      tank: { division: "gold", tier: 2 },
      damage: { division: "silver", tier: 1 },
      support: { division: "platinum", tier: 4 },
      open: null,
    },
  },
  privacy: "public",
};

function block(games: number, won: number, hours: number, per10: [number, number, number, number, number]): StatBlock {
  const minutes = hours * 60;
  const [eliminations, assists, deaths, damage, healing] = per10;
  const total = (v: number) => Math.round((v * minutes) / 10);
  return {
    games_played: games,
    games_won: won,
    games_lost: games - won,
    time_played: Math.round(hours * 3600),
    winrate: games ? Math.round((won / games) * 10000) / 100 : 0,
    kda: deaths ? Math.round(((eliminations + assists) / deaths) * 100) / 100 : 0,
    total: {
      eliminations: total(eliminations),
      assists: total(assists),
      deaths: total(deaths),
      damage: total(damage),
      healing: total(healing),
    },
    average: { eliminations, assists, deaths, damage, healing },
  };
}

const heroes: Record<string, StatBlock> = {
  ana: block(58, 34, 14.2, [9.1, 6.2, 5.4, 3900, 11800]),
  kiriko: block(41, 22, 9.8, [11.4, 4.1, 5.9, 4300, 9700]),
  "junker-queen": block(37, 21, 9.1, [19.8, 6.5, 7.6, 9800, 2600]),
  reinhardt: block(29, 12, 7.4, [17.2, 5.1, 8.9, 7900, 0]),
  "soldier-76": block(24, 10, 5.6, [18.1, 3.2, 7.8, 8900, 1100]),
  cassidy: block(15, 9, 3.4, [16.9, 2.8, 6.8, 8300, 0]),
  lucio: block(12, 5, 2.9, [10.2, 8.4, 5.1, 5200, 6900]),
  tracer: block(6, 1, 1.2, [14.1, 2.0, 10.4, 6100, 0]),
  mercy: block(3, 2, 0.7, [1.2, 7.7, 3.0, 400, 13100]),
};

export const demoOwStats: OwStats = {
  general: block(225, 116, 54.3, [14.2, 5.0, 6.9, 6400, 6200]),
  roles: {
    tank: block(66, 33, 16.5, [18.6, 5.9, 8.2, 8900, 1400]),
    damage: block(45, 20, 10.2, [17.0, 2.9, 7.9, 8100, 500]),
    support: block(114, 63, 27.6, [10.0, 6.0, 5.5, 4100, 10800]),
  },
  heroes,
};

export const demoOwHeroes: HeroInfo[] = [
  { key: "ana", name: "Ana", portrait: "", role: "support" },
  { key: "kiriko", name: "Kiriko", portrait: "", role: "support" },
  { key: "lucio", name: "Lúcio", portrait: "", role: "support" },
  { key: "mercy", name: "Mercy", portrait: "", role: "support" },
  { key: "junker-queen", name: "Junker Queen", portrait: "", role: "tank" },
  { key: "reinhardt", name: "Reinhardt", portrait: "", role: "tank" },
  { key: "soldier-76", name: "Soldier: 76", portrait: "", role: "damage" },
  { key: "cassidy", name: "Cassidy", portrait: "", role: "damage" },
  { key: "tracer", name: "Tracer", portrait: "", role: "damage" },
];
