# ddd/no-deprecated-entity-id-factories

Flags references to the `@deprecated` static factories of the library's
`EntityId`.

## Rule details

| Deprecated                        | Use instead   |
| --------------------------------- | ------------- |
| `EntityId.createText(v)`          | `fromText`    |
| `EntityId.createUuid(v)`          | `fromUUID`    |
| `EntityId.createInteger(v)`       | `fromInteger` |
| `EntityId.createBigInt(v)`        | `fromBigInt`  |
| `EntityId.createWithRandomUUID()` | `create`      |

They stay available until the next major version. The rule is a deprecation
notice, so it is `warn` in `recommended`; the agent lane reports errors only and
does not show it.

Examples of **incorrect** code:

```ts
import { EntityId } from '@vytches/ddd-value-objects';

const id = EntityId.createText('abc-123');
```

Examples of **correct** code:

```ts
const id = EntityId.fromText('abc-123');
```

## How to fix

Replace the call with the factory from the table.

## Limitations

Destructuring (`const { createText } = EntityId`) is not followed.

## Sources

`@deprecated` tags in
`packages/contracts/src/domain/entity-id.implementation.ts` and
`packages/value-objects/src/id.value-object.ts`.

## Options

Every rule of the plugin accepts one optional object that changes what the agent
reads in the message. None of the keys changes what is reported.

```js
"ddd/no-deprecated-entity-id-factories": ["error", { id: "PA1", fix: "Use the project helper instead.", see: "https://example.test/rule-card#pa1" }]
```

| Key   | Effect                                                         |
| ----- | -------------------------------------------------------------- |
| `id`  | Adds a `[id]` tag at the start of the message (e.g. a card id) |
| `fix` | Replaces the text after `Fix:`                                 |
| `see` | Replaces the link after `See:`                                 |
