import { supabase } from '../../lib/supabase';
import { generateText } from '../ai/geminiService';
import { extractCodebaseFeatures, createFeatureAnalysis, createFeatureMappings } from './patentFeatureExtractionService';
import { getPriorArtResults } from './patentPriorArtSearchService';

// Inline prompt builder for novelty analysis
function buildNoveltyAnalysisPrompt(vars: {
  title: string;
  features: string;
  priorArt: string;
  inventionDescription: string;
}): string {
  return `You are a patent examiner performing a novelty analysis for a patent application.

INVENTION TITLE: ${vars.title}

INVENTION DESCRIPTION: ${vars.inventionDescription}

EXTRACTED FEATURES:
${vars.features}

PRIOR ART:
${vars.priorArt}

Analyze the novelty of this invention and provide a JSON object with the following fields:
{
  "strengths": ["array of patentability strengths"],
  "weaknesses": ["array of potential weaknesses or concerns"],
  "recommendations": ["array of specific recommendations to strengthen the application"],
  "assessment": "A comprehensive 3-5 sentence patentability assessment covering novelty, non-obviousness, and utility"
}

Consider:
1. Whether individual features are novel over the prior art
2. Whether the combination of features is non-obvious
3. The technical depth and specificity of the implementation
4. Commercial utility and practical application
5. Potential 35 USC 101 (abstract idea) concerns
6. Potential 35 USC 103 (obviousness) concerns

Respond with ONLY the JSON object, no other text.`;
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
  try {
    const { data: app } = await (supabase as any)
      .from('patent_applications')
      .select('title, invention_description, detailed_description')
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
      inventionDescription += `\n\n--- PROJECT README ---\n${project.source_metadata.readmeContent}\n--- END README ---`;
    }
    if (project?.analysis_summary) {
      inventionDescription += `\n\nAnalysis Summary: ${project.analysis_summary}`;
    }
  } catch { /* continue with whatever we have */ }

  const aiAssessment = await generateAINoveltyAssessment(
    features.features,
    priorArt,
    projectId,
    inventionDescription
  );

  const overallScore = calculateNoveltyScore(features.features, priorArt);
  const approvalProbability = calculateApprovalProbability(overallScore, aiAssessment);

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
  inventionDescription: string = ''
): Promise<any> {
  const featuresText = features.map((f, i) => `${i + 1}. ${f.name} (${f.noveltyStrength} novelty)
   Description: ${f.description}
   Technical Details: ${f.technicalDetails}
   Core Innovation: ${f.isCoreInnovation ? 'Yes' : 'No'}`).join('\n\n');

  const priorArtText = priorArt.length > 0
    ? priorArt.map((pa, i) => `${i + 1}. ${pa.patent_number} - ${pa.patent_title}
   Abstract: ${pa.patent_abstract}
   Relevance: ${pa.relevance_score}/100
   Relationship: ${pa.relationship_type}`).join('\n\n')
    : 'No prior art identified yet.';

  try {
    const prompt = buildNoveltyAnalysisPrompt({
      title: 'Patent Novelty Analysis',
      features: featuresText,
      priorArt: priorArtText,
      inventionDescription: inventionDescription || 'No invention description available.'
    });

    const response = await generateText(prompt, 'patent_novelty_analysis');

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error('AI novelty assessment failed:', error);
  }

  return {
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
    assessment: 'Automated novelty assessment could not be completed. The extracted features require manual review by a qualified patent professional to determine patentability. The novelty scores shown are preliminary estimates based on code analysis only and have not been validated against prior art databases.'
  };
}

function calculateNoveltyScore(features: any[], priorArt: any[]): number {
  const priorArtSearched = priorArt.length > 0;

  // Start with a conservative base — novelty must be earned
  let score = 30;

  const strongFeatures = features.filter(f => f.noveltyStrength === 'strong').length;
  const moderateFeatures = features.filter(f => f.noveltyStrength === 'moderate').length;
  const weakFeatures = features.filter(f => f.noveltyStrength === 'weak').length;
  const coreInnovations = features.filter(f => f.isCoreInnovation).length;

  // Feature contributions (reduced from original to avoid inflation)
  score += strongFeatures * 6;
  score += moderateFeatures * 3;
  score += coreInnovations * 4;

  // Weak features slightly reduce confidence (lots of weak = probably not novel)
  score -= weakFeatures * 1;

  // Prior art adjustments
  if (priorArtSearched) {
    const highRelevancePriorArt = priorArt.filter(pa => pa.relevance_score >= 80 || pa.relevance_score >= 0.8).length;
    const blockingPriorArt = priorArt.filter(pa => pa.is_blocking).length;
    const lowRelevancePriorArt = priorArt.filter(pa => (pa.relevance_score < 40 || pa.relevance_score < 0.4) && !pa.is_blocking).length;

    score -= highRelevancePriorArt * 7;
    score -= blockingPriorArt * 15;
    // If prior art was searched and nothing highly relevant was found, that's a positive signal
    score += lowRelevancePriorArt > 0 ? 5 : 0;
  } else {
    // No prior art search was performed — cap the score as preliminary
    score = Math.min(score, 50);
  }

  return Math.min(Math.max(score, 0), 100);
}

function calculateApprovalProbability(noveltyScore: number, assessment: any): number {
  // Approval probability should be conservative — patent approval is never guaranteed
  let probability = noveltyScore * 0.6;

  // Only boost if assessment has substantive strengths (not fallback boilerplate)
  const hasSubstantiveStrengths = assessment.strengths?.some(
    (s: string) => s.length > 60 && !s.includes('could not be completed')
  );
  if (hasSubstantiveStrengths && assessment.strengths.length >= 3) {
    probability += 8;
  }

  // More weaknesses = lower probability
  if (assessment.weaknesses.length >= 3) {
    probability -= 5;
  }

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
    technical_depth_score: 0,
    implementation_uniqueness_score: 0,
    commercial_viability_score: 0,
    patentability_assessment: analysisData.assessment || '',
    novelty_strengths: analysisData.strengths || [],
    novelty_weaknesses: analysisData.weaknesses || [],
    recommendations: analysisData.recommendations || [],
    key_features: keyFeatures,
    extracted_features: extractedFeatures
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
      return {
        overallAliceRiskScore: parsed.overallAliceRiskScore || 50,
        riskLevel: getRiskLevel(parsed.overallAliceRiskScore || 50),
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
