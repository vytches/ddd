# NestJS Production Monitoring - Expert Example

**Version**: 1.0.0  
**Package**: @vytches/ddd-di  
**Complexity**: expert  
**Domain**: Production Operations  
**Patterns**: Production Monitoring, Health Checks, Metrics, Observability  
**Dependencies**: @vytches/ddd-di, @nestjs/common, @nestjs/terminus,
@nestjs/microservices

## Description

This example demonstrates enterprise-grade production monitoring and debugging
patterns for VytchesDDD DI integration with NestJS. It shows how to implement
comprehensive health checks, metrics collection, distributed tracing, and
debugging tools for production applications.

## Business Context

Production applications require sophisticated monitoring, health checks, and
debugging capabilities. This example shows how to implement enterprise-grade
observability patterns that provide deep insights into DI container performance,
service health, and application behavior in production environments.

## Code Example

```typescript
// monitoring/health-check.service.ts
import { Injectable } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { VytchesDDD } from '@vytches/ddd-di';

/**
 * Custom health indicator for VytchesDDD services
 */
@Injectable()
export class VytchesDDDHealthIndicator extends HealthIndicator {
  /**
   * Checks health of VytchesDDD container
   */
  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      // ⭐ FOCUS: Production health monitoring
      const containerMetrics = await this.getContainerMetrics();
      const serviceHealth = await this.checkServiceHealth();

      const isHealthy = containerMetrics.healthy && serviceHealth.healthy;

      const result = this.getStatus(key, isHealthy, {
        container: containerMetrics,
        services: serviceHealth,
        timestamp: new Date().toISOString(),
      });

      if (!isHealthy) {
        throw new HealthCheckError('VytchesDDD health check failed', result);
      }

      return result;
    } catch (error) {
      const result = this.getStatus(key, false, {
        error: error.message,
        timestamp: new Date().toISOString(),
      });

      throw new HealthCheckError('VytchesDDD health check failed', result);
    }
  }

  /**
   * Checks health of specific service
   */
  async checkServiceHealth(serviceId?: string): Promise<{
    healthy: boolean;
    services: Record<string, any>;
    totalServices: number;
    healthyServices: number;
  }> {
    try {
      // ⭐ FOCUS: Service-specific health checks
      const registeredServices = VytchesDDD.getRegisteredServices();
      const serviceResults: Record<string, any> = {};
      let healthyCount = 0;

      for (const service of registeredServices) {
        try {
          const instance = VytchesDDD.resolve(service);
          const isHealthy = await this.checkServiceInstance(instance, service);

          serviceResults[service] = {
            healthy: isHealthy,
            lastChecked: new Date().toISOString(),
            instanceType: instance.constructor.name,
          };

          if (isHealthy) {
            healthyCount++;
          }
        } catch (error) {
          serviceResults[service] = {
            healthy: false,
            error: error.message,
            lastChecked: new Date().toISOString(),
          };
        }
      }

      return {
        healthy: healthyCount === registeredServices.length,
        services: serviceResults,
        totalServices: registeredServices.length,
        healthyServices: healthyCount,
      };
    } catch (error) {
      return {
        healthy: false,
        services: {},
        totalServices: 0,
        healthyServices: 0,
      };
    }
  }

  private async getContainerMetrics(): Promise<{
    healthy: boolean;
    registeredServices: number;
    resolutionTime: number;
    memoryUsage: NodeJS.MemoryUsage;
    uptime: number;
  }> {
    const startTime = Date.now();

    try {
      // Test container responsiveness
      const services = VytchesDDD.getRegisteredServices();
      const resolutionTime = Date.now() - startTime;

      return {
        healthy: resolutionTime < 100, // Less than 100ms
        registeredServices: services.length,
        resolutionTime,
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime(),
      };
    } catch (error) {
      return {
        healthy: false,
        registeredServices: 0,
        resolutionTime: Date.now() - startTime,
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime(),
      };
    }
  }

  private async checkServiceInstance(
    instance: any,
    serviceId: string
  ): Promise<boolean> {
    try {
      // Check if service has health check method
      if (typeof instance.healthCheck === 'function') {
        const result = await instance.healthCheck();
        return result === true;
      }

      // Basic instance check
      return instance !== null && instance !== undefined;
    } catch (error) {
      console.error(`Health check failed for service ${serviceId}:`, error);
      return false;
    }
  }
}
```

