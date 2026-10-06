import type { SelectHTMLAttributes } from "react";

export function Select({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`h-11 w-full rounded-xl border border-white/10 bg-[#111722] px-3 text-sm text-white outline-none transition focus:border-electric focus:ring-2 focus:ring-electric/20 ${className}`}
      {...props}
    />
  );
}
