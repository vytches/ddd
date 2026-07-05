# Team State — @vytches/ddd

_Last sync: 2026-07-03 by `/pulse`_ _Updated by `/pulse`. Read-only for humans —
agents write here._

---

## 🎯 Sprint Focus

**Security sprint substantially CLOSED.** Masking stack (VS-001..004) done
2026-05-27..28; VS-005 (hash-collision auth-bypass) closed 2026-06-12; NestJS
CQRS cascade VP-009 + VP-010 merged to develop 2026-06-12.

**Logging strategy pivot (VS-013, merged 2026-06-05).** Application-logging
layer **removed** — library logger is now `@internal` diagnostics only, NOT an
app logging layer. This **cancelled** VS-009/010/011/012 as obsolete. Reinforces
"most comprehensive lean DDD library" positioning without competing against
Pino/Winston.

**Just shipped (2026-07-03):** **VD-007 + VB-003 DONE** — both moved to
`completed-tasks/`. VD-007: LLMGUIDE.md completeness pass, 300+ previously
undocumented exports closed across 11 packages (5 `/orchestrate-ddd` batches,
verified via 11-agent independent re-audit — zero gaps remaining). VB-003:
`forFeature()` DI wiring fix (**BREAKING CHANGE** — stops cross-context event
leak, F-C4). These are library-quality/audit infrastructure, not v0.31.0
publication-path code — they unblock VF-024 (API surface curation) to proceed
next.

**Previously shipped:** VS-007 + VS-015 DONE (commits `54ac0fef`, `f11f6f96`).
VS-014 (configureDiagnostics) + VP-011 (dispose on onModuleDestroy) landed
earlier.

**Next target**: v0.31.0 full — ~1h remaining across two small audit findings:
**VS-006** (CSV formula injection, 0.5h) + **VS-008** (deprecation suppress,
0.5h). Both `planned`, now **7 days** with zero activity. Publication gate:
**juz-ide-api validation of the VS-013 logging removal** (still open, now
slipped **14+ days** — highest-risk item on the board). VS-007/014/015 + VP-011
are off the remaining-work list.

---

## 🔴 Critical Now

<!-- @tech-lead updates this section on /pulse -->

1. **VALIDATE VS-013 against juz-ide-api (PUBLICATION BLOCKER)** — application-
   logging layer was removed (merged 2026-06-05). If the consumer is workspace-
   linked, removal of `@vytches/ddd-logging` is breaking immediately. Confirm
   237+ aggregates `build && test` green by **2026-07-05** — this is the
   publication gate for v0.31.0 and has now slipped **14+ days** since first
   flagged (2026-06-17), with zero recorded progress. Single highest-risk item
   on the board.
2. **VS-006 + VS-008 still `planned`, zero activity for 7 days** — both
   zero-blocker, ~1h combined (VS-006 CSV formula-injection guard DREAD 7,
   VS-008 deprecation suppress). Move to `in_progress` and ship — last code
   items before v0.31.0 publish. Bottleneck is clarity/prioritization, not a
   technical blocker.
3. **Choose scope for the pre-first-publish pipeline** — VD-007 and VB-003 (both
   DONE 2026-07-03) were preconditions for library-quality work to proceed;
   VF-024 (API surface curation, 10h) can now start, followed by/ batched with
   VB-004 (6h), VF-023 (12h), VF-025 (14h — normal priority). ~30-44h combined,
   all pre-first-public-publish only (become breaking changes after release). No
   blocker, just needs a sequencing decision.

---

## 📱 Mobile Impact Pending

_N/A — this is a library project, no mobile UI._

---

## ⚙️ Technical Pulse

<!-- Updated by @tech-lead on 2026-07-03 -->

**Status**: 🟡 Yellow | **Velocity**: Momentarily accelerating — two
analysis-driven audit tasks just landed (VD-007, VB-003) + 7 backlog findings
from LIB-AUDIT-2026-07-02 now unblocked | **Debt**: 0 major / 0 minor

