# Team State — @vytches/ddd

_Last sync: 2026-06-17 by /pulse_ _Updated by `/pulse`. Read-only for humans —
agents write here._

---

## 🎯 Sprint Focus

**Security sprint substantially CLOSED.** Masking stack (VS-001..004) done
2026-05-27..28; VS-005 (hash-collision auth-bypass) closed 2026-06-12; NestJS
CQRS cascade VP-009 + VP-010 merged to develop 2026-06-12 (HEAD `efa33043`).

**Logging strategy pivot (VS-013, merged 2026-06-05).** Application-logging
layer **removed** — library logger is now `@internal` diagnostics only, NOT an
app logging layer. This **cancels** VS-009/010/011/012 (decorator coverage,
toJSON bypass, secure-by-default, payload guard) as obsolete. Reinforces "most
comprehensive DDD library" positioning without competing against Pino/Winston.

**Next target**: v0.31.0 full — ~10h remaining across VS-006/007/008 (CSV
injection, default-handler warn, deprecation suppress), VS-014
(configureDiagnostics control API, 5h — now unblocked by VS-013), VS-015
(internalLogger follow-ups, 1.5h), VP-011 (dispose on onModuleDestroy, 2h
hygiene). Publication gate: juz-ide-api validation of the VS-013 logging
removal.

---

## 🔴 Critical Now

<!-- @tech-lead updates this section on /pulse -->

1. **VALIDATE VS-013 against juz-ide-api** — application-logging layer was
   removed (merged 2026-06-05). If the consumer is workspace-linked, this is
   breaking immediately (hard dep on now-gone `@vytches/ddd-logging`). Confirm
   237+ aggregates `build && test` green THIS WEEK — this is the publication gate
   for v0.31.0 and has now slipped 5 days since last flagged.
2. **VP-011 metadata drift** — current branch is
   `refactor/VP-011-cqrs-bus-dispose-on-destroy` (active work) but task still
   reads `status: planned`. Bump to `in_progress`. Once landed, VS-014
   (configureDiagnostics, 5h, unblocked) → VS-015 (1.5h) is the next chain.
3. **Triage 4 stale in-progress tasks: VP-002, VP-006, VT-001, VF-001** —
   `in_progress` with no merge/update signal for 39 days. All have partial/MVP
   delivery shipped 2026-05-09; remaining scope is opportunistic. Formally defer
   or resume — do not let them slip into "forgotten". No blockers detected.

---

## 📱 Mobile Impact Pending

_N/A — this is a library project, no mobile UI._

---

## ⚙️ Technical Pulse

<!-- Updated by @tech-lead on 2026-06-17 -->

**Status**: Green | **Active**: ~14 tasks (1 in-progress active branch, ~10
planned, 1 backlog, plus 4 stale in-progress). No blocked tasks. Dependency
graph acyclic.

**Recent wins**:

- ✅ **VP-009 + VP-010 merged** (`eeb0fc66`) — per-context CQRS bus handler
  registration (3 bugs: findOwnModule traversal, GLOBAL_QUERY/COMMAND_BUS,
  Symbol.for tokens) + lifecycle guardrails #1-#6 (unref timers, IDisposableBus
  export). 483 tests green, verifier WARN/no-VETO.
- ✅ **VS-013 merged** (`36abbbea`) — application-logging layer removed, pure
  domain restored, internalLogger consolidated to `@internal` in contracts.
- ✅ **Security sprint closed** — VS-001/002/003/004 (masking stack) + VS-005
  (hash-collision auth-bypass) all done.

**Active branch**: `refactor/VP-011-cqrs-bus-dispose-on-destroy` — VP-011
(dispose on `onModuleDestroy`, 2h) is being implemented now, but its task file
still reads `status: planned`. Metadata sync needed → `in_progress`.

**Critical path** (~10h to v0.31.0): VS-013 (done) gate → **validate vs
juz-ide-api** → VS-014 (5h, diagnostics control API) → VS-015 (1.5h) →
VS-006/007/008 audit findings (~1.5h). VP-010 (done) → VP-011 (2h, active, pure
dispose() hygiene, no downstream blocker). Max chain depth 2.

**Cancelled by VS-013 pivot**: VS-009 (decorator coverage), VS-010 (toJSON
bypass), VS-011 (secure-by-default), VS-012 (payload guard) — all obsolete once
the app-logging layer was removed (no DataMasker/decorators/payloads remain).

**Stale (>14d, before 2026-06-03)** — TRIAGE THIS WEEK:

