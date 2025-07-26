# External Service Integration with Policies

**Version**: 2.0.0  
**Package**: @vytches/ddd-policies  
**Complexity**: intermediate  
**Domain**: Service Integration  
**Patterns**: external-service-integration, circuit-breaker, adapter-pattern  
**Dependencies**: @vytches/ddd-policies, @vytches/ddd-resilience,
@vytches/ddd-validation

## Description

Demonstrates integration of policies with external services for real-time
validation, third-party data enrichment, and API-based business rules. Shows how
to handle service failures, implement circuit breakers, and manage external
dependencies reliably.

## Business Context

Modern applications rely on external services for credit checks, fraud
detection, compliance validation, and real-time data. Policies must integrate
seamlessly with these services while handling failures gracefully, implementing
proper retry logic, and maintaining performance under varying service
conditions.

## Code Example

````typescript
// external-service-policies.ts
import { PolicyBuilder, PolicyContext } from '@vytches/ddd-policies';
import { IAsyncSpecification } from '@vytches/ddd-validation';
import { CircuitBreaker, RetryPolicy } from '@vytches/ddd-resilience';
import { Result } from '@vytches/ddd-utils';

/**
 * @llm-summary External credit bureau service integration
 * @llm-domain Financial Services
 * @llm-complexity Medium
 *
 * @description
 * Service adapter for integrating with external credit bureau APIs
 * with resilience patterns and error handling.
 *
 * @example
 * ```typescript
 * const service = new CreditBureauService(config);
 * const report = await service.getCreditReport(applicantId);
 * ```
 *
 * @since 2.0.0
 * @public
 */
export class CreditBureauService {
  private circuitBreaker: CircuitBreaker;
  private retryPolicy: RetryPolicy;

  constructor(
    private config: {
      apiUrl: string;
      apiKey: string;
      timeout: number;
      maxRetries: number;
    }
  ) {
    // Configure circuit breaker
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      resetTimeout: 60000, // 1 minute
      monitoringPeriod: 30000, // 30 seconds
    });

    // Configure retry policy
    this.retryPolicy = new RetryPolicy({
      maxAttempts: config.maxRetries,
      baseDelay: 1000,
      backoff: 'exponential',
      maxDelay: 10000,
    });
  }

  /**
   * @llm-summary Get credit report from external bureau
   * @llm-domain Financial Services
   * @llm-complexity Medium
   *
   * @description
   * Retrieves credit report from external credit bureau with
   * circuit breaker protection and retry logic.
   *
   * @param applicantId - Applicant identifier
   * @param context - Request context for correlation
   * @returns Promise with credit report data
   *
   * @since 2.0.0
   * @public
   */
  async getCreditReport(
    applicantId: string,
    context?: PolicyContext
  ): Promise<{
    score: number;
    report: any;
    timestamp: Date;
    bureau: string;
  }> {
    console.log(`🔍 Fetching credit report for applicant: ${applicantId}`);

    return await this.circuitBreaker.execute(async () => {
      return await this.retryPolicy.execute(async () => {
        const startTime = Date.now();

        try {
          // Simulate external API call
          const response = await this.callCreditBureauAPI(applicantId, context);
          const executionTime = Date.now() - startTime;

          console.log(
            `✅ Credit report retrieved in ${executionTime}ms - Score: ${response.score}`
          );

          return {
            score: response.score,
            report: response.report,
            timestamp: new Date(),
            bureau: 'ExampleBureau',
          };
        } catch (error) {
          console.error(`❌ Credit bureau API call failed: ${error.message}`);
          throw error;
        }
      });
    });
  }

  private async callCreditBureauAPI(
    applicantId: string,
    context?: PolicyContext
  ): Promise<any> {
    // Simulate external API call with potential failures
    await new Promise(resolve =>
      setTimeout(resolve, 200 + Math.random() * 800)
    );

    // Simulate various failure scenarios
    const failureRate = 0.1; // 10% failure rate
    if (Math.random() < failureRate) {
      const errorTypes = [
        'TIMEOUT',
        'SERVICE_UNAVAILABLE',
        'RATE_LIMIT',
        'INVALID_REQUEST',
      ];
      const errorType =
        errorTypes[Math.floor(Math.random() * errorTypes.length)];
      throw new Error(`CREDIT_BUREAU_${errorType}`);
    }

    // Return simulated credit data
    return {
      score: Math.floor(Math.random() * 300) + 500, // 500-800 range
      report: {
        tradelines: Math.floor(Math.random() * 20) + 5,
        inquiries: Math.floor(Math.random() * 10),
        derogatory: Math.floor(Math.random() * 3),
        accountAge: Math.floor(Math.random() * 20) + 5,
      },
    };
  }
}

