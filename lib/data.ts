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
    supabase.from("matches").select("id,kickoff_time,pitch_location,status,home_score,away_score,home_team_id,away_team_id").in("status", ["scheduled", "live", "halftime", "completed"]).order("kickoff_time", { ascending: true }).limit(100),
    supabase.from("players").select("id,name,photo_url,jersey_number,position,team_id").eq("is_active", true).order("name").limit(6),
    supabase.from("player_stats_view").select("player_id,goals,assists"),
    supabase.from("teams").select("id,name,short_code,logo_url").order("name"),
    supabase.from("groups").select("id,name"),
  ]);

  const teamById = new Map((teams.data ?? []).map((team) => [team.id, team]));
  const matchIds = (matches.data ?? []).map((match) => match.id);
  const { data: matchEvents } = matchIds.length
    ? await supabase.from("match_events").select("id,match_id,event_type,minute,player_id").in("match_id", matchIds)
    : { data: [] };
  const eventPlayerIds = (matchEvents ?? []).map((event) => event.player_id).filter(Boolean);
  const { data: eventPlayers } = eventPlayerIds.length
    ? await supabase.from("players").select("id,name").in("id", eventPlayerIds)
    : { data: [] };
  const eventPlayerById = new Map((eventPlayers ?? []).map((player) => [player.id, player.name]));
  const eventsByMatch = new Map<string, Array<{ id: string; event_type: string; minute: number; player_name: string }>>();
  for (const event of matchEvents ?? []) {
    const current = eventsByMatch.get(event.match_id) ?? [];
    current.push({ id: event.id, event_type: event.event_type, minute: event.minute, player_name: eventPlayerById.get(event.player_id) ?? "Unknown player" });
    eventsByMatch.set(event.match_id, current);
  }
  const normalizedMatches = (matches.data ?? []).map((match) => {
    const value = match as Record<string, unknown>;
    const home = teamById.get(String(value.home_team_id));
    const away = teamById.get(String(value.away_team_id));
    if (!home || !away) return null;
    const events = eventsByMatch.get(String(value.id)) ?? [];
    return {
      id: String(value.id),
      status: value.status as FeaturedMatch["status"],
      kickoff_time: String(value.kickoff_time),
      pitch_location: value.pitch_location as string | null,
      home_score: Number(value.home_score ?? 0),
      away_score: Number(value.away_score ?? 0),
      home: { name: home.name, short_code: home.short_code, logo_url: home.logo_url },
      away: { name: away.name, short_code: away.short_code, logo_url: away.logo_url },
      events,
    } satisfies FeaturedMatch;
  }).filter((match): match is FeaturedMatch => match !== null);
  const featuredMatch = normalizedMatches.find((match) => match.status === "live" || match.status === "halftime")
    ?? normalizedMatches.filter((match) => match.status === "scheduled").sort((a, b) => Date.parse(a.kickoff_time) - Date.parse(b.kickoff_time))[0]
    ?? normalizedMatches.filter((match) => match.status === "completed").sort((a, b) => Date.parse(b.kickoff_time) - Date.parse(a.kickoff_time))[0]
    ?? null;
  const statsByPlayer = new Map((playerStats.data ?? []).map((row) => [row.player_id, row]));
  const homepagePlayers = (players.data ?? []).map((player) => {
    const team = teamById.get(player.team_id);
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
