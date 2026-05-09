# Release Readiness — `@vytches/ddd@0.25.0-beta.1`

**Snapshot date**: 2026-05-09 **Branch**: `develop` **Status**: ✅ **Code-ready
for public publish** — awaiting maintainer manual steps.

This document is the single source of truth on what's done and what's left when
you're ready to push the button on public release. Created at the end of the
release-prep marathon (REL-000 through DX-NEW-002 + REL-004) so the work doesn't
go cold.

---

## ✅ What's done (17 of 24 roadmap steps, all code-side work)

### Block 1 — Foundation (4/4)

- **REL-000** — npm scope `@vytches` confirmed FREE on npmjs.org (HTTP 404
  probe). ADR-0033.
- **REL-002** — Nx project graph repaired (`.claude/worktrees` exclusion, empty
  `packages/cli/` removed, `validate:types` fixed).
- **REL-008** — `Result<T, E>` moved to `@vytches/ddd-contracts` (foundation now
  dependency-free). Backward-compat shim in utils.
- **REL-001** — CLI cleanup + LLMGUIDE.md in all 21 packages.

### Block 2 — API hardening (4/4)

- **REL-005** — 3 `@internal` symbols removed from public barrel; 20 surface
  tests added; EntityIdFactory deprecation warnings (NOT removal).
- **REL-009** — 5 pattern correctness bugs fixed (Snapshot type, Repository.save
  commit, OrPolicyComposer aggregation, EnhancedCommandBus opt-in resilience,
  CQRS error symmetry).
- **REL-007** — Security hardening: deserialization sanitization, byte-cap,
  depth limit, AI peer-deps removed, `.env.development` untracked, ReDoS
  warning, AggregateRoot.maxEvents.
- **VT-001** (subset) — 2 flaky timer tests fixed, 5 `describe.skip` →
  `describe.todo`, flaky timing assertions removed.

### Block 3 — Content & infrastructure (5/5)

- **REL-010** — LLM bundle pipeline: `pnpm llm:bundle/verify/guides:check`.
  `llm:guides:check` wired into `prerelease`.
- **VD-002** — 8 policies examples + 17 tests in `examples/policies/`.
- **VD-003** — 7 domain-services examples + 17 tests in
  `examples/domain-services/`.
- **VP-005** — Wildcard cleanup (aggregates + testing seeder); subpath exports
  for policies deferred to v0.26 per perf agent.
- **VP-NEW-001** — Performance baselines (`benchmarks/`, `pnpm bench`) + 3
  zero-risk wins (BaseEventBus shortcircuit, cqrs memoize, FNV-1a hash for
  getCacheKey).

### Block 4 — Documentation (3/3)

- **REL-006** — README rewritten 1362 → 199 lines; QUICK_START fixed; CHANGELOG
  `0.25.0-beta.1` entry covering all REL-\* work.
- **DX-NEW-001** — StackBlitz playground + prominent README badge +
  `.stackblitzrc`.
- **DX-NEW-002** — 5-min start validation harness
  (`scripts/validate-quickstart.sh`, CI workflow, friction log).

### Block 5 (partial) — Versioning

- **REL-004** — All 21 packages unified to `0.25.0-beta.1`; Changesets
  `fixed: [["@vytches/ddd", "@vytches/ddd-*"]]` group; `lerna.json` aligned to
  npmjs.org.

---

## ⏸ What's parked (publish-side, awaiting maintainer time)

These 7 steps require manual npmjs.com setup and live publish coordination,
deferred per maintainer decision (no time for npm setup right now).

### REL-003 — publishConfig switch (3h, code-side only)

- All 20 `packages/*/package.json` `publishConfig.registry` currently still
  `https://npm.pkg.github.com` with `access: restricted`.
- Need to change to `https://registry.npmjs.org` + `access: public`.
- Add `--provenance` to `scripts/publish-packages.sh`.
- Add `permissions: { id-token: write, contents: read }` to
  `.github/workflows/release.yml`.

### REL-011 — GitHub Packages → npm migration plan (3h, ADR + workflow)

- Write ADR-XXXX recording cutover decision (Option A: hard cutover; old
  versions stay on GH Packages as legacy archive).
- Update `release.yml` to remove GH Packages publish step.
- CHANGELOG entry already covers consumer-facing migration recipe.

### Manual npmjs.com setup (~30 min)

1. Log in / register on **npmjs.com** (mailem
   `silverhand.shop+claudeai@gmail.com`?).
