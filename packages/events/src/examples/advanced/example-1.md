# Event Sourcing with Snapshots

**Version**: 1.0.0 **Package**: @vytches/ddd-events **Complexity**: advanced
**Domain**: Architecture **Patterns**: event-sourcing, snapshots,
aggregate-reconstruction, performance-optimization **Dependencies**:
@vytches/ddd-events, @vytches/ddd-aggregates, @vytches/ddd-event-store

## Description

Advanced event sourcing implementation with snapshot optimization for aggregate
reconstruction. This example demonstrates enterprise-grade event sourcing
patterns that can handle high-volume event streams while maintaining performance
through strategic snapshot management.

## Business Context

Large-scale applications with high event volumes need efficient aggregate
reconstruction mechanisms. Event sourcing provides complete audit trails and
temporal queries, but replaying thousands of events becomes
performance-prohibitive. Snapshots allow fast aggregate reconstruction by
storing aggregate state at specific intervals.

## Code Example

```typescript
// advanced-event-sourced-aggregate.ts
import { AggregateRoot } from '@vytches/ddd-aggregates';
import { DomainEvent, EventStore } from '@vytches/ddd-events';
import { EntityId } from '@vytches/ddd-value-objects';
import { Result } from '@vytches/ddd-utils';

// Domain Events
export class AccountOpenedEvent extends DomainEvent {
  constructor(
    public readonly accountId: EntityId,
    public readonly customerId: EntityId,
    public readonly initialBalance: number,
    public readonly accountType: 'checking' | 'savings' | 'investment',
    correlationId?: string
  ) {
    super('AccountOpened', accountId.value, correlationId);
  }
}

export class MoneyDepositedEvent extends DomainEvent {
  constructor(
    public readonly accountId: EntityId,
    public readonly amount: number,
    public readonly transactionId: EntityId,
    public readonly timestamp: Date,
    correlationId?: string
  ) {
    super('MoneyDeposited', accountId.value, correlationId);
  }
}

export class MoneyWithdrawnEvent extends DomainEvent {
  constructor(
    public readonly accountId: EntityId,
    public readonly amount: number,
    public readonly transactionId: EntityId,
    public readonly timestamp: Date,
    correlationId?: string
  ) {
    super('MoneyWithdrawn', accountId.value, correlationId);
  }
}

export class AccountClosedEvent extends DomainEvent {
  constructor(
    public readonly accountId: EntityId,
    public readonly closureReason: string,
    public readonly finalBalance: number,
    correlationId?: string
  ) {
    super('AccountClosed', accountId.value, correlationId);
  }
}

// Snapshot interface
export interface AccountSnapshot {
  aggregateId: string;
  version: number;
  timestamp: Date;
  state: {
    accountId: EntityId;
    customerId: EntityId;
    balance: number;
    accountType: 'checking' | 'savings' | 'investment';
    status: 'active' | 'closed' | 'frozen';
    transactionHistory: Array<{
      transactionId: EntityId;
      amount: number;
      type: 'deposit' | 'withdrawal';
      timestamp: Date;
    }>;
    openedAt: Date;
    closedAt?: Date;
  };
}

// Event-sourced aggregate with snapshot support
export class BankAccount extends AggregateRoot {
  private _accountId: EntityId;
  private _customerId: EntityId;
  private _balance: number = 0;
  private _accountType: 'checking' | 'savings' | 'investment';
  private _status: 'active' | 'closed' | 'frozen' = 'active';
  private _transactionHistory: Array<{
    transactionId: EntityId;
    amount: number;
    type: 'deposit' | 'withdrawal';
    timestamp: Date;
  }> = [];
  private _openedAt: Date;
  private _closedAt?: Date;

  constructor(accountId?: EntityId) {
    super(accountId);
    if (accountId) {
      this._accountId = accountId;
    }
  }

  // ⭐ FOCUS: Factory method for opening new account
  static openAccount(
    customerId: EntityId,
    initialBalance: number,
    accountType: 'checking' | 'savings' | 'investment',
    correlationId?: string
  ): Result<BankAccount, Error> {
    try {
      if (initialBalance < 0) {
        return Result.fail(new Error('Initial balance cannot be negative'));
      }

      const accountId = EntityId.createUuid();
      const account = new BankAccount(accountId);

      // ⭐ FOCUS: Add domain event for account opening
      const event = new AccountOpenedEvent(
        accountId,
        customerId,
        initialBalance,
        accountType,
        correlationId
      );

      account.addDomainEvent(event);
      return Result.ok(account);
    } catch (error) {
      return Result.fail(new Error(`Failed to open account: ${error.message}`));
    }
  }

  // ⭐ FOCUS: Reconstruct from event stream with optional snapshot
  static async fromEventStream(
    eventStore: EventStore,
    accountId: EntityId,
    snapshot?: AccountSnapshot
  ): Promise<Result<BankAccount, Error>> {
    try {
      const account = new BankAccount(accountId);

      let fromVersion = 0;

      // ⭐ FOCUS: Apply snapshot if available
      if (snapshot) {
        account.applySnapshot(snapshot);
        fromVersion = snapshot.version;
        account.markEventsAsCommitted(); // Snapshot events are already committed
      }

      // ⭐ FOCUS: Load and apply events after snapshot
      const eventsResult = await eventStore.getEventsForAggregate(
        accountId.value,
        fromVersion + 1
      );

      if (eventsResult.isFailure()) {
        return Result.fail(eventsResult.error);
      }

      const events = eventsResult.value;

      for (const event of events) {
        account.applyEvent(event);
      }

      account.markEventsAsCommitted();
      return Result.ok(account);
    } catch (error) {
      return Result.fail(
        new Error(`Failed to reconstruct aggregate: ${error.message}`)
      );
    }
  }

  // ⭐ FOCUS: Business operations that generate events
  deposit(amount: number, transactionId: EntityId): Result<void, Error> {
    if (this._status !== 'active') {
      return Result.fail(new Error('Cannot deposit to inactive account'));
    }

    if (amount <= 0) {
      return Result.fail(new Error('Deposit amount must be positive'));
    }

    const event = new MoneyDepositedEvent(
      this._accountId,
      amount,
      transactionId,
      new Date()
    );

    this.addDomainEvent(event);
    return Result.ok();
  }

  withdraw(amount: number, transactionId: EntityId): Result<void, Error> {
    if (this._status !== 'active') {
      return Result.fail(new Error('Cannot withdraw from inactive account'));
    }

    if (amount <= 0) {
      return Result.fail(new Error('Withdrawal amount must be positive'));
    }

    if (amount > this._balance) {
      return Result.fail(new Error('Insufficient funds'));
    }

    const event = new MoneyWithdrawnEvent(
      this._accountId,
      amount,
      transactionId,
      new Date()
    );

    this.addDomainEvent(event);
    return Result.ok();
  }

  closeAccount(reason: string): Result<void, Error> {
    if (this._status === 'closed') {
      return Result.fail(new Error('Account is already closed'));
    }

    const event = new AccountClosedEvent(
      this._accountId,
      reason,
      this._balance
    );

    this.addDomainEvent(event);
    return Result.ok();
  }

  // ⭐ FOCUS: Event application methods
  protected applyEvent(event: DomainEvent): void {
    switch (event.eventType) {
      case 'AccountOpened':
        this.applyAccountOpened(event as AccountOpenedEvent);
        break;
      case 'MoneyDeposited':
        this.applyMoneyDeposited(event as MoneyDepositedEvent);
        break;
      case 'MoneyWithdrawn':
        this.applyMoneyWithdrawn(event as MoneyWithdrawnEvent);
        break;
      case 'AccountClosed':
        this.applyAccountClosed(event as AccountClosedEvent);
        break;
      default:
        throw new Error(`Unknown event type: ${event.eventType}`);
    }

    this.incrementVersion();
  }

  private applyAccountOpened(event: AccountOpenedEvent): void {
    this._accountId = event.accountId;
    this._customerId = event.customerId;
    this._balance = event.initialBalance;
    this._accountType = event.accountType;
    this._status = 'active';
    this._openedAt = event.timestamp;

    if (event.initialBalance > 0) {
      this._transactionHistory.push({
        transactionId: EntityId.createUuid(),
        amount: event.initialBalance,
        type: 'deposit',
        timestamp: event.timestamp,
      });
    }
  }

  private applyMoneyDeposited(event: MoneyDepositedEvent): void {
    this._balance += event.amount;
    this._transactionHistory.push({
      transactionId: event.transactionId,
      amount: event.amount,
      type: 'deposit',
      timestamp: event.timestamp,
    });
  }

  private applyMoneyWithdrawn(event: MoneyWithdrawnEvent): void {
    this._balance -= event.amount;
    this._transactionHistory.push({
      transactionId: event.transactionId,
      amount: event.amount,
      type: 'withdrawal',
      timestamp: event.timestamp,
    });
  }

  private applyAccountClosed(event: AccountClosedEvent): void {
    this._status = 'closed';
    this._closedAt = event.timestamp;
  }

  // ⭐ FOCUS: Snapshot creation and application
  createSnapshot(): AccountSnapshot {
    return {
      aggregateId: this._accountId.value,
      version: this.version,
      timestamp: new Date(),
      state: {
        accountId: this._accountId,
        customerId: this._customerId,
        balance: this._balance,
        accountType: this._accountType,
        status: this._status,
        transactionHistory: [...this._transactionHistory],
        openedAt: this._openedAt,
        closedAt: this._closedAt,
      },
    };
  }

  applySnapshot(snapshot: AccountSnapshot): void {
    this._accountId = snapshot.state.accountId;
    this._customerId = snapshot.state.customerId;
    this._balance = snapshot.state.balance;
    this._accountType = snapshot.state.accountType;
    this._status = snapshot.state.status;
    this._transactionHistory = [...snapshot.state.transactionHistory];
    this._openedAt = snapshot.state.openedAt;
    this._closedAt = snapshot.state.closedAt;
    this.setVersion(snapshot.version);
  }

  // ⭐ FOCUS: Determine if snapshot should be created (every 100 events)
  shouldCreateSnapshot(): boolean {
    return this.version > 0 && this.version % 100 === 0;
  }

  // Getters
  get accountId(): EntityId {
    return this._accountId;
  }
  get customerId(): EntityId {
    return this._customerId;
  }
  get balance(): number {
    return this._balance;
  }
  get accountType(): string {
    return this._accountType;
  }
  get status(): string {
    return this._status;
  }
  get transactionHistory(): ReadonlyArray<any> {
    return this._transactionHistory;
  }
  get openedAt(): Date {
    return this._openedAt;
  }
  get closedAt(): Date | undefined {
    return this._closedAt;
  }
}

// ⭐ FOCUS: Event-sourced repository with snapshot support
export class EventSourcedBankAccountRepository {
  constructor(
    private readonly eventStore: EventStore,
    private readonly snapshotStore: SnapshotStore
  ) {}

  async findById(
    accountId: EntityId
  ): Promise<Result<BankAccount | null, Error>> {
    try {
      // ⭐ FOCUS: Try to load latest snapshot first
      const snapshotResult =
        await this.snapshotStore.getLatestSnapshot<AccountSnapshot>(
          accountId.value
        );

      let snapshot: AccountSnapshot | undefined;
      if (snapshotResult.isSuccess()) {
        snapshot = snapshotResult.value;
      }

      // ⭐ FOCUS: Reconstruct aggregate from snapshot + events
      const accountResult = await BankAccount.fromEventStream(
        this.eventStore,
        accountId,
        snapshot
      );

      if (accountResult.isFailure()) {
        return Result.fail(accountResult.error);
      }

      const account = accountResult.value;
      return Result.ok(account.version === 0 ? null : account);
    } catch (error) {
      return Result.fail(new Error(`Failed to find account: ${error.message}`));
    }
  }

  async save(account: BankAccount): Promise<Result<void, Error>> {
    try {
      // ⭐ FOCUS: Save uncommitted events to event store
      const uncommittedEvents = account.getUncommittedEvents();

      if (uncommittedEvents.length > 0) {
        const saveResult = await this.eventStore.saveEvents(
          account.accountId.value,
          uncommittedEvents,
          account.version - uncommittedEvents.length
        );

        if (saveResult.isFailure()) {
          return Result.fail(saveResult.error);
        }

        account.markEventsAsCommitted();
      }

      // ⭐ FOCUS: Create snapshot if threshold is reached
      if (account.shouldCreateSnapshot()) {
        const snapshot = account.createSnapshot();
        const snapshotResult = await this.snapshotStore.saveSnapshot(snapshot);

        if (snapshotResult.isFailure()) {
          // Log warning but don't fail the save operation
          console.warn(
            `Failed to save snapshot: ${snapshotResult.error.message}`
          );
        }
      }

      return Result.ok();
    } catch (error) {
      return Result.fail(new Error(`Failed to save account: ${error.message}`));
    }
  }
}

// ⭐ FOCUS: Snapshot store interface and implementation
export interface SnapshotStore {
  saveSnapshot<T>(snapshot: T): Promise<Result<void, Error>>;
  getLatestSnapshot<T>(aggregateId: string): Promise<Result<T | null, Error>>;
  getSnapshotAtVersion<T>(
    aggregateId: string,
    version: number
  ): Promise<Result<T | null, Error>>;
}

export class InMemorySnapshotStore implements SnapshotStore {
  private snapshots = new Map<string, AccountSnapshot[]>();

  async saveSnapshot<T>(snapshot: T): Promise<Result<void, Error>> {
    try {
      const accountSnapshot = snapshot as AccountSnapshot;
      const aggregateId = accountSnapshot.aggregateId;

      if (!this.snapshots.has(aggregateId)) {
        this.snapshots.set(aggregateId, []);
      }

      const snapshots = this.snapshots.get(aggregateId)!;
      snapshots.push(accountSnapshot);

      // Keep only last 10 snapshots per aggregate
      if (snapshots.length > 10) {
        snapshots.shift();
      }

      return Result.ok();
    } catch (error) {
      return Result.fail(
        new Error(`Failed to save snapshot: ${error.message}`)
      );
    }
  }

  async getLatestSnapshot<T>(
    aggregateId: string
  ): Promise<Result<T | null, Error>> {
    try {
      const snapshots = this.snapshots.get(aggregateId);

      if (!snapshots || snapshots.length === 0) {
        return Result.ok(null);
      }

      const latest = snapshots[snapshots.length - 1];
      return Result.ok(latest as T);
    } catch (error) {
      return Result.fail(
        new Error(`Failed to get latest snapshot: ${error.message}`)
      );
    }
  }

  async getSnapshotAtVersion<T>(
    aggregateId: string,
    version: number
  ): Promise<Result<T | null, Error>> {
    try {
      const snapshots = this.snapshots.get(aggregateId);

      if (!snapshots || snapshots.length === 0) {
        return Result.ok(null);
      }

      // Find snapshot at or before requested version
      const snapshot = snapshots
        .filter(s => s.version <= version)
        .sort((a, b) => b.version - a.version)[0];

      return Result.ok(snapshot ? (snapshot as T) : null);
    } catch (error) {
      return Result.fail(
        new Error(`Failed to get snapshot at version: ${error.message}`)
      );
    }
  }
}
```

