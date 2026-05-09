<div align="center">

# @vytches/ddd

**Production-grade Domain-Driven Design building blocks for TypeScript.**

[![npm version](https://img.shields.io/npm/v/@vytches/ddd?style=flat-square)](https://www.npmjs.com/package/@vytches/ddd)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![Node 22+](https://img.shields.io/badge/node-%3E%3D22.19-green.svg?style=flat-square)](https://nodejs.org/)

[**▶ Try it in your browser (StackBlitz)**](https://stackblitz.com/github/vytches/ddd?file=examples/quickstart/src/domain/order.aggregate.ts)
&nbsp;—&nbsp; opens the full monorepo; the `.stackblitzrc` runs
`examples/quickstart` tests on boot. 16 passing tests in ~2 seconds, no install
needed.

</div>

## What is this?

A 20-package toolkit for building DDD applications in TypeScript with
first-class support for: aggregates, value objects, domain events, CQRS,
repositories, projections, anti-corruption layer, business policies
(specifications, conditional, retry, cache, temporal), domain services, and an
outbox pattern for at-least-once integration messaging.

**Validated on Node 22**: ~1.6M `apply()`/sec, ~8.4M `EntityId.create()`/sec,
~3.2M events/sec replay (see
[`benchmarks/baseline.json`](benchmarks/baseline.json)).

## Why @vytches/ddd?

| Need                                             | What we give you                                                                          |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Strongly-typed AggregateRoot with event sourcing | `AggregateRoot<TId>` + capabilities (snapshot, audit, versioning)                         |
| Composable business policies                     | `PolicyBuilder`, `must/mustSatisfy`, `.and()/.or()`, conditional, temporal, retry, cached |
| `Result<T, E>` everywhere                        | Foundation primitive in `@vytches/ddd-contracts`                                          |
| Storage-agnostic outbox                          | `IOutboxRepository` interface — bring your own DB                                         |
| CQRS with optional resilience                    | `CommandBus`, `QueryBus`, opt-in retry/circuit-breaker                                    |
| AI-assistant ready                               | Per-package `LLMGUIDE.md` + `pnpm llm:bundle`                                             |
| Dependency-free runtime                          | Zero external runtime deps, framework-agnostic                                            |

## Install

```bash
npm install @vytches/ddd
```

For tighter bundle control, install only what you use:

```bash
npm install @vytches/ddd-aggregates @vytches/ddd-events @vytches/ddd-policies
```

NestJS users: see `@vytches/ddd-nestjs` for module + DI auto-discovery.

## 60-second example

```typescript
import { AggregateRoot, EntityId, DomainEvent, Result } from '@vytches/ddd';

interface OrderCreatedPayload {
  customerId: string;
}
class OrderCreated extends DomainEvent<OrderCreatedPayload> {
  constructor(payload: OrderCreatedPayload) {
    super(payload);
  }
}

class Order extends AggregateRoot<string> {
  private customerId = '';

  constructor() {
    super({ id: EntityId.create(), version: 0 });
    this.registerEventHandler<OrderCreatedPayload>('OrderCreated', p => {
      this.customerId = p.customerId;
    });
  }

  create(customerId: string): Result<void, Error> {
    if (!customerId) return Result.fail(new Error('customerId required'));
    this.apply(new OrderCreated({ customerId }));
    return Result.empty();
  }
}

const order = new Order();
order.create('cust-42');
const events = order.getDomainEvents(); // → 1 OrderCreated event ready to persist
```

See [`QUICK_START.md`](QUICK_START.md) for a 5-minute walkthrough including
ValueObjects, specifications, and command handlers.

## Design decisions

These constraints are intentional — they're what makes the library
production-safe.

- **No sagas / process managers.** Library deliberately ships no saga
  orchestrator. Use a dedicated saga library (e.g. NestJS Sagas, durable
  workflow engines) when you need long-running coordination. Domain events
  combined with the outbox pattern give you the building blocks; orchestration
  belongs elsewhere.
- **No event-store or ORM adapters.** `IOutboxRepository`, `IEventStore`,
  `IProjectionStore` etc. are interfaces — you implement them against Postgres,
  Redis, EventStoreDB, or whatever your stack uses. Library stays testable and
  storage-agnostic.
- **Dependency-free runtime.** Zero external runtime dependencies. Adopt the
  parts you need, audit the rest, deploy anywhere.
- **Framework-agnostic.** NestJS integration ships in `@vytches/ddd-nestjs` but
  is opt-in. Core packages work in Express, Fastify, Hono, Cloudflare Workers,
  plain Node.
- **Result<T, E> over throwing.** Domain operations return outcomes. Throwing is
  reserved for true programmer errors (invariant violations). See
  `@vytches/ddd-contracts` `Result`.

Architecture decisions are documented as ADRs in [`docs/adr/`](docs/adr/).

## AI-assisted onboarding

Every published package ships an `LLMGUIDE.md` next to its `README.md`. To seed
Claude Code, Cursor, GitHub Copilot, or Aider with @vytches/ddd context:

**Option 1 — Per-package guides** (lightest):

In your `CLAUDE.md` / `.cursorrules` / Copilot instructions:

```text
@./node_modules/@vytches/ddd-aggregates/LLMGUIDE.md
@./node_modules/@vytches/ddd-policies/LLMGUIDE.md
```

**Option 2 — Full library context** (~260K tokens):

```bash
git clone https://github.com/vytches/ddd && cd ddd
pnpm install
pnpm llm:bundle  # → repomix-output.md
```

Paste the resulting file into your AI assistant's context window once. The
assistant can then scaffold correct DDD code from then on.

## Package ecosystem

20 packages, organized in layers (acyclic dependency graph).

| Package                          | Purpose                                                                         |
| -------------------------------- | ------------------------------------------------------------------------------- |
| `@vytches/ddd`                   | Meta-package — re-exports the curated public surface                            |
| `@vytches/ddd-contracts`         | Foundation: `Result<T>`, `EntityId`, `IDomainEvent`, ...                        |
| `@vytches/ddd-domain-primitives` | Errors (`NotFoundError`, ...), `IActor`                                         |
| `@vytches/ddd-value-objects`     | `BaseValueObject`, `EntityId` impl                                              |
| `@vytches/ddd-aggregates`        | `AggregateRoot`, snapshot/audit/versioning capabilities                         |
| `@vytches/ddd-events`            | `DomainEvent`, `IntegrationEvent`, `UnifiedEventBus`                            |
| `@vytches/ddd-cqrs`              | `CommandBus`, `QueryBus`, decorators                                            |
| `@vytches/ddd-policies`          | `Specification`, `BaseBusinessPolicy`, composition                              |
| `@vytches/ddd-validation`        | Schema/rule-based validators                                                    |
| `@vytches/ddd-repositories`      | `BaseRepository`, `IRepository`                                                 |
| `@vytches/ddd-projections`       | `BaseProjection`, `ProjectionEngine`                                            |
| `@vytches/ddd-acl`               | Anti-corruption layer + context routing                                         |
| `@vytches/ddd-domain-services`   | `AsyncDomainService`, `EventAwareDomainService`, `UnitOfWorkAwareDomainService` |
| `@vytches/ddd-resilience`        | Circuit breaker, retry, bulkhead, timeout                                       |
| `@vytches/ddd-messaging`         | Outbox pattern (storage-agnostic)                                               |
| `@vytches/ddd-utils`             | `LibUtils`, `safeRun`, middleware                                               |
| `@vytches/ddd-logging`           | Structured logger + CQRS/event integration                                      |
| `@vytches/ddd-di`                | Service locator + container builder                                             |
| `@vytches/ddd-testing`           | Test harness, fixtures, builders                                                |
| `@vytches/ddd-nestjs`            | NestJS adapter (peer dep on `@nestjs/common`)                                   |

## Examples

Working code in [`examples/`](examples/):

- [`examples/quickstart/`](examples/quickstart/) — full Order domain (16 tests)
- [`examples/policies/`](examples/policies/) — 8 policy patterns (17 tests)
- [`examples/domain-services/`](examples/domain-services/) — 7 service patterns
  (17 tests)

Each is a runnable workspace project — `cd examples/<name> && pnpm test`.

## Status

**v0.25.0-beta.1** — first public release on npmjs.org. Library has been in
production use at the author's project for 2+ years; the beta tag signals API
stabilization, not maturity. Promote to `1.0.0` after 2-4 weeks of community
feedback.

See [`CHANGELOG.md`](CHANGELOG.md) for what's in this release.

## Contributing

PRs welcome. The repository is an Nx monorepo; key commands:

```bash
pnpm install            # bootstrap
pnpm test:ci            # all 23 projects
pnpm bench              # performance baselines
pnpm llm:guides:check   # ensures every package ships LLMGUIDE.md
```

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for details.

## License

MIT — see [`LICENSE`](LICENSE).
