/**
 * Patent Filing Readiness Report — "Git-Patent Legal Brief"
 *
 * Generates a comprehensive legal assessment PDF that bridges
 * automated analysis and attorney review. Accompanies SB/16 and SB/17.
 */

import jsPDF from 'jspdf';
import { supabase } from '../../lib/supabase';
import { calculateFilingFee, formatCurrency, estimatePageCount, type EntityStatus } from './filingFeeService';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LegalBriefData {
  // Application info
  title: string;
  inventorName: string;
  entityStatus: EntityStatus;
  filingType: string;
  docketNumber?: string;
  generatedDate: string;

  // Invention summary
  technicalField: string;
  inventionSummary: string;
  problemSolved: string;

  // Features & novelty
  totalFeatures: number;
  coreInnovations: number;
  strongNoveltyCount: number;
  moderateNoveltyCount: number;
  weakNoveltyCount: number;
  noveltyScore: number;
  patentabilityAssessment: string;
  noveltyStrengths: string[];
  noveltyWeaknesses: string[];
  noveltyRecommendations: string[];

  // Claims
  totalClaims: number;
  independentClaims: number;
  dependentClaims: number;
  claimCategories: string[];

  // Prior art
  priorArtCount: number;
  blockingPriorArt: number;
  highRelevancePriorArt: number;
  priorArtDetails: { number: string; title: string; relevance: number; blocking: boolean; explanation: string }[];

  // Alice / 101 risk
  aliceRiskScore: number | null;
  aliceRiskLevel: string | null;
  aliceSummary: string | null;

  // Drawings & spec
  drawingsCount: number;
  specificationWordCount: number;
  abstractWordCount: number;
  hasFieldOfInvention: boolean;
  hasBackground: boolean;
  hasSummary: boolean;
  hasDetailedDescription: boolean;
  hasAbstract: boolean;

  // Fees
  estimatedFee: number;
  feeBreakdown: { label: string; amount: number }[];
}

// ---------------------------------------------------------------------------
// Risk assessment helpers
// ---------------------------------------------------------------------------

interface RiskItem {
  category: string;
  risk: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  likelihood: 'Unlikely' | 'Possible' | 'Likely' | 'Certain';
  mitigation: string;
}

