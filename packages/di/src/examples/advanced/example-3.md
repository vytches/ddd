# Enterprise Production Patterns - Expert Example

**Version**: 1.0.0  
**Package**: @vytches-ddd/di  
**Complexity**: expert  
**Domain**: Enterprise Production Environment  
**Patterns**: Production Patterns, Monitoring, Performance, Resilience  
**Dependencies**: @vytches-ddd/di, @vytches-ddd/resilience, @vytches-ddd/logging

## Description

This example demonstrates enterprise-grade production patterns for VytchesDDD's
DI system. It covers monitoring, performance optimization, health checks,
graceful degradation, and production-ready service management patterns used in
large-scale enterprise applications.

## Business Context

Production enterprise applications require sophisticated DI patterns that handle
failures gracefully, provide comprehensive monitoring, and maintain high
availability. This example shows how to implement these patterns using
VytchesDDD's DI system with production-ready features.

## Code Example

```typescript
// production/health-check.service.ts
import { DomainService, ServiceLifetime } from '@vytches-ddd/di';
import { ServiceMetrics } from '../types'; // Import from application

/**
 * Health check service for production monitoring
 */
@DomainService({
  serviceId: 'healthCheckService',
  lifetime: ServiceLifetime.Singleton,
  autoRegister: true,
  healthCheck: true,
})
export class HealthCheckService {
  private serviceHealthMap = new Map<string, boolean>();
  private lastHealthCheck = new Date();

  /**
   * Performs comprehensive health check
   */
  async performHealthCheck(): Promise<HealthStatus> {
    // ⭐ FOCUS: Production health monitoring
    const healthStatus: HealthStatus = {
      status: 'healthy',
      timestamp: new Date(),
      services: {},
      metrics: await this.collectMetrics(),
      dependencies: {},
    };

    try {
      // Check database connectivity
      healthStatus.dependencies.database = await this.checkDatabaseHealth();

      // Check external services
      healthStatus.dependencies.externalApi =
        await this.checkExternalApiHealth();

      // Check cache
      healthStatus.dependencies.cache = await this.checkCacheHealth();

      // Check message queue
      healthStatus.dependencies.messageQueue =
        await this.checkMessageQueueHealth();

      // Aggregate service health
      const allHealthy = Object.values(healthStatus.dependencies).every(
        status => status === 'healthy'
      );
      healthStatus.status = allHealthy ? 'healthy' : 'degraded';

      this.lastHealthCheck = new Date();

      console.log(`HealthCheckService: System status - ${healthStatus.status}`);
    } catch (error) {
      healthStatus.status = 'unhealthy';
      healthStatus.error = error.message;

      console.error('HealthCheckService: Health check failed:', error);
    }

    return healthStatus;
  }

  /**
   * Registers service for health monitoring
   */
  registerService(
    serviceId: string,
    healthCheckFn: () => Promise<boolean>
  ): void {
    // Service-specific health check registration
    console.log(`HealthCheckService: Registered health check for ${serviceId}`);
  }

  private async checkDatabaseHealth(): Promise<
    'healthy' | 'degraded' | 'unhealthy'
  > {
    // Simulate database health check
    await new Promise(resolve => setTimeout(resolve, 10));
    return 'healthy';
  }

  private async checkExternalApiHealth(): Promise<
    'healthy' | 'degraded' | 'unhealthy'
  > {
    // Simulate external API health check
    await new Promise(resolve => setTimeout(resolve, 50));
    return 'healthy';
  }

  private async checkCacheHealth(): Promise<
    'healthy' | 'degraded' | 'unhealthy'
  > {
    // Simulate cache health check
    await new Promise(resolve => setTimeout(resolve, 5));
    return 'healthy';
  }

  private async checkMessageQueueHealth(): Promise<
    'healthy' | 'degraded' | 'unhealthy'
  > {
    // Simulate message queue health check
    await new Promise(resolve => setTimeout(resolve, 20));
    return 'healthy';
  }

  private async collectMetrics(): Promise<ServiceMetrics> {
    return {
      totalRequests: 1000,
      successfulRequests: 995,
      failedRequests: 5,
      averageResponseTime: 150,
      lastRequestTime: new Date(),
    };
  }
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  services: Record<string, string>;
  metrics: ServiceMetrics;
  dependencies: Record<string, 'healthy' | 'degraded' | 'unhealthy'>;
  error?: string;
}
```

