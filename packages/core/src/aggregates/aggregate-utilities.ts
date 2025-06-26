import { AggregateError } from './aggregate-errors';
import type {
  IAggregateRoot,
  ISnapshotCapability,
  IVersioningCapability,
  IEventSourcingCapability,
  IAuditCapability} from './aggregate-interfaces';
import {
  CAPABILITY_NAMES,
  hasSnapshotCapability,
  hasVersioningCapability,
  hasEventSourcingCapability,
  hasAuditCapability,
} from './aggregate-interfaces';

// ==========================================
// TYPE UTILITIES
// ==========================================

/**
 * Helper type to extract aggregate with specific capabilities
 */
export type AggregateWithSnapshotCapability<TId> = IAggregateRoot<TId> & {
  getCapability(name: 'snapshot'): ISnapshotCapability;
};

export type AggregateWithVersioningCapability<TId> = IAggregateRoot<TId> & {
  getCapability(name: 'versioning'): IVersioningCapability;
};

export type AggregateWithAuditCapability<TId> = IAggregateRoot<TId> & {
  getCapability(name: 'audit'): IAuditCapability;
};

export type AggregateWithEventSourcingCapability<TId> = IAggregateRoot<TId> & {
  getCapability(name: 'eventSourcing'): IEventSourcingCapability;
};

// ==========================================
// CASTING UTILITIES
// ==========================================

/**
 * Helper function to cast aggregate to specific capability type
 */
export function asSnapshotAggregate<TId>(
  aggregate: IAggregateRoot<TId>,
): AggregateWithSnapshotCapability<TId> {
  if (!hasSnapshotCapability(aggregate)) {
    throw AggregateError.featureNotEnabled('snapshot');
  }
  return aggregate as AggregateWithSnapshotCapability<TId>;
}

export function asVersioningAggregate<TId>(
  aggregate: IAggregateRoot<TId>,
): AggregateWithVersioningCapability<TId> {
  if (!hasVersioningCapability(aggregate)) {
    throw AggregateError.featureNotEnabled('versioning');
  }
  return aggregate as AggregateWithVersioningCapability<TId>;
}

export function asAuditAggregate<TId>(
  aggregate: IAggregateRoot<TId>,
): AggregateWithAuditCapability<TId> {
  if (!hasAuditCapability(aggregate)) {
    throw AggregateError.featureNotEnabled('audit');
  }
  return aggregate as AggregateWithAuditCapability<TId>;
}

export function asEventSourcingAggregate<TId>(
  aggregate: IAggregateRoot<TId>,
): AggregateWithEventSourcingCapability<TId> {
  if (!hasEventSourcingCapability(aggregate)) {
    throw AggregateError.featureNotEnabled('eventSourcing');
  }
  return aggregate as AggregateWithEventSourcingCapability<TId>;
}

// ==========================================
// CAPABILITY INSPECTION UTILITIES
// ==========================================

/**
 * Gets a list of all capabilities attached to an aggregate
 */
export function getAggregateCapabilities(
  aggregate: IAggregateRoot<any>,
): string[] {
  const capabilities: string[] = [];

  for (const capabilityName of Object.values(CAPABILITY_NAMES)) {
    if (aggregate.hasCapability(capabilityName)) {
      capabilities.push(capabilityName);
    }
  }

  return capabilities;
}

/**
 * Checks if aggregate has all specified capabilities
 */
export function hasAllCapabilities(
  aggregate: IAggregateRoot<any>,
  capabilities: string[],
): boolean {
  return capabilities.every((capability) =>
    aggregate.hasCapability(capability),
  );
}

/**
 * Checks if aggregate has any of the specified capabilities
 */
export function hasAnyCapability(
  aggregate: IAggregateRoot<any>,
  capabilities: string[],
): boolean {
  return capabilities.some((capability) => aggregate.hasCapability(capability));
}

/**
 * Gets detailed information about aggregate capabilities
 */
export function getAggregateInfo(aggregate: IAggregateRoot<any>): {
  id: any;
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
  aggregate: IAggregateRoot<any>,
  serializer: () => TState,
  metadataCreator?: () => any,
): any | null {
  if (hasSnapshotCapability(aggregate)) {
    const snapshotCap = aggregate.getCapability(
      CAPABILITY_NAMES.SNAPSHOT,
    ) as ISnapshotCapability;
    return snapshotCap.createSnapshot(serializer, metadataCreator);
  }
  return null;
}

/**
 * Restores from snapshot if the aggregate has snapshot capability
 */
