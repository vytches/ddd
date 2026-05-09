# VD-002: Policies V2 Advanced Examples

**Priority**: 85/100  
**Category**: Documentation  
**Pillar**: Developer Experience  
**Estimated Time**: 10 hours  
**Dependencies**: None  
**Status**: Ready for Implementation

## 📋 Context

Current Policies V2 package has powerful features but lacks comprehensive
examples:

- Basic specification usage not documented
- PolicyGroup for complex business rules undocumented
- Conditional policy patterns missing
- Event-driven policy examples absent
- Policy behaviors (retry, caching, temporal) not shown
- Framework integration patterns unclear
- Enterprise patterns not documented

**Business Impact**: 40% reduction in onboarding complexity for policy
implementation

## 🎯 Objectives

1. Create comprehensive basic policy examples with specifications
2. Document PolicyGroup for complex AND/OR business rules
3. Demonstrate conditional policy patterns
4. Show event-driven policy implementation
5. Document all policy behaviors (retry, caching, temporal)
6. Create framework integration examples
7. Add enterprise policy patterns
8. Create migration guide from V1 to V2

## 📊 Current Documentation Gaps

```typescript
// Current: Users struggle to understand basic usage
import { PolicyBuilder } from '@vytches/ddd-policies';

// Missing examples for:
// - Specification integration
// - Complex business rules
// - Conditional execution
// - Event emission
// - Behavior composition
// - Framework patterns
```

## ✅ Implementation Tasks

### Phase 1: Basic Examples (2 hours)

#### Task 1.1: Basic Policy with Specifications

```typescript
// docs/examples/domain/policies/basic-specification.md
import { PolicyBuilder, PolicyContext } from '@vytches/ddd-policies';
import {
  AgeSpecification,
  EmailSpecification,
} from '@your-domain/specifications';

// Basic policy with specifications
const userPolicy = PolicyBuilder.create<User>()
  .withId('user-validation')
  .withDomain('authentication')
  .withName('User Registration Policy')
  .must(new AgeSpecification(18))
  .withCode('AGE_TOO_LOW')
  .withMessage('Must be at least 18 years old')
  .withSeverity('ERROR')
  .and()
  .must(new EmailSpecification())
  .withCode('INVALID_EMAIL')
  .withMessage('Valid email required')
  .withSeverity('ERROR')
  .build();

// Execute with context
const context = PolicyContext.create()
  .withUserId('user-123')
  .withSessionId('session-456')
  .withRequestId('req-789')
  .build();

const result = await userPolicy.check({ entity: user, context });
if (result.isFailure()) {
  console.log('Violations:', result.error.violations);
}
```

#### Task 1.2: Async Specifications

```typescript
// docs/examples/domain/policies/async-specification.md
class CreditCheckSpecification implements IAsyncSpecification<LoanApplication> {
  async isSatisfiedByAsync(app: LoanApplication): Promise<boolean> {
    const score = await creditService.getScore(app.applicantId);
    return score >= app.requiredMinScore;
  }
}

const asyncPolicy = PolicyBuilder.create<LoanApplication>()
  .withId('loan-approval')
  .withDomain('lending')
  .mustAsync(new CreditCheckSpecification())
  .withCode('CREDIT_CHECK_FAILED')
  .withMessage('Credit score below minimum requirement')
  .build();
```

### Phase 2: PolicyGroup Examples (2 hours)

#### Task 2.1: Complex OR Logic

```typescript
// docs/examples/domain/policies/policy-group-or.md
import { PolicyGroup } from '@vytches/ddd-policies';

// Excellent credit OR good credit with collateral
const excellentCreditGroup = PolicyGroup.create<LoanApplication>(
  'excellent-credit'
).mustSatisfy(
  app => app.creditScore >= 800,
  'CREDIT_NOT_EXCELLENT',
  'Excellent credit required'
);

const goodCreditWithCollateralGroup = PolicyGroup.create<LoanApplication>(
  'good-credit-collateral'
)
  .mustSatisfy(
    app => app.creditScore >= 650,
    'CREDIT_NOT_GOOD',
    'Good credit required'
  )
  .and()
  .mustSatisfy(
    app => app.collateral >= 50000,
    'INSUFFICIENT_COLLATERAL',
    'Collateral required'
  );

const loanPolicy = PolicyBuilder.create<LoanApplication>()
  .withId('loan-approval')
  .withDomain('lending')
  .shouldSatisfyAny(excellentCreditGroup, goodCreditWithCollateralGroup)
  .build();
```

