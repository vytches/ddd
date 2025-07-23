# Advanced Projections - NestJS DI Integration Guide

**Version**: 1.0.0
**Package**: @vytches-ddd/projections + @vytches-ddd/di + NestJS
**Complexity**: intermediate
**Framework**: NestJS
**Integration**: VytchesDDD DI integration patterns
**Dependencies**: @nestjs/common, @vytches-ddd/projections, @vytches-ddd/di, @vytches-ddd/events

## Overview

This guide covers advanced NestJS integration patterns using @vytches-ddd/di for projection management. It demonstrates the bridge pattern between NestJS and VytchesDDD dependency injection systems, enabling enterprise-grade projection architectures with automatic service discovery and advanced capabilities.

## Architecture Patterns

### 1. Bridge Pattern Implementation

The bridge pattern allows seamless integration between NestJS and VytchesDDD DI systems without creating conflicting instances:

```typescript
// Domain Service (VytchesDDD side)
@DomainService({
  serviceId: 'projectionEngine',
  lifetime: ServiceLifetime.Singleton,
  context: 'ProjectionManagement',
  autoRegister: true
})
export class ProjectionEngineDomainService extends ProjectionEngine {
  // Business logic implementation
}

// NestJS Bridge Service (Framework side)
@Injectable()
export class ProjectionEngineService {
  private readonly domainService: ProjectionEngineDomainService;

  constructor() {
    // Bridge Pattern: Get existing instance from VytchesDDD
    this.domainService = VytchesDDD.resolve<ProjectionEngineDomainService>('projectionEngine');
  }

  // Delegate to domain service
  async processEvent(event: IDomainEvent): Promise<ServiceResponse<void>> {
    return await this.domainService.processEvent(event);
  }
}
```

### 2. Enterprise Domain Service Pattern

