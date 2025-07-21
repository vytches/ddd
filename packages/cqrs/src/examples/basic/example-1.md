# Command Handlers with Automatic Registration

**Version**: 1.0.0  
**Package**: @vytches-ddd/cqrs  
**Complexity**: beginner  
**Domain**: User Management  
**Patterns**: command-handler, automatic-registration, mediator-pattern  
**Dependencies**: @vytches-ddd/cqrs, @vytches-ddd/di, @vytches-ddd/utils

## Description

Demonstrates the core CQRS command pattern with automatic handler registration. Shows how to create commands that modify application state and handlers that process them with validation, business logic, and error handling.

## Business Context

User management is a fundamental requirement in most applications. Commands like CreateUser, UpdateUser, and DeactivateUser represent business intentions that modify system state. The CQRS pattern ensures these operations are handled consistently with proper validation and business rule enforcement.

## Code Example

```typescript
// user-commands.ts
import { BaseCommand, CreateUserCommand, UpdateUserCommand, DeactivateUserCommand } from '../types';

/**
 * @llm-summary Command for creating new users in the system
 * @llm-domain User Management
 * @llm-complexity Simple
 * 
 * @description
 * Represents the business intention to create a new user account
 * with validation, business rules, and automatic handler processing.
 * 
 * @example
 * ```typescript
 * const command = new CreateUserCommand({
 *   email: 'user@example.com',
 *   name: 'John Doe',
 *   role: 'user'
 * });
 * 
 * const result = await commandBus.execute(command);
 * ```
 * 
 * @since 1.0.0
 * @public
 */
export class CreateUserCommand implements CreateUserCommand {
  public readonly commandId: string;
  public readonly timestamp: Date;
  
  constructor(
    public readonly email: string,
    public readonly name: string,
    public readonly role: 'admin' | 'user' | 'moderator',
    public readonly profile: UserProfile,
    public readonly userId?: string,
    public readonly correlationId?: string,
    public readonly initialPreferences?: Partial<UserPreferences>
  ) {
    this.commandId = `create-user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.timestamp = new Date();
  }

  /**
   * @llm-summary Validates command data for business rules
   * @llm-domain User Management
   * @llm-complexity Simple
   *
   * @description
   * Validates the command data against business rules and constraints
   * before processing by the handler.
   *
   * @returns Array of validation errors or empty array if valid
   *
   * @since 1.0.0
   * @public
   */
  validate(): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!this.email || !this.email.includes('@')) {
      errors.push({
        field: 'email',
        message: 'Valid email address is required',
        code: 'INVALID_EMAIL',
        value: this.email
      });
    }

    if (!this.name || this.name.trim().length < 2) {
      errors.push({
        field: 'name',
        message: 'Name must be at least 2 characters long',
        code: 'INVALID_NAME',
        value: this.name
      });
    }

    if (!['admin', 'user', 'moderator'].includes(this.role)) {
      errors.push({
        field: 'role',
        message: 'Role must be admin, user, or moderator',
        code: 'INVALID_ROLE',
        value: this.role
      });
    }

    return errors;
  }
}

/**
 * @llm-summary Command for updating existing user information
 * @llm-domain User Management
 * @llm-complexity Simple
 *
 * @description
 * Represents the business intention to update user information
 * with partial update support and optimistic concurrency control.
 *
 * @since 1.0.0
 * @public
 */
export class UpdateUserCommand implements UpdateUserCommand {
  public readonly commandId: string;
  public readonly timestamp: Date;

