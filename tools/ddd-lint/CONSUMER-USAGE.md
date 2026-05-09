# Using ddd-lint in your @vytches/ddd application

`ddd-lint` is currently a **workspace-private tool** inside the `@vytches/ddd`
monorepo (`tools/ddd-lint/`). It is not yet published to npm because the publish
chain is parked pending maintainer setup (REL-000, REL-003, REL-011).

This guide shows three ways to run the same 3 rules — `ddd-001`
(no-mutable-state-in-aggregate), `ddd-002` (no-throw-in-domain), `ddd-003`
(factory-must-return-result) — inside your own application that consumes
`@vytches/ddd`. Pick the option that matches where you are in the adoption
curve.

---

## Option 1 — Vendor the rules (recommended today)

While `@vytches/ddd-lint` is not on npm, the cheapest path is to copy 6 files
into your project's tooling folder. Total ~600 lines, dependency on `typescript`
only (which you already have).

```bash
# in your consumer project root
mkdir -p tools/ddd-lint/{src,bin}
mkdir -p tools/ddd-lint/src/rules

# Copy from this repo (adjust the path for your local clone or use a
# raw GitHub URL when ddd-lint becomes public)
cp $VYTCHES/tools/ddd-lint/src/types.ts                            tools/ddd-lint/src/
cp $VYTCHES/tools/ddd-lint/src/runner.ts                           tools/ddd-lint/src/
cp $VYTCHES/tools/ddd-lint/src/cli.ts                              tools/ddd-lint/src/
cp $VYTCHES/tools/ddd-lint/src/index.ts                            tools/ddd-lint/src/
cp $VYTCHES/tools/ddd-lint/src/rules/no-mutable-state-in-aggregate.ts \
   tools/ddd-lint/src/rules/
cp $VYTCHES/tools/ddd-lint/src/rules/no-throw-in-domain.ts         tools/ddd-lint/src/rules/
cp $VYTCHES/tools/ddd-lint/src/rules/factory-must-return-result.ts tools/ddd-lint/src/rules/
```

Then add to your root `package.json`:

```json
{
  "scripts": {
    "ddd:lint": "tsx tools/ddd-lint/src/cli.ts src"
  },
  "devDependencies": {
    "tsx": "^4.20.0",
    "typescript": "^5.8.0"
  }
}
```

Run:

```bash
pnpm ddd:lint              # scans ./src
pnpm ddd:lint packages     # scans ./packages
```

**Pros**: zero external dependency on @vytches/ddd-lint publishing. Works today.
You own the rules and can extend them. **Cons**: vendoring drift — when new
rules ship upstream, you re-copy. Mitigate with a short README in
`tools/ddd-lint/` noting the upstream commit you copied from.

---

## Option 2 — Wait for npm publish (post-REL-000)

Once `@vytches/ddd-lint` lands on npm, install it as a dev dependency:

```bash
pnpm add -D @vytches/ddd-lint
```

Then your `package.json`:

```json
{
  "scripts": {
    "ddd:lint": "ddd-lint src"
  }
}
```

The published package will ship a built CLI (no `tsx` needed), so this becomes a
one-line setup.

**Status today**: parked. Track REL-000 / REL-003 / REL-011 in
`project-orchestration/tasks/` for ETA.

---

## Option 3 — Run it from a checked-out monorepo

If your team works on both `@vytches/ddd` and the consumer app side by side
(common during library development), run ddd-lint directly from the monorepo:

```bash
cd /path/to/vytches-ddd
pnpm tsx tools/ddd-lint/src/cli.ts /path/to/your-app/src
```

Useful for one-off scans during refactor; not a long-term CI fit.

---

## Customization for your domain

The default rules use simple path heuristics:

- `ddd-002` flags throws inside `/domain/`, `/aggregates/`, `/value-objects/`,
  `/specifications/`, `/policies/`.
- `ddd-001` matches classes with `extends AggregateRoot` or `extends Entity`
  literally — generic arguments are fine, but custom base classes (e.g.,
  `MyOrgAggregate`) require a fork of the rule.

To extend either:

1. Copy `src/rules/no-mutable-state-in-aggregate.ts` to a new file.
2. Add your base class names to the `isAggregateOrEntity()` check.
3. Register the new rule in `src/runner.ts` `BUILT_IN_RULES`.

To add a new rule entirely, create a file under `src/rules/` exporting:

```typescript
import type { LintRule } from '../types';

export const myRule: LintRule = {
  id: 'ddd-100',
  description: 'What this rule enforces.',
  run({ sourceFile, filePath }) {
    /* return LintIssue[] */
  },
};
```

Then add it to `BUILT_IN_RULES` in `src/runner.ts`.

---

## CI integration — staged adoption

Don't make ddd-lint a hard gate from day one — your existing codebase will have
violations, and developers learn to ignore noisy gates. The recommended rollout:

1. **Informational** (week 1): `pnpm ddd:lint || true`. Surface output in PR
   comments / CI logs. Track the error count over time.
2. **Blocking-soon** (when error count ≤ 5 and trending down): announce a merge
   gate date.
3. **Blocking** (after the cleanup sprint): `pnpm ddd:lint` as a hard gate.
   Treat new errors as build failures.

Exit codes: `0` clean, `1` errors, `2` invalid args.

---

## Suppressing rule warnings per-file

For `ddd-003` only:

```typescript
// ddd-lint-disable factory-must-return-result
class Money {
  static create(amount: number): Money { ... }
}
```

Other rules don't yet support per-file suppression; if you need them, extend the
rule using the suppress check pattern from `factory-must-return-result.ts`.

---

## What ddd-lint does NOT detect

These are stretch goals or out of scope for the heuristic-only MVP:

- Custom aggregate base classes (need to extend `isAggregateOrEntity`)
- Setters that mutate internal fields (`setX`-style methods)
- Object/array mutation through methods on `readonly` fields
- Public methods named `create` that aren't actually factories
- Cross-file ubiquitous-language consistency
- Repository pattern compliance (e.g., domain logic leaking into `findById`)

These are tracked under VF-001 full scope in
`project-orchestration/tasks/VF-001-ddd-validation-tools.md`.
