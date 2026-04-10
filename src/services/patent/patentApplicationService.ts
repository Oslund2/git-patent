import { supabase } from '../../lib/supabase';

export type EntityStatus = 'regular' | 'small_entity' | 'micro_entity';

export interface InventorInfo {
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

export interface CorrespondenceAddressInfo {
  name?: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  phone?: string;
  email?: string;
}

export interface AttorneyInfoData {
  name?: string;
  registrationNumber?: string;
  firm?: string;
}

export interface CPCClassificationData {
  primary: string | null;
  primaryDetails?: {
    code: string;
    title: string;
    description?: string;
    level: number;
    category: string;
    confidence?: number;
  };
  secondary: string[];
  secondaryDetails?: Array<{
    code: string;
    title: string;
    description?: string;
    level: number;
    category: string;
    confidence?: number;
  }>;
  ai_suggested: boolean;
  confidence: number | null;
  rationale?: string;
}

export interface FilingChecklistStatus {
  title?: { complete: boolean; value?: string };
  specification?: { complete: boolean; word_count?: number };
  abstract?: { complete: boolean; word_count?: number; valid?: boolean };
  claims?: { complete: boolean; total?: number; independent?: number };
  drawings?: { complete: boolean; count?: number };
  inventors?: { complete: boolean; count?: number };
  entity_status?: { complete: boolean; value?: string };
  correspondence_address?: { complete: boolean; has_data?: boolean };
  cpc_classification?: { complete: boolean; primary?: string };
  ready_to_file?: boolean;
}

export interface PatentApplication {
  id: string;
  project_id: string;
  user_id: string;
  title: string;
  filing_type: 'provisional' | 'non_provisional' | 'continuation' | 'cip' | 'divisional';
  status: 'draft' | 'in_review' | 'ready_to_file' | 'filed' | 'pending' | 'granted' | 'rejected' | 'abandoned';
  inventor_name: string | null;
  inventor_citizenship: string;
  specification: string | null;
  abstract: string | null;
  invention_description: string | null;
  technical_field: string | null;
  problem_solved: string | null;
  key_features: string[];
  field_of_invention: string | null;
  background_art: string | null;
  summary_invention: string | null;
  detailed_description: string | null;
  prior_art_patents: PriorArtReference[];
  prior_art_literature: PriorArtReference[];
  prior_art_search_status?: string;
  prior_art_search_completed_at?: string | null;
  novelty_score?: number | null;
  novelty_analysis_id?: string | null;
  differentiation_analysis?: string | null;
  claims_generation_status?: string;
  claims_generation_completed_at?: string | null;
  drawings_generation_status?: string;
  drawings_generation_completed_at?: string | null;
  specification_generation_status?: string;
  specification_generation_completed_at?: string | null;
  full_application_status?: string;
  full_application_completed_at?: string | null;
  cpc_classifications: CPCClassificationData;
  entity_status: EntityStatus;
  inventors: InventorInfo[];
  correspondence_address: CorrespondenceAddressInfo | null;
  attorney_info: AttorneyInfoData | null;
  government_interest: string | null;
  foreign_priority_claims: Array<{
    country: string;
    application_number: string;
    filing_date: string;
  }>;
  filing_checklist_status: FilingChecklistStatus;
  provisional_filing_date: string | null;
  conversion_deadline: string | null;
  estimated_filing_fee: number | null;
  metadata: Record<string, unknown>;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface PatentClaim {
  id: string;
  application_id: string;
  claim_number: number;
  claim_type: 'independent' | 'dependent';
  parent_claim_id: string | null;
  claim_text: string;
  status: 'draft' | 'reviewed' | 'finalized';
  category: 'method' | 'system' | 'apparatus' | 'composition';
  created_at: string;
  updated_at: string;
}

export interface PatentDrawing {
  id: string;
  application_id: string;
  figure_number: number;
  title: string;
  description: string | null;
  svg_content: string | null;
  image_url: string | null;
  drawing_type: 'block_diagram' | 'flowchart' | 'wireframe' | 'schematic' | 'sequence_diagram';
  callouts: DrawingCallout[];
  created_at: string;
  updated_at: string;
}

export interface DrawingCallout {
  number: number;
  label: string;
  description: string;
}

export interface PriorArtReference {
  id: string;
  type: 'patent' | 'application' | 'article' | 'book' | 'website';
  reference_number?: string;
  title: string;
  authors?: string;
  date?: string;
  relevance?: string;
}

export interface PriorArtSearchResult {
  id: string;
  patent_application_id: string;
  patent_number: string | null;
  patent_title: string | null;
  patent_abstract: string | null;
  relevance_score: number | null;
  similarity_explanation: string | null;
  is_blocking: boolean;
  created_at: string;
}

export interface PatentApplicationWithDetails extends PatentApplication {
  claims: PatentClaim[];
  drawings: PatentDrawing[];
  priorArt?: PriorArtSearchResult[];
}

export async function getPatentApplications(projectId: string, userId: string): Promise<PatentApplication[]> {
  const { data, error } = await (supabase as any)
    .from('patent_applications')
    .select('*')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getPatentApplication(applicationId: string, userId: string): Promise<PatentApplicationWithDetails | null> {
  const { data: application, error: appError } = await (supabase as any)
    .from('patent_applications')
    .select('*')
    .eq('id', applicationId)
    .eq('user_id', userId)
    .maybeSingle();

  if (appError) throw appError;
  if (!application) return null;

  const { data: claims, error: claimsError } = await (supabase as any)
    .from('patent_claims')
    .select('*')
    .eq('application_id', applicationId)
    .order('claim_number', { ascending: true });

  if (claimsError) throw claimsError;

  const { data: drawings, error: drawingsError } = await (supabase as any)
    .from('patent_drawings')
    .select('*')
    .eq('application_id', applicationId)
    .order('figure_number', { ascending: true });

  if (drawingsError) throw drawingsError;

  const { data: priorArt, error: priorArtError } = await (supabase as any)
    .from('patent_prior_art_results')
    .select('*')
    .eq('application_id', applicationId)
    .order('relevance_score', { ascending: false });

  if (priorArtError) console.error('Error loading prior art:', priorArtError);

  return {
    ...application,
    inventors: application.inventors || [],
    correspondence_address: application.correspondence_address || null,
    claims: claims || [],
    drawings: drawings || [],
    priorArt: priorArt || []
  };
}

export interface CreatePatentInput {
  title: string;
  inventionDescription?: string;
  technicalField?: string;
  problemSolved?: string;
  keyFeatures?: string[];
  specification?: string;
  abstract?: string;
}

export async function createPatentApplication(
  projectId: string,
  userId: string,
  data: CreatePatentInput | Partial<PatentApplication>
): Promise<PatentApplication> {
  const input = data as CreatePatentInput;
  const appData = data as Partial<PatentApplication>;

  const { data: application, error } = await (supabase as any)
    .from('patent_applications')
    .insert([{
      project_id: projectId,
      user_id: userId,
      title: input.title || appData.title || 'Untitled Patent Application',
      status: 'draft',
      specification: input.specification || appData.specification || null,
      abstract: input.abstract || appData.abstract || null,
      field_of_invention: input.technicalField || appData.field_of_invention || null,
      detailed_description: input.inventionDescription || appData.detailed_description || null,
      metadata: {
        filing_type: appData.filing_type || 'provisional',
        inventor_name: appData.inventor_name || null,
        inventor_citizenship: appData.inventor_citizenship || 'US Citizen',
        problem_solved: input.problemSolved || appData.problem_solved || null,
        key_features: input.keyFeatures || appData.key_features || [],
        prior_art_patents: appData.prior_art_patents || [],
        prior_art_literature: appData.prior_art_literature || [],
        version: 1,
      },
    }])
    .select()
    .single();

  if (error) throw error;
  return application;
}

// Columns that exist in the patent_applications table
const VALID_PATENT_COLUMNS = new Set([
  'title', 'status', 'abstract', 'specification', 'field_of_invention',
  'background_art', 'summary_invention', 'detailed_description',
  'prior_art_search_status', 'prior_art_search_completed_at',
  'novelty_score', 'novelty_analysis_id', 'differentiation_analysis',
  'claims_generation_status', 'drawings_generation_status',
  'specification_generation_status', 'full_application_status',
  'metadata', 'inventors', 'entity_status', 'correspondence_address',
  'attorney_info', 'cpc_classification', 'updated_at',
]);

export async function updatePatentApplication(
  applicationId: string,
  updates: Partial<PatentApplication>
): Promise<void> {
  // Filter to only columns that exist in the DB table
  const safeUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const [key, value] of Object.entries(updates)) {
    if (VALID_PATENT_COLUMNS.has(key)) {
      safeUpdates[key] = value;
    }
  }

  const { error } = await (supabase as any)
    .from('patent_applications')
    .update(safeUpdates)
    .eq('id', applicationId);

  if (error) throw error;
}

export async function deletePatentApplication(applicationId: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('patent_applications')
    .delete()
    .eq('id', applicationId);

  if (error) throw error;
}

export async function createPatentClaim(
  applicationId: string,
  claim: Omit<PatentClaim, 'id' | 'application_id' | 'created_at' | 'updated_at'>
): Promise<PatentClaim> {
  const { data, error } = await (supabase as any)
    .from('patent_claims')
    .insert([{
      application_id: applicationId,
      ...claim
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updatePatentClaim(
  claimId: string,
  updates: Partial<PatentClaim>
): Promise<void> {
  const { error } = await (supabase as any)
    .from('patent_claims')
    .update(updates)
    .eq('id', claimId);

  if (error) throw error;
}

export async function deletePatentClaim(claimId: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('patent_claims')
    .delete()
    .eq('id', claimId);

  if (error) throw error;
}

export async function createPatentDrawing(
  applicationId: string,
  drawing: Omit<PatentDrawing, 'id' | 'application_id' | 'created_at' | 'updated_at'>
): Promise<PatentDrawing> {
  const { data, error } = await (supabase as any)
    .from('patent_drawings')
    .upsert([{
      application_id: applicationId,
      ...drawing
    }], { onConflict: 'application_id,figure_number' })
    .select()
    .single();

  if (error) {
    // Fallback to plain insert if upsert fails (e.g., no unique constraint on those columns)
    const { data: fallbackData, error: fallbackError } = await (supabase as any)
      .from('patent_drawings')
      .insert([{
        application_id: applicationId,
        ...drawing
      }])
      .select()
      .single();

    if (fallbackError) {
      throw new Error(`Failed to create patent drawing: ${fallbackError.message} (Code: ${fallbackError.code})`);
    }
    return fallbackData;
  }

  return data;
}

export async function updatePatentDrawing(
  drawingId: string,
  updates: Partial<PatentDrawing>
): Promise<void> {
  const { error } = await (supabase as any)
    .from('patent_drawings')
    .update(updates)
    .eq('id', drawingId);

  if (error) throw error;
}

export async function deletePatentDrawing(drawingId: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('patent_drawings')
    .delete()
    .eq('id', drawingId);

  if (error) throw error;
}

export async function deleteAllDrawingsForApplication(applicationId: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('patent_drawings')
    .delete()
    .eq('application_id', applicationId);

  if (error) {
    throw new Error(`Failed to delete existing drawings: ${error.message}`);
  }
}

export function generateDefaultSpecification(): string {
  return `FIELD OF THE INVENTION

[To be completed. Describe the technical field and general area of the invention.]

BACKGROUND OF THE INVENTION

[To be completed. Describe existing solutions, their limitations, and the problems they fail to solve.]

SUMMARY OF THE INVENTION

[To be completed. Provide a concise overview of the invention and its key innovative aspects.]

DETAILED DESCRIPTION OF THE INVENTION

[To be completed. Provide comprehensive technical details, system architecture, embodiments, and operational descriptions. Reference patent drawings as appropriate.]

CLAIMS

[See Claims tab to generate and manage patent claims]

ABSTRACT

[See Abstract tab to generate the patent abstract]`;
}

export function generateDefaultAbstract(): string {
  return `[Abstract to be generated. Should concisely describe the invention in 92-150 words, including the technical problem, solution, and key advantages.]`;
}

export function countWords(text: string): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

export function validateAbstract(abstract: string): { valid: boolean; wordCount: number; message: string } {
  const wordCount = countWords(abstract);
  if (wordCount === 0) {
    return { valid: false, wordCount, message: 'Abstract is required' };
  }
  if (wordCount > 150) {
    return { valid: false, wordCount, message: `Abstract exceeds 150 word limit (${wordCount} words)` };
  }
  if (wordCount < 50) {
    return { valid: false, wordCount, message: `Abstract is too short — USPTO requires a complete summary (min ~50 words)` };
  }
  return { valid: true, wordCount, message: `${wordCount}/150 words` };
}

export function getFilingTypeLabel(type: PatentApplication['filing_type']): string {
  const labels: Record<string, string> = {
    provisional: 'Provisional Application',
    non_provisional: 'Non-Provisional Application',
    continuation: 'Continuation Application',
    cip: 'Continuation-in-Part (CIP)',
    divisional: 'Divisional Application'
  };
  return labels[type] || type;
}

export function getStatusLabel(status: PatentApplication['status']): string {
  const labels: Record<string, string> = {
    draft: 'Draft',
    in_review: 'In Review',
    ready_to_file: 'Ready to File',
    filed: 'Filed',
    pending: 'Pending at USPTO',
    granted: 'Granted',
    rejected: 'Rejected',
    abandoned: 'Abandoned'
  };
  return labels[status] || status;
}

export function getStatusColor(status: PatentApplication['status']): string {
  const colors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-800',
    in_review: 'bg-yellow-100 text-yellow-800',
    ready_to_file: 'bg-blue-100 text-blue-800',
    filed: 'bg-indigo-100 text-indigo-800',
    pending: 'bg-orange-100 text-orange-800',
    granted: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    abandoned: 'bg-gray-200 text-gray-600'
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}
