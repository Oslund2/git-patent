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
 * Phase A — Real search via Serper.dev (Google Patents)
 * Phase B — AI analysis of real results for relevance scoring
 */
async function searchGooglePatents(params: PriorArtSearchParams, _projectId: string): Promise<PriorArtResult[]> {
  // Phase A: Fetch real patents from Google Patents via Serper
  console.log('Searching Google Patents via Serper.dev...');
  const realPatents = await fetchRealPatents({
    title: params.title,
    description: params.description,
    keywords: params.keywords,
    maxResults: params.maxResults || 10,
  });

  if (realPatents.length === 0) {
    console.warn('No results from Serper (API may not be configured). Returning empty results.');
    return [];
  }

  console.log(`Found ${realPatents.length} real patents from Google Patents`);

  // Phase B: Use AI to analyze relevance of real results
  const analyzed = await analyzePatentRelevance(realPatents, params);
  return analyzed;
}

/**
 * AI analyzes REAL patent data for relevance to the invention.
 * The AI does NOT invent patents — it only scores and analyzes patents already found.
 */
async function analyzePatentRelevance(
  realPatents: SerperPatentResult[],
  params: PriorArtSearchParams
): Promise<PriorArtResult[]> {
  // Format real patents for the AI prompt
  const patentList = realPatents.map((p, i) =>
    `${i + 1}. Patent: ${p.patentNumber}\n   Title: ${p.title}\n   Snippet: ${p.snippet}\n   Assignee: ${p.assignee || 'Unknown'}\n   Date: ${p.date || 'Unknown'}\n   URL: ${p.link}`
  ).join('\n\n');

  const analysisPrompt = `You are a patent examiner. Analyze the following REAL patents found via Google Patents for relevance to an invention.

INVENTION TITLE: ${params.title}
INVENTION DESCRIPTION: ${params.description}

REAL PATENTS FOUND (these are verified Google Patents results — do NOT modify patent numbers, titles, or URLs):
${patentList}

For EACH patent above, provide a relevance analysis as a JSON array. Use the EXACT patent numbers and titles from above. Add these analysis fields:
- patentNumber: (copy exactly from above)
- title: (copy exactly from above)
- abstract: The snippet from above (copy it)
- assignee: (copy from above)
- url: (copy from above)
- date: (copy from above)
- relevanceScore: 0-100, how relevant to the invention
- technicalSimilarityScore: 0-100, technical similarity of approach
- similarityExplanation: 2-3 sentences on similarity and key differences
- relationshipType: "similar" | "improvement" | "different_approach" | "unrelated"
- isBlocking: boolean, could this patent's claims block the invention?
- threatenedClaims: array of integers (claim numbers that may overlap), or empty array
- claimOverlapAnalysis: brief explanation of overlap, or empty string

Respond with ONLY a JSON array containing one object per patent. Do NOT add patents not listed above.`;

  try {
    const response = await generateText(analysisPrompt, 'patent_prior_art_search');
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.warn('AI analysis returned no JSON, using unscored results');
      return realPatents.map(mapSerperToResult);
    }

    const analyzed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(analyzed) || analyzed.length === 0) {
      return realPatents.map(mapSerperToResult);
    }

    return analyzed.map((a: any, i: number) => {
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
        relevanceScore: a.relevanceScore ?? 50,
        technicalSimilarityScore: a.technicalSimilarityScore ?? 50,
        similarityExplanation: a.similarityExplanation || '',
        relationshipType: a.relationshipType || 'unrelated',
        isBlocking: a.isBlocking || false,
        threatenedClaims: a.threatenedClaims || [],
        claimOverlapAnalysis: a.claimOverlapAnalysis || '',
      };
    });
  } catch (err) {
    console.error('AI analysis failed, returning unscored results:', err);
    return realPatents.map(mapSerperToResult);
  }
}

/** Map a raw Serper result to PriorArtResult with default scores */
function mapSerperToResult(p: SerperPatentResult): PriorArtResult {
  return {
    patentNumber: p.patentNumber || 'UNKNOWN',
    title: p.title,
    abstract: p.snippet,
    filingDate: p.date ? new Date(p.date) : undefined,
    assignee: p.assignee || '',
    inventors: p.inventor ? [p.inventor] : [],
    url: p.link,
    relevanceScore: 50,
    technicalSimilarityScore: 50,
    similarityExplanation: '',
    relationshipType: 'unrelated',
    isBlocking: false,
    threatenedClaims: [],
    claimOverlapAnalysis: '',
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
${features.map((f, i) => `${i + 1}. ${f.name}: ${f.description}`).join('\n')}

Identified Prior Art:
${priorArt.map((pa, i) => `${i + 1}. ${pa.patent_number} - ${pa.patent_title}\n   ${pa.patent_abstract}`).join('\n\n')}

Create a detailed comparison that:
1. Shows what each prior art patent covers
2. Identifies gaps in prior art that our invention fills
3. Highlights novel combinations of features
4. Explains why the invention is non-obvious
5. Quantifies improvements over prior art

Format as professional patent language suitable for USPTO submission.`;

  return await generateText(prompt, 'patent_prior_art_comparison');
}
