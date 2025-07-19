# Intermediate Conditional Policy Implementation

**Focus**: Advanced policy features with conditional logic and group policies  
**Domain**: Financial Services  
**Complexity**: Intermediate  
**Dependencies**: @vytches-ddd/policies, @vytches-ddd/di, @vytches-ddd/utils

## Business Context

This example demonstrates advanced policy features for a loan approval system:
- Conditional policies based on loan type and amount
- Policy groups for complex business logic (excellent credit OR good credit with collateral)
- Dynamic policy execution based on runtime conditions
- Rich violation handling with severity levels

## Implementation

```typescript
// loan-approval-policy.ts
import { 
  PolicyBuilder, 
  PolicyGroup, 
  PolicyContext,
  ISpecification 
} from '@vytches-ddd/policies';
import { DomainService, ServiceLifetime } from '@vytches-ddd/di';
import { Result } from '@vytches-ddd/utils';
import { Logger } from '@vytches-ddd/logging';
import { LoanApplication, CreditScore, Collateral } from '../types'; // ALWAYS import from app

// Advanced specifications for loan approval
class CreditScoreSpecification implements ISpecification<LoanApplication> {
  constructor(private minimumScore: number) {}
  
  isSatisfiedBy(application: LoanApplication): boolean {
    return application.creditScore >= this.minimumScore;
  }
}

class CollateralSpecification implements ISpecification<LoanApplication> {
  constructor(private minimumValue: number) {}
  
  isSatisfiedBy(application: LoanApplication): boolean {
    return application.collateral?.value >= this.minimumValue;
  }
}

class DebtToIncomeSpecification implements ISpecification<LoanApplication> {
  constructor(private maximumRatio: number) {}
  
  isSatisfiedBy(application: LoanApplication): boolean {
    return (application.totalDebt / application.annualIncome) <= this.maximumRatio;
  }
}

class EmploymentHistorySpecification implements ISpecification<LoanApplication> {
  constructor(private minimumYears: number) {}
  
  isSatisfiedBy(application: LoanApplication): boolean {
    return application.employmentHistory >= this.minimumYears;
  }
}

// ⭐ Advanced Loan Approval Policy with Conditional Logic
@DomainService('loanApprovalPolicy', {
  lifetime: ServiceLifetime.Singleton,
  context: 'LoanProcessing'
})
export class LoanApprovalPolicy {
  private logger = Logger.forContext('LoanApprovalPolicy');

  // Policy group for excellent credit customers
  private excellentCreditGroup = PolicyGroup.create<LoanApplication>('excellent-credit')
    .mustSatisfy(
      app => app.creditScore >= 800,
      'CREDIT_NOT_EXCELLENT',
      'Excellent credit score (800+) required'
    );

  // Policy group for good credit with collateral
  private goodCreditWithCollateralGroup = PolicyGroup.create<LoanApplication>('good-credit-collateral')
    .mustSatisfy(
      app => app.creditScore >= 650,
      'CREDIT_NOT_GOOD',
      'Good credit score (650+) required'
    )
    .and()
    .mustSatisfy(
      app => app.collateral?.value >= 50000,
      'INSUFFICIENT_COLLATERAL',
      'Collateral value must be at least $50,000'
    );

  // Main conditional policy
  private createConditionalPolicy(loanType: string, amount: number) {
    return PolicyBuilder.create<LoanApplication>()
      .withId(`loan-approval-${loanType}`)
      .withDomain('financial-services')
      .withName(`${loanType} Loan Approval Policy`)
      
      // Basic requirements for all loans
      .must(new DebtToIncomeSpecification(0.4))
      .withCode('DEBT_TO_INCOME_HIGH')
      .withMessage('Debt-to-income ratio must be below 40%')
      .withSeverity('ERROR')
      .and()
      .must(new EmploymentHistorySpecification(2))
      .withCode('INSUFFICIENT_EMPLOYMENT_HISTORY')
      .withMessage('Must have at least 2 years employment history')
      .withSeverity('ERROR')
      .and()
      
      // Conditional logic for high-value loans
      .when(app => amount > 500000)
      .then()
      .must(new CreditScoreSpecification(750))
      .withCode('HIGH_VALUE_CREDIT_INSUFFICIENT')
      .withMessage('High-value loans require credit score of 750+')
      .withSeverity('ERROR')
      .and()
      .must(new CollateralSpecification(amount * 0.2))
      .withCode('HIGH_VALUE_COLLATERAL_INSUFFICIENT')
      .withMessage('High-value loans require 20% collateral')
      .withSeverity('ERROR')
      
      // Conditional logic for mortgage loans
      .when(app => loanType === 'mortgage')
      .then()
      .shouldSatisfyAny(this.excellentCreditGroup, this.goodCreditWithCollateralGroup)
      .withCode('MORTGAGE_CREDIT_REQUIREMENTS')
      .withMessage('Mortgage requires excellent credit OR good credit with collateral')
      .withSeverity('ERROR')
      
      // Conditional logic for business loans
      .when(app => loanType === 'business')
      .then()
      .must(new CreditScoreSpecification(700))
      .withCode('BUSINESS_CREDIT_INSUFFICIENT')
      .withMessage('Business loans require credit score of 700+')
      .withSeverity('ERROR')
      .and()
      .mustSatisfy(
        app => app.businessRevenue >= amount * 0.3,
        'BUSINESS_REVENUE_INSUFFICIENT',
        'Business revenue must be at least 30% of loan amount'
      )
      .withSeverity('ERROR')
      
      // Production environment additional checks
      .when(ctx => ctx.environment === 'production')
      .then()
      .must(new CreditScoreSpecification(600))
      .withCode('PRODUCTION_MINIMUM_CREDIT')
      .withMessage('Production environment requires minimum 600 credit score')
      .withSeverity('ERROR')
      .otherwise()
      .should(new CreditScoreSpecification(550))
      .withCode('STAGING_CREDIT_WARNING')
      .withMessage('Consider improving credit score for production approval')
      .withSeverity('WARNING')
      
      .build();
  }

  async evaluateLoanApplication(
    application: LoanApplication, 
    loanType: string,
    userId: string
  ): Promise<Result<LoanApplication, Error>> {
    try {
      this.logger.info('Evaluating loan application', {
        applicationId: application.id,
        loanType,
        amount: application.amount,
        creditScore: application.creditScore
      });

      const context = PolicyContext.create()
        .withUserId(userId)
        .withRequestId(`loan-${application.id}`)
        .withCorrelationId(`evaluation-${Date.now()}`)
        .withContext({ 
          loanType,
          environment: process.env.NODE_ENV || 'development',
          applicationDate: new Date().toISOString()
        })
        .build();

      const policy = this.createConditionalPolicy(loanType, application.amount);
      const result = await policy.check({ entity: application, context });

      if (result.isFailure()) {
        const violations = result.error.violations;
        
        // Separate errors and warnings
        const errors = violations.filter(v => v.severity === 'ERROR');
        const warnings = violations.filter(v => v.severity === 'WARNING');
        
        this.logger.warn('Loan application policy violations', {
          applicationId: application.id,
          errors: errors.length,
          warnings: warnings.length,
          violations: violations.map(v => ({
            code: v.code,
            message: v.message,
            severity: v.severity
          }))
        });

        // If only warnings, approve with conditions
        if (errors.length === 0 && warnings.length > 0) {
          return Result.success({
            ...application,
            status: 'approved_with_conditions',
            conditions: warnings.map(w => w.message)
          });
        }

        // If errors exist, reject
        const errorMessages = errors.map(e => `${e.code}: ${e.message}`).join(', ');
        return Result.failure(new Error(`Loan application rejected: ${errorMessages}`));
      }

      this.logger.info('Loan application approved', {
        applicationId: application.id,
        loanType,
        amount: application.amount
      });

      return Result.success({
        ...application,
        status: 'approved'
      });

    } catch (error) {
      this.logger.error('Loan evaluation error', {
        applicationId: application.id,
        error: error.message
      });

      return Result.failure(new Error(`Loan evaluation failed: ${error.message}`));
    }
  }

  // Batch evaluation for multiple applications
  async evaluateMultipleApplications(
    applications: LoanApplication[],
    loanType: string,
    userId: string
  ): Promise<Result<LoanApplication[], Error>> {
    try {
      const results = await Promise.allSettled(
        applications.map(app => 
          this.evaluateLoanApplication(app, loanType, userId)
        )
      );

      const approvedApplications: LoanApplication[] = [];
      const rejectedApplications: { application: LoanApplication; reason: string }[] = [];

      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value.isSuccess()) {
          approvedApplications.push(result.value.value!);
        } else {
          const reason = result.status === 'fulfilled' 
            ? result.value.error.message 
            : result.reason;
          rejectedApplications.push({
            application: applications[index],
            reason
          });
        }
      });

      this.logger.info('Batch loan evaluation completed', {
        total: applications.length,
        approved: approvedApplications.length,
        rejected: rejectedApplications.length
      });

      return Result.success(approvedApplications);

    } catch (error) {
      return Result.failure(new Error(`Batch evaluation failed: ${error.message}`));
    }
  }
}
```

