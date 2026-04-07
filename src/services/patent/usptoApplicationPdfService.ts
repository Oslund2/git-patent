/**
 * USPTO-Format Patent Application PDF Generator
 *
 * Generates a patent application PDF matching the format accepted by the USPTO,
 * following the exact section ordering and formatting from the USPTO Example.
 *
 * Document structure:
 * 1. Title + Field of Invention header + Inventor/Citizenship
 * 2. Abstract (ABSTRACT OF THE DISCLOSURE)
 * 3. Title of the Invention (formal repeat)
 * 4. Field of the Invention
 * 5. Background of the Invention
 * 6. Summary of the Invention
 * 7. Brief Description of the Drawings
 * 8. Detailed Description of the Invention
 * 9. Abstract of the Disclosure (repeated)
 * 10. Claims (new page)
 * 11. Drawing pages (one per figure)
 */

import jsPDF from 'jspdf';
import {
  createUsptoCompliantPdf,
  setPatentFont,
  PDF_MARGINS,
  getMaxTextWidth,
  getPageHeight,
  addPdfAMetadata
} from './patentPdfFontService';
import type { PatentApplicationWithDetails } from './patentApplicationService';

// Line heights and spacing constants
const LINE_HEIGHT = 14;
const PARAGRAPH_SPACING = 10;
const SECTION_SPACING = 24;
const HEADER_FONT_SIZE = 14;
const BODY_FONT_SIZE = 12;
const SUB_HEADER_FONT_SIZE = 12;

/**
 * Ensure there's enough space on the current page; add a new page if not.
 * Returns the y position to use.
 */
function ensureSpace(pdf: jsPDF, yPos: number, neededSpace: number): number {
  const pageHeight = getPageHeight(pdf);
  if (yPos + neededSpace > pageHeight - PDF_MARGINS.bottom) {
    pdf.addPage();
    return PDF_MARGINS.top;
  }
  return yPos;
}

/**
 * Render body text with automatic page breaks.
 * Handles splitting text into lines and flowing across pages.
 */
function addBodyText(pdf: jsPDF, text: string, yPos: number, maxWidth: number): number {
  if (!text) return yPos;
  const lines = pdf.splitTextToSize(text.trim(), maxWidth);
  for (const line of lines) {
    yPos = ensureSpace(pdf, yPos, LINE_HEIGHT);
    pdf.text(line, PDF_MARGINS.left, yPos);
    yPos += LINE_HEIGHT;
  }
  return yPos;
}

/**
 * Render multiple paragraphs (split on double-newline) with spacing between them.
 */
function addParagraphs(pdf: jsPDF, text: string, yPos: number, maxWidth: number): number {
  if (!text) return yPos;
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim());
  for (let i = 0; i < paragraphs.length; i++) {
    yPos = addBodyText(pdf, paragraphs[i].replace(/\n/g, ' '), yPos, maxWidth);
    if (i < paragraphs.length - 1) {
      yPos += PARAGRAPH_SPACING;
    }
  }
  return yPos;
}

/**
 * Add a centered section header (bold, larger font).
 */
function addSectionHeader(pdf: jsPDF, text: string, yPos: number, centered: boolean = false): number {
  yPos = ensureSpace(pdf, yPos, 30);
  setPatentFont(pdf, 'bold');
  pdf.setFontSize(HEADER_FONT_SIZE);
  const pageWidth = pdf.internal.pageSize.getWidth();
  if (centered) {
    pdf.text(text, pageWidth / 2, yPos, { align: 'center' });
  } else {
    pdf.text(text, PDF_MARGINS.left, yPos);
  }
  setPatentFont(pdf, 'normal');
  pdf.setFontSize(BODY_FONT_SIZE);
  yPos += 20;
  return yPos;
}

/**
 * Add a left-aligned sub-header (bold, normal size).
 */
function addSubHeader(pdf: jsPDF, text: string, yPos: number): number {
  yPos = ensureSpace(pdf, yPos, 24);
  setPatentFont(pdf, 'bold');
  pdf.setFontSize(SUB_HEADER_FONT_SIZE);
  pdf.text(text, PDF_MARGINS.left, yPos);
  setPatentFont(pdf, 'normal');
  pdf.setFontSize(BODY_FONT_SIZE);
  yPos += 18;
  return yPos;
}

