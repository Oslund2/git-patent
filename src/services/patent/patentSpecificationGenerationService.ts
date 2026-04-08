import { generateText } from '../ai/geminiService';
import { supabase } from '../../lib/supabase';

/**
 * Trim text to the last complete sentence within a word limit.
 * Splits on sentence-ending punctuation (.!?) and keeps as many
 * complete sentences as fit within maxWords.
 */
function trimToCompleteSentences(text: string, maxWords: number): string {
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return text;

  // Take the first maxWords words, then find the last sentence boundary
  const truncated = words.slice(0, maxWords).join(' ');
  const lastSentenceEnd = Math.max(
    truncated.lastIndexOf('. '),
    truncated.lastIndexOf('.) '),
    truncated.lastIndexOf('? '),
    truncated.lastIndexOf('! ')
  );

  // Also check if it ends with sentence-ending punctuation
  if (/[.!?]$/.test(truncated)) return truncated;

  if (lastSentenceEnd > 0) {
    return truncated.substring(0, lastSentenceEnd + 1);
  }

  // No sentence boundary found — return the full truncated text with a period
  return truncated + '.';
}

// Inline prompt builders for patent specification sections

const GROUNDING_RULE = `
CRITICAL GROUNDING RULES — FOLLOW EXACTLY:
1. The INVENTION DESCRIPTION above contains the project README. This is the AUTHORITATIVE description of what the software does. Your output MUST be consistent with it.
2. ONLY describe functionality that exists in the features list above. Each feature was extracted from actual source code.
3. Do NOT invent components, modules, algorithms, or data structures not listed in the features.
4. Do NOT add reference numerals (e.g., "module 100", "engine 200").
5. Do NOT use terms like "blockchain", "differential privacy", "machine learning models" unless they appear in the README or feature descriptions.
6. If a feature lacks detail, describe it briefly — do NOT fill gaps with speculation or academic-sounding jargon.
7. Every technical claim MUST correspond to a named feature from the list above.
8. Write about what the software ACTUALLY DOES, not what a hypothetical system in this domain COULD do.
9. No output is better than a false output. If you cannot generate accurate content grounded in the provided features, return an empty response rather than fabricating generic placeholder text.
`;

/** Format features with full technical details and code snippets for grounding */
function formatFeaturesRich(features: any[], maxFeatures?: number): string {
  const list = maxFeatures ? features.slice(0, maxFeatures) : features;
  return list.map((f, i) => {
    const name = f.name || f.feature_name || 'Feature';
    const type = f.type || f.feature_type || 'component';
    const novelty = f.noveltyStrength || f.novelty_strength || 'moderate';
    const source = f.sourceFile || f.source_file_path || '';
    const desc = f.description || '';
    const details = f.technicalDetails || f.technical_description || f.description || '';
    const snippet = f.codeSnippet || f.code_snippet || '';

    let text = `${i + 1}. ${name}\n   Type: ${type} | Novelty: ${novelty}`;
    if (source) text += `\n   Source File: ${source}`;
    if (desc) text += `\n   Description: ${desc}`;
    if (details && details !== desc) text += `\n   Technical Details: ${details}`;
    if (snippet) text += `\n   Code:\n   \`\`\`\n   ${snippet.substring(0, 400)}\n   \`\`\``;
    return text;
  }).join('\n\n');
}

/** Format features as brief list (for Field of Invention where detail isn't needed) */
function formatFeaturesBrief(features: any[]): string {
  return features.map(f => `• ${f.name || f.feature_name} (${f.type || f.feature_type || 'component'})`).join('\n');
}

function buildFieldOfInventionPrompt(vars: {
  title: string;
  technicalField: string;
  inventionDescription: string;
  features: string;
}): string {
  return `You are a patent attorney drafting a Field of Invention section for a US patent application.

INVENTION TITLE: ${vars.title}
TECHNICAL FIELD: ${vars.technicalField}
INVENTION DESCRIPTION: ${vars.inventionDescription}

KEY FEATURES:
${vars.features}

Write a concise "Field of the Invention" section (1-2 paragraphs) that:
1. Identifies the general technical field based on the features above
2. Narrows to the specific area of the invention
3. Uses formal patent language ("The present invention relates to...")
4. Does NOT include specific details of the invention itself
5. Derives the field ENTIRELY from the provided features — do NOT assume a domain

Write ONLY the section text, no headings or labels.`;
}