## Key Features

- **Conditional Logic**: Dynamic policy execution with `when().then().otherwise()`
- **Policy Groups**: Complex business logic with OR conditions
- **Severity Levels**: ERROR, WARNING, INFO violations with different handling
- **Context-Aware**: Environment-specific policy behavior
- **Batch Processing**: Efficient evaluation of multiple applications
- **Rich Logging**: Comprehensive audit trail and debugging information

## Usage Example

```typescript
// Usage in loan service
export class LoanService {
  constructor(private loanPolicy: LoanApprovalPolicy) {}

  async processLoanApplication(
    application: LoanApplication,
    loanType: string,
    userId: string
  ): Promise<Result<LoanApplication, Error>> {
    try {
      const evaluationResult = await this.loanPolicy.evaluateLoanApplication(
        application,
        loanType,
        userId
      );

      if (evaluationResult.isFailure()) {
        return Result.failure(evaluationResult.error);
      }

      const approvedApplication = evaluationResult.value!;
      
      // Process approved application
      return Result.success(approvedApplication);
    } catch (error) {
      return Result.failure(new Error(`Loan processing failed: ${error.message}`));
    }
  }
}
```

## Common Pitfalls

- **Complex Conditions**: Keep conditional logic readable and well-documented
- **Performance**: Monitor policy evaluation performance for complex conditions
- **Context Dependency**: Ensure context data is consistently provided
- **Testing**: Thoroughly test all conditional paths and edge cases