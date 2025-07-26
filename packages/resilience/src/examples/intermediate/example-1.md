# Timeout Strategy with Adaptive Configuration

**Version**: 1.0.0 **Package**: @vytches/ddd-resilience **Complexity**:
Intermediate **Domain**: Multi-Service Integration **Patterns**: Timeout
Strategy, Adaptive Configuration, Performance Monitoring **Dependencies**:
@vytches/ddd-resilience

## Description

This example demonstrates advanced timeout strategies with adaptive
configuration that dynamically adjusts timeout values based on historical
performance, service health, and current load conditions. The system learns from
past behavior to optimize timeout settings automatically.

## Business Context

A logistics management system integrates with multiple external services
(shipping carriers, inventory systems, tracking APIs) that have varying response
time characteristics and reliability patterns. Static timeouts lead to either
premature cancellations or unnecessarily long waits. Adaptive timeouts improve
both performance and reliability by learning service behavior patterns.

## Code Example

```typescript
// adaptive-timeout-manager.ts
import {
  TimeoutStrategy,
  ResiliencePolicyBuilder,
  ResilienceContext,
  PerformanceMetrics,
} from '@vytches/ddd-resilience';
import { ExternalServiceConfig, SystemResourceMetrics } from './types'; // From your application

// Adaptive timeout manager with learning capabilities
export class AdaptiveTimeoutManager {
  private serviceTimeouts: Map<string, TimeoutStrategy>;
  private performanceHistory: Map<string, PerformanceMetrics[]>;
  private adaptiveConfigs: Map<string, AdaptiveTimeoutConfig>;
  private systemMonitor: SystemResourceMonitor;

  constructor() {
    this.serviceTimeouts = new Map();
    this.performanceHistory = new Map();
    this.adaptiveConfigs = new Map();
    this.systemMonitor = new SystemResourceMonitor();

    this.initializeAdaptiveTimeouts();
    this.startPerformanceMonitoring();
    this.startTimeoutOptimization();
  }

  async executeWithAdaptiveTimeout<T>(
    serviceId: string,
    operation: () => Promise<T>,
    context: ResilienceContext
  ): Promise<T> {
    const timeoutStrategy = this.serviceTimeouts.get(serviceId);
    if (!timeoutStrategy) {
      throw new Error(
        `No timeout strategy configured for service: ${serviceId}`
      );
    }

    const startTime = Date.now();
    const currentTimeout = await this.calculateOptimalTimeout(serviceId);

    try {
      // Update timeout strategy with adaptive value
      await timeoutStrategy.updateTimeout(currentTimeout);

      // Execute operation with adaptive timeout
      const result = await timeoutStrategy.execute(operation, context);

      // Record successful execution metrics
      await this.recordPerformanceMetrics(serviceId, {
        duration: Date.now() - startTime,
        success: true,
        timeoutUsed: currentTimeout,
        timestamp: new Date(),
      });

      return result;
    } catch (error) {
      // Record failure metrics
      await this.recordPerformanceMetrics(serviceId, {
        duration: Date.now() - startTime,
        success: false,
        timeoutUsed: currentTimeout,
        error: error.message,
        timestamp: new Date(),
      });

      throw error;
    }
  }

  private async calculateOptimalTimeout(serviceId: string): Promise<number> {
    const config = this.adaptiveConfigs.get(serviceId);
    const history = this.performanceHistory.get(serviceId) || [];

    if (!config || history.length < 10) {
      // Not enough data, use default timeout
      return config?.defaultTimeout || 30000;
    }

    // Calculate base timeout from recent performance
    const recentMetrics = history.slice(-50); // Last 50 calls
    const successfulCalls = recentMetrics.filter(m => m.success);

    if (successfulCalls.length === 0) {
      // No recent successes, use conservative timeout
      return Math.min(config.defaultTimeout * 2, config.maxTimeout);
    }

    // Statistical analysis of response times
    const responseTimes = successfulCalls
      .map(m => m.duration)
      .sort((a, b) => a - b);
    const p95ResponseTime =
      responseTimes[Math.floor(responseTimes.length * 0.95)];
    const averageResponseTime =
      responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;

    // Base timeout calculation (P95 + buffer)
    let baseTimeout = p95ResponseTime + averageResponseTime * 0.3;

    // Apply adaptive factors
    const systemLoad = await this.systemMonitor.getCurrentLoad();
    const serviceHealth = this.calculateServiceHealth(serviceId);
    const timeOfDay = this.getTimeOfDayFactor();

    // Adjust based on system conditions
    let adaptedTimeout = baseTimeout;

    // System load adjustment
    if (systemLoad.cpuUsage > 0.8) {
      adaptedTimeout *= 1.5; // Increase timeout during high CPU
    } else if (systemLoad.cpuUsage < 0.3) {
      adaptedTimeout *= 0.8; // Decrease timeout during low CPU
    }

    // Service health adjustment
    if (serviceHealth < 0.7) {
      adaptedTimeout *= 1.8; // Much longer timeout for unhealthy services
    } else if (serviceHealth > 0.95) {
      adaptedTimeout *= 0.7; // Shorter timeout for very healthy services
    }

    // Time of day adjustment (if configured)
    if (config.timeOfDayAdjustment) {
      adaptedTimeout *= timeOfDay;
    }

    // Network condition adjustment
    const networkLatency = systemLoad.networkLatency;
    if (networkLatency > 100) {
      // High latency
      adaptedTimeout += networkLatency * 2;
    }

    // Apply bounds
    const finalTimeout = Math.max(
      config.minTimeout,
      Math.min(adaptedTimeout, config.maxTimeout)
    );

    console.log(
      `Adaptive timeout for ${serviceId}: ${finalTimeout}ms (base: ${baseTimeout}ms, health: ${serviceHealth}, load: ${systemLoad.cpuUsage})`
    );

    return Math.round(finalTimeout);
  }

  private calculateServiceHealth(serviceId: string): number {
    const history = this.performanceHistory.get(serviceId) || [];
    const recentHistory = history.slice(-20); // Last 20 calls

    if (recentHistory.length === 0) return 1.0;

    const successRate =
      recentHistory.filter(m => m.success).length / recentHistory.length;
    const averageResponseTime =
      recentHistory
        .filter(m => m.success)
        .reduce((sum, m) => sum + m.duration, 0) /
      recentHistory.filter(m => m.success).length;

    // Health score based on success rate and response time consistency
    const baselineResponseTime = this.getBaselineResponseTime(serviceId);
    const responseTimeHealth =
      baselineResponseTime > 0
        ? Math.max(
            0,
            1 -
              (averageResponseTime - baselineResponseTime) /
                baselineResponseTime
          )
        : 1;

    return successRate * 0.7 + responseTimeHealth * 0.3;
  }

  private getBaselineResponseTime(serviceId: string): number {
    const history = this.performanceHistory.get(serviceId) || [];
    const successfulCalls = history.filter(m => m.success);

    if (successfulCalls.length < 50) return 0;

    // Use median of successful calls as baseline
    const responseTimes = successfulCalls
      .map(m => m.duration)
      .sort((a, b) => a - b);
    return responseTimes[Math.floor(responseTimes.length / 2)];
  }

  private getTimeOfDayFactor(): number {
    const hour = new Date().getHours();

    // Business hours (9 AM - 5 PM) typically have better service performance
    if (hour >= 9 && hour <= 17) {
      return 0.9; // 10% shorter timeout during business hours
    } else if (hour >= 22 || hour <= 6) {
      return 1.3; // 30% longer timeout during maintenance windows
    } else {
      return 1.0; // Normal timeout
    }
  }

  private async recordPerformanceMetrics(
    serviceId: string,
    metrics: PerformanceMetrics
  ): Promise<void> {
    if (!this.performanceHistory.has(serviceId)) {
      this.performanceHistory.set(serviceId, []);
    }

    const history = this.performanceHistory.get(serviceId)!;
    history.push(metrics);

    // Keep only last 1000 entries per service
    if (history.length > 1000) {
      history.splice(0, history.length - 1000);
    }

    // Trigger immediate optimization if performance degrades significantly
    if (
      !metrics.success ||
      metrics.duration > this.getBaselineResponseTime(serviceId) * 2
    ) {
      await this.optimizeTimeoutForService(serviceId);
    }
  }

  private initializeAdaptiveTimeouts(): void {
    const services = [
      {
        id: 'shipping-carrier-api',
        config: {
          defaultTimeout: 15000,
          minTimeout: 5000,
          maxTimeout: 60000,
          timeOfDayAdjustment: true,
          adaptationRate: 0.1,
        },
      },
      {
        id: 'inventory-management-system',
        config: {
          defaultTimeout: 8000,
          minTimeout: 2000,
          maxTimeout: 30000,
          timeOfDayAdjustment: false,
          adaptationRate: 0.15,
        },
      },
      {
        id: 'tracking-service-api',
        config: {
          defaultTimeout: 12000,
          minTimeout: 3000,
          maxTimeout: 45000,
          timeOfDayAdjustment: true,
          adaptationRate: 0.2,
        },
      },
    ];

    services.forEach(service => {
      this.adaptiveConfigs.set(service.id, service.config);

      const timeoutStrategy = ResiliencePolicyBuilder.create()
        .withTimeout({
          defaultTimeout: service.config.defaultTimeout,
          operationTimeouts: {},
          timeoutStrategy: 'graceful',
        })
        .build();

      this.serviceTimeouts.set(service.id, timeoutStrategy);
      this.performanceHistory.set(service.id, []);
    });
  }

  private startPerformanceMonitoring(): void {
    // Monitor system performance every 30 seconds
    setInterval(async () => {
      try {
        await this.systemMonitor.updateMetrics();
      } catch (error) {
        console.error('System monitoring failed:', error);
      }
    }, 30000);
  }

  private startTimeoutOptimization(): void {
    // Optimize timeouts every 5 minutes
    setInterval(async () => {
      try {
        for (const serviceId of this.serviceTimeouts.keys()) {
          await this.optimizeTimeoutForService(serviceId);
        }
      } catch (error) {
        console.error('Timeout optimization failed:', error);
      }
    }, 300000);
  }

  private async optimizeTimeoutForService(serviceId: string): Promise<void> {
    const optimalTimeout = await this.calculateOptimalTimeout(serviceId);
    const currentStrategy = this.serviceTimeouts.get(serviceId);

    if (currentStrategy) {
      await currentStrategy.updateTimeout(optimalTimeout);
      console.log(`Optimized timeout for ${serviceId}: ${optimalTimeout}ms`);
    }
  }

  // Public methods for monitoring and management
  getServiceMetrics(serviceId: string): ServiceMetrics {
    const history = this.performanceHistory.get(serviceId) || [];
    const recentHistory = history.slice(-100);

    const successfulCalls = recentHistory.filter(m => m.success);
    const failedCalls = recentHistory.filter(m => !m.success);

    return {
      serviceId,
      totalCalls: recentHistory.length,
      successRate:
        recentHistory.length > 0
          ? successfulCalls.length / recentHistory.length
          : 0,
      averageResponseTime:
        successfulCalls.length > 0
          ? successfulCalls.reduce((sum, m) => sum + m.duration, 0) /
            successfulCalls.length
          : 0,
      currentTimeout:
        this.serviceTimeouts.get(serviceId)?.getCurrentTimeout() || 0,
      serviceHealth: this.calculateServiceHealth(serviceId),
      lastOptimization: new Date(),
    };
  }

  getAllServiceMetrics(): ServiceMetrics[] {
    return Array.from(this.serviceTimeouts.keys()).map(serviceId =>
      this.getServiceMetrics(serviceId)
    );
  }

  async manuallyAdjustTimeout(
    serviceId: string,
    newTimeout: number
  ): Promise<void> {
    const strategy = this.serviceTimeouts.get(serviceId);
    const config = this.adaptiveConfigs.get(serviceId);

    if (!strategy || !config) {
      throw new Error(`Service ${serviceId} not found`);
    }

    // Validate timeout bounds
    if (newTimeout < config.minTimeout || newTimeout > config.maxTimeout) {
      throw new Error(
        `Timeout ${newTimeout}ms outside bounds [${config.minTimeout}, ${config.maxTimeout}]`
      );
    }

    await strategy.updateTimeout(newTimeout);
    console.log(`Manually adjusted timeout for ${serviceId}: ${newTimeout}ms`);
  }
}

// System resource monitor
class SystemResourceMonitor {
  private currentMetrics: SystemResourceMetrics;

  constructor() {
    this.currentMetrics = {
      cpuUsage: 0,
      memoryUsage: 0,
      diskUsage: 0,
      networkLatency: 0,
      openConnections: 0,
      threadPoolSize: 0,
      queueLength: 0,
      timestamp: new Date(),
    };
  }

  async updateMetrics(): Promise<void> {
    // In a real implementation, these would gather actual system metrics
    this.currentMetrics = {
      cpuUsage: Math.random() * 0.3 + 0.2, // 20-50% CPU usage
      memoryUsage: Math.random() * 0.4 + 0.3, // 30-70% memory usage
      diskUsage: Math.random() * 0.2 + 0.1, // 10-30% disk usage
      networkLatency: Math.random() * 50 + 10, // 10-60ms latency
      openConnections: Math.floor(Math.random() * 100 + 50), // 50-150 connections
      threadPoolSize: Math.floor(Math.random() * 20 + 10), // 10-30 threads
      queueLength: Math.floor(Math.random() * 10), // 0-10 queued items
      timestamp: new Date(),
    };
  }

  async getCurrentLoad(): Promise<SystemResourceMetrics> {
    return this.currentMetrics;
  }
}

// Supporting types
interface AdaptiveTimeoutConfig {
  defaultTimeout: number;
  minTimeout: number;
  maxTimeout: number;
  timeOfDayAdjustment: boolean;
  adaptationRate: number;
}

interface PerformanceMetrics {
  duration: number;
  success: boolean;
  timeoutUsed: number;
  error?: string;
  timestamp: Date;
}

interface ServiceMetrics {
  serviceId: string;
  totalCalls: number;
  successRate: number;
  averageResponseTime: number;
  currentTimeout: number;
  serviceHealth: number;
  lastOptimization: Date;
}

// Usage example
const timeoutManager = new AdaptiveTimeoutManager();

// Example usage with shipping service
async function processShipmentTracking(trackingNumber: string) {
  const context: ResilienceContext = {
    operationId: 'track-shipment',
    correlationId: trackingNumber,
    startTime: new Date(),
    attempt: 1,
    previousAttempts: [],
  };

  try {
    const trackingInfo = await timeoutManager.executeWithAdaptiveTimeout(
      'tracking-service-api',
      async () => {
        const response = await fetch(
          `https://tracking-api.com/track/${trackingNumber}`
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
      },
      context
    );

    console.log('Tracking info retrieved:', trackingInfo);
    return trackingInfo;
  } catch (error) {
    console.error('Tracking lookup failed:', error);
    throw error;
  }
}

