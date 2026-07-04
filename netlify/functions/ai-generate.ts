import type { Context } from "@netlify/functions";

// Netlify synchronous functions are hard-capped at 26s. Any Claude call that
// needs to GENERATE more than ~2.5k tokens cannot finish in time on Opus/Sonnet
// (Opus/Sonnet generate ~40-50 tok/s → 4k tokens ≈ 90s), so those calls 502.
// Model tiers by speed:
//   CLAUDE_MODEL  (Opus 4.8) — highest reasoning, only safe for SMALL outputs.
//   FAST_MODEL    (Sonnet 4.6) — mid; only safe for small per-section outputs.
//   FASTEST_MODEL (Haiku 4.5) — ~5-10x faster; the only tier that fits large
//                 outputs (extraction/analysis, claims, novelty) inside 26s.
const CLAUDE_MODEL = Netlify.env.get("ANTHROPIC_MODEL") || "claude-opus-4-8";
const FAST_MODEL = Netlify.env.get("ANTHROPIC_MODEL_FAST") || "claude-sonnet-4-6";
const FASTEST_MODEL = Netlify.env.get("ANTHROPIC_MODEL_FASTEST") || "claude-haiku-4-5";
const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";

// High-volume / large-output features that MUST use the fastest model to fit the
// 26s Netlify budget. Extraction/analysis quality is fine on Haiku.
const FASTEST_MODEL_FEATURES = new Set([
  "codebase_analysis",
  "patent_feature_extraction",
  "feature_synthesis",
]);

// Feature areas that use the fast model (latency-sensitive, prose output)
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

interface GenerateRequest {
  prompt: string;
  featureArea?: string;
  maxTokens?: number;
  temperature?: number;
}

export default async function handler(req: Request, _context: Context) {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = Netlify.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  let body: GenerateRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!body.prompt) {
    return new Response(JSON.stringify({ error: "prompt is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const featureArea = body.featureArea || "default";
  const maxTokens =
    body.maxTokens || FEATURE_TOKEN_LIMITS[featureArea] || 2048;
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
        // `temperature` is deprecated/rejected by newer models (e.g. Claude
        // Opus 4.8); only include it when supported. We retry without it below.
        ...(includeTemperature ? { temperature } : {}),
        messages: [{ role: "user", content: body.prompt }],
      }),
      // Use the full Netlify budget (sync cap is 26s) minus ~1s of overhead.
      signal: AbortSignal.timeout(25000),
    });

  try {
    let response = await send(true);

    // Newer models reject `temperature` with a 400. Detect that specific case
    // and retry once without it, so a model swap can't break the whole pipeline.
    if (response.status === 400) {
      const errText = await response.text();
      if (/temperature/i.test(errText)) {
        response = await send(false);
      } else {
        return new Response(
          JSON.stringify({ error: "Claude API error (400)", detail: errText.substring(0, 500) }),
          { status: 502, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    if (!response.ok) {
      const errorBody = await response.text();
      const status =
        response.status === 429
          ? 429
          : response.status === 401
            ? 401
            : 502;
      return new Response(
        JSON.stringify({
          error:
            status === 429
              ? "Rate limit exceeded"
              : status === 401
                ? "Invalid API key"
                : `Claude API error (${response.status})`,
          detail: errorBody.substring(0, 500),
        }),
        { status, headers: { "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const text = data?.content?.[0]?.text;
    if (!text) {
      return new Response(
        JSON.stringify({ error: "No text generated by Claude" }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        text,
        stopReason: data.stop_reason,
        usage: data.usage,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        error:
          err.name === "TimeoutError"
            ? "Request timed out"
            : "AI generation failed",
        detail: err.message,
      }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
}
