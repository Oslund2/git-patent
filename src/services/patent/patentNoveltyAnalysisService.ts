import { supabase } from '../../lib/supabase';
import { generateText } from '../ai/geminiService';
import { extractCodebaseFeatures, createFeatureAnalysis, createFeatureMappings } from './patentFeatureExtractionService';
import { getPriorArtResults } from './patentPriorArtSearchService';

// Inline prompt builder for novelty analysis with multi-dimensional scoring
function buildNoveltyAnalysisPrompt(vars: {
  title: string;
  features: string;
  priorArt: string;
  inventionDescription: string;
  readmeContent: string;
}): string {
  const readmeSection = vars.readmeContent
    ? `PROJECT README (the inventor's own description of what their software does — treat this as ground truth for understanding the invention's purpose, functionality, and claimed advantages):
${vars.readmeContent.substring(0, 4000)}

IMPORTANT README ANALYSIS INSTRUCTIONS:
- Use the README to understand the inventor's intended novelty and key differentiators
- Compare README claims against the extracted code features: does the code actually implement what the README claims?
- Compare README-described functionality against the prior art: is what this software does actually novel, or does the README describe well-known functionality?
- If the README describes unique technical approaches, weight those heavily in scoring
- If the README is vague or describes generic functionality, that should lower Technical Depth and Novelty scores

`
    : '';

  return `You are a senior patent examiner with expertise in software patents. Perform a multi-dimensional patentability analysis.

INVENTION TITLE: ${vars.title}

INVENTION DESCRIPTION:
${vars.inventionDescription}

${readmeSection}EXTRACTED CODE FEATURES:
${vars.features}

PRIOR ART PATENTS:
${vars.priorArt}

Score this invention on FOUR dimensions. For each, provide a score from 0-100 and 2-3 sentences of reasoning.

Scoring criteria:
1. **novelty_102** (35 USC 102 — Novelty): Is each claimed element novel over the individual prior art references? Score 90+ only if no single prior art reference discloses all key features. Score below 40 if a single reference anticipates the core invention.

2. **non_obviousness_103** (35 USC 103 — Non-Obviousness): Would a person of ordinary skill in the art combine the cited prior art references to arrive at this invention? Score 90+ only if combination requires unexpected insight. Score below 40 if the combination is straightforward.

3. **technical_depth** (Implementation Specificity): How specific and concrete is the technical implementation? Score 90+ for detailed algorithms, data structures, and performance characteristics. Score below 40 for abstract descriptions without technical substance.

4. **prior_art_differentiation** (Differentiation Clarity): How clearly and convincingly does this invention differ from the closest prior art? Score 90+ if differences are fundamental architectural choices. Score below 40 if differences are trivial parameter changes.

CRITICAL SCORING CALIBRATION — YOU MUST FOLLOW THESE:
- Scores MUST span at least 20 points across the four dimensions. Do NOT give all four dimensions the same or similar score.
- If this invention is a standard web application, CRUD system, or business workflow automation with no novel algorithms, scores should be in the 30-55 range — not artificially elevated.
- Only score novelty_102 above 75 if you can identify a SPECIFIC technical mechanism not disclosed in any single prior art reference.
- Only score non_obviousness_103 above 75 if combining the cited prior art would require a non-obvious insight, not routine engineering.
- Do NOT default to scores in the 60-75 range out of caution. Commit to your assessment — low scores are expected for incremental work.
- A score of 50 means "average, nothing special." Most software patents should score between 35-65 unless they contain genuinely novel techniques.

Also provide qualitative analysis arrays and a composite assessment.

Respond with ONLY a JSON object in this exact structure:
{
  "scores": {
    "novelty_102": { "score": <0-100>, "reasoning": "<2-3 sentences>" },
    "non_obviousness_103": { "score": <0-100>, "reasoning": "<2-3 sentences>" },
    "technical_depth": { "score": <0-100>, "reasoning": "<2-3 sentences>" },
    "prior_art_differentiation": { "score": <0-100>, "reasoning": "<2-3 sentences>" }
  },
  "strengths": ["array of patentability strengths"],
  "weaknesses": ["array of potential weaknesses or concerns"],
  "recommendations": ["array of specific recommendations to strengthen the application"],
  "assessment": "A comprehensive 3-5 sentence patentability assessment covering novelty, non-obviousness, utility, and subject matter eligibility"
}`;
}

