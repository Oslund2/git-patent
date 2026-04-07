import JSZip from 'jszip';
import type { CodeFile } from '../../types';
import { fetchRepoMetadata, fetchRepoTree, fetchRepoFiles, parseGitHubUrl, fetchReadmeContent } from './githubService';

const MAX_FILE_SIZE = 100 * 1024; // 100KB per file
const MAX_FILES = 500;
const MAX_ZIP_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_GITHUB_FILES = 80; // Limit API calls for GitHub (each file = 1 request)

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', '__pycache__',
  'venv', '.venv', 'env', '.env', 'vendor', 'target', 'bin', 'obj',
  '.idea', '.vscode', 'coverage', '.nyc_output', '.cache',
]);

const SKIP_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.bmp',
  '.mp4', '.mp3', '.wav', '.ogg', '.avi', '.mov',
  '.zip', '.tar', '.gz', '.rar', '.7z',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx',
  '.exe', '.dll', '.so', '.dylib', '.o',
  '.lock', '.min.js', '.min.css', '.map',
]);

const LANGUAGE_MAP: Record<string, string> = {
  '.ts': 'typescript', '.tsx': 'typescript', '.js': 'javascript', '.jsx': 'javascript',
  '.py': 'python', '.rb': 'ruby', '.rs': 'rust', '.go': 'go',
  '.java': 'java', '.kt': 'kotlin', '.swift': 'swift', '.cs': 'csharp',
  '.cpp': 'cpp', '.c': 'c', '.h': 'c', '.hpp': 'cpp',
  '.php': 'php', '.scala': 'scala', '.r': 'r',
  '.sql': 'sql', '.graphql': 'graphql', '.gql': 'graphql',
  '.html': 'html', '.css': 'css', '.scss': 'scss', '.less': 'less',
  '.json': 'json', '.yaml': 'yaml', '.yml': 'yaml', '.toml': 'toml',
  '.xml': 'xml', '.md': 'markdown', '.sh': 'shell', '.bash': 'shell',
  '.dockerfile': 'dockerfile', '.tf': 'terraform', '.proto': 'protobuf',
};

export function detectLanguage(filePath: string): string {
  const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();
  const basename = filePath.split('/').pop()?.toLowerCase() || '';
  if (basename === 'dockerfile') return 'dockerfile';
  if (basename === 'makefile') return 'makefile';
  return LANGUAGE_MAP[ext] || 'unknown';
}

function shouldSkipFile(path: string): boolean {
  const parts = path.split('/');
  for (const part of parts) {
    if (SKIP_DIRS.has(part)) return true;
  }

  const ext = path.substring(path.lastIndexOf('.')).toLowerCase();
  if (SKIP_EXTENSIONS.has(ext)) return true;

  const basename = parts[parts.length - 1];
  if (basename.startsWith('.') && !basename.includes('.env.example')) return true;
  if (basename === 'package-lock.json' || basename === 'yarn.lock' || basename === 'pnpm-lock.yaml') return true;

  return false;
}

function normalizeZipPath(path: string): string {
  // GitHub zip files have a top-level directory like "owner-repo-sha/"
  const parts = path.split('/');
  if (parts.length > 1) {
    return parts.slice(1).join('/');
  }
  return path;
}

async function extractFromZip(zipData: ArrayBuffer | File): Promise<{ files: CodeFile[]; readmeContent: string | null }> {
  const zip = await JSZip.loadAsync(zipData);
  const files: CodeFile[] = [];

  const allEntries = Object.entries(zip.files);

  const entries = allEntries
    .filter(([, file]) => !file.dir)
    .map(([path]) => normalizeZipPath(path))
    .filter(path => path && !shouldSkipFile(path));

  const toProcess = entries.slice(0, MAX_FILES);

  for (const path of toProcess) {
    const originalEntry = allEntries.find(([p]) => normalizeZipPath(p) === path);
    if (!originalEntry) continue;

    const [, file] = originalEntry;
    try {
      const content = await file.async('string');
      if (content.length > MAX_FILE_SIZE) continue;
      if (content.includes('\0')) continue;

      const language = detectLanguage(path);
      if (language === 'unknown') continue;

      files.push({
        path,
        content,
        language,
        lineCount: content.split('\n').length,
      });
    } catch {
      // Skip files that can't be read as text
    }
  }

  // Extract README for patent generation context
  let readmeContent: string | null = null;
  const readmeEntry = allEntries.find(([path, file]) => {
    if (file.dir) return false;
    const normalized = normalizeZipPath(path);
    return /^readme(\.(md|txt|rst))?$/i.test(normalized);
  });
  if (readmeEntry) {
    try {
      const raw = await readmeEntry[1].async('string');
      readmeContent = raw.slice(0, 10000);
    } catch { /* README is optional */ }
  }

  return { files, readmeContent };
}

