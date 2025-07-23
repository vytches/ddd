# NestJS Advanced DI Integration

**Version**: 1.0.0 **Package**: @vytches-ddd/logging + @vytches-ddd/di + NestJS
**Complexity**: intermediate **Framework**: NestJS **Integration**: VytchesDDD
DI integration with bridge pattern **Dependencies**: @nestjs/common,
@vytches-ddd/logging, @vytches-ddd/di

## Description

Advanced NestJS integration with VytchesDDD dependency injection system using
the bridge pattern. This example demonstrates enterprise-grade logging
integration that combines NestJS framework capabilities with VytchesDDD's
advanced DI features for complex applications.

## Business Context

Enterprise NestJS applications require sophisticated logging that integrates
with domain-driven design patterns and advanced dependency injection
capabilities. This integration enables enterprise-grade logging with automatic
service discovery, context isolation, and advanced architectural patterns while
maintaining NestJS framework benefits.

## Code Example

```typescript
// logging.domain-service.ts - VytchesDDD domain service
import { DomainService, ServiceLifetime, VytchesDDD } from '@vytches-ddd/di';
import {
  Logger,
  LoggerConfiguration,
  CQRSLoggingOptions,
} from '@vytches-ddd/logging';
import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';

@DomainService({
  serviceId: 'enterpriseLoggingService',
  lifetime: ServiceLifetime.Singleton,
  context: 'Logging',
  dependencies: ['configService', 'metricsCollector'],
  autoRegister: true,
  metadata: {
    description: 'Enterprise logging service with advanced capabilities',
    version: '2.0.0',
    tags: ['logging', 'enterprise', 'observability'],
  },
})
export class EnterpriseLoggingDomainService
  implements OnModuleInit, OnModuleDestroy
{
  private logger: Logger;
  private metricsCollector: any;
  private configService: any;
  private activeContexts = new Map<string, Logger>();
  private requestMetrics = new Map<string, any>();

  constructor() {
    this.initializeEnterpriseLogging();
  }

  async onModuleInit() {
    // Resolve dependencies through VytchesDDD
    this.configService = VytchesDDD.resolve<any>('configService');
    this.metricsCollector = VytchesDDD.resolve<any>('metricsCollector');

    // Configure enterprise logging
    await this.setupEnterpriseConfiguration();

    this.logger.info('Enterprise logging service initialized', {
      serviceId: 'enterpriseLoggingService',
      context: 'Logging',
      dependencies: ['configService', 'metricsCollector'],
    });
  }

  async onModuleDestroy() {
    await this.cleanup();
    this.logger.info('Enterprise logging service destroyed');
  }

  private initializeEnterpriseLogging(): void {
    // ⭐ FOCUS: Enterprise logging configuration
    const config: LoggerConfiguration = {
      level: process.env.LOG_LEVEL || 'info',
      enableConsoleOutput: true,
      enableFileOutput: true,
      enableRemoteLogging: process.env.ENABLE_REMOTE_LOGGING === 'true',

      contextDetection: {
        enabled: true,
        stackTraceAnalysis: true,
        boundedContextDetection: true,
        performanceTracking: true,
      },

      masking: {
        enabled: true,
        auditSensitiveAccess: true,
        sensitiveKeys: [
          'password',
          'secret',
          'token',
          'apiKey',
          'cardNumber',
          'ssn',
          'phoneNumber',
          'authorization',
          'cookie',
          'refreshToken',
        ],
        replacement: '[ENTERPRISE_MASKED]',
        customMaskers: {
          email: (email: string) => {
            const [local, domain] = email.split('@');
            return `${local[0]}***@${domain}`;
          },
          creditCard: (card: string) => `****-****-****-${card.slice(-4)}`,
          ssn: (ssn: string) => `***-**-${ssn.slice(-4)}`,
        },
      },

      formatting: {
        colorize: false, // Enterprise logging typically uses structured format
        timestamp: true,
        prettyPrint: false,
        includeMetadata: true,
        includeCorrelationId: true,
      },
    };

    Logger.configure(config);
    this.logger = Logger.forContext('EnterpriseLoggingService');
  }

  private async setupEnterpriseConfiguration(): Promise<void> {
    // ⭐ FOCUS: Configure CQRS logging globally
    const cqrsOptions: CQRSLoggingOptions = {
      commands: {
        includePayload: true,
        logLevel: 'info',
        measurePerformance: true,
        maskSensitiveData: true,
        performanceThreshold: 2000, // 2 seconds for commands
        customSerializer: (command: any) => this.serializeForAudit(command),
        auditTrail: true,
      },
      queries: {
        includePayload: true,
        logLevel: 'debug',
        measurePerformance: true,
        performanceThreshold: 1000, // 1 second for queries
        includeResultCount: true,
        warnOnSlowQuery: true,
        slowQueryThreshold: 2000,
        auditTrail: false, // Queries typically don't need audit trail
      },
    };

    Logger.configureCQRSLogging(cqrsOptions);

    // Set up performance monitoring callbacks
    Logger.onCQRSPerformanceThresholdExceeded(event => {
      this.handlePerformanceAlert(event);
    });

    this.logger.info('Enterprise CQRS logging configured', {
      commandThreshold: cqrsOptions.commands.performanceThreshold,
      queryThreshold: cqrsOptions.queries.performanceThreshold,
      auditTrailEnabled: cqrsOptions.commands.auditTrail,
    });
  }

  // ⭐ FOCUS: Enterprise context management
  createEnterpriseLogger(
    contextName: string,
    businessContext: Record<string, any>,
    correlationId?: string
  ): Logger {
    const enrichedContext = {
      ...businessContext,
      correlationId: correlationId || this.generateCorrelationId(),
      timestamp: new Date(),
      serviceId: 'enterpriseLoggingService',
    };

    const logger = Logger.forContext(contextName).withContext(enrichedContext);

    // Store active context for metrics
    const contextKey = `${contextName}-${enrichedContext.correlationId}`;
    this.activeContexts.set(contextKey, logger);

    return logger;
  }

  // ⭐ FOCUS: Business domain event logging
  logDomainEvent(
    eventType: string,
    aggregateId: string,
    eventData: Record<string, any>,
    metadata?: Record<string, any>
  ): void {
    const domainLogger = this.createEnterpriseLogger('DomainEvents', {
      eventType,
      aggregateId,
      boundedContext: metadata?.boundedContext || 'Unknown',
    });

    domainLogger.info(`Domain event: ${eventType}`, {
      eventType,
      aggregateId,
      eventData: this.sanitizeEventData(eventData),
      metadata: metadata || {},
      eventId: this.generateEventId(),
      version: metadata?.version || 1,
      timestamp: new Date(),
    });

    // Collect metrics
    this.collectEventMetrics(eventType, aggregateId);
  }

  // ⭐ FOCUS: Advanced performance tracking
  async trackOperationPerformance<T>(
    operationName: string,
    operation: () => Promise<T>,
    context: Record<string, any> = {}
  ): Promise<T> {
    const performanceId = this.generatePerformanceId();
    const performanceLogger = this.createEnterpriseLogger(
      'PerformanceTracking',
      {
        operation: operationName,
        performanceId,
        ...context,
      }
    );

    const startTime = Date.now();
    const startMetrics = this.captureSystemMetrics();

    performanceLogger.debug('Operation performance tracking started', {
      operation: operationName,
      performanceId,
      startMetrics,
    });

    try {
      const result = await operation();
      const duration = Date.now() - startTime;
      const endMetrics = this.captureSystemMetrics();

      // ⭐ FOCUS: Comprehensive performance logging
      performanceLogger.info('Operation performance completed', {
        operation: operationName,
        performanceId,
        duration,
        performanceCategory: this.categorizePerformance(duration),
        systemMetrics: {
          memoryDelta:
            endMetrics.memoryUsage.heapUsed - startMetrics.memoryUsage.heapUsed,
          cpuTime: endMetrics.cpuUsage.user - startMetrics.cpuUsage.user,
          activeHandles: endMetrics.activeHandles,
        },
        success: true,
      });

      // Store metrics for analysis
      this.storePerformanceMetrics(operationName, duration, true);

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      performanceLogger.error('Operation performance failed', {
        operation: operationName,
        performanceId,
        duration,
        error: error,
        success: false,
      });

      // Store failure metrics
      this.storePerformanceMetrics(operationName, duration, false);

      throw error;
    }
  }

  // ⭐ FOCUS: Security audit logging
  logSecurityEvent(
    eventType:
      | 'authentication'
      | 'authorization'
      | 'data_access'
      | 'security_violation',
    details: Record<string, any>,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ): void {
    const securityLogger = this.createEnterpriseLogger('SecurityAudit', {
      eventType,
      severity,
      requiresAudit: true,
    });

    // ⭐ FOCUS: Security event logging with audit trail
    securityLogger.warn(`Security event: ${eventType}`, {
      securityEventType: eventType,
      severity,
      details: this.sanitizeSecurityData(details),
      auditTrail: true,
      requiresInvestigation: severity === 'high' || severity === 'critical',
      eventId: this.generateSecurityEventId(),
      timestamp: new Date(),
      investigationRequired: severity === 'critical',
    });

    // Trigger alerts for high-severity events
    if (severity === 'high' || severity === 'critical') {
      this.triggerSecurityAlert(eventType, severity, details);
    }
  }

  // ⭐ FOCUS: Enterprise metrics and analytics
  generateEnterpriseMetrics(): any {
    const performanceMetrics = this.aggregatePerformanceMetrics();
    const eventMetrics = this.aggregateEventMetrics();
    const systemHealth = this.assessSystemHealth();

    const enterpriseMetrics = {
      timestamp: new Date(),
      performance: performanceMetrics,
      events: eventMetrics,
      system: systemHealth,
      logging: {
        activeContexts: this.activeContexts.size,
        totalRequests: this.requestMetrics.size,
        errorRate: this.calculateErrorRate(),
        averageResponseTime: this.calculateAverageResponseTime(),
      },
    };

    // Log enterprise metrics
    this.logger.info('Enterprise metrics generated', {
      metricsType: 'enterprise_summary',
      activeContexts: enterpriseMetrics.logging.activeContexts,
      errorRate: enterpriseMetrics.logging.errorRate,
      averageResponseTime: enterpriseMetrics.logging.averageResponseTime,
      systemHealth: systemHealth.status,
    });

    return enterpriseMetrics;
  }

  // Private helper methods
  private async cleanup(): Promise<void> {
    // Clear active contexts
    this.activeContexts.clear();

    // Clear metrics data
    this.requestMetrics.clear();

    // Flush any pending logs
    await this.flushPendingLogs();
  }

  private generateCorrelationId(): string {
    return `corr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateEventId(): string {
    return `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generatePerformanceId(): string {
    return `perf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSecurityEventId(): string {
    return `sec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private serializeForAudit(data: any): any {
    // Custom serialization for audit trails
    return JSON.parse(
      JSON.stringify(data, (key, value) => {
        if (typeof value === 'function') return '[Function]';
        if (value instanceof Date) return value.toISOString();
        return value;
      })
    );
  }

  private sanitizeEventData(
    eventData: Record<string, any>
  ): Record<string, any> {
    const sanitized = { ...eventData };

    // Remove or mask sensitive fields
    const sensitiveFields = ['password', 'secret', 'token', 'apiKey'];
    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '[ENTERPRISE_MASKED]';
      }
    });

    return sanitized;
  }

  private sanitizeSecurityData(
    details: Record<string, any>
  ): Record<string, any> {
    const sanitized = { ...details };

    // Mask IP addresses partially for security
    if (sanitized.ipAddress) {
      const parts = sanitized.ipAddress.split('.');
      sanitized.ipAddress = `${parts[0]}.${parts[1]}.***.***.`;
    }

    // Mask user agents
    if (sanitized.userAgent) {
      sanitized.userAgent = sanitized.userAgent.substring(0, 50) + '...';
    }

    return sanitized;
  }

  private captureSystemMetrics(): any {
    return {
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      uptime: process.uptime(),
      activeHandles: (process as any)._getActiveHandles().length,
    };
  }

  private categorizePerformance(duration: number): string {
    if (duration < 100) return 'excellent';
    if (duration < 500) return 'good';
    if (duration < 2000) return 'acceptable';
    if (duration < 5000) return 'slow';
    return 'critical';
  }

  private handlePerformanceAlert(event: any): void {
    this.logger.warn('Performance threshold exceeded', {
      alertType: 'performance_threshold',
      eventType: event.type,
      operation: event.name,
      actualDuration: event.duration,
      threshold: event.threshold,
      exceedBy: event.duration - event.threshold,
    });

    // Could integrate with monitoring systems
    this.metricsCollector?.recordAlert?.({
      type: 'performance',
      severity: 'medium',
      data: event,
    });
  }

  private collectEventMetrics(eventType: string, aggregateId: string): void {
    const key = `${eventType}:${new Date().toISOString().split('T')[0]}`;
    const current = this.requestMetrics.get(key) || {
      count: 0,
      aggregates: new Set(),
    };

    this.requestMetrics.set(key, {
      count: current.count + 1,
      aggregates: current.aggregates.add(aggregateId),
    });
  }

  private storePerformanceMetrics(
    operation: string,
    duration: number,
    success: boolean
  ): void {
    const key = `${operation}:performance`;
    const metrics = this.requestMetrics.get(key) || {
      totalDuration: 0,
      count: 0,
      successCount: 0,
      failureCount: 0,
    };

    this.requestMetrics.set(key, {
      totalDuration: metrics.totalDuration + duration,
      count: metrics.count + 1,
      successCount: success ? metrics.successCount + 1 : metrics.successCount,
      failureCount: success ? metrics.failureCount : metrics.failureCount + 1,
    });
  }

  private triggerSecurityAlert(
    eventType: string,
    severity: string,
    details: any
  ): void {
    this.logger.error('Security alert triggered', {
      alertType: 'security_event',
      eventType,
      severity,
      requiresImmediateAction: severity === 'critical',
      alertId: this.generateSecurityEventId(),
    });

    // Could integrate with security monitoring systems
    this.metricsCollector?.recordSecurityAlert?.({
      eventType,
      severity,
      details: this.sanitizeSecurityData(details),
    });
  }

  private aggregatePerformanceMetrics(): any {
    const performanceData: any = {};

    for (const [key, metrics] of this.requestMetrics.entries()) {
      if (key.includes(':performance')) {
        const operation = key.split(':')[0];
        performanceData[operation] = {
          averageDuration: metrics.totalDuration / metrics.count,
          totalRequests: metrics.count,
          successRate: (metrics.successCount / metrics.count) * 100,
          failureRate: (metrics.failureCount / metrics.count) * 100,
        };
      }
    }

    return performanceData;
  }

  private aggregateEventMetrics(): any {
    const eventData: any = {};

    for (const [key, metrics] of this.requestMetrics.entries()) {
      if (!key.includes(':performance')) {
        const eventType = key.split(':')[0];
        eventData[eventType] = {
          eventCount: metrics.count,
          uniqueAggregates: metrics.aggregates.size,
        };
      }
    }

    return eventData;
  }

  private assessSystemHealth(): any {
    const memoryUsage = process.memoryUsage();
    const heapPercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;

    return {
      status:
        heapPercent > 90
          ? 'critical'
          : heapPercent > 70
            ? 'warning'
            : 'healthy',
      memoryUsage: {
        heapPercent,
        totalMB: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        usedMB: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      },
      uptime: process.uptime(),
    };
  }

  private calculateErrorRate(): number {
    let totalRequests = 0;
    let totalFailures = 0;

    for (const metrics of this.requestMetrics.values()) {
      if (typeof metrics === 'object' && metrics.count) {
        totalRequests += metrics.count;
        totalFailures += metrics.failureCount || 0;
      }
    }

    return totalRequests > 0 ? (totalFailures / totalRequests) * 100 : 0;
  }

  private calculateAverageResponseTime(): number {
    let totalDuration = 0;
    let totalCount = 0;

    for (const [key, metrics] of this.requestMetrics.entries()) {
      if (key.includes(':performance') && typeof metrics === 'object') {
        totalDuration += metrics.totalDuration || 0;
        totalCount += metrics.count || 0;
      }
    }

    return totalCount > 0 ? totalDuration / totalCount : 0;
  }

  private async flushPendingLogs(): Promise<void> {
    // Implement log flushing logic if needed
    this.logger.debug('Pending logs flushed');
  }
}

// logging-bridge.service.ts - NestJS Bridge Service
import { Injectable, OnModuleInit } from '@nestjs/common';
import { VytchesDDD } from '@vytches-ddd/di';
import { EnterpriseLoggingDomainService } from './logging.domain-service';
import { Logger } from '@vytches-ddd/logging';

@Injectable()
export class LoggingBridgeService implements OnModuleInit {
  private enterpriseLoggingService: EnterpriseLoggingDomainService;

  async onModuleInit(): Promise<void> {
    // ⭐ FOCUS: Bridge Pattern - Get existing instance from VytchesDDD
    this.enterpriseLoggingService =
      VytchesDDD.resolve<EnterpriseLoggingDomainService>(
        'enterpriseLoggingService'
      );
  }

  // ⭐ FOCUS: Delegate to enterprise domain service
  createLogger(
    contextName: string,
    businessContext: Record<string, any>
  ): Logger {
    return this.enterpriseLoggingService.createEnterpriseLogger(
      contextName,
      businessContext
    );
  }

  logDomainEvent(
    eventType: string,
    aggregateId: string,
    eventData: Record<string, any>
  ): void {
    return this.enterpriseLoggingService.logDomainEvent(
      eventType,
      aggregateId,
      eventData
    );
  }

  async trackPerformance<T>(
    operationName: string,
    operation: () => Promise<T>,
    context?: Record<string, any>
  ): Promise<T> {
    return this.enterpriseLoggingService.trackOperationPerformance(
      operationName,
      operation,
      context
    );
  }

  logSecurityEvent(
    eventType:
      | 'authentication'
      | 'authorization'
      | 'data_access'
      | 'security_violation',
    details: Record<string, any>,
    severity?: 'low' | 'medium' | 'high' | 'critical'
  ): void {
    return this.enterpriseLoggingService.logSecurityEvent(
      eventType,
      details,
      severity
    );
  }

  generateMetrics(): any {
    return this.enterpriseLoggingService.generateEnterpriseMetrics();
  }
}

// Example enterprise service using the bridge
import { Injectable, OnModuleInit } from '@nestjs/common';
import { LoggingBridgeService } from '../logging/logging-bridge.service';
import { Logger } from '@vytches-ddd/logging';

@Injectable()
export class EnterpriseUserService implements OnModuleInit {
  private logger: Logger;

  constructor(private readonly loggingBridge: LoggingBridgeService) {}

  onModuleInit() {
    // ⭐ FOCUS: Get enterprise logger through bridge
    this.logger = this.loggingBridge.createLogger('EnterpriseUserService', {
      service: 'user-management',
      version: '2.0.0',
      boundedContext: 'UserManagement',
    });
  }

  async createUser(userData: any): Promise<any> {
    // ⭐ FOCUS: Enterprise performance tracking
    return this.loggingBridge.trackPerformance(
      'createUser',
      async () => {
        this.logger.info('Enterprise user creation started', {
          operation: 'createUser',
          userEmail: userData.email, // Automatically masked
          hasComplexData: !!userData.preferences,
        });

        try {
          // Simulate user creation
          const user = await this.saveUser(userData);

          // ⭐ FOCUS: Log domain event through bridge
          this.loggingBridge.logDomainEvent('UserCreated', user.id, {
            email: user.email,
            role: user.role,
            createdAt: user.createdAt,
          });

          this.logger.info('Enterprise user creation completed', {
            userId: user.id,
            userEmail: user.email, // Masked
            role: user.role,
          });

          return user;
        } catch (error) {
          this.logger.error('Enterprise user creation failed', {
            error: error,
            userData: userData,
          });
          throw error;
        }
      },
      {
        userEmail: userData.email, // Context for performance tracking
        operation: 'user_creation',
      }
    );
  }

  async authenticateUser(credentials: any): Promise<any> {
    // ⭐ FOCUS: Security event logging
    this.loggingBridge.logSecurityEvent(
      'authentication',
      {
        username: credentials.username,
        ipAddress: credentials.ipAddress,
        userAgent: credentials.userAgent,
        timestamp: new Date(),
      },
      'medium'
    );

    this.logger.info('User authentication attempt', {
      username: credentials.username,
      ipAddress: credentials.ipAddress,
    });

    // Authentication logic...
    const authResult = await this.performAuthentication(credentials);

    if (authResult.success) {
      this.loggingBridge.logSecurityEvent(
        'authentication',
        {
          username: credentials.username,
          success: true,
          sessionId: authResult.sessionId,
        },
        'low'
      );
    } else {
      this.loggingBridge.logSecurityEvent(
        'security_violation',
        {
          username: credentials.username,
          reason: authResult.failureReason,
          attemptCount: authResult.attemptCount,
        },
        authResult.attemptCount > 3 ? 'high' : 'medium'
      );
    }

    return authResult;
  }

  // Private methods
  private async saveUser(userData: any): Promise<any> {
    return {
      id: `user-${Date.now()}`,
      ...userData,
      createdAt: new Date(),
    };
  }

  private async performAuthentication(credentials: any): Promise<any> {
    // Simulate authentication
    const success = Math.random() > 0.1; // 90% success rate

    return {
      success,
      sessionId: success ? `session-${Date.now()}` : undefined,
      failureReason: success ? undefined : 'invalid_credentials',
      attemptCount: success ? 1 : Math.floor(Math.random() * 5) + 1,
    };
  }
}

// enterprise-logging.module.ts - Module configuration
import { Module, OnModuleInit } from '@nestjs/common';
import { VytchesDDD, SimpleContainer } from '@vytches-ddd/di';
import { LoggingBridgeService } from './logging-bridge.service';
import { EnterpriseUserService } from '../user/enterprise-user.service';

@Module({
  providers: [LoggingBridgeService, EnterpriseUserService],
  exports: [LoggingBridgeService],
})
export class EnterpriseLoggingModule implements OnModuleInit {
  async onModuleInit() {
    try {
      // ⭐ CRITICAL: Initialize VytchesDDD BEFORE framework DI
      const container = new SimpleContainer();

      // Register enterprise dependencies
      container.registerInstance('configService', {
        get: (key: string) => process.env[key],
        getLoggingConfig: () => ({
          level: 'info',
          enableAuditTrail: true,
          enablePerformanceTracking: true,
        }),
      });

      container.registerInstance('metricsCollector', {
        recordAlert: (alert: any) => console.log('Alert recorded:', alert),
        recordSecurityAlert: (alert: any) =>
          console.log('Security alert:', alert),
        collectSystemMetrics: () => ({
          memoryUsage: process.memoryUsage(),
          cpuUsage: process.cpuUsage(),
        }),
      });

      // Configure VytchesDDD with auto-discovery
      await VytchesDDD.configure(container);

      console.log(
        '✅ Enterprise Logging Module initialized with VytchesDDD integration'
      );
    } catch (error) {
      console.error('Failed to initialize Enterprise Logging Module:', error);
      throw error;
    }
  }
}
```

## Usage Examples

```typescript
// Using the enterprise logging bridge in controllers
@Controller('enterprise')
export class EnterpriseController {
  private logger: Logger;

  constructor(private readonly loggingBridge: LoggingBridgeService) {
    this.logger = this.loggingBridge.createLogger('EnterpriseController', {
      layer: 'presentation',
      version: '2.0.0',
    });
  }

  @Post('users')
  async createUser(@Body() createUserDto: any) {
    return this.loggingBridge.trackPerformance(
      'createUser_endpoint',
      async () => {
        this.logger.info('Create user endpoint called', {
          endpoint: 'POST /enterprise/users',
          requestData: createUserDto,
        });

        // Business logic here...
        const result =
          await this.enterpriseUserService.createUser(createUserDto);

        this.logger.info('Create user endpoint completed', {
          userId: result.id,
          success: true,
        });

        return result;
      },
      {
        endpoint: 'POST /enterprise/users',
        userRole: createUserDto.role,
      }
    );
  }

  @Get('metrics')
  async getMetrics() {
    this.logger.debug('Enterprise metrics requested');
    return this.loggingBridge.generateMetrics();
  }
}
```

## Key Features

- **VytchesDDD Integration**: Full integration with VytchesDDD dependency
  injection system
- **Bridge Pattern**: Seamless integration between NestJS and VytchesDDD without
  conflicts
- **Enterprise Capabilities**: Advanced logging with audit trails, performance
  tracking, security events
- **Domain Event Logging**: Built-in support for domain-driven design patterns
- **Security Audit Trail**: Comprehensive security event logging with severity
  levels
- **Performance Analytics**: Advanced performance tracking with metrics
  aggregation
- **Context Management**: Enterprise-grade context propagation and correlation
- **Auto-Discovery**: Automatic service registration through VytchesDDD
  decorators

## Best Practices

1. **Always use Bridge Pattern** - Never use both `@Injectable()` and
   `@DomainService()` on the same class
2. **Initialize VytchesDDD First** - Configure VytchesDDD before NestJS DI in
   `OnModuleInit`
3. **Cache Service References** - Resolve VytchesDDD services once during
   initialization
4. **Use Enterprise Features** - Leverage audit trails, security logging, and
   performance tracking
5. **Maintain Separation** - Keep business logic in domain services, use NestJS
   services as bridges
6. **Handle Errors Appropriately** - Log errors at both framework and domain
   levels
7. **Monitor Performance** - Use built-in performance tracking for critical
   operations

## Common Pitfalls

- **Double Instance Creation**: Using both DI systems on the same class creates
  conflicts
- **Wrong Initialization Order**: VytchesDDD must be configured before NestJS
  tries to resolve services
- **Missing Bridge Pattern**: Direct usage of domain services in controllers
  breaks separation
- **Performance Overhead**: Enterprise logging has more overhead, monitor in
  high-traffic scenarios
- **Context Leaks**: Properly clean up logging contexts in long-running
  operations

## Related Examples

- [Enterprise Monitoring](./example-2.md)
- [Multi-Tenant DI Integration](./example-2.md)
- [Basic Manual Setup](../basic/example-1.md)
- [Basic Service Integration](../basic/example-2.md)
