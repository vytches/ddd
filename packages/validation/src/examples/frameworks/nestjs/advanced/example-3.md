# NestJS Real-time Quality Monitoring - VytchesDDD DI

**Package**: @vytches-ddd/validation  
**Framework**: NestJS  
**Complexity**: Advanced  
**Focus**: Real-time global data quality monitoring with streaming analytics and automated remediation

## Overview

This example demonstrates advanced real-time global data quality monitoring in NestJS using VytchesDDD DI for streaming data processing, automated quality degradation detection, and intelligent remediation workflows with enterprise-scale monitoring capabilities.

## Implementation

```typescript
// real-time-quality-monitor.service.ts
import { Injectable } from '@nestjs/common';
import { 
  DomainService, 
  ServiceLifetime, 
  VytchesDDD 
} from '@vytches-ddd/di';
import { 
  GlobalDataQualityMonitor,
  StreamingQualityProcessor,
  QualityPredictor,
  DataQualityMetrics,
  ValidationMetrics 
} from '@vytches-ddd/validation';
import { 
  QualityStreamConfig,
  QualityAlert,
  RemediationAction 
} from './types'; // From your application

// Real-time quality monitoring service with VytchesDDD DI
@DomainService({
  serviceId: 'realTimeQualityMonitor',
  lifetime: ServiceLifetime.Singleton,
  context: 'QualityMonitoring',
  dependencies: [
    'streamProcessor',
    'qualityPredictor',
    'alertManager',
    'remediationEngine',
    'eventBus',
    'metricsCollector'
  ],
  timeout: 30000,
  middleware: ['logging', 'resilience', 'streaming'],
  autoRegister: true
})
export class RealTimeQualityMonitorService {
  private globalMonitor: GlobalDataQualityMonitor;
  private streamProcessor: StreamingQualityProcessor;
  private qualityPredictor: QualityPredictor;
  private alertManager: QualityAlertManager;
  private remediationEngine: AutomatedRemediationEngine;
  private metricsCollector: QualityMetricsCollector;
  private activeStreams: Map<string, QualityStream>;

  constructor() {
    // ⭐ FOCUS: Real-time DI with streaming capabilities
    this.activeStreams = new Map();
    this.initializeRealTimeMonitoring();
  }

  async startGlobalMonitoring(config: GlobalMonitoringConfig): Promise<MonitoringSession> {
    const sessionId = `session-${Date.now()}`;
    
    // Initialize monitoring streams for all configured sources
    const streamPromises = config.dataSources.map(source => 
      this.createQualityStream(source, sessionId)
    );

    const streams = await Promise.all(streamPromises);
    
    // Start global coordination
    await this.globalMonitor.startGlobalMonitoring();
    
    // Begin predictive analysis
    const predictionProcess = this.startPredictiveMonitoring(sessionId);

    return {
      sessionId,
      startTime: new Date(),
      activeStreams: streams.length,
      monitoredSources: config.dataSources.length,
      predictionEnabled: true,
      globalCoordinationActive: true
    };
  }

  async processRealTimeQuality(
    dataStream: DataStream,
    sourceId: string
  ): Promise<RealTimeQualityResult> {
    const processingStart = Date.now();

    // Real-time quality processing
    const qualityMetrics = await this.streamProcessor.processRealTimeData(
      dataStream.data,
      sourceId
    );

    // Quality degradation detection
    const degradationAlert = await this.detectQualityDegradation(
      qualityMetrics,
      sourceId
    );

    // Predictive quality analysis
    const qualityPrediction = await this.qualityPredictor.predictQualityTrends(
      qualityMetrics,
      sourceId
    );

    // Automated remediation if needed
    const remediationActions = await this.handleQualityIssues(
      qualityMetrics,
      degradationAlert,
      qualityPrediction
    );

    const processingTime = Date.now() - processingStart;

    return {
      sourceId,
      timestamp: new Date(),
      qualityMetrics,
      degradationAlert,
      qualityPrediction,
      remediationActions,
      processingTime,
      streamHealth: await this.assessStreamHealth(sourceId)
    };
  }

  async getGlobalQualitySnapshot(): Promise<GlobalQualitySnapshot> {
    const allMetrics = await this.metricsCollector.collectGlobalMetrics();
    const activeAlerts = await this.alertManager.getActiveAlerts();
    const qualityTrends = await this.qualityPredictor.getGlobalQualityTrends();

    return {
      timestamp: new Date(),
      overallQuality: allMetrics.global.overallScore,
      regionalBreakdown: allMetrics.byRegion,
      sourceBreakdown: allMetrics.bySource,
      activeAlerts: activeAlerts.length,
      trendingIssues: qualityTrends.decliningSources,
      improvingSources: qualityTrends.improvingSources,
      criticalSources: allMetrics.criticalSources,
      globalHealthScore: this.calculateGlobalHealthScore(allMetrics, activeAlerts)
    };
  }

  async configureQualityThresholds(
    sourceId: string,
    thresholds: QualityThresholdConfig
  ): Promise<ThresholdConfigResult> {
    return await this.globalMonitor.updateQualityThresholds(sourceId, thresholds);
  }

  async getQualityAnalytics(
    analyticsRequest: QualityAnalyticsRequest
  ): Promise<QualityAnalyticsResult> {
    const timeRange = analyticsRequest.timeRange || this.getDefaultTimeRange();
    
    const analytics = await this.metricsCollector.generateAnalytics(
      timeRange,
      analyticsRequest.sources,
      analyticsRequest.metrics
    );

    const patterns = await this.qualityPredictor.identifyQualityPatterns(
      timeRange,
      analyticsRequest.sources
    );

    return {
      timeRange,
      summary: analytics.summary,
      trends: analytics.trends,
      patterns,
      anomalies: analytics.anomalies,
      recommendations: await this.generateAnalyticsRecommendations(analytics, patterns),
      exportData: analyticsRequest.includeExport ? analytics.rawData : undefined
    };
  }

  private initializeRealTimeMonitoring(): void {
    // Real-time components resolved through VytchesDDD DI
    const eventBus = VytchesDDD.resolve('eventBus');
    const validationService = VytchesDDD.resolve('validationService');
    
    this.globalMonitor = new GlobalDataQualityMonitor(
      eventBus,
      validationService,
      VytchesDDD.resolve('qualityAnalyzer')
    );

    this.streamProcessor = VytchesDDD.resolve<StreamingQualityProcessor>('streamProcessor');
    this.qualityPredictor = VytchesDDD.resolve<QualityPredictor>('qualityPredictor');
    this.alertManager = VytchesDDD.resolve<QualityAlertManager>('alertManager');
    this.remediationEngine = VytchesDDD.resolve<AutomatedRemediationEngine>('remediationEngine');
    this.metricsCollector = VytchesDDD.resolve<QualityMetricsCollector>('metricsCollector');
  }

  private async createQualityStream(
    source: DataSourceConfig,
    sessionId: string
  ): Promise<QualityStream> {
    const streamConfig: QualityStreamConfig = {
      sourceId: source.sourceId,
      sessionId,
      processingMode: 'real_time',
      batchSize: source.batchSize || 100,
      windowSize: source.windowSize || 60000, // 1 minute
      qualityThresholds: source.qualityThresholds
    };

    const stream = await this.streamProcessor.createStream(streamConfig);
    this.activeStreams.set(source.sourceId, stream);
    
    return stream;
  }

  private async detectQualityDegradation(
    metrics: DataQualityMetrics,
    sourceId: string
  ): Promise<QualityDegradationAlert | null> {
    const baseline = await this.metricsCollector.getQualityBaseline(sourceId);
    
    if (!baseline) return null;

    const degradation = this.calculateDegradation(metrics, baseline);
    
    if (degradation.severity !== 'none') {
      const alert: QualityDegradationAlert = {
        alertId: `degradation-${sourceId}-${Date.now()}`,
        sourceId,
        severity: degradation.severity,
        metrics,
        baseline,
        degradationFactors: degradation.factors,
        timestamp: new Date(),
        estimatedImpact: await this.estimateQualityImpact(degradation, sourceId)
      };

      await this.alertManager.raiseAlert(alert);
      return alert;
    }

    return null;
  }

  private calculateDegradation(
    current: DataQualityMetrics,
    baseline: DataQualityMetrics
  ): { severity: string; factors: string[] } {
    const factors: string[] = [];
    let maxDegradation = 0;

    Object.keys(current).forEach(key => {
      const metricKey = key as keyof DataQualityMetrics;
      const currentValue = current[metricKey];
      const baselineValue = baseline[metricKey];
      
      if (typeof currentValue === 'number' && typeof baselineValue === 'number') {
        const degradation = (baselineValue - currentValue) / baselineValue;
        
        if (degradation > 0.02) { // 2% threshold
          factors.push(`${key}: ${(degradation * 100).toFixed(1)}% decline`);
          maxDegradation = Math.max(maxDegradation, degradation);
        }
      }
    });

    let severity = 'none';
    if (maxDegradation >= 0.20) severity = 'critical';
    else if (maxDegradation >= 0.10) severity = 'high';
    else if (maxDegradation >= 0.05) severity = 'medium';
    else if (maxDegradation >= 0.02) severity = 'low';

    return { severity, factors };
  }

  private async startPredictiveMonitoring(sessionId: string): Promise<void> {
    // Run predictive analysis every 2 minutes
    setInterval(async () => {
      try {
        await this.runPredictiveAnalysis(sessionId);
      } catch (error) {
        console.error('Predictive analysis failed:', error);
      }
    }, 120000);
  }

  private async runPredictiveAnalysis(sessionId: string): Promise<void> {
    for (const [sourceId, stream] of this.activeStreams) {
      const prediction = await this.qualityPredictor.predictUpcomingIssues(
        sourceId,
        stream.getRecentMetrics()
      );

      if (prediction.riskLevel === 'high') {
        await this.alertManager.createPredictiveAlert(sourceId, prediction);
      }

      if (prediction.recommendedActions.length > 0) {
        await this.remediationEngine.schedulePreventiveActions(
          sourceId,
          prediction.recommendedActions
        );
      }
    }
  }

  private async handleQualityIssues(
    metrics: DataQualityMetrics,
    alert: QualityDegradationAlert | null,
    prediction: QualityPrediction
  ): Promise<RemediationAction[]> {
    const actions: RemediationAction[] = [];

    // Handle immediate quality issues
    if (alert && alert.severity === 'critical') {
      const immediateActions = await this.remediationEngine.generateImmediateActions(alert);
      actions.push(...immediateActions);
    }

    // Handle predicted issues
    if (prediction.riskLevel === 'high') {
      const preventiveActions = await this.remediationEngine.generatePreventiveActions(prediction);
      actions.push(...preventiveActions);
    }

    // Execute auto-remediation actions
    for (const action of actions) {
      if (action.autoExecute) {
        try {
          await this.remediationEngine.executeAction(action);
        } catch (error) {
          console.error(`Failed to execute remediation action ${action.actionId}:`, error);
        }
      }
    }

    return actions;
  }

  private async assessStreamHealth(sourceId: string): Promise<StreamHealthMetrics> {
    const stream = this.activeStreams.get(sourceId);
    if (!stream) {
      return { status: 'inactive', healthScore: 0 };
    }

    const recentMetrics = stream.getRecentMetrics();
    const processingRate = stream.getProcessingRate();
    const errorRate = stream.getErrorRate();

    return {
      status: errorRate < 0.01 ? 'healthy' : 'degraded',
      healthScore: Math.max(0, 1 - errorRate * 10),
      processingRate,
      errorRate,
      uptime: stream.getUptime(),
      lastProcessed: stream.getLastProcessedTime()
    };
  }

  private calculateGlobalHealthScore(
    metrics: GlobalMetrics,
    alerts: QualityAlert[]
  ): number {
    const baseScore = metrics.global.overallScore;
    const alertPenalty = alerts.length * 0.05; // 5% penalty per active alert
    const criticalPenalty = alerts.filter(a => a.severity === 'critical').length * 0.15;
    
    return Math.max(0, baseScore - alertPenalty - criticalPenalty);
  }

  private async estimateQualityImpact(
    degradation: any,
    sourceId: string
  ): Promise<QualityImpactEstimate> {
    return {
      affectedSystems: await this.identifyAffectedSystems(sourceId),
      businessImpact: degradation.severity === 'critical' ? 'high' : 'medium',
      estimatedRecoveryTime: degradation.severity === 'critical' ? 30 : 15, // minutes
      riskLevel: degradation.severity
    };
  }

  private async identifyAffectedSystems(sourceId: string): Promise<string[]> {
    // Implementation would map data dependencies
    return [`downstream-${sourceId}`, `reporting-${sourceId}`];
  }

  private async generateAnalyticsRecommendations(
    analytics: QualityAnalytics,
    patterns: QualityPattern[]
  ): Promise<string[]> {
    const recommendations: string[] = [];

    if (analytics.summary.averageQuality < 0.9) {
      recommendations.push('Implement stricter quality controls');
    }

    const decliningTrends = analytics.trends.filter(t => t.direction === 'declining');
    if (decliningTrends.length > 0) {
      recommendations.push('Address declining quality trends in affected sources');
    }

    const frequentPatterns = patterns.filter(p => p.frequency > 0.1);
    if (frequentPatterns.length > 0) {
      recommendations.push('Optimize for recurring quality patterns');
    }

    return recommendations;
  }

  private getDefaultTimeRange(): TimeRange {
    const end = new Date();
    const start = new Date(end.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago
    return { start, end };
  }
}

// NestJS bridge service for real-time quality monitoring
@Injectable()
export class RealTimeQualityBridgeService {
  private qualityMonitorService: RealTimeQualityMonitorService;

  constructor() {
    // ⭐ FOCUS: Bridge pattern with real-time VytchesDDD DI
    this.qualityMonitorService = VytchesDDD.resolve<RealTimeQualityMonitorService>(
      'realTimeQualityMonitor'
    );
  }

  async initializeMonitoring(
    config: MonitoringInitRequest
  ): Promise<MonitoringInitResponse> {
    try {
      const session = await this.qualityMonitorService.startGlobalMonitoring(config);
      
      return {
        success: true,
        sessionId: session.sessionId,
        monitoringSummary: {
          startTime: session.startTime,
          activeStreams: session.activeStreams,
          monitoredSources: session.monitoredSources,
          features: {
            realTimeProcessing: true,
            predictiveAnalytics: session.predictionEnabled,
            globalCoordination: session.globalCoordinationActive,
            automaticRemediation: true
          }
        },
        endpoints: {
          qualityStream: `/quality/stream/${session.sessionId}`,
          analytics: `/quality/analytics`,
          alerts: `/quality/alerts`,
          health: `/quality/health`
        }
      };

    } catch (error) {
      throw new Error(`Failed to initialize quality monitoring: ${error.message}`);
    }
  }

  async processQualityStream(
    streamData: QualityStreamRequest
  ): Promise<QualityStreamResponse> {
    const result = await this.qualityMonitorService.processRealTimeQuality(
      streamData.dataStream,
      streamData.sourceId
    );

    return {
      success: true,
      processingTime: result.processingTime,
      qualityAssessment: {
        sourceId: result.sourceId,
        timestamp: result.timestamp,
        overallScore: result.qualityMetrics.overallScore,
        qualityGrade: this.calculateQualityGrade(result.qualityMetrics.overallScore),
        streamHealth: result.streamHealth
      },
      alerts: result.degradationAlert ? [result.degradationAlert] : [],
      predictions: {
        riskLevel: result.qualityPrediction.riskLevel,
        timeHorizon: result.qualityPrediction.timeHorizon,
        predictedIssues: result.qualityPrediction.predictedIssues
      },
      remediationActions: result.remediationActions.map(action => ({
        actionId: action.actionId,
        type: action.type,
        executed: action.executed,
        result: action.result
      }))
    };
  }

  async getQualityDashboard(): Promise<QualityDashboardData> {
    const snapshot = await this.qualityMonitorService.getGlobalQualitySnapshot();
    
    return {
      globalOverview: {
        overallHealth: snapshot.globalHealthScore,
        overallQuality: snapshot.overallQuality,
        activeAlerts: snapshot.activeAlerts,
        monitoredSources: Object.keys(snapshot.sourceBreakdown).length
      },
      regionalStatus: Object.entries(snapshot.regionalBreakdown).map(([region, metrics]) => ({
        region,
        qualityScore: metrics.overallScore,
        status: metrics.overallScore > 0.9 ? 'healthy' : 'warning',
        sources: metrics.sourceCount
      })),
      criticalIssues: snapshot.criticalSources.map(source => ({
        sourceId: source.sourceId,
        issueType: source.primaryIssue,
        severity: source.severity,
        duration: source.duration
      })),
      trends: {
        declining: snapshot.trendingIssues.length,
        improving: snapshot.improvingSources.length,
        stable: snapshot.regionalBreakdown.length - snapshot.trendingIssues.length - snapshot.improvingSources.length
      }
    };
  }

  private calculateQualityGrade(score: number): string {
    if (score >= 0.95) return 'A+';
    if (score >= 0.90) return 'A';
    if (score >= 0.85) return 'B+';
    if (score >= 0.80) return 'B';
    if (score >= 0.75) return 'C+';
    if (score >= 0.70) return 'C';
    return 'D';
  }
}

// quality-monitoring.controller.ts
import { 
  Controller, 
  Post, 
  Body, 
  BadRequestException,
  HttpStatus,
  HttpCode,
  Get,
  Param,
  Query 
} from '@nestjs/common';
import { RealTimeQualityBridgeService } from './real-time-quality-bridge.service';

@Controller('quality')
export class QualityMonitoringController {
  constructor(
    private readonly qualityService: RealTimeQualityBridgeService
  ) {}

  @Post('initialize')
  @HttpCode(HttpStatus.CREATED)
  async initializeMonitoring(@Body() config: MonitoringInitRequest) {
    try {
      // ✅ FOCUS: Real-time monitoring initialization
      const result = await this.qualityService.initializeMonitoring(config);

      return {
        success: true,
        message: 'Real-time quality monitoring initialized',
        session: result.sessionId,
        monitoring: result.monitoringSummary,
        endpoints: result.endpoints,
        instructions: [
          'Send data streams to the quality stream endpoint',
          'Monitor alerts via the alerts endpoint',
          'Access analytics through the analytics endpoint'
        ]
      };

    } catch (error) {
      throw new BadRequestException({
        message: 'Failed to initialize monitoring',
        error: error.message
      });
    }
  }

  @Post('stream/:sessionId')
  @HttpCode(HttpStatus.OK)
  async processQualityStream(
    @Param('sessionId') sessionId: string,
    @Body() streamData: QualityStreamRequest
  ) {
    try {
      const result = await this.qualityService.processQualityStream(streamData);

      return {
        success: true,
        sessionId,
        processing: {
          timestamp: new Date(),
          processingTime: result.processingTime,
          qualityGrade: result.qualityAssessment.qualityGrade,
          overallScore: result.qualityAssessment.overallScore
        },
        realTimeStatus: {
          streamHealth: result.qualityAssessment.streamHealth,
          alerts: result.alerts.length,
          remediationActions: result.remediationActions.length
        },
        predictions: result.predictions,
        immediateActions: result.remediationActions
          .filter(a => a.executed)
          .map(a => ({ type: a.type, result: a.result }))
      };

    } catch (error) {
      throw new BadRequestException({
        message: 'Quality stream processing failed',
        error: error.message
      });
    }
  }

  @Get('dashboard')
  @HttpCode(HttpStatus.OK)
  async getQualityDashboard() {
    try {
      const dashboard = await this.qualityService.getQualityDashboard();

      return {
        success: true,
        message: 'Quality dashboard data retrieved',
        timestamp: new Date(),
        dashboard,
        refreshInterval: 30, // seconds
        lastUpdate: new Date()
      };

    } catch (error) {
      throw new BadRequestException({
        message: 'Failed to retrieve quality dashboard',
        error: error.message
      });
    }
  }
}

// quality-monitoring.module.ts
import { Module, OnModuleInit } from '@nestjs/common';
import { QualityMonitoringController } from './quality-monitoring.controller';
import { RealTimeQualityBridgeService } from './real-time-quality-bridge.service';
import { VytchesDDD } from '@vytches-ddd/di';

@Module({
  controllers: [QualityMonitoringController],
  providers: [RealTimeQualityBridgeService],
  exports: [RealTimeQualityBridgeService]
})
export class QualityMonitoringModule implements OnModuleInit {
  async onModuleInit() {
    // ⭐ CRITICAL: Initialize VytchesDDD with real-time features
    await VytchesDDD.configure({
      enableAutoDiscovery: true,
      contexts: ['QualityMonitoring'],
      realTimeFeatures: {
        streamProcessing: true,
        realTimeAnalytics: true,
        automaticRemediation: true,
        predictiveMonitoring: true,
        globalCoordination: true
      },
      streaming: {
        maxConcurrentStreams: 1000,
        bufferSize: 10000,
        processingMode: 'real_time'
      }
    });
  }
}
```

