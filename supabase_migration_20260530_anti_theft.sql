-- MoneyFlow — Anti-vol & traçabilité
-- À exécuter dans l'éditeur SQL de Supabase.

-- ============================================================================
-- 1. Comptage physique de stock (stock_audits + stock_audit_entries)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.stock_audits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    performed_by UUID REFERENCES public.profiles(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stock_audit_entries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    audit_id UUID REFERENCES public.stock_audits(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    city TEXT,
    theoretical_qty NUMERIC NOT NULL DEFAULT 0,
    counted_qty NUMERIC NOT NULL DEFAULT 0,
    -- variance positive = surplus, négative = perte (potentiellement vol)
    variance NUMERIC GENERATED ALWAYS AS (counted_qty - theoretical_qty) STORED
);

CREATE INDEX IF NOT EXISTS idx_stock_audits_project ON public.stock_audits(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_audit_entries_audit ON public.stock_audit_entries(audit_id);

ALTER TABLE public.stock_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_audit_entries ENABLE ROW LEVEL SECURITY;

-- Lecture : tout membre du projet peut consulter (transparence)
CREATE POLICY "Members view stock audits" ON public.stock_audits
FOR SELECT TO authenticated
USING (public.is_project_member(project_id, auth.uid()));

-- Écriture : owner seulement
CREATE POLICY "Owners manage stock audits" ON public.stock_audits
FOR ALL TO authenticated
USING (EXISTS (
    SELECT 1 FROM public.projects WHERE id = project_id AND owner_id = auth.uid()
));

CREATE POLICY "Members view audit entries" ON public.stock_audit_entries
FOR SELECT TO authenticated
USING (EXISTS (
    SELECT 1 FROM public.stock_audits sa
    WHERE sa.id = audit_id AND public.is_project_member(sa.project_id, auth.uid())
));

CREATE POLICY "Owners manage audit entries" ON public.stock_audit_entries
FOR ALL TO authenticated
USING (EXISTS (
    SELECT 1 FROM public.stock_audits sa
    JOIN public.projects p ON p.id = sa.project_id
    WHERE sa.id = audit_id AND p.owner_id = auth.uid()
));

-- ============================================================================
-- 2. Journal d'activité (owner-only en lecture, tout membre en écriture)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.activity_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id),
    action TEXT NOT NULL CHECK (action IN ('insert', 'update', 'delete')),
    entity_type TEXT NOT NULL, -- 'transaction', 'product', etc.
    entity_id UUID,
    summary TEXT,              -- libellé court lisible pour l'affichage
    before JSONB,              -- état avant (update/delete)
    after JSONB,               -- état après (insert/update)
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_project ON public.activity_log(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_user ON public.activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_entity ON public.activity_log(entity_type, entity_id);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- Lecture : owner seulement (outil d'investigation, pas de transparence)
CREATE POLICY "Owner reads activity log" ON public.activity_log
FOR SELECT TO authenticated
USING (EXISTS (
    SELECT 1 FROM public.projects WHERE id = project_id AND owner_id = auth.uid()
));

-- Écriture : tout membre du projet (logs émis par l'app au moment des actions)
CREATE POLICY "Members insert activity log" ON public.activity_log
FOR INSERT TO authenticated
WITH CHECK (public.is_project_member(project_id, auth.uid()));
