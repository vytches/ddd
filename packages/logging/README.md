# @vytches/ddd-logging

[![npm version](https://badge.fury.io/js/%40vytches%2Fddd-logging.svg)](https://badge.fury.io/js/%40vytches%2Fddd-logging)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Structured logging for DDD applications with smart context detection and
> CQRS integration**

## Installation

```bash
pnpm add @vytches/ddd-logging
```

## What's included

### Core

| Export                               | Kind      | Description                                               |
| ------------------------------------ | --------- | --------------------------------------------------------- |
| `LOG_LEVELS`                         | constant  | Ordered array of supported log levels                     |
| `parseLogLevel(s)`                   | function  | Parses a string into a `LogLevel`                         |
| `isLogLevelEnabled(current, target)` | function  | Returns `true` if `target` level is at or above `current` |
| `DefaultLogContextBuilder`           | class     | Builds `LogContext` objects                               |
| `DefaultLogEventBuilder`             | class     | Builds `LogEvent` objects                                 |
| `ILogger`                            | interface | Logger contract (`debug`, `info`, `warn`, `error`)        |
| `LogLevel`                           | type      | `'debug' \| 'info' \| 'warn' \| 'error'`                  |
| `LogContext`                         | interface | Structured log context shape                              |
| `LogEvent`                           | interface | Full structured event shape emitted to providers          |
| `LogContextBuilder`                  | interface | Builder contract                                          |
| `LogEventBuilder`                    | interface | Builder contract                                          |
| `LoggerConfiguration`                | interface | Configuration shape for `DefaultLogger.configure()`       |
| `LogProvider`                        | interface | Output provider contract (console, file, remote…)         |

### Main logger

| Export          | Kind      | Description                                                                        |
| --------------- | --------- | ---------------------------------------------------------------------------------- |
| `DefaultLogger` | class     | Singleton-style logger with `create()`, `forContext()`, and `configure()`          |
| `Logger`        | namespace | Convenience facade: `Logger.create()`, `Logger.forContext()`, `Logger.configure()` |

### Providers

| Export                   | Kind      | Description                    |
| ------------------------ | --------- | ------------------------------ |
| `ConsoleProvider`        | class     | Writes log events to `console` |
| `ConsoleProviderOptions` | interface | Options for `ConsoleProvider`  |

### Utilities

| Export                   | Kind      | Description                                           |
| ------------------------ | --------- | ----------------------------------------------------- |
| `ContextDetector`        | class     | Detects bounded context from stack traces or metadata |
| `DataMasker`             | class     | Masks sensitive fields in log payloads                |
| `ContextDetectionResult` | interface | Result of context detection                           |
| `MaskingOptions`         | interface | Masking configuration                                 |

### CQRS / Event integration

| Export                      | Kind      | Description                                                    |
| --------------------------- | --------- | -------------------------------------------------------------- |
| `AggregateLoggingMixin`     | class     | Mixin that adds structured logging to aggregate event handlers |
| `EnhancedLoggingMiddleware` | class     | CQRS middleware that logs command/query execution              |
| `LogCQRS`                   | decorator | Class decorator that enables CQRS logging on a handler         |
| `LogCommands`               | decorator | Enables command-specific logging                               |
| `LogQueries`                | decorator | Enables query-specific logging                                 |
| `LogDomainEvents`           | decorator | Enables domain event logging                                   |
| `LogStateChanges`           | decorator | Logs aggregate state transitions                               |
| `CQRSLoggingOptions`        | interface | Options for `LogCQRS` / `LogCommands` / `LogQueries`           |
| `CQRSMiddlewareOptions`     | interface | Options for `EnhancedLoggingMiddleware`                        |
| `StateChangeLoggingOptions` | interface | Options for `LogStateChanges`                                  |
| `ExecutionContext`          | interface | Re-exported CQRS execution context shape                       |
| `ICQRSMiddleware`           | interface | Re-exported CQRS middleware interface                          |

## Quick start

```typescript
import { Logger } from '@vytches/ddd-logging';

const logger = Logger.forContext('OrderService');

logger.info('Order created', { orderId: 'ord-1', total: 99.99 });
logger.warn('Inventory low', { sku: 'SKU-42', remaining: 2 });
logger.error('Payment failed', { error: err.message });
```

## Configure providers

```typescript
import { DefaultLogger, ConsoleProvider } from '@vytches/ddd-logging';

DefaultLogger.configure({
  level: 'info',
  providers: [new ConsoleProvider({ pretty: true })],
});
```

## CQRS decorator

```typescript
import { LogCQRS } from '@vytches/ddd-logging';
import { CommandHandler } from '@vytches/ddd-cqrs';

@LogCQRS({ includePayload: true, logLevel: 'info' })
@CommandHandler(CreateOrderCommand)
class CreateOrderCommandHandler {
  async handle(command: CreateOrderCommand) {
    // start/end/error are automatically logged
  }
}
```

## Data masking

```typescript
import { DataMasker } from '@vytches/ddd-logging';

const masker = new DataMasker({ sensitiveFields: ['password', 'cardNumber'] });
const safe = masker.mask({ user: 'alice', password: 'secret' });
// => { user: 'alice', password: '***' }
```

## Package boundaries

`@vytches/ddd-logging` depends on:

- `@vytches/ddd-contracts` — core type contracts

## License

MIT
