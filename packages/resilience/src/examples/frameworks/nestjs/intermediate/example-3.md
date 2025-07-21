# Performance-Driven Resilience Strategy - NestJS Intermediate Integration

**Version**: 1.0.0
**Package**: @vytches-ddd/resilience
**Framework**: NestJS
**Complexity**: Intermediate
**Domain**: Performance-Optimized Service Platform
**Patterns**: Performance Monitoring, Dynamic Adaptation, Resource Optimization
**Dependencies**: @nestjs/common, @nestjs/schedule, @vytches-ddd/resilience

## Description

This example demonstrates intermediate NestJS integration with performance-driven resilience patterns that optimize both protection and performance. The system monitors performance metrics and automatically adjusts resilience configurations to maintain optimal balance between fault tolerance and system performance.

## Business Context

A high-throughput e-commerce platform serves millions of requests daily with strict performance requirements. The system needs intelligent resilience that optimizes for performance while maintaining protection, automatically adjusting patterns based on real-time performance data and load conditions.

## Code Example

```typescript
// performance-resilience.service.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { 
  PerformanceOptimizedStrategy,
  LoadAwareCircuitBreaker,
  PerformanceBasedTimeout,
  DynamicRetryStrategy 
} from '@vytches-ddd/resilience';
import { PerformanceRequest, PerformanceMetrics, LoadCondition } from './types'; // From your application

@Injectable()
export class PerformanceResilienceService implements OnModuleInit {
  private readonly logger = new Logger(PerformanceResilienceService.name);
  private readonly serviceStrategies: Map<string, PerformanceOptimizedStrategy>;
  private readonly performanceMetrics: Map<string, PerformanceMetrics>;
  private readonly loadConditions: Map<string, LoadCondition>;
  private performanceHistory: Array<{
    timestamp: Date;
    serviceId: string;
    metrics: PerformanceMetrics;
  }>;

  constructor() {
    this.serviceStrategies = new Map();
    this.performanceMetrics = new Map();
    this.loadConditions = new Map();
    this.performanceHistory = [];
  }

  async onModuleInit() {
    await this.initializePerformanceStrategies();
    this.startPerformanceMonitoring();
  }

  // ✅ FOCUS: Thin wrapper with performance-optimized execution
  async executePerformanceOptimizedRequest(
    serviceId: string,
    request: PerformanceRequest
  ): Promise<any> {
    const strategy = this.serviceStrategies.get(serviceId);
    if (!strategy) {
      throw new Error(`No performance strategy configured for service: ${serviceId}`);
    }

    const executionContext = {
      operationId: `perf-${serviceId}-${request.operationType}`,
      correlationId: request.correlationId || `perf-${Date.now()}`,
      startTime: new Date(),
      attempt: 1,
      previousAttempts: [],
      performancePriority: request.performancePriority || 'normal',
      expectedDuration: request.expectedDuration,
      serviceId,
      loadCondition: this.loadConditions.get(serviceId) || 'normal'
    };

    const startTime = performance.now();

    try {
      // Execute with performance-optimized resilience
      const result = await strategy.execute(
        () => this.callServiceWithPerformanceTracking(serviceId, request),
        executionContext
      );

      const executionTime = performance.now() - startTime;
      
      // Record performance metrics
      await this.recordPerformanceMetrics(serviceId, executionTime, true, request);
      
      this.logger.debug(
        `Performance request completed: ${serviceId}/${request.operationType} in ${executionTime.toFixed(2)}ms`
      );
      
      return result;

    } catch (error) {
      const executionTime = performance.now() - startTime;
      
      // Record failure metrics
      await this.recordPerformanceMetrics(serviceId, executionTime, false, request, error);
      
      this.logger.error(
        `Performance request failed: ${serviceId}/${request.operationType} after ${executionTime.toFixed(2)}ms`,
        error.stack
      );
      
      throw error;
    }
  }

  async getPerformanceStatus(): Promise<{
    services: any[];
    globalPerformance: any;
    optimizations: any[];
  }> {
    const services = Array.from(this.serviceStrategies.entries()).map(([serviceId, strategy]) => ({
      serviceId,
      currentMetrics: this.performanceMetrics.get(serviceId),
      loadCondition: this.loadConditions.get(serviceId),
      strategyConfiguration: strategy.getCurrentConfiguration(),
      performanceScore: this.calculatePerformanceScore(serviceId),
      optimizationStatus: strategy.getOptimizationStatus()
    }));

    return {
      services,
      globalPerformance: this.calculateGlobalPerformance(),
      optimizations: this.getRecentOptimizations()
    };
  }

  // ⭐ FOCUS: Performance-based strategy optimization
  @Cron(CronExpression.EVERY_10_SECONDS)
  private async performPerformanceOptimization(): Promise<void> {
    this.logger.debug('Performing performance-based resilience optimization');

    for (const [serviceId, strategy] of this.serviceStrategies) {
      try {
        // Assess current performance
        const currentMetrics = await this.assessServicePerformance(serviceId);
        const loadCondition = await this.assessLoadCondition(serviceId);
        
        // Store current metrics
        this.performanceMetrics.set(serviceId, currentMetrics);
        this.loadConditions.set(serviceId, loadCondition);
        
        // Record in history
        this.performanceHistory.push({
          timestamp: new Date(),
          serviceId,
          metrics: currentMetrics
        });
        
        // Keep only recent history (last hour)
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        this.performanceHistory = this.performanceHistory.filter(
          entry => entry.timestamp > oneHourAgo
        );

        // Determine optimizations needed
        const optimizations = await this.determinePerformanceOptimizations(
          serviceId, 
          currentMetrics, 
          loadCondition
        );

        if (optimizations.length > 0) {
          await this.applyPerformanceOptimizations(serviceId, strategy, optimizations);
        }

      } catch (error) {
        this.logger.error(`Performance optimization failed for service ${serviceId}:`, error);
      }
    }
  }

  private async initializePerformanceStrategies(): Promise<void> {
    // API Gateway service - ultra-high performance
    const apiGatewayStrategy = new PerformanceOptimizedStrategy({
      serviceId: 'api-gateway',
      performanceProfile: 'ultra-high',
      circuitBreaker: new LoadAwareCircuitBreaker({
        baseFailureThreshold: 10,
        loadBasedThreshold: true,
        performanceWeight: 0.6,
        resetTimeout: 15000,
        fastRecovery: true
      }),
      retry: new DynamicRetryStrategy({
        baseMaxAttempts: 2,
        performanceBasedAttempts: true,
        maxLatencyBudget: 500, // 500ms max total retry time
        fastFailEnabled: true
      }),
      timeout: new PerformanceBasedTimeout({
        baseTimeout: 2000,
        performanceAdaptive: true,
        percentileTarget: 95, // P95 response time target
        minTimeout: 500,
        maxTimeout: 5000
      }),
      performanceTargets: {
        p95ResponseTime: 200,
        p99ResponseTime: 500,
        errorRate: 0.01,
        throughput: 10000
      }
    });

    // User service - high performance  
    const userServiceStrategy = new PerformanceOptimizedStrategy({
      serviceId: 'user-service',
      performanceProfile: 'high',
      circuitBreaker: new LoadAwareCircuitBreaker({
        baseFailureThreshold: 5,
        loadBasedThreshold: true,
        performanceWeight: 0.4,
        resetTimeout: 30000,
        fastRecovery: true
      }),
      retry: new DynamicRetryStrategy({
        baseMaxAttempts: 3,
        performanceBasedAttempts: true,
        maxLatencyBudget: 2000,
        fastFailEnabled: true
      }),
      timeout: new PerformanceBasedTimeout({
        baseTimeout: 5000,
        performanceAdaptive: true,
        percentileTarget: 90,
        minTimeout: 1000,
        maxTimeout: 15000
      }),
      performanceTargets: {
        p95ResponseTime: 800,
        p99ResponseTime: 2000,
        errorRate: 0.05,
        throughput: 5000
      }
    });

    // Analytics service - balanced performance
    const analyticsServiceStrategy = new PerformanceOptimizedStrategy({
      serviceId: 'analytics-service',
      performanceProfile: 'balanced',
      circuitBreaker: new LoadAwareCircuitBreaker({
        baseFailureThreshold: 7,
        loadBasedThreshold: true,
        performanceWeight: 0.3,
        resetTimeout: 45000,
        fastRecovery: false
      }),
      retry: new DynamicRetryStrategy({
        baseMaxAttempts: 4,
        performanceBasedAttempts: true,
        maxLatencyBudget: 10000,
        fastFailEnabled: false
      }),
      timeout: new PerformanceBasedTimeout({
        baseTimeout: 10000,
        performanceAdaptive: true,
        percentileTarget: 85,
        minTimeout: 3000,
        maxTimeout: 30000
      }),
      performanceTargets: {
        p95ResponseTime: 3000,
        p99ResponseTime: 8000,
        errorRate: 0.10,
        throughput: 1000
      }
    });

    // Register strategies
    this.serviceStrategies.set('api-gateway', apiGatewayStrategy);
    this.serviceStrategies.set('user-service', userServiceStrategy);
    this.serviceStrategies.set('analytics-service', analyticsServiceStrategy);

    this.logger.log('Performance-optimized resilience strategies initialized for 3 services');
  }

  private async assessServicePerformance(serviceId: string): Promise<PerformanceMetrics> {
    const strategy = this.serviceStrategies.get(serviceId);
    if (!strategy) {
      return this.createDefaultMetrics(serviceId);
    }

    const metrics = strategy.getMetrics();
    const recentHistory = this.getRecentPerformanceHistory(serviceId, 300000); // Last 5 minutes

    // Calculate performance percentiles
    const responseTimes = recentHistory.map(h => h.metrics.averageResponseTime).sort((a, b) => a - b);
    const p50 = this.calculatePercentile(responseTimes, 50);
    const p95 = this.calculatePercentile(responseTimes, 95);
    const p99 = this.calculatePercentile(responseTimes, 99);

    // Calculate throughput (requests per second)
    const throughput = recentHistory.length > 0 
      ? (recentHistory.length / (300000 / 1000)) // requests in 5 minutes / seconds
      : 0;

    return {
      serviceId,
      averageResponseTime: metrics.averageExecutionTime || 0,
      p50ResponseTime: p50,
      p95ResponseTime: p95,
      p99ResponseTime: p99,
      throughput,
      errorRate: metrics.errorRate || 0,
      successRate: metrics.totalExecutions > 0 
        ? metrics.successfulExecutions / metrics.totalExecutions 
        : 1,
      totalRequests: metrics.totalExecutions || 0,
      timestamp: new Date(),
      performanceScore: this.calculatePerformanceScore(serviceId)
    };
  }

  private async assessLoadCondition(serviceId: string): Promise<LoadCondition> {
    const metrics = this.performanceMetrics.get(serviceId);
    if (!metrics) return 'normal';

    const strategy = this.serviceStrategies.get(serviceId);
    const targets = strategy?.getPerformanceTargets();

    if (!targets || !metrics) return 'normal';

    // Assess load based on performance vs targets
    const responseTimeRatio = metrics.p95ResponseTime / targets.p95ResponseTime;
    const errorRateRatio = metrics.errorRate / targets.errorRate;
    const throughputRatio = metrics.throughput / targets.throughput;

    if (responseTimeRatio > 2 || errorRateRatio > 3) {
      return 'overloaded';
    } else if (responseTimeRatio > 1.5 || errorRateRatio > 2) {
      return 'high';
    } else if (throughputRatio > 1.2 && responseTimeRatio < 0.8) {
      return 'optimal';
    } else {
      return 'normal';
    }
  }

  private async determinePerformanceOptimizations(
    serviceId: string,
    metrics: PerformanceMetrics,
    loadCondition: LoadCondition
  ): Promise<any[]> {
    const optimizations = [];
    const strategy = this.serviceStrategies.get(serviceId);
    const targets = strategy?.getPerformanceTargets();

    if (!targets) return optimizations;

    // Circuit breaker optimizations based on load
    if (loadCondition === 'overloaded') {
      optimizations.push({
        type: 'circuit-breaker',
        changes: {
          failureThreshold: Math.max(2, Math.floor(strategy.getCurrentConfiguration().circuitBreaker.baseFailureThreshold * 0.6)),
          resetTimeout: strategy.getCurrentConfiguration().circuitBreaker.resetTimeout * 1.5
        },
        reasoning: 'Overloaded condition - tightening circuit breaker for protection',
        expectedImpact: 'Improved stability, reduced cascading failures'
      });
    } else if (loadCondition === 'optimal') {
      optimizations.push({
        type: 'circuit-breaker',
        changes: {
          failureThreshold: Math.min(15, Math.floor(strategy.getCurrentConfiguration().circuitBreaker.baseFailureThreshold * 1.3)),
          resetTimeout: Math.max(10000, strategy.getCurrentConfiguration().circuitBreaker.resetTimeout * 0.8)
        },
        reasoning: 'Optimal condition - relaxing circuit breaker for better throughput',
        expectedImpact: 'Improved throughput, maintained stability'
      });
    }

    // Timeout optimizations based on response time trends
    if (metrics.p95ResponseTime > targets.p95ResponseTime * 1.5) {
      optimizations.push({
        type: 'timeout',
        changes: {
          defaultTimeout: Math.min(strategy.getCurrentConfiguration().timeout.maxTimeout, metrics.p95ResponseTime * 2)
        },
        reasoning: `P95 response time (${metrics.p95ResponseTime}ms) exceeds target - increasing timeout`,
        expectedImpact: 'Reduced timeout failures, improved success rate'
      });
    } else if (metrics.p95ResponseTime < targets.p95ResponseTime * 0.7) {
      optimizations.push({
        type: 'timeout',
        changes: {
          defaultTimeout: Math.max(strategy.getCurrentConfiguration().timeout.minTimeout, metrics.p95ResponseTime * 1.5)
        },
        reasoning: `P95 response time (${metrics.p95ResponseTime}ms) well below target - optimizing timeout`,
        expectedImpact: 'Faster failure detection, improved responsiveness'
      });
    }

    // Retry optimizations based on error patterns
    if (metrics.errorRate > targets.errorRate * 2) {
      optimizations.push({
        type: 'retry',
        changes: {
          maxAttempts: Math.max(1, strategy.getCurrentConfiguration().retry.baseMaxAttempts - 1),
          maxLatencyBudget: strategy.getCurrentConfiguration().retry.maxLatencyBudget * 0.8
        },
        reasoning: `High error rate (${(metrics.errorRate * 100).toFixed(2)}%) - reducing retry attempts to fail fast`,
        expectedImpact: 'Faster failure recognition, reduced latency on failures'
      });
    } else if (metrics.errorRate < targets.errorRate * 0.5 && loadCondition !== 'overloaded') {
      optimizations.push({
        type: 'retry',
        changes: {
          maxAttempts: Math.min(5, strategy.getCurrentConfiguration().retry.baseMaxAttempts + 1),
          maxLatencyBudget: strategy.getCurrentConfiguration().retry.maxLatencyBudget * 1.2
        },
        reasoning: `Low error rate (${(metrics.errorRate * 100).toFixed(2)}%) - allowing more retries for better recovery`,
        expectedImpact: 'Improved success rate on transient failures'
      });
    }

    return optimizations;
  }

  private async applyPerformanceOptimizations(
    serviceId: string,
    strategy: PerformanceOptimizedStrategy,
    optimizations: any[]
  ): Promise<void> {
    for (const optimization of optimizations) {
      try {
        await strategy.updateConfiguration(optimization.type, optimization.changes);
        
        this.logger.log(
          `Applied ${optimization.type} optimization for ${serviceId}: ${optimization.reasoning}`
        );
        
        // Log expected impact
        this.logger.debug(`Expected impact: ${optimization.expectedImpact}`);
        
      } catch (error) {
        this.logger.error(
          `Failed to apply ${optimization.type} optimization for ${serviceId}:`, 
          error
        );
      }
    }
  }

  // Supporting methods
  private async callServiceWithPerformanceTracking(
    serviceId: string, 
    request: PerformanceRequest
  ): Promise<any> {
    const startTime = performance.now();
    
    try {
      // Simulate service call with variable performance
      const baseLatency = this.getBaseLatency(serviceId);
      const loadCondition = this.loadConditions.get(serviceId) || 'normal';
      const actualLatency = this.calculateActualLatency(baseLatency, loadCondition);
      
      await new Promise(resolve => setTimeout(resolve, actualLatency));
      
      // Simulate occasional failures based on load
      const failureRate = this.calculateFailureRate(serviceId, loadCondition);
      if (Math.random() < failureRate) {
        throw new Error(`Service ${serviceId} performance degradation`);
      }
      
      const executionTime = performance.now() - startTime;
      
      return {
        success: true,
        serviceId,
        operationType: request.operationType,
        executionTime,
        loadCondition,
        timestamp: new Date()
      };
      
    } catch (error) {
      error.executionTime = performance.now() - startTime;
      throw error;
    }
  }

  private async recordPerformanceMetrics(
    serviceId: string,
    executionTime: number,
    success: boolean,
    request: PerformanceRequest,
    error?: Error
  ): Promise<void> {
    // Record performance metrics for analysis
    const metric = {
      serviceId,
      operationType: request.operationType,
      executionTime,
      success,
      error: error?.message,
      timestamp: new Date(),
      performancePriority: request.performancePriority
    };
    
    // This would typically be sent to a metrics system
    this.logger.debug(`Performance metric recorded: ${JSON.stringify(metric)}`);
  }

  // Utility methods
  private calculatePerformanceScore(serviceId: string): number {
    const metrics = this.performanceMetrics.get(serviceId);
    const strategy = this.serviceStrategies.get(serviceId);
    const targets = strategy?.getPerformanceTargets();
    
    if (!metrics || !targets) return 1.0;
    
    const responseTimeScore = Math.max(0, 1 - (metrics.p95ResponseTime / targets.p95ResponseTime));
    const errorRateScore = Math.max(0, 1 - (metrics.errorRate / targets.errorRate));
    const throughputScore = Math.min(1, metrics.throughput / targets.throughput);
    
    return (responseTimeScore * 0.4) + (errorRateScore * 0.3) + (throughputScore * 0.3);
  }

  private calculateGlobalPerformance(): any {
    const allMetrics = Array.from(this.performanceMetrics.values());
    
    if (allMetrics.length === 0) {
      return { averageScore: 1.0, status: 'unknown' };
    }
    
    const averageScore = allMetrics.reduce((sum, metrics) => 
      sum + this.calculatePerformanceScore(metrics.serviceId), 0) / allMetrics.length;
    
    let status = 'optimal';
    if (averageScore < 0.5) status = 'degraded';
    else if (averageScore < 0.7) status = 'suboptimal';
    else if (averageScore > 0.9) status = 'optimal';
    else status = 'good';
    
    return {
      averageScore,
      status,
      totalServices: allMetrics.length,
      lastUpdate: new Date()
    };
  }

  private getRecentOptimizations(): any[] {
    // Return recent optimizations applied
    return [];
  }

  private getRecentPerformanceHistory(serviceId: string, timeWindowMs: number): any[] {
    const cutoff = new Date(Date.now() - timeWindowMs);
    return this.performanceHistory.filter(
      entry => entry.serviceId === serviceId && entry.timestamp > cutoff
    );
  }

  private calculatePercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))];
  }

  private createDefaultMetrics(serviceId: string): PerformanceMetrics {
    return {
      serviceId,
      averageResponseTime: 1000,
      p50ResponseTime: 800,
      p95ResponseTime: 2000,
      p99ResponseTime: 5000,
      throughput: 100,
      errorRate: 0.05,
      successRate: 0.95,
      totalRequests: 0,
      timestamp: new Date(),
      performanceScore: 0.8
    };
  }

  private getBaseLatency(serviceId: string): number {
    const baseLatencies = {
      'api-gateway': 100,
      'user-service': 500,
      'analytics-service': 2000
    };
    return baseLatencies[serviceId] || 1000;
  }

  private calculateActualLatency(baseLatency: number, loadCondition: LoadCondition): number {
    const multipliers = {
      optimal: 0.8,
      normal: 1.0,
      high: 1.5,
      overloaded: 3.0
    };
    
    const multiplier = multipliers[loadCondition] || 1.0;
    const jitter = Math.random() * 0.4 + 0.8; // 80%-120% jitter
    
    return Math.floor(baseLatency * multiplier * jitter);
  }

  private calculateFailureRate(serviceId: string, loadCondition: LoadCondition): number {
    const baseFailureRates = {
      'api-gateway': 0.01,
      'user-service': 0.02,
      'analytics-service': 0.05
    };
    
    const loadMultipliers = {
      optimal: 0.5,
      normal: 1.0,
      high: 2.0,
      overloaded: 5.0
    };
    
    const baseRate = baseFailureRates[serviceId] || 0.02;
    const loadMultiplier = loadMultipliers[loadCondition] || 1.0;
    
    return Math.min(0.5, baseRate * loadMultiplier); // Cap at 50%
  }

  private startPerformanceMonitoring(): void {
    this.logger.log('Starting performance-driven resilience monitoring and optimization');
  }
}

// performance-resilience.controller.ts
import { Controller, Post, Get, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { PerformanceResilienceService } from './performance-resilience.service';
import { PerformanceRequest } from './types'; // From your application

@Controller('performance-resilience')
export class PerformanceResilienceController {
  constructor(private readonly performanceResilienceService: PerformanceResilienceService) {}

  @Post(':serviceId/execute')
  @HttpCode(HttpStatus.OK)
  async executePerformanceRequest(
    @Param('serviceId') serviceId: string,
    @Body() request: PerformanceRequest
  ) {
    return await this.performanceResilienceService.executePerformanceOptimizedRequest(serviceId, request);
  }

  @Get('status')
  async getPerformanceStatus() {
    return await this.performanceResilienceService.getPerformanceStatus();
  }
}

// performance-resilience.module.ts  
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PerformanceResilienceController } from './performance-resilience.controller';
import { PerformanceResilienceService } from './performance-resilience.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [PerformanceResilienceController],
  providers: [PerformanceResilienceService],
  exports: [PerformanceResilienceService]
})
export class PerformanceResilienceModule {}
```

