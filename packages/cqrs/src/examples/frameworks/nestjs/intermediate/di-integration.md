# CQRS - NestJS DI Integration

**Focus**: Advanced CQRS integration with @vytches-ddd/di for automatic handler discovery  
**Base Example**: [Command Handlers](../../../basic/example-1.md), [Event Integration](../../../intermediate/example-1.md)  
**Dependencies**: @nestjs/common, @vytches-ddd/cqrs, @vytches-ddd/di, @vytches-ddd/events

## Service Implementation

```typescript
// user.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { VytchesDDD } from '@vytches-ddd/di';
import { CommandBus, QueryBus } from '@vytches-ddd/cqrs';
import { 
  CreateUserCommand, 
  UpdateUserCommand,
  GetUserByIdQuery,
  SearchUsersQuery,
  User,
  UserListResult,
  CreateUserData,
  UpdateUserData 
} from './types'; // From your application

/**
 * Advanced NestJS service with @vytches-ddd/di integration
 * for automatic handler discovery and enterprise-grade CQRS patterns.
 */
@Injectable()
export class UserService implements OnModuleInit {
  private commandBus: CommandBus;
  private queryBus: QueryBus;

  constructor() {
    // ⭐ FOCUS: @vytches-ddd/di integration for enterprise patterns
    this.commandBus = VytchesDDD.resolve<CommandBus>('commandBus');
    this.queryBus = VytchesDDD.resolve<QueryBus>('queryBus');
  }

  async onModuleInit() {
    // Ensure DI container is properly configured
    if (!this.commandBus || !this.queryBus) {
      throw new Error('CQRS buses not properly configured. Ensure VytchesDDD.configure() is called in module initialization.');
    }
  }

  /**
   * Creates a new user with comprehensive event publishing and validation
   */
  async createUser(userData: CreateUserData): Promise<User> {
    try {
      // ✅ FOCUS: Advanced command with correlation tracking
      const command = new CreateUserCommand(
        userData.email,
        userData.name,
        userData.role,
        userData.profile,
        undefined, // userId - auto-generated
        this.generateCorrelationId(), // Correlation tracking
        userData.initialPreferences
      );

      // ✅ FOCUS: Enterprise command execution with full error handling
      const result = await this.commandBus.execute(command);
      
      if (!result.success) {
        // Handle validation errors specifically
        if (result.validationErrors && result.validationErrors.length > 0) {
          const errorMessages = result.validationErrors
            .map(err => `${err.field}: ${err.message}`)
            .join(', ');
          throw new Error(`Validation failed: ${errorMessages}`);
        }
        
        throw new Error(`User creation failed: ${result.error}`);
      }

      return result.result!;
    } catch (error) {
      console.error('Failed to create user:', error);
      throw new Error(`Failed to create user: ${error.message}`);
    }
  }

  /**
   * Updates user with optimistic concurrency control and event publishing
   */
  async updateUser(userId: string, userData: UpdateUserData): Promise<User> {
    try {
      // ✅ FOCUS: Advanced command with version control
      const command = new UpdateUserCommand(
        userId,
        userData.email,
        userData.name,
        userData.role,
        userData.profile,
        userData.preferences,
        userData.version, // Optimistic concurrency control
        this.generateCorrelationId()
      );

      const result = await this.commandBus.execute(command);
      
      if (!result.success) {
        // Handle concurrency conflicts specifically
        if (result.error?.includes('concurrency conflict')) {
          throw new Error('User was modified by another process. Please refresh and try again.');
        }
        
        if (result.validationErrors && result.validationErrors.length > 0) {
          const errorMessages = result.validationErrors
            .map(err => `${err.field}: ${err.message}`)
            .join(', ');
          throw new Error(`Validation failed: ${errorMessages}`);
        }
        
        throw new Error(`User update failed: ${result.error}`);
      }

      return result.result!;
    } catch (error) {
      console.error('Failed to update user:', error);
      throw new Error(`Failed to update user: ${error.message}`);
    }
  }

  /**
   * Retrieves user with intelligent caching and performance monitoring
   */
  async getUserById(
    userId: string, 
    includeProfile: boolean = true,
    includePreferences: boolean = true
  ): Promise<User | null> {
    try {
      // ✅ FOCUS: Advanced query with caching and correlation
      const query = new GetUserByIdQuery(
        userId,
        includeProfile,
        includePreferences,
        this.generateCorrelationId()
      );

      const result = await this.queryBus.execute(query);
      
      if (!result.success) {
        if (result.error?.includes('not found')) {
          return null;
        }
        throw new Error(`User retrieval failed: ${result.error}`);
      }

      // Log cache performance for monitoring
      if (result.metadata?.cacheHit) {
        console.log(`Cache hit for user ${userId} (${result.metadata.executionTime}ms)`);
      } else {
        console.log(`Cache miss for user ${userId} (${result.metadata?.executionTime}ms)`);
      }

      return result.data!;
    } catch (error) {
      console.error('Failed to get user:', error);
      throw new Error(`Failed to get user: ${error.message}`);
    }
  }

  /**
   * Advanced user search with optimization strategy selection
   */
  async searchUsers(
    searchTerm?: string,
    role?: 'admin' | 'user' | 'moderator',
    status?: 'active' | 'inactive' | 'suspended',
    page: number = 1,
    pageSize: number = 20,
    sortBy: string = 'name',
    sortDirection: 'asc' | 'desc' = 'asc'
  ): Promise<UserListResult> {
    try {
      // ✅ FOCUS: Advanced query with comprehensive filtering
      const query = new SearchUsersQuery(
        searchTerm,
        role,
        status,
        undefined, // createdAfter
        undefined, // createdBefore
        { page, pageSize, sortBy, sortDirection },
        this.generateCorrelationId()
      );

      const result = await this.queryBus.execute(query);
      
      if (!result.success) {
        throw new Error(`User search failed: ${result.error}`);
      }

      // Log search performance and strategy for optimization
      const searchStrategy = result.metadata?.searchStrategy;
      const executionTime = result.metadata?.executionTime;
      console.log(`Search completed using ${searchStrategy} strategy (${executionTime}ms)`);

      return result.data!;
    } catch (error) {
      console.error('Failed to search users:', error);
      throw new Error(`Failed to search users: ${error.message}`);
    }
  }

  /**
   * Deactivates user with comprehensive audit logging
   */
  async deactivateUser(
    userId: string, 
    reason: string, 
    deactivatedBy: string
  ): Promise<User> {
    try {
      // ✅ FOCUS: Advanced command with audit requirements
      const command = new DeactivateUserCommand(
        userId,
        reason,
        deactivatedBy,
        this.generateCorrelationId()
      );

      const result = await this.commandBus.execute(command);
      
      if (!result.success) {
        if (result.validationErrors && result.validationErrors.length > 0) {
          const errorMessages = result.validationErrors
            .map(err => `${err.field}: ${err.message}`)
            .join(', ');
          throw new Error(`Validation failed: ${errorMessages}`);
        }
        
        throw new Error(`User deactivation failed: ${result.error}`);
      }

      console.log(`User ${userId} deactivated by ${deactivatedBy}. Reason: ${reason}`);
      return result.result!;
    } catch (error) {
      console.error('Failed to deactivate user:', error);
      throw new Error(`Failed to deactivate user: ${error.message}`);
    }
  }

  /**
   * Gets CQRS performance metrics for monitoring
   */
  getPerformanceMetrics(): any {
    try {
      // ✅ FOCUS: Access performance metrics through DI system
      const performanceService = VytchesDDD.resolve('performanceService');
      return performanceService?.getMetrics() || {};
    } catch (error) {
      console.warn('Performance metrics not available:', error);
      return {};
    }
  }

  /**
   * Generates correlation ID for request tracking
   */
  private generateCorrelationId(): string {
    return `corr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