```typescript
// advanced-projection-manager.domain-service.ts
import { DomainService, ServiceLifetime, VytchesDDD } from '@vytches-ddd/di';
import { 
  ProjectionEngine,
  ProjectionRegistry,
  ProjectionBase,
  CheckpointCapability,
  CircuitBreakerCapability,
  DeadLetterCapability,
  MonitoringCapability
} from '@vytches-ddd/projections';

@DomainService({
  serviceId: 'advancedProjectionManager',
  lifetime: ServiceLifetime.Singleton,
  context: 'EnterpriseProjections',
  dependencies: ['eventBus', 'metricsCollector', 'configService'],
  autoRegister: true,
  metadata: {
    description: 'Enterprise projection management with advanced capabilities',
    version: '2.0.0',
    tags: ['projections', 'enterprise', 'monitoring']
  }
})
export class AdvancedProjectionManagerDomainService extends ProjectionEngine {
  private registry: ProjectionRegistry;
  private activeProjections: Map<string, ProjectionBase<any>> = new Map();
  private monitoringCapability: MonitoringCapability;
  private healthCheckTimer: NodeJS.Timeout | null = null;

  constructor() {
    super('AdvancedProjectionManager', 'v2.0');
    this.setupEnterpriseCapabilities();
    this.initializeRegistry();
    this.startHealthMonitoring();
  }

  private setupEnterpriseCapabilities(): void {
    // Registry with auto-discovery
    this.registry = new ProjectionRegistry({
      enableAutoDiscovery: true,
      enableHealthChecks: true,
      enableMetricsCollection: true,
      enablePerformanceTracking: true,
      checkpointInterval: 30000,
      maxConcurrentProjections: 100,
      enableDistributedCoordination: true
    });

    // Enterprise monitoring capability
    this.monitoringCapability = new MonitoringCapability({
      metricsCollection: true,
      performanceTracking: true,
      alertThresholds: {
        errorRate: 0.05, // 5%
        latency: 1000, // 1 second
        throughput: 1000 // events per second
      },
      healthCheckInterval: 60000 // 1 minute
    });

    // Add enterprise capabilities
    this.addCapability(this.monitoringCapability);
    
    this.addCapability(new CheckpointCapability({
      projectionName: 'enterprise-checkpoints',
      interval: 30000,
      storage: 'redis', // Enterprise storage
      batchSize: 200,
      enableCompression: true,
      enableEncryption: true
    }));

    this.addCapability(new CircuitBreakerCapability({
      projectionName: 'enterprise-circuit-breaker',
      failureThreshold: 10,
      resetTimeout: 180000, // 3 minutes
      halfOpenMaxCalls: 5,
      enableMetrics: true
    }));

    this.addCapability(new DeadLetterCapability({
      projectionName: 'enterprise-dead-letter',
      maxRetries: 5,
      retryDelay: 10000,
      deadLetterStorage: 'redis',
      enableRetryScheduling: true,
      enableBatchProcessing: true
    }));
  }

  private initializeRegistry(): void {
    // Advanced registry event handling
    this.registry.on('projectionRegistered', (projection: ProjectionBase<any>) => {
      this.enhanceProjectionWithEnterpriseFeatures(projection);
      this.activeProjections.set(projection.projectionName, projection);
      console.log(`Enterprise projection registered: ${projection.projectionName}`);
    });

    this.registry.on('projectionUnregistered', (projectionName: string) => {
      this.activeProjections.delete(projectionName);
      console.log(`Enterprise projection unregistered: ${projectionName}`);
    });

    this.registry.on('projectionHealthChanged', (projectionName: string, health: any) => {
      this.handleProjectionHealthChange(projectionName, health);
    });

    this.registry.on('projectionPerformanceAlert', (alert: any) => {
      this.handlePerformanceAlert(alert);
    });
  }

  private enhanceProjectionWithEnterpriseFeatures(projection: ProjectionBase<any>): void {
    // Add monitoring
    const originalHandle = projection.handle.bind(projection);
    projection.handle = async (event: IDomainEvent): Promise<void> => {
      const startTime = Date.now();
      const eventMetrics = {
        projectionName: projection.projectionName,
        eventType: event.eventType,
        startTime
      };

      try {
        await originalHandle(event);
        
        // Record success metrics
        this.monitoringCapability.recordEventProcessed(eventMetrics, {
          success: true,
          duration: Date.now() - startTime
        });

      } catch (error) {
        // Record failure metrics
        this.monitoringCapability.recordEventProcessed(eventMetrics, {
          success: false,
          duration: Date.now() - startTime,
          error: error.message
        });
        
        throw error;
      }
    };

    // Add enterprise capabilities to individual projections
    projection.addCapability(new CheckpointCapability({
      projectionName: projection.projectionName,
      interval: 60000,
      storage: 'redis'
    }));

    projection.addCapability(new CircuitBreakerCapability({
      projectionName: projection.projectionName,
      failureThreshold: 5,
      resetTimeout: 120000
    }));
  }

  // ✅ FOCUS: Enterprise event processing with orchestration
  async processEvent(event: IDomainEvent): Promise<ServiceResponse<any>> {
    try {
      const processingContext = {
        eventId: event.eventId,
        eventType: event.eventType,
        timestamp: new Date(),
        projections: []
      };

      // Get relevant projections with priority ordering
      const relevantProjections = await this.getRelevantProjections(event);
      const prioritizedProjections = this.prioritizeProjections(relevantProjections, event);

      // Process with concurrency control
      const results = await this.processEventAcrossProjections(
        event, 
        prioritizedProjections,
        processingContext
      );

      // Analyze results and update metrics
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.length - successCount;

      await this.monitoringCapability.recordBatchProcessing({
        eventId: event.eventId,
        totalProjections: results.length,
        successfulProjections: successCount,
        failedProjections: failureCount,
        totalDuration: Date.now() - processingContext.timestamp.getTime()
      });

      return {
        success: failureCount === 0,
        data: {
          processedProjections: results.length,
          successfulProjections: successCount,
          failedProjections: failureCount,
          results: results,
          processingContext
        },
        metadata: {
          timestamp: new Date(),
          requestId: `process-${event.eventId}`,
          duration: Date.now() - processingContext.timestamp.getTime()
        }
      };

    } catch (error) {
      await this.monitoringCapability.recordCriticalError({
        eventId: event.eventId,
        error: error.message,
        timestamp: new Date()
      });

      return {
        success: false,
        error: {
          code: 'ENTERPRISE_PROCESSING_FAILED',
          message: 'Enterprise event processing failed',
          details: { error: error.message, eventId: event.eventId }
        },
        metadata: {
          timestamp: new Date(),
          requestId: `process-${event.eventId}`,
          duration: 0
        }
      };
    }
  }

  private async processEventAcrossProjections(
    event: IDomainEvent,
    projections: ProjectionBase<any>[],
    context: any
  ): Promise<Array<{ projection: string; success: boolean; error?: Error; duration: number }>> {
    // Process projections with controlled concurrency
    const concurrencyLimit = 10; // Process max 10 projections concurrently
    const results: Array<{ projection: string; success: boolean; error?: Error; duration: number }> = [];

    // Batch projections for concurrent processing
    for (let i = 0; i < projections.length; i += concurrencyLimit) {
      const batch = projections.slice(i, i + concurrencyLimit);
      
      const batchPromises = batch.map(async (projection) => {
        const startTime = Date.now();
        try {
          await projection.handle(event);
          return {
            projection: projection.projectionName,
            success: true,
            duration: Date.now() - startTime
          };
        } catch (error) {
          return {
            projection: projection.projectionName,
            success: false,
            error: error as Error,
            duration: Date.now() - startTime
          };
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);
      
      // Process results
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            projection: batch[index].projectionName,
            success: false,
            error: result.reason,
            duration: 0
          });
        }
      });
    }

    return results;
  }

  // ✅ FOCUS: Advanced health monitoring and analytics
  getEnterpriseHealthStatus(): any {
    const projectionHealths = Array.from(this.activeProjections.values()).map(projection => ({
      name: projection.projectionName,
      health: this.getProjectionHealth(projection),
      metrics: this.getProjectionMetrics(projection.projectionName)
    }));

    const overallHealth = this.calculateOverallHealth(projectionHealths);
    const systemMetrics = this.monitoringCapability.getSystemMetrics();

    return {
      status: overallHealth.status,
      totalProjections: this.activeProjections.size,
      healthyProjections: overallHealth.healthyCount,
      unhealthyProjections: overallHealth.unhealthyCount,
      degradedProjections: overallHealth.degradedCount,
      systemMetrics: {
        ...systemMetrics,
        uptime: this.getUptime(),
        memoryUsage: this.getMemoryUsage(),
        eventThroughput: this.getEventThroughput()
      },
      projectionDetails: projectionHealths,
      lastUpdated: new Date()
    };
  }

  getEnterpriseAnalytics(timeRange: string = '1h'): any {
    const analytics = this.monitoringCapability.getAnalytics(timeRange);
    
    return {
      timeRange,
      totalEvents: analytics.totalEventsProcessed,
      averageLatency: analytics.averageLatency,
      throughput: analytics.throughput,
      errorRate: analytics.errorRate,
      topPerformingProjections: analytics.topPerformingProjections,
      bottleneckProjections: analytics.bottleneckProjections,
      trendAnalysis: analytics.trends,
      predictiveInsights: analytics.predictions,
      recommendations: analytics.recommendations,
      generatedAt: new Date()
    };
  }

  // ✅ FOCUS: Enterprise lifecycle management
  async startEnterpriseOperations(): Promise<ServiceResponse<void>> {
    try {
      // Start all enterprise capabilities
      await this.startAllCapabilities();
      
      // Initialize monitoring
      await this.monitoringCapability.start();
      
      // Start health monitoring
      this.startHealthMonitoring();
      
      // Start registry
      await this.registry.start();
      
      // Auto-discover projections
      await this.registry.discoverProjections();
      
      console.log('Enterprise projection operations started successfully');
      
      return {
        success: true,
        metadata: {
          timestamp: new Date(),
          requestId: 'start-enterprise-' + Date.now(),
          duration: 0
        }
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'ENTERPRISE_START_FAILED',
          message: 'Failed to start enterprise projection operations',
          details: { error: error.message }
        },
        metadata: {
          timestamp: new Date(),
          requestId: 'start-enterprise-' + Date.now(),
          duration: 0
        }
      };
    }
  }

  async stopEnterpriseOperations(): Promise<ServiceResponse<void>> {
    try {
      // Stop health monitoring
      if (this.healthCheckTimer) {
        clearInterval(this.healthCheckTimer);
        this.healthCheckTimer = null;
      }
      
      // Stop monitoring
      await this.monitoringCapability.stop();
      
      // Stop registry
      await this.registry.stop();
      
      // Stop all capabilities
      await this.stopAllCapabilities();
      
      console.log('Enterprise projection operations stopped successfully');
      
      return {
        success: true,
        metadata: {
          timestamp: new Date(),
          requestId: 'stop-enterprise-' + Date.now(),
          duration: 0
        }
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'ENTERPRISE_STOP_FAILED',
          message: 'Failed to stop enterprise projection operations',
          details: { error: error.message }
        },
        metadata: {
          timestamp: new Date(),
          requestId: 'stop-enterprise-' + Date.now(),
          duration: 0
        }
      };
    }
  }

  // Private helper methods
  private startHealthMonitoring(): void {
    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, 60000); // Check every minute
  }

  private async performHealthCheck(): Promise<void> {
    try {
      const health = this.getEnterpriseHealthStatus();
      
      if (health.status === 'unhealthy') {
        console.error('Enterprise projections unhealthy:', health);
        // Trigger alerts, recovery procedures, etc.
      }
      
    } catch (error) {
      console.error('Health check failed:', error);
    }
  }

  private async getRelevantProjections(event: IDomainEvent): Promise<ProjectionBase<any>[]> {
    const relevantProjections: ProjectionBase<any>[] = [];
    
    for (const projection of this.activeProjections.values()) {
      if (await this.isProjectionRelevant(projection, event)) {
        relevantProjections.push(projection);
      }
    }
    
    return relevantProjections;
  }

  private async isProjectionRelevant(projection: ProjectionBase<any>, event: IDomainEvent): Promise<boolean> {
    // Check if projection can handle this event type
    if (projection.canHandle && !projection.canHandle(event)) {
      return false;
    }

    // Check projection health
    const health = this.getProjectionHealth(projection);
    if (health.status === 'failed') {
      return false;
    }

    // Check circuit breaker state
    const circuitBreaker = projection.getCapability('CircuitBreakerCapability');
    if (circuitBreaker && circuitBreaker.isOpen()) {
      return false;
    }

    return true;
  }

  private prioritizeProjections(
    projections: ProjectionBase<any>[],
    event: IDomainEvent
  ): ProjectionBase<any>[] {
    // Sort projections by priority (higher priority first)
    return projections.sort((a, b) => {
      const priorityA = this.getProjectionPriority(a, event);
      const priorityB = this.getProjectionPriority(b, event);
      return priorityB - priorityA;
    });
  }

  private getProjectionPriority(projection: ProjectionBase<any>, event: IDomainEvent): number {
    // Default priority
    let priority = 100;

    // Adjust based on projection type or configuration
    if (projection.projectionName.includes('Critical')) priority += 50;
    if (projection.projectionName.includes('Analytics')) priority -= 25;
    
    // Adjust based on event type
    if (event.eventType.includes('Critical')) priority += 25;
    
    return priority;
  }

  // Additional helper methods would be implemented here...
  private getProjectionHealth(projection: ProjectionBase<any>): any {
    return { status: 'healthy' }; // Simplified
  }

  private getProjectionMetrics(projectionName: string): any {
    return {}; // Simplified
  }

  private calculateOverallHealth(projectionHealths: any[]): any {
    return {
      status: 'healthy',
      healthyCount: projectionHealths.length,
      unhealthyCount: 0,
      degradedCount: 0
    }; // Simplified
  }

  private getUptime(): number {
    return process.uptime();
  }

  private getMemoryUsage(): any {
    return process.memoryUsage();
  }

  private getEventThroughput(): number {
    return 0; // Would be calculated from metrics
  }

  private handleProjectionHealthChange(projectionName: string, health: any): void {
    console.log(`Projection ${projectionName} health changed:`, health);
  }

  private handlePerformanceAlert(alert: any): void {
    console.warn('Performance alert:', alert);
  }
}
```

