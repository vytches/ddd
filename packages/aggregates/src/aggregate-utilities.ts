/* eslint-disable @typescript-eslint/no-explicit-any */
import { Logger } from '@vytches-ddd/logging';
import type {
  CapabilityConstructor,
  Capability,
  IAggregateCapability,
  IAggregateSnapshot,
} from '@vytches-ddd/contracts';
import { AggregateError } from './aggregate-errors';
import type { IAggregateRoot } from './aggregate-interfaces';

// Import concrete capability classes
import { SnapshotCapability } from './capabilities/snapshot-capability';
import { VersioningCapability } from './capabilities/versioning-capability';
import { EventSourcingCapability } from './capabilities/event-sourcing-capability';
import { AuditCapability } from './capabilities/audit-capability';

// Import new type-safe aggregate
import type { AggregateRoot } from './aggregate-root';

// ==========================================
// TYPE UTILITIES
// ==========================================

/**
 * @llm-summary Type definition for aggregate with capability
 * @llm-domain Pattern
 * @llm-usage Frequent
 *
 * @description
 * AggregateWithCapability type implementing domain pattern implementation for aggregate with capability operations.
 *
 * @example
 * ```typescript
 * // Usage example
 * const value: AggregateWithCapability = {} as AggregateWithCapability;
 * ```
 *
 * @since 1.0.0
 * @public
 */
export type AggregateWithCapability<TId, TCap extends Capability> = AggregateRoot<TId> & {
  getCapability<T extends TCap>(CapabilityClass: CapabilityConstructor<T>): T;
};

/**
 * @llm-summary Type definition for aggregate with snapshot capability
 * @llm-domain Pattern
 * @llm-usage Frequent
 *
 * @description
 * AggregateWithSnapshotCapability type implementing domain pattern implementation for aggregate with snapshot capability operations.
 *
 * @example
 * ```typescript
 * // Usage example
 * const value: AggregateWithSnapshotCapability = {} as AggregateWithSnapshotCapability;
 * ```
 *
 * @since 1.0.0
 * @public
 */
export type AggregateWithSnapshotCapability<TId> = AggregateWithCapability<TId, SnapshotCapability>;

/**
 * @llm-summary Type definition for aggregate with versioning capability
 * @llm-domain Pattern
 * @llm-usage Frequent
 *
 * @description
 * AggregateWithVersioningCapability type implementing domain pattern implementation for aggregate with versioning capability operations.
 *
 * @example
 * ```typescript
 * // Usage example
 * const value: AggregateWithVersioningCapability = {} as AggregateWithVersioningCapability;
 * ```
 *
 * @since 1.0.0
 * @public
 */
export type AggregateWithVersioningCapability<TId> = AggregateWithCapability<
  TId,
  VersioningCapability
>;

/**
 * @llm-summary Type definition for aggregate with audit capability
 * @llm-domain Pattern
 * @llm-usage Frequent
 *
 * @description
 * AggregateWithAuditCapability type implementing domain pattern implementation for aggregate with audit capability operations.
 *
 * @example
 * ```typescript
 * // Usage example
 * const value: AggregateWithAuditCapability = {} as AggregateWithAuditCapability;
 * ```
 *
 * @since 1.0.0
 * @public
 */
export type AggregateWithAuditCapability<TId> = AggregateWithCapability<TId, AuditCapability>;

/**
 * @llm-summary Type definition for aggregate with event sourcing capability
 * @llm-domain Pattern
 * @llm-usage Frequent
 *
 * @description
 * AggregateWithEventSourcingCapability type implementing domain pattern implementation for aggregate with event sourcing capability operations.
 *
 * @example
 * ```typescript
 * // Usage example
 * const value: AggregateWithEventSourcingCapability = {} as AggregateWithEventSourcingCapability;
 * ```
 *
 * @since 1.0.0
 * @public
 */
export type AggregateWithEventSourcingCapability<TId> = AggregateWithCapability<
  TId,
  EventSourcingCapability
>;

// ==========================================
// TYPE GUARDS
// ==========================================

/**
 * @llm-summary has snapshot capability function
 * @llm-domain Pattern
 * @llm-pure true
 *
 * @description
 * hasSnapshotCapability function implementing domain pattern implementation for has snapshot capability operations.
 *
 *
 * @param {AggregateRoot<TId>} aggregate - aggregate parameter
 * @returns {aggregate is AggregateWithSnapshotCapability<TId>} Returns aggregate is AggregateWithSnapshotCapability<TId>
 * @throws {Error} When validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = hasSnapshotCapability(aggregate);
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, result] = safeRun(() => hasSnapshotCapability(aggregate));
 * ```
 *
 * @since 1.0.0
 * @public
 */
