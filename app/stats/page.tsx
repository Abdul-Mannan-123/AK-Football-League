import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import PublicHeader from "@/components/public-header";
import { publicAssetUrl } from "@/lib/assets";
import { getHomepageData } from "@/lib/data";

export const revalidate = 30;

type PlayerStatRow = {
  player_id: string;
  goals: number;
  assists: number;
  appearances: number;
  average_rating: number | null;
  photo_url: string | null;
  player_name: string;
  team_name: string;
};

export default async function StatsPage() {
  const supabase = await createClient();
  const { scorers, assists } = await getHomepageData();
  let playerStats: PlayerStatRow[] = [];

  if (supabase) {
    const { data: stats } = await supabase
      .from("player_stats_view")
      .select("player_id,goals,assists,appearances,average_rating")
      .order("goals", { ascending: false })
      .order("assists", { ascending: false })
      .limit(50);
    const playerIds = (stats ?? []).map((row) => row.player_id);
    const [{ data: players }, { data: teams }] = playerIds.length
      ? await Promise.all([
        supabase.from("players").select("id,name,photo_url,team_id").in("id", playerIds),
        supabase.from("teams").select("id,name").order("name"),
      ])
      : [{ data: [] }, { data: [] }];
    const playerById = new Map((players ?? []).map((player) => [player.id, player]));
    const teamById = new Map((teams ?? []).map((team) => [team.id, team.name]));
    playerStats = (stats ?? []).flatMap((row) => {
      const player = playerById.get(row.player_id);
      if (!player) return [];
      return [{
        player_id: row.player_id,
        goals: row.goals ?? 0,
        assists: row.assists ?? 0,
        appearances: row.appearances ?? 0,
        average_rating: row.average_rating ?? null,
        photo_url: player.photo_url,
        player_name: player.name,
        team_name: teamById.get(player.team_id) ?? "Unassigned",
      }];
    });
  }

  return <main className="public-theme min-h-screen bg-ink"><PublicHeader /><header className="border-b border-white/10 px-5 py-10"><div className="mx-auto max-w-7xl"><Link href="/" className="text-xs font-black uppercase tracking-[0.25em] text-electric"><ArrowLeft size={14} className="mr-2 inline" />AKFL home</Link><h1 className="mt-4 font-display text-4xl font-black text-white sm:text-5xl">Top statistics</h1><p className="mt-2 text-white/50">Goals, assists, ratings, and player performance.</p></div></header><section className="mx-auto grid max-w-7xl gap-6 px-5 py-10 lg:grid-cols-2"><StatCard title="Top scorers" rows={scorers.map((row) => ({ name: row.player_name, value: row.total_goals ?? 0, unit: "goals", photo: row.photo_url }))} /><StatCard title="Assist leaders" rows={assists.map((row) => ({ name: row.player_name, value: row.total_assists ?? 0, unit: "assists", photo: row.photo_url }))} /><div className="lg:col-span-2 rounded-3xl border border-white/10 bg-panel p-6"><h2 className="font-display text-2xl font-black text-white">Player statistics</h2>{playerStats.length ? <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{playerStats.map((row) => <Link href={`/players/${row.player_id}`} key={row.player_id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-electric/40"><img src={publicAssetUrl(row.photo_url, "player-photos") ?? "/players/default.png"} alt={`${row.player_name} profile`} className="h-14 w-14 rounded-xl object-cover" /><div className="min-w-0"><p className="truncate font-bold text-white">{row.player_name}</p><p className="truncate text-xs text-white/45">{row.team_name}</p><p className="mt-2 text-xs text-white/70">{row.goals} goals · {row.assists} assists · {row.appearances} appearances</p><p className="text-xs text-electric">Rating: {row.average_rating ?? "—"}</p></div></Link>)}</div> : <p className="mt-5 text-sm text-white/50">Player statistics will appear after matches are recorded.</p>}</div></section></main>;
}

function StatCard({ title, rows }: { title: string; rows: Array<{ name: string; value: number; unit: string; photo: string | null }> }) {
  return <article className="rounded-3xl border border-white/10 bg-panel p-6"><h2 className="font-display text-2xl font-black text-white">{title}</h2>{rows.length ? <div className="mt-5 space-y-3">{rows.map((row, index) => <div key={`${row.name}-${index}`} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4"><div className="flex min-w-0 items-center gap-3"><img src={publicAssetUrl(row.photo, "player-photos") ?? "/players/default.png"} alt="" className="h-10 w-10 rounded-lg object-cover" /><span className="truncate font-bold text-white">{index + 1}. {row.name}</span></div><span className="shrink-0 font-black text-electric">{row.value} {row.unit}</span></div>)}</div> : <p className="mt-5 text-sm text-white/50">No statistics have been recorded yet.</p>}</article>;
}
