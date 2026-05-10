# Team State — @vytches/ddd

_Last sync: 2026-05-10 (VT-coverage-marathon) by /pulse_ _Updated by `/pulse`.
Read-only for humans — agents write here._

---

## 🎯 Sprint Focus

Test-coverage marathon **complete** — VT-002..VT-005 series shipped today,
all merged to develop. Global library coverage 63.98% → **69.29%** (+5.3pp).
4 PRs, 11 new test files, ~3000 LOC tests, 0 regressions in 216+ existing
tests. Quality bar materially higher pre-v0.26.

**Publish chain unchanged**: REL-000 deadline **2026-05-12** (2 days) is the
only time-bound action. Code-side ~3.5h (REL-003 + REL-011 + smoke) once
maintainer registers npmjs.com org.

---

## 🔴 Critical Now

<!-- @tech-lead updates this section on /pulse -->

1. **REL-000 deadline 2026-05-12** — **2 days**. Manual npmjs.com org
   registration is the one human-gated action; missed window = publish drifts
   3-4 weeks. No code work needed — calendar problem.
2. **REL-003 / REL-011 still parked** — 3.5h once REL-000 unblocked. No code
   blockers.
3. **VP-004 formal drop pending** — flagged for 3rd consecutive pulse, scope
   contradicts no-adapters decision. Decide this session: drop or repurpose.

---

## 📱 Mobile Impact Pending

_N/A — this is a library project, no mobile UI._

---

## ⚙️ Technical Pulse

<!-- Updated by @tech-lead on 2026-05-10 -->

**Build/test**: PASS — 24 projects, ~330+ tests (VT-002..005 added 62), 0
failures, **coverage 69.29% (+5.3pp today)**.
**Debt**: MEDIUM (score 2.5) | Major: 1 (D-001, raw throws in EntityId) |
Minor: 3 | No new debt from VT series.
**Blocked chains**: 0 | Parked chain: REL-003 → REL-011 → publish (depth 2,
human gate at REL-000).
**Overdue**: 0 | **REL-000 deadline 2026-05-12 — 2 days remaining.**
**Stale (>14d)**: none — all tasks updated within 7 days.
**VP-004 decision pending**: scope contradicts no-adapters; 18h at risk.
Repurpose or drop before next session.

### What shipped today (VT coverage marathon, ~5h actual vs ~24h estimated)

- **VT-002**: foundation tier (aggregate-errors 100%, aggregate-utilities 89%,
  id.value-object 88%) — merge `2bb21800`
- **VT-003**: capabilities (audit/versioning/snapshot/event-sourcing all 90%+)
  — merge `b8b951a5`
- **VT-004**: integration layers + base-business-policy (95%+) — merge
  `c1ebb748`
- **VT-005**: DI base-adapter, discovery-registry, CQRS configuration — merge
  `1701df2d`

### Remaining backlog (8 active, all post-v0.25)

- VP-002 full scope (20h, partial done) | VP-003 (14h, unvalidated — validate
  with juz-ide-api before starting)
- **VP-004 (18h, DROP candidate per @product-owner — 3rd flag)**
- VP-006 full scope (16h, partial done) | VD-004 (20h, deferred)
- VF-001 full scope (24h, MVP done) | VF-002 (20h)
- Publish chain: REL-000 (human, <1h) → REL-003 (3h) → REL-011 (0.5h) parked

### Critical path to publish

REL-000 npmjs.com registration (human, <1h, **deadline 2026-05-12**) →
REL-003 (3h, code-only) → REL-011 (0.5h, CI wiring) → smoke test (1h) →
publish. **Total: ~5.5h once maintainer acts.**

### Velocity

VT-002..005 today: ~5h actual vs ~24h estimated (79% time saved). Marathon
cumulative: ~26h actual vs ~233h estimated. Board clean; next session:
REL-000 if maintainer available, else opportunistic VT-001 GWT migration or
domain-primitives ratio.

---

## 💼 Business Pulse

<!-- Updated by @product-owner on 2026-05-10 -->

**Next milestone**: Public publish to npmjs.org — clock: REL-000 human gate
expires **2026-05-12 (2 days)**.
**Code readiness**: High. Coverage 69.29% (+5.3pp today), 0 regressions,
publish chain is REL-003 (3h) + REL-011 (30min) after npmjs.org registration.
**Unvalidated features**: VP-003 (14h), VP-004 (18h) — 32h parked, no
consumer signal on either.
**Drop candidate**: VP-004 — contradicts no-adapters decision, flagged 3rd
consecutive pulse. Formally drop this session.
**Sequencing call**: REL-000 registration > REL-003 > README LLM-first reframe.
Positioning work is high-value but wrong order if publish misses the window.
**Validation this week**: Ask one juz-ide-api dev: "Hit outbox throughput
limits?" — 15 min prevents 14h VP-003 spend.

