import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import PublicHeader from "@/components/public-header";
import MatchCenter, { type PublicMatch } from "@/components/match-center";

export const revalidate = 30;

export default async function MatchesPage() {
  const supabase = await createClient();
  const { data } = supabase ? await supabase.from("matches").select("id, kickoff_time, pitch_location, status, home_score, away_score, home:teams!matches_home_team_id_fkey(name,short_code,logo_url), away:teams!matches_away_team_id_fkey(name,short_code,logo_url), match_events(id,event_type,minute,players(name))").order("kickoff_time") : { data: [] };
  const matches = (data ?? []).map((match) => {
    const value = match as Record<string, unknown>;
    const home = Array.isArray(value.home) ? value.home[0] : value.home;
    const away = Array.isArray(value.away) ? value.away[0] : value.away;
    const events = Array.isArray(value.match_events) ? value.match_events : [];
    return { ...value, home, away, events: events.map((event) => { const item = event as Record<string, unknown>; const player = Array.isArray(item.players) ? item.players[0] : item.players; return { ...item, player_name: (player as { name?: string } | null)?.name ?? "Unknown player" }; }) };
  }) as unknown as PublicMatch[];
  return <main className="public-theme min-h-screen bg-ink"><PublicHeader /><header className="border-b border-white/10 px-5 py-10"><div className="mx-auto max-w-7xl"><Link href="/" className="text-xs font-black uppercase tracking-[0.25em] text-electric"><ArrowLeft size={14} className="mr-2 inline" />AKFL home</Link><h1 className="mt-4 font-display text-4xl font-black text-white sm:text-5xl">Match center</h1><p className="mt-2 text-white/50">Every fixture, result and live match event in one place.</p></div></header><div className="mx-auto max-w-7xl px-5 py-10"><MatchCenter matches={matches} /></div></main>;
}