/**
 * Parse the specification field to extract individual sections when
 * individual fields are null (fallback for older applications).
 */
function parseSpecificationSections(specification: string): {
  field: string;
  background: string;
  summary: string;
  detailedDescription: string;
} {
  const sections = {
    field: '',
    background: '',
    summary: '',
    detailedDescription: ''
  };

  const sectionPattern = /^(FIELD OF THE INVENTION|BACKGROUND OF THE INVENTION|SUMMARY OF THE INVENTION|DETAILED DESCRIPTION[^\n]*)\s*$/gm;
  const matches: { header: string; index: number }[] = [];
  let match;
  while ((match = sectionPattern.exec(specification)) !== null) {
    matches.push({ header: match[1], index: match.index + match[0].length });
  }

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index - matches[i + 1].header.length : specification.length;
    const content = specification.substring(start, end).trim();
    const header = matches[i].header;

    if (header.startsWith('FIELD')) sections.field = content;
    else if (header.startsWith('BACKGROUND')) sections.background = content;
    else if (header.startsWith('SUMMARY')) sections.summary = content;
    else if (header.startsWith('DETAILED')) sections.detailedDescription = content;
  }

  return sections;
}

/**
 * Get the drawing type label for Brief Description of Drawings.
 */
function getDrawingTypeLabel(drawingType: string): string {
  const labels: Record<string, string> = {
    block_diagram: 'a block diagram',
    flowchart: 'a flowchart',
    wireframe: 'a wireframe illustration',
    schematic: 'a schematic diagram',
    sequence_diagram: 'a sequence diagram'
  };
  return labels[drawingType] || 'a diagram';
}

// ============================================================
// Section renderers — each matches the USPTO Example format
// ============================================================

/**
 * Section A: Title page opening — title, field sub-header, inventor info
 */
function renderTitleAndInventor(
  pdf: jsPDF,
  app: PatentApplicationWithDetails,
  yPos: number
): number {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const maxWidth = getMaxTextWidth(pdf);

  // Title — centered, uppercase, bold
  setPatentFont(pdf, 'bold');
  pdf.setFontSize(HEADER_FONT_SIZE);
  const titleLines = pdf.splitTextToSize(app.title.toUpperCase(), maxWidth);
  for (const line of titleLines) {
    pdf.text(line, pageWidth / 2, yPos, { align: 'center' });
    yPos += 18;
  }
  yPos += 8;

  // "FIELD OF THE INVENTION" sub-header on page 1
  pdf.setFontSize(SUB_HEADER_FONT_SIZE);
  pdf.text('FIELD OF THE INVENTION', PDF_MARGINS.left, yPos);
  yPos += 18;

  // Inventor info
  setPatentFont(pdf, 'normal');
  pdf.setFontSize(BODY_FONT_SIZE);
  if (app.inventor_name) {
    pdf.text(`Inventor: ${app.inventor_name}`, PDF_MARGINS.left, yPos);
    yPos += LINE_HEIGHT;
  }
  pdf.text(`Citizenship: ${app.inventor_citizenship}`, PDF_MARGINS.left, yPos);
  yPos += SECTION_SPACING;

  return yPos;
}

/**
 * Section B: Abstract (first appearance) — "ABSTRACT" header + "ABSTRACT OF THE DISCLOSURE"
 */
function renderAbstract(
  pdf: jsPDF,
  app: PatentApplicationWithDetails,
  yPos: number
): number {
  if (!app.abstract) return yPos;
  const maxWidth = getMaxTextWidth(pdf);

  yPos = addSectionHeader(pdf, 'ABSTRACT', yPos, false);
  yPos = addSubHeader(pdf, 'ABSTRACT OF THE DISCLOSURE', yPos);
  yPos = addParagraphs(pdf, app.abstract, yPos, maxWidth);
  yPos += SECTION_SPACING;
  return yPos;
}

/**
 * Section C: Title of the Invention (formal repeat)
 */
