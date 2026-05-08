import type {
  Capability,
  CapabilityConstructor,
  EntityId,
  IAggregateSnapshot,
  IAuditEvent,
  IDomainEvent,
  IEventMetadata,
  IEventStore,
  IEventUpcaster,
} from '@vytches/ddd-contracts';

// ==========================================
// CORE AGGREGATE INTERFACES
// ==========================================

/**
 * Core interface for aggregate root functionality.
 * Provides the foundation for domain aggregates with event sourcing, versioning, and capability management.
 */
export interface IAggregateRoot<TId = string> {
  /**
   * Returns the aggregate identifier
   * @returns The unique identifier for this aggregate
   */
  getId(): EntityId<TId>;

  /**
   * Returns the current version of the aggregate
   * @returns Current version number for optimistic locking
   */
  getVersion(): number;

  /**
   * Returns the initial version when the aggregate was loaded
   * @returns Initial version number when loaded from storage
   */
  getInitialVersion(): number;

  /**
   * Checks if the aggregate has uncommitted changes
   * @returns True if there are uncommitted domain events
   */
  hasChanges(): boolean;

  /**
   * Returns uncommitted domain events
   * @returns Readonly array of uncommitted domain events
   */
  getDomainEvents(): ReadonlyArray<IDomainEvent>;

  /**
   * Clears all uncommitted domain events and updates initial version
   */
  commit(): void;

  /**
   * Adds a capability to the aggregate
   * @param capability - The capability instance to add
   * @returns The aggregate instance for method chaining
   */
  addCapability<T extends Capability & IAggregateCapability>(capability: T): this;

  /**
   * Gets a specific capability by its constructor
   * @param CapabilityClass - Constructor of the capability to retrieve
   * @returns The capability instance or undefined if not found
   */
  getCapability<T extends Capability & IAggregateCapability>(
    CapabilityClass: CapabilityConstructor<T>
  ): T | undefined;

  /**
   * Checks if aggregate has a specific capability
   * @param CapabilityClass - Constructor of the capability to check
   * @returns True if the capability is present
   */
  hasCapability<T extends Capability & IAggregateCapability>(
    CapabilityClass: CapabilityConstructor<T>
  ): boolean;

  /**
   * Removes a capability from the aggregate
   * @param {CapabilityClass} - Constructor of the capability to remove
   * @returns The aggregate instance for method chaining
   */
  removeCapability<T extends Capability & IAggregateCapability>(
    CapabilityClass: CapabilityConstructor<T>
  ): this;
}

/**
 * Parameters for aggregate construction.
 * Defines the minimal required data to create an aggregate instance.
 */
export interface IAggregateConstructorParams<TId = string> {
  /** Unique identifier for the aggregate */
  id: EntityId<TId>;
  /** Initial version number, defaults to 0 */
  version?: number;
}

// ==========================================
// CAPABILITY SYSTEM
// ==========================================

/**
 * Base interface for all aggregate capabilities.
 * Capabilities extend aggregate functionality with features like snapshots, versioning, and event sourcing.
 */
export interface IAggregateCapability {
  /**
   * Called when capability is attached to an aggregate
   * @param aggregate The aggregate to attach to
   */
  attach(aggregate: IAggregateRoot<unknown>): void;

  /**
   * Called when capability is detached from an aggregate
   */
  detach?(): void;
}

/**
 * Capability for creating and restoring aggregate snapshots.
 * Enables performance optimization by periodically saving aggregate state.
 */
export interface ISnapshotCapability<TState = unknown, TMeta = unknown>
  extends IAggregateCapability {
  /**
   * Creates a snapshot of the current aggregate state
   */
  createSnapshot(
    serializer: () => TState,
    metadataCreator?: () => TMeta
  ): IAggregateSnapshot<TState, TMeta>;

  /**
   * Restores aggregate state from a snapshot
   */
  restoreFromSnapshot(
    snapshot: IAggregateSnapshot<TState, TMeta>,
    deserializer: (state: TState) => void,
    metadataRestorer?: (metadata: TMeta) => void
  ): void;

  /**
   * Saves current state temporarily (for audit purposes)
   */
  saveSnapshot(serializer: () => TState, metadataCreator?: () => TMeta): void;

  /**
   * Gets and clears the previous state
   */
  getPreviousState(): unknown | null;
}

