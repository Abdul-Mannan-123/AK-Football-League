import { createClient } from "@/lib/supabase/server";
import type { FeaturedMatch, HomepagePlayer } from "@/lib/types";

export async function getHomepageData() {
  const supabase = await createClient();
  if (!supabase) return { standings: [], scorers: [], assists: [], news: [], featuredMatch: null, matches: [], players: [] };

  const [standings, scorers, assists, news, matches, players, playerStats] = await Promise.all([
    supabase.from("league_standings").select("*").order("pts", { ascending: false }).order("gd", { ascending: false }),
    supabase.from("top_scorers_view").select("*").limit(5),
    supabase.from("top_assists_view").select("*").limit(5),
    supabase.from("news").select("*").order("published_at", { ascending: false }).limit(3),
    supabase.from("matches").select("id,kickoff_time,pitch_location,status,home_score,away_score,home:teams!matches_home_team_id_fkey(name,short_code,logo_url),away:teams!matches_away_team_id_fkey(name,short_code,logo_url),match_events(id,event_type,minute,players(name))").in("status", ["scheduled", "live", "halftime", "completed"]).order("kickoff_time", { ascending: false }).limit(50),
    supabase.from("players").select("id,name,photo_url,jersey_number,position,teams(name,short_code)").eq("is_active", true).order("name").limit(6),
    supabase.from("player_stats_view").select("player_id,goals,assists"),
  ]);

  const normalizedMatches = (matches.data ?? []).map((match) => {
    const value = match as Record<string, unknown>;
    const home = (Array.isArray(value.home) ? value.home[0] : value.home) as FeaturedMatch["home"];
    const away = (Array.isArray(value.away) ? value.away[0] : value.away) as FeaturedMatch["away"];
    const events = Array.isArray(value.match_events) ? value.match_events : [];
    return {
      id: String(value.id),
      status: value.status as FeaturedMatch["status"],
      kickoff_time: String(value.kickoff_time),
      pitch_location: value.pitch_location as string | null,
      home_score: Number(value.home_score ?? 0),
      away_score: Number(value.away_score ?? 0),
      home,
      away,
      events: events.map((event) => {
        const item = event as Record<string, unknown>;
        const player = (Array.isArray(item.players) ? item.players[0] : item.players) as { name?: string } | null;
        return { id: String(item.id), event_type: String(item.event_type), minute: Number(item.minute), player_name: player?.name ?? "Unknown player" };
      }),
    } satisfies FeaturedMatch;
  });
  const featuredMatch = normalizedMatches.find((match) => match.status === "live" || match.status === "halftime")
    ?? normalizedMatches.filter((match) => match.status === "completed").sort((a, b) => Date.parse(b.kickoff_time) - Date.parse(a.kickoff_time))[0]
    ?? normalizedMatches.filter((match) => match.status === "scheduled").sort((a, b) => Date.parse(a.kickoff_time) - Date.parse(b.kickoff_time))[0]
    ?? null;
  const statsByPlayer = new Map((playerStats.data ?? []).map((row) => [row.player_id, row]));
  const homepagePlayers = (players.data ?? []).map((player) => {
    const team = Array.isArray(player.teams) ? player.teams[0] : player.teams;
    const stats = statsByPlayer.get(player.id);
    return {
      id: player.id,
      name: player.name,
      photo_url: player.photo_url,
      jersey_number: player.jersey_number,
      position: player.position,
      team_name: team?.name ?? "Unassigned",
      short_code: team?.short_code ?? "AKFL",
      goals: stats?.goals ?? 0,
      assists: stats?.assists ?? 0,
    } satisfies HomepagePlayer;
  });
  return {
    standings: standings.data ?? [],
    scorers: scorers.data ?? [],
    assists: assists.data ?? [],
    news: news.data ?? [],
    featuredMatch,
    matches: normalizedMatches.slice(0, 6),
    players: homepagePlayers,
  };
}
