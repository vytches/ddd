# ADR-0037. Internal Diagnostics Control via Configurable Sink Injection

Date: 2026-06-04

## Status

2026-06-04 proposed — depends on VS-013 (application-logging layer removal).
Task: VS-014.

## Context

VS-013 removed the entire application-logging layer (`@vytches/ddd-logging`:
`DefaultLogger`, `ConsoleProvider`, `DataMasker`, `@LogCommands`). What remains
is a minimal `internalLogger` — a `console.warn`/`console.error` shim used by
library packages to report **their own** problems (misconfiguration, "no handler
found"). It was consolidated into a single implementation in
`packages/contracts/src/` and exported `@internal` from the contracts barrel
(see VS-013 consolidation note; `Result<T>` precedent).

**Problem.** An enterprise library that writes to `console` with no way for the
consumer to silence or redirect that output is a recognised DX anti-pattern.
Consumers run their own logger (Pino, etc.); duplicate/uncontrollable `console`
noise from a dependency is unwanted — especially in production and tests.

The earlier stance (recorded in memory `feedback_logging_internal_only`) was
**"no public hook/setter; consumers cannot redirect/silence"**. This ADR
**consciously reverses** that, because for a library of this class the inability
to control a dependency's own diagnostics is a defect, not a feature. The memory
itself anticipated a "new redesign task to follow" — this is it.

Why not the cheap alternatives:

- **`stripInternal: true`** (hide `internalLogger` from `.d.ts`) — hides the
  symbol but gives the consumer **zero control**; solves visibility, not the DX
  problem.
- **Mutable exported `const`** (current accidental state) — a consumer _could_
  `internalLogger.warn = () => {}`, but that is an undocumented footgun, not an
  API, and breaks encapsulation.
- **Per-package copies** — duplication, and still no control point.

## Decision

Introduce an intentional, encapsulated **diagnostics control API** in
`@vytches/ddd-contracts`, re-exported by name from the `@vytches/ddd` meta
package so the typical consumer can reach it.

```ts
/** Contract a consumer implements to receive the library's own diagnostics. */
export interface DiagnosticsSink {
  warn(message: string, context?: Record<string, unknown>): void;
  error(
    message: string,
    error?: Error,
    context?: Record<string, unknown>
  ): void;
}

/** silent < error < warn (warn is most verbose; includes error). */
export type DiagnosticsLevel = 'silent' | 'error' | 'warn';

export interface DiagnosticsOptions {
  sink?: DiagnosticsSink; // default: console sink
  level?: DiagnosticsLevel; // default: 'warn'
}

/** PUBLIC — consumer redirects/silences/level-filters library diagnostics. */
export function configureDiagnostics(options: DiagnosticsOptions): void;
```

Internals:

- Module-private `currentSink` (default console) and `currentLevel` (default
  `'warn'`). Neither is exported → no monkeypatch surface.
- `internalLogger` stays `@internal` and **delegates** to `currentSink`, gated
  by `currentLevel`:
  - `level === 'silent'` → nothing
  - `level === 'error'` → only `error()` passes
  - `level === 'warn'` → `warn()` + `error()` pass
- Library packages keep calling `internalLogger.warn(...)` — **no change to the
  ~25 existing call sites**.

Consumer usage:

```ts
import { configureDiagnostics } from '@vytches/ddd';

// redirect to Pino
configureDiagnostics({
  sink: {
    warn: (m, c) => pino.warn(c, m),
    error: (m, e, c) => pino.error({ ...c, err: e }, m),
  },
});

// silence entirely (e.g. production / tests)
configureDiagnostics({ level: 'silent' });
```

**Invariant preserved (rule from VS-013):** `internalLogger` receives ONLY
library-internal metadata (names, `error.message`) — never command/query/event
payloads, aggregate state, or PII. The sink therefore never sees user data.

## Consequences

### Positive

- Consumers can silence or redirect the library's own diagnostics — proper
  enterprise DX.
- One consistent diagnostic channel for all `@vytches/ddd-*` packages, with one
  evolution point (format, level, prefix).
- Testable: our and consumers' tests can inject a spy sink to assert the library
  warned about misconfiguration.
- Governed surface — tracked in the `api-surface` snapshot.

### Negative

- Reverses the prior "non-export / no hook" stance (done consciously; memory
  updated).
- Adds public API surface to `contracts` and `@vytches/ddd`; the `api-surface`
  snapshots change.
- `internalLogger` itself remains `@internal` and importable via
  `@vytches/ddd-contracts` (not re-exported from `@vytches/ddd`).

### Compatibility

Purely **additive** — new exports only, no signature changes. Non-breaking;
**minor** semver bump. Target version aligns with VS-013 (v0.4.0).

## Alternatives Considered

- **Minimal sink-only** (`setDiagnosticsSink(sink | null)`, no levels) —
  rejected in favour of `configureDiagnostics` with `level` so silence and
  error-only filtering are first-class from day one (no later API change).
- **`stripInternal` hide** — rejected: no consumer control.
- **Keep per-package copies / mutable const** — rejected: duplication / footgun.
