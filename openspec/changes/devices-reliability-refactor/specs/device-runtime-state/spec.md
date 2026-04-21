# Device Runtime State Specification

## Purpose
Definir el estado operativo y de sincronización visible en tiempo real para `/devices`.

## Requirements

### Requirement: Unified runtime state
The system MUST expose a single client-safe runtime state for each device covering connectivity, sync health, last contact and actionable errors.

#### Scenario: Realtime status update
- GIVEN a device already registered in the system
- WHEN the Agent Bridge updates heartbeat or sync fields in the database
- THEN `/devices` MUST reflect the new runtime state through Realtime without a full page reload
- AND the UI MUST preserve a stable device identity while updating visible status fields

#### Scenario: Degraded but managed device
- GIVEN a registered device that is currently offline or failing sync
- WHEN the Agent Bridge starts or restarts
- THEN the device MUST remain manageable by the runtime pipeline
- AND the UI MUST show degraded state and latest actionable error

### Requirement: Consistent health-check semantics
The system SHALL use one canonical connectivity strategy for enrollment checks, manual refreshes and scheduled health verification.

#### Scenario: Manual refresh
- GIVEN a registered device visible in `/devices`
- WHEN the user requests a refresh or connectivity check
- THEN the system MUST execute the canonical connectivity workflow
- AND MUST update the persisted runtime state used by the UI and the agent