function assessRisks(data: LegalBriefData): RiskItem[] {
  const risks: RiskItem[] = [];

  // Alice / 101 risk
  if (data.aliceRiskScore !== null && data.aliceRiskScore > 50) {
    risks.push({
      category: '35 USC 101',
      risk: 'Claims may be directed to abstract idea without sufficient inventive concept',
      severity: data.aliceRiskScore > 75 ? 'Critical' : 'High',
      likelihood: data.aliceRiskScore > 75 ? 'Likely' : 'Possible',
      mitigation: 'Anchor claims to specific technical implementation details; add hardware/transformation steps'
    });
  } else {
    risks.push({
      category: '35 USC 101',
      risk: 'Patent eligibility (Alice/Mayo)',
      severity: 'Low',
      likelihood: 'Unlikely',
      mitigation: 'Claims appear anchored to technical implementation'
    });
  }

  // Prior art / 102 risk
  if (data.blockingPriorArt > 0) {
    risks.push({
      category: '35 USC 102',
      risk: `${data.blockingPriorArt} potentially blocking prior art reference(s) identified`,
      severity: 'Critical',
      likelihood: 'Likely',
      mitigation: 'Narrow claims to distinguish from blocking references; consider design-around'
    });
  } else if (data.highRelevancePriorArt > 0) {
    risks.push({
      category: '35 USC 102',
      risk: `${data.highRelevancePriorArt} highly relevant prior art reference(s) found`,
      severity: 'Medium',
      likelihood: 'Possible',
      mitigation: 'Emphasize novel combinations and specific implementation differences'
    });
  } else if (data.priorArtCount === 0) {
    risks.push({
      category: '35 USC 102',
      risk: 'No prior art search completed — novelty unverified',
      severity: 'High',
      likelihood: 'Possible',
      mitigation: 'Conduct manual prior art search before filing; scores are preliminary'
    });
  }

  // Obviousness / 103 risk
  if (data.noveltyScore < 40) {
    risks.push({
      category: '35 USC 103',
      risk: 'Low novelty score suggests features may be considered obvious combinations',
      severity: 'High',
      likelihood: 'Likely',
      mitigation: 'Document unexpected results; quantify improvements over prior art'
    });
  } else if (data.weakNoveltyCount > data.strongNoveltyCount) {
    risks.push({
      category: '35 USC 103',
      risk: 'Majority of features rated weak novelty — obviousness challenge possible',
      severity: 'Medium',
      likelihood: 'Possible',
      mitigation: 'Focus claims on strong-novelty features; add performance benchmarks'
    });
  }

  // Enablement / 112 risk
  if (data.specificationWordCount < 500) {
    risks.push({
      category: '35 USC 112',
      risk: 'Specification may be insufficient for enablement requirement',
      severity: 'High',
      likelihood: 'Likely',
      mitigation: 'Expand detailed description with implementation specifics, code examples, data flows'
    });
  }

  // Claims risk
  if (data.totalClaims === 0) {
    risks.push({
      category: 'Claims',
      risk: 'No claims generated — application incomplete',
      severity: 'Critical',
      likelihood: 'Certain',
      mitigation: 'Generate claims before filing; at minimum need 1 independent claim'
    });
  } else if (data.independentClaims < 2) {
    risks.push({
      category: 'Claims',
      risk: 'Only 1 independent claim — narrow protection scope',
      severity: 'Medium',
      likelihood: 'Certain',
      mitigation: 'Add method, system, and computer-readable medium claims for broader coverage'
    });
  }

  // Drawings risk
  if (data.drawingsCount === 0) {
    risks.push({
      category: 'Drawings',
      risk: 'No drawings — may receive restriction requirement',
      severity: 'Medium',
      likelihood: 'Possible',
      mitigation: 'Add at least one system architecture diagram and one flowchart'
    });
  }

  return risks;
}

function assessCompliance(data: LegalBriefData): { item: string; status: 'pass' | 'fail' | 'warn'; note: string }[] {
  return [
    {
      item: 'Specification (35 USC 112)',
      status: data.hasDetailedDescription && data.specificationWordCount > 500 ? 'pass' : data.hasDetailedDescription ? 'warn' : 'fail',
      note: data.hasDetailedDescription ? `${data.specificationWordCount} words` : 'Missing detailed description'
    },
    {
      item: 'Abstract (37 CFR 1.72)',
      status: data.hasAbstract && data.abstractWordCount <= 150 && data.abstractWordCount >= 50 ? 'pass' : data.hasAbstract ? 'warn' : 'fail',
      note: data.hasAbstract ? `${data.abstractWordCount}/150 words` : 'Missing abstract'
    },
    {
      item: 'At least one claim',
      status: data.totalClaims > 0 ? 'pass' : 'fail',
      note: data.totalClaims > 0 ? `${data.totalClaims} claims (${data.independentClaims} independent)` : 'No claims'
    },
    {
      item: 'Drawings (35 USC 113)',
      status: data.drawingsCount > 0 ? 'pass' : 'warn',
      note: data.drawingsCount > 0 ? `${data.drawingsCount} drawing(s)` : 'Optional but recommended'
    },
    {
      item: 'Field of Invention',
      status: data.hasFieldOfInvention ? 'pass' : 'warn',
      note: data.hasFieldOfInvention ? 'Present' : 'Missing — add for completeness'
    },
    {
      item: 'Background of Invention',
      status: data.hasBackground ? 'pass' : 'warn',
      note: data.hasBackground ? 'Present' : 'Missing — strengthens application'
    },
    {
      item: 'Summary of Invention',
      status: data.hasSummary ? 'pass' : 'warn',
      note: data.hasSummary ? 'Present' : 'Missing — recommended'
    },
    {
      item: 'Inventor identified',
      status: data.inventorName ? 'pass' : 'fail',
      note: data.inventorName || 'Missing inventor name'
    },
    {
      item: 'Entity status declared',
      status: data.entityStatus ? 'pass' : 'fail',
      note: data.entityStatus === 'micro_entity' ? 'Micro Entity' : data.entityStatus === 'small_entity' ? 'Small Entity' : 'Regular Entity'
    },
    {
      item: 'Prior art search',
      status: data.priorArtCount > 0 ? 'pass' : 'warn',
      note: data.priorArtCount > 0 ? `${data.priorArtCount} references found` : 'Not completed — recommended before filing'
    },
  ];
}

