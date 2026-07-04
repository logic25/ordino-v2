ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS event_id uuid
    REFERENCES public.bd_events(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_event
  ON public.notifications(event_id) WHERE event_id IS NOT NULL;