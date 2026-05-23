# @vytches/ddd-enterprise

[![npm version](https://badge.fury.io/js/%40vytches%2Fddd-enterprise.svg)](https://badge.fury.io/js/%40vytches%2Fddd-enterprise)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Meta-package — single import for the entire VytchesDDD ecosystem**

`@vytches/ddd-enterprise` re-exports every public symbol from all VytchesDDD
packages. Install it instead of installing individual packages when you want
access to everything from a single import.

## Installation

```bash
pnpm add @vytches/ddd-enterprise
```

## What it re-exports

The package does **not** add any new symbols. It is a curated aggregation of:

| Package                          | What is included                                                                 |
| -------------------------------- | -------------------------------------------------------------------------------- |
| `@vytches/ddd-contracts`         | Foundation types and interfaces                                                  |
| `@vytches/ddd-domain-primitives` | Domain error base classes                                                        |
| `@vytches/ddd-value-objects`     | `EntityId`, `EntityIdFactory`, `BaseValueObject`, branded ID helpers             |
| `@vytches/ddd-aggregates`        | `AggregateRoot`, `Entity`, `AggregateBuilder`, capabilities, utility functions   |
| `@vytches/ddd-repositories`      | `IBaseRepository`, `VersionError`, repository interfaces, `IUnitOfWork`          |
| `@vytches/ddd-domain-services`   | All domain service base classes and decorators                                   |
| `@vytches/ddd-policies`          | All policy exports                                                               |
| `@vytches/ddd-validation`        | Specification types, validators, `ValidationError`                               |
| `@vytches/ddd-events`            | `DomainEvent`, `IntegrationEvent`, `BaseEventBus`, `UnifiedEventBus`, decorators |
| `@vytches/ddd-cqrs`              | `CommandBus`, `QueryBus`, `CommandHandler`, `QueryHandler`, middleware, errors   |
| `@vytches/ddd-projections`       | All projection exports                                                           |
| `@vytches/ddd-acl`               | All ACL exports                                                                  |
| `@vytches/ddd-messaging`         | Outbox pattern exports                                                           |
| `@vytches/ddd-di`                | `VytchesDDD`, `SimpleContainer`, `ContainerBuilder`, `ServiceLifetime`           |
| `@vytches/ddd-logging`           | All logging exports                                                              |
| `@vytches/ddd-resilience`        | All resilience pattern exports                                                   |
| `@vytches/ddd-utils`             | `Result`, `LibUtils`, `safeRun`, middleware utilities                            |

## Conflict resolution

Some symbols exist in multiple packages. `@vytches/ddd-enterprise` resolves
conflicts as follows:

| Symbol                 | Source                         | Note                                            |
| ---------------------- | ------------------------------ | ----------------------------------------------- |
| `EntityId`             | `@vytches/ddd-value-objects`   | Enhanced implementation                         |
| `BaseEntityId`         | `@vytches/ddd-contracts`       | Foundation interface re-exported under alias    |
| `ExecutionContext`     | `@vytches/ddd-cqrs`            | Most commonly used variant                      |
| `safeRun`              | `@vytches/ddd-utils`           | Production utility (not the testing version)    |
| `ServiceNotFoundError` | `@vytches/ddd-domain-services` | Takes precedence over `@vytches/ddd-di` variant |

## Quick start

```typescript
import {
  AggregateRoot,
  EntityId,
  DomainEvent,
  CommandBus,
  QueryBus,
  CommandHandler,
  QueryHandler,
  Result,
  safeRun,
  VytchesDDD,
  SimpleContainer,
} from '@vytches/ddd-enterprise';
```

## When to use individual packages instead

Prefer individual package imports when:

- You want smaller bundles (tree-shaking individual packages is more reliable)
- You need a symbol from the losing side of a conflict resolution
- You are building a library that should not pull in the entire ecosystem

## License

MIT
