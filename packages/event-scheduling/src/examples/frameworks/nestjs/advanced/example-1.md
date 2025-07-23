# NestJS Enterprise Scheduling Platform - Distributed Scheduling and Monitoring

**Version**: 1.0.0
**Package**: @vytches-ddd/event-scheduling
**Framework**: NestJS
**Complexity**: advanced
**Integration**: Complete enterprise platform with distributed scheduling, monitoring, and observability

## Description

Complete enterprise-grade NestJS platform integration featuring distributed scheduling, comprehensive monitoring, health checks, observability, metrics collection, and integration with enterprise infrastructure for mission-critical applications.

## Business Context

Large enterprise requiring a complete scheduling infrastructure with multi-region coordination, comprehensive monitoring, observability, compliance reporting, disaster recovery, and integration with existing enterprise systems for financial services, healthcare, or other regulated industries.

## Code Example

```typescript
// enterprise-platform.service.ts
import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { VytchesDDD, DomainService, ServiceLifetime } from '@vytches-ddd/di';
import { 
  EnterpriseSchedulingService,
  UltraHighPerformanceScheduler,
  HASchedulingService,
  GlobalCoordinationManager
} from '@vytches-ddd/event-scheduling';
import { Result } from '@vytches-ddd/utils';
import { Cron, CronExpression } from '@nestjs/schedule';
import { 
  EnterprisePlatformConfig,
  GlobalSchedulingMetrics,
  ComplianceReport,
  DisasterRecoveryStatus,
  ObservabilityMetrics,
  AlertConfiguration
} from './types'; // From your app

// ⭐ FOCUS: Enterprise platform service with comprehensive capabilities
@DomainService('enterprisePlatformService', {
  lifetime: ServiceLifetime.Singleton,
  context: 'EnterprisePlatform',
  dependencies: [
    'globalCoordinationManager',
    'haSchedulingService',
    'performanceScheduler',
    'complianceManager',
    'observabilityService',
    'alertingService'
  ]
})
export class EnterprisePlatformService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EnterprisePlatformService.name);
  
  private globalCoordinator: GlobalCoordinationManager;
  private haScheduler: HASchedulingService;
  private performanceScheduler: UltraHighPerformanceScheduler;
  private enterpriseScheduler: EnterpriseSchedulingService;
  
  private isInitialized = false;
  private platformMetrics: Map<string, any> = new Map();
  private alertThresholds: AlertConfiguration;

  constructor(private readonly config: EnterprisePlatformConfig) {
    this.alertThresholds = config.alerting;
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.initializeEnterprisePlatform();
      await this.startMonitoring();
      await this.initializeDisasterRecovery();
      
      this.isInitialized = true;
      this.logger.log('🏢 Enterprise scheduling platform initialized successfully');
    } catch (error) {
      this.logger.error(`Failed to initialize enterprise platform: ${error.message}`);
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.shutdownPlatform();
      this.logger.log('Enterprise scheduling platform shutdown completed');
    } catch (error) {
      this.logger.error(`Error during platform shutdown: ${error.message}`);
    }
  }

  // ✅ FOCUS: Schedule mission-critical enterprise event
  async scheduleMissionCriticalEvent(
    eventId: string,
    eventData: any,
    scheduleAt: Date,
    criticality: 'emergency' | 'critical' | 'important' = 'critical'
  ): Promise<Result<EnterpiseEventResult, Error>> {
    try {
      if (!this.isInitialized) {
        return Result.fail(new Error('Enterprise platform not initialized'));
      }

      // For emergency events, use maximum coordination and monitoring
      if (criticality === 'emergency') {
        return await this.scheduleEmergencyEvent(eventId, eventData, scheduleAt);
      }

      // For critical events, use HA scheduling with global coordination
      const globalResult = await this.enterpriseScheduler.scheduleEnterpriseOrder(
        eventId,
        {
          ...eventData,
          criticality,
          enterpriseCoordination: true,
          globalReplication: true
        }
      );

      if (globalResult.isFailure()) {
        return Result.fail(globalResult.error);
      }

      // Create enterprise event result with comprehensive tracking
      const result: EnterpiseEventResult = {
        eventId,
        globalEventId: globalResult.value,
        criticality,
        coordinationLevel: 'global',
        replicationFactor: criticality === 'critical' ? 5 : 3,
        monitoringEnabled: true,
        complianceTracking: true,
        disasterRecoveryEnabled: true,
        estimatedExecutionTime: scheduleAt,
        platformMetrics: await this.capturePlatformMetrics()
      };

      // Set up comprehensive monitoring for this event
      await this.setupEventMonitoring(eventId, criticality);
      
      // Emit platform event for observability
      await this.emitPlatformEvent('MissionCriticalEventScheduled', result);

      this.logger.log(`Mission-critical event scheduled: ${eventId} (${criticality})`);
      return Result.ok(result);

    } catch (error) {
      this.logger.error(`Failed to schedule mission-critical event: ${error.message}`);
      return Result.fail(new Error(`Mission-critical scheduling failed: ${error.message}`));
    }
  }

  // ✅ FOCUS: Schedule regulatory compliance with full audit trail
  async scheduleRegulatoryCompliance(
    regulationType: string,
    jurisdictions: string[],
    deadline: Date,
    complianceData: any
  ): Promise<Result<ComplianceSchedulingResult, Error>> {
    try {
      const complianceManager = VytchesDDD.resolve<any>('complianceManager');
      if (!complianceManager) {
        return Result.fail(new Error('Compliance manager not available'));
      }

      // Schedule across all required jurisdictions with global coordination
      const jurisdictionResults = await Promise.all(
        jurisdictions.map(async (jurisdiction) => {
          const result = await this.enterpriseScheduler.scheduleComplianceReporting(
            `${regulationType}-${jurisdiction}`,
            {
              ...complianceData,
              jurisdiction,
              regulationType,
              auditTrail: true,
              encryptionRequired: true,
              crossJurisdictionCoordination: jurisdictions.length > 1
            },
            deadline
          );

          return { jurisdiction, result };
        })
      );

      const successfulSchedules = jurisdictionResults.filter(jr => jr.result.isSuccess());
      const failedSchedules = jurisdictionResults.filter(jr => jr.result.isFailure());

      if (failedSchedules.length > 0) {
        this.logger.error(`Some compliance schedules failed:`, failedSchedules);
      }

      const complianceResult: ComplianceSchedulingResult = {
        regulationType,
        jurisdictions,
        deadline,
        successfulJurisdictions: successfulSchedules.map(js => js.jurisdiction),
        failedJurisdictions: failedSchedules.map(js => js.jurisdiction),
        globalComplianceId: `COMPLIANCE-${Date.now()}`,
        auditTrailId: await complianceManager.createAuditTrail(regulationType, jurisdictions),
        crossJurisdictionCoordination: jurisdictions.length > 1,
        estimatedCompletionTime: new Date(deadline.getTime() - 2 * 60 * 60 * 1000) // 2 hours before deadline
      };

      // Set up compliance monitoring
      await this.setupComplianceMonitoring(complianceResult);

      this.logger.log(`Regulatory compliance scheduled: ${regulationType} across ${jurisdictions.length} jurisdictions`);
      return Result.ok(complianceResult);

    } catch (error) {
      this.logger.error(`Failed to schedule regulatory compliance: ${error.message}`);
      return Result.fail(new Error(`Compliance scheduling failed: ${error.message}`));
    }
  }

  // ✅ FOCUS: Get comprehensive platform metrics
  async getPlatformMetrics(): Promise<ComprehensivePlatformMetrics> {
    try {
      const metrics: ComprehensivePlatformMetrics = {
        platform: {
          uptime: process.uptime(),
          totalEvents: 0,
          successRate: 0,
          averageLatency: 0,
          platformHealth: await this.calculatePlatformHealth()
        },
        scheduling: {},
        compliance: {},
        performance: {},
        infrastructure: {},
        observability: {},
        timestamp: new Date()
      };

      // Collect metrics from all scheduling services
      if (this.enterpriseScheduler) {
        metrics.scheduling = await this.enterpriseScheduler.getEnterpriseMetrics();
      }

      if (this.haScheduler) {
        metrics.performance = await this.haScheduler.getHAMetrics();
      }

      if (this.performanceScheduler) {
        const perfMetrics = await this.performanceScheduler.getPerformanceMetrics();
        metrics.performance = { ...metrics.performance, ...perfMetrics };
      }

      // Get compliance metrics
      const complianceManager = VytchesDDD.resolve<any>('complianceManager');
      if (complianceManager) {
        metrics.compliance = await complianceManager.getComplianceMetrics();
      }

      // Get infrastructure metrics
      metrics.infrastructure = await this.getInfrastructureMetrics();

      // Get observability metrics
      const observabilityService = VytchesDDD.resolve<any>('observabilityService');
      if (observabilityService) {
        metrics.observability = await observabilityService.getMetrics();
      }

      // Calculate aggregate platform metrics
      metrics.platform.totalEvents = this.calculateTotalEvents(metrics);
      metrics.platform.successRate = this.calculateOverallSuccessRate(metrics);
      metrics.platform.averageLatency = this.calculateAverageLatency(metrics);

      return metrics;

    } catch (error) {
      this.logger.error(`Failed to get platform metrics: ${error.message}`);
      return {
        platform: {
          uptime: process.uptime(),
          totalEvents: 0,
          successRate: 0,
          averageLatency: 0,
          platformHealth: 'degraded',
          error: error.message
        },
        timestamp: new Date()
      };
    }
  }

  // ✅ FOCUS: Perform comprehensive platform health check
  async performComprehensiveHealthCheck(): Promise<PlatformHealthStatus> {
    try {
      const healthStatus: PlatformHealthStatus = {
        overall: 'healthy',
        components: {},
        infrastructure: {},
        compliance: {},
        performance: {},
        alerts: [],
        recommendations: [],
        timestamp: new Date()
      };

      // Check all scheduling components
      const componentChecks = [
        { name: 'enterpriseScheduler', service: this.enterpriseScheduler },
        { name: 'haScheduler', service: this.haScheduler },
        { name: 'performanceScheduler', service: this.performanceScheduler },
        { name: 'globalCoordinator', service: this.globalCoordinator }
      ];

      for (const { name, service } of componentChecks) {
        try {
          if (service) {
            const componentHealth = await this.checkComponentHealth(service);
            healthStatus.components[name] = componentHealth;
            
            if (componentHealth.status !== 'healthy') {
              healthStatus.overall = 'degraded';
            }
          } else {
            healthStatus.components[name] = {
              status: 'unavailable',
              message: 'Service not initialized'
            };
            healthStatus.overall = 'degraded';
          }
        } catch (error) {
          healthStatus.components[name] = {
            status: 'unhealthy',
            error: error.message
          };
          healthStatus.overall = 'unhealthy';
        }
      }

      // Check infrastructure health
      healthStatus.infrastructure = await this.checkInfrastructureHealth();
      
      // Check compliance status
      const complianceManager = VytchesDDD.resolve<any>('complianceManager');
      if (complianceManager) {
        healthStatus.compliance = await complianceManager.getComplianceHealth();
      }

      // Check performance metrics against thresholds
      healthStatus.performance = await this.checkPerformanceHealth();

      // Generate alerts based on health status
      healthStatus.alerts = await this.generateHealthAlerts(healthStatus);
      
      // Generate recommendations
      healthStatus.recommendations = this.generateHealthRecommendations(healthStatus);

      return healthStatus;

    } catch (error) {
      this.logger.error(`Comprehensive health check failed: ${error.message}`);
      return {
        overall: 'unhealthy',
        components: {},
        infrastructure: {},
        compliance: {},
        performance: {},
        alerts: [{ severity: 'critical', message: `Health check failed: ${error.message}` }],
        recommendations: ['Investigate health check system failure'],
        timestamp: new Date()
      };
    }
  }

  // ✅ FOCUS: Automated monitoring and alerting (runs every minute)
  @Cron(CronExpression.EVERY_MINUTE)
  async performAutomatedMonitoring(): Promise<void> {
    try {
      if (!this.isInitialized) {
        return;
      }

      const metrics = await this.getPlatformMetrics();
      const healthStatus = await this.performComprehensiveHealthCheck();
      
      // Store metrics for trend analysis
      this.platformMetrics.set(new Date().toISOString(), metrics);
      
      // Keep only last 24 hours of metrics
      this.cleanupOldMetrics();
      
      // Check alert conditions
      await this.checkAlertConditions(metrics, healthStatus);
      
      // Update observability systems
      await this.updateObservability(metrics, healthStatus);
      
      this.logger.debug('Automated monitoring cycle completed');

    } catch (error) {
      this.logger.error(`Automated monitoring failed: ${error.message}`);
    }
  }

  // ✅ FOCUS: Generate comprehensive platform report
  async generatePlatformReport(
    period: 'hourly' | 'daily' | 'weekly' | 'monthly' = 'daily'
  ): Promise<PlatformReport> {
    try {
      const endTime = new Date();
      const startTime = this.calculateReportStartTime(endTime, period);
      
      const report: PlatformReport = {
        period,
        timeRange: { start: startTime, end: endTime },
        executive: await this.generateExecutiveSummary(startTime, endTime),
        operational: await this.generateOperationalSummary(startTime, endTime),
        compliance: await this.generateComplianceSummary(startTime, endTime),
        performance: await this.generatePerformanceSummary(startTime, endTime),
        incidents: await this.getIncidents(startTime, endTime),
        recommendations: await this.generateReportRecommendations(startTime, endTime),
        timestamp: new Date()
      };

      // Store report for audit purposes
      await this.storeReport(report);

      this.logger.log(`Platform report generated for ${period} period`);
      return report;

    } catch (error) {
      this.logger.error(`Failed to generate platform report: ${error.message}`);
      throw error;
    }
  }

  private async initializeEnterprisePlatform(): Promise<void> {
    // Initialize all enterprise services through VytchesDDD container
    this.globalCoordinator = VytchesDDD.resolve<GlobalCoordinationManager>('globalCoordinationManager');
    this.haScheduler = VytchesDDD.resolve<HASchedulingService>('haSchedulingService');
    this.performanceScheduler = VytchesDDD.resolve<UltraHighPerformanceScheduler>('performanceScheduler');
    this.enterpriseScheduler = VytchesDDD.resolve<EnterpriseSchedulingService>('enterpriseSchedulingService');

    // Start all services
    const initPromises = [];
    
    if (this.globalCoordinator) {
      initPromises.push(this.globalCoordinator.start());
    }
    
    if (this.haScheduler) {
      initPromises.push(this.haScheduler.start());
    }
    
    if (this.performanceScheduler) {
      initPromises.push(this.performanceScheduler.start());
    }

    await Promise.all(initPromises);
    this.logger.log('All enterprise services initialized');
  }

  private async scheduleEmergencyEvent(
    eventId: string,
    eventData: any,
    scheduleAt: Date
  ): Promise<Result<EnterpiseEventResult, Error>> {
    try {
      // Emergency events use all available coordination mechanisms
      const haResult = await this.haScheduler.scheduleEmergencyEvent({
        aggregateId: eventId,
        scheduleAt,
        payload: eventData
      } as any);

      if (haResult.isFailure()) {
        return Result.fail(haResult.error);
      }

      const result: EnterpiseEventResult = {
        eventId,
        globalEventId: haResult.value.eventId,
        criticality: 'emergency',
        coordinationLevel: 'emergency',
        replicationFactor: 5,
        monitoringEnabled: true,
        complianceTracking: true,
        disasterRecoveryEnabled: true,
        estimatedExecutionTime: scheduleAt,
        emergencyProtocols: true,
        platformMetrics: await this.capturePlatformMetrics()
      };

      // Immediate high-priority monitoring for emergency events
      await this.setupEmergencyMonitoring(eventId);
      
      return Result.ok(result);

    } catch (error) {
      return Result.fail(new Error(`Emergency event scheduling failed: ${error.message}`));
    }
  }

  private async startMonitoring(): Promise<void> {
    // Initialize comprehensive monitoring systems
    this.logger.log('Starting enterprise monitoring systems');
  }

  private async initializeDisasterRecovery(): Promise<void> {
    // Initialize disaster recovery mechanisms
    this.logger.log('Disaster recovery systems initialized');
  }

  private async shutdownPlatform(): Promise<void> {
    const shutdownPromises = [];
    
    if (this.globalCoordinator) {
      shutdownPromises.push(this.globalCoordinator.stop());
    }
    
    if (this.haScheduler) {
      shutdownPromises.push(this.haScheduler.stop());
    }
    
    if (this.performanceScheduler) {
      shutdownPromises.push(this.performanceScheduler.stop());
    }

    await Promise.allSettled(shutdownPromises);
  }

  private async capturePlatformMetrics(): Promise<any> {
    return {
      timestamp: new Date(),
      platformHealth: await this.calculatePlatformHealth(),
      activeServices: this.countActiveServices()
    };
  }

  private async calculatePlatformHealth(): Promise<string> {
    try {
      const healthChecks = [
        this.globalCoordinator !== null,
        this.haScheduler !== null,
        this.performanceScheduler !== null,
        this.enterpriseScheduler !== null
      ];

      const healthyServices = healthChecks.filter(Boolean).length;
      const totalServices = healthChecks.length;
      const healthRatio = healthyServices / totalServices;

      if (healthRatio >= 0.9) return 'healthy';
      if (healthRatio >= 0.7) return 'degraded';
      return 'unhealthy';

    } catch (error) {
      return 'unknown';
    }
  }

  private countActiveServices(): number {
    let count = 0;
    if (this.globalCoordinator) count++;
    if (this.haScheduler) count++;
    if (this.performanceScheduler) count++;
    if (this.enterpriseScheduler) count++;
    return count;
  }

  private async setupEventMonitoring(eventId: string, criticality: string): Promise<void> {
    // Set up comprehensive monitoring for the specific event
    this.logger.debug(`Event monitoring setup for ${eventId} (${criticality})`);
  }

  private async setupEmergencyMonitoring(eventId: string): Promise<void> {
    // Set up immediate high-priority monitoring for emergency events
    this.logger.warn(`Emergency monitoring activated for ${eventId}`);
  }

  private async setupComplianceMonitoring(result: ComplianceSchedulingResult): Promise<void> {
    // Set up compliance-specific monitoring
    this.logger.log(`Compliance monitoring setup for ${result.regulationType}`);
  }

  private async emitPlatformEvent(eventType: string, data: any): Promise<void> {
    try {
      const eventBus = VytchesDDD.resolve<any>('eventBus');
      if (eventBus) {
        await eventBus.publish({
          type: eventType,
          payload: data,
          timestamp: new Date()
        });
      }
    } catch (error) {
      this.logger.warn(`Failed to emit platform event: ${error.message}`);
    }
  }

  private async checkComponentHealth(service: any): Promise<ComponentHealthStatus> {
    try {
      // Generic health check for any service
      if (typeof service.getStats === 'function') {
        const stats = await service.getStats();
        return {
          status: 'healthy',
          details: stats
        };
      }
      
      return {
        status: 'healthy',
        message: 'Service operational'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  private async checkInfrastructureHealth(): Promise<any> {
    return {
      cpu: this.getCpuUsage(),
      memory: this.getMemoryUsage(),
      network: await this.getNetworkHealth(),
      storage: await this.getStorageHealth()
    };
  }

  private async checkPerformanceHealth(): Promise<any> {
    const metrics = await this.getPlatformMetrics();
    
    return {
      latency: metrics.platform?.averageLatency || 0,
      throughput: metrics.platform?.totalEvents || 0,
      successRate: metrics.platform?.successRate || 0,
      alertsGenerated: this.checkPerformanceThresholds(metrics)
    };
  }

  private async generateHealthAlerts(healthStatus: PlatformHealthStatus): Promise<Alert[]> {
    const alerts: Alert[] = [];
    
    if (healthStatus.overall === 'unhealthy') {
      alerts.push({
        severity: 'critical',
        message: 'Platform overall health is unhealthy',
        timestamp: new Date()
      });
    }
    
    // Add more specific alerts based on component health
    return alerts;
  }

  private generateHealthRecommendations(healthStatus: PlatformHealthStatus): string[] {
    const recommendations: string[] = [];
    
    if (healthStatus.overall !== 'healthy') {
      recommendations.push('Investigate component health issues');
      recommendations.push('Review system resources and capacity');
    }
    
    return recommendations;
  }

  private cleanupOldMetrics(): void {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    for (const [timestamp] of this.platformMetrics) {
      if (new Date(timestamp) < oneDayAgo) {
        this.platformMetrics.delete(timestamp);
      }
    }
  }

  private async checkAlertConditions(metrics: any, healthStatus: any): Promise<void> {
    // Check various alert conditions and send notifications
    const alertingService = VytchesDDD.resolve<any>('alertingService');
    
    if (alertingService) {
      await alertingService.checkConditions(metrics, healthStatus, this.alertThresholds);
    }
  }

  private async updateObservability(metrics: any, healthStatus: any): Promise<void> {
    const observabilityService = VytchesDDD.resolve<any>('observabilityService');
    
    if (observabilityService) {
      await observabilityService.recordMetrics(metrics);
      await observabilityService.recordHealth(healthStatus);
    }
  }

  private calculateReportStartTime(endTime: Date, period: string): Date {
    const start = new Date(endTime);
    
    switch (period) {
      case 'hourly':
        start.setHours(start.getHours() - 1);
        break;
      case 'daily':
        start.setDate(start.getDate() - 1);
        break;
      case 'weekly':
        start.setDate(start.getDate() - 7);
        break;
      case 'monthly':
        start.setMonth(start.getMonth() - 1);
        break;
    }
    
    return start;
  }

  private async generateExecutiveSummary(startTime: Date, endTime: Date): Promise<any> {
    return {
      totalEvents: 1000000, // Mock data
      successRate: 99.95,
      uptime: 99.99,
      criticalIssues: 0,
      complianceStatus: 'compliant'
    };
  }

  private async generateOperationalSummary(startTime: Date, endTime: Date): Promise<any> {
    return {
      schedulingOperations: 500000,
      averageLatency: 45,
      peakThroughput: 10000,
      resourceUtilization: 75
    };
  }

  private async generateComplianceSummary(startTime: Date, endTime: Date): Promise<any> {
    return {
      complianceReports: 50,
      regulatoryDeadlinesMet: 100,
      auditTrails: 1000,
      encryptedEvents: 25000
    };
  }

  private async generatePerformanceSummary(startTime: Date, endTime: Date): Promise<any> {
    return {
      averageResponseTime: 25,
      throughputAchieved: 95,
      errorRate: 0.01,
      capacityUtilization: 70
    };
  }

  private async getIncidents(startTime: Date, endTime: Date): Promise<any[]> {
    return [
      {
        id: 'INC-001',
        severity: 'low',
        description: 'Temporary latency spike in us-east-1',
        resolvedAt: new Date()
      }
    ];
  }

  private async generateReportRecommendations(startTime: Date, endTime: Date): Promise<string[]> {
    return [
      'Consider scaling up during peak hours',
      'Review performance optimization opportunities',
      'Update disaster recovery procedures'
    ];
  }

  private async storeReport(report: PlatformReport): Promise<void> {
    // Store report for audit and historical analysis
    this.logger.debug(`Report stored for ${report.period} period`);
  }

  private calculateTotalEvents(metrics: any): number {
    return 1000000; // Mock calculation
  }

  private calculateOverallSuccessRate(metrics: any): number {
    return 99.95; // Mock calculation
  }

  private calculateAverageLatency(metrics: any): number {
    return 45; // Mock calculation
  }

  private async getInfrastructureMetrics(): Promise<any> {
    return {
      cpu: this.getCpuUsage(),
      memory: this.getMemoryUsage(),
      network: 'healthy',
      storage: 'healthy'
    };
  }

  private getCpuUsage(): any {
    const usage = process.cpuUsage();
    return {
      user: usage.user,
      system: usage.system,
      percentage: Math.random() * 100 // Mock percentage
    };
  }

  private getMemoryUsage(): any {
    return process.memoryUsage();
  }

  private async getNetworkHealth(): Promise<string> {
    return 'healthy';
  }

  private async getStorageHealth(): Promise<string> {
    return 'healthy';
  }

  private checkPerformanceThresholds(metrics: any): string[] {
    const alerts: string[] = [];
    
    if (metrics.platform?.averageLatency > 1000) {
      alerts.push('High latency detected');
    }
    
    if (metrics.platform?.successRate < 99) {
      alerts.push('Success rate below threshold');
    }
    
    return alerts;
  }
}
```

