import Link from "next/link";
import { ArrowLeft, ClipboardList } from "lucide-react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PublicHeader from "@/components/public-header";

export const revalidate = 30;

export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  if (!supabase) notFound();
  const { data: match } = await supabase.from("matches").select("id,kickoff_time,pitch_location,status,home_score,away_score,home_team_id,away_team_id").eq("id", id).maybeSingle();
  if (!match) notFound();
  const [{ data: teams, error: teamsError }, { data: lineupRows, error: lineupsError }] = await Promise.all([
    supabase.from("teams").select("id,name,short_code").in("id", [match.home_team_id, match.away_team_id]),
    supabase.from("lineups").select("id,team_id,player_id,is_starting,position").eq("match_id", id),
  ]);
  if (teamsError || lineupsError) {
    console.error("Public match detail load failed", teamsError ?? lineupsError);
  }
  const lineups = lineupRows ?? [];
  const playerIds = lineups.map((row) => row.player_id);
  const { data: players, error: playersError } = playerIds.length
    ? await supabase.from("players").select("id,name,jersey_number,position").in("id", playerIds)
    : { data: [], error: null };
  if (playersError) console.error("Public lineup player load failed", playersError);
  const teamById = new Map((teams ?? []).map((team) => [team.id, team]));
  const playerById = new Map((players ?? []).map((player) => [player.id, player]));
  const home = teamById.get(match.home_team_id);
  const away = teamById.get(match.away_team_id);
  if (!home || !away) notFound();
  return <main className="public-theme min-h-screen bg-ink"><PublicHeader /><section className="mx-auto max-w-5xl px-5 py-10"><Link href="/matches" className="text-xs font-black uppercase tracking-[0.25em] text-electric"><ArrowLeft size={14} className="mr-2 inline" />Match center</Link><article className="mt-8 rounded-3xl border border-white/10 bg-panel p-6 text-center sm:p-10"><p className="text-xs font-black uppercase tracking-widest text-white/45">{new Date(match.kickoff_time).toLocaleString()} · {match.pitch_location ?? "Venue TBC"}</p><div className="mt-8 grid items-center gap-6 md:grid-cols-[1fr_auto_1fr]"><h1 className="font-display text-2xl font-black text-white">{home.name}</h1><p className="font-display text-4xl font-black text-electric">{match.status === "scheduled" ? "—" : `${match.home_score} - ${match.away_score}`}</p><h1 className="font-display text-2xl font-black text-white">{away.name}</h1></div></article><section className="mt-6 rounded-3xl border border-white/10 bg-panel p-6"><div className="flex items-center gap-3"><ClipboardList className="text-electric" /><div><p className="text-xs font-black uppercase tracking-widest text-electric">Matchday</p><h2 className="font-display text-2xl font-black text-white">Lineups</h2></div></div>{lineupsError ? <p className="mt-6 rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-100">Lineups could not be loaded. Please check that the lineup permissions migration is applied.</p> : <div className="mt-6 grid gap-5 md:grid-cols-2">{[home, away].map((team) => <div key={team.id} className="rounded-2xl border border-white/10 bg-white/5 p-4"><h3 className="font-bold text-white">{team.name}</h3><div className="mt-4 space-y-2">{lineups.filter((entry) => entry.team_id === team.id).map((entry) => { const player = playerById.get(entry.player_id); return <p key={entry.player_id} className="flex justify-between text-sm text-white/70"><span>{player?.jersey_number ? `#${player.jersey_number} ` : ""}{player?.name ?? "Player"}</span><span className="text-white/40">{entry.is_starting ? "Starter" : "Sub"}{entry.position ? ` · ${entry.position}` : ""}</span></p>; })}</div>{!lineups.some((entry) => entry.team_id === team.id) && <p className="mt-4 text-sm text-white/45">Lineup not published yet.</p>}</div>)}</div>}</section></section></main>;
}