```typescript
// user-cqrs.module.ts
import { Module, OnModuleInit } from '@nestjs/common';
import { VytchesDDD } from '@vytches-ddd/di';
import { UnifiedEventBus, UniversalEventDispatcher } from '@vytches-ddd/events';
import { CommandBus, QueryBus } from '@vytches-ddd/cqrs';
import { UserService } from './user.service';
import { UserController } from './user.controller';

/**
 * Advanced CQRS module with @vytches-ddd/di integration
 * for automatic handler discovery and enterprise patterns.
 */
@Module({
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService]
})
export class UserCQRSModule implements OnModuleInit {
  
  async onModuleInit() {
    // ⭐ CRITICAL: Initialize VytchesDDD BEFORE framework DI
    await this.configureCQRSInfrastructure();
  }

  /**
   * Configures CQRS infrastructure with automatic handler discovery
   */
  private async configureCQRSInfrastructure(): Promise<void> {
    try {
      console.log('🔧 Configuring CQRS infrastructure...');

      // 1. Create core CQRS components
      const eventBus = new UnifiedEventBus();
      const eventDispatcher = new UniversalEventDispatcher(eventBus);
      
      const commandBus = new CommandBus({
        enableMetrics: true,
        enableEvents: true,
        defaultTimeout: 15000
      });
      
      const queryBus = new QueryBus({
        enableCaching: true,
        enableMetrics: true,
        defaultTimeout: 10000
      });

      // 2. Register core services with VytchesDDD container
      VytchesDDD.registerInstance('eventBus', eventBus);
      VytchesDDD.registerInstance('eventDispatcher', eventDispatcher);
      VytchesDDD.registerInstance('commandBus', commandBus);
      VytchesDDD.registerInstance('queryBus', queryBus);

      // 3. Register repository and service dependencies
      await this.registerDependencies();

      // 4. Configure automatic handler discovery
      await VytchesDDD.configure();

      console.log('✅ CQRS infrastructure configured successfully');
      console.log('🎯 Command and query handlers auto-discovered');
      console.log('📡 Event system configured with automatic publishing');

    } catch (error) {
      console.error('❌ Failed to configure CQRS infrastructure:', error);
      throw error;
    }
  }

  /**
   * Registers application dependencies with VytchesDDD container
   */
  private async registerDependencies(): Promise<void> {
    // Register repositories (would normally come from database module)
    VytchesDDD.registerInstance('userRepository', this.createUserRepository());
    VytchesDDD.registerInstance('cacheService', this.createCacheService());
    VytchesDDD.registerInstance('emailService', this.createEmailService());
    VytchesDDD.registerInstance('auditService', this.createAuditService());
    VytchesDDD.registerInstance('cleanupService', this.createCleanupService());

    // Register performance monitoring
    VytchesDDD.registerInstance('performanceService', this.createPerformanceService());

    console.log('📦 Application dependencies registered');
  }

  // Factory methods for services (in real app, these would be proper implementations)
  private createUserRepository(): any {
    // Return proper repository implementation
    return new MockUserRepository();
  }

  private createCacheService(): any {
    // Return proper cache service (Redis, etc.)
    return new MockCacheService();
  }

  private createEmailService(): any {
    // Return proper email service
    return new MockEmailService();
  }

  private createAuditService(): any {
    // Return proper audit service
    return new MockAuditService();
  }

  private createCleanupService(): any {
    // Return proper cleanup service
    return new MockCleanupService();
  }

  private createPerformanceService(): any {
    // Return proper performance monitoring service
    return new MockPerformanceService();
  }
}

// Mock implementations for demonstration
class MockUserRepository {
  async save(user: any) { return { success: true }; }
  async findById(id: string) { return null; }
  async findByEmail(email: string) { return null; }
}

class MockCacheService {
  async get(key: string) { return null; }
  async set(key: string, value: any, ttl: number) { }
}

class MockEmailService {
  async sendWelcomeEmail(email: string, name: string) { }
}

class MockAuditService {
  async logUserDeactivation(userId: string, reason: string, deactivatedBy: string, correlationId?: string) { }
}

class MockCleanupService {
  async cleanupUserResources(userId: string) { }
}

class MockPerformanceService {
  getMetrics() {
    return {
      commands: { total: 0, successful: 0, averageExecutionTime: 0 },
      queries: { total: 0, successful: 0, cacheHitRate: 0 }
    };
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
  Delete,
  Body, 
  Param, 
  Query, 
  HttpStatus, 
  HttpException 
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto, UpdateUserDto, SearchUsersDto, DeactivateUserDto } from './dto'; // From your app

/**
 * Advanced NestJS controller with comprehensive CQRS operations
 * and enterprise-grade error handling.
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
          phoneNumber: createUserDto.phoneNumber
        },
        initialPreferences: createUserDto.preferences
      };

      // ✅ FOCUS: Enterprise CQRS with comprehensive validation
      const user = await this.userService.createUser(userData);
      
      return {
        success: true,
        data: user,
        message: 'User created successfully',
        metadata: {
          timestamp: new Date(),
          version: user.version
        }
      };
    } catch (error) {
      console.error('User creation failed:', error);
      
      if (error.message.includes('Validation failed')) {
        throw new HttpException(
          { message: error.message, type: 'VALIDATION_ERROR' },
          HttpStatus.BAD_REQUEST
        );
      }
      
      throw new HttpException(
        { message: error.message, type: 'INTERNAL_ERROR' },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
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
        version: updateUserDto.version // Required for optimistic concurrency
      };

      // ✅ FOCUS: Advanced command with concurrency control
      const user = await this.userService.updateUser(userId, userData);
      
      return {
        success: true,
        data: user,
        message: 'User updated successfully',
        metadata: {
          timestamp: new Date(),
          previousVersion: updateUserDto.version,
          newVersion: user.version
        }
      };
    } catch (error) {
      console.error('User update failed:', error);
      
      if (error.message.includes('concurrency conflict')) {
        throw new HttpException(
          { message: error.message, type: 'CONCURRENCY_ERROR' },
          HttpStatus.CONFLICT
        );
      }
      
      if (error.message.includes('Validation failed')) {
        throw new HttpException(
          { message: error.message, type: 'VALIDATION_ERROR' },
          HttpStatus.BAD_REQUEST
        );
      }
      
      throw new HttpException(
        { message: error.message, type: 'INTERNAL_ERROR' },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get(':id')
  async getUserById(
    @Param('id') userId: string,
    @Query('includeProfile') includeProfile?: boolean,
    @Query('includePreferences') includePreferences?: boolean
  ) {
    try {
      // ✅ FOCUS: Advanced query with performance tracking
      const user = await this.userService.getUserById(
        userId, 
        includeProfile !== false,
        includePreferences !== false
      );
      
      if (!user) {
        throw new HttpException(
          { message: 'User not found', type: 'NOT_FOUND' },
          HttpStatus.NOT_FOUND
        );
      }
      
      return {
        success: true,
        data: user,
        metadata: {
          timestamp: new Date(),
          version: user.version
        }
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      
      console.error('User retrieval failed:', error);
      throw new HttpException(
        { message: error.message, type: 'INTERNAL_ERROR' },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get()
  async searchUsers(@Query() searchDto: SearchUsersDto) {
    try {
      // ✅ FOCUS: Advanced search with comprehensive filtering
      const result = await this.userService.searchUsers(
        searchDto.search,
        searchDto.role,
        searchDto.status,
        searchDto.page || 1,
        searchDto.pageSize || 20,
        searchDto.sortBy || 'name',
        searchDto.sortDirection || 'asc'
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
          hasPreviousPage: result.pageInfo.hasPreviousPage
        },
        metadata: {
          timestamp: new Date(),
          resultCount: result.users.length
        }
      };
    } catch (error) {
      console.error('User search failed:', error);
      throw new HttpException(
        { message: error.message, type: 'SEARCH_ERROR' },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Delete(':id')
  async deactivateUser(
    @Param('id') userId: string,
    @Body() deactivateDto: DeactivateUserDto
  ) {
    try {
      // ✅ FOCUS: Advanced command with audit requirements
      const user = await this.userService.deactivateUser(
        userId,
        deactivateDto.reason,
        deactivateDto.deactivatedBy
      );
      
      return {
        success: true,
        data: user,
        message: 'User deactivated successfully',
        metadata: {
          timestamp: new Date(),
          reason: deactivateDto.reason,
          deactivatedBy: deactivateDto.deactivatedBy
        }
      };
    } catch (error) {
      console.error('User deactivation failed:', error);
      
      if (error.message.includes('Validation failed')) {
        throw new HttpException(
          { message: error.message, type: 'VALIDATION_ERROR' },
          HttpStatus.BAD_REQUEST
        );
      }
      
      throw new HttpException(
        { message: error.message, type: 'INTERNAL_ERROR' },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('system/metrics')
  async getSystemMetrics() {
    try {
      // ✅ FOCUS: Performance monitoring through CQRS
      const metrics = this.userService.getPerformanceMetrics();
      
      return {
        success: true,
        data: metrics,
        metadata: {
          timestamp: new Date()
        }
      };
    } catch (error) {
      console.error('Failed to get metrics:', error);
      throw new HttpException(
        { message: 'Failed to retrieve system metrics', type: 'METRICS_ERROR' },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
```