```typescript
// monitoring/metrics.service.ts
import { Injectable } from '@nestjs/common';
import { VytchesDDD } from '@vytches/ddd-di';

/**
 * Metrics collection service for VytchesDDD
 */
@Injectable()
export class VytchesDDDMetricsService {
  private metrics: Map<string, any> = new Map();
  private resolutionTimes: number[] = [];
  private serviceUsageCount: Map<string, number> = new Map();

  /**
   * Records service resolution time
   */
  recordServiceResolution(serviceId: string, duration: number): void {
    // ⭐ FOCUS: Production metrics collection
    this.resolutionTimes.push(duration);

    // Keep only last 1000 measurements
    if (this.resolutionTimes.length > 1000) {
      this.resolutionTimes.shift();
    }

    // Update usage count
    const currentCount = this.serviceUsageCount.get(serviceId) || 0;
    this.serviceUsageCount.set(serviceId, currentCount + 1);

    // Update metrics
    this.updateResolutionMetrics();
  }

  /**
   * Gets comprehensive metrics
   */
  getMetrics(): {
    container: any;
    services: any;
    performance: any;
    memory: NodeJS.MemoryUsage;
    system: any;
  } {
    return {
      container: this.getContainerMetrics(),
      services: this.getServiceMetrics(),
      performance: this.getPerformanceMetrics(),
      memory: process.memoryUsage(),
      system: this.getSystemMetrics(),
    };
  }

  /**
   * Gets service-specific metrics
   */
  getServiceMetrics(): {
    registeredServices: string[];
    totalServices: number;
    usageStats: Record<string, number>;
    mostUsedServices: Array<{ serviceId: string; count: number }>;
  } {
    const services = VytchesDDD.getRegisteredServices();

    // Sort services by usage
    const sortedUsage = Array.from(this.serviceUsageCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    return {
      registeredServices: services,
      totalServices: services.length,
      usageStats: Object.fromEntries(this.serviceUsageCount),
      mostUsedServices: sortedUsage.map(([serviceId, count]) => ({
        serviceId,
        count,
      })),
    };
  }

  /**
   * Gets performance metrics
   */
  getPerformanceMetrics(): {
    averageResolutionTime: number;
    minResolutionTime: number;
    maxResolutionTime: number;
    totalResolutions: number;
    recentResolutions: number[];
  } {
    if (this.resolutionTimes.length === 0) {
      return {
        averageResolutionTime: 0,
        minResolutionTime: 0,
        maxResolutionTime: 0,
        totalResolutions: 0,
        recentResolutions: [],
      };
    }

    const sum = this.resolutionTimes.reduce((a, b) => a + b, 0);
    const avg = sum / this.resolutionTimes.length;

    return {
      averageResolutionTime: avg,
      minResolutionTime: Math.min(...this.resolutionTimes),
      maxResolutionTime: Math.max(...this.resolutionTimes),
      totalResolutions: this.resolutionTimes.length,
      recentResolutions: this.resolutionTimes.slice(-10),
    };
  }

  /**
   * Monitors service resolution performance
   */
  monitorServiceResolution<T>(serviceId: string, resolutionFn: () => T): T {
    const startTime = Date.now();

    try {
      const result = resolutionFn();
      const duration = Date.now() - startTime;

      this.recordServiceResolution(serviceId, duration);

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordServiceResolution(serviceId, duration);
      throw error;
    }
  }

  private getContainerMetrics(): any {
    return {
      servicesRegistered: VytchesDDD.getRegisteredServices().length,
      uptime: process.uptime(),
      pid: process.pid,
      version: process.version,
      platform: process.platform,
    };
  }

  private getSystemMetrics(): any {
    const cpuUsage = process.cpuUsage();

    return {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      cpuUsage: {
        user: cpuUsage.user,
        system: cpuUsage.system,
      },
      loadAverage:
        process.platform === 'linux' ? require('os').loadavg() : null,
      freeMem: require('os').freemem(),
      totalMem: require('os').totalmem(),
    };
  }

  private updateResolutionMetrics(): void {
    const now = Date.now();

    this.metrics.set('lastUpdated', now);
    this.metrics.set('totalResolutions', this.resolutionTimes.length);

    if (this.resolutionTimes.length > 0) {
      const recent = this.resolutionTimes.slice(-10);
      const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
      this.metrics.set('recentAverageResolutionTime', avg);
    }
  }
}
```

