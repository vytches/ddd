import path from 'path';
import fs from 'fs';

export class ContentResolver {
  /**
   * Resolves content for templates with intelligent fallback mechanisms
   */
  static resolveContent(packageName: string, requestedPath: string): string {
    // Try multiple strategies in order
    const strategies = [
      () => this.tryExactPath(packageName, requestedPath),
      () => this.tryMappedPath(packageName, requestedPath),
      () => this.tryPatternFallback(packageName, requestedPath),
      () => this.tryGeneratedContent(packageName, requestedPath),
      () => this.getDefaultContent(packageName, requestedPath),
    ];

    for (const strategy of strategies) {
      const content = strategy();
      if (content) return content;
    }

    return `<!-- Content not found: ${packageName}/${requestedPath} -->`;
  }

  private static tryExactPath(packageName: string, filePath: string): string | null {
    const possiblePaths = [
      path.join(process.cwd(), 'packages', packageName, 'src', 'examples', filePath),
      path.join(process.cwd(), 'packages', packageName, 'examples', filePath),
    ];

    for (const fullPath of possiblePaths) {
      if (fs.existsSync(fullPath) && fullPath.endsWith('.md')) {
        return fs.readFileSync(fullPath, 'utf-8');
      }
    }

    return null;
  }

  private static tryMappedPath(packageName: string, filePath: string): string | null {
    // Map expected template paths to common actual paths
    const mappings: Record<string, string[]> = {
      'basic/implementation.md': [
        'basic/implementation.md',
        'basic/example-1.md',
        'basic/basic-example.md',
      ],
      'intermediate/implementation.md': [
        'intermediate/implementation.md',
        'intermediate/example-1.md',
        'intermediate/intermediate-example.md',
      ],
      'advanced/implementation.md': [
        'advanced/implementation.md',
        'advanced/example-1.md',
        'advanced/advanced-example.md',
      ],
      'basic/use-case.md': ['basic/use-case.md', 'basic/example-2.md', 'basic/usage.md'],
      'intermediate/use-case.md': [
        'intermediate/use-case.md',
        'intermediate/example-2.md',
        'intermediate/usage.md',
      ],
      'advanced/use-case.md': [
        'advanced/use-case.md',
        'advanced/example-2.md',
        'advanced/usage.md',
      ],
    };

    const possiblePaths = mappings[filePath];
    if (possiblePaths) {
      for (const mappedPath of possiblePaths) {
        const content = this.tryExactPath(packageName, mappedPath);
        if (content) return content;
      }
    }

    return null;
  }

