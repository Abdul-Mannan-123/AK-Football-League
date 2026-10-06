BEGIN;

DROP POLICY IF EXISTS player_match_stats_official_write ON public.player_match_stats;
CREATE POLICY player_match_stats_official_write ON public.player_match_stats
    FOR ALL TO authenticated
    USING (
        public.can_manage_competition()
        OR public.can_operate_match(match_id)
    )
    WITH CHECK (
        public.can_manage_competition()
        OR public.can_operate_match(match_id)
    );

COMMIT;
