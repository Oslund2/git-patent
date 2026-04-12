import { supabase } from '../../lib/supabase';
import { generateText } from '../ai/geminiService';
import { fetchRealPatents, type SerperPatentResult } from './patentSearchApi';

export interface PriorArtSearchParams {
  title: string;
  description: string;
  keywords?: string[];
  maxResults?: number;
  analysisTarget?: 'patent_management' | 'general' | 'both';
}

export interface PriorArtResult {
  patentNumber: string;
  title: string;
  abstract: string;
  filingDate?: Date;
  grantDate?: Date;
  assignee?: string;
  inventors?: string[];
  url: string;
  relevanceScore: number;
  technicalSimilarityScore: number;
  similarityExplanation: string;
  relationshipType: 'similar' | 'improvement' | 'different_approach' | 'unrelated';
  isBlocking: boolean;
  threatenedClaims?: number[];
  claimOverlapAnalysis?: string;
  redFlags?: string[];
  riskLevel?: 'critical' | 'high' | 'moderate' | 'low' | 'none';
}

export async function searchPriorArt(
  projectId: string,
  patentApplicationId: string,
  params: PriorArtSearchParams
): Promise<PriorArtResult[]> {
  let results: PriorArtResult[] = [];

  try {
    console.log('Starting prior art search for:', params.title);
    const googleResults = await searchGooglePatents(params, projectId);
    results.push(...googleResults);
    console.log(`Found ${results.length} prior art results`);
  } catch (error) {
    console.error('Google Patents search failed, using default results:', error);
    results = getDefaultPriorArt();
  }

  if (results.length === 0) {
    console.log('No results from search, using default prior art');
    results = getDefaultPriorArt();
  }

  await savePriorArtResults(projectId, patentApplicationId, results, params.title);

  return results;
}

/**
 * Two-phase prior art search:
 * Phase A — Multi-query real search via Serper.dev (Google Patents)
 * Phase B — AI analysis of real results for relevance scoring + red flags
 */
async function searchGooglePatents(params: PriorArtSearchParams, projectId: string): Promise<PriorArtResult[]> {
  // Build targeted queries from extracted features
  const queries = await buildSearchQueries(params, projectId);
  console.log(`Searching Google Patents with ${queries.length} targeted queries`);

  // Phase A: Fetch real patents from Google Patents via Serper (multi-query)
  const realPatents = await fetchRealPatents({
    title: params.title,
    description: params.description,
    keywords: params.keywords,
    maxResults: 15,
    queries,
  });

  if (realPatents.length === 0) {
    console.warn('No results from Serper (API may not be configured). Returning empty results.');
    return [];
  }

  console.log(`Found ${realPatents.length} unique patents from Google Patents`);

  // Cap at 10 for AI analysis to stay within Netlify function timeout (~26s)
  const capped = realPatents.slice(0, 10);

  // Phase B: Use AI to analyze relevance of real results
  // If AI fails, fall back to raw Serper results so user always sees prior art
  const analyzed = await analyzePatentRelevance(capped, params);
  if (analyzed.length === 0 && capped.length > 0) {
    console.warn('AI analysis returned no results — using unscored Serper results as fallback');
    return capped.map(mapSerperToResult);
  }
  return analyzed;
}

/**
 * Build up to 5 targeted search queries from extracted features for thorough coverage.
 */
