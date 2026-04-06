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

function getHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
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
      return atob(data.content.replace(/\n/g, ''));
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
 * Fetch README.md content from a GitHub repo.
 * Tries README.md, readme.md, README, README.rst in order.
 */
export async function fetchReadmeContent(
  owner: string,
  repo: string,
  branch: string,
  token?: string
): Promise<string | null> {
  try {
    const tree = await fetchRepoTree(owner, repo, branch, token);
    const readmeNames = ['README.md', 'readme.md', 'README', 'README.rst', 'Readme.md'];
    const readmeEntry = tree.find(entry => readmeNames.includes(entry.path));
    if (!readmeEntry) return null;
    const content = await fetchBlobContent(owner, repo, readmeEntry.sha, token);
    // Truncate to 5000 chars to avoid bloating the DB/prompts
    return content ? content.substring(0, 5000) : null;
  } catch {
    return null;
  }
}
