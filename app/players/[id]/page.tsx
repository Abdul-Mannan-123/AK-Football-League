import Link from "next/link";
import { ArrowLeft, Goal, HandHelping, Shield } from "lucide-react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PublicHeader from "@/components/public-header";

const profiles: Record<string, { name: string; team: string; code: string; number: number; position: string; goals: number; assists: number; appearances: number }> = {
  p1: { name: "Omid Ahmadi", team: "AK United", code: "AKU", number: 9, position: "Forward", goals: 9, assists: 3, appearances: 7 },
  p2: { name: "Farid Sadiq", team: "Northside FC", code: "NSF", number: 10, position: "Midfielder", goals: 6, assists: 7, appearances: 7 },
  p3: { name: "Zubair Rahimi", team: "Kabul Stars", code: "KBS", number: 7, position: "Forward", goals: 7, assists: 4, appearances: 7 },
};

export default async function PlayerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data }, { data: stats }] = supabase ? await Promise.all([
    supabase.from("players").select("id,name,photo_url,jersey_number,position,teams(name,short_code)").eq("id", id).maybeSingle(),
    supabase.from("player_stats_view").select("*").eq("player_id", id).maybeSingle(),
  ]) : [{ data: null }, { data: null }];
  const databasePlayer = data as { id: string; name: string; photo_url: string | null; jersey_number: number | null; position: string; teams: { name: string; short_code: string } | null } | null;
  const fallback = profiles[id];
  if (!databasePlayer && !fallback) notFound();
  const player = databasePlayer
    ? { name: databasePlayer.name, team: databasePlayer.teams?.name ?? "Unassigned", code: databasePlayer.teams?.short_code ?? "AKFL", number: databasePlayer.jersey_number ?? 0, position: databasePlayer.position, goals: stats?.goals ?? 0, assists: stats?.assists ?? 0, appearances: stats?.appearances ?? 0, yellowCards: stats?.yellow_cards ?? 0, redCards: stats?.red_cards ?? 0, manOfMatches: stats?.man_of_matches ?? 0, rating: stats?.average_rating ?? null, saves: stats?.saves ?? 0, photo: databasePlayer.photo_url }
    : { ...fallback!, photo: null };
  const cards = [[<Goal key="g" />, player.goals, "Goals"], [<HandHelping key="a" />, player.assists, "Assists"], [<Shield key="s" />, player.appearances, "Apps"], [null, "rating" in player ? player.rating ?? "—" : 0, "Rating"], [null, "manOfMatches" in player ? player.manOfMatches : 0, "MOTM"], [null, "saves" in player && player.position === "GK" ? player.saves : 0, "Saves"], [null, "yellowCards" in player ? player.yellowCards : 0, "Yellow"], [null, "redCards" in player ? player.redCards : 0, "Red"]];
  return <main className="public-theme min-h-screen bg-ink"><PublicHeader /><header className="border-b border-white/10 px-5 py-6"><div className="mx-auto max-w-5xl"><Link href="/players" className="text-xs font-black uppercase tracking-[0.25em] text-electric"><ArrowLeft size={14} className="mr-2 inline" />Players directory</Link></div></header><div className="mx-auto max-w-5xl px-5 py-12"><section className="grid gap-8 rounded-3xl border border-white/10 bg-panel p-6 sm:grid-cols-[180px_1fr] sm:p-10"><div className="grid h-44 w-44 place-items-center overflow-hidden rounded-3xl bg-gradient-to-br from-electric/40 to-sky/20">{player.photo ? <img src={player.photo} alt={`${player.name} profile`} className="h-full w-full object-cover" /> : <span className="font-display text-7xl font-black text-white">{player.number || "—"}</span>}</div><div><p className="text-xs font-black uppercase tracking-[0.25em] text-electric">{player.code} · {player.position}</p><h1 className="mt-3 font-display text-4xl font-black text-white sm:text-6xl">{player.name}</h1><p className="mt-3 text-lg text-white/55">{player.team}</p><div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">{cards.map(([icon, value, label]) => <div key={label as string} className="rounded-2xl border border-white/10 bg-ink/50 p-4"><div className="text-electric">{icon}</div><p className="mt-3 font-display text-2xl font-black text-white">{value as number}</p><p className="text-[10px] font-black uppercase tracking-widest text-white/40">{label as string}</p></div>)}</div></div></section></div></main>;
}
