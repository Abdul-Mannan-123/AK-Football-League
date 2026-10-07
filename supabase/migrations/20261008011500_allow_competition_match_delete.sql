BEGIN;

DROP POLICY IF EXISTS matches_competition_delete ON public.matches;
CREATE POLICY matches_competition_delete
ON public.matches
FOR DELETE
TO authenticated
USING (public.can_manage_competition());

COMMIT;
