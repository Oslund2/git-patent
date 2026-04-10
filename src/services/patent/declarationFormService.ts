/**
 * Inventor Declaration — PTO/AIA/01
 * Generates one page per inventor with the statutory oath/declaration.
 */

import jsPDF from 'jspdf';
import type { PatentApplication, InventorInfo } from './patentApplicationService';

const MARGIN = 54;
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const BOTTOM_MARGIN = 72;
const LINE_HEIGHT = 13;

function formHeader(doc: jsPDF, y: number): number {
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('PTO/AIA/01 (02-23)', PAGE_WIDTH - MARGIN, y, { align: 'right' });
  doc.text('Approved for use through 02/28/2026. OMB 0651-0032', PAGE_WIDTH - MARGIN, y + 10, { align: 'right' });
  doc.text('U.S. Patent and Trademark Office; U.S. DEPARTMENT OF COMMERCE', PAGE_WIDTH - MARGIN, y + 20, { align: 'right' });
  return y + 35;
}

function generateSingleDeclaration(doc: jsPDF, inventor: InventorInfo, title: string, applicationNumber?: string): void {
  let y = 40;
  y = formHeader(doc, y);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('DECLARATION (37 CFR 1.63) FOR UTILITY OR DESIGN', PAGE_WIDTH / 2, y, { align: 'center' });
  y += 12;
  doc.text('APPLICATION USING AN APPLICATION DATA SHEET (37 CFR 1.76)', PAGE_WIDTH / 2, y, { align: 'center' });
  y += 25;

  // Title of Invention
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Title of Invention:', MARGIN, y);
  doc.setFont('helvetica', 'normal');
  const titleLines = doc.splitTextToSize(title, PAGE_WIDTH - MARGIN * 2 - 120);
  titleLines.forEach((line: string) => {
    doc.text(line, MARGIN + 120, y);
    y += LINE_HEIGHT;
  });
  y += 5;

  if (applicationNumber) {
    doc.setFont('helvetica', 'bold');
    doc.text('Application Number:', MARGIN, y);
    doc.setFont('helvetica', 'normal');
    doc.text(applicationNumber, MARGIN + 120, y);
    y += LINE_HEIGHT + 5;
  }

  // Inventor Info
  doc.setFillColor(230, 230, 230);
  doc.rect(MARGIN, y, PAGE_WIDTH - MARGIN * 2, 16, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('INVENTOR INFORMATION', MARGIN + 5, y + 11);
  y += 22;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');

  const lx = MARGIN + 10;
  doc.setFont('helvetica', 'bold');
  doc.text('Legal Name:', lx, y);
  doc.setFont('helvetica', 'normal');
  doc.text(inventor.fullName || '___________________________', lx + 100, y);
  y += LINE_HEIGHT;

  doc.setFont('helvetica', 'bold');
  doc.text('Residence:', lx, y);
  doc.setFont('helvetica', 'normal');
  const res = [inventor.residence.city, inventor.residence.state, inventor.residence.country].filter(Boolean).join(', ');
  doc.text(res || '___________________________', lx + 100, y);
  y += LINE_HEIGHT;

  doc.setFont('helvetica', 'bold');
  doc.text('Citizenship:', lx, y);
  doc.setFont('helvetica', 'normal');
  doc.text(inventor.citizenship || '___________________________', lx + 100, y);
  y += LINE_HEIGHT + 10;

  if (inventor.mailingAddress) {
    const addr = inventor.mailingAddress;
    doc.setFont('helvetica', 'bold');
    doc.text('Mailing Address:', lx, y);
    doc.setFont('helvetica', 'normal');
    doc.text([addr.street, `${addr.city}, ${addr.state} ${addr.zipCode}`, addr.country].filter(Boolean).join(', '), lx + 100, y);
    y += LINE_HEIGHT + 10;
  }

  // Declaration Text
  doc.setFillColor(230, 230, 230);
  doc.rect(MARGIN, y, PAGE_WIDTH - MARGIN * 2, 16, 'F');
  doc.setFont('helvetica', 'bold');
  doc.text('DECLARATION', MARGIN + 5, y + 11);
  y += 25;

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');

  const declarationText = [
    'I hereby declare that:',
    '',
    '(1) Each inventor\'s residence, mailing address, and citizenship are as stated in the Application Data Sheet.',
    '',
    '(2) I believe the inventor(s) named in the Application Data Sheet of this application to be the original',
    '    and first inventor(s) of the subject matter which is claimed and for which a patent is sought on the',
    '    invention titled above.',
    '',
    '(3) I have reviewed and understand the contents of the above identified specification, including the claims,',
    '    as amended by any amendment specifically referred to above.',
    '',
    '(4) I acknowledge the duty to disclose information which is material to patentability as defined in 37 CFR 1.56,',
    '    including for continuation-in-part applications, material information which became available between the filing',
    '    date of the prior application and the national or PCT international filing date of the continuation-in-part',
    '    application.',
  ];

  declarationText.forEach(line => {
    doc.text(line, MARGIN + 10, y);
    y += line === '' ? 6 : 11;
  });

  y += 10;

  // Warning
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('WARNING:', MARGIN + 10, y);
  doc.setFont('helvetica', 'normal');
  doc.text('Petitioner/applicant is cautioned to avoid submitting personal information in documents filed in a patent', MARGIN + 60, y);
  y += 10;
  doc.text('application that may contribute to identity theft. Personal information such as social security numbers, bank account', MARGIN + 10, y);
  y += 10;
  doc.text('numbers, or credit card numbers (other than a check or credit card authorization form PTO-2038) is never required.', MARGIN + 10, y);
  y += 15;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('I hereby declare that all statements made herein of my own knowledge are true and that all statements', MARGIN + 10, y);
  y += 11;
  doc.text('made on information and belief are believed to be true; and further that these statements were made with', MARGIN + 10, y);
  y += 11;
  doc.text('the knowledge that willful false statements and the like so made are punishable by fine or imprisonment,', MARGIN + 10, y);
  y += 11;
  doc.text('or both, under 18 U.S.C. 1001.', MARGIN + 10, y);
  y += 25;

  // Signature
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Signature: ___________________________________________', MARGIN + 10, y);
  y += LINE_HEIGHT + 5;
  doc.text(`Name:     ${inventor.fullName || '___________________________'}`, MARGIN + 10, y);
  y += LINE_HEIGHT + 5;
  doc.text(`Date:     ${new Date().toISOString().split('T')[0]}`, MARGIN + 10, y);
}

export function generateAllDeclarations(app: PatentApplication): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
  const meta = (app.metadata || {}) as Record<string, any>;
  const appNumber = meta.application_number || '';

  const inventors: InventorInfo[] = app.inventors?.length ? app.inventors : (app.inventor_name ? [{
    id: '1', fullName: app.inventor_name,
    residence: { city: '', state: '', country: 'US' },
    citizenship: app.inventor_citizenship || 'US',
  }] : []);

  if (inventors.length === 0) {
    doc.setFontSize(12);
    doc.text('No inventors listed. Add inventor information to generate declarations.', 50, 100);
    return doc;
  }

  inventors.forEach((inv, idx) => {
    if (idx > 0) doc.addPage();
    generateSingleDeclaration(doc, inv, app.title, appNumber);
  });

  return doc;
}
