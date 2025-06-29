# Business Policies in DomainTS - LLM-Optimized Guide

## Document Metadata

- **Pattern Name**: Business Policy Pattern
- **Category**: Domain-Driven Design (DDD) Pattern
- **Purpose**: Encapsulate high-level business decisions and constraints
- **Library**: DomainTS
- **Language**: TypeScript
- **Version**: 1.0.0

## Pattern Overview

### What are Business Policies?

Business Policies represent high-level business decisions that govern how the
system should behave. While validation ensures data integrity and business rules
enforce domain constraints, policies represent strategic business decisions that
can change based on business context.

**Core Concept**:

```typescript
// Business policy answers: "Is this action allowed by our business strategy?"
const policy = new CreditApprovalPolicy();
policy.check(creditApplication); // Returns Result<T, PolicyViolation>
```

### Policy vs. Validation vs. Business Rules

1. **Validation**: "Is this data correct?" (e.g., email format)
2. **Business Rules**: "Does this comply with domain constraints?" (e.g., order
   must have items)
3. **Business Policies**: "Is this allowed by our business strategy?" (e.g., can
   we offer credit to this customer?)

### Primary Use Cases

1. **Strategic Decisions**: Encoding high-level business strategies
2. **Risk Management**: Determining acceptable business risks
3. **Compliance**: Ensuring actions comply with business policies
4. **Dynamic Rules**: Rules that change based on business context
5. **Authorization**: Determining what actions are permitted

### Key Benefits

- **Explicit Strategy**: Business policies become explicit in code
- **Composability**: Combine policies with AND/OR logic
- **Changeability**: Policies can be modified without changing core domain
- **Centralization**: All policies in one place for easy management
- **Traceability**: Clear audit trail of policy decisions

## Core Components

### 1. IBusinessPolicy Interface

**Purpose**: Define the contract for all business policies

```typescript
interface IBusinessPolicy<T> {
  // Check if entity satisfies the policy
  isSatisfiedBy(entity: T): boolean;

  // Validate entity against policy with detailed result
  check(entity: T): Result<T, PolicyViolation>;

  // Combine policies with AND logic
  and(other: IBusinessPolicy<T>): IBusinessPolicy<T>;

  // Combine policies with OR logic
  or(other: IBusinessPolicy<T>): IBusinessPolicy<T>;
}
```

**Key Methods**:

- `isSatisfiedBy()`: Quick boolean check
- `check()`: Detailed check with violation information
- `and()`, `or()`: Policy composition

### 2. PolicyViolation

**Purpose**: Represent policy violations with detailed information

```typescript
class PolicyViolation {
  constructor(
    public readonly code: string, // Unique violation code
    public readonly message: string, // Human-readable message
    public readonly details?: Record<string, any> // Additional context
  ) {}
}
```

### 3. BusinessPolicy

**Purpose**: Core implementation of business policies

```typescript
class BusinessPolicy<T> implements IBusinessPolicy<T> {
  constructor(
    private readonly specification: ISpecification<T>,
    private readonly violationCode: string,
    private readonly violationMessage: string,
    private readonly violationDetails?: (entity: T) => Record<string, any>
  ) {}

  // Create from specification
  static fromSpecification<T>(
    specification: ISpecification<T>,
    violationCode: string,
    violationMessage: string
  ): BusinessPolicy<T>;

  // Create from validator
  static fromValidator<T>(
    validator: IValidator<T>,
    violationCode: string,
    violationMessage: string
  ): BusinessPolicy<T>;
}
```

### 4. CompositePolicy

**Purpose**: Combine multiple policies with AND/OR logic

```typescript
class CompositePolicy<T> implements IBusinessPolicy<T> {
  constructor(
    private readonly operator: 'AND' | 'OR',
    private readonly policies: IBusinessPolicy<T>[]
  ) {}
}
```

### 5. PolicyRegistry

**Purpose**: Central registry for managing domain policies

