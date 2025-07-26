# Event Stream Processing with Real-time Analytics

**Version**: 1.0.0 **Package**: @vytches/ddd-events **Complexity**: advanced
**Domain**: Architecture **Patterns**: event-stream-processing,
real-time-analytics, event-aggregation, windowing **Dependencies**:
@vytches/ddd-events, @vytches/ddd-utils, @vytches/ddd-logging

## Description

Advanced event stream processing system with real-time analytics, windowing, and
complex event processing capabilities. This example demonstrates
enterprise-grade stream processing patterns for high-throughput event analysis,
anomaly detection, and real-time business intelligence.

## Business Context

Modern applications generate massive event streams that require real-time
analysis for business intelligence, fraud detection, and operational monitoring.
Stream processing enables immediate insights from event data through windowing,
aggregation, and pattern matching while maintaining high throughput and low
latency.

## Code Example

```typescript
// advanced-stream-processor.ts
import {
  DomainEvent,
  UnifiedEventBus,
  IEventHandler,
} from '@vytches/ddd-events';
import { EntityId } from '@vytches/ddd-value-objects';
import { Result, AsyncResult } from '@vytches/ddd-utils';
import { Logger } from '@vytches/ddd-logging';

// Stream processing events
export class TransactionProcessedEvent extends DomainEvent {
  constructor(
    public readonly transactionId: EntityId,
    public readonly userId: EntityId,
    public readonly amount: number,
    public readonly currency: string,
    public readonly merchantId: EntityId,
    public readonly location: { lat: number; lng: number; country: string },
    public readonly timestamp: Date,
    correlationId?: string
  ) {
    super('TransactionProcessed', transactionId.value, correlationId);
    this.metadata = {
      amount,
      currency,
      merchantId: merchantId.value,
      location,
      userId: userId.value,
    };
  }
}

export class UserLoginEvent extends DomainEvent {
  constructor(
    public readonly userId: EntityId,
    public readonly sessionId: EntityId,
    public readonly ipAddress: string,
    public readonly userAgent: string,
    public readonly location: { lat: number; lng: number; country: string },
    public readonly timestamp: Date,
    correlationId?: string
  ) {
    super('UserLogin', userId.value, correlationId);
    this.metadata = {
      sessionId: sessionId.value,
      ipAddress,
      location,
      userAgent,
    };
  }
}

export class ProductViewedEvent extends DomainEvent {
  constructor(
    public readonly userId: EntityId,
    public readonly productId: EntityId,
    public readonly category: string,
    public readonly price: number,
    public readonly sessionId: EntityId,
    public readonly timestamp: Date,
    correlationId?: string
  ) {
    super('ProductViewed', productId.value, correlationId);
    this.metadata = {
      userId: userId.value,
      category,
      price,
      sessionId: sessionId.value,
    };
  }
}

// ⭐ FOCUS: Stream processing windows and aggregations
export interface TimeWindow {
  start: Date;
  end: Date;
  duration: number;
}

export interface StreamingMetric {
  metricName: string;
  value: number;
  timestamp: Date;
  window: TimeWindow;
  dimensions: Record<string, any>;
}

export interface StreamProcessor<TEvent extends DomainEvent> {
  process(event: TEvent): Promise<Result<StreamingMetric[], Error>>;
  getWindowedMetrics(
    windowSize: number
  ): Promise<Result<StreamingMetric[], Error>>;
}

// ⭐ FOCUS: Windowing strategy implementation
export class SlidingWindow {
  private events: Array<{ event: DomainEvent; timestamp: Date }> = [];
  private readonly maxAge: number;

  constructor(windowSizeMs: number) {
    this.maxAge = windowSizeMs;
  }

  addEvent(event: DomainEvent): void {
    const now = new Date();
    this.events.push({ event, timestamp: now });
    this.cleanup(now);
  }

  getEvents(since?: Date): DomainEvent[] {
    const cutoff = since || new Date(Date.now() - this.maxAge);
    return this.events.filter(e => e.timestamp >= cutoff).map(e => e.event);
  }

  private cleanup(now: Date): void {
    const cutoff = new Date(now.getTime() - this.maxAge);
    this.events = this.events.filter(e => e.timestamp >= cutoff);
  }

  getWindow(endTime: Date): TimeWindow {
    const start = new Date(endTime.getTime() - this.maxAge);
    return {
      start,
      end: endTime,
      duration: this.maxAge,
    };
  }
}

// ⭐ FOCUS: Transaction analytics processor
export class TransactionAnalyticsProcessor
  implements StreamProcessor<TransactionProcessedEvent>
{
  private readonly logger = Logger.forContext('TransactionAnalyticsProcessor');
  private readonly slidingWindow = new SlidingWindow(5 * 60 * 1000); // 5 minutes
  private readonly suspiciousPatterns = new Map<string, any>();

  async process(
    event: TransactionProcessedEvent
  ): Promise<Result<StreamingMetric[], Error>> {
    try {
      this.slidingWindow.addEvent(event);

      const metrics: StreamingMetric[] = [];
      const now = new Date();
      const window = this.slidingWindow.getWindow(now);

      // ⭐ FOCUS: Real-time transaction volume analysis
      const volumeMetric = await this.calculateTransactionVolume(window);
      metrics.push(volumeMetric);

      // ⭐ FOCUS: Fraud detection patterns
      const fraudMetrics = await this.detectFraudPatterns(event, window);
      metrics.push(...fraudMetrics);

      // ⭐ FOCUS: Geographic analysis
      const geoMetrics = await this.analyzeGeographicPatterns(event, window);
      metrics.push(...geoMetrics);

      // ⭐ FOCUS: Amount-based analytics
      const amountMetrics = await this.analyzeTransactionAmounts(event, window);
      metrics.push(...amountMetrics);

      this.logger.info('Transaction processed in stream', {
        transactionId: event.transactionId.value,
        userId: event.userId.value,
        amount: event.amount,
        metricsGenerated: metrics.length,
        window: {
          start: window.start,
          end: window.end,
          duration: window.duration,
        },
      });

      return Result.ok(metrics);
    } catch (error) {
      this.logger.error('Failed to process transaction event', {
        error: error,
        transactionId: event.transactionId.value,
      });
      return Result.fail(
        new Error(`Transaction processing failed: ${error.message}`)
      );
    }
  }

  private async calculateTransactionVolume(
    window: TimeWindow
  ): Promise<StreamingMetric> {
    const events = this.slidingWindow.getEvents(
      window.start
    ) as TransactionProcessedEvent[];
    const totalAmount = events.reduce((sum, e) => sum + e.amount, 0);
    const transactionCount = events.length;

    return {
      metricName: 'transaction_volume',
      value: totalAmount,
      timestamp: new Date(),
      window,
      dimensions: {
        count: transactionCount,
        avgAmount: transactionCount > 0 ? totalAmount / transactionCount : 0,
        currency: events[0]?.currency || 'USD',
      },
    };
  }

  private async detectFraudPatterns(
    currentEvent: TransactionProcessedEvent,
    window: TimeWindow
  ): Promise<StreamingMetric[]> {
    const events = this.slidingWindow.getEvents(
      window.start
    ) as TransactionProcessedEvent[];
    const userEvents = events.filter(e => e.userId.equals(currentEvent.userId));

    const metrics: StreamingMetric[] = [];

    // ⭐ FOCUS: Rapid transaction pattern (velocity fraud)
    const rapidTransactions = userEvents.length;
    if (rapidTransactions > 10) {
      // More than 10 transactions in 5 minutes
      metrics.push({
        metricName: 'fraud_velocity_alert',
        value: rapidTransactions,
        timestamp: new Date(),
        window,
        dimensions: {
          userId: currentEvent.userId.value,
          alertType: 'high_velocity',
          threshold: 10,
          severity: 'high',
        },
      });
    }

    // ⭐ FOCUS: Geographic dispersion pattern
    const locations = userEvents.map(e => e.location);
    const uniqueCountries = new Set(locations.map(l => l.country)).size;

    if (uniqueCountries > 2) {
      // Transactions from more than 2 countries
      metrics.push({
        metricName: 'fraud_geographic_alert',
        value: uniqueCountries,
        timestamp: new Date(),
        window,
        dimensions: {
          userId: currentEvent.userId.value,
          alertType: 'geographic_dispersion',
          countries: Array.from(new Set(locations.map(l => l.country))),
          severity: 'medium',
        },
      });
    }

    // ⭐ FOCUS: Large amount pattern
    if (currentEvent.amount > 10000) {
      // Large transaction
      const recentLargeTransactions = userEvents.filter(
        e => e.amount > 5000
      ).length;

      metrics.push({
        metricName: 'fraud_amount_alert',
        value: currentEvent.amount,
        timestamp: new Date(),
        window,
        dimensions: {
          userId: currentEvent.userId.value,
          alertType: 'large_amount',
          recentLargeCount: recentLargeTransactions,
          severity: currentEvent.amount > 50000 ? 'critical' : 'high',
        },
      });
    }

    return metrics;
  }

  private async analyzeGeographicPatterns(
    currentEvent: TransactionProcessedEvent,
    window: TimeWindow
  ): Promise<StreamingMetric[]> {
    const events = this.slidingWindow.getEvents(
      window.start
    ) as TransactionProcessedEvent[];
    const countryStats = new Map<
      string,
      { count: number; totalAmount: number }
    >();

    events.forEach(event => {
      const country = event.location.country;
      const existing = countryStats.get(country) || {
        count: 0,
        totalAmount: 0,
      };
      countryStats.set(country, {
        count: existing.count + 1,
        totalAmount: existing.totalAmount + event.amount,
      });
    });

    const metrics: StreamingMetric[] = [];

    countryStats.forEach((stats, country) => {
      metrics.push({
        metricName: 'geographic_transaction_stats',
        value: stats.totalAmount,
        timestamp: new Date(),
        window,
        dimensions: {
          country,
          transactionCount: stats.count,
          avgAmount: stats.totalAmount / stats.count,
        },
      });
    });

    return metrics;
  }

  private async analyzeTransactionAmounts(
    currentEvent: TransactionProcessedEvent,
    window: TimeWindow
  ): Promise<StreamingMetric[]> {
    const events = this.slidingWindow.getEvents(
      window.start
    ) as TransactionProcessedEvent[];
    const amounts = events.map(e => e.amount).sort((a, b) => a - b);

    if (amounts.length === 0) return [];

    const median = amounts[Math.floor(amounts.length / 2)];
    const p90 = amounts[Math.floor(amounts.length * 0.9)];
    const p99 = amounts[Math.floor(amounts.length * 0.99)];

    return [
      {
        metricName: 'transaction_amount_distribution',
        value: median,
        timestamp: new Date(),
        window,
        dimensions: {
          median,
          p90,
          p99,
          min: amounts[0],
          max: amounts[amounts.length - 1],
          count: amounts.length,
        },
      },
    ];
  }

  async getWindowedMetrics(
    windowSize: number
  ): Promise<Result<StreamingMetric[], Error>> {
    try {
      const now = new Date();
      const window = {
        start: new Date(now.getTime() - windowSize),
        end: now,
        duration: windowSize,
      };

      const events = this.slidingWindow.getEvents(
        window.start
      ) as TransactionProcessedEvent[];
      const metrics: StreamingMetric[] = [];

      // Aggregate metrics for the window
      const totalAmount = events.reduce((sum, e) => sum + e.amount, 0);
      const uniqueUsers = new Set(events.map(e => e.userId.value)).size;
      const uniqueMerchants = new Set(events.map(e => e.merchantId.value)).size;

      metrics.push({
        metricName: 'window_summary',
        value: totalAmount,
        timestamp: now,
        window,
        dimensions: {
          transactionCount: events.length,
          uniqueUsers,
          uniqueMerchants,
          avgTransactionAmount:
            events.length > 0 ? totalAmount / events.length : 0,
        },
      });

      return Result.ok(metrics);
    } catch (error) {
      return Result.fail(
        new Error(`Failed to get windowed metrics: ${error.message}`)
      );
    }
  }
}

// ⭐ FOCUS: User behavior analytics processor
export class UserBehaviorAnalyticsProcessor {
  private readonly logger = Logger.forContext('UserBehaviorAnalyticsProcessor');
  private readonly sessionWindow = new SlidingWindow(30 * 60 * 1000); // 30 minutes
  private readonly userSessions = new Map<string, Array<DomainEvent>>();

  async processUserEvent(
    event: UserLoginEvent | ProductViewedEvent
  ): Promise<Result<StreamingMetric[], Error>> {
    try {
      this.sessionWindow.addEvent(event);

      const userId = 'userId' in event ? event.userId.value : event.aggregateId;
      const sessionId =
        'sessionId' in event ? event.sessionId.value : 'unknown';

      // Track user session
      const sessionKey = `${userId}:${sessionId}`;
      if (!this.userSessions.has(sessionKey)) {
        this.userSessions.set(sessionKey, []);
      }
      this.userSessions.get(sessionKey)!.push(event);

      const metrics: StreamingMetric[] = [];
      const now = new Date();
      const window = this.sessionWindow.getWindow(now);

      // ⭐ FOCUS: Session analytics
      if (event.eventType === 'ProductViewed') {
        const productEvent = event as ProductViewedEvent;
        const sessionMetrics = await this.analyzeUserSession(
          userId,
          sessionId,
          window
        );
        metrics.push(...sessionMetrics);

        const behaviorMetrics = await this.analyzePurchaseBehavior(
          productEvent,
          window
        );
        metrics.push(...behaviorMetrics);
      }

      // ⭐ FOCUS: Login pattern analysis
      if (event.eventType === 'UserLogin') {
        const loginEvent = event as UserLoginEvent;
        const loginMetrics = await this.analyzeLoginPatterns(
          loginEvent,
          window
        );
        metrics.push(...loginMetrics);
      }

      return Result.ok(metrics);
    } catch (error) {
      this.logger.error('Failed to process user behavior event', {
        error: error,
        eventType: event.eventType,
      });
      return Result.fail(
        new Error(`User behavior processing failed: ${error.message}`)
      );
    }
  }

  private async analyzeUserSession(
    userId: string,
    sessionId: string,
    window: TimeWindow
  ): Promise<StreamingMetric[]> {
    const sessionKey = `${userId}:${sessionId}`;
    const sessionEvents = this.userSessions.get(sessionKey) || [];

    const productViews = sessionEvents.filter(
      e => e.eventType === 'ProductViewed'
    ) as ProductViewedEvent[];
    const categories = new Set(productViews.map(e => e.category));
    const totalValue = productViews.reduce((sum, e) => sum + e.price, 0);

    return [
      {
        metricName: 'user_session_activity',
        value: productViews.length,
        timestamp: new Date(),
        window,
        dimensions: {
          userId,
          sessionId,
          categoriesViewed: Array.from(categories),
          totalViewedValue: totalValue,
          sessionDuration:
            sessionEvents.length > 1
              ? sessionEvents[sessionEvents.length - 1].timestamp.getTime() -
                sessionEvents[0].timestamp.getTime()
              : 0,
        },
      },
    ];
  }

  private async analyzePurchaseBehavior(
    event: ProductViewedEvent,
    window: TimeWindow
  ): Promise<StreamingMetric[]> {
    const allEvents = this.sessionWindow.getEvents(
      window.start
    ) as ProductViewedEvent[];
    const userEvents = allEvents.filter(e => e.userId.equals(event.userId));

    // Category affinity analysis
    const categoryViews = new Map<string, number>();
    userEvents.forEach(e => {
      categoryViews.set(e.category, (categoryViews.get(e.category) || 0) + 1);
    });

    const topCategories = Array.from(categoryViews.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    return [
      {
        metricName: 'purchase_intent_signal',
        value: userEvents.length,
        timestamp: new Date(),
        window,
        dimensions: {
          userId: event.userId.value,
          currentCategory: event.category,
          currentPrice: event.price,
          topCategories: topCategories.map(([cat, count]) => ({
            category: cat,
            views: count,
          })),
          browsingSimilarItems: userEvents.filter(
            e => e.category === event.category
          ).length,
          priceRange: this.categorizePrice(event.price),
        },
      },
    ];
  }

  private async analyzeLoginPatterns(
    event: UserLoginEvent,
    window: TimeWindow
  ): Promise<StreamingMetric[]> {
    const allLoginEvents = this.sessionWindow.getEvents(
      window.start
    ) as UserLoginEvent[];
    const userLogins = allLoginEvents.filter(e =>
      e.userId.equals(event.userId)
    );

    const uniqueIPs = new Set(userLogins.map(e => e.ipAddress));
    const uniqueCountries = new Set(userLogins.map(e => e.location.country));

    return [
      {
        metricName: 'user_login_pattern',
        value: userLogins.length,
        timestamp: new Date(),
        window,
        dimensions: {
          userId: event.userId.value,
          loginCount: userLogins.length,
          uniqueIPs: uniqueIPs.size,
          uniqueCountries: uniqueCountries.size,
          currentCountry: event.location.country,
          suspiciousActivity: uniqueIPs.size > 3 || uniqueCountries.size > 2,
        },
      },
    ];
  }

  private categorizePrice(price: number): string {
    if (price < 50) return 'low';
    if (price < 200) return 'medium';
    if (price < 1000) return 'high';
    return 'premium';
  }
}

// ⭐ FOCUS: Real-time analytics dashboard
export class RealTimeAnalyticsDashboard {
  private readonly logger = Logger.forContext('RealTimeAnalyticsDashboard');
  private readonly transactionProcessor = new TransactionAnalyticsProcessor();
  private readonly userBehaviorProcessor = new UserBehaviorAnalyticsProcessor();
  private readonly metrics = new Map<string, StreamingMetric[]>();

  constructor(private readonly eventBus: UnifiedEventBus) {
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // ⭐ FOCUS: Subscribe to real-time event streams
    this.eventBus.subscribe(
      'TransactionProcessed',
      async (event: TransactionProcessedEvent) => {
        const metricsResult = await this.transactionProcessor.process(event);
        if (metricsResult.isSuccess()) {
          this.updateDashboard('transactions', metricsResult.value);
        }
      }
    );

    this.eventBus.subscribe('UserLogin', async (event: UserLoginEvent) => {
      const metricsResult =
        await this.userBehaviorProcessor.processUserEvent(event);
      if (metricsResult.isSuccess()) {
        this.updateDashboard('user_behavior', metricsResult.value);
      }
    });

    this.eventBus.subscribe(
      'ProductViewed',
      async (event: ProductViewedEvent) => {
        const metricsResult =
          await this.userBehaviorProcessor.processUserEvent(event);
        if (metricsResult.isSuccess()) {
          this.updateDashboard('user_behavior', metricsResult.value);
        }
      }
    );
  }

  private updateDashboard(
    category: string,
    newMetrics: StreamingMetric[]
  ): void {
    const existing = this.metrics.get(category) || [];
    existing.push(...newMetrics);

    // Keep only last 1000 metrics per category
    if (existing.length > 1000) {
      existing.splice(0, existing.length - 1000);
    }

    this.metrics.set(category, existing);

    // ⭐ FOCUS: Log real-time analytics
    this.logger.info('Dashboard updated with real-time metrics', {
      category,
      newMetricsCount: newMetrics.length,
      totalMetricsInCategory: existing.length,
      latestMetrics: newMetrics.map(m => ({
        name: m.metricName,
        value: m.value,
        timestamp: m.timestamp,
      })),
    });
  }

  async getDashboardData(timeRange?: {
    start: Date;
    end: Date;
  }): Promise<Record<string, any>> {
    const now = new Date();
    const defaultStart = new Date(now.getTime() - 60 * 60 * 1000); // Last hour

    const start = timeRange?.start || defaultStart;
    const end = timeRange?.end || now;

    const dashboardData: Record<string, any> = {};

    for (const [category, metrics] of this.metrics.entries()) {
      const filteredMetrics = metrics.filter(
        m => m.timestamp >= start && m.timestamp <= end
      );

      dashboardData[category] = {
        totalMetrics: filteredMetrics.length,
        metricsByType: this.groupMetricsByType(filteredMetrics),
        timeRange: { start, end },
        lastUpdated:
          metrics.length > 0 ? metrics[metrics.length - 1].timestamp : null,
      };
    }

    return dashboardData;
  }

  private groupMetricsByType(metrics: StreamingMetric[]): Record<string, any> {
    const grouped = new Map<string, StreamingMetric[]>();

    metrics.forEach(metric => {
      if (!grouped.has(metric.metricName)) {
        grouped.set(metric.metricName, []);
      }
      grouped.get(metric.metricName)!.push(metric);
    });

    const result: Record<string, any> = {};

    grouped.forEach((metricList, metricName) => {
      result[metricName] = {
        count: metricList.length,
        latest: metricList[metricList.length - 1],
        values: metricList.map(m => ({
          value: m.value,
          timestamp: m.timestamp,
        })),
      };
    });

    return result;
  }

  // ⭐ FOCUS: Alert system for anomalies
  async checkForAnomalies(): Promise<
    Array<{ type: string; severity: string; message: string; data: any }>
  > {
    const alerts: Array<{
      type: string;
      severity: string;
      message: string;
      data: any;
    }> = [];

    // Check transaction metrics for anomalies
    const transactionMetrics = this.metrics.get('transactions') || [];
    const recentTransactions = transactionMetrics.filter(
      m => Date.now() - m.timestamp.getTime() < 5 * 60 * 1000 // Last 5 minutes
    );

    // High fraud alerts
    const fraudAlerts = recentTransactions.filter(
      m =>
        m.metricName.includes('fraud') && m.dimensions?.severity === 'critical'
    );

    fraudAlerts.forEach(alert => {
      alerts.push({
        type: 'fraud_detection',
        severity: 'critical',
        message: `Critical fraud pattern detected: ${alert.dimensions?.alertType}`,
        data: alert.dimensions,
      });
    });

    // High volume alerts
    const volumeMetrics = recentTransactions.filter(
      m => m.metricName === 'transaction_volume'
    );
    if (volumeMetrics.length > 0) {
      const avgVolume =
        volumeMetrics.reduce((sum, m) => sum + m.value, 0) /
        volumeMetrics.length;
      if (avgVolume > 1000000) {
        // $1M+ in 5 minutes
        alerts.push({
          type: 'high_volume',
          severity: 'warning',
          message: `High transaction volume detected: $${avgVolume.toLocaleString()}`,
          data: { avgVolume, timeWindow: '5_minutes' },
        });
      }
    }

    return alerts;
  }
}
```

