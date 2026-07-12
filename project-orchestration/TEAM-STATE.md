# Team State — @vytches/ddd

_Last sync: 2026-07-12 by `/pulse`_ _Updated by `/pulse`. Read-only for humans —
agents write here._

---

## 🎯 Sprint Focus

**v0.31.0 code scope is 100% COMPLETE** (confirmed 2026-07-12, correcting the
2026-07-03 pulse's framing). VS-006, VS-008, and VS-013 (app-logging removal)
are all `done` in `completed-tasks/` — VS-013 merged **2026-06-05**. The sole
remaining gate is **external validation against juz-ide-api** (237+ aggregates,
16K tests), which is **deliberately deferred to the user's manual sign-off
before any npm tag/release — by explicit prior authorization**, not a stalled or
forgotten task (confirmed in VF-023's completion note, 2026-07-11). Treat this
as a standing pre-release checklist item, not a red alert.

**Massive library-quality progress since the 2026-07-03 pulse** — two new audits
(SEC-AUDIT-2026-07-09, LIB-UX-AUDIT-2026-07-10) plus the pre-first-publish
pipeline itself, largely shipped in a 2026-07-10/11 concentrated push:

- **Pre-first-publish pipeline: DONE.** VF-024 (API surface curation), VF-023
  (DDD foundation guarantees — VO/AggregateRoot always-valid, **BREAKING
  CHANGE**), VF-031 (surface diet), VB-004 (outbox atomic claim) all shipped and
  archived. Only **VD-005** (docs truth cleanup) remains open from this batch.
- **Security audit findings**: VS-016 (crypto-random IDs, P0 cleared), VS-017
  (error serialization leakage), VS-018 (CQRS logging opt-in) — all done.
- **UX audit findings**: VF-026 (ddd-lint fixes + `ddd-005` rule), VF-029
  (EventBus integrity), VF-030 (DI token identity by reference, `ADR-0038`) —
  all done. VF-032/VF-033 (NestJS fluency, validation hardening) remain open.
- **VF-035** (composite-policy step-coverage bug, real production bug) shipped
  2026-07-11.
- **VP-006b** (NestJS adapter perf — registry-first resolve, lazy paramtypes
  cache, COW scopes) code merged to `develop` 2026-07-12 (`cf4029dd`), but its
  task file is still `backlog` in `project-orchestration/tasks/` — **metadata
  drift, needs `/task-tidy` to archive it.**

**Last P1 hardening item**: VF-028 (resilience correctness — jitter, decorator
state, HALF_OPEN probe gate).

---

## 🔴 Critical Now

<!-- @tech-lead updates this section on /pulse -->

1. **juz-ide-api manual validation — the sole v0.31.0 publication gate,
   deliberately deferred, not overdue.** All code work is done. Owner action
   needed only when ready to cut the release: run `build && test` on the 237+
   aggregate / 16K test consumer, then tag/publish. No deadline was ever set —
   do not treat this as slipping.
2. **Metadata drift: VP-006b merged to `develop` 2026-07-12 (`cf4029dd`) but
   task file still shows `status: backlog`** — run `/task-tidy` to move it to
   `completed-tasks/` and unblock a clean read of the active board next pulse.
3. **VF-028 is the last open P1** (resilience correctness — jitter wiring,
   per-instance decorator state, HALF_OPEN probe gate, 8h). Everything else in
   the pre-first-publish pipeline (VF-023/VF-024/VF-031/VB-004) and the two
   audit batches (SEC-AUDIT, LIB-UX-AUDIT) are done — only VD-005 (docs cleanup)
   and the P2/P3 backlog remain besides VF-028.

---

## 📱 Mobile Impact Pending

_N/A — this is a library project, no mobile UI._

---

## ⚙️ Technical Pulse

<!-- Updated by @tech-lead on 2026-07-12 -->

**Status**: 🟢 Green | **Velocity**: Sustained/high — pre-first-publish pipeline
cleared + two full audits (security, UX) landed in the 9 days since last pulse |
**Debt**: 🟢 LOW (0 major, 0 minor)

**Just landed (2026-07-05 → 2026-07-12)**, superseding the 2026-07-03 backlog
list below:

- **Pre-first-publish pipeline DONE**: VF-024 (API surface curation, 10 ACs),
  VF-023 (DDD foundation guarantees, 11 ACs, **BREAKING CHANGE**), VF-031
  (surface diet, 9/10 ACs — AC3 deferred to VF-032), VB-004 (outbox atomic
  claim) all shipped and archived. Only VD-005 (docs cleanup) remains open.
- **SEC-AUDIT-2026-07-09 findings**: VS-016 (crypto-random IDs, P0 cleared),
  VS-017 (error serialization leakage), VS-018 (CQRS logging opt-in) — done.
- **LIB-UX-AUDIT-2026-07-10 findings**: VF-026 (ddd-lint fixes + new `ddd-005`
  rule), VF-029 (EventBus integrity), VF-030 (DI token identity by reference,
  `ADR-0038`) — done. VF-032/VF-033 spawned, still open (P2).
- **VF-035** (composite-policy step-coverage bug — real production bug, all 3
  `createPolicyFromStep` switches now exhaustive) — done, commits `a880b32b` +
  `63a07593`.
- **VD-006a** (example-matrix generator + CI enforcement) — done, unblocked
  VD-006b (now active R&D).

**Metadata drift**: **VP-006b** (NestJS adapter perf — registry-first resolve,
lazy paramtypes cache, COW scopes) merged to `develop` **2026-07-12**
(`cf4029dd`) but its task file still reads `status: backlog` — run `/task-tidy`
to archive it. This is the only board/reality mismatch found.

**Active backlog** (16 task files, 0 blocked, 0 stale >14d):

- **P1**: VF-028 (8h, resilience correctness — last hardening item before the
  pipeline is fully clear)
- **P2**: VD-005 (8h, docs cleanup), VF-025 (14h, event-bus hardening), VP-012
  (6h, hotpath perf), VT-006 (10h, policies coverage), VD-006b (10h R&D,
  unblocked), VF-034 (4h, dead-code CI check), VF-032 (14h, NestJS fluency),
  VF-033 (6h, validation hardening, gated on VF-031's AC3 handoff — not a deep
  blocker), VP-006c (6h, unblocked by VP-006b)
- **Deliberately deferred, not stale**: VA-001 (44d, set aside 2026-07-11 until
  the P1 pipeline clears), VD-004 (56d), VF-002 (56d) — opportunistic
  post-v0.31.0.

**Blocked**: None. Dependency graph acyclic.

**Debt**: 0 major, 0 minor.

**Critical path**: (1) juz-ide-api manual validation → tag/publish v0.31.0 —
owner action, no outstanding code. (2) VF-028 clears the last P1. (3) VD-005
closes the pre-first-publish batch entirely.

**Coverage**: 69.29% (stable, VT-002..005 series 2026-05-10). VT-006 is
enrichment, not recovery.

---

## 💼 Business Pulse

<!-- Updated by @product-owner on 2026-07-12 -->

**Next milestone**: v0.31.0 (security hardening + DX polish) — **code scope is
100% complete**. Gap to publish is now purely the owner's manual juz-ide-api
sign-off (deliberately deferred by prior explicit authorization, not overdue —
correcting the 2026-07-03 pulse, which mistook the still-open external
validation for a stalled internal task). No deadline was ever set for it.

**Pre-first-publish pipeline: DONE** (VD-005 excepted). VF-023 (DDD foundation
guarantees, **BREAKING CHANGE**), VF-024 (API surface curation), VF-031 (surface
diet), VB-004 (outbox atomic claim) all shipped 2026-07-03→11. This closes out
the ~30-44h estimated 2026-07-03 — actual turned out well-scoped, no overruns
reported.

**Two full audits landed since 2026-07-03**: SEC-AUDIT-2026-07-09 (3 findings,
all closed: VS-016/017/018) and LIB-UX-AUDIT-2026-07-10 (5 findings, 3 closed:
VF-026/029/030, 2 still open as P2: VF-032/033). No audit finding is currently
blocking release — VF-028 (resilience correctness) is the last P1, unrelated to
the publish gate.

**Status drift (housekeeping only)**: VP-006b (NestJS adapter perf) merged to
`develop` 2026-07-12 but task file still `backlog` — flag for `/task-tidy`, no
business impact.

**Segment coverage**: unchanged from 2026-07-03. Production/scaling teams ~70%
served. First-time DDD adopters ~30% (VF-001 MVP shipped; VF-002 still deferred,
opportunistic post-release). AI-agent integrators 0% (VA-001 deliberately set
aside 2026-07-11 until the P1 pipeline clears — correct call, no demand signal
yet).

**Cut candidate if capacity tightens**: VD-004 (interactive docs, 20h,
opportunistic post-release) — unchanged recommendation.

**Validate this week**: no publication deadline is currently set; the
juz-ide-api sign-off happens whenever the owner is ready to cut the release —
frame as "ready when you are," not "overdue."

**Actions this week**:

1. Run `/task-tidy` to archive VP-006b (pure housekeeping).
2. Ship VF-028 (8h) to fully clear the P1 backlog.
3. When ready to publish: run juz-ide-api manual validation, then tag v0.31.0.

---

## 📝 Team Notes

<!-- Chronological, newest first. Format: [YYYY-MM-DD] @agent: insight -->

[2026-07-12] @pulse: 9-day sync gap. Corrected a material framing error carried
by the 2026-07-03 pulse: VS-013/VS-006/VS-008 were already `done` (VS-013 merged
2026-06-05!) — the "14+ days overdue" language conflated the closed removal task
with the still-open, _deliberately deferred_ juz-ide-api external validation.
Real news since 2026-07-03: pre-first-publish pipeline complete
(VF-023/VF-024/VF-031/VB-004), two full audits landed and mostly closed
(SEC-AUDIT-2026-07-09, LIB-UX-AUDIT-2026-07-10), VF-035 production bug fixed.
Health: 🟢 GREEN. Only action items: VF-028 (last P1) and a `/task-tidy` pass
for VP-006b metadata drift. No publication deadline is outstanding — the gate is
"whenever the owner runs the juz-ide-api check," not overdue work.

[2026-07-12] @tech-lead: 🟢 GREEN. 16 active tasks, 0 blocked, 0 stale, 0 debt.
Three recent merges (VD-006a, VF-030, VP-006b) plus the whole pre-publish
pipeline and two audits cleared since 2026-07-03. Sole hygiene gap: VP-006b task
file not archived despite code being merged (`cf4029dd`).

[2026-07-12] @product-owner: Milestone gap re-framed — code is done, only the
owner's manual juz-ide-api sign-off remains, and it was never on a deadline.
Pre-first-publish pipeline fully delivered on its 2026-07-03 estimate. Segment
coverage unchanged. No material cut candidate beyond already-deferred VD-004.

[2026-07-04] @human: Ran `/analyze-ddd VD-006` — 3-stage panel (architect →
library-quality-verifier → tech-lead synthesis) found the 8h estimate couldn't
cover both the mechanical generator (AC#2/#3) and the greenfield semantic-eval
R&D (AC#4, zero precedent in this repo). Approved split into VD-006a
(generator + CI enforcement, 8h) and VD-006b (semantic-eval harness + 2 pilots,
10h R&D, depends on VD-006a, explicit pass/fail exit criterion). Panel also
corrected an initial architect claim — `examples/policies` and
`examples/domain-services` DO already run in CI today (confirmed against a real
historical commit), narrowing VD-006a's scope versus the original estimate.
Original VD-006 task file marked `status: split`, kept as historical record;
task files created for both children. KANBAN/TEAM-STATE updated to reflect the
split.

[2026-07-03] @pulse: VD-007 (LLMGUIDE completeness, 11 packages) and VB-003
(forFeature DI wiring fix, BREAKING CHANGE) both shipped today — moved to
`completed-tasks/`. These clear preconditions for the next library-quality
phase: VF-024 (API surface curation) can now proceed. VS-013 juz-ide-api
validation is unchanged and now the sole item blocking v0.31.0 — **14+ days
overdue, zero recorded progress across 3 consecutive pulses**. VS-006/VS-008 now
7 days idle in `planned`. Health: 🟡 yellow — same bottleneck as 2026-07-01/02
(decision/attention on VS-013), not capability; library-quality work itself is
moving well.

[2026-07-03] @tech-lead: 🟡 YELLOW. Two audit-infrastructure tasks landed
(VD-007, VB-003) — unblocks VF-024 and the rest of the 7 LIB-AUDIT-2026-07-02
findings (~30-44h, all pre-first-publish-critical). VS-013 remains the single
publication blocker, still 14+ days overdue with no visible recovery plan. Debt
unchanged 0/0. No new stale/blocked tasks.

[2026-07-03] @product-owner: Milestone gap unchanged ~4-6d; VS-013 validation is
the only thing standing between now and v0.31.0. Pre-first-publish pipeline
(VD-005/VF-023/VF-024, ~30h) is well-sequenced and correctly gated as
publish-before-breaking-changes-lock-in. Segment coverage unchanged (prod/
scaling 70%, first-time adopters 30%, AI integrators 0% — all correctly
prioritized). No material cut candidate beyond already-deferred VD-004.

[2026-07-02] @human: Triaged the 3 stale in-progress tasks per pulse's repeated
request — closed all as `done`, moved to `completed-tasks/`. VP-002:
library-side scope (`IBatchRepository`, `MemoizedSpecification`) complete,
remaining items are adapter-author concerns per no-adapters principle, not
deferred work. VF-001: `@vytches/ddd-lint` MVP is a complete, dogfooded
deliverable; more rules are optional future expansion, not required follow-up.
VT-001: pre-release 100% done, post-release covered by VT-002..005 (69.29%
coverage); the task's own 2026-05-10 update already called remaining work
opportunistic/low-priority. None of the three were blocking anything — this was
pure status housekeeping, not new work.

[2026-07-01] @pulse: Second consecutive pulse with **zero movement** on the two
zero-blocker code tasks (VS-006/008) — 6 days idle since flagged as
recommended-next. VS-013 juz-ide-api gate now **14+ days overdue**, no recorded
attempt. VP-011 archival drift flagged twice, still not moved. VA-001 analysis
**approved** this cycle (13 decisions, 2 HIGH security fixes, threat model done)
but explicitly does not jump the v0.31.0 queue. Health: 🟡 yellow — bottleneck
is decision/attention, not capability.

[2026-07-01] @tech-lead: 🟡 YELLOW. VS-013 validation 14+ days overdue with no
visible recovery plan. VS-006/008 drifted from "ready to start immediately" to 6
days idle in `planned`. 3 stale in-progress tasks (VP-002, VF-001, VT-001, 53d)
still awaiting the defer/resume decision requested last pulse — unresolved a
second time. New: VP-011 `done` but not archived to `completed-tasks/` (metadata
hygiene gap). Debt unchanged 0/0.

[2026-07-01] @product-owner: Milestone gap ~4–6d, code scope unchanged but gate
risk rising with each unvalidated day. VA-001 analysis approved with 2 HIGH
security decisions locked in (mandatory `requiredPermission`, enforced
dispatcher order) — correctly held behind production validation, not started.
Segment coverage unchanged (prod/scaling 70%, first-time adopters 30%, AI
integrators 0%). No material cut candidate; VS-013 validation is not optional,
it's the publication gate.

[2026-06-30] @pulse: VS-007 + VS-015 shipped (commits `54ac0fef`, `f11f6f96`),
task files moved to `completed-tasks/`. Remaining v0.31.0 code work now ~1h:
VS-006 (CSV formula injection, DREAD 7) → VS-008 (deprecation suppress). Human
confirmed VS-006 as the recommended next task (highest DREAD, internal-only,
spec ready). Top risk unchanged: VS-013 juz-ide-api validation, now slipped 12+
days. 4 stale in-progress tasks (VP-002/006, VF-001, VT-001, 52d) still need
triage. 0 blocked, 0 tech debt (1× 15m cleanup candidate).

[2026-06-30] @tech-lead: VS-007 + VS-015 merged → remaining critical path is ~1h
code (VS-006 0.5h + VS-008 0.5h) plus the publication gate. Dependency depth 0;
both can start immediately. Stale 4 (52d) intentionally paused, not stuck —
confirm formal deferral. Debt 0/0; one 15m cleanup at
`resilience/metric-registry.ts:50` (raw Error → `.message`).

[2026-06-30] @product-owner: milestone gap ~5–7d. VS-007/VS-015 hardened
messaging diagnostics (warn-on-handler-replace + stack-trace preservation);
combined with VS-014 the library now has controllable + debuggable diagnostics
end-to-end. juz-ide-api VS-013 validation remains the publication blocker
(slipped) — run before any scope advances. No material cut candidate.

[2026-06-29] @pulse: VS-014 (configureDiagnostics) shipped — committed
`68d90f60`, merged `--no-ff` to develop `3d97ad62`, pushed origin. Both VETO
gates GO, README + ADR-0037 + TM-VS-014 included. Remaining v0.31.0 work now
~3–4h (VS-015 + VS-006/007/008). **Top risk unchanged and now 12+ days slipped:
VS-013 juz-ide-api validation** (publication gate). 4 stale in-progress tasks
(VP-002/006, VF-001, VT-001, 51d) still need triage. 0 blocked, 0 tech debt.

[2026-06-29] @tech-lead: VS-014 + VP-011 both merged → remaining critical path
~3–4h: validate VS-013 gate → VS-015 (1.5h) → VS-006/007/008 (1.5h) → publish
v0.31.0. Max chain depth 1; VS-015 can start immediately. VS-014 surfaced one
candidate cleanup (`resilience/metric-registry.ts:50` raw Error → `.message`) —
fold into VS-015. Debt 0/0.

[2026-06-29] @product-owner: VS-014 closes the DX gap VS-013 opened — enterprise
teams get silenceable/redirectable diagnostics. Milestone gap ~7–10d.
juz-ide-api VS-013 validation remains the publication blocker (slipped) — run it
before any scope advances. No material cut candidate; remaining work is small +
high-value.

[2026-06-17] @pulse: 5-day sync. VP-011 active on branch; metadata drift to fix.
Top risk: VS-013 juz-ide-api validation (publication gate) slipped 5 days. 4
stale in-progress tasks (VP-002/006, VF-001, VT-001, 39d) need triage. 0
blocked, 0 tech debt. ~10h to v0.31.0.

[2026-06-17] @tech-lead: VP-011 branch active — bump status `planned` →
`in_progress`. Critical path ~10h: VS-013 gate → VS-014 (5h) → VS-015 (1.5h) →
VS-006/007/008 (1.5h); VP-011 (2h) parallel. The 4 stale in-progress tasks all
shipped partial/MVP on 2026-05-09 with opportunistic remainder — formally defer
or resume. Debt 0/0.

[2026-06-17] @product-owner: milestone gap ~10–14d. VS-013 consumer validation
is the publication blocker and has slipped 5 days. VA-001 correctly backlogged:
concept-only, no demand signal until juz-ide-api production validation
(~2026-08/09). Cut VP-011 to v0.31.1 if capacity tight (VP-010 already shipped
`.unref()`).

[2026-06-12] @pulse: full sync after 2-week drift. Security sprint substantially
closed (VS-001..005 done, VP-009/010 merged). VS-013 logging pivot cancelled
VS-009/010/011/012. Remaining v0.31.0 work ~10h. Zero blocked tasks, 0 tech
debt. Top risk: VS-013 may break workspace-linked juz-ide-api — validate this
week.

[2026-06-12] @tech-lead: VS-013 removed the app-logging layer entirely →
VS-009/010/011/012 obsolete. VS-014 (diagnostics control API, 5h) now unblocked.
4 in-progress tasks (VP-002/006, VF-001, VT-001) stale 14+ days — triage needed.
Debt remains 0 major / 0 minor.

[2026-06-12] @product-owner: logging pivot is the headline — library exits "app
logging" space (would lose to Pino/Winston), keeps lean consumer-controllable
diagnostics. VS-014 closes the DX gap. v0.31.0-full ~1.5–2w out; gate is
juz-ide-api validation of VS-013 removal. Cut VP-011 to v0.31.1 if capacity
tight.

[2026-06-12] @library-expert: VP-009 + VP-010 closed — merged to develop (HEAD
eeb0fc66). VP-009: 3 bugi (findOwnModule traversal, GLOBAL_QUERY/COMMAND_BUS,
Symbol.for tokens) done; verifier WARN/no-VETO, 483 tests green. VP-010:
guardraile #1-#6 done; #7 skipped (low) → follow-up VP-011.

[2026-05-28] @tech-lead: VS-001 code shipped across 5 commits but task said
"planned" — status drift, bumped to "review". VS-002/003/004 complete. VS-005
(hash collision, auth-bypass at scale) is highest-urgency remaining item after
the masking stack ships.

[2026-05-28] @product-owner: VS-001..004 code-complete; v0.31.0-rc shippable
now. Sole gate is verifying/closing VS-001 (metadata drift). Backlog grew to
VS-009..012 (logging hardening) — all audit-driven. Validate rc against
juz-ide-api consumer build before v0.32.0 scoping.

[2026-05-26] @pulse: process gap surfaced — task status fields not updated
post-commit. Worth a Stop-hook or pre-commit reminder to sync task metadata.

[2026-05-26] @tech-lead: First full security audit complete. 8 findings
(VS-001..008), DREAD 4–13. All 4 critical/high logging findings touch the same
package (ddd-logging) — batch into single PR. VS-005 hash collision in
CachedPolicy is stealth authorization risk at scale. All findings are bugs.

[2026-05-26] @product-owner: VS-001 is highest-risk finding in library history
(DREAD 13, GDPR exposure). Fix ASAP. Bundle as v0.31.0-rc. LocalHero consumer
signal on v0.30.0 expected within days.

[2026-05-26] @pulse: v0.30.0 released. Security audit conducted. 8 VS-tasks
created. Total backlog: 18 active tasks.
