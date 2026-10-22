// Hero or player picture, with initials when there's no image.
export default function Portrait({ src, name, className = "h-10 w-10" }: { src?: string | null; name: string; className?: string }) {
  if (!src) {
    return (
      <div className={`flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-surface-2 to-border font-semibold text-muted ${className}`}>
        {name.replace(/[^A-Za-z ]/g, "").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" className={`shrink-0 rounded-xl bg-surface-2 object-cover ${className}`} />;
}