export async function ingestFromZip(file: File): Promise<{ files: CodeFile[]; readmeContent: string | null }> {
  if (file.size > MAX_ZIP_SIZE) {
    throw new Error(`Zip file too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum is 50MB.`);
  }
  return extractFromZip(file);
}

/**
 * Ingest from GitHub using the CORS-friendly Git Trees + Blobs API.
 * 1. Fetch repo metadata (1 request)
 * 2. Fetch full tree (1 request)
 * 3. Filter to analyzable files
 * 4. Fetch each file's content via Blobs API (1 request per file, batched)
 */
export async function ingestFromGitHub(
  repoUrl: string,
  token?: string,
  onProgress?: (fetched: number, total: number) => void,
): Promise<{ files: CodeFile[]; metadata: Awaited<ReturnType<typeof fetchRepoMetadata>>; readmeContent: string | null }> {
  const parsed = parseGitHubUrl(repoUrl);
  if (!parsed) throw new Error('Invalid GitHub URL');

  // Step 1: Get repo metadata
  const metadata = await fetchRepoMetadata(repoUrl, token);

  // Step 2: Get full file tree (single request, CORS-friendly)
  const tree = await fetchRepoTree(parsed.owner, parsed.repo, metadata.defaultBranch, token);

  // Step 3: Filter to analyzable code files
  const analyzable = tree
    .filter(entry => !shouldSkipFile(entry.path))
    .filter(entry => {
      const lang = detectLanguage(entry.path);
      return lang !== 'unknown';
    })
    .filter(entry => !entry.size || entry.size <= MAX_FILE_SIZE);

  // Prioritize code files over config/docs, take top N
  const codeLanguages = new Set(['typescript', 'javascript', 'python', 'rust', 'go', 'java', 'csharp', 'cpp', 'swift', 'kotlin', 'ruby', 'php']);
  const sorted = [...analyzable].sort((a, b) => {
    const aIsCode = codeLanguages.has(detectLanguage(a.path)) ? 0 : 1;
    const bIsCode = codeLanguages.has(detectLanguage(b.path)) ? 0 : 1;
    if (aIsCode !== bIsCode) return aIsCode - bIsCode;
    return (b.size || 0) - (a.size || 0);
  });

  const toFetch = sorted.slice(0, MAX_GITHUB_FILES);

  // Step 4: Fetch file contents (batched parallel requests)
  const rawFiles = await fetchRepoFiles(parsed.owner, parsed.repo, toFetch, token, onProgress);

  // Set language on each file
  const files: CodeFile[] = rawFiles
    .map(f => ({
      ...f,
      language: detectLanguage(f.path),
    }))
    .filter(f => f.language !== 'unknown' && f.content.length <= MAX_FILE_SIZE);

  // Also fetch README for context in patent generation
  let readmeContent: string | null = null;
  try {
    readmeContent = await fetchReadmeContent(parsed.owner, parsed.repo, metadata.defaultBranch, token);
  } catch { /* README is optional */ }

  return { files, metadata, readmeContent };
}

export function getLanguageBreakdown(files: CodeFile[]): Record<string, number> {
  const breakdown: Record<string, number> = {};
  for (const file of files) {
    breakdown[file.language] = (breakdown[file.language] || 0) + 1;
  }
  return Object.fromEntries(
    Object.entries(breakdown).sort(([, a], [, b]) => b - a)
  );
}