## Key Features

- **Performance-Driven Optimization**: Automatically optimizes resilience for performance
- **Load-Aware Circuit Breakers**: Adapts thresholds based on current load conditions
- **Performance-Based Timeouts**: Dynamic timeouts based on response time percentiles
- **Throughput Optimization**: Balances protection with maximum throughput
- **Real-time Adaptation**: 10-second optimization cycles for rapid adaptation
- **Performance Targets**: Service-specific performance targets and monitoring

## Performance Profiles

### Ultra-High Performance (API Gateway)
- **P95 Target**: 200ms response time
- **Error Rate**: <1% target
- **Throughput**: 10,000 RPS target
- **Fast Recovery**: Rapid circuit breaker recovery

### High Performance (User Service)
- **P95 Target**: 800ms response time  
- **Error Rate**: <5% target
- **Throughput**: 5,000 RPS target
- **Balanced Recovery**: Standard circuit breaker recovery

### Balanced Performance (Analytics)
- **P95 Target**: 3s response time
- **Error Rate**: <10% target
- **Throughput**: 1,000 RPS target
- **Stability Focus**: Emphasis on stability over speed

## Load Conditions

1. **Optimal**: Performance exceeds targets, throughput high
2. **Normal**: Performance meets targets, standard load
3. **High**: Performance at limits, increased latency
4. **Overloaded**: Performance degraded, error rates elevated

## Usage Example

```typescript
// Execute performance-optimized request
const request: PerformanceRequest = {
  operationType: 'search-products',
  correlationId: 'search-12345',
  performancePriority: 'high',
  expectedDuration: 500, // 500ms expected
  payload: { query: 'electronics', filters: {} }
};

const result = await fetch('/performance-resilience/api-gateway/execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(request)
});

// Get performance status
const status = await fetch('/performance-resilience/status');
console.log(await status.json());
```

## Common Pitfalls

- **Over-Optimization**: Too frequent optimizations causing instability
- **Performance Targets Too Aggressive**: Unrealistic performance expectations
- **Load Assessment Inaccuracy**: Incorrect load condition assessment
- **Optimization Conflicts**: Conflicting optimizations between patterns

## Related Examples

- [Basic Retry Pattern](../basic/example-2.md)
- [Composite Strategy](./example-1.md)
- [Adaptive Health Monitoring](./example-2.md)