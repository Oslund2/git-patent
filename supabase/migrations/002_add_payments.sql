-- Payment tracking for Stripe integration
-- Adds payment_status to projects and a payments audit table

-- Add payment status to projects
ALTER TABLE projects
  ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'not_required'
  CHECK (payment_status IN ('not_required', 'pending', 'paid'));

ALTER TABLE projects
  ADD COLUMN stripe_session_id TEXT;

-- Payments audit table — one row per Stripe Checkout Session
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  stripe_session_id TEXT UNIQUE NOT NULL,
  stripe_payment_intent_id TEXT,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'refunded', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- RLS for payments: users can read their own, only service role can insert/update
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payments"
  ON payments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage payments"
  ON payments FOR ALL
  USING (auth.role() = 'service_role');

-- Index for fast lookups
CREATE INDEX idx_payments_project_id ON payments(project_id);
CREATE INDEX idx_payments_stripe_session ON payments(stripe_session_id);
CREATE INDEX idx_projects_payment_status ON projects(payment_status);