```typescript
// monitoring/tracing.service.ts
import { Injectable } from '@nestjs/common';
import { VytchesDDD } from '@vytches/ddd-di';

/**
 * Distributed tracing service for VytchesDDD
 */
@Injectable()
export class VytchesDDDTracingService {
  private traces: Map<string, any> = new Map();
  private activeTraces: Map<string, any> = new Map();

  /**
   * Starts a new trace
   */
  startTrace(traceId: string, operation: string, metadata?: any): void {
    // ⭐ FOCUS: Production tracing
    const trace = {
      traceId,
      operation,
      startTime: Date.now(),
      metadata: metadata || {},
      spans: [],
      status: 'active',
    };

    this.activeTraces.set(traceId, trace);

    console.log(`Trace started: ${traceId} - ${operation}`);
  }

  /**
   * Adds a span to an active trace
   */
  addSpan(
    traceId: string,
    spanName: string,
    serviceId: string,
    duration: number,
    metadata?: any
  ): void {
    const trace = this.activeTraces.get(traceId);
    if (!trace) {
      console.warn(`Trace not found: ${traceId}`);
      return;
    }

    const span = {
      spanId: this.generateSpanId(),
      spanName,
      serviceId,
      duration,
      timestamp: Date.now(),
      metadata: metadata || {},
    };

    trace.spans.push(span);

    console.log(`Span added to trace ${traceId}: ${spanName} (${duration}ms)`);
  }

  /**
   * Ends a trace
   */
  endTrace(
    traceId: string,
    status: 'success' | 'error' = 'success',
    error?: any
  ): void {
    const trace = this.activeTraces.get(traceId);
    if (!trace) {
      console.warn(`Trace not found: ${traceId}`);
      return;
    }

    trace.endTime = Date.now();
    trace.duration = trace.endTime - trace.startTime;
    trace.status = status;

    if (error) {
      trace.error = {
        message: error.message,
        stack: error.stack,
      };
    }

    // Move to completed traces
    this.traces.set(traceId, trace);
    this.activeTraces.delete(traceId);

    console.log(`Trace ended: ${traceId} - ${status} (${trace.duration}ms)`);
  }

  /**
   * Traces service resolution
   */
  traceServiceResolution<T>(serviceId: string, resolutionFn: () => T): T {
    const traceId = this.generateTraceId();

    this.startTrace(traceId, 'service_resolution', { serviceId });

    const startTime = Date.now();

    try {
      const result = resolutionFn();
      const duration = Date.now() - startTime;

      this.addSpan(traceId, 'resolve_service', serviceId, duration, {
        success: true,
        resultType: typeof result,
      });

      this.endTrace(traceId, 'success');

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      this.addSpan(traceId, 'resolve_service', serviceId, duration, {
        success: false,
        error: error.message,
      });

      this.endTrace(traceId, 'error', error);

      throw error;
    }
  }

  /**
   * Gets trace by ID
   */
  getTrace(traceId: string): any {
    return this.traces.get(traceId) || this.activeTraces.get(traceId);
  }

  /**
   * Gets all traces
   */
  getAllTraces(): any[] {
    return [
      ...Array.from(this.traces.values()),
      ...Array.from(this.activeTraces.values()),
    ];
  }

  /**
   * Gets trace statistics
   */
  getTraceStatistics(): {
    totalTraces: number;
    activeTraces: number;
    completedTraces: number;
    averageDuration: number;
    successRate: number;
  } {
    const completedTraces = Array.from(this.traces.values());
    const totalTraces = completedTraces.length + this.activeTraces.size;

    if (completedTraces.length === 0) {
      return {
        totalTraces,
        activeTraces: this.activeTraces.size,
        completedTraces: 0,
        averageDuration: 0,
        successRate: 0,
      };
    }

    const totalDuration = completedTraces.reduce(
      (sum, trace) => sum + (trace.duration || 0),
      0
    );
    const successfulTraces = completedTraces.filter(
      trace => trace.status === 'success'
    ).length;

    return {
      totalTraces,
      activeTraces: this.activeTraces.size,
      completedTraces: completedTraces.length,
      averageDuration: totalDuration / completedTraces.length,
      successRate: successfulTraces / completedTraces.length,
    };
  }

  private generateTraceId(): string {
    return `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSpanId(): string {
    return `span_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

```typescript
// monitoring/debug.service.ts
import { Injectable } from '@nestjs/common';
import { VytchesDDD } from '@vytches/ddd-di';

/**
 * Debug service for VytchesDDD troubleshooting
 */
@Injectable()
export class VytchesDDDDebugService {
  private debugLogs: any[] = [];
  private serviceInspections: Map<string, any> = new Map();

  /**
   * Inspects service configuration
   */
  inspectService(serviceId: string): {
    serviceId: string;
    exists: boolean;
    instance?: any;
    metadata?: any;
    dependencies?: string[];
    methods?: string[];
    properties?: string[];
  } {
    try {
      // ⭐ FOCUS: Production debugging tools
      const instance = VytchesDDD.resolve(serviceId);

      if (!instance) {
        return {
          serviceId,
          exists: false,
        };
      }

      const inspection = {
        serviceId,
        exists: true,
        instance: {
          constructor: instance.constructor.name,
          prototype: Object.getPrototypeOf(instance).constructor.name,
        },
        metadata: this.getServiceMetadata(serviceId),
        dependencies: this.getServiceDependencies(serviceId),
        methods: this.getServiceMethods(instance),
        properties: this.getServiceProperties(instance),
      };

      this.serviceInspections.set(serviceId, inspection);

      return inspection;
    } catch (error) {
      return {
        serviceId,
        exists: false,
        error: error.message,
      };
    }
  }

  /**
   * Diagnoses container issues
   */
  diagnoseContainer(): {
    status: 'healthy' | 'warning' | 'error';
    issues: string[];
    recommendations: string[];
    statistics: any;
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];

    try {
      // Check service registration
      const services = VytchesDDD.getRegisteredServices();

      if (services.length === 0) {
        issues.push('No services registered in container');
        recommendations.push(
          'Ensure services are properly decorated with @DomainService'
        );
      }

      // Check for circular dependencies
      const circularDeps = this.detectCircularDependencies();
      if (circularDeps.length > 0) {
        issues.push(
          `Circular dependencies detected: ${circularDeps.join(', ')}`
        );
        recommendations.push(
          'Refactor services to eliminate circular dependencies'
        );
      }

      // Check resolution performance
      const performanceIssues = this.checkPerformanceIssues();
      issues.push(...performanceIssues.issues);
      recommendations.push(...performanceIssues.recommendations);

      let status: 'healthy' | 'warning' | 'error' = 'healthy';

      if (issues.length > 0) {
        status = issues.some(
          issue => issue.includes('error') || issue.includes('circular')
        )
          ? 'error'
          : 'warning';
      }

      return {
        status,
        issues,
        recommendations,
        statistics: this.getContainerStatistics(),
      };
    } catch (error) {
      return {
        status: 'error',
        issues: [`Container diagnosis failed: ${error.message}`],
        recommendations: [
          'Check container initialization and service registration',
        ],
        statistics: {},
      };
    }
  }

  /**
   * Analyzes service resolution chain
   */
  analyzeResolutionChain(serviceId: string): {
    serviceId: string;
    resolutionPath: string[];
    dependencies: Record<string, any>;
    potentialIssues: string[];
  } {
    const resolutionPath: string[] = [];
    const dependencies: Record<string, any> = {};
    const potentialIssues: string[] = [];

    try {
      // Track resolution path
      resolutionPath.push(serviceId);

      // Analyze dependencies
      const serviceDeps = this.getServiceDependencies(serviceId);

      for (const dep of serviceDeps) {
        dependencies[dep] = this.analyzeServiceDependency(dep);

        // Check for potential issues
        if (!dependencies[dep].exists) {
          potentialIssues.push(`Missing dependency: ${dep}`);
        }
      }

      return {
        serviceId,
        resolutionPath,
        dependencies,
        potentialIssues,
      };
    } catch (error) {
      potentialIssues.push(`Resolution analysis failed: ${error.message}`);

      return {
        serviceId,
        resolutionPath,
        dependencies,
        potentialIssues,
      };
    }
  }

  /**
   * Gets debug logs
   */
  getDebugLogs(limit: number = 100): any[] {
    return this.debugLogs.slice(-limit);
  }

  /**
   * Adds debug log entry
   */
  addDebugLog(
    level: 'info' | 'warn' | 'error',
    message: string,
    metadata?: any
  ): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      metadata: metadata || {},
    };

    this.debugLogs.push(logEntry);

    // Keep only last 1000 entries
    if (this.debugLogs.length > 1000) {
      this.debugLogs.shift();
    }

    console.log(
      `[VytchesDDD Debug] ${level.toUpperCase()}: ${message}`,
      metadata
    );
  }

  private getServiceMetadata(serviceId: string): any {
    try {
      return VytchesDDD.getServiceMetadata(serviceId);
    } catch (error) {
      return null;
    }
  }

  private getServiceDependencies(serviceId: string): string[] {
    try {
      const metadata = this.getServiceMetadata(serviceId);
      return metadata?.dependencies || [];
    } catch (error) {
      return [];
    }
  }

  private getServiceMethods(instance: any): string[] {
    const methods: string[] = [];
    let obj = instance;

    while (obj && obj !== Object.prototype) {
      const propertyNames = Object.getOwnPropertyNames(obj);

      for (const prop of propertyNames) {
        if (typeof instance[prop] === 'function' && prop !== 'constructor') {
          methods.push(prop);
        }
      }

      obj = Object.getPrototypeOf(obj);
    }

    return [...new Set(methods)];
  }

  private getServiceProperties(instance: any): string[] {
    const properties: string[] = [];

    for (const prop in instance) {
      if (
        instance.hasOwnProperty(prop) &&
        typeof instance[prop] !== 'function'
      ) {
        properties.push(prop);
      }
    }

    return properties;
  }

  private detectCircularDependencies(): string[] {
    // Simplified circular dependency detection
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const circularDeps: string[] = [];

    const services = VytchesDDD.getRegisteredServices();

    for (const service of services) {
      if (this.hasCircularDependency(service, visited, recursionStack)) {
        circularDeps.push(service);
      }
    }

    return circularDeps;
  }

  private hasCircularDependency(
    serviceId: string,
    visited: Set<string>,
    recursionStack: Set<string>
  ): boolean {
    if (recursionStack.has(serviceId)) {
      return true;
    }

    if (visited.has(serviceId)) {
      return false;
    }

    visited.add(serviceId);
    recursionStack.add(serviceId);

    const dependencies = this.getServiceDependencies(serviceId);

    for (const dep of dependencies) {
      if (this.hasCircularDependency(dep, visited, recursionStack)) {
        return true;
      }
    }

    recursionStack.delete(serviceId);
    return false;
  }

  private checkPerformanceIssues(): {
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check memory usage
    const memUsage = process.memoryUsage();
    const memoryMB = memUsage.heapUsed / 1024 / 1024;

    if (memoryMB > 500) {
      issues.push(`High memory usage: ${memoryMB.toFixed(2)}MB`);
      recommendations.push(
        'Consider optimizing service lifecycle and memory usage'
      );
    }

    return { issues, recommendations };
  }

  private getContainerStatistics(): any {
    return {
      registeredServices: VytchesDDD.getRegisteredServices().length,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
      pid: process.pid,
    };
  }

  private analyzeServiceDependency(serviceId: string): any {
    try {
      const instance = VytchesDDD.resolve(serviceId);
      return {
        exists: true,
        type: instance.constructor.name,
        methods: this.getServiceMethods(instance).length,
      };
    } catch (error) {
      return {
        exists: false,
        error: error.message,
      };
    }
  }
}
```

```typescript
// controllers/monitoring.controller.ts
import { Controller, Get, Param, Post, Body } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { VytchesDDDHealthIndicator } from '../monitoring/health-check.service';
import { VytchesDDDMetricsService } from '../monitoring/metrics.service';
import { VytchesDDDTracingService } from '../monitoring/tracing.service';
import { VytchesDDDDebugService } from '../monitoring/debug.service';