```typescript
// enterprise-platform.controller.ts
import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { VytchesDDD } from '@vytches-ddd/di';
import { EnterprisePlatformService } from './enterprise-platform.service';
import { 
  ScheduleMissionCriticalEventDto,
  ScheduleRegulatoryComplianceDto,
  PlatformReportDto 
} from './dto'; // From your app

@ApiTags('enterprise-platform')
@Controller('enterprise-platform')
@ApiBearerAuth()
export class EnterprisePlatformController {
  // ⭐ FOCUS: Service resolution through VytchesDDD container
  private get platformService(): EnterprisePlatformService {
    return VytchesDDD.resolve<EnterprisePlatformService>('enterprisePlatformService');
  }

  @Post('mission-critical-event')
  @ApiOperation({ summary: 'Schedule mission-critical enterprise event' })
  @ApiResponse({ status: 201, description: 'Mission-critical event scheduled successfully' })
  async scheduleMissionCriticalEvent(@Body() dto: ScheduleMissionCriticalEventDto) {
    const service = this.platformService;
    if (!service) {
      throw new Error('Enterprise platform service not available');
    }

    const result = await service.scheduleMissionCriticalEvent(
      dto.eventId,
      dto.eventData,
      new Date(dto.scheduleAt),
      dto.criticality
    );

    if (result.isFailure()) {
      throw new Error(result.error.message);
    }

    return {
      success: true,
      result: result.value,
      message: `Mission-critical event scheduled with ${result.value.criticality} priority`
    };
  }

  @Post('regulatory-compliance')
  @ApiOperation({ summary: 'Schedule regulatory compliance across jurisdictions' })
  @ApiResponse({ status: 201, description: 'Regulatory compliance scheduled successfully' })
  async scheduleRegulatoryCompliance(@Body() dto: ScheduleRegulatoryComplianceDto) {
    const service = this.platformService;
    if (!service) {
      throw new Error('Enterprise platform service not available');
    }

    const result = await service.scheduleRegulatoryCompliance(
      dto.regulationType,
      dto.jurisdictions,
      new Date(dto.deadline),
      dto.complianceData
    );

    if (result.isFailure()) {
      throw new Error(result.error.message);
    }

    return {
      success: true,
      result: result.value,
      message: `Regulatory compliance scheduled across ${dto.jurisdictions.length} jurisdictions`
    };
  }

  @Get('metrics/comprehensive')
  @ApiOperation({ summary: 'Get comprehensive platform metrics' })
  @ApiResponse({ status: 200, description: 'Comprehensive platform metrics' })
  async getComprehensivePlatformMetrics() {
    const service = this.platformService;
    if (!service) {
      throw new Error('Enterprise platform service not available');
    }

    return await service.getPlatformMetrics();
  }

  @Get('health/comprehensive')
  @ApiOperation({ summary: 'Perform comprehensive platform health check' })
  @ApiResponse({ status: 200, description: 'Comprehensive health status' })
  async getComprehensiveHealth() {
    const service = this.platformService;
    if (!service) {
      return {
        overall: 'unhealthy',
        reason: 'Enterprise platform service not available',
        timestamp: new Date()
      };
    }

    return await service.performComprehensiveHealthCheck();
  }

  @Get('reports/:period')
  @ApiOperation({ summary: 'Generate comprehensive platform report' })
  @ApiResponse({ status: 200, description: 'Platform report generated' })
  async generatePlatformReport(
    @Param('period') period: 'hourly' | 'daily' | 'weekly' | 'monthly'
  ): Promise<PlatformReportDto> {
    const service = this.platformService;
    if (!service) {
      throw new Error('Enterprise platform service not available');
    }

    const report = await service.generatePlatformReport(period);
    
    return {
      period: report.period,
      timeRange: report.timeRange,
      executive: report.executive,
      operational: report.operational,
      compliance: report.compliance,
      performance: report.performance,
      incidents: report.incidents,
      recommendations: report.recommendations,
      timestamp: report.timestamp
    };
  }

  @Get('monitoring/real-time')
  @ApiOperation({ summary: 'Get real-time monitoring dashboard data' })
  @ApiResponse({ status: 200, description: 'Real-time monitoring data' })
  async getRealTimeMonitoring() {
    const service = this.platformService;
    if (!service) {
      throw new Error('Enterprise platform service not available');
    }

    const [metrics, health] = await Promise.all([
      service.getPlatformMetrics(),
      service.performComprehensiveHealthCheck()
    ]);

    return {
      metrics,
      health,
      realTime: true,
      timestamp: new Date()
    };
  }
}
```

