# Intermediate Aggregate Implementation Patterns

**Version**: 1.0.0
**Package**: @vytches-ddd/aggregates
**Complexity**: Intermediate
**Domain**: Advanced Domain-Driven Design Patterns

## Overview

This document covers intermediate-level aggregate implementation patterns that extend beyond basic CRUD operations. These patterns address complex business scenarios including event sourcing, capability separation, workflow management, and multi-tenant architectures.

## Advanced Implementation Patterns

### 1. Event Sourcing Pattern

**Purpose**: Rebuild aggregate state from a sequence of domain events for complete audit trails and temporal queries

```typescript
// ✅ CORRECT: Event sourcing with state reconstruction
export class EventSourcedAggregate extends AggregateRoot {
  private eventVersion: number = 0;

  // Reconstitute from event stream
  static fromEvents(id: EntityId, events: DomainEvent[]): EventSourcedAggregate {
    const aggregate = new EventSourcedAggregate(id);
    
    // Apply all historical events to rebuild state
    events.forEach(event => aggregate.applyEvent(event));
    
    aggregate.markAsHydrated(); // Prevent event emission during reconstitution
    return aggregate;
  }

  // Event application methods
  private applyEvent(event: DomainEvent): void {
    switch (event.constructor.name) {
      case 'ItemAddedEvent':
        this.applyItemAddedEvent(event as ItemAddedEvent);
        break;
      case 'ItemRemovedEvent':
        this.applyItemRemovedEvent(event as ItemRemovedEvent);
        break;
    }
    this.eventVersion++;
  }

  private applyItemAddedEvent(event: ItemAddedEvent): void {
    // Apply state changes without business validation
    // (already validated when event was originally created)
    this.items.set(event.itemId, event.item);
    this.recalculateTotal();
  }
}

// ❌ WRONG: Direct state manipulation without event sourcing
export class BadAggregate extends AggregateRoot {
  addItem(item: Item): void {
    this.items.push(item); // Lost history, no replay capability
  }
}
```

### 2. Snapshot Optimization Pattern

**Purpose**: Improve performance for aggregates with long event histories

```typescript
// ✅ CORRECT: Snapshot with incremental events
export class SnapshotOptimizedAggregate extends AggregateRoot {
  static fromSnapshot(
    id: EntityId, 
    snapshotData: SnapshotData, 
    eventsAfterSnapshot: DomainEvent[]
  ): SnapshotOptimizedAggregate {
    const aggregate = new SnapshotOptimizedAggregate(id);
    
    // Restore from snapshot (fast)
    aggregate.restoreFromSnapshot(snapshotData);
    
    // Apply only events after snapshot (minimal processing)
    eventsAfterSnapshot.forEach(event => aggregate.applyEvent(event));
    
    aggregate.markAsHydrated();
    return aggregate;
  }

  toSnapshot(): SnapshotData {
    return {
      id: this.id.value,
      version: this.eventVersion,
      state: this.captureCurrentState(),
      snapshotAt: new Date()
    };
  }

  private restoreFromSnapshot(snapshot: SnapshotData): void {
    this.eventVersion = snapshot.version;
    this.restoreState(snapshot.state);
  }
}

// ❌ WRONG: Always replaying all events
static fromEvents(id: EntityId, allEvents: DomainEvent[]): BadAggregate {
  // Inefficient for aggregates with thousands of events
  allEvents.forEach(event => aggregate.applyEvent(event));
}
```

### 3. Capability Pattern

**Purpose**: Separate complex business logic into focused, testable capabilities

```typescript
// ✅ CORRECT: Capability separation
interface IRiskAssessmentCapability {
  assessRisk(transaction: Transaction): RiskScore;
  updateRiskProfile(assessment: RiskAssessment): void;
}

interface IComplianceCapability {
  validateCompliance(transaction: Transaction): void;
  reportSuspiciousActivity(transaction: Transaction): void;
}

export class BankingAggregate extends AggregateRoot {
  private riskCapability: IRiskAssessmentCapability;
  private complianceCapability: IComplianceCapability;

  constructor(id: EntityId) {
    super(id);
    this.riskCapability = new RiskAssessmentCapability(this);
    this.complianceCapability = new ComplianceCapability(this);
  }

  processTransaction(transaction: Transaction): void {
    // Use capabilities for complex business logic
    const riskAssessment = this.riskCapability.assessRisk(transaction);
    this.complianceCapability.validateCompliance(transaction);

    if (riskAssessment.level === 'high') {
      this.complianceCapability.reportSuspiciousActivity(transaction);
    }

    this.executeTransaction(transaction);
  }
}

// ❌ WRONG: Monolithic aggregate with all logic
export class BadBankingAggregate extends AggregateRoot {
  processTransaction(transaction: Transaction): void {
    // 200+ lines of mixed risk, compliance, and business logic
    // Difficult to test, maintain, and understand
  }
}
```