/**
 * Capability for handling event versioning and upcasting.
 * Enables backward compatibility when event schemas evolve.
 */
export interface IVersioningCapability extends IAggregateCapability {
  /**
   * Registers an upcaster for a specific event type and version
   */
  registerUpcaster<TFrom = unknown, TTo = unknown>(
    eventType: string,
    sourceVersion: number,
    upcaster: IEventUpcaster<TFrom, TTo>
  ): this;

  /**
   * Handles versioned event processing
   */
  handleVersionedEvent(event: IDomainEvent, handlers: Map<string, IAggregateEventHandler>): void;
}

/**
 * Capability for event store integration.
 * Enables loading and saving aggregates from/to event stores.
 */
export interface IEventSourcingCapability extends IAggregateCapability {
  /**
   * Loads aggregate from event store
   */
  loadFromEventStore(aggregateId: unknown): Promise<void>;

  /**
   * Saves aggregate events to event store
   */
  saveToEventStore(): Promise<void>;

  /**
   * Replays events to rebuild aggregate state
   */
  replayEvents(events: IDomainEvent[]): void;
}

/**
 * Capability for maintaining audit logs of aggregate changes.
 * Tracks all modifications for compliance and debugging purposes.
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
 * Capability for adding middleware to event processing pipeline.
 * Enables cross-cutting concerns like validation, logging, and transformation.
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
 * Builder interface for creating aggregates with capabilities.
 * Provides fluent API for configuring aggregate features before construction.
 */
export interface IAggregateBuilder<TId> {
  /**
   * Adds snapshot capability
   */
  withSnapshots<TState = unknown, TMeta = unknown>(): this;

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
  withCustomCapability<T extends IAggregateCapability>(name: string, capability: T): this;

  /**
   * Builds the aggregate with all configured capabilities
   */
  build(): IAggregateRoot<TId>;
}

// ==========================================
// SUPPORTING TYPES AND INTERFACES
// ==========================================

/**
 * Handler function for processing aggregate events.
 * Used internally by aggregates to handle domain events.
 */
export interface IAggregateEventHandler<T = unknown> {
  (payload: T, metadata?: IEventMetadata): void;
}

/**
 * Middleware function for event processing pipeline.
 * Enables interception and modification of events before they are handled.
 */
export type EventAggregateMiddleware<T = unknown> = (
  event: IDomainEvent<T>,
  next: (event: IDomainEvent<T>) => void
) => void;

// REL-009 (2026-05-08): removed dead duplicate `IAggregateSnapshot` interface.
// The canonical definition lives in
// `@vytches/ddd-contracts/src/shared/snapshot-types.ts` and is what
// `SnapshotCapability` actually imports. The duplicate here had a divergent
// shape (used `id: unknown` instead of `aggregateId: string`) but was never
// imported by any code — pure dead code. Removing it eliminates confusion
// for maintainers comparing the two definitions.
//
// If you need IAggregateSnapshot, import from `@vytches/ddd-contracts`:
//   import type { IAggregateSnapshot } from '@vytches/ddd-contracts';

// ==========================================
// TYPE GUARDS
// ==========================================

// Note: Type guards are now implemented in aggregate-utilities.ts with type-safe capability constructors

// ==========================================
// CAPABILITY CONSTANTS (DEPRECATED)
// ==========================================

/**
 * @deprecated Use capability constructors directly instead of string names
 * Constants for standard capability names.
 */
export const CAPABILITY_NAMES = {
  SNAPSHOT: 'snapshot',
  VERSIONING: 'versioning',
  EVENT_SOURCING: 'eventSourcing',
  AUDIT: 'audit',
  MIDDLEWARE: 'middleware',
} as const;

/**
 * @deprecated Use capability constructors directly instead of string names
 * Union type of all standard capability names.
 */
export type CapabilityName = (typeof CAPABILITY_NAMES)[keyof typeof CAPABILITY_NAMES];

// ==========================================
// UTILITY TYPES
// ==========================================

