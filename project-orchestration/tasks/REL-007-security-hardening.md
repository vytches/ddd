# Task: Security hardening before public release

## Task Metadata

```yaml
task_id: REL-007
title: Fix deserialization, supply chain, env leak, AI peerDeps before npm publish
type: bug
priority: critical
complexity: medium
estimated_time: 6h
created_by: agent (security-audit)
created_at: 2026-05-08 14:00
status: planned
release_target: v0.25.0-beta.1
```

## Why This Task Exists

Security audit identified 3 hard blockers + 3 supply-chain hardening + 3
runtime DoS vectors. After publication every leak becomes a CVE.

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
   - Sanitizer correctly handles prototype pollution + 1MB cap on the *class*
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
- [ ] `sanitizeObject` accepts `maxDepth` parameter, default 50, throws on excess
- [ ] `validation.rules.pattern` JSDoc warns against user-controlled RegExp
- [ ] `AggregateRootOptions.maxEvents` added (optional, default `undefined`)
- [ ] `npm audit --audit-level=high` clean across workspace

## Notes

REL-003 already handles the npm provenance configuration. This task focuses
on code-level fixes.
