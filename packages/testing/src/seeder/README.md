# VytchesDDD Seeder Framework

## Overview

A comprehensive domain data seeding framework with full DDD pattern support.
Provides type-safe generation of aggregates, value objects, and test scenarios
while respecting domain boundaries and business rules.

## Architecture

The framework uses the **Factory pattern** instead of Builder for better
composability and DDD compliance:

- **DomainSeeder** - Main orchestrator with fluent API
- **AggregateFactory** - Factory for type-safe aggregate creation
- **AggregateSeeder** - Aggregate seeder with business rule validation
- **ValueObjectBuilder** - Builder for value objects with validation
- **EntityIdGenerator** - ID generator with multiple strategies
- **StreamingSeeder** - Efficient generation for large datasets

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

This is just the beginning of the framework's capabilities. Refer to the
documentation of individual classes for more detailed examples and advanced
features.
