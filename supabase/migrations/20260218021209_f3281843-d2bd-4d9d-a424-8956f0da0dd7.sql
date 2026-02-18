
ALTER TABLE public.proposals ADD COLUMN job_description text;

ALTER TABLE public.universal_documents ADD COLUMN proposal_id uuid REFERENCES public.proposals(id);
