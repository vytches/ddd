# NestJS Basic Integration - Beginner Example

**Version**: 1.0.0  
**Package**: @vytches-ddd/di  
**Complexity**: beginner  
**Domain**: User Management  
**Patterns**: NestJS Integration, Manual Setup, Bridge Pattern  
**Dependencies**: @vytches-ddd/di, @nestjs/common

## Description

This example demonstrates basic integration of VytchesDDD's DI system with
NestJS using manual service instantiation. It shows how to create NestJS
services that use VytchesDDD domain services without complex DI configuration.

## Business Context

When starting with VytchesDDD in a NestJS application, the simplest approach is
to manually instantiate VytchesDDD services within NestJS services. This
provides a clear separation between framework concerns and domain logic while
keeping the integration straightforward.

## Code Example

```typescript
// domain/user-domain.service.ts
import { DomainService } from '@vytches-ddd/di';
import { User, CreateUserData, UpdateUserData } from '../types'; // Import from application

/**
 * Domain service - pure business logic
 */
@DomainService('userDomainService')
export class UserDomainService {
  private users: Map<string, User> = new Map();

  /**
   * Creates a new user with domain logic
   */
  async createUser(userData: CreateUserData): Promise<User> {
    // ⭐ FOCUS: Pure domain logic, no framework dependencies
    console.log(`UserDomainService: Creating user ${userData.email}`);

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
   * Updates user information
   */
  async updateUser(userId: string, userData: UpdateUserData): Promise<User> {
    const existingUser = this.users.get(userId);
    if (!existingUser) {
      throw new Error(`User not found: ${userId}`);
    }

    const updatedUser = {
      ...existingUser,
      ...userData,
      updatedAt: new Date(),
    };

    this.users.set(userId, updatedUser);

    console.log(`UserDomainService: Updated user ${userId}`);
    return updatedUser;
  }

  /**
   * Gets user by ID
   */
  async getUserById(userId: string): Promise<User | null> {
    const user = this.users.get(userId);
    if (user) {
      console.log(`UserDomainService: Retrieved user ${userId}`);
    }
    return user || null;
  }

  /**
   * Gets all users
   */
  async getAllUsers(): Promise<User[]> {
    const users = Array.from(this.users.values());
    console.log(`UserDomainService: Retrieved ${users.length} users`);
    return users;
  }

  private generateUserId(): string {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

```typescript
// nestjs/user.service.ts
import { Injectable } from '@nestjs/common';
import { VytchesDDD } from '@vytches-ddd/di';
import { UserDomainService } from '../domain/user-domain.service';
import { User, CreateUserData, UpdateUserData } from '../types'; // Import from application

/**
 * NestJS service that bridges to VytchesDDD domain service
 */
@Injectable()
export class UserService {
  private readonly userDomainService: UserDomainService;

  constructor() {
    // ⭐ FOCUS: Manual integration with VytchesDDD (beginner-friendly)
    this.userDomainService =
      VytchesDDD.resolve<UserDomainService>('userDomainService');
  }

  /**
   * Creates a user - delegates to domain service
   */
  async createUser(userData: CreateUserData): Promise<User> {
    // ⭐ FOCUS: Thin wrapper around domain service
    try {
      return await this.userDomainService.createUser(userData);
    } catch (error) {
      console.error('UserService: Failed to create user:', error);
      throw error;
    }
  }

  /**
   * Updates a user - delegates to domain service
   */
  async updateUser(userId: string, userData: UpdateUserData): Promise<User> {
    try {
      return await this.userDomainService.updateUser(userId, userData);
    } catch (error) {
      console.error('UserService: Failed to update user:', error);
      throw error;
    }
  }

  /**
   * Gets user by ID - delegates to domain service
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
   * Gets all users - delegates to domain service
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
// nestjs/user.controller.ts
import { Controller, Get, Post, Put, Param, Body } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserData, UpdateUserData } from '../types'; // Import from application

/**
 * NestJS controller for user operations
 */
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * Creates a new user
   */
  @Post()
  async createUser(@Body() userData: CreateUserData) {
    // ⭐ FOCUS: Standard NestJS controller, delegates to service
    return await this.userService.createUser(userData);
  }

  /**
   * Updates a user
   */
  @Put(':id')
  async updateUser(
    @Param('id') userId: string,
    @Body() userData: UpdateUserData
  ) {
    return await this.userService.updateUser(userId, userData);
  }

