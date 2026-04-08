import { useEffect, useState } from 'react';
import { FileText, Sparkles, ChevronRight, Code, Star } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useProject } from '../../contexts/ProjectContext';
import type { ExtractedFeature } from '../../types';

interface AnalysisResultsProps {
  onNavigate: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  algorithm: 'Algorithm',
  data_structure: 'Data Structure',
  integration: 'Integration',
  ui_pattern: 'UI Pattern',
  optimization: 'Optimization',
  architecture: 'Architecture',
  api_design: 'API Design',
  security_mechanism: 'Security',
};

const NOVELTY_COLORS = {
  strong: 'bg-green-100 text-green-700 border-green-200',
  moderate: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  weak: 'bg-gray-100 text-gray-600 border-gray-200',
};

const NOVELTY_ACCENT = {
  strong: 'border-l-green-500',
  moderate: 'border-l-amber-400',
  weak: 'border-l-gray-300',
};

export function AnalysisResults({ onNavigate }: AnalysisResultsProps) {
  const { currentProject } = useProject();
  const [features, setFeatures] = useState<ExtractedFeature[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentProject) return;
    loadFeatures();
  }, [currentProject]);

  const loadFeatures = async () => {
    if (!currentProject) return;
    const { data } = await supabase
      .from('extracted_features')
      .select('*')
      .eq('project_id', currentProject.id)
      .order('is_core_innovation', { ascending: false });

    if (data) {
      setFeatures(data.map(f => ({
        name: f.name,
        type: f.type as ExtractedFeature['type'],
        description: f.description,
        technicalDetails: f.technical_details,
        sourceFiles: f.source_files || [],
        noveltyStrength: (f.novelty_strength || 'moderate') as ExtractedFeature['noveltyStrength'],
        isCoreInnovation: f.is_core_innovation,
      })));
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-patent-600 border-t-transparent" />
      </div>
    );
  }

  const coreFeatures = features.filter(f => f.isCoreInnovation);
  const strongFeatures = features.filter(f => f.noveltyStrength === 'strong');

  return (
    <div className="max-w-4xl mx-auto">
      {/* Hero stats card */}
      <div className="bg-gradient-to-r from-patent-600 via-blue-500 to-indigo-600 rounded-3xl p-10 text-white mb-10 relative overflow-hidden">
        {/* Glass-morphism overlay shapes */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4" />

        <div className="relative z-10">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-3xl font-bold">{currentProject?.name}</h2>
              <p className="text-blue-100 mt-2 text-base">{currentProject?.source_url || 'Uploaded zip file'}</p>
            </div>
            <div className="flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-xl px-4 py-2.5 border border-white/20">
              <Sparkles className="w-5 h-5" />
              <span className="font-semibold text-base">{features.length} features found</span>
            </div>
          </div>

          {currentProject?.analysis_summary && (
            <p className="text-blue-100 text-base leading-relaxed mb-8 max-w-2xl">{currentProject.analysis_summary}</p>
          )}

          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 text-center border border-white/10">
              <div className="text-3xl font-bold">{coreFeatures.length}</div>
              <div className="text-sm text-blue-100 mt-1">Core Innovations</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 text-center border border-white/10">
              <div className="text-3xl font-bold">{strongFeatures.length}</div>
              <div className="text-sm text-blue-100 mt-1">Strong Novelty</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 text-center border border-white/10">
              <div className="text-3xl font-bold">{features.length}</div>
              <div className="text-sm text-blue-100 mt-1">Total Features</div>
            </div>
          </div>
        </div>
      </div>

      {/* Action cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
        <button
          onClick={onNavigate}
          className="flex flex-col items-center gap-4 p-8 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md hover:border-patent-200 transition-all group"
        >
          <div className="w-16 h-16 bg-gradient-to-br from-patent-100 to-blue-100 rounded-2xl flex items-center justify-center group-hover:from-patent-200 group-hover:to-blue-200 transition-colors">
            <FileText className="w-8 h-8 text-patent-700" />
          </div>
          <div className="text-center">
            <div className="font-semibold text-gray-900 text-lg">Patents</div>
            <div className="text-sm text-gray-500 mt-1">Generate applications</div>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-patent-600 group-hover:translate-x-1 transition-all" />
        </button>

        {/* Copyright and Trademark cards removed — coming as separate products */}
      </div>

      {/* Feature list */}
      <h3 className="text-xl font-bold text-gray-900 mb-5">Discovered Features</h3>
      <div className="space-y-4">
        {features.map((feature, idx) => (
          <div
            key={idx}
            className={`bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all border-l-4 ${NOVELTY_ACCENT[feature.noveltyStrength]}`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2.5 mb-2">
                  {feature.isCoreInnovation && (
                    <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                  )}
                  <h4 className="font-semibold text-gray-900 text-base">{feature.name}</h4>
                </div>
                <p className="text-sm text-gray-600 mb-3 leading-relaxed">{feature.description}</p>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-patent-50 text-patent-700 border border-patent-100">
                    <Code className="w-3.5 h-3.5" />
                    {TYPE_LABELS[feature.type] || feature.type}
                  </span>
                  <span className={`inline-flex px-3 py-1 rounded-lg text-xs font-semibold border ${NOVELTY_COLORS[feature.noveltyStrength]}`}>
                    {feature.noveltyStrength} novelty
                  </span>
                  {feature.sourceFiles.length > 0 && (
                    <span className="text-xs text-gray-400">
                      {feature.sourceFiles.length} file{feature.sourceFiles.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
            </div>
            {feature.technicalDetails && (
              <details className="mt-4 group/details">
                <summary className="text-sm text-gray-500 cursor-pointer hover:text-patent-600 font-medium transition-colors">
                  Technical details
                </summary>
                <p className="text-sm text-gray-600 mt-3 bg-slate-50 rounded-xl p-4 leading-relaxed border border-gray-100 transition-all">
                  {feature.technicalDetails}
                </p>
              </details>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
