export type Team = {
  id: string;
  name: string;
  short_code: string;
  logo_url: string | null;
};

export type Standing = Team & {
  team_id: string;
  group_id: string | null;
  group_name: string | null;
  team_name: string;
  p: number;
  w: number;
  d: number;
  l: number;
  gd: number;
  pts: number;
};

export type Leader = {
  player_id: string;
  player_name: string;
  photo_url: string | null;
  team_name: string;
  short_code: string;
  total_goals?: number;
  total_assists?: number;
};

export type NewsItem = {
  id: string;
  title: string;
  content: string;
  cover_image_url: string | null;
  published_at: string;
};

export type FeaturedMatch = {
  id: string;
  status: "scheduled" | "live" | "halftime" | "completed";
  kickoff_time: string;
  pitch_location: string | null;
  home_score: number;
  away_score: number;
  home: { name: string; short_code: string; logo_url: string | null };
  away: { name: string; short_code: string; logo_url: string | null };
  events: Array<{ id: string; event_type: string; minute: number; player_name: string }>;
};

export type HomepagePlayer = {
  id: string;
  name: string;
  photo_url: string | null;
  jersey_number: number | null;
  position: string;
  team_name: string;
  short_code: string;
  goals: number;
  assists: number;
};
