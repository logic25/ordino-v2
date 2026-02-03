-- =============================================================================
-- ORDINO MULTI-TENANT DATABASE SCHEMA - Phase 1 Foundation
-- Follows constitution.md architecture: Companies > Users > Properties > Applications > Services > Activities
-- =============================================================================

-- Create enum for user roles
CREATE TYPE public.user_role AS ENUM ('admin', 'manager', 'pm', 'accounting');

-- Create enum for application status
CREATE TYPE public.application_status AS ENUM (
  'draft',
  'filed', 
  'under_review', 
  'objection', 
  'approved', 
  'permit_issued', 
  'inspection', 
  'complete', 
  'closed'
);

-- Create enum for service status  
CREATE TYPE public.service_status AS ENUM (
  'not_started',
  'in_progress', 
  'complete', 
  'billed', 
  'paid'
);

-- Create enum for activity type
CREATE TYPE public.activity_type AS ENUM (
  'time_log',
  'note',
  'call',
  'email',
  'meeting',
  'site_visit',
  'document'
);

-- =============================================================================
-- 1. COMPANIES TABLE (Multi-tenant root)
-- =============================================================================
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE,
  address TEXT,
  phone VARCHAR(50),
  email VARCHAR(255),
  website VARCHAR(255),
  logo_url TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 2. PROFILES TABLE (Users linked to companies)
-- =============================================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  role user_role NOT NULL DEFAULT 'pm',
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  display_name VARCHAR(200),
  phone VARCHAR(50),
  avatar_url TEXT,
  preferences JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_profiles_company ON public.profiles(company_id);
CREATE INDEX idx_profiles_user ON public.profiles(user_id);

-- =============================================================================
-- 3. PROPERTIES TABLE (Buildings/Addresses)
-- =============================================================================
CREATE TABLE public.properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  address TEXT NOT NULL,
  borough VARCHAR(50),
  block VARCHAR(20),
  lot VARCHAR(20),
  bin VARCHAR(20),
  zip_code VARCHAR(10),
  owner_name VARCHAR(255),
  owner_contact TEXT,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_properties_company ON public.properties(company_id);
CREATE INDEX idx_properties_address ON public.properties(address);
CREATE INDEX idx_properties_bin ON public.properties(bin);

-- =============================================================================
-- 4. DOB APPLICATIONS TABLE (Job Numbers)
-- =============================================================================
CREATE TABLE public.dob_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
  job_number VARCHAR(50),
  application_type VARCHAR(100), -- ALT-1, ALT-2, NB, FA, etc.
  description TEXT,
  status application_status DEFAULT 'draft',
  assigned_pm_id UUID REFERENCES public.profiles(id),
  examiner_name VARCHAR(255),
  filed_date DATE,
  approved_date DATE,
  permit_issued_date DATE,
  estimated_value DECIMAL(12, 2),
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.dob_applications ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_applications_company ON public.dob_applications(company_id);
CREATE INDEX idx_applications_property ON public.dob_applications(property_id);
CREATE INDEX idx_applications_job_number ON public.dob_applications(job_number);
CREATE INDEX idx_applications_status ON public.dob_applications(status);
CREATE INDEX idx_applications_assigned_pm ON public.dob_applications(assigned_pm_id);

