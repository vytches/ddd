# Messaging with Events & Resilience Implementation

**Focus**: Advanced messaging patterns integrated with events system and
resilience  
**Domain**: Financial Trading Platform  
**Complexity**: Intermediate  
**Dependencies**: @vytches-ddd/messaging, @vytches-ddd/events,
@vytches-ddd/resilience, @vytches-ddd/di

## Business Context

This example demonstrates advanced messaging patterns for a financial trading
platform that requires:

- Integration with unified event system for comprehensive observability
- Resilience patterns for reliable message processing
- Event-driven outbox processing with circuit breaker protection
- Real-time trade settlement messaging with fault tolerance
- Message correlation and audit trail for regulatory compliance

## Implementation

```typescript
// trading-messages.ts
import { OutboxMessage, MessagePriority } from '@vytches-ddd/messaging';
import { DomainEvent, IntegrationEvent } from '@vytches-ddd/events';
import { Trade, Settlement, Position, RiskAlert } from '../types'; // ALWAYS import from app

// Trading domain events that trigger messaging
export class TradeExecutedEvent extends DomainEvent {
  constructor(
    public readonly tradeId: string,
    public readonly accountId: string,
    public readonly symbol: string,
    public readonly side: 'buy' | 'sell',
    public readonly quantity: number,
    public readonly price: number,
    public readonly executedAt: Date
  ) {
    super('TradeExecuted', {
      tradeId,
      accountId,
      symbol,
      side,
      quantity,
      price,
      executedAt,
    });
  }
}

export class SettlementRequiredEvent extends DomainEvent {
  constructor(
    public readonly tradeId: string,
    public readonly settlementDate: Date,
    public readonly amount: number,
    public readonly currency: string,
    public readonly counterparty: string
  ) {
    super('SettlementRequired', {
      tradeId,
      settlementDate,
      amount,
      currency,
      counterparty,
    });
  }
}

export class RiskLimitBreachedEvent extends DomainEvent {
  constructor(
    public readonly accountId: string,
    public readonly riskType: string,
    public readonly currentValue: number,
    public readonly limitValue: number,
    public readonly severity: 'warning' | 'critical'
  ) {
    super('RiskLimitBreached', {
      accountId,
      riskType,
      currentValue,
      limitValue,
      severity,
    });
  }
}

// Outbox message types for external systems
export interface TradeConfirmationMessage extends OutboxMessage {
  type: 'trade-confirmation';
  payload: {
    tradeId: string;
    accountId: string;
    symbol: string;
    side: 'buy' | 'sell';
    quantity: number;
    price: number;
    executedAt: Date;
    confirmationNumber: string;
  };
}

export interface SettlementInstructionMessage extends OutboxMessage {
  type: 'settlement-instruction';
  payload: {
    tradeId: string;
    instructionId: string;
    settlementDate: Date;
    amount: number;
    currency: string;
    counterparty: string;
    instructions: string;
  };
}

export interface RiskAlertMessage extends OutboxMessage {
  type: 'risk-alert';
  payload: {
    accountId: string;
    alertId: string;
    riskType: string;
    severity: 'warning' | 'critical';
    currentValue: number;
    limitValue: number;
    alertedAt: Date;
  };
}

// resilient-outbox-service.ts
import {
  OutboxService,
  OutboxMessage,
  MessageProcessor,
  OutboxRepository,
} from '@vytches-ddd/messaging';
import { UnifiedEventBus } from '@vytches-ddd/events';
import {
  CircuitBreaker,
  RetryStrategy,
  TimeoutStrategy,
  ResiliencePolicyBuilder,
} from '@vytches-ddd/resilience';
import { DomainService, ServiceLifetime } from '@vytches-ddd/di';
import { Logger } from '@vytches-ddd/logging';
import { Result } from '@vytches-ddd/utils';

// ⭐ Resilient Outbox Service with Events Integration
@DomainService('resilientOutboxService', {
  lifetime: ServiceLifetime.Singleton,
  context: 'TradingMessaging',
})
export class ResilientOutboxService extends OutboxService {
  private logger = Logger.forContext('ResilientOutboxService');
  private resiliencePolicy: any;
  private processingInterval: NodeJS.Timer;
  private metricsCollector: OutboxMetricsCollector;

  constructor(
    outboxRepository: OutboxRepository,
    private messageProcessor: MessageProcessor,
    private eventBus: UnifiedEventBus
  ) {
    super(outboxRepository);
    this.initializeResiliencePolicy();
    this.metricsCollector = new OutboxMetricsCollector(this.eventBus);
    this.startResilientProcessing();
  }

  private initializeResiliencePolicy(): void {
    this.resiliencePolicy = ResiliencePolicyBuilder.create()
      .withCircuitBreaker({
        name: 'OutboxMessageProcessor',
        failureThreshold: 5,
        recoveryTimeout: 30000,
        monitoringPeriod: 60000,
        onStateChange: (previous, current, reason) => {
          this.handleCircuitBreakerStateChange(previous, current, reason);
        },
      })
      .withRetry({
        maxAttempts: 3,
        baseDelay: 1000,
        maxDelay: 10000,
        backoffMultiplier: 2,
        jitter: true,
        shouldRetry: error => {
          // Retry on transient errors
          return (
            error.message.includes('timeout') ||
            error.message.includes('unavailable') ||
            error.message.includes('connection')
          );
        },
      })
      .withTimeout({
        timeout: 15000,
      })
      .withBulkhead({
        maxConcurrentCalls: 10,
        maxQueueSize: 50,
      })
      .build();
  }

  private async handleCircuitBreakerStateChange(
    previousState: string,
    currentState: string,
    reason: string
  ): Promise<void> {
    this.logger.info('Outbox circuit breaker state changed', {
      previousState,
      currentState,
      reason,
    });

    // Publish event about circuit breaker state change
    await this.eventBus.publish({
      eventType: 'OutboxCircuitBreakerStateChanged',
      payload: {
        previousState,
        currentState,
        reason,
        serviceName: 'OutboxService',
        timestamp: new Date(),
      },
    });
  }

  // Enhanced message processing with resilience
  async processMessages(): Promise<Result<number, Error>> {
    try {
      this.logger.debug('Starting resilient message processing');

      const result = await this.resiliencePolicy.execute(async () => {
        return await this.processMessagesWithResilience();
      });

      this.logger.info('Message processing completed', {
        processedCount: result,
      });

      // Publish processing metrics
      await this.publishProcessingMetrics(result);

      return Result.success(result);
    } catch (error) {
      this.logger.error('Message processing failed', {
        error: error.message,
      });

      // Publish failure event
      await this.eventBus.publish({
        eventType: 'OutboxProcessingFailed',
        payload: {
          error: error.message,
          timestamp: new Date(),
        },
      });

      return Result.failure(error);
    }
  }

  private async processMessagesWithResilience(): Promise<number> {
    const pendingMessages = await this.getPendingMessages();

    if (pendingMessages.isFailure()) {
      throw pendingMessages.error;
    }

    const messages = pendingMessages.value;
    let processedCount = 0;

    for (const message of messages) {
      try {
        const result = await this.processMessageWithResilience(message);
        if (result.isSuccess()) {
          processedCount++;
          this.metricsCollector.recordSuccess(message);
        } else {
          this.metricsCollector.recordFailure(message, result.error);
        }
      } catch (error) {
        this.metricsCollector.recordFailure(message, error);
        this.logger.error('Message processing failed', {
          messageId: message.id,
          messageType: message.type,
          error: error.message,
        });
      }
    }

    return processedCount;
  }

  private async processMessageWithResilience(
    message: OutboxMessage
  ): Promise<Result<void, Error>> {
    try {
      // Mark message as processing
      await this.markMessageAsProcessing(message.id);

      // Publish event about message processing start
      await this.eventBus.publish({
        eventType: 'OutboxMessageProcessingStarted',
        payload: {
          messageId: message.id,
          messageType: message.type,
          priority: message.priority,
          timestamp: new Date(),
        },
      });

      // Process message with resilience
      const result = await this.resiliencePolicy.execute(async () => {
        return await this.messageProcessor.process(message);
      });

      if (result.isSuccess()) {
        // Mark as processed
        await this.markMessageAsProcessed(message.id);

        // Publish success event
        await this.eventBus.publish({
          eventType: 'OutboxMessageProcessed',
          payload: {
            messageId: message.id,
            messageType: message.type,
            processedAt: new Date(),
          },
        });

        this.logger.info('Message processed successfully', {
          messageId: message.id,
          messageType: message.type,
        });
      } else {
        // Handle failure
        await this.handleMessageProcessingFailure(message, result.error);
      }

      return result;
    } catch (error) {
      await this.handleMessageProcessingFailure(message, error);
      return Result.failure(error);
    }
  }

  private async handleMessageProcessingFailure(
    message: OutboxMessage,
    error: Error
  ): Promise<void> {
    const retryCount = (message.retryCount || 0) + 1;
    const maxRetries = 3;

    if (retryCount <= maxRetries) {
      // Schedule retry with exponential backoff
      const nextRetry = new Date(Date.now() + retryCount * 30000);
      await this.scheduleRetry(message.id, nextRetry, retryCount);

      // Publish retry event
      await this.eventBus.publish({
        eventType: 'OutboxMessageRetryScheduled',
        payload: {
          messageId: message.id,
          messageType: message.type,
          retryCount,
          maxRetries,
          nextRetry,
          error: error.message,
          timestamp: new Date(),
        },
      });

      this.logger.warn('Message scheduled for retry', {
        messageId: message.id,
        retryCount,
        maxRetries,
        nextRetry,
      });
    } else {
      // Mark as failed
      await this.markMessageAsFailed(message.id, error.message);

      // Publish failure event
      await this.eventBus.publish({
        eventType: 'OutboxMessageFailed',
        payload: {
          messageId: message.id,
          messageType: message.type,
          error: error.message,
          retryCount: maxRetries,
          failedAt: new Date(),
        },
      });

      this.logger.error('Message failed after maximum retries', {
        messageId: message.id,
        messageType: message.type,
        error: error.message,
      });
    }
  }

  private startResilientProcessing(): void {
    this.processingInterval = setInterval(async () => {
      await this.processMessages();
    }, 10000); // Process every 10 seconds
  }

  private async publishProcessingMetrics(
    processedCount: number
  ): Promise<void> {
    const metrics = await this.metricsCollector.getMetrics();

    await this.eventBus.publish({
      eventType: 'OutboxProcessingMetrics',
      payload: {
        processedCount,
        totalMessages: metrics.totalMessages,
        successRate: metrics.successRate,
        averageProcessingTime: metrics.averageProcessingTime,
        circuitBreakerState: this.resiliencePolicy.getCircuitBreakerState(),
        timestamp: new Date(),
      },
    });
  }

  async shutdown(): Promise<void> {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }

    // Process remaining messages
    await this.processMessages();

    // Publish shutdown event
    await this.eventBus.publish({
      eventType: 'OutboxServiceShutdown',
      payload: {
        timestamp: new Date(),
      },
    });
  }
}

// event-driven-trading-service.ts
import {
  TradeExecutedEvent,
  SettlementRequiredEvent,
  RiskLimitBreachedEvent,
} from './trading-messages';

// ⭐ Event-Driven Trading Service with Messaging
@DomainService('eventDrivenTradingService', {
  lifetime: ServiceLifetime.Singleton,
  context: 'TradingPlatform',
})
export class EventDrivenTradingService {
  private logger = Logger.forContext('EventDrivenTradingService');

  constructor(
    private eventBus: UnifiedEventBus,
    private outboxService: ResilientOutboxService,
    private tradeRepository: TradeRepository,
    private settlementService: SettlementService
  ) {
    this.subscribeToEvents();
  }

  private subscribeToEvents(): void {
    // Subscribe to trade execution events
    this.eventBus.subscribe(
      'TradeExecuted',
      async (event: TradeExecutedEvent) => {
        await this.handleTradeExecuted(event);
      }
    );

    // Subscribe to settlement required events
    this.eventBus.subscribe(
      'SettlementRequired',
      async (event: SettlementRequiredEvent) => {
        await this.handleSettlementRequired(event);
      }
    );

    // Subscribe to risk limit breached events
    this.eventBus.subscribe(
      'RiskLimitBreached',
      async (event: RiskLimitBreachedEvent) => {
        await this.handleRiskLimitBreached(event);
      }
    );
  }

  private async handleTradeExecuted(event: TradeExecutedEvent): Promise<void> {
    try {
      this.logger.info('Handling trade executed event', {
        tradeId: event.tradeId,
        symbol: event.symbol,
        quantity: event.quantity,
        price: event.price,
      });

      // Create trade confirmation message
      const confirmationMessage: TradeConfirmationMessage = {
        id: `trade-confirmation-${event.tradeId}`,
        type: 'trade-confirmation',
        payload: {
          tradeId: event.tradeId,
          accountId: event.accountId,
          symbol: event.symbol,
          side: event.side,
          quantity: event.quantity,
          price: event.price,
          executedAt: event.executedAt,
          confirmationNumber: this.generateConfirmationNumber(),
        },
        priority: MessagePriority.HIGH,
        createdAt: new Date(),
        scheduledFor: new Date(),
        retryCount: 0,
      };

      // Add to outbox
      await this.outboxService.addMessage(confirmationMessage);

      // Trigger settlement process for T+2 settlement
      const settlementDate = this.calculateSettlementDate(event.executedAt);
      const settlementEvent = new SettlementRequiredEvent(
        event.tradeId,
        settlementDate,
        event.quantity * event.price,
        'USD',
        'DTCC'
      );

      await this.eventBus.publish(settlementEvent);
    } catch (error) {
      this.logger.error('Failed to handle trade executed event', {
        tradeId: event.tradeId,
        error: error.message,
      });
    }
  }

  private async handleSettlementRequired(
    event: SettlementRequiredEvent
  ): Promise<void> {
    try {
      this.logger.info('Handling settlement required event', {
        tradeId: event.tradeId,
        settlementDate: event.settlementDate,
        amount: event.amount,
      });

      // Create settlement instruction message
      const instructionMessage: SettlementInstructionMessage = {
        id: `settlement-instruction-${event.tradeId}`,
        type: 'settlement-instruction',
        payload: {
          tradeId: event.tradeId,
          instructionId: this.generateInstructionId(),
          settlementDate: event.settlementDate,
          amount: event.amount,
          currency: event.currency,
          counterparty: event.counterparty,
          instructions: this.generateSettlementInstructions(event),
        },
        priority: MessagePriority.HIGH,
        createdAt: new Date(),
        scheduledFor: new Date(event.settlementDate.getTime() - 86400000), // 1 day before settlement
        retryCount: 0,
      };

      // Add to outbox
      await this.outboxService.addMessage(instructionMessage);
    } catch (error) {
      this.logger.error('Failed to handle settlement required event', {
        tradeId: event.tradeId,
        error: error.message,
      });
    }
  }

  private async handleRiskLimitBreached(
    event: RiskLimitBreachedEvent
  ): Promise<void> {
    try {
      this.logger.warn('Handling risk limit breached event', {
        accountId: event.accountId,
        riskType: event.riskType,
        severity: event.severity,
      });

      // Create risk alert message
      const alertMessage: RiskAlertMessage = {
        id: `risk-alert-${event.accountId}-${Date.now()}`,
        type: 'risk-alert',
        payload: {
          accountId: event.accountId,
          alertId: this.generateAlertId(),
          riskType: event.riskType,
          severity: event.severity,
          currentValue: event.currentValue,
          limitValue: event.limitValue,
          alertedAt: new Date(),
        },
        priority:
          event.severity === 'critical'
            ? MessagePriority.CRITICAL
            : MessagePriority.HIGH,
        createdAt: new Date(),
        scheduledFor: new Date(),
        retryCount: 0,
      };

      // Add to outbox
      await this.outboxService.addMessage(alertMessage);
    } catch (error) {
      this.logger.error('Failed to handle risk limit breached event', {
        accountId: event.accountId,
        error: error.message,
      });
    }
  }

  // Business logic helper methods
  private calculateSettlementDate(executedAt: Date): Date {
    const settlementDate = new Date(executedAt);
    settlementDate.setDate(settlementDate.getDate() + 2); // T+2 settlement
    return settlementDate;
  }

  private generateConfirmationNumber(): string {
    return `CONF-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateInstructionId(): string {
    return `INST-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateAlertId(): string {
    return `ALERT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSettlementInstructions(
    event: SettlementRequiredEvent
  ): string {
    return `Settle trade ${event.tradeId} for ${event.amount} ${event.currency} on ${event.settlementDate.toISOString().split('T')[0]} with ${event.counterparty}`;
  }
}