  constructor(
    public readonly userId: string,
    public readonly email?: string,
    public readonly name?: string,
    public readonly role?: 'admin' | 'user' | 'moderator',
    public readonly profile?: Partial<UserProfile>,
    public readonly preferences?: Partial<UserPreferences>,
    public readonly version?: number,
    public readonly correlationId?: string
  ) {
    this.commandId = `update-user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.timestamp = new Date();
  }

  validate(): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!this.userId) {
      errors.push({
        field: 'userId',
        message: 'User ID is required',
        code: 'MISSING_USER_ID',
        value: this.userId
      });
    }

    if (this.email && !this.email.includes('@')) {
      errors.push({
        field: 'email',
        message: 'Valid email address is required',
        code: 'INVALID_EMAIL',
        value: this.email
      });
    }

    if (this.name && this.name.trim().length < 2) {
      errors.push({
        field: 'name',
        message: 'Name must be at least 2 characters long',
        code: 'INVALID_NAME',
        value: this.name
      });
    }

    return errors;
  }

  /**
   * @llm-summary Checks if the command has any actual changes
   * @llm-domain User Management
   * @llm-complexity Simple
   *
   * @description
   * Determines if the command contains any actual data changes
   * to avoid unnecessary processing of empty updates.
   *
   * @returns True if command contains changes, false otherwise
   *
   * @since 1.0.0
   * @public
   */
  hasChanges(): boolean {
    return !!(this.email || this.name || this.role || this.profile || this.preferences);
  }
}

/**
 * @llm-summary Command for deactivating user accounts
 * @llm-domain User Management
 * @llm-complexity Simple
 *
 * @description
 * Represents the business intention to deactivate a user account
 * with audit trail and reason tracking.
 *
 * @since 1.0.0
 * @public
 */
export class DeactivateUserCommand implements DeactivateUserCommand {
  public readonly commandId: string;
  public readonly timestamp: Date;

  constructor(
    public readonly userId: string,
    public readonly reason: string,
    public readonly deactivatedBy: string,
    public readonly correlationId?: string
  ) {
    this.commandId = `deactivate-user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.timestamp = new Date();
  }

  validate(): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!this.userId) {
      errors.push({
        field: 'userId',
        message: 'User ID is required',
        code: 'MISSING_USER_ID',
        value: this.userId
      });
    }

    if (!this.reason || this.reason.trim().length < 10) {
      errors.push({
        field: 'reason',
        message: 'Deactivation reason must be at least 10 characters',
        code: 'INVALID_REASON',
        value: this.reason
      });
    }

    if (!this.deactivatedBy) {
      errors.push({
        field: 'deactivatedBy',
        message: 'Deactivated by user ID is required',
        code: 'MISSING_DEACTIVATED_BY',
        value: this.deactivatedBy
      });
    }

    return errors;
  }
}
```

```typescript
// user-command-handlers.ts
import { CommandHandler } from '@vytches-ddd/cqrs';
import { Result } from '@vytches-ddd/utils';
import { 
  CreateUserCommand, 
  UpdateUserCommand, 
  DeactivateUserCommand,
  User,
  CommandResult 
} from '../types';

