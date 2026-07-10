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
status: backlog
release_target: pre-first-public-publish (default-behavior change)
package: "'@vytches/ddd-cqrs', '@vytches/ddd-messaging'"
findings: [SA-H1, SA-H2, SA-L2]
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

1. [ ] Logging is decoupled from metrics: a dedicated option (e.g.
       `enableExecutionLogging`) controls `LoggingMiddleware`; `enableMetrics`
       no longer implies logging. Decide the default deliberately (recommended:
       **off** — a library should be silent by default; consumers opt in) and
       document it.
2. [ ] `LoggingMiddleware` routes through `internalLogger` (or accepts the
       diagnostics sink) so `configureDiagnostics` governs it — no raw `console`
       default anywhere in cqrs `src/`.
3. [ ] The failure log line logs `error.name` (+ sanitized `error.message` only
       at an explicit debug-ish opt-in, if kept at all) — never blind `${error}`
       interpolation.
4. [ ] Shared sanitization for interpolated error messages in diagnostics (strip
       `\r`, `\n`, other C0 control chars): applied in `LoggingMiddleware` and
       `outbox-processor.ts:463-465` (single helper, e.g. in the diagnostics
       module, not two copies).
5. [ ] Tests: default bus construction emits nothing to `console`;
       `configureDiagnostics({ level: 'silent' })` silences an explicitly
       enabled logging middleware; control-char sanitization unit test.
6. [ ] CHANGELOG/MIGRATION entry for the default-behavior change (consumers who
       relied on the implicit `[CQRS] Executing ...` lines must opt in).

## Out of scope

- Any application-logging layer or masking framework — removed by VS-013 and
  must not return (memory: library logger is internal-only diagnostics).
- The value-objects deprecation `console.warn` + env-var suppress — conscious
  completed decision (VS-008), stays as is.
- `packages/testing` direct console usage (opt-in verbose/dev-time output) —
  acceptable for a dev-tooling package.

## References

- Analysis: `project-orchestration/analysis/SEC-AUDIT-2026-07-09.analysis.md`
  (SA-H1, SA-H2, SA-L2)
- Lineage: VS-013 (logging-layer removal), VS-014 (`configureDiagnostics`
  control API, ADR-0037), VS-015 (internalLogger follow-ups — including the
  earlier `LoggingMiddleware` type narrowing)