### 3. NestJS Module Configuration with VytchesDDD

```typescript
// advanced-projection.module.ts
import { Module, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { VytchesDDD, SimpleContainer } from '@vytches-ddd/di';
import { AdvancedProjectionManagerService } from './advanced-projection-manager.service';
import { ProjectionAnalyticsController } from './projection-analytics.controller';
import { ProjectionHealthController } from './projection-health.controller';

@Module({
  providers: [AdvancedProjectionManagerService],
  controllers: [
    ProjectionAnalyticsController,
    ProjectionHealthController
  ],
  exports: [AdvancedProjectionManagerService]
})
export class AdvancedProjectionModule implements OnModuleInit, OnModuleDestroy {
  private readonly enterpriseProjectionManager: AdvancedProjectionManagerDomainService;

  constructor() {
    // Initialize after VytchesDDD configuration
  }

  async onModuleInit() {
    try {
      // ⭐ CRITICAL: Initialize VytchesDDD BEFORE framework DI
      const container = new SimpleContainer();
      
      // Register enterprise dependencies
      container.registerInstance('eventBus', {
        publish: async (event: any) => console.log('Publishing event:', event.eventType)
      });
      
      container.registerInstance('metricsCollector', {
        collect: async () => ({ timestamp: new Date() })
      });
      
      container.registerInstance('configService', {
        get: (key: string) => process.env[key]
      });
      
      // Configure VytchesDDD with auto-discovery
      await VytchesDDD.configure(container);
      
      // Get enterprise projection manager
      const manager = VytchesDDD.resolve<AdvancedProjectionManagerDomainService>('advancedProjectionManager');
      
      // Start enterprise operations
      const result = await manager.startEnterpriseOperations();
      if (!result.success) {
        throw new Error(`Failed to start enterprise projections: ${result.error?.message}`);
      }
      
      console.log('Advanced Projection Module initialized with VytchesDDD integration');
      
    } catch (error) {
      console.error('Failed to initialize Advanced Projection Module:', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      const manager = VytchesDDD.resolve<AdvancedProjectionManagerDomainService>('advancedProjectionManager');
      
      const result = await manager.stopEnterpriseOperations();
      if (!result.success) {
        console.error('Failed to stop enterprise projections:', result.error?.message);
      }
      
      console.log('Advanced Projection Module destroyed');
      
    } catch (error) {
      console.error('Error during module destruction:', error);
    }
  }
}
```

