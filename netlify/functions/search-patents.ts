import type { Context } from "@netlify/functions";

interface SearchRequest {
  title: string;
  description: string;
  keywords?: string[];
  maxResults?: number;
  queries?: string[];
}

interface SerperPatentResult {
  title: string;
  snippet: string;
  patentNumber: string;
  link: string;
  date?: string;
  inventor?: string;
  assignee?: string;
  thumbnailUrl?: string;
}

export default async function handler(req: Request, _context: Context) {
  // Only allow POST
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = Netlify.env.get("SERPER_API_KEY");
  if (!apiKey) {
    return new Response(
      JSON.stringify({
        error: "SERPER_API_KEY not configured",
        fallback: true,
      }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  let body: SearchRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!body.title) {
    return new Response(JSON.stringify({ error: "title is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Build search queries: use caller-provided queries or construct a default
  const maxResults = Math.min(body.maxResults || 10, 20);
  const queryList: string[] = [];

  if (body.queries && body.queries.length > 0) {
    queryList.push(...body.queries.slice(0, 3));
  } else {
    // Fallback: single query from title + description + keywords
    const descSnippet = (body.description || "").slice(0, 120).trim();
    const keywordStr = (body.keywords || []).slice(0, 5).join(" ");
    queryList.push([body.title, descSnippet, keywordStr].filter(Boolean).join(" "));
  }

  try {
    // Run all queries in parallel
    const serperResults = await Promise.all(
      queryList.map(async (query) => {
        const resp = await fetch("https://google.serper.dev/patents", {
          method: "POST",
          headers: {
            "X-API-KEY": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ q: query, num: maxResults }),
          signal: AbortSignal.timeout(15000),
        });

        if (!resp.ok) return [];

        const data = await resp.json();
        return (data.organic || data.patents || []).map((item: any) => ({
          title: item.title || "",
          snippet: item.snippet || item.description || "",
          patentNumber: item.patentId || item.patentNumber || extractPatentNumber(item.link) || "",
          link: item.link || "",
          date: item.date || item.filingDate || item.publicationDate || "",
          inventor: item.inventor || item.inventors || "",
          assignee: item.assignee || "",
          thumbnailUrl: item.thumbnailUrl || item.imageUrl || "",
        })) as SerperPatentResult[];
      })
    );

    // Deduplicate by patent number across all queries
    const seen = new Set<string>();
    const patents: SerperPatentResult[] = [];
    for (const batch of serperResults) {
      for (const p of batch) {
        const key = p.patentNumber || p.link;
        if (key && !seen.has(key)) {
          seen.add(key);
          patents.push(p);
        }
      }
    }

    return new Response(
      JSON.stringify({ patents: patents.slice(0, 30), queries: queryList, source: "serper" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        error: err.name === "TimeoutError" ? "Search timed out" : "Search failed",
        detail: err.message,
        fallback: true,
      }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
}

/** Extract patent number from a Google Patents URL */
function extractPatentNumber(url: string): string {
  if (!url) return "";
  // URLs like https://patents.google.com/patent/US11556757B2/en
  const match = url.match(/patent\/([A-Z0-9]+)/i);
  return match ? match[1] : "";
}
