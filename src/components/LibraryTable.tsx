"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type LibraryRow = {
  appid: number;
  name: string;
  hours: number;
  hours2w: number;
  lastPlayed: number | null; // unix seconds
  href?: string; // deep-dive page, when one exists
};

type SortKey = "hours" | "name" | "lastPlayed";

const formatDate = (ts: number | null) =>
  ts ? new Date(ts * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "Never";

export default function LibraryTable({ rows }: { rows: LibraryRow[] }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("hours");
  const [hideUnplayed, setHideUnplayed] = useState(false);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((r) => (!q || r.name.toLowerCase().includes(q)) && (!hideUnplayed || r.hours > 0))
      .sort((a, b) => {
        if (sort === "name") return a.name.localeCompare(b.name);
        if (sort === "lastPlayed") return (b.lastPlayed ?? 0) - (a.lastPlayed ?? 0);
        return b.hours - a.hours;
      });
  }, [rows, query, sort, hideUnplayed]);

  const header = (key: SortKey, label: string, align = "text-left") => (
    <th className={`px-3 py-2 font-medium ${align}`}>
      <button
        onClick={() => setSort(key)}
        className={sort === key ? "text-foreground" : "text-muted hover:text-foreground"}
      >
        {label}
        {sort === key && " ↓"}
      </button>
    </th>
  );

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your library"
          className="w-full max-w-xs rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-accent"
        />
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={hideUnplayed} onChange={(e) => setHideUnplayed(e.target.checked)} />
          Hide unplayed
        </label>
        <span className="ml-auto text-sm text-muted">{shown.length} games</span>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-background/50">
            <tr>
              {header("name", "Game")}
              {header("hours", "Hours", "text-right")}
              <th className="px-3 py-2 text-right font-medium text-muted">Last 2 weeks</th>
              {header("lastPlayed", "Last played", "text-right")}
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.appid} className="border-t border-border">
                <td className="px-3 py-2">
                  {r.href ? (
                    <Link href={r.href} className="text-accent hover:underline">
                      {r.name}
                    </Link>
                  ) : (
                    r.name
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{r.hours.toLocaleString()}</td>
                <td className="px-3 py-2 text-right tabular-nums text-muted">{r.hours2w ? r.hours2w : "–"}</td>
                <td className="px-3 py-2 text-right text-muted">{formatDate(r.lastPlayed)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
