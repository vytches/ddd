import type { IEventStore, Capability } from '@vytches/ddd-contracts';
import { EntityId } from '@vytches/ddd-contracts';

import { AggregateRoot } from './aggregate-root';
import type { IAggregateConstructorParams, IAggregateCapability } from './aggregate-interfaces';

// Import capability classes
import { SnapshotCapability } from './capabilities/snapshot-capability';
import { VersioningCapability } from './capabilities/versioning-capability';
import { EventSourcingCapability } from './capabilities/event-sourcing-capability';
import { AuditCapability } from './capabilities/audit-capability';

/**
 * @llm-summary AggregateBuilder class for aggregate builder operations
 * @llm-domain Pattern
 * @llm-complexity Medium
 *
 * @description
 * AggregateBuilder class implementing domain pattern implementation for aggregate builder operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new AggregateBuilder();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new AggregateBuilder());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class AggregateBuilder<TId = string> {
  private params: IAggregateConstructorParams<TId>;
  private capabilities: Array<{
    capability: Capability & IAggregateCapability;
    configure?: ((cap: Capability & IAggregateCapability) => void) | undefined;
  }> = [];
  private eventStore?: IEventStore;

  private constructor(params: IAggregateConstructorParams<TId>) {
    this.params = params;
  }

  /**
   * Create a new builder instance
   */
  static create<TId = string>(params: {
    id: TId | EntityId<TId>;
    version?: number;
  }): AggregateBuilder<TId> {
    const constructorParams: IAggregateConstructorParams<TId> = {
      id: params.id instanceof EntityId ? params.id : new EntityId(params.id, 'text'),
      version: params.version || 0,
    };
    return new AggregateBuilder(constructorParams);
  }

  /**
   * Add snapshot capability
   */
  withSnapshots(): this {
    this.capabilities.push({ capability: new SnapshotCapability() });
    return this;
  }

  /**
   * Add versioning capability
   */
  withVersioning(): this {
    this.capabilities.push({ capability: new VersioningCapability() });
    return this;
  }

  /**
   * Add audit capability
   */
  withAudit(): this {
    this.capabilities.push({ capability: new AuditCapability() });
    return this;
  }

  /**
   * Add event sourcing capability
   */
  withEventSourcing(eventStore?: IEventStore): this {
    const capability = new EventSourcingCapability();
    this.capabilities.push({
      capability,
      configure: (cap: Capability & IAggregateCapability) => {
        const eventSourcingCap = cap as EventSourcingCapability;
        if (eventStore) {
          eventSourcingCap.setEventStore(eventStore);
        } else if (this.eventStore) {
          eventSourcingCap.setEventStore(this.eventStore);
        }
      },
    });
    return this;
  }

  /**
   * Add a custom capability
   */
  withCapability<T extends Capability & IAggregateCapability>(
    capability: T,
    configure?: (cap: T) => void
  ): this {
    this.capabilities.push({
      capability,
      configure: configure
        ? (cap: Capability & IAggregateCapability) => configure(cap as T)
        : undefined,
    });
    return this;
  }

  /**
   * Set event store for event sourcing
   */
  setEventStore(eventStore: IEventStore): this {
    this.eventStore = eventStore;
    return this;
  }

  /**
   * Build the aggregate with all configured capabilities
   */
  build<TAgg extends AggregateRoot<TId> = AggregateRoot<TId>>(
    AggregateClass?: new (params: IAggregateConstructorParams<TId>) => TAgg
  ): TAgg {
    const AggCtor = AggregateClass || AggregateRoot;
    const aggregate = new AggCtor(this.params) as TAgg;

    // Add all capabilities
    for (const { capability, configure } of this.capabilities) {
      aggregate.addCapability(capability);
      if (configure) {
        configure(capability);
      }
    }

    return aggregate;
  }

  /**
   * Build with all standard capabilities
   */
  buildWithAllCapabilities<TAgg extends AggregateRoot<TId> = AggregateRoot<TId>>(
    AggregateClass?: new (params: IAggregateConstructorParams<TId>) => TAgg
  ): TAgg {
    return this.withSnapshots()
      .withVersioning()
      .withAudit()
      .withEventSourcing()
      .build(AggregateClass);
  }
}

/**
 * @llm-summary aggregate builder function
 * @llm-domain Pattern
 * @llm-pure false
 *
 * @description
 * aggregateBuilder function implementing domain pattern implementation for aggregate builder operations.
 *
 * @throws {Error} When validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = aggregateBuilder();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, result] = safeRun(() => aggregateBuilder());
 * ```
 *
 * @since 1.0.0
 * @public
 */
export function aggregateBuilder<TId = string>(params: {
  id: TId | EntityId<TId>;
  version?: number;
}): AggregateBuilder<TId> {
  return AggregateBuilder.create(params);
}
