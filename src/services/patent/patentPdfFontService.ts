import jsPDF from 'jspdf';

export function setPatentFont(pdf: jsPDF, style: 'normal' | 'bold' | 'italic' | 'bolditalic' = 'normal'): void {
  const helveticaStyle = style === 'bolditalic' ? 'boldoblique' :
                        style === 'italic' ? 'oblique' : style;
  pdf.setFont('helvetica', helveticaStyle);
}

export function addPdfAMetadata(pdf: jsPDF, title: string, author: string): void {
  pdf.setProperties({
    title: title,
    author: author,
    subject: 'Patent Application',
    keywords: 'patent, intellectual property, USPTO',
    creator: 'Git-Patent Patent Generator'
  });
}

export function createUsptoCompliantPdf(): jsPDF {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'letter',
    putOnlyUsedFonts: true,
    compress: true
  });

  pdf.setTextColor(0, 0, 0);
  pdf.setFontSize(12);
  // Improve text spacing for better readability
  if (typeof pdf.setCharSpace === 'function') {
    pdf.setCharSpace(0.2);
  }

  return pdf;
}

export const PDF_MARGINS = {
  top: 72,
  bottom: 72,
  left: 72,
  right: 72
};

export function getMaxTextWidth(pdf: jsPDF): number {
  return pdf.internal.pageSize.getWidth() - PDF_MARGINS.left - PDF_MARGINS.right;
}

export function getPageHeight(pdf: jsPDF): number {
  return pdf.internal.pageSize.getHeight();
}

export function checkPageBreak(pdf: jsPDF, currentY: number, neededSpace: number = 50): { needsBreak: boolean; newY: number } {
  const pageHeight = getPageHeight(pdf);
  if (currentY > pageHeight - PDF_MARGINS.bottom - neededSpace) {
    pdf.addPage();
    return { needsBreak: true, newY: PDF_MARGINS.top };
  }
  return { needsBreak: false, newY: currentY };
}
