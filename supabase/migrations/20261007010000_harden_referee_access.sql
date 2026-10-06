BEGIN;

-- Referees must never update matches directly. They can only use this
-- transition function, which changes status and nothing else.
DROP POLICY IF EXISTS matches_competition_write ON public.matches;
DROP POLICY IF EXISTS matches_admin_referee_write ON public.matches;
CREATE POLICY matches_competition_write ON public.matches
    FOR ALL TO authenticated
    USING (public.can_manage_competition())
    WITH CHECK (public.can_manage_competition());

CREATE OR REPLACE FUNCTION public.set_match_status(
    target_match_id uuid,
    next_status text
)
RETURNS public.matches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_match public.matches%ROWTYPE;
    updated_match public.matches%ROWTYPE;
BEGIN
    SELECT * INTO current_match
    FROM public.matches
    WHERE id = target_match_id
    FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Match not found'; END IF;
    IF NOT (public.can_operate_match(target_match_id)) THEN
        RAISE EXCEPTION 'You are not assigned to this match';
    END IF;
    IF next_status NOT IN ('scheduled', 'live', 'halftime', 'completed') THEN
        RAISE EXCEPTION 'Invalid match status';
    END IF;
    IF current_match.status = 'completed' AND next_status <> 'completed' THEN
        RAISE EXCEPTION 'A completed match cannot be reopened';
    END IF;
    IF current_match.status = 'scheduled' AND next_status = 'halftime' THEN
        RAISE EXCEPTION 'A scheduled match cannot move directly to half time';
    END IF;
    IF current_match.status = 'live' AND next_status = 'scheduled' THEN
        RAISE EXCEPTION 'A live match cannot be moved back to scheduled';
    END IF;

    UPDATE public.matches SET status = next_status
    WHERE id = target_match_id
    RETURNING * INTO updated_match;
    RETURN updated_match;
END;
$$;

REVOKE ALL ON FUNCTION public.set_match_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_match_status(uuid, text) TO authenticated;

-- Revoke direct event table writes for authenticated users. Event creation and
-- undo must go through the atomic RPCs so scores cannot drift from events.
DROP POLICY IF EXISTS match_events_official_write ON public.match_events;
DROP POLICY IF EXISTS match_events_admin_referee_write ON public.match_events;

-- SECURITY DEFINER is safe here because both functions validate the caller's
-- match assignment before changing any rows.
CREATE OR REPLACE FUNCTION public.log_match_event(
    p_match_id uuid, p_player_id uuid, p_assist_player_id uuid,
    p_event_type text, p_minute integer
)
RETURNS public.match_events
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    target_match public.matches%ROWTYPE;
    target_player public.players%ROWTYPE;
    inserted_event public.match_events%ROWTYPE;
BEGIN
    IF NOT public.can_operate_match(p_match_id) THEN
        RAISE EXCEPTION 'You are not assigned to this match';
    END IF;
    SELECT * INTO target_match FROM public.matches
    WHERE id = p_match_id AND status = 'live' FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Events can only be logged for a live match'; END IF;
    SELECT * INTO target_player FROM public.players
    WHERE id = p_player_id AND is_active;
    IF NOT FOUND OR target_player.team_id NOT IN (target_match.home_team_id, target_match.away_team_id) THEN
        RAISE EXCEPTION 'Player is not an active player in this match';
    END IF;
    IF p_event_type NOT IN ('goal', 'yellow_card', 'red_card', 'own_goal') THEN
        RAISE EXCEPTION 'Invalid event type';
    END IF;
    IF p_minute NOT BETWEEN 0 AND 150 THEN RAISE EXCEPTION 'Invalid event minute'; END IF;
    IF p_assist_player_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.players WHERE id = p_assist_player_id AND is_active
        AND team_id = target_player.team_id AND id <> p_player_id
    ) THEN RAISE EXCEPTION 'Assist player is not valid for this event'; END IF;
    INSERT INTO public.match_events (match_id, player_id, assist_player_id, event_type, minute)
    VALUES (p_match_id, p_player_id, CASE WHEN p_event_type = 'goal' THEN p_assist_player_id ELSE NULL END, p_event_type, p_minute)
    RETURNING * INTO inserted_event;
    IF p_event_type IN ('goal', 'own_goal') THEN
        UPDATE public.matches
        SET home_score = home_score + CASE
                WHEN (p_event_type = 'goal' AND target_player.team_id = target_match.home_team_id)
                  OR (p_event_type = 'own_goal' AND target_player.team_id = target_match.away_team_id) THEN 1 ELSE 0 END,
            away_score = away_score + CASE
                WHEN (p_event_type = 'goal' AND target_player.team_id = target_match.away_team_id)
                  OR (p_event_type = 'own_goal' AND target_player.team_id = target_match.home_team_id) THEN 1 ELSE 0 END
        WHERE id = p_match_id;
    END IF;
    RETURN inserted_event;
END;
$$;

CREATE OR REPLACE FUNCTION public.undo_match_event(p_match_event_id uuid)
RETURNS public.match_events
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    removed_event public.match_events%ROWTYPE;
    target_match public.matches%ROWTYPE;
    target_player public.players%ROWTYPE;
BEGIN
    SELECT * INTO removed_event FROM public.match_events WHERE id = p_match_event_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Match event was not found'; END IF;
    IF NOT public.can_operate_match(removed_event.match_id) THEN RAISE EXCEPTION 'You are not assigned to this match'; END IF;
    SELECT * INTO target_match FROM public.matches WHERE id = removed_event.match_id FOR UPDATE;
    IF target_match.status = 'completed' THEN RAISE EXCEPTION 'Events cannot be removed from a completed match'; END IF;
    IF removed_event.event_type IN ('goal', 'own_goal') THEN
        SELECT * INTO target_player FROM public.players WHERE id = removed_event.player_id;
        IF (removed_event.event_type = 'goal' AND target_player.team_id = target_match.home_team_id)
           OR (removed_event.event_type = 'own_goal' AND target_player.team_id = target_match.away_team_id) THEN
            UPDATE public.matches SET home_score = GREATEST(0, home_score - 1) WHERE id = target_match.id;
        ELSE
            UPDATE public.matches SET away_score = GREATEST(0, away_score - 1) WHERE id = target_match.id;
        END IF;
    END IF;
    DELETE FROM public.match_events WHERE id = p_match_event_id;
    RETURN removed_event;
END;
$$;

COMMIT;
