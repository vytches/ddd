# Enterprise Resilience System Implementation

**Focus**: Enterprise resilience system with policies, messaging, and comprehensive fault tolerance  
**Domain**: Financial Trading Platform  
**Complexity**: Advanced  
**Dependencies**: @vytches-ddd/resilience, @vytches-ddd/policies, @vytches-ddd/messaging, @vytches-ddd/events, @vytches-ddd/di

## Business Context

This example demonstrates an enterprise-grade resilience system for a financial trading platform that requires:
- Policy-driven resilience configuration based on business rules
- Integration with messaging systems for reliable communication
- Comprehensive fault tolerance across multiple service boundaries
- Real-time monitoring and automated recovery procedures
- Regulatory compliance and audit trail requirements

## Implementation

```typescript
// resilience-policies.ts
import { 
  PolicyBuilder, 
  PolicyContext, 
  ISpecification 
} from '@vytches-ddd/policies';
import { ResilienceConfiguration } from '../types'; // ALWAYS import from app

// Business rule specifications for resilience
class HighValueTransactionSpec implements ISpecification<any> {
  isSatisfiedBy(context: any): boolean {
    return context.transactionAmount > 100000;
  }
}

class CriticalTradingHoursSpec implements ISpecification<any> {
  isSatisfiedBy(context: any): boolean {
    const now = new Date();
    const hour = now.getHours();
    // Critical trading hours: 9:30 AM - 4:00 PM EST
    return hour >= 9.5 && hour <= 16;
  }
}

class RegulatoryReportingSpec implements ISpecification<any> {
  isSatisfiedBy(context: any): boolean {
    return context.requiresRegulatory || context.transactionType === 'large-trader';
  }
}

class CustomerTierSpec implements ISpecification<any> {
  constructor(private tier: 'retail' | 'institutional' | 'prime') {}
  
  isSatisfiedBy(context: any): boolean {
    return context.customerTier === this.tier;
  }
}

// ⭐ Policy-Driven Resilience Configuration
export class ResiliencePolicyEngine {
  private basePolicy = PolicyBuilder.create<any>()
    .withId('base-resilience')
    .withDomain('resilience')
    .withName('Base Resilience Policy')
    .mustSatisfy(
      ctx => ctx.serviceName && ctx.operationName,
      'INVALID_CONTEXT',
      'Valid service and operation context required'
    )
    .build();

  private highValuePolicy = PolicyBuilder.create<any>()
    .withId('high-value-resilience')
    .withDomain('resilience')
    .withName('High Value Transaction Resilience Policy')
    .must(new HighValueTransactionSpec())
    .withCode('HIGH_VALUE_REQUIRED')
    .when(ctx => ctx.transactionAmount > 1000000)
    .then()
    .mustSatisfy(
      ctx => ctx.approvalRequired,
      'APPROVAL_REQUIRED',
      'High value transactions require approval'
    )
    .build();

  private criticalHoursPolicy = PolicyBuilder.create<any>()
    .withId('critical-hours-resilience')
    .withDomain('resilience')
    .withName('Critical Trading Hours Resilience Policy')
    .must(new CriticalTradingHoursSpec())
    .withCode('CRITICAL_HOURS_REQUIRED')
    .build();

  async getResilienceConfiguration(context: any): Promise<ResilienceConfiguration> {
    const policyContext = PolicyContext.create()
      .withUserId(context.userId)
      .withRequestId(context.requestId)
      .withContext(context)
      .build();

    // Evaluate policies to determine resilience configuration
    const isHighValue = await this.evaluatePolicy(this.highValuePolicy, context, policyContext);
    const isCriticalHours = await this.evaluatePolicy(this.criticalHoursPolicy, context, policyContext);
    const isInstitutional = context.customerTier === 'institutional';
    const requiresRegulatory = context.requiresRegulatory;

    return this.buildResilienceConfiguration({
      isHighValue,
      isCriticalHours,
      isInstitutional,
      requiresRegulatory,
      context
    });
  }

  private async evaluatePolicy(policy: any, context: any, policyContext: PolicyContext): Promise<boolean> {
    try {
      const result = await policy.check({ entity: context, context: policyContext });
      return result.isSuccess();
    } catch (error) {
      // Default to safe configuration on policy evaluation error
      return false;
    }
  }

  private buildResilienceConfiguration(params: {
    isHighValue: boolean;
    isCriticalHours: boolean;
    isInstitutional: boolean;
    requiresRegulatory: boolean;
    context: any;
  }): ResilienceConfiguration {
    const { isHighValue, isCriticalHours, isInstitutional, requiresRegulatory } = params;

    // Base configuration
    let config: ResilienceConfiguration = {
      circuitBreaker: {
        failureThreshold: 5,
        recoveryTimeout: 30000,
        monitoringPeriod: 60000,
        successThreshold: 3
      },
      retry: {
        maxAttempts: 3,
        baseDelay: 1000,
        maxDelay: 10000,
        backoffMultiplier: 2,
        jitter: true
      },
      timeout: {
        timeout: 15000
      },
      bulkhead: {
        maxConcurrentCalls: 20,
        maxQueueSize: 100
      }
    };

    // Apply policy-driven modifications
    if (isHighValue || requiresRegulatory) {
      // More conservative for high-value transactions
      config.circuitBreaker.failureThreshold = 3;
      config.circuitBreaker.recoveryTimeout = 60000;
      config.retry.maxAttempts = 5;
      config.retry.baseDelay = 2000;
      config.timeout.timeout = 30000;
      config.bulkhead.maxConcurrentCalls = 10;
    }

    if (isCriticalHours) {
      // More aggressive during critical trading hours
      config.circuitBreaker.failureThreshold = 2;
      config.circuitBreaker.recoveryTimeout = 45000;
      config.retry.maxAttempts = 4;
      config.timeout.timeout = 20000;
    }

    if (isInstitutional) {
      // Higher capacity for institutional clients
      config.bulkhead.maxConcurrentCalls = 50;
      config.bulkhead.maxQueueSize = 200;
    }

    return config;
  }
}

// enterprise-resilience-service.ts
import { 
  ResiliencePolicyBuilder,
  CircuitBreakerState,
  ResilienceMetrics,
  ResilienceContext 
} from '@vytches-ddd/resilience';
import { UnifiedEventBus } from '@vytches-ddd/events';
import { OutboxService } from '@vytches-ddd/messaging';
import { DomainService, ServiceLifetime } from '@vytches-ddd/di';
import { Logger } from '@vytches-ddd/logging';

// ⭐ Enterprise Resilience Service with Policy Integration
@DomainService('enterpriseResilienceService', {
  lifetime: ServiceLifetime.Singleton,
  context: 'TradingPlatform'
})
export class EnterpriseResilienceService {
  private logger = Logger.forContext('EnterpriseResilienceService');
  private policyEngine: ResiliencePolicyEngine;
  private serviceResiliencePolicies: Map<string, any> = new Map();
  private resilienceMetrics: Map<string, ResilienceMetrics> = new Map();
  private failureRecoveryOrchestrator: FailureRecoveryOrchestrator;

  constructor(
    private eventBus: UnifiedEventBus,
    private outboxService: OutboxService
  ) {
    this.policyEngine = new ResiliencePolicyEngine();
    this.failureRecoveryOrchestrator = new FailureRecoveryOrchestrator(
      this.eventBus,
      this.outboxService
    );
    
    this.initializeServicePolicies();
    this.startHealthMonitoring();
  }

  private initializeServicePolicies(): void {
    // Initialize resilience policies for different services
    this.registerServicePolicy('trade-execution', {
      serviceName: 'trade-execution',
      operationTypes: ['execute', 'validate', 'settle'],
      criticality: 'high',
      regulatoryRequirements: ['MiFID', 'Dodd-Frank']
    });

    this.registerServicePolicy('market-data', {
      serviceName: 'market-data',
      operationTypes: ['subscribe', 'fetch', 'stream'],
      criticality: 'critical',
      regulatoryRequirements: ['SEC', 'CFTC']
    });

    this.registerServicePolicy('risk-management', {
      serviceName: 'risk-management',
      operationTypes: ['calculate', 'monitor', 'alert'],
      criticality: 'high',
      regulatoryRequirements: ['Basel III', 'Solvency II']
    });

    this.registerServicePolicy('settlement', {
      serviceName: 'settlement',
      operationTypes: ['process', 'confirm', 'reconcile'],
      criticality: 'medium',
      regulatoryRequirements: ['T+2', 'CSDR']
    });
  }

  private async registerServicePolicy(serviceName: string, config: any): Promise<void> {
    try {
      this.logger.info('Registering service resilience policy', {
        serviceName,
        criticality: config.criticality,
        operationTypes: config.operationTypes
      });

      // Get base resilience configuration from policy engine
      const baseConfig = await this.policyEngine.getResilienceConfiguration({
        serviceName,
        criticality: config.criticality,
        regulatoryRequirements: config.regulatoryRequirements
      });

      // Build resilience policy with messaging integration
      const resiliencePolicy = ResiliencePolicyBuilder.create()
        .withCircuitBreaker({
          ...baseConfig.circuitBreaker,
          name: `${serviceName}-circuit-breaker`,
          onStateChange: (previous, current, reason) => {
            this.handleCircuitBreakerStateChange(serviceName, previous, current, reason);
          }
        })
        .withRetry({
          ...baseConfig.retry,
          onRetryAttempt: (attempt, maxAttempts, error) => {
            this.handleRetryAttempt(serviceName, attempt, maxAttempts, error);
          }
        })
        .withTimeout({
          ...baseConfig.timeout,
          onTimeout: (timeoutMs, context) => {
            this.handleTimeout(serviceName, timeoutMs, context);
          }
        })
        .withBulkhead({
          ...baseConfig.bulkhead,
          onRejection: (reason, context) => {
            this.handleBulkheadRejection(serviceName, reason, context);
          }
        })
        .build();

      this.serviceResiliencePolicies.set(serviceName, resiliencePolicy);

      this.logger.info('Service resilience policy registered', {
        serviceName,
        policyConfiguration: baseConfig
      });

    } catch (error) {
      this.logger.error('Failed to register service resilience policy', {
        serviceName,
        error: error.message
      });
    }
  }

  async executeWithResilience<T>(
    serviceName: string,
    operationName: string,
    operation: () => Promise<T>,
    context: any = {}
  ): Promise<Result<T, Error>> {
    try {
      const resiliencePolicy = this.serviceResiliencePolicies.get(serviceName);
      
      if (!resiliencePolicy) {
        this.logger.warn('No resilience policy found for service', { serviceName });
        return await this.executeDirectly(operation);
      }

      // Get dynamic configuration based on current context
      const dynamicConfig = await this.policyEngine.getResilienceConfiguration({
        serviceName,
        operationName,
        ...context
      });

      // Update policy configuration if needed
      await this.updatePolicyConfiguration(serviceName, dynamicConfig);

      // Execute with resilience
      const resilienceContext: ResilienceContext = {
        serviceName,
        operationName,
        correlationId: context.correlationId || `${serviceName}-${Date.now()}`,
        userId: context.userId,
        metadata: context
      };

      const result = await resiliencePolicy.execute(operation, resilienceContext);

      // Record success metrics
      this.recordSuccessMetrics(serviceName, operationName, resilienceContext);

      return Result.success(result);

    } catch (error) {
      this.logger.error('Resilient execution failed', {
        serviceName,
        operationName,
        error: error.message
      });

      // Record failure metrics
      this.recordFailureMetrics(serviceName, operationName, error);

      // Trigger failure recovery if needed
      await this.failureRecoveryOrchestrator.handleFailure(serviceName, operationName, error, context);

      return Result.failure(error);
    }
  }

  private async executeDirectly<T>(operation: () => Promise<T>): Promise<Result<T, Error>> {
    try {
      const result = await operation();
      return Result.success(result);
    } catch (error) {
      return Result.failure(error);
    }
  }

  private async updatePolicyConfiguration(serviceName: string, config: ResilienceConfiguration): Promise<void> {
    const policy = this.serviceResiliencePolicies.get(serviceName);
    if (policy && policy.updateConfiguration) {
      await policy.updateConfiguration(config);
    }
  }

  private async handleCircuitBreakerStateChange(
    serviceName: string,
    previousState: CircuitBreakerState,
    currentState: CircuitBreakerState,
    reason: string
  ): Promise<void> {
    this.logger.info('Circuit breaker state changed', {
      serviceName,
      previousState,
      currentState,
      reason
    });

    // Publish event for monitoring
    await this.eventBus.publish({
      eventType: 'CircuitBreakerStateChanged',
      payload: {
        serviceName,
        previousState,
        currentState,
        reason,
        timestamp: new Date()
      }
    });

    // Send critical alert if circuit breaker opens
    if (currentState === 'OPEN') {
      await this.outboxService.sendMessage({
        type: 'critical-alert',
        payload: {
          serviceName,
          alertType: 'circuit-breaker-open',
          reason,
          timestamp: new Date()
        },
        priority: 'CRITICAL'
      });
    }
  }

  private async handleRetryAttempt(
    serviceName: string,
    attempt: number,
    maxAttempts: number,
    error: Error
  ): Promise<void> {
    this.logger.warn('Retry attempt', {
      serviceName,
      attempt,
      maxAttempts,
      error: error.message
    });

    // Send alert if max retries reached
    if (attempt === maxAttempts) {
      await this.outboxService.sendMessage({
        type: 'service-alert',
        payload: {
          serviceName,
          alertType: 'max-retries-reached',
          error: error.message,
          timestamp: new Date()
        },
        priority: 'HIGH'
      });
    }
  }

  private async handleTimeout(
    serviceName: string,
    timeoutMs: number,
    context: ResilienceContext
  ): Promise<void> {
    this.logger.warn('Operation timeout', {
      serviceName,
      operationName: context.operationName,
      timeoutMs,
      correlationId: context.correlationId
    });

    // Send timeout alert
    await this.outboxService.sendMessage({
      type: 'service-alert',
      payload: {
        serviceName,
        operationName: context.operationName,
        alertType: 'operation-timeout',
        timeoutMs,
        correlationId: context.correlationId,
        timestamp: new Date()
      },
      priority: 'MEDIUM'
    });
  }

  private async handleBulkheadRejection(
    serviceName: string,
    reason: string,
    context: ResilienceContext
  ): Promise<void> {
    this.logger.warn('Bulkhead rejection', {
      serviceName,
      operationName: context.operationName,
      reason,
      correlationId: context.correlationId
    });

    // Send capacity alert
    await this.outboxService.sendMessage({
      type: 'capacity-alert',
      payload: {
        serviceName,
        operationName: context.operationName,
        alertType: 'bulkhead-rejection',
        reason,
        correlationId: context.correlationId,
        timestamp: new Date()
      },
      priority: 'HIGH'
    });
  }

  private recordSuccessMetrics(
    serviceName: string,
    operationName: string,
    context: ResilienceContext
  ): void {
    const metrics = this.resilienceMetrics.get(serviceName) || this.createEmptyMetrics();
    metrics.successCount++;
    metrics.totalRequests++;
    metrics.lastSuccessTime = new Date();
    this.resilienceMetrics.set(serviceName, metrics);
  }

  private recordFailureMetrics(
    serviceName: string,
    operationName: string,
    error: Error
  ): void {
    const metrics = this.resilienceMetrics.get(serviceName) || this.createEmptyMetrics();
    metrics.failureCount++;
    metrics.totalRequests++;
    metrics.lastFailureTime = new Date();
    metrics.lastFailureReason = error.message;
    this.resilienceMetrics.set(serviceName, metrics);
  }

  private createEmptyMetrics(): ResilienceMetrics {
    return {
      totalRequests: 0,
      successCount: 0,
      failureCount: 0,
      circuitBreakerState: 'CLOSED',
      lastSuccessTime: null,
      lastFailureTime: null,
      lastFailureReason: null
    };
  }

  private startHealthMonitoring(): void {
    // Monitor system health every 10 seconds
    setInterval(async () => {
      await this.publishHealthMetrics();
    }, 10000);
  }

  private async publishHealthMetrics(): Promise<void> {
    const healthReport = {
      timestamp: new Date(),
      services: Object.fromEntries(this.resilienceMetrics.entries()),
      overallHealth: this.calculateOverallHealth()
    };

    await this.eventBus.publish({
      eventType: 'ResilienceHealthReport',
      payload: healthReport
    });
  }

  private calculateOverallHealth(): { status: string; score: number } {
    const services = Array.from(this.resilienceMetrics.values());
    
    if (services.length === 0) {
      return { status: 'unknown', score: 0 };
    }

    const totalRequests = services.reduce((sum, s) => sum + s.totalRequests, 0);
    const totalFailures = services.reduce((sum, s) => sum + s.failureCount, 0);
    const openCircuits = services.filter(s => s.circuitBreakerState === 'OPEN').length;

    let score = 100;
    
    if (totalRequests > 0) {
      const failureRate = totalFailures / totalRequests;
      score -= failureRate * 50;
    }
    
    score -= openCircuits * 25;

    let status = 'healthy';
    if (score < 50) {
      status = 'critical';
    } else if (score < 75) {
      status = 'degraded';
    }

    return { status, score };
  }

  // Public API methods
  async getServiceHealth(serviceName: string): Promise<{
    metrics: ResilienceMetrics;
    policy: any;
    health: string;
  }> {
    const metrics = this.resilienceMetrics.get(serviceName) || this.createEmptyMetrics();
    const policy = this.serviceResiliencePolicies.get(serviceName);
    
    let health = 'unknown';
    if (metrics.totalRequests > 0) {
      const successRate = metrics.successCount / metrics.totalRequests;
      if (successRate > 0.9) {
        health = 'healthy';
      } else if (successRate > 0.7) {
        health = 'degraded';
      } else {
        health = 'unhealthy';
      }
    }

    return { metrics, policy: policy?.getStatus(), health };
  }

  async getAllServicesHealth(): Promise<{ [serviceName: string]: any }> {
    const health: { [serviceName: string]: any } = {};
    
    for (const serviceName of this.serviceResiliencePolicies.keys()) {
      health[serviceName] = await this.getServiceHealth(serviceName);
    }

    return health;
  }

  async forceCircuitBreakerOpen(serviceName: string): Promise<void> {
    const policy = this.serviceResiliencePolicies.get(serviceName);
    if (policy && policy.forceCircuitBreakerOpen) {
      await policy.forceCircuitBreakerOpen();
      
      this.logger.warn('Circuit breaker manually opened', { serviceName });
      
      await this.outboxService.sendMessage({
        type: 'manual-intervention',
        payload: {
          serviceName,
          action: 'circuit-breaker-opened',
          timestamp: new Date()
        },
        priority: 'HIGH'
      });
    }
  }

  async forceCircuitBreakerClosed(serviceName: string): Promise<void> {
    const policy = this.serviceResiliencePolicies.get(serviceName);
    if (policy && policy.forceCircuitBreakerClosed) {
      await policy.forceCircuitBreakerClosed();
      
      this.logger.info('Circuit breaker manually closed', { serviceName });
      
      await this.outboxService.sendMessage({
        type: 'manual-intervention',
        payload: {
          serviceName,
          action: 'circuit-breaker-closed',
          timestamp: new Date()
        },
        priority: 'MEDIUM'
      });
    }
  }
}

// failure-recovery-orchestrator.ts
export class FailureRecoveryOrchestrator {
  private logger = Logger.forContext('FailureRecoveryOrchestrator');
  private recoveryStrategies: Map<string, (serviceName: string, error: Error, context: any) => Promise<void>> = new Map();

  constructor(
    private eventBus: UnifiedEventBus,
    private outboxService: OutboxService
  ) {
    this.initializeRecoveryStrategies();
  }

  private initializeRecoveryStrategies(): void {
    this.recoveryStrategies.set('trade-execution', this.handleTradeExecutionFailure.bind(this));
    this.recoveryStrategies.set('market-data', this.handleMarketDataFailure.bind(this));
    this.recoveryStrategies.set('risk-management', this.handleRiskManagementFailure.bind(this));
    this.recoveryStrategies.set('settlement', this.handleSettlementFailure.bind(this));
  }

  async handleFailure(serviceName: string, operationName: string, error: Error, context: any): Promise<void> {
    try {
      this.logger.error('Handling service failure', {
        serviceName,
        operationName,
        error: error.message,
        context
      });

      // Execute service-specific recovery strategy
      const recoveryStrategy = this.recoveryStrategies.get(serviceName);
      if (recoveryStrategy) {
        await recoveryStrategy(serviceName, error, context);
      } else {
        await this.handleGenericFailure(serviceName, error, context);
      }

      // Publish failure event
      await this.eventBus.publish({
        eventType: 'ServiceFailureHandled',
        payload: {
          serviceName,
          operationName,
          error: error.message,
          recoveryAction: 'automatic',
          timestamp: new Date()
        }
      });

    } catch (recoveryError) {
      this.logger.error('Recovery strategy failed', {
        serviceName,
        operationName,
        originalError: error.message,
        recoveryError: recoveryError.message
      });

      // Escalate to manual intervention
      await this.escalateToManualIntervention(serviceName, error, recoveryError);
    }
  }

  private async handleTradeExecutionFailure(serviceName: string, error: Error, context: any): Promise<void> {
    // Critical service - immediate escalation
    await this.outboxService.sendMessage({
      type: 'critical-failure',
      payload: {
        serviceName,
        error: error.message,
        context,
        requiredAction: 'immediate-review',
        timestamp: new Date()
      },
      priority: 'CRITICAL'
    });
  }

  private async handleMarketDataFailure(serviceName: string, error: Error, context: any): Promise<void> {
    // Attempt to switch to backup market data provider
    await this.outboxService.sendMessage({
      type: 'failover-request',
      payload: {
        serviceName,
        error: error.message,
        context,
        action: 'switch-to-backup-provider',
        timestamp: new Date()
      },
      priority: 'HIGH'
    });
  }

  private async handleRiskManagementFailure(serviceName: string, error: Error, context: any): Promise<void> {
    // Implement risk management failsafe
    await this.outboxService.sendMessage({
      type: 'risk-failsafe',
      payload: {
        serviceName,
        error: error.message,
        context,
        action: 'activate-conservative-limits',
        timestamp: new Date()
      },
      priority: 'HIGH'
    });
  }

  private async handleSettlementFailure(serviceName: string, error: Error, context: any): Promise<void> {
    // Queue for batch processing
    await this.outboxService.sendMessage({
      type: 'settlement-queue',
      payload: {
        serviceName,
        error: error.message,
        context,
        action: 'queue-for-batch-processing',
        timestamp: new Date()
      },
      priority: 'MEDIUM'
    });
  }

  private async handleGenericFailure(serviceName: string, error: Error, context: any): Promise<void> {
    // Generic failure handling
    await this.outboxService.sendMessage({
      type: 'generic-failure',
      payload: {
        serviceName,
        error: error.message,
        context,
        action: 'log-and-monitor',
        timestamp: new Date()
      },
      priority: 'LOW'
    });
  }

  private async escalateToManualIntervention(serviceName: string, originalError: Error, recoveryError: Error): Promise<void> {
    await this.outboxService.sendMessage({
      type: 'manual-intervention-required',
      payload: {
        serviceName,
        originalError: originalError.message,
        recoveryError: recoveryError.message,
        escalationLevel: 'high',
        timestamp: new Date()
      },
      priority: 'CRITICAL'
    });
  }
}
```

