
DO $$
DECLARE
  dupes uuid[] := ARRAY[
    'b6803425-2c86-4173-9f58-d66ef4f47bfa'::uuid,
    '99d5c902-eb24-4659-996b-72d41df61aa1'::uuid,
    'a4931a69-5e61-4440-b48d-3094324e55cc'::uuid,
    '41514829-e0dd-4be6-84e7-dea8bd99dd74'::uuid
  ];
BEGIN
  -- Delete cross-company FK refs first
  DELETE FROM rfp_partner_outreach 
  WHERE partner_client_id IN (SELECT id FROM clients WHERE company_id = ANY(dupes));

  DELETE FROM billing_notification_queue WHERE company_id = ANY(dupes);
  DELETE FROM billing_notification_preferences WHERE company_id = ANY(dupes);
  DELETE FROM action_item_comments WHERE company_id = ANY(dupes);
  DELETE FROM billing_schedules WHERE company_id = ANY(dupes);
  DELETE FROM ordino_assistant_conversations WHERE company_id = ANY(dupes);
  DELETE FROM project_timeline_events WHERE company_id = ANY(dupes);
  DELETE FROM project_action_items WHERE company_id = ANY(dupes);
  DELETE FROM ai_usage_logs WHERE company_id = ANY(dupes);
  DELETE FROM ai_roadmap_suggestions WHERE company_id = ANY(dupes);
  DELETE FROM telemetry_events WHERE company_id = ANY(dupes);
  DELETE FROM change_orders WHERE company_id = ANY(dupes);
  DELETE FROM roadmap_items WHERE company_id = ANY(dupes);
  DELETE FROM feature_requests WHERE company_id = ANY(dupes);
  DELETE FROM checklist_followup_drafts WHERE company_id = ANY(dupes);
  DELETE FROM project_checklist_items WHERE company_id = ANY(dupes);
  DELETE FROM pis_tracking WHERE company_id = ANY(dupes);
  DELETE FROM notifications WHERE company_id = ANY(dupes);
  DELETE FROM signal_applications WHERE company_id = ANY(dupes);
  DELETE FROM signal_violations WHERE company_id = ANY(dupes);
  DELETE FROM signal_subscriptions WHERE company_id = ANY(dupes);
  DELETE FROM lead_notes WHERE company_id = ANY(dupes);
  DELETE FROM leads WHERE company_id = ANY(dupes);
  DELETE FROM lead_statuses WHERE company_id = ANY(dupes);
  DELETE FROM proposal_follow_ups WHERE company_id = ANY(dupes);
  DELETE FROM partner_email_templates WHERE company_id = ANY(dupes);
  DELETE FROM rfp_response_drafts WHERE company_id = ANY(dupes);
  DELETE FROM rfp_monitoring_rules WHERE company_id = ANY(dupes);
  DELETE FROM rfp_partner_outreach WHERE company_id = ANY(dupes);
  DELETE FROM discovered_rfps WHERE company_id = ANY(dupes);
  DELETE FROM rfp_sources WHERE company_id = ANY(dupes);
  DELETE FROM rfps WHERE company_id = ANY(dupes);
  DELETE FROM rfp_content WHERE company_id = ANY(dupes);
  DELETE FROM employee_reviews WHERE company_id = ANY(dupes);
  DELETE FROM universal_documents WHERE company_id = ANY(dupes);
  DELETE FROM calendar_events WHERE company_id = ANY(dupes);
  DELETE FROM attendance_logs WHERE company_id = ANY(dupes);
  DELETE FROM billing_rule_documents WHERE company_id = ANY(dupes);
  DELETE FROM retainer_transactions WHERE company_id = ANY(dupes);
  DELETE FROM client_retainers WHERE company_id = ANY(dupes);
  DELETE FROM claimflow_referrals WHERE company_id = ANY(dupes);
  DELETE FROM ach_authorizations WHERE company_id = ANY(dupes);
  DELETE FROM payment_plan_installments WHERE company_id = ANY(dupes);
  DELETE FROM payment_plans WHERE company_id = ANY(dupes);
  DELETE FROM automation_logs WHERE company_id = ANY(dupes);
  DELETE FROM automation_rules WHERE company_id = ANY(dupes);
  DELETE FROM cash_forecasts WHERE company_id = ANY(dupes);
  DELETE FROM dispute_messages WHERE company_id = ANY(dupes);
  DELETE FROM invoice_disputes WHERE company_id = ANY(dupes);
  DELETE FROM payment_promises WHERE company_id = ANY(dupes);
  DELETE FROM collection_tasks WHERE company_id = ANY(dupes);
  DELETE FROM client_payment_analytics WHERE company_id = ANY(dupes);
  DELETE FROM payment_predictions WHERE company_id = ANY(dupes);
  DELETE FROM qbo_connections WHERE company_id = ANY(dupes);
  DELETE FROM invoice_follow_ups WHERE company_id = ANY(dupes);
  DELETE FROM invoice_activity_log WHERE company_id = ANY(dupes);
  DELETE FROM client_billing_rules WHERE company_id = ANY(dupes);
  DELETE FROM billing_requests WHERE company_id = ANY(dupes);
  DELETE FROM invoices WHERE company_id = ANY(dupes);
  DELETE FROM email_drafts WHERE company_id = ANY(dupes);
  DELETE FROM email_reminders WHERE company_id = ANY(dupes);
  DELETE FROM scheduled_emails WHERE company_id = ANY(dupes);
  DELETE FROM email_notes WHERE company_id = ANY(dupes);
  DELETE FROM email_attachments WHERE company_id = ANY(dupes);
  DELETE FROM email_project_tags WHERE company_id = ANY(dupes);
  DELETE FROM emails WHERE company_id = ANY(dupes);
  DELETE FROM gmail_connections WHERE company_id = ANY(dupes);
  DELETE FROM company_reviews WHERE company_id = ANY(dupes);
  DELETE FROM proposal_contacts WHERE proposal_id IN (SELECT id FROM proposals WHERE company_id = ANY(dupes));
  DELETE FROM client_contacts WHERE company_id = ANY(dupes);
  DELETE FROM rfi_requests WHERE company_id = ANY(dupes);
  DELETE FROM rfi_templates WHERE company_id = ANY(dupes);
  DELETE FROM dob_applications WHERE company_id = ANY(dupes);
  DELETE FROM activities WHERE company_id = ANY(dupes);
  
  UPDATE projects SET proposal_id = NULL WHERE company_id = ANY(dupes);
  UPDATE proposals SET converted_project_id = NULL WHERE company_id = ANY(dupes);
  
  DELETE FROM projects WHERE company_id = ANY(dupes);
  DELETE FROM proposals WHERE company_id = ANY(dupes);
  DELETE FROM clients WHERE company_id = ANY(dupes);
  DELETE FROM properties WHERE company_id = ANY(dupes);
  DELETE FROM services WHERE company_id = ANY(dupes);
  DELETE FROM lead_sources WHERE company_id = ANY(dupes);
  DELETE FROM document_folders WHERE company_id = ANY(dupes);
  DELETE FROM role_permissions WHERE company_id = ANY(dupes);
  
  DELETE FROM profiles WHERE user_id = '7fa6cfba-3f79-4dcc-966f-f78aa77fda10';
  DELETE FROM companies WHERE id = ANY(dupes);
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_join_existing_company(first_name text, last_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  target_company_id uuid;
  existing_company_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT company_id INTO existing_company_id
  FROM public.profiles
  WHERE user_id = auth.uid();

  IF existing_company_id IS NOT NULL THEN
    RETURN existing_company_id;
  END IF;

  SELECT id INTO target_company_id
  FROM public.companies
  LIMIT 1;

  IF target_company_id IS NULL THEN
    RAISE EXCEPTION 'No company found';
  END IF;

  INSERT INTO public.profiles (user_id, company_id, role, first_name, last_name, display_name)
  VALUES (
    auth.uid(),
    target_company_id,
    'staff'::user_role,
    first_name,
    last_name,
    first_name || ' ' || last_name
  );

  INSERT INTO public.user_roles (user_id, role, company_id)
  VALUES (auth.uid(), 'admin'::app_role, target_company_id)
  ON CONFLICT (user_id, role, company_id) DO NOTHING;

  RETURN target_company_id;
END;
$$;