#### Task 2.2: Complex AND Logic

```typescript
// docs/examples/domain/policies/policy-group-and.md
const fraudCheckGroup = PolicyGroup.create<Transaction>('fraud-check')
  .mustSatisfy(
    tx => tx.amount <= tx.account.dailyLimit,
    'DAILY_LIMIT_EXCEEDED',
    'Transaction exceeds daily limit'
  )
  .and()
  .mustSatisfy(
    tx => !tx.account.isBlacklisted,
    'ACCOUNT_BLACKLISTED',
    'Account is blacklisted'
  )
  .and()
  .mustAsync(
    async tx => await fraudService.checkTransaction(tx),
    'FRAUD_DETECTED',
    'Transaction flagged as fraudulent'
  );

const transactionPolicy = PolicyBuilder.create<Transaction>()
  .withId('transaction-validation')
  .withDomain('payments')
  .mustSatisfyAll(fraudCheckGroup)
  .build();
```

### Phase 3: Conditional Policies (2 hours)

#### Task 3.1: When/Then/Otherwise Pattern

```typescript
// docs/examples/domain/policies/conditional-policy.md
const dynamicPolicy = PolicyBuilder.create<Order>()
  .withId('order-validation')
  .withDomain('orders')
  .must(new BasicOrderValidation())

  // High-value orders need approval
  .when(order => order.amount > 10000)
  .then()
  .must(new ManagerApprovalSpec())
  .withCode('APPROVAL_REQUIRED')
  .withMessage('Manager approval required for large orders')

  // Production environment has strict validation
  .when(ctx => ctx.environment === 'production')
  .then()
  .must(new StrictSecurityPolicy())
  .withCode('SECURITY_CHECK_FAILED')
  .otherwise()
  .should(new RelaxedValidation())
  .withSeverity('WARNING')

  .build();
```

#### Task 3.2: Dynamic Policy Selection

```typescript
// docs/examples/domain/policies/dynamic-selection.md
class PolicySelector {
  selectPolicy(context: BusinessContext): IBusinessPolicy<Order> {
    if (context.isB2B) {
      return this.b2bPolicy;
    } else if (context.isVIP) {
      return this.vipPolicy;
    } else {
      return this.standardPolicy;
    }
  }

  private b2bPolicy = PolicyBuilder.create<Order>()
    .withId('b2b-order')
    .must(new B2BValidation())
    .must(new CreditTermsValidation())
    .build();

  private vipPolicy = PolicyBuilder.create<Order>()
    .withId('vip-order')
    .should(new VIPDiscountEligibility())
    .must(new PriorityShippingValidation())
    .build();
}
```

### Phase 4: Event-Driven Policies (1 hour)

#### Task 4.1: Policy Events

```typescript
// docs/examples/domain/policies/event-driven-policy.md
const auditedPolicy = PolicyBuilder.create<User>()
  .withId('user-security')
  .withDomain('security')
  .must(new SecuritySpecification())
  .withEvents({
    enabled: true,
    eventBus: domainEventBus,
  })
  .build();

// Listen to policy events
policyEventBus.subscribe('POLICY_EVALUATED', event => {
  console.log(
    `Policy ${event.policyId} evaluated with result: ${event.result.isSuccess()}`
  );

  if (event.result.isFailure()) {
    // Log violations to audit system
    auditService.logPolicyViolation({
      policyId: event.policyId,
      violations: event.result.error.violations,
      context: event.context,
      timestamp: event.timestamp,
    });
  }
});

// Policy violations trigger compensating actions
policyEventBus.subscribe('POLICY_VIOLATION', async event => {
  if (event.severity === 'CRITICAL') {
    await alertingService.sendCriticalAlert(event);
    await lockdownService.initiateSecurityProtocol(event.context);
  }
});
```

### Phase 5: Policy Behaviors (2 hours)

#### Task 5.1: Retry Behavior

```typescript
// docs/examples/domain/policies/retry-behavior.md
import {
  PolicyRetryBehavior,
  PolicyRetryBehaviorFactory,
} from '@vytches/ddd-policies';

// Retry for transient failures
const retryPolicy = PolicyRetryBehavior.create(new PaymentValidationPolicy(), {
  maxAttempts: 3,
  baseDelay: 1000,
  backoff: 'exponential',
  shouldRetry: violation => violation.code.includes('TIMEOUT'),
});

// Factory patterns for common scenarios
const transientFailurePolicy = PolicyRetryBehaviorFactory.forTransientFailures(
  basePolicy,
  3 // max attempts
);

const externalServicePolicy = PolicyRetryBehaviorFactory.forExternalServices(
  basePolicy,
  {
    maxAttempts: 5,
    baseDelay: 2000,
    maxDelay: 60000,
  }
);

// Monitor metrics
const metrics = retryPolicy.getRetryMetrics();
console.log(
  `Success rate: ${metrics.successfulEvaluations / metrics.totalAttempts}`
);
```

