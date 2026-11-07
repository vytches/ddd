# @vytches/eslint-plugin-ddd

ESLint plugin for projects built on `@vytches/ddd`. It does two jobs:

1. A small `recommended` preset that catches **incorrect use of the library
   API**. It does not impose a style.
2. A **DDD role model** (which class is an aggregate, a command handler, ...)
   plus `roleScoped`, so you can aim any ESLint rule at a role, and an **agent
   lane** (`/agent`) that lets a project hook feed findings back to a coding
   agent.

> **Status: beta.** Symbols marked `@beta` may change in a minor release. The
> package ships with `private: true` until it has been validated on real
> projects.

## Requirements

- ESLint `^9.39.0 || ^10.0.0`, **flat config only**. There is no `eslintrc`
  export.
- A Node version supported by your ESLint (ESLint 10 needs a newer Node than
  ESLint 9).
- Optional: `@typescript-eslint/parser` `^8` (needed to lint TypeScript, and by
  `validateRoleConfig` and the agent lane when you do not pass your own config).
- No runtime dependencies. The package does not need `typescript`.

## Install

```bash
pnpm add -D eslint @typescript-eslint/parser @vytches/eslint-plugin-ddd
```

## Quick start

```js
// eslint.config.mjs
import tsParser from '@typescript-eslint/parser';
import { configs } from '@vytches/eslint-plugin-ddd';

export default [
  {
    files: ['**/*.ts'],
    languageOptions: { parser: tsParser },
  },
  configs.recommended,
];
```

The preset sets no parser, no `files` and no `settings`, so it composes with
your own setup. The plugin is registered as `ddd`: rules are `ddd/<rule>`.

All exports are **named** (there is no default export). From CommonJS use
`const { configs } = require('@vytches/eslint-plugin-ddd')`.

```ts
import { configs, plugin, rules, meta } from '@vytches/eslint-plugin-ddd';
```

## Rules

Severity is the one a preset gives the rule. The agent lane reports errors only,
so a `warn` rule never reaches the agent.

| Rule                                    | Severity | In `recommended` | What it catches                                                                          |
| --------------------------------------- | -------- | ---------------- | ---------------------------------------------------------------------------------------- |
| `ddd/no-instanceof-result`              | error    | yes              | `x instanceof Result` (class identity differs across bundles)                            |
| `ddd/no-deprecated-entity-id-factories` | warn     | yes              | Static `EntityId` factories marked `@deprecated`                                         |
| `ddd/event-handler-requires-handle`     | error    | yes              | A class decorated with `@EventHandler` that has no `handle()` (class form, no `extends`) |
| `ddd/no-internal-imports`               | error    | yes              | Imports of internal symbols and deep or `/internal` subpaths of library packages         |
| `ddd/no-new-entity-id`                  | error    | no               | `new EntityId(...)` (resolved by import source; there are two `EntityId` classes)        |
| `ddd/policy-builder-required-calls`     | error    | no               | `PolicyBuilder.build()` without `withId` / `withName` / a domain                         |

`ddd/no-new-entity-id` and `ddd/policy-builder-required-calls` are opt-in. A
rule joins `recommended` only after its precision is measured on natural hits
from real projects.

Every message reads `<what is wrong>. <why>. Fix: <instruction>. See: <link>`,
and every rule has `meta.docs.url`. Per-rule pages:
[`docs/rules/`](./docs/rules). Each rule accepts `{ id, fix, see }` to change
what the agent reads (for example to carry a rule-card id); that never changes
what is reported.

Symbols are resolved **by import source, never by class name**: aliases,
namespace imports, `export * as`, barrel re-exports, tsconfig `paths` and
project facades are followed. A parameter, class or constant that merely shares
the name `Result` is not the library's `Result`.

### Not supported (the rules stay silent, no false alarm)

- Destructuring a static (`const { createText } = EntityId`).
- Dynamic aliases (a symbol chosen at runtime).
- A `PolicyBuilder` chain split across variables.

## Roles

