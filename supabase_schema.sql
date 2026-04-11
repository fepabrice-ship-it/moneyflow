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

-- 2. Projects table
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    owner_id UUID REFERENCES auth.users(id) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Project Members table
CREATE TABLE IF NOT EXISTS public.project_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'member')),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(project_id, user_id)
);

-- 4. Transactions table
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id),
    project_id UUID REFERENCES public.projects(id) NOT NULL,
    category_id UUID REFERENCES public.categories(id),
    description TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('expense', 'income')),
    date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Recurring Obligations
CREATE TABLE IF NOT EXISTS public.recurring_obligations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id),
    project_id UUID REFERENCES public.projects(id) NOT NULL,
    name TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    day_of_month INTEGER CHECK (day_of_month BETWEEN 1 AND 31),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. User Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    monthly_savings_goal NUMERIC DEFAULT 0,
    full_name TEXT,
    avatar_url TEXT,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Budgets table
CREATE TABLE IF NOT EXISTS public.budgets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES public.projects(id) NOT NULL,
    user_id UUID REFERENCES public.profiles(id) NOT NULL,
    category_id UUID REFERENCES public.categories(id) NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(project_id, category_id, month, year)
);

-- 8. Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_obligations ENABLE ROW LEVEL SECURITY;

-- 9. Helper function to check membership (Breaks RLS recursion)
CREATE OR REPLACE FUNCTION public.is_project_member(p_id UUID, u_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.project_members
        WHERE project_id = p_id AND user_id = u_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Policies
CREATE POLICY "Users can manage their own profile" ON public.profiles FOR ALL TO authenticated USING (auth.uid() = id);

-- Projects
CREATE POLICY "Users can view projects they are members of" ON public.projects
FOR SELECT TO authenticated
USING (public.is_project_member(id, auth.uid()));

CREATE POLICY "Owners can manage their projects" ON public.projects
FOR ALL TO authenticated
USING (owner_id = auth.uid());

-- Project Members
CREATE POLICY "Members can view members of their projects" ON public.project_members
FOR SELECT TO authenticated
USING (public.is_project_member(project_id, auth.uid()));

CREATE POLICY "Owners can manage members" ON public.project_members
FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.projects
        WHERE id = project_id AND owner_id = auth.uid()
    )
);

-- Project Data (Transactions, Budgets, Recurring)
CREATE POLICY "Members can manage project transactions" ON public.transactions
FOR ALL TO authenticated
USING (public.is_project_member(project_id, auth.uid()));

CREATE POLICY "Members can manage project budgets" ON public.budgets
FOR ALL TO authenticated
USING (public.is_project_member(project_id, auth.uid()));

CREATE POLICY "Members can manage project obligations" ON public.recurring_obligations
FOR ALL TO authenticated
USING (public.is_project_member(project_id, auth.uid()));

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
('Frais de livraison', 'obligation', 'truck'),
('Investissement', 'savings', 'trending-up'),
('Vente', 'income', 'tag'),
('Dedommagement', 'income', 'shield-check')
ON CONFLICT (name) DO NOTHING;
