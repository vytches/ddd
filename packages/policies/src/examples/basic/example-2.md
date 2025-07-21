# Policy Groups with OR Logic

**Version**: 2.0.0  
**Package**: @vytches-ddd/policies  
**Complexity**: beginner  
**Domain**: Financial Services  
**Patterns**: policy-group-pattern, or-logic, alternative-pathways  
**Dependencies**: @vytches-ddd/policies, @vytches-ddd/validation, @vytches-ddd/utils

## Description

Demonstrates Policy Groups with OR logic for creating alternative approval pathways. Shows how multiple different criteria combinations can each independently satisfy business requirements, providing flexibility in complex business rule scenarios.

## Business Context

Loan approval systems often require flexible pathways where different combinations of factors can lead to approval. For example: excellent credit alone, OR good credit with collateral, OR special circumstances. Policy Groups with OR logic enable clean modeling of these alternative approval pathways.

## Code Example

```typescript
// loan-approval-paths.ts
import { PolicyGroup, PolicyBuilder } from '@vytches-ddd/policies';
import { IAsyncSpecification } from '@vytches-ddd/validation';
import { LoanApplication } from '../types';

/**
 * @llm-summary Specification for excellent credit score validation
 * @llm-domain Financial Services
 * @llm-complexity Simple
 *
 * @description
 * Validates that applicant has excellent credit score (800+) for
 * streamlined loan approval without additional requirements.
 *
 * @example
 * ```typescript
 * const spec = new ExcellentCreditSpecification();
 * const isValid = await spec.isSatisfiedByAsync(application);
 * ```
 *
 * @since 2.0.0
 * @public
 */
export class ExcellentCreditSpecification implements IAsyncSpecification<LoanApplication> {
  constructor(private readonly minimumScore: number = 800) {}

  async isSatisfiedByAsync(application: LoanApplication): Promise<boolean> {
    if (!application.creditReport) {
      return false;
    }

    const creditScore = await this.getCreditScore(application.applicantId);
    return creditScore >= this.minimumScore;
  }

  getDescription(): string {
    return `Applicant must have excellent credit score (${this.minimumScore}+)`;
  }

  private async getCreditScore(applicantId: string): Promise<number> {
    // Simulate external credit check
    await new Promise(resolve => setTimeout(resolve, 100));
    return application.creditReport?.score || 0;
  }
}

/**
 * @llm-summary Specification for good credit with collateral validation
 * @llm-domain Financial Services
 * @llm-complexity Medium
 *
 * @description
 * Validates combination of good credit (650+) with sufficient collateral
 * for alternative loan approval pathway.
 *
 * @since 2.0.0
 * @public
 */
export class GoodCreditWithCollateralSpecification implements IAsyncSpecification<LoanApplication> {
  constructor(
    private readonly minimumCreditScore: number = 650,
    private readonly minimumCollateralRatio: number = 1.2
  ) {}

  async isSatisfiedByAsync(application: LoanApplication): Promise<boolean> {
    // Validate credit score
    const creditScore = await this.getCreditScore(application.applicantId);
    if (creditScore < this.minimumCreditScore) {
      return false;
    }

    // Validate collateral value
    if (!application.collateral || application.collateral.length === 0) {
      return false;
    }

    const totalCollateralValue = await this.calculateCollateralValue(application.collateral);
    const requiredCollateral = application.requestedAmount * this.minimumCollateralRatio;

    return totalCollateralValue >= requiredCollateral;
  }

  getDescription(): string {
    return `Good credit (${this.minimumCreditScore}+) with adequate collateral (${this.minimumCollateralRatio}x loan amount)`;
  }

  private async getCreditScore(applicantId: string): Promise<number> {
    await new Promise(resolve => setTimeout(resolve, 100));
    return Math.floor(Math.random() * 200) + 600; // 600-800 range for demo
  }

  private async calculateCollateralValue(collateral: any[]): Promise<number> {
    await new Promise(resolve => setTimeout(resolve, 150));
    return collateral.reduce((total, item) => total + item.appraised_value, 0);
  }
}

/**
 * @llm-summary Policy for loan approval using OR logic with multiple pathways
 * @llm-domain Financial Services
 * @llm-complexity Medium
 *
 * @description
 * Creates a comprehensive loan approval policy using Policy Groups with OR logic
 * to provide multiple independent pathways for application approval.
 *
 * @example
 * ```typescript
 * const policy = createMultiPathLoanApprovalPolicy();
 * const result = await policy.check({ entity: application, context });
 * 
 * if (result.isSuccess()) {
 *   console.log('Approved through one of multiple pathways');
 * }
 * ```
 *
 * @since 2.0.0
 * @public
 */
export function createMultiPathLoanApprovalPolicy() {
  // Path 1: Excellent Credit - Streamlined Approval
  const excellentCreditGroup = PolicyGroup.create<LoanApplication>('excellent-credit-path')
    .withDescription('Streamlined approval for excellent credit applicants')
    .must(new ExcellentCreditSpecification(800))
    .withCode('EXCELLENT_CREDIT_REQUIRED')
    .withMessage('Excellent credit score (800+) required for streamlined approval')
    .withSeverity('ERROR')
    
    .and()
    
    .mustSatisfyRules(rules =>
      rules
        .forProperty('employmentHistory', r => r.minimum(12))
        .withCode('EMPLOYMENT_HISTORY_INSUFFICIENT')
        .withMessage('Minimum 12 months employment history required')
        
        .forProperty('debtToIncomeRatio', r => r.maximum(0.43))
        .withCode('DTI_TOO_HIGH')
        .withMessage('Debt-to-income ratio must not exceed 43%')
    );

  // Path 2: Good Credit with Collateral
  const goodCreditCollateralGroup = PolicyGroup.create<LoanApplication>('good-credit-collateral-path')
    .withDescription('Alternative approval for good credit with adequate collateral')
    .must(new GoodCreditWithCollateralSpecification(650, 1.25))
    .withCode('GOOD_CREDIT_COLLATERAL_REQUIRED')
    .withMessage('Good credit (650+) with 125% collateral coverage required')
    .withSeverity('ERROR')
    
    .and()
    
    .mustSatisfyRules(rules =>
      rules
        .forProperty('employmentHistory', r => r.minimum(18))
        .withCode('EXTENDED_EMPLOYMENT_REQUIRED')
        .withMessage('Minimum 18 months employment history required for collateralized loans')
        
        .forProperty('debtToIncomeRatio', r => r.maximum(0.40))
        .withCode('DTI_LIMIT_COLLATERAL')
        .withMessage('Debt-to-income ratio must not exceed 40% for collateralized loans')
    );

  // Main policy combining approval paths with OR logic
  return PolicyBuilder.create<LoanApplication>()
    .withId('multi-path-loan-approval-policy')
    .withDomain('financial-services')
    .withName('Multi-Path Loan Approval Policy')
    .withDescription('Loan approval with multiple alternative pathways')
    
    // Basic eligibility requirements (applies to all paths)
    .mustSatisfyRules(rules =>
      rules
        .forProperty('requestedAmount', r => r.minimum(10000).maximum(2000000))
        .withCode('LOAN_AMOUNT_OUT_OF_RANGE')
        .withMessage('Loan amount must be between $10,000 and $2,000,000')
        
        .forProperty('applicantAge', r => r.minimum(18))
        .withCode('APPLICANT_TOO_YOUNG')
        .withMessage('Applicant must be at least 18 years old')
    )
    
    .and()
    
    // One of the approval paths must be satisfied (OR logic)
    .shouldSatisfyAny(
      excellentCreditGroup,
      goodCreditCollateralGroup
    )
    .withCode('NO_APPROVAL_PATH_SATISFIED')
    .withMessage('Application must satisfy either excellent credit pathway or good credit with collateral pathway')
    .withSeverity('ERROR')
    
    .build();
}
```

