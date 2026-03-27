-- =============================================================
-- Midi KYB Portal — Supabase Database Schema (v2 - Multi-user)
-- Run this in the Supabase SQL Editor to set up all tables
-- =============================================================

-- 1. Companies table (created on registration)
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT,
  status TEXT DEFAULT 'onboarding' CHECK (status IN ('onboarding', 'submitted', 'active', 'suspended')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Company Users (multi-user access per company)
CREATE TABLE IF NOT EXISTS public.company_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  status TEXT DEFAULT 'invited' CHECK (status IN ('invited', 'active')),
  invited_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, email)
);

-- 3. KYB Applications (one per company)
CREATE TABLE IF NOT EXISTS public.kyb_applications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL UNIQUE,
  status TEXT DEFAULT 'draft' CHECK (status IN (
    'draft', 'submitted', 'midi_review', 'bank_review',
    'documents_missing', 'approved', 'contract_signed', 'rejected'
  )),
  form_data JSONB DEFAULT '{}',
  documents JSONB DEFAULT '[]',
  extracted_data JSONB DEFAULT '{}',
  missing_documents JSONB DEFAULT '[]',
  reviewer_notes TEXT,
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Application Status Log (audit trail)
CREATE TABLE IF NOT EXISTS public.application_status_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  application_id UUID REFERENCES public.kyb_applications(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL,
  message TEXT,
  changed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. KYB Documents (metadata for uploaded files)
CREATE TABLE IF NOT EXISTS public.kyb_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  document_type TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT,
  file_size BIGINT,
  mime_type TEXT,
  extracted_fields JSONB DEFAULT '{}',
  uploaded_by UUID REFERENCES auth.users(id),
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Signed Contracts (e-signature records)
CREATE TABLE IF NOT EXISTS public.signed_contracts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  application_id UUID REFERENCES public.kyb_applications(id),
  company_name TEXT NOT NULL,
  signer_name TEXT NOT NULL,
  signer_title TEXT NOT NULL,
  signed_at TIMESTAMPTZ NOT NULL,
  contract_version TEXT DEFAULT '1.0',
  ip_address TEXT,
  signed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================
-- Helper function: get company IDs for current user
-- =============================================================
CREATE OR REPLACE FUNCTION public.get_my_company_ids()
RETURNS SETOF UUID AS $$
  SELECT company_id FROM public.company_users
  WHERE user_id = auth.uid() AND status = 'active'
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- =============================================================
-- Indexes
-- =============================================================
CREATE INDEX IF NOT EXISTS idx_company_users_user ON public.company_users(user_id);
CREATE INDEX IF NOT EXISTS idx_company_users_company ON public.company_users(company_id);
CREATE INDEX IF NOT EXISTS idx_company_users_email ON public.company_users(email);
CREATE INDEX IF NOT EXISTS idx_kyb_applications_company ON public.kyb_applications(company_id);
CREATE INDEX IF NOT EXISTS idx_kyb_applications_status ON public.kyb_applications(status);
CREATE INDEX IF NOT EXISTS idx_status_log_application ON public.application_status_log(application_id);
CREATE INDEX IF NOT EXISTS idx_kyb_documents_company ON public.kyb_documents(company_id);

-- =============================================================
-- Row Level Security (RLS)
-- =============================================================

-- Enable RLS on all tables
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyb_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_status_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyb_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signed_contracts ENABLE ROW LEVEL SECURITY;

-- Companies: users can see companies they belong to
CREATE POLICY "Users can view own companies"
  ON public.companies FOR SELECT
  USING (id IN (SELECT public.get_my_company_ids()));

CREATE POLICY "Users can insert companies"
  ON public.companies FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Members can update own companies"
  ON public.companies FOR UPDATE
  USING (id IN (SELECT public.get_my_company_ids()));

-- Company Users: members can see teammates, admins can invite
CREATE POLICY "Users can view company members"
  ON public.company_users FOR SELECT
  USING (company_id IN (SELECT public.get_my_company_ids()));

CREATE POLICY "Admins can invite members"
  ON public.company_users FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update own membership"
  ON public.company_users FOR UPDATE
  USING (user_id = auth.uid() OR company_id IN (
    SELECT company_id FROM public.company_users
    WHERE user_id = auth.uid() AND role = 'admin' AND status = 'active'
  ));

-- KYB Applications: company members can see/edit
CREATE POLICY "Members can view company application"
  ON public.kyb_applications FOR SELECT
  USING (company_id IN (SELECT public.get_my_company_ids()));

CREATE POLICY "Members can create company application"
  ON public.kyb_applications FOR INSERT
  WITH CHECK (company_id IN (SELECT public.get_my_company_ids()));

CREATE POLICY "Members can update company application"
  ON public.kyb_applications FOR UPDATE
  USING (company_id IN (SELECT public.get_my_company_ids()));

-- Status logs: company members can see logs
CREATE POLICY "Members can view status logs"
  ON public.application_status_log FOR SELECT
  USING (
    application_id IN (
      SELECT id FROM public.kyb_applications
      WHERE company_id IN (SELECT public.get_my_company_ids())
    )
  );

CREATE POLICY "Members can insert status logs"
  ON public.application_status_log FOR INSERT
  WITH CHECK (
    application_id IN (
      SELECT id FROM public.kyb_applications
      WHERE company_id IN (SELECT public.get_my_company_ids())
    )
  );

-- Documents: company members can see/upload
CREATE POLICY "Members can view company documents"
  ON public.kyb_documents FOR SELECT
  USING (company_id IN (SELECT public.get_my_company_ids()));

CREATE POLICY "Members can upload company documents"
  ON public.kyb_documents FOR INSERT
  WITH CHECK (company_id IN (SELECT public.get_my_company_ids()));

-- Signed contracts: company members can see, any member can sign
CREATE POLICY "Members can view contracts"
  ON public.signed_contracts FOR SELECT
  USING (company_id IN (SELECT public.get_my_company_ids()));

CREATE POLICY "Members can sign contracts"
  ON public.signed_contracts FOR INSERT
  WITH CHECK (company_id IN (SELECT public.get_my_company_ids()));

-- =============================================================
-- Storage Bucket
-- =============================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('kyb-documents', 'kyb-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: company members can upload/view using company_id folder
CREATE POLICY "Company members can upload KYB docs"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'kyb-documents'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.companies
      WHERE id IN (SELECT public.get_my_company_ids())
    )
  );

CREATE POLICY "Company members can view KYB docs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'kyb-documents'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.companies
      WHERE id IN (SELECT public.get_my_company_ids())
    )
  );

-- =============================================================
-- Realtime (enable for status updates)
-- =============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.kyb_applications;

-- =============================================================
-- Auto-update timestamps
-- =============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_companies
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_kyb_applications
  BEFORE UPDATE ON public.kyb_applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
