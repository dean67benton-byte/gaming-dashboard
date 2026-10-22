"use client";

import { useEffect, useRef, useState } from "react";

// Steam header art, with a plain tile when a game has none.
export default function GameArt({ src, name, className = "" }: { src: string; name: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  const img = useRef<HTMLImageElement>(null);

  // The image can fail before React hydrates and attaches onError.
  useEffect(() => {
    const el = img.current;
    if (el?.complete && el.naturalWidth === 0) setFailed(true);
  }, []);

  if (failed) {
    return (
      <div
        className={`flex aspect-[460/215] w-full items-center justify-center bg-gradient-to-br from-surface-2 to-background px-3 text-center font-semibold text-muted ${className}`}
      >
        <span className="line-clamp-2">{name}</span>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img ref={img} src={src} alt="" onError={() => setFailed(true)} className={`aspect-[460/215] w-full object-cover ${className}`} />
  );
}
