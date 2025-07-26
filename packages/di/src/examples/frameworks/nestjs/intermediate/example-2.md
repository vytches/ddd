# NestJS Custom Provider Factory - Intermediate Example

**Version**: 1.0.0  
**Package**: @vytches/ddd-di  
**Complexity**: intermediate  
**Domain**: Multi-Tenant E-commerce  
**Patterns**: Custom Provider Factory, Dynamic Provider, Tenant Isolation  
**Dependencies**: @vytches/ddd-di, @nestjs/common

## Description

This example demonstrates how to create custom NestJS providers for VytchesDDD
services with dynamic configuration, tenant isolation, and advanced factory
patterns. It shows how to build reusable provider factories that can handle
complex enterprise scenarios.

## Business Context

Enterprise applications often need dynamic service configuration, tenant
isolation, and conditional service creation. Custom provider factories allow you
to create sophisticated integration patterns while maintaining clean separation
between NestJS and VytchesDDD concerns.

## Code Example

```typescript
// domain/tenant-user.service.ts
import { DomainService, ServiceLifetime } from '@vytches/ddd-di';
import { User, CreateUserData, UpdateUserData } from '../types'; // Import from application

/**
 * Tenant-specific user domain service
 */
@DomainService('tenantUserService')
export class TenantUserService {
  private users: Map<string, User> = new Map();

  constructor(private tenantId: string) {
    console.log(`TenantUserService: Initialized for tenant ${tenantId}`);
  }

  /**
   * Creates user for specific tenant
   */
  async createUser(userData: CreateUserData): Promise<User> {
    // ⭐ FOCUS: Tenant-specific business logic
    const user: User = {
      id: this.generateTenantUserId(),
      email: userData.email,
      name: userData.name,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.users.set(user.id, user);

    console.log(
      `TenantUserService: Created user ${user.id} for tenant ${this.tenantId}`
    );
    return user;
  }

  /**
   * Updates user for tenant
   */
  async updateUser(userId: string, updateData: UpdateUserData): Promise<User> {
    const existingUser = this.users.get(userId);
    if (!existingUser) {
      throw new Error(`User not found for tenant ${this.tenantId}: ${userId}`);
    }

    const updatedUser = {
      ...existingUser,
      ...updateData,
      updatedAt: new Date(),
    };

    this.users.set(userId, updatedUser);

    console.log(
      `TenantUserService: Updated user ${userId} for tenant ${this.tenantId}`
    );
    return updatedUser;
  }

  /**
   * Gets user by ID for tenant
   */
  async getUserById(userId: string): Promise<User | null> {
    return this.users.get(userId) || null;
  }

  /**
   * Gets all users for tenant
   */
  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  private generateTenantUserId(): string {
    return `${this.tenantId}_user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

```typescript
// domain/notification.service.ts
import { DomainService, ServiceLifetime } from '@vytches/ddd-di';
import { EmailNotificationData } from '../types'; // Import from application

/**
 * Notification domain service
 */
@DomainService({
  serviceId: 'notificationService',
  lifetime: ServiceLifetime.Singleton,
  autoRegister: true,
})
export class NotificationService {
  private emailQueue: EmailNotificationData[] = [];

  /**
   * Sends email notification
   */
  async sendEmail(notificationData: EmailNotificationData): Promise<void> {
    // ⭐ FOCUS: Notification business logic
    this.emailQueue.push(notificationData);

    console.log(`NotificationService: Queued email to ${notificationData.to}`);

    // Simulate sending
    await this.processEmailQueue();
  }

  /**
   * Sends bulk notifications
   */
  async sendBulkEmails(notifications: EmailNotificationData[]): Promise<void> {
    this.emailQueue.push(...notifications);

    console.log(`NotificationService: Queued ${notifications.length} emails`);

    await this.processEmailQueue();
  }

  private async processEmailQueue(): Promise<void> {
    // Process queued emails
    while (this.emailQueue.length > 0) {
      const email = this.emailQueue.shift();
      if (email) {
        console.log(`NotificationService: Processing email to ${email.to}`);
        await new Promise(resolve => setTimeout(resolve, 10)); // Simulate processing
      }
    }
  }
}
```

