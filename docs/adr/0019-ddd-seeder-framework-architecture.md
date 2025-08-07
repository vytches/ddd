# ADR-0019: DDD Seeder Framework Architecture and Implementation Strategy

## Status

**PROPOSED** - January 2025

## Context

The VytchesDDD library requires a comprehensive test data generation framework that respects Domain-Driven Design patterns. Current testing infrastructure includes a basic TestDataBuilder, but lacks critical features for production-grade seeding:

- No aggregate boundary respect
- Limited domain event generation
- No database provider abstraction
- Missing streaming support for large datasets
- No test-type specific adapters

### Requirements Analysis

Based on comprehensive analysis, the seeder framework needs to:

1. **DDD-Native Design**: Respect aggregate boundaries, generate real domain events, support sagas
2. **Performance**: Handle millions of records via streaming architecture
3. **Flexibility**: Support multiple database providers (PostgreSQL, MongoDB, MySQL, SQLite, InMemory)
4. **Test Coverage**: Provide adapters for unit, integration, E2E, performance, security, and penetration testing
5. **Integration**: Seamlessly integrate with existing VytchesDDD packages

### Options Considered

1. **Generic Seeder Library**: Build a standalone, framework-agnostic seeder
2. **DDD-Native Seeder**: Build specifically for VytchesDDD integration
3. **Extend Existing Libraries**: Adapt popular seeders like Faker.js or Factory.ts

## Decision

We will build a **DDD-native seeder framework** specifically designed for VytchesDDD, following a phased approach:

### Phase 1: Foundation (In @vytches/ddd-testing)
- Start development within the existing testing package
- Leverage existing infrastructure and dogfood immediately
- Rapid iteration without external dependency management

### Phase 2: Extraction (Post v1.0)
- Extract to separate repository `@vytches/seeder`
- Follow ADR-0017's multi-repository strategy
- Enable independent versioning and release cycles

### Architecture Decisions

#### 1. Factory Pattern over Builder Pattern
```typescript
// Factory approach (chosen)
const userFactory = new AggregateFactory(UserAggregate)
  .withDefaults({ status: 'active' })
  .withSequence('email', n => `user${n}@example.com`);

// vs Builder pattern (rejected)
const userBuilder = new UserBuilder()
  .withEmail('user@example.com')
  .build();
```

**Rationale**: Factories provide better composability and align with DDD patterns.

#### 2. Streaming-First Architecture
```typescript
// Stream millions of records efficiently
await seeder
  .stream(OrderAggregate, 1_000_000)
  .withBatchSize(1000)
  .withBackpressure()
  .toDB();
```

**Rationale**: Essential for performance testing and large-scale data generation.

#### 3. Provider Abstraction
```typescript
const seeder = new DomainSeeder({
  providers: [
    new PostgreSQLProvider(config),
    new MongoDBProvider(config),
    new InMemoryProvider()
  ]
});
```

**Rationale**: Flexibility for different testing scenarios and environments.

## Implementation Strategy

### Timeline
- **Week 1-2**: Enhance existing TestDataBuilder with factory pattern
- **Week 3**: Add DDD integration (events, aggregates, repositories)
- **Week 4**: Implement database providers and streaming
- **Week 5**: Create test-type specific adapters
- **Post v1.0**: Extract to separate repository

### Package Dependencies
```json
{
  "@vytches/ddd-core": "workspace:*",
  "@vytches/ddd-events": "workspace:*",
  "@vytches/ddd-repositories": "workspace:*",
  "@vytches/ddd-logging": "workspace:*",
  "@vytches/ddd-di": "workspace:*"
}
```

### API Design
```typescript
// Core API
const seeder = new DomainSeeder()
  .forAggregate(UserAggregate)
  .withFactory(userFactory)
  .withEvents(true)
  .withRelations(['orders', 'payments']);

// Generate test data
const users = await seeder.generate(100);
const admin = await seeder.generateOne({ role: 'admin' });

// Database seeding
await seeder.seed({
  users: 1000,
  orders: 5000,
  products: 100
});
```

## Consequences

### Positive
- ✅ **DDD-Native**: First-class support for DDD patterns
- ✅ **Performance**: Streaming architecture handles large datasets
- ✅ **Flexibility**: Multiple database providers and test adapters
- ✅ **Integration**: Seamless with VytchesDDD ecosystem
- ✅ **Dogfooding**: Immediate use in VytchesDDD's own tests
- ✅ **Market Differentiation**: Unique DDD-focused seeding solution

### Negative
- ❌ **Initial Coupling**: Starts within testing package before extraction
- ❌ **Maintenance**: Additional package to maintain
- ❌ **Learning Curve**: New API for developers to learn

### Neutral
- ⚖️ **Migration Path**: One-time effort to extract to separate repository
- ⚖️ **Versioning**: Initially tied to testing package version

## Migration Plan

### Phase 1: Clean Implementation (Current)
1. **Remove** existing TestDataBuilder (unused, no breaking changes)
2. Create new DDD-native seeder in separate directory structure
3. Implement factory pattern from scratch with DDD focus
4. No legacy code to maintain

### Phase 2: Extraction (Post v1.0)
1. Create new repository: `github.com/vytches/seeder`
2. Extract seeder code to new repository
3. Update dependencies in main repository
4. Publish as `@vytches/seeder`

### Phase 3: Evolution
1. Independent versioning and releases
2. Community contributions
3. Enterprise features (if applicable)

## Success Metrics

- **Adoption**: Used in 80%+ of VytchesDDD test suites
- **Performance**: Generate 1M+ records in <60 seconds
- **Coverage**: Support all major test types
- **Community**: 100+ GitHub stars within 6 months
- **Enterprise**: Used by 10+ enterprise customers

## Related Decisions

- **ADR-0017**: Vytches organization and repository structure
- **ADR-0016**: Individual package publishing strategy
- **Implementation Guide**: `/docs/DDD_SEEDER_IMPLEMENTATION_GUIDE.md`

## References

- [DDD Seeder Implementation Guide](/docs/DDD_SEEDER_IMPLEMENTATION_GUIDE.md)
- [Current TestDataBuilder](/packages/testing/src/core/test-data-builder.ts)
- [Roadmap Phase 1](/ROADMAP.md#phase-1-stabilization--community-q1-2026)

---

**Decision made by**: Development Team  
**Date**: January 2025  
**Review date**: April 2025