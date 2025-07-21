# Basic Repository - NestJS DI Integration

**Focus**: Basic IRepository usage with @vytches-ddd/di integration
**Base Example**: [Basic Generic Repository](../../basic/example-1.md)
**Dependencies**: @nestjs/common, @vytches-ddd/repositories, @vytches-ddd/di

## Service Implementation

```typescript
// user.service.ts
import { Injectable } from '@nestjs/common';
import { VytchesDDD } from '@vytches-ddd/di';
import { BaseRepository } from '@vytches-ddd/repositories';
import { User, CreateUserData, UpdateUserData } from './types'; // From your app

@Injectable()
export class UserService {
  private readonly userRepository: BaseRepository<User>;

  constructor() {
    // ⭐ FOCUS: @vytches-ddd/di integration for repository access
    this.userRepository = VytchesDDD.resolve<BaseRepository<User>>('userRepository');
  }

  // ✅ FOCUS: Thin wrapper around DI-managed repository
  async createUser(userData: CreateUserData): Promise<User> {
    return await this.userRepository.save(userData);
  }

  async getUserById(id: string): Promise<User | null> {
    return await this.userRepository.findById(id);
  }

  async getAllUsers(): Promise<User[]> {
    return await this.userRepository.findAll();
  }

  async updateUser(id: string, updates: UpdateUserData): Promise<User> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new Error('User not found');
    }
    
    return await this.userRepository.save({ ...user, ...updates });
  }

  async deleteUser(id: string): Promise<void> {
    await this.userRepository.delete(id);
  }

  // ✅ FOCUS: Advanced querying through DI-managed repository
  async findActiveUsers(): Promise<User[]> {
    return await this.userRepository.find({
      where: [{ field: 'isActive', operator: 'eq', value: true }],
      orderBy: [{ field: 'createdAt', direction: 'DESC' }]
    });
  }

  async findUsersByEmail(email: string): Promise<User[]> {
    return await this.userRepository.find({
      where: [{ field: 'email', operator: 'like', value: `%${email}%` }],
      limit: 10
    });
  }

  async getUserCount(): Promise<number> {
    return await this.userRepository.count();
  }

  // ✅ FOCUS: Batch operations through repository
  async createMultipleUsers(usersData: CreateUserData[]): Promise<User[]> {
    const users = await Promise.all(
      usersData.map(userData => this.userRepository.save(userData))
    );
    return users;
  }
}
```

## DI Configuration Setup

```typescript
// user-di.setup.ts
import { VytchesDDD, DomainService } from '@vytches-ddd/di';
import { BaseRepository } from '@vytches-ddd/repositories';

@DomainService('userRepository')
export class UserRepositoryConfig {
  static create(): BaseRepository<User> {
    return new BaseRepository<User>('users', {
      enableCaching: true,
      cacheTTL: 300000, // 5 minutes
      enableOptimisticLocking: true,
      enableAuditing: true,
      batchSize: 100
    });
  }
}

@DomainService('userCacheService')
export class UserCacheServiceConfig {
  static create(): UserCacheService {
    return new UserCacheService({
      provider: 'redis',
      defaultTTL: 300000,
      maxSize: 10000
    });
  }
}

@DomainService('userValidator')
export class UserValidatorConfig {
  static create(): UserValidator {
    return new UserValidator({
      enableEmailValidation: true,
      enableUsernameUniqueness: true,
      minPasswordLength: 8
    });
  }
}
```

## Module Configuration

```typescript
// user.module.ts
import { Module, OnModuleInit } from '@nestjs/common';
import { VytchesDDD } from '@vytches-ddd/di';
import { UserService } from './user.service';
import { UserController } from './user.controller';

@Module({
  providers: [UserService],
  controllers: [UserController],
  exports: [UserService]
})
export class UserModule implements OnModuleInit {
  async onModuleInit() {
    // ⭐ CRITICAL: Initialize VytchesDDD BEFORE framework DI
    await VytchesDDD.configure();
  }
}
```

## Controller Integration

```typescript
// user.controller.ts
import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserData, UpdateUserData } from './types';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  async createUser(@Body() userData: CreateUserData) {
    return await this.userService.createUser(userData);
  }

  @Post('batch')
  async createMultipleUsers(@Body() usersData: CreateUserData[]) {
    return await this.userService.createMultipleUsers(usersData);
  }

  @Get()
  async getAllUsers() {
    return await this.userService.getAllUsers();
  }

  @Get('active')
  async getActiveUsers() {
    return await this.userService.findActiveUsers();
  }

  @Get('count')
  async getUserCount() {
    return { count: await this.userService.getUserCount() };
  }

  @Get('search/:email')
  async searchByEmail(@Param('email') email: string) {
    return await this.userService.findUsersByEmail(email);
  }

  @Get(':id')
  async getUser(@Param('id') id: string) {
    return await this.userService.getUserById(id);
  }

  @Put(':id')
  async updateUser(@Param('id') id: string, @Body() updates: UpdateUserData) {
    return await this.userService.updateUser(id, updates);
  }

  @Delete(':id')
  async deleteUser(@Param('id') id: string) {
    await this.userService.deleteUser(id);
    return { message: 'User deleted successfully' };
  }
}
```

## Enhanced Configuration with Additional Services

