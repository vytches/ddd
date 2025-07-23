# NestJS Enterprise Monitoring

**Version**: 1.0.0
**Package**: @vytches-ddd/logging + NestJS
**Complexity**: intermediate
**Framework**: NestJS
**Integration**: Enterprise monitoring and observability patterns
**Dependencies**: @nestjs/common, @vytches-ddd/logging, monitoring integrations

## Description

Enterprise monitoring and observability solution with structured logging, metrics correlation, and comprehensive observability patterns. This example demonstrates production-grade monitoring integration for large-scale NestJS applications requiring advanced observability and operational intelligence.

## Business Context

Enterprise applications require comprehensive observability that goes beyond basic logging to include metrics correlation, distributed tracing, alerting, and operational intelligence. This integration provides complete visibility into application health, performance trends, business metrics, and system behavior for proactive operational management.

## Code Example

```typescript
// enterprise-monitoring.service.ts - Core monitoring service
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Logger } from '@vytches-ddd/logging';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface MetricDefinition {
  name: string;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  description: string;
  labels: string[];
  unit?: string;
}

export interface AlertRule {
  name: string;
  condition: string;
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  cooldown: number; // minutes
}

export interface MonitoringConfig {
  enableMetrics: boolean;
  enableTracing: boolean;
  enableAlerting: boolean;
  metricsInterval: number;
  retentionDays: number;
  exportTargets: string[];
}

@Injectable()
export class EnterpriseMonitoringService implements OnModuleInit, OnModuleDestroy {
  private logger: Logger;
  private metrics = new Map<string, any>();
  private alerts = new Map<string, AlertRule>();
  private metricDefinitions = new Map<string, MetricDefinition>();
  private timeSeriesData = new Map<string, Array<{ timestamp: Date; value: number }>>();
  private activeAlerts = new Map<string, Date>();
  private healthChecks = new Map<string, () => Promise<any>>();

  constructor(private eventEmitter: EventEmitter2) {
    this.logger = Logger.forContext('EnterpriseMonitoring');
    this.initializeStandardMetrics();
    this.initializeStandardAlerts();
  }

  async onModuleInit() {
    this.logger.info('Enterprise monitoring service initializing', {
      service: 'EnterpriseMonitoringService',
      features: ['metrics', 'alerting', 'health-checks', 'observability']
    });

    // Start monitoring loops
    this.startMetricsCollection();
    this.startHealthMonitoring();
    this.startAlertEvaluation();

    this.logger.info('Enterprise monitoring service initialized');
  }

  async onModuleDestroy() {
    this.logger.info('Enterprise monitoring service shutting down');
    await this.exportFinalMetrics();
  }

  // ⭐ FOCUS: Application Performance Monitoring (APM)
  recordBusinessMetric(
    metricName: string, 
    value: number, 
    labels: Record<string, string> = {},
    timestamp?: Date
  ): void {
    const metricLogger = this.logger.withContext({
      operation: 'recordBusinessMetric',
      metricName,
      metricValue: value
    });

    // Record metric value
    this.recordMetricValue(metricName, value, labels, timestamp);

    // Log business metric
    metricLogger.info('Business metric recorded', {
      metricName,
      value,
      labels,
      timestamp: timestamp || new Date(),
      metricType: 'business'
    });

    // Emit event for real-time processing
    this.eventEmitter.emit('metric.recorded', {
      metricName,
      value,
      labels,
      timestamp: timestamp || new Date()
    });

    // Check for alert conditions
    this.evaluateAlertConditions(metricName, value);
  }

  // ⭐ FOCUS: Request/Response Monitoring
  async trackRequestMetrics(
    endpoint: string,
    method: string,
    statusCode: number,
    duration: number,
    requestSize: number,
    responseSize: number,
    userId?: string
  ): Promise<void> {
    const requestLogger = this.logger.withContext({
      operation: 'trackRequestMetrics',
      endpoint,
      method,
      statusCode
    });

    // Record HTTP metrics
    this.recordMetricValue('http_requests_total', 1, {
      endpoint,
      method,
      status_code: statusCode.toString()
    });

    this.recordMetricValue('http_request_duration_ms', duration, {
      endpoint,
      method
    });

    this.recordMetricValue('http_request_size_bytes', requestSize, {
      endpoint,
      method
    });

    this.recordMetricValue('http_response_size_bytes', responseSize, {
      endpoint,
      method,
      status_code: statusCode.toString()
    });

    // ⭐ FOCUS: Business metrics correlation
    const isError = statusCode >= 400;
    const isSlowRequest = duration > 2000;
    
    if (isError) {
      this.recordMetricValue('http_errors_total', 1, {
        endpoint,
        method,
        status_code: statusCode.toString(),
        error_type: statusCode >= 500 ? 'server_error' : 'client_error'
      });
    }

    if (isSlowRequest) {
      this.recordMetricValue('http_slow_requests_total', 1, {
        endpoint,
        method,
        duration_category: this.categorizeDuration(duration)
      });
    }

    // Log request metrics
    requestLogger.info('Request metrics tracked', {
      endpoint,
      method,
      statusCode,
      duration,
      requestSize,
      responseSize,
      isError,
      isSlowRequest,
      performanceCategory: this.categorizeDuration(duration)
    });

    // User behavior tracking
    if (userId) {
      this.trackUserBehavior(userId, endpoint, method, statusCode, duration);
    }
  }

  // ⭐ FOCUS: System Health Monitoring
  async performSystemHealthCheck(): Promise<any> {
    const healthLogger = this.logger.withContext({
      operation: 'systemHealthCheck'
    });

    const healthResults: Record<string, any> = {};
    const startTime = Date.now();

    try {
      // System resource checks
      const systemHealth = await this.checkSystemResources();
      healthResults.system = systemHealth;

      // Database health checks
      const dbHealth = await this.checkDatabaseHealth();
      healthResults.database = dbHealth;

      // External services health
      const servicesHealth = await this.checkExternalServices();
      healthResults.external_services = servicesHealth;

      // Application-specific health checks
      const appHealth = await this.checkApplicationHealth();
      healthResults.application = appHealth;

      // Calculate overall health
      const overallHealth = this.calculateOverallHealth(healthResults);
      const duration = Date.now() - startTime;

      // ⭐ FOCUS: Health check logging
      healthLogger.info('System health check completed', {
        overallHealth: overallHealth.status,
        healthScore: overallHealth.score,
        duration,
        checks: {
          system: systemHealth.status,
          database: dbHealth.status,
          external_services: servicesHealth.status,
          application: appHealth.status
        },
        details: healthResults
      });

      // Record health metrics
      this.recordMetricValue('health_check_score', overallHealth.score, {
        check_type: 'overall'
      });

      this.recordMetricValue('health_check_duration_ms', duration, {
        check_type: 'comprehensive'
      });

      // Alert on health issues
      if (overallHealth.status !== 'healthy') {
        this.triggerHealthAlert(overallHealth, healthResults);
      }

      return {
        status: overallHealth.status,
        score: overallHealth.score,
        timestamp: new Date(),
        duration,
        checks: healthResults
      };

    } catch (error) {
      const duration = Date.now() - startTime;

      healthLogger.error('System health check failed', {
        error: error,
        duration,
        partialResults: healthResults
      });

      // Record failure metrics
      this.recordMetricValue('health_check_failures_total', 1, {
        error_type: 'health_check_system_failure'
      });

      throw error;
    }
  }

  // ⭐ FOCUS: Business Intelligence Metrics
  async generateBusinessIntelligence(): Promise<any> {
    const biLogger = this.logger.withContext({
      operation: 'generateBusinessIntelligence'
    });

    const intelligence = {
      timestamp: new Date(),
      performance: await this.analyzePerformanceTrends(),
      usage: await this.analyzeUsagePatterns(),
      errors: await this.analyzeErrorPatterns(),
      capacity: await this.analyzeCapacityTrends(),
      business: await this.analyzeBusinessMetrics(),
      predictions: await this.generatePredictiveInsights()
    };

    // ⭐ FOCUS: Business intelligence logging
    biLogger.info('Business intelligence generated', {
      performanceTrend: intelligence.performance.trend,
      usageGrowth: intelligence.usage.growthRate,
      errorRate: intelligence.errors.overallRate,
      capacityUtilization: intelligence.capacity.currentUtilization,
      keyBusinessMetrics: intelligence.business.keyMetrics,
      predictiveAlerts: intelligence.predictions.alerts.length
    });

    // Log specific insights
    if (intelligence.predictions.alerts.length > 0) {
      biLogger.warn('Predictive alerts generated', {
        alertCount: intelligence.predictions.alerts.length,
        alerts: intelligence.predictions.alerts.map(alert => ({
          type: alert.type,
          severity: alert.severity,
          prediction: alert.prediction
        }))
      });
    }

    return intelligence;
  }

  // ⭐ FOCUS: Real-time Alerting System
  private async evaluateAlertConditions(metricName: string, value: number): Promise<void> {
    const alertsForMetric = Array.from(this.alerts.values())
      .filter(alert => alert.condition.includes(metricName));

    for (const alert of alertsForMetric) {
      const shouldAlert = await this.evaluateAlertCondition(alert, metricName, value);
      
      if (shouldAlert && !this.isInCooldown(alert.name)) {
        await this.triggerAlert(alert, { metricName, value });
      }
    }
  }

  private async triggerAlert(alert: AlertRule, context: Record<string, any>): Promise<void> {
    const alertLogger = this.logger.withContext({
      operation: 'triggerAlert',
      alertName: alert.name,
      severity: alert.severity
    });

    // Record alert trigger
    this.activeAlerts.set(alert.name, new Date());
    
    // ⭐ FOCUS: Alert logging with comprehensive context
    alertLogger.error('Alert triggered', {
      alertName: alert.name,
      condition: alert.condition,
      severity: alert.severity,
      threshold: alert.threshold,
      actualValue: context.value,
      metricName: context.metricName,
      exceedsThresholdBy: context.value - alert.threshold,
      cooldownMinutes: alert.cooldown,
      alertId: this.generateAlertId(),
      requiresImmediateAction: alert.severity === 'critical'
    });

    // Record alert metrics
    this.recordMetricValue('alerts_triggered_total', 1, {
      alert_name: alert.name,
      severity: alert.severity,
      metric_name: context.metricName
    });

    // Emit alert event for external integrations
    this.eventEmitter.emit('alert.triggered', {
      alert,
      context,
      timestamp: new Date(),
      alertId: this.generateAlertId()
    });

    // For critical alerts, could integrate with external alerting systems
    if (alert.severity === 'critical') {
      await this.notifyOpsTeam(alert, context);
    }
  }

  // ⭐ FOCUS: Distributed Tracing Integration
  createTraceContext(operationName: string, correlationId?: string): any {
    const traceId = correlationId || this.generateTraceId();
    const spanId = this.generateSpanId();
    
    const traceContext = {
      traceId,
      spanId,
      operation: operationName,
      startTime: Date.now(),
      tags: new Map<string, any>(),
      logs: []
    };

    // Log trace start
    this.logger.debug('Distributed trace started', {
      traceId,
      spanId,
      operation: operationName,
      timestamp: new Date()
    });

    return traceContext;
  }

  finishTrace(traceContext: any, success: boolean, error?: Error): void {
    const duration = Date.now() - traceContext.startTime;
    
    // ⭐ FOCUS: Trace completion logging
    this.logger.info('Distributed trace completed', {
      traceId: traceContext.traceId,
      spanId: traceContext.spanId,
      operation: traceContext.operation,
      duration,
      success,
      error: error?.message,
      tags: Object.fromEntries(traceContext.tags),
      logCount: traceContext.logs.length
    });

    // Record trace metrics
    this.recordMetricValue('traces_completed_total', 1, {
      operation: traceContext.operation,
      success: success.toString()
    });

    this.recordMetricValue('trace_duration_ms', duration, {
      operation: traceContext.operation
    });
  }

  // ⭐ FOCUS: Automated metric collection
  @Cron(CronExpression.EVERY_MINUTE)
  async collectSystemMetrics(): Promise<void> {
    try {
      const systemMetrics = {
        timestamp: new Date(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        uptime: process.uptime(),
        activeHandles: (process as any)._getActiveHandles().length,
        eventLoopDelay: await this.measureEventLoopDelay()
      };

      // Record system metrics
      this.recordMetricValue('system_memory_heap_used_bytes', systemMetrics.memory.heapUsed);
      this.recordMetricValue('system_memory_heap_total_bytes', systemMetrics.memory.heapTotal);
      this.recordMetricValue('system_cpu_user_microseconds', systemMetrics.cpu.user);
      this.recordMetricValue('system_cpu_system_microseconds', systemMetrics.cpu.system);
      this.recordMetricValue('system_uptime_seconds', systemMetrics.uptime);
      this.recordMetricValue('system_active_handles_total', systemMetrics.activeHandles);
      this.recordMetricValue('system_event_loop_delay_ms', systemMetrics.eventLoopDelay);

      // Log system health
      this.logger.debug('System metrics collected', {
        memoryUsageMB: Math.round(systemMetrics.memory.heapUsed / 1024 / 1024),
        memoryUtilization: Math.round((systemMetrics.memory.heapUsed / systemMetrics.memory.heapTotal) * 100),
        uptimeHours: Math.round(systemMetrics.uptime / 3600),
        activeHandles: systemMetrics.activeHandles,
        eventLoopDelayMs: systemMetrics.eventLoopDelay
      });

    } catch (error) {
      this.logger.error('Failed to collect system metrics', {
        error: error
      });
    }
  }

  // Private implementation methods
  private initializeStandardMetrics(): void {
    const standardMetrics: MetricDefinition[] = [
      {
        name: 'http_requests_total',
        type: 'counter',
        description: 'Total HTTP requests',
        labels: ['endpoint', 'method', 'status_code']
      },
      {
        name: 'http_request_duration_ms',
        type: 'histogram',
        description: 'HTTP request duration in milliseconds',
        labels: ['endpoint', 'method'],
        unit: 'ms'
      },
      {
        name: 'business_transactions_total',
        type: 'counter',
        description: 'Total business transactions',
        labels: ['transaction_type', 'status']
      },
      {
        name: 'system_memory_heap_used_bytes',
        type: 'gauge',
        description: 'System memory heap used',
        labels: [],
        unit: 'bytes'
      },
      {
        name: 'alerts_triggered_total',
        type: 'counter',
        description: 'Total alerts triggered',
        labels: ['alert_name', 'severity']
      }
    ];

    standardMetrics.forEach(metric => {
      this.metricDefinitions.set(metric.name, metric);
    });

    this.logger.info('Standard metrics initialized', {
      metricCount: standardMetrics.length,
      metricTypes: Array.from(new Set(standardMetrics.map(m => m.type)))
    });
  }

  private initializeStandardAlerts(): void {
    const standardAlerts: AlertRule[] = [
      {
        name: 'high_memory_usage',
        condition: 'system_memory_heap_used_bytes > threshold',
        threshold: 500 * 1024 * 1024, // 500MB
        severity: 'medium',
        cooldown: 10
      },
      {
        name: 'high_error_rate',
        condition: 'http_errors_rate > threshold',
        threshold: 5, // 5%
        severity: 'high',
        cooldown: 5
      },
      {
        name: 'slow_response_time',
        condition: 'avg_http_request_duration_ms > threshold',
        threshold: 5000, // 5 seconds
        severity: 'medium',
        cooldown: 15
      }
    ];

    standardAlerts.forEach(alert => {
      this.alerts.set(alert.name, alert);
    });

    this.logger.info('Standard alerts initialized', {
      alertCount: standardAlerts.length,
      severityLevels: Array.from(new Set(standardAlerts.map(a => a.severity)))
    });
  }

  private recordMetricValue(
    metricName: string, 
    value: number, 
    labels: Record<string, string> = {},
    timestamp?: Date
  ): void {
    const key = `${metricName}:${JSON.stringify(labels)}`;
    const dataPoint = {
      timestamp: timestamp || new Date(),
      value
    };

    if (!this.timeSeriesData.has(key)) {
      this.timeSeriesData.set(key, []);
    }

    const series = this.timeSeriesData.get(key)!;
    series.push(dataPoint);

    // Keep only last 1000 data points per series
    if (series.length > 1000) {
      series.shift();
    }

    // Update current metric value
    this.metrics.set(key, { value, labels, timestamp: dataPoint.timestamp });
  }

  // Additional helper methods...
  private async measureEventLoopDelay(): Promise<number> {
    return new Promise((resolve) => {
      const start = process.hrtime.bigint();
      setImmediate(() => {
        const delta = process.hrtime.bigint() - start;
        resolve(Number(delta) / 1000000); // Convert to milliseconds
      });
    });
  }

  private categorizeDuration(duration: number): string {
    if (duration < 100) return 'fast';
    if (duration < 500) return 'normal';
    if (duration < 2000) return 'slow';
    if (duration < 5000) return 'very_slow';
    return 'critical';
  }

  private generateTraceId(): string {
    return `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSpanId(): string {
    return `span-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateAlertId(): string {
    return `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Placeholder implementations for complex analysis methods
  private async analyzePerformanceTrends(): Promise<any> {
    return { trend: 'stable', averageResponseTime: 150 };
  }

  private async analyzeUsagePatterns(): Promise<any> {
    return { growthRate: 15, peakHours: ['09:00', '14:00', '20:00'] };
  }

  private async analyzeErrorPatterns(): Promise<any> {
    return { overallRate: 2.5, topErrors: ['ValidationError', 'TimeoutError'] };
  }

  private async analyzeCapacityTrends(): Promise<any> {
    return { currentUtilization: 65, projectedCapacity: 80 };
  }

  private async analyzeBusinessMetrics(): Promise<any> {
    return { 
      keyMetrics: { 
        activeUsers: 1250, 
        transactionsPerHour: 450, 
        revenueGrowth: 8.5 
      } 
    };
  }

  private async generatePredictiveInsights(): Promise<any> {
    return { 
      alerts: [
        { type: 'capacity', severity: 'medium', prediction: 'Capacity will reach 90% in 7 days' }
      ] 
    };
  }

  private async checkSystemResources(): Promise<any> {
    const memory = process.memoryUsage();
    const memoryUsage = (memory.heapUsed / memory.heapTotal) * 100;
    
    return {
      status: memoryUsage > 90 ? 'critical' : memoryUsage > 70 ? 'warning' : 'healthy',
      memoryUsage,
      uptime: process.uptime()
    };
  }

  private async checkDatabaseHealth(): Promise<any> {
    return { status: 'healthy', connectionPool: 'available', queryTime: 25 };
  }

  private async checkExternalServices(): Promise<any> {
    return { status: 'healthy', services: ['payment-api', 'notification-service'] };
  }

  private async checkApplicationHealth(): Promise<any> {
    return { status: 'healthy', version: '2.1.0', features: 'operational' };
  }

  private calculateOverallHealth(healthResults: Record<string, any>): any {
    const scores = Object.values(healthResults).map((health: any) => {
      switch (health.status) {
        case 'healthy': return 100;
        case 'warning': return 70;
        case 'critical': return 30;
        default: return 0;
      }
    });

    const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const status = averageScore >= 80 ? 'healthy' : averageScore >= 50 ? 'warning' : 'critical';

    return { status, score: Math.round(averageScore) };
  }

  private async evaluateAlertCondition(alert: AlertRule, metricName: string, value: number): Promise<boolean> {
    // Simplified alert evaluation
    return value > alert.threshold;
  }

  private isInCooldown(alertName: string): boolean {
    const lastTriggered = this.activeAlerts.get(alertName);
    if (!lastTriggered) return false;

    const alert = this.alerts.get(alertName);
    if (!alert) return false;

    const cooldownMs = alert.cooldown * 60 * 1000;
    return Date.now() - lastTriggered.getTime() < cooldownMs;
  }

  private async triggerHealthAlert(overallHealth: any, healthResults: any): Promise<void> {
    this.logger.warn('System health alert', {
      overallStatus: overallHealth.status,
      healthScore: overallHealth.score,
      unhealthyComponents: Object.entries(healthResults)
        .filter(([_, health]: [string, any]) => health.status !== 'healthy')
        .map(([component, health]) => ({ component, status: health.status }))
    });
  }

  private async notifyOpsTeam(alert: AlertRule, context: Record<string, any>): Promise<void> {
    this.logger.error('Critical alert - ops team notified', {
      alertName: alert.name,
      context,
      notificationSent: true
    });
  }

  private trackUserBehavior(
    userId: string, 
    endpoint: string, 
    method: string, 
    statusCode: number, 
    duration: number
  ): void {
    this.recordMetricValue('user_requests_total', 1, {
      user_id: userId,
      endpoint_category: this.categorizeEndpoint(endpoint)
    });

    if (statusCode >= 400) {
      this.recordMetricValue('user_errors_total', 1, {
        user_id: userId,
        error_type: statusCode >= 500 ? 'server_error' : 'client_error'
      });
    }
  }

  private categorizeEndpoint(endpoint: string): string {
    if (endpoint.includes('/auth/')) return 'authentication';
    if (endpoint.includes('/api/users')) return 'user_management';
    if (endpoint.includes('/api/orders')) return 'order_management';
    return 'other';
  }

  private startMetricsCollection(): void {
    // Metrics collection already handled by @Cron decorator
    this.logger.info('Metrics collection started');
  }

  private startHealthMonitoring(): void {
    // Could set up additional health monitoring loops
    this.logger.info('Health monitoring started');
  }

  private startAlertEvaluation(): void {
    // Alert evaluation happens on metric recording
    this.logger.info('Alert evaluation started');
  }

  private async exportFinalMetrics(): Promise<void> {
    this.logger.info('Exporting final metrics', {
      totalMetrics: this.metrics.size,
      timeSeriesDataPoints: Array.from(this.timeSeriesData.values())
        .reduce((sum, series) => sum + series.length, 0)
    });
  }
}
```

## Usage Examples

```typescript
// Integration with existing services
@Injectable()
export class MonitoredUserService {
  private logger: Logger;