```typescript
// policy-group-usage.ts
import { PolicyContext } from '@vytches-ddd/policies';
import { createMultiPathLoanApprovalPolicy } from './loan-approval-paths';
import { LoanApplication, PolicyResult } from '../types';

/**
 * @llm-summary Example of Policy Group OR logic usage and path analysis
 * @llm-domain Financial Services
 * @llm-complexity Medium
 *
 * @description
 * Demonstrates practical usage of Policy Groups with OR logic including
 * evaluation, path identification, and detailed result analysis.
 *
 * @since 2.0.0
 * @public
 */
export class PolicyGroupORExample {

  /**
   * @llm-summary Evaluates loan application through multiple approval pathways
   * @llm-domain Financial Services
   * @llm-complexity Medium
   *
   * @description
   * Shows how to evaluate applications through Policy Groups with OR logic
   * and identify which specific pathway led to approval or denial.
   *
   * @param application - Loan application to evaluate
   * @param correlationId - Correlation ID for tracking
   * @returns Promise with detailed evaluation result
   *
   * @since 2.0.0
   * @public
   */
  async evaluateWithMultiplePaths(
    application: LoanApplication, 
    correlationId: string
  ): Promise<PolicyResult<LoanApplication>> {
    console.log(`🔍 Evaluating loan application through multiple pathways: ${application.applicantId}`);

    const context = PolicyContext.create()
      .withUserId(application.applicantId)
      .withCorrelationId(correlationId)
      .withRequestId(`loan-${Date.now()}`)
      .withMetadata({
        loanAmount: application.requestedAmount,
        evaluationMode: 'multi-path',
        pathsAvailable: ['excellent-credit', 'good-credit-collateral']
      })
      .build();

    try {
      const policy = createMultiPathLoanApprovalPolicy();
      const result = await policy.check({ entity: application, context });

      if (result.isSuccess()) {
        console.log('✅ Loan application approved through one of the pathways');
        
        // Identify which approval path was used
        const approvalPath = await this.identifySuccessfulPath(application);
        const pathDetails = await this.getPathDetails(approvalPath, application);
        
        return {
          success: true,
          data: application,
          approvalPath,
          pathDetails,
          metadata: {
            policyId: 'multi-path-loan-approval-policy',
            evaluationTime: Date.now() - context.timestamp.getTime(),
            pathsEvaluated: ['excellent-credit-path', 'good-credit-collateral-path'],
            correlationId: context.correlationId
          }
        };
      } else {
        console.log('❌ Loan application denied by all pathways');
        
        // Analyze which paths were attempted and why they failed
        const pathAnalysis = await this.analyzeFailedPaths(application, result.error.violations);
        
        return {
          success: false,
          violations: result.error.violations,
          pathAnalysis,
          recommendations: this.generateRecommendations(pathAnalysis),
          error: 'Application did not satisfy any available approval pathway',
          metadata: {
            policyId: 'multi-path-loan-approval-policy',
            pathsEvaluated: ['excellent-credit-path', 'good-credit-collateral-path'],
            primaryDenialReason: this.identifyPrimaryDenialReason(result.error.violations),
            correlationId: context.correlationId
          }
        };
      }

    } catch (error) {
      console.error('❌ Policy evaluation error:', error);
      
      return {
        success: false,
        error: `Policy evaluation failed: ${error.message}`,
        metadata: {
          errorType: error.constructor.name,
          correlationId: context.correlationId
        }
      };
    }
  }

  /**
   * @llm-summary Demonstrates batch evaluation with path optimization
   * @llm-domain Financial Services
   * @llm-complexity Medium
   *
   * @description
   * Shows how to efficiently evaluate multiple applications and analyze
   * path usage patterns for business intelligence and optimization.
   *
   * @param applications - Array of loan applications to evaluate
   * @param batchId - Batch identifier for tracking
   * @returns Promise with batch evaluation results and path analytics
   *
   * @since 2.0.0
   * @public
   */
  async evaluateBatchWithPathAnalytics(
    applications: LoanApplication[], 
    batchId: string
  ): Promise<{
    results: PolicyResult<LoanApplication>[];
    pathAnalytics: {
      excellentCreditApprovals: number;
      collateralPathApprovals: number;
      totalDenials: number;
      commonDenialReasons: string[];
      pathEfficiency: { [path: string]: number };
    };
  }> {
    console.log(`📊 Evaluating batch of ${applications.length} applications (batch: ${batchId})`);
    
    const policy = createMultiPathLoanApprovalPolicy();
    const results: PolicyResult<LoanApplication>[] = [];
    const pathStats = {
      excellentCredit: { attempts: 0, successes: 0 },
      collateralPath: { attempts: 0, successes: 0 },
      denials: [] as string[]
    };

    // Process applications in parallel
    const evaluationPromises = applications.map(async (application, index) => {
      const context = PolicyContext.create()
        .withUserId(application.applicantId)
        .withCorrelationId(`${batchId}-${index}`)
        .withMetadata({
          batchId,
          batchIndex: index,
          batchSize: applications.length
        })
        .build();

      try {
        const result = await policy.check({ entity: application, context });
        
        if (result.isSuccess()) {
          const approvalPath = await this.identifySuccessfulPath(application);
          
          // Track path usage
          if (approvalPath === 'excellent-credit-path') {
            pathStats.excellentCredit.successes++;
          } else if (approvalPath === 'good-credit-collateral-path') {
            pathStats.collateralPath.successes++;
          }
          
          return {
            success: true,
            data: application,
            approvalPath,
            metadata: {
              batchIndex: index,
              correlationId: context.correlationId
            }
          } as PolicyResult<LoanApplication>;
        } else {
          // Track denial reasons
          const primaryReason = this.identifyPrimaryDenialReason(result.error.violations);
          pathStats.denials.push(primaryReason);
          
          return {
            success: false,
            violations: result.error.violations,
            error: 'Batch evaluation denial',
            metadata: {
              batchIndex: index,
              correlationId: context.correlationId
            }
          } as PolicyResult<LoanApplication>;
        }
      } catch (error) {
        return {
          success: false,
          error: `Batch evaluation error: ${error.message}`,
          metadata: {
            batchIndex: index,
            errorType: error.constructor.name
          }
        } as PolicyResult<LoanApplication>;
      }
    });

    // Count path attempts
    pathStats.excellentCredit.attempts = applications.filter(app => app.creditScore >= 750).length;
    pathStats.collateralPath.attempts = applications.filter(app => app.collateral && app.collateral.length > 0).length;

    const evaluationResults = await Promise.all(evaluationPromises);
    results.push(...evaluationResults);

    // Calculate path analytics
    const pathAnalytics = {
      excellentCreditApprovals: pathStats.excellentCredit.successes,
      collateralPathApprovals: pathStats.collateralPath.successes,
      totalDenials: pathStats.denials.length,
      commonDenialReasons: this.getCommonDenialReasons(pathStats.denials),
      pathEfficiency: {
        'excellent-credit-path': pathStats.excellentCredit.attempts > 0 
          ? pathStats.excellentCredit.successes / pathStats.excellentCredit.attempts 
          : 0,
        'good-credit-collateral-path': pathStats.collateralPath.attempts > 0 
          ? pathStats.collateralPath.successes / pathStats.collateralPath.attempts 
          : 0
      }
    };

    console.log(`✅ Batch evaluation completed: ${results.filter(r => r.success).length}/${applications.length} approved`);
    console.log(`📈 Path efficiency - Excellent Credit: ${(pathAnalytics.pathEfficiency['excellent-credit-path'] * 100).toFixed(1)}%, Collateral: ${(pathAnalytics.pathEfficiency['good-credit-collateral-path'] * 100).toFixed(1)}%`);

    return { results, pathAnalytics };
  }

  // Helper methods for path analysis
  private async identifySuccessfulPath(application: LoanApplication): Promise<string> {
    // Logic to determine which path succeeded based on application characteristics
    if (application.creditScore >= 800 && application.debtToIncomeRatio <= 0.43) {
      return 'excellent-credit-path';
    }
    if (application.collateral && application.collateral.length > 0 && application.creditScore >= 650) {
      return 'good-credit-collateral-path';
    }
    return 'unknown-path';
  }

  private async getPathDetails(path: string, application: LoanApplication): Promise<{
    pathName: string;
    requirements: string[];
    advantages: string[];
  }> {
    const pathDetails = {
      'excellent-credit-path': {
        pathName: 'Excellent Credit Streamlined Approval',
        requirements: ['Credit score 800+', 'Employment history 12+ months', 'DTI ≤ 43%'],
        advantages: ['Fastest processing', 'Best rates', 'Minimal documentation']
      },
      'good-credit-collateral-path': {
        pathName: 'Good Credit with Collateral',
        requirements: ['Credit score 650+', 'Adequate collateral (125%)', 'Employment history 18+ months'],
        advantages: ['Alternative to excellent credit', 'Secured lending rates', 'Flexible terms']
      }
    };

    return pathDetails[path] || {
      pathName: 'Unknown Path',
      requirements: [],
      advantages: []
    };
  }

  private async analyzeFailedPaths(
    application: LoanApplication, 
    violations: any[]
  ): Promise<{ [path: string]: { viable: boolean; failureReasons: string[] } }> {
    return {
      'excellent-credit-path': {
        viable: application.creditScore >= 750, // Close to threshold
        failureReasons: violations
          .filter(v => v.code.includes('EXCELLENT_CREDIT') || v.code.includes('DTI') || v.code.includes('EMPLOYMENT'))
          .map(v => v.message)
      },
      'good-credit-collateral-path': {
        viable: application.creditScore >= 620 && application.collateral !== undefined,
        failureReasons: violations
          .filter(v => v.code.includes('COLLATERAL') || v.code.includes('GOOD_CREDIT'))
          .map(v => v.message)
      }
    };
  }

  private generateRecommendations(pathAnalysis: any): string[] {
    const recommendations = [];
    
    if (pathAnalysis['excellent-credit-path'].viable) {
      recommendations.push('Consider improving credit score to 800+ for excellent credit pathway');
      recommendations.push('Reduce debt-to-income ratio to qualify for streamlined approval');
    }
    
    if (pathAnalysis['good-credit-collateral-path'].viable) {
      recommendations.push('Provide additional collateral to meet 125% coverage requirement');
      recommendations.push('Consider extending employment history before reapplying');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('Focus on improving overall financial profile before reapplying');
      recommendations.push('Consider working with a financial advisor to strengthen application');
    }
    
    return recommendations;
  }

  private identifyPrimaryDenialReason(violations: any[]): string {
    // Find the most critical violation
    const errorViolations = violations.filter(v => v.severity === 'ERROR');
    
    if (errorViolations.length === 0) return 'general-qualification-failure';
    
    const firstError = errorViolations[0];
    
    if (firstError.code.includes('CREDIT')) return 'insufficient-credit-score';
    if (firstError.code.includes('DTI')) return 'debt-to-income-too-high';
    if (firstError.code.includes('COLLATERAL')) return 'insufficient-collateral';
    if (firstError.code.includes('EMPLOYMENT')) return 'employment-history-insufficient';
    
    return 'general-qualification-failure';
  }

  private getCommonDenialReasons(denials: string[]): string[] {
    const reasonCounts: { [reason: string]: number } = {};
    
    denials.forEach(reason => {
      reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
    });
    
    return Object.entries(reasonCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([reason]) => reason);
  }
}
```

