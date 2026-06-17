/**
 * Routes patent_applications UPDATE calls through a service-role Netlify function,
 * bypassing the client-side Supabase session entirely.
 */
export async function pipelineUpdate(
  applicationId: string,
  updates: Record<string, unknown>
): Promise<void> {
  if (!applicationId) {
    console.error("[pipelineUpdate] called with empty applicationId");
    return;
  }
  try {
    const resp = await fetch("/.netlify/functions/pipeline-write", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applicationId, updates }),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({})) as Record<string, unknown>;
      console.error("[pipelineUpdate] HTTP error:", resp.status, err.error, err.detail ?? "");
    }
  } catch (e) {
    console.error("[pipelineUpdate] fetch error:", e instanceof Error ? e.message : e);
  }
}