/**
 * @llm-summary Command handler for creating new users
 * @llm-domain User Management
 * @llm-complexity Simple
 *
 * @description
 * Handles CreateUser commands with validation, business logic, and
 * persistence. Automatically registered through decorator and DI system.
 *
 * @example
 * ```typescript
 * // Handler is automatically discovered and registered
 * @CommandHandler(CreateUserCommand)
 * class CreateUserCommandHandler {
 *   async handle(command: CreateUserCommand): Promise<CommandResult<User>>
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
@CommandHandler(CreateUserCommand, {
  autoRegister: true,
  timeout: 10000,
  enableMetrics: true
})
export class CreateUserCommandHandler {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly emailService: EmailService
  ) {}

  /**
   * @llm-summary Handles user creation with validation and business rules
   * @llm-domain User Management
   * @llm-complexity Simple
   *
   * @description
   * Processes CreateUser command by validating data, checking business rules,
   * creating the user entity, and sending welcome notifications.
   *
   * @param command - CreateUser command with user data
   * @returns Promise with command result containing created user or errors
   *
   * @example
   * ```typescript
   * const command = new CreateUserCommand(
   *   'user@example.com',
   *   'John Doe', 
   *   'user',
   *   profile
   * );
   * 
   * const result = await handler.handle(command);
   * if (result.success) {
   *   console.log('User created:', result.result?.id);
   * }
   * ```
   *
   * @since 1.0.0
   * @public
   */
  async handle(command: CreateUserCommand): Promise<CommandResult<User>> {
    try {
      console.log(`👤 Processing CreateUser command: ${command.commandId}`);

      // 1. Validate command data
      const validationErrors = command.validate();
      if (validationErrors.length > 0) {
        return {
          success: false,
          validationErrors,
          error: 'Command validation failed'
        };
      }

      // 2. Check business rules
      const businessValidation = await this.validateBusinessRules(command);
      if (!businessValidation.success) {
        return {
          success: false,
          error: businessValidation.error,
          validationErrors: businessValidation.validationErrors
        };
      }

      // 3. Create user entity
      const user = await this.createUserEntity(command);

      // 4. Persist user
      const saveResult = await this.userRepository.save(user);
      if (!saveResult.success) {
        return {
          success: false,
          error: 'Failed to save user',
          metadata: { repositoryError: saveResult.error }
        };
      }

      // 5. Send welcome email (async, don't wait)
      this.sendWelcomeEmailAsync(user.email, user.name);

      console.log(`✅ User created successfully: ${user.id}`);

      return {
        success: true,
        result: user,
        metadata: {
          commandId: command.commandId,
          timestamp: command.timestamp,
          correlationId: command.correlationId
        }
      };

    } catch (error) {
      console.error(`❌ Failed to create user:`, error);
      
      return {
        success: false,
        error: `User creation failed: ${error.message}`,
        metadata: {
          commandId: command.commandId,
          errorType: error.constructor.name,
          stack: error.stack
        }
      };
    }
  }

  /**
   * @llm-summary Validates business rules for user creation
   * @llm-domain User Management
   * @llm-complexity Simple
   *
   * @description
   * Checks business rules like email uniqueness, role permissions,
   * and domain-specific constraints.
   *
   * @param command - CreateUser command to validate
   * @returns Promise with validation result
   *
   * @since 1.0.0
   * @private
   */
  private async validateBusinessRules(command: CreateUserCommand): Promise<CommandResult<void>> {
    const errors: ValidationError[] = [];

    // Check email uniqueness
    const existingUser = await this.userRepository.findByEmail(command.email);
    if (existingUser) {
      errors.push({
        field: 'email',
        message: 'Email address is already in use',
        code: 'EMAIL_ALREADY_EXISTS',
        value: command.email
      });
    }

    // Validate admin role creation (requires elevated permissions)
    if (command.role === 'admin' && !command.userId) {
      errors.push({
        field: 'role',
        message: 'Admin users can only be created by existing admins',
        code: 'INSUFFICIENT_PERMISSIONS',
        value: command.role
      });
    }

    // Check profile completeness for certain roles
    if (command.role === 'moderator' && (!command.profile.bio || command.profile.bio.length < 20)) {
      errors.push({
        field: 'profile.bio',
        message: 'Moderators must provide a bio of at least 20 characters',
        code: 'INCOMPLETE_MODERATOR_PROFILE',
        value: command.profile.bio
      });
    }

    if (errors.length > 0) {
      return {
        success: false,
        validationErrors: errors,
        error: 'Business rule validation failed'
      };
    }

    return { success: true };
  }

  /**
   * @llm-summary Creates user entity from command data
   * @llm-domain User Management
   * @llm-complexity Simple
   *
   * @description
   * Constructs a complete user entity with default values,
   * calculated fields, and proper initialization.
   *
   * @param command - CreateUser command with user data
   * @returns Promise with created user entity
   *
   * @since 1.0.0
   * @private
   */
  private async createUserEntity(command: CreateUserCommand): Promise<User> {
    const userId = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    const defaultPreferences: UserPreferences = {
      notifications: {
        email: true,
        sms: false,
        push: true
      },
      language: 'en',
      timezone: 'UTC',
      theme: 'auto',
      ...command.initialPreferences
    };

    const user: User = {
      id: userId,
      email: command.email,
      name: command.name,
      role: command.role,
      status: 'active',
      profile: {
        firstName: command.profile.firstName,
        lastName: command.profile.lastName,
        bio: command.profile.bio,
        location: command.profile.location,
        phoneNumber: command.profile.phoneNumber
      },
      preferences: defaultPreferences,
      createdAt: now,
      version: 1
    };

    return user;
  }

  /**
   * @llm-summary Sends welcome email asynchronously
   * @llm-domain User Management
   * @llm-complexity Simple
   *
   * @description
   * Sends welcome email without blocking the command processing.
   * Errors are logged but don't affect command success.
   *
   * @param email - User email address
   * @param name - User name for personalization
   *
   * @since 1.0.0
   * @private
   */
  private sendWelcomeEmailAsync(email: string, name: string): void {
    // Fire and forget - don't await
    this.emailService.sendWelcomeEmail(email, name)
      .then(() => console.log(`📧 Welcome email sent to ${email}`))
      .catch(error => console.error(`❌ Failed to send welcome email to ${email}:`, error));
  }
}

/**
 * @llm-summary Command handler for updating existing users
 * @llm-domain User Management
 * @llm-complexity Simple
 *
 * @description
 * Handles UpdateUser commands with optimistic concurrency control,
 * partial updates, and change detection.
 *
 * @since 1.0.0
 * @public
 */
