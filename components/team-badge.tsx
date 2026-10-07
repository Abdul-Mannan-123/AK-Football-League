"use client";

import { useState } from "react";

export function TeamBadge({ src, alt, className = "h-12 w-12" }: { src: string | null; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  const imageSrc = src && !src.startsWith("http")
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${src}`
    : src;
  return (
    <div className={`relative grid place-items-center overflow-hidden rounded-full border border-white/20 bg-white p-1 ${className}`}>
      {imageSrc && !failed ? <img src={imageSrc} alt={`${alt} badge`} className="h-full w-full object-contain p-1" onError={() => setFailed(true)} /> : <span className="grid h-full w-full place-items-center rounded-full bg-electric text-xs font-black text-ink">{alt.slice(0, 3)}</span>}
    </div>
  );
}
