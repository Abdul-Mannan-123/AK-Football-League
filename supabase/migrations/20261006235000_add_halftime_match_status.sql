-- Run this migration against an existing AKFL database.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

ALTER TABLE public.teams ALTER COLUMN id SET DEFAULT uuid_generate_v4();
ALTER TABLE public.players ALTER COLUMN id SET DEFAULT uuid_generate_v4();
ALTER TABLE public.seasons ALTER COLUMN id SET DEFAULT uuid_generate_v4();
ALTER TABLE public.groups ALTER COLUMN id SET DEFAULT uuid_generate_v4();
ALTER TABLE public.matches ALTER COLUMN id SET DEFAULT uuid_generate_v4();
ALTER TABLE public.match_events ALTER COLUMN id SET DEFAULT uuid_generate_v4();
ALTER TABLE public.news ALTER COLUMN id SET DEFAULT uuid_generate_v4();

ALTER TABLE public.players
    DROP CONSTRAINT IF EXISTS players_team_id_fkey;

ALTER TABLE public.players
    ADD CONSTRAINT players_team_id_fkey
    FOREIGN KEY (team_id) REFERENCES public.teams (id)
    ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE public.matches
    DROP CONSTRAINT IF EXISTS matches_status_valid;

ALTER TABLE public.matches
    ADD CONSTRAINT matches_status_valid
    CHECK (status IN ('scheduled', 'live', 'halftime', 'completed'));
