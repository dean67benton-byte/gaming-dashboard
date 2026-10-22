import type { RankInfo } from "@/lib/overwatch";

const COLOR: Record<string, string> = {
  bronze: "#c07a43",
  silver: "#c3ccd6",
  gold: "#f2c14e",
  platinum: "#63d6d0",
  emerald: "#34d399",
  diamond: "#7aa7ff",
  master: "#c9a2ff",
  grandmaster: "#ff9d5c",
  champion: "#ff5c8a",
  ultimate: "#ff5c8a",
};

// Blizzard's rank icon when the profile has one, otherwise a drawn emblem in the division's colour.
export default function RankEmblem({ rank, className = "h-10 w-10" }: { rank: RankInfo; className?: string }) {
  if (rank?.rank_icon) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={rank.rank_icon} alt="" className={`shrink-0 object-contain ${className}`} />;
  }
  const color = rank ? COLOR[rank.division] ?? "#8b90a7" : "#3a3f55";
  return (
    <svg viewBox="0 0 40 40" className={`shrink-0 ${className}`} aria-hidden>
      <path d="M20 3 35 11v12c0 7-6.5 12.5-15 14C11.5 35.5 5 30 5 23V11z" fill={color} fillOpacity={0.18} stroke={color} strokeWidth={2} />
      <path d="M12 16l8 5 8-5M12 22l8 5 8-5" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
      {rank && (
        <text x="20" y="13.5" textAnchor="middle" fontSize="7" fontWeight="800" fill={color}>
          {rank.tier}
        </text>
      )}
    </svg>
  );
}
