# ADR-0022: Plugin-Based Discovery and Progressive Complexity Configuration

**Status**: Accepted  
**Date**: 2025-08-22  
**Decision makers**: VytchesDDD Team, Architecture Guardian, Library Expert,
Developer Experience Agent

## Context

The VytchesDDD library needed a service discovery mechanism that would:

1. Enable zero-configuration setup for beginners
2. Support enterprise-grade bounded context isolation
3. Allow framework-specific integrations (NestJS, Express, etc.)
4. Handle dual decorator scenarios (@Injectable + @DomainService)
5. Provide progressive complexity levels for different user expertise

Initial proposals included:

- Universal Discovery Service (single discovery for all features)
- Separate discovery per package
- Manual registration only

## Decision

We will implement a **Plugin-Based Discovery Registry** with **Progressive
Complexity Configuration** that:

### 1. Plugin-Based Discovery Architecture

Each VytchesDDD package provides its own discovery plugin implementing the
`IDiscoveryPlugin` interface:

```typescript
interface IDiscoveryPlugin {
  readonly name: string;
  readonly packageName: string;
  readonly priority: number;
  isAvailable(): boolean;
  discoverInContext(
    contextName: string,
    modules: unknown[],
    container: IContainer
  ): Promise<DiscoveryResult>;
  validate(results: DiscoveryResult): ValidationResult;
}
```

A central `DiscoveryRegistry` coordinates all plugins without knowing their
internal implementation details.

### 2. Progressive Complexity Configuration

Three levels of configuration complexity:

**Level 1: Zero-Config (Beginners - 80% of use cases)**

```typescript
VytchesDDDModule.forRoot(); // Auto-discovers everything
```

**Level 2: Feature Selection (Intermediate - 15% of use cases)**

```typescript
VytchesDDDModule.forRoot({
  features: ['acl', 'cqrs', 'events'],
});
```

**Level 3: Full Control (Enterprise - 5% of use cases)**

```typescript
VytchesDDDModule.forRoot({
  discovery: { plugins: [...], parallel: true },
  contexts: {
    'OrderManagement': {
      modules: [OrderModule],
      accessMatrix: ['Payment']
    }
  }
})
```

### 3. Dual Decorator Handling

When both `@Injectable` (NestJS) and VytchesDDD decorators are present:

- NestJS creates and manages the instance lifecycle
- VytchesDDD receives the NestJS instance
- VytchesDDD metadata (resilience, caching, etc.) is applied via proxy wrapper
- Result: Full NestJS DI capabilities + VytchesDDD features

```typescript
@DomainService('paymentService') // VytchesDDD metadata
@Resilience({ timeout: 5000 }) // VytchesDDD features
@Injectable() // NestJS manages instance
export class PaymentService {
  constructor(
    @InjectRepository(Payment) private repo: Repository<Payment> // NestJS DI works
  ) {}
}
```

### 4. Context-Specific Configuration

Support for bounded context isolation with optional overrides:

```typescript
VytchesDDDModule.forContext({
  name: 'PaymentProcessing',
  isolated: true, // Separate DI container
  overrides: {
    cqrs: { timeout: 60000 }, // Context-specific settings
  },
});
```

## Consequences

### Positive

- **Progressive Learning Curve**: Beginners can start with zero-config, add
  complexity gradually
- **DDD Principles Respected**: Bounded contexts maintained through plugin
  isolation
- **Framework Flexibility**: NestJS decorators work seamlessly with VytchesDDD
  features
- **Performance**: Parallel discovery with timeout protection
- **Extensibility**: New packages add plugins without modifying core
- **No Breaking Changes**: Backward compatibility with legacy `autoDiscovery`
- **Enterprise Ready**: Full control available when needed
- **Developer Experience**: 15-minute productivity for simple cases

### Negative

- **Increased Complexity**: Plugin system adds architectural complexity
- **Multiple Configuration Patterns**: Three levels might confuse some
  developers
- **Proxy Overhead**: Dual decorator handling adds slight runtime overhead
- **Documentation Burden**: Multiple patterns require comprehensive
  documentation
- **Testing Complexity**: Need to test all configuration combinations

### Neutral

- **Migration Path**: Existing projects need gradual migration strategy
- **Framework Coupling**: Deeper integration with NestJS for dual decorator
  support
- **Learning Investment**: Developers need to understand when to use which
  pattern

## Implementation Plan

### Phase 1: Foundation (Week 1-2)

1. Implement `DiscoveryRegistry` and `IDiscoveryPlugin` interface
2. Create discovery plugins for core packages (CQRS, Events, ACL)
3. Implement zero-config `VytchesDDDModule.forRoot()`
4. Add dual decorator proxy system

### Phase 2: Progressive Features (Week 3-4)

1. Add feature selection configuration
2. Implement context-specific configuration
3. Create migration utilities
4. Add validation and error handling

### Phase 3: Enterprise Features (Month 2)

1. Full bounded context support with access matrix
2. Advanced resilience configuration
3. Performance optimizations
4. Comprehensive documentation

## Alternatives Considered

### 1. Universal Discovery Service

- **Rejected**: Violates bounded context principles, creates god object
  anti-pattern
- **Reason**: DDD Compliance Guardian and Architecture Guardian strongly opposed

### 2. Manual Registration Only

- **Rejected**: Poor developer experience, high friction for beginners
- **Reason**: Conflicts with "Simple DX-First" philosophy

### 3. Separate Discovery per Package without Coordination

- **Rejected**: No unified configuration, difficult to manage
- **Reason**: Lacks enterprise-grade coordination

### 4. Force VytchesDDD.resolve() Everywhere

- **Rejected**: Not idiomatic for NestJS developers
- **Reason**: Poor developer experience, breaks NestJS patterns

## References

- [Plugin Pattern](<https://en.wikipedia.org/wiki/Plug-in_(computing)>)
- [Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/)
- [NestJS Module System](https://docs.nestjs.com/modules)
- [Domain-Driven Design Bounded Contexts](https://martinfowler.com/bliki/BoundedContext.html)
- [Decorator Pattern](https://refactoring.guru/design-patterns/decorator)
- [Proxy Pattern](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy)

## Notes

This architecture represents a compromise between:

- **Simplicity** (Developer Experience priority)
- **Power** (Enterprise requirements)
- **Correctness** (DDD principles)

The plugin-based approach with progressive complexity provides the best balance
for the VytchesDDD library's goals of making complex DDD patterns accessible to
all developers while maintaining enterprise-grade capabilities.
