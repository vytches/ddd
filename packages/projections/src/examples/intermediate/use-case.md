# Intermediate Use Cases

**Version**: 1.0.0 **Package**: @vytches/ddd-projections **Complexity**:
intermediate **Domain**: Event Sourcing **Patterns**: Advanced business
scenarios, enterprise patterns, production use cases **Dependencies**:
@vytches/ddd-projections, @vytches/ddd-events, @vytches/ddd-utils

## Description

Advanced use cases demonstrating intermediate projection patterns in complex
business scenarios. These examples showcase projection rebuilding, multi-tenant
architectures, stream processing, and enterprise-grade implementations for
real-world production systems.

## Business Context

Enterprise applications require sophisticated projection patterns:

- High-frequency trading systems requiring millisecond response times
- Multi-tenant SaaS platforms with strict data isolation
- Financial systems with complex regulatory reporting requirements
- IoT platforms processing millions of sensor events
- E-commerce systems with real-time personalization
- Healthcare systems with privacy and compliance constraints

These use cases demonstrate how intermediate projection patterns solve complex
business challenges.

## Use Case Examples

### **Use Case 1: High-Frequency Trading Analytics Platform**

```typescript
// trading-analytics-projection.ts
import {
  ProjectionBase,
  StreamProcessor,
  WindowProcessor,
  PatternMatcher,
} from '@vytches/ddd-projections';
import { IDomainEvent } from '@vytches/ddd-events';
import {
  TradingData,
  MarketAnalytics,
  RiskMetrics,
  TradingSignal,
} from '../types';

// Business Requirement: Real-time trading analytics with millisecond latency
// - Process 100,000+ trades per second
// - Calculate complex technical indicators
// - Generate trading signals in real-time
// - Risk monitoring and position tracking

export class TradingAnalyticsProjection extends ProjectionBase<any> {
  private streamProcessor: StreamProcessor;
  private windowProcessor: WindowProcessor;
  private patternMatcher: PatternMatcher;

  constructor() {
    super('TradingAnalyticsProjection', 'v2.0');

    this.setState({
      // Real-time market data
      currentPrices: new Map<string, number>(),
      volumeData: new Map<string, any>(),

      // Technical indicators (sliding windows)
      movingAverages: {
        sma5: new Map<string, number>(),
        sma20: new Map<string, number>(),
        ema12: new Map<string, number>(),
        ema26: new Map<string, number>(),
      },

      // Risk metrics
      riskMetrics: {
        valueAtRisk: new Map<string, number>(),
        expectedShortfall: new Map<string, number>(),
        portfolioExposure: new Map<string, number>(),
        correlationMatrix: new Map<string, Map<string, number>>(),
      },

      // Trading signals
      activeSignals: new Map<string, TradingSignal[]>(),
      signalHistory: new Map<string, any[]>(),

      // Performance tracking
      portfolioMetrics: {
        totalValue: 0,
        unrealizedPnL: 0,
        realizedPnL: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
      },

      // High-frequency data (circular buffers for memory efficiency)
      tickData: new Map<string, CircularBuffer<any>>(),
      orderBookSnapshots: new Map<string, CircularBuffer<any>>(),

      lastUpdate: new Date(),
    });

    this.setupHighFrequencyProcessing();
  }

  private setupHighFrequencyProcessing(): void {
    // Ultra-low latency stream processor
    this.streamProcessor = new StreamProcessor({
      bufferSize: 100000,
      flushInterval: 1, // 1ms for ultra-low latency
      enableBackpressure: true,
      parallelProcessing: true,
      compressionEnabled: false, // No compression for speed
    });

    // Sliding windows for technical indicators
    this.windowProcessor = new WindowProcessor({
      windows: [
        { name: '1min', size: 60000, slide: 1000, type: 'sliding' },
        { name: '5min', size: 300000, slide: 5000, type: 'sliding' },
        { name: '15min', size: 900000, slide: 15000, type: 'sliding' },
        { name: '1hour', size: 3600000, slide: 60000, type: 'sliding' },
      ],
    });

    // Pattern detection for trading signals
    this.patternMatcher = new PatternMatcher({
      patterns: [
        this.createGoldenCrossPattern(),
        this.createBreakoutPattern(),
        this.createMeanReversionPattern(),
        this.createVolatilitySpikesPattern(),
        this.createArbitragePattern(),
      ],
    });

    this.setupTradingEventHandlers();
  }

  private setupTradingEventHandlers(): void {
    this.windowProcessor.on('windowCompleted', window => {
      this.updateTechnicalIndicators(window);
    });

    this.patternMatcher.on('patternDetected', (pattern, events) => {
      this.generateTradingSignal(pattern, events);
    });
  }

  @EventHandler('TradeExecuted')
  async onTradeExecuted(event: IDomainEvent): Promise<void> {
    const tradeData = event.payload;
    const state = this.getState();

    // Update current prices with ultra-low latency
    state.currentPrices.set(tradeData.symbol, tradeData.price);

    // Update volume data
    const volumeInfo = state.volumeData.get(tradeData.symbol) || {
      totalVolume: 0,
      tradeCount: 0,
      weightedPrice: 0,
    };

    volumeInfo.totalVolume += tradeData.quantity;
    volumeInfo.tradeCount++;
    volumeInfo.weightedPrice =
      (volumeInfo.weightedPrice * (volumeInfo.tradeCount - 1) +
        tradeData.price) /
      volumeInfo.tradeCount;

    state.volumeData.set(tradeData.symbol, volumeInfo);

    // Add to tick data circular buffer (memory efficient)
    let tickBuffer = state.tickData.get(tradeData.symbol);
    if (!tickBuffer) {
      tickBuffer = new CircularBuffer<any>(10000); // Keep last 10k ticks
      state.tickData.set(tradeData.symbol, tickBuffer);
    }

    tickBuffer.add({
      price: tradeData.price,
      volume: tradeData.quantity,
      timestamp: new Date(event.timestamp),
    });

    // Update portfolio metrics
    this.updatePortfolioMetrics(tradeData, state);

    // Calculate real-time risk metrics
    this.updateRiskMetrics(tradeData.symbol, tradeData, state);

    // Stream processing for real-time indicators
    await this.streamProcessor.addEvent(event);
    await this.windowProcessor.addEvent(event);
    await this.patternMatcher.addEvent(event);

    state.lastUpdate = new Date();
    this.setState(state);
  }

  @EventHandler('OrderBookUpdate')
  async onOrderBookUpdate(event: IDomainEvent): Promise<void> {
    const orderBookData = event.payload;
    const state = this.getState();

    // Store order book snapshot in circular buffer
    let orderBookBuffer = state.orderBookSnapshots.get(orderBookData.symbol);
    if (!orderBookBuffer) {
      orderBookBuffer = new CircularBuffer<any>(1000); // Keep last 1k snapshots
      state.orderBookSnapshots.set(orderBookData.symbol, orderBookBuffer);
    }

    orderBookBuffer.add({
      bids: orderBookData.bids,
      asks: orderBookData.asks,
      spread: orderBookData.asks[0]?.price - orderBookData.bids[0]?.price,
      timestamp: new Date(event.timestamp),
    });

    // Calculate market microstructure indicators
    this.updateMarketMicrostructureIndicators(orderBookData, state);

    this.setState(state);
  }

  private updateTechnicalIndicators(window: any): void {
    const state = this.getState();
    const trades = window.events.filter(
      (e: any) => e.eventType === 'TradeExecuted'
    );

    if (trades.length === 0) return;

    // Group by symbol
    const tradesBySymbol = new Map<string, any[]>();
    trades.forEach((trade: any) => {
      const symbol = trade.payload.symbol;
      if (!tradesBySymbol.has(symbol)) {
        tradesBySymbol.set(symbol, []);
      }
      tradesBySymbol.get(symbol)!.push(trade.payload);
    });

    // Calculate indicators for each symbol
    for (const [symbol, symbolTrades] of tradesBySymbol) {
      const prices = symbolTrades.map(t => t.price);

      // Simple Moving Averages
      state.movingAverages.sma5.set(symbol, this.calculateSMA(prices, 5));
      state.movingAverages.sma20.set(symbol, this.calculateSMA(prices, 20));

      // Exponential Moving Averages
      state.movingAverages.ema12.set(symbol, this.calculateEMA(prices, 12));
      state.movingAverages.ema26.set(symbol, this.calculateEMA(prices, 26));
    }
  }

  private generateTradingSignal(pattern: string, events: IDomainEvent[]): void {
    const state = this.getState();
    const symbol = events[0]?.payload?.symbol;

    if (!symbol) return;

    const signal: TradingSignal = {
      id: `signal-${Date.now()}-${Math.random()}`,
      symbol,
      pattern,
      type: this.getSignalType(pattern),
      strength: this.calculateSignalStrength(pattern, events),
      timestamp: new Date(),
      events: events.map(e => ({ id: e.eventId, type: e.eventType })),
      expiresAt: new Date(Date.now() + this.getSignalTTL(pattern)),
    };

    // Store active signal
    const activeSignals = state.activeSignals.get(symbol) || [];
    activeSignals.push(signal);

    // Remove expired signals
    const validSignals = activeSignals.filter(s => s.expiresAt > new Date());
    state.activeSignals.set(symbol, validSignals);

    // Store in history
    const signalHistory = state.signalHistory.get(symbol) || [];
    signalHistory.push({
      signal: { ...signal },
      detectedAt: new Date(),
    });

    // Keep only recent history (last 1000 signals)
    if (signalHistory.length > 1000) {
      signalHistory.splice(0, signalHistory.length - 1000);
    }

    state.signalHistory.set(symbol, signalHistory);

    console.log(
      `Trading signal generated: ${pattern} for ${symbol} (strength: ${signal.strength})`
    );
  }

  // Ultra-fast query methods optimized for trading
  getCurrentPrice(symbol: string): number | undefined {
    return this.getState().currentPrices.get(symbol);
  }

  getTechnicalIndicators(symbol: string): any {
    const state = this.getState();
    return {
      sma5: state.movingAverages.sma5.get(symbol),
      sma20: state.movingAverages.sma20.get(symbol),
      ema12: state.movingAverages.ema12.get(symbol),
      ema26: state.movingAverages.ema26.get(symbol),
    };
  }

  getActiveSignals(symbol: string): TradingSignal[] {
    const signals = this.getState().activeSignals.get(symbol) || [];
    return signals.filter(s => s.expiresAt > new Date());
  }

  getRiskMetrics(symbol?: string): any {
    const state = this.getState();
    if (symbol) {
      return {
        valueAtRisk: state.riskMetrics.valueAtRisk.get(symbol),
        expectedShortfall: state.riskMetrics.expectedShortfall.get(symbol),
        portfolioExposure: state.riskMetrics.portfolioExposure.get(symbol),
      };
    }
    return state.riskMetrics;
  }

  getPortfolioMetrics(): any {
    return { ...this.getState().portfolioMetrics };
  }

  // High-performance helper methods
  private updatePortfolioMetrics(tradeData: any, state: any): void {
    if (tradeData.side === 'buy') {
      state.portfolioMetrics.totalValue += tradeData.price * tradeData.quantity;
    } else {
      state.portfolioMetrics.totalValue -= tradeData.price * tradeData.quantity;
    }

    // Update P&L calculations
    this.calculatePnL(tradeData, state);
  }

  private updateRiskMetrics(symbol: string, tradeData: any, state: any): void {
    // Simplified VaR calculation (would be more complex in production)
    const tickBuffer = state.tickData.get(symbol);
    if (tickBuffer && tickBuffer.size() >= 100) {
      const prices = tickBuffer.toArray().map((tick: any) => tick.price);
      const returns = this.calculateReturns(prices);
      const var95 = this.calculateVaR(returns, 0.95);

      state.riskMetrics.valueAtRisk.set(symbol, var95);
    }
  }

  private updateMarketMicrostructureIndicators(
    orderBookData: any,
    state: any
  ): void {
    // Calculate order book imbalance, effective spreads, etc.
    // This would include sophisticated market microstructure analysis
  }

  // Trading pattern definitions
  private createGoldenCrossPattern(): any {
    return {
      name: 'golden-cross',
      description: 'SMA 50 crosses above SMA 200',
      events: [{ type: 'TradeExecuted', within: '1 hour' }],
      conditions: [
        { field: 'sma50', operator: 'crosses_above', field2: 'sma200' },
      ],
    };
  }

  private createBreakoutPattern(): any {
    return {
      name: 'breakout',
      description: 'Price breaks above resistance with volume',
      events: [{ type: 'TradeExecuted', within: '15 minutes' }],
      conditions: [
        { field: 'price', operator: 'breaks_above', field2: 'resistance' },
        { field: 'volume', operator: '>', threshold: 'average_volume * 1.5' },
      ],
    };
  }

  private createMeanReversionPattern(): any {
    return {
      name: 'mean-reversion',
      description: 'Price deviates significantly from moving average',
      events: [{ type: 'TradeExecuted', within: '30 minutes' }],
      conditions: [
        {
          field: 'price',
          operator: 'deviates_from',
          field2: 'sma20',
          threshold: '2_std_dev',
        },
      ],
    };
  }

  private createVolatilitySpikesPattern(): any {
    return {
      name: 'volatility-spike',
      description: 'Sudden increase in volatility',
      events: [{ type: 'TradeExecuted', within: '5 minutes' }],
      conditions: [
        {
          field: 'volatility',
          operator: '>',
          threshold: 'average_volatility * 2',
        },
      ],
    };
  }

  private createArbitragePattern(): any {
    return {
      name: 'arbitrage',
      description: 'Price discrepancy between markets',
      events: [{ type: 'TradeExecuted', within: '1 minute' }],
      conditions: [
        {
          field: 'price_difference',
          operator: '>',
          threshold: 'transaction_cost * 1.1',
        },
      ],
    };
  }

  // Mathematical helper methods
  private calculateSMA(prices: number[], period: number): number {
    if (prices.length < period) return 0;
    const sum = prices.slice(-period).reduce((a, b) => a + b, 0);
    return sum / period;
  }

  private calculateEMA(prices: number[], period: number): number {
    if (prices.length === 0) return 0;
    const multiplier = 2 / (period + 1);
    let ema = prices[0];

    for (let i = 1; i < prices.length; i++) {
      ema = (prices[i] - ema) * multiplier + ema;
    }

    return ema;
  }

  private calculateReturns(prices: number[]): number[] {
    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
    return returns;
  }

  private calculateVaR(returns: number[], confidence: number): number {
    const sortedReturns = returns.sort((a, b) => a - b);
    const index = Math.floor((1 - confidence) * sortedReturns.length);
    return Math.abs(sortedReturns[index] || 0);
  }

  private calculatePnL(tradeData: any, state: any): void {
    // Sophisticated P&L calculation would go here
    // This would include mark-to-market, realized vs unrealized P&L, etc.
  }

  private getSignalType(pattern: string): string {
    const signalTypes: Record<string, string> = {
      'golden-cross': 'BUY',
      breakout: 'BUY',
      'mean-reversion': 'MEAN_REVERT',
      'volatility-spike': 'VOLATILITY',
      arbitrage: 'ARBITRAGE',
    };
    return signalTypes[pattern] || 'NEUTRAL';
  }

  private calculateSignalStrength(
    pattern: string,
    events: IDomainEvent[]
  ): number {
    // Calculate signal strength based on pattern and supporting evidence
    let strength = 0.5; // Base strength

    switch (pattern) {
      case 'golden-cross':
        strength = 0.8; // High confidence for golden cross
        break;
      case 'breakout':
        strength = 0.7 + events.length * 0.05; // Strength increases with volume
        break;
      case 'arbitrage':
        strength = 0.9; // Very high confidence for arbitrage
        break;
    }

    return Math.min(strength, 1.0);
  }

  private getSignalTTL(pattern: string): number {
    const ttlMap: Record<string, number> = {
      'golden-cross': 24 * 60 * 60 * 1000, // 24 hours
      breakout: 4 * 60 * 60 * 1000, // 4 hours
      'mean-reversion': 2 * 60 * 60 * 1000, // 2 hours
      'volatility-spike': 30 * 60 * 1000, // 30 minutes
      arbitrage: 5 * 60 * 1000, // 5 minutes
    };
    return ttlMap[pattern] || 60 * 60 * 1000; // Default 1 hour
  }
}

// Circular Buffer implementation for memory efficiency
class CircularBuffer<T> {
  private buffer: (T | undefined)[];
  private head: number = 0;
  private tail: number = 0;
  private count: number = 0;

  constructor(private capacity: number) {
    this.buffer = new Array(capacity);
  }

  add(item: T): void {
    this.buffer[this.tail] = item;
    this.tail = (this.tail + 1) % this.capacity;

    if (this.count < this.capacity) {
      this.count++;
    } else {
      this.head = (this.head + 1) % this.capacity;
    }
  }

  toArray(): T[] {
    const result: T[] = [];
    let current = this.head;

    for (let i = 0; i < this.count; i++) {
      result.push(this.buffer[current]!);
      current = (current + 1) % this.capacity;
    }

    return result;
  }

  size(): number {
    return this.count;
  }
}
```

