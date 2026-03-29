export interface CodeFile {
  path: string;
  content: string;
  language: string;
  lineCount: number;
}

export interface RepoMetadata {
  owner: string;
  repo: string;
  description: string | null;
  defaultBranch: string;
  language: string | null;
  stars: number;
  size: number;
}

export interface ExtractedFeature {
  name: string;
  type: 'algorithm' | 'data_structure' | 'integration' | 'ui_pattern' | 'optimization' | 'architecture' | 'api_design' | 'security_mechanism';
  description: string;
  technicalDetails: string;
  sourceFiles: string[];
  codeSnippets?: { file: string; snippet: string }[];
  noveltyStrength: 'strong' | 'moderate' | 'weak';
  isCoreInnovation: boolean;
}

export interface AnalysisResult {
  projectId: string;
  features: ExtractedFeature[];
  summary: string;
  fileCount: number;
  languageBreakdown: Record<string, number>;
}

export interface AnalysisProgress {
  step: 'fetching' | 'parsing' | 'analyzing' | 'synthesizing' | 'generating_patents' | 'assessing_ip' | 'complete' | 'error';
  progress: number;
  message: string;
  detail?: string;
}

export interface InnovationCluster {
  title: string;
  description: string;
  featureNames: string[];
  technicalField: string;
}

export interface IPOrchestrationProgress {
  phase: 'clustering' | 'patents' | 'copyrights' | 'trademarks' | 'complete';
  step: string;
  overallPercent: number;
  detail?: string;
}

export interface IPAnalysisResult {
  patentApplicationIds: string[];
  copyrightRegistrationIds: string[];
  trademarkApplicationIds: string[];
  clusterCount: number;
  errors: string[];
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  source_type: 'github_url' | 'zip_upload' | 'manual';
  source_url: string | null;
  source_metadata: Record<string, unknown> | null;
  analysis_status: 'pending' | 'analyzing' | 'completed' | 'failed';
  analysis_summary: string | null;
  analysis_completed_at: string | null;
  created_at: string;
  updated_at: string;
}