```typescript
// production/circuit-breaker.service.ts
import { DomainService, ServiceLifetime } from '@vytches-ddd/di';
import { CircuitBreaker } from '@vytches-ddd/resilience';

/**
 * Circuit breaker service for production resilience
 */
@DomainService({
  serviceId: 'circuitBreakerService',
  lifetime: ServiceLifetime.Singleton,
  autoRegister: true,
  dependencies: ['metricsService'],
})
export class CircuitBreakerService {
  private circuitBreakers = new Map<string, CircuitBreaker>();

  /**
   * Gets or creates circuit breaker for service
   */
  getCircuitBreaker(serviceId: string): CircuitBreaker {
    // ⭐ FOCUS: Production circuit breaker management
    if (!this.circuitBreakers.has(serviceId)) {
      const circuitBreaker = new CircuitBreaker({
        failureThreshold: 5,
        resetTimeout: 60000, // 1 minute
        monitoringPeriod: 10000, // 10 seconds
        onOpen: () => {
          console.log(`CircuitBreaker: ${serviceId} circuit opened`);
          this.handleCircuitOpen(serviceId);
        },
        onClose: () => {
          console.log(`CircuitBreaker: ${serviceId} circuit closed`);
          this.handleCircuitClose(serviceId);
        },
        onHalfOpen: () => {
          console.log(`CircuitBreaker: ${serviceId} circuit half-open`);
        },
      });

      this.circuitBreakers.set(serviceId, circuitBreaker);
    }

    return this.circuitBreakers.get(serviceId)!;
  }

  /**
   * Executes operation with circuit breaker protection
   */
  async executeWithCircuitBreaker<T>(
    serviceId: string,
    operation: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<T> {
    const circuitBreaker = this.getCircuitBreaker(serviceId);

    try {
      return await circuitBreaker.execute(operation);
    } catch (error) {
      if (fallback) {
        console.log(`CircuitBreaker: Using fallback for ${serviceId}`);
        return await fallback();
      }
      throw error;
    }
  }

  private handleCircuitOpen(serviceId: string): void {
    // Notify monitoring systems
    console.log(`CircuitBreaker: Service ${serviceId} is degraded`);
  }

  private handleCircuitClose(serviceId: string): void {
    // Notify monitoring systems
    console.log(`CircuitBreaker: Service ${serviceId} is recovered`);
  }
}
```

