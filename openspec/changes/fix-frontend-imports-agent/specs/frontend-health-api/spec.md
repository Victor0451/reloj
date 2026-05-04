# Frontend Health API Specification

## Purpose

Exposes a server-side API route that performs device health checks via HikvisionAdapter, preventing sensitive adapter imports in frontend code.

## ADDED Requirements

### Requirement: Device Health API Route

The system SHALL provide a REST API endpoint at `GET /api/devices/[id]/health` that performs health checks on Hikvision devices without exposing credentials or adapter logic to clients.

The system MUST fetch device credentials from the database using a service role/admin client, SHALL perform the health check via HikvisionAdapter, and SHALL return only sanitized status data.

#### Scenario: Successful health check

- GIVEN a device with ID exists in the database with valid Hikvision credentials
- WHEN a GET request is made to `/api/devices/[id]/health`
- THEN the system SHALL fetch credentials from the database using a service role client
- AND SHALL invoke HikvisionAdapter to perform the health check
- AND SHALL return HTTP 200 with `{ status: "online", latency: <ms>, timestamp: <ISO8601> }`
- AND SHALL NOT expose `device_password_encrypted` or adapter internals

#### Scenario: Device not found

- GIVEN no device with the requested ID exists in the database
- WHEN a GET request is made to `/api/devices/[id]/health`
- THEN the system SHALL return HTTP 404 with `{ error: "Device not found" }`

#### Scenario: Health check timeout

- GIVEN a device with ID exists but is unreachable
- WHEN a GET request is made to `/api/devices/[id]/health`
- THEN the system SHALL return HTTP 200 with `{ status: "offline", latency: null, error: "Connection timeout", timestamp: <ISO8601> }`

#### Scenario: Database error during credential fetch

- GIVEN the database is unavailable or query fails
- WHEN a GET request is made to `/api/devices/[id]/health`
- THEN the system SHALL return HTTP 500 with `{ error: "Internal server error" }`

### Requirement: HikvisionAdapter Removed from Frontend

The system SHALL NOT import HikvisionAdapter or any backend-only adapter in frontend client code.

The frontend module `device-connectivity.ts` SHALL call the `/api/devices/[id]/health` endpoint instead of importing HikvisionAdapter directly.

#### Scenario: Connection check via API route

- GIVEN the frontend needs to verify device connectivity
- WHEN `performDeviceConnectionCheck(deviceId)` is invoked
- THEN the system SHALL make an HTTP call to `/api/devices/[deviceId]/health`
- AND SHALL return the result to the caller
- AND SHALL NOT import HikvisionAdapter from any backend module

#### Scenario: Stored connectivity check via API route

- GIVEN the frontend needs to check stored device credentials validity
- WHEN `checkStoredDeviceConnectivity(deviceId)` is invoked
- THEN the system SHALL make an HTTP call to `/api/devices/[deviceId]/health`
- AND SHALL return the result to the caller
- AND SHALL NOT import HikvisionAdapter from any backend module
