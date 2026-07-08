
CREATE TABLE public.content_notification_reads (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.content_notification_reads TO authenticated;
GRANT ALL ON public.content_notification_reads TO service_role;

ALTER TABLE public.content_notification_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY content_notification_reads_select_own
  ON public.content_notification_reads FOR SELECT
  TO authenticated USING (user_id = auth.uid());

CREATE POLICY content_notification_reads_insert_own
  ON public.content_notification_reads FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY content_notification_reads_update_own
  ON public.content_notification_reads FOR UPDATE
  TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER trg_content_notification_reads_updated_at
  BEFORE UPDATE ON public.content_notification_reads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='content_candidates'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.content_candidates';
  END IF;
END $$;

INSERT INTO public.changelog_entries (company_id, title, description, tag)
VALUES (
  '01993413-d3e8-4377-9e21-70f270f04487',
  'New content candidates bell',
  'The Content page now shows a bell with a badge whenever Beacon adds new candidates for review. Click the bell to see the new items and jump straight to them.',
  'improvement'
);
