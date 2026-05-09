# @vytches/ddd-lint

AST-based linter that flags the top 3 DDD anti-patterns in TypeScript code:

| Rule      | Severity  | What it catches                                                                               |
| --------- | --------- | --------------------------------------------------------------------------------------------- |
| `ddd-001` | `error`   | Public/mutable property declarations on classes that extend `AggregateRoot` or `Entity`.      |
| `ddd-002` | `error`   | `throw` statements inside files under `/domain/`, `/aggregates/`, `/value-objects/`, etc.     |
| `ddd-003` | `warning` | Static `create()` methods whose return type is not `Result<T, E>` or `Promise<Result<T, E>>`. |

VF-001 MVP — internal tooling, not published to npm. Designed for the
`@vytches/ddd` consumer monorepos to catch the cheapest DDD-compliance mistakes
in CI before they enter the codebase.

## Quick start

From the monorepo root:

```bash
pnpm ddd:lint              # scan the whole repo
pnpm ddd:lint packages/    # scan a subtree
```

Programmatic use:

```typescript
import { runLint, formatResult } from '@vytches/ddd-lint';

const result = runLint({ root: '/abs/path/to/project' });
console.log(formatResult(result));
process.exit(result.issues.some(i => i.severity === 'error') ? 1 : 0);
```

## Scope and trade-offs

This is a **heuristic** linter, not a type-aware analysis. It reads source
files, builds a `ts.SourceFile` AST, and pattern-matches on syntactic shape — no
type checker, no symbol resolution. That keeps it fast (full monorepo scans in
<1s) and dependency-light.

Consequences:

- **Heritage detection is name-based.** `class Order extends AggregateRoot`
  triggers rule 1; `class Order extends MyAggregateBase` (where the base itself
  extends `AggregateRoot`) does not. For projects with custom aggregate base
  classes, fork the rule or extend the heuristic.
- **Domain-folder detection is path-based.** Code outside the conventional
  `/domain/`, `/aggregates/`, `/value-objects/`, `/specifications/`, or
  `/policies/` directories is not treated as domain code by `ddd-002`.
- **Factory detection is name-based.** Only `static create()` is checked by
  `ddd-003`. `static fromX()`, `static of()`, etc. are exempt because they often
  have specialized semantics. Suppress per file with
  `// ddd-lint-disable factory-must-return-result` near the top.

## Adding new rules

```typescript
import type { LintRule } from '@vytches/ddd-lint';

export const myRule: LintRule = {
  id: 'ddd-100',
  description: '...',
  run({ sourceFile, filePath }) {
    /* return LintIssue[] */
  },
};
```

Then pass `rules: [...BUILT_IN_RULES, myRule]` to `runLint`.

## CI integration

**Recommended adoption: informational → blocking-soon → blocking.** Running the
lint as a hard gate from day one is "cry wolf": every existing violation in the
codebase blocks every PR, so developers turn it off. Stage the rollout instead:

1. **Informational** (initial): `pnpm ddd:lint || true`. Surface the output in
   PR comments / CI logs. Track the error count over time.
2. **Blocking-soon**: once the error count is below ~5 and trending down,
   announce a merge gate date.
3. **Blocking**: `pnpm ddd:lint`. Treat new errors as build failures.

```yaml
- name: DDD compliance (informational)
  run: pnpm ddd:lint || true
```

Exit codes:

- `0` — no errors (warnings allowed)
- `1` — at least one error-severity violation
- `2` — argument or filesystem error
