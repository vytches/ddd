# Task: Docs truth & parity sweep — phantom APIs, broken samples, migration story, gate extension

## Task Metadata

```yaml
task_id: VD-008
title:
  'docs: fix all human-facing doc defects from LIB-MATURITY-AUDIT-2026-08-08
  (S1 + S3 doc items) and extend the existing docs-compile-gate so this class
  cannot recur'
type: documentation
priority: normal
complexity: medium
estimated_time: 10h
created_by: LIB-MATURITY-AUDIT-2026-08-08
created_at: 2026-08-09
status: backlog
release_target: before first non-alpha tag (docs ship inside the npm packages)
package: 'repo-wide (root docs + all 19 package READMEs/LLMGUIDEs)'
findings:
  [audit S1-1, S1-2, S1-3, S1-4, S3-9, S3-10, S3-13, S3-14, VF-036 root cause]
```

## Why

The 2026-08-08 maturity audit found the human-facing docs one full tier behind
the code (docs grade 5/10 vs verified code quality 8/10). The AI-facing
LLMGUIDEs were systematically fixed (VD-007) — the READMEs next to them were
not, and now visibly disagree. Two incidents prove the production cost of this
class: the phantom `@vytches/ddd-logging` package still listed in ~13 docs
(npm 404 for anyone following them), and the `getEqualityComponents()`
docs-phantom API a downstream consumer built ~170 subclasses on (→ VF-036).

VD-005 shipped `tools/docs-compile-gate` (CI-wired, blocking), but it is
opt-in per fence (`compile-check` marker) and only type-checks snippets — it
cannot catch phantom package references or documented-but-nonexistent APIs.
Both incidents sailed through it.

## Acceptance Criteria

### Content fixes (verify every signature against source before writing)

1. [ ] Phantom `@vytches/ddd-logging` removed/corrected in all references:
       root `README.md:170`, `packages/{cqrs,aggregates,events,repositories,domain-services,messaging,projections,resilience}/README.md`,
       `packages/{nestjs,events,acl,policies,repositories,aggregates}/LLMGUIDE.md`
       — point to `@vytches/ddd-contracts` diagnostics
       (`configureDiagnostics`/`DiagnosticsSink`) where a replacement reference
       makes sense, else delete the row.
2. [ ] `examples/quickstart/src/domain/order.aggregate.ts` migrated from
       throwing raw `Error` to `Result<T, Error>` (per root `README.md:117`'s
       own promise); quickstart tests updated; `QUICK_START.md` and the
       aggregate now teach the same idiom.
3. [ ] Broken README samples fixed in contracts, aggregates, cqrs,
       value-objects (audit S1-3 list: `createDomainEvent` signature,
       `aggregateBuilder` call order, `handle`→`execute`,
       `EntityId.fromString/fromNumber`→`fromUUID/fromInteger`) — copy from
       each package's already-correct LLMGUIDE. Then run the same
       README-vs-source drift check over the remaining 14 packages and fix
       what it finds.
4. [ ] Root `README.md` status updated: `0.31.0-alpha.0` (not
       `v0.25.0-beta.1`), one-line pointer to the alpha's breaking changes.
5. [ ] Circular "see CHANGELOG.md" migration pointers in
       `packages/{di,policies,domain-services,acl,validation}/CHANGELOG.md`
       replaced with real before/after notes or direct links to the root
       CHANGELOG sections. Root `MIGRATION.md` extended with the VP-009 DI
       token break and the `BaseValueObject` validate-throws break (VF-023),
       linked from README, cross-referenced from CHANGELOG.
6. [ ] Class-level JSDoc added to `BaseValueObject` and `EntityId`
       (`packages/value-objects/src/`) and the sampled-undocumented exports in
       `packages/domain-primitives/src/` (BaseError, IDomainError,
       MissingValueError, ActorError, IActor).
7. [ ] `docs/adr/0019-*` duplicate renumbered (one of the two files + index
       row in `docs/adr/README.md`). Root `package.json` gets a one-line
       comment-style note that Lerna owns versions and package versions differ
       (do NOT edit the version field itself).
8. [ ] `packages/events/README.md`: integration-pipeline section moved below
       the core `UnifiedEventBus` quick start and labeled advanced/optional
       (consistent with VF-031 OQ-2's scope-narrowing decision).

### Gate extension (recurrence prevention)

9. [ ] `tools/docs-compile-gate` gains a **package-reference check**: any
       `@vytches/ddd-*` name mentioned in README/LLMGUIDE must exist in the
       workspace (would have caught S1-1). Blocking in CI.
10. [ ] `tools/docs-compile-gate` gains a **symbol-existence check** (design
        choice documented in the task on implementation): identifiers shown as
        public API in docs fences (marked or via a lightweight
        `api-check` marker) must exist in the package's `.d.ts` — would have
        caught `getEqualityComponents()`. May ship as warning-level first,
        flipped to blocking after the sweep above is green.
11. [ ] Every sample fixed in AC3 gets the `compile-check` marker so the
        existing gate holds it compiled from now on.

## Non-goals

- Filling missing example workspaces (→ VD-009).
- LLMGUIDE content work (VD-007 done; only stale `ddd-logging` rows are
  touched here).
- Interactive docs site (→ VD-004).

## Links & References

- `project-orchestration/analysis/LIB-MATURITY-AUDIT-2026-08-08.analysis.md`
  (S1-1..4, S3-9/10/13/14, action items 1-3, 5-6, 8-9).
- `tools/docs-compile-gate/README.md` (existing marker convention, VD-005).
- VF-036 (docs-phantom API incident — the motivating case for AC10).