```typescript
class PolicyRegistry {
  // Register a policy for a domain
  static register<T>(
    domain: string,
    policyName: string,
    policy: IBusinessPolicy<T>
  ): void;

  // Get a specific policy
  static getPolicy<T>(domain: string, policyName: string): IBusinessPolicy<T>;

  // Get all policies for a domain
  static getDomainPolicies<T>(
    domain: string
  ): Record<string, IBusinessPolicy<T>>;
}
```

## Basic Usage Examples

### 1. Creating Simple Policies

```typescript
// Domain model
class LoanApplication {
  constructor(
    public readonly id: string,
    public readonly customerId: string,
    public readonly amount: number,
    public readonly purpose: string,
    public readonly customerCreditScore: number,
    public readonly customerIncome: number,
    public readonly existingDebt: number
  ) {}

  get debtToIncomeRatio(): number {
    return this.existingDebt / this.customerIncome;
  }
}

// Create a policy from specification
const minimumCreditScoreSpec = new MinimumCreditScoreSpecification(650);
const creditScorePolicy = BusinessPolicy.fromSpecification(
  minimumCreditScoreSpec,
  'CREDIT_SCORE_TOO_LOW',
  'Credit score must be at least 650',
  application => ({
    actualScore: application.customerCreditScore,
    requiredScore: 650,
  })
);

// Use the policy
const application = new LoanApplication(
  '1',
  'cust-123',
  50000,
  'home',
  600,
  80000,
  20000
);

const result = creditScorePolicy.check(application);
if (result.isFailure()) {
  console.log(result.error.message); // "Credit score must be at least 650"
  console.log(result.error.details); // { actualScore: 600, requiredScore: 650 }
}
```

### 2. Creating Policies from Validators

```typescript
// Create a validator
const loanValidator = BusinessRuleValidator.create<LoanApplication>()
  .addRule(
    'amount',
    app => app.amount >= 10000 && app.amount <= 500000,
    'Loan amount must be between $10,000 and $500,000'
  )
  .addRule(
    'debtToIncomeRatio',
    app => app.debtToIncomeRatio <= 0.4,
    'Debt-to-income ratio cannot exceed 40%'
  );

// Convert to policy
const loanEligibilityPolicy = BusinessPolicy.fromValidator(
  loanValidator,
  'LOAN_ELIGIBILITY_FAILED',
  'Loan application does not meet eligibility requirements'
);
```

### 3. Composing Policies

```typescript
// Create individual policies
const creditScorePolicy = BusinessPolicy.fromSpecification(
  new MinimumCreditScoreSpecification(650),
  'LOW_CREDIT_SCORE',
  'Credit score too low'
);

const incomePolicy = BusinessPolicy.fromSpecification(
  new MinimumIncomeSpecification(50000),
  'INSUFFICIENT_INCOME',
  'Income below minimum requirement'
);

const debtRatioPolicy = BusinessPolicy.fromSpecification(
  new MaxDebtToIncomeRatioSpecification(0.4),
  'HIGH_DEBT_RATIO',
  'Debt-to-income ratio too high'
);

// Compose with AND logic (all must be satisfied)
const standardLoanPolicy = creditScorePolicy
  .and(incomePolicy)
  .and(debtRatioPolicy);

// Compose with OR logic (alternative criteria)
const premiumCustomerCreditPolicy = new MinimumCreditScoreSpecification(750);
const highIncomePolicy = new MinimumIncomeSpecification(150000);

const alternativeApprovalPolicy = BusinessPolicy.fromSpecification(
  premiumCustomerCreditPolicy,
  'PREMIUM_CREDIT',
  'Premium credit requirement'
).or(
  BusinessPolicy.fromSpecification(
    highIncomePolicy,
    'HIGH_INCOME',
    'High income qualification'
  )
);

// Complex composition
const finalLoanPolicy = standardLoanPolicy.or(alternativeApprovalPolicy);
```

## Advanced Policy Patterns

### 1. Domain-Specific Policy Factory