## Usage Examples

```typescript
// Real-time analytics setup
async function setupRealTimeAnalytics() {
  const eventBus = new UnifiedEventBus();
  const dashboard = new RealTimeAnalyticsDashboard(eventBus);

  // ⭐ FOCUS: Simulate high-frequency events
  const userId = EntityId.createUuid();
  const merchantId = EntityId.createUuid();
  const sessionId = EntityId.createUuid();

  // Generate transaction events
  for (let i = 0; i < 100; i++) {
    const transaction = new TransactionProcessedEvent(
      EntityId.createUuid(),
      userId,
      Math.random() * 1000 + 10,
      'USD',
      merchantId,
      { lat: 40.7128, lng: -74.006, country: 'US' },
      new Date()
    );

    await eventBus.publish(transaction);
  }

  // Generate user behavior events
  for (let i = 0; i < 50; i++) {
    const productView = new ProductViewedEvent(
      userId,
      EntityId.createUuid(),
      'electronics',
      Math.random() * 500 + 100,
      sessionId,
      new Date()
    );

    await eventBus.publish(productView);
  }

  // ⭐ FOCUS: Get real-time dashboard data
  const dashboardData = await dashboard.getDashboardData();
  console.log('Real-time analytics:', JSON.stringify(dashboardData, null, 2));

  // ⭐ FOCUS: Check for anomalies
  const anomalies = await dashboard.checkForAnomalies();
  if (anomalies.length > 0) {
    console.log('Anomalies detected:', anomalies);
  }
}

setupRealTimeAnalytics();
```

