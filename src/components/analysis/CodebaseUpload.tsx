import { useState, useEffect, useRef } from 'react';
import { GitFork, Loader2, ArrowRight, AlertCircle, X, CheckCircle, Code, Search, Sparkles, FileText, Shield, Clock, Info, ChevronDown, ChevronUp, BookOpen, Upload } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useProject } from '../../contexts/ProjectContext';
import { ingestFromGitHub, ingestFromZip, getLanguageBreakdown } from '../../services/analysis/codebaseIngestionService';
import { analyzeCodebase } from '../../services/analysis/codebaseAnalysisEngine';
import { runFullIPAnalysis, type ApplicantInfo } from '../../services/orchestration/ipAutoOrchestrator';
import { supabase } from '../../lib/supabase';
import type { AnalysisProgress } from '../../types';
import {
  updatePatentApplication,
  type InventorInfo,
  type CorrespondenceAddressInfo,
  type AttorneyInfoData,
} from '../../services/patent/patentApplicationService';
import { PipelineTips } from './PipelineTips';
import { PipelineInsights } from './PipelineInsights';
import { FilingInfoWizard } from './FilingInfoWizard';
import { PaymentBanner } from '../payment/PaymentBanner';

interface CodebaseUploadProps {
  paidProjectId?: string | null;
  paymentBanner?: 'success' | 'cancelled' | null;
  onDismissBanner?: () => void;
  onAnalysisComplete: (project: any) => void;
}

const STEP_CONFIG = [
  { key: 'fetching', label: 'Fetching', icon: Search },
  { key: 'parsing', label: 'Parsing', icon: Code },
  { key: 'analyzing', label: 'Analyzing', icon: Sparkles },
  { key: 'generating_patents', label: 'Generating IP', icon: FileText },
  { key: 'assessing_ip', label: 'Filing Prep', icon: Shield },
  { key: 'complete', label: 'Complete', icon: CheckCircle },
];