@CommandHandler(UpdateUserCommand, {
  autoRegister: true,
  timeout: 8000,
  enableMetrics: true
})
export class UpdateUserCommandHandler {
  constructor(private readonly userRepository: UserRepository) {}

  /**
   * @llm-summary Handles user updates with concurrency control
   * @llm-domain User Management
   * @llm-complexity Simple
   *
   * @description
   * Processes UpdateUser command with optimistic concurrency control,
   * partial update logic, and change detection.
   *
   * @param command - UpdateUser command with changes
   * @returns Promise with command result containing updated user
   *
   * @since 1.0.0
   * @public
   */
  async handle(command: UpdateUserCommand): Promise<CommandResult<User>> {
    try {
      console.log(`🔄 Processing UpdateUser command: ${command.commandId}`);

      // 1. Validate command
      const validationErrors = command.validate();
      if (validationErrors.length > 0) {
        return {
          success: false,
          validationErrors,
          error: 'Command validation failed'
        };
      }

      // 2. Check if command has changes
      if (!command.hasChanges()) {
        return {
          success: false,
          error: 'No changes provided in update command'
        };
      }

      // 3. Load existing user
      const existingUser = await this.userRepository.findById(command.userId);
      if (!existingUser) {
        return {
          success: false,
          error: `User not found: ${command.userId}`
        };
      }

      // 4. Check version for optimistic concurrency
      if (command.version && existingUser.version !== command.version) {
        return {
          success: false,
          error: 'Concurrency conflict - user was modified by another process',
          metadata: {
            expectedVersion: command.version,
            currentVersion: existingUser.version
          }
        };
      }

      // 5. Apply updates
      const updatedUser = this.applyUpdates(existingUser, command);

      // 6. Save updated user
      const saveResult = await this.userRepository.save(updatedUser);
      if (!saveResult.success) {
        return {
          success: false,
          error: 'Failed to save user updates',
          metadata: { repositoryError: saveResult.error }
        };
      }

      console.log(`✅ User updated successfully: ${updatedUser.id}`);

      return {
        success: true,
        result: updatedUser,
        metadata: {
          commandId: command.commandId,
          previousVersion: existingUser.version,
          newVersion: updatedUser.version
        }
      };

    } catch (error) {
      console.error(`❌ Failed to update user:`, error);
      
      return {
        success: false,
        error: `User update failed: ${error.message}`,
        metadata: {
          commandId: command.commandId,
          userId: command.userId
        }
      };
    }
  }

  /**
   * @llm-summary Applies updates to existing user entity
   * @llm-domain User Management
   * @llm-complexity Simple
   *
   * @description
   * Merges command updates with existing user data while
   * preserving unchanged fields and updating version.
   *
   * @param existingUser - Current user entity
   * @param command - Update command with changes
   * @returns Updated user entity
   *
   * @since 1.0.0
   * @private
   */
  private applyUpdates(existingUser: User, command: UpdateUserCommand): User {
    const updatedUser: User = {
      ...existingUser,
      email: command.email ?? existingUser.email,
      name: command.name ?? existingUser.name,
      role: command.role ?? existingUser.role,
      profile: {
        ...existingUser.profile,
        ...command.profile
      },
      preferences: {
        ...existingUser.preferences,
        ...command.preferences
      },
      updatedAt: new Date(),
      version: existingUser.version + 1
    };

    return updatedUser;
  }
}

/**
 * @llm-summary Command handler for deactivating users
 * @llm-domain User Management  
 * @llm-complexity Simple
 *
 * @description
 * Handles DeactivateUser commands with audit logging,
 * cleanup operations, and notification processes.
 *
 * @since 1.0.0
 * @public
 */