```typescript
// Create a policy factory for the lending domain
const lendingPolicies = createPolicyFactory<LoanApplication>('lending');

// Register policies
lendingPolicies.register(
  'creditScore',
  new MinimumCreditScoreSpecification(650),
  'LOW_CREDIT_SCORE',
  'Credit score must be at least 650',
  loan => ({
    actualScore: loan.customerCreditScore,
    requiredScore: 650,
  })
);

lendingPolicies.register(
  'debtToIncome',
  new MaxDebtToIncomeRatioSpecification(0.4),
  'HIGH_DEBT_RATIO',
  'Debt-to-income ratio cannot exceed 40%',
  loan => ({
    actualRatio: loan.debtToIncomeRatio,
    maxRatio: 0.4,
  })
);

lendingPolicies.register(
  'loanAmount',
  new LoanAmountRangeSpecification(10000, 500000),
  'INVALID_LOAN_AMOUNT',
  'Loan amount must be between $10,000 and $500,000'
);

// Use registered policies
const creditPolicy = lendingPolicies.get('creditScore');
const result = creditPolicy.check(loanApplication);

// Check all policies at once
const allPoliciesResult = lendingPolicies.checkAll(loanApplication);
if (allPoliciesResult.isFailure()) {
  console.log('Policy violations:', allPoliciesResult.error);
}
```

### 2. Context-Aware Policies

```typescript
// Policy that changes based on context
class ContextualLoanPolicy implements IBusinessPolicy<LoanApplication> {
  constructor(
    private readonly context: {
      isRecession: boolean;
      region: string;
      customerSegment: 'standard' | 'premium' | 'vip';
    }
  ) {}

  isSatisfiedBy(application: LoanApplication): boolean {
    return this.getContextualPolicy().isSatisfiedBy(application);
  }

  check(
    application: LoanApplication
  ): Result<LoanApplication, PolicyViolation> {
    return this.getContextualPolicy().check(application);
  }

  private getContextualPolicy(): IBusinessPolicy<LoanApplication> {
    // Stricter policies during recession
    if (this.context.isRecession) {
      return new MinimumCreditScoreSpecification(700).and(
        new MaxDebtToIncomeRatioSpecification(0.3)
      );
    }

    // Different policies by customer segment
    switch (this.context.customerSegment) {
      case 'vip':
        return new MinimumCreditScoreSpecification(600);
      case 'premium':
        return new MinimumCreditScoreSpecification(650);
      default:
        return new MinimumCreditScoreSpecification(680);
    }
  }

  and(
    other: IBusinessPolicy<LoanApplication>
  ): IBusinessPolicy<LoanApplication> {
    return new CompositePolicy('AND', [this, other]);
  }

  or(
    other: IBusinessPolicy<LoanApplication>
  ): IBusinessPolicy<LoanApplication> {
    return new CompositePolicy('OR', [this, other]);
  }
}
```

### 3. Policy Versioning

```typescript
// Managing policy versions
class VersionedPolicyRegistry {
  private static policies = new Map<
    string,
    Map<string, IBusinessPolicy<any>>
  >();

  static register<T>(
    domain: string,
    policyName: string,
    version: string,
    policy: IBusinessPolicy<T>
  ): void {
    const key = `${domain}:${policyName}:${version}`;
    if (!this.policies.has(domain)) {
      this.policies.set(domain, new Map());
    }
    this.policies.get(domain)!.set(key, policy);
  }

  static getPolicy<T>(
    domain: string,
    policyName: string,
    version: string = 'latest'
  ): IBusinessPolicy<T> {
    const domainPolicies = this.policies.get(domain);
    if (!domainPolicies) {
      throw new Error(`Domain ${domain} not found`);
    }

    if (version === 'latest') {
      // Find the latest version
      const versions = Array.from(domainPolicies.keys())
        .filter(key => key.startsWith(`${domain}:${policyName}:`))
        .map(key => key.split(':')[2])
        .sort();

      if (versions.length === 0) {
        throw new Error(`Policy ${policyName} not found`);
      }

      version = versions[versions.length - 1];
    }

    const key = `${domain}:${policyName}:${version}`;
    const policy = domainPolicies.get(key);

    if (!policy) {
      throw new Error(`Policy ${policyName} version ${version} not found`);
    }

    return policy as IBusinessPolicy<T>;
  }
}
```

