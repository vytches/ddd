# ddd/policy-builder-required-calls

Opt-in rule. Requires `withId`, `withName` and a domain on a `PolicyBuilder`
chain before `build()`.

## Rule details

`build()` throws when the policy id, name or domain is missing. The rule follows
a chain that starts at `PolicyBuilder.create(...)` or
`PolicyBuilder.forDomain(...)` and ends in `.build()`:

- `withId` and `withName` must appear in the chain;
- the domain must come from `.withDomain()`, from
  `PolicyBuilder.forDomain(...)`, or from a `defaultDomain` in the config passed
  to `PolicyBuilder.create(config)`. A config the rule cannot read statically (a
  variable, a spread) counts as "may have `defaultDomain`".

Examples of **incorrect** code:

```ts
PolicyBuilder.create<Order>().withId('order-placement').must(spec).build();
```

Examples of **correct** code:

```ts
PolicyBuilder.forDomain<Order>('ordering')
  .withId('order-placement')
  .withName('Order Placement Policy')
  .must(spec)
  .build();
```

## How to fix

Add the missing `.withId()`, `.withName()` or `.withDomain()` call.

## Limitations

A chain split across variables
(`const b = PolicyBuilder.create(); b.withId('x'); b.build()`) is not followed:
the rule stays silent instead of raising a false alarm.

## Preset membership

Not in `recommended`. A rule moves there only with at least 95% precision over
at least 60 natural hits collected from consumer projects; mutation tests alone
do not promote it.

## Sources

`packages/policies/LLMGUIDE.md`, section "Key API" and
`PolicyBuilder.validateBuilder`.

## Options

Every rule of the plugin accepts one optional object that changes what the agent
reads in the message. None of the keys changes what is reported.

```js
"ddd/policy-builder-required-calls": ["error", { id: "PA1", fix: "Use the project helper instead.", see: "https://example.test/rule-card#pa1" }]
```

| Key   | Effect                                                         |
| ----- | -------------------------------------------------------------- |
| `id`  | Adds a `[id]` tag at the start of the message (e.g. a card id) |
| `fix` | Replaces the text after `Fix:`                                 |
| `see` | Replaces the link after `See:`                                 |
