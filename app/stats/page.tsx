import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import PublicHeader from "@/components/public-header";
import { getHomepageData } from "@/lib/data";

export const revalidate = 30;

export default async function StatsPage() {
  const supabase = await createClient();
  const { scorers, assists } = await getHomepageData();
  const { data: players } = supabase ? await supabase.from("player_stats_view").select("*").order("goals", { ascending: false }).limit(50) : { data: [] };
  return <main className="public-theme min-h-screen bg-ink"><PublicHeader /><header className="border-b border-white/10 px-5 py-10"><div className="mx-auto max-w-7xl"><Link href="/" className="text-xs font-black uppercase tracking-[0.25em] text-electric"><ArrowLeft size={14} className="mr-2 inline" />AKFL home</Link><h1 className="mt-4 font-display text-4xl font-black text-white sm:text-5xl">Top statistics</h1><p className="mt-2 text-white/50">Goals, assists, ratings, and player performance.</p></div></header><section className="mx-auto grid max-w-7xl gap-6 px-5 py-10 lg:grid-cols-2"><StatCard title="Top scorers" rows={scorers.map((row) => ({ name: row.player_name, value: row.total_goals ?? 0, unit: "goals" }))} /><StatCard title="Assist leaders" rows={assists.map((row) => ({ name: row.player_name, value: row.total_assists ?? 0, unit: "assists" }))} /><div className="lg:col-span-2 rounded-3xl border border-white/10 bg-panel p-6"><h2 className="font-display text-2xl font-black text-white">Player statistics</h2>{players?.length ? <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{players.map((row) => <div key={row.player_id} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70"><p className="font-bold text-white">{row.player_name ?? row.player_id}</p><p className="mt-2">{row.goals ?? 0} goals · {row.assists ?? 0} assists · {row.appearances ?? 0} appearances</p></div>)}</div> : <p className="mt-5 text-sm text-white/50">Player statistics will appear after matches are recorded.</p>}</div></section></main>;
}

function StatCard({ title, rows }: { title: string; rows: Array<{ name: string; value: number; unit: string }> }) {
  return <article className="rounded-3xl border border-white/10 bg-panel p-6"><h2 className="font-display text-2xl font-black text-white">{title}</h2>{rows.length ? <div className="mt-5 space-y-3">{rows.map((row, index) => <div key={`${row.name}-${index}`} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4"><span className="font-bold text-white">{index + 1}. {row.name}</span><span className="font-black text-electric">{row.value} {row.unit}</span></div>)}</div> : <p className="mt-5 text-sm text-white/50">No statistics have been recorded yet.</p>}</article>;
}
