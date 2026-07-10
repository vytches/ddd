# Task: ddd-lint — two new rules from VB-003 lessons

## Task Metadata

```yaml
task_id: VF-026
title:
  Enforceable anti-pattern rules — fanout-in-handler, deep-import instead of
  public barrel + fix broken isDomainFile() gate (ddd-002 is a no-op)
type: feature
priority: high
complexity: simple
estimated_time: 7h
created_by: human (feedback 2026-07-03)
created_at: 2026-07-03
updated_at: 2026-07-09
status: backlog
release_target: unscheduled
package: tools/ddd-lint
findings: [lessons from VB-003-nestjs-forfeature-di-wiring, SA-M1]
```

## Why

The original feedback proposed "anti_pattern per feature" on the assumption that
the repo already has a general `kind` taxonomy that supports it. **That
assumption did not hold up** — the only `kind` union in the repo is
`AIToolPermission` (`PUBLIC_NO_AUTH` | `REQUIRED`) in the VA-001 project, which
is about AI-tool permissions and unrelated to code anti-patterns. It doesn't
need to be invented from scratch, though: `tools/ddd-lint` already has a model
that fits — `ruleId` + `severity`, AST-based rules (`ddd-001`
no-mutable-state-in-aggregate, `ddd-002` no-throw-in-domain, `ddd-003`
factory-must-return-result). This task extends that existing, enforceable
mechanism — it is not a new system.

Two concrete lessons from the current VB-003 work (nestjs-forfeature-di-wiring),
fresh and confirmed in a real PR:

1. **Fanout in the handler** — the removal of `auto-discovery.service.ts` and
   the changes in `feature-handler-registrar.ts` on this branch point at a
   pattern to avoid (exact shape of "bad" vs. "good" code to be nailed down with
   the PR author during /analyze-ddd).
2. **Deep-import instead of the public barrel** — importing from a package's
   internal path instead of its entry point (`index.ts`/barrel), violating the
   "Explicit barrel exports" rule in `CLAUDE.md` (Public API Surface).

**Priority bumped normal → high (2026-07-09, SA-M1 from SEC-AUDIT-2026-07-09):**
the `ddd-002 no-throw-in-domain` gate has ALWAYS been a no-op in the repo's
actual wiring. `isDomainFile()`
(`tools/ddd-lint/src/rules/no-throw-in-domain.ts:70-87`) matches
`normalized.includes('/aggregates/')` etc. — requiring a **leading slash** — but
`npm run ddd:lint` scans with root `packages`, so relative paths look like
`aggregates/src/...` and never match. Verified: 0 `ddd-002` findings via the
wired script vs 100+ when scanned from the repo root. This explains why so many
throw sites exist in nominally "domain" folders despite the CLAUDE.md rule
("Domain layer is PURE: no thrown exceptions"). Most surfaced sites are
legitimate dual-API factories (`fromX` throws / `tryFromX` returns `Result`),
but only 2 files in the whole repo carry a
`// ddd-lint-disable no-throw-in-domain` suppression comment — the rest have
neither a confirmed Result twin nor a documented exception. Shipping two new
rules (AC1-2) on top of a silently broken path filter would compound the
existing blind spot, so the fix belongs in this task.

## Acceptance Criteria

0. [ ] **SA-M1 (do this FIRST):** `isDomainFile()` matches path **segments**
       (e.g. split on `/` and compare segments, or anchor with a leading-`(^|/)`
       regex) instead of raw `includes('/…/')`; regression tests cover both
       invocation shapes (`ddd-lint packages` from repo root and absolute
       paths). Then re-run `ddd-002` over `packages/` and triage the surfaced
       violations: suppression comment (with a one-line reason) for intentional
       dual-API throw factories, follow-up fix list for the rest — no violation
       left unclassified.
1. [ ] ddd-lint rule: `ddd-004` (or next free number) — detects fanout in a
       handler, with the exact definition confirmed during /analyze-ddd against
       the real VB-003 example.
2. [ ] ddd-lint rule: `ddd-005` — detects a deep import from a package's
       internal path instead of its public barrel.
3. [ ] Each rule: a positive test (catches the violation) + a negative test (no
       false positive on correct code), following the pattern of the existing
       rules in `tools/ddd-lint/src/rules/`.
4. [ ] Entry in `tools/ddd-lint/README.md` with a "bad"/"good" example for both
       rules.
5. [ ] The Anti-Patterns section in the LLMGUIDE.md of affected packages (at
       least `@vytches/ddd-nestjs`) updated with a link to the lint rule as the
       enforceable counterpart of the prose description.
6. [ ] Wire `ddd:lint` into CI, at minimum as **informational** (e.g.
       `pnpm ddd:lint || true`), per the tool's own README-stated rollout plan
       (Informational → Blocking-soon → Blocking). Confirmed 2026-07-04:
       `ddd:lint` is wired into **neither** `.github/workflows/ci.yml` (the only
       lint step there is ESLint via `nx affected --target=lint`) **nor**
       `.husky/pre-commit` today — it only runs when someone remembers to invoke
       it manually. Adding `ddd-004`/`ddd-005` to a linter nobody actually runs
       compounds this gap rather than fixing it; this task should not ship two
       more rules into that same blind spot. (Dogfooding confirmed 2026-07-04: a
       live run against `packages/` already finds real findings — 3 errors, 48
       warnings across 35 files — so the mechanism itself works, it's the
       enforcement wiring that's missing.)

## Out of scope

- A general `kind` taxonomy / schema redesign for anti-patterns — it doesn't
  exist and isn't needed here; the existing `ruleId`+`severity` model in
  ddd-lint is sufficient.
- Systematically adding an Anti-Patterns section to all 19 LLMGUIDE.md files — a
  separate task, if deemed worthwhile after this pilot.

## References

- `tools/ddd-lint/src/rules/no-throw-in-domain.ts` and neighboring files — the
  rule pattern to follow (and, per SA-M1, the broken `isDomainFile()` to fix).
- Analysis: `project-orchestration/analysis/SEC-AUDIT-2026-07-09.analysis.md`
  (SA-M1).
- Diff on `feature/VB-003-nestjs-forfeature-di-wiring` — source of both examples
  (removal of `packages/nestjs/src/discovery/auto-discovery.service.ts`, changes
  in `feature-handler-registrar.ts`).
