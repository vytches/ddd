# NestJS Production Logging Infrastructure

**Focus**: Production-ready logging infrastructure with NestJS integration
**Base Example**: [Enterprise Observability](../../../advanced/example-1.md)
**Dependencies**: @nestjs/common, @vytches-ddd/logging, @vytches-ddd/di,
winston, pino

## Service Implementation

```typescript
// logging-infrastructure.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Logger, LoggerConfig } from '@vytches-ddd/logging';
import { VytchesDDD } from '@vytches-ddd/di';
import type {
  LoggingInfrastructure,
  ProductionLogConfig,
  AlertingConfig,
  MetricsConfig,
} from './types'; // From your application

@Injectable()
export class ProductionLoggingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger: Logger;
  private readonly infrastructure: LoggingInfrastructure;
  private healthCheckInterval?: NodeJS.Timeout;
  private metricsCollectionInterval?: NodeJS.Timeout;

  constructor() {
    // ⭐ FOCUS: @vytches-ddd/di integration for enterprise logging
    this.infrastructure = VytchesDDD.resolve<LoggingInfrastructure>(
      'loggingInfrastructure'
    );
    this.logger = Logger.forContext('ProductionLoggingService').withContext({
      service: 'nestjs-app',
      environment: process.env.NODE_ENV || 'production',
    });
  }

  async onModuleInit(): Promise<void> {
    // ✅ FOCUS: Production logging infrastructure initialization
    await this.initializeProductionLogging();
    await this.setupHealthMonitoring();
    await this.configureAlertingRules();

    this.logger.info('Production logging infrastructure initialized', {
      logLevel: process.env.LOG_LEVEL || 'info',
      outputFormat: process.env.LOG_FORMAT || 'json',
      enabledTransports: this.infrastructure.getEnabledTransports(),
      healthCheckInterval: 30000,
      metricsInterval: 10000,
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    if (this.metricsCollectionInterval) {
      clearInterval(this.metricsCollectionInterval);
    }

    await this.infrastructure.shutdown();
    this.logger.info('Production logging infrastructure shutdown completed');
  }

  // ✅ FOCUS: Enterprise request logging middleware integration
  async logRequest(
    method: string,
    url: string,
    statusCode: number,
    responseTime: number,
    userContext?: UserContext
  ): Promise<void> {
    const requestLogger = this.logger
      .withCorrelationId(this.generateRequestId())
      .withUserId(userContext?.userId)
      .withContext({
        httpMethod: method,
        httpUrl: url,
        httpStatusCode: statusCode,
        responseTimeMs: responseTime,
        userAgent: userContext?.userAgent,
        clientIP: userContext?.clientIP,
      });

    // ✅ FOCUS: Structured HTTP request logging
    if (statusCode >= 500) {
      requestLogger.error('HTTP server error', {
        errorClass: 'HTTP_SERVER_ERROR',
        errorCode: statusCode,
        endpoint: `${method} ${url}`,
        responseTimeMs: responseTime,
        impact: 'HIGH',
        requiresInvestigation: true,
      });
    } else if (statusCode >= 400) {
      requestLogger.warn('HTTP client error', {
        errorClass: 'HTTP_CLIENT_ERROR',
        errorCode: statusCode,
        endpoint: `${method} ${url}`,
        responseTimeMs: responseTime,
        userContext: userContext
          ? {
              userId: userContext.userId,
              sessionId: userContext.sessionId,
            }
          : undefined,
      });
    } else {
      requestLogger.info('HTTP request completed', {
        endpoint: `${method} ${url}`,
        statusCode,
        responseTimeMs: responseTime,
        performance: this.classifyPerformance(responseTime),
      });
    }

    // ✅ FOCUS: Real-time metrics collection
    await this.infrastructure.recordHttpMetrics({
      method,
      endpoint: this.sanitizeEndpoint(url),
      statusCode,
      responseTimeMs: responseTime,
      timestamp: new Date(),
      userId: userContext?.userId,
    });
  }

  // ✅ FOCUS: Business transaction logging
  async logBusinessTransaction(
    transactionType: string,
    transactionId: string,
    userId: string,
    details: BusinessTransactionDetails
  ): Promise<void> {
    const businessLogger = this.logger
      .withCorrelationId(transactionId)
      .withUserId(userId)
      .withContext({
        transactionType,
        businessDomain: details.domain,
        transactionValue: details.value,
        currency: details.currency,
      });

    businessLogger.business('Business transaction logged', {
      transactionId,
      type: transactionType,
      status: details.status,
      amount: details.value,
      currency: details.currency,
      businessContext: {
        domain: details.domain,
        category: details.category,
        priority: details.priority,
      },
      auditTrail: {
        initiatedBy: userId,
        timestamp: new Date().toISOString(),
        source: 'WEB_APPLICATION',
        compliance: {
          auditRequired: details.auditRequired,
          retentionPeriod: details.retentionPeriod,
          dataClassification: details.dataClassification,
        },
      },
      businessMetrics: {
        conversionFunnel: details.conversionStep,
        customerSegment: details.customerSegment,
        acquisitionChannel: details.acquisitionChannel,
      },
    });

    // ✅ FOCUS: Business intelligence data collection
    if (details.businessIntelligence) {
      await this.infrastructure.recordBusinessMetrics({
        transactionType,
        domain: details.domain,
        value: details.value,
        currency: details.currency,
        customerSegment: details.customerSegment,
        timestamp: new Date(),
        metadata: details.businessIntelligence,
      });
    }
  }

  // ✅ FOCUS: Security event logging with threat detection
  async logSecurityEvent(
    eventType: SecurityEventType,
    severity: SecuritySeverity,
    details: SecurityEventDetails,
    request?: any
  ): Promise<void> {
    const securityLogger = this.logger
      .withCorrelationId(details.correlationId)
      .withUserId(details.userId)
      .withContext({
        securityEventType: eventType,
        threatSeverity: severity,
        sourceIP: details.sourceIP,
        userAgent: details.userAgent,
        endpoint: request?.url,
      });

    // ✅ FOCUS: Advanced threat intelligence integration
    const threatIntelligence = await this.infrastructure.analyzeThreat({
      eventType,
      sourceIP: details.sourceIP,
      userAgent: details.userAgent,
      behaviorPattern: details.behaviorPattern,
      historicalContext: await this.getSecurityHistory(
        details.userId,
        details.sourceIP
      ),
    });

    securityLogger.security('Security event detected', {
      eventType,
      severity,
      timestamp: new Date().toISOString(),
      source: {
        ip: details.sourceIP,
        userAgent: details.userAgent,
        geoLocation: threatIntelligence.geoLocation,
        reputation: threatIntelligence.ipReputation,
      },
      threatAnalysis: {
        riskScore: threatIntelligence.riskScore,
        threatCategory: threatIntelligence.category,
        confidenceLevel: threatIntelligence.confidence,
        similarIncidents: threatIntelligence.similarIncidents.length,
        recommendedActions: threatIntelligence.recommendations,
      },
      userContext: details.userId
        ? {
            userId: details.userId,
            accountAge: await this.calculateAccountAge(details.userId),
            previousViolations: await this.getPreviousViolations(
              details.userId
            ),
            riskProfile: await this.getUserRiskProfile(details.userId),
          }
        : undefined,
      systemImpact: {
        affectedServices: this.identifyAffectedServices(eventType),
        dataAtRisk: this.assessDataAtRisk(eventType, details),
        businessImpact: this.assessBusinessImpact(severity, eventType),
      },
    });

    // ✅ FOCUS: Automated security response
    if (severity === 'CRITICAL' || threatIntelligence.riskScore > 0.8) {
      await this.triggerSecurityResponse(
        eventType,
        details,
        threatIntelligence
      );

      securityLogger.critical(
        'Critical security event triggered automated response',
        {
          eventType,
          responseActions: await this.getTriggeredActions(eventType),
          escalationLevel: this.calculateEscalationLevel(
            severity,
            threatIntelligence.riskScore
          ),
          notificationsSent: await this.sendSecurityNotifications(
            eventType,
            severity,
            details
          ),
        }
      );
    }
  }

  // ✅ FOCUS: Application performance monitoring
  async logPerformanceMetrics(
    operationName: string,
    executionTimeMs: number,
    memoryUsageMB: number,
    additionalMetrics?: PerformanceMetrics
  ): Promise<void> {
    const performanceLogger = this.logger.withContext({
      performanceMonitoring: true,
      operation: operationName,
    });

    const performanceData = {
      operation: operationName,
      timing: {
        executionTimeMs,
        timestamp: new Date().toISOString(),
      },
      resources: {
        memoryUsageMB,
        cpuUsage: additionalMetrics?.cpuUsage,
        activeConnections: additionalMetrics?.activeConnections,
        queueDepth: additionalMetrics?.queueDepth,
      },
      thresholds: {
        warningThresholdMs: this.getPerformanceThreshold(
          operationName,
          'warning'
        ),
        errorThresholdMs: this.getPerformanceThreshold(operationName, 'error'),
        memoryThresholdMB: this.getMemoryThreshold(operationName),
      },
    };

    // ✅ FOCUS: Performance threshold analysis
    const violations = this.analyzePerformanceViolations(performanceData);

    if (violations.length > 0) {
      performanceLogger.warn('Performance thresholds violated', {
        ...performanceData,
        violations,
        impact: this.assessPerformanceImpact(violations),
        recommendations: this.generatePerformanceRecommendations(
          violations,
          additionalMetrics
        ),
        trendAnalysis: await this.analyzePerformanceTrend(
          operationName,
          executionTimeMs
        ),
      });

      // Trigger performance alerts
      await this.infrastructure.sendPerformanceAlert({
        operation: operationName,
        violations,
        currentMetrics: performanceData,
        severity: this.calculatePerformanceSeverity(violations),
      });
    } else {
      performanceLogger.debug('Performance metrics recorded', {
        ...performanceData,
        healthStatus: 'HEALTHY',
        efficiencyScore: this.calculateEfficiencyScore(performanceData),
      });
    }

    // ✅ FOCUS: Real-time performance dashboard updates
    await this.infrastructure.updatePerformanceDashboard({
      operation: operationName,
      metrics: performanceData,
      timestamp: new Date(),
      healthScore: this.calculateHealthScore(performanceData, violations),
    });
  }

  // ✅ FOCUS: Error correlation and analysis
  async logApplicationError(
    error: Error,
    context: ErrorContext,
    request?: any
  ): Promise<void> {
    const errorLogger = this.logger
      .withCorrelationId(context.correlationId)
      .withUserId(context.userId)
      .withContext({
        errorType: error.name,
        errorCategory: this.categorizeError(error),
        severity: this.calculateErrorSeverity(error, context),
      });

    // ✅ FOCUS: Advanced error analysis
    const errorAnalysis = await this.infrastructure.analyzeError({
      error,
      context,
      stackTrace: error.stack,
      systemState: await this.captureSystemState(),
      correlatedErrors: await this.findCorrelatedErrors(
        context.correlationId,
        '1h'
      ),
    });

    errorLogger.error('Application error occurred', {
      error: {
        name: error.name,
        message: error.message,
        stack: this.sanitizeStackTrace(error.stack),
        fingerprint: this.generateErrorFingerprint(error),
      },
      context: {
        operation: context.operation,
        component: context.component,
        userAction: context.userAction,
        sessionId: context.sessionId,
        requestId: context.requestId,
      },
      analysis: {
        category: errorAnalysis.category,
        severity: errorAnalysis.severity,
        frequency: errorAnalysis.frequency,
        pattern: errorAnalysis.pattern,
        rootCause: errorAnalysis.rootCause,
        resolution: errorAnalysis.suggestedResolution,
      },
      impact: {
        usersAffected: errorAnalysis.usersAffected,
        businessImpact: errorAnalysis.businessImpact,
        serviceAvailability: errorAnalysis.serviceAvailability,
      },
      systemContext: {
        environment: process.env.NODE_ENV,
        serviceVersion: process.env.SERVICE_VERSION,
        nodeVersion: process.version,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
      },
    });

    // ✅ FOCUS: Error escalation and notification
    if (errorAnalysis.severity === 'CRITICAL' || errorAnalysis.frequency > 10) {
      await this.escalateError(error, context, errorAnalysis);

      errorLogger.critical('Critical error requires immediate attention', {
        escalationLevel: this.calculateEscalationLevel(
          errorAnalysis.severity,
          errorAnalysis.frequency
        ),
        onCallEngineer: await this.getOnCallEngineer(),
        automatedActions: await this.triggerErrorResponse(
          error,
          context,
          errorAnalysis
        ),
        incidentId: await this.createIncident(error, context, errorAnalysis),
      });
    }
  }

  private async initializeProductionLogging(): Promise<void> {
    const config: ProductionLogConfig = {
      level: process.env.LOG_LEVEL || 'info',
      format: process.env.LOG_FORMAT || 'json',
      transports: {
        console: {
          enabled: process.env.CONSOLE_LOGGING !== 'false',
          colorize: process.env.NODE_ENV !== 'production',
        },
        file: {
          enabled: process.env.FILE_LOGGING === 'true',
          filename: process.env.LOG_FILE || '/var/log/nestjs-app.log',
          maxsize: parseInt(process.env.LOG_MAX_SIZE || '100000000'), // 100MB
          maxFiles: parseInt(process.env.LOG_MAX_FILES || '5'),
          compress: true,
        },
        elasticsearch: {
          enabled: process.env.ELASTICSEARCH_LOGGING === 'true',
          host: process.env.ELASTICSEARCH_HOST || 'localhost:9200',
          index: process.env.ELASTICSEARCH_INDEX || 'nestjs-logs',
          type: '_doc',
        },
        datadog: {
          enabled: process.env.DATADOG_LOGGING === 'true',
          apiKey: process.env.DATADOG_API_KEY,
          service: process.env.DATADOG_SERVICE || 'nestjs-app',
          source: 'nodejs',
          tags: [
            `env:${process.env.NODE_ENV}`,
            `version:${process.env.SERVICE_VERSION}`,
          ],
        },
      },
      sampling: {
        debug: parseFloat(process.env.DEBUG_SAMPLING || '0.1'),
        info: parseFloat(process.env.INFO_SAMPLING || '1.0'),
        warn: parseFloat(process.env.WARN_SAMPLING || '1.0'),
        error: parseFloat(process.env.ERROR_SAMPLING || '1.0'),
      },
    };

    await this.infrastructure.initialize(config);
  }

  private async setupHealthMonitoring(): Promise<void> {
    this.healthCheckInterval = setInterval(async () => {
      const healthMetrics = await this.infrastructure.getHealthMetrics();

      if (healthMetrics.status !== 'HEALTHY') {
        this.logger.warn('Logging infrastructure health degraded', {
          status: healthMetrics.status,
          issues: healthMetrics.issues,
          transportHealth: healthMetrics.transportHealth,
          recommendations: healthMetrics.recommendations,
        });
      }
    }, 30000); // Every 30 seconds
  }

  private generateRequestId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private sanitizeEndpoint(url: string): string {
    // Remove sensitive parameters and normalize dynamic segments
    return url
      .replace(/\/\d+/g, '/:id')
      .replace(/[?&]token=[^&]*/g, '')
      .replace(/[?&]api_key=[^&]*/g, '');
  }

  private classifyPerformance(responseTime: number): string {
    if (responseTime < 100) return 'EXCELLENT';
    if (responseTime < 500) return 'GOOD';
    if (responseTime < 1000) return 'ACCEPTABLE';
    if (responseTime < 5000) return 'SLOW';
    return 'CRITICAL';
  }
}
```