export function hasSnapshotCapability<TId>(
  aggregate: AggregateRoot<TId>
): aggregate is AggregateWithSnapshotCapability<TId> {
  return aggregate.hasCapability(SnapshotCapability);
}

/**
 * @llm-summary has versioning capability function
 * @llm-domain Pattern
 * @llm-pure true
 *
 * @description
 * hasVersioningCapability function implementing domain pattern implementation for has versioning capability operations.
 *
 *
 * @param {AggregateRoot<TId>} aggregate - aggregate parameter
 * @returns {aggregate is AggregateWithVersioningCapability<TId>} Returns aggregate is AggregateWithVersioningCapability<TId>
 * @throws {Error} When validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = hasVersioningCapability(aggregate);
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, result] = safeRun(() => hasVersioningCapability(aggregate));
 * ```
 *
 * @since 1.0.0
 * @public
 */
export function hasVersioningCapability<TId>(
  aggregate: AggregateRoot<TId>
): aggregate is AggregateWithVersioningCapability<TId> {
  return aggregate.hasCapability(VersioningCapability);
}

/**
 * @llm-summary has audit capability function
 * @llm-domain Pattern
 * @llm-pure true
 *
 * @description
 * hasAuditCapability function implementing domain pattern implementation for has audit capability operations.
 *
 *
 * @param {AggregateRoot<TId>} aggregate - aggregate parameter
 * @returns {aggregate is AggregateWithAuditCapability<TId>} Returns aggregate is AggregateWithAuditCapability<TId>
 * @throws {Error} When validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = hasAuditCapability(aggregate);
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, result] = safeRun(() => hasAuditCapability(aggregate));
 * ```
 *
 * @since 1.0.0
 * @public
 */
export function hasAuditCapability<TId>(
  aggregate: AggregateRoot<TId>
): aggregate is AggregateWithAuditCapability<TId> {
  return aggregate.hasCapability(AuditCapability);
}

/**
 * @llm-summary has event sourcing capability function
 * @llm-domain Pattern
 * @llm-pure true
 *
 * @description
 * hasEventSourcingCapability function implementing domain pattern implementation for has event sourcing capability operations.
 *
 *
 * @param {AggregateRoot<TId>} aggregate - aggregate parameter
 * @returns {aggregate is AggregateWithEventSourcingCapability<TId>} Returns aggregate is AggregateWithEventSourcingCapability<TId>
 * @throws {Error} When validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = hasEventSourcingCapability(aggregate);
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, result] = safeRun(() => hasEventSourcingCapability(aggregate));
 * ```
 *
 * @since 1.0.0
 * @public
 */
export function hasEventSourcingCapability<TId>(
  aggregate: AggregateRoot<TId>
): aggregate is AggregateWithEventSourcingCapability<TId> {
  return aggregate.hasCapability(EventSourcingCapability);
}

// ==========================================
// CASTING UTILITIES
// ==========================================

/**
 * @llm-summary as snapshot aggregate function
 * @llm-domain Pattern
 * @llm-pure false
 *
 * @description
 * asSnapshotAggregate function implementing domain pattern implementation for as snapshot aggregate operations.
 *
 *
 * @param {AggregateRoot<TId>} aggregate - aggregate parameter
 * @returns {AggregateWithSnapshotCapability<TId>} Returns AggregateWithSnapshotCapability<TId>
 * @throws {Error} When validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = asSnapshotAggregate(aggregate);
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, result] = safeRun(() => asSnapshotAggregate(aggregate));
 * ```
 *
 * @since 1.0.0
 * @public
 */
export function asSnapshotAggregate<TId>(
  aggregate: AggregateRoot<TId>
): AggregateWithSnapshotCapability<TId> {
  if (!hasSnapshotCapability(aggregate)) {
    throw AggregateError.featureNotEnabled('snapshot');
  }
  return aggregate;
}

