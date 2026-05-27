# ADR-0036. @LogCommands secure-by-default: maskSensitiveData: true as new default

Date: 2026-05-27

## Status

2026-05-27 proposed — implementation deferred to VS-011 (after VS-001 ships)

## Context

### Background

ADR-0035 establishes that `maskSensitiveData` will be implemented in v0.31.0 with
default `false` (backward-compatible opt-in). After multi-agent analysis (2026-05-27),
a follow-on decision emerged: should `@LogCommands` change its default to
`maskSensitiveData: true`?

### DDD semantic argument

In Domain-Driven Design, Commands represent write-side operations — they carry the data
needed to change system state. By DDD convention, Commands contain the richest PII:

- `CreateUserCommand` → email, password, personal details
- `ProcessPaymentCommand` → card number, billing address
- `RegisterPatientCommand` → medical data, government IDs

Queries, by contrast, carry filter criteria (which may include some PII, but the risk
profile is different — queries have no persistent side effects).

**Conclusion:** The risk profile of `@LogCommands` is materially higher than `@LogQueries`.
Treating them identically with the same default is architecturally incorrect.

### Current state after VS-001

```typescript
// After VS-001 — developer must remember maskSensitiveData: true
@LogCommands({ includePayload: true })  // ← still leaks PII
@LogCommands({ includePayload: true, maskSensitiveData: true })  // ← safe
```

This is a boolean trap. The unsafe option is the natural/default choice.

### Option analysis

**Option A — Keep default false (status quo after VS-001):**
- No breaking change
- Consumers who added `@LogCommands({ includePayload: true })` before this ADR see no change
- Risk: GDPR exposure continues for developers who don't read the JSDoc warning

**Option B — Change @LogCommands default to maskSensitiveData: true:**
- Breaking for consumers using `@LogCommands({ includePayload: true })` who relied on
  unmasked payload in logs (e.g. for debug purposes)
- Those consumers can opt out explicitly with `maskSensitiveData: false`
- Eliminates the boolean trap for the highest-risk decorator
- `@LogQueries` keeps `maskSensitiveData: false` default — lower risk, filter-oriented
- `@LogCQRS` — separate decision, not in scope here

## Decision

**Adopt Option B for v0.31.1 (or merged into v0.31.0 if schedule allows).**

`@LogCommands` will default to `maskSensitiveData: true`. `@LogQueries` will keep its
default at `maskSensitiveData: false`. `@LogCQRS` is out of scope for this ADR.

### Implementation

```typescript
export function LogCommands(options: CQRSLoggingOptions = {}) {
  // Commands carry PII — mask by default, opt-out explicitly
  const resolvedOptions: CQRSLoggingOptions = { maskSensitiveData: true, ...options };
  // ... rest unchanged
}

export function LogQueries(options: CQRSLoggingOptions = {}) {
  // Queries carry filters — keep default false (lower risk profile)
  const resolvedOptions: CQRSLoggingOptions = { maskSensitiveData: false, ...options };
  // ... rest unchanged
}
```

Opt-out for consumers who need raw command payload in logs:
```typescript
@LogCommands({ includePayload: true, maskSensitiveData: false })
```

### Semver classification

This is classified as a **minor breaking change** (opt-out available, behavior is
a security improvement, not a regression). It ships in v0.31.1 or v0.32.0 depending
on whether it's bundled with the Option B API redesign from ADR-0035.

## Consequences

### Positive

- Eliminates boolean trap for the highest-risk decorator
- Aligns with DDD semantic: Commands are write-side, carry PII, deserve stronger defaults
- Consumers who forget `maskSensitiveData: true` are protected by default
- Explicit opt-out (`maskSensitiveData: false`) signals intent in code review

### Negative

- Breaking behavior for `@LogCommands({ includePayload: true })` — payload now masked
- Consumers relying on raw command payload in logs (e.g. dev-mode debugging) must add
  `maskSensitiveData: false` explicitly
- Requires CHANGELOG entry and potentially a migration note in library docs

### Neutral

- `@LogQueries` behavior unchanged
- `@LogCQRS` addressed in a separate decision when needed
- If bundled with ADR-0035 v0.32.0 redesign, the breaking change cost is already paid

## Files affected

- `packages/logging/src/integration/cqrs-decorators.ts` (function `LogCommands`)
- Task: `project-orchestration/tasks/VS-011-logging-cqrs-default-mask-true.md`
- `CHANGELOG.md` — breaking change entry required

## Related ADRs

- ADR-0035 — Fix vs redesign decision for VS-001 (prerequisite)
- ADR-0003 — Enterprise logging decision (original logging architecture)