### **Use Case 2: Global SaaS Platform with Multi-Region Deployment**

```typescript
// global-saas-projection.ts
import {
  MultiTenantProjectionBase,
  ProjectionRebuilder,
  TenantIsolationCapability,
} from '@vytches/ddd-projections';
import { IDomainEvent } from '@vytches/ddd-events';
import {
  TenantContext,
  GlobalTenantConfiguration,
  ComplianceRequirements,
  RegionalDataCenter,
} from '../types';

// Business Requirement: Global SaaS platform serving 10,000+ tenants
// - Multi-region deployment (US, EU, APAC)
// - GDPR, SOX, HIPAA compliance
// - 99.99% uptime SLA
// - Regional data residency requirements
// - Real-time cross-region replication

export class GlobalSaaSUserAnalyticsProjection extends MultiTenantProjectionBase<any> {
  private regionalDataCenters: Map<string, RegionalDataCenter>;
  private complianceEngine: ComplianceEngine;
  private crossRegionReplicator: CrossRegionReplicator;

  constructor(region: string) {
    super(`GlobalSaaSUserAnalytics_${region}`, 'v3.0');

    this.setupGlobalArchitecture(region);
    this.initializeComplianceEngine();
  }

  private setupGlobalArchitecture(region: string): void {
    this.regionalDataCenters = new Map([
      [
        'us-east-1',
        { region: 'US', endpoint: 'us-east-1.projections.com', latency: 50 },
      ],
      [
        'eu-west-1',
        { region: 'EU', endpoint: 'eu-west-1.projections.com', latency: 80 },
      ],
      [
        'ap-southeast-1',
        {
          region: 'APAC',
          endpoint: 'ap-southeast-1.projections.com',
          latency: 120,
        },
      ],
    ]);

    this.crossRegionReplicator = new CrossRegionReplicator({
      sourceRegion: region,
      replicationTargets: Array.from(this.regionalDataCenters.keys()).filter(
        r => r !== region
      ),
      replicationStrategy: 'async', // Async for performance, eventual consistency
      encryptionEnabled: true,
      compressionEnabled: true,
    });
  }

  private initializeComplianceEngine(): void {
    this.complianceEngine = new ComplianceEngine({
      regulations: ['GDPR', 'SOX', 'HIPAA', 'SOC2', 'CCPA'],
      dataClassification: 'PII_SENSITIVE',
      auditLogRetention: 2555, // 7 years
      encryptionAtRest: true,
      encryptionInTransit: true,
    });
  }

  protected createInitialTenantData(): any {
    return {
      // User analytics data
      users: new Map<string, any>(),
      userSessions: new Map<string, any>(),
      userEngagement: new Map<string, any>(),

      // Feature usage analytics
      featureUsage: new Map<string, any>(),
      featureAdoption: new Map<string, any>(),

      // Business metrics
      subscriptionMetrics: {
        activeSubscriptions: 0,
        churnRate: 0,
        mrr: 0, // Monthly Recurring Revenue
        ltv: 0, // Customer Lifetime Value
      },

      // Compliance tracking
      complianceAudit: {
        dataProcessingConsent: new Map<string, any>(),
        dataRetentionPolicies: new Map<string, any>(),
        accessLogs: [],
        deletionRequests: new Map<string, any>(),
      },

      // Regional data
      regionalMetrics: new Map<string, any>(),
      crossRegionInsights: new Map<string, any>(),
    };
  }

  protected async handleTenantSpecificEvent(
    event: IDomainEvent,
    tenantContext: TenantContext,
    tenantConfig: GlobalTenantConfiguration
  ): Promise<void> {
    // Validate compliance requirements
    const complianceCheck = await this.complianceEngine.validateEvent(
      event,
      tenantConfig
    );
    if (!complianceCheck.isCompliant) {
      await this.handleComplianceViolation(
        event,
        complianceCheck,
        tenantContext
      );
      return;
    }

    // Process based on event type
    switch (event.eventType) {
      case 'UserEngaged':
        await this.handleUserEngagement(
          event,
          tenantContext.tenantId,
          tenantConfig
        );
        break;
      case 'FeatureUsed':
        await this.handleFeatureUsage(
          event,
          tenantContext.tenantId,
          tenantConfig
        );
        break;
      case 'SubscriptionChanged':
        await this.handleSubscriptionChange(
          event,
          tenantContext.tenantId,
          tenantConfig
        );
        break;
      case 'DataProcessingConsent':
        await this.handleConsentManagement(
          event,
          tenantContext.tenantId,
          tenantConfig
        );
        break;
      case 'DataDeletionRequest':
        await this.handleDataDeletionRequest(
          event,
          tenantContext.tenantId,
          tenantConfig
        );
        break;
    }

    // Regional data processing
    await this.processRegionalRequirements(event, tenantContext, tenantConfig);

    // Cross-region replication (if allowed by tenant compliance)
    if (tenantConfig.crossRegionReplicationAllowed) {
      await this.crossRegionReplicator.replicate(event, tenantContext);
    }
  }

  private async handleUserEngagement(
    event: IDomainEvent,
    tenantId: string,
    tenantConfig: GlobalTenantConfiguration
  ): Promise<void> {
    const engagementData = event.payload;
    const tenantData = this.getTenantData(tenantId)!.data;

    // Update user engagement metrics
    const userId = engagementData.userId;
    const engagement = tenantData.userEngagement.get(userId) || {
      totalSessions: 0,
      totalTimeSpent: 0,
      lastActivity: null,
      engagementScore: 0,
      featureInteractions: new Map<string, number>(),
    };

    engagement.totalSessions++;
    engagement.totalTimeSpent += engagementData.sessionDuration || 0;
    engagement.lastActivity = new Date(event.timestamp);

    // Calculate engagement score based on multiple factors
    engagement.engagementScore = this.calculateEngagementScore(
      engagement,
      tenantConfig
    );

    tenantData.userEngagement.set(userId, engagement);

    // Update session tracking
    this.updateSessionTracking(engagementData, tenantData);

    // Check for engagement milestones
    await this.checkEngagementMilestones(userId, engagement, tenantConfig);

    console.log(`User engagement updated for tenant ${tenantId}: ${userId}`);
  }

  private async handleFeatureUsage(
    event: IDomainEvent,
    tenantId: string,
    tenantConfig: GlobalTenantConfiguration
  ): Promise<void> {
    const featureData = event.payload;
    const tenantData = this.getTenantData(tenantId)!.data;

    const featureName = featureData.featureName;
    const usage = tenantData.featureUsage.get(featureName) || {
      totalUsage: 0,
      uniqueUsers: new Set<string>(),
      usagePattern: new Map<string, number>(),
      adoptionRate: 0,
    };

    usage.totalUsage++;
    usage.uniqueUsers.add(featureData.userId);

    // Track usage patterns by time of day/week
    const timePattern = this.getTimePattern(new Date(event.timestamp));
    usage.usagePattern.set(
      timePattern,
      (usage.usagePattern.get(timePattern) || 0) + 1
    );

    // Calculate adoption rate
    const totalUsers = tenantData.users.size;
    usage.adoptionRate =
      totalUsers > 0 ? (usage.uniqueUsers.size / totalUsers) * 100 : 0;

    tenantData.featureUsage.set(featureName, usage);

    // Update feature adoption metrics
    this.updateFeatureAdoption(featureName, tenantData, tenantConfig);

    console.log(`Feature usage updated for tenant ${tenantId}: ${featureName}`);
  }

  private async handleConsentManagement(
    event: IDomainEvent,
    tenantId: string,
    tenantConfig: GlobalTenantConfiguration
  ): Promise<void> {
    const consentData = event.payload;
    const tenantData = this.getTenantData(tenantId)!.data;

    // Record consent information for GDPR compliance
    tenantData.complianceAudit.dataProcessingConsent.set(consentData.userId, {
      consentType: consentData.consentType,
      granted: consentData.granted,
      timestamp: new Date(event.timestamp),
      consentVersion: consentData.version,
      ipAddress: consentData.ipAddress,
      userAgent: consentData.userAgent,
    });

    // If consent withdrawn, initiate data retention review
    if (!consentData.granted) {
      await this.initiateDataRetentionReview(
        consentData.userId,
        tenantId,
        tenantConfig
      );
    }

    console.log(
      `Consent ${consentData.granted ? 'granted' : 'withdrawn'} for user ${consentData.userId} in tenant ${tenantId}`
    );
  }

  private async handleDataDeletionRequest(
    event: IDomainEvent,
    tenantId: string,
    tenantConfig: GlobalTenantConfiguration
  ): Promise<void> {
    const deletionData = event.payload;
    const tenantData = this.getTenantData(tenantId)!.data;

    // Record deletion request
    tenantData.complianceAudit.deletionRequests.set(deletionData.requestId, {
      userId: deletionData.userId,
      requestType: deletionData.requestType, // 'GDPR_RIGHT_TO_BE_FORGOTTEN', 'USER_REQUESTED'
      requestedAt: new Date(event.timestamp),
      status: 'PENDING',
      completedAt: null,
    });

    // Initiate cross-region deletion process
    await this.initiateCrossRegionDeletion(
      deletionData,
      tenantId,
      tenantConfig
    );

    console.log(
      `Data deletion request initiated for user ${deletionData.userId} in tenant ${tenantId}`
    );
  }

  // Advanced analytics methods
  getTenantAnalytics(tenantId: string): any {
    const tenantData = this.getTenantData(tenantId);
    if (!tenantData) return null;

    const data = tenantData.data;

    return {
      userMetrics: {
        totalUsers: data.users.size,
        activeUsers: this.getActiveUserCount(data),
        engagementScore: this.getAverageEngagementScore(data),
        sessionMetrics: this.getSessionMetrics(data),
      },
      featureMetrics: {
        totalFeatures: data.featureUsage.size,
        topFeatures: this.getTopFeatures(data, 10),
        adoptionRates: this.getFeatureAdoptionRates(data),
        usagePatterns: this.getUsagePatterns(data),
      },
      businessMetrics: {
        ...data.subscriptionMetrics,
        growthRate: this.calculateGrowthRate(data),
        churnRisk: this.assessChurnRisk(data),
      },
      complianceMetrics: {
        consentRate: this.getConsentRate(data),
        dataRetentionCompliance: this.checkDataRetentionCompliance(data),
        auditTrailComplete: this.validateAuditTrail(data),
      },
    };
  }

  getCrossRegionInsights(tenantId: string): any {
    const tenantData = this.getTenantData(tenantId);
    if (!tenantData) return null;

    return {
      regionalUsage: tenantData.data.regionalMetrics,
      crossRegionLatency: this.getCrossRegionLatency(),
      dataResidencyCompliance: this.validateDataResidency(tenantId),
      replicationStatus: this.getReplicationStatus(tenantId),
    };
  }

  // Compliance and security methods
  private async handleComplianceViolation(
    event: IDomainEvent,
    complianceCheck: any,
    tenantContext: TenantContext
  ): Promise<void> {
    console.error(
      `Compliance violation detected for tenant ${tenantContext.tenantId}:`,
      complianceCheck.violations
    );

    // Log security event
    await this.logSecurityEvent({
      type: 'COMPLIANCE_VIOLATION',
      tenantId: tenantContext.tenantId,
      eventId: event.eventId,
      violations: complianceCheck.violations,
      timestamp: new Date(),
    });

    // Notify compliance team
    await this.notifyComplianceTeam(complianceCheck, tenantContext);
  }

  private async processRegionalRequirements(
    event: IDomainEvent,
    tenantContext: TenantContext,
    tenantConfig: GlobalTenantConfiguration
  ): Promise<void> {
    // Process data according to regional requirements
    if (tenantConfig.region === 'EU' && this.containsPII(event)) {
      await this.processGDPRRequirements(event, tenantContext);
    }

    if (tenantConfig.complianceRequirements.includes('SOX')) {
      await this.processSOXRequirements(event, tenantContext);
    }
  }

  private async initiateCrossRegionDeletion(
    deletionData: any,
    tenantId: string,
    tenantConfig: GlobalTenantConfiguration
  ): Promise<void> {
    // Coordinate deletion across all regions
    const deletionTasks = [];

    for (const [region, dataCenter] of this.regionalDataCenters) {
      deletionTasks.push(
        this.crossRegionReplicator.sendDeletionRequest(region, {
          tenantId,
          userId: deletionData.userId,
          requestId: deletionData.requestId,
        })
      );
    }

    await Promise.all(deletionTasks);
  }

  // Helper methods
  private calculateEngagementScore(engagement: any, tenantConfig: any): number {
    let score = 0;

    // Session frequency score (0-40 points)
    score += Math.min(engagement.totalSessions / 10, 40);

    // Time spent score (0-30 points)
    score += Math.min(engagement.totalTimeSpent / 3600, 30); // 1 hour = 30 points

    // Recency score (0-30 points)
    if (engagement.lastActivity) {
      const daysSinceActivity =
        (Date.now() - engagement.lastActivity.getTime()) /
        (24 * 60 * 60 * 1000);
      score += Math.max(30 - daysSinceActivity, 0);
    }

    return Math.min(score, 100);
  }

  private getTimePattern(date: Date): string {
    const hour = date.getUTCHours();
    const dayOfWeek = date.getUTCDay();

    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      if (hour >= 9 && hour < 17) return 'business_hours';
      return 'after_hours_weekday';
    }
    return 'weekend';
  }

  // Additional helper methods...
  private getActiveUserCount(data: any): number {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    let activeCount = 0;
    for (const engagement of data.userEngagement.values()) {
      if (engagement.lastActivity && engagement.lastActivity >= thirtyDaysAgo) {
        activeCount++;
      }
    }
    return activeCount;
  }

  private getAverageEngagementScore(data: any): number {
    const scores = Array.from(data.userEngagement.values()).map(
      e => e.engagementScore
    );
    return scores.length > 0
      ? scores.reduce((sum, score) => sum + score, 0) / scores.length
      : 0;
  }

  private getTopFeatures(data: any, limit: number): any[] {
    return Array.from(data.featureUsage.entries())
      .sort(([, a], [, b]) => b.totalUsage - a.totalUsage)
      .slice(0, limit)
      .map(([name, usage]) => ({
        name,
        usage: usage.totalUsage,
        adoptionRate: usage.adoptionRate,
      }));
  }

  // Compliance helper methods
  private containsPII(event: IDomainEvent): boolean {
    const piiFields = ['email', 'phone', 'ssn', 'address', 'name'];
    const payload = JSON.stringify(event.payload).toLowerCase();
    return piiFields.some(field => payload.includes(field));
  }

  private async processGDPRRequirements(
    event: IDomainEvent,
    tenantContext: TenantContext
  ): Promise<void> {
    // GDPR-specific processing logic
  }

  private async processSOXRequirements(
    event: IDomainEvent,
    tenantContext: TenantContext
  ): Promise<void> {
    // SOX compliance processing logic
  }

  // Placeholder implementations for missing methods
  private updateSessionTracking(engagementData: any, tenantData: any): void {
    // Implementation would track detailed session metrics
  }

  private async checkEngagementMilestones(
    userId: string,
    engagement: any,
    tenantConfig: any
  ): Promise<void> {
    // Implementation would check for engagement milestones and trigger actions
  }

  private updateFeatureAdoption(
    featureName: string,
    tenantData: any,
    tenantConfig: any
  ): void {
    // Implementation would update feature adoption metrics
  }

  private async initiateDataRetentionReview(
    userId: string,
    tenantId: string,
    tenantConfig: any
  ): Promise<void> {
    // Implementation would start data retention policy review
  }

  private async logSecurityEvent(event: any): Promise<void> {
    // Implementation would log security events
  }

  private async notifyComplianceTeam(
    complianceCheck: any,
    tenantContext: TenantContext
  ): Promise<void> {
    // Implementation would notify compliance team
  }

  private getSessionMetrics(data: any): any {
    // Implementation would calculate session metrics
    return {};
  }

  private getFeatureAdoptionRates(data: any): any {
    // Implementation would calculate feature adoption rates
    return {};
  }

  private getUsagePatterns(data: any): any {
    // Implementation would analyze usage patterns
    return {};
  }

  private calculateGrowthRate(data: any): number {
    // Implementation would calculate growth rate
    return 0;
  }

  private assessChurnRisk(data: any): number {
    // Implementation would assess churn risk
    return 0;
  }

  private getConsentRate(data: any): number {
    // Implementation would calculate consent rate
    return 0;
  }

  private checkDataRetentionCompliance(data: any): boolean {
    // Implementation would check data retention compliance
    return true;
  }

  private validateAuditTrail(data: any): boolean {
    // Implementation would validate audit trail completeness
    return true;
  }

  private getCrossRegionLatency(): any {
    // Implementation would measure cross-region latency
    return {};
  }

  private validateDataResidency(tenantId: string): boolean {
    // Implementation would validate data residency compliance
    return true;
  }

  private getReplicationStatus(tenantId: string): any {
    // Implementation would check replication status
    return {};
  }
}

// Supporting classes (simplified implementations)
class ComplianceEngine {
  constructor(private config: any) {}

  async validateEvent(event: IDomainEvent, tenantConfig: any): Promise<any> {
    return { isCompliant: true, violations: [] };
  }
}

class CrossRegionReplicator {
  constructor(private config: any) {}

  async replicate(
    event: IDomainEvent,
    tenantContext: TenantContext
  ): Promise<void> {
    // Implementation would handle cross-region replication
  }

  async sendDeletionRequest(region: string, deletionData: any): Promise<void> {
    // Implementation would send deletion requests to other regions
  }
}
```

