ALTER TABLE public.signal_applications
  ADD CONSTRAINT signal_applications_property_job_unique
  UNIQUE (property_id, job_number);

ALTER TABLE public.signal_violations
  ADD CONSTRAINT signal_violations_property_violation_unique
  UNIQUE (property_id, violation_number);