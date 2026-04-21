# Legacy Sync Files - Archived Phase 2

These files were archived during the Phase 2 refactoring to implement the 3-loop adapter pattern.

## Archived Files

| File | Description | Replaced By |
|------|-------------|-------------|
| `heartbeat.ts` | Original heartbeat loop implementation | `heartbeat-loop.ts` (adapter) |
| `syncEvents.ts` | Original sync events handler | `sync-loop.ts` (adapter) |
| `persons.ts` | Original persons sync logic | `persons-loop.ts` (adapter) |

## Why Archived

These files represented the monolithic original implementation. They have been replaced by the adapter pattern that provides:
- Clean separation between device interaction and sync orchestration
- Testable loop implementations
- Consistent error handling and retry logic
- Unified device communication interface

## New Architecture

```
sync/
├── legacy/           # Archived original implementations
├── adapters/        # Device protocol adapters
├── loops/           # Sync loop implementations
│   ├── heartbeat-loop.ts
│   ├── sync-loop.ts
│   └── persons-loop.ts
└── index.ts         # Unified sync coordinator
```

**History preserved via git mv** - All file history intact in git.