```typescript
// factories/vytches-ddd-provider.factory.ts
import { FactoryProvider, Scope } from '@nestjs/common';
import { VytchesDDD } from '@vytches/ddd-di';
import { TenantUserService } from '../domain/tenant-user.service';
import { NotificationService } from '../domain/notification.service';

/**
 * Advanced provider factory for VytchesDDD services
 */
export class VytchesDDDProviderFactory {
  /**
   * Creates a simple provider for singleton services
   */
  static createSimpleProvider<T>(
    serviceId: string,
    token?: string
  ): FactoryProvider<T> {
    return {
      provide: token || serviceId,
      useFactory: (): T => {
        // ⭐ FOCUS: Simple factory for singleton services
        const instance = VytchesDDD.resolve<T>(serviceId);
        if (!instance) {
          throw new Error(
            `Service ${serviceId} not found in VytchesDDD container`
          );
        }
        return instance;
      },
      scope: Scope.DEFAULT,
    };
  }

  /**
   * Creates a tenant-specific provider
   */
  static createTenantProvider<T>(
    serviceId: string,
    tenantId: string,
    serviceClass: new (tenantId: string) => T
  ): FactoryProvider<T> {
    return {
      provide: `${serviceId}_${tenantId}`,
      useFactory: (): T => {
        // ⭐ FOCUS: Tenant-specific factory
        console.log(
          `Creating tenant-specific service: ${serviceId} for tenant ${tenantId}`
        );
        return new serviceClass(tenantId);
      },
      scope: Scope.DEFAULT,
    };
  }

  /**
   * Creates a conditional provider
   */
  static createConditionalProvider<T>(
    serviceId: string,
    condition: () => boolean,
    serviceClass: new () => T,
    fallbackClass?: new () => T
  ): FactoryProvider<T> {
    return {
      provide: serviceId,
      useFactory: (): T => {
        // ⭐ FOCUS: Conditional service creation
        if (condition()) {
          console.log(`Creating primary service: ${serviceId}`);
          return new serviceClass();
        } else if (fallbackClass) {
          console.log(`Creating fallback service: ${serviceId}`);
          return new fallbackClass();
        } else {
          throw new Error(
            `Service ${serviceId} not available and no fallback provided`
          );
        }
      },
      scope: Scope.DEFAULT,
    };
  }

  /**
   * Creates a scoped provider that creates new instances
   */
  static createScopedProvider<T>(
    serviceId: string,
    serviceClass: new (...args: any[]) => T,
    ...args: any[]
  ): FactoryProvider<T> {
    return {
      provide: serviceId,
      useFactory: (): T => {
        // ⭐ FOCUS: Scoped service creation
        console.log(`Creating scoped service: ${serviceId}`);
        return new serviceClass(...args);
      },
      scope: Scope.REQUEST, // New instance per request
    };
  }

  /**
   * Creates a provider with dependencies
   */
  static createProviderWithDependencies<T>(
    serviceId: string,
    serviceClass: new (...deps: any[]) => T,
    dependencies: string[]
  ): FactoryProvider<T> {
    return {
      provide: serviceId,
      useFactory: (...deps: any[]): T => {
        // ⭐ FOCUS: Provider with dependency injection
        console.log(`Creating service with dependencies: ${serviceId}`);
        return new serviceClass(...deps);
      },
      inject: dependencies,
      scope: Scope.DEFAULT,
    };
  }

  /**
   * Creates a configuration-based provider
   */
  static createConfigurableProvider<T>(
    serviceId: string,
    serviceClass: new (config: any) => T,
    configKey: string
  ): FactoryProvider<T> {
    return {
      provide: serviceId,
      useFactory: (config: any): T => {
        // ⭐ FOCUS: Configuration-based service creation
        const serviceConfig = config[configKey];
        if (!serviceConfig) {
          throw new Error(
            `Configuration not found for service ${serviceId} with key ${configKey}`
          );
        }

        console.log(`Creating configured service: ${serviceId}`);
        return new serviceClass(serviceConfig);
      },
      inject: ['APP_CONFIG'],
      scope: Scope.DEFAULT,
    };
  }

  /**
   * Creates a lazy provider that delays instantiation
   */
  static createLazyProvider<T>(
    serviceId: string,
    serviceClass: new () => T
  ): FactoryProvider<() => T> {
    return {
      provide: `${serviceId}_LAZY`,
      useFactory: (): (() => T) => {
        // ⭐ FOCUS: Lazy service creation
        let instance: T | null = null;

        return () => {
          if (!instance) {
            console.log(`Lazy instantiating service: ${serviceId}`);
            instance = new serviceClass();
          }
          return instance;
        };
      },
      scope: Scope.DEFAULT,
    };
  }
}
```

