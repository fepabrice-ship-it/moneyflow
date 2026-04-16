-- Migration: Add Quantity and Town to Transactions, and Publicity Category
-- Date: 2026-04-15

-- 1. Add columns to transactions
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS quantity NUMERIC DEFAULT 1,
ADD COLUMN IF NOT EXISTS town TEXT;

-- 2. Add 'Publicité' category
INSERT INTO public.categories (name, type, icon, color) 
VALUES ('Publicité', 'obligation', 'megaphone', '#ff4757')
ON CONFLICT (name) DO NOTHING;

-- 3. Update existing 'Vente' transactions if needed (optional, user said they will update manually)
-- However, we can set a default quantity of 1 for existing transactions if they are null.
UPDATE public.transactions 
SET quantity = 1 
WHERE quantity IS NULL;

COMMENT ON COLUMN public.transactions.quantity IS 'Quantity of items for sales or other transactions.';
COMMENT ON COLUMN public.transactions.town IS 'City/Town associated with the transaction, especially for sales.';
