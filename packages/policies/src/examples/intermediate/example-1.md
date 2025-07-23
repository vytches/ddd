# Policy Behaviors and Cross-Cutting Concerns

**Version**: 2.0.0  
**Package**: @vytches-ddd/policies  
**Complexity**: intermediate  
**Domain**: Enterprise Applications  
**Patterns**: policy-behavior-pattern, decorator-pattern,
cross-cutting-concerns  
**Dependencies**: @vytches-ddd/policies, @vytches-ddd/resilience,
@vytches-ddd/caching

## Description

Demonstrates Policy Behaviors that wrap business policies with cross-cutting
concerns like retry logic, caching, and temporal validation. Shows how to
compose multiple behaviors for enterprise-grade policy execution with logging,
monitoring, and fault tolerance.

## Business Context

Enterprise applications require policies that are not only correct but also
performant, resilient, and auditable. Policy Behaviors enable separation of
business logic from infrastructure concerns, allowing policies to be enhanced
with retry logic for transient failures, caching for performance, and temporal
constraints for time-sensitive rules.

## Code Example

````typescript
// policy-behaviors.ts
import {
  PolicyRetryBehavior,
  PolicyCachingBehavior,
  PolicyTemporalBehavior,
  BaseBusinessPolicy,
  PolicyRequest,
  PolicyViolation,
} from '@vytches-ddd/policies';
import { Result } from '@vytches-ddd/utils';
import { CreditCheckService, ComplianceService } from '../types';

/**
 * @llm-summary Base credit assessment policy for financial applications
 * @llm-domain Financial Services
 * @llm-complexity Medium
 *
 * @description
 * Core credit assessment policy that validates applicant creditworthiness
 * through external credit bureau services and internal risk models.
 *
 * @example
 * ```typescript
 * const policy = new CreditAssessmentPolicy(creditService);
 * const result = await policy.check(request);
 * ```
 *
 * @since 2.0.0
 * @public
 */
class CreditAssessmentPolicy extends BaseBusinessPolicy<LoanApplication> {
  constructor(private creditService: CreditCheckService) {
    super();
  }

  async check(
    request: PolicyRequest<LoanApplication>
  ): Promise<Result<LoanApplication, PolicyViolation>> {
    const { entity: application } = request;

    try {
      // External credit bureau check
      const creditReport = await this.creditService.getCreditReport(
        application.applicantId
      );

      if (creditReport.score < 650) {
        return this.failure({
          code: 'INSUFFICIENT_CREDIT_SCORE',
          message: `Credit score ${creditReport.score} below minimum requirement of 650`,
          severity: 'ERROR',
          field: 'creditScore',
        });
      }

      // Additional credit validations
      if (creditReport.bankruptcyHistory.length > 0) {
        const recentBankruptcy = creditReport.bankruptcyHistory.some(
          b =>
            new Date(b.discharged) >
            new Date(Date.now() - 7 * 365 * 24 * 60 * 60 * 1000)
        );

        if (recentBankruptcy) {
          return this.failure({
            code: 'RECENT_BANKRUPTCY',
            message: 'Bankruptcy discharge within last 7 years',
            severity: 'ERROR',
            field: 'bankruptcyHistory',
          });
        }
      }

      return this.success(application);
    } catch (error) {
      // External service failures should be retried
      if (
        error.code === 'CREDIT_SERVICE_TIMEOUT' ||
        error.code === 'CREDIT_SERVICE_UNAVAILABLE'
      ) {
        throw error; // Let retry behavior handle it
      }

      return this.failure({
        code: 'CREDIT_CHECK_ERROR',
        message: `Credit check failed: ${error.message}`,
        severity: 'ERROR',
      });
    }
  }
}

/**
 * @llm-summary Compliance validation policy with regulatory requirements
 * @llm-domain Financial Services
 * @llm-complexity Medium
 *
 * @description
 * Validates loan applications against regulatory compliance requirements
 * including TRID, ATR/QM, and fair lending standards.
 *
 * @since 2.0.0
 * @public
 */
class ComplianceValidationPolicy extends BaseBusinessPolicy<LoanApplication> {
  constructor(private complianceService: ComplianceService) {
    super();
  }

