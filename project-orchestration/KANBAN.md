# Kanban — @vytches/ddd v0.25.0-beta.1

_Sequential execution list. Claude Code 24/7 — bottleneck is dependencies, not
hours._ _Created 2026-05-08. Target: `npm publish @vytches/ddd@0.25.0-beta.1`._
_Source roadmap: [ROADMAP-RELEASE-2026-05.md](./ROADMAP-RELEASE-2026-05.md)_

---

## How to read this file

- Tasks are listed **in execution order** — finish one before starting the next
- Each task has a **dependency reason** explaining why it comes here
- "✓ unblocks" lists what becomes possible after this task lands
- Total: **24 sequential steps, ~120h compute work**
- Strict order required for steps marked **🔒 BLOCKING** — others have soft
  ordering for clean diffs

---

## ⛓ Block 1: Foundation (must run first)

### 1. 🔒 REL-000 — Verify @vytches npm org availability (1h) — ✅ DECIDED 2026-05-08

**Why first**: every other task assumes `@vytches/ddd` will publish. If the
scope is unavailable, we waste 100+h before discovering it.

**Resolution**: scope `@vytches` is **FREE on npmjs.org** (HTTP 404 on direct
registry probe). ADR-0033 written. Manual npm.com registration **deferred** to
before Block 5 — non-blocking for Block 1–4 work.

**✓ unblocks**: REL-003, REL-011, all `package.json` references — proceed.

---

### 2. 🔒 REL-002 — Fix Nx project graph + validate:types (4h)

**Why second**: every quality gate (build, test, lint, type-check, prerelease)
fails until Nx works. No subsequent task can run its tests without this.

**Root cause known**: `.claude/worktrees/agent-*/package.json` files registered
as duplicate workspace projects. Add `!.claude/**` to `pnpm-workspace.yaml` +
clean empty `packages/cli/` skeleton.

**Acceptance**: `pnpm type-check`, `pnpm test:ci`, `pnpm validate:types` all
clean.

**✓ unblocks**: literally everything that runs CI.

---

### 3. 🔒 REL-008 — Break contracts → utils import cycle (7h)

**Why third**: `Result<T>` is consumed by ~all 21 packages. Moving it from
`utils` to `contracts` is a cross-package sweep — must happen **before** any
other API-touching work, otherwise we'll touch the same files twice.

**Scope**: move `LibUtils`/`Result` to `contracts`, update import paths in 21
packages, add re-export shim in `utils` for backwards compat, verify
`pnpm deps:circular` clean.

**✓ unblocks**: REL-005 (API cleanup will inherit corrected paths in barrels),
clean foundation for all subsequent refactors.

---

### 4. REL-001 — CLI cleanup + 10 missing LLMGUIDE.md (4h)

**Why fourth**: removes empty `packages/cli/` directory and dead scripts from
root `package.json`. Generates `LLMGUIDE.md` for 10 packages still missing it
(needed for REL-010 and REL-006). Doesn't touch APIs, can run any time after Nx
works.

**Builds on**: VF-013 (CLI package already gone), VF-014 (LLM docs infra),
DX-002 (repomix config).

**✓ unblocks**: REL-010 (LLM bundle pipeline references all 21 LLMGUIDE.md
files), REL-006 (README references LLMGUIDE files in `node_modules` per
package).

---

## ⛓ Block 2: API hardening — lock the surface

### 5. 🔒 REL-005 — Public API cleanup (12h)

**Why fifth**: API surface lock is the single biggest `npm publish` risk. After
this lands, semver bounds us. Must happen **before** examples (VD-002, VD-003)
and bundle work (VP-005), since both reference public symbols.

**Scope**:

- Remove 3 `@internal` symbols from `enterprise/src/index.ts:79,80,113`
- Replace `export *` with explicit names in `di`, `domain-services`, `testing`,
  `enterprise` (4 barrels)
- Add `EntityIdFactory` runtime deprecation warning (NOT removal — protects
  juz-ide-api smoke test)
- Add `api-surface.test.ts` snapshot test for every package (21 files)

**✓ unblocks**: stable surface for VD-002/VD-003 examples, VP-005 bundle work,
DX-NEW-001 StackBlitz pinning.

---

### 6. 🔒 REL-009 — Pattern correctness bugs (14h)

**Why sixth**: 4 confirmed bugs + 1 verification, each a behavior change. Doing
this **after** API surface lock means changes propagate cleanly through
already-locked exports. Must complete **before** examples are written, or
examples will be wrong.

**Scope** (revised after critical-reviewer):

