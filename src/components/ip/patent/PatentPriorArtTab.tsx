import { useState } from 'react';
import {
  Scroll,
  Search,
  Loader2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  ThumbsUp,
  ThumbsDown,
  Plus,
  FileText,
  Sparkles,
  X
} from 'lucide-react';

interface PriorArtResult {
  id?: string;
  patent_number: string;
  patent_title?: string;
  title?: string;
  patent_abstract?: string;
  abstract?: string;
  patent_assignee?: string;
  assignee?: string;
  patent_url?: string;
  url?: string;
  relevance_score: number;
  similarity_score?: number;
  technical_similarity_score?: number;
  relationship_type?: string;
  is_blocking?: boolean;
  threatened_claims?: number[];
  claim_overlap_analysis?: string;
  similarity_explanation?: string;
  user_marked_relevant?: boolean;
  red_flags?: string[];
  risk_level?: string;
  filing_date?: string;
  inventors?: string[];
}

interface PatentPriorArtTabProps {
  priorArtResults: PriorArtResult[];
  searching: boolean;
  onSearch: () => void;
  onAddManual: (patentNumber: string, notes?: string) => Promise<void>;
  onUpdateRelevance: (priorArtId: string, isRelevant: boolean) => Promise<void>;
  onGenerateComparison: () => Promise<void>;
  comparisonReport: string | null;
  generatingComparison: boolean;
}

function normalizeScore(score: number): number {
  return score <= 1 ? Math.round(score * 100) : Math.round(score);
}

function scoreColor(score: number): string {
  if (score >= 70) return 'text-red-600 bg-red-50';
  if (score >= 40) return 'text-amber-600 bg-amber-50';
  return 'text-green-600 bg-green-50';
}

function scoreBarColor(score: number): string {
  if (score >= 70) return 'bg-red-500';
  if (score >= 40) return 'bg-amber-500';
  return 'bg-green-500';
}

function relationshipBadge(type?: string): { label: string; className: string } {
  switch (type) {
    case 'similar':
      return { label: 'Similar', className: 'bg-red-50 text-red-700 border-red-200' };
    case 'improvement':
      return { label: 'Improvement', className: 'bg-blue-50 text-blue-700 border-blue-200' };
    case 'different_approach':
      return { label: 'Different Approach', className: 'bg-green-50 text-green-700 border-green-200' };
    default:
      return { label: 'Unrelated', className: 'bg-gray-50 text-gray-600 border-gray-200' };
  }
}

