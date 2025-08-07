# VytchesDDD Seeder - Complete Implementation Guide

## 📋 Executive Summary

### Vision
Create a **DDD-native seeding framework** that deeply integrates with VytchesDDD architecture, respecting domain boundaries, aggregates, events, and all DDD patterns while providing excellent developer experience for all test types.

### Decision: Package Strategy
**Start in `@vytches/ddd-testing`** for rapid iteration and dogfooding, then **migrate to `@vytches/ddd-seeder`** after v1.0 stability.

**Rationale:**
- ✅ Immediate access to VytchesDDD internals during development
- ✅ Faster feedback loop from existing test infrastructure
- ✅ Natural evolution path (testing → seeder)
- ✅ Clean separation once stable (prevents testing package bloat)

### Target Timeline
- **Phase 1 (2 weeks)**: Core implementation in testing package
- **Phase 2 (1 week)**: DDD patterns integration
- **Phase 3 (1 week)**: Advanced features
- **Phase 4 (3 days)**: Package extraction to @vytches/ddd-seeder
- **Total: ~1 month** to production-ready

---

## 🏗️ Architecture Design

### Core Principles

1. **Domain-First**: Every operation respects domain boundaries
2. **Type-Safe**: Full TypeScript inference, zero runtime errors
3. **Lazy Evaluation**: Generate only what's needed, when needed
4. **Event-Aware**: Automatic domain event generation
5. **Test-Optimized**: Transaction safety, isolation, cleanup

### Layer Architecture

```
┌─────────────────────────────────────────────┐
│            Test Framework Layer             │
│         (Vitest, Jest, Playwright)          │
├─────────────────────────────────────────────┤
│           DDD Seeder Public API             │
│    (Factories, Scenarios, Assertions)       │
├─────────────────────────────────────────────┤
│          Core Seeding Engine                │
│  (Generator, Validator, Relationship Mgr)   │
├─────────────────────────────────────────────┤
│         VytchesDDD Integration              │
│ (Aggregates, Events, Repos, CQRS, Policies) │
├─────────────────────────────────────────────┤
│           Provider Abstraction              │
│   (InMemory, Database, Stream, Security)    │
└─────────────────────────────────────────────┘
```

---

## 🔧 Implementation Plan

### Phase 1: Core Foundation (Week 1-2)

#### 1.1 Base Abstractions

```typescript
// packages/testing/src/seeder/core/types.ts

import type { IAggregateRoot, IEntity, IValueObject } from '@vytches/ddd-core';
import type { IDomainEvent } from '@vytches/ddd-events';

/**
 * Core factory interface for all DDD constructs
 */
export interface IDDDFactory<T> {
  /**
   * Build entity in memory without persistence
   */
  build(overrides?: DeepPartial<T>): T;
  
  /**
   * Build and persist through repository
   */
  create(overrides?: DeepPartial<T>): Promise<T>;
  
  /**
   * Build multiple entities
   */
  buildMany(count: number, overrides?: DeepPartial<T>): T[];
  
  /**
   * Create multiple entities with batching
   */
  createMany(count: number, overrides?: DeepPartial<T>): Promise<T[]>;
  
  /**
   * Build as async stream for large datasets
   */
  buildStream(count: number): AsyncIterator<T>;
  
  /**
   * Apply traits/states to factory
   */
  use(...traits: string[]): IDDDFactory<T>;
  
  /**
   * Set specific state
   */
  state(stateName: string): IDDDFactory<T>;
}

/**
 * Factory definition with DDD awareness
 */
export interface IFactoryDefinition<T> {
  /**
   * The DDD construct type
   */
  type: 'aggregate' | 'entity' | 'valueObject' | 'domainEvent';
  
  /**
   * Default values generator
   */
  defaults: () => DeepPartial<T>;
  
  /**
   * Available traits
   */
  traits?: Record<string, Partial<T>>;
  
  /**
   * Available states (for aggregates)
   */
  states?: Record<string, (entity: T) => T>;
  
  /**
   * Lazy attributes (computed on demand)
   */
  lazy?: Record<string, () => any>;
  
  /**
   * Transient attributes (not persisted)
   */
  transient?: Record<string, any>;
  
  /**
   * Post-build hooks
   */
  afterBuild?: (entity: T) => T | Promise<T>;
  
  /**
   * Validation rules
   */
  validate?: (entity: T) => boolean | string;
}
```

#### 1.2 Factory Implementation

```typescript
// packages/testing/src/seeder/core/factory.ts

import { Logger } from '@vytches/ddd-logging';
import type { IRepository } from '@vytches/ddd-repositories';

export class DDDFactory<T> implements IDDDFactory<T> {
  private logger = Logger.forContext('DDDFactory');
  private definition: IFactoryDefinition<T>;
  private repository?: IRepository<T>;
  private appliedTraits: Set<string> = new Set();
  private currentState?: string;
  
  constructor(
    definition: IFactoryDefinition<T>,
    repository?: IRepository<T>
  ) {
    this.definition = definition;
    this.repository = repository;
  }
  
  build(overrides?: DeepPartial<T>): T {
    this.logger.debug('Building entity', { 
      type: this.definition.type,
      traits: Array.from(this.appliedTraits)
    });
    
    // 1. Start with defaults
    let entity = { ...this.definition.defaults() } as T;
    
    // 2. Apply traits
    for (const trait of this.appliedTraits) {
      if (this.definition.traits?.[trait]) {
        entity = { ...entity, ...this.definition.traits[trait] };
      }
    }
    
    // 3. Apply overrides
    if (overrides) {
      entity = this.deepMerge(entity, overrides);
    }
    
    // 4. Resolve lazy attributes
    if (this.definition.lazy) {
      for (const [key, resolver] of Object.entries(this.definition.lazy)) {
        if (!(key in entity)) {
          (entity as any)[key] = resolver();
        }
      }
    }
    
    // 5. Apply state transformation
    if (this.currentState && this.definition.states?.[this.currentState]) {
      entity = this.definition.states[this.currentState](entity);
    }
    
    // 6. Validate
    if (this.definition.validate) {
      const validation = this.definition.validate(entity);
      if (validation !== true) {
        const message = typeof validation === 'string' 
          ? validation 
          : 'Validation failed';
        throw new Error(`Factory validation error: ${message}`);
      }
    }
    
    // 7. After build hook
    if (this.definition.afterBuild) {
      entity = this.definition.afterBuild(entity) as T;
    }
    
    return entity;
  }
  
  async create(overrides?: DeepPartial<T>): Promise<T> {
    if (!this.repository) {
      throw new Error('Repository required for create operation');
    }
    
    const entity = this.build(overrides);
    await this.repository.save(entity);
    
    this.logger.info('Entity created and persisted', {
      type: this.definition.type
    });
    
    return entity;
  }
  
  buildMany(count: number, overrides?: DeepPartial<T>): T[] {
    const results: T[] = [];
    for (let i = 0; i < count; i++) {
      results.push(this.build(overrides));
    }
    return results;
  }
  
  async createMany(count: number, overrides?: DeepPartial<T>): Promise<T[]> {
    const BATCH_SIZE = 100;
    const results: T[] = [];
    
    for (let i = 0; i < count; i += BATCH_SIZE) {
      const batch = this.buildMany(
        Math.min(BATCH_SIZE, count - i),
        overrides
      );
      
      // Batch save through repository
      if (this.repository) {
        await Promise.all(batch.map(e => this.repository!.save(e)));
      }
      
      results.push(...batch);
    }
    
    return results;
  }
  
  async *buildStream(count: number): AsyncIterator<T> {
    for (let i = 0; i < count; i++) {
      yield this.build();
      
      // Yield control periodically
      if (i % 100 === 0) {
        await new Promise(resolve => setImmediate(resolve));
      }
    }
  }
  
  use(...traits: string[]): IDDDFactory<T> {
    const cloned = Object.create(this);
    cloned.appliedTraits = new Set([...this.appliedTraits, ...traits]);
    return cloned;
  }
  
  state(stateName: string): IDDDFactory<T> {
    const cloned = Object.create(this);
    cloned.currentState = stateName;
    return cloned;
  }
  
  private deepMerge(target: any, source: any): any {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }
}
```

#### 1.3 Aggregate-Aware Factory

```typescript
// packages/testing/src/seeder/core/aggregate-factory.ts

import type { IAggregateRoot } from '@vytches/ddd-aggregates';
import type { IDomainEvent } from '@vytches/ddd-events';
import { UnifiedEventBus } from '@vytches/ddd-events';

export class AggregateFactory<T extends IAggregateRoot> extends DDDFactory<T> {
  private eventBus: UnifiedEventBus;
  private generateEvents: boolean = true;
  
  constructor(
    definition: IFactoryDefinition<T>,
    repository?: IRepository<T>,
    eventBus?: UnifiedEventBus
  ) {
    super(definition, repository);
    this.eventBus = eventBus || new UnifiedEventBus();
  }
  
  /**
   * Build aggregate with full domain event history
   */
  buildWithHistory(
    builder: (agg: T) => T,
    overrides?: DeepPartial<T>
  ): T {
    const aggregate = this.build(overrides);
    
    // Apply domain operations that generate events
    const result = builder(aggregate);
    
    // Events are now in aggregate's uncommitted events
    if (this.generateEvents) {
      const events = result.getUncommittedEvents();
      this.logger.debug('Generated domain events', {
        count: events.length,
        types: events.map(e => e.eventType)
      });
    }
    
    return result;
  }
  
  /**
   * Build aggregate at specific version (event sourcing)
   */
  async buildAtVersion(version: number): Promise<T> {
    if (!this.repository) {
      throw new Error('Repository required for version building');
    }
    
    // Create new aggregate
    const aggregate = this.build();
    
    // Load events up to version
    const events = await this.loadEventsUntilVersion(
      aggregate.getId(),
      version
    );
    
    // Replay events
    for (const event of events) {
      aggregate.applyEvent(event);
    }
    
    return aggregate;
  }
  
  /**
   * Build aggregate from specific events
   */
  buildFromEvents(events: IDomainEvent[]): T {
    const aggregate = this.build();
    
    for (const event of events) {
      aggregate.applyEvent(event);
    }
    
    aggregate.markEventsAsCommitted();
    return aggregate;
  }
  
  /**
   * Generate aggregate with business operations
   */
  async buildWithOperations<K extends keyof T>(
    operations: Array<{
      method: K;
      args: T[K] extends (...args: any[]) => any 
        ? Parameters<T[K]>
        : never;
    }>
  ): Promise<T> {
    const aggregate = this.build();
    
    for (const op of operations) {
      const method = aggregate[op.method];
      if (typeof method === 'function') {
        await method.apply(aggregate, op.args);
      }
    }
    
    return aggregate;
  }
  
  private async loadEventsUntilVersion(
    aggregateId: string,
    version: number
  ): Promise<IDomainEvent[]> {
    // This would integrate with event store
    // For now, generate mock events
    const events: IDomainEvent[] = [];
    
    for (let v = 1; v <= version; v++) {
      events.push({
        eventId: `event-${v}`,
        eventType: 'AggregateUpdated',
        aggregateId,
        version: v,
        timestamp: new Date(),
        payload: { version: v }
      } as IDomainEvent);
    }
    
    return events;
  }
}
```