## Usage Examples

```typescript
// Usage example with event sourcing and snapshots
import { EventStore } from '@vytches/ddd-events';
import { EntityId } from '@vytches/ddd-value-objects';

async function demonstrateEventSourcing() {
  const eventStore = new InMemoryEventStore();
  const snapshotStore = new InMemorySnapshotStore();
  const repository = new EventSourcedBankAccountRepository(
    eventStore,
    snapshotStore
  );

  // ⭐ FOCUS: Create and save new account with events
  const customerId = EntityId.createUuid();
  const accountResult = BankAccount.openAccount(customerId, 1000, 'checking');

  if (accountResult.isSuccess()) {
    const account = accountResult.value;
    const accountId = account.accountId;

    // Generate many transactions to trigger snapshots
    for (let i = 0; i < 250; i++) {
      const transactionId = EntityId.createUuid();

      if (i % 2 === 0) {
        account.deposit(100, transactionId);
      } else {
        account.withdraw(50, transactionId);
      }
    }

    // Save account (will create snapshots at 100 and 200 events)
    await repository.save(account);

    // ⭐ FOCUS: Load account - will use latest snapshot + remaining events
    const loadedAccountResult = await repository.findById(accountId);

    if (loadedAccountResult.isSuccess()) {
      const loadedAccount = loadedAccountResult.value;
      console.log(`Account balance: ${loadedAccount.balance}`);
      console.log(
        `Transaction count: ${loadedAccount.transactionHistory.length}`
      );
      console.log(`Account version: ${loadedAccount.version}`);
    }
  }
}

// Advanced query example
async function queryAccountHistory() {
  const eventStore = new InMemoryEventStore();
  const accountId = EntityId.createUuid();

  // ⭐ FOCUS: Get all events for temporal queries
  const eventsResult = await eventStore.getEventsForAggregate(accountId.value);

  if (eventsResult.isSuccess()) {
    const events = eventsResult.value;

    // Analyze deposit patterns
    const deposits = events.filter(e => e.eventType === 'MoneyDeposited');
    const totalDeposited = deposits.reduce(
      (sum, event) => sum + (event as MoneyDepositedEvent).amount,
      0
    );

    console.log(`Total deposits: ${totalDeposited}`);
    console.log(`Number of deposits: ${deposits.length}`);
  }
}

demonstrateEventSourcing();
queryAccountHistory();
```

