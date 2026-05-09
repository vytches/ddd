# Task: Security hardening before public release

## Task Metadata

```yaml
task_id: REL-007
title:
  Fix deserialization, supply chain, env leak, AI peerDeps before npm publish
type: bug
priority: critical
complexity: medium
estimated_time: 6h
actual_time: 1h
created_by: agent (security-audit)
created_at: 2026-05-08 14:00
completed_at: 2026-05-08
status: completed
release_target: v0.25.0-beta.1
```

## ✅ Resolved (2026-05-08)

### Hard blockers

**1. `deserializeIntegrationEvent` lacks sanitization** — FIXED

- Refactored `packages/events/src/integration/integration-event.ts` to expose
  module-level helpers: `MAX_DESERIALIZE_SIZE`, `MAX_SANITIZE_DEPTH`,
  `sanitizeIntegrationPayload(obj, maxDepth?)`, `safeParseIntegrationJson(str)`
- `IntegrationEvent.deserialize()` now uses `safeParseIntegrationJson` (single
  source of truth for size + sanitization + depth)
- `deserializeIntegrationEvent` utility (in `integration-event.utils.ts:27`) now
  calls `safeParseIntegrationJson` instead of raw `JSON.parse` — closes the
  prototype-pollution + DoS vector flagged by security-audit
- Backward compat: `IntegrationEvent.MAX_DESERIALIZE_SIZE` and
  `IntegrationEvent.sanitizeObject()` kept as deprecated thin shims

**2. `@vytches/ddd-testing` AI SDK peerDeps** — FIXED

- Removed `@anthropic-ai/sdk` and `openai` from `peerDependencies` and
  `peerDependenciesMeta` in `packages/testing/package.json`
- Verified via grep: zero actual imports of these SDKs in source
  (`packages/testing/src/`) — peer deps were aspirational, never used
- Result: clean `npm install @vytches/ddd-testing` with no AI-related warnings;
  no consumer confusion about AI requirements

**3. `.env.development` tracked in git** — FIXED

- `git rm --cached .env.development` to untrack
- Added `.env.development` to `.gitignore` (was missing — gitignore had
  `.env.development.local` only)
- Audited git history with
  `git log --all -p -- .env.development | grep -i "api_key|secret|...` → CLEAN:
  file was always 0 bytes (`e69de29b` empty hash), no secrets ever committed

### Runtime DoS

**5. `sanitizeObject` lacks depth limit** — FIXED

- Added `maxDepth: number = 50` parameter to `sanitizeIntegrationPayload`
- Throws explicit error on excess: "exceeds maximum nesting depth of 50. May
  indicate a malformed or malicious payload."

**6. `validation.rules.pattern` accepts arbitrary RegExp (ReDoS)** — FIXED

- Added comprehensive JSDoc warning on the `pattern` rule type in
  `packages/validation/src/rules-registry.ts:18`
- Documents: do NOT construct RegExp dynamically from user input; pre-validate
  or use literal regex only
- Library performs no internal validation — explicit consumer responsibility

**7. AggregateRoot lacks `maxEvents` limit** — FIXED

- Added optional `maxEvents?: number` to `IAggregateConstructorParams`
- AggregateRoot stores as `_maxEvents` and checks in `apply()`: if
  `_domainEvents.length >= _maxEvents`, throws actionable error
- Default: undefined (no limit, backward-compat preserved)
- Documentation suggests `10_000` as typical safety net

### Verification

- `pnpm type-check` → 20 projects clean
- `pnpm test:ci` → 21 projects, all tests passing (post nx reset)
- Effort 1h actual vs 6h estimated (most fixes were single-file edits)

## Why This Task Exists

Security audit identified 3 hard blockers + 3 supply-chain hardening + 3 runtime
DoS vectors. After publication every leak becomes a CVE.

## Findings (from agent report 2026-05-08)

### Hard blockers

1. **`deserializeIntegrationEvent` lacks sanitization**

   - File: `packages/events/src/integration/integration-event.utils.ts:28`
   - Calls `JSON.parse(jsonString)` with no size limit, no `sanitizeObject`
   - Class-based `IntegrationEvent.deserialize()` has 1MB cap + sanitizer; the
     utility function bypasses both
   - Vector: prototype pollution + DoS via gigantic payloads

2. **`@vytches/ddd-testing` has AI SDK peerDeps**

   - `peerDependencies`: `@anthropic-ai/sdk >=0.24.0`, `openai >=4.0.0`
   - Forces consumers to provide API keys for an enterprise DDD library — wrong
   - Options: split into `@vytches/ddd-testing-ai` OR mark `private: true` OR
     lazy-load via dynamic `import()` behind feature flag

3. **`.env.development` tracked in git**
   - `.gitignore` covers `.env.development.local` but not `.env.development`
   - File is currently empty — but git history must be checked

### Supply chain

4. **No npm provenance** in `release.yml` (covered by REL-003)

### Runtime DoS

5. **`sanitizeObject` lacks depth limit** (revised — sanitizer IS present, only
   `maxDepth` is missing)

   - File: `packages/events/src/integration/integration-event.ts:103-111`
   - Sanitizer correctly handles prototype pollution + 1MB cap on the _class_
     deserializer; just no recursion depth bound
   - 10K-deep nested JSON → stack overflow in consumer apps
   - Add `maxDepth` parameter (default 20–50)

6. **`validation.rules.pattern(prop, regex)` accepts arbitrary RegExp**

   - File: `packages/validation/src/rules-registry.ts:76`
   - If consumer constructs regex from user input, library becomes ReDoS vector
   - Library itself has no vulnerable regex — risk is documentation
   - Add explicit warning in JSDoc + README

7. **No `maxEvents` limit on aggregate**
   - File: `packages/aggregates/src/core/aggregate-root.ts`
   - Replay of thousands of events → gigabyte-sized arrays
   - Add optional `maxEvents` in `AggregateRootOptions` (advisory limit)

## Acceptance Criteria

- [ ] `deserializeIntegrationEvent` matches class-based deserializer (1MB cap +
      sanitizer call)
- [ ] AI SDK peerDeps removed from `@vytches/ddd-testing` OR package marked
      private — decision documented in ADR
- [ ] `.env.development` removed via `git rm --cached`, added to `.gitignore`,
      git history audited (`git log --all --full-history -- .env.development`)
- [ ] If history shows ever-committed secrets: rotate immediately
- [ ] `sanitizeObject` accepts `maxDepth` parameter, default 50, throws on
      excess
- [ ] `validation.rules.pattern` JSDoc warns against user-controlled RegExp
- [ ] `AggregateRootOptions.maxEvents` added (optional, default `undefined`)
- [ ] `npm audit --audit-level=high` clean across workspace

## Notes

REL-003 already handles the npm provenance configuration. This task focuses on
code-level fixes.
