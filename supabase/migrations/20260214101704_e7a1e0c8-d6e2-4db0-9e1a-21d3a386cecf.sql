
-- Calendar events table for two-way Google Calendar sync
CREATE TABLE public.calendar_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  google_event_id TEXT,
  google_calendar_id TEXT DEFAULT 'primary',
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  all_day BOOLEAN DEFAULT false,
  event_type TEXT DEFAULT 'general',
  project_id UUID REFERENCES public.projects(id),
  property_id UUID REFERENCES public.properties(id),
  client_id UUID REFERENCES public.clients(id),
  application_id UUID REFERENCES public.dob_applications(id),
  source_email_id UUID REFERENCES public.emails(id),
  reminder_minutes INTEGER[] DEFAULT '{15}',
  reminder_sent_at TIMESTAMPTZ,
  recurrence_rule TEXT,
  status TEXT DEFAULT 'confirmed',
  sync_status TEXT DEFAULT 'synced',
  last_synced_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, google_event_id)
);

-- Enable RLS
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view company calendar events"
  ON public.calendar_events FOR SELECT
  USING (public.is_company_member(company_id));

CREATE POLICY "Users can create calendar events"
  ON public.calendar_events FOR INSERT
  WITH CHECK (public.is_company_member(company_id));

CREATE POLICY "Users can update own calendar events"
  ON public.calendar_events FOR UPDATE
  USING (public.is_company_member(company_id));

CREATE POLICY "Users can delete own calendar events"
  ON public.calendar_events FOR DELETE
  USING (user_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- Timestamp trigger
CREATE TRIGGER update_calendar_events_updated_at
  BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_calendar_events_company ON public.calendar_events(company_id);
CREATE INDEX idx_calendar_events_user ON public.calendar_events(user_id);
CREATE INDEX idx_calendar_events_dates ON public.calendar_events(start_time, end_time);
CREATE INDEX idx_calendar_events_google ON public.calendar_events(google_event_id);
CREATE INDEX idx_calendar_events_project ON public.calendar_events(project_id);
CREATE INDEX idx_calendar_events_type ON public.calendar_events(event_type);

-- Enable realtime for calendar events
ALTER PUBLICATION supabase_realtime ADD TABLE public.calendar_events;
