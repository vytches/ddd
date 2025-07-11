import { TestDataBuilder, type TestDataBuilderOptions } from '../core/test-data-builder';
import type { IAggregateRoot, IAggregateConstructorParams } from '@vytches-ddd/aggregates';
import type { IExtendedDomainEvent, IEventMetadata, EntityId } from '@vytches-ddd/contracts';
import { Logger } from '@vytches-ddd/logging';

/**
 * Aggregate-specific options for test building
 */
export interface AggregateTestOptions<T extends IAggregateRoot> {
  /** Auto-generate domain events during build */
  autoGenerateEvents?: boolean | undefined;
  /** Events to add to the aggregate */
  domainEvents?: IExtendedDomainEvent[] | undefined;
  /** Version to set for the aggregate */
  version?: number | undefined;
  /** Initial version to set for the aggregate */
  initialVersion?: number | undefined;
  /** Capabilities to add to the aggregate */
  capabilities?: unknown[] | undefined;
  /** Auto-apply events to change aggregate state */
  autoApplyEvents?: boolean | undefined;
  /** Generate realistic event metadata */
  generateEventMetadata?: boolean | undefined;
}

/**
 * Event scenario for testing complex aggregate flows
 */
export interface AggregateEventScenario {
  name: string;
  description?: string;
  events: Array<{
    eventType: string;
    payload?: unknown;
    metadata?: Partial<IEventMetadata>;
    delay?: number; // milliseconds to wait before applying this event
  }>;
  expectedVersion?: number;
  expectedEventCount?: number;
  expectedState?: Partial<unknown>;
}

/**
 * Aggregate state snapshot for testing
 */
export interface AggregateStateSnapshot<T extends IAggregateRoot> {
  id: EntityId;
  version: number;
  initialVersion: number;
  domainEvents: ReadonlyArray<IExtendedDomainEvent>;
  hasChanges: boolean;
  capabilities: string[];
  customState?: Partial<T>;
}

/**
 * Enhanced TestDataBuilder for Domain-Driven Design Aggregates
 *
 * Provides specialized functionality for testing aggregates including:
 * - Domain event generation and application
 * - Aggregate versioning and state management
 * - Event sourcing scenarios
 * - Capability testing
 * - Complex aggregate workflows
 *
 * Usage Examples:
 * ```typescript
 * // Basic aggregate building
 * const order = new AggregateTestBuilder(OrderAggregate)
 *   .withId('order-123')
 *   .withVersion(5)
 *   .withDomainEvents([orderCreatedEvent, paymentProcessedEvent])
 *   .build();
 *
 * // Event scenario testing
 * const orderFlow = await aggregateBuilder
 *   .buildWithScenario({
 *     name: 'Order Processing Flow',
 *     events: [
 *       { eventType: 'OrderCreated', payload: { customerId: '123' } },
 *       { eventType: 'PaymentProcessed', payload: { amount: 100 } },
 *       { eventType: 'OrderShipped', payload: { trackingNumber: 'ABC123' } }
 *     ],
 *     expectedVersion: 3
 *   });
 *
 * // State snapshot testing
 * const snapshot = aggregateBuilder.createSnapshot(existingAggregate);
 * const restoredAggregate = aggregateBuilder.buildFromSnapshot(snapshot);
 * ```
 */
export class AggregateTestBuilder<T extends IAggregateRoot> extends TestDataBuilder<T> {
  private aggregateClass: new (...args: any[]) => T;
  private aggregateOptions: AggregateTestOptions<T> = {};
  private logger: ReturnType<typeof Logger.forContext>;
  private eventSequence = 0;
  private stateSnapshots = new Map<string, AggregateStateSnapshot<T>>();

  constructor(
    AggregateClass: new (...args: any[]) => T,
    options: TestDataBuilderOptions<T> & AggregateTestOptions<T> = {}
  ) {
    // Extract aggregate-specific options
    const {
      autoGenerateEvents,
      domainEvents,
      version,
      initialVersion,
      capabilities,
      autoApplyEvents,
      generateEventMetadata,
      ...builderOptions
    } = options;

    super(builderOptions);

    this.aggregateClass = AggregateClass;
    this.aggregateOptions = {
      autoGenerateEvents,
      domainEvents,
      version,
      initialVersion,
      capabilities,
      autoApplyEvents,
      generateEventMetadata,
    };

    this.logger = Logger.forContext('AggregateTestBuilder');

    // Set up default aggregate factory
    this.withFactory(data => this.createAggregateInstance(data));
  }

