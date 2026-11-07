# Task: DDD role model + ESLint plugin — machine-checkable library usage with immediate agent feedback

## Task Metadata

```yaml
task_id: VF-043
title:
  "tooling: @vytches/eslint-plugin-ddd — a role model of the library's building
  blocks plus a role-scoping adapter, so consumer projects can enforce their own
  DDD conventions deterministically per edited file instead of through agent
  prompts and verifier passes"
type: feature
priority: medium
complexity: high
estimated_time: 'Phase 0 (gate) 1–1.5d; Phase 1 ~3d; Phase 2 ~2d'
created_by:
  human (founder) after a session analysing agent token costs in the primary
  consumer application
created_at: 2026-10-30
status: in-progress
updated_at: 2026-11-07
package:
  'new packages/eslint-plugin-ddd (role resolver + roleScoped + API preset)'
related: [VF-026, VF-034, VF-038]
consumer_first_adopter:
  primary consumer application — adoption is a separate task on the consumer
  side
```

## Current status (2026-11-07)

**Phase 1 is released.** `@vytches/eslint-plugin-ddd` 0.32.0 is public on npm
(`@beta`, peer `eslint ^9.39.0 || ^10.0.0`). Phase 2 (formal AC-DOGFOOD,
migration note, guide) has not started.

- **0.32.0:** release PR #89, merged into `main` as `d482a466`. It was a
  **squash** merge (one parent), so the tag `v0.32.0` (on `2e1f061a`) is not in
  the history of `main`. Consequence: on `main`, `git describe` finds `v0.31.1`
  and `lerna` treats all 20 packages as changed. The 0.32.1 bump worked around
  it with a temporary local annotated tag on `d482a466`; the remote tag was not
  touched. Fix for good: merge release PRs with a **merge commit**, and decide
  whether to move the remote `v0.32.0` to `d482a466` (a force-push of a public
  tag, so only on the owner's say).
- **CI problems found and fixed on the way to 0.32.0:** `format:check` on five
  files from earlier `develop` commits; six lint errors and two type errors in
  the plugin's tests; `dist/*.d.ts.map` pointing at an unpublished `src` (the
  smoke test caught it; `sourceMap` and `declarationMap` are now off like the
  other packages); no bundle limit for the plugin (150 KB, measured 138.81 KB);
  `pnpm audit` (`@faker-js/faker` 8 to 10.5 in `@vytches/ddd-testing`, which
  needs Node `^20.19 || ^22.13 || >=24`; overrides for `js-yaml` and
  `csv-parse`); `deps:check` ran through `npx` without TypeScript and checked 0
  modules, so `dependency-cruiser` is now a root devDependency.
- **0.32.1 (prepared, not yet merged or published):** branch
  `release/2026-11-07-1`, tag `v0.32.1`, only the plugin is bumped. It adds
  `validateRoleConfig({ countRoles: true })` with `roleCounts`; ships `docs/` in
  the tarball (the README linked to pages that were missing); corrects the
  README (it still said `private`); documents aiming a core rule through
  `builtinRules` and running the plugin next to an ESLint 8 project; publishes
  packages in dependency order (`scripts/publish-order.mjs`; before,
  `@vytches/ddd` reached npm before its dependencies and installs failed with
  404 for several minutes).
- **Consumer adoption (a second copy of the primary consumer):** done on the
  consumer side, on its own branch, not pushed. The plugin runs as a side track:
  a workspace package with its own ESLint 9.39.5 and a flat config, next to the
  untouched ESLint 8 setup (an aliased second ESLint in the root made pnpm
  replace `node_modules/.bin/eslint`, so it was rejected). Result over 9880
  files in about 25 s, 0 parse errors: 1 error and 158 warnings.
  `no-new-entity-id` 1 (real, a `new BaseEntityId(...)` that grep for
  `new EntityId(` cannot see), `no-deprecated-entity-id-factories` 149 (all
  real), the other four recommended rules 0. `settings.ddd.tsconfig` is
  required: `DomainEvent` 342 classes with it, 15 without. Three project rules
  built on `roleScoped` (no `throw` in aggregates, no async in domain classes,
  no framework import in domain files) measured on that code; one more (no
  `userId` in commands, 64 hits, precision unclear) was described, not enabled.
  Still open there: a real `docker build`, whether `lint:ddd` goes into CI, and
  a full ESLint 9 migration (blocked by `eslint-config-airbnb-*` peer ranges).

- Source of truth for the design is still the approved analysis
  (`project-orchestration/analysis/VF-043-eslint-plugin-ddd-agent-feedback-lane.analysis.md`).
  Decisions D18 (public-api type guards only on input unions) and D19 (the five
  specs that sat in `src/` moved to `tests/unit/`) were added during the run.
- **Package** `packages/eslint-plugin-ddd`: roles resolver, `roleScoped`,
  `settings.ddd` config with validation, recommended preset, agent lane
  (`/agent`: `createAgentLinter`, `newFindings`). Rules in `recommended`:
  `no-instanceof-result`, `no-deprecated-entity-id-factories`,
  `event-handler-requires-handle`, `no-internal-imports`. Opt-in:
  `no-new-entity-id`, `policy-builder-required-calls`. Everything is marked
  `@beta @since 0.32.0`. CI matrix for ESLint 9/10 was added to
  `.github/workflows/ci.yml`; a changeset is in `.changeset/`. (Written before
  the release; the package is now public.)
- **Verified locally:** 26 test files / 455 tests green (explicit file paths,
  `.claude/test-guard.json` `allowUnit`), `tsc` clean, the built ESM and CJS
  entry points load. The package's own lint was not verified at that time (since
  2026-11-07 it runs under the repo's ESLint 8 config through `nx` and passes).
  The ESLint 10 matrix can only be confirmed on GitHub Actions.
- **Fixed after the run:** the ESM build imported `../package.json` without an
  import attribute (`ERR_IMPORT_ATTRIBUTE_MISSING`). `vite.config.mts` now
  inlines `package.json`. The meta-package `@vytches/ddd` exports `EntityId` as
  `ContractsEntityId`; `no-new-entity-id` missed `new BaseEntityId(...)` through
  that alias. `src/rules/shared/symbols.ts` now maps it back, with a regression
  test.
- **Run outcome:** final gate was NO_GO by machine only (unverified scope, blind
  probe), so the files were staged "needs review" per ORC-084. The run report
  `.claude/run-state/VF-043-eslint-plugin-ddd-agent-feedback-lane.report.md` was
  written before the manual fixes and is partly outdated.

### Real-consumer check (2026-11-06, read-only)

The staged package was run against a checkout of the primary consumer (9218
`src` files). The consumer is on ESLint 8 with eslintrc, so the check used
scratch flat configs and ESLint 9 from this repo; **nothing in the consumer
checkout was changed** (its working tree only has changes that predate this
check: one modified config file and one untracked analysis file). The harness is
kept in `project-orchestration/analysis/VF-043-phase1-dogfood/` (sanitised, run
with `CONSUMER_DIR=<checkout>`), because the previous harness was lost with its
scratchpad.

| Check                                                                                | Result                                                                                                                                 |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Run on all files                                                                     | 0 fatal errors, about 21 s for the full corpus                                                                                         |
| Library import rules on the meta-package `@vytches/ddd`                              | work; the consumer has ~3978 imports from it                                                                                           |
| `/internal` subpaths                                                                 | detected for the meta-package and for sub-packages                                                                                     |
| `no-deprecated-entity-id-factories`                                                  | 125 findings; grep shows 131, of which 2 are comments and 4 are destructured `await import(...)`, which the plugin does not follow     |
| Custom bindings (the consumer's own domain-event and integration-event base classes) | 346 of 347 and 91 of 91 classes; the one miss is a comment in code. Aggregates 60, value objects 248 match grep                        |
| Path aliases                                                                         | roles resolve only with `settings.ddd.tsconfig: 'tsconfig.json'`; with `tsconfig: false` just 15 of 347 events. **README must say so** |
| `no-new-entity-id` alias bug                                                         | found and fixed (see above); the plugin now reports the consumer's one real case                                                       |

These numbers come from hand-assembled configs pointing at `dist/`. The
installed tarball was checked separately on the repo's fixture consumer (next
section), not on the consumer's own code.