async function buildSearchQueries(params: PriorArtSearchParams, projectId: string): Promise<string[]> {
  try {
    const { data: featureRows } = await (supabase as any)
      .from('extracted_features')
      .select('name, type, description, novelty_strength, is_core_innovation')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    const features = featureRows || [];
    const coreFeatures = features.filter((f: any) => f.is_core_innovation || f.novelty_strength === 'strong');
    const topFeatureNames = coreFeatures.slice(0, 4).map((f: any) => f.name);

    // Q1: Title + core feature names (broad coverage)
    const q1 = [params.title, ...topFeatureNames.slice(0, 2)].join(' ');

    // Q2: Technical mechanism terms (no product name, just the technique)
    const mechanismTerms = coreFeatures
      .slice(0, 2)
      .map((f: any) => `${f.name} ${(f.description || '').split('.')[0]}`)
      .join(' ')
      .slice(0, 200);
    // Avoid duplicating Q1 when features are empty — fall back to description snippet
    const q2 = mechanismTerms || (params.description || '').slice(0, 150).trim() || params.title;

    // Q3: Problem/solution from description + keywords
    const descClean = (params.description || '').slice(0, 200).trim();
    const kwStr = (params.keywords || []).slice(0, 5).join(' ');
    const q3 = [descClean, kwStr].filter(Boolean).join(' ') || params.title;

    // Q4: Remaining feature names that weren't in Q1 (different technical angle)
    const remainingFeatures = features.slice(2, 5).map((f: any) => f.name).join(' ');
    const q4 = remainingFeatures
      ? `${remainingFeatures} ${(params.keywords || []).slice(0, 2).join(' ')}`.trim()
      : null;

    // Q5: CPC-classification-guided query if available
    let q5: string | null = null;
    try {
      const { data: appRow } = await (supabase as any)
        .from('patent_applications')
        .select('cpc_classification')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      const cpcPrimary = appRow?.cpc_classification?.primary;
      if (cpcPrimary) {
        q5 = [cpcPrimary, ...topFeatureNames.slice(0, 2)].join(' ');
      }
    } catch { /* non-critical */ }

    const queries = [q1, q2, q3, q4, q5].filter((q): q is string => !!q);
    // Deduplicate queries
    const unique = [...new Set(queries)];
    console.log(`Search queries (${unique.length}):`, unique.map(q => q.slice(0, 80)));
    return unique;
  } catch (err) {
    console.warn('Failed to build targeted queries, using title-only fallback:', err);
    return [params.title];
  }
}

/**
 * AI analyzes REAL patent data for relevance to the invention.
 * The AI does NOT invent patents — it only scores and analyzes patents already found.
 */
async function analyzePatentRelevance(
  realPatents: SerperPatentResult[],
  params: PriorArtSearchParams
): Promise<PriorArtResult[]> {
  // Format real patents for the AI prompt — keep concise to fit within timeout
  const patentList = realPatents.map((p, i) =>
    `${i + 1}. [${p.patentNumber}] "${p.title}" — ${(p.snippet || '').slice(0, 200)} (${p.assignee || 'Unknown'}, ${p.date || 'Unknown'}) ${p.link}`
  ).join('\n');

  const analysisPrompt = `Analyze these patents for relevance to: "${params.title}"
Description: ${(params.description || '').slice(0, 500)}

PATENTS:
${patentList}

For EACH patent, return a JSON array. Copy patentNumber/title/url exactly. Add:
- relevanceScore: 0-100 (0-20 if no technical overlap, 50+ for real overlap)
- technicalSimilarityScore: 0-100
- similarityExplanation: 1-2 sentences
- relationshipType: "similar"|"improvement"|"different_approach"|"unrelated"
- isBlocking: boolean (true ONLY if claims literally read on the invention)
- riskLevel: "critical"|"high"|"moderate"|"low"|"none"
- redFlags: array of specific risk sentences (empty if low/none)

Be strict: score 0-20 for different domains. Only isBlocking if claims directly overlap.
Respond with ONLY a JSON array.`;

  try {
    const response = await generateText(analysisPrompt, 'patent_prior_art_search', { temperature: 0.5 });
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.warn('AI analysis returned no JSON, using unscored results');
      return realPatents.map(mapSerperToResult);
    }

    const analyzed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(analyzed) || analyzed.length === 0) {
      return realPatents.map(mapSerperToResult);
    }

    const mapped = analyzed.map((a: any, i: number) => {
      const original = realPatents[i] || realPatents.find(p => p.patentNumber === a.patentNumber);
      return {
        patentNumber: a.patentNumber || original?.patentNumber || 'UNKNOWN',
        title: a.title || original?.title || '',
        abstract: a.abstract || original?.snippet || '',
        filingDate: a.date ? new Date(a.date) : undefined,
        grantDate: undefined,
        assignee: a.assignee || original?.assignee || '',
        inventors: typeof a.inventors === 'string' ? [a.inventors] : (a.inventors || (original?.inventor ? [original.inventor] : [])),
        url: a.url || original?.link || '',
        relevanceScore: a.relevanceScore ?? 0,
        technicalSimilarityScore: a.technicalSimilarityScore ?? 0,
        similarityExplanation: a.similarityExplanation || '',
        relationshipType: a.relationshipType || 'unrelated',
        isBlocking: a.isBlocking || false,
        threatenedClaims: a.threatenedClaims || [],
        claimOverlapAnalysis: a.claimOverlapAnalysis || '',
        redFlags: Array.isArray(a.redFlags) ? a.redFlags : [],
        riskLevel: a.riskLevel || 'none',
      };
    });

    // Filter out irrelevant results (relevance < 20)
    const filtered = mapped.filter(r => r.relevanceScore >= 20 || r.isBlocking);
    console.log(`AI analysis: ${mapped.length} scored, ${filtered.length} above relevance threshold`);
    // If AI scored everything below threshold, keep top 5 by relevance anyway
    if (filtered.length === 0 && mapped.length > 0) {
      console.warn('All patents scored below threshold — keeping top 5 by relevance');
      return mapped.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, 5);
    }
    return filtered;
  } catch (err) {
    console.error('AI analysis failed, returning unscored Serper results as fallback:', err);
    return realPatents.map(mapSerperToResult);
  }
}

