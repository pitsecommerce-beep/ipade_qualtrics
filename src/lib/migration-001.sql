-- ============================================================
-- Migration 001: Add missing RLS policies for respondents
-- Run this if you already executed the previous database.sql
-- ============================================================

-- 1. Allow anonymous/unauthenticated users to view active surveys
--    (needed for /respond/[id] to load the survey)
CREATE POLICY "Anyone can view active surveys" ON surveys
  FOR SELECT USING (status = 'active');

-- 2. Allow anyone to update their own response row
--    (needed to save IP after insert and to submit answers)
CREATE POLICY "Anyone can update responses" ON survey_responses
  FOR UPDATE USING (true);
