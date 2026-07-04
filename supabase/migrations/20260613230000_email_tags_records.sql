-- Email Thread Linking — extend email_project_tags to cover proposals, change orders, and invoices.
--
-- Background:
--   email_project_tags already links emails -> projects with a category (client/agency/etc.).
--   gmail-send already auto-tags outbound emails when called with project_id.
--   gmail-sync stores inbound replies in `emails` with the same thread_id as the original send.
--
-- Gap closed by this migration:
--   When a proposal, change order, or invoice email is sent, we also want a tag pointing at
--   that specific record so the detail page can surface its email thread. One tag row can now
--   point at a project AND a specific record at once.
--
-- After this migration, the existing useThreadEmails(thread_id) hook already returns
-- every message in the thread by joining on emails.thread_id, so replies auto-appear.

-- 1) Add nullable record FKs
ALTER TABLE public.email_project_tags
  ADD COLUMN IF NOT EXISTS proposal_id     uuid REFERENCES public.proposals(id)     ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS change_order_id uuid REFERENCES public.change_orders(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS invoice_id      uuid REFERENCES public.invoices(id)      ON DELETE CASCADE;

-- 2) project_id can now be null (tagging direct-to-proposal without a project is allowed,
--    though in practice we'll always include project_id for rollup).
ALTER TABLE public.email_project_tags
  ALTER COLUMN project_id DROP NOT NULL;

-- 3) Require at least one target so we never have a truly orphan tag row.
ALTER TABLE public.email_project_tags
  DROP CONSTRAINT IF EXISTS email_project_tags_at_least_one_target;
ALTER TABLE public.email_project_tags
  ADD CONSTRAINT email_project_tags_at_least_one_target
  CHECK (
    project_id IS NOT NULL
    OR proposal_id IS NOT NULL
    OR change_order_id IS NOT NULL
    OR invoice_id IS NOT NULL
  );

-- 4) Indexes for the new lookup paths
CREATE INDEX IF NOT EXISTS idx_email_project_tags_proposal     ON public.email_project_tags(proposal_id)     WHERE proposal_id     IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_project_tags_change_order ON public.email_project_tags(change_order_id) WHERE change_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_project_tags_invoice      ON public.email_project_tags(invoice_id)      WHERE invoice_id      IS NOT NULL;

COMMENT ON TABLE public.email_project_tags IS
  'Tags an email to one or more Ordino records (project, proposal, change_order, invoice). The category column classifies the conversation (client/agency/submission/etc.). To list all messages on a thread for a record, join emails on thread_id where any tag row matches the record.';
