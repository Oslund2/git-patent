import jsPDF from 'jspdf';
import type { EntityStatus } from './filingFeeService';

export interface Inventor {
  id: string;
  fullName: string;
  residence: {
    city: string;
    state: string;
    country: string;
  };
  citizenship: string;
  mailingAddress?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
}

export interface CorrespondenceAddress {
  name?: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  phone?: string;
  email?: string;
}

export interface AttorneyInfo {
  name?: string;
  registrationNumber?: string;
  firm?: string;
  docketNumber?: string;
}

export interface CoverSheetData {
  title: string;
  inventors: Inventor[];
  correspondenceAddress: CorrespondenceAddress;
  attorneyInfo?: AttorneyInfo;
  entityStatus: EntityStatus;
  governmentInterest?: string;
  filingDate?: Date;
  docketNumber?: string;
  signatureName?: string;
  signatureDate?: string;
}

// ---------------------------------------------------------------------------
// PDF generation — PTO/SB/16 layout
// ---------------------------------------------------------------------------

const MARGIN = 54;       // ~0.75 inch side margins
const PAGE_WIDTH = 612;  // Letter
const PAGE_HEIGHT = 792;
const BOTTOM_MARGIN = 72; // 1 inch footer room
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const LINE = 12;
const SMALL = 8;
const NORMAL = 9;

function drawBox(doc: jsPDF, x: number, y: number, w: number, h: number, fill = false) {
  if (fill) {
    doc.setFillColor(240, 240, 240);
    doc.rect(x, y, w, h, 'FD');
  } else {
    doc.rect(x, y, w, h, 'S');
  }
}

function checkbox(doc: jsPDF, x: number, y: number, checked: boolean) {
  doc.rect(x, y - 7, 8, 8, 'S');
  if (checked) {
    doc.setFont('helvetica', 'bold');
    doc.text('X', x + 1.8, y - 0.5);
    doc.setFont('helvetica', 'normal');
  }
}

function needsNewPage(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > PAGE_HEIGHT - BOTTOM_MARGIN) {
    doc.addPage();
    return MARGIN + 10;
  }
  return y;
}

