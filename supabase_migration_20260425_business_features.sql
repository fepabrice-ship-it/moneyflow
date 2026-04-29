-- Migration: Business Features (Stock, Debts, Performance)
-- Date: 2026-04-25

-- 1. Create customers table
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create stock_movements table
CREATE TABLE IF NOT EXISTS public.stock_movements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    transaction_id UUID REFERENCES public.transactions(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('in', 'out')),
    quantity NUMERIC NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create daily_closings table
CREATE TABLE IF NOT EXISTS public.daily_closings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    declared_amount NUMERIC NOT NULL,
    theoretical_amount NUMERIC NOT NULL,
    difference NUMERIC NOT NULL,
    date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Update products table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS stock_quantity NUMERIC DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS alert_threshold NUMERIC DEFAULT 5;

-- 5. Update transactions table
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'paid' CHECK (payment_status IN ('paid', 'unpaid'));
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;

-- 6. Enable RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_closings ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies

-- Customers
CREATE POLICY "Members can manage customers of their projects" ON public.customers
FOR ALL TO authenticated
USING (public.is_project_member(project_id, auth.uid()));

-- Stock Movements
CREATE POLICY "Members can view stock movements of their projects" ON public.stock_movements
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.products
        WHERE products.id = stock_movements.product_id
        AND public.is_project_member(products.project_id, auth.uid())
    )
);

CREATE POLICY "Members can manage stock movements of their projects" ON public.stock_movements
FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.products
        WHERE products.id = stock_movements.product_id
        AND public.is_project_member(products.project_id, auth.uid())
    )
);

-- Daily Closings
CREATE POLICY "Members can view daily closings of their projects" ON public.daily_closings
FOR SELECT TO authenticated
USING (public.is_project_member(project_id, auth.uid()));

CREATE POLICY "Members can create daily closings" ON public.daily_closings
FOR INSERT TO authenticated
WITH CHECK (public.is_project_member(project_id, auth.uid()));

-- Helper comments
COMMENT ON TABLE public.customers IS 'Clients for debt tracking and loyalty.';
COMMENT ON TABLE public.stock_movements IS 'History of all stock changes (sales, purchases, losses).';
COMMENT ON TABLE public.daily_closings IS 'Daily cash reconciliation records.';
