"use client";

import { useState } from "react";

// Steam header art, with a plain tile when a game has none.
export default function GameArt({ src, name }: { src: string; name: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="flex aspect-[460/215] w-full items-center justify-center bg-background px-4 text-center text-lg font-semibold text-muted">
        {name}
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" onError={() => setFailed(true)} className="aspect-[460/215] w-full object-cover" />;
}
