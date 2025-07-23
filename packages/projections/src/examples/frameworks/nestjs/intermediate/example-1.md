# Advanced Projection Engine - NestJS DI Integration

**Version**: 1.0.0 **Package**: @vytches-ddd/projections + @vytches-ddd/di +
NestJS **Complexity**: intermediate **Framework**: NestJS **Integration**:
VytchesDDD DI integration **Dependencies**: @nestjs/common,
@vytches-ddd/projections, @vytches-ddd/di, @vytches-ddd/events

## Description

Advanced NestJS service implementing projection engine with @vytches-ddd/di
integration, automatic service discovery, and enterprise-grade projection
management. This example shows the bridge pattern between NestJS and VytchesDDD
dependency injection systems.

## Business Context

Enterprise applications require sophisticated projection management with
automatic discovery, lifecycle management, performance monitoring, and seamless
integration with existing NestJS infrastructure while leveraging VytchesDDD's
advanced capabilities.

## Domain Service with VytchesDDD DI

```typescript
// projection-engine.domain-service.ts
import { DomainService, ServiceLifetime } from '@vytches-ddd/di';
import {
  ProjectionEngine,
  ProjectionBase,
  ProjectionRegistry,
  ProjectionCapability,
  CheckpointCapability,
  CircuitBreakerCapability,
  DeadLetterCapability,
} from '@vytches-ddd/projections';
import { IDomainEvent, IEventBus } from '@vytches-ddd/events';
import {
  ProjectionEngineConfig,
  ProjectionMetrics,
  ServiceResponse,
  UserData,
  OrderData,
  ProjectionData,
} from '../types'; // From your application

// ⭐ FOCUS: VytchesDDD Domain Service with enterprise capabilities
@DomainService({
  serviceId: 'projectionEngine',
  lifetime: ServiceLifetime.Singleton,
  context: 'ProjectionManagement',
  dependencies: ['eventBus', 'metricsService'],
  autoRegister: true,
})
export class ProjectionEngineDomainService extends ProjectionEngine {
  private registry: ProjectionRegistry;
  private activeProjections: Map<string, ProjectionBase<any>> = new Map();
  private projectionMetrics: Map<string, ProjectionMetrics> = new Map();
  private eventBus: IEventBus;

  constructor(config: ProjectionEngineConfig) {
    super('EnterpriseProjectionEngine', 'v2.0');

    this.setupProjectionEngine(config);
    this.initializeRegistry();
  }

  private setupProjectionEngine(config: ProjectionEngineConfig): void {
    this.registry = new ProjectionRegistry({
      enableAutoDiscovery: true,
      enableHealthChecks: true,
      enableMetricsCollection: true,
      checkpointInterval: config.checkpointInterval || 60000,
      maxConcurrentProjections: config.maxConcurrentProjections || 50,
    });

    // Initialize with enterprise capabilities
    this.addCapability(
      new CheckpointCapability({
        storage: 'memory', // In production, use persistent storage
        interval: 30000,
        batchSize: 100,
      })
    );

    this.addCapability(
      new CircuitBreakerCapability({
        failureThreshold: 5,
        resetTimeout: 60000,
        halfOpenMaxCalls: 3,
      })
    );

    this.addCapability(
      new DeadLetterCapability({
        maxRetries: 3,
        retryDelay: 5000,
        deadLetterStorage: 'memory',
      })
    );
  }

  private initializeRegistry(): void {
    // Setup projection discovery
    this.registry.on(
      'projectionDiscovered',
      (projection: ProjectionBase<any>) => {
        this.handleProjectionDiscovered(projection);
      }
    );

    this.registry.on(
      'projectionFailed',
      (projectionId: string, error: Error) => {
        this.handleProjectionFailure(projectionId, error);
      }
    );

    this.registry.on('projectionRecovered', (projectionId: string) => {
      this.handleProjectionRecovery(projectionId);
    });
  }

  // ✅ FOCUS: Enterprise projection registration with capabilities
  async registerProjection(
    projection: ProjectionBase<any>
  ): Promise<ServiceResponse<void>> {
    try {
      // Enhanced projection setup
      const enhancedProjection = this.enhanceProjection(projection);

      // Register with registry
      await this.registry.register(enhancedProjection);
      this.activeProjections.set(projection.projectionName, enhancedProjection);

      // Initialize metrics tracking
      this.initializeProjectionMetrics(projection.projectionName);

      console.log(
        `Projection registered with enterprise capabilities: ${projection.projectionName}`
      );

      return {
        success: true,
        metadata: {
          timestamp: new Date(),
          requestId: 'register-' + Date.now(),
          duration: 0,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'REGISTRATION_FAILED',
          message: 'Failed to register projection',
          details: {
            error: (error as Error).message,
            projectionName: projection.projectionName,
          },
        },
        metadata: {
          timestamp: new Date(),
          requestId: 'register-' + Date.now(),
          duration: 0,
        },
      };
    }
  }

  private enhanceProjection(
    projection: ProjectionBase<any>
  ): ProjectionBase<any> {
    // Add enterprise capabilities to projection
    projection.addCapability(
      new CheckpointCapability({
        projectionName: projection.projectionName,
        interval: 30000,
        batchSize: 100,
      })
    );

    projection.addCapability(
      new CircuitBreakerCapability({
        projectionName: projection.projectionName,
        failureThreshold: 5,
        resetTimeout: 60000,
      })
    );

    projection.addCapability(
      new DeadLetterCapability({
        projectionName: projection.projectionName,
        maxRetries: 3,
        retryDelay: 5000,
      })
    );

    // Override handle method to add metrics collection
    const originalHandle = projection.handle.bind(projection);
    projection.handle = async (event: IDomainEvent): Promise<void> => {
      const startTime = Date.now();
      try {
        await originalHandle(event);
        this.recordProjectionMetrics(
          projection.projectionName,
          'success',
          Date.now() - startTime
        );
      } catch (error) {
        this.recordProjectionMetrics(
          projection.projectionName,
          'error',
          Date.now() - startTime
        );
        throw error;
      }
    };

    return projection;
  }

  // ✅ FOCUS: Enterprise event processing with monitoring
  async processEvent(event: IDomainEvent): Promise<ServiceResponse<void>> {
    const processingResults: Array<{
      projection: string;
      success: boolean;
      error?: Error;
    }> = [];

    try {
      const relevantProjections = await this.findRelevantProjections(event);

      const processingPromises = relevantProjections.map(async projection => {
        try {
          await projection.handle(event);
          return { projection: projection.projectionName, success: true };
        } catch (error) {
          console.error(
            `Projection ${projection.projectionName} failed to process event ${event.eventId}:`,
            error
          );
          return {
            projection: projection.projectionName,
            success: false,
            error: error as Error,
          };
        }
      });

      const results = await Promise.allSettled(processingPromises);
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          processingResults.push(result.value);
        } else {
          processingResults.push({
            projection: relevantProjections[index].projectionName,
            success: false,
            error: result.reason,
          });
        }
      });

      const successCount = processingResults.filter(r => r.success).length;
      const failureCount = processingResults.length - successCount;

      return {
        success: failureCount === 0,
        data: {
          processedProjections: processingResults.length,
          successfulProjections: successCount,
          failedProjections: failureCount,
          results: processingResults,
        } as any,
        metadata: {
          timestamp: new Date(),
          requestId: 'process-' + event.eventId,
          duration: 0,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'EVENT_PROCESSING_FAILED',
          message: 'Failed to process event across projections',
          details: { error: (error as Error).message, eventId: event.eventId },
        },
        metadata: {
          timestamp: new Date(),
          requestId: 'process-' + event.eventId,
          duration: 0,
        },
      };
    }
  }

  private async findRelevantProjections(
    event: IDomainEvent
  ): Promise<ProjectionBase<any>[]> {
    const relevantProjections: ProjectionBase<any>[] = [];

    for (const projection of this.activeProjections.values()) {
      if (projection.canHandle && projection.canHandle(event)) {
        relevantProjections.push(projection);
      } else {
        // Default: all projections handle all events (can be customized)
        relevantProjections.push(projection);
      }
    }

    return relevantProjections;
  }

  // ✅ FOCUS: Enterprise metrics and monitoring
  getProjectionMetrics(
    projectionName?: string
  ): ProjectionMetrics | Map<string, ProjectionMetrics> {
    if (projectionName) {
      return (
        this.projectionMetrics.get(projectionName) ||
        this.createEmptyMetrics(projectionName)
      );
    }
    return this.projectionMetrics;
  }

  getEngineHealthStatus(): any {
    const totalProjections = this.activeProjections.size;
    const healthyProjections = Array.from(
      this.activeProjections.values()
    ).filter(p => this.isProjectionHealthy(p)).length;

    const overallMetrics = this.calculateOverallMetrics();

    return {
      status: healthyProjections === totalProjections ? 'healthy' : 'degraded',
      totalProjections,
      healthyProjections,
      unhealthyProjections: totalProjections - healthyProjections,
      averageLatency: overallMetrics.averageLatency,
      totalEventsProcessed: overallMetrics.totalEventsProcessed,
      errorRate: overallMetrics.errorRate,
      lastUpdated: new Date(),
    };
  }

  // ✅ FOCUS: Advanced projection lifecycle management
  async startAllProjections(): Promise<ServiceResponse<void>> {
    const startResults: Array<{ projection: string; success: boolean }> = [];

    for (const projection of this.activeProjections.values()) {
      try {
        // Start projection (if it has a start method)
        if ('start' in projection && typeof projection.start === 'function') {
          await projection.start();
        }
        startResults.push({
          projection: projection.projectionName,
          success: true,
        });
        console.log(`Started projection: ${projection.projectionName}`);
      } catch (error) {
        startResults.push({
          projection: projection.projectionName,
          success: false,
        });
        console.error(
          `Failed to start projection ${projection.projectionName}:`,
          error
        );
      }
    }

    const successCount = startResults.filter(r => r.success).length;

    return {
      success: successCount === startResults.length,
      data: {
        totalProjections: startResults.length,
        successfulStarts: successCount,
        failedStarts: startResults.length - successCount,
        results: startResults,
      } as any,
      metadata: {
        timestamp: new Date(),
        requestId: 'start-all-' + Date.now(),
        duration: 0,
      },
    };
  }

  async stopAllProjections(): Promise<ServiceResponse<void>> {
    const stopResults: Array<{ projection: string; success: boolean }> = [];

    for (const projection of this.activeProjections.values()) {
      try {
        // Stop projection (if it has a stop method)
        if ('stop' in projection && typeof projection.stop === 'function') {
          await projection.stop();
        }
        stopResults.push({
          projection: projection.projectionName,
          success: true,
        });
        console.log(`Stopped projection: ${projection.projectionName}`);
      } catch (error) {
        stopResults.push({
          projection: projection.projectionName,
          success: false,
        });
        console.error(
          `Failed to stop projection ${projection.projectionName}:`,
          error
        );
      }
    }

    return {
      success: true, // We don't fail the entire operation if some projections fail to stop
      data: stopResults as any,
      metadata: {
        timestamp: new Date(),
        requestId: 'stop-all-' + Date.now(),
        duration: 0,
      },
    };
  }

  // Private helper methods
  private initializeProjectionMetrics(projectionName: string): void {
    this.projectionMetrics.set(
      projectionName,
      this.createEmptyMetrics(projectionName)
    );
  }

  private createEmptyMetrics(projectionName: string): ProjectionMetrics {
    return {
      projectionName,
      totalEventsProcessed: 0,
      successfulEvents: 0,
      failedEvents: 0,
      averageLatency: 0,
      lastEventTime: null,
      errorRate: 0,
      isHealthy: true,
    };
  }

  private recordProjectionMetrics(
    projectionName: string,
    status: 'success' | 'error',
    latency: number
  ): void {
    let metrics = this.projectionMetrics.get(projectionName);
    if (!metrics) {
      metrics = this.createEmptyMetrics(projectionName);
      this.projectionMetrics.set(projectionName, metrics);
    }

    metrics.totalEventsProcessed++;
    if (status === 'success') {
      metrics.successfulEvents++;
    } else {
      metrics.failedEvents++;
    }

    // Calculate rolling average latency
    metrics.averageLatency =
      (metrics.averageLatency * (metrics.totalEventsProcessed - 1) + latency) /
      metrics.totalEventsProcessed;
    metrics.errorRate = metrics.failedEvents / metrics.totalEventsProcessed;
    metrics.lastEventTime = new Date();
    metrics.isHealthy = metrics.errorRate < 0.1; // 10% error threshold
  }

  private isProjectionHealthy(projection: ProjectionBase<any>): boolean {
    const metrics = this.projectionMetrics.get(projection.projectionName);
    return metrics ? metrics.isHealthy : true;
  }

  private calculateOverallMetrics(): any {
    const allMetrics = Array.from(this.projectionMetrics.values());

    if (allMetrics.length === 0) {
      return { averageLatency: 0, totalEventsProcessed: 0, errorRate: 0 };
    }

    const totalEvents = allMetrics.reduce(
      (sum, m) => sum + m.totalEventsProcessed,
      0
    );
    const totalErrors = allMetrics.reduce((sum, m) => sum + m.failedEvents, 0);
    const averageLatency =
      allMetrics.reduce((sum, m) => sum + m.averageLatency, 0) /
      allMetrics.length;

    return {
      averageLatency,
      totalEventsProcessed: totalEvents,
      errorRate: totalEvents > 0 ? totalErrors / totalEvents : 0,
    };
  }

  private handleProjectionDiscovered(projection: ProjectionBase<any>): void {
    console.log(`Projection discovered: ${projection.projectionName}`);
    // Auto-register discovered projections
    this.registerProjection(projection);
  }

  private handleProjectionFailure(projectionId: string, error: Error): void {
    console.error(`Projection ${projectionId} failed:`, error);
    // Implement failure handling logic
  }

  private handleProjectionRecovery(projectionId: string): void {
    console.log(`Projection ${projectionId} recovered`);
    // Reset metrics or perform recovery actions
  }
}
```

