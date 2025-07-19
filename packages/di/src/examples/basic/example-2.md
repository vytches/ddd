# Service Lifetimes - Beginner Example

**Version**: 1.0.0  
**Package**: @vytches-ddd/di  
**Complexity**: beginner  
**Domain**: Order Management  
**Patterns**: Service Lifetimes, Lifecycle Management  
**Dependencies**: @vytches-ddd/di  

## Description

This example demonstrates the different service lifetimes available in VytchesDDD's DI system: Transient, Singleton, and Scoped. Understanding service lifetimes is crucial for proper resource management and application performance.

## Business Context

In enterprise applications, different services have different lifecycle requirements. Database connections might need to be singletons, while processing services might need to be transient. Proper lifetime management ensures optimal resource usage and prevents memory leaks.

## Code Example

```typescript
// order.service.ts
import { DomainService, ServiceLifetime } from '@vytches-ddd/di';
import { Order, CreateOrderData } from '../types'; // Import from application

/**
 * Order service with Singleton lifetime
 * Single instance shared across the application
 */
@DomainService({
  serviceId: 'orderService',
  lifetime: ServiceLifetime.Singleton
})
export class OrderService {
  private orders: Map<string, Order> = new Map();
  
  /**
   * Creates a new order
   */
  async createOrder(orderData: CreateOrderData): Promise<Order> {
    // ⭐ FOCUS: Business logic with singleton state
    const order: Order = {
      id: this.generateOrderId(),
      userId: orderData.userId,
      items: orderData.items.map(item => ({
        ...item,
        id: this.generateItemId()
      })),
      total: this.calculateTotal(orderData.items),
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Store in singleton state
    this.orders.set(order.id, order);
    
    console.log(`OrderService instance: ${this.getInstanceId()}`);
    console.log(`Total orders managed: ${this.orders.size}`);
    
    return order;
  }
  
  /**
   * Gets order by ID
   */
  async getOrderById(id: string): Promise<Order | null> {
    return this.orders.get(id) || null;
  }
  
  private generateOrderId(): string {
    return `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private generateItemId(): string {
    return `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private calculateTotal(items: Array<{ quantity: number; price: number }>): number {
    return items.reduce((total, item) => total + (item.quantity * item.price), 0);
  }
  
  private getInstanceId(): string {
    return `${this.constructor.name}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

```typescript
// order-processor.service.ts
import { DomainService, ServiceLifetime } from '@vytches-ddd/di';
import { Order, Payment } from '../types'; // Import from application

/**
 * Order processor with Transient lifetime
 * New instance created for each resolution
 */
@DomainService({
  serviceId: 'orderProcessor',
  lifetime: ServiceLifetime.Transient
})
export class OrderProcessorService {
  private readonly processingId: string;
  
  constructor() {
    this.processingId = this.generateProcessingId();
  }
  
  /**
   * Processes an order
   */
  async processOrder(order: Order): Promise<void> {
    // ⭐ FOCUS: Each instance has unique processing context
    console.log(`Processing order ${order.id} with processor ${this.processingId}`);
    
    // Simulate processing steps
    await this.validateOrder(order);
    await this.reserveInventory(order);
    await this.processPayment(order);
    
    console.log(`Order ${order.id} processed successfully by ${this.processingId}`);
  }
  
  private async validateOrder(order: Order): Promise<void> {
    console.log(`Validating order ${order.id} with processor ${this.processingId}`);
    // Validation logic
  }
  
  private async reserveInventory(order: Order): Promise<void> {
    console.log(`Reserving inventory for order ${order.id} with processor ${this.processingId}`);
    // Inventory reservation logic
  }
  
  private async processPayment(order: Order): Promise<void> {
    console.log(`Processing payment for order ${order.id} with processor ${this.processingId}`);
    // Payment processing logic
  }
  
  private generateProcessingId(): string {
    return `processor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

```typescript
// database.service.ts
import { DomainService, ServiceLifetime } from '@vytches-ddd/di';
import { DatabaseConnection } from '../types'; // Import from application

/**
 * Database service with Scoped lifetime
 * Single instance per scope/context
 */
@DomainService({
  serviceId: 'databaseService',
  lifetime: ServiceLifetime.Scoped
})
export class DatabaseService {
  private connection: DatabaseConnection | null = null;
  private readonly instanceId: string;
  
  constructor() {
    this.instanceId = this.generateInstanceId();
  }
  
  /**
   * Gets database connection
   */
  async getConnection(): Promise<DatabaseConnection> {
    if (!this.connection) {
      // ⭐ FOCUS: Connection created once per scope
      this.connection = await this.createConnection();
      console.log(`Database connection created for instance: ${this.instanceId}`);
    }
    
    return this.connection;
  }
  
  /**
   * Executes a query
   */
  async executeQuery(query: string): Promise<any[]> {
    const connection = await this.getConnection();
    console.log(`Executing query with instance: ${this.instanceId}`);
    
    // Simulate query execution
    return [];
  }
  
  private async createConnection(): Promise<DatabaseConnection> {
    return {
      host: 'localhost',
      port: 5432,
      database: 'orders_db',
      username: 'app_user',
      password: 'secret'
    };
  }
  
  private generateInstanceId(): string {
    return `db_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

```typescript
// app.ts
import { VytchesDDD, SimpleContainer } from '@vytches-ddd/di';
import { OrderService } from './order.service';
import { OrderProcessorService } from './order-processor.service';
import { DatabaseService } from './database.service';
import { CreateOrderData } from '../types'; // Import from application

/**
 * Application demonstrating different service lifetimes
 */
async function demonstrateLifetimes(): Promise<void> {
  // ⭐ FOCUS: Configure DI container
  const container = new SimpleContainer();
  await VytchesDDD.configure(container);
  
  console.log('=== Demonstrating Service Lifetimes ===\n');
  
  // ⭐ FOCUS: Singleton demonstration
  console.log('1. SINGLETON LIFETIME:');
  const orderService1 = VytchesDDD.resolve<OrderService>('orderService');
  const orderService2 = VytchesDDD.resolve<OrderService>('orderService');
  
  console.log('Same instance?', orderService1 === orderService2); // true
  
  const orderData: CreateOrderData = {
    userId: 'user123',
    items: [
      { productId: 'prod1', quantity: 2, price: 25.99 },
      { productId: 'prod2', quantity: 1, price: 15.50 }
    ]
  };
  
  await orderService1.createOrder(orderData);
  await orderService2.createOrder(orderData);
  
  console.log('\n2. TRANSIENT LIFETIME:');
  const processor1 = VytchesDDD.resolve<OrderProcessorService>('orderProcessor');
  const processor2 = VytchesDDD.resolve<OrderProcessorService>('orderProcessor');
  
  console.log('Same instance?', processor1 === processor2); // false
  
  console.log('\n3. SCOPED LIFETIME:');
  const db1 = VytchesDDD.resolve<DatabaseService>('databaseService');
  const db2 = VytchesDDD.resolve<DatabaseService>('databaseService');
  
  console.log('Same instance in scope?', db1 === db2); // true (within same scope)
  
  await db1.executeQuery('SELECT * FROM orders');
  await db2.executeQuery('SELECT * FROM users');
}

// Run the demonstration
demonstrateLifetimes().catch(console.error);
```

## Key Features

- **ServiceLifetime.Singleton**: Single instance shared across the application
- **ServiceLifetime.Transient**: New instance created for each resolution
- **ServiceLifetime.Scoped**: Single instance per scope/context
- **Automatic Management**: DI container handles instance creation and disposal
- **Performance Optimization**: Choose appropriate lifetime for optimal resource usage

## Common Pitfalls

- **Singleton State**: Be careful with mutable state in singleton services
- **Transient Performance**: Don't use transient for expensive-to-create services
- **Scoped Confusion**: Understand your application's scope boundaries
- **Memory Leaks**: Ensure proper cleanup in singleton services
- **Thread Safety**: Consider thread safety for shared singleton instances

## Related Examples

- [Basic Service Registration](./example-1.md) - Simple service registration
- [VytchesDDD Global Service Locator](./example-3.md) - Advanced service locator usage
- [Context Isolation](../intermediate/example-2.md) - Bounded context support