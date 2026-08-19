# Team State — @vytches/ddd

_Last sync: 2026-08-19 by `/pulse`_ _Updated by `/pulse`. Read-only for humans —
agents write here._

---

## 🎯 Sprint Focus

**v0.31.0's code-side gate is down to one item**: **VF-036 AC-SIGNOFF** (code
merged `c88e728e`; only the consumer's full-suite run on a patched build is
outstanding). **VF-028** (resilience correctness) was flagged mid-pulse as
"still active" — that framing was itself stale: it was implemented and committed
the same day (`05ac364a`), verified (resilience 104/104, policies 237/237 tests
green) and archived to `completed-tasks/`. Remaining gate besides VF-036:
**juz-ide-api manual validation**, still deliberately deferred by prior explicit
authorization, no deadline. Owner decision 2026-08-19: collect VF-036's
sign-off, run the full release checklist, **then** merge `develop` → `main`
(currently 178 commits behind, `main`'s last reachable tag is `v0.27.0`) and
tag/publish.

**Since the 2026-07-13 pulse, also landed** (found this pulse without a prior
status sync — 37-day gap): **VF-037** (standing cross-context isolation
regression suite + behavioral-BC checklist, done `c393a04b`, now archived) and
**VF-039**, split 2026-08-19 into **VF-039a** (revert-ban, design-complete,
ready to ship) and **VF-039b** (churn-guard, deprioritised pending a design
decision on churn-ledger placement).

**Housekeeping flagged this pulse**: VF-028 and VF-037 both had stale task files
(status/AC checkboxes not updated after their commits landed) — corrected and
archived 2026-08-19. VP-012's `priority: normal` field still hasn't caught up
with its recorded 2026-08-09 P2→P1 promotion — left unresolved, needs owner
confirmation before flipping it (unlike VF-028/VF-037, git history alone doesn't
settle what VP-012's priority _should_ say).

---

## 🔴 Critical Now

<!-- @tech-lead updates this section on /pulse -->

1. **VF-036 AC-SIGNOFF outstanding — now the sole npm-tag gate.** Code is merged
   (`c88e728e`); only the downstream consumer's full-suite run on the patched
   build remains. Owner decision 2026-08-19: finish this, then run the full
   release checklist before merging `develop` → `main`.
2. **`main` is 178 commits behind `develop`** (last tag reachable from `main`:
   `v0.27.0`). The old `release/2026-07-18-alpha` branch is already fully
   absorbed into `develop` (`d836beeb`) — nothing separate to bring over. Merge
   to `main` is deliberately queued behind item 1 + the release checklist, per
   owner decision this session — not a red alert, a sequencing choice.
3. **VF-028 was closed the same day it was flagged.** This pulse initially
   reported it as "active, not done" — that was the pulse's own stale read,
   corrected after a direct user check. It shipped (`05ac364a`), verified
   (resilience 104/104, policies 237/237 green) and archived to
   `completed-tasks/`. No action needed; listed here only so the correction is
   visible, not buried.

**Housekeeping (non-blocking)**: VP-012's task file still reads
`priority: normal` despite its recorded 2026-08-09 P2→P1 promotion — needs a
`/task-tidy` pass or an explicit owner call on the intended value.

---

## 📱 Mobile Impact Pending

_N/A — this is a library project, no mobile UI._

---

## ⚙️ Technical Pulse

<!-- Updated by @tech-lead on 2026-08-19 — scanned 23/24 active tasks, 37-day sync gap -->

**Status**: 🟢 GREEN (revised same-day from 🟡 AMBER) — the metadata drift this
pulse first flagged on VF-028 turned out to be the pulse's own read being stale,
not the work: VF-028 was already done. AC-SIGNOFF gate on VF-036 is the only
thing left blocking publish. Zero blocked dependency chains, zero tech debt.

**Blocked chains**: 0 upstream dependencies. VF-039b is deprioritised on an open
architecture question (churn-ledger placement), not blocked by another task.

**Since the 2026-07-13 pulse (37 days)**: three new high-priority tasks landed
without a status sync — **VF-036** (code merged `c88e728e`, AC-SIGNOFF
outstanding), **VF-037** (done, `c393a04b`, now archived), **VF-039** (split
same-day into VF-039a/VF-039b).

**Same-day self-correction**: initial pulse read VF-028's task file
(`status: backlog`) at face value and reported it as still active. A direct user
question caught the drift going the other way — the code was already merged
(`05ac364a`) the same day. Re-verified before archiving: resilience 104/104 and
policies 237/237 tests green; a `@vytches/ddd-cqrs` run showed 3 failures traced
by `git blame` to 2025-08-23, unrelated to this change. Lesson: a task file's
`status` field is a claim about the past, not a live signal — cross-check git
log/branch state when the two disagree, don't just report the file.

**Stale (>14d)**: VD-004/VF-002 (141d, deliberate opportunistic hold), VA-001
(91d, deliberate hold — see Business Pulse), VP-012/VT-006/VF-025 (~48d),
VF-032/VF-033/VF-034 (40d). None flagged as forgotten — either deliberately
deferred or genuinely next-in-queue.

**Critical path to v0.31.0**: VF-036 consumer sign-off → full release checklist
→ merge `develop` → `main` (178 commits ahead, `main` last tagged `v0.27.0`) →
tag. Then VF-039a (2h, design-complete) clears the rest of the P1 board.

**Debt**: 0 major, 0 minor (no `tech_debt:` fields declared in any task file).

**Housekeeping found this pulse**: VF-028 and VF-037 task files both had stale
status/AC fields relative to their actual git state — corrected and archived
2026-08-19. VP-012's `priority: normal` field still hasn't caught up with its
recorded 2026-08-09 P2→P1 promotion — left open, needs an owner call rather than
an inferred fix.

---

## 💼 Business Pulse

<!-- Updated by @product-owner on 2026-08-19 — scanned 23/23 tasks -->

**Next milestone**: v0.31.0 — down to 1 critical-path item: **VF-036
AC-SIGNOFF**. VF-028 was reported in-progress earlier this pulse; that was stale
— it shipped the same day (`05ac364a`) and is archived. No `due_date` field
exists in this task schema, so no overdue count is computed — that's a genuine
gap, not an omission. juz-ide-api manual sign-off remains deferred, no deadline.

**Unvalidated features**: VD-004 (interactive docs) — its "80% faster discovery"
claim has no cited source anywhere in the task file; correctly already demoted
P2→P3 on 2026-08-09. VA-001 is **not** unvalidated — it's gated on a named
demand signal, not an assumption.

**Mobile UX**: N/A — library has no UI, no `mobile_impact` field in schema.

**Segment coverage** (qualitative — no `segment` field in schema):
production/scaling teams well-served (VF-028/VF-025/VP-012/VF-037 are all
runtime-hardening work, prioritized by the 2026-08-09 owner directive).
First-time DDD adopters underserved (VD-008/VD-009 sit at P2/P3). AI-agent
integrators 0% — VA-001 still `backlog`.

**Cut candidate if capacity tightens**: **VP-006c** — its own task title states
"no live callers," a weaker business case than VD-004 (which at least claims an
unverified benefit). Recommend cutting VP-006c first if scope needs trimming.

**Validate with the maintainer this week**: VA-001's task file names its own
trigger —
`demand_signal: juz-ide-api scoping AI integration — expect attention ~2026-08/09`
— and that window is open now. Worth a direct check: has juz-ide-api actually
started scoping AI integration? If yes, VA-001's entry conditions may be met; if
no, re-date the deferral rather than leave it on an expired signal.

**Actions this week**:

1. Collect VF-036's AC-SIGNOFF — the sole remaining npm-tag gate (VF-028 already
   shipped, archived 2026-08-19).
2. Run `/task-tidy` on VP-012 (fix stale priority field) — VF-028/VF-037 are
   already archived.
3. Check with the maintainer whether VA-001's demand signal has actually
   materialized.
4. After 1: run the full release checklist, then merge `develop` → `main` and
   tag.

---

## 📝 Team Notes

<!-- Chronological, newest first. Format: [YYYY-MM-DD] @agent: insight -->

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
