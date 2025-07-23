# Health Check Integration with Resilience Patterns

**Version**: 1.0.0 **Package**: @vytches-ddd/resilience **Complexity**:
Intermediate **Domain**: Microservices Health Management **Patterns**: Health
Check Integration, Service Discovery, Adaptive Resilience **Dependencies**:
@vytches-ddd/resilience

## Description

This example demonstrates how to integrate health checks with resilience
patterns to create a self-healing system. Health check results automatically
adjust circuit breaker thresholds, timeout values, and bulkhead capacity based
on service health trends and dependency status.

## Business Context

A microservices architecture serving a high-traffic e-commerce platform needs to
automatically adapt its resilience patterns based on real-time service health.
Rather than using static configurations, the system should tighten or relax
resilience policies based on current service health, dependency status, and
historical performance patterns.

## Code Example

```typescript
// health-aware-resilience-manager.ts
import {
  HealthCheckIntegratedStrategy,
  ResiliencePolicyBuilder,
  ResilienceContext,
  HealthCheckResult,
  ServiceDiscovery,
} from '@vytches-ddd/resilience';
import {
  HealthStatus,
  DependencyHealth,
  ResilienceMetrics,
  AlertConfiguration,
} from './types'; // From your application

// Health-aware resilience manager with adaptive policies
export class HealthAwareResilienceManager {
  private serviceHealthMap: Map<string, HealthCheckResult>;
  private resilienceStrategies: Map<string, HealthCheckIntegratedStrategy>;
  private healthCheckScheduler: HealthCheckScheduler;
  private serviceDiscovery: ServiceDiscovery;
  private alertManager: HealthAlertManager;

  constructor() {
    this.serviceHealthMap = new Map();
    this.resilienceStrategies = new Map();
    this.healthCheckScheduler = new HealthCheckScheduler();
    this.serviceDiscovery = new ServiceDiscovery();
    this.alertManager = new HealthAlertManager();

    this.initializeHealthAwareStrategies();
    this.startHealthMonitoring();
    this.startAdaptiveOptimization();
  }

  async executeWithHealthAwareness<T>(
    serviceId: string,
    operation: () => Promise<T>,
    context: ResilienceContext
  ): Promise<T> {
    const strategy = this.resilienceStrategies.get(serviceId);
    if (!strategy) {
      throw new Error(
        `No resilience strategy configured for service: ${serviceId}`
      );
    }

    // Get current health status
    const healthStatus = this.serviceHealthMap.get(serviceId);

    // Adapt strategy based on health
    if (healthStatus) {
      await this.adaptStrategyForHealth(serviceId, healthStatus);
    }

    const startTime = Date.now();

    try {
      const result = await strategy.execute(operation, context);

      // Record successful execution for health scoring
      await this.recordHealthMetric(serviceId, {
        timestamp: new Date(),
        responseTime: Date.now() - startTime,
        success: true,
        operation: context.operationId,
      });

      return result;
    } catch (error) {
      // Record failure for health scoring
      await this.recordHealthMetric(serviceId, {
        timestamp: new Date(),
        responseTime: Date.now() - startTime,
        success: false,
        operation: context.operationId,
        error: error.message,
      });

      throw error;
    }
  }

  private async adaptStrategyForHealth(
    serviceId: string,
    health: HealthCheckResult
  ): Promise<void> {
    const strategy = this.resilienceStrategies.get(serviceId);
    if (!strategy) return;

    const healthScore = this.calculateOverallHealthScore(health);
    const dependencies = health.dependencies || [];

    // Calculate adjustment factors based on health
    const adjustments = this.calculateHealthAdjustments(
      healthScore,
      dependencies
    );

    // Apply circuit breaker adjustments
    if (adjustments.circuitBreaker) {
      await strategy.updateCircuitBreakerConfig({
        failureThreshold: Math.max(
          1,
          Math.floor(5 * adjustments.circuitBreaker.thresholdFactor)
        ),
        resetTimeout: Math.floor(
          30000 * adjustments.circuitBreaker.timeoutFactor
        ),
        halfOpenMaxCalls: Math.max(
          1,
          Math.floor(3 * adjustments.circuitBreaker.testCallsFactor)
        ),
      });
    }

    // Apply timeout adjustments
    if (adjustments.timeout) {
      const currentTimeout = strategy.getCurrentTimeout();
      const newTimeout = Math.floor(
        currentTimeout * adjustments.timeout.factor
      );
      await strategy.updateTimeout(Math.max(1000, Math.min(newTimeout, 60000))); // 1s-60s bounds
    }

    // Apply bulkhead adjustments
    if (adjustments.bulkhead) {
      await strategy.updateBulkheadConfig({
        maxConcurrency: Math.max(
          1,
          Math.floor(10 * adjustments.bulkhead.concurrencyFactor)
        ),
        queueSize: Math.max(
          5,
          Math.floor(50 * adjustments.bulkhead.queueFactor)
        ),
      });
    }

    console.log(
      `Adapted resilience strategy for ${serviceId} based on health score: ${healthScore}`
    );
  }

  private calculateOverallHealthScore(health: HealthCheckResult): number {
    let score = 0;

    // Base health status scoring
    switch (health.status) {
      case 'healthy':
        score += 1.0;
        break;
      case 'degraded':
        score += 0.6;
        break;
      case 'unhealthy':
        score += 0.2;
        break;
      case 'unknown':
        score += 0.5;
        break;
    }

    // Response time impact (30% weight)
    const responseTimeFactor = Math.max(0, 1 - health.responseTime / 5000); // 5s baseline
    score = score * 0.7 + responseTimeFactor * 0.3;

    // Dependency health impact (20% weight)
    if (health.dependencies && health.dependencies.length > 0) {
      const depHealthScore =
        health.dependencies.reduce((sum, dep) => {
          switch (dep.status) {
            case 'healthy':
              return sum + 1.0;
            case 'degraded':
              return sum + 0.6;
            case 'unhealthy':
              return sum + 0.2;
            default:
              return sum + 0.5;
          }
        }, 0) / health.dependencies.length;

      score = score * 0.8 + depHealthScore * 0.2;
    }

    return Math.max(0, Math.min(1, score));
  }

  private calculateHealthAdjustments(
    healthScore: number,
    dependencies: DependencyHealth[]
  ): HealthAdjustments {
    // High health (0.8+): Relax resilience patterns for better performance
    if (healthScore >= 0.8) {
      return {
        circuitBreaker: {
          thresholdFactor: 1.5, // More tolerance for failures
          timeoutFactor: 0.7, // Faster recovery attempts
          testCallsFactor: 1.5, // More test calls in half-open
        },
        timeout: {
          factor: 0.8, // Shorter timeouts for healthy services
        },
        bulkhead: {
          concurrencyFactor: 1.3, // Higher concurrency
          queueFactor: 1.2, // Larger queues
        },
      };
    }

    // Medium health (0.4-0.8): Standard resilience patterns
    if (healthScore >= 0.4) {
      return {
        circuitBreaker: {
          thresholdFactor: 1.0,
          timeoutFactor: 1.0,
          testCallsFactor: 1.0,
        },
        timeout: {
          factor: 1.0,
        },
        bulkhead: {
          concurrencyFactor: 1.0,
          queueFactor: 1.0,
        },
      };
    }

    // Low health (< 0.4): Aggressive resilience patterns
    return {
      circuitBreaker: {
        thresholdFactor: 0.6, // Lower threshold for failures
        timeoutFactor: 2.0, // Longer recovery time
        testCallsFactor: 0.5, // Fewer test calls
      },
      timeout: {
        factor: 1.5, // Longer timeouts for unhealthy services
      },
      bulkhead: {
        concurrencyFactor: 0.7, // Lower concurrency
        queueFactor: 0.8, // Smaller queues
      },
    };
  }

  private initializeHealthAwareStrategies(): void {
    const services = [
      {
        id: 'user-service',
        healthCheckUrl: 'http://user-service:8080/health',
        healthCheckInterval: 30000, // 30 seconds
        criticalService: true,
      },
      {
        id: 'product-service',
        healthCheckUrl: 'http://product-service:8080/health',
        healthCheckInterval: 15000, // 15 seconds
        criticalService: true,
      },
      {
        id: 'inventory-service',
        healthCheckUrl: 'http://inventory-service:8080/health',
        healthCheckInterval: 20000, // 20 seconds
        criticalService: false,
      },
      {
        id: 'notification-service',
        healthCheckUrl: 'http://notification-service:8080/health',
        healthCheckInterval: 60000, // 60 seconds
        criticalService: false,
      },
    ];

    services.forEach(service => {
      // Create health-aware resilience strategy
      const strategy = ResiliencePolicyBuilder.createHealthAware()
        .withHealthCheck({
          url: service.healthCheckUrl,
          interval: service.healthCheckInterval,
          timeout: 5000,
          retries: 2,
        })
        .withCircuitBreaker({
          failureThreshold: 5,
          resetTimeout: 30000,
          halfOpenMaxCalls: 3,
        })
        .withRetry({
          maxAttempts: 3,
          baseDelay: 1000,
          maxDelay: 10000,
          backoff: 'exponential',
        })
        .withTimeout({
          defaultTimeout: 15000,
          timeoutStrategy: 'graceful',
        })
        .withBulkhead({
          maxConcurrency: 10,
          queueSize: 50,
          queueTimeout: 30000,
        })
        .build();

      this.resilienceStrategies.set(service.id, strategy);

      // Schedule health checks
      this.healthCheckScheduler.schedule(service.id, {
        url: service.healthCheckUrl,
        interval: service.healthCheckInterval,
        callback: result => this.handleHealthCheckResult(service.id, result),
      });
    });
  }

  private async handleHealthCheckResult(
    serviceId: string,
    result: HealthCheckResult
  ): Promise<void> {
    const previousHealth = this.serviceHealthMap.get(serviceId);
    this.serviceHealthMap.set(serviceId, result);

    // Detect health transitions
    if (previousHealth) {
      const healthChanged = previousHealth.status !== result.status;
      const significantResponseTimeChange =
        Math.abs(result.responseTime - previousHealth.responseTime) > 1000; // 1 second threshold

      if (healthChanged || significantResponseTimeChange) {
        await this.handleHealthTransition(serviceId, previousHealth, result);
      }
    }

    // Check for alerting conditions
    await this.checkAlertConditions(serviceId, result);

    // Update service discovery if health status changed
    if (!previousHealth || previousHealth.status !== result.status) {
      await this.serviceDiscovery.updateServiceHealth(serviceId, result.status);
    }
  }

  private async handleHealthTransition(
    serviceId: string,
    previousHealth: HealthCheckResult,
    currentHealth: HealthCheckResult
  ): Promise<void> {
    const transition = `${previousHealth.status} -> ${currentHealth.status}`;
    console.log(`Service ${serviceId} health transition: ${transition}`);

    // Immediate resilience adjustments for critical transitions
    if (
      currentHealth.status === 'unhealthy' &&
      previousHealth.status !== 'unhealthy'
    ) {
      await this.applyEmergencyResilienceMode(serviceId);
    } else if (
      currentHealth.status === 'healthy' &&
      previousHealth.status === 'unhealthy'
    ) {
      await this.applyRecoveryResilienceMode(serviceId);
    }

    // Log transition for analysis
    await this.logHealthTransition(serviceId, previousHealth, currentHealth);
  }

  private async applyEmergencyResilienceMode(serviceId: string): Promise<void> {
    const strategy = this.resilienceStrategies.get(serviceId);
    if (!strategy) return;

    console.log(`Applying emergency resilience mode for ${serviceId}`);

    // Aggressive circuit breaker
    await strategy.updateCircuitBreakerConfig({
      failureThreshold: 2,
      resetTimeout: 120000, // 2 minutes
      halfOpenMaxCalls: 1,
    });

    // Longer timeouts
    const currentTimeout = strategy.getCurrentTimeout();
    await strategy.updateTimeout(Math.min(currentTimeout * 2, 60000));

    // Reduced capacity
    await strategy.updateBulkheadConfig({
      maxConcurrency: 3,
      queueSize: 10,
    });
  }

  private async applyRecoveryResilienceMode(serviceId: string): Promise<void> {
    const strategy = this.resilienceStrategies.get(serviceId);
    if (!strategy) return;

    console.log(`Applying recovery resilience mode for ${serviceId}`);

    // Gradual relaxation of circuit breaker
    await strategy.updateCircuitBreakerConfig({
      failureThreshold: 3,
      resetTimeout: 45000, // 45 seconds
      halfOpenMaxCalls: 2,
    });

    // Standard timeouts
    await strategy.updateTimeout(15000);

    // Increased capacity
    await strategy.updateBulkheadConfig({
      maxConcurrency: 8,
      queueSize: 30,
    });
  }

  private async checkAlertConditions(
    serviceId: string,
    health: HealthCheckResult
  ): Promise<void> {
    // Critical service down
    if (health.status === 'unhealthy') {
      await this.alertManager.raiseAlert({
        serviceId,
        severity: 'critical',
        message: `Service ${serviceId} is unhealthy`,
        details: health,
        timestamp: new Date(),
      });
    }

    // High response time
    if (health.responseTime > 10000) {
      // 10 seconds
      await this.alertManager.raiseAlert({
        serviceId,
        severity: 'warning',
        message: `Service ${serviceId} has high response time: ${health.responseTime}ms`,
        details: health,
        timestamp: new Date(),
      });
    }

    // Multiple unhealthy dependencies
    const unhealthyDeps = (health.dependencies || []).filter(
      dep => dep.status === 'unhealthy'
    );
    if (unhealthyDeps.length >= 2) {
      await this.alertManager.raiseAlert({
        serviceId,
        severity: 'error',
        message: `Service ${serviceId} has ${unhealthyDeps.length} unhealthy dependencies`,
        details: { health, unhealthyDeps },
        timestamp: new Date(),
      });
    }
  }

  private startHealthMonitoring(): void {
    // Monitor overall system health every minute
    setInterval(async () => {
      await this.analyzeSystemHealth();
    }, 60000);
  }

  private startAdaptiveOptimization(): void {
    // Optimize resilience strategies every 5 minutes
    setInterval(async () => {
      await this.optimizeResilienceStrategies();
    }, 300000);
  }

  private async analyzeSystemHealth(): Promise<void> {
    const healthResults = Array.from(this.serviceHealthMap.values());
    const healthyServices = healthResults.filter(
      h => h.status === 'healthy'
    ).length;
    const totalServices = healthResults.length;

    const systemHealthScore =
      totalServices > 0 ? healthyServices / totalServices : 1;

    console.log(
      `System health: ${healthyServices}/${totalServices} services healthy (${(systemHealthScore * 100).toFixed(1)}%)`
    );

    // Global resilience adjustments based on system health
    if (systemHealthScore < 0.5) {
      console.log(
        'System health critical - applying global defensive strategies'
      );
      await this.applyGlobalDefensiveStrategies();
    } else if (systemHealthScore > 0.9) {
      console.log('System health excellent - optimizing for performance');
      await this.applyGlobalPerformanceOptimizations();
    }
  }

  private async optimizeResilienceStrategies(): Promise<void> {
    for (const [serviceId, health] of this.serviceHealthMap) {
      const strategy = this.resilienceStrategies.get(serviceId);
      if (!strategy) continue;

      const metrics = strategy.getMetrics();
      const healthScore = this.calculateOverallHealthScore(health);

      // Analyze effectiveness of current configuration
      const effectiveness = this.analyzeStrategyEffectiveness(
        metrics,
        healthScore
      );

      if (effectiveness.needsOptimization) {
        await this.optimizeStrategyConfiguration(
          serviceId,
          effectiveness.recommendations
        );
      }
    }
  }

  private async recordHealthMetric(
    serviceId: string,
    metric: HealthMetric
  ): Promise<void> {
    // Implementation would store metrics for analysis
    console.log(`Health metric for ${serviceId}:`, metric);
  }

  private async logHealthTransition(
    serviceId: string,
    previous: HealthCheckResult,
    current: HealthCheckResult
  ): Promise<void> {
    // Implementation would log transitions for analysis
    console.log(`Health transition logged for ${serviceId}:`, {
      from: previous.status,
      to: current.status,
      responseTimeDelta: current.responseTime - previous.responseTime,
      timestamp: new Date(),
    });
  }

  // Public monitoring methods
  getSystemHealthStatus(): SystemHealthStatus {
    const healthResults = Array.from(this.serviceHealthMap.entries());
    const services = healthResults.map(([serviceId, health]) => ({
      serviceId,
      status: health.status,
      responseTime: health.responseTime,
      healthScore: this.calculateOverallHealthScore(health),
      lastCheck: health.timestamp,
    }));

    const healthyCount = services.filter(s => s.status === 'healthy').length;
    const overallHealth =
      services.length > 0 ? healthyCount / services.length : 1;

    return {
      overallHealth,
      healthyServices: healthyCount,
      totalServices: services.length,
      services,
      lastUpdate: new Date(),
    };
  }

  getResilienceAdaptations(): ResilienceAdaptationLog[] {
    // Return history of resilience adaptations
    return Array.from(this.resilienceStrategies.keys()).map(serviceId => ({
      serviceId,
      lastAdaptation: new Date(),
      adaptationReason: 'health-based',
      currentConfig:
        this.resilienceStrategies.get(serviceId)?.getConfiguration() || {},
    }));
  }
}

// Supporting classes and types
class HealthCheckScheduler {
  schedule(serviceId: string, config: HealthCheckConfig): void {
    setInterval(async () => {
      try {
        const result = await this.performHealthCheck(config.url);
        config.callback(result);
      } catch (error) {
        config.callback({
          serviceName: serviceId,
          status: 'unknown',
          responseTime: config.timeout || 5000,
          timestamp: new Date(),
          uptime: 0,
          dependencies: [],
          details: { error: error.message },
        });
      }
    }, config.interval);
  }

  private async performHealthCheck(url: string): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(5000),
        headers: { Accept: 'application/json' },
      });

      const responseTime = Date.now() - startTime;

      if (response.ok) {
        const healthData = await response.json();
        return {
          serviceName: healthData.service || 'unknown',
          status: healthData.status === 'UP' ? 'healthy' : 'degraded',
          responseTime,
          timestamp: new Date(),
          uptime: healthData.uptime || 0,
          dependencies: healthData.dependencies || [],
          details: healthData.details || {},
        };
      } else {
        return {
          serviceName: 'unknown',
          status: 'unhealthy',
          responseTime,
          timestamp: new Date(),
          uptime: 0,
          dependencies: [],
          details: { httpStatus: response.status },
        };
      }
    } catch (error) {
      return {
        serviceName: 'unknown',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        timestamp: new Date(),
        uptime: 0,
        dependencies: [],
        details: { error: error.message },
      };
    }
  }
}

class HealthAlertManager {
  async raiseAlert(alert: HealthAlert): Promise<void> {
    console.log(
      `🚨 HEALTH ALERT [${alert.severity.toUpperCase()}]: ${alert.message}`
    );
    // Implementation would send alerts via configured channels
  }
}

// Supporting types
interface HealthCheckConfig {
  url: string;
  interval: number;
  timeout?: number;
  callback: (result: HealthCheckResult) => void;
}

interface HealthAdjustments {
  circuitBreaker?: {
    thresholdFactor: number;
    timeoutFactor: number;
    testCallsFactor: number;
  };
  timeout?: {
    factor: number;
  };
  bulkhead?: {
    concurrencyFactor: number;
    queueFactor: number;
  };
}

interface HealthMetric {
  timestamp: Date;
  responseTime: number;
  success: boolean;
  operation: string;
  error?: string;
}

interface HealthAlert {
  serviceId: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  details: any;
  timestamp: Date;
}

interface SystemHealthStatus {
  overallHealth: number;
  healthyServices: number;
  totalServices: number;
  services: ServiceHealthSummary[];
  lastUpdate: Date;
}

interface ServiceHealthSummary {
  serviceId: string;
  status: HealthStatus;
  responseTime: number;
  healthScore: number;
  lastCheck: Date;
}

interface ResilienceAdaptationLog {
  serviceId: string;
  lastAdaptation: Date;
  adaptationReason: string;
  currentConfig: any;
}

// Usage example
const healthManager = new HealthAwareResilienceManager();

// Example service call with health-aware resilience
async function getUserProfile(userId: string) {
  const context: ResilienceContext = {
    operationId: 'get-user-profile',
    correlationId: `user-${userId}`,
    userId,
    startTime: new Date(),
    attempt: 1,
    previousAttempts: [],
  };

  try {
    const profile = await healthManager.executeWithHealthAwareness(
      'user-service',
      async () => {
        const response = await fetch(
          `http://user-service:8080/users/${userId}`
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
      },
      context
    );

    console.log('User profile retrieved:', profile);
    return profile;
  } catch (error) {
    console.error('Failed to get user profile:', error);
    throw error;
  }
}

