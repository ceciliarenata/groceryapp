-- ============================================================================
-- SMART GROCERY TRACKER - POSTGRESQL & SUPABASE DATABASE SCHEMA
-- File: supabase-schema.sql
-- Kepatuhan: Row Level Security (RLS) & Multi-Tenant Data Isolation
-- ============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create Users Profile Table (Linked to Supabase Auth users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- 3. Create Grocery Items Table
CREATE TABLE IF NOT EXISTS public.grocery_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN (
    'Fruits & Vegetables',
    'Meat & Seafood',
    'Dairy & Eggs',
    'Snacks & Beverages',
    'Household',
    'Other'
  )),
  quantity NUMERIC(10, 2) NOT NULL DEFAULT 1.0,
  unit VARCHAR(50) NOT NULL DEFAULT 'pcs',
  price NUMERIC(12, 2) NOT NULL DEFAULT 0.0,
  is_purchased BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on Grocery Items
ALTER TABLE public.grocery_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own grocery items"
  ON public.grocery_items FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own grocery items"
  ON public.grocery_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own grocery items"
  ON public.grocery_items FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own grocery items"
  ON public.grocery_items FOR DELETE
  USING (auth.uid() = user_id);

-- 4. Create Budget Settings Table
CREATE TABLE IF NOT EXISTS public.budget_settings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  budget_limit NUMERIC(12, 2) NOT NULL DEFAULT 500000.0,
  alert_caution_percent INTEGER NOT NULL DEFAULT 75,
  alert_danger_percent INTEGER NOT NULL DEFAULT 90,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on Budget Settings
ALTER TABLE public.budget_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own budget"
  ON public.budget_settings FOR ALL
  USING (auth.uid() = user_id);

-- 5. Create Shopping History Table
CREATE TABLE IF NOT EXISTS public.shopping_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  store_name VARCHAR(255) NOT NULL DEFAULT 'Supermarket',
  total_spent NUMERIC(12, 2) NOT NULL DEFAULT 0.0,
  items_count INTEGER NOT NULL DEFAULT 0,
  items_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  completed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on Shopping History
ALTER TABLE public.shopping_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own shopping history"
  ON public.shopping_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own shopping history"
  ON public.shopping_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 6. Trigger for Updating updated_at Timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_grocery_items_updated_at
  BEFORE UPDATE ON public.grocery_items
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();