/**
 * @llm-summary Fraud detection service integration
 * @llm-domain Risk Management
 * @llm-complexity Medium
 *
 * @description
 * Service adapter for integrating with external fraud detection APIs
 * with real-time scoring and risk assessment.
 *
 * @since 2.0.0
 * @public
 */
export class FraudDetectionService {
  private circuitBreaker: CircuitBreaker;

  constructor(private config: { apiUrl: string; apiKey: string }) {
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeout: 30000, // 30 seconds for fraud detection
      monitoringPeriod: 15000, // 15 seconds
    });
  }

  /**
   * @llm-summary Assess fraud risk for transaction or application
   * @llm-domain Risk Management
   * @llm-complexity Medium
   *
   * @description
   * Evaluates fraud risk using external fraud detection service
   * with device fingerprinting and behavioral analysis.
   *
   * @param data - Transaction or application data
   * @param context - Request context with device and session info
   * @returns Promise with fraud assessment result
   *
   * @since 2.0.0
   * @public
   */
  async assessFraudRisk(
    data: any,
    context: PolicyContext
  ): Promise<{
    riskScore: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    reasons: string[];
    deviceFingerprint: string;
    recommendation: 'approve' | 'review' | 'decline';
  }> {
    console.log(
      `🛡️ Assessing fraud risk for request: ${context.correlationId}`
    );

    return await this.circuitBreaker.execute(async () => {
      try {
        // Simulate fraud detection API call
        const response = await this.callFraudDetectionAPI(data, context);

        console.log(
          `🎯 Fraud assessment complete - Risk Level: ${response.riskLevel}`
        );

        return response;
      } catch (error) {
        console.error(`❌ Fraud detection service failed: ${error.message}`);

        // Fallback to conservative risk assessment
        return {
          riskScore: 75,
          riskLevel: 'medium' as const,
          reasons: [
            'External service unavailable - conservative assessment applied',
          ],
          deviceFingerprint: 'fallback',
          recommendation: 'review' as const,
        };
      }
    });
  }

  private async callFraudDetectionAPI(
    data: any,
    context: PolicyContext
  ): Promise<any> {
    // Simulate external fraud detection API
    await new Promise(resolve =>
      setTimeout(resolve, 150 + Math.random() * 300)
    );

    // Simulate failure scenarios
    if (Math.random() < 0.05) {
      // 5% failure rate
      throw new Error('FRAUD_SERVICE_TIMEOUT');
    }

    const riskScore = Math.random() * 100;
    let riskLevel: 'low' | 'medium' | 'high' | 'critical';
    let recommendation: 'approve' | 'review' | 'decline';
    const reasons: string[] = [];

    if (riskScore < 25) {
      riskLevel = 'low';
      recommendation = 'approve';
    } else if (riskScore < 60) {
      riskLevel = 'medium';
      recommendation = 'review';
      reasons.push('Moderate risk indicators detected');
    } else if (riskScore < 85) {
      riskLevel = 'high';
      recommendation = 'review';
      reasons.push(
        'High risk patterns identified',
        'Manual review recommended'
      );
    } else {
      riskLevel = 'critical';
      recommendation = 'decline';
      reasons.push(
        'Critical fraud indicators',
        'Multiple risk factors present'
      );
    }

    return {
      riskScore,
      riskLevel,
      reasons,
      deviceFingerprint: `fp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      recommendation,
    };
  }
}

/**
 * @llm-summary Compliance validation service for regulatory requirements
 * @llm-domain Regulatory Compliance
 * @llm-complexity Medium
 *
 * @description
 * Service integration for real-time compliance validation against
 * regulatory databases and sanction lists.
 *
 * @since 2.0.0
 * @public
 */
export class ComplianceValidationService {
  private sanctionsCache: Map<string, any> = new Map();
  private cacheExpiry: number = 300000; // 5 minutes

  constructor(
    private config: {
      sanctionsApiUrl: string;
      complianceApiUrl: string;
      apiKey: string;
    }
  ) {}

  /**
   * @llm-summary Validate against sanctions and watch lists
   * @llm-domain Regulatory Compliance
   * @llm-complexity Medium
   *
   * @description
   * Checks applicant against international sanctions lists,
   * watch lists, and regulatory databases.
   *
   * @param applicantData - Applicant information for screening
   * @returns Promise with compliance validation result
   *
   * @since 2.0.0
   * @public
   */
  async validateCompliance(applicantData: {
    name: string;
    dateOfBirth: Date;
    address: any;
    ssn?: string;
    passport?: string;
  }): Promise<{
    isCompliant: boolean;
    sanctions: boolean;
    watchList: boolean;
    pep: boolean; // Politically Exposed Person
    riskRating: 'low' | 'medium' | 'high';
    details: string[];
  }> {
    console.log(`⚖️ Validating compliance for: ${applicantData.name}`);

    // Check cache first
    const cacheKey = this.generateCacheKey(applicantData);
    const cached = this.sanctionsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      console.log(
        `💾 Using cached compliance result for ${applicantData.name}`
      );
      return cached.result;
    }

    try {
      // Parallel compliance checks
      const [sanctionsResult, watchListResult, pepResult] = await Promise.all([
        this.checkSanctionsList(applicantData),
        this.checkWatchList(applicantData),
        this.checkPEPStatus(applicantData),
      ]);

      const result = {
        isCompliant: !sanctionsResult.match && !watchListResult.highRisk,
        sanctions: sanctionsResult.match,
        watchList: watchListResult.match,
        pep: pepResult.isPep,
        riskRating: this.calculateRiskRating(
          sanctionsResult,
          watchListResult,
          pepResult
        ),
        details: [
          ...sanctionsResult.details,
          ...watchListResult.details,
          ...pepResult.details,
        ],
      };

      // Cache the result
      this.sanctionsCache.set(cacheKey, {
        result,
        timestamp: Date.now(),
      });

      console.log(
        `✅ Compliance validation complete - Compliant: ${result.isCompliant}`
      );

      return result;
    } catch (error) {
      console.error(`❌ Compliance validation failed: ${error.message}`);

      // Conservative fallback
      return {
        isCompliant: false,
        sanctions: false,
        watchList: false,
        pep: false,
        riskRating: 'high',
        details: ['Compliance service unavailable - manual review required'],
      };
    }
  }

  private async checkSanctionsList(applicantData: any): Promise<any> {
    // Simulate sanctions list check
    await new Promise(resolve =>
      setTimeout(resolve, 100 + Math.random() * 200)
    );

    const match = Math.random() < 0.001; // 0.1% match rate
    return {
      match,
      details: match
        ? ['Potential sanctions list match - manual review required']
        : [],
    };
  }

  private async checkWatchList(applicantData: any): Promise<any> {
    // Simulate watch list check
    await new Promise(resolve => setTimeout(resolve, 80 + Math.random() * 150));

    const match = Math.random() < 0.005; // 0.5% match rate
    const highRisk = match && Math.random() < 0.3; // 30% of matches are high risk

    return {
      match,
      highRisk,
      details: match ? ['Watch list entry found'] : [],
    };
  }

  private async checkPEPStatus(applicantData: any): Promise<any> {
    // Simulate PEP status check
    await new Promise(resolve =>
      setTimeout(resolve, 120 + Math.random() * 180)
    );

    const isPep = Math.random() < 0.002; // 0.2% PEP rate
    return {
      isPep,
      details: isPep ? ['Politically Exposed Person status detected'] : [],
    };
  }

  private calculateRiskRating(
    sanctionsResult: any,
    watchListResult: any,
    pepResult: any
  ): 'low' | 'medium' | 'high' {
    if (sanctionsResult.match) return 'high';
    if (watchListResult.highRisk) return 'high';
    if (pepResult.isPep || watchListResult.match) return 'medium';
    return 'low';
  }

  private generateCacheKey(applicantData: any): string {
    return `compliance_${applicantData.name}_${applicantData.dateOfBirth.getTime()}`;
  }
}
````

```typescript
// external-service-policy-integration.ts
import { PolicyBuilder, PolicyContext } from '@vytches/ddd-policies';
import { IAsyncSpecification } from '@vytches/ddd-validation';
import {
  CreditBureauService,
  FraudDetectionService,
  ComplianceValidationService,
} from './external-service-policies';

/**
 * @llm-summary Comprehensive external service integration specification
 * @llm-domain Financial Services
 * @llm-complexity Complex
 *
 * @description
 * Specification that integrates multiple external services for comprehensive
 * application validation including credit, fraud, and compliance checks.
 *
 * @since 2.0.0
 * @public
 */
export class ExternalServiceValidationSpecification
  implements IAsyncSpecification<LoanApplication>
{
  constructor(
    private creditService: CreditBureauService,
    private fraudService: FraudDetectionService,
    private complianceService: ComplianceValidationService
  ) {}

  async isSatisfiedByAsync(
    application: LoanApplication,
    context?: PolicyContext
  ): Promise<boolean> {
    try {
      console.log(
        `🌐 Starting external service validation for application: ${application.applicantId}`
      );

      // Execute external service calls in parallel for performance
      const [creditResult, fraudResult, complianceResult] = await Promise.all([
        this.creditService.getCreditReport(application.applicantId, context),
        this.fraudService.assessFraudRisk(application, context!),
        this.complianceService.validateCompliance({
          name: application.applicantName,
          dateOfBirth: application.dateOfBirth,
          address: application.address,
          ssn: application.ssn,
        }),
      ]);

      // Evaluate combined results
      const creditPassed = creditResult.score >= 650;
      const fraudPassed = fraudResult.recommendation !== 'decline';
      const compliancePassed = complianceResult.isCompliant;

      const overallPassed = creditPassed && fraudPassed && compliancePassed;

      console.log(`📊 External validation results:`, {
        credit: { score: creditResult.score, passed: creditPassed },
        fraud: { level: fraudResult.riskLevel, passed: fraudPassed },
        compliance: {
          compliant: complianceResult.isCompliant,
          passed: compliancePassed,
        },
        overall: overallPassed,
      });

      // Store results in application context for later use
      if (context) {
        context.metadata = {
          ...context.metadata,
          externalValidation: {
            creditScore: creditResult.score,
            fraudRiskLevel: fraudResult.riskLevel,
            complianceStatus: complianceResult.riskRating,
            validationTimestamp: new Date(),
          },
        };
      }

      return overallPassed;
    } catch (error) {
      console.error(`❌ External service validation failed: ${error.message}`);

      // Decide whether to fail open or closed based on error type
      if (this.isCriticalError(error)) {
        return false; // Fail closed for critical errors
      }

      // Fail open for non-critical errors (e.g., service timeouts)
      console.log(
        `⚠️ Failing open due to non-critical error: ${error.message}`
      );
      return true;
    }
  }

  getDescription(): string {
    return 'Comprehensive external service validation including credit, fraud, and compliance checks';
  }

  private isCriticalError(error: Error): boolean {
    const criticalErrors = [
      'SANCTIONS_MATCH',
      'FRAUD_CRITICAL_RISK',
      'INVALID_CREDENTIALS',
    ];
    return criticalErrors.some(critical => error.message.includes(critical));
  }
}

/**
 * @llm-summary Policy factory for external service integration
 * @llm-domain Service Integration
 * @llm-complexity Expert
 *
 * @description
 * Factory that creates policies with external service integration,
 * fallback strategies, and performance monitoring.
 *
 * @since 2.0.0
 * @public
 */
export class ExternalServicePolicyFactory {
  /**
   * @llm-summary Create loan approval policy with external service validation
   * @llm-domain Financial Services
   * @llm-complexity Expert
   *
   * @description
   * Creates a comprehensive loan approval policy that integrates multiple
   * external services with proper error handling and fallback strategies.
   *
   * @param services - External service dependencies
   * @returns Configured policy with external service integration
   *
   * @since 2.0.0
   * @public
   */
  static createLoanApprovalWithExternalServices(services: {
    creditService: CreditBureauService;
    fraudService: FraudDetectionService;
    complianceService: ComplianceValidationService;
  }) {
    const externalValidation = new ExternalServiceValidationSpecification(
      services.creditService,
      services.fraudService,
      services.complianceService
    );

    return (
      PolicyBuilder.create<LoanApplication>()
        .withId('loan-approval-with-external-services')
        .withDomain('financial-services')
        .withName('Loan Approval with External Service Integration')
        .withDescription(
          'Comprehensive loan approval with credit bureau, fraud detection, and compliance validation'
        )

        // Basic application validation
        .mustSatisfyRules(rules =>
          rules
            .forProperty('applicantAge', r => r.minimum(18).maximum(80))
            .withCode('INVALID_APPLICANT_AGE')
            .withMessage('Applicant age must be between 18 and 80 years')

            .forProperty('requestedAmount', r =>
              r.minimum(1000).maximum(2000000)
            )
            .withCode('INVALID_LOAN_AMOUNT')
            .withMessage('Loan amount must be between $1,000 and $2,000,000')

            .forProperty('annualIncome', r => r.minimum(25000))
            .withCode('INSUFFICIENT_INCOME')
            .withMessage('Minimum annual income of $25,000 required')
        )

        .and()

        // External service validation
        .mustAsync(externalValidation)
        .withCode('EXTERNAL_VALIDATION_FAILED')
        .withMessage('Application failed external validation checks')
        .withSeverity('ERROR')

        .and()

        // Additional business rules based on external data
        .when(async (app, context) => {
          const creditScore =
            context?.metadata?.externalValidation?.creditScore;
          return creditScore && creditScore < 700;
        })
        .then()
        .mustSatisfyRules(rules =>
          rules
            .forProperty('downPaymentPercentage', r => r.minimum(20))
            .withCode('INSUFFICIENT_DOWN_PAYMENT_LOW_CREDIT')
            .withMessage(
              '20% down payment required for credit scores below 700'
            )

            .forProperty('debtToIncomeRatio', r => r.maximum(0.36))
            .withCode('DTI_TOO_HIGH_LOW_CREDIT')
            .withMessage(
              'Debt-to-income ratio must not exceed 36% for credit scores below 700'
            )
        )

        .and()

        // Fraud risk mitigation
        .when(async (app, context) => {
          const fraudRisk =
            context?.metadata?.externalValidation?.fraudRiskLevel;
          return fraudRisk === 'high' || fraudRisk === 'critical';
        })
        .then()
        .mustSatisfyRules(rules =>
          rules
            .forProperty('requestedAmount', r => r.maximum(500000))
            .withCode('AMOUNT_LIMIT_HIGH_FRAUD_RISK')
            .withMessage(
              'Loan amount limited to $500,000 due to high fraud risk'
            )
        )

        .build()
    );
  }

  /**
   * @llm-summary Create policy with service degradation handling
   * @llm-domain Service Integration
   * @llm-complexity Expert
   *
   * @description
   * Creates a policy that gracefully handles external service degradation
   * with fallback validation and manual review triggers.
   *
   * @param services - External service dependencies
   * @returns Policy with degradation handling
   *
   * @since 2.0.0
   * @public
   */
  static createDegradationTolerantPolicy(services: any) {
    return (
      PolicyBuilder.create<LoanApplication>()
        .withId('degradation-tolerant-loan-policy')
        .withDomain('financial-services')
        .withName('Degradation Tolerant Loan Policy')

        // Primary validation with external services
        .mustAsync(async (application, context) => {
          try {
            const externalValidation =
              new ExternalServiceValidationSpecification(
                services.creditService,
                services.fraudService,
                services.complianceService
              );

            return await externalValidation.isSatisfiedByAsync(
              application,
              context
            );
          } catch (error) {
            console.log(
              `⚠️ External services degraded, applying fallback validation`
            );

            // Mark for manual review due to service degradation
            if (context) {
              context.metadata = {
                ...context.metadata,
                requiresManualReview: true,
                degradationReason: 'External services unavailable',
                fallbackApplied: true,
              };
            }

            // Apply conservative fallback validation
            return (
              application.annualIncome >= 50000 &&
              application.debtToIncomeRatio <= 0.28 &&
              application.downPaymentPercentage >= 15
            );
          }
        })
        .withCode('EXTERNAL_OR_FALLBACK_VALIDATION')
        .withMessage(
          'Validation completed using external services or fallback criteria'
        )
        .withSeverity('WARNING')

        .and()

        // Additional constraints when in fallback mode
        .when(
          async (app, context) => context?.metadata?.fallbackApplied === true
        )
        .then()
        .mustSatisfyRules(rules =>
          rules
            .forProperty('requestedAmount', r => r.maximum(750000))
            .withCode('AMOUNT_LIMIT_FALLBACK_MODE')
            .withMessage('Loan amount limited during service degradation')

            .forProperty('loanPurpose', r => r.oneOf(['purchase', 'refinance']))
            .withCode('PURPOSE_LIMIT_FALLBACK_MODE')
            .withMessage(
              'Only purchase and refinance loans allowed during service degradation'
            )
        )

        .build()
    );
  }
}
```

```typescript
// external-service-monitoring.ts
import { PolicyContext } from '@vytches/ddd-policies';

/**
 * @llm-summary External service monitoring and health management
 * @llm-domain Service Integration
 * @llm-complexity Expert
 *
 * @description
 * Comprehensive monitoring system for external service health,
 * performance tracking, and automatic fallback management.
 *
 * @since 2.0.0
 * @public
 */
export class ExternalServiceMonitor {
  private serviceHealth: Map<string, any> = new Map();
  private performanceMetrics: Map<string, any[]> = new Map();

  /**
   * @llm-summary Monitor external service performance and availability
   * @llm-domain Service Integration
   * @llm-complexity Expert
   *
   * @description
   * Tracks service health, response times, and error rates for
   * intelligent fallback decision making.
   *
   * @param serviceName - Name of the service to monitor
   * @param operation - Operation being performed
   * @param executionTime - Time taken for operation
   * @param success - Whether operation succeeded
   * @returns Updated service health status
   *
   * @since 2.0.0
   * @public
   */
  recordServiceMetrics(
    serviceName: string,
    operation: string,
    executionTime: number,
    success: boolean
  ): void {
    const timestamp = Date.now();

    // Initialize service tracking if needed
    if (!this.performanceMetrics.has(serviceName)) {
      this.performanceMetrics.set(serviceName, []);
      this.serviceHealth.set(serviceName, {
        status: 'healthy',
        successRate: 1.0,
        avgResponseTime: 0,
        lastError: null,
        consecutiveFailures: 0,
      });
    }

    // Record metric
    const metrics = this.performanceMetrics.get(serviceName)!;
    metrics.push({ operation, executionTime, success, timestamp });

    // Keep only last 100 metrics
    if (metrics.length > 100) {
      metrics.shift();
    }

    // Update service health
    this.updateServiceHealth(serviceName);

    console.log(
      `📊 Service metrics recorded for ${serviceName}: ${success ? 'SUCCESS' : 'FAILURE'} (${executionTime}ms)`
    );
  }

  /**
   * @llm-summary Get comprehensive service health report
   * @llm-domain Service Integration
   * @llm-complexity Expert
   *
   * @description
   * Provides detailed health status for all monitored external services
   * including recommendations for fallback activation.
   *
   * @returns Complete service health report
   *
   * @since 2.0.0
   * @public
   */
  getServiceHealthReport(): {
    overall: 'healthy' | 'degraded' | 'critical';
    services: { [serviceName: string]: any };
    recommendations: string[];
  } {
    const services: { [serviceName: string]: any } = {};
    let healthyCount = 0;
    let degradedCount = 0;
    let criticalCount = 0;

    // Analyze each service
    this.serviceHealth.forEach((health, serviceName) => {
      const metrics = this.performanceMetrics.get(serviceName) || [];
      const recentMetrics = metrics.filter(
        m => Date.now() - m.timestamp < 300000
      ); // Last 5 minutes

      const serviceReport = {
        status: health.status,
        successRate: health.successRate,
        avgResponseTime: health.avgResponseTime,
        recentOperations: recentMetrics.length,
        consecutiveFailures: health.consecutiveFailures,
        lastError: health.lastError,
        recommendations: this.getServiceRecommendations(
          serviceName,
          health,
          recentMetrics
        ),
      };

      services[serviceName] = serviceReport;

      // Count service status
      if (health.status === 'healthy') healthyCount++;
      else if (health.status === 'degraded') degradedCount++;
      else criticalCount++;
    });

    // Determine overall health
    let overall: 'healthy' | 'degraded' | 'critical';
    if (criticalCount > 0) {
      overall = 'critical';
    } else if (degradedCount > 0) {
      overall = 'degraded';
    } else {
      overall = 'healthy';
    }

    // Generate overall recommendations
    const recommendations = this.getOverallRecommendations(overall, {
      healthy: healthyCount,
      degraded: degradedCount,
      critical: criticalCount,
    });

    console.log(
      `🏥 Service health report: ${overall.toUpperCase()} (${healthyCount} healthy, ${degradedCount} degraded, ${criticalCount} critical)`
    );

    return { overall, services, recommendations };
  }

  /**
   * @llm-summary Determine if fallback should be activated for service
   * @llm-domain Service Integration
   * @llm-complexity Expert
   *
   * @description
   * Analyzes service health metrics to determine if fallback
   * strategies should be activated for reliable operation.
   *
   * @param serviceName - Name of service to check
   * @returns Fallback activation recommendation
   *
   * @since 2.0.0
   * @public
   */
  shouldActivateFallback(serviceName: string): {
    activate: boolean;
    reason: string;
    confidence: number;
    expectedDuration: number;
  } {
    const health = this.serviceHealth.get(serviceName);
    if (!health) {
      return {
        activate: true,
        reason: 'Service not monitored',
        confidence: 1.0,
        expectedDuration: 300000, // 5 minutes default
      };
    }

    const metrics = this.performanceMetrics.get(serviceName) || [];
    const recentMetrics = metrics.filter(
      m => Date.now() - m.timestamp < 600000
    ); // Last 10 minutes

    // Decision criteria
    const successRate = health.successRate;
    const avgResponseTime = health.avgResponseTime;
    const consecutiveFailures = health.consecutiveFailures;
    const recentFailureRate =
      recentMetrics.length > 0
        ? 1 - recentMetrics.filter(m => m.success).length / recentMetrics.length
        : 0;

    let activate = false;
    let reason = '';
    let confidence = 0;

    if (consecutiveFailures >= 3) {
      activate = true;
      reason = 'Multiple consecutive failures detected';
      confidence = 0.9;
    } else if (successRate < 0.8) {
      activate = true;
      reason = 'Success rate below threshold (80%)';
      confidence = 0.8;
    } else if (avgResponseTime > 5000) {
      activate = true;
      reason = 'Response time exceeds threshold (5s)';
      confidence = 0.7;
    } else if (recentFailureRate > 0.5) {
      activate = true;
      reason = 'High recent failure rate';
      confidence = 0.6;
    }

    // Estimate recovery duration based on historical patterns
    const expectedDuration = this.estimateRecoveryDuration(
      serviceName,
      metrics
    );

    if (activate) {
      console.log(
        `⚠️ Fallback activation recommended for ${serviceName}: ${reason}`
      );
    }

    return { activate, reason, confidence, expectedDuration };
  }

  // Private helper methods
  private updateServiceHealth(serviceName: string): void {
    const metrics = this.performanceMetrics.get(serviceName)!;
    const health = this.serviceHealth.get(serviceName)!;

    // Calculate success rate from recent metrics
    const recentMetrics = metrics.filter(
      m => Date.now() - m.timestamp < 300000
    ); // Last 5 minutes
    const successCount = recentMetrics.filter(m => m.success).length;
    const successRate =
      recentMetrics.length > 0 ? successCount / recentMetrics.length : 1.0;

    // Calculate average response time
    const avgResponseTime =
      recentMetrics.length > 0
        ? recentMetrics.reduce((sum, m) => sum + m.executionTime, 0) /
          recentMetrics.length
        : 0;

    // Update consecutive failures
    const lastMetric = metrics[metrics.length - 1];
    if (lastMetric.success) {
      health.consecutiveFailures = 0;
    } else {
      health.consecutiveFailures++;
      health.lastError = {
        timestamp: lastMetric.timestamp,
        operation: lastMetric.operation,
      };
    }

    // Determine status
    let status: 'healthy' | 'degraded' | 'critical';
    if (health.consecutiveFailures >= 5 || successRate < 0.5) {
      status = 'critical';
    } else if (
      health.consecutiveFailures >= 2 ||
      successRate < 0.8 ||
      avgResponseTime > 3000
    ) {
      status = 'degraded';
    } else {
      status = 'healthy';
    }

    // Update health record
    Object.assign(health, {
      status,
      successRate,
      avgResponseTime,
    });
  }

  private getServiceRecommendations(
    serviceName: string,
    health: any,
    recentMetrics: any[]
  ): string[] {
    const recommendations = [];

    if (health.status === 'critical') {
      recommendations.push('Activate fallback immediately');
      recommendations.push('Investigate service connectivity');
    } else if (health.status === 'degraded') {
      recommendations.push('Consider fallback activation');
      recommendations.push('Monitor closely for further degradation');
    }

    if (health.avgResponseTime > 3000) {
      recommendations.push(
        'Response times elevated - check service performance'
      );
    }

    if (health.consecutiveFailures > 0) {
      recommendations.push(
        `${health.consecutiveFailures} consecutive failures - investigate error patterns`
      );
    }

    return recommendations;
  }

  private getOverallRecommendations(overall: string, counts: any): string[] {
    const recommendations = [];

    if (overall === 'critical') {
      recommendations.push(
        'Multiple services critical - activate comprehensive fallback strategy'
      );
      recommendations.push(
        'Consider reducing external service dependencies temporarily'
      );
    } else if (overall === 'degraded') {
      recommendations.push(
        'Some services degraded - monitor closely and prepare fallbacks'
      );
    }

    if (counts.critical + counts.degraded > counts.healthy) {
      recommendations.push(
        'More services unhealthy than healthy - review infrastructure'
      );
    }

    return recommendations;
  }

  private estimateRecoveryDuration(
    serviceName: string,
    metrics: any[]
  ): number {
    // Simple estimation based on historical recovery patterns
    // In production, this would use more sophisticated analysis
    const baseRecovery = 300000; // 5 minutes base
    const healthHistory = metrics.filter(
      m => Date.now() - m.timestamp < 3600000
    ); // Last hour

    if (healthHistory.length < 10) {
      return baseRecovery;
    }

    // Find patterns of service recovery
    const failureRecoveryTimes = [];
    let lastFailureStart = null;

    for (const metric of healthHistory) {
      if (!metric.success && !lastFailureStart) {
        lastFailureStart = metric.timestamp;
      } else if (metric.success && lastFailureStart) {
        failureRecoveryTimes.push(metric.timestamp - lastFailureStart);
        lastFailureStart = null;
      }
    }

    if (failureRecoveryTimes.length > 0) {
      const avgRecoveryTime =
        failureRecoveryTimes.reduce((sum, time) => sum + time, 0) /
        failureRecoveryTimes.length;
      return Math.max(baseRecovery, avgRecoveryTime);
    }

    return baseRecovery;
  }
}
```

## Key Features

- **🌐 External Service Integration**: Seamless integration with credit bureaus,
  fraud detection, and compliance services
- **🛡️ Circuit Breaker Protection**: Automatic protection against cascading
  failures
- **🔄 Intelligent Retry Logic**: Exponential backoff with configurable retry
  policies
- **📊 Performance Monitoring**: Real-time tracking of service health and
  response times
- **⚠️ Fallback Strategies**: Graceful degradation with conservative validation
  when services fail
- **💾 Intelligent Caching**: Performance optimization with appropriate cache
  TTL for different service types

## External Service Patterns

1. **Service Adapter**: Clean abstraction layer for external API integration
2. **Circuit Breaker**: Protection against service failures and cascading errors
3. **Retry with Backoff**: Intelligent retry logic for transient failures
4. **Parallel Execution**: Concurrent service calls for optimal performance
5. **Fallback Strategies**: Conservative validation when external services are
   unavailable

## Integration Benefits

### **Reliability and Resilience**

- **Fault Tolerance**: Automatic handling of external service failures
- **Performance Protection**: Circuit breakers prevent system overload
- **Graceful Degradation**: Continues operation even when external services fail

### **Performance Optimization**

- **Parallel Processing**: Concurrent external service calls
- **Intelligent Caching**: Reduce external API calls with smart cache strategies
- **Response Time Monitoring**: Track and optimize service performance

### **Business Continuity**

- **Fallback Validation**: Conservative business rules when external data
  unavailable
- **Manual Review Triggers**: Automatic escalation when external services fail
- **Service Health Monitoring**: Proactive identification of service issues

## Common Pitfalls

- **❌ Synchronous Blocking**: Always use async patterns for external service
  calls
- **❌ No Timeout Configuration**: Set appropriate timeouts for all external
  calls
- **❌ Missing Fallback Logic**: Always provide fallback validation for critical
  business flows
- **❌ Cache Stampeding**: Implement proper cache warming and refresh strategies

## Related Examples

- [Example 1: Policy Behaviors](./example-1.md) - Cross-cutting concerns and
  retry patterns
- [Example 2: Policy Registry](./example-2.md) - Centralized policy management
- [Advanced: Enterprise Orchestration](../advanced/example-1.md) - Large-scale
  service integration patterns