```typescript
// configuration/app.config.ts
import { DIConfig } from '../types'; // Import from application

/**
 * Application configuration
 */
export const APP_CONFIG = {
  database: {
    host: 'localhost',
    port: 5432,
    username: 'app_user',
    password: 'secret',
  },
  redis: {
    host: 'localhost',
    port: 6379,
  },
  tenants: {
    'tenant-a': {
      name: 'Tenant A',
      features: ['users', 'orders', 'payments'],
    },
    'tenant-b': {
      name: 'Tenant B',
      features: ['users', 'orders'],
    },
  },
  di: {
    enableAutoDiscovery: true,
    enableContextIsolation: true,
    timeout: 30000,
  } as DIConfig,
};
```

```typescript
// nestjs/user.service.ts
import { Injectable, Inject, Scope } from '@nestjs/common';
import { TenantUserService } from '../domain/tenant-user.service';
import { NotificationService } from '../domain/notification.service';
import { User, CreateUserData, UpdateUserData } from '../types'; // Import from application

/**
 * NestJS user service with tenant support
 */
@Injectable({ scope: Scope.REQUEST })
export class UserService {
  constructor(
    @Inject('TENANT_USER_SERVICE')
    private readonly tenantUserService: TenantUserService,
    @Inject('notificationService')
    private readonly notificationService: NotificationService
  ) {
    // ⭐ FOCUS: Injected services from custom providers
  }

  /**
   * Creates user with notification
   */
  async createUser(userData: CreateUserData): Promise<User> {
    try {
      // ⭐ FOCUS: Use tenant-specific service
      const user = await this.tenantUserService.createUser(userData);

      // Send welcome email
      await this.notificationService.sendEmail({
        to: user.email,
        subject: 'Welcome!',
        body: `Welcome ${user.name}! Your account has been created.`,
      });

      return user;
    } catch (error) {
      console.error('UserService: Failed to create user:', error);
      throw error;
    }
  }

  /**
   * Updates user
   */
  async updateUser(userId: string, updateData: UpdateUserData): Promise<User> {
    try {
      const user = await this.tenantUserService.updateUser(userId, updateData);

      // Send update notification
      await this.notificationService.sendEmail({
        to: user.email,
        subject: 'Account Updated',
        body: `${user.name}, your account has been updated.`,
      });

      return user;
    } catch (error) {
      console.error('UserService: Failed to update user:', error);
      throw error;
    }
  }

  /**
   * Gets user by ID
   */
  async getUserById(userId: string): Promise<User | null> {
    try {
      return await this.tenantUserService.getUserById(userId);
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
      return await this.tenantUserService.getAllUsers();
    } catch (error) {
      console.error('UserService: Failed to get users:', error);
      throw error;
    }
  }
}
```

```typescript
// nestjs/tenant-context.service.ts
import { Injectable, Scope } from '@nestjs/common';

/**
 * Tenant context service to manage current tenant
 */
@Injectable({ scope: Scope.REQUEST })
export class TenantContextService {
  private tenantId: string | null = null;

  /**
   * Sets current tenant ID
   */
  setTenantId(tenantId: string): void {
    this.tenantId = tenantId;
    console.log(`TenantContextService: Set tenant ID to ${tenantId}`);
  }

  /**
   * Gets current tenant ID
   */
  getTenantId(): string | null {
    return this.tenantId;
  }

  /**
   * Gets current tenant ID with validation
   */
  getRequiredTenantId(): string {
    if (!this.tenantId) {
      throw new Error('Tenant ID is required but not set');
    }
    return this.tenantId;
  }
}
```