### 4. Workflow Management Pattern

**Purpose**: Handle complex multi-step business processes with state validation

```typescript
// ✅ CORRECT: Workflow engine with validation
interface IWorkflowEngine {
  getNextStep(currentStep: string, decision: string): string | null;
  validateTransition(from: string, to: string): boolean;
  getRequiredActions(step: string): string[];
}

export class WorkflowAggregate extends AggregateRoot {
  private currentStep: string = 'initial';
  private workflowEngine: IWorkflowEngine;

  constructor(id: EntityId, workflowEngine: IWorkflowEngine) {
    super(id);
    this.workflowEngine = workflowEngine;
  }

  progressWorkflow(decision: string, actor: string): void {
    const nextStep = this.workflowEngine.getNextStep(this.currentStep, decision);
    
    if (!nextStep) {
      throw new InvalidWorkflowTransitionError(this.currentStep, decision);
    }

    if (!this.workflowEngine.validateTransition(this.currentStep, nextStep)) {
      throw new InvalidWorkflowTransitionError(this.currentStep, nextStep);
    }

    const previousStep = this.currentStep;
    this.currentStep = nextStep;

    this.addDomainEvent(new WorkflowProgressedEvent(
      this.id.value,
      previousStep,
      nextStep,
      actor,
      new Date()
    ));
  }
}

// ❌ WRONG: Hard-coded workflow transitions
export class BadWorkflowAggregate extends AggregateRoot {
  approve(): void {
    if (this.status === 'submitted') {
      this.status = 'approved'; // No validation, inflexible
    }
  }
}
```

### 5. Multi-Tenant Pattern

**Purpose**: Support multiple tenants with different configurations and business rules

```typescript
// ✅ CORRECT: Tenant-aware aggregate with configuration
export class MultiTenantAggregate extends AggregateRoot {
  private tenantId: string;
  private tenantConfig: TenantConfig;

  constructor(id: EntityId, tenantId: string, tenantConfig: TenantConfig) {
    super(id);
    this.tenantId = tenantId;
    this.tenantConfig = tenantConfig;
  }

  static create(
    tenantId: string,
    data: CreateData,
    tenantConfig: TenantConfig
  ): MultiTenantAggregate {
    // Validate against tenant-specific limits
    if (data.amount > tenantConfig.maxAmount) {
      throw new TenantLimitExceededError(data.amount, tenantConfig.maxAmount);
    }

    const aggregate = new MultiTenantAggregate(
      EntityId.generate(),
      tenantId,
      tenantConfig
    );

    aggregate.initializeWithTenantRules(data);
    return aggregate;
  }

  processRequest(request: Request): void {
    // Use tenant-specific business rules
    this.validateWithTenantRules(request);
    
    // Apply tenant-specific workflow
    const workflow = this.tenantConfig.getWorkflow(request.type);
    this.executeWithWorkflow(request, workflow);
  }

  private validateWithTenantRules(request: Request): void {
    // Tenant-specific validation logic
    const rules = this.tenantConfig.getValidationRules(request.type);
    rules.forEach(rule => rule.validate(request));
  }
}

// ❌ WRONG: Hard-coded single tenant logic
export class BadMultiTenantAggregate extends AggregateRoot {
  processRequest(request: Request): void {
    if (request.amount > 10000) { // Hard-coded limit for all tenants
      throw new Error('Amount too high');
    }
  }
}
```

## Advanced State Management

### Optimistic Locking

```typescript
// ✅ CORRECT: Version-based optimistic locking
export class VersionedAggregate extends AggregateRoot {
  private version: number = 0;

  performOperation(expectedVersion: number): void {
    if (this.version !== expectedVersion) {
      throw new OptimisticLockingError(
        this.version, 
        expectedVersion, 
        'Aggregate was modified by another process'
      );
    }

    this.executeOperation();
    this.version++; // Increment version on each change
  }

  getCurrentVersion(): number {
    return this.version;
  }
}
```

### Memory Management

