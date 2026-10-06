-- Read-only verification checks for the deployed AKFL schema.
-- Run after all migrations. These checks do not create or modify data.

DO $$
DECLARE
    missing integer;
    unprotected integer;
BEGIN
    SELECT count(*) INTO missing
    FROM (VALUES
        ('user_roles'::text), ('match_officials'), ('lineups'),
        ('teams'), ('players'), ('seasons'), ('groups'), ('matches'),
        ('match_events'), ('news')
    ) AS required(table_name)
    WHERE NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = required.table_name
    );
    IF missing > 0 THEN RAISE EXCEPTION 'Missing required tables: %', missing; END IF;

    IF to_regprocedure('public.set_match_status(uuid,text)') IS NULL THEN
        RAISE EXCEPTION 'set_match_status RPC is missing';
    END IF;
    IF to_regprocedure('public.log_match_event(uuid,uuid,uuid,text,integer)') IS NULL THEN
        RAISE EXCEPTION 'log_match_event RPC is missing';
    END IF;
    IF to_regprocedure('public.undo_match_event(uuid)') IS NULL THEN
        RAISE EXCEPTION 'undo_match_event RPC is missing';
    END IF;

    SELECT count(*) INTO unprotected
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename IN ('teams', 'players', 'seasons', 'groups', 'matches',
                        'match_events', 'news', 'user_roles', 'match_officials', 'lineups')
      AND NOT rowsecurity;
    IF unprotected > 0 THEN RAISE EXCEPTION 'RLS is disabled on % required table(s)', unprotected; END IF;

    IF EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'match_events'
          AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
    ) THEN
        RAISE EXCEPTION 'Direct match event writes are still enabled';
    END IF;

    RAISE NOTICE 'AKFL schema security checks passed.';
END $$;

SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('teams', 'players', 'seasons', 'groups', 'matches',
                    'match_events', 'news', 'user_roles', 'match_officials', 'lineups')
ORDER BY tablename;

SELECT policyname, tablename, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('matches', 'match_events', 'user_roles', 'lineups')
ORDER BY tablename, policyname;