### Phase 2: DDD Patterns Integration (Week 3)

#### 2.1 Repository Integration

```typescript
// packages/testing/src/seeder/patterns/repository-seeder.ts

import type { IBaseRepository } from '@vytches/ddd-repositories';
import { UnitOfWork } from '@vytches/ddd-repositories';

export class RepositorySeeder<T extends IAggregateRoot> {
  private repository: IBaseRepository<T>;
  private factory: AggregateFactory<T>;
  private unitOfWork?: UnitOfWork;
  
  constructor(
    repository: IBaseRepository<T>,
    factory: AggregateFactory<T>
  ) {
    this.repository = repository;
    this.factory = factory;
  }
  
  /**
   * Seed with automatic transaction management
   */
  async seedTransactional<R>(
    seeder: (factory: AggregateFactory<T>) => Promise<R>
  ): Promise<R> {
    this.unitOfWork = new UnitOfWork();
    
    try {
      await this.unitOfWork.begin();
      const result = await seeder(this.factory);
      await this.unitOfWork.commit();
      return result;
    } catch (error) {
      await this.unitOfWork?.rollback();
      throw error;
    }
  }
  
  /**
   * Seed with specific query patterns
   */
  async seedForQuery(
    count: number,
    queryPattern: Partial<T>
  ): Promise<T[]> {
    const entities = this.factory.buildMany(count, queryPattern);
    
    for (const entity of entities) {
      await this.repository.save(entity);
    }
    
    return entities;
  }
  
  /**
   * Seed with relationships
   */
  async seedWithRelations<R>(
    parentFactory: AggregateFactory<T>,
    childFactory: AggregateFactory<R>,
    relation: {
      type: 'oneToMany' | 'manyToMany';
      count: number;
      link: (parent: T, child: R) => void;
    }
  ): Promise<{ parent: T; children: R[] }> {
    const parent = await parentFactory.create();
    const children: R[] = [];
    
    for (let i = 0; i < relation.count; i++) {
      const child = await childFactory.create();
      relation.link(parent, child);
      children.push(child);
    }
    
    await this.repository.save(parent);
    
    return { parent, children };
  }
}
```

#### 2.2 Saga Testing Support

```typescript
// packages/testing/src/seeder/patterns/saga-seeder.ts

import type { ISaga } from '@vytches/ddd-messaging';
import type { IDomainEvent } from '@vytches/ddd-events';

export interface SagaScenario {
  saga: ISaga;
  trigger: IDomainEvent;
  steps: SagaStep[];
  expectedOutcome: 'completed' | 'compensated' | 'failed';
}

export interface SagaStep {
  event: IDomainEvent;
  delay?: number;
  shouldFail?: boolean;
  expectedCompensation?: IDomainEvent;
}

export class SagaSeeder {
  private eventBus: UnifiedEventBus;
  private aggregateFactories: Map<string, AggregateFactory<any>>;
  
  /**
   * Build complete saga test scenario
   */
  async buildScenario(config: {
    sagaType: string;
    trigger: string;
    steps: Array<{
      aggregate: string;
      operation: string;
      expectedEvent: string;
    }>;
    failurePoint?: number;
  }): Promise<SagaScenario> {
    const scenario: SagaScenario = {
      saga: this.createSaga(config.sagaType),
      trigger: this.createEvent(config.trigger),
      steps: [],
      expectedOutcome: config.failurePoint ? 'compensated' : 'completed'
    };
    
    // Build each step
    for (let i = 0; i < config.steps.length; i++) {
      const stepConfig = config.steps[i];
      const factory = this.aggregateFactories.get(stepConfig.aggregate);
      
      if (!factory) {
        throw new Error(`Factory not found for ${stepConfig.aggregate}`);
      }
      
      // Generate aggregate and perform operation
      const aggregate = factory.build();
      const operation = (aggregate as any)[stepConfig.operation];
      
      if (typeof operation === 'function') {
        operation.call(aggregate);
      }
      
      // Get generated event
      const events = aggregate.getUncommittedEvents();
      const event = events.find(e => e.eventType === stepConfig.expectedEvent);
      
      if (!event) {
        throw new Error(`Expected event ${stepConfig.expectedEvent} not found`);
      }
      
      scenario.steps.push({
        event,
        delay: 100 * (i + 1),
        shouldFail: i === config.failurePoint,
        expectedCompensation: this.getCompensationEvent(stepConfig.expectedEvent)
      });
    }
    
    return scenario;
  }
  
  /**
   * Execute saga scenario
   */
  async executeScenario(scenario: SagaScenario): Promise<SagaExecutionResult> {
    const result: SagaExecutionResult = {
      completed: false,
      compensated: false,
      failed: false,
      events: [],
      compensationEvents: []
    };
    
    // Start saga with trigger
    await this.eventBus.publish(scenario.trigger);
    result.events.push(scenario.trigger);
    
    // Execute steps
    for (const step of scenario.steps) {
      await this.delay(step.delay || 0);
      
      if (step.shouldFail) {
        // Simulate failure
        result.failed = true;
        
        // Trigger compensations
        for (const prevStep of scenario.steps) {
          if (prevStep === step) break;
          
          if (prevStep.expectedCompensation) {
            await this.eventBus.publish(prevStep.expectedCompensation);
            result.compensationEvents.push(prevStep.expectedCompensation);
          }
        }
        
        result.compensated = true;
        break;
      }
      
      await this.eventBus.publish(step.event);
      result.events.push(step.event);
    }
    
    if (!result.failed) {
      result.completed = true;
    }
    
    return result;
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  private createSaga(type: string): ISaga {
    // Create saga instance based on type
    // This would use saga registry
    throw new Error('Not implemented');
  }
  
  private createEvent(type: string): IDomainEvent {
    // Create event based on type
    // This would use event factory
    throw new Error('Not implemented');
  }
  
  private getCompensationEvent(eventType: string): IDomainEvent | undefined {
    // Map events to their compensations
    const compensationMap: Record<string, string> = {
      'PaymentProcessed': 'PaymentRefunded',
      'InventoryReserved': 'InventoryReleased',
      'OrderConfirmed': 'OrderCancelled'
    };
    
    const compensationType = compensationMap[eventType];
    return compensationType ? this.createEvent(compensationType) : undefined;
  }
}

interface SagaExecutionResult {
  completed: boolean;
  compensated: boolean;
  failed: boolean;
  events: IDomainEvent[];
  compensationEvents: IDomainEvent[];
}
```

#### 2.3 CQRS Testing

```typescript
// packages/testing/src/seeder/patterns/cqrs-seeder.ts

import type { ICommand, IQuery } from '@vytches/ddd-cqrs';
import { CommandBus, QueryBus } from '@vytches/ddd-cqrs';

export class CQRSSeeder {
  private commandBus: CommandBus;
  private queryBus: QueryBus;
  private factories: Map<string, DDDFactory<any>>;
  
  /**
   * Generate and execute commands
   */
  async seedCommands<T extends ICommand>(
    commandType: new (...args: any[]) => T,
    count: number,
    dataGenerator?: () => Partial<T>
  ): Promise<T[]> {
    const commands: T[] = [];
    
    for (let i = 0; i < count; i++) {
      const data = dataGenerator ? dataGenerator() : {};
      const command = new commandType(data);
      commands.push(command);
      
      await this.commandBus.execute(command);
    }
    
    return commands;
  }
  
  /**
   * Test query with seeded data
   */
  async seedForQuery<Q extends IQuery, R>(
    queryType: new (...args: any[]) => Q,
    seedData: () => Promise<void>,
    queryParams?: Partial<Q>
  ): Promise<R> {
    // Seed data
    await seedData();
    
    // Execute query
    const query = new queryType(queryParams as any);
    return await this.queryBus.execute<Q, R>(query);
  }
  
  /**
   * Test eventual consistency
   */
  async testEventualConsistency<T>(config: {
    command: ICommand;
    query: IQuery;
    expectedResult: T;
    maxWaitTime?: number;
    checkInterval?: number;
  }): Promise<boolean> {
    const { 
      command, 
      query, 
      expectedResult, 
      maxWaitTime = 5000,
      checkInterval = 100 
    } = config;
    
    // Execute command
    await this.commandBus.execute(command);
    
    // Poll for eventual consistency
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      const result = await this.queryBus.execute(query);
      
      if (this.deepEqual(result, expectedResult)) {
        return true;
      }
      
      await this.delay(checkInterval);
    }
    
    return false;
  }
  
  /**
   * Generate read model projection
   */
  async seedProjection(config: {
    aggregateType: string;
    projectionName: string;
    aggregateCount: number;
    eventsPerAggregate: number;
  }): Promise<void> {
    const factory = this.factories.get(config.aggregateType);
    
    if (!factory) {
      throw new Error(`Factory not found for ${config.aggregateType}`);
    }
    
    // Generate aggregates with events
    for (let i = 0; i < config.aggregateCount; i++) {
      const aggregate = factory.build();
      
      // Generate events for this aggregate
      for (let j = 0; j < config.eventsPerAggregate; j++) {
        const event = this.generateProjectionEvent(
          aggregate,
          config.projectionName,
          j
        );
        
        await this.eventBus.publish(event);
      }
    }
  }
  
  private generateProjectionEvent(
    aggregate: any,
    projectionName: string,
    index: number
  ): IDomainEvent {
    return {
      eventId: `proj-${aggregate.getId()}-${index}`,
      eventType: `${projectionName}Updated`,
      aggregateId: aggregate.getId(),
      version: index + 1,
      timestamp: new Date(),
      payload: {
        projection: projectionName,
        data: aggregate
      }
    } as IDomainEvent;
  }
  
  private deepEqual(a: any, b: any): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### Phase 3: Advanced Features (Week 4)

#### 3.1 Specification Testing

```typescript
// packages/testing/src/seeder/patterns/specification-seeder.ts