```typescript
// ✅ CORRECT: Bounded collections to prevent memory leaks
export class MemoryEfficientAggregate extends AggregateRoot {
  private transactions: Transaction[] = [];
  private readonly MAX_TRANSACTIONS = 100;

  addTransaction(transaction: Transaction): void {
    this.transactions.push(transaction);
    
    // Keep only recent transactions to prevent memory issues
    if (this.transactions.length > this.MAX_TRANSACTIONS) {
      this.transactions = this.transactions.slice(-this.MAX_TRANSACTIONS);
    }
  }
}

// ❌ WRONG: Unbounded growth
export class BadMemoryAggregate extends AggregateRoot {
  private transactions: Transaction[] = [];

  addTransaction(transaction: Transaction): void {
    this.transactions.push(transaction); // Grows indefinitely
  }
}
```

## Event Management Strategies

### Event Batching

```typescript
// ✅ CORRECT: Strategic event emission
export class EfficientEventAggregate extends AggregateRoot {
  private pendingCalculations: boolean = false;

  addMultipleItems(items: Item[]): void {
    items.forEach(item => {
      this.addItemWithoutRecalculation(item);
      
      // Emit individual item events
      this.addDomainEvent(new ItemAddedEvent(this.id.value, item));
    });

    // Single recalculation and summary event
    this.recalculateTotal();
    this.addDomainEvent(new CartTotalRecalculatedEvent(
      this.id.value,
      this.totalAmount,
      items.length
    ));
  }
}
```

### Event Versioning

```typescript
// ✅ CORRECT: Event schema evolution support
export abstract class VersionedDomainEvent extends DomainEvent {
  public readonly eventVersion: number = 1;
  public readonly eventSchema: string;

  constructor(eventSchema: string) {
    super();
    this.eventSchema = eventSchema;
  }
}

export class ItemAddedEventV2 extends VersionedDomainEvent {
  public readonly eventVersion: number = 2;

  constructor(
    public readonly itemId: string,
    public readonly item: Item,
    public readonly addedBy: string // New field in V2
  ) {
    super('ItemAdded');
  }
}

// Event upcasting for backward compatibility
export class EventUpcastingService {
  upcastEvent(event: any): VersionedDomainEvent {
    if (event.eventSchema === 'ItemAdded' && event.eventVersion === 1) {
      return new ItemAddedEventV2(
        event.itemId,
        event.item,
        'unknown' // Default value for missing field
      );
    }
    
    return event;
  }
}
```

## Testing Strategies

### Event Sourcing Tests

```typescript
// ✅ CORRECT: Event sourcing test pattern
describe('EventSourcedAggregate', () => {
  it('should reconstruct state from events', () => {
    // Given - historical events
    const events = [
      new CartCreatedEvent('cart-1', 'customer-1'),
      new ItemAddedEvent('cart-1', { id: 'item-1', price: 10 }),
      new ItemAddedEvent('cart-1', { id: 'item-2', price: 20 })
    ];

    // When - reconstruct from events
    const [error, cart] = safeRun(() =>
      EventSourcedCart.fromEvents(EntityId.fromString('cart-1'), events)
    );

    // Then - verify state
    expect(error).toBeUndefined();
    expect(cart.totalAmount).toBe(30);
    expect(cart.itemCount).toBe(2);
    expect(cart.getUncommittedEvents()).toHaveLength(0); // No new events during reconstitution
  });

  it('should maintain idempotency during event replay', () => {
    const events = [new ItemAddedEvent('cart-1', { id: 'item-1', price: 10 })];
    
    // Apply events multiple times
    const cart1 = EventSourcedCart.fromEvents(EntityId.fromString('cart-1'), events);
    const cart2 = EventSourcedCart.fromEvents(EntityId.fromString('cart-1'), events);

    expect(cart1.totalAmount).toBe(cart2.totalAmount);
  });
});
```

### Capability Testing

```typescript
// ✅ CORRECT: Test capabilities in isolation
describe('RiskAssessmentCapability', () => {
  let mockAggregate: jest.Mocked<BankingAggregate>;
  let riskCapability: RiskAssessmentCapability;

  beforeEach(() => {
    mockAggregate = createMockAggregate();
    riskCapability = new RiskAssessmentCapability(mockAggregate);
  });

  it('should calculate risk score based on transaction amount', () => {
    const transaction = createTestTransaction({ amount: 10000 });
    
    const assessment = riskCapability.assessRisk(transaction);
    
    expect(assessment.score).toBeGreaterThan(0);
    expect(assessment.factors).toContain('large-amount');
  });

  it('should identify fraud patterns', () => {
    const suspiciousTransactions = [
      createTestTransaction({ amount: 100, timestamp: new Date() }),
      createTestTransaction({ amount: 100, timestamp: new Date() }),
      createTestTransaction({ amount: 100, timestamp: new Date() })
    ];

    const hasFraud = riskCapability.checkFraudPatterns(suspiciousTransactions);
    
    expect(hasFraud).toBe(true);
  });
});
```

