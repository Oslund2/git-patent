import type { RepoMetadata, CodeFile } from '../../types';

const GITHUB_API = 'https://api.github.com';

export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const patterns = [
    /github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/.*)?$/,
    /^([^/]+)\/([^/]+)$/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return { owner: match[1], repo: match[2] };
  }
  return null;
}

/** Use explicit token, or fall back to env var for authenticated rate limits (5,000/hr vs 60/hr) */
function getHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  };
  const effectiveToken = token || import.meta.env.VITE_GITHUB_TOKEN;
  if (effectiveToken) headers.Authorization = `Bearer ${effectiveToken}`;
  return headers;
}

export async function fetchRepoMetadata(url: string, token?: string): Promise<RepoMetadata> {
  const parsed = parseGitHubUrl(url);
  if (!parsed) throw new Error('Invalid GitHub URL');

  const response = await fetch(`${GITHUB_API}/repos/${parsed.owner}/${parsed.repo}`, {
    headers: getHeaders(token),
  });

  if (!response.ok) {
    if (response.status === 404) throw new Error('Repository not found. Make sure it is public or sign in with GitHub for private repos.');
    if (response.status === 403) throw new Error('GitHub API rate limit reached. Sign in with GitHub for higher limits.');
    throw new Error(`GitHub API error: ${response.status}`);
  }

  const data = await response.json();
  return {
    owner: data.owner.login,
    repo: data.name,
    description: data.description,
    defaultBranch: data.default_branch,
    language: data.language,
    stars: data.stargazers_count,
    size: data.size,
  };
}

interface TreeEntry {
  path: string;
  type: 'blob' | 'tree';
  sha: string;
  size?: number;
  url: string;
}

/**
 * Fetch the full repo tree via the Git Trees API (CORS-friendly, single request).
 */
export async function fetchRepoTree(owner: string, repo: string, branch: string, token?: string): Promise<TreeEntry[]> {
  const response = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
    { headers: getHeaders(token) }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch repo tree: ${response.status}`);
  }

  const data = await response.json();
  if (data.truncated) {
    console.warn('Repository tree was truncated (very large repo). Some files may be missing.');
  }

  return (data.tree as TreeEntry[]).filter(entry => entry.type === 'blob');
}

/**
 * Fetch a single file's content via the Git Blobs API (returns base64).
 */
async function fetchBlobContent(owner: string, repo: string, sha: string, token?: string): Promise<string | null> {
  const response = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/git/blobs/${sha}`,
    { headers: getHeaders(token) }
  );

  if (!response.ok) return null;

  const data = await response.json();
  if (data.encoding === 'base64') {
    try {
      return decodeBase64Utf8(data.content);
    } catch {
      return null; // binary file
    }
  }
  return data.content || null;
}

/**
 * Fetch multiple files from a repo using the Git Blobs API.
 * This is CORS-friendly (unlike zipball downloads).
 * Fetches files in parallel batches to stay within rate limits.
 */
export async function fetchRepoFiles(
  owner: string,
  repo: string,
  entries: TreeEntry[],
  token?: string,
  onProgress?: (fetched: number, total: number) => void,
): Promise<CodeFile[]> {
  const BATCH_SIZE = 10; // Parallel requests per batch
  const files: CodeFile[] = [];
  let fetched = 0;

  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (entry) => {
        const content = await fetchBlobContent(owner, repo, entry.sha, token);
        fetched++;
        onProgress?.(fetched, entries.length);
        return { entry, content };
      })
    );

    for (const { entry, content } of results) {
      if (content && !content.includes('\0')) {
        files.push({
          path: entry.path,
          content,
          language: '', // will be set by ingestion service
          lineCount: content.split('\n').length,
        });
      }
    }
  }

  return files;
}

/**
 * Decode base64-encoded UTF-8 content from GitHub API responses.
 * Uses TextDecoder to properly handle multi-byte UTF-8 characters
 * (emoji, accented chars, etc.) that atob() mangles.
 */
function decodeBase64Utf8(base64: string): string {
  const cleaned = base64.replace(/[\n\r\s]/g, '');
  const binary = atob(cleaned);
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
}

/**
 * Fetch README.md content from a GitHub repo.
 * Strategy 1: GitHub's dedicated /readme API endpoint.
 * Strategy 2: Search repo tree for common README filenames.
 * Strategy 3: Fetch raw README.md directly from the branch.
 */
export async function fetchReadmeContent(
  owner: string,
  repo: string,
  branch: string,
  token?: string
): Promise<string | null> {
  try {
    // Strategy 1: Use GitHub's dedicated README API (most reliable)
    const readmeResponse = await fetch(
      `${GITHUB_API}/repos/${owner}/${repo}/readme`,
      { headers: getHeaders(token) }
    );
    if (readmeResponse.ok) {
      const readmeData = await readmeResponse.json();
      if (readmeData.encoding === 'base64' && readmeData.content) {
        try {
          const content = decodeBase64Utf8(readmeData.content);
          if (content && content.length > 0) {
            console.log(`README fetched via API (${content.length} chars)`);
            return content.substring(0, 10000);
          }
        } catch (decodeErr) {
          console.warn('README API base64 decode failed, trying tree strategy:', decodeErr);
        }
      } else {
        console.warn(`README API returned unexpected encoding: ${readmeData.encoding}`);
      }
    } else {
      console.warn(`README API returned ${readmeResponse.status} for ${owner}/${repo}`);
    }

    // Strategy 2: Fall back to tree search with case-insensitive matching
    const tree = await fetchRepoTree(owner, repo, branch, token);
    const readmeEntry = tree.find(entry => {
      const name = entry.path.split('/').pop() || '';
      return /^readme(\.(md|txt|rst|markdown))?$/i.test(name) && !entry.path.includes('/');
    });
    if (readmeEntry) {
      const content = await fetchBlobContent(owner, repo, readmeEntry.sha, token);
      if (content) {
        console.log(`README fetched via tree (${content.length} chars, path: ${readmeEntry.path})`);
        return content.substring(0, 10000);
      }
    }

    // Strategy 3: Try raw content URL as last resort
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/README.md`;
    const rawResponse = await fetch(rawUrl, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (rawResponse.ok) {
      const content = await rawResponse.text();
      if (content && content.length > 0) {
        console.log(`README fetched via raw URL (${content.length} chars)`);
        return content.substring(0, 10000);
      }
    }

    console.warn(`No README found for ${owner}/${repo} (all 3 strategies exhausted)`);
    return null;
  } catch (err) {
    console.error('README fetch failed:', err);
    return null;
  }
}
