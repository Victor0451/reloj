-- Migration: Add RPC functions for sync operations

-- Function to increment sync events count
CREATE OR REPLACE FUNCTION increment_sync_events(device_uuid UUID, count INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE devices 
  SET sync_events_count = COALESCE(sync_events_count, 0) + count
  WHERE id = device_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get device sync summary
CREATE OR REPLACE FUNCTION get_device_sync_summary(device_uuid UUID)
RETURNS TABLE (
  total_syncs BIGINT,
  successful_syncs BIGINT,
  failed_syncs BIGINT,
  total_events_processed BIGINT,
  last_error TEXT,
  avg_duration_ms NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_syncs,
    COUNT(*) FILTER (WHERE status = 'success')::BIGINT as successful_syncs,
    COUNT(*) FILTER (WHERE status = 'error')::BIGINT as failed_syncs,
    COALESCE(SUM(events_processed), 0)::BIGINT as total_events_processed,
    (
      SELECT error_message 
      FROM sync_logs 
      WHERE device_id = device_uuid AND status = 'error'
      ORDER BY created_at DESC
      LIMIT 1
    ) as last_error,
    AVG(duration_ms) as avg_duration_ms
  FROM sync_logs
  WHERE device_id = device_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