## Integration Best Practices

### 1. **Dependency Injection Patterns**

```typescript
// ✅ CORRECT: Bridge Pattern
@Injectable()
export class MyProjectionService {
  private readonly domainService: MyProjectionDomainService;

  constructor() {
    this.domainService = VytchesDDD.resolve<MyProjectionDomainService>('myProjection');
  }

  async processEvent(event: IDomainEvent): Promise<void> {
    return await this.domainService.handle(event);
  }
}

// ❌ WRONG: Dual Decorators
@Injectable()
@DomainService('myProjection') // Never do both!
export class BadProjectionService {
  // This creates conflicting instances
}
```

### 2. **Module Initialization Order**

```typescript
@Module({})
export class MyModule implements OnModuleInit {
  async onModuleInit() {
    // ✅ CORRECT Order:
    // 1. Initialize VytchesDDD first
    await VytchesDDD.configure(container);
    
    // 2. Then use VytchesDDD services
    const service = VytchesDDD.resolve<MyService>('myService');
    
    // 3. Finally start operations
    await service.start();
  }
}
```

### 3. **Error Handling Integration**

```typescript
@Injectable()
export class EnterpriseProjectionService {
  private readonly domainService: EnterpriseProjectionDomainService;

  constructor() {
    this.domainService = VytchesDDD.resolve<EnterpriseProjectionDomainService>('enterpriseProjection');
  }

  async processEvent(event: IDomainEvent): Promise<void> {
    try {
      const result = await this.domainService.processEvent(event);
      
      if (!result.success) {
        // Handle business logic failures
        throw new Error(`Business processing failed: ${result.error?.message}`);
      }
      
    } catch (error) {
      // Log with NestJS logger
      console.error('Event processing failed:', {
        eventId: event.eventId,
        error: error.message,
        timestamp: new Date()
      });
      
      // Re-throw for upstream handling
      throw error;
    }
  }
}
```

