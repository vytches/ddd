# Adaptive Resilience with Health Monitoring - NestJS Intermediate Integration

**Version**: 1.0.0 **Package**: @vytches/ddd-resilience **Framework**: NestJS
**Complexity**: Intermediate **Domain**: Health-Aware Service Management
**Patterns**: Adaptive Resilience, Health Monitoring, Performance Optimization
**Dependencies**: @nestjs/common, @nestjs/schedule, @vytches/ddd-resilience

## Description

This example demonstrates intermediate NestJS integration with adaptive
resilience patterns that automatically adjust based on service health
monitoring. The system continuously monitors service performance and adapts
resilience configurations for optimal protection and performance.

## Business Context

A distributed service platform manages multiple microservices with varying
performance characteristics. The system needs intelligent resilience that adapts
to changing service health, automatically tightening protection during
degradation and relaxing constraints during healthy periods for optimal
performance.

## Code Example

```typescript
// adaptive-resilience.service.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  ResiliencePolicyBuilder,
  HealthAwareStrategy,
  AdaptiveTimeoutStrategy,
  SmartCircuitBreaker,
} from '@vytches/ddd-resilience';
import { ServiceRequest, AdaptationMetrics, HealthSnapshot } from './types'; // From your application

@Injectable()
export class AdaptiveResilienceService implements OnModuleInit {
  private readonly logger = new Logger(AdaptiveResilienceService.name);
  private readonly serviceStrategies: Map<string, HealthAwareStrategy>;
  private readonly healthSnapshots: Map<string, HealthSnapshot>;
  private readonly adaptationHistory: AdaptationMetrics[];

  constructor() {
    this.serviceStrategies = new Map();
    this.healthSnapshots = new Map();
    this.adaptationHistory = [];
  }

  async onModuleInit() {
    await this.initializeAdaptiveStrategies();
    this.startHealthMonitoring();
  }

  // ✅ FOCUS: Thin wrapper with adaptive resilience execution
  async executeServiceRequest(
    serviceId: string,
    request: ServiceRequest
  ): Promise<any> {
    const strategy = this.serviceStrategies.get(serviceId);
    if (!strategy) {
      throw new Error(
        `No resilience strategy configured for service: ${serviceId}`
      );
    }

    const executionContext = {
      operationId: `${serviceId}-${request.operationType}`,
      correlationId: request.correlationId || `req-${Date.now()}`,
      startTime: new Date(),
      attempt: 1,
      previousAttempts: [],
      serviceId,
      requestType: request.operationType,
    };

    try {
      // Execute request with adaptive resilience
      const result = await strategy.execute(
        () => this.callExternalService(serviceId, request),
        executionContext
      );

      // Record successful execution for health learning
      await this.recordExecutionSuccess(serviceId, executionContext, result);

      this.logger.debug(
        `Service request successful: ${serviceId}/${request.operationType}`
      );
      return result;
    } catch (error) {
      // Record failure for health learning
      await this.recordExecutionFailure(serviceId, executionContext, error);

      this.logger.error(
        `Service request failed: ${serviceId}/${request.operationType}`,
        error.stack
      );
      throw error;
    }
  }

  async getAdaptiveStatus(): Promise<{
    services: any[];
    globalAdaptation: any;
    recentAdaptations: AdaptationMetrics[];
  }> {
    const services = Array.from(this.serviceStrategies.entries()).map(
      ([serviceId, strategy]) => ({
        serviceId,
        currentHealth: this.healthSnapshots.get(serviceId),
        strategyMetrics: strategy.getMetrics(),
        currentConfiguration: strategy.getCurrentConfiguration(),
        adaptationCount: this.getAdaptationCount(serviceId),
        lastAdaptation: this.getLastAdaptation(serviceId),
      })
    );

    return {
      services,
      globalAdaptation: this.calculateGlobalAdaptationMetrics(),
      recentAdaptations: this.adaptationHistory.slice(-10), // Last 10 adaptations
    };
  }

  // ⭐ FOCUS: Health-based strategy adaptation
  @Cron(CronExpression.EVERY_30_SECONDS)
  private async performHealthBasedAdaptation(): Promise<void> {
    this.logger.debug('Performing health-based resilience adaptation');

    for (const [serviceId, strategy] of this.serviceStrategies) {
      try {
        // Get current health snapshot
        const currentHealth = await this.assessServiceHealth(serviceId);
        const previousHealth = this.healthSnapshots.get(serviceId);

        // Store health snapshot
        this.healthSnapshots.set(serviceId, currentHealth);

        // Determine if adaptation is needed
        if (
          await this.shouldAdaptStrategy(
            serviceId,
            currentHealth,
            previousHealth
          )
        ) {
          const adaptations = await this.generateAdaptations(
            serviceId,
            currentHealth,
            strategy
          );

          if (adaptations.length > 0) {
            await this.applyAdaptations(serviceId, strategy, adaptations);

            // Record adaptation metrics
            this.recordAdaptation(serviceId, currentHealth, adaptations);
          }
        }
      } catch (error) {
        this.logger.error(
          `Health adaptation failed for service ${serviceId}:`,
          error
        );
      }
    }
  }

  private async initializeAdaptiveStrategies(): Promise<void> {
    // User service - balanced adaptation
    const userServiceStrategy = ResiliencePolicyBuilder.createHealthAware()
      .withSmartCircuitBreaker({
        baseFailureThreshold: 5,
        adaptiveThreshold: true,
        healthFactorWeight: 0.3,
        resetTimeout: 30000,
        adaptiveResetTimeout: true,
      })
      .withAdaptiveRetry({
        baseMaxAttempts: 3,
        healthBasedAttempts: true,
        baseDelay: 1000,
        adaptiveDelay: true,
        healthFactorWeight: 0.4,
      })
      .withAdaptiveTimeout({
        baseTimeout: 8000,
        performanceBasedTimeout: true,
        healthFactorWeight: 0.5,
        minTimeout: 2000,
        maxTimeout: 30000,
      })
      .withHealthLearning({
        learningEnabled: true,
        adaptationThreshold: 0.15, // 15% health change triggers adaptation
        stabilizationPeriod: 60000, // 1 minute stabilization
      })
      .build();

    // Payment service - conservative adaptation
    const paymentServiceStrategy = ResiliencePolicyBuilder.createHealthAware()
      .withSmartCircuitBreaker({
        baseFailureThreshold: 3,
        adaptiveThreshold: true,
        healthFactorWeight: 0.4,
        resetTimeout: 60000,
        adaptiveResetTimeout: true,
      })
      .withAdaptiveRetry({
        baseMaxAttempts: 2,
        healthBasedAttempts: true,
        baseDelay: 2000,
        adaptiveDelay: true,
        healthFactorWeight: 0.3,
      })
      .withAdaptiveTimeout({
        baseTimeout: 15000,
        performanceBasedTimeout: true,
        healthFactorWeight: 0.6,
        minTimeout: 10000,
        maxTimeout: 45000,
      })
      .withHealthLearning({
        learningEnabled: true,
        adaptationThreshold: 0.1, // 10% health change (more sensitive)
        stabilizationPeriod: 90000, // 1.5 minute stabilization
      })
      .build();

    // Inventory service - aggressive adaptation
    const inventoryServiceStrategy = ResiliencePolicyBuilder.createHealthAware()
      .withSmartCircuitBreaker({
        baseFailureThreshold: 7,
        adaptiveThreshold: true,
        healthFactorWeight: 0.2,
        resetTimeout: 20000,
        adaptiveResetTimeout: true,
      })
      .withAdaptiveRetry({
        baseMaxAttempts: 4,
        healthBasedAttempts: true,
        baseDelay: 800,
        adaptiveDelay: true,
        healthFactorWeight: 0.5,
      })
      .withAdaptiveTimeout({
        baseTimeout: 6000,
        performanceBasedTimeout: true,
        healthFactorWeight: 0.3,
        minTimeout: 3000,
        maxTimeout: 20000,
      })
      .withHealthLearning({
        learningEnabled: true,
        adaptationThreshold: 0.2, // 20% health change (less sensitive)
        stabilizationPeriod: 45000, // 45 second stabilization
      })
      .build();

    // Register strategies
    this.serviceStrategies.set('user-service', userServiceStrategy);
    this.serviceStrategies.set('payment-service', paymentServiceStrategy);
    this.serviceStrategies.set('inventory-service', inventoryServiceStrategy);

    this.logger.log(
      'Adaptive resilience strategies initialized for 3 services'
    );
  }

  private startHealthMonitoring(): void {
    this.logger.log('Starting continuous health monitoring and adaptation');
  }

  private async assessServiceHealth(
    serviceId: string
  ): Promise<HealthSnapshot> {
    const strategy = this.serviceStrategies.get(serviceId);
    if (!strategy) {
      return this.createUnhealthySnapshot(serviceId);
    }

    const metrics = strategy.getMetrics();
    const startTime = Date.now();

    try {
      // Perform health check call
      await this.performHealthCheck(serviceId);
      const responseTime = Date.now() - startTime;

      // Calculate health metrics
      const totalRequests =
        metrics.successfulExecutions + metrics.failedExecutions;
      const successRate =
        totalRequests > 0 ? metrics.successfulExecutions / totalRequests : 1;
      const errorRate =
        totalRequests > 0 ? metrics.failedExecutions / totalRequests : 0;

      // Calculate composite health score
      const healthScore = this.calculateHealthScore(
        successRate,
        responseTime,
        errorRate
      );

      return {
        serviceId,
        healthScore,
        responseTime,
        errorRate,
        successRate,
        totalRequests,
        timestamp: new Date(),
        metrics: {
          averageResponseTime: metrics.averageExecutionTime || responseTime,
          recentFailures: metrics.failedExecutions,
          circuitBreakerState: metrics.circuitBreakerState || 'CLOSED',
          adaptationCount: this.getAdaptationCount(serviceId),
        },
      };
    } catch (error) {
      this.logger.error(`Health check failed for ${serviceId}:`, error);
      return this.createUnhealthySnapshot(serviceId);
    }
  }

  private calculateHealthScore(
    successRate: number,
    responseTime: number,
    errorRate: number
  ): number {
    // Weighted health score calculation
    const successFactor = successRate * 0.4;
    const responseFactor = Math.max(0, 1 - responseTime / 10000) * 0.3; // 10s baseline
    const errorFactor = (1 - errorRate) * 0.3;

    return Math.max(
      0,
      Math.min(1, successFactor + responseFactor + errorFactor)
    );
  }

  private async shouldAdaptStrategy(
    serviceId: string,
    currentHealth: HealthSnapshot,
    previousHealth?: HealthSnapshot
  ): Promise<boolean> {
    if (!previousHealth) return false;

    const strategy = this.serviceStrategies.get(serviceId);
    const config = strategy?.getHealthLearningConfig();

    if (!config?.learningEnabled) return false;

    // Check if health change exceeds threshold
    const healthChange = Math.abs(
      currentHealth.healthScore - previousHealth.healthScore
    );

    // Check stabilization period
    const timeSinceLastAdaptation = this.getTimeSinceLastAdaptation(serviceId);
    const stabilizationPeriod = config.stabilizationPeriod || 60000;

    return (
      healthChange >= config.adaptationThreshold &&
      timeSinceLastAdaptation >= stabilizationPeriod
    );
  }

  private async generateAdaptations(
    serviceId: string,
    health: HealthSnapshot,
    strategy: HealthAwareStrategy
  ): Promise<any[]> {
    const adaptations = [];
    const currentConfig = strategy.getCurrentConfiguration();

    // Circuit breaker adaptations
    if (health.healthScore < 0.5) {
      // Degraded health - tighten circuit breaker
      adaptations.push({
        type: 'circuit-breaker',
        changes: {
          failureThreshold: Math.max(
            2,
            Math.floor(currentConfig.circuitBreaker.failureThreshold * 0.7)
          ),
          resetTimeout: currentConfig.circuitBreaker.resetTimeout * 1.5,
        },
        reasoning: `Health degraded to ${(health.healthScore * 100).toFixed(1)}% - tightening circuit breaker`,
      });
    } else if (health.healthScore > 0.85) {
      // Good health - relax circuit breaker
      adaptations.push({
        type: 'circuit-breaker',
        changes: {
          failureThreshold: Math.min(
            10,
            Math.floor(currentConfig.circuitBreaker.failureThreshold * 1.2)
          ),
          resetTimeout: Math.max(
            15000,
            currentConfig.circuitBreaker.resetTimeout * 0.8
          ),
        },
        reasoning: `Health improved to ${(health.healthScore * 100).toFixed(1)}% - relaxing circuit breaker`,
      });
    }

    // Timeout adaptations
    if (health.responseTime > currentConfig.timeout.baseTimeout * 1.2) {
      // Slow response - increase timeout
      adaptations.push({
        type: 'timeout',
        changes: {
          defaultTimeout: Math.min(
            currentConfig.timeout.maxTimeout,
            health.responseTime * 1.5
          ),
        },
        reasoning: `Response time increased to ${health.responseTime}ms - adjusting timeout`,
      });
    } else if (health.responseTime < currentConfig.timeout.baseTimeout * 0.6) {
      // Fast response - decrease timeout for better performance
      adaptations.push({
        type: 'timeout',
        changes: {
          defaultTimeout: Math.max(
            currentConfig.timeout.minTimeout,
            health.responseTime * 2
          ),
        },
        reasoning: `Response time improved to ${health.responseTime}ms - optimizing timeout`,
      });
    }

    return adaptations;
  }

  private async applyAdaptations(
    serviceId: string,
    strategy: HealthAwareStrategy,
    adaptations: any[]
  ): Promise<void> {
    for (const adaptation of adaptations) {
      try {
        await strategy.updateConfiguration(adaptation.type, adaptation.changes);
        this.logger.log(
          `Applied ${adaptation.type} adaptation for ${serviceId}: ${adaptation.reasoning}`
        );
      } catch (error) {
        this.logger.error(
          `Failed to apply ${adaptation.type} adaptation for ${serviceId}:`,
          error
        );
      }
    }
  }

  private recordAdaptation(
    serviceId: string,
    health: HealthSnapshot,
    adaptations: any[]
  ): void {
    const adaptationMetric: AdaptationMetrics = {
      serviceId,
      timestamp: new Date(),
      healthScore: health.healthScore,
      adaptations: adaptations.map(a => ({
        type: a.type,
        changes: a.changes,
        reasoning: a.reasoning,
      })),
      triggerReason: this.determineTriggerReason(health, adaptations),
    };

    this.adaptationHistory.push(adaptationMetric);

    // Keep only last 100 adaptations
    if (this.adaptationHistory.length > 100) {
      this.adaptationHistory.shift();
    }
  }

  // Supporting methods (simplified implementations)
  private async callExternalService(
    serviceId: string,
    request: ServiceRequest
  ): Promise<any> {
    // Simulate service call
    const delay = Math.random() * 2000 + 500; // 500-2500ms
    await new Promise(resolve => setTimeout(resolve, delay));

    // Simulate occasional failures
    if (Math.random() < 0.1) {
      // 10% failure rate
      throw new Error(`Service ${serviceId} temporarily unavailable`);
    }

    return {
      success: true,
      serviceId,
      operationType: request.operationType,
      responseTime: delay,
      timestamp: new Date(),
    };
  }

  private async performHealthCheck(serviceId: string): Promise<void> {
    // Simulate health check
    const delay = Math.random() * 1000 + 200; // 200-1200ms
    await new Promise(resolve => setTimeout(resolve, delay));

    if (Math.random() < 0.05) {
      // 5% health check failure rate
      throw new Error(`Health check failed for ${serviceId}`);
    }
  }

  private createUnhealthySnapshot(serviceId: string): HealthSnapshot {
    return {
      serviceId,
      healthScore: 0.0,
      responseTime: 10000,
      errorRate: 1.0,
      successRate: 0.0,
      totalRequests: 0,
      timestamp: new Date(),
      metrics: {
        averageResponseTime: 10000,
        recentFailures: 10,
        circuitBreakerState: 'OPEN',
        adaptationCount: 0,
      },
    };
  }

  private async recordExecutionSuccess(
    serviceId: string,
    context: any,
    result: any
  ): Promise<void> {
    // Record successful execution metrics
  }

  private async recordExecutionFailure(
    serviceId: string,
    context: any,
    error: Error
  ): Promise<void> {
    // Record failed execution metrics
  }

  private getAdaptationCount(serviceId: string): number {
    return this.adaptationHistory.filter(a => a.serviceId === serviceId).length;
  }

  private getLastAdaptation(serviceId: string): Date | undefined {
    const adaptations = this.adaptationHistory
      .filter(a => a.serviceId === serviceId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return adaptations[0]?.timestamp;
  }

  private getTimeSinceLastAdaptation(serviceId: string): number {
    const lastAdaptation = this.getLastAdaptation(serviceId);
    return lastAdaptation ? Date.now() - lastAdaptation.getTime() : Infinity;
  }

  private calculateGlobalAdaptationMetrics(): any {
    const recentAdaptations = this.adaptationHistory.slice(-20);

    return {
      totalAdaptations: this.adaptationHistory.length,
      recentAdaptations: recentAdaptations.length,
      mostAdaptiveService: this.getMostAdaptiveService(),
      averageHealthScore: this.getAverageHealthScore(),
      adaptationFrequency: this.calculateAdaptationFrequency(),
    };
  }

  private getMostAdaptiveService(): string {
    const serviceAdaptations = new Map<string, number>();

    this.adaptationHistory.forEach(a => {
      serviceAdaptations.set(
        a.serviceId,
        (serviceAdaptations.get(a.serviceId) || 0) + 1
      );
    });

    let maxService = '';
    let maxCount = 0;

    serviceAdaptations.forEach((count, service) => {
      if (count > maxCount) {
        maxCount = count;
        maxService = service;
      }
    });

    return maxService;
  }

  private getAverageHealthScore(): number {
    const healthScores = Array.from(this.healthSnapshots.values()).map(
      h => h.healthScore
    );
    return healthScores.length > 0
      ? healthScores.reduce((sum, score) => sum + score, 0) /
          healthScores.length
      : 1.0;
  }

  private calculateAdaptationFrequency(): number {
    if (this.adaptationHistory.length < 2) return 0;

    const timeSpan =
      this.adaptationHistory[
        this.adaptationHistory.length - 1
      ].timestamp.getTime() - this.adaptationHistory[0].timestamp.getTime();

    return this.adaptationHistory.length / (timeSpan / (60 * 1000)); // adaptations per minute
  }

  private determineTriggerReason(
    health: HealthSnapshot,
    adaptations: any[]
  ): string {
    if (health.healthScore < 0.3) return 'Critical health degradation';
    if (health.healthScore < 0.6) return 'Health degradation';
    if (health.healthScore > 0.9) return 'Health improvement';
    if (health.responseTime > 5000) return 'Performance degradation';
    return 'Routine adaptation';
  }
}

// adaptive-resilience.controller.ts
import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AdaptiveResilienceService } from './adaptive-resilience.service';
import { ServiceRequest } from './types'; // From your application

@Controller('adaptive-resilience')
export class AdaptiveResilienceController {
  constructor(
    private readonly adaptiveResilienceService: AdaptiveResilienceService
  ) {}

  @Post(':serviceId/execute')
  @HttpCode(HttpStatus.OK)
  async executeServiceRequest(
    @Param('serviceId') serviceId: string,
    @Body() request: ServiceRequest
  ) {
    return await this.adaptiveResilienceService.executeServiceRequest(
      serviceId,
      request
    );
  }

  @Get('status')
  async getAdaptiveStatus() {
    return await this.adaptiveResilienceService.getAdaptiveStatus();
  }
}

// adaptive-resilience.module.ts
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AdaptiveResilienceController } from './adaptive-resilience.controller';
import { AdaptiveResilienceService } from './adaptive-resilience.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [AdaptiveResilienceController],
  providers: [AdaptiveResilienceService],
  exports: [AdaptiveResilienceService],
})
export class AdaptiveResilienceModule {}
```

