  # LIB-MATURITY-AUDIT-2026-08-08 — Library Maturity, DX, Performance, Docs & Quality Audit

```yaml
task_id: LIB-MATURITY-AUDIT-2026-08-08
type: analysis
status: draft
date: 2026-08-08
baseline:
  - LIB-AUDIT-2026-07-02.analysis.md
  - LIB-UX-AUDIT-2026-07-10.analysis.md
  - VD-006 / VD-007 / VP-006 / VP-006b analyses
method: 5 parallel specialist agents (api-guardian, developer-experience,
  performance-optimizer, documentation-master, quality-verifier), each
  verifying against current source on develop @ 8f7484ed, not baseline docs
```

## Verdict

**Overall: ~6.7/10 — engineering core is release-grade; human-facing docs and
first-touch DX lag one full tier behind the code.**

| Area | Grade | Trend since July |
|---|---|---|
| Verified quality (build/tsc/tests/exports) | 8/10 | ↑ all sampled gates green |
| API maturity & professionalism | 7.5/10 | ↑↑ (was ~5) — all publish blockers closed |
| Performance | 7/10 | ↑ DI + NestJS adapter fixed; VP-012 still open |
| Developer experience & usability | 6/10 | ↑ (was ~3-4) — but flagship example contradicts design |
| Documentation | 5/10 | ↔ LLMGUIDEs fixed (VD-007), READMEs still broken |

**The systemic pattern:** the AI-facing docs (LLMGUIDE.md) were systematically
fixed and now match the code; the human-facing docs (README.md at root and
package level) were not, and now visibly disagree with the LLMGUIDE sitting
next to them. A library whose differentiator is "AI-assistant ready" currently
documents its API correctly for AI and incorrectly for humans.

## Verified facts (quality-verifier)

- Build + `tsc --noEmit` clean on contracts, aggregates, cqrs, nestjs,
  enterprise (incl. the historically flaky `ddd-nestjs:type-check`).
- 941/941 tests pass across 5 sampled packages; nestjs passed first try.
- ESM+CJS+types export entries resolve to real dist files (10/10 checked).
- 0 TODO/FIXME in non-test src; lint 0 errors / 20 cosmetic warnings.
- Only test-debt hotspot: `packages/domain-services/tests/domain-services.e2e.test.ts:692`
  — whole e2e suite `describe.skip` ("missing container classes") + 1 `it.todo`.
- Not verified this pass: 14/19 packages (sampling scope), coverage numbers.

## Top findings by severity

### S1 — actively misleads consumers

1. **Phantom `@vytches/ddd-logging` in ~13 docs.** Package removed 2026-06-05
   (VS-013, commit 36abbbea); still listed as a real dependency in root
   `README.md:170`, `packages/{cqrs,aggregates,events,repositories,domain-services,messaging,projections,resilience}/README.md`,
   and `packages/{nestjs,events,acl,policies,repositories,aggregates}/LLMGUIDE.md`.
   `npm install @vytches/ddd-logging` → 404.
2. **Flagship example contradicts the headline design decision.**
   `examples/quickstart/src/domain/order.aggregate.ts:74,83-85,95` throws raw
   `Error` for business-rule violations while root `README.md:117` and
   `QUICK_START.md` promise `Result<T,E>` over throwing. First example every
   consumer runs teaches the opposite idiom.
