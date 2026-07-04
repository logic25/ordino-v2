-- 1. Table
CREATE TABLE public.permit_playbooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  market_id uuid NOT NULL REFERENCES public.markets(id) ON DELETE CASCADE,
  created_by uuid REFERENCES public.profiles(id),
  permit_type text NOT NULL,
  summary text,
  qa jsonb NOT NULL DEFAULT '[]'::jsonb,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_verified_at timestamptz,
  last_ai_research_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX permit_playbooks_uniq ON public.permit_playbooks (company_id, market_id, permit_type);
CREATE INDEX permit_playbooks_market_idx ON public.permit_playbooks (market_id);

-- 2. Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.permit_playbooks TO authenticated;
GRANT ALL ON public.permit_playbooks TO service_role;

-- 3. RLS
ALTER TABLE public.permit_playbooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members manage permit_playbooks"
  ON public.permit_playbooks
  FOR ALL
  TO authenticated
  USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));

-- 4. updated_at trigger
CREATE TRIGGER update_permit_playbooks_updated_at
  BEFORE UPDATE ON public.permit_playbooks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Seed Bronxville market + Sign Permit playbook for each existing company
DO $$
DECLARE
  c record;
  m_id uuid;
  now_ts timestamptz := now();
  qa_seed jsonb;
BEGIN
  FOR c IN SELECT id FROM public.companies LOOP
    -- Ensure Bronxville market exists for this company
    INSERT INTO public.markets (company_id, name, state, tier, mode, operational_score, commercial_score)
    VALUES (c.id, 'Bronxville', 'NY', 2, 'reactive', 30, 15)
    ON CONFLICT (company_id, name) DO NOTHING;

    SELECT id INTO m_id FROM public.markets WHERE company_id = c.id AND name = 'Bronxville';

    -- Build seeded Q&A — all human-verified (ai_generated=false, verified=true)
    qa_seed := jsonb_build_array(
      jsonb_build_object(
        'id', gen_random_uuid(), 'question', 'Submission method', 'kind', 'text',
        'answer', 'Drop off or mail — Village of Bronxville Building Dept, 200 Pondfield Rd, Bronxville, NY 10708. Online portal: https://www.villageofbronxville.com/building/pages/permits',
        'ai_generated', false, 'source', null, 'confidence', null,
        'verified', true, 'verified_by', null, 'verified_at', now_ts
      ),
      jsonb_build_object(
        'id', gen_random_uuid(), 'question', 'Turnaround time', 'kind', 'duration',
        'answer', '~3 weeks for review',
        'ai_generated', false, 'source', null, 'confidence', null,
        'verified', true, 'verified_by', null, 'verified_at', now_ts
      ),
      jsonb_build_object(
        'id', gen_random_uuid(), 'question', 'Fees', 'kind', 'fee',
        'answer', 'See fee schedule on the sign permit application form',
        'ai_generated', false, 'source', null, 'confidence', null,
        'verified', true, 'verified_by', null, 'verified_at', now_ts
      ),
      jsonb_build_object(
        'id', gen_random_uuid(), 'question', 'Department contact', 'kind', 'contact',
        'answer', 'Building Department — 914-337-7338',
        'ai_generated', false, 'source', null, 'confidence', null,
        'verified', true, 'verified_by', null, 'verified_at', now_ts
      ),
      jsonb_build_object(
        'id', gen_random_uuid(), 'question', 'Required forms', 'kind', 'text',
        'answer', 'Sign Permit Application (sign_permit_application_form_1-24-19.pdf) — upload via the Attachments panel after deploy.',
        'ai_generated', false, 'source', null, 'confidence', null,
        'verified', true, 'verified_by', null, 'verified_at', now_ts
      ),
      jsonb_build_object(
        'id', gen_random_uuid(), 'question', 'Pre-requisites', 'kind', 'text',
        'answer', 'GC must go to the Sign Committee before/with submission.',
        'ai_generated', false, 'source', null, 'confidence', null,
        'verified', true, 'verified_by', null, 'verified_at', now_ts
      ),
      jsonb_build_object(
        'id', gen_random_uuid(), 'question', 'Portal / URL', 'kind', 'url',
        'answer', 'https://www.villageofbronxville.com/building/pages/permits',
        'ai_generated', false, 'source', null, 'confidence', null,
        'verified', true, 'verified_by', null, 'verified_at', now_ts
      )
    );

    INSERT INTO public.permit_playbooks (
      company_id, market_id, permit_type, summary,
      qa, attachments, last_verified_at
    ) VALUES (
      c.id, m_id, 'Sign Permit',
      'Village of Bronxville — exterior sign permit',
      qa_seed, '[]'::jsonb, now_ts
    )
    ON CONFLICT (company_id, market_id, permit_type) DO NOTHING;
  END LOOP;
END $$;

-- 6. Beacon lookup RPC (returns verified flag intact so the prompt builder can label slots)
CREATE OR REPLACE FUNCTION public.lookup_permit_playbook(
  _company_id uuid,
  _market_name text,
  _permit_type text
)
RETURNS TABLE (
  market_name text,
  state text,
  permit_type text,
  summary text,
  qa jsonb,
  last_verified_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.name, m.state, p.permit_type, p.summary, p.qa, p.last_verified_at
  FROM public.permit_playbooks p
  JOIN public.markets m ON m.id = p.market_id
  WHERE p.company_id = _company_id
    AND lower(m.name) = lower(_market_name)
    AND lower(p.permit_type) = lower(_permit_type)
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.lookup_permit_playbook(uuid, text, text) TO authenticated, service_role;

-- 7. Changelog entry per company
INSERT INTO public.changelog_entries (company_id, date, title, description, tag)
SELECT id, CURRENT_DATE, 'Permit Playbooks',
       'Reusable jurisdiction playbooks with AI draft, human verification, and Beacon knowledge access',
       'feature'
FROM public.companies;