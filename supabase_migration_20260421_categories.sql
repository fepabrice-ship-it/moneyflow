-- Migration: Add new categories for simplified accounting
INSERT INTO public.categories (name, type, icon, color) VALUES
('Expéditions', 'loisir', 'truck', '#f59e0b'),
('Capital', 'income', 'landmark', '#10b981')
ON CONFLICT (name) DO NOTHING;

-- Ensure Salaire has a generic icon if missing or update
UPDATE public.categories SET icon = 'briefcase' WHERE name = 'Salaire' AND icon IS NULL;
