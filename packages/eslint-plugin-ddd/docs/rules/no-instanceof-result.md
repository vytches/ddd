# ddd/no-instanceof-result

Disallows `x instanceof Result` when `Result` is the library class.

## Rule details

`Result` is a class, but its identity is not stable: two bundles, or two
installed copies of `@vytches/ddd-contracts` / `@vytches/ddd-utils`, ship two
different classes, and `instanceof` answers `false` for a genuine `Result`. The
`Result` API has everything needed to branch without the check.

The symbol is resolved by import source (also through project facades, aliases
and namespace imports), never by name. A parameter, class or constant that is
called `Result` is not reported.

Examples of **incorrect** code:

```ts
import { Result } from '@vytches/ddd-contracts';

if (value instanceof Result) {
  /* ... */
}
```

Examples of **correct** code:

```ts
if (result.isFailure) return result;
const text = result.match(
  value => `Created ${value.name}`,
  error => `Failed: ${error.message}`
);
```

## How to fix

Branch on `result.isSuccess` / `result.isFailure`, or use `Result.match()`.

## Limitations

Destructured and dynamically computed aliases are not followed; the rule stays
silent for them.

## Sources

`packages/utils/LLMGUIDE.md`, section "Anti-Patterns".

## Options

Every rule of the plugin accepts one optional object that changes what the agent
reads in the message. None of the keys changes what is reported.

```js
"ddd/no-instanceof-result": ["error", { id: "PA1", fix: "Use the project helper instead.", see: "https://example.test/rule-card#pa1" }]
```

| Key   | Effect                                                         |
| ----- | -------------------------------------------------------------- |
| `id`  | Adds a `[id]` tag at the start of the message (e.g. a card id) |
| `fix` | Replaces the text after `Fix:`                                 |
| `see` | Replaces the link after `See:`                                 |
