/**
 * Frontend client for the Netlify serverless patent search function.
 * Calls /.netlify/functions/search-patents which proxies to Serper.dev.
 */

export interface SerperPatentResult {
  title: string;
  snippet: string;
  patentNumber: string;
  link: string;
  date?: string;
  inventor?: string;
  assignee?: string;
  thumbnailUrl?: string;
}

export interface PatentSearchResponse {
  patents: SerperPatentResult[];
  query: string;
  source: 'serper';
}

export async function fetchRealPatents(params: {
  title: string;
  description: string;
  keywords?: string[];
  maxResults?: number;
  queries?: string[];
}): Promise<SerperPatentResult[]> {
  try {
    const response = await fetch('/.netlify/functions/search-patents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      if (err.fallback) {
        console.warn('Patent search API unavailable, falling back to AI-only:', err.error);
        return [];
      }
      throw new Error(err.error || `Search failed: ${response.status}`);
    }

    const data: PatentSearchResponse = await response.json();
    return data.patents || [];
  } catch (err: any) {
    if (err.name === 'TimeoutError') {
      console.warn('Patent search timed out, falling back to AI-only');
      return [];
    }
    console.warn('Patent search failed, falling back to AI-only:', err.message);
    return [];
  }
}