  async check(
    request: PolicyRequest<LoanApplication>
  ): Promise<Result<LoanApplication, PolicyViolation>> {
    const { entity: application, context } = request;

    try {
      // ATR/QM compliance check
      const atrResult = await this.complianceService.validateATR(application);
      if (!atrResult.compliant) {
        return this.failure({
          code: 'ATR_COMPLIANCE_VIOLATION',
          message: `ATR compliance failed: ${atrResult.reason}`,
          severity: 'ERROR',
          field: 'atrCompliance',
        });
      }

      // Fair lending analysis
      const fairLendingScore = await this.complianceService.analyzeFairLending(
        application,
        context.metadata?.demographicData
      );

      if (fairLendingScore < 0.8) {
        return this.failure({
          code: 'FAIR_LENDING_CONCERN',
          message: 'Application flagged for potential fair lending concern',
          severity: 'WARNING',
          field: 'fairLendingScore',
        });
      }

      return this.success(application);
    } catch (error) {
      // Compliance service issues are critical and should be retried
      if (error.code === 'COMPLIANCE_SERVICE_ERROR') {
        throw error;
      }

      return this.failure({
        code: 'COMPLIANCE_CHECK_ERROR',
        message: `Compliance validation failed: ${error.message}`,
        severity: 'ERROR',
      });
    }
  }
}
````

````typescript
// enhanced-policy-behaviors.ts
import {
  PolicyRetryBehavior,
  PolicyCachingBehavior,
  PolicyTemporalBehavior,
  PolicyContext,
} from '@vytches-ddd/policies';
import {
  CreditAssessmentPolicy,
  ComplianceValidationPolicy,
} from './policy-behaviors';

/**
 * @llm-summary Policy composition with retry, caching, and temporal behaviors
 * @llm-domain Financial Services
 * @llm-complexity Complex
 *
 * @description
 * Demonstrates how to compose multiple Policy Behaviors to create enterprise-grade
 * policies with retry logic, intelligent caching, and time-based constraints.
 *
 * @example
 * ```typescript
 * const enhancedPolicy = createEnhancedCreditPolicy(services);
 * const result = await enhancedPolicy.check(request);
 * ```
 *
 * @since 2.0.0
 * @public
 */
export function createEnhancedCreditPolicy(services: {
  creditService: CreditCheckService;
  complianceService: ComplianceService;
}) {
  // Base credit assessment policy
  const baseCreditPolicy = new CreditAssessmentPolicy(services.creditService);

  // Layer 1: Retry behavior for external service failures
  const retriedPolicy = PolicyRetryBehavior.create(baseCreditPolicy, {
    maxAttempts: 3,
    baseDelay: 1000,
    backoff: 'exponential',
    maxDelay: 10000,
    shouldRetry: violation => {
      // Retry only for specific external service errors
      return (
        violation.code === 'CREDIT_SERVICE_TIMEOUT' ||
        violation.code === 'CREDIT_SERVICE_UNAVAILABLE' ||
        violation.code === 'CREDIT_SERVICE_RATE_LIMIT'
      );
    },
    onRetry: (attempt, violation) => {
      console.log(
        `🔄 Retrying credit check (attempt ${attempt}): ${violation.message}`
      );
    },
  });

  // Layer 2: Caching behavior for performance optimization
  const cachedPolicy = PolicyCachingBehavior.create(retriedPolicy, {
    ttl: 300000, // 5 minutes cache
    maxSize: 1000,
    keyGenerator: request => {
      const { applicantId, creditCheckDate } = request.entity;
      return `credit_${applicantId}_${creditCheckDate}`;
    },
    namespace: 'credit-assessment',
    onCacheHit: key => {
      console.log(`💾 Cache hit for credit assessment: ${key}`);
    },
    onCacheMiss: key => {
      console.log(`🔍 Cache miss for credit assessment: ${key}`);
    },
  });

  // Layer 3: Temporal behavior for business hours constraints
  const temporalPolicy = PolicyTemporalBehavior.create(cachedPolicy, {
    businessHours: {
      start: '09:00',
      end: '17:00',
      timezone: 'America/New_York',
    },
    workingDays: [1, 2, 3, 4, 5], // Monday to Friday
    duringBusinessHours: cachedPolicy,
    duringAfterHours: PolicyRetryBehavior.create(baseCreditPolicy, {
      maxAttempts: 1, // Reduced retries after hours
      baseDelay: 2000,
    }),
    includeTemporalInfo: true,
  });

  return temporalPolicy;
}

