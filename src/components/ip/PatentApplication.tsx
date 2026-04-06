import { useState, useEffect } from 'react';
import {
  Shield,
  FileText,
  List,
  Image,
  BookOpen,
  Download,
  Plus,
  Loader2,
  AlertCircle,
  Scroll,
  X,
  BarChart3,
  ClipboardCheck,
  Trash2,
  Users
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useProject } from '../../contexts/ProjectContext';
import { supabase } from '../../lib/supabase';
import {
  getPatentApplications,
  getPatentApplication,
  createPatentApplication,
  updatePatentApplication,
  deletePatentApplication,
  generateDefaultSpecification,
  generateDefaultAbstract,

  getStatusLabel,
  getStatusColor,
  type PatentApplication as PatentApplicationType,
  type PatentApplicationWithDetails,
} from '../../services/patent/patentApplicationService';
import { generateAIEnhancedClaims } from '../../services/patent/patentClaimsService';
import { extractCodebaseFeatures } from '../../services/patent/patentFeatureExtractionService';
import { generateDrawingsForApplication, regenerateSingleDrawing, svgToDataUrl } from '../../services/patent/patentDrawingsService';
import {
  createUsptoCompliantPdf,
  setPatentFont,
  addPdfAMetadata,
  PDF_MARGINS,
  getMaxTextWidth,
  getPageHeight,
} from '../../services/patent/patentPdfFontService';
import {
  searchPriorArt,
  getPriorArtResults,
  addManualPriorArt,
  updatePriorArtRelevance,
  generatePriorArtComparison,
} from '../../services/patent/patentPriorArtSearchService';
import {
  getNoveltyAnalysis,
  performNoveltyAnalysis,
  performAliceRiskAssessment,
  type AliceRiskAssessment,
} from '../../services/patent/patentNoveltyAnalysisService';
import { generateCoverSheetHTML } from '../../services/patent/coverSheetService';
import { PatentOverviewTab } from './patent/PatentOverviewTab';
import { PatentApplicantTab } from './patent/PatentApplicantTab';
import { PatentSpecificationTab } from './patent/PatentSpecificationTab';
import { PatentClaimsTab } from './patent/PatentClaimsTab';
import { PatentDrawingsTab } from './patent/PatentDrawingsTab';
import { PatentAbstractTab } from './patent/PatentAbstractTab';
import { PatentExportTab } from './patent/PatentExportTab';
import { PatentPriorArtTab } from './patent/PatentPriorArtTab';
import { PatentAnalysisTab } from './patent/PatentAnalysisTab';
import { PatentFilingTab } from './patent/PatentFilingTab';

type TabId = 'overview' | 'applicant' | 'specification' | 'claims' | 'drawings' | 'abstract' | 'prior-art' | 'analysis' | 'filing' | 'export';

// --- Generation Progress Modal ---

