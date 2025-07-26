# Event Stream Processing

**Version**: 1.0.0 **Package**: @vytches/ddd-projections **Complexity**:
intermediate **Domain**: Event Sourcing **Patterns**: Stream processing,
filtering, aggregations, windowing **Dependencies**: @vytches/ddd-projections,
@vytches/ddd-events, @vytches/ddd-utils

## Description

Advanced event stream processing with filtering, aggregations, and windowing
capabilities. This example demonstrates how to process event streams with
complex business logic, temporal windows, real-time aggregations, and pattern
matching for sophisticated read model generation.

## Business Context

Enterprise applications require sophisticated stream processing:

- Real-time business analytics and KPI calculations
- Time-based aggregations (hourly, daily, monthly summaries)
- Event pattern detection and correlation
- Anomaly detection and alerting
- Complex business rule evaluation
- Multi-dimensional data analysis

This system enables real-time business intelligence through advanced event
stream processing.

## Code Example

```typescript
// event-stream-processing.ts
import {
  ProjectionBase,
  StreamProcessor,
  EventFilter,
  EventAggregator,
  WindowProcessor,
  PatternMatcher,
} from '@vytches/ddd-projections';
import { IDomainEvent } from '@vytches/ddd-events';
import { Result } from '@vytches/ddd-utils';
import {
  OrderData,
  ProductData,
  UserData,
  StreamWindow,
  AggregationResult,
  BusinessMetrics,
  AlertCondition,
  PatternDefinition,
  StreamProcessorConfig,
  WindowConfig,
} from '../types';

// ✅ FOCUS: Advanced Event Stream Processing Projection
export class BusinessAnalyticsProjection extends ProjectionBase<any> {
  private streamProcessor: StreamProcessor;
  private windowProcessor: WindowProcessor;
  private patternMatcher: PatternMatcher;
  private eventAggregator: EventAggregator;

  constructor() {
    super('BusinessAnalyticsProjection', 'v1.0');

    // Initialize complex state structure
    this.setState({
      // Real-time metrics
      realTimeMetrics: {
        ordersPerSecond: 0,
        revenuePerMinute: 0,
        activeUsers: new Set<string>(),
        conversionRate: 0,
        averageOrderValue: 0,
      },

      // Time-windowed data
      timeWindows: {
        hourlyWindows: new Map<string, BusinessMetrics>(),
        dailyWindows: new Map<string, BusinessMetrics>(),
        monthlyWindows: new Map<string, BusinessMetrics>(),
      },

      // Pattern detection results
      detectedPatterns: new Map<string, any[]>(),

      // Alerts and anomalies
      activeAlerts: new Map<string, AlertCondition>(),
      anomalies: [],

      // Aggregated data
      customerSegments: new Map<string, any>(),
      productPerformance: new Map<string, any>(),
      geographicMetrics: new Map<string, any>(),

      // Processing metadata
      lastProcessed: new Date(),
      eventCount: 0,
      processingRate: 0,
    });

    this.setupStreamProcessing();
  }

  private setupStreamProcessing(): void {
    // Configure stream processor
    this.streamProcessor = new StreamProcessor({
      bufferSize: 10000,
      flushInterval: 1000, // 1 second
      enableBackpressure: true,
      parallelProcessing: true,
    });

    // Configure window processor for time-based aggregations
    this.windowProcessor = new WindowProcessor({
      windows: [
        {
          name: 'hourly',
          size: 60 * 60 * 1000, // 1 hour
          slide: 5 * 60 * 1000, // 5 minutes
          type: 'sliding',
        },
        {
          name: 'daily',
          size: 24 * 60 * 60 * 1000, // 1 day
          slide: 60 * 60 * 1000, // 1 hour
          type: 'sliding',
        },
        {
          name: 'monthly',
          size: 30 * 24 * 60 * 60 * 1000, // 30 days
          slide: 24 * 60 * 60 * 1000, // 1 day
          type: 'tumbling',
        },
      ],
    });

    // Configure pattern matcher
    this.patternMatcher = new PatternMatcher({
      patterns: [
        this.createHighValueCustomerPattern(),
        this.createAbandonedCartPattern(),
        this.createFraudDetectionPattern(),
        this.createChurnRiskPattern(),
      ],
    });

    // Configure event aggregator
    this.eventAggregator = new EventAggregator({
      aggregations: [
        { field: 'total', operation: 'sum', groupBy: ['customerId'] },
        { field: 'quantity', operation: 'sum', groupBy: ['productId'] },
        { field: 'total', operation: 'avg', groupBy: ['category'] },
        { field: 'processingTime', operation: 'percentile', percentile: 95 },
      ],
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Window completion handlers
    this.windowProcessor.on('windowCompleted', (window: StreamWindow) => {
      this.handleWindowCompleted(window);
    });

    // Pattern detection handlers
    this.patternMatcher.on(
      'patternDetected',
      (pattern: string, events: IDomainEvent[]) => {
        this.handlePatternDetected(pattern, events);
      }
    );

    // Aggregation completion handlers
    this.eventAggregator.on(
      'aggregationCompleted',
      (result: AggregationResult) => {
        this.handleAggregationCompleted(result);
      }
    );
  }

  async handle(event: IDomainEvent): Promise<void> {
    const startTime = performance.now();

    try {
      // Add event to stream processor
      await this.streamProcessor.addEvent(event);

      // Process through filters
      const filteredEvents = await this.applyEventFilters([event]);

      if (filteredEvents.length === 0) {
        return; // Event filtered out
      }

      // Process each filtered event
      for (const filteredEvent of filteredEvents) {
        await this.processEventInternal(filteredEvent);

        // Add to window processor
        this.windowProcessor.addEvent(filteredEvent);

        // Add to pattern matcher
        this.patternMatcher.addEvent(filteredEvent);

        // Add to aggregator
        this.eventAggregator.addEvent(filteredEvent);
      }

      // Update processing metrics
      this.updateProcessingMetrics(startTime);
    } catch (error) {
      console.error(
        `Error in stream processing for event ${event.eventId}:`,
        error
      );
      throw error;
    }
  }

  private async applyEventFilters(
    events: IDomainEvent[]
  ): Promise<IDomainEvent[]> {
    const filters: EventFilter[] = [
      this.createRelevanceFilter(),
      this.createQualityFilter(),
      this.createBusinessHoursFilter(),
      this.createGeographicFilter(),
    ];

    let filteredEvents = events;

    for (const filter of filters) {
      filteredEvents = await filter.apply(filteredEvents);
    }

    return filteredEvents;
  }

  private async processEventInternal(event: IDomainEvent): Promise<void> {
    const currentState = this.getState();

    switch (event.eventType) {
      case 'OrderPlaced':
        await this.handleOrderPlaced(event, currentState);
        break;
      case 'OrderCompleted':
        await this.handleOrderCompleted(event, currentState);
        break;
      case 'UserActivity':
        await this.handleUserActivity(event, currentState);
        break;
      case 'ProductViewed':
        await this.handleProductViewed(event, currentState);
        break;
      case 'CartAbandoned':
        await this.handleCartAbandoned(event, currentState);
        break;
      default:
        // Handle unknown events
        await this.handleGenericEvent(event, currentState);
    }

    currentState.eventCount++;
    currentState.lastProcessed = new Date();
    this.setState(currentState);
  }

  private async handleOrderPlaced(
    event: IDomainEvent,
    state: any
  ): Promise<void> {
    const orderData = event.payload;

    // Update real-time metrics
    const orderValue = orderData.total || 0;
    state.realTimeMetrics.revenuePerMinute += orderValue;

    // Recalculate average order value
    const currentAvg = state.realTimeMetrics.averageOrderValue;
    const orderCount = this.getOrderCountFromRecentWindow();
    state.realTimeMetrics.averageOrderValue =
      (currentAvg * (orderCount - 1) + orderValue) / orderCount;

    // Update customer segmentation
    await this.updateCustomerSegmentation(
      orderData.customerId,
      orderValue,
      state
    );

    // Update geographic metrics
    if (orderData.shippingAddress?.country) {
      await this.updateGeographicMetrics(
        orderData.shippingAddress.country,
        orderValue,
        state
      );
    }

    // Check for high-value orders (potential alert)
    if (orderValue > 1000) {
      await this.checkHighValueOrderAlert(orderData, state);
    }

    console.log(`Processed order: ${orderData.orderId} - $${orderValue}`);
  }

  private async handleUserActivity(
    event: IDomainEvent,
    state: any
  ): Promise<void> {
    const activityData = event.payload;

    // Track active users
    state.realTimeMetrics.activeUsers.add(activityData.userId);

    // Calculate session metrics
    await this.updateSessionMetrics(activityData, state);

    // Update user engagement patterns
    await this.updateUserEngagementPatterns(activityData, state);
  }

  private async handleProductViewed(
    event: IDomainEvent,
    state: any
  ): Promise<void> {
    const viewData = event.payload;

    // Update product performance metrics
    const productMetrics = state.productPerformance.get(viewData.productId) || {
      views: 0,
      conversions: 0,
      conversionRate: 0,
      revenue: 0,
      categories: new Set(),
    };

    productMetrics.views++;

    if (viewData.category) {
      productMetrics.categories.add(viewData.category);
    }

    state.productPerformance.set(viewData.productId, productMetrics);
  }

  private handleWindowCompleted(window: StreamWindow): void {
    const state = this.getState();

    // Calculate metrics for the completed window
    const metrics = this.calculateWindowMetrics(window);

    // Store window results
    switch (window.name) {
      case 'hourly':
        state.timeWindows.hourlyWindows.set(window.windowId, metrics);
        break;
      case 'daily':
        state.timeWindows.dailyWindows.set(window.windowId, metrics);
        break;
      case 'monthly':
        state.timeWindows.monthlyWindows.set(window.windowId, metrics);
        break;
    }

    // Clean up old windows (keep last 100 of each type)
    this.cleanupOldWindows(state, 100);

    this.setState(state);
    console.log(`Window completed: ${window.name} (${window.windowId})`);
  }

  private handlePatternDetected(pattern: string, events: IDomainEvent[]): void {
    const state = this.getState();

    // Store detected pattern
    const existingPatterns = state.detectedPatterns.get(pattern) || [];
    existingPatterns.push({
      detectedAt: new Date(),
      events: events.map(e => ({
        id: e.eventId,
        type: e.eventType,
        timestamp: e.timestamp,
      })),
      confidence: this.calculatePatternConfidence(pattern, events),
    });

    state.detectedPatterns.set(pattern, existingPatterns);

    // Handle specific patterns
    switch (pattern) {
      case 'high-value-customer':
        this.handleHighValueCustomerPattern(events, state);
        break;
      case 'abandoned-cart':
        this.handleAbandonedCartPattern(events, state);
        break;
      case 'fraud-detection':
        this.handleFraudDetectionPattern(events, state);
        break;
      case 'churn-risk':
        this.handleChurnRiskPattern(events, state);
        break;
    }

    this.setState(state);
    console.log(`Pattern detected: ${pattern} with ${events.length} events`);
  }

  private handleAggregationCompleted(result: AggregationResult): void {
    const state = this.getState();

    // Update metrics based on aggregation results
    switch (result.aggregationType) {
      case 'revenue-by-customer':
        this.updateCustomerRevenueMetrics(result, state);
        break;
      case 'product-performance':
        this.updateProductPerformanceMetrics(result, state);
        break;
      case 'geographic-distribution':
        this.updateGeographicDistribution(result, state);
        break;
    }

    this.setState(state);
  }

  // Event Filters
  private createRelevanceFilter(): EventFilter {
    return {
      name: 'relevance-filter',
      apply: async (events: IDomainEvent[]): Promise<IDomainEvent[]> => {
        const relevantEventTypes = [
          'OrderPlaced',
          'OrderCompleted',
          'OrderCancelled',
          'UserActivity',
          'ProductViewed',
          'CartAbandoned',
          'PaymentProcessed',
          'UserRegistered',
        ];

        return events.filter(event =>
          relevantEventTypes.includes(event.eventType)
        );
      },
    };
  }

  private createQualityFilter(): EventFilter {
    return {
      name: 'quality-filter',
      apply: async (events: IDomainEvent[]): Promise<IDomainEvent[]> => {
        return events.filter(event => {
          // Filter out events with missing required fields
          if (!event.payload || !event.timestamp || !event.aggregateId) {
            console.warn(`Filtered out low-quality event: ${event.eventId}`);
            return false;
          }

          // Filter out very old events (older than 1 year)
          const eventDate = new Date(event.timestamp);
          const oneYearAgo = new Date();
          oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

          return eventDate >= oneYearAgo;
        });
      },
    };
  }

  private createBusinessHoursFilter(): EventFilter {
    return {
      name: 'business-hours-filter',
      apply: async (events: IDomainEvent[]): Promise<IDomainEvent[]> => {
        // Only apply business hours filtering to certain event types
        const businessHoursSensitiveEvents = [
          'OrderPlaced',
          'PaymentProcessed',
        ];

        return events.filter(event => {
          if (!businessHoursSensitiveEvents.includes(event.eventType)) {
            return true; // Pass through non-business-sensitive events
          }

          const eventDate = new Date(event.timestamp);
          const hour = eventDate.getUTCHours();
          const isWeekend =
            eventDate.getUTCDay() === 0 || eventDate.getUTCDay() === 6;

          // Business hours: 9 AM to 5 PM, Monday to Friday
          return !isWeekend && hour >= 9 && hour < 17;
        });
      },
    };
  }

  private createGeographicFilter(): EventFilter {
    return {
      name: 'geographic-filter',
      apply: async (events: IDomainEvent[]): Promise<IDomainEvent[]> => {
        const allowedCountries = ['US', 'CA', 'UK', 'DE', 'FR', 'JP', 'AU'];

        return events.filter(event => {
          const country =
            event.payload?.country || event.payload?.shippingAddress?.country;

          if (!country) {
            return true; // Pass through events without country data
          }

          return allowedCountries.includes(country);
        });
      },
    };
  }

  // Pattern Definitions
  private createHighValueCustomerPattern(): PatternDefinition {
    return {
      name: 'high-value-customer',
      description: 'Detect customers with high spending patterns',
      events: [
        { type: 'OrderPlaced', within: '30 days' },
        { type: 'OrderPlaced', within: '30 days' },
        { type: 'OrderPlaced', within: '30 days' },
      ],
      conditions: [
        { field: 'payload.total', operator: '>', value: 100 },
        { field: 'payload.customerId', operator: 'same' },
      ],
      minimumEvents: 3,
    };
  }

  private createAbandonedCartPattern(): PatternDefinition {
    return {
      name: 'abandoned-cart',
      description: 'Detect cart abandonment patterns',
      events: [
        { type: 'ProductViewed', within: '1 hour' },
        { type: 'CartAbandoned', within: '1 hour' },
      ],
      conditions: [
        { field: 'payload.userId', operator: 'same' },
        { field: 'payload.productId', operator: 'same' },
      ],
      minimumEvents: 2,
    };
  }

  private createFraudDetectionPattern(): PatternDefinition {
    return {
      name: 'fraud-detection',
      description: 'Detect potential fraudulent activity',
      events: [
        { type: 'OrderPlaced', within: '5 minutes' },
        { type: 'OrderPlaced', within: '5 minutes' },
        { type: 'PaymentProcessed', within: '10 minutes' },
      ],
      conditions: [
        { field: 'payload.paymentMethod', operator: 'different' },
        { field: 'payload.total', operator: '>', value: 500 },
      ],
      minimumEvents: 3,
    };
  }

  private createChurnRiskPattern(): PatternDefinition {
    return {
      name: 'churn-risk',
      description: 'Detect customers at risk of churning',
      events: [{ type: 'UserActivity', within: '90 days', inverted: true }],
      conditions: [
        { field: 'lastActivityDate', operator: '<', value: '30 days ago' },
      ],
      minimumEvents: 1,
    };
  }

  // Query Methods
  getRealTimeMetrics(): any {
    const state = this.getState();
    return {
      ...state.realTimeMetrics,
      activeUsers: state.realTimeMetrics.activeUsers.size,
      processingRate: state.processingRate,
      eventCount: state.eventCount,
    };
  }

  getWindowMetrics(
    windowType: 'hourly' | 'daily' | 'monthly',
    limit: number = 10
  ): BusinessMetrics[] {
    const state = this.getState();
    const windows = state.timeWindows[`${windowType}Windows`];

    return Array.from(windows.entries())
      .sort(([a], [b]) => b.localeCompare(a)) // Sort by window ID (timestamp-based)
      .slice(0, limit)
      .map(([windowId, metrics]) => ({ ...metrics, windowId }));
  }

  getDetectedPatterns(patternName?: string): any[] {
    const state = this.getState();

    if (patternName) {
      return state.detectedPatterns.get(patternName) || [];
    }

    const allPatterns: any[] = [];
    for (const [name, patterns] of state.detectedPatterns) {
      allPatterns.push(...patterns.map(p => ({ ...p, patternName: name })));
    }

    return allPatterns.sort(
      (a, b) => b.detectedAt.getTime() - a.detectedAt.getTime()
    );
  }

  getActiveAlerts(): AlertCondition[] {
    return Array.from(this.getState().activeAlerts.values());
  }

  getCustomerSegmentAnalysis(): any {
    const state = this.getState();
    const segments = Array.from(state.customerSegments.values());

    return {
      totalCustomers: segments.length,
      segments: {
        highValue: segments.filter(s => s.segment === 'high-value').length,
        regular: segments.filter(s => s.segment === 'regular').length,
        lowValue: segments.filter(s => s.segment === 'low-value').length,
        atRisk: segments.filter(s => s.churnRisk === 'high').length,
      },
      averageCustomerValue:
        segments.reduce((sum, s) => sum + s.totalValue, 0) / segments.length,
    };
  }

  getProductPerformanceAnalysis(): any {
    const state = this.getState();
    const products = Array.from(state.productPerformance.entries());

    const topPerformers = products
      .sort(([, a], [, b]) => b.revenue - a.revenue)
      .slice(0, 10)
      .map(([id, metrics]) => ({ productId: id, ...metrics }));

    const averageConversion =
      products.reduce((sum, [, p]) => sum + p.conversionRate, 0) /
      products.length;

    return {
      totalProducts: products.length,
      topPerformers,
      averageConversionRate: averageConversion,
      totalRevenue: products.reduce((sum, [, p]) => sum + p.revenue, 0),
      totalViews: products.reduce((sum, [, p]) => sum + p.views, 0),
    };
  }

  // Helper Methods
  private calculateWindowMetrics(window: StreamWindow): BusinessMetrics {
    const events = window.events;
    const orders = events.filter(e => e.eventType === 'OrderPlaced');
    const revenue = orders.reduce((sum, e) => sum + (e.payload?.total || 0), 0);

    return {
      windowStart: window.start,
      windowEnd: window.end,
      eventCount: events.length,
      orderCount: orders.length,
      totalRevenue: revenue,
      averageOrderValue: orders.length > 0 ? revenue / orders.length : 0,
      uniqueCustomers: new Set(orders.map(o => o.payload?.customerId)).size,
      conversionRate: this.calculateConversionRate(events),
    };
  }

  private calculateConversionRate(events: IDomainEvent[]): number {
    const views = events.filter(e => e.eventType === 'ProductViewed').length;
    const orders = events.filter(e => e.eventType === 'OrderPlaced').length;
    return views > 0 ? (orders / views) * 100 : 0;
  }

  private updateProcessingMetrics(startTime: number): void {
    const processingTime = performance.now() - startTime;
    const state = this.getState();

    // Update rolling average of processing rate
    state.processingRate =
      state.processingRate * 0.9 + (1000 / processingTime) * 0.1;
  }

  // Additional helper methods for pattern handling, customer segmentation, etc.
  private handleHighValueCustomerPattern(
    events: IDomainEvent[],
    state: any
  ): void {
    const customerId = events[0]?.payload?.customerId;
    if (!customerId) return;

    const segment = state.customerSegments.get(customerId) || {
      segment: 'regular',
      totalValue: 0,
    };
    segment.segment = 'high-value';
    segment.detectedAt = new Date();
    state.customerSegments.set(customerId, segment);
  }

  private async updateCustomerSegmentation(
    customerId: string,
    orderValue: number,
    state: any
  ): Promise<void> {
    const segment = state.customerSegments.get(customerId) || {
      segment: 'regular',
      totalValue: 0,
      orderCount: 0,
      firstOrderDate: new Date(),
      lastOrderDate: new Date(),
      churnRisk: 'low',
    };

    segment.totalValue += orderValue;
    segment.orderCount++;
    segment.lastOrderDate = new Date();

    // Update segmentation based on spending
    if (segment.totalValue > 5000) {
      segment.segment = 'high-value';
    } else if (segment.totalValue > 1000) {
      segment.segment = 'regular';
    } else {
      segment.segment = 'low-value';
    }

    state.customerSegments.set(customerId, segment);
  }

  // ... Additional helper methods would be implemented here
  private getOrderCountFromRecentWindow(): number {
    // Simplified implementation
    return 100;
  }

  private async updateGeographicMetrics(
    country: string,
    orderValue: number,
    state: any
  ): Promise<void> {
    const geoMetrics = state.geographicMetrics.get(country) || {
      orderCount: 0,
      totalRevenue: 0,
      averageOrderValue: 0,
    };

    geoMetrics.orderCount++;
    geoMetrics.totalRevenue += orderValue;
    geoMetrics.averageOrderValue =
      geoMetrics.totalRevenue / geoMetrics.orderCount;

    state.geographicMetrics.set(country, geoMetrics);
  }

  private async checkHighValueOrderAlert(
    orderData: any,
    state: any
  ): Promise<void> {
    const alertId = `high-value-${orderData.orderId}`;
    state.activeAlerts.set(alertId, {
      id: alertId,
      type: 'high-value-order',
      message: `High value order detected: $${orderData.total}`,
      createdAt: new Date(),
      orderId: orderData.orderId,
      customerId: orderData.customerId,
    });
  }

  private calculatePatternConfidence(
    pattern: string,
    events: IDomainEvent[]
  ): number {
    // Simplified confidence calculation
    const baseConfidence = 0.7;
    const eventBonus = Math.min(events.length * 0.1, 0.3);
    return Math.min(baseConfidence + eventBonus, 1.0);
  }

  private cleanupOldWindows(state: any, keepCount: number): void {
    // Clean up hourly windows
    if (state.timeWindows.hourlyWindows.size > keepCount) {
      const entries = Array.from(state.timeWindows.hourlyWindows.entries())
        .sort(([a], [b]) => b.localeCompare(a))
        .slice(0, keepCount);
      state.timeWindows.hourlyWindows = new Map(entries);
    }

    // Similar cleanup for daily and monthly windows
    if (state.timeWindows.dailyWindows.size > keepCount) {
      const entries = Array.from(state.timeWindows.dailyWindows.entries())
        .sort(([a], [b]) => b.localeCompare(a))
        .slice(0, keepCount);
      state.timeWindows.dailyWindows = new Map(entries);
    }

    if (state.timeWindows.monthlyWindows.size > keepCount) {
      const entries = Array.from(state.timeWindows.monthlyWindows.entries())
        .sort(([a], [b]) => b.localeCompare(a))
        .slice(0, keepCount);
      state.timeWindows.monthlyWindows = new Map(entries);
    }
  }

  // Placeholder implementations for missing methods
  private async updateSessionMetrics(
    activityData: any,
    state: any
  ): Promise<void> {
    // Implementation would track user session metrics
  }

  private async updateUserEngagementPatterns(
    activityData: any,
    state: any
  ): Promise<void> {
    // Implementation would analyze user engagement patterns
  }

  private async handleCartAbandoned(
    event: IDomainEvent,
    state: any
  ): Promise<void> {
    // Implementation would handle cart abandonment events
  }

  private async handleGenericEvent(
    event: IDomainEvent,
    state: any
  ): Promise<void> {
    // Implementation would handle unknown event types
  }

  private handleAbandonedCartPattern(events: IDomainEvent[], state: any): void {
    // Implementation would handle detected abandoned cart patterns
  }

  private handleFraudDetectionPattern(
    events: IDomainEvent[],
    state: any
  ): void {
    // Implementation would handle detected fraud patterns
  }

  private handleChurnRiskPattern(events: IDomainEvent[], state: any): void {
    // Implementation would handle detected churn risk patterns
  }

  private updateCustomerRevenueMetrics(
    result: AggregationResult,
    state: any
  ): void {
    // Implementation would update customer revenue metrics from aggregation
  }

  private updateProductPerformanceMetrics(
    result: AggregationResult,
    state: any
  ): void {
    // Implementation would update product performance from aggregation
  }

  private updateGeographicDistribution(
    result: AggregationResult,
    state: any
  ): void {
    // Implementation would update geographic distribution from aggregation
  }
}
```

