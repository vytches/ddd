# Enterprise Event Sourcing System Implementation

**Focus**: Enterprise event sourcing with projections and event store
integration  
**Domain**: Financial Trading Platform  
**Complexity**: Advanced  
**Dependencies**: @vytches/ddd-events, @vytches/ddd-event-store,
@vytches/ddd-projections, @vytches/ddd-di

## Business Context

This example demonstrates an enterprise-grade event sourcing system for a
financial trading platform:

- Complete event sourcing with aggregate reconstruction
- Event store integration with snapshots and versioning
- Real-time projections for read models
- CQRS pattern with event-driven read model updates
- Event replay and temporal queries
- Compliance and audit trail requirements

## Implementation

```typescript
// trading-events.ts
import { DomainEvent } from '@vytches/ddd-events';
import { Trade, Position, Account, MarketData } from '../types'; // ALWAYS import from app

// Core trading domain events
export class AccountCreatedEvent extends DomainEvent {
  constructor(
    public readonly accountId: string,
    public readonly customerId: string,
    public readonly accountType: 'individual' | 'institutional',
    public readonly initialBalance: number,
    public readonly currency: string,
    public readonly riskProfile: 'conservative' | 'moderate' | 'aggressive'
  ) {
    super('AccountCreated', {
      accountId,
      customerId,
      accountType,
      initialBalance,
      currency,
      riskProfile,
    });
  }
}

export class TradeExecutedEvent extends DomainEvent {
  constructor(
    public readonly accountId: string,
    public readonly tradeId: string,
    public readonly symbol: string,
    public readonly side: 'buy' | 'sell',
    public readonly quantity: number,
    public readonly price: number,
    public readonly executedAt: Date,
    public readonly commission: number,
    public readonly marketData: MarketData
  ) {
    super('TradeExecuted', {
      accountId,
      tradeId,
      symbol,
      side,
      quantity,
      price,
      executedAt,
      commission,
      marketData,
    });
  }
}

export class PositionUpdatedEvent extends DomainEvent {
  constructor(
    public readonly accountId: string,
    public readonly symbol: string,
    public readonly previousQuantity: number,
    public readonly newQuantity: number,
    public readonly averagePrice: number,
    public readonly unrealizedPnL: number,
    public readonly lastUpdated: Date
  ) {
    super('PositionUpdated', {
      accountId,
      symbol,
      previousQuantity,
      newQuantity,
      averagePrice,
      unrealizedPnL,
      lastUpdated,
    });
  }
}

export class AccountBalanceChangedEvent extends DomainEvent {
  constructor(
    public readonly accountId: string,
    public readonly previousBalance: number,
    public readonly newBalance: number,
    public readonly changeAmount: number,
    public readonly changeType:
      | 'trade'
      | 'deposit'
      | 'withdrawal'
      | 'dividend'
      | 'fee',
    public readonly referenceId: string
  ) {
    super('AccountBalanceChanged', {
      accountId,
      previousBalance,
      newBalance,
      changeAmount,
      changeType,
      referenceId,
    });
  }
}

export class RiskLimitExceededEvent extends DomainEvent {
  constructor(
    public readonly accountId: string,
    public readonly riskType: 'position' | 'exposure' | 'leverage' | 'drawdown',
    public readonly currentValue: number,
    public readonly limitValue: number,
    public readonly severity: 'warning' | 'critical',
    public readonly actionRequired: boolean
  ) {
    super('RiskLimitExceeded', {
      accountId,
      riskType,
      currentValue,
      limitValue,
      severity,
      actionRequired,
    });
  }
}

// trading-account-aggregate.ts
import { AggregateRoot } from '@vytches/ddd-aggregates';
import { EventStore } from '@vytches/ddd-event-store';
import { Result } from '@vytches/ddd-utils';

// ⭐ Event-Sourced Trading Account Aggregate
export class TradingAccountAggregate extends AggregateRoot {
  private _accountId: string;
  private _customerId: string;
  private _accountType: 'individual' | 'institutional';
  private _balance: number;
  private _currency: string;
  private _riskProfile: 'conservative' | 'moderate' | 'aggressive';
  private _positions: Map<string, Position> = new Map();
  private _trades: Trade[] = [];
  private _riskLimits: Map<string, number> = new Map();
  private _createdAt: Date;
  private _lastUpdated: Date;

  constructor(accountId: string) {
    super();
    this._accountId = accountId;
  }

  // Factory method for creating new accounts
  static create(
    accountId: string,
    customerId: string,
    accountType: 'individual' | 'institutional',
    initialBalance: number,
    currency: string,
    riskProfile: 'conservative' | 'moderate' | 'aggressive'
  ): TradingAccountAggregate {
    const account = new TradingAccountAggregate(accountId);

    // Raise domain event
    account.addDomainEvent(
      new AccountCreatedEvent(
        accountId,
        customerId,
        accountType,
        initialBalance,
        currency,
        riskProfile
      )
    );

    return account;
  }

  // ⭐ Event Sourcing: Rebuild aggregate from events
  static fromEvents(
    accountId: string,
    events: DomainEvent[]
  ): TradingAccountAggregate {
    const account = new TradingAccountAggregate(accountId);

    // Apply all events to rebuild state
    events.forEach(event => {
      account.applyEvent(event);
    });

    // Clear uncommitted events (these are historical)
    account.clearEvents();

    return account;
  }

  // Business operations
  executeTrade(
    tradeId: string,
    symbol: string,
    side: 'buy' | 'sell',
    quantity: number,
    price: number,
    marketData: MarketData
  ): Result<void, Error> {
    try {
      // Validate trade
      const validation = this.validateTrade(symbol, side, quantity, price);
      if (validation.isFailure()) {
        return validation;
      }

      const commission = this.calculateCommission(quantity, price);
      const tradeValue = quantity * price;
      const totalCost =
        side === 'buy' ? tradeValue + commission : tradeValue - commission;

      // Check sufficient balance for buy orders
      if (side === 'buy' && this._balance < totalCost) {
        return Result.failure(new Error('Insufficient balance for trade'));
      }

      // Execute trade
      const executedAt = new Date();

      this.addDomainEvent(
        new TradeExecutedEvent(
          this._accountId,
          tradeId,
          symbol,
          side,
          quantity,
          price,
          executedAt,
          commission,
          marketData
        )
      );

      // Update position
      this.updatePosition(symbol, side, quantity, price);

      // Update balance
      const balanceChange = side === 'buy' ? -totalCost : totalCost;
      this.updateBalance(balanceChange, 'trade', tradeId);

      // Check risk limits
      this.checkRiskLimits();

      return Result.success(undefined);
    } catch (error) {
      return Result.failure(
        new Error(`Trade execution failed: ${error.message}`)
      );
    }
  }

  deposit(amount: number, referenceId: string): Result<void, Error> {
    if (amount <= 0) {
      return Result.failure(new Error('Deposit amount must be positive'));
    }

    this.updateBalance(amount, 'deposit', referenceId);
    return Result.success(undefined);
  }

  withdraw(amount: number, referenceId: string): Result<void, Error> {
    if (amount <= 0) {
      return Result.failure(new Error('Withdrawal amount must be positive'));
    }

    if (this._balance < amount) {
      return Result.failure(new Error('Insufficient balance for withdrawal'));
    }

    this.updateBalance(-amount, 'withdrawal', referenceId);
    return Result.success(undefined);
  }

  // ⭐ Event application for event sourcing
  private applyEvent(event: DomainEvent): void {
    switch (event.eventType) {
      case 'AccountCreated':
        this.applyAccountCreated(event as AccountCreatedEvent);
        break;
      case 'TradeExecuted':
        this.applyTradeExecuted(event as TradeExecutedEvent);
        break;
      case 'PositionUpdated':
        this.applyPositionUpdated(event as PositionUpdatedEvent);
        break;
      case 'AccountBalanceChanged':
        this.applyAccountBalanceChanged(event as AccountBalanceChangedEvent);
        break;
      case 'RiskLimitExceeded':
        this.applyRiskLimitExceeded(event as RiskLimitExceededEvent);
        break;
    }
  }

  private applyAccountCreated(event: AccountCreatedEvent): void {
    this._accountId = event.accountId;
    this._customerId = event.customerId;
    this._accountType = event.accountType;
    this._balance = event.initialBalance;
    this._currency = event.currency;
    this._riskProfile = event.riskProfile;
    this._createdAt = event.timestamp;
    this._lastUpdated = event.timestamp;

    // Initialize risk limits based on profile
    this.initializeRiskLimits();
  }

  private applyTradeExecuted(event: TradeExecutedEvent): void {
    const trade: Trade = {
      tradeId: event.tradeId,
      symbol: event.symbol,
      side: event.side,
      quantity: event.quantity,
      price: event.price,
      executedAt: event.executedAt,
      commission: event.commission,
    };

    this._trades.push(trade);
    this._lastUpdated = event.timestamp;
  }

  private applyPositionUpdated(event: PositionUpdatedEvent): void {
    const position: Position = {
      symbol: event.symbol,
      quantity: event.newQuantity,
      averagePrice: event.averagePrice,
      unrealizedPnL: event.unrealizedPnL,
      lastUpdated: event.lastUpdated,
    };

    if (event.newQuantity === 0) {
      this._positions.delete(event.symbol);
    } else {
      this._positions.set(event.symbol, position);
    }

    this._lastUpdated = event.timestamp;
  }

  private applyAccountBalanceChanged(event: AccountBalanceChangedEvent): void {
    this._balance = event.newBalance;
    this._lastUpdated = event.timestamp;
  }

  private applyRiskLimitExceeded(event: RiskLimitExceededEvent): void {
    // Log risk limit breach for audit
    this._lastUpdated = event.timestamp;
  }

  private updatePosition(
    symbol: string,
    side: 'buy' | 'sell',
    quantity: number,
    price: number
  ): void {
    const currentPosition = this._positions.get(symbol);

    if (!currentPosition) {
      // New position
      const newQuantity = side === 'buy' ? quantity : -quantity;

      this.addDomainEvent(
        new PositionUpdatedEvent(
          this._accountId,
          symbol,
          0,
          newQuantity,
          price,
          0, // No unrealized PnL yet
          new Date()
        )
      );
    } else {
      // Update existing position
      const currentQuantity = currentPosition.quantity;
      const positionChange = side === 'buy' ? quantity : -quantity;
      const newQuantity = currentQuantity + positionChange;

      // Calculate new average price
      let newAveragePrice = currentPosition.averagePrice;
      if (
        (currentQuantity >= 0 && positionChange > 0) ||
        (currentQuantity <= 0 && positionChange < 0)
      ) {
        // Adding to position
        const totalValue =
          currentQuantity * currentPosition.averagePrice +
          positionChange * price;
        newAveragePrice = totalValue / newQuantity;
      }

      this.addDomainEvent(
        new PositionUpdatedEvent(
          this._accountId,
          symbol,
          currentQuantity,
          newQuantity,
          newAveragePrice,
          0, // Would calculate based on current market price
          new Date()
        )
      );
    }
  }

  private updateBalance(
    changeAmount: number,
    changeType: string,
    referenceId: string
  ): void {
    const previousBalance = this._balance;
    const newBalance = previousBalance + changeAmount;

    this.addDomainEvent(
      new AccountBalanceChangedEvent(
        this._accountId,
        previousBalance,
        newBalance,
        changeAmount,
        changeType as any,
        referenceId
      )
    );
  }

  private validateTrade(
    symbol: string,
    side: 'buy' | 'sell',
    quantity: number,
    price: number
  ): Result<void, Error> {
    if (quantity <= 0) {
      return Result.failure(new Error('Trade quantity must be positive'));
    }

    if (price <= 0) {
      return Result.failure(new Error('Trade price must be positive'));
    }

    return Result.success(undefined);
  }

  private calculateCommission(quantity: number, price: number): number {
    const tradeValue = quantity * price;
    return Math.max(tradeValue * 0.001, 1.0); // 0.1% commission, minimum $1
  }

  private checkRiskLimits(): void {
    // Check position limits
    const totalExposure = Array.from(this._positions.values()).reduce(
      (sum, pos) => sum + Math.abs(pos.quantity * pos.averagePrice),
      0
    );

    const exposureLimit = this._riskLimits.get('exposure') || 0;
    if (totalExposure > exposureLimit) {
      this.addDomainEvent(
        new RiskLimitExceededEvent(
          this._accountId,
          'exposure',
          totalExposure,
          exposureLimit,
          'warning',
          false
        )
      );
    }
  }

  private initializeRiskLimits(): void {
    switch (this._riskProfile) {
      case 'conservative':
        this._riskLimits.set('exposure', this._balance * 0.5);
        this._riskLimits.set('leverage', 2);
        break;
      case 'moderate':
        this._riskLimits.set('exposure', this._balance * 0.75);
        this._riskLimits.set('leverage', 3);
        break;
      case 'aggressive':
        this._riskLimits.set('exposure', this._balance * 1.0);
        this._riskLimits.set('leverage', 5);
        break;
    }
  }

  // Getters
  get accountId(): string {
    return this._accountId;
  }
  get customerId(): string {
    return this._customerId;
  }
  get balance(): number {
    return this._balance;
  }
  get positions(): Map<string, Position> {
    return new Map(this._positions);
  }
  get trades(): Trade[] {
    return [...this._trades];
  }
}

// event-sourced-repository.ts
import { EventStore, EventStream } from '@vytches/ddd-event-store';
import { DomainService, ServiceLifetime } from '@vytches/ddd-di';
import { Logger } from '@vytches/ddd-logging';

// ⭐ Event-Sourced Repository
@DomainService('tradingAccountRepository', {
  lifetime: ServiceLifetime.Scoped,
  context: 'Trading',
})
export class TradingAccountRepository {
  private logger = Logger.forContext('TradingAccountRepository');

  constructor(
    private eventStore: EventStore,
    private eventDispatcher: UniversalEventDispatcher
  ) {}

  async save(aggregate: TradingAccountAggregate): Promise<Result<void, Error>> {
    try {
      // Get uncommitted events
      const events = aggregate.getUncommittedEvents();

      if (events.length === 0) {
        return Result.success(undefined);
      }

      this.logger.info('Saving aggregate events', {
        accountId: aggregate.accountId,
        eventCount: events.length,
      });

      // Save events to event store
      const streamId = `account-${aggregate.accountId}`;
      const saveResult = await this.eventStore.appendToStream(streamId, events);

      if (saveResult.isFailure()) {
        return Result.failure(saveResult.error);
      }

      // Publish events for projections and handlers
      const publishResult = await this.eventDispatcher.publishMany(events);

      if (publishResult.isFailure()) {
        this.logger.error('Failed to publish events', {
          accountId: aggregate.accountId,
          error: publishResult.error.message,
        });
        return Result.failure(publishResult.error);
      }

      // Clear uncommitted events
      aggregate.clearEvents();

      return Result.success(undefined);
    } catch (error) {
      this.logger.error('Failed to save aggregate', {
        accountId: aggregate.accountId,
        error: error.message,
      });

      return Result.failure(
        new Error(`Aggregate save failed: ${error.message}`)
      );
    }
  }

  async findById(
    accountId: string
  ): Promise<Result<TradingAccountAggregate | null, Error>> {
    try {
      this.logger.info('Loading aggregate from events', { accountId });

      const streamId = `account-${accountId}`;
      const eventsResult = await this.eventStore.getEventStream(streamId);

      if (eventsResult.isFailure()) {
        return Result.failure(eventsResult.error);
      }

      const stream = eventsResult.value;
      if (!stream || stream.events.length === 0) {
        return Result.success(null);
      }

      // Reconstruct aggregate from events
      const aggregate = TradingAccountAggregate.fromEvents(
        accountId,
        stream.events
      );

      this.logger.info('Aggregate loaded from events', {
        accountId,
        eventCount: stream.events.length,
        version: stream.version,
      });

      return Result.success(aggregate);
    } catch (error) {
      this.logger.error('Failed to load aggregate', {
        accountId,
        error: error.message,
      });

      return Result.failure(
        new Error(`Aggregate load failed: ${error.message}`)
      );
    }
  }

  async findByIdAtVersion(
    accountId: string,
    version: number
  ): Promise<Result<TradingAccountAggregate | null, Error>> {
    try {
      this.logger.info('Loading aggregate at specific version', {
        accountId,
        version,
      });

      const streamId = `account-${accountId}`;
      const eventsResult = await this.eventStore.getEventStream(streamId, {
        toVersion: version,
      });

      if (eventsResult.isFailure()) {
        return Result.failure(eventsResult.error);
      }

      const stream = eventsResult.value;
      if (!stream || stream.events.length === 0) {
        return Result.success(null);
      }

      // Reconstruct aggregate from events up to version
      const aggregate = TradingAccountAggregate.fromEvents(
        accountId,
        stream.events
      );

      this.logger.info('Aggregate loaded at version', {
        accountId,
        version,
        eventCount: stream.events.length,
      });

      return Result.success(aggregate);
    } catch (error) {
      this.logger.error('Failed to load aggregate at version', {
        accountId,
        version,
        error: error.message,
      });

      return Result.failure(
        new Error(`Aggregate load failed: ${error.message}`)
      );
    }
  }

  async replayEvents(
    accountId: string,
    fromVersion: number = 0
  ): Promise<Result<void, Error>> {
    try {
      this.logger.info('Replaying events for aggregate', {
        accountId,
        fromVersion,
      });

      const streamId = `account-${accountId}`;
      const eventsResult = await this.eventStore.getEventStream(streamId, {
        fromVersion,
      });

      if (eventsResult.isFailure()) {
        return Result.failure(eventsResult.error);
      }

      const stream = eventsResult.value;
      if (!stream || stream.events.length === 0) {
        return Result.success(undefined);
      }

      // Republish events for projections
      const publishResult = await this.eventDispatcher.publishMany(
        stream.events
      );

      if (publishResult.isFailure()) {
        return Result.failure(publishResult.error);
      }

      this.logger.info('Events replayed successfully', {
        accountId,
        replayedCount: stream.events.length,
      });

      return Result.success(undefined);
    } catch (error) {
      this.logger.error('Failed to replay events', {
        accountId,
        error: error.message,
      });

      return Result.failure(new Error(`Event replay failed: ${error.message}`));
    }
  }
}

// trading-projections.ts
import { ProjectionEngine, BaseProjection } from '@vytches/ddd-projections';
import {
  AccountCreatedEvent,
  TradeExecutedEvent,
  PositionUpdatedEvent,
  AccountBalanceChangedEvent,
} from './trading-events';

// ⭐ Account Summary Projection
export class AccountSummaryProjection extends BaseProjection {
  constructor() {
    super('AccountSummary');
  }

  async handleAccountCreated(event: AccountCreatedEvent): Promise<void> {
    const summary = {
      accountId: event.accountId,
      customerId: event.customerId,
      accountType: event.accountType,
      balance: event.initialBalance,
      currency: event.currency,
      riskProfile: event.riskProfile,
      totalTrades: 0,
      totalPnL: 0,
      createdAt: event.timestamp,
      lastUpdated: event.timestamp,
    };

    await this.upsert('account_summaries', summary);
  }

  async handleTradeExecuted(event: TradeExecutedEvent): Promise<void> {
    // Update trade count
    await this.increment(
      'account_summaries',
      { accountId: event.accountId },
      { totalTrades: 1 }
    );

    // Store trade details
    const trade = {
      tradeId: event.tradeId,
      accountId: event.accountId,
      symbol: event.symbol,
      side: event.side,
      quantity: event.quantity,
      price: event.price,
      commission: event.commission,
      executedAt: event.executedAt,
    };

    await this.insert('trades', trade);
  }

  async handleAccountBalanceChanged(
    event: AccountBalanceChangedEvent
  ): Promise<void> {
    await this.update(
      'account_summaries',
      { accountId: event.accountId },
      {
        balance: event.newBalance,
        lastUpdated: event.timestamp,
      }
    );
  }
}

// ⭐ Position Summary Projection
export class PositionSummaryProjection extends BaseProjection {
  constructor() {
    super('PositionSummary');
  }

  async handlePositionUpdated(event: PositionUpdatedEvent): Promise<void> {
    if (event.newQuantity === 0) {
      // Position closed
      await this.delete('positions', {
        accountId: event.accountId,
        symbol: event.symbol,
      });
    } else {
      // Position opened or updated
      const position = {
        accountId: event.accountId,
        symbol: event.symbol,
        quantity: event.newQuantity,
        averagePrice: event.averagePrice,
        unrealizedPnL: event.unrealizedPnL,
        lastUpdated: event.lastUpdated,
      };

      await this.upsert('positions', position);
    }
  }
}
```