## Key Features

- **Real-time Stream Processing**: Process events as they arrive with low
  latency
- **Windowing Operations**: Time-based and count-based windowing for analytics
- **Fraud Detection**: Real-time pattern matching for suspicious activities
- **User Behavior Analytics**: Session tracking and purchase intent analysis
- **Geographic Analysis**: Location-based transaction and user patterns
- **Anomaly Detection**: Automated alert system for unusual patterns
- **Performance Optimized**: Sliding windows with automatic cleanup
- **Scalable Architecture**: Designed for high-throughput event streams

## Performance Considerations

- **Window Size**: Balance between accuracy and memory usage
- **Event Cleanup**: Automatic cleanup prevents memory leaks
- **Batch Processing**: Group related events for efficient processing
- **Index Optimization**: Use appropriate data structures for fast lookups

## Common Pitfalls

- **Window Overflow**: Monitor memory usage with high-frequency events
- **Clock Skew**: Handle out-of-order events properly
- **State Management**: Ensure proper cleanup of windowed state
- **Backpressure**: Handle situations where processing can't keep up with event
  rate

## Related Examples

- [Event Sourcing with Snapshots](./example-1.md)
- [Batch Event Processing](../intermediate/example-1.md)
- [Context-Aware Event Processing](../basic/example-3.md)
