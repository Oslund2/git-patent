/**
 * Prompt resolver for IP Shield.
 * Uses inline fallback/defaults only (no database prompt_library lookup).
 */

export interface PatentPromptTemplate {
  key: string;
  name: string;
  description: string;
  content: string;
  variables: Array<{
    name: string;
    description: string;
    type: 'string' | 'number' | 'array' | 'object';
    required: boolean;
    example?: string;
  }>;
}

const FALLBACK_PROMPTS: Record<string, string> = {};

/**
 * Simple template variable renderer.
 * Replaces ${variableName} tokens with provided values.
 */
function renderPrompt(template: string, variables: Record<string, any>): string {
  let rendered = template;
  for (const [key, value] of Object.entries(variables)) {
    const token = '${' + key + '}';
    rendered = rendered.split(token).join(String(value ?? ''));
  }
  return rendered;
}

export async function resolvePrompt(
  _projectId: string | null,
  promptKey: string,
  variables?: Record<string, any>
): Promise<string> {
  const promptContent = FALLBACK_PROMPTS[promptKey] || null;

  if (!promptContent) {
    throw new Error(`Prompt not found: ${promptKey}`);
  }

  if (variables && Object.keys(variables).length > 0) {
    return renderPrompt(promptContent, variables);
  }

  return promptContent;
}

export async function resolvePromptWithFallback(
  _projectId: string | null,
  promptKey: string,
  fallbackContent: string,
  variables?: Record<string, any>
): Promise<string> {
  const finalContent = FALLBACK_PROMPTS[promptKey] || fallbackContent;

  if (variables && Object.keys(variables).length > 0) {
    return renderPrompt(finalContent, variables);
  }

  return finalContent;
}

// --- Patent prompt defaults (inline) ---