function renderTitleOfInvention(
  pdf: jsPDF,
  app: PatentApplicationWithDetails,
  yPos: number
): number {
  const maxWidth = getMaxTextWidth(pdf);

  yPos = addSectionHeader(pdf, 'TITLE OF THE INVENTION', yPos, false);
  setPatentFont(pdf, 'normal');
  pdf.setFontSize(BODY_FONT_SIZE);
  yPos = addBodyText(pdf, app.title.toUpperCase(), yPos, maxWidth);
  yPos += SECTION_SPACING;
  return yPos;
}

/**
 * Section D: Field of the Invention
 */
function renderFieldOfInvention(
  pdf: jsPDF,
  app: PatentApplicationWithDetails,
  yPos: number,
  parsedSections: ReturnType<typeof parseSpecificationSections>
): number {
  const content = app.field_of_invention || parsedSections.field;
  if (!content) return yPos;
  const maxWidth = getMaxTextWidth(pdf);

  yPos = addSectionHeader(pdf, 'FIELD OF THE INVENTION', yPos, false);
  yPos = addParagraphs(pdf, content, yPos, maxWidth);
  yPos += SECTION_SPACING;
  return yPos;
}

/**
 * Section E: Background of the Invention
 */
function renderBackground(
  pdf: jsPDF,
  app: PatentApplicationWithDetails,
  yPos: number,
  parsedSections: ReturnType<typeof parseSpecificationSections>
): number {
  const content = app.background_art || parsedSections.background;
  if (!content) return yPos;
  const maxWidth = getMaxTextWidth(pdf);

  yPos = addSectionHeader(pdf, 'BACKGROUND OF THE INVENTION', yPos, false);
  yPos = addParagraphs(pdf, content, yPos, maxWidth);
  yPos += SECTION_SPACING;
  return yPos;
}

/**
 * Section F: Summary of the Invention
 */
function renderSummary(
  pdf: jsPDF,
  app: PatentApplicationWithDetails,
  yPos: number,
  parsedSections: ReturnType<typeof parseSpecificationSections>
): number {
  const content = app.summary_invention || parsedSections.summary;
  if (!content) return yPos;
  const maxWidth = getMaxTextWidth(pdf);

  yPos = addSectionHeader(pdf, 'SUMMARY OF THE INVENTION', yPos, false);
  yPos = addParagraphs(pdf, content, yPos, maxWidth);
  yPos += SECTION_SPACING;
  return yPos;
}

/**
 * Section G: Brief Description of the Drawings
 */
function renderBriefDescriptionOfDrawings(
  pdf: jsPDF,
  app: PatentApplicationWithDetails,
  yPos: number
): number {
  if (app.drawings.length === 0) return yPos;
  const maxWidth = getMaxTextWidth(pdf);
  const sorted = [...app.drawings].sort((a, b) => a.figure_number - b.figure_number);

  yPos = addSectionHeader(pdf, 'BRIEF DESCRIPTION OF THE DRAWINGS', yPos, false);

  // Introductory text
  setPatentFont(pdf, 'normal');
  pdf.setFontSize(BODY_FONT_SIZE);
  yPos = addBodyText(
    pdf,
    'The accompanying drawings, which are incorporated in and constitute a part of this specification, illustrate embodiments of the invention and, together with the description, serve to explain the principles of the invention.',
    yPos,
    maxWidth
  );
  yPos += PARAGRAPH_SPACING;

  // List each figure
  for (const drawing of sorted) {
    const typeLabel = getDrawingTypeLabel(drawing.drawing_type);
    const titleLower = drawing.title.toLowerCase();
    const figDesc = `    FIG. ${drawing.figure_number} is ${typeLabel} illustrating the ${titleLower} according to an embodiment of the present invention.`;
    yPos = addBodyText(pdf, figDesc, yPos, maxWidth);
    yPos += 4;
  }

  yPos += SECTION_SPACING;
  return yPos;
}

/**
 * Section H: Detailed Description of the Invention
 * Detects Roman numeral sub-sections (I., II., III.) and renders them as bold sub-headers.
 */
