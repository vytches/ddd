/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  IExtendedDomainEvent,
  IEventMetadata,
  IEventUpcaster,
  IAuditEvent,
  IEventStore
} from '@vytches-ddd/contracts';

import type { EntityId } from '../value-objects';

// ==========================================
// CORE AGGREGATE INTERFACES
// ==========================================

/**
 * Base interface for all aggregate roots
 */
export interface IAggregateRoot<TId = string> {
  /**
   * Returns the aggregate identifier
   */
  getId(): EntityId<TId>;

  /**
   * Returns the current version of the aggregate
   */
  getVersion(): number;

  /**
   * Returns the initial version of the aggregate when it was loaded
   */
  getInitialVersion(): number;

  /**
   * Checks if the aggregate has uncommitted changes
   */
  hasChanges(): boolean;

  /**
   * Returns uncommitted domain events
   */
  getDomainEvents(): ReadonlyArray<IExtendedDomainEvent>;

  /**
   * Clears all uncommitted domain events and updates initial version
   */
  commit(): void;

  /**
   * Adds a capability to the aggregate
   */
  addCapability<T extends IAggregateCapability>(
    name: string,
    capability: T,
  ): this;

  /**
   * Gets a specific capability
   */
  getCapability<T extends IAggregateCapability>(name: string): T | undefined;

  /**
   * Checks if aggregate has a specific capability
   */
  hasCapability(name: string): boolean;

  /**
   * Removes a capability from the aggregate
   */
  removeCapability(name: string): this;
}

/**
 * Constructor parameters for aggregate root
 */
export interface IAggregateConstructorParams<TId> {
  id: EntityId<TId>;
  version?: number;
}

// ==========================================
// CAPABILITY SYSTEM
// ==========================================

/**
 * Base interface for all aggregate capabilities
 */
export interface IAggregateCapability {
  /**
   * Called when capability is attached to an aggregate
   */
  attach(aggregate: IAggregateRoot<any>): void;

  /**
   * Called when capability is detached from an aggregate
   */
  detach?(): void;
}

/**
 * Interface for snapshot capability
 */
export interface ISnapshotCapability<TState = any, TMeta = any>
  extends IAggregateCapability {
  /**
   * Creates a snapshot of the current aggregate state
   */
  createSnapshot(
    serializer: () => TState,
    metadataCreator?: () => TMeta,
  ): IAggregateSnapshot<TState, TMeta>;

  /**
   * Restores aggregate state from a snapshot
   */
  restoreFromSnapshot(
    snapshot: IAggregateSnapshot<TState, TMeta>,
    deserializer: (state: TState) => void,
    metadataRestorer?: (metadata: TMeta) => void,
  ): void;

  /**
   * Saves current state temporarily (for audit purposes)
   */
  saveSnapshot(serializer: () => TState, metadataCreator?: () => TMeta): void;

  /**
   * Gets and clears the previous state
   */
  getPreviousState(): any | null;
}

/**
 * Interface for versioning capability
 */
export interface IVersioningCapability extends IAggregateCapability {
  /**
   * Registers an upcaster for a specific event type and version
   */
  registerUpcaster<TFrom = any, TTo = any>(
    eventType: string,
    sourceVersion: number,
    upcaster: IEventUpcaster<TFrom, TTo>,
  ): this;

  /**
   * Handles versioned event processing
   */
  handleVersionedEvent(
    event: IExtendedDomainEvent,
    handlers: Map<string, IAggregateEventHandler>,
  ): void;
}

/**
 * Interface for event sourcing capability
 */
export interface IEventSourcingCapability extends IAggregateCapability {
  /**
   * Loads aggregate from event store
   */
  loadFromEventStore(aggregateId: any): Promise<void>;

  /**
   * Saves aggregate events to event store
   */
  saveToEventStore(): Promise<void>;

  /**
   * Replays events to rebuild aggregate state
   */
  replayEvents(events: IExtendedDomainEvent[]): void;
}

/**
 * Interface for audit capability
 */
export interface IAuditCapability extends IAggregateCapability {
  /**
   * Gets the audit log for this aggregate
   */
  getAuditLog(): ReadonlyArray<IAuditEvent>;

  /**
   * Clears the audit log
   */
  clearAuditLog(): void;
}

/**
 * Interface for middleware capability
 */
