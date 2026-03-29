-- IP Shield Database Schema
-- All tables use user-based RLS (simpler than org-based)

-- ============================================================
-- GROUP A: Projects (codebase analysis sessions)
-- ============================================================

CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  source_type TEXT NOT NULL CHECK (source_type IN ('github_url', 'zip_upload', 'manual')),
  source_url TEXT,
  source_metadata JSONB,
  analysis_status TEXT NOT NULL DEFAULT 'pending' CHECK (analysis_status IN ('pending', 'analyzing', 'completed', 'failed')),
  analysis_summary TEXT,
  analysis_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE project_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  language TEXT,
  line_count INTEGER,
  content_hash TEXT,
  analysis_summary TEXT,
  extracted_features JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE extracted_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('algorithm', 'data_structure', 'integration', 'ui_pattern', 'optimization', 'architecture', 'api_design', 'security_mechanism')),
  description TEXT NOT NULL,
  technical_details TEXT NOT NULL,
  source_files TEXT[],
  code_snippets JSONB,
  novelty_strength TEXT CHECK (novelty_strength IN ('strong', 'moderate', 'weak')),
  is_core_innovation BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- GROUP B: Patent tables
-- ============================================================

CREATE TABLE patent_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  title TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_review', 'ready_to_file', 'filed', 'pending', 'granted', 'rejected', 'abandoned')),
  abstract TEXT,
  specification TEXT,
  field_of_invention TEXT,
  background_art TEXT,
  summary_invention TEXT,
  detailed_description TEXT,
  prior_art_search_status TEXT NOT NULL DEFAULT 'not_started',
  prior_art_search_completed_at TIMESTAMPTZ,
  novelty_score NUMERIC,
  novelty_analysis_id UUID,
  differentiation_analysis TEXT,
  claims_generation_status TEXT NOT NULL DEFAULT 'not_started',
  drawings_generation_status TEXT NOT NULL DEFAULT 'not_started',
  specification_generation_status TEXT NOT NULL DEFAULT 'not_started',
  full_application_status TEXT NOT NULL DEFAULT 'not_started',
  metadata JSONB,
  inventors JSONB,
  entity_status TEXT,
  correspondence_address JSONB,
  attorney_info JSONB,
  cpc_classification JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE patent_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES patent_applications(id) ON DELETE CASCADE,
  claim_number INTEGER NOT NULL,
  claim_type TEXT NOT NULL DEFAULT 'independent' CHECK (claim_type IN ('independent', 'dependent')),
  claim_text TEXT NOT NULL,
  parent_claim_id UUID REFERENCES patent_claims(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'reviewed', 'finalized')),
  category TEXT NOT NULL DEFAULT 'method' CHECK (category IN ('method', 'system', 'apparatus', 'composition')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE patent_drawings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES patent_applications(id) ON DELETE CASCADE,
  figure_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  svg_content TEXT,
  image_url TEXT,
  drawing_type TEXT NOT NULL DEFAULT 'block_diagram' CHECK (drawing_type IN ('block_diagram', 'flowchart', 'wireframe', 'schematic', 'sequence_diagram')),
  callouts JSONB DEFAULT '[]',
  blocks JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE patent_prior_art_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES patent_applications(id) ON DELETE CASCADE,
  patent_number TEXT,
  title TEXT,
  abstract TEXT,
  relevance_score NUMERIC,
  similarity_score NUMERIC,
  source TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE patent_novelty_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES patent_applications(id) ON DELETE CASCADE,
  overall_score NUMERIC,
  approval_probability NUMERIC,
  strength_rating TEXT,
  analysis_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE patent_differentiation_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES patent_applications(id) ON DELETE CASCADE,
  prior_art_id UUID REFERENCES patent_prior_art_results(id),
  report_text TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- GROUP C: Copyright tables
-- ============================================================

CREATE TABLE copyright_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  title TEXT NOT NULL,
  registration_type TEXT NOT NULL,
  work_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  description TEXT,
  author_name TEXT,
  author_type TEXT DEFAULT 'individual',
  contains_ai_generated_content BOOLEAN DEFAULT false,
  ai_contribution_percentage NUMERIC DEFAULT 0,
  ai_tools_used TEXT[],
  human_authorship_statement TEXT,
  application_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- GROUP D: Trademark tables
-- ============================================================

CREATE TABLE trademark_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  mark_type TEXT NOT NULL DEFAULT 'word_mark',
  mark_text TEXT,
  mark_description TEXT,
  international_class INTEGER,
  goods_services_description TEXT,
  filing_basis TEXT NOT NULL DEFAULT 'intent_to_use',
  owner_name TEXT,
  owner_type TEXT DEFAULT 'individual',
  status TEXT NOT NULL DEFAULT 'draft',
  application_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_project_files_project_id ON project_files(project_id);
CREATE INDEX idx_extracted_features_project_id ON extracted_features(project_id);
CREATE INDEX idx_patent_applications_project_id ON patent_applications(project_id);
CREATE INDEX idx_patent_applications_user_id ON patent_applications(user_id);
CREATE INDEX idx_patent_claims_application_id ON patent_claims(application_id);
CREATE INDEX idx_patent_drawings_application_id ON patent_drawings(application_id);
CREATE INDEX idx_patent_prior_art_application_id ON patent_prior_art_results(application_id);
CREATE INDEX idx_patent_novelty_application_id ON patent_novelty_analyses(application_id);
CREATE INDEX idx_copyright_project_id ON copyright_registrations(project_id);
CREATE INDEX idx_trademark_project_id ON trademark_applications(project_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

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

-- Projects: user owns their projects
CREATE POLICY "Users manage own projects" ON projects
  FOR ALL USING (auth.uid() = user_id);

-- Project-scoped tables: access via project ownership
CREATE POLICY "Access via project ownership" ON project_files
  FOR ALL USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

CREATE POLICY "Access via project ownership" ON extracted_features
  FOR ALL USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

-- Patent applications: user owns directly
CREATE POLICY "Users manage own patents" ON patent_applications
  FOR ALL USING (auth.uid() = user_id);

-- Patent sub-tables: access via patent application ownership
CREATE POLICY "Access via patent ownership" ON patent_claims
  FOR ALL USING (application_id IN (SELECT id FROM patent_applications WHERE user_id = auth.uid()));

CREATE POLICY "Access via patent ownership" ON patent_drawings
  FOR ALL USING (application_id IN (SELECT id FROM patent_applications WHERE user_id = auth.uid()));

CREATE POLICY "Access via patent ownership" ON patent_prior_art_results
  FOR ALL USING (application_id IN (SELECT id FROM patent_applications WHERE user_id = auth.uid()));

CREATE POLICY "Access via patent ownership" ON patent_novelty_analyses
  FOR ALL USING (application_id IN (SELECT id FROM patent_applications WHERE user_id = auth.uid()));

CREATE POLICY "Access via patent ownership" ON patent_differentiation_reports
  FOR ALL USING (application_id IN (SELECT id FROM patent_applications WHERE user_id = auth.uid()));

-- Copyright and trademark: user owns directly
CREATE POLICY "Users manage own copyrights" ON copyright_registrations
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage own trademarks" ON trademark_applications
  FOR ALL USING (auth.uid() = user_id);
