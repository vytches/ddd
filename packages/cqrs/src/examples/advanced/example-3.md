# Real-time Analytics CQRS with Stream Processing

**Version**: 1.0.0 **Package**: @vytches/ddd-cqrs **Complexity**: Advanced
**Domain**: Architecture **Patterns**: CQRS, Stream Processing, Real-time
Analytics, Complex Event Processing **Dependencies**: @vytches/ddd-cqrs,
@vytches/ddd-events, @vytches/ddd-projections, @vytches/ddd-event-store,
@vytches/ddd-utils

## Description

This example demonstrates implementing real-time analytics using CQRS patterns
with stream processing capabilities. It shows how to build complex event
processing pipelines, real-time dashboards, anomaly detection, and business
intelligence systems that process millions of events per second with sub-second
latency.

## Business Context

Real-time analytics is crucial for modern enterprises:

- **Financial Trading**: Real-time market analysis, risk monitoring, algorithmic
  trading
- **E-commerce**: Live conversion tracking, inventory monitoring, dynamic
  pricing
- **IoT/Smart Cities**: Sensor data processing, traffic analysis, resource
  optimization
- **Gaming**: Player behavior analytics, real-time leaderboards, fraud detection
- **Social Media**: Trending topic detection, engagement analytics, content
  moderation

## Code Example