function getRecommendedNextSteps(data: LegalBriefData, risks: RiskItem[]): string[] {
  const steps: string[] = [];
  const criticalRisks = risks.filter(r => r.severity === 'Critical');
  const highRisks = risks.filter(r => r.severity === 'High');

  if (data.totalClaims === 0) {
    steps.push('URGENT: Generate patent claims before filing — at least 1 independent method claim and 1 system claim');
  }

  if (criticalRisks.length > 0) {
    steps.push(`Address ${criticalRisks.length} critical risk(s) before filing: ${criticalRisks.map(r => r.category).join(', ')}`);
  }

  if (data.priorArtCount === 0) {
    steps.push('Conduct manual prior art search on USPTO PatFT/AppFT and Google Patents to validate novelty scores');
  }

  if (data.noveltyScore < 50) {
    steps.push('Consult a patent attorney — preliminary novelty score suggests patentability challenges');
  }

  if (highRisks.some(r => r.category === '35 USC 101')) {
    steps.push('Review claims with attorney for Alice/101 eligibility — anchor to specific technical implementation');
  }

  if (data.specificationWordCount < 1000) {
    steps.push('Expand specification with additional implementation details, code examples, and performance data');
  }

  if (data.independentClaims < 3 && data.totalClaims > 0) {
    steps.push('Consider adding claims in method, system, and computer-readable medium categories for broader protection');
  }

  if (data.drawingsCount < 2) {
    steps.push('Add system architecture diagram and at least one process flowchart');
  }

  // Filing recommendation
  if (criticalRisks.length === 0 && data.totalClaims > 0 && data.noveltyScore >= 40) {
    steps.push('Application appears ready for provisional filing — file to establish priority date, then refine within 12-month window');
  } else {
    steps.push('Recommended: file provisional application to secure priority date, then address identified issues before non-provisional conversion');
  }

  return steps;
}

// ---------------------------------------------------------------------------
// Data loader
// ---------------------------------------------------------------------------