function buildBackgroundPrompt(vars: {
  inventionDescription: string;
  problemSolved: string;
  priorArt: string;
  differentiationPoints: string;
}): string {
  return `You are a patent attorney drafting a Background of the Invention section for a US patent application.

INVENTION DESCRIPTION: ${vars.inventionDescription}
PROBLEM SOLVED: ${vars.problemSolved}

PRIOR ART:
${vars.priorArt}

DIFFERENTIATION POINTS:
${vars.differentiationPoints}

Write a "Background of the Invention" section (3-5 paragraphs) that:
1. Describes the current state of the art
2. Identifies specific limitations and problems in existing solutions
3. Explains why existing approaches are inadequate
4. Sets up the need for the present invention WITHOUT describing it
5. Uses formal patent language and avoids disparaging prior art

Write ONLY the section text, no headings or labels.`;
}

function buildSummaryPrompt(vars: {
  title: string;
  features: string;
  differentiationPoints: string;
  inventionDescription: string;
  problemSolved: string;
}): string {
  return `You are a patent attorney drafting a Summary of the Invention section for a US patent application.

INVENTION TITLE: ${vars.title}
INVENTION DESCRIPTION: ${vars.inventionDescription}
PROBLEM SOLVED: ${vars.problemSolved}

CORE FEATURES:
${vars.features}

ADVANTAGES OVER PRIOR ART:
${vars.differentiationPoints}

Write a "Summary of the Invention" section (3-5 paragraphs) that:
1. Begins with "The present invention provides..." or similar
2. Describes the invention by referencing the SPECIFIC FEATURES listed above by name
3. Highlights the technical advantages evidenced in the features
4. Uses formal patent language

${GROUNDING_RULE}

Write ONLY the section text, no headings or labels.`;
}

function buildDetailedDescriptionPrompt(vars: {
  sectionType: string;
  title: string;
  features: string;
  inventionDescription: string;
  technicalField: string;
}): string {
  const sectionInstructions: Record<string, string> = {
    overview: `Write an OVERVIEW subsection (2-3 paragraphs) that:
1. Introduces the overall system by listing the actual features/components above
2. Describes at a high level how these features work together
3. References features BY NAME from the list above
4. Begin with "The present invention provides a comprehensive system and method for..."`,
    components: `Write a COMPONENTS AND ARCHITECTURE subsection that describes each feature listed above:
1. For each feature, write 1-2 paragraphs based on its description and technical details
2. If code snippets are provided, reference the actual implementation approach shown in the code
3. Do NOT invent inputs/outputs/data flows not described in the features
4. Where appropriate, reference specific figure numbers (e.g., "As illustrated in FIG. 1," or "as shown in FIG. 2")`,
    algorithms: `Write an ALGORITHMS AND METHODS subsection that:
1. Describes the algorithms and methods evidenced in the features above
2. Reference actual code patterns shown in the code snippets
3. If a feature's technical details mention specific algorithms, describe those
4. Do NOT invent algorithms not mentioned in the features
5. Include mathematical expressions or formulas where relevant to describe algorithmic behavior`,
    embodiments: `Write a SYSTEM ARCHITECTURE AND MANAGEMENT subsection (1-3 paragraphs) that:
1. Describes the overall architecture and how components interact
2. Notes that the features described above could be deployed in web, mobile, or cloud configurations
3. Reference specific figures where appropriate (e.g., "As shown in FIG. 1,")`
  };

  return `You are a patent attorney drafting a Detailed Description of the Invention section for a US patent application.

SECTION TYPE: ${vars.sectionType}
INVENTION TITLE: ${vars.title}
TECHNICAL FIELD: ${vars.technicalField}
INVENTION DESCRIPTION: ${vars.inventionDescription}

FEATURES (from actual codebase analysis):
${vars.features}

${sectionInstructions[vars.sectionType] || sectionInstructions.overview}

${GROUNDING_RULE}

Use formal patent language. Write ONLY the section text, no headings or labels.
Do NOT include the "DETAILED DESCRIPTION OF THE INVENTION" heading itself — only write the body content.`;
}