/** Map a raw Serper result to PriorArtResult with default scores.
 *  Uses relevanceScore=30 (above the 20 save threshold) so results are preserved. */
function mapSerperToResult(p: SerperPatentResult): PriorArtResult {
  return {
    patentNumber: p.patentNumber || 'UNKNOWN',
    title: p.title,
    abstract: p.snippet,
    filingDate: p.date ? new Date(p.date) : undefined,
    assignee: p.assignee || '',
    inventors: p.inventor ? [p.inventor] : [],
    url: p.link,
    relevanceScore: 30,
    technicalSimilarityScore: 30,
    similarityExplanation: 'AI relevance analysis was not completed — this is a raw search result from Google Patents. Review manually.',
    relationshipType: 'similar',
    isBlocking: false,
    threatenedClaims: [],
    claimOverlapAnalysis: '',
    riskLevel: 'low',
  };
}

function getDefaultPriorArt(): PriorArtResult[] {
  // Return empty — no hardcoded fallback results.
  // If AI search fails, the user sees an empty state with option to retry.
  return [];
}


async function savePriorArtResults(
  projectId: string,
  patentApplicationId: string,
  results: PriorArtResult[],
  searchQuery: string
): Promise<void> {
  const uniqueResults = results.filter((result, index, self) =>
    index === self.findIndex(r => r.patentNumber === result.patentNumber)
  );

  console.log(`Deduplicating prior art: ${results.length} -> ${uniqueResults.length} unique results`);

  await (supabase as any)
    .from('patent_prior_art_results')
    .delete()
    .eq('application_id', patentApplicationId);

  if (uniqueResults.length === 0) {
    console.log('No prior art results to save, skipping insert');
    // Still update the application status
    await (supabase as any)
      .from('patent_applications')
      .update({
        prior_art_search_status: 'completed',
        prior_art_search_completed_at: new Date().toISOString()
      })
      .eq('id', patentApplicationId);
    return;
  }

  // Map to actual schema: id, application_id, patent_number, title, abstract,
  // relevance_score, similarity_score, source, metadata, created_at
  const records = uniqueResults.map(result => ({
    application_id: patentApplicationId,
    patent_number: result.patentNumber,
    title: result.title,
    abstract: result.abstract,
    relevance_score: result.relevanceScore,
    similarity_score: result.technicalSimilarityScore || result.relevanceScore,
    source: 'google_patents',
    metadata: {
      search_query: searchQuery,
      project_id: projectId,
      filing_date: result.filingDate || null,
      grant_date: result.grantDate || null,
      assignee: result.assignee,
      inventors: result.inventors,
      url: result.url,
      similarity_explanation: result.similarityExplanation,
      relationship_type: result.relationshipType,
      is_blocking: result.isBlocking,
      threatened_claims: result.threatenedClaims || [],
      claim_overlap_analysis: result.claimOverlapAnalysis || '',
      red_flags: result.redFlags || [],
      risk_level: result.riskLevel || 'none',
    }
  }));

  const { error } = await (supabase as any)
    .from('patent_prior_art_results')
    .insert(records);

  if (error) {
    console.error('Failed to save prior art results:', error);
    // Don't throw — allow the pipeline to continue even if save fails
  }

  await (supabase as any)
    .from('patent_applications')
    .update({
      prior_art_search_status: 'completed',
      prior_art_search_completed_at: new Date().toISOString()
    })
    .eq('id', patentApplicationId);
}

