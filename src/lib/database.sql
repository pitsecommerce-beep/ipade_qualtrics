-- ============================================================
-- IPADE Survey Platform — Complete Supabase SQL Schema
-- Run this ONCE in the Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- 0. Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. TABLES
-- ============================================================

-- Profiles (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  organization TEXT DEFAULT 'IPADE Business School',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Surveys
CREATE TABLE IF NOT EXISTS surveys (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'Untitled Survey',
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'closed')),
  blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
  flow JSONB NOT NULL DEFAULT '[]'::jsonb,
  settings JSONB NOT NULL DEFAULT '{
    "collectIp": true,
    "collectGeoLocation": false,
    "allowMultipleResponses": false,
    "showProgressBar": true,
    "showQuestionNumbers": true,
    "requireAllQuestions": false,
    "thankYouMessage": "¡Gracias por completar la encuesta!",
    "closedMessage": "Esta encuesta ya no está disponible.",
    "language": "es"
  }'::jsonb,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Survey collaborators
CREATE TABLE IF NOT EXISTS survey_collaborators (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  survey_id UUID REFERENCES surveys(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('viewer', 'editor', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(survey_id, user_id)
);

-- Survey responses
CREATE TABLE IF NOT EXISTS survey_responses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  survey_id UUID REFERENCES surveys(id) ON DELETE CASCADE NOT NULL,
  respondent_ip TEXT,
  user_agent TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  embedded_data JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  is_complete BOOLEAN DEFAULT FALSE
);

-- Survey distributions
CREATE TABLE IF NOT EXISTS survey_distributions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  survey_id UUID REFERENCES surveys(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('anonymous_link', 'email', 'qr_code', 'embed')),
  name TEXT NOT NULL,
  link TEXT,
  config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_surveys_owner ON surveys(owner_id);
CREATE INDEX IF NOT EXISTS idx_surveys_status ON surveys(status);
CREATE INDEX IF NOT EXISTS idx_responses_survey ON survey_responses(survey_id);
CREATE INDEX IF NOT EXISTS idx_responses_completed ON survey_responses(is_complete);
CREATE INDEX IF NOT EXISTS idx_collaborators_user ON survey_collaborators(user_id);
CREATE INDEX IF NOT EXISTS idx_collaborators_survey ON survey_collaborators(survey_id);

-- ============================================================
-- 3. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_distributions ENABLE ROW LEVEL SECURITY;

-- ---------- profiles ----------

CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- ---------- surveys ----------

-- Authenticated users see their own + collaborated surveys.
-- Anonymous users (respondents) can read active surveys to answer them.
CREATE POLICY "Users can view own surveys" ON surveys
  FOR SELECT USING (
    owner_id = auth.uid() OR
    id IN (SELECT survey_id FROM survey_collaborators WHERE user_id = auth.uid())
  );

CREATE POLICY "Anyone can view active surveys" ON surveys
  FOR SELECT USING (status = 'active');

CREATE POLICY "Users can create surveys" ON surveys
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update own surveys" ON surveys
  FOR UPDATE USING (
    owner_id = auth.uid() OR
    id IN (SELECT survey_id FROM survey_collaborators WHERE user_id = auth.uid() AND role IN ('editor', 'admin'))
  );

CREATE POLICY "Users can delete own surveys" ON surveys
  FOR DELETE USING (owner_id = auth.uid());

-- ---------- survey_collaborators ----------

CREATE POLICY "Survey owners can manage collaborators" ON survey_collaborators
  FOR ALL USING (
    survey_id IN (SELECT id FROM surveys WHERE owner_id = auth.uid())
  );

CREATE POLICY "Collaborators can view their collaborations" ON survey_collaborators
  FOR SELECT USING (user_id = auth.uid());

-- ---------- survey_responses ----------

-- Anyone (including anonymous/unauthenticated) can insert a response
CREATE POLICY "Anyone can submit responses" ON survey_responses
  FOR INSERT WITH CHECK (true);

-- Anyone can update a response (needed for setting IP and submitting answers)
CREATE POLICY "Anyone can update responses" ON survey_responses
  FOR UPDATE USING (true);

-- Survey owners and collaborators can read responses
CREATE POLICY "Survey owners can view responses" ON survey_responses
  FOR SELECT USING (
    survey_id IN (
      SELECT id FROM surveys WHERE owner_id = auth.uid()
      UNION
      SELECT survey_id FROM survey_collaborators WHERE user_id = auth.uid()
    )
  );

-- ---------- survey_distributions ----------

CREATE POLICY "Survey owners can manage distributions" ON survey_distributions
  FOR ALL USING (
    survey_id IN (
      SELECT id FROM surveys WHERE owner_id = auth.uid()
      UNION
      SELECT survey_id FROM survey_collaborators WHERE user_id = auth.uid() AND role IN ('editor', 'admin')
    )
  );

-- ============================================================
-- 4. FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-create a profile row when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at on row modification
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS surveys_updated_at ON surveys;
CREATE TRIGGER surveys_updated_at
  BEFORE UPDATE ON surveys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
