# @vytches/ddd-policies - LLM Guide

## Purpose

Business policy engine with a fluent `PolicyBuilder` DSL, composable
`BaseBusinessPolicy` classes, a `PolicyRegistry`, event-driven observability via
`PolicyEventBus`, and cross-cutting behaviors (caching, retry, temporal).
Policies wrap domain rules that require context (user, tenant, environment)
beyond what a pure specification can express.

## Quick Start

```typescript
import {
  PolicyBuilder,
  PolicyRequestFactory,
  PolicyViolation,
} from '@vytches/ddd-policies';
import { Specification } from '@vytches/ddd-validation';

interface Order {
  total: number;
  customerId: string;
  status: string;
}

// Build a policy using fluent DSL
const orderPolicy = PolicyBuilder.create<Order>()
  .withId('order-placement')
  .withDomain('ordering')
  .withName('Order Placement Policy')
  .must(Specification.create<Order>(o => o.total > 0))
  .withErrorCode('INVALID_TOTAL')
  .withMessage('Order total must be positive')
  .must(Specification.create<Order>(o => o.status === 'draft'))
  .withErrorCode('WRONG_STATUS')
  .withMessage('Only draft orders can be placed')
  .build();

// Create a request with context
const request = PolicyRequestFactory.minimal(order, userId);

// Evaluate
const result = await orderPolicy.check(request);
if (result.isFailure) {
  const violation: PolicyViolation = result.error;
  console.error(violation.code, violation.message, violation.severity);
}
```

## Key API

| Export                                                | Description                                                               |
| ----------------------------------------------------- | ------------------------------------------------------------------------- |
| `PolicyBuilder.create<T>(config?)`                    | Start a new fluent policy builder                                         |
| `PolicyBuilder.forDomain<T>(domain, config?)`         | Builder pre-configured with a domain                                      |
| `PolicyBuilder.must(spec)`                            | Add required sync spec step                                               |
| `PolicyBuilder.mustAsync(spec)`                       | Add required async spec step                                              |
| `PolicyBuilder.should(spec)`                          | Add optional (WARNING) sync spec step                                     |
| `PolicyBuilder.mustSatisfy(predicate, code, message)` | Add raw predicate step                                                    |
| `PolicyBuilder.when(condition)`                       | Conditional branch entry point                                            |
| `PolicyBuilder.build()`                               | Compile to `IBusinessPolicy<T>`                                           |
| `BaseBusinessPolicy<T>`                               | Abstract base class; implement `check(request)`                           |
| `SpecificationPolicy<T>`                              | Wraps a sync spec as a policy                                             |
| `AsyncSpecificationPolicy<T>`                         | Wraps an async spec as a policy                                           |
| `BaseCompositePolicy<T>`                              | Base for multi-policy composites                                          |
| `PolicyViolation`                                     | Single violation with `code`, `message`, `severity`, `policyId`, `domain` |
| `PolicyViolationCollection`                           | Multiple violations from composite evaluations                            |
| `PolicyRegistry`                                      | In-memory registry; `register`, `resolve`, `tryResolve`, `findByTags`     |
| `PolicyRequestBuilder.forEntity<T>(entity)`           | Start building a `PolicyRequest`                                          |
| `PolicyRequestFactory.minimal<T>(entity, userId)`     | Quick request creation                                                    |
| `PolicyRequestFactory.webRequest(opts)`               | Web-context request with IP, session, etc.                                |
| `PolicyEventBus`                                      | Pub/sub bus for `PolicyEvaluationEvent`; `subscribe`, `publish`           |
| `PolicyCachingBehavior`                               | Cache policy results by entity key                                        |
| `PolicyRetryBehavior`                                 | Retry on transient failure                                                |
| `PolicyTemporalBehavior`                              | Time-window and business-calendar enforcement                             |

## Patterns

### Pattern 1: Custom policy class

Extend `BaseBusinessPolicy` when the evaluation logic is too complex for the
builder or when the policy needs injected dependencies.

```typescript
import {
  BaseBusinessPolicy,
  PolicyViolation,
  PolicyRequestBuilder,
} from '@vytches/ddd-policies';
import type { PolicyRequest } from '@vytches/ddd-policies';
import { Result } from '@vytches/ddd-utils';

class CreditLimitPolicy extends BaseBusinessPolicy<Order> {
  constructor(private readonly creditService: CreditService) {
    super('credit-limit', 'ordering', 'Credit Limit Policy');
  }

  async check(
    request: PolicyRequest<Order>
  ): Promise<Result<Order, PolicyViolation>> {
    const limit = await this.creditService.getLimit(request.context.userId);
    if (request.entity.total > limit) {
      return this.failure(
        this.createViolation(
          'CREDIT_EXCEEDED',
          `Order exceeds credit limit of ${limit}`,
          'ERROR'
        )
      );
    }
    return this.success(request.entity);
  }
}
```