  /**
   * Gets a user by ID
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
// nestjs/user.module.ts
import { Module, OnModuleInit } from '@nestjs/common';
import { VytchesDDD, SimpleContainer } from '@vytches-ddd/di';
import { UserController } from './user.controller';
import { UserService } from './user.service';

/**
 * NestJS module with VytchesDDD integration
 */
@Module({
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule implements OnModuleInit {
  /**
   * Initialize VytchesDDD before NestJS services
   */
  async onModuleInit() {
    // ⭐ FOCUS: Initialize VytchesDDD during module initialization
    console.log('UserModule: Initializing VytchesDDD...');

    const container = new SimpleContainer();
    await VytchesDDD.configure(container);

    console.log('UserModule: VytchesDDD initialized');
  }
}
```

```typescript
// nestjs/app.module.ts
import { Module } from '@nestjs/common';
import { UserModule } from './user.module';

/**
 * Root application module
 */
@Module({
  imports: [UserModule],
})
export class AppModule {}
```

```typescript
// nestjs/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

/**
 * NestJS application bootstrap
 */
async function bootstrap() {
  console.log('Starting NestJS application with VytchesDDD...');

  const app = await NestFactory.create(AppModule);

  // ⭐ FOCUS: Standard NestJS setup
  app.setGlobalPrefix('api');

  await app.listen(3000);

  console.log('NestJS application started on http://localhost:3000');
}

bootstrap();
```

```typescript
// test/integration.test.ts
import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from '../nestjs/user.service';
import { UserModule } from '../nestjs/user.module';
import { CreateUserData, UpdateUserData } from '../types'; // Import from application

describe('NestJS VytchesDDD Integration', () => {
  let userService: UserService;

  beforeEach(async () => {
    // ⭐ FOCUS: Testing NestJS with VytchesDDD
    const module: TestingModule = await Test.createTestingModule({
      imports: [UserModule],
    }).compile();

    userService = module.get<UserService>(UserService);
  });

  it('should create a user', async () => {
    const userData: CreateUserData = {
      email: 'test@example.com',
      name: 'Test User',
    };

    const user = await userService.createUser(userData);

    expect(user).toBeDefined();
    expect(user.email).toBe(userData.email);
    expect(user.name).toBe(userData.name);
    expect(user.isActive).toBe(true);
  });

  it('should update a user', async () => {
    const userData: CreateUserData = {
      email: 'test@example.com',
      name: 'Test User',
    };

    const user = await userService.createUser(userData);

    const updateData: UpdateUserData = {
      name: 'Updated User',
    };

    const updatedUser = await userService.updateUser(user.id, updateData);

    expect(updatedUser.name).toBe(updateData.name);
    expect(updatedUser.email).toBe(userData.email);
  });

  it('should get user by ID', async () => {
    const userData: CreateUserData = {
      email: 'test@example.com',
      name: 'Test User',
    };

    const user = await userService.createUser(userData);
    const retrievedUser = await userService.getUserById(user.id);

    expect(retrievedUser).toBeDefined();
    expect(retrievedUser?.id).toBe(user.id);
  });

  it('should get all users', async () => {
    const userData1: CreateUserData = {
      email: 'user1@example.com',
      name: 'User 1',
    };

    const userData2: CreateUserData = {
      email: 'user2@example.com',
      name: 'User 2',
    };

    await userService.createUser(userData1);
    await userService.createUser(userData2);

    const users = await userService.getAllUsers();

    expect(users).toHaveLength(2);
  });
});
```

## Key Features

- **Simple Integration**: Manual VytchesDDD service resolution in NestJS
  services
- **Clear Separation**: Domain logic separate from framework concerns
- **Standard NestJS**: Uses standard NestJS patterns and decorators
- **OnModuleInit**: Proper initialization order with VytchesDDD setup
- **Error Handling**: Basic error handling in NestJS service layer
- **Testing Support**: Easy testing with NestJS testing utilities

## Common Pitfalls

- **Initialization Order**: Always initialize VytchesDDD in OnModuleInit before
  using services
- **Service Not Found**: Ensure VytchesDDD services are registered before
  resolution
- **Error Propagation**: Handle errors appropriately in the NestJS service layer
- **Module Dependencies**: Import UserModule in other modules that need
  UserService
- **Testing Setup**: Initialize VytchesDDD in test modules

## Related Examples

- [Module Configuration](./example-2.md) - Advanced module setup
- [Bridge Pattern Implementation](../intermediate/example-1.md) - Advanced
  integration patterns
- [Framework Integration Patterns](../../advanced/example-1.md) -
  Multi-framework patterns
