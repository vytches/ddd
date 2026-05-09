# Team State — @vytches/ddd

_Last sync: 2026-05-09 by /pulse_ _Updated by `/pulse`. Read-only for humans —
agents write here._

---

## 🎯 Sprint Focus

Release prep marathon **complete** (17/24 steps). Remaining 7 steps parked
pending maintainer npmjs.com setup (~3.5h work). No active sprint.

Resumption point: [`/RELEASE-READINESS.md`](../RELEASE-READINESS.md).

---

## 🔴 Critical Now

<!-- @tech-lead updates this section on /pulse -->

1. **REL-003 — publishConfig switch** is the single soonest unblock (3h,
   code-only). Requires no npm credentials; can ship to develop today
   independent of maintainer schedule. Currently still points to
   `npm.pkg.github.com` + `restricted`.
2. **REL-002 frontmatter stale** — `status: planned` but work shipped (Nx graph
   clean, type-check 20/20). Needs `status: completed` in YAML.
3. **REL-000 deadline approaching** — `2026-05-12` (3 days). Manual npmjs.com
   registration deferred but cited as "before Block 5". If maintainer skips
   this, no publish path is viable.

---

## 📱 Mobile Impact Pending

_N/A — this is a library project, no mobile UI._

---

## ⚙️ Technical Pulse

<!-- Updated by @tech-lead on 2026-05-09 -->

**Active tasks**: 11 post-release backlog | **Build**: PASS (23/23 projects,
`pnpm test:ci`) **Tests**: PASS (215+ tests, 0 fail) + type-check PASS (20/20
projects) **Debt**: N/A — no `tech_debt:` fields in task frontmatter for this
corpus **Blocked chains**: 1 (REL-003 → REL-011 → publish, depth 3) | Stale
(>14d): TEAM-STATE.md was 36d before this sync | Overdue: 0

### Parked (publish gate — awaiting maintainer npmjs.com setup)

- **REL-003** — publishConfig still points to GH Packages. 3h code-only change.
  Unblocks REL-011 and publish.
- **REL-011** — Migration ADR + release.yml update. Depends on REL-003.
- **Prose-only items** (no task file, in `/RELEASE-READINESS.md`): juz-ide-api
  smoke test, CI dry-run, `npm publish` for 21 packages, public announcement.
  ~10h once npm credentials exist.
- **REL-000** (`status: in_progress`) — npm scope confirmed free; manual
  registration deferred. Deadline 2026-05-12 — 3 days away.

### Stale task state

- **REL-002** — frontmatter never updated post-completion. Work confirmed
  shipped via verification (Nx graph clean, validate:types green). Pure
  bookkeeping fix.

### Post-release backlog (11 tasks, planned, no blocking issues)

All `release_target: post-v0.25`. No due dates. Top by priority score: VP-002
(88), VP-003 (87), VP-004 (86, depends on VP-002), VF-001 (82), VD-004 (77).
Only dependency in backlog: VP-004 → VP-002.

### Critical path to publish

REL-003 (3h, code-only) is the single soonest unblock — no npm credentials
needed. REL-011 follows (30 min). Those two clear the entire code-side gate.
Remaining is credential work + manual: npmjs.com org (~30 min), smoke test
(~1h), publish (~5 min), announce (~1h).

### Velocity

17 tasks completed in ~16h actual against 127h estimated (87% time saved via
critical agent reviews). Marathon ended 2026-05-09. Board is clean for next
session to begin at REL-003.

---

## 💼 Business Pulse

<!-- Updated by @product-owner on 2026-05-09 -->

**Next milestone**: Public publish to npmjs.org — est. **2-3w** (when maintainer
schedules ~3.5h of credential/config + smoke test work) **Backlog**: 11
post-release tasks (planned). Code side clean. Publish side blocked on human
action only. **Publishing readiness**: Code-complete at `0.25.0-beta.1`.
Remaining: REL-003 (30 min), REL-011 (30 min), manual npmjs.com setup (30 min),
juz-ide-api smoke test (1h), publish + announce (1h). Total: ~3.5h of maintainer
time. **Unvalidated features**: 2 confirmed (VP-003, VP-004) — see below.
**Segment gaps**: Single confirmed consumer (juz-ide-api). Target segments for
public release implicit — not yet articulated as explicit ICP.

