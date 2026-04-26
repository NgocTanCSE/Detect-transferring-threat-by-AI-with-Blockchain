-- Fix diagnostic_events and notification_events seeding
-- These tables use BigInteger IDs, not UUIDs

-- DIAGNOSTIC EVENTS (250 events)
DO $$
DECLARE
  i INTEGER;
  types TEXT[] := ARRAY['INFO', 'ERROR', 'WARNING', 'SUCCESS', 'DEBUG'];
  sources TEXT[] := ARRAY['api', 'scanner', 'backend'];
  msgs TEXT[] := ARRAY[
    'User login successful',
    'Timeout while contacting inference service',
    'Block scan completed',
    'Unauthorized policy update attempt',
    'New suspicious transaction flagged',
    'Node endpoint check status: healthy',
    'Database connection pool exhausted',
    'Broadcasted alerts to active analysts',
    'Ingested raw block data',
    'Model promoted to production'
  ];
BEGIN
  FOR i IN 1..250 LOOP
    INSERT INTO diagnostic_events (log_type, message, details, status_code, endpoint, source, is_archived, timestamp)
    VALUES (
      types[1 + (i % array_length(types, 1))],
      msgs[1 + (i % array_length(msgs, 1))],
      jsonb_build_object('source', sources[1 + (i % array_length(sources, 1))], 'index', i),
      CASE WHEN i % 5 = 1 THEN 500 ELSE 200 END,
      '/api/v1/endpoint/' || i,
      sources[1 + (i % array_length(sources, 1))],
      i % 25 = 0,
      NOW() - i * interval '3 minutes'
    );
  END LOOP;
END $$;

-- NOTIFICATION EVENTS (200 notifications)
DO $$
DECLARE
  i INTEGER;
  channels TEXT[] := ARRAY['email', 'slack', 'webhook', 'sms'];
  severities TEXT[] := ARRAY['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  statuses TEXT[] := ARRAY['queued', 'sent', 'delivered', 'failed'];
BEGIN
  FOR i IN 1..200 LOOP
    INSERT INTO notification_events (channel, recipient, severity, message, status, created_at)
    VALUES (
      channels[1 + (i % array_length(channels, 1))],
      'analyst_' || (i % 20) || '@security.local',
      severities[1 + (i % array_length(severities, 1))],
      'Alert notification #' || i || ' - Risk level elevated',
      statuses[1 + (i % array_length(statuses, 1))],
      NOW() - i * interval '5 minutes'
    );
  END LOOP;
END $$;

VACUUM ANALYZE;