export function restoreFromSnapshotIfCapable<TState>(
  aggregate: IAggregateRoot<any>,
  snapshot: any,
  deserializer: (state: TState) => void,
  metadataRestorer?: (metadata: any) => void,
): boolean {
  if (hasSnapshotCapability(aggregate)) {
    const snapshotCap = aggregate.getCapability(
      CAPABILITY_NAMES.SNAPSHOT,
    ) as ISnapshotCapability;
    snapshotCap.restoreFromSnapshot(snapshot, deserializer, metadataRestorer);
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
export function getAuditLogIfCapable(aggregate: IAggregateRoot<any>): any[] {
  if (hasAuditCapability(aggregate)) {
    const auditCap = aggregate.getCapability(
      CAPABILITY_NAMES.AUDIT,
    ) as IAuditCapability;
    return auditCap.getAuditLog() as any[];
  }
  return [];
}

/**
 * Gets audit statistics if the aggregate has audit capability
 */
export function getAuditStatsIfCapable(
  aggregate: IAggregateRoot<any>,
): any | null {
  if (hasAuditCapability(aggregate)) {
    const auditCap = aggregate.getCapability(CAPABILITY_NAMES.AUDIT) as any;
    return auditCap.getAuditStatistics?.() || null;
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
  aggregate: IAggregateRoot<any>,
  aggregateId: any,
): Promise<boolean> {
  if (hasEventSourcingCapability(aggregate)) {
    const eventSourcingCap = aggregate.getCapability(
      CAPABILITY_NAMES.EVENT_SOURCING,
    ) as IEventSourcingCapability;
    await eventSourcingCap.loadFromEventStore(aggregateId);
    return true;
  }
  return false;
}

/**
 * Saves to event store if the aggregate has event sourcing capability
 */
export async function saveToEventStoreIfCapable(
  aggregate: IAggregateRoot<any>,
): Promise<boolean> {
  if (hasEventSourcingCapability(aggregate)) {
    const eventSourcingCap = aggregate.getCapability(
      CAPABILITY_NAMES.EVENT_SOURCING,
    ) as IEventSourcingCapability;
    await eventSourcingCap.saveToEventStore();
    return true;
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
  aggregate: IAggregateRoot<any>,
  eventType: string,
  sourceVersion: number,
  upcaster: { upcast(payload: TFrom, metadata?: any): TTo },
): boolean {
  if (hasVersioningCapability(aggregate)) {
    const versioningCap = aggregate.getCapability(
      CAPABILITY_NAMES.VERSIONING,
    ) as IVersioningCapability;
    versioningCap.registerUpcaster(eventType, sourceVersion, upcaster);
    return true;
  }
  return false;
}

/**
 * Gets versioning information if the aggregate has versioning capability
 */
export function getVersioningInfoIfCapable(
  aggregate: IAggregateRoot<any>,
): any | null {
  if (hasVersioningCapability(aggregate)) {
    const versioningCap = aggregate.getCapability(
      CAPABILITY_NAMES.VERSIONING,
    ) as any;
    return {
      registeredEventTypes: versioningCap.getRegisteredEventTypes?.() || [],
      hasUpcaster: (eventType: string, version: number) =>
        versioningCap.hasUpcaster?.(eventType, version) || false,
    };
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
  aggregates: IAggregateRoot<TId>[],
  processors: {
    snapshot?: (aggregate: AggregateWithSnapshotCapability<TId>) => void;
    audit?: (aggregate: AggregateWithAuditCapability<TId>) => void;
    versioning?: (aggregate: AggregateWithVersioningCapability<TId>) => void;
    eventSourcing?: (
      aggregate: AggregateWithEventSourcingCapability<TId>,
    ) => Promise<void>;
  },
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
      promises.push(
        processors.eventSourcing(asEventSourcingAggregate(aggregate)),
      );
    }
  }

  await Promise.all(promises);
  return;
}

/**
 * Clones an aggregate's configuration to another aggregate
 */
export function cloneAggregateCapabilities<TIdFrom, TIdTo>(
  sourceAggregate: IAggregateRoot<TIdFrom>,
  targetAggregate: IAggregateRoot<TIdTo>,
  options: {
    includeSnapshot?: boolean;
    includeVersioning?: boolean;
    includeAudit?: boolean;
    includeEventSourcing?: boolean;
  } = {},
): void {
  const {
    includeSnapshot = true,
    includeVersioning = true,
    includeAudit = true,
    includeEventSourcing = true,
  } = options;

  if (includeSnapshot && hasSnapshotCapability(sourceAggregate)) {
    // Note: This would require more sophisticated capability cloning
    // For now, just indicate that the capability exists
    console.log('Source has snapshot capability - consider adding to target');
  }
}
