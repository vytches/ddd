# @vytches-ddd/contracts

<!-- LLM-METADATA
Package: @vytches-ddd/contracts
Category: Foundation
Purpose: Enterprise-grade contracts and fundamental types for Domain-Driven Design, providing core interfaces and foundation types for the entire ecosystem
Dependencies: None (zero dependencies)
Complexity: Low
DDD Patterns: Foundation Layer, Entity Identification, Event Contracts, Aggregate Interfaces, Validation Contracts, Capability System
Integration Points: Foundation package used by all other packages; provides core interfaces and contracts that prevent circular dependencies
-->

[![npm version](https://badge.fury.io/js/%40vytches-ddd%2Fcontracts.svg)](https://badge.fury.io/js/%40vytches-ddd%2Fcontracts)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Foundation contracts and interfaces for the entire VytchesDDD ecosystem**

The Contracts package provides the fundamental interfaces, types, and base
implementations that serve as the foundation for all other VytchesDDD packages.
It includes core domain concepts like EntityId, event interfaces, validation
contracts, and capability definitions that ensure consistency across the entire
framework.

## 📋 Table of Contents

- [Installation](#installation)
- [Key Features](#key-features)
- [Core Concepts](#core-concepts)
- [Quick Start](#quick-start)
- [Entity Identification](#entity-identification)
- [Event Contracts](#event-contracts)
- [Validation Interfaces](#validation-interfaces)
- [Capability System](#capability-system)
- [Aggregate Contracts](#aggregate-contracts)
- [Event Store Interfaces](#event-store-interfaces)
- [Scheduling Contracts](#scheduling-contracts)
- [Architecture Benefits](#architecture-benefits)
- [Integration Patterns](#integration-patterns)
- [Testing](#testing)
- [Best Practices](#best-practices)
- [Contributing](#contributing)

## 🚀 Installation

```bash
# npm
npm install @vytches-ddd/contracts

# yarn
yarn add @vytches-ddd/contracts

# pnpm
pnpm add @vytches-ddd/contracts
```

### Zero Dependencies

This package has zero runtime dependencies, making it perfect as a foundation
layer:

```json
{
  "dependencies": {},
  "devDependencies": {
    "@vytches-ddd/testing": "workspace:*",
    "typescript": "^5.0.0",
    "vitest": "^2.0.0"
  }
}
```

## ✨ Key Features

### Foundation Layer

- **Zero Dependencies**: No runtime dependencies for maximum compatibility
- **Circular Dependency Prevention**: Breaks circular dependencies between
  packages
- **Type Safety**: Full TypeScript support with comprehensive type definitions
- **Enterprise Grade**: Production-ready contracts for large-scale applications

### Core Domain Concepts

- **EntityId Foundation**: Base EntityId implementation with factory methods
- **Event Interfaces**: Comprehensive event system contracts
- **Validation Contracts**: Specification and validation interfaces
- **Aggregate Interfaces**: Core aggregate behavior contracts

### Extensibility

- **Capability System**: Extensible capability pattern for aggregates and
  projections
- **Event Store Contracts**: Complete event sourcing interfaces
- **Scheduling Interfaces**: Job and event scheduling contracts
- **Integration Patterns**: Contracts for external system integration

### Developer Experience

- **IntelliSense Support**: Rich IDE support with comprehensive documentation
- **Type Inference**: Excellent TypeScript type inference
- **Minimal API**: Clean, focused API surface
- **Consistent Patterns**: Uniform interface patterns across all contracts

## 🎯 Core Concepts

### Entity Identification System

The foundation of domain entity identification:

```typescript
interface IEntityId<T = string> {
  getValue(): T;
  getType(): IdType;
  validate(value: T): boolean;
  equals(other: IEntityId<T>): boolean;
  isType(type: IdType): boolean;
  toString(): string;
  toJSON(): string;
}

type IdType = 'text' | 'uuid' | 'integer' | 'bigint';
```

### Event System Contracts

Comprehensive event-driven architecture interfaces:

```typescript
interface IDomainEvent {
  eventId: string;
  eventType: string;
  aggregateId: string;
  aggregateVersion: number;
  occurredOn: Date;
  eventData: Record<string, unknown>;
  metadata?: IEventMetadata;
}

interface IEventBus {
  publish(event: IDomainEvent): Promise<void>;
  subscribe<T extends IDomainEvent>(
    eventType: string,
    handler: IEventHandler<T>
  ): void;
  unsubscribe(eventType: string, handler: IEventHandler): void;
}
```

### Validation Contracts

Specification and validation interfaces:

```typescript
interface ISpecification<T> {
  isSatisfiedBy(entity: T): boolean;
  and(spec: ISpecification<T>): ISpecification<T>;
  or(spec: ISpecification<T>): ISpecification<T>;
  not(): ISpecification<T>;
}

interface IAsyncSpecification<T> {
  isSatisfiedByAsync(entity: T): Promise<boolean>;
  andAsync(spec: IAsyncSpecification<T>): IAsyncSpecification<T>;
  orAsync(spec: IAsyncSpecification<T>): IAsyncSpecification<T>;
  notAsync(): IAsyncSpecification<T>;
}
```

### Capability System

Extensible capability pattern for aggregates:

```typescript
interface IAggregateCapability<T = unknown> {
  name: string;
  apply(aggregate: T): T;
  canApply(aggregate: T): boolean;
  priority: number;
}

interface IProjectionCapability<T = unknown> {
  name: string;
  apply(projection: T): T;
  canApply(projection: T): boolean;
  priority: number;
}
```

## 🚀 Quick Start

### Basic EntityId Usage

```typescript
import { EntityId } from '@vytches-ddd/contracts';

// Factory methods for different ID types
const userIdUuid = EntityId.createUuid('550e8400-e29b-41d4-a716-446655440000');
const userIdText = EntityId.createText('user-123');
const userIdInteger = EntityId.createInteger(42);
const userIdBigInt = EntityId.createBigInt('9223372036854775807');

// Generate UUID
const newUserId = EntityId.createWithRandomUUID();

// Type-safe operations
console.log(userIdUuid.getValue()); // '550e8400-e29b-41d4-a716-446655440000'
console.log(userIdUuid.getType()); // 'uuid'
console.log(userIdUuid.toString()); // '550e8400-e29b-41d4-a716-446655440000'

// Equality checking
const anotherId = EntityId.createUuid('550e8400-e29b-41d4-a716-446655440000');
console.log(userIdUuid.equals(anotherId)); // true

// Type checking
console.log(userIdUuid.isType('uuid')); // true
console.log(userIdUuid.isType('text')); // false
```

### Event Contract Implementation

```typescript
import {
  IDomainEvent,
  IEventMetadata,
  createDomainEvent,
} from '@vytches-ddd/contracts';

// Create domain event
const orderCreated = createDomainEvent({
  eventType: 'OrderCreated',
  aggregateId: 'order-123',
  aggregateVersion: 1,
  eventData: {
    customerId: 'customer-456',
    orderItems: [{ productId: 'product-789', quantity: 2, price: 29.99 }],
    total: 59.98,
  },
  metadata: {
    causationId: 'command-create-order-123',
    correlationId: 'session-abc-def',
    userId: 'user-789',
  },
});

// Event handler implementation
class OrderCreatedHandler implements IEventHandler<OrderCreatedEvent> {
  async handle(event: OrderCreatedEvent): Promise<void> {
    console.log(`Order created: ${event.aggregateId}`);
    console.log(`Customer: ${event.eventData.customerId}`);
    console.log(`Total: ${event.eventData.total}`);
  }
}
```

### Specification Pattern

```typescript
import { ISpecification, IAsyncSpecification } from '@vytches-ddd/contracts';

// Synchronous specification
class CustomerIsActiveSpec implements ISpecification<Customer> {
  isSatisfiedBy(customer: Customer): boolean {
    return customer.isActive && !customer.isDeleted;
  }

  and(spec: ISpecification<Customer>): ISpecification<Customer> {
    return new AndSpecification(this, spec);
  }

  or(spec: ISpecification<Customer>): ISpecification<Customer> {
    return new OrSpecification(this, spec);
  }

  not(): ISpecification<Customer> {
    return new NotSpecification(this);
  }
}

// Async specification
class CustomerHasValidCreditSpec implements IAsyncSpecification<Customer> {
  constructor(private creditService: CreditService) {}

  async isSatisfiedByAsync(customer: Customer): Promise<boolean> {
    const creditScore = await this.creditService.getCreditScore(customer.id);
    return creditScore >= 650;
  }

  andAsync(spec: IAsyncSpecification<Customer>): IAsyncSpecification<Customer> {
    return new AndAsyncSpecification(this, spec);
  }

  orAsync(spec: IAsyncSpecification<Customer>): IAsyncSpecification<Customer> {
    return new OrAsyncSpecification(this, spec);
  }

  notAsync(): IAsyncSpecification<Customer> {
    return new NotAsyncSpecification(this);
  }
}
```

## 🆔 Entity Identification

### EntityId Implementation

The contracts package provides the base EntityId implementation:

```typescript
import { EntityId, IEntityId, IdType } from '@vytches-ddd/contracts';

// Basic construction
const entityId = new EntityId('user-123', 'text');

// Factory methods
const uuidId = EntityId.createUuid('550e8400-e29b-41d4-a716-446655440000');
const textId = EntityId.createText('customer-456');
const intId = EntityId.createInteger(789);
const bigIntId = EntityId.createBigInt('9223372036854775807');

// Validation
const isValid = entityId.validate('user-123'); // true

// Type checking
if (entityId.isType('text')) {
  console.log('Text-based ID');
}

// Serialization
const jsonString = entityId.toJSON();
const stringValue = entityId.toString();
```

### Custom EntityId Types

```typescript
// Custom EntityId with additional validation
class ProductIdId extends EntityId<string> {
  constructor(value: string) {
    super(value, 'text');
    this.validateProductId(value);
  }

  private validateProductId(value: string): void {
    if (!value.startsWith('PROD-')) {
      throw new Error('Product ID must start with PROD-');
    }
    if (value.length !== 12) {
      throw new Error('Product ID must be 12 characters long');
    }
  }

  static createProductId(value: string): ProductIdId {
    return new ProductIdId(value);
  }
}

// Usage
const productId = ProductIdId.createProductId('PROD-12345678');
```

### EntityId Factory Pattern

```typescript
import { IEntityIdFactory } from '@vytches-ddd/contracts';

class EntityIdFactory implements IEntityIdFactory {
  createFromString(value: string, type: IdType = 'text'): IEntityId<string> {
    switch (type) {
      case 'uuid':
        return EntityId.fromUUID(value);
      case 'integer':
        return EntityId.fromInteger(parseInt(value));
      case 'bigint':
        return EntityId.fromBigInt(value);
      case 'text':
      default:
        return EntityId.fromText(value);
    }
  }

  createRandom(type: IdType = 'uuid'): IEntityId<string> {
    switch (type) {
      case 'uuid':
        return EntityId.createWithRandomUUID();
      case 'integer':
        return EntityId.createInteger(Math.floor(Math.random() * 1000000));
      case 'bigint':
        return EntityId.createBigInt(BigInt(Date.now()));
      case 'text':
      default:
        return EntityId.createText(`text-${Date.now()}`);
    }
  }
}
```

## 📢 Event Contracts

### Domain Event Interface

```typescript
import { IDomainEvent, IEventMetadata } from '@vytches-ddd/contracts';

// Extended domain event with additional metadata
interface IExtendedDomainEvent extends IDomainEvent {
  causationId?: string;
  correlationId?: string;
  userId?: string;
  tenantId?: string;
  requestId?: string;
  sessionId?: string;
  version: string;
  payload: Record<string, unknown>;
}

// Event metadata structure
interface IEventMetadata {
  causationId?: string;
  correlationId?: string;
  userId?: string;
  tenantId?: string;
  requestId?: string;
  sessionId?: string;
  [key: string]: unknown;
}
```

### Event Bus Contracts

```typescript
import {
  IEventBus,
  IEventDispatcher,
  IEventHandler,
} from '@vytches-ddd/contracts';

// Event bus implementation requirements
interface IEventBus {
  publish(event: IDomainEvent): Promise<void>;
  publishMany(events: IDomainEvent[]): Promise<void>;
  subscribe<T extends IDomainEvent>(
    eventType: string,
    handler: IEventHandler<T>
  ): void;
  unsubscribe(eventType: string, handler: IEventHandler): void;
  clear(): void;
}

// Enhanced event dispatcher
interface IEnhancedEventDispatcher extends IEventDispatcher {
  dispatchWithTimeout(event: IDomainEvent, timeout: number): Promise<void>;
  dispatchWithRetry(event: IDomainEvent, maxRetries: number): Promise<void>;
  dispatchBatch(events: IDomainEvent[]): Promise<void>;
}

// Event handler with metadata
interface IEventHandler<T extends IDomainEvent = IDomainEvent> {
  handle(event: T): Promise<void>;
  canHandle?(event: IDomainEvent): boolean;
  priority?: number;
}
```

### Event Store Contracts

```typescript
import {
  IEventStore,
  IAdvancedEventStore,
  IEventStoreConfig,
  IAppendResult,
  IStoredEvent,
  IEventStream,
} from '@vytches-ddd/contracts';

// Basic event store interface
interface IEventStore {
  appendToStream(
    streamId: string,
    events: IStoredDomainEvent[],
    expectedVersion?: number
  ): Promise<IAppendResult>;

  readStream<T = unknown>(
    streamId: string,
    options?: IReadStreamOptions
  ): Promise<IEventStream<T>>;

  readAll<T = unknown>(
    options?: IReadAllOptions
  ): Promise<IGlobalEventStream<T>>;
}

// Advanced event store with snapshots and replay
interface IAdvancedEventStore extends IEventStore {
  getSnapshot<T = unknown>(
    streamId: string
  ): Promise<IAggregateSnapshot<T> | null>;
  saveSnapshot<T = unknown>(
    streamId: string,
    snapshot: IAggregateSnapshot<T>
  ): Promise<void>;

  createEventReplay(): IEventReplay;
  createAdvancedEventReplay(): IAdvancedEventReplay;

  replayStream(
    streamId: string,
    handler: (event: IStoredEvent) => Promise<void>
  ): Promise<void>;
  replayAll(handler: (event: IStoredEvent) => Promise<void>): Promise<void>;
}
```

## ✅ Validation Interfaces

### Specification Contracts

```typescript
import { ISpecification, IAsyncSpecification } from '@vytches-ddd/contracts';

// Composite specification pattern
class CompositeSpecification<T> implements ISpecification<T> {
  constructor(
    private left: ISpecification<T>,
    private right: ISpecification<T>,
    private operator: 'and' | 'or'
  ) {}

  isSatisfiedBy(entity: T): boolean {
    const leftResult = this.left.isSatisfiedBy(entity);
    const rightResult = this.right.isSatisfiedBy(entity);

    return this.operator === 'and'
      ? leftResult && rightResult
      : leftResult || rightResult;
  }

  and(spec: ISpecification<T>): ISpecification<T> {
    return new CompositeSpecification(this, spec, 'and');
  }

  or(spec: ISpecification<T>): ISpecification<T> {
    return new CompositeSpecification(this, spec, 'or');
  }

  not(): ISpecification<T> {
    return new NotSpecification(this);
  }
}

// Async specification with complex validation
class AsyncCompositeSpecification<T> implements IAsyncSpecification<T> {
  constructor(
    private left: IAsyncSpecification<T>,
    private right: IAsyncSpecification<T>,
    private operator: 'and' | 'or'
  ) {}

  async isSatisfiedByAsync(entity: T): Promise<boolean> {
    const [leftResult, rightResult] = await Promise.all([
      this.left.isSatisfiedByAsync(entity),
      this.right.isSatisfiedByAsync(entity),
    ]);

    return this.operator === 'and'
      ? leftResult && rightResult
      : leftResult || rightResult;
  }

  andAsync(spec: IAsyncSpecification<T>): IAsyncSpecification<T> {
    return new AsyncCompositeSpecification(this, spec, 'and');
  }

  orAsync(spec: IAsyncSpecification<T>): IAsyncSpecification<T> {
    return new AsyncCompositeSpecification(this, spec, 'or');
  }

  notAsync(): IAsyncSpecification<T> {
    return new AsyncNotSpecification(this);
  }
}
```

### Validation Rules

```typescript
import { IValidationRule, IValidationError } from '@vytches-ddd/contracts';

// Validation rule interface
interface IValidationRule<T> {
  validate(value: T): IValidationError[];
  getMessage(): string;
  getCode(): string;
}

// Validation error structure
interface IValidationError {
  message: string;
  code: string;
  field?: string;
  value?: unknown;
  metadata?: Record<string, unknown>;
}

// Complex validation rule
class EmailValidationRule implements IValidationRule<string> {
  validate(email: string): IValidationError[] {
    const errors: IValidationError[] = [];

    if (!email) {
      errors.push({
        message: 'Email is required',
        code: 'EMAIL_REQUIRED',
        field: 'email',
        value: email,
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email && !emailRegex.test(email)) {
      errors.push({
        message: 'Email format is invalid',
        code: 'EMAIL_INVALID_FORMAT',
        field: 'email',
        value: email,
      });
    }

    return errors;
  }

  getMessage(): string {
    return 'Email validation failed';
  }

  getCode(): string {
    return 'EMAIL_VALIDATION';
  }
}
```

## 🔧 Capability System

### Aggregate Capabilities

```typescript
import { IAggregateCapability, Capability } from '@vytches-ddd/contracts';

// Versioning capability
class VersioningCapability implements IAggregateCapability<AggregateRoot> {
  name = 'versioning';
  priority = 100;

  canApply(aggregate: AggregateRoot): boolean {
    return aggregate.version !== undefined;
  }

  apply(aggregate: AggregateRoot): AggregateRoot {
    // Apply versioning logic
    if (aggregate.version === undefined) {
      aggregate.version = 1;
    } else {
      aggregate.version++;
    }

    return aggregate;
  }
}

// Audit capability
class AuditCapability implements IAggregateCapability<AggregateRoot> {
  name = 'audit';
  priority = 200;

  canApply(aggregate: AggregateRoot): boolean {
    return true; // Can apply to any aggregate
  }

  apply(aggregate: AggregateRoot): AggregateRoot {
    // Add audit information
    aggregate.auditInfo = {
      lastModified: new Date(),
      lastModifiedBy: 'system',
      version: aggregate.version || 1,
    };

    return aggregate;
  }
}
```

### Projection Capabilities

```typescript
import { IProjectionCapability } from '@vytches-ddd/contracts';

// Checkpoint capability for projections
class CheckpointCapability implements IProjectionCapability<BaseProjection> {
  name = 'checkpoint';
  priority = 100;

  canApply(projection: BaseProjection): boolean {
    return projection.supportsCheckpoints;
  }

  apply(projection: BaseProjection): BaseProjection {
    // Add checkpoint functionality
    projection.checkpoint = {
      position: 0,
      timestamp: new Date(),
      version: 1,
    };

    return projection;
  }
}

// Snapshot capability for projections
class SnapshotCapability implements IProjectionCapability<BaseProjection> {
  name = 'snapshot';
  priority = 200;

  canApply(projection: BaseProjection): boolean {
    return projection.supportsSnapshots;
  }

  apply(projection: BaseProjection): BaseProjection {
    // Add snapshot functionality
    projection.snapshotting = {
      enabled: true,
      frequency: 1000,
      lastSnapshot: null,
    };

    return projection;
  }
}
```

### Capability Registry

```typescript
import {
  CapabilityRegistry,
  createCapabilityRegistry,
} from '@vytches-ddd/contracts';

// Create capability registry
const registry = createCapabilityRegistry();

// Register capabilities
registry.register(new VersioningCapability());
registry.register(new AuditCapability());
registry.register(new CheckpointCapability());
registry.register(new SnapshotCapability());

// Apply capabilities to aggregate
const aggregate = new OrderAggregate();
const enhancedAggregate = registry.applyCapabilities(aggregate);

// Apply capabilities to projection
const projection = new OrderProjection();
const enhancedProjection = registry.applyCapabilities(projection);
```

## 🏗️ Aggregate Contracts

### Aggregate Interface

```typescript
import { IAggregateWithEvents } from '@vytches-ddd/contracts';

// Aggregate with events contract
interface IAggregateWithEvents {
  id: IEntityId;
  version: number;
  uncommittedEvents: IDomainEvent[];

  addDomainEvent(event: IDomainEvent): void;
  clearDomainEvents(): void;
  getUncommittedEvents(): IDomainEvent[];
  markEventsAsCommitted(): void;
}

// Extended aggregate with additional features
interface IExtendedAggregate extends IAggregateWithEvents {
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;

  isDeleted(): boolean;
  delete(): void;
  restore(): void;
}
```

### Aggregate Implementation

```typescript
import {
  IAggregateWithEvents,
  IDomainEvent,
  IEntityId,
} from '@vytches-ddd/contracts';

class BaseAggregate implements IAggregateWithEvents {
  private _uncommittedEvents: IDomainEvent[] = [];

  constructor(
    public readonly id: IEntityId,
    public version: number = 0
  ) {}

  get uncommittedEvents(): IDomainEvent[] {
    return [...this._uncommittedEvents];
  }

  addDomainEvent(event: IDomainEvent): void {
    this._uncommittedEvents.push(event);
  }

  clearDomainEvents(): void {
    this._uncommittedEvents = [];
  }

  getUncommittedEvents(): IDomainEvent[] {
    return [...this._uncommittedEvents];
  }

  markEventsAsCommitted(): void {
    this._uncommittedEvents = [];
  }

  protected applyEvent(event: IDomainEvent): void {
    this.addDomainEvent(event);
    this.version++;
  }
}
```

## 📅 Scheduling Contracts

### Event Scheduling

```typescript
import {
  IEventScheduler,
  IScheduledEvent,
  IScheduleOptions,
  JobStatus,
  SchedulePriority,
} from '@vytches-ddd/contracts';

// Event scheduler interface
interface IEventScheduler {
  schedule(
    event: IDomainEvent,
    options: IScheduleOptions
  ): Promise<IScheduledEvent>;
  cancel(jobId: string): Promise<boolean>;
  reschedule(
    jobId: string,
    newOptions: IScheduleOptions
  ): Promise<IScheduledEvent>;
  getJob(jobId: string): Promise<IScheduledEvent | null>;
  query(filter: IJobFilter): Promise<IJobQueryResult>;
}

// Scheduled event structure
interface IScheduledEvent {
  id: string;
  event: IDomainEvent;
  scheduledFor: Date;
  status: JobStatus;
  priority: SchedulePriority;
  retryCount: number;
  maxRetries: number;
  lastError?: string;
  createdAt: Date;
  executedAt?: Date;
  completedAt?: Date;
  metadata?: Record<string, unknown>;
}

// Schedule options
interface IScheduleOptions {
  scheduledFor?: Date;
  delay?: number;
  priority?: SchedulePriority;
  maxRetries?: number;
  timeout?: number;
  recurring?: IRecurringPattern;
  metadata?: Record<string, unknown>;
}
```

### Job Management

```typescript
import {
  IScheduledJob,
  IJobFilter,
  IJobQueryResult,
} from '@vytches-ddd/contracts';

// Job filter for querying
interface IJobFilter {
  status?: JobStatus[];
  priority?: SchedulePriority[];
  scheduledBefore?: Date;
  scheduledAfter?: Date;
  eventType?: string[];
  aggregateId?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'scheduledFor' | 'priority' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

// Job query result
interface IJobQueryResult {
  jobs: IScheduledJob[];
  totalCount: number;
  hasMore: boolean;
  nextOffset?: number;
}

// Recurring pattern
interface IRecurringPattern {
  type: 'interval' | 'cron';
  value: string | number;
  endDate?: Date;
  maxOccurrences?: number;
  timezone?: string;
}
```

## 🏛️ Architecture Benefits

### Circular Dependency Prevention

The contracts package serves as a foundation layer that prevents circular
dependencies:

```typescript
// ✅ Good: All packages can depend on contracts
import { IEntityId, IDomainEvent } from '@vytches-ddd/contracts';

// ❌ Bad: Circular dependency
// import { EntityId } from '@vytches-ddd/value-objects';
// import { DomainEvent } from '@vytches-ddd/events';
```

### Consistent Interfaces

All packages implement consistent interfaces:

```typescript
// Value objects package implements IEntityId
export class EntityId implements IEntityId {
  // Enhanced implementation with validation
}

// Events package implements IDomainEvent
export class DomainEvent implements IDomainEvent {
  // Full event implementation
}

// Aggregates package implements IAggregateWithEvents
export class AggregateRoot implements IAggregateWithEvents {
  // Complete aggregate implementation
}
```

### Type Safety

Strong typing across the entire ecosystem:

```typescript
// Type-safe entity creation
function createUser(id: IEntityId, name: string): User {
  return new User(id, name);
}

// Type-safe event handling
function handleEvent<T extends IDomainEvent>(event: T): void {
  console.log(`Handling event: ${event.eventType}`);
}

// Type-safe specification
function validateUser(user: User, spec: ISpecification<User>): boolean {
  return spec.isSatisfiedBy(user);
}
```

## 🔄 Integration Patterns

### Package Integration

```typescript
// In domain-primitives package
import { IEntityId } from '@vytches-ddd/contracts';

export abstract class Entity {
  constructor(protected readonly _id: IEntityId) {}

  get id(): IEntityId {
    return this._id;
  }
}

// In aggregates package
import { IAggregateWithEvents, IDomainEvent } from '@vytches-ddd/contracts';

export abstract class AggregateRoot
  extends Entity
  implements IAggregateWithEvents
{
  private _uncommittedEvents: IDomainEvent[] = [];

  // Implementation using contracts
}

// In events package
import { IDomainEvent, IEventBus } from '@vytches-ddd/contracts';

export class UnifiedEventBus implements IEventBus {
  // Implementation using contracts
}
```

### Cross-Package Communication

```typescript
// Repository using contracts
import { IEntityId, IAggregateWithEvents } from '@vytches-ddd/contracts';

export abstract class Repository<T extends IAggregateWithEvents> {
  abstract findById(id: IEntityId): Promise<T | null>;
  abstract save(aggregate: T): Promise<void>;
  abstract delete(id: IEntityId): Promise<void>;
}

// Service using contracts
import { IEventBus, IDomainEvent } from '@vytches-ddd/contracts';

export class DomainService {
  constructor(private eventBus: IEventBus) {}

  async performAction(): Promise<void> {
    const event: IDomainEvent = {
      eventId: EntityId.createWithRandomUUID().toString(),
      eventType: 'ActionPerformed',
      aggregateId: 'service-123',
      aggregateVersion: 1,
      occurredOn: new Date(),
      eventData: { action: 'performed' },
    };

    await this.eventBus.publish(event);
  }
}
```

## 🧪 Testing

### Contract Testing

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { EntityId, IEntityId } from '@vytches-ddd/contracts';
import { safeRun } from '@vytches-ddd/utils';

describe('EntityId Contract', () => {
  describe('Factory Methods', () => {
    it('should create UUID EntityId', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const [error, entityId] = safeRun(() => EntityId.createUuid(uuid));

      expect(error).toBeUndefined();
      expect(entityId?.getValue()).toBe(uuid);
      expect(entityId?.getType()).toBe('uuid');
    });

    it('should create text EntityId', () => {
      const text = 'user-123';
      const [error, entityId] = safeRun(() => EntityId.createText(text));

      expect(error).toBeUndefined();
      expect(entityId?.getValue()).toBe(text);
      expect(entityId?.getType()).toBe('text');
    });

    it('should create integer EntityId', () => {
      const value = 42;
      const [error, entityId] = safeRun(() => EntityId.createInteger(value));

      expect(error).toBeUndefined();
      expect(entityId?.getValue()).toBe('42');
      expect(entityId?.getType()).toBe('integer');
    });

    it('should create bigint EntityId', () => {
      const value = '9223372036854775807';
      const [error, entityId] = safeRun(() => EntityId.createBigInt(value));

      expect(error).toBeUndefined();
      expect(entityId?.getValue()).toBe(value);
      expect(entityId?.getType()).toBe('bigint');
    });
  });

  describe('Validation', () => {
    it('should validate UUID format', () => {
      const [invalidError] = safeRun(() => EntityId.fromUUID('invalid-uuid'));
      expect(invalidError).toBeInstanceOf(Error);
      expect(invalidError?.message).toContain('valid UUID');

      const [validError] = safeRun(() =>
        EntityId.fromUUID('550e8400-e29b-41d4-a716-446655440000')
      );
      expect(validError).toBeUndefined();
    });

    it('should validate text format', () => {
      const [invalidError] = safeRun(() => EntityId.fromText('invalid text!'));
      expect(invalidError).toBeInstanceOf(Error);
      expect(invalidError?.message).toContain('invalid characters');

      const [validError] = safeRun(() => EntityId.fromText('valid-text-123'));
      expect(validError).toBeUndefined();
    });

    it('should validate integer format', () => {
      const [invalidError] = safeRun(() => EntityId.fromInteger(-1));
      expect(invalidError).toBeInstanceOf(Error);
      expect(invalidError?.message).toContain('non-negative integer');

      const [validError] = safeRun(() => EntityId.fromInteger(42));
      expect(validError).toBeUndefined();
    });
  });

  describe('Equality', () => {
    it('should compare EntityIds correctly', () => {
      const id1 = EntityId.createText('user-123');
      const id2 = EntityId.createText('user-123');
      const id3 = EntityId.createText('user-456');

      expect(id1.equals(id2)).toBe(true);
      expect(id1.equals(id3)).toBe(false);
    });

    it('should compare different types correctly', () => {
      const textId = EntityId.createText('123');
      const intId = EntityId.createInteger(123);

      expect(textId.equals(intId)).toBe(false);
    });
  });
});
```

### Interface Testing

```typescript
import { describe, it, expect } from 'vitest';
import { ISpecification } from '@vytches-ddd/contracts';

// Test specification implementation
class TestSpecification implements ISpecification<string> {
  constructor(private condition: (value: string) => boolean) {}

  isSatisfiedBy(entity: string): boolean {
    return this.condition(entity);
  }

  and(spec: ISpecification<string>): ISpecification<string> {
    return new TestSpecification(
      value => this.isSatisfiedBy(value) && spec.isSatisfiedBy(value)
    );
  }

  or(spec: ISpecification<string>): ISpecification<string> {
    return new TestSpecification(
      value => this.isSatisfiedBy(value) || spec.isSatisfiedBy(value)
    );
  }

  not(): ISpecification<string> {
    return new TestSpecification(value => !this.isSatisfiedBy(value));
  }
}

describe('Specification Interface', () => {
  it('should satisfy basic specification', () => {
    const spec = new TestSpecification(value => value.length > 3);

    expect(spec.isSatisfiedBy('test')).toBe(true);
    expect(spec.isSatisfiedBy('hi')).toBe(false);
  });

  it('should combine specifications with AND', () => {
    const lengthSpec = new TestSpecification(value => value.length > 3);
    const startsWithSpec = new TestSpecification(value =>
      value.startsWith('test')
    );

    const combined = lengthSpec.and(startsWithSpec);

    expect(combined.isSatisfiedBy('testing')).toBe(true);
    expect(combined.isSatisfiedBy('test')).toBe(true);
    expect(combined.isSatisfiedBy('other')).toBe(false);
  });

  it('should combine specifications with OR', () => {
    const lengthSpec = new TestSpecification(value => value.length > 10);
    const startsWithSpec = new TestSpecification(value =>
      value.startsWith('test')
    );

    const combined = lengthSpec.or(startsWithSpec);

    expect(combined.isSatisfiedBy('test')).toBe(true);
    expect(combined.isSatisfiedBy('very long string')).toBe(true);
    expect(combined.isSatisfiedBy('short')).toBe(false);
  });

  it('should negate specifications', () => {
    const spec = new TestSpecification(value => value.length > 3);
    const negated = spec.not();

    expect(negated.isSatisfiedBy('hi')).toBe(true);
    expect(negated.isSatisfiedBy('test')).toBe(false);
  });
});
```

## ✅ Best Practices

### Contract Design

1. **Keep Interfaces Minimal**: Focus on essential behavior
2. **Use Composition**: Prefer composition over inheritance
3. **Generic Types**: Use generic types for flexibility
4. **Immutable Interfaces**: Design for immutability where possible

```typescript
// ✅ Good: Minimal, focused interface
interface IEntityId<T = string> {
  getValue(): T;
  getType(): IdType;
  equals(other: IEntityId<T>): boolean;
  toString(): string;
}

// ❌ Bad: Overly complex interface
interface IComplexEntityId<T = string> {
  getValue(): T;
  getType(): IdType;
  equals(other: IEntityId<T>): boolean;
  toString(): string;
  serialize(): Buffer;
  deserialize(buffer: Buffer): void;
  encrypt(key: string): string;
  decrypt(encrypted: string, key: string): void;
  // ... too many responsibilities
}
```

### Implementation Guidelines

1. **Follow Interface Contracts**: Implement all interface methods
2. **Maintain Consistency**: Use consistent naming and patterns
3. **Document Behavior**: Add comprehensive documentation
4. **Test Thoroughly**: Test all contract implementations

```typescript
// ✅ Good: Complete contract implementation
class CustomEntityId implements IEntityId<string> {
  constructor(private readonly value: string) {}

  getValue(): string {
    return this.value;
  }

  getType(): IdType {
    return 'text';
  }

  equals(other: IEntityId<string>): boolean {
    return (
      other.getValue() === this.value && other.getType() === this.getType()
    );
  }

  toString(): string {
    return this.value;
  }

  validate(value: string): boolean {
    return value != null && value.length > 0;
  }

  isType(type: IdType): boolean {
    return type === 'text';
  }

  toJSON(): string {
    return JSON.stringify({ value: this.value, type: 'text' });
  }
}
```

### Extension Patterns

1. **Extend Interfaces**: Add new interfaces for additional functionality
2. **Maintain Backward Compatibility**: Don't break existing contracts
3. **Use Capabilities**: Extend behavior through capability pattern
4. **Version Interfaces**: Version interfaces for breaking changes

```typescript
// ✅ Good: Extending interfaces
interface IExtendedEntityId<T = string> extends IEntityId<T> {
  getMetadata(): Record<string, unknown>;
  hasMetadata(key: string): boolean;
}

// ✅ Good: Capability pattern
interface IEntityIdCapability<T = string> {
  enhance(entityId: IEntityId<T>): IEntityId<T>;
  canEnhance(entityId: IEntityId<T>): boolean;
}
```

## 📚 Contributing

We welcome contributions! Please see our
[Contributing Guide](../../CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone repository
git clone https://github.com/vytches/vytches-ddd.git

# Install dependencies
pnpm install

# Run tests
pnpm test

# Build package
pnpm build
```

---

**Built with ❤️ by the VytchesDDD Team**

_The foundation of the [@vytches-ddd](https://github.com/vytches/vytches-ddd)
ecosystem - Providing enterprise-grade contracts and interfaces for
Domain-Driven Design_