### Workflow Testing

```typescript
// ✅ CORRECT: Workflow state machine testing
describe('LoanWorkflowEngine', () => {
  let workflowEngine: LoanWorkflowEngine;

  beforeEach(() => {
    workflowEngine = new LoanWorkflowEngine(createTestTenantConfig());
  });

  it('should progress through valid transitions', () => {
    const nextStep = workflowEngine.getNextStep('submitted', 'auto-approved');
    
    expect(nextStep).toBe('document-collection');
    expect(workflowEngine.validateTransition('submitted', 'document-collection')).toBe(true);
  });

  it('should reject invalid transitions', () => {
    const nextStep = workflowEngine.getNextStep('submitted', 'invalid-decision');
    
    expect(nextStep).toBeNull();
    expect(workflowEngine.validateTransition('submitted', 'final-approval')).toBe(false);
  });
});
```

## Performance Considerations

### Snapshot Strategy

```typescript
// ✅ CORRECT: Smart snapshot timing
export class SmartSnapshotAggregate extends AggregateRoot {
  private static readonly SNAPSHOT_FREQUENCY = 50; // Every 50 events

  shouldCreateSnapshot(): boolean {
    return this.eventVersion % SmartSnapshotAggregate.SNAPSHOT_FREQUENCY === 0;
  }

  createSnapshotIfNeeded(): SnapshotData | null {
    if (this.shouldCreateSnapshot()) {
      return this.toSnapshot();
    }
    return null;
  }
}
```

### Lazy Loading

```typescript
// ✅ CORRECT: Lazy load expensive calculations
export class LazyCalculationAggregate extends AggregateRoot {
  private _expensiveCalculation?: ComplexResult;
  private calculationDirty: boolean = true;

  get expensiveResult(): ComplexResult {
    if (this.calculationDirty || !this._expensiveCalculation) {
      this._expensiveCalculation = this.performExpensiveCalculation();
      this.calculationDirty = false;
    }
    return this._expensiveCalculation;
  }

  private markCalculationDirty(): void {
    this.calculationDirty = true;
  }
}
```

## Anti-Patterns to Avoid

### 1. God Aggregate

```typescript
// ❌ WRONG: Aggregate handling too many responsibilities
export class GodAggregate extends AggregateRoot {
  // Hundreds of methods handling different business concerns
  processPayment() { /* ... */ }
  calculateTaxes() { /* ... */ }
  validateCompliance() { /* ... */ }
  generateReports() { /* ... */ }
  sendNotifications() { /* ... */ }
  // ... many more unrelated methods
}

// ✅ CORRECT: Focused aggregate with clear boundaries
export class PaymentAggregate extends AggregateRoot {
  processPayment() { /* ... */ }
  validatePaymentMethod() { /* ... */ }
  calculateFees() { /* ... */ }
  // Only payment-related responsibilities
}
```

### 2. Event Sourcing Without Snapshots

```typescript
// ❌ WRONG: Always replaying all events
static fromEvents(id: EntityId, events: DomainEvent[]): SlowAggregate {
  const aggregate = new SlowAggregate(id);
  
  // Inefficient for aggregates with thousands of events
  events.forEach(event => aggregate.applyEvent(event));
  
  return aggregate;
}

// ✅ CORRECT: Snapshot optimization
static fromSnapshotAndEvents(
  id: EntityId,
  snapshot: SnapshotData,
  eventsAfterSnapshot: DomainEvent[]
): FastAggregate {
  const aggregate = new FastAggregate(id);
  
  aggregate.restoreFromSnapshot(snapshot); // Fast restoration
  eventsAfterSnapshot.forEach(event => aggregate.applyEvent(event)); // Minimal replay
  
  return aggregate;
}
```

## Key Takeaways

1. **Event Sourcing**: Use for complete audit trails and temporal queries
2. **Snapshots**: Optimize performance for long-lived aggregates
3. **Capabilities**: Separate complex business logic into focused, testable components
4. **Workflows**: Use workflow engines for complex multi-step processes
5. **Multi-Tenancy**: Design for configuration-driven behavior differences
6. **Versioning**: Plan for event schema evolution from the start
7. **Memory Management**: Keep collections bounded to prevent memory leaks
8. **Testing**: Test capabilities, workflows, and event sourcing scenarios separately
9. **Performance**: Use lazy loading and smart snapshot strategies
10. **Boundaries**: Keep aggregates focused on their core business responsibility

These intermediate patterns enable you to handle complex business scenarios while maintaining the integrity and testability that make aggregates valuable in domain-driven design.