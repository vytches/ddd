# Composite Validation with Policy Integration

**Version**: 1.0.0 **Package**: @vytches/ddd-validation **Complexity**:
Intermediate **Domain**: Financial Services **Patterns**: Composite Validation,
Policy Integration, Async Specifications, Conditional Logic **Dependencies**:
@vytches/ddd-validation, @vytches/ddd-policies, @vytches/ddd-core

## Description

This example demonstrates advanced composite validation patterns integrated with
business policies for financial services applications. It shows how to combine
multiple validation strategies, implement async validation with external
services, and create conditional validation flows.

## Business Context

Financial institutions require sophisticated validation that combines immediate
data checks with external service verification (credit checks, fraud detection,
compliance screening). The validation must be configurable, auditable, and
capable of handling complex business policies that change based on market
conditions and regulations.

## Code Example

```typescript
// composite-financial-validator.ts
import {
  CompositeSpecification,
  IAsyncSpecification,
  ValidationResult,
  ValidationPolicy,
  PolicyRule,
} from '@vytches/ddd-validation';
import { PolicyBuilder, PolicyContext } from '@vytches/ddd-policies';
import { LoanApplication, CreditCheckResult } from './types'; // From your application

// Async credit score specification
export class CreditScoreSpecification
  implements IAsyncSpecification<LoanApplication>
{
  constructor(private creditService: ICreditService) {}

  async isSatisfiedByAsync(
    application: LoanApplication
  ): Promise<SpecificationResult> {
    try {
      const creditResult = await this.creditService.getCreditScore(
        application.applicantId
      );
      const minimumScore = this.getMinimumScore(application.loanAmount);
      const isValid = creditResult.score >= minimumScore;

      return {
        isSatisfied: isValid,
        reason: isValid
          ? undefined
          : `Credit score ${creditResult.score} below minimum ${minimumScore}`,
        metadata: {
          creditScore: creditResult.score,
          minimumRequired: minimumScore,
          creditHistory: creditResult.history,
          riskLevel: creditResult.riskLevel,
        },
      };
    } catch (error) {
      return {
        isSatisfied: false,
        reason: 'Unable to verify credit score',
        metadata: { error: error.message },
      };
    }
  }

  private getMinimumScore(loanAmount: number): number {
    if (loanAmount > 500000) return 750; // Premium loans
    if (loanAmount > 100000) return 650; // Standard loans
    return 600; // Basic loans
  }
}

// Income verification specification
export class IncomeVerificationSpecification
  implements IAsyncSpecification<LoanApplication>
{
  constructor(private incomeService: IIncomeVerificationService) {}

  async isSatisfiedByAsync(
    application: LoanApplication
  ): Promise<SpecificationResult> {
    const verificationResult = await this.incomeService.verifyIncome(
      application.applicantId,
      application.declaredIncome
    );

    const debtToIncomeRatio = this.calculateDebtToIncomeRatio(application);
    const isValid = verificationResult.verified && debtToIncomeRatio <= 0.43; // Standard DTI ratio

    return {
      isSatisfied: isValid,
      reason: isValid
        ? undefined
        : `Debt-to-income ratio ${debtToIncomeRatio} exceeds maximum 43%`,
      metadata: {
        verifiedIncome: verificationResult.verifiedAmount,
        declaredIncome: application.declaredIncome,
        debtToIncomeRatio,
        employmentVerified: verificationResult.employmentVerified,
      },
    };
  }

  private calculateDebtToIncomeRatio(application: LoanApplication): number {
    const monthlyDebt = application.existingDebts.reduce(
      (sum, debt) => sum + debt.monthlyPayment,
      0
    );
    const monthlyIncome = application.declaredIncome / 12;
    return monthlyDebt / monthlyIncome;
  }
}

// Compliance screening specification
export class ComplianceScreeningSpecification
  implements IAsyncSpecification<LoanApplication>
{
  constructor(private complianceService: IComplianceService) {}

  async isSatisfiedByAsync(
    application: LoanApplication
  ): Promise<SpecificationResult> {
    const screeningResults = await Promise.all([
      this.complianceService.checkSanctionsList(application.applicantId),
      this.complianceService.checkPEPStatus(application.applicantId),
      this.complianceService.checkFraudDatabase(application.applicantId),
    ]);

    const [sanctionsCheck, pepCheck, fraudCheck] = screeningResults;
    const isValid =
      !sanctionsCheck.flagged && !pepCheck.flagged && !fraudCheck.flagged;

    return {
      isSatisfied: isValid,
      reason: isValid ? undefined : 'Failed compliance screening',
      metadata: {
        sanctionsCheck: sanctionsCheck.status,
        pepCheck: pepCheck.status,
        fraudCheck: fraudCheck.status,
        riskFlags: [
          ...sanctionsCheck.flags,
          ...pepCheck.flags,
          ...fraudCheck.flags,
        ],
      },
    };
  }
}

// Composite loan application validator
export class LoanApplicationValidator {
  private creditSpec: CreditScoreSpecification;
  private incomeSpec: IncomeVerificationSpecification;
  private complianceSpec: ComplianceScreeningSpecification;
  private validationPolicy: ValidationPolicy;

  constructor(
    creditService: ICreditService,
    incomeService: IIncomeVerificationService,
    complianceService: IComplianceService
  ) {
    this.creditSpec = new CreditScoreSpecification(creditService);
    this.incomeSpec = new IncomeVerificationSpecification(incomeService);
    this.complianceSpec = new ComplianceScreeningSpecification(
      complianceService
    );

    this.initializeValidationPolicy();
  }

  private initializeValidationPolicy(): void {
    // Create comprehensive validation policy
    this.validationPolicy = {
      id: 'loan-application-validation',
      name: 'Comprehensive Loan Application Validation',
      description:
        'Multi-layer validation for loan applications with risk assessment',
      entityType: 'LoanApplication',
      isActive: true,
      priority: 1,
      rules: [
        {
          field: 'creditScore',
          validationType: 'async-credit-check',
          parameters: { minimumScore: 600, checkHistory: true },
          errorMessage: 'Credit score verification failed',
          warningMessage: 'Credit score is below optimal range',
        },
        {
          field: 'income',
          validationType: 'income-verification',
          parameters: { maxDebtRatio: 0.43, verifyEmployment: true },
          errorMessage: 'Income verification failed',
          warningMessage: 'Income verification pending',
        },
        {
          field: 'compliance',
          validationType: 'compliance-screening',
          parameters: {
            checkSanctions: true,
            checkPEP: true,
            checkFraud: true,
          },
          errorMessage: 'Compliance screening failed',
        },
      ],
      conditions: [
        {
          field: 'loanAmount',
          operator: 'greater_than',
          value: 50000,
          context: 'enhanced-verification',
        },
      ],
    };
  }

  async validateApplication(
    application: LoanApplication,
    context?: ValidationContext
  ): Promise<CompositeValidationResult> {
    const startTime = Date.now();
    const validationId = `validation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Create policy context for enhanced validation
      const policyContext = PolicyContext.create()
        .withUserId(application.applicantId)
        .withSessionId(context?.userId || 'system')
        .withRequestId(validationId)
        .withMetadata({
          loanAmount: application.loanAmount,
          applicationType: application.type,
        })
        .build();

      // Execute parallel async validations
      const validationPromises = [
        this.executeSpecificationWithPolicy(
          'credit',
          this.creditSpec,
          application,
          policyContext
        ),
        this.executeSpecificationWithPolicy(
          'income',
          this.incomeSpec,
          application,
          policyContext
        ),
        this.executeSpecificationWithPolicy(
          'compliance',
          this.complianceSpec,
          application,
          policyContext
        ),
      ];

      const results = await Promise.allSettled(validationPromises);
      const validationResults = new Map<string, SpecificationResult>();
      const errors: ValidationError[] = [];
      const warnings: ValidationWarning[] = [];

      // Process results
      results.forEach((result, index) => {
        const specName = ['credit', 'income', 'compliance'][index];

        if (result.status === 'fulfilled') {
          validationResults.set(specName, result.value);

          if (!result.value.isSatisfied) {
            errors.push({
              field: specName,
              code: `${specName.toUpperCase()}_VALIDATION_FAILED`,
              message: result.value.reason || `${specName} validation failed`,
              severity: 'error',
              details: result.value.metadata,
            });
          }
        } else {
          errors.push({
            field: specName,
            code: `${specName.toUpperCase()}_VALIDATION_ERROR`,
            message: `${specName} validation encountered an error: ${result.reason}`,
            severity: 'critical',
          });
        }
      });

      // Calculate overall risk score
      const riskScore = this.calculateRiskScore(validationResults);
      const riskLevel = this.determineRiskLevel(riskScore);

      // Add risk-based warnings
      if (riskLevel === 'medium') {
        warnings.push({
          field: 'risk',
          code: 'MEDIUM_RISK_APPLICATION',
          message: 'Application requires additional review',
          suggestion: 'Consider requesting additional documentation',
        });
      } else if (riskLevel === 'high') {
        errors.push({
          field: 'risk',
          code: 'HIGH_RISK_APPLICATION',
          message: 'Application exceeds risk threshold',
          severity: 'error',
          details: { riskScore, riskLevel },
        });
      }

      const endTime = Date.now();

      return {
        isSatisfied:
          errors.filter(
            e => e.severity === 'error' || e.severity === 'critical'
          ).length === 0,
        results: validationResults,
        aggregatedReason:
          errors.length > 0
            ? 'Multiple validation failures detected'
            : undefined,
        riskAssessment: {
          score: riskScore,
          level: riskLevel,
          factors: this.getRiskFactors(validationResults),
        },
        metadata: {
          validationId,
          validatedAt: new Date(),
          validationDuration: endTime - startTime,
          rulesApplied: this.validationPolicy.rules.map(r => r.field),
          skippedRules: [],
          validatorVersion: '2.0.0',
          context: context || {
            operationType: 'create',
            environment: 'production',
            validationLevel: 'enterprise',
          },
        },
        errors,
        warnings,
      };
    } catch (error) {
      return {
        isSatisfied: false,
        results: new Map(),
        aggregatedReason: `Validation failed: ${error.message}`,
        riskAssessment: {
          score: 100, // Maximum risk on failure
          level: 'critical',
          factors: ['validation-system-error'],
        },
        metadata: {
          validationId,
          validatedAt: new Date(),
          validationDuration: Date.now() - startTime,
          rulesApplied: [],
          skippedRules: this.validationPolicy.rules.map(r => r.field),
          validatorVersion: '2.0.0',
          context: context || {
            operationType: 'create',
            environment: 'production',
            validationLevel: 'enterprise',
          },
        },
        errors: [
          {
            field: 'system',
            code: 'VALIDATION_SYSTEM_ERROR',
            message: error.message,
            severity: 'critical',
          },
        ],
        warnings: [],
      };
    }
  }

  private async executeSpecificationWithPolicy(
    specName: string,
    specification: IAsyncSpecification<LoanApplication>,
    application: LoanApplication,
    policyContext: PolicyContext
  ): Promise<SpecificationResult> {
    // Create policy for this specific validation
    const policy = PolicyBuilder.create<LoanApplication>()
      .withId(`${specName}-validation-policy`)
      .withDomain('financial-validation')
      .mustAsync({
        isSatisfiedByAsync: async app => {
          const result = await specification.isSatisfiedByAsync(app);
          return result.isSatisfied;
        },
      })
      .withCode(`${specName.toUpperCase()}_POLICY_VIOLATION`)
      .withMessage(`${specName} validation policy violated`)
      .build();

    // Execute policy check
    const policyResult = await policy.check({
      entity: application,
      context: policyContext,
    });

    // Get detailed specification result
    const specResult = await specification.isSatisfiedByAsync(application);

    return {
      ...specResult,
      metadata: {
        ...specResult.metadata,
        policyEvaluated: true,
        policyPassed: policyResult.isSuccess(),
        policyViolations: policyResult.isFailure()
          ? policyResult.error.violations
          : [],
      },
    };
  }

  private calculateRiskScore(
    results: Map<string, SpecificationResult>
  ): number {
    let riskScore = 0;
    let totalFactors = 0;

    results.forEach((result, specName) => {
      totalFactors++;

      if (!result.isSatisfied) {
        riskScore += 30; // Base risk for failed validation
      }

      // Add specific risk factors
      if (specName === 'credit' && result.metadata) {
        const creditScore = result.metadata.creditScore as number;
        if (creditScore < 650) riskScore += 20;
        if (creditScore < 600) riskScore += 30;
      }

      if (specName === 'income' && result.metadata) {
        const dtiRatio = result.metadata.debtToIncomeRatio as number;
        if (dtiRatio > 0.36) riskScore += 15;
        if (dtiRatio > 0.43) riskScore += 25;
      }

      if (specName === 'compliance' && result.metadata) {
        const flags = result.metadata.riskFlags as string[];
        riskScore += flags.length * 20;
      }
    });

    return Math.min(100, riskScore); // Cap at 100
  }

  private determineRiskLevel(
    riskScore: number
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (riskScore >= 80) return 'critical';
    if (riskScore >= 60) return 'high';
    if (riskScore >= 30) return 'medium';
    return 'low';
  }

  private getRiskFactors(results: Map<string, SpecificationResult>): string[] {
    const factors: string[] = [];

    results.forEach((result, specName) => {
      if (!result.isSatisfied) {
        factors.push(`${specName}-validation-failed`);
      }

      if (result.metadata) {
        // Add specific risk factors based on metadata
        if (specName === 'credit' && result.metadata.riskLevel === 'high') {
          factors.push('high-credit-risk');
        }
        if (
          specName === 'compliance' &&
          result.metadata.riskFlags &&
          (result.metadata.riskFlags as string[]).length > 0
        ) {
          factors.push('compliance-flags-detected');
        }
      }
    });

    return factors;
  }
}