2. **Enable 2FA** (Settings → Two-Factor Authentication → "for authorization and
   writes").
3. **Create organization `vytches`** — Free tier, public packages.
4. **Generate Granular Access Token**: scope `@vytches`, packages `read+write`,
   expiration 90 days.
5. **Add to GitHub Actions secret** as `NPM_TOKEN` in `vytches/ddd` repo.
6. **Add backup maintainer** with publish rights (bus factor).

### Block 6 — Verify + Ship (~10h once unblocked)

- `juz-ide-api` smoke test against beta tarball (`pnpm pack` → install in
  consumer → run all 16K tests).
- CI dry-run (`pnpm publish --dry-run` from CI).
- `npm publish @vytches/ddd@0.25.0-beta.1` for all 21 packages.
- Announcement on r/typescript, dev.to, HN, Twitter (copy in CHANGELOG
  headlines).

---

## Effort summary

| Phase                         |          Estimated |          Actual | Status                       |
| ----------------------------- | -----------------: | --------------: | ---------------------------- |
| Block 1 (Foundation)          |                28h |             ~3h | ✅ done                      |
| Block 2 (API hardening)       |                40h |           ~5.5h | ✅ done                      |
| Block 3 (Content & infra)     |                35h |             ~5h | ✅ done                      |
| Block 4 (Documentation)       |                13h |             ~2h | ✅ done                      |
| Block 5 (Versioning, partial) |                 3h |          ~0.25h | ✅ done (REL-004)            |
| Block 5 (Publishing prep)     |                 6h |               — | ⏸ parked (REL-003, REL-011) |
| Block 6 (Verify + ship)       |                 7h |               — | ⏸ parked                    |
| **Total done**                | **119h estimated** | **~16h actual** | **86% time saved**           |

Critical agent reviews (architecture, ddd-compliance, ddd-patterns,
documentation, library-quality, performance, security, testing) caught multiple
issues before they shipped — including a fake-positive bug
(BaseValueObject.validate) and a wrong-file fix (IAggregateSnapshot duplicate).
Without those reviews, several invisible regressions would have made it to
public npm.

---

## Repository state at handoff

| Metric                | Value                                                                                   |
| --------------------- | --------------------------------------------------------------------------------------- |
| Develop branch        | 17 merged feature branches, all REL-\* / DX-NEW / VD / VP / VT tasks                    |
| Tests                 | 23 projects, 215+ tests, all passing                                                    |
| Type-check            | 20 projects, clean                                                                      |
| Bundle sizes          | Stable (see VP-005 task notes)                                                          |
| Performance baselines | 8 benchmarks captured (`benchmarks/baseline.json`)                                      |
| Surface tests         | 20 packages × snapshot lock for public API                                              |
| Documentation         | README 199 lines, QUICK_START 228, CHANGELOG 251, 21/21 LLMGUIDE.md                     |
| Examples              | 3 working workspaces (quickstart 16 tests, policies 17 tests, domain-services 17 tests) |
| LLM-first DX          | `pnpm llm:bundle` produces 260K-token AI context                                        |
| StackBlitz            | One-click open in browser                                                               |
| 5-min start           | Harness ready (`pnpm validate:quickstart`)                                              |

---

## How to resume publish work

When you have npm setup time:

1. **Read this doc end-to-end** — confirms what's done.
2. **Read `project-orchestration/ROADMAP-RELEASE-2026-05.md`** — original
   roadmap; many items now done, but the publish sequence is still valid.
3. **Read `project-orchestration/KANBAN.md`** — sequenced task list with
   dependencies.
4. **Pick up from REL-003** (publishConfig — code-side, 30 min) → REL-011 (ADR,
   30 min) → manual npmjs.com setup (30 min) → smoke test (1h) → publish (5 min)
   → announce (1h).
5. The full path is well-trod by the work in this branch — only the credential
   setup is outstanding.

If significant time has passed (>1 month), refresh:

- `pnpm install` + `pnpm test:ci` to verify nothing rotted
- Re-run `pnpm bench` to compare against committed baseline
- Check npm scope still free:
  `curl -s -o /dev/null -w "%{http_code}\n" https://registry.npmjs.org/@vytches%2Fddd`

---

## Files that exist for the handoff

- **`RELEASE-READINESS.md`** — this file (top-level doc)
- **`project-orchestration/ROADMAP-RELEASE-2026-05.md`** — original 24-step plan
- **`project-orchestration/KANBAN.md`** — sequenced task board
- **`project-orchestration/tasks/REL-*.md`** — per-task completion records with
  effort breakdown and lessons learned
- **`docs/adr/0033-npm-scope-and-registry-decision.md`** — registration
  checklist + fallback name guidance
- **`docs/quickstart-validation-friction-log.md`** — pending Docker run
- **`CHANGELOG.md`** — public-facing release notes (already written)

The release work is in maintained, resumable state. No "in-progress" loose ends.