## Key Features

- **Policy-Driven Configuration**: Business rules determine resilience behavior
- **Comprehensive Service Integration**: Resilience patterns across all service boundaries
- **Messaging Integration**: Reliable communication through outbox pattern
- **Automated Recovery**: Orchestrated failure recovery with escalation
- **Real-time Monitoring**: Continuous health monitoring and metrics
- **Regulatory Compliance**: Audit trail and compliance-aware resilience
- **Manual Intervention**: Circuit breaker controls and emergency procedures

## Usage Example

```typescript
// Usage in trading service
export class TradingService {
  constructor(
    private resilience: EnterpriseResilienceService,
    private tradeExecutor: TradeExecutor,
    private marketDataService: MarketDataService,
    private riskManager: RiskManager
  ) {}

  async executeTrade(tradeRequest: TradeRequest): Promise<Result<TradeResult, Error>> {
    try {
      // Execute trade with comprehensive resilience
      const result = await this.resilience.executeWithResilience(
        'trade-execution',
        'execute-trade',
        async () => {
          // Get market data with resilience
          const marketData = await this.resilience.executeWithResilience(
            'market-data',
            'get-current-price',
            () => this.marketDataService.getCurrentPrice(tradeRequest.symbol),
            { 
              transactionAmount: tradeRequest.amount,
              customerTier: tradeRequest.customerTier,
              requiresRegulatory: tradeRequest.amount > 1000000
            }
          );

          if (marketData.isFailure()) {
            throw new Error(`Market data unavailable: ${marketData.error.message}`);
          }

          // Validate risk with resilience
          const riskValidation = await this.resilience.executeWithResilience(
            'risk-management',
            'validate-trade-risk',
            () => this.riskManager.validateTrade(tradeRequest, marketData.value),
            {
              transactionAmount: tradeRequest.amount,
              customerTier: tradeRequest.customerTier
            }
          );

          if (riskValidation.isFailure()) {
            throw new Error(`Risk validation failed: ${riskValidation.error.message}`);
          }

          // Execute trade
          return await this.tradeExecutor.execute(tradeRequest, marketData.value);
        },
        {
          transactionAmount: tradeRequest.amount,
          customerTier: tradeRequest.customerTier,
          requiresRegulatory: tradeRequest.amount > 1000000,
          correlationId: tradeRequest.correlationId
        }
      );

      return result;
    } catch (error) {
      return Result.failure(new Error(`Trade execution failed: ${error.message}`));
    }
  }

  async getSystemHealth(): Promise<{
    overallHealth: any;
    services: { [serviceName: string]: any };
  }> {
    const services = await this.resilience.getAllServicesHealth();
    const overallHealth = this.calculateOverallHealth(services);

    return {
      overallHealth,
      services
    };
  }
}
```

## Common Pitfalls

- **Policy Complexity**: Keep resilience policies simple and testable
- **Configuration Drift**: Monitor and validate that policies match business requirements
- **Recovery Cascades**: Ensure recovery strategies don't trigger additional failures
- **Compliance Integration**: Maintain audit trails for all resilience decisions
- **Performance Overhead**: Monitor the impact of comprehensive resilience on system performance
- **Manual Intervention**: Ensure manual controls are properly secured and audited