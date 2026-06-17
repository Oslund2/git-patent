import type { Context } from "@netlify/functions";

export default async function handler(req: Request, _context: Context) {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Netlify.env.get("VITE_SUPABASE_URL");
  const serviceKey = Netlify.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: "Supabase not configured" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: { applicationId?: string; updates?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { applicationId, updates } = body;
  if (!applicationId || !updates || typeof updates !== "object") {
    return new Response(JSON.stringify({ error: "Missing applicationId or updates" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const payload = { ...updates, updated_at: new Date().toISOString() };

  const pgResp = await fetch(
    `${supabaseUrl}/rest/v1/patent_applications?id=eq.${encodeURIComponent(applicationId)}`,
    {
      method: "PATCH",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(payload),
    }
  );

  if (!pgResp.ok) {
    const errorText = await pgResp.text().catch(() => "");
    console.error("[pipeline-write] PostgREST error:", pgResp.status, errorText);
    return new Response(
      JSON.stringify({ error: `DB error ${pgResp.status}`, detail: errorText }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
