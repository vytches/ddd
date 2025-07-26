# @vytches/ddd-policies

<!-- LLM-METADATA
Package: @vytches/ddd-policies
Category: Patterns
Purpose: Business policy validation with fluent API, temporal support, and sophisticated business rule composition
Dependencies: @vytches/ddd-domain-primitives, @vytches/ddd-validation, @vytches/ddd-utils
Complexity: High
DDD Patterns: Policy Pattern, Specification Pattern, Business Rules, Validation
Integration Points: @vytches/ddd-validation, @vytches/ddd-cqrs, @vytches/ddd-domain-services
-->

[![npm version](https://badge.fury.io/js/%40vytches%2Fddd-policies.svg)](https://badge.fury.io/js/%40vytches%2Fddd-policies)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Enterprise-grade business policy validation with fluent API, temporal
> support, and sophisticated rule composition**

Complete business policy framework with fluent builder API, temporal validation,
policy behaviors, and comprehensive violation reporting. Designed for complex
business rules with enterprise-grade context management.

## 📋 Table of Contents

- [Installation](#installation)
- [Key Features](#key-features)
- [Core Concepts](#core-concepts)
- [Quick Start](#quick-start)
- [Policy Builder](#policy-builder)
- [Temporal Policies](#temporal-policies)
- [Policy Groups](#policy-groups)
- [Policy Behaviors](#policy-behaviors)
- [Policy Registry](#policy-registry)
- [Violation Handling](#violation-handling)
- [Advanced Usage](#advanced-usage)
- [Integration Patterns](#integration-patterns)
- [Testing](#testing)
- [Best Practices](#best-practices)
- [Contributing](#contributing)

## 🚀 Installation

```bash
# npm
npm install @vytches/ddd-policies

# yarn
yarn add @vytches/ddd-policies

# pnpm
pnpm add @vytches/ddd-policies
```

### Peer Dependencies

```bash
# Required for full functionality
npm install @vytches/ddd-domain-primitives @vytches/ddd-validation @vytches/ddd-utils
```

## ✨ Key Features

### Business Policy Framework

- **Fluent API**: Intuitive fluent builder for policy creation
- **Temporal Support**: Time-aware policy validation with business hours
- **Policy Composition**: Complex policy groups with AND/OR logic
- **Violation Reporting**: Rich violation details with severity levels

### Advanced Features

- **Policy Behaviors**: MediatR-style behaviors for cross-cutting concerns
- **Context Management**: Enterprise-grade context propagation
- **Specification Integration**: Direct support for DDD specifications
- **Event-Driven**: Automatic policy evaluation events

### Enterprise Quality

- **Audit Trails**: Complete audit logging for policy evaluations
- **Multi-Tenancy**: Tenant-aware policy resolution
- **Performance**: Optimized for high-throughput scenarios
- **Testing Support**: Comprehensive policy testing utilities

## 🎯 Core Concepts

### Policy Pattern

Policies encapsulate business rules that can be evaluated against entities:

```typescript
// Basic policy interface
interface IPolicy<T> {
  check(request: PolicyRequest<T>): Promise<PolicyResult<T>>;
  getId(): string;
  getDomain(): string;
  getName(): string;
}

// Policy request with context
interface PolicyRequest<T> {
  entity: T;
  context: PolicyContext;
  metadata?: Record<string, any>;
}

// Policy result with violations
interface PolicyResult<T> {
  isSuccess(): boolean;
  isFailure(): boolean;
  entity: T;
  violations: PolicyViolation[];
  metadata: Record<string, any>;
}
```

### Policy Context

Rich context for policy evaluation:

```typescript
interface PolicyContext {
  userId?: string;
  sessionId?: string;
  requestId?: string;
  tenantId?: string;
  timestamp: Date;
  environment: string;
  correlationId: string;
  metadata: Record<string, any>;
}
```

### Policy Violation

Structured violation reporting:

```typescript
interface PolicyViolation {
  code: string;
  message: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  field?: string;
  details?: Record<string, any>;
  timestamp: Date;
}
```

## 🚀 Quick Start

### 1. Basic Policy Creation

```typescript
import { PolicyBuilder, PolicyContext } from '@vytches/ddd-policies';
import { AgeSpecification, EmailSpecification } from './specifications';

// Create a basic policy
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

// Execute policy
const user = new User('John Doe', 'john@example.com', 25);
const context = PolicyContext.create()
  .withUserId('user-123')
  .withRequestId('req-456')
  .build();

const result = await userPolicy.check({ entity: user, context });

if (result.isFailure()) {
  console.log('Policy violations:', result.violations);
} else {
  console.log('Policy passed successfully');
}
```

### 2. Conditional Policies

```typescript
import { PolicyBuilder } from '@vytches/ddd-policies';

// Policy with conditional logic
const orderPolicy = PolicyBuilder.create<Order>()
  .withId('order-validation')
  .withDomain('orders')
  .withName('Order Processing Policy')
  .must(new BasicOrderValidation())
  .withCode('BASIC_VALIDATION_FAILED')
  .when(order => order.amount > 10000)
  .then()
  .must(new ManagerApprovalSpec())
  .withCode('APPROVAL_REQUIRED')
  .withMessage('Manager approval required for large orders')
  .withSeverity('ERROR')
  .when(ctx => ctx.environment === 'production')
  .then()
  .must(new StrictSecurityPolicy())
  .withCode('SECURITY_CHECK_FAILED')
  .otherwise()
  .should(new RelaxedValidation())
  .withCode('RELAXED_VALIDATION')
  .withSeverity('WARNING')
  .build();

// Execute conditional policy
const order = new Order(customerId, items, 15000);
const result = await orderPolicy.check({ entity: order, context });
```

### 3. Policy Groups

```typescript
import { PolicyGroup } from '@vytches/ddd-policies';

// Create policy groups for complex logic
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

// Combine groups with OR logic
const loanPolicy = PolicyBuilder.create<LoanApplication>()
  .withId('loan-approval')
  .withDomain('lending')
  .withName('Loan Approval Policy')
  .shouldSatisfyAny(excellentCreditGroup, goodCreditWithCollateralGroup)
  .build();

// Execute group policy
const loanApp = new LoanApplication(applicantId, requestedAmount, creditScore);
const result = await loanPolicy.check({ entity: loanApp, context });
```

## 🔧 Policy Builder

### Fluent API

```typescript
// Complete fluent API example
const comprehensivePolicy = PolicyBuilder.create<User>()
  .withId('comprehensive-user-policy')
  .withDomain('user-management')
  .withName('Comprehensive User Validation')
  .withDescription(
    'Complete user validation including age, email, and security checks'
  )
  .withVersion('1.2.0')
  .withTags(['security', 'validation', 'user'])

  // Basic validations
  .must(new AgeSpecification(18))
  .withCode('AGE_TOO_LOW')
  .withMessage('User must be at least 18 years old')
  .withSeverity('ERROR')
  .withField('age')

  .and()
  .must(new EmailSpecification())
  .withCode('INVALID_EMAIL')
  .withMessage('Valid email address required')
  .withSeverity('ERROR')
  .withField('email')

  // Conditional validations
  .when(user => user.role === UserRole.ADMIN)
  .then()
  .must(new AdminSecuritySpecification())
  .withCode('ADMIN_SECURITY_FAILED')
  .withMessage('Admin users require additional security validation')
  .withSeverity('ERROR')

  // Warning-level validations
  .should(new ProfileCompletnessSpecification())
  .withCode('PROFILE_INCOMPLETE')
  .withMessage('Consider completing your profile')
  .withSeverity('WARNING')

  // Events and audit
  .withEvents({ enabled: true })
  .withAuditTrail(true)

  .build();
```

### Async Policies

```typescript
// Async policy with external dependencies
const asyncPolicy = PolicyBuilder.create<User>()
  .withId('async-user-validation')
  .withDomain('user-management')
  .mustAsync(new EmailUniquenessSpecification())
  .withCode('EMAIL_NOT_UNIQUE')
  .withMessage('Email address already exists')
  .and()
  .mustAsync(new ExternalBlacklistSpecification())
  .withCode('USER_BLACKLISTED')
  .withMessage('User is blacklisted')
  .build();

// External specification example
class EmailUniquenessSpecification implements IAsyncSpecification<User> {
  constructor(private readonly userRepository: IUserRepository) {}

  async isSatisfiedByAsync(user: User): Promise<boolean> {
    const existingUser = await this.userRepository.findByEmail(user.email);
    return existingUser === null;
  }
}
```

### Rule-Based Policies

```typescript
// Policy with rule-based validation
const ruleBasedPolicy = PolicyBuilder.create<User>()
  .withId('rule-based-user-policy')
  .withDomain('user-management')
  .mustSatisfyRules(rules =>
    rules
      .forProperty('name', Rules.required().minLength(2).maxLength(50))
      .forProperty('email', Rules.required().email())
      .forProperty('age', Rules.required().min(18).max(120))
      .forProperty('phone', Rules.optional().phone())
  )
  .withCode('RULE_VALIDATION_FAILED')
  .withMessage('User data validation failed')
  .build();

// Execute rule-based policy
const user = new User('', 'invalid-email', 15); // Invalid data
const result = await ruleBasedPolicy.check({ entity: user, context });

// Result will contain specific field violations
result.violations.forEach(violation => {
  console.log(`Field: ${violation.field}, Error: ${violation.message}`);
});
```

## ⏰ Temporal Policies

### Business Hours Support

```typescript
import { PolicyTemporalBehavior } from '@vytches/ddd-policies';

// Create temporal policy with business hours
const temporalPolicy = PolicyTemporalBehavior.create(strictPolicy, {
  businessHours: { start: '09:00', end: '17:00' },
  workingDays: [1, 2, 3, 4, 5], // Monday to Friday
  timezone: 'America/New_York',
});

// Alternative policies for different times
const businessHoursPolicy = PolicyTemporalBehaviorFactory.forBusinessHours(
  strictPolicy,
  relaxedPolicy,
  { start: '09:00', end: '17:00' }
);

// Execute temporal policy
const result = await temporalPolicy.check({ entity: order, context });
```

### Time-Based Conditions

```typescript
// Policy with time-based conditions
const timeBasedPolicy = PolicyBuilder.create<Order>()
  .withId('time-based-order-policy')
  .withDomain('orders')
  .when(ctx => {
    const hour = ctx.timestamp.getHours();
    return hour >= 9 && hour <= 17; // Business hours
  })
  .then()
  .must(new StandardProcessingSpecification())
  .withCode('STANDARD_PROCESSING')
  .otherwise()
  .must(new AfterHoursProcessingSpecification())
  .withCode('AFTER_HOURS_PROCESSING')
  .withMessage('After hours processing requires additional approval')
  .build();

// Weekend vs weekday policies
const weekdayPolicy = PolicyBuilder.create<Transaction>()
  .withId('weekday-transaction-policy')
  .withDomain('transactions')
  .when(ctx => {
    const day = ctx.timestamp.getDay();
    return day >= 1 && day <= 5; // Monday to Friday
  })
  .then()
  .must(new StandardTransactionLimits())
  .otherwise()
  .must(new WeekendTransactionLimits())
  .withCode('WEEKEND_LIMITS')
  .withMessage('Weekend transactions have different limits')
  .build();
```

## 👥 Policy Groups

### Complex Group Logic

```typescript
import { PolicyGroup } from '@vytches/ddd-policies';

// Create complex group hierarchies
const creditCheckGroup = PolicyGroup.create<LoanApplication>('credit-check')
  .mustSatisfy(
    app => app.creditScore >= 650,
    'CREDIT_SCORE_TOO_LOW',
    'Minimum credit score of 650 required'
  )
  .and()
  .mustSatisfy(
    app => app.creditHistory.length >= 2,
    'INSUFFICIENT_CREDIT_HISTORY',
    'At least 2 years of credit history required'
  );

const incomeVerificationGroup = PolicyGroup.create<LoanApplication>(
  'income-verification'
)
  .mustSatisfy(
    app => app.annualIncome >= 50000,
    'INCOME_TOO_LOW',
    'Minimum annual income of $50,000 required'
  )
  .and()
  .mustSatisfy(
    app => app.employmentStatus === 'EMPLOYED',
    'UNEMPLOYED',
    'Applicant must be employed'
  );

const collateralGroup = PolicyGroup.create<LoanApplication>(
  'collateral'
).mustSatisfy(
  app => app.collateralValue >= app.requestedAmount * 0.8,
  'INSUFFICIENT_COLLATERAL',
  'Collateral must be at least 80% of loan amount'
);

// Combine groups with complex logic
const loanApprovalPolicy = PolicyBuilder.create<LoanApplication>()
  .withId('loan-approval-policy')
  .withDomain('lending')
  .withName('Loan Approval Policy')

  // Must satisfy credit check AND income verification
  .mustSatisfyAll(creditCheckGroup, incomeVerificationGroup)

  // OR have sufficient collateral
  .or()
  .mustSatisfy(collateralGroup)

  .build();
```

### Group Composition

```typescript
// Compose groups for different scenarios
const individualApplicantGroups = PolicyGroup.create<LoanApplication>(
  'individual-applicant'
).mustSatisfyAll(creditCheckGroup, incomeVerificationGroup);

const businessApplicantGroups = PolicyGroup.create<LoanApplication>(
  'business-applicant'
)
  .mustSatisfy(
    app => app.businessRevenue >= 100000,
    'BUSINESS_REVENUE_TOO_LOW',
    'Business annual revenue must be at least $100,000'
  )
  .and()
  .mustSatisfy(
    app => app.businessAge >= 2,
    'BUSINESS_TOO_NEW',
    'Business must be operating for at least 2 years'
  );

// Policy that handles different applicant types
const applicantTypePolicy = PolicyBuilder.create<LoanApplication>()
  .withId('applicant-type-policy')
  .withDomain('lending')
  .when(app => app.applicantType === 'INDIVIDUAL')
  .then()
  .mustSatisfy(individualApplicantGroups)
  .when(app => app.applicantType === 'BUSINESS')
  .then()
  .mustSatisfy(businessApplicantGroups)
  .build();
```

## 🔄 Policy Behaviors

### Retry Behavior

```typescript
import { PolicyRetryBehavior } from '@vytches/ddd-policies';

// Policy with retry logic for transient failures
const retryPolicy = PolicyRetryBehavior.create(basePolicy, {
  maxAttempts: 3,
  baseDelay: 1000,
  backoff: 'exponential',
  shouldRetry: violation => violation.code.includes('TIMEOUT'),
  onRetry: (attempt, violation) => {
    console.log(`Retry attempt ${attempt} for violation: ${violation.code}`);
  },
});

// Factory methods for common scenarios
const transientFailurePolicy = PolicyRetryBehaviorFactory.forTransientFailures(
  basePolicy,
  3 // max attempts
);

const externalServicePolicy = PolicyRetryBehaviorFactory.forExternalServices(
  basePolicy,
  { maxAttempts: 5, baseDelay: 2000, maxDelay: 60000 }
);

// Execute retry policy
const result = await retryPolicy.check({ entity: user, context });
```

### Caching Behavior

```typescript
import { PolicyCachingBehavior } from '@vytches/ddd-policies';

// Policy with caching for performance
const cachedPolicy = PolicyCachingBehavior.create(basePolicy, {
  ttl: 60000, // 1 minute
  keyGenerator: request => `${request.entity.id}_${request.context.userId}`,
  namespace: 'user-validation',
  maxSize: 500,
});

// Simple TTL-based caching
const simpleCachedPolicy = PolicyCachingBehaviorFactory.withTTL(
  basePolicy,
  30000 // 30 seconds
);

// Execute cached policy
const result = await cachedPolicy.check({ entity: user, context });
```

### Temporal Behavior

```typescript
import { PolicyTemporalBehavior } from '@vytches/ddd-policies';

// Time-aware policy behavior
const temporalPolicy = PolicyTemporalBehavior.create(basePolicy, {
  businessHours: { start: '09:00', end: '17:00' },
  workingDays: [1, 2, 3, 4, 5],
  timezone: 'America/New_York',
  duringBusinessHours: strictPolicy,
  duringAfterHours: relaxedPolicy,
  duringWeekends: weekendPolicy,
});

// Factory methods
const businessHoursPolicy = PolicyTemporalBehaviorFactory.forBusinessHours(
  strictPolicy,
  relaxedPolicy,
  { start: '09:00', end: '17:00' }
);

const workingDaysPolicy = PolicyTemporalBehaviorFactory.forWorkingDays(
  businessPolicy,
  weekendPolicy,
  [1, 2, 3, 4, 5]
);
```

### Behavior Composition

```typescript
// Chain multiple behaviors
const composedPolicy = PolicyCachingBehavior.create(
  PolicyRetryBehavior.create(
    PolicyTemporalBehavior.create(basePolicy, temporalConfig),
    retryConfig
  ),
  cacheConfig
);

// Execution order: Cache → Retry → Temporal → Base Policy
const result = await composedPolicy.check({ entity: user, context });
```

## 📋 Policy Registry

### Registration and Discovery

```typescript
import { PolicyRegistry } from '@vytches/ddd-policies';

// Create policy registry
const registry = new PolicyRegistry();

// Register policies
registry.register({
  id: 'user-validation',
  domain: 'authentication',
  name: 'User Validation Policy',
  description: 'Validates user registration data',
  version: '1.0.0',
  policy: userPolicy,
  tags: ['security', 'validation'],
  metadata: {
    author: 'Security Team',
    lastUpdated: new Date(),
  },
});

// Register with factory
registry.registerFactory({
  id: 'dynamic-loan-policy',
  domain: 'lending',
  name: 'Dynamic Loan Policy',
  factory: (context: PolicyContext) => {
    // Create policy based on context
    return context.environment === 'production'
      ? strictLoanPolicy
      : relaxedLoanPolicy;
  },
});
```

### Policy Resolution

```typescript
// Resolve policies
const policy = registry.resolve<User>({
  domain: 'authentication',
  id: 'user-validation',
});

// Resolve with context
const contextualPolicy = registry.resolveWithContext<LoanApplication>(
  {
    domain: 'lending',
    id: 'dynamic-loan-policy',
  },
  context
);

// Query policies
const authenticationPolicies = registry.findByDomain('authentication');
const securityPolicies = registry.findByTag('security');
const userPolicies = registry.findByPattern('user-*');
```

### Policy Metadata

```typescript
// Get policy metadata
const metadata = registry.getMetadata('user-validation');
console.log(metadata.name, metadata.version, metadata.tags);

// List all policies
const allPolicies = registry.listPolicies();
allPolicies.forEach(policy => {
  console.log(`${policy.domain}:${policy.id} - ${policy.name}`);
});

// Policy statistics
const stats = registry.getStatistics();
console.log(`Total policies: ${stats.totalPolicies}`);
console.log(`Domains: ${stats.domains.join(', ')}`);
```

## 🚨 Violation Handling

### Violation Structure

```typescript
// Comprehensive violation information
interface PolicyViolation {
  code: string;
  message: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  field?: string;
  details?: Record<string, any>;
  timestamp: Date;
  context?: {
    policyId: string;
    domain: string;
    ruleName?: string;
  };
}
```

### Violation Processing

```typescript
// Process violations by severity
const result = await policy.check({ entity: user, context });

if (result.isFailure()) {
  const violations = result.violations;

  // Separate by severity
  const errors = violations.filter(v => v.severity === 'ERROR');
  const warnings = violations.filter(v => v.severity === 'WARNING');
  const info = violations.filter(v => v.severity === 'INFO');

  // Handle errors
  if (errors.length > 0) {
    throw new PolicyViolationError('Policy validation failed', errors);
  }

  // Log warnings
  warnings.forEach(warning => {
    console.warn(`Warning: ${warning.message}`, warning.details);
  });

  // Process info
  info.forEach(infoItem => {
    console.info(`Info: ${infoItem.message}`, infoItem.details);
  });
}
```

### Custom Violation Handlers

```typescript
// Custom violation handler
class PolicyViolationHandler {
  async handleViolations(violations: PolicyViolation[]): Promise<void> {
    for (const violation of violations) {
      switch (violation.severity) {
        case 'ERROR':
          await this.handleError(violation);
          break;
        case 'WARNING':
          await this.handleWarning(violation);
          break;
        case 'INFO':
          await this.handleInfo(violation);
          break;
      }
    }
  }

  private async handleError(violation: PolicyViolation): Promise<void> {
    // Log error
    this.logger.error('Policy violation', violation);

    // Send notification
    await this.notificationService.sendAlert({
      type: 'policy_violation',
      severity: 'error',
      message: violation.message,
      details: violation.details,
    });

    // Update metrics
    this.metrics.incrementCounter('policy_violations_error', {
      code: violation.code,
      domain: violation.context?.domain,
    });
  }

  private async handleWarning(violation: PolicyViolation): Promise<void> {
    // Log warning
    this.logger.warn('Policy warning', violation);

    // Update metrics
    this.metrics.incrementCounter('policy_violations_warning', {
      code: violation.code,
    });
  }

  private async handleInfo(violation: PolicyViolation): Promise<void> {
    // Log info
    this.logger.info('Policy info', violation);
  }
}
```

## 🔧 Advanced Usage

### Multi-Tenant Policies

```typescript
// Tenant-aware policy
const tenantPolicy = PolicyBuilder.create<User>()
  .withId('tenant-user-policy')
  .withDomain('user-management')
  .when(ctx => ctx.tenantId === 'enterprise-tenant')
  .then()
  .must(new EnterpriseUserSpecification())
  .withCode('ENTERPRISE_USER_REQUIRED')
  .when(ctx => ctx.tenantId === 'standard-tenant')
  .then()
  .must(new StandardUserSpecification())
  .withCode('STANDARD_USER_REQUIRED')
  .build();

// Tenant-specific registry
const tenantRegistry = new PolicyRegistry();
tenantRegistry.registerTenantPolicy('enterprise-tenant', enterprisePolicy);
tenantRegistry.registerTenantPolicy('standard-tenant', standardPolicy);

// Resolve tenant-specific policy
const tenantSpecificPolicy = tenantRegistry.resolveTenantPolicy<User>(
  'enterprise-tenant',
  'user-validation'
);
```

### Event-Driven Policies

```typescript
// Policy with event emission
const eventDrivenPolicy = PolicyBuilder.create<User>()
  .withId('event-driven-user-policy')
  .withDomain('user-management')
  .withEvents({ enabled: true })
  .must(new UserSpecification())
  .withCode('USER_VALIDATION_FAILED')
  .build();

// Listen to policy events
policyEventBus.subscribe('POLICY_EVALUATED', (event: PolicyEvaluatedEvent) => {
  console.log(`Policy ${event.policyId} evaluated`);
  console.log(`Result: ${event.result.isSuccess() ? 'SUCCESS' : 'FAILURE'}`);
  console.log(`Violations: ${event.result.violations.length}`);
});

policyEventBus.subscribe('POLICY_VIOLATION', (event: PolicyViolationEvent) => {
  console.log(`Policy violation: ${event.violation.code}`);
  console.log(`Severity: ${event.violation.severity}`);
});
```

### Policy Composition

```typescript
// Compose policies from multiple sources
const composedPolicy = PolicyComposer.create<User>()
  .withId('composed-user-policy')
  .withDomain('user-management')
  .addPolicy(basicUserPolicy)
  .addPolicy(securityPolicy)
  .addPolicy(compliancePolicy)
  .withStrategy('ALL_MUST_PASS') // or 'ANY_MUST_PASS'
  .build();

// Conditional composition
const conditionalComposition = PolicyComposer.create<Order>()
  .withId('conditional-order-policy')
  .withDomain('orders')
  .when(order => order.amount > 10000)
  .addPolicy(largeOrderPolicy)
  .when(order => order.region === 'EU')
  .addPolicy(gdprCompliancePolicy)
  .build();
```

## 🔗 Integration Patterns

### CQRS Integration

```typescript
// Command handler with policy validation
@CommandHandler(CreateUserCommand)
export class CreateUserCommandHandler {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly policyRegistry: PolicyRegistry
  ) {}

  async handle(
    command: CreateUserCommand,
    context: ExecutionContext
  ): Promise<void> {
    // Resolve policy
    const policy = this.policyRegistry.resolve<User>({
      domain: 'user-management',
      id: 'user-creation-policy',
    });

    // Create user entity
    const user = User.create(command.name, command.email, command.age);

    // Validate with policy
    const policyContext = PolicyContext.create()
      .withUserId(context.userId)
      .withRequestId(context.requestId)
      .withTenantId(context.tenantId)
      .build();

    const policyResult = await policy.check({
      entity: user,
      context: policyContext,
    });

    if (policyResult.isFailure()) {
      throw new PolicyViolationError(
        'User creation policy failed',
        policyResult.violations
      );
    }

    // Save user
    await this.userRepository.save(user);
  }
}
```

### Domain Service Integration

```typescript
// Domain service with policy validation
class UserRegistrationService implements IDomainService {
  readonly serviceName = 'UserRegistrationService';

  constructor(
    private readonly userRepository: IUserRepository,
    private readonly policyRegistry: PolicyRegistry,
    private readonly emailService: IEmailService
  ) {}

  async registerUser(userData: UserRegistrationData): Promise<User> {
    // Create user
    const user = User.create(userData.name, userData.email, userData.age);

    // Validate with policies
    const policies = this.policyRegistry.findByDomain('user-management');

    for (const policyInfo of policies) {
      const policy = this.policyRegistry.resolve<User>(policyInfo);
      const result = await policy.check({
        entity: user,
        context: userData.context,
      });

      if (result.isFailure()) {
        throw new PolicyViolationError(
          `Policy ${policyInfo.id} failed`,
          result.violations
        );
      }
    }

    // Save user
    await this.userRepository.save(user);

    // Send welcome email
    await this.emailService.sendWelcomeEmail(user.email);

    return user;
  }
}
```

## 🧪 Testing

### Policy Testing

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { PolicyBuilder, PolicyContext } from '@vytches/ddd-policies';

describe('UserValidationPolicy', () => {
  let policy: IPolicy<User>;
  let context: PolicyContext;

  beforeEach(() => {
    policy = PolicyBuilder.create<User>()
      .withId('test-user-policy')
      .withDomain('testing')
      .must(new AgeSpecification(18))
      .withCode('AGE_TOO_LOW')
      .and()
      .must(new EmailSpecification())
      .withCode('INVALID_EMAIL')
      .build();

    context = PolicyContext.create()
      .withUserId('test-user')
      .withRequestId('test-request')
      .build();
  });

  it('should pass with valid user', async () => {
    // Arrange
    const user = new User('John Doe', 'john@example.com', 25);

    // Act
    const result = await policy.check({ entity: user, context });

    // Assert
    expect(result.isSuccess()).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('should fail with underage user', async () => {
    // Arrange
    const user = new User('John Doe', 'john@example.com', 17);

    // Act
    const result = await policy.check({ entity: user, context });

    // Assert
    expect(result.isFailure()).toBe(true);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].code).toBe('AGE_TOO_LOW');
  });

  it('should fail with invalid email', async () => {
    // Arrange
    const user = new User('John Doe', 'invalid-email', 25);

    // Act
    const result = await policy.check({ entity: user, context });

    // Assert
    expect(result.isFailure()).toBe(true);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].code).toBe('INVALID_EMAIL');
  });
});
```

### Policy Behavior Testing

```typescript
describe('PolicyRetryBehavior', () => {
  let basePolicy: IPolicy<User>;
  let retryPolicy: IPolicy<User>;

  beforeEach(() => {
    basePolicy = createMockPolicy();
    retryPolicy = PolicyRetryBehavior.create(basePolicy, {
      maxAttempts: 3,
      baseDelay: 100,
      shouldRetry: violation => violation.code === 'TRANSIENT_ERROR',
    });
  });

  it('should retry on transient failures', async () => {
    // Arrange
    const user = new User('John Doe', 'john@example.com', 25);
    basePolicy.check
      .mockResolvedValueOnce(
        PolicyResult.failure([
          new PolicyViolation('TRANSIENT_ERROR', 'Temporary failure', 'ERROR'),
        ])
      )
      .mockResolvedValueOnce(PolicyResult.success(user));

    // Act
    const result = await retryPolicy.check({ entity: user, context });

    // Assert
    expect(result.isSuccess()).toBe(true);
    expect(basePolicy.check).toHaveBeenCalledTimes(2);
  });
});
```

### Mock Utilities

```typescript
// Mock policy for testing
function createMockPolicy<T>(): jest.Mocked<IPolicy<T>> {
  return {
    check: jest.fn(),
    getId: jest.fn().mockReturnValue('mock-policy'),
    getDomain: jest.fn().mockReturnValue('mock-domain'),
    getName: jest.fn().mockReturnValue('Mock Policy'),
  };
}

// Test builder for policies
class PolicyTestBuilder<T> {
  private policy: IPolicy<T>;

  static create<T>(): PolicyTestBuilder<T> {
    return new PolicyTestBuilder<T>();
  }

  withPolicy(policy: IPolicy<T>): PolicyTestBuilder<T> {
    this.policy = policy;
    return this;
  }

  withSuccessResult(entity: T): PolicyTestBuilder<T> {
    (this.policy.check as jest.Mock).mockResolvedValue(
      PolicyResult.success(entity)
    );
    return this;
  }

  withFailureResult(violations: PolicyViolation[]): PolicyTestBuilder<T> {
    (this.policy.check as jest.Mock).mockResolvedValue(
      PolicyResult.failure(violations)
    );
    return this;
  }

  build(): jest.Mocked<IPolicy<T>> {
    return this.policy as jest.Mocked<IPolicy<T>>;
  }
}
```

## 🏆 Best Practices

### Policy Design

```typescript
// ✅ Good: Specific, focused policies
const userAgePolicy = PolicyBuilder.create<User>()
  .withId('user-age-policy')
  .withDomain('user-management')
  .must(new AgeSpecification(18))
  .withCode('AGE_TOO_LOW')
  .withMessage('User must be at least 18 years old')
  .build();

// ❌ Bad: Overly complex, monolithic policy
const everythingPolicy = PolicyBuilder.create<User>()
  .withId('everything-policy')
  .withDomain('everything')
  .must(new AgeSpecification(18))
  .and()
  .must(new EmailSpecification())
  .and()
  .must(new AddressSpecification())
  .and()
  .must(new PaymentSpecification())
  // ... too many responsibilities
  .build();
```

### Error Handling

```typescript
// ✅ Good: Specific error handling
try {
  const result = await policy.check({ entity: user, context });
  if (result.isFailure()) {
    const errorViolations = result.violations.filter(
      v => v.severity === 'ERROR'
    );
    if (errorViolations.length > 0) {
      throw new PolicyViolationError(
        'Policy validation failed',
        errorViolations
      );
    }
  }
} catch (error) {
  if (error instanceof PolicyViolationError) {
    // Handle policy violations
    this.handlePolicyViolations(error.violations);
  } else {
    // Handle other errors
    this.handleGeneralError(error);
  }
}

// ❌ Bad: Generic error handling
try {
  await policy.check({ entity: user, context });
} catch (error) {
  throw error; // No specific handling
}
```

### Context Usage

```typescript
// ✅ Good: Rich context
const context = PolicyContext.create()
  .withUserId(currentUser.id)
  .withSessionId(session.id)
  .withRequestId(request.id)
  .withTenantId(tenant.id)
  .withEnvironment(process.env.NODE_ENV)
  .withMetadata({
    userAgent: request.headers['user-agent'],
    ipAddress: request.ip,
    feature: 'user-registration',
  })
  .build();

// ❌ Bad: Minimal context
const context = PolicyContext.create().build();
```

## 🤝 Contributing

We welcome contributions! Please see our
[Contributing Guide](../../CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone repository
git clone https://github.com/vytches/ddd.git
cd ddd

# Install dependencies
pnpm install

# Build package
pnpm build --filter=@vytches/ddd-policies

# Run tests
pnpm test --filter=@vytches/ddd-policies

# Run in development mode
pnpm dev --filter=@vytches/ddd-policies
```

## 📄 License

This project is licensed under the MIT License - see the
[LICENSE](../../LICENSE) file for details.

---

**Part of the [@vytches/ddd-core](https://github.com/vytches/ddd) ecosystem**

For more information, visit the [main documentation](../../README.md).
