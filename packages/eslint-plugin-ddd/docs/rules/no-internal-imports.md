# ddd/no-internal-imports

Disallows imports of library internals: `/internal` entry points, `@internal`
symbols, and deep subpaths behind a package barrel.

## Rule details

Three checks share the rule, each with its own message. All run on every file,
because an import can sit in a file that holds no class with a role.

| Check             | Reports                                                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `internalSubpath` | `@vytches/ddd-*/internal` (and anything below it)                                                                               |
| `internalSymbol`  | `internalLogger`, `EVENT_HANDLER_METADATA`, `EVENT_HANDLER_OPTIONS`, `CUSTOM_MIDDLEWARE_SYMBOL` imported from a library package |
| `deepSubpath`     | any other subpath of a library package, e.g. `@vytches/ddd-events/dist/x`                                                       |

Matching is by name only: any specifier of the form `@vytches/ddd` or
`@vytches/ddd-*` counts as a library package, whether or not it is installed.
This covers packages added in the future without a plugin release, and it
applies to both the `/internal` and the deep-subpath checks. A misspelled
package name is therefore flagged too; it would not resolve anyway.

The documented public subpaths (`@vytches/ddd/llm-context`,
`@vytches/ddd/llm-context.md`, `@vytches/ddd/package.json`) are allowed. Static
`import`, `export ... from`, `import()`, `require()`, `import x = require()` and
`import('x').T` types are covered.

Files that belong to a library package (the nearest `package.json` is
`@vytches/ddd` or `@vytches/ddd-*`) are skipped: sibling packages share
internals through `/internal` on purpose.

Examples of **incorrect** code:

```ts
import { internalLogger } from '@vytches/ddd-contracts/internal';
import { thing } from '@vytches/ddd-events/dist/thing';
```

Examples of **correct** code:

```ts
import { configureDiagnostics } from '@vytches/ddd-contracts';
import llm from '@vytches/ddd/llm-context';
```

## How to fix

Import from the package entry. If the symbol is not exported there, it is not
part of the consumer API: do not depend on it. To control diagnostics use
`configureDiagnostics()`.

## Differences from `ddd-005` (`tools/ddd-lint`)

This rule is the port of `ddd-005`'s deep-import check. It does not port the
check for relative imports that cross a `packages/<x>/` boundary: that check
encodes the layout of this monorepo, and the plugin never hard-codes a directory
layout. Use `no-restricted-imports` or `@nx/enforce-module-boundaries` for it in
a project.

## Sources

`packages/contracts/LLMGUIDE.md`, section "Anti-Patterns".

## Options

Every rule of the plugin accepts one optional object that changes what the agent
reads in the message. None of the keys changes what is reported.

```js
"ddd/no-internal-imports": ["error", { id: "PA1", fix: "Use the project helper instead.", see: "https://example.test/rule-card#pa1" }]
```

| Key   | Effect                                                         |
| ----- | -------------------------------------------------------------- |
| `id`  | Adds a `[id]` tag at the start of the message (e.g. a card id) |
| `fix` | Replaces the text after `Fix:`                                 |
| `see` | Replaces the link after `See:`                                 |