## Domain Example: Insurance Underwriting System

### Domain Models

```typescript
// Value Objects
class RiskProfile {
  constructor(
    public readonly score: number,
    public readonly category: 'low' | 'medium' | 'high' | 'extreme',
    public readonly factors: string[]
  ) {}
}

class Coverage {
  constructor(
    public readonly type: string,
    public readonly amount: number,
    public readonly deductible: number,
    public readonly premium: number
  ) {}
}

// Entity
class PolicyApplication {
  constructor(
    public readonly id: string,
    public readonly applicantId: string,
    public readonly applicantAge: number,
    public readonly healthStatus: 'excellent' | 'good' | 'fair' | 'poor',
    public readonly smokingStatus: boolean,
    public readonly occupation: string,
    public readonly annualIncome: number,
    public readonly coverageRequested: Coverage,
    public readonly medicalHistory: string[],
    public readonly riskProfile?: RiskProfile
  ) {}

  get isHighRisk(): boolean {
    return (
      this.riskProfile?.category === 'high' ||
      this.riskProfile?.category === 'extreme'
    );
  }
}
```

### Insurance Policy Implementation

```typescript
// Specifications for insurance policies
class AgeEligibilitySpecification extends CompositeSpecification<PolicyApplication> {
  constructor(
    private readonly minAge: number = 18,
    private readonly maxAge: number = 65
  ) {
    super();
  }

  isSatisfiedBy(application: PolicyApplication): boolean {
    return (
      application.applicantAge >= this.minAge &&
      application.applicantAge <= this.maxAge
    );
  }
}

class HealthStatusSpecification extends CompositeSpecification<PolicyApplication> {
  constructor(private readonly acceptableStatuses: string[]) {
    super();
  }

  isSatisfiedBy(application: PolicyApplication): boolean {
    return this.acceptableStatuses.includes(application.healthStatus);
  }
}

class CoverageAmountSpecification extends CompositeSpecification<PolicyApplication> {
  constructor(private readonly maxCoverageByIncome: number = 10) {
    super();
  }

  isSatisfiedBy(application: PolicyApplication): boolean {
    const maxCoverage = application.annualIncome * this.maxCoverageByIncome;
    return application.coverageRequested.amount <= maxCoverage;
  }
}

// Create insurance policies
const insurancePolicies = createPolicyFactory<PolicyApplication>('insurance');

// Basic eligibility policy
insurancePolicies.register(
  'ageEligibility',
  new AgeEligibilitySpecification(18, 65),
  'AGE_INELIGIBLE',
  'Applicant age must be between 18 and 65',
  app => ({
    applicantAge: app.applicantAge,
    minAge: 18,
    maxAge: 65,
  })
);

// Health policy
insurancePolicies.register(
  'healthRequirements',
  new HealthStatusSpecification(['excellent', 'good', 'fair']),
  'HEALTH_STATUS_UNACCEPTABLE',
  'Health status does not meet requirements',
  app => ({
    currentStatus: app.healthStatus,
    acceptableStatuses: ['excellent', 'good', 'fair'],
  })
);

// Coverage amount policy
insurancePolicies.register(
  'coverageLimit',
  new CoverageAmountSpecification(10),
  'COVERAGE_EXCEEDS_LIMIT',
  'Coverage amount exceeds allowed limit based on income',
  app => ({
    requestedCoverage: app.coverageRequested.amount,
    maxAllowedCoverage: app.annualIncome * 10,
    annualIncome: app.annualIncome,
  })
);

// Complex underwriting policy
class UnderwritingPolicy implements IBusinessPolicy<PolicyApplication> {
  private basePolicy: IBusinessPolicy<PolicyApplication>;

  constructor() {
    // Combine base requirements
    this.basePolicy = insurancePolicies
      .get('ageEligibility')
      .and(insurancePolicies.get('healthRequirements'))
      .and(insurancePolicies.get('coverageLimit'));
  }

  isSatisfiedBy(application: PolicyApplication): boolean {
    // Base requirements
    if (!this.basePolicy.isSatisfiedBy(application)) {
      return false;
    }

    // Additional risk-based rules
    if (application.isHighRisk) {
      return this.evaluateHighRiskCase(application);
    }

    return true;
  }

  check(
    application: PolicyApplication
  ): Result<PolicyApplication, PolicyViolation> {
    // Check base requirements first
    const baseResult = this.basePolicy.check(application);
    if (baseResult.isFailure()) {
      return baseResult;
    }

    // Check high-risk specific rules
    if (application.isHighRisk && !this.evaluateHighRiskCase(application)) {
      return Result.fail(
        new PolicyViolation(
          'HIGH_RISK_DECLINED',
          'Application declined due to high risk profile',
          {
            riskCategory: application.riskProfile?.category,
            riskFactors: application.riskProfile?.factors,
          }
        )
      );
    }

    return Result.ok(application);
  }

  private evaluateHighRiskCase(application: PolicyApplication): boolean {
    // High-risk applicants need excellent health and lower coverage
    if (application.healthStatus !== 'excellent') {
      return false;
    }

    // Limit coverage for high-risk applicants
    const maxHighRiskCoverage = application.annualIncome * 5;
    if (application.coverageRequested.amount > maxHighRiskCoverage) {
      return false;
    }

    // No smokers in high-risk category
    if (application.smokingStatus) {
      return false;
    }

    return true;
  }

  and(
    other: IBusinessPolicy<PolicyApplication>
  ): IBusinessPolicy<PolicyApplication> {
    return new CompositePolicy('AND', [this, other]);
  }

  or(
    other: IBusinessPolicy<PolicyApplication>
  ): IBusinessPolicy<PolicyApplication> {
    return new CompositePolicy('OR', [this, other]);
  }
}
```