### **Use Case 3: IoT Sensor Data Processing Platform**

```typescript
// iot-sensor-projection.ts
import {
  ProjectionBase,
  StreamProcessor,
  WindowProcessor,
  PatternMatcher,
} from '@vytches/ddd-projections';
import { IDomainEvent } from '@vytches/ddd-events';
import {
  SensorReading,
  DeviceMetrics,
  AnomalyDetection,
  PredictiveAnalytics,
} from '../types';

// Business Requirement: IoT platform processing millions of sensor events
// - 50,000+ connected devices
// - Real-time anomaly detection
// - Predictive maintenance alerts
// - Time-series data aggregation
// - Device health monitoring

export class IoTSensorDataProjection extends ProjectionBase<any> {
  private streamProcessor: StreamProcessor;
  private anomalyDetector: AnomalyDetector;
  private predictiveAnalyzer: PredictiveAnalyzer;

  constructor() {
    super('IoTSensorDataProjection', 'v2.1');

    this.setState({
      // Device registry and health
      devices: new Map<string, any>(),
      deviceHealth: new Map<string, any>(),

      // Time-series data (compressed storage)
      timeSeriesData: new Map<string, CompressedTimeSeries>(),

      // Real-time metrics
      realTimeMetrics: new Map<string, any>(),

      // Anomalies and alerts
      detectedAnomalies: new Map<string, any[]>(),
      activeAlerts: new Map<string, any[]>(),

      // Predictive insights
      maintenanceSchedule: new Map<string, any>(),
      performanceTrends: new Map<string, any>(),

      // Aggregated analytics
      siteMetrics: new Map<string, any>(),
      fleetMetrics: {
        totalDevices: 0,
        onlineDevices: 0,
        averageUptime: 0,
        totalDataPoints: 0,
      },
    });

    this.setupIoTProcessing();
  }

  private setupIoTProcessing(): void {
    // High-throughput stream processing
    this.streamProcessor = new StreamProcessor({
      bufferSize: 1000000, // 1M events buffer
      flushInterval: 100, // 100ms for near real-time
      enableBackpressure: true,
      compressionEnabled: true,
    });

    // Anomaly detection engine
    this.anomalyDetector = new AnomalyDetector({
      algorithms: ['statistical', 'ml_based', 'rule_based'],
      sensitivityLevel: 'medium',
      learningPeriod: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Predictive analytics
    this.predictiveAnalyzer = new PredictiveAnalyzer({
      models: [
        'time_series_forecast',
        'degradation_model',
        'failure_prediction',
      ],
      predictionHorizon: 30 * 24 * 60 * 60 * 1000, // 30 days
      confidenceThreshold: 0.8,
    });
  }

  @EventHandler('SensorReading')
  async onSensorReading(event: IDomainEvent): Promise<void> {
    const sensorData = event.payload;
    const state = this.getState();

    // Update device information
    await this.updateDeviceInfo(sensorData, state);

    // Store time-series data efficiently
    await this.storeTimeSeriesData(sensorData, state);

    // Update real-time metrics
    this.updateRealTimeMetrics(sensorData, state);

    // Anomaly detection
    const anomaly = await this.anomalyDetector.analyze(sensorData);
    if (anomaly.isAnomaly) {
      await this.handleAnomaly(anomaly, sensorData, state);
    }

    // Predictive analysis (sampled to reduce load)
    if (this.shouldRunPredictiveAnalysis(sensorData)) {
      const prediction = await this.predictiveAnalyzer.analyze(sensorData);
      if (prediction.requiresAction) {
        await this.handlePredictiveInsight(prediction, sensorData, state);
      }
    }

    // Update aggregations
    await this.updateAggregations(sensorData, state);

    this.setState(state);
  }

  private async updateDeviceInfo(sensorData: any, state: any): Promise<void> {
    const deviceId = sensorData.deviceId;

    // Update device registry
    const device = state.devices.get(deviceId) || {
      deviceId,
      deviceType: sensorData.deviceType,
      location: sensorData.location,
      firstSeen: new Date(),
      lastSeen: new Date(),
      firmware: sensorData.firmware,
      model: sensorData.model,
    };

    device.lastSeen = new Date();
    state.devices.set(deviceId, device);

    // Update device health
    const health = state.deviceHealth.get(deviceId) || {
      status: 'unknown',
      batteryLevel: 100,
      signalStrength: 0,
      errorCount: 0,
      uptime: 0,
      lastMaintenance: null,
    };

    // Update health metrics from sensor data
    if (sensorData.batteryLevel !== undefined) {
      health.batteryLevel = sensorData.batteryLevel;
    }

    if (sensorData.signalStrength !== undefined) {
      health.signalStrength = sensorData.signalStrength;
    }

    // Calculate uptime
    const timeDiff = Date.now() - device.firstSeen.getTime();
    health.uptime = timeDiff / (1000 * 60 * 60 * 24); // Days

    // Determine device status
    health.status = this.calculateDeviceStatus(health, sensorData);

    state.deviceHealth.set(deviceId, health);
  }

  private async storeTimeSeriesData(
    sensorData: any,
    state: any
  ): Promise<void> {
    const deviceId = sensorData.deviceId;

    // Get or create compressed time series storage
    let timeSeries = state.timeSeriesData.get(deviceId);
    if (!timeSeries) {
      timeSeries = new CompressedTimeSeries(deviceId, {
        compressionRatio: 10,
        retentionDays: 365,
        aggregationIntervals: ['1m', '5m', '1h', '1d'],
      });
      state.timeSeriesData.set(deviceId, timeSeries);
    }

    // Add data point with compression
    await timeSeries.addDataPoint({
      timestamp: new Date(sensorData.timestamp),
      values: {
        temperature: sensorData.temperature,
        humidity: sensorData.humidity,
        pressure: sensorData.pressure,
        vibration: sensorData.vibration,
        // ... other sensor values
      },
    });
  }

  private updateRealTimeMetrics(sensorData: any, state: any): void {
    const deviceId = sensorData.deviceId;

    const metrics = state.realTimeMetrics.get(deviceId) || {
      currentValues: {},
      trends: {},
      statistics: {
        min: {},
        max: {},
        avg: {},
        stdDev: {},
      },
      dataPointCount: 0,
      lastUpdate: new Date(),
    };

    // Update current values
    metrics.currentValues = {
      temperature: sensorData.temperature,
      humidity: sensorData.humidity,
      pressure: sensorData.pressure,
      vibration: sensorData.vibration,
    };

    // Update running statistics
    Object.keys(metrics.currentValues).forEach(key => {
      const value = metrics.currentValues[key];
      if (value !== undefined) {
        this.updateRunningStats(metrics.statistics, key, value);
      }
    });

    metrics.dataPointCount++;
    metrics.lastUpdate = new Date();

    state.realTimeMetrics.set(deviceId, metrics);
  }

  private async handleAnomaly(
    anomaly: any,
    sensorData: any,
    state: any
  ): Promise<void> {
    const deviceId = sensorData.deviceId;

    // Store anomaly
    const anomalies = state.detectedAnomalies.get(deviceId) || [];
    anomalies.push({
      anomalyId: anomaly.id,
      detectedAt: new Date(),
      severity: anomaly.severity,
      type: anomaly.type,
      affectedMetrics: anomaly.affectedMetrics,
      confidence: anomaly.confidence,
      rootCause: anomaly.rootCause,
    });

    // Keep only recent anomalies (last 1000)
    if (anomalies.length > 1000) {
      anomalies.splice(0, anomalies.length - 1000);
    }

    state.detectedAnomalies.set(deviceId, anomalies);

    // Create alert if severity is high enough
    if (anomaly.severity >= 0.7) {
      await this.createAlert(deviceId, anomaly, state);
    }

    console.log(
      `Anomaly detected for device ${deviceId}: ${anomaly.type} (confidence: ${anomaly.confidence})`
    );
  }

  private async handlePredictiveInsight(
    prediction: any,
    sensorData: any,
    state: any
  ): Promise<void> {
    const deviceId = sensorData.deviceId;

    if (prediction.type === 'maintenance_required') {
      // Schedule maintenance
      const maintenanceItem = {
        deviceId,
        scheduledDate: new Date(Date.now() + prediction.timeToAction),
        priority: prediction.priority,
        predictedIssue: prediction.issue,
        confidence: prediction.confidence,
        createdAt: new Date(),
      };

      state.maintenanceSchedule.set(
        `${deviceId}-${Date.now()}`,
        maintenanceItem
      );

      console.log(
        `Maintenance scheduled for device ${deviceId}: ${prediction.issue}`
      );
    }

    // Update performance trends
    const trends = state.performanceTrends.get(deviceId) || {
      degradationRate: 0,
      predictedFailureDate: null,
      maintenanceScore: 100,
      trendHistory: [],
    };

    trends.degradationRate = prediction.degradationRate;
    trends.predictedFailureDate = prediction.predictedFailureDate;
    trends.maintenanceScore = prediction.maintenanceScore;
    trends.trendHistory.push({
      timestamp: new Date(),
      prediction: prediction.summary,
    });

    // Keep only recent history
    if (trends.trendHistory.length > 100) {
      trends.trendHistory.splice(0, trends.trendHistory.length - 100);
    }

    state.performanceTrends.set(deviceId, trends);
  }

  // Query methods for IoT analytics
  getDeviceMetrics(deviceId: string): any {
    const state = this.getState();
    const device = state.devices.get(deviceId);
    const health = state.deviceHealth.get(deviceId);
    const metrics = state.realTimeMetrics.get(deviceId);
    const anomalies = state.detectedAnomalies.get(deviceId) || [];
    const trends = state.performanceTrends.get(deviceId);

    return {
      device,
      health,
      currentMetrics: metrics?.currentValues,
      statistics: metrics?.statistics,
      recentAnomalies: anomalies.slice(-10), // Last 10 anomalies
      trends,
      lastUpdate: metrics?.lastUpdate,
    };
  }

  getFleetOverview(): any {
    const state = this.getState();
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    let onlineDevices = 0;
    let totalUptime = 0;
    let criticalAlerts = 0;

    for (const [deviceId, health] of state.deviceHealth) {
      const device = state.devices.get(deviceId);

      // Count online devices (active within last hour)
      if (device && device.lastSeen > oneHourAgo) {
        onlineDevices++;
      }

      totalUptime += health.uptime || 0;

      // Count critical alerts
      const alerts = state.activeAlerts.get(deviceId) || [];
      criticalAlerts += alerts.filter(a => a.severity === 'critical').length;
    }

    const totalDevices = state.devices.size;
    const averageUptime = totalDevices > 0 ? totalUptime / totalDevices : 0;

    return {
      totalDevices,
      onlineDevices,
      offlineDevices: totalDevices - onlineDevices,
      averageUptime: Math.round(averageUptime * 100) / 100, // Round to 2 decimals
      criticalAlerts,
      totalDataPoints: state.fleetMetrics.totalDataPoints,
      healthScore: this.calculateFleetHealthScore(state),
    };
  }

  getAnomaliesForTimeRange(
    deviceId: string,
    startTime: Date,
    endTime: Date
  ): any[] {
    const anomalies = this.getState().detectedAnomalies.get(deviceId) || [];

    return anomalies.filter(anomaly => {
      const detectedAt = new Date(anomaly.detectedAt);
      return detectedAt >= startTime && detectedAt <= endTime;
    });
  }

  getPredictiveMaintenanceSchedule(): any[] {
    const maintenanceItems = Array.from(
      this.getState().maintenanceSchedule.values()
    );

    return maintenanceItems
      .sort(
        (a, b) =>
          new Date(a.scheduledDate).getTime() -
          new Date(b.scheduledDate).getTime()
      )
      .map(item => ({
        ...item,
        daysUntilMaintenance: Math.ceil(
          (new Date(item.scheduledDate).getTime() - Date.now()) /
            (24 * 60 * 60 * 1000)
        ),
      }));
  }

  getTimeSeriesData(
    deviceId: string,
    metric: string,
    startTime: Date,
    endTime: Date
  ): any[] {
    const timeSeries = this.getState().timeSeriesData.get(deviceId);

    if (!timeSeries) {
      return [];
    }

    return timeSeries.getDataRange(metric, startTime, endTime);
  }

  // Helper methods
  private calculateDeviceStatus(health: any, sensorData: any): string {
    if (health.batteryLevel < 10) return 'critical';
    if (health.signalStrength < 20) return 'poor_connectivity';
    if (health.errorCount > 10) return 'degraded';

    // Check if data is recent
    const lastUpdate = new Date(sensorData.timestamp);
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    if (lastUpdate < fiveMinutesAgo) return 'stale';

    return 'healthy';
  }

  private updateRunningStats(stats: any, key: string, value: number): void {
    if (!stats[key]) {
      stats[key] = {
        min: value,
        max: value,
        sum: value,
        count: 1,
        sumSquares: value * value,
      };
    } else {
      const stat = stats[key];
      stat.min = Math.min(stat.min, value);
      stat.max = Math.max(stat.max, value);
      stat.sum += value;
      stat.count++;
      stat.sumSquares += value * value;

      // Calculate running average and std deviation
      stat.avg = stat.sum / stat.count;
      stat.stdDev = Math.sqrt(
        stat.sumSquares / stat.count - stat.avg * stat.avg
      );
    }
  }

  private async createAlert(
    deviceId: string,
    anomaly: any,
    state: any
  ): Promise<void> {
    const alert = {
      alertId: `alert-${Date.now()}-${Math.random()}`,
      deviceId,
      type: 'anomaly',
      severity: anomaly.severity > 0.9 ? 'critical' : 'warning',
      message: `Anomaly detected: ${anomaly.type}`,
      createdAt: new Date(),
      acknowledged: false,
      anomalyDetails: anomaly,
    };

    const alerts = state.activeAlerts.get(deviceId) || [];
    alerts.push(alert);
    state.activeAlerts.set(deviceId, alerts);
  }

  private shouldRunPredictiveAnalysis(sensorData: any): boolean {
    // Run predictive analysis for 1% of readings to balance performance
    return Math.random() < 0.01;
  }

  private async updateAggregations(sensorData: any, state: any): Promise<void> {
    // Update site-level metrics
    const siteId = sensorData.siteId || 'unknown';
    const siteMetrics = state.siteMetrics.get(siteId) || {
      deviceCount: 0,
      averageTemperature: 0,
      averageHumidity: 0,
      totalDataPoints: 0,
    };

    // Update site aggregations
    siteMetrics.totalDataPoints++;
    if (sensorData.temperature) {
      siteMetrics.averageTemperature =
        (siteMetrics.averageTemperature * (siteMetrics.totalDataPoints - 1) +
          sensorData.temperature) /
        siteMetrics.totalDataPoints;
    }

    state.siteMetrics.set(siteId, siteMetrics);

    // Update fleet metrics
    state.fleetMetrics.totalDataPoints++;
    state.fleetMetrics.totalDevices = state.devices.size;

    // Count online devices (updated in real-time)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    state.fleetMetrics.onlineDevices = Array.from(
      state.devices.values()
    ).filter(device => device.lastSeen > oneHourAgo).length;
  }

  private calculateFleetHealthScore(state: any): number {
    const totalDevices = state.devices.size;
    if (totalDevices === 0) return 100;

    let healthyDevices = 0;
    for (const [deviceId, health] of state.deviceHealth) {
      if (health.status === 'healthy') {
        healthyDevices++;
      }
    }

    return Math.round((healthyDevices / totalDevices) * 100);
  }
}

// Supporting classes for IoT processing
class CompressedTimeSeries {
  private data: Map<string, any[]> = new Map();

  constructor(
    private deviceId: string,
    private config: any
  ) {}

  async addDataPoint(dataPoint: any): Promise<void> {
    const timestamp = dataPoint.timestamp;
    const values = dataPoint.values;

    // Store compressed data points
    Object.keys(values).forEach(metric => {
      if (!this.data.has(metric)) {
        this.data.set(metric, []);
      }

      const metricData = this.data.get(metric)!;
      metricData.push({
        timestamp,
        value: values[metric],
      });

      // Apply retention policy
      this.applyRetentionPolicy(metricData);
    });
  }

  getDataRange(metric: string, startTime: Date, endTime: Date): any[] {
    const metricData = this.data.get(metric) || [];

    return metricData.filter(
      point => point.timestamp >= startTime && point.timestamp <= endTime
    );
  }

  private applyRetentionPolicy(metricData: any[]): void {
    const retentionMs = this.config.retentionDays * 24 * 60 * 60 * 1000;
    const cutoffTime = new Date(Date.now() - retentionMs);

    // Remove old data points
    const validIndex = metricData.findIndex(
      point => point.timestamp >= cutoffTime
    );
    if (validIndex > 0) {
      metricData.splice(0, validIndex);
    }
  }
}

class AnomalyDetector {
  constructor(private config: any) {}

  async analyze(sensorData: any): Promise<any> {
    // Simplified anomaly detection
    const anomaly = {
      id: `anomaly-${Date.now()}`,
      isAnomaly: Math.random() < 0.05, // 5% chance for demo
      severity: Math.random(),
      type: 'statistical_outlier',
      confidence: Math.random() * 0.5 + 0.5, // 0.5-1.0
      affectedMetrics: ['temperature'],
      rootCause: 'sensor_drift',
    };

    return anomaly;
  }
}

class PredictiveAnalyzer {
  constructor(private config: any) {}

  async analyze(sensorData: any): Promise<any> {
    // Simplified predictive analysis
    const prediction = {
      type: 'maintenance_required',
      requiresAction: Math.random() < 0.02, // 2% chance for demo
      timeToAction: 7 * 24 * 60 * 60 * 1000, // 7 days
      priority: 'medium',
      issue: 'bearing_wear',
      confidence: Math.random() * 0.3 + 0.7, // 0.7-1.0
      degradationRate: Math.random() * 0.1,
      predictedFailureDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      maintenanceScore: Math.random() * 40 + 60, // 60-100
      summary: 'Gradual degradation detected in bearing performance',
    };

    return prediction;
  }
}
```