## Module Configuration

```typescript
// logging.module.ts
import { Module, Global } from '@nestjs/common';
import { ProductionLoggingService } from './logging-infrastructure.service';
import { LoggingInterceptor } from './logging.interceptor';
import { LoggingMiddleware } from './logging.middleware';

@Global()
@Module({
  providers: [ProductionLoggingService, LoggingInterceptor, LoggingMiddleware],
  exports: [ProductionLoggingService],
})
export class ProductionLoggingModule {}
```

## Request Logging Middleware

```typescript
// logging.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ProductionLoggingService } from './logging-infrastructure.service';

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  constructor(private readonly loggingService: ProductionLoggingService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const startTime = Date.now();

    res.on('finish', async () => {
      const responseTime = Date.now() - startTime;

      await this.loggingService.logRequest(
        req.method,
        req.originalUrl,
        res.statusCode,
        responseTime,
        {
          userId: req.user?.id,
          sessionId: req.session?.id,
          userAgent: req.get('user-agent'),
          clientIP: req.ip,
        }
      );
    });

    next();
  }
}
```

## Key Features

- **Production-Ready Infrastructure**: Enterprise logging with multiple
  transport options
- **Real-time Health Monitoring**: Continuous monitoring of logging system
  health
- **Advanced Threat Intelligence**: Security event analysis with automated
  responses
- **Performance Threshold Management**: Configurable performance monitoring with
  alerting
- **Error Correlation & Analysis**: Sophisticated error tracking with root cause
  analysis
- **Business Intelligence Integration**: Business transaction logging for
  analytics
- **Compliance & Audit Support**: Comprehensive audit trails with retention
  policies
- **Automated Incident Response**: Integration with incident management systems

## Common Pitfalls

- **Log Volume Management**: Monitor and control log volume in production
  environments
- **Sensitive Data Exposure**: Ensure proper sanitization of sensitive
  information
- **Performance Impact**: Balance logging detail with application performance
- **Transport Reliability**: Implement fallback mechanisms for log transport
  failures
- **Storage Costs**: Implement cost-effective retention and archival policies
- **Alert Fatigue**: Configure meaningful thresholds to avoid excessive
  notifications

## Related Examples

- [Enterprise Observability](../../../advanced/example-1.md) - Advanced
  observability patterns
- [Basic NestJS Integration](../basic/example-1.md) - Foundation patterns
- [Intermediate Context Management](../intermediate/example-1.md) - Context
  enrichment