  // ==========================================
  // AGGREGATE-SPECIFIC BUILDERS
  // ==========================================

  /**
   * Set the aggregate ID
   */
  withId<TId = string>(id: EntityId<TId> | TId): this {
    if (typeof id === 'string' || typeof id === 'number') {
      return this.with('id' as keyof T, { getValue: () => id } as T[keyof T]);
    }
    return this.with('id' as keyof T, id as T[keyof T]);
  }

  /**
   * Set the aggregate version
   */
  withVersion(version: number): this {
    this.aggregateOptions.version = version;
    return this;
  }

  /**
   * Set the initial version
   */
  withInitialVersion(version: number): this {
    this.aggregateOptions.initialVersion = version;
    return this;
  }

  /**
   * Add domain events to the aggregate
   */
  withDomainEvents(events: IExtendedDomainEvent[]): this {
    this.aggregateOptions.domainEvents = [...(this.aggregateOptions.domainEvents || []), ...events];
    return this;
  }

  /**
   * Add a single domain event
   */
  withDomainEvent(event: IExtendedDomainEvent): this {
    this.aggregateOptions.domainEvents = [...(this.aggregateOptions.domainEvents || []), event];
    return this;
  }

  /**
   * Generate domain events automatically
   */
  withAutoGeneratedEvents(count = 3, eventTypePrefix = 'TestEvent'): this {
    const events: IExtendedDomainEvent[] = [];

    for (let i = 0; i < count; i++) {
      events.push(
        this.generateTestEvent(`${eventTypePrefix}${i + 1}`, {
          sequenceNumber: ++this.eventSequence,
          generatedAt: new Date(),
          testData: `auto-generated-${i + 1}`,
        })
      );
    }

    return this.withDomainEvents(events);
  }

  /**
   * Add capabilities to the aggregate
   */
  withCapabilities(capabilities: unknown[]): this {
    this.aggregateOptions.capabilities = [
      ...(this.aggregateOptions.capabilities || []),
      ...capabilities,
    ];
    return this;
  }

  /**
   * Enable auto-application of events to change aggregate state
   */
  withAutoApplyEvents(enabled = true): this {
    this.aggregateOptions.autoApplyEvents = enabled;
    return this;
  }

  /**
   * Generate realistic event metadata
   */
  withEventMetadata(enabled = true): this {
    this.aggregateOptions.generateEventMetadata = enabled;
    return this;
  }

  // ==========================================
  // AGGREGATE SCENARIO BUILDING
  // ==========================================

  /**
   * Build aggregate using an event scenario
   */
  async buildWithScenario(scenario: AggregateEventScenario): Promise<T> {
    this.logger.info('Building aggregate with scenario', {
      scenarioName: scenario.name,
      eventCount: scenario.events.length,
      expectedVersion: scenario.expectedVersion,
    });

    // Create base aggregate
    const aggregate = this.build();

    // Apply events in sequence
    for (const eventDef of scenario.events) {
      if (eventDef.delay) {
        await this.delay(eventDef.delay);
      }

      const event = this.generateTestEvent(eventDef.eventType, eventDef.payload, eventDef.metadata);

      // Apply event to aggregate if auto-apply is enabled
      if (this.aggregateOptions.autoApplyEvents) {
        (aggregate as unknown as { apply: (event: IExtendedDomainEvent) => void }).apply(event);
      } else {
        // For non-auto-apply, manually add to domain events array and increment version
        const aggregateWithEvents = aggregate as unknown as {
          _domainEvents: IExtendedDomainEvent[];
          _version: number;
        };
        if (!aggregateWithEvents._domainEvents) {
          aggregateWithEvents._domainEvents = [];
        }
        aggregateWithEvents._domainEvents.push(event);
        aggregateWithEvents._version++;
      }
    }

    // Validate scenario expectations
    if (scenario.expectedVersion !== undefined) {
      const actualVersion = aggregate.getVersion();
      if (actualVersion !== scenario.expectedVersion) {
        throw new Error(
          `Scenario '${scenario.name}' expected version ${scenario.expectedVersion} but got ${actualVersion}`
        );
      }
    }

    if (scenario.expectedEventCount !== undefined) {
      const actualEventCount = aggregate.getDomainEvents().length;
      if (actualEventCount !== scenario.expectedEventCount) {
        throw new Error(
          `Scenario '${scenario.name}' expected ${scenario.expectedEventCount} events but got ${actualEventCount}`
        );
      }
    }

    this.logger.info('Aggregate scenario completed successfully', {
      scenarioName: scenario.name,
      finalVersion: aggregate.getVersion(),
      eventCount: aggregate.getDomainEvents().length,
    });

    return aggregate;
  }