- VP-002 (repo perf, 39d) · VP-006 (DI perf, 39d) · VF-001 (validation tools,
  39d) · VT-001 (coverage, 39d) — all `in_progress` since 2026-05-09 with
  partial/MVP delivery shipped; remaining scope opportunistic. Confirm
  paused-vs-blocked; formally defer or resume.
- VF-002 (strategic docs) · VD-004 (interactive docs) — `planned`, deferred
  post-security (correct call; monitor for drift).

**Coverage**: VT-002..005 (2026-05-10) delivered 63.98% → 69.29%. VT-001 still
open — post-release scope (GWT migration, VO PBT) is opportunistic. Baseline
stable.

**Debt**: 0 major, 0 minor. All security items were bugs with clear fixes, not
structural debt. VS-013 removal eliminated ~66 operational logs + pure-domain
violations.

**Next sprint**: Validate VS-013 against juz-ide-api (publication gate) → land
VP-011 → start VS-014/VS-015 → clear small audit findings VS-006/007/008. Triage
the 4 stale in-progress tasks; bump VP-011 metadata to `in_progress`.

---

## 💼 Business Pulse

<!-- Updated by @product-owner on 2026-06-17 -->

**Next milestone**: v0.31.0 (security hardening) — **gap ~10–14 days**. Masking
stack + auth-bypass + NestJS CQRS cascade all CLOSED; remaining ~10h is small
audit findings (VS-006/007/008 = 1.5h), DX polish (VS-014/015 = 6.5h), and bus
lifecycle hygiene (VP-011 = 2h, deferrable to v0.31.1).

**Headline business event (VS-013 logging pivot)**: the library exits the "app
logging" space (where it would lose to Pino/Winston/Bunyan) and keeps a lean,
consumer-controllable internal-diagnostics surface. Reinforces the "most
comprehensive DDD library" positioning and unblocks adoption by teams with
strict logging policies. VS-014 (configureDiagnostics) closes the only DX gap
this opens — an enterprise lib must not emit unsilenceable console output.

**Validation**: Zero speculative work — every task is audit-driven, consumer-
feedback-driven (VP-009/010/011, VP-002/006 from juz-ide-api usage), or DX
polish. VA-001 (AI agent package, backlog) is concept-only, correctly deferred
pending juz-ide-api production validation (~2026-08/09). juz-ide-api (237+
aggregates, 16K tests) validates every release.

**Segment coverage**: Production/scaling teams ~70% (well served by security +
per-context CQRS buses). First-time DDD adopters ~30% (VF-001 validation tools,
VF-002 strategic docs both deferred post-security — correct call, these teams
are not yet in the funnel).

**Cut candidate** (if capacity tight): VP-011 (dispose-on-destroy, 2h, low) —
VP-010 already shipped `.unref()` on timers, so this is hygiene; ship as v0.31.1
fast-follow with zero customer impact.

**Validate this week** (highest risk): juz-ide-api build green past VS-013. If
workspace-linked, removing `@vytches/ddd-logging` is an immediate breaking
change — confirm 237+ aggregates `build && test` green before the v0.31.0
publication gate opens. Now 5 days slipped.

**Actions next week**:

1. Run the VS-013 consumer validation (highest-risk item this cycle; publication
   blocker).
2. Triage the 4 stale in-progress tasks (VP-002/006, VF-001, VT-001 — >14d, no
   merge signal; stuck vs intentionally paused).
3. Start VS-014 (configureDiagnostics) + VS-015 (follow-ups) once validation
   clears.

---

## 📝 Team Notes

<!-- Chronological, newest first. Format: [YYYY-MM-DD] @agent: insight -->

[2026-06-17] @pulse: 5-day sync. VP-011 now active on branch
`refactor/VP-011-cqrs-bus-dispose-on-destroy` but task metadata still says
`planned` — drift to fix. Top risk unchanged and now slipped 5 days: VS-013
juz-ide-api validation (publication gate for v0.31.0). 4 stale in-progress tasks
(VP-002/006, VF-001, VT-001, all 39d since 2026-05-09) need triage. 0 blocked, 0
tech debt. ~10h to v0.31.0.

[2026-06-17] @tech-lead: VP-011 branch active — bump status `planned` →
`in_progress`. Critical path ~10h: VS-013 gate → VS-014 (5h) → VS-015 (1.5h) →
VS-006/007/008 (1.5h); VP-011 (2h) parallel. The 4 stale in-progress tasks all
shipped partial/MVP on 2026-05-09 with opportunistic remainder — formally defer
or resume, don't leave forgotten. Debt 0/0.