```typescript
// nestjs/dynamic-user.module.ts
import { Module, DynamicModule, OnModuleInit } from '@nestjs/common';
import { VytchesDDD, SimpleContainer } from '@vytches/ddd-di';
import { VytchesDDDProviderFactory } from '../factories/vytches-ddd-provider.factory';
import { TenantUserService } from '../domain/tenant-user.service';
import { NotificationService } from '../domain/notification.service';
import { UserService } from './user.service';
import { TenantContextService } from './tenant-context.service';
import { UserController } from './user.controller';
import { APP_CONFIG } from '../configuration/app.config';

/**
 * Dynamic user module with tenant support
 */
@Module({})
export class DynamicUserModule implements OnModuleInit {
  /**
   * Creates module for specific tenant
   */
  static forTenant(tenantId: string): DynamicModule {
    return {
      module: DynamicUserModule,
      providers: [
        // ⭐ FOCUS: Dynamic provider creation
        {
          provide: 'APP_CONFIG',
          useValue: APP_CONFIG,
        },

        // Tenant-specific user service
        VytchesDDDProviderFactory.createTenantProvider(
          'tenantUserService',
          tenantId,
          TenantUserService
        ),

        // Shared notification service
        VytchesDDDProviderFactory.createSimpleProvider<NotificationService>(
          'notificationService'
        ),

        // Tenant context service
        TenantContextService,

        // Dynamic tenant user service provider
        {
          provide: 'TENANT_USER_SERVICE',
          useFactory: (context: TenantContextService) => {
            // ⭐ FOCUS: Dynamic service resolution based on context
            context.setTenantId(tenantId);
            return new TenantUserService(tenantId);
          },
          inject: [TenantContextService],
          scope: Scope.REQUEST,
        },

        // Main user service
        UserService,
      ],
      controllers: [UserController],
      exports: [UserService, TenantContextService],
    };
  }

  /**
   * Creates module with multiple tenants
   */
  static forMultipleTenants(tenantIds: string[]): DynamicModule {
    const tenantProviders = tenantIds
      .map(tenantId => [
        VytchesDDDProviderFactory.createTenantProvider(
          'tenantUserService',
          tenantId,
          TenantUserService
        ),
        {
          provide: `TENANT_CONTEXT_${tenantId}`,
          useFactory: () => {
            const context = new TenantContextService();
            context.setTenantId(tenantId);
            return context;
          },
          scope: Scope.DEFAULT,
        },
      ])
      .flat();

    return {
      module: DynamicUserModule,
      providers: [
        {
          provide: 'APP_CONFIG',
          useValue: APP_CONFIG,
        },

        // Shared services
        VytchesDDDProviderFactory.createSimpleProvider<NotificationService>(
          'notificationService'
        ),

        // Tenant-specific providers
        ...tenantProviders,

        // Multi-tenant service resolver
        {
          provide: 'MULTI_TENANT_RESOLVER',
          useFactory: (...contexts: TenantContextService[]) => {
            return {
              getServiceForTenant: (tenantId: string) => {
                const context = contexts.find(
                  c => c.getTenantId() === tenantId
                );
                if (!context) {
                  throw new Error(`Tenant context not found: ${tenantId}`);
                }
                return new TenantUserService(tenantId);
              },
            };
          },
          inject: tenantIds.map(id => `TENANT_CONTEXT_${id}`),
        },
      ],
      exports: tenantProviders.map(p => p.provide),
    };
  }

  async onModuleInit() {
    // ⭐ FOCUS: Initialize VytchesDDD
    console.log('DynamicUserModule: Initializing VytchesDDD...');

    const container = new SimpleContainer();
    await VytchesDDD.configure(container);

    console.log('DynamicUserModule: VytchesDDD initialized');
  }
}
```

