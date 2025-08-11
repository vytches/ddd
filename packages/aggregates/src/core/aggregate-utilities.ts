/* eslint-disable @typescript-eslint/no-explicit-any */
import { Logger } from '@vytches/ddd-logging';
import type {
  CapabilityConstructor,
  Capability,
  IAggregateCapability,
  IAggregateSnapshot,
} from '@vytches/ddd-contracts';
import { AggregateError } from '../aggregate-errors';
import type { IAggregateRoot } from '../aggregate-interfaces';

// Import concrete capability classes
import { SnapshotCapability } from '../capabilities/snapshot-capability';
import { VersioningCapability } from '../capabilities/versioning-capability';
import { EventSourcingCapability } from '../capabilities/event-sourcing-capability';
import { AuditCapability } from '../capabilities/audit-capability';

// Import new type-safe aggregate
import type { AggregateRoot } from './aggregate-root';

// ==========================================
// TYPE UTILITIES
// ==========================================

/**
 * Type utility for aggregates with specific capability requirements.
 * Provides compile-time type safety for capability-dependent operations.
 */
export type AggregateWithCapability<TId, TCap extends Capability> = AggregateRoot<TId> & {
  getCapability<T extends TCap>(CapabilityClass: CapabilityConstructor<T>): T;
};

/**
 * Type alias for aggregates with snapshot capability.
 * Ensures aggregate has snapshot functionality for state persistence.
 */
export type AggregateWithSnapshotCapability<TId> = AggregateWithCapability<TId, SnapshotCapability>;

/**
 * Type alias for aggregates with versioning capability.
 * Ensures aggregate has event versioning and upcasting functionality.
 */
export type AggregateWithVersioningCapability<TId> = AggregateWithCapability<
  TId,
  VersioningCapability
>;

/**
 * Type alias for aggregates with audit capability.
 * Ensures aggregate has audit logging functionality for compliance.
 */
export type AggregateWithAuditCapability<TId> = AggregateWithCapability<TId, AuditCapability>;

/**
 * Type alias for aggregates with event sourcing capability.
 * Ensures aggregate has event store integration for persistence.
 */
export type AggregateWithEventSourcingCapability<TId> = AggregateWithCapability<
  TId,
  EventSourcingCapability
>;

// ==========================================
// TYPE GUARDS
// ==========================================

/**
 * @param {AggregateRoot<TId>} aggregate - aggregate parameter
 * @returns {aggregate is AggregateWithSnapshotCapability<TId>} Returns aggregate is AggregateWithSnapshotCapability<TId>
 * @throws {Error} When validation fails
 */
export function hasSnapshotCapability<TId>(
  aggregate: AggregateRoot<TId>
): aggregate is AggregateWithSnapshotCapability<TId> {
  return aggregate.hasCapability(SnapshotCapability);
}

/**
 * @param {AggregateRoot<TId>} aggregate - aggregate parameter
 * @returns {aggregate is AggregateWithVersioningCapability<TId>} Returns aggregate is AggregateWithVersioningCapability<TId>
 * @throws {Error} When validation fails
 */
export function hasVersioningCapability<TId>(
  aggregate: AggregateRoot<TId>
): aggregate is AggregateWithVersioningCapability<TId> {
  return aggregate.hasCapability(VersioningCapability);
}

/**
 * @param {AggregateRoot<TId>} aggregate - aggregate parameter
 * @returns {aggregate is AggregateWithAuditCapability<TId>} Returns aggregate is AggregateWithAuditCapability<TId>
 * @throws {Error} When validation fails
 */
export function hasAuditCapability<TId>(
  aggregate: AggregateRoot<TId>
): aggregate is AggregateWithAuditCapability<TId> {
  return aggregate.hasCapability(AuditCapability);
}

