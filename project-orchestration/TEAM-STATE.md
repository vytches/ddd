# Team State — @vytches/ddd

_Last sync: 2026-07-02 by manual triage_ _Updated by `/pulse`. Read-only for
humans — agents write here._

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

**Just shipped:** **VS-007 + VS-015 DONE** — merged to develop (commits
`54ac0fef`, `f11f6f96`), task files moved to `completed-tasks/`. VS-007: warn
when OutboxProcessor default handler is replaced (SEC-MESSAGING-001). VS-015:
preserve outbox stack trace + widen LoggingMiddleware logger type. These close
the remaining DX gaps opened by the VS-013 logging-removal pivot. VS-014
(configureDiagnostics) + VP-011 (dispose on onModuleDestroy) landed earlier.

**Next target**: v0.31.0 full — ~1h remaining across two small audit findings:
**VS-006** (CSV formula injection, 0.5h) + **VS-008** (deprecation suppress,
0.5h). Both `planned`, zero dependencies, can start immediately. Publication
gate: **juz-ide-api validation of the VS-013 logging removal** (still open, now
slipped 12+ days). VS-007/014/015 + VP-011 are off the remaining-work list.

---

## 🔴 Critical Now

<!-- @tech-lead updates this section on /pulse -->

1. **VALIDATE VS-013 against juz-ide-api (PUBLICATION BLOCKER)** — application-
   logging layer was removed (merged 2026-06-05). If the consumer is workspace-
   linked, removal of `@vytches/ddd-logging` is breaking immediately. Confirm
   237+ aggregates `build && test` green THIS WEEK — this is the publication
   gate for v0.31.0 and has now slipped **14+ days** since first flagged
   (2026-06-17), with zero recorded progress.
2. **VS-006 + VS-008 still `planned`, zero activity for 6 days** — both
   zero-blocker, ~1h combined (VS-006 CSV formula-injection guard DREAD 7,
   VS-008 deprecation suppress). Move to `in_progress` and ship — last code
   items before v0.31.0 publish. Bottleneck is clarity/prioritization, not a
   technical blocker. Both housekeeping/triage items from prior pulses are now
   resolved: VP-011 archived 2026-07-01 (`/task-tidy`); VP-002/VF-001/VT-001
   triaged and closed `done` 2026-07-02 (see Team Notes).

---

## 📱 Mobile Impact Pending

_N/A — this is a library project, no mobile UI._

---

## ⚙️ Technical Pulse

<!-- Updated by @tech-lead on 2026-07-01 -->

**Status**: 🟡 Yellow | **Velocity**: Stalled — awaiting human decision, not a
technical blocker | **Debt**: 0 major / 0 minor

**Just landed** (unchanged since 2026-06-30): VS-007, VS-015, VS-014, VP-011
(VP-006 internal-perf slice closed 2026-06-30, NestJS-adapter remainder carved
out as VP-006b).

**Active development**: None. Two zero-blocker ~1h tasks (VS-006, VS-008) have
sat `planned` for 6 days with no activity — the recommended-next-task signal
from 2026-06-30 has not translated into work starting.

**Blocked**: None. Dependency graph acyclic; max chain depth 0.

**Stale in-progress**: resolved 2026-07-02. VP-002, VF-001, VT-001 triaged and
closed `done` — library-side scope complete (VP-002: `IBatchRepository`/
`MemoizedSpecification`; VF-001: `@vytches/ddd-lint` MVP dogfooded; VT-001:
pre-release 100%, post-release covered by VT-002..005) with remaining scope
explicitly descoped/opportunistic, not deferred work.

VP-011 archival drift resolved 2026-07-01 (moved to `completed-tasks/`).

**Debt**: 0 major, 0 minor. Same 15m cleanup candidate carried forward:
`resilience/metric-registry.ts:50` raw `Error` vs `.message`.

**Critical path** (~1h code + publication gate to v0.31.0-full):

1. **Validate VS-013 vs juz-ide-api** (publication gate — **14+ days overdue**,
   highest risk item on the board)
2. **VS-006** (0.5h) — CSV formula-injection guard (DREAD 7) — move to
   `in_progress`
3. **VS-008** (0.5h) — value-objects deprecation suppress
4. **Publish v0.31.0** → await consumer feedback before v0.32.0 scoping

**Upcoming** (post-v0.31.0): VA-001 analysis approved 2026-07-01 (13 decisions,
2 HIGH security fixes identified, threat model complete) but entry conditions
(production validation ~2026-08/09) still unmet — does not jump queue. VF-002
(strategic design docs) remains `planned`, opportunistic post-release (VF-001
closed 2026-07-02).

**Coverage**: 69.29% (up from 63.98%, VT-002..005 series 2026-05-10). Stable
baseline; further gaps opportunistic.

---

## 💼 Business Pulse

<!-- Updated by @product-owner on 2026-07-01 -->

**Next milestone**: v0.31.0 (security hardening + DX polish) — **gap ~4–6 days**
(unchanged code scope, gate risk rising). Remaining: VS-006 (CSV formula
injection, 0.5h) + VS-008 (deprecation suppress, 0.5h) — ~1h combined, still
`planned`.

**Critical validation now blocking publication gate**: VS-013 (application-
logging removal) against juz-ide-api (237+ aggregates, 16K tests). **14+ days
slipped** — if workspace-linked or peer-dependent on `@vytches/ddd-logging`,
removal is an immediate breaking change. **Must run green `build && test` THIS
WEEK before v0.31.0 scope closes.** No other technical blockers; chain depth 0.

**New this cycle**: **VA-001 (AI agent package) analysis approved 2026-07-01** —
13 decisions (D1–D13) including 2 HIGH security fixes (mandatory
`requiredPermission`, enforced dispatcher pipeline order), threat model
complete. Entry conditions (production validation in juz-ide-api ~2026-08/09)
remain unmet — explicit decision: **library-quality work stays prioritized,
VA-001 does not jump the queue.**

**Validation record**: Zero speculative work. Every active task is audit-driven
(VS-001..008), consumer-feedback-driven (VP-009/010/011), or DX polish (VS-014).
VA-001 correctly gated behind real demand signal.

**Segment coverage**: Production/scaling teams ~70% served. First-time DDD
adopters ~30% (VF-001 MVP shipped and closed 2026-07-02; VF-002 still deferred —
gap remains; DX audit 2026-03-31 scored onboarding 4/10). AI-agent integrators
0% (VA-001 concept-approved, no demand signal yet).

**Cut candidate if capacity tightens**: none material in the v0.31.0 scope
itself (VS-006/008 are ~1h, zero risk; VS-013 validation isn't optional, it's
the gate). The 3 previously-stale in-progress tasks (VP-002, VF-001, VT-001) are
no longer a scoping question — triaged and closed `done` 2026-07-02.

**Validate this week** (highest risk, now overdue): juz-ide-api build green past
VS-013. Target before 2026-07-05 or publication slips another week.

**Actions this week**:

1. Run VS-013 juz-ide-api validation (publication blocker, 14+ days overdue).
2. Ship VS-006 + VS-008 (~1h combined), then publish v0.31.0.

(Triage of the 3 stale in-progress tasks — done 2026-07-02, see Team Notes.)

---

## 📝 Team Notes

<!-- Chronological, newest first. Format: [YYYY-MM-DD] @agent: insight -->

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