export async function loadLegalBriefData(applicationId: string, projectId: string): Promise<LegalBriefData> {
  // Load patent application
  const { data: app } = await (supabase as any)
    .from('patent_applications')
    .select('*')
    .eq('id', applicationId)
    .single();

  if (!app) throw new Error('Patent application not found');

  // Load claims
  const { data: claims } = await (supabase as any)
    .from('patent_claims')
    .select('claim_number, claim_type, category')
    .eq('application_id', applicationId);

  // Load drawings
  const { count: drawingsCount } = await (supabase as any)
    .from('patent_drawings')
    .select('*', { count: 'exact', head: true })
    .eq('application_id', applicationId);

  // Load prior art — column is 'title' not 'patent_title'
  const { data: priorArt } = await (supabase as any)
    .from('patent_prior_art_results')
    .select('patent_number, title, relevance_score, is_blocking, similarity_explanation, metadata')
    .eq('application_id', applicationId)
    .order('relevance_score', { ascending: false });

  // Load novelty analysis
  let noveltyData: any = null;
  if (app.novelty_analysis_id) {
    const { data: na } = await (supabase as any)
      .from('patent_novelty_analyses')
      .select('*')
      .eq('id', app.novelty_analysis_id)
      .maybeSingle();
    noveltyData = na;
  }

  // Load features
  const { data: features } = await (supabase as any)
    .from('extracted_features')
    .select('novelty_strength, is_core_innovation')
    .eq('project_id', projectId);

  // Load project for analysis summary
  const { data: project } = await (supabase as any)
    .from('projects')
    .select('analysis_summary')
    .eq('id', projectId)
    .maybeSingle();

  const claimsList = claims || [];
  const priorArtList = priorArt || [];
  const featuresList = features || [];
  const specWords = (app.specification || '').split(/\s+/).filter(Boolean).length;
  const abstractWords = (app.abstract || '').split(/\s+/).filter(Boolean).length;

  // Fee calculation
  const independentClaimsCount = claimsList.filter((c: any) => c.claim_type === 'independent').length;
  const pageCount = estimatePageCount(specWords, abstractWords, claimsList.length, drawingsCount || 0);
  const fees = calculateFilingFee({
    filingType: 'provisional',
    entityStatus: app.entity_status || 'micro_entity',
    pageCount,
    totalClaims: claimsList.length,
    independentClaims: independentClaimsCount,
    multipleDependent: false,
  });

  const feeBreakdown: { label: string; amount: number }[] = [];
  if (fees.baseFee > 0) feeBreakdown.push({ label: 'Provisional Filing Fee', amount: fees.baseFee });
  if (fees.searchFee > 0) feeBreakdown.push({ label: 'Search Fee', amount: fees.searchFee });
  if (fees.examinationFee > 0) feeBreakdown.push({ label: 'Examination Fee', amount: fees.examinationFee });
  if (fees.claimsFee > 0) feeBreakdown.push({ label: 'Excess Claims Fee', amount: fees.claimsFee });
  if (fees.applicationSizeFee > 0) feeBreakdown.push({ label: 'Application Size Fee', amount: fees.applicationSizeFee });

  return {
    title: app.title,
    inventorName: app.inventor_name || '',
    entityStatus: app.entity_status || 'micro_entity',
    filingType: app.filing_type || 'provisional',
    docketNumber: (app.metadata as any)?.docket_number || '',
    generatedDate: new Date().toLocaleDateString(),
    technicalField: app.field_of_invention || app.technical_field || 'Not specified',
    inventionSummary: app.summary_invention || project?.analysis_summary || 'No summary available',
    problemSolved: app.problem_solved || '',
    totalFeatures: featuresList.length,
    coreInnovations: featuresList.filter((f: any) => f.is_core_innovation).length,
    strongNoveltyCount: featuresList.filter((f: any) => f.novelty_strength === 'strong').length,
    moderateNoveltyCount: featuresList.filter((f: any) => f.novelty_strength === 'moderate').length,
    weakNoveltyCount: featuresList.filter((f: any) => f.novelty_strength === 'weak').length,
    noveltyScore: app.novelty_score || 0,
    patentabilityAssessment: noveltyData?.patentability_assessment || '',
    noveltyStrengths: noveltyData?.novelty_strengths || [],
    noveltyWeaknesses: noveltyData?.novelty_weaknesses || [],
    noveltyRecommendations: noveltyData?.recommendations || [],
    totalClaims: claimsList.length,
    independentClaims: independentClaimsCount,
    dependentClaims: claimsList.length - independentClaimsCount,
    claimCategories: [...new Set(claimsList.map((c: any) => c.category).filter(Boolean))] as string[],
    priorArtCount: priorArtList.length,
    blockingPriorArt: priorArtList.filter((pa: any) => pa.is_blocking).length,
    highRelevancePriorArt: priorArtList.filter((pa: any) => pa.relevance_score >= 80).length,
    priorArtDetails: priorArtList.slice(0, 10).map((pa: any) => ({
      number: pa.patent_number,
      title: pa.title,
      relevance: pa.relevance_score,
      blocking: pa.is_blocking || false,
      explanation: pa.similarity_explanation || '',
    })),
    aliceRiskScore: (app.metadata as any)?.alice_risk_score ?? null,
    aliceRiskLevel: (app.metadata as any)?.alice_risk_level ?? null,
    aliceSummary: (app.metadata as any)?.alice_summary ?? null,
    drawingsCount: drawingsCount || 0,
    specificationWordCount: specWords,
    abstractWordCount: abstractWords,
    hasFieldOfInvention: !!(app.field_of_invention && app.field_of_invention.length > 10),
    hasBackground: !!(app.background_art && app.background_art.length > 10),
    hasSummary: !!(app.summary_invention && app.summary_invention.length > 10),
    hasDetailedDescription: !!(app.detailed_description && app.detailed_description.length > 10),
    hasAbstract: !!(app.abstract && app.abstract.length > 10),
    estimatedFee: fees.totalFee,
    feeBreakdown,
  };
}

