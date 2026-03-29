import { useState, useRef } from 'react';
import { GitFork, Upload, Loader2, FolderArchive, ArrowRight, AlertCircle, X, CheckCircle, Code, Search, Sparkles, FileText, Shield } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useProject } from '../../contexts/ProjectContext';
import { ingestFromGitHub, ingestFromZip, getLanguageBreakdown } from '../../services/analysis/codebaseIngestionService';
import { analyzeCodebase } from '../../services/analysis/codebaseAnalysisEngine';
import { runFullIPAnalysis } from '../../services/orchestration/ipAutoOrchestrator';
import { supabase } from '../../lib/supabase';
import type { AnalysisProgress } from '../../types';

interface CodebaseUploadProps {
  onAnalysisComplete: () => void;
}

const STEP_CONFIG = [
  { key: 'fetching', label: 'Fetching', icon: Search },
  { key: 'parsing', label: 'Parsing', icon: Code },
  { key: 'analyzing', label: 'Analyzing', icon: Sparkles },
  { key: 'generating_patents', label: 'Generating IP', icon: FileText },
  { key: 'assessing_ip', label: 'Filing Prep', icon: Shield },
  { key: 'complete', label: 'Complete', icon: CheckCircle },
];

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
      getLanguageBreakdown(files); // compute for analysis engine

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

      // Auto-generate all IP applications
      setProgress({ step: 'generating_patents', progress: 55, message: 'Generating patent applications...' });
      await runFullIPAnalysis(project.id, user.id, project.name, (ipProgress) => {
        const basePercent = 55;
        const pct = basePercent + Math.round(ipProgress.overallPercent * 0.4);
        const stepKey = ipProgress.phase === 'patents' ? 'generating_patents' : 'assessing_ip';
        setProgress({
          step: stepKey as AnalysisProgress['step'],
          progress: Math.min(pct, 95),
          message: ipProgress.step,
          detail: ipProgress.detail,
        });
      });

      setProgress({
        step: 'complete', progress: 100,
        message: 'IP analysis complete! Patents, copyrights, and trademarks generated.',
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

      // Auto-generate all IP applications
      setProgress({ step: 'generating_patents', progress: 55, message: 'Generating patent applications...' });
      await runFullIPAnalysis(project.id, user.id, project.name, (ipProgress) => {
        const basePercent = 55;
        const pct = basePercent + Math.round(ipProgress.overallPercent * 0.4);
        const stepKey = ipProgress.phase === 'patents' ? 'generating_patents' : 'assessing_ip';
        setProgress({
          step: stepKey as AnalysisProgress['step'],
          progress: Math.min(pct, 95),
          message: ipProgress.step,
          detail: ipProgress.detail,
        });
      });

      setProgress({ step: 'complete', progress: 100, message: 'IP analysis complete!' });
      setTimeout(onAnalysisComplete, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
      setProgress(null);
    } finally {
      setLoading(false);
    }
  };

  const currentStepIndex = progress ? STEP_CONFIG.findIndex(s => s.key === progress.step) : -1;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Hero heading */}
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-shield-600 via-blue-500 to-indigo-600 bg-clip-text text-transparent">
          Analyze Your Codebase
        </h2>
        <p className="text-base text-gray-500 mt-3 max-w-lg mx-auto">
          Point to a GitHub repository or upload a zip file to discover patentable intellectual property
        </p>
      </div>

      {/* Two cards side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* GitHub Card */}
        <div
          onClick={() => setMode('github')}
          className={`bg-white border-2 rounded-2xl p-8 cursor-pointer transition-all ${
            mode === 'github'
              ? 'border-shield-500 shadow-md shadow-shield-500/10'
              : 'border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200'
          }`}
        >
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-5 transition-colors ${
            mode === 'github' ? 'bg-gradient-to-br from-shield-500 to-indigo-500' : 'bg-gray-100'
          }`}>
            <GitFork className={`w-7 h-7 ${mode === 'github' ? 'text-white' : 'text-gray-500'}`} />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">GitHub Repository</h3>
          <p className="text-sm text-gray-500 mb-6">
            Paste a public or private repo URL and we will fetch and analyze it automatically.
          </p>

          {mode === 'github' && (
            <div className="space-y-4">
              <div className="relative">
                <GitFork className="absolute left-4 top-4 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  placeholder="https://github.com/owner/repo"
                  className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-shield-500 focus:border-transparent focus:bg-white text-gray-900 text-base transition-colors"
                  disabled={loading}
                  onKeyDown={(e) => e.key === 'Enter' && handleGitHubAnalysis()}
                />
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); handleGitHubAnalysis(); }}
                disabled={loading || !repoUrl.trim()}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-shield-600 to-indigo-600 text-white font-semibold py-3.5 px-4 rounded-xl hover:shadow-lg hover:shadow-shield-600/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-base"
              >
                {loading && mode === 'github' ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
                {loading && mode === 'github' ? 'Analyzing...' : 'Analyze Repository'}
              </button>
            </div>
          )}
        </div>

        {/* Zip Card */}
        <div
          onClick={() => setMode('zip')}
          className={`bg-white border-2 rounded-2xl p-8 cursor-pointer transition-all ${
            mode === 'zip'
              ? 'border-violet-500 shadow-md shadow-violet-500/10'
              : 'border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200'
          }`}
        >
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-5 transition-colors ${
            mode === 'zip' ? 'bg-gradient-to-br from-violet-500 to-purple-500' : 'bg-gray-100'
          }`}>
            <FolderArchive className={`w-7 h-7 ${mode === 'zip' ? 'text-white' : 'text-gray-500'}`} />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Upload Zip File</h3>
          <p className="text-sm text-gray-500 mb-6">
            Drag and drop or browse for a zip archive of your codebase. Max 50MB.
          </p>

          {mode === 'zip' && (
            <div
              onClick={(e) => { e.stopPropagation(); if (!loading) fileInputRef.current?.click(); }}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                loading
                  ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
                  : 'border-violet-300 hover:border-violet-400 hover:bg-violet-50/50 bg-violet-50/30'
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
              {loading && mode === 'zip' ? (
                <Loader2 className="w-10 h-10 text-violet-500 mx-auto animate-spin" />
              ) : (
                <Upload className="w-10 h-10 text-violet-400 mx-auto" />
              )}
              <p className="mt-3 text-gray-600 font-medium text-base">
                {loading && mode === 'zip' ? 'Processing...' : 'Drop file here or click to browse'}
              </p>
              <p className="mt-1 text-gray-400 text-sm">ZIP files up to 50MB</p>
            </div>
          )}
        </div>
      </div>

      {/* Progress stepper */}
      {progress && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-8 mb-6">
          {/* Step indicators */}
          <div className="flex items-center justify-between mb-8">
            {STEP_CONFIG.map((step, idx) => {
              const StepIcon = step.icon;
              const isActive = idx === currentStepIndex;
              const isCompleted = idx < currentStepIndex;
              return (
                <div key={step.key} className="flex items-center flex-1 last:flex-initial">
                  <div className="flex flex-col items-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                      isCompleted
                        ? 'bg-green-100 text-green-600'
                        : isActive
                          ? 'bg-gradient-to-br from-shield-500 to-indigo-500 text-white shadow-lg shadow-shield-500/20'
                          : 'bg-gray-100 text-gray-400'
                    }`}>
                      <StepIcon className={`w-5 h-5 ${isActive && step.key !== 'complete' ? 'animate-pulse' : ''}`} />
                    </div>
                    <span className={`text-xs font-medium mt-2 ${
                      isActive ? 'text-shield-600' : isCompleted ? 'text-green-600' : 'text-gray-400'
                    }`}>
                      {step.label}
                    </span>
                  </div>
                  {idx < STEP_CONFIG.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-3 mt-[-1rem] rounded-full transition-colors ${
                      isCompleted ? 'bg-green-300' : 'bg-gray-200'
                    }`} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Progress bar */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">{progress.message}</span>
            <span className="text-sm font-semibold text-shield-600">{Math.round(progress.progress)}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2.5">
            <div
              className="bg-gradient-to-r from-shield-500 to-indigo-500 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${progress.progress}%` }}
            />
          </div>
          {progress.detail && (
            <p className="text-xs text-gray-400 mt-3 truncate">{progress.detail}</p>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-2xl p-5">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-red-700 text-sm flex-1">{error}</p>
          <button
            onClick={() => setError('')}
            className="p-1 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