3. **Non-compiling README samples in 4/5 sampled packages** (contracts,
   aggregates, cqrs, value-objects — e.g. `EntityId.fromString`/`fromNumber`
   don't exist; real names `fromUUID`/`fromInteger`). In each case the
   package's own LLMGUIDE has the correct version to copy from. 4/5 failure
   rate ⇒ remaining 14 packages likely affected too.
4. **Root README stale**: claims `v0.25.0-beta.1 — first public release`;
   reality is `0.31.0-alpha.0`.

### S2 — correctness/perf debt already known, confirmed still live

5. **VP-012 all three hot-path items untouched:**
   - `audit-capability.ts:159-166` + `aggregate-root.ts:243-246` — O(n²)
     frozen-copy allocation per `apply()` when audit capability attached.
   - `cached-policy.ts:283-310,369-377` — two async SHA-256 digests per
     authorization check; fast sync `fnv1a32` precedent exists in
     `enhanced-query-bus.ts:92-100`.
   - `enhanced-command-bus.ts:656-658` — double `Promise.race` per
     concurrency-limited batch step.
6. **VF-028 (high)**: hardcoded `jitter: false` in both CQRS buses bypasses
   `RetryPolicy` default; no public `resilience.retry.jitter` override. Its own
   task says AC1 preferred pre-publish.
7. **`domain-services` disabled e2e suite** (see verified facts) — untested
   functionality surface, self-documented.

### S3 — friction & polish

8. `forRoot()` bridges tokens but provides no working buses — ~6 manual
   moving parts before first success on the most critical consumer journey
   (NestJS). Now well-documented (`vytches-ddd.module.ts:71-99`), still heavy.
9. Migration story fragmented: `MIGRATION.md` omits the two biggest alpha
   breaks (VP-009 tokens, BaseValueObject validate-throw); 5 package
   CHANGELOGs have circular "see CHANGELOG.md" pointers (di, policies,
   domain-services, acl, validation).
10. JSDoc: zero class-level docs on `BaseValueObject` and `EntityId` (the two
    most-subclassed exports); `domain-primitives` sampled 0/5 documented.
11. Dead public surface: `packages/nestjs/src/types/{index,extended}.ts` —
    zero importers, still compiled into dist types (unchanged since July).
12. Examples: 4/19 packages covered (quickstart, policies, domain-services,
    nestjs). Still missing: repositories/UoW, outbox, CQRS+resilience combo.
13. Duplicate ADR numbering (two ADR-0019 files); root `package.json` still
    `0.26.0` vs packages `0.31.0-alpha.0` (private, but confusing signal).
14. `events/README.md` quick start leads with the integration-pipeline
    subsystem that has no real internal consumers — misrepresents what is
    battle-tested.

## Strengths worth keeping/replicating

- `packages/enterprise/src/index.ts` — model explicit barrel, zero `export *`,
  in-file collision documentation; api-surface snapshot tests across all 19
  packages.
- Retroactive breaking-change documentation in root CHANGELOG (self-audit grep
  command, "you are affected if", two migration snippets) — above-industry bar.
- `examples/nestjs/tests/wiring.test.ts` — regression test that encodes a real
  production incident; the model to replicate.
- Zero-install StackBlitz onboarding + consumer LLM-bundle tooling —
  genuinely differentiated AI-first DX.
- Deliberate perf iteration: VP-006/VP-006b fixes confirmed implemented as
  designed; `sideEffects: false` everywhere; meta-package is a true re-export
  shim (13.6 KB raw / 3.5 KB gzip).

## Ranked action plan

**Quick wins (hours, highest trust payoff):**
1. Quickstart aggregate → `Result<T,E>` (S1-2).
2. Mechanical sweep of phantom `ddd-logging` across ~13 files (S1-1).
3. Fix 4 broken README samples by copying from LLMGUIDEs (S1-3) + bump root
   README status line (S1-4).
4. VP-012 as one PR (three scoped fixes, zero public API change) (S2-5).
5. Fix 5 circular CHANGELOG pointers; extend MIGRATION.md with VP-009 +
   BaseValueObject breaks and link it from README (S3-9).
6. Delete dead `nestjs/src/types/*` (S3-11); renumber ADR-0019 (S3-13).

**Medium (days):**
7. VF-028 AC1 (jitter default) before any non-alpha tag (S2-6).
8. JSDoc for BaseValueObject, EntityId, domain-primitives errors (S3-10).
9. README-vs-source drift check over remaining 14 packages + a docs-compile
   CI gate (proposed twice already; the ddd-logging leak proves it's needed).
   **Escalated same day (2026-08-08):** a downstream consumer reported
   `BaseValueObject.equals()` "ignoring" `getEqualityComponents()` — root cause
   was a docs-phantom API: the hook was shown in early
   `domain-primitives`/`value-objects` READMEs but never existed in any
   released source (removed from docs in `0ad22d88`, 2026-05). The consumer
   built ~170 subclasses on it; all were silently dead code, with wrong
   equality semantics wherever a VO deliberately excluded fields from
   identity. This is the concrete production cost of shipping uncompiled doc
   samples — the gate must also cover "documented API exists in source", not
   just "snippet compiles". Follow-up: VF-036 makes the phantom API real.
10. `forRoot()` convenience path wiring default buses, opt-out-able (S3-8).

**Larger (pre-1.0 credibility):**
11. Standing cross-context isolation regression suite (two rounds of
    "thought we fixed it" on the same bug class — VF-030 then VP-009).
12. Behavioral-BC-without-signature-change checklist entry in review/CI
    process (both recent silent breaks were this class).
13. 2-3 example workspaces: repositories+UoW, outbox processor,
    resilience-wrapped CQRS handler.
14. Re-enable/complete `domain-services` e2e suite; VT-006 policies coverage.

## What separates this from a stable (non-alpha) release

- External consumer validation sign-off (deferred per VF-023 completion note)
  not yet confirmed.
- High-priority backlog touching public API correctness: VF-028, VP-012,
  VT-006.
- Human-facing docs parity with LLMGUIDEs + docs-compile CI gate.
- No `pre-first-public-publish` gated tasks remain — strongest positive
  signal; the gap to stable is now trust and polish, not structure.
