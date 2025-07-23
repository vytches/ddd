# Enterprise Observability with Distributed Tracing

**Version**: 1.0.0
**Package**: @vytches-ddd/logging
**Complexity**: Advanced
**Domain**: Infrastructure
**Patterns**: Distributed tracing, Observability, Correlation tracking, Performance monitoring
**Dependencies**: @vytches-ddd/logging, @vytches-ddd/utils, @vytches-ddd/resilience

## Description

This example demonstrates implementing enterprise-grade observability with comprehensive distributed tracing, correlation tracking, and performance monitoring. It shows how to create sophisticated logging infrastructure for complex distributed systems with automatic context enrichment, structured event correlation, and multi-dimensional observability.

## Business Context

Enterprise systems require advanced observability for:
- **Microservices Architecture**: Tracking requests across dozens of services
- **Compliance & Audit**: Meeting regulatory requirements with detailed audit trails
- **Performance Monitoring**: Identifying bottlenecks in complex distributed workflows
- **Root Cause Analysis**: Quickly diagnosing issues in production environments
- **Business Intelligence**: Understanding system behavior patterns for optimization
- **Security Monitoring**: Detecting anomalous behavior and security threats

## Code Example

```typescript
// enterprise-observability.ts
import { Logger, LoggerConfig, LogContext } from '@vytches-ddd/logging';
import { Result } from '@vytches-ddd/utils';
import { CircuitBreaker, Retry } from '@vytches-ddd/resilience';
import type {
  TraceContext,
  SpanContext,
  ObservabilityMetrics,
  BusinessEvent,
  AuditContext
} from '../types'; // From your application

// ✅ FOCUS: Enterprise trace context with rich metadata
export interface EnterpriseTraceContext extends TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  serviceName: string;
  serviceVersion: string;
  environment: string;
  correlationId: string;
  causationId?: string;
  userId?: string;
  tenantId?: string;
  sessionId?: string;
  requestId: string;
  businessContext: {
    domain: string;
    aggregate?: string;
    command?: string;
    event?: string;
  };
  performance: {
    startTime: bigint;
    timeout?: number;
    priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  };
  compliance: {
    auditRequired: boolean;
    retentionPeriod?: number;
    dataClassification: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
    regulatoryFramework?: string[];
  };
  baggage: Record<string, string>;
}

// ✅ FOCUS: Advanced observable service with comprehensive tracking
export class EnterpriseObservableService {
  private readonly logger: Logger;
  private readonly spanStack: SpanContext[] = [];
  private readonly performanceMetrics = new Map<string, PerformanceMetric>();

  constructor(
    private readonly serviceName: string,
    private readonly serviceVersion: string,
    private readonly metricsCollector: IMetricsCollector,
    private readonly traceExporter: ITraceExporter
  ) {
    this.logger = Logger.forContext(`${serviceName}.ObservableService`)
      .withContext({
        service: serviceName,
        version: serviceVersion,
        environment: process.env.NODE_ENV || 'development'
      });
  }

  // ✅ FOCUS: Comprehensive business operation tracking
  async executeBusinessOperation<T>(
    operationName: string,
    businessContext: BusinessOperationContext,
    operation: (context: EnterpriseTraceContext) => Promise<T>
  ): Promise<Result<T, Error>> {
    const traceContext = this.createEnterpriseTraceContext(operationName, businessContext);
    const span = this.startSpan(traceContext);

    // ✅ FOCUS: Rich structured logging with business context
    const operationLogger = this.logger
      .withCorrelationId(traceContext.correlationId)
      .withUserId(traceContext.userId)
      .withTenantId(traceContext.tenantId)
      .withContext({
        traceId: traceContext.traceId,
        spanId: traceContext.spanId,
        operationName: traceContext.operationName,
        domain: traceContext.businessContext.domain,
        aggregate: traceContext.businessContext.aggregate,
        priority: traceContext.performance.priority
      });

    operationLogger.info('Business operation started', {
      operation: operationName,
      businessContext: traceContext.businessContext,
      performance: {
        priority: traceContext.performance.priority,
        timeout: traceContext.performance.timeout
      },
      compliance: {
        auditRequired: traceContext.compliance.auditRequired,
        dataClassification: traceContext.compliance.dataClassification
      }
    });

    try {
      // Record operation start metrics
      await this.recordOperationMetrics('start', traceContext);

      // Execute operation with distributed tracing
      const result = await this.executeWithTracing(operation, traceContext);

      // ✅ FOCUS: Success tracking with business metrics
      const executionTime = this.calculateExecutionTime(traceContext.performance.startTime);
      
      await this.recordOperationMetrics('success', traceContext, {
        executionTimeMs: executionTime,
        resultSize: this.calculateResultSize(result)
      });

      operationLogger.info('Business operation completed successfully', {
        executionTimeMs: executionTime,
        resultSize: this.calculateResultSize(result),
        businessImpact: this.calculateBusinessImpact(result, traceContext)
      });

      // ✅ FOCUS: Audit logging for compliance
      if (traceContext.compliance.auditRequired) {
        await this.recordAuditEvent({
          type: 'BUSINESS_OPERATION_SUCCESS',
          traceContext,
          result: this.sanitizeForAudit(result, traceContext.compliance.dataClassification),
          executionTimeMs: executionTime
        });
      }

      this.finishSpan(span, { status: 'success', executionTimeMs: executionTime });
      return Result.ok(result);

    } catch (error) {
      const executionTime = this.calculateExecutionTime(traceContext.performance.startTime);
      
      // ✅ FOCUS: Comprehensive error tracking
      operationLogger.error('Business operation failed', {
        error: (error as Error).message,
        errorType: (error as Error).name,
        stack: (error as Error).stack,
        executionTimeMs: executionTime,
        errorContext: this.extractErrorContext(error, traceContext)
      });

      await this.recordOperationMetrics('failure', traceContext, {
        executionTimeMs: executionTime,
        errorType: (error as Error).name,
        errorMessage: (error as Error).message
      });

      // Security and compliance error logging
      if (this.isSecurityError(error)) {
        operationLogger.security('Security violation detected', {
          securityEvent: this.classifySecurityEvent(error),
          threatLevel: this.assessThreatLevel(error),
          affectedResources: this.identifyAffectedResources(traceContext)
        });
      }

      // Audit failure events
      if (traceContext.compliance.auditRequired) {
        await this.recordAuditEvent({
          type: 'BUSINESS_OPERATION_FAILURE',
          traceContext,
          error: this.sanitizeErrorForAudit(error, traceContext.compliance.dataClassification),
          executionTimeMs: executionTime
        });
      }

      this.finishSpan(span, { 
        status: 'error', 
        error: (error as Error).message,
        executionTimeMs: executionTime 
      });

      return Result.fail(error as Error);
    }
  }

  // ✅ FOCUS: Distributed transaction coordination tracking
  async coordinateDistributedTransaction<T>(
    transactionId: string,
    participants: ServiceParticipant[],
    coordinator: (context: EnterpriseTraceContext) => Promise<T>
  ): Promise<Result<T, Error>> {
    const traceContext = this.createEnterpriseTraceContext(
      'DistributedTransaction',
      {
        domain: 'TransactionManagement',
        transactionId,
        participants: participants.map(p => p.serviceName)
      }
    );

    const distributedLogger = this.logger
      .withCorrelationId(traceContext.correlationId)
      .withContext({
        transactionId,
        participantCount: participants.length,
        coordinationType: 'SAGA'
      });

    distributedLogger.info('Distributed transaction started', {
      transactionId,
      participants: participants.map(p => ({
        service: p.serviceName,
        operation: p.operationName,
        timeout: p.timeout
      })),
      coordinationStrategy: 'SAGA_ORCHESTRATION'
    });

    try {
      // ✅ FOCUS: Transaction phase tracking
      for (let i = 0; i < participants.length; i++) {
        const participant = participants[i];
        const phaseContext = this.createChildContext(traceContext, `phase-${i + 1}`);
        
        distributedLogger.debug('Transaction phase starting', {
          phase: i + 1,
          totalPhases: participants.length,
          participant: participant.serviceName,
          operation: participant.operationName
        });

        // Record phase metrics
        await this.recordTransactionPhaseMetrics(transactionId, i + 1, 'start', participant);
      }

      // Execute coordination logic
      const result = await coordinator(traceContext);

      distributedLogger.info('Distributed transaction completed successfully', {
        transactionId,
        executionTimeMs: this.calculateExecutionTime(traceContext.performance.startTime),
        phasesCompleted: participants.length
      });

      // Record transaction success metrics
      await this.recordTransactionMetrics(transactionId, 'success', {
        participantCount: participants.length,
        executionTimeMs: this.calculateExecutionTime(traceContext.performance.startTime)
      });

      return Result.ok(result);

    } catch (error) {
      // ✅ FOCUS: Transaction failure and compensation tracking
      distributedLogger.error('Distributed transaction failed', {
        transactionId,
        error: (error as Error).message,
        compensationRequired: true,
        affectedParticipants: participants.map(p => p.serviceName)
      });

      // Track compensation events
      distributedLogger.info('Starting transaction compensation', {
        transactionId,
        compensationStrategy: 'REVERSE_ORDER'
      });

      await this.recordTransactionMetrics(transactionId, 'failure', {
        participantCount: participants.length,
        errorType: (error as Error).name
      });

      return Result.fail(error as Error);
    }
  }

  // ✅ FOCUS: Performance monitoring with business metrics
  async monitorPerformancePattern(
    patternName: string,
    thresholds: PerformanceThresholds,
    operation: () => Promise<any>
  ): Promise<PerformanceAnalysis> {
    const startTime = process.hrtime.bigint();
    const performanceLogger = this.logger.withContext({ 
      performancePattern: patternName 
    });

    performanceLogger.debug('Performance monitoring started', {
      pattern: patternName,
      thresholds: {
        warningThresholdMs: thresholds.warningMs,
        errorThresholdMs: thresholds.errorMs,
        memoryThresholdMB: thresholds.memoryMB
      }
    });

    const initialMemory = process.memoryUsage();
    let cpuUsageBefore: NodeJS.CpuUsage;
    
    try {
      cpuUsageBefore = process.cpuUsage();
      const result = await operation();
      const cpuUsageAfter = process.cpuUsage(cpuUsageBefore);
      
      const executionTime = this.calculateExecutionTime(startTime);
      const finalMemory = process.memoryUsage();
      const memoryDelta = {
        heapUsed: finalMemory.heapUsed - initialMemory.heapUsed,
        heapTotal: finalMemory.heapTotal - initialMemory.heapTotal,
        rss: finalMemory.rss - initialMemory.rss
      };

      const analysis: PerformanceAnalysis = {
        patternName,
        executionTimeMs: executionTime,
        cpuUsage: {
          userMs: cpuUsageAfter.user / 1000,
          systemMs: cpuUsageAfter.system / 1000
        },
        memoryDelta,
        thresholdViolations: this.checkThresholdViolations(executionTime, memoryDelta, thresholds),
        recommendations: this.generatePerformanceRecommendations(executionTime, memoryDelta, thresholds)
      };

      // ✅ FOCUS: Performance alerting based on thresholds
      if (analysis.thresholdViolations.length > 0) {
        performanceLogger.warn('Performance thresholds violated', {
          violations: analysis.thresholdViolations,
          actualPerformance: {
            executionTimeMs: executionTime,
            memoryUsedMB: memoryDelta.heapUsed / 1024 / 1024
          },
          recommendations: analysis.recommendations
        });
      } else {
        performanceLogger.debug('Performance within acceptable limits', {
          executionTimeMs: executionTime,
          memoryUsedMB: memoryDelta.heapUsed / 1024 / 1024,
          efficiency: this.calculateEfficiencyScore(analysis)
        });
      }

      // Record detailed performance metrics
      await this.metricsCollector.recordMetrics({
        operation: `PerformancePattern.${patternName}`,
        executionTimeMs: executionTime,
        cpuUserMs: analysis.cpuUsage.userMs,
        cpuSystemMs: analysis.cpuUsage.systemMs,
        memoryDeltaMB: memoryDelta.heapUsed / 1024 / 1024,
        thresholdViolations: analysis.thresholdViolations.length,
        efficiencyScore: this.calculateEfficiencyScore(analysis),
        tags: {
          pattern: patternName,
          performanceLevel: this.classifyPerformanceLevel(analysis)
        }
      });

      return analysis;

    } catch (error) {
      const executionTime = this.calculateExecutionTime(startTime);
      
      performanceLogger.error('Performance monitoring failed', {
        pattern: patternName,
        executionTimeMs: executionTime,
        error: (error as Error).message
      });

      throw error;
    }
  }

  // ✅ FOCUS: Security event correlation and analysis
  async trackSecurityEvent(
    eventType: SecurityEventType,
    severity: SecuritySeverity,
    details: SecurityEventDetails
  ): Promise<void> {
    const securityLogger = this.logger
      .withCorrelationId(details.correlationId)
      .withUserId(details.userId)
      .withContext({
        securityEventType: eventType,
        severity,
        sourceIP: details.sourceIP,
        userAgent: details.userAgent
      });

    // ✅ FOCUS: Security event enrichment
    const enrichedDetails = await this.enrichSecurityEvent(details);
    
    securityLogger.security('Security event detected', {
      eventType,
      severity,
      timestamp: new Date().toISOString(),
      details: enrichedDetails,
      riskAssessment: {
        riskScore: this.calculateRiskScore(eventType, enrichedDetails),
        threatLevel: this.assessThreatLevel(eventType, enrichedDetails),
        confidenceLevel: this.calculateConfidenceLevel(enrichedDetails)
      },
      correlatedEvents: await this.findCorrelatedEvents(details.correlationId, '1h'),
      recommendations: this.generateSecurityRecommendations(eventType, enrichedDetails)
    });

    // ✅ FOCUS: Automated response based on severity
    if (severity === 'CRITICAL' || severity === 'HIGH') {
      securityLogger.critical('High-severity security event requires immediate attention', {
        eventType,
        automaticActions: await this.triggerAutomaticSecurityResponse(eventType, enrichedDetails),
        escalationRequired: true,
        notificationsSent: await this.sendSecurityNotifications(eventType, severity, enrichedDetails)
      });
    }

    // Record security metrics
    await this.metricsCollector.recordMetrics({
      operation: 'SecurityEvent',
      eventType,
      severity,
      riskScore: this.calculateRiskScore(eventType, enrichedDetails),
      responseTimeMs: 0, // Immediate logging
      tags: {
        eventCategory: this.categorizeSecurityEvent(eventType),
        sourceCountry: enrichedDetails.geoLocation?.country || 'unknown',
        userType: enrichedDetails.userContext?.type || 'unknown'
      }
    });
  }

  private createEnterpriseTraceContext(
    operationName: string,
    businessContext: any
  ): EnterpriseTraceContext {
    return {
      traceId: this.generateTraceId(),
      spanId: this.generateSpanId(),
      parentSpanId: this.getCurrentSpanId(),
      operationName,
      serviceName: this.serviceName,
      serviceVersion: this.serviceVersion,
      environment: process.env.NODE_ENV || 'development',
      correlationId: this.generateCorrelationId(),
      requestId: this.generateRequestId(),
      businessContext: {
        domain: businessContext.domain || 'Unknown',
        aggregate: businessContext.aggregate,
        command: businessContext.command,
        event: businessContext.event
      },
      performance: {
        startTime: process.hrtime.bigint(),
        priority: businessContext.priority || 'NORMAL'
      },
      compliance: {
        auditRequired: businessContext.auditRequired || false,
        dataClassification: businessContext.dataClassification || 'INTERNAL'
      },
      baggage: businessContext.baggage || {}
    };
  }

  private startSpan(context: EnterpriseTraceContext): SpanContext {
    const span: SpanContext = {
      traceId: context.traceId,
      spanId: context.spanId,
      parentSpanId: context.parentSpanId,
      operationName: context.operationName,
      startTime: Number(context.performance.startTime),
      tags: {
        'service.name': context.serviceName,
        'service.version': context.serviceVersion,
        'business.domain': context.businessContext.domain,
        'performance.priority': context.performance.priority
      },
      baggage: context.baggage
    };

    this.spanStack.push(span);
    return span;
  }

  private finishSpan(span: SpanContext, attributes: Record<string, any>): void {
    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;
    span.attributes = { ...span.attributes, ...attributes };

    // Export span to tracing backend
    this.traceExporter.exportSpan(span);
    
    // Remove from stack
    const index = this.spanStack.indexOf(span);
    if (index > -1) {
      this.spanStack.splice(index, 1);
    }
  }

  private async recordAuditEvent(auditEvent: AuditEvent): Promise<void> {
    const auditLogger = this.logger.withContext({
      auditEvent: true,
      retentionPolicy: auditEvent.traceContext.compliance.retentionPeriod
    });

    auditLogger.audit('Audit event recorded', {
      type: auditEvent.type,
      traceId: auditEvent.traceContext.traceId,
      userId: auditEvent.traceContext.userId,
      tenantId: auditEvent.traceContext.tenantId,
      businessContext: auditEvent.traceContext.businessContext,
      compliance: auditEvent.traceContext.compliance,
      eventDetails: auditEvent.result || auditEvent.error,
      timestamp: new Date().toISOString()
    });
  }

  private calculateExecutionTime(startTime: bigint): number {
    return Number(process.hrtime.bigint() - startTime) / 1_000_000; // Convert to milliseconds
  }

  private generateTraceId(): string {
    return `trace-${Date.now()}-${Math.random().toString(36).substr(2, 16)}`;
  }

  private generateSpanId(): string {
    return `span-${Date.now()}-${Math.random().toString(36).substr(2, 16)}`;
  }

  private generateCorrelationId(): string {
    return `corr-${Date.now()}-${Math.random().toString(36).substr(2, 12)}`;
  }

  private generateRequestId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).substr(2, 12)}`;
  }

  private getCurrentSpanId(): string | undefined {
    return this.spanStack.length > 0 
      ? this.spanStack[this.spanStack.length - 1].spanId 
      : undefined;
  }
}

