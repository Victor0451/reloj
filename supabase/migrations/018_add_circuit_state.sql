-- Migration: Add circuit_state column to devices table
-- This column tracks the circuit breaker state per device:
-- 'closed' = normal operation, device reachable
-- 'open' = device unreachable, probing at reduced frequency
-- 'half_open' = testing if device recovered

ALTER TABLE devices ADD COLUMN circuit_state TEXT NOT NULL DEFAULT 'closed';

-- Index for efficient queries on circuit_state
CREATE INDEX idx_devices_circuit_state ON devices(circuit_state);

-- Note: Default 'closed' ensures existing devices start in normal operation
-- The agent will update this column as circuit state transitions occur