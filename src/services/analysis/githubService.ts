import type { RepoMetadata } from '../../types';

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
    if (response.status === 404) throw new Error('Repository not found. Is it public?');
    if (response.status === 403) throw new Error('Rate limited. Try signing in with GitHub.');
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

export async function downloadRepoZip(owner: string, repo: string, branch: string, token?: string): Promise<ArrayBuffer> {
  const url = `${GITHUB_API}/repos/${owner}/${repo}/zipball/${branch}`;
  const response = await fetch(url, {
    headers: getHeaders(token),
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`Failed to download repo: ${response.status}`);
  }

  return response.arrayBuffer();
}