```typescript
// production/monitoring.service.ts
import { DomainService, ServiceLifetime } from '@vytches-ddd/di';
import { Logger } from '@vytches-ddd/logging';

/**
 * Production monitoring service
 */
@DomainService({
  serviceId: 'monitoringService',
  lifetime: ServiceLifetime.Singleton,
  autoRegister: true,
})
export class MonitoringService {
  private logger = Logger.forContext(MonitoringService.name);
  private metrics = new Map<string, any>();
  private alerts = new Map<string, AlertRule>();

  /**
   * Records metric value
   */
  recordMetric(
    name: string,
    value: number,
    tags?: Record<string, string>
  ): void {
    // ⭐ FOCUS: Production metrics collection
    const metric = {
      name,
      value,
      timestamp: new Date(),
      tags: tags || {},
    };

    this.metrics.set(name, metric);

    // Check alert rules
    this.checkAlerts(name, value);

    this.logger.info('Metric recorded', { metric });
  }

  /**
   * Registers alert rule
   */
  registerAlert(
    name: string,
    condition: (value: number) => boolean,
    action: AlertAction
  ): void {
    const alertRule: AlertRule = {
      name,
      condition,
      action,
      lastTriggered: null,
    };

    this.alerts.set(name, alertRule);

    this.logger.info('Alert rule registered', { name });
  }

  /**
   * Gets metrics summary
   */
  getMetrics(): Record<string, any> {
    const summary: Record<string, any> = {};

    for (const [name, metric] of this.metrics) {
      summary[name] = metric;
    }

    return summary;
  }

  /**
   * Tracks service operation
   */
  trackServiceOperation(
    serviceId: string,
    operation: string,
    duration: number,
    success: boolean
  ): void {
    // ⭐ FOCUS: Service operation tracking
    const metric = {
      serviceId,
      operation,
      duration,
      success,
      timestamp: new Date(),
    };

    this.recordMetric(`service.${serviceId}.${operation}.duration`, duration);
    this.recordMetric(
      `service.${serviceId}.${operation}.success`,
      success ? 1 : 0
    );

    if (!success) {
      this.logger.warn('Service operation failed', { metric });
    }
  }

  private checkAlerts(metricName: string, value: number): void {
    for (const [alertName, rule] of this.alerts) {
      if (rule.condition(value)) {
        const now = new Date();

        // Prevent spam alerts (minimum 5 minutes between same alerts)
        if (
          !rule.lastTriggered ||
          now.getTime() - rule.lastTriggered.getTime() > 300000
        ) {
          rule.action.execute(metricName, value);
          rule.lastTriggered = now;

          this.logger.warn('Alert triggered', { alertName, metricName, value });
        }
      }
    }
  }
}

interface AlertRule {
  name: string;
  condition: (value: number) => boolean;
  action: AlertAction;
  lastTriggered: Date | null;
}

interface AlertAction {
  execute(metricName: string, value: number): void;
}
```