/**
 * Monitoring controller for VytchesDDD
 */
@Controller('monitoring')
export class MonitoringController {
  constructor(
    private health: HealthCheckService,
    private vytchesDDDHealth: VytchesDDDHealthIndicator,
    private metricsService: VytchesDDDMetricsService,
    private tracingService: VytchesDDDTracingService,
    private debugService: VytchesDDDDebugService
  ) {}

  /**
   * Health check endpoint
   */
  @Get('health')
  @HealthCheck()
  healthCheck() {
    // ⭐ FOCUS: Production health check endpoint
    return this.health.check([
      () => this.vytchesDDDHealth.isHealthy('vytches-ddd'),
    ]);
  }

  /**
   * Detailed health check
   */
  @Get('health/detailed')
  async detailedHealthCheck() {
    return await this.vytchesDDDHealth.checkServiceHealth();
  }

  /**
   * Metrics endpoint
   */
  @Get('metrics')
  getMetrics() {
    return this.metricsService.getMetrics();
  }

  /**
   * Service-specific metrics
   */
  @Get('metrics/services')
  getServiceMetrics() {
    return this.metricsService.getServiceMetrics();
  }

  /**
   * Performance metrics
   */
  @Get('metrics/performance')
  getPerformanceMetrics() {
    return this.metricsService.getPerformanceMetrics();
  }

