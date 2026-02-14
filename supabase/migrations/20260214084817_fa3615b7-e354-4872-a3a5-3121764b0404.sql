
ALTER TABLE payment_promises DROP CONSTRAINT payment_promises_source_check;
ALTER TABLE payment_promises ADD CONSTRAINT payment_promises_source_check 
  CHECK (source = ANY (ARRAY['phone_call','email','portal','in_person','ai_detected']));

ALTER TABLE collection_tasks DROP CONSTRAINT collection_tasks_task_type_check;
ALTER TABLE collection_tasks ADD CONSTRAINT collection_tasks_task_type_check 
  CHECK (task_type = ANY (ARRAY['gentle_reminder','urgent_followup','payment_plan_offer','escalation','follow_up_call','follow_up_email','custom']));
