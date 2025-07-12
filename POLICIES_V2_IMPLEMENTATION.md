# Policies V2 - Complete Redesign Implementation Plan

## 🎯 Vision: Industry-Leading TypeScript DDD Policy Framework

Creating the most advanced, type-safe, and developer-friendly business policy
library in the TypeScript ecosystem.

**Key Decision: Complete replacement of V1 - no backward compatibility, no
migration needed. Fresh start for maximum innovation.**

## 🏗️ Core Architecture Decisions

### 0. **Specifications as Foundation**

**CRITICAL:** All policies are built from `ISpecification<T>` from
`@vytches-ddd/contracts` and `@vytches-ddd/validation`.

```typescript
// Core integration with existing specifications
const userPolicy = PolicyBuilder.create<User>()
  .must(AgeSpecification.create({ min: 18 }))
  .withCode('AGE_INVALID')
  .and()
  .must(EmailSpecification.create())
  .withCode('EMAIL_INVALID')
  .and()
  .mustSatisfyRules(rules =>
    rules.forProperty('name', Rules.required().minLength(2))
  )
  .build();

// Async specifications for external services
interface IAsyncSpecification<T> {
  isSatisfiedByAsync(candidate: T, context?: PolicyContext): Promise<boolean>;
}

class CreditCheckSpecification implements IAsyncSpecification<LoanApplication> {
  async isSatisfiedByAsync(app: LoanApplication): Promise<boolean> {
    const score = await creditService.getScore(app.applicantId);
    return score >= app.requiredMinScore;
  }
}
```

**Why specification-based:**

- Reuse existing validation infrastructure
- Consistent with DDD specification pattern
- Testable and composable
- Type-safe domain logic
- Zero waste - build on existing foundation

### 1. **Promise-Based Unified Interface**

```typescript
interface IBusinessPolicy<T> {
  check(request: PolicyRequest<T>): Promise<Result<T, PolicyViolation>>;
  and(other: IBusinessPolicy<T>): IPolicyComposer<T>;
  or(other: IBusinessPolicy<T>): IPolicyComposer<T>;
  not(): IBusinessPolicy<T>;
  when(condition: PolicyCondition<T>): IConditionalPolicyBuilder<T>;
}
```

**Why Promise-based:**

- Future-proof for async business rules
- Unified API - no sync/async split
- Better composability
- Cleaner error handling

### 2. **Required PolicyContext**

```typescript
interface PolicyRequest<T> {
  entity: T;
  context: PolicyContext;
  metadata?: PolicyMetadata;
}

interface PolicyContext {
  userId: string;
  tenantId?: string;
  sessionId?: string;
  timestamp: Date;
  environment: string;
  features: Record<string, boolean>;
  metadata: Record<string, unknown>;
}
```

**Why required context:**

- Built-in audit trail
- Enterprise compliance ready
- Multi-tenancy support
- Better debugging capabilities

### 3. **Imperative Fluent API with Grouping**

```typescript
PolicyBuilder.create<User>()
  .withId('user-validation')
  .withDomain('users')
  .must(ageSpec)
  .withCode('AGE_INVALID')
  .withMessage('Age must be 18+')
  .withSeverity('ERROR')
  .and()
  .shouldSatisfyAny(
    Group.create().must(premiumSpec),
    Group.create().must(collateralSpec).and().must(creditSpec)
  )
  .withCache({ ttl: 300 })
  .withEvents({ enabled: true })
  .build();
```

**Why imperative:**

- More readable for complex rules
- Better IDE support
- Explicit grouping reduces precedence confusion
- Domain expert friendly

### 4. **Rich Violation System with Severity**

```typescript
class PolicyViolation {
  constructor(
    public readonly code: string,
    public readonly message: string,
    public readonly severity: 'ERROR' | 'WARNING' | 'INFO',
    public readonly field?: string,
    public readonly details?: Record<string, unknown>,
    public readonly context?: PolicyContext
  ) {}

  // Future extensibility for i18n
  localize?(locale: string): string;
  toMetrics?(): PolicyMetrics;
}
```

**Why rich violations:**

- Severity-based handling
- Better error categorization
- Extensible for future features
- Type-safe error handling

### 5. **Instance-Based Registry with Future Unification**

```typescript
interface IPolicyRegistry {
  register<T>(definition: PolicyDefinition<T>): void;
  resolve<T>(query: PolicyQuery): IBusinessPolicy<T>;
  unregister(domain: string, policyId: string): boolean;
  clear(): void;
  getDomains(): string[];
}

// Designed for future unified registry
class UnifiedRegistry {
  readonly policies: IPolicyRegistry;
  readonly events: IEventRegistry;
  readonly services: IServiceRegistry;

  constructor() {
    this.policies = new PolicyRegistry();
    // ... other registries
  }
}
```

