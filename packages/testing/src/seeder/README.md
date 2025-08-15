# VytchesDDD Seeder Framework

A comprehensive test data generation framework for Domain-Driven Design
applications, providing type-safe, business rule compliant, and high-performance
data seeding capabilities.

## Overview

The DDD Seeder Framework follows the Factory pattern over Builder pattern for
better composability and implements a streaming-first architecture for
performance with large datasets. It provides deep integration with all
VytchesDDD packages while respecting domain boundaries and business rules.

## Core Components

### DomainSeeder (Main Orchestrator)

The central entry point providing factory methods for different types of
seeders:

```typescript
import { DomainSeeder } from '@vytches/ddd-testing/seeder';

// Configure global settings
DomainSeeder.configure({
  enableEvents: true,
  defaultBatchSize: 1000,
  randomSeed: 'reproducible-seed',
});

// Simple aggregate seeding
const userSeeder = DomainSeeder.forAggregate(UserAggregate)
  .withDefaults({ status: 'active' })
  .withSequence('email', n => `user${n}@example.com`);

const user = await userSeeder.build();
const users = await userSeeder.buildMany(100);
```

### AggregateFactory (Factory Pattern Implementation)

Type-safe aggregate generation with template systems and business rule
validation:

```typescript
import { AggregateFactory } from '@vytches/ddd-testing/seeder';

const orderFactory = new AggregateFactory(OrderAggregate)
  .withTemplate('basic-order', {
    amount: 100,
    currency: 'USD',
    status: 'pending',
  })
  .withSequence('orderId', n => `ORDER-${n.toString().padStart(6, '0')}`)
  .withRelationship('customerId', () => randomCustomerId())
  .withValidation(order => order.amount > 0);

// Generate single order
const result = await orderFactory.create();
if (result.isSuccess) {
  const order = result.value;
  // Use the generated order
}

// Generate multiple orders with overrides
const orders = await orderFactory.createMany(50, {
  status: 'confirmed',
});
```

### ValueObjectBuilder (Business Rule Compliance)

Specialized builder for value objects with constraint handling:

```typescript
import { ValueObjectBuilder } from '@vytches/ddd-testing/seeder';

const emailBuilder = new ValueObjectBuilder(EmailVO)
  .withConstraints({
    pattern: /^[^@]+@[^@]+\.[^@]+$/,
    forbiddenValues: ['admin@test.com'],
  })
  .withBusinessRules(['valid-email-format', 'no-disposable-emails'])
  .withTemplate({
    name: 'corporate-email',
    generator: () => ({
      value: faker.internet.email({ provider: 'company.com' }),
    }),
  });

const email = await emailBuilder.build('corporate-email');
const emails = await emailBuilder.buildMany(100);
```

### EntityIdGenerator (ID Generation Strategies)

Comprehensive EntityId generation with multiple strategies:

```typescript
import { EntityIdGenerator } from '@vytches/ddd-testing/seeder';

// UUID strategy
const userId = EntityIdGenerator.uuid();

// Sequential strategy
const orderId = EntityIdGenerator.sequential('ORDER', 6); // ORDER-000001

// Pattern-based strategy with context
const invoiceId = EntityIdGenerator.pattern(
  'INV-{{year}}-{{month}}-{{sequence}}',
  'invoice'
);

// Domain-specific presets
const customerId = EntityIdGenerator.customerPreset('premium');
const productId = EntityIdGenerator.productPreset('electronics');
```

### StreamingSeeder (High-Performance Architecture)

Memory-efficient streaming for large-scale data generation:

```typescript
import { StreamingSeeder } from '@vytches/ddd-testing/seeder';

const streamingSeeder = new StreamingSeeder(UserAggregate)
  .withBatchSize(1000)
  .withBackpressure({ highWaterMark: 10000 })
  .withMemoryManagement(500) // 500MB limit
  .withProgressTracking(true);

// Stream millions of aggregates efficiently
for await (const userResult of streamingSeeder.stream(1_000_000)) {
  if (userResult.isSuccess) {
    // Process user (automatically batched and memory-managed)
    await persistUser(userResult.value);
  } else {
    console.error('Failed to generate user:', userResult.error);
  }
}

// Monitor progress
streamingSeeder.on('progress', progress => {
  console.log(
    `Progress: ${progress.completed}/${progress.total} (${progress.rate}/s)`
  );
});
```