## Key Features

- **Complete Event Sourcing**: Full audit trail with event replay capability
- **Snapshot Optimization**: Strategic snapshots to improve performance
- **Aggregate Reconstruction**: Efficient rebuilding from snapshots plus events
- **Business Logic Preservation**: Domain events capture all business operations
- **Temporal Queries**: Query aggregate state at any point in time
- **Performance Optimization**: Configurable snapshot frequency
- **Optimistic Concurrency**: Version-based conflict detection
- **Enterprise Ready**: Production-grade patterns and error handling

## Performance Considerations

```typescript
// Snapshot frequency configuration
export class SnapshotConfig {
  static readonly SNAPSHOT_FREQUENCY = 100; // Every 100 events
  static readonly MAX_SNAPSHOTS_PER_AGGREGATE = 10;
  static readonly SNAPSHOT_CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
}

// Performance monitoring
export class EventSourcingMetrics {
  static trackAggregateReconstruction(
    aggregateId: string,
    eventCount: number,
    hasSnapshot: boolean,
    reconstructionTime: number
  ) {
    console.log(`Aggregate ${aggregateId} reconstructed:`, {
      eventCount,
      hasSnapshot,
      reconstructionTime,
      performanceCategory:
        reconstructionTime < 100 ? 'excellent' : 'needs_optimization',
    });
  }
}
```

## Common Pitfalls

- **Over-snapshotting**: Creating snapshots too frequently can impact write
  performance
- **Under-snapshotting**: Too few snapshots make reconstruction slow
- **Schema Evolution**: Handle event schema changes carefully with versioning
- **Memory Usage**: Large aggregates with many events can consume significant
  memory
- **Concurrency Conflicts**: Handle optimistic concurrency properly

## Related Examples

- [Event Store Integration](../../../event-store/examples/basic/example-1.md)
- [Batch Event Processing](../intermediate/example-1.md)
- [Repository Pattern with Events](../basic/example-1.md)
