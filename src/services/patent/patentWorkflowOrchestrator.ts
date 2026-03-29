import { supabase } from '../../lib/supabase';
import { searchPriorArt, getPriorArtResults } from './patentPriorArtSearchService';
import { performNoveltyAnalysis, type NoveltyAnalysis } from './patentNoveltyAnalysisService';
import { generateComprehensiveDifferentiation, getDifferentiationReports } from './patentDifferentiationService';
import { generateIntelligentSpecification, type SpecificationSections, type InventionContext } from './patentSpecificationGenerationService';
import { generateAIEnhancedClaims } from './patentClaimsService';
import { extractCodebaseFeatures, extractFeaturesFromInvention, type InventionInput } from './patentFeatureExtractionService';
import { generateDrawingsForApplication } from './patentDrawingsService';

function formatSpecificationSections(spec: SpecificationSections): string {
  const sections: string[] = [];

  if (spec.field) {
    sections.push('FIELD OF THE INVENTION\n\n' + spec.field);
  }

  if (spec.background) {
    sections.push('BACKGROUND OF THE INVENTION\n\n' + spec.background);
  }

  if (spec.briefDescriptionOfDrawings) {
    sections.push(spec.briefDescriptionOfDrawings);
  }

  if (spec.summary) {
    sections.push('SUMMARY OF THE INVENTION\n\n' + spec.summary);
  }

  if (spec.detailedDescription) {
    sections.push('DETAILED DESCRIPTION OF THE INVENTION\n\n' + spec.detailedDescription);
  }

  return sections.join('\n\n');
}

export interface PatentGenerationConfig {
  applicationId: string;
  projectId: string;
  userId: string;
  title: string;
  description: string;
  skipPriorArtSearch?: boolean;
  useAIClaims?: boolean;
}

export interface PatentGenerationProgress {
  step: number;
  totalSteps: number;
  currentStep: string;
  status: 'in_progress' | 'completed' | 'error';
  data?: any;
}

export interface PatentGenerationResult {
  success: boolean;
  applicationId: string;
  noveltyAnalysis?: NoveltyAnalysis;
  priorArtCount?: number;
  specification?: SpecificationSections;
  claimsCount?: number;
  error?: string;
}