## Business Impact Analysis

### **High-Frequency Trading Platform**

- **Latency Reduction**: Sub-millisecond event processing enables competitive
  advantage
- **Risk Management**: Real-time risk calculations prevent significant losses
- **Signal Generation**: Automated trading signals improve decision accuracy
- **Cost Savings**: Reduced manual monitoring and analysis overhead

### **Global SaaS Platform**

- **Compliance Achievement**: 100% GDPR, SOX, HIPAA compliance across all
  regions
- **Operational Efficiency**: Multi-region deployment with 99.99% uptime SLA
- **Customer Insights**: Deep analytics drive product development decisions
- **Risk Mitigation**: Cross-region replication ensures business continuity

### **IoT Sensor Platform**

- **Predictive Maintenance**: 40% reduction in unplanned downtime
- **Operational Costs**: 25% reduction in maintenance costs through optimization
- **Asset Utilization**: Improved equipment effectiveness through real-time
  monitoring
- **Safety Improvements**: Proactive anomaly detection prevents critical
  failures

## Technical Benefits

### **Performance Improvements**

- **Throughput**: Handle 100,000+ events per second
- **Latency**: Sub-millisecond response times for critical operations
- **Memory Efficiency**: Compressed time-series storage reduces memory usage by
  80%
- **Query Performance**: Real-time queries with millisecond response times

