# Team State — @vytches/ddd

_Last sync: 2026-05-17 by /pulse_ _Updated by `/pulse`. Read-only for humans —
agents write here._

---

## 🎯 Sprint Focus

**Publish gate**: REL-000 deadline missed by 5 days. npmjs.com org registration
is the only action blocking v0.26.0 release. Code is fully ready (coverage
69.29%, 0 regressions, REL-003 + REL-011 parked and code-complete).

**Decision due**: VP-004 formally drop or repurpose — 3 pulses flagged, no
action. 18h scope at risk contradicting no-adapters policy.

---

## 🔴 Critical Now

<!-- @tech-lead updates this section on /pulse -->

1. **REL-000 OVERDUE — 5 days past deadline (2026-05-12)**. Maintainer must
   register `@vytches` org on npmjs.com (<1h). Scope confirmed free. Every day
   slips publish further — code is 100% ready.
2. **REL-003 / REL-011 parked and code-ready** — ~3.5h to publish once REL-000
   done. Zero technical blockers.
3. **VP-004 must be decided NOW** — 4th consecutive pulse without action. Drop
   or repurpose as 4h documentation task; 18h scope contradicts no-adapters
   policy and has zero consumer validation.

---

## 📱 Mobile Impact Pending

_N/A — this is a library project, no mobile UI._

---

## ⚙️ Technical Pulse

<!-- Updated by @tech-lead on 2026-05-17 -->

**Build/test**: PASS — 24 projects, ~330+ tests, 0 failures, coverage 69.29%
(stable post-VT marathon). **Debt**: MEDIUM (score 2.5) | Major: 1 (D-001,
EntityId raw throws) | Minor: 3 | No new debt added. **Blocked chains**: 0 code
blockers | Parked: REL-003 → REL-011 → publish (depth 2, awaiting REL-000 human
action). **Overdue**: 🔴 REL-000 deadline 2026-05-12 — **NOW 5 DAYS OVERDUE**.
**Stale (>14d)**: None — all active tasks updated within 7 days. **Critical
path**: REL-000 (registration, awaiting maintainer) → REL-003 (3h) → REL-011
(0.5h) → smoke → publish. Total: ~5.5h code-only once REL-000 done. **VP-004**:
4th consecutive pulse flag. 18h contradicts no-adapters. Drop or repurpose as 4h
docs task.

### Remaining backlog (11 active tasks)

| ID      | Scope                             | Est      | Notes                           |
| ------- | --------------------------------- | -------- | ------------------------------- |
| REL-000 | npmjs.com org registration        | <1h      | **5 DAYS OVERDUE — human gate** |
| REL-003 | publishConfig for 20 pkgs         | 3h       | Parked, code-ready              |
| REL-011 | GH Packages → npm migration       | 0.5h     | Parked, code-ready              |
| VT-001  | GWT migration + domain-primitives | ~4h rem  | In-progress                     |
| VP-002  | Repository caching + N+1          | ~15h rem | Partial done                    |
| VP-003  | Outbox optimization (Parts 2–3)   | ~3.5h    | Validated by juz-ide-api        |
| VP-004  | Event store streaming             | 18h      | **DROP CANDIDATE — 4th flag**   |
| VP-006  | DI cold-start perf                | ~8h rem  | Partial done                    |
| VF-001  | DDD compliance rule engine        | ~18h rem | MVP shipped                     |
| VF-002  | Strategic design docs             | 20h      | Planned                         |
| VD-004  | Docs site search/playground       | 20h      | Deferred                        |

### Critical path to publish

REL-000 (npmjs.com org registration, human, <1h, **5 DAYS OVERDUE**) → REL-003
(3h, code-only) → REL-011 (0.5h, CI wiring) → smoke test (1h) → publish.
**Total: ~5.5h once maintainer acts.**

### Velocity (stable)

Marathon: ~26h actual vs ~233h estimated (2026-05-09/10). Last 7 days:
docs/tests only. Opportunity: VT-001 GWT migration (~4h, opportunistic).

---

## 💼 Business Pulse

<!-- Updated by @product-owner on 2026-05-17 -->

**Next milestone**: Public npmjs.org publish (v0.26.0) — **BLOCKED on REL-000**.

**Deadline status**: REL-000 **MISSED 2026-05-12 by 5 days**. Code ready; human
gate pending. If registered this week → publish 2026-05-24 (1 week total slip).
If deferred to next week → publish early June (3–4 week total slip). Every day
delays erosion of the 5.3pp coverage momentum (2026-05-10).

**Code readiness**: High. Coverage 69.29%, 0 regressions. VP-003 Part 1 (docs)
merged pre-v0.26.0 (unblocks juz-ide-api). REL-003 + REL-011 parked,
code-complete.

**Validation status**:

- VP-003 (outbox tuning): VALIDATED ✅ — juz-ide-api migration analysis. Part 1
  shipped; Parts 2–3 deferred to v0.26.1 patch.
- VP-004 (event store streaming): UNVALIDATED ❌ — contradicts no-adapters
  policy. **Formal DROP this session** (4th flag). Repurpose as 4h docs task if
  demand surfaces post-publish.

**Segment gap**: Production-focused (juz-ide-api) ✅. Adoption/new-developer DX
severely underserved — CLI scaffolding, inline specs, GWT testing all deferred
(0% backlog coverage).

**Actions this week**:

1. Register npmjs.com org (<1h, unblocks entire publish chain)
2. Validate VP-003 Parts 2–3 with juz-ide-api dev (15 min)
3. Formally drop VP-004 — clarifies backlog scope

### Most important business insight

Publish window matters more than feature richness. The coverage win (69.29%)
removes the soft credibility blocker. npm visibility unlocks adoption. Don't
block a 30-minute registration for a README reframe that lands post-publish.

---

## 📝 Team Notes

<!-- Chronological, newest first. Format: [YYYY-MM-DD] @agent: insight -->

[2026-05-17] @tech-lead: REL-000 is 5 days overdue (deadline 2026-05-12). Scope
@vytches confirmed free on npmjs.com. Registration is the only human action; all
code is publish-ready. VP-004 must be decided (4th consecutive pulse flag) —
drop or repurpose as 4h docs task. [2026-05-17] @product-owner: If REL-000
registered this week, publish lands 2026-05-24 (1-week slip). If next week,
early June (3-4 week slip). VP-003 Parts 2-3 validated by juz-ide-api — schedule
as v0.26.1 fast-follow once confirmed in 15-min sync. VP-004 formal drop
clarifies scope; 18h was never grounded in consumer need.

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