**Just landed** (2026-07-03):

- **VD-007 DONE**: LLMGUIDE.md completeness pass across 11 packages (300+
  undocumented exports now documented); 5-batch `/orchestrate-ddd` run + 11
  parallel verification agents, zero zero-mention symbols remaining. Commits
  `f62e7cdf`, `6b570f21`, `025c1312` on
  `feature/VD-007-llmguide-completeness-pass`. Pre-commit hooks green (283
  tests, 16 files, 22 Nx projects).
- **VB-003 DONE**: NestJS `forFeature` DI wiring critical fix (F-C4:
  `ModulesContainer` leak stopped cross-context event dispatch; 215/215 tests
  green). **Breaking change** (stops cross-context event leak) — flag in
  changelog. Staged, not yet merged.

**Active development**: None in-progress. 13 tasks in backlog:

- **Pre-first-publish critical**: VB-004 (6h, outbox atomic claim + timer
  leaks), VF-023 (12h, VO/AggregateRoot always-valid + apply atomicity), VF-024
  (10h, API barrel curation + name collisions), VF-025 (14h, event-bus
  hardening + projections), VD-005 (8h, docs drift cleanup).
- **Post-first-publish**: VP-012 (6h, hotpath perf), VT-006 (10h, policies
  decorators + testing deepEqual coverage).
- **Research/follow-up**: **VD-006a done** 2026-07-05 (generator + CI
  enforcement — commit `ff985aa9` on `feature/VD-006a-example-matrix-generator`,
  not yet pushed/PR'd; moved to `completed-tasks/`). **VD-006b** (10h R&D,
  semantic combination-sanity evaluator + pilots) now unblocked — its dependency
  on VD-006a's manifest `level` field is satisfied. VF-026 (5h, ddd-lint
  anti-pattern rules — fanout-in-handler, deep-import, plus wiring ddd:lint into
  CI as informational, added 2026-07-04).
- **Gated by entry conditions**: VA-001 (awaiting juz-ide-api production
  validation ~2026-08/09); VP-006b (best after VP-006 lands).
- **Opportunistic, explicitly deferred**: VD-004, VF-002.

Two zero-blocker ~1h tasks (VS-006, VS-008) have sat `planned` for 7 days with
no activity.

**Blocked**: None. Dependency graph acyclic; VB-003 + VD-007 completion unblocks
VF-026 and downstream audit tasks.

**Stale**: None. VD-004 and VF-002 are 55 days without update but explicitly
deferred as opportunistic post-v0.31.0 (moved `planned` → `backlog` 2026-07-02),
not stale. VP-002/VF-001/VT-001/VP-011 resolved 2026-07-01/02.

**Debt**: 0 major, 0 minor. One 15m cleanup candidate carried forward:
`resilience/metric-registry.ts:50` raw `Error` vs `.message` — rolled into
VP-012 scope.

**Critical path** (pre-v0.31.0 publication, ~1h code + gate):

1. **Validate VS-013 vs juz-ide-api** (publication gate — **14+ days overdue**,
   highest risk item on the board — ACTION REQUIRED THIS WEEK)
2. **VS-006** (0.5h) — CSV formula-injection guard (DREAD 7) — move to
   `in_progress`
3. **VS-008** (0.5h) — value-objects deprecation suppress
4. **Publish v0.31.0** → await consumer feedback before v0.32.0 scoping

**Critical path** (post-v0.31.0, library quality, ~30-44h): VF-024 (API
curation) unblocks library-api-guardian sign-off on the other findings; then
batch VB-004/VF-023/VF-025 or sequence by risk.

**Upcoming**: VA-001 (13 decisions approved, entry conditions unmet). VF-002/
VD-004 deferred, opportunistic.

**Coverage**: 69.29% (stable, VT-002..005 series 2026-05-10). VT-006 is
enrichment, not recovery.

