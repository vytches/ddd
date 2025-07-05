# Natural Framework Integration

This document shows how to use VytchesDDD naturally with existing DI frameworks, preserving their patterns while enabling VytchesDDD capabilities.

## The Right Way: Natural Constructor Injection

### NestJS Integration

```typescript
// User service uses natural NestJS DI
@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly emailService: EmailService,
    private readonly commandBus: ICommandBus  // VytchesDDD component
  ) {}

  async createUser(userData: CreateUserDto): Promise<User> {
    // Natural dependency injection - no service locator needed
    const user = await this.userRepository.save(new User(userData));
    await this.emailService.sendWelcomeEmail(user.email);
    
    // VytchesDDD command bus can use service locator internally
    await this.commandBus.execute(new UserCreatedCommand(user.id));
    
    return user;
  }
}

// VytchesDDD Command Handler - this can use service locator internally
@CommandHandler(CreateUserCommand)
export class CreateUserCommandHandler implements ICommandHandler<CreateUserCommand> {
  // Option 1: Natural NestJS injection (preferred)
  constructor(
    private readonly userService: UserService,
    private readonly eventBus: IEventBus
  ) {}

  async handle(command: CreateUserCommand): Promise<void> {
    const user = await this.userService.createUser(command.userData);
    
    // Publish domain event
    await this.eventBus.publish(new UserCreatedEvent(user));
  }
}

// Alternative: VytchesDDD can resolve dependencies internally when needed
@CommandHandler(ProcessOrderCommand)
export class ProcessOrderCommandHandler implements ICommandHandler<ProcessOrderCommand> {
  async handle(command: ProcessOrderCommand): Promise<void> {
    // VytchesDDD resolves these internally, not in user code
    const orderService = VytchesDDD.resolve<OrderService>('OrderService');
    const paymentService = VytchesDDD.resolve<PaymentService>('PaymentService');
    
    await orderService.process(command.orderId);
    await paymentService.charge(command.amount);
  }
}
```

### Module Setup

```typescript
// app.module.ts
@Module({
  imports: [
    // Import VytchesDDD integration
    VytchesDDDModule,
    
    // Your domain modules
    UserModule,
    OrderModule
  ]
})
export class AppModule {}

// user.module.ts
@Module({
  providers: [
    UserService,
    UserRepository,
    EmailService,
    
    // Phase 1: Manual handler registration required
    CreateUserCommandHandler,
    
    // Register VytchesDDD components with NestJS
    {
      provide: 'ICommandBus',
      useClass: CommandBus
    },
    {
      provide: 'IEventBus', 
      useClass: EventBus
    },
    
    // Phase 1: Manual token registration for service locator
    {
      provide: 'CreateUserCommandHandler',
      useClass: CreateUserCommandHandler
    },
    {
      provide: 'OrderService',
      useExisting: OrderService  // Reference existing NestJS service
    },
    {
      provide: 'PaymentService', 
      useExisting: PaymentService
    }
  ],
  exports: [UserService]
})
export class UserModule {
  constructor() {
    // Phase 1: Manual CommandBus handler registration
    this.setupCommandHandlers();
  }

  private setupCommandHandlers(): void {
    // In Phase 1, CommandBus needs manual handler registration
    // Phase 2 will auto-discover through @CommandHandler decorator scanning
    const commandBus = VytchesDDD.resolve<ICommandBus>('ICommandBus');
    
    // Manual registration - Phase 2 will automate this
    commandBus.registerHandler('CreateUserCommand', 'CreateUserCommandHandler');
    commandBus.registerHandler('ProcessOrderCommand', 'ProcessOrderCommandHandler');
  }
}
```

## ⚠️ Phase 1 vs Phase 2 Reality

### Current State (Phase 1)
- ❌ **No auto-discovery** - handlers must be manually registered
- ✅ **Manual registration** - explicit provider registration required
- ✅ **Service locator works** - VytchesDDD.resolve() functional
- ✅ **Context isolation works** - configureContext() functional