import type { ISpecification } from '@vytches/ddd-validation';

export class SpecificationSeeder<T> {
  private factory: DDDFactory<T>;
  
  /**
   * Generate entities that satisfy specification
   */
  async satisfying(
    spec: ISpecification<T>,
    count: number,
    maxAttempts: number = 1000
  ): Promise<T[]> {
    const results: T[] = [];
    let attempts = 0;
    
    while (results.length < count && attempts < maxAttempts) {
      const entity = this.factory.build();
      
      if (spec.isSatisfiedBy(entity)) {
        results.push(entity);
      }
      
      attempts++;
    }
    
    if (results.length < count) {
      throw new Error(
        `Could only generate ${results.length} of ${count} entities ` +
        `satisfying specification after ${maxAttempts} attempts`
      );
    }
    
    return results;
  }
  
  /**
   * Generate entities that violate specification
   */
  async violating(
    spec: ISpecification<T>,
    count: number,
    violations?: Partial<T>
  ): Promise<T[]> {
    const results: T[] = [];
    
    for (let i = 0; i < count; i++) {
      const entity = this.factory.build(violations);
      
      if (!spec.isSatisfiedBy(entity)) {
        results.push(entity);
      } else {
        // Force violation
        const violated = this.forceViolation(entity, spec);
        results.push(violated);
      }
    }
    
    return results;
  }
  
  /**
   * Generate boundary test cases
   */
  async boundaryTesting(
    spec: ISpecification<T>,
    propertyPath: keyof T,
    range: { min: any; max: any }
  ): Promise<{
    justValid: T[];
    justInvalid: T[];
    edge: T[];
  }> {
    const justValid: T[] = [];
    const justInvalid: T[] = [];
    const edge: T[] = [];
    
    // Test minimum boundary
    const minValid = this.factory.build({
      [propertyPath]: range.min
    } as any);
    
    if (spec.isSatisfiedBy(minValid)) {
      justValid.push(minValid);
    } else {
      justInvalid.push(minValid);
    }
    
    // Test maximum boundary
    const maxValid = this.factory.build({
      [propertyPath]: range.max
    } as any);
    
    if (spec.isSatisfiedBy(maxValid)) {
      justValid.push(maxValid);
    } else {
      justInvalid.push(maxValid);
    }
    
    // Test edge cases
    const edgeCases = this.generateEdgeCases(propertyPath, range);
    
    for (const edgeValue of edgeCases) {
      const entity = this.factory.build({
        [propertyPath]: edgeValue
      } as any);
      
      edge.push(entity);
    }
    
    return { justValid, justInvalid, edge };
  }
  
  private forceViolation(entity: T, spec: ISpecification<T>): T {
    // Strategy to force violation
    // This would be customizable per specification type
    const violated = { ...entity };
    
    // Example: Set required fields to null
    for (const key in violated) {
      if (violated[key] !== null && violated[key] !== undefined) {
        (violated as any)[key] = null;
        
        if (!spec.isSatisfiedBy(violated)) {
          return violated;
        }
        
        // Restore and try next field
        (violated as any)[key] = entity[key];
      }
    }
    
    return violated;
  }
  
  private generateEdgeCases(property: keyof T, range: any): any[] {
    const cases: any[] = [];
    
    // Numeric edge cases
    if (typeof range.min === 'number') {
      cases.push(
        range.min - 1,
        range.min - 0.1,
        range.min + 0.1,
        range.max - 0.1,
        range.max + 0.1,
        range.max + 1,
        0,
        -1,
        Number.MAX_SAFE_INTEGER,
        Number.MIN_SAFE_INTEGER,
        NaN,
        Infinity,
        -Infinity
      );
    }
    
    // String edge cases
    if (typeof range.min === 'string') {
      cases.push(
        '',
        ' ',
        'a'.repeat(1000),
        '\\n\\r\\t',
        '"; DROP TABLE users; --',
        '<script>alert(1)</script>',
        '${code}',
        '\u0000',
        '🎉' // emoji
      );
    }
    
    return cases;
  }
}
```

#### 3.2 Performance Testing Support

```typescript
// packages/testing/src/seeder/performance/volume-generator.ts

export class VolumeGenerator<T> {
  private factory: DDDFactory<T>;
  private batchSize: number = 1000;
  
  /**
   * Generate large datasets efficiently
   */
  async *generateStream(
    count: number,
    options?: {
      batchSize?: number;
      distribution?: Distribution;
      progression?: (index: number) => Partial<T>;
    }
  ): AsyncIterator<T[]> {
    const batchSize = options?.batchSize || this.batchSize;
    let generated = 0;
    
    while (generated < count) {
      const currentBatchSize = Math.min(batchSize, count - generated);
      const batch: T[] = [];
      
      for (let i = 0; i < currentBatchSize; i++) {
        const index = generated + i;
        
        // Apply progression function
        const overrides = options?.progression
          ? options.progression(index)
          : undefined;
        
        // Apply distribution
        const entity = options?.distribution
          ? this.applyDistribution(
              this.factory.build(overrides),
              options.distribution,
              index / count
            )
          : this.factory.build(overrides);
        
        batch.push(entity);
      }
      
      generated += currentBatchSize;
      yield batch;
      
      // Yield control to event loop
      await new Promise(resolve => setImmediate(resolve));
    }
  }
  
  /**
   * Generate with realistic distributions
   */
  generateWithDistribution(
    count: number,
    distribution: Distribution
  ): T[] {
    const results: T[] = [];
    
    for (let i = 0; i < count; i++) {
      const percentile = i / count;
      const entity = this.factory.build();
      const distributed = this.applyDistribution(
        entity,
        distribution,
        percentile
      );
      results.push(distributed);
    }
    
    return results;
  }
  
  /**
   * Generate for stress testing
   */
  async generateConcurrent(
    count: number,
    concurrency: number
  ): Promise<T[]> {
    const results: T[] = [];
    const promises: Promise<T>[] = [];
    
    for (let i = 0; i < count; i++) {
      const promise = this.generateAsync();
      promises.push(promise);
      
      // Limit concurrency
      if (promises.length >= concurrency) {
        const batch = await Promise.all(promises.splice(0, concurrency));
        results.push(...batch);
      }
    }
    
    // Process remaining
    if (promises.length > 0) {
      const remaining = await Promise.all(promises);
      results.push(...remaining);
    }
    
    return results;
  }
  
  private async generateAsync(): Promise<T> {
    // Simulate async generation
    await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
    return this.factory.build();
  }
  
  private applyDistribution(
    entity: T,
    distribution: Distribution,
    percentile: number
  ): T {
    // Apply distribution based on type
    switch (distribution.type) {
      case 'normal':
        return this.applyNormalDistribution(
          entity,
          distribution,
          percentile
        );
      
      case 'pareto':
        return this.applyParetoDistribution(
          entity,
          distribution,
          percentile
        );
      
      case 'exponential':
        return this.applyExponentialDistribution(
          entity,
          distribution,
          percentile
        );
      
      default:
        return entity;
    }
  }
  
  private applyNormalDistribution(
    entity: T,
    distribution: NormalDistribution,
    percentile: number
  ): T {
    // Apply normal distribution to numeric fields
    // This is simplified - real implementation would use Box-Muller
    const z = this.inverseNormalCDF(percentile);
    const value = distribution.mean + z * distribution.stdDev;
    
    // Apply to relevant fields
    // This would be configurable
    return entity;
  }
  
  private applyParetoDistribution(
    entity: T,
    distribution: ParetoDistribution,
    percentile: number
  ): T {
    // 80/20 rule implementation
    if (percentile <= 0.2) {
      // Top 20% gets 80% of value
      // Modify entity accordingly
    }
    
    return entity;
  }
  
  private applyExponentialDistribution(
    entity: T,
    distribution: ExponentialDistribution,
    percentile: number
  ): T {
    // Exponential decay
    const value = -Math.log(1 - percentile) / distribution.lambda;
    
    // Apply to relevant fields
    return entity;
  }
  
  private inverseNormalCDF(p: number): number {
    // Simplified inverse normal CDF
    // Real implementation would use more precise algorithm
    return Math.sqrt(2) * this.inverseErf(2 * p - 1);
  }
  
  private inverseErf(x: number): number {
    // Simplified inverse error function
    const a = 0.147;
    const ln = Math.log(1 - x * x);
    const part1 = 2 / (Math.PI * a) + ln / 2;
    const part2 = ln / a;
    
    const sign = x < 0 ? -1 : 1;
    return sign * Math.sqrt(Math.sqrt(part1 * part1 - part2) - part1);
  }
}

type Distribution = 
  | NormalDistribution
  | ParetoDistribution
  | ExponentialDistribution;

interface NormalDistribution {
  type: 'normal';
  mean: number;
  stdDev: number;
}

interface ParetoDistribution {
  type: 'pareto';
  alpha: number;
}

interface ExponentialDistribution {
  type: 'exponential';
  lambda: number;
}
```

### Phase 3.5: Provider Layer & Test Type Adapters

#### 3.5.1 Provider Abstraction Layer

```typescript
// packages/testing/src/seeder/providers/provider.interface.ts

export interface ISeederProvider {
  name: string;
  type: 'memory' | 'database' | 'stream' | 'security' | 'performance';
  
  initialize(): Promise<void>;
  execute<T>(operation: ProviderOperation<T>): Promise<T>;
  cleanup(strategy: CleanupStrategy): Promise<void>;
  dispose(): Promise<void>;
}

export interface ProviderOperation<T> {
  type: 'build' | 'create' | 'batch' | 'stream';
  factory: IDDDFactory<T>;
  count?: number;
  overrides?: DeepPartial<T>;
  options?: OperationOptions;
}

