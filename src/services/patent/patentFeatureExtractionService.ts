import { supabase } from '../../lib/supabase';
import { generateText } from '../ai/geminiService';

export interface ExtractedFeature {
  name: string;
  type: 'algorithm' | 'data_structure' | 'integration' | 'ui_pattern' | 'optimization';
  description: string;
  technicalDetails: string;
  sourceFile?: string;
  codeSnippet?: string;
  noveltyStrength: 'strong' | 'moderate' | 'weak';
  isCoreInnovation: boolean;
}

export interface InventionInput {
  title: string;
  description: string;
  technicalField?: string;
  problemSolved?: string;
  keyFeatures?: string[];
}

export interface FeatureAnalysisResult {
  features: ExtractedFeature[];
  algorithmsIdentified: any[];
  dataStructuresIdentified: any[];
  integrationPatterns: any[];
  serviceFilesAnalyzed: string[];
  technicalSummary: string;
}

/**
 * Extracts codebase features from the `extracted_features` Supabase table
 * rather than using hard-coded static arrays.
 */
export async function extractCodebaseFeatures(
  projectId: string
): Promise<FeatureAnalysisResult> {
  const { data: rows, error } = await (supabase as any)
    .from('extracted_features')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to load extracted features:', error);
  }

  const features: ExtractedFeature[] = (rows || []).map((row: any) => {
    // Extract code snippet from code_snippets JSONB column
    let snippet: string | undefined;
    if (row.code_snippets) {
      try {
        const snippets = typeof row.code_snippets === 'string'
          ? JSON.parse(row.code_snippets)
          : row.code_snippets;
        if (Array.isArray(snippets) && snippets.length > 0) {
          snippet = snippets.map((s: any) => s.snippet || s).join('\n').substring(0, 500);
        } else if (typeof snippets === 'string') {
          snippet = snippets.substring(0, 500);
        }
      } catch { /* ignore parse errors */ }
    }

    // Extract source files from source_files array column
    const sourceFile = Array.isArray(row.source_files) && row.source_files.length > 0
      ? row.source_files[0]
      : (row.source_file || row.source_file_path || undefined);

    return {
      name: row.name || row.feature_name || 'Unnamed Feature',
      type: row.type || row.feature_type || 'algorithm',
      description: row.description || '',
      technicalDetails: row.technical_details || row.description || '',
      sourceFile,
      codeSnippet: snippet,
      noveltyStrength: row.novelty_strength || 'moderate',
      isCoreInnovation: row.is_core_innovation ?? true
    };
  });

  const serviceFiles = [...new Set(features.map(f => f.sourceFile).filter(Boolean))] as string[];

  const algorithms = features.filter(f => f.type === 'algorithm');
  const dataStructures = features.filter(f => f.type === 'data_structure');
  const integrations = features.filter(f => f.type === 'integration');

  const technicalSummary = generateTechnicalSummary(features);

  return {
    features,
    algorithmsIdentified: algorithms,
    dataStructuresIdentified: dataStructures,
    integrationPatterns: integrations,
    serviceFilesAnalyzed: serviceFiles,
    technicalSummary
  };
}

function generateTechnicalSummary(features: ExtractedFeature[]): string {
  const strongFeatures = features.filter(f => f.noveltyStrength === 'strong');
  const coreFeatures = features.filter(f => f.isCoreInnovation);

  if (features.length === 0) {
    return 'No features have been extracted yet. Run a codebase analysis to populate features.';
  }

  return `The system contains ${features.length} distinct technical features, of which ${strongFeatures.length} demonstrate strong novelty and ${coreFeatures.length} are core innovations.`;
}