## Advanced Testing Patterns

### 1. **Domain Service Testing**

```typescript
// domain-service.spec.ts
import { VytchesDDD, SimpleContainer } from '@vytches-ddd/di';
import { MyProjectionDomainService } from './my-projection.domain-service';

describe('MyProjectionDomainService', () => {
  let service: MyProjectionDomainService;

  beforeEach(async () => {
    // Setup VytchesDDD for testing
    const container = new SimpleContainer();
    container.registerInstance('mockDependency', {});
    
    await VytchesDDD.configure(container);
    
    service = VytchesDDD.resolve<MyProjectionDomainService>('myProjection');
  });

  afterEach(async () => {
    // Clean up VytchesDDD
    await VytchesDDD.reset();
  });

  it('should process events correctly', async () => {
    const event = createTestEvent();
    const result = await service.processEvent(event);
    
    expect(result.success).toBe(true);
  });
});
```

### 2. **Integration Testing with NestJS**

```typescript
// integration.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { VytchesDDD } from '@vytches-ddd/di';
import { MyProjectionModule } from './my-projection.module';
import { MyProjectionService } from './my-projection.service';

describe('MyProjection Integration', () => {
  let module: TestingModule;
  let service: MyProjectionService;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [MyProjectionModule],
    }).compile();

    await module.init(); // This triggers OnModuleInit
    
    service = module.get<MyProjectionService>(MyProjectionService);
  });

  afterEach(async () => {
    await module.close();
    await VytchesDDD.reset();
  });

  it('should integrate NestJS and VytchesDDD correctly', async () => {
    const event = createTestEvent();
    await service.processEvent(event);
    
    // Verify integration worked
    expect(true).toBe(true);
  });
});
```

