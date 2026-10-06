-- Run this migration after the original AKFL schema and halftime migration.
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
    SELECT * INTO target_match
    FROM public.matches
    WHERE id = p_match_id AND status = 'live'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Events can only be logged for a live match';
    END IF;

    SELECT * INTO target_player
    FROM public.players
    WHERE id = p_player_id AND is_active = true;

    IF NOT FOUND OR target_player.team_id NOT IN (target_match.home_team_id, target_match.away_team_id) THEN
        RAISE EXCEPTION 'Player is not an active player in this match';
    END IF;

    IF p_assist_player_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.players
        WHERE id = p_assist_player_id
          AND is_active = true
          AND team_id = target_player.team_id
          AND id <> p_player_id
    ) THEN
        RAISE EXCEPTION 'Assist player is not valid for this event';
    END IF;

    INSERT INTO public.match_events (match_id, player_id, assist_player_id, event_type, minute)
    VALUES (p_match_id, p_player_id,
            CASE WHEN p_event_type = 'goal' THEN p_assist_player_id ELSE NULL END,
            p_event_type, p_minute)
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
    SELECT * INTO removed_event
    FROM public.match_events
    WHERE id = p_match_event_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Match event was not found';
    END IF;

    SELECT * INTO target_match
    FROM public.matches
    WHERE id = removed_event.match_id
    FOR UPDATE;

    IF NOT FOUND OR target_match.status = 'completed' THEN
        RAISE EXCEPTION 'Events cannot be removed from a completed or missing match';
    END IF;

    IF removed_event.event_type = 'goal' THEN
        SELECT * INTO target_player
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

    DELETE FROM public.match_events WHERE id = p_match_event_id;
    RETURN removed_event;
END;
$$;

REVOKE ALL ON FUNCTION public.log_match_event(uuid, uuid, uuid, text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.undo_match_event(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_match_event(uuid, uuid, uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.undo_match_event(uuid) TO authenticated;