---

## 💼 Business Pulse

<!-- Updated by @product-owner on 2026-07-03 -->

**Next milestone**: v0.31.0 (security hardening + DX polish) — **gap ~4–6 days**
(unchanged code scope, gate risk rising). Remaining: VS-006 (CSV formula
injection, 0.5h) + VS-008 (deprecation suppress, 0.5h) — ~1h combined, still
`planned`, 7 days idle.

**Critical validation now blocking publication gate**: VS-013 (application-
logging removal) against juz-ide-api (237+ aggregates, 16K tests). **14+ days
slipped** — if workspace-linked or peer-dependent on `@vytches/ddd-logging`,
removal is an immediate breaking change. **Must run green `build && test` by
2026-07-05 or publication slips another week.** No other technical blockers.

**Just shipped (2026-07-03)**:

- **VD-007 DONE** — LLMGUIDE.md completeness pass: 300+ undocumented exports
  across 11 packages now documented. Five sequential `/orchestrate-ddd` batches,
  all `GO`. Verification: 11 parallel Explore agents, zero zero-mention symbols
  remaining.
- **VB-003 DONE** — `forFeature` DI wiring fix (CRITICAL finding F-C4,
  cross-context event leak stopped). **BREAKING CHANGE** — flag as such in
  changelog, not plain `fix:`. 215/215 nestjs tests green; consumer validation
  confirmed safe (no juz-ide-api call-sites on the affected API). Follow-ups
  spawned: VF-026 (lint anti-pattern rules), VD-006 (example coverage matrix —
  split 2026-07-04 into VD-006a/VD-006b, see Technical Pulse).

**Pre-first-public-publish pipeline** (post-v0.31.0, ~7–10 days estimated, ~30h
combined): VD-005 (docs truth cleanup, 8h), VF-023 (DDD foundation guarantees —
always-valid VO/AggregateRoot atomicity, 12h, CRITICAL structural), VF-024 (API
surface curation — barrel + name collisions, 10h). All three are
pre-first-public-publish only — become breaking changes after initial release,
must ship before first npm publish.

**Validation record**: Zero speculative work. VA-001 (AI agent package, 13
decisions approved 2026-07-01) correctly gated behind production validation
(~2026-08/09) — does not jump queue.

**Segment coverage**: Production/scaling teams ~70% served. First-time DDD
adopters ~30% (VF-001 MVP shipped and closed 2026-07-02; VF-002 still deferred —
DX audit 2026-03-31 scored onboarding 4/10). AI-agent integrators 0% (VA-001
concept-approved, no demand signal yet — correct call, no premature investment).

**Cut candidate if capacity tightens**: VD-004 (interactive docs, 20h, already
opportunistic post-release). Do NOT cut the three pre-first-publish tasks
(VD-005/VF-023/VF-024) — deferral turns them into breaking changes.

**Unvalidated / research items**: VD-006 scoped via `/analyze-ddd` (2026-07-04)
and split — VD-006a (generator + CI, 8h) is now well-scoped like any other
mechanical task; **VD-006b** (semantic-eval evaluator + pilots, 10h) remains
genuinely unprecedented R&D, but is now bounded by an explicit pass/fail exit
criterion instead of an open-ended estimate. VF-025 (11 event-bus fixes, 14h,
post-publish but high blast radius — backward-compat decision still pending).

**Validate this week** (highest risk, now overdue): juz-ide-api build green past
VS-013. Target before 2026-07-05 or publication slips another week.

**Actions this week**:

1. Run VS-013 juz-ide-api validation (publication blocker, 14+ days overdue).
2. Ship VS-006 + VS-008 (~1h combined), then publish v0.31.0.
3. Decide sequencing for the pre-first-publish pipeline (VF-024 first — unblocks
   API sign-off on the rest).

---

## 📝 Team Notes

<!-- Chronological, newest first. Format: [YYYY-MM-DD] @agent: insight -->

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
