BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- Tables
-- ============================================================

CREATE TABLE public.teams (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name text NOT NULL,
    short_code text NOT NULL,
    logo_url text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT teams_name_not_blank CHECK (length(trim(name)) > 0),
    CONSTRAINT teams_short_code_not_blank CHECK (length(trim(short_code)) > 0),
    CONSTRAINT teams_short_code_uppercase CHECK (short_code = upper(short_code)),
    CONSTRAINT teams_short_code_unique UNIQUE (short_code)
);

CREATE TABLE public.players (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id uuid NOT NULL,
    name text NOT NULL,
    photo_url text,
    jersey_number integer,
    position text NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    CONSTRAINT players_team_id_fkey
        FOREIGN KEY (team_id) REFERENCES public.teams (id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT players_name_not_blank CHECK (length(trim(name)) > 0),
    CONSTRAINT players_jersey_number_valid
        CHECK (jersey_number IS NULL OR jersey_number BETWEEN 0 AND 99),
    CONSTRAINT players_position_valid
        CHECK (position IN ('GK', 'DEF', 'MID', 'FWD'))
);

CREATE TABLE public.referees (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name text NOT NULL,
    photo_url text,
    license_level text,
    is_active boolean NOT NULL DEFAULT true,
    CONSTRAINT referees_name_not_blank CHECK (length(trim(name)) > 0)
);

CREATE TABLE public.seasons (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name text NOT NULL,
    is_current boolean NOT NULL DEFAULT false,
    CONSTRAINT seasons_name_not_blank CHECK (length(trim(name)) > 0),
    CONSTRAINT seasons_name_unique UNIQUE (name)
);

CREATE TABLE public.groups (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    season_id uuid NOT NULL,
    name text NOT NULL,
    CONSTRAINT groups_season_id_fkey
        FOREIGN KEY (season_id) REFERENCES public.seasons (id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT groups_name_not_blank CHECK (length(trim(name)) > 0),
    CONSTRAINT groups_season_name_unique UNIQUE (season_id, name)
);

CREATE TABLE public.matches (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    season_id uuid NOT NULL,
    group_id uuid,
    home_team_id uuid NOT NULL,
    away_team_id uuid NOT NULL,
    kickoff_time timestamptz NOT NULL,
    pitch_location text,
    status text NOT NULL DEFAULT 'scheduled',
    home_score integer NOT NULL DEFAULT 0,
    away_score integer NOT NULL DEFAULT 0,
    CONSTRAINT matches_season_id_fkey
        FOREIGN KEY (season_id) REFERENCES public.seasons (id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT matches_group_id_fkey
        FOREIGN KEY (group_id) REFERENCES public.groups (id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT matches_home_team_id_fkey
        FOREIGN KEY (home_team_id) REFERENCES public.teams (id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT matches_away_team_id_fkey
        FOREIGN KEY (away_team_id) REFERENCES public.teams (id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT matches_different_teams CHECK (home_team_id <> away_team_id),
    CONSTRAINT matches_status_valid
        CHECK (status IN ('scheduled', 'live', 'halftime', 'completed')),
    CONSTRAINT matches_home_score_valid CHECK (home_score >= 0),
    CONSTRAINT matches_away_score_valid CHECK (away_score >= 0)
);

CREATE TABLE public.match_events (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id uuid NOT NULL,
    player_id uuid NOT NULL,
    assist_player_id uuid,
    event_type text NOT NULL,
    minute integer NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT match_events_match_id_fkey
        FOREIGN KEY (match_id) REFERENCES public.matches (id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT match_events_player_id_fkey
        FOREIGN KEY (player_id) REFERENCES public.players (id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT match_events_assist_player_id_fkey
        FOREIGN KEY (assist_player_id) REFERENCES public.players (id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT match_events_type_valid
        CHECK (event_type IN ('goal', 'yellow_card', 'red_card', 'own_goal')),
    CONSTRAINT match_events_minute_valid CHECK (minute BETWEEN 0 AND 150),
    CONSTRAINT match_events_assist_valid
        CHECK (assist_player_id IS NULL OR assist_player_id <> player_id)
);

CREATE TABLE public.news (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    title text NOT NULL,
    content text NOT NULL,
    cover_image_url text,
    published_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT news_title_not_blank CHECK (length(trim(title)) > 0)
);

CREATE UNIQUE INDEX seasons_one_current_idx
    ON public.seasons (is_current) WHERE is_current = true;

CREATE INDEX players_team_id_idx ON public.players (team_id);
CREATE INDEX players_active_idx ON public.players (is_active)
    WHERE is_active = true;
CREATE INDEX referees_active_idx ON public.referees (is_active)
    WHERE is_active = true;
CREATE INDEX groups_season_id_idx ON public.groups (season_id);
CREATE INDEX matches_season_id_idx ON public.matches (season_id);
CREATE INDEX matches_group_id_idx ON public.matches (group_id);
CREATE INDEX matches_kickoff_time_idx ON public.matches (kickoff_time);
CREATE INDEX matches_status_idx ON public.matches (status);
CREATE INDEX matches_home_team_id_idx ON public.matches (home_team_id);
CREATE INDEX matches_away_team_id_idx ON public.matches (away_team_id);
CREATE INDEX match_events_match_id_idx ON public.match_events (match_id);
CREATE INDEX match_events_player_id_idx ON public.match_events (player_id);
CREATE INDEX match_events_assist_player_id_idx
    ON public.match_events (assist_player_id);
CREATE INDEX match_events_goal_idx ON public.match_events (event_type)
    WHERE event_type = 'goal';
CREATE INDEX news_published_at_idx ON public.news (published_at DESC);

-- Atomically records an event and updates the match score. The event
-- timestamp is generated by PostgreSQL through match_events.created_at.
CREATE OR REPLACE FUNCTION public.log_match_event(
    p_match_id uuid,
    p_player_id uuid,
    p_assist_player_id uuid,
    p_event_type text,
    p_minute integer
)
RETURNS public.match_events
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    target_match public.matches%ROWTYPE;
    target_player public.players%ROWTYPE;
    inserted_event public.match_events%ROWTYPE;
BEGIN
    SELECT *
    INTO target_match
    FROM public.matches
    WHERE id = p_match_id
      AND status = 'live'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Events can only be logged for a live match';
    END IF;

    SELECT *
    INTO target_player
    FROM public.players
    WHERE id = p_player_id
      AND is_active = true;

    IF NOT FOUND OR target_player.team_id NOT IN (target_match.home_team_id, target_match.away_team_id) THEN
        RAISE EXCEPTION 'Player is not an active player in this match';
    END IF;

    IF p_assist_player_id IS NOT NULL AND NOT EXISTS (
        SELECT 1
        FROM public.players
        WHERE id = p_assist_player_id
          AND is_active = true
          AND team_id = target_player.team_id
          AND id <> p_player_id
    ) THEN
        RAISE EXCEPTION 'Assist player is not valid for this event';
    END IF;

    INSERT INTO public.match_events (
        match_id,
        player_id,
        assist_player_id,
        event_type,
        minute
    )
    VALUES (
        p_match_id,
        p_player_id,
        CASE WHEN p_event_type = 'goal' THEN p_assist_player_id ELSE NULL END,
        p_event_type,
        p_minute
    )
    RETURNING * INTO inserted_event;

    IF p_event_type = 'goal' THEN
        UPDATE public.matches
        SET home_score = home_score + CASE WHEN target_player.team_id = target_match.home_team_id THEN 1 ELSE 0 END,
            away_score = away_score + CASE WHEN target_player.team_id = target_match.away_team_id THEN 1 ELSE 0 END
        WHERE id = p_match_id;
    END IF;

    RETURN inserted_event;
END;
$$;

REVOKE ALL ON FUNCTION public.log_match_event(uuid, uuid, uuid, text, integer)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.log_match_event(uuid, uuid, uuid, text, integer)
TO authenticated;

CREATE OR REPLACE FUNCTION public.undo_match_event(p_match_event_id uuid)
RETURNS public.match_events
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    removed_event public.match_events%ROWTYPE;
    target_match public.matches%ROWTYPE;
    target_player public.players%ROWTYPE;
BEGIN
    SELECT *
    INTO removed_event
    FROM public.match_events
    WHERE id = p_match_event_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Match event was not found';
    END IF;

    SELECT *
    INTO target_match
    FROM public.matches
    WHERE id = removed_event.match_id
    FOR UPDATE;

    IF NOT FOUND OR target_match.status = 'completed' THEN
        RAISE EXCEPTION 'Events cannot be removed from a completed or missing match';
    END IF;

    IF removed_event.event_type = 'goal' THEN
        SELECT *
        INTO target_player
        FROM public.players
        WHERE id = removed_event.player_id;

        IF target_player.team_id = target_match.home_team_id THEN
            UPDATE public.matches
            SET home_score = GREATEST(0, home_score - 1)
            WHERE id = target_match.id;
        ELSIF target_player.team_id = target_match.away_team_id THEN
            UPDATE public.matches
            SET away_score = GREATEST(0, away_score - 1)
            WHERE id = target_match.id;
        END IF;
    END IF;

    DELETE FROM public.match_events
    WHERE id = p_match_event_id;

    RETURN removed_event;
END;
$$;

REVOKE ALL ON FUNCTION public.undo_match_event(uuid)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.undo_match_event(uuid)
TO authenticated;

-- ============================================================
-- League standings
-- ============================================================

CREATE OR REPLACE VIEW public.league_standings AS
WITH completed_matches AS (
    SELECT id, group_id, home_team_id, away_team_id, home_score, away_score
    FROM public.matches
    WHERE status = 'completed'
),
team_match_results AS (
    SELECT
        group_id,
        home_team_id AS team_id,
        1 AS played,
        CASE WHEN home_score > away_score THEN 1 ELSE 0 END AS wins,
        CASE WHEN home_score = away_score THEN 1 ELSE 0 END AS draws,
        CASE WHEN home_score < away_score THEN 1 ELSE 0 END AS losses,
        home_score AS goals_for,
        away_score AS goals_against
    FROM completed_matches
    UNION ALL
    SELECT
        group_id,
        away_team_id AS team_id,
        1 AS played,
        CASE WHEN away_score > home_score THEN 1 ELSE 0 END AS wins,
        CASE WHEN away_score = home_score THEN 1 ELSE 0 END AS draws,
        CASE WHEN away_score < home_score THEN 1 ELSE 0 END AS losses,
        away_score AS goals_for,
        home_score AS goals_against
    FROM completed_matches
),
group_teams AS (
    SELECT
        g.id AS group_id,
        t.id AS team_id
    FROM public.groups AS g
    CROSS JOIN public.teams AS t
),
aggregated_results AS (
    SELECT
        group_id,
        team_id,
        SUM(played)::integer AS p,
        SUM(wins)::integer AS w,
        SUM(draws)::integer AS d,
        SUM(losses)::integer AS l,
        SUM(goals_for)::integer AS gf,
        SUM(goals_against)::integer AS ga
    FROM team_match_results
    GROUP BY group_id, team_id
),
aggregated AS (
    SELECT
        gt.group_id,
        gt.team_id,
        COALESCE(ar.p, 0)::integer AS p,
        COALESCE(ar.w, 0)::integer AS w,
        COALESCE(ar.d, 0)::integer AS d,
        COALESCE(ar.l, 0)::integer AS l,
        COALESCE(ar.gf, 0)::integer AS gf,
        COALESCE(ar.ga, 0)::integer AS ga
    FROM group_teams AS gt
    LEFT JOIN aggregated_results AS ar
        ON ar.group_id = gt.group_id
       AND ar.team_id = gt.team_id
)
SELECT
    a.group_id,
    g.name AS group_name,
    a.team_id,
    t.name AS team_name,
    t.short_code,
    t.logo_url,
    a.p,
    a.w,
    a.d,
    a.l,
    a.gf,
    a.ga,
    (a.gf - a.ga)::integer AS gd,
    (a.w * 3 + a.d)::integer AS pts
FROM aggregated AS a
JOIN public.teams AS t ON t.id = a.team_id
LEFT JOIN public.groups AS g ON g.id = a.group_id
ORDER BY pts DESC, gd DESC, a.gf DESC, t.name ASC;

-- ============================================================
-- Top leaders
-- ============================================================

CREATE OR REPLACE VIEW public.top_scorers_view AS
SELECT
    p.id AS player_id,
    p.name AS player_name,
    p.photo_url,
    p.team_id,
    t.name AS team_name,
    t.short_code,
    COUNT(*)::integer AS total_goals
FROM public.match_events AS me
JOIN public.players AS p ON p.id = me.player_id
JOIN public.teams AS t ON t.id = p.team_id
WHERE me.event_type = 'goal'
GROUP BY p.id, p.name, p.photo_url, p.team_id, t.name, t.short_code
ORDER BY total_goals DESC, p.name ASC;

CREATE OR REPLACE VIEW public.top_assists_view AS
SELECT
    p.id AS player_id,
    p.name AS player_name,
    p.photo_url,
    p.team_id,
    t.name AS team_name,
    t.short_code,
    COUNT(*)::integer AS total_assists
FROM public.match_events AS me
JOIN public.players AS p ON p.id = me.assist_player_id
JOIN public.teams AS t ON t.id = p.team_id
WHERE me.event_type = 'goal' AND me.assist_player_id IS NOT NULL
GROUP BY p.id, p.name, p.photo_url, p.team_id, t.name, t.short_code
ORDER BY total_assists DESC, p.name ASC;

-- ============================================================
-- Authorization and RLS
-- Roles are read from auth.users.raw_app_meta_data:
-- { "role": "admin" } or { "role": "referee" }
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_admin_or_referee()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
    SELECT auth.uid() IS NOT NULL
       AND auth.role() = 'authenticated'
       AND (auth.jwt() -> 'app_metadata' ->> 'role')
           IN ('admin', 'referee');
$$;

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;

CREATE POLICY teams_public_read ON public.teams
    FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY players_public_read ON public.players
    FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY referees_public_read ON public.referees
    FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY seasons_public_read ON public.seasons
    FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY groups_public_read ON public.groups
    FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY matches_public_read ON public.matches
    FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY match_events_public_read ON public.match_events
    FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY news_public_read ON public.news
    FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY teams_admin_referee_write ON public.teams
    FOR ALL TO authenticated
    USING (public.is_admin_or_referee())
    WITH CHECK (public.is_admin_or_referee());
CREATE POLICY players_admin_referee_write ON public.players
    FOR ALL TO authenticated
    USING (public.is_admin_or_referee())
    WITH CHECK (public.is_admin_or_referee());
CREATE POLICY referees_admin_write ON public.referees
    FOR ALL TO authenticated
    USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
    WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
CREATE POLICY seasons_admin_referee_write ON public.seasons
    FOR ALL TO authenticated
    USING (public.is_admin_or_referee())
    WITH CHECK (public.is_admin_or_referee());
CREATE POLICY groups_admin_referee_write ON public.groups
    FOR ALL TO authenticated
    USING (public.is_admin_or_referee())
    WITH CHECK (public.is_admin_or_referee());
CREATE POLICY matches_admin_referee_write ON public.matches
    FOR ALL TO authenticated
    USING (public.is_admin_or_referee())
    WITH CHECK (public.is_admin_or_referee());
CREATE POLICY match_events_admin_referee_write ON public.match_events
    FOR ALL TO authenticated
    USING (public.is_admin_or_referee())
    WITH CHECK (public.is_admin_or_referee());
CREATE POLICY news_admin_referee_write ON public.news
    FOR ALL TO authenticated
    USING (public.is_admin_or_referee())
    WITH CHECK (public.is_admin_or_referee());

GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT ON
    public.teams,
    public.players,
    public.referees,
    public.seasons,
    public.groups,
    public.matches,
    public.match_events,
    public.news,
    public.league_standings,
    public.top_scorers_view,
    public.top_assists_view
TO anon, authenticated;

GRANT INSERT, UPDATE, DELETE ON
    public.teams,
    public.players,
    public.referees,
    public.seasons,
    public.groups,
    public.matches,
    public.match_events,
    public.news
TO authenticated;

COMMIT;
