import JSZip from 'jszip';
import type { CodeFile } from '../../types';
import { downloadRepoZip, fetchRepoMetadata, parseGitHubUrl } from './githubService';

const MAX_FILE_SIZE = 100 * 1024; // 100KB per file
const MAX_FILES = 500;
const MAX_ZIP_SIZE = 50 * 1024 * 1024; // 50MB

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

async function extractFromZip(zipData: ArrayBuffer | File): Promise<CodeFile[]> {
  const zip = await JSZip.loadAsync(zipData);
  const files: CodeFile[] = [];

  const entries = Object.entries(zip.files)
    .filter(([, file]) => !file.dir)
    .map(([path]) => normalizeZipPath(path))
    .filter(path => path && !shouldSkipFile(path));

  const toProcess = entries.slice(0, MAX_FILES);

  for (const path of toProcess) {
    // Find the original zip entry (with the prefix)
    const originalEntry = Object.entries(zip.files).find(([p]) => normalizeZipPath(p) === path);
    if (!originalEntry) continue;

    const [, file] = originalEntry;
    try {
      const content = await file.async('string');
      if (content.length > MAX_FILE_SIZE) continue;
      if (content.includes('\0')) continue; // binary file

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

  return files;
}

export async function ingestFromZip(file: File): Promise<CodeFile[]> {
  if (file.size > MAX_ZIP_SIZE) {
    throw new Error(`Zip file too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum is 50MB.`);
  }
  return extractFromZip(file);
}

export async function ingestFromGitHub(repoUrl: string, token?: string): Promise<{ files: CodeFile[]; metadata: ReturnType<typeof fetchRepoMetadata> extends Promise<infer T> ? T : never }> {
  const parsed = parseGitHubUrl(repoUrl);
  if (!parsed) throw new Error('Invalid GitHub URL');

  const metadata = await fetchRepoMetadata(repoUrl, token);
  const zipBuffer = await downloadRepoZip(parsed.owner, parsed.repo, metadata.defaultBranch, token);

  if (zipBuffer.byteLength > MAX_ZIP_SIZE) {
    throw new Error(`Repository too large (${(zipBuffer.byteLength / 1024 / 1024).toFixed(1)}MB). Maximum is 50MB.`);
  }

  const files = await extractFromZip(zipBuffer);
  return { files, metadata };
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