/**
 * @llm-summary as versioning aggregate function
 * @llm-domain Pattern
 * @llm-pure false
 *
 * @description
 * asVersioningAggregate function implementing domain pattern implementation for as versioning aggregate operations.
 *
 *
 * @param {AggregateRoot<TId>} aggregate - aggregate parameter
 * @returns {AggregateWithVersioningCapability<TId>} Returns AggregateWithVersioningCapability<TId>
 * @throws {Error} When validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = asVersioningAggregate(aggregate);
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, result] = safeRun(() => asVersioningAggregate(aggregate));
 * ```
 *
 * @since 1.0.0
 * @public
 */
export function asVersioningAggregate<TId>(
  aggregate: AggregateRoot<TId>
): AggregateWithVersioningCapability<TId> {
  if (!hasVersioningCapability(aggregate)) {
    throw AggregateError.featureNotEnabled('versioning');
  }
  return aggregate;
}

/**
 * @llm-summary as audit aggregate function
 * @llm-domain Pattern
 * @llm-pure false
 *
 * @description
 * asAuditAggregate function implementing domain pattern implementation for as audit aggregate operations.
 *
 *
 * @param {AggregateRoot<TId>} aggregate - aggregate parameter
 * @returns {AggregateWithAuditCapability<TId>} Returns AggregateWithAuditCapability<TId>
 * @throws {Error} When validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = asAuditAggregate(aggregate);
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, result] = safeRun(() => asAuditAggregate(aggregate));
 * ```
 *
 * @since 1.0.0
 * @public
 */
export function asAuditAggregate<TId>(
  aggregate: AggregateRoot<TId>
): AggregateWithAuditCapability<TId> {
  if (!hasAuditCapability(aggregate)) {
    throw AggregateError.featureNotEnabled('audit');
  }
  return aggregate;
}

/**
 * @llm-summary as event sourcing aggregate function
 * @llm-domain Pattern
 * @llm-pure false
 *
 * @description
 * asEventSourcingAggregate function implementing domain pattern implementation for as event sourcing aggregate operations.
 *
 *
 * @param {AggregateRoot<TId>} aggregate - aggregate parameter
 * @returns {AggregateWithEventSourcingCapability<TId>} Returns AggregateWithEventSourcingCapability<TId>
 * @throws {Error} When validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = asEventSourcingAggregate(aggregate);
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, result] = safeRun(() => asEventSourcingAggregate(aggregate));
 * ```
 *
 * @since 1.0.0
 * @public
 */
export function asEventSourcingAggregate<TId>(
  aggregate: AggregateRoot<TId>
): AggregateWithEventSourcingCapability<TId> {
  if (!hasEventSourcingCapability(aggregate)) {
    throw AggregateError.featureNotEnabled('eventSourcing');
  }
  return aggregate;
}

// ==========================================
// CAPABILITY INSPECTION UTILITIES
// ==========================================

/**
 * @llm-summary get aggregate capabilities function
 * @llm-domain Pattern
 * @llm-pure true
 *
 * @description
 * getAggregateCapabilities function implementing domain pattern implementation for get aggregate capabilities operations.
 *
 *
 * @param {AggregateRoot<unknown>} aggregate - aggregate parameter
 * @returns {string[]} Returns string[]
 * @throws {Error} When validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = getAggregateCapabilities(aggregate);
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, result] = safeRun(() => getAggregateCapabilities(aggregate));
 * ```
 *
 * @since 1.0.0
 * @public
 */
export function getAggregateCapabilities(aggregate: AggregateRoot<unknown>): string[] {
  return aggregate.getCapabilityTypes();
}

/**
 * @llm-summary has all capabilities function
 * @llm-domain Pattern
 * @llm-pure true
 *
 * @description
 * hasAllCapabilities function implementing domain pattern implementation for has all capabilities operations.
 *
 *
 * @param {AggregateRoot<unknown>} aggregate - aggregate parameter
 * @param {CapabilityConstructor<T>[]} capabilities - capabilities parameter
 * @returns {boolean} Returns boolean
 * @throws {Error} When validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = hasAllCapabilities(aggregate, capabilities);
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, result] = safeRun(() => hasAllCapabilities(aggregate, capabilities));
 * ```
 *
 * @since 1.0.0
 * @public
 */
export function hasAllCapabilities<T extends Capability & IAggregateCapability>(
  aggregate: AggregateRoot<unknown>,
  capabilities: CapabilityConstructor<T>[]
): boolean {
  return capabilities.every(CapabilityClass => aggregate.hasCapability(CapabilityClass));
}

