# SDD Apply — Phase 4: UI Pages

## Context

**Change**: attendance-calculation-system
**Phase**: 4 of 4 (UI Pages)
**Mode**: hybrid (engram + openspec)

## Files Created

### 1. `src/components/schedules/schedule-builder.tsx`
- Visual week-grid schedule builder component
- Props: `initialConfig?: ScheduleConfig`, `onSave`, `onCancel?`
- 7-column Card grid (Lunes→Domingo)
- Each day has time range rows with add/remove controls
- Uses `Input type="time"` for start/end HH:MM

### 2. `src/app/(dashboard)/dashboard/schedules/page.tsx`
- Schedule template management page
- Lists all templates with schedule preview text
- Create inline with name input + ScheduleBuilder
- Edit inline via pencil button → same form with initialConfig
- Delete with confirmation via `deleteTimeTemplate(id)`
- Shows active/inactive badge per template

### 3. `src/app/(dashboard)/dashboard/attendance/page.tsx`
- Attendance reports page
- Filters: date range (Desde/Hasta), multi-select employee list
- Totals cards: Hours Total, Overtime, Tardiness Minutes, Present Days
- Table columns: Fecha, Empleado, Prog., Real, OT, Tard., Estado
- CSV export via `exportToCsv()` utility
- Uses `getAttendanceReport()`, `getTimeTemplates()`, `listPersons()`

### 4. `src/lib/utils.ts` — Added `exportToCsv()`
```typescript
export function exportToCsv(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][]
): void
```
- Proper CSV escaping (quotes, commas, newlines)
- Browser download trigger

## TypeScript Validation

✅ `npx tsc --noEmit` — **PASS** with no errors.

## Implementation Notes

1. Import pattern used: actions from `@/actions/*`, types from `@/types/*`
2. `schedule-builder.tsx` is client component (`'use client'`) due to useState
3. Schedules page uses inline edit pattern (no separate [id] page needed for MVP)
4. Attendance page type annotations added to prevent implicit `any` in map callbacks

## Status

**Phase 4 complete.** All UI page tasks implemented and validated.