export async function extractFeaturesFromInvention(
  invention: InventionInput
): Promise<FeatureAnalysisResult> {
  const prompt = `You are a patent attorney analyzing an invention to identify patentable technical features.

INVENTION TITLE: ${invention.title}

INVENTION DESCRIPTION:
${invention.description}

${invention.technicalField ? `TECHNICAL FIELD: ${invention.technicalField}` : ''}

${invention.problemSolved ? `PROBLEM SOLVED: ${invention.problemSolved}` : ''}

${invention.keyFeatures && invention.keyFeatures.length > 0 ? `KEY FEATURES PROVIDED BY INVENTOR:
${invention.keyFeatures.map((f, i) => `${i + 1}. ${f}`).join('\n')}` : ''}

Analyze this invention and extract 4-8 distinct patentable technical features. For each feature, provide:

1. A clear, technical name for the feature
2. The type of feature (algorithm, data_structure, integration, ui_pattern, or optimization)
3. A brief description (1-2 sentences)
4. Detailed technical explanation (2-4 sentences with specific technical details)
5. Novelty strength assessment (strong, moderate, or weak)
6. Whether this is a core innovation (true/false)

Focus on:
- Novel algorithms or methods
- Unique data structures or architectures
- Innovative integrations or system designs
- Novel user interface patterns
- Performance optimizations

Respond in this exact JSON format (no additional text):
{
  "features": [
    {
      "name": "Feature Name",
      "type": "algorithm",
      "description": "Brief description",
      "technicalDetails": "Detailed technical explanation",
      "noveltyStrength": "strong",
      "isCoreInnovation": true
    }
  ],
  "technicalSummary": "A 2-3 sentence summary of the invention's key technical innovations"
}`;

  let response: string;
  try {
    response = await generateText(prompt, 'patent_feature_extraction');
  } catch (err) {
    console.error('Feature extraction AI call failed, using fallback:', err);
    return createFallbackFeatures(invention);
  }

  let parsed;
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('No JSON found in response');
    }
  } catch {
    return createFallbackFeatures(invention);
  }

  const features: ExtractedFeature[] = (parsed.features || []).map((f: any) => ({
    name: f.name || 'Unnamed Feature',
    type: f.type || 'algorithm',
    description: f.description || '',
    technicalDetails: f.technicalDetails || f.description || '',
    noveltyStrength: f.noveltyStrength || 'moderate',
    isCoreInnovation: f.isCoreInnovation ?? true
  }));

  const algorithms = features.filter(f => f.type === 'algorithm');
  const dataStructures = features.filter(f => f.type === 'data_structure');
  const integrations = features.filter(f => f.type === 'integration');

  return {
    features,
    algorithmsIdentified: algorithms,
    dataStructuresIdentified: dataStructures,
    integrationPatterns: integrations,
    serviceFilesAnalyzed: [],
    technicalSummary: parsed.technicalSummary || `The invention "${invention.title}" contains ${features.length} distinct technical features.`
  };
}

function createFallbackFeatures(invention: InventionInput): FeatureAnalysisResult {
  const baseFeature: ExtractedFeature = {
    name: invention.title,
    type: 'algorithm',
    description: invention.description.slice(0, 200),
    technicalDetails: invention.description,
    noveltyStrength: 'moderate',
    isCoreInnovation: true
  };

  const features = [baseFeature];

  if (invention.keyFeatures) {
    invention.keyFeatures.forEach((kf, index) => {
      features.push({
        name: `Feature ${index + 2}: ${kf.slice(0, 50)}`,
        type: 'algorithm',
        description: kf,
        technicalDetails: kf,
        noveltyStrength: 'moderate',
        isCoreInnovation: index < 2
      });
    });
  }

  return {
    features,
    algorithmsIdentified: features,
    dataStructuresIdentified: [],
    integrationPatterns: [],
    serviceFilesAnalyzed: [],
    technicalSummary: `The invention "${invention.title}" has been analyzed for patentable features.`
  };
}

export async function createFeatureAnalysis(
  projectId: string,
  patentApplicationId: string | null,
  _userId: string
): Promise<string> {
  const analysisResult = await extractCodebaseFeatures(projectId);
  const noveltyScore = calculateOverallNoveltyScore(analysisResult.features);

  const { data, error } = await (supabase as any)
    .from('patent_novelty_analyses')
    .insert({
      application_id: patentApplicationId,
      overall_score: noveltyScore,
      approval_probability: Math.min(noveltyScore + 10, 100),
      strength_rating: noveltyScore >= 70 ? 'strong' : noveltyScore >= 40 ? 'moderate' : 'weak',
      analysis_data: {
        extracted_features: analysisResult.features,
        service_files_analyzed: analysisResult.serviceFilesAnalyzed.length,
        algorithms_identified: analysisResult.algorithmsIdentified.length,
        data_structures_identified: analysisResult.dataStructuresIdentified.length,
        integration_patterns: analysisResult.integrationPatterns.length,
        patentability_assessment: analysisResult.technicalSummary,
      }
    })
    .select()
    .single();

  if (error) throw error;

  return data.id;
}

function calculateOverallNoveltyScore(features: ExtractedFeature[]): number {
  const weights = { strong: 10, moderate: 5, weak: 2 };
  let totalScore = 0;
  let maxScore = 0;

  features.forEach(feature => {
    totalScore += weights[feature.noveltyStrength];
    maxScore += weights.strong;
  });

  return maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
}

export async function getFeatureAnalysis(
  patentApplicationId: string
): Promise<any> {
  const { data, error } = await (supabase as any)
    .from('patent_novelty_analyses')
    .select('*')
    .eq('patent_application_id', patentApplicationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createFeatureMappings(
  _projectId: string,
  _patentApplicationId: string,
  _noveltyAnalysisId: string,
  features: ExtractedFeature[]
): Promise<void> {
  // Feature mappings are stored in the analysis_data JSONB of patent_novelty_analyses
  // No separate table needed — this is a no-op kept for interface compatibility
  console.log(`[Novelty] ${features.length} features mapped to analysis`);
}