## Basic Usage

### 1. Single Aggregate Generation

```typescript
import { DomainSeeder } from '@vytches/ddd-testing';

// Simple user seeder
const userSeeder = DomainSeeder.forAggregate(UserAggregate)
  .withDefaults({
    status: 'active',
    role: 'user',
    emailVerified: false,
  })
  .withSequence('email', n => `user${n}@example.com`)
  .withSequence('username', n => `user_${String(n).padStart(4, '0')}`);

// Generate single user
const user = await userSeeder.build();

// Generate 100 users
const users = await userSeeder.buildMany(100);
```

### 2. Using Templates

```typescript
// Admin template definition
const adminTemplate = {
  name: 'admin-user',
  description: 'Administrative user with full permissions',
  defaults: {
    role: 'admin',
    status: 'active',
    emailVerified: true,
  },
  sequences: {
    email: n => `admin${n}@company.com`,
  },
  valueObjects: {
    permissions: () => PermissionsVO.create(['read', 'write', 'admin']),
  },
};

const userSeeder =
  DomainSeeder.forAggregate(UserAggregate).withTemplate(adminTemplate);

// Create admin using template
const admin = await userSeeder.build({}, 'admin-user');
```

### 3. Value Object Generation

```typescript
import { ValueObjectBuilder } from '@vytches/ddd-testing';

const emailBuilder = new ValueObjectBuilder(EmailVO)
  .withConstraints({
    domain: 'example.com',
    maxLength: 50,
  })
  .withBusinessRules([
    email => email.includes('@'),
    email => !email.startsWith('.'),
  ])
  .withTemplate('user-email', {
    pattern: '{{firstName}}.{{lastName}}@example.com',
  });

// Generate 50 email addresses
const emails = await emailBuilder.buildMany(50);
```

### 4. EntityId Generation

```typescript
import { EntityIdGenerator } from '@vytches/ddd-testing';

// UUID-based
const userId = EntityIdGenerator.uuid();

// Sequential with prefix
const orderId = EntityIdGenerator.sequential('ORDER', 4); // ORDER-0001

// Pattern-based
const productId = EntityIdGenerator.pattern('PROD-{{year}}-{{sequence:3}}'); // PROD-2025-001

// From predefined presets
const customerId = EntityIdGenerator.presets.users.customer(); // CUST-A1B2C3
```

### 5. EntityId Patterns

The framework supports the following placeholders:

- `{{uuid}}` - Full UUID
- `{{uuid:8}}` - First 8 characters of UUID
- `{{sequence}}` - Sequential number
- `{{sequence:4}}` - Sequential number with 4-digit padding
- `{{timestamp}}` - Unix timestamp
- `{{date}}` - YYYY-MM-DD format
- `{{year}}` - Current year
- `{{month}}` - Current month (01-12)
- `{{random:6}}` - Random alphanumeric string of specified length
- `{{faker:word}}` - Faker.js word

```typescript
// Pattern examples
const eventId = EntityIdGenerator.pattern('EVENT-{{timestamp}}-{{uuid:8}}');
// Result: "EVENT-1706123456-a1b2c3d4"

const subscriptionId = EntityIdGenerator.pattern(
  'SUB-{{year}}{{month}}-{{sequence:3}}'
);
// Result: "SUB-202508-001"
```

## Advanced Scenarios

### 1. Multi-Aggregate Scenarios

