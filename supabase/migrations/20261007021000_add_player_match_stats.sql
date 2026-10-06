BEGIN;

CREATE TABLE IF NOT EXISTS public.player_match_stats (
    match_id uuid NOT NULL REFERENCES public.matches (id) ON DELETE CASCADE,
    player_id uuid NOT NULL REFERENCES public.players (id) ON DELETE CASCADE,
    rating numeric(3,1) CHECK (rating BETWEEN 0 AND 10),
    is_man_of_match boolean NOT NULL DEFAULT false,
    saves integer NOT NULL DEFAULT 0 CHECK (saves >= 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (match_id, player_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS player_match_stats_one_motm_per_match
    ON public.player_match_stats (match_id) WHERE is_man_of_match;

ALTER TABLE public.player_match_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS player_match_stats_public_read ON public.player_match_stats;
CREATE POLICY player_match_stats_public_read ON public.player_match_stats
    FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS player_match_stats_official_write ON public.player_match_stats;
CREATE POLICY player_match_stats_official_write ON public.player_match_stats
    FOR ALL TO authenticated
    USING (public.can_operate_match(match_id))
    WITH CHECK (public.can_operate_match(match_id));

CREATE OR REPLACE VIEW public.player_stats_view AS
WITH event_stats AS (
    SELECT p.id AS player_id,
        count(*) FILTER (WHERE e.player_id = p.id AND e.event_type = 'goal')::integer AS goals,
        count(*) FILTER (WHERE e.assist_player_id = p.id)::integer AS assists,
        count(*) FILTER (WHERE e.player_id = p.id AND e.event_type = 'yellow_card')::integer AS yellow_cards,
        count(*) FILTER (WHERE e.player_id = p.id AND e.event_type = 'red_card')::integer AS red_cards
    FROM public.players p
    LEFT JOIN public.match_events e ON e.player_id = p.id OR e.assist_player_id = p.id
    GROUP BY p.id
), match_stats AS (
    SELECT player_id, count(*)::integer AS appearances,
        count(*) FILTER (WHERE is_man_of_match)::integer AS man_of_matches,
        round(avg(rating), 1) AS average_rating,
        coalesce(sum(saves), 0)::integer AS saves
    FROM public.player_match_stats GROUP BY player_id
)
SELECT p.id AS player_id,
    coalesce(e.goals, 0) AS goals, coalesce(e.assists, 0) AS assists,
    coalesce(e.yellow_cards, 0) AS yellow_cards, coalesce(e.red_cards, 0) AS red_cards,
    coalesce(s.appearances, 0) AS appearances, coalesce(s.man_of_matches, 0) AS man_of_matches,
    s.average_rating, coalesce(s.saves, 0) AS saves
FROM public.players p
LEFT JOIN event_stats e ON e.player_id = p.id
LEFT JOIN match_stats s ON s.player_id = p.id;

GRANT SELECT ON public.player_match_stats, public.player_stats_view TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.player_match_stats TO authenticated;

COMMIT;
