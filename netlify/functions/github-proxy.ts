import type { Context } from "@netlify/functions";

const GITHUB_API = "https://api.github.com";

type Action =
  | { action: "metadata"; owner: string; repo: string }
  | { action: "tree"; owner: string; repo: string; branch: string }
  | { action: "blobs"; owner: string; repo: string; shas: string[] }
  | { action: "readme"; owner: string; repo: string; branch: string };

function getHeaders(token: string): Record<string, string> {
  return {
    Accept: "application/vnd.github.v3+json",
    Authorization: `Bearer ${token}`,
  };
}

export default async function handler(req: Request, _context: Context) {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const token = Netlify.env.get("GITHUB_TOKEN");
  // Token is optional — unauthenticated gets 60 req/hr
  const headers = token
    ? getHeaders(token)
    : { Accept: "application/vnd.github.v3+json" };

  let body: Action;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!body.action) {
    return new Response(JSON.stringify({ error: "action is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    switch (body.action) {
      case "metadata":
        return await handleMetadata(body, headers);
      case "tree":
        return await handleTree(body, headers);
      case "blobs":
        return await handleBlobs(body, headers);
      case "readme":
        return await handleReadme(body, headers);
      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${(body as any).action}` }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
    }
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        error: err.name === "TimeoutError" ? "Request timed out" : "GitHub proxy error",
        detail: err.message,
      }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
}

async function handleMetadata(
  body: { owner: string; repo: string },
  headers: Record<string, string>
) {
  const response = await fetch(
    `${GITHUB_API}/repos/${body.owner}/${body.repo}`,
    { headers, signal: AbortSignal.timeout(15000) }
  );

  if (!response.ok) {
    const status = response.status;
    const msg =
      status === 404
        ? "Repository not found"
        : status === 403
          ? "GitHub API rate limit reached"
          : `GitHub API error: ${status}`;
    return new Response(JSON.stringify({ error: msg }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }

  const data = await response.json();
  return new Response(
    JSON.stringify({
      owner: data.owner.login,
      repo: data.name,
      description: data.description,
      defaultBranch: data.default_branch,
      language: data.language,
      stars: data.stargazers_count,
      size: data.size,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

async function handleTree(
  body: { owner: string; repo: string; branch: string },
  headers: Record<string, string>
) {
  const response = await fetch(
    `${GITHUB_API}/repos/${body.owner}/${body.repo}/git/trees/${body.branch}?recursive=1`,
    { headers, signal: AbortSignal.timeout(30000) }
  );

  if (!response.ok) {
    return new Response(
      JSON.stringify({ error: `Failed to fetch repo tree: ${response.status}` }),
      { status: response.status, headers: { "Content-Type": "application/json" } }
    );
  }

  const data = await response.json();
  const blobs = (data.tree || []).filter((e: any) => e.type === "blob");
  return new Response(
    JSON.stringify({ tree: blobs, truncated: !!data.truncated }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

async function handleBlobs(
  body: { owner: string; repo: string; shas: string[] },
  headers: Record<string, string>
) {
  // Fetch up to 10 blobs in parallel per request
  const shas = (body.shas || []).slice(0, 10);
  const results = await Promise.all(
    shas.map(async (sha) => {
      try {
        const response = await fetch(
          `${GITHUB_API}/repos/${body.owner}/${body.repo}/git/blobs/${sha}`,
          { headers, signal: AbortSignal.timeout(15000) }
        );
        if (!response.ok) return { sha, content: null };

        const data = await response.json();
        if (data.encoding === "base64" && data.content) {
          try {
            const cleaned = data.content.replace(/[\n\r\s]/g, "");
            const binary = atob(cleaned);
            const bytes = Uint8Array.from(binary, (c: string) => c.charCodeAt(0));
            const text = new TextDecoder("utf-8").decode(bytes);
            // Skip binary files
            if (text.includes("\0")) return { sha, content: null };
            return { sha, content: text };
          } catch {
            return { sha, content: null };
          }
        }
        return { sha, content: data.content || null };
      } catch {
        return { sha, content: null };
      }
    })
  );

  return new Response(JSON.stringify({ blobs: results }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

async function handleReadme(
  body: { owner: string; repo: string; branch: string },
  headers: Record<string, string>
) {
  // Strategy 1: GitHub's dedicated README API
  try {
    const readmeResp = await fetch(
      `${GITHUB_API}/repos/${body.owner}/${body.repo}/readme`,
      { headers, signal: AbortSignal.timeout(10000) }
    );
    if (readmeResp.ok) {
      const data = await readmeResp.json();
      if (data.encoding === "base64" && data.content) {
        const cleaned = data.content.replace(/[\n\r\s]/g, "");
        const binary = atob(cleaned);
        const bytes = Uint8Array.from(binary, (c: string) => c.charCodeAt(0));
        const content = new TextDecoder("utf-8").decode(bytes);
        if (content.length > 0) {
          return new Response(
            JSON.stringify({ content: content.substring(0, 10000) }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
      }
    }
  } catch { /* fall through */ }

  // Strategy 2: Search tree for README files
  try {
    const treeResp = await fetch(
      `${GITHUB_API}/repos/${body.owner}/${body.repo}/git/trees/${body.branch}?recursive=1`,
      { headers, signal: AbortSignal.timeout(15000) }
    );
    if (treeResp.ok) {
      const treeData = await treeResp.json();
      const readmeEntry = (treeData.tree || []).find((entry: any) => {
        if (entry.type !== "blob") return false;
        const name = entry.path.split("/").pop() || "";
        return /^readme(\.(md|txt|rst|markdown))?$/i.test(name) && !entry.path.includes("/");
      });
      if (readmeEntry) {
        const blobResp = await fetch(
          `${GITHUB_API}/repos/${body.owner}/${body.repo}/git/blobs/${readmeEntry.sha}`,
          { headers, signal: AbortSignal.timeout(10000) }
        );
        if (blobResp.ok) {
          const blobData = await blobResp.json();
          if (blobData.encoding === "base64" && blobData.content) {
            const cleaned = blobData.content.replace(/[\n\r\s]/g, "");
            const binary = atob(cleaned);
            const bytes = Uint8Array.from(binary, (c: string) => c.charCodeAt(0));
            const content = new TextDecoder("utf-8").decode(bytes);
            if (content.length > 0) {
              return new Response(
                JSON.stringify({ content: content.substring(0, 10000) }),
                { status: 200, headers: { "Content-Type": "application/json" } }
              );
            }
          }
        }
      }
    }
  } catch { /* fall through */ }

  // Strategy 3: Raw content URL
  try {
    const rawUrl = `https://raw.githubusercontent.com/${body.owner}/${body.repo}/${body.branch}/README.md`;
    const rawHeaders: Record<string, string> = {};
    if (headers.Authorization) rawHeaders.Authorization = headers.Authorization;
    const rawResp = await fetch(rawUrl, {
      headers: rawHeaders,
      signal: AbortSignal.timeout(10000),
    });
    if (rawResp.ok) {
      const content = await rawResp.text();
      if (content.length > 0) {
        return new Response(
          JSON.stringify({ content: content.substring(0, 10000) }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
    }
  } catch { /* fall through */ }

  return new Response(JSON.stringify({ content: null }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