function buildAbstractPrompt(vars: {
  title: string;
  features: string;
  inventionDescription: string;
}): string {
  return `You are a patent attorney drafting an Abstract of the Disclosure for a US patent application.

INVENTION TITLE: ${vars.title}
INVENTION DESCRIPTION: ${vars.inventionDescription}

KEY FEATURES:
${vars.features}

${GROUNDING_RULE}

Write a patent Abstract that is EXACTLY 150 words (USPTO maximum). The abstract MUST be a single, complete paragraph — do NOT cut off mid-sentence. Requirements:
1. Begin in disclosure style: "An [system/method/platform] for [purpose] is disclosed."
2. Concisely describe the invention by referencing ONLY the specific features listed above
3. Highlight the primary technical advantage or problem solved
4. Use formal patent language appropriate for USPTO filing
5. Do NOT use phrases like "This abstract..." or "The abstract..."
6. Every component, module, algorithm, or capability mentioned MUST correspond to an actual feature listed above — do NOT invent functionality
7. If the INVENTION DESCRIPTION is provided, the abstract MUST be consistent with it — it is the authoritative source of what the software does
8. Do NOT use generic academic or scientific jargon (e.g., "machine learning models", "behavioral patterns", "geospatial processing") unless those terms appear in the features or invention description
9. Use "is disclosed" style opening consistent with USPTO Abstract of the Disclosure format

Write ONLY the abstract text — no headings, labels, or word counts.`;
}

function buildSectionRegenerationPrompt(vars: {
  sectionType: string;
  currentContent: string;
  instructions: string;
  context: string;
  inventionDescription: string;
}): string {
  return `You are a patent attorney revising a section of a US patent specification.

SECTION TYPE: ${vars.sectionType}

CURRENT CONTENT:
${vars.currentContent}

USER INSTRUCTIONS FOR REVISION:
${vars.instructions}

ADDITIONAL CONTEXT:
${vars.context}

INVENTION DESCRIPTION: ${vars.inventionDescription}

Revise the section according to the user's instructions while:
1. Maintaining formal patent language
2. Keeping technical accuracy
3. Preserving the overall structure unless instructed otherwise
4. Ensuring consistency with the rest of the specification

Write ONLY the revised section text, no headings or labels.`;
}

// Reference number coordination utilities (inline versions)

export interface ReferenceValidationResult {
  valid: boolean;
  orphanedReferences: number[];
  unusedDrawingReferences: number[];
  warnings: string[];
}

export interface SpecificationWithValidation {
  sections: SpecificationSections;
  validation: ReferenceValidationResult;
  cleanedSections?: SpecificationSections;
}

export interface SpecificationSections {
  field: string;
  background: string;
  briefDescriptionOfDrawings: string;
  summary: string;
  detailedDescription: string;
  abstract: string;
}

export interface InventionContext {
  description?: string;
  technicalField?: string;
  problemSolved?: string;
}

export interface DrawingBlock {
  id: string;
  label: string;
  type?: string;
}

export interface PatentDrawingData {
  figure_number: number;
  figure_title: string;
  svg_content?: string;
  blocks?: DrawingBlock[];
}

interface ReferenceNumber {
  number: number;
  label: string;
  figureNumber: number;
}

// Reference number helpers

function buildReferenceNumberContext(drawings: PatentDrawingData[]): string {
  const refs = extractReferenceNumbersFromDrawings(drawings);
  if (refs.length === 0) return '';

  const lines = refs.map(r => `${r.number} - ${r.label} (FIG. ${r.figureNumber})`);
  return `REFERENCE NUMBERS:\n${lines.join('\n')}`;
}

function generateBriefDescriptionOfDrawings(drawings: PatentDrawingData[]): string {
  return drawings
    .map(d => `    FIG. ${d.figure_number} is a ${d.figure_title.toLowerCase()} according to an embodiment of the present invention.`)
    .join('\n');
}

