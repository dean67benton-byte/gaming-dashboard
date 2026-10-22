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

const portrait = (hash: string) => `https://d15f34w2p8l1cc.cloudfront.net/overwatch/${hash}.png`;

export const demoOwHeroes: HeroInfo[] = [
  { key: "ana", name: "Ana", portrait: portrait("985b06beae46b7ba3ca87d1512d0fc62ca7f206ceca58ef16fc44d43a1cc84ed"), role: "support" },
  { key: "kiriko", name: "Kiriko", portrait: portrait("408603fe037e8576078eaac5eab2fb251489ced4003b11f5f522776d43d0b83d"), role: "support" },
  { key: "lucio", name: "Lúcio", portrait: portrait("040bb13f5123ab93faad2f95627ba184608aef4b2469a4d3003859c7087df044"), role: "support" },
  { key: "mercy", name: "Mercy", portrait: portrait("3bfb8bd8ec827e53d870f1238ab73d8aa1f5dbfbcfaaf7f96ffcd35b5c6102ab"), role: "support" },
  { key: "junker-queen", name: "Junker Queen", portrait: portrait("06eeecb359f311f43a8f5121d4f9f3a93c565d70b30e94ef543c05596c9a39dc"), role: "tank" },
  { key: "reinhardt", name: "Reinhardt", portrait: portrait("551fbe070c16fdfcc17f7f1de63af22c53e7d2f1340fc2f3172441504527bc4e"), role: "tank" },
  { key: "soldier-76", name: "Soldier: 76", portrait: portrait("c93b5f0a528c40473188f77cc2a267aee7d5b6cf5c9e104105d634b4388674e2"), role: "damage" },
  { key: "cassidy", name: "Cassidy", portrait: portrait("9240cd64cc8ef58df9acbf55204ab1b5d8578f743fda5931f0dbccbd75ab841b"), role: "damage" },
  { key: "tracer", name: "Tracer", portrait: portrait("4504f6f15cb3feaa92ecd38e01dcf751cb5abdac2e0bb52d0555727e53277502"), role: "damage" },
];
