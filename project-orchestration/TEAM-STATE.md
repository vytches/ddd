# Team State — @vytches/ddd

_Last sync: 2026-08-27 by `/pulse`_ _Updated by `/pulse`. Read-only for humans —
agents write here._

---

## 🎯 Sprint Focus

**v0.31.0 shipped 2026-08-22** (npm `latest: 0.31.0`, all 19 packages, PR #87).
VF-036's AC-SIGNOFF gate was collected, `main` was reset to origin and `develop`
recreated from it — at that moment the two branches were genuinely in sync. **8
days on, they no longer are**: `develop` is now **15 commits ahead of `main`**,
carrying six shipped, verified fixes that real npm consumers on 0.31.0 do not
yet have — `VF-041` (missing `CircuitBreakerConfig`/`CircuitBreakerMetrics` type
exports), a `forRoot()`/`forTesting()` `options.exports` wiring fix in
`@vytches/ddd-nestjs`, **VF-033** (validation hardening), **VF-025**
(event/projections/resilience/cqrs patch hardening), **VB-008** (policy
behaviours), **VB-005** (benchmark harness repair). No task file or note records
a decision on when to cut the next release (patch or minor) — this is new since
the last pulse, not carried forward from it.

**Since the 2026-08-19 pulse (8 days)**, also landed and archived to
`completed-tasks/`: **VF-033**, **VF-025**, **VB-008**, **VB-005** (see above).
P1 board is now **empty** — VB-008 was demoted P1→P3 on 2026-08-23 once the
pre-publish urgency it was promoted under stopped applying, then shipped anyway.
VT-006/VT-007 (test debt) are top of P2 and the recommended next work.

**Open, non-blocking**: **VF-039b** (churn-guard) remains blocked on an
architecture decision — where the churn ledger lives (copy-adapted script vs.
shared module) — deprioritised 2026-08-19 in favor of higher-impact work, not
reassessed since. **VA-001**'s own demand-signal window
(`juz-ide-api scoping AI integration — expect attention ~2026-08/09`) is now
**18+ days expired with zero recorded check** — flagged "check this week" on
2026-08-19, still unchecked, second consecutive pulse cycle unresolved.

---

## 🔴 Critical Now

<!-- @tech-lead updates this section on /pulse -->

1. **`main` is 15 commits behind `develop` — six shipped fixes are not yet in
   the published npm package.** `main` and `develop` were genuinely in sync
   right after the 2026-08-22 v0.31.0 publish; every commit since then (`VF-041`
   type-export fix, an `nestjs` `forRoot()`/`forTesting()` exports fix,
   **VF-033**, **VF-025**, **VB-008**, **VB-005**) landed on `develop` only. No
   decision is recorded anywhere on when to cut the next release. This is new
   since the last pulse — not a carried-forward item.
2. **VF-039b blocked on an architecture decision** (where the churn ledger lives
   — copy-adapted script vs. shared module). Deprioritised 2026-08-19 in favor
   of higher-impact work; not reassessed since. Non-urgent, but genuinely stuck
   until someone answers the question.
3. **VA-001's demand-signal check is now 18+ days overdue and unresolved for the
   second consecutive pulse.** Its own task file names the trigger —
   `juz-ide-api scoping AI integration — expect attention ~2026-08/09` — and
   nobody has recorded whether that happened. Needs a direct maintainer
   question, not another silent cycle.

**Housekeeping (non-blocking)**: VT-007's `release_target` field still reads
`"before first non-alpha tag preferred"` — that tag shipped 2026-08-22; the
field describes a window that already closed and should be corrected to reflect
real post-publish stakes (untested e2e surface, real consumer). VF-025's
reserved follow-ups (`VF-025b/c/d`) have no task files yet — create them from
the analysis before anyone picks that work up.

---

## 📱 Mobile Impact Pending

_N/A — this is a library project, no mobile UI._

---

## ⚙️ Technical Pulse

<!-- Updated by @tech-lead on 2026-08-27 — scanned 14/14 active tasks, 8-day sync gap -->

**Status**: 🟢 GREEN, with one new fact worth attention: v0.31.0 shipped, P1
board is empty, all pre-publish gates cleared — but `main` has drifted 15
commits behind `develop` since publish day, and nobody has decided when to cut
the next release (see Critical Now #1). Zero blocked _task_ dependency chains
(VF-039b's block is an open architecture question, not an upstream task).

**Blocked chains**: 0 upstream task dependencies (no `dependencies:`/`blocks:`
fields exist in this project's schema, so this is computed from
prose/frontmatter cross-reference, not a graph). VF-039b is blocked on a design
decision, not another task.

**Since the 2026-08-19 pulse (8 days)**: v0.31.0 published 2026-08-22 (npm
`latest: 0.31.0`); VF-036 AC-SIGNOFF collected; **VF-033**, **VF-025**,
**VB-008**, **VB-005** all shipped and archived; the 2026-08-21 runtime series
(VF-032a/b et al.) archived. `main`↔`develop` were synced at publish, then
diverged again — see Critical Now #1 for the six-commit gap this opened.

**Stale (>14d)**: VD-004/VF-002 (148d, deliberate opportunistic hold — no
runtime value per 2026-08-09 owner directive), VA-001 (99d, deliberate hold on
an now-overdue demand signal — see Critical Now #3), VT-006 (56d, legitimately
queued as top of P2 with P1 empty). None forgotten — each is either a deliberate
hold or genuinely next-in-queue.

**Critical path (post-v0.31.0)**: none blocking publication — that gate is
closed. Two independent threads instead: (1) decide when to cut a release
carrying the six develop-only fixes, (2) VT-006/VT-007 (~10h combined, P2 test
debt) as the next scheduled work once someone picks it up.

**Debt**: 0 major, 0 minor (no `tech_debt:` fields declared in any task file —
schema limitation, not a claim that no debt exists).

**Housekeeping found this pulse**: VF-025's reserved follow-ups (`VF-025b/c/d`)
have no task files yet despite being named in the completed task's own
"Zamknięcie" section — create before picking that work up. VT-007's
`release_target` field is stale (describes a pre-publish window that already
closed). VA-001's demand-signal check is unresolved for a second consecutive
pulse cycle.

---

## 💼 Business Pulse

<!-- Updated by @product-owner on 2026-08-27 — scanned 14/14 tasks, 8-day sync gap -->

**Next milestone**: v0.31.0 already shipped (npm `latest: 0.31.0`, 2026-08-22).
No next milestone is named in any doc — 0 critical-path tasks remain from the
last stated one. Open question this pulse could not resolve from any doc:
whether the separately-named "juz-ide-api manual validation" gate (2026-08-19
wording) was folded into VF-036's AC-SIGNOFF before publish, or bypassed — worth
an explicit owner confirmation, not a pulse guess.

**Unvalidated features**: VD-004/VF-002 (already P3, unchanged). **New this
pulse**: VD-006b (10h R&D semantic-eval harness) — no task-file line cites a
customer or consumer asking for it; it exists because `/analyze-ddd` split it
out of VD-006, not because of demand. VA-001 remains correctly demand-gated, not
assumed — but see below, its gate has gone silent.

**Mobile UX**: N/A — library has no UI, no `mobile_impact` field in schema.

**Segment coverage** (qualitative — no `segment` field in schema): production/
scaling teams well-served (the whole runtime-hardening series —
VF-025/VF-028/VF-033/VB-005/VB-006/VB-007/VB-008/VP-012 — landed for them).
First-time DDD adopters underserved (VD-008/VD-009 at P2/P3). AI-agent
integrators 0% — VA-001 still `backlog`. **Material shift since 2026-08-19**:
"production/scaling" is no longer a hypothetical segment — v0.31.0 has at least
one real consumer running it in production, which raises the real cost of any
defect shipped to that lane, including the six fixes currently sitting on
`develop` unreleased (see Critical Now #1).

**Cut candidate if capacity tightens**: **VD-006b** — the most expensive
remaining discretionary item with the thinnest business justification; its own
dependency (VD-006a) already shipped the mechanical half of the original ask.

**Validate with the maintainer this week**: **VA-001** — its demand-signal
window (`~2026-08/09`) is now 18+ days expired with zero recorded check, the
second consecutive pulse cycle this has gone unresolved. Direct question: has
juz-ide-api actually started scoping AI integration? If yes, promote off
`backlog`; if no, re-date the deferral rather than leave it silently expired.

**Actions this week**:

1. Decide when to cut the next release (patch or minor) — six shipped fixes are
   sitting on `develop` unreleased since 2026-08-22.
2. Check with the maintainer whether VA-001's demand signal has actually
   materialized — second cycle this is unresolved.
3. Correct VT-007's stale `release_target` field (describes a window that
   already closed).
4. Create task files for VF-025's reserved follow-ups (`VF-025b/c/d`) before
   anyone picks that work up.

---

## 📝 Team Notes

<!-- Chronological, newest first. Format: [YYYY-MM-DD] @agent: insight -->

[2026-08-27] @human: Merged `fix/VB-005-benchmark-harness-broken` into `develop`
(fast-forward, no conflicts — `develop` had nothing new since the branch point)
and ran `/pulse`.

[2026-08-27] @pulse: 8-day sync gap (last pulse 2026-08-19). A lot shipped
without a status sync: v0.31.0 published to npm 2026-08-22 (all 19 packages, PR
#87), then VF-033/VF-025/VB-008/VB-005 all shipped and archived on top of that.
**Corrected a stale claim from @tech-lead's own draft this pulse**: it initially
reported `main`/`develop` as "synced post-release" — verified independently
(`git log main..develop` / `develop..main`) and found `develop` is actually 15
commits ahead of `main`, carrying six shipped fixes (VF-041 type-export fix, an
nestjs forRoot/forTesting exports fix, VF-033, VF-025, VB-008, VB-005) that are
not in the published npm package. The two branches _were_ genuinely synced right
at the 2026-08-22 publish moment — they just didn't stay that way, and nothing
recorded the drift until this pulse. Promoted to Critical Now #1. Health: 🟢
GREEN otherwise — P1 empty, zero blocked task dependencies, zero tech debt.
VA-001's demand-signal check is now unresolved for a second consecutive pulse
cycle — worth a direct maintainer question rather than a third silent cycle.

[2026-08-27] @tech-lead: 🟢 GREEN. P1 board empty, all pre-publish gates
cleared. VF-039b remains blocked on an architecture decision (churn-ledger
placement) — deprioritised, not urgent. VT-006/VT-007 (~10h combined) are the
recommended next work. Flagged VF-025b/c/d as reserved-but-unfiled follow-up
task files. (Initial draft claimed main/develop were synced post-release —
corrected by the pulse coordinator's independent git check; see the note above.)

[2026-08-27] @product-owner: No next milestone is named anywhere in the docs now
that v0.31.0 has shipped — flagging this as a gap rather than guessing a name.
New unvalidated-feature flag: VD-006b (10h R&D) has no cited demand. VT-007's
`release_target` field still describes a pre-publish urgency window that already
closed — a metadata correction, not just an observation. VA-001's demand-signal
check, due "this week" as of 2026-08-19, is still undone 8 days later.

[2026-08-19] @human: Asked "czy 028 właśnie nie skończyliśmy?" — caught that the
`/pulse` run minutes earlier had reported VF-028 as still active/backlog, which
was wrong. Checked git: `05ac364a` (implementing all 7 ACs) was committed the
same day. Verified `@vytches/ddd-resilience` (104/104) and
`@vytches/ddd-policies` (237/237) tests green; the only failures seen
(`@vytches/ddd-cqrs`, 3 tests) pre-date this commit per `git blame` (2025-08-23)
and are unrelated. Task file corrected (`status: done`, all 7 AC checkboxes
ticked, Activity/Notes section added) and moved to `completed-tasks/`, alongside
VF-037 (moved on the same request — "037 przeneś do completed"). v0.31.0's
code-side gate is now down to VF-036's AC-SIGNOFF alone.

[2026-08-19] @human: Confirmed sequencing for the `main` catch-up — `main` is
178 commits behind `develop` (last reachable tag `v0.27.0`); the old
`release/2026-07-18-alpha` branch is already fully merged into `develop`
(`d836beeb`), so there's no separate alpha content to bring over. Decision:
finish VF-028 + VF-036 AC-SIGNOFF first, run the full release checklist, then
merge `develop` → `main` and tag — not before.

[2026-08-19] @pulse: 37-day sync gap (last pulse 2026-07-13). Corrected material
drift: VF-036 (code done, AC-SIGNOFF outstanding) and VF-037 (done, unarchived)
and the VF-039 split all happened without a status sync. VF-028's task file
never moved past `status: backlog` despite an active branch and an approved
`/analyze` artifact — flagged, not auto-corrected (out of `/pulse`'s scope).
Also caught VP-012's stale `priority: normal` field (should be `high` per the
2026-08-09 promotion note). Health: 🟡 AMBER — process/metadata gap, not a
capability or blocker problem; 0 blocked tasks, 0 tech debt.

[2026-08-19] @tech-lead: 🟡 AMBER. VF-036 AC-SIGNOFF is the publication gate.
VF-028 branch active but task metadata not updated — fix status field before
starting. VF-037 shipped (`c393a04b`), needs archival. VF-039 split 2026-08-19:
VF-039a ready to ship (design-complete), VF-039b deprioritised on an open
architecture question — correct call given VF-028's higher impact. Zero blocked
upstream tasks.

[2026-08-19] @product-owner: Milestone gap now gated on 2 items (VF-028, VF-036
sign-off) instead of only juz-ide-api. VD-004's business-value claim remains
unvalidated (correctly already P3). VA-001's own demand-signal window opened
2026-08-09 — flagged for a maintainer check this week rather than another pulse
cycle of silence.

[2026-07-13] @pulse: VD-005 shipped today (docs truth cleanup + new
`tools/docs-compile-gate` CI tool) — implemented via `/analyze-ddd` →
`/orchestrate-ddd` (4-layer workflow, all GO), then independently re-verified
with a full `pnpm build` + full `pnpm test` before merge (not just trusting the
workflow's own verdict). Pre-first-publish pipeline is now **100% closed** —
nothing left in that batch. Human explicitly declined to split the task into
VD-005a/VD-005b despite both panel agents (architect, library-quality-verifier)
recommending it during `/analyze-ddd`, since release timing wasn't a constraint.
Health: 🟢 GREEN. VP-006b metadata drift is now 2 consecutive pulses unresolved
— genuinely due for `/task-tidy`.

[2026-07-13] @tech-lead: 🟢 GREEN. 0 blocked, 0 stale, 0 debt. VF-028 is now the
_only_ open P1 in the entire backlog.

[2026-07-13] @product-owner: Milestone code-complete in full (VD-005 closed the
last pre-publish gap). Segment coverage and cut-candidate recommendation
unchanged from prior pulses. No new business risk surfaced.

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