  constructor(
    private readonly monitoring: EnterpriseMonitoringService
  ) {
    this.logger = Logger.forContext('MonitoredUserService');
  }

  async createUser(userData: any): Promise<any> {
    // Create trace context
    const trace = this.monitoring.createTraceContext('createUser', 'user-creation-flow');
    
    try {
      const startTime = Date.now();
      
      // Business logic
      const user = await this.performUserCreation(userData);
      const duration = Date.now() - startTime;

      // Record business metrics
      this.monitoring.recordBusinessMetric('users_created_total', 1, {
        user_type: userData.role,
        registration_source: userData.source || 'direct'
      });

      this.monitoring.recordBusinessMetric('user_creation_duration_ms', duration, {
        complexity: userData.preferences ? 'complex' : 'simple'
      });

      // Complete trace
      this.monitoring.finishTrace(trace, true);

      return user;

    } catch (error) {
      // Record error metrics
      this.monitoring.recordBusinessMetric('user_creation_errors_total', 1, {
        error_type: error.constructor.name,
        user_type: userData.role
      });

      // Complete trace with error
      this.monitoring.finishTrace(trace, false, error);
      
      throw error;
    }
  }
}

// HTTP interceptor for automatic request monitoring
@Injectable()
export class MonitoringInterceptor implements NestInterceptor {
  constructor(private monitoring: EnterpriseMonitoringService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const startTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        const requestSize = parseInt(request.get('content-length') || '0');
        const responseSize = JSON.stringify(response.locals?.data || {}).length;

        this.monitoring.trackRequestMetrics(
          request.route?.path || request.url,
          request.method,
          response.statusCode,
          duration,
          requestSize,
          responseSize,
          request.user?.id
        );
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        
        this.monitoring.trackRequestMetrics(
          request.route?.path || request.url,
          request.method,
          error.status || 500,
          duration,
          parseInt(request.get('content-length') || '0'),
          0,
          request.user?.id
        );

        throw error;
      })
    );
  }
}
```

## Key Features

- **Comprehensive APM**: Application Performance Monitoring with business metrics correlation
- **Real-time Alerting**: Configurable alert rules with severity levels and cooldown periods
- **System Health Monitoring**: Automated health checks for system resources, database, and external services
- **Distributed Tracing**: Trace context propagation for complex operation tracking
- **Business Intelligence**: Performance trends, usage patterns, and predictive insights
- **Automated Metrics Collection**: System metrics, application metrics, and business KPIs
- **Observability Integration**: Ready for integration with monitoring systems like Prometheus, Grafana
- **User Behavior Tracking**: User-specific metrics and behavior analysis

## Configuration

```typescript
// monitoring.config.ts
export const monitoringConfig: MonitoringConfig = {
  enableMetrics: true,
  enableTracing: process.env.ENABLE_TRACING === 'true',
  enableAlerting: process.env.ENABLE_ALERTING === 'true',
  metricsInterval: 60000, // 1 minute
  retentionDays: 30,
  exportTargets: ['prometheus', 'grafana', 'datadog'].filter(target => 
    process.env[`ENABLE_${target.toUpperCase()}`] === 'true'
  )
};
```

## Best Practices

- **Monitor Business Metrics**: Track KPIs that matter to business operations
- **Set Appropriate Alert Thresholds**: Avoid alert fatigue with well-tuned thresholds
- **Use Distributed Tracing**: Track complex operations across service boundaries
- **Correlate Logs and Metrics**: Use correlation IDs to connect logs with metrics
- **Monitor User Experience**: Track user-centric metrics and behavior patterns
- **Regular Health Checks**: Implement comprehensive health checks for all system components
- **Predictive Analytics**: Use trends to predict and prevent issues before they occur

## Common Pitfalls

- **Metric Explosion**: Avoid creating too many high-cardinality metrics
- **Alert Fatigue**: Set appropriate cooldown periods and thresholds
- **Performance Impact**: Monitor the performance impact of monitoring itself
- **Storage Growth**: Implement appropriate retention policies for time-series data
- **Context Loss**: Ensure proper context propagation in distributed systems

## Related Examples

- [NestJS Advanced DI Integration](./example-1.md)
- [NestJS Service Integration](../basic/example-2.md)
- [Basic Implementation Guide](../../basic/implementation.md)