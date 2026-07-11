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

| Export                                                                         | Description                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PolicyBuilder.create<T>(config?)`                                             | Start a new fluent policy builder                                                                                                                                                                                                         |
| `PolicyBuilder.forDomain<T>(domain, config?)`                                  | Builder pre-configured with a domain                                                                                                                                                                                                      |
| `PolicyBuilder.must(spec)`                                                     | Add required sync spec step                                                                                                                                                                                                               |
| `PolicyBuilder.mustAsync(spec)`                                                | Add required async spec step                                                                                                                                                                                                              |
| `PolicyBuilder.should(spec)`                                                   | Add optional (WARNING) sync spec step                                                                                                                                                                                                     |
| `PolicyBuilder.mustSatisfy(predicate, code, message)`                          | Add raw predicate step                                                                                                                                                                                                                    |
| `PolicyBuilder.when(condition)`                                                | Conditional branch entry point                                                                                                                                                                                                            |
| `PolicyBuilder.build()`                                                        | Compile to `IBusinessPolicy<T>`                                                                                                                                                                                                           |
| `BaseBusinessPolicy<T>`                                                        | Abstract base class; implement `check(request)`                                                                                                                                                                                           |
| `SpecificationPolicy<T>`                                                       | Wraps a sync spec as a policy                                                                                                                                                                                                             |
| `AsyncSpecificationPolicy<T>`                                                  | Wraps an async spec as a policy                                                                                                                                                                                                           |
| `BaseCompositePolicy<T>`                                                       | Base for multi-policy composites                                                                                                                                                                                                          |
| `PolicyViolation`                                                              | Single violation with `code`, `message`, `severity`, `policyId`, `domain`                                                                                                                                                                 |
| `PolicyViolationCollection`                                                    | Multiple violations from composite evaluations                                                                                                                                                                                            |
| `PolicyRegistry`                                                               | In-memory registry; `register`, `resolve`, `tryResolve`, `findByTags`                                                                                                                                                                     |
| `PolicyRequestBuilder.forEntity<T>(entity)`                                    | Start building a `PolicyRequest`                                                                                                                                                                                                          |
| `PolicyRequestFactory.minimal<T>(entity, userId)`                              | Quick request creation                                                                                                                                                                                                                    |
| `PolicyRequestFactory.webRequest(opts)`                                        | Web-context request with IP, session, etc.                                                                                                                                                                                                |
| `PolicyEventBus`                                                               | Pub/sub bus for `PolicyEvaluationEvent`; `subscribe`, `publish`                                                                                                                                                                           |
| `PolicyCachingBehavior`                                                        | Cache policy results by entity key                                                                                                                                                                                                        |
| `PolicyRetryBehavior`                                                          | Retry on transient failure                                                                                                                                                                                                                |
| `PolicyTemporalBehavior`                                                       | Time-window and business-calendar enforcement                                                                                                                                                                                             |
| `PolicyMetadata`                                                               | Optional context metadata on `PolicyRequest` (correlationId, source, operation, ipAddress, userAgent, custom)                                                                                                                             |
| `PolicyMetadataBuilder.create()`                                               | Fluent builder for `PolicyMetadata`                                                                                                                                                                                                       |
| `PolicyDefinition<T>`                                                          | Shape stored by `PolicyRegistry.register()` (id, domain, name, policy, version, tags, isActive, priority)                                                                                                                                 |
| `PolicyDefinitionBuilder<T>`                                                   | Fluent builder for `PolicyDefinition`; `.create()`, `.withId()`, `.withDomain()`, `.withName()`, `.withPolicy()`, `.withVersion()`, `.withTags()`, `.withPriority()`, `.build()` — throws if id/domain/name/policy missing; see Pattern 3 |
| `PolicyQuery`                                                                  | Query passed to `PolicyRegistry.resolve`/`tryResolve` (domain, policyId, version?, tags?)                                                                                                                                                 |
| `PolicyCondition<T>`                                                           | Predicate type accepted by `IBusinessPolicy.when(condition)`                                                                                                                                                                              |
| `PolicyViolationSeverity`                                                      | `'ERROR' \| 'WARNING' \| 'INFO'` union used by violations and step builders                                                                                                                                                               |
| `PolicyViolationOptions`                                                       | Constructor options for `new PolicyViolation(options)`                                                                                                                                                                                    |
| `PolicyViolationData`                                                          | Plain-object shape from `PolicyViolation.toJSON()` / static `.fromJSON()`                                                                                                                                                                 |
| `IPolicyComposer<T>`                                                           | Returned by `.and()`/`.or()`; adds `.group()` for precedence control                                                                                                                                                                      |
| `IGroupedPolicyComposer<T>`                                                    | Returned by `IPolicyComposer.group()`; adds `.endGroup()`                                                                                                                                                                                 |
| `IPolicyRegistry`                                                              | Interface implemented by `PolicyRegistry`                                                                                                                                                                                                 |
| `IUnifiedRegistry`                                                             | `{ policies: IPolicyRegistry }` wrapper for future multi-registry composition                                                                                                                                                             |
| `PolicyRegistryStatistics`                                                     | Shape returned by `PolicyRegistry.getStatistics()` (totalPolicies, activePolicies, domainStats, ...)                                                                                                                                      |
| `PolicyContextBuilder`                                                         | Fluent builder for `PolicyContext`; static helpers `.forUser`, `.forUserAndTenant`, `.development`, `.production`, `.test`, `.from`                                                                                                       |
| `PolicyContextFactory`                                                         | Static one-liners: `.minimal`, `.withTenant`, `.webRequest`, `.apiRequest`, `.backgroundJob` (used by `PolicyRequestFactory` internally)                                                                                                  |
| `IPolicyBuilder<T>`                                                            | Interface implemented by `PolicyBuilder`                                                                                                                                                                                                  |
| `IPolicyStepBuilder<T>` / `PolicyStepBuilder<T>`                               | Returned by `.must()`/`.should()`/etc.; chain `.withCode()`, `.withMessage()`, `.withSeverity()`, `.and()`, `.or()`, `.build()`                                                                                                           |
| `PolicyBuilderConfig<T>`                                                       | Optional config for `PolicyBuilder.create`/`.forDomain` (defaultDomain, defaultSeverity, defaultErrorCodePrefix, enableCaching, enableEvents)                                                                                             |
| `PolicyBuildStep<T>`                                                           | Internal step record type used by `PolicyBuilder`, exported for advanced composition                                                                                                                                                      |
| `IConditionalPolicyBuilder<T>` / `ConditionalPolicyBuilder<T>`                 | Returned by `PolicyBuilder.when(condition)`; see Pattern 4                                                                                                                                                                                |
| `IConditionalPolicyThenStepBuilder<T>` / `ConditionalPolicyThenStepBuilder<T>` | Returned by `.thenMust()`/`.thenMustAsync()`; chain `.withCode()`, `.withMessage()`, `.otherwise*()`                                                                                                                                      |
| `IConditionalPolicyElseStepBuilder<T>` / `ConditionalPolicyElseStepBuilder<T>` | Returned by `.otherwiseMust()`; chain `.withCode()`, `.withMessage()`, `.build()`                                                                                                                                                         |
| `IConditionalPolicyElse<T>` / `ConditionalPolicyElse<T>`                       | Returned by `.then()`/`.otherwise()`/`.otherwisePass()`/`.otherwiseWarn()`; exposes `.build()`                                                                                                                                            |
| `IPolicyGroup<T>` / `PolicyGroup<T>`                                           | Standalone OR-group; `PolicyGroup.create<T>(groupName?)`; combine with `PolicyBuilder.shouldSatisfyAny(...)`; see Pattern 5                                                                                                               |
| `IPolicyGroupStepBuilder<T>` / `PolicyGroupStepBuilder<T>`                     | Returned by `PolicyGroup.must()`/`.mustAsync()`/`.mustSatisfy()`                                                                                                                                                                          |
| `PolicyGroupStep<T>`                                                           | Internal step record type for `PolicyGroup`, exported for advanced composition                                                                                                                                                            |
| `BusinessRuleValidatorAdapter<T>`                                              | Wraps a `BusinessRuleValidator` as `ISpecification<T>`; static `.create()`                                                                                                                                                                |
| `BusinessRuleValidatorPolicy<T>`                                               | Wraps a `BusinessRuleValidator` directly as `IBusinessPolicy<T>`; static `.fromValidator()`                                                                                                                                               |
| `PolicySpecificationFactory`                                                   | Static hub: `.fromSpecification`, `.fromAsyncSpecification`, `.fromBusinessRuleValidator`, `.businessRuleValidatorToSpecification`                                                                                                        |
| `PolicyCacheConfig`                                                            | Config for `PolicyCachingBehavior` (ttl, keyGenerator, namespace, maxSize, cacheFailures, enableMetrics)                                                                                                                                  |
| `PolicyRetryBehaviorFactory`                                                   | Presets over `PolicyRetryBehavior`: `.forTransientFailures()`, `.forExternalServices()`, `.withCustomLogic()`                                                                                                                             |
| `PolicyRetryConfig`                                                            | Config for `PolicyRetryBehavior` (maxAttempts, baseDelay, backoff, shouldRetry, shouldRetryOnException)                                                                                                                                   |
| `RetryAttempt` / `RetryMetrics`                                                | Per-attempt record / aggregate metrics from `PolicyRetryBehavior.getRetryMetrics()`                                                                                                                                                       |
| `PolicyTemporalBehaviorBuilder<T>`                                             | Fluent builder producing `PolicyTemporalBehavior`; `.withBusinessCalendar()`, `.duringBusinessHours()`, `.duringWeekends()`, `.otherwise()`, `.build()`                                                                                   |
| `PolicyTemporalBehaviorFactory`                                                | Presets: `.businessHours()`, `.weekendAware()`, `.holidayAware()`                                                                                                                                                                         |
| `BusinessCalendar`                                                             | Business hours / working days / holidays / timezone input to temporal config                                                                                                                                                              |
| `TemporalCondition<T>`                                                         | Custom predicate `(entity, context, temporal) => boolean` for `PolicyTemporalBehaviorBuilder.when()`                                                                                                                                      |
| `TemporalInfo`                                                                 | Computed time context (isBusinessHours, isWeekend, isHoliday, dayOfWeek, timeOfDay) passed to conditions                                                                                                                                  |
| `TemporalPolicyConfig`                                                         | Full config accepted by `PolicyTemporalBehavior.create()`                                                                                                                                                                                 |
| `PolicyEvent<T>`                                                               | Union of `PolicyEvaluationStartedEvent \| PolicyEvaluationEvent \| PolicyEvaluationErrorEvent`                                                                                                                                            |
| `PolicyEvaluationStartedEvent<T>`                                              | Emitted before evaluation when `emitStartEvents` is enabled on `EventDrivenPolicy`                                                                                                                                                        |
| `PolicyEvaluationErrorEvent<T>`                                                | Emitted when the wrapped policy's `check()` throws                                                                                                                                                                                        |
| `PolicyEventBuilder<T>`                                                        | Builds event payloads; `.evaluationStarted()`, `.evaluationCompleted()`, `.evaluationError()` (used internally by `EventDrivenPolicy`)                                                                                                    |
| `PolicyEventHandler<T>`                                                        | Handler function type: `(event) => void \| Promise<void>`                                                                                                                                                                                 |
| `PolicyEventSubscription`                                                      | Shape `PolicyEventBus.subscribe()` accepts (minus `id`, which is generated and returned)                                                                                                                                                  |
| `PolicyEventBusConfig`                                                         | Constructor config for `PolicyEventBus` (maxHandlers, enableMetrics, parallelExecution, errorStrategy, timeout)                                                                                                                           |
| `PolicyEventBusMetrics`                                                        | Shape returned by `PolicyEventBus.getMetrics()`                                                                                                                                                                                           |
| `PolicyExecutionMetrics`                                                       | Per-policy metrics shape tracked by `PolicyMetricsAggregator`                                                                                                                                                                             |
| `PolicyMetricsAggregator`                                                      | Aggregates `PolicyEvent`s into per-policy execution metrics; `.processEvent()`, `.getMetrics()`; see Pattern 6                                                                                                                            |
| `EventDrivenPolicy<T>`                                                         | `IBusinessPolicy` decorator that emits `PolicyEvent`s around `check()`; created via `withEvents()` or `EventDrivenPolicy.wrap()`; see Pattern 6                                                                                           |
| `EventDrivenPolicyConfig`                                                      | Config for `EventDrivenPolicy`/`withEvents` (eventBus, emitStartEvents, emitCompletionEvents, emitErrorEvents, includeEntityInEvents, includeContextInEvents)                                                                             |
| `EventDrivenPolicyFactory`                                                     | Factory with shared defaults: `.create()`, `.createWithAudit()`, `.createWithPerformanceMonitoring()`                                                                                                                                     |
| `PolicyEventHandlers`                                                          | Static handler factories: `.createLoggingHandler()`, `.createMetricsHandler()`, `.createFilteringHandler()`                                                                                                                               |

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

// Register with definition metadata, built via PolicyDefinitionBuilder
const definition = PolicyDefinitionBuilder.create<Order>()
  .withId('credit-limit')
  .withDomain('ordering')
  .withName('Credit Limit Policy')
  .withPolicy(new CreditLimitPolicy(creditService))
  .withVersion('1.0.0')
  .withTags('financial', 'compliance')
  .withPriority(100)
  .build();
registry.register(definition);

// Wrap with event emission. withEvents is curried: withEvents(config)(policy).
const trackedPolicy = withEvents<Order>({ eventBus: bus })(
  registry.resolve<Order>({ domain: 'ordering', policyId: 'credit-limit' })
);

// Subscribe to evaluation outcomes. subscribe() generates and returns the id
// (do not pass one in — PolicyEventSubscription minus 'id' is what it accepts).
const subscriptionId = bus.subscribe({
  eventTypes: ['POLICY_EVALUATED'],
  handler: async event => auditLog.write(event),
  domains: ['ordering'],
});

const result = await trackedPolicy.check(request);
```