export function generateSB16PDF(data: CoverSheetData): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
  let y = MARGIN;

  // ---- Header ----
  doc.setFontSize(SMALL);
  doc.setFont('helvetica', 'normal');
  doc.text('PTO/SB/16 (09-23)', PAGE_WIDTH - MARGIN, y, { align: 'right' });
  y += LINE;
  doc.text('Approved for use through 01/31/2026. OMB 0651-0032', PAGE_WIDTH - MARGIN, y, { align: 'right' });
  y += LINE;
  doc.text('U.S. Patent and Trademark Office; U.S. DEPARTMENT OF COMMERCE', PAGE_WIDTH - MARGIN, y, { align: 'right' });
  y += LINE * 1.5;

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('PROVISIONAL APPLICATION FOR PATENT COVER SHEET', PAGE_WIDTH / 2, y, { align: 'center' });
  y += LINE * 1.2;

  doc.setFontSize(NORMAL);
  doc.setFont('helvetica', 'normal');
  doc.text('This is a request for filing a PROVISIONAL APPLICATION FOR PATENT under 37 CFR 1.53(c).', PAGE_WIDTH / 2, y, { align: 'center' });
  y += LINE * 2;

  // ---- Docket / Application Number bar ----
  drawBox(doc, MARGIN, y - 10, CONTENT_WIDTH, 28, true);
  doc.setFontSize(SMALL);
  doc.setFont('helvetica', 'bold');
  doc.text('DOCKET NUMBER (if applicable):', MARGIN + 5, y + 2);
  doc.setFont('helvetica', 'normal');
  doc.text(data.docketNumber || data.attorneyInfo?.docketNumber || '', MARGIN + 170, y + 2);
  doc.setFont('helvetica', 'bold');
  doc.text('APPLICATION NUMBER (if known):', PAGE_WIDTH / 2 + 10, y + 2);
  doc.setFont('helvetica', 'normal');
  doc.text('', PAGE_WIDTH / 2 + 190, y + 2);
  y += LINE * 3;

  // ---- INVENTION TITLE ----
  doc.setFontSize(NORMAL);
  doc.setFont('helvetica', 'bold');
  doc.text('INVENTION TITLE', MARGIN, y);
  y += LINE;
  drawBox(doc, MARGIN, y - 10, CONTENT_WIDTH, 30);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const titleLines = doc.splitTextToSize(data.title, CONTENT_WIDTH - 10);
  doc.text(titleLines, MARGIN + 5, y + 2);
  y += 30 + LINE;

  // ---- INVENTOR(S) ----
  doc.setFontSize(NORMAL);
  doc.setFont('helvetica', 'bold');
  doc.text('INVENTOR(S) / APPLICANT(S)', MARGIN, y);
  y += LINE;

  // Table header
  const colWidths = [20, 160, 150, 80, 100];
  const colHeaders = ['#', 'Given Name, Middle, Family Name', 'Residence (City, State, Country)', 'Citizenship', 'Mailing Address'];
  drawBox(doc, MARGIN, y - 10, CONTENT_WIDTH, 16, true);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  let xPos = MARGIN + 3;
  colHeaders.forEach((h, i) => {
    doc.text(h, xPos, y);
    xPos += colWidths[i];
  });
  y += LINE + 4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(SMALL);
  data.inventors.forEach((inv, idx) => {
    y = needsNewPage(doc, y, 20);
    const rowY = y;
    drawBox(doc, MARGIN, rowY - 10, CONTENT_WIDTH, 18);
    xPos = MARGIN + 3;
    doc.text(String(idx + 1), xPos, rowY);
    xPos += colWidths[0];
    doc.text(inv.fullName.substring(0, 40), xPos, rowY);
    xPos += colWidths[1];
    const res = `${inv.residence.city}${inv.residence.state ? ', ' + inv.residence.state : ''}, ${inv.residence.country}`;
    doc.text(res.substring(0, 35), xPos, rowY);
    xPos += colWidths[2];
    doc.text((inv.citizenship || '').substring(0, 15), xPos, rowY);
    xPos += colWidths[3];
    if (inv.mailingAddress) {
      const addr = `${inv.mailingAddress.city}, ${inv.mailingAddress.state}`;
      doc.text(addr.substring(0, 25), xPos, rowY);
    }
    y += 18;
  });

  // Empty rows for additional inventors
  for (let i = data.inventors.length; i < Math.max(data.inventors.length, 3); i++) {
    y = needsNewPage(doc, y, 20);
    drawBox(doc, MARGIN, y - 10, CONTENT_WIDTH, 18);
    xPos = MARGIN + 3;
    doc.text(String(i + 1), xPos, y);
    y += 18;
  }

  y += LINE;

  // ---- CORRESPONDENCE ADDRESS ----
  y = needsNewPage(doc, y, 120);
  doc.setFontSize(NORMAL);
  doc.setFont('helvetica', 'bold');
  doc.text('CORRESPONDENCE ADDRESS', MARGIN, y);
  y += LINE;
  drawBox(doc, MARGIN, y - 10, CONTENT_WIDTH, 95);

  doc.setFontSize(SMALL);
  doc.setFont('helvetica', 'normal');
  const addr = data.correspondenceAddress;
  const addrLines = [
    { label: 'Name:', value: addr.name || '' },
    { label: 'Address:', value: addr.street },
    { label: 'City:', value: addr.city },
    { label: 'State/Province:', value: addr.state },
    { label: 'Zip/Postal Code:', value: addr.zipCode },
    { label: 'Country:', value: addr.country },
    { label: 'Telephone:', value: addr.phone || '' },
    { label: 'Email:', value: addr.email || '' },
  ];

  const addrStartY = y;
  addrLines.forEach((line, i) => {
    doc.setFont('helvetica', 'bold');
    doc.text(line.label, MARGIN + 5, addrStartY + i * LINE);
    doc.setFont('helvetica', 'normal');
    doc.text(line.value, MARGIN + 90, addrStartY + i * LINE);
  });
  y += 95 + LINE;

  // ---- ATTORNEY/AGENT (Optional) ----
  y = needsNewPage(doc, y, 70);
  doc.setFontSize(NORMAL);
  doc.setFont('helvetica', 'bold');
  doc.text('ATTORNEY/AGENT INFORMATION (if applicable)', MARGIN, y);
  y += LINE;
  drawBox(doc, MARGIN, y - 10, CONTENT_WIDTH, 50);

  doc.setFontSize(SMALL);
  doc.setFont('helvetica', 'normal');
  const att = data.attorneyInfo || {};
  const attLines = [
    { label: 'Name:', value: att.name || '' },
    { label: 'Registration Number:', value: att.registrationNumber || '' },
    { label: 'Firm Name:', value: att.firm || '' },
  ];
  const attStartY = y;
  attLines.forEach((line, i) => {
    doc.setFont('helvetica', 'bold');
    doc.text(line.label, MARGIN + 5, attStartY + i * LINE);
    doc.setFont('helvetica', 'normal');
    doc.text(line.value, MARGIN + 120, attStartY + i * LINE);
  });
  y += 50 + LINE;

  // ---- ENTITY STATUS ----
  y = needsNewPage(doc, y, 50);
  doc.setFontSize(NORMAL);
  doc.setFont('helvetica', 'bold');
  doc.text('ENTITY STATUS', MARGIN, y);
  y += LINE + 2;

  doc.setFontSize(SMALL);
  doc.setFont('helvetica', 'normal');
  const entities: { value: EntityStatus; label: string }[] = [
    { value: 'micro_entity', label: 'Micro Entity (37 CFR 1.29)' },
    { value: 'small_entity', label: 'Small Entity (37 CFR 1.27)' },
    { value: 'regular', label: 'Regular Undiscounted' },
  ];
  entities.forEach(e => {
    checkbox(doc, MARGIN + 5, y, data.entityStatus === e.value);
    doc.text(e.label, MARGIN + 18, y);
    y += LINE + 2;
  });

  y += LINE;

  // ---- GOVERNMENT INTEREST ----
  if (data.governmentInterest) {
    y = needsNewPage(doc, y, 50);
    doc.setFontSize(NORMAL);
    doc.setFont('helvetica', 'bold');
    doc.text('U.S. GOVERNMENT INTEREST', MARGIN, y);
    y += LINE;
    drawBox(doc, MARGIN, y - 10, CONTENT_WIDTH, 35);
    doc.setFontSize(SMALL);
    doc.setFont('helvetica', 'normal');
    const govLines = doc.splitTextToSize(data.governmentInterest, CONTENT_WIDTH - 10);
    doc.text(govLines, MARGIN + 5, y);
    y += 35 + LINE;
  }

  // ---- PAGE 2: SIGNATURE ----
  doc.addPage();
  y = MARGIN;

  // Page 2 header
  doc.setFontSize(SMALL);
  doc.setFont('helvetica', 'normal');
  doc.text('PTO/SB/16 (09-23)', PAGE_WIDTH - MARGIN, y, { align: 'right' });
  y += LINE;
  doc.text(`Application Number: ________    Docket Number: ${data.docketNumber || data.attorneyInfo?.docketNumber || '________'}`, MARGIN, y);
  y += LINE;
  doc.text(`Title: ${data.title.substring(0, 80)}`, MARGIN, y);
  y += LINE * 2;

  // Enclosed sections checklist
  doc.setFontSize(NORMAL);
  doc.setFont('helvetica', 'bold');
  doc.text('ENCLOSED APPLICATION PARTS (check all that apply)', MARGIN, y);
  y += LINE + 4;

  doc.setFontSize(SMALL);
  doc.setFont('helvetica', 'normal');
  const enclosedItems = [
    { label: 'Specification (description of the invention)', checked: true },
    { label: 'Drawing(s)', checked: true },
    { label: 'Application Data Sheet (see 37 CFR 1.76)', checked: false },
    { label: 'Cover Sheet (PTO/SB/16)', checked: true },
    { label: 'Fees (filing fee, search fee, examination fee)', checked: false },
    { label: 'Inventor\'s Oath or Declaration', checked: false },
    { label: 'Claims', checked: false },
    { label: 'Abstract', checked: true },
  ];
  enclosedItems.forEach(item => {
    checkbox(doc, MARGIN + 5, y, item.checked);
    doc.text(item.label, MARGIN + 18, y);
    y += LINE + 2;
  });

  y += LINE * 2;

  // Authorization for email
  doc.setFontSize(NORMAL);
  doc.setFont('helvetica', 'bold');
  doc.text('AUTHORIZATION TO CORRESPOND VIA EMAIL', MARGIN, y);
  y += LINE + 2;
  doc.setFontSize(SMALL);
  doc.setFont('helvetica', 'normal');
  const emailAuth = `I hereby authorize the USPTO to correspond with me via email at the following address: ${data.correspondenceAddress.email || '________________________'}`;
  const emailLines = doc.splitTextToSize(emailAuth, CONTENT_WIDTH);
  doc.text(emailLines, MARGIN, y);
  y += emailLines.length * LINE + LINE * 2;

  // Signature section
  doc.setFontSize(NORMAL);
  doc.setFont('helvetica', 'bold');
  doc.text('SIGNATURE', MARGIN, y);
  y += LINE + 4;

  doc.setFontSize(SMALL);
  doc.setFont('helvetica', 'normal');
  const sigParagraph = 'I hereby declare that all statements made herein of my own knowledge are true and that all statements made on information and belief are believed to be true; and further that these statements were made with the knowledge that willful false statements and the like so made are punishable by fine or imprisonment, or both, under 18 U.S.C. 1001 and that such willful false statements may jeopardize the validity of the application or any patent issued thereon.';
  const sigLines = doc.splitTextToSize(sigParagraph, CONTENT_WIDTH);
  doc.text(sigLines, MARGIN, y);
  y += sigLines.length * LINE + LINE * 2;

  // Signature lines
  doc.line(MARGIN, y, MARGIN + 250, y);
  y += LINE;
  doc.text('Signature', MARGIN, y);
  y += LINE * 2;

  doc.setFont('helvetica', 'bold');
  doc.text('Name (Print/Type):', MARGIN, y);
  doc.setFont('helvetica', 'normal');
  doc.text(data.signatureName || data.inventors[0]?.fullName || '', MARGIN + 110, y);
  doc.line(MARGIN + 108, y + 2, MARGIN + 300, y + 2);
  y += LINE * 1.5;

  doc.setFont('helvetica', 'bold');
  doc.text('Date:', MARGIN, y);
  doc.setFont('helvetica', 'normal');
  const dateStr = data.signatureDate || data.filingDate?.toLocaleDateString() || new Date().toLocaleDateString();
  doc.text(dateStr, MARGIN + 110, y);
  doc.line(MARGIN + 108, y + 2, MARGIN + 250, y + 2);
  y += LINE * 3;

  // Privacy Act Notice
  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  const privacyNotice = 'PRIVACY ACT STATEMENT: The Privacy Act of 1974 (P.L. 93-579) requires that you be given certain information in connection with your submission. The authority for collecting this information is 35 U.S.C. 2(b)(2), 111, and 37 CFR 1.51. Furnishing this information is voluntary; however, failure to furnish the requested information may prevent processing of your submission. The information is used by the USPTO to process your submission and may be disseminated in accordance with the Privacy Act.';
  const privacyLines = doc.splitTextToSize(privacyNotice, CONTENT_WIDTH);
  doc.text(privacyLines, MARGIN, y);

  return doc;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateCoverSheetData(data: Partial<CoverSheetData>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!data.title || data.title.trim().length === 0) {
    errors.push('Invention title is required');
  }

  if (!data.inventors || data.inventors.length === 0) {
    errors.push('At least one inventor is required');
  } else {
    data.inventors.forEach((inv, idx) => {
      if (!inv.fullName || inv.fullName.trim().length === 0) {
        errors.push(`Inventor ${idx + 1}: Full name is required`);
      }
      if (!inv.residence?.city || !inv.residence?.country) {
        errors.push(`Inventor ${idx + 1}: Residence city and country are required`);
      }
      if (!inv.citizenship) {
        errors.push(`Inventor ${idx + 1}: Citizenship is required`);
      }
    });
  }

  if (!data.correspondenceAddress) {
    errors.push('Correspondence address is required');
  } else {
    if (!data.correspondenceAddress.street) {
      errors.push('Correspondence address: Street is required');
    }
    if (!data.correspondenceAddress.city) {
      errors.push('Correspondence address: City is required');
    }
    if (!data.correspondenceAddress.zipCode) {
      errors.push('Correspondence address: Zip code is required');
    }
    if (!data.correspondenceAddress.country) {
      errors.push('Correspondence address: Country is required');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function createDefaultInventor(): Inventor {
  return {
    id: crypto.randomUUID(),
    fullName: '',
    residence: {
      city: '',
      state: '',
      country: 'US'
    },
    citizenship: 'US',
    mailingAddress: undefined
  };
}

export function createDefaultCorrespondenceAddress(): CorrespondenceAddress {
  return {
    name: '',
    street: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'US',
    phone: '',
    email: ''
  };
}

// ---------------------------------------------------------------------------
// Download helpers
// ---------------------------------------------------------------------------

export function downloadCoverSheet(data: CoverSheetData): void {
  const pdf = generateSB16PDF(data);
  pdf.save(`PTO_SB16_${data.title.substring(0, 30).replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
}

// Keep HTML generation for preview purposes
export function generateCoverSheetHTML(data: CoverSheetData): string {
  const inventorRows = data.inventors.map((inv, idx) => `
    <tr>
      <td style="padding: 6px 8px; border: 1px solid #ccc;">${idx + 1}</td>
      <td style="padding: 6px 8px; border: 1px solid #ccc;">${inv.fullName}</td>
      <td style="padding: 6px 8px; border: 1px solid #ccc;">${inv.residence.city}${inv.residence.state ? ', ' + inv.residence.state : ''}, ${inv.residence.country}</td>
      <td style="padding: 6px 8px; border: 1px solid #ccc;">${inv.citizenship}</td>
    </tr>
  `).join('');

  return `
<div style="font-family: Arial, sans-serif; font-size: 10pt; line-height: 1.5; max-width: 700px;">
  <div style="text-align: right; font-size: 8pt; color: #666;">PTO/SB/16 (09-23)</div>
  <h2 style="text-align: center; margin: 10px 0 5px;">PROVISIONAL APPLICATION FOR PATENT COVER SHEET</h2>
  <p style="text-align: center; font-size: 9pt; color: #555; margin: 0 0 15px;">
    Request for filing a PROVISIONAL APPLICATION under 37 CFR 1.53(c)
  </p>

  ${data.docketNumber || data.attorneyInfo?.docketNumber ? `<p style="font-size: 9pt; background: #f5f5f5; padding: 4px 8px; border-radius: 4px;"><strong>Docket Number:</strong> ${data.docketNumber || data.attorneyInfo?.docketNumber}</p>` : ''}

  <h3 style="border-bottom: 2px solid #000; padding-bottom: 3px; font-size: 10pt;">INVENTION TITLE</h3>
  <p style="font-weight: bold; font-size: 11pt;">${data.title}</p>

  <h3 style="border-bottom: 2px solid #000; padding-bottom: 3px; font-size: 10pt;">INVENTOR(S)</h3>
  <table style="width: 100%; border-collapse: collapse; font-size: 9pt;">
    <thead>
      <tr style="background: #f0f0f0;">
        <th style="padding: 6px 8px; border: 1px solid #ccc; width: 30px;">#</th>
        <th style="padding: 6px 8px; border: 1px solid #ccc;">Name</th>
        <th style="padding: 6px 8px; border: 1px solid #ccc;">Residence</th>
        <th style="padding: 6px 8px; border: 1px solid #ccc;">Citizenship</th>
      </tr>
    </thead>
    <tbody>${inventorRows}</tbody>
  </table>

  <h3 style="border-bottom: 2px solid #000; padding-bottom: 3px; font-size: 10pt; margin-top: 15px;">CORRESPONDENCE ADDRESS</h3>
  <div style="font-size: 9pt;">
    ${data.correspondenceAddress.name ? `<div><strong>Name:</strong> ${data.correspondenceAddress.name}</div>` : ''}
    <div><strong>Address:</strong> ${data.correspondenceAddress.street}</div>
    <div><strong>City/State/Zip:</strong> ${data.correspondenceAddress.city}, ${data.correspondenceAddress.state} ${data.correspondenceAddress.zipCode}</div>
    <div><strong>Country:</strong> ${data.correspondenceAddress.country}</div>
    ${data.correspondenceAddress.phone ? `<div><strong>Phone:</strong> ${data.correspondenceAddress.phone}</div>` : ''}
    ${data.correspondenceAddress.email ? `<div><strong>Email:</strong> ${data.correspondenceAddress.email}</div>` : ''}
  </div>

  ${data.attorneyInfo?.name ? `
  <h3 style="border-bottom: 2px solid #000; padding-bottom: 3px; font-size: 10pt; margin-top: 15px;">ATTORNEY/AGENT</h3>
  <div style="font-size: 9pt;">
    <div><strong>Name:</strong> ${data.attorneyInfo.name}</div>
    ${data.attorneyInfo.registrationNumber ? `<div><strong>Reg. Number:</strong> ${data.attorneyInfo.registrationNumber}</div>` : ''}
    ${data.attorneyInfo.firm ? `<div><strong>Firm:</strong> ${data.attorneyInfo.firm}</div>` : ''}
  </div>
  ` : ''}

  <h3 style="border-bottom: 2px solid #000; padding-bottom: 3px; font-size: 10pt; margin-top: 15px;">ENTITY STATUS</h3>
  <div style="font-size: 9pt;">
    <div>${data.entityStatus === 'micro_entity' ? '☑' : '☐'} Micro Entity (37 CFR 1.29)</div>
    <div>${data.entityStatus === 'small_entity' ? '☑' : '☐'} Small Entity (37 CFR 1.27)</div>
    <div>${data.entityStatus === 'regular' ? '☑' : '☐'} Regular Undiscounted</div>
  </div>

  ${data.governmentInterest ? `
  <h3 style="border-bottom: 2px solid #000; padding-bottom: 3px; font-size: 10pt; margin-top: 15px;">GOVERNMENT INTEREST</h3>
  <p style="font-size: 9pt;">${data.governmentInterest}</p>
  ` : ''}

  <div style="margin-top: 25px; border-top: 2px solid #000; padding-top: 10px;">
    <h3 style="font-size: 10pt;">SIGNATURE</h3>
    <div style="margin: 20px 0; border-bottom: 1px solid #000; width: 300px; height: 20px;"></div>
    <div style="font-size: 9pt;">
      <div><strong>Name:</strong> ${data.signatureName || data.inventors[0]?.fullName || ''}</div>
      <div><strong>Date:</strong> ${data.signatureDate || new Date().toLocaleDateString()}</div>
    </div>
  </div>
</div>`;
}

// Legacy export for backward compatibility
export function generateCoverSheetPDF(data: CoverSheetData): jsPDF {
  return generateSB16PDF(data);
}

// ---------------------------------------------------------------------------
// SB/17 Fee Transmittal PDF
// ---------------------------------------------------------------------------

export interface FeeTransmittalData {
  title: string;
  firstNamedInventor: string;
  docketNumber?: string;
  entityStatus: EntityStatus;
  filingType: 'provisional' | 'non_provisional';
  paymentMethod: 'credit_card' | 'deposit_account' | 'electronic' | 'check';
  depositAccountNumber?: string;
  authorizeCharge?: boolean;
  feeLines: { description: string; feeCode?: string; amount: number }[];
  totalFee: number;
  signatureName?: string;
  signatureDate?: string;
  signatureRegNumber?: string;
  signaturePhone?: string;
}

export function generateSB17PDF(data: FeeTransmittalData): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
  let y = MARGIN;

  // Header
  doc.setFontSize(SMALL);
  doc.setFont('helvetica', 'normal');
  doc.text('PTO/SB/17 (09-23)', PAGE_WIDTH - MARGIN, y, { align: 'right' });
  y += LINE;
  doc.text('Approved for use through 01/31/2026. OMB 0651-0032', PAGE_WIDTH - MARGIN, y, { align: 'right' });
  y += LINE;
  doc.text('U.S. Patent and Trademark Office; U.S. DEPARTMENT OF COMMERCE', PAGE_WIDTH - MARGIN, y, { align: 'right' });
  y += LINE * 1.5;

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('FEE TRANSMITTAL', PAGE_WIDTH / 2, y, { align: 'center' });
  y += LINE * 1.2;

  doc.setFontSize(NORMAL);
  doc.setFont('helvetica', 'normal');
  doc.text('for FY 2024', PAGE_WIDTH / 2, y, { align: 'center' });
  y += LINE * 2;

  // Application info bar
  drawBox(doc, MARGIN, y - 10, CONTENT_WIDTH, 55, true);
  doc.setFontSize(SMALL);
  const infoY = y;
  doc.setFont('helvetica', 'bold');
  doc.text('Application Number:', MARGIN + 5, infoY);
  doc.setFont('helvetica', 'normal');
  doc.text('(to be assigned)', MARGIN + 110, infoY);

  doc.setFont('helvetica', 'bold');
  doc.text('Filing Date:', PAGE_WIDTH / 2 + 10, infoY);
  doc.setFont('helvetica', 'normal');
  doc.text(new Date().toLocaleDateString(), PAGE_WIDTH / 2 + 70, infoY);

  doc.setFont('helvetica', 'bold');
  doc.text('First Named Inventor:', MARGIN + 5, infoY + LINE);
  doc.setFont('helvetica', 'normal');
  doc.text(data.firstNamedInventor, MARGIN + 120, infoY + LINE);

  doc.setFont('helvetica', 'bold');
  doc.text('Docket Number:', PAGE_WIDTH / 2 + 10, infoY + LINE);
  doc.setFont('helvetica', 'normal');
  doc.text(data.docketNumber || '', PAGE_WIDTH / 2 + 95, infoY + LINE);

  doc.setFont('helvetica', 'bold');
  doc.text('Title of Invention:', MARGIN + 5, infoY + LINE * 2);
  doc.setFont('helvetica', 'normal');
  const titleText = doc.splitTextToSize(data.title, CONTENT_WIDTH - 120);
  doc.text(titleText[0] || '', MARGIN + 105, infoY + LINE * 2);

  y += 55 + LINE;

  // Applicant entity status
  doc.setFontSize(NORMAL);
  doc.setFont('helvetica', 'bold');
  doc.text('APPLICANT CLAIMS', MARGIN, y);
  y += LINE + 2;

  doc.setFontSize(SMALL);
  doc.setFont('helvetica', 'normal');
  checkbox(doc, MARGIN + 5, y, data.entityStatus === 'small_entity');
  doc.text('Small Entity Status (37 CFR 1.27)', MARGIN + 18, y);
  y += LINE + 2;
  checkbox(doc, MARGIN + 5, y, data.entityStatus === 'micro_entity');
  doc.text('Micro Entity Status (37 CFR 1.29)  — Attach form PTO/SB/15A or 15B', MARGIN + 18, y);
  y += LINE * 2;

  // Method of payment
  doc.setFontSize(NORMAL);
  doc.setFont('helvetica', 'bold');
  doc.text('METHOD OF PAYMENT (check one)', MARGIN, y);
  y += LINE + 4;

  doc.setFontSize(SMALL);
  doc.setFont('helvetica', 'normal');
  const paymentMethods = [
    { value: 'check', label: 'Check or Money Order' },
    { value: 'credit_card', label: 'Credit Card (complete form PTO-2038)' },
    { value: 'deposit_account', label: `Deposit Account Number: ${data.depositAccountNumber || '________'}` },
    { value: 'electronic', label: 'Electronic Payment via Patent Center / EFS-Web' },
  ];
  paymentMethods.forEach(pm => {
    checkbox(doc, MARGIN + 5, y, data.paymentMethod === pm.value);
    doc.text(pm.label, MARGIN + 18, y);
    y += LINE + 2;
  });

  if (data.paymentMethod === 'deposit_account') {
    checkbox(doc, MARGIN + 25, y, data.authorizeCharge !== false);
    doc.text('The Director is hereby authorized to charge indicated fees and credit any overpayment to the above deposit account.', MARGIN + 38, y);
    y += LINE + 2;
  }

  y += LINE;

  // Fee calculation table
  doc.setFontSize(NORMAL);
  doc.setFont('helvetica', 'bold');
  doc.text('FEE CALCULATION', MARGIN, y);
  y += LINE + 2;

  // Table header
  const tblX = MARGIN;
  const tblW = CONTENT_WIDTH;
  const col1W = 320; // Description
  const col2W = 80;  // Fee Code

  drawBox(doc, tblX, y - 10, tblW, 16, true);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('Fee Description', tblX + 5, y);
  doc.text('Fee Code', tblX + col1W + 5, y);
  doc.text('Amount ($)', tblX + col1W + col2W + 5, y);
  y += LINE + 4;

  // Fee lines
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(SMALL);
  data.feeLines.forEach(line => {
    if (line.amount <= 0) return;
    drawBox(doc, tblX, y - 10, tblW, 16);
    doc.text(line.description, tblX + 5, y);
    if (line.feeCode) doc.text(line.feeCode, tblX + col1W + 5, y);
    doc.text(formatUSD(line.amount), tblX + col1W + col2W + 5, y);
    y += 16;
  });

  // Total row
  drawBox(doc, tblX, y - 10, tblW, 20, true);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(NORMAL);
  doc.text('TOTAL', tblX + 5, y + 2);
  doc.text(formatUSD(data.totalFee), tblX + col1W + col2W + 5, y + 2);
  y += 20 + LINE * 2;

  // Warning notice
  y = needsNewPage(doc, y, 60);
  drawBox(doc, MARGIN, y - 10, CONTENT_WIDTH, 40);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  const warningText = 'WARNING: Information on this form may become public. Credit card information should not be included on this form. Provide credit card information and authorization on PTO-2038.';
  const warnLines = doc.splitTextToSize(warningText, CONTENT_WIDTH - 10);
  doc.text(warnLines, MARGIN + 5, y);
  y += 40 + LINE;

  // Signature
  y = needsNewPage(doc, y, 80);
  doc.setFontSize(NORMAL);
  doc.setFont('helvetica', 'bold');
  doc.text('SIGNATURE', MARGIN, y);
  y += LINE * 2;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(SMALL);
  doc.line(MARGIN, y, MARGIN + 250, y);
  y += LINE;
  doc.text('Signature', MARGIN, y);
  y += LINE * 1.5;

  doc.setFont('helvetica', 'bold');
  doc.text('Name (Print/Type):', MARGIN, y);
  doc.setFont('helvetica', 'normal');
  doc.text(data.signatureName || data.firstNamedInventor, MARGIN + 110, y);
  doc.line(MARGIN + 108, y + 2, MARGIN + 300, y + 2);
  y += LINE * 1.5;

  doc.setFont('helvetica', 'bold');
  doc.text('Registration No.:', MARGIN, y);
  doc.setFont('helvetica', 'normal');
  doc.text(data.signatureRegNumber || '', MARGIN + 110, y);
  doc.line(MARGIN + 108, y + 2, MARGIN + 250, y + 2);

  doc.setFont('helvetica', 'bold');
  doc.text('Telephone:', MARGIN + 270, y);
  doc.setFont('helvetica', 'normal');
  doc.text(data.signaturePhone || '', MARGIN + 330, y);
  y += LINE * 1.5;

  doc.setFont('helvetica', 'bold');
  doc.text('Date:', MARGIN, y);
  doc.setFont('helvetica', 'normal');
  doc.text(data.signatureDate || new Date().toLocaleDateString(), MARGIN + 110, y);
  doc.line(MARGIN + 108, y + 2, MARGIN + 250, y + 2);

  return doc;
}

function formatUSD(amount: number): string {
  return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function downloadFeeTransmittal(data: FeeTransmittalData): void {
  const pdf = generateSB17PDF(data);
  pdf.save(`PTO_SB17_Fee_Transmittal_${data.title.substring(0, 30).replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
}
