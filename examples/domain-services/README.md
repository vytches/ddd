# @vytches/ddd-domain-services — Examples

Seven examples covering every base class + composition pattern in
`@vytches/ddd-domain-services`. Each file is standalone, has a real-world use
case, and is verified by tests in `tests/domain-services-examples.test.ts`.

## Examples

| #   | File                                                                 | Pattern                                                  | Use case                               |
| --- | -------------------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------- |
| 1   | [`01-order-processing.ts`](src/01-order-processing.ts)               | `AsyncDomainService` (stateless, Result<T>)              | Cart pricing with tier-based discounts |
| 2   | [`02-payment-orchestration.ts`](src/02-payment-orchestration.ts)     | `EventAwareDomainService` + `publishEvent`               | Authorize / decline events             |
| 3   | [`03-inventory-management.ts`](src/03-inventory-management.ts)       | `AsyncDomainService` lifecycle (`initialize`, `dispose`) | TTL-bounded SKU reservations           |
| 4   | [`04-user-registration.ts`](src/04-user-registration.ts)             | `UnitOfWorkAwareDomainService` + `executeInTransaction`  | Atomic multi-aggregate sign-up         |
| 5   | [`05-service-composition.ts`](src/05-service-composition.ts)         | Service composition via constructor injection            | End-to-end checkout orchestration      |
| 6   | [`06-transaction-rollback.ts`](src/06-transaction-rollback.ts)       | Throw to rollback, return to commit                      | Money transfer between accounts        |
| 7   | [`07-testing-domain-services.ts`](src/07-testing-domain-services.ts) | `RecordingEventBus`, `FakePaymentGateway`, in-memory UoW | How to test services in isolation      |

## Run the tests

```bash
cd examples/domain-services
pnpm test
```

17 tests covering all 7 examples.

## Use in your project

These examples are NOT a published package — copy the file you want into your
codebase and adapt the domain types to your bounded context. The imports they
use are all from published packages:

```typescript
import {
  AsyncDomainService,
  EventAwareDomainService,
  UnitOfWorkAwareDomainService,
  DomainService,
} from '@vytches/ddd-domain-services';
```

The examples reflect the real public API as of
`@vytches/ddd-domain-services@0.25.0-beta.1`. The full behavior reference lives
in `packages/domain-services/LLMGUIDE.md`.

## Key design choices demonstrated

- **Stateless services** are the default. State lives in aggregates. Example 3
  (inventory) is an exception — explicitly noted as stateful with lifecycle
  hooks.
- **Constructor injection over DI lookups.** Service dependencies arrive via
  `constructor(private readonly other: OtherService)`. The `@DomainService()`
  decorator is for _discovery_, not lookup.
- **Result<T, E> over throwing.** Expected outcomes (insufficient stock,
  declined payment, invalid email) are values, not exceptions.
- **Test in pure isolation.** Example 7 ships the helpers you need — no real
  bus, no real database, no real DI container.