// Monitor service performance
setInterval(() => {
  const metrics = timeoutManager.getAllServiceMetrics();
  metrics.forEach(metric => {
    console.log(
      `${metric.serviceId}: ${metric.currentTimeout}ms timeout, ${(metric.successRate * 100).toFixed(1)}% success, ${metric.averageResponseTime.toFixed(0)}ms avg response`
    );
  });
}, 60000); // Every minute

// Example usage
processShipmentTracking('1Z999AA1234567890')
  .then(() => console.log('Shipment tracking completed'))
  .catch(error => console.error('Shipment tracking failed:', error));
```

## Key Features

- **Adaptive Timeout Calculation**: Dynamically adjusts based on historical
  performance
- **System Load Awareness**: Considers CPU, memory, and network conditions
- **Service Health Monitoring**: Tracks individual service reliability
- **Time-of-Day Optimization**: Adjusts for maintenance windows and peak hours
- **Statistical Analysis**: Uses P95 response times and success rates
- **Bounded Adaptation**: Prevents extreme timeout values
- **Real-time Optimization**: Continuously improves timeout settings

## Adaptation Factors

1. **Historical Performance**: P95 response times, success rates
2. **System Load**: CPU, memory, network latency
3. **Service Health**: Recent success patterns
4. **Time of Day**: Business hours vs maintenance windows
5. **Network Conditions**: Current latency measurements

## Common Pitfalls

- **Over-optimization**: Changing timeouts too frequently
- **Insufficient Data**: Making decisions with too few samples
- **Ignoring Bounds**: Allowing timeouts to become too extreme
- **Complex Dependencies**: Not considering service interdependencies

## Related Examples

- [Circuit Breaker Pattern](../basic/example-1.md)
- [Composite Resilience Strategy](./example-2.md)
- [Health Check Integration](./example-3.md)