export function CodebaseUpload({ paidProjectId: paidProjectIdProp, paymentBanner, onDismissBanner, onAnalysisComplete }: CodebaseUploadProps) {
  const { user, session } = useAuth();
  const { createProject, updateProject } = useProject();
  const [sourceType, setSourceType] = useState<'github' | 'zip'>('github');
  const [showTips, setShowTips] = useState(false);
  const [repoUrl, setRepoUrl] = useState('');
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [inventorName, setInventorName] = useState('');
  const [entityStatus, setEntityStatus] = useState<'micro_entity' | 'small_entity' | 'regular'>('micro_entity');
  const [showMoreApplicant, setShowMoreApplicant] = useState(false);
  const [citizenship, setCitizenship] = useState('US Citizen');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<AnalysisProgress | null>(null);
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [metrics, setMetrics] = useState<Record<string, string>>({});
  const [warnings, setWarnings] = useState<string[]>([]);
  const [wizardInventors, setWizardInventors] = useState<InventorInfo[]>([]);
  const [wizardCorrespondence, setWizardCorrespondence] = useState<CorrespondenceAddressInfo | null>(null);
  const [wizardAttorney, setWizardAttorney] = useState<AttorneyInfoData | null>(null);
  const [wizardOpen, setWizardOpen] = useState(true);
  const startRef = useRef(0);

  // Track paid project ID — consumed once when analysis starts
  const [paidProjectId, setPaidProjectId] = useState<string | null>(paidProjectIdProp || null);

  useEffect(() => {
    if (!loading) { setElapsed(0); return; }
    startRef.current = Date.now();
    const interval = setInterval(() => setElapsed(Date.now() - startRef.current), 1000);
    return () => clearInterval(interval);
  }, [loading]);

  const formatElapsed = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  };

  // Shared pipeline: store files, run AI analysis, generate IP
  const runAnalysisPipeline = async (
    project: { id: string; name: string },
    files: import('../../types').CodeFile[],
    readmeContent: string | null,
  ) => {
    // Check README quality and warn user
    if (!readmeContent || readmeContent.trim().length === 0) {
      setWarnings(prev => [...prev, 'No README found — patent output quality will be significantly reduced. Consider adding a detailed README to your repo.']);
    } else if (readmeContent.trim().length < 200) {
      setWarnings(prev => [...prev, 'README is very short — the tool works best with a detailed README that describes what the software does and what makes it novel.']);
    }

    // Store file records
    setProgress({ step: 'parsing', progress: 8, message: `Parsing ${files.length} files...` });
    getLanguageBreakdown(files);

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
    await analyzeCodebase(project.id, files, setProgress, readmeContent || undefined);

    // Auto-generate all IP applications
    setProgress({ step: 'generating_patents', progress: 55, message: 'Generating patent applications...' });
    const applicant: ApplicantInfo | undefined = inventorName.trim()
      ? { inventorName: inventorName.trim(), entityStatus, citizenship: citizenship.trim() || undefined }
      : undefined;
    const ipResult = await runFullIPAnalysis(project.id, user!.id, project.name, (ipProgress) => {
      const basePercent = 55;
      const pct = basePercent + Math.round(ipProgress.overallPercent * 0.4);
      const stepKey = ipProgress.phase === 'patents' ? 'generating_patents' : 'assessing_ip';
      const patentLabel = ipProgress.patentTotal && ipProgress.patentTotal > 1
        ? ` (Patent ${(ipProgress.patentIndex ?? 0) + 1}/${ipProgress.patentTotal})`
        : '';
      setProgress({
        step: stepKey as AnalysisProgress['step'],
        progress: Math.min(pct, 95),
        message: `${ipProgress.step}${patentLabel}`,
        detail: ipProgress.detail,
      });
      if (ipProgress.metrics) {
        setMetrics(prev => {
          const next = { ...prev };
          const m = ipProgress.metrics!;
          if (m.featureCount) next.features = `${m.featureCount} features`;
          if (m.score) next.novelty = `Novelty: ${Math.round(Number(m.score))}/100`;
          if (m.claimsCount) next.claims = `${m.claimsCount} claims`;
          if (m.drawingsCount) next.drawings = `${m.drawingsCount} drawings`;
          if (m.priorArtCount) next.priorArt = `${m.priorArtCount} prior art`;
          if (m.topFeatures) next.topFeatures = String(m.topFeatures);
          if (m.topPriorArt) next.topPriorArt = String(m.topPriorArt);
          if (m.firstClaimPreview) next.firstClaimPreview = String(m.firstClaimPreview);
          return next;
        });
      }
    }, applicant);

    // Persist filing wizard data to created patent applications
    if (ipResult?.patentApplicationIds?.length > 0) {
      const hasWizardData = wizardInventors.length > 0 || wizardCorrespondence || wizardAttorney;
      if (hasWizardData) {
        for (const appId of ipResult.patentApplicationIds) {
          try {
            await updatePatentApplication(appId, {
              ...(wizardInventors.length > 0 && { inventors: wizardInventors }),
              ...(wizardCorrespondence && { correspondence_address: wizardCorrespondence }),
              ...(wizardAttorney && { attorney_info: wizardAttorney }),
            });
          } catch (err) {
            console.error('Failed to apply filing info to patent', appId, err);
          }
        }
      }
    }

    // Check if prior art search produced results — warn if not
    setMetrics(prev => {
      if (!prev.priorArt || prev.priorArt === '0 prior art') {
        setWarnings(w => [...w, 'Prior art search returned no results — novelty scores are preliminary only. Verify prior art manually before filing.']);
      }
      return prev;
    });

    setProgress({
      step: 'complete', progress: 100,
      message: 'Analysis complete! Patent applications generated.',
    });
    setTimeout(() => onAnalysisComplete(project), 1500);
  };

  const handleGitHubAnalysis = async () => {
    if (!repoUrl.trim() || !user) return;
    setError('');
    setWarnings([]);

    const projectName = repoUrl.split('/').slice(-2).join('/');

    setLoading(true);
    setProgress({ step: 'fetching', progress: 0, message: 'Fetching repository...' });

    try {
      // Reuse the paid project if returning from Stripe, otherwise create a new one
      let project;
      if (paidProjectId) {
        await updateProject(paidProjectId, {
          name: projectName,
          source_type: 'github_url',
          source_url: repoUrl.trim(),
        } as any);
        project = { id: paidProjectId, name: projectName };
        setPaidProjectId(null); // Clear so it's not reused
      } else {
        project = await createProject({
          name: projectName,
          source_type: 'github_url',
          source_url: repoUrl.trim(),
        });
      }

      await updateProject(project.id, { analysis_status: 'analyzing' });

      const githubToken = session?.provider_token || undefined;

      setProgress({ step: 'fetching', progress: 2, message: 'Fetching repository tree...' });
      const { files, metadata, readmeContent } = await ingestFromGitHub(repoUrl.trim(), githubToken, (fetched, total) => {
        const pct = 2 + Math.round((fetched / total) * 6);
        setProgress({ step: 'fetching', progress: pct, message: `Fetching files... ${fetched}/${total}` });
      });

      await updateProject(project.id, {
        source_metadata: {
          ...(metadata as unknown as Record<string, unknown>),
          readmeContent: readmeContent || undefined,
        },
      });

      await runAnalysisPipeline(project, files, readmeContent);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
      setProgress(null);
    } finally {
      setLoading(false);
    }
  };

  // ZIP upload helpers
  const validateZipFile = (file: File): string | null => {
    if (!file.name.toLowerCase().endsWith('.zip')) {
      return 'Please select a .zip file.';
    }
    if (file.size > 50 * 1024 * 1024) {
      return `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum is 50MB.`;
    }
    return null;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const err = validateZipFile(file);
    if (err) { setError(err); return; }
    setError('');
    setZipFile(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateZipFile(file);
    if (err) { setError(err); return; }
    setError('');
    setZipFile(file);
  };

  const handleZipAnalysis = async () => {
    if (!zipFile || !user) return;
    setError('');
    setWarnings([]);

    const projectName = zipFile.name.replace(/\.zip$/i, '');

    setLoading(true);
    setProgress({ step: 'fetching', progress: 0, message: 'Reading ZIP file...' });

    try {
      let project;
      if (paidProjectId) {
        await updateProject(paidProjectId, {
          name: projectName,
          source_type: 'zip_upload',
        } as any);
        project = { id: paidProjectId, name: projectName };
        setPaidProjectId(null);
      } else {
        project = await createProject({
          name: projectName,
          source_type: 'zip_upload',
        });
      }
      await updateProject(project.id, { analysis_status: 'analyzing' });

      setProgress({ step: 'fetching', progress: 3, message: 'Extracting files from ZIP...' });
      const { files, readmeContent } = await ingestFromZip(zipFile);

      if (files.length === 0) {
        throw new Error('No analyzable source code files found in the ZIP. Ensure it contains code files (not just config or binaries).');
      }

      setProgress({ step: 'fetching', progress: 8, message: `Found ${files.length} source files` });

      await updateProject(project.id, {
        source_metadata: {
          fileName: zipFile.name,
          fileSize: zipFile.size,
          fileCount: files.length,
          readmeContent: readmeContent || undefined,
        },
      });

      await runAnalysisPipeline(project, files, readmeContent);
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
      {/* Payment redirect banners */}
      {paymentBanner && onDismissBanner && (
        <div className="max-w-2xl mx-auto">
          <PaymentBanner type={paymentBanner} onDismiss={onDismissBanner} />
        </div>
      )}

      {/* Hero heading */}
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-patent-600 via-blue-500 to-indigo-600 bg-clip-text text-transparent">
          Analyze Your Codebase
        </h2>
        <p className="text-base text-gray-500 mt-3 max-w-lg mx-auto">
          Point to a GitHub repository or upload a ZIP file to discover patentable intellectual property
        </p>
      </div>

      {/* Tips for Best Results */}
      <div className="max-w-2xl mx-auto mb-6">
        <button
          type="button"
          onClick={() => setShowTips(!showTips)}
          className="w-full flex items-center justify-between px-5 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm font-medium text-amber-800 hover:bg-amber-100 transition-colors"
        >
          <span className="flex items-center gap-2">
            <Info className="w-4 h-4" />
            Tips for Best Results
          </span>
          {showTips ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showTips && (
          <div className="mt-2 bg-amber-50/50 border border-amber-100 rounded-xl p-5 space-y-3 text-sm text-amber-900">
            <div className="flex gap-3">
              <BookOpen className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold mb-1">Your README is the #1 input</p>
                <p className="text-amber-700">The tool uses your README as the authoritative description of what your software does. Write it like an invention disclosure: what problem it solves, what makes the approach novel, and how the key components work. A thin or missing README will produce generic, low-quality patent output.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <GitFork className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold mb-1">Repository access</p>
                <p className="text-amber-700">Public repos work immediately. For private repos, sign in with GitHub (top-right) to grant read access. The tool uses the GitHub API — it does not clone your repo.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Code className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold mb-1">What gets analyzed</p>
                <p className="text-amber-700">The tool prioritizes the <strong>top 40 source code files</strong> (TypeScript, JavaScript, Python, Rust, Go, Java, C#, C++, Swift, Kotlin, and 30+ more). Config files, docs, and binaries are skipped. If your innovation lives in a specific directory, describe it in your README so the AI has context.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Shield className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold mb-1">Novelty scores are preliminary</p>
                <p className="text-amber-700">The tool searches Google Patents for prior art, but automated scores should not replace professional patent counsel. Use the generated documents as a strong starting point, then review with an attorney before filing.</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Source type selector cards */}
      {!loading && !progress && (
        <div className="max-w-2xl mx-auto mb-6">
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => { setSourceType('github'); setError(''); }}
              className={`relative flex flex-col items-center gap-3 p-6 rounded-2xl border-2 transition-all duration-200 ${
                sourceType === 'github'
                  ? 'border-patent-500 bg-patent-50/50 shadow-md shadow-patent-500/10'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
              }`}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                sourceType === 'github'
                  ? 'bg-gradient-to-br from-patent-500 to-indigo-500'
                  : 'bg-gray-100'
              }`}>
                <GitFork className={`w-6 h-6 ${sourceType === 'github' ? 'text-white' : 'text-gray-500'}`} />
              </div>
              <div className="text-center">
                <p className={`font-semibold text-sm ${sourceType === 'github' ? 'text-gray-900' : 'text-gray-700'}`}>GitHub URL</p>
                <p className="text-xs text-gray-500 mt-0.5">Paste a repository link</p>
              </div>
              {sourceType === 'github' && (
                <div className="absolute top-3 right-3">
                  <CheckCircle className="w-5 h-5 text-patent-500" />
                </div>
              )}
            </button>
            <button
              onClick={() => { setSourceType('zip'); setError(''); }}
              className={`relative flex flex-col items-center gap-3 p-6 rounded-2xl border-2 transition-all duration-200 ${
                sourceType === 'zip'
                  ? 'border-violet-500 bg-violet-50/50 shadow-md shadow-violet-500/10'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
              }`}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                sourceType === 'zip'
                  ? 'bg-gradient-to-br from-violet-500 to-purple-500'
                  : 'bg-gray-100'
              }`}>
                <Upload className={`w-6 h-6 ${sourceType === 'zip' ? 'text-white' : 'text-gray-500'}`} />
              </div>
              <div className="text-center">
                <p className={`font-semibold text-sm ${sourceType === 'zip' ? 'text-gray-900' : 'text-gray-700'}`}>ZIP Upload</p>
                <p className="text-xs text-gray-500 mt-0.5">Upload a .zip of your code</p>
              </div>
              {sourceType === 'zip' && (
                <div className="absolute top-3 right-3">
                  <CheckCircle className="w-5 h-5 text-violet-500" />
                </div>
              )}
            </button>
          </div>
        </div>
      )}

      {/* GitHub input */}
      {sourceType === 'github' && (
      <div className="max-w-2xl mx-auto mb-8">
        <div className="bg-white border-2 border-patent-500 rounded-2xl p-8 shadow-md shadow-patent-500/10">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-gradient-to-br from-patent-500 to-indigo-500">
              <GitFork className="w-7 h-7 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">GitHub Repository</h3>
              <p className="text-sm text-gray-500">Paste a public or private repo URL to analyze</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="relative">
              <GitFork className="absolute left-4 top-4 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/owner/repo"
                className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-patent-500 focus:border-transparent focus:bg-white text-gray-900 text-base transition-colors"
                disabled={loading}
                onKeyDown={(e) => e.key === 'Enter' && handleGitHubAnalysis()}
              />
            </div>

            {/* Applicant Information */}
            <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Applicant Information</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Inventor Full Name *</label>
                  <input
                    type="text"
                    value={inventorName}
                    onChange={(e) => setInventorName(e.target.value)}
                    placeholder="Jane Smith"
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-patent-500 focus:border-transparent"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Entity Status</label>
                  <select
                    value={entityStatus}
                    onChange={(e) => setEntityStatus(e.target.value as typeof entityStatus)}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-patent-500 focus:border-transparent"
                    disabled={loading}
                  >
                    <option value="micro_entity">Micro Entity</option>
                    <option value="small_entity">Small Entity</option>
                    <option value="regular">Regular (Large) Entity</option>
                  </select>
                </div>
              </div>

              {!showMoreApplicant ? (
                <button
                  type="button"
                  onClick={() => setShowMoreApplicant(true)}
                  className="text-xs text-patent-600 hover:text-patent-700 font-medium mt-2"
                  disabled={loading}
                >
                  + Add citizenship details
                </button>
              ) : (
                <div className="mt-3">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Citizenship</label>
                  <input
                    type="text"
                    value={citizenship}
                    onChange={(e) => setCitizenship(e.target.value)}
                    placeholder="US Citizen"
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-patent-500 focus:border-transparent"
                    disabled={loading}
                  />
                </div>
              )}
            </div>

            <button
              onClick={handleGitHubAnalysis}
              disabled={loading || !repoUrl.trim()}
              className="w-full flex items-center justify-center gap-2 text-white font-semibold py-3.5 px-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed text-base bg-gradient-to-r from-patent-600 to-indigo-600 hover:shadow-lg hover:shadow-patent-600/25"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
              {loading ? 'Analyzing...' : 'Analyze Repository'}
            </button>
          </div>
        </div>
      </div>
      )}

      {/* ZIP upload */}
      {sourceType === 'zip' && (
      <div className="max-w-2xl mx-auto mb-8">
        <div className="bg-white border-2 border-violet-500 rounded-2xl p-8 shadow-md shadow-violet-500/10">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-gradient-to-br from-violet-500 to-purple-500">
              <Upload className="w-7 h-7 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">ZIP Upload</h3>
              <p className="text-sm text-gray-500">Upload a .zip file of your codebase (max 50MB)</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Drop zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                isDragging
                  ? 'border-violet-400 bg-violet-50'
                  : zipFile
                    ? 'border-green-300 bg-green-50'
                    : 'border-gray-200 bg-gray-50 hover:border-gray-300'
              }`}
            >
              {zipFile ? (
                <div className="flex items-center justify-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="text-sm font-medium text-gray-700">{zipFile.name}</span>
                  <span className="text-xs text-gray-400">({(zipFile.size / 1024 / 1024).toFixed(1)} MB)</span>
                  <button
                    onClick={() => setZipFile(null)}
                    className="p-1 text-gray-400 hover:text-gray-600 rounded"
                    disabled={loading}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600 mb-1">Drag & drop your .zip file here</p>
                  <p className="text-xs text-gray-400">or</p>
                  <label className="inline-block mt-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-50 transition-colors">
                    Browse files
                    <input
                      type="file"
                      accept=".zip"
                      onChange={handleFileSelect}
                      className="hidden"
                      disabled={loading}
                    />
                  </label>
                </>
              )}
            </div>

            {/* Applicant Information */}
            <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Applicant Information</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Inventor Full Name *</label>
                  <input
                    type="text"
                    value={inventorName}
                    onChange={(e) => setInventorName(e.target.value)}
                    placeholder="Jane Smith"
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Entity Status</label>
                  <select
                    value={entityStatus}
                    onChange={(e) => setEntityStatus(e.target.value as typeof entityStatus)}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                    disabled={loading}
                  >
                    <option value="micro_entity">Micro Entity</option>
                    <option value="small_entity">Small Entity</option>
                    <option value="regular">Regular (Large) Entity</option>
                  </select>
                </div>
              </div>

              {!showMoreApplicant ? (
                <button
                  type="button"
                  onClick={() => setShowMoreApplicant(true)}
                  className="text-xs text-violet-600 hover:text-violet-700 font-medium mt-2"
                  disabled={loading}
                >
                  + Add citizenship details
                </button>
              ) : (
                <div className="mt-3">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Citizenship</label>
                  <input
                    type="text"
                    value={citizenship}
                    onChange={(e) => setCitizenship(e.target.value)}
                    placeholder="US Citizen"
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                    disabled={loading}
                  />
                </div>
              )}
            </div>

            <button
              onClick={handleZipAnalysis}
              disabled={loading || !zipFile}
              className="w-full flex items-center justify-center gap-2 text-white font-semibold py-3.5 px-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed text-base bg-gradient-to-r from-violet-600 to-purple-600 hover:shadow-lg hover:shadow-violet-600/25"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
              {loading ? 'Analyzing...' : 'Analyze Codebase'}
            </button>
          </div>
        </div>
      </div>
      )}

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
                          ? 'bg-gradient-to-br from-patent-500 to-indigo-500 text-white shadow-lg shadow-patent-500/20'
                          : 'bg-gray-100 text-gray-400'
                    }`}>
                      <StepIcon className={`w-5 h-5 ${isActive && step.key !== 'complete' ? 'animate-pulse' : ''}`} />
                    </div>
                    <span className={`text-xs font-medium mt-2 ${
                      isActive ? 'text-patent-600' : isCompleted ? 'text-green-600' : 'text-gray-400'
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
            <div className="flex items-center gap-3">
              {loading && (
                <span className="flex items-center gap-1.5 text-xs text-gray-400 bg-gray-50 px-2.5 py-1 rounded-lg">
                  <Clock className="w-3.5 h-3.5" />
                  {formatElapsed(elapsed)}
                </span>
              )}
              <span className="text-sm font-semibold text-patent-600">{Math.round(progress.progress)}%</span>
            </div>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2.5">
            <div
              className="bg-gradient-to-r from-patent-500 to-indigo-500 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${progress.progress}%` }}
            />
          </div>

          {/* Caution: do not close */}
          {loading && (
            <div className="flex items-center gap-2.5 mt-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
              <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <p className="text-xs text-amber-800">
                <span className="font-semibold">Caution:</span> The full pipeline can take up to 15 minutes. Do not close or navigate away from this page until the analysis is complete.
              </p>
            </div>
          )}

          {/* Live metrics badges */}
          {Object.keys(metrics).length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {Object.entries(metrics)
                .filter(([key]) => !['topFeatures', 'topPriorArt', 'firstClaimPreview'].includes(key))
                .map(([key, value]) => (
                <span key={key} className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 bg-gray-50 px-2.5 py-1 rounded-lg border border-gray-100">
                  <CheckCircle className="w-3 h-3 text-green-500" />
                  {value}
                </span>
              ))}
            </div>
          )}

          {progress.detail && (
            <p className="text-xs text-gray-400 mt-2 truncate">{progress.detail}</p>
          )}

          {/* Pipeline Insights — richer incremental results */}
          <PipelineInsights metrics={metrics} />

          {/* Patent 101 Tips — contextual education */}
          {loading && progress.step !== 'complete' && (
            <PipelineTips currentStep={progress.step} />
          )}

          {/* Filing Info Wizard — productive use of wait time */}
          {loading && progress.step !== 'complete' && (
            <FilingInfoWizard
              inventors={wizardInventors}
              onInventorsChange={setWizardInventors}
              correspondence={wizardCorrespondence}
              onCorrespondenceChange={setWizardCorrespondence}
              attorney={wizardAttorney}
              onAttorneyChange={setWizardAttorney}
              isOpen={wizardOpen}
              onToggle={() => setWizardOpen(o => !o)}
              primaryInventorName={inventorName}
              primaryCitizenship={citizenship}
            />
          )}
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="space-y-2 mb-4">
          {warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
              <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-amber-800 text-sm">{w}</p>
            </div>
          ))}
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
