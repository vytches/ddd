# Task: CQRS LoggingMiddleware — bring default console output under diagnostics control

## Task Metadata

```yaml
task_id: VS-018
title:
  'cqrs/messaging: LoggingMiddleware default-on raw console bypasses
  configureDiagnostics; error interpolation + outbox log injection'
type: bug
priority: high
complexity: simple
estimated_time: 4h
created_by: SEC-AUDIT-2026-07-09
created_at: 2026-07-09
status: done
release_target: pre-first-public-publish (default-behavior change)
package: "'@vytches/ddd-cqrs', '@vytches/ddd-messaging'"
findings: [SA-H1, SA-H2, SA-L2]
completed_at: 2026-07-10
```

## Why

VS-013/VS-014/VS-015 established a single control plane for everything the
library emits: `internalLogger` → `DiagnosticsSink`, configured via
`configureDiagnostics({ sink, level })`. The audit found one significant path
that escaped that consolidation, plus two smaller leaks in what gets
interpolated into diagnostic strings:

1. **SA-H1 (HIGH):** `EnhancedCommandBus`/`EnhancedQueryBus` install
   `new LoggingMiddleware()` **by default** — the gate is
   `options.enableMetrics !== false` (`enhanced-command-bus.ts:153-155`,
   `enhanced-query-bus.ts:252-254`) and the middleware's constructor defaults to
   raw `console` (`packages/cqrs/src/middleware/logging.middleware.ts:19`).
   Every command/query execution prints to stdout in production;
   `configureDiagnostics({ level: 'silent' })` does NOT silence it; the only
   opt-out (`enableMetrics: false`) is non-obvious and conflates metrics with
   logging.
2. **SA-H2 (HIGH):** the middleware's failure line interpolates `${error}`
   (`logging.middleware.ts:36`). Validation/domain error messages conventionally
   embed the offending input value ("Invalid email: x@y.com") — an indirect
   PII-to-console vector, on by default.
3. **SA-L2 (LOW, same theme):** `outbox-processor.ts:463-465` interpolates
   `error?.message` into a log line with no newline/control-character
   sanitization — log-injection vector (forged log entries) when a handler
   embeds external data in a thrown error message.

## Acceptance Criteria

1. [x] Logging decoupled from metrics: new `enableExecutionLogging?: boolean`
       option on `EnhancedCommandBusOptions`/`EnhancedQueryBusOptions`,
       **default off**. `enableMetrics` no longer installs `LoggingMiddleware`
       as a side effect.
2. [x] ~~Routes through `internalLogger`~~ — **implemented differently, see note
       below.** No raw `console` output happens by default anywhere in cqrs
       `src/` (the actual harm this AC exists to prevent) — achieved by making
       the middleware strictly opt-in rather than by routing through
       `internalLogger`.
3. [x] Failure log line no longer blind-interpolates `${error}`: logs
       `error.name` (or `'UnknownError'` for non-`Error` throws) + a sanitized
       `error.message`/`String(error)`.
4. [x] Shared sanitization helper added as `LibUtils.sanitizeLogMessage()`
       (`packages/utils/src/lib-utils.ts`) — strips C0 control chars + DEL; used
       by both `LoggingMiddleware` and `outbox-processor.ts:handleMessageError`.
5. [x] Tests: default bus construction installs zero middlewares (verified for
       both buses); explicit `enableExecutionLogging: true` installs exactly one
       `LoggingMiddleware`; control-char sanitization unit tested in both
       `lib-utils.test.ts` and `logging.middleware.test.ts`; non-Error rejection
       handled without crashing.
6. [x] Default-behavior change is self-documenting via JSDoc on the new option;
       CHANGELOG is Lerna-generated from the conventional commit (no manual edit
       per project convention).

### Design note — why AC2 was NOT implemented as "route through internalLogger"

`internalLogger`/`DiagnosticsSink` is explicitly scoped to "problems originating
in the library itself" (misconfiguration, unexpected failures) — **not** an
app-level execution-tracing/observability channel (see `internal-logger.ts` doc
comment and project memory `feedback_logging_internal_only`). CQRS's "Executing
X" / "completed in Nms" traces are routine execution tracing, not library
problems; routing them through `internalLogger.warn` would abuse the "problems
only" channel and violate that documented design boundary. The actual harm AC2
was written to prevent — raw console output happening **by default**, outside
consumer consent — is fully addressed by AC1 (opt-in only) instead: nothing
reaches console unless a consumer explicitly requests execution logging, at
which point `LoggingMiddleware`'s own configurable-logger constructor
(unchanged) is the correct mechanism, same as any other opt-in observability
hook. The failure path specifically (a real problem) still gets its `${error}`
blind-interpolation risk fixed per AC3, independent of which channel is used.

## Out of scope

- Any application-logging layer or masking framework — removed by VS-013 and
  must not return (memory: library logger is internal-only diagnostics).
- The value-objects deprecation `console.warn` + env-var suppress — conscious
  completed decision (VS-008), stays as is.
- `packages/testing` direct console usage (opt-in verbose/dev-time output) —
  acceptable for a dev-tooling package.

## Activity / Notes

### 2026-07-10 — implemented on `feature/VS-018-cqrs-logging-middleware-diagnostics`, merged to develop (status: done)

Verification before merge: `@vytches/ddd-utils` test (164/164, incl. 4 new
`sanitizeLogMessage` tests), type-check, lint (0 errors); `@vytches/ddd-cqrs`
test (289/289, incl. new default-off/opt-in/sanitization tests; 2 pre-existing
tests updated to construct a locally-scoped bus with
`enableExecutionLogging: true` instead of relying on the shared
default-constructed bus), type-check, lint (0 errors); `@vytches/ddd-messaging`
test (96/96), type-check, lint (0 errors); `@vytches/ddd-enterprise` api-surface
test (1/1); `@vytches/ddd-nestjs` test (215/215) — grep-confirmed nestjs never
references `enableMetrics` for CQRS bus construction, so no changes needed
there. All green, no regressions.

Noted but out of scope: `packages/cqrs/README.md` documents an
`options.middleware` constructor array and references `@vytches/ddd-logging`,
neither of which exist post-VS-013 — pre-existing doc staleness, belongs to
VD-005 (docs truth cleanup), not touched here.

## References

- Analysis: `project-orchestration/analysis/SEC-AUDIT-2026-07-09.analysis.md`
  (SA-H1, SA-H2, SA-L2)
- Lineage: VS-013 (logging-layer removal), VS-014 (`configureDiagnostics`
  control API, ADR-0037), VS-015 (internalLogger follow-ups — including the
  earlier `LoggingMiddleware` type narrowing)