```typescript
// nestjs/user.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Headers,
} from '@nestjs/common';
import { UserService } from './user.service';
import { TenantContextService } from './tenant-context.service';
import { CreateUserData, UpdateUserData } from '../types'; // Import from application

/**
 * User controller with tenant support
 */
@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly tenantContext: TenantContextService
  ) {}

  /**
   * Creates a new user
   */
  @Post()
  async createUser(
    @Body() userData: CreateUserData,
    @Headers('x-tenant-id') tenantId?: string
  ) {
    // ⭐ FOCUS: Use tenant context
    if (tenantId) {
      this.tenantContext.setTenantId(tenantId);
    }

    return await this.userService.createUser(userData);
  }

  /**
   * Updates a user
   */
  @Put(':id')
  async updateUser(
    @Param('id') userId: string,
    @Body() updateData: UpdateUserData,
    @Headers('x-tenant-id') tenantId?: string
  ) {
    if (tenantId) {
      this.tenantContext.setTenantId(tenantId);
    }

    return await this.userService.updateUser(userId, updateData);
  }

  /**
   * Gets user by ID
   */
  @Get(':id')
  async getUserById(
    @Param('id') userId: string,
    @Headers('x-tenant-id') tenantId?: string
  ) {
    if (tenantId) {
      this.tenantContext.setTenantId(tenantId);
    }

    return await this.userService.getUserById(userId);
  }

  /**
   * Gets all users
   */
  @Get()
  async getAllUsers(@Headers('x-tenant-id') tenantId?: string) {
    if (tenantId) {
      this.tenantContext.setTenantId(tenantId);
    }

    return await this.userService.getAllUsers();
  }
}
```

```typescript
// nestjs/app.module.ts
import { Module } from '@nestjs/common';
import { DynamicUserModule } from './dynamic-user.module';

/**
 * Root application module with tenant support
 */
@Module({
  imports: [
    // ⭐ FOCUS: Dynamic modules for different tenants
    DynamicUserModule.forTenant('tenant-a'),
    DynamicUserModule.forTenant('tenant-b'),
  ],
})
export class AppModule {}
```

```typescript
// test/custom-provider.test.ts
import { Test, TestingModule } from '@nestjs/testing';
import { DynamicUserModule } from '../nestjs/dynamic-user.module';
import { UserService } from '../nestjs/user.service';
import { TenantContextService } from '../nestjs/tenant-context.service';
import { CreateUserData } from '../types'; // Import from application

describe('Custom Provider Factory', () => {
  let userService: UserService;
  let tenantContext: TenantContextService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [DynamicUserModule.forTenant('test-tenant')],
    }).compile();

    userService = module.get<UserService>(UserService);
    tenantContext = module.get<TenantContextService>(TenantContextService);
  });

  it('should create tenant-specific user service', async () => {
    const userData: CreateUserData = {
      email: 'test@example.com',
      name: 'Test User',
    };

    const user = await userService.createUser(userData);

    expect(user).toBeDefined();
    expect(user.id).toContain('test-tenant');
    expect(user.email).toBe(userData.email);
  });

  it('should maintain tenant context', async () => {
    tenantContext.setTenantId('test-tenant');

    const tenantId = tenantContext.getTenantId();
    expect(tenantId).toBe('test-tenant');
  });

  it('should create multiple users for same tenant', async () => {
    const userData1: CreateUserData = {
      email: 'user1@example.com',
      name: 'User 1',
    };

    const userData2: CreateUserData = {
      email: 'user2@example.com',
      name: 'User 2',
    };

    const user1 = await userService.createUser(userData1);
    const user2 = await userService.createUser(userData2);

    expect(user1.id).toContain('test-tenant');
    expect(user2.id).toContain('test-tenant');

    const users = await userService.getAllUsers();
    expect(users).toHaveLength(2);
  });
});
```

## Key Features

- **Custom Provider Factory**: Sophisticated provider creation patterns
- **Tenant Isolation**: Dynamic tenant-specific service creation
- **Conditional Providers**: Services created based on runtime conditions
- **Scoped Providers**: Request-scoped service instances
- **Configuration-Based**: Services configured from application config
- **Lazy Loading**: Delayed service instantiation
- **Dynamic Modules**: Runtime module configuration

## Common Pitfalls

- **Scope Confusion**: Understand REQUEST vs DEFAULT vs SINGLETON scopes
- **Provider Dependencies**: Ensure all dependencies are properly injected
- **Tenant Isolation**: Prevent cross-tenant data leakage
- **Configuration Errors**: Validate configuration before service creation
- **Memory Management**: Be careful with request-scoped services

## Related Examples

- [Bridge Pattern Implementation](./example-1.md) - Basic bridge patterns
- [Multi-Context Architecture](../advanced/example-1.md) - Enterprise
  architecture
- [Context Isolation](../../intermediate/example-2.md) - Bounded context
  patterns
