# Tasks: Devices Reliability Refactor

## Phase 1: SDD Foundation
- [x] 1.1 Add `openspec/config.yaml` and normalize hybrid SDD structure for this repo.
- [x] 1.2 Create a safe contract for `/devices` data in `src/types/device.types.ts` and document server/client boundaries.

## Phase 2: Secure Enrollment
- [x] 2.1 Refactor `src/actions/devices.ts` to separate enrollment/update commands from client-safe read models.
- [x] 2.2 Fix `src/components/devices/add-device-dialog.tsx` to use reliable form state and server-side test connection.
- [x] 2.3 Consolidate connectivity checks in `src/lib/device-connectivity.ts` and remove duplicate semantics from overlapping actions.

## Phase 3: Runtime State + Realtime UX
- [x] 3.1 Refactor `src/components/devices/device-list.tsx` to consume only safe DTOs and maintain stable Realtime updates.
- [x] 3.2 Replace full page reload in `src/components/devices/device-card.tsx` with targeted refresh/check actions.
- [x] 3.3 Connect search/filter/runtime feedback in `src/app/(dashboard)/dashboard/devices/page.tsx` and related components.

## Phase 4: Agent Bridge Alignment
- [x] 4.1 Update `agent/src/index.ts` to manage registered devices by readiness instead of current `status='online'` gating.
- [x] 4.2 Align `agent/src/sync/*` writes with the canonical runtime-state contract used by `/devices`.

## Phase 5: Verification
- [ ] 5.1 Run `npm run lint` and `npm run build` after refactor slices.
- [ ] 5.2 Verify with a real registered device that enrollment, sync recovery and Realtime state transitions behave as specified.
