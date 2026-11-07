# ddd/no-new-entity-id

Disallows `new EntityId(...)` when `EntityId` is one of the library's classes.

## Rule details

The library ships two `EntityId` classes (`@vytches/ddd-contracts` and
`@vytches/ddd-value-objects`). Neither constructor guards the identifier:
validation lives in the static factories. Calling the constructor directly lets
an invalid value or a wrong `IdType` into the domain.

The class is resolved by import source, so a project class named `EntityId` is
not reported, and a subclass (`new UserId(...)`) is not reported either.

Examples of **incorrect** code:

```ts
import { EntityId } from '@vytches/ddd-value-objects';

const id = new EntityId('abc-123', 'text');
```

Examples of **correct** code:

```ts
const generated = EntityId.create();
const fromText = EntityId.fromText('abc-123');
const checked = EntityId.tryFromUUID(input); // Result, never throws
```

## How to fix

Use a static factory: `create()`, `fromUUID()`, `fromText()`, `fromInteger()`,
`fromBigInt()`, or the Result-returning `tryFromUUID()` and its siblings.

## Preset membership

An error, but not part of `recommended` yet: `packages/contracts/LLMGUIDE.md`
still shows `new EntityId(...)` in its quick start, and the preset must report
nothing on documented usage. Enable it explicitly until the guide is corrected.

## Sources

`packages/value-objects/LLMGUIDE.md` and `packages/contracts/LLMGUIDE.md`,
section "Anti-Patterns".

## Options

Every rule of the plugin accepts one optional object that changes what the agent
reads in the message. None of the keys changes what is reported.

```js
"ddd/no-new-entity-id": ["error", { id: "PA1", fix: "Use the project helper instead.", see: "https://example.test/rule-card#pa1" }]
```

| Key   | Effect                                                         |
| ----- | -------------------------------------------------------------- |
| `id`  | Adds a `[id]` tag at the start of the message (e.g. a card id) |
| `fix` | Replaces the text after `Fix:`                                 |
| `see` | Replaces the link after `See:`                                 |
