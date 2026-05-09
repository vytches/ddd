# @vytches/ddd-logging - LLM Guide

## Purpose

Pluggable structured logging for DDD applications: `ILogger` interface,
`DefaultLogger` implementation, console + custom providers, and a context-aware
logging stack with correlation/causation IDs.

Includes integration helpers for CQRS (`LogCommands`, `LogQueries`, `LogCQRS`),
domain events (`LogDomainEvents`), aggregate state changes (`LogStateChanges`,
`AggregateLoggingMixin`), and PII masking (`DataMasker`, `ContextDetector`).

Framework-agnostic — works with any DI container or no DI at all.

## Quick Start

```typescript
import { Logger, DefaultLogger, ConsoleProvider } from '@vytches/ddd-logging';

// Convenience facade — auto-configures + names the context
const log = Logger.create('OrderService');

log.info('Order placed', { orderId: 'o-1', amount: 100 });
log.error('Payment failed', { orderId: 'o-1', error });

// Child logger with bound context
const requestLog = log.withContext({ requestId: 'req-42' });
requestLog.info('Handling request'); // adds requestId automatically

// Or build manually for full control
const explicit = new DefaultLogger({
  level: 'info',
  providers: [new ConsoleProvider({ pretty: true })],
});
```

## Key API

### Core

| Export                       | Kind         | Description                                                                      |
| ---------------------------- | ------------ | -------------------------------------------------------------------------------- |
| `Logger`                     | const facade | `Logger.create()`, `Logger.forContext()`, `Logger.configure()` shortcuts         |
| `ILogger`                    | interface    | Public logger contract: `info`, `warn`, `error`, `debug`, `trace`, `withContext` |
| `DefaultLogger`              | class        | Reference implementation; routes events through providers                        |
| `ConsoleProvider`            | class        | Stdout/stderr provider with optional pretty formatting                           |
| `ConsoleProviderOptions`     | type         | `{ pretty, colorize, jsonOutput }`                                               |
| `LogProvider`                | interface    | Implement to write to file, ELK, Datadog, etc.                                   |
| `LogEvent`                   | type         | Structured log record with `level`, `message`, `context`, `timestamp`            |
| `LogContext`                 | type         | Key/value metadata bag merged into every event                                   |
| `LogContextBuilder`          | interface    | Fluent builder for layered contexts                                              |
| `DefaultLogContextBuilder`   | class        | Reference builder implementation                                                 |
| `LogEventBuilder`            | interface    | Build events with consistent shape                                               |
| `DefaultLogEventBuilder`     | class        | Reference event builder                                                          |
| `LogLevel`                   | union type   | `'trace' \| 'debug' \| 'info' \| 'warn' \| 'error' \| 'fatal'`                   |
| `LOG_LEVELS`                 | const record | Numeric ordering for level comparisons                                           |
| `parseLogLevel(s)`           | function     | Parse string to LogLevel; throws on invalid                                      |
| `isLogLevelEnabled(cur, ev)` | function     | Whether `ev` should fire at current configured level                             |
| `LoggerConfiguration`        | type         | Constructor options for DefaultLogger                                            |

### CQRS / domain integration

| Export                      | Kind      | Description                                                    |
| --------------------------- | --------- | -------------------------------------------------------------- |
| `LogCQRS(opts?)`            | decorator | Class decorator: logs every command/query handler in the class |
| `LogCommands(opts?)`        | decorator | Logs only command handlers                                     |
| `LogQueries(opts?)`         | decorator | Logs only query handlers                                       |
| `LogDomainEvents(opts?)`    | decorator | Logs each domain event publish/handle                          |
| `LogStateChanges(opts?)`    | decorator | Logs aggregate state mutations                                 |
| `AggregateLoggingMixin`     | mixin     | Mix into AggregateRoot to auto-log every `apply()` call        |
| `EnhancedLoggingMiddleware` | class     | Bus middleware: structured logging + correlation propagation   |
| `ICQRSMiddleware`           | interface | Contract for chainable bus middleware                          |
| `CQRSLoggingOptions`        | type      | `{ logPayload, logResult, sensitiveFields, ... }`              |
| `CQRSMiddlewareOptions`     | type      | Extended middleware options                                    |
| `StateChangeLoggingOptions` | type      | Per-aggregate state-change logging tweaks                      |
| `ExecutionContext`          | type      | Carries correlation/causation IDs through the call chain       |

### Privacy & utilities

| Export                   | Kind  | Description                                                 |
| ------------------------ | ----- | ----------------------------------------------------------- |
| `DataMasker`             | class | Masks PII in log payloads (`maskFields`, `maskPattern`)     |
| `ContextDetector`        | class | Detects sensitive context (auth tokens, PII) from a payload |
| `MaskingOptions`         | type  | `{ fields, replacement, deepScan }` config                  |
| `ContextDetectionResult` | type  | Output of `ContextDetector.detect()`                        |

## Patterns

### CQRS bus instrumentation

```typescript
import {
  LogCommands,
  EnhancedLoggingMiddleware,
  Logger,
} from '@vytches/ddd-logging';
import { CommandBus } from '@vytches/ddd-cqrs';

const log = Logger.create('CommandBus');
const bus = new CommandBus();
bus.use(new EnhancedLoggingMiddleware({ logger: log, logPayload: true }));

@LogCommands({ logResult: true })
class PlaceOrderHandler {
  async handle(cmd: PlaceOrderCommand) {
    /* ... */
  }
}
```

### Mask sensitive fields automatically

```typescript
import { DataMasker, Logger } from '@vytches/ddd-logging';

const masker = new DataMasker({
  fields: ['password', 'creditCard', 'ssn'],
  replacement: '***',
});
const log = Logger.create('Auth');

log.info(
  'User registered',
  masker.mask({
    email: 'a@b.com',
    password: 'plaintext-secret', // → '***'
    creditCard: '4242-...', // → '***'
  })
);
```

### Per-aggregate state-change logging

```typescript
import { AggregateLoggingMixin, LogStateChanges } from '@vytches/ddd-logging';
import { AggregateRoot } from '@vytches/ddd-aggregates';

@LogStateChanges({ logEvents: true })
class Order extends AggregateLoggingMixin(AggregateRoot)<string> {
  // every apply() now produces a log entry
}
```

## Anti-Patterns

- **Do not use `console.log` directly in library code** — always go through the
  injected logger so consumers can route to their pipeline.
- **Do not log sensitive data raw** — wrap payloads with `DataMasker` or use
  `LogCommands({ sensitiveFields: [...] })`. The `LogContext` may be persisted
  indefinitely in some pipelines.
- **Do not call `Logger.create()` without a context name** in library code —
  anonymous loggers make grep-based triage in production logs impossible.
- **Do not create a logger per call** — create once at module load or via DI and
  pass down. `withContext()` is cheap; `new DefaultLogger()` is not.
- **Do not stack `LogCQRS` and `LogCommands`** on the same class — pick one;
  they overlap and double-log.