  private static tryPatternFallback(packageName: string, requestedPath: string): string | null {
    // Extract pattern type (e.g., "patterns/error-handling.md" -> "error-handling")
    const patternMatch = requestedPath.match(/^patterns\/(.+)\.md$/);
    if (patternMatch) {
      const patternType = patternMatch[1];
      return this.generatePatternContent(packageName, patternType!);
    }

    // For complexity-based paths, find any example in that complexity level
    const complexityMatch = requestedPath.match(/^(basic|intermediate|advanced)\//);
    if (complexityMatch) {
      const complexity = complexityMatch[1];
      const exampleDir = path.join(
        process.cwd(),
        'packages',
        packageName,
        'src',
        'examples',
        complexity!
      );

      if (fs.existsSync(exampleDir)) {
        const files = fs
          .readdirSync(exampleDir)
          .filter(f => f.endsWith('.md'))
          .sort();
        if (files.length > 0) {
          return fs.readFileSync(path.join(exampleDir, files[0]!), 'utf-8');
        }
      }
    }

    return null;
  }

  private static tryGeneratedContent(packageName: string, requestedPath: string): string | null {
    // Generate content for well-known paths
    if (requestedPath === 'shared/description.md') {
      return this.generatePackageDescription(packageName);
    }

    if (requestedPath === 'shared/hero.md') {
      return this.generateHeroSection(packageName);
    }

    if (requestedPath === 'shared/when-to-use.md') {
      return this.generateWhenToUse(packageName);
    }

    if (requestedPath === 'shared/when-not-to-use.md') {
      return this.generateWhenNotToUse(packageName);
    }

    if (requestedPath === 'shared/common-pitfalls.md') {
      return this.generateCommonPitfalls(packageName);
    }

    if (requestedPath === 'shared/troubleshooting.md') {
      return this.generateTroubleshooting(packageName);
    }

    if (requestedPath === 'shared/performance.md') {
      return this.generatePerformanceSection(packageName);
    }

    if (requestedPath === 'patterns/imports.md') {
      return this.generateImportsPattern(packageName);
    }

    if (requestedPath === 'patterns/error-handling.md') {
      return this.generateErrorHandlingPattern(packageName);
    }

    if (requestedPath === 'patterns/testing.md') {
      return this.generateTestingPattern(packageName);
    }

    return null;
  }

  private static generatePackageDescription(packageName: string): string {
    const descriptions: Record<string, string> = {
      'domain-services': `Domain Services provide orchestration capabilities for complex business operations that span multiple aggregates or require coordination between different domain concerns. They act as a coordination layer in your domain model, handling operations that don't naturally fit within a single aggregate.

## Key Features

- **Business Operation Orchestration**: Coordinate multi-step business processes
- **Cross-Aggregate Coordination**: Handle operations that span multiple aggregates
- **Domain Logic Isolation**: Keep complex orchestration logic separate from entities
- **Event Publishing**: Automatic domain event publishing for completed operations
- **Transaction Management**: Handle complex transaction boundaries
- **Error Handling**: Built-in Result pattern for clean error propagation`,

      acl: `Anti-Corruption Layer (ACL) provides a translation layer between your domain model and external systems, ensuring your domain remains pure and isolated from external concerns.

## Key Features

- **Domain Isolation**: Keep your domain model free from external system concerns
- **Translation Logic**: Convert between external and internal representations
- **Error Handling**: Handle external system failures gracefully
- **Adapter Pattern**: Implement adapters for different external systems
- **Testing Support**: Easy mocking of external dependencies`,

      policies: `Business Policies enable declarative business rule definition with rich validation, conditional logic, and enterprise context support.

## Key Features

- **Declarative Rules**: Define business rules in a clear, declarative manner
- **Conditional Logic**: Support for complex when/then/otherwise patterns
- **Specification Pattern**: Integration with specification pattern
- **Policy Composition**: Combine multiple policies with AND/OR logic
- **Context-Aware**: Rich context support for enterprise scenarios
- **Event Integration**: Automatic policy evaluation events`,

      resilience: `Resilience patterns provide fault tolerance through circuit breakers, retry policies, bulkheads, and timeout strategies.

## Key Features

- **Circuit Breaker**: Prevent cascading failures
- **Retry Policies**: Configurable retry with exponential backoff
- **Bulkhead Pattern**: Resource isolation for stability
- **Timeout Management**: Prevent hanging operations
- **Composite Strategies**: Combine multiple resilience patterns
- **Observability**: Built-in metrics and monitoring`,

      messaging: `Messaging infrastructure supports reliable message delivery through the outbox pattern, saga orchestration, and event-driven communication.

## Key Features

- **Outbox Pattern**: Guaranteed message delivery
- **Saga Orchestration**: Long-running business processes
- **Priority Processing**: Message prioritization support
- **Delayed Messages**: Scheduled message processing
- **Batch Operations**: Efficient bulk message handling
- **Middleware Pipeline**: Extensible message processing`,

      events: `Event system provides unified event handling for domain events, integration events, and audit events with automatic publishing and context-aware routing.

## Key Features

- **Unified Event Bus**: Single bus for all event types
- **Context-Aware Routing**: Smart event filtering by context
- **Repository Integration**: Automatic event publishing on save
- **Event Persistence**: Store events for replay and audit
- **Type Safety**: Full TypeScript support
- **Performance**: Optimized for high throughput`,

      di: `Dependency Injection provides a global service locator with auto-discovery, framework adapters, and enterprise-grade DI capabilities for DDD applications.

## Key Features

- **Global Service Locator**: Unified dependency resolution following MediatR pattern
- **Auto-Discovery**: Plugin-based discovery through decorators (@DomainService, @CommandHandler, @QueryHandler)
- **Framework Adapters**: Bridge pattern integration with NestJS, InversifyJS, TSyringe
- **Context Isolation**: Bounded context support for DDD scenarios
- **Service Lifetimes**: Transient, Singleton, and Scoped registration
- **Enterprise Ready**: Production-grade service locator with comprehensive error handling`,
    };

    return (
      descriptions[packageName] ||
      `The ${packageName} package provides essential functionality for Domain-Driven Design applications.

## Key Features

- **DDD Patterns**: Implementation of core DDD patterns
- **Type Safety**: Full TypeScript support
- **Enterprise Ready**: Production-grade implementation
- **Integration**: Seamless integration with other vytches-ddd packages`
    );
  }

  private static generateImportsPattern(packageName: string): string {
    return `// Standard Import Pattern for @vytches/ddd-${packageName}

// Core imports
import { ${this.getMainExport(packageName)} } from '@vytches/ddd-${packageName}';
import { Result } from '@vytches/ddd-utils';
import { DomainError } from '@vytches/ddd-domain-primitives';

// Type imports (prefer type imports for tree-shaking)
import type { I${this.getMainExport(packageName)} } from '@vytches/ddd-${packageName}';

// Domain imports (always from your application)
import { User, Order, Product } from '../domain';
import type { CreateUserCommand, UpdateOrderCommand } from '../types';

// Framework imports (only when needed)
import { Injectable } from '@nestjs/common'; // For NestJS integration
import { VytchesDDD } from '@vytches/ddd-di'; // For DI integration`;
  }

  private static generateErrorHandlingPattern(packageName: string): string {
    const mainClass = this.getMainExport(packageName);

    return `// Error Handling Pattern for @vytches/ddd-${packageName}
import { ${mainClass} } from '@vytches/ddd-${packageName}';
import { Result } from '@vytches/ddd-utils';
import { DomainError } from '@vytches/ddd-domain-primitives';

export class Enhanced${mainClass} extends ${mainClass} {
  async execute(command: Command): Promise<Result<Response, Error>> {
    try {
      // Validate input
      const validation = this.validate(command);
      if (validation.isFailure()) {
        return Result.failure(
          new DomainError(
            'VALIDATION_FAILED',
            \`Validation failed: \${validation.error.message}\`
          )
        );
      }

      // Execute main logic
      const result = await this.processCommand(command);

      if (result.isFailure()) {
        return Result.failure(
          new DomainError(
            'PROCESSING_FAILED',
            \`Processing failed: \${result.error.message}\`,
            { command, originalError: result.error }
          )
        );
      }

      return Result.success(result.value);

    } catch (error) {
      // Catch unexpected errors
      return Result.failure(
        new DomainError(
          'UNEXPECTED_ERROR',
          \`Unexpected error: \${error.message}\`,
          { originalError: error }
        )
      );
    }
  }

  // Error aggregation for batch operations
  async processBatch(items: Command[]): Promise<Result<BatchResult, Error>> {
    const errors: DomainError[] = [];
    const successes: Response[] = [];

    for (const item of items) {
      const result = await this.execute(item);

      if (result.isFailure()) {
        errors.push(result.error as DomainError);
      } else {
        successes.push(result.value!);
      }
    }

    if (errors.length > 0) {
      return Result.failure(
        new DomainError(
          'BATCH_PARTIAL_FAILURE',
          \`Failed to process \${errors.length} out of \${items.length} items\`,
          { errors, successes }
        )
      );
    }

    return Result.success({
      processed: successes.length,
      results: successes
    });
  }
}`;
  }

  private static generateTestingPattern(packageName: string): string {
    const mainClass = this.getMainExport(packageName);

    return `// Testing Pattern for @vytches/ddd-${packageName}
import { describe, it, expect, beforeEach } from 'vitest';
import { safeRun } from '@vytches/ddd-utils';
import { ${mainClass} } from '@vytches/ddd-${packageName}';

describe('${mainClass}', () => {
  let instance: ${mainClass};

  beforeEach(() => {
    instance = new ${mainClass}();
  });

  describe('basic functionality', () => {
    it('should execute successfully', async () => {
      // Arrange
      const input = { /* test data */ };

      // Act
      const [error, result] = await safeRun(
        async () => await instance.execute(input)
      );

      // Assert
      expect(error).toBeNull();
      expect(result).toBeDefined();
      expect(result?.isSuccess()).toBe(true);
    });

    it('should handle validation errors', async () => {
      // Arrange
      const invalidInput = { /* invalid data */ };

      // Act
      const [error, result] = await safeRun(
        async () => await instance.execute(invalidInput)
      );

      // Assert
      expect(error).toBeNull();
      expect(result?.isFailure()).toBe(true);
      expect(result?.error?.message).toContain('validation');
    });

    it('should handle processing errors gracefully', async () => {
      // Arrange
      const problematicInput = { /* data that causes error */ };

      // Act
      const [error, result] = await safeRun(
        async () => await instance.execute(problematicInput)
      );

      // Assert
      expect(error).toBeNull();
      expect(result?.isFailure()).toBe(true);
      expect(result?.error).toBeDefined();
    });
  });

  describe('integration scenarios', () => {
    it('should work with mock dependencies', async () => {
      // Arrange
      const mockDependency = {
        doSomething: vi.fn().mockResolvedValue({ success: true })
      };

      const instanceWithMocks = new ${mainClass}(mockDependency);
      const input = { /* test data */ };

      // Act
      await instanceWithMocks.execute(input);

      // Assert
      expect(mockDependency.doSomething).toHaveBeenCalledWith(
        expect.objectContaining({ /* expected args */ })
      );
    });
  });
});`;
  }

  private static generatePatternContent(packageName: string, patternType: string): string | null {
    // Generate pattern content based on pattern type
    switch (patternType) {
      case 'error-handling':
        return this.generateErrorHandlingPattern(packageName);
      case 'testing':
        return this.generateTestingPattern(packageName);
      case 'imports':
        return this.generateImportsPattern(packageName);
      default:
        return null;
    }
  }

  private static getMainExport(packageName: string): string {
    const mainExports: Record<string, string> = {
      'domain-services': 'BaseDomainService',
      acl: 'BaseACL',
      policies: 'PolicyBuilder',
      resilience: 'ResiliencePolicy',
      messaging: 'MessageBus',
      events: 'UnifiedEventBus',
      cqrs: 'CommandBus',
      projections: 'ProjectionEngine',
      validation: 'ValidationFacade',
      aggregates: 'AggregateRoot',
      repositories: 'BaseRepository',
      di: 'VytchesDDD',
    };

    return (
      mainExports[packageName] ||
      `Base${packageName.charAt(0).toUpperCase()}${packageName.slice(1)}`
    );
  }

  private static generateHeroSection(packageName: string): string {
    const heroContent: Record<string, string> = {
      'domain-services': `**Enterprise-Grade Domain Services** 🏢

Build complex business operations that span multiple aggregates with confidence. Domain Services provide the orchestration layer your enterprise applications need to handle sophisticated workflows while maintaining clean domain boundaries.

✨ **Perfect for**: Multi-aggregate operations, complex business workflows, enterprise integrations
🎯 **Best used when**: Operations don't naturally fit within a single aggregate
⚡ **Key benefit**: Clean separation of orchestration logic from domain entities`,

      di: `**Enterprise Dependency Injection** 🔧

Unify your application's dependency management with auto-discovery, framework adapters, and enterprise-grade service location. Built specifically for Domain-Driven Design applications.

✨ **Perfect for**: Large-scale applications, framework integration, bounded context isolation
🎯 **Best used when**: Managing complex service dependencies across multiple domains
⚡ **Key benefit**: Single source of truth for all service resolution`,
    };

    return (
      heroContent[packageName] ||
      `**${packageName.charAt(0).toUpperCase() + packageName.slice(1)}** 🚀

Enterprise-grade ${packageName} implementation for Domain-Driven Design applications.

✨ **Perfect for**: Production applications requiring robust ${packageName} patterns
🎯 **Best used when**: Building scalable, maintainable domain-driven systems
⚡ **Key benefit**: Battle-tested patterns that scale with your business`
    );
  }

  private static generateWhenToUse(packageName: string): string {
    const whenToUseContent: Record<string, string> = {
      'domain-services': `## When to Use Domain Services

### ✅ Perfect Scenarios:

- **Multi-Aggregate Operations**: When business logic spans multiple aggregates
- **Complex Workflows**: Multi-step business processes requiring orchestration
- **External System Integration**: Interacting with external services while keeping domain pure
- **Cross-Boundary Transactions**: Managing consistency across aggregate boundaries
- **Policy Enforcement**: Applying business rules that involve multiple entities

### 🎯 Specific Use Cases:

- **Order Processing**: Coordinating inventory, payment, and shipping
- **Loan Approval**: Credit checks, risk assessment, and compliance verification
- **User Registration**: Account creation, email verification, and profile setup
- **Report Generation**: Aggregating data from multiple sources
- **Batch Processing**: Handling bulk operations across multiple entities

### 💡 Decision Guidelines:

- If the operation naturally belongs to a single aggregate → Use the aggregate itself
- If the operation spans multiple aggregates → Use Domain Service
- If the operation requires external service calls → Use Domain Service
- If the operation involves complex business rules → Consider Domain Service`,

      di: `## When to Use Dependency Injection

### ✅ Perfect Scenarios:

- **Large Applications**: Projects with many services and complex dependencies
- **Framework Integration**: Bridging VytchesDDD with NestJS, Express, or other frameworks
- **Bounded Contexts**: Isolating services within specific domain boundaries
- **Testing**: Easy mocking and dependency substitution
- **Enterprise Applications**: Production systems requiring robust service management

### 🎯 Specific Use Cases:

- **Multi-Module Applications**: Managing dependencies across multiple modules
- **Command/Query Handlers**: Auto-discovering CQRS handlers
- **Service Orchestration**: Coordinating multiple domain services
- **Plugin Architecture**: Dynamically loading and registering services
- **Microservices**: Service discovery and registration patterns

### 💡 Decision Guidelines:

- If you have > 5 services → Use DI for better organization
- If you're using frameworks → Use DI for integration
- If you need testing flexibility → Use DI for easy mocking
- If you have bounded contexts → Use DI for isolation`,
    };

    return (
      whenToUseContent[packageName] ||
      `## When to Use ${packageName}

Use ${packageName} when you need enterprise-grade ${packageName} patterns in your Domain-Driven Design application.

### ✅ Perfect Scenarios:
- Production applications requiring robust ${packageName} implementation
- Complex business domains needing structured ${packageName} patterns
- Enterprise systems requiring scalable ${packageName} architecture

### 🎯 Specific Use Cases:
- Large-scale applications with complex ${packageName} requirements
- Multi-team projects needing consistent ${packageName} patterns
- Systems requiring high reliability and maintainability`
    );
  }

  private static generateWhenNotToUse(packageName: string): string {
    const whenNotToUseContent: Record<string, string> = {
      'domain-services': `## When NOT to Use Domain Services

### ❌ Avoid in These Scenarios:

- **Simple CRUD Operations**: Basic create, read, update, delete operations
- **Single Aggregate Logic**: Operations that naturally belong to one aggregate
- **Anemic Domain Models**: When you're just moving logic around without domain richness
- **Over-Engineering**: Small applications that don't need orchestration complexity
- **Entity-Specific Operations**: Logic that clearly belongs to a specific entity

### 🚫 Common Anti-Patterns:

- **God Services**: Putting all business logic in domain services
- **Anemic Aggregates**: Aggregates with no behavior, all logic in services
- **Service Layering**: Creating unnecessary service hierarchies
- **Database Services**: Domain services that are just database wrappers
- **Utility Services**: Using domain services for technical concerns

### 💡 Alternative Approaches:

- **Rich Aggregates**: Put logic in the aggregate itself
- **Value Objects**: Use value objects for simple calculations
- **Application Services**: Use application services for workflow coordination
- **Specifications**: Use specifications for complex business rules
- **Policies**: Use policies for conditional business logic`,

      di: `## When NOT to Use Dependency Injection

### ❌ Avoid in These Scenarios:

- **Simple Applications**: Small apps with < 5 services
- **Prototype/Demo Projects**: Quick experiments or proof-of-concepts
- **Static Dependencies**: Services that never change or need mocking
- **Over-Complex Setup**: When DI adds more complexity than value
- **Performance-Critical Paths**: Hot paths where service resolution overhead matters

### 🚫 Common Anti-Patterns:

- **Service Locator Abuse**: Using DI container as a global service locator everywhere
- **Circular Dependencies**: Services depending on each other circularly
- **God Container**: Registering everything in DI, even simple utilities
- **Runtime Registration**: Registering services at runtime instead of startup
- **Framework Lock-in**: Making domain logic dependent on DI framework

### 💡 Alternative Approaches:

- **Direct Instantiation**: Simply \`new Service()\` for simple cases
- **Factory Pattern**: Custom factories for complex object creation
- **Builder Pattern**: For objects with many optional parameters
- **Module Pattern**: For organizing related services
- **Composition Root**: Manual composition at application entry point`,
    };

    return (
      whenNotToUseContent[packageName] ||
      `## When NOT to Use ${packageName}

### ❌ Avoid in These Scenarios:
- Simple applications that don't need complex ${packageName} patterns
- Prototype or demo projects where simplicity is preferred
- Cases where standard approaches are sufficient

### 🚫 Common Anti-Patterns:
- Over-engineering simple use cases
- Using ${packageName} when basic patterns would suffice
- Adding complexity without clear business value

### 💡 Alternative Approaches:
- Use standard patterns for simple cases
- Consider lighter alternatives for prototypes
- Evaluate if the complexity is justified`
    );
  }

  private static generateCommonPitfalls(packageName: string): string {
    const pitfallsContent: Record<string, string> = {
      'domain-services': `## Common Pitfalls

### 🕳️ Pitfall 1: Anemic Domain Models

**Problem**: Putting all business logic in domain services, leaving aggregates empty.

\`\`\`typescript
// ❌ WRONG: Anemic aggregate
class Order {
  id: string;
  total: number;
  // No behavior, just data
}

// ❌ WRONG: All logic in service
class OrderService {
  calculateTotal(order: Order): number {
    // Should be in Order aggregate
  }
}
\`\`\`

**Solution**: Keep core business logic in aggregates.

\`\`\`typescript
// ✅ CORRECT: Rich aggregate
class Order {
  calculateTotal(): number {
    // Logic belongs here
  }
}

// ✅ CORRECT: Service for orchestration only
class OrderProcessingService {
  processOrder(order: Order): void {
    // Only orchestration logic
  }
}
\`\`\`

### 🕳️ Pitfall 2: God Services

**Problem**: Creating massive services that do everything.

**Solution**: Follow Single Responsibility Principle - one service per business capability.

### 🕳️ Pitfall 3: Leaky Abstractions

**Problem**: Domain services depending on infrastructure concerns.

**Solution**: Use dependency injection and interfaces to maintain clean boundaries.`,

      di: `## Common Pitfalls

### 🕳️ Pitfall 1: Service Locator Anti-Pattern

**Problem**: Using DI container as a global service locator everywhere.

\`\`\`typescript
// ❌ WRONG: Service locator abuse
class SomeService {
  doSomething() {
    const otherService = VytchesDDD.resolve('otherService');
    // This creates hidden dependencies
  }
}
\`\`\`

**Solution**: Use constructor injection.

\`\`\`typescript
// ✅ CORRECT: Constructor injection
class SomeService {
  constructor(private otherService: OtherService) {}

  doSomething() {
    this.otherService.doSomething();
  }
}
\`\`\`

### 🕳️ Pitfall 2: Circular Dependencies

**Problem**: Services depending on each other circularly.

**Solution**: Refactor to break the cycle or use events for decoupling.

### 🕳️ Pitfall 3: Framework Lock-in

**Problem**: Making domain logic dependent on DI framework.

**Solution**: Use interfaces and keep domain logic DI-agnostic.`,
    };

    return (
      pitfallsContent[packageName] ||
      `## Common Pitfalls

### 🕳️ Pitfall 1: Over-Complexity
**Problem**: Adding unnecessary complexity for simple use cases.
**Solution**: Start simple and add complexity only when needed.

### 🕳️ Pitfall 2: Inconsistent Patterns
**Problem**: Mixing different approaches without clear guidelines.
**Solution**: Establish and follow consistent patterns across your application.

### 🕳️ Pitfall 3: Poor Error Handling
**Problem**: Not handling errors properly in ${packageName} operations.
**Solution**: Always use Result pattern or proper error handling strategies.`
    );
  }

  private static generateTroubleshooting(packageName: string): string {
    const troubleshootingContent: Record<string, string> = {
      'domain-services': `## Troubleshooting

### 🔍 Problem: Domain Service Not Found

**Symptoms**: \`Service 'myDomainService' not found\`

**Solution**:
1. Check if service is properly registered with \`@DomainService\`
2. Verify service is in the correct package
3. Ensure VytchesDDD.configure() was called

### 🔍 Problem: Circular Dependencies

**Symptoms**: Services depend on each other circularly

**Solutions**:
1. Use events to decouple services
2. Create a third service to handle the interaction
3. Refactor to break the dependency cycle

### 🔍 Problem: Transaction Issues

**Symptoms**: Data consistency problems across aggregates

**Solutions**:
1. Use Unit of Work pattern
2. Implement proper transaction boundaries
3. Consider eventual consistency with events

### 🔍 Problem: Performance Issues

**Symptoms**: Slow domain service operations

**Solutions**:
1. Profile service dependencies
2. Implement caching where appropriate
3. Consider async operations for non-critical paths`,

      di: `## Troubleshooting

### 🔍 Problem: Service Not Found

**Symptoms**: \`Service 'myService' not found in container\`

**Solution**:
1. Check if service is registered with \`@DomainService\`
2. Verify VytchesDDD.configure() was called
3. Check service ID matches registration

### 🔍 Problem: Circular Dependencies

**Symptoms**: \`Circular dependency detected\`

**Solutions**:
1. Use factory pattern to break cycles
2. Refactor to remove circular dependencies
3. Use events for decoupling

### 🔍 Problem: Framework Integration Issues

**Symptoms**: Services not working with NestJS/Express

**Solutions**:
1. Use Bridge Pattern for framework integration
2. Initialize VytchesDDD before framework DI
3. Don't mix framework and VytchesDDD DI decorators

### 🔍 Problem: Performance Issues

**Symptoms**: Slow service resolution

**Solutions**:
1. Use singleton lifetime for expensive services
2. Avoid recursive service resolution
3. Profile container performance`,
    };

    return (
      troubleshootingContent[packageName] ||
      `## Troubleshooting

### 🔍 Common Issues

**Problem**: ${packageName} not working as expected

**Solutions**:
1. Check configuration and setup
2. Verify dependencies are properly installed
3. Review error messages and logs
4. Consult documentation and examples

### 🔍 Performance Issues

**Problem**: Slow ${packageName} operations

**Solutions**:
1. Profile your application
2. Optimize critical paths
3. Consider caching strategies
4. Review architecture patterns

### 🔍 Integration Issues

**Problem**: ${packageName} not integrating well with other packages

**Solutions**:
1. Check package compatibility
2. Review integration documentation
3. Verify configuration settings
4. Consider using adapter patterns`
    );
  }

  private static generatePerformanceSection(packageName: string): string {
    const performanceContent: Record<string, string> = {
      'domain-services': `## Performance Considerations

### ⚡ Optimization Strategies

#### 1. **Service Caching**
Cache expensive calculations and external service calls.

\`\`\`typescript
class OptimizedDomainService extends BaseDomainService {
  private cache = new Map<string, any>();

  async expensiveOperation(input: string): Promise<Result<any, Error>> {
    const cacheKey = \`operation_\${input}\`;

    if (this.cache.has(cacheKey)) {
      return Result.success(this.cache.get(cacheKey));
    }

    const result = await this.performExpensiveOperation(input);
    this.cache.set(cacheKey, result);

    return Result.success(result);
  }
}
\`\`\`

#### 2. **Async Operations**
Use async/await for non-blocking operations.

#### 3. **Batch Processing**
Process multiple items in batches to reduce overhead.

#### 4. **Database Optimization**
- Use appropriate indexes
- Minimize N+1 queries
- Use batch queries when possible

### 📊 Performance Metrics

- **Service Resolution**: < 1ms per service lookup
- **Transaction Boundaries**: Keep transactions short
- **Memory Usage**: Monitor for memory leaks in long-running services
- **External Calls**: Implement timeouts and circuit breakers`,

      di: `## Performance Considerations

### ⚡ Optimization Strategies

#### 1. **Service Lifetimes**
Choose appropriate lifetimes for services.

\`\`\`typescript
// ✅ Singleton for expensive services
@DomainService('expensiveService', {
  lifetime: ServiceLifetime.Singleton
})
class ExpensiveService {
  // Heavy initialization
}

// ✅ Transient for lightweight services
@DomainService('lightService', {
  lifetime: ServiceLifetime.Transient
})
class LightService {
  // Light operations
}
\`\`\`

#### 2. **Lazy Loading**
Load services only when needed.

#### 3. **Service Resolution**
Minimize service resolution in hot paths.

#### 4. **Memory Management**
Properly dispose of services when no longer needed.

### 📊 Performance Metrics

- **Service Resolution**: < 0.1ms per service lookup
- **Memory Usage**: Monitor singleton service memory
- **Container Size**: Keep container lean
- **Registration Time**: Optimize startup performance`,
    };

    return (
      performanceContent[packageName] ||
      `## Performance Considerations

### ⚡ Optimization Strategies

1. **Caching**: Implement appropriate caching strategies
2. **Async Operations**: Use async patterns for non-blocking operations
3. **Resource Management**: Properly manage resources and memory
4. **Monitoring**: Monitor performance metrics and bottlenecks

### 📊 Performance Metrics

- Monitor key performance indicators
- Set up alerting for performance degradation
- Regular performance testing and profiling
- Optimize based on actual usage patterns

### 🔧 Best Practices

- Profile before optimizing
- Focus on actual bottlenecks
- Consider trade-offs between performance and maintainability
- Document performance characteristics and limitations`
    );
  }

  private static getDefaultContent(packageName: string, requestedPath: string): string {
    // Provide sensible defaults based on the path pattern
    if (requestedPath.includes('implementation')) {
      return `// Implementation example for @vytches/ddd-${packageName}
// This is a placeholder - actual example content not found

import { ${this.getMainExport(packageName)} } from '@vytches/ddd-${packageName}';
import { Result } from '@vytches/ddd-utils';

export class Example${this.getMainExport(packageName)} extends ${this.getMainExport(packageName)} {
  async execute(input: any): Promise<Result<any, Error>> {
    try {
      // Implementation logic here
      return Result.success({ message: 'Success' });
    } catch (error) {
      return Result.failure(error as Error);
    }
  }
}`;
    }

    if (requestedPath.includes('use-case')) {
      return `## Use Case Example for @vytches/ddd-${packageName}

This example shows how to use the ${packageName} package in your application:

\`\`\`typescript
import { ${this.getMainExport(packageName)} } from '@vytches/ddd-${packageName}';

// Initialize the service
const service = new ${this.getMainExport(packageName)}();

// Use the service
const result = await service.execute({
  // Your input data
});

if (result.isSuccess()) {
  console.log('Success:', result.value);
} else {
  console.error('Error:', result.error.message);
}
\`\`\``;
    }

    return `<!-- Placeholder content for ${packageName}/${requestedPath} -->
# ${requestedPath}

Example content is not yet available for this section.`;
  }
}
