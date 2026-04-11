-- Migration script for Project Collaboration

-- 1. Create Projects table
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    owner_id UUID REFERENCES auth.users(id) NOT NULL
);

-- 2. Create Project Members table
CREATE TABLE IF NOT EXISTS public.project_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'member')),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(project_id, user_id)
);

-- 3. Modify Transactions table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='project_id') THEN
        ALTER TABLE public.transactions ADD COLUMN project_id UUID REFERENCES public.projects(id);
    END IF;
END $$;

-- 4. Modify Budgets table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='budgets' AND column_name='project_id') THEN
        ALTER TABLE public.budgets ADD COLUMN project_id UUID REFERENCES public.projects(id);
    END IF;
END $$;

-- Adjust unique constraint for budgets
DO $$
BEGIN
    -- Drop old user-scoped constraint if it exists
    ALTER TABLE public.budgets DROP CONSTRAINT IF EXISTS budgets_user_id_category_id_month_year_key;
    -- Add project-scoped constraint if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'budgets_project_id_category_id_month_year_key') THEN
        ALTER TABLE public.budgets ADD CONSTRAINT budgets_project_id_category_id_month_year_key UNIQUE(project_id, category_id, month, year);
    END IF;
END $$;

-- 5. Modify Recurring Obligations table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recurring_obligations' AND column_name='project_id') THEN
        ALTER TABLE public.recurring_obligations ADD COLUMN project_id UUID REFERENCES public.projects(id);
    END IF;
END $$;

-- 6. Enable RLS on new tables
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies: Clean and Recursion-Free

-- First, drop ALL existing policies seamlessly to prevent duplicate and conflicting rules
DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'projects' LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.projects', pol.policyname);
    END LOOP;
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'project_members' LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.project_members', pol.policyname);
    END LOOP;
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'transactions' LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.transactions', pol.policyname);
    END LOOP;
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'budgets' LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.budgets', pol.policyname);
    END LOOP;
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'recurring_obligations' LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.recurring_obligations', pol.policyname);
    END LOOP;
END $$;

-- 8. Create a SECURITY DEFINER function to bypass RLS when checking access
-- This prevents the tables from querying each other endlessly
CREATE OR REPLACE FUNCTION public.get_auth_project_ids()
RETURNS SETOF UUID AS $$
    SELECT project_id FROM public.project_members WHERE user_id = auth.uid()
    UNION
    SELECT id FROM public.projects WHERE owner_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- 9. Create Fresh Policies

-- Projects
CREATE POLICY "projects_access" ON public.projects
FOR SELECT TO authenticated
USING (id IN (SELECT public.get_auth_project_ids()));

CREATE POLICY "projects_owner_all" ON public.projects
FOR ALL TO authenticated
USING (owner_id = auth.uid());

-- Project Members
CREATE POLICY "project_members_select" ON public.project_members
FOR SELECT TO authenticated
USING (project_id IN (SELECT public.get_auth_project_ids()));

CREATE POLICY "project_members_owner_all" ON public.project_members
FOR ALL TO authenticated
USING (project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid()));

-- Transactions
CREATE POLICY "transactions_access" ON public.transactions
FOR ALL TO authenticated
USING (project_id IN (SELECT public.get_auth_project_ids()));

-- Budgets
CREATE POLICY "budgets_access" ON public.budgets
FOR ALL TO authenticated
USING (project_id IN (SELECT public.get_auth_project_ids()));

-- Recurring Obligations
CREATE POLICY "recurring_obligations_access" ON public.recurring_obligations
FOR ALL TO authenticated
USING (project_id IN (SELECT public.get_auth_project_ids()));

-- Note: Transactions and Recurring Obligations also need similar policy updates.
-- I'm assuming those tables also have RLS enabled (though not explicitly shown in previous schema snippet for all).

-- 10. Data Migration: Create a default project for each user and assign their data
DO $$
DECLARE
    u_id UUID;
    p_id UUID;
BEGIN
    FOR u_id IN SELECT id FROM auth.users LOOP
        -- Check if user already has a "Compte Personnel" project (to avoid duplicates on retry)
        SELECT id INTO p_id FROM public.projects WHERE owner_id = u_id AND name = 'Compte Personnel' LIMIT 1;

        IF p_id IS NULL THEN
            -- Create a default "Compte Personnel" project for the user
            INSERT INTO public.projects (name, owner_id)
            VALUES ('Compte Personnel', u_id)
            RETURNING id INTO p_id;

            -- Add the user as the owner in project_members
            INSERT INTO public.project_members (project_id, user_id, role)
            VALUES (p_id, u_id, 'owner');
        END IF;

        -- Assign existing transactions to this project if they don't have one
        UPDATE public.transactions
        SET project_id = p_id
        WHERE user_id = u_id AND project_id IS NULL;

        -- Assign existing budgets to this project if they don't have one
        UPDATE public.budgets
        SET project_id = p_id
        WHERE user_id = u_id AND project_id IS NULL;

        -- Assign existing recurring obligations to this project if they don't have one
        UPDATE public.recurring_obligations
        SET project_id = p_id
        WHERE user_id = u_id AND project_id IS NULL;
    END LOOP;
END $$;

-- 11. Make project_id NOT NULL after migration
DO $$
BEGIN
    ALTER TABLE public.transactions ALTER COLUMN project_id SET NOT NULL;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not set project_id to NOT NULL on transactions - checking if data is missing';
END $$;

DO $$
BEGIN
    ALTER TABLE public.budgets ALTER COLUMN project_id SET NOT NULL;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not set project_id to NOT NULL on budgets';
END $$;

DO $$
BEGIN
    ALTER TABLE public.recurring_obligations ALTER COLUMN project_id SET NOT NULL;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not set project_id to NOT NULL on recurring_obligations';
END $$;

-- 12. RPC Function to get user_id by email (Safe way to find users for invitation)
CREATE OR REPLACE FUNCTION public.get_user_id_by_email(email_input TEXT)
RETURNS UUID AS $$
DECLARE
    found_user_id UUID;
BEGIN
    SELECT id INTO found_user_id FROM auth.users WHERE email = email_input;
    RETURN found_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 13. Fix Foreign Keys for PostgREST joins to Profiles
-- Because we want to join `profiles:user_id(...)` in the frontend, the foreign key MUST point to `public.profiles`.
DO $$
BEGIN
    -- Project Members
    ALTER TABLE public.project_members DROP CONSTRAINT IF EXISTS project_members_user_id_fkey;
    ALTER TABLE public.project_members ADD CONSTRAINT project_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

    -- Transactions
    ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_user_id_fkey;
    ALTER TABLE public.transactions ADD CONSTRAINT transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

    -- Budgets
    ALTER TABLE public.budgets DROP CONSTRAINT IF EXISTS budgets_user_id_fkey;
    ALTER TABLE public.budgets ADD CONSTRAINT budgets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

    -- Recurring Obligations
    ALTER TABLE public.recurring_obligations DROP CONSTRAINT IF EXISTS recurring_obligations_user_id_fkey;
    ALTER TABLE public.recurring_obligations ADD CONSTRAINT recurring_obligations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not recreate foreign keys pointing to public.profiles';
END $$;
