-- Allow proposals to exist without a property (for leads)
ALTER TABLE public.proposals ALTER COLUMN property_id DROP NOT NULL;