  /**
   * Tracing statistics
   */
  @Get('traces/stats')
  getTraceStatistics() {
    return this.tracingService.getTraceStatistics();
  }

  /**
   * All traces
   */
  @Get('traces')
  getAllTraces() {
    return this.tracingService.getAllTraces();
  }

  /**
   * Specific trace
   */
  @Get('traces/:traceId')
  getTrace(@Param('traceId') traceId: string) {
    return this.tracingService.getTrace(traceId);
  }

  /**
   * Debug service inspection
   */
  @Get('debug/service/:serviceId')
  inspectService(@Param('serviceId') serviceId: string) {
    return this.debugService.inspectService(serviceId);
  }

  /**
   * Container diagnosis
   */
  @Get('debug/container')
  diagnoseContainer() {
    return this.debugService.diagnoseContainer();
  }

  /**
   * Resolution chain analysis
   */
  @Get('debug/resolution/:serviceId')
  analyzeResolutionChain(@Param('serviceId') serviceId: string) {
    return this.debugService.analyzeResolutionChain(serviceId);
  }

  /**
   * Debug logs
   */
  @Get('debug/logs')
  getDebugLogs() {
    return this.debugService.getDebugLogs();
  }

  /**
   * Add debug log
   */
  @Post('debug/logs')
  addDebugLog(
    @Body()
    logData: {
      level: 'info' | 'warn' | 'error';
      message: string;
      metadata?: any;
    }
  ) {
    this.debugService.addDebugLog(
      logData.level,
      logData.message,
      logData.metadata
    );
    return { success: true };
  }
}
```

```typescript
// monitoring/monitoring.module.ts
import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { VytchesDDDHealthIndicator } from './health-check.service';
import { VytchesDDDMetricsService } from './metrics.service';
import { VytchesDDDTracingService } from './tracing.service';
import { VytchesDDDDebugService } from './debug.service';
import { MonitoringController } from '../controllers/monitoring.controller';

