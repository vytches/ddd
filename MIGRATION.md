# Migration Guide

## → (VF-036) `getIdentityComponents()` replaces the dead `getEqualityComponents()` override

**Additive, not breaking.** This section only applies if your value objects
already declare `getEqualityComponents()` — most likely carried over from an
early (2025) documentation example. That hook has **never existed** in this
library's runtime API; every `equals()` call has always used the raw
`value`-based comparison (`===` for primitives, `LibUtils.deepEqual` for
objects). If you have such overrides, they have been dead code since you wrote
them. This release does not activate them automatically — it adds a real,
supported hook under a new name that you must opt into explicitly.

### Find affected classes

```bash
grep -rln "getEqualityComponents" --include="*.ts" src/
```

### Before / after

```ts
// Before — dead code, silently ignored by equals() in every released version
class Money extends BaseValueObject<MoneyProps> {
  protected getEqualityComponents(): unknown[] {
    return [this.value.amount, this.value.currency];
  }
  // ...
}
```

```ts
// After — real, honored hook (note the `override` modifier and readonly return type)
class Money extends BaseValueObject<MoneyProps> {
  protected override getIdentityComponents(): readonly unknown[] {
    return [this.value.amount, this.value.currency];
  }
  // ...
}
```

The rename is mechanical: `getEqualityComponents` → `getIdentityComponents`, add
`override`, and change the return type from `unknown[]` to `readonly unknown[]`
(or leave it inferred). Re-verify the returned values still make sense as
identity components — they were never exercised at runtime before, so a latent
bug in the array construction could have gone unnoticed for the entire lifetime
of the class.

### Migrate as ONE atomic codemod, not incrementally

Perform the rename across your **entire** class hierarchy in a single commit/PR,
not class-by-class over time. A partially migrated hierarchy — some subclasses
on `getIdentityComponents()`, others still (uselessly) declaring
`getEqualityComponents()` and therefore still on raw-value comparison — is
exactly the mixed population described in the `@vytches/ddd-value-objects`
README under "the asymmetric fallback": instances of the same base type now
compare by different rules, and `equals()` stops being transitive across them.
Anything that does `list.some(x => x.equals(y))` or de-duplicates by `.equals()`
against a mixed population is silently exposed to that gap for as long as the
migration stays partial.

### Compile-time signal for `noImplicitOverride`

If a class of yours happens to already declare a member named
`getIdentityComponents` for unrelated reasons, TypeScript will report `TS4114`
at that declaration under `noImplicitOverride` once you upgrade — a
compile-time-only signal, not a runtime behavior change, unless you also add
`override` there.

See
[`packages/value-objects/README.md`](packages/value-objects/README.md#partial-identity-equality-with-getidentitycomponents)
and [`packages/value-objects/LLMGUIDE.md`](packages/value-objects/LLMGUIDE.md)
for full semantics — the `[]` footgun, throw propagation, and the
frozen/readonly-state requirement for components.

---

## → (VS-010) Removal of the application-logging layer

**BREAKING.** `@vytches/ddd` no longer ships an application-logging layer. The
library is not a logging framework — it logs only its own internal diagnostics
(misconfiguration, unexpected failures) and never the consuming application's
commands, queries, events, or PII. Use your own logger (Pino, Winston, etc.) for
application logging.

### Removed (no longer exported)

| Removed symbol                                                                 | Replacement                                                    |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| `@LogCommands` / `@LogQueries` / `@LogCQRS`                                    | Implement CQRS logging as your own bus middleware / decorator  |
| `@LogStateChanges` / `@LogDomainEvents` / `AggregateLoggingMixin`              | Subscribe to published domain events in your application layer |
| `EnhancedLoggingMiddleware`                                                    | Implement middleware in your application                       |
| `DefaultLogger`, `ConsoleProvider`                                             | Use your own logger (Pino/Winston/…)                           |
| `DataMasker`                                                                   | Implement PII masking in your own logging pipeline             |
| `ContextDetector`, `DefaultLogContextBuilder`, `DefaultLogEventBuilder`        | Not needed outside the (removed) library logger                |
| `Logger` / `ILogger` type, `LogProvider`, `LoggerConfiguration`, `LogLevel`, … | Define your own logger interface in your app                   |
| The entire `@vytches/ddd-logging` package                                      | — (package removed)                                            |

`@vytches/ddd-enterprise` no longer re-exports any of the above (the
`export * from '@vytches/ddd-logging'` was removed).

### Why

A DDD library should be zero-opinion about application logging — that is a
cross-cutting concern of the application, not the domain. Decorators that logged
commands/events also risked leaking PII and (in the previous implementation)
coerced synchronous helper methods into Promises. Removing the layer eliminates
both classes of problem and shrinks the public API to what the library actually
provides as value.

### What stays

Each package now logs **its own** problems internally via a private
`internal-logger.ts` (thin `console.warn`/`console.error` wrapper). This is an
internal implementation detail — it is **not exported** and not configurable by
consumers. Library-origin warnings (e.g. "no handler found") and errors surface
on the console; everything operational is the application's responsibility.

### How to migrate

1. Remove any imports of the symbols above from `@vytches/ddd-*`.
2. Use your own logger for application logging.
3. For command/query/event logging, add your own bus middleware or event
   subscriber in the application layer.

---

## → (VP-010) EnhancedCommandBus — enableCache default changed to `false`

**Behavioral change (MINOR).** `EnhancedCommandBus` now defaults `enableCache`
to `false`, matching `EnhancedQueryBus`. Previously the command bus defaulted to
`true`, which silently started a background `setInterval` cache-cleanup timer in
every consumer process — including test processes where hundreds of bus
instances could accumulate and prevent vitest workers from exiting.

### Who is affected

Consumers that rely on command handler resolution caching without explicitly
passing `enableCache: true`.

### How to migrate

If you depend on command-result caching, opt in explicitly:

```typescript
// Before (implicit true) — no longer works
const bus = new EnhancedCommandBus(container);

// After — explicit opt-in
const bus = new EnhancedCommandBus(container, { enableCache: true });
```

If you use `VytchesDDDModule.forFeature()` (recommended), no action is needed —
the module manages bus construction and lifecycle automatically.
