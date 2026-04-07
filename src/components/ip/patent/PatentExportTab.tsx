import {
  Shield,
  FileText,
  List,
  Image,
  BookOpen,
  Download,
  Loader2,
  CheckCircle,
  AlertCircle,
  Scroll,
  BarChart3,
  Printer,
  Copy,
  FileCheck
} from 'lucide-react';
import { countWords, type PatentApplicationWithDetails } from '../../../services/patent/patentApplicationService';
import { formatDrawingsDescriptionSection } from '../../../services/patent/patentDrawingsService';

interface PatentExportTabProps {
  application: PatentApplicationWithDetails;
  onExportPDF: () => void;
  onExportUSPTOPdf: () => void;
  onExportSectionPDF: (section: string) => void;
  exporting: boolean;
  exportingUspto: boolean;
  exportingSection: string | null;
  exportOptions: { includeExemplaryClaims: boolean };
  onExportOptionsChange: (options: { includeExemplaryClaims: boolean }) => void;
}

export function PatentExportTab({ application, onExportPDF, onExportUSPTOPdf, onExportSectionPDF, exporting, exportingUspto, exportingSection, exportOptions, onExportOptionsChange }: PatentExportTabProps) {
  const sectionExports = [
    { id: 'overview', label: 'Overview', icon: Shield, description: 'Application details', hasContent: true },
    { id: 'specification', label: 'Specification', icon: FileText, description: 'Technical description', hasContent: !!application.specification },
    { id: 'claims', label: 'Claims', icon: List, description: `${application.claims.length} claims`, hasContent: application.claims.length > 0 },
    { id: 'drawings', label: 'Drawings', icon: Image, description: `${application.drawings.length} figures`, hasContent: application.drawings.length > 0 },
    { id: 'abstract', label: 'Abstract', icon: BookOpen, description: 'Summary', hasContent: !!application.abstract },
    { id: 'prior-art', label: 'Prior Art', icon: Scroll, description: 'Related patents', hasContent: true },
    { id: 'analysis', label: 'Analysis', icon: BarChart3, description: 'Assessment', hasContent: true }
  ];

  const handleCopyText = () => {
    let text = `${application.title}\n\n`;
    text += `Inventor: ${application.inventor_name || 'Not specified'}\n`;
    text += `Citizenship: ${application.inventor_citizenship}\n\n`;
    text += `ABSTRACT\n\n${application.abstract || ''}\n\n`;
    text += `SPECIFICATION\n\n${application.specification || ''}\n\n`;
    text += `CLAIMS\n\n`;
    application.claims
      .sort((a, b) => a.claim_number - b.claim_number)
      .forEach(claim => {
        text += `${claim.claim_number}. ${claim.claim_text}\n\n`;
      });
    navigator.clipboard.writeText(text);
  };

  const handlePrint = () => {
    setTimeout(() => { window.print(); }, 100);
  };

  const drawingsDescription = formatDrawingsDescriptionSection(application.drawings);
  const sortedClaims = [...application.claims].sort((a, b) => a.claim_number - b.claim_number);

  const completenessItems = [
    { label: 'Title', complete: true, detail: application.title, tip: '' },
    { label: 'Inventor', complete: !!application.inventor_name, detail: application.inventor_name || 'Not specified', tip: 'Go to the Applicant tab to add inventor details' },
    { label: 'Citizenship', complete: true, detail: application.inventor_citizenship, tip: '' },
    { label: 'Abstract', complete: !!application.abstract && countWords(application.abstract) > 20, detail: `${countWords(application.abstract || '')} words`, tip: 'Go to the Abstract tab — aim for 150 words (USPTO max)' },
    { label: 'Specification', complete: !!application.specification && countWords(application.specification || '') > 100, detail: `${countWords(application.specification || '').toLocaleString()} words`, tip: 'Go to the Specification tab to generate or edit — aim for 1,000+ words' },
    { label: 'Claims', complete: application.claims.length > 0, detail: `${application.claims.length} total`, tip: 'Go to the Claims tab and click Generate to create patent claims' },
    { label: 'Drawings', complete: application.drawings.length > 0, detail: `${application.drawings.length} figures`, tip: 'Go to the Drawings tab to generate technical diagrams' },
  ];

  const completenessPercent = Math.round((completenessItems.filter(i => i.complete).length / completenessItems.length) * 100);
  const circumference = 2 * Math.PI * 36;
  const strokeDashoffset = circumference - (completenessPercent / 100) * circumference;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
          <Download className="w-4 h-4 text-blue-600" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Export Application</h2>
          <p className="text-xs text-gray-500 mt-0.5">Download your patent application in various formats</p>
        </div>
      </div>

      {/* Primary Export Actions - large clickable cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <button
          onClick={onExportUSPTOPdf}
          disabled={exportingUspto}
          className={`flex flex-col items-center gap-3 p-6 rounded-2xl transition-all duration-200 group col-span-2 lg:col-span-1 ${
            exportingUspto
              ? 'bg-gray-50 border border-gray-200 opacity-60 cursor-not-allowed'
              : 'bg-gradient-to-br from-emerald-600 to-teal-600 border border-emerald-600 hover:shadow-lg hover:shadow-emerald-200'
          }`}
        >
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${exportingUspto ? 'bg-gray-100' : 'bg-white/20'}`}>
            {exportingUspto ? (
              <Loader2 className="w-6 h-6 text-gray-500 animate-spin" />
            ) : (
              <FileCheck className="w-6 h-6 text-white" />
            )}
          </div>
          <div className="text-center">
            <p className={`text-sm font-semibold ${exportingUspto ? 'text-gray-600' : 'text-white'}`}>{exportingUspto ? 'Generating...' : 'USPTO PDF'}</p>
            <p className={`text-xs mt-0.5 ${exportingUspto ? 'text-gray-400' : 'text-emerald-200'}`}>Filing format</p>
          </div>
        </button>

        <button
          onClick={handlePrint}
          className="flex flex-col items-center gap-3 p-6 bg-white border border-gray-100 rounded-2xl hover:border-blue-200 hover:shadow-md transition-all duration-200 group"
        >
          <div className="w-14 h-14 rounded-2xl bg-gray-50 group-hover:bg-blue-50 flex items-center justify-center transition-colors">
            <Printer className="w-6 h-6 text-gray-500 group-hover:text-blue-600 transition-colors" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-gray-800">Print</p>
            <p className="text-xs text-gray-400 mt-0.5">Print document</p>
          </div>
        </button>

        <button
          onClick={onExportPDF}
          disabled={exporting}
          className={`flex flex-col items-center gap-3 p-6 rounded-2xl transition-all duration-200 group ${
            exporting
              ? 'bg-gray-50 border border-gray-200 opacity-60 cursor-not-allowed'
              : 'bg-gradient-to-br from-blue-600 to-indigo-600 border border-blue-600 hover:shadow-lg hover:shadow-blue-200'
          }`}
        >
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${exporting ? 'bg-gray-100' : 'bg-white/20'}`}>
            {exporting ? (
              <Loader2 className="w-6 h-6 text-gray-500 animate-spin" />
            ) : (
              <Download className="w-6 h-6 text-white" />
            )}
          </div>
          <div className="text-center">
            <p className={`text-sm font-semibold ${exporting ? 'text-gray-600' : 'text-white'}`}>{exporting ? 'Generating...' : 'Export PDF'}</p>
            <p className={`text-xs mt-0.5 ${exporting ? 'text-gray-400' : 'text-blue-200'}`}>Complete application</p>
          </div>
        </button>

        <button
          onClick={handleCopyText}
          className="flex flex-col items-center gap-3 p-6 bg-white border border-gray-100 rounded-2xl hover:border-blue-200 hover:shadow-md transition-all duration-200 group"
        >
          <div className="w-14 h-14 rounded-2xl bg-gray-50 group-hover:bg-blue-50 flex items-center justify-center transition-colors">
            <Copy className="w-6 h-6 text-gray-500 group-hover:text-blue-600 transition-colors" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-gray-800">Copy Text</p>
            <p className="text-xs text-gray-400 mt-0.5">To clipboard</p>
          </div>
        </button>

        <button
          onClick={() => {
            const blob = new Blob([application.specification || ''], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'specification.txt';
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="flex flex-col items-center gap-3 p-6 bg-white border border-gray-100 rounded-2xl hover:border-blue-200 hover:shadow-md transition-all duration-200 group"
        >
          <div className="w-14 h-14 rounded-2xl bg-gray-50 group-hover:bg-blue-50 flex items-center justify-center transition-colors">
            <FileText className="w-6 h-6 text-gray-500 group-hover:text-blue-600 transition-colors" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-gray-800">Spec TXT</p>
            <p className="text-xs text-gray-400 mt-0.5">Download text</p>
          </div>
        </button>
      </div>

      {/* Export Options */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 mb-4 pb-3 border-b border-gray-100">Export Options</h3>
        <label className="flex items-center gap-4 cursor-pointer group">
          <input
            type="checkbox"
            checked={exportOptions.includeExemplaryClaims}
            onChange={(e) => onExportOptionsChange({ ...exportOptions, includeExemplaryClaims: e.target.checked })}
            className="w-5 h-5 text-blue-600 border-gray-300 rounded-md focus:ring-blue-500"
          />
          <div>
            <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors">Include "Exemplary Claims" header</span>
            <p className="text-xs text-gray-400 mt-0.5">Adds header before claims section (internal review only)</p>
          </div>
        </label>
      </div>

      {/* Section Exports */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Export Individual Sections</h3>
        <p className="text-xs text-gray-400 mb-5">Download each section as a separate PDF</p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {sectionExports.map(({ id, label, icon: Icon, description, hasContent }) => {
            const isExportingThis = exportingSection === id;
            return (
              <button
                key={id}
                onClick={() => onExportSectionPDF(id)}
                disabled={isExportingThis || !!exportingSection}
                className={`flex flex-col items-center gap-2 p-4 border rounded-xl transition-all duration-150 ${
                  isExportingThis
                    ? 'border-blue-300 bg-blue-50 shadow-sm'
                    : hasContent
                    ? 'border-gray-100 bg-white hover:border-blue-200 hover:shadow-sm'
                    : 'border-gray-100 bg-gray-50/50 opacity-40'
                } ${exportingSection && !isExportingThis ? 'opacity-30 cursor-not-allowed' : ''}`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  isExportingThis ? 'bg-blue-100' : hasContent ? 'bg-gray-50' : 'bg-gray-100'
                }`}>
                  {isExportingThis ? (
                    <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                  ) : (
                    <Icon className={`w-5 h-5 ${hasContent ? 'text-blue-600' : 'text-gray-300'}`} />
                  )}
                </div>
                <p className={`text-xs font-semibold ${hasContent ? 'text-gray-700' : 'text-gray-400'}`}>{label}</p>
                <p className="text-xs text-gray-400">{isExportingThis ? 'Generating...' : description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Completeness Checklist with Progress Ring */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-5 mb-6">
          {/* Progress Ring */}
          <div className="relative flex-shrink-0">
            <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="36" fill="none" strokeWidth="6" className="stroke-gray-100" />
              <circle
                cx="40" cy="40" r="36" fill="none" strokeWidth="6"
                strokeLinecap="round"
                className={`${completenessPercent === 100 ? 'stroke-emerald-500' : 'stroke-blue-500'} transition-all duration-700`}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-lg font-bold ${completenessPercent === 100 ? 'text-emerald-600' : 'text-blue-600'}`}>
                {completenessPercent}%
              </span>
            </div>
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900">Application Completeness</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              {completenessPercent === 100
                ? 'All sections complete - ready to export!'
                : `${completenessItems.filter(i => i.complete).length} of ${completenessItems.length} sections complete`
              }
            </p>
          </div>
        </div>
        <div className="space-y-2.5">
          {completenessItems.map((item, i) => (
            <div key={i} className={`p-3 rounded-xl ${item.complete ? 'bg-emerald-50/50' : 'bg-amber-50/50'}`}>
              <div className="flex items-center gap-3">
                {item.complete ? (
                  <div className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                ) : (
                  <div className="w-6 h-6 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                  </div>
                )}
                <span className={`text-sm font-medium ${item.complete ? 'text-gray-700' : 'text-gray-500'}`}>{item.label}</span>
                <span className="text-xs text-gray-400 ml-auto">{item.detail}</span>
              </div>
              {!item.complete && item.tip && (
                <p className="text-xs text-amber-600/80 mt-1.5 ml-9">{item.tip}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Print Content (hidden) */}
      <div id="patent-print-content" className="hidden print:block print:!visible">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-2">{application.title}</h1>
          <p className="text-lg">Inventor: {application.inventor_name || 'Not specified'}</p>
          <p>Citizenship: {application.inventor_citizenship}</p>
        </div>

        {application.abstract && (
          <div className="mb-8">
            <h2 className="text-xl font-bold mb-4 border-b-2 border-black pb-2">ABSTRACT</h2>
            <p className="text-justify whitespace-pre-wrap">{application.abstract}</p>
          </div>
        )}

        {application.specification && (
          <div className="mb-8">
            <h2 className="text-xl font-bold mb-4 border-b-2 border-black pb-2">SPECIFICATION</h2>
            <div className="text-justify whitespace-pre-wrap">{application.specification}</div>
          </div>
        )}

        {sortedClaims.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold mb-4 border-b-2 border-black pb-2">
              {exportOptions.includeExemplaryClaims ? 'EXEMPLARY CLAIMS' : 'CLAIMS'}
            </h2>
            <div className="space-y-4">
              {sortedClaims.map(claim => (
                <p key={claim.id} className="text-justify">
                  <strong>{claim.claim_number}.</strong> {claim.claim_text}
                </p>
              ))}
            </div>
          </div>
        )}

        {application.drawings.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold mb-4 border-b-2 border-black pb-2">BRIEF DESCRIPTION OF THE DRAWINGS</h2>
            <div className="whitespace-pre-wrap">{drawingsDescription}</div>
          </div>
        )}
      </div>
    </div>
  );
}
