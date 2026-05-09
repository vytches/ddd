import type { Capability, IEventStore } from '@vytches/ddd-contracts';
import { EntityId } from '@vytches/ddd-contracts';

import type { IAggregateCapability, IAggregateConstructorParams } from '../aggregate-interfaces';
import { AggregateRoot } from './aggregate-root';

// Import capability classes
import { AuditCapability } from '../capabilities/audit-capability';
import { EventSourcingCapability } from '../capabilities/event-sourcing-capability';
import { SnapshotCapability } from '../capabilities/snapshot-capability';
import { VersioningCapability } from '../capabilities/versioning-capability';

/**
 * Fluent builder for assembling an aggregate root with a custom mix of
 * capabilities (snapshots, audit, versioning, event sourcing) — without
 * inheritance chains or constructor explosion.
 *
 * Why a builder? Capabilities have order-sensitive setup (audit must
 * intercept `apply()` before any events are recorded) and many aggregates
 * use only some of them. Hard-coding a base class with all four capabilities
 * pulls in machinery you may not need; manual wiring is error-prone. The
 * builder makes order correct by construction.
 *
 * @example Single capability
 * ```typescript
 * import { AggregateBuilder } from '@vytches/ddd-aggregates';
 * import { EntityId } from '@vytches/ddd-value-objects';
 *
 * const order = AggregateBuilder
 *   .create({ id: EntityId.create() })
 *   .withSnapshots()
 *   .build(Order);
 * ```
 *
 * @example Multiple capabilities, ordered automatically
 * ```typescript
 * const order = AggregateBuilder
 *   .create({ id: EntityId.create() })
 *   .withVersioning()
 *   .withAudit()
 *   .withSnapshots()
 *   .withEventSourcing(myEventStore)
 *   .build(Order);
 * ```
 *
 * @example Shorthand — all four built-in capabilities
 * ```typescript
 * const order = AggregateBuilder
 *   .create({ id })
 *   .buildWithAllCapabilities(Order);
 * ```
 *
 * @example Reconstituting from history with capabilities pre-attached
 * ```typescript
 * const order = AggregateBuilder
 *   .create({ id, version: 0 })
 *   .withAudit()
 *   .build(Order);
 * order.loadFromHistory(eventsFromStore);
 * ```
 *
 * @public
 * @stable
 * @since 0.1.0
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
   * @returns Aggregate
   */
  static create<TId = string>(params: {
    id: TId | EntityId<TId>;
    version?: number;
  }): AggregateBuilder<TId> {
    const constructorParams: IAggregateConstructorParams<TId> = {
      id: params.id instanceof EntityId ? params.id : new EntityId(params.id, 'text'),
      version: params.version || 0,
    } as IAggregateConstructorParams<TId>;
    return new AggregateBuilder(constructorParams);
  }

  withSnapshots(): this {
    this.capabilities.push({ capability: new SnapshotCapability() });
    return this;
  }

  /**
   * @returns {this} Builder instance for method chaining
   */
  withVersioning(): this {
    this.capabilities.push({ capability: new VersioningCapability() });
    return this;
  }

  /**
   * @returns {this} Builder instance for method chaining
   */
  withAudit(): this {
    this.capabilities.push({ capability: new AuditCapability() });
    return this;
  }

  /**
   * @param {IEventStore} [eventStore] - Optional event store for event sourcing
   * @returns {this} Builder instance for method chaining
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
   * @param {T} capability - Custom capability instance to add
   * @param {(cap: T) => void} configure - Optional configuration function for the capability
   * @returns {this} Builder instance for method chaining
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
   * @param {IEventStore} eventStore - Event store instance for event sourcing capability
   * @returns {this} Builder instance for method chaining
   */
  setEventStore(eventStore: IEventStore): this {
    this.eventStore = eventStore;
    return this;
  }

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
   * @param {new (params: IAggregateConstructorParams<TId>) => TAgg} AggregateClass - Optional aggregate class constructor
   * @returns {TAgg} Fully configured aggregate with all standard capabilities
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
 * @param {object} params - Parameters for creating aggregate builder
 * @param {TId | EntityId<TId>} params.id - Entity identifier
 * @param {number} [params.version] - Optional version number
 * @returns {AggregateBuilder<TId>} New aggregate builder instance
 */
export function aggregateBuilder<TId = string>(params: {
  id: TId | EntityId<TId>;
  version?: number;
}): AggregateBuilder<TId> {
  return AggregateBuilder.create(params);
}