### Using Policies in Domain Services

```typescript
class InsuranceUnderwritingService {
  private readonly standardPolicy = new UnderwritingPolicy();

  constructor(
    private readonly riskAssessmentService: RiskAssessmentService,
    private readonly pricingService: PricingService
  ) {}

  async evaluateApplication(
    application: PolicyApplication
  ): Promise<Result<UnderwritingDecision, PolicyViolation[]>> {
    // Assess risk profile
    const riskProfile =
      await this.riskAssessmentService.assessRisk(application);
    const applicationWithRisk = {
      ...application,
      riskProfile,
    };

    // Check all policies
    const policyResult = this.standardPolicy.check(applicationWithRisk);

    if (policyResult.isFailure()) {
      return Result.fail([policyResult.error]);
    }

    // Additional checks for specific occupations
    const occupationPolicy = this.getOccupationPolicy(application.occupation);
    const occupationResult = occupationPolicy.check(applicationWithRisk);

    if (occupationResult.isFailure()) {
      return Result.fail([occupationResult.error]);
    }

    // Calculate premium
    const premium =
      await this.pricingService.calculatePremium(applicationWithRisk);

    return Result.ok(
      new UnderwritingDecision(application.id, 'approved', premium, riskProfile)
    );
  }

  private getOccupationPolicy(
    occupation: string
  ): IBusinessPolicy<PolicyApplication> {
    // High-risk occupations have additional requirements
    const highRiskOccupations = [
      'firefighter',
      'police officer',
      'pilot',
      'miner',
    ];

    if (highRiskOccupations.includes(occupation.toLowerCase())) {
      return new HighRiskOccupationPolicy();
    }

    return new AlwaysTruePolicy(); // No additional requirements
  }
}

// Usage
const underwritingService = new InsuranceUnderwritingService(
  riskAssessmentService,
  pricingService
);

const application = new PolicyApplication(
  'app-123',
  'cust-456',
  35,
  'good',
  false,
  'software engineer',
  120000,
  new Coverage('life', 1000000, 1000, 0),
  []
);

const decision = await underwritingService.evaluateApplication(application);

if (decision.isSuccess()) {
  console.log('Application approved with premium:', decision.value.premium);
} else {
  console.log('Application declined:', decision.error);
}
```