/**
 * @llm-summary has any capability function
 * @llm-domain Pattern
 * @llm-pure true
 *
 * @description
 * hasAnyCapability function implementing domain pattern implementation for has any capability operations.
 *
 *
 * @param {AggregateRoot<unknown>} aggregate - aggregate parameter
 * @param {CapabilityConstructor<T>[]} capabilities - capabilities parameter
 * @returns {boolean} Returns boolean
 * @throws {Error} When validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = hasAnyCapability(aggregate, capabilities);
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, result] = safeRun(() => hasAnyCapability(aggregate, capabilities));
 * ```
 *
 * @since 1.0.0
 * @public
 */
export function hasAnyCapability<T extends Capability & IAggregateCapability>(
  aggregate: AggregateRoot<unknown>,
  capabilities: CapabilityConstructor<T>[]
): boolean {
  return capabilities.some(CapabilityClass => aggregate.hasCapability(CapabilityClass));
}

/**
 * @llm-summary get aggregate info function
 * @llm-domain Pattern
 * @llm-pure true
 *
 * @description
 * getAggregateInfo function implementing domain pattern implementation for get aggregate info operations.
 *
 *
 * @param {AggregateRoot<unknown>} aggregate - aggregate parameter
 * @throws {Error} When validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = getAggregateInfo(aggregate);
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, result] = safeRun(() => getAggregateInfo(aggregate));
 * ```
 *
 * @since 1.0.0
 * @public
 */
export function getAggregateInfo(aggregate: AggregateRoot<unknown>): {
  id: unknown;
  type: string;
  version: number;
  hasChanges: boolean;
  capabilities: string[];
  events: number;
} {
  return {
    id: aggregate.getId().getValue(),
    type: aggregate.constructor.name,
    version: aggregate.getVersion(),
    hasChanges: aggregate.hasChanges(),
    capabilities: getAggregateCapabilities(aggregate),
    events: aggregate.getDomainEvents().length,
  };
}

// ==========================================
// SNAPSHOT UTILITIES
// ==========================================

/**
 * Creates a snapshot if the aggregate has snapshot capability
 */
export function createSnapshotIfCapable<TState>(
  aggregate: AggregateRoot<unknown>,
  serializer: () => TState,
  metadataCreator?: () => unknown
): unknown | null {
  if (hasSnapshotCapability(aggregate)) {
    const snapshotCap = aggregate.getCapability(SnapshotCapability);
    return snapshotCap?.createSnapshot(serializer as () => unknown, metadataCreator) || null;
  }
  return null;
}

/**
 * @llm-summary restore from snapshot if capable function
 * @llm-domain Pattern
 * @llm-pure false
 *
 * @description
 * restoreFromSnapshotIfCapable function implementing domain pattern implementation for restore from snapshot if capable operations.
 *
 *
 * @param {AggregateRoot<unknown>} aggregate - aggregate parameter
 * @param {IAggregateSnapshot<unknown} snapshot - snapshot parameter
 * @param {(state: TState} deserializer - deserializer parameter
 * @returns {boolean} Returns boolean
 * @throws {Error} When validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = restoreFromSnapshotIfCapable(aggregate, snapshot, deserializer);
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, result] = safeRun(() => restoreFromSnapshotIfCapable(aggregate, snapshot, deserializer));
 * ```
 *
 * @since 1.0.0
 * @public
 */
export function restoreFromSnapshotIfCapable<TState = unknown>(
  aggregate: AggregateRoot<unknown>,
  snapshot: IAggregateSnapshot<unknown, unknown>,
  deserializer: (state: TState) => void,
  metadataRestorer?: (metadata: unknown) => void
): boolean {
  if (hasSnapshotCapability(aggregate)) {
    const snapshotCap = aggregate.getCapability(SnapshotCapability);
    snapshotCap?.restoreFromSnapshot(
      snapshot,
      deserializer as (state: unknown) => void,
      metadataRestorer
    );
    return true;
  }
  return false;
}

// ==========================================
// AUDIT UTILITIES
// ==========================================

/**
 * @llm-summary get audit log if capable function
 * @llm-domain Pattern
 * @llm-pure true
 *
 * @description
 * getAuditLogIfCapable function implementing domain pattern implementation for get audit log if capable operations.
 *
 *
 * @param {AggregateRoot<unknown>} aggregate - aggregate parameter
 * @returns {unknown[]} Returns unknown[]
 * @throws {Error} When validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = getAuditLogIfCapable(aggregate);
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, result] = safeRun(() => getAuditLogIfCapable(aggregate));
 * ```
 *
 * @since 1.0.0
 * @public
 */
