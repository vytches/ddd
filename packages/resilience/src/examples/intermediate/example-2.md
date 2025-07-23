# Composite Resilience Strategy with Policy Chaining

**Version**: 1.0.0 **Package**: @vytches-ddd/resilience **Complexity**:
Intermediate **Domain**: Financial Trading Platform **Patterns**: Composite
Strategy, Policy Chaining, Advanced Configuration **Dependencies**:
@vytches-ddd/resilience

## Description

This example demonstrates how to combine multiple resilience patterns into a
composite strategy with intelligent policy chaining. The system automatically
applies circuit breakers, retries, timeouts, and bulkheads in coordinated ways
based on failure patterns and business context.

## Business Context

A financial trading platform needs robust resilience for order execution across
multiple markets and brokers. Different failure scenarios require different
combinations of resilience patterns. For example, network timeouts need retries
with circuit breaker protection, while rate limiting requires bulkhead isolation
with exponential backoff.

## Code Example

```typescript
// composite-resilience-strategy.ts
import {
  CompositeResilienceStrategy,
  ResiliencePolicyBuilder,
  ResilienceContext,
  CircuitBreakerStrategy,
  RetryStrategy,
  BulkheadStrategy,
  TimeoutStrategy,
} from '@vytches-ddd/resilience';
import {
  PaymentRequest,
  ExternalServiceConfig,
  ResilienceMetrics,
} from './types'; // From your application

// Advanced composite resilience for financial trading
export class TradingResilienceManager {
  private orderExecutionStrategy: CompositeResilienceStrategy;
  private marketDataStrategy: CompositeResilienceStrategy;
  private riskAssessmentStrategy: CompositeResilienceStrategy;
  private complianceCheckStrategy: CompositeResilienceStrategy;

  constructor() {
    this.initializeOrderExecutionStrategy();
    this.initializeMarketDataStrategy();
    this.initializeRiskAssessmentStrategy();
    this.initializeComplianceCheckStrategy();
  }

  async executeTradeOrder(order: TradeOrder): Promise<TradeExecutionResult> {
    const context: ResilienceContext = {
      operationId: 'execute-trade-order',
      correlationId: order.orderId,
      userId: order.traderId,
      startTime: new Date(),
      attempt: 1,
      previousAttempts: [],
      metadata: {
        orderType: order.type,
        symbol: order.symbol,
        value: order.quantity * order.price,
        priority: this.calculateOrderPriority(order),
      },
    };

    try {
      // Step 1: Risk assessment with specialized resilience
      const riskResult = await this.riskAssessmentStrategy.execute(
        () => this.performRiskAssessment(order),
        context
      );

      if (riskResult.riskLevel === 'HIGH') {
        return {
          orderId: order.orderId,
          status: 'rejected',
          reason: 'Risk assessment failed',
          riskDetails: riskResult,
        };
      }

      // Step 2: Compliance check with regulatory focus
      const complianceResult = await this.complianceCheckStrategy.execute(
        () => this.performComplianceCheck(order),
        context
      );

      if (!complianceResult.approved) {
        return {
          orderId: order.orderId,
          status: 'rejected',
          reason: 'Compliance check failed',
          complianceDetails: complianceResult,
        };
      }

      // Step 3: Market data retrieval with high-frequency resilience
      const marketData = await this.marketDataStrategy.execute(
        () => this.getCurrentMarketData(order.symbol),
        context
      );

      // Step 4: Order execution with comprehensive protection
      const executionResult = await this.orderExecutionStrategy.execute(
        () => this.executeOrderWithBroker(order, marketData),
        { ...context, metadata: { ...context.metadata, marketData } }
      );

      return {
        orderId: order.orderId,
        status: 'executed',
        executionPrice: executionResult.executionPrice,
        executionTime: executionResult.executionTime,
        brokerId: executionResult.brokerId,
        transactionId: executionResult.transactionId,
        marketData,
        riskAssessment: riskResult,
        complianceCheck: complianceResult,
      };
    } catch (error) {
      console.error(
        `Trade execution failed for order ${order.orderId}:`,
        error
      );

      return {
        orderId: order.orderId,
        status: 'failed',
        reason: error.message,
        failureType: this.classifyFailure(error),
        recommendedAction: this.getRecommendedAction(error),
      };
    }
  }

  private initializeOrderExecutionStrategy(): void {
    // Order execution needs: Circuit breaker → Retry → Timeout → Bulkhead
    this.orderExecutionStrategy = ResiliencePolicyBuilder.createComposite()
      .withCircuitBreaker({
        failureThreshold: 3, // Financial systems are sensitive
        resetTimeout: 30000, // Quick recovery attempts
        halfOpenMaxCalls: 2, // Conservative testing
        monitoringWindow: 120000, // 2-minute monitoring
      })
      .withRetry({
        maxAttempts: 2, // Limited retries for orders
        baseDelay: 1000,
        maxDelay: 5000,
        backoff: 'exponential',
        jitter: true,
        retryCondition: error => this.isRetryableTradeError(error),
      })
      .withTimeout({
        defaultTimeout: 10000, // 10-second order timeout
        operationTimeouts: {
          'high-priority': 5000, // Faster timeout for urgent orders
          'market-order': 8000, // Standard market orders
          'limit-order': 15000, // More time for limit orders
        },
        timeoutStrategy: 'abort', // Immediate abort for trading
      })
      .withBulkhead({
        maxConcurrency: 5, // Limit concurrent order executions
        queueSize: 20,
        queueTimeout: 30000,
        rejectionStrategy: 'fail', // Fail fast during high load
      })
      .build();
  }

  private initializeMarketDataStrategy(): void {
    // Market data needs: Timeout → Circuit breaker → Bulkhead (no retry for stale data)
    this.marketDataStrategy = ResiliencePolicyBuilder.createComposite()
      .withTimeout({
        defaultTimeout: 2000, // Very fast market data timeout
        timeoutStrategy: 'abort',
      })
      .withCircuitBreaker({
        failureThreshold: 5,
        resetTimeout: 10000, // Quick recovery for market data
        halfOpenMaxCalls: 3,
      })
      .withBulkhead({
        maxConcurrency: 15, // Higher concurrency for market data
        queueSize: 50,
        queueTimeout: 5000,
        rejectionStrategy: 'drop', // Drop old market data requests
      })
      .build();
  }

  private initializeRiskAssessmentStrategy(): void {
    // Risk assessment needs: Bulkhead → Timeout → Retry → Circuit breaker
    this.riskAssessmentStrategy = ResiliencePolicyBuilder.createComposite()
      .withBulkhead({
        maxConcurrency: 3, // Limited risk assessment capacity
        queueSize: 10,
        queueTimeout: 60000, // Allow time for risk calculations
        rejectionStrategy: 'wait',
      })
      .withTimeout({
        defaultTimeout: 30000, // 30-second risk assessment timeout
        timeoutStrategy: 'graceful',
      })
      .withRetry({
        maxAttempts: 3,
        baseDelay: 2000,
        maxDelay: 10000,
        backoff: 'linear',
        retryCondition: error => this.isRetryableRiskError(error),
      })
      .withCircuitBreaker({
        failureThreshold: 4,
        resetTimeout: 60000, // Longer recovery for risk systems
        halfOpenMaxCalls: 1,
      })
      .build();
  }

  private initializeComplianceCheckStrategy(): void {
    // Compliance needs: Circuit breaker → Timeout → Retry (no bulkhead - must process all)
    this.complianceCheckStrategy = ResiliencePolicyBuilder.createComposite()
      .withCircuitBreaker({
        failureThreshold: 2, // Very sensitive for compliance
        resetTimeout: 120000, // Conservative recovery
        halfOpenMaxCalls: 1,
        monitoringWindow: 300000, // 5-minute monitoring
      })
      .withTimeout({
        defaultTimeout: 20000, // 20-second compliance timeout
        timeoutStrategy: 'graceful',
      })
      .withRetry({
        maxAttempts: 4, // More retries for compliance
        baseDelay: 3000,
        maxDelay: 15000,
        backoff: 'exponential',
        jitter: false, // No jitter for compliance consistency
        retryCondition: error => this.isRetryableComplianceError(error),
      })
      .build();
  }

  private async performRiskAssessment(
    order: TradeOrder
  ): Promise<RiskAssessmentResult> {
    console.log(`Performing risk assessment for order ${order.orderId}`);

    // Simulate complex risk calculation
    await this.sleep(Math.random() * 3000 + 1000); // 1-4 seconds

    const riskFactors = {
      positionSize: order.quantity * order.price,
      marketVolatility: Math.random() * 0.5 + 0.1,
      traderHistory: Math.random(),
      marketConditions: Math.random(),
    };

    const riskScore =
      Object.values(riskFactors).reduce((sum, factor) => sum + factor, 0) / 4;

    return {
      riskLevel: riskScore > 0.7 ? 'HIGH' : riskScore > 0.4 ? 'MEDIUM' : 'LOW',
      riskScore,
      riskFactors,
      assessmentTime: new Date(),
      approved: riskScore <= 0.7,
    };
  }

  private async performComplianceCheck(
    order: TradeOrder
  ): Promise<ComplianceResult> {
    console.log(`Performing compliance check for order ${order.orderId}`);

    // Simulate regulatory compliance check
    await this.sleep(Math.random() * 2000 + 500); // 0.5-2.5 seconds

    const checks = {
      kycVerified: Math.random() > 0.05, // 95% pass rate
      tradingLimits: Math.random() > 0.02, // 98% pass rate
      marketRestrictions: Math.random() > 0.01, // 99% pass rate
      regulatoryRules: Math.random() > 0.03, // 97% pass rate
    };

    const approved = Object.values(checks).every(check => check);

    return {
      approved,
      checks,
      complianceScore:
        Object.values(checks).filter(Boolean).length /
        Object.keys(checks).length,
      checkTime: new Date(),
      regulatoryReference: approved ? `COMP-${Date.now()}` : undefined,
    };
  }

  private async getCurrentMarketData(symbol: string): Promise<MarketData> {
    console.log(`Retrieving market data for ${symbol}`);

    // Simulate fast market data retrieval
    await this.sleep(Math.random() * 500 + 100); // 100-600ms

    const basePrice = 100 + Math.random() * 50; // $100-150 base price

    return {
      symbol,
      currentPrice: basePrice + (Math.random() - 0.5) * 2, // ±$1 variation
      bidPrice: basePrice - Math.random() * 0.5,
      askPrice: basePrice + Math.random() * 0.5,
      volume: Math.floor(Math.random() * 1000000),
      timestamp: new Date(),
      marketStatus: 'OPEN',
    };
  }

  private async executeOrderWithBroker(
    order: TradeOrder,
    marketData: MarketData
  ): Promise<ExecutionResult> {
    console.log(`Executing order ${order.orderId} with broker`);

    // Simulate broker execution
    await this.sleep(Math.random() * 2000 + 500); // 0.5-2.5 seconds

    // Simulate execution slippage
    const slippage = (Math.random() - 0.5) * 0.02; // ±1% slippage
    const executionPrice = marketData.currentPrice * (1 + slippage);

    return {
      executionPrice,
      executionTime: new Date(),
      brokerId: `BROKER-${Math.floor(Math.random() * 5) + 1}`,
      transactionId: `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      slippage: slippage * 100, // Convert to percentage
    };
  }

  private calculateOrderPriority(order: TradeOrder): 'low' | 'medium' | 'high' {
    const orderValue = order.quantity * order.price;

    if (orderValue > 1000000) return 'high'; // $1M+ orders
    if (orderValue > 100000) return 'medium'; // $100K+ orders
    return 'low'; // < $100K orders
  }

  private isRetryableTradeError(error: Error): boolean {
    const retryableErrors = [
      'NETWORK_TIMEOUT',
      'BROKER_TEMPORARILY_UNAVAILABLE',
      'RATE_LIMITED',
      'SERVICE_BUSY',
    ];
    return retryableErrors.some(errorType => error.message.includes(errorType));
  }

  private isRetryableRiskError(error: Error): boolean {
    const retryableErrors = [
      'RISK_ENGINE_TIMEOUT',
      'DATA_TEMPORARILY_UNAVAILABLE',
      'CALCULATION_IN_PROGRESS',
    ];
    return retryableErrors.some(errorType => error.message.includes(errorType));
  }

  private isRetryableComplianceError(error: Error): boolean {
    const retryableErrors = [
      'COMPLIANCE_SYSTEM_BUSY',
      'REGULATORY_DATABASE_TIMEOUT',
      'VERIFICATION_IN_PROGRESS',
    ];
    return retryableErrors.some(errorType => error.message.includes(errorType));
  }

  private classifyFailure(error: Error): string {
    if (error.message.includes('CIRCUIT_BREAKER_OPEN'))
      return 'Circuit Breaker';
    if (error.message.includes('TIMEOUT')) return 'Timeout';
    if (error.message.includes('BULKHEAD_REJECTED'))
      return 'Resource Exhaustion';
    if (error.message.includes('RETRY_EXHAUSTED')) return 'Persistent Failure';
    return 'Unknown Failure';
  }

  private getRecommendedAction(error: Error): string {
    const failureType = this.classifyFailure(error);

    switch (failureType) {
      case 'Circuit Breaker':
        return 'Wait for service recovery, monitor circuit breaker status';
      case 'Timeout':
        return 'Check network connectivity and service performance';
      case 'Resource Exhaustion':
        return 'Reduce request rate or increase system capacity';
      case 'Persistent Failure':
        return 'Check service health and consider manual intervention';
      default:
        return 'Review error details and contact support if needed';
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Monitoring and management methods
  getResilienceMetrics(): ResilienceMetrics {
    return {
      orderExecution: this.orderExecutionStrategy.getMetrics(),
      marketData: this.marketDataStrategy.getMetrics(),
      riskAssessment: this.riskAssessmentStrategy.getMetrics(),
      complianceCheck: this.complianceCheckStrategy.getMetrics(),
      timestamp: new Date(),
    };
  }

  async adjustResiliencePolicy(
    strategyType:
      | 'orderExecution'
      | 'marketData'
      | 'riskAssessment'
      | 'complianceCheck',
    adjustments: PolicyAdjustments
  ): Promise<void> {
    const strategy = this.getStrategy(strategyType);

    if (adjustments.circuitBreaker) {
      await strategy.updateCircuitBreakerConfig(adjustments.circuitBreaker);
    }

    if (adjustments.retry) {
      await strategy.updateRetryConfig(adjustments.retry);
    }

    if (adjustments.timeout) {
      await strategy.updateTimeoutConfig(adjustments.timeout);
    }

    if (adjustments.bulkhead) {
      await strategy.updateBulkheadConfig(adjustments.bulkhead);
    }

    console.log(`Updated resilience policy for ${strategyType}`);
  }

  private getStrategy(strategyType: string): CompositeResilienceStrategy {
    switch (strategyType) {
      case 'orderExecution':
        return this.orderExecutionStrategy;
      case 'marketData':
        return this.marketDataStrategy;
      case 'riskAssessment':
        return this.riskAssessmentStrategy;
      case 'complianceCheck':
        return this.complianceCheckStrategy;
      default:
        throw new Error(`Unknown strategy type: ${strategyType}`);
    }
  }
}

// Supporting types
interface TradeOrder {
  orderId: string;
  traderId: string;
  symbol: string;
  type: 'market' | 'limit' | 'stop';
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  timeInForce: 'GTC' | 'IOC' | 'FOK';
  createdAt: Date;
}

interface TradeExecutionResult {
  orderId: string;
  status: 'executed' | 'rejected' | 'failed';
  executionPrice?: number;
  executionTime?: Date;
  brokerId?: string;
  transactionId?: string;
  marketData?: MarketData;
  riskAssessment?: RiskAssessmentResult;
  complianceCheck?: ComplianceResult;
  reason?: string;
  riskDetails?: any;
  complianceDetails?: any;
  failureType?: string;
  recommendedAction?: string;
}

interface RiskAssessmentResult {
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  riskScore: number;
  riskFactors: Record<string, number>;
  assessmentTime: Date;
  approved: boolean;
}

interface ComplianceResult {
  approved: boolean;
  checks: Record<string, boolean>;
  complianceScore: number;
  checkTime: Date;
  regulatoryReference?: string;
}

interface MarketData {
  symbol: string;
  currentPrice: number;
  bidPrice: number;
  askPrice: number;
  volume: number;
  timestamp: Date;
  marketStatus: string;
}

interface ExecutionResult {
  executionPrice: number;
  executionTime: Date;
  brokerId: string;
  transactionId: string;
  slippage: number;
}

interface PolicyAdjustments {
  circuitBreaker?: any;
  retry?: any;
  timeout?: any;
  bulkhead?: any;
}

// Usage example
const tradingResilience = new TradingResilienceManager();

const sampleOrder: TradeOrder = {
  orderId: 'ORD-2024-001',
  traderId: 'trader-123',
  symbol: 'AAPL',
  type: 'market',
  side: 'buy',
  quantity: 100,
  price: 150.5,
  timeInForce: 'GTC',
  createdAt: new Date(),
};

// Execute trade with comprehensive resilience
tradingResilience
  .executeTradeOrder(sampleOrder)
  .then(result => {
    console.log('Trade execution result:', result);

    if (result.status === 'executed') {
      console.log(
        `Order executed at $${result.executionPrice} via ${result.brokerId}`
      );
    } else {
      console.log(`Order ${result.status}: ${result.reason}`);
      if (result.recommendedAction) {
        console.log(`Recommended action: ${result.recommendedAction}`);
      }
    }
  })
  .catch(error => {
    console.error('Trade execution failed:', error);
  });

// Monitor resilience metrics
setInterval(() => {
  const metrics = tradingResilience.getResilienceMetrics();
  console.log('Resilience Metrics:', {
    orderExecution: `${metrics.orderExecution.successRate}% success`,
    marketData: `${metrics.marketData.averageResponseTime}ms avg response`,
    riskAssessment: `${metrics.riskAssessment.circuitBreakerState} CB state`,
    complianceCheck: `${metrics.complianceCheck.activeExecutions} active checks`,
  });
}, 30000); // Every 30 seconds
```

## Key Features

- **Policy Chaining**: Combines multiple resilience patterns intelligently
- **Context-Aware Configuration**: Different strategies for different operations
- **Business-Specific Logic**: Financial trading optimizations
- **Failure Classification**: Categorizes failures for appropriate responses
- **Dynamic Adjustment**: Runtime policy modification capabilities
- **Comprehensive Monitoring**: Detailed metrics across all strategies

## Strategy Combinations

1. **Order Execution**: Circuit Breaker → Retry → Timeout → Bulkhead
2. **Market Data**: Timeout → Circuit Breaker → Bulkhead (no retry for stale
   data)
3. **Risk Assessment**: Bulkhead → Timeout → Retry → Circuit Breaker
4. **Compliance Check**: Circuit Breaker → Timeout → Retry (no bulkhead)

## Common Pitfalls

- **Pattern Conflicts**: Inappropriate combinations of resilience patterns
- **Over-Engineering**: Too many patterns for simple operations
- **Configuration Drift**: Patterns becoming misaligned over time
- **Monitoring Gaps**: Not tracking effectiveness of composite strategies

## Related Examples

- [Adaptive Timeout Strategy](./example-1.md)
- [Health Check Integration](./example-3.md)
- [Enterprise Resilience Orchestration](../advanced/example-1.md)