export function PatentApplication() {
  const { user } = useAuth();
  const { currentProject } = useProject();
  const projectId = currentProject?.id;

  const [applications, setApplications] = useState<PatentApplicationType[]>([]);
  const [selectedApp, setSelectedApp] = useState<PatentApplicationWithDetails | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingSpec, setEditingSpec] = useState(false);
  const [editingAbstract, setEditingAbstract] = useState(false);
  const [tempSpec, setTempSpec] = useState('');
  const [tempAbstract, setTempAbstract] = useState('');
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingSection, setExportingSection] = useState<string | null>(null);
  const [exportOptions, setExportOptions] = useState({ includeExemplaryClaims: false });

  // Prior Art tab state
  const [priorArtResults, setPriorArtResults] = useState<any[]>([]);
  const [searchingPriorArt, setSearchingPriorArt] = useState(false);
  const [comparisonReport, setComparisonReport] = useState<string | null>(null);
  const [generatingComparison, setGeneratingComparison] = useState(false);

  // Analysis tab state
  const [noveltyAnalysis, setNoveltyAnalysis] = useState<any | null>(null);
  const [aliceRiskAssessment, setAliceRiskAssessment] = useState<AliceRiskAssessment | null>(null);
  const [analyzingNovelty, setAnalyzingNovelty] = useState(false);
  const [analyzingAlice, setAnalyzingAlice] = useState(false);

  // Filing tab state
  const [coverSheetHTMLContent, setCoverSheetHTMLContent] = useState<string | null>(null);
  const [generatingCoverSheet, setGeneratingCoverSheet] = useState(false);

  // Create modal state
  const [createTitle, setCreateTitle] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createTechnicalField, setCreateTechnicalField] = useState('');
  const [createProblemSolved, setCreateProblemSolved] = useState('');
  const [prefilling, setPrefilling] = useState(false);

  const openCreateModalWithPrefill = async () => {
    setShowCreateModal(true);
    if (!projectId) return;
    setPrefilling(true);
    try {
      // Fetch project info + README
      const { data: project } = await (supabase as any)
        .from('projects')
        .select('name, source_url, analysis_summary, source_metadata')
        .eq('id', projectId)
        .maybeSingle();

      // Fetch extracted features
      const { data: features } = await (supabase as any)
        .from('extracted_features')
        .select('name, type, description, technical_details, novelty_strength, is_core_innovation')
        .eq('project_id', projectId)
        .order('is_core_innovation', { ascending: false });

      const readme = (project?.source_metadata as any)?.readmeContent || '';
      const featureList = (features || []).slice(0, 15);
      const projectName = project?.name || '';

      // Build a prompt to generate patent application metadata
      const prompt = `Based on the following codebase analysis, suggest a patent application title and description.

PROJECT: ${projectName}
${project?.source_url ? `URL: ${project.source_url}` : ''}
${project?.analysis_summary ? `ANALYSIS: ${project.analysis_summary}` : ''}

${readme ? `README:\n${readme.substring(0, 3000)}\n` : ''}

KEY FEATURES (from code analysis):
${featureList.map((f: any) => `- ${f.name} (${f.type}): ${f.description || ''}`).join('\n')}

Respond in JSON with these fields:
{
  "title": "A patent-style title describing the core innovation (e.g., 'System and Method for...')",
  "description": "2-3 sentence description of what the software does and its key innovations, based on the README and features above",
  "technicalField": "The technical field (e.g., 'Content Management Systems', 'Geographic Information Systems')",
  "problemSolved": "1 sentence describing the problem this software solves"
}

Base your response ONLY on the README and features provided. Do NOT invent capabilities not described above.
Respond with ONLY the JSON object.`;

      const { generateText } = await import('../../services/ai/geminiService');
      const response = await generateText(prompt, 'default');
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.title) setCreateTitle(parsed.title);
        if (parsed.description) setCreateDescription(parsed.description);
        if (parsed.technicalField) setCreateTechnicalField(parsed.technicalField);
        if (parsed.problemSolved) setCreateProblemSolved(parsed.problemSolved);
      }
    } catch (err) {
      console.error('Failed to prefill patent form:', err);
    } finally {
      setPrefilling(false);
    }
  };

  const convertSvgToPng = (svgContent: string, width: number = 800, height: number = 600): Promise<string> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Failed to get canvas context')); return; }
      canvas.width = width;
      canvas.height = height;
      const img = new window.Image();
      img.onload = () => {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => reject(new Error('Failed to load SVG image'));
      img.src = svgToDataUrl(svgContent);
    });
  };

  useEffect(() => {
    if (projectId && user) {
      loadApplications();
    }
  }, [projectId, user]);

  const loadApplications = async () => {
    if (!projectId || !user) return;
    setLoading(true);
    setError(null);
    try {
      const apps = await getPatentApplications(projectId, user.id);
      setApplications(apps);
      if (apps.length > 0 && !selectedApp) {
        await loadApplication(apps[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load applications');
    } finally {
      setLoading(false);
    }
  };

  const loadApplication = async (appId: string) => {
    if (!user) return;
    setLoading(true);
    try {
      const app = await getPatentApplication(appId, user.id);
      setSelectedApp(app);
      if (app) {
        setTempSpec(app.specification || '');
        setTempAbstract(app.abstract || '');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load application');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateApplication = async () => {
    if (!projectId || !user || !createTitle.trim()) return;
    setSaving(true);
    try {
      const app = await createPatentApplication(projectId, user.id, {
        title: createTitle.trim(),
        inventionDescription: createDescription,
        technicalField: createTechnicalField,
        problemSolved: createProblemSolved,
        specification: generateDefaultSpecification(),
        abstract: generateDefaultAbstract(),
      });
      await loadApplications();
      await loadApplication(app.id);
      setShowCreateModal(false);
      setCreateTitle('');
      setCreateDescription('');
      setCreateTechnicalField('');
      setCreateProblemSolved('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create application');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteApplication = async () => {
    if (!selectedApp) return;
    setSaving(true);
    try {
      await deletePatentApplication(selectedApp.id);
      setSelectedApp(null);
      setShowDeleteModal(false);
      await loadApplications();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete application');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSpecification = async () => {
    if (!selectedApp) return;
    setSaving(true);
    try {
      await updatePatentApplication(selectedApp.id, { specification: tempSpec });
      setSelectedApp({ ...selectedApp, specification: tempSpec });
      setEditingSpec(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save specification');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAbstract = async () => {
    if (!selectedApp) return;
    setSaving(true);
    try {
      await updatePatentApplication(selectedApp.id, { abstract: tempAbstract });
      setSelectedApp({ ...selectedApp, abstract: tempAbstract });
      setEditingAbstract(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save abstract');
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateClaims = async () => {
    if (!selectedApp || !projectId || !user) return;
    setGenerating(true);
    setError(null);
    try {
      // Extract features and novelty for AI claim generation
      const featuresResult = await extractCodebaseFeatures(projectId);
      const noveltyAnalysis = await performNoveltyAnalysis(projectId, selectedApp.id, user.id);
      const claims = await generateAIEnhancedClaims(
        selectedApp.id,
        featuresResult.features,
        noveltyAnalysis,
        projectId,
        selectedApp.title,
        selectedApp.detailed_description || selectedApp.invention_description || ''
      );
      setSelectedApp({ ...selectedApp, claims });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate claims');
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateDrawings = async () => {
    if (!selectedApp || !projectId) return;
    setGenerating(true);
    try {
      const drawings = await generateDrawingsForApplication(selectedApp.id, projectId);
      setSelectedApp({ ...selectedApp, drawings });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate drawings');
    } finally {
      setGenerating(false);
    }
  };

  // --- Prior Art handlers ---
  const handleSearchPriorArt = async () => {
    if (!selectedApp || !projectId) return;
    setSearchingPriorArt(true);
    setError(null);
    try {
      await searchPriorArt(projectId, selectedApp.id, {
        title: selectedApp.title,
        description: selectedApp.invention_description || selectedApp.detailed_description || '',
      });
      // Reload from DB to get normalized format
      const saved = await getPriorArtResults(selectedApp.id);
      setPriorArtResults(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search prior art');
    } finally {
      setSearchingPriorArt(false);
    }
  };

  const handleAddManualPriorArt = async (patentNumber: string, notes?: string) => {
    if (!selectedApp || !projectId) return;
    try {
      await addManualPriorArt(projectId, selectedApp.id, patentNumber, notes);
      const saved = await getPriorArtResults(selectedApp.id);
      setPriorArtResults(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add prior art');
    }
  };

  const handleUpdatePriorArtRelevance = async (priorArtId: string, isRelevant: boolean) => {
    try {
      await updatePriorArtRelevance(priorArtId, isRelevant);
      const saved = await getPriorArtResults(selectedApp!.id);
      setPriorArtResults(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update relevance');
    }
  };

  const handleGenerateComparison = async () => {
    if (!selectedApp) return;
    setGeneratingComparison(true);
    try {
      const report = await generatePriorArtComparison(selectedApp.id, []);
      setComparisonReport(report);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate comparison');
    } finally {
      setGeneratingComparison(false);
    }
  };

  // --- Analysis handlers ---
  const handleRunNoveltyAnalysis = async () => {
    if (!selectedApp || !projectId || !user) return;
    setAnalyzingNovelty(true);
    setError(null);
    try {
      await performNoveltyAnalysis(projectId, selectedApp.id, user.id);
      const analysis = await getNoveltyAnalysis(selectedApp.id);
      setNoveltyAnalysis(analysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run novelty analysis');
    } finally {
      setAnalyzingNovelty(false);
    }
  };

  const handleRunAliceRisk = async () => {
    if (!selectedApp || !projectId) return;
    setAnalyzingAlice(true);
    setError(null);
    try {
      const assessment = await performAliceRiskAssessment(selectedApp.id, projectId);
      setAliceRiskAssessment(assessment);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run Alice risk assessment');
    } finally {
      setAnalyzingAlice(false);
    }
  };

  // --- Filing handlers ---
  const handleGenerateCoverSheet = () => {
    if (!selectedApp) return;
    setGeneratingCoverSheet(true);
    try {
      const html = generateCoverSheetHTML({
        title: selectedApp.title,
        inventors: selectedApp.inventor_name ? [{
          id: '1',
          fullName: selectedApp.inventor_name,
          residence: { city: '', state: '', country: selectedApp.inventor_citizenship || 'US' },
          citizenship: selectedApp.inventor_citizenship || 'US',
        }] : [],
        correspondenceAddress: selectedApp.correspondence_address || {
          street: '', city: '', state: '', zipCode: '', country: 'US',
        },
        attorneyInfo: selectedApp.attorney_info || undefined,
        entityStatus: (selectedApp.entity_status as any) || 'small_entity',
      });
      setCoverSheetHTMLContent(html);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate cover sheet');
    } finally {
      setGeneratingCoverSheet(false);
    }
  };

  // --- Lazy load data when switching tabs ---
  useEffect(() => {
    if (!selectedApp) return;
    if (activeTab === 'prior-art' && priorArtResults.length === 0) {
      getPriorArtResults(selectedApp.id).then(setPriorArtResults).catch(() => {});
    }
    if (activeTab === 'analysis' && !noveltyAnalysis) {
      getNoveltyAnalysis(selectedApp.id).then(setNoveltyAnalysis).catch(() => {});
    }
  }, [activeTab, selectedApp?.id]);

  // Reset tab-specific state when switching applications
  useEffect(() => {
    setPriorArtResults([]);
    setComparisonReport(null);
    setNoveltyAnalysis(null);
    setAliceRiskAssessment(null);
    setCoverSheetHTMLContent(null);
  }, [selectedApp?.id]);

  const handleExportPDF = async () => {
    if (!selectedApp) return;
    setExporting(true);
    try {
      const drawingsWithImages: Map<number, string> = new Map();
      if (selectedApp.drawings.length > 0) {
        for (const drawing of selectedApp.drawings) {
          if (drawing.svg_content) {
            try {
              const pngDataUrl = await convertSvgToPng(drawing.svg_content, 800, 600);
              drawingsWithImages.set(drawing.figure_number, pngDataUrl);
            } catch { /* skip failed drawings */ }
          }
        }
      }

      const pdf = createUsptoCompliantPdf();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = getPageHeight(pdf);
      const margin = PDF_MARGINS.top;
      const maxWidth = getMaxTextWidth(pdf);
      let yPos = margin;

      setPatentFont(pdf, 'bold');
      pdf.setFontSize(14);
      const titleLines = pdf.splitTextToSize(selectedApp.title.toUpperCase(), maxWidth);
      titleLines.forEach((line: string) => {
        pdf.text(line, pageWidth / 2, yPos, { align: 'center' });
        yPos += 18;
      });
      yPos += 12;

      setPatentFont(pdf, 'normal');
      pdf.setFontSize(12);
      if (selectedApp.inventor_name) {
        pdf.text(`Inventor: ${selectedApp.inventor_name}`, margin, yPos);
        yPos += 18;
      }
      pdf.text(`Citizenship: ${selectedApp.inventor_citizenship}`, margin, yPos);
      yPos += 30;

      if (selectedApp.abstract) {
        setPatentFont(pdf, 'bold');
        pdf.text('ABSTRACT', pageWidth / 2, yPos, { align: 'center' });
        yPos += 20;
        setPatentFont(pdf, 'normal');
        const abstractLines = pdf.splitTextToSize(selectedApp.abstract, maxWidth);
        pdf.text(abstractLines, margin, yPos);
        yPos += abstractLines.length * 14 + 30;
      }

      if (selectedApp.specification) {
        if (yPos > 600) { pdf.addPage(); yPos = margin; }
        const specLines = selectedApp.specification.split('\n');
        for (const line of specLines) {
          if (yPos > 700) { pdf.addPage(); yPos = margin; }
          if (line.match(/^[A-Z\s]+$/) && line.trim().length > 0) {
            setPatentFont(pdf, 'bold');
            yPos += 10;
            pdf.text(line, margin, yPos);
            setPatentFont(pdf, 'normal');
            yPos += 18;
          } else {
            const wrapped = pdf.splitTextToSize(line, maxWidth);
            pdf.text(wrapped, margin, yPos);
            yPos += wrapped.length * 14;
          }
        }
      }

      if (selectedApp.claims.length > 0) {
        pdf.addPage();
        yPos = margin;
        setPatentFont(pdf, 'bold');
        pdf.setFontSize(14);
        const claimsHeader = exportOptions.includeExemplaryClaims ? 'EXEMPLARY CLAIMS' : 'CLAIMS';
        pdf.text(claimsHeader, pageWidth / 2, yPos, { align: 'center' });
        yPos += 30;
        setPatentFont(pdf, 'normal');
        pdf.setFontSize(12);
        for (const claim of selectedApp.claims.sort((a, b) => a.claim_number - b.claim_number)) {
          if (yPos > 650) { pdf.addPage(); yPos = margin; }
          const claimText = `${claim.claim_number}. ${claim.claim_text}`;
          const wrapped = pdf.splitTextToSize(claimText, maxWidth);
          pdf.text(wrapped, margin, yPos);
          yPos += wrapped.length * 14 + 20;
        }
      }

      if (selectedApp.drawings.length > 0) {
        for (const drawing of selectedApp.drawings.sort((a, b) => a.figure_number - b.figure_number)) {
          pdf.addPage();
          setPatentFont(pdf, 'bold');
          pdf.setFontSize(12);
          pdf.text(`FIG. ${drawing.figure_number} - ${drawing.title}`, pageWidth / 2, margin, { align: 'center' });
          const pngDataUrl = drawingsWithImages.get(drawing.figure_number);
          if (pngDataUrl) {
            const imgMaxWidth = maxWidth;
            const imgMaxHeight = pageHeight - margin * 2 - 100;
            const aspectRatio = 800 / 600;
            let imgWidth = imgMaxWidth;
            let imgHeight = imgWidth / aspectRatio;
            if (imgHeight > imgMaxHeight) { imgHeight = imgMaxHeight; imgWidth = imgHeight * aspectRatio; }
            const imgX = (pageWidth - imgWidth) / 2;
            pdf.addImage(pngDataUrl, 'PNG', imgX, margin + 30, imgWidth, imgHeight);
          }
          setPatentFont(pdf, 'normal');
          pdf.setFontSize(12);
          if (drawing.description) {
            const descLines = pdf.splitTextToSize(drawing.description, maxWidth);
            const descY = pngDataUrl ? margin + 30 + (pageHeight - margin * 2 - 100) + 20 : margin + 50;
            pdf.text(descLines, margin, Math.min(descY, 680));
          }
        }
      }

      addPdfAMetadata(pdf, selectedApp.title, selectedApp.inventor_name || 'Unknown Inventor');
      pdf.save(`${selectedApp.title.replace(/\s+/g, '_')}_Patent_Application.pdf`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export PDF');
    } finally {
      setExporting(false);
    }
  };

  const handleExportSectionPDF = async (section: string) => {
    if (!selectedApp) return;
    setExportingSection(section);
    try {
      const pdf = createUsptoCompliantPdf();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = PDF_MARGINS.top;
      const maxWidth = getMaxTextWidth(pdf);
      let yPos = margin;

      setPatentFont(pdf, 'bold');
      pdf.setFontSize(12);
      const titleLines = pdf.splitTextToSize(selectedApp.title.toUpperCase(), maxWidth);
      titleLines.forEach((line: string) => {
        pdf.text(line, pageWidth / 2, yPos, { align: 'center' });
        yPos += 16;
      });
      yPos += 20;

      setPatentFont(pdf, 'bold');
      pdf.setFontSize(14);
      pdf.text(section.toUpperCase().replace(/-/g, ' '), pageWidth / 2, yPos, { align: 'center' });
      yPos += 30;
      setPatentFont(pdf, 'normal');
      pdf.setFontSize(12);

      if (section === 'specification' && selectedApp.specification) {
        const specLines = pdf.splitTextToSize(selectedApp.specification, maxWidth);
        pdf.text(specLines, margin, yPos);
      } else if (section === 'abstract' && selectedApp.abstract) {
        const abstractLines = pdf.splitTextToSize(selectedApp.abstract, maxWidth);
        pdf.text(abstractLines, margin, yPos);
      }

      addPdfAMetadata(pdf, `${selectedApp.title} - ${section}`, selectedApp.inventor_name || 'Unknown Inventor');
      pdf.save(`${selectedApp.title.replace(/\s+/g, '_')}_${section}.pdf`);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to export ${section} PDF`);
    } finally {
      setExportingSection(null);
    }
  };

  const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Overview', icon: Shield },
    { id: 'applicant', label: 'Applicant', icon: Users },
    { id: 'specification', label: 'Specification', icon: FileText },
    { id: 'claims', label: 'Claims', icon: List },
    { id: 'drawings', label: 'Drawings', icon: Image },
    { id: 'abstract', label: 'Abstract', icon: BookOpen },
    { id: 'prior-art', label: 'Prior Art', icon: Scroll },
    { id: 'analysis', label: 'Analysis', icon: BarChart3 },
    { id: 'filing', label: 'Filing', icon: ClipboardCheck },
    { id: 'export', label: 'Export', icon: Download }
  ];

  if (loading && applications.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center mx-auto mb-4">
            <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
          </div>
          <p className="text-gray-500 text-sm font-medium">Loading patent applications...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-200">
              <Shield className="w-5 h-5 text-white" />
            </div>
            Patent Applications
          </h1>
          <p className="text-gray-500 text-sm mt-1.5 ml-[52px]">Manage and generate patent documentation</p>
        </div>
        <button
          onClick={openCreateModalWithPrefill}
          className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200 hover:shadow-lg hover:shadow-blue-200"
        >
          <Plus className="w-4 h-4" />
          New Application
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-6 bg-white border border-red-200 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
          <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-4 h-4 text-red-500" />
          </div>
          <div className="flex-1 pt-1">
            <p className="text-sm font-semibold text-red-800">Something went wrong</p>
            <p className="text-sm text-red-600 mt-0.5">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-red-300 hover:text-red-500 transition-colors p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar - Applications List */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Applications</h2>
            </div>
            <div className="divide-y divide-gray-50 max-h-[600px] overflow-y-auto">
              {applications.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-3">
                    <FileText className="w-6 h-6 text-gray-300" />
                  </div>
                  <p className="text-gray-500 text-sm">No applications yet</p>
                  <button
                    onClick={openCreateModalWithPrefill}
                    className="mt-3 text-blue-600 hover:text-blue-700 text-sm font-semibold transition-colors"
                  >
                    Create your first application
                  </button>
                </div>
              ) : (
                applications.map(app => (
                  <button
                    key={app.id}
                    onClick={() => loadApplication(app.id)}
                    className={`w-full px-4 py-4 text-left transition-all duration-150 ${
                      selectedApp?.id === app.id
                        ? 'bg-blue-50/60 border-l-[3px] border-l-blue-600'
                        : 'hover:bg-slate-50 border-l-[3px] border-l-transparent'
                    }`}
                  >
                    <p className={`text-sm font-medium truncate ${selectedApp?.id === app.id ? 'text-blue-900' : 'text-gray-800'}`}>{app.title}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${getStatusColor(app.status)}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                        {getStatusLabel(app.status)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1.5">
                      {new Date(app.updated_at).toLocaleDateString()}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          {selectedApp ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {/* Top bar with title + actions */}
              <div className="px-6 py-4 border-b border-gray-100 bg-white flex items-center justify-between">
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-gray-900 truncate">{selectedApp.title}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${getStatusColor(selectedApp.status)}`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                      {getStatusLabel(selectedApp.status)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportPDF}
                    disabled={exporting}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:shadow-sm disabled:opacity-50 transition-all"
                  >
                    {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    Export
                  </button>
                </div>
              </div>

              {/* Tab Navigation - horizontal pills */}
              <div className="border-b border-gray-100 bg-slate-50/50 px-4 py-2.5">
                <div className="flex gap-1 overflow-x-auto scrollbar-hide">
                  {tabs.map(tab => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium whitespace-nowrap rounded-lg transition-all duration-150 ${
                          activeTab === tab.id
                            ? 'bg-white text-blue-700 shadow-sm border border-gray-200/80'
                            : 'text-gray-500 hover:text-gray-700 hover:bg-white/60'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Tab Content */}
              <div className="p-6">
                {activeTab === 'overview' && (
                  <PatentOverviewTab
                    application={selectedApp}
                    onUpdate={async (updates) => {
                      await updatePatentApplication(selectedApp.id, updates);
                      setSelectedApp({ ...selectedApp, ...updates });
                    }}
                    onDelete={() => setShowDeleteModal(true)}
                    onNavigate={(tabId) => setActiveTab(tabId as TabId)}
                  />
                )}

                {activeTab === 'applicant' && (
                  <PatentApplicantTab
                    application={selectedApp}
                    onUpdate={async (updates) => {
                      await updatePatentApplication(selectedApp.id, updates);
                      setSelectedApp({ ...selectedApp, ...updates });
                    }}
                  />
                )}

                {activeTab === 'specification' && (
                  <PatentSpecificationTab
                    specification={editingSpec ? tempSpec : selectedApp.specification || ''}
                    editing={editingSpec}
                    saving={saving}
                    onEdit={() => { setTempSpec(selectedApp.specification || ''); setEditingSpec(true); }}
                    onChange={setTempSpec}
                    onSave={handleSaveSpecification}
                    onCancel={() => setEditingSpec(false)}
                    onRegenerate={() => setTempSpec(generateDefaultSpecification())}
                  />
                )}

                {activeTab === 'claims' && (
                  <PatentClaimsTab
                    claims={selectedApp.claims}
                    generating={generating}
                    onGenerate={handleGenerateClaims}
                  />
                )}

                {activeTab === 'drawings' && (
                  <PatentDrawingsTab
                    drawings={selectedApp.drawings}
                    generating={generating}
                    onGenerate={handleGenerateDrawings}
                    onRegenerateSingle={async (figureNumber) => {
                      if (!selectedApp || !projectId) return;
                      const newDrawing = await regenerateSingleDrawing(selectedApp.id, projectId, figureNumber);
                      if (newDrawing) {
                        setSelectedApp({
                          ...selectedApp,
                          drawings: selectedApp.drawings.map(d =>
                            d.figure_number === figureNumber ? newDrawing : d
                          ),
                        });
                      }
                    }}
                    onDrawingsUpdated={(updatedDrawings) => {
                      if (!selectedApp) return;
                      setSelectedApp({ ...selectedApp, drawings: updatedDrawings });
                    }}
                    inventionTitle={selectedApp.title}
                    claims={selectedApp.claims?.map(c => c.claim_text) || []}
                  />
                )}

                {activeTab === 'abstract' && (
                  <PatentAbstractTab
                    abstract={editingAbstract ? tempAbstract : selectedApp.abstract || ''}
                    editing={editingAbstract}
                    saving={saving}
                    onEdit={() => { setTempAbstract(selectedApp.abstract || ''); setEditingAbstract(true); }}
                    onChange={setTempAbstract}
                    onSave={handleSaveAbstract}
                    onCancel={() => setEditingAbstract(false)}
                    onRegenerate={() => setTempAbstract(generateDefaultAbstract())}
                  />
                )}

                {activeTab === 'prior-art' && (
                  <PatentPriorArtTab
                    priorArtResults={priorArtResults}
                    searching={searchingPriorArt}
                    onSearch={handleSearchPriorArt}
                    onAddManual={handleAddManualPriorArt}
                    onUpdateRelevance={handleUpdatePriorArtRelevance}
                    onGenerateComparison={handleGenerateComparison}
                    comparisonReport={comparisonReport}
                    generatingComparison={generatingComparison}
                  />
                )}

                {activeTab === 'analysis' && (
                  <PatentAnalysisTab
                    noveltyAnalysis={noveltyAnalysis}
                    aliceRiskAssessment={aliceRiskAssessment}
                    analyzing={analyzingNovelty}
                    analyzingAlice={analyzingAlice}
                    onRunNoveltyAnalysis={handleRunNoveltyAnalysis}
                    onRunAliceRisk={handleRunAliceRisk}
                    hasClaims={selectedApp.claims.length > 0}
                  />
                )}

                {activeTab === 'filing' && (
                  <PatentFilingTab
                    application={selectedApp}
                    onGenerateCoverSheet={handleGenerateCoverSheet}
                    coverSheetHTML={coverSheetHTMLContent}
                    generatingCoverSheet={generatingCoverSheet}
                  />
                )}

                {activeTab === 'export' && (
                  <PatentExportTab
                    application={selectedApp}
                    onExportPDF={handleExportPDF}
                    onExportSectionPDF={handleExportSectionPDF}
                    exporting={exporting}
                    exportingSection={exportingSection}
                    exportOptions={exportOptions}
                    onExportOptionsChange={setExportOptions}
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center mx-auto mb-5">
                <Shield className="w-9 h-9 text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">No Application Selected</h3>
              <p className="text-gray-500 text-sm mb-8 max-w-sm mx-auto">Select an application from the list or create a new one to get started.</p>
              <button
                onClick={openCreateModalWithPrefill}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200"
              >
                <Plus className="w-4 h-4" />
                Create Application
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowCreateModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">New Patent Application</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  {prefilling ? (
                    <span className="inline-flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> AI is pre-filling from your codebase analysis...</span>
                  ) : 'Review and edit the AI-suggested details below'}
                </p>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Title *</label>
                <input
                  type="text"
                  value={createTitle}
                  onChange={e => setCreateTitle(e.target.value)}
                  className="w-full px-4 py-3 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white outline-none transition-all"
                  placeholder="Enter patent title"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Invention Description</label>
                <textarea
                  value={createDescription}
                  onChange={e => setCreateDescription(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white outline-none transition-all resize-none"
                  placeholder="Describe what your invention does and how it works..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Technical Field</label>
                  <input
                    type="text"
                    value={createTechnicalField}
                    onChange={e => setCreateTechnicalField(e.target.value)}
                    className="w-full px-4 py-3 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white outline-none transition-all"
                    placeholder="e.g., Data processing"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Problem Solved</label>
                  <input
                    type="text"
                    value={createProblemSolved}
                    onChange={e => setCreateProblemSolved(e.target.value)}
                    className="w-full px-4 py-3 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white outline-none transition-all"
                    placeholder="What problem does it solve?"
                  />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 bg-slate-50/50 rounded-b-2xl flex justify-end gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-5 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateApplication}
                disabled={saving || !createTitle.trim()}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 transition-all shadow-sm"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Create Application
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedApp && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowDeleteModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-red-500" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Delete Application</h3>
              </div>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-600 leading-relaxed">
                Are you sure you want to delete <span className="font-semibold text-gray-900">"{selectedApp.title}"</span>? This will permanently remove all claims, drawings, and specification data. This action cannot be undone.
              </p>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 bg-slate-50/50 rounded-b-2xl flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-5 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteApplication}
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 disabled:opacity-50 transition-all shadow-sm"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Generation Progress Modal */}
    </div>
  );
}
