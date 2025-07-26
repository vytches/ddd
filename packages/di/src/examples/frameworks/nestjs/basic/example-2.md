# NestJS Module Configuration - Beginner Example

**Version**: 1.0.0  
**Package**: @vytches/ddd-di  
**Complexity**: beginner  
**Domain**: Multi-Module Application  
**Patterns**: Module Configuration, Shared Services, Module Initialization  
**Dependencies**: @vytches/ddd-di, @nestjs/common

## Description

This example demonstrates how to properly configure NestJS modules with
VytchesDDD services, including shared services across modules, proper
initialization order, and module-specific configurations.

## Business Context

In larger NestJS applications, you need to organize functionality into multiple
modules while sharing domain services across them. This example shows how to
properly configure VytchesDDD services in a multi-module NestJS application.

## Code Example

```typescript
// shared/shared-domain.service.ts
import { DomainService } from '@vytches/ddd-di';
import { AuditLogEntry } from '../types'; // Import from application

/**
 * Shared domain service used across modules
 */
@DomainService('sharedDomainService')
export class SharedDomainService {
  private auditLog: AuditLogEntry[] = [];

  /**
   * Logs an audit entry
   */
  async logAuditEntry(
    entry: Omit<AuditLogEntry, 'id' | 'timestamp'>
  ): Promise<void> {
    // ⭐ FOCUS: Shared domain functionality
    const auditEntry: AuditLogEntry = {
      ...entry,
      id: this.generateAuditId(),
      timestamp: new Date(),
    };

    this.auditLog.push(auditEntry);

    console.log(`SharedDomainService: Logged audit entry ${auditEntry.id}`);
  }

  /**
   * Gets audit log entries
   */
  async getAuditLog(): Promise<AuditLogEntry[]> {
    return [...this.auditLog];
  }

  private generateAuditId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

```typescript
// users/user-domain.service.ts
import { DomainService } from '@vytches/ddd-di';
import { User, CreateUserData, UpdateUserData } from '../types'; // Import from application

/**
 * User domain service
 */
@DomainService('userDomainService')
export class UserDomainService {
  private users: Map<string, User> = new Map();