export function PatentPriorArtTab({
  priorArtResults,
  searching,
  onSearch,
  onAddManual,
  onUpdateRelevance,
  onGenerateComparison,
  comparisonReport,
  generatingComparison
}: PatentPriorArtTabProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualPatentNumber, setManualPatentNumber] = useState('');
  const [manualNotes, setManualNotes] = useState('');
  const [addingManual, setAddingManual] = useState(false);
  const [showComparison, setShowComparison] = useState(false);

  const blockingCount = priorArtResults.filter(r => r.is_blocking).length;
  const avgRelevance = priorArtResults.length > 0
    ? Math.round(priorArtResults.reduce((sum, r) => sum + normalizeScore(r.relevance_score), 0) / priorArtResults.length)
    : 0;
  const criticalResults = priorArtResults.filter(
    r => r.risk_level === 'critical' || r.risk_level === 'high'
  );
  const highestRisk = criticalResults.length > 0
    ? (criticalResults.some(r => r.risk_level === 'critical') ? 'critical' : 'high')
    : (priorArtResults.some(r => r.risk_level === 'moderate') ? 'moderate' : 'low');

  const handleAddManual = async () => {
    if (!manualPatentNumber.trim()) return;
    setAddingManual(true);
    try {
      await onAddManual(manualPatentNumber.trim(), manualNotes.trim() || undefined);
      setManualPatentNumber('');
      setManualNotes('');
      setShowManualForm(false);
    } finally {
      setAddingManual(false);
    }
  };

  // Empty state
  if (priorArtResults.length === 0 && !searching) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 flex items-center justify-center mx-auto mb-4">
          <Scroll className="w-7 h-7 text-indigo-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-800 mb-2">No Prior Art Results</h3>
        <p className="text-gray-500 text-sm mb-6 max-w-sm mx-auto">
          Search for existing patents related to your invention to strengthen your application.
        </p>
        <button
          onClick={onSearch}
          disabled={searching}
          className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 transition-all shadow-md shadow-blue-200"
        >
          <Search className="w-4 h-4" />
          Search Prior Art
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center">
            <Scroll className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Prior Art Search</h3>
            <p className="text-sm text-gray-500">Existing patents related to your invention</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowManualForm(!showManualForm)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Manual
          </button>
          <button
            onClick={onSearch}
            disabled={searching}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 transition-all shadow-sm"
          >
            {searching ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Searching...</>
            ) : (
              <><Search className="w-4 h-4" /> Search</>
            )}
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 p-4 border border-blue-100">
          <p className="text-2xl font-bold text-blue-700">{priorArtResults.length}</p>
          <p className="text-xs font-medium text-blue-600 mt-1">Patents Found</p>
        </div>
        <div className={`rounded-2xl p-4 border ${blockingCount > 0 ? 'bg-gradient-to-br from-red-50 to-orange-50 border-red-100' : 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-100'}`}>
          <p className={`text-2xl font-bold ${blockingCount > 0 ? 'text-red-700' : 'text-green-700'}`}>{blockingCount}</p>
          <p className={`text-xs font-medium mt-1 ${blockingCount > 0 ? 'text-red-600' : 'text-green-600'}`}>Blocking Patents</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-yellow-50 p-4 border border-amber-100">
          <p className="text-2xl font-bold text-amber-700">{avgRelevance}%</p>
          <p className="text-xs font-medium text-amber-600 mt-1">Avg Relevance</p>
        </div>
        <div className={`rounded-2xl p-4 border ${
          highestRisk === 'critical' ? 'bg-gradient-to-br from-red-50 to-rose-50 border-red-200' :
          highestRisk === 'high' ? 'bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200' :
          highestRisk === 'moderate' ? 'bg-gradient-to-br from-yellow-50 to-amber-50 border-yellow-200' :
          'bg-gradient-to-br from-green-50 to-emerald-50 border-green-100'
        }`}>
          <p className={`text-2xl font-bold capitalize ${
            highestRisk === 'critical' ? 'text-red-700' :
            highestRisk === 'high' ? 'text-orange-700' :
            highestRisk === 'moderate' ? 'text-amber-700' :
            'text-green-700'
          }`}>{highestRisk}</p>
          <p className={`text-xs font-medium mt-1 ${
            highestRisk === 'critical' ? 'text-red-600' :
            highestRisk === 'high' ? 'text-orange-600' :
            highestRisk === 'moderate' ? 'text-amber-600' :
            'text-green-600'
          }`}>Risk Level</p>
        </div>
      </div>

      {/* Red Flags Panel */}
      {criticalResults.length > 0 && (
        <div className="rounded-2xl border-2 border-red-200 bg-gradient-to-br from-red-50 to-orange-50 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <ShieldAlert className="w-5 h-5 text-red-600" />
            <h4 className="text-sm font-bold text-red-800">Patent Risk Flags</h4>
            <span className="text-xs font-medium text-red-600 bg-red-100 px-2 py-0.5 rounded-full">{criticalResults.length} issue{criticalResults.length > 1 ? 's' : ''}</span>
          </div>
          <div className="space-y-3">
            {criticalResults.map((result, idx) => {
              const title = result.patent_title || result.title || 'Unknown Patent';
              const flags = result.red_flags || [];
              return (
                <div key={`flag-${idx}`} className="bg-white/70 rounded-xl p-3 border border-red-100">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-mono font-semibold text-red-700 bg-red-100 px-2 py-0.5 rounded-md">{result.patent_number}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${result.risk_level === 'critical' ? 'text-white bg-red-600' : 'text-orange-800 bg-orange-200'}`}>
                      {(result.risk_level || '').toUpperCase()}
                    </span>
                    <span className="text-xs font-medium text-gray-700 truncate">{title}</span>
                  </div>
                  {flags.length > 0 && (
                    <ul className="space-y-1 ml-1">
                      {flags.map((flag, fi) => (
                        <li key={fi} className="text-xs text-red-700 leading-relaxed flex items-start gap-1.5">
                          <span className="text-red-400 mt-0.5 flex-shrink-0">-</span>
                          {flag}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-red-600 mt-3 font-medium">
            {criticalResults.length} patent{criticalResults.length > 1 ? 's' : ''} require design-around review before filing.
          </p>
        </div>
      )}

      {/* Manual entry form */}
      {showManualForm && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold text-gray-900">Add Patent Manually</h4>
            <button onClick={() => setShowManualForm(false)} className="text-gray-400 hover:text-gray-600 p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-3">
            <input
              type="text"
              value={manualPatentNumber}
              onChange={e => setManualPatentNumber(e.target.value)}
              placeholder="Patent number (e.g., US-11556757-B2)"
              className="w-full px-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white outline-none transition-all"
            />
            <textarea
              value={manualNotes}
              onChange={e => setManualNotes(e.target.value)}
              placeholder="Notes (optional)"
              rows={2}
              className="w-full px-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white outline-none transition-all resize-none"
            />
            <button
              onClick={handleAddManual}
              disabled={addingManual || !manualPatentNumber.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 transition-all shadow-sm"
            >
              {addingManual ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Add Patent
            </button>
          </div>
        </div>
      )}

      {/* Results list */}
      <div className="space-y-3">
        {priorArtResults.map((result, idx) => {
          const id = result.id || `prior-art-${idx}`;
          const isExpanded = expandedId === id;
          const title = result.patent_title || result.title || 'Unknown Patent';
          const abstract = result.patent_abstract || result.abstract || '';
          const assignee = result.patent_assignee || result.assignee || '';
          const url = result.patent_url || result.url || '';
          const relevance = normalizeScore(result.relevance_score);
          const similarity = normalizeScore(result.similarity_score ?? result.technical_similarity_score ?? 0);
          const badge = relationshipBadge(result.relationship_type);

          return (
            <div key={id} className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                        {result.patent_number}
                      </span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-md border ${badge.className}`}>
                        {badge.label}
                      </span>
                      {result.is_blocking && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-md border border-red-200">
                          <ShieldAlert className="w-3 h-3" />
                          Blocking
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm font-semibold text-gray-900 mt-2 line-clamp-2">{title}</h4>
                    {assignee && <p className="text-xs text-gray-500 mt-1">{assignee}</p>}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {url && (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                        title="View on Google Patents"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                    {result.id && (
                      <>
                        <button
                          onClick={() => onUpdateRelevance(result.id!, true)}
                          className={`p-1.5 rounded-lg transition-all ${result.user_marked_relevant === true ? 'text-green-600 bg-green-50' : 'text-gray-400 hover:text-green-600 hover:bg-green-50'}`}
                          title="Mark as relevant"
                        >
                          <ThumbsUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onUpdateRelevance(result.id!, false)}
                          className={`p-1.5 rounded-lg transition-all ${result.user_marked_relevant === false ? 'text-red-600 bg-red-50' : 'text-gray-400 hover:text-red-600 hover:bg-red-50'}`}
                          title="Mark as not relevant"
                        >
                          <ThumbsDown className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Score bars */}
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-500">Relevance</span>
                      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${scoreColor(relevance)}`}>{relevance}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${scoreBarColor(relevance)}`} style={{ width: `${relevance}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-500">Similarity</span>
                      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${scoreColor(similarity)}`}>{similarity}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${scoreBarColor(similarity)}`} style={{ width: `${similarity}%` }} />
                    </div>
                  </div>
                </div>

                {/* Expand toggle */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : id)}
                  className="flex items-center gap-1 mt-3 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                >
                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  {isExpanded ? 'Show less' : 'Show details'}
                </button>
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div className="px-4 pb-4 pt-1 border-t border-gray-50 space-y-3">
                  {(result.filing_date || (result.inventors && result.inventors.length > 0)) && (
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {result.filing_date && (
                        <p className="text-xs text-gray-500">
                          Filed: {new Date(result.filing_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}
                        </p>
                      )}
                      {result.inventors && result.inventors.length > 0 && (
                        <p className="text-xs text-gray-500">
                          Inventors: {result.inventors.slice(0, 3).join(', ')}{result.inventors.length > 3 ? ' et al.' : ''}
                        </p>
                      )}
                    </div>
                  )}
                  {result.red_flags && result.red_flags.length > 0 && (
                    <div className="bg-red-50 rounded-lg p-2.5 border border-red-100">
                      <p className="text-xs font-semibold text-red-700 mb-1">Risk Flags</p>
                      <ul className="space-y-0.5">
                        {result.red_flags.map((flag, fi) => (
                          <li key={fi} className="text-xs text-red-600 leading-relaxed">- {flag}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {abstract && (
                    <div>
                      <p className="text-xs font-semibold text-gray-700 mb-1">Abstract</p>
                      <p className="text-xs text-gray-600 leading-relaxed">{abstract}</p>
                    </div>
                  )}
                  {result.similarity_explanation && (
                    <div>
                      <p className="text-xs font-semibold text-gray-700 mb-1">Similarity Analysis</p>
                      <p className="text-xs text-gray-600 leading-relaxed">{result.similarity_explanation}</p>
                    </div>
                  )}
                  {result.threatened_claims && result.threatened_claims.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-700 mb-1">Threatened Claims</p>
                      <div className="flex flex-wrap gap-1">
                        {result.threatened_claims.map(num => (
                          <span key={num} className="text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-md border border-red-200">
                            Claim {num}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {result.claim_overlap_analysis && (
                    <div>
                      <p className="text-xs font-semibold text-gray-700 mb-1">Claim Overlap Analysis</p>
                      <p className="text-xs text-gray-600 leading-relaxed">{result.claim_overlap_analysis}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Comparison report section */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-600" />
            <h4 className="text-sm font-semibold text-gray-900">Prior Art Comparison Report</h4>
          </div>
          <div className="flex items-center gap-2">
            {comparisonReport && (
              <button
                onClick={() => setShowComparison(!showComparison)}
                className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
              >
                {showComparison ? 'Hide' : 'Show'}
              </button>
            )}
            <button
              onClick={onGenerateComparison}
              disabled={generatingComparison || priorArtResults.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-gradient-to-r from-indigo-600 to-violet-600 rounded-lg hover:from-indigo-700 hover:to-violet-700 disabled:opacity-50 transition-all"
            >
              {generatingComparison ? (
                <><Loader2 className="w-3 h-3 animate-spin" /> Generating...</>
              ) : (
                <><Sparkles className="w-3 h-3" /> Generate</>
              )}
            </button>
          </div>
        </div>
        {comparisonReport && showComparison && (
          <div className="p-5">
            <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{comparisonReport}</div>
          </div>
        )}
        {!comparisonReport && !generatingComparison && (
          <div className="p-5 text-center">
            <p className="text-xs text-gray-400">Generate a comparison to see how your invention differs from prior art</p>
          </div>
        )}
        {generatingComparison && (
          <div className="p-8 text-center">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-500 mx-auto mb-2" />
            <p className="text-xs text-gray-500">Analyzing prior art differences...</p>
          </div>
        )}
      </div>
    </div>
  );
}