export function getAuditLogIfCapable(aggregate: AggregateRoot<unknown>): unknown[] {
  if (hasAuditCapability(aggregate)) {
    const auditCap = aggregate.getCapability(AuditCapability);
    return (auditCap?.getAuditLog() || []) as unknown[];
  }
  return [];
}

/**
 * Gets audit statistics if the aggregate has audit capability
 */
export function getAuditStatsIfCapable(aggregate: AggregateRoot<unknown>): unknown | null {
  if (hasAuditCapability(aggregate)) {
    const auditCap = aggregate.getCapability(AuditCapability);
    return auditCap?.getAuditStatistics() || null;
  }
  return null;
}

// ==========================================
// EVENT SOURCING UTILITIES
// ==========================================

/**
 * @llm-summary load from event store if capable function
 * @llm-domain Pattern
 * @llm-pure false
 *
 * @description
 * loadFromEventStoreIfCapable function implementing domain pattern implementation for load from event store if capable operations.
 *
 *
 * @param {AggregateRoot<unknown>} aggregate - aggregate parameter
 * @param {string | number} aggregateId - aggregateId parameter
 * @returns {Promise<boolean>} Returns Promise<boolean>
 * @throws {Error} When validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = loadFromEventStoreIfCapable(aggregate, aggregateId);
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, result] = safeRun(() => loadFromEventStoreIfCapable(aggregate, aggregateId));
 * ```
 *
 * @since 1.0.0
 * @public
 */
export async function loadFromEventStoreIfCapable(
  aggregate: AggregateRoot<unknown>,
  aggregateId: string | number
): Promise<boolean> {
  if (hasEventSourcingCapability(aggregate)) {
    const eventSourcingCap = aggregate.getCapability(EventSourcingCapability);
    if (eventSourcingCap) {
      await eventSourcingCap.loadFromEventStore(aggregateId);
      return true;
    }
  }
  return false;
}

/**
 * @llm-summary save to event store if capable function
 * @llm-domain Pattern
 * @llm-pure false
 *
 * @description
 * saveToEventStoreIfCapable function implementing domain pattern implementation for save to event store if capable operations.
 *
 *
 * @param {AggregateRoot<unknown>} aggregate - aggregate parameter
 * @returns {Promise<boolean>} Returns Promise<boolean>
 * @throws {Error} When validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = saveToEventStoreIfCapable(aggregate);
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, result] = safeRun(() => saveToEventStoreIfCapable(aggregate));
 * ```
 *
 * @since 1.0.0
 * @public
 */
export async function saveToEventStoreIfCapable(
  aggregate: AggregateRoot<unknown>
): Promise<boolean> {
  if (hasEventSourcingCapability(aggregate)) {
    const eventSourcingCap = aggregate.getCapability(EventSourcingCapability);
    if (eventSourcingCap) {
      await eventSourcingCap.saveToEventStore();
      return true;
    }
  }
  return false;
}

// ==========================================
// VERSIONING UTILITIES
// ==========================================

/**
 * @llm-summary register upcaster if capable function
 * @llm-domain Pattern
 * @llm-pure false
 *
 * @description
 * registerUpcasterIfCapable function implementing domain pattern implementation for register upcaster if capable operations.
 *
 *
 * @param {AggregateRoot<unknown>} aggregate - aggregate parameter
 * @param {string} eventType - eventType parameter
 * @param {number} sourceVersion - sourceVersion parameter
 * @param {{ upcast(payload: TFrom} upcaster - upcaster parameter
 * @param {unknown} metadata? - metadata? parameter
 * @returns {TTo }} Returns TTo }
 * @throws {Error} When validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = registerUpcasterIfCapable(aggregate, eventType, sourceVersion, upcaster, metadata?);
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, result] = safeRun(() => registerUpcasterIfCapable(aggregate, eventType, sourceVersion, upcaster, metadata?));
 * ```
 *
 * @since 1.0.0
 * @public
 */