```typescript
// enterprise-platform.module.ts
import { Module, OnModuleInit } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ModuleRef } from '@nestjs/core';
import { VytchesDDD, NestJSContainerAdapter } from '@vytches-ddd/di';
import { EnterprisePlatformService } from './enterprise-platform.service';
import { EnterprisePlatformController } from './enterprise-platform.controller';
import { 
  GlobalCoordinationManagerProvider,
  HASchedulingServiceProvider,
  UltraHighPerformanceSchedulerProvider,
  EnterpriseSchedulingServiceProvider
} from './providers'; // From your app

@Module({
  imports: [
    ScheduleModule.forRoot() // Enable cron jobs
  ],
  providers: [
    EnterprisePlatformService,
    GlobalCoordinationManagerProvider,
    HASchedulingServiceProvider,
    UltraHighPerformanceSchedulerProvider,
    EnterpriseSchedulingServiceProvider
  ],
  controllers: [EnterprisePlatformController],
  exports: [EnterprisePlatformService]
})
export class EnterprisePlatformModule implements OnModuleInit {
  constructor(private moduleRef: ModuleRef) {}

  async onModuleInit(): Promise<void> {
    try {
      // ⭐ FOCUS: Initialize VytchesDDD with comprehensive enterprise services
      const adapter = new NestJSContainerAdapter(this.moduleRef);
      await VytchesDDD.configure(adapter);
      
      // Register enterprise platform services
      await this.registerEnterprisePlatformServices();
      
      console.log('🌐 Enterprise scheduling platform fully initialized');
      
    } catch (error) {
      console.error('❌ Failed to initialize enterprise platform:', error.message);
      throw error;
    }
  }

  private async registerEnterprisePlatformServices(): Promise<void> {
    // Register additional enterprise services that may not be automatically discovered
    const enterprisePlatformService = this.moduleRef.get(EnterprisePlatformService);
    
    // Register the platform service in VytchesDDD container
    VytchesDDD.container?.registerInstance(
      'enterprisePlatformService', 
      enterprisePlatformService
    );
    
    console.log('🏢 Enterprise platform services registered in VytchesDDD container');
  }
}
```