### Pattern 4: Conditional policy branch (`when`/`thenMust`/`otherwise*`)

`PolicyBuilder.when(condition)` returns a standalone conditional policy builder
(`IConditionalPolicyBuilder`) — it does not merge back into the parent builder's
own steps. `.thenMust()`/`.thenMustAsync()` define the "if condition met"
branch; `.otherwise()`, `.otherwiseMust()`, `.otherwisePass()`, or
`.otherwiseWarn()` define the "else" branch. Call `.build()` on the resulting
else-step to get an `IBusinessPolicy<T>`.

```typescript
import { PolicyBuilder } from '@vytches/ddd-policies';
import { Specification } from '@vytches/ddd-validation';

interface Order {
  total: number;
  isApproved: boolean;
}

const approvalPolicy = PolicyBuilder.create<Order>()
  .when((order: Order) => order.total > 10_000)
  .thenMust(Specification.create<Order>(o => o.isApproved))
  .withCode('APPROVAL_REQUIRED')
  .withMessage('Orders over 10,000 require manager approval')
  .otherwiseWarn('Order below approval threshold - no approval needed')
  .build();

const result = await approvalPolicy.check(request);
```

### Pattern 5: OR-groups with `PolicyGroup` + `shouldSatisfyAny`

`PolicyGroup.create<T>(name?)` builds a standalone group of AND-ed steps. Pass
one or more groups to `PolicyBuilder.shouldSatisfyAny(...)` so that the overall
policy step passes when **at least one** group fully passes.

