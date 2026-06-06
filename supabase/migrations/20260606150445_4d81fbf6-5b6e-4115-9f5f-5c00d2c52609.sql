
ALTER TABLE public.ai_feedback
  ADD COLUMN rating text NOT NULL DEFAULT 'edit'
    CHECK (rating IN ('up', 'down', 'edit'));

ALTER TABLE public.ai_feedback
  ALTER COLUMN correction_text DROP NOT NULL;

ALTER TABLE public.ai_feedback
  ADD CONSTRAINT ai_feedback_edit_requires_text
    CHECK (rating <> 'edit' OR (correction_text IS NOT NULL AND length(trim(correction_text)) > 0));

CREATE UNIQUE INDEX ai_feedback_unique_per_user_per_source
  ON public.ai_feedback(source_id, user_id)
  WHERE source_id IS NOT NULL AND user_id IS NOT NULL;