-- =============================================================================
-- 5. SERVICES TABLE (Billable Work Items)
-- =============================================================================
CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  application_id UUID REFERENCES public.dob_applications(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status service_status DEFAULT 'not_started',
  estimated_hours DECIMAL(6, 2),
  actual_hours DECIMAL(6, 2) DEFAULT 0,
  hourly_rate DECIMAL(8, 2),
  fixed_price DECIMAL(10, 2),
  total_amount DECIMAL(10, 2),
  billing_type VARCHAR(50) DEFAULT 'hourly', -- 'hourly', 'fixed', 'percentage'
  billing_milestones JSONB DEFAULT '[]',
  due_date DATE,
  completed_date DATE,
  qb_invoice_id VARCHAR(100),
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_services_company ON public.services(company_id);
CREATE INDEX idx_services_application ON public.services(application_id);
CREATE INDEX idx_services_status ON public.services(status);

-- =============================================================================
-- 6. ACTIVITIES TABLE (Time Logs, Notes, Calls)
-- =============================================================================
CREATE TABLE public.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  service_id UUID REFERENCES public.services(id) ON DELETE CASCADE,
  application_id UUID REFERENCES public.dob_applications(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  activity_type activity_type NOT NULL,
  description TEXT,
  duration_minutes INTEGER DEFAULT 0,
  billable BOOLEAN DEFAULT true,
  activity_date DATE DEFAULT CURRENT_DATE,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  voice_note_url TEXT,
  attachments JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_activities_company ON public.activities(company_id);
CREATE INDEX idx_activities_service ON public.activities(service_id);
CREATE INDEX idx_activities_application ON public.activities(application_id);
CREATE INDEX idx_activities_user ON public.activities(user_id);
CREATE INDEX idx_activities_date ON public.activities(activity_date);

-- =============================================================================
-- SECURITY DEFINER HELPER FUNCTIONS (Prevent RLS recursion)
-- =============================================================================

-- Get user's company_id
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1
$$;

-- Check if user is member of company
CREATE OR REPLACE FUNCTION public.is_company_member(target_company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid() 
    AND company_id = target_company_id
    AND is_active = true
  )
$$;

-- Check if user has specific role in company
CREATE OR REPLACE FUNCTION public.has_role(target_company_id UUID, required_role user_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid()
    AND company_id = target_company_id
    AND role = required_role
    AND is_active = true
  )
$$;

-- Check if user is admin
CREATE OR REPLACE FUNCTION public.is_company_admin(target_company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(target_company_id, 'admin')
$$;

-- Check if user is admin or manager
CREATE OR REPLACE FUNCTION public.is_admin_or_manager(target_company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid()
    AND company_id = target_company_id
    AND role IN ('admin', 'manager')
    AND is_active = true
  )
$$;

-- =============================================================================
-- ROW LEVEL SECURITY POLICIES
-- =============================================================================

-- COMPANIES: Users can only see their own company
CREATE POLICY "Company isolation" ON public.companies
  FOR ALL USING (public.is_company_member(id));

-- PROFILES: Users can see profiles in their company
CREATE POLICY "Users can view company profiles" ON public.profiles
  FOR SELECT USING (public.is_company_member(company_id));

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Admins can insert profiles" ON public.profiles
  FOR INSERT WITH CHECK (public.is_company_admin(company_id));

-- PROPERTIES: Company isolation with CRUD for authorized roles
CREATE POLICY "Company isolation for properties" ON public.properties
  FOR SELECT USING (public.is_company_member(company_id));

CREATE POLICY "Admins and managers can modify properties" ON public.properties
  FOR ALL USING (public.is_admin_or_manager(company_id));

-- DOB APPLICATIONS: Company isolation with role-based access
CREATE POLICY "Company isolation for applications" ON public.dob_applications
  FOR SELECT USING (public.is_company_member(company_id));

CREATE POLICY "Admins and managers can modify applications" ON public.dob_applications
  FOR ALL USING (public.is_admin_or_manager(company_id));

-- SERVICES: Company isolation
CREATE POLICY "Company isolation for services" ON public.services
  FOR SELECT USING (public.is_company_member(company_id));

CREATE POLICY "Admins managers and accounting can modify services" ON public.services
  FOR ALL USING (
    public.is_admin_or_manager(company_id) OR 
    public.has_role(company_id, 'accounting')
  );

-- ACTIVITIES: Company isolation with user-based writes
CREATE POLICY "Company isolation for activities" ON public.activities
  FOR SELECT USING (public.is_company_member(company_id));

CREATE POLICY "Users can create activities in their company" ON public.activities
  FOR INSERT WITH CHECK (public.is_company_member(company_id));

CREATE POLICY "Users can update own activities" ON public.activities
  FOR UPDATE USING (
    user_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
    OR public.is_admin_or_manager(company_id)
  );

CREATE POLICY "Admins can delete activities" ON public.activities
  FOR DELETE USING (public.is_company_admin(company_id));

-- =============================================================================
-- AUTO-UPDATE TIMESTAMPS TRIGGER
-- =============================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_properties_updated_at
  BEFORE UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_applications_updated_at
  BEFORE UPDATE ON public.dob_applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_services_updated_at
  BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_activities_updated_at
  BEFORE UPDATE ON public.activities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();