function extractReferenceNumbersFromDrawings(drawings: PatentDrawingData[]): ReferenceNumber[] {
  const refs: ReferenceNumber[] = [];
  let counter = 100;

  for (const drawing of drawings) {
    if (drawing.blocks) {
      for (const block of drawing.blocks) {
        refs.push({
          number: counter,
          label: block.label,
          figureNumber: drawing.figure_number
        });
        counter += 2;
      }
    }
  }

  return refs;
}

function validateReferenceNumbers(
  text: string,
  drawings: PatentDrawingData[]
): { valid: boolean; missingFromDrawings: number[]; unusedInSpec: number[]; warnings: string[] } {
  const drawingRefs = extractReferenceNumbersFromDrawings(drawings);
  const drawingNumbers = new Set(drawingRefs.map(r => r.number));

  const textNumbers = new Set<number>();
  const pattern = /\b(\d{3})\b/g;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const num = parseInt(match[1], 10);
    if (num >= 100 && num < 1000) {
      textNumbers.add(num);
    }
  }

  const missingFromDrawings = [...textNumbers].filter(n => !drawingNumbers.has(n));
  const unusedInSpec = [...drawingNumbers].filter(n => !textNumbers.has(n));
  const warnings: string[] = [];

  if (missingFromDrawings.length > 0) {
    warnings.push(`Reference numbers in text but not in drawings: ${missingFromDrawings.join(', ')}`);
  }
  if (unusedInSpec.length > 0) {
    warnings.push(`Reference numbers in drawings but not in text: ${unusedInSpec.join(', ')}`);
  }

  return {
    valid: missingFromDrawings.length === 0 && unusedInSpec.length === 0,
    missingFromDrawings,
    unusedInSpec,
    warnings
  };
}

function injectFigureReferences(text: string, drawings: PatentDrawingData[]): string {
  const refs = extractReferenceNumbersFromDrawings(drawings);
  let result = text;

  for (const ref of refs) {
    const pattern = new RegExp(`\\b${ref.label}\\b`, 'gi');
    result = result.replace(pattern, (match) => {
      if (result.includes(`${match} ${ref.number}`)) return match;
      return `${match} ${ref.number}`;
    });
  }

  return result;
}

// Main generation functions

export async function generateIntelligentSpecification(
  title: string,
  features: any[],
  priorArt: any[],
  differentiationReports: any[],
  inventionContext?: InventionContext,
  projectId?: string | null,
  drawings?: PatentDrawingData[]
): Promise<SpecificationSections> {
  // Load project context (analysis summary, source URL, README) for grounding
  let projectContext = '';
  let readmeContent = '';
  if (projectId) {
    try {
      const { data: project } = await (supabase as any)
        .from('projects')
        .select('name, source_url, analysis_summary, source_metadata')
        .eq('id', projectId)
        .maybeSingle();
      if (project) {
        const parts: string[] = [];
        if (project.name) parts.push(`Project: ${project.name}`);
        if (project.source_url) parts.push(`Source: ${project.source_url}`);
        if (project.analysis_summary) parts.push(`Analysis Summary: ${project.analysis_summary}`);
        projectContext = parts.join('\n');
        // Extract README from source_metadata
        const meta = project.source_metadata as Record<string, any> | null;
        if (meta?.readmeContent) {
          readmeContent = meta.readmeContent;
        }
      }
    } catch { /* continue without project context */ }
  }

  // Build comprehensive grounding context with README
  const groundingParts: string[] = [];
  if (projectContext) groundingParts.push(projectContext);
  if (readmeContent) {
    groundingParts.push(`\n--- PROJECT README (this is the authoritative description of what the software does) ---\n${readmeContent}\n--- END README ---`);
  }
  if (inventionContext?.description) groundingParts.push(inventionContext.description);

  // Enrich invention context with project info + README
  const enrichedContext: InventionContext = {
    ...inventionContext,
    description: groundingParts.join('\n\n')
  };

  const referenceContext = drawings && drawings.length > 0
    ? buildReferenceNumberContext(drawings)
    : null;

  const briefDescriptionOfDrawings = drawings && drawings.length > 0
    ? generateBriefDescriptionOfDrawings(drawings)
    : '';

  const field = await generateFieldSection(title, features, enrichedContext, projectId, referenceContext);
  const background = await generateBackgroundSection(priorArt, differentiationReports, enrichedContext, projectId, referenceContext);
  const summary = await generateSummarySection(title, features, differentiationReports, enrichedContext, projectId, referenceContext);
  const detailedDescription = await generateDetailedDescriptionSection(title, features, enrichedContext, projectId, referenceContext, drawings);
  const abstract = await generateAbstractSection(title, features, enrichedContext, projectId);

  return {
    field,
    background,
    briefDescriptionOfDrawings,
    summary,
    detailedDescription,
    abstract
  };
}