```typescript
const marketplaceScenario = DomainSeeder.scenario('active-marketplace')
  .withAggregates({
    users: 1000,
    products: 500,
    orders: 2000,
  })
  .withRelationships({
    'users.orders': { min: 0, max: 10, avg: 3 },
    'products.orders': { min: 1, max: 100, avg: 20 },
  })
  .withTimeline('6months');

const scenario = await marketplaceScenario.seed();
```

### 2. Geographic Scenarios

```typescript
const neighborhoodScenario = DomainSeeder.geographicScenario('warsaw-mokotow')
  .withBoundaries({
    center: { lat: 52.1946, lng: 21.0147 },
    radius: 2000,
    density: 'urban',
  })
  .withUsers({ count: 500, verificationRate: 0.8 })
  .withBusinesses({
    types: ['restaurant', 'pharmacy'],
    density: 'medium',
  });

const neighborhood = await neighborhoodScenario.seed();
```

### 3. Event Sourcing

```typescript
const orderHistory = DomainSeeder.eventSourcedScenario('order-lifecycle')
  .withEventStream(stream =>
    stream
      .start('OrderCreated', { orderId: 'order-123', amount: 1000 })
      .after('2h', 'PaymentProcessed', { paymentId: 'pay-456' })
      .after('1h', 'OrderShipped', { trackingNumber: 'TRK789' })
  )
  .withSnapshots({ every: 5 });

const history = await orderHistory.generateWithHistory();
```

### 4. Crisis Scenarios

```typescript
const crisisTest = DomainSeeder.crisisScenario('neighborhood-flooding')
  .withBaseline('active-community')
  .injectCrisis({
    type: 'natural-disaster',
    subtype: 'flooding',
    severity: 'high',
    triggerAt: 'day-30',
    duration: '6hours',
    affectedArea: 0.6,
  })
  .withEmergencyResponse({
    alertPropagation: 'exponential',
  });

const crisis = await crisisTest.seed();
```

### 5. Multi-Tenancy

```typescript
const multiTenantScenario = DomainSeeder.multiTenantScenario('saas-platform')
  .withTenants([
    { id: 'tenant-1', plan: 'enterprise', users: 1000 },
    { id: 'tenant-2', plan: 'starter', users: 50 },
  ])
  .withIsolationValidation(true);

const platform = await multiTenantScenario.seed();
```

### 6. Saga Workflows

```typescript
const sagaScenario = DomainSeeder.sagaScenario('order-payment-workflow')
  .withWorkflowSteps([
    'CreateOrder',
    'ReserveInventory',
    'ProcessPayment',
    'ShipOrder',
  ])
  .withCompensationActions({
    ProcessPayment: 'RefundPayment',
    ReserveInventory: 'ReleaseInventory',
  })
  .withFailureScenarios(['payment-declined', 'inventory-unavailable']);

const workflow = await sagaScenario.seed();
```

## Streaming for Large Datasets

```typescript
const userSeeder = DomainSeeder.forAggregate(UserAggregate).withDefaults({
  status: 'active',
});

// Generate 1 million users with streaming
for await (const userResult of userSeeder.stream(1_000_000, {
  batchSize: 1000,
})) {
  if (userResult.isSuccess) {
    await processUser(userResult.value);
  }
}
```

## Global Configuration

```typescript
// Set global configuration
DomainSeeder.configure({
  enableEvents: true,
  defaultBatchSize: 1000,
  enableMetrics: true,
  randomSeed: 'test-seed-123',
  memoryLimit: 512, // MB
});

// Reset configuration
DomainSeeder.resetGlobalConfig();
```

## Predefined EntityId Presets

The framework includes predefined presets for common domains:

### Users

```typescript
EntityIdGenerator.presets.users.standard(); // USER-001
EntityIdGenerator.presets.users.admin(); // ADMIN-2025-001
EntityIdGenerator.presets.users.customer(); // CUST-A1B2C3
EntityIdGenerator.presets.users.guest(); // GUEST-1706123456
```

### Orders

