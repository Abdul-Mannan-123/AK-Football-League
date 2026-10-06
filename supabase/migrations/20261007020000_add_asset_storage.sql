BEGIN;

INSERT INTO storage.buckets (id, name, public)
VALUES
    ('team-logos', 'team-logos', true),
    ('player-photos', 'player-photos', true),
    ('referee-photos', 'referee-photos', true),
    ('news-images', 'news-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS asset_public_read ON storage.objects;
CREATE POLICY asset_public_read ON storage.objects
    FOR SELECT TO public
    USING (bucket_id IN ('team-logos', 'player-photos', 'referee-photos', 'news-images'));

DROP POLICY IF EXISTS asset_admin_insert ON storage.objects;
CREATE POLICY asset_admin_insert ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id IN ('team-logos', 'player-photos', 'referee-photos')
        AND (public.current_user_is_admin() OR public.can_manage_competition())
        OR bucket_id = 'news-images'
        AND public.can_manage_news()
    );

DROP POLICY IF EXISTS asset_admin_update ON storage.objects;
CREATE POLICY asset_admin_update ON storage.objects
    FOR UPDATE TO authenticated
    USING (
        (bucket_id IN ('team-logos', 'player-photos', 'referee-photos')
         AND (public.current_user_is_admin() OR public.can_manage_competition()))
        OR (bucket_id = 'news-images' AND public.can_manage_news())
    )
    WITH CHECK (
        (bucket_id IN ('team-logos', 'player-photos', 'referee-photos')
         AND (public.current_user_is_admin() OR public.can_manage_competition()))
        OR (bucket_id = 'news-images' AND public.can_manage_news())
    );

DROP POLICY IF EXISTS asset_admin_delete ON storage.objects;
CREATE POLICY asset_admin_delete ON storage.objects
    FOR DELETE TO authenticated
    USING (
        (bucket_id IN ('team-logos', 'player-photos', 'referee-photos')
         AND public.current_user_is_admin())
        OR (bucket_id = 'news-images' AND public.can_manage_news())
    );

COMMIT;
