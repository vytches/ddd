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
updated_at: 2026-06-29
status: done
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

- [x] outbox-processor: `Error` passed as 2nd arg of `internalLogger.error`;
      stack trace preserved
- [x] LoggingMiddleware type widened to correct contract; existing tests pass
- [x] No payload/PII reaches internalLogger
- [x] build + test + lint + type-check green

### Definition of Done

- [x] Implemented + reviewed
- [x] Tests cover the corrected error path (stack present) and middleware type
- [x] All quality gates green

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

### Completion (2026-06-29, via /orchestrate)

- **Issue 1** — `packages/messaging/src/outbox/outbox-processor.ts`: wszystkie 4
  wywołania `internalLogger.error` przekazują teraz `Error` jako 2. arg (stack
  zachowany); metadata (`{ hookName }`, `{ messageId, attempts }`) w 3. arg,
  zero interpolacji błędu w message.
- **Issue 2** — `packages/cqrs/src/middleware/logging.middleware.ts`: dodany i
  wyeksportowany `IMiddlewareLogger` (`log(message, ...args)`), parametr
  konstruktora poszerzony (wstecznie kompatybilne — wąscy konsumenci i `console`
  nadal się typują); eksport additive w `middleware/index.ts` + `index.ts`.
- **Testy**: ścieżka `safelyInvokeHook` (Error w arg[1], `{ hookName }` w
  arg[2]) + suite poszerzenia typu `IMiddlewareLogger`.
- **Gates**: lint + test + build GREEN — `@vytches/ddd-messaging` 90/90,
  `@vytches/ddd-cqrs` 283/283.
- **Weryfikacja**: library-quality-verifier → PASS; security (PII invariant) →
  WARN (brak VETO; inwariant `feedback_logging_internal_only` zachowany).
- **Status git**: zaimplementowane i zweryfikowane, **staged — pending
  commit/merge** (review i merge po stronie właściciela).
- **Follow-up (pre-existing, poza zakresem)**: `logging.middleware.ts:36`
  interpolacja `${error}` w catch; `outbox-processor.ts:395` `warn` z
  `${error?.message}`.

---

_Task managed by Project Orchestrator | Last AI Review: 2026-06-29_