function renderDetailedDescription(
  pdf: jsPDF,
  app: PatentApplicationWithDetails,
  yPos: number,
  parsedSections: ReturnType<typeof parseSpecificationSections>
): number {
  const content = app.detailed_description || parsedSections.detailedDescription;
  if (!content) return yPos;
  const maxWidth = getMaxTextWidth(pdf);

  yPos = addSectionHeader(pdf, 'DETAILED DESCRIPTION OF THE INVENTION', yPos, false);

  // Split content into lines and detect Roman numeral sub-sections
  const romanNumeralPattern = /^([IVXLCDM]+)\.\s+(.+)$/;
  const letterSubSectionPattern = /^([A-Z])\.\s+(.+)$/;
  const paragraphs = content.split(/\n/);

  let currentParagraph = '';

  const flushParagraph = () => {
    if (currentParagraph.trim()) {
      setPatentFont(pdf, 'normal');
      pdf.setFontSize(BODY_FONT_SIZE);
      yPos = addParagraphs(pdf, currentParagraph.trim(), yPos, maxWidth);
      yPos += PARAGRAPH_SPACING;
      currentParagraph = '';
    }
  };

  for (const line of paragraphs) {
    const trimmed = line.trim();
    if (!trimmed) {
      // Empty line = paragraph break
      flushParagraph();
      continue;
    }

    const romanMatch = trimmed.match(romanNumeralPattern);
    const letterMatch = trimmed.match(letterSubSectionPattern);

    if (romanMatch) {
      // Roman numeral sub-section header (e.g., "I. Animation Production Pipeline")
      flushParagraph();
      yPos += 6;
      yPos = addSubHeader(pdf, `${romanMatch[1]}. ${romanMatch[2]}`, yPos);
    } else if (letterMatch && trimmed.length < 100) {
      // Letter sub-section (e.g., "A. Bulk Copyright Registration")
      flushParagraph();
      yPos += 4;
      yPos = addSubHeader(pdf, `${letterMatch[1]}. ${letterMatch[2]}`, yPos);
    } else {
      // Regular text — accumulate into paragraph
      currentParagraph += (currentParagraph ? ' ' : '') + trimmed;
    }
  }
  flushParagraph();

  yPos += SECTION_SPACING;
  return yPos;
}

/**
 * Section I: Abstract of the Disclosure (second appearance, end of specification)
 */
function renderAbstractRepeat(
  pdf: jsPDF,
  app: PatentApplicationWithDetails,
  yPos: number
): number {
  if (!app.abstract) return yPos;
  const maxWidth = getMaxTextWidth(pdf);

  yPos = addSectionHeader(pdf, 'ABSTRACT OF THE DISCLOSURE', yPos, false);
  yPos = addParagraphs(pdf, app.abstract, yPos, maxWidth);
  yPos += SECTION_SPACING;
  return yPos;
}

/**
 * Section J: Claims — always starts on a new page
 */
function renderClaims(
  pdf: jsPDF,
  app: PatentApplicationWithDetails,
  includeExemplary: boolean
): number {
  if (app.claims.length === 0) return PDF_MARGINS.top;
  const maxWidth = getMaxTextWidth(pdf);

  pdf.addPage();
  let yPos = PDF_MARGINS.top;

  const header = includeExemplary ? 'EXEMPLARY CLAIMS' : 'CLAIMS';
  yPos = addSectionHeader(pdf, header, yPos, false);

  const sorted = [...app.claims].sort((a, b) => a.claim_number - b.claim_number);
  for (const claim of sorted) {
    yPos = ensureSpace(pdf, yPos, 40);
    setPatentFont(pdf, 'normal');
    pdf.setFontSize(BODY_FONT_SIZE);
    const claimText = `${claim.claim_number}. ${claim.claim_text}`;
    yPos = addBodyText(pdf, claimText, yPos, maxWidth);
    yPos += PARAGRAPH_SPACING;
  }

  return yPos;
}

/**
 * Section K: Drawing pages — one figure per page
 */
