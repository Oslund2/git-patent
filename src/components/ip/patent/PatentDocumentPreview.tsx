import { useState } from 'react';
import { Edit3, Save, X, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import {
  countWords,
  type PatentApplication,
  type PatentApplicationWithDetails
} from '../../../services/patent/patentApplicationService';

interface PatentDocumentPreviewProps {
  application: PatentApplicationWithDetails;
  onUpdate: (updates: Partial<PatentApplication>) => Promise<void>;
}

type EditingSection = 'abstract' | 'field_of_invention' | 'background_art' | 'summary_invention' | 'detailed_description' | 'claims' | null;

interface SectionConfig {
  key: EditingSection;
  dbField: string;
  title: string;
  getValue: (app: PatentApplicationWithDetails) => string;
}

const SECTIONS: SectionConfig[] = [
  { key: 'field_of_invention', dbField: 'field_of_invention', title: 'FIELD OF THE INVENTION', getValue: app => app.field_of_invention || '' },
  { key: 'background_art', dbField: 'background_art', title: 'BACKGROUND OF THE INVENTION', getValue: app => app.background_art || '' },
  { key: 'summary_invention', dbField: 'summary_invention', title: 'SUMMARY OF THE INVENTION', getValue: app => app.summary_invention || '' },
  { key: 'detailed_description', dbField: 'detailed_description', title: 'DETAILED DESCRIPTION OF THE INVENTION', getValue: app => app.detailed_description || '' },
];

export function PatentDocumentPreview({ application, onUpdate }: PatentDocumentPreviewProps) {
  const [editingSection, setEditingSection] = useState<EditingSection>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const startEditing = (section: EditingSection, currentValue: string) => {
    setEditingSection(section);
    setEditValue(currentValue);
  };

  const cancelEditing = () => {
    setEditingSection(null);
    setEditValue('');
  };

  const saveSection = async () => {
    if (!editingSection) return;
    setSaving(true);
    try {
      if (editingSection === 'abstract') {
        await onUpdate({ abstract: editValue });
      } else if (editingSection === 'claims') {
        // Claims are read-only in preview — handled via Claims tab
        cancelEditing();
        return;
      } else {
        // Save individual field AND rebuild concatenated specification
        const updates: Partial<PatentApplication> = {
          [editingSection]: editValue,
        };
        // Rebuild the concatenated specification from all sections
        const sections: string[] = [];
        for (const sec of SECTIONS) {
          const val = sec.key === editingSection ? editValue : sec.getValue(application);
          if (val) sections.push(`${sec.title}\n\n${val}`);
        }
        updates.specification = sections.join('\n\n');
        await onUpdate(updates);
      }
      cancelEditing();
    } catch {
      // Error handled by parent
    } finally {
      setSaving(false);
    }
  };

  const toggleCollapse = (key: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const sortedClaims = [...application.claims].sort((a, b) => a.claim_number - b.claim_number);
  const sortedDrawings = [...application.drawings].sort((a, b) => a.figure_number - b.figure_number);

  const drawingTypeLabels: Record<string, string> = {
    block_diagram: 'a block diagram',
    flowchart: 'a flowchart',
    wireframe: 'a wireframe illustration',
    schematic: 'a schematic diagram',
    sequence_diagram: 'a sequence diagram',
  };

  const renderSectionHeader = (title: string, sectionKey: EditingSection | string, currentValue: string, wordCount?: number) => {
    const isCollapsed = collapsedSections.has(sectionKey as string);
    const isEditable = SECTIONS.some(s => s.key === sectionKey) || sectionKey === 'abstract';
    return (
      <div className="flex items-center justify-between group">
        <button
          onClick={() => toggleCollapse(sectionKey as string)}
          className="flex items-center gap-2 hover:text-blue-700 transition-colors"
        >
          {isCollapsed
            ? <ChevronDown className="w-4 h-4 text-gray-400" />
            : <ChevronUp className="w-4 h-4 text-gray-400" />
          }
          <h2 className="text-base font-bold text-gray-900 tracking-wide">{title}</h2>
          {wordCount !== undefined && (
            <span className="text-xs text-gray-400 font-normal ml-2">({wordCount} words)</span>
          )}
        </button>
        {isEditable && editingSection !== sectionKey && (
          <button
            onClick={() => startEditing(sectionKey as EditingSection, currentValue)}
            className="opacity-0 group-hover:opacity-100 inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
          >
            <Edit3 className="w-3 h-3" />
            Edit
          </button>
        )}
      </div>
    );
  };

  const renderEditableContent = (sectionKey: EditingSection, content: string) => {
    if (editingSection === sectionKey) {
      return (
        <div className="mt-3">
          <textarea
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            className="w-full min-h-[200px] px-4 py-3 text-sm font-serif leading-relaxed bg-blue-50/50 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-y"
            autoFocus
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-gray-400">{countWords(editValue)} words</span>
            <div className="flex items-center gap-2">
              <button
                onClick={cancelEditing}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all"
              >
                <X className="w-3 h-3" />
                Cancel
              </button>
              <button
                onClick={saveSection}
                disabled={saving}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 transition-all"
              >
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                Save
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (!content) {
      return <p className="mt-2 text-sm text-gray-400 italic">No content yet. Click Edit to add.</p>;
    }

    return (
      <div className="mt-2 text-sm font-serif text-gray-800 leading-relaxed whitespace-pre-wrap">
        {content}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Document Header */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-gray-50 to-gray-100/50 px-6 py-4 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Full Application Preview</p>
          <p className="text-xs text-gray-400">Click the edit pencil on any section to modify, then save. Changes sync to all tabs.</p>
        </div>

        <div className="px-8 py-8 max-w-[800px] mx-auto">
          {/* Title */}
          <h1 className="text-xl font-bold text-gray-900 text-center mb-1 tracking-wide">
            {application.title.toUpperCase()}
          </h1>
          <p className="text-sm text-gray-600 text-center mb-1">
            Inventor: {application.inventor_name || 'Not specified'}
          </p>
          <p className="text-sm text-gray-500 text-center mb-8">
            Citizenship: {application.inventor_citizenship}
          </p>

          <hr className="border-gray-200 mb-8" />

          {/* Abstract */}
          <div className="mb-8">
            {renderSectionHeader('ABSTRACT OF THE DISCLOSURE', 'abstract', application.abstract || '', countWords(application.abstract || ''))}
            {!collapsedSections.has('abstract') && renderEditableContent('abstract', application.abstract || '')}
          </div>

          <hr className="border-gray-100 mb-8" />

          {/* Specification Sections */}
          {SECTIONS.map(section => {
            const content = section.getValue(application);
            return (
              <div key={section.key} className="mb-8">
                {renderSectionHeader(section.title, section.key, content, countWords(content))}
                {!collapsedSections.has(section.key as string) && renderEditableContent(section.key, content)}
              </div>
            );
          })}

          {/* Brief Description of Drawings */}
          {sortedDrawings.length > 0 && (
            <div className="mb-8">
              {renderSectionHeader('BRIEF DESCRIPTION OF THE DRAWINGS', 'drawings_brief' as any, '', undefined)}
              {!collapsedSections.has('drawings_brief') && (
                <div className="mt-2 text-sm font-serif text-gray-800 leading-relaxed">
                  <p className="mb-3">The accompanying drawings, which are incorporated in and constitute a part of this specification, illustrate embodiments of the invention and, together with the description, serve to explain the principles of the invention.</p>
                  {sortedDrawings.map(d => {
                    const typeLabel = drawingTypeLabels[d.drawing_type] || 'a diagram';
                    return (
                      <p key={d.id} className="ml-6 mb-1">
                        FIG. {d.figure_number} is {typeLabel} illustrating the {d.title.toLowerCase()} according to an embodiment of the present invention.
                      </p>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <hr className="border-gray-200 my-8" />

          {/* Claims */}
          <div className="mb-8">
            {renderSectionHeader('CLAIMS', 'claims_section' as any, '', undefined)}
            {!collapsedSections.has('claims_section') && (
              <div className="mt-3 space-y-3">
                {sortedClaims.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">No claims yet. Go to the Claims tab to generate.</p>
                ) : (
                  sortedClaims.map(claim => (
                    <p key={claim.id} className="text-sm font-serif text-gray-800 leading-relaxed">
                      <strong>{claim.claim_number}.</strong> {claim.claim_text}
                    </p>
                  ))
                )}
              </div>
            )}
          </div>

          <hr className="border-gray-200 my-8" />

          {/* Drawings */}
          {sortedDrawings.length > 0 && (
            <div className="mb-8">
              {renderSectionHeader('DRAWINGS', 'drawings_figures' as any, '', undefined)}
              {!collapsedSections.has('drawings_figures') && (
                <div className="mt-3 space-y-6">
                  {sortedDrawings.map(d => (
                    <div key={d.id} className="text-center">
                      <p className="text-sm font-bold text-gray-700 mb-2">FIG. {d.figure_number} - {d.title}</p>
                      {d.svg_content && (
                        <div
                          className="inline-block max-w-full border border-gray-200 rounded-lg p-2 bg-white"
                          dangerouslySetInnerHTML={{ __html: d.svg_content }}
                        />
                      )}
                      <p className="text-xs text-gray-500 italic mt-2">
                        FIG. {d.figure_number} is {drawingTypeLabels[d.drawing_type] || 'a diagram'} illustrating the {d.title.toLowerCase()} according to an embodiment of the present invention.
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