// Patent prompt templates for Alice risk assessment (inline)
const PATENT_PROMPT_TEMPLATES: Record<string, { content: string }> = {
  patent_alice_risk_assessment: {
    content: `You are a patent attorney specializing in Alice/Mayo patent eligibility analysis under 35 USC 101.

Analyze the following patent application for Alice risk:

INVENTION TITLE: \${title}

CLAIMS:
\${claims}

TECHNICAL FEATURES:
\${features}

INVENTION DESCRIPTION:
\${inventionDescription}

Perform a two-step Alice analysis:
Step 1: Determine if any claims are directed to an abstract idea, law of nature, or natural phenomenon
Step 2: For claims that fail Step 1, determine if they contain an "inventive concept" (something "significantly more" than the abstract idea)

Provide a JSON response with:
{
  "overallAliceRiskScore": 0-100 (higher = more risk of 101 rejection),
  "claimAnalysis": [
    {
      "claimNumber": 1,
      "riskScore": 0-100,
      "riskLevel": "Low|Medium|High",
      "abstractIdeaRisk": "explanation of abstract idea concern",
      "technicalAnchoringStrength": "how well claim is tied to technical implementation",
      "improvementEvidence": "evidence this improves computer functionality",
      "vulnerablePhrases": ["phrases that could trigger 101 rejection"],
      "strengths": ["claim elements that support eligibility"],
      "recommendations": ["specific improvements to reduce risk"]
    }
  ],
  "overallStrengths": ["strengths across all claims"],
  "overallWeaknesses": ["weaknesses across all claims"],
  "recommendedImprovements": ["specific language changes or additions"],
  "summary": "Overall Alice risk assessment summary"
}

Respond with ONLY the JSON object, no other text.`
  }
};

export interface NoveltyAnalysis {
  analysisId: string;
  overallScore: number;
  approvalProbability: number;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  featureNoveltyScores: Record<string, number>;
  patentabilityAssessment: string;
}

export interface AliceRiskAssessment {
  overallAliceRiskScore: number;
  riskLevel: 'Low' | 'Medium' | 'High';
  claimAnalysis: Array<{
    claimNumber: number;
    riskScore: number;
    riskLevel: string;
    abstractIdeaRisk: string;
    technicalAnchoringStrength: string;
    improvementEvidence: string;
    vulnerablePhrases: string[];
    strengths: string[];
    recommendations: string[];
  }>;
  overallStrengths: string[];
  overallWeaknesses: string[];
  recommendedImprovements: string[];
  summary: string;
}