  /**
   * Build multiple aggregates with different scenarios
   */
  async buildMultipleWithScenarios(scenarios: AggregateEventScenario[]): Promise<T[]> {
    const aggregates: T[] = [];

    for (const scenario of scenarios) {
      const aggregate = await this.buildWithScenario(scenario);
      aggregates.push(aggregate);
    }

    return aggregates;
  }

  // ==========================================
  // STATE MANAGEMENT
  // ==========================================

  /**
   * Create a state snapshot of an aggregate
   */
  createSnapshot(aggregate: T, name?: string): AggregateStateSnapshot<T> {
    const snapshot: AggregateStateSnapshot<T> = {
      id: aggregate.getId() as EntityId,
      version: aggregate.getVersion(),
      initialVersion: aggregate.getInitialVersion(),
      domainEvents: aggregate.getDomainEvents(),
      hasChanges: aggregate.hasChanges(),
      capabilities: (aggregate as any).getCapabilityTypes?.() || [],
      customState: this.extractCustomState(aggregate),
    };

    if (name) {
      this.stateSnapshots.set(name, snapshot);
      this.logger.debug('Aggregate snapshot created', {
        snapshotName: name,
        aggregateId: snapshot.id.getValue(),
        version: snapshot.version,
        eventCount: snapshot.domainEvents.length,
      });
    }

    return snapshot;
  }

  /**
   * Build aggregate from a state snapshot
   */
  buildFromSnapshot(snapshot: AggregateStateSnapshot<T>): T {
    this.logger.debug('Building aggregate from snapshot', {
      aggregateId: snapshot.id.getValue(),
      version: snapshot.version,
      eventCount: snapshot.domainEvents.length,
    });

    const aggregate = new this.aggregateClass({
      id: snapshot.id as unknown,
      version: snapshot.initialVersion,
    } as IAggregateConstructorParams<unknown>) as T;

    // Restore domain events
    if (snapshot.domainEvents.length > 0) {
      const events = [...snapshot.domainEvents];
      // For snapshot restoration, we want to restore the exact state including domain events
      // rather than replaying history which would clear the domain events
      if (!(aggregate as any)._domainEvents) {
        (aggregate as any)._domainEvents = [];
      }
      (aggregate as any)._domainEvents = [...events];
    }

    // Set the correct version from snapshot
    (aggregate as any)._version = snapshot.version;

    // Restore capabilities
    if (snapshot.capabilities.length > 0 && this.aggregateOptions.capabilities) {
      for (const capability of this.aggregateOptions.capabilities) {
        (aggregate as any).addCapability?.(capability);
      }
    }

    // Set internal state if needed
    if (snapshot.customState) {
      this.applyCustomState(aggregate, snapshot.customState);
    }

    return aggregate;
  }

  /**
   * Get a saved snapshot by name
   */
  getSnapshot(name: string): AggregateStateSnapshot<T> | undefined {
    return this.stateSnapshots.get(name);
  }

  /**
   * Compare two aggregate snapshots
   */
  compareSnapshots(
    snapshot1: AggregateStateSnapshot<T>,
    snapshot2: AggregateStateSnapshot<T>
  ): {
    identical: boolean;
    differences: string[];
  } {
    const differences: string[] = [];

    if (snapshot1.id.getValue() !== snapshot2.id.getValue()) {
      differences.push(`ID differs: ${snapshot1.id.getValue()} vs ${snapshot2.id.getValue()}`);
    }

    if (snapshot1.version !== snapshot2.version) {
      differences.push(`Version differs: ${snapshot1.version} vs ${snapshot2.version}`);
    }

    if (snapshot1.domainEvents.length !== snapshot2.domainEvents.length) {
      differences.push(
        `Event count differs: ${snapshot1.domainEvents.length} vs ${snapshot2.domainEvents.length}`
      );
    }

    if (snapshot1.hasChanges !== snapshot2.hasChanges) {
      differences.push(`Has changes differs: ${snapshot1.hasChanges} vs ${snapshot2.hasChanges}`);
    }

    return {
      identical: differences.length === 0,
      differences,
    };
  }

  // ==========================================
  // EVENT UTILITIES
  // ==========================================

