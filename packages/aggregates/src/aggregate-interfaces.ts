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
  /**
   * Optional advisory limit on uncommitted domain events. If `apply()` is
   * called when `_domainEvents.length >= maxEvents`, an error is thrown.
   *
   * Use to guard against runaway loops or replays of corrupted/malicious
   * event streams that could allocate unbounded memory. A typical value is
   * 10_000 — high enough that legitimate aggregates never hit it, low
   * enough that a bug allocates seconds of memory, not gigabytes.
   *
   * REL-007 (2026-05-08): added as a defensive default-off safeguard.
   * Leave undefined for "no limit" (preserves backward compatibility).
   */
  maxEvents?: number;
  /**
   * VF-023 (D-4, AC6, non-breaking addition): controls what happens when
   * `apply()` (live) or `loadFromHistory()` (replay) processes an event for
   * which no handler was registered via `registerEventHandler()`.
   *
   * - `"warn"` (default): the event is still recorded/replayed, but a
   *   warning is logged via the library's internal logger. Preserves the
   *   previous behavior's intent (missing handlers did not throw) without
   *   silently swallowing the condition.
   * - `"throw"`: fail fast instead — useful in tests or strict environments
   *   where a missing handler indicates a real bug.
   *
   * Leave undefined for the default `"warn"` behavior (backward compatible).
   */
  onMissingHandler?: 'warn' | 'throw';
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

// VF-031 (D-10): removed `IAggregateBuilder<TId>`. It was exported from the
// package barrel but shape-incompatible with the real `AggregateBuilder`
// class (e.g. `build()` never returns a bare `IAggregateRoot<TId>`) — a
// broken public interface is worse than none. This is a BREAKING CHANGE,
// see CHANGELOG. If you need the builder's contract, use the concrete
// `AggregateBuilder` class from `./aggregate-builder` directly.

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

// VF-031 (D-9): removed the duplicate/speculative interface block that used
// to live here: `IAggregateFactory`, `IAggregateValidator` (+ its
// `ValidationResult`/`IValidationError` support types), and the "advanced
// capability" trio `ICachingCapability` / `IMetricsCapability` (+
// `MetricData`) / `ISecurityCapability` (+ `SecurityEvent`). None of them
// were exported from the package barrel or implemented/consumed anywhere in
// the codebase — pure speculative dead code, same cleanup pattern as
// REL-009 (`IAggregateSnapshot`) above.