const PATENT_PROMPT_DEFAULTS: Record<string, string> = {
  patent_claims_independent: `Generate independent patent claims for the following invention. Create claims that are TECHNICALLY SPECIFIC to survive Alice/Mayo subject matter eligibility challenges while providing meaningful protection.

INVENTION TITLE: \${title}

CORE NOVEL FEATURES:
\${features}

NOVELTY ASSESSMENT:
\${noveltyAnalysis}

INVENTION CONTEXT:
\${inventionDescription}

CRITICAL GROUNDING RULES:
- Claims MUST ONLY cover functionality that is evidenced by the features listed above.
- Do NOT claim capabilities, components, or algorithms not described in the provided features.
- Every element in each claim must correspond to a named feature or a specific technical detail from the features list.
- Do NOT use generic technical jargon (e.g., "machine learning model", "neural network", "blockchain") unless those terms appear in the features or invention context.
- If the features are insufficient to support a particular claim type, omit that claim type rather than inventing functionality.

Generate 3-5 independent claims covering:
1. A METHOD claim for the core process
2. A SYSTEM claim for the apparatus/architecture
3. A COMPUTER-READABLE MEDIUM claim

Each claim should:
- Start with a preamble defining the technical context
- Include specific technical steps or components
- Reference concrete data transformations, not abstract ideas
- Be broad enough to be commercially valuable but specific enough to be novel

Respond with ONLY a JSON array of claim text strings. No wrapper object, no extra fields — just the claim text:
[
  "1. A method for ... comprising: ...",
  "2. A system for ... comprising: ...",
  "3. A non-transitory computer-readable medium storing instructions that, when executed, cause a processor to ..."
]`,

  patent_claims_dependent: `Generate dependent patent claims that add specific limitations to the following independent claims.

INDEPENDENT CLAIMS:
\${independentClaims}

AVAILABLE FEATURES FOR LIMITATIONS:
\${features}

CRITICAL GROUNDING RULES:
- Each dependent claim MUST add a limitation that corresponds to a specific feature from the list above.
- Do NOT introduce components, algorithms, or capabilities not evidenced in the features.
- If there are not enough distinct features to support 8 claims, generate fewer claims rather than inventing limitations.

Generate 8-15 dependent claims that:
1. Reference specific independent claims
2. Add meaningful technical limitations drawn from the features above
3. Cover different aspects of the invention
4. Create a claim tree with varying scope

Respond with ONLY a JSON array of objects. No wrapper object:
[
  {"claimText": "The method of claim 1, wherein ...", "parentClaimNumber": 1},
  {"claimText": "The system of claim 2, further comprising ...", "parentClaimNumber": 2}
]`,

  patent_field_of_invention: `Write a "Field of the Invention" section for a patent application.

INVENTION TITLE: \${title}
TECHNICAL FIELD: \${technicalField}
INVENTION DESCRIPTION: \${inventionDescription}
KEY FEATURES: \${features}

Write 1-2 paragraphs describing the general technical field. Be broad but accurate.
Do not describe the specific invention - only the field it belongs to.`,

  patent_background_section: `Write a "Background of the Invention" section for a patent application.

INVENTION DESCRIPTION: \${inventionDescription}
PROBLEM SOLVED: \${problemSolved}
PRIOR ART REFERENCES: \${priorArt}
DIFFERENTIATION POINTS: \${differentiationPoints}

Write 3-5 paragraphs that:
1. Describe the general state of the art
2. Identify problems and limitations in existing solutions
3. Explain why current approaches are inadequate
4. Set up the need for the present invention (without describing it)

Use formal patent language. Reference prior art where appropriate.`,

  patent_summary_section: `Write a "Summary of the Invention" section for a patent application.

INVENTION TITLE: \${title}
KEY FEATURES: \${features}
DIFFERENTIATION POINTS: \${differentiationPoints}
INVENTION DESCRIPTION: \${inventionDescription}
PROBLEM SOLVED: \${problemSolved}

Write 2-4 paragraphs that:
1. Briefly state what the invention is
2. Describe the key technical advantages
3. Summarize the main embodiments
4. Highlight how it solves the identified problems

Use formal patent language. Be specific about technical contributions.`,

  patent_details_description: `Write a detailed description section for a patent application.

SECTION TYPE: \${sectionType}
INVENTION TITLE: \${title}
KEY FEATURES: \${features}
INVENTION DESCRIPTION: \${inventionDescription}
TECHNICAL FIELD: \${technicalField}

Write a thorough technical description that:
1. Describes preferred embodiments in detail
2. Explains how components interact
3. Provides enough detail for a person skilled in the art to reproduce
4. References figure numbers where appropriate (FIG. 1, FIG. 2, etc.)
5. Uses reference numerals for components (100, 102, 104, etc.)

Use formal patent language throughout.`,

  patent_abstract_generation: `Write a patent abstract for the following invention.

INVENTION TITLE: \${title}
KEY FEATURES: \${features}
INVENTION DESCRIPTION: \${inventionDescription}

Requirements:
- Must be 150 words or fewer
- Single paragraph
- Describe the technical disclosure concisely
- Include the key technical elements
- Do not use phrases like "This invention relates to" or "is disclosed"
- Use active voice where possible`,

  patent_section_regeneration: `Regenerate a patent application section based on feedback.

SECTION TYPE: \${sectionType}

CURRENT CONTENT:
\${currentContent}

REVISION INSTRUCTIONS:
\${instructions}

ADDITIONAL CONTEXT:
\${context}

INVENTION DESCRIPTION:
\${inventionDescription}

Rewrite the section incorporating the feedback while maintaining:
1. Formal patent language
2. Technical accuracy
3. Proper patent document structure
4. Consistency with the rest of the application`,

  patent_differentiation_analysis: `Analyze the differentiation between our invention and the cited prior art.

OUR INVENTION'S FEATURES:
\${features}

PRIOR ART:
\${priorArt}

INVENTION DESCRIPTION:
\${inventionDescription}

Provide a detailed differentiation analysis in JSON format:
{
  "pointsOfNovelty": ["List of specific novel aspects"],
  "technicalAdvantages": ["List of technical advantages over prior art"],
  "comparisonMatrix": {
    "Feature Area": {
      "priorArt": "What prior art does",
      "ourInvention": "What our invention does differently"
    }
  },
  "quantification": {
    "metric": "quantified improvement"
  },
  "unexpectedResults": "Description of any unexpected technical results",
  "nonObviousnessArgument": "Argument for why the combination is non-obvious",
  "summary": "Overall differentiation summary",
  "strengthScore": 85,
  "distanceScore": 75
}`,

  patent_art_comparison: `Compare our invention against a specific prior art patent.

OUR INVENTION:
Title: \${inventionTitle}
Features: \${inventionFeatures}
Description: \${inventionDescription}

PRIOR ART PATENT:
Number: \${priorArtNumber}
Title: \${priorArtTitle}
Abstract: \${priorArtAbstract}

Provide a detailed comparison in JSON format:
{
  "similarFeatures": ["Features that overlap"],
  "uniqueToOurInvention": ["Features only in our invention"],
  "uniqueToPriorArt": ["Features only in prior art"],
  "technicalDifferences": ["Key technical differences"],
  "overallSimilarity": 0.45,
  "blockingRisk": "low|medium|high",
  "designAroundStrategy": "How to design around if needed"
}`,

  prior_art_search: `Generate search queries for prior art research related to this invention.

INVENTION TITLE: \${title}
INVENTION DESCRIPTION: \${inventionDescription}
KEY FEATURES: \${features}
ANALYSIS TARGET: \${analysisTarget}

Generate patent search queries in JSON format:
{
  "queries": [
    {
      "query": "search query text",
      "databases": ["USPTO", "Google Patents"],
      "cpcCodes": ["relevant CPC codes"],
      "rationale": "why this query is important"
    }
  ],
  "keyTerms": ["important technical terms for searching"],
  "suggestedCPCCodes": ["CPC codes to filter by"]
}`,

  patent_novelty_analysis: `Analyze the novelty of this invention against known prior art.

INVENTION TITLE: \${title}
KEY FEATURES: \${features}
PRIOR ART FOUND: \${priorArt}
INVENTION DESCRIPTION: \${inventionDescription}

Provide a novelty assessment in JSON format:
{
  "overallNoveltyScore": 85,
  "featureScores": [
    {
      "feature": "Feature name",
      "noveltyScore": 90,
      "rationale": "Why this score"
    }
  ],
  "strengths": ["Strong novel aspects"],
  "weaknesses": ["Areas of concern"],
  "recommendations": ["Suggestions to strengthen patentability"],
  "approvalProbability": 75,
  "patentabilityAssessment": "Overall assessment paragraph"
}`
};