## Key Features

- **🔀 OR Logic Groups**: Multiple independent pathways for meeting business requirements
- **📊 Path Analysis**: Detailed tracking of which approval pathways succeed or fail
- **⚡ Flexible Approval**: Different combinations of criteria can each lead to approval
- **📈 Analytics**: Batch processing with path efficiency and usage analytics
- **🎯 Targeted Recommendations**: Specific suggestions based on which pathways were viable

## Policy Group OR Patterns

1. **Alternative Qualification**: Different ways to meet the same business objective
2. **Risk-Based Pathways**: Multiple approval routes based on different risk profiles
3. **Compensating Factors**: Alternative requirements when primary criteria aren't met
4. **Streamlined vs Standard**: Different processing paths based on applicant strength
5. **Market Conditions**: Alternative requirements based on external factors

## Business Benefits

### **Flexible Approval Process**
- **Multiple Success Paths**: Applicants can qualify through different combinations of criteria
- **Risk Mitigation**: Alternative pathways reduce false negatives while maintaining standards
- **Business Intelligence**: Track which pathways are most effective for optimization

### **Clear Decision Making**
- **Path Identification**: Know exactly which criteria combination led to approval
- **Targeted Feedback**: Specific recommendations based on which pathways were viable
- **Efficiency Analytics**: Measure and optimize pathway effectiveness over time

## Common Pitfalls

- **❌ Path Overlap**: Ensure pathways are truly independent and don't conflict
- **❌ Unclear Precedence**: Document which path takes priority when multiple qualify
- **❌ Maintenance Complexity**: Keep OR logic simple and well-documented
- **❌ Testing Gaps**: Test all possible path combinations thoroughly

## Related Examples

- [Example 1: Fluent Policy Builder](./example-1.md) - Basic policy patterns and specifications
- [Use Case: Financial Services Policies](./use-case.md) - Real-world policy applications
- [Intermediate: Advanced Policy Groups](../intermediate/example-1.md) - Complex nested group patterns