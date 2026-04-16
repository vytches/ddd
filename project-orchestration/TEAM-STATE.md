# Team State — @vytches/ddd

*Last sync: 2026-04-03 by @pulse*
*Updated by `/pulse`. Read-only for humans — agents write here.*

---

## 🎯 Sprint Focus

Publish v0.1.0-beta to npm by 2026-04-25. Backlog empty — create 3 task files for publish blockers, then execute.

---

## 🔴 Critical Now

<!-- @tech-lead updates this section on /pulse -->

1. **Publish blockers have no task files** — 3 critical path items exist only as prose in TEAM-STATE.md. No tracking, no assignee, no due_date. Create PUBLISH-001/002/003 before starting work.
2. **publishConfig targets GitHub Packages** — all 20 `package.json` have `registry: npm.pkg.github.com` + `access: restricted`. Must change to `registry.npmjs.org` + `access: public`.
3. **VF-020 falsely marked complete** — Quickstart Example is in completed-tasks with 0% progress, no activity log, no `examples/` directory. Either reopen or accept DX debt.

---

## 📱 Mobile Impact Pending

_N/A — this is a library project, no mobile UI._

---

## ⚙️ Technical Pulse
<!-- Updated by @tech-lead on 2026-04-03 -->

**Active tasks**: 0 | **Build**: PASS (20 pkgs, ESM+CJS+.d.ts) | **Tests**: PASS (1,636 pass, 0 fail, 19 skipped)
**Debt**: 🟢 LOW | Major: 0 | Minor: 3
**Blocked chains**: 0 | Stale (>14d): none | Overdue: none

### Publish Blockers (untracked — no task files)

1. `publishConfig` in all 20 `package.json` → `npm.pkg.github.com` + `restricted`. Must change to `registry.npmjs.org` + `public`
2. Version skew: 0.22.4 (13), 0.23.1 (2), 0.23.4 (3), 0.24.4 (1), 12.1.1 (nestjs) — no changesets, no ADR
3. Consumer README missing — current README is project-internal
4. Cold-install test needed — `npm install @vytches/ddd-enterprise` → import AggregateRoot

### Structural Gap

Critical path has no task files. Create: PUBLISH-001 (publishConfig), PUBLISH-002 (version strategy), PUBLISH-003 (README + cold-install).

### Minor Debt

- Vitest `poolOptions` deprecation (1-line fix)
- 19 skipped e2e tests in domain-services
- nestjs exclusion from enterprise barrel undocumented

### Velocity

- 26 completed, 0 active | Last commit: 2026-04-02 | Build+tests green

---

## 💼 Business Pulse
<!-- Updated by @product-owner on 2026-04-03 -->

**Next milestone**: v0.1.0-beta on npmjs.com — est. 3 weeks (hard deadline: 2026-04-25)
**Backlog**: Empty — 3 publication blockers must become tasks this week
**Publishing readiness**: BLOCKED on registry config, version strategy, cold-install test
**Unvalidated features**: IMPROVEMENT_ROADMAP perf items (VP-002, VP-003) — no adoption baseline
**Segment gaps**: @node-ts/ddd migrators (0% coverage) — highest-leverage pre-launch win

### Publication Blockers — Must Become Tasks

1. Fix publishConfig in all 20 package.json (registry + access) — ~3h
2. Decide and execute version alignment strategy — ~2h decision + ~4h execution
3. Cold-install test: fresh repo, `npm install @vytches/ddd-enterprise`, import AggregateRoot — ~2h
4. Consumer-facing README: "what this is", "why not @node-ts/ddd", 10-line example — ~4h

### False Completion Flagged

VF-020 (Quickstart Example) is in completed-tasks but never built — 0% progress, no `examples/` directory. Either reopen or accept DX debt pre-beta.

### Do Not Start Before Beta Ships

- VP-002 (repo query perf), VP-003 (outbox optimization) — assumed demand, no users yet
- Docs site, comprehensive API docs, GitHub Actions release automation
- Any new packages or patterns

### Validate This Week

30-min Mom Test with one external TypeScript developer: show README, watch what they do. Confirms whether barrier is onboarding friction (→ build VF-020) or positioning (→ fix README first).

---

## 📝 Team Notes

<!-- Chronological, newest first. Format: [YYYY-MM-DD] @agent: insight -->

[2026-04-03] @product-owner: VF-020 falsely marked complete — examples/ directory does not exist. Reopen or accept debt.
[2026-04-03] @product-owner: @node-ts/ddd migration segment has zero content — add one paragraph to README pre-launch.
[2026-04-03] @product-owner: IMPROVEMENT_ROADMAP perf targets are internally authored with no user signal — freeze until post-beta.
[2026-04-03] @tech-lead: Critical path has no task files — publish blockers exist only as prose. Create PUBLISH-001/002/003.
[2026-04-03] @tech-lead: TASK-TEMPLATE.md uses custom schema, not PM framework schema. Fix if using /task-health regularly.
[2026-04-03] @product-owner: Hard deadline: v0.1.0-beta on npm by 2026-04-25.
[2026-04-03] @tech-lead: Build GREEN, tests GREEN (1636 pass). Only blockers: publishConfig + version skew.
[2026-04-03] @tech-lead: VF-009 CLOSED (already implemented). VF-010 CANCELLED (remaining items not worth doing).
