import { generateText } from '../ai/geminiService';
import { supabase } from '../../lib/supabase';
import type { CodeFile, ExtractedFeature, AnalysisProgress, AnalysisResult } from '../../types';
import { getLanguageBreakdown } from './codebaseIngestionService';

const BATCH_SIZE = 8;

function createBatchPrompt(files: CodeFile[], batchIndex: number): string {
  const fileContents = files.map(f =>
    `--- FILE: ${f.path} (${f.language}, ${f.lineCount} lines) ---\n${f.content.substring(0, 8000)}\n`
  ).join('\n');

  return `You are a patent attorney and software architect analyzing source code to identify patentable intellectual property.

Analyze these source code files (batch ${batchIndex + 1}) and identify novel, potentially patentable features.

For each feature found, provide:
1. **name**: A concise technical name
2. **type**: One of: algorithm, data_structure, integration, ui_pattern, optimization, architecture, api_design, security_mechanism
3. **description**: 2-3 sentence description of what it does
4. **technical_details**: Detailed technical explanation of how it works (3-5 sentences)
5. **source_files**: Which files contain this feature
6. **novelty_strength**: "strong", "moderate", or "weak" — how novel is this compared to known solutions?
7. **is_core_innovation**: true if this is a central innovation, false if supplementary

Focus on:
- Novel algorithms or methods
- Unique data structures or processing pipelines
- Innovative integration approaches
- Architectural patterns that solve problems in new ways
- Optimization techniques
- Security mechanisms

Do NOT flag standard patterns (REST APIs, CRUD operations, basic auth) unless they have a genuinely novel twist.

Respond in valid JSON format:
{
  "features": [
    {
      "name": "...",
      "type": "...",
      "description": "...",
      "technical_details": "...",
      "source_files": ["..."],
      "novelty_strength": "...",
      "is_core_innovation": false
    }
  ]
}

SOURCE CODE:
${fileContents}`;
}

function parseFeaturesFromResponse(response: string): ExtractedFeature[] {
  try {
    // Extract JSON from response (may be wrapped in markdown code blocks)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.features || !Array.isArray(parsed.features)) return [];

    return parsed.features.map((f: Record<string, unknown>) => ({
      name: String(f.name || 'Unknown Feature'),
      type: String(f.type || 'architecture') as ExtractedFeature['type'],
      description: String(f.description || ''),
      technicalDetails: String(f.technical_details || f.technicalDetails || ''),
      sourceFiles: Array.isArray(f.source_files) ? f.source_files.map(String) : [],
      noveltyStrength: (['strong', 'moderate', 'weak'].includes(String(f.novelty_strength))
        ? String(f.novelty_strength)
        : 'moderate') as ExtractedFeature['noveltyStrength'],
      isCoreInnovation: Boolean(f.is_core_innovation),
    }));
  } catch {
    return [];
  }
}

function createBatches(files: CodeFile[]): CodeFile[][] {
  // Prioritize code files over config/docs
  const prioritized = [...files].sort((a, b) => {
    const codeLanguages = ['typescript', 'javascript', 'python', 'rust', 'go', 'java', 'csharp', 'cpp', 'swift', 'kotlin'];
    const aIsCode = codeLanguages.includes(a.language) ? 0 : 1;
    const bIsCode = codeLanguages.includes(b.language) ? 0 : 1;
    if (aIsCode !== bIsCode) return aIsCode - bIsCode;
    return b.lineCount - a.lineCount; // Larger files first within category
  });

  // Cap at ~40 files for analysis (5 batches of 8)
  const capped = prioritized.slice(0, 40);
  const batches: CodeFile[][] = [];

  for (let i = 0; i < capped.length; i += BATCH_SIZE) {
    batches.push(capped.slice(i, i + BATCH_SIZE));
  }

  return batches;
}