```typescript
EntityIdGenerator.presets.orders.standard(); // ORDER-2025-0001
EntityIdGenerator.presets.orders.draft(); // DRAFT-A1B2C3D4
EntityIdGenerator.presets.orders.subscription(); // SUB-202508-001
EntityIdGenerator.presets.orders.return(); // RET-a1b2c3d4e5f6
```

### Products

```typescript
EntityIdGenerator.presets.products.standard(); // PROD-001
EntityIdGenerator.presets.products.sku(); // SKU-A1B2C3-01
EntityIdGenerator.presets.products.category(); // CAT-electronics-001
```

### Events

```typescript
EntityIdGenerator.presets.events.domain(); // EVT-1706123456-a1b2c3d4
EntityIdGenerator.presets.events.integration(); // INT-2025-08-15-0001
EntityIdGenerator.presets.events.audit(); // AUDIT-202508-00001
```

## VytchesDDD Integration

The framework is deeply integrated with all VytchesDDD packages:

- **Aggregates** - Automatic domain event generation
- **Repositories** - Integration with Unit of Work pattern
- **CQRS** - Command and query generation
- **Policies** - Business rule validation
- **Resilience** - Resilience patterns for seeding operations

## Result API

All operations use the VytchesDDD Result API:

```typescript
const result = await userSeeder.build();

if (result.isSuccess) {
  const user = result.value;
  console.log('User created:', user.id);
} else {
  console.error('Error:', result.error.message);
}
```

## Best Practices

1. **Use templates** for repeatable patterns
2. **Configure seeds** for repeatable tests
3. **Reset counters** between tests
4. **Use streaming** for large datasets (>10k items)
5. **Validate business rules** in factories
6. **Group related aggregates** in scenarios
7. **Monitor memory** during large operations

## Extending the Framework

The framework can be easily extended with custom strategies and seeders:

```typescript
// Custom EntityId strategy
class CustomEntityIdStrategy {
  static companySpecific(): EntityId {
    return EntityIdGenerator.pattern(
      'COMP-{{year}}-{{department}}-{{sequence:4}}'
    );
  }
}

// Custom seeder
class ProductSeeder extends AggregateSeeder<ProductAggregate> {
  withCategory(category: string): this {
    return this.withDefaults({ category });
  }
}
```

## Test Examples

```typescript
describe('UserAggregate Seeding', () => {
  beforeEach(() => {
    EntityIdGenerator.resetCounters();
  });

  test('should generate users with unique emails', async () => {
    const userSeeder = DomainSeeder.forAggregate(UserAggregate).withSequence(
      'email',
      n => `test${n}@example.com`
    );

    const users = await userSeeder.buildMany(10);

    expect(users.isSuccess).toBe(true);
    expect(users.value).toHaveLength(10);

    const emails = users.value.map(u => u.email);
    expect(new Set(emails)).toHaveLength(10); // All unique
  });
});
```

## Performance Features

### Memory Management

- **Backpressure handling**: Automatically pauses generation when memory usage
  is high
- **Garbage collection hints**: Triggers GC when memory limits are approached
- **Streaming architecture**: Never loads all data into memory simultaneously
- **Batch processing**: Configurable batch sizes for optimal performance

### Monitoring and Metrics

```typescript
// Get comprehensive performance metrics
const metrics = streamingSeeder.getMetrics();
console.log({
  totalItems: metrics.totalItems,
  averageRate: metrics.averageRate,
  peakRate: metrics.peakRate,
  memoryStats: metrics.memoryStats,
  errorStats: metrics.errorStats,
  batchStats: metrics.batchStats,
});

// Listen to real-time events
streamingSeeder.on('progress', progress => {
  console.log(`${progress.completed}/${progress.total} completed`);
  console.log(
    `Rate: ${progress.rate}/s, ETA: ${progress.estimatedTimeRemaining}ms`
  );
  console.log(
    `Memory: ${progress.memoryUsage}MB, Errors: ${progress.errorCount}`
  );
});

streamingSeeder.on('backpressure', ({ memoryUsage, watermark }) => {
  console.log(`Backpressure triggered: ${memoryUsage}MB > ${watermark}MB`);
});
```

