# Task: Bring @vytches/ddd-nestjs under the api-surface gate

## Task Metadata

```yaml
task_id: VF-040
title:
  'tooling: add packages/nestjs/api-extractor.json + committed baseline, wire it
  into validate:api and validate:api:local'
type: chore
priority: medium
complexity: low
estimated_time: 2h
created_by: VF-032b outcome (panel finding, 2026-08-20)
created_at: 2026-08-21
status: done
completed_at: 2026-08-21
release_target:
  pre-first-publish — the gate is worthless if it starts after the surface it is
  meant to protect has already shipped
package: '@vytches/ddd-nestjs, repo-root package.json'
findings: [VF-032a panel, VF-032b outcome]
```

## Why

Found by the `library-api-guardian` panel during VF-032a and confirmed in the
working tree: `validate:api` / `validate:api:local` run api-extractor for
exactly four packages — `contracts`, `events`, `enterprise`, `value-objects`.
`packages/nestjs/` has no `api-extractor.json` and appears in neither chain, nor
in `validate:api:prepare`.

So the public surface of the package consumers touch _first_ — the NestJS
integration — has no automated drift detection at all. VF-032a and VF-032b added
seven exported symbols to it (`VytchesDDDModuleAsyncOptions`,
`VytchesDDDOptionsFactory`, `VytchesDDDFeatureOptions`, and four error classes)
and nothing but manual review stood between them and the published API.

This is worth closing before the first publish, not after: a baseline created
now records the surface as it is meant to ship; a baseline created later records
whatever drifted in the meantime and calls it correct.

## Acceptance Criteria

1. [x] `packages/nestjs/api-extractor.json` exists, extending
       `../../api-extractor.base.json` like the other four.
2. [x] `packages/nestjs/api-report/ddd-nestjs.api.md` committed as the baseline.
3. [x] `validate:api:prepare` builds `@vytches/ddd-nestjs` too.
4. [x] Both `validate:api` (compare, read-only) and `validate:api:local`
       (regenerate) run the new config. The compare/regenerate split from VF-037
       must be preserved — `validate:api` must not mutate the baseline.
5. [x] `pnpm run validate:api` passes against the committed baseline, and the
       baseline contains the symbols VF-032a/VF-032b added.
6. [x] Re-running `validate:api` twice in a row stays green (no self-inflicted
       drift from line endings or formatting — see the `newlineKind` and
       `.prettierignore` notes in `api-extractor.base.json`).

## Out of scope

- Bringing the remaining 14 packages under the gate. Same argument applies to
  them, but each needs its own baseline review; this task closes the one the
  audits actually flagged.

## References

- `completed-tasks/VF-032b-nestjs-convergence-errors-example.md` — "Follow-up
  worth filing"
- `api-extractor.base.json` — shared policy (VF-037)

## Outcome (2026-08-21)

All six criteria met. `pnpm run validate:api` now covers five packages and
passes; the baseline contains everything VF-032a/VF-032b added
(`VytchesDDDModuleAsyncOptions`, `VytchesDDDOptionsFactory`,
`VytchesDDDFeatureOptions`, `VytchesNestJSError` and its three subclasses,
`forRootAsync`, the new `forFeature` signature).

**This needed more than a config file, and the reason is worth recording.** The
obvious three-line `api-extractor.json` failed with an api-extractor 7.57.8
internal defect:

```
ERROR: Internal Error: Unable to determine semantic information for declaration:
packages/messaging/src/outbox/outbox-processor.ts:145:13
```

Cause: `tsconfig.base.json` maps every `@vytches/*` import to the dependency's
**TypeScript source**. That is correct for building and testing, but it means
api-extractor — which analyses `dist/index.d.ts` — follows those paths back into
`src/` and recompiles the entire source of every dependency. On
`@vytches/ddd-messaging` it then trips over ordinary destructuring.

Probed rather than assumed: removing the destructuring at :145 moved the error
to the next destructuring at :339. So working around the defect in product code
would have meant rewriting every destructuring statement in the dependency graph
— for a tooling bug.

The fix is `packages/nestjs/tsconfig.api-extractor.json`, which redirects the
dependency paths to their emitted `.d.ts`. This is the correct configuration
independent of the defect: an API-surface gate should read the _published_ shape
of its dependencies, exactly as a consumer does, rather than recompiling their
internals. The defect simply stops being reachable.

**Note for whoever extends the gate to the remaining 14 packages** (explicitly
out of scope here): they will hit the same wall the moment a package depends on
`messaging`, and the same per-package tsconfig is the answer. If it spreads
beyond two or three packages, promote it into `tsconfig.base.json` as a shared
`tsconfig.api-extractor.base.json` rather than copying it — the same reasoning
that produced `api-extractor.base.json` in VF-037.

Verified: compare mode (`validate:api`) leaves the baseline untouched, so the
VF-037 compare/regenerate split holds; two consecutive runs stay green (no
line-ending or formatting self-drift).