export async function performNoveltyAnalysis(
  projectId: string,
  patentApplicationId: string,
  userId: string
): Promise<NoveltyAnalysis> {
  const features = await extractCodebaseFeatures(projectId);

  const priorArt = await getPriorArtResults(patentApplicationId);

  const analysisId = await createFeatureAnalysis(
    projectId,
    patentApplicationId,
    userId
  );

  await createFeatureMappings(
    projectId,
    patentApplicationId,
    analysisId,
    features.features
  );

  // Load invention description from patent application + project README for grounding
  let inventionDescription = '';
  let readmeContent = '';
  try {
    const { data: app } = await (supabase as any)
      .from('patent_applications')
      .select('title, invention_description, detailed_description, metadata')
      .eq('id', patentApplicationId)
      .maybeSingle();
    if (app?.invention_description) inventionDescription = app.invention_description;
    else if (app?.detailed_description) inventionDescription = app.detailed_description;

    const { data: project } = await (supabase as any)
      .from('projects')
      .select('source_metadata, analysis_summary')
      .eq('id', projectId)
      .maybeSingle();
    if (project?.source_metadata?.readmeContent) {
      readmeContent = project.source_metadata.readmeContent;
      inventionDescription += `\n\n--- PROJECT README ---\n${readmeContent}\n--- END README ---`;
    }
    if (project?.analysis_summary) {
      inventionDescription += `\n\nAnalysis Summary: ${project.analysis_summary}`;
    }

    // Load existing Alice risk score if available
    var aliceRiskScore: number | undefined;
    if (app?.metadata?.alice_risk_score != null) {
      aliceRiskScore = Number(app.metadata.alice_risk_score);
    }
  } catch { /* continue with whatever we have */ }

  const aiAssessment = await generateAINoveltyAssessment(
    features.features,
    priorArt,
    projectId,
    inventionDescription,
    readmeContent
  );

  const overallScore = calculateNoveltyScore(features.features, priorArt, aiAssessment.scores);
  const approvalProbability = calculateApprovalProbability(overallScore, aiAssessment, priorArt, features.features, aliceRiskScore);

  await updateAnalysisScores(analysisId, overallScore, approvalProbability, aiAssessment);

  await (supabase as any)
    .from('patent_applications')
    .update({
      novelty_analysis_id: analysisId,
      novelty_score: overallScore
    })
    .eq('id', patentApplicationId);

  return {
    analysisId,
    overallScore,
    approvalProbability,
    strengths: aiAssessment.strengths,
    weaknesses: aiAssessment.weaknesses,
    recommendations: aiAssessment.recommendations,
    featureNoveltyScores: calculateFeatureScores(features.features),
    patentabilityAssessment: aiAssessment.assessment
  };
}

async function generateAINoveltyAssessment(
  features: any[],
  priorArt: any[],
  _projectId: string,
  inventionDescription: string = '',
  readmeContent: string = ''
): Promise<any> {
  const featuresText = features.map((f, i) => `${i + 1}. ${f.name} (${f.noveltyStrength} novelty)
   Description: ${f.description}
   Technical Details: ${f.technicalDetails}
   Core Innovation: ${f.isCoreInnovation ? 'Yes' : 'No'}`).join('\n\n');

  const priorArtText = priorArt.length > 0
    ? priorArt.map((pa, i) => `${i + 1}. ${pa.patent_number} - ${pa.patent_title}
   Abstract: ${pa.patent_abstract}
   Relevance: ${pa.relevance_score}/100
   Technical Similarity: ${pa.similarity_score ?? 'N/A'}/100
   Relationship: ${pa.relationship_type}
   Blocking: ${pa.is_blocking ? 'YES' : 'No'}
   Claim Overlap: ${pa.claim_overlap_analysis || 'None identified'}`).join('\n\n')
    : 'No prior art identified yet.';

  try {
    const prompt = buildNoveltyAnalysisPrompt({
      title: 'Patent Novelty Analysis',
      features: featuresText,
      priorArt: priorArtText,
      inventionDescription: inventionDescription || 'No invention description available.',
      readmeContent,
    });

    const response = await generateText(prompt, 'patent_novelty_analysis', { temperature: 0.7 });

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      // Clamp AI scores to 0-100 range
      if (parsed.scores) {
        for (const key of ['novelty_102', 'non_obviousness_103', 'technical_depth', 'prior_art_differentiation']) {
          if (parsed.scores[key]?.score !== undefined) {
            parsed.scores[key].score = Math.min(Math.max(Number(parsed.scores[key].score) || 0, 0), 100);
          }
        }
      }
      return parsed;
    }
  } catch (error) {
    console.error('AI novelty assessment failed:', error);
  }

  // Return null scores so the caller knows AI failed — no fake numbers
  return {
    scores: null,
    strengths: [
      'Technical implementation details are present in the codebase',
      'Features were extracted from actual source code'
    ],
    weaknesses: [
      'AI-powered novelty assessment could not be completed — manual review is required',
      'Prior art comparison may be incomplete',
      'Novelty ratings are preliminary and have not been validated against patent databases'
    ],
    recommendations: [
      'Conduct a manual prior art search using USPTO PatFT/AppFT or Google Patents',
      'Consult a patent attorney to validate novelty claims before filing',
      'Review each extracted feature against known solutions in the technical domain',
      'Add specific performance metrics and benchmarks to strengthen the application',
      'Ensure the README clearly describes what makes this software different from existing solutions'
    ],
    assessment: 'Automated novelty assessment could not be completed. The extracted features require manual review by a qualified patent professional to determine patentability.'
  };
}

