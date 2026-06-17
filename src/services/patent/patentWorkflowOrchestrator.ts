import { supabase } from '../../lib/supabase';
import { searchPriorArt, getPriorArtResults } from './patentPriorArtSearchService';
import { performNoveltyAnalysis, type NoveltyAnalysis } from './patentNoveltyAnalysisService';
import { generateComprehensiveDifferentiation, getDifferentiationReports, type DifferentiationReport } from './patentDifferentiationService';
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

  // Pipeline logging — written to metadata.pipeline_log so it's queryable from the DB
  const pipelineLog: string[] = [];
  const ts = () => new Date().toISOString().slice(11, 23);
  const plog = (msg: string) => {
    const entry = `${ts()} ${msg}`;
    pipelineLog.push(entry);
    console.log('[Pipeline]', entry);
  };
  let baseMeta: Record<string, unknown> = {};
  const saveLog = async (stage: string) => {
    try {
      await (supabase as any)
        .from('patent_applications')
        .update({ metadata: { ...baseMeta, pipeline_log: pipelineLog, pipeline_stage: stage }, updated_at: new Date().toISOString() })
        .eq('id', config.applicationId);
    } catch (logErr) {
      console.error('[Pipeline] log save failed:', logErr);
    }
  };

  try {
    const { data: appData } = await (supabase as any)
      .from('patent_applications')
      .select('detailed_description, field_of_invention, metadata')
      .eq('id', config.applicationId)
      .single();

    const meta = (appData?.metadata || {}) as Record<string, unknown>;
    baseMeta = meta; // capture so saveLog() can merge without overwriting other metadata keys
    let inventionDesc = appData?.detailed_description || '';

    // If no README in invention description, try loading from project
    if (!inventionDesc.includes('README')) {
      try {
        const { data: projectData } = await (supabase as any)
          .from('projects')
          .select('source_metadata, analysis_summary')
          .eq('id', config.projectId)
          .maybeSingle();
        const readme = (projectData?.source_metadata as any)?.readmeContent;
        if (readme) {
          inventionDesc = `${inventionDesc}\n\n--- PROJECT README (authoritative description) ---\n${readme}\n--- END README ---`;
        }
        if (projectData?.analysis_summary && !inventionDesc.includes(projectData.analysis_summary)) {
          inventionDesc = `${inventionDesc}\n\nAnalysis Summary: ${projectData.analysis_summary}`;
        }
      } catch { /* continue without project data */ }
    }

    const hasInventionDescription = inventionDesc.trim().length > 0;

    plog(`start appId=${config.applicationId} skipPriorArt=${config.skipPriorArtSearch} useAIClaims=${config.useAIClaims}`);
    plog(`inventionDesc=${inventionDesc.length}chars hasDesc=${hasInventionDescription}`);

    if (!config.skipPriorArtSearch) {
      updateProgress(`Searching prior art for "${config.title.substring(0, 50)}"...`);
      let priorArtCount = 0;
      let topPriorArt = '';
      try {
        const paResults = await searchPriorArt(config.projectId, config.applicationId, {
          title: config.title,
          description: hasInventionDescription ? inventionDesc : config.description
        });
        priorArtCount = paResults?.length || 0;
        topPriorArt = (paResults || []).slice(0, 3).map((r: any) => r.patent_title || r.title || 'Untitled').join('|');
        plog(`prior_art_search ok count=${priorArtCount}`);
      } catch (priorArtError) {
        plog(`prior_art_search ERROR: ${priorArtError instanceof Error ? priorArtError.message : String(priorArtError)}`);
      }
      updateProgress('Prior art search completed', 'completed', { priorArtCount, topPriorArt });
    }

    updateProgress('Extracting technical features from codebase...');

    let features;
    try {
      if (hasInventionDescription) {
        const inventionInput: InventionInput = {
          title: config.title,
          description: inventionDesc,
          technicalField: (appData?.field_of_invention as string) || undefined,
          problemSolved: (meta.problem_solved as string) || undefined,
          keyFeatures: (meta.key_features as string[]) || undefined
        };
        features = await extractFeaturesFromInvention(inventionInput, config.projectId);
      } else {
        features = await extractCodebaseFeatures(config.projectId);
      }
      plog(`feature_extraction ok count=${features.features.length}`);
    } catch (featErr) {
      plog(`feature_extraction ERROR: ${featErr instanceof Error ? featErr.message : String(featErr)}`);
      await saveLog('feature_extraction_failed');
      throw featErr;
    }
    const topFeatures = features.features.slice(0, 5).map((f: any) => f.name || f.feature_name || 'Feature').join('|');
    updateProgress('Feature extraction completed', 'completed', { featureCount: features.features.length, topFeatures });

    updateProgress('Analyzing patentability and novelty...');
    let noveltyAnalysis: NoveltyAnalysis;
    try {
      noveltyAnalysis = await performNoveltyAnalysis(
        config.projectId,
        config.applicationId,
        config.userId
      );
      plog(`novelty_analysis ok score=${noveltyAnalysis.overallScore}`);
    } catch (noveltyError) {
      plog(`novelty_analysis ERROR: ${noveltyError instanceof Error ? noveltyError.message : String(noveltyError)}`);
      await saveLog('novelty_analysis_failed');
      noveltyAnalysis = {
        analysisId: '',
        overallScore: 0,
        approvalProbability: 0,
        strengths: [],
        weaknesses: [],
        recommendations: [],
        featureNoveltyScores: {},
        patentabilityAssessment: ''
      };
    }
    updateProgress('Novelty analysis completed', 'completed', {
      score: noveltyAnalysis.overallScore,
      confidence: noveltyAnalysis.approvalProbability
    });

    if (!config.skipPriorArtSearch) {
      updateProgress('Comparing invention against prior art...');
      try {
        await generateComprehensiveDifferentiation(
          config.projectId,
          config.applicationId,
          config.userId
        );
        plog('differentiation ok');
      } catch (diffError) {
        plog(`differentiation ERROR: ${diffError instanceof Error ? diffError.message : String(diffError)}`);
      }
      updateProgress('Differentiation analysis completed', 'completed');
    }

    updateProgress('Generating specification (Field, Background, Summary, Description, Abstract)...');

    let priorArt: any[] = [];
    try {
      priorArt = await getPriorArtResults(config.applicationId);
      plog(`getPriorArtResults ok count=${priorArt.length}`);
    } catch (priorArtLoadError) {
      plog(`getPriorArtResults ERROR: ${priorArtLoadError instanceof Error ? priorArtLoadError.message : String(priorArtLoadError)}`);
    }

    let differentiationReports: DifferentiationReport[] = [];
    try {
      differentiationReports = await getDifferentiationReports(config.applicationId);
      plog(`getDifferentiationReports ok count=${differentiationReports.length}`);
    } catch (drError) {
      plog(`getDifferentiationReports ERROR: ${drError instanceof Error ? drError.message : String(drError)}`);
    }

    let existingDrawings: any[] | null = null;
    try {
      const { data: drawingsData } = await (supabase as any)
        .from('patent_drawings')
        .select('figure_number, title, svg_content, blocks')
        .eq('application_id', config.applicationId)
        .order('figure_number', { ascending: true });
      existingDrawings = drawingsData;
      plog(`existingDrawings ok count=${drawingsData?.length ?? 0}`);
    } catch (drawingsLoadError) {
      plog(`existingDrawings ERROR: ${drawingsLoadError instanceof Error ? drawingsLoadError.message : String(drawingsLoadError)}`);
    }

    const inventionContext: InventionContext | undefined = hasInventionDescription ? {
      description: inventionDesc,
      technicalField: (appData?.field_of_invention as string) || undefined,
      problemSolved: (meta.problem_solved as string) || undefined
    } : undefined;

    plog('starting spec generation');
    let specification: SpecificationSections | null = null;
    try {
      specification = await generateIntelligentSpecification(
        config.title,
        features.features,
        priorArt,
        differentiationReports,
        inventionContext,
        config.projectId,
        existingDrawings || undefined
      );
      plog(`spec_generation ok field=${specification.field.length}chars bg=${specification.background.length}chars`);

      const concatenatedSpecification = formatSpecificationSections(specification);

      const { error: specSaveError } = await (supabase as any)
        .from('patent_applications')
        .update({
          field_of_invention: specification.field || null,
          background_art: specification.background || null,
          summary_invention: specification.summary || null,
          detailed_description: specification.detailedDescription || null,
          abstract: specification.abstract || null,
          specification: concatenatedSpecification || null,
          specification_generation_status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', config.applicationId);

      if (specSaveError) {
        plog(`spec_save ERROR: ${specSaveError.message}`);
        await saveLog('spec_save_failed');
        await (supabase as any)
          .from('patent_applications')
          .update({ specification_generation_status: 'failed', updated_at: new Date().toISOString() })
          .eq('id', config.applicationId);
      } else {
        plog('spec_save ok');
        updateProgress('Specification generation completed', 'completed', { sections: 5 });
      }
    } catch (specError) {
      plog(`spec_generation ERROR: ${specError instanceof Error ? specError.message : String(specError)}`);
      await saveLog('spec_generation_failed');
      await (supabase as any)
        .from('patent_applications')
        .update({ specification_generation_status: 'failed', updated_at: new Date().toISOString() })
        .eq('id', config.applicationId);
    }

    if (config.useAIClaims) {
      try {
        updateProgress('Generating independent and dependent claims...');
        plog('starting claims generation');
        const claims = await generateAIEnhancedClaims(
          config.applicationId,
          features.features,
          noveltyAnalysis,
          config.projectId,
          config.title,
          inventionDesc
        );
        plog(`claims_generation ok count=${claims.length}`);
        const firstIndependent = claims.find((c: any) => c.claim_type === 'independent');
        const firstClaimPreview = firstIndependent ? firstIndependent.claim_text.substring(0, 200) : '';
        updateProgress('Claims generation completed', 'completed', { claimsCount: claims.length, firstClaimPreview });

        await (supabase as any)
          .from('patent_applications')
          .update({ claims_generation_status: 'completed', updated_at: new Date().toISOString() })
          .eq('id', config.applicationId);
      } catch (claimsError) {
        plog(`claims_generation ERROR: ${claimsError instanceof Error ? claimsError.message : String(claimsError)}`);
        await saveLog('claims_generation_failed');
        await (supabase as any)
          .from('patent_applications')
          .update({ claims_generation_status: 'failed', updated_at: new Date().toISOString() })
          .eq('id', config.applicationId);
      }
    }

    try {
      updateProgress('Generating patent drawings from features...');
      plog('starting drawings generation');
      const drawings = await generateDrawingsForApplication(config.applicationId, config.projectId);
      plog(`drawings_generation ok count=${drawings.length}`);
      updateProgress('Drawings generation completed', 'completed', { drawingsCount: drawings.length });

      await (supabase as any)
        .from('patent_applications')
        .update({
          drawings_generation_status: 'completed',
          full_application_status: 'completed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', config.applicationId);
    } catch (drawingsError) {
      plog(`drawings_generation ERROR: ${drawingsError instanceof Error ? drawingsError.message : String(drawingsError)}`);
      await saveLog('drawings_generation_failed');
      await (supabase as any)
        .from('patent_applications')
        .update({ drawings_generation_status: 'failed', updated_at: new Date().toISOString() })
        .eq('id', config.applicationId);
    }

    plog('pipeline complete');
    await saveLog('completed');

    return {
      success: true,
      applicationId: config.applicationId,
      noveltyAnalysis,
      priorArtCount: priorArt.length,
      specification: specification ?? undefined,
      claimsCount: config.useAIClaims ? (await getClaimsCount(config.applicationId)) : 0
    };

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    plog(`OUTER_CATCH ERROR: ${errMsg}`);
    await saveLog(`outer_catch: ${errMsg.substring(0, 120)}`);
    console.error('Patent generation error:', error);
    updateProgress('Generation failed', 'completed');
    return {
      success: false,
      applicationId: config.applicationId,
      error: errMsg
    };
  }
}

async function getClaimsCount(applicationId: string): Promise<number> {
  const { count } = await (supabase as any)
    .from('patent_claims')
    .select('*', { count: 'exact', head: true })
    .eq('application_id', applicationId);

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
    .eq('application_id', applicationId);

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
    .eq('application_id', applicationId);

  if (!claimsCount || claimsCount === 0) {
    missingItems.push('Patent Claims');
  } else {
    completedSections++;
  }

  const { count: drawingsCount } = await (supabase as any)
    .from('patent_drawings')
    .select('*', { count: 'exact', head: true })
    .eq('application_id', applicationId);

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