export interface OperationOptions {
  transaction?: boolean;
  batchSize?: number;
  parallel?: boolean;
  timeout?: number;
}
```

#### 3.5.2 Database Providers Implementation

```typescript
// packages/testing/src/seeder/providers/database-providers.ts

/**
 * Base Database Provider
 */
export abstract class DatabaseProvider implements ISeederProvider {
  protected connection: any;
  protected transaction?: any;
  protected batchQueue: any[] = [];
  protected batchSize: number = 1000;
  
  abstract name: string;
  type = 'database' as const;
  
  abstract connect(config: DatabaseConfig): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract beginTransaction(): Promise<void>;
  abstract commit(): Promise<void>;
  abstract rollback(): Promise<void>;
  abstract insert<T>(table: string, data: T): Promise<T>;
  abstract insertMany<T>(table: string, data: T[]): Promise<T[]>;
  abstract truncate(tables: string[]): Promise<void>;
  abstract query<T>(sql: string, params?: any[]): Promise<T[]>;
  
  async initialize(): Promise<void> {
    await this.connect(this.getConfig());
  }
  
  async execute<T>(operation: ProviderOperation<T>): Promise<T> {
    switch (operation.type) {
      case 'build':
        return operation.factory.build(operation.overrides);
      
      case 'create':
        const entity = operation.factory.build(operation.overrides);
        return await this.persist(entity);
      
      case 'batch':
        return await this.executeBatch(operation);
      
      case 'stream':
        return await this.executeStream(operation);
      
      default:
        throw new Error(`Unsupported operation: ${operation.type}`);
    }
  }
  
  protected async persist<T>(entity: T): Promise<T> {
    const table = this.getTableName(entity);
    return await this.insert(table, entity);
  }
  
  protected async executeBatch<T>(operation: ProviderOperation<T>): Promise<T> {
    const entities = [];
    const count = operation.count || this.batchSize;
    
    for (let i = 0; i < count; i++) {
      entities.push(operation.factory.build(operation.overrides));
    }
    
    const table = this.getTableName(entities[0]);
    await this.insertMany(table, entities);
    
    return entities[0];
  }
  
  protected async *executeStream<T>(
    operation: ProviderOperation<T>
  ): AsyncIterator<T[]> {
    const count = operation.count || 1000000;
    let generated = 0;
    
    while (generated < count) {
      const batch = [];
      const batchSize = Math.min(this.batchSize, count - generated);
      
      for (let i = 0; i < batchSize; i++) {
        batch.push(operation.factory.build());
      }
      
      const table = this.getTableName(batch[0]);
      await this.insertMany(table, batch);
      
      yield batch;
      generated += batchSize;
    }
  }
  
  protected getTableName(entity: any): string {
    // Extract table name from entity metadata or constructor
    return entity.constructor.name.toLowerCase() + 's';
  }
  
  protected abstract getConfig(): DatabaseConfig;
  
  async cleanup(strategy: CleanupStrategy): Promise<void> {
    switch (strategy) {
      case 'transaction':
        if (this.transaction) {
          await this.rollback();
        }
        break;
      
      case 'truncate':
        const tables = await this.getAllTables();
        await this.truncate(tables);
        break;
      
      case 'drop':
        await this.dropAllTables();
        break;
    }
  }
  
  protected abstract getAllTables(): Promise<string[]>;
  protected abstract dropAllTables(): Promise<void>;
  
  async dispose(): Promise<void> {
    await this.disconnect();
  }
}

/**
 * PostgreSQL Provider
 */
export class PostgreSQLProvider extends DatabaseProvider {
  name = 'postgresql-provider';
  private pool: any; // pg.Pool
  
  async connect(config: DatabaseConfig): Promise<void> {
    const { Pool } = await import('pg');
    this.pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      max: config.poolSize || 10
    });
    
    this.connection = await this.pool.connect();
  }
  
  async disconnect(): Promise<void> {
    if (this.connection) {
      this.connection.release();
    }
    if (this.pool) {
      await this.pool.end();
    }
  }
  
  async beginTransaction(): Promise<void> {
    await this.connection.query('BEGIN');
    this.transaction = true;
  }
  
  async commit(): Promise<void> {
    await this.connection.query('COMMIT');
    this.transaction = false;
  }
  
  async rollback(): Promise<void> {
    await this.connection.query('ROLLBACK');
    this.transaction = false;
  }
  
  async insert<T>(table: string, data: T): Promise<T> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    
    const query = `
      INSERT INTO ${table} (${keys.join(', ')})
      VALUES (${placeholders})
      RETURNING *
    `;
    
    const result = await this.connection.query(query, values);
    return result.rows[0];
  }
  
  async insertMany<T>(table: string, data: T[]): Promise<T[]> {
    if (data.length === 0) return [];
    
    const keys = Object.keys(data[0]);
    const values = [];
    const placeholders = [];
    
    data.forEach((item, index) => {
      const rowPlaceholders = keys.map((_, keyIndex) => 
        `$${index * keys.length + keyIndex + 1}`
      ).join(', ');
      placeholders.push(`(${rowPlaceholders})`);
      values.push(...Object.values(item));
    });
    
    const query = `
      INSERT INTO ${table} (${keys.join(', ')})
      VALUES ${placeholders.join(', ')}
      RETURNING *
    `;
    
    const result = await this.connection.query(query, values);
    return result.rows;
  }
  
  async truncate(tables: string[]): Promise<void> {
    await this.connection.query(
      `TRUNCATE TABLE ${tables.join(', ')} RESTART IDENTITY CASCADE`
    );
  }
  
  async query<T>(sql: string, params?: any[]): Promise<T[]> {
    const result = await this.connection.query(sql, params);
    return result.rows;
  }
  
  protected async getAllTables(): Promise<string[]> {
    const result = await this.connection.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
    `);
    return result.rows.map(row => row.tablename);
  }
  
  protected async dropAllTables(): Promise<void> {
    await this.connection.query(`
      DROP SCHEMA public CASCADE;
      CREATE SCHEMA public;
    `);
  }
  
  protected getConfig(): DatabaseConfig {
    return {
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432'),
      database: process.env.POSTGRES_DB || 'test',
      username: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || 'postgres'
    };
  }
}

/**
 * MongoDB Provider
 */
export class MongoDBProvider extends DatabaseProvider {
  name = 'mongodb-provider';
  private client: any; // MongoClient
  private db: any; // Db
  
  async connect(config: DatabaseConfig): Promise<void> {
    const { MongoClient } = await import('mongodb');
    
    const url = `mongodb://${config.username}:${config.password}@${config.host}:${config.port}`;
    this.client = new MongoClient(url);
    await this.client.connect();
    
    this.db = this.client.db(config.database);
  }
  
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
    }
  }
  
  async beginTransaction(): Promise<void> {
    const session = this.client.startSession();
    session.startTransaction();
    this.transaction = session;
  }
  
  async commit(): Promise<void> {
    if (this.transaction) {
      await this.transaction.commitTransaction();
      this.transaction.endSession();
      this.transaction = null;
    }
  }
  
  async rollback(): Promise<void> {
    if (this.transaction) {
      await this.transaction.abortTransaction();
      this.transaction.endSession();
      this.transaction = null;
    }
  }
  
  async insert<T>(collection: string, data: T): Promise<T> {
    const result = await this.db.collection(collection).insertOne(data);
    return { ...data, _id: result.insertedId };
  }
  
  async insertMany<T>(collection: string, data: T[]): Promise<T[]> {
    const result = await this.db.collection(collection).insertMany(data);
    return data.map((item, index) => ({
      ...item,
      _id: result.insertedIds[index]
    }));
  }
  
  async truncate(collections: string[]): Promise<void> {
    for (const collection of collections) {
      await this.db.collection(collection).deleteMany({});
    }
  }
  
  async query<T>(collection: string, filter?: any): Promise<T[]> {
    return await this.db.collection(collection).find(filter || {}).toArray();
  }
  
  protected async getAllTables(): Promise<string[]> {
    const collections = await this.db.listCollections().toArray();
    return collections.map(col => col.name);
  }
  
  protected async dropAllTables(): Promise<void> {
    await this.db.dropDatabase();
  }
  
  protected getConfig(): DatabaseConfig {
    return {
      host: process.env.MONGODB_HOST || 'localhost',
      port: parseInt(process.env.MONGODB_PORT || '27017'),
      database: process.env.MONGODB_DB || 'test',
      username: process.env.MONGODB_USER || 'mongo',
      password: process.env.MONGODB_PASSWORD || 'mongo'
    };
  }
}

/**
 * MySQL Provider
 */
export class MySQLProvider extends DatabaseProvider {
  name = 'mysql-provider';
  private pool: any; // mysql2 pool
  
