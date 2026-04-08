import type { Context } from "@netlify/functions";
import Stripe from "stripe";

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

  let body: { projectId: string; projectName: string; userEmail: string; userId: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: JSON_HEADERS,
    });
  }

  if (!body.projectId || !body.userEmail || !body.userId) {
    return new Response(
      JSON.stringify({ error: "projectId, userEmail, and userId are required" }),
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
    const stripe = new Stripe(stripeKey);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: body.userEmail,
      metadata: {
        project_id: body.projectId,
        user_id: body.userId,
        project_name: body.projectName || "",
      },
      success_url: `${siteUrl}?payment=success&session_id={CHECKOUT_SESSION_ID}&project_id=${body.projectId}`,
      cancel_url: `${siteUrl}?payment=cancelled&project_id=${body.projectId}`,
    });

    return new Response(
      JSON.stringify({ url: session.url, sessionId: session.id }),
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
