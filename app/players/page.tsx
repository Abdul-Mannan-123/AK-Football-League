import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import PublicHeader from "@/components/public-header";
import PlayerDirectory from "@/components/player-directory";

export const revalidate = 30;

export default async function PlayersPage() {
  const supabase = await createClient();
  const [{ data }, { data: statRows }] = supabase ? await Promise.all([
    supabase.from("players").select("id,name,photo_url,jersey_number,position,teams(name,short_code)").eq("is_active", true).order("name"),
    supabase.from("player_stats_view").select("*"),
  ]) : [{ data: [] }, { data: [] }];
  const stats = new Map((statRows ?? []).map((row) => [row.player_id, row]));
  const players = (data ?? []).map((player) => {
    const team = Array.isArray(player.teams) ? player.teams[0] : player.teams;
    const row = stats.get(player.id);
    return {
      id: player.id, name: player.name, photo_url: player.photo_url, jersey_number: player.jersey_number, position: player.position,
      team: team as { name: string; short_code: string } | null,
      stats: { goals: row?.goals ?? 0, assists: row?.assists ?? 0, yellow_cards: row?.yellow_cards ?? 0, red_cards: row?.red_cards ?? 0, man_of_matches: row?.man_of_matches ?? 0, average_rating: row?.average_rating ?? null, saves: row?.saves ?? 0 },
    };
  });
  return <main className="public-theme min-h-screen bg-ink"><PublicHeader /><header className="border-b border-white/10 px-5 py-6"><div className="mx-auto flex max-w-7xl items-center justify-between"><div><p className="text-xs font-black uppercase tracking-[0.25em] text-electric">AKFL directory</p><h1 className="mt-2 font-display text-4xl font-black text-white">Players</h1><p className="mt-2 text-white/50">Search every active player and compare their matchday numbers.</p></div><Link href="/" className="text-sm font-bold text-white/60 hover:text-electric">Home</Link></div></header><div className="mx-auto max-w-7xl px-5 py-10"><PlayerDirectory players={players} />{players.length === 0 && <p className="mt-5 rounded-2xl border border-dashed border-white/15 p-8 text-center text-white/50">No player profiles have been added yet.</p>}</div></main>;
}