### Coming in Phase 2
- ✅ **Auto-discovery** - @CommandHandler decorator scanning
- ✅ **Metadata-based registration** - automatic handler registration
- ✅ **Enhanced decorators** - options for context, timeout, middleware

### Phase 1 Manual Setup Required

```typescript
// Phase 1: You must manually register everything
@Module({
  providers: [
    CreateUserCommandHandler,  // 1. Register with NestJS
    {
      provide: 'CreateUserCommandHandler',  // 2. Register token for service locator
      useClass: CreateUserCommandHandler
    }
  ]
})
export class UserModule {
  constructor() {
    // 3. Manual CommandBus registration
    const commandBus = VytchesDDD.resolve<ICommandBus>('ICommandBus');
    commandBus.registerHandler('CreateUserCommand', 'CreateUserCommandHandler');
  }
}
```

### Phase 2 Auto-Discovery (Future)

```typescript
// Phase 2: Just use the decorator - everything else is automatic
@CommandHandler(CreateUserCommand)
export class CreateUserCommandHandler {
  // Automatically discovered and registered!
}

@Module({
  providers: [
    CreateUserCommandHandler  // Only NestJS registration needed
  ]
})
export class UserModule {
  // No manual setup required - auto-discovery handles everything!
}
```

## Key Principles

### 1. Application Services: Natural DI
Your application services should use the framework's natural DI patterns:

```typescript
// ✅ Good: Natural NestJS patterns
@Injectable()
export class OrderService {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly paymentService: PaymentService,
    private readonly commandBus: ICommandBus
  ) {}
}

// ❌ Bad: Service locator in application code
@Injectable() 
export class OrderService {
  async processOrder() {
    const repository = VytchesDDD.resolve<OrderRepository>('OrderRepository');
    const payment = VytchesDDD.resolve<PaymentService>('PaymentService');
  }
}
```

### 2. VytchesDDD Components: Can Use Service Locator
VytchesDDD's internal components (handlers, domain services) can use service locator when it makes sense:

```typescript
// ✅ Acceptable: VytchesDDD command handler using service locator
@CommandHandler(ComplexBusinessCommand)
export class ComplexBusinessCommandHandler {
  async handle(command: ComplexBusinessCommand): Promise<void> {
    // When you need many services, service locator can be cleaner
    const serviceA = VytchesDDD.resolve<ServiceA>('ServiceA');
    const serviceB = VytchesDDD.resolve<ServiceB>('ServiceB');
    const serviceC = VytchesDDD.resolve<ServiceC>('ServiceC');
    
    // Complex business logic...
  }
}

// ✅ Also good: Constructor injection for VytchesDDD handlers
@CommandHandler(SimpleBusinessCommand)
export class SimpleBusinessCommandHandler {
  constructor(
    private readonly domainService: DomainService,
    private readonly repository: Repository
  ) {}
  
  async handle(command: SimpleBusinessCommand): Promise<void> {
    // Simple business logic
  }
}
```

### 3. Context Isolation for Domain Boundaries

```typescript
// Order Context Module
@Module({
  providers: [
    OrderService,
    OrderRepository,
    
    // Order-specific implementations
    {
      provide: 'PaymentProcessor',
      useClass: StripePaymentProcessor // Order context uses Stripe
    }
  ]
})
export class OrderModule {
  constructor() {
    // Configure order context container
    const orderContainer = new SimpleContainer();
    orderContainer.registerInstance('PaymentProcessor', new StripePaymentProcessor());
    
    VytchesDDD.configureContext('OrderManagement', orderContainer);
  }
}

// User Context Module  
@Module({
  providers: [
    UserService,
    UserRepository,
    
    // User-specific implementations
    {
      provide: 'PaymentProcessor', 
      useClass: PayPalPaymentProcessor // User context uses PayPal
    }
  ]
})
export class UserModule {
  constructor() {
    // Configure user context container
    const userContainer = new SimpleContainer();
    userContainer.registerInstance('PaymentProcessor', new PayPalPaymentProcessor());
    
    VytchesDDD.configureContext('UserManagement', userContainer);
  }
}

// Context-aware handler
@CommandHandler(ProcessPaymentCommand, { context: 'OrderManagement' })
export class ProcessPaymentCommandHandler {
  async handle(command: ProcessPaymentCommand): Promise<void> {
    // This will resolve StripePaymentProcessor because we're in OrderManagement context
    const processor = VytchesDDD.resolve<PaymentProcessor>('PaymentProcessor', 'OrderManagement');
    await processor.process(command.amount);
  }
}
```