  /**
   * Creates a new user
   */
  async createUser(userData: CreateUserData): Promise<User> {
    // ⭐ FOCUS: User-specific domain logic
    const user: User = {
      id: this.generateUserId(),
      email: userData.email,
      name: userData.name,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.users.set(user.id, user);

    console.log(`UserDomainService: Created user ${user.id}`);
    return user;
  }

  /**
   * Gets user by ID
   */
  async getUserById(userId: string): Promise<User | null> {
    return this.users.get(userId) || null;
  }

  /**
   * Gets all users
   */
  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  private generateUserId(): string {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

```typescript
// orders/order-domain.service.ts
import { DomainService } from '@vytches/ddd-di';
import { Order, CreateOrderData } from '../types'; // Import from application

/**
 * Order domain service
 */
@DomainService('orderDomainService')
export class OrderDomainService {
  private orders: Map<string, Order> = new Map();

  /**
   * Creates a new order
   */
  async createOrder(orderData: CreateOrderData): Promise<Order> {
    // ⭐ FOCUS: Order-specific domain logic
    const order: Order = {
      id: this.generateOrderId(),
      userId: orderData.userId,
      items: orderData.items.map(item => ({
        ...item,
        id: this.generateItemId(),
      })),
      total: this.calculateTotal(orderData.items),
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.orders.set(order.id, order);

    console.log(`OrderDomainService: Created order ${order.id}`);
    return order;
  }

  /**
   * Gets order by ID
   */
  async getOrderById(orderId: string): Promise<Order | null> {
    return this.orders.get(orderId) || null;
  }

  /**
   * Gets orders by user ID
   */
  async getOrdersByUserId(userId: string): Promise<Order[]> {
    return Array.from(this.orders.values()).filter(
      order => order.userId === userId
    );
  }

  private generateOrderId(): string {
    return `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateItemId(): string {
    return `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculateTotal(
    items: Array<{ quantity: number; price: number }>
  ): number {
    return items.reduce((total, item) => total + item.quantity * item.price, 0);
  }
}
```

```typescript
// shared/shared.module.ts
import { Module, OnModuleInit, Global } from '@nestjs/common';
import { VytchesDDD, SimpleContainer } from '@vytches/ddd-di';
import { SharedService } from './shared.service';

/**
 * Global shared module for common services
 */
@Global()
@Module({
  providers: [SharedService],
  exports: [SharedService],
})
export class SharedModule implements OnModuleInit {
  /**
   * Initialize VytchesDDD once for the entire application
   */
  async onModuleInit() {
    // ⭐ FOCUS: Initialize VytchesDDD once in shared module
    console.log('SharedModule: Initializing VytchesDDD...');

    const container = new SimpleContainer();
    await VytchesDDD.configure(container);

    console.log('SharedModule: VytchesDDD initialized');
  }
}
```

```typescript
// shared/shared.service.ts
import { Injectable } from '@nestjs/common';
import { VytchesDDD } from '@vytches/ddd-di';
import { SharedDomainService } from './shared-domain.service';
import { AuditLogEntry } from '../types'; // Import from application

/**
 * NestJS shared service
 */
@Injectable()
export class SharedService {
  private readonly sharedDomainService: SharedDomainService;

  constructor() {
    // ⭐ FOCUS: Access shared domain service
    this.sharedDomainService = VytchesDDD.resolve<SharedDomainService>(
      'sharedDomainService'
    );
  }

  /**
   * Logs an audit entry
   */
  async logAuditEntry(
    entry: Omit<AuditLogEntry, 'id' | 'timestamp'>
  ): Promise<void> {
    return await this.sharedDomainService.logAuditEntry(entry);
  }

  /**
   * Gets audit log
   */
  async getAuditLog(): Promise<AuditLogEntry[]> {
    return await this.sharedDomainService.getAuditLog();
  }
}
```

```typescript
// users/user.service.ts
import { Injectable } from '@nestjs/common';
import { VytchesDDD } from '@vytches/ddd-di';
import { UserDomainService } from './user-domain.service';
import { SharedService } from '../shared/shared.service';
import { User, CreateUserData, UpdateUserData } from '../types'; // Import from application

/**
 * NestJS user service
 */
@Injectable()
export class UserService {
  private readonly userDomainService: UserDomainService;

  constructor(private readonly sharedService: SharedService) {
    // ⭐ FOCUS: Use both domain service and shared service
    this.userDomainService =
      VytchesDDD.resolve<UserDomainService>('userDomainService');
  }

  /**
   * Creates a user with audit logging
   */
  async createUser(userData: CreateUserData): Promise<User> {
    try {
      const user = await this.userDomainService.createUser(userData);

      // Log audit entry using shared service
      await this.sharedService.logAuditEntry({
        userId: user.id,
        action: 'CREATE_USER',
        resource: 'User',
        resourceId: user.id,
      });

      return user;
    } catch (error) {
      console.error('UserService: Failed to create user:', error);
      throw error;
    }
  }

  /**
   * Gets user by ID
   */
  async getUserById(userId: string): Promise<User | null> {
    try {
      return await this.userDomainService.getUserById(userId);
    } catch (error) {
      console.error('UserService: Failed to get user:', error);
      throw error;
    }
  }

  /**
   * Gets all users
   */
  async getAllUsers(): Promise<User[]> {
    try {
      return await this.userDomainService.getAllUsers();
    } catch (error) {
      console.error('UserService: Failed to get users:', error);
      throw error;
    }
  }
}
```

```typescript
// users/user.controller.ts
import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserData } from '../types'; // Import from application

/**
 * User controller
 */
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * Creates a new user
   */
  @Post()
  async createUser(@Body() userData: CreateUserData) {
    return await this.userService.createUser(userData);
  }

  /**
   * Gets user by ID
   */
  @Get(':id')
  async getUserById(@Param('id') userId: string) {
    return await this.userService.getUserById(userId);
  }

  /**
   * Gets all users
   */
  @Get()
  async getAllUsers() {
    return await this.userService.getAllUsers();
  }
}
```

```typescript
// users/user.module.ts
import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';

/**
 * User module - no OnModuleInit needed (SharedModule handles it)
 */
@Module({
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {
  // ⭐ FOCUS: No OnModuleInit needed - SharedModule handles VytchesDDD initialization
}
```

```typescript
// orders/order.service.ts
import { Injectable } from '@nestjs/common';
import { VytchesDDD } from '@vytches/ddd-di';
import { OrderDomainService } from './order-domain.service';
import { SharedService } from '../shared/shared.service';
import { Order, CreateOrderData } from '../types'; // Import from application

/**
 * NestJS order service
 */
@Injectable()
export class OrderService {
  private readonly orderDomainService: OrderDomainService;

  constructor(private readonly sharedService: SharedService) {
    // ⭐ FOCUS: Use both domain service and shared service
    this.orderDomainService =
      VytchesDDD.resolve<OrderDomainService>('orderDomainService');
  }

  /**
   * Creates an order with audit logging
   */
  async createOrder(orderData: CreateOrderData): Promise<Order> {
    try {
      const order = await this.orderDomainService.createOrder(orderData);

      // Log audit entry using shared service
      await this.sharedService.logAuditEntry({
        userId: order.userId,
        action: 'CREATE_ORDER',
        resource: 'Order',
        resourceId: order.id,
      });

      return order;
    } catch (error) {
      console.error('OrderService: Failed to create order:', error);
      throw error;
    }
  }

  /**
   * Gets order by ID
   */
  async getOrderById(orderId: string): Promise<Order | null> {
    try {
      return await this.orderDomainService.getOrderById(orderId);
    } catch (error) {
      console.error('OrderService: Failed to get order:', error);
      throw error;
    }
  }

  /**
   * Gets orders by user ID
   */
  async getOrdersByUserId(userId: string): Promise<Order[]> {
    try {
      return await this.orderDomainService.getOrdersByUserId(userId);
    } catch (error) {
      console.error('OrderService: Failed to get orders:', error);
      throw error;
    }
  }
}
```

```typescript
// orders/order.controller.ts
import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderData } from '../types'; // Import from application

/**
 * Order controller
 */
@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  /**
   * Creates a new order
   */
  @Post()
  async createOrder(@Body() orderData: CreateOrderData) {
    return await this.orderService.createOrder(orderData);
  }

  /**
   * Gets order by ID
   */
  @Get(':id')
  async getOrderById(@Param('id') orderId: string) {
    return await this.orderService.getOrderById(orderId);
  }

  /**
   * Gets orders by user ID
   */
  @Get('user/:userId')
  async getOrdersByUserId(@Param('userId') userId: string) {
    return await this.orderService.getOrdersByUserId(userId);
  }
}
```

```typescript
// orders/order.module.ts
import { Module } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';

/**
 * Order module - no OnModuleInit needed (SharedModule handles it)
 */
@Module({
  controllers: [OrderController],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {
  // ⭐ FOCUS: No OnModuleInit needed - SharedModule handles VytchesDDD initialization
}
```

```typescript
// audit/audit.controller.ts
import { Controller, Get } from '@nestjs/common';
import { SharedService } from '../shared/shared.service';

/**
 * Audit controller using shared service
 */
@Controller('audit')
export class AuditController {
  constructor(private readonly sharedService: SharedService) {}

  /**
   * Gets audit log
   */
  @Get()
  async getAuditLog() {
    // ⭐ FOCUS: Use shared service across modules
    return await this.sharedService.getAuditLog();
  }
}
```

```typescript
// audit/audit.module.ts
import { Module } from '@nestjs/common';
import { AuditController } from './audit.controller';

/**
 * Audit module using only shared services
 */
@Module({
  controllers: [AuditController],
})
export class AuditModule {
  // ⭐ FOCUS: Uses global SharedModule - no providers needed
}
```

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { SharedModule } from './shared/shared.module';
import { UserModule } from './users/user.module';
import { OrderModule } from './orders/order.module';
import { AuditModule } from './audit/audit.module';

/**
 * Root application module
 */
@Module({
  imports: [
    SharedModule, // ⭐ FOCUS: Import shared module first
    UserModule,
    OrderModule,
    AuditModule,
  ],
})
export class AppModule {}
```

```typescript
// main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

/**
 * Bootstrap multi-module NestJS application
 */
async function bootstrap() {
  console.log('Starting multi-module NestJS application...');

  const app = await NestFactory.create(AppModule);

  // ⭐ FOCUS: Standard NestJS configuration
  app.setGlobalPrefix('api');
  app.enableCors();

  await app.listen(3000);

  console.log(
    'Multi-module NestJS application started on http://localhost:3000'
  );
}

bootstrap();
```

## Key Features

- **Global Shared Module**: Single initialization point for VytchesDDD
- **Module Organization**: Clear separation of concerns across modules
- **Shared Services**: Common services available across all modules
- **Proper Initialization**: VytchesDDD initialized once in SharedModule
- **Cross-Module Communication**: Modules can use shared services
- **Standard NestJS Patterns**: Uses standard NestJS module patterns

## Common Pitfalls

- **Multiple Initialization**: Don't initialize VytchesDDD in multiple modules
- **Module Dependencies**: Ensure SharedModule is imported before other modules
- **Service Resolution**: VytchesDDD services must be registered before
  resolution
- **Global vs Local**: Use @Global() decorator for truly shared modules
- **Circular Dependencies**: Avoid circular dependencies between modules

## Related Examples

- [NestJS Basic Integration](./example-1.md) - Simple NestJS integration
- [Bridge Pattern Implementation](../intermediate/example-1.md) - Advanced
  integration patterns
- [Multi-Context Architecture](../advanced/example-1.md) - Enterprise
  architecture patterns
