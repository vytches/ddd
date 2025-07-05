import { Logger } from '@vytches-ddd/logging';
import { LogCommands, LogStateChanges } from '@vytches-ddd/logging/integration';
import { Result } from '@vytches-ddd/utils';

// Configure global logging
Logger.configure({
  level: 'debug',
  formatting: {
    colorize: true,
    prettyPrint: true,
  },
  masking: {
    enabled: true,
    sensitiveKeys: ['password', 'email', 'ssn'],
    replacement: '[MASKED]',
  },
});

// Example 1: Basic logging with smart context detection
class UserService {
  private logger = Logger.forContext(); // Auto-detects "UserService"

  async createUser(userData: { email: string; password: string }): Promise<Result<User, Error>> {
    this.logger.info('Creating user', {
      email: userData.email, // Will be masked
      hasPassword: !!userData.password,
    });

    try {
      // Simulate user creation
      const user: User = { id: '123', email: userData.email };

      this.logger.info('User created successfully', { userId: user.id });
      return Result.ok(user);
    } catch (error) {
      this.logger.error('User creation failed', error as Error, {
        email: userData.email,
      });
      return Result.fail(error as Error);
    }
  }
}

// Example 2: CQRS integration with decorators
interface CreateUserCommand {
  email: string;
  password: string;
}

interface User {
  id: string;
  email: string;
}

@LogCommands({ includePayload: true, logLevel: 'debug' })
class CreateUserCommandHandler {
  private userService = new UserService();

  async handle(command: CreateUserCommand): Promise<Result<User, Error>> {
    // Automatic logging of command execution
    return await this.userService.createUser(command);
  }
}

// Example 3: Aggregate with state change logging
class UserAggregate {
  private logger = Logger.forContext('UserAggregate');

  constructor(
    public readonly id: string,
    private email: string,
    private isActive = true
  ) {}

  @LogStateChanges({ logLevel: 'info', includeValues: true })
  changeEmail(newEmail: string): Result<void, Error> {
    const oldEmail = this.email;
    this.email = newEmail;

    this.logger.info('Email changed', {
      userId: this.id,
      oldEmail, // Will be masked
      newEmail, // Will be masked
    });

    return Result.ok();
  }

  @LogStateChanges({ logLevel: 'warn' })
  deactivate(): Result<void, Error> {
    if (!this.isActive) {
      return Result.fail(new Error('User already inactive'));
    }

    this.isActive = false;
    return Result.ok();
  }

  captureState(): { email: string; isActive: boolean } {
    return { email: this.email, isActive: this.isActive };
  }

  hasStateChanged(
    before: { email: string; isActive: boolean },
    after: { email: string; isActive: boolean }
  ): boolean {
    return JSON.stringify(before) !== JSON.stringify(after);
  }
}

// Example 4: Custom context and correlation
class OrderService {
  private logger: ReturnType<typeof Logger.forContext>;

  constructor(correlationId: string, userId?: string) {
    this.logger = Logger.forContext('OrderService')
      .withCorrelationId(correlationId)
      .withUserId(userId || 'anonymous')
      .withContext({ boundedContext: 'OrderManagement' });
  }

  async processOrder(orderId: string) {
    this.logger.info('Processing order', { orderId });

    // Simulate processing steps
    this.logger.debug('Validating order', { orderId, step: 'validation' });
    this.logger.debug('Calculating total', { orderId, step: 'calculation' });
    this.logger.debug('Processing payment', { orderId, step: 'payment' });

    this.logger.info('Order processed successfully', {
      orderId,
      processingTime: '1.2s',
    });
  }
}

// Example 5: Error handling with detailed logging
async function demonstrateErrorHandling() {
  const logger = Logger.forContext('ErrorDemo');

  try {
    throw new Error('Something went wrong');
  } catch (error) {
    logger.error('Unexpected error occurred', error as Error, {
      operation: 'demonstration',
      severity: 'high',
      shouldAlert: true,
    });
  }
}

// Run examples
async function runExamples() {
  const showcaseLogger = Logger.forContext('LoggingShowcase');

  showcaseLogger.info('🚀 DDD Logging Showcase');

  // Example 1: Basic usage
  showcaseLogger.info('1. Basic logging with context detection:');
  const userService = new UserService();
  await userService.createUser({
    email: 'user@example.com',
    password: 'secret123',
  });

  // Example 2: CQRS integration
  showcaseLogger.info('2. CQRS command logging:');
  const commandHandler = new CreateUserCommandHandler();
  await commandHandler.handle({
    email: 'admin@example.com',
    password: 'admin123',
  });

  // Example 3: Aggregate state changes
  showcaseLogger.info('3. Aggregate state change logging:');
  const user = new UserAggregate('user-123', 'old@example.com');
  user.changeEmail('new@example.com');
  user.deactivate();

  // Example 4: Custom context
  showcaseLogger.info('4. Custom context and correlation:');
  const orderService = new OrderService('req-789', 'user-456');
  await orderService.processOrder('order-999');

  // Example 5: Error handling
  showcaseLogger.info('5. Error handling:');
  await demonstrateErrorHandling();

  showcaseLogger.info('✅ All examples completed!');
}

runExamples().catch(error => {
  const errorLogger = Logger.forContext('ShowcaseRunner');
  errorLogger.error('Failed to run logging showcase', error);
});
