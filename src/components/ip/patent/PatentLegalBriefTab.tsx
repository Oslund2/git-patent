import { useState } from 'react';
import { Scale, Loader2, Download, CheckCircle, XCircle, AlertTriangle, ShieldAlert, FileText } from 'lucide-react';
import { loadLegalBriefData, downloadLegalBrief, type LegalBriefData } from '../../../services/patent/legalBriefService';

interface PatentLegalBriefTabProps {
  applicationId: string;
  projectId: string;
}

export function PatentLegalBriefTab({ applicationId, projectId }: PatentLegalBriefTabProps) {
  const [loading, setLoading] = useState(false);
  const [briefData, setBriefData] = useState<LegalBriefData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await loadLegalBriefData(applicationId, projectId);
      setBriefData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (briefData) downloadLegalBrief(briefData);
  };

  // Compute summary from data
  const compliance = briefData ? [
    { item: 'Specification', ok: briefData.hasDetailedDescription },
    { item: 'Abstract', ok: briefData.hasAbstract },
    { item: 'Claims', ok: briefData.totalClaims > 0 },
    { item: 'Drawings', ok: briefData.drawingsCount > 0 },
    { item: 'Inventor', ok: !!briefData.inventorName },
    { item: 'Prior Art Search', ok: briefData.priorArtCount > 0 },
  ] : [];

  const passCount = compliance.filter(c => c.ok).length;
  const readiness = compliance.length > 0 ? Math.round((passCount / compliance.length) * 100) : 0;

  const noveltyColor = !briefData ? 'text-gray-400' :
    briefData.noveltyScore >= 60 ? 'text-green-600' :
    briefData.noveltyScore >= 40 ? 'text-amber-600' : 'text-red-600';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center">
            <Scale className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Legal Brief</h3>
            <p className="text-sm text-gray-500">Patent Filing Readiness Report</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {briefData && (
            <button onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all">
              <Download className="w-4 h-4" />
              Download PDF
            </button>
          )}
          <button onClick={handleGenerate} disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-semibold rounded-xl hover:from-violet-700 hover:to-purple-700 disabled:opacity-50 transition-all shadow-md shadow-violet-200">
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
            ) : (
              <><Scale className="w-4 h-4" /> {briefData ? 'Regenerate' : 'Generate Report'}</>
            )}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
          <ShieldAlert className="w-4 h-4 text-red-500 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Empty state */}
      {!briefData && !loading && !error && (
        <div className="text-center py-20 bg-white border border-gray-100 rounded-2xl shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center mx-auto mb-4">
            <Scale className="w-7 h-7 text-violet-300" />
          </div>
          <p className="text-gray-600 font-medium mb-1">No report generated yet</p>
          <p className="text-gray-400 text-sm mb-6 max-w-md mx-auto">
            Generate a comprehensive legal readiness assessment covering risk analysis,
            compliance checklist, prior art exposure, and recommended next steps.
          </p>
          <button onClick={handleGenerate} disabled={loading}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-semibold rounded-xl hover:from-violet-700 hover:to-purple-700 disabled:opacity-50 transition-all shadow-md shadow-violet-200">
            <Scale className="w-4 h-4" />
            Generate Legal Brief
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-20 bg-white border border-gray-100 rounded-2xl shadow-sm">
          <Loader2 className="w-8 h-8 animate-spin text-violet-500 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">Analyzing patent application...</p>
          <p className="text-gray-400 text-xs mt-1">Loading features, claims, prior art, and novelty data</p>
        </div>
      )}

      {/* Report dashboard */}
      {briefData && !loading && (
        <>
          {/* Top metrics */}
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-white border border-gray-100 rounded-2xl p-4 text-center shadow-sm">
              <p className={`text-3xl font-bold ${readiness >= 80 ? 'text-green-600' : readiness >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                {readiness}%
              </p>
              <p className="text-xs text-gray-500 mt-1">Compliance</p>
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl p-4 text-center shadow-sm">
              <p className={`text-3xl font-bold ${noveltyColor}`}>{briefData.noveltyScore}</p>
              <p className="text-xs text-gray-500 mt-1">Novelty Score</p>
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl p-4 text-center shadow-sm">
              <p className="text-3xl font-bold text-gray-800">{briefData.totalClaims}</p>
              <p className="text-xs text-gray-500 mt-1">Claims</p>
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl p-4 text-center shadow-sm">
              <p className="text-3xl font-bold text-gray-800">{briefData.priorArtCount}</p>
              <p className="text-xs text-gray-500 mt-1">Prior Art Refs</p>
            </div>
          </div>

          {/* Compliance checklist */}
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
            <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-violet-500" />
              Filing Compliance
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {compliance.map(item => (
                <div key={item.item} className="flex items-center gap-2 text-xs">
                  {item.ok ? (
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  )}
                  <span className={item.ok ? 'text-gray-700' : 'text-gray-500'}>{item.item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Risk summary */}
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
            <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-500" />
              Risk Summary
            </h4>
            <div className="space-y-2">
              {(() => {
                const riskCounts = { Critical: 0, High: 0, Medium: 0, Low: 0 };
                // Count risks from the data
                if (briefData.blockingPriorArt > 0) riskCounts.Critical++;
                if (briefData.totalClaims === 0) riskCounts.Critical++;
                if (briefData.noveltyScore < 40) riskCounts.High++;
                if (briefData.priorArtCount === 0) riskCounts.High++;
                if (briefData.aliceRiskScore && briefData.aliceRiskScore > 50) riskCounts.High++;
                if (briefData.specificationWordCount < 500) riskCounts.High++;
                if (briefData.weakNoveltyCount > briefData.strongNoveltyCount) riskCounts.Medium++;
                if (briefData.independentClaims < 2 && briefData.totalClaims > 0) riskCounts.Medium++;
                if (briefData.drawingsCount === 0) riskCounts.Medium++;

                return (
                  <div className="flex items-center gap-4">
                    {Object.entries(riskCounts).filter(([, count]) => count > 0).map(([level, count]) => (
                      <div key={level} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${
                        level === 'Critical' ? 'bg-red-50 text-red-700 border border-red-200' :
                        level === 'High' ? 'bg-orange-50 text-orange-700 border border-orange-200' :
                        level === 'Medium' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                        'bg-green-50 text-green-700 border border-green-200'
                      }`}>
                        <AlertTriangle className="w-3 h-3" />
                        {count} {level}
                      </div>
                    ))}
                    {Object.values(riskCounts).every(c => c === 0) && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
                        <CheckCircle className="w-3 h-3" />
                        No significant risks identified
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Novelty assessment */}
          {briefData.patentabilityAssessment && (
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Patentability Assessment</h4>
              <p className="text-xs text-gray-600 leading-relaxed">{briefData.patentabilityAssessment}</p>

              {briefData.noveltyStrengths.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-semibold text-green-700 mb-1">Strengths</p>
                  <ul className="space-y-1">
                    {briefData.noveltyStrengths.slice(0, 4).map((s, i) => (
                      <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                        <CheckCircle className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />{s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {briefData.noveltyWeaknesses.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-semibold text-amber-700 mb-1">Weaknesses</p>
                  <ul className="space-y-1">
                    {briefData.noveltyWeaknesses.slice(0, 4).map((w, i) => (
                      <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                        <AlertTriangle className="w-3 h-3 text-amber-500 mt-0.5 flex-shrink-0" />{w}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Prior art highlights */}
          {briefData.priorArtDetails.length > 0 && (
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Top Prior Art References</h4>
              <div className="space-y-2">
                {briefData.priorArtDetails.slice(0, 5).map((pa, i) => (
                  <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${pa.blocking ? 'border-red-200 bg-red-50' : 'border-gray-100'}`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      pa.relevance >= 80 ? 'bg-red-100 text-red-700' :
                      pa.relevance >= 50 ? 'bg-amber-100 text-amber-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {pa.relevance}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-800 truncate">
                        {pa.number} {pa.blocking && <span className="text-red-600">[BLOCKING]</span>}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{pa.title}</p>
                      {pa.explanation && <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{pa.explanation}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {briefData.noveltyRecommendations.length > 0 && (
            <div className="bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-200 rounded-2xl p-5">
              <h4 className="text-sm font-semibold text-violet-900 mb-3">Recommended Next Steps</h4>
              <ol className="space-y-2">
                {briefData.noveltyRecommendations.slice(0, 6).map((rec, i) => (
                  <li key={i} className="text-xs text-violet-800 flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-violet-200 text-violet-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">{i + 1}</span>
                    {rec}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Download CTA */}
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 text-center">
            <p className="text-sm text-gray-600 mb-3">Download the full report as a multi-page PDF for attorney review</p>
            <button onClick={handleDownload}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-semibold rounded-xl hover:from-violet-700 hover:to-purple-700 transition-all shadow-md shadow-violet-200">
              <Download className="w-4 h-4" />
              Download Git-Patent Legal Brief
            </button>
          </div>
        </>
      )}
    </div>
  );
}
