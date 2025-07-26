# @vytches/ddd-repositories

<!-- LLM-METADATA
Package: @vytches/ddd-repositories
Category: Foundation
Purpose: Repository pattern implementations with UnitOfWork, specifications, and automatic event publishing
Dependencies: @vytches/ddd-domain-primitives, @vytches/ddd-events, @vytches/ddd-utils
Complexity: High
DDD Patterns: Repository, Unit of Work, Specification, Aggregate Persistence
Integration Points: @vytches/ddd-aggregates, @vytches/ddd-events, @vytches/ddd-di, @vytches/ddd-validation
-->

[![npm version](https://badge.fury.io/js/%40vytches%2Fddd-repositories.svg)](https://badge.fury.io/js/%40vytches%2Fddd-repositories)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Enterprise-grade repository pattern implementations with UnitOfWork and
> automatic event publishing**

Complete repository pattern implementation with Unit of Work, specification
pattern, automatic event publishing, and support for multiple storage backends.
Designed for complex domain models with transactional consistency.

## 📋 Table of Contents

- [Installation](#installation)
- [Key Features](#key-features)
- [Core Concepts](#core-concepts)
- [Quick Start](#quick-start)
- [Repository Pattern](#repository-pattern)
- [Unit of Work](#unit-of-work)
- [Specifications](#specifications)
- [Event Publishing](#event-publishing)
- [Storage Adapters](#storage-adapters)
- [Caching](#caching)
- [Transactions](#transactions)
- [Testing](#testing)
- [Best Practices](#best-practices)
- [Contributing](#contributing)

## 🚀 Installation

```bash
# npm
npm install @vytches/ddd-repositories

# yarn
yarn add @vytches/ddd-repositories

# pnpm
pnpm add @vytches/ddd-repositories
```

### Peer Dependencies

```bash
# Required for full functionality
npm install @vytches/ddd-domain-primitives @vytches/ddd-events @vytches/ddd-utils
```

## ✨ Key Features

### Repository Pattern

- **Generic Repository**: Type-safe repository base classes
- **Aggregate Repository**: Specialized repository for aggregate roots
- **Specification Support**: Query by business rules and specifications
- **Automatic Event Publishing**: Seamless domain event handling

### Unit of Work

- **Transaction Management**: Coordinated changes across multiple repositories
- **Change Tracking**: Automatic tracking of aggregate modifications
- **Rollback Support**: Complete transaction rollback on failure
- **Event Coordination**: Consistent event publishing across transactions

### Storage Abstraction

- **Multiple Backends**: Support for various storage technologies
- **Adapter Pattern**: Pluggable storage implementations
- **Caching Layer**: Transparent caching with configurable strategies
- **Connection Pooling**: Efficient database connection management

## 🎯 Core Concepts

### Repository Pattern

The repository pattern encapsulates the logic needed to access data sources:

```typescript
// Base repository interface
interface IRepository<T extends IAggregateRoot> {
  // Basic operations
  findById(id: EntityId): Promise<T | null>;
  save(aggregate: T): Promise<void>;
  delete(id: EntityId): Promise<void>;
  exists(id: EntityId): Promise<boolean>;

  // Query operations
  findBySpecification(spec: ISpecification<T>): Promise<T[]>;
  findOneBySpecification(spec: ISpecification<T>): Promise<T | null>;
  countBySpecification(spec: ISpecification<T>): Promise<number>;

  // Bulk operations
  saveMany(aggregates: T[]): Promise<void>;
  deleteMany(ids: EntityId[]): Promise<void>;
}
```

### Unit of Work

Unit of Work maintains a list of objects affected by a business transaction:

```typescript
interface IUnitOfWork {
  // Registration
  registerNew<T extends IAggregateRoot>(aggregate: T): void;
  registerDirty<T extends IAggregateRoot>(aggregate: T): void;
  registerDeleted<T extends IAggregateRoot>(aggregate: T): void;

  // Transaction management
  commit(): Promise<void>;
  rollback(): Promise<void>;

  // State management
  isRegistered<T extends IAggregateRoot>(aggregate: T): boolean;
  getRegisteredAggregates(): IAggregateRoot[];
  clear(): void;
}
```

### Specification Pattern

Specifications encapsulate business rules for querying:

```typescript
interface ISpecification<T> {
  isSatisfiedBy(entity: T): boolean;
  and(other: ISpecification<T>): ISpecification<T>;
  or(other: ISpecification<T>): ISpecification<T>;
  not(): ISpecification<T>;
}
```

## 🚀 Quick Start

### 1. Basic Repository Usage

```typescript
import { BaseRepository } from '@vytches/ddd-repositories';
import { User } from './domain/User';

// Define user repository interface
interface IUserRepository extends IRepository<User> {
  findByEmail(email: Email): Promise<User | null>;
  findActiveUsers(): Promise<User[]>;
  findUsersByRole(role: UserRole): Promise<User[]>;
}

// Implement repository
class UserRepository extends BaseRepository<User> implements IUserRepository {
  constructor(eventBus: IEventBus, storageAdapter: IStorageAdapter<User>) {
    super(eventBus, storageAdapter);
  }

  async findByEmail(email: Email): Promise<User | null> {
    const specification = new UserByEmailSpecification(email);
    return await this.findOneBySpecification(specification);
  }

  async findActiveUsers(): Promise<User[]> {
    const specification = new ActiveUserSpecification();
    return await this.findBySpecification(specification);
  }

  async findUsersByRole(role: UserRole): Promise<User[]> {
    const specification = new UserByRoleSpecification(role);
    return await this.findBySpecification(specification);
  }
}

// Usage
const userRepository = new UserRepository(eventBus, storageAdapter);

// Find by ID
const user = await userRepository.findById(userId);

// Find by email
const userByEmail = await userRepository.findByEmail(
  new Email('user@example.com')
);

// Save user (automatically publishes events)
await userRepository.save(user);
```

### 2. Unit of Work Pattern

```typescript
import { UnitOfWork } from '@vytches/ddd-repositories';

// Create unit of work
const unitOfWork = new UnitOfWork(eventBus);

// Register repositories
unitOfWork.registerRepository('users', userRepository);
unitOfWork.registerRepository('orders', orderRepository);

// Business operation
async function processUserOrder(
  userId: EntityId,
  orderData: OrderData
): Promise<void> {
  try {
    // Load user
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Update user
    user.updateLastOrderDate();
    unitOfWork.registerDirty(user);

    // Create order
    const order = Order.create(orderData);
    unitOfWork.registerNew(order);

    // Commit all changes
    await unitOfWork.commit();
  } catch (error) {
    await unitOfWork.rollback();
    throw error;
  }
}
```

### 3. Specification Pattern

```typescript
import { Specification } from '@vytches/ddd-repositories';

// Define specifications
class ActiveUserSpecification extends Specification<User> {
  isSatisfiedBy(user: User): boolean {
    return user.isActive && !user.isDeleted;
  }
}

class UserByRoleSpecification extends Specification<User> {
  constructor(private readonly role: UserRole) {
    super();
  }

  isSatisfiedBy(user: User): boolean {
    return user.role === this.role;
  }
}

class UserCreatedAfterSpecification extends Specification<User> {
  constructor(private readonly date: Date) {
    super();
  }

  isSatisfiedBy(user: User): boolean {
    return user.createdAt > this.date;
  }
}

// Compose specifications
const activeAdminUsersSpec = new ActiveUserSpecification()
  .and(new UserByRoleSpecification(UserRole.ADMIN))
  .and(new UserCreatedAfterSpecification(new Date('2023-01-01')));

// Use in repository
const activeAdminUsers =
  await userRepository.findBySpecification(activeAdminUsersSpec);
```

## 🗃️ Repository Pattern

### Base Repository Implementation

```typescript
import { BaseRepository } from '@vytches/ddd-repositories';

abstract class BaseRepository<T extends IAggregateRoot>
  implements IRepository<T>
{
  protected constructor(
    protected readonly eventBus: IEventBus,
    protected readonly storageAdapter: IStorageAdapter<T>,
    protected readonly logger: ILogger
  ) {}

  async findById(id: EntityId): Promise<T | null> {
    this.logger.debug('Finding aggregate by ID', { id: id.value });

    const aggregate = await this.storageAdapter.findById(id);

    if (aggregate) {
      this.logger.debug('Aggregate found', { id: id.value });
    } else {
      this.logger.debug('Aggregate not found', { id: id.value });
    }

    return aggregate;
  }

  async save(aggregate: T): Promise<void> {
    this.logger.debug('Saving aggregate', {
      id: aggregate.id.value,
      version: aggregate.version,
    });

    try {
      // Persist aggregate
      await this.storageAdapter.save(aggregate);

      // Publish domain events
      const events = aggregate.getUncommittedEvents();
      if (events.length > 0) {
        await this.eventBus.publishMany(events);
        aggregate.markEventsAsCommitted();
      }

      this.logger.info('Aggregate saved successfully', {
        id: aggregate.id.value,
        eventCount: events.length,
      });
    } catch (error) {
      this.logger.error('Failed to save aggregate', {
        id: aggregate.id.value,
        error: error.message,
      });
      throw error;
    }
  }

  async delete(id: EntityId): Promise<void> {
    this.logger.debug('Deleting aggregate', { id: id.value });

    await this.storageAdapter.delete(id);

    this.logger.info('Aggregate deleted', { id: id.value });
  }

  async exists(id: EntityId): Promise<boolean> {
    return await this.storageAdapter.exists(id);
  }

  async findBySpecification(specification: ISpecification<T>): Promise<T[]> {
    this.logger.debug('Finding aggregates by specification', {
      specification: specification.constructor.name,
    });

    return await this.storageAdapter.findBySpecification(specification);
  }

  async findOneBySpecification(
    specification: ISpecification<T>
  ): Promise<T | null> {
    const results = await this.findBySpecification(specification);
    return results.length > 0 ? results[0] : null;
  }

  async countBySpecification(
    specification: ISpecification<T>
  ): Promise<number> {
    return await this.storageAdapter.countBySpecification(specification);
  }

  async saveMany(aggregates: T[]): Promise<void> {
    for (const aggregate of aggregates) {
      await this.save(aggregate);
    }
  }

  async deleteMany(ids: EntityId[]): Promise<void> {
    for (const id of ids) {
      await this.delete(id);
    }
  }
}
```

### Aggregate Repository

```typescript
// Specialized repository for aggregate roots
class AggregateRepository<T extends IAggregateRoot> extends BaseRepository<T> {
  constructor(
    eventBus: IEventBus,
    storageAdapter: IStorageAdapter<T>,
    private readonly snapshotStore?: ISnapshotStore<T>
  ) {
    super(eventBus, storageAdapter, logger);
  }

  async saveWithSnapshot(
    aggregate: T,
    snapshotFrequency: number = 10
  ): Promise<void> {
    // Save aggregate
    await this.save(aggregate);

    // Create snapshot if configured
    if (this.snapshotStore && aggregate.version % snapshotFrequency === 0) {
      const snapshot = aggregate.toSnapshot();
      await this.snapshotStore.save(snapshot);
    }
  }

  async findByIdWithSnapshot(id: EntityId): Promise<T | null> {
    // Try to load from snapshot first
    if (this.snapshotStore) {
      const snapshot = await this.snapshotStore.findById(id);
      if (snapshot) {
        // Reconstruct aggregate from snapshot
        const aggregate = await this.storageAdapter.findById(id);
        if (aggregate) {
          aggregate.fromSnapshot(snapshot);
          return aggregate;
        }
      }
    }

    // Fall back to regular loading
    return await this.findById(id);
  }
}
```

### Read-Only Repository

```typescript
// Read-only repository for queries
class ReadOnlyRepository<T extends IAggregateRoot> {
  constructor(
    private readonly storageAdapter: IStorageAdapter<T>,
    private readonly cache?: ICache<T>
  ) {}

  async findById(id: EntityId): Promise<T | null> {
    // Check cache first
    if (this.cache) {
      const cached = await this.cache.get(id.value);
      if (cached) {
        return cached;
      }
    }

    // Load from storage
    const aggregate = await this.storageAdapter.findById(id);

    // Cache result
    if (this.cache && aggregate) {
      await this.cache.set(id.value, aggregate);
    }

    return aggregate;
  }

  async findBySpecification(specification: ISpecification<T>): Promise<T[]> {
    return await this.storageAdapter.findBySpecification(specification);
  }

  async findBySpecificationWithPaging(
    specification: ISpecification<T>,
    page: number,
    size: number
  ): Promise<PagedResult<T>> {
    const offset = (page - 1) * size;
    const results = await this.storageAdapter.findBySpecificationWithPaging(
      specification,
      offset,
      size
    );

    const total = await this.storageAdapter.countBySpecification(specification);

    return {
      items: results,
      page,
      size,
      total,
      hasNext: offset + size < total,
      hasPrevious: page > 1,
    };
  }
}
```

## 🔄 Unit of Work

### Basic Unit of Work Implementation

```typescript
class UnitOfWork implements IUnitOfWork {
  private newAggregates: Set<IAggregateRoot> = new Set();
  private dirtyAggregates: Set<IAggregateRoot> = new Set();
  private deletedAggregates: Set<IAggregateRoot> = new Set();
  private repositories: Map<string, IRepository<any>> = new Map();

  constructor(private readonly eventBus: IEventBus) {}

  registerRepository<T extends IAggregateRoot>(
    name: string,
    repository: IRepository<T>
  ): void {
    this.repositories.set(name, repository);
  }

  registerNew<T extends IAggregateRoot>(aggregate: T): void {
    if (this.deletedAggregates.has(aggregate)) {
      throw new Error('Cannot register deleted aggregate as new');
    }

    this.newAggregates.add(aggregate);
    this.dirtyAggregates.delete(aggregate);
  }

  registerDirty<T extends IAggregateRoot>(aggregate: T): void {
    if (!this.newAggregates.has(aggregate)) {
      this.dirtyAggregates.add(aggregate);
    }
  }

  registerDeleted<T extends IAggregateRoot>(aggregate: T): void {
    if (this.newAggregates.has(aggregate)) {
      this.newAggregates.delete(aggregate);
    } else {
      this.deletedAggregates.add(aggregate);
    }

    this.dirtyAggregates.delete(aggregate);
  }

  async commit(): Promise<void> {
    const allEvents: IDomainEvent[] = [];

    try {
      // Save new aggregates
      for (const aggregate of this.newAggregates) {
        const repository = this.getRepositoryForAggregate(aggregate);
        await repository.save(aggregate);
        allEvents.push(...aggregate.getUncommittedEvents());
      }

      // Save dirty aggregates
      for (const aggregate of this.dirtyAggregates) {
        const repository = this.getRepositoryForAggregate(aggregate);
        await repository.save(aggregate);
        allEvents.push(...aggregate.getUncommittedEvents());
      }

      // Delete aggregates
      for (const aggregate of this.deletedAggregates) {
        const repository = this.getRepositoryForAggregate(aggregate);
        await repository.delete(aggregate.id);
      }

      // Publish all events
      if (allEvents.length > 0) {
        await this.eventBus.publishMany(allEvents);
      }

      // Mark events as committed
      this.markAllEventsAsCommitted();

      // Clear the unit of work
      this.clear();
    } catch (error) {
      await this.rollback();
      throw error;
    }
  }

  async rollback(): Promise<void> {
    // Clear all registered aggregates
    this.clear();

    // Additional rollback logic if needed
    // (e.g., compensating actions)
  }

  isRegistered<T extends IAggregateRoot>(aggregate: T): boolean {
    return (
      this.newAggregates.has(aggregate) ||
      this.dirtyAggregates.has(aggregate) ||
      this.deletedAggregates.has(aggregate)
    );
  }

  getRegisteredAggregates(): IAggregateRoot[] {
    return [
      ...this.newAggregates,
      ...this.dirtyAggregates,
      ...this.deletedAggregates,
    ];
  }

  clear(): void {
    this.newAggregates.clear();
    this.dirtyAggregates.clear();
    this.deletedAggregates.clear();
  }

  private getRepositoryForAggregate(
    aggregate: IAggregateRoot
  ): IRepository<any> {
    const aggregateType = aggregate.constructor.name;
    const repositoryName = `${aggregateType}Repository`;

    const repository = this.repositories.get(repositoryName);
    if (!repository) {
      throw new Error(
        `Repository not found for aggregate type: ${aggregateType}`
      );
    }

    return repository;
  }

  private markAllEventsAsCommitted(): void {
    for (const aggregate of this.getRegisteredAggregates()) {
      aggregate.markEventsAsCommitted();
    }
  }
}
```

### Transactional Unit of Work

```typescript
class TransactionalUnitOfWork extends UnitOfWork {
  private transaction?: ITransaction;

  constructor(
    eventBus: IEventBus,
    private readonly transactionManager: ITransactionManager
  ) {
    super(eventBus);
  }

  async begin(): Promise<void> {
    this.transaction = await this.transactionManager.begin();
  }

  async commit(): Promise<void> {
    if (!this.transaction) {
      throw new Error('No active transaction');
    }

    try {
      await super.commit();
      await this.transaction.commit();
    } catch (error) {
      await this.transaction.rollback();
      throw error;
    } finally {
      this.transaction = undefined;
    }
  }

  async rollback(): Promise<void> {
    if (this.transaction) {
      await this.transaction.rollback();
      this.transaction = undefined;
    }

    await super.rollback();
  }
}
```

## 🔍 Specifications

### Base Specification Classes

```typescript
abstract class Specification<T> implements ISpecification<T> {
  abstract isSatisfiedBy(entity: T): boolean;

  and(other: ISpecification<T>): ISpecification<T> {
    return new AndSpecification(this, other);
  }

  or(other: ISpecification<T>): ISpecification<T> {
    return new OrSpecification(this, other);
  }

  not(): ISpecification<T> {
    return new NotSpecification(this);
  }
}

class AndSpecification<T> extends Specification<T> {
  constructor(
    private readonly left: ISpecification<T>,
    private readonly right: ISpecification<T>
  ) {
    super();
  }

  isSatisfiedBy(entity: T): boolean {
    return this.left.isSatisfiedBy(entity) && this.right.isSatisfiedBy(entity);
  }
}

class OrSpecification<T> extends Specification<T> {
  constructor(
    private readonly left: ISpecification<T>,
    private readonly right: ISpecification<T>
  ) {
    super();
  }

  isSatisfiedBy(entity: T): boolean {
    return this.left.isSatisfiedBy(entity) || this.right.isSatisfiedBy(entity);
  }
}

class NotSpecification<T> extends Specification<T> {
  constructor(private readonly specification: ISpecification<T>) {
    super();
  }

  isSatisfiedBy(entity: T): boolean {
    return !this.specification.isSatisfiedBy(entity);
  }
}
```

### Domain-Specific Specifications

```typescript
// User specifications
class UserByEmailSpecification extends Specification<User> {
  constructor(private readonly email: Email) {
    super();
  }

  isSatisfiedBy(user: User): boolean {
    return user.email.equals(this.email);
  }
}

class ActiveUserSpecification extends Specification<User> {
  isSatisfiedBy(user: User): boolean {
    return user.isActive && !user.isDeleted;
  }
}

class UserByRoleSpecification extends Specification<User> {
  constructor(private readonly role: UserRole) {
    super();
  }

  isSatisfiedBy(user: User): boolean {
    return user.role === this.role;
  }
}

// Order specifications
class OrderByStatusSpecification extends Specification<Order> {
  constructor(private readonly status: OrderStatus) {
    super();
  }

  isSatisfiedBy(order: Order): boolean {
    return order.status === this.status;
  }
}

class OrdersByCustomerSpecification extends Specification<Order> {
  constructor(private readonly customerId: EntityId) {
    super();
  }

  isSatisfiedBy(order: Order): boolean {
    return order.customerId.equals(this.customerId);
  }
}

class OrdersCreatedAfterSpecification extends Specification<Order> {
  constructor(private readonly date: Date) {
    super();
  }

  isSatisfiedBy(order: Order): boolean {
    return order.createdAt > this.date;
  }
}
```

### Specification Builder

```typescript
class SpecificationBuilder<T> {
  private specification?: ISpecification<T>;

  where(spec: ISpecification<T>): SpecificationBuilder<T> {
    this.specification = spec;
    return this;
  }

  and(spec: ISpecification<T>): SpecificationBuilder<T> {
    if (!this.specification) {
      throw new Error('No initial specification set');
    }
    this.specification = this.specification.and(spec);
    return this;
  }

  or(spec: ISpecification<T>): SpecificationBuilder<T> {
    if (!this.specification) {
      throw new Error('No initial specification set');
    }
    this.specification = this.specification.or(spec);
    return this;
  }

  not(): SpecificationBuilder<T> {
    if (!this.specification) {
      throw new Error('No initial specification set');
    }
    this.specification = this.specification.not();
    return this;
  }

  build(): ISpecification<T> {
    if (!this.specification) {
      throw new Error('No specification built');
    }
    return this.specification;
  }
}

// Usage
const specification = new SpecificationBuilder<User>()
  .where(new ActiveUserSpecification())
  .and(new UserByRoleSpecification(UserRole.ADMIN))
  .and(new UserCreatedAfterSpecification(new Date('2023-01-01')))
  .build();

const activeAdminUsers =
  await userRepository.findBySpecification(specification);
```

## 🔄 Event Publishing

### Automatic Event Publishing

```typescript
// Repository with automatic event publishing
class EventPublishingRepository<
  T extends IAggregateRoot,
> extends BaseRepository<T> {
  async save(aggregate: T): Promise<void> {
    // Collect events before persistence
    const events = aggregate.getUncommittedEvents();

    // Persist aggregate
    await this.storageAdapter.save(aggregate);

    // Publish events after successful persistence
    if (events.length > 0) {
      await this.eventBus.publishMany(events);
      aggregate.markEventsAsCommitted();
    }
  }

  async saveWithEventStore(aggregate: T): Promise<void> {
    const events = aggregate.getUncommittedEvents();

    // Save aggregate and events in same transaction
    await this.storageAdapter.saveWithEvents(aggregate, events);

    // Publish events after successful persistence
    if (events.length > 0) {
      await this.eventBus.publishMany(events);
      aggregate.markEventsAsCommitted();
    }
  }
}
```

### Event Store Integration

```typescript
// Repository with event store integration
class EventSourcedRepository<T extends IAggregateRoot>
  implements IRepository<T>
{
  constructor(
    private readonly eventStore: IEventStore,
    private readonly eventBus: IEventBus,
    private readonly aggregateFactory: IAggregateFactory<T>
  ) {}

  async findById(id: EntityId): Promise<T | null> {
    const events = await this.eventStore.getEventsForAggregate(id);

    if (events.length === 0) {
      return null;
    }

    // Reconstruct aggregate from events
    const aggregate = this.aggregateFactory.createFromEvents(id, events);
    return aggregate;
  }

  async save(aggregate: T): Promise<void> {
    const events = aggregate.getUncommittedEvents();

    if (events.length === 0) {
      return;
    }

    // Save events to event store
    await this.eventStore.saveEvents(aggregate.id, events, aggregate.version);

    // Publish events
    await this.eventBus.publishMany(events);

    // Mark events as committed
    aggregate.markEventsAsCommitted();
  }

  async delete(id: EntityId): Promise<void> {
    // In event sourcing, we don't delete events
    // Instead, we could save a deletion event
    throw new Error('Deletion not supported in event sourced repository');
  }

  async exists(id: EntityId): Promise<boolean> {
    const events = await this.eventStore.getEventsForAggregate(id);
    return events.length > 0;
  }
}
```

## 💾 Storage Adapters

### Base Storage Adapter

```typescript
interface IStorageAdapter<T extends IAggregateRoot> {
  findById(id: EntityId): Promise<T | null>;
  save(aggregate: T): Promise<void>;
  delete(id: EntityId): Promise<void>;
  exists(id: EntityId): Promise<boolean>;

  findBySpecification(specification: ISpecification<T>): Promise<T[]>;
  countBySpecification(specification: ISpecification<T>): Promise<number>;

  findBySpecificationWithPaging(
    specification: ISpecification<T>,
    offset: number,
    limit: number
  ): Promise<T[]>;
}

abstract class BaseStorageAdapter<T extends IAggregateRoot>
  implements IStorageAdapter<T>
{
  protected constructor(
    protected readonly connection: IConnection,
    protected readonly serializer: ISerializer<T>
  ) {}

  abstract findById(id: EntityId): Promise<T | null>;
  abstract save(aggregate: T): Promise<void>;
  abstract delete(id: EntityId): Promise<void>;
  abstract exists(id: EntityId): Promise<boolean>;

  abstract findBySpecification(specification: ISpecification<T>): Promise<T[]>;
  abstract countBySpecification(
    specification: ISpecification<T>
  ): Promise<number>;

  abstract findBySpecificationWithPaging(
    specification: ISpecification<T>,
    offset: number,
    limit: number
  ): Promise<T[]>;
}
```

### In-Memory Storage Adapter

```typescript
class InMemoryStorageAdapter<
  T extends IAggregateRoot,
> extends BaseStorageAdapter<T> {
  private storage: Map<string, T> = new Map();

  constructor(serializer: ISerializer<T>) {
    super(null, serializer);
  }

  async findById(id: EntityId): Promise<T | null> {
    const aggregate = this.storage.get(id.value);
    return aggregate ? this.cloneAggregate(aggregate) : null;
  }

  async save(aggregate: T): Promise<void> {
    const cloned = this.cloneAggregate(aggregate);
    this.storage.set(aggregate.id.value, cloned);
  }

  async delete(id: EntityId): Promise<void> {
    this.storage.delete(id.value);
  }

  async exists(id: EntityId): Promise<boolean> {
    return this.storage.has(id.value);
  }

  async findBySpecification(specification: ISpecification<T>): Promise<T[]> {
    const results: T[] = [];

    for (const aggregate of this.storage.values()) {
      if (specification.isSatisfiedBy(aggregate)) {
        results.push(this.cloneAggregate(aggregate));
      }
    }

    return results;
  }

  async countBySpecification(
    specification: ISpecification<T>
  ): Promise<number> {
    let count = 0;

    for (const aggregate of this.storage.values()) {
      if (specification.isSatisfiedBy(aggregate)) {
        count++;
      }
    }

    return count;
  }

  async findBySpecificationWithPaging(
    specification: ISpecification<T>,
    offset: number,
    limit: number
  ): Promise<T[]> {
    const allResults = await this.findBySpecification(specification);
    return allResults.slice(offset, offset + limit);
  }

  private cloneAggregate(aggregate: T): T {
    // Deep clone using serializer
    const snapshot = aggregate.toSnapshot();
    return this.serializer.deserialize(snapshot);
  }
}
```

### SQL Storage Adapter

```typescript
class SQLStorageAdapter<
  T extends IAggregateRoot,
> extends BaseStorageAdapter<T> {
  constructor(
    connection: ISQLConnection,
    serializer: ISerializer<T>,
    private readonly tableName: string
  ) {
    super(connection, serializer);
  }

  async findById(id: EntityId): Promise<T | null> {
    const query = `SELECT * FROM ${this.tableName} WHERE id = ?`;
    const rows = await this.connection.query(query, [id.value]);

    if (rows.length === 0) {
      return null;
    }

    return this.serializer.deserialize(rows[0]);
  }

  async save(aggregate: T): Promise<void> {
    const snapshot = aggregate.toSnapshot();
    const data = this.serializer.serialize(snapshot);

    const query = `
      INSERT INTO ${this.tableName} (id, version, data, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        version = VALUES(version),
        data = VALUES(data),
        updated_at = VALUES(updated_at)
    `;

    await this.connection.execute(query, [
      aggregate.id.value,
      aggregate.version,
      JSON.stringify(data),
      new Date(),
      new Date(),
    ]);
  }

  async delete(id: EntityId): Promise<void> {
    const query = `DELETE FROM ${this.tableName} WHERE id = ?`;
    await this.connection.execute(query, [id.value]);
  }

  async exists(id: EntityId): Promise<boolean> {
    const query = `SELECT COUNT(*) as count FROM ${this.tableName} WHERE id = ?`;
    const rows = await this.connection.query(query, [id.value]);
    return rows[0].count > 0;
  }

  async findBySpecification(specification: ISpecification<T>): Promise<T[]> {
    // For SQL, we need to convert specifications to WHERE clauses
    const sqlQuery = this.specificationToSQL(specification);
    const rows = await this.connection.query(sqlQuery);

    return rows.map(row => this.serializer.deserialize(row));
  }

  async countBySpecification(
    specification: ISpecification<T>
  ): Promise<number> {
    const sqlQuery = this.specificationToSQL(specification, true);
    const rows = await this.connection.query(sqlQuery);
    return rows[0].count;
  }

  private specificationToSQL(
    specification: ISpecification<T>,
    count: boolean = false
  ): string {
    // This is a simplified implementation
    // In practice, you'd need a more sophisticated query builder
    const select = count ? 'SELECT COUNT(*) as count' : 'SELECT *';
    return `${select} FROM ${this.tableName} WHERE ${this.specificationToWhereClause(specification)}`;
  }

  private specificationToWhereClause(specification: ISpecification<T>): string {
    // Convert specification to SQL WHERE clause
    // This would need to be implemented based on your specific specifications
    return '1=1'; // Placeholder
  }
}
```

## 💽 Caching

### Repository with Caching

```typescript
class CachedRepository<T extends IAggregateRoot> extends BaseRepository<T> {
  constructor(
    eventBus: IEventBus,
    storageAdapter: IStorageAdapter<T>,
    private readonly cache: ICache<T>,
    private readonly cacheTtl: number = 3600 // 1 hour
  ) {
    super(eventBus, storageAdapter);
  }

  async findById(id: EntityId): Promise<T | null> {
    // Check cache first
    const cacheKey = this.getCacheKey(id);
    const cached = await this.cache.get(cacheKey);

    if (cached) {
      return cached;
    }

    // Load from storage
    const aggregate = await super.findById(id);

    // Cache the result
    if (aggregate) {
      await this.cache.set(cacheKey, aggregate, this.cacheTtl);
    }

    return aggregate;
  }

  async save(aggregate: T): Promise<void> {
    // Save to storage
    await super.save(aggregate);

    // Update cache
    const cacheKey = this.getCacheKey(aggregate.id);
    await this.cache.set(cacheKey, aggregate, this.cacheTtl);
  }

  async delete(id: EntityId): Promise<void> {
    // Delete from storage
    await super.delete(id);

    // Remove from cache
    const cacheKey = this.getCacheKey(id);
    await this.cache.delete(cacheKey);
  }

  private getCacheKey(id: EntityId): string {
    return `${this.constructor.name}:${id.value}`;
  }
}
```

### Cache Implementation

```typescript
interface ICache<T> {
  get(key: string): Promise<T | null>;
  set(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  exists(key: string): Promise<boolean>;
}

class RedisCache<T> implements ICache<T> {
  constructor(
    private readonly redis: IRedisClient,
    private readonly serializer: ISerializer<T>
  ) {}

  async get(key: string): Promise<T | null> {
    const value = await this.redis.get(key);

    if (!value) {
      return null;
    }

    return this.serializer.deserialize(JSON.parse(value));
  }

  async set(key: string, value: T, ttl?: number): Promise<void> {
    const serialized = JSON.stringify(this.serializer.serialize(value));

    if (ttl) {
      await this.redis.setex(key, ttl, serialized);
    } else {
      await this.redis.set(key, serialized);
    }
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async clear(): Promise<void> {
    await this.redis.flushall();
  }

  async exists(key: string): Promise<boolean> {
    return (await this.redis.exists(key)) === 1;
  }
}
```

## 📊 Transactions

### Transaction Support

```typescript
interface ITransaction {
  commit(): Promise<void>;
  rollback(): Promise<void>;
  isActive(): boolean;
}

interface ITransactionManager {
  begin(): Promise<ITransaction>;
  current(): ITransaction | null;
}

class TransactionalRepository<
  T extends IAggregateRoot,
> extends BaseRepository<T> {
  constructor(
    eventBus: IEventBus,
    storageAdapter: IStorageAdapter<T>,
    private readonly transactionManager: ITransactionManager
  ) {
    super(eventBus, storageAdapter);
  }

  async save(aggregate: T): Promise<void> {
    const transaction = this.transactionManager.current();

    if (!transaction) {
      // No active transaction, create one
      const newTransaction = await this.transactionManager.begin();

      try {
        await super.save(aggregate);
        await newTransaction.commit();
      } catch (error) {
        await newTransaction.rollback();
        throw error;
      }
    } else {
      // Use existing transaction
      await super.save(aggregate);
    }
  }

  async saveMany(aggregates: T[]): Promise<void> {
    const transaction = await this.transactionManager.begin();

    try {
      for (const aggregate of aggregates) {
        await super.save(aggregate);
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}
```

### Database Transaction Implementation

```typescript
class DatabaseTransaction implements ITransaction {
  private committed = false;
  private rolledBack = false;

  constructor(private readonly connection: IDatabaseConnection) {}

  async commit(): Promise<void> {
    if (this.committed || this.rolledBack) {
      throw new Error('Transaction already completed');
    }

    await this.connection.commit();
    this.committed = true;
  }

  async rollback(): Promise<void> {
    if (this.committed || this.rolledBack) {
      throw new Error('Transaction already completed');
    }

    await this.connection.rollback();
    this.rolledBack = true;
  }

  isActive(): boolean {
    return !this.committed && !this.rolledBack;
  }
}

class DatabaseTransactionManager implements ITransactionManager {
  private currentTransaction: ITransaction | null = null;

  constructor(private readonly connectionPool: IConnectionPool) {}

  async begin(): Promise<ITransaction> {
    if (this.currentTransaction?.isActive()) {
      throw new Error('Transaction already active');
    }

    const connection = await this.connectionPool.getConnection();
    await connection.beginTransaction();

    this.currentTransaction = new DatabaseTransaction(connection);
    return this.currentTransaction;
  }

  current(): ITransaction | null {
    return this.currentTransaction?.isActive() ? this.currentTransaction : null;
  }
}
```

## 🧪 Testing

### Repository Testing

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryStorageAdapter } from '@vytches/ddd-repositories/testing';

describe('UserRepository', () => {
  let repository: UserRepository;
  let storageAdapter: InMemoryStorageAdapter<User>;
  let eventBus: MockEventBus;

  beforeEach(() => {
    storageAdapter = new InMemoryStorageAdapter(new UserSerializer());
    eventBus = new MockEventBus();
    repository = new UserRepository(eventBus, storageAdapter);
  });

  it('should save and retrieve user', async () => {
    // Arrange
    const user = User.create('John Doe', 'john@example.com');

    // Act
    await repository.save(user);
    const retrieved = await repository.findById(user.id);

    // Assert
    expect(retrieved).toBeDefined();
    expect(retrieved!.name).toBe('John Doe');
    expect(retrieved!.email).toBe('john@example.com');
  });

  it('should publish events when saving', async () => {
    // Arrange
    const user = User.create('John Doe', 'john@example.com');

    // Act
    await repository.save(user);

    // Assert
    expect(eventBus.publishMany).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          eventType: 'UserCreated',
        }),
      ])
    );
  });

  it('should find users by specification', async () => {
    // Arrange
    const user1 = User.create('Active User', 'active@example.com');
    const user2 = User.create('Inactive User', 'inactive@example.com');
    user2.deactivate();

    await repository.save(user1);
    await repository.save(user2);

    // Act
    const activeUsers = await repository.findBySpecification(
      new ActiveUserSpecification()
    );

    // Assert
    expect(activeUsers).toHaveLength(1);
    expect(activeUsers[0].name).toBe('Active User');
  });
});
```

### Unit of Work Testing

```typescript
describe('UnitOfWork', () => {
  let unitOfWork: UnitOfWork;
  let userRepository: MockUserRepository;
  let orderRepository: MockOrderRepository;
  let eventBus: MockEventBus;

  beforeEach(() => {
    userRepository = new MockUserRepository();
    orderRepository = new MockOrderRepository();
    eventBus = new MockEventBus();

    unitOfWork = new UnitOfWork(eventBus);
    unitOfWork.registerRepository('UserRepository', userRepository);
    unitOfWork.registerRepository('OrderRepository', orderRepository);
  });

  it('should commit all changes', async () => {
    // Arrange
    const user = User.create('John Doe', 'john@example.com');
    const order = Order.create(user.id, orderData);

    unitOfWork.registerNew(user);
    unitOfWork.registerNew(order);

    // Act
    await unitOfWork.commit();

    // Assert
    expect(userRepository.save).toHaveBeenCalledWith(user);
    expect(orderRepository.save).toHaveBeenCalledWith(order);
    expect(eventBus.publishMany).toHaveBeenCalled();
  });

  it('should rollback on error', async () => {
    // Arrange
    const user = User.create('John Doe', 'john@example.com');
    unitOfWork.registerNew(user);

    userRepository.save.mockRejectedValue(new Error('Save failed'));

    // Act & Assert
    await expect(unitOfWork.commit()).rejects.toThrow('Save failed');
    expect(unitOfWork.getRegisteredAggregates()).toHaveLength(0);
  });
});
```

### Mock Implementations

```typescript
class MockUserRepository implements IUserRepository {
  private users: Map<string, User> = new Map();

  async findById(id: EntityId): Promise<User | null> {
    return this.users.get(id.value) || null;
  }

  async save(user: User): Promise<void> {
    this.users.set(user.id.value, user);
  }

  async delete(id: EntityId): Promise<void> {
    this.users.delete(id.value);
  }

  async exists(id: EntityId): Promise<boolean> {
    return this.users.has(id.value);
  }

  async findByEmail(email: Email): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.email.equals(email)) {
        return user;
      }
    }
    return null;
  }

  async findBySpecification(
    specification: ISpecification<User>
  ): Promise<User[]> {
    const results: User[] = [];

    for (const user of this.users.values()) {
      if (specification.isSatisfiedBy(user)) {
        results.push(user);
      }
    }

    return results;
  }
}
```

## 🏆 Best Practices

### Repository Design

```typescript
// ✅ Good: Specific repository interface
interface IUserRepository extends IRepository<User> {
  findByEmail(email: Email): Promise<User | null>;
  findActiveUsers(): Promise<User[]>;
  findUsersByRole(role: UserRole): Promise<User[]>;
}

// ❌ Bad: Generic repository with magic strings
interface IGenericRepository {
  findByField(field: string, value: any): Promise<any[]>;
}
```

### Error Handling

```typescript
// ✅ Good: Specific error handling
class UserRepository extends BaseRepository<User> {
  async findByEmail(email: Email): Promise<User | null> {
    try {
      const specification = new UserByEmailSpecification(email);
      return await this.findOneBySpecification(specification);
    } catch (error) {
      this.logger.error('Failed to find user by email', {
        email: email.value,
        error: error.message,
      });
      throw new RepositoryError('Failed to find user by email', error);
    }
  }
}

// ❌ Bad: Generic error handling
class UserRepository {
  async findByEmail(email: string): Promise<User | null> {
    try {
      // Implementation
    } catch (error) {
      throw error; // Just re-throw without context
    }
  }
}
```

### Specification Usage

```typescript
// ✅ Good: Composed specifications
const recentActiveAdminUsers = new ActiveUserSpecification()
  .and(new UserByRoleSpecification(UserRole.ADMIN))
  .and(new UserCreatedAfterSpecification(thirtyDaysAgo));

// ❌ Bad: Complex repository methods
interface IUserRepository {
  findActiveAdminUsersCreatedAfter(date: Date): Promise<User[]>;
  findInactiveRegularUsersCreatedBefore(date: Date): Promise<User[]>;
  // ... many more specific methods
}
```

## 🤝 Contributing

We welcome contributions! Please see our
[Contributing Guide](../../CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone repository
git clone https://github.com/vytches/ddd.git
cd ddd

# Install dependencies
pnpm install

# Build package
pnpm build --filter=@vytches/ddd-repositories

# Run tests
pnpm test --filter=@vytches/ddd-repositories

# Run in development mode
pnpm dev --filter=@vytches/ddd-repositories
```

## 📄 License

This project is licensed under the MIT License - see the
[LICENSE](../../LICENSE) file for details.

---

**Part of the [@vytches/ddd-core](https://github.com/vytches/ddd) ecosystem**

For more information, visit the [main documentation](../../README.md).