```typescript
// production/graceful-degradation.service.ts
import { DomainService, ServiceLifetime, VytchesDDD } from '@vytches-ddd/di';
import { CircuitBreakerService } from './circuit-breaker.service';
import { MonitoringService } from './monitoring.service';
import { User, CreateUserData } from '../types'; // Import from application

/**
 * Service demonstrating graceful degradation patterns
 */
@DomainService({
  serviceId: 'userServiceWithDegradation',
  lifetime: ServiceLifetime.Singleton,
  autoRegister: true,
  dependencies: ['circuitBreakerService', 'monitoringService'],
})
export class UserServiceWithDegradation {
  private users = new Map<string, User>();
  private circuitBreakerService: CircuitBreakerService;
  private monitoringService: MonitoringService;

  constructor() {
    this.circuitBreakerService = VytchesDDD.resolve<CircuitBreakerService>(
      'circuitBreakerService'
    );
    this.monitoringService =
      VytchesDDD.resolve<MonitoringService>('monitoringService');
  }

  /**
   * Creates user with graceful degradation
   */
  async createUser(userData: CreateUserData): Promise<User> {
    const startTime = Date.now();

    try {
      // ⭐ FOCUS: Primary operation with circuit breaker
      const user = await this.circuitBreakerService.executeWithCircuitBreaker(
        'createUser',
        () => this.createUserPrimary(userData),
        () => this.createUserFallback(userData)
      );

      const duration = Date.now() - startTime;
      this.monitoringService.trackServiceOperation(
        'userService',
        'createUser',
        duration,
        true
      );

      return user;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.monitoringService.trackServiceOperation(
        'userService',
        'createUser',
        duration,
        false
      );

      // Last resort fallback
      return this.createUserEmergencyFallback(userData);
    }
  }

  /**
   * Gets user with multiple fallback strategies
   */
  async getUserById(userId: string): Promise<User | null> {
    const startTime = Date.now();

    try {
      // ⭐ FOCUS: Primary lookup with fallbacks
      return await this.circuitBreakerService.executeWithCircuitBreaker(
        'getUserById',
        () => this.getUserPrimary(userId),
        () => this.getUserFallback(userId)
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      this.monitoringService.trackServiceOperation(
        'userService',
        'getUserById',
        duration,
        false
      );

      // Return cached or default user
      return this.getUserEmergencyFallback(userId);
    }
  }

  /**
   * Bulk operation with partial success handling
   */
  async createMultipleUsers(
    userDataList: CreateUserData[]
  ): Promise<BulkResult<User>> {
    const results: BulkResult<User> = {
      successful: [],
      failed: [],
      partialSuccess: false,
    };

    // ⭐ FOCUS: Bulk operation with individual failure handling
    for (const userData of userDataList) {
      try {
        const user = await this.createUser(userData);
        results.successful.push(user);
      } catch (error) {
        results.failed.push({ data: userData, error: error.message });
      }
    }

    results.partialSuccess =
      results.successful.length > 0 && results.failed.length > 0;

    this.monitoringService.recordMetric(
      'bulk.createUsers.successRate',
      results.successful.length / userDataList.length
    );

    return results;
  }

  private async createUserPrimary(userData: CreateUserData): Promise<User> {
    // Simulate primary database operation
    await this.simulateOperation(100, 0.05); // 5% failure rate

    const user: User = {
      id: this.generateUserId(),
      email: userData.email,
      name: userData.name,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.users.set(user.id, user);

    console.log(`UserService: Created user ${user.id} (primary)`);
    return user;
  }

  private async createUserFallback(userData: CreateUserData): Promise<User> {
    // Simulate fallback operation (cache, secondary DB, etc.)
    await this.simulateOperation(50, 0.01); // 1% failure rate, faster

    const user: User = {
      id: this.generateUserId(),
      email: userData.email,
      name: userData.name,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.users.set(user.id, user);

    console.log(`UserService: Created user ${user.id} (fallback)`);
    return user;
  }

  private async createUserEmergencyFallback(
    userData: CreateUserData
  ): Promise<User> {
    // Emergency fallback - minimal functionality
    const user: User = {
      id: `emergency_${Date.now()}`,
      email: userData.email,
      name: userData.name,
      isActive: false, // Mark as inactive for manual review
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    console.log(`UserService: Created user ${user.id} (emergency fallback)`);
    return user;
  }

  private async getUserPrimary(userId: string): Promise<User | null> {
    await this.simulateOperation(50, 0.03); // 3% failure rate

    const user = this.users.get(userId);
    if (user) {
      console.log(`UserService: Retrieved user ${userId} (primary)`);
    }

    return user || null;
  }

  private async getUserFallback(userId: string): Promise<User | null> {
    await this.simulateOperation(30, 0.01); // 1% failure rate

    const user = this.users.get(userId);
    if (user) {
      console.log(`UserService: Retrieved user ${userId} (fallback)`);
    }

    return user || null;
  }

  private async getUserEmergencyFallback(userId: string): Promise<User | null> {
    // Return minimal user data or null
    console.log(`UserService: Emergency fallback for user ${userId}`);
    return null;
  }

  private async simulateOperation(
    delayMs: number,
    failureRate: number
  ): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, delayMs));

    if (Math.random() < failureRate) {
      throw new Error('Simulated operation failure');
    }
  }

  private generateUserId(): string {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

interface BulkResult<T> {
  successful: T[];
  failed: Array<{ data: any; error: string }>;
  partialSuccess: boolean;
}
```