/**
 * Monitoring module for VytchesDDD
 */
@Module({
  imports: [TerminusModule],
  controllers: [MonitoringController],
  providers: [
    VytchesDDDHealthIndicator,
    VytchesDDDMetricsService,
    VytchesDDDTracingService,
    VytchesDDDDebugService,
  ],
  exports: [
    VytchesDDDHealthIndicator,
    VytchesDDDMetricsService,
    VytchesDDDTracingService,
    VytchesDDDDebugService,
  ],
})
export class MonitoringModule {}
```

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { MonitoringModule } from './monitoring/monitoring.module';

/**
 * Root application module with monitoring
 */
@Module({
  imports: [MonitoringModule],
})
export class AppModule {}
```

```typescript
// test/monitoring.test.ts
import { Test, TestingModule } from '@nestjs/testing';
import { MonitoringModule } from '../monitoring/monitoring.module';
import { VytchesDDDHealthIndicator } from '../monitoring/health-check.service';
import { VytchesDDDMetricsService } from '../monitoring/metrics.service';
import { VytchesDDDTracingService } from '../monitoring/tracing.service';
import { VytchesDDDDebugService } from '../monitoring/debug.service';

describe('Production Monitoring', () => {
  let healthIndicator: VytchesDDDHealthIndicator;
  let metricsService: VytchesDDDMetricsService;
  let tracingService: VytchesDDDTracingService;
  let debugService: VytchesDDDDebugService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [MonitoringModule],
    }).compile();

    healthIndicator = module.get<VytchesDDDHealthIndicator>(
      VytchesDDDHealthIndicator
    );
    metricsService = module.get<VytchesDDDMetricsService>(
      VytchesDDDMetricsService
    );
    tracingService = module.get<VytchesDDDTracingService>(
      VytchesDDDTracingService
    );
    debugService = module.get<VytchesDDDDebugService>(VytchesDDDDebugService);
  });

  it('should check container health', async () => {
    const health = await healthIndicator.isHealthy('test');

    expect(health).toBeDefined();
    expect(health.test).toBeDefined();
  });

  it('should collect metrics', () => {
    metricsService.recordServiceResolution('testService', 50);

    const metrics = metricsService.getMetrics();

    expect(metrics.performance.totalResolutions).toBe(1);
    expect(metrics.performance.averageResolutionTime).toBe(50);
  });

  it('should trace service operations', () => {
    const result = tracingService.traceServiceResolution('testService', () => {
      return 'test result';
    });

    expect(result).toBe('test result');

    const stats = tracingService.getTraceStatistics();
    expect(stats.totalTraces).toBe(1);
  });

  it('should diagnose container', () => {
    const diagnosis = debugService.diagnoseContainer();

    expect(diagnosis).toBeDefined();
    expect(diagnosis.status).toBeDefined();
    expect(Array.isArray(diagnosis.issues)).toBe(true);
    expect(Array.isArray(diagnosis.recommendations)).toBe(true);
  });

  it('should inspect services', () => {
    const inspection = debugService.inspectService('nonExistentService');

    expect(inspection.serviceId).toBe('nonExistentService');
    expect(inspection.exists).toBe(false);
  });
});
```

## Key Features

- **Comprehensive Health Checks**: Service-level health monitoring with detailed
  diagnostics
- **Production Metrics**: Real-time metrics collection and analysis
- **Distributed Tracing**: End-to-end tracing for complex workflows
- **Debug Tools**: Advanced debugging and troubleshooting capabilities
- **Performance Monitoring**: Resolution time tracking and optimization
- **Container Diagnostics**: Deep inspection of DI container state
- **Production Endpoints**: RESTful monitoring endpoints for operations teams

## Common Pitfalls

- **Performance Impact**: Monitor the performance impact of monitoring tools
- **Data Retention**: Implement proper data retention policies for metrics and
  traces
- **Security**: Ensure monitoring endpoints are properly secured
- **Resource Usage**: Monitor resource consumption of monitoring tools
- **Alert Fatigue**: Configure appropriate thresholds to avoid alert spam

## Related Examples

- [Multi-Context Architecture](./example-1.md) - Enterprise architecture
  patterns
- [Enterprise Production Patterns](../../advanced/example-3.md) - Production
  patterns
- [Custom Container Implementation](../../advanced/example-2.md) - Custom
  container features
