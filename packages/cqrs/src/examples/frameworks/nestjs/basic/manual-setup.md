# CQRS - NestJS Manual Setup

**Focus**: Basic CQRS command and query handling in NestJS with manual
instantiation  
**Base Example**: [Command Handlers](../../../basic/example-1.md),
[Query Handlers](../../../basic/example-2.md)  
**Dependencies**: @nestjs/common, @vytches-ddd/cqrs

## Service Implementation

```typescript
// user.service.ts
import { Injectable } from '@nestjs/common';
import { CommandBus, QueryBus } from '@vytches-ddd/cqrs';
import {
  CreateUserCommand,
  UpdateUserCommand,
  GetUserByIdQuery,
  SearchUsersQuery,
  User,
  UserListResult,
  CreateUserData,
  UpdateUserData,
} from './types'; // From your application

/**
 * NestJS service providing CQRS-based user management operations
 * with manual command and query bus setup for basic scenarios.
 */
@Injectable()
export class UserService {
  private readonly commandBus: CommandBus;
  private readonly queryBus: QueryBus;

  constructor() {
    // ⭐ FOCUS: Manual CQRS setup (beginner-friendly)
    this.commandBus = new CommandBus();
    this.queryBus = new QueryBus({
      enableCaching: true,
      enableMetrics: true,
      defaultTimeout: 10000,
    });

    this.initializeHandlers();
  }

  /**
   * Creates a new user through CQRS command handling
   */
  async createUser(userData: CreateUserData): Promise<User> {
    try {
      // ✅ FOCUS: Command execution through @vytches-ddd/cqrs
      const command = new CreateUserCommand(
        userData.email,
        userData.name,
        userData.role,
        userData.profile,
        undefined, // userId
        undefined, // correlationId
        userData.initialPreferences
      );

      const result = await this.commandBus.execute(command);

      if (!result.success) {
        throw new Error(`User creation failed: ${result.error}`);
      }

      return result.result!;
    } catch (error) {
      throw new Error(`Failed to create user: ${error.message}`);
    }
  }

  /**
   * Updates an existing user through CQRS command handling
   */
  async updateUser(userId: string, userData: UpdateUserData): Promise<User> {
    try {
      // ✅ FOCUS: Command with optimistic concurrency control
      const command = new UpdateUserCommand(
        userId,
        userData.email,
        userData.name,
        userData.role,
        userData.profile,
        userData.preferences,
        userData.version // For optimistic concurrency
      );

      const result = await this.commandBus.execute(command);

      if (!result.success) {
        throw new Error(`User update failed: ${result.error}`);
      }

      return result.result!;
    } catch (error) {
      throw new Error(`Failed to update user: ${error.message}`);
    }
  }

  /**
   * Retrieves a user by ID through CQRS query handling
   */
  async getUserById(
    userId: string,
    includeProfile: boolean = true
  ): Promise<User | null> {
    try {
      // ✅ FOCUS: Query execution with caching support
      const query = new GetUserByIdQuery(
        userId,
        includeProfile,
        true // includePreferences
      );

      const result = await this.queryBus.execute(query);

      if (!result.success) {
        if (result.error?.includes('not found')) {
          return null;
        }
        throw new Error(`User retrieval failed: ${result.error}`);
      }

      return result.data!;
    } catch (error) {
      throw new Error(`Failed to get user: ${error.message}`);
    }
  }

  /**
   * Searches users with advanced filtering and pagination
   */
  async searchUsers(
    searchTerm?: string,
    role?: 'admin' | 'user' | 'moderator',
    page: number = 1,
    pageSize: number = 20
  ): Promise<UserListResult> {
    try {
      // ✅ FOCUS: Query with pagination and filtering
      const query = new SearchUsersQuery(
        searchTerm,
        role,
        'active', // status filter
        undefined, // createdAfter
        undefined, // createdBefore
        { page, pageSize, sortBy: 'name', sortDirection: 'asc' }
      );

      const result = await this.queryBus.execute(query);

      if (!result.success) {
        throw new Error(`User search failed: ${result.error}`);
      }

      return result.data!;
    } catch (error) {
      throw new Error(`Failed to search users: ${error.message}`);
    }
  }

  /**
   * Manual handler registration for basic setup
   */
  private async initializeHandlers(): Promise<void> {
    // Register command handlers manually
    // In production, use automatic discovery through @vytches-ddd/di

    // Note: Handler registration would typically be done through
    // dependency injection and automatic discovery. This manual
    // approach is for demonstration of basic CQRS concepts.

    console.log('🔧 CQRS handlers initialized manually');
    console.log(
      '💡 For production, consider using @vytches-ddd/di for automatic discovery'
    );
  }
}
```