```typescript
import { PolicyBuilder, PolicyGroup } from '@vytches/ddd-policies';
import { Specification } from '@vytches/ddd-validation';

interface Order {
  hasVipTag: boolean;
  loyaltyPoints: number;
}

const vipGroup = PolicyGroup.create<Order>('vip-customer')
  .must(Specification.create<Order>(o => o.hasVipTag))
  .withCode('NOT_VIP')
  .withMessage('Customer is not VIP');

const loyaltyGroup = PolicyGroup.create<Order>('loyalty-points')
  .must(Specification.create<Order>(o => o.loyaltyPoints >= 1000))
  .withCode('INSUFFICIENT_POINTS')
  .withMessage('Not enough loyalty points');

const freeShippingPolicy = PolicyBuilder.create<Order>()
  .withId('free-shipping-eligibility')
  .withDomain('ordering')
  .withName('Free Shipping Eligibility')
  .shouldSatisfyAny(vipGroup, loyaltyGroup)
  .build();

const result = await freeShippingPolicy.check(request);
```

### Pattern 6: Combined group + conditional policy with event observability

Full-feature example: a composite fraud-check policy built from OR-groups, an
escalation layer built with the conditional builder, wrapped in
`EventDrivenPolicy` (via `withEvents`) for observability, and fed into
`PolicyMetricsAggregator` through a `PolicyEventBus` subscription. This is the
combined workflow the conditional/group builder subsystem and the policy event
system are designed to support together.

