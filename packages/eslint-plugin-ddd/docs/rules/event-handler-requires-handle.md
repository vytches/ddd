# ddd/event-handler-requires-handle

Requires a `handle()` method on a class decorated with the library's
`@EventHandler`.

## Rule details

The event bus calls `handle(event)` on the registered instance. A class
decorated with `@EventHandler(EventClass)` that has no `handle` member compiles
(the decorator accepts any class) and fails when the first event is dispatched.

Only the plain class form is checked. These are left alone because `handle()`
may legitimately be elsewhere: a class with `extends` (it may inherit `handle`),
an `abstract` class, and the method form of the decorator.

Examples of **incorrect** code:

```ts
import { EventHandler } from '@vytches/ddd-events';

@EventHandler(OrderPlacedEvent)
class OrderPlacedHandler {}
```

Examples of **correct** code:

```ts
@EventHandler(OrderPlacedEvent)
class OrderPlacedHandler {
  async handle(event: OrderPlacedEvent): Promise<void> {}
}
```

## How to fix

Add `async handle(event): Promise<void>` to the class, or decorate a method
instead of the class.

## Sources

`packages/events/LLMGUIDE.md`, section "Quick Start".

## Options

Every rule of the plugin accepts one optional object that changes what the agent
reads in the message. None of the keys changes what is reported.

```js
"ddd/event-handler-requires-handle": ["error", { id: "PA1", fix: "Use the project helper instead.", see: "https://example.test/rule-card#pa1" }]
```

| Key   | Effect                                                         |
| ----- | -------------------------------------------------------------- |
| `id`  | Adds a `[id]` tag at the start of the message (e.g. a card id) |
| `fix` | Replaces the text after `Fix:`                                 |
| `see` | Replaces the link after `See:`                                 |