// outbox-metrics-collector.ts
export class OutboxMetricsCollector {
  private totalMessages = 0;
  private successfulMessages = 0;
  private failedMessages = 0;
  private processingTimes: number[] = [];
  private logger = Logger.forContext('OutboxMetricsCollector');

  constructor(private eventBus: UnifiedEventBus) {
    this.startMetricsPublishing();
  }

  recordSuccess(message: OutboxMessage): void {
    this.totalMessages++;
    this.successfulMessages++;

    // Calculate processing time if available
    if (message.updatedAt && message.createdAt) {
      const processingTime =
        message.updatedAt.getTime() - message.createdAt.getTime();
      this.processingTimes.push(processingTime);

      // Keep only last 1000 processing times
      if (this.processingTimes.length > 1000) {
        this.processingTimes.shift();
      }
    }
  }

  recordFailure(message: OutboxMessage, error: Error): void {
    this.totalMessages++;
    this.failedMessages++;

    this.logger.warn('Message processing failed', {
      messageId: message.id,
      messageType: message.type,
      error: error.message,
    });
  }

  async getMetrics(): Promise<{
    totalMessages: number;
    successfulMessages: number;
    failedMessages: number;
    successRate: number;
    averageProcessingTime: number;
  }> {
    const averageProcessingTime =
      this.processingTimes.length > 0
        ? this.processingTimes.reduce((sum, time) => sum + time, 0) /
          this.processingTimes.length
        : 0;

    return {
      totalMessages: this.totalMessages,
      successfulMessages: this.successfulMessages,
      failedMessages: this.failedMessages,
      successRate:
        this.totalMessages > 0
          ? (this.successfulMessages / this.totalMessages) * 100
          : 0,
      averageProcessingTime,
    };
  }

