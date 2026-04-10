/**
 * Application Data Sheet (ADS) — PTO/AIA/14
 * Generates a multi-page PDF matching the official USPTO form layout.
 * Supports both provisional and non-provisional filings.
 */

import jsPDF from 'jspdf';
import type { PatentApplication, InventorInfo, CorrespondenceAddressInfo, AttorneyInfoData } from './patentApplicationService';

export interface ADSFormData {
  applicationNumber?: string;
  filingDate?: string;
  firstNamedInventor: string;
  title: string;
  attorneyDocketNumber?: string;
  applicationType: 'provisional' | 'non_provisional' | 'continuation' | 'cip' | 'divisional';
  inventors: InventorInfo[];
  applicantIsInventor: boolean;
  correspondenceAddress: CorrespondenceAddressInfo | null;
  representative?: AttorneyInfoData;
  entityStatus: 'micro_entity' | 'small_entity' | 'regular';
  assignee?: { name: string; address: string; type: 'individual' | 'company' | 'government' };
  signatureName?: string;
  signatureDate?: string;
}

export function extractADSDataFromApplication(app: PatentApplication): ADSFormData {
  const meta = (app.metadata || {}) as Record<string, any>;
  return {
    applicationNumber: meta.application_number || '',
    filingDate: meta.filing_date || '',
    firstNamedInventor: app.inventors?.[0]?.fullName || app.inventor_name || '',
    title: app.title,
    attorneyDocketNumber: meta.docket_number || '',
    applicationType: (meta.filing_type as ADSFormData['applicationType']) || 'provisional',
    inventors: app.inventors?.length ? app.inventors : (app.inventor_name ? [{
      id: '1', fullName: app.inventor_name,
      residence: { city: '', state: '', country: 'US' },
      citizenship: app.inventor_citizenship || 'US',
    }] : []),
    applicantIsInventor: true,
    correspondenceAddress: app.correspondence_address,
    representative: app.attorney_info || undefined,
    entityStatus: app.entity_status || 'micro_entity',
    assignee: meta.assignee || undefined,
    signatureName: meta.signature_name || '',
    signatureDate: meta.signature_date || '',
  };
}

const MARGIN = 54;
const PAGE_HEIGHT = 792; // Letter height in points
const PAGE_WIDTH = 612;
const BOTTOM_MARGIN = 72; // 1 inch footer room
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const LINE_HEIGHT = 13;
const SECTION_GAP = 12;

function formHeader(doc: jsPDF, y: number): number {
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('PTO/AIA/14 (12-23)', PAGE_WIDTH - MARGIN, y, { align: 'right' });
  doc.text('Approved for use through 11/30/2026. OMB 0651-0032', PAGE_WIDTH - MARGIN, y + 10, { align: 'right' });
  doc.text('U.S. Patent and Trademark Office; U.S. DEPARTMENT OF COMMERCE', PAGE_WIDTH - MARGIN, y + 20, { align: 'right' });
  return y + 30;
}

