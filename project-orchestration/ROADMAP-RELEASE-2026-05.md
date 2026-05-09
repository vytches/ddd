# Roadmap → Public Release v0.25.0-beta.1

**Today**: 2026-05-08 (Friday) **Target**: 2026-05-31 (Sunday) —
`npm publish @vytches/ddd@0.25.0-beta.1` **Working window**: 23 calendar days,
~16 working days **Strategy**: ship as **0.25.0-beta.1** (not 1.0.0). Locking
semver requires 2–4 weeks of `juz-ide-api` consumer feedback first.

> **Revised 2026-05-08** after critical-reviewer cross-check vs
> `completed-tasks/`: several REL-\* tasks already partially built on prior work
> (VF-013, VF-014, VF-022). Some scope reduced, some expanded. Total effort
> ≈115h (was 109h). See "Revisions log" at the bottom.

---

## Why beta, not 1.0?

Three concrete API risks make `1.0.0` premature:

1. `@internal` symbols leaked through `enterprise` barrel (REL-005)
2. Long-deprecated APIs awaiting "next major" — that major is happening now
3. Wildcard `export *` could silently expose new internals after publication

Beta gives 2–4 weeks of consumer testing, then promote to `1.0.0` cleanly.

---

## Phase 0 — TODAY (2026-05-08)

| Task                                                       | Hours | Why now                            |
| ---------------------------------------------------------- | ----- | ---------------------------------- |
| **REL-000** Verify `@vytches` npm scope availability + 2FA | 1h    | Whole roadmap depends on this name |

If scope is unavailable, every reference to `@vytches/ddd` in tasks needs
revising — better to find out today than May 28.

---

## Phase 1 — Release infrastructure & blockers (Week 1: May 8–15)

**Goal**: every release-pipeline component works. No code is published yet.

| Task                                                                                             | Hours | Owner                  | Blocker for       |
| ------------------------------------------------------------------------------------------------ | ----- | ---------------------- | ----------------- |
| **REL-002** Fix Nx project graph (cause: `.claude/worktrees` not excluded from `pnpm-workspace`) | 4h    | engineering            | All quality gates |
| **REL-008** Break `contracts → utils` cycle (sweep 21 packages)                                  | 7h ⬆️ | engineering            | REL-005           |
| **REL-001** Final CLI cleanup + 10 missing LLMGUIDE.md                                           | 4h ⬇️ | engineering + DX       | REL-006, REL-010  |
| **REL-004** Unify versions + adopt Changesets                                                    | 3h    | engineering            | All publishing    |
| **REL-003** Switch publishConfig to public npm + provenance                                      | 3h    | engineering            | Publication       |
| **REL-007** Security hardening (3 blockers + 3 DoS)                                              | 6h    | security + engineering | Publication       |

**Subtotal**: 27 hours (was 28) **Done-when**: `pnpm prerelease` runs end-to-end
without errors on a feature branch.

### Daily cadence (suggested)

- **Fri May 8** — REL-000 npm org check (1h, **today**) + REL-002 (Nx graph,
  fast win since root cause is known: `.claude/worktrees` exclusion)
- **Mon May 11** — REL-008 (contracts→utils sweep, full day)
- **Tue May 12** — REL-001 (CLI cleanup + LLMGUIDE generators) + start REL-003
- **Wed May 13** — REL-004 versioning + finish REL-003 publishConfig
- **Thu May 14** — REL-007 security blockers
- **Fri May 15** — Phase 1 retro; verify `pnpm prerelease` green

---

## Phase 2 — API hardening & content (Week 2: May 16–22)

**Goal**: API surface is locked, docs are honest, consumers see polish.

| Task                                                                                                  | Hours  | Owner            | Notes                          |
| ----------------------------------------------------------------------------------------------------- | ------ | ---------------- | ------------------------------ |
| **REL-005** Public API cleanup (internal leaks, barrels; **EntityIdFactory deprecation NOT removal**) | 12h    | engineering      | Hard blocker                   |
| **REL-009** Pattern correctness bugs (4 confirmed + 1 verification)                                   | 14h ⬆️ | engineering      | Coupled with REL-006           |
| **REL-010** LLM bundle pipeline (4 scripts on existing infra)                                         | 4h ⬇️  | engineering + DX | Replaces CLI                   |
| **VD-002** Policies examples (8 examples + tests)                                                     | 10h    | DX               | Onboarding                     |
| **VD-003** Domain services examples (7 examples + tests)                                              | 8h     | DX               | Onboarding (descope candidate) |
| **VP-005** Bundle size: explicit exports + policies subpaths                                          | 8h     | engineering      | Tree-shaking                   |

