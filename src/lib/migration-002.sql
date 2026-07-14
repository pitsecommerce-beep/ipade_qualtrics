-- ============================================================
-- Migration 002: Allow survey owners to delete responses
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Survey owners can delete responses for their surveys
CREATE POLICY "Survey owners can delete responses" ON survey_responses
  FOR DELETE USING (
    survey_id IN (
      SELECT id FROM surveys WHERE owner_id = auth.uid()
    )
  );
