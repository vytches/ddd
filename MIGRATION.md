# Migration Guide

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
