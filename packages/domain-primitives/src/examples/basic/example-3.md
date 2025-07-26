# Domain Interface Patterns

**Version**: 2025-01-21  
**Package**: @vytches/ddd-domain-primitives  
**Complexity**: Basic  
**Category**: Interfaces

## Overview

Domain interfaces define contracts that ensure consistency across your domain
layer. They establish clear boundaries and enable loose coupling between domain
components.

## Core Domain Interfaces

```typescript
import { IActor } from '@vytches/ddd-domain-primitives';
import { DomainEntity, DomainEvent, Repository } from '../types';

// ✅ Entity interface - Base for all domain entities
export interface IEntity<TId = string> {
  readonly id: TId;
  equals(other: IEntity<TId>): boolean;
}

// ✅ Aggregate root interface
export interface IAggregateRoot<TId = string> extends IEntity<TId> {
  readonly version: number;
  readonly uncommittedEvents: IDomainEvent[];

  markEventsAsCommitted(): void;
  getUncommittedEvents(): IDomainEvent[];
}

// ✅ Domain event interface
export interface IDomainEvent {
  readonly aggregateId: string;
  readonly eventId: string;
  readonly eventType: string;
  readonly eventVersion: number;
  readonly occurredAt: Date;
  readonly payload: unknown;
  readonly metadata?: IEventMetadata;
}

// ✅ Event metadata interface
export interface IEventMetadata {
  readonly correlationId?: string;
  readonly causationId?: string;
  readonly actor?: IActor;
  readonly [key: string]: unknown;
}

// ✅ Value object interface
export interface IValueObject<T> {
  equals(other: IValueObject<T>): boolean;
  getValue(): T;
  toString(): string;
}

// ✅ Specification interface for business rules
export interface ISpecification<T> {
  isSatisfiedBy(candidate: T): boolean;
  and(other: ISpecification<T>): ISpecification<T>;
  or(other: ISpecification<T>): ISpecification<T>;
  not(): ISpecification<T>;
}
```

## Repository Interfaces

```typescript
// ✅ Read repository interface
export interface IReadRepository<T extends IEntity> {
  findById(id: string): Promise<T | null>;
  findAll(): Promise<T[]>;
  exists(id: string): Promise<boolean>;
}

// ✅ Write repository interface
export interface IWriteRepository<T extends IEntity> {
  save(entity: T): Promise<void>;
  delete(id: string): Promise<void>;
}

// ✅ Full repository interface
export interface IRepository<T extends IEntity>
  extends IReadRepository<T>,
    IWriteRepository<T> {
  count(): Promise<number>;
}

// ✅ Event store interface
export interface IEventStore {
  saveEvents(events: IDomainEvent[]): Promise<void>;
  getEventsByAggregateId(aggregateId: string): Promise<IDomainEvent[]>;
  getEventsByType(eventType: string): Promise<IDomainEvent[]>;
  getEventsAfter(timestamp: Date): Promise<IDomainEvent[]>;
}
```

## Service Interfaces

```typescript
// ✅ Domain service interface
export interface IDomainService {
  readonly serviceName: string;
}

// ✅ Application service interface
export interface IApplicationService {
  readonly serviceName: string;
  readonly version: string;
}

// ✅ Query handler interface
export interface IQueryHandler<TQuery, TResult> {
  handle(query: TQuery): Promise<TResult>;
}

// ✅ Command handler interface
export interface ICommandHandler<TCommand, TResult = void> {
  handle(command: TCommand): Promise<TResult>;
}

// ✅ Event handler interface
export interface IEventHandler<TEvent extends IDomainEvent> {
  handle(event: TEvent): Promise<void>;
  supports(event: IDomainEvent): boolean;
}
```

## Implementation Examples

```typescript
// ✅ Implementing a domain entity
export class Product implements IEntity<string> {
  constructor(
    public readonly id: string,
    private name: string,
    private price: number
  ) {}

  equals(other: IEntity<string>): boolean {
    if (!(other instanceof Product)) {
      return false;
    }
    return this.id === other.id;
  }

  updatePrice(newPrice: number): void {
    if (newPrice <= 0) {
      throw new Error('Price must be positive');
    }
    this.price = newPrice;
  }

  getName(): string {
    return this.name;
  }

  getPrice(): number {
    return this.price;
  }
}

// ✅ Implementing a value object
export class Money
  implements IValueObject<{ amount: number; currency: string }>
{
  constructor(
    private readonly amount: number,
    private readonly currency: string
  ) {
    if (amount < 0) {
      throw new Error('Amount cannot be negative');
    }
  }

  equals(other: IValueObject<{ amount: number; currency: string }>): boolean {
    if (!(other instanceof Money)) {
      return false;
    }
    const otherValue = other.getValue();
    return (
      this.amount === otherValue.amount && this.currency === otherValue.currency
    );
  }

  getValue(): { amount: number; currency: string } {
    return { amount: this.amount, currency: this.currency };
  }

  toString(): string {
    return `${this.currency} ${this.amount.toFixed(2)}`;
  }

  add(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new Error('Cannot add money with different currencies');
    }
    return new Money(this.amount + other.getValue().amount, this.currency);
  }
}

// ✅ Implementing a specification
export class MinimumPriceSpecification implements ISpecification<Product> {
  constructor(private minPrice: number) {}

  isSatisfiedBy(product: Product): boolean {
    return product.getPrice() >= this.minPrice;
  }

  and(other: ISpecification<Product>): ISpecification<Product> {
    return new AndSpecification(this, other);
  }

  or(other: ISpecification<Product>): ISpecification<Product> {
    return new OrSpecification(this, other);
  }

  not(): ISpecification<Product> {
    return new NotSpecification(this);
  }
}

// Composite specifications
class AndSpecification<T> implements ISpecification<T> {
  constructor(
    private left: ISpecification<T>,
    private right: ISpecification<T>
  ) {}

  isSatisfiedBy(candidate: T): boolean {
    return (
      this.left.isSatisfiedBy(candidate) && this.right.isSatisfiedBy(candidate)
    );
  }

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
```

