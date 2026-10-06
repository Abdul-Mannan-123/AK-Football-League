BEGIN;

CREATE TABLE IF NOT EXISTS public.referees (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name text NOT NULL,
    photo_url text,
    license_level text,
    is_active boolean NOT NULL DEFAULT true,
    CONSTRAINT referees_name_not_blank CHECK (length(trim(name)) > 0)
);

CREATE INDEX IF NOT EXISTS referees_active_idx ON public.referees (is_active) WHERE is_active = true;

ALTER TABLE public.referees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS referees_public_read ON public.referees;
CREATE POLICY referees_public_read ON public.referees
    FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS referees_admin_write ON public.referees;
CREATE POLICY referees_admin_write ON public.referees
    FOR ALL TO authenticated
    USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
    WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

GRANT SELECT ON public.referees TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.referees TO authenticated;

COMMIT;