#### Task 5.2: Caching Behavior

```typescript
// docs/examples/domain/policies/caching-behavior.md
import {
  PolicyCachingBehavior,
  PolicyCachingBehaviorFactory,
} from '@vytches/ddd-policies';

// TTL-based caching
const cachedPolicy = PolicyCachingBehaviorFactory.withTTL(
  basePolicy,
  30000 // 30 seconds
);

// Custom cache key generation
const customCachedPolicy = PolicyCachingBehavior.create(basePolicy, {
  ttl: 60000,
  keyGenerator: request => `${request.entity.id}_${request.context.userId}`,
  namespace: 'payment-validation',
  maxSize: 500,
});

// Cache with metrics
const metricsPolicy = PolicyCachingBehaviorFactory.withMetrics(
  basePolicy,
  60000, // TTL
  request => `custom_${request.entity.type}` // Custom key
);
```

#### Task 5.3: Temporal Behavior

```typescript
// docs/examples/domain/policies/temporal-behavior.md
import {
  PolicyTemporalBehaviorBuilder,
  PolicyTemporalBehaviorFactory,
} from '@vytches/ddd-policies';

// Business hours policy
const businessHoursPolicy = PolicyTemporalBehaviorFactory.forBusinessHours(
  strictPolicy,
  relaxedPolicy,
  { start: '09:00', end: '17:00' }
);

// Complex temporal builder
const temporalPolicy = PolicyTemporalBehaviorBuilder.from(basePolicy)
  .withBusinessHours('09:00', '17:00')
  .withWorkingDays([1, 2, 3, 4, 5])
  .withTimezone('America/New_York')
  .duringBusinessHours(strictPolicy)
  .duringAfterHours(relaxedPolicy)
  .duringWeekends(weekendPolicy)
  .withTemporalInfo(true)
  .build();

// Behavior composition
const composedPolicy = PolicyCachingBehavior.create(
  PolicyRetryBehavior.create(
    PolicyTemporalBehavior.create(basePolicy, temporalConfig),
    retryConfig
  ),
  cacheConfig
);
```

### Phase 6: Framework Integration (1 hour)

#### Task 6.1: NestJS Integration

```typescript
// docs/examples/frameworks/nestjs/policies/service.md
import { Injectable } from '@nestjs/common';
import { PolicyBuilder, PolicyContext } from '@vytches/ddd-policies';
import { VytchesDDD } from '@vytches/ddd-di';

@Injectable()
export class OrderValidationService {
  private readonly orderPolicy: IBusinessPolicy<Order>;

  constructor() {
    // Resolve from DI container
    this.orderPolicy =
      VytchesDDD.resolve<IBusinessPolicy<Order>>('orderPolicy');
  }

  async validateOrder(
    order: Order,
    userId: string
  ): Promise<Result<Order, PolicyViolation>> {
    const context = PolicyContext.create()
      .withUserId(userId)
      .withCorrelationId(order.id)
      .build();

    return await this.orderPolicy.check({ entity: order, context });
  }
}
```

#### Task 6.2: Express Middleware

```typescript
// docs/examples/frameworks/express/policies/middleware.md
export const policyMiddleware = (policyId: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const policy = PolicyRegistry.resolve(policyId);
    const context = PolicyContext.create()
      .withUserId(req.user?.id)
      .withRequestId(req.id)
      .build();

    const result = await policy.check({
      entity: req.body,
      context,
    });

    if (result.isFailure()) {
      return res.status(400).json({
        errors: result.error.violations,
      });
    }

    next();
  };
};
```

### Phase 7: Enterprise Patterns (1 hour)

#### Task 7.1: Policy Registry Pattern