```typescript
// production/production-configuration.ts
import { VytchesDDD, SimpleContainer } from '@vytches-ddd/di';
import { HealthCheckService } from './health-check.service';
import { MonitoringService } from './monitoring.service';
import { CircuitBreakerService } from './circuit-breaker.service';

/**
 * Production configuration for DI system
 */
export class ProductionConfiguration {
  /**
   * Configures production DI container
   */
  static async configure(): Promise<void> {
    const container = new SimpleContainer();

    // ⭐ FOCUS: Production-specific configuration
    await VytchesDDD.configure(container, {
      enableAutoDiscovery: true,
      enableDependencyValidation: true,
      enableCircularDependencyDetection: true,
      enablePerformanceMonitoring: true,
      enableHealthChecks: true,

      // Production-specific settings
      timeout: 30000,
      maxRetries: 3,

      // Health check configuration
      healthCheckInterval: 60000, // 1 minute
      healthCheckTimeout: 5000,

      // Monitoring configuration
      metricsCollectionInterval: 10000, // 10 seconds
      enableDetailedMetrics: true,

      // Error handling
      enableGracefulShutdown: true,
      shutdownTimeout: 30000,

      // Lifecycle hooks
      onServiceResolved: (serviceId, instance, context) => {
        console.log(`Production: Resolved ${serviceId}`);
      },

      onServiceError: (serviceId, error, context) => {
        console.error(`Production: Service ${serviceId} error:`, error);
      },

      onShutdown: async () => {
        console.log('Production: Graceful shutdown initiated');
        await ProductionConfiguration.performGracefulShutdown();
      },
    });

    // Register production-specific services
    await ProductionConfiguration.registerProductionServices();

    // Setup monitoring and alerts
    await ProductionConfiguration.setupMonitoring();

    console.log('Production configuration complete');
  }

  /**
   * Registers production-specific services
   */
  private static async registerProductionServices(): Promise<void> {
    // Services are auto-registered via decorators
    // Additional manual registrations can be done here

    const healthCheckService =
      VytchesDDD.resolve<HealthCheckService>('healthCheckService');
    const monitoringService =
      VytchesDDD.resolve<MonitoringService>('monitoringService');

    // Register health checks
    await healthCheckService.performHealthCheck();

    // Start monitoring
    monitoringService.recordMetric('application.startup', 1);
  }

  /**
   * Sets up monitoring and alerts
   */
  private static async setupMonitoring(): Promise<void> {
    const monitoringService =
      VytchesDDD.resolve<MonitoringService>('monitoringService');

    // ⭐ FOCUS: Production monitoring setup

    // Register performance alerts
    monitoringService.registerAlert(
      'high_response_time',
      value => value > 1000, // More than 1 second
      {
        execute: (metricName, value) => {
          console.log(`ALERT: High response time - ${metricName}: ${value}ms`);
          // Send to alerting system (PagerDuty, Slack, etc.)
        },
      }
    );

    // Register error rate alerts
    monitoringService.registerAlert(
      'high_error_rate',
      value => value > 0.05, // More than 5% error rate
      {
        execute: (metricName, value) => {
          console.log(
            `ALERT: High error rate - ${metricName}: ${value * 100}%`
          );
          // Send to alerting system
        },
      }
    );

    // Register resource usage alerts
    monitoringService.registerAlert(
      'high_memory_usage',
      value => value > 0.8, // More than 80% memory usage
      {
        execute: (metricName, value) => {
          console.log(
            `ALERT: High memory usage - ${metricName}: ${value * 100}%`
          );
          // Send to alerting system
        },
      }
    );
  }

  /**
   * Performs graceful shutdown
   */
  private static async performGracefulShutdown(): Promise<void> {
    console.log('Production: Starting graceful shutdown...');

    // Stop accepting new requests
    // Finish processing current requests
    // Close database connections
    // Clear caches
    // Save state if needed

    console.log('Production: Graceful shutdown complete');
  }
}
```