## NestJS Bridge Service

```typescript
// projection-engine.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { VytchesDDD } from '@vytches-ddd/di';
import { ProjectionEngineDomainService } from './projection-engine.domain-service';
import { IDomainEvent } from '@vytches-ddd/events';
import { ServiceResponse } from '../types'; // From your application

@Injectable()
export class ProjectionEngineService implements OnModuleInit, OnModuleDestroy {
  private readonly projectionEngine: ProjectionEngineDomainService;

  constructor() {
    // ⭐ FOCUS: Bridge Pattern - Get existing instance from VytchesDDD
    this.projectionEngine =
      VytchesDDD.resolve<ProjectionEngineDomainService>('projectionEngine');
  }

  async onModuleInit(): Promise<void> {
    console.log('ProjectionEngineService: Initializing projection engine');

    // Start all registered projections
    const startResult = await this.projectionEngine.startAllProjections();
    if (!startResult.success) {
      console.error('Failed to start some projections:', startResult.data);
    }

    console.log('ProjectionEngineService: Projection engine initialized');
  }

  async onModuleDestroy(): Promise<void> {
    console.log('ProjectionEngineService: Stopping projection engine');

    const stopResult = await this.projectionEngine.stopAllProjections();
    if (!stopResult.success) {
      console.error('Failed to stop some projections:', stopResult.data);
    }

    console.log('ProjectionEngineService: Projection engine stopped');
  }

  // ✅ FOCUS: Delegate to VytchesDDD instance
  async processEvent(event: IDomainEvent): Promise<ServiceResponse<void>> {
    return await this.projectionEngine.processEvent(event);
  }

  getHealthStatus(): any {
    return this.projectionEngine.getEngineHealthStatus();
  }

  getProjectionMetrics(projectionName?: string): any {
    return this.projectionEngine.getProjectionMetrics(projectionName);
  }

  async registerProjection(projection: any): Promise<ServiceResponse<void>> {
    return await this.projectionEngine.registerProjection(projection);
  }
}
```

