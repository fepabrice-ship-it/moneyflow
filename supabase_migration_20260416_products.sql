-- Migration: Add Products table and link to Transactions
-- Date: 2026-04-16

-- 1. Create products table
CREATE TABLE IF NOT EXISTS public.products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    sku TEXT,
    purchase_price NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Add product_id to transactions
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id) ON DELETE SET NULL;

-- 3. Enable RLS for products
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- 4. Policies for products
CREATE POLICY "Members can view products of their projects" ON public.products
FOR SELECT TO authenticated
USING (public.is_project_member(project_id, auth.uid()));

CREATE POLICY "Members can manage products of their projects" ON public.products
FOR ALL TO authenticated
USING (public.is_project_member(project_id, auth.uid()));

-- 5. Helper comments
COMMENT ON TABLE public.products IS 'Business items/products for inventory and margin tracking.';
COMMENT ON COLUMN public.products.purchase_price IS 'Default cost to purchase one unit of this product.';
COMMENT ON COLUMN public.transactions.product_id IS 'Link transaction to a specific product for business metrics.';
