BEGIN;

CREATE TABLE public.profile_training_classification (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  training_year text NOT NULL
    CHECK (training_year IN ('Year 1', 'Year 2', 'Year 3', 'Year 4', 'Unclassified')),
  updated_by uuid NOT NULL REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profile_training_classification ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.profile_training_classification FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.profile_training_classification TO authenticated;

CREATE POLICY "Authenticated read training classification"
  ON public.profile_training_classification FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins insert training classification"
  ON public.profile_training_classification FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    AND updated_by = auth.uid()
  );

CREATE POLICY "Admins update training classification"
  ON public.profile_training_classification FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    AND updated_by = auth.uid()
  );

-- No backfill: a missing row is displayed as Unclassified by the application.
-- No DELETE policy: the supervisor assigns Unclassified explicitly instead.

COMMIT;
