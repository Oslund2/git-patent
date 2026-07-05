import type { Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

/**
 * Background variant of ai-generate.
 *
 * Netlify SYNCHRONOUS functions are hard-capped at ~26s, which is too short for
 * the heavy patent steps (claims/novelty/prior-art) that generate thousands of
 * tokens on Opus/Sonnet (~40-50 tok/s → 90s+). Background functions get up to
 * 15 minutes, so those calls keep full Opus/Sonnet quality here instead of
 * being downgraded or timing out.
 *
 * Contract: the CLIENT generates a `jobId` and POSTs { jobId, prompt,
 * featureArea, maxTokens, temperature }. Netlify returns 202 immediately (the
 * caller never sees this function's return value). The result is written to the
 * "ai-jobs" Blobs store under `jobId`; the client polls `ai-job-status` for it.
 */

const CLAUDE_MODEL = Netlify.env.get("ANTHROPIC_MODEL") || "claude-opus-4-8";
const FAST_MODEL = Netlify.env.get("ANTHROPIC_MODEL_FAST") || "claude-sonnet-4-6";
const FASTEST_MODEL = Netlify.env.get("ANTHROPIC_MODEL_FASTEST") || "claude-haiku-4-5";
const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";

const FASTEST_MODEL_FEATURES = new Set([
  "codebase_analysis",
  "patent_feature_extraction",
  "feature_synthesis",
]);

const FAST_MODEL_FEATURES = new Set([
  "patent_specification_field",
  "patent_specification_background",
  "patent_specification_summary",
  "patent_specification_detailed",
  "patent_abstract_generation",
  "patent_drawings",
  "patent_drawing_generation",
  "patent_callout_enhancement",
  "patent_differentiation",
  "feature_synthesis",
  "codebase_analysis",
  "patent_feature_extraction",
  "copyright_analysis",
  "trademark_analysis",
]);

const FEATURE_TOKEN_LIMITS: Record<string, number> = {
  patent_specification: 4096,
  patent_specification_field: 600,
  patent_specification_background: 900,
  patent_specification_summary: 700,
  patent_specification_detailed: 900,
  patent_abstract_generation: 400,
  patent_claims: 8192,
  patent_prior_art_search: 8192,
  patent_prior_art_comparison: 4096,
  patent_novelty_analysis: 4096,
  patent_drawings: 4096,
  patent_drawing_generation: 16384,
  patent_callout_enhancement: 2048,
  cpc_classification: 2048,
  codebase_analysis: 4096,
  feature_synthesis: 4096,
  copyright_analysis: 2048,
  trademark_analysis: 2048,
  default: 2048,
};

interface GenerateJob {
  jobId?: string;
  prompt?: string;
  featureArea?: string;
  maxTokens?: number;
  temperature?: number;
}

function jobStore() {
  // Strong consistency so the client's poll reads the result right after write.
  return getStore({ name: "ai-jobs", consistency: "strong" });
}

export default async function handler(req: Request, _context: Context) {
  // Background function: the caller already received 202; the return value is
  // ignored. All outcomes are written to the Blobs job record instead.
  let body: GenerateJob;
  try {
    body = await req.json();
  } catch {
    return;
  }

  const { jobId, prompt } = body;
  if (!jobId) return; // nothing to write results to

  const store = jobStore();

  const apiKey = Netlify.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    await store.setJSON(jobId, { status: "error", error: "ANTHROPIC_API_KEY not configured" });
    return;
  }
  if (!prompt) {
    await store.setJSON(jobId, { status: "error", error: "prompt is required" });
    return;
  }

  const featureArea = body.featureArea || "default";
  const maxTokens = body.maxTokens || FEATURE_TOKEN_LIMITS[featureArea] || 2048;
  const temperature = body.temperature ?? 0.3;
  const model = FASTEST_MODEL_FEATURES.has(featureArea)
    ? FASTEST_MODEL
    : FAST_MODEL_FEATURES.has(featureArea)
      ? FAST_MODEL
      : CLAUDE_MODEL;

  const send = (includeTemperature: boolean) =>
    fetch(ANTHROPIC_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        ...(includeTemperature ? { temperature } : {}),
        messages: [{ role: "user", content: prompt }],
      }),
      // Background functions allow up to 15 min; leave headroom under that.
      signal: AbortSignal.timeout(780000),
    });

  try {
    let response = await send(true);

    if (response.status === 400) {
      const errText = await response.text();
      if (/temperature/i.test(errText)) {
        response = await send(false);
      } else {
        await store.setJSON(jobId, { status: "error", error: `Claude API error (400): ${errText.substring(0, 400)}` });
        return;
      }
    }

    if (!response.ok) {
      const errorBody = await response.text();
      const label =
        response.status === 429
          ? "Rate limit exceeded"
          : response.status === 401
            ? "Invalid API key"
            : `Claude API error (${response.status})`;
      await store.setJSON(jobId, { status: "error", error: `${label}: ${errorBody.substring(0, 400)}` });
      return;
    }

    const data = await response.json();
    const text = data?.content?.[0]?.text;
    if (!text) {
      await store.setJSON(jobId, { status: "error", error: "No text generated by Claude" });
      return;
    }

    await store.setJSON(jobId, {
      status: "done",
      text,
      stopReason: data.stop_reason,
      usage: data.usage,
    });
  } catch (err: any) {
    await store.setJSON(jobId, {
      status: "error",
      error: err?.name === "TimeoutError" ? "Request timed out (background)" : (err?.message || "AI generation failed"),
    });
  }
}
