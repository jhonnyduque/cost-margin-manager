-- Phase 9: Billing Authority Activation
-- Add Stripe-related columns to companies table

alter table companies
add column if not exists stripe_customer_id text,
add column if not exists stripe_subscription_id text,
add column if not exists stripe_price_id text,
add column if not exists current_period_end timestamptz,
-- Ensure subscription_status exists or update default if needed (it might already exist from previous phases, but good to ensure default)
alter column subscription_status set default 'trialing';

-- Create indexes for lookups by Stripe IDs (important for webhooks)
create index if not exists idx_companies_stripe_customer
on companies(stripe_customer_id);

create index if not exists idx_companies_stripe_subscription
on companies(stripe_subscription_id);
