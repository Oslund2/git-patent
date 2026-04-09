import { useState } from 'react';
import {
  BarChart3,
  Loader2,
  Sparkles,
  CheckCircle,
  AlertTriangle,
  Lightbulb,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Zap
} from 'lucide-react';

interface KeyFeature {
  feature_name: string;
  description: string;
  novelty_score: number;
}

interface NoveltyAnalysisData {
  overall_novelty_score: number;
  confidence_score: number;
  technical_depth_score: number;
  implementation_uniqueness_score: number;
  commercial_viability_score: number;
  patentability_assessment: string;
  novelty_strengths: string[];
  novelty_weaknesses: string[];
  recommendations: string[];
  key_features: KeyFeature[];
  ai_dimensional_scores?: {
    novelty_102?: { score: number; reasoning: string };
    non_obviousness_103?: { score: number; reasoning: string };
    technical_depth?: { score: number; reasoning: string };
    prior_art_differentiation?: { score: number; reasoning: string };
  } | null;
}

interface ClaimAnalysis {
  claimNumber: number;
  riskScore: number;
  riskLevel: string;
  abstractIdeaRisk: string;
  technicalAnchoringStrength: string;
  improvementEvidence: string;
  vulnerablePhrases: string[];
  strengths: string[];
  recommendations: string[];
}

interface AliceRiskData {
  overallAliceRiskScore: number;
  riskLevel: 'Low' | 'Medium' | 'High';
  claimAnalysis: ClaimAnalysis[];
  overallStrengths: string[];
  overallWeaknesses: string[];
  recommendedImprovements: string[];
  summary: string;
}

interface PatentAnalysisTabProps {
  noveltyAnalysis: NoveltyAnalysisData | null;
  aliceRiskAssessment: AliceRiskData | null;
  analyzing: boolean;
  analyzingAlice: boolean;
  onRunNoveltyAnalysis: () => void;
  onRunAliceRisk: () => void;
  hasClaims: boolean;
}

function ScoreRing({ score, size = 80, strokeWidth = 6, color = 'text-blue-600' }: { score: number; size?: number; strokeWidth?: number; color?: string }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={strokeWidth} className="text-gray-100" />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={strokeWidth} className={color} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <span className="absolute text-lg font-bold text-gray-900">{Math.round(score)}</span>
    </div>
  );
}