  private startMetricsPublishing(): void {
    // Publish metrics every 30 seconds
    setInterval(async () => {
      const metrics = await this.getMetrics();

      await this.eventBus.publish({
        eventType: 'OutboxMetricsSnapshot',
        payload: {
          ...metrics,
          timestamp: new Date(),
        },
      });
    }, 30000);
  }

  reset(): void {
    this.totalMessages = 0;
    this.successfulMessages = 0;
    this.failedMessages = 0;
    this.processingTimes = [];
  }
}

// resilient-message-processor.ts
export class ResilientMessageProcessor implements MessageProcessor {
  private logger = Logger.forContext('ResilientMessageProcessor');

  constructor(
    private messagePublisher: MessagePublisher,
    private eventBus: UnifiedEventBus
  ) {}

  async process(message: OutboxMessage): Promise<Result<void, Error>> {
    try {
      this.logger.info('Processing message', {
        messageId: message.id,
        messageType: message.type,
        priority: message.priority,
      });

      // Publish message to external system
      const result = await this.messagePublisher.publish(message);

      if (result.isSuccess()) {
        // Publish success event
        await this.eventBus.publish({
          eventType: 'MessagePublished',
          payload: {
            messageId: message.id,
            messageType: message.type,
            publishedAt: new Date(),
          },
        });

        this.logger.info('Message published successfully', {
          messageId: message.id,
          messageType: message.type,
        });
      } else {
        // Publish failure event
        await this.eventBus.publish({
          eventType: 'MessagePublishFailed',
          payload: {
            messageId: message.id,
            messageType: message.type,
            error: result.error.message,
            failedAt: new Date(),
          },
        });
      }

      return result;
    } catch (error) {
      this.logger.error('Message processing error', {
        messageId: message.id,
        messageType: message.type,
        error: error.message,
      });

      return Result.failure(error);
    }
  }
}
```

## Key Features

- **Event-Driven Architecture**: Outbox messages triggered by domain events
- **Resilience Integration**: Circuit breaker protection for message processing
- **Comprehensive Observability**: Events published for all messaging operations
- **Automatic Retry**: Exponential backoff with jitter for failed messages
- **Metrics Collection**: Real-time metrics and performance monitoring
- **Correlation Tracking**: Full audit trail for regulatory compliance

## Usage Example

```typescript
// Usage in trading application
export class TradingController {
  constructor(
    private tradingService: EventDrivenTradingService,
    private outboxService: ResilientOutboxService,
    private eventBus: UnifiedEventBus
  ) {}

