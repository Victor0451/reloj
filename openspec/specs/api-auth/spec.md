# Spec: API Auth

## Purpose

Defines the secure API route pattern using Bearer token authentication for protected Next.js API routes. All routes that perform sensitive operations or access non-public data MUST use this pattern.

## Requirements

### Requirement: Bearer token validation

All protected API routes MUST validate the `Authorization` header by checking it matches the pattern `Bearer ${CRON_AUTH_TOKEN}` where `CRON_AUTH_TOKEN` is an environment variable.

#### Scenario: Request with valid token

- GIVEN a request with `Authorization: Bearer <valid_token>` header
- WHEN the route handler validates the token
- THEN the request SHALL proceed to the route logic

#### Scenario: Request without Authorization header

- GIVEN a request without an `Authorization` header
- WHEN the route handler validates the token
- THEN the route SHALL return a `401 Unauthorized` response

#### Scenario: Request with invalid token

- GIVEN a request with an invalid or malformed `Authorization` header
- WHEN the route handler validates the token
- THEN the route SHALL return a `401 Unauthorized` response

### Requirement: Environment variable check

The route handler SHALL check that `CRON_AUTH_TOKEN` environment variable is set. If not set, the route SHOULD return a `500 Internal Server Error` with a clear error message indicating misconfiguration.

#### Scenario: Missing environment variable

- GIVEN the `CRON_AUTH_TOKEN` environment variable is not set
- WHEN the route handler initializes
- THEN the route SHALL return a `500 Internal Server Error` with message "CRON_AUTH_TOKEN not configured"

### Requirement: Token comparison security

The token comparison MUST use constant-time comparison to prevent timing attacks.

#### Scenario: Timing attack prevention

- GIVEN two tokens that differ in the last character
- WHEN the comparison runs
- THEN the comparison time SHALL be approximately equal regardless of where the mismatch occurs