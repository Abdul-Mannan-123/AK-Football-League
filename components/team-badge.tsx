"use client";

import { useState } from "react";

export function TeamBadge({ src, alt, className = "h-12 w-12" }: { src: string | null; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={`relative overflow-hidden rounded-full border border-white/10 bg-white p-1 ${className}`}>
      {src && !failed ? <img src={src} alt={`${alt} badge`} className="h-full w-full object-contain p-1" onError={() => setFailed(true)} /> : <span className="grid h-full place-items-center text-xs font-black text-ink">{alt.slice(0, 3)}</span>}
    </div>
  );
}