```typescript
// docs/examples/domain/policies/enterprise-registry.md
import { PolicyRegistry } from '@vytches/ddd-policies';

class EnterprisePolicyRegistry {
  private registry = new PolicyRegistry();

  initialize(): void {
    // Register domain policies
    this.registerAuthenticationPolicies();
    this.registerPaymentPolicies();
    this.registerOrderPolicies();

    // Version management
    this.registry.register({
      id: 'user-validation',
      domain: 'authentication',
      name: 'User Validation Policy',
      policy: userPolicy,
      version: '2.0.0',
      deprecated: ['1.0.0', '1.1.0'],
      tags: ['security', 'validation', 'compliance'],
    });
  }

  resolveWithFallback<T>(id: string, domain: string): IBusinessPolicy<T> {
    try {
      return this.registry.resolve<T>({ id, domain });
    } catch {
      // Fallback to default policy
      return this.registry.resolve<T>({
        id: 'default',
        domain,
      });
    }
  }
}
```

#### Task 7.2: Multi-Tenant Policies

```typescript
// docs/examples/domain/policies/multi-tenant.md
class TenantPolicyResolver {
  async resolvePolicy<T>(
    tenantId: string,
    policyType: string
  ): Promise<IBusinessPolicy<T>> {
    const tenantConfig = await this.getTenantConfig(tenantId);

    return PolicyBuilder.create<T>()
      .withId(`${tenantId}-${policyType}`)
      .withDomain(tenantConfig.domain)
      .when(ctx => ctx.tenantId === tenantId)
      .then()
      .must(tenantConfig.customRules)
      .otherwise()
      .must(this.defaultRules)
      .build();
  }
}
```

### Phase 8: Migration Guide (1 hour)

#### Task 8.1: V1 to V2 Migration

````markdown
# docs/migration/policies-v1-to-v2.md

## Migration from Policies V1 to V2

### Breaking Changes

1. **Promise-based API**

   ```typescript
   // V1
   const result = policy.evaluate(entity);

   // V2
   const result = await policy.check({ entity, context });
   ```
````

2. **Context Required**

   ```typescript
   // V1
   policy.evaluate(entity);

   // V2
   const context = PolicyContext.create().build();
   await policy.check({ entity, context });
   ```

3. **Violation Structure**

   ```typescript
   // V1
   if (!result.isValid) {
     console.log(result.errors);
   }

   // V2
   if (result.isFailure()) {
     result.error.violations.forEach(v => {
       console.log(v.code, v.message, v.severity);
     });
   }
   ```

### Migration Strategy

1. Update imports
2. Add async/await
3. Create contexts
4. Update error handling
5. Test thoroughly

```

## 📈 Success Metrics

### Documentation Coverage
- [ ] 10+ basic policy examples
- [ ] 5+ PolicyGroup examples
- [ ] 5+ conditional policy examples
- [ ] 3+ event-driven examples
- [ ] 10+ behavior examples
- [ ] 5+ framework integration examples
- [ ] 3+ enterprise pattern examples
- [ ] Complete migration guide

### Quality Metrics
- [ ] All examples compile without errors
- [ ] Examples cover 80%+ of API surface
- [ ] Clear progression from basic to advanced
- [ ] Framework examples show real integration

## 🔧 Technical Implementation Details

### Example Categories
1. **Basic**: Simple specification usage
2. **Intermediate**: PolicyGroups and conditions
3. **Advanced**: Behaviors and composition
4. **Enterprise**: Registry, multi-tenant, versioning

### Documentation Structure
```

docs/examples/domain/policies/ ├── basic/ │ ├── specification.md │ └──
async-specification.md ├── intermediate/ │ ├── policy-group.md │ └──
conditional.md ├── advanced/ │ ├── behaviors/ │ └── composition.md └──
enterprise/ ├── registry.md └── multi-tenant.md

```

## 🚨 Risk Mitigation

### Documentation Risks
- **Outdated examples**: Version lock examples to library version
- **Incomplete coverage**: Use coverage tool to find gaps
- **Confusing progression**: Clear difficulty labels

### User Experience Risks
- **Too complex**: Start with simplest possible examples
- **Missing context**: Provide business scenarios
- **Framework confusion**: Separate framework examples clearly

## 📚 References

- [Specification Pattern](https://en.wikipedia.org/wiki/Specification_pattern)
- [Policy Pattern](https://martinfowler.com/eaaDev/Policy.html)
- [Business Rules Engine](https://martinfowler.com/bliki/RulesEngine.html)
- [MediatR Behaviors](https://github.com/jbogard/MediatR/wiki/Behaviors)

## ✅ Definition of Done

- [ ] All example categories documented
- [ ] Code examples tested and working
- [ ] Migration guide complete
- [ ] Examples integrated into CLI
- [ ] Documentation reviewed by team
- [ ] Examples used in onboarding
```