A role is decided by a **binding**: a package plus an exported name. `extends`,
`implements` and a class decorator are the sources of a binding, and the
resolver follows them through your own classes (a project `BaseAggregate` that
extends the library's `AggregateRoot` carries the `Aggregate` role). The
built-in vocabulary is listed in [`LLMGUIDE.md`](./LLMGUIDE.md).

```ts
import { createRoleResolver, resolveRole } from '@vytches/eslint-plugin-ddd';

const resolver = createRoleResolver({ cwd: process.cwd() });
// roles of one class node of an already parsed file
const roles = resolveRole({ resolver, program, filename, node });
```

### `settings.ddd`

```js
export default [
  {
    files: ['**/*.ts'],
    settings: {
      ddd: {
        bindings: [
          {
            role: 'Aggregate',
            extends: {
              from: 'src/shared/base.aggregate.ts',
              name: 'BaseAggregate',
            },
          },
        ],
        tsconfig: 'tsconfig.json', // or false
        includeLibraryRoles: true,
        maxDepth: 6,
      },
    },
  },
];
```

If your project imports through path aliases (for example `@shared/*` in
`tsconfig.json` `paths`), set `tsconfig: 'tsconfig.json'`. Without it the
resolver cannot follow an aliased import to your base class, and the classes
that extend it silently get no role (in one real project only 15 of 347 events
were recognised with `tsconfig: false`).

A binding that points to a missing file or export fails the run with a
`DddConfigError` listing every problem (a silently dead rule is
indistinguishable from a clean codebase). Unknown keys are rejected with a "did
you mean" hint.

### `roleScoped`

`roleScoped(rule, role, { resolver, scope })` aims any ESLint rule at classes of
one or more roles. You pass the rule; the plugin never imports ESLint's
built-ins.

```js
import { roleScoped, resolverFromSettings } from '@vytches/eslint-plugin-ddd';

const noThrowInAggregate = roleScoped(noRestrictedSyntaxRule, 'Aggregate', {
  resolver: resolverFromSettings,
  scope: 'class', // default: keep only reports inside such a class
});
```

- `scope: 'class'` keeps only reports located inside a class of the role.
- `scope: 'file'` runs the rule on the whole file when the file contains such a
  class (for example "no framework import in domain files").

Do **not** wrap the library import rules in `roleScoped`: an import can sit in a
file that has no role class, so they run on every file.

### Validating the role configuration

Resolvability of bindings is checked on every run (cheap, cached). "This role
matches nothing" is a gate check, not a per-file one:

```js
import {
  validateRoleConfig,
  roleConfigFromSettings,
} from '@vytches/eslint-plugin-ddd';

const result = await validateRoleConfig({
  ...roleConfigFromSettings(cwd, settings.ddd),
});
if (!result.ok) {
  for (const p of result.problems) console.error(p.message);
  process.exitCode = 1;
}
```

## Agent lane (`@vytches/eslint-plugin-ddd/agent`)

For project hooks that give a coding agent feedback. The library only supplies
data; it does not read anything from the agent and does not decide what is
blocked.

```js
import {
  createAgentLinter,
  newFindings,
} from '@vytches/eslint-plugin-ddd/agent';
import config from './eslint.config.mjs';

const lane = createAgentLinter({
  config,
  rulePrefixes: ['ddd/'],
  minSeverity: 'error',
});

const before = await lane.lintText(currentText, filePath);
const after = await lane.lintText(proposedText, filePath);

if (after.status === 'ok') {
  const fresh =
    before.status === 'ok'
      ? newFindings(before.findings, after.findings)
      : after.findings;
  // deny the write, block the turn or only inform: your hook decides
}
```

`lintText(text, filePath)` lints text that need not exist on disk, so a
PreToolUse hook can check the proposed content of a write. It resolves to one
of:

| `status`       | Meaning                                                                        |
| -------------- | ------------------------------------------------------------------------------ |
| `ok`           | Linted; `findings` holds the matching results (possibly empty)                 |
| `skipped`      | The configuration does not cover the file                                      |
| `parse-error`  | The text does not parse; no finding can be trusted                             |
| `config-error` | The lane could not run (invalid `settings.ddd`, unresolved binding, no parser) |

Lane rules:

- Only results whose rule id starts with one of `rulePrefixes` (default `ddd/`)
  are analysed; results without a rule id are dropped.
- Unused-directive reporting is off.
- Resolver caches are dropped before each call, so a file created a moment ago
  is found.
- `minSeverity` defaults to `error`.
- Inline `eslint-disable` comments are **ignored by default**
  (`noInlineConfig: true`), because a lane the file under test can silence is
  not a gate. The consequence: an agent that is blocked by a finding it believes
  is a false positive has no way out. That is a project decision; pass
  `noInlineConfig: false` to give it one.
- Use `newFindings(before, after)` to ratchet: only new violations are reported,
  old ones in the file are left alone. It ignores line shifts and counts
  duplicates.

## Cold-process cost

A cold Node process with ESLint and the TypeScript parser costs roughly one to
two seconds before the first result (a figure for ESLint plus parser in general;
it is not yet measured for this package); warm calls on the same linter are much
cheaper. Keep one `createAgentLinter` instance alive where you can, and do not
use ESLint's `--cache` with the agent lane.

## Versioning

Lerna bumps the version; this package follows the monorepo version.
