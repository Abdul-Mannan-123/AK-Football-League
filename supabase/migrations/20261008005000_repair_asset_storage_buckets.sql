BEGIN;

-- Production repair: migrations in GitHub do not execute automatically in Supabase.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
    ('team-logos', 'team-logos', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp']),
    ('player-photos', 'player-photos', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp']),
    ('referee-photos', 'referee-photos', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp']),
    ('news-images', 'news-images', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
SET
    name = EXCLUDED.name,
    public = true,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS asset_public_read ON storage.objects;
CREATE POLICY asset_public_read
ON storage.objects
FOR SELECT
TO public
USING (bucket_id IN ('team-logos', 'player-photos', 'referee-photos', 'news-images'));

DROP POLICY IF EXISTS asset_admin_insert ON storage.objects;
CREATE POLICY asset_admin_insert
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    (
        bucket_id IN ('team-logos', 'player-photos', 'referee-photos')
        AND (public.current_user_is_admin() OR public.can_manage_competition())
    )
    OR (bucket_id = 'news-images' AND public.can_manage_news())
);

DROP POLICY IF EXISTS asset_admin_update ON storage.objects;
CREATE POLICY asset_admin_update
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    (
        bucket_id IN ('team-logos', 'player-photos', 'referee-photos')
        AND (public.current_user_is_admin() OR public.can_manage_competition())
    )
    OR (bucket_id = 'news-images' AND public.can_manage_news())
)
WITH CHECK (
    (
        bucket_id IN ('team-logos', 'player-photos', 'referee-photos')
        AND (public.current_user_is_admin() OR public.can_manage_competition())
    )
    OR (bucket_id = 'news-images' AND public.can_manage_news())
);

DROP POLICY IF EXISTS asset_admin_delete ON storage.objects;
CREATE POLICY asset_admin_delete
ON storage.objects
FOR DELETE
TO authenticated
USING (
    (
        bucket_id IN ('team-logos', 'player-photos', 'referee-photos')
        AND public.current_user_is_admin()
    )
    OR (bucket_id = 'news-images' AND public.can_manage_news())
);

COMMIT;
