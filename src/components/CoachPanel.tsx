"use client";

import { useState } from "react";
import type { Coaching } from "@/lib/coach";

export default function CoachPanel({ endpoint }: { endpoint: string }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [coaching, setCoaching] = useState<Coaching | null>(null);
  const [error, setError] = useState("");

  async function run() {
    setState("loading");
    try {
      const res = await fetch(endpoint, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Coaching failed.");
      setCoaching(data);
      setState("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Coaching failed.");
      setState("error");
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <div className="font-medium">AI coaching</div>
          <div className="text-sm text-muted">Claude reviews your competitive stats and tells you what to focus on.</div>
        </div>
        <button
          onClick={run}
          disabled={state === "loading"}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
        >
          {state === "loading" ? "Reviewing…" : coaching ? "Run again" : "Get coaching"}
        </button>
      </div>

      {state === "error" && <p className="mt-3 text-sm text-red-400">{error}</p>}

      {coaching && (
        <div className="mt-4 space-y-4 text-sm">
          <p>{coaching.summary}</p>
          <div className="grid gap-4 md:grid-cols-3">
            <List title="Lean into" items={coaching.focus} tone="text-emerald-400" />
            <List title="Cut back on" items={coaching.avoid} tone="text-red-400" />
            <List title="Practice next" items={coaching.tips} tone="text-accent" />
          </div>
        </div>
      )}
    </div>
  );
}

function List({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  return (
    <div>
      <div className={`mb-1 font-medium ${tone}`}>{title}</div>
      <ul className="list-disc space-y-1 pl-5 text-foreground/90">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
