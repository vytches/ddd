/* eslint-disable @typescript-eslint/no-explicit-any */
import { Logger } from '@vytches-ddd/logging';
import type { CapabilityConstructor, Capability, IAggregateCapability } from '@vytches-ddd/contracts';
import { AggregateError } from './aggregate-errors';
import type { IAggregateRoot } from './aggregate-interfaces';

// Import concrete capability classes
import { SnapshotCapability } from './capabilities/snapshot-capability';
import { VersioningCapability } from './capabilities/versioning-capability';
import { EventSourcingCapability } from './capabilities/event-sourcing-capability';
import { AuditCapability } from './capabilities/audit-capability';

// Import new type-safe aggregate
import { AggregateRoot } from './aggregate-root';

// ==========================================
// TYPE UTILITIES
// ==========================================

/**
 * Helper type to extract aggregate with specific capabilities
 */
export type AggregateWithCapability<TId, TCap extends Capability> = AggregateRoot<TId> & {
  getCapability<T extends TCap>(CapabilityClass: CapabilityConstructor<T>): T;
};

export type AggregateWithSnapshotCapability<TId> = AggregateWithCapability<TId, SnapshotCapability>;
export type AggregateWithVersioningCapability<TId> = AggregateWithCapability<TId, VersioningCapability>;
export type AggregateWithAuditCapability<TId> = AggregateWithCapability<TId, AuditCapability>;
export type AggregateWithEventSourcingCapability<TId> = AggregateWithCapability<TId, EventSourcingCapability>;

// ==========================================
// TYPE GUARDS
// ==========================================

/**
 * Type guard to check if aggregate has snapshot capability
 */
export function hasSnapshotCapability<TId>(
  aggregate: AggregateRoot<TId>
): aggregate is AggregateWithSnapshotCapability<TId> {
  return aggregate.hasCapability(SnapshotCapability);
}

/**
 * Type guard to check if aggregate has versioning capability
 */
export function hasVersioningCapability<TId>(
  aggregate: AggregateRoot<TId>
): aggregate is AggregateWithVersioningCapability<TId> {
  return aggregate.hasCapability(VersioningCapability);
}

/**
 * Type guard to check if aggregate has audit capability
 */
export function hasAuditCapability<TId>(
  aggregate: AggregateRoot<TId>
): aggregate is AggregateWithAuditCapability<TId> {
  return aggregate.hasCapability(AuditCapability);
}

/**
 * Type guard to check if aggregate has event sourcing capability
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
 * Helper function to cast aggregate to specific capability type
 */
export function asSnapshotAggregate<TId>(
  aggregate: AggregateRoot<TId>
): AggregateWithSnapshotCapability<TId> {
  if (!hasSnapshotCapability(aggregate)) {
    throw AggregateError.featureNotEnabled('snapshot');
  }
  return aggregate;
}

export function asVersioningAggregate<TId>(
  aggregate: AggregateRoot<TId>
): AggregateWithVersioningCapability<TId> {
  if (!hasVersioningCapability(aggregate)) {
    throw AggregateError.featureNotEnabled('versioning');
  }
  return aggregate;
}

export function asAuditAggregate<TId>(
  aggregate: AggregateRoot<TId>
): AggregateWithAuditCapability<TId> {
  if (!hasAuditCapability(aggregate)) {
    throw AggregateError.featureNotEnabled('audit');
  }
  return aggregate;
}

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
 * Gets a list of all capabilities attached to an aggregate
 */
export function getAggregateCapabilities(aggregate: AggregateRoot<any>): string[] {
  return aggregate.getCapabilityTypes();
}

/**
 * Checks if aggregate has all specified capabilities
 */
export function hasAllCapabilities<T extends Capability & IAggregateCapability>(
  aggregate: AggregateRoot<any>,
  capabilities: CapabilityConstructor<T>[]
): boolean {
  return capabilities.every(CapabilityClass => aggregate.hasCapability(CapabilityClass));
}

/**
 * Checks if aggregate has any of the specified capabilities
 */
export function hasAnyCapability<T extends Capability & IAggregateCapability>(
  aggregate: AggregateRoot<any>,
  capabilities: CapabilityConstructor<T>[]
): boolean {
  return capabilities.some(CapabilityClass => aggregate.hasCapability(CapabilityClass));
}

/**
 * Gets detailed information about aggregate capabilities
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
  aggregate: AggregateRoot<any>,
  serializer: () => TState,
  metadataCreator?: () => any
): any | null {
  if (hasSnapshotCapability(aggregate)) {
    const snapshotCap = aggregate.getCapability(SnapshotCapability);
    return snapshotCap?.createSnapshot(serializer as () => unknown, metadataCreator) || null;
  }
  return null;
}

/**
 * Restores from snapshot if the aggregate has snapshot capability
 */
export function restoreFromSnapshotIfCapable<TState = unknown>(
  aggregate: AggregateRoot<any>,
  snapshot: any,
  deserializer: (state: TState) => void,
  metadataRestorer?: (metadata: any) => void
): boolean {
  if (hasSnapshotCapability(aggregate)) {
    const snapshotCap = aggregate.getCapability(SnapshotCapability);
    snapshotCap?.restoreFromSnapshot(snapshot, deserializer as (state: unknown) => void, metadataRestorer);
    return true;
  }
  return false;
}

// ==========================================
// AUDIT UTILITIES
// ==========================================

/**
 * Gets audit log if the aggregate has audit capability
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
 * Loads from event store if the aggregate has event sourcing capability
 */
export async function loadFromEventStoreIfCapable(
  aggregate: AggregateRoot<any>,
  aggregateId: any
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
 * Saves to event store if the aggregate has event sourcing capability
 */
export async function saveToEventStoreIfCapable(
  aggregate: AggregateRoot<any>
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
 * Registers an upcaster if the aggregate has versioning capability
 */
export function registerUpcasterIfCapable<TFrom, TTo>(
  aggregate: AggregateRoot<any>,
  eventType: string,
  sourceVersion: number,
  upcaster: { upcast(payload: TFrom, metadata?: any): TTo }
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
export function getVersioningInfoIfCapable(aggregate: AggregateRoot<any>): any | null {
  if (hasVersioningCapability(aggregate)) {
    const versioningCap = aggregate.getCapability(VersioningCapability);
    return versioningCap ? {
      registeredEventTypes: versioningCap.getRegisteredEventTypes(),
      hasUpcaster: (eventType: string, version: number) =>
        versioningCap.hasUpcaster(eventType, version),
    } : null;
  }
  return null;
}

// ==========================================
// BULK OPERATIONS
// ==========================================

/**
 * Processes multiple aggregates with type-safe capability checking
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
 * Clones capabilities from one aggregate to another
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