/**
 * @llm-summary Comprehensive policy orchestration with multiple behaviors
 * @llm-domain Financial Services
 * @llm-complexity Expert
 *
 * @description
 * Demonstrates advanced policy behavior composition including performance
 * monitoring, circuit breakers, and adaptive timeout strategies.
 *
 * @since 2.0.0
 * @public
 */
export function createComprehensiveLoanPolicy(services: {
  creditService: CreditCheckService;
  complianceService: ComplianceService;
}) {
  // Credit assessment with comprehensive behaviors
  const creditPolicy = createEnhancedCreditPolicy(services);

  // Compliance policy with different behavior requirements
  const baseCompliancePolicy = new ComplianceValidationPolicy(
    services.complianceService
  );

  // Compliance policies require different caching and retry strategies
  const compliancePolicy = PolicyCachingBehavior.create(
    PolicyRetryBehavior.create(baseCompliancePolicy, {
      maxAttempts: 2, // Compliance checks are more critical
      baseDelay: 500,
      shouldRetry: violation => violation.code === 'COMPLIANCE_SERVICE_ERROR',
    }),
    {
      ttl: 600000, // 10 minutes cache for compliance
      keyGenerator: request => {
        const { applicantId, loanAmount, loanPurpose } = request.entity;
        return `compliance_${applicantId}_${loanAmount}_${loanPurpose}`;
      },
      namespace: 'compliance-validation',
    }
  );

  return {
    creditPolicy,
    compliancePolicy,

    // Combined policy execution with behavior coordination
    async evaluateApplication(
      application: LoanApplication,
      context: PolicyContext
    ): Promise<{
      creditResult: any;
      complianceResult: any;
      overallApproval: boolean;
      performanceMetrics: any;
    }> {
      const startTime = Date.now();
      const request = { entity: application, context };

      try {
        console.log(
          `🔍 Starting comprehensive loan evaluation: ${application.applicantId}`
        );

        // Execute policies in parallel for performance
        const [creditResult, complianceResult] = await Promise.all([
          creditPolicy.check(request),
          compliancePolicy.check(request),
        ]);

        const executionTime = Date.now() - startTime;
        const overallApproval =
          creditResult.isSuccess() && complianceResult.isSuccess();

        console.log(
          `✅ Evaluation completed in ${executionTime}ms - Approval: ${overallApproval}`
        );

        return {
          creditResult,
          complianceResult,
          overallApproval,
          performanceMetrics: {
            executionTime,
            creditCacheHit: creditResult.metadata?.cacheHit || false,
            complianceCacheHit: complianceResult.metadata?.cacheHit || false,
            retryAttempts: {
              credit: creditResult.metadata?.retryAttempts || 0,
              compliance: complianceResult.metadata?.retryAttempts || 0,
            },
          },
        };
      } catch (error) {
        console.error(`❌ Evaluation failed: ${error.message}`);
        throw error;
      }
    },
  };
}
````