### Most important business insight today

**Coverage win is banked quality, not milestone progress.** VT-002..005
brought the global library coverage from 63.98% → 69.29% (+5.3pp) — that
removes a soft credibility blocker for v0.26 launch ("would I depend on a
library that's only 64% tested?"). But the milestone clock moves only when
npmjs.org registration happens.

**Highest-leverage next move: finish publish, then reposition.** A reframed
README with no published package helps no one. Don't let a 30-minute npm org
registration kill the milestone for the sake of a hours-not-days
README rewrite that can happen post-publish.

---

## 📝 Team Notes

<!-- Chronological, newest first. Format: [YYYY-MM-DD] @agent: insight -->

[2026-05-10] @tech-lead: REL-000 is the only human-gated action before publish.
Miss 2026-05-12 = publish drifts 3-4 weeks. VT-002..005 marathon shipped today
(~5h actual vs ~24h estimated, coverage +5.3pp); board clean for REL-000 push.
[2026-05-10] @product-owner: Coverage win is banked quality, not milestone
progress — milestone clock moves only when npmjs.org registration happens. Two
days left on REL-000 deadline. [2026-05-10] @product-owner: VP-004 must be
formally dropped this session — three pulses of flagging without action is
backlog debt. [2026-05-10] @testing-excellence: VT coverage marathon —
foundation, capabilities, integration layers, DI/CQRS configuration all moved
to >80%. Out-of-scope follow-ups (events/integration transformers, policies/
utils, seeder) documented in completed-tasks/VT-005 for potential VT-006.

[2026-05-09 PM] @product-owner: ddd-lint MVP (VF-001) is the most differentiated
deliverable to date — crosses from "build blocks" library into "correctness
enforcement" category. Lead with this in launch messaging. [2026-05-09 PM]
@product-owner: VP-004 should be repurposed or dropped — problem statement
contradicts no-adapters decision. [2026-05-09 PM] @product-owner: LLM-first
positioning still buried — must be section 1 of README before public launch.
[2026-05-09 PM] @tech-lead: 4 task files need frontmatter update — VT-001,
VP-006, VP-002, VF-001 all show `status: planned` but partial deliveries landed
today. [2026-05-09 PM] @tech-lead: VP-NEW-002 has no task file at all; if it
needs traceability, create a completed-tasks entry. KANBAN table referenced it
as 6h estimate; shipped in 30 min. [2026-05-09 PM] @tech-lead: Apply() perf
+21.7% on 100-event replay (~3.9M events/s) — material for launch marketing
benchmark numbers. [2026-05-09 PM] @testing-excellence: VT-001 work caught a
real production bug in outbox-processor (destructure inversion `[result, error]`
instead of `[error, result]`) — silently broke outbox processing globally. New
tests prevented regression.

---

[2026-05-09 AM] @product-owner: LLM-first angle is buried in README — biggest
positioning miss for v0.25-beta launch. [2026-05-09 AM] @product-owner: VP-003
and VP-004 are pre-emptive optimizations without consumer signal — keep parked,
validate with first user. [2026-05-09 AM] @product-owner: First-user question to
ask: "Did README+QUICK_START work, or did you open an LLMGUIDE.md?" [2026-05-09
AM] @tech-lead: REL-003 (publishConfig) is single soonest unblock — code-only,
3h, no credentials needed. [2026-05-09 AM] @tech-lead: REL-002 frontmatter stale
(status: planned but shipped) — pure bookkeeping fix. [2026-05-09 AM]
@tech-lead: 17 tasks completed in ~16h actual vs 127h estimated. Marathon ended
2026-05-09; board is clean. [2026-05-09] @pulse: Release prep complete.
Resumption point: /RELEASE-READINESS.md. [2026-04-03] @product-owner: VF-020
falsely marked complete — examples/ directory does not exist. — RESOLVED:
examples/quickstart now exists with 16 tests, plus examples/policies (17) and
examples/domain-services (17). [2026-04-03] @tech-lead: Critical path has no
task files — publish blockers exist only as prose. — RESOLVED: REL-\* tasks
created and 17 of 24 completed. [2026-04-03] @tech-lead: Build GREEN, tests
GREEN (1636 pass). Only blockers: publishConfig + version skew. — RESOLVED for
version skew (REL-004); publishConfig now REL-003 (parked).
