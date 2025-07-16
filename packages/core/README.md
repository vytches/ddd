# @vytches-ddd/core

<!-- LLM-METADATA
Package: @vytches-ddd/core
Category: Meta-Package
Purpose: Enterprise API stability meta-package providing unified access to core DDD building blocks with stable interface
Dependencies: @vytches-ddd/aggregates, @vytches-ddd/domain-primitives, @vytches-ddd/value-objects, @vytches-ddd/repositories, @vytches-ddd/contracts, @vytches-ddd/utils, @vytches-ddd/logging
Complexity: Low (Meta-package)
DDD Patterns: Meta-package Pattern, Enterprise API Stability, Core Building Blocks, Foundation Layer
Integration Points: Single entry point for core DDD patterns; provides stable API for external consumers and other packages
-->

[![npm version](https://badge.fury.io/js/%40vytches-ddd%2Fcore.svg)](https://badge.fury.io/js/%40vytches-ddd%2Fcore)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Enterprise API stability meta-package for core Domain-Driven Design building
> blocks**

The Core package is a carefully crafted meta-package that provides
enterprise-grade API stability by aggregating and re-exporting the essential DDD
building blocks. It serves as the stable entry point for core domain patterns,
ensuring consistent access to aggregates, entities, value objects, repositories,
and error handling across your entire application.

## 📋 Table of Contents

- [Installation](#installation)
- [Key Features](#key-features)
- [Meta-Package Architecture](#meta-package-architecture)
- [Quick Start](#quick-start)
- [Core Building Blocks](#core-building-blocks)
- [Enterprise API Stability](#enterprise-api-stability)
- [Bundle Size Optimization](#bundle-size-optimization)
- [Migration Guide](#migration-guide)
- [Import Strategies](#import-strategies)
- [Tree Shaking](#tree-shaking)
- [Integration Patterns](#integration-patterns)
- [Best Practices](#best-practices)
- [Contributing](#contributing)

## 🚀 Installation

```bash
# npm
npm install @vytches-ddd/core

# yarn
yarn add @vytches-ddd/core

# pnpm
pnpm add @vytches-ddd/core
```

### Automatic Dependencies

The core package automatically pulls in all necessary dependencies:

```json
{
  "peerDependencies": {
    "@vytches-ddd/aggregates": "workspace:*",
    "@vytches-ddd/contracts": "workspace:*",
    "@vytches-ddd/domain-primitives": "workspace:*",
    "@vytches-ddd/logging": "workspace:*",
    "@vytches-ddd/repositories": "workspace:*",
    "@vytches-ddd/utils": "workspace:*",
    "@vytches-ddd/value-objects": "workspace:*"
  }
}
```

## ✨ Key Features

### Enterprise API Stability

- **Stable Interface**: Single, consistent API for all core DDD patterns
- **Version Management**: Coordinated versioning across all core packages
- **Breaking Change Protection**: Shields applications from internal package
  changes
- **Dependency Coordination**: Manages complex inter-package dependencies

### Meta-Package Architecture

- **Modular Foundation**: Built on specialized, focused packages
- **Tree-Shaking Optimized**: Only imports what you use
- **Zero Redundancy**: No duplicate code or functionality
- **Lightweight**: Minimal overhead with maximum functionality

### Core Building Blocks

- **Aggregate Root**: Complete aggregate pattern implementation
- **Entity Identification**: Enterprise-grade EntityId system
- **Value Objects**: Immutable value object base classes
- **Repository Pattern**: Repository and Unit of Work implementations
- **Error Handling**: Comprehensive domain error system

### Developer Experience

- **Single Import**: Access all core patterns from one package
- **IntelliSense**: Rich IDE support with comprehensive documentation
- **Type Safety**: Full TypeScript support with excellent type inference
- **Consistent API**: Uniform patterns across all building blocks

## 🏗️ Meta-Package Architecture

### Package Aggregation

The core package aggregates specialized packages:

```typescript
// From @vytches-ddd/aggregates
export {
  AggregateRoot,
  AggregateBuilder,
  AggregateError,
} from '@vytches-ddd/aggregates';

// From @vytches-ddd/contracts (Foundation)
export { EntityId } from '@vytches-ddd/contracts';

// From @vytches-ddd/domain-primitives
export {
  BaseError,
  InvalidParameterError,
  NotFoundError,
} from '@vytches-ddd/domain-primitives';

// From @vytches-ddd/value-objects
export { BaseValueObject } from '@vytches-ddd/value-objects';

// From @vytches-ddd/repositories
export { IBaseRepository, VersionError } from '@vytches-ddd/repositories';
```

### Dependency Graph

```
@vytches-ddd/core
├── @vytches-ddd/aggregates
│   ├── @vytches-ddd/contracts
│   ├── @vytches-ddd/domain-primitives
│   └── @vytches-ddd/value-objects
├── @vytches-ddd/domain-primitives
│   └── @vytches-ddd/contracts
├── @vytches-ddd/value-objects
│   └── @vytches-ddd/contracts
├── @vytches-ddd/repositories
│   ├── @vytches-ddd/contracts
│   └── @vytches-ddd/domain-primitives
└── @vytches-ddd/utils
```

## 🚀 Quick Start

### Single Import Usage

```typescript
import {
  AggregateRoot,
  EntityId,
  BaseValueObject,
  IBaseRepository,
  BaseError,
  InvalidParameterError,
} from '@vytches-ddd/core';

// Create Entity ID
const orderId = EntityId.createWithRandomUUID();

// Create Value Object
class Money extends BaseValueObject<{ amount: number; currency: string }> {
  constructor(amount: number, currency: string) {
    super({ amount, currency });
  }

  get amount(): number {
    return this.props.amount;
  }

  get currency(): string {
    return this.props.currency;
  }
}

// Create Aggregate
class Order extends AggregateRoot {
  private constructor(
    id: EntityId,
    private customerId: EntityId,
    private items: OrderItem[],
    private total: Money,
    private status: OrderStatus
  ) {
    super(id);
  }

  static create(data: CreateOrderData): Order {
    const orderId = EntityId.createWithRandomUUID();
    const order = new Order(
      orderId,
      data.customerId,
      data.items,
      data.total,
      OrderStatus.PENDING
    );

    order.addDomainEvent(new OrderCreatedEvent(orderId, data));
    return order;
  }

  confirm(): void {
    if (this.status !== OrderStatus.PENDING) {
      throw new InvalidParameterError(
        'Order cannot be confirmed in current status'
      );
    }

    this.status = OrderStatus.CONFIRMED;
    this.addDomainEvent(new OrderConfirmedEvent(this.id));
  }
}

// Repository Interface
interface IOrderRepository extends IBaseRepository<Order> {
  findByCustomerId(customerId: EntityId): Promise<Order[]>;
  findByStatus(status: OrderStatus): Promise<Order[]>;
}
```

### Complete Domain Implementation

```typescript
import {
  AggregateRoot,
  EntityId,
  BaseValueObject,
  IBaseRepository,
  BaseError,
  IActor,
} from '@vytches-ddd/core';

// Value Objects
class Email extends BaseValueObject<{ value: string }> {
  constructor(value: string) {
    if (!value || !value.includes('@')) {
      throw new InvalidParameterError('Invalid email format');
    }
    super({ value });
  }

  get value(): string {
    return this.props.value;
  }
}

class Address extends BaseValueObject<{
  street: string;
  city: string;
  country: string;
  postalCode: string;
}> {
  constructor(props: {
    street: string;
    city: string;
    country: string;
    postalCode: string;
  }) {
    super(props);
  }

  get street(): string {
    return this.props.street;
  }
  get city(): string {
    return this.props.city;
  }
  get country(): string {
    return this.props.country;
  }
  get postalCode(): string {
    return this.props.postalCode;
  }
}

// Aggregate
class Customer extends AggregateRoot {
  private constructor(
    id: EntityId,
    private name: string,
    private email: Email,
    private address: Address,
    private isActive: boolean = true
  ) {
    super(id);
  }

  static create(data: CreateCustomerData): Customer {
    const customerId = EntityId.createWithRandomUUID();
    const customer = new Customer(
      customerId,
      data.name,
      new Email(data.email),
      new Address(data.address)
    );

    customer.addDomainEvent(new CustomerCreatedEvent(customerId, data));
    return customer;
  }

  updateAddress(newAddress: Address, actor: IActor): void {
    this.address = newAddress;
    this.addDomainEvent(
      new CustomerAddressUpdatedEvent(this.id, newAddress, actor)
    );
  }

  deactivate(actor: IActor): void {
    if (!this.isActive) {
      throw new InvalidParameterError('Customer is already inactive');
    }

    this.isActive = false;
    this.addDomainEvent(new CustomerDeactivatedEvent(this.id, actor));
  }

  // Getters
  get customerId(): EntityId {
    return this.id;
  }
  get customerName(): string {
    return this.name;
  }
  get customerEmail(): Email {
    return this.email;
  }
  get customerAddress(): Address {
    return this.address;
  }
  get active(): boolean {
    return this.isActive;
  }
}

// Repository
interface ICustomerRepository extends IBaseRepository<Customer> {
  findByEmail(email: Email): Promise<Customer | null>;
  findActiveCustomers(): Promise<Customer[]>;
  findByCity(city: string): Promise<Customer[]>;
}
```

## 🧱 Core Building Blocks

### AggregateRoot

The foundation of domain aggregates:

```typescript
import { AggregateRoot, EntityId } from '@vytches-ddd/core';

class Product extends AggregateRoot {
  private constructor(
    id: EntityId,
    private name: string,
    private price: Money,
    private inventory: number
  ) {
    super(id);
  }

  static create(data: CreateProductData): Product {
    const productId = EntityId.createWithRandomUUID();
    const product = new Product(
      productId,
      data.name,
      data.price,
      data.inventory
    );

    product.addDomainEvent(new ProductCreatedEvent(productId, data));
    return product;
  }

  updatePrice(newPrice: Money): void {
    const oldPrice = this.price;
    this.price = newPrice;
    this.addDomainEvent(
      new ProductPriceUpdatedEvent(this.id, oldPrice, newPrice)
    );
  }

  adjustInventory(quantity: number): void {
    this.inventory += quantity;
    this.addDomainEvent(
      new ProductInventoryAdjustedEvent(this.id, quantity, this.inventory)
    );
  }

  // Getters
  get productId(): EntityId {
    return this.id;
  }
  get productName(): string {
    return this.name;
  }
  get productPrice(): Money {
    return this.price;
  }
  get availableInventory(): number {
    return this.inventory;
  }
}
```

### EntityId System

Enterprise-grade entity identification:

```typescript
import { EntityId, IdType } from '@vytches-ddd/core';

// Different ID types
const uuidId = EntityId.createWithRandomUUID();
const textId = EntityId.createText('customer-12345');
const intId = EntityId.createInteger(42);
const bigIntId = EntityId.createBigInt('9223372036854775807');

// Custom ID validation
class CustomerId extends EntityId {
  constructor(value: string) {
    super(value, 'text');
    this.validateCustomerId(value);
  }

  private validateCustomerId(value: string): void {
    if (!value.startsWith('CUST-')) {
      throw new InvalidParameterError('Customer ID must start with CUST-');
    }
  }

  static createCustomerId(value: string): CustomerId {
    return new CustomerId(value);
  }
}

// Usage
const customerId = CustomerId.createCustomerId('CUST-123456');
console.log(customerId.getValue()); // 'CUST-123456'
console.log(customerId.getType()); // 'text'
```

### Value Objects

Immutable value objects with validation:

```typescript
import { BaseValueObject, InvalidParameterError } from '@vytches-ddd/core';

class PhoneNumber extends BaseValueObject<{
  countryCode: string;
  number: string;
}> {
  constructor(countryCode: string, number: string) {
    if (!countryCode || !number) {
      throw new InvalidParameterError('Country code and number are required');
    }

    super({ countryCode, number });
  }

  get countryCode(): string {
    return this.props.countryCode;
  }

  get number(): string {
    return this.props.number;
  }

  get fullNumber(): string {
    return `${this.countryCode}${this.number}`;
  }

  static createFromString(phoneString: string): PhoneNumber {
    const match = phoneString.match(/^(\+\d{1,3})(\d+)$/);
    if (!match) {
      throw new InvalidParameterError('Invalid phone number format');
    }

    return new PhoneNumber(match[1], match[2]);
  }
}

// Usage
const phone = PhoneNumber.createFromString('+1234567890');
console.log(phone.countryCode); // '+1'
console.log(phone.number); // '234567890'
console.log(phone.fullNumber); // '+1234567890'
```

### Repository Pattern

Repository interfaces and implementations:

```typescript
import { IBaseRepository, EntityId } from '@vytches-ddd/core';

interface IProductRepository extends IBaseRepository<Product> {
  findByName(name: string): Promise<Product[]>;
  findByPriceRange(minPrice: Money, maxPrice: Money): Promise<Product[]>;
  findLowInventoryProducts(threshold: number): Promise<Product[]>;
}

class ProductRepository implements IProductRepository {
  private products: Map<string, Product> = new Map();

  async findById(id: EntityId): Promise<Product | null> {
    return this.products.get(id.toString()) || null;
  }

  async save(product: Product): Promise<void> {
    this.products.set(product.productId.toString(), product);
  }

  async delete(id: EntityId): Promise<void> {
    this.products.delete(id.toString());
  }

  async findByName(name: string): Promise<Product[]> {
    const products: Product[] = [];
    for (const product of this.products.values()) {
      if (product.productName.toLowerCase().includes(name.toLowerCase())) {
        products.push(product);
      }
    }
    return products;
  }

  async findByPriceRange(minPrice: Money, maxPrice: Money): Promise<Product[]> {
    const products: Product[] = [];
    for (const product of this.products.values()) {
      if (
        product.productPrice.amount >= minPrice.amount &&
        product.productPrice.amount <= maxPrice.amount
      ) {
        products.push(product);
      }
    }
    return products;
  }

  async findLowInventoryProducts(threshold: number): Promise<Product[]> {
    const products: Product[] = [];
    for (const product of this.products.values()) {
      if (product.availableInventory < threshold) {
        products.push(product);
      }
    }
    return products;
  }
}
```

### Error Handling

Comprehensive domain error system:

```typescript
import {
  BaseError,
  InvalidParameterError,
  NotFoundError,
  DuplicateError,
  MissingValueError,
} from '@vytches-ddd/core';

class OrderService {
  constructor(
    private orderRepository: IOrderRepository,
    private customerRepository: ICustomerRepository,
    private productRepository: IProductRepository
  ) {}

  async createOrder(data: CreateOrderData): Promise<Order> {
    // Validate customer exists
    const customer = await this.customerRepository.findById(data.customerId);
    if (!customer) {
      throw new NotFoundError('Customer not found', 'CUSTOMER_NOT_FOUND');
    }

    // Validate products exist and have inventory
    const products: Product[] = [];
    for (const item of data.items) {
      const product = await this.productRepository.findById(item.productId);
      if (!product) {
        throw new NotFoundError('Product not found', 'PRODUCT_NOT_FOUND');
      }

      if (product.availableInventory < item.quantity) {
        throw new InvalidParameterError(
          `Insufficient inventory for product ${product.productName}`,
          'INSUFFICIENT_INVENTORY'
        );
      }

      products.push(product);
    }

    // Check for duplicate order
    const existingOrder = await this.orderRepository.findByCustomerId(
      data.customerId
    );
    if (existingOrder.some(o => o.orderNumber === data.orderNumber)) {
      throw new DuplicateError(
        'Order with this number already exists',
        'DUPLICATE_ORDER'
      );
    }

    // Create order
    const order = Order.create(data);
    await this.orderRepository.save(order);

    return order;
  }

  async updateOrderStatus(
    orderId: EntityId,
    newStatus: OrderStatus
  ): Promise<void> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new NotFoundError('Order not found', 'ORDER_NOT_FOUND');
    }

    try {
      order.updateStatus(newStatus);
      await this.orderRepository.save(order);
    } catch (error) {
      if (error instanceof BaseError) {
        throw error;
      }
      throw new InvalidParameterError(
        'Failed to update order status',
        'UPDATE_FAILED'
      );
    }
  }
}
```

## 🏢 Enterprise API Stability

### Stable Interface Commitment

The core package provides a stable API that shields applications from internal
changes:

```typescript
// ✅ Stable - Will not change in breaking ways
import { AggregateRoot, EntityId, BaseValueObject } from '@vytches-ddd/core';

// ❌ Unstable - Internal package APIs may change
import { AggregateRoot } from '@vytches-ddd/aggregates';
import { EntityId } from '@vytches-ddd/contracts';
import { BaseValueObject } from '@vytches-ddd/value-objects';
```

### Version Coordination

The core package coordinates versions across all dependencies:

```json
{
  "dependencies": {
    "@vytches-ddd/core": "^0.1.4"
  }
}
```

This ensures all internal packages are compatible and tested together.

### API Evolution

The core package evolves with backward compatibility:

```typescript
// v0.1.x
export { AggregateRoot, EntityId } from '@vytches-ddd/core';

// v0.2.x (backward compatible)
export {
  AggregateRoot,
  EntityId,
  // New additions
  EnhancedAggregate,
  CompositeEntityId,
} from '@vytches-ddd/core';

// v1.0.x (breaking changes handled gracefully)
export {
  AggregateRoot,
  EntityId,
  // Deprecated items still available
  LegacyAggregate, // @deprecated Use AggregateRoot instead
} from '@vytches-ddd/core';
```

## 📦 Bundle Size Optimization

### Meta-Package Benefits

The core package provides optimal bundle sizes:

```typescript
// Before: Multiple package imports
import { AggregateRoot } from '@vytches-ddd/aggregates'; // 82KB
import { EntityId } from '@vytches-ddd/contracts'; // 2KB
import { BaseValueObject } from '@vytches-ddd/value-objects'; // 36KB
import { IBaseRepository } from '@vytches-ddd/repositories'; // 40KB
import { BaseError } from '@vytches-ddd/domain-primitives'; // 40KB
// Total: 200KB

// After: Single core import
import {
  AggregateRoot,
  EntityId,
  BaseValueObject,
  IBaseRepository,
  BaseError,
} from '@vytches-ddd/core';
// Total: 1.4KB meta-package + tree-shaken dependencies
```

### Tree Shaking Optimization

The core package is optimized for tree shaking:

```typescript
// Only imports what you use
import { AggregateRoot, EntityId } from '@vytches-ddd/core';
// Result: Only aggregate and entity-id code is bundled

// vs. importing everything
import * as Core from '@vytches-ddd/core';
// Result: Entire core package is bundled
```

## 🔄 Migration Guide

### From Individual Packages

```typescript
// Before: Individual package imports
import { AggregateRoot } from '@vytches-ddd/aggregates';
import { EntityId } from '@vytches-ddd/contracts';
import { BaseValueObject } from '@vytches-ddd/value-objects';
import { IBaseRepository } from '@vytches-ddd/repositories';
import { BaseError } from '@vytches-ddd/domain-primitives';

// After: Single core import
import {
  AggregateRoot,
  EntityId,
  BaseValueObject,
  IBaseRepository,
  BaseError,
} from '@vytches-ddd/core';
```

### Package.json Updates

```json
{
  "dependencies": {
    // Remove individual packages
    // "@vytches-ddd/aggregates": "^0.1.0",
    // "@vytches-ddd/contracts": "^0.1.0",
    // "@vytches-ddd/value-objects": "^0.1.0",
    // "@vytches-ddd/repositories": "^0.1.0",
    // "@vytches-ddd/domain-primitives": "^0.1.0",

    // Add core package
    "@vytches-ddd/core": "^0.1.4"
  }
}
```

### Import Strategy Updates

```typescript
// Update import statements across your codebase
// Use find-and-replace or automated tools

// From:
import { AggregateRoot } from '@vytches-ddd/aggregates';
import { EntityId } from '@vytches-ddd/contracts';

// To:
import { AggregateRoot, EntityId } from '@vytches-ddd/core';
```

## 📥 Import Strategies

### Recommended Import Strategy

```typescript
// ✅ Recommended: Named imports for better tree shaking
import {
  AggregateRoot,
  EntityId,
  BaseValueObject,
  IBaseRepository,
  BaseError,
} from '@vytches-ddd/core';

// ✅ Also good: Specific imports for single use
import { AggregateRoot } from '@vytches-ddd/core';
import { EntityId } from '@vytches-ddd/core';
```

### Avoid These Patterns

```typescript
// ❌ Avoid: Namespace imports (poor tree shaking)
import * as Core from '@vytches-ddd/core';
const aggregate = new Core.AggregateRoot();

// ❌ Avoid: Default imports (not supported)
import Core from '@vytches-ddd/core';

// ❌ Avoid: Mixed imports (inconsistent)
import { AggregateRoot } from '@vytches-ddd/core';
import { SomeClass } from '@vytches-ddd/aggregates';
```

### Type-Only Imports

```typescript
// ✅ Good: Type-only imports for interfaces
import type {
  IAggregateRoot,
  IBaseRepository,
  DomainErrorOptions,
} from '@vytches-ddd/core';

// ✅ Good: Mixed imports with type imports
import {
  AggregateRoot,
  EntityId,
  type IAggregateRoot,
  type IBaseRepository,
} from '@vytches-ddd/core';
```

## 🌳 Tree Shaking

### Optimized Exports

The core package is designed for maximum tree shaking:

```typescript
// Each export is individually tree-shakeable
export { AggregateRoot } from '@vytches-ddd/aggregates';
export { EntityId } from '@vytches-ddd/contracts';
export { BaseValueObject } from '@vytches-ddd/value-objects';
export { IBaseRepository } from '@vytches-ddd/repositories';
export { BaseError } from '@vytches-ddd/domain-primitives';
```

### Bundle Analysis

Check your bundle to verify tree shaking:

```bash
# Using webpack-bundle-analyzer
npm install --save-dev webpack-bundle-analyzer
npx webpack-bundle-analyzer dist/main.js

# Using rollup-plugin-analyzer
npm install --save-dev rollup-plugin-analyzer
# Add to rollup config
```

### Tree Shaking Best Practices

```typescript
// ✅ Good: Import only what you need
import { AggregateRoot, EntityId } from '@vytches-ddd/core';

class Order extends AggregateRoot {
  constructor(id: EntityId) {
    super(id);
  }
}

// ✅ Good: Conditional imports
async function loadAdvancedFeatures() {
  const { AdvancedAggregate } = await import('@vytches-ddd/core');
  return AdvancedAggregate;
}
```

## 🔗 Integration Patterns

### Application Setup

```typescript
import {
  AggregateRoot,
  EntityId,
  IBaseRepository,
  BaseError,
} from '@vytches-ddd/core';

// Domain layer
class Order extends AggregateRoot {
  // Implementation
}

// Repository layer
class OrderRepository implements IBaseRepository<Order> {
  async findById(id: EntityId): Promise<Order | null> {
    // Implementation
  }

  async save(order: Order): Promise<void> {
    // Implementation
  }

  async delete(id: EntityId): Promise<void> {
    // Implementation
  }
}

// Service layer
class OrderService {
  constructor(private orderRepository: OrderRepository) {}

  async createOrder(data: CreateOrderData): Promise<Order> {
    try {
      const order = Order.create(data);
      await this.orderRepository.save(order);
      return order;
    } catch (error) {
      if (error instanceof BaseError) {
        throw error;
      }
      throw new BaseError('Failed to create order', 'CREATE_ORDER_FAILED');
    }
  }
}
```

### Framework Integration

```typescript
// NestJS integration
import { Injectable } from '@nestjs/common';
import { AggregateRoot, EntityId, IBaseRepository } from '@vytches-ddd/core';

@Injectable()
export class OrderService {
  constructor(private orderRepository: IBaseRepository<Order>) {}

  async getOrder(id: string): Promise<Order | null> {
    const orderId = EntityId.createText(id);
    return await this.orderRepository.findById(orderId);
  }
}

// Express integration
import express from 'express';
import { EntityId, BaseError } from '@vytches-ddd/core';

const app = express();

app.get('/orders/:id', async (req, res) => {
  try {
    const orderId = EntityId.createText(req.params.id);
    const order = await orderService.getOrder(orderId);

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(order);
  } catch (error) {
    if (error instanceof BaseError) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

## ✅ Best Practices

### Import Consistency

1. **Use Core Package**: Always import from `@vytches-ddd/core` for core
   patterns
2. **Named Imports**: Use named imports for better tree shaking
3. **Type Imports**: Use type-only imports for interfaces
4. **Consistent Patterns**: Maintain consistent import patterns across your
   codebase

```typescript
// ✅ Good: Consistent core imports
import {
  AggregateRoot,
  EntityId,
  BaseValueObject,
  type IAggregateRoot,
  type IBaseRepository,
} from '@vytches-ddd/core';

// ❌ Bad: Mixed package imports
import { AggregateRoot } from '@vytches-ddd/aggregates';
import { EntityId } from '@vytches-ddd/contracts';
import { BaseValueObject } from '@vytches-ddd/value-objects';
```

### Bundle Optimization

1. **Tree Shaking**: Import only what you need
2. **Bundle Analysis**: Regularly analyze bundle sizes
3. **Lazy Loading**: Use dynamic imports for large features
4. **Code Splitting**: Split code at feature boundaries

```typescript
// ✅ Good: Optimized imports
import { AggregateRoot, EntityId } from '@vytches-ddd/core';

// ✅ Good: Lazy loading
const loadAdvancedFeatures = () => import('@vytches-ddd/advanced');

// ✅ Good: Code splitting
const OrderModule = lazy(() => import('./order-module'));
```

### Type Safety

1. **Interface Usage**: Use interfaces for contracts
2. **Generic Types**: Leverage generic types for flexibility
3. **Type Guards**: Implement type guards for runtime safety
4. **Strict TypeScript**: Use strict TypeScript configuration

```typescript
// ✅ Good: Type-safe implementation
import {
  AggregateRoot,
  EntityId,
  type IAggregateRoot,
} from '@vytches-ddd/core';

class Order extends AggregateRoot implements IAggregateRoot {
  constructor(id: EntityId) {
    super(id);
  }
}

// ✅ Good: Type guard
function isOrder(obj: unknown): obj is Order {
  return obj instanceof Order;
}
```

### Error Handling

1. **Domain Errors**: Use domain-specific error types
2. **Error Boundaries**: Implement error boundaries
3. **Consistent Handling**: Handle errors consistently across layers
4. **Logging**: Include comprehensive error logging

```typescript
// ✅ Good: Domain error handling
import {
  BaseError,
  InvalidParameterError,
  NotFoundError,
} from '@vytches-ddd/core';

class OrderService {
  async processOrder(orderId: EntityId): Promise<void> {
    try {
      const order = await this.orderRepository.findById(orderId);
      if (!order) {
        throw new NotFoundError('Order not found', 'ORDER_NOT_FOUND');
      }

      order.process();
      await this.orderRepository.save(order);
    } catch (error) {
      if (error instanceof BaseError) {
        throw error;
      }
      throw new InvalidParameterError(
        'Failed to process order',
        'PROCESS_FAILED'
      );
    }
  }
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

_The stable foundation of the
[@vytches-ddd](https://github.com/vytches/vytches-ddd) ecosystem - Your
enterprise-grade API for Domain-Driven Design_