## Controller Integration

```typescript
// projection-management.controller.ts
import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ProjectionEngineService } from './projection-engine.service';
import { IDomainEvent } from '@vytches-ddd/events';

@Controller('api/projections')
export class ProjectionManagementController {
  constructor(private readonly projectionEngine: ProjectionEngineService) {}

  @Get('health')
  getHealthStatus() {
    return this.projectionEngine.getHealthStatus();
  }

  @Get('metrics')
  getAllMetrics() {
    return this.projectionEngine.getProjectionMetrics();
  }

  @Get('metrics/:projectionName')
  getProjectionMetrics(@Param('projectionName') projectionName: string) {
    return this.projectionEngine.getProjectionMetrics(projectionName);
  }

  @Post('events')
  async processEvent(@Body() event: IDomainEvent) {
    const result = await this.projectionEngine.processEvent(event);
    if (!result.success) {
      throw new Error(`Event processing failed: ${result.error?.message}`);
    }
    return result.data;
  }
}
```

## Module Configuration

```typescript
// projection-management.module.ts
import { Module, OnModuleInit } from '@nestjs/common';
import { VytchesDDD, SimpleContainer } from '@vytches-ddd/di';
import { ProjectionEngineDomainService } from './projection-engine.domain-service';
import { ProjectionEngineService } from './projection-engine.service';
import { ProjectionManagementController } from './projection-management.controller';

@Module({
  providers: [ProjectionEngineService],
  controllers: [ProjectionManagementController],
  exports: [ProjectionEngineService],
})
export class ProjectionManagementModule implements OnModuleInit {
  async onModuleInit() {
    // ⭐ CRITICAL: Initialize VytchesDDD BEFORE framework DI
    const container = new SimpleContainer();

    // Register projection engine configuration
    container.registerInstance('projectionEngineConfig', {
      checkpointInterval: 60000,
      maxConcurrentProjections: 50,
    });

    // Configure VytchesDDD with auto-discovery
    await VytchesDDD.configure(container);

    console.log('VytchesDDD configured for projection management');
  }
}
```

