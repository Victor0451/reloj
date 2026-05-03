# Delta for device-refresh-api

## MODIFIED Requirements

### Requirement: Authentication required

(Previously: No authentication required)

The `/api/devices/refresh` endpoint MUST validate the `Authorization` header using Bearer token authentication matching the pattern defined in `api-auth` spec.

#### Scenario: Request without auth token

- GIVEN a POST request to `/api/devices/refresh` without `Authorization` header
- WHEN the route handler processes the request
- THEN the route SHALL return a `401 Unauthorized` response

#### Scenario: Request with invalid auth token

- GIVEN a POST request to `/api/devices/refresh` with invalid token
- WHEN the route handler processes the request
- THEN the route SHALL return a `401 Unauthorized` response

#### Scenario: Request with valid auth token

- GIVEN a POST request to `/api/devices/refresh` with valid `Authorization: Bearer <token>`
- WHEN the route handler processes the request
- THEN the request SHALL proceed to device lookup

### Requirement: Safe field selection

(Previously: Returned all device fields including `device_password_encrypted`)

The endpoint MUST only return client-safe device fields: `id`, `device_name`, `device_type`, `status`, `last_seen_at`, `created_at`. Fields containing credentials or sensitive data MUST NOT be returned.

#### Scenario: Happy path returns safe fields

- GIVEN a valid authenticated request with a valid deviceId
- WHEN the route handler queries the device
- THEN the response SHALL only contain fields: `id`, `device_name`, `device_type`, `status`, `last_seen_at`, `created_at`
- AND the response SHALL NOT contain `device_password_encrypted` or similar sensitive fields

#### Scenario: Sensitive fields excluded from response

- GIVEN a valid authenticated request for a device that exists
- WHEN the response is generated
- THEN `device_password_encrypted` SHALL NOT be present in the JSON response

### Requirement: Missing deviceId handling

The endpoint MUST return a `400 Bad Request` when the `id` query parameter is missing.

#### Scenario: Missing deviceId

- GIVEN a POST request to `/api/devices/refresh` without `id` query parameter
- WHEN the route handler processes the request
- THEN the route SHALL return a `400 Bad Request` with error message "No device ID"

### Requirement: Admin client usage

The endpoint MUST use `createAdminClient()` from `@/lib/supabase/admin` instead of `createClient()` with anon key, to ensure server-side privileges for database queries.

#### Scenario: Uses admin client

- GIVEN a valid authenticated request
- WHEN the route handler creates the Supabase client
- THEN it SHALL use `createAdminClient()` from `@/lib/supabase/admin`
- AND NOT use `createClient()` with `NEXT_PUBLIC_SUPABASE_ANON_KEY`