  async connect(config: DatabaseConfig): Promise<void> {
    const mysql = await import('mysql2/promise');
    
    this.pool = mysql.createPool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      waitForConnections: true,
      connectionLimit: config.poolSize || 10
    });
    
    this.connection = await this.pool.getConnection();
  }
  
  async disconnect(): Promise<void> {
    if (this.connection) {
      this.connection.release();
    }
    if (this.pool) {
      await this.pool.end();
    }
  }
  
  async beginTransaction(): Promise<void> {
    await this.connection.beginTransaction();
    this.transaction = true;
  }
  
  async commit(): Promise<void> {
    await this.connection.commit();
    this.transaction = false;
  }
  
  async rollback(): Promise<void> {
    await this.connection.rollback();
    this.transaction = false;
  }
  
  async insert<T>(table: string, data: T): Promise<T> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map(() => '?').join(', ');
    
    const query = `
      INSERT INTO ${table} (${keys.join(', ')})
      VALUES (${placeholders})
    `;
    
    const [result] = await this.connection.execute(query, values);
    return { ...data, id: result.insertId };
  }
  
  async insertMany<T>(table: string, data: T[]): Promise<T[]> {
    if (data.length === 0) return [];
    
    const keys = Object.keys(data[0]);
    const values = [];
    const placeholders = [];
    
    data.forEach(item => {
      placeholders.push(`(${keys.map(() => '?').join(', ')})`);
      values.push(...Object.values(item));
    });
    
    const query = `
      INSERT INTO ${table} (${keys.join(', ')})
      VALUES ${placeholders.join(', ')}
    `;
    
    const [result] = await this.connection.execute(query, values);
    
    return data.map((item, index) => ({
      ...item,
      id: result.insertId + index
    }));
  }
  
  async truncate(tables: string[]): Promise<void> {
    await this.connection.execute('SET FOREIGN_KEY_CHECKS = 0');
    
    for (const table of tables) {
      await this.connection.execute(`TRUNCATE TABLE ${table}`);
    }
    
    await this.connection.execute('SET FOREIGN_KEY_CHECKS = 1');
  }
  
  async query<T>(sql: string, params?: any[]): Promise<T[]> {
    const [rows] = await this.connection.execute(sql, params);
    return rows as T[];
  }
  
  protected async getAllTables(): Promise<string[]> {
    const [rows] = await this.connection.execute(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE()
    `);
    return rows.map(row => row.table_name);
  }
  
  protected async dropAllTables(): Promise<void> {
    const tables = await this.getAllTables();
    
    await this.connection.execute('SET FOREIGN_KEY_CHECKS = 0');
    
    for (const table of tables) {
      await this.connection.execute(`DROP TABLE IF EXISTS ${table}`);
    }
    
    await this.connection.execute('SET FOREIGN_KEY_CHECKS = 1');
  }
  
  protected getConfig(): DatabaseConfig {
    return {
      host: process.env.MYSQL_HOST || 'localhost',
      port: parseInt(process.env.MYSQL_PORT || '3306'),
      database: process.env.MYSQL_DB || 'test',
      username: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || 'root'
    };
  }
}

/**
 * SQLite Provider (for testing)
 */
export class SQLiteProvider extends DatabaseProvider {
  name = 'sqlite-provider';
  private db: any; // Database instance
  
  async connect(config: DatabaseConfig): Promise<void> {
    const sqlite3 = await import('sqlite3');
    const { open } = await import('sqlite');
    
    this.db = await open({
      filename: config.database || ':memory:',
      driver: sqlite3.Database
    });
    
    this.connection = this.db;
  }
  
  async disconnect(): Promise<void> {
    if (this.db) {
      await this.db.close();
    }
  }
  
  async beginTransaction(): Promise<void> {
    await this.db.run('BEGIN TRANSACTION');
    this.transaction = true;
  }
  
  async commit(): Promise<void> {
    await this.db.run('COMMIT');
    this.transaction = false;
  }
  
  async rollback(): Promise<void> {
    await this.db.run('ROLLBACK');
    this.transaction = false;
  }
  
  async insert<T>(table: string, data: T): Promise<T> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map(() => '?').join(', ');
    
    const query = `
      INSERT INTO ${table} (${keys.join(', ')})
      VALUES (${placeholders})
    `;
    
    const result = await this.db.run(query, values);
    return { ...data, id: result.lastID };
  }
  
  async insertMany<T>(table: string, data: T[]): Promise<T[]> {
    const results = [];
    
    for (const item of data) {
      const result = await this.insert(table, item);
      results.push(result);
    }
    
    return results;
  }
  
  async truncate(tables: string[]): Promise<void> {
    for (const table of tables) {
      await this.db.run(`DELETE FROM ${table}`);
      await this.db.run(`DELETE FROM sqlite_sequence WHERE name='${table}'`);
    }
  }
  
  async query<T>(sql: string, params?: any[]): Promise<T[]> {
    return await this.db.all(sql, params);
  }
  
  protected async getAllTables(): Promise<string[]> {
    const rows = await this.db.all(`
      SELECT name FROM sqlite_master 
      WHERE type='table' 
      AND name NOT LIKE 'sqlite_%'
    `);
    return rows.map(row => row.name);
  }
  
  protected async dropAllTables(): Promise<void> {
    const tables = await this.getAllTables();
    
    for (const table of tables) {
      await this.db.run(`DROP TABLE IF EXISTS ${table}`);
    }
  }
  
  protected getConfig(): DatabaseConfig {
    return {
      database: process.env.SQLITE_DB || ':memory:'
    };
  }
}

/**
 * In-Memory Provider (fastest for unit tests)
 */
export class InMemoryProvider extends DatabaseProvider {
  name = 'inmemory-provider';
  private storage = new Map<string, any[]>();
  private idCounters = new Map<string, number>();
  
  async connect(): Promise<void> {
    // No connection needed
  }
  
  async disconnect(): Promise<void> {
    this.storage.clear();
    this.idCounters.clear();
  }
  
  async beginTransaction(): Promise<void> {
    // Store snapshot for rollback
    this.transaction = new Map(this.storage);
  }
  
  async commit(): Promise<void> {
    this.transaction = null;
  }
  
  async rollback(): Promise<void> {
    if (this.transaction) {
      this.storage = this.transaction;
      this.transaction = null;
    }
  }
  
  async insert<T>(table: string, data: T): Promise<T> {
    if (!this.storage.has(table)) {
      this.storage.set(table, []);
    }
    
    // Auto-generate ID if not present
    if (!data['id']) {
      const currentId = this.idCounters.get(table) || 0;
      data['id'] = currentId + 1;
      this.idCounters.set(table, currentId + 1);
    }
    
    const collection = this.storage.get(table)!;
    collection.push(data);
    
    return data;
  }
  
  async insertMany<T>(table: string, data: T[]): Promise<T[]> {
    const results = [];
    
    for (const item of data) {
      const result = await this.insert(table, item);
      results.push(result);
    }
    
    return results;
  }
  
  async truncate(tables: string[]): Promise<void> {
    for (const table of tables) {
      this.storage.set(table, []);
      this.idCounters.set(table, 0);
    }
  }
  
  async query<T>(table: string, filter?: any): Promise<T[]> {
    const collection = this.storage.get(table) || [];
    
    if (!filter) {
      return collection;
    }
    
    // Simple filter implementation
    return collection.filter(item => {
      for (const key in filter) {
        if (item[key] !== filter[key]) {
          return false;
        }
      }
      return true;
    });
  }
  
  protected async getAllTables(): Promise<string[]> {
    return Array.from(this.storage.keys());
  }
  
  protected async dropAllTables(): Promise<void> {
    this.storage.clear();
    this.idCounters.clear();
  }
  
  protected getConfig(): DatabaseConfig {
    return {}; // No config needed
  }
}
```

#### 3.5.3 Test Type Specific Adapters

```typescript
// packages/testing/src/seeder/adapters/test-adapters.ts

/**
 * Unit Test Adapter - Pure in-memory, maximum speed
 */
export class UnitTestAdapter implements ISeederProvider {
  name = 'unit-test-adapter';
  type = 'memory' as const;
  private cache = new Map<string, any>();
  
  async initialize(): Promise<void> {
    // No initialization needed for in-memory
  }
  
  async execute<T>(operation: ProviderOperation<T>): Promise<T> {
    // Everything in memory, no I/O
    const result = operation.factory.build(operation.overrides);
    this.cache.set(result.id, result);
    return result;
  }
  
  async cleanup(): Promise<void> {
    this.cache.clear(); // Instant cleanup
  }
  
  async dispose(): Promise<void> {
    this.cache.clear();
  }
}

/**
 * Integration Test Adapter - Database with transactions
 */
export class IntegrationTestAdapter implements ISeederProvider {
  name = 'integration-test-adapter';
  type = 'database' as const;
  private connection: DatabaseConnection;
  private transaction?: Transaction;
  
  async initialize(): Promise<void> {
    this.connection = await DatabasePool.getConnection();
  }
  
  async execute<T>(operation: ProviderOperation<T>): Promise<T> {
    if (operation.options?.transaction && !this.transaction) {
      this.transaction = await this.connection.beginTransaction();
    }
    
    const result = operation.factory.build(operation.overrides);
    await this.connection.insert(result);
    
    return result;
  }
  
  async cleanup(strategy: CleanupStrategy): Promise<void> {
    if (strategy === 'rollback' && this.transaction) {
      await this.transaction.rollback();
    } else if (strategy === 'truncate') {
      await this.connection.truncateAll();
    }
  }
  
  async dispose(): Promise<void> {
    await this.connection.close();
  }
}

/**
 * E2E Test Adapter - Full scenarios with real data
 */
export class E2ETestAdapter implements ISeederProvider {
  name = 'e2e-test-adapter';
  type = 'database' as const;
  private scenarioBuilder: ScenarioBuilder;
  
  async execute<T>(operation: ProviderOperation<T>): Promise<T> {
    // Build complete user journey
    const scenario = await this.scenarioBuilder.build({
      type: operation.type,
      depth: 3, // Full object graphs
      withRelations: true,
      withEvents: true
    });
    
    return scenario.root as T;
  }
  
  async cleanup(strategy: CleanupStrategy): Promise<void> {
    if (strategy === 'selective') {
      await this.scenarioBuilder.cleanupScenario();
    }
  }
}

/**
 * Performance Test Adapter - Streaming & batching
 */
export class PerformanceTestAdapter implements ISeederProvider {
  name = 'performance-test-adapter';
  type = 'stream' as const;
  private batchSize = 10000;
  private parallelWorkers = 10;
  
  async execute<T>(operation: ProviderOperation<T>): Promise<T> {
    if (operation.type === 'stream') {
      return this.executeStream(operation);
    }
    
    // Batch operations for performance
    const batch = [];
    for (let i = 0; i < this.batchSize; i++) {
      batch.push(operation.factory.build());
    }
    
    // Parallel insertion
    await this.parallelInsert(batch);
    
    return batch[0];
  }
  
  private async *executeStream<T>(
    operation: ProviderOperation<T>
  ): AsyncIterator<T[]> {
    const count = operation.count || 1000000;
    let generated = 0;
    
    while (generated < count) {
      const batch = [];
      const batchSize = Math.min(this.batchSize, count - generated);
      
      for (let i = 0; i < batchSize; i++) {
        batch.push(operation.factory.build());
      }
      
      yield batch;
      generated += batchSize;
      
      // Prevent memory issues
      await new Promise(resolve => setImmediate(resolve));
    }
  }
  
  private async parallelInsert<T>(batch: T[]): Promise<void> {
    const chunks = this.chunkArray(batch, this.parallelWorkers);
    await Promise.all(chunks.map(chunk => this.insertChunk(chunk)));
  }
}

/**
 * Security Test Adapter - Malicious payloads
 */
export class SecurityTestAdapter implements ISeederProvider {
  name = 'security-test-adapter';
  type = 'security' as const;
  private payloadGenerator: MaliciousPayloadGenerator;
  
  async execute<T>(operation: ProviderOperation<T>): Promise<T> {
    const entity = operation.factory.build();
    
    // Inject malicious payloads
    return this.injectMaliciousData(entity, operation.options);
  }
  
  private injectMaliciousData<T>(entity: T, options?: any): T {
    const injected = { ...entity };
    
    // SQL Injection vectors
    const sqlInjections = [
      "'; DROP TABLE users; --",
      "' OR '1'='1",
      "admin'--",
      "' UNION SELECT * FROM passwords --"
    ];
    
    // XSS vectors
    const xssVectors = [
      "<script>alert('XSS')</script>",
      "<img src=x onerror=alert('XSS')>",
      "javascript:alert('XSS')",
      "<svg onload=alert('XSS')>"
    ];
    
    // Inject into string fields
    for (const key in injected) {
      if (typeof injected[key] === 'string') {
        const vectors = [...sqlInjections, ...xssVectors];
        injected[key] = vectors[Math.floor(Math.random() * vectors.length)];
      }
    }
    
    return injected;
  }
}

/**
 * Penetration Test Adapter - Exploit patterns
 */
export class PenetrationTestAdapter implements ISeederProvider {
  name = 'penetration-test-adapter';
  type = 'security' as const;
  private exploitDB: ExploitDatabase;
  
  async execute<T>(operation: ProviderOperation<T>): Promise<T> {
    const entity = operation.factory.build();
    
    // Apply known exploits
    const exploits = await this.exploitDB.getExploits(operation.options?.target);
    
    return this.applyExploits(entity, exploits);
  }
  
  private applyExploits<T>(entity: T, exploits: Exploit[]): T {
    const exploited = { ...entity };
    
    for (const exploit of exploits) {
      if (exploit.type === 'jwt-confusion') {
        exploited['token'] = this.generateConfusedJWT();
      } else if (exploit.type === 'path-traversal') {
        exploited['path'] = '../../../etc/passwd';
      } else if (exploit.type === 'xxe') {
        exploited['xml'] = this.generateXXEPayload();
      }
    }
    
    return exploited;
  }
}

/**
 * Contract Test Adapter - Schema validation
 */
export class ContractTestAdapter implements ISeederProvider {
  name = 'contract-test-adapter';
  type = 'memory' as const;
  private schemaValidator: SchemaValidator;
  
  async execute<T>(operation: ProviderOperation<T>): Promise<T> {
    const entity = operation.factory.build();
    
    // Validate against contract
    const isValid = await this.schemaValidator.validate(entity, {
      schema: operation.options?.schema,
      strict: true
    });
    
    if (!isValid) {
      throw new Error('Entity does not match contract schema');
    }
    
    return entity;
  }
}

/**
 * Chaos Test Adapter - Random failures
 */
export class ChaosTestAdapter implements ISeederProvider {
  name = 'chaos-test-adapter';
  type = 'memory' as const;
  private chaosMonkey: ChaosMonkey;
  
  async execute<T>(operation: ProviderOperation<T>): Promise<T> {
    const entity = operation.factory.build();
    
    // Apply chaos
    return this.chaosMonkey.corrupt(entity, {
      corruptionRate: 0.3,
      nullifyRate: 0.2,
      truncateRate: 0.1
    });
  }
}

/**
 * Smoke Test Adapter - Minimal critical path
 */
export class SmokeTestAdapter implements ISeederProvider {
  name = 'smoke-test-adapter';
  type = 'memory' as const;
  
  async execute<T>(operation: ProviderOperation<T>): Promise<T> {
    // Only generate required fields
    const minimal = this.extractMinimalFields(operation.factory);
    return operation.factory.build(minimal);
  }
  
  private extractMinimalFields<T>(factory: IDDDFactory<T>): Partial<T> {
    // Return only required fields
    // This would use schema introspection
    return {} as Partial<T>;
  }
}
```

#### 3.5.3 Strategy Pattern Implementation

```typescript
// packages/testing/src/seeder/strategies/generation-strategies.ts

export interface IGenerationStrategy<T> {
  name: string;
  generate(context: GenerationContext): T;
  canGenerate(type: string): boolean;
}

/**
 * Sequence Strategy - Sequential values
 */
export class SequenceStrategy implements IGenerationStrategy<number | string> {
  private counters = new Map<string, number>();
  
  generate(context: GenerationContext): number | string {
    const key = context.sequenceKey || 'default';
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + 1);
    
    if (context.prefix || context.suffix) {
      return `${context.prefix || ''}${current}${context.suffix || ''}`;
    }
    
    return current;
  }
  
  canGenerate(type: string): boolean {
    return type === 'sequence';
  }
}

/**
 * Faker Strategy - Realistic fake data
 */
export class FakerStrategy implements IGenerationStrategy<any> {
  generate(context: GenerationContext): any {
    const { category, method, locale = 'en' } = context;
    
    faker.setLocale(locale);
    
    if (category && method && faker[category]?.[method]) {
      return faker[category][method](context.options);
    }
    
    // Default generators
    switch (context.type) {
      case 'email': return faker.internet.email();
      case 'name': return faker.person.fullName();
      case 'phone': return faker.phone.number();
      case 'address': return faker.location.streetAddress();
      case 'company': return faker.company.name();
      case 'uuid': return faker.string.uuid();
      default: return faker.lorem.word();
    }
  }
  
  canGenerate(type: string): boolean {
    return type === 'faker' || type === 'realistic';
  }
}

/**
 * Distribution Strategy - Statistical distributions
 */
export class DistributionStrategy implements IGenerationStrategy<number> {
  generate(context: GenerationContext): number {
    const { distribution, index, total } = context;
    const percentile = index / total;
    
    switch (distribution.type) {
      case 'normal':
        return this.generateNormal(distribution, percentile);
      case 'pareto':
        return this.generatePareto(distribution, percentile);
      case 'exponential':
        return this.generateExponential(distribution, percentile);
      case 'uniform':
        return this.generateUniform(distribution);
      default:
        return Math.random();
    }
  }
  
  private generateNormal(dist: NormalDistribution, percentile: number): number {
    // Box-Muller transform
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return dist.mean + z0 * dist.stdDev;
  }
  
  private generatePareto(dist: ParetoDistribution, percentile: number): number {
    const { alpha = 1.16 } = dist; // Default to 80/20 rule
    return Math.pow(1 - percentile, -1 / alpha);
  }
  
  private generateExponential(dist: ExponentialDistribution, percentile: number): number {
    return -Math.log(1 - percentile) / dist.lambda;
  }
  
  private generateUniform(dist: UniformDistribution): number {
    return dist.min + Math.random() * (dist.max - dist.min);
  }
  
  canGenerate(type: string): boolean {
    return type === 'distribution';
  }
}

/**
 * Pattern Strategy - Regex patterns
 */
export class PatternStrategy implements IGenerationStrategy<string> {
  private regexGen = new RandExp();
  
  generate(context: GenerationContext): string {
    if (context.pattern) {
      this.regexGen.regexp = new RegExp(context.pattern);
      return this.regexGen.gen();
    }
    
    // Common patterns
    const patterns = {
      email: /[a-z]{5,10}@[a-z]{5,10}\.(com|net|org)/,
      phone: /\+1-\d{3}-\d{3}-\d{4}/,
      ssn: /\d{3}-\d{2}-\d{4}/,
      creditCard: /\d{4}-\d{4}-\d{4}-\d{4}/,
      ipv4: /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/,
      ipv6: /([0-9a-f]{1,4}:){7}[0-9a-f]{1,4}/i,
      uuid: /[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i
    };
    
    const selectedPattern = patterns[context.type] || patterns.email;
    this.regexGen.regexp = selectedPattern;
    return this.regexGen.gen();
  }
  
  canGenerate(type: string): boolean {
    return type === 'pattern' || type === 'regex';
  }
}

/**
 * Time Strategy - Time-based data
 */
export class TimeStrategy implements IGenerationStrategy<Date> {
  generate(context: GenerationContext): Date {
    const { timeRange, progression, timeZone } = context;
    
    if (timeRange) {
      const start = new Date(timeRange.start).getTime();
      const end = new Date(timeRange.end).getTime();
      const range = end - start;
      
      if (progression === 'linear') {
        const step = range / context.total;
        return new Date(start + step * context.index);
      } else if (progression === 'random') {
        return new Date(start + Math.random() * range);
      }
    }
    
    // Generate relative to now
    const now = new Date();
    const offset = context.offset || 0;
    const unit = context.unit || 'days';
    
    switch (unit) {
      case 'seconds': return new Date(now.getTime() + offset * 1000);
      case 'minutes': return new Date(now.getTime() + offset * 60000);
      case 'hours': return new Date(now.getTime() + offset * 3600000);
      case 'days': return new Date(now.getTime() + offset * 86400000);
      case 'months': 
        const monthDate = new Date(now);
        monthDate.setMonth(monthDate.getMonth() + offset);
        return monthDate;
      case 'years':
        const yearDate = new Date(now);
        yearDate.setFullYear(yearDate.getFullYear() + offset);
        return yearDate;
      default: return now;
    }
  }
  
  canGenerate(type: string): boolean {
    return type === 'time' || type === 'date' || type === 'datetime';
  }
}
```

### Phase 4: Package Extraction (3 days)

#### Migration Steps

1. **Extract to new package**
```bash
# Create new package
cd packages
mkdir ddd-seeder
cd ddd-seeder

# Initialize package
pnpm init
```

2. **Move seeder code**
```bash
# Move from testing to seeder
mv ../testing/src/seeder/* ./src/
```

3. **Update dependencies**
```json
{
  "name": "@vytches/ddd-seeder",
  "version": "1.0.0",
  "dependencies": {
    "@vytches/ddd-core": "workspace:*",
    "@vytches/ddd-events": "workspace:*",
    "@vytches/ddd-repositories": "workspace:*",
    "@vytches/ddd-cqrs": "workspace:*",
    "@vytches/ddd-validation": "workspace:*",
    "@vytches/ddd-messaging": "workspace:*",
    "@vytches/ddd-logging": "workspace:*"
  },
  "peerDependencies": {
    "@vytches/ddd-testing": "workspace:*"
  }
}
```

4. **Re-export from testing (backward compatibility)**
```typescript
// packages/testing/src/index.ts
export * from '@vytches/ddd-seeder';
```

---

## 🔥 Killer Features Implementation

### 1. **Auto-Detection of Test Type**

```typescript
// packages/testing/src/seeder/core/auto-detector.ts

export class TestTypeDetector {
  detect(): TestType {
    // Check environment variables
    if (process.env.TEST_TYPE) {
      return process.env.TEST_TYPE as TestType;
    }
    
    // Check test runner
    if (typeof global.it === 'function') {
      if (global.__VITEST__) return 'unit';
      if (global.__JEST__) return 'unit';
    }
    
    // Check for Playwright
    if (global.__PLAYWRIGHT__) return 'e2e';
    
    // Check for k6
    if (global.__VU) return 'performance';
    
    // Check for database connection
    if (process.env.DATABASE_URL) return 'integration';
    
    // Default
    return 'unit';
  }
}
```

### 2. **Unified Configuration System**

```typescript
// packages/testing/src/seeder/config/seeder-config.ts

export interface SeederConfig {
  // Test type configuration
  testType: TestType | 'auto';
  
  // Provider configuration
  providers: {
    unit: ISeederProvider;
    integration: ISeederProvider;
    e2e: ISeederProvider;
    performance: ISeederProvider;
    security: ISeederProvider;
    contract: ISeederProvider;
    chaos: ISeederProvider;
    smoke: ISeederProvider;
  };
  
  // Strategy configuration
  strategies: {
    generation: IGenerationStrategy[];
    cleanup: CleanupStrategy;
    isolation: IsolationStrategy;
  };
  
  // DDD configuration
  ddd: {
    aggregates: Array<typeof AggregateRoot>;
    repositories: IRepository<any>[];
    eventBus: UnifiedEventBus;
    eventStore?: IEventStore;
    boundedContexts?: BoundedContext[];
  };
  
  // Performance configuration
  performance: {
    batchSize: number;
    maxConcurrency: number;
    streamBufferSize: number;
    timeout: number;
  };
  
  // Environment-specific configuration
  environments: {
    development: EnvironmentConfig;
    test: EnvironmentConfig;
    staging: EnvironmentConfig;
    production: EnvironmentConfig;
  };
}

// Default configuration
export const defaultConfig: SeederConfig = {
  testType: 'auto',
  
  providers: {
    unit: new UnitTestAdapter(),
    integration: new IntegrationTestAdapter(),
    e2e: new E2ETestAdapter(),
    performance: new PerformanceTestAdapter(),
    security: new SecurityTestAdapter(),
    contract: new ContractTestAdapter(),
    chaos: new ChaosTestAdapter(),
    smoke: new SmokeTestAdapter()
  },
  
  strategies: {
    generation: [
      new SequenceStrategy(),
      new FakerStrategy(),
      new DistributionStrategy(),
      new PatternStrategy(),
      new TimeStrategy()
    ],
    cleanup: 'transaction',
    isolation: new ProcessIsolationStrategy()
  },
  
  performance: {
    batchSize: 1000,
    maxConcurrency: 10,
    streamBufferSize: 10000,
    timeout: 30000
  },
  
  environments: {
    development: {
      seedOnStartup: true,
      cleanupOnExit: false,
      dataVolume: 'minimal'
    },
    test: {
      seedOnStartup: false,
      cleanupOnExit: true,
      dataVolume: 'standard'
    },
    staging: {
      seedOnStartup: true,
      cleanupOnExit: false,
      dataVolume: 'realistic'
    },
    production: {
      seedOnStartup: false,
      cleanupOnExit: false,
      dataVolume: 'none'
    }
  }
};
```

### 3. **Intelligent Factory Registry**

```typescript
// packages/testing/src/seeder/core/factory-registry.ts

export class FactoryRegistry {
  private factories = new Map<string, IDDDFactory<any>>();
  private relationships = new Map<string, RelationshipConfig[]>();
  
  /**
   * Auto-register factories from aggregates
   */
  autoRegister(aggregates: Array<typeof AggregateRoot>): void {
    for (const AggregateClass of aggregates) {
      const metadata = Reflect.getMetadata('ddd:aggregate', AggregateClass);
      
      if (metadata) {
        const factory = this.createFactoryFromMetadata(AggregateClass, metadata);
        this.register(metadata.name, factory);
      }
    }
  }
  
  /**
   * Register factory with relationships
   */
  registerWithRelations<T>(
    name: string,
    factory: IDDDFactory<T>,
    relations: RelationshipConfig[]
  ): void {
    this.factories.set(name, factory);
    this.relationships.set(name, relations);
  }
  
  /**
   * Get factory with auto-resolved dependencies
   */
  get<T>(name: string): IDDDFactory<T> {
    const factory = this.factories.get(name);
    
    if (!factory) {
      throw new Error(`Factory ${name} not found`);
    }
    
    // Auto-resolve relationships
    const relations = this.relationships.get(name);
    if (relations) {
      return this.wrapWithRelations(factory, relations);
    }
    
    return factory;
  }
  
  private wrapWithRelations<T>(
    factory: IDDDFactory<T>,
    relations: RelationshipConfig[]
  ): IDDDFactory<T> {
    return {
      ...factory,
      build: (overrides?: DeepPartial<T>) => {
        const entity = factory.build(overrides);
        
        // Auto-populate relationships
        for (const relation of relations) {
          const relatedFactory = this.get(relation.factoryName);
          
          if (relation.type === 'hasMany') {
            entity[relation.property] = relatedFactory.buildMany(relation.count);
          } else if (relation.type === 'hasOne') {
            entity[relation.property] = relatedFactory.build();
          }
        }
        
        return entity;
      }
    };
  }
}
```

### 4. **Smart Cleanup Manager**

```typescript
// packages/testing/src/seeder/cleanup/cleanup-manager.ts

export class CleanupManager {
  private cleanupStack: CleanupOperation[] = [];
  private snapshots = new Map<string, DatabaseSnapshot>();
  
  /**
   * Register cleanup operation
   */
  register(operation: CleanupOperation): void {
    this.cleanupStack.push(operation);
  }
  
  /**
   * Execute cleanup based on strategy
   */
  async cleanup(strategy: CleanupStrategy): Promise<void> {
    switch (strategy) {
      case 'transaction':
        await this.rollbackTransaction();
        break;
      
      case 'truncate':
        await this.truncateTables();
        break;
      
      case 'snapshot':
        await this.restoreSnapshot();
        break;
      
      case 'selective':
        await this.selectiveCleanup();
        break;
      
      case 'none':
        // Keep data for analysis
        break;
    }
    
    this.cleanupStack = [];
  }
  
  /**
   * Create snapshot before test
   */
  async snapshot(name: string): Promise<void> {
    const snapshot = await this.createDatabaseSnapshot();
    this.snapshots.set(name, snapshot);
  }
  
  /**
   * Restore specific snapshot
   */
  async restore(name: string): Promise<void> {
    const snapshot = this.snapshots.get(name);
    if (!snapshot) {
      throw new Error(`Snapshot ${name} not found`);
    }
    
    await this.restoreDatabaseSnapshot(snapshot);
  }
  
  private async selectiveCleanup(): Promise<void> {
    // Execute cleanup operations in reverse order
    for (let i = this.cleanupStack.length - 1; i >= 0; i--) {
      await this.cleanupStack[i].execute();
    }
  }
}
```

### 5. **Real-time Metrics & Monitoring**

```typescript
// packages/testing/src/seeder/metrics/metrics-collector.ts

export class MetricsCollector {
  private metrics = new Map<string, Metric>();
  private startTime: number;
  
  start(): void {
    this.startTime = Date.now();
  }
  
  track(name: string, value: number, unit: string = 'count'): void {
    const metric = this.metrics.get(name) || {
      name,
      unit,
      values: [],
      min: Infinity,
      max: -Infinity,
      sum: 0,
      count: 0
    };
    
    metric.values.push(value);
    metric.min = Math.min(metric.min, value);
    metric.max = Math.max(metric.max, value);
    metric.sum += value;
    metric.count++;
    
    this.metrics.set(name, metric);
  }
  
  getReport(): MetricsReport {
    const duration = Date.now() - this.startTime;
    
    return {
      duration,
      metrics: Array.from(this.metrics.values()).map(m => ({
        ...m,
        average: m.sum / m.count,
        median: this.calculateMedian(m.values),
        p95: this.calculatePercentile(m.values, 0.95),
        p99: this.calculatePercentile(m.values, 0.99)
      }))
    };
  }
  
  private calculateMedian(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }
  
  private calculatePercentile(values: number[], percentile: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil(percentile * sorted.length) - 1;
    return sorted[index];
  }
}
```

### 6. **Framework Integration Plugins**

```typescript
// packages/testing/src/seeder/integrations/framework-plugins.ts

// Vitest Plugin
export const vitestPlugin = {
  name: 'vytches-ddd-seeder',
  
  async setupFiles() {
    const seeder = await createDDDSeeder();
    global.__SEEDER__ = seeder;
    
    // Auto-cleanup after each test
    afterEach(async () => {
      await seeder.cleanup();
    });
  },
  
  // Custom matchers
  expect: {
    toSatisfySpecification(received, spec) {
      const pass = spec.isSatisfiedBy(received);
      return {
        pass,
        message: () => pass
          ? `Expected ${received} not to satisfy specification`
          : `Expected ${received} to satisfy specification`
      };
    }
  }
};

// Jest Plugin
export const jestPlugin = {
  globalSetup: async () => {
    const seeder = await createDDDSeeder();
    global.__SEEDER__ = seeder;
  },
  
  globalTeardown: async () => {
    await global.__SEEDER__.dispose();
  },
  
  setupFilesAfterEnv: ['@vytches/ddd-seeder/jest-setup']
};

// Playwright Fixture
export const seederFixture = test.extend({
  seeder: async ({}, use) => {
    const seeder = await createDDDSeeder({
      testType: 'e2e'
    });
    
    await use(seeder);
    await seeder.cleanup();
  },
  
  seed: async ({ seeder }, use) => {
    const seed = async (scenario: string) => {
      return await seeder.scenario(scenario);
    };
    
    await use(seed);
  }
});
```

---

## 📝 API Usage Examples

### Basic Usage with Database Providers

```typescript
import { createDDDSeeder } from '@vytches/ddd-seeder';
import { 
  PostgreSQLProvider,
  MongoDBProvider,
  MySQLProvider,
  InMemoryProvider 
} from '@vytches/ddd-seeder/providers';

// Configure with specific database provider
const seeder = createDDDSeeder({
  // Choose your database provider
  provider: new PostgreSQLProvider(), // For PostgreSQL
  // provider: new MongoDBProvider(),  // For MongoDB
  // provider: new MySQLProvider(),    // For MySQL
  // provider: new InMemoryProvider(), // For unit tests (fastest)
  
  aggregates: [UserAggregate, OrderAggregate],
  repositories: [userRepository, orderRepository],
  eventBus: unifiedEventBus
});

// Or use auto-detection based on environment
const autoSeeder = createDDDSeeder({
  provider: process.env.NODE_ENV === 'test' 
    ? new InMemoryProvider()
    : new PostgreSQLProvider(),
  // ... rest of config
});
```

### Provider-Specific Configuration

```typescript
// PostgreSQL with custom config
const pgSeeder = createDDDSeeder({
  provider: new PostgreSQLProvider({
    host: 'localhost',
    port: 5432,
    database: 'test_db',
    username: 'postgres',
    password: 'secret',
    poolSize: 20
  })
});

// MongoDB with replica set
const mongoSeeder = createDDDSeeder({
  provider: new MongoDBProvider({
    host: 'mongodb://mongo1:27017,mongo2:27017',
    database: 'test_db',
    replicaSet: 'rs0',
    authSource: 'admin'
  })
});

// SQLite for fast testing
const sqliteSeeder = createDDDSeeder({
  provider: new SQLiteProvider({
    database: ':memory:' // In-memory for tests
    // database: './test.db' // Or file-based
  })
});
```

### Test Type with Appropriate Provider

```typescript
// Unit tests - InMemory
test('unit test', async () => {
  const seeder = createDDDSeeder({
    provider: new InMemoryProvider(),
    testType: 'unit'
  });
  
  const user = await userFactory.create(); // Super fast, no I/O
});

// Integration tests - Real database with transactions
test('integration test', async () => {
  const seeder = createDDDSeeder({
    provider: new PostgreSQLProvider(),
    testType: 'integration'
  });
  
  await seeder.transaction(async () => {
    const user = await userFactory.create();
    const orders = await orderFactory.createMany(5, { userId: user.id });
    
    // Test repository integration
    const found = await orderRepository.findByUserId(user.id);
    expect(found).toHaveLength(5);
    
    // Automatic rollback after test
  });
});

// Performance tests - Streaming with batching
test('load test', async () => {
  const seeder = createDDDSeeder({
    provider: new PostgreSQLProvider({
      poolSize: 50, // Increase pool for performance
      batchSize: 10000 // Optimize batch inserts
    }),
    testType: 'performance'
  });
  
  // Stream 1M records without OOM
  for await (const batch of userFactory.stream(1_000_000)) {
    console.log(`Inserted batch of ${batch.length} users`);
  }
});
```

### Basic Factory Usage

```typescript
import { createDDDSeeder } from '@vytches/ddd-seeder';

// Initialize seeder
const seeder = createDDDSeeder({
  aggregates: [UserAggregate, OrderAggregate],
  repositories: [userRepository, orderRepository],
  eventBus: unifiedEventBus
});

// Define factories
const userFactory = seeder.defineFactory(UserAggregate, {
  defaults: () => ({
    id: EntityId.generate(),
    email: faker.internet.email(),
    name: faker.person.fullName()
  }),
  traits: {
    premium: { subscription: 'premium' },
    admin: { role: 'admin' }
  },
  states: {
    active: user => user.activate(),
    suspended: user => user.suspend()
  }
});

// Use in tests
test('user registration', async () => {
  const user = await userFactory
    .use('premium')
    .state('active')
    .create();
  
  expect(user.isPremium()).toBe(true);
  expect(user.isActive()).toBe(true);
});
```

### Aggregate Testing

```typescript
test('order aggregate with events', async () => {
  const orderFactory = seeder.defineAggregateFactory(OrderAggregate);
  
  const order = await orderFactory.buildWithHistory(order => 
    order
      .createOrder({ customerId: 'C1' })
      .addItem({ productId: 'P1', quantity: 2 })
      .addItem({ productId: 'P2', quantity: 1 })
      .confirmOrder()
  );
  
  const events = order.getUncommittedEvents();
  
  expect(events).toContainEqual(
    expect.objectContaining({ eventType: 'OrderCreated' })
  );
  expect(events).toContainEqual(
    expect.objectContaining({ eventType: 'OrderConfirmed' })
  );
});
```

### Saga Testing

```typescript
test('order fulfillment saga', async () => {
  const sagaSeeder = seeder.forSaga(OrderFulfillmentSaga);
  
  const scenario = await sagaSeeder.buildScenario({
    trigger: 'OrderCreated',
    steps: [
      { aggregate: 'Payment', operation: 'process', expectedEvent: 'PaymentProcessed' },
      { aggregate: 'Inventory', operation: 'reserve', expectedEvent: 'InventoryReserved' },
      { aggregate: 'Shipping', operation: 'schedule', expectedEvent: 'ShippingScheduled' }
    ],
    failurePoint: 1 // Fail at inventory
  });
  
  const result = await sagaSeeder.executeScenario(scenario);
  
  expect(result.compensated).toBe(true);
  expect(result.compensationEvents).toContainEqual(
    expect.objectContaining({ eventType: 'PaymentRefunded' })
  );
});
```

### Performance Testing

```typescript
test('load test with 1M users', async () => {
  const volumeGen = seeder.volume(userFactory);
  
  let count = 0;
  for await (const batch of volumeGen.generateStream(1_000_000)) {
    // Process batch
    await processUsers(batch);
    count += batch.length;
    
    console.log(`Processed ${count} users`);
  }
  
  expect(count).toBe(1_000_000);
});
```

### Specification Testing

```typescript
test('premium user specification', async () => {
  const specSeeder = seeder.forSpecification(PremiumUserSpecification);
  
  // Generate valid users
  const validUsers = await specSeeder.satisfying(10);
  validUsers.forEach(user => {
    expect(PremiumUserSpecification.isSatisfiedBy(user)).toBe(true);
  });
  
  // Generate invalid users
  const invalidUsers = await specSeeder.violating(5);
  invalidUsers.forEach(user => {
    expect(PremiumUserSpecification.isSatisfiedBy(user)).toBe(false);
  });
  
  // Test boundaries
  const boundaries = await specSeeder.boundaryTesting('credits', {
    min: 0,
    max: 10000
  });
  
  expect(boundaries.justValid.length).toBeGreaterThan(0);
  expect(boundaries.justInvalid.length).toBeGreaterThan(0);
});
```

---

## 🚀 Implementation Checklist

### Phase 1: Core Foundation ✅
- [ ] Create base abstractions (`IDDDFactory`, `IFactoryDefinition`)
- [ ] Implement `DDDFactory` class
- [ ] Implement `AggregateFactory` with event support
- [ ] Add lazy evaluation and traits system
- [ ] Create streaming support for large datasets
- [ ] Add comprehensive logging with `@vytches/ddd-logging`
- [ ] Write unit tests for core functionality

### Phase 2: DDD Integration ✅
- [ ] Implement `RepositorySeeder` with UoW support
- [ ] Create `SagaSeeder` for saga testing
- [ ] Build `CQRSSeeder` for command/query testing
- [ ] Add `ProjectionSeeder` for read models
- [ ] Implement `SpecificationSeeder`
- [ ] Create `PolicySeeder` for business rules
- [ ] Add event sourcing support

### Phase 3: Advanced Features ✅
- [ ] Implement `VolumeGenerator` for performance testing
- [ ] Add distribution strategies (normal, pareto, exponential)
- [ ] Create security testing support (fuzzing, malicious data)
- [ ] Build relationship management
- [ ] Add fixture system with scenarios
- [ ] Implement cleanup strategies
- [ ] Create provider abstraction

### Phase 4: Package & Release ✅
- [ ] Extract to `@vytches/ddd-seeder` package
- [ ] Update dependencies and package.json
- [ ] Create comprehensive documentation
- [ ] Add examples for all test types
- [ ] Write migration guide from testing package
- [ ] Set up CI/CD for new package
- [ ] Publish to npm registry

---

## 🎯 Success Metrics

1. **Developer Experience**
   - Zero boilerplate for common scenarios
   - Full TypeScript autocomplete
   - Clear error messages

2. **Performance**
   - Generate 1M entities in <10 seconds
   - Stream processing without OOM
   - Batch operations optimized

3. **Test Coverage**
   - Support all test types (unit, integration, e2e, performance, security)
   - Work with all test frameworks (Vitest, Jest, Playwright)
   - Cover all DDD patterns

4. **Integration**
   - Seamless VytchesDDD integration
   - Respect all domain boundaries
   - Automatic event generation

---

## 🔗 Resources

- [VytchesDDD Documentation](https://github.com/Badsender-com/vytches-ddd)
- [Factory Pattern Best Practices](https://martinfowler.com/articles/factoryPattern.html)
- [Test Data Builders](http://www.natpryce.com/articles/000714.html)
- [Property-Based Testing](https://hypothesis.works/)

---

## 📅 Timeline Summary

| Week | Phase | Deliverables |
|------|-------|-------------|
| 1-2 | Core Foundation | Basic factory system, streaming, traits |
| 3 | DDD Integration | Repository, Saga, CQRS, Specification seeders |
| 4 | Advanced Features | Volume generation, security, relationships |
| 4+ | Package & Release | Extract to separate package, documentation |

---

## 🎉 Conclusion

This DDD Seeder will be a **game-changer** for testing VytchesDDD applications. By deeply integrating with the framework's patterns and respecting domain boundaries, it provides a testing experience that's both powerful and intuitive.

The phased approach ensures we can start using it immediately in the testing package while planning for a clean separation once stable. This gives us the best of both worlds: rapid iteration and clean architecture.

Ready to start implementation! 🚀