## Framework-Specific Patterns

### InversifyJS Integration

```typescript
// container.config.ts
const container = new Container();

// Register your services naturally
container.bind<UserService>('UserService').to(UserService);
container.bind<EmailService>('EmailService').to(EmailService);

// Register VytchesDDD components
container.bind<ICommandBus>('ICommandBus').to(CommandBus);
container.bind<IEventBus>('IEventBus').to(EventBus);

// Configure VytchesDDD to use Inversify for internal resolution
const adapter = new InversifyContainerAdapter(container);
VytchesDDD.configure(adapter);

// Your services use natural Inversify patterns
@injectable()
export class UserService {
  constructor(
    @inject('UserRepository') private userRepository: UserRepository,
    @inject('EmailService') private emailService: EmailService,
    @inject('ICommandBus') private commandBus: ICommandBus
  ) {}
}
```

### Express + TSyringe Integration

```typescript
// di-setup.ts
import { container } from 'tsyringe';

// Register your services
container.registerSingleton<UserService>('UserService', UserService);
container.registerSingleton<EmailService>('EmailService', EmailService);

// Register VytchesDDD components
container.registerSingleton<ICommandBus>('ICommandBus', CommandBus);

// Configure VytchesDDD
const adapter = new TSyringeContainerAdapter(container);
VytchesDDD.configure(adapter);

// Express controller uses natural TSyringe injection
@injectable()
export class UserController {
  constructor(
    @inject('UserService') private userService: UserService,
    @inject('ICommandBus') private commandBus: ICommandBus
  ) {}
  
  async createUser(req: Request, res: Response): Promise<void> {
    const user = await this.userService.createUser(req.body);
    await this.commandBus.execute(new UserCreatedCommand(user.id));
    res.json(user);
  }
}
```

## Best Practices Summary

### ✅ Do This

1. **Use framework's natural DI for application services**
2. **Register VytchesDDD components with your DI container** 
3. **Let VytchesDDD use service locator internally for its components**
4. **Use context isolation for true domain boundaries**
5. **Prefer constructor injection over service locator in your code**

### ❌ Don't Do This

1. **Don't use VytchesDDD.resolve() in your application services**
2. **Don't bypass your framework's DI container**
3. **Don't mix service locator with constructor injection randomly**
4. **Don't use global service locator for everything**

## Migration Strategy

### Phase 1: Add VytchesDDD Components
```typescript
// Keep existing services unchanged
@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository, // Keep natural DI
    private readonly emailService: EmailService      // Keep natural DI  
  ) {}
}

// Add VytchesDDD command bus
@Injectable() 
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly commandBus: ICommandBus  // Add VytchesDDD component
  ) {}
}
```

### Phase 2: Move Complex Logic to Handlers
```typescript
// Extract complex business logic to command handlers
@CommandHandler(CreateUserCommand)
export class CreateUserCommandHandler {
  constructor(private readonly userService: UserService) {}
  
  async handle(command: CreateUserCommand): Promise<void> {
    // Business logic here
  }
}

// Simplify controller
@Controller()
export class UserController {
  constructor(private readonly commandBus: ICommandBus) {}
  
  async createUser(req: Request): Promise<void> {
    await this.commandBus.execute(new CreateUserCommand(req.body));
  }
}
```

This approach preserves the natural patterns of each framework while enabling VytchesDDD's advanced capabilities where they add value.
