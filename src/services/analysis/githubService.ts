/**
 * GitHub Service — routes all GitHub API calls through the server-side proxy
 * at /.netlify/functions/github-proxy so the GitHub token never reaches the browser.
 */

import type { RepoMetadata, CodeFile } from '../../types';

const PROXY = '/.netlify/functions/github-proxy';

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

export async function fetchRepoMetadata(url: string, _token?: string): Promise<RepoMetadata> {
  const parsed = parseGitHubUrl(url);
  if (!parsed) throw new Error('Invalid GitHub URL');

  const response = await fetch(PROXY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'metadata', owner: parsed.owner, repo: parsed.repo }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error(data.error || `GitHub API error: ${response.status}`);
  }

  return await response.json();
}

interface TreeEntry {
  path: string;
  type: 'blob' | 'tree';
  sha: string;
  size?: number;
  url: string;
}

export async function fetchRepoTree(owner: string, repo: string, branch: string, _token?: string): Promise<TreeEntry[]> {
  const response = await fetch(PROXY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'tree', owner, repo, branch }),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch repo tree: ${response.status}`);
  }

  const data = await response.json();
  if (data.truncated) {
    console.warn('Repository tree was truncated (very large repo). Some files may be missing.');
  }

  return data.tree;
}

export async function fetchRepoFiles(
  owner: string,
  repo: string,
  entries: TreeEntry[],
  _token?: string,
  onProgress?: (fetched: number, total: number) => void,
): Promise<CodeFile[]> {
  const BATCH_SIZE = 10;
  const files: CodeFile[] = [];
  let fetched = 0;

  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    const shas = batch.map(e => e.sha);

    const response = await fetch(PROXY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'blobs', owner, repo, shas }),
    });

    if (!response.ok) {
      fetched += batch.length;
      onProgress?.(fetched, entries.length);
      continue;
    }

    const data = await response.json();
    for (const blob of data.blobs || []) {
      fetched++;
      onProgress?.(fetched, entries.length);
      if (blob.content) {
        const entry = batch.find(e => e.sha === blob.sha);
        if (entry) {
          files.push({
            path: entry.path,
            content: blob.content,
            language: '',
            lineCount: blob.content.split('\n').length,
          });
        }
      }
    }
  }

  return files;
}

export async function fetchReadmeContent(
  owner: string,
  repo: string,
  branch: string,
  _token?: string
): Promise<string | null> {
  try {
    const response = await fetch(PROXY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'readme', owner, repo, branch }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (data.content) {
      console.log(`README fetched via proxy (${data.content.length} chars)`);
      return data.content;
    }
    return null;
  } catch (err) {
    console.error('README fetch failed:', err);
    return null;
  }
}