function sectionHeader(doc: jsPDF, title: string, y: number): number {
  doc.setFillColor(220, 220, 220);
  doc.rect(MARGIN, y - 2, CONTENT_WIDTH, 16, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(title, MARGIN + 5, y + 10);
  return y + 20;
}

function labelValue(doc: jsPDF, label: string, value: string, x: number, y: number, labelWidth = 140): number {
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(label, x, y);
  doc.setTextColor(0);
  doc.setFont('helvetica', 'normal');
  doc.text(value || '_______________', x + labelWidth, y);
  return y + LINE_HEIGHT;
}

function checkbox(doc: jsPDF, x: number, y: number, checked: boolean, label: string): number {
  const size = 8;
  doc.rect(x, y - 7, size, size);
  if (checked) {
    doc.setFont('helvetica', 'bold');
    doc.text('X', x + 1.5, y);
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(label, x + size + 4, y);
  return y + LINE_HEIGHT;
}

function checkPageBreak(doc: jsPDF, y: number, needed = 60): number {
  if (y + needed > PAGE_HEIGHT - BOTTOM_MARGIN) {
    doc.addPage();
    return formHeader(doc, 40);
  }
  return y;
}

export function generateADSForm(data: ADSFormData): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
  let y = 40;

  // ── Page 1: Header + Application Information ──
  y = formHeader(doc, y);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('APPLICATION DATA SHEET (ADS)', PAGE_WIDTH / 2, y, { align: 'center' });
  y += 10;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('(37 CFR 1.76)', PAGE_WIDTH / 2, y, { align: 'center' });
  y += 20;

  // Section: Application Information
  y = sectionHeader(doc, 'APPLICATION INFORMATION', y);
  y = labelValue(doc, 'Application Number:', data.applicationNumber || 'Not yet assigned', MARGIN + 5, y);
  y = labelValue(doc, 'Filing Date:', data.filingDate || 'Not yet filed', MARGIN + 5, y);
  y = labelValue(doc, 'First Named Inventor:', data.firstNamedInventor, MARGIN + 5, y);
  y = labelValue(doc, 'Title of Invention:', data.title, MARGIN + 5, y, 100);
  y = labelValue(doc, 'Attorney Docket Number:', data.attorneyDocketNumber || '', MARGIN + 5, y);
  y += 5;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('Application Type:', MARGIN + 5, y);
  y += LINE_HEIGHT;
  const isProvisional = data.applicationType === 'provisional';
  y = checkbox(doc, MARGIN + 15, y, isProvisional, 'Provisional');
  y = checkbox(doc, MARGIN + 15, y, !isProvisional && data.applicationType === 'non_provisional', 'Non-provisional');
  y = checkbox(doc, MARGIN + 15, y, data.applicationType === 'continuation', 'Continuation');
  y = checkbox(doc, MARGIN + 15, y, data.applicationType === 'cip', 'Continuation-in-Part');
  y = checkbox(doc, MARGIN + 15, y, data.applicationType === 'divisional', 'Divisional');
  y += SECTION_GAP;

  // Section: Entity Status
  y = sectionHeader(doc, 'ENTITY STATUS', y);
  y = checkbox(doc, MARGIN + 15, y, data.entityStatus === 'regular', 'Regular Undiscounted');
  y = checkbox(doc, MARGIN + 15, y, data.entityStatus === 'small_entity', 'Small Entity (37 CFR 1.27)');
  y = checkbox(doc, MARGIN + 15, y, data.entityStatus === 'micro_entity', 'Micro Entity (37 CFR 1.29)');
  y += SECTION_GAP;

  // ── Section: Inventor Information ──
  y = checkPageBreak(doc, y, 80);
  y = sectionHeader(doc, 'INVENTOR INFORMATION', y);

  if (data.inventors.length === 0) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.text('No inventors listed.', MARGIN + 10, y);
    y += LINE_HEIGHT;
  } else {
    data.inventors.forEach((inv, idx) => {
      y = checkPageBreak(doc, y, 90);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text(`Inventor ${idx + 1}`, MARGIN + 5, y);
      y += LINE_HEIGHT;

      y = labelValue(doc, 'Legal Name:', inv.fullName, MARGIN + 15, y, 80);
      y = labelValue(doc, 'Residence:', [inv.residence.city, inv.residence.state, inv.residence.country].filter(Boolean).join(', ') || '_______________', MARGIN + 15, y, 80);
      y = labelValue(doc, 'Citizenship:', inv.citizenship || '_______________', MARGIN + 15, y, 80);

      if (inv.mailingAddress) {
        const addr = inv.mailingAddress;
        y = labelValue(doc, 'Mailing Address:', [addr.street, addr.city, addr.state, addr.zipCode, addr.country].filter(Boolean).join(', '), MARGIN + 15, y, 100);
      }
      y += 5;
    });
  }
  y += SECTION_GAP;

  // ── Section: Applicant Information ──
  y = checkPageBreak(doc, y, 60);
  y = sectionHeader(doc, 'APPLICANT INFORMATION', y);
  y = checkbox(doc, MARGIN + 15, y, data.applicantIsInventor, 'Applicant is the inventor(s) named above');
  y = checkbox(doc, MARGIN + 15, y, !data.applicantIsInventor, 'Applicant is an assignee, obligated assignee, or person to whom the inventor is under obligation');
  y += SECTION_GAP;

  // ── Section: Correspondence Address ──
  y = checkPageBreak(doc, y, 80);
  y = sectionHeader(doc, 'CORRESPONDENCE ADDRESS', y);

  if (data.correspondenceAddress) {
    const a = data.correspondenceAddress;
    y = labelValue(doc, 'Name:', a.name || '', MARGIN + 15, y, 60);
    y = labelValue(doc, 'Address:', a.street || '', MARGIN + 15, y, 60);
    y = labelValue(doc, 'City/State/ZIP:', `${a.city || ''}, ${a.state || ''} ${a.zipCode || ''}`, MARGIN + 15, y, 90);
    y = labelValue(doc, 'Country:', a.country || 'US', MARGIN + 15, y, 60);
    y = labelValue(doc, 'Telephone:', a.phone || '', MARGIN + 15, y, 60);
    y = labelValue(doc, 'Email:', a.email || '', MARGIN + 15, y, 60);
  } else {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.text('No correspondence address provided.', MARGIN + 15, y);
    y += LINE_HEIGHT;
  }
  y += SECTION_GAP;

  // ── Section: Representative ──
  y = checkPageBreak(doc, y, 60);
  y = sectionHeader(doc, 'REPRESENTATIVE INFORMATION', y);

  if (data.representative?.name) {
    y = labelValue(doc, 'Name:', data.representative.name, MARGIN + 15, y, 80);
    y = labelValue(doc, 'Registration No.:', data.representative.registrationNumber || '', MARGIN + 15, y, 100);
    if (data.representative.firm) {
      y = labelValue(doc, 'Firm:', data.representative.firm, MARGIN + 15, y, 80);
    }
  } else {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.text('No representative information provided.', MARGIN + 15, y);
    y += LINE_HEIGHT;
  }
  y += SECTION_GAP;

  // ── Section: Assignee ──
  y = checkPageBreak(doc, y, 60);
  y = sectionHeader(doc, 'ASSIGNEE INFORMATION', y);

  if (data.assignee?.name) {
    y = labelValue(doc, 'Name:', data.assignee.name, MARGIN + 15, y, 60);
    y = labelValue(doc, 'Address:', data.assignee.address, MARGIN + 15, y, 60);
    y = checkbox(doc, MARGIN + 15, y, data.assignee.type === 'individual', 'Individual');
    y = checkbox(doc, MARGIN + 200, y - LINE_HEIGHT, data.assignee.type === 'company', 'Corporation/Organization');
    y = checkbox(doc, MARGIN + 15, y, data.assignee.type === 'government', 'Government Agency');
  } else {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.text('No assignee — applicant is the inventor(s).', MARGIN + 15, y);
    y += LINE_HEIGHT;
  }
  y += SECTION_GAP;

  // ── Section: AIA Statement ──
  y = checkPageBreak(doc, y, 50);
  y = sectionHeader(doc, 'STATEMENT UNDER 37 CFR 1.55 OR 1.78 (AIA STATUS)', y);
  y = checkbox(doc, MARGIN + 15, y, true, 'This application is subject to the provisions of the AIA (filed on or after March 16, 2013)');
  y += SECTION_GAP;

  // ── Section: Signature ──
  y = checkPageBreak(doc, y, 80);
  y = sectionHeader(doc, 'SIGNATURE', y);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('A signature of the applicant or representative is required in accordance with 37 CFR 1.33 and 10.18.', MARGIN + 5, y);
  y += LINE_HEIGHT + 5;

  y = labelValue(doc, 'Signature:', data.signatureName ? `/${data.signatureName}/` : '___________________________', MARGIN + 15, y, 70);
  y = labelValue(doc, 'Name:', data.signatureName || '___________________________', MARGIN + 15, y, 70);
  y = labelValue(doc, 'Date:', data.signatureDate || new Date().toISOString().split('T')[0], MARGIN + 15, y, 70);
  y = labelValue(doc, 'Registration No.:', data.representative?.registrationNumber || '_______________', MARGIN + 15, y, 100);

  return doc;
}