export async function getPriorArtResults(
  patentApplicationId: string
): Promise<any[]> {
  const { data, error } = await (supabase as any)
    .from('patent_prior_art_results')
    .select('*')
    .eq('application_id', patentApplicationId)
    .order('relevance_score', { ascending: false });

  if (error) throw error;

  // Map database columns to UI-expected field names
  const meta = (r: any) => r.metadata || {};
  return (data || []).map((result: any) => ({
    ...result,
    patent_number: result.patent_number,
    patent_title: result.title,
    patent_abstract: result.abstract,
    assignee: meta(result).assignee,
    relevance_score: result.relevance_score,
    similarity_score: result.similarity_score,
    similarity_explanation: meta(result).similarity_explanation || '',
    relationship_type: meta(result).relationship_type || '',
    is_blocking: meta(result).is_blocking || false,
    threatened_claims: meta(result).threatened_claims || [],
    claim_overlap_analysis: meta(result).claim_overlap_analysis || '',
    url: meta(result).url || '',
    red_flags: meta(result).red_flags || [],
    risk_level: meta(result).risk_level || 'none',
    filing_date: meta(result).filing_date || null,
    inventors: meta(result).inventors || [],
  }));
}

export async function addManualPriorArt(
  projectId: string,
  patentApplicationId: string,
  patentNumber: string,
  userNotes?: string
): Promise<string> {
  const { data, error } = await (supabase as any)
    .from('patent_prior_art_results')
    .insert({
      application_id: patentApplicationId,
      patent_number: patentNumber,
      title: 'Manually Added Patent',
      source: 'manual',
      metadata: {
        project_id: projectId,
        url: `https://patents.google.com/patent/${patentNumber.replace(/[^A-Z0-9]/g, '')}`,
        user_notes: userNotes,
        user_marked_relevant: true,
      }
    })
    .select()
    .single();

  if (error) throw error;
  return data.id;
}

export async function updatePriorArtRelevance(
  priorArtId: string,
  isRelevant: boolean,
  notes?: string
): Promise<void> {
  const { error } = await (supabase as any)
    .from('patent_prior_art_results')
    .update({
      user_marked_relevant: isRelevant,
      included_in_application: isRelevant,
      user_notes: notes
    })
    .eq('id', priorArtId);

  if (error) throw error;
}

export async function generatePriorArtComparison(
  patentApplicationId: string,
  features: any[]
): Promise<string> {
  const priorArt = await getPriorArtResults(patentApplicationId);

  const prompt = `Generate a comprehensive prior art comparison for a patent application.

Current Invention Features:
${features.length > 0
    ? features.map((f: any, i: number) => `${i + 1}. ${f.name}: ${f.description}`).join('\n')
    : 'Features not available — base analysis on prior art details below.'}

Identified Prior Art:
${priorArt.map((pa: any, i: number) => `${i + 1}. [${pa.risk_level || 'low'}] ${pa.patent_number} — ${pa.patent_title || pa.title}
   Abstract: ${pa.patent_abstract || pa.abstract || ''}
   Relationship: ${pa.relationship_type || 'unknown'}
   Analysis: ${pa.similarity_explanation || ''}
   ${pa.is_blocking ? 'WARNING: Potential blocking patent' : ''}`).join('\n\n')}

Create a detailed comparison that:
1. Shows what each prior art patent covers and its risk level
2. Identifies gaps in prior art that our invention fills
3. Highlights novel combinations of features
4. Explains why the invention is non-obvious
5. Quantifies improvements over prior art
6. For any blocking or high-risk patents, provide specific design-around strategies

Format as professional patent language suitable for USPTO submission.`;

  return await generateText(prompt, 'patent_prior_art_comparison');
}