**Why instance-based:**

- Testable via DI
- Multiple registries for different contexts
- Future unified registry ready
- Better separation of concerns

### 6. **Built-in Events with Smooth Integration**

```typescript
interface PolicyEvaluationEvent<T> {
  type: 'POLICY_EVALUATED';
  policyId: string;
  domain: string;
  entity: T;
  result: Result<T, PolicyViolation>;
  context: PolicyContext;
  duration: number;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

// Automatic event emission
class EventDrivenPolicy<T> implements IBusinessPolicy<T> {
  async check(request: PolicyRequest<T>): Promise<Result<T, PolicyViolation>> {
    const start = performance.now();
    const result = await this.inner.check(request);

    // Auto-emit if events enabled
    if (this.config.events?.enabled) {
      await this.eventBus.publish(
        new PolicyEvaluationEvent({
          policyId: this.id,
          domain: this.domain,
          entity: request.entity,
          result,
          context: request.context,
          duration: performance.now() - start,
          timestamp: new Date(),
        })
      );
    }

    return result;
  }
}
```

**Why built-in events:**

- Observability out of the box
- Audit trail for compliance
- Metrics and monitoring ready
- Opt-in, not forced

## 📁 New Package Structure

```
packages/policies/src/
├── core/
│   ├── interfaces/
│   │   ├── business-policy.interface.ts
│   │   ├── policy-request.interface.ts
│   │   ├── policy-context.interface.ts
│   │   └── policy-registry.interface.ts
│   ├── models/
│   │   ├── policy-violation.ts
│   │   ├── policy-definition.ts
│   │   └── policy-metadata.ts
│   └── base/
│       ├── base-business-policy.ts
│       └── base-composite-policy.ts
├── builders/
│   ├── policy-builder.ts
│   ├── policy-composer.ts
│   ├── conditional-policy-builder.ts
│   └── group-builder.ts
├── registry/
│   ├── policy-registry.ts
│   ├── policy-query.ts
│   └── unified-registry.ts (future)
├── events/
│   ├── policy-evaluation-event.ts
│   ├── event-driven-policy.ts
│   └── policy-event-bus.ts
├── adapters/
│   ├── policy-adapter.interface.ts
│   ├── adapter-registry.ts
│   └── README.md (implementation examples)
├── decorators/
│   ├── cached-policy.ts
│   ├── retry-policy.ts
│   └── timed-policy.ts
├── utils/
│   ├── policy-context-builder.ts
│   ├── policy-request-builder.ts
│   └── policy-validator.ts
└── index.ts
```

## 🔄 Implementation Steps

### Phase 1: Core Foundation (Priority: HIGH)

1. **New Interfaces** - IBusinessPolicy, PolicyRequest, PolicyContext
2. **IAsyncSpecification** - Extend specification pattern for async operations
3. **PolicyViolation** - Rich violation system with severity
4. **Base Implementations** - BaseBusinessPolicy, BaseCompositePolicy
5. **PolicyContextBuilder** - Fluent context creation
6. **Specification Adapters** - Convert BusinessRuleValidator to ISpecification

### Phase 2: Builder System (Priority: HIGH)

1. **PolicyBuilder** - Main fluent API with specification integration
2. **PolicyStepBuilder** - For .withCode(), .withMessage(), .withSeverity()
3. **GroupBuilder** - For complex grouping logic (.shouldSatisfyAny())
4. **ConditionalPolicyBuilder** - For .when() conditions
5. **PolicyComposer** - For runtime composition

### Phase 3: Registry & Events (Priority: MEDIUM)

1. **PolicyRegistry** - Instance-based with full CRUD
2. **PolicyEvaluationEvent** - Event model
3. **EventDrivenPolicy** - Auto-emission wrapper
4. **PolicyEventBus** - Event handling

### Phase 4: Advanced Features (Priority: LOW)

1. **Decorators** - Caching, retry, timing
2. **Adapter Infrastructure** - Ready for external libraries
3. **UnifiedRegistry** - Future registry consolidation
4. **Advanced Builders** - Pipeline, temporal policies

## 🎯 Key Innovation Points

### 1. **Conditional Policies**

```typescript
const dynamicPolicy = PolicyBuilder.create<Order>()
  .must(basicValidation)
  .when(ctx => ctx.environment === 'prod')
  .must(strictSecurityPolicy)
  .when(order => order.amount > 10000)
  .must(managerApprovalPolicy)
  .otherwiseWarn('Development environment - relaxed validation')
  .build();
```

### 2. **Group Satisfaction Logic**

```typescript
const flexiblePolicy = PolicyBuilder.create<LoanApplication>()
  .must(basicRequirements)
  .shouldSatisfyAny(
    Group.create('excellent-credit').must(excellentCreditSpec),
    Group.create('good-credit-with-collateral')
      .must(goodCreditSpec)
      .and()
      .must(collateralSpec),
    Group.create('guarantor-backed').must(guarantorSpec)
  )
  .build();
```

