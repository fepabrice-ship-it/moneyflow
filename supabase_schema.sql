-- Database Schema for MoneyFlow - Brayce Edition

-- 1. Categories table
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
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

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_obligations ENABLE ROW LEVEL SECURITY;

-- 5. Policies (Simple: users can see/edit their own data)
CREATE POLICY "Users can see all categories" ON public.categories FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can see their own transactions" ON public.transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own transactions" ON public.transactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own obligations" ON public.recurring_obligations FOR ALL TO authenticated USING (auth.uid() = user_id);

-- 6. Insert default categories
INSERT INTO public.categories (name, type, icon) VALUES
('Loyer', 'obligation', 'home'),
('Electricité', 'obligation', 'zap'),
('Tontine', 'obligation', 'users'),
('Internet', 'obligation', 'globe'),
('Restaurant', 'loisir', 'utensils'),
('Sport', 'loisir', 'dumbbell'),
('Shopping', 'loisir', 'shopping-bag'),
('Salaire', 'income', 'briefcase'),
('Freelance', 'income', 'laptop')
ON CONFLICT DO NOTHING;