function calculateNoveltyScore(features: any[], priorArt: any[], aiScores?: {
  novelty_102: { score: number };
  non_obviousness_103: { score: number };
  technical_depth: { score: number };
  prior_art_differentiation: { score: number };
}): number {
  const priorArtSearched = priorArt.length > 0;

  // --- Heuristic component (retained as safety net / sanity bound) ---
  let heuristic = 30;

  const strongFeatures = features.filter((f: any) => f.noveltyStrength === 'strong').length;
  const moderateFeatures = features.filter((f: any) => f.noveltyStrength === 'moderate').length;
  const weakFeatures = features.filter((f: any) => f.noveltyStrength === 'weak').length;
  const coreInnovations = features.filter((f: any) => f.isCoreInnovation).length;

  heuristic += strongFeatures * 6;
  heuristic += moderateFeatures * 3;
  // Cap core innovation bonus to avoid inflation when all features are flagged as core
  heuristic += Math.min(coreInnovations * 4, 12);
  heuristic -= weakFeatures * 1;

  if (priorArtSearched) {
    const highRelevanceArt = priorArt.filter((pa: any) => pa.relevance_score >= 80 || pa.relevance_score >= 0.8);
    const blockingPriorArt = priorArt.filter((pa: any) => pa.is_blocking).length;

    // Use actual similarity scores: weight by mean similarity of high-relevance art
    const avgSimilarity = highRelevanceArt.length > 0
      ? highRelevanceArt.reduce((sum: number, pa: any) => sum + (Number(pa.similarity_score) || Number(pa.relevance_score) || 50), 0) / highRelevanceArt.length
      : 0;

    heuristic -= highRelevanceArt.length * 7;
    heuristic -= blockingPriorArt * 15;
    heuristic -= Math.round(avgSimilarity * 0.1); // Scale penalty by actual similarity
    // No bonus for finding irrelevant art — that's noise, not signal
  } else {
    heuristic = Math.min(heuristic, 50);
  }

  heuristic = Math.min(Math.max(heuristic, 0), 100);

  // --- AI component: blend 60% AI composite + 40% heuristic ---
  if (aiScores?.novelty_102 && aiScores?.non_obviousness_103 && aiScores?.technical_depth && aiScores?.prior_art_differentiation) {
    const aiComposite = (
      aiScores.novelty_102.score * 0.35 +
      aiScores.non_obviousness_103.score * 0.30 +
      aiScores.technical_depth.score * 0.15 +
      aiScores.prior_art_differentiation.score * 0.20
    );
    return Math.min(Math.max(Math.round(0.6 * aiComposite + 0.4 * heuristic), 0), 100);
  }

  // Fallback: pure heuristic if AI scores unavailable
  return heuristic;
}