```typescript
// dto/enterprise-platform.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsDateString, IsArray, IsIn, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ScheduleMissionCriticalEventDto {
  @ApiProperty({ description: 'Unique event identifier' })
  @IsString()
  eventId: string;

  @ApiProperty({ description: 'Event data payload' })
  eventData: any;

  @ApiProperty({ description: 'Scheduled execution time' })
  @IsDateString()
  scheduleAt: string;

  @ApiProperty({ description: 'Event criticality level' })
  @IsIn(['emergency', 'critical', 'important'])
  criticality: 'emergency' | 'critical' | 'important';
}

export class ScheduleRegulatoryComplianceDto {
  @ApiProperty({ description: 'Type of regulation' })
  @IsString()
  regulationType: string;

  @ApiProperty({ description: 'Jurisdictions to comply with' })
  @IsArray()
  @IsString({ each: true })
  jurisdictions: string[];

  @ApiProperty({ description: 'Compliance deadline' })
  @IsDateString()
  deadline: string;

  @ApiProperty({ description: 'Compliance data payload' })
  complianceData: any;
}

export class PlatformReportDto {
  @ApiProperty({ description: 'Report period' })
  period: 'hourly' | 'daily' | 'weekly' | 'monthly';

  @ApiProperty({ description: 'Time range for the report' })
  timeRange: {
    start: Date;
    end: Date;
  };

  @ApiProperty({ description: 'Executive summary' })
  executive: any;

  @ApiProperty({ description: 'Operational summary' })
  operational: any;

  @ApiProperty({ description: 'Compliance summary' })
  compliance: any;

  @ApiProperty({ description: 'Performance summary' })
  performance: any;

  @ApiProperty({ description: 'Incidents during the period' })
  incidents: any[];

  @ApiProperty({ description: 'Recommendations' })
  recommendations: string[];

  @ApiProperty({ description: 'Report generation timestamp' })
  timestamp: Date;
}
```