export interface IMiddlewareCapability extends IAggregateCapability {
  /**
   * Adds middleware to the event processing pipeline
   */
  use(middleware: EventAggregateMiddleware): this;
}

// ==========================================
// BUILDER INTERFACE
// ==========================================

/**
 * Interface for aggregate builder
 */
export interface IAggregateBuilder<TId> {
  /**
   * Adds snapshot capability
   */
  withSnapshots<TState = any, TMeta = any>(): this;

  /**
   * Adds versioning capability
   */
  withVersioning(): this;

  /**
   * Adds event sourcing capability
   */
  withEventSourcing(eventStore?: IEventStore): this;

  /**
   * Adds audit capability
   */
  withAudit(): this;

  /**
   * Adds custom capability
   */
  withCustomCapability<T extends IAggregateCapability>(
    name: string,
    capability: T,
  ): this;

  /**
   * Builds the aggregate with all configured capabilities
   */
  build(): IAggregateRoot<TId>;
}

// ==========================================
// SUPPORTING TYPES AND INTERFACES
// ==========================================

/**
 * Event handler function signature
 */
export interface IAggregateEventHandler<T = any> {
  (payload: T, metadata?: IEventMetadata): void;
}

/**
 * Event middleware function signature
 */
export type EventAggregateMiddleware<T = any> = (
  event: IExtendedDomainEvent<T>,
  next: (event: IExtendedDomainEvent<T>) => void,
) => void;

/**
 * Represents an aggregate snapshot
 */
export interface IAggregateSnapshot<TState = any, TMeta = any> {
  /** Aggregate identifier */
  id: any;

  /** Aggregate version */
  version: number;

  /** Aggregate type */
  aggregateType: string;

  /** Aggregate state */
  state: TState;

  /** When the snapshot was created */
  timestamp: Date;

  /** Snapshot metadata (optional) */
  metadata?: TMeta | undefined;

  /** ID of the last event included in the snapshot (optional) */
  lastEventId?: string | undefined;
}


// ==========================================
// TYPE GUARDS
// ==========================================

/**
 * Type guard to check if aggregate has snapshot capability
 */
export function hasSnapshotCapability<TId>(
  aggregate: IAggregateRoot<TId>,
): aggregate is IAggregateRoot<TId> & {
  getCapability(name: 'snapshot'): ISnapshotCapability;
} {
  return aggregate.hasCapability('snapshot');
}

/**
 * Type guard to check if aggregate has versioning capability
 */
export function hasVersioningCapability<TId>(
  aggregate: IAggregateRoot<TId>,
): aggregate is IAggregateRoot<TId> & {
  getCapability(name: 'versioning'): IVersioningCapability;
} {
  return aggregate.hasCapability('versioning');
}

/**
 * Type guard to check if aggregate has event sourcing capability
 */
export function hasEventSourcingCapability<TId>(
  aggregate: IAggregateRoot<TId>,
): aggregate is IAggregateRoot<TId> & {
  getCapability(name: 'eventSourcing'): IEventSourcingCapability;
} {
  return aggregate.hasCapability('eventSourcing');
}

/**
 * Type guard to check if aggregate has audit capability
 */
export function hasAuditCapability<TId>(
  aggregate: IAggregateRoot<TId>,
): aggregate is IAggregateRoot<TId> & {
  getCapability(name: 'audit'): IAuditCapability;
} {
  return aggregate.hasCapability('audit');
}

/**
 * Type guard to check if aggregate has middleware capability
 */
export function hasMiddlewareCapability<TId>(
  aggregate: IAggregateRoot<TId>,
): aggregate is IAggregateRoot<TId> & {
  getCapability(name: 'middleware'): IMiddlewareCapability;
} {
  return aggregate.hasCapability('middleware');
}

// ==========================================
// CAPABILITY CONSTANTS
// ==========================================

/**
 * Standard capability names
 */
export const CAPABILITY_NAMES = {
  SNAPSHOT: 'snapshot',
  VERSIONING: 'versioning',
  EVENT_SOURCING: 'eventSourcing',
  AUDIT: 'audit',
  MIDDLEWARE: 'middleware',
} as const;

/**
 * Type for capability names
 */
export type CapabilityName =
  (typeof CAPABILITY_NAMES)[keyof typeof CAPABILITY_NAMES];