// ✅ FOCUS: Enterprise observability coordinator
export class ObservabilityCoordinator {
  private readonly services = new Map<string, EnterpriseObservableService>();
  private readonly logger = Logger.forContext('ObservabilityCoordinator');

  constructor(
    private readonly metricsCollector: IMetricsCollector,
    private readonly traceExporter: ITraceExporter,
    private readonly alertingService: IAlertingService
  ) {}

  registerService(
    serviceName: string,
    serviceVersion: string
  ): EnterpriseObservableService {
    const service = new EnterpriseObservableService(
      serviceName,
      serviceVersion,
      this.metricsCollector,
      this.traceExporter
    );

    this.services.set(serviceName, service);
    
    this.logger.info('Service registered for observability', {
      serviceName,
      serviceVersion,
      totalServices: this.services.size
    });

    return service;
  }

  async generateObservabilityReport(): Promise<ObservabilityReport> {
    const services = Array.from(this.services.entries());
    const serviceMetrics = await Promise.all(
      services.map(async ([name, service]) => ({
        serviceName: name,
        metrics: await this.collectServiceMetrics(service)
      }))
    );

    const report: ObservabilityReport = {
      timestamp: new Date(),
      totalServices: this.services.size,
      systemHealth: this.calculateSystemHealth(serviceMetrics),
      serviceMetrics,
      recommendations: this.generateSystemRecommendations(serviceMetrics),
      alertSummary: await this.getActiveAlerts()
    };

    this.logger.info('Observability report generated', {
      totalServices: report.totalServices,
      systemHealth: report.systemHealth,
      activeAlerts: report.alertSummary.activeCount,
      reportSize: JSON.stringify(report).length
    });

    return report;
  }
}
```

## Key Features

- **Enterprise Trace Context**: Comprehensive tracing with business, compliance, and performance metadata
- **Multi-dimensional Observability**: Business metrics, performance tracking, and security monitoring
- **Distributed Transaction Tracking**: Saga orchestration with phase-by-phase monitoring
- **Compliance & Audit Logging**: Automatic audit trails with data classification
- **Security Event Correlation**: Advanced security monitoring with risk assessment
- **Performance Pattern Analysis**: Detailed performance monitoring with threshold alerting
- **Cross-service Correlation**: Advanced correlation tracking across microservices
- **Business Impact Measurement**: Tracking business outcomes alongside technical metrics

## Usage Examples

```typescript
// Initialize enterprise observability
const metricsCollector = new PrometheusMetricsCollector();
const traceExporter = new JaegerTraceExporter();
const coordinator = new ObservabilityCoordinator(
  metricsCollector,
  traceExporter,
  alertingService
);

