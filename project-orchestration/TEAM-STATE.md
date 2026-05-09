# Team State — @vytches/ddd

_Last sync: 2026-05-09 (post-marathon) by /pulse_ _Updated by `/pulse`.
Read-only for humans — agents write here._

---

## 🎯 Sprint Focus

Post-release marathon **complete** — 7 backlog tasks shipped in ~5h actual vs
~82h estimated. Code side now significantly stronger than at morning pulse:
+canonical Evans patterns, +18 JSDoc examples, +PBT, +outbox bug fix, +apply()
perf, +DI cold-start optimization, +N+1 contract, +ddd-lint MVP.

Publishing still parked (~3.5h maintainer work). Resumption point:
[`/RELEASE-READINESS.md`](../RELEASE-READINESS.md).

---

## 🔴 Critical Now

<!-- @tech-lead updates this section on /pulse -->

1. **REL-000 deadline 2026-05-12** — 3 days. npmjs.com manual registration is
   the one time-bound human action on the board. If skipped, no publish path.
2. **REL-003 / REL-011 unchanged** — still parked, still 3.5h to publish-ready
   once maintainer schedules.
3. **VP-004 scope review** — task contradicts no-adapters decision per
   @product-owner. Decide: repurpose, drop, or fold into VF-002 docs work.

_Frontmatter cleanup completed 2026-05-09 — VT-001, VP-006, VP-002, VF-001 all
marked `in_progress` with partial-delivery sections. VF-CANON-001 moved to
`completed-tasks/`. VP-NEW-002 completion record created._

---

## 📱 Mobile Impact Pending

_N/A — this is a library project, no mobile UI._

---

## ⚙️ Technical Pulse

<!-- Updated by @tech-lead on 2026-05-09 (post-session) -->

**Build/test**: PASS — 24 projects (was 23, +`@vytches/ddd-lint`), ~290+ tests,
0 failures, type-check 21/21 (was 20, +ddd-lint). **Debt**: 4 major prose items
(VP-002/003/004/006), no `tech_debt:` fields in YAML. **Blocked chains**: 0 |
Parked chain: REL-003 → REL-011 → publish (depth 2, human gate). **Overdue**: 0
| REL-000 deadline 2026-05-12 — 3 days. **Stale frontmatter (4 files)**: VT-001,
VP-006, VP-002, VF-001 — `status: planned` but partial work shipped today.

### What shipped today (post-morning-pulse, ~5h actual vs ~82h estimated)

- **VF-CANON-001**: Entity, PlainDomainService, IDomainFactory — task file
  current
- **JSDoc 18 symbols**: ad-hoc, no task file (TOP 20 public API in 4 packages)
- **VT-001 partial**: PBT (fast-check) + lifecycle (25 cases) + outbox bug fix
  (`[result, error]` destructure inversion in `outbox-processor.ts:104`)
- **VP-NEW-002**: apply() refactor — replay **+21.7%** (3.9M events/s), single
  +3.9%
- **VP-006 partial**: single-pass reflection (5 calls→1) + WeakSet memo
- **VP-002 partial**: IBatchRepository contract + MemoizedSpecification
- **VF-001 MVP**: ddd-lint CLI (3 rules, 29 tests, scans 458 files in ~200ms)

### Remaining backlog (8 active, all post-v0.25)

- VP-002 full scope (20h, partial done) | VP-003 (14h, unvalidated)
- VP-004 (18h, scope question — see Business Pulse) | VP-006 full scope (16h,
  partial done)
- VD-004 (20h, deferred) | VF-001 full scope (24h, MVP done) | VF-002 (20h)
- Publish chain: REL-003 + REL-011 parked

### Critical path to publish

REL-003 (3h, code-only, no npm credentials) → REL-011 (30 min) → npmjs.com
manual registration (maintainer, before 2026-05-12) → smoke test (1h) → publish.

### Velocity

Today's session: ~5h actual vs ~82h estimated (94% time saved via critical agent
reviews). Total marathon: ~21h actual vs ~209h estimated. Board is clean for
next session to start at REL-003 or frontmatter cleanup.

---

## 💼 Business Pulse

<!-- Updated by @product-owner on 2026-05-09 (post-marathon refresh) -->

**Next milestone**: Public publish to npmjs.org — ~1-2w if maintainer schedules
3.5h this week; drifts to 3-4w if REL-000 deadline (2026-05-12) passes without
action. **Code readiness**: Complete. 7 tasks shipped in 5h post-pulse session.
**Unvalidated features**: VP-003, VP-004 (no consumer signal — juz-ide-api rates
current performance "acceptable"). VP-004 scope may be invalidated by "no
adapters" decision — flag for repurposing or drop. **Segment gaps**:
LLM-assisted-dev teams are best-served technically but worst-served in
positioning. README buries `pnpm llm:bundle` and 21 LLMGUIDE.md files behind
conventional DDD pitch — biggest single conversion miss for 2026 adopters.
**Task to cut**: VP-004 (18h, expert) — scope contradicts "no adapters"
architectural decision. **Key validation question**: "Did you open README,
LLMGUIDE.md, or your AI assistant when you hit your first problem?" — determines
whether to invest in VD-004 (docs site) or richer LLM context.

### Most important business insight from today

**VF-001 MVP (ddd-lint) is the most differentiated deliverable to date.**

Until today, @vytches/ddd was a "comprehensive implementation" library — it
provided DDD building blocks but said nothing about whether the consumer was
using them correctly (table-stakes positioning in 2026; Nest CQRS does the
same). ddd-lint crosses into a different category: it **enforces correctness**.
No mainstream TypeScript DDD library ships static analysis flagging mutable
aggregate state, domain-layer exceptions, and non-Result factory methods.

Install story shifts from "here are the classes you need" to "here is the tool
that keeps your DDD architecture honest." Lead with this in launch messaging —
it is a positioning anchor that performance numbers and symbol counts cannot
match.

---

## 📝 Team Notes

<!-- Chronological, newest first. Format: [YYYY-MM-DD] @agent: insight -->

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
