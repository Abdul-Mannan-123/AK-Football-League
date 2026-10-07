import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import PublicHeader from "@/components/public-header";
import MatchCenter, { type PublicMatch } from "@/components/match-center";

export const revalidate = 30;

export default async function MatchesPage() {
  const supabase = await createClient();
  let matches: PublicMatch[] = [];
  let loadError = "";
  if (supabase) {
    const [matchResult, teamResult] = await Promise.all([
      supabase.from("matches").select("id,kickoff_time,pitch_location,status,home_score,away_score,home_team_id,away_team_id").in("status", ["scheduled", "live", "halftime", "completed"]).order("kickoff_time"),
      supabase.from("teams").select("id,name,short_code,logo_url").order("name"),
    ]);
    if (matchResult.error || teamResult.error) {
      loadError = "Match data could not be loaded. Please try again shortly.";
      console.error("Match center load failed", matchResult.error ?? teamResult.error);
    } else {
      const teamById = new Map((teamResult.data ?? []).map((team) => [team.id, team]));
      const matchIds = (matchResult.data ?? []).map((match) => match.id);
      const { data: events, error: eventError } = matchIds.length
        ? await supabase.from("match_events").select("id,match_id,event_type,minute,player_id").in("match_id", matchIds)
        : { data: [], error: null };
      if (eventError) console.error("Match event load failed", eventError);
      const playerIds = (events ?? []).map((event) => event.player_id).filter(Boolean);
      const { data: players } = playerIds.length ? await supabase.from("players").select("id,name").in("id", playerIds) : { data: [] };
      const playerById = new Map((players ?? []).map((player) => [player.id, player.name]));
      const eventsByMatch = new Map<string, PublicMatch["events"]>();
      for (const event of events ?? []) {
        const current = eventsByMatch.get(event.match_id) ?? [];
        current.push({ id: event.id, event_type: event.event_type, minute: event.minute, player_name: playerById.get(event.player_id) ?? "Unknown player" });
        eventsByMatch.set(event.match_id, current);
      }
      matches = (matchResult.data ?? []).flatMap((match) => {
        const home = teamById.get(match.home_team_id);
        const away = teamById.get(match.away_team_id);
        return home && away ? [{ ...match, home, away, events: eventsByMatch.get(match.id) ?? [] } satisfies PublicMatch] : [];
      });
    }
  }
  return <main className="public-theme min-h-screen bg-ink"><PublicHeader /><header className="border-b border-white/10 px-5 py-10"><div className="mx-auto max-w-7xl"><Link href="/" className="text-xs font-black uppercase tracking-[0.25em] text-electric"><ArrowLeft size={14} className="mr-2 inline" />AKFL home</Link><h1 className="mt-4 font-display text-4xl font-black text-white sm:text-5xl">Match center</h1><p className="mt-2 text-white/50">Every fixture, result and live match event in one place.</p></div></header><div className="mx-auto max-w-7xl px-5 py-10">{loadError ? <p className="rounded-2xl border border-red-400/30 bg-red-400/10 p-10 text-center text-red-100">{loadError}</p> : <MatchCenter matches={matches} />}</div></main>;
}
