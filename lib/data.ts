import { createClient } from "@/lib/supabase/server";
import type { FeaturedMatch, HomepagePlayer, Standing } from "@/lib/types";

export async function getHomepageData() {
  const supabase = await createClient();
  if (!supabase) return { standings: [], scorers: [], assists: [], news: [], featuredMatch: null, matches: [], players: [] };

  const [standings, scorers, assists, news, matches, players, playerStats, teams, groups] = await Promise.all([
    supabase.from("league_standings").select("*").order("pts", { ascending: false }).order("gd", { ascending: false }),
    supabase.from("top_scorers_view").select("*").limit(5),
    supabase.from("top_assists_view").select("*").limit(5),
    supabase.from("news").select("*").order("published_at", { ascending: false }).limit(3),
    supabase.from("matches").select("id,kickoff_time,pitch_location,status,home_score,away_score,home_team_id,away_team_id,match_events(id,event_type,minute,players(name))").in("status", ["scheduled", "live", "halftime", "completed"]).order("kickoff_time", { ascending: true }).limit(100),
    supabase.from("players").select("id,name,photo_url,jersey_number,position,teams(name,short_code)").eq("is_active", true).order("name").limit(6),
    supabase.from("player_stats_view").select("player_id,goals,assists"),
    supabase.from("teams").select("id,name,short_code,logo_url").order("name"),
    supabase.from("groups").select("id,name"),
  ]);

  const teamById = new Map((teams.data ?? []).map((team) => [team.id, team]));
  const normalizedMatches = (matches.data ?? []).map((match) => {
    const value = match as Record<string, unknown>;
    const home = teamById.get(String(value.home_team_id));
    const away = teamById.get(String(value.away_team_id));
    if (!home || !away) return null;
    const events = Array.isArray(value.match_events) ? value.match_events : [];
    return {
      id: String(value.id),
      status: value.status as FeaturedMatch["status"],
      kickoff_time: String(value.kickoff_time),
      pitch_location: value.pitch_location as string | null,
      home_score: Number(value.home_score ?? 0),
      away_score: Number(value.away_score ?? 0),
      home: { name: home.name, short_code: home.short_code, logo_url: home.logo_url },
      away: { name: away.name, short_code: away.short_code, logo_url: away.logo_url },
      events: events.map((event) => {
        const item = event as Record<string, unknown>;
        const player = (Array.isArray(item.players) ? item.players[0] : item.players) as { name?: string } | null;
        return { id: String(item.id), event_type: String(item.event_type), minute: Number(item.minute), player_name: player?.name ?? "Unknown player" };
      }),
    } satisfies FeaturedMatch;
  }).filter((match): match is FeaturedMatch => match !== null);
  const featuredMatch = normalizedMatches.find((match) => match.status === "live" || match.status === "halftime")
    ?? normalizedMatches.filter((match) => match.status === "scheduled").sort((a, b) => Date.parse(a.kickoff_time) - Date.parse(b.kickoff_time))[0]
    ?? normalizedMatches.filter((match) => match.status === "completed").sort((a, b) => Date.parse(b.kickoff_time) - Date.parse(a.kickoff_time))[0]
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
  const zeroStandings: Standing[] = (groups.data?.length ? groups.data : [{ id: null, name: "League Phase" }]).flatMap((group) =>
    (teams.data ?? []).map((team) => ({
      id: team.id,
      name: team.name,
      short_code: team.short_code,
      logo_url: team.logo_url,
      team_id: team.id,
      team_name: team.name,
      group_id: group.id,
      group_name: group.name,
      p: 0,
      w: 0,
      d: 0,
      l: 0,
      gd: 0,
      pts: 0,
    })),
  );
  return {
    standings: standings.data?.length ? (standings.data as Standing[]) : zeroStandings,
    scorers: scorers.data ?? [],
    assists: assists.data ?? [],
    news: news.data ?? [],
    featuredMatch,
    matches: normalizedMatches.slice(0, 6),
    players: homepagePlayers,
  };
}
