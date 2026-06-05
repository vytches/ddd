# Task: internalLogger follow-ups — outbox stack trace + LoggingMiddleware type

## Task Metadata

```yaml
task_id: VS-015
title:
  'diagnostics: fix outbox-processor lost stack trace + narrow LoggingMiddleware
  type'
type: bug
priority: low
complexity: simple
estimated_time: 1.5h
created_by: agent
created_at: 2026-06-05
status: planned
split_from: VS-013
memory_ref: feedback_logging_internal_only
```

## Domain Context

```yaml
bounded_context: Messaging / CQRS infrastructure
patterns:
  - Internal diagnostics (internalLogger)
```

## Business Context

### Why This Task Exists

Two non-blocking follow-ups surfaced during VS-013 (logging-layer removal) and
deferred so the main refactor could merge. Quality polish, not regressions.

## Technical Context

### Issue 1 — outbox-processor: lost stack trace

`packages/messaging/src/outbox/outbox-processor.ts` — an error is interpolated
into the message string instead of being passed as the 2nd argument of
`internalLogger.error(message, error?, context?)`. Result: the `Error` object
(and its stack) is stringified/lost. The `internalLogger.error` signature exists
precisely to carry the `Error` separately.

**Fix:** pass the `Error` as the 2nd arg; keep only metadata in message/context.

```ts
// ❌ now (stack lost)
internalLogger.error(`Outbox failed: ${error}`);
// ✅ target
internalLogger.error(
  'Outbox processing failed',
  error instanceof Error ? error : undefined,
  {
    /* metadata only — no payload/PII (see invariant) */
  }
);
```

### Issue 2 — LoggingMiddleware too-narrow type (cqrs)

`packages/cqrs/src/middleware/logging.middleware.ts` (exported via enterprise) —
its type is narrower than it should be (flagged by library-expert during
VS-013). Widen to the correct middleware contract without breaking consumers.
Confirm against `packages/cqrs/tests/middleware/logging.middleware.test.ts`.

### Constraints

- Preserve the internalLogger invariant: metadata only, never payloads/PII.
- Backward compatible (no API break for LoggingMiddleware consumers).
- Dependency-free.

## Requirements & Acceptance Criteria

- [ ] outbox-processor: `Error` passed as 2nd arg of `internalLogger.error`;
      stack trace preserved
- [ ] LoggingMiddleware type widened to correct contract; existing tests pass
- [ ] No payload/PII reaches internalLogger
- [ ] build + test + lint + type-check green

### Definition of Done

- [ ] Implemented + reviewed
- [ ] Tests cover the corrected error path (stack present) and middleware type
- [ ] All quality gates green

## Code References

```yaml
packages:
  - package: '@vytches/ddd-messaging'
    files:
      - src/outbox/outbox-processor.ts # Issue 1
  - package: '@vytches/ddd-cqrs'
    files:
      - src/middleware/logging.middleware.ts # Issue 2
      - tests/middleware/logging.middleware.test.ts # Issue 2 verification
```

## Links & References

- Split from VS-013 (remove application-logging layer) — closure note
- Rule: internalLogger metadata-only invariant (memory
  `feedback_logging_internal_only`)

## Final Notes

Wydzielone z VS-013 2026-06-05 (decyzja właściciela: domknąć VS-013, follow-upy
osobno). Niskie ryzyko, kosmetyka jakości.

---

_Task managed by Project Orchestrator | Last AI Review: 2026-06-05_