  /**
   * Generate a test domain event
   */
  generateTestEvent(
    eventType: string,
    payload?: unknown,
    metadata?: Partial<IEventMetadata>
  ): IExtendedDomainEvent {
    const baseMetadata: IEventMetadata = {
      timestamp: new Date(),
      version: 1,
      eventId: `test-event-${++this.eventSequence}`,
      correlationId: `test-correlation-${Date.now()}`,
      causationId: `test-causation-${Date.now()}`,
      ...(this.aggregateOptions.generateEventMetadata ? this.generateRealisticMetadata() : {}),
      ...metadata,
    };

    return {
      eventType,
      payload: payload || this.generateTestPayload(eventType),
      metadata: baseMetadata,
    };
  }

  /**
   * Generate realistic event metadata
   */
  private generateRealisticMetadata(): Partial<IEventMetadata> {
    return {
      userId: `user-${Math.random().toString(36).substring(2, 11)}`,
      sessionId: `session-${Math.random().toString(36).substring(2, 11)}`,
      requestId: `req-${Math.random().toString(36).substring(2, 11)}`,
      tenantId: `tenant-${Math.random().toString(36).substring(2, 11)}`,
      source: 'AggregateTestBuilder',
      environment: 'test',
    };
  }

  /**
   * Generate test payload for an event type
   */
  private generateTestPayload(eventType: string): unknown {
    // Generate payload based on event type patterns
    if (eventType.includes('Created')) {
      return {
        id: `test-id-${++this.eventSequence}`,
        createdAt: new Date(),
        createdBy: 'test-user',
      };
    }

    if (eventType.includes('Updated')) {
      return {
        updatedAt: new Date(),
        updatedBy: 'test-user',
        previousValue: 'old-value',
        newValue: 'new-value',
      };
    }

    if (eventType.includes('Deleted')) {
      return {
        deletedAt: new Date(),
        deletedBy: 'test-user',
        reason: 'test-deletion',
      };
    }

    // Default payload
    return {
      testData: `generated-for-${eventType}`,
      timestamp: new Date(),
      sequenceNumber: this.eventSequence,
    };
  }

  // ==========================================
  // AGGREGATE CREATION
  // ==========================================

  /**
   * Create aggregate instance with all configurations applied
   */
  private createAggregateInstance(data: Partial<T>): T {
    // Extract ID for aggregate constructor
    const idValue =
      (data as unknown as { id?: EntityId<unknown> }).id ||
      ({ getValue: () => `test-aggregate-${Date.now()}` } as EntityId<unknown>);

    const constructorParams = {
      id: idValue as unknown,
      version: this.aggregateOptions.initialVersion || 0,
    } as IAggregateConstructorParams<unknown>;

    const aggregate = new this.aggregateClass(constructorParams);

    // Add domain events first
    if (this.aggregateOptions.domainEvents && this.aggregateOptions.domainEvents.length > 0) {
      for (const event of this.aggregateOptions.domainEvents) {
        if (this.aggregateOptions.autoApplyEvents) {
          (aggregate as unknown as { apply: (event: IExtendedDomainEvent) => void }).apply(event);
        } else {
          // Access private _domainEvents array directly for testing
          const aggregateWithEvents = aggregate as unknown as {
            _domainEvents: IExtendedDomainEvent[];
            _version: number;
          };
          if (!aggregateWithEvents._domainEvents) {
            aggregateWithEvents._domainEvents = [];
          }
          aggregateWithEvents._domainEvents.push(event);
          aggregateWithEvents._version++;
        }
      }
    }

    // Apply explicit version if specified (this overrides any version from events)
    if (this.aggregateOptions.version !== undefined) {
      (aggregate as unknown as { _version: number })._version = this.aggregateOptions.version;
    }

    // Add capabilities
    if (this.aggregateOptions.capabilities && this.aggregateOptions.capabilities.length > 0) {
      for (const capability of this.aggregateOptions.capabilities) {
        (aggregate as unknown as { addCapability?: (capability: unknown) => void }).addCapability?.(
          capability
        );
      }
    }

    // Apply any custom data
    Object.assign(aggregate, data);

    this.logger.debug('Aggregate instance created', {
      aggregateType: this.aggregateClass.name,
      id: aggregate.getId().getValue(),
      version: aggregate.getVersion(),
      eventCount: aggregate.getDomainEvents().length,
      capabilityCount: this.aggregateOptions.capabilities?.length || 0,
    });

    return aggregate;
  }

