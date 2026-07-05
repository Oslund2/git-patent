import type { Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

/**
 * Poll endpoint for ai-generate-background jobs.
 *
 * GET /.netlify/functions/ai-job-status?jobId=<uuid>
 *   → { status: "pending" }                 (job not finished / not started)
 *   → { status: "done", text, usage, ... }  (result ready)
 *   → { status: "error", error }            (generation failed)
 */
export default async function handler(req: Request, _context: Context) {
  const jobId = new URL(req.url).searchParams.get("jobId");
  if (!jobId) {
    return new Response(JSON.stringify({ error: "jobId required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const store = getStore({ name: "ai-jobs", consistency: "strong" });
  const job = await store.get(jobId, { type: "json" });

  if (!job) {
    // Not written yet — background function is still running (or hasn't started).
    return new Response(JSON.stringify({ status: "pending" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify(job), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