/**
 * Utility type to extract the ID type from an aggregate type.
 */
export type AggregateIdType<T> = T extends IAggregateRoot<infer TId> ? TId : never;

/**
 * @deprecated Use capability constructors directly instead of string-based capabilities
 * Utility type for aggregates with specific capabilities.
 */
export type AggregateWithCapabilities<
  TId,
  TCapabilities extends CapabilityName[],
> = IAggregateRoot<TId> & {
  [K in TCapabilities[number] as `getCapability`]: (
    name: K
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
 * Factory interface for creating and rebuilding aggregates.
 * Provides standard methods for aggregate lifecycle management.
 * @template TId - The type of the aggregate ID value (string, number, etc.)
 */
export interface IAggregateFactory<
  TId = string,
  TAggregate extends IAggregateRoot<TId> = IAggregateRoot<TId>,
> {
  /**
   * Creates a new aggregate instance
   */
  create(id: EntityId<TId>, ...args: unknown[]): TAggregate;

  /**
   * Rebuilds aggregate from events
   */
  fromEvents(id: EntityId<TId>, events: IDomainEvent[]): TAggregate;

  /**
   * Rebuilds aggregate from snapshot and subsequent events
   */
  fromSnapshot<TState, TMeta>(
    snapshot: IAggregateSnapshot<TState, TMeta>,
    events: IDomainEvent[]
  ): TAggregate;
}

// ==========================================
// VALIDATION INTERFACES
// ==========================================

/**
 * Interface for validating aggregate state and operations.
 * Enables business rule validation at the aggregate level.
 */
export interface IAggregateValidator<TAggregate extends IAggregateRoot<unknown>> {
  /**
   * Validates aggregate state
   */
  validate(aggregate: TAggregate): ValidationResult;

  /**
   * Validates aggregate before applying event
   */
  validateBeforeEvent(aggregate: TAggregate, event: IDomainEvent): ValidationResult;
}

/**
 * Result of aggregate validation operation.
 * Contains validation status and any error details.
 */
export interface ValidationResult {
  /** Whether the validation passed */
  isValid: boolean;
  /** List of validation errors if any */
  errors: IValidationError[];
}

/**
 * Represents a single validation error.
 * Provides details about what failed validation and why.
 */
export interface IValidationError {
  /** The field or property that failed validation */
  field: string;
  /** Human-readable error message */
  message: string;
  /** Optional error code for programmatic handling */
  code?: string;
}

// ==========================================
// ADVANCED CAPABILITY INTERFACES
// ==========================================

/**
 * Capability for caching aggregate data.
 * Provides key-value storage with TTL support for performance optimization.
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
 * Capability for collecting aggregate metrics.
 * Enables monitoring and observability of aggregate operations.
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
 * Represents a single metric data point.
 * Contains metric information with optional tags and timestamp.
 */
export interface MetricData {
  /** Metric name */
  name: string;
  /** Metric value */
  value: number;
  /** Type of metric */
  type: 'counter' | 'gauge' | 'timing';
  /** Optional tags for metric categorization */
  tags?: Record<string, string>;
  /** When the metric was recorded */
  timestamp: Date;
}

/**
 * Capability for security features like encryption and authorization.
 * Provides security controls for sensitive aggregate operations.
 */
export interface ISecurityCapability extends IAggregateCapability {
  /**
   * Encrypts sensitive data
   */
  encrypt(data: unknown): string;

  /**
   * Decrypts sensitive data
   */
  decrypt(encryptedData: string): unknown;

  /**
   * Checks if user has permission to perform action
   */
  hasPermission(action: string, user?: unknown): boolean;

  /**
   * Logs security events
   */
  logSecurityEvent(event: SecurityEvent): void;
}

/**
 * Represents a security-related event.
 * Used for audit trails and security monitoring.
 */
export interface SecurityEvent {
  /** Type of security event */
  type: 'access' | 'modification' | 'failure';
  /** Action that was performed */
  action: string;
  /** User who performed the action */
  user?: unknown;
  /** When the event occurred */
  timestamp: Date;
  /** Additional event metadata */
  metadata?: Record<string, unknown>;
}
