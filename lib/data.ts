import { createClient } from "@/lib/supabase/server";
import type { FeaturedMatch, HomepagePlayer, Leader, NewsItem, Standing, Team } from "@/lib/types";

const demoTeams: Team[] = [1, 2, 3, 4, 5, 6].map((number) => ({
  id: `team-${number}`,
  name: ["AK United", "Northside FC", "Kabul Stars", "Pamir Athletic", "Capital City", "Herat Lions"][number - 1],
  short_code: ["AKU", "NSF", "KBS", "PMA", "CAP", "HRL"][number - 1],
  logo_url: `/teams/team_logo_${number}.jpeg`,
}));

export const demoStandings: Standing[] = demoTeams.map((team, index) => ({
  ...team,
  team_id: team.id,
  team_name: team.name,
  group_id: "group-a",
  group_name: "Group A",
  p: [7, 7, 7, 7, 7, 7][index],
  w: [6, 5, 4, 3, 2, 1][index],
  d: [1, 1, 1, 1, 2, 1][index],
  l: [0, 1, 2, 3, 3, 5][index],
  gd: [14, 9, 5, 1, -4, -12][index],
  pts: [19, 16, 13, 10, 8, 4][index],
}));

const demoLeaders: Leader[] = [
  { player_id: "p1", player_name: "Omid Ahmadi", photo_url: null, team_name: "AK United", short_code: "AKU", total_goals: 9 },
  { player_id: "p2", player_name: "Farid Sadiq", photo_url: null, team_name: "Northside FC", short_code: "NSF", total_assists: 7 },
];

const demoNews: NewsItem[] = [
  { id: "n1", title: "AK United make it six wins in a row", content: "A statement performance sends the league leaders clear at the top.", cover_image_url: null, published_at: "2026-10-05T18:00:00Z" },
  { id: "n2", title: "The race for the top four heats up", content: "Just six points separate second from fifth as the league enters its decisive stretch.", cover_image_url: null, published_at: "2026-10-03T12:00:00Z" },
  { id: "n3", title: "Meet the next generation of AKFL stars", content: "Young talent is making an impact across every group this season.", cover_image_url: null, published_at: "2026-09-30T08:00:00Z" },
];

export async function getHomepageData() {
  const supabase = await createClient();
  if (!supabase) return { standings: demoStandings, scorers: [demoLeaders[0]], assists: [demoLeaders[1]], news: demoNews, featuredMatch: null, matches: [], players: [] };

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
    standings: standings.data?.length ? (standings.data as Standing[]) : demoStandings,
    scorers: scorers.data?.length ? (scorers.data as Leader[]) : [demoLeaders[0]],
    assists: assists.data?.length ? (assists.data as Leader[]) : [demoLeaders[1]],
    news: news.data?.length ? (news.data as NewsItem[]) : demoNews,
    featuredMatch,
    matches: normalizedMatches.slice(0, 6),
    players: homepagePlayers,
  };
}
