import { useEffect, useState } from 'react';
import { FileText, Scale, Stamp, Sparkles, ChevronRight, Code, Star } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useProject } from '../../contexts/ProjectContext';
import type { ExtractedFeature } from '../../types';

interface AnalysisResultsProps {
  onNavigate: (view: 'patents' | 'copyrights' | 'trademarks') => void;
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
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-shield-600 border-t-transparent" />
      </div>
    );
  }

  const coreFeatures = features.filter(f => f.isCoreInnovation);
  const strongFeatures = features.filter(f => f.noveltyStrength === 'strong');

  return (
    <div className="max-w-4xl mx-auto">
      {/* Summary header */}
      <div className="bg-gradient-to-r from-shield-800 to-shield-600 rounded-2xl p-8 text-white mb-8">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold">{currentProject?.name}</h2>
            <p className="text-shield-200 mt-1 text-sm">{currentProject?.source_url || 'Uploaded zip file'}</p>
          </div>
          <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-1.5">
            <Sparkles className="w-4 h-4" />
            <span className="text-sm font-medium">{features.length} features found</span>
          </div>
        </div>

        {currentProject?.analysis_summary && (
          <p className="mt-4 text-shield-100 text-sm leading-relaxed">{currentProject.analysis_summary}</p>
        )}

        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="bg-white/10 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold">{coreFeatures.length}</div>
            <div className="text-xs text-shield-200">Core Innovations</div>
          </div>
          <div className="bg-white/10 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold">{strongFeatures.length}</div>
            <div className="text-xs text-shield-200">Strong Novelty</div>
          </div>
          <div className="bg-white/10 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold">{features.length}</div>
            <div className="text-xs text-shield-200">Total Features</div>
          </div>
        </div>
      </div>

      {/* Action cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <button
          onClick={() => onNavigate('patents')}
          className="flex flex-col items-center gap-3 p-6 bg-white border border-gray-200 rounded-xl hover:border-shield-500 hover:shadow-md transition-all group"
        >
          <div className="w-12 h-12 bg-shield-100 rounded-xl flex items-center justify-center group-hover:bg-shield-200 transition-colors">
            <FileText className="w-6 h-6 text-shield-700" />
          </div>
          <div className="text-center">
            <div className="font-semibold text-gray-900">Patents</div>
            <div className="text-xs text-gray-500 mt-1">Generate applications</div>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-shield-600" />
        </button>

        <button
          onClick={() => onNavigate('copyrights')}
          className="flex flex-col items-center gap-3 p-6 bg-white border border-gray-200 rounded-xl hover:border-shield-500 hover:shadow-md transition-all group"
        >
          <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center group-hover:bg-purple-200 transition-colors">
            <Scale className="w-6 h-6 text-purple-700" />
          </div>
          <div className="text-center">
            <div className="font-semibold text-gray-900">Copyrights</div>
            <div className="text-xs text-gray-500 mt-1">Register works</div>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-purple-600" />
        </button>

        <button
          onClick={() => onNavigate('trademarks')}
          className="flex flex-col items-center gap-3 p-6 bg-white border border-gray-200 rounded-xl hover:border-shield-500 hover:shadow-md transition-all group"
        >
          <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center group-hover:bg-amber-200 transition-colors">
            <Stamp className="w-6 h-6 text-amber-700" />
          </div>
          <div className="text-center">
            <div className="font-semibold text-gray-900">Trademarks</div>
            <div className="text-xs text-gray-500 mt-1">Protect marks</div>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-amber-600" />
        </button>
      </div>

      {/* Feature list */}
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Discovered Features</h3>
      <div className="space-y-3">
        {features.map((feature, idx) => (
          <div key={idx} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  {feature.isCoreInnovation && (
                    <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                  )}
                  <h4 className="font-medium text-gray-900">{feature.name}</h4>
                </div>
                <p className="text-sm text-gray-600 mb-2">{feature.description}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-shield-100 text-shield-700">
                    <Code className="w-3 h-3" />
                    {TYPE_LABELS[feature.type] || feature.type}
                  </span>
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium border ${NOVELTY_COLORS[feature.noveltyStrength]}`}>
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
              <details className="mt-3">
                <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">Technical details</summary>
                <p className="text-sm text-gray-600 mt-2 bg-gray-50 rounded p-3">{feature.technicalDetails}</p>
              </details>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