  async executeTrade(
    tradeRequest: TradeRequest
  ): Promise<Result<Trade, Error>> {
    try {
      // Execute trade
      const trade = await this.tradeService.execute(tradeRequest);

      if (trade.isSuccess()) {
        // Publish trade executed event
        const event = new TradeExecutedEvent(
          trade.value.id,
          trade.value.accountId,
          trade.value.symbol,
          trade.value.side,
          trade.value.quantity,
          trade.value.price,
          trade.value.executedAt
        );

        await this.eventBus.publish(event);

        // Event-driven service will handle messaging automatically
      }

      return trade;
    } catch (error) {
      return Result.failure(
        new Error(`Trade execution failed: ${error.message}`)
      );
    }
  }

  async getMessagingHealth(): Promise<{
    outboxMetrics: any;
    circuitBreakerState: string;
    eventBusHealth: any;
  }> {
    const metrics = await this.outboxService.getStatistics();

    return {
      outboxMetrics: metrics,
      circuitBreakerState: 'CLOSED', // Get from resilience policy
      eventBusHealth: {
        status: 'healthy',
        subscriberCount: 3,
      },
    };
  }
}
```

## Common Pitfalls

- **Event Ordering**: Consider event ordering when multiple events trigger
  messages
- **Circuit Breaker Tuning**: Adjust thresholds based on your system's
  characteristics
- **Message Correlation**: Maintain correlation IDs across events and messages
- **Retry Logic**: Avoid retry storms with proper backoff strategies
- **Metrics Overhead**: Monitor the performance impact of comprehensive metrics
  collection