### Pattern 2: Policy composition

Combine policies using `.and()`, `.or()`, `.not()` on any `BaseBusinessPolicy`.

```typescript
const fullPolicy = new CreditLimitPolicy(creditService)
  .and(orderPolicy) // both must pass
  .and(new FraudCheckPolicy());

const request = PolicyRequestFactory.webRequest({
  entity: order,
  userId: 'user-1',
  tenantId: 'tenant-a',
  operation: 'place-order',
  correlationId: req.headers['x-correlation-id'],
});

const result = await fullPolicy.check(request);
```

### Pattern 3: Registry + event-driven observability

```typescript
import {
  PolicyRegistry,
  PolicyEventBus,
  withEvents,
  PolicyDefinitionBuilder,
} from '@vytches/ddd-policies';

const bus = new PolicyEventBus({ enableMetrics: true, errorStrategy: 'log' });
const registry = new PolicyRegistry();

// Register with definition metadata
registry.register({
  id: 'credit-limit',
  domain: 'ordering',
  name: 'Credit Limit Policy',
  policy: new CreditLimitPolicy(creditService),
  version: '1.0.0',
  tags: ['financial', 'compliance'],
  isActive: true,
  priority: 100,
});

// Wrap with event emission
const trackedPolicy = withEvents(
  registry.resolve<Order>({ domain: 'ordering', policyId: 'credit-limit' }),
  bus
);

// Subscribe to evaluation outcomes
bus.subscribe({
  id: 'audit-handler',
  eventTypes: ['policy.evaluated'],
  handler: async event => auditLog.write(event),
  domains: ['ordering'],
});

const result = await trackedPolicy.check(request);
```

## Anti-Patterns

**Using policies for simple field validation.** Policies require a
`PolicyRequest` with context (userId, tenantId, environment). For pure domain
invariants that need no context, use `Specification` or `BusinessRuleValidator`
from `@vytches/ddd-validation` instead.

**Not checking `result.isFailure` after `policy.check()`.** The `check()` method
returns `Result<T, PolicyViolation>`, not a thrown exception. Ignoring the
result silently allows invalid operations to proceed.

```typescript
// Wrong: result ignored
await policy.check(request);
await orderService.place(order);

// Correct: check before proceeding
const result = await policy.check(request);
if (result.isFailure) throw new DomainException(result.error.message);
await orderService.place(order);
```

**Policies without context.** `PolicyRequest` requires a `PolicyContext` (userId
at minimum). Passing a raw entity object directly to `check` does not work —
always construct a request via `PolicyRequestBuilder` or `PolicyRequestFactory`.

**Calling `PolicyBuilder.build()` without `.withId()`, `.withDomain()`, and
`.withName()`.** All three are required; `build()` throws synchronously if any
are missing.

**Registering the same `policyId` twice in `PolicyRegistry`.** `register()`
throws on duplicate `domain:policyId` keys. Call `unregister(domain, id)` first
if replacing a policy.

## Hidden Features

**`PolicyBuilder.should(spec)` produces WARNING-severity violations**, not
errors. A should-step failure does not stop the policy evaluation chain, and the
result is `isSuccess` if only should-steps failed.

**`PolicyRequestFactory` has environment-specific factories.** `webRequest`,
`apiRequest`, `backgroundJob`, and `test` pre-populate environment metadata so
policy logic can branch on `request.context.environment`.

**`PolicyCachingBehavior` wraps any `IBusinessPolicy`.** Pass a policy and a
cache config (ttl, key extractor) to `PolicyCachingBehaviorFactory.create()` to
get a caching policy decorator without subclassing.

**`globalPolicyEventBus` is a pre-built singleton.** Import it for quick setup
in tests or small applications instead of constructing a new `PolicyEventBus`.

**`SpecificationPolicy.fromSpecification` and
`AsyncSpecificationPolicy.fromAsyncSpecification`** are static factories for
wrapping a spec as a named, domain-tagged policy in one line — useful when you
already have a spec and want to register it in the `PolicyRegistry`.

## Package Dependencies

`@vytches/ddd-policies` depends on:

- `@vytches/ddd-contracts` — `ISpecification`, `IAsyncSpecification`
- `@vytches/ddd-utils` — `Result<T, E>`
- `@vytches/ddd-logging` — structured logger
- `@vytches/ddd-validation` — `BusinessRuleValidator` (via adapters)

Packages that depend on `@vytches/ddd-policies`:

- `@vytches/ddd-enterprise` — re-exports everything
- Application layer use-case handlers that enforce business policies before
  mutating aggregates