@CommandHandler(DeactivateUserCommand, {
  autoRegister: true,
  timeout: 15000,
  enableMetrics: true
})
export class DeactivateUserCommandHandler {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly auditService: AuditService,
    private readonly cleanupService: CleanupService
  ) {}

  /**
   * @llm-summary Handles user deactivation with cleanup and audit
   * @llm-domain User Management
   * @llm-complexity Simple
   *
   * @description
   * Processes DeactivateUser command with status change, audit logging,
   * and cleanup of user-related resources.
   *
   * @param command - DeactivateUser command with reason and audit info
   * @returns Promise with command result
   *
   * @since 1.0.0
   * @public
   */
  async handle(command: DeactivateUserCommand): Promise<CommandResult<User>> {
    try {
      console.log(`🚫 Processing DeactivateUser command: ${command.commandId}`);

      // 1. Validate command
      const validationErrors = command.validate();
      if (validationErrors.length > 0) {
        return {
          success: false,
          validationErrors,
          error: 'Command validation failed'
        };
      }

      // 2. Load user
      const user = await this.userRepository.findById(command.userId);
      if (!user) {
        return {
          success: false,
          error: `User not found: ${command.userId}`
        };
      }

      // 3. Check if already deactivated
      if (user.status === 'inactive' || user.status === 'suspended') {
        return {
          success: false,
          error: `User is already ${user.status}`,
          metadata: { currentStatus: user.status }
        };
      }

      // 4. Deactivate user
      const deactivatedUser: User = {
        ...user,
        status: 'inactive',
        updatedAt: new Date(),
        version: user.version + 1
      };

      // 5. Save deactivated user
      const saveResult = await this.userRepository.save(deactivatedUser);
      if (!saveResult.success) {
        return {
          success: false,
          error: 'Failed to deactivate user',
          metadata: { repositoryError: saveResult.error }
        };
      }

      // 6. Create audit log
      await this.auditService.logUserDeactivation(
        command.userId,
        command.reason,
        command.deactivatedBy,
        command.correlationId
      );

      // 7. Trigger cleanup (async)
      this.cleanupService.cleanupUserResources(command.userId)
        .catch(error => console.error(`❌ Cleanup failed for user ${command.userId}:`, error));

      console.log(`✅ User deactivated successfully: ${command.userId}`);

      return {
        success: true,
        result: deactivatedUser,
        metadata: {
          commandId: command.commandId,
          reason: command.reason,
          deactivatedBy: command.deactivatedBy
        }
      };

    } catch (error) {
      console.error(`❌ Failed to deactivate user:`, error);
      
      return {
        success: false,
        error: `User deactivation failed: ${error.message}`,
        metadata: {
          commandId: command.commandId,
          userId: command.userId
        }
      };
    }
  }
}

// Example services (simplified interfaces)
interface UserRepository {
  save(user: User): Promise<{ success: boolean; error?: string }>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
}

interface EmailService {
  sendWelcomeEmail(email: string, name: string): Promise<void>;
}

interface AuditService {
  logUserDeactivation(userId: string, reason: string, deactivatedBy: string, correlationId?: string): Promise<void>;
}

interface CleanupService {
  cleanupUserResources(userId: string): Promise<void>;
}
```

```typescript
// command-bus-setup.ts
import { CommandBus } from '@vytches-ddd/cqrs';
import { VytchesDDD } from '@vytches-ddd/di';
import { 
  CreateUserCommandHandler,
  UpdateUserCommandHandler,
  DeactivateUserCommandHandler 
} from '../types';

/**
 * @llm-summary Command bus setup with automatic handler registration
 * @llm-domain System Configuration
 * @llm-complexity Simple
 *
 * @description
 * Demonstrates setup of command bus with automatic handler discovery
 * and registration through the dependency injection system.
 *
 * @example
 * ```typescript
 * const commandBus = await setupCommandBus();
 * const result = await commandBus.execute(new CreateUserCommand(...));
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class CommandBusSetup {
  private commandBus: CommandBus;

  constructor() {
    this.commandBus = new CommandBus();
  }

  /**
   * @llm-summary Initializes command bus with automatic handler registration
   * @llm-domain System Configuration
   * @llm-complexity Simple
   *
   * @description
   * Sets up command bus and registers all command handlers automatically
   * through dependency injection and decorator discovery.
   *
   * @returns Promise that resolves when setup is complete
   *
   * @since 1.0.0
   * @public
   */
  async initialize(): Promise<void> {
    try {
      // Register command bus with DI container
      VytchesDDD.registerInstance('commandBus', this.commandBus);

      // Register handler dependencies (normally auto-discovered)
      VytchesDDD.registerInstance('userRepository', new InMemoryUserRepository());
      VytchesDDD.registerInstance('emailService', new MockEmailService());
      VytchesDDD.registerInstance('auditService', new MockAuditService());
      VytchesDDD.registerInstance('cleanupService', new MockCleanupService());

      // Register command handlers (normally auto-discovered)
      VytchesDDD.registerInstance('createUserCommandHandler', new CreateUserCommandHandler(
        VytchesDDD.resolve('userRepository'),
        VytchesDDD.resolve('emailService')
      ));
      
      VytchesDDD.registerInstance('updateUserCommandHandler', new UpdateUserCommandHandler(
        VytchesDDD.resolve('userRepository')
      ));
      
      VytchesDDD.registerInstance('deactivateUserCommandHandler', new DeactivateUserCommandHandler(
        VytchesDDD.resolve('userRepository'),
        VytchesDDD.resolve('auditService'),
        VytchesDDD.resolve('cleanupService')
      ));

      // Configure auto-discovery (in real applications)
      await VytchesDDD.configure();

      console.log('✅ Command bus initialized with handlers:');
      console.log('  - CreateUserCommandHandler');
      console.log('  - UpdateUserCommandHandler');
      console.log('  - DeactivateUserCommandHandler');

    } catch (error) {
      console.error('❌ Failed to initialize command bus:', error);
      throw error;
    }
  }

  /**
   * @llm-summary Gets the configured command bus for command execution
   * @llm-domain System Configuration
   * @llm-complexity Simple
   *
   * @description
   * Provides access to the configured command bus for executing
   * commands in application services or controllers.
   *
   * @returns Configured CommandBus instance
   *
   * @since 1.0.0
   * @public
   */
  getCommandBus(): CommandBus {
    return this.commandBus;
  }
}

