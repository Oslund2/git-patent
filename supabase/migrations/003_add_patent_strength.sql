-- Add patent strength score to projects for quick comparison across repos
ALTER TABLE projects
  ADD COLUMN patent_strength_score NUMERIC,
  ADD COLUMN patent_strength_rating TEXT CHECK (patent_strength_rating IN ('strong', 'moderate', 'weak'));

CREATE INDEX idx_projects_patent_strength ON projects(patent_strength_score DESC NULLS LAST);
