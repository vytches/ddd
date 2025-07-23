# Domain Primitives - NestJS Basic Manual Setup

**Version**: 2025-01-21  
**Package**: @vytches-ddd/domain-primitives  
**Complexity**: Basic  
**Framework**: NestJS  
**Focus**: Manual setup with basic error handling and actor tracking
**Base Example**: [Simple Domain Errors](../../../basic/example-1.md)

## Service Implementation

```typescript
// user.service.ts
import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { 
  IDomainError, 
  DomainErrorCode,
  IActor,
  DefaultActorType,
  NotFoundError,
  InvalidParameterError 
} from '@vytches-ddd/domain-primitives';
import { 
  CreateUserDto, 
  UserData, 
  SuccessResponse,
  ErrorResponse,
  AuditEntry 
} from './types'; // From your application

@Injectable()
export class UserService {
  private users: Map<string, UserData> = new Map();
  private auditLog: AuditEntry[] = [];

  // ✅ FOCUS: Manual domain error handling with NestJS
  async createUser(dto: CreateUserDto, actor: IActor): Promise<SuccessResponse<UserData>> {
    try {
      // Validate input using domain primitives
      this.validateCreateUserInput(dto);

      // Check for existing user
      const existingUser = Array.from(this.users.values())
        .find(user => user.email === dto.email);
      
      if (existingUser) {
        throw new InvalidParameterError('Email already exists', {
          code: DomainErrorCode.Duplicate,
          domain: 'UserManagement',
          data: { email: dto.email }
        });
      }

      // Create user
      const user: UserData = {
        id: this.generateId(),
        email: dto.email,
        name: dto.name,
        role: 'user'
      };

      this.users.set(user.id, user);

      // Record audit entry
      await this.recordAuditEntry(actor, 'CREATE_USER', `user:${user.id}`, {
        email: user.email,
        name: user.name
      });

      return {
        success: true,
        data: user
      };
    } catch (error) {
      // Record failed action
      await this.recordAuditEntry(actor, 'CREATE_USER_FAILED', 'user:new', {
        error: (error as Error).message
      });

      // Convert domain errors to NestJS exceptions
      this.handleDomainError(error);
      throw error;
    }
  }

  async findUser(userId: string, actor: IActor): Promise<SuccessResponse<UserData>> {
    try {
      const user = this.users.get(userId);
      
      if (!user) {
        throw new NotFoundError(`User ${userId} not found`, {
          code: DomainErrorCode.NotFound,
          domain: 'UserManagement',
          data: { userId }
        });
      }

      // Check if actor can view this user
      if (!this.canViewUser(actor, user)) {
        throw new InvalidParameterError('Access denied', {
          code: DomainErrorCode.Unauthorized,
          domain: 'UserManagement',
          data: { userId, actorId: actor.id }
        });
      }

      await this.recordAuditEntry(actor, 'VIEW_USER', `user:${userId}`, {
        targetUserId: userId
      });

      return {
        success: true,
        data: user
      };
    } catch (error) {
      await this.recordAuditEntry(actor, 'VIEW_USER_FAILED', `user:${userId}`, {
        error: (error as Error).message
      });

      this.handleDomainError(error);
      throw error;
    }
  }

  async updateUser(
    userId: string, 
    updates: Partial<CreateUserDto>, 
    actor: IActor
  ): Promise<SuccessResponse<UserData>> {
    try {
      const user = this.users.get(userId);
      
      if (!user) {
        throw new NotFoundError(`User ${userId} not found`, {
          code: DomainErrorCode.NotFound,
          domain: 'UserManagement',
          data: { userId }
        });
      }

      // Check permissions
      if (!this.canUpdateUser(actor, user)) {
        throw new InvalidParameterError('Insufficient permissions', {
          code: DomainErrorCode.Unauthorized,
          domain: 'UserManagement',
          data: { userId, actorId: actor.id, actorType: actor.type }
        });
      }

      // Apply updates
      const updatedUser = { ...user };
      if (updates.name) updatedUser.name = updates.name;
      if (updates.email) {
        // Check email uniqueness
        const emailExists = Array.from(this.users.values())
          .some(u => u.id !== userId && u.email === updates.email);
        
        if (emailExists) {
          throw new InvalidParameterError('Email already exists', {
            code: DomainErrorCode.Duplicate,
            domain: 'UserManagement',
            data: { email: updates.email }
          });
        }
        updatedUser.email = updates.email;
      }

      this.users.set(userId, updatedUser);

      await this.recordAuditEntry(actor, 'UPDATE_USER', `user:${userId}`, {
        changes: updates,
        previousValues: {
          name: user.name,
          email: user.email
        }
      });

      return {
        success: true,
        data: updatedUser
      };
    } catch (error) {
      await this.recordAuditEntry(actor, 'UPDATE_USER_FAILED', `user:${userId}`, {
        error: (error as Error).message,
        attemptedChanges: updates
      });

      this.handleDomainError(error);
      throw error;
    }
  }

  async deleteUser(userId: string, actor: IActor): Promise<SuccessResponse<void>> {
    try {
      const user = this.users.get(userId);
      
      if (!user) {
        throw new NotFoundError(`User ${userId} not found`, {
          code: DomainErrorCode.NotFound,
          domain: 'UserManagement',
          data: { userId }
        });
      }

      // Only admins can delete users
      if (actor.type !== DefaultActorType.ADMIN) {
        throw new InvalidParameterError('Admin access required', {
          code: DomainErrorCode.Unauthorized,
          domain: 'UserManagement',
          data: { userId, actorId: actor.id, requiredRole: 'admin' }
        });
      }

      this.users.delete(userId);

      await this.recordAuditEntry(actor, 'DELETE_USER', `user:${userId}`, {
        deletedUser: {
          email: user.email,
          name: user.name,
          role: user.role
        }
      });

      return {
        success: true,
        data: undefined
      };
    } catch (error) {
      await this.recordAuditEntry(actor, 'DELETE_USER_FAILED', `user:${userId}`, {
        error: (error as Error).message
      });

      this.handleDomainError(error);
      throw error;
    }
  }

  // ✅ FOCUS: Manual audit trail implementation
  private async recordAuditEntry(
    actor: IActor,
    action: string,
    resource: string,
    details: Record<string, unknown>
  ): Promise<void> {
    const entry: AuditEntry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      actor: {
        type: actor.type,
        id: actor.id,
        source: actor.source,
        metadata: actor.metadata
      },
      action,
      resource,
      timestamp: new Date(),
      changes: details,
      result: 'success'
    };

    this.auditLog.push(entry);
    console.log('Audit Entry:', entry);
  }

  // ✅ FOCUS: Domain error to NestJS exception conversion
  private handleDomainError(error: unknown): void {
    if (error instanceof IDomainError) {
      switch (error.code) {
        case DomainErrorCode.NotFound:
          throw new NotFoundException(error.message);
        case DomainErrorCode.Duplicate:
        case DomainErrorCode.InvalidParameter:
          throw new BadRequestException(error.message);
        case DomainErrorCode.Unauthorized:
          throw new ForbiddenException(error.message);
        default:
          throw new BadRequestException(error.message);
      }
    }
  }

  private validateCreateUserInput(dto: CreateUserDto): void {
    if (!dto.email || !this.isValidEmail(dto.email)) {
      throw new InvalidParameterError('Invalid email format', {
        code: DomainErrorCode.InvalidParameter,
        domain: 'UserManagement',
        data: { field: 'email', value: dto.email }
      });
    }

    if (!dto.name || dto.name.length < 2) {
      throw new InvalidParameterError('Name must be at least 2 characters', {
        code: DomainErrorCode.InvalidParameter,
        domain: 'UserManagement',
        data: { field: 'name', value: dto.name }
      });
    }

    if (!dto.password || dto.password.length < 8) {
      throw new InvalidParameterError('Password must be at least 8 characters', {
        code: DomainErrorCode.InvalidParameter,
        domain: 'UserManagement',
        data: { field: 'password' }
      });
    }
  }

  private canViewUser(actor: IActor, user: UserData): boolean {
    // Users can view their own profile, admins can view all
    return actor.id === user.id || actor.type === DefaultActorType.ADMIN;
  }

  private canUpdateUser(actor: IActor, user: UserData): boolean {
    // Users can update their own profile, admins can update all
    return actor.id === user.id || actor.type === DefaultActorType.ADMIN;
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private generateId(): string {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

## Controller Implementation

```typescript
// user.controller.ts
import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete, 
  Body, 
  Param, 
  Req,
  UseGuards,
  HttpException,
  HttpStatus 
} from '@nestjs/common';
import { Request } from 'express';
import { IActor, DefaultActorType } from '@vytches-ddd/domain-primitives';
import { CreateUserDto, SuccessResponse, UserData } from './types';
import { UserService } from './user.service';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  async createUser(
    @Body() createUserDto: CreateUserDto,
    @Req() request: Request
  ): Promise<SuccessResponse<UserData>> {
    try {
      // ⭐ FOCUS: Manual actor creation from request context
      const actor = this.createActorFromRequest(request);
      return await this.userService.createUser(createUserDto, actor);
    } catch (error) {
      this.handleControllerError(error);
    }
  }

  @Get(':id')
  async getUser(
    @Param('id') userId: string,
    @Req() request: Request
  ): Promise<SuccessResponse<UserData>> {
    try {
      const actor = this.createActorFromRequest(request);
      return await this.userService.findUser(userId, actor);
    } catch (error) {
      this.handleControllerError(error);
    }
  }

  @Put(':id')
  async updateUser(
    @Param('id') userId: string,
    @Body() updateDto: Partial<CreateUserDto>,
    @Req() request: Request
  ): Promise<SuccessResponse<UserData>> {
    try {
      const actor = this.createActorFromRequest(request);
      return await this.userService.updateUser(userId, updateDto, actor);
    } catch (error) {
      this.handleControllerError(error);
    }
  }

  @Delete(':id')
  async deleteUser(
    @Param('id') userId: string,
    @Req() request: Request
  ): Promise<SuccessResponse<void>> {
    try {
      const actor = this.createActorFromRequest(request);
      return await this.userService.deleteUser(userId, actor);
    } catch (error) {
      this.handleControllerError(error);
    }
  }

  // ✅ FOCUS: Manual actor creation from HTTP request
  private createActorFromRequest(request: Request): IActor {
    // Extract user info from request (simplified)
    const authHeader = request.headers.authorization;
    const userAgent = request.headers['user-agent'];
    const ipAddress = request.ip;

    if (authHeader?.includes('Bearer')) {
      // Authenticated user
      const userId = this.extractUserIdFromToken(authHeader);
      const isAdmin = this.checkAdminRole(authHeader);
      
      return {
        type: isAdmin ? DefaultActorType.ADMIN : DefaultActorType.USER,
        id: userId,
        source: 'web-api',
        metadata: {
          userAgent,
          ipAddress,
          timestamp: new Date(),
          authMethod: 'bearer_token'
        }
      };
    } else {
      // Guest/anonymous request
      return {
        type: DefaultActorType.GUEST,
        id: 'anonymous',
        source: 'web-api',
        metadata: {
          userAgent,
          ipAddress,
          timestamp: new Date(),
          sessionId: request.session?.id || 'no-session'
        }
      };
    }
  }

  private extractUserIdFromToken(authHeader: string): string {
    // Simplified token parsing - in real apps, use JWT library
    const token = authHeader.replace('Bearer ', '');
    // Mock extraction
    return token.includes('admin') ? 'admin_123' : 'user_456';
  }

  private checkAdminRole(authHeader: string): boolean {
    // Simplified role check
    return authHeader.includes('admin');
  }

  private handleControllerError(error: unknown): never {
    if (error instanceof HttpException) {
      throw error;
    }
    
    // Unexpected errors
    throw new HttpException(
      'Internal server error',
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }
}
```

## Module Configuration

```typescript
// user.module.ts
import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';

