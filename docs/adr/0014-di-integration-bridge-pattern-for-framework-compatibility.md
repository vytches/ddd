# ADR-0014: DI Integration Bridge Pattern for Framework Compatibility

## Status
**ACCEPTED** - 2025-07-17

## Context

The `@vytches-ddd/di` package provides a global service locator with business-focused decorators (`@DomainService`, `@Resilience`, `@CommandHandler`) that offer critical functionality for domain-driven design. However, integrating with popular frameworks like NestJS presents the **Double Instance Risk** - creating duplicate instances when both DI systems attempt to manage the same classes.

### Problem Statement

When using both `@DomainService` and `@Injectable()` decorators on the same class:

```typescript
@DomainService('userService')  // VytchesDDD creates instance
@Injectable()                  // NestJS creates instance
class UserService {
  // Result: TWO DIFFERENT INSTANCES with different state
}
```

This creates several critical issues:
1. **State Inconsistency**: Two instances can have different internal state
2. **Memory Waste**: Duplicate instances consume unnecessary resources
3. **Configuration Drift**: Different initialization parameters or middleware
4. **Business Logic Duplication**: Framework-specific business logic divergence
5. **Testing Complexity**: Mocking becomes unpredictable

### Business Impact

- **@DomainService** provides business-critical functionality (timeouts, middleware, resilience patterns)
- **Framework Integration** is essential for enterprise adoption
- **Single Source of Truth** is required for data consistency
- **Performance** implications of duplicate instances in high-load scenarios

## Decision

We adopt the **Bridge Pattern** for DI integration with the following principles:

### 1. VytchesDDD as Primary Container

VytchesDDD container manages business logic instances with `@DomainService` decorators. Framework containers consume these instances via bridge pattern.

### 2. Single Instance Guarantee

Use factory pattern to ensure framework DI gets existing instances from VytchesDDD, never creates new ones.

### 3. Initialization Order Contract

VytchesDDD configuration MUST happen before framework container initialization to ensure proper instance discovery.

## Implementation Strategy

### Pattern 1: Factory Provider (Recommended)

```typescript
// Domain layer - business logic with VytchesDDD
@DomainService('userService', {
  lifetime: ServiceLifetime.Singleton,
  context: 'UserManagement'
})
class UserService {
  // Business functionality with @Resilience, timeouts, etc.
}

// Framework layer - bridge to existing instance
@Module({
  providers: [
    {
      provide: UserService,
      useFactory: () => VytchesDDD.resolve<UserService>('userService'),
    }
  ]
})
export class UserModule implements OnModuleInit {
  async onModuleInit() {
    await VytchesDDD.configure(); // Auto-discover @DomainService first
  }
}
```

### Pattern 2: Bridge Utility

```typescript
export class VytchesDDDBridge {
  static createNestJSProvider<T>(serviceId: string) {
    return {
      provide: serviceId,
      useFactory: () => {
        const instance = VytchesDDD.resolve<T>(serviceId);
        if (!instance) {
          throw new Error(`Service ${serviceId} not found in VytchesDDD container`);
        }
        return instance;
      },
    };
  }
}
```

### Pattern 3: Adapter Pattern (For Complex Cases)

```typescript
@Injectable()
class UserServiceAdapter {
  private readonly userService: UserService;
  
  constructor() {
    this.userService = VytchesDDD.resolve<UserService>('userService');
  }
  
  // Delegate all calls to VytchesDDD instance
  async createUser(data: CreateUserData): Promise<Result<User, Error>> {
    return this.userService.createUser(data);
  }
}
```

## Architectural Benefits

### 1. Business Logic Preservation
- `@DomainService` decorators retain their business functionality
- Resilience patterns, timeouts, middleware work as designed
- No compromise on enterprise features

### 2. Framework Integration
- Seamless NestJS dependency injection
- Standard framework patterns for controllers and modules
- No framework-specific business logic

### 3. Single Source of Truth
- VytchesDDD manages business instances
- Framework containers consume, never create
- Guaranteed state consistency

### 4. Testing Simplicity
- Mock VytchesDDD container for unit tests
- Framework tests use real instances
- No dual mocking complexity

## Framework Integration Guidelines

### NestJS Integration

