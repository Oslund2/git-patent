/**
 * IP Auto-Orchestrator Service
 *
 * The brain of the one-click flow. After codebase analysis completes,
 * this service auto-generates ALL IP applications: patents, copyrights,
 * and trademarks in a single orchestrated pipeline.
 */

import { supabase } from '../../lib/supabase';
import { generateText } from '../ai/geminiService';
import { extractCodebaseFeatures } from '../patent/patentFeatureExtractionService';
import type { ExtractedFeature } from '../patent/patentFeatureExtractionService';
import { createPatentApplication } from '../patent/patentApplicationService';
import { generateCompletePatentApplication } from '../patent/patentWorkflowOrchestrator';
import type { InnovationCluster, IPOrchestrationProgress, IPAnalysisResult } from '../../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function reportProgress(
  onProgress: ((p: IPOrchestrationProgress) => void) | undefined,
  phase: IPOrchestrationProgress['phase'],
  step: string,
  overallPercent: number,
  detail?: string
) {
  onProgress?.({ phase, step, overallPercent, detail });
}

function parseJsonFromResponse<T>(response: string): T | null {
  try {
    // Try to extract a JSON object or array from the response
    const arrayMatch = response.match(/\[[\s\S]*\]/);
    if (arrayMatch) return JSON.parse(arrayMatch[0]) as T;
    const objMatch = response.match(/\{[\s\S]*\}/);
    if (objMatch) return JSON.parse(objMatch[0]) as T;
    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Step 1 — Cluster features into patentable innovation groups
// ---------------------------------------------------------------------------

async function clusterFeatures(
  features: ExtractedFeature[]
): Promise<InnovationCluster[]> {
  // If 3 or fewer features, bundle them into one cluster (skip AI call)
  if (features.length <= 3) {
    return [
      {
        title: features[0]?.name ?? 'Core Innovation',
        description: features.map((f) => f.description).join('. '),
        featureNames: features.map((f) => f.name),
        technicalField: 'Computer Science / Software Engineering',
      },
    ];
  }

  const featureList = features
    .map((f, i) => `${i + 1}. ${f.name} (${f.type}) — ${f.description}`)
    .join('\n');

  const prompt = `You are an IP strategist. Given the following extracted software features, group them into 1-3 patentable innovation clusters. Each cluster should combine closely related features that together form a single patentable invention.

FEATURES:
${featureList}

Respond ONLY with a JSON array (no extra text):
[
  {
    "title": "Patent-worthy title for the cluster",
    "description": "2-3 sentence invention description combining the grouped features",
    "featureNames": ["Feature Name 1", "Feature Name 2"],
    "technicalField": "e.g. Distributed Systems, Machine Learning, Data Processing"
  }
]`;

  const response = await generateText(prompt, 'feature_synthesis');
  const clusters = parseJsonFromResponse<InnovationCluster[]>(response);

  if (clusters && Array.isArray(clusters) && clusters.length > 0) {
    return clusters;
  }

  // Fallback — single cluster with all features
  return [
    {
      title: features[0]?.name ?? 'Core Innovation',
      description: features.map((f) => f.description).join('. '),
      featureNames: features.map((f) => f.name),
      technicalField: 'Computer Science / Software Engineering',
    },
  ];
}

// ---------------------------------------------------------------------------
// Step 3 — Assess copyrights
// ---------------------------------------------------------------------------

interface CopyrightCandidate {
  title: string;
  description: string;
  registrationType: string;
  workType: string;
}

async function assessCopyrights(
  projectId: string,
  userId: string,
  projectName: string,
  features: ExtractedFeature[]
): Promise<string[]> {
  const featureSummary = features
    .slice(0, 10)
    .map((f) => `- ${f.name}: ${f.description}`)
    .join('\n');

  const prompt = `You are an IP attorney. Identify copyrightable works from this software project.

PROJECT: ${projectName}
KEY FEATURES:
${featureSummary}

Consider:
- The overall source code as a literary work
- Distinct modules or libraries that stand alone
- Any unique data structures or configuration schemas

Respond ONLY with a JSON array (no extra text):
[
  {
    "title": "Title of the copyrightable work",
    "description": "Brief description of the work",
    "registrationType": "application" or "module",
    "workType": "literary_work"
  }
]

Return 1-4 items maximum.`;

  const response = await generateText(prompt, 'copyright_analysis');
  const candidates = parseJsonFromResponse<CopyrightCandidate[]>(response);
  const works: CopyrightCandidate[] =
    candidates && Array.isArray(candidates) && candidates.length > 0
      ? candidates
      : [
          {
            title: `${projectName} — Source Code`,
            description: `Complete source code for the ${projectName} software application.`,
            registrationType: 'application',
            workType: 'literary_work',
          },
        ];

  const createdIds: string[] = [];

  for (const work of works) {
    try {
      const { data, error } = await (supabase as any)
        .from('copyright_registrations')
        .insert({
          project_id: projectId,
          user_id: userId,
          title: work.title,
          registration_type: work.registrationType || 'application',
          work_type: work.workType || 'literary_work',
          status: 'draft',
          description: work.description || null,
          author_name: 'Project Owner',
          author_type: 'individual',
          contains_ai_generated_content: false,
          ai_contribution_percentage: 0,
          ai_tools_used: [],
        })
        .select('id')
        .single();

      if (error) {
        console.error('Failed to create copyright registration:', error);
      } else if (data?.id) {
        createdIds.push(data.id);
      }
    } catch (err) {
      console.error('Copyright creation error:', err);
    }
  }

  return createdIds;
}

// ---------------------------------------------------------------------------
// Step 4 — Detect trademarks
// ---------------------------------------------------------------------------

interface TrademarkCandidate {
  markText: string;
  description: string;
  internationalClass: number;
}

async function detectTrademarks(
  projectId: string,
  userId: string,
  projectName: string,
  features: ExtractedFeature[]
): Promise<string[]> {
  const featureNames = features
    .slice(0, 8)
    .map((f) => f.name)
    .join(', ');

  const prompt = `You are a trademark attorney. Determine if the project name or any feature names are trademarkable.

PROJECT NAME: ${projectName}
FEATURE NAMES: ${featureNames}

For each trademarkable name, provide:
- The mark text
- A goods/services description
- The best Nice classification class (9 for software products, 42 for SaaS/technology services)

Respond ONLY with a JSON array (no extra text):
[
  {
    "markText": "THE MARK",
    "description": "Goods/services description for USPTO filing",
    "internationalClass": 9
  }
]

Return 1-3 items maximum. Only include names that are distinctive enough to function as trademarks (not generic or merely descriptive).`;

  const response = await generateText(prompt, 'trademark_analysis');
  const candidates = parseJsonFromResponse<TrademarkCandidate[]>(response);
  const marks: TrademarkCandidate[] =
    candidates && Array.isArray(candidates) && candidates.length > 0
      ? candidates
      : [
          {
            markText: projectName,
            description: `Computer software for ${projectName.toLowerCase()} and related services`,
            internationalClass: 9,
          },
        ];

  const createdIds: string[] = [];

  for (const mark of marks) {
    try {
      const { data, error } = await (supabase as any)
        .from('trademark_applications')
        .insert({
          project_id: projectId,
          user_id: userId,
          mark_type: 'word_mark',
          mark_text: mark.markText,
          mark_description: mark.description || null,
          international_class: mark.internationalClass || 9,
          goods_services_description: mark.description || `Software products and services related to ${projectName}`,
          filing_basis: 'intent_to_use',
          owner_name: 'Project Owner',
          owner_type: 'individual',
          status: 'draft',
        })
        .select('id')
        .single();

      if (error) {
        console.error('Failed to create trademark application:', error);
      } else if (data?.id) {
        createdIds.push(data.id);
      }
    } catch (err) {
      console.error('Trademark creation error:', err);
    }
  }

  return createdIds;
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

export async function runFullIPAnalysis(
  projectId: string,
  userId: string,
  projectName: string,
  onProgress?: (progress: IPOrchestrationProgress) => void
): Promise<IPAnalysisResult> {
  const result: IPAnalysisResult = {
    patentApplicationIds: [],
    copyrightRegistrationIds: [],
    trademarkApplicationIds: [],
    clusterCount: 0,
    errors: [],
  };

  // -----------------------------------------------------------------------
  // 1. Cluster features (0-10%)
  // -----------------------------------------------------------------------
  let features: ExtractedFeature[] = [];
  let clusters: InnovationCluster[] = [];

  try {
    reportProgress(onProgress, 'clustering', 'Extracting codebase features...', 2);

    const analysisResult = await extractCodebaseFeatures(projectId);
    features = analysisResult.features;

    if (features.length === 0) {
      result.errors.push('No features found for project. Run codebase analysis first.');
      reportProgress(onProgress, 'complete', 'No features to process', 100);
      return result;
    }

    reportProgress(onProgress, 'clustering', `Found ${features.length} features. Clustering into inventions...`, 5);

    clusters = await clusterFeatures(features);
    result.clusterCount = clusters.length;

    reportProgress(
      onProgress,
      'clustering',
      `Identified ${clusters.length} innovation cluster(s)`,
      10,
      clusters.map((c) => c.title).join(', ')
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown clustering error';
    result.errors.push(`Feature clustering failed: ${msg}`);
    console.error('Clustering error:', err);
    // Cannot continue without clusters
    reportProgress(onProgress, 'complete', 'Clustering failed', 100);
    return result;
  }

  // -----------------------------------------------------------------------
  // 1b. Load project README for grounding patent generation
  // -----------------------------------------------------------------------
  let readmeContent = '';
  try {
    const { data: projectData } = await (supabase as any)
      .from('projects')
      .select('source_metadata, analysis_summary')
      .eq('id', projectId)
      .maybeSingle();
    if (projectData?.source_metadata?.readmeContent) {
      readmeContent = projectData.source_metadata.readmeContent;
    }
  } catch { /* continue without README */ }

  // -----------------------------------------------------------------------
  // 2. Generate patents (10-70%)
  // -----------------------------------------------------------------------
  try {
    const patentProgressRange = 60; // 10% to 70%
    const perPatent = clusters.length > 0 ? patentProgressRange / clusters.length : patentProgressRange;

    for (let i = 0; i < clusters.length; i++) {
      const cluster = clusters[i];
      const basePercent = 10 + i * perPatent;

      // Build rich invention description with README for grounding
      const inventionDesc = readmeContent
        ? `${cluster.description}\n\n--- PROJECT README (authoritative description of what the software does) ---\n${readmeContent}\n--- END README ---`
        : cluster.description;

      try {
        reportProgress(
          onProgress,
          'patents',
          `Creating patent application ${i + 1}/${clusters.length}: ${cluster.title}`,
          Math.round(basePercent),
          cluster.description
        );

        // Create the patent application with README-enriched description
        const app = await createPatentApplication(projectId, userId, {
          title: cluster.title,
          inventionDescription: inventionDesc,
          technicalField: cluster.technicalField,
        });

        reportProgress(
          onProgress,
          'patents',
          `Generating full patent ${i + 1}/${clusters.length}...`,
          Math.round(basePercent + perPatent * 0.3)
        );

        // Generate the complete patent (specification, claims, drawings, prior art)
        const genResult = await generateCompletePatentApplication({
          applicationId: app.id,
          projectId,
          userId,
          title: cluster.title,
          description: inventionDesc,
          skipPriorArtSearch: false,
          useAIClaims: true,
        });

        if (genResult.success) {
          result.patentApplicationIds.push(app.id);
        } else {
          // Application was created but generation had issues — still track it
          result.patentApplicationIds.push(app.id);
          if (genResult.error) {
            result.errors.push(`Patent "${cluster.title}" generation warning: ${genResult.error}`);
          }
        }

        reportProgress(
          onProgress,
          'patents',
          `Patent ${i + 1}/${clusters.length} complete`,
          Math.round(basePercent + perPatent)
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown patent error';
        result.errors.push(`Patent "${cluster.title}" failed: ${msg}`);
        console.error(`Patent generation error for cluster "${cluster.title}":`, err);
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error in patent phase';
    result.errors.push(`Patent phase error: ${msg}`);
    console.error('Patent phase error:', err);
  }

  // -----------------------------------------------------------------------
  // 3. Assess copyrights (70-85%)
  // -----------------------------------------------------------------------
  try {
    reportProgress(onProgress, 'copyrights', 'Identifying copyrightable works...', 70);

    const copyrightIds = await assessCopyrights(projectId, userId, projectName, features);
    result.copyrightRegistrationIds = copyrightIds;

    reportProgress(
      onProgress,
      'copyrights',
      `Created ${copyrightIds.length} copyright registration(s)`,
      85
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown copyright error';
    result.errors.push(`Copyright assessment failed: ${msg}`);
    console.error('Copyright assessment error:', err);
    reportProgress(onProgress, 'copyrights', 'Copyright assessment encountered errors', 85);
  }

  // -----------------------------------------------------------------------
  // 4. Detect trademarks (85-95%)
  // -----------------------------------------------------------------------
  try {
    reportProgress(onProgress, 'trademarks', 'Analyzing trademarkable names...', 85);

    const trademarkIds = await detectTrademarks(projectId, userId, projectName, features);
    result.trademarkApplicationIds = trademarkIds;

    reportProgress(
      onProgress,
      'trademarks',
      `Created ${trademarkIds.length} trademark application(s)`,
      95
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown trademark error';
    result.errors.push(`Trademark detection failed: ${msg}`);
    console.error('Trademark detection error:', err);
    reportProgress(onProgress, 'trademarks', 'Trademark detection encountered errors', 95);
  }

  // -----------------------------------------------------------------------
  // 5. Store results & update project metadata (95-100%)
  // -----------------------------------------------------------------------
  try {
    reportProgress(onProgress, 'complete', 'Saving results to project...', 96);

    // Fetch current source_metadata so we can merge
    const { data: project } = await (supabase as any)
      .from('projects')
      .select('source_metadata')
      .eq('id', projectId)
      .single();

    const existingMeta = (project?.source_metadata as Record<string, unknown>) || {};

    const updatedMeta = {
      ...existingMeta,
      auto_ip_complete: true,
      patent_ids: result.patentApplicationIds,
      copyright_ids: result.copyrightRegistrationIds,
      trademark_ids: result.trademarkApplicationIds,
      ip_orchestration_completed_at: new Date().toISOString(),
    };

    await (supabase as any)
      .from('projects')
      .update({ source_metadata: updatedMeta })
      .eq('id', projectId);

    reportProgress(
      onProgress,
      'complete',
      `IP analysis complete: ${result.patentApplicationIds.length} patents, ${result.copyrightRegistrationIds.length} copyrights, ${result.trademarkApplicationIds.length} trademarks`,
      100
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error saving results';
    result.errors.push(`Failed to update project metadata: ${msg}`);
    console.error('Metadata update error:', err);
    reportProgress(onProgress, 'complete', 'Completed with metadata save error', 100);
  }

  return result;
}