```typescript
// policy-behavior-examples.ts
import { PolicyContext } from '@vytches-ddd/policies';
import {
  createEnhancedCreditPolicy,
  createComprehensiveLoanPolicy,
} from './enhanced-policy-behaviors';
import { LoanApplication, PolicyBehaviorResult } from '../types';

/**
 * @llm-summary Comprehensive examples of Policy Behavior usage and monitoring
 * @llm-domain Financial Services
 * @llm-complexity Expert
 *
 * @description
 * Demonstrates practical usage of Policy Behaviors including performance
 * monitoring, behavior analytics, and optimization strategies.
 *
 * @since 2.0.0
 * @public
 */
export class PolicyBehaviorExamples {
  /**
   * @llm-summary Example of behavior composition with performance monitoring
   * @llm-domain Financial Services
   * @llm-complexity Expert
   *
   * @description
   * Shows how to monitor and analyze Policy Behavior performance including
   * cache hit rates, retry patterns, and execution timing.
   *
   * @param application - Loan application to evaluate
   * @param services - External service dependencies
   * @returns Promise with detailed behavior analytics
   *
   * @since 2.0.0
   * @public
   */
  async demonstrateBehaviorMonitoring(
    application: LoanApplication,
    services: any
  ): Promise<PolicyBehaviorResult> {
    console.log(
      `📊 Demonstrating policy behavior monitoring: ${application.applicantId}`
    );

    const context = PolicyContext.create()
      .withUserId(application.applicantId)
      .withCorrelationId(`behavior-demo-${Date.now()}`)
      .withMetadata({
        evaluationType: 'behavior-monitoring',
        timestamp: new Date().toISOString(),
      })
      .build();

    const comprehensivePolicy = createComprehensiveLoanPolicy(services);
    const startTime = Date.now();

    try {
      // Execute policy with comprehensive behavior monitoring
      const result = await comprehensivePolicy.evaluateApplication(
        application,
        context
      );

      const behaviorAnalytics = {
        totalExecutionTime: Date.now() - startTime,
        cacheEfficiency: this.calculateCacheEfficiency(
          result.performanceMetrics
        ),
        retryAnalysis: this.analyzeRetryPatterns(result.performanceMetrics),
        temporalImpact: this.analyzeTemporalImpact(context),
        behaviorOptimizations: this.suggestOptimizations(
          result.performanceMetrics
        ),
      };

      console.log(
        `✅ Behavior monitoring completed - Cache efficiency: ${behaviorAnalytics.cacheEfficiency.toFixed(2)}%`
      );

      return {
        success: result.overallApproval,
        data: application,
        policyResults: {
          credit: result.creditResult,
          compliance: result.complianceResult,
        },
        behaviorAnalytics,
        metadata: {
          correlationId: context.correlationId,
          behaviorsUsed: ['retry', 'caching', 'temporal'],
          performanceScore: this.calculatePerformanceScore(behaviorAnalytics),
        },
      };
    } catch (error) {
      console.error(`❌ Behavior monitoring failed: ${error.message}`);

      return {
        success: false,
        error: `Policy behavior monitoring failed: ${error.message}`,
        behaviorAnalytics: {
          totalExecutionTime: Date.now() - startTime,
          errorType: error.constructor.name,
          failurePoint: 'policy-execution',
        },
      };
    }
  }

  /**
   * @llm-summary Example of adaptive behavior configuration
   * @llm-domain Financial Services
   * @llm-complexity Expert
   *
   * @description
   * Demonstrates how to dynamically adjust Policy Behavior configuration
   * based on system performance, load conditions, and business requirements.
   *
   * @param applications - Batch of applications to process
   * @param systemLoad - Current system load metrics
   * @returns Promise with adaptive behavior results
   *
   * @since 2.0.0
   * @public
   */
  async demonstrateAdaptiveBehaviors(
    applications: LoanApplication[],
    systemLoad: {
      cpuUtilization: number;
      memoryUsage: number;
      externalServiceLatency: number;
    }
  ): Promise<{
    results: PolicyBehaviorResult[];
    adaptiveConfiguration: any;
    performanceSummary: any;
  }> {
    console.log(
      `🎛️ Demonstrating adaptive behavior configuration for ${applications.length} applications`
    );

    // Adapt behavior configuration based on system conditions
    const adaptiveConfig = this.calculateAdaptiveConfiguration(systemLoad);
    console.log(
      `📈 Adaptive config - Cache TTL: ${adaptiveConfig.cacheTTL}ms, Max retries: ${adaptiveConfig.maxRetries}`
    );

    const results: PolicyBehaviorResult[] = [];
    const performanceMetrics = {
      totalExecutionTime: 0,
      cacheHitCount: 0,
      retryCount: 0,
      errorCount: 0,
    };

    // Process applications with adaptive configuration
    for (let i = 0; i < applications.length; i++) {
      const application = applications[i];
      const startTime = Date.now();

      try {
        const context = PolicyContext.create()
          .withUserId(application.applicantId)
          .withCorrelationId(`adaptive-${i}-${Date.now()}`)
          .withMetadata({
            batchIndex: i,
            batchSize: applications.length,
            adaptiveConfig: adaptiveConfig,
          })
          .build();

        // Create policy with adaptive configuration
        const adaptivePolicy = this.createAdaptivePolicy(adaptiveConfig);
        const result = await adaptivePolicy.check({
          entity: application,
          context,
        });

        const executionTime = Date.now() - startTime;
        performanceMetrics.totalExecutionTime += executionTime;

        if (result.metadata?.cacheHit) performanceMetrics.cacheHitCount++;
        if (result.metadata?.retryAttempts)
          performanceMetrics.retryCount += result.metadata.retryAttempts;

        results.push({
          success: result.isSuccess(),
          data: application,
          executionTime,
          adaptiveFeatures: {
            cacheUsed: result.metadata?.cacheHit || false,
            retriesPerformed: result.metadata?.retryAttempts || 0,
            configurationApplied: adaptiveConfig,
          },
          metadata: {
            batchIndex: i,
            correlationId: context.correlationId,
          },
        });

        console.log(
          `  ✅ Application ${i + 1}/${applications.length} processed (${executionTime}ms)`
        );
      } catch (error) {
        performanceMetrics.errorCount++;
        console.error(`  ❌ Application ${i + 1} failed: ${error.message}`);

        results.push({
          success: false,
          error: error.message,
          executionTime: Date.now() - startTime,
          metadata: {
            batchIndex: i,
            errorType: error.constructor.name,
          },
        });
      }
    }

    const performanceSummary = {
      ...performanceMetrics,
      averageExecutionTime:
        performanceMetrics.totalExecutionTime / applications.length,
      cacheHitRate: performanceMetrics.cacheHitCount / applications.length,
      errorRate: performanceMetrics.errorCount / applications.length,
      totalProcessed: applications.length,
    };

    console.log(`✅ Adaptive behavior processing completed`);
    console.log(
      `📊 Performance summary - Avg time: ${performanceSummary.averageExecutionTime.toFixed(2)}ms, Cache hit rate: ${(performanceSummary.cacheHitRate * 100).toFixed(1)}%`
    );

    return {
      results,
      adaptiveConfiguration: adaptiveConfig,
      performanceSummary,
    };
  }

  // Helper methods for behavior analysis and optimization
  private calculateCacheEfficiency(metrics: any): number {
    const totalRequests = 2; // Credit + Compliance
    const cacheHits =
      (metrics.creditCacheHit ? 1 : 0) + (metrics.complianceCacheHit ? 1 : 0);
    return (cacheHits / totalRequests) * 100;
  }

  private analyzeRetryPatterns(metrics: any): {
    totalRetries: number;
    retryDistribution: { [policy: string]: number };
    retryEfficiency: number;
  } {
    const totalRetries =
      metrics.retryAttempts.credit + metrics.retryAttempts.compliance;

    return {
      totalRetries,
      retryDistribution: {
        credit: metrics.retryAttempts.credit,
        compliance: metrics.retryAttempts.compliance,
      },
      retryEfficiency: totalRetries > 0 ? 1 - totalRetries / 6 : 1, // Max 3 retries per policy
    };
  }

  private analyzeTemporalImpact(context: PolicyContext): {
    isBusinessHours: boolean;
    executionMode: string;
    timeBasedOptimizations: string[];
  } {
    const now = new Date();
    const hour = now.getHours();
    const isBusinessHours = hour >= 9 && hour <= 17;

    return {
      isBusinessHours,
      executionMode: isBusinessHours ? 'business-hours' : 'after-hours',
      timeBasedOptimizations: isBusinessHours
        ? ['full-caching', 'aggressive-retries', 'parallel-execution']
        : ['reduced-retries', 'essential-caching', 'sequential-execution'],
    };
  }

  private suggestOptimizations(metrics: any): string[] {
    const optimizations = [];

    if (
      metrics.creditCacheHit === false &&
      metrics.complianceCacheHit === false
    ) {
      optimizations.push('Consider increasing cache TTL for better hit rates');
    }

    if (
      metrics.retryAttempts.credit > 1 ||
      metrics.retryAttempts.compliance > 1
    ) {
      optimizations.push(
        'High retry rates detected - investigate service reliability'
      );
    }

    if (metrics.executionTime > 5000) {
      optimizations.push(
        'Consider parallel policy execution for better performance'
      );
    }

    return optimizations;
  }

  private calculatePerformanceScore(analytics: any): number {
    let score = 100;

    // Penalty for slow execution
    if (analytics.totalExecutionTime > 3000) score -= 20;
    if (analytics.totalExecutionTime > 5000) score -= 20;

    // Bonus for cache efficiency
    score += analytics.cacheEfficiency * 0.2;

    // Penalty for retry inefficiency
    if (analytics.retryAnalysis.retryEfficiency < 0.8) score -= 15;

    return Math.max(0, Math.min(100, score));
  }

  private calculateAdaptiveConfiguration(systemLoad: any): {
    cacheTTL: number;
    maxRetries: number;
    timeoutMs: number;
    parallelExecution: boolean;
  } {
    const baseConfig = {
      cacheTTL: 300000, // 5 minutes
      maxRetries: 3,
      timeoutMs: 10000,
      parallelExecution: true,
    };

    // Adjust based on system load
    if (systemLoad.cpuUtilization > 0.8) {
      baseConfig.cacheTTL *= 2; // Longer cache retention under high load
      baseConfig.maxRetries = Math.max(1, baseConfig.maxRetries - 1);
      baseConfig.parallelExecution = false;
    }

    if (systemLoad.memoryUsage > 0.85) {
      baseConfig.cacheTTL = Math.min(baseConfig.cacheTTL, 60000); // Shorter cache under memory pressure
    }

    if (systemLoad.externalServiceLatency > 2000) {
      baseConfig.maxRetries = Math.min(2, baseConfig.maxRetries);
      baseConfig.timeoutMs *= 1.5; // Longer timeouts for slow services
    }

    return baseConfig;
  }

  private createAdaptivePolicy(config: any): any {
    // Simulate creating a policy with adaptive configuration
    return {
      check: async (request: any) => {
        await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));

        return {
          isSuccess: () => Math.random() > 0.1, // 90% success rate
          metadata: {
            cacheHit: Math.random() > 0.5,
            retryAttempts:
              Math.random() > 0.8
                ? Math.floor(Math.random() * config.maxRetries)
                : 0,
            configUsed: config,
          },
        };
      },
    };
  }
}
```

