import { useEffect, useState, useRef } from 'react';
import {
  ChevronLeft,
  Download,
  Settings2,
  Loader2,
  AlertCircle,
  FileText,
  List,
  Image,
  BookOpen,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { PatentClaim, PatentDrawing } from '../../services/patent/patentApplicationService';
import { getStatusLabel, getStatusColor } from '../../services/patent/patentApplicationService';

interface PatentDocumentViewerProps {
  applicationId: string;
  onBack: () => void;
  onAdvancedMode: () => void;
}

interface PatentApp {
  id: string;
  title: string;
  status: string;
  abstract: string | null;
  field_of_invention: string | null;
  background_art: string | null;
  summary_invention: string | null;
  detailed_description: string | null;
  specification: string | null;
  novelty_score: number | null;
  created_at: string;
  updated_at: string;
}

interface TocEntry {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const TOC_ENTRIES: TocEntry[] = [
  { id: 'abstract', label: 'Abstract', icon: <BookOpen className="w-3.5 h-3.5" /> },
  { id: 'field', label: 'Field of Invention', icon: <FileText className="w-3.5 h-3.5" /> },
  { id: 'background', label: 'Background', icon: <FileText className="w-3.5 h-3.5" /> },
  { id: 'summary', label: 'Summary', icon: <FileText className="w-3.5 h-3.5" /> },
  { id: 'description', label: 'Detailed Description', icon: <FileText className="w-3.5 h-3.5" /> },
  { id: 'claims', label: 'Claims', icon: <List className="w-3.5 h-3.5" /> },
  { id: 'drawings', label: 'Drawings', icon: <Image className="w-3.5 h-3.5" /> },
];

const CLAIM_TYPE_BADGE: Record<string, string> = {
  independent: 'bg-shield-50 text-shield-700 border-shield-200',
  dependent: 'bg-gray-50 text-gray-600 border-gray-200',
};

const CLAIM_CATEGORY_BADGE: Record<string, string> = {
  method: 'bg-indigo-50 text-indigo-600 border-indigo-100',
  system: 'bg-violet-50 text-violet-600 border-violet-100',
  apparatus: 'bg-blue-50 text-blue-600 border-blue-100',
  composition: 'bg-amber-50 text-amber-600 border-amber-100',
};

export function PatentDocumentViewer({ applicationId, onBack, onAdvancedMode }: PatentDocumentViewerProps) {
  const [application, setApplication] = useState<PatentApp | null>(null);
  const [claims, setClaims] = useState<PatentClaim[]>([]);
  const [drawings, setDrawings] = useState<PatentDrawing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState('abstract');
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadDocument();
  }, [applicationId]);

  // Scroll spy — track which section is in view
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;

    const handleScroll = () => {
      const sections = TOC_ENTRIES.map(e => ({
        id: e.id,
        el: document.getElementById(`section-${e.id}`),
      })).filter(s => s.el);

      const scrollTop = container.scrollTop + 120;
      let current = sections[0]?.id || 'abstract';

      for (const section of sections) {
        if (section.el && section.el.offsetTop <= scrollTop) {
          current = section.id;
        }
      }
      setActiveSection(current);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [application]);

  const loadDocument = async () => {
    setLoading(true);
    setError(null);

    try {
      const [appRes, claimsRes, drawingsRes] = await Promise.all([
        (supabase as any)
          .from('patent_applications')
          .select('*')
          .eq('id', applicationId)
          .single(),
        (supabase as any)
          .from('patent_claims')
          .select('*')
          .eq('application_id', applicationId)
          .order('claim_number'),
        (supabase as any)
          .from('patent_drawings')
          .select('*')
          .eq('application_id', applicationId)
          .order('figure_number'),
      ]);

      if (appRes.error) throw appRes.error;
      setApplication(appRes.data);
      setClaims(claimsRes.data || []);
      setDrawings(drawingsRes.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load patent document');
    } finally {
      setLoading(false);
    }
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(`section-${id}`);
    if (el && contentRef.current) {
      const offset = el.offsetTop - 100;
      contentRef.current.scrollTo({ top: offset, behavior: 'smooth' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-shield-600" />
          <span className="text-sm text-gray-500">Loading patent document...</span>
        </div>
      </div>
    );
  }

  if (error || !application) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white border border-red-200 rounded-2xl p-8 text-center">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Could Not Load Document</h3>
          <p className="text-sm text-gray-500 mb-4">{error || 'Patent application not found.'}</p>
          <button
            onClick={onBack}
            className="px-5 py-2.5 bg-gradient-to-r from-shield-600 to-indigo-600 text-white rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-shield-200 transition-all"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const renderTextSection = (id: string, title: string, content: string | null) => {
    if (!content) return null;
    return (
      <div id={`section-${id}`} className="mb-10">
        <h2 className="text-lg font-bold text-gray-900 uppercase tracking-wide border-b-2 border-shield-100 pb-2 mb-4 font-sans">
          {title}
        </h2>
        <div className="text-base text-gray-800 leading-[1.8] font-serif whitespace-pre-wrap">
          {content}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* ── Top Bar ── */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-2 text-gray-500 hover:text-gray-800 rounded-xl hover:bg-gray-100 transition-all text-sm font-medium flex-shrink-0"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
          <div className="w-px h-6 bg-gray-200" />
          <h1 className="text-base font-semibold text-gray-900 truncate">{application.title}</h1>
          <span className={`inline-flex px-2.5 py-0.5 rounded-lg text-xs font-semibold flex-shrink-0 ${getStatusColor(application.status as any)}`}>
            {getStatusLabel(application.status as any)}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            className="flex items-center gap-1.5 px-4 py-2 bg-gray-50 text-gray-600 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-100 transition-colors"
          >
            <Download className="w-4 h-4" />
            Download PDF
          </button>
          <button
            onClick={onAdvancedMode}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-shield-600 to-indigo-600 text-white rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-shield-200 transition-all"
          >
            <Settings2 className="w-4 h-4" />
            Edit in Advanced Mode
          </button>
        </div>
      </div>

      {/* ── Main Layout: Sidebar + Document ── */}
      <div className="flex gap-6">
        {/* Sidebar TOC */}
        <nav className="w-56 flex-shrink-0 hidden lg:block">
          <div className="sticky top-24">
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Contents</h4>
              <div className="space-y-0.5">
                {TOC_ENTRIES.map(entry => {
                  // Hide sections that have no content
                  const sectionHasContent =
                    entry.id === 'abstract' ? !!application.abstract :
                    entry.id === 'field' ? !!application.field_of_invention :
                    entry.id === 'background' ? !!application.background_art :
                    entry.id === 'summary' ? !!application.summary_invention :
                    entry.id === 'description' ? !!(application.detailed_description || application.specification) :
                    entry.id === 'claims' ? claims.length > 0 :
                    entry.id === 'drawings' ? drawings.length > 0 :
                    false;

                  if (!sectionHasContent) return null;

                  const isActive = activeSection === entry.id;
                  return (
                    <button
                      key={entry.id}
                      onClick={() => scrollToSection(entry.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all text-left ${
                        isActive
                          ? 'bg-shield-50 text-shield-700'
                          : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                      }`}
                    >
                      {entry.icon}
                      {entry.label}
                    </button>
                  );
                })}
              </div>

              {/* Quick stats */}
              <div className="mt-5 pt-4 border-t border-gray-100 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Claims</span>
                  <span className="font-semibold text-gray-700">{claims.length}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Drawings</span>
                  <span className="font-semibold text-gray-700">{drawings.length}</span>
                </div>
                {application.novelty_score != null && (
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Novelty</span>
                    <span className="font-semibold text-indigo-600">{application.novelty_score}%</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </nav>

        {/* Document Content */}
        <div
          ref={contentRef}
          className="flex-1 bg-white border border-gray-100 rounded-2xl shadow-sm p-8 md:p-12 overflow-y-auto"
          style={{ maxHeight: 'calc(100vh - 200px)' }}
        >
          {/* Title */}
          <div className="mb-10 pb-6 border-b border-gray-200">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 font-serif leading-tight">
              {application.title}
            </h1>
            <p className="text-sm text-gray-400 mt-2">
              Last updated {new Date(application.updated_at).toLocaleDateString('en-US', {
                year: 'numeric', month: 'long', day: 'numeric',
              })}
            </p>
          </div>

          {/* Abstract */}
          {renderTextSection('abstract', 'Abstract', application.abstract)}

          {/* Field of the Invention */}
          {renderTextSection('field', 'Field of the Invention', application.field_of_invention)}

          {/* Background */}
          {renderTextSection('background', 'Background of the Invention', application.background_art)}

          {/* Summary */}
          {renderTextSection('summary', 'Summary of the Invention', application.summary_invention)}

          {/* Detailed Description */}
          {(application.detailed_description || application.specification) && (
            <div id="section-description" className="mb-10">
              <h2 className="text-lg font-bold text-gray-900 uppercase tracking-wide border-b-2 border-shield-100 pb-2 mb-4 font-sans">
                Detailed Description of the Invention
              </h2>
              <div className="text-base text-gray-800 leading-[1.8] font-serif whitespace-pre-wrap">
                {application.detailed_description || application.specification}
              </div>
            </div>
          )}

          {/* Claims */}
          {claims.length > 0 && (
            <div id="section-claims" className="mb-10">
              <h2 className="text-lg font-bold text-gray-900 uppercase tracking-wide border-b-2 border-shield-100 pb-2 mb-4 font-sans">
                Claims
              </h2>
              <p className="text-sm text-gray-500 mb-5 font-sans">
                What is claimed is:
              </p>
              <div className="space-y-5">
                {claims.map(claim => (
                  <div key={claim.id} className="flex gap-4">
                    <div className="flex-shrink-0 pt-0.5">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-sm font-bold text-gray-700">
                        {claim.claim_number}
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1.5 font-sans">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold border ${CLAIM_TYPE_BADGE[claim.claim_type] || CLAIM_TYPE_BADGE.dependent}`}>
                          {claim.claim_type}
                        </span>
                        {claim.category && (
                          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold border ${CLAIM_CATEGORY_BADGE[claim.category] || ''}`}>
                            {claim.category}
                          </span>
                        )}
                      </div>
                      <p className="text-base text-gray-800 leading-[1.8] font-serif">
                        {claim.claim_text}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Drawings */}
          {drawings.length > 0 && (
            <div id="section-drawings" className="mb-10">
              <h2 className="text-lg font-bold text-gray-900 uppercase tracking-wide border-b-2 border-shield-100 pb-2 mb-4 font-sans">
                Drawings
              </h2>
              <div className="space-y-8">
                {drawings.map(drawing => (
                  <div key={drawing.id} className="border border-gray-200 rounded-2xl overflow-hidden">
                    {/* Figure header */}
                    <div className="bg-gray-50 px-5 py-3 border-b border-gray-200 flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-700 font-sans">
                        FIG. {drawing.figure_number} — {drawing.title}
                      </span>
                      <span className="text-xs text-gray-400 font-sans">
                        {drawing.drawing_type?.replace(/_/g, ' ')}
                      </span>
                    </div>

                    {/* SVG content */}
                    {drawing.svg_content && (
                      <div
                        className="p-6 flex items-center justify-center bg-white"
                        dangerouslySetInnerHTML={{ __html: drawing.svg_content }}
                      />
                    )}

                    {/* Description */}
                    {drawing.description && (
                      <div className="px-5 py-3 bg-gray-50/50 border-t border-gray-100">
                        <p className="text-sm text-gray-600 leading-relaxed font-serif">
                          {drawing.description}
                        </p>
                      </div>
                    )}

                    {/* Callouts */}
                    {drawing.callouts && drawing.callouts.length > 0 && (
                      <div className="px-5 py-3 border-t border-gray-100">
                        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                          {drawing.callouts.map((callout, idx) => (
                            <div key={idx} className="flex items-baseline gap-2 text-sm">
                              <span className="font-bold text-gray-700 font-sans">{callout.number}.</span>
                              <span className="text-gray-600">{callout.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* End marker */}
          <div className="text-center pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-400 uppercase tracking-wider font-sans">End of Document</p>
          </div>
        </div>
      </div>
    </div>
  );
}
