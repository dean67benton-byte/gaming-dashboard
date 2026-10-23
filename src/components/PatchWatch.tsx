import Portrait from "@/components/Portrait";
import { getPatchWatch, PATCH_DAYS, type Effect, type PatchHit } from "@/lib/patches";
import type { OwnedGame } from "@/lib/steam";

const VERDICT_STYLE: Record<PatchHit["verdict"], string> = {
  Buffed: "bg-good/15 text-good",
  Nerfed: "bg-bad/15 text-bad",
  Mixed: "bg-accent/15 text-accent",
  Changed: "bg-surface-2 text-muted",
  Reworked: "bg-gradient-to-r from-accent to-accent-2 text-background",
};

const EFFECT_MARK: Record<Effect, { mark: string; tone: string }> = {
  buff: { mark: "▲", tone: "text-good" },
  nerf: { mark: "▼", tone: "text-bad" },
  change: { mark: "•", tone: "text-muted" },
};

const formatDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

// Renders nothing when no recent patch touched your top picks.
export default async function PatchWatch({ steamid, owned }: { steamid: string; owned: OwnedGame[] }) {
  const games = await getPatchWatch(steamid, owned).catch(() => []);
  if (!games.length) return null;

  return (
    <section className="mb-6">
      <div className="mb-3">
        <h2 className="text-lg font-semibold">Patch watch</h2>
        <p className="text-sm text-muted">
          Changes to your most played picks from the last {PATCH_DAYS} days, for games you&apos;ve played recently.
        </p>
      </div>
      <div className="space-y-4">
        {games.map((g) => (
          <div key={g.appid}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{g.name}</h3>
            <div className="grid gap-3 lg:grid-cols-2">
              {g.hits.map((hit) => (
                <HitCard key={hit.name} hit={hit} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function HitCard({ hit }: { hit: PatchHit }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        {hit.image !== undefined && <Portrait src={hit.image} name={hit.name} className="h-11 w-11" />}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-semibold">{hit.name}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${VERDICT_STYLE[hit.verdict]}`}>{hit.verdict}</span>
          </div>
          <div className="truncate text-xs text-muted">{hit.why}</div>
        </div>
      </div>
      {hit.patches.map((patch) => (
        <div key={patch.url} className="mt-3">
          <a href={patch.url} target="_blank" rel="noreferrer" className="text-xs font-medium text-accent hover:underline">
            {formatDate(patch.date)} patch ↗
          </a>
          <ul className="mt-1.5 space-y-1.5 text-sm">
            {patch.lines.map((line, i) => (
              <li key={i} className="flex gap-2">
                <span className={`mt-0.5 w-3 shrink-0 text-center text-xs ${EFFECT_MARK[line.effect].tone}`}>{EFFECT_MARK[line.effect].mark}</span>
                <span>
                  {line.label && <span className="font-medium">{line.label}: </span>}
                  <span className="text-foreground/85">{line.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {hit.dev && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-xs text-muted hover:text-foreground">Developer comments</summary>
          <p className="mt-2 text-muted">{hit.dev}</p>
        </details>
      )}
    </div>
  );
}