## Key Features

- **🔄 Retry Behaviors**: Intelligent retry logic for transient failures with
  exponential backoff
- **💾 Caching Behaviors**: Performance optimization with TTL-based caching and
  intelligent key generation
- **⏰ Temporal Behaviors**: Time-based policy execution with business hours and
  working day constraints
- **📊 Performance Monitoring**: Comprehensive analytics for behavior
  effectiveness and optimization
- **🎛️ Adaptive Configuration**: Dynamic behavior adjustment based on system
  load and performance metrics
- **🔗 Behavior Composition**: Layered behavior patterns for complex enterprise
  requirements

## Policy Behavior Patterns

1. **Layered Composition**: Multiple behaviors stacked for comprehensive
   cross-cutting concerns
2. **Conditional Behaviors**: Different behavior strategies based on context and
   conditions
3. **Performance Optimization**: Caching and retry strategies for external
   service dependencies
4. **Temporal Constraints**: Time-based policy execution for business rule
   compliance
5. **Adaptive Strategies**: Dynamic behavior configuration based on system
   performance

## Enterprise Benefits

### **Resilience and Reliability**

- **Fault Tolerance**: Automatic retry for transient failures
- **Circuit Breaker**: Protection against cascading failures
- **Graceful Degradation**: Fallback strategies for service unavailability

