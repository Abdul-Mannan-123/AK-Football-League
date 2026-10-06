import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import PublicHeader from "@/components/public-header";

export const revalidate = 30;

export default async function RefereesPage() {
  const supabase = await createClient();
  const { data } = supabase ? await supabase.from("referees").select("id,name,photo_url,license_level").eq("is_active", true).order("name") : { data: [] };
  const referees = (data ?? []) as Array<{ id: string; name: string; photo_url: string | null; license_level: string | null }>;
  return <main className="public-theme min-h-screen bg-ink"><PublicHeader /><header className="border-b border-white/10 px-5 py-10"><div className="mx-auto max-w-7xl"><p className="text-xs font-black uppercase tracking-[0.25em] text-electric">AKFL officials</p><h1 className="mt-3 font-display text-4xl font-black text-white">Referees</h1><p className="mt-2 text-white/50">The officials trusted to protect the game.</p></div></header><div className="mx-auto max-w-7xl px-5 py-10"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{referees.map((referee) => <article key={referee.id} className="rounded-2xl border border-white/10 bg-panel p-5 transition hover:border-electric/40"><div className="mb-5 grid h-14 w-14 place-items-center overflow-hidden rounded-2xl bg-white/10 text-xl font-black text-electric">{referee.photo_url ? <img src={referee.photo_url} alt="" className="h-full w-full object-cover" /> : referee.name.charAt(0)}</div><h2 className="font-display text-xl font-black text-white">{referee.name}</h2><p className="mt-1 text-sm text-white/50">{referee.license_level || "Match official"}</p></article>)}</div>{referees.length === 0 && <p className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-white/50">No referee profiles have been added yet.</p>}</div></main>;
}