/**
 * @param {AggregateRoot<TId>} aggregate - aggregate parameter
 * @returns {aggregate is AggregateWithEventSourcingCapability<TId>} Returns aggregate is AggregateWithEventSourcingCapability<TId>
 * @throws {Error} When validation fails
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
 * @param {AggregateRoot<TId>} aggregate - aggregate parameter
 * @returns {AggregateWithSnapshotCapability<TId>} Returns AggregateWithSnapshotCapability<TId>
 * @throws {Error} When validation fails
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
 * @param {AggregateRoot<TId>} aggregate - aggregate parameter
 * @returns {AggregateWithVersioningCapability<TId>} Returns AggregateWithVersioningCapability<TId>
 * @throws {Error} When validation fails
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
 * @param {AggregateRoot<TId>} aggregate - aggregate parameter
 * @returns {AggregateWithAuditCapability<TId>} Returns AggregateWithAuditCapability<TId>
 * @throws {Error} When validation fails
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
 * @param {AggregateRoot<TId>} aggregate - aggregate parameter
 * @returns {AggregateWithEventSourcingCapability<TId>} Returns AggregateWithEventSourcingCapability<TId>
 * @throws {Error} When validation fails
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
 * @param {AggregateRoot<unknown>} aggregate - aggregate parameter
 * @returns {string[]} Returns string[]
 * @throws {Error} When validation fails
 */
export function getAggregateCapabilities(aggregate: AggregateRoot<unknown>): string[] {
  return aggregate.getCapabilityTypes();
}

/**
 * @param {AggregateRoot<unknown>} aggregate - aggregate parameter
 * @param {CapabilityConstructor<T>[]} capabilities - capabilities parameter
 * @returns {boolean} Returns boolean
 * @throws {Error} When validation fails
 */
export function hasAllCapabilities<T extends Capability & IAggregateCapability>(
  aggregate: AggregateRoot<unknown>,
  capabilities: CapabilityConstructor<T>[]
): boolean {
  return capabilities.every(CapabilityClass => aggregate.hasCapability(CapabilityClass));
}

/**
 * @param {AggregateRoot<unknown>} aggregate - aggregate parameter
 * @param {CapabilityConstructor<T>[]} capabilities - capabilities parameter
 * @returns {boolean} Returns boolean
 * @throws {Error} When validation fails
 */
export function hasAnyCapability<T extends Capability & IAggregateCapability>(
  aggregate: AggregateRoot<unknown>,
  capabilities: CapabilityConstructor<T>[]
): boolean {
  return capabilities.some(CapabilityClass => aggregate.hasCapability(CapabilityClass));
}

/**
 * @param {AggregateRoot<unknown>} aggregate - aggregate parameter
 * @throws {Error} When validation fails
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
 * @param {AggregateRoot<unknown>} aggregate - Aggregate to create snapshot for
 * @param {() => TState} serializer - Function to serialize aggregate state
 * @param {() => unknown} metadataCreator - Optional metadata creator function
 * @returns {unknown | null} Snapshot object if capability exists, null otherwise
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
 * @param {AggregateRoot<unknown>} aggregate - aggregate parameter
 * @param {IAggregateSnapshot<unknown} snapshot - snapshot parameter
 * @param {(state: TState} deserializer - deserializer parameter
 * @returns {boolean} Returns boolean
 * @throws {Error} When validation fails
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
 * @param {AggregateRoot<unknown>} aggregate - aggregate parameter
 * @returns {unknown[]} Returns unknown[]
 * @throws {Error} When validation fails
 */
export function getAuditLogIfCapable(aggregate: AggregateRoot<unknown>): unknown[] {
  if (hasAuditCapability(aggregate)) {
    const auditCap = aggregate.getCapability(AuditCapability);
    return (auditCap?.getAuditLog() || []) as unknown[];
  }
  return [];
}

/**
 * @param {AggregateRoot<unknown>} aggregate - Aggregate to get audit statistics from
 * @returns {unknown | null} Audit statistics if capability exists, null otherwise
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
 * @param {AggregateRoot<unknown>} aggregate - aggregate parameter
 * @param {string | number} aggregateId - aggregateId parameter
 * @returns {Promise<boolean>} Returns Promise<boolean>
 * @throws {Error} When validation fails
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
 * @param {AggregateRoot<unknown>} aggregate - aggregate parameter
 * @returns {Promise<boolean>} Returns Promise<boolean>
 * @throws {Error} When validation fails
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
 * @param {AggregateRoot<unknown>} aggregate - aggregate parameter
 * @param {string} eventType - eventType parameter
 * @param {number} sourceVersion - sourceVersion parameter
 * @param {{ upcast(payload: TFrom} upcaster - upcaster parameter
 * @param {unknown} metadata? - metadata? parameter
 * @returns {TTo }} Returns TTo }
 * @throws {Error} When validation fails
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
 * @param {AggregateRoot<unknown>} aggregate - Aggregate to get versioning info from
 * @returns {unknown | null} Versioning information if capability exists, null otherwise
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
 * @throws {Error} When validation fails
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
 * @throws {Error} When validation fails
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