function getPatentPromptContent(key: string): string | null {
  return PATENT_PROMPT_DEFAULTS[key] || null;
}

export async function resolvePatentPrompt(
  projectId: string | null,
  promptKey: string,
  variables?: Record<string, any>
): Promise<string> {
  const fallbackContent = getPatentPromptContent(promptKey);

  if (!fallbackContent) {
    throw new Error(`Unknown patent prompt key: ${promptKey}`);
  }

  return resolvePromptWithFallback(projectId, promptKey, fallbackContent, variables);
}

export async function getPatentClaimsIndependentPrompt(
  projectId: string | null,
  variables: {
    title: string;
    features: string;
    noveltyAnalysis?: string;
    inventionDescription?: string;
  }
): Promise<string> {
  return resolvePatentPrompt(projectId, 'patent_claims_independent', variables);
}

export async function getPatentClaimsDependentPrompt(
  projectId: string | null,
  variables: {
    independentClaims: string;
    features: string;
  }
): Promise<string> {
  return resolvePatentPrompt(projectId, 'patent_claims_dependent', variables);
}

export async function getPatentFieldOfInventionPrompt(
  projectId: string | null,
  variables: {
    title: string;
    technicalField?: string;
    inventionDescription?: string;
    features: string;
  }
): Promise<string> {
  return resolvePatentPrompt(projectId, 'patent_field_of_invention', variables);
}

export async function getPatentBackgroundPrompt(
  projectId: string | null,
  variables: {
    inventionDescription?: string;
    problemSolved?: string;
    priorArt: string;
    differentiationPoints?: string;
  }
): Promise<string> {
  return resolvePatentPrompt(projectId, 'patent_background_section', variables);
}

export async function getPatentSummaryPrompt(
  projectId: string | null,
  variables: {
    title: string;
    features: string;
    differentiationPoints?: string;
    inventionDescription?: string;
    problemSolved?: string;
  }
): Promise<string> {
  return resolvePatentPrompt(projectId, 'patent_summary_section', variables);
}

export async function getPatentDetailedDescriptionPrompt(
  projectId: string | null,
  variables: {
    sectionType: string;
    title: string;
    features: string;
    inventionDescription?: string;
    technicalField?: string;
  }
): Promise<string> {
  return resolvePatentPrompt(projectId, 'patent_details_description', variables);
}

export async function getPatentAbstractPrompt(
  projectId: string | null,
  variables: {
    title: string;
    features: string;
    inventionDescription?: string;
  }
): Promise<string> {
  return resolvePatentPrompt(projectId, 'patent_abstract_generation', variables);
}

export async function getPatentSectionRegenerationPrompt(
  projectId: string | null,
  variables: {
    sectionType: string;
    currentContent: string;
    instructions: string;
    context?: string;
    inventionDescription?: string;
  }
): Promise<string> {
  return resolvePatentPrompt(projectId, 'patent_section_regeneration', variables);
}

export async function getPatentDifferentiationPrompt(
  projectId: string | null,
  variables: {
    features: string;
    priorArt: string;
    inventionDescription?: string;
  }
): Promise<string> {
  return resolvePatentPrompt(projectId, 'patent_differentiation_analysis', variables);
}

export async function getPatentArtComparisonPrompt(
  projectId: string | null,
  variables: {
    inventionTitle: string;
    inventionFeatures: string;
    inventionDescription?: string;
    priorArtNumber: string;
    priorArtTitle: string;
    priorArtAbstract: string;
  }
): Promise<string> {
  return resolvePatentPrompt(projectId, 'patent_art_comparison', variables);
}

export async function getPriorArtSearchPrompt(
  projectId: string | null,
  variables: {
    title: string;
    inventionDescription?: string;
    features: string;
    analysisTarget?: string;
  }
): Promise<string> {
  return resolvePatentPrompt(projectId, 'prior_art_search', variables);
}

export async function getPatentNoveltyAnalysisPrompt(
  projectId: string | null,
  variables: {
    title: string;
    features: string;
    priorArt?: string;
    inventionDescription?: string;
  }
): Promise<string> {
  return resolvePatentPrompt(projectId, 'patent_novelty_analysis', variables);
}

export function getPatentPromptKeys(): string[] {
  return Object.keys(PATENT_PROMPT_DEFAULTS);
}