## Testing Policies

```typescript
describe('UnderwritingPolicy', () => {
  let policy: UnderwritingPolicy;

  beforeEach(() => {
    policy = new UnderwritingPolicy();
  });

  describe('standard applications', () => {
    it('should approve eligible application', () => {
      const application = createStandardApplication({
        age: 30,
        healthStatus: 'good',
        coverageAmount: 500000,
        annualIncome: 80000,
      });

      const result = policy.check(application);
      expect(result.isSuccess()).toBe(true);
    });

    it('should reject underage applicant', () => {
      const application = createStandardApplication({
        age: 16,
      });

      const result = policy.check(application);
      expect(result.isFailure()).toBe(true);
      expect(result.error.code).toBe('AGE_INELIGIBLE');
    });

    it('should reject excessive coverage', () => {
      const application = createStandardApplication({
        coverageAmount: 2000000,
        annualIncome: 50000, // 40x income requested
      });

      const result = policy.check(application);
      expect(result.isFailure()).toBe(true);
      expect(result.error.code).toBe('COVERAGE_EXCEEDS_LIMIT');
    });
  });

  describe('high-risk applications', () => {
    it('should have stricter requirements for high-risk', () => {
      const highRiskApp = createHighRiskApplication({
        healthStatus: 'good', // Not excellent
        coverageAmount: 500000,
        annualIncome: 100000,
      });

      const result = policy.check(highRiskApp);
      expect(result.isFailure()).toBe(true);
      expect(result.error.code).toBe('HIGH_RISK_DECLINED');
    });

    it('should approve high-risk with excellent health', () => {
      const highRiskApp = createHighRiskApplication({
        healthStatus: 'excellent',
        coverageAmount: 400000,
        annualIncome: 100000, // 4x income, under 5x limit
        smokingStatus: false,
      });

      const result = policy.check(highRiskApp);
      expect(result.isSuccess()).toBe(true);
    });
  });
});
```

## Best Practices

### 1. Keep Policies Focused

```typescript
// Bad - mixing multiple concerns
class EverythingPolicy implements IBusinessPolicy<Order> {
  check(order: Order): Result<Order, PolicyViolation> {
    // Checks customer, product, inventory, payment, shipping...
    // Too many responsibilities
  }
}

// Good - single responsibility
class PaymentMethodPolicy implements IBusinessPolicy<Order> {
  check(order: Order): Result<Order, PolicyViolation> {
    // Only checks if payment method is acceptable
  }
}

class ShippingEligibilityPolicy implements IBusinessPolicy<Order> {
  check(order: Order): Result<Order, PolicyViolation> {
    // Only checks shipping eligibility
  }
}
```

### 2. Use Clear Violation Codes

```typescript
// Bad - generic codes
new PolicyViolation('ERROR', 'Something went wrong');

// Good - specific, actionable codes
new PolicyViolation(
  'CREDIT_SCORE_BELOW_MINIMUM',
  'Credit score of 580 is below minimum requirement of 650',
  {
    actualScore: 580,
    minimumRequired: 650,
    improvementNeeded: 70,
  }
);
```

### 3. Compose Policies Meaningfully

```typescript
// Good - clear composition
const loanApprovalPolicy = creditScorePolicy
  .and(incomeVerificationPolicy)
  .and(debtRatioPolicy)
  .and(employmentHistoryPolicy);

// Better - named compositions
const basicEligibilityPolicy = creditScorePolicy.and(incomeVerificationPolicy);
const financialHealthPolicy = debtRatioPolicy.and(assetVerificationPolicy);
const finalPolicy = basicEligibilityPolicy.and(financialHealthPolicy);
```

### 4. Use Factory Pattern for Complex Policies

