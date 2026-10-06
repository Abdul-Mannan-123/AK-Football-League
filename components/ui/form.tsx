import type { LabelHTMLAttributes } from "react";

export function FormField({ className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`space-y-2 ${className}`} {...props} />;
}

export function FormLabel({ className = "", ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={`text-xs font-bold uppercase tracking-widest text-white/55 ${className}`} {...props} />;
}