function calculateApprovalProbability(
  noveltyScore: number,
  assessment: any,
  priorArt: any[],
  features: any[],
  aliceRiskScore?: number
): number {
  // Factor 1: Novelty foundation (0-25) — limited influence, not the dominant factor
  const noveltyFactor = noveltyScore * 0.25;

  // Factor 2: Prior art landscape clarity (0-25)
  let priorArtFactor = 15; // base if no prior art searched
  if (priorArt.length > 0) {
    const blockingCount = priorArt.filter((pa: any) => pa.is_blocking).length;
    const avgRelevance = priorArt.reduce((sum: number, pa: any) => sum + (Number(pa.relevance_score) || 50), 0) / priorArt.length;
    priorArtFactor = Math.round(25 * (1 - avgRelevance / 100) * (blockingCount === 0 ? 1 : 0.3));
  }

  // Factor 3: Specification completeness proxy (0-20)
  const strongOrCore = features.filter((f: any) => f.noveltyStrength === 'strong' || f.isCoreInnovation).length;
  const specFactor = Math.min(strongOrCore * 5, 20);

  // Factor 4: Alice/101 eligibility (0-20) — inverted risk score
  let aliceFactor = 10; // default moderate if not yet assessed
  if (aliceRiskScore !== undefined && aliceRiskScore !== null) {
    aliceFactor = Math.round(20 * (1 - aliceRiskScore / 100));
  }

  // Factor 5: Quality of AI assessment (0-10)
  let qualityFactor = 0;
  const hasSubstantiveStrengths = assessment.strengths?.some(
    (s: string) => s.length > 60 && !s.includes('could not be completed')
  );
  if (hasSubstantiveStrengths && assessment.strengths.length >= 3) qualityFactor += 5;
  if (assessment.scores?.novelty_102?.score >= 70 && assessment.scores?.non_obviousness_103?.score >= 60) {
    qualityFactor += 5;
  }
  if (assessment.weaknesses?.length >= 4) qualityFactor -= 3;

  const probability = noveltyFactor + priorArtFactor + specFactor + aliceFactor + qualityFactor;
  return Math.min(Math.max(Math.round(probability), 0), 100);
}

function calculateFeatureScores(features: any[]): Record<string, number> {
  const scores: Record<string, number> = {};
  const baseScores: Record<string, number> = { strong: 85, moderate: 65, weak: 40 };

  features.forEach(feature => {
    let score = baseScores[feature.noveltyStrength] || 50;

    if (feature.isCoreInnovation) {
      score += 10;
    }

    scores[feature.name] = Math.min(score, 100);
  });

  return scores;
}

async function updateAnalysisScores(
  analysisId: string,
  noveltyScore: number,
  approvalProbability: number,
  aiAssessment: any
): Promise<void> {
  await (supabase as any)
    .from('patent_novelty_analyses')
    .update({
      overall_score: noveltyScore,
      approval_probability: approvalProbability,
      strength_rating: noveltyScore >= 70 ? 'strong' : noveltyScore >= 40 ? 'moderate' : 'weak',
      analysis_data: {
        strengths: aiAssessment.strengths || [],
        weaknesses: aiAssessment.weaknesses || [],
        recommendations: aiAssessment.recommendations || [],
        assessment: aiAssessment.assessment || '',
        ai_scores: aiAssessment.scores || null,
      }
    })
    .eq('id', analysisId);
}

export async function getNoveltyAnalysis(
  patentApplicationId: string
): Promise<any | null> {
  const { data: app } = await (supabase as any)
    .from('patent_applications')
    .select('novelty_analysis_id, novelty_score')
    .eq('id', patentApplicationId)
    .maybeSingle();

  if (!app || !app.novelty_analysis_id) {
    return null;
  }

  const { data: analysis } = await (supabase as any)
    .from('patent_novelty_analyses')
    .select('*')
    .eq('id', app.novelty_analysis_id)
    .maybeSingle();

  if (!analysis) {
    return null;
  }

  // Feature data is stored in analysis_data JSONB
  const analysisData = analysis.analysis_data || {};
  const extractedFeatures = analysisData.extracted_features || [];

  const keyFeatures = extractedFeatures.map((feature: any) => ({
    feature_name: feature.name,
    description: feature.description,
    novelty_score: calculateIndividualFeatureScore(feature.noveltyStrength || feature.novelty_strength)
  }));

  return {
    id: analysis.id,
    overall_novelty_score: analysis.overall_score || app.novelty_score || 0,
    confidence_score: (analysis.approval_probability || 0) / 100,
    technical_depth_score: analysisData.ai_scores?.technical_depth?.score ?? 0,
    implementation_uniqueness_score: analysisData.ai_scores?.prior_art_differentiation?.score ?? 0,
    commercial_viability_score: analysisData.ai_scores?.non_obviousness_103?.score ?? 0,
    patentability_assessment: analysisData.assessment || '',
    novelty_strengths: analysisData.strengths || [],
    novelty_weaknesses: analysisData.weaknesses || [],
    recommendations: analysisData.recommendations || [],
    key_features: keyFeatures,
    extracted_features: extractedFeatures,
    ai_dimensional_scores: analysisData.ai_scores || null,
  };
}

