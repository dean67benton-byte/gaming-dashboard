"use client";

import { useState } from "react";
import type { Tips } from "@/lib/coach";

export default function CoachPanel({ tips, prompt }: { tips: Tips; prompt: string }) {
  const [copied, setCopied] = useState(false);
  const empty = !tips.focus.length && !tips.avoid.length && !tips.practice.length;

  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Copy this and paste it into Claude:", prompt);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <div className="font-medium">Coaching</div>
          <div className="text-sm text-muted">
            Tips from your numbers. For a deeper review, copy your stats and paste them into Claude.
          </div>
        </div>
        <button
          onClick={copy}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-background hover:opacity-90"
        >
          {copied ? "Copied! Paste into Claude" : "Copy for Claude"}
        </button>
      </div>

      {empty ? (
        <p className="mt-4 text-sm text-muted">Play a few more competitive games for tips to show up.</p>
      ) : (
        <div className="mt-4 grid gap-4 text-sm md:grid-cols-3">
          <List title="Lean into" items={tips.focus} tone="text-emerald-400" />
          <List title="Cut back on" items={tips.avoid} tone="text-red-400" />
          <List title="Practice next" items={tips.practice} tone="text-accent" />
        </div>
      )}
    </div>
  );
}

function List({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  return (
    <div>
      <div className={`mb-1 font-medium ${tone}`}>{title}</div>
      {items.length ? (
        <ul className="list-disc space-y-1 pl-5 text-foreground/90">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="text-muted">Nothing stands out.</p>
      )}
    </div>
  );
}