1. Snapshot interface unify (`id` vs `aggregateId`)
2. ~~BaseValueObject.validate~~ (false positive, removed)
3. CommandBus/QueryBus error symmetry (verification only, ~30 min)
4. EnhancedCommandBus default-on retry → opt-in (BREAKING)
5. OrPolicyComposer aggregate violations
6. **BaseRepository.save() must call commit()** (most consequential)

**✓ unblocks**: VD-002/VD-003 examples reflect correct behavior; CHANGELOG
breaking-change entries finalized.

---

### 7. REL-007 — Security hardening (6h)

**Why seventh**: Independent of API/pattern work. Can run in parallel with
others conceptually, but in sequence here for deterministic state.

**Scope**: `deserializeIntegrationEvent` sanitization parity, AI SDK peerDeps
removal from `testing`, `.env.development` git removal, `sanitizeObject`
maxDepth, validation.rules.pattern JSDoc warning, AggregateRoot maxEvents.

**✓ unblocks**: clean `npm audit`, no peer-dep warnings during install (crucial
for DX-NEW-002 5-min validation).

---

### 8. VT-001 (pre-release subset) — Surface tests + flaky timer fixes (8h)

**Why eighth**: locks the surface from REL-005 with snapshot tests, removes
`describe.skip` blocks (red flag for OSS adopters), fixes 2 flaky timer tests
(`circuit-breaker.test.ts:118`, `cached-policy.test.ts:131`) before we add CI
gates that depend on green tests.

**Scope**: 21 `api-surface.test.ts` snapshots, standardize `.test.ts` vs
`.spec.ts` (lint rule), `vi.useFakeTimers()` for the 2 flaky tests, kill 3
`describe.skip` blocks in `domain-services/tests/di-integration/`.

**✓ unblocks**: deterministic CI for all subsequent work, including DX-NEW-002
which validates against CI.

---

## ⛓ Block 3: Content & infrastructure

### 9. REL-010 — LLM bundle pipeline (4h)

**Why ninth**: needs all 21 `LLMGUIDE.md` (REL-001) + locked API surface
(REL-005) + correct examples (REL-009). Adds 4 scripts to root `package.json`:
`llm:bundle`, `llm:context`, `llm:verify`, `llm:guides`. Adds `llm:verify` to
`prerelease` quality gate.

**✓ unblocks**: REL-006 (README "AI-Assisted Setup" section can reference
working `pnpm llm:bundle`), DX-NEW-002 (validation includes AI-assisted path).

---

### 10. VD-002 — Policies V2 examples (10h)