// Monitor system health
setInterval(() => {
  const systemHealth = healthManager.getSystemHealthStatus();
  console.log(
    `System Health: ${(systemHealth.overallHealth * 100).toFixed(1)}% (${systemHealth.healthyServices}/${systemHealth.totalServices} services)`
  );

  const unhealthyServices = systemHealth.services.filter(
    s => s.status !== 'healthy'
  );
  if (unhealthyServices.length > 0) {
    console.log(
      'Unhealthy services:',
      unhealthyServices.map(s => `${s.serviceId} (${s.status})`)
    );
  }
}, 30000); // Every 30 seconds

// Example usage
getUserProfile('user-123')
  .then(() => console.log('User profile request completed'))
  .catch(error => console.error('User profile request failed:', error));
```

## Key Features

- **Health-Driven Adaptation**: Automatically adjusts resilience patterns based
  on service health
- **Service Discovery Integration**: Updates service registry with health status
- **Transition Detection**: Responds to health state changes immediately
- **Emergency Modes**: Applies aggressive protection during service degradation
- **Recovery Optimization**: Gradually relaxes patterns as services recover
- **System-Wide Analysis**: Considers overall system health for global
  adjustments

## Health Score Calculation

The system calculates health scores based on:

- **Service Status** (70%): healthy/degraded/unhealthy/unknown
- **Response Time** (30%): Compared to 5-second baseline
- **Dependency Health** (20%): Average health of dependencies

## Adaptation Strategies

1. **High Health (0.8+)**: Relax patterns for better performance
2. **Medium Health (0.4-0.8)**: Standard resilience configuration
3. **Low Health (<0.4)**: Aggressive protection patterns

## Common Pitfalls

- **Over-Adaptation**: Changing configurations too frequently
- **Health Check Overhead**: Too frequent health checks impacting performance
- **Circular Dependencies**: Health checks affecting the services being checked
- **Alert Fatigue**: Too many health alerts drowning out critical issues

## Related Examples

- [Adaptive Timeout Strategy](./example-1.md)
- [Composite Resilience Strategy](./example-2.md)
- [Enterprise Orchestration](../advanced/example-1.md)