// Register services
const orderService = coordinator.registerService('order-service', '2.1.0');
const paymentService = coordinator.registerService('payment-service', '1.8.3');

// Execute business operation with full observability
const result = await orderService.executeBusinessOperation(
  'ProcessOrderPayment',
  {
    domain: 'OrderManagement',
    aggregate: 'Order',
    command: 'ProcessPayment',
    auditRequired: true,
    dataClassification: 'CONFIDENTIAL',
    priority: 'HIGH'
  },
  async (context) => {
    // Business logic with automatic tracing
    const order = await orderRepository.findById(orderId);
    const payment = await paymentService.processPayment(order.total, context);
    return { order, payment };
  }
);

// Monitor distributed transaction
const transactionResult = await orderService.coordinateDistributedTransaction(
  'txn-order-123',
  [
    { serviceName: 'inventory-service', operationName: 'ReserveItems', timeout: 30000 },
    { serviceName: 'payment-service', operationName: 'ProcessPayment', timeout: 60000 },
    { serviceName: 'shipping-service', operationName: 'ArrangeShipping', timeout: 45000 }
  ],
  async (context) => {
    // Distributed transaction coordination logic
    return await coordinateOrderFulfillment(context);
  }
);

// Performance monitoring
const performanceAnalysis = await orderService.monitorPerformancePattern(
  'HighVolumeOrderProcessing',
  {
    warningMs: 1000,
    errorMs: 5000,
    memoryMB: 100
  },
  async () => {
    return await processHighVolumeOrders();
  }
);

