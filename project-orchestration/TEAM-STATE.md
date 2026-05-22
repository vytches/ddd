# Team State — @vytches/ddd

_Last sync: 2026-05-22 by /pulse_ _Updated by `/pulse`. Read-only for humans —
agents write here._

---

## 🎯 Sprint Focus

**v0.26.0 IS LIVE on npmjs.org.** Release chain (REL-000/003/011) complete.
Today's housekeeping: VP-004 formally dropped, DOC-001 README accuracy audit
completed (17/20 packages had hallucinated APIs — now fixed on disk, publish
patch to sync npm).

**Next target**: v0.26.1 — VP-003 outbox hardening (Parts 2–4, 7.5h, production-validated).

---

## 🔴 Critical Now

<!-- @tech-lead updates this section on /pulse -->

1. **README fixes not yet on npm** — DOC-001 audit fixed 17/20 package READMEs
   locally. Publish a patch release (v0.26.1 or docs-only) to sync npmjs.org.
2. **VP-003 Parts 2–4 ready to start** — outbox backoff + type-filter + crash
   recovery + adaptive re-poll (7.5h total, production-validated). Unblocks
   consumer migration from dual-pollers.
3. **VT-001 GWT migration pending** — opportunistic, post-release polish.

---

## 📱 Mobile Impact Pending

_N/A — this is a library project, no mobile UI._

---

## ⚙️ Technical Pulse

<!-- Updated by @tech-lead on 2026-05-22 -->

**Build/test**: PASS — 24 projects, 69.29% coverage (stable). **Debt**: MEDIUM
(score 2.5) | Major: 1 (EntityId raw throws) | Minor: 3 | Stable.
**Blocked**: 0 code blockers. **Stale (>14d)**: None.

**Done today**: VP-004 DROPPED (moved to completed-tasks). DOC-001 README audit
complete — 17/20 READMEs had hallucinated APIs, all rewritten from src/index.ts.

### Active backlog (8 tasks)

| ID     | Scope                             | Est      | Notes                              |
| ------ | --------------------------------- | -------- | ---------------------------------- |
| VP-003 | Outbox Parts 2–4 (backoff+re-poll) | 7.5h    | Production-validated, ready to start |
| VT-001 | GWT migration + domain-primitives | ~4h rem  | Opportunistic post-publish         |
| VP-002 | Repository caching + N+1          | ~15h rem | Partial done; split into -a/-b rec |
| VP-006 | DI cold-start perf                | ~8h rem  | Partial done; split into -a/-b rec |
| VF-001 | DDD compliance rule engine        | ~18h rem | MVP shipped (3 rules); rest deferred |
| VF-002 | Strategic design docs             | 20h      | Planned; validate post-publish     |
| VD-004 | Docs site search/playground       | 20h      | Deferred; pending user signal      |
| VA-001 | ddd-agent AI boundary (concept)   | unknown  | Backlog; post-v0.27                |

### Velocity

Marathon: ~26h actual vs ~233h estimated. Last 12 days: docs/tests/audit.
Next action: VP-003 Parts 2–4 on feature branch.

---

## 💼 Business Pulse

<!-- Updated by @product-owner on 2026-05-22 -->

**Status**: v0.26.0 PUBLISHED ✅ on npmjs.org.

**Critical near-miss resolved**: DOC-001 — 17/20 package READMEs contained
hallucinated APIs (`SagaOrchestrator`, `AuthorizationService`, `EventStore`…
none exist). Fixed same day as publish. First real users avoided broken examples.

**Next milestone**: v0.26.1 — outbox production hardening (VP-003 Parts 2–4,
7.5h, production-validated). Unblocks consumer migration from custom dual-pollers.

**Validation status**:
- VP-003 (outbox tuning): VALIDATED ✅ — Parts 1 shipped; Parts 2–4 ready (7.5h).
- VP-004 (event store streaming): DROPPED ⛔ — 18h, no-adapters violation, zero consumer signal.
- VF-001 (ddd-lint MVP): SHIPPED ✅ — 3 rules + CLI, live.
- VF-002 (strategic design docs): PLANNED — defer to v0.27, validate post-publish signal.

**Segment coverage**:
- Production TypeScript/Node.js + DDD: 95% ✅
- First-time DDD adopters: 30% (VF-001 helps; VF-002 will unlock)
- NestJS shops: 60%
- AI-integrated systems: 5% (VA-001 concept, post-v0.27)

**Actions next 2 weeks**:
1. Publish patch (v0.26.1 or docs-only) to sync README fixes to npm
2. Start VP-003 Parts 2–4 on feature branch
3. Monitor first npm installs — gather DX friction signal for VF-002 prioritization

---

## 📝 Team Notes

<!-- Chronological, newest first. Format: [YYYY-MM-DD] @agent: insight -->

[2026-05-22] @tech-lead: v0.26.0 published. VP-004 dropped (moved to completed-tasks).
DOC-001 README audit done — 17/20 READMEs had hallucinated APIs, all rewritten.
Active backlog: 8 tasks. No blockers. Next: VP-003 Parts 2–4 feature branch.
[2026-05-22] @product-owner: README audit was a critical near-miss — fake APIs
live on npm same day as v0.26.0 publish. Fixed same day. VP-003 Parts 2–4 are
the highest-value next work (production-validated, unblocks consumer migration).
Segment gap: first-time DDD adopters underserved; monitor npm signal for VF-002.
[2026-05-17] @tech-lead: REL-000 is 5 days overdue (deadline 2026-05-12). All
code is publish-ready. VP-004 must be decided (4th consecutive pulse flag).
[2026-05-17] @product-owner: VP-003 Parts 2-3 validated by consumer — schedule
as v0.26.1 fast-follow. VP-004 formal drop clarifies scope.

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
