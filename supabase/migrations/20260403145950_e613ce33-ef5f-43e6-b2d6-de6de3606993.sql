ALTER TABLE public.change_orders ADD COLUMN is_non_billable boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN accuracy_goal numeric DEFAULT NULL;