@Module({
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
```

## Exception Filter for Domain Errors

```typescript
// domain-error.filter.ts
import { 
  ExceptionFilter, 
  Catch, 
  ArgumentsHost, 
  HttpStatus 
} from '@nestjs/common';
import { Response } from 'express';
import { IDomainError, DomainErrorCode } from '@vytches-ddd/domain-primitives';

@Catch(IDomainError)
export class DomainErrorFilter implements ExceptionFilter {
  catch(exception: IDomainError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    // ⭐ FOCUS: Convert domain errors to HTTP responses
    const status = this.mapDomainErrorToHttpStatus(exception.code);
    const errorResponse = {
      success: false,
      error: {
        code: exception.code,
        message: exception.message,
        domain: exception.domain,
        timestamp: new Date().toISOString(),
        details: exception.data
      }
    };

    response
      .status(status)
      .json(errorResponse);
  }

  private mapDomainErrorToHttpStatus(code: DomainErrorCode): HttpStatus {
    switch (code) {
      case DomainErrorCode.NotFound:
        return HttpStatus.NOT_FOUND;
      case DomainErrorCode.Unauthorized:
        return HttpStatus.FORBIDDEN;
      case DomainErrorCode.InvalidParameter:
      case DomainErrorCode.Duplicate:
        return HttpStatus.BAD_REQUEST;
      case DomainErrorCode.BusinessRule:
        return HttpStatus.UNPROCESSABLE_ENTITY;
      case DomainErrorCode.ExternalService:
        return HttpStatus.SERVICE_UNAVAILABLE;
      default:
        return HttpStatus.INTERNAL_SERVER_ERROR;
    }
  }
}
```

## Global Error Filter Registration

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { UserModule } from './user/user.module';
import { DomainErrorFilter } from './filters/domain-error.filter';

@Module({
  imports: [UserModule],
  providers: [
    {
      provide: APP_FILTER,
      useClass: DomainErrorFilter,
    },
  ],
})
export class AppModule {}
```

## Usage Example

```typescript
// Usage in a NestJS application
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Enable CORS if needed
  app.enableCors();
  
  await app.listen(3000);
  console.log('Application is running on: http://localhost:3000');
}

bootstrap();

// Example API calls:
// POST /users - Create user with automatic actor tracking
// GET /users/123 - Get user with permission checking
// PUT /users/123 - Update user with audit trail
// DELETE /users/123 - Delete user (admin only)
```

## Key Points

- **Manual Setup**: No dependency injection framework, direct instantiation
- **Domain Error Integration**: Convert domain errors to appropriate HTTP responses
- **Actor Tracking**: Manual actor creation from HTTP request context
- **Audit Trail**: Built-in audit logging for all operations
- **Permission Checking**: Role-based access control using actor information

## Benefits

- **Simple Integration**: Easy to understand and implement
- **Full Control**: Complete control over error handling and actor creation
- **Standard NestJS**: Uses standard NestJS patterns and decorators
- **Domain-First**: Business logic errors are handled at the domain level
- **Comprehensive Logging**: All actions are automatically audited

## Common Patterns

```typescript
// ✅ Good: Domain-first error handling
try {
  const result = await this.domainService.performAction(data, actor);
  return { success: true, data: result };
} catch (error) {
  this.handleDomainError(error);
  throw error;
}

// ✅ Good: Actor from request context
const actor = this.createActorFromRequest(request);
await this.service.performAction(data, actor);

// ✅ Good: Audit trail integration
await this.recordAuditEntry(actor, 'ACTION_NAME', resource, details);
```

## Next Steps

- Explore dependency injection patterns
- Add middleware for automatic actor injection
- Implement more sophisticated authentication
- Add integration with external audit systems