```typescript
class PolicyFactory {
  static createLoanPolicy(params: {
    loanType: 'personal' | 'mortgage' | 'auto';
    amount: number;
    customerSegment: 'standard' | 'premium';
  }): IBusinessPolicy<LoanApplication> {
    // Build appropriate policy based on parameters
    switch (params.loanType) {
      case 'mortgage':
        return this.createMortgagePolicy(params);
      case 'auto':
        return this.createAutoLoanPolicy(params);
      default:
        return this.createPersonalLoanPolicy(params);
    }
  }

  private static createMortgagePolicy(
    params: any
  ): IBusinessPolicy<LoanApplication> {
    // Specific mortgage requirements
    let policy = new MinimumCreditScoreSpecification(680)
      .and(new MinimumDownPaymentSpecification(0.2))
      .and(new PropertyAppraisalPolicy());

    if (params.amount > 500000) {
      policy = policy.and(new JumboLoanPolicy());
    }

    return policy;
  }
}
```

### 5. Document Policy Rationale

```typescript
/**
 * High-Value Transaction Policy
 *
 * Business Rationale:
 * - Transactions over $10,000 require additional verification
 * - Reduces fraud risk and ensures regulatory compliance
 * - Based on: Company Policy DOC-123, Regulation XYZ
 *
 * Requirements:
 * 1. Customer must be verified
 * 2. Two-factor authentication must be completed
 * 3. Transaction must be approved by senior staff
 */
class HighValueTransactionPolicy implements IBusinessPolicy<Transaction> {
  private static readonly THRESHOLD = 10000;

  check(transaction: Transaction): Result<Transaction, PolicyViolation> {
    if (transaction.amount <= HighValueTransactionPolicy.THRESHOLD) {
      return Result.ok(transaction);
    }

    // Implementation...
  }
}
```

### 6. Consider Policy Versioning

```typescript
// Track policy versions for audit and rollback
class VersionedPolicy<T> implements IBusinessPolicy<T> {
  constructor(
    private readonly version: string,
    private readonly effectiveDate: Date,
    private readonly policy: IBusinessPolicy<T>,
    private readonly changeLog: string
  ) {}

  check(entity: T): Result<T, PolicyViolation> {
    const result = this.policy.check(entity);

    if (result.isFailure()) {
      return Result.fail(
        new PolicyViolation(result.error.code, result.error.message, {
          ...result.error.details,
          policyVersion: this.version,
          effectiveDate: this.effectiveDate,
        })
      );
    }

    return result;
  }
}
```

## Performance Considerations

### 1. Cache Expensive Policy Checks

```typescript
class CachedPolicy<T> implements IBusinessPolicy<T> {
  private cache = new Map<string, boolean>();

  constructor(
    private readonly policy: IBusinessPolicy<T>,
    private readonly keyGenerator: (entity: T) => string,
    private readonly ttl: number = 300000 // 5 minutes
  ) {}

  isSatisfiedBy(entity: T): boolean {
    const key = this.keyGenerator(entity);
    const cached = this.cache.get(key);

    if (cached !== undefined) {
      return cached;
    }

    const result = this.policy.isSatisfiedBy(entity);
    this.cache.set(key, result);

    // Clear cache after TTL
    setTimeout(() => this.cache.delete(key), this.ttl);

    return result;
  }
}
```

### 2. Lazy Policy Evaluation

```typescript
class LazyCompositePolicy<T> implements IBusinessPolicy<T> {
  check(entity: T): Result<T, PolicyViolation> {
    // For AND: stop at first failure
    // For OR: stop at first success
    // This is already implemented in CompositePolicy
  }
}
```

## Conclusion

Business Policies in DomainTS provide:

- **Strategic Encoding**: Business strategies as executable code
- **Flexibility**: Policies can change without modifying core domain
- **Composition**: Complex policies from simple building blocks
- **Clarity**: Explicit business decisions with clear violations
- **Maintainability**: Centralized policy management
- **Auditability**: Clear trail of policy decisions

The Business Policy pattern enables you to separate high-level business
decisions from core domain logic, making your system more adaptable to changing
business requirements while maintaining a clean, understandable domain model.
