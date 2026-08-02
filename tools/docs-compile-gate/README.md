# @vytches/docs-compile-gate

VD-005 (AC11) — type-checks TypeScript code fences embedded in
`README.md`/`LLMGUIDE.md` files against the repo's REAL package source (via
`tsconfig.base.json`'s `@vytches/ddd-*` path mapping), catching exactly the
drift class fixed by VD-005's "Code & Snippets" layer before it lands again:
wrong constructor argument order, methods that don't exist, renamed config
fields.

## The marker convention (opt-in, v1)

Only a fence carrying the `compile-check` token in its info string, on a
`ts`/`typescript` language tag, is ever type-checked:

````markdown
```ts compile-check
import { AggregateRoot } from '@vytches/ddd-aggregates';

class Order extends AggregateRoot {
  // ...
}
```
````

A plain ` ```ts ` fence — the vast majority in this repo — is discovered but
**left completely alone**. This is deliberate (decision D-2, VD-005 analysis):
most fences are intentionally partial or illustrative snippets, not complete
compilable units, and hard-failing on those would flood every PR with false
positives. Marking a fence is an explicit author decision: "this one is a real,
runnable, self-contained example — hold it to that standard."

`compile-check` on a non-TypeScript fence (e.g. a `bash compile-check`
copy-paste slip) is silently ignored, never checked — the marker only means
anything paired with `ts`/`typescript`.

### Constraint: each marked fence must be self-contained

Every `compile-check` fence is compiled as an **independent** unit — it does not
see declarations from an earlier fence in the same document, even if that fence
is also marked. If a tutorial needs multi-step state building up across several
fences, either:

- repeat the necessary setup inside each marked fence, or
- keep the connecting fences unmarked (illustrative only) and mark just the one
  fence that must stay correct (e.g. a constructor call or a config object
  literal).

## Usage

From the monorepo root:

```bash
pnpm docs-compile-gate:check          # scan the whole repo (CI mode)
tsx tools/docs-compile-gate/src/cli.ts packages/aggregates   # restrict to a path
```

Programmatic use:

```typescript
import { run } from '@vytches/docs-compile-gate';

const result = run('/abs/path/to/repo');
console.log(result.ok, result.fencesChecked, result.diagnostics);
```

Exit codes:

- `0` — clean: every marked fence found compiled without error, including the
  common case of zero marked fences existing yet (opt-in — nothing marked is a
  valid, passing state, not a warning).
- `1` — at least one marked fence failed to type-check.

## How it works

1. **Discover** — walk the repo (or a given subtree) for `README.md` /
   `LLMGUIDE.md` files (`discovery.ts`).
2. **Extract** — line-scan each file for fenced code blocks, honoring
   CommonMark's fence-length rule (a 4-backtick fence can safely contain a
   literal triple-backtick example inside it), and classify each fence's info
   string for the `compile-check` marker (`extractor.ts`).
3. **Check** — every marked fence becomes a synthetic in-memory `.ts` file; a
   single `ts.Program` is built over all of them on a `CompilerHost` that layers
   those virtual files on top of the real filesystem, so
   `import { X } from '@vytches/ddd-aggregates'` resolves through
   `tsconfig.base.json`'s real `paths` map to actual package source
   (`checker.ts`, `compiler-options.ts`).
4. **Report** — diagnostics are mapped back from the virtual file's line/column
   onto the ORIGINAL Markdown file's line/column, grouped by file (`report.ts`).

## Relationship to tools/example-matrix

This is a different mechanism, not a reuse of example-matrix: example-matrix
AST-parses real, already-compiled `examples/*/src/*.ts` files to check that a
declared package **combination** has a backing file + passing test.
docs-compile-gate extracts and independently compiles **inline Markdown fences**
that were never real files to begin with. Both live under `tools/` and follow
the same CLI/`--check`/CI-wiring shape by convention, but they solve unrelated
problems.

## CI integration

Wired as a blocking PR check (`pnpm docs-compile-gate:check` in
`.github/workflows/ci.yml`) from day one — unlike `tools/ddd-lint`'s staged
informational → blocking-soon → blocking rollout, there is no "cry wolf" risk
here: the opt-in marker means the check starts at zero marked fences and can
never fail on pre-existing, unmarked documentation. It only starts producing
failures once someone deliberately marks a fence, at which point a failure is
exactly the point.