async function generateFieldSection(
  title: string,
  features: any[],
  inventionContext?: InventionContext,
  _projectId?: string | null,
  referenceContext?: string | null
): Promise<string> {
  const featuresText = formatFeaturesBrief(features);

  try {
    let promptVars = {
      title,
      technicalField: inventionContext?.technicalField || '',
      inventionDescription: inventionContext?.description || '',
      features: featuresText
    };

    if (referenceContext) {
      promptVars = {
        ...promptVars,
        inventionDescription: `${promptVars.inventionDescription}\n\n${referenceContext}`
      } as any;
    }

    const prompt = buildFieldOfInventionPrompt(promptVars);

    const response = await generateText(prompt, 'patent_specification_field');
    return response.trim();
  } catch (error) {
    console.error('Field section generation failed:', error);
    return '';
  }
}

async function generateBackgroundSection(
  priorArt: any[],
  differentiationReports: any[],
  inventionContext?: InventionContext,
  _projectId?: string | null,
  referenceContext?: string | null
): Promise<string> {
  const priorArtText = priorArt.length > 0
    ? priorArt.map((pa, i) => `${i + 1}. ${pa.patent_number || 'Prior System'} - ${pa.patent_title || 'Existing Solution'}
   Limitations: ${pa.similarity_explanation || 'General limitations of existing approaches'}`).join('\n\n')
    : 'General prior art in the relevant technical field.';

  const differentiationText = differentiationReports.length > 0
    ? differentiationReports.map(dr => `- Points of Novelty: ${dr.points_of_novelty?.join(', ') || 'Novel approach to the problem'}
- Technical Advantages: ${dr.technical_advantages?.join(', ') || 'Improved efficiency and accuracy'}`).join('\n')
    : 'Novel approaches that address limitations in existing systems.';

  try {
    let promptVars = {
      inventionDescription: inventionContext?.description || '',
      problemSolved: inventionContext?.problemSolved || '',
      priorArt: priorArtText,
      differentiationPoints: differentiationText
    };

    if (referenceContext) {
      promptVars.inventionDescription = `${promptVars.inventionDescription}\n\n${referenceContext}`;
    }

    const prompt = buildBackgroundPrompt(promptVars);

    const response = await generateText(prompt, 'patent_specification_background');
    return response.trim();
  } catch (error) {
    console.error('Background section generation failed:', error);
    return '';
  }
}

async function generateSummarySection(
  title: string,
  features: any[],
  differentiationReports: any[],
  inventionContext?: InventionContext,
  _projectId?: string | null,
  referenceContext?: string | null
): Promise<string> {
  const coreFeatures = features.filter(f => f.isCoreInnovation || f.is_core_innovation);
  const advantages = differentiationReports.flatMap(dr => dr.technical_advantages || []);

  const featuresText = coreFeatures.length > 0
    ? formatFeaturesRich(coreFeatures)
    : formatFeaturesRich(features, 8);

  const differentiationText = advantages.length > 0
    ? advantages.map((adv, i) => `${i + 1}. ${adv}`).join('\n')
    : 'Improved efficiency and streamlined workflow';

  try {
    let promptVars = {
      title,
      features: featuresText,
      differentiationPoints: differentiationText,
      inventionDescription: inventionContext?.description || '',
      problemSolved: inventionContext?.problemSolved || ''
    };

    if (referenceContext) {
      promptVars.inventionDescription = `${promptVars.inventionDescription}\n\n${referenceContext}`;
    }

    const prompt = buildSummaryPrompt(promptVars);

    const response = await generateText(prompt, 'patent_specification_summary');
    return response.trim();
  } catch (error) {
    console.error('Summary section generation failed:', error);
    return '';
  }
}

