import { useState } from 'react';
import { FileImage, Loader2, RefreshCw, X, Sparkles, Eye, RotateCcw } from 'lucide-react';
import type { PatentDrawing } from '../../../services/patent/patentApplicationService';
import { svgToDataUrl, enhanceCalloutDescriptions } from '../../../services/patent/patentDrawingsService';

interface PatentDrawingsTabProps {
  drawings: PatentDrawing[];
  generating: boolean;
  onGenerate: () => void;
  onRegenerateSingle?: (figureNumber: number) => Promise<void>;
  onDrawingsUpdated?: (drawings: PatentDrawing[]) => void;
  inventionTitle?: string;
  claims?: string[];
}

export function PatentDrawingsTab({ drawings, generating, onGenerate, onRegenerateSingle, onDrawingsUpdated, inventionTitle, claims }: PatentDrawingsTabProps) {
  const [selectedDrawing, setSelectedDrawing] = useState<PatentDrawing | null>(null);
  const [regeneratingFigure, setRegeneratingFigure] = useState<number | null>(null);
  const [enhancingCallouts, setEnhancingCallouts] = useState(false);

  const handleEnhanceCallouts = async () => {
    if (!inventionTitle || drawings.length === 0) return;
    setEnhancingCallouts(true);
    try {
      const allCallouts = drawings.flatMap(d => d.callouts || []);
      const enhanced = await enhanceCalloutDescriptions(allCallouts, inventionTitle, claims || []);
      const updatedDrawings = drawings.map(d => ({
        ...d,
        callouts: (d.callouts || []).map(c => {
          const enhancedVersion = enhanced.find(e => e.number === c.number);
          return enhancedVersion ? { ...c, description: enhancedVersion.description } : c;
        }),
      }));
      onDrawingsUpdated?.(updatedDrawings);
    } catch (error) {
      console.error('Failed to enhance callouts:', error);
    } finally {
      setEnhancingCallouts(false);
    }
  };

  const handleRegenerateSingle = async (figureNumber: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onRegenerateSingle || regeneratingFigure !== null) return;
    setRegeneratingFigure(figureNumber);
    try {
      await onRegenerateSingle(figureNumber);
    } finally {
      setRegeneratingFigure(null);
    }
  };

  const sortedDrawings = [...drawings].sort((a, b) => a.figure_number - b.figure_number);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-violet-50 flex items-center justify-center">
            <FileImage className="w-4 h-4 text-violet-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Patent Drawings</h2>
            <p className="text-xs text-gray-500 mt-0.5">Technical diagrams illustrating your invention</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {drawings.length > 0 && inventionTitle && (
            <button
              onClick={handleEnhanceCallouts}
              disabled={enhancingCallouts}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 disabled:opacity-50 transition-all"
            >
              {enhancingCallouts ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Enhancing...</>
              ) : (
                <><Sparkles className="w-3.5 h-3.5" /> Enhance Descriptions</>
              )}
            </button>
          )}
          <button
            onClick={onGenerate}
            disabled={generating}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 transition-all shadow-md shadow-blue-200"
          >
            {generating ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
            ) : (
              <><Sparkles className="w-4 h-4" /> Generate Drawings</>
            )}
          </button>
        </div>
      </div>

      {/* Drawings Grid */}
      {drawings.length === 0 ? (
        <div className="text-center py-20 bg-white border-2 border-dashed border-gray-200 rounded-2xl">
          <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
            <FileImage className="w-7 h-7 text-gray-300" />
          </div>
          <p className="text-gray-700 font-medium mb-1">No Patent Drawings Yet</p>
          <p className="text-gray-400 text-sm mb-6">
            Generate technical diagrams for your patent application
          </p>
          <button
            onClick={onGenerate}
            disabled={generating}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 transition-all shadow-md shadow-blue-200"
          >
            <Sparkles className="w-4 h-4" />
            Generate Drawings
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
          {sortedDrawings.map(drawing => (
            <div
              key={drawing.id}
              className="group relative bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-lg cursor-pointer transition-all duration-200"
              onClick={() => setSelectedDrawing(drawing)}
            >
              <div className="aspect-[4/3] bg-slate-50 overflow-hidden">
                {drawing.svg_content ? (
                  <img
                    src={svgToDataUrl(drawing.svg_content)}
                    alt={`FIG. ${drawing.figure_number}`}
                    className="w-full h-full object-contain transition-transform duration-200 group-hover:scale-105"
                    onError={(e) => {
                      // SVG data URL failed to render — hide broken image and show fallback
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                    <FileImage className="w-8 h-8 mb-2 text-gray-300" />
                    <span className="text-xs font-medium">Generation failed</span>
                    <span className="text-xs text-gray-300 mt-0.5">Click to regenerate</span>
                  </div>
                )}
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-end justify-center pb-16">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/90 backdrop-blur-sm text-gray-700 text-xs font-medium rounded-lg">
                      <Eye className="w-3.5 h-3.5" />
                      View
                    </span>
                    {onRegenerateSingle && (
                      <button
                        onClick={(e) => handleRegenerateSingle(drawing.figure_number, e)}
                        disabled={regeneratingFigure !== null}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/90 backdrop-blur-sm text-gray-700 text-xs font-medium rounded-lg hover:bg-white transition-colors disabled:opacity-50"
                      >
                        {regeneratingFigure === drawing.figure_number ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RotateCcw className="w-3.5 h-3.5" />
                        )}
                        Regenerate
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="p-4">
                <p className="text-sm font-semibold text-gray-800">FIG. {drawing.figure_number}</p>
                <p className="text-xs text-gray-500 truncate mt-1">{drawing.title}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Drawing Detail Modal - dark backdrop, large drawing */}
      {selectedDrawing && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedDrawing(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="text-base font-semibold text-gray-900">
                  FIG. {selectedDrawing.figure_number} - {selectedDrawing.title}
                </h3>
                {selectedDrawing.description && (
                  <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">{selectedDrawing.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {onRegenerateSingle && (
                  <button
                    onClick={(e) => handleRegenerateSingle(selectedDrawing.figure_number, e)}
                    disabled={regeneratingFigure !== null}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-xl hover:bg-blue-100 transition-all disabled:opacity-50"
                  >
                    {regeneratingFigure === selectedDrawing.figure_number ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" />
                    )}
                    Regenerate
                  </button>
                )}
                <button
                  onClick={() => setSelectedDrawing(null)}
                  className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Content - drawing on left, callouts on right */}
            <div className="flex-1 overflow-y-auto">
              <div className="flex flex-col lg:flex-row">
                {/* Drawing */}
                <div className="flex-1 p-6">
                  {selectedDrawing.svg_content ? (
                    <div className="bg-slate-50 border border-gray-100 rounded-xl p-4">
                      <img
                        src={svgToDataUrl(selectedDrawing.svg_content)}
                        alt={`FIG. ${selectedDrawing.figure_number}`}
                        className="w-full"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  ) : (
                    <div className="bg-slate-50 border border-gray-100 rounded-xl p-8 flex flex-col items-center justify-center text-gray-400">
                      <FileImage className="w-12 h-12 mb-3 text-gray-300" />
                      <p className="text-sm font-medium">Drawing not available</p>
                      <p className="text-xs text-gray-400 mt-1">Use the Regenerate button above to recreate this figure</p>
                    </div>
                  )}
                  {selectedDrawing.description && (
                    <p className="text-sm text-gray-600 leading-relaxed mt-4">{selectedDrawing.description}</p>
                  )}
                </div>

                {/* Callouts sidebar */}
                {selectedDrawing.callouts && selectedDrawing.callouts.length > 0 && (
                  <div className="lg:w-80 border-t lg:border-t-0 lg:border-l border-gray-100 p-6 bg-slate-50/50">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Reference Numbers</h4>
                    <div className="space-y-3">
                      {selectedDrawing.callouts.map((callout, i) => (
                        <div key={i} className="flex items-start gap-3 bg-white rounded-xl p-3 border border-gray-100">
                          <span className="flex-shrink-0 w-9 h-7 bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-xs font-mono font-bold rounded-lg flex items-center justify-center shadow-sm">
                            {callout.number}
                          </span>
                          <span className="text-gray-600 text-xs leading-relaxed">{callout.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
