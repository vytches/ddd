import type { IEventStore, Capability } from '@vytches/ddd-contracts';
import { EntityId } from '@vytches/ddd-contracts';

import { AggregateRoot } from './aggregate-root';
import type { IAggregateConstructorParams, IAggregateCapability } from '../aggregate-interfaces';

// Import capability classes
import { SnapshotCapability } from '../capabilities/snapshot-capability';
import { VersioningCapability } from '../capabilities/versioning-capability';
import { EventSourcingCapability } from '../capabilities/event-sourcing-capability';
import { AuditCapability } from '../capabilities/audit-capability';

/**
 * @description-inject
 * @business-context-inject
 * @example-inject
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
   * @description-inject
   * @business-context-inject
   * @returns Aggregate
   * @example-inject
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
   * @description-inject
   * @business-context-inject
   * @example-inject
   */
  withSnapshots(): this {
    this.capabilities.push({ capability: new SnapshotCapability() });
    return this;
  }

  /**
   * @description-inject
   * @business-context-inject
   * @returns {this} Builder instance for method chaining
   * @example-inject
   */
  withVersioning(): this {
    this.capabilities.push({ capability: new VersioningCapability() });
    return this;
  }

  /**
   * @description-inject
   * @business-context-inject
   * @returns {this} Builder instance for method chaining
   * @example-inject
   */
  withAudit(): this {
    this.capabilities.push({ capability: new AuditCapability() });
    return this;
  }

  /**
   * @description-inject
   * @business-context-inject
   * @param {IEventStore} [eventStore] - Optional event store for event sourcing
   * @returns {this} Builder instance for method chaining
   * @example-inject
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
   * @description-inject
   * @business-context-inject
   * @param {T} capability - Custom capability instance to add
   * @param {(cap: T) => void} configure - Optional configuration function for the capability
   * @returns {this} Builder instance for method chaining
   * @example-inject
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
   * @description-inject
   * @business-context-inject
   * @param {IEventStore} eventStore - Event store instance for event sourcing capability
   * @returns {this} Builder instance for method chaining
   * @example-inject
   */
  setEventStore(eventStore: IEventStore): this {
    this.eventStore = eventStore;
    return this;
  }

  /**
   * @description-inject
   * @business-context-inject
   * @example-inject
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
   * @description-inject
   * @business-context-inject
   * @param {new (params: IAggregateConstructorParams<TId>) => TAgg} AggregateClass - Optional aggregate class constructor
   * @returns {TAgg} Fully configured aggregate with all standard capabilities
   * @example-inject
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
 * @description-inject
 * @business-context-inject
 * @param {object} params - Parameters for creating aggregate builder
 * @param {TId | EntityId<TId>} params.id - Entity identifier
 * @param {number} [params.version] - Optional version number
 * @returns {AggregateBuilder<TId>} New aggregate builder instance
 * @example-inject
 */
export function aggregateBuilder<TId = string>(params: {
  id: TId | EntityId<TId>;
  version?: number;
}): AggregateBuilder<TId> {
  return AggregateBuilder.create(params);
}
