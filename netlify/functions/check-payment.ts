import type { Context } from "@netlify/functions";

const JSON_HEADERS = { "Content-Type": "application/json" };

export default async function handler(req: Request, _context: Context) {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: JSON_HEADERS,
    });
  }

  const internalDomains = (Netlify.env.get("INTERNAL_DOMAINS") || "")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);

  let body: { userEmail: string; projectId?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: JSON_HEADERS,
    });
  }

  if (!body.userEmail) {
    return new Response(
      JSON.stringify({ error: "userEmail is required" }),
      { status: 400, headers: JSON_HEADERS }
    );
  }

  // Check internal status
  const emailDomain = body.userEmail.split("@")[1]?.toLowerCase() || "";
  const isInternal = internalDomains.includes(emailDomain);

  // If we have a project ID, check its payment status via Supabase
  let isPaid = false;
  if (body.projectId) {
    const supabaseUrl = Netlify.env.get("VITE_SUPABASE_URL") || Netlify.env.get("SUPABASE_URL");
    const supabaseServiceKey = Netlify.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (supabaseUrl && supabaseServiceKey) {
      try {
        const { createClient } = await import("@supabase/supabase-js");
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const { data } = await supabase
          .from("projects")
          .select("payment_status")
          .eq("id", body.projectId)
          .single();
        isPaid = data?.payment_status === "paid" || data?.payment_status === "not_required";
      } catch (err) {
        console.error("Failed to check project payment status:", err);
      }
    }
  }

  return new Response(
    JSON.stringify({
      isInternal,
      isPaid,
      requiresPayment: !isInternal && !isPaid,
    }),
    { status: 200, headers: JSON_HEADERS }
  );
}