export async function generateCompletePatentApplication(
  config: PatentGenerationConfig,
  onProgress?: (progress: PatentGenerationProgress) => void
): Promise<PatentGenerationResult> {
  // Calculate total steps based on configuration
  let totalSteps = config.skipPriorArtSearch ? 3 : 5; // Base steps (feature extraction, novelty analysis, spec generation + optional prior art and differentiation)
  if (config.useAIClaims) totalSteps++; // Add claims generation if enabled
  totalSteps++; // Always add drawings generation
  let currentStep = 0;

  const updateProgress = (stepName: string, status: 'in_progress' | 'completed' = 'in_progress', data?: any) => {
    if (status === 'completed') currentStep++;
    onProgress?.({
      step: currentStep,
      totalSteps,
      currentStep: stepName,
      status,
      data
    });
  };

  try {
    const { data: appData } = await (supabase as any)
      .from('patent_applications')
      .select('detailed_description, field_of_invention, metadata')
      .eq('id', config.applicationId)
      .single();

    const meta = (appData?.metadata || {}) as Record<string, unknown>;
    const inventionDesc = appData?.detailed_description || '';
    const hasInventionDescription = inventionDesc.trim().length > 0;

    if (!config.skipPriorArtSearch) {
      updateProgress('Searching for prior art patents...');
      await searchPriorArt(config.projectId, config.applicationId, {
        title: config.title,
        description: hasInventionDescription ? inventionDesc : config.description
      });
      updateProgress('Prior art search completed', 'completed');
    }

    updateProgress('Analyzing invention features...');

    let features;
    if (hasInventionDescription) {
      const inventionInput: InventionInput = {
        title: config.title,
        description: inventionDesc,
        technicalField: (appData?.field_of_invention as string) || undefined,
        problemSolved: (meta.problem_solved as string) || undefined,
        keyFeatures: (meta.key_features as string[]) || undefined
      };
      features = await extractFeaturesFromInvention(inventionInput);
    } else {
      // Use features extracted from the codebase analysis
      features = await extractCodebaseFeatures(config.projectId);
    }
    updateProgress('Feature extraction completed', 'completed', { featureCount: features.features.length });

    updateProgress('Performing novelty analysis...');
    const noveltyAnalysis = await performNoveltyAnalysis(
      config.projectId,
      config.applicationId,
      config.userId
    );
    updateProgress('Novelty analysis completed', 'completed', {
      score: noveltyAnalysis.overallScore,
      confidence: noveltyAnalysis.approvalProbability
    });

    if (!config.skipPriorArtSearch) {
      updateProgress('Generating differentiation reports...');
      await generateComprehensiveDifferentiation(
        config.projectId,
        config.applicationId,
        config.userId
      );
      updateProgress('Differentiation analysis completed', 'completed');
    }

    updateProgress('Generating intelligent specification...');
    const priorArt = await getPriorArtResults(config.applicationId);
    const differentiationReports = await getDifferentiationReports(config.applicationId);

    const { data: existingDrawings } = await (supabase as any)
      .from('patent_drawings')
      .select('figure_number, figure_title, svg_content, blocks')
      .eq('application_id', config.applicationId)
      .order('figure_number', { ascending: true });

    const inventionContext: InventionContext | undefined = hasInventionDescription ? {
      description: appData.invention_description,
      technicalField: appData.technical_field || undefined,
      problemSolved: appData.problem_solved || undefined
    } : undefined;

    const specification = await generateIntelligentSpecification(
      config.title,
      features.features,
      priorArt,
      differentiationReports,
      inventionContext,
      config.projectId,
      existingDrawings || undefined
    );

    // Create concatenated specification including Brief Description of Drawings
    const concatenatedSpecification = formatSpecificationSections(specification);

    await (supabase as any)
      .from('patent_applications')
      .update({
        field_of_invention: specification.field,
        background_art: specification.background,
        summary_invention: specification.summary,
        detailed_description: specification.detailedDescription,
        abstract: specification.abstract,
        specification: concatenatedSpecification,
        auto_generated: true,
        last_regenerated_at: new Date().toISOString()
      })
      .eq('id', config.applicationId);

    updateProgress('Specification generation completed', 'completed');

    if (config.useAIClaims) {
      updateProgress('Generating AI-enhanced claims...');
      const claims = await generateAIEnhancedClaims(
        config.applicationId,
        features.features,
        noveltyAnalysis
      );
      updateProgress('Claims generation completed', 'completed', { claimsCount: claims.length });
    }

    updateProgress('Generating patent drawings...');
    const drawings = await generateDrawingsForApplication(config.applicationId, config.projectId);
    updateProgress('Drawings generation completed', 'completed', { drawingsCount: drawings.length });

    return {
      success: true,
      applicationId: config.applicationId,
      noveltyAnalysis,
      priorArtCount: priorArt.length,
      specification,
      claimsCount: config.useAIClaims ? (await getClaimsCount(config.applicationId)) : 0
    };

  } catch (error) {
    console.error('Patent generation error:', error);
    updateProgress('Generation failed', 'completed');
    return {
      success: false,
      applicationId: config.applicationId,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

async function getClaimsCount(applicationId: string): Promise<number> {
  const { count } = await (supabase as any)
    .from('patent_claims')
    .select('*', { count: 'exact', head: true })
    .eq('patent_application_id', applicationId);

  return count || 0;
}

export async function regenerateSection(
  applicationId: string,
  sectionName: string,
  _userFeedback: string
): Promise<string> {
  const { data: app } = await (supabase as any)
    .from('patent_applications')
    .select('*')
    .eq('id', applicationId)
    .single();

  if (!app) {
    throw new Error('Application not found');
  }

  const currentContent = app[sectionName as keyof typeof app] as string || '';

  const { data: _features } = await (supabase as any)
    .from('patent_feature_mappings')
    .select('*')
    .eq('patent_application_id', applicationId);

  return currentContent;
}

export async function getPatentStrength(applicationId: string): Promise<{
  overallScore: number;
  approvalProbability: number;
  readinessPercentage: number;
  missingItems: string[];
}> {
  const { data: app } = await (supabase as any)
    .from('patent_applications')
    .select('*')
    .eq('id', applicationId)
    .single();

  if (!app) {
    throw new Error('Application not found');
  }

  const missingItems: string[] = [];
  let completedSections = 0;
  const totalSections = 7;

  if (!app.field_of_invention) missingItems.push('Field of Invention');
  else completedSections++;

  if (!app.background_art) missingItems.push('Background');
  else completedSections++;

  if (!app.summary_invention) missingItems.push('Summary');
  else completedSections++;

  if (!app.detailed_description) missingItems.push('Detailed Description');
  else completedSections++;

  if (!app.abstract) missingItems.push('Abstract');
  else completedSections++;

  const { count: claimsCount } = await (supabase as any)
    .from('patent_claims')
    .select('*', { count: 'exact', head: true })
    .eq('patent_application_id', applicationId);

  if (!claimsCount || claimsCount === 0) {
    missingItems.push('Patent Claims');
  } else {
    completedSections++;
  }

  const { count: drawingsCount } = await (supabase as any)
    .from('patent_drawings')
    .select('*', { count: 'exact', head: true })
    .eq('patent_application_id', applicationId);

  if (!drawingsCount || drawingsCount === 0) {
    missingItems.push('Patent Drawings');
  } else {
    completedSections++;
  }

  const readinessPercentage = Math.round((completedSections / totalSections) * 100);

  return {
    overallScore: app.approval_score || 0,
    approvalProbability: app.approval_confidence || 0,
    readinessPercentage,
    missingItems
  };
}