## Repository Implementation

```typescript
// ✅ In-memory repository implementation
export class InMemoryProductRepository implements IRepository<Product> {
  private products: Map<string, Product> = new Map();

  async findById(id: string): Promise<Product | null> {
    return this.products.get(id) || null;
  }

  async findAll(): Promise<Product[]> {
    return Array.from(this.products.values());
  }

  async exists(id: string): Promise<boolean> {
    return this.products.has(id);
  }

  async save(product: Product): Promise<void> {
    this.products.set(product.id, product);
  }

  async delete(id: string): Promise<void> {
    this.products.delete(id);
  }

  async count(): Promise<number> {
    return this.products.size;
  }

  // Additional query methods
  async findByPriceRange(
    minPrice: number,
    maxPrice: number
  ): Promise<Product[]> {
    return Array.from(this.products.values()).filter(
      p => p.getPrice() >= minPrice && p.getPrice() <= maxPrice
    );
  }
}
```

## Service Implementation

```typescript
// ✅ Domain service implementation
export class PricingService implements IDomainService {
  readonly serviceName = 'PricingService';

  calculateDiscount(
    product: Product,
    quantity: number,
    customerTier: string
  ): Money {
    const basePrice = product.getPrice();
    let discountPercentage = 0;

    // Quantity discounts
    if (quantity >= 10) {
      discountPercentage += 10;
    } else if (quantity >= 5) {
      discountPercentage += 5;
    }

    // Customer tier discounts
    switch (customerTier) {
      case 'gold':
        discountPercentage += 15;
        break;
      case 'silver':
        discountPercentage += 10;
        break;
      case 'bronze':
        discountPercentage += 5;
        break;
    }

    const discountAmount = basePrice * (discountPercentage / 100);
    return new Money(discountAmount, 'USD');
  }
}

// ✅ Command handler implementation
export class CreateProductCommand {
  constructor(
    public readonly name: string,
    public readonly price: number
  ) {}
}

export class CreateProductCommandHandler
  implements ICommandHandler<CreateProductCommand, Product>
{
  constructor(
    private repository: IRepository<Product>,
    private pricingService: PricingService
  ) {}

  async handle(command: CreateProductCommand): Promise<Product> {
    // Validate command
    if (!command.name || command.name.trim().length < 3) {
      throw new Error('Product name must be at least 3 characters');
    }

    if (command.price <= 0) {
      throw new Error('Product price must be positive');
    }

    // Create product
    const product = new Product(this.generateId(), command.name, command.price);

    // Save to repository
    await this.repository.save(product);

    return product;
  }

  private generateId(): string {
    return `prod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

## Key Benefits

1. **Clear Contracts**: Interfaces define precise contracts between components
2. **Loose Coupling**: Components depend on abstractions, not implementations
3. **Testability**: Easy to mock interfaces for testing
4. **Flexibility**: Swap implementations without changing dependent code
5. **Documentation**: Interfaces serve as living documentation

## Best Practices

1. **Keep interfaces focused** on a single responsibility
2. **Use meaningful names** that describe the contract
3. **Document interface methods** with clear expectations
4. **Avoid leaky abstractions** that expose implementation details
5. **Version interfaces** when making breaking changes

## Common Patterns

```typescript
// ✅ Good: Clear, focused interface
interface IEmailService {
  send(to: string, subject: string, body: string): Promise<void>;
}

// ❌ Bad: Too many responsibilities
interface IUserService {
  createUser(data: any): Promise<any>;
  sendEmail(to: string, body: string): Promise<void>;
  generateReport(): Promise<any>;
  backupDatabase(): Promise<void>;
}

// ✅ Good: Generic repository with constraints
interface IRepository<T extends IEntity> {
  findById(id: string): Promise<T | null>;
  save(entity: T): Promise<void>;
}

// ✅ Good: Segregated interfaces
interface IReadOnlyRepository<T> {
  findById(id: string): Promise<T | null>;
  findAll(): Promise<T[]>;
}

interface IWriteOnlyRepository<T> {
  save(entity: T): Promise<void>;
  delete(id: string): Promise<void>;
}
```

## Next Steps

- Explore composite domain patterns
- Learn about interface segregation principles
- Implement domain event interfaces
- Create adapter patterns for external systems
