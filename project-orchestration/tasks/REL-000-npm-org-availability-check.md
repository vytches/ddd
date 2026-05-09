# Task: Verify @vytches npm org availability + fallback name

## Task Metadata

```yaml
task_id: REL-000
title: Confirm @vytches scope is reservable on npmjs.org or pick fallback
type: research
priority: critical
complexity: simple
estimated_time: 1h
actual_time: 0.5h (decision phase)
created_by: agent (critical-reviewer 2026-05-08)
created_at: 2026-05-08
completed_at:
  2026-05-08 (decision part; manual registration deferred to before Block 5)
status: in_progress (research done, registration pending)
release_target: v0.25.0-beta.1
deadline: 2026-05-12 (4 days from creation — must resolve before Phase 1 work)
blocks:
  - REL-003 (publishConfig)
  - everything (cannot publish without name)
```

## ✅ Resolution (2026-05-08)

- **Scope `@vytches` on npmjs.org**: confirmed FREE
  - HTTP 404 on `https://registry.npmjs.org/@vytches/ddd`
  - HTTP 404 on `https://registry.npmjs.org/@vytches/ddd-contracts`
- **Decision**: keep `@vytches` scope, no fallback needed
- **ADR**: `docs/adr/0033-npm-scope-and-registry-decision.md`
- **Registration on npmjs.com**: deferred to before Block 5 (manual owner
  action)

The scope is reservable on first publish; this is non-blocking for Block 1–4
implementation work.

## Why This Task Exists

The roadmap assumes `npm publish @vytches/ddd` will succeed. If `@vytches` scope
is already taken by another organization or user on npmjs.org, every single
REL-\* task that references the package name needs to be revised, and existing
GitHub Packages publications under that name don't transfer.

This is **the** dependency the entire roadmap rests on. Verify in 30 minutes,
not after 3 weeks of work.

## Acceptance Criteria

- [ ] Run `npm view @vytches` — does the org/scope exist? Owned by us?
- [ ] If unowned: register `@vytches` org on npmjs.org and add maintainers
- [ ] If owned by someone else: pick fallback (`@vytches-ddd`, `@vytches-org`,
      `@silverhand-vytches`, or personal scope)
- [ ] Update `package.json` scope across all 21 packages if fallback chosen
- [ ] Document decision in ADR (`docs/adr/0042-npm-scope-decision.md`)
- [ ] Confirm 2FA enforced on org-level npm account
- [ ] Add 1+ backup maintainer with publish rights (bus factor)

## Notes

If you have to change scope, every published reference (README, QUICK_START,
docs, CHANGELOG examples) needs updating. That's an additional 2-3h of work that
must happen in Phase 1, not Phase 3.