```typescript
// realtime-analytics-cqrs.ts
import {
  Command,
  CommandHandler,
  Query,
  QueryHandler,
} from '@vytches/ddd-cqrs';
import { EventBus, DomainEvent, EventStream } from '@vytches/ddd-events';
import { ProjectionEngine, StreamProjection } from '@vytches/ddd-projections';
import { EventStore } from '@vytches/ddd-event-store';
import { Result } from '@vytches/ddd-utils';
import type {
  AnalyticsEvent,
  TimeWindow,
  AggregationResult,
  StreamMetrics,
  DashboardData,
} from '../types'; // From your application

// ✅ FOCUS: Stream processing command for analytics
export class StartAnalyticsStreamCommand extends Command {
  constructor(
    public readonly streamId: string,
    public readonly streamConfig: StreamConfiguration,
    public readonly analyticsRules: AnalyticsRule[]
  ) {
    super();
  }
}

// ✅ FOCUS: Complex event processing engine
@Injectable()
export class StreamAnalyticsEngine {
  private activeStreams = new Map<string, AnalyticsStream>();
  private windowedAggregators = new Map<string, WindowedAggregator>();

  constructor(
    private readonly eventStore: EventStore,
    private readonly projectionEngine: ProjectionEngine,
    private readonly metricsCollector: IMetricsCollector
  ) {}

  // ✅ FOCUS: Start real-time stream processing
  async startStream(config: StreamConfiguration): Promise<AnalyticsStream> {
    const stream = new AnalyticsStream(config);

    // Initialize windowed aggregators
    for (const window of config.windows) {
      const aggregator = new WindowedAggregator(window);
      this.windowedAggregators.set(
        `${config.streamId}-${window.type}`,
        aggregator
      );
    }

    // Subscribe to event stream
    const eventStream = await this.eventStore.subscribeToStream(
      config.eventTypes,
      {
        fromPosition: config.startFrom || 'latest',
        batchSize: config.batchSize || 1000,
        maxConcurrency: config.maxConcurrency || 10,
      }
    );

    // Process events in real-time
    this.processEventStream(stream, eventStream);

    this.activeStreams.set(config.streamId, stream);
    return stream;
  }

  // ✅ FOCUS: High-performance event processing pipeline
  private async processEventStream(
    stream: AnalyticsStream,
    eventStream: AsyncIterable<DomainEvent>
  ): Promise<void> {
    const batchProcessor = new BatchProcessor(stream.config.batchSize);
    const startTime = Date.now();
    let eventCount = 0;

    for await (const event of eventStream) {
      eventCount++;

      // Add to batch
      batchProcessor.add(event);

      // Process when batch is full
      if (batchProcessor.isFull()) {
        await this.processBatch(stream, batchProcessor.flush());

        // Update metrics every 1000 events
        if (eventCount % 1000 === 0) {
          const throughput = eventCount / ((Date.now() - startTime) / 1000);
          await this.updateStreamMetrics(stream.config.streamId, {
            eventsProcessed: eventCount,
            throughput: throughput,
            latency: batchProcessor.getAverageLatency(),
          });
        }
      }
    }

    // Process remaining events
    if (batchProcessor.hasEvents()) {
      await this.processBatch(stream, batchProcessor.flush());
    }
  }

  // ✅ FOCUS: Batch processing with windowed aggregations
  private async processBatch(
    stream: AnalyticsStream,
    batch: DomainEvent[]
  ): Promise<void> {
    const processingStart = process.hrtime.bigint();

    // Apply transformations
    const transformedEvents = await this.applyTransformations(
      batch,
      stream.config.transformations
    );

    // Filter events based on rules
    const filteredEvents = this.applyFilters(
      transformedEvents,
      stream.config.filters
    );

    // Update windowed aggregations
    for (const event of filteredEvents) {
      for (const window of stream.config.windows) {
        const aggregator = this.windowedAggregators.get(
          `${stream.config.streamId}-${window.type}`
        );
        if (aggregator) {
          aggregator.addEvent(event);
        }
      }
    }

    // Check for pattern matches
    const patterns = await this.detectPatterns(
      filteredEvents,
      stream.config.patterns
    );

    // Trigger alerts if needed
    if (patterns.length > 0) {
      await this.triggerAlerts(patterns, stream.config.alerts);
    }

    // Update projections
    await this.updateProjections(filteredEvents, stream.config.projections);

    const processingTime =
      Number(process.hrtime.bigint() - processingStart) / 1_000_000;

    // Record batch metrics
    await this.metricsCollector.recordMetrics({
      operation: 'StreamAnalytics.processBatch',
      batchSize: batch.length,
      processingTimeMs: processingTime,
      throughput: batch.length / (processingTime / 1000),
      tags: {
        streamId: stream.config.streamId,
      },
    });
  }

  // ✅ FOCUS: Complex event pattern detection
  private async detectPatterns(
    events: AnalyticsEvent[],
    patterns: PatternDefinition[]
  ): Promise<PatternMatch[]> {
    const matches: PatternMatch[] = [];

    for (const pattern of patterns) {
      switch (pattern.type) {
        case 'SEQUENCE':
          const sequenceMatches = this.detectSequencePattern(events, pattern);
          matches.push(...sequenceMatches);
          break;

        case 'THRESHOLD':
          const thresholdMatches = this.detectThresholdPattern(events, pattern);
          matches.push(...thresholdMatches);
          break;

        case 'ANOMALY':
          const anomalies = await this.detectAnomalies(events, pattern);
          matches.push(...anomalies);
          break;

        case 'CORRELATION':
          const correlations = this.detectCorrelations(events, pattern);
          matches.push(...correlations);
          break;
      }
    }

    return matches;
  }

  // ✅ FOCUS: Sliding window aggregation
  private detectThresholdPattern(
    events: AnalyticsEvent[],
    pattern: PatternDefinition
  ): PatternMatch[] {
    const matches: PatternMatch[] = [];
    const windowSize = pattern.windowSize || 60000; // 1 minute default

    // Group events by time window
    const windows = this.groupByTimeWindow(events, windowSize);

    for (const [windowStart, windowEvents] of windows) {
      const aggregatedValue = this.aggregate(
        windowEvents,
        pattern.aggregation,
        pattern.field
      );

      if (this.evaluateThreshold(aggregatedValue, pattern.threshold)) {
        matches.push({
          patternId: pattern.id,
          type: 'THRESHOLD_BREACH',
          timestamp: new Date(windowStart),
          value: aggregatedValue,
          events: windowEvents.map(e => e.id),
          metadata: {
            threshold: pattern.threshold,
            actual: aggregatedValue,
            windowSize: windowSize,
          },
        });
      }
    }

    return matches;
  }

  private aggregate(
    events: AnalyticsEvent[],
    aggregation: AggregationType,
    field: string
  ): number {
    const values = events
      .map(e => e.data[field])
      .filter(v => typeof v === 'number');

    switch (aggregation) {
      case 'SUM':
        return values.reduce((a, b) => a + b, 0);
      case 'AVG':
        return values.length > 0
          ? values.reduce((a, b) => a + b, 0) / values.length
          : 0;
      case 'MAX':
        return Math.max(...values);
      case 'MIN':
        return Math.min(...values);
      case 'COUNT':
        return values.length;
      case 'P95':
        return this.percentile(values, 0.95);
      case 'P99':
        return this.percentile(values, 0.99);
      default:
        return 0;
    }
  }
}

// ✅ FOCUS: Windowed aggregator for time-series data
export class WindowedAggregator {
  private windows: Map<number, WindowData> = new Map();
  private readonly windowSizeMs: number;
  private readonly slideIntervalMs: number;

  constructor(private config: WindowConfiguration) {
    this.windowSizeMs = this.parseTimeWindow(config.size);
    this.slideIntervalMs = this.parseTimeWindow(config.slide || config.size);
  }

  addEvent(event: AnalyticsEvent): void {
    const timestamp = event.timestamp.getTime();
    const windowKeys = this.getWindowKeys(timestamp);

    for (const windowKey of windowKeys) {
      let window = this.windows.get(windowKey);
      if (!window) {
        window = {
          startTime: windowKey,
          endTime: windowKey + this.windowSizeMs,
          events: [],
          aggregates: {},
        };
        this.windows.set(windowKey, window);
      }

      window.events.push(event);
      this.updateAggregates(window, event);
    }

    // Clean old windows
    this.cleanOldWindows(timestamp);
  }

  getAggregates(timestamp: number): AggregationResult[] {
    const results: AggregationResult[] = [];

    for (const [windowStart, window] of this.windows) {
      if (timestamp >= window.startTime && timestamp < window.endTime) {
        results.push({
          windowStart: new Date(window.startTime),
          windowEnd: new Date(window.endTime),
          eventCount: window.events.length,
          aggregates: { ...window.aggregates },
        });
      }
    }

    return results;
  }

  private updateAggregates(window: WindowData, event: AnalyticsEvent): void {
    // Update various aggregations
    for (const [field, value] of Object.entries(event.data)) {
      if (typeof value === 'number') {
        if (!window.aggregates[field]) {
          window.aggregates[field] = {
            sum: 0,
            count: 0,
            min: Infinity,
            max: -Infinity,
            values: [],
          };
        }

        const agg = window.aggregates[field];
        agg.sum += value;
        agg.count++;
        agg.min = Math.min(agg.min, value);
        agg.max = Math.max(agg.max, value);
        agg.values.push(value);
      }
    }
  }

  private getWindowKeys(timestamp: number): number[] {
    const keys: number[] = [];
    const alignedTime =
      Math.floor(timestamp / this.slideIntervalMs) * this.slideIntervalMs;

    // Get all windows that include this timestamp
    for (
      let i = 0;
      i < Math.ceil(this.windowSizeMs / this.slideIntervalMs);
      i++
    ) {
      const windowStart = alignedTime - i * this.slideIntervalMs;
      if (windowStart >= 0) {
        keys.push(windowStart);
      }
    }

    return keys;
  }

  private cleanOldWindows(currentTime: number): void {
    const cutoffTime = currentTime - this.windowSizeMs * 2;

    for (const [windowStart, window] of this.windows) {
      if (window.endTime < cutoffTime) {
        this.windows.delete(windowStart);
      }
    }
  }
}

// ✅ FOCUS: Real-time dashboard query
export class GetRealTimeDashboardQuery extends Query<DashboardData> {
  constructor(
    public readonly dashboardId: string,
    public readonly timeRange: TimeRange,
    public readonly refreshInterval: number = 1000
  ) {
    super();
  }
}

// ✅ FOCUS: Real-time dashboard handler
@QueryHandler(GetRealTimeDashboardQuery)
export class GetRealTimeDashboardHandler {
  constructor(
    private readonly streamAnalytics: StreamAnalyticsEngine,
    private readonly projectionEngine: ProjectionEngine,
    private readonly cacheService: IRealtimeCache
  ) {}

  async execute(
    query: GetRealTimeDashboardQuery
  ): Promise<Result<DashboardData, Error>> {
    try {
      // Get dashboard configuration
      const dashboardConfig = await this.getDashboardConfig(query.dashboardId);

      // Collect metrics from multiple sources
      const metrics = await Promise.all([
        this.getStreamMetrics(dashboardConfig.streams),
        this.getAggregatedMetrics(
          dashboardConfig.aggregations,
          query.timeRange
        ),
        this.getProjectionData(dashboardConfig.projections),
        this.getAlertStatus(dashboardConfig.alerts),
      ]);

      const dashboardData: DashboardData = {
        dashboardId: query.dashboardId,
        timestamp: new Date(),
        widgets: this.buildWidgets(dashboardConfig.widgets, metrics),
        alerts: metrics[3],
        refreshInterval: query.refreshInterval,
        metadata: {
          lastUpdate: new Date(),
          dataFreshness: this.calculateDataFreshness(metrics),
          performance: {
            queryTimeMs: 0, // Will be updated
            dataSources: dashboardConfig.dataSources.length,
          },
        },
      };

      // Cache with short TTL for real-time data
      await this.cacheService.set(
        `dashboard:${query.dashboardId}`,
        dashboardData,
        query.refreshInterval
      );

      return Result.ok(dashboardData);
    } catch (error) {
      return Result.fail(error as Error);
    }
  }

  private async getStreamMetrics(
    streamIds: string[]
  ): Promise<StreamMetrics[]> {
    const metrics: StreamMetrics[] = [];

    for (const streamId of streamIds) {
      const stream = this.streamAnalytics.getStream(streamId);
      if (stream) {
        metrics.push({
          streamId,
          eventsPerSecond: stream.getCurrentThroughput(),
          totalEvents: stream.getTotalEvents(),
          avgLatency: stream.getAverageLatency(),
          errorRate: stream.getErrorRate(),
          status: stream.getStatus(),
        });
      }
    }

    return metrics;
  }

  private async getAggregatedMetrics(
    aggregations: AggregationConfig[],
    timeRange: TimeRange
  ): Promise<AggregatedMetric[]> {
    const results: AggregatedMetric[] = [];

    for (const config of aggregations) {
      const aggregator = this.streamAnalytics.getAggregator(
        config.aggregatorId
      );
      if (aggregator) {
        const currentTime = Date.now();
        const aggregates = aggregator.getAggregates(currentTime);

        results.push({
          id: config.id,
          name: config.name,
          type: config.type,
          value: this.extractAggregateValue(aggregates, config),
          trend: await this.calculateTrend(config, timeRange),
          sparkline: await this.generateSparkline(config, timeRange),
        });
      }
    }

    return results;
  }

  private buildWidgets(
    widgetConfigs: WidgetConfig[],
    metrics: any[]
  ): DashboardWidget[] {
    return widgetConfigs.map(config => {
      switch (config.type) {
        case 'METRIC_CARD':
          return this.buildMetricCard(config, metrics);
        case 'TIME_SERIES':
          return this.buildTimeSeries(config, metrics);
        case 'HEATMAP':
          return this.buildHeatmap(config, metrics);
        case 'GAUGE':
          return this.buildGauge(config, metrics);
        case 'TABLE':
          return this.buildTable(config, metrics);
        default:
          return this.buildDefaultWidget(config);
      }
    });
  }
}

// ✅ FOCUS: Stream command handler
@CommandHandler(StartAnalyticsStreamCommand)
export class StartAnalyticsStreamHandler {
  constructor(
    private readonly streamAnalytics: StreamAnalyticsEngine,
    private readonly eventBus: EventBus
  ) {}

  async execute(
    command: StartAnalyticsStreamCommand
  ): Promise<Result<StreamStartResult, Error>> {
    try {
      // Validate stream configuration
      const validationResult = this.validateStreamConfig(command.streamConfig);
      if (validationResult.isFailure()) {
        return Result.fail(validationResult.error);
      }

      // Start the analytics stream
      const stream = await this.streamAnalytics.startStream(
        command.streamConfig
      );

      // Apply analytics rules
      for (const rule of command.analyticsRules) {
        await stream.addRule(rule);
      }

      // Publish stream started event
      await this.eventBus.publish(
        new AnalyticsStreamStartedEvent(
          command.streamId,
          command.streamConfig,
          command.analyticsRules
        )
      );

      return Result.ok({
        streamId: command.streamId,
        status: 'STARTED',
        startTime: new Date(),
        config: command.streamConfig,
      });
    } catch (error) {
      return Result.fail(error as Error);
    }
  }

  private validateStreamConfig(
    config: StreamConfiguration
  ): Result<void, Error> {
    // Validate event types
    if (!config.eventTypes || config.eventTypes.length === 0) {
      return Result.fail(
        new Error('At least one event type must be specified')
      );
    }

    // Validate windows
    if (config.windows) {
      for (const window of config.windows) {
        if (!this.isValidTimeWindow(window.size)) {
          return Result.fail(new Error(`Invalid window size: ${window.size}`));
        }
      }
    }

    // Validate batch size
    if (
      config.batchSize &&
      (config.batchSize < 1 || config.batchSize > 10000)
    ) {
      return Result.fail(new Error('Batch size must be between 1 and 10000'));
    }

    return Result.ok(undefined);
  }
}

// ✅ FOCUS: Complex event processing patterns
export class CEPPatternMatcher {
  private patterns: Map<string, CompiledPattern> = new Map();

  registerPattern(pattern: CEPPattern): void {
    const compiled = this.compilePattern(pattern);
    this.patterns.set(pattern.id, compiled);
  }

  async match(events: AnalyticsEvent[]): Promise<PatternMatch[]> {
    const matches: PatternMatch[] = [];

    for (const [patternId, pattern] of this.patterns) {
      const patternMatches = await this.matchPattern(events, pattern);
      matches.push(...patternMatches);
    }

    return matches;
  }

  private compilePattern(pattern: CEPPattern): CompiledPattern {
    // Compile pattern into efficient matching structure
    return {
      id: pattern.id,
      stateMachine: this.buildStateMachine(pattern),
      timeConstraints: pattern.timeConstraints,
      correlationFields: pattern.correlationFields,
    };
  }

  private buildStateMachine(pattern: CEPPattern): StateMachine {
    // Build finite state machine for pattern matching
    const states: State[] = [];
    const transitions: Transition[] = [];

    // Convert pattern definition to state machine
    for (let i = 0; i < pattern.sequence.length; i++) {
      const step = pattern.sequence[i];
      states.push({
        id: `state-${i}`,
        type:
          i === 0
            ? 'START'
            : i === pattern.sequence.length - 1
              ? 'END'
              : 'INTERMEDIATE',
        condition: step.condition,
      });

      if (i < pattern.sequence.length - 1) {
        transitions.push({
          from: `state-${i}`,
          to: `state-${i + 1}`,
          condition: step.condition,
          timeConstraint: step.timeConstraint,
        });
      }
    }

    return { states, transitions, currentState: 'state-0' };
  }
}
```