function renderDrawingPages(
  pdf: jsPDF,
  app: PatentApplicationWithDetails,
  drawingImages: Map<number, string>
): void {
  if (app.drawings.length === 0) return;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = getPageHeight(pdf);
  const maxWidth = getMaxTextWidth(pdf);
  const sorted = [...app.drawings].sort((a, b) => a.figure_number - b.figure_number);

  for (const drawing of sorted) {
    pdf.addPage();

    // Figure title at top
    setPatentFont(pdf, 'bold');
    pdf.setFontSize(BODY_FONT_SIZE);
    const figTitle = `FIG. ${drawing.figure_number} - ${drawing.title}`;
    pdf.text(figTitle, pageWidth / 2, PDF_MARGINS.top, { align: 'center' });

    // Figure description below title
    setPatentFont(pdf, 'italic');
    pdf.setFontSize(10);
    const typeLabel = getDrawingTypeLabel(drawing.drawing_type);
    const titleLower = drawing.title.toLowerCase();
    const figCaption = `FIG. ${drawing.figure_number} is ${typeLabel} illustrating the ${titleLower} according to an embodiment of the present invention.`;
    const captionLines = pdf.splitTextToSize(figCaption, maxWidth);
    let captionY = PDF_MARGINS.top + 18;
    for (const line of captionLines) {
      pdf.text(line, PDF_MARGINS.left, captionY);
      captionY += 12;
    }

    // Drawing image
    const pngDataUrl = drawingImages.get(drawing.figure_number);
    if (pngDataUrl) {
      const imgTopY = captionY + 10;
      const availableHeight = pageHeight - imgTopY - PDF_MARGINS.bottom - 10;
      const availableWidth = maxWidth;
      const aspectRatio = 800 / 600;
      let imgWidth = availableWidth;
      let imgHeight = imgWidth / aspectRatio;
      if (imgHeight > availableHeight) {
        imgHeight = availableHeight;
        imgWidth = imgHeight * aspectRatio;
      }
      const imgX = (pageWidth - imgWidth) / 2;
      pdf.addImage(pngDataUrl, 'PNG', imgX, imgTopY, imgWidth, imgHeight);
    }

    setPatentFont(pdf, 'normal');
    pdf.setFontSize(BODY_FONT_SIZE);
  }
}

// ============================================================
// Main export function
// ============================================================

export interface UsptoExportOptions {
  includeExemplaryClaims?: boolean;
}

/**
 * Generate a complete USPTO-format patent application PDF.
 *
 * @param application - The patent application with claims and drawings
 * @param drawingImages - Map of figure_number to PNG data URL (pre-converted from SVG)
 * @param options - Export options
 * @returns The generated jsPDF instance
 */
export function generateUsptoApplicationPdf(
  application: PatentApplicationWithDetails,
  drawingImages: Map<number, string>,
  options: UsptoExportOptions = {}
): jsPDF {
  const pdf = createUsptoCompliantPdf();

  // Parse specification as fallback if individual fields are null
  const parsedSections = application.specification
    ? parseSpecificationSections(application.specification)
    : { field: '', background: '', summary: '', detailedDescription: '' };

  let yPos = PDF_MARGINS.top;

  // Page 1: Title + Field header + Inventor
  yPos = renderTitleAndInventor(pdf, application, yPos);

  // Abstract (first appearance)
  yPos = renderAbstract(pdf, application, yPos);

  // Title of the Invention (formal repeat)
  yPos = renderTitleOfInvention(pdf, application, yPos);

  // Field of the Invention
  yPos = renderFieldOfInvention(pdf, application, yPos, parsedSections);

  // Background of the Invention
  yPos = renderBackground(pdf, application, yPos, parsedSections);

  // Summary of the Invention
  yPos = renderSummary(pdf, application, yPos, parsedSections);

  // Brief Description of the Drawings
  yPos = renderBriefDescriptionOfDrawings(pdf, application, yPos);

  // Detailed Description of the Invention
  yPos = renderDetailedDescription(pdf, application, yPos, parsedSections);

  // Abstract of the Disclosure (repeated at end of specification)
  renderAbstractRepeat(pdf, application, yPos);

  // Claims (new page)
  renderClaims(pdf, application, options.includeExemplaryClaims || false);

  // Drawing pages (one per figure)
  renderDrawingPages(pdf, application, drawingImages);

  // Metadata
  addPdfAMetadata(pdf, application.title, application.inventor_name || 'Unknown Inventor');

  return pdf;
}