## Error Handling

The framework uses the VytchesDDD Result pattern throughout:

```typescript
const result = await aggregateFactory.create();

if (result.isSuccess) {
  const aggregate = result.value;
  // Success path
} else {
  const error = result.error;
  console.error('Generation failed:', error.message);
  // Handle error appropriately
}

// For streaming operations
for await (const itemResult of streamingSeeder.stream(1000)) {
  if (itemResult.isFailure) {
    // Handle individual item failures
    console.error('Item generation failed:', itemResult.error);
    continue;
  }

  // Process successful item
  await processItem(itemResult.value);
}
```

## Architecture Principles

### Factory Pattern Over Builder Pattern

The framework uses the Factory pattern instead of Builder pattern for several
reasons:

1. **Better Composability**: Factories can be easily combined and reused
2. **DDD Alignment**: Factories are a natural DDD pattern for complex object
   creation
3. **Performance**: Less method chaining overhead
4. **Flexibility**: Easier to implement conditional logic and validation

### Streaming-First Architecture

All seeders are designed with streaming in mind:

1. **Memory Efficiency**: Never load entire datasets into memory
2. **Backpressure Support**: Automatic flow control to prevent resource
   exhaustion
3. **Scalability**: Handle millions of records without performance degradation
4. **Interruptible**: Can be stopped and resumed gracefully

### Business Rule Compliance

Every aspect of data generation respects domain rules:

1. **Validation Integration**: Built-in validation with retry mechanisms
2. **Constraint Handling**: Sophisticated constraint satisfaction
3. **Business Logic**: Templates can encode complex business scenarios
4. **Domain Events**: Automatic event generation with realistic timelines

## Migration from Other Tools

### From Faker.js

```typescript
// Before (Faker.js)
const user = {
  id: faker.datatype.uuid(),
  email: faker.internet.email(),
  name: faker.person.fullName(),
};

// After (VytchesDDD Seeder)
const userResult = await DomainSeeder.forAggregate(UserAggregate)
  .withDefaults({ status: 'active' })
  .build();

const user = userResult.value; // Fully validated domain aggregate
```

### From Factory Boy (Python)

```typescript
// Similar to Factory Boy, but with TypeScript safety and DDD principles
const userFactory = new AggregateFactory(UserAggregate)
  .withSequence('email', n => `user${n}@example.com`)
  .withLazyAttribute('hashedPassword', user => hashPassword(user.email))
  .withTrait('premium', { subscriptionLevel: 'premium' });

const premiumUser = await userFactory.create({ premium: true });
```

## Troubleshooting

### Common Issues

1. **Memory Exhaustion**

   - Reduce batch size
   - Enable memory management
   - Use streaming instead of buildMany()

2. **Slow Performance**

   - Increase batch size (if memory allows)
   - Disable unnecessary validation
   - Use templates instead of complex generation logic

3. **Validation Failures**

   - Check business rule implementations
   - Increase retry attempts
   - Review constraint configurations

4. **Circular Dependencies**
   - Use the SeedableAggregate interface
   - Avoid importing AggregateRoot directly in seeder code
   - Leverage dependency injection patterns

## Contributing

When extending the seeder framework:

1. Follow the Factory pattern for new seeder types
2. Always use the Result pattern for error handling
3. Implement streaming support for large-scale operations
4. Add comprehensive tests with >95% coverage
5. Document all public APIs with JSDoc
6. Validate against business rules and domain constraints

## Roadmap

- **Phase 2**: Event sourcing integration and timeline management
- **Phase 3**: AI-enhanced realistic data generation
- **Phase 4**: Database provider implementations (PostgreSQL, MongoDB, etc.)
- **Phase 5**: Visual scenario builder and template marketplace

---

**Note**: This is Phase 1 Week 1 implementation of VF-007 DDD Seeder Framework.
More advanced features and specialized seeders will be added in subsequent
phases.
