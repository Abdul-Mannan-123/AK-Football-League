BEGIN;

-- Role assignments are stored outside JWT metadata so administrators can
-- grant/revoke access without exposing a service-role key to the browser.
CREATE TABLE IF NOT EXISTS public.user_roles (
    user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    role text NOT NULL,
    team_id uuid REFERENCES public.teams (id) ON DELETE CASCADE,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, role),
    CONSTRAINT user_roles_role_valid CHECK (
        role IN ('admin', 'competition_coordinator', 'referee', 'news_coordinator', 'team_manager', 'player')
    ),
    CONSTRAINT user_roles_team_scope CHECK (
        role = 'team_manager' OR team_id IS NULL
    )
);

CREATE TABLE IF NOT EXISTS public.match_officials (
    match_id uuid NOT NULL REFERENCES public.matches (id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    role text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (match_id, user_id),
    CONSTRAINT match_officials_role_valid CHECK (role IN ('referee', 'competition_coordinator'))
);

CREATE TABLE IF NOT EXISTS public.lineups (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id uuid NOT NULL REFERENCES public.matches (id) ON DELETE CASCADE,
    team_id uuid NOT NULL REFERENCES public.teams (id) ON DELETE CASCADE,
    player_id uuid NOT NULL REFERENCES public.players (id) ON DELETE CASCADE,
    is_starting boolean NOT NULL DEFAULT true,
    position text,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (match_id, player_id),
    CONSTRAINT lineups_team_player_check CHECK (position IS NULL OR position IN ('GK', 'DEF', 'MID', 'FWD'))
);

ALTER TABLE public.seasons
    ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft',
    ADD COLUMN IF NOT EXISTS started_at timestamptz,
    ADD COLUMN IF NOT EXISTS ended_at timestamptz;
ALTER TABLE public.seasons
    DROP CONSTRAINT IF EXISTS seasons_status_valid;
ALTER TABLE public.seasons
    ADD CONSTRAINT seasons_status_valid CHECK (status IN ('draft', 'active', 'completed', 'cancelled'));

ALTER TABLE public.teams
    ADD COLUMN IF NOT EXISTS is_disqualified boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS disqualification_reason text;

CREATE OR REPLACE FUNCTION public.current_user_has_role(required_role text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role = required_role AND is_active
    ) OR (
        required_role = 'admin'
        AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    );
$$;

CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.current_user_has_role('admin'); $$;

CREATE OR REPLACE FUNCTION public.can_manage_competition()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.current_user_has_role('admin')
       OR public.current_user_has_role('competition_coordinator'); $$;

CREATE OR REPLACE FUNCTION public.can_manage_news()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.current_user_has_role('admin')
       OR public.current_user_has_role('news_coordinator'); $$;

CREATE OR REPLACE FUNCTION public.can_manage_team(target_team_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.current_user_has_role('admin')
       OR public.current_user_has_role('competition_coordinator')
       OR EXISTS (
           SELECT 1 FROM public.user_roles
           WHERE user_id = auth.uid()
             AND role = 'team_manager'
             AND team_id = target_team_id
             AND is_active
       ); $$;

CREATE OR REPLACE FUNCTION public.can_operate_match(target_match_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT public.current_user_has_role('admin')
       OR public.current_user_has_role('competition_coordinator')
       OR EXISTS (
           SELECT 1 FROM public.match_officials
           WHERE match_id = target_match_id
             AND user_id = auth.uid()
             AND role = 'referee'
       );
$$;

-- Only an existing admin can grant or revoke roles. The first admin must be
-- bootstrapped once by the project owner in SQL Editor.
CREATE OR REPLACE FUNCTION public.set_user_role(
    target_user_id uuid,
    target_role text,
    target_team_id uuid DEFAULT NULL,
    enabled boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    IF NOT public.current_user_is_admin() THEN
        RAISE EXCEPTION 'Only an administrator can change user roles';
    END IF;
    IF target_role NOT IN ('admin', 'competition_coordinator', 'referee', 'news_coordinator', 'team_manager', 'player') THEN
        RAISE EXCEPTION 'Invalid role';
    END IF;
    IF target_user_id = auth.uid() AND target_role = 'admin' AND NOT enabled THEN
        RAISE EXCEPTION 'You cannot revoke your own administrator role';
    END IF;
    IF target_role <> 'team_manager' AND target_team_id IS NOT NULL THEN
        RAISE EXCEPTION 'Only team managers can be scoped to a team';
    END IF;
    INSERT INTO public.user_roles (user_id, role, team_id, is_active)
    VALUES (target_user_id, target_role, target_team_id, enabled)
    ON CONFLICT (user_id, role) DO UPDATE
        SET team_id = EXCLUDED.team_id, is_active = EXCLUDED.is_active;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_season_status(target_season_id uuid, next_status text)
RETURNS public.seasons
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE updated_season public.seasons%ROWTYPE;
BEGIN
    IF NOT public.can_manage_competition() THEN
        RAISE EXCEPTION 'Competition permission required';
    END IF;
    IF next_status NOT IN ('draft', 'active', 'completed', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid season status';
    END IF;
    IF next_status = 'active' THEN
        UPDATE public.seasons SET status = 'completed', ended_at = COALESCE(ended_at, now())
        WHERE is_current AND id <> target_season_id;
        UPDATE public.seasons SET is_current = true, started_at = COALESCE(started_at, now()), ended_at = NULL
        WHERE id = target_season_id;
    ELSIF next_status IN ('completed', 'cancelled') THEN
        UPDATE public.seasons SET is_current = false, ended_at = COALESCE(ended_at, now())
        WHERE id = target_season_id;
    END IF;
    UPDATE public.seasons SET status = next_status WHERE id = target_season_id
    RETURNING * INTO updated_season;
    IF NOT FOUND THEN RAISE EXCEPTION 'Season not found'; END IF;
    RETURN updated_season;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_team_disqualification(
    target_team_id uuid,
    disqualified boolean,
    reason text DEFAULT NULL
)
RETURNS public.teams
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE updated_team public.teams%ROWTYPE;
BEGIN
    IF NOT public.can_manage_competition() THEN
        RAISE EXCEPTION 'Competition permission required';
    END IF;
    UPDATE public.teams
    SET is_disqualified = disqualified,
        disqualification_reason = CASE WHEN disqualified THEN NULLIF(trim(reason), '') ELSE NULL END
    WHERE id = target_team_id
    RETURNING * INTO updated_team;
    IF NOT FOUND THEN RAISE EXCEPTION 'Team not found'; END IF;
    RETURN updated_team;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_round_robin_schedule(
    target_season_id uuid,
    target_group_id uuid,
    first_kickoff timestamptz,
    days_between_rounds integer DEFAULT 7
)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE inserted_count integer;
BEGIN
    IF NOT public.can_manage_competition() THEN
        RAISE EXCEPTION 'Competition permission required';
    END IF;
    IF days_between_rounds < 1 THEN RAISE EXCEPTION 'Days between rounds must be positive'; END IF;
    INSERT INTO public.matches (
        season_id, group_id, home_team_id, away_team_id, kickoff_time, status
    )
    SELECT target_season_id,
           target_group_id,
           home.id,
           away.id,
           first_kickoff + ((row_number() OVER (ORDER BY home.name, away.name) - 1) * days_between_rounds || ' days')::interval,
           'scheduled'
    FROM public.teams home
    JOIN public.teams away ON home.id < away.id
    WHERE home.is_disqualified = false
      AND away.is_disqualified = false
      AND NOT EXISTS (
          SELECT 1 FROM public.matches existing
          WHERE existing.season_id = target_season_id
            AND existing.group_id IS NOT DISTINCT FROM target_group_id
            AND ((existing.home_team_id = home.id AND existing.away_team_id = away.id)
              OR (existing.home_team_id = away.id AND existing.away_team_id = home.id))
      );
    GET DIAGNOSTICS inserted_count = ROW_COUNT;
    RETURN inserted_count;
END;
$$;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_officials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lineups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_roles_self_or_admin_read ON public.user_roles;
CREATE POLICY user_roles_self_or_admin_read ON public.user_roles
    FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR public.current_user_is_admin());
DROP POLICY IF EXISTS user_roles_admin_write ON public.user_roles;
CREATE POLICY user_roles_admin_write ON public.user_roles
    FOR ALL TO authenticated
    USING (public.current_user_is_admin())
    WITH CHECK (public.current_user_is_admin());

DROP POLICY IF EXISTS match_officials_public_read ON public.match_officials;
CREATE POLICY match_officials_public_read ON public.match_officials
    FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS match_officials_competition_write ON public.match_officials;
CREATE POLICY match_officials_competition_write ON public.match_officials
    FOR ALL TO authenticated
    USING (public.can_manage_competition())
    WITH CHECK (public.can_manage_competition());

DROP POLICY IF EXISTS lineups_public_read ON public.lineups;
CREATE POLICY lineups_public_read ON public.lineups
    FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS lineups_scoped_write ON public.lineups;
CREATE POLICY lineups_scoped_write ON public.lineups
    FOR ALL TO authenticated
    USING (public.can_manage_team(team_id))
    WITH CHECK (public.can_manage_team(team_id));

-- Replace broad legacy write access with least-privilege policies.
DROP POLICY IF EXISTS teams_admin_referee_write ON public.teams;
CREATE POLICY teams_competition_write ON public.teams
    FOR ALL TO authenticated
    USING (public.can_manage_competition())
    WITH CHECK (public.can_manage_competition());

DROP POLICY IF EXISTS players_admin_referee_write ON public.players;
CREATE POLICY players_scoped_write ON public.players
    FOR ALL TO authenticated
    USING (public.can_manage_team(team_id))
    WITH CHECK (public.can_manage_team(team_id));

DROP POLICY IF EXISTS seasons_admin_referee_write ON public.seasons;
CREATE POLICY seasons_competition_write ON public.seasons
    FOR ALL TO authenticated
    USING (public.can_manage_competition())
    WITH CHECK (public.can_manage_competition());

DROP POLICY IF EXISTS groups_admin_referee_write ON public.groups;
CREATE POLICY groups_competition_write ON public.groups
    FOR ALL TO authenticated
    USING (public.can_manage_competition())
    WITH CHECK (public.can_manage_competition());

DROP POLICY IF EXISTS matches_admin_referee_write ON public.matches;
CREATE POLICY matches_competition_write ON public.matches
    FOR ALL TO authenticated
    USING (public.can_manage_competition() OR public.can_operate_match(id))
    WITH CHECK (public.can_manage_competition() OR public.can_operate_match(id));

DROP POLICY IF EXISTS match_events_admin_referee_write ON public.match_events;
CREATE POLICY match_events_official_write ON public.match_events
    FOR ALL TO authenticated
    USING (public.can_operate_match(match_id))
    WITH CHECK (public.can_operate_match(match_id));

DROP POLICY IF EXISTS news_admin_referee_write ON public.news;
CREATE POLICY news_coordinator_write ON public.news
    FOR ALL TO authenticated
    USING (public.can_manage_news())
    WITH CHECK (public.can_manage_news());

GRANT SELECT ON public.user_roles, public.match_officials, public.lineups TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.user_roles, public.match_officials, public.lineups TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_role(uuid, text, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_season_status(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_team_disqualification(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_round_robin_schedule(uuid, uuid, timestamptz, integer) TO authenticated;

COMMIT;