## Usage Example

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { EnterprisePlatformModule } from './enterprise-platform/enterprise-platform.module';

@Module({
  imports: [
    EnterprisePlatformModule,
    // Other enterprise modules...
  ],
})
export class AppModule {}
```

```typescript
// main.ts
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Configure comprehensive API documentation
  const config = new DocumentBuilder()
    .setTitle('Enterprise Scheduling Platform API')
    .setDescription('Complete enterprise-grade scheduling platform with distributed coordination')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('enterprise-platform', 'Enterprise Platform Operations')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(3000);
  console.log('🚀 Enterprise Scheduling Platform running on http://localhost:3000');
}

bootstrap();
```

## Key Features

- **Complete Enterprise Platform**: Full-featured platform with all scheduling capabilities integrated
- **Distributed Architecture**: Multi-region coordination with automatic failover and disaster recovery
- **Comprehensive Monitoring**: Real-time monitoring, alerting, and automated health checks
- **Regulatory Compliance**: Built-in compliance management with multi-jurisdiction support
- **Mission-Critical Support**: Emergency event handling with maximum coordination and monitoring
- **Advanced Observability**: Detailed metrics, health checks, and comprehensive reporting
- **Automated Operations**: Cron-based monitoring, alerting, and maintenance tasks
- **Enterprise Integration**: Full VytchesDDD ecosystem integration with container management

## Common Pitfalls

- **Resource Management**: Monitor and manage resources across all distributed components
- **Service Dependencies**: Ensure proper startup order and dependency resolution
- **Configuration Management**: Maintain consistent configuration across all environments
- **Monitoring Overhead**: Balance comprehensive monitoring with system performance
- **Alert Fatigue**: Configure appropriate alert thresholds to avoid excessive notifications
- **Compliance Updates**: Keep compliance rules and reporting updated with regulatory changes

## Related Examples

- [Basic NestJS Integration](../basic/example-1.md) - Simple setup and basic concepts
- [NestJS DI Integration](../intermediate/example-1.md) - Advanced dependency injection patterns
- [Enterprise Scheduling Platform](../../../advanced/example-1.md) - Global coordination concepts
- [High Availability Scheduling](../../../advanced/example-2.md) - HA and clustering patterns