### Tarball check (2026-11-07)

Built with `nx build`, packed with `pnpm pack`, installed into two empty
projects (ESLint 9.39.2 and ESLint 10.14.0, `@typescript-eslint/parser` 8.68,
Node 24.14), using the repo's own fixture consumer.

| Check                                       | Result                                                                                                                                                                                                          |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tarball contents                            | `dist`, README, LLMGUIDE, LICENSE, `package.json` (125 files); no `workspace:` specifiers; `private: true` was still set (removed for the release)                                                              |
| Flat config via ESM and via CJS `require`   | identical results on both ESLint versions: 7 findings on the violations file, one per rule (`no-internal-imports` twice), none on clean files                                                                   |
| `/agent` entry, ESM and CJS                 | 7 exports each, equal                                                                                                                                                                                           |
| Types, `moduleResolution: bundler`          | 0 errors with and without `skipLibCheck`; a negative control shows the types are real (`DddConfigs`), not `any`                                                                                                 |
| Types, `nodenext` and `skipLibCheck: false` | 17 errors (TS2834): `.d.ts` files use extensionless relative imports. Same style as every other package here (`contracts`, `utils`), so repo-wide, not specific to this package. Fine with `skipLibCheck: true` |
| Cold process (new `node` per run, N = 30)   | ESLint 9.39: p50 232 ms, p95 247 ms. ESLint 10.14: p50 226 ms, p95 237 ms. ESLint alone without the plugin: p50 82 ms. Target p95 <= 300 ms met                                                                 |

Two repository problems found and fixed on the way:

- `pnpm pack` failed (`ERR_PNPM_CANNOT_RESOLVE_WORKSPACE_PROTOCOL`) because
  `pnpm install` had never been run after the package was added. After
  `pnpm install --frozen-lockfile` it works.
- `tests/fixtures/consumer/package.json` matched the `packages/**` workspace
  glob and registered as a workspace project, dirtying `pnpm-lock.yaml`. It is
  now excluded in `pnpm-workspace.yaml`; the lockfile is back to the staged
  state.

README now says that `settings.ddd.tsconfig` is required for path aliases. The
stray `.claude/run-state/typecheck.tsbuildinfo` under the package was removed.

### Before pushing (closed 2026-11-07)

All three items below were done: the decision was taken, the consumer facts were
used, and the branch was pushed and released.

1. ~~`no-internal-imports` semantics~~ **Decided (2026-11-07): keep as is.** The
   founder delegated the question to the library agents. Three of them (library,
   developer-experience, pragmatist) independently recommended no known-package
   list: it would go stale, the plugin must stay dependency-free, and the
   `@vytches` scope is the library's own, so a flag on a nonexistent package
   costs nothing. Only `contracts` and `events` export `./internal`, for sibling
   packages. One docs sentence was added saying that matching is by name.
   Revisit only if a third-party `@vytches/ddd-*` package with a public
   `/internal` subpath appears; the cheapest hybrid would be a `knownPackages`
   option that downgrades unknown packages.
2. **Consumer adoption needs ESLint 9 flat config** (consumer side, separate
   task). Facts collected from the consumer on 2026-11-06/07:
   - It is on ESLint 8.57 + eslintrc; `lint:arch` uses the same
     `.eslintrc.json`, so one config to migrate.
   - **Blocked on ESLint 9 by peer ranges:** `eslint-config-airbnb-base` 15.0.0
     and `eslint-config-airbnb-typescript` 18.0.0. Everything else declares
     ESLint 9 support or no peer limit (`boundaries` 7.4.1, `vitest` 0.5.4,
     `security` 4.2.1, `import` 2.32, `@typescript-eslint` 8.72.1).
   - Custom rules (`eslint-local-rules/`, `eslint-rules/`) use one removed API,
     `context.getSourceCode()`, in one file; `eslint-plugin-local-rules` loads
     as a normal plugin, no `--rulesdir`.
   - ESLint 8 baseline (needs `NODE_OPTIONS=--max-old-space-size=8192`, it
     aborted without): `src` 9133 files, 424 errors, 3151 warnings, 383 s;
     `test` 76 files, 4 errors, 3 warnings, 18 s. Top rules: `no-explicit-any`
     2501, `security/detect-non-literal-fs-filename` 286,
     `local-rules/enforce-authorization-guards` 162, `import/order` 137.
   - The plugin alone ran over the same `src` in ~21 s, so its cost is small
     next to the existing 383 s.
3. **Commit and push the branch** so the CI matrix (ESLint 9 and 10, Node
   versions) runs; do not publish to npm. The founder decides when.

### Known gaps and follow-ups

- `/agent` imports `eslint` itself; whether it fails under ESLint 8 (peer
  resolves to 8.57 when the plugin is installed in an ESLint 8 project) was not
  checked.
- Decorator binding to a **function or `const`** in a project file gives a false
  `export-not-found` (a `src/resolver` bug; separate task).
- Dynamic-import destructuring is unsupported (documented, silent by design).
- No `.d.cts` for `exports.require`, and `.d.ts` files without extensions (see
  the tarball check); run `attw` before publishing.
- Phase 2: formal AC-DOGFOOD (two consumers, promotion criterion in the dogfood
  inputs below), migration note, guide, typed tier.
- Phase 0 leftovers from the old table below ((c) typed decorators, (e) "before"
  baseline, ESLint 10 load) were never run as separate spikes; (c) is covered
  only indirectly by Phase 1 fixtures.

### Done

| Item                                                                            | Result                                                                                                                                                                    |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Task rewrite (findings, library/project split, ACs, phases)                     | done                                                                                                                                                                      |
| Consultation with the shared-patterns maintainers on a non-invasive spike setup | done: no shared hooks, global settings or project settings were touched                                                                                                   |
| AC-SPIKE (a), channel: hook output reaches a **subagent**                       | ✅ 7/7                                                                                                                                                                    |
| AC-SPIKE (a), behaviour: the subagent fixes the code in the same turn           | ✅ only with a **blocking** channel: PreToolUse deny 4/4, PostToolUse block 5/7. Advisory `additionalContext` fixed 0/12 on Haiku. Sonnet rarely violates the rule at all |
| AC-SPIKE (b), `roleScoped` prototype                                            | ✅ role resolution 100% on the consumer, structural precision 40/40, cold single-file run ~240 ms, warm p50 1.3 ms, so no daemon for the untyped tier                     |

### Done since the previous update (2026-11-04/05)