function SubScoreCard({ label, score, color }: { label: string; score: number; color: string }) {
  return (
    <div className="rounded-xl bg-gray-50 p-3">
      <p className="text-xs text-gray-500 mb-2">{label}</p>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(score, 100)}%` }} />
        </div>
        <span className="text-xs font-semibold text-gray-700 w-8 text-right">{Math.round(score)}</span>
      </div>
    </div>
  );
}

function riskLevelColor(level: string): string {
  switch (level) {
    case 'Low': return 'text-green-700 bg-green-50 border-green-200';
    case 'Medium': return 'text-amber-700 bg-amber-50 border-amber-200';
    case 'High': return 'text-red-700 bg-red-50 border-red-200';
    default: return 'text-gray-700 bg-gray-50 border-gray-200';
  }
}

export function PatentAnalysisTab({
  noveltyAnalysis,
  aliceRiskAssessment,
  analyzing,
  analyzingAlice,
  onRunNoveltyAnalysis,
  onRunAliceRisk,
  hasClaims
}: PatentAnalysisTabProps) {
  const [expandedClaim, setExpandedClaim] = useState<number | null>(null);
  const [activeSection, setActiveSection] = useState<'novelty' | 'alice'>('novelty');

  const hasAny = noveltyAnalysis || aliceRiskAssessment;

  // Empty state
  if (!hasAny && !analyzing && !analyzingAlice) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-50 to-purple-50 flex items-center justify-center mx-auto mb-4">
          <BarChart3 className="w-7 h-7 text-violet-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-800 mb-2">No Analysis Yet</h3>
        <p className="text-gray-500 text-sm mb-6 max-w-sm mx-auto">
          Run AI-powered analysis to evaluate patentability, novelty, and Alice/Mayo risk.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={onRunNoveltyAnalysis}
            disabled={analyzing}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 transition-all shadow-md shadow-blue-200"
          >
            <Sparkles className="w-4 h-4" />
            Novelty Analysis
          </button>
          <button
            onClick={onRunAliceRisk}
            disabled={analyzingAlice || !hasClaims}
            className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:shadow-sm disabled:opacity-50 transition-all"
            title={!hasClaims ? 'Generate claims first' : 'Run Alice/Mayo risk assessment'}
          >
            <ShieldAlert className="w-4 h-4" />
            Alice Risk
          </button>
        </div>
        {!hasClaims && (
          <p className="text-xs text-amber-600 mt-3 flex items-center justify-center gap-1">
            <AlertCircle className="w-3 h-3" />
            Alice risk assessment requires claims to be generated first
          </p>
        )}
      </div>
    );
  }

  // Loading state
  if ((analyzing && !noveltyAnalysis) || (analyzingAlice && !aliceRiskAssessment && !noveltyAnalysis)) {
    return (
      <div className="text-center py-16">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-800 mb-1">
          {analyzing ? 'Running Novelty Analysis...' : 'Running Alice Risk Assessment...'}
        </h3>
        <p className="text-sm text-gray-500">This may take a minute</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with action buttons */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Patent Analysis</h3>
            <p className="text-sm text-gray-500">Patentability and risk assessment</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onRunNoveltyAnalysis}
            disabled={analyzing}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 transition-all shadow-sm"
          >
            {analyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {analyzing ? 'Analyzing...' : 'Novelty'}
          </button>
          <button
            onClick={onRunAliceRisk}
            disabled={analyzingAlice || !hasClaims}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-50 transition-all"
          >
            {analyzingAlice ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldAlert className="w-3.5 h-3.5" />}
            {analyzingAlice ? 'Assessing...' : 'Alice Risk'}
          </button>
        </div>
      </div>

      {/* Section toggle if both exist */}
      {noveltyAnalysis && aliceRiskAssessment && (
        <div className="bg-white rounded-xl border border-gray-100 p-1 inline-flex gap-1">
          <button
            onClick={() => setActiveSection('novelty')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${activeSection === 'novelty' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Novelty Analysis
          </button>
          <button
            onClick={() => setActiveSection('alice')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${activeSection === 'alice' ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Alice Risk
          </button>
        </div>
      )}

      {/* Novelty Analysis Section */}
      {(activeSection === 'novelty' || !aliceRiskAssessment) && noveltyAnalysis && (
        <div className="space-y-5">
          {/* Score dashboard */}
          <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-6">
            <div className="flex items-center gap-8">
              <div className="text-center">
                <ScoreRing score={noveltyAnalysis.overall_novelty_score} size={100} strokeWidth={8} color="text-blue-600" />
                <p className="text-xs font-medium text-gray-500 mt-2">Novelty Score</p>
              </div>
              <div className="flex-1 grid grid-cols-2 gap-3">
                <SubScoreCard label="Technical Depth" score={noveltyAnalysis.technical_depth_score} color="bg-blue-500" />
                <SubScoreCard label="Prior Art Distance" score={noveltyAnalysis.implementation_uniqueness_score} color="bg-indigo-500" />
                <SubScoreCard label="Non-Obviousness" score={noveltyAnalysis.commercial_viability_score} color="bg-violet-500" />
                <SubScoreCard label="Approval Probability" score={noveltyAnalysis.confidence_score * 100} color="bg-purple-500" />
              </div>
            </div>
          </div>

          {/* Patentability assessment */}
          {noveltyAnalysis.patentability_assessment && (
            <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5">
              <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" />
                Patentability Assessment
              </h4>
              <p className="text-sm text-gray-700 leading-relaxed">{noveltyAnalysis.patentability_assessment}</p>
            </div>
          )}

          {/* Strengths / Weaknesses */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5">
              <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                Strengths
              </h4>
              <ul className="space-y-2">
                {noveltyAnalysis.novelty_strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                    <CheckCircle className="w-3.5 h-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5">
              <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Weaknesses
              </h4>
              <ul className="space-y-2">
                {noveltyAnalysis.novelty_weaknesses.map((w, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Recommendations */}
          {noveltyAnalysis.recommendations.length > 0 && (
            <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5">
              <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-yellow-500" />
                Recommendations
              </h4>
              <ol className="space-y-2">
                {noveltyAnalysis.recommendations.map((r, i) => (
                  <li key={i} className="flex items-start gap-3 text-xs text-gray-700">
                    <span className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 font-semibold flex items-center justify-center flex-shrink-0 text-[10px]">{i + 1}</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Key features */}
          {noveltyAnalysis.key_features.length > 0 && (
            <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5">
              <h4 className="text-sm font-semibold text-gray-900 mb-4">Feature Novelty Scores</h4>
              <div className="space-y-3">
                {noveltyAnalysis.key_features.map((f, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-800 truncate max-w-[70%]">{f.feature_name}</span>
                      <span className="text-xs font-semibold text-gray-600">{f.novelty_score}/100</span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${f.novelty_score >= 70 ? 'bg-green-500' : f.novelty_score >= 50 ? 'bg-blue-500' : 'bg-amber-500'}`}
                        style={{ width: `${f.novelty_score}%` }}
                      />
                    </div>
                    {f.description && <p className="text-[10px] text-gray-400 mt-0.5 truncate">{f.description}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Alice Risk Section */}
      {(activeSection === 'alice' || !noveltyAnalysis) && aliceRiskAssessment && (
        <div className="space-y-5">
          {/* Overall risk */}
          <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-6">
            <div className="flex items-center gap-6">
              <ScoreRing
                score={aliceRiskAssessment.overallAliceRiskScore}
                size={100}
                strokeWidth={8}
                color={aliceRiskAssessment.riskLevel === 'Low' ? 'text-green-500' : aliceRiskAssessment.riskLevel === 'Medium' ? 'text-amber-500' : 'text-red-500'}
              />
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="text-base font-semibold text-gray-900">Alice/Mayo Risk</h4>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${riskLevelColor(aliceRiskAssessment.riskLevel)}`}>
                    {aliceRiskAssessment.riskLevel} Risk
                  </span>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">{aliceRiskAssessment.summary}</p>
              </div>
            </div>
          </div>

          {/* Per-claim analysis */}
          {aliceRiskAssessment.claimAnalysis.length > 0 && (
            <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-50">
                <h4 className="text-sm font-semibold text-gray-900">Claim-by-Claim Analysis</h4>
              </div>
              <div className="divide-y divide-gray-50">
                {aliceRiskAssessment.claimAnalysis.map(claim => {
                  const isExpanded = expandedClaim === claim.claimNumber;
                  return (
                    <div key={claim.claimNumber}>
                      <button
                        onClick={() => setExpandedClaim(isExpanded ? null : claim.claimNumber)}
                        className="w-full px-5 py-3 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-semibold text-gray-700">Claim {claim.claimNumber}</span>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${riskLevelColor(claim.riskLevel)}`}>
                            {claim.riskLevel} ({claim.riskScore})
                          </span>
                        </div>
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                      </button>
                      {isExpanded && (
                        <div className="px-5 pb-4 space-y-3">
                          {claim.abstractIdeaRisk && (
                            <div>
                              <p className="text-xs font-semibold text-gray-700 mb-1">Abstract Idea Risk</p>
                              <p className="text-xs text-gray-600">{claim.abstractIdeaRisk}</p>
                            </div>
                          )}
                          {claim.technicalAnchoringStrength && (
                            <div>
                              <p className="text-xs font-semibold text-gray-700 mb-1">Technical Anchoring</p>
                              <p className="text-xs text-gray-600">{claim.technicalAnchoringStrength}</p>
                            </div>
                          )}
                          {claim.improvementEvidence && (
                            <div>
                              <p className="text-xs font-semibold text-gray-700 mb-1">Improvement Evidence</p>
                              <p className="text-xs text-gray-600">{claim.improvementEvidence}</p>
                            </div>
                          )}
                          {claim.vulnerablePhrases?.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-gray-700 mb-1">Vulnerable Phrases</p>
                              <div className="flex flex-wrap gap-1">
                                {claim.vulnerablePhrases.map((phrase, i) => (
                                  <span key={i} className="text-[10px] font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-md border border-red-200">
                                    {phrase}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {claim.strengths?.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-gray-700 mb-1">Strengths</p>
                              <ul className="space-y-1">
                                {claim.strengths.map((s, i) => (
                                  <li key={i} className="flex items-start gap-1.5 text-xs text-gray-600">
                                    <CheckCircle className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                                    {s}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {claim.recommendations?.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-gray-700 mb-1">Recommendations</p>
                              <ul className="space-y-1">
                                {claim.recommendations.map((r, i) => (
                                  <li key={i} className="flex items-start gap-1.5 text-xs text-gray-600">
                                    <Lightbulb className="w-3 h-3 text-yellow-500 mt-0.5 flex-shrink-0" />
                                    {r}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Overall strengths/weaknesses */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5">
              <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                Eligibility Strengths
              </h4>
              <ul className="space-y-2">
                {aliceRiskAssessment.overallStrengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                    <CheckCircle className="w-3.5 h-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5">
              <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Eligibility Concerns
              </h4>
              <ul className="space-y-2">
                {aliceRiskAssessment.overallWeaknesses.map((w, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Recommended improvements */}
          {aliceRiskAssessment.recommendedImprovements.length > 0 && (
            <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5">
              <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-yellow-500" />
                Recommended Improvements
              </h4>
              <ol className="space-y-2">
                {aliceRiskAssessment.recommendedImprovements.map((r, i) => (
                  <li key={i} className="flex items-start gap-3 text-xs text-gray-700">
                    <span className="w-5 h-5 rounded-full bg-amber-50 text-amber-600 font-semibold flex items-center justify-center flex-shrink-0 text-[10px]">{i + 1}</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}

      {/* Show loading for Alice when novelty already exists */}
      {analyzingAlice && !aliceRiskAssessment && noveltyAnalysis && (
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-8 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-red-400 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-700">Running Alice/Mayo Risk Assessment...</p>
          <p className="text-xs text-gray-500 mt-1">Analyzing claims for 35 USC 101 eligibility</p>
        </div>
      )}
    </div>
  );
}