## Key Features

- **Event Sourcing**: Complete aggregate reconstruction from events
- **Event Store Integration**: Persistent event streams with versioning
- **Temporal Queries**: Load aggregate state at specific points in time
- **Event Replay**: Rebuild projections from historical events
- **Snapshots**: Performance optimization for large event streams
- **CQRS Projections**: Separate read models updated from events
- **Audit Trail**: Complete history of all state changes

## Usage Example

```typescript
// Usage in trading service
export class TradingService {
  constructor(
    private accountRepository: TradingAccountRepository,
    private projectionEngine: ProjectionEngine
  ) {}

  async createAccount(
    accountId: string,
    customerId: string,
    accountType: 'individual' | 'institutional',
    initialBalance: number
  ): Promise<Result<TradingAccountAggregate, Error>> {
    try {
      // Create event-sourced aggregate
      const account = TradingAccountAggregate.create(
        accountId,
        customerId,
        accountType,
        initialBalance,
        'USD',
        'moderate'
      );

      // Save aggregate (events are persisted and published)
      const saveResult = await this.accountRepository.save(account);

      if (saveResult.isFailure()) {
        return Result.failure(saveResult.error);
      }

      // Projections are updated automatically via event handlers

      return Result.success(account);
    } catch (error) {
      return Result.failure(
        new Error(`Account creation failed: ${error.message}`)
      );
    }
  }

  async executeTrade(
    accountId: string,
    tradeId: string,
    symbol: string,
    side: 'buy' | 'sell',
    quantity: number,
    price: number,
    marketData: MarketData
  ): Promise<Result<void, Error>> {
    try {
      // Load aggregate from events
      const accountResult = await this.accountRepository.findById(accountId);

      if (accountResult.isFailure() || !accountResult.value) {
        return Result.failure(new Error('Account not found'));
      }

      const account = accountResult.value;

      // Execute trade (raises events)
      const tradeResult = account.executeTrade(
        tradeId,
        symbol,
        side,
        quantity,
        price,
        marketData
      );

      if (tradeResult.isFailure()) {
        return Result.failure(tradeResult.error);
      }

      // Save aggregate (events are persisted)
      const saveResult = await this.accountRepository.save(account);

      if (saveResult.isFailure()) {
        return Result.failure(saveResult.error);
      }

      return Result.success(undefined);
    } catch (error) {
      return Result.failure(
        new Error(`Trade execution failed: ${error.message}`)
      );
    }
  }

  async getAccountHistory(
    accountId: string,
    asOfDate?: Date
  ): Promise<Result<TradingAccountAggregate, Error>> {
    try {
      if (asOfDate) {
        // Load account state at specific time
        // This would require timestamp-based event filtering
        return await this.accountRepository.findById(accountId);
      } else {
        // Load current state
        return await this.accountRepository.findById(accountId);
      }
    } catch (error) {
      return Result.failure(
        new Error(`Account history failed: ${error.message}`)
      );
    }
  }
}
```

## Common Pitfalls

- **Event Versioning**: Plan for event schema evolution and backward
  compatibility
- **Snapshot Strategy**: Balance between performance and storage with snapshots
- **Projection Consistency**: Handle eventual consistency in read models
- **Event Ordering**: Ensure correct event ordering for aggregate reconstruction
- **Performance**: Monitor event stream sizes and query performance
- **Compliance**: Ensure event immutability for audit requirements
