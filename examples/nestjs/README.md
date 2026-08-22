# NestJS example

The smallest wiring that actually dispatches: one command handler, one query
handler, both discovered automatically and registered on the buses.

This example exists because the NestJS wiring lived only in prose. Nothing
compiled it and nothing ran it, so the README, the LLM guide and the module
JSDoc were free to drift apart — and they did, until a consumer wired their own
module and lost handler registration entirely without a single error message.
`tests/wiring.test.ts` is the guard against that happening again.

## What it shows

- `VytchesDDDModule.forRoot({ providers })` as the entry point. The explorer
  that finds your handlers is provided by this module; an application that never
  imports it has no auto-discovery at all.
- Each bus built with a `NestJSContainerAdapter`, so the bus can resolve a
  handler's own dependencies.
- Handlers as ordinary NestJS providers. No manual `bus.register(...)` anywhere.
- An end-to-end dispatch: `commandBus.execute()` then `queryBus.execute()`
  reading back what the command wrote.

## Run it

```bash
pnpm --filter @vytches/nestjs-example test
pnpm --filter @vytches/nestjs-example typecheck
```

## One thing to note

The handlers use explicit `@Inject(OrderStore)` instead of relying on the
constructor type alone. That is a concession to the test runner: Vitest
transpiles with esbuild, which does not emit `design:paramtypes`, so NestJS
cannot infer constructor dependencies from types here. An application compiled
with `tsc` or SWC (`emitDecoratorMetadata: true`) does not need it.
