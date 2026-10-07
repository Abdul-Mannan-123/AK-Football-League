BEGIN;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.lineups TO anon, authenticated;

DROP POLICY IF EXISTS lineups_public_read ON public.lineups;
CREATE POLICY lineups_public_read
ON public.lineups
FOR SELECT
TO anon, authenticated
USING (true);

COMMIT;