**Subtotal**: 56 hours (unchanged — REL-009 grew, REL-010 shrank)

### Daily cadence (suggested)

- **Mon May 18** — REL-005 (API cleanup, biggest single piece) — full day
- **Tue May 19** — finish REL-005 + start REL-009 (pattern bugs are the longest)
- **Wed May 20** — REL-009 continued (Repository.save fix, OrPolicyComposer,
  retry defaults)
- **Thu May 21** — REL-009 finish; REL-010 LLM scripts (small)
- **Fri May 22** — VD-002 + VP-005 (parallel)
- **Sat-Sun May 23-24** — VD-003 buffer OR descope to v0.26

> **Risk**: REL-009 expansion (10h → 14h) eats into VD-003 buffer. **Pre-commit
> decision**: if Tuesday May 19 EOD shows REL-005 not 80%+ done, descope VD-003
> immediately to v0.26.

---

## Phase 3 — Content polish & beta release (Week 3: May 23–31)

**Goal**: ship `0.25.0-beta.1` to public npm.

| Task                                                                                      | Hours | Owner                  | Notes                            |
| ----------------------------------------------------------------------------------------- | ----- | ---------------------- | -------------------------------- |
| **REL-006** README + QUICK_START rewrite                                                  | 6h    | DX + writing           | Coupled with REL-005, REL-009    |
| **DX-NEW-001** StackBlitz playground + badge                                              | 4h    | DX                     | Killer DX feature                |
| **DX-NEW-002** 5-min start validation (fresh Docker, friction inventory, CI gate)         | 3h    | DX + QA                | Production-grade DX claim        |
| **VP-NEW-001** Perf baseline + 3 zero-risk runtime wins                                   | 5h    | engineering            | Marketing numbers + code quality |
| **VT-001 (pre-release subset)** API surface tests, fix flaky timers, kill `describe.skip` | 8h    | testing                | Quality gate                     |
| **CHANGELOG generation** (conventional-changelog-cli)                                     | 2h    | engineering            | Already in devDeps               |
| **Smoke test on `juz-ide-api`** — install beta, verify nothing breaks                     | 4h    | engineering + consumer | Ground truth                     |
| **`npm publish @vytches/ddd@0.25.0-beta.1`** — actual release                             | 1h    | release lead           | Big day                          |

**Subtotal**: 33 hours (was 25; added DX-NEW-002 + VP-NEW-001)

### Daily cadence (suggested)

- **Mon May 25** — REL-006 (README rewrite), VT-001 tests
- **Tue May 26** — DX-NEW-001 StackBlitz + CHANGELOG + VP-NEW-001 part 1
  (baselines)
- **Wed May 27** — VP-NEW-001 part 2 (3 quick wins) + DX-NEW-002 5-min
  validation
- **Thu May 28** — Smoke test on `juz-ide-api` (install local tarball, run all
  16K tests). Find anything? Fix Friday.
- **Fri May 29** — Bugfix day. Dry-run `npm publish` from CI.
- **Sat May 30** — Buffer + community announcement copy
- **Sun May 31** — `npm publish @vytches/ddd@0.25.0-beta.1` ✨
- **Early June** — Twitter / r/typescript / r/dotnet / Hacker News announcement

---

## Total effort estimate (revised 2026-05-08)

| Phase                                  | Hours    | Days @ 6h/day |
| -------------------------------------- | -------- | ------------- |
| Phase 0 (npm org check)                | 1h       | 0.5h today    |
| Phase 1 (infrastructure)               | 27h      | ~5 days       |
| Phase 2 (API + content)                | 56h      | ~9 days       |
| Phase 3 (release + DX/perf validation) | 33h      | ~5-6 days     |
| **Total**                              | **117h** | **~19 days**  |