// Demonstration usage
async function demonstrateCommandHandling(): Promise<void> {
  console.log('🚀 Setting up command bus...');
  
  const setup = new CommandBusSetup();
  await setup.initialize();
  
  const commandBus = setup.getCommandBus();
  
  console.log('\n👤 Creating user...');
  
  // Create user command
  const createCommand = new CreateUserCommand(
    'john.doe@example.com',
    'John Doe',
    'user',
    {
      firstName: 'John',
      lastName: 'Doe',
      bio: 'Software developer with passion for clean code',
      location: 'San Francisco, CA'
    }
  );

  const createResult = await commandBus.execute(createCommand);
  
  if (createResult.success) {
    console.log('✅ User created successfully:', createResult.result?.id);
    
    const userId = createResult.result!.id;
    
    console.log('\n🔄 Updating user...');
    
    // Update user command
    const updateCommand = new UpdateUserCommand(
      userId,
      undefined, // email unchanged
      'John Smith', // name change
      undefined, // role unchanged
      { bio: 'Senior software developer and tech lead' }, // profile update
      { theme: 'dark' }, // preference update
      1 // version for optimistic concurrency
    );

    const updateResult = await commandBus.execute(updateCommand);
    
    if (updateResult.success) {
      console.log('✅ User updated successfully');
      
      console.log('\n🚫 Deactivating user...');
      
      // Deactivate user command
      const deactivateCommand = new DeactivateUserCommand(
        userId,
        'User requested account deletion',
        'admin-123'
      );

      const deactivateResult = await commandBus.execute(deactivateCommand);
      
      if (deactivateResult.success) {
        console.log('✅ User deactivated successfully');
      } else {
        console.error('❌ Failed to deactivate user:', deactivateResult.error);
      }
    } else {
      console.error('❌ Failed to update user:', updateResult.error);
    }
  } else {
    console.error('❌ Failed to create user:', createResult.error);
    console.error('Validation errors:', createResult.validationErrors);
  }
}
```

## Key Features

- **🎯 Automatic Registration**: Command handlers automatically discovered and registered through decorators
- **📝 Built-in Validation**: Commands include validation logic executed before handler processing
- **🛡️ Error Handling**: Comprehensive error handling with structured error responses
- **⚡ Performance Monitoring**: Built-in metrics and timing for command execution
- **🔄 Concurrency Control**: Optimistic concurrency control with version checking
- **📊 Audit Support**: Structured logging and audit trail generation

## Command Design Patterns

1. **Self-Validating Commands**: Commands contain their own validation logic
2. **Immutable Commands**: Command properties are readonly after construction
3. **Rich Command Objects**: Commands include metadata like timestamps and correlation IDs
4. **Business Intent**: Command names clearly express business intentions

## Common Pitfalls

- **❌ Large Command Objects**: Keep commands focused on single business operations
- **❌ Missing Validation**: Always validate commands before processing
- **❌ Shared State**: Commands should be immutable and not share state
- **❌ Complex Logic in Commands**: Business logic belongs in handlers, not commands

## Related Examples

- [Example 2: Query Handlers](./example-2.md) - Query handling for data retrieval
- [Example 3: Middleware Pipeline](./example-3.md) - Cross-cutting concerns with middleware
- [Intermediate: Event Integration](../intermediate/example-1.md) - Commands that trigger events