// ---------------------------------------------------------------------------
// PDF Generation
// ---------------------------------------------------------------------------

const M = 50;
const PW = 612;
const PH = 792;
const CW = PW - M * 2;
const LH = 12;

function pg(doc: jsPDF, y: number, need: number): number {
  if (y + need > PH - M) { doc.addPage(); return M + 10; }
  return y;
}

function sectionTitle(doc: jsPDF, y: number, text: string): number {
  y = pg(doc, y, 25);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 64, 175); // blue-800
  doc.text(text, M, y);
  doc.setDrawColor(30, 64, 175);
  doc.line(M, y + 3, M + CW, y + 3);
  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(0, 0, 0);
  return y + LH + 6;
}

function bullet(doc: jsPDF, x: number, y: number, text: string, maxWidth: number): number {
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('\u2022', x, y);
  const lines = doc.splitTextToSize(text, maxWidth - 10);
  doc.text(lines, x + 8, y);
  return y + lines.length * LH;
}

export function generateLegalBriefPDF(data: LegalBriefData): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
  let y = M;

  const risks = assessRisks(data);
  const compliance = assessCompliance(data);
  const nextSteps = getRecommendedNextSteps(data, risks);

  // ---- COVER PAGE ----
  y += 60;
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 64, 175);
  doc.text('Git-Patent', PW / 2, y, { align: 'center' });
  y += 28;
  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.text('Patent Filing Readiness Report', PW / 2, y, { align: 'center' });
  y += 40;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  const titleLines = doc.splitTextToSize(data.title, CW - 40);
  doc.text(titleLines, PW / 2, y, { align: 'center' });
  y += titleLines.length * 16 + 30;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const infoLines = [
    `Inventor: ${data.inventorName || 'Not specified'}`,
    `Entity Status: ${data.entityStatus === 'micro_entity' ? 'Micro Entity' : data.entityStatus === 'small_entity' ? 'Small Entity' : 'Regular Entity'}`,
    `Filing Type: ${data.filingType === 'provisional' ? 'Provisional' : 'Non-Provisional'}`,
    `Report Generated: ${data.generatedDate}`,
    data.docketNumber ? `Docket Number: ${data.docketNumber}` : '',
  ].filter(Boolean);
  infoLines.forEach(line => {
    doc.text(line, PW / 2, y, { align: 'center' });
    y += LH;
  });

  y += 40;

  // Overall readiness gauge
  const passCount = compliance.filter(c => c.status === 'pass').length;
  const readiness = Math.round((passCount / compliance.length) * 100);
  const critCount = risks.filter(r => r.severity === 'Critical').length;
  const highCount = risks.filter(r => r.severity === 'High').length;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('FILING READINESS SUMMARY', PW / 2, y, { align: 'center' });
  y += 30;

  doc.setFontSize(32);
  doc.setFont('helvetica', 'bold');
  const readinessColor = readiness >= 80 ? [22, 163, 74] : readiness >= 50 ? [217, 119, 6] : [220, 38, 38];
  doc.setTextColor(readinessColor[0], readinessColor[1], readinessColor[2]);
  doc.text(`${readiness}%`, PW / 2, y, { align: 'center' });
  y += 18;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Compliance Score', PW / 2, y, { align: 'center' });
  doc.setTextColor(0, 0, 0);
  y += 20;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const summaryItems = [
    `Novelty Score: ${data.noveltyScore}/100`,
    `Claims: ${data.totalClaims} (${data.independentClaims} independent)`,
    `Prior Art: ${data.priorArtCount} references (${data.blockingPriorArt} blocking)`,
    `Critical Risks: ${critCount}  |  High Risks: ${highCount}`,
    `Estimated Filing Fee: ${formatCurrency(data.estimatedFee)}`,
  ];
  summaryItems.forEach(item => {
    doc.text(item, PW / 2, y, { align: 'center' });
    y += LH;
  });

  y += 20;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(100, 100, 100);
  doc.text('CONFIDENTIAL — For internal use and attorney review only', PW / 2, y, { align: 'center' });
  doc.text('This report is generated by automated analysis and does not constitute legal advice.', PW / 2, y + LH, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  // ---- PAGE 2: RISK ASSESSMENT ----
  doc.addPage();
  y = M;

  y = sectionTitle(doc, y, '1. PATENTABILITY RISK ASSESSMENT');

  // Risk table
  const riskColW = [80, 200, 60, 60, CW - 400];
  doc.setFillColor(240, 240, 240);
  doc.rect(M, y - 10, CW, 14, 'F');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  let rx = M + 3;
  ['Category', 'Risk', 'Severity', 'Likelihood', 'Mitigation'].forEach((h, i) => {
    doc.text(h, rx, y);
    rx += riskColW[i];
  });
  y += LH + 4;

  doc.setFont('helvetica', 'normal');
  risks.forEach(risk => {
    y = pg(doc, y, 30);
    rx = M + 3;
    doc.setFontSize(7);
    doc.text(risk.category, rx, y);
    rx += riskColW[0];
    const riskLines = doc.splitTextToSize(risk.risk, riskColW[1] - 5);
    doc.text(riskLines, rx, y);
    rx += riskColW[1];

    // Color-code severity
    const sevColors: Record<string, number[]> = { Critical: [220, 38, 38], High: [234, 88, 12], Medium: [217, 119, 6], Low: [22, 163, 74] };
    const sc = sevColors[risk.severity] || [0, 0, 0];
    doc.setTextColor(sc[0], sc[1], sc[2]);
    doc.setFont('helvetica', 'bold');
    doc.text(risk.severity, rx, y);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    rx += riskColW[2];

    doc.text(risk.likelihood, rx, y);
    rx += riskColW[3];

    const mitLines = doc.splitTextToSize(risk.mitigation, riskColW[4] - 5);
    doc.text(mitLines, rx, y);
    const rowHeight = Math.max(riskLines.length, mitLines.length) * LH + 4;
    doc.line(M, y + rowHeight - LH, M + CW, y + rowHeight - LH);
    y += rowHeight;
  });

  y += LH;

  // ---- COMPLIANCE CHECKLIST ----
  y = sectionTitle(doc, y, '2. USPTO FILING COMPLIANCE CHECKLIST');

  compliance.forEach(item => {
    y = pg(doc, y, 16);
    doc.setFontSize(8);
    const icon = item.status === 'pass' ? '\u2713' : item.status === 'fail' ? '\u2717' : '!';
    const colors: Record<string, number[]> = { pass: [22, 163, 74], fail: [220, 38, 38], warn: [217, 119, 6] };
    const c = colors[item.status];
    doc.setTextColor(c[0], c[1], c[2]);
    doc.setFont('helvetica', 'bold');
    doc.text(icon, M + 5, y);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    doc.text(item.item, M + 20, y);
    doc.setTextColor(100, 100, 100);
    doc.text(item.note, M + 180, y);
    doc.setTextColor(0, 0, 0);
    y += LH + 2;
  });

  y += LH;

  // ---- PRIOR ART EXPOSURE ----
  y = sectionTitle(doc, y, '3. PRIOR ART EXPOSURE SUMMARY');

  if (data.priorArtDetails.length === 0) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.text('No prior art search results available. Manual search recommended before filing.', M, y);
    y += LH * 2;
  } else {
    data.priorArtDetails.slice(0, 8).forEach(pa => {
      y = pg(doc, y, 30);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      const blockLabel = pa.blocking ? ' [BLOCKING]' : '';
      doc.text(`${pa.number}${blockLabel} — ${pa.title.substring(0, 70)}`, M + 5, y);
      y += LH;
      doc.setFont('helvetica', 'normal');
      doc.text(`Relevance: ${pa.relevance}/100`, M + 10, y);
      if (pa.explanation) {
        y += LH;
        const expLines = doc.splitTextToSize(pa.explanation.substring(0, 200), CW - 20);
        doc.text(expLines, M + 10, y);
        y += (expLines.length - 1) * LH;
      }
      y += LH + 2;
    });
  }

  // ---- NOVELTY ASSESSMENT ----
  y = pg(doc, y, 60);
  y = sectionTitle(doc, y, '4. NOVELTY & PATENTABILITY ASSESSMENT');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');

  if (data.patentabilityAssessment) {
    const assessLines = doc.splitTextToSize(data.patentabilityAssessment, CW);
    y = pg(doc, y, assessLines.length * LH + 10);
    doc.text(assessLines, M, y);
    y += assessLines.length * LH + LH;
  }

  if (data.noveltyStrengths.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.text('Strengths:', M, y);
    y += LH;
    data.noveltyStrengths.slice(0, 5).forEach(s => {
      y = pg(doc, y, 14);
      y = bullet(doc, M + 5, y, s, CW);
    });
    y += 4;
  }

  if (data.noveltyWeaknesses.length > 0) {
    y = pg(doc, y, 20);
    doc.setFont('helvetica', 'bold');
    doc.text('Weaknesses:', M, y);
    y += LH;
    data.noveltyWeaknesses.slice(0, 5).forEach(w => {
      y = pg(doc, y, 14);
      y = bullet(doc, M + 5, y, w, CW);
    });
    y += 4;
  }

  y += LH;

  // ---- RECOMMENDED NEXT STEPS ----
  y = pg(doc, y, 40);
  y = sectionTitle(doc, y, '5. RECOMMENDED NEXT STEPS');

  nextSteps.forEach((step, i) => {
    y = pg(doc, y, 20);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(`${i + 1}.`, M + 5, y);
    doc.setFont('helvetica', 'normal');
    const stepLines = doc.splitTextToSize(step, CW - 20);
    doc.text(stepLines, M + 18, y);
    y += stepLines.length * LH + 4;
  });

  y += LH * 2;

  // ---- FEE SUMMARY ----
  y = pg(doc, y, 60);
  y = sectionTitle(doc, y, '6. ESTIMATED FILING FEES');

  data.feeBreakdown.forEach(fee => {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(fee.label, M + 5, y);
    doc.text(formatCurrency(fee.amount), M + CW - 5, y, { align: 'right' });
    y += LH;
  });
  doc.line(M, y, M + CW, y);
  y += 12;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('TOTAL', M + 5, y);
  doc.text(formatCurrency(data.estimatedFee), M + CW - 5, y, { align: 'right' });

  // Footer on every page
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(150, 150, 150);
    doc.text('Git-Patent — Patent Filing Readiness Report — Confidential', PW / 2, PH - 30, { align: 'center' });
    doc.text(`Page ${i} of ${totalPages}`, PW - M, PH - 30, { align: 'right' });
    doc.setTextColor(0, 0, 0);
  }

  return doc;
}

export function downloadLegalBrief(data: LegalBriefData): void {
  const pdf = generateLegalBriefPDF(data);
  pdf.save(`Git_Patent_Legal_Brief_${data.title.substring(0, 30).replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
}