Available: 16 working days + weekends. **Tighter than before but justified**:
the 8h addition (DX-NEW-002 + VP-NEW-001) buys a validated 5-min start guarantee
and credible perf numbers — both essential for a production-grade beta launch,
not pre-release nice-to-haves.

If overrun threatens the 2026-05-31 target, **descope priority** (already
pre-committed):

1. VD-003 Domain Services examples → v0.26 (-8h)
2. VP-NEW-001 part 2 (3 quick wins) → v0.26 (-3h, keep baselines only)
3. VD-002 → v0.26 if absolutely necessary (-10h)

---

## Post-release (June+) — v0.26 candidates

After v0.25 stabilizes (2–4 weeks of beta feedback):

| Task                                                                           | Source              | Effort |
| ------------------------------------------------------------------------------ | ------------------- | ------ |
| **1.0.0 promotion**                                                            | If beta lands clean | 4h     |
| **VF-CANON-001** Canonical patterns (Entity, DomainService, DomainFactory)     | DDD audit           | 8h     |
| **VT-001 full** Property-based testing + GWT migration                         | Testing audit       | 16h+   |
| **VP-005 runtime** Hot path optimizations (`apply`, `getCacheKey`, reflection) | Perf audit          | 12h    |
| **VP-006** DI container performance                                            | Work-items archive  | 16h    |
| **VP-002** Repository performance                                              | Work-items archive  | 20h    |
| **VP-003** Messaging outbox optimization                                       | Work-items archive  | 14h    |
| **VP-004** Event store streaming (re-evaluate scope)                           | Work-items archive  | 18h    |
| **VD-004** Interactive documentation site (or smaller alternatives)            | Work-items archive  | 20h    |
| **VF-001** DDD compliance validation tools                                     | Work-items archive  | 24h    |
| **VF-002** Strategic design docs                                               | Work-items archive  | 20h    |

---

## Cancelled / superseded

- **VI-001 CLI Scaffolding Enhancement** — superseded by REL-001 (LLM-first
  pivot). See `work-items/VI-001-cli-enhancement.md` for historical record.
- **VI-002 Framework Bridge Patterns** — already substantially completed, moved
  to `completed-tasks/`.

---

## Risk register

| Risk                                          | Probability | Impact | Mitigation                                                                      |
| --------------------------------------------- | ----------- | ------ | ------------------------------------------------------------------------------- |
| REL-002 Nx graph fix takes >1 day             | low         | high   | Root cause known (`.claude/worktrees` exclusion); 4h max                        |
| `juz-ide-api` smoke test breaks on beta       | medium      | high   | Run smoke test on Wed (May 27) — gives 4 days to fix                            |
| `@vytches` org name not free on npm           | low         | high   | REL-000 today — fallback names ready                                            |
| REL-005 API cleanup reveals deeper API issues | medium      | medium | EntityIdFactory deprecation-only (not deletion) — limits blast radius           |
| REL-005/REL-008 trigger consumer breakage     | medium      | high   | Result<T> move adds re-export shim in utils for backwards compat                |
| Phase 2 56h in 5 days too aggressive          | high        | medium | Pre-committed: descope VD-003 → v0.26 if Tue May 19 EOD shows REL-005 <80% done |
| REL-009 expansion reveals more bugs           | medium      | medium | 1h buffer included; if more found, downgrade non-critical to v0.26              |

---

## Definition of release-ready

The library is ready for `npm publish @vytches/ddd@0.25.0-beta.1` when:

- [ ] `pnpm prerelease` is green
- [ ] All 21 packages publish dry-run succeeds against npmjs registry
- [ ] `juz-ide-api` smoke test (16K consumer tests) passes against the beta
      tarball
- [ ] README first 30 lines: install command + StackBlitz badge + 15-line
      example, all working
- [ ] CHANGELOG `## [0.25.0-beta.1]` lists every breaking change
- [ ] AI-assistant integration verified: pasted `dist/llm-context.md` into
      Claude Code generates a working aggregate

---

## Open questions to resolve this week

1. **NPM org availability** — REL-000 ✅ scheduled today (was open).
2. **VP-004 scope** (event store streaming) — confirm post-release relevance
   given "no adapters" decision.
3. **VD-003 scope** (canonical `DomainService` class) — include or split into
   separate task?
