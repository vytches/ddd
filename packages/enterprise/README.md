# @vytches/ddd-enterprise

<!-- LLM-METADATA
Package: @vytches/ddd-enterprise
Category: Meta-Package
Purpose: Enterprise-grade bundle aggregating all VytchesDDD packages with unified API, enterprise features, and advanced capabilities
Dependencies: All @vytches/ddd-core packages
Complexity: High
DDD Patterns: Complete DDD ecosystem, Enterprise Architecture, Bundle Management, Unified API
Integration Points: Meta-package providing single entry point to entire DDD ecosystem; includes all patterns, infrastructure, and enterprise features
-->

[![npm version](https://badge.fury.io/js/%40vytches%2Fddd-enterprise.svg)](https://badge.fury.io/js/%40vytches%2Fddd-enterprise)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Complete Enterprise Bundle for Domain-Driven Design applications with all
> VytchesDDD packages**

The Enterprise package is a comprehensive meta-package that aggregates all
VytchesDDD packages into a single, unified API surface. It provides
enterprise-grade features, advanced capabilities, and a complete DDD ecosystem
for building robust, scalable applications.

## 📋 Table of Contents

- [Installation](#installation)
- [Key Features](#key-features)
- [Bundle Architecture](#bundle-architecture)
- [Quick Start](#quick-start)
- [Complete API Surface](#complete-api-surface)
- [Enterprise Features](#enterprise-features)
- [Bundle Strategies](#bundle-strategies)
- [Migration Guide](#migration-guide)
- [Performance Optimization](#performance-optimization)
- [Enterprise Deployment](#enterprise-deployment)
- [Monitoring & Observability](#monitoring--observability)
- [Security & Compliance](#security--compliance)
- [Testing](#testing)
- [Best Practices](#best-practices)
- [Contributing](#contributing)

## 🚀 Installation

### Complete Enterprise Installation

```bash
# npm
npm install @vytches/ddd-enterprise

# yarn
yarn add @vytches/ddd-enterprise

# pnpm
pnpm add @vytches/ddd-enterprise
```

### Selective Installation (Alternative)

```bash
# Core Bundle (basic DDD patterns)
npm install @vytches/ddd-core @vytches/ddd-utils @vytches/ddd-validation

# Advanced Bundle (event-driven patterns)
npm install @vytches/ddd-core @vytches/ddd-events @vytches/ddd-cqrs @vytches/ddd-projections

# Enterprise Bundle (complete ecosystem)
npm install @vytches/ddd-enterprise
```

## ✨ Key Features

### Complete DDD Ecosystem

- **All Patterns**: Every DDD pattern and building block in one package
- **Unified API**: Single import surface for all VytchesDDD capabilities
- **Enterprise Grade**: Production-ready features with enterprise scalability
- **Zero Conflicts**: Resolved naming conflicts between packages

### Enterprise Architecture

- **Bundle Management**: Optimized package bundling with tree-shaking support
- **Deployment Ready**: Production deployment configurations and optimizations
- **Monitoring Integration**: Built-in observability and monitoring capabilities
- **Security Features**: Enterprise security patterns and compliance support

### Advanced Capabilities

- **Health Checks**: Comprehensive health monitoring and status reporting
- **Performance Monitoring**: Real-time performance metrics and alerting
- **Resilience Patterns**: Circuit breakers, retry logic, and fault tolerance
- **Event Sourcing**: Complete event sourcing with snapshots and replay

### Developer Experience

- **Single Import**: Access all features through one package
- **Type Safety**: Full TypeScript support with comprehensive type definitions
- **Documentation**: Complete API documentation and examples
- **IDE Support**: Rich IntelliSense and autocomplete support

## 🏗️ Bundle Architecture

### Package Inclusion

The Enterprise package includes all VytchesDDD packages:

```typescript
// Foundation Layer
export * from '@vytches/ddd-core';
export * from '@vytches/ddd-domain-primitives';
export * from '@vytches/ddd-value-objects';
export * from '@vytches/ddd-repositories';
export * from '@vytches/ddd-aggregates';

// Patterns Layer
export * from '@vytches/ddd-validation';
export * from '@vytches/ddd-policies';
export * from '@vytches/ddd-domain-services';

// Architecture Layer
export * from '@vytches/ddd-events';
export * from '@vytches/ddd-cqrs';
export * from '@vytches/ddd-projections';

// Integration Layer
export * from '@vytches/ddd-acl';
export * from '@vytches/ddd-messaging';

// Infrastructure Layer
export * from '@vytches/ddd-resilience';
export * from '@vytches/ddd-event-store';
export * from '@vytches/ddd-logging';

// Tooling Layer
export * from '@vytches/ddd-testing';
export * from '@vytches/ddd-di';
export * from '@vytches/ddd-utils';
```

### Conflict Resolution

```typescript
// Resolve naming conflicts with qualified exports
export { RetryPolicy as ResilienceRetryPolicy } from '@vytches/ddd-resilience';

// Selective exports to avoid conflicts
export {
  PolicyBuilder,
  PolicyRetryBehavior as PolicyRetryBehavior,
  // ... other non-conflicting exports
} from '@vytches/ddd-policies';
```

## 🚀 Quick Start

### Single Import Usage

```typescript
import {
  // Core DDD patterns
  AggregateRoot,
  EntityId,
  ValueObject,
  DomainEvent,

  // CQRS
  CommandHandler,
  QueryHandler,
  Command,
  Query,

  // Event-driven architecture
  EventStore,
  EventBus,
  EventProjection,

  // Validation and policies
  Specification,
  PolicyBuilder,
  ValidationFacade,

  // Infrastructure
  UnitOfWork,
  Repository,
  CircuitBreaker,

  // Dependency injection
  VytchesDDD,
  DomainService,

  // Utilities
  Result,
  Logger,
  safeRun,
} from '@vytches/ddd-enterprise';

// Complete application setup
const container = new SimpleContainer();
VytchesDDD.configure(container);

// Use all features seamlessly
@DomainService('orderService')
@CommandHandler(CreateOrderCommand)
class OrderService extends UnitOfWorkAwareDomainService {
  async handle(command: CreateOrderCommand): Promise<Result<void, Error>> {
    return this.executeInTransaction(async () => {
      const order = Order.create(command.orderData);
      await this.orderRepository.save(order);

      this.publishEvent(new OrderCreatedEvent(order.id));
      return Result.ok(void 0);
    });
  }
}
```

### Complete Application Example

```typescript
import {
  AggregateRoot,
  EntityId,
  DomainEvent,
  CommandHandler,
  QueryHandler,
  EventStore,
  PolicyBuilder,
  VytchesDDD,
  Logger,
  CircuitBreaker,
  UnitOfWork,
  Repository,
  Result,
} from '@vytches/ddd-enterprise';

// Domain model
class Order extends AggregateRoot {
  private constructor(
    id: EntityId,
    private customerId: EntityId,
    private items: OrderItem[],
    private status: OrderStatus
  ) {
    super(id);
  }

  static create(data: CreateOrderData): Order {
    const order = new Order(
      EntityId.generate(),
      data.customerId,
      data.items,
      OrderStatus.PENDING
    );

    order.addDomainEvent(new OrderCreatedEvent(order.id));
    return order;
  }

  approve(): void {
    this.status = OrderStatus.APPROVED;
    this.addDomainEvent(new OrderApprovedEvent(this.id));
  }
}

// Business policies
const orderPolicy = PolicyBuilder.create<Order>()
  .withId('order-validation')
  .withDomain('orders')
  .must(order => order.items.length > 0)
  .withCode('NO_ITEMS')
  .withMessage('Order must have at least one item')
  .and()
  .must(order => order.total.isPositive())
  .withCode('INVALID_TOTAL')
  .withMessage('Order total must be positive')
  .build();

// Command handlers
@CommandHandler(CreateOrderCommand)
class CreateOrderHandler extends UnitOfWorkAwareDomainService {
  constructor(
    private orderRepository: IOrderRepository,
    private circuitBreaker: CircuitBreaker
  ) {
    super('createOrderHandler');
  }

  async handle(command: CreateOrderCommand): Promise<Result<EntityId, Error>> {
    return this.executeInTransaction(async () => {
      // Validate with policy
      const policyResult = await orderPolicy.check({
        entity: command.orderData,
        context: { userId: command.userId },
      });

      if (policyResult.isFailure()) {
        return Result.fail(new Error('Order validation failed'));
      }

      // Create order
      const order = Order.create(command.orderData);

      // Save with circuit breaker protection
      await this.circuitBreaker.execute(async () => {
        await this.orderRepository.save(order);
      });

      return Result.ok(order.id);
    });
  }
}

// Application setup
async function setupApplication() {
  const container = new SimpleContainer();

  // Configure DI
  VytchesDDD.configure(container);

  // Register repositories
  container.register('orderRepository', OrderRepository);

  // Setup resilience
  const circuitBreaker = new CircuitBreaker({
    name: 'order-service',
    threshold: 5,
    timeout: 30000,
  });

  container.registerInstance('circuitBreaker', circuitBreaker);

  // Initialize logger
  Logger.configure({
    level: 'info',
    format: 'json',
  });

  console.log('Enterprise DDD application initialized');
}
```

## 🎯 Complete API Surface

### Core DDD Patterns

```typescript
// Entity and Value Objects
import {
  Entity,
  ValueObject,
  AggregateRoot,
  EntityId,
  DomainEvent,
  DomainError,
} from '@vytches/ddd-enterprise';

// Repositories and Unit of Work
import {
  Repository,
  UnitOfWork,
  IBaseRepository,
  IUnitOfWork,
  RepositoryError,
} from '@vytches/ddd-enterprise';

// Specifications and Validation
import {
  Specification,
  CompositeSpecification,
  ValidationFacade,
  BusinessRuleValidator,
} from '@vytches/ddd-enterprise';
```

### CQRS and Event Architecture

```typescript
// Command and Query handling
import {
  Command,
  Query,
  CommandHandler,
  QueryHandler,
  CommandBus,
  QueryBus,
  Mediator,
} from '@vytches/ddd-enterprise';

// Event sourcing and projections
import {
  EventStore,
  EventBus,
  EventProjection,
  ProjectionEngine,
  EventReplay,
  Snapshot,
} from '@vytches/ddd-enterprise';

// Messaging and integration
import {
  OutboxPattern,
  MessageBus,
  IntegrationEvent,
  SagaOrchestrator,
  EventDispatcher,
} from '@vytches/ddd-enterprise';
```

### Enterprise Infrastructure

```typescript
// Resilience patterns
import {
  CircuitBreaker,
  RetryPolicy,
  Bulkhead,
  Timeout,
  ResilienceStrategy,
} from '@vytches/ddd-enterprise';

// Logging and monitoring
import {
  Logger,
  ILogger,
  LogLevel,
  LogContext,
  StructuredLogging,
} from '@vytches/ddd-enterprise';

// Dependency injection
import {
  VytchesDDD,
  DomainService,
  ServiceLifetime,
  Container,
  ServiceLocator,
} from '@vytches/ddd-enterprise';
```

### Business Logic and Policies

```typescript
// Business policies
import {
  PolicyBuilder,
  PolicyGroup,
  PolicyRegistry,
  PolicyViolation,
  PolicyBehavior,
} from '@vytches/ddd-enterprise';

// Domain services
import {
  IDomainService,
  EventAwareDomainService,
  UnitOfWorkAwareDomainService,
  AsyncDomainService,
} from '@vytches/ddd-enterprise';

// Anti-corruption layer
import {
  ACLAdapter,
  ModelTranslator,
  ExternalSystemAdapter,
  IntegrationMiddleware,
} from '@vytches/ddd-enterprise';
```

## 🏢 Enterprise Features

### Health Checks and Monitoring

```typescript
import {
  HealthChecker,
  HealthStatus,
  MetricsCollector,
  PerformanceMonitor,
} from '@vytches/ddd-enterprise';

// Application health monitoring
class ApplicationHealthChecker {
  private healthChecker = new HealthChecker();
  private metrics = new MetricsCollector();

  async checkHealth(): Promise<HealthStatus> {
    const checks = await Promise.all([
      this.checkDatabase(),
      this.checkEventStore(),
      this.checkExternalServices(),
      this.checkCircuitBreakers(),
    ]);

    return this.healthChecker.aggregate(checks);
  }

  private async checkDatabase(): Promise<HealthStatus> {
    // Database health check
    return { status: 'healthy', component: 'database' };
  }

  private async checkEventStore(): Promise<HealthStatus> {
    // Event store health check
    return { status: 'healthy', component: 'event-store' };
  }

  private async checkExternalServices(): Promise<HealthStatus> {
    // External services health check
    return { status: 'healthy', component: 'external-services' };
  }

  private async checkCircuitBreakers(): Promise<HealthStatus> {
    // Circuit breaker status check
    return { status: 'healthy', component: 'circuit-breakers' };
  }
}
```

### Performance Optimization

```typescript
import {
  PerformanceProfiler,
  CacheManager,
  ConnectionPoolManager,
  ResourceOptimizer,
} from '@vytches/ddd-enterprise';

class PerformanceOptimizer {
  private profiler = new PerformanceProfiler();
  private cacheManager = new CacheManager();
  private connectionPool = new ConnectionPoolManager();

  async optimizeApplication(): Promise<void> {
    // Profile application performance
    const profile = await this.profiler.profile();

    // Optimize based on profile
    await this.optimizeQueries(profile);
    await this.optimizeEventProcessing(profile);
    await this.optimizeResourceUsage(profile);
  }

  private async optimizeQueries(profile: PerformanceProfile): Promise<void> {
    // Query optimization logic
  }

  private async optimizeEventProcessing(
    profile: PerformanceProfile
  ): Promise<void> {
    // Event processing optimization
  }

  private async optimizeResourceUsage(
    profile: PerformanceProfile
  ): Promise<void> {
    // Resource usage optimization
  }
}
```

## 📦 Bundle Strategies

### Core Bundle (Minimal)

```typescript
// Core DDD patterns only
import {
  AggregateRoot,
  EntityId,
  ValueObject,
  Repository,
  UnitOfWork,
  DomainEvent,
} from '@vytches/ddd-enterprise';

// Basic application with core patterns
class CoreApplication {
  async initialize(): Promise<void> {
    // Minimal setup with core patterns
    const unitOfWork = new UnitOfWork();
    const repository = new OrderRepository(unitOfWork);

    // Basic domain logic
    const order = Order.create(orderData);
    await repository.save(order);
    await unitOfWork.commit();
  }
}
```

### Advanced Bundle (Event-Driven)

```typescript
// Core + Event-driven patterns
import {
  AggregateRoot,
  EntityId,
  CommandHandler,
  QueryHandler,
  EventStore,
  EventBus,
  EventProjection,
  CQRS,
} from '@vytches/ddd-enterprise';

// Event-driven application
class EventDrivenApplication {
  async initialize(): Promise<void> {
    // Setup event infrastructure
    const eventStore = new EventStore();
    const eventBus = new EventBus();
    const projectionEngine = new ProjectionEngine();

    // Configure CQRS
    const cqrs = new CQRS({
      eventStore,
      eventBus,
      projectionEngine,
    });

    await cqrs.initialize();
  }
}
```

### Enterprise Bundle (Complete)

```typescript
// Complete enterprise features
import {
  // Everything from Advanced Bundle
  AggregateRoot,
  EventStore,
  CommandHandler,

  // Plus enterprise features
  CircuitBreaker,
  PolicyBuilder,
  Logger,
  HealthChecker,
  MetricsCollector,
  SagaOrchestrator,
  VytchesDDD,
} from '@vytches/ddd-enterprise';

// Full enterprise application
class EnterpriseApplication {
  async initialize(): Promise<void> {
    // Complete enterprise setup
    const container = new SimpleContainer();
    VytchesDDD.configure(container);

    // Health monitoring
    const healthChecker = new HealthChecker();

    // Performance monitoring
    const metrics = new MetricsCollector();

    // Business policies
    const policies = PolicyBuilder.create();

    // Resilience patterns
    const circuitBreaker = new CircuitBreaker({
      name: 'enterprise-app',
      threshold: 10,
      timeout: 30000,
    });

    // Saga orchestration
    const sagaOrchestrator = new SagaOrchestrator();

    // Initialize all components
    await Promise.all([
      healthChecker.initialize(),
      metrics.initialize(),
      circuitBreaker.initialize(),
      sagaOrchestrator.initialize(),
    ]);
  }
}
```

## 🔄 Migration Guide

### From Individual Packages

```typescript
// Before: Individual package imports
import { AggregateRoot } from '@vytches/ddd-aggregates';
import { EntityId } from '@vytches/ddd-value-objects';
import { CommandHandler } from '@vytches/ddd-cqrs';
import { EventStore } from '@vytches/ddd-event-store';
import { CircuitBreaker } from '@vytches/ddd-resilience';

// After: Single enterprise import
import {
  AggregateRoot,
  EntityId,
  CommandHandler,
  EventStore,
  CircuitBreaker,
} from '@vytches/ddd-enterprise';
```

### Conflict Resolution

```typescript
// Handle naming conflicts
import {
  RetryPolicy as ResilienceRetryPolicy, // From resilience
  PolicyRetryBehavior, // From policies
  PolicyBuilder,
} from '@vytches/ddd-enterprise';

// Use qualified names
const resilienceRetry = new ResilienceRetryPolicy({ maxAttempts: 3 });
const policyRetry = PolicyRetryBehavior.create(basePolicy, { maxAttempts: 3 });
```

### Configuration Migration

```typescript
// Update package.json
{
  "dependencies": {
    // Remove individual packages
    // "@vytches/ddd-core": "^0.1.0",
    // "@vytches/ddd-cqrs": "^0.1.0",
    // "@vytches/ddd-events": "^0.1.0",

    // Add enterprise bundle
    "@vytches/ddd-enterprise": "^0.2.0"
  }
}
```

## ⚡ Performance Optimization

### Tree Shaking

```typescript
// Import only what you need for optimal bundle size
import {
  AggregateRoot,
  EntityId,
  CommandHandler,
} from '@vytches/ddd-enterprise';

// Avoid importing entire modules
// import * as Enterprise from '@vytches/ddd-enterprise'; // ❌ Large bundle
```

### Lazy Loading

```typescript
// Lazy load heavy components
const loadEventStore = async () => {
  const { EventStore } = await import('@vytches/ddd-enterprise');
  return new EventStore();
};

const loadSagaOrchestrator = async () => {
  const { SagaOrchestrator } = await import('@vytches/ddd-enterprise');
  return new SagaOrchestrator();
};
```

### Connection Pooling

```typescript
import { ConnectionPoolManager } from '@vytches/ddd-enterprise';

const poolManager = new ConnectionPoolManager({
  database: {
    min: 5,
    max: 20,
    acquireTimeout: 30000,
  },
  eventStore: {
    min: 2,
    max: 10,
    acquireTimeout: 15000,
  },
});
```

## 🚀 Enterprise Deployment

### Production Configuration

```typescript
import {
  Logger,
  HealthChecker,
  MetricsCollector,
  CircuitBreaker,
  EventStore,
  VytchesDDD,
} from '@vytches/ddd-enterprise';

// Production-ready configuration
class ProductionSetup {
  async configure(): Promise<void> {
    // Configure logging
    Logger.configure({
      level: 'info',
      format: 'json',
      transports: ['console', 'file', 'elasticsearch'],
    });

    // Configure health checks
    const healthChecker = new HealthChecker({
      interval: 30000,
      timeout: 5000,
      retries: 3,
    });

    // Configure metrics
    const metrics = new MetricsCollector({
      interval: 10000,
      exporters: ['prometheus', 'datadog'],
    });

    // Configure circuit breakers
    const circuitBreaker = new CircuitBreaker({
      name: 'production-app',
      threshold: 50,
      timeout: 60000,
      resetTimeout: 300000,
    });

    // Configure event store
    const eventStore = new EventStore({
      provider: 'postgresql',
      connectionString: process.env.DATABASE_URL,
      pool: {
        min: 10,
        max: 50,
      },
    });

    await Promise.all([
      healthChecker.start(),
      metrics.start(),
      circuitBreaker.initialize(),
      eventStore.connect(),
    ]);
  }
}
```

### Container Orchestration

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://user:pass@db:5432/app
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:3000/health']
      interval: 30s
      timeout: 10s
      retries: 3

  db:
    image: postgres:15
    environment:
      - POSTGRES_DB=app
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass

  redis:
    image: redis:7-alpine
```

## 📊 Monitoring & Observability

### Metrics Collection

```typescript
import {
  MetricsCollector,
  PerformanceMonitor,
  AlertManager,
} from '@vytches/ddd-enterprise';

class ObservabilitySetup {
  private metrics = new MetricsCollector();
  private monitor = new PerformanceMonitor();
  private alerts = new AlertManager();

  async initialize(): Promise<void> {
    // Configure metrics
    this.metrics.configure({
      namespace: 'vytches-ddd',
      labels: {
        service: 'order-service',
        environment: 'production',
      },
    });

    // Setup performance monitoring
    this.monitor.track('command-execution', {
      threshold: 1000, // 1 second
      percentiles: [50, 95, 99],
    });

    // Configure alerts
    this.alerts.addRule({
      name: 'high-error-rate',
      condition: 'error_rate > 0.05',
      severity: 'critical',
      channels: ['slack', 'email'],
    });
  }
}
```

### Distributed Tracing

```typescript
import {
  TracingManager,
  SpanBuilder,
  TraceContext,
} from '@vytches/ddd-enterprise';

class TracingSetup {
  private tracer = new TracingManager();

  async traceCommandExecution<T>(
    commandName: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const span = this.tracer.startSpan(commandName);

    try {
      const result = await operation();
      span.setStatus('success');
      return result;
    } catch (error) {
      span.setStatus('error');
      span.recordException(error);
      throw error;
    } finally {
      span.end();
    }
  }
}
```

## 🔐 Security & Compliance

### Security Configuration

```typescript
import {
  SecurityManager,
  EncryptionService,
  AuditLogger,
  ComplianceChecker,
} from '@vytches/ddd-enterprise';

class SecuritySetup {
  private security = new SecurityManager();
  private encryption = new EncryptionService();
  private audit = new AuditLogger();
  private compliance = new ComplianceChecker();

  async configure(): Promise<void> {
    // Configure encryption
    this.encryption.configure({
      algorithm: 'aes-256-gcm',
      keyRotationInterval: 86400000, // 24 hours
      keyDerivation: 'pbkdf2',
    });

    // Configure audit logging
    this.audit.configure({
      events: ['command-execution', 'data-access', 'authentication'],
      retention: 2592000000, // 30 days
      encryption: true,
    });

    // Configure compliance
    this.compliance.configure({
      standards: ['SOC2', 'GDPR', 'HIPAA'],
      dataClassification: true,
      retentionPolicies: true,
    });
  }
}
```

### Access Control

```typescript
import {
  AuthorizationService,
  RoleBasedAccessControl,
  PolicyBasedAccessControl,
} from '@vytches/ddd-enterprise';

class AccessControlSetup {
  private authz = new AuthorizationService();
  private rbac = new RoleBasedAccessControl();
  private pbac = new PolicyBasedAccessControl();

  async configure(): Promise<void> {
    // Configure RBAC
    this.rbac.defineRoles({
      admin: ['create', 'read', 'update', 'delete'],
      user: ['read', 'update_own'],
      guest: ['read'],
    });

    // Configure PBAC
    this.pbac.definePolicy({
      name: 'order-access',
      rules: [
        { effect: 'allow', subject: 'user', action: 'read', resource: 'order' },
        { effect: 'allow', subject: 'owner', action: '*', resource: 'order' },
        { effect: 'deny', subject: '*', action: 'delete', resource: 'order' },
      ],
    });
  }
}
```

## 🧪 Testing

### Enterprise Testing Setup

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import {
  TestHarness,
  MockContainer,
  TestEventStore,
  TestMetrics,
  safeRun,
} from '@vytches/ddd-enterprise';

describe('Enterprise Order Service', () => {
  let harness: TestHarness;
  let container: MockContainer;
  let eventStore: TestEventStore;

  beforeEach(async () => {
    harness = new TestHarness();
    container = new MockContainer();
    eventStore = new TestEventStore();

    await harness.setup({
      container,
      eventStore,
      metrics: new TestMetrics(),
    });
  });

  describe('Complete Order Flow', () => {
    it('should process order end-to-end', async () => {
      // Arrange
      const orderData = {
        customerId: EntityId.generate(),
        items: [{ productId: 'product-1', quantity: 2 }],
      };

      // Act
      const [error, result] = await safeRun(async () => {
        const command = new CreateOrderCommand(orderData);
        return await harness.execute(command);
      });

      // Assert
      expect(error).toBeUndefined();
      expect(result).toBeDefined();
      expect(eventStore.events).toHaveLength(1);
      expect(eventStore.events[0].eventType).toBe('OrderCreated');
    });

    it('should handle failures gracefully', async () => {
      // Arrange
      const invalidOrderData = {
        customerId: EntityId.generate(),
        items: [], // Empty items should fail validation
      };

      // Act
      const [error] = await safeRun(async () => {
        const command = new CreateOrderCommand(invalidOrderData);
        return await harness.execute(command);
      });

      // Assert
      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toContain('validation failed');
    });
  });
});
```

### Integration Testing

```typescript
import {
  IntegrationTestHarness,
  TestDatabase,
  TestEventStore,
  TestMessageBus,
} from '@vytches/ddd-enterprise';

describe('Integration Tests', () => {
  let harness: IntegrationTestHarness;
  let database: TestDatabase;
  let eventStore: TestEventStore;
  let messageBus: TestMessageBus;

  beforeEach(async () => {
    database = new TestDatabase();
    eventStore = new TestEventStore();
    messageBus = new TestMessageBus();

    harness = new IntegrationTestHarness({
      database,
      eventStore,
      messageBus,
    });

    await harness.initialize();
  });

  afterEach(async () => {
    await harness.cleanup();
  });

  it('should handle complete order fulfillment saga', async () => {
    // Test complete saga flow
    const orderData = createTestOrderData();

    const [error, result] = await safeRun(async () => {
      return await harness.executeSaga('OrderFulfillmentSaga', orderData);
    });

    expect(error).toBeUndefined();
    expect(result?.status).toBe('completed');
  });
});
```

## ✅ Best Practices

### Enterprise Architecture

1. **Use Bundle Strategically**: Choose the right bundle level for your needs
2. **Implement Monitoring**: Set up comprehensive monitoring and alerting
3. **Security First**: Implement security patterns from the start
4. **Performance Optimization**: Use tree shaking and lazy loading

```typescript
// ✅ Good: Strategic bundle usage
import {
  AggregateRoot,
  CommandHandler,
  EventStore,
  CircuitBreaker,
  Logger,
} from '@vytches/ddd-enterprise';

// ✅ Good: Comprehensive monitoring
class EnterpriseService {
  private logger = Logger.forContext('EnterpriseService');
  private metrics = new MetricsCollector();
  private circuitBreaker = new CircuitBreaker({ name: 'enterprise-service' });

  async processRequest(request: Request): Promise<Response> {
    const span = this.tracer.startSpan('processRequest');

    try {
      const result = await this.circuitBreaker.execute(async () => {
        return await this.handleRequest(request);
      });

      this.metrics.increment('request.success');
      return result;
    } catch (error) {
      this.logger.error('Request processing failed', error);
      this.metrics.increment('request.failure');
      throw error;
    } finally {
      span.end();
    }
  }
}
```

### Performance Optimization

1. **Tree Shaking**: Import only what you need
2. **Lazy Loading**: Load heavy components on demand
3. **Connection Pooling**: Optimize database connections
4. **Caching**: Implement intelligent caching strategies

```typescript
// ✅ Good: Optimized imports
import { AggregateRoot, CommandHandler } from '@vytches/ddd-enterprise';

// ✅ Good: Lazy loading
const loadEventStore = async () => {
  const { EventStore } = await import('@vytches/ddd-enterprise');
  return new EventStore();
};

// ✅ Good: Connection pooling
const poolManager = new ConnectionPoolManager({
  database: { min: 5, max: 20 },
  eventStore: { min: 2, max: 10 },
});
```

### Security Implementation

1. **Encryption**: Encrypt sensitive data at rest and in transit
2. **Access Control**: Implement RBAC and PBAC
3. **Audit Logging**: Log all security-relevant events
4. **Compliance**: Ensure compliance with relevant standards

```typescript
// ✅ Good: Security-first approach
class SecureOrderService {
  private encryption = new EncryptionService();
  private audit = new AuditLogger();
  private authz = new AuthorizationService();

  async createOrder(orderData: OrderData, user: User): Promise<Order> {
    // Check authorization
    await this.authz.check(user, 'create', 'order');

    // Encrypt sensitive data
    const encryptedData = await this.encryption.encrypt(orderData);

    // Audit the action
    this.audit.log({
      action: 'create_order',
      user: user.id,
      resource: 'order',
      timestamp: new Date(),
    });

    return await this.processOrder(encryptedData);
  }
}
```

## 📚 Contributing

We welcome contributions! Please see our
[Contributing Guide](../../CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone repository
git clone https://github.com/vytches/ddd.git

# Install dependencies
pnpm install

# Run tests
pnpm test

# Build enterprise bundle
pnpm build:enterprise
```

---

**Built with ❤️ by the VytchesDDD Team**

_The complete Enterprise bundle for
[@vytches/ddd-core](https://github.com/vytches/vytches-ddd) ecosystem - Your
complete Domain-Driven Design solution for TypeScript_
