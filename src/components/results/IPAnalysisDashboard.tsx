import { useEffect, useState } from 'react';
import {
  Shield,
  FileText,
  Scale,
  Stamp,
  Sparkles,
  Eye,
  Download,
  Settings2,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useProject } from '../../contexts/ProjectContext';
import { getStatusLabel, getStatusColor } from '../../services/patent/patentApplicationService';
import { FilingGuide } from './FilingGuide';

interface IPAnalysisDashboardProps {
  onAdvancedMode: () => void;
  onViewPatent: (id: string) => void;
}

interface PatentRow {
  id: string;
  title: string;
  status: string;
  novelty_score: number | null;
  abstract: string | null;
  created_at: string;
}

interface CopyrightRow {
  id: string;
  title: string;
  registration_type: string | null;
  work_type: string | null;
  description: string | null;
  created_at: string;
}

interface TrademarkRow {
  id: string;
  mark_text: string;
  nice_class: number | null;
  goods_services_description: string | null;
  status: string | null;
  created_at: string;
}

interface ClaimCount {
  application_id: string;
}

export function IPAnalysisDashboard({ onAdvancedMode, onViewPatent }: IPAnalysisDashboardProps) {
  const { user } = useAuth();
  const { currentProject } = useProject();

  const [patents, setPatents] = useState<PatentRow[]>([]);
  const [copyrights, setCopyrights] = useState<CopyrightRow[]>([]);
  const [trademarks, setTrademarks] = useState<TrademarkRow[]>([]);
  const [claimCounts, setClaimCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const projectId = currentProject?.id;

  useEffect(() => {
    if (!projectId || !user) return;
    loadAll();
  }, [projectId, user]);

  const loadAll = async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);

    try {
      const [patentRes, copyrightRes, trademarkRes] = await Promise.all([
        (supabase as any).from('patent_applications').select('*').eq('project_id', projectId),
        (supabase as any).from('copyright_registrations').select('*').eq('project_id', projectId),
        (supabase as any).from('trademark_applications').select('*').eq('project_id', projectId),
      ]);

      const patentData: PatentRow[] = patentRes.data || [];
      const copyrightData: CopyrightRow[] = copyrightRes.data || [];
      const trademarkData: TrademarkRow[] = trademarkRes.data || [];

      setPatents(patentData);
      setCopyrights(copyrightData);
      setTrademarks(trademarkData);

      // Load claim counts for each patent
      if (patentData.length > 0) {
        const counts: Record<string, number> = {};
        await Promise.all(
          patentData.map(async (p) => {
            const { data } = await (supabase as any)
              .from('patent_claims')
              .select('application_id')
              .eq('application_id', p.id);
            counts[p.id] = (data as ClaimCount[] | null)?.length || 0;
          })
        );
        setClaimCounts(counts);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load IP data');
    } finally {
      setLoading(false);
    }
  };

  const totalAssets = patents.length + copyrights.length + trademarks.length;

  // Loading state — still generating
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-gradient-to-r from-shield-600 via-blue-500 to-indigo-600 rounded-3xl p-10 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4" />
          <div className="relative z-10 flex flex-col items-center justify-center py-8 gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-white/80" />
            <h2 className="text-2xl font-bold">Loading IP Analysis...</h2>
            <p className="text-blue-100">Retrieving your patent applications, copyrights, and trademarks</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white border border-red-200 rounded-2xl p-8 text-center">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Failed to Load Results</h3>
          <p className="text-sm text-gray-500 mb-4">{error}</p>
          <button
            onClick={loadAll}
            className="px-5 py-2.5 bg-gradient-to-r from-shield-600 to-indigo-600 text-white rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-shield-200 transition-all"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Empty state — nothing generated yet
  if (totalAssets === 0) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-gradient-to-r from-shield-600 via-blue-500 to-indigo-600 rounded-3xl p-10 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4" />
          <div className="relative z-10 flex flex-col items-center justify-center py-8 gap-4">
            <div className="w-16 h-16 bg-white/15 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/20">
              <Sparkles className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold">No IP Applications Yet</h2>
            <p className="text-blue-100 text-center max-w-md">
              Your codebase has been analyzed. Use the Advanced Editor to create patent applications, copyrights, and trademarks.
            </p>
            <div className="flex items-center gap-3 mt-2">
              <button
                onClick={onAdvancedMode}
                className="px-6 py-2.5 bg-white text-shield-600 rounded-xl text-sm font-semibold hover:shadow-lg transition-all"
              >
                Open Advanced Editor
              </button>
              <button
                onClick={loadAll}
                className="px-5 py-2.5 bg-white/15 backdrop-blur-sm border border-white/25 rounded-xl text-sm font-semibold hover:bg-white/25 transition-all"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-10">
      {/* ── Hero Card ── */}
      <div className="bg-gradient-to-r from-shield-600 via-blue-500 to-indigo-600 rounded-3xl p-10 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4" />

        <div className="relative z-10">
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-2.5 mb-2">
                <Shield className="w-6 h-6 text-white/80" />
                <span className="text-blue-100 text-sm font-medium uppercase tracking-wide">IP Analysis Complete</span>
              </div>
              <h2 className="text-3xl font-bold">{currentProject?.name}</h2>
              <p className="text-blue-100 mt-1.5 text-base">{currentProject?.source_url || 'Uploaded source code'}</p>
            </div>
            <button
              onClick={onAdvancedMode}
              className="flex items-center gap-2 px-4 py-2.5 bg-white/15 backdrop-blur-sm border border-white/25 rounded-xl text-sm font-semibold hover:bg-white/25 transition-all"
            >
              <Settings2 className="w-4 h-4" />
              Advanced Mode
            </button>
          </div>

          {currentProject?.analysis_summary && (
            <p className="text-blue-100 text-base leading-relaxed mb-8 max-w-2xl">
              {currentProject.analysis_summary}
            </p>
          )}

          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 text-center border border-white/10">
              <div className="text-3xl font-bold">{patents.length}</div>
              <div className="text-sm text-blue-100 mt-1 flex items-center justify-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                Patent{patents.length !== 1 ? 's' : ''}
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 text-center border border-white/10">
              <div className="text-3xl font-bold">{copyrights.length}</div>
              <div className="text-sm text-blue-100 mt-1 flex items-center justify-center gap-1.5">
                <Scale className="w-3.5 h-3.5" />
                Copyright{copyrights.length !== 1 ? 's' : ''}
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 text-center border border-white/10">
              <div className="text-3xl font-bold">{trademarks.length}</div>
              <div className="text-sm text-blue-100 mt-1 flex items-center justify-center gap-1.5">
                <Stamp className="w-3.5 h-3.5" />
                Trademark{trademarks.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Patents Section ── */}
      {patents.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-gradient-to-br from-shield-100 to-blue-100 rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-shield-700" />
            </div>
            <h3 className="text-xl font-bold text-gray-900">Patent Applications</h3>
            <span className="text-sm text-gray-400 ml-auto">{patents.length} application{patents.length !== 1 ? 's' : ''}</span>
          </div>

          <div className="space-y-4">
            {patents.map(patent => (
              <div
                key={patent.id}
                className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all border-l-4 border-l-shield-500"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 mb-2 flex-wrap">
                      <h4 className="font-semibold text-gray-900 text-base">{patent.title}</h4>
                      <span className={`inline-flex px-2.5 py-0.5 rounded-lg text-xs font-semibold ${getStatusColor(patent.status as any)}`}>
                        {getStatusLabel(patent.status as any)}
                      </span>
                      {patent.novelty_score != null && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                          <Sparkles className="w-3 h-3" />
                          {patent.novelty_score}% novelty
                        </span>
                      )}
                    </div>

                    {patent.abstract && (
                      <p className="text-sm text-gray-500 mb-3 leading-relaxed line-clamp-2">
                        {patent.abstract}
                      </p>
                    )}

                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span>{claimCounts[patent.id] || 0} claim{(claimCounts[patent.id] || 0) !== 1 ? 's' : ''}</span>
                      <span className="w-1 h-1 rounded-full bg-gray-300" />
                      <span>Created {new Date(patent.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => onViewPatent(patent.id)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-shield-600 to-indigo-600 text-white rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-shield-200 transition-all"
                    >
                      <Eye className="w-4 h-4" />
                      View
                    </button>
                    <button
                      className="flex items-center gap-1.5 px-4 py-2 bg-gray-50 text-gray-600 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-100 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      PDF
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Copyrights Section ── */}
      {copyrights.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-gradient-to-br from-violet-100 to-purple-100 rounded-xl flex items-center justify-center">
              <Scale className="w-5 h-5 text-violet-700" />
            </div>
            <h3 className="text-xl font-bold text-gray-900">Copyright Registrations</h3>
            <span className="text-sm text-gray-400 ml-auto">{copyrights.length} registration{copyrights.length !== 1 ? 's' : ''}</span>
          </div>

          <div className="space-y-4">
            {copyrights.map(cr => (
              <div
                key={cr.id}
                className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all border-l-4 border-l-violet-500"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 mb-2 flex-wrap">
                      <h4 className="font-semibold text-gray-900 text-base">{cr.title}</h4>
                      {cr.registration_type && (
                        <span className="inline-flex px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-violet-50 text-violet-700 border border-violet-100">
                          {cr.registration_type.replace(/_/g, ' ')}
                        </span>
                      )}
                      {cr.work_type && (
                        <span className="inline-flex px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-purple-50 text-purple-600 border border-purple-100">
                          {cr.work_type.replace(/_/g, ' ')}
                        </span>
                      )}
                    </div>

                    {cr.description && (
                      <p className="text-sm text-gray-500 mb-3 leading-relaxed line-clamp-2">
                        {cr.description}
                      </p>
                    )}

                    <div className="flex items-center gap-2 text-xs">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-violet-50 text-violet-600 font-medium border border-violet-100">
                        Register at copyright.gov — $65 fee
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Trademarks Section ── */}
      {trademarks.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-100 to-yellow-100 rounded-xl flex items-center justify-center">
              <Stamp className="w-5 h-5 text-amber-700" />
            </div>
            <h3 className="text-xl font-bold text-gray-900">Trademark Applications</h3>
            <span className="text-sm text-gray-400 ml-auto">{trademarks.length} application{trademarks.length !== 1 ? 's' : ''}</span>
          </div>

          <div className="space-y-4">
            {trademarks.map(tm => (
              <div
                key={tm.id}
                className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all border-l-4 border-l-amber-500"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 mb-2 flex-wrap">
                      <h4 className="font-semibold text-gray-900 text-base">{tm.mark_text}</h4>
                      {tm.nice_class != null && (
                        <span className="inline-flex px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          Class {tm.nice_class}
                        </span>
                      )}
                      {tm.status && (
                        <span className="inline-flex px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-gray-100 text-gray-600">
                          {tm.status.replace(/_/g, ' ')}
                        </span>
                      )}
                    </div>

                    {tm.goods_services_description && (
                      <p className="text-sm text-gray-500 mb-3 leading-relaxed line-clamp-2">
                        {tm.goods_services_description}
                      </p>
                    )}

                    <div className="flex items-center gap-2 text-xs">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-600 font-medium border border-amber-200">
                        File at USPTO TEAS Plus — $250/class
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Filing Guide ── */}
      <section>
        <FilingGuide />
      </section>
    </div>
  );
}
