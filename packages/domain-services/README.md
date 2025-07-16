# @vytches-ddd/domain-services

<!-- LLM-METADATA
Package: @vytches-ddd/domain-services
Category: Patterns
Purpose: Domain services for complex business logic coordination, stateless operations, and cross-aggregate workflows
Dependencies: @vytches-ddd/core, @vytches-ddd/validation, @vytches-ddd/contracts
Complexity: Medium
DDD Patterns: Domain Services, Service Coordination, Business Logic Encapsulation, Transactional Operations, Event Publishing
Integration Points: Essential for complex business workflows; integrates with repositories, aggregates, Unit of Work, and event systems
-->

[![npm version](https://badge.fury.io/js/%40vytches-ddd%2Fdomain-services.svg)](https://badge.fury.io/js/%40vytches-ddd%2Fdomain-services)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Enterprise-grade Domain Services implementation for complex business logic
> coordination**

Comprehensive Domain Services package providing base classes, decorators, and
patterns for encapsulating complex business logic that doesn't naturally fit
within a single aggregate or entity. Supports transactional operations, event
publishing, and dependency injection integration.

## 📋 Table of Contents

- [Installation](#installation)
- [Key Features](#key-features)
- [Core Concepts](#core-concepts)
- [Quick Start](#quick-start)
- [Base Domain Services](#base-domain-services)
- [Service Decorators](#service-decorators)
- [Transactional Services](#transactional-services)
- [Event-Aware Services](#event-aware-services)
- [Dependency Injection](#dependency-injection)
- [Service Lifecycle](#service-lifecycle)
- [Error Handling](#error-handling)
- [Testing](#testing)
- [Best Practices](#best-practices)
- [Contributing](#contributing)

## 🚀 Installation

```bash
# npm
npm install @vytches-ddd/domain-services

# yarn
yarn add @vytches-ddd/domain-services

# pnpm
pnpm add @vytches-ddd/domain-services
```

### Dependencies

```bash
# Required peer dependencies
npm install @vytches-ddd/core @vytches-ddd/validation @vytches-ddd/contracts
```

## ✨ Key Features

### Service Coordination

- **Business Logic Encapsulation**: Encapsulate complex business operations that
  span multiple aggregates
- **Stateless Operations**: Maintain stateless service design following DDD
  principles
- **Cross-Aggregate Workflows**: Coordinate operations across multiple domain
  boundaries
- **Service Composition**: Compose complex operations from simpler service
  building blocks

### Transactional Support

- **Unit of Work Integration**: Seamless integration with Unit of Work pattern
  for consistency
- **Transaction Management**: Automatic transaction handling with
  commit/rollback capabilities
- **Repository Access**: Direct access to repositories within transactional
  boundaries
- **Event Coordination**: Coordinate events with transactional operations

### Event Publishing

- **Domain Event Support**: Native support for publishing domain events
- **Event Bus Integration**: Automatic event bus configuration and publishing
- **Transactional Events**: Publish events within transactional boundaries
- **Event Lifecycle Management**: Manage event publishing lifecycle with service
  operations

### Dependency Injection

- **Auto-Discovery**: Automatic service discovery and registration with DI
  container
- **Dependency Management**: Declare and inject service dependencies
- **Lifecycle Management**: Support for singleton, transient, and scoped service
  lifetimes
- **Context Isolation**: Bounded context-aware service registration and
  resolution

## 🎯 Core Concepts

### Domain Service Interface

The core interface for all domain services:

```typescript
interface IDomainService {
  readonly serviceId: string;
}

// Extended interfaces for specific capabilities
interface IEventBusAware {
  setEventBus(eventBus: IEventBus): void;
}

interface IUnitOfWorkAware {
  setUnitOfWork(unitOfWork: IUnitOfWork): void;
  clearUnitOfWork(): void;
}

interface IAsyncDomainService {
  initialize(): Promise<void>;
  dispose(): Promise<void>;
}
```

### Service Base Classes

Multiple base classes for different service patterns:

```typescript
// Basic domain service
abstract class IBaseDomainService implements IDomainService {
  constructor(public readonly serviceId: string) {}
}

// Event-aware service
abstract class EventAwareDomainService
  extends IBaseDomainService
  implements IEventBusAware
{
  protected publishEvent<T extends IDomainEvent>(event: T): void;
}

// Transactional service
abstract class UnitOfWorkAwareDomainService
  extends EventAwareDomainService
  implements IUnitOfWorkAware
{
  protected getRepository<T>(name: string): T;
  protected executeInTransaction<T>(operation: () => Promise<T>): Promise<T>;
}

// Async lifecycle service
abstract class AsyncDomainService
  extends IBaseDomainService
  implements IAsyncDomainService
{
  async initialize(): Promise<void>;
  async dispose(): Promise<void>;
}
```

## 🚀 Quick Start

### Basic Domain Service

```typescript
import {
  IBaseDomainService,
  DomainService,
} from '@vytches-ddd/domain-services';

@DomainService('orderCalculationService')
class OrderCalculationService extends IBaseDomainService {
  constructor() {
    super('orderCalculationService');
  }

  calculateTotal(items: OrderItem[]): Money {
    return items.reduce((total, item) => {
      return total.add(item.price.multiply(item.quantity));
    }, Money.zero());
  }

  calculateTax(subtotal: Money, taxRate: number): Money {
    return subtotal.multiply(taxRate);
  }

  calculateShipping(weight: Weight, destination: Address): Money {
    // Complex shipping calculation logic
    return this.getShippingCost(weight, destination);
  }

  private getShippingCost(weight: Weight, destination: Address): Money {
    // Implementation details...
    return Money.fromAmount(10.0);
  }
}
```

### Event-Aware Service

```typescript
import {
  EventAwareDomainService,
  DomainService,
} from '@vytches-ddd/domain-services';
import { OrderProcessedEvent } from '../events/order-processed.event';

@DomainService({
  serviceId: 'orderProcessingService',
  publishesEvents: true,
})
class OrderProcessingService extends EventAwareDomainService {
  constructor() {
    super('orderProcessingService');
  }

  async processOrder(order: Order): Promise<void> {
    // Complex order processing logic
    await this.validateOrder(order);
    await this.reserveInventory(order);
    await this.chargePayment(order);

    // Publish domain event
    this.publishEvent(
      new OrderProcessedEvent({
        orderId: order.id,
        customerId: order.customerId,
        total: order.total,
        processedAt: new Date(),
      })
    );
  }

  private async validateOrder(order: Order): Promise<void> {
    // Validation logic
  }

  private async reserveInventory(order: Order): Promise<void> {
    // Inventory reservation logic
  }

  private async chargePayment(order: Order): Promise<void> {
    // Payment processing logic
  }
}
```

### Transactional Service

```typescript
import {
  UnitOfWorkAwareDomainService,
  DomainService,
} from '@vytches-ddd/domain-services';
import { IOrderRepository } from '../repositories/order.repository';
import { ICustomerRepository } from '../repositories/customer.repository';

@DomainService({
  serviceId: 'orderManagementService',
  transactional: true,
  publishesEvents: true,
  dependencies: ['orderRepository', 'customerRepository'],
})
class OrderManagementService extends UnitOfWorkAwareDomainService {
  constructor() {
    super('orderManagementService');
  }

  async createOrderForCustomer(
    customerId: string,
    items: OrderItem[]
  ): Promise<Order> {
    return this.executeInTransaction(async () => {
      // Get repositories from Unit of Work
      const orderRepo = this.getRepository<IOrderRepository>('orderRepository');
      const customerRepo =
        this.getRepository<ICustomerRepository>('customerRepository');

      // Load customer
      const customer = await customerRepo.findById(customerId);
      if (!customer) {
        throw new Error('Customer not found');
      }

      // Create order
      const order = Order.create({
        customerId: customer.id,
        items,
        createdAt: new Date(),
      });

      // Update customer order history
      customer.addOrder(order.id);

      // Save changes
      await orderRepo.save(order);
      await customerRepo.save(customer);

      return order;
    });
  }

  async cancelOrder(orderId: string): Promise<void> {
    return this.executeInTransaction(async () => {
      const orderRepo = this.getRepository<IOrderRepository>('orderRepository');

      const order = await orderRepo.findById(orderId);
      if (!order) {
        throw new Error('Order not found');
      }

      order.cancel();
      await orderRepo.save(order);
    });
  }
}
```

## 📚 Base Domain Services

### IBaseDomainService

The foundation for all domain services:

```typescript
import { IBaseDomainService } from '@vytches-ddd/domain-services';

class ProductCatalogService extends IBaseDomainService {
  constructor() {
    super('productCatalogService');
  }

  findProductsByCategory(category: string): Product[] {
    // Implementation
    return [];
  }

  searchProducts(query: string): Product[] {
    // Implementation
    return [];
  }

  getProductRecommendations(userId: string): Product[] {
    // Implementation
    return [];
  }
}
```

### EventAwareDomainService

For services that need to publish domain events:

```typescript
import { EventAwareDomainService } from '@vytches-ddd/domain-services';

class NotificationService extends EventAwareDomainService {
  constructor() {
    super('notificationService');
  }

  async sendWelcomeNotification(user: User): Promise<void> {
    // Send notification logic
    await this.deliverNotification(user, 'welcome');

    // Publish event
    this.publishEvent(
      new NotificationSentEvent({
        userId: user.id,
        type: 'welcome',
        sentAt: new Date(),
      })
    );
  }

  private async deliverNotification(user: User, type: string): Promise<void> {
    // Delivery implementation
  }
}
```

### UnitOfWorkAwareDomainService

For services requiring transactional consistency:

```typescript
import { UnitOfWorkAwareDomainService } from '@vytches-ddd/domain-services';

class TransferService extends UnitOfWorkAwareDomainService {
  constructor() {
    super('transferService');
  }

  async transferFunds(
    fromAccountId: string,
    toAccountId: string,
    amount: Money
  ): Promise<void> {
    return this.executeInTransaction(async () => {
      const accountRepo =
        this.getRepository<IAccountRepository>('accountRepository');

      const fromAccount = await accountRepo.findById(fromAccountId);
      const toAccount = await accountRepo.findById(toAccountId);

      if (!fromAccount || !toAccount) {
        throw new Error('Account not found');
      }

      // Perform transfer
      fromAccount.debit(amount);
      toAccount.credit(amount);

      // Save changes
      await accountRepo.save(fromAccount);
      await accountRepo.save(toAccount);

      // Publish transfer event
      this.publishEvent(
        new FundsTransferredEvent({
          fromAccountId,
          toAccountId,
          amount,
          transferredAt: new Date(),
        })
      );
    });
  }
}
```

### AsyncDomainService

For services with async lifecycle:

```typescript
import { AsyncDomainService } from '@vytches-ddd/domain-services';

class CacheService extends AsyncDomainService {
  private cache: Map<string, any> = new Map();
  private cleanupInterval?: NodeJS.Timeout;

  constructor() {
    super('cacheService');
  }

  async initialize(): Promise<void> {
    // Initialize cache
    await this.loadInitialData();

    // Start cleanup routine
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEntries();
    }, 60000);
  }

  async dispose(): Promise<void> {
    // Clear cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Clear cache
    this.cache.clear();
  }

  private async loadInitialData(): Promise<void> {
    // Load initial cache data
  }

  private cleanupExpiredEntries(): void {
    // Clean up expired entries
  }
}
```

## 🎨 Service Decorators

### Basic Decorator Usage

```typescript
import { DomainService } from '@vytches-ddd/domain-services';

// Simple service ID
@DomainService('userService')
class UserService extends IBaseDomainService {
  // Implementation
}

// Full configuration
@DomainService({
  serviceId: 'orderService',
  dependencies: ['productRepository', 'userRepository'],
  transactional: true,
  publishesEvents: true,
  async: true,
  caching: {
    enabled: true,
    ttl: 300, // 5 minutes
  },
})
class OrderService extends UnitOfWorkAwareDomainService {
  // Implementation
}
```

### DI Integration

```typescript
import { DomainService, ServiceLifetime } from '@vytches-ddd/domain-services';

@DomainService({
  serviceId: 'paymentService',
  lifetime: ServiceLifetime.Singleton,
  context: 'PaymentProcessing',
  autoRegister: true,
  dependencies: ['paymentGateway', 'auditLogger'],
  tags: ['payment', 'financial'],
  transactional: true,
})
class PaymentService extends UnitOfWorkAwareDomainService {
  async processPayment(payment: Payment): Promise<PaymentResult> {
    // Implementation
    return { success: true, transactionId: 'tx-123' };
  }
}
```

### Metadata Retrieval

```typescript
import {
  getDomainServiceMetadata,
  getDIDomainServiceMetadata,
} from '@vytches-ddd/domain-services';

const metadata = getDomainServiceMetadata(OrderService);
console.log(metadata?.serviceId); // 'orderService'
console.log(metadata?.transactional); // true

const diMetadata = getDIDomainServiceMetadata(PaymentService);
console.log(diMetadata?.lifetime); // 'singleton'
console.log(diMetadata?.context); // 'PaymentProcessing'
```

## 🔄 Transactional Services

### Transaction Management

```typescript
class OrderFulfillmentService extends UnitOfWorkAwareDomainService {
  constructor() {
    super('orderFulfillmentService');
  }

  async fulfillOrder(orderId: string): Promise<void> {
    return this.executeInTransaction(async () => {
      const orderRepo = this.getRepository<IOrderRepository>('orderRepository');
      const inventoryRepo = this.getRepository<IInventoryRepository>(
        'inventoryRepository'
      );

      // Load order
      const order = await orderRepo.findById(orderId);
      if (!order) {
        throw new Error('Order not found');
      }

      // Check and reserve inventory
      for (const item of order.items) {
        const inventory = await inventoryRepo.findByProductId(item.productId);
        if (!inventory || inventory.quantity < item.quantity) {
          throw new Error(
            `Insufficient inventory for product ${item.productId}`
          );
        }

        inventory.reserve(item.quantity);
        await inventoryRepo.save(inventory);
      }

      // Update order status
      order.markAsFulfilled();
      await orderRepo.save(order);

      // Publish event
      this.publishEvent(
        new OrderFulfilledEvent({
          orderId: order.id,
          fulfilledAt: new Date(),
        })
      );
    });
  }
}
```

### Multiple Repository Access

```typescript
class CustomerOrderService extends UnitOfWorkAwareDomainService {
  constructor() {
    super('customerOrderService');
  }

  async getCustomerOrderHistory(
    customerId: string
  ): Promise<CustomerOrderHistory> {
    return this.executeInTransaction(async () => {
      const customerRepo =
        this.getRepository<ICustomerRepository>('customerRepository');
      const orderRepo = this.getRepository<IOrderRepository>('orderRepository');

      const customer = await customerRepo.findById(customerId);
      if (!customer) {
        throw new Error('Customer not found');
      }

      const orders = await orderRepo.findByCustomerId(customerId);

      return new CustomerOrderHistory({
        customer,
        orders: orders.sort(
          (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
        ),
        totalOrders: orders.length,
        totalSpent: orders.reduce(
          (sum, order) => sum.add(order.total),
          Money.zero()
        ),
      });
    });
  }
}
```

## 📢 Event-Aware Services

### Event Publishing

```typescript
class InventoryService extends EventAwareDomainService {
  constructor() {
    super('inventoryService');
  }

  async updateInventory(productId: string, quantity: number): Promise<void> {
    // Update inventory logic
    const inventory = await this.getInventory(productId);
    const previousQuantity = inventory.quantity;

    inventory.updateQuantity(quantity);
    await this.saveInventory(inventory);

    // Publish inventory updated event
    this.publishEvent(
      new InventoryUpdatedEvent({
        productId,
        previousQuantity,
        newQuantity: quantity,
        updatedAt: new Date(),
      })
    );

    // Publish low stock alert if needed
    if (inventory.isLowStock()) {
      this.publishEvent(
        new LowStockAlertEvent({
          productId,
          currentQuantity: quantity,
          threshold: inventory.lowStockThreshold,
          alertedAt: new Date(),
        })
      );
    }
  }

  private async getInventory(productId: string): Promise<Inventory> {
    // Implementation
    return new Inventory(productId, 100);
  }

  private async saveInventory(inventory: Inventory): Promise<void> {
    // Implementation
  }
}
```

### Event Coordination

```typescript
class OrderProcessingService extends EventAwareDomainService {
  constructor() {
    super('orderProcessingService');
  }

  async processNewOrder(order: Order): Promise<void> {
    // Process order through multiple stages
    await this.validateOrder(order);
    this.publishEvent(new OrderValidatedEvent({ orderId: order.id }));

    await this.reserveInventory(order);
    this.publishEvent(new InventoryReservedEvent({ orderId: order.id }));

    await this.processPayment(order);
    this.publishEvent(new PaymentProcessedEvent({ orderId: order.id }));

    order.markAsProcessed();
    this.publishEvent(
      new OrderProcessedEvent({
        orderId: order.id,
        processedAt: new Date(),
      })
    );
  }

  private async validateOrder(order: Order): Promise<void> {
    // Validation logic
  }

  private async reserveInventory(order: Order): Promise<void> {
    // Inventory reservation logic
  }

  private async processPayment(order: Order): Promise<void> {
    // Payment processing logic
  }
}
```

## 🏗️ Dependency Injection

### Service Registration

```typescript
import { VytchesDDD, SimpleContainer } from '@vytches-ddd/di';

// Setup container
const container = new SimpleContainer();

// Auto-discover and register services
VytchesDDD.configure(container);

// Manual registration if needed
container.register('customService', CustomService);
```

### Service Resolution

```typescript
import { VytchesDDD } from '@vytches-ddd/di';

// Resolve service
const orderService = VytchesDDD.resolve<OrderService>('orderService');

// Context-aware resolution
const paymentService = VytchesDDD.resolve<PaymentService>(
  'paymentService',
  'PaymentProcessing'
);

// Use service
await orderService.processOrder(order);
```

### Context Isolation

```typescript
// Setup context-specific services
const orderContainer = new SimpleContainer();
const paymentContainer = new SimpleContainer();

VytchesDDD.configureContext('OrderManagement', orderContainer);
VytchesDDD.configureContext('PaymentProcessing', paymentContainer);

// Context-aware service resolution
const orderService = VytchesDDD.resolve<OrderService>(
  'orderService',
  'OrderManagement'
);
```

## 🔄 Service Lifecycle

### Async Service Initialization

```typescript
class DatabaseService extends AsyncDomainService {
  private connection?: DatabaseConnection;

  constructor() {
    super('databaseService');
  }

  async initialize(): Promise<void> {
    // Connect to database
    this.connection = await createConnection({
      host: 'localhost',
      port: 5432,
      database: 'myapp',
    });

    // Run migrations
    await this.runMigrations();
  }

  async dispose(): Promise<void> {
    // Close database connection
    if (this.connection) {
      await this.connection.close();
    }
  }

  private async runMigrations(): Promise<void> {
    // Migration logic
  }
}
```

### Service Lifecycle Management

```typescript
class ServiceManager {
  private services: AsyncDomainService[] = [];

  async initializeServices(): Promise<void> {
    // Initialize all async services
    await Promise.all(this.services.map(service => service.initialize()));
  }

  async shutdownServices(): Promise<void> {
    // Dispose all async services
    await Promise.all(this.services.map(service => service.dispose()));
  }

  registerService(service: AsyncDomainService): void {
    this.services.push(service);
  }
}
```

## ⚠️ Error Handling

### Service Errors

```typescript
import {
  ServiceNotFoundError,
  ServiceDuplicateError,
  ServiceCircularError,
} from '@vytches-ddd/domain-services';

class ServiceRegistry {
  private services = new Map<string, IDomainService>();

  register(service: IDomainService): void {
    if (this.services.has(service.serviceId)) {
      throw new ServiceDuplicateError(service.serviceId);
    }
    this.services.set(service.serviceId, service);
  }

  resolve(serviceId: string): IDomainService {
    const service = this.services.get(serviceId);
    if (!service) {
      throw new ServiceNotFoundError(serviceId);
    }
    return service;
  }
}
```

### Error Handling in Services

```typescript
class OrderService extends UnitOfWorkAwareDomainService {
  constructor() {
    super('orderService');
  }

  async processOrder(order: Order): Promise<void> {
    try {
      return await this.executeInTransaction(async () => {
        // Business logic
        await this.performOrderProcessing(order);
      });
    } catch (error) {
      // Log error
      console.error('Order processing failed:', error);

      // Publish error event
      this.publishEvent(
        new OrderProcessingFailedEvent({
          orderId: order.id,
          error: error.message,
          failedAt: new Date(),
        })
      );

      throw error;
    }
  }

  private async performOrderProcessing(order: Order): Promise<void> {
    // Implementation
  }
}
```

## 🧪 Testing

### Unit Testing Services

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { safeRun } from '@vytches-ddd/utils';
import { OrderCalculationService } from '../order-calculation.service';

describe('OrderCalculationService', () => {
  let service: OrderCalculationService;

  beforeEach(() => {
    service = new OrderCalculationService();
  });

  describe('calculateTotal', () => {
    it('should calculate total for multiple items', () => {
      const items = [
        { price: Money.fromAmount(10), quantity: 2 },
        { price: Money.fromAmount(5), quantity: 3 },
      ];

      const [error, total] = safeRun(() => service.calculateTotal(items));

      expect(error).toBeUndefined();
      expect(total?.amount).toBe(35); // (10 * 2) + (5 * 3)
    });

    it('should handle empty items', () => {
      const [error, total] = safeRun(() => service.calculateTotal([]));

      expect(error).toBeUndefined();
      expect(total?.amount).toBe(0);
    });
  });

  describe('calculateTax', () => {
    it('should calculate tax correctly', () => {
      const subtotal = Money.fromAmount(100);
      const taxRate = 0.08;

      const [error, tax] = safeRun(() =>
        service.calculateTax(subtotal, taxRate)
      );

      expect(error).toBeUndefined();
      expect(tax?.amount).toBe(8);
    });
  });
});
```

### Testing Transactional Services

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { safeRun } from '@vytches-ddd/utils';
import { TransferService } from '../transfer.service';
import { MockUnitOfWork } from '@vytches-ddd/testing';

describe('TransferService', () => {
  let service: TransferService;
  let mockUnitOfWork: MockUnitOfWork;

  beforeEach(() => {
    service = new TransferService();
    mockUnitOfWork = new MockUnitOfWork();
    service.setUnitOfWork(mockUnitOfWork);
  });

  describe('transferFunds', () => {
    it('should transfer funds successfully', async () => {
      const fromAccount = Account.create({
        id: 'acc1',
        balance: Money.fromAmount(100),
      });
      const toAccount = Account.create({
        id: 'acc2',
        balance: Money.fromAmount(50),
      });
      const amount = Money.fromAmount(30);

      const accountRepo =
        mockUnitOfWork.getMockRepository<IAccountRepository>(
          'accountRepository'
        );
      accountRepo.findById.mockResolvedValueOnce(fromAccount);
      accountRepo.findById.mockResolvedValueOnce(toAccount);

      const [error] = await safeRun(() =>
        service.transferFunds('acc1', 'acc2', amount)
      );

      expect(error).toBeUndefined();
      expect(mockUnitOfWork.commitCalled).toBe(true);
      expect(fromAccount.balance.amount).toBe(70);
      expect(toAccount.balance.amount).toBe(80);
    });

    it('should rollback on error', async () => {
      const accountRepo =
        mockUnitOfWork.getMockRepository<IAccountRepository>(
          'accountRepository'
        );
      accountRepo.findById.mockResolvedValueOnce(null); // Account not found

      const [error] = await safeRun(() =>
        service.transferFunds('acc1', 'acc2', Money.fromAmount(30))
      );

      expect(error).toBeInstanceOf(Error);
      expect(mockUnitOfWork.rollbackCalled).toBe(true);
    });
  });
});
```

### Testing Event-Aware Services

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { safeRun } from '@vytches-ddd/utils';
import { NotificationService } from '../notification.service';
import { MockEventBus } from '@vytches-ddd/testing';

describe('NotificationService', () => {
  let service: NotificationService;
  let mockEventBus: MockEventBus;

  beforeEach(() => {
    service = new NotificationService();
    mockEventBus = new MockEventBus();
    service.setEventBus(mockEventBus);
  });

  describe('sendWelcomeNotification', () => {
    it('should send notification and publish event', async () => {
      const user = User.create({ id: 'user1', email: 'test@example.com' });

      const [error] = await safeRun(() =>
        service.sendWelcomeNotification(user)
      );

      expect(error).toBeUndefined();
      expect(mockEventBus.publishedEvents).toHaveLength(1);
      expect(mockEventBus.publishedEvents[0]).toBeInstanceOf(
        NotificationSentEvent
      );
    });
  });
});
```

## ✅ Best Practices

### Service Design

1. **Keep Services Stateless**: Domain services should be stateless and focus on
   behavior
2. **Single Responsibility**: Each service should have one clear responsibility
3. **Avoid Anemic Services**: Services should contain meaningful business logic
4. **Use Composition**: Compose complex operations from simpler service methods

```typescript
// ✅ Good: Focused, stateless service
@DomainService('pricingService')
class PricingService extends IBaseDomainService {
  calculateDiscount(customer: Customer, order: Order): Money {
    if (customer.isVIP()) {
      return order.total.multiply(0.1);
    }
    return Money.zero();
  }
}

// ❌ Bad: Stateful service with multiple responsibilities
class OrderService extends IBaseDomainService {
  private currentOrder?: Order; // Stateful!

  processOrder(order: Order): void {
    /* ... */
  }
  sendEmail(email: string): void {
    /* ... */
  } // Wrong responsibility
  calculateTax(amount: Money): Money {
    /* ... */
  }
}
```

### Transaction Management

1. **Use Transactions for Consistency**: Wrap multi-aggregate operations in
   transactions
2. **Keep Transactions Short**: Minimize transaction scope and duration
3. **Handle Rollbacks**: Properly handle transaction failures
4. **Event Publishing**: Publish events within transaction boundaries

```typescript
// ✅ Good: Proper transaction usage
class OrderService extends UnitOfWorkAwareDomainService {
  async processOrder(order: Order): Promise<void> {
    return this.executeInTransaction(async () => {
      // Short, focused transaction
      await this.validateOrder(order);
      await this.reserveInventory(order);
      await this.updateOrder(order);

      // Events published within transaction
      this.publishEvent(new OrderProcessedEvent({ orderId: order.id }));
    });
  }
}
```

### Error Handling

1. **Use Specific Errors**: Create domain-specific error types
2. **Fail Fast**: Validate inputs early in service methods
3. **Log Errors**: Provide meaningful error logging
4. **Publish Error Events**: Notify system of important failures

```typescript
// ✅ Good: Comprehensive error handling
class PaymentService extends EventAwareDomainService {
  async processPayment(payment: Payment): Promise<void> {
    try {
      // Validate early
      if (!payment.isValid()) {
        throw new InvalidPaymentError(payment.id);
      }

      await this.chargePayment(payment);

      this.publishEvent(new PaymentProcessedEvent({ paymentId: payment.id }));
    } catch (error) {
      // Log error
      console.error('Payment processing failed:', error);

      // Publish error event
      this.publishEvent(
        new PaymentFailedEvent({
          paymentId: payment.id,
          error: error.message,
        })
      );

      throw error;
    }
  }
}
```

### Service Registration

1. **Use Decorators**: Leverage `@DomainService` decorator for metadata
2. **Specify Dependencies**: Clearly declare service dependencies
3. **Choose Appropriate Lifetime**: Select the right service lifetime
4. **Context Isolation**: Use contexts for bounded context separation

```typescript
// ✅ Good: Well-configured service
@DomainService({
  serviceId: 'orderService',
  lifetime: ServiceLifetime.Transient,
  context: 'OrderManagement',
  dependencies: ['orderRepository', 'inventoryService'],
  transactional: true,
  publishesEvents: true,
})
class OrderService extends UnitOfWorkAwareDomainService {
  // Implementation
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

_Part of the [@vytches-ddd](https://github.com/vytches/vytches-ddd) ecosystem -
A comprehensive Domain-Driven Design framework for TypeScript_