```typescript
import {
  PolicyBuilder,
  PolicyGroup,
  PolicyEventBus,
  PolicyEventHandlers,
  PolicyMetricsAggregator,
  withEvents,
} from '@vytches/ddd-policies';
import { Specification } from '@vytches/ddd-validation';

interface Order {
  riskScore: number;
  countryAllowed: boolean;
  requiresManualReview: boolean;
}

// 1. Composite policy from OR-groups: at least one group must pass.
const lowRiskGroup = PolicyGroup.create<Order>('low-risk')
  .must(Specification.create<Order>(o => o.riskScore < 30))
  .withCode('RISK_TOO_HIGH')
  .withMessage('Risk score too high for auto-approval');

const trustedCountryGroup = PolicyGroup.create<Order>('trusted-country')
  .must(Specification.create<Order>(o => o.countryAllowed))
  .withCode('COUNTRY_NOT_ALLOWED')
  .withMessage('Shipping country requires manual review');

const fraudCheckPolicy = PolicyBuilder.create<Order>()
  .withId('fraud-check')
  .withDomain('ordering')
  .withName('Fraud Check Policy')
  .shouldSatisfyAny(lowRiskGroup, trustedCountryGroup)
  .build();

// 2. Conditional escalation layer on top: manual-review orders always fail
// until cleared, everything else falls through to the composite fraud check.
const escalationPolicy = PolicyBuilder.create<Order>()
  .when((order: Order) => order.requiresManualReview)
  .thenMust(Specification.create<Order>(() => false))
  .withCode('MANUAL_REVIEW_PENDING')
  .withMessage('Order flagged for manual review')
  .otherwise(fraudCheckPolicy)
  .build();
// Note: build() on a conditional branch always produces a policy with
// id/domain hardcoded to "conditional" (see ConditionalPolicyElse.build) -
// group by that, not by 'fraud-check', when reading escalation-layer metrics.

// 3. Wrap with event emission. withEvents is curried: withEvents(config)(policy).
const bus = new PolicyEventBus({ enableMetrics: true, errorStrategy: 'log' });
const trackedPolicy = withEvents<Order>({
  eventBus: bus,
  emitCompletionEvents: true,
  emitErrorEvents: true,
})(escalationPolicy);

// 4. Feed every evaluation into a metrics aggregator via the event bus.
// subscribe() generates and returns the subscription id.
const aggregator = new PolicyMetricsAggregator();
const subscriptionId = bus.subscribe({
  eventTypes: ['POLICY_EVALUATED', 'POLICY_EVALUATION_ERROR'],
  handler: PolicyEventHandlers.createMetricsHandler(event =>
    aggregator.processEvent(event)
  ),
});

const result = await trackedPolicy.check(request);
console.log(aggregator.getMetrics('conditional', 'conditional'));
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

**There is no pre-built `PolicyEventBus` singleton.** VF-024/SA-M11 removed
`globalPolicyEventBus` from the public barrel — a process-global, un-partitioned
fan-out singleton is not safe to publish as public API (no tenant/context
isolation, shared subscriber cap across all consumers). Construct your own
instance instead: `new PolicyEventBus()`.

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
