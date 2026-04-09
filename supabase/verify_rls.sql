-- ============================================================
-- STEP 1: VERIFY RLS STATUS ON ALL TABLES
-- Run this first to see what's enabled/disabled
-- ============================================================

SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- ============================================================
-- STEP 2: CHECK EXISTING POLICIES
-- This shows what policies exist (if any)
-- ============================================================

SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ============================================================
-- STEP 3: FIX — RE-ENABLE RLS AND RE-CREATE POLICIES
-- Run this if Step 1 shows rls_enabled = false on any table,
-- or if Step 2 shows missing policies.
-- These are idempotent (safe to re-run).
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE extracted_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE patent_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE patent_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE patent_drawings ENABLE ROW LEVEL SECURITY;
ALTER TABLE patent_prior_art_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE patent_novelty_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE patent_differentiation_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE copyright_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE trademark_applications ENABLE ROW LEVEL SECURITY;

-- Force RLS even for table owners (prevents service_role bypass in the dashboard,
-- but Netlify functions using service_role key will still bypass as intended)
ALTER TABLE projects FORCE ROW LEVEL SECURITY;
ALTER TABLE project_files FORCE ROW LEVEL SECURITY;
ALTER TABLE extracted_features FORCE ROW LEVEL SECURITY;
ALTER TABLE patent_applications FORCE ROW LEVEL SECURITY;
ALTER TABLE patent_claims FORCE ROW LEVEL SECURITY;
ALTER TABLE patent_drawings FORCE ROW LEVEL SECURITY;
ALTER TABLE patent_prior_art_results FORCE ROW LEVEL SECURITY;
ALTER TABLE patent_novelty_analyses FORCE ROW LEVEL SECURITY;
ALTER TABLE patent_differentiation_reports FORCE ROW LEVEL SECURITY;
ALTER TABLE copyright_registrations FORCE ROW LEVEL SECURITY;
ALTER TABLE trademark_applications FORCE ROW LEVEL SECURITY;

-- Drop and recreate policies (idempotent approach)

-- Projects
DROP POLICY IF EXISTS "Users manage own projects" ON projects;
CREATE POLICY "Users manage own projects" ON projects
  FOR ALL USING (auth.uid() = user_id);

-- Project files
DROP POLICY IF EXISTS "Access via project ownership" ON project_files;
CREATE POLICY "Access via project ownership" ON project_files
  FOR ALL USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

-- Extracted features
DROP POLICY IF EXISTS "Access via project ownership" ON extracted_features;
CREATE POLICY "Access via project ownership" ON extracted_features
  FOR ALL USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

-- Patent applications
DROP POLICY IF EXISTS "Users manage own patents" ON patent_applications;
CREATE POLICY "Users manage own patents" ON patent_applications
  FOR ALL USING (auth.uid() = user_id);

-- Patent claims
DROP POLICY IF EXISTS "Access via patent ownership" ON patent_claims;
CREATE POLICY "Access via patent ownership" ON patent_claims
  FOR ALL USING (application_id IN (SELECT id FROM patent_applications WHERE user_id = auth.uid()));

-- Patent drawings
DROP POLICY IF EXISTS "Access via patent ownership" ON patent_drawings;
CREATE POLICY "Access via patent ownership" ON patent_drawings
  FOR ALL USING (application_id IN (SELECT id FROM patent_applications WHERE user_id = auth.uid()));

-- Patent prior art
DROP POLICY IF EXISTS "Access via patent ownership" ON patent_prior_art_results;
CREATE POLICY "Access via patent ownership" ON patent_prior_art_results
  FOR ALL USING (application_id IN (SELECT id FROM patent_applications WHERE user_id = auth.uid()));

-- Patent novelty analyses
DROP POLICY IF EXISTS "Access via patent ownership" ON patent_novelty_analyses;
CREATE POLICY "Access via patent ownership" ON patent_novelty_analyses
  FOR ALL USING (application_id IN (SELECT id FROM patent_applications WHERE user_id = auth.uid()));

-- Patent differentiation reports
DROP POLICY IF EXISTS "Access via patent ownership" ON patent_differentiation_reports;
CREATE POLICY "Access via patent ownership" ON patent_differentiation_reports
  FOR ALL USING (application_id IN (SELECT id FROM patent_applications WHERE user_id = auth.uid()));

-- Copyright registrations
DROP POLICY IF EXISTS "Users manage own copyrights" ON copyright_registrations;
CREATE POLICY "Users manage own copyrights" ON copyright_registrations
  FOR ALL USING (auth.uid() = user_id);

-- Trademark applications
DROP POLICY IF EXISTS "Users manage own trademarks" ON trademark_applications;
CREATE POLICY "Users manage own trademarks" ON trademark_applications
  FOR ALL USING (auth.uid() = user_id);

-- Payments table (from 002_add_payments.sql) — service role only for writes
DROP POLICY IF EXISTS "Users can read own payments" ON payments;
CREATE POLICY "Users can read own payments" ON payments
  FOR SELECT USING (user_id = auth.uid());

-- ============================================================
-- STEP 4: VERIFY USER ISOLATION
-- Run this to check if any projects exist that would be
-- visible across users (there should be 0 rows)
-- ============================================================

SELECT p1.id, p1.name, p1.user_id, u1.email
FROM projects p1
JOIN auth.users u1 ON p1.user_id = u1.id
WHERE p1.user_id IN (
  SELECT user_id FROM projects
  GROUP BY user_id
  HAVING COUNT(*) > 0
)
ORDER BY p1.user_id, p1.created_at DESC;
