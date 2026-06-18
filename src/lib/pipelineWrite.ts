import { supabase } from './supabase';

export async function pipelineUpdate(
  applicationId: string,
  updates: Record<string, unknown>
): Promise<void> {
  if (!applicationId) {
    console.error("[pipelineUpdate] called with empty applicationId");
    return;
  }

  const { data, error } = await (supabase as any)
    .from('patent_applications')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', applicationId)
    .select('id');

  if (error) {
    console.error("[pipelineUpdate] write error:", error.code, error.message, error.details, "appId:", applicationId);
  } else if (!data || data.length === 0) {
    console.warn("[pipelineUpdate] 0 rows updated for appId:", applicationId);
  }
}
