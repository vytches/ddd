# ADR-0012: Policies V2 Complete Redesign

## Status

ACCEPTED

## Context

The original Policies package (V1) had several architectural limitations that
impacted usability and enterprise adoption:

### V1 Issues

1. **API Inconsistency**: Mix of Promise-based and synchronous APIs caused
   confusion
2. **Limited Async Support**: Poor async specification handling
3. **Rigid Builder Pattern**: Inflexible fluent API with limited customization
4. **Weak Violation System**: Basic error handling without severity levels
5. **Missing Enterprise Features**: No audit trails, multi-tenancy, or context
   propagation
6. **Poor Composition**: Limited support for complex AND/OR logic
7. **No Conditional Logic**: Missing when/then/otherwise patterns

### Enterprise Requirements

- Unified Promise-based API for consistency
- Rich violation system with severity levels (ERROR/WARNING/INFO)
- Enterprise-ready context with audit trails and multi-tenancy
- Flexible builder system for complex business rules
- Conditional policy logic for dynamic behavior
- Comprehensive group logic for AND/OR scenarios
- Full async support throughout the system

## Decision

We will implement a complete V2 redesign of the Policies package with the
following architecture:

### Core Architecture Changes

#### 1. Unified Promise-Based API

```typescript
// V1: Mixed APIs
sync: isSatisfiedBy(candidate: T): boolean
async: checkAsync(request: PolicyRequest<T>): Promise<Result<T, PolicyViolation>>

// V2: Unified API
unified: check(request: PolicyRequest<T>): Promise<Result<T, PolicyViolation>>
```

#### 2. Rich Violation System

```typescript
class PolicyViolation extends Error {
  readonly code: string;
  readonly severity: PolicyViolationSeverity; // ERROR/WARNING/INFO
  readonly field?: string;
  readonly details: Record<string, unknown>;
  readonly context?: PolicyContext;
  readonly policyId?: string;
  readonly domain?: string;
  readonly timestamp: Date;
}
```

#### 3. Enterprise Context System

```typescript
interface PolicyContext {
  readonly userId?: string;
  readonly sessionId?: string;
  readonly requestId?: string;
  readonly correlationId?: string;
  readonly tenantId?: string;
  readonly auditTrail: PolicyAuditEntry[];
  readonly metadata: Record<string, unknown>;
  readonly timestamp: Date;
}
```

#### 4. Advanced Builder System

```typescript
// Fluent API with comprehensive options
PolicyBuilder.create<User>()
  .withId('user-validation')
  .withDomain('authentication')
  .withName('User Registration Policy')
  .must(new AgeSpecification(18))
  .withCode('AGE_TOO_LOW')
  .withMessage('Must be at least 18 years old')
  .withSeverity('ERROR')
  .and()
  .mustSatisfy(
    user => user.email.includes('@'),
    'INVALID_EMAIL',
    'Email must be valid'
  )
  .when(user => user.type === 'premium')
  .then()
  .mustSatisfy(
    user => user.creditScore >= 700,
    'CREDIT_TOO_LOW',
    'Premium users need good credit'
  )
  .otherwise()
  .should(new BasicValidationSpec())
  .build();
```

#### 5. Complex Group Logic

```typescript
// OR group logic for flexible business rules
const excellentCreditGroup = PolicyGroup.create<LoanApplication>(
  'excellent-credit'
).mustSatisfy(
  app => app.creditScore >= 800,
  'CREDIT_NOT_EXCELLENT',
  'Need excellent credit'
);

const goodCreditWithCollateralGroup = PolicyGroup.create<LoanApplication>(
  'good-credit-collateral'
)
  .mustSatisfy(
    app => app.creditScore >= 650,
    'CREDIT_NOT_GOOD',
    'Need good credit'
  )
  .and()
  .mustSatisfy(
    app => app.collateral >= 50000,
    'INSUFFICIENT_COLLATERAL',
    'Need collateral'
  );

PolicyBuilder.create<LoanApplication>()
  .withId('loan-approval')
  .withDomain('lending')
  .withName('Loan Approval Policy')
  .shouldSatisfyAny(excellentCreditGroup, goodCreditWithCollateralGroup)
  .build();
```

### Architectural Decisions Made

#### 1. **Policy Behaviors for Cross-Cutting Concerns**

**Decision**: Use policy behaviors (following MediatR pattern) for retry logic,
caching, and temporal policies rather than building these capabilities into base
policies. **Naming Decision**: Named "Behaviors" instead of "Decorators" to
align with MediatR conventions and avoid confusion with TypeScript decorators
(`@Decorator()`). **Rationale**: Separation of concerns, composability, clear
naming semantics, and adherence to Single Responsibility Principle.