## Key Features

- **Stream Processing**: High-throughput event stream processing with batching
- **Windowed Aggregations**: Sliding, tumbling, and session windows for
  time-series analysis
- **Complex Event Processing**: Pattern matching, sequence detection, and
  correlation
- **Real-time Dashboards**: Live data visualization with sub-second updates
- **Anomaly Detection**: Statistical and ML-based anomaly detection in streams
- **Multi-source Analytics**: Combining data from multiple event streams
- **Performance Optimization**: Efficient batch processing and caching
  strategies
- **Flexible Alerting**: Rule-based alerts with complex conditions

## Usage Examples

```typescript
// Initialize stream analytics
const streamAnalytics = new StreamAnalyticsEngine(
  eventStore,
  projectionEngine,
  metricsCollector
);

// Configure and start analytics stream
const streamConfig: StreamConfiguration = {
  streamId: 'order-analytics',
  eventTypes: [
    'OrderCreated',
    'OrderUpdated',
    'OrderCompleted',
    'OrderCancelled',
  ],
  windows: [
    { type: 'TUMBLING', size: '1m' },
    { type: 'SLIDING', size: '5m', slide: '1m' },
    { type: 'SESSION', gap: '30s' },
  ],
  batchSize: 1000,
  maxConcurrency: 5,
  transformations: [
    { type: 'ENRICH', source: 'customerService' },
    { type: 'FILTER', condition: 'amount > 100' },
  ],
};

const analyticsRules: AnalyticsRule[] = [
  {
    id: 'high-value-orders',
    type: 'THRESHOLD',
    condition: 'SUM(amount) > 10000',
    window: '5m',
    action: 'ALERT',
  },
  {
    id: 'order-velocity',
    type: 'PATTERN',
    pattern: 'ORDER_SPIKE',
    condition: 'COUNT(*) > 100',
    window: '1m',
  },
];

const startCommand = new StartAnalyticsStreamCommand(
  'order-analytics-stream',
  streamConfig,
  analyticsRules
);

await commandBus.execute(startCommand);

// Query real-time dashboard
const dashboardQuery = new GetRealTimeDashboardQuery(
  'executive-dashboard',
  { start: new Date(Date.now() - 3600000), end: new Date() },
  1000 // Refresh every second
);

const dashboard = await queryBus.execute(dashboardQuery);

// Set up CEP patterns
const patternMatcher = new CEPPatternMatcher();
patternMatcher.registerPattern({
  id: 'fraud-pattern',
  sequence: [
    { eventType: 'OrderCreated', condition: 'amount > 1000' },
    {
      eventType: 'OrderCreated',
      condition: 'amount > 1000',
      timeConstraint: '1m',
    },
    {
      eventType: 'OrderCreated',
      condition: 'amount > 1000',
      timeConstraint: '1m',
    },
  ],
  correlationFields: ['customerId'],
  action: 'ALERT_FRAUD_TEAM',
});
```

## Common Pitfalls

- **Memory Management**: Monitor memory usage with large windows and high-volume
  streams
- **Late Arriving Events**: Handle out-of-order events with appropriate
  watermarking
- **Window Boundaries**: Be careful with window alignment and time zone
  considerations
- **Backpressure**: Implement proper backpressure handling for high-volume
  streams
- **State Management**: Persist window state for fault tolerance
- **Query Performance**: Optimize dashboard queries to avoid impacting stream
  processing

## Related Examples

- [Enterprise Saga Orchestration](./example-1.md) - Complex workflows
- [AI-Enhanced CQRS](./example-2.md) - Machine learning integration
- [Distributed Tracing](../intermediate/example-3.md) - Observability
- [Event Integration](../intermediate/example-1.md) - Event-driven patterns