**Why tenth**: builds on stable API (REL-005, REL-009 #5 OrPolicyComposer fix).
8 examples + tests covering specifications, PolicyGroup, conditional,
event-driven, retry, cache, temporal, real-world shipping.

**✓ unblocks**: README examples section can deep-link to specific policy
patterns.

---

### 11. VD-003 — Domain Services examples (8h)

**Why eleventh**: same as VD-002 — needs stable API. **Descope candidate**: if
Block 2 takes longer than expected, defer this to v0.26.

**Scope**: 7 examples (order processing, payment orchestration, inventory, user
registration, service composition, transactions, testing).

**✓ unblocks**: nothing critical for beta — pure DX win.

---

### 12. VP-005 — Bundle size optimization (8h)

**Why twelfth**: needs API surface locked (REL-005 already replaced wildcard
exports in 4 barrels). Now applies subpath exports to `policies` (436KB → ≤250KB
main bundle), removes `dist/testing/` from `contracts`, updates
`bundle-size-monitor.js` baselines.

**✓ unblocks**: VP-NEW-001 baseline numbers are credible (post-tree-shaking).

---

### 13. VP-NEW-001 — Performance baseline + 3 zero-risk wins (5h)

**Why thirteenth**: bundle is settled (VP-005), API stable. Now we benchmark the
_final_ code, not a moving target. 5 hot paths benchmarked, baseline committed,
CI gate at ≥15% regression. Plus 3 quick wins (BaseEventBus shortcircuit,
cqrs-discovery memoize, FNV-1a hash for getCacheKey).

**✓ unblocks**: marketing copy can quote real numbers ("250K events/sec on Node
22").

---

## ⛓ Block 4: Documentation

### 14. REL-006 — README + QUICK_START rewrite (6h)

**Why fourteenth**: docs reflect _final_ code state — APIs locked (REL-005),
patterns fixed (REL-009), examples written (VD-002, VD-003), LLM workflow ready
(REL-010). Doing this earlier would mean rewriting twice.

**Scope**: README ≤250 lines, remove fictional packages, kill Saga section, add
"Design Decisions" + "AI-Assisted Setup", verify QUICK_START.md against current
code, document required tsconfig flags.

**✓ unblocks**: DX-NEW-001 StackBlitz workspace mirrors README example,
DX-NEW-002 validates the _new_ README walkthrough.

---

### 15. DX-NEW-001 — StackBlitz playground + badge (4h)

**Why fifteenth**: needs final README example (REL-006) so the badge link
matches what users read. Workspace pinned to `examples/quickstart/` once API
stable.

**✓ unblocks**: DX-NEW-002 validation can include StackBlitz path as one of the
entry points.

---

### 16. DX-NEW-002 — 5-min start validation (3h)

**Why sixteenth**: must validate against the _final_ docs (REL-006) and _final_
StackBlitz (DX-NEW-001) and _final_ peer deps (REL-007). Friction log fed back
as bug reports if any blocker found — but at this point everything should pass.

**Scope**: fresh `node:22-alpine` Docker, time `npm install @vytches/ddd` →
working test, friction inventory, `validate-quickstart.sh` + CI integration.

**✓ unblocks**: confident "≤5 min" claim in README + announcement.

---

## ⛓ Block 5: Versioning + publishing

### 17. CHANGELOG generation (2h)

**Why seventeenth**: all behavior changes from REL-005, REL-009, REL-007,
VP-NEW-001 are now committed. Run `conventional-changelog-cli` (in devDeps)
against full git history. Manually curate `## [0.25.0-beta.1]` BREAKING section.

**✓ unblocks**: REL-011 migration recipe references CHANGELOG entries.

---

### 18. 🔒 REL-004 — Unify versions + adopt Changesets (3h)

**Why eighteenth**: very last thing before publish prep. Reset all 21 packages
to `0.25.0-beta.1`, configure Changesets `fixed: [["@vytches/ddd-*"]]`. Doing
this earlier risks bumping again after every fix.

**Special**: nestjs `12.1.2` lapsus reset to `0.25.0-beta.1` here.

**✓ unblocks**: REL-003 publishConfig change against unified versions, REL-011
migration plan against single coherent version set.

---

### 19. 🔒 REL-003 — Switch publishConfig to public npm + provenance (3h)

**Why nineteenth**: changes every `package.json` `publishConfig`. After versions
are unified (REL-004) so we don't double-edit. Adds `--provenance` flag in
`publish-packages.sh` and `id-token: write` in `release.yml`.

**Acceptance**: dry-run `pnpm publish --registry=https://registry.npmjs.org`
succeeds for one package on a feature branch.

**✓ unblocks**: REL-011 cutover plan is technically possible.

---

### 20. 🔒 REL-011 — GitHub Packages → npm migration (3h)

**Why twentieth**: depends on REL-003 (publishConfig done) and REL-004 (version
unified). ADR + CHANGELOG migration recipe + `release.yml` cleanup (remove GH
Packages publish step). Does NOT publish yet — that's step 23.

**✓ unblocks**: clean publish path; consumers know what to expect.

---

## ⛓ Block 6: Verify + ship

### 21. 🔒 juz-ide-api smoke test (4h)

**Why twenty-first**: ground truth before public publish. Pack the library as a
tarball (`pnpm pack`), install in `juz-ide-api`, run all 16K tests.

**Acceptance**: zero test failures, no peer-dep warnings, no API breakage beyond
documented BREAKING entries.

**Failure protocol**: bug found → fix in library → return to step 21 (loop). Do
**not** publish until clean.

**✓ unblocks**: confidence to publish publicly.

---

### 22. CI dry-run publish (1h)

**Why twenty-second**: dry-run from CI environment, not local machine. Verifies
`NPM_TOKEN`, provenance signing, registry routing. Catches credential issues
before the real publish.

**Acceptance**: `pnpm publish --dry-run` from CI succeeds for all 21 packages.

---

### 23. 🚀 npm publish @vytches/ddd@0.25.0-beta.1 (1h)

**Why twenty-third**: the actual release. Trigger `release.yml` workflow. 21
packages publish to npmjs.org with provenance. GitHub Packages legacy versions
remain untouched (per REL-011 Option A).

**Acceptance**: `npm view @vytches/ddd@0.25.0-beta.1` returns the package
manifest. `npm install @vytches/ddd@0.25.0-beta.1` works on a clean machine with
no auth.

---

### 24. Announcement + monitoring (1h)

**Why last**: only after publish is verified. Pin a GitHub release, draft copy
for r/typescript, dev.to, HN, Twitter. Watch GitHub issues for first 24h.

**Acceptance**: announcement posted on at least 2 channels, monitoring active
for 48h.

---

## Sequential summary

| #   | Task                            | Effort | Cumulative | Blocking? |
| --- | ------------------------------- | ------ | ---------- | --------- |
| 1   | REL-000 npm org                 | 1h     | 1h         | 🔒        |
| 2   | REL-002 Nx graph                | 4h     | 5h         | 🔒        |
| 3   | REL-008 contracts→utils         | 7h     | 12h        | 🔒        |
| 4   | REL-001 CLI cleanup + LLMGUIDEs | 4h     | 16h        |           |
| 5   | REL-005 API cleanup             | 12h    | 28h        | 🔒        |
| 6   | REL-009 pattern bugs            | 14h    | 42h        | 🔒        |
| 7   | REL-007 security                | 6h     | 48h        |           |
| 8   | VT-001 surface tests            | 8h     | 56h        |           |
| 9   | REL-010 LLM bundle              | 4h     | 60h        |           |
| 10  | VD-002 policies examples        | 10h    | 70h        |           |
| 11  | VD-003 domain services examples | 8h     | 78h        | descope   |
| 12  | VP-005 bundle size              | 8h     | 86h        |           |
| 13  | VP-NEW-001 perf baseline        | 5h     | 91h        |           |
| 14  | REL-006 README rewrite          | 6h     | 97h        |           |
| 15  | DX-NEW-001 StackBlitz           | 4h     | 101h       |           |
| 16  | DX-NEW-002 5-min validation     | 3h     | 104h       |           |
| 17  | CHANGELOG                       | 2h     | 106h       |           |
| 18  | REL-004 version unification     | 3h     | 109h       | 🔒        |
| 19  | REL-003 publishConfig           | 3h     | 112h       | 🔒        |
| 20  | REL-011 GH→npm migration        | 3h     | 115h       | 🔒        |
| 21  | juz-ide-api smoke test          | 4h     | 119h       | 🔒        |
| 22  | CI dry-run                      | 1h     | 120h       |           |
| 23  | 🚀 publish                      | 1h     | 121h       | 🔒        |
| 24  | announcement                    | 1h     | 122h       |           |

**Total**: 122h sequential work. With Claude Code 24/7 at 70% efficiency ≈ 7-8
wall-clock days. Buffer for unforeseen: 2-3 days. **Realistic ship: ~10 days
from start.**

---

## Descope priority (if any block exceeds 2x estimate)

1. **VD-003** (step 11) → v0.26 (-8h)
2. **VP-NEW-001 part 2** (3 quick wins, keep baselines) → v0.26 (-3h)
3. **VD-002** (step 10) → v0.26 (-10h, last resort)
4. **DX-NEW-002 CI integration** (manual run only, no CI gate) (-1h)

---

## 🟡 Post-release backlog (v0.26+)

| ID            | Title                                                     | Effort |
| ------------- | --------------------------------------------------------- | ------ |
| VF-CANON-001  | Canonical patterns (Entity, DomainService, DomainFactory) | 8h     |
| VT-001 (full) | PBT + GWT migration                                       | 16h+   |
| VP-002        | Repository performance                                    | 20h    |
| VP-003        | Messaging outbox optimization                             | 14h    |
| VP-004        | Event store streaming (re-evaluate scope)                 | 18h    |
| VP-006        | DI container performance                                  | 16h    |
| VP-NEW-002    | apply() Object.create refactor                            | 6h     |
| VD-004        | Interactive documentation site                            | 20h    |
| VF-001        | DDD compliance validation tools                           | 24h    |
| VF-002        | Strategic design documentation                            | 20h    |
| (no ID)       | 1.0.0 promotion (after beta clean)                        | 4h     |

---

## ⚫ Cancelled / done

| ID     | Title                       | Reason                                     |
| ------ | --------------------------- | ------------------------------------------ |
| VI-001 | CLI Scaffolding Enhancement | Superseded by REL-001 (LLM-first pivot)    |
| VI-002 | Framework Bridge Patterns   | Substantially completed → completed-tasks/ |

---

## Status legend

- 🔒 **BLOCKING** — strict ordering required, do not parallelize or reorder
- **planned** — task file exists, not started
- **in_progress** — currently being worked on
- **blocked** — waiting on dependency
- **review** — implementation done, in PR review
- **completed** — merged + verified (move file to completed-tasks/)
