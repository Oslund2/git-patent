/**
 * Micro Entity Certification — PTO/SB/15A
 * Single-page PDF for certifying micro entity status under 37 CFR 1.29(a).
 */

import jsPDF from 'jspdf';
import type { PatentApplication } from './patentApplicationService';

const MARGIN = 54;
const PAGE_WIDTH = 612;
const LINE_HEIGHT = 13;

function checkbox(doc: jsPDF, x: number, y: number, checked: boolean): void {
  doc.rect(x, y - 7, 8, 8);
  if (checked) {
    doc.setFont('helvetica', 'bold');
    doc.text('X', x + 1.5, y);
    doc.setFont('helvetica', 'normal');
  }
}

export function generateMicroEntityCert(app: PatentApplication): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
  const inventorName = app.inventors?.[0]?.fullName || app.inventor_name || '';
  let y = 40;

  // Header
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('PTO/SB/15A (02-23)', PAGE_WIDTH - MARGIN, y, { align: 'right' });
  doc.text('Approved for use through 02/28/2026. OMB 0651-0031', PAGE_WIDTH - MARGIN, y + 10, { align: 'right' });
  doc.text('U.S. Patent and Trademark Office; U.S. DEPARTMENT OF COMMERCE', PAGE_WIDTH - MARGIN, y + 20, { align: 'right' });
  y += 40;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('CERTIFICATION OF MICRO ENTITY STATUS', PAGE_WIDTH / 2, y, { align: 'center' });
  y += 12;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('(GROSS INCOME BASIS — 37 CFR 1.29(a))', PAGE_WIDTH / 2, y, { align: 'center' });
  y += 25;

  // Application info
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Application Number:', MARGIN, y);
  doc.setFont('helvetica', 'normal');
  const meta = (app.metadata || {}) as Record<string, any>;
  doc.text(meta.application_number || 'Not yet assigned', MARGIN + 130, y);
  y += LINE_HEIGHT;

  doc.setFont('helvetica', 'bold');
  doc.text('Title of Invention:', MARGIN, y);
  doc.setFont('helvetica', 'normal');
  const titleLines = doc.splitTextToSize(app.title, PAGE_WIDTH - MARGIN * 2 - 130);
  titleLines.forEach((line: string) => {
    doc.text(line, MARGIN + 130, y);
    y += LINE_HEIGHT;
  });
  y += 10;

  doc.setFont('helvetica', 'bold');
  doc.text('Applicant Name:', MARGIN, y);
  doc.setFont('helvetica', 'normal');
  doc.text(inventorName || '___________________________', MARGIN + 130, y);
  y += LINE_HEIGHT + 15;

  // Certification items
  doc.setFillColor(230, 230, 230);
  doc.rect(MARGIN, y, PAGE_WIDTH - MARGIN * 2, 16, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('CERTIFICATION UNDER 37 CFR 1.29(a)', MARGIN + 5, y + 11);
  y += 25;

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');

  const isMicro = app.entity_status === 'micro_entity';

  // Cert 1: Qualifies as small entity
  checkbox(doc, MARGIN + 10, y, isMicro);
  const cert1 = doc.splitTextToSize(
    'The applicant qualifies as a small entity as defined in 37 CFR 1.27.',
    PAGE_WIDTH - MARGIN * 2 - 30
  );
  cert1.forEach((line: string, i: number) => {
    doc.text(line, MARGIN + 25, y + (i > 0 ? i * 11 : 0));
  });
  y += cert1.length * 11 + 8;

  // Cert 2: Not named on more than 4 apps
  checkbox(doc, MARGIN + 10, y, isMicro);
  const cert2 = doc.splitTextToSize(
    'Neither the applicant nor the inventor nor a joint inventor has been named as the inventor or a joint inventor on more than four previously filed patent applications, excluding provisional applications and international applications for which the basic national fee under 35 U.S.C. 41(a) was not paid, assigned or obligated.',
    PAGE_WIDTH - MARGIN * 2 - 30
  );
  cert2.forEach((line: string, i: number) => {
    doc.text(line, MARGIN + 25, y + (i > 0 ? i * 11 : 0));
  });
  y += cert2.length * 11 + 8;

  // Cert 3: Gross income
  checkbox(doc, MARGIN + 10, y, isMicro);
  const cert3 = doc.splitTextToSize(
    'Neither the applicant nor the inventor nor a joint inventor, in the calendar year preceding the calendar year in which the applicable fee is being paid, had a gross income, as defined in section 61(a) of the Internal Revenue Code of 1986 (26 U.S.C. 61(a)), exceeding three times the median household income for that preceding calendar year, as most recently reported by the Bureau of the Census.',
    PAGE_WIDTH - MARGIN * 2 - 30
  );
  cert3.forEach((line: string, i: number) => {
    doc.text(line, MARGIN + 25, y + (i > 0 ? i * 11 : 0));
  });
  y += cert3.length * 11 + 8;

  // Cert 4: Not assigned to high-income entity
  checkbox(doc, MARGIN + 10, y, isMicro);
  const cert4 = doc.splitTextToSize(
    'Neither the applicant nor the inventor nor a joint inventor has assigned, granted, or conveyed, nor is under an obligation by contract or law to assign, grant, or convey, a license or other ownership interest in the application concerned to an entity that, in the calendar year preceding the calendar year in which the applicable fee is being paid, had a gross income exceeding three times the median household income.',
    PAGE_WIDTH - MARGIN * 2 - 30
  );
  cert4.forEach((line: string, i: number) => {
    doc.text(line, MARGIN + 25, y + (i > 0 ? i * 11 : 0));
  });
  y += cert4.length * 11 + 15;

  // Warning
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('WARNING:', MARGIN + 10, y);
  doc.setFont('helvetica', 'normal');
  doc.text('Willful false statements and the like are punishable by fine or imprisonment, or both, under 18 U.S.C. 1001.', MARGIN + 55, y);
  y += 20;

  // Signature
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Signature: ___________________________________________', MARGIN + 10, y);
  y += LINE_HEIGHT + 5;
  doc.text(`Name:     ${inventorName || '___________________________'}`, MARGIN + 10, y);
  y += LINE_HEIGHT + 5;
  doc.text(`Date:     ${new Date().toISOString().split('T')[0]}`, MARGIN + 10, y);

  return doc;
}