## Key Features

- **Health-Aware Adaptation**: Automatically adjusts resilience based on service
  health
- **Smart Circuit Breaker**: Adaptive failure thresholds based on health metrics
- **Performance-Based Timeouts**: Dynamic timeout adjustment based on response
  times
- **Learning System**: Continuous learning from service behavior patterns
- **Stabilization Period**: Prevents over-adaptation with stabilization periods
- **Comprehensive Monitoring**: Detailed adaptation history and metrics

## Adaptive Strategies

### User Service (Balanced)

- **Base Circuit Breaker**: 5 failures threshold, 30s reset
- **Health Factor Weight**: 30% influence on thresholds
- **Adaptation Threshold**: 15% health change triggers adaptation
- **Stabilization**: 1-minute stabilization period

### Payment Service (Conservative)

- **Base Circuit Breaker**: 3 failures threshold, 60s reset
- **Health Factor Weight**: 40% influence on thresholds
- **Adaptation Threshold**: 10% health change (more sensitive)
- **Stabilization**: 1.5-minute stabilization period

### Inventory Service (Aggressive)

- **Base Circuit Breaker**: 7 failures threshold, 20s reset
- **Health Factor Weight**: 20% influence on thresholds
- **Adaptation Threshold**: 20% health change (less sensitive)
- **Stabilization**: 45-second stabilization period

## Adaptation Triggers

1. **Health Degradation**: Tighten circuit breakers and increase timeouts
2. **Health Improvement**: Relax constraints for better performance
3. **Response Time Changes**: Adjust timeouts based on actual performance
4. **Error Rate Changes**: Modify retry attempts and circuit breaker sensitivity

## Usage Example

```typescript
// Execute service request with adaptive resilience
const userRequest: ServiceRequest = {
  operationType: 'get-user-profile',
  correlationId: 'req-12345',
  payload: { userId: 'user-789' },
};

const result = await fetch('/adaptive-resilience/user-service/execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(userRequest),
});

// Get adaptive status
const status = await fetch('/adaptive-resilience/status');
console.log(await status.json());
```

## Common Pitfalls

- **Over-Adaptation**: Too frequent adaptations causing instability
- **Stabilization Too Short**: Not allowing enough time for adaptations to take
  effect
- **Health Calculation Bias**: Overweighting certain health factors
- **Adaptation Conflicts**: Multiple adaptations conflicting with each other

## Related Examples

- [Basic Circuit Breaker](../basic/example-1.md)
- [Composite Strategy](./example-1.md)
- [Advanced VytchesDDD Integration](../advanced/example-1.md)
