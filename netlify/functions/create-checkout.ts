import type { Context } from "@netlify/functions";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const JSON_HEADERS = { "Content-Type": "application/json" };

export default async function handler(req: Request, _context: Context) {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: JSON_HEADERS,
    });
  }

  const stripeKey = Netlify.env.get("STRIPE_SECRET_KEY");
  const priceId = Netlify.env.get("STRIPE_PRICE_ID");
  const siteUrl = Netlify.env.get("URL") || "https://git-patent.netlify.app";
  const supabaseUrl = Netlify.env.get("VITE_SUPABASE_URL") || Netlify.env.get("SUPABASE_URL");
  const supabaseServiceKey = Netlify.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const internalDomains = (Netlify.env.get("INTERNAL_DOMAINS") || "")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);

  if (!stripeKey || !priceId) {
    return new Response(
      JSON.stringify({ error: "Stripe not configured" }),
      { status: 503, headers: JSON_HEADERS }
    );
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({ error: "Database not configured" }),
      { status: 503, headers: JSON_HEADERS }
    );
  }

  let body: { projectId?: string; projectName?: string; userEmail: string; userId: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: JSON_HEADERS,
    });
  }

  if (!body.userEmail || !body.userId) {
    return new Response(
      JSON.stringify({ error: "userEmail and userId are required" }),
      { status: 400, headers: JSON_HEADERS }
    );
  }

  // Check if user is internal (server-side enforcement)
  const emailDomain = body.userEmail.split("@")[1]?.toLowerCase() || "";
  if (internalDomains.includes(emailDomain)) {
    return new Response(
      JSON.stringify({ internal: true, message: "Internal user — no payment required" }),
      { status: 200, headers: JSON_HEADERS }
    );
  }

  try {
    // Create project server-side if not provided
    let projectId = body.projectId;
    if (!projectId) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const { data: project, error: dbError } = await supabase
        .from("projects")
        .insert({
          user_id: body.userId,
          name: body.projectName || "Untitled Project",
          source_type: "github_url",
          payment_status: "pending",
        })
        .select("id")
        .single();

      if (dbError || !project) {
        console.error("Failed to create project:", dbError);
        return new Response(
          JSON.stringify({ error: "Failed to create project record" }),
          { status: 500, headers: JSON_HEADERS }
        );
      }
      projectId = project.id;
    }

    const stripe = new Stripe(stripeKey);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: body.userEmail,
      metadata: {
        project_id: projectId,
        user_id: body.userId,
        project_name: body.projectName || "",
      },
      success_url: `${siteUrl}?payment=success&session_id={CHECKOUT_SESSION_ID}&project_id=${projectId}`,
      cancel_url: `${siteUrl}?payment=cancelled&project_id=${projectId}`,
    });

    return new Response(
      JSON.stringify({ url: session.url, sessionId: session.id, projectId }),
      { status: 200, headers: JSON_HEADERS }
    );
  } catch (err: any) {
    console.error("Stripe checkout creation failed:", err);
    return new Response(
      JSON.stringify({ error: "Failed to create checkout session", detail: err.message }),
      { status: 500, headers: JSON_HEADERS }
    );
  }
}