function calculateIndividualFeatureScore(noveltyStrength: string): number {
  const scoreMap: Record<string, number> = {
    'strong': 85,
    'moderate': 65,
    'weak': 40
  };
  return scoreMap[noveltyStrength] || 50;
}

export async function performAliceRiskAssessment(
  patentApplicationId: string,
  _projectId: string
): Promise<AliceRiskAssessment> {
  const { data: app } = await (supabase as any)
    .from('patent_applications')
    .select('title, summary_invention, invention_description')
    .eq('id', patentApplicationId)
    .maybeSingle();

  const { data: claims } = await (supabase as any)
    .from('patent_claims')
    .select('claim_number, claim_text, claim_type')
    .eq('application_id', patentApplicationId)
    .order('claim_number');

  const { data: features } = await (supabase as any)
    .from('patent_feature_mappings')
    .select('feature_name, technical_description, novelty_strength')
    .eq('application_id', patentApplicationId);

  if (!claims || claims.length === 0) {
    return getDefaultAliceAssessment('No claims found to analyze');
  }

  const claimsText = claims
    .map((c: any) => `Claim ${c.claim_number} (${c.claim_type}): ${c.claim_text}`)
    .join('\n\n');

  const featuresText = (features || [])
    .map((f: any) => `- ${f.feature_name}: ${f.technical_description} (${f.novelty_strength})`)
    .join('\n');

  const promptTemplate = PATENT_PROMPT_TEMPLATES.patent_alice_risk_assessment;
  if (!promptTemplate) {
    return getDefaultAliceAssessment('Alice risk assessment prompt not found');
  }

  const prompt = promptTemplate.content
    .replace('${title}', app?.title || 'Unknown')
    .replace('${claims}', claimsText)
    .replace('${features}', featuresText || 'No features extracted')
    .replace('${inventionDescription}', app?.invention_description || app?.summary_invention || '');

  try {
    const response = await generateText(prompt, 'patent_alice_risk_assessment');
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const riskScore = parsed.overallAliceRiskScore || 50;

      // Cache Alice risk score in application metadata for use by approval probability
      try {
        const { data: existingApp } = await (supabase as any)
          .from('patent_applications')
          .select('metadata')
          .eq('id', patentApplicationId)
          .maybeSingle();
        const existingMeta = (existingApp?.metadata || {}) as Record<string, unknown>;
        await (supabase as any)
          .from('patent_applications')
          .update({ metadata: { ...existingMeta, alice_risk_score: riskScore } })
          .eq('id', patentApplicationId);
      } catch { /* non-critical */ }

      return {
        overallAliceRiskScore: riskScore,
        riskLevel: getRiskLevel(riskScore),
        claimAnalysis: parsed.claimAnalysis || [],
        overallStrengths: parsed.overallStrengths || [],
        overallWeaknesses: parsed.overallWeaknesses || [],
        recommendedImprovements: parsed.recommendedImprovements || [],
        summary: parsed.summary || ''
      };
    }
  } catch (error) {
    console.error('Alice risk assessment failed:', error);
  }

  return getDefaultAliceAssessment('Analysis could not be completed');
}

function getRiskLevel(score: number): 'Low' | 'Medium' | 'High' {
  if (score <= 35) return 'Low';
  if (score <= 65) return 'Medium';
  return 'High';
}

function getDefaultAliceAssessment(reason: string): AliceRiskAssessment {
  return {
    overallAliceRiskScore: 50,
    riskLevel: 'Medium',
    claimAnalysis: [],
    overallStrengths: [
      'Technical implementation details present',
      'Specific data structures referenced'
    ],
    overallWeaknesses: [
      reason,
      'Manual review recommended'
    ],
    recommendedImprovements: [
      'Ensure claims reference specific hardware components',
      'Include mathematical formulas or algorithms',
      'Avoid abstract business method language'
    ],
    summary: `Alice risk assessment requires manual review. ${reason}`
  };
}
