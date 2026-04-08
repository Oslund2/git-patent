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
  const webhookSecret = Netlify.env.get("STRIPE_WEBHOOK_SECRET");
  const supabaseUrl = Netlify.env.get("VITE_SUPABASE_URL") || Netlify.env.get("SUPABASE_URL");
  const supabaseServiceKey = Netlify.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!stripeKey || !webhookSecret || !supabaseUrl || !supabaseServiceKey) {
    console.error("Missing env vars for stripe-webhook");
    return new Response(
      JSON.stringify({ error: "Server misconfigured" }),
      { status: 503, headers: JSON_HEADERS }
    );
  }

  const stripe = new Stripe(stripeKey);
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Verify webhook signature
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response(JSON.stringify({ error: "Missing stripe-signature header" }), {
      status: 400,
      headers: JSON_HEADERS,
    });
  }

  let event: Stripe.Event;
  try {
    const rawBody = await req.text();
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    return new Response(
      JSON.stringify({ error: "Invalid signature" }),
      { status: 400, headers: JSON_HEADERS }
    );
  }

  // Handle checkout.session.completed
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const projectId = session.metadata?.project_id;
    const userId = session.metadata?.user_id;

    if (!projectId || !userId) {
      console.error("Webhook missing project_id or user_id in metadata:", session.id);
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: JSON_HEADERS,
      });
    }

    console.log(`Payment completed: session=${session.id} project=${projectId} user=${userId}`);

    // Insert payment record (idempotent via unique constraint on stripe_session_id)
    const { error: paymentError } = await supabase.from("payments").upsert(
      {
        user_id: userId,
        project_id: projectId,
        stripe_session_id: session.id,
        stripe_payment_intent_id:
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id || null,
        amount_cents: session.amount_total || 0,
        currency: session.currency || "usd",
        status: "completed",
        completed_at: new Date().toISOString(),
      },
      { onConflict: "stripe_session_id" }
    );

    if (paymentError) {
      console.error("Failed to insert payment record:", paymentError);
    }

    // Mark project as paid
    const { error: projectError } = await supabase
      .from("projects")
      .update({
        payment_status: "paid",
        stripe_session_id: session.id,
      })
      .eq("id", projectId);

    if (projectError) {
      console.error("Failed to update project payment_status:", projectError);
    }
  }

  // Handle refunds
  if (event.type === "charge.refunded") {
    const charge = event.data.object as Stripe.Charge;
    const paymentIntentId =
      typeof charge.payment_intent === "string"
        ? charge.payment_intent
        : charge.payment_intent?.id;

    if (paymentIntentId) {
      const { error } = await supabase
        .from("payments")
        .update({ status: "refunded" })
        .eq("stripe_payment_intent_id", paymentIntentId);

      if (error) {
        console.error("Failed to update payment refund status:", error);
      }
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: JSON_HEADERS,
  });
}