4. **Beta announcement channels** — Twitter, r/typescript, r/dotnet, HN, dev.to?
   Plan content + timing.
5. **Backwards compatibility budget** — REL-009 fixes 5 patterns.
   EntityIdFactory stays deprecated (not removed) — but other 5 changes could
   still hit `juz-ide-api` heavy users. Stage them OR document migration path
   clearly?

---

## Revisions log

### 2026-05-08 — Critical reviewer cross-check (Pol/Eng mixed)

After comparing 11 REL-\* tasks against 26 `completed-tasks/` and grep'ing the
current code, the following changes were applied:

- **REL-001 CLI deprecation: 8h → 4h.** `packages/cli/` already empty; VF-013
  removed the package. Remaining work: directory cleanup + 10 missing
  LLMGUIDE.md (most infra exists from VF-014/DX-002).
- **REL-010 LLM bundle pipeline: 8h → 4h.** 60% of infrastructure already exists
  (`docs/llm-context.md`, `verify-llm-context.mjs`, `repomix.config.json`,
  `jsdoc-generator.js`). Remaining: 4 new scripts + missing LLMGUIDE.md.
- **REL-008 contracts→utils cycle: 4h → 7h.** `Result<T>` is consumed by ~all 21
  packages, so move requires sweep + backwards-compat shim in `utils`.
- **REL-009 pattern bugs: 10h → 14h.**
  - **#2 (BaseValueObject.validate not auto-invoked) — REMOVED.** Code does not
    have abstract `validate()` any more (VF-022 fixed VO mutability).
  - **#3 (CommandBus vs QueryBus asymmetry) — REDUCED to 1h verification** (both
    throw `HandlerNotFoundError`; `CQRSConfigurationError` is for a different
    scenario).
  - **#6 (Repository.save without commit()) — PROMOTED** to first-class fix
    (most consequential bug — silent re-emit of events on second save).
  - Effort breakdown added per sub-fix.
- **REL-005 EntityIdFactory removal: SPLIT into deprecation + later removal.**
  Hard removal in beta would break `juz-ide-api` (237+ aggregates likely use
  it). v0.25.0-beta.1 adds runtime `console.warn`; v1.0.0 (post smoke test)
  removes the class.
- **REL-007 #5 (sanitizeObject "unbounded") — REPHRASED.** Sanitizer IS present
  (handles prototype pollution, 1MB cap on class deserializer). Only recursion
  `maxDepth` is missing.
- **REL-002 root cause — FOUND.** `.claude/worktrees/agent-*/` directories
  contain `package.json` files; `pnpm-workspace.yaml` includes `packages/**` but
  does not exclude `.claude/worktrees`. Fast fix.
- **REL-000 added (1h, today).** NPM `@vytches` scope availability check — the
  dependency the entire roadmap rests on.

### Net effect (round 1)

Total effort essentially unchanged (109h ≈ 109h). Distribution shifted: Phase 1
lighter (more reuse from prior work), Phase 2 heavier (true scope of bug fixes
revealed). One critical risk neutralized (EntityIdFactory hard removal moved to
post-smoke-test).

### 2026-05-08 — Round 2: production-quality additions

User decision: "I want to ship the best product, a production library — if
something is important, add it now."

Two pre-release additions:

- **DX-NEW-002 (3h)** — 5-minute start validation on fresh Docker container,
  friction inventory, CI-gated regression. Without this the "<5 min" claim in
  README is unproven marketing copy. Production-grade DX requires measurement.
- **VP-NEW-001 (5h)** — performance baselines (vitest bench for 5 hot paths, CI
  gate at ≥15% regression) + 3 zero-risk quick wins (BaseEventBus shortcircuit,
  cqrs-discovery memoize, EnhancedQueryBus FNV-1a hash). Without baselines we
  cannot publish credible perf numbers in beta announcement.

The deeper runtime perf wins (`apply()` Object.create, auto-discovery
single-pass) remain post-release in VP-NEW-002 / VP-006 — they touch the hottest
code paths and need careful migration windows.

Total: 109h → **117h**. Tighter timeline; descope priority pre-committed (VD-003
→ VP-NEW-001 part 2 → VD-002).
