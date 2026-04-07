import { Sparkles, BookOpen, Target, FileText } from 'lucide-react';

interface PipelineInsightsProps {
  metrics: Record<string, string>;
}

export function PipelineInsights({ metrics }: PipelineInsightsProps) {
  const topFeatures = metrics.topFeatures?.split('|').filter(Boolean) || [];
  const topPriorArt = metrics.topPriorArt?.split('|').filter(Boolean) || [];
  const firstClaimPreview = metrics.firstClaimPreview || '';

  // Parse novelty score from "Novelty: 78/100" format
  let noveltyScore: number | null = null;
  if (metrics.novelty) {
    const match = metrics.novelty.match(/(\d+)/);
    if (match) noveltyScore = parseInt(match[1], 10);
  }

  const hasAnyInsight = topFeatures.length > 0 || topPriorArt.length > 0 || noveltyScore !== null || firstClaimPreview;
  if (!hasAnyInsight) return null;

  const getNoveltyColor = (score: number) => {
    if (score >= 70) return { bar: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50', label: 'Strong' };
    if (score >= 40) return { bar: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50', label: 'Moderate' };
    return { bar: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50', label: 'Needs Work' };
  };

  return (
    <div className="mt-4 space-y-3 animate-in fade-in duration-500">
      {/* Top Features */}
      {topFeatures.length > 0 && (
        <div className="bg-violet-50/50 border border-violet-100 rounded-xl p-3.5">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-violet-600" />
            <span className="text-xs font-semibold text-violet-800">Discovered Features</span>
          </div>
          <div className="space-y-1">
            {topFeatures.map((name, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs font-medium text-violet-400 w-4">{i + 1}.</span>
                <span className="text-xs text-violet-700 truncate">{name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Novelty Score Gauge */}
      {noveltyScore !== null && (
        <div className="bg-white border border-gray-100 rounded-xl p-3.5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Target className="w-3.5 h-3.5 text-gray-600" />
              <span className="text-xs font-semibold text-gray-800">Novelty Score</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getNoveltyColor(noveltyScore).bg} ${getNoveltyColor(noveltyScore).text}`}>
                {getNoveltyColor(noveltyScore).label}
              </span>
              <span className="text-sm font-bold text-gray-900">{noveltyScore}/100</span>
            </div>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-700 ${getNoveltyColor(noveltyScore).bar}`}
              style={{ width: `${noveltyScore}%` }}
            />
          </div>
        </div>
      )}

      {/* Prior Art Matches */}
      {topPriorArt.length > 0 && (
        <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-3.5">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="w-3.5 h-3.5 text-amber-600" />
            <span className="text-xs font-semibold text-amber-800">Related Prior Art</span>
          </div>
          <div className="space-y-1">
            {topPriorArt.map((title, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-xs text-amber-400 mt-0.5">-</span>
                <span className="text-xs text-amber-700 line-clamp-1">{title}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* First Claim Preview */}
      {firstClaimPreview && (
        <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3.5">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-xs font-semibold text-blue-800">First Independent Claim</span>
          </div>
          <p className="text-xs text-blue-700/80 font-mono leading-relaxed line-clamp-3">
            1. {firstClaimPreview}{firstClaimPreview.length >= 200 ? '...' : ''}
          </p>
        </div>
      )}
    </div>
  );
}
