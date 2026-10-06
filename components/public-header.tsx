"use client";

import Link from "next/link";
import { Menu, Trophy, X } from "lucide-react";
import { useState } from "react";

const links = [
  ["Matches", "/matches"],
  ["Tables", "/leagues"],
  ["Players", "/players"],
  ["Officials", "/referees"],
];

export default function PublicHeader() {
  const [open, setOpen] = useState(false);
  return <header className="sticky top-0 z-40 border-b border-electric/25 bg-ink/95 backdrop-blur-xl">
    <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
      <Link href="/" className="flex items-center gap-3" onClick={() => setOpen(false)}><span className="grid h-10 w-10 place-items-center rounded-xl bg-electric text-white shadow-glow"><Trophy size={21} /></span><span><span className="block text-sm font-black uppercase tracking-[0.22em] text-white">AKFL</span><span className="block text-[10px] uppercase tracking-[0.28em] text-white/45">AK Football League</span></span></Link>
      <nav className="hidden items-center gap-6 lg:flex">{links.map(([label, href]) => <Link key={href} href={href} className="text-xs font-black uppercase tracking-[0.14em] text-white/55 hover:text-sky">{label}</Link>)}<Link href="/admin" className="rounded-lg border border-electric/25 px-3 py-2 text-xs font-black uppercase tracking-widest text-white/65 hover:border-sky hover:text-sky">Admin</Link></nav>
      <button type="button" onClick={() => setOpen(!open)} className="rounded-xl border border-white/10 p-2 text-white lg:hidden" aria-label={open ? "Close navigation" : "Open navigation"}>{open ? <X size={20} /> : <Menu size={20} />}</button>
    </div>
    {open && <nav className="grid gap-2 border-t border-white/10 px-5 py-4 lg:hidden">{links.map(([label, href]) => <Link key={href} href={href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-sm font-black uppercase tracking-widest text-white/70 hover:bg-white/5 hover:text-electric">{label}</Link>)}<Link href="/admin" onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-sm font-black uppercase tracking-widest text-white/70 hover:bg-white/5 hover:text-electric">Admin portal</Link></nav>}
  </header>;
}
