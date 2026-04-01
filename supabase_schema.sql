-- Database Schema for MoneyFlow - Brayce Edition

-- 1. Categories table
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL CHECK (type IN ('obligation', 'loisir', 'savings', 'income')),
    icon TEXT,
    color TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Transactions table
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    category_id UUID REFERENCES public.categories(id),
    description TEXT NOT NULL,
    amount NUMERIC NOT NULL, -- Keep as numeric, can be rounded in UI for FCFA
    type TEXT NOT NULL CHECK (type IN ('expense', 'income')),
    date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Recurring Obligations (Fixed charges, Tontines)
CREATE TABLE IF NOT EXISTS public.recurring_obligations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    name TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    day_of_month INTEGER CHECK (day_of_month BETWEEN 1 AND 31),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. User Profiles (Settings)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    monthly_savings_goal NUMERIC DEFAULT 0,
    full_name TEXT,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Budgets table (Spending limits per category)
CREATE TABLE IF NOT EXISTS public.budgets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    category_id UUID REFERENCES public.categories(id) NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, category_id, month, year)
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can manage their own profile" ON public.profiles FOR ALL TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can manage their own budgets" ON public.budgets FOR ALL TO authenticated USING (auth.uid() = user_id);

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (new.id, new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. Insert default categories
INSERT INTO public.categories (name, type, icon) VALUES
('Loyer', 'obligation', 'home'),
('Electricité', 'obligation', 'zap'),
('Tontine', 'obligation', 'users'),
('Internet', 'obligation', 'globe'),
('Ration', 'obligation', 'shopping-cart'),
('Eau', 'obligation', 'droplets'),
('Dette', 'income', 'hand-coins'),
('Remboursement dette', 'obligation', 'credit-card'),
('Restaurant', 'loisir', 'utensils'),
('Sport', 'loisir', 'dumbbell'),
('Shopping', 'loisir', 'shopping-bag'),
('Salaire', 'income', 'briefcase'),
('Freelance', 'income', 'laptop'),
('Achats divers', 'loisir', 'shopping-cart'),
('Epargne Projet', 'savings', 'target'),
('Achats produits', 'loisir', 'package'),
('Frais de livraison', 'obligation', 'truck')
ON CONFLICT (name) DO NOTHING;
