-- Fix access_events RLS: allow anon key (service role connections) to read events
-- The agent bridge uses service role key, frontend uses anon key
-- Both should be able to read events for display purposes

DROP POLICY IF EXISTS "Authenticated users can view events" ON access_events;

-- Allow all authenticated users to read events
CREATE POLICY "Authenticated users can view access events" ON access_events
  FOR SELECT USING (auth.role() = 'authenticated');

-- Allow anon connections (service role) to read events for dashboard
CREATE POLICY "Service role can view access events" ON access_events
  FOR SELECT USING (true);

-- Keep insert policy as is (service role only)
-- Already exists: CREATE POLICY "System can insert events" ON access_events FOR INSERT WITH CHECK (true);