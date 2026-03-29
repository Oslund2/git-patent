import { useState, useRef } from 'react';
import { GitFork, Upload, Loader2, FolderArchive, ArrowRight, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useProject } from '../../contexts/ProjectContext';
import { ingestFromGitHub, ingestFromZip, getLanguageBreakdown } from '../../services/analysis/codebaseIngestionService';
import { analyzeCodebase } from '../../services/analysis/codebaseAnalysisEngine';
import { supabase } from '../../lib/supabase';
import type { AnalysisProgress } from '../../types';

interface CodebaseUploadProps {
  onAnalysisComplete: () => void;
}

export function CodebaseUpload({ onAnalysisComplete }: CodebaseUploadProps) {
  const { user, session } = useAuth();
  const { createProject, updateProject } = useProject();
  const [mode, setMode] = useState<'github' | 'zip'>('github');
  const [repoUrl, setRepoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<AnalysisProgress | null>(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleGitHubAnalysis = async () => {
    if (!repoUrl.trim() || !user) return;
    setError('');
    setLoading(true);
    setProgress({ step: 'fetching', progress: 0, message: 'Fetching repository...' });

    try {
      const project = await createProject({
        name: repoUrl.split('/').slice(-2).join('/'),
        source_type: 'github_url',
        source_url: repoUrl.trim(),
      });

      await updateProject(project.id, { analysis_status: 'analyzing' });

      // Use GitHub token from OAuth if available
      const githubToken = session?.provider_token || undefined;

      setProgress({ step: 'fetching', progress: 2, message: 'Fetching repository tree...' });
      const { files, metadata } = await ingestFromGitHub(repoUrl.trim(), githubToken, (fetched, total) => {
        const pct = 2 + Math.round((fetched / total) * 6);
        setProgress({ step: 'fetching', progress: pct, message: `Fetching files... ${fetched}/${total}` });
      });

      await updateProject(project.id, {
        source_metadata: metadata as unknown as Record<string, unknown>,
      });

      // Store file records
      setProgress({ step: 'parsing', progress: 8, message: `Parsing ${files.length} files...` });
      const languageBreakdown = getLanguageBreakdown(files);

      const fileRows = files.map(f => ({
        project_id: project.id,
        file_path: f.path,
        language: f.language,
        line_count: f.lineCount,
      }));
      if (fileRows.length > 0) {
        // Insert in batches of 100
        for (let i = 0; i < fileRows.length; i += 100) {
          await supabase.from('project_files').insert(fileRows.slice(i, i + 100));
        }
      }

      setProgress({ step: 'analyzing', progress: 10, message: 'Starting AI analysis...' });
      await analyzeCodebase(project.id, files, setProgress);

      setProgress({
        step: 'complete', progress: 100,
        message: `Analysis complete! ${files.length} files, ${Object.keys(languageBreakdown).length} languages.`,
      });
      setTimeout(onAnalysisComplete, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
      setProgress(null);
    } finally {
      setLoading(false);
    }
  };

  const handleZipUpload = async (file: File) => {
    if (!user) return;
    setError('');
    setLoading(true);
    setProgress({ step: 'fetching', progress: 0, message: 'Reading zip file...' });

    try {
      const project = await createProject({
        name: file.name.replace(/\.zip$/i, ''),
        source_type: 'zip_upload',
      });

      await updateProject(project.id, { analysis_status: 'analyzing' });

      setProgress({ step: 'parsing', progress: 5, message: 'Extracting files...' });
      const files = await ingestFromZip(file);

      // Store file records
      const fileRows = files.map(f => ({
        project_id: project.id,
        file_path: f.path,
        language: f.language,
        line_count: f.lineCount,
      }));
      if (fileRows.length > 0) {
        for (let i = 0; i < fileRows.length; i += 100) {
          await supabase.from('project_files').insert(fileRows.slice(i, i + 100));
        }
      }

      setProgress({ step: 'analyzing', progress: 10, message: 'Starting AI analysis...' });
      await analyzeCodebase(project.id, files, setProgress);

      setProgress({ step: 'complete', progress: 100, message: 'Analysis complete!' });
      setTimeout(onAnalysisComplete, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
      setProgress(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Analyze Your Codebase</h2>
        <p className="text-gray-500 mt-2">Point to a GitHub repo or upload a zip file to discover patentable IP</p>
      </div>

      {/* Mode selector */}
      <div className="flex bg-gray-100 rounded-lg p-1 mb-6">
        <button
          onClick={() => setMode('github')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-md text-sm font-medium transition-colors ${
            mode === 'github' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <GitFork className="w-4 h-4" /> GitHub URL
        </button>
        <button
          onClick={() => setMode('zip')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-md text-sm font-medium transition-colors ${
            mode === 'zip' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <FolderArchive className="w-4 h-4" /> Upload Zip
        </button>
      </div>

      {/* GitHub mode */}
      {mode === 'github' && (
        <div className="space-y-4">
          <div className="relative">
            <GitFork className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/owner/repo"
              className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-shield-500 focus:border-transparent text-gray-900"
              disabled={loading}
              onKeyDown={(e) => e.key === 'Enter' && handleGitHubAnalysis()}
            />
          </div>
          <button
            onClick={handleGitHubAnalysis}
            disabled={loading || !repoUrl.trim()}
            className="w-full flex items-center justify-center gap-2 bg-shield-600 text-white font-medium py-3 px-4 rounded-lg hover:bg-shield-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            {loading ? 'Analyzing...' : 'Analyze Repository'}
          </button>
        </div>
      )}

      {/* Zip mode */}
      {mode === 'zip' && (
        <div
          onClick={() => !loading && fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
            loading ? 'border-gray-200 bg-gray-50 cursor-not-allowed' : 'border-gray-300 hover:border-shield-500 hover:bg-shield-50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleZipUpload(file);
            }}
          />
          {loading ? (
            <Loader2 className="w-10 h-10 text-shield-500 mx-auto animate-spin" />
          ) : (
            <Upload className="w-10 h-10 text-gray-400 mx-auto" />
          )}
          <p className="mt-3 text-gray-600 font-medium">
            {loading ? 'Processing...' : 'Drop a zip file here or click to browse'}
          </p>
          <p className="mt-1 text-gray-400 text-sm">Maximum 50MB</p>
        </div>
      )}

      {/* Progress */}
      {progress && (
        <div className="mt-6 bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">{progress.message}</span>
            <span className="text-sm text-gray-500">{Math.round(progress.progress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-shield-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${progress.progress}%` }}
            />
          </div>
          {progress.detail && (
            <p className="text-xs text-gray-400 mt-2 truncate">{progress.detail}</p>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-4 flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}
    </div>
  );
}