```typescript
// user.controller.ts
import {
  Controller,
  Post,
  Put,
  Get,
  Body,
  Param,
  Query,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto, UpdateUserDto, SearchUsersDto } from './dto'; // From your app

/**
 * NestJS controller demonstrating CQRS integration through service layer
 */
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  async createUser(@Body() createUserDto: CreateUserDto) {
    try {
      const userData = {
        email: createUserDto.email,
        name: createUserDto.name,
        role: createUserDto.role,
        profile: {
          firstName: createUserDto.firstName,
          lastName: createUserDto.lastName,
          bio: createUserDto.bio,
          location: createUserDto.location,
          phoneNumber: createUserDto.phoneNumber,
        },
        initialPreferences: createUserDto.preferences,
      };

      // ✅ FOCUS: Delegate to CQRS-based service
      const user = await this.userService.createUser(userData);

      return {
        success: true,
        data: user,
        message: 'User created successfully',
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Put(':id')
  async updateUser(
    @Param('id') userId: string,
    @Body() updateUserDto: UpdateUserDto
  ) {
    try {
      const userData = {
        email: updateUserDto.email,
        name: updateUserDto.name,
        role: updateUserDto.role,
        profile: updateUserDto.profile,
        preferences: updateUserDto.preferences,
        version: updateUserDto.version,
      };

      // ✅ FOCUS: Command execution through service
      const user = await this.userService.updateUser(userId, userData);

      return {
        success: true,
        data: user,
        message: 'User updated successfully',
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Get(':id')
  async getUserById(
    @Param('id') userId: string,
    @Query('includeProfile') includeProfile?: boolean
  ) {
    try {
      // ✅ FOCUS: Query execution through service
      const user = await this.userService.getUserById(
        userId,
        includeProfile !== false
      );

      if (!user) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }

      return {
        success: true,
        data: user,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get()
  async searchUsers(@Query() searchDto: SearchUsersDto) {
    try {
      // ✅ FOCUS: Query with pagination through service
      const result = await this.userService.searchUsers(
        searchDto.search,
        searchDto.role,
        searchDto.page || 1,
        searchDto.pageSize || 20
      );

      return {
        success: true,
        data: result.users,
        pagination: {
          page: result.pageInfo.page,
          pageSize: result.pageInfo.pageSize,
          totalPages: result.pageInfo.totalPages,
          totalCount: result.totalCount,
          hasNextPage: result.pageInfo.hasNextPage,
          hasPreviousPage: result.pageInfo.hasPreviousPage,
        },
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
```

```typescript
// user.module.ts
import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';

@Module({
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
```

## Key Points

- **Manual Setup**: Simple manual instantiation of CommandBus and QueryBus for
  basic scenarios
- **Service Layer**: NestJS service acts as thin wrapper around CQRS operations
- **Error Handling**: Standard try/catch blocks with appropriate HTTP status
  codes
- **Framework Integration**: Standard NestJS patterns (Injectable, Controller,
  Module)
- **Type Safety**: Full TypeScript support with proper error handling

## Benefits

- **Simple to Understand**: Manual setup makes CQRS concepts clear for beginners
- **Framework Native**: Uses standard NestJS patterns and decorators
- **Error Handling**: Consistent error handling with proper HTTP responses
- **Type Safety**: Full TypeScript integration with compile-time validation

## Limitations

- **Manual Registration**: Handlers must be registered manually (not scalable)
- **No Auto-Discovery**: Missing automatic handler discovery benefits
- **Limited Middleware**: Basic setup lacks advanced middleware pipeline
  features
- **Service Coupling**: Service layer directly manages CQRS infrastructure

## When to Use

- **Learning CQRS**: Great for understanding basic CQRS concepts
- **Simple Applications**: Suitable for applications with limited complexity
- **Proof of Concepts**: Perfect for demonstrating CQRS patterns
- **Migration Path**: Good starting point before moving to advanced DI
  integration

## Migration to Advanced Setup

For production applications, consider upgrading to the
[DI Integration](../intermediate/di-integration.md) approach which provides:

- Automatic handler discovery through @vytches-ddd/di
- Advanced middleware pipeline support
- Better separation of concerns
- Enhanced performance monitoring
- Enterprise-grade service locator patterns