```typescript
// app.ts
import { ProductionConfiguration } from './production/production-configuration';
import { UserServiceWithDegradation } from './production/graceful-degradation.service';
import { HealthCheckService } from './production/health-check.service';
import { MonitoringService } from './production/monitoring.service';
import { VytchesDDD } from '@vytches-ddd/di';
import { CreateUserData } from '../types'; // Import from application

/**
 * Production application demonstrating enterprise patterns
 */
async function runProductionApplication(): Promise<void> {
  console.log('=== Enterprise Production Patterns Demo ===\n');

  try {
    // ⭐ FOCUS: Initialize production configuration
    await ProductionConfiguration.configure();

    console.log('\n1. Production Services Initialized');

    // Get production services
    const userService = VytchesDDD.resolve<UserServiceWithDegradation>(
      'userServiceWithDegradation'
    );
    const healthCheckService =
      VytchesDDD.resolve<HealthCheckService>('healthCheckService');
    const monitoringService =
      VytchesDDD.resolve<MonitoringService>('monitoringService');

    console.log('\n2. Running Health Checks');

    // Perform health check
    const healthStatus = await healthCheckService.performHealthCheck();
    console.log('Health Status:', healthStatus.status);

    console.log('\n3. Testing Graceful Degradation');

    // Test individual user creation
    const userData: CreateUserData = {
      email: 'production@example.com',
      name: 'Production User',
    };

    const user = await userService.createUser(userData);
    console.log('Created user:', user.id);

    // Test bulk operations
    const bulkUserData: CreateUserData[] = [
      { email: 'user1@example.com', name: 'User 1' },
      { email: 'user2@example.com', name: 'User 2' },
      { email: 'user3@example.com', name: 'User 3' },
    ];

    const bulkResult = await userService.createMultipleUsers(bulkUserData);
    console.log(
      `Bulk operation: ${bulkResult.successful.length} successful, ${bulkResult.failed.length} failed`
    );

    console.log('\n4. Monitoring Metrics');

    // Display metrics
    const metrics = monitoringService.getMetrics();
    console.log('Current metrics:', Object.keys(metrics));

    // Simulate some load
    console.log('\n5. Simulating Production Load');

    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(
        userService.createUser({
          email: `loadtest${i}@example.com`,
          name: `Load Test User ${i}`,
        })
      );
    }

    const results = await Promise.allSettled(promises);
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(`Load test: ${successful} successful, ${failed} failed`);

    console.log('\n6. Final Health Check');

    // Final health check
    const finalHealthStatus = await healthCheckService.performHealthCheck();
    console.log('Final Health Status:', finalHealthStatus.status);

    console.log('\n=== Production Demo Complete ===');
  } catch (error) {
    console.error('Production application error:', error);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, initiating graceful shutdown...');
  // Cleanup would be handled by ProductionConfiguration.onShutdown
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT, initiating graceful shutdown...');
  // Cleanup would be handled by ProductionConfiguration.onShutdown
  process.exit(0);
});

// Run the production application
runProductionApplication().catch(console.error);
```

## Key Features

- **Health Monitoring**: Comprehensive health checks for all system components
- **Circuit Breaker Pattern**: Automatic failure detection and recovery
- **Graceful Degradation**: Fallback strategies for service failures
- **Production Metrics**: Detailed performance and usage metrics
- **Alert System**: Configurable alerts for production issues
- **Bulk Operations**: Partial success handling for bulk operations
- **Graceful Shutdown**: Proper cleanup and shutdown procedures
- **Performance Monitoring**: Real-time performance tracking

## Common Pitfalls

- **Over-Monitoring**: Balance detailed monitoring with performance impact
- **Alert Fatigue**: Configure appropriate alert thresholds
- **Fallback Complexity**: Keep fallback logic simple and reliable
- **Resource Leaks**: Ensure proper cleanup in all scenarios
- **Cascade Failures**: Prevent failures from cascading across services
- **Shutdown Race Conditions**: Handle shutdown order carefully

## Related Examples

- [Framework Integration Patterns](./example-1.md) - Framework integration
- [Custom Container Implementation](./example-2.md) - Custom container features
- [Circuit Breaker Pattern](../../resilience/examples/basic/example-1.md) -
  Resilience patterns