## Key Points

- **Real-time Processing**: Continuous quality monitoring with streaming data processing
- **Predictive Analytics**: Forward-looking quality prediction and trend analysis
- **Automated Remediation**: Intelligent automatic response to quality issues
- **Global Coordination**: Enterprise-scale quality coordination across multiple sources
- **VytchesDDD DI Integration**: Advanced dependency injection for streaming services

## Usage Examples

```bash
# Initialize quality monitoring
curl -X POST http://localhost:3000/quality/initialize \
  -H "Content-Type: application/json" \
  -d '{
    "dataSources": [
      {
        "sourceId": "customer-db",
        "sourceType": "database",
        "batchSize": 100,
        "windowSize": 60000,
        "qualityThresholds": {
          "completeness": 0.95,
          "accuracy": 0.98
        }
      }
    ]
  }'

# Process quality stream
curl -X POST http://localhost:3000/quality/stream/session-123 \
  -H "Content-Type: application/json" \
  -d '{
    "sourceId": "customer-db",
    "dataStream": {
      "data": [
        {"id": 1, "email": "test@example.com", "name": "Test User"},
        {"id": 2, "email": "user2@example.com", "name": "User Two"}
      ],
      "batchId": "batch-001",
      "timestamp": "2024-07-21T10:00:00Z"
    }
  }'

# Get quality dashboard
curl -X GET http://localhost:3000/quality/dashboard
```

## Next Steps

- Review [Basic Manual Integration](../basic/example-1.md)
- Explore [Intermediate DI Integration](../intermediate/example-1.md)
- Study [Enterprise Orchestration](./example-1.md)