// Usage example
const validator = new LoanApplicationValidator(
  creditService,
  incomeService,
  complianceService
);

const loanApplication: LoanApplication = {
  id: 'app-001',
  applicantId: 'user-12345',
  loanAmount: 250000,
  loanPurpose: 'home-purchase',
  declaredIncome: 85000,
  existingDebts: [
    { type: 'credit-card', monthlyPayment: 350 },
    { type: 'auto-loan', monthlyPayment: 425 },
  ],
  type: 'mortgage',
};

const context: ValidationContext = {
  operationType: 'create',
  environment: 'production',
  validationLevel: 'enterprise',
  businessRules: { enhancedDueDiligence: true },
};

// Execute comprehensive validation
const result = await validator.validateApplication(loanApplication, context);
console.log('Validation result:', result.isSatisfied);
console.log('Risk assessment:', result.riskAssessment);
console.log('Errors:', result.errors);
console.log('Warnings:', result.warnings);
```

## Key Features

- **Async Specification Support**: Handle external service calls with proper
  error handling
- **Policy Integration**: Combine specifications with business policies for
  enhanced validation
- **Risk Assessment**: Calculate comprehensive risk scores based on validation
  results
- **Parallel Execution**: Run multiple async validations concurrently for
  performance
- **Conditional Logic**: Apply different validation rules based on application
  context
- **Comprehensive Metadata**: Rich metadata for audit trails and debugging

## Common Pitfalls

- **Timeout Handling**: Always set appropriate timeouts for external service
  calls
- **Error Recovery**: Handle external service failures gracefully without
  blocking the entire validation
- **Performance Impact**: Monitor async validation performance and consider
  caching strategies
- **Policy Complexity**: Keep policy logic maintainable and well-documented

## Related Examples

- [Advanced Data Quality Validation](./example-2.md)
- [Batch Validation with Performance Optimization](./example-3.md)
- [Enterprise Validation Orchestration](../advanced/example-1.md)
