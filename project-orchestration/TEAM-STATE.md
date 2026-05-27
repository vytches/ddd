# Team State — @vytches/ddd

_Last sync: 2026-05-26 by /pulse_ _Updated by `/pulse`. Read-only for humans —
agents write here._

---

## 🎯 Sprint Focus

**v0.30.0 IS LIVE on npmjs.org.** VP-007 (per-context CQRS isolation) and
VP-008 (outbox default handler + priority contract) shipped 2026-05-23..25.

**Security audit (2026-05-26)** found 8 findings — 1 CRITICAL (PII in CQRS
logs), 3 HIGH (logging/masking gaps), 2 MEDIUM, 2 LOW. Full report in
`docs/security/SECURITY-AUDIT-2026-05-26.md`.

**Next target**: v0.31.0 — security hardening sprint (~9.5h, 8 VS-tasks).
MVP for rc: VS-001 + VS-003 + VS-004 (masking stack integrity, 5h).

---

## 🔴 Critical Now

<!-- @tech-lead updates this section on /pulse -->

1. **VS-001 CRITICAL (DREAD 13)** — `@LogCommands({ includePayload: true })`
   logs full command objects without masking. Passwords/tokens/PII reach
   production logs. Fix in v0.31.0-rc. Estimated 2h.
2. **VS-002..004 HIGH (logging stack)** — ConsoleProvider bypasses DataMasker;
   DataMasker silently skips plural keys (`passwords`, `apiTokens`); no ReDoS
   protection on user-supplied regex. Batch with VS-001 in single PR (~4.5h).
3. **VS-005 HIGH** — CachedPolicy uses 32-bit djb2 hash for cache keys;
   collision at ~65k entities may cause wrong policy result returned (auth bypass
   risk). Fix in v0.31.0 (~1.5h).

---

## 📱 Mobile Impact Pending

_N/A — this is a library project, no mobile UI._

---

## ⚙️ Technical Pulse

<!-- Updated by @tech-lead on 2026-05-26 -->

**Status**: Green | **Active**: 18 tasks (4 in-progress, 13 planned, 1 backlog)

**Security**: 8 new findings from 2026-05-26 audit (DREAD 4–13). VS-001 (CQRS
masking, 2h) is CRITICAL — block v0.31.0-rc until resolved. All 8 VS-tasks
collectively ~9.5h across 5 packages (logging ×4, policies, resilience,
messaging, value-objects).

**Recent wins**: VP-007 / VP-003 / VP-008 shipped in 13 days (2026-05-23..25).
Per-context CQRS isolation + production outbox hardening + adoption tooling.
LocalHero consumer fully unblocked for migration off hand-rolled poller.

**Coverage**: VT-001 in-progress. Series VT-002..005 (2026-05-10) delivered
63.98% → 69.29%. Baseline stable.

**Debt**: None. All 8 security items are bugs with clear fixes, not structural
debt. No major/minor items flagged. Stale (>14d): VD-004, VF-002 — resume
post-security sprint. VF-001 / VP-002 / VP-006 on steady state since 2026-05-09.

**Next sprint**: VS-001..004 (logging security, 5.5h) in one PR → v0.31.0-rc.
Parallel: VT-001 coverage. VS-005..008 → v0.31.0 full (lower urgency).

---

## 💼 Business Pulse

<!-- Updated by @product-owner on 2026-05-26 -->

**Status**: v0.30.0 PUBLISHED ✅ (2026-05-26) — VP-007 (per-context CQRS
isolation) + VP-008 (outbox default handler) shipped.

**Security audit (2026-05-26)**: 8 actionable findings:
- 1 CRITICAL: VS-001 — PII in CQRS logs (`includePayload: true`) → GDPR risk,
  credential exposure in log aggregation. Blocks production confidence.
- 3 HIGH: VS-002/003/004 — logging/masking stack gaps (GDPR compliance)
- 4 MEDIUM/LOW: VS-005..008 — infrastructure + usability

**Next milestone**: v0.31.0 (security hardening, ~9.5h, 2–3 weeks)
- MVP for rc: VS-001 + VS-003 + VS-004 (masking stack integrity, 5h)
- Full release: all 8 VS-tasks

**Validation**: All backlog tasks consumer-validated or audit-driven — zero
speculative work. VP-007 recovered production incident (LocalHero CQRS routing
collision). VP-003/008 validated by LocalHero adoption signal.

**Segment gap**: First-time DDD adopters (30% coverage). VF-002 (strategic
design docs) will unlock post-publish. Monitor npm install signal.

**Actions next week**:
1. Start VS-001 feature branch (2h, highest DREAD) — prerequisite for VS-002/003/004
2. Batch VS-001..004 in single PR (logging stack coherence)
3. Publish v0.31.0-rc within 5 business days (security quality gate)
4. Monitor adoption signal from v0.30.0 (LocalHero TS-DR-OUTBOX-002)

---

## 📝 Team Notes

<!-- Chronological, newest first. Format: [YYYY-MM-DD] @agent: insight -->

[2026-05-26] @tech-lead: First full security audit complete. 8 findings (VS-001..008),
DREAD 4–13. All 4 critical/high logging findings touch the same package (ddd-logging) —
batch into single PR for efficiency. VS-005 hash collision in CachedPolicy is stealth
authorization risk at scale. No structural tech debt introduced; all findings are bugs.

[2026-05-26] @product-owner: VS-001 is highest-risk finding in library history (DREAD 13,
GDPR exposure). Fix ASAP. Sequencing: VS-001 + VS-003 first (masking correctness), then
VS-002 (ConsoleProvider), then VS-004 (ReDoS). Bundle as v0.31.0-rc. LocalHero consumer
signal on v0.30.0 expected within days — monitor before planning v0.32.0 scope.

[2026-05-26] @pulse: v0.30.0 released. Security audit conducted. 8 VS-tasks created in
project-orchestration/tasks/. All are planned. Total backlog: 18 active tasks.

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
outbox-processor (destructure inversion `[result, error]` instead of `[error,
result]`) — silently broke outbox processing globally. New tests prevented
regression.