export async function analyzeCodebase(
  projectId: string,
  files: CodeFile[],
  onProgress?: (progress: AnalysisProgress) => void,
): Promise<AnalysisResult> {
  const languageBreakdown = getLanguageBreakdown(files);
  const batches = createBatches(files);
  const allFeatures: ExtractedFeature[] = [];

  onProgress?.({
    step: 'analyzing',
    progress: 10,
    message: `Analyzing ${files.length} files in ${batches.length} batches...`,
  });

  // Process batches sequentially to avoid rate limits
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const progressPct = 10 + ((i / batches.length) * 60);

    onProgress?.({
      step: 'analyzing',
      progress: progressPct,
      message: `Analyzing batch ${i + 1} of ${batches.length}...`,
      detail: batch.map(f => f.path).join(', '),
    });

    try {
      const prompt = createBatchPrompt(batch, i);
      const response = await generateText(prompt, 'codebase_analysis', {
        maxTokens: 3000,
        temperature: 0.2,
      });
      const features = parseFeaturesFromResponse(response);
      allFeatures.push(...features);
    } catch (err) {
      console.error(`Batch ${i + 1} analysis failed:`, err);
      // Continue with remaining batches
    }
  }

  // Store features in database
  onProgress?.({
    step: 'synthesizing',
    progress: 75,
    message: 'Synthesizing and ranking features...',
  });

  // Deduplicate by name similarity
  const uniqueFeatures = deduplicateFeatures(allFeatures);

  // Store in database
  if (uniqueFeatures.length > 0) {
    const featureRows = uniqueFeatures.map(f => ({
      project_id: projectId,
      name: f.name,
      type: f.type,
      description: f.description,
      technical_details: f.technicalDetails,
      source_files: f.sourceFiles,
      code_snippets: f.codeSnippets ? JSON.stringify(f.codeSnippets) : null,
      novelty_strength: f.noveltyStrength,
      is_core_innovation: f.isCoreInnovation,
    }));

    await supabase.from('extracted_features').insert(featureRows);
  }

  // Generate summary
  const summary = await generateCodebaseSummary(files, uniqueFeatures, languageBreakdown);

  // Update project
  await supabase.from('projects').update({
    analysis_status: 'completed',
    analysis_summary: summary,
    analysis_completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', projectId);

  onProgress?.({
    step: 'complete',
    progress: 100,
    message: `Analysis complete. Found ${uniqueFeatures.length} patentable features.`,
  });

  return {
    projectId,
    features: uniqueFeatures,
    summary,
    fileCount: files.length,
    languageBreakdown,
  };
}

function deduplicateFeatures(features: ExtractedFeature[]): ExtractedFeature[] {
  const seen = new Map<string, ExtractedFeature>();

  for (const feature of features) {
    const key = feature.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const existing = seen.get(key);
    if (!existing || feature.technicalDetails.length > existing.technicalDetails.length) {
      seen.set(key, feature);
    }
  }

  // Sort: core innovations first, then by novelty strength
  const strengthOrder = { strong: 0, moderate: 1, weak: 2 };
  return [...seen.values()].sort((a, b) => {
    if (a.isCoreInnovation !== b.isCoreInnovation) return a.isCoreInnovation ? -1 : 1;
    return strengthOrder[a.noveltyStrength] - strengthOrder[b.noveltyStrength];
  });
}

async function generateCodebaseSummary(
  files: CodeFile[],
  features: ExtractedFeature[],
  languageBreakdown: Record<string, number>,
): Promise<string> {
  const topLanguages = Object.entries(languageBreakdown).slice(0, 5).map(([lang, count]) => `${lang} (${count} files)`).join(', ');
  const coreFeatures = features.filter(f => f.isCoreInnovation).map(f => f.name).join(', ');
  const strongFeatures = features.filter(f => f.noveltyStrength === 'strong').map(f => f.name).join(', ');

  const prompt = `Provide a concise 3-4 sentence technical summary of this codebase for IP protection purposes.

Codebase stats:
- ${files.length} analyzable files
- Languages: ${topLanguages}
- ${features.length} potentially patentable features identified
- Core innovations: ${coreFeatures || 'None identified'}
- Strongest novel features: ${strongFeatures || 'None rated strong'}

Feature names: ${features.map(f => f.name).join(', ')}

Write a professional summary suitable for an IP protection report. Focus on what makes this codebase unique and protectable.`;

  try {
    return await generateText(prompt, 'feature_synthesis', { maxTokens: 500, temperature: 0.3 });
  } catch {
    return `Codebase analysis complete: ${files.length} files analyzed across ${Object.keys(languageBreakdown).length} languages. ${features.length} potentially patentable features identified, with ${features.filter(f => f.isCoreInnovation).length} core innovations.`;
  }
}