[2026-06-17] @product-owner: milestone gap ~10–14d. VS-013 consumer validation
is the publication blocker and has slipped 5 days — run it before any v0.31.0
scope advances. VA-001 (AI agent pkg) correctly backlogged: concept-only, no
demand signal until juz-ide-api production validation (~2026-08/09). Cut VP-011
to v0.31.1 if capacity tight (VP-010 already shipped `.unref()`).

[2026-06-12] @pulse: full sync after 2-week drift. Security sprint substantially
closed (VS-001..005 done, VP-009/010 merged). VS-013 logging pivot cancelled
VS-009/010/011/012. Remaining v0.31.0 work ~10h. Zero blocked tasks, 0 tech
debt. Top risk: VS-013 may break workspace-linked juz-ide-api — validate this
week.

[2026-06-12] @tech-lead: VS-013 removed the app-logging layer entirely →
VS-009/010/011/012 obsolete (no DataMasker/decorators/payloads remain). VS-014
(diagnostics control API, 5h) now unblocked. 4 in-progress tasks (VP-002/006,
VF-001, VT-001) stale 14+ days with no merge signal — triage needed. Debt
remains 0 major / 0 minor.

[2026-06-12] @product-owner: logging pivot is the headline — library exits "app
logging" space (would lose to Pino/Winston), keeps lean consumer-controllable
diagnostics. VS-014 closes the DX gap (no unsilenceable console output).
v0.31.0-full ~1.5–2w out; gate is juz-ide-api validation of VS-013 removal. Cut
VP-011 to v0.31.1 if capacity tight.

[2026-06-12] @library-expert: VP-009 + VP-010 closed — merged to develop (HEAD
eeb0fc66). VP-009: 3 bugi (findOwnModule traversal, GLOBAL_QUERY/COMMAND_BUS,
Symbol.for tokens) done; verifier WARN/no-VETO, 483 tests green. VP-010:
guardraile #1-#6 done (unref timers, enableCache symmetry, IDisposableBus
export, runtime warning, stale-handler hint, regression E2E); #7 skipped (low) →
follow-up VP-011.

[2026-05-28] @tech-lead: VS-001 code shipped across 5 commits
(31a25d26..69e7ead1) but task said "planned" — status drift, bumped to "review".
VS-002/003/004 complete (4.5h delivered, all @vytches/ddd-logging). VS-005 (hash
collision, auth-bypass at scale) is highest-urgency remaining item after the
masking stack ships.

[2026-05-28] @product-owner: VS-001..004 code-complete; v0.31.0-rc shippable
now. Sole gate is verifying/closing VS-001 (metadata drift, not a code gap).
Backlog grew to VS-009..012 (logging hardening) — all audit-driven, zero
speculative work. Validate rc against juz-ide-api consumer build before v0.32.0
scoping.

[2026-05-26] @pulse: process gap surfaced — task status fields not updated
post-commit. Worth a Stop-hook or pre-commit reminder to sync task metadata.

[2026-05-26] @tech-lead: First full security audit complete. 8 findings
(VS-001..008), DREAD 4–13. All 4 critical/high logging findings touch the same
package (ddd-logging) — batch into single PR for efficiency. VS-005 hash
collision in CachedPolicy is stealth authorization risk at scale. No structural
tech debt introduced; all findings are bugs.

[2026-05-26] @product-owner: VS-001 is highest-risk finding in library history
(DREAD 13, GDPR exposure). Fix ASAP. Sequencing: VS-001 + VS-003 first (masking
correctness), then VS-002 (ConsoleProvider), then VS-004 (ReDoS). Bundle as
v0.31.0-rc. LocalHero consumer signal on v0.30.0 expected within days — monitor
before planning v0.32.0 scope.

[2026-05-26] @pulse: v0.30.0 released. Security audit conducted. 8 VS-tasks
created in project-orchestration/tasks/. All are planned. Total backlog: 18
active tasks.

[2026-05-22] @tech-lead: v0.26.0 published. VP-004 dropped (moved to
completed-tasks). DOC-001 README audit done — 17/20 READMEs had hallucinated
APIs, all rewritten. Active backlog: 8 tasks. No blockers. Next: VP-003 Parts
2–4 feature branch.

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
days left on REL-000 deadline.

[2026-05-09 PM] @tech-lead: Apply() perf +21.7% on 100-event replay (~3.9M
events/s) — material for launch marketing benchmark numbers.

[2026-05-09 PM] @testing-excellence: VT-001 work caught a real production bug in
outbox-processor (destructure inversion `[result, error]` instead of
`[error, result]`) — silently broke outbox processing globally. New tests
prevented regression.