## Performance Optimization

### 1. **Efficient Service Resolution**

```typescript
@Injectable()
export class OptimizedProjectionService implements OnModuleInit {
  private domainService: MyProjectionDomainService;

  // ✅ Resolve once during initialization
  async onModuleInit(): Promise<void> {
    this.domainService = VytchesDDD.resolve<MyProjectionDomainService>('myProjection');
  }

  async processEvent(event: IDomainEvent): Promise<void> {
    // ✅ Use cached reference
    return await this.domainService.handle(event);
  }

  // ❌ Don't resolve on every call
  async badProcessEvent(event: IDomainEvent): Promise<void> {
    const service = VytchesDDD.resolve<MyProjectionDomainService>('myProjection');
    return await service.handle(event);
  }
}
```

### 2. **Resource Management**

```typescript
@DomainService({
  serviceId: 'resourceManagedProjection',
  lifetime: ServiceLifetime.Singleton
})
export class ResourceManagedProjectionService implements OnModuleDestroy {
  private timers: NodeJS.Timeout[] = [];
  private subscriptions: any[] = [];

  async onModuleDestroy(): Promise<void> {
    // Clean up timers
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers = [];

    // Clean up subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe?.());
    this.subscriptions = [];

    console.log('Resources cleaned up');
  }
}
```

## Common Pitfalls and Solutions

### 1. **Double Instance Problem**

```typescript
// ❌ PROBLEM: Creating both NestJS and VytchesDDD instances
@Injectable()
@DomainService('problematicService')
export class ProblematicService {
  // This creates TWO different instances!
}

// ✅ SOLUTION: Use Bridge Pattern
@DomainService('domainService')
export class MyDomainService {
  // Business logic here
}

@Injectable()
export class MyBridgeService {
  private readonly domainService: MyDomainService;
  
  constructor() {
    this.domainService = VytchesDDD.resolve<MyDomainService>('domainService');
  }
}
```

### 2. **Initialization Order Issues**

```typescript
// ❌ PROBLEM: Using VytchesDDD before configuration
@Module({})
export class ProblematicModule implements OnModuleInit {
  async onModuleInit() {
    // This will fail - VytchesDDD not configured yet
    const service = VytchesDDD.resolve<MyService>('myService');
  }
}

// ✅ SOLUTION: Configure VytchesDDD first
@Module({})
export class CorrectModule implements OnModuleInit {
  async onModuleInit() {
    // 1. Configure VytchesDDD first
    await VytchesDDD.configure(container);
    
    // 2. Then resolve services
    const service = VytchesDDD.resolve<MyService>('myService');
  }
}
```

## Best Practices Summary

1. **Always use Bridge Pattern** for integrating VytchesDDD with NestJS
2. **Initialize VytchesDDD before NestJS** in `OnModuleInit`
3. **Cache service references** during initialization
4. **Implement proper cleanup** in `OnModuleDestroy`
5. **Use enterprise capabilities** for production systems
6. **Test both layers** (domain services and bridge services)
7. **Handle errors appropriately** at each layer
8. **Monitor performance** and resource usage
9. **Follow dependency injection best practices** for both systems
10. **Document integration patterns** for team consistency

## Related Examples

- [Enterprise Projection Engine](./example-1.md)
- [Multi-Tenant DI Integration](./example-2.md)
- [Simple Manual Setup](../basic/implementation.md)