export function registerUpcasterIfCapable<TFrom, TTo>(
  aggregate: AggregateRoot<unknown>,
  eventType: string,
  sourceVersion: number,
  upcaster: { upcast(payload: TFrom, metadata?: unknown): TTo }
): boolean {
  if (hasVersioningCapability(aggregate)) {
    const versioningCap = aggregate.getCapability(VersioningCapability);
    versioningCap?.registerUpcaster(eventType, sourceVersion, upcaster);
    return true;
  }
  return false;
}

/**
 * Gets versioning information if the aggregate has versioning capability
 */
export function getVersioningInfoIfCapable(aggregate: AggregateRoot<unknown>): unknown | null {
  if (hasVersioningCapability(aggregate)) {
    const versioningCap = aggregate.getCapability(VersioningCapability);
    return versioningCap
      ? {
          registeredEventTypes: versioningCap.getRegisteredEventTypes(),
          hasUpcaster: (eventType: string, version: number) =>
            versioningCap.hasUpcaster(eventType, version),
        }
      : null;
  }
  return null;
}

// ==========================================
// BULK OPERATIONS
// ==========================================

/**
 * @llm-summary process aggregates with capabilities function
 * @llm-domain Pattern
 * @llm-pure false
 *
 * @description
 * processAggregatesWithCapabilities function implementing domain pattern implementation for process aggregates with capabilities operations.
 *
 * @throws {Error} When validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = processAggregatesWithCapabilities();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, result] = safeRun(() => processAggregatesWithCapabilities());
 * ```
 *
 * @since 1.0.0
 * @public
 */
export async function processAggregatesWithCapabilities<TId>(
  aggregates: AggregateRoot<TId>[],
  processors: {
    snapshot?: (aggregate: AggregateWithSnapshotCapability<TId>) => void;
    audit?: (aggregate: AggregateWithAuditCapability<TId>) => void;
    versioning?: (aggregate: AggregateWithVersioningCapability<TId>) => void;
    eventSourcing?: (aggregate: AggregateWithEventSourcingCapability<TId>) => Promise<void>;
  }
): Promise<void> {
  const promises: Promise<void>[] = [];

  for (const aggregate of aggregates) {
    if (processors.snapshot && hasSnapshotCapability(aggregate)) {
      processors.snapshot(asSnapshotAggregate(aggregate));
    }

    if (processors.audit && hasAuditCapability(aggregate)) {
      processors.audit(asAuditAggregate(aggregate));
    }

    if (processors.versioning && hasVersioningCapability(aggregate)) {
      processors.versioning(asVersioningAggregate(aggregate));
    }

    if (processors.eventSourcing && hasEventSourcingCapability(aggregate)) {
      promises.push(processors.eventSourcing(asEventSourcingAggregate(aggregate)));
    }
  }

  await Promise.all(promises);
}

/**
 * @llm-summary clone aggregate capabilities function
 * @llm-domain Pattern
 * @llm-pure false
 *
 * @description
 * cloneAggregateCapabilities function implementing domain pattern implementation for clone aggregate capabilities operations.
 *
 * @throws {Error} When validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = cloneAggregateCapabilities();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, result] = safeRun(() => cloneAggregateCapabilities());
 * ```
 *
 * @since 1.0.0
 * @public
 */
export function cloneAggregateCapabilities<TIdFrom, TIdTo>(
  sourceAggregate: AggregateRoot<TIdFrom>,
  targetAggregate: AggregateRoot<TIdTo>,
  options: {
    includeSnapshot?: boolean;
    includeVersioning?: boolean;
    includeAudit?: boolean;
    includeEventSourcing?: boolean;
  } = {}
): void {
  const {
    includeSnapshot = true,
    includeVersioning = true,
    includeAudit = true,
    includeEventSourcing = true,
  } = options;

  if (includeSnapshot && hasSnapshotCapability(sourceAggregate)) {
    targetAggregate.addCapability(new SnapshotCapability());
  }

  if (includeVersioning && hasVersioningCapability(sourceAggregate)) {
    targetAggregate.addCapability(new VersioningCapability());
  }

  if (includeAudit && hasAuditCapability(sourceAggregate)) {
    targetAggregate.addCapability(new AuditCapability());
  }

  if (includeEventSourcing && hasEventSourcingCapability(sourceAggregate)) {
    const sourceCap = sourceAggregate.getCapability(EventSourcingCapability);
    const newCap = new EventSourcingCapability();
    if (sourceCap?.getEventStore()) {
      newCap.setEventStore(sourceCap.getEventStore()!);
    }
    targetAggregate.addCapability(newCap);
  }
}