## Key Points

- **Enterprise DI Integration**: Uses @vytches-ddd/di for automatic handler discovery and service resolution
- **Automatic Handler Registration**: Command and query handlers discovered automatically through decorators
- **Performance Monitoring**: Built-in metrics collection and performance tracking
- **Event Integration**: Automatic event publishing for cross-cutting concerns
- **Advanced Error Handling**: Comprehensive error handling with proper categorization
- **Correlation Tracking**: Full request correlation for debugging and monitoring
- **Optimistic Concurrency**: Version-based concurrency control for data integrity

## Benefits

- **Automatic Discovery**: Handlers registered automatically without manual configuration
- **Enterprise Patterns**: Service locator pattern following MediatR architecture
- **Performance Optimization**: Built-in caching, metrics, and optimization strategies
- **Event-Driven Architecture**: Automatic event publishing for complex business processes
- **Maintainability**: Clear separation of concerns with enterprise-grade patterns

## Advanced Features

- **Context Isolation**: Support for bounded context isolation in large applications
- **Middleware Pipeline**: Comprehensive middleware for validation, logging, and monitoring
- **Circuit Breakers**: Resilience patterns for external service dependencies
- **Cache Strategies**: Intelligent caching with TTL and invalidation patterns
- **Audit Trails**: Comprehensive audit logging for compliance requirements

## Production Considerations

- **Container Configuration**: Proper DI container setup in application bootstrap
- **Error Monitoring**: Integration with APM tools for error tracking
- **Performance Monitoring**: Metrics export to monitoring systems
- **Health Checks**: CQRS system health monitoring endpoints
- **Scaling**: Proper configuration for horizontal scaling scenarios