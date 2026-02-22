
-- =============================================
-- Step 1: project_action_items table
-- =============================================
CREATE TABLE public.project_action_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  project_id uuid NOT NULL REFERENCES public.projects(id),
  title text NOT NULL,
  description text,
  assigned_to uuid REFERENCES public.profiles(id),
  assigned_by uuid REFERENCES public.profiles(id),
  status text NOT NULL DEFAULT 'open',
  priority text NOT NULL DEFAULT 'normal',
  due_date date,
  attachment_ids jsonb DEFAULT '[]'::jsonb,
  completion_note text,
  completion_attachments jsonb DEFAULT '[]'::jsonb,
  completed_at timestamptz,
  gchat_thread_id text,
  gchat_space_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =============================================
-- Step 1: project_timeline_events table
-- =============================================
CREATE TABLE public.project_timeline_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  project_id uuid NOT NULL REFERENCES public.projects(id),
  event_type text NOT NULL,
  description text,
  actor_id uuid REFERENCES public.profiles(id),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =============================================
-- Triggers
-- =============================================

-- updated_at trigger
CREATE TRIGGER update_project_action_items_updated_at
  BEFORE UPDATE ON public.project_action_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-set completed_at when status changes to done
CREATE OR REPLACE FUNCTION public.action_item_set_completed_at()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'done' AND (OLD.status IS NULL OR OLD.status != 'done') THEN
    NEW.completed_at = now();
  END IF;
  IF NEW.status != 'done' THEN
    NEW.completed_at = NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER action_item_completed_at_trigger
  BEFORE UPDATE ON public.project_action_items
  FOR EACH ROW
  EXECUTE FUNCTION public.action_item_set_completed_at();

-- Auto-insert timeline event on action item creation
CREATE OR REPLACE FUNCTION public.action_item_created_timeline()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  assignee_name text;
  assigner_name text;
BEGIN
  SELECT display_name INTO assignee_name FROM public.profiles WHERE id = NEW.assigned_to;
  SELECT display_name INTO assigner_name FROM public.profiles WHERE id = NEW.assigned_by;

  INSERT INTO public.project_timeline_events (company_id, project_id, event_type, description, actor_id, metadata)
  VALUES (
    NEW.company_id,
    NEW.project_id,
    'action_item_created',
    COALESCE(assigner_name, 'Someone') || ' assigned "' || NEW.title || '" to ' || COALESCE(assignee_name, 'unassigned'),
    NEW.assigned_by,
    jsonb_build_object('action_item_id', NEW.id, 'title', NEW.title, 'priority', NEW.priority)
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER action_item_created_timeline_trigger
  AFTER INSERT ON public.project_action_items
  FOR EACH ROW
  EXECUTE FUNCTION public.action_item_created_timeline();

-- Auto-insert timeline event on action item completion
CREATE OR REPLACE FUNCTION public.action_item_completed_timeline()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  completer_name text;
BEGIN
  IF NEW.status = 'done' AND (OLD.status IS NULL OR OLD.status != 'done') THEN
    SELECT display_name INTO completer_name FROM public.profiles WHERE id = NEW.assigned_to;

    INSERT INTO public.project_timeline_events (company_id, project_id, event_type, description, actor_id, metadata)
    VALUES (
      NEW.company_id,
      NEW.project_id,
      'action_item_completed',
      COALESCE(completer_name, 'Someone') || ' completed "' || NEW.title || '"',
      NEW.assigned_to,
      jsonb_build_object('action_item_id', NEW.id, 'title', NEW.title, 'completion_note', NEW.completion_note)
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER action_item_completed_timeline_trigger
  AFTER UPDATE ON public.project_action_items
  FOR EACH ROW
  EXECUTE FUNCTION public.action_item_completed_timeline();

-- Auto-insert notification on action item creation
CREATE OR REPLACE FUNCTION public.action_item_notify_assignee()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  assigner_name text;
  proj_id_str text;
BEGIN
  IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to != NEW.assigned_by THEN
    SELECT display_name INTO assigner_name FROM public.profiles WHERE id = NEW.assigned_by;

    INSERT INTO public.notifications (company_id, user_id, type, title, message, link, metadata)
    VALUES (
      NEW.company_id,
      NEW.assigned_to,
      'action_item_assigned',
      'New Action Item',
      COALESCE(assigner_name, 'Someone') || ' assigned you: ' || NEW.title,
      '/projects/' || NEW.project_id::text,
      jsonb_build_object('action_item_id', NEW.id, 'project_id', NEW.project_id)
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER action_item_notify_trigger
  AFTER INSERT ON public.project_action_items
  FOR EACH ROW
  EXECUTE FUNCTION public.action_item_notify_assignee();

-- =============================================
-- RLS
-- =============================================
ALTER TABLE public.project_action_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_timeline_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view action items"
  ON public.project_action_items FOR SELECT
  USING (public.is_company_member(company_id));

CREATE POLICY "Company members can create action items"
  ON public.project_action_items FOR INSERT
  WITH CHECK (public.is_company_member(company_id));

CREATE POLICY "Company members can update action items"
  ON public.project_action_items FOR UPDATE
  USING (public.is_company_member(company_id));

CREATE POLICY "Company members can delete action items"
  ON public.project_action_items FOR DELETE
  USING (public.is_company_member(company_id));

CREATE POLICY "Company members can view timeline events"
  ON public.project_timeline_events FOR SELECT
  USING (public.is_company_member(company_id));

CREATE POLICY "Company members can insert timeline events"
  ON public.project_timeline_events FOR INSERT
  WITH CHECK (public.is_company_member(company_id));

-- =============================================
-- Realtime
-- =============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_action_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_timeline_events;

-- =============================================
-- Storage bucket
-- =============================================
INSERT INTO storage.buckets (id, name, public) VALUES ('action-item-attachments', 'action-item-attachments', false);

CREATE POLICY "Company members can upload action item attachments"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'action-item-attachments' AND auth.uid() IS NOT NULL);

CREATE POLICY "Company members can view action item attachments"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'action-item-attachments' AND auth.uid() IS NOT NULL);

CREATE POLICY "Company members can delete action item attachments"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'action-item-attachments' AND auth.uid() IS NOT NULL);