#### 2. **Event-Driven Observability Architecture**

**Decision**: Implement comprehensive event system for policy execution tracking
and metrics. **Rationale**: Enterprise requirement for audit trails, monitoring,
and integration with external observability systems.

#### 3. **Adapter Pattern for Integration**

**Decision**: Create adapters to integrate existing validation systems rather
than requiring migration. **Rationale**: Enables gradual adoption and leverages
existing business rule investments.

#### 4. **Builder Pattern with Conditional Logic**

**Decision**: Extend builder pattern to support when/then/otherwise conditional
policy execution. **Rationale**: Business rules often require conditional logic
that static composition cannot address.

#### 5. **Promise-First API Design**

**Decision**: All policy APIs return Promises, even for synchronous operations.
**Rationale**: Consistency, future-proofing for async operations, and simplified
mental model for developers.

### Migration Strategy

**No Migration Required**: This is a library under construction with no external
consumers. V1 implementation was removed and replaced with V2 architecture.

### Architectural Trade-offs

#### Benefits

1. **Unified API**: Single Promise-based interface eliminates confusion
2. **Composability**: Decorator pattern enables flexible cross-cutting concerns
3. **Extensibility**: Adapter pattern supports gradual migration from legacy
   systems
4. **Observability**: Event-driven architecture provides enterprise-grade
   monitoring
5. **Type Safety**: Full TypeScript support with comprehensive generic
   constraints

#### Risks and Mitigations

1. **Complexity**: Rich API might overwhelm simple use cases

   - _Mitigation_: Factory methods and sensible defaults for common patterns

2. **Performance**: Promise-based API and decorator chains add overhead

   - _Mitigation_: Caching decorator and performance monitoring built-in

3. **Learning Curve**: Multiple patterns require architectural understanding
   - _Mitigation_: Comprehensive documentation and graduated complexity examples

#### Alternative Approaches Considered

1. **Monolithic Policy Class**: Rejected due to violation of Single
   Responsibility Principle
2. **Callback-based API**: Rejected in favor of Promise consistency with rest of
   @vytches/ddd-core
3. **Generic Infrastructure Decorators**: Rejected in favor of domain-specific
   policy behaviors (following MediatR naming conventions)

## Consequences

### Positive Outcomes

- **API Consistency**: Unified Promise-based interface across all policy
  operations
- **Enterprise Readiness**: Rich context, audit trails, and observability
  built-in
- **Architectural Flexibility**: Decorator and adapter patterns enable
  composition and integration
- **Developer Experience**: Fluent builders with conditional logic support
  complex business rules
- **System Integration**: Seamless connection with existing @vytches/ddd-core
  ecosystem

### Negative Consequences

- **Implementation Complexity**: Multiple patterns require deeper architectural
  understanding
- **Runtime Overhead**: Promise chains and behavior composition add performance
  cost
- **Testing Complexity**: 193 total tests required to cover all architectural
  patterns

### Long-term Implications

- **Extensibility**: Decorator pattern enables future cross-cutting concerns
  without core changes
- **Migration Path**: Adapter pattern provides clear upgrade path for existing
  validation systems
- **Maintenance**: Event-driven observability enables proactive monitoring and
  debugging

## Compliance

This ADR follows the enterprise DDD patterns established in the VytchesDDD
library and maintains consistency with:

- **Result pattern** from `@vytches/ddd-utils`
- **Specification pattern** from `@vytches/ddd-contracts`
- **Test patterns** using `safeRun` for error testing
- **Logging integration** ready for `@vytches/ddd-logging`
- **Module boundaries** with proper import strategies

## Status

**IMPLEMENTED** - All architectural decisions have been successfully implemented
and are in production use.

**UPDATE (v2.1)**: Naming refactored from "Decorators" to "Behaviors" to align
with MediatR conventions and avoid confusion with TypeScript decorators.
Backward compatibility aliases maintained for transition period.

## Related ADRs

- ADR-0001: Domain-Driven Design Architecture Foundation
- ADR-0006: Unified Event System Architecture
- ADR-0011: Enterprise Circular Dependency Resolution

## Review Date

This ADR should be reviewed when:

- Performance bottlenecks are identified in policy execution
- New cross-cutting concerns require behavior implementation
- Integration patterns with external systems change significantly

---

_Last Updated: December 2024 - Implementation Complete_