  /**
   * Extract custom state from aggregate (override in subclasses for specific aggregates)
   */
  protected extractCustomState(_aggregate: T): Partial<T> {
    // Default implementation - can be overridden for specific aggregate types
    return {};
  }

  /**
   * Apply custom state to aggregate (override in subclasses for specific aggregates)
   */
  protected applyCustomState(aggregate: T, customState: Partial<T>): void {
    // Default implementation - can be overridden for specific aggregate types
    Object.assign(aggregate, customState);
  }

  /**
   * Simple delay utility for scenario testing
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ==========================================
  // FLUENT CLONE CREATION
  // ==========================================

  /**
   * Clone this builder with all settings preserved
   */
  override clone(): this {
    const cloned = new (this.constructor as new (
      aggregateClass: new (...args: any[]) => T,
      options?: TestDataBuilderOptions<T> & AggregateTestOptions<T>
    ) => this)(this.aggregateClass, {
      ...this.options,
      ...this.aggregateOptions,
    });

    // Copy internal state
    cloned.data = { ...this.data };
    (cloned as unknown as { eventSequence: number }).eventSequence = this.eventSequence;
    (
      cloned as unknown as { stateSnapshots: Map<string, AggregateStateSnapshot<T>> }
    ).stateSnapshots = new Map(this.stateSnapshots);

    return cloned;
  }
}

// ==========================================
// SPECIALIZED BUILDERS
// ==========================================

/**
 * Specialized builder for testing aggregates with event sourcing
 */
export class EventSourcedAggregateTestBuilder<
  T extends IAggregateRoot,
> extends AggregateTestBuilder<T> {
  private eventHistory: IExtendedDomainEvent[] = [];

  constructor(
    AggregateClass: new (...args: any[]) => T,
    options: TestDataBuilderOptions<T> & AggregateTestOptions<T> = {}
  ) {
    super(AggregateClass, { ...options, autoApplyEvents: true });
  }

  /**
   * Add events to the event history (for event sourcing)
   */
  withEventHistory(events: IExtendedDomainEvent[]): this {
    this.eventHistory = [...this.eventHistory, ...events];
    return this;
  }

  /**
   * Build aggregate by replaying event history
   */
  buildFromEventHistory(): T {
    const aggregate = new (
      this as unknown as { aggregateClass: new (params: IAggregateConstructorParams<unknown>) => T }
    ).aggregateClass({
      id:
        (this.data as unknown as { id?: EntityId<unknown> }).id ||
        ({ getValue: () => `test-aggregate-${Date.now()}` } as EntityId<unknown> as unknown),
      version: 0,
    } as IAggregateConstructorParams<unknown>);

    // Replay event history
    if (this.eventHistory.length > 0) {
      (
        aggregate as unknown as { loadFromHistory: (events: IExtendedDomainEvent[]) => void }
      ).loadFromHistory(this.eventHistory);
    }

    return aggregate;
  }

  /**
   * Create event sourcing scenario
   */
  async buildEventSourcingScenario(
    events: Array<{
      eventType: string;
      payload?: unknown;
      delay?: number;
    }>
  ): Promise<{
    aggregate: T;
    eventHistory: IExtendedDomainEvent[];
  }> {
    const generatedEvents: IExtendedDomainEvent[] = [];

    for (const eventDef of events) {
      if (eventDef.delay) {
        await (this as unknown as { delay: (ms: number) => Promise<void> }).delay(eventDef.delay);
      }

      const event = this.generateTestEvent(eventDef.eventType, eventDef.payload);
      generatedEvents.push(event);
    }

    this.withEventHistory(generatedEvents);
    const aggregate = this.buildFromEventHistory();

    return {
      aggregate,
      eventHistory: this.eventHistory,
    };
  }
}

/**
 * Factory function for creating aggregate test builders
 */
export function createAggregateTestBuilder<T extends IAggregateRoot>(
  AggregateClass: new (...args: any[]) => T,
  options?: TestDataBuilderOptions<T> & AggregateTestOptions<T>
): AggregateTestBuilder<T> {
  return new AggregateTestBuilder(AggregateClass as any, options);
}

/**
 * Factory function for creating event-sourced aggregate test builders
 */
export function createEventSourcedAggregateTestBuilder<T extends IAggregateRoot>(
  AggregateClass: new (...args: any[]) => T,
  options?: TestDataBuilderOptions<T> & AggregateTestOptions<T>
): EventSourcedAggregateTestBuilder<T> {
  return new EventSourcedAggregateTestBuilder(AggregateClass as any, options);
}