async function generateDetailedDescriptionChunk(
  chunkType: 'overview' | 'components' | 'algorithms' | 'embodiments',
  title: string,
  features: any[],
  inventionContext?: InventionContext,
  _projectId?: string | null
): Promise<string> {
  const coreFeatures = features.filter(f => f.isCoreInnovation || f.is_core_innovation);

  const featuresText = chunkType === 'algorithms'
    ? formatFeaturesRich(coreFeatures.length > 0 ? coreFeatures : features.filter(f => (f.type || f.feature_type) === 'algorithm'))
    : chunkType === 'components'
    ? formatFeaturesRich(features)
    : chunkType === 'embodiments'
    ? formatFeaturesBrief(features)
    : formatFeaturesRich(features, 8);

  try {
    let promptVars = {
      sectionType: chunkType,
      title,
      features: featuresText,
      inventionDescription: inventionContext?.description || '',
      technicalField: inventionContext?.technicalField || ''
    };

    const prompt = buildDetailedDescriptionPrompt(promptVars);

    const response = await generateText(prompt, 'patent_specification_detailed');
    return response.trim();
  } catch (error) {
    console.error(`Detailed description chunk (${chunkType}) generation failed:`, error);
    return '';
  }
}

async function generateDetailedDescriptionSection(
  title: string,
  features: any[],
  inventionContext?: InventionContext,
  projectId?: string | null,
  referenceContext?: string | null,
  drawings?: PatentDrawingData[]
): Promise<string> {
  const sections: string[] = [];

  if (drawings && drawings.length > 0) {
    const refs = extractReferenceNumbersFromDrawings(drawings);
    if (refs.length > 0) {
      sections.push('Referring now to the drawings, wherein like reference numerals designate corresponding parts throughout the several views:');
      sections.push('');
    }
  }

  const inventionContextWithRefs = referenceContext
    ? {
        ...inventionContext,
        description: `${inventionContext?.description || ''}\n\n${referenceContext}`
      }
    : inventionContext;

  const chunkTypes: { type: 'overview' | 'components' | 'algorithms' | 'embodiments'; romanNumeral: string; title: string }[] = [
    { type: 'overview', romanNumeral: 'I', title: 'Overview' },
    { type: 'components', romanNumeral: 'II', title: 'Components and Architecture' },
    { type: 'algorithms', romanNumeral: 'III', title: 'Algorithms and Methods' },
    { type: 'embodiments', romanNumeral: 'IV', title: 'System Architecture and Management' }
  ];

  const chunks = await Promise.all(
    chunkTypes.map(ct => generateDetailedDescriptionChunk(ct.type, title, features, inventionContextWithRefs, projectId))
  );

  chunks.forEach((chunk, i) => {
    if (chunk.length > 0) {
      sections.push(`${chunkTypes[i].romanNumeral}. ${chunkTypes[i].title}\n${chunk}`);
    }
  });

  return sections.join('\n\n');
}

async function generateAbstractSection(
  title: string,
  features: any[],
  inventionContext?: InventionContext,
  _projectId?: string | null
): Promise<string> {
  const coreFeatures = features.filter(f => f.isCoreInnovation || f.is_core_innovation).slice(0, 3);

  const featuresText = coreFeatures.length > 0
    ? formatFeaturesRich(coreFeatures, 5)
    : formatFeaturesRich(features, 5);

  try {
    const prompt = buildAbstractPrompt({
      title,
      features: featuresText,
      inventionDescription: inventionContext?.description || ''
    });

    const response = await generateText(prompt, 'patent_abstract_generation');
    return trimToCompleteSentences(response.trim(), 150);
  } catch (error) {
    console.error('Abstract section generation failed:', error);
    return '';
  }
}