### 1. Tasks without validated business need

- **VP-004 — Event Store Streaming Performance** (18h, expert complexity). Task
  itself flags the problem — written assuming in-library event store,
  contradicts "no adapters" decision. No consumer asked for streaming
  backpressure tooling. Internal-author assumption.
- **VP-003 — Messaging Outbox Optimization** (14h). "50% throughput", "60%
  polling reduction" are authored targets with no benchmark baseline tied to a
  consumer-reported bottleneck. juz-ide-api describes performance as
  "acceptable".

Both should stay in backlog — but problem statements need to come from consumer
feedback post-publish, not pre-emptive optimization.

### 2. Positioning gap (segment coverage)

Target segments implied but never stated:

- TypeScript/NestJS teams building event-sourced systems (primary)
- DDD practitioners evaluating alternatives (Nest CQRS, dddsample)
- **Teams adopting LLM-assisted development** — `pnpm llm:bundle` is uniquely
  differentiated in 2026

The LLM-first angle (`llm:bundle`, 21 LLMGUIDE.md, 260K-token AI context) is
buried in the README behind conventional "enterprise DDD" pitch. For the segment
most likely to adopt a TS DDD library in 2026 — teams using AI coding agents —
this is a **positioning miss**. README leads with "production-grade DDD building
blocks"; LLM angle is in section 3.

### 3. Cut if capacity tight

**VD-004 — Interactive Documentation System** (20h). DX-NEW-001 (StackBlitz)
already delivers the "run without cloning" win. Algolia DocSearch on existing
markdown is a 4h alternative cited in the task. Cut full interactive docs from
v0.26; revisit after first 50 external users provide friction signal.

### 4. One question to validate with the first real user

> "Did you reach a working test using only the README and QUICK_START, or did
> you open an LLMGUIDE.md file — and if so, which one first?"

Partitions the two positioning bets: (a) conventional DX vs (b) LLM-first DX.
Answer determines whether next sprint invests in VD-004 (docs site) or richer
LLM context. Both currently funded roughly equally — sign the team doesn't yet
know which one converts.

---

## 📝 Team Notes

<!-- Chronological, newest first. Format: [YYYY-MM-DD] @agent: insight -->

[2026-05-09] @product-owner: LLM-first angle is buried in README — biggest
positioning miss for v0.25-beta launch. [2026-05-09] @product-owner: VP-003 and
VP-004 are pre-emptive optimizations without consumer signal — keep parked,
validate with first user. [2026-05-09] @product-owner: First-user question to
ask: "Did README+QUICK_START work, or did you open an LLMGUIDE.md?" Decides
between conventional vs LLM-first investment. [2026-05-09] @tech-lead: REL-003
(publishConfig) is single soonest unblock — code-only, 3h, no credentials
needed. [2026-05-09] @tech-lead: REL-002 frontmatter stale (status: planned but
shipped) — pure bookkeeping fix. [2026-05-09] @tech-lead: 17 tasks completed in
~16h actual vs 127h estimated. Marathon ended 2026-05-09; board is clean.
[2026-05-09] @pulse: Release prep complete. Resumption point:
/RELEASE-READINESS.md. [2026-04-03] @product-owner: VF-020 falsely marked
complete — examples/ directory does not exist. — RESOLVED: examples/quickstart
now exists with 16 tests, plus examples/policies (17) and
examples/domain-services (17). [2026-04-03] @tech-lead: Critical path has no
task files — publish blockers exist only as prose. — RESOLVED: REL-\* tasks
created and 17 of 24 completed. [2026-04-03] @tech-lead: Build GREEN, tests
GREEN (1636 pass). Only blockers: publishConfig + version skew. — RESOLVED for
version skew (REL-004); publishConfig now REL-003 (parked).
