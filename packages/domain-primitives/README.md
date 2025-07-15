# @vytches-ddd/domain-primitives

<!-- LLM-METADATA
Package: @vytches-ddd/domain-primitives
Category: Foundation
Purpose: Core domain-driven design primitives including base classes, entities, value objects, and domain services
Dependencies: None (foundation package)
Complexity: Medium
DDD Patterns: Entity, Value Object, Domain Service, Aggregate Root, Repository, Specification
Integration Points: All other packages depend on this foundation
-->

[![npm version](https://badge.fury.io/js/%40vytches-ddd%2Fdomain-primitives.svg)](https://badge.fury.io/js/%40vytches-ddd%2Fdomain-primitives)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Foundation package providing core Domain-Driven Design primitives and base classes**

Essential building blocks for Domain-Driven Design including base classes for entities, value objects, domain services, and common interfaces. This is the foundation package that all other VytchesDDD packages depend on.

## 📋 Table of Contents

- [Installation](#installation)
- [Key Features](#key-features)
- [Core Concepts](#core-concepts)
- [Quick Start](#quick-start)
- [Entities](#entities)
- [Value Objects](#value-objects)
- [Domain Services](#domain-services)
- [Aggregate Root](#aggregate-root)
- [Repository Patterns](#repository-patterns)
- [Specifications](#specifications)
- [Error Handling](#error-handling)
- [Best Practices](#best-practices)
- [Testing](#testing)
- [Contributing](#contributing)

## 🚀 Installation

```bash
# npm
npm install @vytches-ddd/domain-primitives

# yarn
yarn add @vytches-ddd/domain-primitives

# pnpm
pnpm add @vytches-ddd/domain-primitives
```

### Peer Dependencies

```bash
# No peer dependencies - this is a foundation package
```

## ✨ Key Features

### Core DDD Building Blocks
- **Entity Base Class**: Identity-based objects with lifecycle management
- **Value Object Base Class**: Immutable objects compared by value
- **Domain Service Interface**: Stateless domain operations
- **Aggregate Root Interface**: Consistency boundary management

### Advanced Features
- **Repository Patterns**: Generic repository interfaces with CRUD operations
- **Specification Pattern**: Composable business rules and queries
- **Domain Events**: Event interfaces for aggregate communication
- **Error Hierarchy**: Comprehensive domain error types

### Enterprise Quality
- **Type Safety**: Full TypeScript support with strict typing
- **Immutability**: Value objects are immutable by design
- **Validation**: Built-in validation hooks and patterns
- **Testing Support**: Comprehensive testing utilities

## 🎯 Core Concepts

### Entity vs Value Object

The fundamental distinction in DDD between objects with identity and objects without:

```typescript
// Entity - has identity, mutable
abstract class Entity<TId> {
  protected constructor(protected _id: TId) {}
  
  public get id(): TId {
    return this._id;
  }
  
  public equals(other: Entity<TId>): boolean {
    return this._id === other._id;
  }
}

// Value Object - no identity, immutable
abstract class ValueObject {
  protected abstract getEqualityComponents(): any[];
  
  public equals(other: ValueObject): boolean {
    return this.getEqualityComponents().every(
      (component, index) => component === other.getEqualityComponents()[index]
    );
  }
}
```

### Domain Service

Domain services encapsulate domain logic that doesn't naturally fit within entities or value objects:

```typescript
interface IDomainService {
  readonly serviceName: string;
}

// Example domain service
class UserRegistrationService implements IDomainService {
  readonly serviceName = 'UserRegistrationService';
  
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly emailService: IEmailService
  ) {}
  
  async registerUser(userData: UserRegistrationData): Promise<User> {
    // Domain logic that spans multiple aggregates
    const existingUser = await this.userRepository.findByEmail(userData.email);
    if (existingUser) {
      throw new DomainError('User already exists');
    }
    
    const user = User.create(userData);
    await this.userRepository.save(user);
    await this.emailService.sendWelcomeEmail(user.email);
    
    return user;
  }
}
```

### Aggregate Root

Defines the consistency boundary and manages domain events:

```typescript
interface IAggregateRoot {
  readonly id: EntityId;
  readonly version: number;
  
  // Event management
  addDomainEvent(event: IDomainEvent): void;
  getUncommittedEvents(): IDomainEvent[];
  markEventsAsCommitted(): void;
  
  // Lifecycle
  toSnapshot(): AggregateSnapshot;
  fromSnapshot(snapshot: AggregateSnapshot): void;
}
```

## 🚀 Quick Start

### 1. Creating an Entity

```typescript
import { Entity } from '@vytches-ddd/domain-primitives';

class User extends Entity<string> {
  private _name: string;
  private _email: string;
  private _createdAt: Date;
  
  constructor(id: string, name: string, email: string) {
    super(id);
    this._name = name;
    this._email = email;
    this._createdAt = new Date();
  }
  
  public get name(): string {
    return this._name;
  }
  
  public get email(): string {
    return this._email;
  }
  
  public get createdAt(): Date {
    return this._createdAt;
  }
  
  public changeName(newName: string): void {
    if (!newName || newName.trim().length === 0) {
      throw new DomainError('Name cannot be empty');
    }
    this._name = newName;
  }
  
  public changeEmail(newEmail: string): void {
    if (!this.isValidEmail(newEmail)) {
      throw new DomainError('Invalid email format');
    }
    this._email = newEmail;
  }
  
  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
}
```

### 2. Creating a Value Object

```typescript
import { ValueObject } from '@vytches-ddd/domain-primitives';

class Money extends ValueObject {
  constructor(
    private readonly amount: number,
    private readonly currency: string
  ) {
    super();
    this.validate();
  }
  
  public get Amount(): number {
    return this.amount;
  }
  
  public get Currency(): string {
    return this.currency;
  }
  
  public add(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new DomainError('Cannot add money with different currencies');
    }
    return new Money(this.amount + other.amount, this.currency);
  }
  
  public subtract(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new DomainError('Cannot subtract money with different currencies');
    }
    return new Money(this.amount - other.amount, this.currency);
  }
  
  protected getEqualityComponents(): any[] {
    return [this.amount, this.currency];
  }
  
  private validate(): void {
    if (this.amount < 0) {
      throw new DomainError('Amount cannot be negative');
    }
    if (!this.currency || this.currency.length !== 3) {
      throw new DomainError('Currency must be a 3-character code');
    }
  }
}
```

### 3. Creating a Domain Service

```typescript
import { IDomainService } from '@vytches-ddd/domain-primitives';

class OrderProcessingService implements IDomainService {
  readonly serviceName = 'OrderProcessingService';
  
  constructor(
    private readonly orderRepository: IOrderRepository,
    private readonly inventoryService: IInventoryService,
    private readonly paymentService: IPaymentService
  ) {}
  
  async processOrder(orderData: OrderData): Promise<Order> {
    // Validate inventory
    await this.inventoryService.validateAvailability(orderData.items);
    
    // Create order
    const order = Order.create(orderData);
    
    // Process payment
    const paymentResult = await this.paymentService.processPayment(
      order.totalAmount,
      orderData.paymentMethod
    );
    
    if (!paymentResult.success) {
      throw new DomainError('Payment processing failed');
    }
    
    // Reserve inventory
    await this.inventoryService.reserveItems(orderData.items);
    
    // Save order
    await this.orderRepository.save(order);
    
    return order;
  }
}
```

## 🏛️ Entities

### Base Entity Class

```typescript
import { Entity, EntityId } from '@vytches-ddd/domain-primitives';

abstract class Entity<TId = EntityId> {
  protected constructor(protected _id: TId) {}
  
  public get id(): TId {
    return this._id;
  }
  
  public equals(other: Entity<TId>): boolean {
    if (!(other instanceof Entity)) {
      return false;
    }
    return this._id === other._id;
  }
  
  public toString(): string {
    return `${this.constructor.name}(${this._id})`;
  }
}
```

### Entity with Audit Trail

```typescript
abstract class AuditableEntity<TId = EntityId> extends Entity<TId> {
  protected _createdAt: Date;
  protected _updatedAt: Date;
  protected _createdBy?: string;
  protected _updatedBy?: string;
  
  protected constructor(id: TId, createdBy?: string) {
    super(id);
    this._createdAt = new Date();
    this._updatedAt = new Date();
    this._createdBy = createdBy;
    this._updatedBy = createdBy;
  }
  
  public get createdAt(): Date {
    return this._createdAt;
  }
  
  public get updatedAt(): Date {
    return this._updatedAt;
  }
  
  public get createdBy(): string | undefined {
    return this._createdBy;
  }
  
  public get updatedBy(): string | undefined {
    return this._updatedBy;
  }
  
  protected updateAuditInfo(updatedBy?: string): void {
    this._updatedAt = new Date();
    this._updatedBy = updatedBy;
  }
}
```

### Entity with Soft Delete

```typescript
abstract class SoftDeletableEntity<TId = EntityId> extends AuditableEntity<TId> {
  protected _deletedAt?: Date;
  protected _deletedBy?: string;
  protected _isDeleted: boolean = false;
  
  public get deletedAt(): Date | undefined {
    return this._deletedAt;
  }
  
  public get deletedBy(): string | undefined {
    return this._deletedBy;
  }
  
  public get isDeleted(): boolean {
    return this._isDeleted;
  }
  
  public markAsDeleted(deletedBy?: string): void {
    this._isDeleted = true;
    this._deletedAt = new Date();
    this._deletedBy = deletedBy;
    this.updateAuditInfo(deletedBy);
  }
  
  public restore(restoredBy?: string): void {
    this._isDeleted = false;
    this._deletedAt = undefined;
    this._deletedBy = undefined;
    this.updateAuditInfo(restoredBy);
  }
}
```

## 💎 Value Objects

### Base Value Object

```typescript
abstract class ValueObject {
  protected abstract getEqualityComponents(): any[];
  
  public equals(other: ValueObject): boolean {
    if (this.constructor !== other.constructor) {
      return false;
    }
    
    const thisComponents = this.getEqualityComponents();
    const otherComponents = other.getEqualityComponents();
    
    if (thisComponents.length !== otherComponents.length) {
      return false;
    }
    
    return thisComponents.every((component, index) => 
      component === otherComponents[index]
    );
  }
  
  public toString(): string {
    return `${this.constructor.name}(${this.getEqualityComponents().join(', ')})`;
  }
}
```

### Email Value Object

```typescript
class Email extends ValueObject {
  private readonly value: string;
  
  constructor(email: string) {
    super();
    this.value = this.validate(email);
  }
  
  public get Value(): string {
    return this.value;
  }
  
  public getDomain(): string {
    return this.value.split('@')[1];
  }
  
  public getLocalPart(): string {
    return this.value.split('@')[0];
  }
  
  protected getEqualityComponents(): any[] {
    return [this.value];
  }
  
  private validate(email: string): string {
    if (!email) {
      throw new DomainError('Email cannot be empty');
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new DomainError('Invalid email format');
    }
    
    return email.toLowerCase();
  }
}
```

### Address Value Object

```typescript
class Address extends ValueObject {
  constructor(
    private readonly street: string,
    private readonly city: string,
    private readonly state: string,
    private readonly zipCode: string,
    private readonly country: string
  ) {
    super();
    this.validate();
  }
  
  public get Street(): string {
    return this.street;
  }
  
  public get City(): string {
    return this.city;
  }
  
  public get State(): string {
    return this.state;
  }
  
  public get ZipCode(): string {
    return this.zipCode;
  }
  
  public get Country(): string {
    return this.country;
  }
  
  public getFullAddress(): string {
    return `${this.street}, ${this.city}, ${this.state} ${this.zipCode}, ${this.country}`;
  }
  
  protected getEqualityComponents(): any[] {
    return [this.street, this.city, this.state, this.zipCode, this.country];
  }
  
  private validate(): void {
    if (!this.street?.trim()) {
      throw new DomainError('Street is required');
    }
    if (!this.city?.trim()) {
      throw new DomainError('City is required');
    }
    if (!this.state?.trim()) {
      throw new DomainError('State is required');
    }
    if (!this.zipCode?.trim()) {
      throw new DomainError('Zip code is required');
    }
    if (!this.country?.trim()) {
      throw new DomainError('Country is required');
    }
  }
}
```

## 🔧 Domain Services

### Base Domain Service

```typescript
interface IDomainService {
  readonly serviceName: string;
}

abstract class DomainService implements IDomainService {
  abstract readonly serviceName: string;
  
  protected constructor() {}
}
```

### Price Calculator Service

```typescript
class PriceCalculatorService extends DomainService {
  readonly serviceName = 'PriceCalculatorService';
  
  constructor(
    private readonly taxService: ITaxService,
    private readonly discountService: IDiscountService
  ) {
    super();
  }
  
  async calculateTotalPrice(
    items: OrderItem[],
    customerId: string,
    shippingAddress: Address
  ): Promise<Money> {
    // Calculate base price
    const basePrice = items.reduce(
      (total, item) => total.add(item.price.multiply(item.quantity)),
      new Money(0, 'USD')
    );
    
    // Apply discounts
    const discountAmount = await this.discountService.calculateDiscount(
      customerId,
      basePrice
    );
    const discountedPrice = basePrice.subtract(discountAmount);
    
    // Calculate taxes
    const taxAmount = await this.taxService.calculateTax(
      discountedPrice,
      shippingAddress
    );
    
    // Return total price
    return discountedPrice.add(taxAmount);
  }
}
```

### User Authentication Service

```typescript
class UserAuthenticationService extends DomainService {
  readonly serviceName = 'UserAuthenticationService';
  
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly passwordHasher: IPasswordHasher
  ) {
    super();
  }
  
  async authenticateUser(email: Email, password: string): Promise<User> {
    const user = await this.userRepository.findByEmail(email);
    
    if (!user) {
      throw new AuthenticationError('Invalid credentials');
    }
    
    if (!user.isActive) {
      throw new AuthenticationError('Account is not active');
    }
    
    const isPasswordValid = await this.passwordHasher.verify(
      password,
      user.hashedPassword
    );
    
    if (!isPasswordValid) {
      throw new AuthenticationError('Invalid credentials');
    }
    
    // Update last login
    user.updateLastLogin();
    await this.userRepository.save(user);
    
    return user;
  }
}
```

## 🏗️ Aggregate Root

### Base Aggregate Root

```typescript
interface IAggregateRoot {
  readonly id: EntityId;
  readonly version: number;
  
  // Event management
  addDomainEvent(event: IDomainEvent): void;
  getUncommittedEvents(): IDomainEvent[];
  markEventsAsCommitted(): void;
  
  // Lifecycle
  toSnapshot(): AggregateSnapshot;
  fromSnapshot(snapshot: AggregateSnapshot): void;
}

abstract class AggregateRoot extends Entity<EntityId> implements IAggregateRoot {
  private _version: number = 0;
  private _uncommittedEvents: IDomainEvent[] = [];
  
  protected constructor(id: EntityId) {
    super(id);
  }
  
  public get version(): number {
    return this._version;
  }
  
  public addDomainEvent(event: IDomainEvent): void {
    this._uncommittedEvents.push(event);
  }
  
  public getUncommittedEvents(): IDomainEvent[] {
    return [...this._uncommittedEvents];
  }
  
  public markEventsAsCommitted(): void {
    this._uncommittedEvents = [];
  }
  
  protected incrementVersion(): void {
    this._version++;
  }
  
  public abstract toSnapshot(): AggregateSnapshot;
  public abstract fromSnapshot(snapshot: AggregateSnapshot): void;
}
```

### Order Aggregate Example

```typescript
class OrderAggregate extends AggregateRoot {
  private _customerId: EntityId;
  private _items: OrderItem[] = [];
  private _status: OrderStatus = OrderStatus.PENDING;
  private _totalAmount: Money;
  private _createdAt: Date;
  
  private constructor(id: EntityId, customerId: EntityId) {
    super(id);
    this._customerId = customerId;
    this._createdAt = new Date();
    this._totalAmount = new Money(0, 'USD');
  }
  
  public static create(customerId: EntityId): OrderAggregate {
    const order = new OrderAggregate(EntityId.create(), customerId);
    
    order.addDomainEvent(new OrderCreatedEvent({
      orderId: order.id.value,
      customerId: customerId.value,
      createdAt: order._createdAt
    }));
    
    return order;
  }
  
  public addItem(item: OrderItem): void {
    if (this._status !== OrderStatus.PENDING) {
      throw new DomainError('Cannot add items to a non-pending order');
    }
    
    this._items.push(item);
    this.recalculateTotal();
    this.incrementVersion();
    
    this.addDomainEvent(new OrderItemAddedEvent({
      orderId: this.id.value,
      itemId: item.id.value,
      quantity: item.quantity,
      price: item.price.Amount
    }));
  }
  
  public confirm(): void {
    if (this._status !== OrderStatus.PENDING) {
      throw new DomainError('Order is not in pending status');
    }
    
    if (this._items.length === 0) {
      throw new DomainError('Cannot confirm order without items');
    }
    
    this._status = OrderStatus.CONFIRMED;
    this.incrementVersion();
    
    this.addDomainEvent(new OrderConfirmedEvent({
      orderId: this.id.value,
      customerId: this._customerId.value,
      totalAmount: this._totalAmount.Amount,
      itemCount: this._items.length
    }));
  }
  
  public cancel(): void {
    if (this._status === OrderStatus.COMPLETED) {
      throw new DomainError('Cannot cancel completed order');
    }
    
    this._status = OrderStatus.CANCELLED;
    this.incrementVersion();
    
    this.addDomainEvent(new OrderCancelledEvent({
      orderId: this.id.value,
      customerId: this._customerId.value,
      reason: 'Cancelled by customer'
    }));
  }
  
  private recalculateTotal(): void {
    this._totalAmount = this._items.reduce(
      (total, item) => total.add(item.price.multiply(item.quantity)),
      new Money(0, 'USD')
    );
  }
  
  public toSnapshot(): AggregateSnapshot {
    return {
      id: this.id.value,
      version: this.version,
      data: {
        customerId: this._customerId.value,
        items: this._items.map(item => item.toSnapshot()),
        status: this._status,
        totalAmount: this._totalAmount.Amount,
        createdAt: this._createdAt.toISOString()
      }
    };
  }
  
  public fromSnapshot(snapshot: AggregateSnapshot): void {
    this._customerId = new EntityId(snapshot.data.customerId);
    this._items = snapshot.data.items.map(OrderItem.fromSnapshot);
    this._status = snapshot.data.status;
    this._totalAmount = new Money(snapshot.data.totalAmount, 'USD');
    this._createdAt = new Date(snapshot.data.createdAt);
    this._version = snapshot.version;
  }
}
```

## 🗃️ Repository Patterns

### Base Repository Interface

```typescript
interface IRepository<T extends IAggregateRoot> {
  findById(id: EntityId): Promise<T | null>;
  save(aggregate: T): Promise<void>;
  delete(id: EntityId): Promise<void>;
  exists(id: EntityId): Promise<boolean>;
}

interface IQueryableRepository<T extends IAggregateRoot> extends IRepository<T> {
  findAll(): Promise<T[]>;
  findBySpecification(specification: ISpecification<T>): Promise<T[]>;
  count(): Promise<number>;
  countBySpecification(specification: ISpecification<T>): Promise<number>;
}
```

### User Repository Interface

```typescript
interface IUserRepository extends IQueryableRepository<User> {
  findByEmail(email: Email): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  findActiveUsers(): Promise<User[]>;
  findUsersByRole(role: UserRole): Promise<User[]>;
  findUsersCreatedAfter(date: Date): Promise<User[]>;
}
```

### Generic Repository Base Class

```typescript
abstract class BaseRepository<T extends IAggregateRoot> implements IRepository<T> {
  protected constructor(
    protected readonly eventBus: IEventBus,
    protected readonly logger: ILogger
  ) {}
  
  public async save(aggregate: T): Promise<void> {
    try {
      // Persist aggregate
      await this.persist(aggregate);
      
      // Publish domain events
      const events = aggregate.getUncommittedEvents();
      if (events.length > 0) {
        await this.eventBus.publishMany(events);
        aggregate.markEventsAsCommitted();
      }
      
      this.logger.info('Aggregate saved successfully', {
        aggregateId: aggregate.id.value,
        aggregateType: aggregate.constructor.name,
        version: aggregate.version
      });
    } catch (error) {
      this.logger.error('Failed to save aggregate', {
        aggregateId: aggregate.id.value,
        error: error.message
      });
      throw error;
    }
  }
  
  public abstract findById(id: EntityId): Promise<T | null>;
  public abstract delete(id: EntityId): Promise<void>;
  public abstract exists(id: EntityId): Promise<boolean>;
  
  protected abstract persist(aggregate: T): Promise<void>;
}
```

## 🔍 Specifications

### Base Specification

```typescript
interface ISpecification<T> {
  isSatisfiedBy(entity: T): boolean;
  and(other: ISpecification<T>): ISpecification<T>;
  or(other: ISpecification<T>): ISpecification<T>;
  not(): ISpecification<T>;
}

abstract class Specification<T> implements ISpecification<T> {
  public abstract isSatisfiedBy(entity: T): boolean;
  
  public and(other: ISpecification<T>): ISpecification<T> {
    return new AndSpecification(this, other);
  }
  
  public or(other: ISpecification<T>): ISpecification<T> {
    return new OrSpecification(this, other);
  }
  
  public not(): ISpecification<T> {
    return new NotSpecification(this);
  }
}
```

### Composite Specifications

```typescript
class AndSpecification<T> extends Specification<T> {
  constructor(
    private readonly left: ISpecification<T>,
    private readonly right: ISpecification<T>
  ) {
    super();
  }
  
  public isSatisfiedBy(entity: T): boolean {
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
  
  public isSatisfiedBy(entity: T): boolean {
    return this.left.isSatisfiedBy(entity) || this.right.isSatisfiedBy(entity);
  }
}

class NotSpecification<T> extends Specification<T> {
  constructor(private readonly specification: ISpecification<T>) {
    super();
  }
  
  public isSatisfiedBy(entity: T): boolean {
    return !this.specification.isSatisfiedBy(entity);
  }
}
```

### Domain-Specific Specifications

```typescript
class ActiveUserSpecification extends Specification<User> {
  public isSatisfiedBy(user: User): boolean {
    return user.isActive && !user.isDeleted;
  }
}

class UserWithRoleSpecification extends Specification<User> {
  constructor(private readonly role: UserRole) {
    super();
  }
  
  public isSatisfiedBy(user: User): boolean {
    return user.role === this.role;
  }
}

class UserCreatedAfterSpecification extends Specification<User> {
  constructor(private readonly date: Date) {
    super();
  }
  
  public isSatisfiedBy(user: User): boolean {
    return user.createdAt > this.date;
  }
}

// Usage example
const activeAdminUsersSpec = new ActiveUserSpecification()
  .and(new UserWithRoleSpecification(UserRole.ADMIN))
  .and(new UserCreatedAfterSpecification(new Date('2023-01-01')));

const users = await userRepository.findBySpecification(activeAdminUsersSpec);
```

## 🚨 Error Handling

### Domain Error Hierarchy

```typescript
abstract class DomainError extends Error {
  protected constructor(
    message: string,
    public readonly errorCode: string,
    public readonly details?: any
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends DomainError {
  constructor(message: string, field?: string, value?: any) {
    super(message, 'VALIDATION_ERROR', { field, value });
  }
}

class BusinessRuleError extends DomainError {
  constructor(message: string, rule: string) {
    super(message, 'BUSINESS_RULE_ERROR', { rule });
  }
}

class NotFoundError extends DomainError {
  constructor(message: string, entityType?: string, id?: string) {
    super(message, 'NOT_FOUND_ERROR', { entityType, id });
  }
}

class ConcurrencyError extends DomainError {
  constructor(message: string, expectedVersion: number, actualVersion: number) {
    super(message, 'CONCURRENCY_ERROR', { expectedVersion, actualVersion });
  }
}

class AuthenticationError extends DomainError {
  constructor(message: string) {
    super(message, 'AUTHENTICATION_ERROR');
  }
}

class AuthorizationError extends DomainError {
  constructor(message: string, resource?: string, action?: string) {
    super(message, 'AUTHORIZATION_ERROR', { resource, action });
  }
}
```

### Error Usage Examples

```typescript
// In entity
class User extends Entity<EntityId> {
  public changeEmail(newEmail: string): void {
    if (!this.isValidEmail(newEmail)) {
      throw new ValidationError('Invalid email format', 'email', newEmail);
    }
    
    if (this.email === newEmail) {
      throw new BusinessRuleError('New email must be different from current email', 'EMAIL_CHANGE_RULE');
    }
    
    this._email = newEmail;
  }
}

// In repository
class UserRepository extends BaseRepository<User> {
  public async findById(id: EntityId): Promise<User | null> {
    const user = await this.dataSource.findById(id.value);
    
    if (!user) {
      return null;
    }
    
    return User.fromSnapshot(user);
  }
  
  public async findByEmail(email: Email): Promise<User | null> {
    const user = await this.dataSource.findByEmail(email.Value);
    
    if (!user) {
      return null;
    }
    
    return User.fromSnapshot(user);
  }
}

// In application service
class UserService {
  public async updateUserEmail(userId: EntityId, newEmail: Email): Promise<void> {
    const user = await this.userRepository.findById(userId);
    
    if (!user) {
      throw new NotFoundError(`User with id ${userId.value} not found`, 'User', userId.value);
    }
    
    // Check if email is already taken
    const existingUser = await this.userRepository.findByEmail(newEmail);
    if (existingUser && !existingUser.id.equals(userId)) {
      throw new BusinessRuleError('Email is already taken', 'UNIQUE_EMAIL_RULE');
    }
    
    user.changeEmail(newEmail.Value);
    await this.userRepository.save(user);
  }
}
```

## 🏆 Best Practices

### Entity Design

```typescript
// ✅ Good: Clear identity, encapsulated state, business methods
class Product extends Entity<EntityId> {
  private _name: string;
  private _price: Money;
  private _category: ProductCategory;
  private _isActive: boolean = true;
  
  constructor(id: EntityId, name: string, price: Money, category: ProductCategory) {
    super(id);
    this._name = this.validateName(name);
    this._price = price;
    this._category = category;
  }
  
  public changeName(newName: string): void {
    this._name = this.validateName(newName);
  }
  
  public changePrice(newPrice: Money): void {
    if (newPrice.Amount <= 0) {
      throw new BusinessRuleError('Price must be positive', 'POSITIVE_PRICE_RULE');
    }
    this._price = newPrice;
  }
  
  public deactivate(): void {
    this._isActive = false;
  }
  
  public activate(): void {
    this._isActive = true;
  }
  
  private validateName(name: string): string {
    if (!name || name.trim().length === 0) {
      throw new ValidationError('Product name cannot be empty', 'name', name);
    }
    if (name.length > 100) {
      throw new ValidationError('Product name cannot exceed 100 characters', 'name', name);
    }
    return name.trim();
  }
}

// ❌ Bad: Anemic entity, no business logic
class Product extends Entity<EntityId> {
  public name: string;
  public price: number;
  public category: string;
  public isActive: boolean;
}
```

### Value Object Design

```typescript
// ✅ Good: Immutable, validated, rich behavior
class PhoneNumber extends ValueObject {
  private readonly value: string;
  
  constructor(phoneNumber: string) {
    super();
    this.value = this.normalize(phoneNumber);
  }
  
  public get Value(): string {
    return this.value;
  }
  
  public getCountryCode(): string {
    return this.value.substring(0, 2);
  }
  
  public getAreaCode(): string {
    return this.value.substring(2, 5);
  }
  
  public getNumber(): string {
    return this.value.substring(5);
  }
  
  public format(): string {
    return `+${this.getCountryCode()} (${this.getAreaCode()}) ${this.getNumber()}`;
  }
  
  protected getEqualityComponents(): any[] {
    return [this.value];
  }
  
  private normalize(phoneNumber: string): string {
    // Remove all non-digit characters
    const digits = phoneNumber.replace(/\D/g, '');
    
    if (digits.length !== 11) {
      throw new ValidationError('Phone number must be 11 digits', 'phoneNumber', phoneNumber);
    }
    
    return digits;
  }
}

// ❌ Bad: Mutable, no validation
class PhoneNumber {
  public value: string;
  
  constructor(phoneNumber: string) {
    this.value = phoneNumber;
  }
}
```

### Domain Service Design

```typescript
// ✅ Good: Stateless, focused responsibility, clear dependencies
class InventoryReservationService implements IDomainService {
  readonly serviceName = 'InventoryReservationService';
  
  constructor(
    private readonly inventoryRepository: IInventoryRepository,
    private readonly reservationRepository: IReservationRepository
  ) {}
  
  async reserveItems(items: OrderItem[], customerId: EntityId): Promise<Reservation> {
    // Check availability
    for (const item of items) {
      const inventory = await this.inventoryRepository.findByProductId(item.productId);
      if (!inventory) {
        throw new NotFoundError(`Product ${item.productId.value} not found`);
      }
      
      if (inventory.availableQuantity < item.quantity) {
        throw new BusinessRuleError(
          `Insufficient inventory for product ${item.productId.value}`,
          'SUFFICIENT_INVENTORY_RULE'
        );
      }
    }
    
    // Create reservation
    const reservation = Reservation.create(items, customerId);
    
    // Update inventory
    for (const item of items) {
      const inventory = await this.inventoryRepository.findByProductId(item.productId);
      inventory.reserve(item.quantity);
      await this.inventoryRepository.save(inventory);
    }
    
    // Save reservation
    await this.reservationRepository.save(reservation);
    
    return reservation;
  }
}

// ❌ Bad: Stateful, multiple responsibilities
class InventoryReservationService {
  private reservations: Reservation[] = []; // Stateful!
  
  async reserveItems(items: OrderItem[]): Promise<void> {
    // Too many responsibilities: validation, inventory update, payment processing, notifications
    this.validateItems(items);
    this.updateInventory(items);
    this.processPayment(items);
    this.sendNotifications(items);
  }
}
```

## 🧪 Testing

### Entity Testing

```typescript
import { describe, it, expect } from 'vitest';

describe('User Entity', () => {
  it('should create user with valid data', () => {
    // Arrange
    const id = EntityId.create();
    const name = 'John Doe';
    const email = 'john@example.com';
    
    // Act
    const user = new User(id, name, email);
    
    // Assert
    expect(user.id).toBe(id);
    expect(user.name).toBe(name);
    expect(user.email).toBe(email);
    expect(user.createdAt).toBeInstanceOf(Date);
  });
  
  it('should change name when valid', () => {
    // Arrange
    const user = new User(EntityId.create(), 'John Doe', 'john@example.com');
    const newName = 'Jane Doe';
    
    // Act
    user.changeName(newName);
    
    // Assert
    expect(user.name).toBe(newName);
  });
  
  it('should throw error when changing to invalid name', () => {
    // Arrange
    const user = new User(EntityId.create(), 'John Doe', 'john@example.com');
    
    // Act & Assert
    expect(() => user.changeName('')).toThrow(DomainError);
    expect(() => user.changeName('   ')).toThrow(DomainError);
  });
});
```

### Value Object Testing

```typescript
describe('Money Value Object', () => {
  it('should create money with valid amount and currency', () => {
    // Arrange & Act
    const money = new Money(100, 'USD');
    
    // Assert
    expect(money.Amount).toBe(100);
    expect(money.Currency).toBe('USD');
  });
  
  it('should add money with same currency', () => {
    // Arrange
    const money1 = new Money(100, 'USD');
    const money2 = new Money(50, 'USD');
    
    // Act
    const result = money1.add(money2);
    
    // Assert
    expect(result.Amount).toBe(150);
    expect(result.Currency).toBe('USD');
  });
  
  it('should throw error when adding different currencies', () => {
    // Arrange
    const money1 = new Money(100, 'USD');
    const money2 = new Money(50, 'EUR');
    
    // Act & Assert
    expect(() => money1.add(money2)).toThrow(DomainError);
  });
  
  it('should be equal when amount and currency are same', () => {
    // Arrange
    const money1 = new Money(100, 'USD');
    const money2 = new Money(100, 'USD');
    
    // Act & Assert
    expect(money1.equals(money2)).toBe(true);
  });
});
```

### Domain Service Testing

```typescript
describe('OrderProcessingService', () => {
  let service: OrderProcessingService;
  let mockOrderRepository: jest.Mocked<IOrderRepository>;
  let mockInventoryService: jest.Mocked<IInventoryService>;
  let mockPaymentService: jest.Mocked<IPaymentService>;
  
  beforeEach(() => {
    mockOrderRepository = {
      save: jest.fn(),
      findById: jest.fn(),
    };
    
    mockInventoryService = {
      validateAvailability: jest.fn(),
      reserveItems: jest.fn(),
    };
    
    mockPaymentService = {
      processPayment: jest.fn(),
    };
    
    service = new OrderProcessingService(
      mockOrderRepository,
      mockInventoryService,
      mockPaymentService
    );
  });
  
  it('should process order successfully', async () => {
    // Arrange
    const orderData = createValidOrderData();
    mockInventoryService.validateAvailability.mockResolvedValue(true);
    mockPaymentService.processPayment.mockResolvedValue({ success: true });
    
    // Act
    const result = await service.processOrder(orderData);
    
    // Assert
    expect(result).toBeInstanceOf(Order);
    expect(mockInventoryService.validateAvailability).toHaveBeenCalledWith(orderData.items);
    expect(mockPaymentService.processPayment).toHaveBeenCalled();
    expect(mockInventoryService.reserveItems).toHaveBeenCalledWith(orderData.items);
    expect(mockOrderRepository.save).toHaveBeenCalledWith(result);
  });
});
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](../../CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone repository
git clone https://github.com/PawelGozdz/vytches-ddd.git
cd vytches-ddd

# Install dependencies
pnpm install

# Build package
pnpm build --filter=@vytches-ddd/domain-primitives

# Run tests
pnpm test --filter=@vytches-ddd/domain-primitives

# Run in development mode
pnpm dev --filter=@vytches-ddd/domain-primitives
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](../../LICENSE) file for details.

---

**Part of the [@vytches-ddd](https://github.com/PawelGozdz/vytches-ddd) ecosystem**

For more information, visit the [main documentation](../../README.md).