### **Performance Optimization**

- **Intelligent Caching**: Reduce external service calls with smart cache
  strategies
- **Parallel Execution**: Concurrent policy evaluation for improved throughput
- **Adaptive Timeouts**: Dynamic timeout adjustment based on service performance

### **Monitoring and Observability**

- **Behavior Analytics**: Detailed metrics on retry patterns, cache efficiency,
  and execution timing
- **Performance Tracking**: Comprehensive monitoring of policy behavior
  effectiveness
- **Optimization Insights**: Data-driven recommendations for behavior
  configuration tuning

## Common Pitfalls

- **❌ Over-Caching**: Ensure cache TTL aligns with business rule change
  frequency
- **❌ Retry Storms**: Implement proper backoff and circuit breaker patterns
- **❌ Behavior Conflicts**: Test behavior composition thoroughly for unexpected
  interactions
- **❌ Memory Leaks**: Monitor cache size and implement proper eviction policies

## Related Examples

- [Example 1: Fluent Policy Builder](../basic/example-1.md) - Core policy
  patterns and foundations
- [Example 2: Policy Groups with OR Logic](../basic/example-2.md) - Complex
  policy group compositions
- [Advanced: Enterprise Policy Orchestration](../advanced/example-1.md) -
  Large-scale policy system architecture