| Item                                                                                  | Result                                                                                                                                                   |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/analyze` with a five-advisor panel (API, quality, library, docs, DDD patterns)      | done: decisions D1–D17 and units written, status `approved`; Q1–Q9 answered, Q10 (sign-off gate) deliberately open                                       |
| Dogfood spike on a copy of the primary consumer (ESLint 9.39.2, flat config, untyped) | ✅ see "Spike log: dogfood (2026-11-05)". Rules work; four design corrections found (D10, D5, and two Phase 1 inputs below); nothing in the repo changed |

### Still open in Phase 0

| Item                                          | What to do                                                                                                                                                                                                                            | Effort | Needs consumer?               |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----------------------------- |
| AC-SPIKE (c), typed decorators                | Fixture-based check of whether a decorator such as `@CommandHandler` can constrain the class shape under `experimentalDecorators` (NestJS), and whether decorator and glob bindings classify roles the same way as `extends` bindings | ~2h    | no, fixtures in this repo     |
| AC-SPIKE (d), ESLint 9 flat config            | Load the plugin from a flat config on ESLint 9, check that `roleScoped` works with a wrapped core rule, and write down the eslintrc decision (open decision 3)                                                                        | ~1h    | no                            |
| AC-SPIKE (e), "before" baseline               | Read-only: from workflow step metrics, run-state journals and subagent transcripts of a few completed consumer tasks, count verifier findings that lint could have caught, fix rounds, spawns and tokens                              | ~2h    | read-only, no checkout needed |
| AC-SPIKE (a), sandboxed real-orchestrator run | optional; only if the founder wants end-to-end proof beyond the synthetic delegation prompt                                                                                                                                           | ~$2    | detached worktree             |
| Phase 0 sign-off                              | Short summary of (a) to (e) and the final API shape, for the founder                                                                                                                                                                  | n/a    | no                            |

Notes on the table above:

- **(d) is half done.** Flat config on ESLint 9.39.2 loaded the plugin and ran
  `roleScoped` around core rules during the dogfood. Still open: the same on
  ESLint 10, and the cold-process measurement. The eslintrc question is decided
  (analysis D3: flat config only, peer `^9.39.0 || ^10.0.0`).
- **The 240 ms figure measured `lintFiles` after ESLint was loaded.** A hook
  starts a cold process on every write. The dogfood measured that (30 runs, wall
  clock, `lintText`, nine rules): median 245–292 ms, p95 275–314 ms, of which
  loading ESLint and the parser is about 209 ms. The worst case (a handler whose
  base class is reached through several barrels) is slightly over the 300 ms
  target. This was a prototype; **repeat it on the real package, on ESLint 9.39
  and 10, N ≥ 30, and write p50/p95 down** before the sign-off.

### Decisions waiting for the founder

1. **Test-guard blocker (outside this task's scope, blocks Phase 1).** A shared
   PreToolUse guard denies every agent-run test command in this repo:
   `pnpm test`, `pnpm nx test`, `nx run-many -t test` and `pnpm test <file>`.
   The root `test` script is `nx run-many --target=test --all`, so even the
   guard's `allowUnit` opt-in gives no working file-scoped path. Proposed fix:

   - a `test:unit` script that runs Vitest on explicit files;
   - `.claude/test-guard.json` with `{"allowUnit": true}`;
   - an update to the testing agent's instructions (the section on running
     tests).

   Without it, agents implementing Phase 1 cannot run the plugin's tests.

   Analysis Q9 was answered "yes". The three manual steps still have to be done
   by a human before `/orchestrate`: add the `test:unit` script (it is part of
   the `scaffold` unit), create `.claude/test-guard.json` with
   `{"allowUnit": true}` and a ban on `-u`/`--update`, and update the testing
   agent's instructions.

2. **Phase 0 sign-off** before Phase 1 starts (needs (c), (d), (e) and the
   cold-process measurement first). Tracked as analysis Q10.
3. The four open decisions below are **resolved** by analysis Q3–Q8 (see "Open
   decisions" for the mapping).

### Design inputs for Phase 1 learned from the spikes

- **Blocking output must be errors-only.** Warnings and noise dilute the
  channel. Projects own the hook policy: errors map to deny/block, warnings to
  `additionalContext`. The library only supplies the data.
- **The library needs a `lintText`-style entry point** that lints the proposed
  content of a `Write` before it lands (the PreToolUse deny path fixed 4/4).
- **Bindings use the library's exported names**, because consumers alias them
  (for example `ContractsEntityId as BaseEntityId`). The resolver follows barrel
  re-exports and tsconfig `paths`, and treats a specifier ending in `.ts` or
  `.tsx` as a project file, not a package.
- **Config validation is mandatory** (AC-VALIDATE): a missing binding file must
  fail the run, otherwise a rule goes silently dead (the resolver once found 0
  handlers for this reason).
- **Lint noise to neutralise:** unused or ignored `eslint-disable` directives
  look like parse errors in results; the agent lane should run with
  `reportUnusedDisableDirectives: off` and `noInlineConfig: true`, and only
  `ddd/*` results are analysed.
- **A delegation prompt that contradicts a rule can win over the lint message**;
  rule-aware wording belongs in the orchestrator's delegation templates (outside
  the library).

Inputs added by the dogfood spike (2026-11-05):

- **Library import rules run on every file, not only on files with a role.**
  Only about 20% of the consumer's files contain a class with a role, so an
  import rule wrapped in a role filter detected 27% of injected `/internal`
  imports; unwrapped, 100%. `roleScoped` keeps a `scope: 'file'` mode for
  project rules that deliberately target role files (analysis D10).
- **The agent lane must filter results by rule-id prefix (`ddd/`).** On 9217
  files ESLint produced 318 messages without a `ruleId` (for example unused
  directives), which look like parse errors if not filtered.
- **The tsconfig/JSONC reader must be string-aware** (a naive comment stripper
  corrupts `"@scope/*"` paths) **and BOM-safe.** Parsing must also tolerate a
  shebang and CRLF; all six line-ending/prefix variants were exercised.
- **Resolver correctness items found by mutation:** respect scope (a parameter,
  local class or local `const` named `Result`/`EntityId` is not the library
  symbol); unwrap `as`, `!`, `satisfies`; follow `const A = Import` aliases and
  namespace imports (`ns.PolicyBuilder`, `export * as`). Known unsupported:
  destructuring (`const { createText } = EntityId`), dynamic aliases, a
  `PolicyBuilder` chain split across variables (the rule then stays silent
  instead of raising a false alarm).
- **Split rule (b).** `new EntityId(...)` is the misuse (candidate for `error`).
  The `@deprecated` static factories are a deprecation (`warn`, 125 natural hits
  in 81 files, all genuine). The `error` rule may enter `recommended` only after
  `contracts/LLMGUIDE.md:26`, which itself writes
  `new EntityId('abc-123','text')`, is corrected, because AC "zero hits on
  documented usage" would otherwise fail.
- **Project convention rules need a ratchet, not `error`.** `throw` inside a
  command handler has 55 natural hits in 36 files; it is a deliberate rollback
  idiom of that consumer (its handler base class documents it). A frozen
  baseline plus "no new `throw`" is the right shape. `Specification` without
  `@BusinessRule` has 28 hits in 18 files (a documented "ALWAYS" convention;
  part may be intentional helper classes).
- **Promotion criterion for opt-in rules.** Most rules have 0 natural hits on
  one consumer, so their precision is inferred from mutations and from the
  documentation corpus, not measured. A rule is promoted to `recommended` only
  on ≥95% precision over natural hits (≥60 without a false one) pooled from the
  AC-DOGFOOD consumers; otherwise it stays opt-in. Mutation evidence alone does
  not promote.

### How to resume in a new context

1. Read this file's "Current status", then the analysis artifact (frontmatter
   `decisions`, `units`, `open_questions`).
2. 0.32.0 is public; 0.32.1 is prepared on `release/2026-11-07-1` and waits for
   the owner to merge it (merge commit, not squash) and run the "Release"
   workflow. After that: sync `develop` with `main`, then Phase 2 (AC-DOGFOOD on
   a second consumer, migration note, guide, typed tier) and the consumer-side
   decisions listed under "Consumer adoption".
3. Tests: `.claude/test-guard.json` allows unit runs only through the repo's
   `test:unit` script with explicit test file paths. Never a recursive grep from
   the repo root.
4. The non-invasive experiment recipe is proven: a detached `git worktree` of
   the consumer, `claude -p --settings <scratch file>` with
   `--setting-sources user`, an env kill-switch, `ECC_GATEGUARD=off`, and a
   shadow-mode control arm. Never edit shared hooks or global settings for
   experiments.
5. **The first dogfood harness no longer exists** (the Phase 1 one is in
   `project-orchestration/analysis/VF-043-phase1-dogfood/`). It lived only in
   the analysis session's scratchpad (resolver, nine rules, mutation engine,
   independent text scanner, cold-start driver) and the system cleaned that
   directory on 2026-11-05, before it was copied into the repo. What survives is
   the result record in "Spike log: dogfood (2026-11-05)" above, and the first
   prototype in `project-orchestration/analysis/VF-043-spike/proto/`. Phase 1
   must rebuild the resolver and rules, and Phase 1's own tests (RuleTester,
   real-CLI fixture, mutation-style fixtures) replace the harness. Best-effort
   pointer: the subagent that wrote the harness left a transcript with most of
   its source in `cat > file <<EOF` blocks
   (`~/.claude/projects/-opt-projects-vytches-ddd/989ab2ec-2504-4536-a04e-ab1a4cce2c5c/subagents/agent-a74ef78ca5de5b7dd.jsonl`);
   it cannot be replayed blindly (several files were rewritten and patched with
   `sed`). Treat the dogfood numbers as reported, not reproducible, until
   AC-DOGFOOD repeats them with committed code.

**Sandbox state.** All temporary consumer worktrees were removed on 2026-11-04.
The consumer repository's working tree, branch and commits were never modified.
The only footprint was temporary git worktree metadata, now cleaned up.

## Why

Today DDD patterns are "enforced" by an AI agent **reading** about them in its
prompt and **remembering** them while it writes, and by a second agent (the
verifier) **reading the diff** and looking for violations. We pay for this in
tokens on every agent spawn, and the result is probabilistic. A linter checks
the same structural rules deterministically, in milliseconds, **at zero token
cost until a rule is broken**, and it reports the violation on the file that was
just written, so the agent fixes it in the same turn instead of after a whole
layer of files.

Expected sources of savings, from most to least certain:

1. **Fewer fix loops.** A violation caught at edit time does not become a
   verifier finding, which would cost another implementer and verifier spawn.
2. **Smaller rule cards** injected into every spawn. Rules covered by lint
   collapse to one line, "enforced by ddd/…".
3. **A narrower verifier scope.** The verifier skips rules that lint already
   proved for the file. This depends on changes in the agent tooling, not in the
   library.

The savings are a **hypothesis** until measured (see "Measurement"). The linter
catches structural rules only. Semantic rules stay in prose and with the
verifier.

## Findings from the 2026-10-30/31 discovery

### Consumers (three NestJS + Kysely applications on 0.31.1)

- **Every consumer extends the library with its own layer.** Base classes such
  as `BaseCommandHandler` (≈760 lines, copied between projects),
  `BaseQueryHandler`, `BaseEntity`, `BaseKyselyRepository` and a
  project-specific `DomainEvent` subclass are added on top.
  - Some of these do **not** extend a library class at all. One consumer's
    `BaseEntity` is a standalone abstract class.
  - `BaseCommandHandler` only `implements ICommandHandler`.
  - A rule that recognises roles purely by library base class misses them.
- **Import specifiers vary.**
  - One consumer forbids direct `@vytches/*` imports and goes through a project
    facade package.
  - Another aliases `ContractsEntityId as BaseEntityId`.
  - Name-based detection is therefore unreliable. Detection must resolve the
    import source.
- **Directory layouts vary.**
  - The contexts root differs: `src/contexts` in one app,
    `apps/api/src/contexts` in a monorepo.
  - Use-case folders contain bare `command.ts` and `handler.ts` files.
  - Repository files are named `kysely-*.repository.ts` in one app and
    `*-command.kysely.repository.ts` in another.
- **Deliberate deviations exist.**
  - `throw` in 46 handlers.
  - `async` and `throw` in some domain services and entities.
  - `userId` in 74 of 350 commands, many of them legitimate.
  - A rule that hard-codes one convention is loud everywhere else. Rules must be
    configurable and introduced through a ratchet.
- **Prior art exists and has drifted.** An edit-time hook config (a JSON file
  with base classes, purity layers, `contextPath` and `@Inject` checks) is
  copied into 6 projects, and every inspected copy is wrong somewhere:

  - a wrong `contextPath`;
  - non-existent event base names;
  - a required `BaseEntity` that does not exist;
  - file globs that match nothing.

  Its hooks are warn-only and text-match based. The plugin should supersede it.

- **Project decorators carry conventions.**
  - Example: `@BusinessRule(RULES.x)` on Specification classes, and on
    aggregate, handler and domain-service methods.
  - Its argument is a constant from `*.rules.ts`, and its ID is synced with a
    per-context YAML file by a project script.
  - The design must let projects bind such decorators to roles and members.
- **Existing tooling.**
  - ESLint 8.57 in eslintrc format, `@typescript-eslint` 6.21, and
    `eslint-plugin-boundaries`, plus dependency-cruiser for layer boundaries.
  - ≈122 hand-written "guardian" tests check cross-file wiring (error-mapper
    registration, `eventMap`, `providers[]`).
  - One consumer reports 277 pre-existing lint errors and a ~5 min full run.
    Another has 2463 lint problems. **Whole-project lint as a gate is a
    non-starter.**

### Library

- **`tools/ddd-lint`** is a private TS-AST runner with 4 rules.
  - Run on this repo it reports 74 errors and 51 warnings, and CI runs it as
    `pnpm ddd:lint || true`.
  - `ddd-002` (no `throw`) and `ddd-003` (`create()` returns `Result`)
    **contradict the library's own documented value-object pattern**:
    `BaseValueObject`'s constructor throws, and LLMGUIDE shows
    `static create(): Money`.
  - These rules encode a _convention_, not correct use of the library API.
  - `CONSUMER-USAGE.md` is stale: it says 3 rules where there are 4.
- **ESLint setup.**
  - ESLint 9.39 and `@typescript-eslint` 8.68 with a legacy `.eslintrc.json`.
  - It runs only through Nx, which forces eslintrc mode. Bare `eslint <file>`
    fails without `ESLINT_USE_FLAT_CONFIG=false`.
  - There is no `parserOptions.project`, so no type-aware rules run today.
- **Dead configs (confirmed).**
  - `.eslintrc-quality-gates.json` is referenced nowhere, declares no `plugins`,
    and points to a rule whose baseline file does not exist.
    `scripts/quality-gates/eslint-plugin-quality-gates.js` is never loaded.
  - `.eslintrc-jsdoc.json` is also dead (VF-038).
  - `any` is intentional in this library, so `no-any-regression` should not be
    revived.
- **Rules from the original draft with no library basis.**
  - `ddd/policy-use-must` **contradicts** both the policies and validation
    LLMGUIDEs, which recommend `BusinessRuleValidator.addRule`.
  - `ddd/require-inject` and `ddd/no-async-in-domain` are consumer conventions.
  - `ddd/no-manual-bus-registration` is only valid under NestJS auto-discovery.
    Outside Nest, manual `register()` is the documented path. It must also
    exempt `autoRegister: false`.
- **Role markers available in source.**
  - Library decorators: `@CommandHandler`, `@QueryHandler`, `@EventHandler`,
    `@DomainService`, `@ACLAdapterFor`.
  - Aggregates have no marker beyond `extends`.
  - The value-object brand symbol is runtime-only.
- **Gaps the type system leaves open.**
  - `Result.isSuccess` is a plain boolean, so `.value` throws but TypeScript
    does not narrow.
  - `ICommand` is `{}`.
  - ~~`@EventHandler` accepts a string.~~ **Corrected 2026-11-05:** it does not.
    `@EventHandler(eventName: new (...args: any[]) => T)` takes an event class
    (`packages/events/src/decorators/event-handler.decorator.ts:23-24`), so the
    compiler already rejects a string. There is no gap here and no lint rule for
    it.
  - `PolicyBuilder.build()` throws at runtime without `withId`, `withDomain` and
    `withName`.

### Validation against the shared pattern catalogue (37 pattern files, 348 rules)

Manual classification by agents, not machine-checked:

| Class                                                        | Count | %   |
| ------------------------------------------------------------ | ----- | --- |
| Expressible as config with the initially proposed primitives | 135   | 39% |
| Expressible after adding a missing option                    | 89    | 26% |
| Cross-file (needs a project check or test)                   | 26    | 7%  |
| Custom rule code                                             | 14    | 4%  |
| Typed tier                                                   | 8     | 2%  |
| Already covered by boundary tools                            | 10    | 3%  |
| Not mechanical (stays in prose)                              | 66    | 19% |

- **About half of the expressible rules are forbid-syntax-in-role rules.**
  Existing ESLint rules such as `no-restricted-syntax`, `no-restricted-imports`
  and `naming-convention` cover them once they can be **scoped to a role**.
- **The rest need positive structure.** Examples are a required member, a
  constructor-parameter decorator, a required decorator on selected members,
  return-type shape, and waiver markers. These are project or convention code,
  not library primitives.
- **The pattern catalogue contradicts itself in ~37 places.** The catalogue
  belongs to the agent tooling, not to this library. Examples:

  - "private constructor" comments over public constructors;
  - "never throw in domain" next to "CORRECT" examples that throw;
  - `console.warn` in repositories against a no-console rule;
  - `selectAll` in a query repository that the same file forbids;
  - two incompatible answers to "where does `userId` enter a command".

  Encoding conventions before reconciling them would either cement the
  contradiction or flood agents with false positives.

## Design principle: the library knows only its own building blocks

The library ships **knowledge of what a class is** in terms of its own API. Each
project decides **what to require of it**, using the existing ESLint ecosystem,
not a new DSL invented here. Nothing in the library encodes a directory layout,
a project base-class name, or a convention such as "no throw in handlers".

### Delivered by the library (`@vytches/eslint-plugin-ddd`)

| Deliverable                           | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Role vocabulary + resolver**        | Aggregate, Entity, ValueObject, DomainEvent, IntegrationEvent, Command, Query, CommandHandler, QueryHandler, EventHandler, DomainService, Repository, Specification, Policy and ACLAdapter. Detection order: library decorator, then `extends`/`implements` resolved by import source (tsconfig `paths` read as JSON and cached), then an optional glob. Projects bind their own bases, facades and decorators to roles, and may declare custom roles that derive from library roles. The resolver is exposed as an API (`resolveRole`) so project tests and scripts can reuse it.                                                                                                                                                                                                                                                                                                                                                           |
| **`roleScoped(rule, role, options)`** | An adapter that scopes **any** existing ESLint rule to nodes inside classes of a role, by filtering the wrapped rule's reports (prior art: `eslint-rule-composer`). This single mechanism replaces most of the primitives drafted earlier.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Role-native rules**                 | Only rules that make no sense without roles: allowed bases per role, and a role confined to a layer or glob.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **`recommended` preset**              | Strictly **incorrect use of the library API**. Candidates, each sourced from an LLMGUIDE or anti-pattern section: `instanceof Result`; `new EntityId(…)` resolved by import source (there are two `EntityId` classes), with the deprecated statics as a separate `warn` rule; a class-level `@EventHandler` without `handle()`; imports of internal symbols (`internalLogger`, `EVENT_HANDLER_METADATA`, `/internal`) merged with deep subpath imports (port of `ddd-005`); and, as **opt-in outside `recommended`**, `PolicyBuilder.build()` without `withId`/`withName` (and `withDomain` unless `defaultDomain`). **Dropped by analysis D5:** `@EventHandler('string')` (the compiler already rejects it) and "an aggregate `apply()`-ing an `IntegrationEvent`" (no documentation source, and the NestJS dispatcher legitimately routes it to the global bus). Typed opt-in: discarded `Result`, and `@typescript-eslint/no-deprecated`. |
| **Config validation**                 | A role that matches nothing, or a bound base or decorator that cannot be resolved, is an **error**, not silence. This addresses the SA-M1 silent no-op and the drifted hook configs.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **Agent-oriented output**             | Message format `<what is wrong>. <why>. Fix: <instruction>. See: <LLMGUIDE anchor>`. Every rule has `meta.docs.url`, and projects can override `id`, `fix` and `see`, for example to carry a rule-card ID.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

### Not in the library (project, or a shared conventions package owned by the projects)

- **Conventions**, built from ecosystem rules wrapped by `roleScoped`:
  - no `throw` or `async` in a role or layer;
  - `create()` returns `Result`;
  - naming, imports, JSDoc, member ordering.
- **Positive-structure rules**, written as custom rules on top of the resolver:
  - `@Inject` on every constructor parameter;
  - required members;
  - `@BusinessRule` on selected methods;
  - `@Transactional` placement.
- **Waivers with markers** and detection of waivers added during a task:
  `eslint-disable … -- reason` plus `eslint-comments/require-description`, and a
  ratchet script.
- **Cross-file checks** (YAML ↔ code, `eventMap` ↔ events, `providers[]`, SQL
  migrations): project scripts and tests that call the library's resolver.
- **Agent wiring**: PreToolUse, PostToolUse and Stop hooks, the rule-card ↔
  rule-ID map, and a verifier that skips lint-covered rules.

## Enforcement layers: put each rule in the cheapest layer that can express it

| Layer          | Library contribution                                                                                                                                                                                                                                                                                                               | Status          |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| **Types**      | Additive, non-breaking API improvements: an `isOk(): this is Ok<T>` type guard on `Result`, typed decorators that constrain the decorated class shape, and possibly a typestate `PolicyBuilder`. (`@EventHandler` already takes only an event class, so no overload is needed.) Lint rules with autofix act as the migration path. | follow-up tasks |
| **Lint**       | This task.                                                                                                                                                                                                                                                                                                                         | VF-043          |
| **Startup**    | A `strict` mode in discovery (`VytchesExplorerService`) that reports unregistered handlers, events without an aggregate handler, and missing providers, in the same message format.                                                                                                                                                | follow-up task  |
| **Tests**      | Role-based architecture matchers in the testing package for cross-file and "majority" rules.                                                                                                                                                                                                                                       | follow-up task  |
| **Generators** | Role templates that projects can override, with the role config as input.                                                                                                                                                                                                                                                          | later           |

## Agent feedback loop (requirements on the library; wiring lives outside)

The hooks are not part of this library, but they constrain its design:

- **Per-edit speed.** Linting a single file in the untyped tier must fit a hook
  budget. The target is < 300 ms warm, to be measured in Phase 0. This implies
  `--cache` and a warm-process or daemon mode, because a cold ESLint start
  (Node + TS parser) costs about 1–2 s.
- **Machine-readable output.** JSON, filterable to errors only, to the edited
  file only, and to violations that are new against a baseline.
- **Two tiers.** The untyped tier runs in hooks. The typed tier (inheritance
  chains, `Result` flow) runs in layer gates and CI.
- **Hook moments.** PreToolUse can optionally reject a write on a hard error,
  using `lintText` on the proposed content. PostToolUse is the main path: it
  reports to the agent in the same turn. Stop/SubagentStop is the safety net
  before the agent declares itself done.

## Rules every rule must satisfy

1. **The message is an instruction to the agent**, not a description. It has
   `Fix:` and `meta.docs.url`, and a CI test checks both. The docs anchor must
   exist.
2. **Scope comes from roles, never from hard-coded paths.**
3. **A disable requires a justification and is visible.** Use `-- reason`-style
   descriptions and `reportUnusedDisableDirectives: error`.
4. **Introduction is by ratchet, never by rewrite.** New violations block; old
   ones are baselined.
5. **The default tier is untyped and fast.** Typed rules are opt-in.
6. **Every rule proves it runs.** A known-violation fixture is executed through
   the real CLI and the real config in CI, and zero findings counts as a failure
   (lessons from SA-M1, VF-037 and VF-038).
7. **Zero findings on documented usage.** The `recommended` preset must report
   nothing on `examples/`, LLMGUIDE snippets or READMEs. Any hit means the rule
   is imposing style, not catching misuse.

## Acceptance Criteria

1. [ ] **AC-SPIKE (Phase 0, gate).**
   - (a) End-to-end: a subagent writes an aggregate that violates a rule, the
     PostToolUse hook reports it, and the subagent fixes it **in the same
     turn**. This must work for subagents, not only the main session. **Result
     (2026-11-03, see "Spike logs" below):** ✅ the channel works for subagents,
     and the fix happens in the same turn only with a blocking channel
     (PreToolUse deny 4/4, PostToolUse block 5/7; advisory context 0/12 on
     Haiku).
   - (b) A `roleScoped` prototype with one forbid rule (via
     `no-restricted-syntax`) and one custom positive-structure rule, run on the
     primary consumer (read-only): < 300 ms per file warm, and ≥ 95% precision
     on a sample of 20 hits per rule. **Result (2026-11-03):** ✅ role
     resolution 100%, structural precision 40/40, warm p50 1.3 ms, cold
     single-file ~240 ms.
   - (c) A typed-decorator spike: can `@CommandHandler` constrain the class
     shape under `experimentalDecorators` (NestJS)?
   - (d) An ESLint 9 flat config load test, and a decision on eslintrc support.
     **Result so far (2026-11-05):** flat config on ESLint 9.39.2 ✅ (dogfood);
     eslintrc decided: flat only (analysis D3). Open: ESLint 10, and the
     cold-process measurement on the real package.
   - (e) A "before" baseline from a few completed consumer tasks: verifier
     findings that lint could have caught, and the number of fix rounds.
   - Outcome: the founder decides the final API shape.
2. [ ] **AC-RESOLVER.** The role resolver handles import-source resolution with
       tsconfig `paths`, facades and aliases, project bindings and custom roles.
       It has unit tests and exposes a public `resolveRole` API marked `@beta`.
3. [ ] **AC-SCOPED.** `roleScoped` works with at least `no-restricted-syntax`,
       `no-restricted-imports` and `@typescript-eslint/naming-convention`. The
       overhead is measured.
4. [ ] **AC-PRESET.** The `recommended` preset ships the API-usage rules listed
       above. Each rule has `RuleTester` tests and a real-CLI fixture, and the
       preset reports zero hits on documented examples.
5. [ ] **AC-VALIDATE.** Unmatched roles and unresolved bindings fail the lint
       run.
6. [ ] **AC-MESSAGES.** A CI test checks that every rule has `Fix:`, a
       `meta.docs.url` and an existing docs anchor.
7. [ ] **AC-DOGFOOD.** A sample conventions config, built only from
       `roleScoped`, ecosystem rules and at most a few custom rules, is run
       read-only on two consumers with different layouts (one plain, one
       monorepo with a facade). Report per-rule counts and precision. A rule
       moves to `error` only at ≥ 95% precision.
8. [ ] **AC-DOC.**
   - A plugin README.
   - A guide titled "binding your own base classes, decorators and layout".
   - A migration note for `tools/ddd-lint`.
   - A changeset.

### Spike log: AC-SPIKE (a), 2026-11-02

**Setup.** Nothing shared was touched. The shared hook directory and the global
settings were left alone, and nothing went into the project's
`.claude/settings.json`.

- The hook script lived in a session scratchpad and did nothing unless
  `VF043_SPIKE=1` was set.
- It was registered only for each run, via `claude -p --settings <file>`.
- It flagged any `throw new …Error` in `*/domain/*.ts` files. That stood in for
  a real rule.
- Each run used Haiku. A main agent delegated the work to a `general-purpose`
  subagent, and the prompt did not mention the rule.

There were two environments:

1. **A bare sandbox repo**, where no `Result` type exists.
2. **A detached worktree of a consumer application.** Project hooks were
   excluded with `--setting-sources user`, and `ECC_GATEGUARD=off` was set.
   Without it, the plugin's first-write gate would distort the result.

The control was a **shadow** mode, in which the hook logs findings without
injecting them.

**Channel (deterministic): passed.** In every run, the hook's
`hookSpecificOutput.additionalContext` appeared in the subagent's own transcript
(`subagents/agent-*.jsonl`), as a `hook_additional_context` attachment after
`Write`. That held for 4/4 sandbox runs and 3/3 consumer inject runs. The hook
payload carries `agent_id` and `agent_type`, so the hook can tell subagent edits
from main-session ones. Only `additionalContext` was tested. Plain stderr on
exit 0 is known not to reach the model.

**Behaviour in the consumer worktree (n=3 per arm, too small to be
conclusive):**

| Arm              | First write violated | Final file violates | Extra writes        | Cost per run |
| ---------------- | -------------------- | ------------------- | ------------------- | ------------ |
| shadow (control) | 1/3                  | 1/3                 | 0                   | ~$0.022      |
| inject           | 2/3                  | 1/3                 | +2 in the fixed run | ~$0.022      |

- In one inject run the subagent corrected the file to `Result.ok/fail` in the
  same turn. It made two more writes, and the third was clean.
- In the other flagged inject run the subagent did not fix the file. The main
  agent's delegation prompt had turned "rejects invalid input" into "throwing a
  domain error", and the subagent followed that explicit instruction. It did
  surface the conflict in its report and pointed to the project convention. The
  bare-sandbox runs showed the same pattern: the subagent kept code the prompt
  asked for explicitly, and could not fix code when the API in the `Fix:` text
  did not exist.

**Implications.**

- The feedback loop is technically viable for subagents, so the critical risk
  below is retired.
- The message alone does not beat a contradicting delegation prompt. The cause
  may be the orchestrator's wording, which turns intent into a mechanism, and
  not the hook.
- `Fix:` text must name an API that exists in the consumer. Generic advice
  fails.
- Next runs:
  - n≥10 per arm;
  - a Sonnet arm;
  - a wording variant that states the rule is a project convention that applies
    unless the task explicitly requires otherwise, and that conflicts must be
    reported;
  - one run through the real `/orchestrate` path, in a sandbox.

### Spike log: AC-SPIKE (a) follow-up, 2026-11-03 (70 runs)

The setup was the same as above. Each arm ran in its own detached consumer
worktree, and the prompt asked for a `VouchNote` value object whose factory
"rejects invalid input". A "violation" is any `throw new …Error` in the domain
file. The channel arms are:

- **inject:** PostToolUse `additionalContext`, no blocking.
- **convention:** the same channel, with wording that frames the rule as a
  project convention.
- **block:** PostToolUse `{"decision":"block","reason":…}`.
- **deny:** PreToolUse `permissionDecision: "deny"` on the _proposed_ `Write`
  content, so the file never lands.

| Arm              | Model  | n   | First attempt violates | Final file violates | Fixed in the same turn |
| ---------------- | ------ | --- | ---------------------- | ------------------- | ---------------------- |
| shadow (control) | Haiku  | 10  | 8                      | 7                   | (1 by itself)          |
| inject           | Haiku  | 10  | 4                      | 4                   | **0/4**                |
| convention       | Haiku  | 10  | 8                      | 8                   | **0/8**                |
| block            | Haiku  | 10  | 7                      | 2                   | **5/7**                |
| deny             | Haiku  | 10  | 4                      | 0                   | **4/4**                |
| shadow (control) | Sonnet | 5   | 0                      | 0                   | n/a                    |
| inject           | Sonnet | 5   | 1                      | 0                   | 1/1                    |

Cost: about $0.02 per run on Haiku and $0.38 on Sonnet. Two block runs cost
about $0.25 because the main agent got involved. The deny arm adds about one
extra write attempt and no measurable cost.

**Conclusions.**

1. **Delivery is not the problem; authority is.** The transcripts show the
   `additionalContext` reached the subagent in every run. A Haiku subagent
   receives it _after_ its final write and treats it as advisory: it reports the
   conflict and does not fix the file. That happened in 0/12 runs, and
   convention wording did not help.
2. **Blocking channels work.** PreToolUse deny fixed 4/4. The violating content
   never touches disk, and the agent rewrites the file in the same turn.
   PostToolUse `block` fixed 5/7.
3. **Sonnet rarely violates this rule** (1 in 10 runs) and fixed its one case
   from advisory context. The linter matters most for cheaper models and for
   long runs, which is where verifier cost accumulates.
4. **Design consequences for this task:**
   - The library must offer a fast path that lints _proposed_ content:
     `lintText` with a filename, which enables PreToolUse deny for `Write`. For
     `Edit`, the hook applies `old_string → new_string` to the current file
     first.
   - Hook policy, which belongs to projects and not to the library: errors →
     deny or block, warnings → `additionalContext`.
   - "Errors only" in the output is now a hard requirement. Blocking on noise
     would stall agents.
5. **Caveats:**
   - There is one task shape and one rule.
   - At n=10, the per-arm rates are indicative only.
   - During a roughly 10-second window, the PreToolUse registration changed
     while some arms were running. Final-file results are unaffected.

### Spike log: AC-SPIKE (b) roleScoped prototype, 2026-11-03

The prototype lives in the session scratchpad. It is about 150 LOC for the
resolver, plus the adapter and one role-native rule. It ran read-only on a
detached consumer worktree: 4,577 files under `src/contexts`, with ESLint 9.39
flat config and `@typescript-eslint/parser`, untyped.

- **Role resolution (untyped, by import source):** 100% agreement with a textual
  count of `extends` clauses. That covers:
  - library roles: Aggregate 60/60, ValueObject 209/209, EntityId 48/48;
  - project-bound roles, through a tsconfig `paths` alias and barrel re-exports:
    CommandHandler 347/347 and QueryHandler 182/182.
  - Specification resolved 324 of 331 `extends CompositeSpecification` clauses.
    The other 7 import from elsewhere, which is not yet verified.
- **Aliased imports matter.** The consumer writes
  `import { ContractsEntityId as BaseEntityId }`. Bindings must match the
  _exported_ name, so the library's built-in role vocabulary should list its
  real export names, including aliases.
- **Config validation works.** A project binding that points to a missing file
  is reported before linting starts. An early bug, where a project-file binding
  was treated as a package name and silently resolved 0 handlers, shows why
  AC-VALIDATE must fail on roles that match nothing.
- **`roleScoped` with `no-restricted-syntax`, plus a custom positive-structure
  rule (constructor not public):** 87 and 54 hits respectively. Structural
  precision was **40/40** on a random sample of 20 per rule: every hit was the
  targeted construct inside a correctly-roled class. Whether a hit is a _real_
  violation depends on the project's convention. Many VO `throw`s sit in
  `validate()`, which ties back to the open "VO factory throw vs Result"
  decision. This supports keeping such rules in project config and not in the
  library preset.
- **Speed:**
  - The full run took 8.0 s with the plugin against 7.0 s parser-only, so the
    overhead is about 0.2 ms per file.
  - Warm per-file timing, with an instance reused the way a daemon would: p50
    1.3 ms, p95 13 ms.
  - **A cold single-file process takes about 240 ms**, including Node start,
    ESLint load and parsing. That is within the 300 ms hook budget, so a daemon
    is optional for the untyped tier.
- Files with no class of a scoped role skip the wrapped rule entirely. That is
  where most of the low overhead comes from.

### Spike log: dogfood on a copy of the primary consumer, 2026-11-05

**Purpose.** Before publishing anything, run the planned rules against a
temporary copy of the primary consumer, deliberately break its code, and check
that every break is caught. Also encode the consumer's own conventions (its base
command handler, its specification decorator) as project rules and check those.

**Setup (nothing in either repository changed).** A detached git worktree of the
consumer's `develop`, removed afterwards. Corpus: 9217 `src/**/*.ts` files (6248
production). ESLint 9.39.2, `@typescript-eslint/parser` 8.68.0, flat config,
untyped, Node 24. Code and data lived in the session scratchpad, which was later
deleted (see "How to resume", item 5): **the numbers below are the only record
and cannot be re-derived from committed code.** Method: one injected violation
per run on a random real file, in memory, linted with `lintText` under the
original path. Each mutation was randomly prefixed or suffixed (plain, shebang,
BOM, CRLF and combinations; every variant ≥ 774 cases, all detected) and varied
(direct import, alias, namespace, project facade, second `paths` target,
relative path, `const` alias, `as any`, `import type`, `export default class`,
multi-line decorator, class expression, inheritance chains).

**Result.**

| Rule                                              | Positive mutations detected | False alarms on clean variants | Natural hits               | Precision of natural hits                   |
| ------------------------------------------------- | --------------------------- | ------------------------------ | -------------------------- | ------------------------------------------- |
| (a) `instanceof Result`                           | 252/252                     | 0/252                          | 0 (1797 `instanceof` seen) | n/a                                         |
| (b) `new EntityId`                                | 252/252                     | 0/252                          | 1                          | 1/1                                         |
| (b) deprecated `EntityId` statics (warn)          | 252/252                     | 0/252                          | 125 (81 files)             | 20/20 sampled, 125/125 by independent regex |
| (d) class `@EventHandler` without `handle()`      | 252/252                     | 0/252                          | 0 (201 classes seen)       | n/a                                         |
| (f+g) four import sub-rules, each                 | 252/252                     | 0/252 (shared pool)            | 0                          | n/a                                         |
| (e) `PolicyBuilder.build` required calls (opt-in) | 252/252                     | 0/252                          | 0 (65 chains seen)         | n/a                                         |
| project: no `throw` in a command handler          | 252/252                     | 0/252                          | 55 (36 files)              | 20/20 sampled                               |
| project: `Specification` requires `@BusinessRule` | 252/252                     | 0/252                          | 28 (18 files)              | 20/20 sampled                               |
| project: no `@nestjs/*` import in domain roles    | 252/252                     | 0/252                          | 0                          | n/a                                         |
| **Total**                                         | **3024/3024**               | **0/2268**                     |                            |                                             |

- **Role resolution.** For 5555 classes the resolver's role set equals an
  independent text scanner's (extends/implements/decorators with name-based
  inheritance closure): 0 differences. 1998 classes carry a role. Chains through
  project classes: 15 classes with 2 hops, 8 with 3, 1 with 4. All imports
  resolved (6137/6137 `@vytches/*`; 63,686/63,688 project, the two misses being
  `.json` files).
- **Config validation (AC-VALIDATE).** Five kinds of bad binding (missing file,
  file without the export, export missing in the library, unknown package,
  missing name) abort plugin creation with a readable `DddConfigError`. The same
  typo without validation returned `roles = [[]]` for a real query handler: a
  silent no-op.
- **Is 100% meaningful?** Four deliberately broken resolvers (no scope check, no
  cast unwrapping, no `const` alias, no namespaces) drop the same harness to
  67–93%, so the harness does detect regressions. The first 33 "false alarms"
  and 169 role mismatches were harness bugs (an appended `@nestjs/*` import
  correctly tripping the project rule; a text scanner reading the word `class`
  in strings), fixed in the harness, not in the rules.
- **Library code as a negative.** On the library's own 305 source files (32
  import `/internal`), the `/internal` rule gave 0 false alarms because the
  nearest `package.json` name is `@vytches/ddd*`; the same files presented under
  a consumer path gave 28/28 hits.
- **Timing, cold process** (30 runs, external wall clock, `lintText`, nine
  rules, all bindings), median / p95 in ms: `node -e 0` 13 / 14; loading ESLint
  plus parser only 209 / 228; file with no roles 245 / 275; one role 257 / 285;
  handler whose base is reached through several barrels (11 parses, 48 reads)
  292 / 314. **The last case is slightly over the 300 ms target.** Full run over
  all 9217 files in one process: parsing alone 22.0 s; all nine rules 30.1 s
  (+47%).
- **Project rules on the consumer's real code.** "No `throw` in a command
  handler" is correct syntactically but fires on the consumer's deliberate
  rollback idiom (55 hits), so it needs a ratchet, not `error`. "Specification
  without `@BusinessRule`" found 28 genuine departures from a documented
  convention.

**Not closed by this spike.**

- Zero natural hits for (a), (d), (f+g), (e) and the domain-import rule, so
  their precision rests on mutations, the documentation corpus (earlier spike)
  and independent regexes, not on natural violations.
- The judge for the two project convention rules is a text scanner with the same
  rule definition (different implementation, same definition).
- Known unsupported shapes: destructuring, dynamic aliases, a `PolicyBuilder`
  chain split across variables.
- One consumer, one machine; timing is from a prototype, not from the future
  package.

**Consequences for the plan (already applied in the analysis):** D10 corrected
(library import rules run on every file); D5 corrected ((b) split, (e) promotion
criterion); D12 extended (string-aware JSONC, BOM, scope, unwrapping); ratchet
required for convention rules that hit deliberate idioms.

## Phases

- **Phase 0, gate (1–1.5d):** AC-SPIKE. Nothing else starts until the founder
  signs off on its outcome.
- **Phase 1 (~3d):** AC-RESOLVER, AC-SCOPED, AC-PRESET, AC-VALIDATE,
  AC-MESSAGES.
- **Phase 2 (~2d):** AC-DOGFOOD, AC-DOC, typed tier for the preset's typed
  rules.

## Measurement

Measure the "before" state in Phase 0 (AC-SPIKE e) and repeat after consumer
adoption:

1. Bytes of rule cards injected per agent spawn.
2. Verifier findings per task that fall into lint-covered rules (target ≈ 0).
3. Fix rounds, spawns and tokens per merged task.
4. The share of `eslint-disable ddd/*` directives added during tasks. This
   should stay near 0. Growth means agents are routing around the linter.

The hypothesis fails if the cards shrank and the cost per task did not drop. In
that case the cost lives elsewhere, and we should say so.

## Risks

| Risk                                                                        | Likelihood         | Impact       | Mitigation                                                                                                |
| --------------------------------------------------------------------------- | ------------------ | ------------ | --------------------------------------------------------------------------------------------------------- |
| The hook result does not reach subagents, so there is no immediate feedback | ~~medium~~ retired | **critical** | AC-SPIKE (a) channel check passed on 2026-11-02 (see Spike log)                                           |
| A delegation prompt that contradicts a rule wins over the lint message      | medium             | high         | spike wording variants; put rule-aware wording in orchestrator delegation templates (outside the library) |
| False positives erode trust and agents start adding disables                | medium             | high         | 95% precision gate; mandatory reasons; detection of disables added during a task                          |
| Conventions are encoded before the pattern catalogue is reconciled          | high               | high         | reconcile first (out-of-repo prerequisite)                                                                |
| `roleScoped` is too slow or fragile with some wrapped rules                 | medium             | medium       | Phase 0 prototype; document supported rules                                                               |
| The public extension API turns out wrong after the first real consumer      | high               | medium       | mark it `@beta` until two consumers have built on it                                                      |
| ESLint 8 vs 9 split among consumers                                         | high               | medium       | flat config and ESLint 9+ as the target; eslintrc support decided in Phase 0                              |
| Silently dead rules                                                         | medium             | high         | real-CLI fixture rule; config validation                                                                  |
| Scope creep toward a generic lint framework                                 | medium             | medium       | the design principle above: positive-structure rules and checks stay out of the library                   |

## Open decisions (founder)

**All four are resolved by the `/analyze` run (2026-11-05); the options below
are kept as history.** Mapping: 1 → analysis Q7/D7 (`tools/ddd-lint` stays, 005
moves to the preset, 001–003 become project examples); 2 → Q8/D8 (the
constructor may throw, the non-throwing variant is a separate method returning
`Result`, docs fixed in a separate task); 3 → Q4/D3 (flat config only); 4 →
Q6/D6 (the vocabulary stays inside the plugin package).

1. **Fate of `tools/ddd-lint`.** Its rules are conventions (001, 002, 003) plus
   one API-usage rule (005). Options: port 005 into the preset, hand 001–003 to
   the conventions side as examples, and deprecate the tool. Or keep it as the
   library's internal linter.
2. **Value-object factory.** `throw` (as documented) versus returning `Result`
   (as some conventions demand). This is not a library lint decision, but the
   docs should state the library's position explicitly.
3. **eslintrc support.** Flat-only, or a legacy config export too?
4. **Placement of the role vocabulary.** Inside the plugin package, or in a tiny
   separate package that runtime and testing can also import?

## Follow-up directions (separate tasks, not in scope here)

- **Types first:**
  - an `isOk()` type guard on `Result`;
  - typed handler decorators;
  - a `PolicyBuilder` typestate (check whether it can be done without a breaking
    change).
- **Startup `strict` mode** in discovery: wiring verification with the same
  message format.
- **Architecture-test matchers** on top of the role resolver, in the testing
  package.
- **`init` / `doctor` CLI.** `init` infers role bindings from an existing
  codebase. `doctor` shows what each role matches and what is unresolved.
- **ADR: composition instead of copied base handlers.** A handler pipeline or
  middleware for logging, transaction and context would remove the "wrong base
  class" error category, which is the most common review finding, at its source.
  Persistence adapters stay out of the library.
- **Generators**, with the role config as input.
- **Lint documentation code blocks** (LLMGUIDE, README) with the preset, so the
  docs cannot drift from the rules.
- **Fix the documentation rot:** the stale `CONSUMER-USAGE.md`, and deleting
  `.eslintrc-quality-gates.json` and the unused plugin.

## Non-goals

- Project or domain rules (geo, trust, error-code chains, business-rule
  registries). These live in consumers or in a shared conventions package.
- Replacing dependency-cruiser, `eslint-plugin-boundaries`,
  `@nx/enforce-module-boundaries` or cross-file conformance tooling.
- Changing `Result` semantics as part of this task.
- Agent-tooling changes (hooks, verifier, rule cards). These belong to the
  agent-conventions repository.
- Consumer adoption, ESLint 9 migration of consumers, and card shrinking.

## Links & References

- `project-orchestration/analysis/VF-043-spike/`: Phase 0 prototype code (role
  resolver, `roleScoped`, hook probe), reference only.
- `tools/ddd-lint/README.md`, `tools/ddd-lint/CONSUMER-USAGE.md`
- `project-orchestration/analysis/VF-026-ddd-lint-anti-pattern-rules.analysis.md`
  (`ddd-004` cut, `ddd-005`, SA-M1)
- `project-orchestration/tasks/VF-034-dead-code-detection-ci.md`,
  `project-orchestration/tasks/VF-038-jsdoc-lint-lane.md`. VF-038 also touches
  ESLint wiring; align both so we do not end up with two plugin-loading styles.
- `packages/*/LLMGUIDE.md` anti-pattern sections and `docs/llm-context.md` §
  Critical Anti-Patterns: the source for the `recommended` preset.
- `.eslintrc.json`, `.eslintrc-quality-gates.json` (dead),
  `.eslintrc-jsdoc.json` (dead)
- Prior art:
  - jMolecules + jmolecules-archunit (Java): a library DDD vocabulary, rules
    shipped with the library, and projects marking their own types;
  - `eslint-rule-composer`, for report filtering;
  - `eslint-plugin-boundaries`, Sheriff and dependency-cruiser, for declarative
    boundaries.
- Böckeler, _Harness engineering for coding agent users_ (martinfowler.com):
  deterministic controls first.
