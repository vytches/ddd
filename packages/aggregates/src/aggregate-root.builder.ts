import type { IEventStore } from '@vytches-ddd/contracts';
import { EntityId } from '@vytches-ddd/contracts';

import { AggregateRoot } from './aggregate-root';
import type { IAggregateConstructorParams } from './aggregate-interfaces';

// Import capability classes
import { SnapshotCapability } from './capabilities/snapshot-capability';
import { VersioningCapability } from './capabilities/versioning-capability';
import { EventSourcingCapability } from './capabilities/event-sourcing-capability';
import { AuditCapability } from './capabilities/audit-capability';

/**
 * Type-safe builder for creating aggregates with capabilities
 */
export class AggregateBuilder<TId = string> {
  private params: IAggregateConstructorParams<TId>;
  private capabilities: Array<{
    capability: any;
    configure?: ((cap: any) => void) | undefined;
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
      configure: (cap: EventSourcingCapability) => {
        if (eventStore) {
          cap.setEventStore(eventStore);
        } else if (this.eventStore) {
          cap.setEventStore(this.eventStore);
        }
      },
    });
    return this;
  }

  /**
   * Add a custom capability
   */
  withCapability<T>(capability: T, configure?: (cap: T) => void): this {
    this.capabilities.push({ capability, configure });
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
 * Convenience function to create a builder
 */
export function aggregateBuilder<TId = string>(params: {
  id: TId | EntityId<TId>;
  version?: number;
}): AggregateBuilder<TId> {
  return AggregateBuilder.create(params);
}