```typescript
// enhanced-user-di.setup.ts
import { VytchesDDD, DomainService } from '@vytches-ddd/di';
import { 
  BaseRepository, 
  CacheService,
  ValidationService,
  AuditService 
} from '@vytches-ddd/repositories';

// Primary repository with advanced features
@DomainService('enhancedUserRepository')
export class EnhancedUserRepositoryConfig {
  static create(): BaseRepository<User> {
    return new BaseRepository<User>('users', {
      enableCaching: true,
      cacheTTL: 300000,
      enableOptimisticLocking: true,
      enableAuditing: true,
      enableMetrics: true,
      enableValidation: true,
      batchSize: 100,
      enableEventSourcing: false // Basic level
    });
  }
}

// Cache service configuration
@DomainService('userCacheService')
export class UserCacheServiceConfig {
  static create(): CacheService {
    return new CacheService({
      provider: 'in-memory', // Simple for basic usage
      defaultTTL: 300000,
      maxSize: 5000,
      enableMetrics: true
    });
  }
}

// Validation service configuration
@DomainService('userValidationService')
export class UserValidationServiceConfig {
  static create(): ValidationService {
    return new ValidationService({
      rules: {
        email: ['required', 'email', 'unique'],
        username: ['required', 'min:3', 'max:50', 'unique'],
        password: ['required', 'min:8', 'complexity']
      },
      enableAsyncValidation: true
    });
  }
}

// Audit service configuration
@DomainService('userAuditService')
export class UserAuditServiceConfig {
  static create(): AuditService {
    return new AuditService({
      enableChangeTracking: true,
      retentionPeriod: 90, // days
      includeUserContext: true,
      enableCompression: false // Simple for basic usage
    });
  }
}
```

## Enhanced Service with Additional DI Services

```typescript
// enhanced-user.service.ts
import { Injectable } from '@nestjs/common';
import { VytchesDDD } from '@vytches-ddd/di';
import { 
  BaseRepository,
  CacheService,
  ValidationService,
  AuditService 
} from '@vytches-ddd/repositories';
import { User, CreateUserData, UpdateUserData } from './types';

@Injectable()
export class EnhancedUserService {
  private readonly userRepository: BaseRepository<User>;
  private readonly cacheService: CacheService;
  private readonly validationService: ValidationService;
  private readonly auditService: AuditService;

  constructor() {
    // ⭐ FOCUS: Multiple DI services for enhanced functionality
    this.userRepository = VytchesDDD.resolve<BaseRepository<User>>('enhancedUserRepository');
    this.cacheService = VytchesDDD.resolve<CacheService>('userCacheService');
    this.validationService = VytchesDDD.resolve<ValidationService>('userValidationService');
    this.auditService = VytchesDDD.resolve<AuditService>('userAuditService');
  }

  // ✅ FOCUS: Enhanced operations with DI service coordination
  async createUser(userData: CreateUserData): Promise<User> {
    // Step 1: Validate through DI service
    const validationResult = await this.validationService.validate(userData);
    if (!validationResult.isValid) {
      throw new Error(`Validation failed: ${validationResult.errors.join(', ')}`);
    }

    // Step 2: Create through repository
    const user = await this.userRepository.save(userData);

    // Step 3: Cache the new user
    await this.cacheService.set(`user:${user.id}`, user, 300000);

    // Step 4: Audit the creation
    await this.auditService.logAction('USER_CREATED', {
      userId: user.id,
      email: user.email
    });

    return user;
  }

  async getUserById(id: string): Promise<User | null> {
    // Step 1: Try cache first
    const cachedUser = await this.cacheService.get<User>(`user:${id}`);
    if (cachedUser) {
      return cachedUser;
    }

    // Step 2: Fallback to repository
    const user = await this.userRepository.findById(id);
    
    // Step 3: Cache the result if found
    if (user) {
      await this.cacheService.set(`user:${id}`, user, 300000);
    }

    return user;
  }

  async updateUser(id: string, updates: UpdateUserData): Promise<User> {
    // Step 1: Get existing user
    const existingUser = await this.getUserById(id);
    if (!existingUser) {
      throw new Error('User not found');
    }

    // Step 2: Validate updates
    const validationResult = await this.validationService.validatePartial(updates);
    if (!validationResult.isValid) {
      throw new Error(`Validation failed: ${validationResult.errors.join(', ')}`);
    }

    // Step 3: Update through repository
    const updatedUser = await this.userRepository.save({ ...existingUser, ...updates });

    // Step 4: Update cache
    await this.cacheService.set(`user:${id}`, updatedUser, 300000);

    // Step 5: Audit the update
    await this.auditService.logAction('USER_UPDATED', {
      userId: id,
      changes: updates,
      previousValues: existingUser
    });

    return updatedUser;
  }

  async deleteUser(id: string): Promise<void> {
    // Step 1: Verify user exists
    const user = await this.getUserById(id);
    if (!user) {
      throw new Error('User not found');
    }

    // Step 2: Delete from repository
    await this.userRepository.delete(id);

    // Step 3: Remove from cache
    await this.cacheService.delete(`user:${id}`);

    // Step 4: Audit the deletion
    await this.auditService.logAction('USER_DELETED', {
      userId: id,
      email: user.email
    });
  }

  // ✅ FOCUS: Cached querying with DI services
  async findActiveUsers(): Promise<User[]> {
    const cacheKey = 'users:active';
    
    // Try cache first
    const cachedUsers = await this.cacheService.get<User[]>(cacheKey);
    if (cachedUsers) {
      return cachedUsers;
    }

    // Fallback to repository
    const users = await this.userRepository.find({
      where: [{ field: 'isActive', operator: 'eq', value: true }],
      orderBy: [{ field: 'createdAt', direction: 'DESC' }]
    });

    // Cache the results
    await this.cacheService.set(cacheKey, users, 60000); // 1 minute cache

    return users;
  }
}
```

## Key Points

- Basic @vytches-ddd/di integration for repository access
- Service locator pattern for clean dependency management
- Enhanced functionality through coordinated DI services
- VytchesDDD initialization before NestJS module initialization
- Clean separation between framework concerns and domain logic
- Caching, validation, and auditing through DI-managed services
- No complex NestJS DI configuration required
- Focus on @vytches-ddd capabilities rather than framework integration