### **Scalability Achievements**

- **Horizontal Scaling**: Linear scalability across multiple nodes
- **Multi-Tenant Isolation**: Secure data isolation for thousands of tenants
- **Global Distribution**: Multi-region deployment with local data residency
- **Elastic Resources**: Dynamic scaling based on load patterns

### **Reliability Features**

- **Error Recovery**: Comprehensive error handling with automatic recovery
- **Data Consistency**: Eventual consistency with configurable strong
  consistency
- **Backup/Recovery**: Point-in-time recovery with snapshot capabilities
- **Monitoring**: Real-time health monitoring with predictive alerting

## Implementation Considerations

### **Development Complexity**

- **Expert Level**: Requires deep understanding of event sourcing and projection
  patterns
- **Team Skills**: Need experienced developers familiar with distributed systems
- **Testing Challenges**: Complex scenarios require comprehensive integration
  testing
- **Monitoring Requirements**: Extensive observability and alerting
  infrastructure

### **Infrastructure Requirements**

- **Hardware Resources**: High-performance computing for real-time processing
- **Network Bandwidth**: Significant bandwidth for high-frequency data streams
- **Storage Systems**: Fast storage for time-series data and query performance
- **Backup Systems**: Robust backup and disaster recovery capabilities

### **Operational Overhead**

- **24/7 Monitoring**: Continuous monitoring and alerting requirements
- **Skilled Operations**: Need experienced operations team for complex systems
- **Maintenance Windows**: Coordination required for multi-region deployments
- **Compliance Auditing**: Regular compliance reviews and documentation

## Related Examples

- [Projection Rebuilding System](./example-1.md)
- [Event Stream Processing](./example-2.md)
- [Multi-Tenant Projections](./example-3.md)
- [Intermediate Implementation Guide](./implementation.md)
- [Simple Event Projection](../basic/example-1.md)