// Security event tracking
await orderService.trackSecurityEvent(
  'SUSPICIOUS_LOGIN_ATTEMPT',
  'HIGH',
  {
    correlationId: 'security-event-123',
    userId: 'user-456',
    sourceIP: '192.168.1.100',
    userAgent: 'Mozilla/5.0...',
    additionalContext: {
      failedAttempts: 5,
      timeWindow: '10m',
      geoLocation: { country: 'US', region: 'CA' }
    }
  }
);

// Generate comprehensive observability report
const report = await coordinator.generateObservabilityReport();
console.log('System Health:', report.systemHealth);
console.log('Active Alerts:', report.alertSummary.activeCount);
```

## Common Pitfalls

- **Context Propagation**: Ensure trace context flows through all async boundaries
- **Metric Cardinality**: Avoid high-cardinality tags that overwhelm monitoring systems
- **Performance Impact**: Balance observability depth with system performance
- **Data Sensitivity**: Properly sanitize sensitive data in logs and traces
- **Storage Costs**: Implement appropriate retention policies for logs and traces
- **Alert Fatigue**: Configure meaningful thresholds to avoid excessive alerting

## Related Examples

- [Basic Logging](../basic/example-1.md) - Foundation logging patterns
- [Structured Context](../basic/example-2.md) - Context enrichment
- [NestJS Advanced Integration](../frameworks/nestjs/advanced/example-1.md) - Framework integration