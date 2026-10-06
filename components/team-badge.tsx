import Image from "next/image";

export function TeamBadge({ src, alt, className = "h-12 w-12" }: { src: string | null; alt: string; className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-full border border-white/10 bg-white p-1 ${className}`}>
      {src ? <Image src={src} alt={`${alt} badge`} fill className="object-contain p-1" /> : <span className="grid h-full place-items-center text-xs font-black text-ink">{alt.slice(0, 3)}</span>}
    </div>
  );
}
