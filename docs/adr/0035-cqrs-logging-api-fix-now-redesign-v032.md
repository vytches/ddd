# ADR-0035. CQRS Logging API: fix maskSensitiveData in v0.31.0, redesign to payload enum in v0.32.0

Date: 2026-05-27

## Status

2026-05-27 accepted

## Context

### Problem

Security audit (2026-05-26) identified a CRITICAL finding (DREAD 13/15,
SEC-LOGGING-002): the `@LogCommands`, `@LogQueries`, and `@LogCQRS` decorators
with `includePayload: true` log the full command/query payload with no masking.
Passwords, JWT tokens, credit card numbers, and any PII flow directly into
production logs.

`maskSensitiveData?: boolean` existed in `CQRSLoggingOptions` but was dead code
— the flag was never read in `createLoggingWrapper`.

### Competing design proposals

A 7-agent technical analysis (2026-05-27) produced two competing proposals:

**Option A — Fix (2h, in-place):**

- Implement the already-declared `maskSensitiveData: boolean`
- Add optional `sensitiveFields?: string[]` forwarded to `DataMasker`
- Keep all existing API surface unchanged
- Default `maskSensitiveData: false` (backward-compatible)

**Option B — Improvement (4–6h, API redesign):**

- Replace `includePayload: boolean` + `maskSensitiveData: boolean` boolean trap
  with a discriminated union: `payload?: 'off' | 'masked' | 'full'`
- Rename `sensitiveFields` → `redactFields` (industry standard term)
- Clearer developer intent, eliminates boolean trap
- Requires deprecation path and CHANGELOG migration guide
- Breaking change for all current consumers of `includePayload`

### Constraints at time of decision

- GDPR exposure is active in production — consumers using `includePayload: true`
  are leaking PII today
- VS-003 (DataMasker plural key bug) must ship first as a dependency
- Consumer project `juz-ide-api` has 237+ aggregates using the library — a
  breaking API change requires coordinated migration
- Option B adds 4h of work plus migration documentation before the fix ships

## Decision

**Adopt Option A for v0.31.0. Plan Option B for v0.32.0.**

The GDPR risk outweighs the ergonomic benefit of the redesigned API. Every day
without the fix is a day where PII is in production logs. Option A ships in 2h
and eliminates the vulnerability without touching the existing API surface.

Option B is explicitly deferred — not abandoned. The API redesign is documented
in VS-001's task file as a post-fix improvement and in VS-011 (default secure)
as a stepping stone.

### v0.31.0 scope (Option A)

```typescript
// CQRSLoggingOptions — non-breaking additions only
export interface CQRSLoggingOptions {
  includePayload?: boolean;
  maskSensitiveData?: boolean; // was dead code — now implemented
  sensitiveFields?: string[]; // NEW — forwarded to DataMasker({ sensitiveKeys })
  logLevel?: 'debug' | 'info';
  contextName?: string;
}

// createLoggingWrapper — DataMasker as closure singleton (not per-call)
const masker =
  options.includePayload && options.maskSensitiveData
    ? new DataMasker({ sensitiveKeys: options.sensitiveFields ?? [] })
    : null;
```

### v0.32.0 scope (Option B — planned)

```typescript
// Replaces boolean pair with discriminated union
export interface CQRSLoggingOptions {
  payload?: 'off' | 'masked' | 'full'; // default: 'off'
  redactFields?: string[]; // was: sensitiveFields
  logLevel?: 'debug' | 'info';
  contextName?: string;
}
```

`includePayload` and `maskSensitiveData` deprecated in v0.31.0, removed in
v0.32.0.

## Consequences

### Positive

- PII leakage eliminated in v0.31.0 without any consumer migration required
- Backward-compatible: consumers without `maskSensitiveData` see no behavior
  change
- Consumers opting in to `maskSensitiveData: true` get immediate protection
- v0.32.0 API will be clean and discoverable

### Negative

- v0.31.0 retains the boolean trap (`includePayload: true` without
  `maskSensitiveData` is still unsafe)
- Consumers must be informed via JSDoc warning and CHANGELOG
- Two API shapes exist in the codebase between v0.31.0 and v0.32.0

### Neutral

- `DataMasker` instantiated as closure singleton in `createLoggingWrapper` —
  performance improvement over per-call instantiation; no API change
- `sensitiveFields` will need rename to `redactFields` in v0.32.0 — one field
  migration

## Files affected

- `packages/logging/src/integration/cqrs-decorators.ts`
- `packages/logging/src/utils/data-masker.ts` (via VS-003)
- Task: `project-orchestration/tasks/VS-001-logging-cqrs-payload-masking.md`
- Threat model: `docs/security/threat-models/TM-VS-001.md`

## Related ADRs

- ADR-0036 — Secure-by-default `@LogCommands` (VS-011, v0.31.1)
- ADR-0003 — Enterprise logging decision (original logging architecture)