## Key Features

- **Advanced Stream Processing**: Real-time event processing with filtering and
  buffering
- **Time-Windowed Aggregations**: Sliding and tumbling windows for temporal
  analysis
- **Pattern Detection**: Complex pattern matching for business rule detection
- **Real-Time Analytics**: Live business metrics and KPI calculations
- **Multi-Dimensional Analysis**: Customer segmentation, geographic, and product
  analysis
- **Alert Generation**: Automated detection of business anomalies and conditions

## Usage Examples

```typescript
// Create and configure the analytics projection
const analyticsProjection = new BusinessAnalyticsProjection();

// Process various business events
await analyticsProjection.handle({
  eventId: '1001',
  eventType: 'OrderPlaced',
  aggregateId: 'order-1',
  payload: {
    orderId: 'order-1',
    customerId: 'customer-1',
    total: 150,
    items: [{ productId: 'product-1', quantity: 2, price: 75 }],
    shippingAddress: { country: 'US' },
  },
  timestamp: new Date(),
  version: 1,
});

await analyticsProjection.handle({
  eventId: '1002',
  eventType: 'UserActivity',
  aggregateId: 'user-1',
  payload: {
    userId: 'customer-1',
    activityType: 'page_view',
    page: '/products',
    sessionId: 'session-123',
  },
  timestamp: new Date(),
  version: 1,
});

await analyticsProjection.handle({
  eventId: '1003',
  eventType: 'ProductViewed',
  aggregateId: 'product-1',
  payload: {
    productId: 'product-1',
    userId: 'customer-1',
    category: 'electronics',
    viewDuration: 45,
  },
  timestamp: new Date(),
  version: 1,
});

// Query real-time metrics
const realTimeMetrics = analyticsProjection.getRealTimeMetrics();
console.log('Real-time metrics:', realTimeMetrics);

// Query windowed data
const hourlyMetrics = analyticsProjection.getWindowMetrics('hourly', 5);
console.log('Last 5 hourly windows:', hourlyMetrics);

// Check detected patterns
const patterns = analyticsProjection.getDetectedPatterns();
console.log('Detected patterns:', patterns);

// View active alerts
const alerts = analyticsProjection.getActiveAlerts();
console.log('Active alerts:', alerts);

// Analyze customer segments
const customerAnalysis = analyticsProjection.getCustomerSegmentAnalysis();
console.log('Customer segment analysis:', customerAnalysis);

// View product performance
const productAnalysis = analyticsProjection.getProductPerformanceAnalysis();
console.log('Product performance:', productAnalysis);

// Check for high-value customer patterns
const highValuePatterns = analyticsProjection.getDetectedPatterns(
  'high-value-customer'
);
console.log('High-value customer patterns:', highValuePatterns);
```

