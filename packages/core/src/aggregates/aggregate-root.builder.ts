import type {
  IAggregateRoot,
  IAggregateBuilder,
  IAggregateConstructorParams,
  IAggregateCapability} from './aggregate-interfaces';
import type { IEventStore } from '@vytches-ddd/contracts';
import {
  CAPABILITY_NAMES
} from './aggregate-interfaces';

import { AggregateRoot } from './aggregate-root';

import type { EntityId } from '../value-objects';
import {
  AuditCapability,
  EventSourcingCapability,
  SnapshotCapability,
  VersioningCapability,
} from './capabilities';

/**
 * Builder for creating aggregates with specific capabilities
 * Provides a fluent API for configuring aggregate capabilities
 */
export class AggregateBuilder<TId> implements IAggregateBuilder<TId> {
  private aggregate: IAggregateRoot<TId>;

  constructor(params: IAggregateConstructorParams<TId>) {
    this.aggregate = new AggregateRoot(params);
  }

  static create<TId>(
    params: IAggregateConstructorParams<TId>,
  ): AggregateBuilder<TId> {
    return new AggregateBuilder(params);
  }

  withSnapshots<TState = any, TMeta = any>(): this {
    this.aggregate.addCapability(
      CAPABILITY_NAMES.SNAPSHOT,
      new SnapshotCapability<TState, TMeta>(),
    );
    return this;
  }

  withVersioning(): this {
    this.aggregate.addCapability(
      CAPABILITY_NAMES.VERSIONING,
      new VersioningCapability(),
    );
    return this;
  }

  withEventSourcing(eventStore?: IEventStore): this {
    this.aggregate.addCapability(
      CAPABILITY_NAMES.EVENT_SOURCING,
      new EventSourcingCapability(eventStore),
    );
    return this;
  }

  withAudit(): this {
    this.aggregate.addCapability(CAPABILITY_NAMES.AUDIT, new AuditCapability());
    return this;
  }

  withCustomCapability<T extends IAggregateCapability>(
    name: string,
    capability: T,
  ): this {
    this.aggregate.addCapability(name, capability);
    return this;
  }

  build(): IAggregateRoot<TId> {
    return this.aggregate;
  }
}

// ==========================================
// SPECIALIZED BUILDERS
// ==========================================

/**
 * Test utility for creating aggregates with specific capabilities
 */
export class AggregateTestBuilder<TId> {
  private builder: AggregateBuilder<TId>;

  constructor(params: IAggregateConstructorParams<TId>) {
    this.builder = AggregateBuilder.create(params);
  }

  static forTesting<TId>(id: EntityId<TId>): AggregateTestBuilder<TId> {
    return new AggregateTestBuilder({ id, version: 0 });
  }

  withAllCapabilities(): this {
    this.builder
      .withSnapshots()
      .withVersioning()
      .withEventSourcing()
      .withAudit();
    return this;
  }

  withTestingCapabilities(): this {
    this.builder.withAudit();
    return this;
  }

  build(): IAggregateRoot<TId> {
    return this.builder.build();
  }
}

// ==========================================
// PERFORMANCE OPTIMIZED BUILDERS
// ==========================================

/**
 * Builder for lightweight aggregates (high-performance scenarios)
 */
export class LightweightAggregateBuilder<TTId> {
  static create<TId>(
    params: IAggregateConstructorParams<TId>,
  ): IAggregateRoot<TId> {
    return new AggregateRoot(params);
  }
}

/**
 * Builder for full-featured aggregates (complex business scenarios)
 */
export class FullFeaturedAggregateBuilder<TId> {
  static create<TId>(
    params: IAggregateConstructorParams<TId>,
  ): IAggregateRoot<TId> {
    return AggregateBuilder.create(params)
      .withSnapshots()
      .withVersioning()
      .withAudit()
      .withEventSourcing()
      .build();
  }
}

// ==========================================
// CONFIGURATION-DRIVEN BUILDER
// ==========================================

/**
 * Capability configuration object
 */
export interface CapabilityConfig {
  snapshot?: {
    enabled: boolean;
    autoSnapshot?: boolean;
    snapshotFrequency?: number;
  };
  versioning?: {
    enabled: boolean;
    strictVersioning?: boolean;
  };
  audit?: {
    enabled: boolean;
    captureSnapshots?: boolean;
  };
  eventSourcing?: {
    enabled: boolean;
    eventStore?: IEventStore;
  };
}

/**
 * Factory function that creates aggregates based on configuration
 */
export function createAggregateWithConfig<TId>(
  params: IAggregateConstructorParams<TId>,
  config: CapabilityConfig,
): IAggregateRoot<TId> {
  const builder = AggregateBuilder.create(params);

  if (config.snapshot?.enabled) {
    builder.withSnapshots();
  }

  if (config.versioning?.enabled) {
    builder.withVersioning();
  }

  if (config.audit?.enabled) {
    builder.withAudit();
  }

  if (config.eventSourcing?.enabled) {
    builder.withEventSourcing(config.eventSourcing.eventStore);
  }

  return builder.build();
}