export async function regenerateSection(
  sectionName: string,
  currentContent: string,
  userFeedback: string,
  contextData: any,
  _projectId?: string | null
): Promise<string> {
  try {
    const prompt = buildSectionRegenerationPrompt({
      sectionType: sectionName,
      currentContent,
      instructions: userFeedback,
      context: JSON.stringify(contextData, null, 2),
      inventionDescription: contextData?.inventionDescription || ''
    });

    const response = await generateText(prompt, 'patent_section_regeneration');
    return response.trim();
  } catch (error) {
    console.error('Section regeneration failed:', error);
    return currentContent;
  }
}

export function cleanOrphanedReferences(
  text: string,
  validReferenceNumbers: Set<number>
): string {
  const referencePattern = /(\b(?:module|system|platform|engine|component|unit|processor|database|interface|layer|manager|algorithm|service|handler|controller|generator|analyzer|tracker|pipeline|workflow|suite|model|storage|cache)\s+)(\d{3})(\b)/gi;

  return text.replace(referencePattern, (match, prefix, numStr, suffix) => {
    const num = parseInt(numStr, 10);
    if (validReferenceNumbers.has(num)) {
      return match;
    }
    return prefix.trim() + suffix;
  });
}

export function validateSpecificationReferences(
  sections: SpecificationSections,
  drawings: PatentDrawingData[]
): ReferenceValidationResult {
  const fullText = [
    sections.field,
    sections.background,
    sections.summary,
    sections.detailedDescription,
    sections.abstract
  ].join('\n\n');

  const validationResult = validateReferenceNumbers(fullText, drawings);

  return {
    valid: validationResult.valid,
    orphanedReferences: validationResult.missingFromDrawings,
    unusedDrawingReferences: validationResult.unusedInSpec,
    warnings: validationResult.warnings
  };
}

export function cleanSpecificationSections(
  sections: SpecificationSections,
  drawings: PatentDrawingData[]
): SpecificationSections {
  const refs = extractReferenceNumbersFromDrawings(drawings);
  const validNumbers = new Set(refs.map(r => r.number));

  return {
    field: cleanOrphanedReferences(sections.field, validNumbers),
    background: cleanOrphanedReferences(sections.background, validNumbers),
    briefDescriptionOfDrawings: sections.briefDescriptionOfDrawings,
    summary: cleanOrphanedReferences(sections.summary, validNumbers),
    detailedDescription: cleanOrphanedReferences(sections.detailedDescription, validNumbers),
    abstract: cleanOrphanedReferences(sections.abstract, validNumbers)
  };
}

function applyFigureReferencesToSections(
  sections: SpecificationSections,
  drawings: PatentDrawingData[]
): SpecificationSections {
  if (!drawings || drawings.length === 0) {
    return sections;
  }

  return {
    field: injectFigureReferences(sections.field, drawings),
    background: injectFigureReferences(sections.background, drawings),
    briefDescriptionOfDrawings: sections.briefDescriptionOfDrawings,
    summary: injectFigureReferences(sections.summary, drawings),
    detailedDescription: injectFigureReferences(sections.detailedDescription, drawings),
    abstract: injectFigureReferences(sections.abstract, drawings)
  };
}

export async function generateValidatedSpecification(
  title: string,
  features: any[],
  priorArt: any[],
  differentiationReports: any[],
  inventionContext?: InventionContext,
  projectId?: string | null,
  drawings?: PatentDrawingData[],
  autoClean: boolean = true
): Promise<SpecificationWithValidation> {
  const sections = await generateIntelligentSpecification(
    title,
    features,
    priorArt,
    differentiationReports,
    inventionContext,
    projectId,
    drawings
  );

  const drawingsArray = drawings || [];
  const validation = validateSpecificationReferences(sections, drawingsArray);

  let cleanedSections: SpecificationSections | undefined;
  if (autoClean && !validation.valid && drawingsArray.length > 0) {
    cleanedSections = cleanSpecificationSections(sections, drawingsArray);
  }

  let finalSections = autoClean && cleanedSections ? cleanedSections : sections;

  if (drawingsArray.length > 0) {
    finalSections = applyFigureReferencesToSections(finalSections, drawingsArray);
    if (cleanedSections) {
      cleanedSections = applyFigureReferencesToSections(cleanedSections, drawingsArray);
    }
  }

  return {
    sections: finalSections,
    validation,
    cleanedSections
  };
}