## Stream Processing Features

### **Event Filtering**

Multiple configurable filters for data quality and relevance:

```typescript
// Relevance filter - only business-critical events
// Quality filter - removes malformed or outdated events
// Business hours filter - focuses on business-relevant timeframes
// Geographic filter - limits to specific regions
```

### **Windowed Aggregations**

Time-based data aggregation with different window types:

```typescript
// Sliding windows - overlapping time periods for smooth trends
// Tumbling windows - non-overlapping periods for discrete analysis
// Configurable sizes from minutes to months
```

### **Pattern Detection**

Complex event pattern matching:

```typescript
// High-value customer detection
// Abandoned cart identification
// Fraud detection patterns
// Churn risk analysis
```

## Real-Time Analytics

### **Business Metrics**

- Orders per second/minute/hour
- Revenue calculations and trends
- Active user tracking
- Conversion rate analysis
- Average order values

### **Customer Intelligence**

- Automatic customer segmentation
- Spending pattern analysis
- Engagement tracking
- Churn risk assessment

### **Product Analytics**

- View-to-purchase conversion
- Product performance ranking
- Category analysis
- Revenue attribution

## Best Practices

- **Filter Early**: Apply filters as early as possible to reduce processing
  overhead
- **Window Sizing**: Choose appropriate window sizes for your business needs
- **Pattern Complexity**: Balance pattern complexity with performance
  requirements
- **Memory Management**: Implement cleanup strategies for long-running
  projections
- **Alert Fatigue**: Configure alert thresholds to avoid overwhelming
  notifications

## Common Pitfalls

- **Over-Filtering**: Too aggressive filtering can miss important events
- **Window Overlap**: Sliding windows can create duplicate calculations
- **Pattern False Positives**: Overly sensitive patterns generate noise
- **Memory Growth**: Unbounded data structures in windowed calculations
- **Processing Lag**: Complex patterns can introduce significant delays

## Related Examples

- [Projection Rebuilding System](./example-1.md)
- [Simple Event Projection](../basic/example-1.md)
- [Projection with Capabilities](../basic/example-2.md)
- [Basic Implementation Guide](../basic/implementation.md)
