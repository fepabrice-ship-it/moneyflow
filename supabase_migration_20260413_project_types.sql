-- Migration: Add Project Types and Transaction Flags
-- Date: 2026-04-13

-- 1. Add 'type' to projects
-- Default is 'standard' for existing projects
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'standard' CHECK (type IN ('standard', 'continuous', 'investment'));

-- 2. Add 'exclude_from_global' to transactions
-- Default is false
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS exclude_from_global BOOLEAN DEFAULT false;

-- 3. Update RLS policies to ensure 'type' and 'exclude_from_global' are handled correctly
-- Usually RLS is based on project_id so no major change needed, 
-- but we make sure the schema is refreshed for PostgREST.

COMMENT ON COLUMN public.projects.type IS 'Type of accounting logic: standard, continuous (ledger), or investment.';
COMMENT ON COLUMN public.transactions.exclude_from_global IS 'If true, this transaction is ignored in life-time/global balance calculations.';