## Usage Example

```typescript
// app.service.ts
import { Injectable } from '@nestjs/common';
import { ProjectionEngineService } from './projection-management/projection-engine.service';
import { IDomainEvent } from '@vytches-ddd/events';

@Injectable()
export class AppService {
  constructor(private readonly projectionEngine: ProjectionEngineService) {}

  async handleBusinessEvent(eventData: any): Promise<void> {
    const event: IDomainEvent = {
      eventId: 'evt-' + Date.now(),
      eventType: eventData.type,
      aggregateId: eventData.aggregateId,
      payload: eventData.payload,
      timestamp: new Date(),
      version: 1,
    };

    const result = await this.projectionEngine.processEvent(event);

    if (result.success) {
      console.log(
        `Event processed across ${result.data.processedProjections} projections`
      );
    } else {
      console.error('Event processing failed:', result.error);
      throw new Error(`Event processing failed: ${result.error?.message}`);
    }
  }

  async getSystemHealth(): Promise<any> {
    return {
      projectionEngine: this.projectionEngine.getHealthStatus(),
      timestamp: new Date(),
    };
  }
}
```

## Key Features

- **Bridge Pattern**: Seamless integration between NestJS and VytchesDDD DI
- **Enterprise Capabilities**: Automatic checkpoints, circuit breakers, dead
  letter queues
- **Metrics & Monitoring**: Comprehensive projection performance tracking
- **Lifecycle Management**: Proper initialization and cleanup in NestJS context
- **Health Monitoring**: Real-time projection health status
- **Auto-Discovery**: Automatic projection registration and discovery
- **Error Handling**: Enterprise-grade error handling and recovery

## Best Practices

- Always initialize VytchesDDD before NestJS module initialization
- Use bridge pattern to avoid dual instance issues
- Implement comprehensive health checks and metrics
- Handle projection failures gracefully
- Use proper lifecycle hooks for cleanup
- Monitor projection performance continuously

## Common Pitfalls

- **Initialization Order**: VytchesDDD must be configured before NestJS DI
- **Double Instance**: Never create both `@Injectable` and `@DomainService` on
  same class
- **Metrics Overflow**: Implement metric rotation for long-running systems
- **Memory Leaks**: Properly clean up projection instances and event handlers

## Related Examples

- [Simple Projection Manual Setup](../basic/example-1.md)
- [Multi-Tenant Projections](../../intermediate/example-3.md)
- [Distributed Event Projections](../../advanced/example-1.md)