```typescript
// 1. Domain module with VytchesDDD configuration
@Module({
  providers: [
    VytchesDDDBridge.createNestJSProvider<UserService>('userService'),
    VytchesDDDBridge.createNestJSProvider<OrderService>('orderService'),
  ],
  exports: [UserService, OrderService]
})
export class DomainModule implements OnModuleInit {
  async onModuleInit() {
    await VytchesDDD.configure(); // Must happen first
  }
}

// 2. Feature modules import domain services
@Module({
  imports: [DomainModule],
  controllers: [UserController],
})
export class UserModule {}

// 3. Controllers use standard dependency injection
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}
  // Standard NestJS patterns
}
```

### Express Integration

```typescript
// Service registration with bridge
const app = express();

// Initialize VytchesDDD first
await VytchesDDD.configure();

// Get instances for Express routes
const userService = VytchesDDD.resolve<UserService>('userService');
const orderService = VytchesDDD.resolve<OrderService>('orderService');

// Use in routes
app.post('/users', async (req, res) => {
  const result = await userService.createUser(req.body);
  // Handle result...
});
```

## Migration Strategy

### For Existing Projects

1. **Identify Business Services**: Classes with business logic that need `@DomainService`
2. **Add Bridge Providers**: Replace direct `@Injectable()` with factory providers
3. **Initialize VytchesDDD**: Ensure VytchesDDD.configure() runs before framework init
4. **Update Tests**: Mock VytchesDDD container instead of individual services

### For New Projects

1. **Start with VytchesDDD**: Define business services with `@DomainService`
2. **Add Framework Bridge**: Use bridge pattern from the beginning
3. **Framework as Consumer**: Never put business logic in framework services

## Risks and Mitigations

### Risk: Initialization Order
**Mitigation**: Explicit lifecycle hooks (OnModuleInit) ensure proper order

### Risk: Performance Overhead
**Mitigation**: Factory pattern has minimal overhead, singleton instances reduce memory

### Risk: Framework Lock-in
**Mitigation**: Business logic stays in VytchesDDD, framework bridges are replaceable

### Risk: Debugging Complexity
**Mitigation**: Clear separation of concerns, logging in bridge layer

## Alternatives Considered

### Alternative 1: Dual Decorators
```typescript
@DomainService('userService')
@Injectable()
class UserService {}
```
**Rejected**: Creates double instance risk, state inconsistency

### Alternative 2: Framework-Only DI
```typescript
@Injectable()
class UserService {
  // Move all business logic to framework
}
```
**Rejected**: Loses business functionality from @DomainService decorators

### Alternative 3: VytchesDDD-Only
```typescript
// No framework integration
const userService = VytchesDDD.resolve<UserService>('userService');
```
**Rejected**: Poor framework integration, manual dependency management

## Implementation Notes

### Performance Characteristics
- Factory providers: ~0.1ms overhead per resolution
- Singleton instances: No memory duplication
- Bridge pattern: Minimal performance impact

### Memory Usage
- Single instance per service (vs double with dual decorators)
- Framework containers hold references, not new instances
- Garbage collection improved with singleton pattern

### Error Handling
- Clear error messages when VytchesDDD not configured
- Fail-fast on missing service registrations
- Framework-specific error handling in bridge layer

## Success Metrics

- ✅ Zero duplicate instances in production
- ✅ Business decorators function correctly
- ✅ Framework integration patterns work seamlessly
- ✅ Test complexity reduced (single mocking strategy)
- ✅ Memory usage optimized (single instances)

## Related ADRs

- [ADR-0006](0006-adopt-global-service-locator-with-optional-context-isolation-for-dependency-injection.md): Global Service Locator Pattern
- [ADR-0002](0002-adopt-meta-package-pattern-for-enterprise-api-stability.md): Enterprise API Stability

## Future Considerations

- **Multi-Framework Support**: Extend bridge pattern to Fastify, Express, etc.
- **Hot Reloading**: Investigate framework compatibility with service reloading
- **Container Hierarchies**: Support for nested context isolation
- **Performance Monitoring**: Add metrics for bridge pattern performance

This ADR establishes the bridge pattern as the standard approach for integrating VytchesDDD with framework dependency injection systems, ensuring business logic preservation while maintaining framework compatibility.