// ==========================================
// UTILITY TYPES
// ==========================================

/**
 * Extract the ID type from an aggregate
 */
export type AggregateIdType<T> =
  T extends IAggregateRoot<infer TId> ? TId : never;

/**
 * Type for aggregates with specific capabilities
 */
export type AggregateWithCapabilities<
  TId,
  TCapabilities extends CapabilityName[],
> = IAggregateRoot<TId> & {
  [K in TCapabilities[number] as `getCapability`]: (
    name: K,
  ) => K extends 'snapshot'
    ? ISnapshotCapability
    : K extends 'versioning'
      ? IVersioningCapability
      : K extends 'eventSourcing'
        ? IEventSourcingCapability
        : K extends 'audit'
          ? IAuditCapability
          : K extends 'middleware'
            ? IMiddlewareCapability
            : IAggregateCapability;
};

// ==========================================
// AGGREGATE FACTORY INTERFACE
// ==========================================

/**
 * Factory interface for creating aggregates
 */
export interface IAggregateFactory<
  TId,
  TAggregate extends IAggregateRoot<TId>,
> {
  /**
   * Creates a new aggregate instance
   */
  create(id: EntityId<TId>, ...args: any[]): TAggregate;

  /**
   * Rebuilds aggregate from events
   */
  fromEvents(id: EntityId<TId>, events: IExtendedDomainEvent[]): TAggregate;

  /**
   * Rebuilds aggregate from snapshot and subsequent events
   */
  fromSnapshot<TState, TMeta>(
    snapshot: IAggregateSnapshot<TState, TMeta>,
    events: IExtendedDomainEvent[],
  ): TAggregate;
}

// ==========================================
// VALIDATION INTERFACES
// ==========================================

/**
 * Interface for aggregate validation
 */
export interface IAggregateValidator<TAggregate extends IAggregateRoot<any>> {
  /**
   * Validates aggregate state
   */
  validate(aggregate: TAggregate): ValidationResult;

  /**
   * Validates aggregate before applying event
   */
  validateBeforeEvent(
    aggregate: TAggregate,
    event: IExtendedDomainEvent,
  ): ValidationResult;
}

/**
 * Validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: IValidationError[];
}

/**
 * Validation error
 */
export interface IValidationError {
  field: string;
  message: string;
  code?: string;
}

// ==========================================
// ADVANCED CAPABILITY INTERFACES
// ==========================================

/**
 * Interface for caching capability
 */
export interface ICachingCapability extends IAggregateCapability {
  /**
   * Gets cached value
   */
  get<T>(key: string): T | undefined;

  /**
   * Sets cached value
   */
  set<T>(key: string, value: T, ttl?: number): void;

  /**
   * Clears all cached values
   */
  clear(): void;

  /**
   * Invalidates specific cached value
   */
  invalidate(key: string): void;
}

/**
 * Interface for metrics capability
 */
export interface IMetricsCapability extends IAggregateCapability {
  /**
   * Records a metric
   */
  record(name: string, value: number, tags?: Record<string, string>): void;

  /**
   * Increments a counter
   */
  increment(name: string, tags?: Record<string, string>): void;

  /**
   * Records timing information
   */
  timing(name: string, duration: number, tags?: Record<string, string>): void;

  /**
   * Gets recorded metrics
   */
  getMetrics(): MetricData[];
}

/**
 * Metric data structure
 */
export interface MetricData {
  name: string;
  value: number;
  type: 'counter' | 'gauge' | 'timing';
  tags?: Record<string, string>;
  timestamp: Date;
}

/**
 * Interface for security capability
 */
export interface ISecurityCapability extends IAggregateCapability {
  /**
   * Encrypts sensitive data
   */
  encrypt(data: any): string;

  /**
   * Decrypts sensitive data
   */
  decrypt(encryptedData: string): any;

  /**
   * Checks if user has permission to perform action
   */
  hasPermission(action: string, user?: any): boolean;

  /**
   * Logs security events
   */
  logSecurityEvent(event: SecurityEvent): void;
}

/**
 * Security event
 */
export interface SecurityEvent {
  type: 'access' | 'modification' | 'failure';
  action: string;
  user?: any;
  timestamp: Date;
  metadata?: Record<string, any>;
}