### 3. **Built-in Performance Features**

```typescript
const performantPolicy = PolicyBuilder.create<User>()
  .must(expensiveValidation)
  .withCache({
    ttl: 300,
    keyGenerator: user => `user:${user.id}:${user.version}`,
  })
  .withRetry({
    maxAttempts: 3,
    backoff: 'exponential',
  })
  .withTimeout(5000)
  .build();
```

### 4. **Temporal Policies**

```typescript
const timeAwarePolicy = PolicyBuilder.create<Transaction>()
  .must(coreValidation)
  .duringBusinessHours(strictLimitsPolicy)
  .duringWeekends(relaxedLimitsPolicy)
  .duringHolidays(holidayPolicy)
  .withTimezone('Europe/Warsaw')
  .build();
```

## 🔌 Adapter Pattern Ready

### Interface for Future Extensions

```typescript
interface IPolicyAdapter<TSchema, TEntity> {
  readonly name: string;
  readonly version: string;
  readonly supportedFeatures: AdapterFeature[];

  createPolicy(
    schema: TSchema,
    config: PolicyAdapterConfig
  ): Promise<IBusinessPolicy<TEntity>>;

  validateSchema(schema: TSchema): AdapterValidationResult;
}

// Future community implementations
// - ZodPolicyAdapter
// - JoiPolicyAdapter
// - YupPolicyAdapter
// - AjvPolicyAdapter
// - ClassValidatorAdapter
```

## 🧪 Testing Strategy

### 1. **Unit Tests** - Each component isolated

### 2. **Integration Tests** - Builder combinations

### 3. **Performance Tests** - Large policy compositions

### 4. **E2E Tests** - Real business scenarios

### 5. **Adapter Tests** - Adapter interface compliance

## 📊 Success Metrics

1. **Developer Experience** - Fluent API adoption
2. **Performance** - Policy evaluation speed
3. **Type Safety** - Compile-time error detection
4. **Extensibility** - Community adapter implementations
5. **Enterprise Adoption** - Complex business rule implementations

## 🔧 Specification Integration Details

### Direct Specification Support

```typescript
class PolicyBuilder<T> {
  // Core specification methods
  must(specification: ISpecification<T>): PolicyStepBuilder<T>;
  should(specification: ISpecification<T>): PolicyStepBuilder<T>;
  mustAsync(specification: IAsyncSpecification<T>): AsyncPolicyStepBuilder<T>;

  // BusinessRuleValidator integration
  mustSatisfyRules(
    rulesBuilder: (rules: BusinessRuleValidator<T>) => BusinessRuleValidator<T>
  ): PolicyStepBuilder<T>;

  // Quick predicate specifications
  mustSatisfy(
    predicate: (entity: T, context?: PolicyContext) => boolean
  ): PolicyStepBuilder<T>;
}
```

### Comprehensive Example

```typescript
const loanPolicy = PolicyBuilder.create<LoanApplication>()
  // Existing specifications
  .must(AgeSpecification.create({ min: 18, max: 65 }))
  .and()
  .must(IncomeSpecification.create({ min: 50000 }))

  // Business rule validators as specs
  .mustSatisfyRules(rules =>
    rules
      .forProperty('amount', Rules.min(1000).max(500000))
      .forProperty(
        'purpose',
        Rules.required().oneOf(['home', 'car', 'business'])
      )
  )

  // Custom async specifications
  .mustAsync(new CreditCheckSpecification(creditService))

  // Quick predicates
  .mustSatisfy((app, ctx) => (ctx.environment === 'prod' ? app.hasKYC : true))

  // Complex OR groups
  .shouldSatisfyAny(
    Group.create().must(ExcellentCreditSpecification.create()),
    Group.create()
      .must(GoodCreditSpecification.create())
      .and()
      .must(CollateralSpecification.create())
  )
  .build();
```

## 🚀 Why This Will Be Industry-Leading

1. **First unified async policy framework** in TypeScript
2. **Enterprise-grade features** built-in (audit, multi-tenancy, caching)
3. **Unmatched type safety** with rich violation system
4. **Most expressive fluent API** for complex business rules
5. **Adapter-ready architecture** for any validation library
6. **Built-in observability** and performance monitoring
7. **Future-proof design** with extensibility at core

---

**Next Steps:** Start with Phase 1 implementation, then gradually build out the
advanced features. This design positions us to create the definitive business
policy library for TypeScript/DDD applications.

**Token Usage:** This comprehensive plan will require significant implementation
work. We can break it into smaller chunks and continue in new threads as needed.

Ready to begin implementation? 🎯
